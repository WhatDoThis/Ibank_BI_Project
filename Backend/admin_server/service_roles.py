"""
Backend.admin_server.service_roles (부서 커스텀 역할)
==================================================
pmssn_master 조회·생성·수정·삭제. 시스템 기본 역할은 수정·삭제 불가.

[Main Functions]
===========
1. list_roles_for_dept
2. create_custom_role
3. update_custom_role
4. delete_custom_role

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
            SELECT pmssn_master_id, dptmt_info_id, pmssn_name, pmssn_list, system_dflt_yn, create_dtm
            FROM pmssn_master
            WHERE (COALESCE(system_dflt_yn,'') = 'Y' AND dptmt_info_id IS NULL)
               OR dptmt_info_id = %s
            ORDER BY system_dflt_yn DESC, pmssn_name
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 2.
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


# 3.
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


# 4.
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
