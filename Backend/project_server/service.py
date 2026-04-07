"""
Backend.project_server.service (내 프로젝트 목록·조회)
================================================
project_ptcpnt_info 기준 목록. 프로젝트 선택은 auth_server.rotate_session_tokens_with_project 위임.

[Main Functions]
===========
1. list_projects_for_user: 참여 프로젝트 목록
2. select_project_tokens: 세션 유지하며 JWT에 project_info_id 반영
3. accept_project_invite: 타부서 project_invite 알림 수락 → project_ptcpnt_info INSERT

[Dependencies]
=========
- Backend.auth_server.service (rotate_session_tokens_with_project)
- Backend.admin_server.service_projects._assert_pmssn_for_project
"""

from __future__ import annotations

import json
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


# 3.
def accept_project_invite(
    conn, user_id: int, project_info_id: int, notification_info_id: int
) -> None:
    """notification_info(noti_type=project_invite) 수락 후 멤버 등록."""
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
            raise ValueError("알림을 찾을 수 없습니다.")
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

        cur.execute(
            "SELECT active_yn FROM project_info WHERE project_info_id = %s",
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
            WHERE notification_info_id = %s
            """,
            (int(notification_info_id),),
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
