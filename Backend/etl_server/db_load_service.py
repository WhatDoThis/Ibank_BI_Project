"""
Backend.etl_server.db_load_service (DB 연동 추출·적재)
======================================================
외부 DB(PostgreSQL·MySQL) 추출(E) → 메인 DB 적재(L). Full Load / Incremental Upsert. 소스 PK는 full 모드 시 타겟 CREATE에 반영.

[Helpers]
===========
41 - _get_source_connection: connection_id로 소스 PostgreSQL 연결
55 - _fetch_source_columns_mysql: MySQL information_schema.COLUMNS (column_name, data_type)
72 - _pg_type_from_mysql: MySQL DATA_TYPE → PostgreSQL 타입 문자열
88 - _fetch_source_columns: PostgreSQL information_schema.columns
109 - _fetch_source_pk_columns: PostgreSQL 소스 테이블 PRIMARY KEY 컬럼명 목록
132 - _pg_type_from_info_schema: information_schema data_type → PostgreSQL 타입
150 - _pg_type_from_pandas: pandas dtype → PostgreSQL 타입

[Main]
===========
run_db_load: etl_table_id 기준 소스 SELECT → 변환 룰 적용 → 메인 DB CREATE+INSERT 또는 Upsert. postgresql·mysql 분기. full 시 소스 PK 반영, incremental 시 pk_columns·ON CONFLICT 사용.

[Dependencies]
=========
- Backend.api_server.db, Backend.etl_server.service, transform_engine, transform_rules_service, etl_limits
- Env.config.loader.add_allowed_table
- psycopg2, pandas
"""

import logging
import re
import time
from datetime import datetime
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

from Backend.etl_server import service as etl_service
from Backend.etl_server import transform_engine
from Backend.etl_server import transform_rules_service as transform_rules_svc
from Backend.etl_server.etl_limits import get_etl_limits


def _get_source_connection(connection_id: int):
    """소스 DB 연결. service에서 가져와 psycopg2 connection 반환. PostgreSQL 전용."""
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


def _fetch_source_columns_mysql(conn, table_schema: str, table_name: str) -> List[Tuple[str, str]]:
    """MySQL information_schema.COLUMNS에서 (column_name, data_type) 목록. conn은 PyMySQL."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COLUMN_NAME, DATA_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        ORDER BY ORDINAL_POSITION
        """,
        (table_schema, table_name),
    )
    rows = cur.fetchall()
    cur.close()
    return [(r[0], r[1]) for r in rows]


def _pg_type_from_mysql(data_type: str) -> str:
    """MySQL DATA_TYPE → PostgreSQL 타입 문자열(메인 DB CREATE용)."""
    t = (data_type or "").lower()
    if t in ("int", "integer", "smallint", "bigint", "mediumint", "tinyint"):
        return "BIGINT"
    if t in ("decimal", "numeric", "float", "double", "real"):
        return "DOUBLE PRECISION"
    if t in ("date", "datetime", "timestamp", "time", "year"):
        return "TIMESTAMP"
    if t in ("tinyint",) and "bool" in t:
        return "BOOLEAN"
    return "TEXT"


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


