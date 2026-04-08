"""
Backend.project_server.service (내 프로젝트 목록·조회)
================================================
project_ptcpnt_info 기준 목록. 프로젝트 선택은 auth_server.rotate_session_tokens_with_project 위임.

[Main Functions]
===========
1. list_projects_for_user: 참여 프로젝트 목록
2. select_project_tokens: 세션 유지하며 JWT에 project_info_id 반영
3. accept_project_invite: 타부서 project_invite 수락(만료 검사·알림 read_yn/update_dtm·초대자 알림·수락자 본인 참여 완료 알림)
4. reject_project_invite: 타부서 project_invite 거절(알림 삭제·초대자 알림)

[Dependencies]
=========
- Backend.auth_server.service (rotate_session_tokens_with_project)
- Backend.admin_server.service_projects._assert_pmssn_for_project
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from Backend.admin_server.service_projects import _assert_pmssn_for_project
from Backend.auth_server import service as auth_service


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


def _invite_expired_from_payload(payload: dict[str, Any]) -> bool:
    raw = payload.get("invite_expires_at")
    if raw is None or raw == "":
        return False
    try:
        s = str(raw).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > dt
    except (ValueError, TypeError, OSError):
        return False


def _notify_inviter_invite_resolved(
    cur,
    inviter_user_id: int,
    project_info_id: int,
    invitee_user_id: int,
    resolved_notification_id: int,
    accepted: bool,
) -> None:
    if not inviter_user_id or inviter_user_id <= 0:
        return
    cur.execute(
        "SELECT project_name FROM project_info WHERE project_info_id = %s",
        (int(project_info_id),),
    )
    pnrow = cur.fetchone()
    pname = (pnrow.get("project_name") if pnrow else None) or "프로젝트"
    cur.execute(
        "SELECT user_email, user_nickname FROM user_info WHERE user_id = %s",
        (int(invitee_user_id),),
    )
    urow = cur.fetchone()
    em = (urow.get("user_email") if urow else None) or ""
    nk = (urow.get("user_nickname") if urow else None) or ""
    who = (
        (str(nk).strip() if nk else "")
        or (str(em).strip() if em else "")
        or f"user_id {invitee_user_id}"
    )
    if accepted:
        typ = "project_invite_accepted"
        title = f"{who} 님이 '{pname}' 초대를 수락했습니다"
    else:
        typ = "project_invite_rejected"
        title = f"{who} 님이 '{pname}' 초대를 거절했습니다"
    meta = json.dumps(
        {
            "project_info_id": int(project_info_id),
            "invitee_user_id": int(invitee_user_id),
            "resolved_notification_info_id": int(resolved_notification_id),
        },
        ensure_ascii=False,
    )
    cur.execute(
        """
        INSERT INTO notification_info (
            user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
        ) VALUES (%s, %s, %s, %s, 'N', NOW())
        """,
        (int(inviter_user_id), typ[:30], title[:200], meta),
    )


# 3.
def accept_project_invite(
    conn, user_id: int, project_info_id: int, notification_info_id: int
) -> None:
    """notification_info(noti_type=project_invite) 수락 후 멤버 등록·초대자 알림."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT noti_content, noti_type, user_id AS target_uid
            FROM notification_info
            WHERE notification_info_id = %s
            """,
            (int(notification_info_id),),
        )
        noti = cur.fetchone()
        if not noti:
            raise ValueError(
                "이 초대는 취소되었거나 이미 처리되었습니다. 관리자에게 새 초대를 요청하세요."
            )
        if (noti.get("noti_type") or "").strip() != "project_invite":
            raise ValueError("프로젝트 초대 알림이 아닙니다.")
        if int(noti["target_uid"]) != int(user_id):
            raise ValueError("본인의 알림만 수락할 수 있습니다.")

        payload = json.loads(noti["noti_content"] or "{}")
        pid = int(payload["project_info_id"])
        mid = int(payload["pmssn_master_id"])
        inv_uid = int(payload["invite_user_id"])
        if pid != int(project_info_id):
            raise ValueError("알림과 프로젝트가 일치하지 않습니다.")

        if _invite_expired_from_payload(payload):
            raise ValueError(
                "초대 유효 기간이 지났습니다. 관리자에게 새 초대를 요청하세요."
            )

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
            UPDATE notification_info
            SET read_yn = 'Y', update_dtm = NOW()
            WHERE notification_info_id = %s AND user_id = %s
            """,
            (int(notification_info_id), int(user_id)),
        )
        _notify_inviter_invite_resolved(
            cur,
            inv_uid,
            pid,
            user_id,
            int(notification_info_id),
            True,
        )
        pname_join = (prow.get("project_name") if prow else None) or ""
        pn_display = (str(pname_join).strip() or "프로젝트")[:80]
        title_self = (f"'{pn_display}' 프로젝트 참여가 완료되었습니다")[:200]
        meta_self = json.dumps({"project_info_id": int(pid)}, ensure_ascii=False)
        cur.execute(
            """
            INSERT INTO notification_info (
                user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, 'N', NOW())
            """,
            (int(user_id), "project_join_done", title_self, meta_self),
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except json.JSONDecodeError as e:
        conn.rollback()
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
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
        cur.execute(
            """
            SELECT noti_content, noti_type, user_id AS target_uid
            FROM notification_info
            WHERE notification_info_id = %s
            """,
            (nid,),
        )
        noti = cur.fetchone()
        if not noti:
            raise ValueError(
                "이 초대는 취소되었거나 이미 처리되었습니다. 관리자에게 새 초대를 요청하세요."
            )
        if (noti.get("noti_type") or "").strip() != "project_invite":
            raise ValueError("프로젝트 초대 알림이 아닙니다.")
        if int(noti["target_uid"]) != int(user_id):
            raise ValueError("본인의 알림만 거절할 수 있습니다.")

        payload = json.loads(noti["noti_content"] or "{}")
        pid = int(payload["project_info_id"])
        inv_uid = int(payload["invite_user_id"])
        if pid != int(project_info_id):
            raise ValueError("알림과 프로젝트가 일치하지 않습니다.")

        if _invite_expired_from_payload(payload):
            raise ValueError(
                "초대 유효 기간이 지났습니다. 알림은 삭제하거나 관리자에게 문의하세요."
            )

        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, user_id),
        )
        if cur.fetchone():
            raise ValueError("이미 프로젝트 멤버입니다. 초대 알림을 닫아 주세요.")

        cur.execute(
            "DELETE FROM notification_info WHERE notification_info_id = %s",
            (nid,),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("초대 알림을 삭제하지 못했습니다.")
        _notify_inviter_invite_resolved(
            cur, inv_uid, pid, user_id, nid, False
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except json.JSONDecodeError as e:
        conn.rollback()
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
