"""
Backend.etl_server.load_service_file (배치 파일 적재 서비스)
==========================================================
09_ETL_SFTP_Connection §4.3, §7.5. 저장 DB 연결·테이블 존재 확인·CREATE·INSERT/upsert.
table_exists, _normalize_column_name, normalize_column_name_for_sequence(공유), create_table_from_dataframe, load_dataframe.
배치 실행기(batch_executor_file)에서 다운로드·파싱 후 호출. 저장 DB 연결은 service.get_target_db_connection 사용.

[Main Functions]
===========
1. table_exists: information_schema.tables로 테이블 존재 여부
2. normalize_column_name_for_sequence: 컬럼명 정규화·used 집합 내 유일화(router·load_service와 공유)
3. create_table_from_dataframe: df 스키마 기반 CREATE TABLE, dtype→PG 타입, PK 옵션
4. load_dataframe: 테이블 없으면 CREATE 후 PK 있으면 _batch_upsert/없으면 _batch_insert, 테이블 있으면 동일. 파라미터 한도 기반 배치(_calc_batch_size).
- _to_psycopg2_param·`_calc_batch_size` 등은 4번 내부 헬퍼.
  신규 CREATE 직후·내장 저장 DB(main·dash, `should_upsert_table_master_for_storage`)일 때만 `table_master` UPSERT.
  PK upsert 시 INSERT ON CONFLICT DO NOTHING 후 UPDATE FROM VALUES(실제 변경 행만 IS DISTINCT FROM) 2단계. 반환 inserted/updated.
  PK·출처 정보 있으면 batch_loaded_keys 기록(파일 단위 롤백용). index_definitions 있으면 적재 후 _create_indexes_on_target.
  타입 경계: transform_engine/apply_mapping_type_cast 출력 → itertuples → psycopg2 → VALUES(text 추론). SET/WHERE는 information_schema 기준 명시 캐스트. column_mapping 사용 시 형변환 실패는 ValueError로 전파(삼키지 않음). 검증: transform_upsert_verification.

[Dependencies]
=========
- Backend.etl_server.service (get_target_db_connection)
- Backend.etl_server.transform_engine (apply_mapping_type_cast, optional)
- Backend.core.db (get_system_table_schema, get_db_connection_system은 호출부에서 전달)
- pandas, numpy, psycopg2

[Transform→Upsert 검증]
====================
변환 룰·엔진 출력이 upsert 시 타입 문제 없이 처리되는지 검증: Backend.etl_server.transform_upsert_verification.
run_dry_run_pipeline / verify_transform_output_columns로 파이프라인 호환성 확인 가능.
"""

import math
import re
from typing import Any, List, Optional, Tuple

import numpy as np
import pandas as pd


BATCH_SIZE = 2000
# PostgreSQL 파라미터 한도(65,535) 안전 마진. §7 대량 데이터 시 SQL 크기 초과 방지.
MAX_PARAMS = 60000


