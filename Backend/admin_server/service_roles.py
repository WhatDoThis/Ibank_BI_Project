"""
Backend.admin_server.service_roles (부서 커스텀 프로젝트 권한)
==================================================
pmssn_master/pmssn_master_detail 기반 권한 옵션·목록·사용현황 조회와 커스텀 권한 생성·수정·삭제를 제공한다.
시스템 기본 권한은 수정·삭제 불가, 조회 스코프는 시스템 기본+본인 부서 커스텀으로 제한한다.
프로젝트 멤버에 배정된 커스텀 권한은 pmssn_list(상세 권한) 변경만 금지하고 권한명 변경은 허용한다.

[Main Functions]
===========
1. list_roles_for_dept(생성자 FK user_info JOIN·creator_email·create_dtm·update_dtm·집계 MAX)
2. list_permission_options_for_dept
3. list_role_usages(user_department_display)
4. list_role_project_participants(user_department_display)
5. list_user_role_usages(user_department_display·ptcpnt_user_id 반환)
6. create_custom_role — commit 후 `audit_emit.emit_admin_system_log`
7. update_custom_role — 사용 중(project_ptcpnt_info)이면 pmssn_list 변경만 거부(권한명은 허용)
8. delete_custom_role — 동일

[Dependencies]
=========
- Backend.admin_server.audit_emit.emit_admin_system_log
- Backend.admin_server.audit_sql_catalog
- (conn, SQL만)
"""

from __future__ import annotations

from typing import Any

from Backend.admin_server import audit_sql_catalog
from Backend.admin_server.audit_emit import emit_admin_system_log


def _pmssn_list_sorted_key(value: Any) -> tuple[str, ...]:
    """pmssn_list(text[] 등)를 순서 무관 비교용 튜플로 정규화한다."""
    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        items = [str(x).strip() for x in value if str(x).strip()]
        return tuple(sorted(items))
    if isinstance(value, str):
        parts = [p.strip() for p in value.replace(",", "\n").splitlines() if p.strip()]
        return tuple(sorted(parts)) if parts else ()
    s = str(value).strip()
    return (s,) if s else ()


def _user_department_display_from_join(
    dptmt_id: Any,
    dptmt_name: Any,
    parent_dptmt_id: Any,
    parent_dptmt_name: Any,
) -> str:
    """dptmt_info 기준: 최상위 부서는 이름(-), 하위는 상위(자기)."""
    if dptmt_id is None:
        return "—"
    dname = str(dptmt_name or "").strip() or "—"
    if parent_dptmt_id is None:
        return f"{dname}(-)"
    pname = str(parent_dptmt_name or "").strip() or "—"
    return f"{pname}({dname})"


