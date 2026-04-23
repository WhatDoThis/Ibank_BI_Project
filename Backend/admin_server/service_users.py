"""
Backend.admin_server.service_users (유저·초대·부서)
================================================
동일 부서 유저 목록, 전역 검색, 초대, 정지/활성, 조직 역할(슈퍼), 초대코드 목록, org.
초대 메일 링크는 auth_config.get_app_url() + `/signup`; 공개 베이스는 smtp_info.app_url·backend.app_url·frontend.app_url 중 설정(환경별·localhost 고정 없음).

[Main Functions]
===========
1. list_users_same_dept(단순 동일 부서)
1b. list_users_for_admin_ui(sa_dev 전역·부서명/정렬·ETL 목록용)
1c. list_users_dept_tree_for_project_create(프로젝트 생성 모달·본인 제외·부서 트리·정렬)
2. search_users_by_email (operator 시 동일 부서만; 전역 검색 시 exclude_dptmt_zero 로 개발부서 0번 제외)
3. invite_user_by_email (초대 조직 역할·부서 트리·ETL·U+프로젝트, 초대 메일에 부서·조직 역할·프로젝트 권한 명시, UndefinedColumn 시 DDL 안내)
3b. assert_invite_dptmt_allowed / list_departments_for_invite(코드 배치·#3 이후 단조 번호)
3c. _invite_org_role_label_ko / _fetch_invite_email_labels (초대 메일 본문용 부서·프로젝트·권한 템플릿명)
4. suspend_user / activate_user / delete_inactive_user — commit 후 `audit_emit.emit_admin_system_log`(플래그 on 시); 정지·삭제 경로는 `ownership_guards`(409)·`project_invite_rows` 등과 연동
5. set_user_dvsn_admin_user — 동일 계측(actor_user_id)
6. set_user_etl_flag — 동일 계측
7. list_invite_codes_for_dept
8. get_department / update_department_name — commit 후 `emit_admin_system_log`(dept_update)
9. list_departments_for_org_settings(기본 정렬 update_dtm DESC); 이어서 update_department_in_org_settings·delete_department_in_org_settings·create_department(동일 부서 설정 흐름, `# 9.`는 목록 API)
10. _assert_department_clear_for_invalidate_or_remove — use_yn=N·DELETE 전 dptmt_info_id 참조(하위 부서·유저·초대·프로젝트·부서 커스텀 권한) 검사
11. get_user_work_assets — 생성·참여·초대자(invite_user_id) 프로젝트 참여, 커스텀 권한, 등록 부서, table_master·etl_db·연쇄 안내
12. list_table_master_transfer_targets — 테이블 마스터 이관 후보(본문 순서상 `list_ownership_*`보다 먼저 정의)
12a. list_ownership_transfer_targets — 이관 수신(일반: sa_dev·sa·a, 동일 부서 수직 트리·SA→sa_dev 제외)
12b. list_department_creator_transfer_targets — 부서 생성자 이관 수신(sa·sa_dev만)
13. transfer_resource_ownership — project·project_invite(project_ptcpnt_info)·pmssn_master·table_master·dptmt_creator·ETL 메타 이관 — 성공 시 `ownership_transfer` 계측
14. get_user_change_options — 부서·역할·ETL·프로젝트 옵션·`user_dvsn_options`·`projects[].pmssn_options`·`project_department_display`(SA 마지막 1인 경고 등)
15. update_user_management — 부서·조직 역할·ETL·프로젝트 참여·권한 배정 일괄 반영(등록 부서 소유는 ownership_guards·409·조직 역할 u 시 etl_yn N 등 검증)

[Endpoints/Classes/Functions]
=======================
- HTTP 라우터 없음. `Backend.admin_server.router`의 `/api/admin/users*` 등이 본 모듈 `# 1.`~`# 15.`(및 `1b` 등) 진입 함수를 호출한다. 시그니처·키워드 인자는 각 `def` 선언이 정본이다.

[Dependencies]
=========
- secrets, logging, psycopg2.errors(UndefinedColumn → 안내용 ValueError)
- Backend.admin_server.change_notify
- Backend.mail (send_invite_email), Backend.core.auth_config
- Backend.core.user_dvsn_codes.canon_user_dvsn
- Backend.core.db (get_db_connection_etl, get_system_table_schema)
- Backend.admin_server.audit_emit (`emit_admin_system_log` → `append_system_log`)
- Backend.admin_server.audit_sql_catalog (관리 DML 공용 SQL 템플릿·ETL 이관 UPDATE 문자열)
- (ETL 메타 조회용 로컬 헬퍼 _admin_etl_q, _admin_etl_table_columns_lower, _admin_etl_select_cols — etl_server 패키지 import 회피)
- Backend.admin_server.service_projects.validate_invite_user_project
- Backend.auth_server.permissions (get_effective_permission_ids_for_me, is_project_participant)
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

import psycopg2.errors

from Backend.admin_server import audit_sql_catalog
from Backend.admin_server import change_notify
from Backend.admin_server import service_projects
from Backend.admin_server.audit_emit import emit_admin_system_log as _emit_admin_system_log
from Backend.admin_server.ownership_guards import (
    ManagementBlockedError,
    build_ownership_violation_payload,
)
from Backend.mail import send_invite_email
from Backend.auth_server.permissions import (
    get_effective_permission_ids_for_me,
    is_project_participant,
)
from Backend.core import auth_config
from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex
from Backend.core import db as core_db
from Backend.core.user_dvsn_codes import canon_user_dvsn

_log = logging.getLogger(__name__)

_INVITE_TARGETS_BY_ACTOR: dict[str, tuple[str, ...]] = {
    "sa_dev": ("sa", "a", "o", "u"),
    "sa": ("sa", "a", "o", "u"),
    "a": ("a", "o", "u"),
}

# 초대 메일 본문용 invite_target_dvsn 한글 표기
_INVITE_DVSN_LABEL_KO: dict[str, str] = {
    "sa": "슈퍼관리자 (SA)",
    "a": "관리자 (A)",
    "o": "오퍼레이터 (O)",
    "u": "일반 사용자 (U)",
}

# 프로젝트·부서 커스텀 권한 생성자 이관 허용 수신자(05 문서: 프로젝트/권한 생성 가능 조직 역할)
_OWNERSHIP_TRANSFER_ELIGIBLE: frozenset[str] = frozenset({"sa_dev", "sa", "a"})
_DVSN_RANK: dict[str, int] = {"u": 1, "o": 2, "a": 3, "sa": 4, "sa_dev": 5}

# ETL 메타(etl_db) create_user_id 이관 — resource_type 키
_ETL_TRANSFER_TYPES: frozenset[str] = frozenset(
    {
        "etl_connection",
        "etl_table",
        "etl_job",
        "etl_storage_connection",
        "batch_folder_connection",
        "batch_job",
    }
)


def _etl_schema_name() -> str:
    return core_db.get_system_table_schema()


def _admin_etl_q(schema_name: str, table_name: str) -> str:
    return f'"{schema_name}"."{table_name}"'


def _admin_etl_table_columns_lower(cur: Any, schema_name: str, table_name: str) -> set:
    """information_schema 기준 컬럼명 소문자 집합(etl_server.service와 동일 취지, 순환 import 방지)."""
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema_name, table_name),
    )
    rows = cur.fetchall()
    out: set[str] = set()
    for row in rows:
        if isinstance(row, dict):
            out.add(str(row.get("column_name", "")).lower())
        else:
            out.add(str(row[0]).lower())
    return out


def _etl_select_owned_exists(
    cur: Any,
    schema: str,
    table: str,
    uid: int,
) -> bool:
    cols = _admin_etl_table_columns_lower(cur, schema, table)
    if "create_user_id" not in cols:
        return False
    cur.execute(
        f"SELECT 1 FROM {_admin_etl_q(schema, table)} WHERE create_user_id = %s LIMIT 1",
        (uid,),
    )
    return cur.fetchone() is not None


def _etl_user_has_any_owned(etl_conn: Any, schema: str, uid: int) -> bool:
    cur = etl_conn.cursor()
    try:
        checks = [
            ("etl_connections", "connection_id"),
            ("etl_tables", "etl_table_id"),
            ("etl_jobs", "job_id"),
            ("etl_storage_connections", "storage_connection_id"),
            ("batch_folder_connections", "folder_connection_id"),
            ("batch_jobs", "batch_job_id"),
        ]
        for tbl, _pk in checks:
            try:
                if _etl_select_owned_exists(cur, schema, tbl, uid):
                    return True
            except Exception:
                continue
        return False
    finally:
        cur.close()


def _row_to_etl_item(row: dict[str, Any], kind: str) -> dict[str, Any]:
    d = {**dict(row), "transferable": True, "kind": kind}
    if "dptmt_info_id" not in d:
        d["dptmt_info_id"] = None
    if d.get("active_yn") is None and "is_active" in d:
        d["active_yn"] = "Y" if d.get("is_active") else "N"
    return d


def _admin_etl_select_cols(tcols: set[str], base_cols: list[str]) -> str:
    """SELECT 목록: base_cols + 테이블에 is_active가 있을 때만 is_active."""
    parts = list(base_cols)
    if "is_active" in tcols:
        parts.append("is_active")
    return ", ".join(parts)


def _fetch_etl_work_blocks(etl_conn: Any, schema: str, uid: int) -> dict[str, list[dict[str, Any]]]:
    """etl_db에서 create_user_id 기준 등록 건만 조회(컬럼 없으면 스킵). is_active는 테이블에 있을 때만 SELECT."""
    out: dict[str, list[dict[str, Any]]] = {
        "etl_connections": [],
        "etl_tables": [],
        "etl_jobs": [],
        "etl_storage_connections": [],
        "batch_folder_connections": [],
        "batch_jobs": [],
    }
    cur = etl_conn.cursor()
    try:
        t = "etl_connections"
        tcols_ec = _admin_etl_table_columns_lower(cur, schema, t)
        if "create_user_id" in tcols_ec:
            cur.execute(
                f"""
                SELECT {_admin_etl_select_cols(tcols_ec, ["connection_id", "connection_name"])}
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY connection_name
                """,
                (uid,),
            )
            out["etl_connections"] = [
                _row_to_etl_item(dict(r), "etl_connection") for r in cur.fetchall()
            ]
        t = "etl_tables"
        tcols_tb = _admin_etl_table_columns_lower(cur, schema, t)
        if "create_user_id" in tcols_tb:
            cur.execute(
                f"""
                SELECT {_admin_etl_select_cols(tcols_tb, ["etl_table_id", "source_table", "target_table", "storage_connection_id"])}
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY target_table, source_table
                """,
                (uid,),
            )
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                src = (d.get("source_table") or "").strip()
                tgt = (d.get("target_table") or "").strip()
                d["label"] = f"{tgt or src}" + (f" ← {src}" if src and tgt != src else "")
                rows.append(_row_to_etl_item(d, "etl_table"))
            out["etl_tables"] = rows
        t = "etl_jobs"
        if "create_user_id" in _admin_etl_table_columns_lower(cur, schema, t):
            cur.execute(
                f"""
                SELECT job_id, etl_table_id, status, created_at
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY created_at DESC NULLS LAST, job_id DESC
                LIMIT 200
                """,
                (uid,),
            )
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                st = (d.get("status") or "").strip()
                d["label"] = f"job #{d.get('job_id')} · {st}" if st else f"job #{d.get('job_id')}"
                rows.append(_row_to_etl_item(d, "etl_job"))
            out["etl_jobs"] = rows
        t = "etl_storage_connections"
        tcols_sc = _admin_etl_table_columns_lower(cur, schema, t)
        if "create_user_id" in tcols_sc:
            cur.execute(
                f"""
                SELECT {_admin_etl_select_cols(tcols_sc, ["storage_connection_id", "connection_name"])}
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY connection_name
                """,
                (uid,),
            )
            out["etl_storage_connections"] = [
                _row_to_etl_item(dict(r), "etl_storage_connection") for r in cur.fetchall()
            ]
        t = "batch_folder_connections"
        tcols_fc = _admin_etl_table_columns_lower(cur, schema, t)
        if "create_user_id" in tcols_fc:
            cur.execute(
                f"""
                SELECT {_admin_etl_select_cols(tcols_fc, ["folder_connection_id", "connection_name"])}
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY connection_name
                """,
                (uid,),
            )
            out["batch_folder_connections"] = [
                _row_to_etl_item(dict(r), "batch_folder_connection") for r in cur.fetchall()
            ]
        t = "batch_jobs"
        tcols_bj = _admin_etl_table_columns_lower(cur, schema, t)
        if "create_user_id" in tcols_bj:
            bj_base = ["batch_job_id", "etl_table_id", "job_name", "created_at"]
            if "created_at" not in tcols_bj:
                bj_base = ["batch_job_id", "etl_table_id", "job_name"]
            cur.execute(
                f"""
                SELECT {_admin_etl_select_cols(tcols_bj, bj_base)}
                FROM {_admin_etl_q(schema, t)}
                WHERE create_user_id = %s
                ORDER BY job_name
                LIMIT 200
                """,
                (uid,),
            )
            out["batch_jobs"] = [
                _row_to_etl_item(dict(r), "batch_job") for r in cur.fetchall()
            ]
    finally:
        cur.close()
    return out


def _flat_etl_blocks_for_ownership_guard(
    etl_blocks: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """ETL 작업물 블록 → 이관 API resource_type·resource_id·표시 이름."""
    out: list[dict[str, Any]] = []
    for r in etl_blocks.get("etl_connections") or []:
        d = dict(r)
        cid = d.get("connection_id")
        if cid is None:
            continue
        out.append(
            {
                "resource_type": "etl_connection",
                "resource_id": int(cid),
                "name": str(d.get("connection_name") or cid),
            }
        )
    for r in etl_blocks.get("etl_tables") or []:
        d = dict(r)
        tid = d.get("etl_table_id")
        if tid is None:
            continue
        out.append(
            {
                "resource_type": "etl_table",
                "resource_id": int(tid),
                "name": str(d.get("label") or tid),
            }
        )
    for r in etl_blocks.get("etl_jobs") or []:
        d = dict(r)
        jid = d.get("job_id")
        if jid is None:
            continue
        out.append(
            {
                "resource_type": "etl_job",
                "resource_id": int(jid),
                "name": str(d.get("label") or jid),
            }
        )
    for r in etl_blocks.get("etl_storage_connections") or []:
        d = dict(r)
        sid = d.get("storage_connection_id")
        if sid is None:
            continue
        out.append(
            {
                "resource_type": "etl_storage_connection",
                "resource_id": int(sid),
                "name": str(d.get("connection_name") or sid),
            }
        )
    for r in etl_blocks.get("batch_folder_connections") or []:
        d = dict(r)
        fid = d.get("folder_connection_id")
        if fid is None:
            continue
        out.append(
            {
                "resource_type": "batch_folder_connection",
                "resource_id": int(fid),
                "name": str(d.get("connection_name") or fid),
            }
        )
    for r in etl_blocks.get("batch_jobs") or []:
        d = dict(r)
        bid = d.get("batch_job_id")
        if bid is None:
            continue
        out.append(
            {
                "resource_type": "batch_job",
                "resource_id": int(bid),
                "name": str(d.get("job_name") or bid),
            }
        )
    return out


def _collect_system_owned_for_guard(cur, uid: int) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """스마트 소유 검사용 프로젝트·pmssn·table_master·등록 부서·초대자·위젯보드 소유 목록."""
    u = int(uid)
    cur.execute(
        """
        SELECT project_info_id, project_name
        FROM project_info
        WHERE project_create_user_id = %s
        ORDER BY project_name
        """,
        (u,),
    )
    projects = [dict(r) for r in cur.fetchall()]
    cur.execute(
        """
        SELECT pmssn_master_id, pmssn_name
        FROM pmssn_master
        WHERE user_id = %s AND COALESCE(system_dflt_yn, '') <> 'Y'
        ORDER BY pmssn_name
        """,
        (u,),
    )
    pmssn = [dict(r) for r in cur.fetchall()]
    table_masters: list[dict[str, Any]] = []
    try:
        cur.execute(
            """
            SELECT table_master_id,
                   COALESCE(
                       NULLIF(TRIM(COALESCE(table_label, '')), ''),
                       NULLIF(TRIM(COALESCE(table_name, '')), ''),
                       'table_master'
                   ) AS display_name
            FROM table_master
            WHERE create_user_id IS NOT NULL AND create_user_id = %s
            ORDER BY db_type, table_name
            """,
            (u,),
        )
        table_masters = [dict(r) for r in cur.fetchall()]
    except (psycopg2.errors.UndefinedColumn, Exception) as ex:
        _log.warning("admin_user ownership_guard table_master_scan uid=%s: %s", u, ex)
    cur.execute(
        """
        SELECT dptmt_info_id,
               COALESCE(NULLIF(TRIM(COALESCE(dptmt_name, '')), ''), '부서') AS display_name
        FROM dptmt_info
        WHERE dptmt_create_user_id = %s AND dptmt_info_id <> 0
        ORDER BY dptmt_name NULLS LAST
        """,
        (u,),
    )
    departments = [dict(r) for r in cur.fetchall()]
    cur.execute(
        """
        SELECT pp.project_ptcpnt_info_id,
               COALESCE(NULLIF(TRIM(pi.project_name), ''), '프로젝트') AS project_name,
               COALESCE(NULLIF(TRIM(pu.user_email), ''), '') AS ptcpnt_user_email
        FROM project_ptcpnt_info pp
        JOIN project_info pi ON pi.project_info_id = pp.project_info_id
        JOIN user_info pu ON pu.user_id = pp.ptcpnt_user_id
        WHERE pp.invite_user_id = %s
          AND pp.ptcpnt_user_id <> %s
        ORDER BY pi.project_name NULLS LAST, pp.project_ptcpnt_info_id
        """,
        (u, u),
    )
    project_invites = [dict(r) for r in cur.fetchall()]
    widget_boards: list[dict[str, Any]] = []
    try:
        cur.execute(
            """
            SELECT wb.widget_board_id,
                   COALESCE(NULLIF(TRIM(COALESCE(wb.board_name, '')), ''), '위젯 보드') AS display_name
            FROM widget_board wb
            WHERE wb.owner_user_id = %s
            ORDER BY wb.board_name NULLS LAST
            """,
            (u,),
        )
        widget_boards = [dict(r) for r in cur.fetchall()]
    except Exception as ex:
        _log.warning("admin_user ownership_guard widget_board_scan uid=%s: %s", u, ex)
    return projects, pmssn, table_masters, departments, project_invites, widget_boards


def _collect_etl_flat_for_guard(uid: int) -> list[dict[str, Any]]:
    etl_conn = None
    try:
        etl_conn = core_db.get_db_connection_etl()
        blocks = _fetch_etl_work_blocks(etl_conn, _etl_schema_name(), int(uid))
        return _flat_etl_blocks_for_ownership_guard(blocks)
    except Exception as ex:
        _log.warning("admin_user ownership_guard etl_scan uid=%s: %s", uid, ex)
        return []
    finally:
        if etl_conn is not None:
            try:
                etl_conn.close()
            except Exception:
                pass


def _evaluate_ownership_target_or_raise(
    conn,
    uid: int,
    eff_dvsn: str,
    eff_etl: str,
    *,
    for_suspend: bool,
) -> None:
    """목표 조직 역할·ETL(또는 정지) 기준 소유 불가 시 ManagementBlockedError."""
    cur = conn.cursor()
    try:
        projects, pmssn, tms, departments, project_invites, widget_boards = (
            _collect_system_owned_for_guard(cur, int(uid))
        )
    finally:
        cur.close()
    etl_items = _collect_etl_flat_for_guard(int(uid))
    payload = build_ownership_violation_payload(
        new_dvsn=eff_dvsn,
        new_etl_yn=eff_etl,
        for_suspend=for_suspend,
        projects=projects,
        custom_pmssn=pmssn,
        table_masters=tms,
        departments=departments,
        etl_items=etl_items,
        project_invite_rows=project_invites,
        widget_boards=widget_boards,
    )
    if not payload["changeable"]:
        raise ManagementBlockedError(payload)


def _assert_etl_infra_recipient(
    conn, to_row: dict[str, Any], from_user_dptmt: int
) -> None:
    """ETL 등록자 이관 수신: 소유자 부서와 동일 PK 또는 상·하위 부서 트리, 활성, etl_yn=Y 또는 sa_dev."""
    if (to_row.get("ua") or "") != "Y":
        raise ValueError("비활성 사용자에게는 이관할 수 없습니다.")
    to_dpt = int(to_row["dptmt_info_id"])
    if not _dptmt_same_vertical_branch(conn, int(from_user_dptmt), to_dpt):
        raise ValueError(
            "ETL 등록 건은 동일 부서 또는 상·하위 부서 사용자에게만 이관할 수 있습니다."
        )
    td = canon_user_dvsn(to_row.get("user_dvsn"))
    etl_yn = (to_row.get("etl_yn") or "").strip().upper()
    if etl_yn != "Y" and td != "sa_dev":
        raise ValueError(
            "ETL 이관 대상은 ETL 관리자 자격(etl_yn=Y)이 있거나 SA_DEV 조직 역할이어야 합니다."
        )


def _transfer_etl_resource(
    rt: str,
    resource_id: int,
    from_uid: int,
    to_uid: int,
) -> str | None:
    schema = _etl_schema_name()
    mapping = {
        "etl_connection": ("etl_connections", "connection_id", "updated_at"),
        "etl_table": ("etl_tables", "etl_table_id", "updated_at"),
        "etl_job": ("etl_jobs", "job_id", None),
        "etl_storage_connection": (
            "etl_storage_connections",
            "storage_connection_id",
            "updated_at",
        ),
        "batch_folder_connection": (
            "batch_folder_connections",
            "folder_connection_id",
            "updated_at",
        ),
        "batch_job": ("batch_jobs", "batch_job_id", "updated_at"),
    }
    if rt not in mapping:
        raise ValueError("지원하지 않는 ETL 리소스 유형입니다.")
    table, pk_col, ts_col = mapping[rt]
    rid = int(resource_id)
    etl_conn = core_db.get_db_connection_etl()
    cur = etl_conn.cursor()
    try:
        cols = _admin_etl_table_columns_lower(cur, schema, table)
        if "create_user_id" not in cols:
            raise ValueError("DB에 create_user_id 컬럼이 없어 ETL 이관을 할 수 없습니다.")
        cur.execute(
            f"SELECT create_user_id FROM {_admin_etl_q(schema, table)} WHERE {pk_col} = %s",
            (rid,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("리소스를 찾을 수 없습니다.")
        if int(row["create_user_id"]) != int(from_uid):
            raise ValueError("해당 사용자가 등록자가 아닌 항목입니다.")
        ts_set = ""
        if ts_col and ts_col in cols:
            ts_set = f", {ts_col} = NOW()"
        q_tbl = _admin_etl_q(schema, table)
        sql = audit_sql_catalog.sql_etl_transfer_update_statement(q_tbl, pk_col, ts_set)
        cur.execute(
            sql,
            (to_uid, rid, from_uid),
        )
        if cur.rowcount == 0:
            etl_conn.rollback()
            raise ValueError("ETL 이관 반영에 실패했습니다.")
        etl_conn.commit()
        return compute_sql_fingerprint_hex(sql)
    except ValueError:
        etl_conn.rollback()
        raise
    except Exception:
        etl_conn.rollback()
        raise
    finally:
        cur.close()
        etl_conn.close()


def _table_master_is_etl_managed_match(
    table_db_type: str,
    table_name: str,
    etl_table_row: dict[str, Any],
) -> bool:
    tgt = str(etl_table_row.get("target_table") or "").strip().lower()
    if tgt != str(table_name or "").strip().lower():
        return False
    raw_sid = etl_table_row.get("storage_connection_id")
    sid_num = None
    if raw_sid is not None:
        try:
            sid_num = int(raw_sid)
        except Exception:
            sid_num = None
    if table_db_type == "dash":
        return sid_num == -1
    if table_db_type == "main":
        return raw_sid is None
    return False


def _summarize_etl_cascade_for_table(
    etl_blocks: dict[str, list[dict[str, Any]]],
    table_db_type: str,
    table_name: str,
) -> dict[str, Any]:
    etl_tables = [
        r
        for r in (etl_blocks.get("etl_tables") or [])
        if _table_master_is_etl_managed_match(table_db_type, table_name, r)
    ]
    etl_table_ids = {
        int(r.get("etl_table_id"))
        for r in etl_tables
        if r.get("etl_table_id") is not None
    }
    etl_jobs = [
        r
        for r in (etl_blocks.get("etl_jobs") or [])
        if r.get("etl_table_id") is not None and int(r.get("etl_table_id")) in etl_table_ids
    ]
    batch_jobs = [
        r
        for r in (etl_blocks.get("batch_jobs") or [])
        if r.get("etl_table_id") is not None and int(r.get("etl_table_id")) in etl_table_ids
    ]
    return {
        "etl_table_count": len(etl_tables),
        "etl_job_count": len(etl_jobs),
        "batch_job_count": len(batch_jobs),
        "etl_tables": etl_tables,
        "etl_jobs": etl_jobs,
        "batch_jobs": batch_jobs,
    }


def _etl_table_cascade_line_label(row: dict[str, Any]) -> str:
    """etl_tables 행 → table_master 연쇄 안내용 한 줄(기존 ETL 목록 label과 동일 규칙)."""
    lbl = (row.get("label") or "").strip()
    if lbl:
        return lbl
    tgt = (row.get("target_table") or "").strip()
    src = (row.get("source_table") or "").strip()
    if tgt and src and tgt.lower() != src.lower():
        return f"{tgt} ← {src}"
    return tgt or src or f"etl_table_id={row.get('etl_table_id')}"


def _etl_job_cascade_line_label(row: dict[str, Any]) -> str:
    lbl = (row.get("label") or "").strip()
    if lbl:
        return lbl
    jid = row.get("job_id")
    st = (row.get("status") or "").strip()
    return f"job #{jid} · {st}" if st else f"job #{jid}"


def _batch_job_cascade_line_label(row: dict[str, Any]) -> str:
    jn = (row.get("job_name") or "").strip()
    if jn:
        return jn
    return f"batch_job_id={row.get('batch_job_id')}"


def _cascade_transfer_etl_for_table_master(
    table_db_type: str,
    table_name: str,
    from_uid: int,
    to_uid: int,
) -> dict[str, int]:
    schema = _etl_schema_name()
    etl_conn = core_db.get_db_connection_etl()
    cur = etl_conn.cursor()
    try:
        cols_et = _admin_etl_table_columns_lower(cur, schema, "etl_tables")
        if "create_user_id" not in cols_et:
            return {"etl_table_count": 0, "etl_job_count": 0, "batch_job_count": 0}
        select_storage = ", storage_connection_id" if "storage_connection_id" in cols_et else ", NULL::integer AS storage_connection_id"
        cur.execute(
            f"""
            SELECT etl_table_id, target_table{select_storage}
            FROM {_admin_etl_q(schema, "etl_tables")}
            WHERE create_user_id = %s
            """,
            (int(from_uid),),
        )
        candidates = [
            dict(r)
            for r in cur.fetchall()
            if _table_master_is_etl_managed_match(table_db_type, table_name, dict(r))
        ]
        etl_table_ids = [
            int(r["etl_table_id"])
            for r in candidates
            if r.get("etl_table_id") is not None
        ]
        if not etl_table_ids:
            return {"etl_table_count": 0, "etl_job_count": 0, "batch_job_count": 0}

        ph = ", ".join(["%s"] * len(etl_table_ids))
        cur.execute(
            f"""
            UPDATE {_admin_etl_q(schema, "etl_tables")}
            SET create_user_id = %s, updated_at = NOW()
            WHERE create_user_id = %s AND etl_table_id IN ({ph})
            """,
            (int(to_uid), int(from_uid), *etl_table_ids),
        )
        etl_table_count = int(cur.rowcount or 0)

        etl_job_count = 0
        cols_j = _admin_etl_table_columns_lower(cur, schema, "etl_jobs")
        if "create_user_id" in cols_j and "etl_table_id" in cols_j:
            ts_set = ", updated_at = NOW()" if "updated_at" in cols_j else ""
            cur.execute(
                f"""
                UPDATE {_admin_etl_q(schema, "etl_jobs")}
                SET create_user_id = %s{ts_set}
                WHERE create_user_id = %s AND etl_table_id IN ({ph})
                """,
                (int(to_uid), int(from_uid), *etl_table_ids),
            )
            etl_job_count = int(cur.rowcount or 0)

        batch_job_count = 0
        cols_b = _admin_etl_table_columns_lower(cur, schema, "batch_jobs")
        if "create_user_id" in cols_b and "etl_table_id" in cols_b:
            ts_set = ", updated_at = NOW()" if "updated_at" in cols_b else ""
            cur.execute(
                f"""
                UPDATE {_admin_etl_q(schema, "batch_jobs")}
                SET create_user_id = %s{ts_set}
                WHERE create_user_id = %s AND etl_table_id IN ({ph})
                """,
                (int(to_uid), int(from_uid), *etl_table_ids),
            )
            batch_job_count = int(cur.rowcount or 0)

        etl_conn.commit()
        return {
            "etl_table_count": etl_table_count,
            "etl_job_count": etl_job_count,
            "batch_job_count": batch_job_count,
        }
    except Exception:
        etl_conn.rollback()
        raise
    finally:
        cur.close()
        etl_conn.close()


# 1.
def list_users_same_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_email, user_nickname, user_dvsn,
                   COALESCE(etl_yn, 'N') AS etl_yn, user_active_yn, create_dtm
            FROM user_info
            WHERE dptmt_info_id = %s
            ORDER BY user_email
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 1b.
def list_users_for_admin_ui(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
) -> list[dict[str, Any]]:
    """sa_dev는 전사 user, 그 외 어드민은 본인 부서 트리(본인+하위). 정렬: 부서 트리 그룹 → 조직 역할(sa_dev·sa·a·o·u) → 동일 조직 역할 시 etl Y 우선 → 이메일."""
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        sel = """
            SELECT
                u.user_id,
                u.user_email,
                u.user_nickname,
                u.user_dvsn,
                COALESCE(u.etl_yn, 'N') AS etl_yn,
                u.user_active_yn,
                u.create_dtm,
                u.dptmt_info_id,
                CASE
                    WHEN di.parent_dptmt_info_id IS NULL OR di.parent_dptmt_info_id = 0
                    THEN di.dptmt_name
                    ELSE COALESCE(pd.dptmt_name, di.dptmt_name)
                END AS dept_name,
                CASE
                    WHEN di.parent_dptmt_info_id IS NULL OR di.parent_dptmt_info_id = 0
                    THEN NULL
                    ELSE di.dptmt_name
                END AS dept_sub_name,
                CASE LOWER(TRIM(COALESCE(u.user_dvsn, '')))
                    WHEN 'sa_dev' THEN 0
                    WHEN 'sa' THEN 1
                    WHEN 'a' THEN 2
                    WHEN 'o' THEN 3
                    WHEN 'u' THEN 4
                    ELSE 9
                END AS _role_sort,
                COALESCE(NULLIF(di.parent_dptmt_info_id, 0), di.dptmt_info_id) AS _tree_key
            FROM user_info u
            INNER JOIN dptmt_info di ON di.dptmt_info_id = u.dptmt_info_id
            LEFT JOIN dptmt_info pd ON pd.dptmt_info_id = di.parent_dptmt_info_id
        """
        order = """
            ORDER BY
                _tree_key,
                u.dptmt_info_id,
                _role_sort,
                CASE WHEN UPPER(TRIM(COALESCE(u.etl_yn, ''))) = 'Y' THEN 0 ELSE 1 END,
                LOWER(u.user_email)
        """
        if ad == "sa_dev":
            cur.execute(sel + order)
        else:
            cur.execute(
                sel
                + """
                INNER JOIN (
                    WITH RECURSIVE sub AS (
                        SELECT dptmt_info_id
                        FROM dptmt_info
                        WHERE dptmt_info_id = %s
                        UNION ALL
                        SELECT d.dptmt_info_id
                        FROM dptmt_info d
                        INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
                    )
                    SELECT dptmt_info_id FROM sub
                ) scope ON scope.dptmt_info_id = u.dptmt_info_id
                """
                + order,
                (int(actor_dptmt_id),),
            )
        out: list[dict[str, Any]] = []
        for r in cur.fetchall():
            d = dict(r)
            d.pop("_role_sort", None)
            d.pop("_tree_key", None)
            out.append(d)
        return out
    finally:
        cur.close()


# 1c.
def list_users_dept_tree_for_project_create(
    conn,
    actor_dptmt_id: int,
    actor_user_id: int,
) -> list[dict[str, Any]]:
    """
    생성자 부서를 루트로 한 부서 트리 내 활성 사용자(본인 제외).
    정렬: 직속 상위부서(생성자 부서의 parent|self) 소속 먼저 → 부서 create_dtm → sa_dev·sa·a·o·u → user_id.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                u.user_id,
                u.user_email,
                u.user_nickname,
                u.user_dvsn,
                u.dptmt_info_id,
                d.dptmt_name,
                CASE LOWER(TRIM(COALESCE(u.user_dvsn, '')))
                    WHEN 'sa_dev' THEN 0
                    WHEN 'sa' THEN 1
                    WHEN 'a' THEN 2
                    WHEN 'o' THEN 3
                    WHEN 'u' THEN 4
                    ELSE 9
                END AS _dvsn_sort
            FROM user_info u
            INNER JOIN dptmt_info d ON d.dptmt_info_id = u.dptmt_info_id
            INNER JOIN (
                WITH RECURSIVE sub AS (
                    SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s
                    UNION ALL
                    SELECT di.dptmt_info_id
                    FROM dptmt_info di
                    INNER JOIN sub s ON di.parent_dptmt_info_id = s.dptmt_info_id
                )
                SELECT dptmt_info_id FROM sub
            ) scope ON scope.dptmt_info_id = u.dptmt_info_id
            WHERE u.user_id <> %s
              AND UPPER(TRIM(COALESCE(u.user_active_yn, 'Y'))) = 'Y'
            ORDER BY
                CASE WHEN u.dptmt_info_id = (
                    SELECT COALESCE(NULLIF(parent_dptmt_info_id, 0), dptmt_info_id)
                    FROM dptmt_info WHERE dptmt_info_id = %s
                ) THEN 0 ELSE 1 END,
                d.create_dtm ASC NULLS LAST,
                _dvsn_sort,
                u.user_id ASC
            """,
            (int(actor_dptmt_id), int(actor_user_id), int(actor_dptmt_id)),
        )
        out: list[dict[str, Any]] = []
        for r in cur.fetchall():
            d = dict(r)
            d.pop("_dvsn_sort", None)
            out.append(d)
        return out
    finally:
        cur.close()


# 2.
def search_users_by_email(
    conn,
    q: str,
    limit: int = 30,
    scope_dptmt_id: int | None = None,
    exclude_dptmt_zero: bool = False,
) -> list[dict[str, Any]]:
    term = (q or "").strip()
    if len(term) < 2:
        return []
    lim = max(1, min(limit, 50))
    pat = f"%{term}%"
    cur = conn.cursor()
    try:
        if scope_dptmt_id is not None:
            cur.execute(
                """
                SELECT u.user_id, u.user_email, u.user_nickname, u.user_dvsn, u.dptmt_info_id, d.dptmt_name
                FROM user_info u
                LEFT JOIN dptmt_info d ON d.dptmt_info_id = u.dptmt_info_id
                WHERE u.dptmt_info_id = %s
                  AND UPPER(TRIM(COALESCE(u.user_active_yn,''))) = 'Y'
                  AND LOWER(u.user_email) LIKE LOWER(%s)
                ORDER BY u.user_email
                LIMIT %s
                """,
                (scope_dptmt_id, pat, lim),
            )
        else:
            zero_filter = (
                " AND u.dptmt_info_id IS DISTINCT FROM 0" if exclude_dptmt_zero else ""
            )
            cur.execute(
                f"""
                SELECT u.user_id, u.user_email, u.user_nickname, u.user_dvsn, u.dptmt_info_id, d.dptmt_name
                FROM user_info u
                LEFT JOIN dptmt_info d ON d.dptmt_info_id = u.dptmt_info_id
                WHERE UPPER(TRIM(COALESCE(u.user_active_yn,''))) = 'Y'
                  AND LOWER(u.user_email) LIKE LOWER(%s)
                  {zero_filter}
                ORDER BY u.user_email
                LIMIT %s
                """,
                (pat, lim),
            )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def _validate_invite_target_for_actor(actor_dvsn: str, invite_target_dvsn: str) -> str:
    ad = (actor_dvsn or "").strip().lower()
    td = (invite_target_dvsn or "").strip().lower() or "u"
    allowed = _INVITE_TARGETS_BY_ACTOR.get(ad)
    if not allowed:
        raise ValueError("초대 권한이 없습니다.")
    if td not in allowed:
        raise ValueError(f"현재 조직 역할로는 '{td}' 조직 역할로의 초대가 허용되지 않습니다.")
    return td


def _invite_org_role_label_ko(dvsn: str) -> str:
    key = (dvsn or "").strip().lower()
    return _INVITE_DVSN_LABEL_KO.get(key) or key or "—"


def _fetch_invite_email_labels(
    conn,
    dptmt_id: int,
    proj_id: int | None,
    pmssn_id: int | None,
) -> tuple[str, str | None, str | None]:
    """초대 메일용: 부서 표시명, 프로젝트명(있을 때), 권한 템플릿명(있을 때)."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COALESCE(NULLIF(TRIM(COALESCE(dptmt_name, '')), ''), '부서') AS dn
            FROM dptmt_info WHERE dptmt_info_id = %s
            """,
            (int(dptmt_id),),
        )
        row = cur.fetchone()
        dept_name = (row or {}).get("dn") or "부서"
        proj_name: str | None = None
        pmssn_name: str | None = None
        if proj_id is not None and pmssn_id is not None:
            cur.execute(
                """
                SELECT COALESCE(NULLIF(TRIM(COALESCE(project_name, '')), ''), '(이름 없음)') AS pn
                FROM project_info WHERE project_info_id = %s
                """,
                (int(proj_id),),
            )
            pr = cur.fetchone()
            proj_name = (pr or {}).get("pn")
            cur.execute(
                """
                SELECT COALESCE(NULLIF(TRIM(COALESCE(pmssn_name, '')), ''), '(권한명 없음)') AS mn
                FROM pmssn_master WHERE pmssn_master_id = %s
                """,
                (int(pmssn_id),),
            )
            mr = cur.fetchone()
            pmssn_name = (mr or {}).get("mn")
        return str(dept_name), proj_name, pmssn_name
    finally:
        cur.close()


# 3.
def invite_user_by_email(
    conn,
    actor_user_id: int,
    actor_dptmt_id: int,
    actor_dvsn: str,
    target_email: str,
    dptmt_override: int | None,
    invite_target_dvsn: str,
    invite_etl_yn: str | None = None,
    invite_project_info_id: int | None = None,
    invite_pmssn_master_id: int | None = None,
) -> None:
    email_n = _norm_email(target_email)
    if not email_n or "@" not in email_n:
        raise ValueError("유효한 이메일이 필요합니다.")
    target_role = _validate_invite_target_for_actor(actor_dvsn, invite_target_dvsn)
    ad = (actor_dvsn or "").strip().lower()
    dptmt_id = int(dptmt_override) if dptmt_override is not None else int(actor_dptmt_id)
    if dptmt_id == 0 and ad != "sa_dev":
        raise ValueError("해당 부서로는 초대할 수 없습니다.")
    assert_invite_dptmt_allowed(conn, actor_dvsn, int(actor_dptmt_id), dptmt_id)

    raw_etl = (invite_etl_yn or "N").strip().upper()
    if raw_etl not in ("Y", "N"):
        raise ValueError("invite_etl_yn은 Y 또는 N이어야 합니다.")
    if ad == "a":
        etl_store = "N"
    elif ad in ("sa", "sa_dev"):
        etl_store = raw_etl
    else:
        etl_store = "N"

    proj_id = invite_project_info_id
    pmssn_id = invite_pmssn_master_id
    if target_role != "u":
        if proj_id is not None or pmssn_id is not None:
            raise ValueError("프로젝트·프로젝트 권한 지정은 u(일반 사용자) 초대일 때만 가능합니다.")
    else:
        if (proj_id is None) ^ (pmssn_id is None):
            raise ValueError("프로젝트와 프로젝트 권한(pmssn_master_id)은 함께 지정하거나 비워야 합니다.")
        if proj_id is not None and pmssn_id is not None:
            service_projects.validate_invite_user_project(
                conn, dptmt_id, int(proj_id), int(pmssn_id)
            )

    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id FROM user_info WHERE LOWER(TRIM(user_email)) = %s",
            (email_n,),
        )
        if cur.fetchone():
            raise ValueError("이미 가입된 이메일입니다.")
        cur.execute(
            "SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s",
            (dptmt_id,),
        )
        if not cur.fetchone():
            raise ValueError("부서를 찾을 수 없습니다.")
        code = secrets.token_urlsafe(32)
        cur.execute(
            audit_sql_catalog.SQL_INVITE_EMAIL_CODE_MASTER_INSERT,
            (
                code,
                email_n,
                dptmt_id,
                target_role,
                actor_user_id,
                etl_store,
                proj_id,
                pmssn_id,
            ),
        )
        conn.commit()
        dj_inv: dict[str, Any] = {
            "dptmt_info_id": int(dptmt_id),
            "x_invite_target_dvsn": target_role,
        }
        if proj_id is not None:
            dj_inv["project_info_id"] = int(proj_id)
        _emit_admin_system_log(
            actor_user_id,
            action_kind="CREATE",
            business_action="invite_send",
            risk_tier="MED",
            target_summary=f"invite_dptmt_info_id={int(dptmt_id)}",
            detail_json=dj_inv,
        )
    except ValueError:
        conn.rollback()
        raise
    except psycopg2.errors.UndefinedColumn as e:
        conn.rollback()
        _log.warning(
            "admin_invite db_column_missing: %s",
            getattr(e, "diag", None) and getattr(e.diag, "message_primary", str(e)) or str(e),
        )
        raise ValueError(
            "DB에 email_invite_code_master 확장 컬럼(invite_target_dvsn·invite_etl_yn·프로젝트 컬럼 등)이 없습니다. "
            "docs/report/17_SystemDB_Commercialization_Implementation_Guide.md §0.3 수동 DDL을 system_db에 적용한 뒤 다시 시도하세요."
        ) from e
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    base = auth_config.get_app_url()
    if not base:
        _log.warning(
            "[invite_user_by_email] 초대 메일 미발송(공개 SPA URL 없음). "
            "smtp_info.app_url, backend.app_url 또는 frontend.app_url 을 설정하세요."
        )
    else:
        url = f"{base.rstrip('/')}/signup?code={code}"
        dept_label, proj_label, pmssn_label = _fetch_invite_email_labels(conn, dptmt_id, proj_id, pmssn_id)
        try:
            send_invite_email(
                email_n,
                url,
                department_name=dept_label,
                org_role_ko=_invite_org_role_label_ko(target_role),
                include_etl_y=(etl_store == "Y"),
                project_name=proj_label,
                project_permission_name=pmssn_label,
            )
        except Exception:
            pass


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


# 3b.
def assert_invite_dptmt_allowed(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    target_dptmt_id: int,
) -> None:
    ad = (actor_dvsn or "").strip().lower()
    tid = int(target_dptmt_id)
    if ad == "sa_dev":
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s",
                (tid,),
            )
            if not cur.fetchone():
                raise ValueError("부서를 찾을 수 없습니다.")
        finally:
            cur.close()
        return
    aid = int(actor_dptmt_id)
    if tid == aid:
        return
    cur = conn.cursor()
    try:
        cur.execute(
            """
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id, parent_dptmt_info_id
                FROM dptmt_info WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id, d.parent_dptmt_info_id
                FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
            )
            SELECT 1 FROM sub WHERE dptmt_info_id = %s LIMIT 1
            """,
            (aid, tid),
        )
        if not cur.fetchone():
            raise ValueError("해당 부서로는 초대할 수 없습니다.")
    finally:
        cur.close()


def list_departments_for_invite(
    conn, actor_dvsn: str, actor_dptmt_id: int
) -> list[dict[str, Any]]:
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        if ad == "sa_dev":
            # dptmt_info_id = 0 인 루트/시드 부서도 포함 (초대 시 가입 부서 선택 가능해야 함)
            cur.execute(
                """
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                FROM dptmt_info
                WHERE COALESCE(use_yn, 'Y') = 'Y'
                ORDER BY dptmt_info_id, dptmt_name NULLS LAST
                """
            )
        else:
            cur.execute(
                """
                WITH RECURSIVE sub AS (
                    SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                    FROM dptmt_info WHERE dptmt_info_id = %s
                    UNION ALL
                    SELECT d.dptmt_info_id, d.dptmt_name, d.parent_dptmt_info_id
                    FROM dptmt_info d
                    INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
                    WHERE COALESCE(d.use_yn, 'Y') = 'Y'
                )
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id FROM sub
                ORDER BY dptmt_name NULLS LAST
                """,
                (int(actor_dptmt_id),),
            )
        return _apply_department_option_display_labels([dict(r) for r in cur.fetchall()])
    finally:
        cur.close()


# 4.
def _assert_same_dept(conn, actor_dptmt: int, target_user_id: int) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        if int(row["dptmt_info_id"]) != actor_dptmt:
            raise ValueError("다른 부서 사용자입니다.")
    finally:
        cur.close()


def _assert_target_in_managed_tree(conn, actor_dptmt: int, target_user_id: int) -> None:
    """대상 사용자가 actor_dptmt 본인 또는 하위 부서 트리에 속하는지 검증."""
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        target_dptmt = int(row["dptmt_info_id"])
        if not _dptmt_id_in_managed_subtree(conn, int(actor_dptmt), target_dptmt):
            raise ValueError("다른 부서 사용자입니다.")
    finally:
        cur.close()


def _assert_target_exists_or_same_dept(
    conn, actor_dptmt: int, actor_dvsn: str, target_user_id: int
) -> None:
    """SA_DEV는 부서 제한 없이 대상 존재만 확인, 나머지는 본인+하위 부서 트리 검증."""
    ad = (actor_dvsn or "").strip().lower()
    if ad == "sa_dev":
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT user_id FROM user_info WHERE user_id = %s",
                (target_user_id,),
            )
            if not cur.fetchone():
                raise ValueError("사용자를 찾을 수 없습니다.")
        finally:
            cur.close()
        return
    _assert_target_in_managed_tree(conn, actor_dptmt, target_user_id)


def _assert_suspend_activate_target(actor_dvsn: str, target_user_dvsn: str) -> None:
    ad = (actor_dvsn or "").strip().lower()
    td = (target_user_dvsn or "").strip().lower()
    if ad == "a":
        if td not in ("o", "u"):
            raise ValueError(
                "부서 관리자는 운영자·일반 사용자만 정지·활성 처리할 수 있습니다."
            )
        return
    if ad == "sa":
        if td in ("sa", "sa_dev"):
            raise ValueError("해당 조직 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        if td not in ("a", "o", "u"):
            raise ValueError("대상 사용자를 정지·활성 처리할 수 없습니다.")
        return
    if ad == "sa_dev":
        if td in ("sa", "sa_dev"):
            raise ValueError("해당 조직 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        return
    raise ValueError("정지·활성 처리 권한이 없습니다.")


def suspend_user(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    *,
    actor_user_id: int | None = None,
) -> None:
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, target_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_dvsn FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_suspend_activate_target(actor_dvsn, row.get("user_dvsn") or "")
        _evaluate_ownership_target_or_raise(
            conn, int(target_user_id), "u", "N", for_suspend=True
        )
        cur.execute(
            audit_sql_catalog.SQL_USER_SUSPEND,
            (target_user_id,),
        )
        # 순환 import 방지: auth_server.service ↔ admin_server 로딩 체인 상 모듈 최상단에서 import 금지
        from Backend.auth_server.service import invalidate_all_sessions

        invalidate_all_sessions(conn, int(target_user_id), do_commit=False)
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="user_suspend",
            risk_tier="HIGH",
            target_summary=f"target_user_id={int(target_user_id)}",
            detail_json={"affected_user_id": int(target_user_id)},
        )
        change_notify.notify_user_suspended(conn, actor_user_id, int(target_user_id))
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def activate_user(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    *,
    actor_user_id: int | None = None,
) -> None:
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, target_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_dvsn FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_suspend_activate_target(actor_dvsn, row.get("user_dvsn") or "")
        cur.execute(
            audit_sql_catalog.SQL_USER_ACTIVATE,
            (target_user_id,),
        )
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="user_activate",
            risk_tier="MED",
            target_summary=f"target_user_id={int(target_user_id)}",
            detail_json={"affected_user_id": int(target_user_id)},
        )
        change_notify.notify_user_activated(conn, actor_user_id, int(target_user_id))
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_inactive_user(
    conn,
    actor_user_id: int,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
) -> None:
    """
    비활성(user_active_yn≠Y) 사용자만 user_info 행 DELETE.
    정지·활성과 동일한 액터·대상 조직 역할 규칙, 정지와 동일 소유 매트릭스(409) 통과 필요. 본인 삭제 불가.
    """
    tid = int(target_user_id)
    aid = int(actor_user_id)
    if tid == aid:
        raise ValueError("본인 계정은 삭제할 수 없습니다.")
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_dvsn,
                   UPPER(TRIM(COALESCE(user_active_yn, 'Y'))) AS ua
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_suspend_activate_target(actor_dvsn, row.get("user_dvsn") or "")
        if (row.get("ua") or "") == "Y":
            raise ValueError("활성 사용자는 삭제할 수 없습니다. 먼저 정지한 뒤 삭제하세요.")
        _evaluate_ownership_target_or_raise(conn, tid, "u", "N", for_suspend=True)
        from Backend.auth_server.service import invalidate_all_sessions

        invalidate_all_sessions(conn, tid, do_commit=False)
        cur.execute(
            audit_sql_catalog.SQL_DELETE_SESSION_LOG_BY_SESSION_CREATOR,
            (tid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_DELETE_USER_LOGIN_LOG_BY_USER,
            (tid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_DELETE_NOTIFICATION_INFO_BY_USER,
            (tid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_DELETE_PROJECT_PTCPNT_BY_PARTICIPANT_USER,
            (tid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_DELETE_EMAIL_INVITE_BY_CODE_CREATOR,
            (tid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_DELETE_USER_INFO_BY_ID,
            (tid,),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("사용자를 삭제하지 못했습니다.")
        conn.commit()
        _emit_admin_system_log(
            aid,
            action_kind="DELETE",
            business_action="user_delete_inactive",
            risk_tier="HIGH",
            target_summary=f"deleted_user_id={tid}",
            detail_json={"affected_user_id": tid},
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 5.
def set_user_dvsn_admin_user(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    new_dvsn: str,
    *,
    actor_user_id: int | None = None,
) -> None:
    nd = (new_dvsn or "").strip().lower()
    if nd not in ("a", "o", "u"):
        raise ValueError("user_dvsn(조직 역할)은 a, o, u 중 하나여야 합니다.")
    ad = (actor_dvsn or "").strip().lower()
    if ad not in ("a", "sa", "sa_dev"):
        raise ValueError("조직 역할 변경 권한이 없습니다.")
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, target_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_dvsn FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        cur_td = (row.get("user_dvsn") or "").strip().lower()
        if cur_td in ("sa", "sa_dev"):
            raise ValueError("해당 조직 역할은 이 API로 변경할 수 없습니다.")
        if ad == "a":
            if cur_td not in ("o", "u"):
                raise ValueError("부서 관리자는 운영자·일반 사용자만 변경할 수 있습니다.")
            if nd not in ("o", "u"):
                raise ValueError("부서 관리자는 o·u만 부여할 수 있습니다.")
        elif ad == "sa":
            if cur_td in ("sa", "sa_dev"):
                raise ValueError("대상 사용자의 조직 역할을 변경할 수 없습니다.")
            if cur_td not in ("a", "o", "u"):
                raise ValueError("대상 사용자의 조직 역할을 변경할 수 없습니다.")
            if nd not in ("a", "o", "u"):
                raise ValueError("허용되지 않는 조직 역할입니다.")
        elif ad == "sa_dev":
            if cur_td in ("sa", "sa_dev"):
                raise ValueError("해당 조직 역할은 이 API로 변경할 수 없습니다.")
            if nd not in ("a", "o", "u"):
                raise ValueError("허용되지 않는 조직 역할입니다.")
        cur.execute(
            audit_sql_catalog.SQL_USER_ROLE_CHANGE,
            (nd, target_user_id),
        )
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="user_role_change",
            risk_tier="HIGH",
            target_summary=f"target_user_id={int(target_user_id)}",
            detail_json={
                "affected_user_id": int(target_user_id),
                "old_value": cur_td,
                "new_value": nd,
            },
        )
        if cur_td != nd:
            change_notify.notify_org_role_changed(
                conn, actor_user_id, int(target_user_id), cur_td, nd
            )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 6.
def set_user_etl_flag(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    etl_yn: str,
    *,
    actor_user_id: int | None = None,
) -> None:
    flag = (etl_yn or "").strip().upper()
    if flag not in ("Y", "N"):
        raise ValueError("etl_yn은 Y 또는 N이어야 합니다.")
    ad = (actor_dvsn or "").strip().lower()
    if ad not in ("sa_dev", "sa"):
        raise ValueError("ETL 자격 변경 권한이 없습니다.")
    if ad == "sa":
        _assert_target_in_managed_tree(conn, actor_dptmt, target_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_dvsn,
                   UPPER(TRIM(COALESCE(etl_yn, 'N'))) AS etl_yn_cur
            FROM user_info WHERE user_id = %s
            """,
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        td = (row.get("user_dvsn") or "").strip().lower()
        prev_etl = str(row.get("etl_yn_cur") or "N").strip().upper()
        if td == "sa_dev":
            raise ValueError("SA_DEV 계정의 etl_yn은 변경할 수 없습니다.")
        if flag == "N":
            _raise_if_etl_registry_blocks_clearing_etl_yn(int(target_user_id))
        cur.execute(
            audit_sql_catalog.SQL_USER_ETL_FLAG,
            (flag, target_user_id),
        )
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="user_etl_flag",
            risk_tier="MED",
            target_summary=f"target_user_id={int(target_user_id)}",
            detail_json={
                "affected_user_id": int(target_user_id),
                "old_value": prev_etl,
                "new_value": flag,
            },
        )
        if prev_etl != flag:
            change_notify.notify_etl_access_changed(
                conn, actor_user_id, int(target_user_id), prev_etl, flag
            )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 7.
