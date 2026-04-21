"""
Backend.etl_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
========================================================
`emit_etl_log` 가 `sql_fingerprint` 를 생략할 때 `business_action` 별 대표 DML 템플릿으로 지문을
계산한다. 원문 SQL 전체는 저장하지 않는다(04 §13). HTTP 라우터별 액션을 구분한다.

[Main Functions]
===========
1. etl_audit_sql_fingerprint: business_action → 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- etl_audit_sql_fingerprint(business_action, detail_json)

[Dependencies]
=========
- functools.lru_cache, typing.Any
- Backend.core.sql_fingerprint.compute_sql_fingerprint_hex
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex

_SQL_BY_ACTION: dict[str, str] = {
    "etl_table_update": "UPDATE etl_table_master SET update_dtm = NOW() WHERE etl_table_id = %s",
    "etl_table_create": "INSERT INTO etl_table_master (project_info_id, create_dtm) VALUES (%s, NOW())",
    "etl_table_column_mapping_refresh": "UPDATE etl_table_master SET column_mapping_json = %s WHERE etl_table_id = %s",
    "etl_table_row_delete": "DELETE FROM etl_table_row WHERE etl_table_id = %s",
    "etl_table_delete": "DELETE FROM etl_table_master WHERE etl_table_id = %s",
    "etl_src_connection_create": "INSERT INTO etl_src_connection (create_dtm) VALUES (NOW())",
    "etl_src_connection_test": "SELECT 1 FROM etl_src_connection WHERE etl_src_connection_id = %s",
    "etl_src_connection_delete": "DELETE FROM etl_src_connection WHERE etl_src_connection_id = %s",
    "etl_storage_connection_create": "INSERT INTO etl_storage_connection (create_dtm) VALUES (NOW())",
    "etl_storage_connection_update": "UPDATE etl_storage_connection SET update_dtm = NOW() WHERE etl_storage_connection_id = %s",
    "etl_storage_connection_delete": "DELETE FROM etl_storage_connection WHERE etl_storage_connection_id = %s",
    "etl_storage_connection_test": "SELECT 1 FROM etl_storage_connection WHERE etl_storage_connection_id = %s",
    "etl_job_run_enqueue": "INSERT INTO etl_job_run_queue (create_dtm) VALUES (NOW())",
    "etl_job_delete": "DELETE FROM etl_job WHERE etl_job_id = %s",
    "etl_job_cancel": "UPDATE etl_job_run SET status = 'cancel_requested' WHERE run_id = %s",
    "etl_batch_folder_connection_create": "INSERT INTO etl_batch_folder_connection (create_dtm) VALUES (NOW())",
    "etl_batch_folder_connection_update": "UPDATE etl_batch_folder_connection SET update_dtm = NOW() WHERE id = %s",
    "etl_batch_folder_connection_delete": "DELETE FROM etl_batch_folder_connection WHERE id = %s",
    "etl_batch_folder_connection_test": "SELECT 1 FROM etl_batch_folder_connection WHERE id = %s",
    "etl_batch_target_registry_delete": "DELETE FROM etl_batch_target_registry WHERE id = %s",
    "etl_batch_job_create": "INSERT INTO etl_batch_job (create_dtm) VALUES (NOW())",
    "etl_batch_job_create_from_etl": "INSERT INTO etl_batch_job (source_etl_job_id, create_dtm) VALUES (%s, NOW())",
    "etl_batch_job_update": "UPDATE etl_batch_job SET update_dtm = NOW() WHERE id = %s",
    "etl_batch_job_delete": "DELETE FROM etl_batch_job WHERE id = %s",
    "etl_batch_job_run_now": "UPDATE etl_batch_job SET last_run_requested_at = NOW() WHERE id = %s",
    "etl_batch_job_toggle": "UPDATE etl_batch_job SET enabled_yn = %s WHERE id = %s",
    "etl_batch_run_cancel_request": "UPDATE etl_batch_run SET cancel_requested = TRUE WHERE id = %s",
    "etl_batch_remote_files_delete": "DELETE FROM etl_batch_remote_file WHERE id = %s",
}


# 1.
@lru_cache(maxsize=128)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


def etl_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    _ = detail_json
    ba = (business_action or "").strip()
    tpl = _SQL_BY_ACTION.get(ba)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
