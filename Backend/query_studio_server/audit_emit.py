"""
Backend.query_studio_server.audit_emit (system_log 쿼리 스튜디오 채널)
====================================================================
`router`·백그라운드 워커에서 호출. `system_log_append_enabled` off 시 no-op.
`actor_user_id` 는 양의 정수일 때만 적재.
`sql_fingerprint` 는 호출부 미전달 시 `audit_sql_catalog.query_studio_audit_sql_fingerprint` 로 보강한다(04: 기본 (1), 호출부 명시는 예외 (2)).

[Main Functions]
===========
1. emit_query_studio_log: channel=query_studio 단일 행 append

[Endpoints/Classes/Functions]
=======================
- emit_query_studio_log(actor_user_id, *, business_action, action_kind, detail_json=..., rows_affected=..., risk_tier=..., target_summary=..., table_name=..., sql_fingerprint=...)

[Dependencies]
=========
- Backend.core.system_audit_log
- Backend.query_studio_server.audit_sql_catalog.query_studio_audit_sql_fingerprint
"""

from __future__ import annotations

from typing import Any

from Backend.query_studio_server.audit_sql_catalog import query_studio_audit_sql_fingerprint


# 1.
def emit_query_studio_log(
    actor_user_id: int | None,
    *,
    business_action: str,
    action_kind: str,
    detail_json: dict[str, Any] | None = None,
    rows_affected: int | None = None,
    risk_tier: str | None = None,
    target_summary: str | None = None,
    table_name: str | None = None,
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
        fp = query_studio_audit_sql_fingerprint(business_action, dj)

    system_audit_log.append_system_log(
        conn=None,
        row=system_audit_log.SystemLogRow(
            channel=system_audit_log.CHANNEL_QUERY_STUDIO,
            action_kind=action_kind,
            business_action=business_action,
            actor_user_id=aid,
            db_target="system",
            success_yn="Y",
            sql_fingerprint=fp,
            sql_template_key=f"query_studio.{business_action}",
            rows_affected=rows_affected,
            risk_tier=risk_tier,
            target_summary=target_summary,
            table_name=table_name,
            detail_json=dj,
        ),
    )
