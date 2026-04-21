"""
Backend.admin_server.audit_emit (system_log 계측 헬퍼)
====================================================
`service_*` 에서 **commit 성공 직후** 호출. `system_log_append_enabled` off 시 `append_system_log` 내부 no-op.
`actor_user_id` 는 양의 정수로만 적재(없음·0·비정수면 생략).
관리 UI DML의 `sql_fingerprint`는 `audit_sql_catalog.admin_audit_sql_fingerprint`에서 조회한다(§13 규약).

[Main Functions]
===========
1. emit_admin_system_log: channel=admin 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_admin_system_log(actor_user_id, *, business_action, action_kind=..., detail_json=..., risk_tier=..., target_summary=..., sql_fingerprint=...)

[Dependencies]
=========
- Backend.core.system_audit_log
- Backend.admin_server.audit_sql_catalog.admin_audit_sql_fingerprint
"""

from __future__ import annotations

from typing import Any

from Backend.admin_server.audit_sql_catalog import admin_audit_sql_fingerprint


# 1.
def emit_admin_system_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str = "UPDATE",
    detail_json: dict[str, Any] | None = None,
    risk_tier: str | None = None,
    target_summary: str | None = None,
    sql_fingerprint: str | None = None,
) -> None:
    try:
        aid = int(actor_user_id) if actor_user_id is not None else None
    except (TypeError, ValueError):
        return
    if aid is None or aid <= 0:
        return
    from Backend.core import system_audit_log

    fp = sql_fingerprint
    if fp is None:
        fp = admin_audit_sql_fingerprint(business_action, detail_json)

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_ADMIN,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=aid,
            db_target="system",
            success_yn="Y",
            sql_template_key=f"admin.{business_action}",
            risk_tier=risk_tier,
            target_summary=target_summary,
            detail_json=dict(detail_json or {}),
            sql_fingerprint=fp,
        ),
    )
