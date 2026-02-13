"""
Backend.etl_server.db_load_service (DB 연동 E/L)
================================================
외부 PostgreSQL에서 추출(E) → 우리 메인 DB에 적재(L). Full Load / Incremental Upsert.

[Main Functions]
===========
- run_db_load: etl_table_id 기준으로 소스 DB SELECT → 메인 DB CREATE/TRUNCATE+INSERT 또는 Upsert → job 기록

[Dependencies]
=========
- Backend.api_server.db (get_db_connection, get_table_schema), Backend.etl_server.service
- Env.config.loader.add_allowed_table
- psycopg2, pandas(선택: DataFrame으로 변환 후 INSERT)
"""

import re
from datetime import datetime
from typing import List, Optional, Tuple

import pandas as pd

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


def _get_source_connection(connection_id: int):
    """소스 DB 연결. service에서 가져와 psycopg2 connection 반환."""
    c = etl_service.get_connection_for_etl(connection_id)
    if not c or c.get("source_type") != "postgresql":
        raise ValueError("PostgreSQL 연결이 필요합니다.")
    return etl_service._connect_postgres(
        c["host"],
        c.get("port") or 5432,
        c["database_name"],
        c["username"],
        c.get("encrypted_password") or "",
    )


def _fetch_source_columns(conn, schema: str, table: str) -> List[Tuple[str, str]]:
    """information_schema.columns에서 (column_name, data_type) 목록."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )
    rows = cur.fetchall()
    cur.close()
    return [(r["column_name"], r["data_type"]) for r in rows]


def _pg_type_from_info_schema(data_type: str) -> str:
    """information_schema data_type → PostgreSQL 타입."""
    t = (data_type or "").lower()
    if t in ("integer", "smallint"):
        return "BIGINT"
    if t == "bigint":
        return "BIGINT"
    if t in ("numeric", "decimal", "real", "double precision"):
        return "DOUBLE PRECISION"
    if t == "boolean":
        return "BOOLEAN"
    if t in ("timestamp with time zone", "timestamp without time zone", "timestamptz", "timestamp"):
        return "TIMESTAMP"
    if t == "date":
        return "DATE"
    return "TEXT"


def _pg_type_from_pandas(dtype) -> str:
    """pandas dtype → PostgreSQL 타입 (변환 룰으로 추가된 컬럼용)."""
    s = str(dtype).lower()
    if "int" in s:
        return "BIGINT"
    if "float" in s:
        return "DOUBLE PRECISION"
    if "bool" in s:
        return "BOOLEAN"
    if "datetime" in s or "date" in s:
        return "TIMESTAMP"
    return "TEXT"


def run_db_load(etl_table_id: int, job_id: Optional[int] = None) -> dict:
    """
    ETL 테이블(DB 연동) 1건에 대해 추출·적재 실행.
    - job_id가 있으면(Phase 6 큐) 해당 Job 사용; 없으면 새 Job 삽입 후 실행.
    - sync_mode=full: 소스 전체 SELECT → 메인 DB DROP+CREATE+INSERT.
    - sync_mode=incremental: incremental_column > last_synced_at 조건 SELECT → Upsert.
    반환: { job_id, status, rows_processed, error_message? }
    """
    from Backend.api_server import db as api_db

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    if row.get("source_type") == "file":
        raise ValueError("파일 기반 ETL입니다. POST /tables/{id}/run 은 파일·DB 자동 분기됩니다.")
    connection_id = row.get("connection_id")
    source_table = row.get("source_table")
    target_table = row.get("target_table")
    pk_columns = (row.get("pk_columns") or "").strip() or None
    incremental_column = (row.get("incremental_column") or "").strip() or None
    sync_mode = (row.get("sync_mode") or "full").strip().lower()
    if sync_mode not in ("full", "incremental"):
        sync_mode = "full"

    if not connection_id or not source_table or not target_table:
        raise ValueError("connection_id, source_table, target_table가 필요합니다.")

    target_table = _validate_identifier(target_table, "target_table")
    source_table = _validate_identifier(source_table, "source_table")
    if job_id is None:
        job_id = etl_service.insert_job(etl_table_id, status="running")
    else:
        etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")

    try:
        c = etl_service.get_connection_for_etl(connection_id)
        src_schema = (c.get("schema_name") or "public").strip()
        src_conn = _get_source_connection(connection_id)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    try:
        columns = _fetch_source_columns(src_conn, src_schema, source_table)
        if not columns:
            etl_service.update_job(job_id, "failed", error_message="소스 테이블에 컬럼이 없습니다.")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "소스 테이블에 컬럼이 없습니다."}

        quoted_src = f'"{src_schema}"."{source_table}"'
        col_names = [c[0] for c in columns]
        select_list = ", ".join(f'"{c}"' for c in col_names)
        where_clause = ""
        params = []
        if sync_mode == "incremental" and incremental_column:
            _validate_identifier(incremental_column, "incremental_column")
            last_synced = row.get("last_synced_at")
            if last_synced is not None:
                where_clause = f' WHERE "{incremental_column}" > %s'
                params.append(last_synced)
            # last_synced가 없으면 전체 추출(최초 1회)

        cur_src = src_conn.cursor()
        cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}', params)
        rows_data = cur_src.fetchall()
        cur_src.close()
        src_conn.close()

        rows_processed = len(rows_data)
        if rows_processed == 0:
            etl_service.update_job(job_id, "completed", rows_processed=0)
            etl_service.update_etl_table_status(etl_table_id, "done")
            return {"job_id": job_id, "status": "completed", "rows_processed": 0}

        # Phase 4: 변환 룰 적용
        df = pd.DataFrame(rows_data, columns=col_names)
        try:
            rules = transform_rules_svc.list_transform_rules(etl_table_id)
            df = transform_engine.apply_rules(df, rules)
        except Exception:
            pass
        rows_data = df.replace({pd.NA: None}).to_dict("records")
        source_col_map = {c[0]: c[1] for c in columns}
        columns_final: List[Tuple[str, str]] = []
        for col in df.columns:
            pg_t = source_col_map.get(col)
            if pg_t is not None:
                columns_final.append((col, _pg_type_from_info_schema(pg_t)))
            else:
                columns_final.append((col, _pg_type_from_pandas(df[col].dtype)))
        columns = columns_final
        col_names = [c[0] for c in columns]

        main_schema = api_db.get_table_schema()
        conn_main = api_db.get_db_connection()
        cur_main = conn_main.cursor()
        full_name = f'"{main_schema}"."{target_table}"'
        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns)
        cols = [c[0] for c in columns]

        try:
            if sync_mode == "full":
                cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                cur_main.execute(f"CREATE TABLE {full_name} ({col_defs})")
                conn_main.commit()
                placeholders = ", ".join(["%s"] * len(cols))
                insert_sql = f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({placeholders})'
                for r in rows_data:
                    cur_main.execute(insert_sql, [r.get(c) for c in cols])
                conn_main.commit()
            else:
                # incremental: Upsert. PK 필요.
                if not pk_columns:
                    etl_service.update_job(job_id, "failed", error_message="incremental 모드는 pk_columns가 필요합니다.")
                    etl_service.update_etl_table_status(etl_table_id, "error")
                    return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "pk_columns 필요"}
                pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                for pk in pk_list:
                    _validate_identifier(pk, "pk_columns")
                try:
                    cur_main.execute(f"SELECT 1 FROM {full_name} LIMIT 1")
                    cur_main.fetchone()
                except Exception:
                    uniq_part = f", UNIQUE ({', '.join(chr(34) + p + chr(34) for p in pk_list)})" if pk_list else ""
                    cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{uniq_part})")
                    conn_main.commit()
                set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk_list]
                if not set_parts:
                    set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols]
                placeholders = ", ".join(["%s"] * len(cols))
                upsert_sql = (
                    f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) '
                    f"VALUES ({placeholders}) ON CONFLICT ({', '.join(chr(34) + p + chr(34) for p in pk_list)}) "
                    f"DO UPDATE SET {', '.join(set_parts)}"
                )
                for r in rows_data:
                    cur_main.execute(upsert_sql, [r.get(c) for c in cols])
                conn_main.commit()
                # last_synced_at: 이번에 가져온 행들 중 incremental_column 최대값
                if incremental_column and incremental_column in cols:
                    max_vals = [r.get(incremental_column) for r in rows_data if r.get(incremental_column) is not None]
                    if max_vals:
                        from datetime import datetime as dt
                        if isinstance(max_vals[0], dt):
                            latest = max(max_vals)
                        else:
                            latest = max(max_vals)
                        etl_service.update_last_synced_at(etl_table_id, latest)
        finally:
            cur_main.close()
            conn_main.close()

        from Env.config.loader import add_allowed_table
        add_allowed_table(target_table)

        etl_service.update_job(job_id, "completed", rows_processed=rows_processed)
        etl_service.update_etl_table_status(etl_table_id, "done")
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed}

    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