def _calc_batch_size(num_columns: int) -> int:
    """컬럼 수에 따른 최대 배치 행 수. num_columns * rows <= MAX_PARAMS."""
    if num_columns <= 0:
        return BATCH_SIZE
    return max(1, MAX_PARAMS // num_columns)


def _to_psycopg2_param(v: Any) -> Any:
    """
    DataFrame itertuples() 값에 섞인 numpy·pandas 스칼라를 psycopg2 바인딩 가능한 Python 타입으로 변환.
    numpy.int64/float64 등은 그대로 넘기면 can't adapt type 'numpy.int64' 오류가 난다.
    """
    if v is None:
        return None
    if isinstance(v, pd.Timestamp):
        if pd.isna(v):
            return None
        return v.to_pydatetime()
    if isinstance(v, np.generic):
        out = v.item()
        if isinstance(out, float) and (math.isnan(out) or math.isinf(out)):
            return None
        return out
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


# 1.
def table_exists(conn, schema: str, table_name: str) -> bool:
    """information_schema.tables로 테이블 존재 여부 조회. conn은 호출부가 관리."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = %s AND table_name = %s AND table_type = 'BASE TABLE'
            """,
            (schema.strip(), table_name.strip()),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


def _normalize_column_name(name: str) -> str:
    """컬럼명을 영문·숫자·언더스코어만 허용하도록 정규화."""
    s = re.sub(r"[^a-zA-Z0-9_]", "_", (name or "").strip()) or "col"
    return s.strip("_") or "col"


# 2.
def normalize_column_name_for_sequence(name: str, used: set) -> str:
    """컬럼명 정규화 후 used 집합 기준 유일 이름 반환. used에 추가 후 반환. router/load_service와 공유."""
    base = _normalize_column_name(name)
    out = base
    idx = 0
    while out in used:
        idx += 1
        out = f"{base}_{idx}"
    used.add(out)
    return out


def _dtype_to_pg(dtype) -> str:
    """pandas dtype → PostgreSQL 타입. integer→BIGINT, float→DOUBLE PRECISION, bool→BOOLEAN, datetime64→TIMESTAMP, else TEXT."""
    if pd.api.types.is_integer_dtype(dtype):
        return "BIGINT"
    if pd.api.types.is_float_dtype(dtype):
        return "DOUBLE PRECISION"
    if pd.api.types.is_bool_dtype(dtype):
        return "BOOLEAN"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "TIMESTAMP"
    return "TEXT"


# 3.
def create_table_from_dataframe(
    conn,
    schema: str,
    table_name: str,
    df: pd.DataFrame,
    pk_columns_list: List[str],
) -> None:
    """
    df 컬럼·타입으로 테이블 생성. 컬럼명 정규화, dtype→PG 타입.
    pk_columns_list 비어 있지 않으면 PRIMARY KEY (col1, ...) 추가.
    commit은 호출부에서 수행.
    """
    cur = conn.cursor()
    try:
        cols: List[Tuple[str, str]] = []
        for col in df.columns:
            norm = _normalize_column_name(str(col))
            dtype = _dtype_to_pg(df[col].dtype)
            cols.append((norm, dtype))
        quoted_schema = f'"{schema.strip()}"'
        quoted_table = f'"{table_name.strip()}"'
        full_name = f"{quoted_schema}.{quoted_table}"
        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in cols)
        pk_part = ""
        if pk_columns_list:
            pk_norm = [_normalize_column_name(p) for p in pk_columns_list if p]
            valid_pk = [p for p in pk_norm if any(c[0] == p for c in cols)]
            if valid_pk:
                pk_part = ", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in valid_pk) + ")"
        cur.execute(f"CREATE TABLE {full_name} ({col_defs}{pk_part})")
    finally:
        cur.close()


def _get_table_columns(conn, schema: str, table_name: str) -> List[str]:
    """information_schema.columns에서 테이블 컬럼명 목록(ordinal_position 순)."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema.strip(), table_name.strip()),
        )
        return [r[0] if isinstance(r, (list, tuple)) else r["column_name"] for r in cur.fetchall()]
    finally:
        cur.close()


def _get_table_column_types(conn, schema: str, table_name: str) -> dict:
    """information_schema.columns에서 컬럼별 data_type 조회. VALUES→SET 시 text 추론으로 인한 타입 불일치 방지용 캐스트 맵."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema.strip(), table_name.strip()),
        )
        # data_type → PostgreSQL 캐스트명. VALUES는 text로 추론되므로 SET/WHERE 시 명시적 캐스트 필요.
        _cast_map = {
            "bigint": "bigint",
            "integer": "integer",
            "smallint": "smallint",
            "double precision": "double precision",
            "real": "real",
            "numeric": "numeric",
            "character varying": "text",
            "text": "text",
            "character": "text",
            "timestamp without time zone": "timestamp",
            "timestamp with time zone": "timestamptz",
            "date": "date",
            "boolean": "boolean",
            "uuid": "uuid",
            "jsonb": "jsonb",
            "json": "json",
            "interval": "interval",
            "bytea": "bytea",
            "array": "text[]",
            "inet": "inet",
            "cidr": "cidr",
            "macaddr": "macaddr",
            "money": "money",
            "xml": "xml",
            "point": "point",
            "time without time zone": "time",
            "time with time zone": "timetz",
            "oid": "oid",
        }
        out = {}
        for r in cur.fetchall():
            name = r[0] if isinstance(r, (list, tuple)) else r["column_name"]
            dtype = (r[1] if isinstance(r, (list, tuple)) else r["data_type"] or "").strip().lower()
            out[name] = _cast_map.get(dtype, "text")
        return out
    finally:
        cur.close()


