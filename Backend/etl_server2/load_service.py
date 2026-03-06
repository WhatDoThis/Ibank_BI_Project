"""
Backend.etl_server2.load_service (파일 기반 추출·적재)
======================================================
업로드된 파일 파싱 → 메인 DB 테이블 생성·적재. pk_columns 있으면 CREATE TABLE에 PRIMARY KEY 반영.

[Helpers]
===========
- _pg_type: inferred_type → PostgreSQL 타입 문자열
- _resolve_upload_path: DB 경로가 현재 프로세스에서 없을 때 uploads/파일명으로 폴백 해석
- _read_file: file_path, file_type으로 CSV/Excel/Parquet 읽기. CSV는 csv_reader.read_csv_robust 사용. (DataFrame, data_verification_needed)

[Main Functions]
===========
- run_file_load: etl_table_id 기준 파일 읽기 → total_rows 설정 → 메인 DB DROP+CREATE TABLE(pk_columns 있으면 PK 추가) → 배치 INSERT(2000건씩) → allowed_tables·job 갱신
- run_file_upsert: 추가 적재(동일 테이블). Job의 add_file_path 파일 읽어 타겟 테이블에 PK 기준 ON CONFLICT DO UPDATE. etl_tables.pk_columns 또는 메인 DB PK 사용.

[Dependencies]
=========
- Backend.api_server.db, Backend.etl_server2.service, schema_infer, transform_engine, transform_rules_service, etl_limits
- Backend.etl_server2.csv_reader (CSV 인코딩 감지·읽기)
- Env.config.loader.add_allowed_table
- pandas
"""

import logging
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# 업로드 디렉터리: router와 동일한 기준(etl_server/uploads). DB 경로와 실행 환경이 다를 때 폴백 해석용.
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"


def _resolve_upload_path(file_path: str) -> str:
    """
    DB에 저장된 file_path가 현재 프로세스에서 없을 때, uploads 디렉터리 내 동일 파일명으로 해석.
    (배포 경로/프로세스 분리 등으로 절대 경로가 어긋난 경우 대비.)
    """
    p = (file_path or "").strip()
    if not p:
        return p
    if os.path.isfile(p):
        return p
    base = os.path.basename(p)
    if not base:
        return p
    fallback = UPLOAD_DIR / base
    try:
        if fallback.is_file():
            return str(fallback.resolve())
    except (OSError, PermissionError):
        pass
    return p


from Backend.etl_server2 import schema_infer
from Backend.etl_server2 import service as etl_service
from Backend.etl_server2 import transform_engine
from Backend.etl_server2 import transform_rules_service as transform_rules_svc
from Backend.etl_server2.etl_limits import get_etl_limits
from Backend.etl_server2.load_service_file import normalize_column_name_for_sequence


# schema_infer inferred_type → PostgreSQL 타입
def _pg_type(inferred_type: str) -> str:
    t = (inferred_type or "text").strip().lower()
    if t in ("integer", "int"):
        return "BIGINT"
    if t == "float":
        return "DOUBLE PRECISION"
    if t == "boolean":
        return "BOOLEAN"
    if t in ("datetime", "date"):
        return "TIMESTAMP"
    return "TEXT"


