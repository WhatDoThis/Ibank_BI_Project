"""
Backend.admin_server.service_projects (프로젝트·멤버)
================================================
부서 소유 프로젝트 CRUD, 멤버 추가 시 알림.

[Main Functions]
===========
1. default_manager_pmssn_master_id(pmssn_list 문자열·레거시 PK 정규화)
2. list_projects_in_dept / list_projects_for_participant / create_project_with_creator_member
3. update_project(동적 SET·active 변경 시 비활성 프로젝트 허용) / deactivate_project
4. list_members / add_member / update_member_role / remove_member(운영자는 U만)
5. validate_invite_user_project(초대 U·프로젝트·pmssn 정합 검증)

[Dependencies]
=========
- Backend.notification_server.service.insert_notification
- Backend.auth_server.permissions.resolve_pmssn_list_to_names
"""

from __future__ import annotations

from typing import Any

from Backend.auth_server import permissions as auth_permissions
from Backend.notification_server import service as notif_service


# 1.
def default_manager_pmssn_master_id(cur) -> int:
    cur.execute(
        """
        SELECT pmssn_master_id, pmssn_list, pmssn_name
        FROM pmssn_master
        WHERE COALESCE(system_dflt_yn,'') = 'Y' AND dptmt_info_id IS NULL
        ORDER BY pmssn_master_id
        """
    )
    rows = cur.fetchall()
    for r in rows:
        names = auth_permissions.resolve_pmssn_list_to_names(cur, r.get("pmssn_list") or [])
        pname = (r.get("pmssn_name") or "").strip()
        if "admin" in names or pname == "관리자":
            return int(r["pmssn_master_id"])
    raise ValueError("시스템 기본 관리자 역할(pmssn_master)이 없습니다. DB 시드를 확인하세요.")