def list_invite_codes_for_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT email_invite_code_master_id, invite_target_email, invite_target_dvsn,
                   exprtn_dtm, used_yn, create_dtm,
                   COALESCE(invite_etl_yn, 'N') AS invite_etl_yn,
                   invite_project_info_id, invite_pmssn_master_id
            FROM email_invite_code_master
            WHERE dptmt_info_id = %s
            ORDER BY create_dtm DESC
            LIMIT 200
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


# 8.
def get_department(conn, dptmt_info_id: int) -> dict[str, Any]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT dptmt_info_id, dptmt_code, dptmt_name, parent_dptmt_info_id, use_yn, create_dtm
            FROM dptmt_info WHERE dptmt_info_id = %s
            """,
            (dptmt_info_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("부서를 찾을 수 없습니다.")
        return dict(row)
    finally:
        cur.close()


def _dptmt_id_in_managed_subtree(conn, root_dptmt_id: int, node_id: int) -> bool:
    """node_id가 root_dptmt_id(포함) 또는 그 하위 부서이면 True. use_yn 무관, 부서 0 제외."""
    root = int(root_dptmt_id)
    node = int(node_id)
    if root == 0 or node == 0:
        return False
    cur = conn.cursor()
    try:
        cur.execute(
            """
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
                WHERE d.dptmt_info_id <> 0
            )
            SELECT 1 FROM sub WHERE dptmt_info_id = %s LIMIT 1
            """,
            (root, node),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


def _dptmt_same_vertical_branch(conn, dept_a: int, dept_b: int) -> bool:
    """
    동일 부서(dptmt_info_id 동일)이거나, org 트리에서 한쪽이 다른 쪽의 조상·자손이면 True.
    형제 부서(같은 부모 아래)는 False.
    """
    a = int(dept_a)
    b = int(dept_b)
    if a == 0 or b == 0:
        return False
    if a == b:
        return True
    return _dptmt_id_in_managed_subtree(conn, a, b) or _dptmt_id_in_managed_subtree(
        conn, b, a
    )


def _apply_department_option_display_labels(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """parent_dptmt_info_id 기준 상위·하위 표시용 display_label·tier_label 부여."""
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        pid = d.get("parent_dptmt_info_id")
        try:
            pnum = int(pid) if pid is not None else 0
        except Exception:
            pnum = 0
        tier = "상위" if pnum == 0 else "하위"
        d["tier_label"] = tier
        nm = (d.get("dptmt_name") or "").strip() or str(d.get("dptmt_info_id", ""))
        d["display_label"] = f"{nm} ({tier})"
        out.append(d)
    return out


# 9.
def list_departments_for_org_settings(
    conn, actor_dvsn: str, actor_dptmt_id: int
) -> list[dict[str, Any]]:
    """
    부서 관리 화면 목록. dptmt_info_id=0 행은 제외(어떤 조직 역할도 미표시).
    SA_DEV: 전체(사용/미사용 포함). sa: 본인 소속 부서 루트 하위 트리(use_yn 무관).
    member_count: 소속 user_info 행 수. display_label·tier_label: 셀렉트용 상·하위 표시.
    creator_email: dptmt_create_user_id LEFT JOIN user_info(빈 문자열·미매칭은 NULL).
    목록 정렬: update_dtm DESC NULLS LAST, dptmt_info_id ASC.
    """
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        if ad == "sa_dev":
            cur.execute(
                """
                SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                       p.dptmt_name AS parent_dptmt_name, p.dptmt_code AS parent_dptmt_code,
                       d.sort_order, d.use_yn, d.create_dtm, d.update_dtm, d.dptmt_create_user_id,
                       NULLIF(TRIM(cu.user_email), '') AS creator_email,
                       (SELECT COUNT(*)::int FROM user_info u WHERE u.dptmt_info_id = d.dptmt_info_id) AS member_count
                FROM dptmt_info d
                LEFT JOIN dptmt_info p ON p.dptmt_info_id = d.parent_dptmt_info_id
                LEFT JOIN user_info cu ON cu.user_id = d.dptmt_create_user_id
                WHERE d.dptmt_info_id <> 0
                ORDER BY d.update_dtm DESC NULLS LAST, d.dptmt_info_id ASC
                """
            )
        elif ad == "sa":
            aid = int(actor_dptmt_id)
            if aid == 0:
                return []
            cur.execute(
                """
                WITH RECURSIVE sub AS (
                    SELECT dptmt_info_id, dptmt_code, dptmt_name, parent_dptmt_info_id, sort_order, use_yn, create_dtm,
                           update_dtm, dptmt_create_user_id
                    FROM dptmt_info
                    WHERE dptmt_info_id = %s
                    UNION ALL
                    SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                           d.sort_order, d.use_yn, d.create_dtm, d.update_dtm, d.dptmt_create_user_id
                    FROM dptmt_info d
                    INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
                    WHERE d.dptmt_info_id <> 0
                )
                SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                       p.dptmt_name AS parent_dptmt_name, p.dptmt_code AS parent_dptmt_code,
                       d.sort_order, d.use_yn, d.create_dtm, d.update_dtm, d.dptmt_create_user_id,
                       NULLIF(TRIM(cu.user_email), '') AS creator_email,
                       (SELECT COUNT(*)::int FROM user_info u WHERE u.dptmt_info_id = d.dptmt_info_id) AS member_count
                FROM sub d
                LEFT JOIN dptmt_info p ON p.dptmt_info_id = d.parent_dptmt_info_id
                LEFT JOIN user_info cu ON cu.user_id = d.dptmt_create_user_id
                WHERE d.dptmt_info_id <> 0
                ORDER BY d.update_dtm DESC NULLS LAST, d.dptmt_info_id ASC
                """,
                (aid,),
            )
        else:
            return []
        return _apply_department_option_display_labels([dict(r) for r in cur.fetchall()])
    finally:
        cur.close()


def _assert_actor_can_manage_department(
    conn, eff: str, actor_dptmt_id: int, target_dptmt_id: int
) -> None:
    """부서 0은 관리 불가. sa_dev는 존재 행 전부. sa는 본인 소속 부서(상위) 자신은 금지, 그 외 트리 내 하위만."""
    tid = int(target_dptmt_id)
    if tid == 0:
        raise ValueError("해당 부서는 관리할 수 없습니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM dptmt_info WHERE dptmt_info_id = %s",
            (tid,),
        )
        if not cur.fetchone():
            raise ValueError("부서를 찾을 수 없습니다.")
    finally:
        cur.close()
    if eff == "sa_dev":
        return
    if eff == "sa":
        aid = int(actor_dptmt_id)
        if tid == aid:
            raise ValueError(
                "본인 소속(상위) 부서는 수정·삭제할 수 없습니다. 하위 부서만 관리할 수 있습니다."
            )
        if not _dptmt_id_in_managed_subtree(conn, aid, tid):
            raise ValueError("해당 부서를 수정·삭제할 권한이 없습니다.")
        return
    raise ValueError("권한이 없습니다.")


# 10.
def _assert_department_clear_for_invalidate_or_remove(conn, tid: int) -> None:
    """
    [부서 비활성·삭제]
    부서명·코드만 변경 시에는 호출하지 않는다.
    use_yn='N' 또는 DELETE 전: 이 부서 PK를 참조하는 행이 있으면 불가.
    """
    dptmt_id = int(tid)
    if dptmt_id == 0:
        return
    cur = conn.cursor()
    reasons: list[str] = []
    try:
        cur.execute(
            """
            SELECT COUNT(*)::int AS c FROM dptmt_info
            WHERE parent_dptmt_info_id = %s
            """,
            (dptmt_id,),
        )
        row = cur.fetchone()
        n = int((row.get("c", 0) if row else 0) or 0)
        if n > 0:
            reasons.append(f"하위 부서 {n}건")

        cur.execute(
            "SELECT COUNT(*)::int AS c FROM user_info WHERE dptmt_info_id = %s",
            (dptmt_id,),
        )
        row = cur.fetchone()
        n = int((row.get("c", 0) if row else 0) or 0)
        if n > 0:
            reasons.append(f"소속 사용자 {n}건")

        cur.execute(
            """
            SELECT COUNT(*)::int AS c FROM email_invite_code_master
            WHERE dptmt_info_id = %s
            """,
            (dptmt_id,),
        )
        row = cur.fetchone()
        n = int((row.get("c", 0) if row else 0) or 0)
        if n > 0:
            reasons.append(f"초대(이메일 초대) {n}건")

        cur.execute(
            "SELECT COUNT(*)::int AS c FROM project_info WHERE dptmt_info_id = %s",
            (dptmt_id,),
        )
        row = cur.fetchone()
        n = int((row.get("c", 0) if row else 0) or 0)
        if n > 0:
            reasons.append(f"소속 프로젝트 {n}건")

        cur.execute(
            """
            SELECT COUNT(*)::int AS c FROM pmssn_master
            WHERE dptmt_info_id = %s
            """,
            (dptmt_id,),
        )
        row = cur.fetchone()
        n = int((row.get("c", 0) if row else 0) or 0)
        if n > 0:
            reasons.append(f"부서 커스텀 권한(pmssn_master) {n}건")
    finally:
        cur.close()

    if not reasons:
        return
    raise ValueError(
        "이 부서를 참조하는 데이터가 있어 비활성화하거나 삭제할 수 없습니다: "
        + ", ".join(reasons)
        + ". 참조를 정리한 뒤 다시 시도하거나, 부서명·코드만 수정하세요."
    )


def _migrate_users_for_department_invalidate(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    source_dptmt_id: int,
    target_dptmt_id: int,
) -> int:
    """비활성화 전 소속 사용자를 사용 중인 다른 부서로 일괄 이관. 이동 건수 반환."""
    src = int(source_dptmt_id)
    tgt = int(target_dptmt_id)
    if src == tgt:
        raise ValueError("이관 대상 부서는 비활성화하려는 부서와 달라야 합니다.")
    assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt_id, tgt)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COALESCE(use_yn, 'Y') AS uu
            FROM dptmt_info WHERE dptmt_info_id = %s
            """,
            (tgt,),
        )
        trow = cur.fetchone()
        if not trow:
            raise ValueError("이관 대상 부서를 찾을 수 없습니다.")
        uy = (trow.get("uu") or "Y").strip().upper()
        if uy != "Y":
            raise ValueError(
                "이관 대상은 사용 중(use_yn=Y)인 부서만 선택할 수 있습니다."
            )
        cur.execute(
            """
            UPDATE user_info
            SET dptmt_info_id = %s, update_dtm = NOW()
            WHERE dptmt_info_id = %s
            """,
            (tgt, src),
        )
        return int(cur.rowcount)
    finally:
        cur.close()