def _read_file(file_path: str, file_type: str, max_rows: Optional[int] = None) -> Tuple[pd.DataFrame, bool]:
    """파일 읽기. max_rows가 있으면 해당 행 수까지만 읽어 한도 적용.
    반환: (DataFrame, data_verification_needed). CSV 폴백(EOF 제거) 사용 시 True."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
    ft = (file_type or "").strip().lower()
    nrows = int(max_rows) if max_rows and max_rows > 0 else None
    if ft == "csv":
        from Backend.etl_server2 import csv_reader
        df, _encoding_used, need_verify = csv_reader.read_csv_robust(file_path, nrows=nrows)
        return (df, need_verify)
    if ft in ("excel", "xlsx", "xls"):
        # nrows를 넘기면 시트 전체가 아닌 처음 N행만 읽어 미리보기/스키마 추론 시 속도 개선(CSV와 유사)
        df = pd.read_excel(file_path, nrows=nrows)
        return (df, False)
    if ft == "parquet":
        df = pd.read_parquet(file_path)
        if nrows and len(df) > nrows:
            df = df.head(nrows)
        return (df, False)
    raise ValueError(f"지원하지 않는 파일 유형: {file_type}")


def run_file_load(etl_table_id: int, job_id: Optional[int] = None) -> dict:
    """
    ETL 테이블 1건에 대해 파일 적재 실행.
    - job_id가 있으면(Phase 6 큐) 해당 Job을 사용; 없으면 새 Job 삽입 후 실행.
    - etl_tables에서 file_path, file_type, target_table 조회 → 파싱 → 메인 DB DROP/CREATE/INSERT
    반환: { job_id, status, rows_processed, error_message? }
    """
    etl_row = etl_service.get_etl_table(etl_table_id)
    if not etl_row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    file_path = etl_row.get("file_path")
    file_type = etl_row.get("file_type")
    target_table = etl_row.get("target_table")
    if not file_path or not file_type or not target_table:
        raise ValueError("file_path, file_type, target_table가 필요합니다.")

    file_path = _resolve_upload_path(file_path)

    target_table = etl_service._validate_identifier(target_table, "target_table")
    if job_id is None:
        job_id = etl_service.insert_job(etl_table_id, status="running")
    else:
        etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")
    logger.info("ETL file load started etl_table_id=%s job_id=%s file_path=%s", etl_table_id, job_id, file_path)

    max_file_mb, max_rows_per_load, _ = get_etl_limits()
    if max_file_mb > 0 and os.path.isfile(file_path):
        size_bytes = os.path.getsize(file_path)
        if size_bytes > max_file_mb * 1024 * 1024:
            etl_service.update_job(job_id, "failed", error_message=f"파일 크기가 한도({max_file_mb}MB)를 초과합니다.")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": f"파일 크기가 한도({max_file_mb}MB)를 초과합니다."}

    try:
        df, data_verification_needed = _read_file(file_path, file_type, max_rows=max_rows_per_load if max_rows_per_load else None)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    if df.empty:
        etl_service.update_job(job_id, "completed", rows_processed=0)
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL file load completed job_id=%s rows_processed=0 (empty file)", job_id)
        return {"job_id": job_id, "status": "completed", "rows_processed": 0}

    extra = {}
    if data_verification_needed:
        extra["warning_message"] = "데이터 확인이 필요합니다."

    total_rows = len(df)
    etl_service.set_job_total_rows(job_id, total_rows)

    # 컬럼명 정규화 후 변환 룰 적용(Phase 4). 원본명→정규화명 매핑 보관(column_mapping 시 INSERT에서 값 조회용).
    used: set = set()
    normalized_names: List[str] = []
    orig_columns = list(df.columns)
    for col in orig_columns:
        name = normalize_column_name_for_sequence(str(col), used)
        etl_service._validate_identifier(name, "컬럼명")
        normalized_names.append(name)
    source_to_normalized = dict(zip(orig_columns, normalized_names))
    df.columns = normalized_names
    try:
        rules = transform_rules_svc.list_transform_rules(etl_table_id)
        df = transform_engine.apply_rules(df, rules)
    except Exception:
        pass

    # Phase 4: column_mapping 있으면 타겟 컬럼/타입·INSERT 순서를 매핑 기준으로 사용 + 매핑 기반 형변환
    column_mapping = etl_row.get("column_mapping")
    mapping_used: List[dict] = []
    if isinstance(column_mapping, list) and len(column_mapping) > 0:
        for m in column_mapping:
            target_name = (m.get("target") or "").strip()
            src = (m.get("source") or "").strip()
            if not target_name or not src:
                continue
            etl_service._validate_identifier(target_name, "컬럼명")
            mapping_used.append({
                "source": src,
                "target": target_name,
                "type": (m.get("type") or "TEXT").strip().upper() or "TEXT",
                "on_error": (m.get("on_error") or "null").strip().lower() or "null",
            })
        if mapping_used:
            try:
                df = transform_engine.apply_mapping_type_cast(df, mapping_used, default_on_error="null")
            except ValueError as cast_err:
                etl_service.update_job(job_id, "failed", error_message=str(cast_err))
                etl_service.update_etl_table_status(etl_table_id, "error")
                return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(cast_err)}
            columns = [(m.get("target", "").strip(), (m.get("type") or "TEXT").strip().upper() or "TEXT") for m in mapping_used]
        else:
            mapping_used = []
    if not mapping_used:
        # 기존: 스키마 추론과 동일한 타입 매핑
        columns = []
        for col in df.columns:
            etl_service._validate_identifier(str(col), "컬럼명")
            dtype = schema_infer._dtype_to_inferred(df[col].dtype)
            columns.append((str(col), _pg_type(dtype)))

    conn_main, main_schema = etl_service.get_target_db_connection(etl_row.get("storage_connection_id"))
    cur = conn_main.cursor()
    cols = [c[0] for c in columns]
    pk_part = ""
    pk_columns_raw = (etl_row.get("pk_columns") or "").strip()
    if pk_columns_raw:
        pk_list = [x.strip() for x in pk_columns_raw.split(",") if x.strip()]
        for pk in pk_list:
            etl_service._validate_identifier(pk, "pk_columns")
        missing = [p for p in pk_list if p not in cols]
        if missing:
            etl_service.update_job(job_id, "failed", error_message=f"pk_columns에 파일에 없는 컬럼이 있습니다: {', '.join(missing)}")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": f"pk_columns에 파일에 없는 컬럼이 있습니다: {', '.join(missing)}"}
        if pk_list:
            pk_part = ", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in pk_list) + ")"

    try:
        quoted_schema = f'"{main_schema}"'
        quoted_table = f'"{target_table}"'
        full_name = f"{quoted_schema}.{quoted_table}"

        cur.execute(f'DROP TABLE IF EXISTS {full_name}')
        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns) + pk_part
        cur.execute(f"CREATE TABLE {full_name} ({col_defs})")
        conn_main.commit()

        # INSERT: column_mapping 있으면 소스→타겟 매핑으로 값 추출. rec는 정규화된 컬럼명 키이므로 source→정규화명으로 조회.
        if mapping_used:
            df_records = df.replace({pd.NA: None}).to_dict("records")
            rows = []
            for rec in df_records:
                row_vals = [
                    rec.get(source_to_normalized.get(m.get("source"), m.get("source")))
                    for m in mapping_used
                ]
                rows.append(dict(zip(cols, row_vals)))
        else:
            cols = [c[0] for c in columns]
            df_renamed = df.copy()
            df_renamed.columns = cols
            rows = df_renamed.replace({pd.NA: None}).to_dict("records")

        insert_batch_size = 2000
        one_row_ph = "(" + ", ".join(["%s"] * len(cols)) + ")"
        cols_quoted = ", ".join(chr(34) + c + chr(34) for c in cols)
        rows_processed = 0
        i = 0
        while i < len(rows):
            if rows_processed > 0 and etl_service.is_job_cancelled(job_id):
                conn_main.rollback()
                try:
                    cur.execute(f"DROP TABLE IF EXISTS {full_name}")
                    conn_main.commit()
                except Exception:
                    conn_main.rollback()
                etl_service.update_job(job_id, "cancelled", rows_processed=rows_processed, error_message="사용자 취소")
                etl_service.update_etl_table_status(etl_table_id, "error")
                logger.info("ETL file load cancelled job_id=%s rows_processed=%s", job_id, rows_processed)
                return {"job_id": job_id, "status": "cancelled", "rows_processed": rows_processed, "error_message": "사용자 취소"}
            batch = rows[i : i + insert_batch_size]
            batch_ph = ", ".join([one_row_ph] * len(batch))
            insert_sql = f'INSERT INTO {full_name} ({cols_quoted}) VALUES {batch_ph}'
            flat_args = [r.get(c) for r in batch for c in cols]
            cur.execute(insert_sql, flat_args)
            rows_processed += len(batch)
            i += insert_batch_size
        conn_main.commit()

        idx_def = etl_row.get("index_definitions")
        if idx_def:
            from Backend.etl_server2 import db_load_service as db_load
            db_load._create_indexes_on_target(cur, conn_main, main_schema, target_table, idx_def)

        if not etl_row.get("storage_connection_id"):
            from Env.config.loader import add_allowed_table
            add_allowed_table(target_table)

        etl_service.update_job(
            job_id, "completed",
            rows_processed=rows_processed,
            notice="데이터 확인이 필요합니다." if data_verification_needed else None,
        )
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL file load completed job_id=%s rows_processed=%s", job_id, rows_processed)
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed, **extra}

    except Exception as e:
        logger.exception("ETL file load failed job_id=%s: %s", job_id, e)
        conn_main.rollback()
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
    finally:
        cur.close()
        conn_main.close()


def run_file_upsert(etl_table_id: int, job_id: int) -> dict:
    """
    추가 적재: Job에 저장된 add_file_path 파일을 읽어, 기존 타겟 테이블에 PK 기준 업서트.
    - etl_tables.pk_columns 또는 메인 DB 테이블 PK 사용. PK 없으면 실패.
    - 타겟 테이블은 이미 존재해야 함. 파일 컬럼이 PK를 포함하고 테이블 컬럼과 호환되어야 함.
    반환: { job_id, status, rows_processed, error_message? }
    """
    job_row = etl_service.get_job(job_id)
    if not job_row:
        raise ValueError(f"Job을 찾을 수 없습니다: job_id={job_id}")
    add_file_path = (job_row.get("add_file_path") or "").strip()
    add_file_type = (job_row.get("add_file_type") or "").strip()
    if not add_file_path or not add_file_type:
        etl_service.update_job(job_id, "failed", error_message="추가 적재용 파일 경로/유형이 없습니다.")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "add_file_path/add_file_type 없음"}

    etl_row = etl_service.get_etl_table(etl_table_id)
    if not etl_row:
        etl_service.update_job(job_id, "failed", error_message="ETL 테이블을 찾을 수 없습니다.")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "ETL 테이블 없음"}
    target_table = (etl_row.get("target_table") or "").strip()
    if not target_table:
        etl_service.update_job(job_id, "failed", error_message="target_table가 없습니다.")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "target_table 없음"}
    target_table = etl_service._validate_identifier(target_table, "target_table")

    sid = etl_row.get("storage_connection_id")
    pk_columns_raw = (etl_row.get("pk_columns") or "").strip()
    if pk_columns_raw:
        pk_list = [x.strip() for x in pk_columns_raw.split(",") if x.strip()]
    else:
        if sid is not None:
            pk_list = etl_service.get_target_pk_columns(sid, target_table)
        else:
            try:
                from Backend.api_server import db as api_db
                pk_list = api_db.get_primary_key_columns_for_etl_target(target_table)
            except Exception:
                pk_list = []
    if not pk_list:
        etl_service.update_job(job_id, "failed", error_message="타겟 테이블에 PK가 없거나 ETL에 pk_columns를 설정하세요.")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "PK 필요"}
    for pk in pk_list:
        etl_service._validate_identifier(pk, "pk_columns")

    try:
        if sid is not None:
            table_columns = etl_service.get_target_table_column_names(sid, target_table)
        else:
            from Backend.api_server import db as api_db
            table_columns = api_db.get_table_columns_for_etl_target(target_table)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=f"타겟 테이블 컬럼 조회 실패: {e}")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    add_file_path = _resolve_upload_path(add_file_path)
    if not os.path.isfile(add_file_path):
        etl_service.update_job(job_id, "failed", error_message="추가 적재 파일을 찾을 수 없습니다.")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "파일 없음"}

    etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")
    logger.info("ETL file upsert started etl_table_id=%s job_id=%s add_file=%s", etl_table_id, job_id, add_file_path)

    max_file_mb, max_rows_per_load, _ = get_etl_limits()
    if max_file_mb > 0:
        size_bytes = os.path.getsize(add_file_path)
        if size_bytes > max_file_mb * 1024 * 1024:
            etl_service.update_job(job_id, "failed", error_message=f"파일 크기가 한도({max_file_mb}MB)를 초과합니다.")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "파일 크기 한도 초과"}

    try:
        df, _ = _read_file(add_file_path, add_file_type, max_rows=max_rows_per_load if max_rows_per_load else None)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    if df.empty:
        etl_service.update_job(job_id, "completed", rows_processed=0)
        etl_service.update_etl_table_status(etl_table_id, "done")
        return {"job_id": job_id, "status": "completed", "rows_processed": 0}

    used: set = set()
    normalized_names: List[str] = []
    for col in df.columns:
        name = normalize_column_name_for_sequence(str(col), used)
        etl_service._validate_identifier(name, "컬럼명")
        normalized_names.append(name)
    df.columns = normalized_names

    try:
        rules = transform_rules_svc.list_transform_rules(etl_table_id)
        df = transform_engine.apply_rules(df, rules)
    except Exception:
        pass

    file_cols = set(df.columns)
    for pk in pk_list:
        if pk not in file_cols:
            etl_service.update_job(job_id, "failed", error_message=f"파일에 PK 컬럼이 없습니다: {pk}")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": f"PK 컬럼 없음: {pk}"}
    cols = [c for c in table_columns if c in df.columns]
    if not cols:
        etl_service.update_job(job_id, "failed", error_message="파일과 테이블에 공통 컬럼이 없습니다.")
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "공통 컬럼 없음"}

    etl_service.set_job_total_rows(job_id, len(df))
    conn_main, main_schema = etl_service.get_target_db_connection(etl_row.get("storage_connection_id"))
    cur = conn_main.cursor()
    quoted_schema = f'"{main_schema}"'
    quoted_table = f'"{target_table}"'
    full_name = f"{quoted_schema}.{quoted_table}"

    try:
        set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk_list]
        if not set_parts:
            set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols]
        one_row_ph = "(" + ", ".join(["%s"] * len(cols)) + ")"
        cols_quoted = ", ".join(chr(34) + c + chr(34) for c in cols)
        pk_quoted = ", ".join(chr(34) + p + chr(34) for p in pk_list)
        upsert_sql = (
            f'INSERT INTO {full_name} ({cols_quoted}) VALUES {{batch_ph}} '
            f"ON CONFLICT ({pk_quoted}) DO UPDATE SET {', '.join(set_parts)}"
        )
        insert_batch_size = 2000
        rows_data = df[cols].replace({pd.NA: None}).to_dict("records")
        rows_processed = 0
        i = 0
        while i < len(rows_data):
            if rows_processed > 0 and etl_service.is_job_cancelled(job_id):
                conn_main.rollback()
                etl_service.update_job(job_id, "cancelled", rows_processed=rows_processed, error_message="사용자 취소")
                etl_service.update_etl_table_status(etl_table_id, "error")
                return {"job_id": job_id, "status": "cancelled", "rows_processed": rows_processed, "error_message": "사용자 취소"}
            batch = rows_data[i : i + insert_batch_size]
            batch_ph = ", ".join([one_row_ph] * len(batch))
            sql = upsert_sql.replace("{batch_ph}", batch_ph)
            flat_args = [r.get(c) for r in batch for c in cols]
            cur.execute(sql, flat_args)
            rows_processed += len(batch)
            i += insert_batch_size
        conn_main.commit()
        etl_service.update_job(job_id, "completed", rows_processed=rows_processed)
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL file upsert completed job_id=%s rows_processed=%s", job_id, rows_processed)
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed}
    except Exception as e:
        logger.exception("ETL file upsert failed job_id=%s: %s", job_id, e)
        conn_main.rollback()
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
    finally:
        cur.close()
        conn_main.close()
