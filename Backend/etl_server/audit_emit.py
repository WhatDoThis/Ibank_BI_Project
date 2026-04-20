"""
Backend.etl_server.audit_emit (system_log ETL 채널)
==================================================
HTTP·사용자 유발 작업만 기록. `system_log_append_enabled` off 시 no-op.
`actor_user_id` 는 양의 정수일 때만 적재.

[Main Functions]
===========
1. emit_etl_log: channel=etl 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_etl_log(actor_user_id, *, business_action, action_kind=..., success_yn=..., detail_json=..., rows_affected=..., risk_tier=..., table_name=...)

[Dependencies]
=========
- Backend.core.system_audit_log
"""

from __future__ import annotations

from typing import Any


# 1.
def emit_etl_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str = "UPDATE",
    success_yn: str = "Y",
    detail_json: dict[str, Any] | None = None,
    rows_affected: int | None = None,
    risk_tier: str | None = None,
    table_name: str | None = None,
) -> None:
    try:
        aid = int(actor_user_id) if actor_user_id is not None else None
    except (TypeError, ValueError):
        return
    if aid is None or aid <= 0:
        return
    from Backend.core import system_audit_log

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_ETL,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=aid,
            db_target="system",
            success_yn=success_yn,
            sql_template_key=f"etl.{business_action}",
            rows_affected=rows_affected,
            risk_tier=risk_tier,
            table_name=table_name,
            detail_json=dict(detail_json or {}),
        ),
    )