def update_department_in_org_settings(
    conn,
    dptmt_info_id: int,
    new_name: str | None,
    new_code: str | None,
    new_use_yn: str | None,
    actor_dvsn: str,
    actor_dptmt_id: int,
    migrate_users_to_dptmt_info_id: int | None = None,
    *,
    actor_user_id: int | None = None,
) -> None:
    eff = (actor_dvsn or "").strip().lower()
    if eff not in ("sa_dev", "sa"):
        raise ValueError("부서를 수정할 권한이 없습니다.")
    has_name = new_name is not None
    has_code = new_code is not None
    has_use = new_use_yn is not None
    if not has_name and not has_code and not has_use:
        raise ValueError(
            "부서명·부서 코드·사용 여부 중 하나 이상을 보내야 합니다."
        )
    name = (new_name or "").strip() if has_name else None
    code = (new_code or "").strip() if has_code else None
    use_v = None
    if has_use:
        u = (new_use_yn or "").strip().upper()
        if u not in ("Y", "N"):
            raise ValueError("사용 여부는 Y 또는 N 이어야 합니다.")
        use_v = u
    if has_name and not name:
        raise ValueError("부서명이 비어 있을 수 없습니다.")
    if has_code and not code:
        raise ValueError("부서 코드는 비울 수 없습니다.")
    mig = migrate_users_to_dptmt_info_id
    if mig is not None and (not has_use or use_v != "N"):
        raise ValueError(
            "migrate_users_to_dptmt_info_id는 사용 안 함(use_yn=N)으로 저장할 때만 지정할 수 있습니다."
        )
    _assert_actor_can_manage_department(conn, eff, int(actor_dptmt_id), int(dptmt_info_id))
    if has_use and use_v == "N":
        if mig is not None:
            _migrate_users_for_department_invalidate(
                conn,
                actor_dvsn,
                int(actor_dptmt_id),
                int(dptmt_info_id),
                int(mig),
            )
        _assert_department_clear_for_invalidate_or_remove(conn, int(dptmt_info_id))
    if has_code and code:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT 1 FROM dptmt_info
                WHERE LOWER(TRIM(dptmt_code)) = LOWER(TRIM(%s))
                  AND dptmt_info_id <> %s
                  AND COALESCE(use_yn, 'Y') = 'Y'
                LIMIT 1
                """,
                (code, int(dptmt_info_id)),
            )
            if cur.fetchone():
                raise ValueError("이미 사용 중인 부서 코드입니다.")
        finally:
            cur.close()
    sets: list[str] = []
    params: list[Any] = []
    if has_name:
        sets.append("dptmt_name = %s")
        params.append(name[:100] if name else "")
    if has_code:
        sets.append("dptmt_code = %s")
        params.append(code[:80] if code else "")
    if has_use:
        sets.append("use_yn = %s")
        params.append(use_v)
    if not sets:
        raise ValueError("변경할 내용이 없습니다.")
    sets.append("update_dtm = NOW()")
    params.append(int(dptmt_info_id))
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE dptmt_info SET {', '.join(sets)} WHERE dptmt_info_id = %s",
            params,
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("부서를 찾을 수 없습니다.")
        conn.commit()
        ba = "dept_invalidate" if (has_use and use_v == "N") else "dept_update"
        _emit_admin_system_log(
            actor_user_id,
            business_action=ba,
            detail_json={
                "dptmt_info_id": int(dptmt_info_id),
                "x_has_name": has_name,
                "x_has_code": has_code,
                "x_has_use": has_use,
                "migrate_users_to_dptmt_info_id": mig,
            },
            risk_tier="HIGH" if ba == "dept_invalidate" else "MED",
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_department_in_org_settings(
    conn,
    dptmt_info_id: int,
    actor_dvsn: str,
    actor_dptmt_id: int,
    *,
    actor_user_id: int | None = None,
) -> None:
    eff = (actor_dvsn or "").strip().lower()
    if eff not in ("sa_dev", "sa"):
        raise ValueError("부서를 삭제할 권한이 없습니다.")
    tid = int(dptmt_info_id)
    if tid == 0:
        raise ValueError("해당 부서는 삭제할 수 없습니다.")
    _assert_actor_can_manage_department(conn, eff, int(actor_dptmt_id), tid)
    _assert_department_clear_for_invalidate_or_remove(conn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            audit_sql_catalog.SQL_DEPT_DELETE,
            (tid,),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("부서를 찾을 수 없습니다.")
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="dept_delete",
            action_kind="DELETE",
            detail_json={"dptmt_info_id": tid},
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


def create_department(
    conn,
    actor_user_id: int,
    dptmt_name: str,
    parent_dptmt_info_id: int | None = None,
    dptmt_code: str | None = None,
    *,
    actor_dvsn: str = "",
    actor_dptmt_id: int = 0,
) -> int:
    """
    SA_DEV: parent NULL 이면 최상위 부서, parent 지정 시 해당 부서의 하위.
    sa: 최상위(parent NULL) 불가. parent 필수이며 본인 소속 부서 트리 안의 부서만 상위로 허용.
    """
    eff = (actor_dvsn or "").strip().lower()
    if eff not in ("sa_dev", "sa"):
        raise ValueError("부서를 생성할 권한이 없습니다.")
    name = (dptmt_name or "").strip()
    if not name:
        raise ValueError("부서명이 필요합니다.")
    pid = parent_dptmt_info_id
    if eff == "sa":
        if pid is None:
            raise ValueError(
                "sa(Super Admin)는 최상위(루트) 부서를 만들 수 없습니다. 상위 부서를 선택한 뒤 하위 부서로 추가하세요."
            )
        pid = int(pid)
        if not _dptmt_id_in_managed_subtree(conn, int(actor_dptmt_id), pid):
            raise ValueError("소속 부서 트리 안의 부서만 상위로 지정할 수 있습니다.")
    if pid is not None:
        pid = int(pid)
        if pid == 0:
            raise ValueError("상위 부서로 지정할 수 없습니다.")
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT 1 FROM dptmt_info WHERE dptmt_info_id = %s",
                (pid,),
            )
            if not cur.fetchone():
                raise ValueError("상위 부서를 찾을 수 없습니다.")
        finally:
            cur.close()
    code = (dptmt_code or "").strip()
    if not code:
        code = f"D{secrets.token_hex(4).upper()}"
    cur = conn.cursor()
    try:
        cur.execute(
            audit_sql_catalog.SQL_DEPT_CREATE_INSERT,
            (code[:80], name[:100], pid, int(actor_user_id)),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise ValueError("부서 등록에 실패했습니다.")
        new_id = int(row["dptmt_info_id"] if hasattr(row, "get") else row[0])
        conn.commit()
        _emit_admin_system_log(
            int(actor_user_id),
            business_action="dept_create",
            action_kind="CREATE",
            detail_json={
                "dptmt_info_id": new_id,
                "parent_dptmt_info_id": pid,
            },
            risk_tier="MED",
        )
        return new_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def update_department_name(
    conn, dptmt_info_id: int, new_name: str, *, actor_user_id: int | None = None
) -> None:
    name = (new_name or "").strip()
    if not name:
        raise ValueError("부서명이 필요합니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            audit_sql_catalog.SQL_DEPT_UPDATE_NAME_ONLY,
            (name, dptmt_info_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("부서를 찾을 수 없습니다.")
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="dept_update",
            detail_json={"dptmt_info_id": int(dptmt_info_id), "x_field": "dptmt_name_only"},
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 11.
def get_user_work_assets(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
) -> dict[str, Any]:
    """대상 사용자 작업물: 프로젝트(생성·참여·초대자 기록)·권한·등록 부서·table_master·etl_db(create_user_id)."""
    tid = int(target_user_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    target_user_dptmt_info_id: int | None = None
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (tid,),
        )
        urow = cur.fetchone()
        if urow is not None:
            target_user_dptmt_info_id = int(urow["dptmt_info_id"])
        cur.execute(
            """
            SELECT project_info_id, dptmt_info_id, project_name, active_yn, create_dtm
            FROM project_info
            WHERE project_create_user_id = %s
            ORDER BY project_name
            """,
            (tid,),
        )
        created_projects = [
            {
                **dict(r),
                "transferable": True,
                "kind": "project",
            }
            for r in cur.fetchall()
        ]
        cur.execute(
            """
            SELECT pi.project_info_id, pi.dptmt_info_id, pi.project_name,
                   COALESCE(pm.pmssn_name, '') AS pmssn_name, pi.active_yn
            FROM project_ptcpnt_info p
            JOIN project_info pi ON pi.project_info_id = p.project_info_id
            LEFT JOIN pmssn_master pm ON pm.pmssn_master_id = p.pmssn_master_id
            WHERE p.ptcpnt_user_id = %s
              AND COALESCE(pi.project_create_user_id, -1) <> %s
            ORDER BY pi.project_name
            """,
            (tid, tid),
        )
        participant_projects = [
            {**dict(r), "transferable": False, "kind": "participant_project"}
            for r in cur.fetchall()
        ]
        cur.execute(
            """
            SELECT pp.project_ptcpnt_info_id,
                   pi.project_info_id,
                   pi.dptmt_info_id,
                   pi.project_name,
                   COALESCE(pm.pmssn_name, '') AS pmssn_name,
                   pi.active_yn,
                   COALESCE(NULLIF(TRIM(pu.user_email), ''), '') AS ptcpnt_user_email
            FROM project_ptcpnt_info pp
            JOIN project_info pi ON pi.project_info_id = pp.project_info_id
            LEFT JOIN pmssn_master pm ON pm.pmssn_master_id = pp.pmssn_master_id
            JOIN user_info pu ON pu.user_id = pp.ptcpnt_user_id
            WHERE pp.invite_user_id = %s
              AND pp.ptcpnt_user_id <> %s
            ORDER BY pi.project_name NULLS LAST, pp.project_ptcpnt_info_id
            """,
            (tid, tid),
        )
        invited_project_participants: list[dict[str, Any]] = []
        for r in cur.fetchall():
            d = dict(r)
            pem = (d.get("ptcpnt_user_email") or "").strip()
            pname = (d.get("project_name") or "").strip() or "프로젝트"
            d["transferable"] = True
            d["kind"] = "project_invite"
            d["display_label"] = f"{pname} — 참여자 {pem}" if pem else f"{pname} — 참여자"
            invited_project_participants.append(d)
        cur.execute(
            """
            SELECT pmssn_master_id, dptmt_info_id, pmssn_name, create_dtm
            FROM pmssn_master
            WHERE user_id = %s AND COALESCE(system_dflt_yn, '') <> 'Y'
            ORDER BY pmssn_name
            """,
            (tid,),
        )
        created_custom_roles = [
            {**dict(r), "transferable": True, "kind": "pmssn_master"}
            for r in cur.fetchall()
        ]
        cur.execute(
            """
            SELECT d.dptmt_info_id, d.dptmt_name, d.parent_dptmt_info_id,
                   COALESCE(pd.dptmt_name, '') AS parent_dptmt_name,
                   COALESCE(d.use_yn, 'Y') AS use_yn
            FROM dptmt_info d
            LEFT JOIN dptmt_info pd ON pd.dptmt_info_id = d.parent_dptmt_info_id
            WHERE d.dptmt_create_user_id = %s AND d.dptmt_info_id <> 0
            ORDER BY d.dptmt_name NULLS LAST
            """,
            (tid,),
        )
        created_departments: list[dict[str, Any]] = []
        for r in cur.fetchall():
            dd = dict(r)
            dd["transferable"] = True
            dd["kind"] = "dptmt_creator"
            created_departments.append(dd)
        linked_tables = []
        try:
            cur.execute(
                """
                SELECT m.table_master_id, m.db_type, m.table_name,
                       COALESCE(m.table_label, '') AS table_label,
                       m.create_user_id,
                       (SELECT string_agg(pi2.project_name, ', ' ORDER BY pi2.project_name)
                        FROM table_project_mapping tpm2
                        JOIN project_info pi2
                          ON pi2.project_info_id = tpm2.project_info_id
                        WHERE tpm2.table_master_id = m.table_master_id
                       ) AS linked_project_names
                FROM table_master m
                WHERE m.create_user_id IS NOT NULL AND m.create_user_id = %s
                ORDER BY m.db_type, m.table_name
                """,
                (tid,),
            )
            for r in cur.fetchall():
                d = dict(r)
                lp = (d.get("linked_project_names") or "").strip()
                d["transferable"] = True
                d["kind"] = "table_master"
                d["note"] = lp if lp else "프로젝트 미매핑(동일 부서 SA/A·SA_DEV만 이관 수신 가능)"
                d["cascade_children"] = []
                linked_tables.append(d)
        except psycopg2.errors.UndefinedColumn:
            linked_tables = []
    finally:
        cur.close()
    owned_widget_boards: list[dict[str, Any]] = []
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT wb.widget_board_id,
                   COALESCE(NULLIF(TRIM(COALESCE(wb.board_name, '')), ''), '위젯 보드') AS board_name,
                   wb.project_info_id,
                   pi.dptmt_info_id,
                   COALESCE(NULLIF(TRIM(COALESCE(pi.project_name, '')), ''), '프로젝트') AS project_name
            FROM widget_board wb
            JOIN project_info pi ON pi.project_info_id = wb.project_info_id
            WHERE wb.owner_user_id = %s
            ORDER BY wb.board_name NULLS LAST
            """,
            (tid,),
        )
        for r in cur.fetchall():
            d = dict(r)
            d["transferable"] = True
            d["kind"] = "widget_board"
            d["display_label"] = f"{d.get('board_name') or '위젯 보드'} · {d.get('project_name') or ''}"
            owned_widget_boards.append(d)
    except Exception as ex:
        _log.warning("admin_user work_assets widget_board uid=%s: %s", tid, ex)
    finally:
        cur.close()
    etl_blocks: dict[str, list[dict[str, Any]]] = {
        "etl_connections": [],
        "etl_tables": [],
        "etl_jobs": [],
        "etl_storage_connections": [],
        "batch_folder_connections": [],
        "batch_jobs": [],
    }
    etl_assets_note = ""
    etl_conn = None
    try:
        etl_conn = core_db.get_db_connection_etl()
        etl_blocks = _fetch_etl_work_blocks(etl_conn, _etl_schema_name(), tid)
    except Exception as ex:
        _log.warning("admin_user etl_db_check_fail op=work_assets user_id=%s: %s", tid, ex)
        etl_assets_note = (
            "ETL 메타 DB에 연결하지 못했습니다. 설정(backend.etl_db)과 네트워크를 확인하세요."
        )
    finally:
        if etl_conn is not None:
            try:
                etl_conn.close()
            except Exception:
                pass
    for item in linked_tables:
        db_type = str(item.get("db_type") or "main").strip().lower()
        table_name = str(item.get("table_name") or "").strip()
        summary = _summarize_etl_cascade_for_table(etl_blocks, db_type, table_name)
        if summary["etl_table_count"] > 0:
            children = [f"└ ETL 테이블 {summary['etl_table_count']}건 연쇄 이관"]
            for er in summary.get("etl_tables") or []:
                children.append(f"· {_etl_table_cascade_line_label(dict(er))}")
            if summary["etl_job_count"] > 0:
                children.append(f"└ ETL 실행 Job {summary['etl_job_count']}건 연쇄 이관")
                for jr in summary.get("etl_jobs") or []:
                    children.append(f"· {_etl_job_cascade_line_label(dict(jr))}")
            if summary["batch_job_count"] > 0:
                children.append(f"└ 배치 Job {summary['batch_job_count']}건 연쇄 이관")
                for br in summary.get("batch_jobs") or []:
                    children.append(f"· {_batch_job_cascade_line_label(dict(br))}")
            item["cascade_children"] = children
    for rows in etl_blocks.values():
        for item in rows:
            if target_user_dptmt_info_id is not None:
                item["dptmt_info_id"] = target_user_dptmt_info_id
    if target_user_dptmt_info_id is not None:
        for item in linked_tables:
            item["dptmt_info_id"] = target_user_dptmt_info_id
    return {
        "target_user_dptmt_info_id": target_user_dptmt_info_id,
        "created_projects": created_projects,
        "participant_projects": participant_projects,
        "invited_project_participants": invited_project_participants,
        "created_custom_roles": created_custom_roles,
        "created_departments": created_departments,
        "linked_tables": linked_tables,
        "etl_connections": etl_blocks["etl_connections"],
        "etl_tables": etl_blocks["etl_tables"],
        "etl_jobs": etl_blocks["etl_jobs"],
        "etl_storage_connections": etl_blocks["etl_storage_connections"],
        "batch_folder_connections": etl_blocks["batch_folder_connections"],
        "batch_jobs": etl_blocks["batch_jobs"],
        "etl_assets_note": etl_assets_note,
        "owned_widget_boards": owned_widget_boards,
    }


