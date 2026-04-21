"""
Backend.widget_board_server.audit_emit (system_log 위젯보드 채널)
================================================================
`service` commit 성공 직후 호출. `system_log_append_enabled` off 시 no-op.
`actor_user_id` 는 양의 정수일 때만 적재.
`sql_fingerprint` 는 생략 시 `audit_sql_catalog.widget_board_audit_sql_fingerprint` 로 채운다(04 §13).

[Main Functions]
===========
1. emit_widget_board_log: channel=widget_board 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_widget_board_log(actor_user_id, *, business_action, action_kind=..., detail_json=..., risk_tier=..., rows_affected=..., sql_fingerprint=...)

[Dependencies]
=========
- Backend.core.system_audit_log
- Backend.widget_board_server.audit_sql_catalog.widget_board_audit_sql_fingerprint
"""

from __future__ import annotations

from typing import Any

from Backend.widget_board_server.audit_sql_catalog import widget_board_audit_sql_fingerprint


# 1.
def emit_widget_board_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str = "UPDATE",
    detail_json: dict[str, Any] | None = None,
    risk_tier: str | None = None,
    rows_affected: int | None = None,
    sql_fingerprint: str | None = None,
) -> None:
    try:
        aid = int(actor_user_id) if actor_user_id is not None else None
    except (TypeError, ValueError):
        return
    if aid is None or aid <= 0:
        return
    from Backend.core import system_audit_log

    dj = dict(detail_json or {})
    fp = sql_fingerprint
    if fp is None:
        fp = widget_board_audit_sql_fingerprint(business_action, dj)

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_WIDGET_BOARD,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=aid,
            db_target="system",
            success_yn="Y",
            sql_fingerprint=fp,
            sql_template_key=f"widget_board.{business_action}",
            risk_tier=risk_tier,
            rows_affected=rows_affected,
            detail_json=dj,
        ),
    )
