"""
Backend.etl_server.batch_executor_db (DB 소스 배치 실행기)
===========================================================
10_DB_Batch_Scheduling_Upgrade. job_type='db'인 배치 Job 주기 실행.
get_batch_job → create_batch_run → 소스 DB 연결 → 증분/전체 SELECT → batch_size 단위 fetch
→ DataFrame → 변환 룰(apply_rules) 적용 → column_mapping 적용 → load_dataframe → batch_interval_seconds 대기 반복
→ last_synced_at 갱신 → finish_run, update_job_status. 정제 #3 MySQL batch_size 상한 10000, #5 check_consecutive_failures finally 밖.

[Main Functions]
===========
- _fetch_source_pk(conn, stype, schema, table_name): 소스 DB에서 PK 컬럼 목록 조회(postgresql/mysql/oracle). pk_columns 미설정 시 자동 감지용.
- run_db_batch_job(batch_job_id): DB 배치 1건 실행. sync_mode=diff면 _run_diff_sync(is_batch=True); full/incremental면 소스 SELECT → chunk 적재 → last_synced_at 갱신. pk_columns 없으면 소스에서 자동 조회 후 upsert.

[Dependencies]
=========
- Backend.etl_server.service_file (get_batch_job, create_batch_run, finish_run, update_run_progress, update_job_status, update_last_synced_at_db_batch, check_consecutive_failures, is_run_cancel_requested)
- Backend.etl_server.scheduler_file (refresh_interval_after_run)
- Backend.etl_server.service (get_connection_for_etl, get_storage_connection, _connect_postgres, _connect_mysql, _connect_oracle, parse_source_table_parts, _validate_source_table, get_target_db_connection)
- Backend.etl_server.timezone_utils (needs_conversion, convert_timezone_columns, convert_single_datetime)
- Backend.etl_server.db_load_service (_get_source_connection, get_source_columns, _run_diff_sync, _pg_type_from_*)
- Backend.etl_server.load_service_file (load_dataframe)
- Backend.etl_server.transform_engine (apply_mapping_type_cast)
- Backend.etl_server.transform_rules_service (list_transform_rules)
"""

import json
import logging
import time
from datetime import datetime
from typing import Any, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# MySQL SSCursor 배치 상한 (net_write_timeout 대응)
MYSQL_BATCH_SIZE_CAP = 10000
ORACLE_BATCH_SIZE_DEFAULT = 10000

# 소스에 헤더가 한 행으로 들어온 경우 제외 여부. DB 소스에는 헤더 행이 없으므로 False(정상 데이터 삭제 방지)
SKIP_HEADER_LIKE_ROWS = False


