"""
Backend.system_log_server.schemas (Pydantic 응답·쿼리)
=====================================================
system_log·로그인 이력 목록 API용 모델.

[Main Functions]
===========
- (Pydantic 모델 정의)

[Endpoints/Classes/Functions]
=======================
- SystemLogItemOut / SystemLogListOut: system_log (`actor_user_email` 조인)
- LoginHistoryItemOut / LoginHistoryListOut: user_login_log (me·org)

[Dependencies]
=========
- pydantic, datetime
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SystemLogItemOut(BaseModel):
    """system_log 조회 행."""

    model_config = ConfigDict(from_attributes=True)

    system_log_id: int
    create_dtm: datetime
    actor_user_id: int | None = None
    actor_user_email: str | None = None
    request_correlation_id: str | None = None
    client_ip_masked: str | None = None
    user_agent_summary: str | None = None
    channel: str
    action_kind: str
    business_action: str | None = None
    db_target: str | None = None
    schema_name: str | None = None
    table_name: str | None = None
    resource_name: str | None = None
    rows_affected: int | None = None
    success_yn: str
    http_status: int | None = None
    error_code: str | None = None
    sql_fingerprint: str | None = None
    sql_template_key: str | None = None
    risk_tier: str | None = None
    target_summary: str | None = None
    detail_json: dict[str, Any] = Field(default_factory=dict)


class SystemLogListOut(BaseModel):
    """페이지 목록 응답."""

    items: list[SystemLogItemOut]
    total: int
    page: int
    page_size: int


class LoginHistoryItemOut(BaseModel):
    """user_login_log 한 행(마스킹된 IP, create_dtm ISO 문자열). org 모드만 user_id·user_email."""

    login_trial_ip: str | None = None
    login_success_yn: str | None = None
    login_trial_browser: str | None = None
    create_dtm: str | None = None
    user_id: int | None = None
    user_email: str | None = None


class LoginHistoryListOut(BaseModel):
    """로그인 이력 페이징 응답."""

    items: list[LoginHistoryItemOut]
    total: int
    page: int
    page_size: int
