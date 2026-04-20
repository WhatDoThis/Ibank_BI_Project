"""
Backend.core.system_audit_log (system_log append 전용)
=====================================================
ibank_system_data.public.system_log 에 append-only INSERT. 계측 실패는 로깅만 하고 업무는 중단하지 않는다.

[Main Functions]
===========
1. is_system_log_append_enabled: config.backend.system_log_append_enabled (없으면 False)
2. append_system_log: 단일 INSERT (conn 없으면 system_db 풀에서 연결·commit·close; 상관 ID·client_ip_masked·user_agent_summary 는 행에 없으면 request_context에서 보강)

[Endpoints/Classes/Functions]
=======================
- SystemLogRow: 적재 행 필드(dataclass)
- CHANNEL_*: channel 문자열 상수(22번 계획 §6.3)

[Dependencies]
=========
- logging, uuid, dataclasses, typing
- psycopg2.extras.Json, register_uuid(모듈 로드 시 — 실패 시 warning·traceback 후 UUID 컬럼 적재는 런타임 오류 가능)
- Backend.core.db (get_db_connection_system_core), Backend.core.request_context (상관 ID 보강)
- Env.config (선택 플래그)
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Mapping

from psycopg2.extras import Json

from Backend.core import db

logger = logging.getLogger(__name__)

try:
    from psycopg2.extras import register_uuid

    register_uuid()
except Exception:
    logger.warning(
        "psycopg2 register_uuid 실패: system_log.request_correlation_id 적재 시 UUID 어댑트 오류가 날 수 있습니다.",
        exc_info=True,
    )

CHANNEL_AUTH = "auth"
CHANNEL_PROJECT = "project"
CHANNEL_NOTIFICATION = "notification"
CHANNEL_ADMIN = "admin"
CHANNEL_QUERY_STUDIO = "query_studio"
CHANNEL_ETL = "etl"
CHANNEL_CAMPAIGN_DASH = "campaign_dash"
CHANNEL_WIDGET_BOARD = "widget_board"
CHANNEL_SYSTEM_LOG = "system_log"


# 1.
def is_system_log_append_enabled() -> bool:
    """backend.system_log_append_enabled — 키 없거나 로드 실패 시 False."""
    try:
        from Env import config

        return bool(getattr(config.backend, "system_log_append_enabled", False))
    except Exception:
        return False


@dataclass
class SystemLogRow:
    """system_log 한 행( create_dtm 은 DB default )."""

    channel: str
    action_kind: str
    actor_user_id: int | None = None
    request_correlation_id: uuid.UUID | None = None
    client_ip_masked: str | None = None
    user_agent_summary: str | None = None
    business_action: str | None = None
    db_target: str | None = None
    schema_name: str | None = None
    table_name: str | None = None
    resource_name: str | None = None
    rows_affected: int | None = None
    success_yn: str = "Y"
    http_status: int | None = None
    error_code: str | None = None
    sql_fingerprint: str | None = None
    sql_template_key: str | None = None
    risk_tier: str | None = None
    target_summary: str | None = None
    detail_json: dict[str, Any] = field(default_factory=dict)


# 2.
def append_system_log(*, conn=None, row: SystemLogRow) -> None:
    """
    system_log INSERT. conn 이 None 이면 내부에서 system_db 연결을 열고 commit 후 close.
    conn 이 있으면 동일 트랜잭션에만 참여(commit/rollback 은 호출부 책임).
    """
    if not is_system_log_append_enabled():
        return
    own_conn = None
    try:
        use_conn = conn if conn is not None else None
        if use_conn is None:
            own_conn = db.get_db_connection_system_core()
            use_conn = own_conn

        detail = row.detail_json if isinstance(row.detail_json, Mapping) else {}
        corr = row.request_correlation_id
        if corr is None:
            try:
                from Backend.core import request_context as _rc

                corr = _rc.get_request_correlation_id()
            except Exception:
                corr = None

        ip_out = row.client_ip_masked
        if ip_out is None or (isinstance(ip_out, str) and not str(ip_out).strip()):
            try:
                from Backend.core import request_context as _rc

                h = _rc.get_request_client_host()
                if h and str(h).strip():
                    m = _rc.mask_client_ip_for_audit(h)
                    ip_out = (m[:45] if m else None) or None
            except Exception:
                ip_out = row.client_ip_masked
        ua_out = row.user_agent_summary
        if ua_out is None or (isinstance(ua_out, str) and not str(ua_out).strip()):
            try:
                from Backend.core import request_context as _rc

                ua_out = _rc.summarize_user_agent(_rc.get_request_user_agent_raw())
            except Exception:
                ua_out = row.user_agent_summary

        cur = use_conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO system_log (
                    actor_user_id, request_correlation_id, client_ip_masked, user_agent_summary,
                    channel, action_kind, business_action, db_target, schema_name, table_name, resource_name,
                    rows_affected, success_yn, http_status, error_code, sql_fingerprint, sql_template_key,
                    risk_tier, target_summary, detail_json
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s
                )
                """,
                (
                    row.actor_user_id,
                    corr,
                    ip_out,
                    ua_out,
                    (row.channel or "").strip()[:40],
                    (row.action_kind or "").strip()[:20],
                    (row.business_action or "")[:60] if row.business_action else None,
                    (row.db_target or "")[:20] if row.db_target else None,
                    (row.schema_name or "")[:63] if row.schema_name else None,
                    (row.table_name or "")[:63] if row.table_name else None,
                    (row.resource_name or "")[:200] if row.resource_name else None,
                    row.rows_affected,
                    (row.success_yn or "Y")[:1],
                    row.http_status,
                    (row.error_code or "")[:80] if row.error_code else None,
                    (row.sql_fingerprint or "")[:64] if row.sql_fingerprint else None,
                    (row.sql_template_key or "")[:120] if row.sql_template_key else None,
                    (row.risk_tier or "")[:10] if row.risk_tier else None,
                    (row.target_summary or "")[:500] if row.target_summary else None,
                    Json(detail if isinstance(detail, dict) else dict(detail)),
                ),
            )
        finally:
            cur.close()
        if own_conn is not None:
            own_conn.commit()
    except Exception:
        logger.exception(
            "append_system_log failed channel=%s action_kind=%s business_action=%s",
            getattr(row, "channel", None),
            getattr(row, "action_kind", None),
            getattr(row, "business_action", None),
        )
        try:
            if own_conn is not None:
                own_conn.rollback()
        except Exception:
            logger.exception("append_system_log rollback failed")
    finally:
        if own_conn is not None:
            try:
                own_conn.close()
            except Exception:
                logger.exception("append_system_log close failed")
