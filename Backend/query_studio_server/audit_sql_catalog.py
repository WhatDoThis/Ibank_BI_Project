"""
Backend.query_studio_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
================================================================
`emit_query_studio_log` 가 `sql_fingerprint` 를 생략할 때(예: 라벨 저장) 대표 UPSERT 템플릿으로
지문을 계산한다. `query_execute`·`saved_table_create` 는 호출부에서 사용자 SQL 지문을 넘긴다.

[Main Functions]
===========
1. query_studio_audit_sql_fingerprint: business_action → 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- query_studio_audit_sql_fingerprint(business_action, detail_json)

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
    "labels_save": """
            INSERT INTO query_studio_user_labels (user_id, project_info_id, labels_json, updated_at)
            VALUES (%s, %s, %s::jsonb, NOW())
            ON CONFLICT (user_id, project_info_id)
            DO UPDATE SET labels_json = EXCLUDED.labels_json, updated_at = NOW()
            """,
}


# 1.
@lru_cache(maxsize=16)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


def query_studio_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    _ = detail_json
    ba = (business_action or "").strip()
    tpl = _SQL_BY_ACTION.get(ba)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