def _attach_user_department_display(row: dict[str, Any]) -> None:
    row["user_department_display"] = _user_department_display_from_join(
        row.pop("user_dptmt_info_id", None),
        row.pop("user_dptmt_name", None),
        row.pop("user_parent_dptmt_info_id", None),
        row.pop("user_parent_dptmt_name", None),
    )


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
                pm.update_dtm,
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
                pm.update_dtm,
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
            raise ValueError("권한을 찾을 수 없습니다.")
        is_system_default = (
            (row.get("system_dflt_yn") or "").upper() == "Y"
            and row.get("dptmt_info_id") is None
        )
        is_dept_custom = int(row.get("dptmt_info_id") or 0) == dptmt_info_id
        if not is_system_default and not is_dept_custom:
            raise ValueError("접근할 수 없는 권한입니다.")
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
                u.user_email,
                u.dptmt_info_id AS user_dptmt_info_id,
                ud.dptmt_name AS user_dptmt_name,
                ud.parent_dptmt_info_id AS user_parent_dptmt_info_id,
                upd.dptmt_name AS user_parent_dptmt_name
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN user_info u
              ON u.user_id = pp.ptcpnt_user_id
            LEFT JOIN dptmt_info ud ON ud.dptmt_info_id = u.dptmt_info_id
            LEFT JOIN dptmt_info upd ON upd.dptmt_info_id = ud.parent_dptmt_info_id
            WHERE pp.pmssn_master_id = %s
              AND p.dptmt_info_id = %s
            ORDER BY
                p.project_name ASC,
                COALESCE(NULLIF(TRIM(u.user_nickname), ''), u.user_email) ASC,
                u.user_email ASC
            """,
            (pmssn_master_id, dptmt_info_id),
        )
        rows = [dict(r) for r in cur.fetchall()]
        for d in rows:
            _attach_user_department_display(d)
        return rows
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
                u.user_email,
                u.dptmt_info_id AS user_dptmt_info_id,
                ud.dptmt_name AS user_dptmt_name,
                ud.parent_dptmt_info_id AS user_parent_dptmt_info_id,
                upd.dptmt_name AS user_parent_dptmt_name
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN user_info u
              ON u.user_id = pp.ptcpnt_user_id
            LEFT JOIN dptmt_info ud ON ud.dptmt_info_id = u.dptmt_info_id
            LEFT JOIN dptmt_info upd ON upd.dptmt_info_id = ud.parent_dptmt_info_id
            WHERE pp.pmssn_master_id = %s
              AND pp.project_info_id = %s
            ORDER BY
                COALESCE(NULLIF(TRIM(u.user_nickname), ''), u.user_email) ASC,
                u.user_email ASC
            """,
            (pmssn_master_id, project_info_id),
        )
        rows = [dict(r) for r in cur.fetchall()]
        for d in rows:
            _attach_user_department_display(d)
        return rows
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
                pp.ptcpnt_user_id,
                pm.pmssn_master_id,
                pm.pmssn_name,
                u.dptmt_info_id AS user_dptmt_info_id,
                ud.dptmt_name AS user_dptmt_name,
                ud.parent_dptmt_info_id AS user_parent_dptmt_info_id,
                upd.dptmt_name AS user_parent_dptmt_name
            FROM project_ptcpnt_info pp
            JOIN project_info p
              ON p.project_info_id = pp.project_info_id
            JOIN pmssn_master pm
              ON pm.pmssn_master_id = pp.pmssn_master_id
            JOIN user_info u ON u.user_id = pp.ptcpnt_user_id
            LEFT JOIN dptmt_info ud ON ud.dptmt_info_id = u.dptmt_info_id
            LEFT JOIN dptmt_info upd ON upd.dptmt_info_id = ud.parent_dptmt_info_id
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
        rows = [dict(r) for r in cur.fetchall()]
        for d in rows:
            _attach_user_department_display(d)
        return rows
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
        raise ValueError("권한명이 필요합니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            audit_sql_catalog.SQL_PMSSN_MASTER_INSERT,
            (dptmt_info_id, name, pmssn_list or [], actor_user_id),
        )
        rid = int(cur.fetchone()["pmssn_master_id"])
        conn.commit()
        emit_admin_system_log(
            int(actor_user_id),
            business_action="role_create",
            action_kind="CREATE",
            detail_json={
                "pmssn_master_id": rid,
                "dptmt_info_id": int(dptmt_info_id),
            },
            risk_tier="MED",
        )
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
    *,
    actor_user_id: int | None = None,
) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn, pmssn_list
            FROM pmssn_master WHERE pmssn_master_id = %s
            """,
            (pmssn_master_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("권한을 찾을 수 없습니다.")
        if (row.get("system_dflt_yn") or "").upper() == "Y":
            raise ValueError("시스템 기본 권한은 수정할 수 없습니다.")
        if int(row["dptmt_info_id"] or 0) != dptmt_info_id:
            raise ValueError("다른 부서의 권한입니다.")
        if pmssn_list is not None:
            new_key = _pmssn_list_sorted_key(pmssn_list)
            old_key = _pmssn_list_sorted_key(row.get("pmssn_list"))
            if new_key != old_key:
                cur.execute(
                    "SELECT 1 FROM project_ptcpnt_info WHERE pmssn_master_id = %s LIMIT 1",
                    (pmssn_master_id,),
                )
                if cur.fetchone():
                    raise ValueError(
                        "프로젝트에 배정된 권한은 상세 권한 목록을 변경할 수 없습니다. "
                        "멤버에게 배정된 권한을 다른 권한으로 바꾼 뒤 수정하세요."
                    )
        if pmssn_name is not None:
            cur.execute(
                audit_sql_catalog.SQL_PMSSN_MASTER_UPDATE_NAME,
                ((pmssn_name or "").strip(), pmssn_master_id),
            )
        if pmssn_list is not None:
            cur.execute(
                audit_sql_catalog.SQL_PMSSN_MASTER_UPDATE_LIST,
                (pmssn_list, pmssn_master_id),
            )
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="role_update",
            detail_json={
                "pmssn_master_id": int(pmssn_master_id),
                "dptmt_info_id": int(dptmt_info_id),
                "x_pmssn_name": pmssn_name is not None,
                "x_pmssn_list": pmssn_list is not None,
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


# 8.
def delete_custom_role(
    conn,
    dptmt_info_id: int,
    pmssn_master_id: int,
    *,
    actor_user_id: int | None = None,
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
            raise ValueError("권한을 찾을 수 없습니다.")
        if (row.get("system_dflt_yn") or "").upper() == "Y":
            raise ValueError("시스템 기본 권한은 삭제할 수 없습니다.")
        if int(row["dptmt_info_id"] or 0) != dptmt_info_id:
            raise ValueError("다른 부서의 권한입니다.")
        cur.execute(
            "SELECT 1 FROM project_ptcpnt_info WHERE pmssn_master_id = %s LIMIT 1",
            (pmssn_master_id,),
        )
        if cur.fetchone():
            raise ValueError("프로젝트에서 사용 중인 권한은 삭제할 수 없습니다.")
        cur.execute(
            audit_sql_catalog.SQL_PMSSN_MASTER_DELETE,
            (pmssn_master_id,),
        )
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="role_delete",
            action_kind="DELETE",
            detail_json={
                "pmssn_master_id": int(pmssn_master_id),
                "dptmt_info_id": int(dptmt_info_id),
            },
            risk_tier="HIGH",
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
