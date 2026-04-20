"""
Backend.system_log_server.router (/api/system-logs)
=================================================
system_log 목록·로그인 이력(me·org) 조회.

[Endpoints]
===========
1. GET /api/system-logs — 조직 어드민, system_log 필터·페이징
2. GET /api/system-logs/login-history/me — 본인 로그인 이력(활성 세션)
3. GET /api/system-logs/login-history/org — 조직 어드민, 부서 트리 범위

[Dependencies]
=========
- fastapi (APIRouter, Depends, Query)
- Backend.admin_server.deps.require_org_admin, Backend.auth_server.deps.require_active_access
- Backend.core.dependencies.get_system_db
- Backend.system_log_server.service, service_login_history, schemas
"""

from datetime import date

from fastapi import APIRouter, Depends, Query

from Backend.admin_server.deps import require_org_admin
from Backend.auth_server.deps import require_active_access
from Backend.core.dependencies import get_system_db
from Backend.system_log_server import schemas
from Backend.system_log_server import service
from Backend.system_log_server import service_login_history

router = APIRouter(prefix="/api/system-logs", tags=["system-logs"])


# 2.
@router.get(
    "/login-history/me",
    response_model=schemas.LoginHistoryListOut,
    response_model_exclude_none=True,
)
def list_login_history_me(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
    user_key: str | None = Query(None),
    from_dtm: date | None = Query(None, alias="from"),
    to_dtm: date | None = Query(None, alias="to"),
    ip_contains: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50),
):
    uid = int(payload["user_id"])
    raw = service_login_history.list_login_history_me_paged(
        conn,
        uid,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        page=page,
        page_size=page_size,
    )
    items = [schemas.LoginHistoryItemOut.model_validate(x) for x in raw["items"]]
    return schemas.LoginHistoryListOut(
        items=items,
        total=raw["total"],
        page=raw["page"],
        page_size=raw["page_size"],
    )


# 3.
@router.get(
    "/login-history/org",
    response_model=schemas.LoginHistoryListOut,
    response_model_exclude_none=True,
)
def list_login_history_org(
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
    user_key: str | None = Query(None),
    from_dtm: date | None = Query(None, alias="from"),
    to_dtm: date | None = Query(None, alias="to"),
    ip_contains: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50),
):
    raw = service_login_history.list_login_history_org_paged(
        conn,
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        page=page,
        page_size=page_size,
    )
    items = [schemas.LoginHistoryItemOut.model_validate(x) for x in raw["items"]]
    return schemas.LoginHistoryListOut(
        items=items,
        total=raw["total"],
        page=raw["page"],
        page_size=raw["page_size"],
    )


# 1.
@router.get("", response_model=schemas.SystemLogListOut)
def list_system_logs(
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
    user_key: str | None = Query(None, description="사용자 id 문자열·이메일 부분 일치"),
    from_dtm: date | None = Query(None, alias="from"),
    to_dtm: date | None = Query(None, alias="to"),
    ip_contains: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    channel: str | None = Query(None),
    action_kind: str | None = Query(None),
    success_yn: str | None = Query(None, min_length=1, max_length=1),
):
    raw = service.list_system_logs_paged(
        conn,
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        page=page,
        page_size=page_size,
        channel=channel,
        action_kind=action_kind,
        success_yn=success_yn,
    )
    items = [schemas.SystemLogItemOut.model_validate(x) for x in raw["items"]]
    return schemas.SystemLogListOut(
        items=items,
        total=raw["total"],
        page=raw["page"],
        page_size=raw["page_size"],
    )
