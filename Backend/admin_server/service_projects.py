"""
Backend.admin_server.service_projects (프로젝트·멤버)
================================================
부서 소유 프로젝트 CRUD, 멤버 추가 시 알림.

[Main Functions]
===========
1. create_project_full — 단일 트랜잭션: project_info·table_project_mapping·생성자·부서 내 멤버·타부서 알림(project_invite JSON)
2. list_projects_in_dept / list_projects_for_participant(pmssn_master JOIN·creator_email)
3. update_project / deactivate_project
4. list_members / add_member / update_member_role / remove_member
5. validate_invite_user_project
6. _user_in_actor_dept_scope — 생성자 부서 트리 소속 여부

[Dependencies]
=========
- Backend.notification_server.service.insert_notification(add_member 경로만, create_project_full는 동일 conn 트랜잭션 내 raw INSERT)
- json
"""

from __future__ import annotations

import json
from typing import Any

from Backend.notification_server import service as notif_service


def _user_in_actor_dept_scope(cur, actor_dptmt_id: int, target_user_id: int) -> bool:
    """생성자 부서를 루트로 한 서브트리에 target_user가 속하는지(활성 사용자만)."""
    cur.execute(
        """
        SELECT u.user_id
        FROM user_info u
        INNER JOIN (
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id
                FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
            )
            SELECT dptmt_info_id FROM sub
        ) scope ON scope.dptmt_info_id = u.dptmt_info_id
        WHERE u.user_id = %s
          AND UPPER(TRIM(COALESCE(u.user_active_yn, 'Y'))) = 'Y'
        """,
        (int(actor_dptmt_id), int(target_user_id)),
    )
    return cur.fetchone() is not None


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
            SELECT pi.project_info_id, pi.dptmt_info_id, pi.project_name, pi.project_dscrtn, pi.active_yn,
                   pi.create_dtm, pi.project_create_user_id,
                   NULLIF(TRIM(u.user_email), '') AS creator_email
            FROM project_info pi
            LEFT JOIN user_info u ON u.user_id = pi.project_create_user_id
            WHERE pi.dptmt_info_id = %s
            ORDER BY pi.project_name
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
                   pi.active_yn, pi.create_dtm, pi.project_create_user_id,
                   NULLIF(TRIM(uc.user_email), '') AS creator_email,
                   m.pmssn_name AS role_name
            FROM project_info pi
            INNER JOIN project_ptcpnt_info p
              ON p.project_info_id = pi.project_info_id AND p.ptcpnt_user_id = %s
            LEFT JOIN pmssn_master m ON m.pmssn_master_id = p.pmssn_master_id
            LEFT JOIN user_info uc ON uc.user_id = pi.project_create_user_id
            WHERE pi.dptmt_info_id = %s
            ORDER BY pi.project_name
            """,
            (user_id, dptmt_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def create_project_full(
    conn,
    actor_user_id: int,
    actor_dptmt_id: int,
    project_name: str,
    project_dscrtn: str | None,
    creator_pmssn_master_id: int,
    table_master_ids: list[int] | None,
    members: list[dict[str, Any]] | None,
    external_invites: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """
    프로젝트 생성 + 테이블 매핑 + 부서 내 멤버 + 타부서 알림 초대를 단일 트랜잭션으로 처리한다.
    시스템 기본 pmssn 자동 배정 없음 — creator_pmssn_master_id 필수.
    """
    pname = (project_name or "").strip()
    if not pname:
        raise ValueError("프로젝트명이 필요합니다.")
    tid_list = list(dict.fromkeys(int(x) for x in (table_master_ids or []) if x is not None))
    mem_list = members or []
    ext_list = external_invites or []
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO project_info (
                dptmt_info_id, project_create_user_id, project_name, project_dscrtn, active_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, 'Y', NOW())
            RETURNING project_info_id
            """,
            (actor_dptmt_id, actor_user_id, pname, project_dscrtn),
        )
        pid = int(cur.fetchone()["project_info_id"])

        _assert_pmssn_for_project(cur, pid, int(creator_pmssn_master_id))

        cur.execute(
            """
            INSERT INTO project_ptcpnt_info (
                ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW())
            """,
            (actor_user_id, actor_user_id, pid, int(creator_pmssn_master_id)),
        )

        for tmid in tid_list:
            cur.execute(
                "SELECT 1 FROM table_master WHERE table_master_id = %s",
                (tmid,),
            )
            if not cur.fetchone():
                raise ValueError(f"테이블 마스터를 찾을 수 없습니다. (table_master_id={tmid})")
            cur.execute(
                """
                INSERT INTO table_project_mapping (project_info_id, table_master_id, create_dtm)
                SELECT %s, %s, NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM table_project_mapping
                    WHERE project_info_id = %s AND table_master_id = %s
                )
                """,
                (pid, tmid, pid, tmid),
            )

        members_added = 0
        seen_u: set[int] = {int(actor_user_id)}
        for m in mem_list:
            uid = int(m.get("user_id") or 0)
            mid = int(m.get("pmssn_master_id") or 0)
            if uid <= 0 or mid <= 0:
                raise ValueError("members 항목에 user_id와 pmssn_master_id가 필요합니다.")
            if uid in seen_u:
                continue
            if uid == actor_user_id:
                continue
            if not _user_in_actor_dept_scope(cur, actor_dptmt_id, uid):
                raise ValueError(f"부서 트리에 속하지 않는 사용자입니다. (user_id={uid})")
            _assert_pmssn_for_project(cur, pid, mid)
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info
                WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (pid, uid),
            )
            if cur.fetchone():
                raise ValueError(f"이미 멤버로 지정된 사용자입니다. (user_id={uid})")
            cur.execute(
                """
                INSERT INTO project_ptcpnt_info (
                    ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
                ) VALUES (%s, %s, %s, %s, NOW())
                """,
                (uid, actor_user_id, pid, mid),
            )
            members_added += 1
            seen_u.add(uid)

        invites_sent = 0
        for inv in ext_list:
            iuid = int(inv.get("user_id") or 0)
            imid = int(inv.get("pmssn_master_id") or 0)
            if iuid <= 0 or imid <= 0:
                raise ValueError("external_invites 항목에 user_id와 pmssn_master_id가 필요합니다.")
            if iuid == actor_user_id:
                raise ValueError("본인을 타부서 초대 대상으로 지정할 수 없습니다.")
            if iuid in seen_u:
                raise ValueError(f"이미 부서 내 멤버로 등록된 사용자입니다. (user_id={iuid})")
            if _user_in_actor_dept_scope(cur, actor_dptmt_id, iuid):
                raise ValueError(
                    "같은 부서 트리 소속은「부서 내 참여자」로 추가하세요. (user_id=%s)"
                    % iuid
                )
            cur.execute(
                "SELECT 1 FROM user_info WHERE user_id = %s AND UPPER(TRIM(COALESCE(user_active_yn,'Y'))) = 'Y'",
                (iuid,),
            )
            if not cur.fetchone():
                raise ValueError(f"초대 대상 사용자를 찾을 수 없거나 비활성입니다. (user_id={iuid})")
            _assert_pmssn_for_project(cur, pid, imid)
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (pid, iuid),
            )
            if cur.fetchone():
                raise ValueError("이미 프로젝트 멤버입니다.")
            payload = json.dumps(
                {
                    "project_info_id": pid,
                    "pmssn_master_id": imid,
                    "invite_user_id": actor_user_id,
                },
                ensure_ascii=False,
            )
            title = (f"'{pname}' 프로젝트에 초대되었습니다")[:200]
            cur.execute(
                """
                INSERT INTO notification_info (
                    user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
                ) VALUES (%s, %s, %s, %s, 'N', NOW())
                """,
                (
                    iuid,
                    "project_invite",
                    title,
                    payload,
                ),
            )
            invites_sent += 1

        conn.commit()
        return {
            "project_info_id": pid,
            "members_added": members_added,
            "invites_sent": invites_sent,
        }
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

        if (actor_dvsn or "").strip().lower() == "o" and active_yn is not None:
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
        if (actor_dvsn or "").strip().lower() == "o":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "u":
                raise ValueError(
                    "운영자는 일반 사용자(u)의 프로젝트 권한만 변경할 수 있습니다."
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
        if (actor_dvsn or "").strip().lower() == "o":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "u":
                raise ValueError(
                    "운영자는 일반 사용자(u)만 프로젝트에서 제외할 수 있습니다."
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
