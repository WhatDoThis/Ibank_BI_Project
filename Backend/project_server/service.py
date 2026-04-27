"""
Backend.project_server.service (내 프로젝트 목록·조회)
================================================
project_ptcpnt_info 기준 목록. 프로젝트 선택은 auth_server.rotate_session_tokens_with_project 위임.

[Main Functions]
===========
1. list_projects_for_user: 참여 프로젝트 목록
2. select_project_tokens: 세션 유지하며 JWT에 project_info_id 반영
3. accept_project_invite: `_parse_project_invite_payload` 검증 후 멤버 등록·초대 알림 DELETE(잔존 시 제거 후 초대중 오표시 방지)·알림 처리
4. reject_project_invite: 동일 검증 후 알림 삭제·초대자 알림
5. (system_log) 초대 수락·거절 commit 직후 `emit_project_log`(플래그 off 시 생략)

[Endpoints/Classes/Functions]
=======================
- list_projects_for_user(conn, user_id) -> list[dict]
- select_project_tokens(conn, user_id, session_log_id, project_info_id) -> dict
- accept_project_invite(conn, user_id, project_info_id, notification_info_id) -> None
- reject_project_invite(conn, user_id, project_info_id, notification_info_id) -> None
- (내부) _parse_project_invite_payload — 알림·만료 검증

[Dependencies]
=========
- Backend.auth_server.service (rotate_session_tokens_with_project)
- Backend.admin_server.service_projects._assert_pmssn_for_project
- Backend.notification_server.service (insert_notification, fetch_notification_by_id,
  delete_notification_by_id_in_txn, notify_inviter_project_invite_resolved)
- Backend.core.invite_expiry.invite_expired_from_payload
- Backend.project_server.audit_emit.emit_project_log
- Backend.core.change_tracker (초대 수락 시 `project_ptcpnt_info` track_insert)
"""

from __future__ import annotations

import json
from typing import Any

from Backend.admin_server.service_projects import _assert_pmssn_for_project
from Backend.auth_server import service as auth_service
from Backend.core.invite_expiry import invite_expired_from_payload
from Backend.notification_server.service import (
    delete_notification_by_id_in_txn,
    fetch_notification_by_id,
    insert_notification,
    notify_inviter_project_invite_resolved,
)
from Backend.core.change_tracker import track_insert
from Backend.project_server.audit_emit import emit_project_log