def _assert_project_owned(cur, dptmt_info_id: int, project_info_id: int) -> None:
    cur.execute(
        "SELECT project_info_id, dptmt_info_id, active_yn FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if int(row["dptmt_info_id"]) != dptmt_info_id:
        raise ValueError("다른 부서의 프로젝트입니다.")
    if (row.get("active_yn") or "").upper() != "Y":
        raise ValueError("비활성 프로젝트에는 작업할 수 없습니다.")


def _assert_project_owned_allow_inactive(cur, dptmt_info_id: int, project_info_id: int) -> None:
    """active_yn 변경·비활성화 등 관리 작업용 — 비활성 프로젝트도 허용."""
    cur.execute(
        "SELECT project_info_id, dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if int(row["dptmt_info_id"]) != dptmt_info_id:
        raise ValueError("다른 부서의 프로젝트입니다.")


def _assert_pmssn_for_project(cur, project_info_id: int, pmssn_master_id: int) -> None:
    cur.execute(
        "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    prow = cur.fetchone()
    if not prow:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    pdpt = int(prow["dptmt_info_id"])
    cur.execute(
        """
        SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn
        FROM pmssn_master WHERE pmssn_master_id = %s
        """,
        (pmssn_master_id,),
    )
    mrow = cur.fetchone()
    if not mrow:
        raise ValueError("역할을 찾을 수 없습니다.")
    mdpt = mrow.get("dptmt_info_id")
    sysd = (mrow.get("system_dflt_yn") or "").upper() == "Y"
    if sysd and mdpt is None:
        return
    if mdpt is not None and int(mdpt) == pdpt:
        return
    raise ValueError("이 프로젝트에 부여할 수 없는 역할입니다.")


# 2.
def list_projects_in_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT project_info_id, dptmt_info_id, project_name, project_dscrtn, active_yn, create_dtm
            FROM project_info
            WHERE dptmt_info_id = %s
            ORDER BY project_name
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def list_projects_for_participant(
    conn, user_id: int, dptmt_info_id: int
) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pi.project_info_id, pi.dptmt_info_id, pi.project_name, pi.project_dscrtn,
                   pi.active_yn, pi.create_dtm
            FROM project_info pi
            INNER JOIN project_ptcpnt_info p
              ON p.project_info_id = pi.project_info_id AND p.ptcpnt_user_id = %s
            WHERE pi.dptmt_info_id = %s
            ORDER BY pi.project_name
            """,
            (user_id, dptmt_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def create_project_with_creator_member(
    conn,
    creator_user_id: int,
    dptmt_info_id: int,
    project_name: str,
    project_dscrtn: str | None,
) -> int:
    pname = (project_name or "").strip()
    if not pname:
        raise ValueError("프로젝트명이 필요합니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO project_info (
                dptmt_info_id, project_create_user_id, project_name, project_dscrtn, active_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, 'Y', NOW())
            RETURNING project_info_id
            """,
            (dptmt_info_id, creator_user_id, pname, project_dscrtn),
        )
        pid = int(cur.fetchone()["project_info_id"])
        mid = default_manager_pmssn_master_id(cur)
        cur.execute(
            """
            INSERT INTO project_ptcpnt_info (
                ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW())
            """,
            (creator_user_id, creator_user_id, pid, mid),
        )
        conn.commit()
        return pid
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 3.
def update_project(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    project_name: str | None,
    project_dscrtn: str | None,
    active_yn: str | None,
    actor_dvsn: str | None = None,
) -> None:
    cur = conn.cursor()
    try:
        if active_yn is not None:
            _assert_project_owned_allow_inactive(cur, dptmt_info_id, project_info_id)
        else:
            _assert_project_owned(cur, dptmt_info_id, project_info_id)

        if (actor_dvsn or "").strip().lower() == "operator" and active_yn is not None:
            raise ValueError("프로젝트 운영자는 활성 여부를 변경할 수 없습니다.")

        sets: list[str] = []
        params: list[Any] = []
        if project_name is not None:
            sets.append("project_name = %s")
            params.append((project_name or "").strip())
        if project_dscrtn is not None:
            sets.append("project_dscrtn = %s")
            params.append(project_dscrtn)
        if active_yn is not None:
            sets.append("active_yn = %s")
            params.append((active_yn or "")[:1])
        if not sets:
            conn.commit()
            return
        sets.append("update_dtm = NOW()")
        params.append(project_info_id)
        cur.execute(
            f"UPDATE project_info SET {', '.join(sets)} WHERE project_info_id = %s",
            params,
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def deactivate_project(conn, dptmt_info_id: int, project_info_id: int) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned_allow_inactive(cur, dptmt_info_id, project_info_id)
        cur.execute(
            "UPDATE project_info SET active_yn = 'N', update_dtm = NOW() WHERE project_info_id = %s",
            (project_info_id,),
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 4.
def list_members(conn, dptmt_info_id: int, project_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        cur.execute(
            """
            SELECT p.project_ptcpnt_info_id, p.ptcpnt_user_id, u.user_email, u.user_nickname,
                   p.pmssn_master_id, m.pmssn_name AS role_name, p.create_dtm
            FROM project_ptcpnt_info p
            JOIN user_info u ON u.user_id = p.ptcpnt_user_id
            JOIN pmssn_master m ON m.pmssn_master_id = p.pmssn_master_id
            WHERE p.project_info_id = %s
            ORDER BY u.user_email
            """,
            (project_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    except ValueError:
        raise
    finally:
        cur.close()


def add_member(
    conn,
    actor_user_id: int,
    dptmt_info_id: int,
    project_info_id: int,
    ptcpnt_user_id: int,
    pmssn_master_id: int,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        _assert_pmssn_for_project(cur, project_info_id, pmssn_master_id)
        cur.execute(
            "SELECT user_id FROM user_info WHERE user_id = %s",
            (ptcpnt_user_id,),
        )
        if not cur.fetchone():
            raise ValueError("사용자를 찾을 수 없습니다.")
        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (project_info_id, ptcpnt_user_id),
        )
        if cur.fetchone():
            raise ValueError("이미 프로젝트 멤버입니다.")
        cur.execute(
            """
            INSERT INTO project_ptcpnt_info (
                ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW())
            """,
            (ptcpnt_user_id, actor_user_id, project_info_id, pmssn_master_id),
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    cur2 = conn.cursor()
    try:
        cur2.execute(
            "SELECT project_name FROM project_info WHERE project_info_id = %s",
            (project_info_id,),
        )
        pn = (cur2.fetchone() or {}).get("project_name") or ""
    finally:
        cur2.close()
    try:
        notif_service.insert_notification(
            conn,
            ptcpnt_user_id,
            "project_invite",
            "프로젝트 초대",
            f"프로젝트 '{pn}'에 추가되었습니다.",
        )
    except Exception:
        pass


def update_member_role(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    ptcpnt_user_id: int,
    pmssn_master_id: int,
    actor_dvsn: str | None = None,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        _assert_pmssn_for_project(cur, project_info_id, pmssn_master_id)
        if (actor_dvsn or "").strip().lower() == "operator":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "user":
                raise ValueError(
                    "운영자는 일반 사용자(U)의 프로젝트 권한만 변경할 수 있습니다."
                )
        cur.execute(
            """
            UPDATE project_ptcpnt_info SET pmssn_master_id = %s, update_dtm = NOW()
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pmssn_master_id, project_info_id, ptcpnt_user_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("멤버를 찾을 수 없습니다.")
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def remove_member(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    ptcpnt_user_id: int,
    actor_dvsn: str | None = None,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        if (actor_dvsn or "").strip().lower() == "operator":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "user":
                raise ValueError(
                    "운영자는 일반 사용자(U)만 프로젝트에서 제외할 수 있습니다."
                )
        cur.execute(
            """
            DELETE FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (project_info_id, ptcpnt_user_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("멤버를 찾을 수 없습니다.")
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 5.
def validate_invite_user_project(
    conn,
    invite_dptmt_id: int,
    project_info_id: int,
    pmssn_master_id: int,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, invite_dptmt_id, project_info_id)
        _assert_pmssn_for_project(cur, project_info_id, pmssn_master_id)
    finally:
        cur.close()