def _actor_cannot_transfer_to_sa_dev(actor_dvsn: str) -> bool:
    """부서 SA는 전사 sa_dev에게 이관 불가(A·sa_dev 액터는 예외)."""
    return canon_user_dvsn(actor_dvsn) == "sa"


def get_user_dptmt_for_admin(conn, user_id: int) -> int:
    """이관 API 쿼리 파라미터 검증용 user_info.dptmt_info_id."""
    uid = int(user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (uid,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        return int(row["dptmt_info_id"])
    finally:
        cur.close()


def _table_master_recipient_eligible(
    conn,
    to_user_id: int,
    to_row: dict[str, Any],
    from_dptmt_id: int,
    linked_project_ids: list[int],
) -> bool:
    """
    테이블 마스터 수신 가능 여부.
    - sa_dev: 항상 가능
    - 프로젝트 미매핑: 원 소유자 부서와 동일 PK 또는 상·하위 트리에 있는 sa·a 만
    - 매핑 있음: (위 동일 부서 트리 sa·a) 또는 (매핑 프로젝트 참여 + query.execute 유효 권한)
    """
    cd = canon_user_dvsn(to_row.get("user_dvsn"))
    to_dpt = int(to_row["dptmt_info_id"])
    if cd == "sa_dev":
        return True
    if not linked_project_ids:
        return cd in ("sa", "a") and _dptmt_same_vertical_branch(
            conn, int(from_dptmt_id), to_dpt
        )
    if cd in ("sa", "a") and _dptmt_same_vertical_branch(
        conn, int(from_dptmt_id), to_dpt
    ):
        return True
    dvsn_raw = to_row.get("user_dvsn")
    for pid in linked_project_ids:
        if not is_project_participant(conn, to_user_id, int(pid)):
            continue
        perms = set(
            get_effective_permission_ids_for_me(
                conn, to_user_id, int(pid), dvsn_raw
            )
        )
        if "query.execute" in perms:
            return True
    return False


# 12.
def list_table_master_transfer_targets(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    owner_user_id: int,
    table_master_id: int,
) -> list[dict[str, Any]]:
    """
    table_master.create_user_id = owner 인 행에 대한 이관 후보.
    후보: 원 소속 부서 활성 사용자 ∪ 매핑 프로젝트 참여자 ∪ 활성 sa_dev(액터 관리 범위 내).
    """
    ex = int(owner_user_id)
    tmid = int(table_master_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt_id, actor_dvsn, ex)
    block_sa_to_sa_dev = _actor_cannot_transfer_to_sa_dev(actor_dvsn)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (ex,),
        )
        frow = cur.fetchone()
        if not frow:
            raise ValueError("소유 사용자를 찾을 수 없습니다.")
        fd = int(frow["dptmt_info_id"])
        assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt_id, fd)
        cur.execute(
            """
            SELECT table_master_id, create_user_id
            FROM table_master
            WHERE table_master_id = %s
            """,
            (tmid,),
        )
        tm = cur.fetchone()
        if not tm:
            raise ValueError("테이블 마스터를 찾을 수 없습니다.")
        if tm.get("create_user_id") is None:
            raise ValueError("등록자(create_user_id)가 없어 이관할 수 없습니다.")
        if int(tm["create_user_id"]) != ex:
            raise ValueError("해당 사용자가 등록자가 아닌 테이블입니다.")
        cur.execute(
            """
            SELECT project_info_id
            FROM table_project_mapping
            WHERE table_master_id = %s
            """,
            (tmid,),
        )
        linked_pids = [int(r["project_info_id"]) for r in cur.fetchall()]
    finally:
        cur.close()

    candidates: dict[int, dict[str, Any]] = {}
    cur = conn.cursor()
    try:
        cur.execute(
            """
            WITH RECURSIVE
            down AS (
                SELECT dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s AND dptmt_info_id <> 0
                UNION ALL
                SELECT d.dptmt_info_id FROM dptmt_info d
                INNER JOIN down s ON d.parent_dptmt_info_id = s.dptmt_info_id
                WHERE d.dptmt_info_id <> 0
            ),
            up AS (
                SELECT dptmt_info_id, parent_dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s
                UNION ALL
                SELECT p.dptmt_info_id, p.parent_dptmt_info_id
                FROM dptmt_info p
                INNER JOIN up u ON p.dptmt_info_id = u.parent_dptmt_info_id
                WHERE p.dptmt_info_id <> 0
            ),
            branch AS (
                SELECT dptmt_info_id FROM down
                UNION
                SELECT dptmt_info_id FROM up
            )
            SELECT user_id, user_email, user_nickname, user_dvsn,
                   UPPER(TRIM(COALESCE(user_active_yn, ''))) AS ua,
                   dptmt_info_id
            FROM user_info
            WHERE dptmt_info_id IN (SELECT dptmt_info_id FROM branch)
              AND user_id <> %s
              AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
            """,
            (fd, fd, ex),
        )
        for r in cur.fetchall():
            candidates[int(r["user_id"])] = dict(r)
        if linked_pids:
            ph = ",".join(["%s"] * len(linked_pids))
            cur.execute(
                f"""
                SELECT DISTINCT u.user_id, u.user_email, u.user_nickname, u.user_dvsn,
                       UPPER(TRIM(COALESCE(u.user_active_yn, ''))) AS ua,
                       u.dptmt_info_id
                FROM project_ptcpnt_info p
                JOIN user_info u ON u.user_id = p.ptcpnt_user_id
                WHERE p.project_info_id IN ({ph})
                  AND u.user_id <> %s
                  AND UPPER(TRIM(COALESCE(u.user_active_yn, ''))) = 'Y'
                """,
                (*linked_pids, ex),
            )
            for r in cur.fetchall():
                uid = int(r["user_id"])
                if uid not in candidates:
                    candidates[uid] = dict(r)
        cur.execute(
            """
            SELECT user_id, user_email, user_nickname, user_dvsn,
                   UPPER(TRIM(COALESCE(user_active_yn, ''))) AS ua,
                   dptmt_info_id
            FROM user_info
            WHERE LOWER(TRIM(COALESCE(user_dvsn, ''))) = 'sa_dev'
              AND user_id <> %s
              AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
            """,
            (ex,),
        )
        for r in cur.fetchall():
            uid = int(r["user_id"])
            if uid not in candidates:
                candidates[uid] = dict(r)
    finally:
        cur.close()

    out: list[dict[str, Any]] = []
    for uid, row in sorted(
        candidates.items(), key=lambda x: ((x[1].get("user_email") or "").lower(), x[0])
    ):
        try:
            _assert_target_exists_or_same_dept(conn, actor_dptmt_id, actor_dvsn, uid)
        except ValueError:
            continue
        if block_sa_to_sa_dev and canon_user_dvsn(row.get("user_dvsn")) == "sa_dev":
            continue
        if (row.get("ua") or "") != "Y":
            continue
        if not _table_master_recipient_eligible(conn, uid, row, fd, linked_pids):
            continue
        out.append(
            {
                "user_id": uid,
                "user_email": row.get("user_email"),
                "user_nickname": row.get("user_nickname"),
                "user_dvsn": row.get("user_dvsn"),
            }
        )
    return out


