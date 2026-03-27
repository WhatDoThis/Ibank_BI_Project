"""
Backend.project_server.service (내 프로젝트 목록·조회)
================================================
project_ptcpnt_info 기준 목록. 프로젝트 선택은 auth_server.rotate_session_tokens_with_project 위임.

[Main Functions]
===========
1. list_projects_for_user: 참여 프로젝트 목록
2. select_project_tokens: 세션 유지하며 JWT에 project_info_id 반영

[Dependencies]
=========
- Backend.auth_server.service (rotate_session_tokens_with_project)
"""

from __future__ import annotations

from typing import Any

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