def _fetch_source_pk_columns(conn, schema: str, table: str) -> List[str]:
    """소스 DB의 information_schema에서 해당 테이블 PRIMARY KEY 컬럼명 목록. 없으면 []."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = %s AND tc.table_name = %s
            ORDER BY kcu.ordinal_position
            """,
            (schema, table),
        )
        return [r["column_name"] for r in cur.fetchall()]
    finally:
        cur.close()


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
    sync_mode = (row.get("sync_mode") or "incremental").strip().lower()
    if sync_mode not in ("full", "incremental"):
        sync_mode = "incremental"
    batch_size = (row.get("batch_size") or 0) if row.get("batch_size") is not None else 0
    try:
        batch_size = int(batch_size) if batch_size else 0
    except (TypeError, ValueError):
        batch_size = 0
    batch_interval_seconds = row.get("batch_interval_seconds")
    if batch_interval_seconds is None:
        batch_interval_seconds = 0
    try:
        batch_interval_seconds = max(0, int(batch_interval_seconds))
    except (TypeError, ValueError):
        batch_interval_seconds = 0

    if not connection_id or not source_table or not target_table:
        raise ValueError("connection_id, source_table, target_table가 필요합니다.")

    max_file_mb, max_rows_per_load, max_batch_size = get_etl_limits()
    effective_batch_size = batch_size
    if max_batch_size > 0:
        effective_batch_size = min(batch_size, max_batch_size) if batch_size > 0 else max_batch_size
    limit_sql = f" LIMIT {max_rows_per_load}" if (effective_batch_size == 0 and max_rows_per_load > 0) else ""

    target_table = etl_service._validate_identifier(target_table, "target_table")
    source_table = etl_service._validate_identifier(source_table, "source_table")
    if job_id is None:
        job_id = etl_service.insert_job(etl_table_id, status="running")
    else:
        etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")
    logger.info("ETL db load started etl_table_id=%s job_id=%s sync_mode=%s", etl_table_id, job_id, sync_mode)

    try:
        c = etl_service.get_connection_for_etl(connection_id)
        stype = (c.get("source_type") or "postgresql").strip().lower()
        if stype not in ("postgresql", "mysql"):
            raise ValueError(f"DB 적재는 postgresql, mysql만 지원합니다. source_type={stype}")

        src_schema, source_table_name = etl_service.parse_source_table_parts(
            source_table,
            stype,
            conn_schema=(c.get("schema_name") or "public").strip(),
            conn_db=(c.get("database_name") or "").strip(),
        )
        if not source_table_name:
            raise ValueError("source_table이 비어 있습니다.")

        if stype == "mysql":
            src_conn = etl_service._connect_mysql(
                c["host"],
                c.get("port") or 3306,
                c["database_name"],
                c["username"],
                c.get("encrypted_password") or "",
            )
            columns = _fetch_source_columns_mysql(src_conn, src_schema, source_table_name)
            source_pk_list = etl_service._fetch_pk_from_mysql(src_conn, src_schema, source_table_name)
            quoted_src = f"`{src_schema}`.`{source_table_name}`"
            type_mapper = _pg_type_from_mysql
            row_type = "tuple"
            _quote = lambda x: f"`{x}`"
        else:
            src_conn = _get_source_connection(connection_id)
            columns = _fetch_source_columns(src_conn, src_schema, source_table_name)
            source_pk_list = _fetch_source_pk_columns(src_conn, src_schema, source_table_name)
            quoted_src = f'"{src_schema}"."{source_table_name}"'
            type_mapper = _pg_type_from_info_schema
            row_type = "dict"
            _quote = lambda x: f'"{x}"'

        if not columns:
            try:
                src_conn.close()
            except Exception:
                pass
            etl_service.update_job(job_id, "failed", error_message="소스 테이블에 컬럼이 없습니다.")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "소스 테이블에 컬럼이 없습니다."}

        col_names = [c[0] for c in columns]
        select_list = ", ".join(_quote(c) for c in col_names)
        where_clause = ""
        params = []
        if sync_mode == "incremental" and incremental_column:
            etl_service._validate_identifier(incremental_column, "incremental_column")
            last_synced = row.get("last_synced_at")
            if last_synced is not None:
                where_clause = f" WHERE {_quote(incremental_column)} > %s"
                params.append(last_synced)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    try:

        if effective_batch_size > 0:
            # 배치 단위 스트리밍: 메모리에 전체를 쌓지 않고 fetch -> 변환 -> 적재 반복. config 한도 적용.
            # ETA용 total_rows: 소스 테이블 행 수(동일 WHERE). max_rows_per_load 있으면 상한 적용.
            cur_count = src_conn.cursor()
            cur_count.execute(f'SELECT COUNT(*) FROM {quoted_src}{where_clause}', params)
            row_count = cur_count.fetchone()
            total_from_src = list(row_count.values())[0] if hasattr(row_count, "values") else row_count[0]
            cur_count.close()
            total_rows_cap = min(total_from_src, max_rows_per_load) if max_rows_per_load > 0 else total_from_src
            etl_service.set_job_total_rows(job_id, total_rows_cap)
            cur_src = src_conn.cursor(name="etl_src_%s" % job_id) if row_type == "dict" else src_conn.cursor()
            cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}', params)
            total_processed, first_batch = 0, True
            main_schema = api_db.get_table_schema()
            conn_main = api_db.get_db_connection()
            cur_main = conn_main.cursor()
            full_name = f'"{main_schema}"."{target_table}"'
            try:
                while True:
                    batch = cur_src.fetchmany(effective_batch_size)
                    if not batch:
                        break
                    if row_type == "tuple":
                        batch = [dict(zip(col_names, r)) for r in batch]
                    if max_rows_per_load > 0 and total_processed + len(batch) > max_rows_per_load:
                        batch = batch[: max_rows_per_load - total_processed]
                    df_batch = pd.DataFrame(batch, columns=col_names)
                    try:
                        rules = transform_rules_svc.list_transform_rules(etl_table_id)
                        df_batch = transform_engine.apply_rules(df_batch, rules)
                    except Exception:
                        pass
                    source_col_map = {c[0]: c[1] for c in columns}
                    columns_final: List[Tuple[str, str]] = []
                    for col in df_batch.columns:
                        pg_t = source_col_map.get(col)
                        if pg_t is not None:
                            columns_final.append((col, type_mapper(pg_t)))
                        else:
                            columns_final.append((col, _pg_type_from_pandas(df_batch[col].dtype)))
                    cols = [c[0] for c in columns_final]
                    col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns_final)
                    rows_batch = df_batch.replace({pd.NA: None}).to_dict("records")
                    if first_batch:
                        if sync_mode == "full":
                            cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                            pk_list_full = [p for p in source_pk_list if p in cols]
                            pk_part = (", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in pk_list_full) + ")") if pk_list_full else ""
                            cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{pk_part})")
                            conn_main.commit()
                        else:
                            if not pk_columns:
                                etl_service.update_job(job_id, "failed", error_message="incremental 모드는 pk_columns가 필요합니다.")
                                etl_service.update_etl_table_status(etl_table_id, "error")
                                return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "pk_columns 필요"}
                            pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                            for pk in pk_list:
                                etl_service._validate_identifier(pk, "pk_columns")
                            try:
                                cur_main.execute(f"SELECT 1 FROM {full_name} LIMIT 1")
                                cur_main.fetchone()
                            except Exception:
                                conn_main.rollback()
                                uniq_part = f", UNIQUE ({', '.join(chr(34) + p + chr(34) for p in pk_list)})" if pk_list else ""
                                cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{uniq_part})")
                                conn_main.commit()
                        first_batch = False
                    placeholders = ", ".join(["%s"] * len(cols))
                    cancel_check_interval = 100
                    for i, r in enumerate(rows_batch):
                        if i > 0 and i % cancel_check_interval == 0 and etl_service.is_job_cancelled(job_id):
                            conn_main.rollback()
                            cur_main.close()
                            conn_main.close()
                            cur_src.close()
                            src_conn.close()
                            etl_service.update_job(job_id, "cancelled", rows_processed=total_processed, error_message="사용자 취소")
                            etl_service.update_etl_table_status(etl_table_id, "error")
                            return {"job_id": job_id, "status": "cancelled", "rows_processed": total_processed, "error_message": "사용자 취소"}
                        if sync_mode == "full":
                            insert_sql = f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({placeholders})'
                            cur_main.execute(insert_sql, [r.get(c) for c in cols])
                        else:
                            pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                            set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk_list]
                            if not set_parts:
                                set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols]
                            upsert_sql = (
                                f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) '
                                f"VALUES ({placeholders}) ON CONFLICT ({', '.join(chr(34) + p + chr(34) for p in pk_list)}) "
                                f"DO UPDATE SET {', '.join(set_parts)}"
                            )
                            cur_main.execute(upsert_sql, [r.get(c) for c in cols])
                        total_processed += 1
                    conn_main.commit()
                    if incremental_column and incremental_column in cols and rows_batch:
                        max_vals = [r.get(incremental_column) for r in rows_batch if r.get(incremental_column) is not None]
                        if max_vals:
                            from datetime import datetime as dt
                            latest = max(max_vals) if isinstance(max_vals[0], dt) else max(max_vals)
                            etl_service.update_last_synced_at(etl_table_id, latest)
                    if max_rows_per_load > 0 and total_processed >= max_rows_per_load:
                        break
                    if batch_interval_seconds > 0:
                        time.sleep(batch_interval_seconds)
            finally:
                cur_main.close()
                conn_main.close()
            cur_src.close()
            src_conn.close()
            from Env.config.loader import add_allowed_table
            add_allowed_table(target_table)
            etl_service.update_job(job_id, "completed", rows_processed=total_processed)
            etl_service.update_etl_table_status(etl_table_id, "done")
            logger.info("ETL db load completed job_id=%s rows_processed=%s (streaming)", job_id, total_processed)
            return {"job_id": job_id, "status": "completed", "rows_processed": total_processed}
        else:
            cur_src = src_conn.cursor()
            cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}{limit_sql}', params)
            rows_data = cur_src.fetchall()
            cur_src.close()
            src_conn.close()
            if row_type == "tuple":
                rows_data = [dict(zip(col_names, r)) for r in rows_data]
            etl_service.set_job_total_rows(job_id, len(rows_data))

        rows_processed = len(rows_data)
        if rows_processed == 0:
            etl_service.update_job(job_id, "completed", rows_processed=0)
            etl_service.update_etl_table_status(etl_table_id, "done")
            logger.info("ETL db load completed job_id=%s rows_processed=0 (no rows)", job_id)
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
                columns_final.append((col, type_mapper(pg_t)))
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
                pk_list_full = [p for p in source_pk_list if p in cols]
                pk_part = (", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in pk_list_full) + ")") if pk_list_full else ""
                cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{pk_part})")
                conn_main.commit()
                placeholders = ", ".join(["%s"] * len(cols))
                insert_sql = f'INSERT INTO {full_name} ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({placeholders})'
                cancel_check_interval = 100
                rows_processed = 0
                for i, r in enumerate(rows_data):
                    if i > 0 and i % cancel_check_interval == 0 and etl_service.is_job_cancelled(job_id):
                        conn_main.rollback()
                        try:
                            cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                            conn_main.commit()
                        except Exception:
                            conn_main.rollback()
                        etl_service.update_job(job_id, "cancelled", rows_processed=rows_processed, error_message="사용자 취소")
                        etl_service.update_etl_table_status(etl_table_id, "error")
                        logger.info("ETL db load cancelled job_id=%s rows_processed=%s", job_id, rows_processed)
                        return {"job_id": job_id, "status": "cancelled", "rows_processed": rows_processed, "error_message": "사용자 취소"}
                    cur_main.execute(insert_sql, [r.get(c) for c in cols])
                    rows_processed += 1
                conn_main.commit()
            else:
                # incremental: Upsert. PK 필요.
                if not pk_columns:
                    etl_service.update_job(job_id, "failed", error_message="incremental 모드는 pk_columns가 필요합니다.")
                    etl_service.update_etl_table_status(etl_table_id, "error")
                    return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "pk_columns 필요"}
                pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                for pk in pk_list:
                    etl_service._validate_identifier(pk, "pk_columns")
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
                cancel_check_interval = 100
                rows_processed = 0
                for i, r in enumerate(rows_data):
                    if i > 0 and i % cancel_check_interval == 0 and etl_service.is_job_cancelled(job_id):
                        conn_main.rollback()
                        etl_service.update_job(job_id, "cancelled", rows_processed=rows_processed, error_message="사용자 취소")
                        etl_service.update_etl_table_status(etl_table_id, "error")
                        logger.info("ETL db load cancelled job_id=%s rows_processed=%s", job_id, rows_processed)
                        return {"job_id": job_id, "status": "cancelled", "rows_processed": rows_processed, "error_message": "사용자 취소"}
                    cur_main.execute(upsert_sql, [r.get(c) for c in cols])
                    rows_processed += 1
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
        logger.info("ETL db load completed job_id=%s rows_processed=%s", job_id, rows_processed)
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed}

    except Exception as e:
        logger.exception("ETL db load failed job_id=%s: %s", job_id, e)
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
