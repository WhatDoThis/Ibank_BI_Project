"""
Backend.admin_server.service_roles (부서 커스텀 역할)
==================================================
pmssn_master/pmssn_master_detail 기반 역할·권한 옵션 조회와 역할 사용현황/생성·수정·삭제를 제공한다.
시스템 기본 역할은 수정·삭제 불가, 조회 스코프는 시스템 기본+본인 부서 커스텀으로 제한한다.

[Main Functions]
===========
1. list_roles_for_dept(생성자 FK user_info JOIN·creator_email·집계 MAX)
2. list_permission_options_for_dept
3. list_role_usages
4. list_role_project_participants
5. list_user_role_usages
6. create_custom_role
7. update_custom_role
8. delete_custom_role

[Dependencies]
=========
- (conn, SQL만)
"""

from __future__ import annotations

from typing import Any


# 1.
def list_roles_for_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                pm.pmssn_master_id,
                pm.dptmt_info_id,
                pm.pmssn_name,
                pm.pmssn_list,
                pm.system_dflt_yn,
                pm.create_dtm,
                pm.user_id AS creator_user_id,
                COUNT(pp.project_ptcpnt_info_id)::int AS usage_count,
                MAX(NULLIF(TRIM(uc.user_email), '')) AS creator_email
            FROM pmssn_master pm
            LEFT JOIN project_ptcpnt_info pp
              ON pp.pmssn_master_id = pm.pmssn_master_id
            LEFT JOIN user_info uc ON uc.user_id = pm.user_id
            WHERE (
                    COALESCE(pm.system_dflt_yn,'') = 'Y'
                AND pm.dptmt_info_id IS NULL
            ) OR pm.dptmt_info_id = %s
            GROUP BY
                pm.pmssn_master_id,
                pm.dptmt_info_id,
                pm.pmssn_name,
                pm.pmssn_list,
                pm.system_dflt_yn,
                pm.create_dtm,
                pm.user_id
            ORDER BY pm.system_dflt_yn DESC, pm.pmssn_name
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 2.
def list_permission_options_for_dept(conn, dptmt_info_id: int) -> list[str]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT DISTINCT pmd.pmssn_detail_name AS permission_item
            FROM pmssn_master_detail pmd
            WHERE TRIM(COALESCE(pmd.pmssn_detail_name, '')) <> ''
            ORDER BY permission_item ASC
            """
        )
        return [str(r["permission_item"]) for r in cur.fetchall() if r.get("permission_item")]
    finally:
        cur.close()


def _assert_accessible_role(conn, dptmt_info_id: int, pmssn_master_id: int) -> dict[str, Any]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn
            FROM pmssn_master
            WHERE pmssn_master_id = %s
            """,
            (pmssn_master_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("권한(역할)을 찾을 수 없습니다.")
        is_system_default = (
            (row.get("system_dflt_yn") or "").upper() == "Y"
            and row.get("dptmt_info_id") is None
        )
        is_dept_custom = int(row.get("dptmt_info_id") or 0) == dptmt_info_id
        if not is_system_default and not is_dept_custom:
            raise ValueError("접근할 수 없는 권한(역할)입니다.")
        return dict(row)
    finally:
        cur.close()


# 3.
def list_role_usages(conn, dptmt_info_id: int, pmssn_master_id: int) -> list[dict[str, Any]]:
    _assert_accessible_role(conn, dptmt_info_id, pmssn_master_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                p.project_info_id,
                p.project_name,
                pp.ptcpnt_user_id,
                u.user_nickname,
                u.user_email
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN user_info u
              ON u.user_id = pp.ptcpnt_user_id
            WHERE pp.pmssn_master_id = %s
              AND p.dptmt_info_id = %s
            ORDER BY
                p.project_name ASC,
                COALESCE(NULLIF(TRIM(u.user_nickname), ''), u.user_email) ASC,
                u.user_email ASC
            """,
            (pmssn_master_id, dptmt_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 4.
def list_role_project_participants(
    conn,
    dptmt_info_id: int,
    pmssn_master_id: int,
    project_info_id: int,
) -> list[dict[str, Any]]:
    _assert_accessible_role(conn, dptmt_info_id, pmssn_master_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1
            FROM project_info
            WHERE project_info_id = %s
              AND dptmt_info_id = %s
            """,
            (project_info_id, dptmt_info_id),
        )
        if not cur.fetchone():
            raise ValueError("접근할 수 없는 프로젝트입니다.")
        cur.execute(
            """
            SELECT
                pp.project_info_id,
                p.project_name,
                pp.ptcpnt_user_id,
                u.user_nickname,
                u.user_email
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN user_info u
              ON u.user_id = pp.ptcpnt_user_id
            WHERE pp.pmssn_master_id = %s
              AND pp.project_info_id = %s
            ORDER BY
                COALESCE(NULLIF(TRIM(u.user_nickname), ''), u.user_email) ASC,
                u.user_email ASC
            """,
            (pmssn_master_id, project_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 5.
def list_user_role_usages(conn, dptmt_info_id: int, user_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                p.project_info_id,
                p.project_name,
                pm.pmssn_master_id,
                pm.pmssn_name
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN pmssn_master pm
              ON pm.pmssn_master_id = pp.pmssn_master_id
            WHERE pp.ptcpnt_user_id = %s
              AND p.dptmt_info_id = %s
              AND (
                    (
                        COALESCE(pm.system_dflt_yn,'') = 'Y'
                    AND pm.dptmt_info_id IS NULL
                    )
                    OR pm.dptmt_info_id = %s
                  )
            ORDER BY p.project_name ASC
            """,
            (user_id, dptmt_info_id, dptmt_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 6.
def create_custom_role(
    conn,
    actor_user_id: int,
    dptmt_info_id: int,
    pmssn_name: str,
    pmssn_list: list[str],
) -> int:
    name = (pmssn_name or "").strip()
    if not name:
        raise ValueError("역할명이 필요합니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO pmssn_master (
                dptmt_info_id, pmssn_name, pmssn_list, system_dflt_yn, user_id, create_dtm
            ) VALUES (%s, %s, %s, 'N', %s, NOW())
            RETURNING pmssn_master_id
            """,
            (dptmt_info_id, name, pmssn_list or [], actor_user_id),
        )
        rid = int(cur.fetchone()["pmssn_master_id"])
        conn.commit()
        return rid
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 7.
def update_custom_role(
    conn,
    dptmt_info_id: int,
    pmssn_master_id: int,
    pmssn_name: str | None,
    pmssn_list: list[str] | None,
) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn
            FROM pmssn_master WHERE pmssn_master_id = %s
            """,
            (pmssn_master_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("역할을 찾을 수 없습니다.")
        if (row.get("system_dflt_yn") or "").upper() == "Y":
            raise ValueError("시스템 기본 역할은 수정할 수 없습니다.")
        if int(row["dptmt_info_id"] or 0) != dptmt_info_id:
            raise ValueError("다른 부서의 역할입니다.")
        if pmssn_name is not None:
            cur.execute(
                "UPDATE pmssn_master SET pmssn_name = %s, update_dtm = NOW() WHERE pmssn_master_id = %s",
                ((pmssn_name or "").strip(), pmssn_master_id),
            )
        if pmssn_list is not None:
            cur.execute(
                "UPDATE pmssn_master SET pmssn_list = %s, update_dtm = NOW() WHERE pmssn_master_id = %s",
                (pmssn_list, pmssn_master_id),
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


# 8.
def delete_custom_role(conn, dptmt_info_id: int, pmssn_master_id: int) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn
            FROM pmssn_master WHERE pmssn_master_id = %s
            """,
            (pmssn_master_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("역할을 찾을 수 없습니다.")
        if (row.get("system_dflt_yn") or "").upper() == "Y":
            raise ValueError("시스템 기본 역할은 삭제할 수 없습니다.")
        if int(row["dptmt_info_id"] or 0) != dptmt_info_id:
            raise ValueError("다른 부서의 역할입니다.")
        cur.execute(
            "SELECT 1 FROM project_ptcpnt_info WHERE pmssn_master_id = %s LIMIT 1",
            (pmssn_master_id,),
        )
        if cur.fetchone():
            raise ValueError("프로젝트에서 사용 중인 역할은 삭제할 수 없습니다.")
        cur.execute("DELETE FROM pmssn_master WHERE pmssn_master_id = %s", (pmssn_master_id,))
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