# 12a.
def list_ownership_transfer_targets(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    dept_id: int,
    exclude_user_id: int,
    etl_infra: bool = False,
) -> list[dict[str, Any]]:
    assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt_id, int(dept_id))
    ex = int(exclude_user_id)
    block_sa_to_sa_dev = _actor_cannot_transfer_to_sa_dev(actor_dvsn)
    cur = conn.cursor()
    try:
        if etl_infra:
            cur.execute(
                """
                WITH RECURSIVE
                down AS (
                    SELECT dptmt_info_id FROM dptmt_info
                    WHERE dptmt_info_id = %s AND dptmt_info_id <> 0
                    UNION ALL
                    SELECT d.dptmt_info_id FROM dptmt_info d
                    INNER JOIN down s ON d.parent_dptmt_info_id = s.dptmt_info_id
                    WHERE d.dptmt_info_id <> 0
                ),
                up AS (
                    SELECT dptmt_info_id, parent_dptmt_info_id FROM dptmt_info
                    WHERE dptmt_info_id = %s
                    UNION ALL
                    SELECT p.dptmt_info_id, p.parent_dptmt_info_id
                    FROM dptmt_info p
                    INNER JOIN up u ON p.dptmt_info_id = u.parent_dptmt_info_id
                    WHERE p.dptmt_info_id <> 0
                ),
                branch AS (
                    SELECT dptmt_info_id FROM down
                    UNION
                    SELECT dptmt_info_id FROM up
                )
                SELECT user_id, user_email, user_nickname, user_dvsn,
                       UPPER(TRIM(COALESCE(etl_yn, ''))) AS etl_yn
                FROM user_info
                WHERE dptmt_info_id IN (SELECT dptmt_info_id FROM branch)
                  AND user_id <> %s
                  AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
                  AND (
                    UPPER(TRIM(COALESCE(etl_yn, ''))) = 'Y'
                    OR LOWER(TRIM(COALESCE(user_dvsn, ''))) = 'sa_dev'
                  )
                ORDER BY user_email
                """,
                (int(dept_id), int(dept_id), ex),
            )
            rows = [dict(r) for r in cur.fetchall()]
            if block_sa_to_sa_dev:
                rows = [
                    r
                    for r in rows
                    if canon_user_dvsn(r.get("user_dvsn")) != "sa_dev"
                ]
            out_etl: list[dict[str, Any]] = []
            for r in rows:
                uid = int(r["user_id"])
                try:
                    _assert_target_exists_or_same_dept(
                        conn, actor_dptmt_id, actor_dvsn, uid
                    )
                except ValueError:
                    continue
                out_etl.append(r)
            return out_etl
        cur.execute(
            """
            WITH RECURSIVE
            down AS (
                SELECT dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s AND dptmt_info_id <> 0
                UNION ALL
                SELECT d.dptmt_info_id FROM dptmt_info d
                INNER JOIN down s ON d.parent_dptmt_info_id = s.dptmt_info_id
                WHERE d.dptmt_info_id <> 0
            ),
            up AS (
                SELECT dptmt_info_id, parent_dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s
                UNION ALL
                SELECT p.dptmt_info_id, p.parent_dptmt_info_id
                FROM dptmt_info p
                INNER JOIN up u ON p.dptmt_info_id = u.parent_dptmt_info_id
                WHERE p.dptmt_info_id <> 0
            ),
            branch AS (
                SELECT dptmt_info_id FROM down
                UNION
                SELECT dptmt_info_id FROM up
            )
            SELECT user_id, user_email, user_nickname, user_dvsn
            FROM user_info
            WHERE dptmt_info_id IN (SELECT dptmt_info_id FROM branch)
              AND user_id <> %s
              AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
              AND LOWER(TRIM(COALESCE(user_dvsn, ''))) IN ('sa_dev', 'sa', 'a')
            ORDER BY user_email
            """,
            (int(dept_id), int(dept_id), ex),
        )
        rows = [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
    out: list[dict[str, Any]] = []
    for r in rows:
        cd = canon_user_dvsn(r.get("user_dvsn"))
        if cd not in _OWNERSHIP_TRANSFER_ELIGIBLE:
            continue
        if block_sa_to_sa_dev and cd == "sa_dev":
            continue
        uid = int(r["user_id"])
        try:
            _assert_target_exists_or_same_dept(conn, actor_dptmt_id, actor_dvsn, uid)
        except ValueError:
            continue
        out.append(r)
    return out


# 12b.
def list_department_creator_transfer_targets(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    dept_id: int,
    exclude_user_id: int,
) -> list[dict[str, Any]]:
    """
    dptmt_create_user_id 이관 수신 후보.
    동일 부서 수직 트리(상·하위) 내 활성 사용자 중 부서 생성 가능 역할(sa·sa_dev)만(Admin 제외).
    """
    assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt_id, int(dept_id))
    ex = int(exclude_user_id)
    block_sa_to_sa_dev = _actor_cannot_transfer_to_sa_dev(actor_dvsn)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            WITH RECURSIVE
            down AS (
                SELECT dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s AND dptmt_info_id <> 0
                UNION ALL
                SELECT d.dptmt_info_id FROM dptmt_info d
                INNER JOIN down s ON d.parent_dptmt_info_id = s.dptmt_info_id
                WHERE d.dptmt_info_id <> 0
            ),
            up AS (
                SELECT dptmt_info_id, parent_dptmt_info_id FROM dptmt_info
                WHERE dptmt_info_id = %s
                UNION ALL
                SELECT p.dptmt_info_id, p.parent_dptmt_info_id
                FROM dptmt_info p
                INNER JOIN up u ON p.dptmt_info_id = u.parent_dptmt_info_id
                WHERE p.dptmt_info_id <> 0
            ),
            branch AS (
                SELECT dptmt_info_id FROM down
                UNION
                SELECT dptmt_info_id FROM up
            )
            SELECT user_id, user_email, user_nickname, user_dvsn
            FROM user_info
            WHERE dptmt_info_id IN (SELECT dptmt_info_id FROM branch)
              AND user_id <> %s
              AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
              AND LOWER(TRIM(COALESCE(user_dvsn, ''))) IN ('sa_dev', 'sa')
            ORDER BY user_email
            """,
            (int(dept_id), int(dept_id), ex),
        )
        rows = [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
    out: list[dict[str, Any]] = []
    for r in rows:
        cd = canon_user_dvsn(r.get("user_dvsn"))
        if cd not in ("sa", "sa_dev"):
            continue
        if block_sa_to_sa_dev and cd == "sa_dev":
            continue
        uid = int(r["user_id"])
        try:
            _assert_target_exists_or_same_dept(conn, actor_dptmt_id, actor_dvsn, uid)
        except ValueError:
            continue
        out.append(r)
    return out


def _emit_ownership_transfer_log(
    actor_user_id: int | None,
    *,
    resource_type: str,
    resource_id: int,
    from_user_id: int,
    to_user_id: int,
    sql_fingerprint: str | None = None,
) -> None:
    _emit_admin_system_log(
        actor_user_id,
        business_action="ownership_transfer",
        action_kind="UPDATE",
        detail_json={
            "resource_type": resource_type,
            "resource_id": int(resource_id),
            "from_user_id": int(from_user_id),
            "to_user_id": int(to_user_id),
        },
        risk_tier="HIGH",
        sql_fingerprint=sql_fingerprint,
    )


# 13.
def transfer_resource_ownership(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    resource_type: str,
    resource_id: int,
    from_user_id: int,
    to_user_id: int,
    *,
    actor_user_id: int | None = None,
) -> None:
    rt = (resource_type or "").strip().lower()
    rid = int(resource_id)
    fid = int(from_user_id)
    tid = int(to_user_id)
    if fid == tid:
        raise ValueError("동일 사용자로는 이관할 수 없습니다.")
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, fid)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = None
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_id, dptmt_info_id, user_dvsn,
                   UPPER(TRIM(COALESCE(user_active_yn,''))) AS ua,
                   UPPER(TRIM(COALESCE(etl_yn,''))) AS etl_yn
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        to_row = cur.fetchone()
        if not to_row:
            raise ValueError("이관 대상 사용자를 찾을 수 없습니다.")
        if _actor_cannot_transfer_to_sa_dev(actor_dvsn) and canon_user_dvsn(
            to_row.get("user_dvsn")
        ) == "sa_dev":
            raise ValueError(
                "Super Admin(sa)는 전사 관리자(sa_dev)에게 이관할 수 없습니다."
            )
        if rt in _ETL_TRANSFER_TYPES:
            cur.execute(
                "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
                (fid,),
            )
            from_row = cur.fetchone()
            if not from_row:
                raise ValueError("소유 사용자를 찾을 수 없습니다.")
            from_dpt = int(from_row["dptmt_info_id"])
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, from_dpt)
            _assert_etl_infra_recipient(conn, dict(to_row), from_dpt)
            cur.close()
            cur = None
            etl_fp = _transfer_etl_resource(rt, rid, fid, tid)
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
                sql_fingerprint=etl_fp,
            )
            return
        if rt == "table_master":
            if (to_row.get("ua") or "") != "Y":
                raise ValueError("비활성 사용자에게는 이관할 수 없습니다.")
            cur.execute(
                "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
                (fid,),
            )
            from_row = cur.fetchone()
            if not from_row:
                raise ValueError("소유 사용자를 찾을 수 없습니다.")
            fd = int(from_row["dptmt_info_id"])
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, fd)
            try:
                cur.execute(
                    """
                    SELECT table_master_id, create_user_id, db_type, table_name
                    FROM table_master
                    WHERE table_master_id = %s
                    """,
                    (rid,),
                )
                tm = cur.fetchone()
                if not tm:
                    raise ValueError("테이블 마스터를 찾을 수 없습니다.")
                if tm.get("create_user_id") is None:
                    raise ValueError("등록자(create_user_id)가 없어 이관할 수 없습니다.")
                if int(tm["create_user_id"]) != fid:
                    raise ValueError("해당 사용자가 등록자가 아닌 테이블입니다.")
                cur.execute(
                    """
                    SELECT project_info_id
                    FROM table_project_mapping
                    WHERE table_master_id = %s
                    """,
                    (rid,),
                )
                linked_pids = [int(r["project_info_id"]) for r in cur.fetchall()]
            except psycopg2.errors.UndefinedColumn as e:
                raise ValueError(
                    "table_master.create_user_id 컬럼이 없습니다. DB DDL을 확인하세요."
                ) from e
            if not _table_master_recipient_eligible(
                conn, tid, dict(to_row), fd, linked_pids
            ):
                raise ValueError(
                    "선택한 사용자는 테이블 마스터를 위임받을 권한이 없습니다. "
                    "(매핑 프로젝트에서 query.execute 또는 동일 부서 SA/A·SA_DEV)"
                )
            try:
                cur.execute(
                    audit_sql_catalog.SQL_OWNERSHIP_TABLE_MASTER,
                    (tid, rid, fid),
                )
            except psycopg2.errors.UndefinedColumn as e:
                raise ValueError(
                    "table_master.create_user_id 컬럼이 없습니다. DB DDL을 확인하세요."
                ) from e
            if cur.rowcount == 0:
                conn.rollback()
                raise ValueError("테이블 마스터 이관에 실패했습니다.")
            _cascade_transfer_etl_for_table_master(
                str(tm.get("db_type") or "main"),
                str(tm.get("table_name") or ""),
                fid,
                tid,
            )
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        if rt == "dptmt_creator":
            eff_ac = (actor_dvsn or "").strip().lower()
            if eff_ac not in ("sa_dev", "sa"):
                raise ValueError(
                    "부서 생성자 이관은 Super Admin 또는 SA_DEV만 수행할 수 있습니다."
                )
            if (to_row.get("ua") or "") != "Y":
                raise ValueError("비활성 사용자에게는 이관할 수 없습니다.")
            td_recv = canon_user_dvsn(to_row.get("user_dvsn"))
            if td_recv not in ("sa", "sa_dev"):
                raise ValueError(
                    "부서 생성자는 Super Admin(sa) 또는 SA_DEV만 위임받을 수 있습니다."
                )
            _assert_actor_can_manage_department(conn, eff_ac, int(actor_dptmt), rid)
            cur.execute(
                """
                SELECT dptmt_info_id, dptmt_create_user_id, dptmt_name
                FROM dptmt_info WHERE dptmt_info_id = %s
                """,
                (rid,),
            )
            drow = cur.fetchone()
            if not drow:
                raise ValueError("부서를 찾을 수 없습니다.")
            if drow.get("dptmt_create_user_id") is None:
                raise ValueError("생성자 정보가 없어 이관할 수 없습니다.")
            if int(drow["dptmt_create_user_id"]) != fid:
                raise ValueError("해당 사용자가 부서 생성자가 아닙니다.")
            dept_pk = int(drow["dptmt_info_id"])
            to_dpt = int(to_row["dptmt_info_id"])
            if not _dptmt_same_vertical_branch(conn, dept_pk, to_dpt):
                raise ValueError(
                    "부서 생성자는 해당 부서와 동일 부서 트리(상·하위 포함) 소속 사용자에게만 이관할 수 있습니다."
                )
            assert_invite_dptmt_allowed(conn, actor_dvsn, int(actor_dptmt), dept_pk)
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_DPTMT_CREATOR,
                (tid, rid, fid),
            )
            if cur.rowcount == 0:
                conn.rollback()
                raise ValueError("부서 생성자 이관에 실패했습니다.")
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        if (to_row.get("ua") or "") != "Y":
            raise ValueError("비활성 사용자에게는 이관할 수 없습니다.")
        if canon_user_dvsn(to_row.get("user_dvsn")) not in _OWNERSHIP_TRANSFER_ELIGIBLE:
            raise ValueError(
                "이관 가능한 조직 역할은 sa_dev·Super Admin(sa)·Admin(a) 만입니다."
            )
        to_dpt = int(to_row["dptmt_info_id"])
        if rt == "widget_board":
            cur.execute(
                """
                SELECT wb.widget_board_id, wb.owner_user_id, pi.dptmt_info_id
                FROM widget_board wb
                JOIN project_info pi ON pi.project_info_id = wb.project_info_id
                WHERE wb.widget_board_id = %s
                """,
                (rid,),
            )
            wbrow = cur.fetchone()
            if not wbrow:
                raise ValueError("위젯 보드를 찾을 수 없습니다.")
            if int(wbrow["owner_user_id"]) != fid:
                raise ValueError("해당 사용자가 소유자가 아닌 위젯 보드입니다.")
            pd = int(wbrow["dptmt_info_id"])
            if to_dpt != pd:
                raise ValueError(
                    "이관 대상은 프로젝트 소속 부서와 동일한 부서 사용자여야 합니다."
                )
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, pd)
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_WIDGET_BOARD_OWNER,
                (tid, rid, fid),
            )
            if cur.rowcount == 0:
                conn.rollback()
                raise ValueError("위젯 보드 소유 이관에 실패했습니다.")
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_WIDGET_ITEM_BY_BOARD,
                (tid, rid),
            )
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        if rt == "project_invite":
            cur.execute(
                """
                SELECT pp.project_ptcpnt_info_id, pp.invite_user_id, pp.ptcpnt_user_id,
                       pi.dptmt_info_id
                FROM project_ptcpnt_info pp
                JOIN project_info pi ON pi.project_info_id = pp.project_info_id
                WHERE pp.project_ptcpnt_info_id = %s
                """,
                (rid,),
            )
            irow = cur.fetchone()
            if not irow:
                raise ValueError("프로젝트 참여 행을 찾을 수 없습니다.")
            if int(irow["invite_user_id"]) != fid:
                raise ValueError("해당 사용자가 초대자로 등록된 참여 행이 아닙니다.")
            if int(irow["ptcpnt_user_id"]) == tid:
                raise ValueError("참여자 본인에게는 초대자 기록을 이관할 수 없습니다.")
            pd = int(irow["dptmt_info_id"])
            if to_dpt != pd:
                raise ValueError(
                    "이관 대상은 프로젝트 소속 부서와 동일한 부서 사용자여야 합니다."
                )
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, pd)
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_PROJECT_INVITE,
                (tid, rid, fid),
            )
            if cur.rowcount == 0:
                conn.rollback()
                raise ValueError("초대자 이관에 실패했습니다.")
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        if rt == "project":
            cur.execute(
                """
                SELECT project_info_id, dptmt_info_id, project_create_user_id
                FROM project_info WHERE project_info_id = %s
                """,
                (rid,),
            )
            prow = cur.fetchone()
            if not prow:
                raise ValueError("프로젝트를 찾을 수 없습니다.")
            if int(prow["project_create_user_id"]) != fid:
                raise ValueError("해당 사용자가 생성자가 아닌 프로젝트입니다.")
            pd = int(prow["dptmt_info_id"])
            if to_dpt != pd:
                raise ValueError("이관 대상은 프로젝트 소속 부서와 동일한 부서 사용자여야 합니다.")
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, pd)
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_PROJECT_CREATE_USER,
                (tid, rid),
            )
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        if rt == "pmssn_master":
            cur.execute(
                """
                SELECT pmssn_master_id, dptmt_info_id, user_id, COALESCE(system_dflt_yn,'') AS sy
                FROM pmssn_master WHERE pmssn_master_id = %s
                """,
                (rid,),
            )
            mrow = cur.fetchone()
            if not mrow:
                raise ValueError("권한을 찾을 수 없습니다.")
            if (mrow.get("sy") or "").upper() == "Y":
                raise ValueError("시스템 기본 권한은 이관할 수 없습니다.")
            if int(mrow["user_id"]) != fid:
                raise ValueError("해당 사용자가 등록자가 아닌 권한입니다.")
            md = int(mrow["dptmt_info_id"] or 0)
            if md and to_dpt != md:
                raise ValueError("이관 대상은 권한 소속 부서와 동일한 부서 사용자여야 합니다.")
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, md)
            cur.execute(
                audit_sql_catalog.SQL_OWNERSHIP_PMSSN_MASTER_USER,
                (tid, rid),
            )
            conn.commit()
            _emit_ownership_transfer_log(
                actor_user_id,
                resource_type=rt,
                resource_id=rid,
                from_user_id=fid,
                to_user_id=tid,
            )
            return
        raise ValueError("지원하지 않는 리소스 유형입니다.")
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


def _role_change_allowed_for_actor(actor_dvsn: str) -> tuple[str, ...]:
    ad = (actor_dvsn or "").strip().lower()
    if ad == "sa_dev":
        return ("sa", "a", "o", "u")
    if ad == "sa":
        return ("sa", "a", "o", "u")
    if ad == "a":
        return ("a", "o", "u")
    return ()


def _assert_target_role_manageable(actor_dvsn: str, target_dvsn: str) -> None:
    ad = canon_user_dvsn(actor_dvsn)
    td = canon_user_dvsn(target_dvsn)
    if not ad or not td:
        raise ValueError("허용되지 않은 조직 역할 코드입니다.")
    if _DVSN_RANK.get(td, 0) > _DVSN_RANK.get(ad, 0):
        raise ValueError("본인보다 상위 조직 역할 계정은 변경할 수 없습니다.")


def _list_departments_for_change(conn, actor_dvsn: str, actor_dptmt_id: int) -> list[dict[str, Any]]:
    """사용자 변경·초대 등 부서 선택 옵션. use_yn=Y만, display_label(상위·하위) 포함."""
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        if ad == "sa_dev":
            cur.execute(
                """
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                FROM dptmt_info
                WHERE dptmt_info_id <> 0 AND COALESCE(use_yn, 'Y') = 'Y'
                ORDER BY dptmt_name NULLS LAST
                """
            )
            return _apply_department_option_display_labels([dict(r) for r in cur.fetchall()])
        cur.execute(
            """
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id, use_yn
                FROM dptmt_info WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id, d.dptmt_name, d.parent_dptmt_info_id, d.use_yn
                FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
            )
            SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
            FROM sub
            WHERE COALESCE(use_yn, 'Y') = 'Y'
            ORDER BY dptmt_name NULLS LAST
            """,
            (int(actor_dptmt_id),),
        )
        return _apply_department_option_display_labels([dict(r) for r in cur.fetchall()])
    finally:
        cur.close()


def _raise_if_etl_registry_blocks_clearing_etl_yn(user_id: int) -> None:
    """etl_yn을 N으로 바꿀 때 ETL 메타에 create_user_id 등록이 있으면 ValueError."""
    uid = int(user_id)
    etl_conn = None
    try:
        etl_conn = core_db.get_db_connection_etl()
        if _etl_user_has_any_owned(etl_conn, _etl_schema_name(), uid):
            raise ValueError(
                "ETL 등록 건(연결·테이블·Job·저장 DB·배치 등)이 있으면 ETL 관리자 자격(etl_yn)을 해제할 수 없습니다. "
                "「목록」에서 이관하거나 등록을 정리한 뒤 다시 시도하세요."
            )
    except ValueError:
        raise
    except Exception as ex:
        _log.warning("admin_user etl_db_check_fail op=clear_etl_yn_guard uid=%s: %s", uid, ex)
    finally:
        if etl_conn is not None:
            try:
                etl_conn.close()
            except Exception:
                pass


def _default_project_member_pmssn(cur) -> int:
    cur.execute(
        """
        SELECT pmssn_master_id, pmssn_name
        FROM pmssn_master
        WHERE COALESCE(system_dflt_yn,'') = 'Y' AND dptmt_info_id IS NULL
        ORDER BY pmssn_master_id
        """
    )
    rows = cur.fetchall()
    if not rows:
        raise ValueError("프로젝트 기본 권한(pmssn_master)이 없습니다.")
    for r in rows:
        if (r.get("pmssn_name") or "").strip() == "뷰어":
            return int(r["pmssn_master_id"])
    return int(rows[0]["pmssn_master_id"])


def _count_active_sa_in_department(cur, dptmt_info_id: int) -> int:
    cur.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM user_info
        WHERE dptmt_info_id = %s
          AND LOWER(TRIM(COALESCE(user_dvsn, ''))) = 'sa'
          AND UPPER(TRIM(COALESCE(user_active_yn, 'Y'))) = 'Y'
        """,
        (int(dptmt_info_id),),
    )
    row = cur.fetchone() or {}
    return int(row.get("cnt") or 0)


