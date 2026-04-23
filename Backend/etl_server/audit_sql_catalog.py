"""
Backend.etl_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
========================================================
`emit_etl_log` 가 `sql_fingerprint` 를 생략할 때 `business_action` 별 **대표 DML 문자열**을
`service._schema`·`service._q` 로 한정한 뒤 해시한다. `etl_batch_job_create`·`etl_batch_job_create_from_etl` 은
라우터가 **`create_batch_job` 가 실행한 INSERT 문자열 지문**을 넘기므로, 여기서는 폴백만 제공한다(`docs/main/04_DB_ARCHITECTURE.md` 13절).

[Main Functions]
===========
1. _fingerprint_hex_cached: SQL 템플릿 → 지문 hex(lru_cache)
2. _resolve_etl_sql_template: business_action → 대표 DML 문자열 또는 None
3. etl_audit_sql_fingerprint: business_action·detail_json → 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- _fingerprint_hex_cached(sql_template)
- _resolve_etl_sql_template(business_action)
- etl_audit_sql_fingerprint(business_action, detail_json)

[Dependencies]
=========
- functools.lru_cache, typing.Any
- Backend.core.sql_fingerprint.compute_sql_fingerprint_hex
- Backend.etl_server.service (지연 import: _schema, _q)
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex


# 1.
@lru_cache(maxsize=256)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


# 2.
def _resolve_etl_sql_template(business_action: str) -> str | None:
    """라우터 `business_action` 과 동일한 의미의 DML/조회 **대표문**(동적 SET/INSERT 일부 생략)."""
    from Backend.etl_server import service as S

    schema = S._schema()

    def qt(tbl: str) -> str:
        return S._q(schema, tbl)

    ba = (business_action or "").strip()
    t_etl = qt("etl_tables")
    t_jobs = qt("etl_jobs")
    t_conn = qt("etl_connections")
    t_stor = qt("etl_storage_connections")
    t_bfc = qt("batch_folder_connections")
    t_bfj = qt("batch_jobs")
    t_brh = qt("batch_run_history")
    t_blk = qt("batch_loaded_keys")
    t_reg = qt("etl_batch_target_registry")

    if ba == "etl_table_update":
        return f"UPDATE {t_etl} SET sync_mode = %s, updated_at = NOW() WHERE etl_table_id = %s"
    if ba == "etl_table_create":
        return (
            f"INSERT INTO {t_etl} (connection_id, target_table, sync_mode) "
            f"VALUES (%s, %s, %s) RETURNING etl_table_id"
        )
    if ba == "etl_table_column_mapping_refresh":
        return f"UPDATE {t_etl} SET column_mapping = %s::jsonb, updated_at = NOW() WHERE etl_table_id = %s"
    if ba == "etl_table_row_delete":
        return (
            f"DELETE FROM {t_blk} WHERE batch_job_id IN "
            f"(SELECT batch_job_id FROM {t_bfj} WHERE etl_table_id = %s)"
        )
    if ba == "etl_table_delete":
        return f"DELETE FROM {t_etl} WHERE etl_table_id = %s"
    if ba == "etl_src_connection_create":
        return (
            f"INSERT INTO {t_conn} (connection_name, host, port, database_name, username) "
            f"VALUES (%s, %s, %s, %s, %s) RETURNING connection_id"
        )
    if ba == "etl_src_connection_test":
        return "SELECT 1 AS ok"
    if ba == "etl_src_connection_delete":
        return f"DELETE FROM {t_conn} WHERE connection_id = %s"
    if ba == "etl_storage_connection_create":
        return (
            f"INSERT INTO {t_stor} (connection_name, config_json, is_active) "
            f"VALUES (%s, %s::jsonb, %s) RETURNING storage_connection_id"
        )
    if ba == "etl_storage_connection_update":
        return (
            f"UPDATE {t_stor} SET config_json = %s::jsonb, updated_at = NOW() "
            f"WHERE storage_connection_id = %s"
        )
    if ba == "etl_storage_connection_delete":
        return f"DELETE FROM {t_stor} WHERE storage_connection_id = %s"
    if ba == "etl_storage_connection_test":
        return "CREATE TABLE etl_storage_permission_probe (id INTEGER)"
    if ba == "etl_job_run_enqueue":
        return (
            f"INSERT INTO {t_jobs} (etl_table_id, status, started_at, created_at) "
            f"VALUES (%s, %s, %s, NOW()) RETURNING job_id"
        )
    if ba == "etl_job_delete":
        return f"DELETE FROM {t_jobs} WHERE job_id = %s"
    if ba == "etl_job_cancel":
        return (
            f"UPDATE {t_jobs} SET status = %s, finished_at = NOW(), error_message = %s "
            f"WHERE job_id = %s"
        )
    if ba == "etl_batch_folder_connection_create":
        return (
            f"INSERT INTO {t_bfc} (connection_name, folder_type, created_at, updated_at) "
            f"VALUES (%s, %s, NOW(), NOW()) RETURNING folder_connection_id"
        )
    if ba == "etl_batch_folder_connection_update":
        return (
            f"UPDATE {t_bfc} SET connection_name = %s, updated_at = NOW() "
            f"WHERE folder_connection_id = %s"
        )
    if ba == "etl_batch_folder_connection_delete":
        return f"DELETE FROM {t_bfc} WHERE folder_connection_id = %s"
    if ba == "etl_batch_folder_connection_test":
        return (
            f"UPDATE {t_bfc} SET is_verified = %s, updated_at = NOW() WHERE folder_connection_id = %s"
        )
    if ba == "etl_batch_target_registry_delete":
        return f"DELETE FROM {t_reg} WHERE registry_id = %s"
    if ba in ("etl_batch_job_create", "etl_batch_job_create_from_etl"):
        return (
            f"INSERT INTO {t_bfj} (job_name, job_type, created_at, updated_at) "
            f"VALUES (%s, %s, NOW(), NOW()) RETURNING batch_job_id"
        )
    if ba == "etl_batch_job_update":
        return f"UPDATE {t_bfj} SET is_active = %s, updated_at = NOW() WHERE batch_job_id = %s"
    if ba == "etl_batch_job_delete":
        return (
            f"DELETE FROM {t_blk} WHERE batch_job_id = %s; "
            f"DELETE FROM {t_brh} WHERE batch_job_id = %s; "
            f"DELETE FROM {t_bfj} WHERE batch_job_id = %s"
        )
    if ba == "etl_batch_job_run_now":
        return f"SELECT batch_job_id FROM {t_bfj} WHERE batch_job_id = %s"
    if ba == "etl_batch_job_toggle":
        return f"UPDATE {t_bfj} SET is_active = %s, updated_at = NOW() WHERE batch_job_id = %s"
    if ba == "etl_batch_run_cancel_request":
        return (
            f"UPDATE {t_brh} SET cancel_requested_at = NOW() "
            f"WHERE run_id = %s AND (status = 'running' OR finished_at IS NULL)"
        )
    if ba == "etl_batch_remote_files_delete":
        return f"SELECT folder_connection_id FROM {t_bfc} WHERE folder_connection_id = %s"
    return None


# 3.
def etl_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    _ = detail_json
    tpl = _resolve_etl_sql_template((business_action or "").strip())
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
