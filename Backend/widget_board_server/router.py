"""
widget_board_server.router (/api/widget-boards)
===============================================
위젯 보드 CRUD·레이아웃·공유·위젯 데이터. 라우터 단 `Depends(require_permission("widgetboard"))` 는 main.py include 시 부착.

[Endpoints]
===========
1. GET /api/widget-boards
2. POST /api/widget-boards
3. GET /api/widget-boards/{board_id}
4. PATCH /api/widget-boards/{board_id}
5. DELETE /api/widget-boards/{board_id} (비활성 보드만 물리 삭제)
6. POST /api/widget-boards/{board_id}/widgets
7. PATCH /api/widget-boards/{board_id}/widgets/{widget_id}
8. DELETE /api/widget-boards/{board_id}/widgets/{widget_id}
9. PATCH /api/widget-boards/{board_id}/layout
10. POST /api/widget-boards/{board_id}/invite-notifications, accept-invite, reject-invite
11. POST /api/widget-boards/{board_id}/share
12. DELETE /api/widget-boards/{board_id}/share/{shared_user_id}
13. GET /api/widget-boards/{board_id}/participants
14. GET /api/widget-boards/{board_id}/invite-candidates
15. POST /api/widget-boards/{board_id}/widgets/{widget_id}/data

[Dependencies]
=========
- fastapi, Backend.auth_server.permissions.require_permission
- Backend.core.dependencies.get_system_db
- Backend.widget_board_server.service, schemas
"""

from fastapi import APIRouter, Depends, HTTPException

from Backend.auth_server.permissions import require_permission
from Backend.core.dependencies import get_system_db
from Backend.widget_board_server import schemas, service

router = APIRouter(prefix="/api/widget-boards", tags=["widget-boards"])


def _uid(payload: dict) -> int:
    return int(payload["user_id"])


def _pid(payload: dict) -> int:
    raw = payload.get("project_info_id")
    if raw is None:
        raise HTTPException(status_code=403, detail="프로젝트를 선택해주세요")
    return int(raw)


def _map(e: ValueError) -> HTTPException:
    msg = str(e)
    if "찾을 수 없" in msg or "권한" in msg or "허용되지 않" in msg or "지원하지 않" in msg:
        if "찾을 수 없" in msg:
            return HTTPException(status_code=404, detail=msg)
        return HTTPException(status_code=403, detail=msg)
    return HTTPException(status_code=400, detail=msg)


# 1.
@router.get("")
def wb_list(
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return {"items": service.list_boards(conn, _uid(payload), _pid(payload))}
    except ValueError as e:
        raise _map(e) from e


# 2.
@router.post("")
def wb_create(
    body: schemas.WidgetBoardCreateBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.create_board(conn, _uid(payload), _pid(payload), body)
    except ValueError as e:
        raise _map(e) from e


# 3.
@router.get("/{board_id}")
def wb_get(
    board_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.get_board_detail(conn, _uid(payload), _pid(payload), board_id)
    except ValueError as e:
        raise _map(e) from e


# 3b.
@router.get("/{board_id}/participants")
def wb_participants(
    board_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.list_board_participants(conn, _uid(payload), _pid(payload), board_id)
    except ValueError as e:
        raise _map(e) from e


# 3c.
@router.get("/{board_id}/invite-candidates")
def wb_invite_candidates(
    board_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.list_invite_candidates(conn, _uid(payload), _pid(payload), board_id)
    except ValueError as e:
        raise _map(e) from e


# 4.
@router.patch("/{board_id}")
def wb_patch(
    board_id: int,
    body: schemas.WidgetBoardPatchBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.patch_board(conn, _uid(payload), _pid(payload), board_id, body)
    except ValueError as e:
        raise _map(e) from e


# 5.
@router.delete("/{board_id}")
def wb_delete(
    board_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.delete_board(conn, _uid(payload), _pid(payload), board_id)
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 6.
@router.post("/{board_id}/widgets")
def wb_add_widget(
    board_id: int,
    body: schemas.WidgetItemCreateBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.add_widget(conn, _uid(payload), _pid(payload), board_id, body)
    except ValueError as e:
        raise _map(e) from e


# 7.
@router.patch("/{board_id}/widgets/{widget_id}")
def wb_patch_widget(
    board_id: int,
    widget_id: int,
    body: schemas.WidgetItemPatchBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.patch_widget(conn, _uid(payload), _pid(payload), board_id, widget_id, body)
    except ValueError as e:
        raise _map(e) from e


# 8.
@router.delete("/{board_id}/widgets/{widget_id}")
def wb_delete_widget(
    board_id: int,
    widget_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.delete_widget(conn, _uid(payload), _pid(payload), board_id, widget_id)
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 9.
@router.patch("/{board_id}/layout")
def wb_patch_layout(
    board_id: int,
    body: schemas.LayoutPatchBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.patch_layout(conn, _uid(payload), _pid(payload), board_id, body)
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 9b.
@router.post("/{board_id}/invite-notifications")
def wb_invite_notifications(
    board_id: int,
    body: schemas.WidgetBoardInviteBatchBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.send_invite_notifications(
            conn, _uid(payload), _pid(payload), board_id, body
        )
    except ValueError as e:
        raise _map(e) from e


# 9c.
@router.post("/{board_id}/accept-invite")
def wb_accept_invite(
    board_id: int,
    body: schemas.WidgetBoardInviteResolveBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.accept_widget_board_invite(
            conn,
            _uid(payload),
            _pid(payload),
            board_id,
            int(body.notification_info_id),
        )
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 9d.
@router.post("/{board_id}/reject-invite")
def wb_reject_invite(
    board_id: int,
    body: schemas.WidgetBoardInviteResolveBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.reject_widget_board_invite(
            conn,
            _uid(payload),
            _pid(payload),
            board_id,
            int(body.notification_info_id),
        )
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 10.
@router.post("/{board_id}/share")
def wb_share_upsert(
    board_id: int,
    body: schemas.ShareUpsertBody,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.upsert_share(conn, _uid(payload), _pid(payload), board_id, body)
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 11.
@router.delete("/{board_id}/share/{shared_user_id}")
def wb_share_delete(
    board_id: int,
    shared_user_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        service.delete_share(conn, _uid(payload), _pid(payload), board_id, shared_user_id)
        return {"ok": True}
    except ValueError as e:
        raise _map(e) from e


# 12.
@router.post("/{board_id}/widgets/{widget_id}/data")
def wb_widget_data(
    board_id: int,
    widget_id: int,
    payload: dict = Depends(require_permission("widgetboard")),
    conn=Depends(get_system_db),
):
    try:
        return service.fetch_widget_data(conn, _uid(payload), _pid(payload), board_id, widget_id)
    except ValueError as e:
        raise _map(e) from e
