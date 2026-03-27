"""
Backend.project_server.router (/api/projects)
============================================
로그인 사용자의 프로젝트 목록·프로젝트 선택(토큰 재발급).

[Endpoints]
===========
1. GET /api/projects
2. POST /api/projects/{project_info_id}/select

[Dependencies]
=========
- Backend.project_server.service, Backend.auth_server.deps, Backend.core.dependencies
"""

from fastapi import APIRouter, Depends, HTTPException

from Backend.auth_server.deps import get_access_payload
from Backend.core.dependencies import get_system_db
from Backend.project_server import service

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _map_val(e: ValueError) -> HTTPException:
    msg = str(e)
    if "찾을 수 없" in msg or "만료" in msg:
        return HTTPException(status_code=401, detail=msg)
    if "참여하지 않" in msg:
        return HTTPException(status_code=403, detail=msg)
    return HTTPException(status_code=400, detail=msg)


# 1.
@router.get("")
def projects_list(
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    return {"items": service.list_projects_for_user(conn, uid)}


# 2.
@router.post("/{project_info_id}/select")
def projects_select(
    project_info_id: int,
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    sid = payload.get("session_log_id")
    if sid is None:
        raise HTTPException(status_code=401, detail="세션 정보가 없습니다. 다시 로그인하세요.")
    try:
        return service.select_project_tokens(conn, uid, int(sid), project_info_id)
    except ValueError as e:
        raise _map_val(e) from e
