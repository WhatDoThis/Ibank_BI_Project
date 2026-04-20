"""
Backend.core.request_context (요청 상관 ID·HTTP 요약)
====================================================
HTTP 요청 단위 `request_correlation_id`(contextvars) 및 감사용 IP·UA 요약. 미들웨어 실패 시에도 업무 요청은 계속된다.

[Main Functions]
===========
1. get/set/reset_request_correlation_id: 상관 UUID
2. get/set/reset_request_client_host / get/set/reset_request_user_agent_raw: 미들웨어가 넣는 클라이언트 힌트(append_system_log 보강용)
3. resolve_correlation_id_from_header: X-Request-Correlation-Id 파싱 또는 신규 UUID
4. mask_client_ip_for_audit: IPv4 4옥텟 마스킹(저장·표시 공통)
5. summarize_user_agent: UA 문자열 길이 상한 요약(system_log user_agent_summary 용)

[Dependencies]
=========
- contextvars, logging, re, uuid
"""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar, Token

logger = logging.getLogger(__name__)

HEADER_CORRELATION_ID = "x-request-correlation-id"
_MAX_INCOMING_CORRELATION_LEN = 128
_UA_MAX_LEN = 120

request_correlation_id: ContextVar[uuid.UUID | None] = ContextVar(
    "request_correlation_id", default=None
)
request_client_host: ContextVar[str | None] = ContextVar(
    "request_client_host", default=None
)
request_user_agent_raw: ContextVar[str | None] = ContextVar(
    "request_user_agent_raw", default=None
)


# 1.
def get_request_correlation_id() -> uuid.UUID | None:
    """현재 컨텍스트의 상관 ID(미설정·백그라운드 스레드면 None)."""
    return request_correlation_id.get()


def set_request_correlation_id(value: uuid.UUID | None) -> Token:
    """미들웨어 또는 테스트에서 상관 ID 설정. reset(token)으로 복구."""
    return request_correlation_id.set(value)


def reset_request_correlation_id(token: Token) -> None:
    request_correlation_id.reset(token)


def get_request_client_host() -> str | None:
    return request_client_host.get()


def set_request_client_host(value: str | None) -> Token:
    return request_client_host.set(value)


def reset_request_client_host(token: Token) -> None:
    request_client_host.reset(token)


def get_request_user_agent_raw() -> str | None:
    return request_user_agent_raw.get()


def set_request_user_agent_raw(value: str | None) -> Token:
    return request_user_agent_raw.set(value)


def reset_request_user_agent_raw(token: Token) -> None:
    request_user_agent_raw.reset(token)


# 2.
def resolve_correlation_id_from_header(header_value: str | None) -> uuid.UUID:
    """
    헤더 없음·공백 → 신규 UUID.
    값 있음 → 길이 자른 뒤 UUID 파싱, 실패 시 신규 UUID(외부 임의 문자열은 DB uuid 컬럼에 넣지 않음).
    """
    if header_value is None or not str(header_value).strip():
        return uuid.uuid4()
    raw = str(header_value).strip()[:_MAX_INCOMING_CORRELATION_LEN]
    try:
        return uuid.UUID(raw)
    except ValueError:
        logger.debug(
            "resolve_correlation_id_from_header: invalid uuid, issuing new id prefix=%s",
            raw[:48],
        )
        return uuid.uuid4()


# 3.
def mask_client_ip_for_audit(ip: str | None) -> str:
    """클라이언트 IP 마스킹(IPv4 4옥텟만 a.b.*.*, 그 외는 trim 원문)."""
    raw = (ip or "").strip()
    if not raw:
        return ""
    parts = raw.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return f"{parts[0]}.{parts[1]}.*.*"
    return raw


# 4.
def summarize_user_agent(user_agent: str | None, *, max_len: int = _UA_MAX_LEN) -> str | None:
    """User-Agent 요약(개행·다중 공백 정리 후 길이 상한). 빈 문자열은 None."""
    if user_agent is None:
        return None
    s = str(user_agent).strip()
    if not s:
        return None
    s = re.sub(r"\s+", " ", s)
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s or None