def _list_project_pmssn_options(cur, project_info_id: int) -> list[dict[str, Any]]:
    cur.execute(
        "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (int(project_info_id),),
    )
    prow = cur.fetchone()
    if not prow:
        return []
    dpt = int(prow["dptmt_info_id"])
    cur.execute(
        """
        SELECT pmssn_master_id, pmssn_name
        FROM pmssn_master
        WHERE (COALESCE(system_dflt_yn,'') = 'Y' AND dptmt_info_id IS NULL)
           OR dptmt_info_id = %s
        ORDER BY system_dflt_yn DESC, pmssn_name
        """,
        (dpt,),
    )
    return [dict(r) for r in cur.fetchall()]


def _assert_pmssn_allowed_for_project(cur, project_info_id: int, pmssn_master_id: int) -> None:
    cur.execute(
        "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (int(project_info_id),),
    )
    prow = cur.fetchone()
    if not prow:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    pdpt = int(prow["dptmt_info_id"])
    cur.execute(
        """
        SELECT dptmt_info_id, COALESCE(system_dflt_yn,'') AS sy
        FROM pmssn_master WHERE pmssn_master_id = %s
        """,
        (int(pmssn_master_id),),
    )
    mrow = cur.fetchone()
    if not mrow:
        raise ValueError("프로젝트 권한(pmssn_master)을 찾을 수 없습니다.")
    mdpt = mrow.get("dptmt_info_id")
    if (mrow.get("sy") or "").upper() == "Y" and mdpt is None:
        return
    if mdpt is not None and int(mdpt) == pdpt:
        return
    raise ValueError("해당 프로젝트에 부여할 수 없는 권한입니다.")


