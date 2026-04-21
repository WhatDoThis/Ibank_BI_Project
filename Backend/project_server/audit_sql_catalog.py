"""
Backend.project_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
============================================================
`emit_project_log` 가 `sql_fingerprint` 를 생략할 때 `business_action` 별 대표 DML 템플릿으로
지문을 계산한다. 원문 SQL 전체는 저장하지 않는다(04 §13).

[Main Functions]
===========
1. project_audit_sql_fingerprint: business_action → 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- project_audit_sql_fingerprint(business_action, detail_json)

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
    "invite_accept": """
            INSERT INTO project_ptcpnt_info (
                ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW())
            """,
    "invite_reject": """
            DELETE FROM notification_info WHERE notification_info_id = %s AND user_id = %s
            """,
}


# 1.
@lru_cache(maxsize=16)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


def project_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    _ = detail_json
    ba = (business_action or "").strip()
    tpl = _SQL_BY_ACTION.get(ba)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