# 1.
def list_projects_for_user(conn, user_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                p.project_info_id,
                p.project_name,
                p.project_dscrtn,
                p.active_yn,
                m.pmssn_master_id,
                m.pmssn_name AS role_name
            FROM project_ptcpnt_info ppt
            JOIN project_info p ON p.project_info_id = ppt.project_info_id
            JOIN pmssn_master m ON m.pmssn_master_id = ppt.pmssn_master_id
            WHERE ppt.ptcpnt_user_id = %s
              AND (p.active_yn IS NULL OR UPPER(TRIM(p.active_yn)) = 'Y')
            ORDER BY p.project_name
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        cur.close()


# 2.
def select_project_tokens(
    conn, user_id: int, session_log_id: int, project_info_id: int
) -> dict[str, Any]:
    return auth_service.rotate_session_tokens_with_project(
        conn, user_id, session_log_id, project_info_id
    )


def _parse_project_invite_payload(
    conn,
    notification_info_id: int,
    user_id: int,
    expected_project_info_id: int,
    *,
    action_label: str,
    expired_message: str,
) -> dict[str, Any]:
    """알림 단건·타입·소유자·JSON·project_info_id 일치·만료까지 검증 후 payload 반환."""
    nid = int(notification_info_id)
    uid = int(user_id)
    exp_pid = int(expected_project_info_id)
    noti = fetch_notification_by_id(conn, nid)
    if not noti:
        raise ValueError(
            "이 초대는 취소되었거나 이미 처리되었습니다. 관리자에게 새 초대를 요청하세요."
        )
    if (noti.get("noti_type") or "").strip() != "project_invite":
        raise ValueError("프로젝트 초대 알림이 아닙니다.")
    if int(noti["user_id"]) != uid:
        raise ValueError(f"본인의 알림만 {action_label}할 수 있습니다.")
    try:
        payload = json.loads(noti["noti_content"] or "{}")
    except json.JSONDecodeError as e:
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
    try:
        pid = int(payload["project_info_id"])
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
    if pid != exp_pid:
        raise ValueError("알림과 프로젝트가 일치하지 않습니다.")
    if invite_expired_from_payload(payload):
        raise ValueError(expired_message)
    return payload


# 3.
def accept_project_invite(
    conn, user_id: int, project_info_id: int, notification_info_id: int
) -> None:
    """notification_info(noti_type=project_invite) 수락 후 멤버 등록·초대자 알림."""
    cur = conn.cursor()
    try:
        payload = _parse_project_invite_payload(
            conn,
            int(notification_info_id),
            int(user_id),
            int(project_info_id),
            action_label="수락",
            expired_message=(
                "초대 유효 기간이 지났습니다. 관리자에게 새 초대를 요청하세요."
            ),
        )
        try:
            pid = int(payload["project_info_id"])
            mid = int(payload["pmssn_master_id"])
            inv_uid = int(payload["invite_user_id"])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError("알림 내용이 올바르지 않습니다.") from e

        cur.execute(
            "SELECT active_yn, project_name FROM project_info WHERE project_info_id = %s",
            (pid,),
        )
        prow = cur.fetchone()
        if not prow:
            raise ValueError("프로젝트를 찾을 수 없습니다.")
        if (prow.get("active_yn") or "").upper() != "Y":
            raise ValueError("비활성 프로젝트에는 참여할 수 없습니다.")

        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, user_id),
        )
        if cur.fetchone():
            raise ValueError("이미 프로젝트 멤버입니다.")

        _assert_pmssn_for_project(cur, pid, mid)

        cur.execute(
            """
            INSERT INTO project_ptcpnt_info (
                ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW())
            """,
            (user_id, inv_uid, pid, mid),
        )
        cur.execute(
            """
            SELECT project_ptcpnt_info_id FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, user_id),
        )
        pp_ins = cur.fetchone()
        if pp_ins and pp_ins.get("project_ptcpnt_info_id") is not None:
            track_insert(
                conn,
                "project_ptcpnt_info",
                "project_ptcpnt_info_id",
                int(pp_ins["project_ptcpnt_info_id"]),
                actor_user_id=int(user_id),
                project_info_id=int(pid),
                channel="project",
            )
        nid = int(notification_info_id)
        notify_inviter_project_invite_resolved(
            conn,
            inv_uid,
            pid,
            user_id,
            nid,
            True,
            autocommit=False,
        )
        if delete_notification_by_id_in_txn(conn, nid) == 0:
            conn.rollback()
            raise ValueError("초대 알림을 삭제하지 못했습니다.")
        pname_join = (prow.get("project_name") if prow else None) or ""
        pn_display = (str(pname_join).strip() or "프로젝트")[:80]
        title_self = (f"'{pn_display}' 프로젝트 참여가 완료되었습니다")[:200]
        meta_self = json.dumps({"project_info_id": int(pid)}, ensure_ascii=False)
        insert_notification(
            conn,
            int(user_id),
            "project_join_done",
            title_self,
            meta_self,
            autocommit=False,
        )
        conn.commit()
        emit_project_log(
            int(user_id),
            business_action="invite_accept",
            action_kind="UPDATE",
            detail_json={
                "project_info_id": int(pid),
                "notification_info_id": int(nid),
            },
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 4.
def reject_project_invite(
    conn, user_id: int, project_info_id: int, notification_info_id: int
) -> None:
    """미수락 project_invite 알림 삭제 후 초대자에게 거절 알림."""
    cur = conn.cursor()
    nid = int(notification_info_id)
    try:
        payload = _parse_project_invite_payload(
            conn,
            nid,
            int(user_id),
            int(project_info_id),
            action_label="거절",
            expired_message=(
                "초대 유효 기간이 지났습니다. 알림은 삭제하거나 관리자에게 문의하세요."
            ),
        )
        try:
            pid = int(payload["project_info_id"])
            inv_uid = int(payload["invite_user_id"])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError("알림 내용이 올바르지 않습니다.") from e

        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, user_id),
        )
        if cur.fetchone():
            raise ValueError("이미 프로젝트 멤버입니다. 초대 알림을 닫아 주세요.")

        if delete_notification_by_id_in_txn(conn, nid) == 0:
            conn.rollback()
            raise ValueError("초대 알림을 삭제하지 못했습니다.")
        notify_inviter_project_invite_resolved(
            conn, inv_uid, pid, user_id, nid, False, autocommit=False
        )
        conn.commit()
        emit_project_log(
            int(user_id),
            business_action="invite_reject",
            action_kind="UPDATE",
            detail_json={
                "project_info_id": int(pid),
                "notification_info_id": int(nid),
            },
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
