"""

Backend.auth_server.audit_emit (system_log 인증 채널 계측)

======================================================

로그인·가입·비밀번호 등 `CHANNEL_AUTH` append. `system_log_append_enabled` off 시 no-op.

`sql_fingerprint` 는 생략 시 `audit_sql_catalog.auth_audit_sql_fingerprint` 로 채운다(04: 기본 (1), 호출부 명시는 예외 (2)).



[Main Functions]

===========

1. emit_auth_system_log: channel=auth 단일 행 append



[Endpoints/Classes/Functions]

=======================

- emit_auth_system_log(actor_user_id, *, business_action, action_kind=..., success_yn=..., detail_json=..., risk_tier=..., sql_fingerprint=...)



[Dependencies]

=========

- Backend.core.system_audit_log

- Backend.auth_server.audit_sql_catalog.auth_audit_sql_fingerprint

"""



from __future__ import annotations



from typing import Any



from Backend.auth_server.audit_sql_catalog import auth_audit_sql_fingerprint





# 1.

def emit_auth_system_log(

    actor_user_id: int | None,

    *,

    business_action: str,

    action_kind: str = "LOGIN",

    success_yn: str = "Y",

    detail_json: dict[str, Any] | None = None,

    risk_tier: str | None = None,

    sql_fingerprint: str | None = None,

) -> None:

    from Backend.core import system_audit_log



    dj = dict(detail_json or {})

    fp = sql_fingerprint

    if fp is None:

        fp = auth_audit_sql_fingerprint(business_action, dj)



    system_audit_log.append_system_log(

        conn=None,

        row=system_audit_log.SystemLogRow(

            channel=system_audit_log.CHANNEL_AUTH,

            action_kind=action_kind,

            business_action=business_action,

            actor_user_id=actor_user_id,

            db_target="system",

            success_yn=success_yn,

            sql_fingerprint=fp,

            sql_template_key=f"auth.{business_action}",

            risk_tier=risk_tier,

            detail_json=dj,

        ),

    )


