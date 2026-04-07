"""
Backend.admin_server.service_tables (테이블 마스터·프로젝트 매핑)
==============================================================
table_master 전사 목록/수정과 project별 table_project_mapping 관리 로직.

[Main Functions]
===========
1. list_table_master(project_create 정렬: dash 우선·update_dtm·table_name)
2. update_table_master
3. list_project_tables
4. add_project_table_mapping
5. delete_project_table_mapping

[Endpoints/Classes/Functions]
=======================
- GET /api/admin/tables
- PATCH /api/admin/tables/{table_master_id}
- GET /api/admin/projects/{id}/tables
- POST /api/admin/projects/{id}/tables
- DELETE /api/admin/projects/{id}/tables/{table_master_id}

[Dependencies]
=========
- typing.Any
- system_db tables: project_info, table_master, table_project_mapping
"""

from __future__ import annotations

from typing import Any


def _normalize_db_type(db_type: str | None) -> str | None:
    if db_type is None:
        return None
    norm = str(db_type).strip().lower()
    if not norm:
        return None
    if norm not in ("main", "dash"):
        raise ValueError("db_type은 main, dash 중 하나여야 합니다.")
    return norm


def _assert_project_owned(cur, dptmt_info_id: int, project_info_id: int) -> None:
    cur.execute(
        """
        SELECT project_info_id, dptmt_info_id
        FROM project_info
        WHERE project_info_id = %s
        """,
        (project_info_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if int(row["dptmt_info_id"]) != int(dptmt_info_id):
        raise ValueError("다른 부서의 프로젝트입니다.")


# 1.
def list_table_master(
    conn,
    db_type: str | None = None,
    q: str | None = None,
    limit: int = 300,
    sort_mode: str | None = None,
) -> list[dict[str, Any]]:
    dbt = _normalize_db_type(db_type)
    term = (q or "").strip()
    sm = (sort_mode or "").strip().lower()
    project_create = sm in ("project_create", "project-create")
    lim = max(1, min(int(limit), 2000 if project_create else 1000))
    sql = """
        SELECT table_master_id, db_type, table_name, table_label, table_dscrtn,
               create_dtm, update_dtm, create_user_id
        FROM table_master
        WHERE 1=1
    """
    params: list[Any] = []
    if dbt is not None:
        sql += " AND LOWER(TRIM(COALESCE(db_type,''))) = %s"
        params.append(dbt)
    if term:
        like_term = f"%{term}%"
        sql += """
            AND (
                LOWER(COALESCE(table_name,'')) LIKE LOWER(%s)
                OR LOWER(COALESCE(table_label,'')) LIKE LOWER(%s)
            )
        """
        params.extend([like_term, like_term])
    if project_create:
        sql += """
            ORDER BY
                CASE WHEN LOWER(TRIM(COALESCE(db_type,''))) = 'dash' THEN 0 ELSE 1 END,
                update_dtm DESC NULLS LAST,
                table_name ASC
            LIMIT %s
        """
    else:
        sql += " ORDER BY db_type, table_name LIMIT %s"
    params.append(lim)

    cur = conn.cursor()
    try:
        cur.execute(sql, tuple(params))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 2.
def update_table_master(
    conn,
    table_master_id: int,
    table_label: str | None,
    table_dscrtn: str | None,
) -> None:
    if table_label is None and table_dscrtn is None:
        raise ValueError("수정할 값이 없습니다.")

    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT table_master_id FROM table_master WHERE table_master_id = %s",
            (table_master_id,),
        )
        if not cur.fetchone():
            raise ValueError("테이블 마스터를 찾을 수 없습니다.")

        if table_label is not None:
            cur.execute(
                """
                UPDATE table_master
                SET table_label = %s, update_dtm = NOW()
                WHERE table_master_id = %s
                """,
                (table_label, table_master_id),
            )
        if table_dscrtn is not None:
            cur.execute(
                """
                UPDATE table_master
                SET table_dscrtn = %s, update_dtm = NOW()
                WHERE table_master_id = %s
                """,
                (table_dscrtn, table_master_id),
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


# 3.
def list_project_tables(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    db_type: str | None = None,
) -> list[dict[str, Any]]:
    dbt = _normalize_db_type(db_type)
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        sql = """
            SELECT m.table_master_id, m.db_type, m.table_name, m.table_label, m.table_dscrtn,
                   m.create_user_id, mp.table_project_mapping_id, mp.create_dtm AS mapping_create_dtm
            FROM table_project_mapping mp
            JOIN table_master m ON m.table_master_id = mp.table_master_id
            WHERE mp.project_info_id = %s
        """
        params: list[Any] = [project_info_id]
        if dbt is not None:
            sql += " AND LOWER(TRIM(COALESCE(m.db_type,''))) = %s"
            params.append(dbt)
        sql += " ORDER BY m.db_type, m.table_name"
        cur.execute(sql, tuple(params))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 4.
def add_project_table_mapping(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    table_master_id: int,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        cur.execute(
            "SELECT table_master_id FROM table_master WHERE table_master_id = %s",
            (table_master_id,),
        )
        if not cur.fetchone():
            raise ValueError("테이블 마스터를 찾을 수 없습니다.")

        cur.execute(
            """
            SELECT 1
            FROM table_project_mapping
            WHERE project_info_id = %s AND table_master_id = %s
            """,
            (project_info_id, table_master_id),
        )
        if cur.fetchone():
            raise ValueError("이미 매핑된 테이블입니다.")

        cur.execute(
            """
            INSERT INTO table_project_mapping (project_info_id, table_master_id, create_dtm)
            VALUES (%s, %s, NOW())
            """,
            (project_info_id, table_master_id),
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


# 5.
def delete_project_table_mapping(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    table_master_id: int,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        cur.execute(
            """
            DELETE FROM table_project_mapping
            WHERE project_info_id = %s AND table_master_id = %s
            """,
            (project_info_id, table_master_id),
        )
        if cur.rowcount == 0:
            raise ValueError("매핑 정보를 찾을 수 없습니다.")
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
