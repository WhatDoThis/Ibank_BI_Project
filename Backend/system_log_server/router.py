"""
Backend.system_log_server.router (/api/system-logs)
=================================================
system_log 목록·로그인 이력(me·org) 조회.

[Endpoints]
===========
1. GET /api/system-logs/export.csv — system_log CSV(목록과 동일 필터·정렬·행 상한)
2. GET /api/system-logs/login-history/org/export.csv — org 로그인 이력 CSV(동일)
3. GET /api/system-logs — 조직 어드민, system_log 필터·정렬·페이징
4. GET /api/system-logs/login-history/me — 본인 로그인 이력(활성 세션)
5. GET /api/system-logs/login-history/org — 조직 어드민, 부서 트리 범위·정렬

[Dependencies]
=========
- fastapi (APIRouter, Depends, Query)
- Backend.admin_server.deps.require_org_admin, Backend.auth_server.deps.require_active_access
- Backend.core.dependencies.get_system_db
- Backend.system_log_server.audit_emit, service, service_login_history, schemas

조회·CSV 공통: `from`·`to` 가 모이면 기간 일수 상한 `MAX_HISTORY_FILTER_SPAN_DAYS`(약 3개월).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from Backend.admin_server.deps import require_org_admin
from Backend.auth_server.deps import require_active_access
from Backend.core.dependencies import get_system_db
from Backend.system_log_server import schemas
from Backend.system_log_server import audit_emit
from Backend.system_log_server import service
from Backend.system_log_server import service_login_history

router = APIRouter(prefix="/api/system-logs", tags=["system-logs"])

# 통합 이력·CSV: `from`·`to` 둘 다 있을 때 (종료일−시작일) 일수 상한(약 3개월).
MAX_HISTORY_FILTER_SPAN_DAYS = 92


def _validate_history_filter_date_range(from_dtm: date | None, to_dtm: date | None) -> None:
    """시작일·종료일이 모두 있을 때만 검사. 초과·역전 시 400."""
    if from_dtm is None or to_dtm is None:
        return
    if to_dtm < from_dtm:
        raise HTTPException(
            status_code=400,
            detail="종료일은 시작일 이후여야 합니다.",
        )
    if (to_dtm - from_dtm).days > MAX_HISTORY_FILTER_SPAN_DAYS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"조회 기간은 시작일~종료일 기준 최대 {MAX_HISTORY_FILTER_SPAN_DAYS}일(약 3개월)까지입니다. "
                "기간을 줄이거나 한쪽만 비워 주세요."
            ),
        )


def _csv_row_limit_http(exc: ValueError) -> HTTPException:
    s = str(exc)
    if s.startswith("CSV_EXPORT_ROW_LIMIT_EXCEEDED:"):
        parts = s.split(":")
        total = parts[1] if len(parts) > 1 else "?"
        limit = parts[2] if len(parts) > 2 else "?"
        return HTTPException(
            status_code=400,
            detail=(
                f"CSV는 최대 {limit}행까지입니다. 현재 조건에 해당하는 건수는 {total}건입니다. "
                "기간·키워드 등 필터를 좁힌 뒤 다시 시도하세요."
            ),
        )
    return HTTPException(status_code=400, detail="CSV보내기를 할 수 없습니다.")


# 1.
@router.get("/export.csv")
def export_system_logs_csv(
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
    user_key: str | None = Query(None),
    from_dtm: date | None = Query(None, alias="from"),
    to_dtm: date | None = Query(None, alias="to"),
    ip_contains: str | None = Query(None),
    channel: str | None = Query(None),
    action_kind: str | None = Query(None),
    success_yn: str | None = Query(None, min_length=1, max_length=1),
    sort_by: str | None = Query(
        None,
        description="create_dtm|system_log_id|channel|action_kind|success_yn|actor_user_id",
    ),
    sort_dir: str | None = Query(None, description="asc|desc"),
):
    _validate_history_filter_date_range(from_dtm, to_dtm)
    uid = int(actor.get("user_id") or 0)
    try:
        n, body = service.export_system_logs_csv_bytes(
            conn,
            actor,
            user_key=user_key,
            from_dtm=from_dtm,
            to_dtm=to_dtm,
            ip_contains=ip_contains,
            channel=channel,
            action_kind=action_kind,
            success_yn=success_yn,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except ValueError as e:
        raise _csv_row_limit_http(e) from e
    audit_emit.emit_csv_export_audit(
        uid,
        export_kind="system_log",
        row_count=n,
        detail_json={"channel": channel, "action_kind": action_kind},
    )
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="system_logs_export.csv"',
        },
    )


# 2.
@router.get("/login-history/org/export.csv")
def export_login_history_org_csv(
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
    user_key: str | None = Query(None),
    from_dtm: date | None = Query(None, alias="from"),
    to_dtm: date | None = Query(None, alias="to"),
    ip_contains: str | None = Query(None),
    sort_by: str | None = Query(
        None,
        description="create_dtm|user_login_log_id|login_success_yn|user_id|user_email",
    ),
    sort_dir: str | None = Query(None, description="asc|desc"),
):
    _validate_history_filter_date_range(from_dtm, to_dtm)
    uid = int(actor.get("user_id") or 0)
    try:
        n, body = service_login_history.export_login_history_org_csv_bytes(
            conn,
            actor,
            user_key=user_key,
            from_dtm=from_dtm,
            to_dtm=to_dtm,
            ip_contains=ip_contains,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except ValueError as e:
        raise _csv_row_limit_http(e) from e
    audit_emit.emit_csv_export_audit(
        uid,
        export_kind="login_history_org",
        row_count=n,
        detail_json={},
    )
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="login_history_export.csv"',
        },
    )


# 3.
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
    _validate_history_filter_date_range(from_dtm, to_dtm)
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


# 4.
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
    sort_by: str | None = Query(
        None,
        description="create_dtm|user_login_log_id|login_success_yn|user_id|user_email",
    ),
    sort_dir: str | None = Query(None, description="asc|desc"),
):
    _validate_history_filter_date_range(from_dtm, to_dtm)
    raw = service_login_history.list_login_history_org_paged(
        conn,
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    items = [schemas.LoginHistoryItemOut.model_validate(x) for x in raw["items"]]
    return schemas.LoginHistoryListOut(
        items=items,
        total=raw["total"],
        page=raw["page"],
        page_size=raw["page_size"],
    )


# 5.
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
    sort_by: str | None = Query(
        None,
        description="create_dtm|system_log_id|channel|action_kind|success_yn|actor_user_id",
    ),
    sort_dir: str | None = Query(None, description="asc|desc"),
):
    _validate_history_filter_date_range(from_dtm, to_dtm)
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
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    items = [schemas.SystemLogItemOut.model_validate(x) for x in raw["items"]]
    return schemas.SystemLogListOut(
        items=items,
        total=raw["total"],
        page=raw["page"],
        page_size=raw["page_size"],
    )
