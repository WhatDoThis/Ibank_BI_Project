"""
Backend.project_server.audit_emit (system_log 프로젝트 채널)
==========================================================
`service` commit 성공 직후 호출. `system_log_append_enabled` off 시 no-op.

[Main Functions]
===========
1. emit_project_log: channel=project 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_project_log(actor_user_id, *, business_action, action_kind=..., detail_json=...)

[Dependencies]
=========
- Backend.core.system_audit_log
"""

from __future__ import annotations

from typing import Any


# 1.
def emit_project_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str = "UPDATE",
    detail_json: dict[str, Any] | None = None,
) -> None:
    from Backend.core import system_audit_log

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_PROJECT,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=actor_user_id,
            db_target="system",
            success_yn="Y",
            sql_template_key=f"project.{business_action}",
            detail_json=dict(detail_json or {}),
        ),
    )