# 4.
def load_dataframe(
    conn,
    schema: str,
    table_name: str,
    df: pd.DataFrame,
    pk_columns_str: Optional[str] = None,
    column_mapping: Optional[List[dict]] = None,
    *,
    batch_job_id: Optional[int] = None,
    run_id: Optional[int] = None,
    source_filename: Optional[str] = None,
    sys_conn: Any = None,
    index_definitions: Optional[List[dict]] = None,
    storage_connection_id: Optional[int] = None,
    table_master_create_user_id: Optional[int] = None,
    table_master_table_label: Optional[str] = None,
    table_master_table_dscrtn: Optional[str] = None,
) -> dict:
    """
    DataFrame을 지정 스키마·테이블에 적재.
    - column_mapping: [{"source", "target", "type"}] 있으면 target 이름·타입 기준으로 선택/변환. apply_mapping_type_cast 실패 시 ValueError.
    - 테이블 없음: create_table_from_dataframe 후 INSERT 전체(배치 2000).
    - 테이블 있음 + pk_columns_str: INSERT ... ON CONFLICT (pk_cols) DO UPDATE SET ...
    - 테이블 있음 + pk 없음: INSERT만.
    - 테이블 있음 시 information_schema로 컬럼 목록 조회 후 df를 해당 컬럼만 남기고 부족분 None.
    반환: { "inserted": N, "updated": M }
    - inserted: 새로 추가된 행 수(테이블 총 행 수 증가분). updated: 기존 행(PK 동일) 갱신 수(행 수 불변).
    - storage_connection_id: None=내장 main, -1=내장 dash, 양수=기타(이 경우 table_master 미반영).
    - table_master_create_user_id: table_master.create_user_id(배치 Job 등록자 등).
    - table_master_table_label, table_master_table_dscrtn: etl_tables와 동일 의미(원장 UPSERT 시 반영).
    """
    schema = (schema or "public").strip() or "public"
    table_name = (table_name or "").strip()
    if not table_name:
        raise ValueError("table_name이 비어 있습니다.")

    # 1) 적용할 DataFrame과 컬럼 목록 결정
    if column_mapping and len(column_mapping) > 0:
        mapping_used = []
        for m in column_mapping:
            src = (m.get("source") or "").strip()
            tgt = (m.get("target") or "").strip()
            typ = (m.get("type") or "TEXT").strip().upper() or "TEXT"
            if not tgt or not src:
                continue
            mapping_used.append({"source": src, "target": _normalize_column_name(tgt), "type": typ})
        if mapping_used:
            # df에서 source 컬럼만 선택해 target 이름으로 변경
            out_cols = [m["target"] for m in mapping_used]
            data = {}
            for m in mapping_used:
                src = m["source"]
                if src in df.columns:
                    data[m["target"]] = df[src].values
                else:
                    data[m["target"]] = [None] * len(df)
            df_work = pd.DataFrame(data, columns=out_cols)
            try:
                from Backend.etl_server import transform_engine
                cast_mapping = [
                    {"source": m["target"], "target": m["target"], "type": m["type"]}
                    for m in mapping_used
                ]
                df_work = transform_engine.apply_mapping_type_cast(df_work, cast_mapping, default_on_error="null")
            except ValueError:
                raise
            except Exception as cast_err:
                raise ValueError(f"컬럼 형변환 실패: {cast_err}") from cast_err
        else:
            df_work = df.copy()
            df_work.columns = [_normalize_column_name(str(c)) for c in df_work.columns]
    else:
        df_work = df.copy()
        df_work.columns = [_normalize_column_name(str(c)) for c in df_work.columns]

    if df_work.empty:
        return {"inserted": 0, "updated": 0}

    pk_list = []
    if pk_columns_str and (pk_columns_str or "").strip():
        pk_list = [_normalize_column_name(p.strip()) for p in pk_columns_str.split(",") if p.strip()]

    exists = table_exists(conn, schema, table_name)
    quoted_schema = f'"{schema}"'
    quoted_table = f'"{table_name}"'
    full_name = f"{quoted_schema}.{quoted_table}"

    if not exists:
        create_table_from_dataframe(conn, schema, table_name, df_work, pk_list)
        conn.commit()
        if index_definitions:
            norm_index_defs = [
                {
                    **d,
                    "columns": [_normalize_column_name(str(c)) for c in (d.get("columns") or []) if str(c).strip()],
                }
                for d in index_definitions
                if isinstance(d, dict)
            ]
            cur_idx = conn.cursor()
            try:
                from Backend.etl_server.db_load_service import _create_indexes_on_target
                _create_indexes_on_target(cur_idx, conn, schema, table_name, norm_index_defs)
            finally:
                cur_idx.close()
        # PK가 있으면 upsert로 적재(동일 배치/소스 내 PK 중복 시 갱신 처리). 없으면 INSERT만.
        cols = list(df_work.columns)
        if pk_list and all(p in df_work.columns for p in pk_list):
            df_work = df_work.replace({pd.NA: None}).where(pd.notnull(df_work), None)
            inserted, updated = _batch_upsert(conn, full_name, cols, pk_list, df_work)
            out = {"inserted": inserted, "updated": updated}
        else:
            inserted = _batch_insert(conn, full_name, cols, df_work)
            out = {"inserted": inserted, "updated": 0}
        if pk_list and batch_job_id is not None and run_id is not None and source_filename and sys_conn:
            _record_loaded_keys(sys_conn, batch_job_id, run_id, source_filename, df_work, pk_list)
        from Backend.etl_server import service as etl_service_mod

        if etl_service_mod.should_upsert_table_master_for_storage(storage_connection_id):
            from Backend.etl_server.table_master_hook import upsert_table_master_after_load

            upsert_table_master_after_load(
                table_name,
                db_type=etl_service_mod.table_master_db_type_for_storage(storage_connection_id),
                create_user_id=table_master_create_user_id,
                table_label=table_master_table_label,
                table_dscrtn=table_master_table_dscrtn,
            )
        return out

    # 테이블 존재: 타겟 컬럼만 사용, 없는 컬럼은 None
    target_columns = _get_table_columns(conn, schema, table_name)
    if not target_columns:
        return {"inserted": 0, "updated": 0}
    out = {}
    for c in target_columns:
        if c in df_work.columns:
            out[c] = df_work[c].values
        else:
            out[c] = [None] * len(df_work)
    df_work = pd.DataFrame(out, columns=target_columns)

    # NaN/NaT → None
    df_work = df_work.replace({pd.NA: None})
    df_work = df_work.where(pd.notnull(df_work), None)

    if pk_list and all(p in df_work.columns for p in pk_list):
        inserted, updated = _batch_upsert(conn, full_name, target_columns, pk_list, df_work)
        out = {"inserted": inserted, "updated": updated}
        if batch_job_id is not None and run_id is not None and source_filename and sys_conn:
            _record_loaded_keys(sys_conn, batch_job_id, run_id, source_filename, df_work, pk_list)
        return out
    else:
        inserted = _batch_insert(conn, full_name, target_columns, df_work)
        return {"inserted": inserted, "updated": 0}