def _enrich_change_option_projects_department_display(
    conn,
    project_rows: list[dict[str, Any]],
) -> None:
    """change-options의 projects[] 행에 project_department_display 부여(최상위 부서: 이름(-), 하위: 상위(자기))."""
    ids: set[int] = set()
    for r in project_rows:
        did = r.get("dptmt_info_id")
        if did is None:
            continue
        try:
            ids.add(int(did))
        except (TypeError, ValueError):
            continue
    if not ids:
        for r in project_rows:
            r["project_department_display"] = "—"
        return
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT d.dptmt_info_id,
                   d.dptmt_name,
                   d.parent_dptmt_info_id,
                   pd.dptmt_name AS parent_dptmt_name
            FROM dptmt_info d
            LEFT JOIN dptmt_info pd ON pd.dptmt_info_id = d.parent_dptmt_info_id
            WHERE d.dptmt_info_id = ANY(%s)
            """,
            (list(ids),),
        )
        by_id: dict[int, dict[str, Any]] = {
            int(row["dptmt_info_id"]): dict(row) for row in cur.fetchall()
        }
    finally:
        cur.close()
    for r in project_rows:
        did = r.get("dptmt_info_id")
        if did is None:
            r["project_department_display"] = "—"
            continue
        try:
            ikey = int(did)
        except (TypeError, ValueError):
            r["project_department_display"] = "—"
            continue
        info = by_id.get(ikey)
        if not info:
            r["project_department_display"] = "—"
            continue
        dname = (info.get("dptmt_name") or "").strip() or "—"
        parent_id = info.get("parent_dptmt_info_id")
        if parent_id is None:
            r["project_department_display"] = f"{dname}(-)"
        else:
            pname = (info.get("parent_dptmt_name") or "").strip() or "—"
            r["project_department_display"] = f"{pname}({dname})"


# 14.
def get_user_change_options(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
) -> dict[str, Any]:
    tid = int(target_user_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_email, user_nickname, user_dvsn, dptmt_info_id,
                   UPPER(TRIM(COALESCE(etl_yn, 'N'))) AS etl_yn
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        target = cur.fetchone()
        if not target:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_target_role_manageable(actor_dvsn, target.get("user_dvsn") or "")
        cur.execute(
            """
            SELECT p.project_info_id, p.project_name, p.dptmt_info_id, pp.pmssn_master_id,
                   COALESCE(pm.pmssn_name,'') AS pmssn_name,
                   CASE WHEN p.dptmt_info_id = %s THEN 'Y' ELSE 'N' END AS assignable_by_actor
            FROM project_ptcpnt_info pp
            INNER JOIN project_info p ON p.project_info_id = pp.project_info_id
            LEFT JOIN pmssn_master pm ON pm.pmssn_master_id = pp.pmssn_master_id
            WHERE pp.ptcpnt_user_id = %s
            ORDER BY p.project_name
            """,
            (int(actor_dptmt), tid),
        )
        current_projects = [dict(r) for r in cur.fetchall()]
        ad = (actor_dvsn or "").strip().lower()
        if ad == "sa_dev":
            cur.execute(
                """
                SELECT project_info_id, project_name, dptmt_info_id, 'Y' AS assignable_by_actor
                FROM project_info
                ORDER BY project_name
                """
            )
        else:
            cur.execute(
                """
                SELECT project_info_id, project_name, dptmt_info_id, 'Y' AS assignable_by_actor
                FROM project_info
                WHERE dptmt_info_id = %s
                ORDER BY project_name
                """,
                (int(actor_dptmt),),
            )
        base_projects = [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
    proj_by_id: dict[int, dict[str, Any]] = {}
    for r in base_projects:
        proj_by_id[int(r["project_info_id"])] = r
    for r in current_projects:
        pid = int(r["project_info_id"])
        if pid not in proj_by_id:
            proj_by_id[pid] = {**r, "assignable_by_actor": "N"}
        else:
            proj_by_id[pid]["pmssn_master_id"] = r.get("pmssn_master_id")
            proj_by_id[pid]["pmssn_name"] = r.get("pmssn_name")
    _enrich_change_option_projects_department_display(conn, list(proj_by_id.values()))
    cur2 = conn.cursor()
    try:
        for pid, obj in proj_by_id.items():
            obj["pmssn_options"] = _list_project_pmssn_options(cur2, pid)
    finally:
        cur2.close()
    ad_actor = (actor_dvsn or "").strip().lower()
    can_manage_etl_yn = ad_actor in ("sa_dev", "sa")
    target_dptmt = int(target.get("dptmt_info_id") or 0)
    cur3 = conn.cursor()
    try:
        cur3.execute(
            "SELECT dptmt_name FROM dptmt_info WHERE dptmt_info_id = %s",
            (target_dptmt,),
        )
        drow = cur3.fetchone() or {}
        dptmt_name = drow.get("dptmt_name")
        last_sa_in_department = False
        if canon_user_dvsn(target.get("user_dvsn")) == "sa" and target_dptmt > 0:
            last_sa_in_department = _count_active_sa_in_department(cur3, target_dptmt) <= 1
    finally:
        cur3.close()
    return {
        "target_user": dict(target),
        "can_manage_etl_yn": can_manage_etl_yn,
        "actor_user_dvsn": canon_user_dvsn(actor_dvsn),
        "last_sa_in_department": last_sa_in_department,
        "last_sa_department_name": dptmt_name or str(target_dptmt or ""),
        "departments": _list_departments_for_change(conn, actor_dvsn, actor_dptmt),
        "user_dvsn_options": [
            {"value": v, "label": v}
            for v in _role_change_allowed_for_actor(actor_dvsn)
        ],
        "projects": sorted(proj_by_id.values(), key=lambda x: str(x.get("project_name") or "")),
        "current_project_ids": sorted(int(r["project_info_id"]) for r in current_projects),
        "current_project_assignments": [
            {
                "project_info_id": int(r["project_info_id"]),
                "pmssn_master_id": int(r["pmssn_master_id"]) if r.get("pmssn_master_id") is not None else None,
            }
            for r in current_projects
        ],
    }


# 15.
def update_user_management(
    conn,
    actor_user_id: int,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    dptmt_info_id: int | None = None,
    user_dvsn: str | None = None,
    project_info_ids: list[int] | None = None,
    project_assignments: list[dict[str, int]] | None = None,
    etl_yn: str | None = None,
) -> None:
    tid = int(target_user_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_dvsn, dptmt_info_id,
                   UPPER(TRIM(COALESCE(etl_yn, 'N'))) AS etl_yn
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        target = cur.fetchone()
        if not target:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_target_role_manageable(actor_dvsn, target.get("user_dvsn") or "")

        mgmt_track: dict[str, Any] = {
            "dvsn": False,
            "etl": False,
            "old_dvsn": None,
            "new_dvsn": None,
            "old_etl": None,
            "new_etl": None,
        }
        proj_changed = False

        cur_etl = str(target.get("etl_yn") or "N").strip().upper()
        if cur_etl not in ("Y", "N"):
            cur_etl = "N"
        cur_dvsn = canon_user_dvsn(target.get("user_dvsn"))
        eff_dvsn = canon_user_dvsn(user_dvsn) if user_dvsn is not None else cur_dvsn
        eff_etl = (
            (etl_yn or "").strip().upper()
            if etl_yn is not None
            else cur_etl
        )
        if eff_etl not in ("Y", "N"):
            eff_etl = "N"
        if eff_dvsn == "u":
            eff_etl = "N"
        if user_dvsn is not None or etl_yn is not None:
            _evaluate_ownership_target_or_raise(
                conn, tid, eff_dvsn, eff_etl, for_suspend=False
            )

        if dptmt_info_id is not None:
            allow_ids = {
                int(r["dptmt_info_id"])
                for r in _list_departments_for_change(conn, actor_dvsn, actor_dptmt)
            }
            nd = int(dptmt_info_id)
            if nd not in allow_ids:
                raise ValueError("해당 부서로는 변경할 수 없습니다.")
            cur.execute(
                audit_sql_catalog.SQL_USER_INFO_SET_DPTMT_ID,
                (nd, tid),
            )

        if user_dvsn is not None:
            td_before = canon_user_dvsn(target.get("user_dvsn"))
            nd = canon_user_dvsn(user_dvsn)
            allowed = set(_role_change_allowed_for_actor(actor_dvsn))
            if nd not in allowed:
                raise ValueError("허용되지 않는 조직 역할로는 변경할 수 없습니다.")
            if td_before != nd:
                mgmt_track["dvsn"] = True
                mgmt_track["old_dvsn"] = td_before
                mgmt_track["new_dvsn"] = nd
                cur.execute(
                    audit_sql_catalog.SQL_USER_ROLE_CHANGE,
                    (nd, tid),
                )
                if nd == "u":
                    # 조직 역할 u 전환 시 DB에서 etl_yn 강제 N — 일괄 알림 요약에 ETL 변경도 포함(2.5·액션 표)
                    if cur_etl == "Y":
                        mgmt_track["etl"] = True
                        mgmt_track["old_etl"] = "Y"
                        mgmt_track["new_etl"] = "N"
                    cur.execute(
                        audit_sql_catalog.SQL_USER_INFO_SET_ETL_YN_FORCE_N,
                        (tid,),
                    )

        if etl_yn is not None:
            flag = (etl_yn or "").strip().upper()
            if flag not in ("Y", "N"):
                raise ValueError("etl_yn은 Y 또는 N이어야 합니다.")
            ad_etl = (actor_dvsn or "").strip().lower()
            if ad_etl not in ("sa_dev", "sa"):
                raise ValueError("ETL 자격 변경 권한이 없습니다.")
            if ad_etl == "sa":
                _assert_target_in_managed_tree(conn, actor_dptmt, tid)
            cur.execute(
                """
                SELECT user_dvsn,
                       UPPER(TRIM(COALESCE(etl_yn, 'N'))) AS etl_yn_u
                FROM user_info WHERE user_id = %s
                """,
                (tid,),
            )
            erow = cur.fetchone()
            if not erow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            td_etl = (erow.get("user_dvsn") or "").strip().lower()
            if td_etl == "sa_dev":
                raise ValueError("SA_DEV 계정의 etl_yn은 변경할 수 없습니다.")
            prev_e = str(erow.get("etl_yn_u") or "N").strip().upper()
            if prev_e != flag:
                mgmt_track["etl"] = True
                mgmt_track["old_etl"] = prev_e
                mgmt_track["new_etl"] = flag
            cur.execute(
                audit_sql_catalog.SQL_USER_ETL_FLAG,
                (flag, tid),
            )

        desired_list = project_assignments if project_assignments is not None else None
        if desired_list is None and project_info_ids is not None:
            desired_list = [
                {"project_info_id": int(x), "pmssn_master_id": _default_project_member_pmssn(cur)}
                for x in (project_info_ids or [])
            ]
        if desired_list is not None:
            desired_map: dict[int, int] = {}
            for a in desired_list:
                pid = int(a.get("project_info_id"))
                mid = int(a.get("pmssn_master_id"))
                desired_map[pid] = mid
            desired = set(desired_map.keys())
            if any(x <= 0 for x in desired):
                raise ValueError("유효하지 않은 프로젝트 ID가 포함되어 있습니다.")
            cur.execute(
                """
                SELECT project_info_id, pmssn_master_id
                FROM project_ptcpnt_info
                WHERE ptcpnt_user_id = %s
                """,
                (tid,),
            )
            current_rows = [dict(r) for r in cur.fetchall()]
            current = {int(r["project_info_id"]) for r in current_rows}
            current_pmssn_by_project = {
                int(r["project_info_id"]): int(r["pmssn_master_id"])
                for r in current_rows
                if r.get("pmssn_master_id") is not None
            }
            remove_ids = sorted(current - desired)
            add_ids = sorted(desired - current)
            same_ids = sorted(current & desired)
            proj_changed = bool(add_ids or remove_ids)
            ad = (actor_dvsn or "").strip().lower()
            if add_ids:
                ph = ", ".join(["%s"] * len(add_ids))
                cur.execute(
                    f"SELECT project_info_id, dptmt_info_id FROM project_info WHERE project_info_id IN ({ph})",
                    tuple(add_ids),
                )
                rows = {int(r["project_info_id"]): int(r["dptmt_info_id"]) for r in cur.fetchall()}
                if len(rows) != len(add_ids):
                    raise ValueError("존재하지 않는 프로젝트가 포함되어 있습니다.")
                if ad != "sa_dev":
                    for pid in add_ids:
                        if rows[pid] != int(actor_dptmt):
                            raise ValueError(
                                "타부서 프로젝트 추가는 허용되지 않습니다. 타부서 프로젝트는 해당 관리자 초대로만 참여 가능합니다."
                            )
                for pid in add_ids:
                    _assert_pmssn_allowed_for_project(cur, pid, desired_map[pid])
                    cur.execute(
                        audit_sql_catalog.SQL_PROJECT_PTCPNT_INFO_INSERT_ON_CONFLICT,
                        (tid, int(actor_user_id), pid, desired_map[pid]),
                    )
            for pid in same_ids:
                if int(current_pmssn_by_project.get(pid, 0)) == int(desired_map[pid]):
                    continue
                if ad != "sa_dev":
                    cur.execute(
                        "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
                        (pid,),
                    )
                    prow = cur.fetchone()
                    if not prow:
                        raise ValueError("프로젝트를 찾을 수 없습니다.")
                    if int(prow["dptmt_info_id"]) != int(actor_dptmt):
                        raise ValueError("타부서 프로젝트 권한은 변경할 수 없습니다.")
                _assert_pmssn_allowed_for_project(cur, pid, desired_map[pid])
                proj_changed = True
                cur.execute(
                    audit_sql_catalog.SQL_MEMBER_ROLE_UPDATE,
                    (desired_map[pid], pid, tid),
                )
            for pid in remove_ids:
                cur.execute(
                    audit_sql_catalog.SQL_MEMBER_REMOVE,
                    (pid, tid),
                )
        conn.commit()
        _emit_admin_system_log(
            actor_user_id,
            business_action="user_management_update",
            risk_tier="HIGH",
            target_summary=f"target_user_id={tid}",
            detail_json={"affected_user_id": tid},
        )
        if mgmt_track["dvsn"] or mgmt_track["etl"] or proj_changed:
            change_notify.notify_user_management_changed(
                conn,
                actor_user_id,
                tid,
                dvsn_changed=bool(mgmt_track["dvsn"]),
                etl_changed=bool(mgmt_track["etl"]),
                proj_changed=proj_changed,
                old_dvsn=mgmt_track["old_dvsn"],
                new_dvsn=mgmt_track["new_dvsn"],
                old_etl=mgmt_track["old_etl"],
                new_etl=mgmt_track["new_etl"],
            )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
