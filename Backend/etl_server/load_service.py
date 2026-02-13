"""
Backend.etl_server.load_service (파일 기반 E/L)
================================================
업로드된 파일 파싱 → 메인 DB에 테이블 생성·일회성 적재. Phase 2.

[Main Functions]
===========
- run_file_load: etl_table_id 기준으로 파일 읽기 → 메인 DB CREATE TABLE → INSERT → allowed_tables 등록 → job 기록

[Dependencies]
=========
- Backend.api_server.db (get_db_connection, get_table_schema), Backend.etl_server.service, schema_infer
- Env.config.loader.add_allowed_table
- pandas
"""

import logging
import os
import re
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

from Backend.etl_server import schema_infer
from Backend.etl_server import service as etl_service
from Backend.etl_server import transform_engine
from Backend.etl_server import transform_rules_service as transform_rules_svc


def _validate_identifier(value: str, name: str) -> str:
    if not value or not str(value).strip():
        raise ValueError(f"{name}이 비어 있습니다.")
    v = str(value).strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", v):
        raise ValueError(f"{name}에 허용되지 않은 문자가 있습니다: {v}")
    return v


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


def _read_file(file_path: str, file_type: str) -> pd.DataFrame:
    """파일 전체 읽기. 대용량은 청크로 제한할 수 있음."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
    ft = (file_type or "").strip().lower()
    if ft == "csv":
        try:
            return pd.read_csv(file_path, encoding="utf-8")
        except UnicodeDecodeError:
            return pd.read_csv(file_path, encoding="cp949")
    if ft in ("excel", "xlsx", "xls"):
        return pd.read_excel(file_path)
    if ft == "parquet":
        return pd.read_parquet(file_path)
    raise ValueError(f"지원하지 않는 파일 유형: {file_type}")


def run_file_load(etl_table_id: int, job_id: Optional[int] = None) -> dict:
    """
    ETL 테이블 1건에 대해 파일 적재 실행.
    - job_id가 있으면(Phase 6 큐) 해당 Job을 사용; 없으면 새 Job 삽입 후 실행.
    - etl_tables에서 file_path, file_type, target_table 조회 → 파싱 → 메인 DB DROP/CREATE/INSERT
    반환: { job_id, status, rows_processed, error_message? }
    """
    from Backend.api_server import db as api_db

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    file_path = row.get("file_path")
    file_type = row.get("file_type")
    target_table = row.get("target_table")
    if not file_path or not file_type or not target_table:
        raise ValueError("file_path, file_type, target_table가 필요합니다.")

    target_table = _validate_identifier(target_table, "target_table")
    if job_id is None:
        job_id = etl_service.insert_job(etl_table_id, status="running")
    else:
        etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")
    logger.info("ETL file load started etl_table_id=%s job_id=%s file_path=%s", etl_table_id, job_id, file_path)

    try:
        df = _read_file(file_path, file_type)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    if df.empty:
        etl_service.update_job(job_id, "completed", rows_processed=0)
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL file load completed job_id=%s rows_processed=0 (empty file)", job_id)
        return {"job_id": job_id, "status": "completed", "rows_processed": 0}

    # 컬럼명 정규화 후 변환 룰 적용(Phase 4)
    used: set = set()
    normalized_names: List[str] = []
    for col in df.columns:
        base = str(col).strip() or "unnamed"
        base = re.sub(r"[^a-zA-Z0-9_]", "_", base) or "col"
        name = base
        idx = 0
        while name in used:
            idx += 1
            name = f"{base}_{idx}"
        used.add(name)
        _validate_identifier(name, "컬럼명")
        normalized_names.append(name)
    df.columns = normalized_names
    try:
        rules = transform_rules_svc.list_transform_rules(etl_table_id)
        df = transform_engine.apply_rules(df, rules)
    except Exception:
        pass
    # 스키마 추론과 동일한 타입 매핑
    columns: List[Tuple[str, str]] = []
    for col in df.columns:
        _validate_identifier(str(col), "컬럼명")
        dtype = schema_infer._dtype_to_inferred(df[col].dtype)
        columns.append((str(col), _pg_type(dtype)))

    main_schema = api_db.get_table_schema()
    conn_main = api_db.get_db_connection()
    cur = conn_main.cursor()

    try:
        quoted_schema = f'"{main_schema}"'
        quoted_table = f'"{target_table}"'
        full_name = f"{quoted_schema}.{quoted_table}"

        cur.execute(f'DROP TABLE IF EXISTS {full_name}')
        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns)
        cur.execute(f"CREATE TABLE {full_name} ({col_defs})")
        conn_main.commit()

        # INSERT: 컬럼 순서를 검증된 이름으로 맞춤. 취소 요청 시 N건마다 확인
        cols = [c[0] for c in columns]
        df_renamed = df.copy()
        df_renamed.columns = cols
        rows = df_renamed.replace({pd.NA: None}).to_dict("records")
        placeholders = ", ".join(["%s"] * len(cols))
        insert_sql = f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({placeholders})'
        cancel_check_interval = 100
        rows_processed = 0
        for i, r in enumerate(rows):
            if i > 0 and i % cancel_check_interval == 0 and etl_service.is_job_cancelled(job_id):
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
            cur.execute(insert_sql, [r.get(c) for c in cols])
            rows_processed += 1
        conn_main.commit()

        from Env.config.loader import add_allowed_table
        add_allowed_table(target_table)

        etl_service.update_job(job_id, "completed", rows_processed=rows_processed)
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL file load completed job_id=%s rows_processed=%s", job_id, rows_processed)
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed}

    except Exception as e:
        logger.exception("ETL file load failed job_id=%s: %s", job_id, e)
        conn_main.rollback()
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
    finally:
        cur.close()
        conn_main.close()