def _record_loaded_keys(
    sys_conn,
    batch_job_id: int,
    run_id: int,
    filename: str,
    df: pd.DataFrame,
    pk_columns: List[str],
) -> None:
    """
    적재된 행의 PK 값들을 시스템 DB batch_loaded_keys에 벌크 INSERT.
    파일 단위 롤백 시 사용. 실패해도 적재 자체는 막지 않고 경고만 로깅.
    """
    import json
    import logging

    if not pk_columns or df.empty:
        return
    logger = logging.getLogger(__name__)
    from Backend.core import db as api_db

    schema = api_db.get_system_table_schema()
    cur = sys_conn.cursor()
    try:
        rows: List[Tuple[int, int, str, str]] = []
        for i in range(len(df)):
            pk_dict = {}
            for pk_col in pk_columns:
                if pk_col not in df.columns:
                    continue
                val = df[pk_col].iloc[i]
                if hasattr(val, "isoformat"):
                    val = val.isoformat()
                elif val is None or (hasattr(val, "__float__") and str(val) == "nan"):
                    val = None
                else:
                    val = str(val)
                pk_dict[pk_col] = val
            rows.append((batch_job_id, run_id, filename, json.dumps(pk_dict)))

        if not rows:
            return

        for start in range(0, len(rows), 1000):
            batch = rows[start : start + 1000]
            values_ph = ", ".join(
                cur.mogrify("(%s, %s, %s, %s)", r).decode() for r in batch
            )
            cur.execute(
                f'INSERT INTO "{schema}"."batch_loaded_keys" '
                f"(batch_job_id, run_id, filename, pk_values) VALUES {values_ph}"
            )
        sys_conn.commit()
    except Exception as e:
        sys_conn.rollback()
        logger.warning("batch_loaded_keys_insert_fail (load_ok): %s", e)
    finally:
        cur.close()


