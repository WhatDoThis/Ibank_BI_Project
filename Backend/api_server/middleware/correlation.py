"""
Backend.api_server.middleware.correlation (상관 ID 미들웨어)
=========================================================
요청 입구에 UUID 상관 ID·client host·User-Agent raw 를 contextvars·Request.state에 저장하고, 응답에 상관 헤더를 반사한다.

[Main Functions]
===========
1. CorrelationIdMiddleware.dispatch: 상관 ID·client host·User-Agent contextvars 설정·finally reset·예외 무해화

[Dependencies]
=========
- logging, starlette (BaseHTTPMiddleware, Request, Response)
- Backend.core.request_context
"""

from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from Backend.core import request_context as rc

logger = logging.getLogger(__name__)

_OUT_HEADER = "X-Request-Correlation-Id"


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """X-Request-Correlation-Id 처리. 본문 전체 try/except 로 요청 진행을 보장한다."""

    async def dispatch(self, request: Request, call_next) -> Response:
        token_cid = None
        token_host = None
        token_ua = None
        cid = None
        try:
            raw = request.headers.get(rc.HEADER_CORRELATION_ID)
            cid = rc.resolve_correlation_id_from_header(raw)
            request.state.correlation_id = cid
            token_cid = rc.set_request_correlation_id(cid)
            host = request.client.host if request.client else None
            token_host = rc.set_request_client_host(host)
            ua = request.headers.get("user-agent")
            token_ua = rc.set_request_user_agent_raw(ua)
        except Exception:
            logger.exception("CorrelationIdMiddleware: correlation setup skipped")
        try:
            response = await call_next(request)
            if cid is not None:
                response.headers[_OUT_HEADER] = str(cid)
            return response
        finally:
            if token_ua is not None:
                try:
                    rc.reset_request_user_agent_raw(token_ua)
                except Exception:
                    logger.exception("CorrelationIdMiddleware: UA context reset failed")
            if token_host is not None:
                try:
                    rc.reset_request_client_host(token_host)
                except Exception:
                    logger.exception("CorrelationIdMiddleware: host context reset failed")
            if token_cid is not None:
                try:
                    rc.reset_request_correlation_id(token_cid)
                except Exception:
                    logger.exception("CorrelationIdMiddleware: correlation context reset failed")
