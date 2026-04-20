"""
Backend.notification_server.audit_emit (system_log 알림 채널)
===========================================================
API 전용 `mark_read_*` 의 `commit` 성공 직후 호출. `system_log_append_enabled` off 시 no-op.
`insert_notification` 은 다 도메인에서 호출되므로 여기서 계측하지 않는다(22 §6.5.7).

[Main Functions]
===========
1. emit_notification_log: channel=notification 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_notification_log(actor_user_id, *, business_action, action_kind=..., detail_json=..., rows_affected=...)

[Dependencies]
=========
- Backend.core.system_audit_log
"""

from __future__ import annotations

from typing import Any


# 1.
def emit_notification_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str = "UPDATE",
    detail_json: dict[str, Any] | None = None,
    rows_affected: int | None = None,
) -> None:
    from Backend.core import system_audit_log

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_NOTIFICATION,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=actor_user_id,
            db_target="system",
            success_yn="Y",
            sql_template_key=f"notification.{business_action}",
            rows_affected=rows_affected,
            detail_json=dict(detail_json or {}),
        ),
    )