def _batch_insert(conn, full_name: str, columns: List[str], df: pd.DataFrame) -> int:
    """배치 INSERT. BATCH_SIZE 또는 파라미터 한도 기반 effective_batch씩. 반환: 삽입 행 수."""
    cur = conn.cursor()
    cols_quoted = ", ".join(f'"{c}"' for c in columns)
    ph = "(" + ", ".join(["%s"] * len(columns)) + ")"
    effective_batch = min(BATCH_SIZE, _calc_batch_size(len(columns)))
    total = 0
    for start in range(0, len(df), effective_batch):
        batch = df.iloc[start : start + effective_batch]
        rows = [tuple(row) for row in batch[columns].itertuples(index=False, name=None)]
        if not rows:
            continue
        placeholders = ", ".join([ph] * len(rows))
        flat = [_to_psycopg2_param(v) for r in rows for v in r]
        cur.execute(f'INSERT INTO {full_name} ({cols_quoted}) VALUES {placeholders}', flat)
        total += len(rows)
    cur.close()
    return int(total)


def _batch_upsert(
    conn,
    full_name: str,
    columns: List[str],
    pk_columns: List[str],
    df: pd.DataFrame,
) -> Tuple[int, int]:
    """
    INSERT ... ON CONFLICT (pk) DO UPDATE SET.
    Type flow: DataFrame (pandas dtypes) → itertuples (Python types) → psycopg2 bind params → PostgreSQL VALUES (inferred as text).
    To avoid bigint=text etc., SET/WHERE use explicit casts from information_schema (e.g. v."col"::bigint).
    Transform output dtypes are not used at SQL level; target table column types are the source of truth for casting.
    삽입/갱신 건수를 구분하기 위해 2단계 실행:
    (1) INSERT ON CONFLICT DO NOTHING → inserted = rowcount (실제로 새로 들어간 행 수).
    (2) UPDATE ... FROM (VALUES ...) WHERE pk 일치 AND (non_pk 컬럼 중 하나라도 IS DISTINCT FROM)
        → 값이 실제로 변경된 행만 갱신. WAL/디스크 I/O 절감, updated = 실제 변경 건수.
    반환: (inserted, updated).
    - inserted: 이번 호출에서 새로 추가된 행 수. 테이블 총 행 수 증가분과 일치.
    - updated: 이미 존재하던 행(PK 동일) 중 비PK 값이 바뀐 행 수. 행 수 증가 없음.
    따라서 "테이블 총 행 수 = 기존 + sum(inserted)". 갱신은 행 수에 기여하지 않음.
    non_pk 비면 DO NOTHING만 사용하며, 이 경우 inserted+skipped만 있고 updated=0.
    """
    cur = conn.cursor()
    # full_name = "schema"."table" → schema, table 추출. SET/WHERE 시 VALUES가 text로 추론되므로 타겟 컬럼 타입으로 캐스트.
    _parts = full_name.split(".")
    _schema = _parts[0].strip('"') if len(_parts) >= 2 else "public"
    _table = _parts[1].strip('"') if len(_parts) >= 2 else full_name.strip('"')
    col_types = _get_table_column_types(conn, _schema, _table)

    non_pk = [c for c in columns if c not in pk_columns]
    cols_quoted = ", ".join(f'"{c}"' for c in columns)
    pk_quoted = ", ".join(f'"{p}"' for p in pk_columns)
    ph = "(" + ", ".join(["%s"] * len(columns)) + ")"
    effective_batch = min(BATCH_SIZE, _calc_batch_size(len(columns)))
    total_inserted = 0
    total_updated = 0

    for start in range(0, len(df), effective_batch):
        batch = df.iloc[start : start + effective_batch]
        rows = [tuple(row) for row in batch[columns].itertuples(index=False, name=None)]
        if not rows:
            continue
        placeholders = ", ".join([ph] * len(rows))
        flat = [_to_psycopg2_param(v) for r in rows for v in r]

        if not non_pk:
            sql = (
                f'INSERT INTO {full_name} ({cols_quoted}) VALUES {placeholders}'
                f' ON CONFLICT ({pk_quoted}) DO NOTHING'
            )
            cur.execute(sql, flat)
            total_inserted += cur.rowcount
            continue

        # 1) INSERT ... ON CONFLICT DO NOTHING → 새 행만 삽입, rowcount = 삽입 건수
        sql_ins = (
            f'INSERT INTO {full_name} ({cols_quoted}) VALUES {placeholders}'
            f' ON CONFLICT ({pk_quoted}) DO NOTHING'
        )
        cur.execute(sql_ins, flat)
        inserted_this_batch = cur.rowcount
        total_inserted += inserted_this_batch
        if inserted_this_batch == len(rows):
            continue

        # 2) 충돌한 행만 UPDATE ... FROM (VALUES ...) 로 갱신.
        # WHERE에 (t.col IS DISTINCT FROM v.col OR ...) 추가로 값이 실제로 변경된 행만 UPDATE → WAL/디스크 I/O 절감.
        # VALUES 쪽이 text로 추론되므로 SET·WHERE 시 타겟 컬럼 타입으로 캐스트해 bigint=text 등 오류 방지.
        set_clause = ", ".join(
            f'"{c}" = v."{c}"::{col_types.get(c, "text")}' for c in non_pk
        )
        pk_where = " AND ".join(
            f't."{p}" = (v."{p}")::{col_types.get(p, "text")}' for p in pk_columns
        )
        distinct_where = " OR ".join(
            f't."{c}" IS DISTINCT FROM v."{c}"::{col_types.get(c, "text")}' for c in non_pk
        )
        n_cols = len(columns)
        v_cols = ", ".join(f'"{c}"' for c in columns)
        v_ph = "(" + ", ".join(["%s"] * n_cols) + ")"
        v_placeholders = ", ".join([v_ph] * len(rows))
        sql_upd = (
            f'UPDATE {full_name} AS t SET {set_clause} FROM '
            f'(VALUES {v_placeholders}) AS v({v_cols}) WHERE {pk_where} AND ({distinct_where})'
        )
        cur.execute(sql_upd, flat)
        total_updated += cur.rowcount

    cur.close()
    return int(total_inserted), int(total_updated)