def _fetch_source_pk(conn, stype: str, schema: str, table_name: str) -> List[str]:
    """
    소스 DB에서 PK 컬럼 목록 조회. 없으면 빈 리스트.
    postgresql / mysql / oracle 지원. 배치 실행 시 pk_columns 미설정이어도 upsert 가능하도록 사용.
    """
    cur = conn.cursor()
    try:
        if stype == "postgresql":
            cur.execute(
                """
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = (
                    SELECT oid FROM pg_class
                    WHERE relname = %s
                      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = %s)
                )
                AND i.indisprimary
                AND a.attnum > 0 AND NOT a.attisdropped
                ORDER BY array_position(i.indkey, a.attnum)
                """,
                (table_name.strip(), (schema or "public").strip()),
            )
            return [r[0] if isinstance(r, (list, tuple)) else r["attname"] for r in cur.fetchall()]

        if stype == "mysql":
            cur.execute(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                  AND CONSTRAINT_NAME = 'PRIMARY'
                ORDER BY ORDINAL_POSITION
                """,
                ((schema or "").strip(), table_name.strip()),
            )
            return [r[0] if isinstance(r, (list, tuple)) else r["COLUMN_NAME"] for r in cur.fetchall()]

        if stype == "oracle":
            cur.execute(
                """
                SELECT cols.column_name
                FROM all_constraints cons
                JOIN all_cons_columns cols
                  ON cons.constraint_name = cols.constraint_name
                  AND cons.owner = cols.owner
                WHERE cons.constraint_type = 'P'
                  AND cons.owner = :1
                  AND cons.table_name = :2
                ORDER BY cols.position
                """,
                ((schema or "").strip().upper(), table_name.strip().upper()),
            )
            return [r[0] for r in cur.fetchall()]

        return []
    except Exception:
        return []
    finally:
        cur.close()


def run_db_batch_job(batch_job_id: int) -> None:
    """
    DB 소스 배치 Job 1건 실행. 스케줄러에서 호출.
    job_type='db', is_active, last_run_status 검사 → create_batch_run → 소스 연결 → SELECT (증분/전체)
    → batch_size 단위 fetch → DataFrame → column_mapping → load_dataframe → batch_interval_seconds sleep
    → last_synced_at 갱신 → finish_run, update_job_status. 예외 시 check_consecutive_failures (finally 밖).
    """
    from Backend.api_server import db as api_db
    from Backend.etl_server import service_file as batch_service
    from Backend.etl_server import service as etl_service
    from Backend.etl_server import timezone_utils
    from Backend.etl_server import transform_engine
    from Backend.etl_server import transform_rules_service as transform_rules_svc
    from Backend.etl_server import db_load_service
    from Backend.etl_server import load_service_file

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("run_db_batch_job: job_id=%s not found", batch_job_id)
        return
    if (job.get("job_type") or "file").strip().lower() != "db":
        logger.debug("run_db_batch_job: job_id=%s job_type is not 'db', skip", batch_job_id)
        return
    if not job.get("is_active"):
        logger.debug("run_db_batch_job: job_id=%s is_active=False, skip", batch_job_id)
        return
    if (job.get("last_run_status") or "").strip().lower() == "running":
        logger.warning("run_db_batch_job: batch %s (job_type=db) already running (last_run_status=running), skip", batch_job_id)
        return

    etl_table_id = job.get("etl_table_id")
    if etl_table_id:
        # ETL 테이블 참조 모드: 소스/타겟/매핑·증분은 etl_tables에서 실시간 조회
        etl_def = etl_service.get_etl_table(etl_table_id)
        if not etl_def:
            logger.error(
                "run_db_batch_job: job_id=%s 연결된 ETL 테이블(id=%s)이 삭제됨. 배치 비활성화 또는 ETL 테이블 재등록 필요.",
                batch_job_id, etl_table_id,
            )
            return
        connection_id = etl_def.get("connection_id")
        source_table = (etl_def.get("source_table") or "").strip()
        target_table = (etl_def.get("target_table") or "").strip()
        storage_connection_id = etl_def.get("storage_connection_id")
        column_mapping = etl_def.get("column_mapping")
        if isinstance(column_mapping, str):
            try:
                column_mapping = json.loads(column_mapping)
            except (TypeError, ValueError):
                column_mapping = None
        incremental_column = (etl_def.get("incremental_column") or "").strip() or None
        sync_mode = (etl_def.get("sync_mode") or "incremental").strip().lower()
        if sync_mode not in ("full", "incremental", "diff"):
            sync_mode = "incremental"
        pk_columns_str = (etl_def.get("pk_columns") or "").strip() or None
        index_definitions = etl_def.get("index_definitions")
    else:
        # 독립 모드(하위 호환): batch_jobs에 저장된 값 사용
        connection_id = job.get("connection_id")
        source_table = (job.get("source_table") or "").strip()
        target_table = (job.get("target_table") or "").strip()
        storage_connection_id = job.get("storage_connection_id")
        column_mapping = job.get("column_mapping")
        if isinstance(column_mapping, str):
            try:
                column_mapping = json.loads(column_mapping)
            except (TypeError, ValueError):
                column_mapping = None
        incremental_column = (job.get("incremental_column") or "").strip() or None
        sync_mode = (job.get("sync_mode") or "incremental").strip().lower()
        if sync_mode not in ("full", "incremental", "diff"):
            sync_mode = "incremental"
        pk_columns_str = (job.get("pk_columns") or "").strip() or None
        index_definitions = job.get("index_definitions")

    # 배치 전용 설정은 항상 batch_jobs에서
    batch_size = job.get("batch_size")
    try:
        batch_size = int(batch_size) if batch_size is not None else 0
    except (TypeError, ValueError):
        batch_size = 0
    batch_interval_seconds = job.get("batch_interval_seconds")
    try:
        batch_interval_seconds = max(0, int(batch_interval_seconds or 0))
    except (TypeError, ValueError):
        batch_interval_seconds = 0
    on_row_error = (job.get("on_row_error") or "fail").strip().lower()
    if on_row_error not in ("fail", "skip"):
        on_row_error = "fail"
    last_synced_at = job.get("last_synced_at")
    if isinstance(last_synced_at, str) and last_synced_at.strip():
        try:
            from datetime import datetime as _dt
            _clean = last_synced_at.strip().split("+")[0].split("Z")[0]
            for _fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
                try:
                    last_synced_at = _dt.strptime(_clean, _fmt)
                    break
                except ValueError:
                    continue
        except Exception:
            pass

    if not connection_id or not source_table or not target_table:
        logger.warning("run_db_batch_job: job_id=%s missing connection_id/source_table/target_table", batch_job_id)
        return

    run_id = None
    src_conn = None
    target_conn = None
    sys_conn = None
    cur_src = None
    stype = None
    run_completed_ok = False  # True after finish_run(success); avoid overwriting to "error" if update_job_status("success") fails

    try:
        # 정제 #5: create_batch_run을 최상단에서 수행해, 소스 연결 실패 등에도 실행 이력·연속 실패 카운트가 남도록 함.
        # 중복 실행 방지: FOR UPDATE로 선점 후 running 갱신. 스케줄러·run_now 동시 진입 시 한 쪽만 진행.
        sys_conn = api_db.get_db_connection_system()
        if not batch_service.try_claim_batch_job_for_run(batch_job_id, sys_conn):
            logger.warning("run_db_batch_job: batch %s already running (claimed by another), skip", batch_job_id)
            return
        run_id = batch_service.create_batch_run(batch_job_id, conn=sys_conn)

        # 타겟 DB 시간대 조회
        if storage_connection_id:
            _sc = etl_service.get_storage_connection(storage_connection_id)
            target_tz = (_sc.get("server_timezone") or "Asia/Seoul").strip() if _sc else "Asia/Seoul"
        else:
            target_tz = "Asia/Seoul"

        target_conn, target_schema = etl_service.get_target_db_connection(storage_connection_id)
        # full 모드: DROP 대신 TRUNCATE로 테이블 구조 보존. 적재 실패 시 다음 주기 재시도 가능.
        if sync_mode == "full" and load_service_file.table_exists(target_conn, target_schema, target_table):
            cur_t = target_conn.cursor()
            try:
                cur_t.execute(f'TRUNCATE TABLE "{target_schema}"."{target_table}"')
                target_conn.commit()
            finally:
                cur_t.close()

        c = etl_service.get_connection_for_etl(connection_id)
        if not c:
            raise ValueError("연결을 찾을 수 없습니다.")
        source_tz = (c.get("server_timezone") or "Asia/Seoul").strip()
        stype = (c.get("source_type") or "postgresql").strip().lower()
        if stype not in ("postgresql", "mysql", "oracle"):
            raise ValueError(f"DB 배치는 postgresql, mysql, oracle만 지원합니다. source_type={stype}")
        _tz_convert_needed = timezone_utils.needs_conversion(source_tz, target_tz)

        # effective_batch_size: 정제 #3 MySQL 상한 10000, Oracle 0이면 10000
        effective_batch_size = batch_size if batch_size > 0 else 10000
        if stype == "mysql" and effective_batch_size > MYSQL_BATCH_SIZE_CAP:
            effective_batch_size = MYSQL_BATCH_SIZE_CAP
            logger.info("run_db_batch_job job_id=%s: MySQL batch_size cap %s 적용", batch_job_id, MYSQL_BATCH_SIZE_CAP)
        if stype == "oracle" and batch_size == 0:
            effective_batch_size = ORACLE_BATCH_SIZE_DEFAULT

        conn_schema_pg = (c.get("schema_name") or "public").strip()
        conn_db_mysql = (c.get("database_name") or "").strip()
        conn_schema_oracle = (c.get("schema_name") or c.get("username") or "").strip()
        source_table = etl_service._validate_source_table(source_table)
        src_schema, source_table_name = etl_service.parse_source_table_parts(
            source_table, stype,
            conn_schema=conn_schema_oracle if stype == "oracle" else conn_schema_pg,
            conn_db=conn_db_mysql,
        )
        if not source_table_name:
            raise ValueError("source_table이 비어 있습니다.")

        if stype == "mysql":
            src_conn = etl_service._connect_mysql(
                c["host"], c.get("port") or 3306, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            quoted_src = f"`{src_schema}`.`{source_table_name}`"
            _quote = lambda x: f"`{x}`"
            bind_placeholder = "%s"
        elif stype == "oracle":
            src_conn = etl_service._connect_oracle(
                c["host"], c.get("port") or 1521, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
            tbl = source_table_name.strip().upper()
            quoted_src = f'"{owner}"."{tbl}"'
            _quote = lambda x: f'"{x}"'
            bind_placeholder = ":1"  # cx_Oracle positional bind. db_load_service와 동일 패턴.
        else:
            src_conn = db_load_service._get_source_connection(connection_id)
            quoted_src = f'"{src_schema}"."{source_table_name}"'
            _quote = lambda x: f'"{x}"'
            bind_placeholder = "%s"

        columns = db_load_service.get_source_columns(connection_id, source_table)
        if not columns:
            raise ValueError("소스 테이블에 컬럼이 없습니다.")
        col_names = [col["column_name"] for col in columns]
        select_list = ", ".join(_quote(c) for c in col_names)

        # pk_columns_str이 없으면 소스 DB에서 PK 자동 조회 (배치잡/ETL에 미설정이어도 upsert 가능)
        if not pk_columns_str:
            try:
                pk_schema = (src_schema or "").strip() or ""
                if stype == "oracle":
                    pk_schema = pk_schema.upper() or (c.get("username") or "").strip().upper()
                src_pk = _fetch_source_pk(src_conn, stype, pk_schema, source_table_name)
                if src_pk:
                    pk_columns_str = ", ".join(src_pk)
                    logger.info(
                        "run_db_batch_job job_id=%s: pk_columns 미설정, 소스 DB에서 PK 자동 감지: %s",
                        batch_job_id, pk_columns_str,
                    )
            except Exception as e:
                logger.warning(
                    "run_db_batch_job job_id=%s: 소스 PK 자동 감지 실패: %s",
                    batch_job_id, e,
                )

        where_clause = ""
        params: List[Any] = []
        if sync_mode == "incremental" and incremental_column:
            if incremental_column not in col_names:
                raise ValueError(f"증분 컬럼 '{incremental_column}'이(가) 소스 테이블에 없습니다.")
            if last_synced_at is not None:
                # >= 사용: 동일 시각(updated_at 등)인 행도 포함. 중복은 PK upsert로 방지.
                # IS NOT NULL: 증분 컬럼이 NULL인 헤더/쓰레기 행 제외
                where_clause = (
                    f" WHERE {_quote(incremental_column)} >= {bind_placeholder}"
                    f" AND {_quote(incremental_column)} IS NOT NULL"
                )
                # last_synced_at은 타겟(시스템) DB 시간대로 저장됨. 소스 DB 시간대로 변환해서 비교.
                _synced_val = last_synced_at
                if _tz_convert_needed and isinstance(last_synced_at, datetime):
                    try:
                        _synced_val = timezone_utils.convert_single_datetime(
                            last_synced_at, from_tz=target_tz, to_tz=source_tz,
                        )
                        logger.info(
                            "run_db_batch_job job_id=%s: last_synced_at 시간대 변환 %s(%s) → %s(%s)",
                            batch_job_id, last_synced_at, target_tz, _synced_val, source_tz,
                        )
                    except Exception as tz_err:
                        logger.warning(
                            "run_db_batch_job job_id=%s: last_synced_at 시간대 변환 실패, 원본 사용: %s",
                            batch_job_id, tz_err,
                        )
                        _synced_val = last_synced_at
                params.append(_synced_val)

        select_sql = f"SELECT {select_list} FROM {quoted_src}{where_clause}"
        logger.info(
            "run_db_batch_job job_id=%s: last_synced_at=%s (batch_jobs 기준)",
            batch_job_id, last_synced_at,
        )
        logger.info(
            "run_db_batch_job job_id=%s: 증분 SELECT 쿼리: %s ; params=%s",
            batch_job_id, select_sql, params if params else None,
        )

        mapping_used: List[dict] = []
        if isinstance(column_mapping, list) and column_mapping:
            col_set = set(col_names)
            for m in column_mapping:
                src = (m.get("source") or "").strip()
                tgt = (m.get("target") or "").strip()
                if src in col_set and tgt:
                    mapping_used.append({
                        "source": src,
                        "target": tgt,
                        "type": (m.get("type") or "TEXT").strip().upper() or "TEXT",
                        "on_error": (m.get("on_error") or "null").strip().lower() or "null",
                    })

        if sync_mode == "diff":
            pk_list_diff = [x.strip() for x in (pk_columns_str or "").split(",") if x.strip()]
            if not pk_list_diff:
                raise ValueError("diff 모드는 pk_columns가 필요합니다.")
            diff_delete = (
                etl_def.get("diff_delete_orphans", False) if etl_table_id else job.get("diff_delete_orphans", False)
            )
            row_diff = {"diff_delete_orphans": bool(diff_delete)}
            col_names_diff = [m["source"] for m in mapping_used] if mapping_used else col_names
            columns_tuples = [
                (c["column_name"], c["data_type"])
                for c in columns
                if c["column_name"] in col_names_diff
            ]
            if not columns_tuples:
                columns_tuples = [(c["column_name"], c["data_type"]) for c in columns]
            if stype == "mysql":
                type_mapper = db_load_service._pg_type_from_mysql
            elif stype == "oracle":
                type_mapper = db_load_service._pg_type_from_oracle
            else:
                type_mapper = db_load_service._pg_type_from_info_schema
            select_list_diff = (
                ", ".join(_quote(m["source"]) for m in mapping_used)
                if mapping_used
                else select_list
            )
            result = db_load_service._run_diff_sync(
                etl_table_id or 0,
                0,
                row_diff,
                src_conn,
                target_conn,
                target_schema,
                target_table,
                stype,
                columns_tuples,
                col_names_diff,
                quoted_src,
                _quote,
                type_mapper,
                mapping_used,
                pk_list_diff,
                source_tz,
                target_tz,
                _tz_convert_needed,
                select_list_diff,
                is_batch=True,
            )
            batch_service.finish_run(
                run_id,
                "success",
                rows_inserted=result["rows_inserted"],
                rows_updated=0,
                conn=sys_conn,
            )
            run_completed_ok = True
            batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
            logger.info(
                "run_db_batch_job job_id=%s diff completed rows_inserted=%s rows_deleted=%s",
                batch_job_id, result["rows_inserted"], result.get("rows_deleted", 0),
            )
            return

        if stype == "mysql":
            try:
                import pymysql.cursors
                cur_src = src_conn.cursor(pymysql.cursors.SSCursor)
            except ImportError:
                cur_src = src_conn.cursor()
        elif stype == "oracle":
            cur_src = src_conn.cursor()
            cur_src.arraysize = min(effective_batch_size, 5000)
        else:
            cur_src = src_conn.cursor()

        cur_src.execute(select_sql, params if params else None)

        total_ins = 0
        total_upd = 0
        last_synced_candidate = None
        batch_offset = 0

        while True:
            if batch_service.is_run_cancel_requested(run_id, conn=sys_conn):
                logger.info("run_db_batch_job run_id=%s 취소 요청 감지, 중단", run_id)
                break
            batch = cur_src.fetchmany(effective_batch_size)
            if not batch:
                break
            logger.info(
                "run_db_batch_job job_id=%s batch_offset=%s: 소스에서 %s행 조회",
                batch_job_id, batch_offset, len(batch),
            )
            # row가 이미 dict-like(RealDictRow 등)면 zip 시 key만 나와 값이 컬럼명으로 채워지는 버그 방지
            if batch and hasattr(batch[0], "keys"):
                rows_dict = [dict(r) for r in batch]
            else:
                rows_dict = [dict(zip(col_names, r)) for r in batch]
            df = pd.DataFrame(rows_dict, columns=col_names)
            # --- 시간대 변환 (소스 TZ → 타겟 TZ) ---
            if _tz_convert_needed:
                try:
                    df = timezone_utils.convert_timezone_columns(
                        df, columns, source_tz, target_tz,
                    )
                except Exception as tz_err:
                    logger.warning(
                        "run_db_batch_job job_id=%s: 시간대 변환 실패 (skip): %s",
                        batch_job_id, tz_err,
                    )
            # 소스에 헤더가 한 행으로 들어온 경우 제외: 첫 번째 컬럼 값이 해당 컬럼명과 동일한 행 제거 (설정으로 비활성화 가능)
            if SKIP_HEADER_LIKE_ROWS and col_names and len(df) > 0:
                first_col = col_names[0]
                first_series = df[first_col]
                # NaN/None은 'nan' 등으로 변환되므로 컬럼명과 일치하지 않음 → 유지
                header_like = first_series.astype(str).str.strip().str.lower() == str(first_col).strip().lower()
                if header_like.any():
                    df = df.loc[~header_like].reset_index(drop=True)
                    logger.info(
                        "run_db_batch_job job_id=%s batch_offset=%s: 헤더 유사 행 %s건 제외 (컬럼 '%s' 값=컬럼명)",
                        batch_job_id, batch_offset, int(header_like.sum()), first_col,
                    )
            if df.empty:
                batch_offset += 1
                continue
            if etl_table_id:
                try:
                    rules = transform_rules_svc.list_transform_rules(etl_table_id)
                    if rules:
                        df = transform_engine.apply_rules(df, rules)
                except Exception as e:
                    logger.warning(
                        "run_db_batch_job job_id=%s: 변환 룰 적용 실패 (skip): %s",
                        batch_job_id, e,
                    )
            if mapping_used:
                try:
                    df = transform_engine.apply_mapping_type_cast(df, mapping_used, default_on_error="null")
                except ValueError as cast_err:
                    raise RuntimeError(f"컬럼 형변환 실패: {cast_err}") from cast_err

            # 정제 #4: DB 배치에서는 파일 단위 롤백 미지원. source_filename=None으로 batch_loaded_keys 기록 스킵.
            result = load_service_file.load_dataframe(
                target_conn,
                target_schema,
                target_table,
                df,
                pk_columns_str=pk_columns_str,
                column_mapping=column_mapping,
                batch_job_id=batch_job_id,
                run_id=run_id,
                source_filename=None,
                sys_conn=sys_conn,
                index_definitions=index_definitions,
            )
            try:
                target_conn.commit()
            except Exception as commit_err:
                logger.exception("run_db_batch_job commit failed batch_offset=%s: %s", batch_offset, commit_err)
                target_conn.rollback()
                raise
            total_ins += result.get("inserted", 0) or 0
            total_upd += result.get("updated", 0) or 0

            if incremental_column and incremental_column in df.columns:
                ser = df[incremental_column].dropna()
                if not ser.empty:
                    max_val = ser.max()
                    if hasattr(max_val, "to_pydatetime"):
                        max_val = max_val.to_pydatetime()
                    if last_synced_candidate is None:
                        last_synced_candidate = max_val
                    else:
                        last_synced_candidate = max(last_synced_candidate, max_val)

            batch_service.update_run_progress(
                run_id,
                rows_inserted=total_ins,
                rows_updated=total_upd,
                conn=sys_conn,
            )
            batch_offset += 1
            if batch_interval_seconds > 0:
                for _ in range(batch_interval_seconds):
                    time.sleep(1)
                    if batch_service.is_run_cancel_requested(run_id, conn=sys_conn):
                        break

        if batch_offset == 0:
            logger.warning(
                "run_db_batch_job job_id=%s: 소스에서 조회된 행 없음. "
                "증분 모드일 경우 last_synced_at이 너무 최근이면 새 행이 없을 수 있음. full 동기화 또는 last_synced_at 초기화 권장.",
                batch_job_id,
            )

        if last_synced_candidate is not None:
            if not isinstance(last_synced_candidate, datetime):
                last_synced_candidate = pd.to_datetime(last_synced_candidate)
            # convert_timezone_columns가 이미 df를 타겟 TZ로 변환했으므로
            # df에서 꺼낸 max_val은 이미 타겟 TZ 기준. 추가 변환 불필요.
            batch_service.update_last_synced_at_db_batch(batch_job_id, last_synced_candidate, conn=sys_conn)
            # ETL 목록(etl_tables) 행도 동기화: postgres/mysql/oracle 공통, 기존 row에 갱신 반영
            if etl_table_id is not None:
                try:
                    etl_service.update_last_synced_at(etl_table_id, last_synced_candidate)
                except Exception as sync_err:
                    logger.warning(
                        "run_db_batch_job job_id=%s: etl_tables.last_synced_at 갱신 실패(배치 자체는 성공): %s",
                        batch_job_id, sync_err,
                    )

        batch_service.finish_run(
            run_id,
            "success",
            rows_inserted=total_ins,
            rows_updated=total_upd,
            conn=sys_conn,
        )
        run_completed_ok = True  # run finished success; do not overwrite to "error" if update_job_status below fails
        batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
        logger.info("run_db_batch_job job_id=%s completed rows_inserted=%s rows_updated=%s", batch_job_id, total_ins, total_upd)

    except Exception as e:
        logger.exception("run_db_batch_job job_id=%s error: %s", batch_job_id, e)
        if sys_conn:
            try:
                sys_conn.rollback()
            except Exception:
                pass
        if run_id is not None and not run_completed_ok:
            try:
                batch_service.finish_run(
                    run_id,
                    "error",
                    rows_inserted=0,
                    rows_updated=0,
                    error_message=str(e),
                    conn=None,
                )
            except Exception:
                logger.exception("finish_run 복구 실패")
        if not run_completed_ok:
            try:
                batch_service.update_job_status(
                    batch_job_id,
                    "error",
                    last_error_message=str(e),
                    conn=None,
                )
            except Exception:
                logger.exception("update_job_status 복구 실패")
    finally:
        # MySQL SSCursor: 미소비 결과가 있으면 close 시 대기/타임아웃 가능. 먼저 소비 후 close.
        if stype == "mysql" and cur_src is not None:
            try:
                while cur_src.fetchmany(1000):
                    pass
            except Exception:
                pass
        # 커서 먼저 닫기 (SSCursor close 에러 방지)
        if cur_src is not None:
            try:
                cur_src.close()
            except Exception:
                pass
        if sys_conn:
            try:
                sys_conn.close()
            except Exception:
                pass
        if target_conn:
            try:
                target_conn.close()
            except Exception:
                pass
        if src_conn:
            try:
                src_conn.close()
            except Exception:
                pass

    # 실행 완료 시점 기준으로 다음 주기 리셋 (성공·실패 무관)
    try:
        from Backend.etl_server import scheduler_file as sched_mod
        sched_mod.refresh_interval_after_run(batch_job_id)
    except Exception:
        pass

    # 정제 #5: run_id 여부와 무관하게 항상 호출. 연속 실패 시 자동 비활성화.
    try:
        batch_service.check_consecutive_failures(batch_job_id, threshold=5)
    except Exception:
        logger.exception("check_consecutive_failures 실패")
