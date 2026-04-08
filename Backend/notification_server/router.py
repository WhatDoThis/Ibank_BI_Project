"""
Backend.notification_server.router (/api/notifications)
=====================================================
내 알림 목록·안 읽은 수·읽음 처리.

[Endpoints]
===========
1. GET /api/notifications
2. GET /api/notifications/unread-count
3. PATCH /api/notifications/read-all
4. PATCH /api/notifications/{notification_info_id}/read

[Dependencies]
=========
- Backend.notification_server.service, Backend.auth_server.deps, Backend.core.dependencies
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from Backend.auth_server.deps import require_active_access
from Backend.core.dependencies import get_system_db
from Backend.notification_server import service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# 1.
@router.get("")
def notifications_list(
    limit: int = Query(50, ge=1, le=200),
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    return {"items": service.list_notifications(conn, uid, limit)}


# 2.
@router.get("/unread-count")
def notifications_unread_count(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    return {"count": service.count_unread(conn, uid)}


# 3.
@router.patch("/read-all")
def notifications_read_all(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    return {"updated": service.mark_read_all(conn, uid)}


# 4.
@router.patch("/{notification_info_id}/read")
def notifications_read_one(
    notification_info_id: int,
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    if not service.mark_read_one(conn, uid, notification_info_id):
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    return {"message": "읽음 처리되었습니다."}
