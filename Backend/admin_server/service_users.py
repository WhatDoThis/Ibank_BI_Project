"""
Backend.admin_server.service_users (유저·초대·부서)
================================================
동일 부서 유저 목록, 전역 검색, 초대, 정지/활성, 역할(슈퍼), 초대코드 목록, org.
초대 메일 링크는 auth_config.get_app_url() + `/signup`; 공개 베이스는 smtp_info.app_url·backend.app_url·frontend.app_url 중 설정(환경별·localhost 고정 없음).

[Main Functions]
===========
1. list_users_same_dept(단순 동일 부서)
1b. list_users_for_admin_ui(sa_dev 전역·부서명/정렬·ETL 목록용)
2. search_users_by_email (operator 시 동일 부서만)
3. invite_user_by_email (초대 역할·부서 트리·ETL·U+프로젝트, UndefinedColumn 시 DDL 안내)
3b. list_departments_for_invite / assert_invite_dptmt_allowed
4. suspend_user / activate_user (_assert_target_exists_or_same_dept·SA_DEV 우회)
5. set_user_dvsn_admin_user (a/sa/sa_dev·a·o·u 부여)
6. set_user_etl_flag (sa·sa_dev·etl_yn)
7. list_invite_codes_for_dept
8. get_department / update_department_name
9. list_departments_for_org_settings(id≠0·미사용 포함) / create_department / update_department_in_org_settings(이름·코드·use_yn) / delete_department_in_org_settings(행 DELETE·sa는 본인 부서 행 금지)
10. _assert_department_clear_for_invalidate_or_remove — use_yn=N·DELETE 전 dptmt_info_id 참조(하위 부서·유저·초대·프로젝트·부서 역할) 검사
11. get_user_work_assets — 생성·참여 프로젝트, 커스텀 역할, 연결 테이블 요약(이관 가능 플래그)
12. list_ownership_transfer_targets — 부서 내 sa_dev·sa·a 활성 사용자(소스 제외, 부서 트리 검증)
13. transfer_resource_ownership — project_create_user_id·pmssn_master.user_id 이관
14. user_has_transferable_ownership — 정지 전 생성자 자산(project·커스텀 역할) 존재 여부
15. get_user_change_options / update_user_management — 부서·역할·프로젝트 참여 변경

[Dependencies]
=========
- secrets, logging, psycopg2.errors(UndefinedColumn → 안내용 ValueError)
- Backend.auth_server.email_service, Backend.core.auth_config
- Backend.core.user_dvsn_codes.canon_user_dvsn
- Backend.admin_server.service_projects.validate_invite_user_project
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

import psycopg2.errors

from Backend.admin_server import service_projects
from Backend.auth_server import email_service
from Backend.core import auth_config
from Backend.core.user_dvsn_codes import canon_user_dvsn

_log = logging.getLogger(__name__)

_INVITE_TARGETS_BY_ACTOR: dict[str, tuple[str, ...]] = {
    "sa_dev": ("sa", "a", "o", "u"),
    "sa": ("sa", "a", "o", "u"),
    "a": ("a", "o", "u"),
}

# 프로젝트·부서 커스텀 역할 생성자 이관 허용 수신자(05 문서: 프로젝트/역할 생성 가능 역할)
_OWNERSHIP_TRANSFER_ELIGIBLE: frozenset[str] = frozenset({"sa_dev", "sa", "a"})
_DVSN_RANK: dict[str, int] = {"u": 1, "o": 2, "a": 3, "sa": 4, "sa_dev": 5}


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


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


# 3b.
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
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


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
    """sa_dev는 전사 user, 그 외 어드민은 본인 부서 트리(본인+하위). 정렬: 부서 트리 그룹 → 역할(sa_dev·sa·a·o·u) → 동일 역할 시 etl Y 우선 → 이메일."""
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


# 2.
def search_users_by_email(
    conn,
    q: str,
    limit: int = 30,
    scope_dptmt_id: int | None = None,
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
            cur.execute(
                """
                SELECT u.user_id, u.user_email, u.user_nickname, u.user_dvsn, u.dptmt_info_id, d.dptmt_name
                FROM user_info u
                LEFT JOIN dptmt_info d ON d.dptmt_info_id = u.dptmt_info_id
                WHERE UPPER(TRIM(COALESCE(u.user_active_yn,''))) = 'Y'
                  AND LOWER(u.user_email) LIKE LOWER(%s)
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
        raise ValueError(f"해당 역할로는 '{td}' 역할 초대가 허용되지 않습니다.")
    return td


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
            raise ValueError("프로젝트·역할 지정은 u(일반 사용자) 초대일 때만 가능합니다.")
    else:
        if (proj_id is None) ^ (pmssn_id is None):
            raise ValueError("프로젝트와 역할(pmssn_master_id)은 함께 지정하거나 비워야 합니다.")
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
            """
            INSERT INTO email_invite_code_master (
                email_invite_code, invite_target_email, dptmt_info_id, invite_target_dvsn,
                exprtn_dtm, used_yn, code_create_user_id, create_dtm,
                invite_etl_yn, invite_project_info_id, invite_pmssn_master_id
            ) VALUES (
                %s, %s, %s, %s, NOW() + INTERVAL '7 days', 'N', %s, NOW(),
                %s, %s, %s
            )
            """,
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
    except ValueError:
        conn.rollback()
        raise
    except psycopg2.errors.UndefinedColumn as e:
        conn.rollback()
        _log.warning(
            "[invite_user_by_email] DB column missing: %s",
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
        try:
            email_service.send_invite_email(email_n, url)
        except Exception:
            pass


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
            raise ValueError("해당 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        if td not in ("a", "o", "u"):
            raise ValueError("대상 사용자를 정지·활성 처리할 수 없습니다.")
        return
    if ad == "sa_dev":
        if td in ("sa", "sa_dev"):
            raise ValueError("해당 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        return
    raise ValueError("정지·활성 처리 권한이 없습니다.")


def user_has_transferable_ownership(conn, user_id: int) -> bool:
    """project_create_user_id 또는 커스텀 pmssn 등록자면 정지 전 이관 필요."""
    uid = int(user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM project_info WHERE project_create_user_id = %s LIMIT 1",
            (uid,),
        )
        if cur.fetchone():
            return True
        cur.execute(
            """
            SELECT 1 FROM pmssn_master
            WHERE user_id = %s AND COALESCE(system_dflt_yn, '') <> 'Y'
            LIMIT 1
            """,
            (uid,),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


def suspend_user(conn, actor_dptmt: int, actor_dvsn: str, target_user_id: int) -> None:
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
        if user_has_transferable_ownership(conn, int(target_user_id)):
            raise ValueError(
                "이관이 필요한 항목이 있습니다. 생성한 프로젝트 또는 커스텀 역할을 "
                "「목록」에서 다른 사용자에게 이관한 뒤 정지할 수 있습니다."
            )
        cur.execute(
            "UPDATE user_info SET user_active_yn = 'N', update_dtm = NOW() WHERE user_id = %s",
            (target_user_id,),
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


def activate_user(conn, actor_dptmt: int, actor_dvsn: str, target_user_id: int) -> None:
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
            "UPDATE user_info SET user_active_yn = 'Y', update_dtm = NOW() WHERE user_id = %s",
            (target_user_id,),
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
def set_user_dvsn_admin_user(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    new_dvsn: str,
) -> None:
    nd = (new_dvsn or "").strip().lower()
    if nd not in ("a", "o", "u"):
        raise ValueError("user_dvsn은 a, o, u 중 하나여야 합니다.")
    ad = (actor_dvsn or "").strip().lower()
    if ad not in ("a", "sa", "sa_dev"):
        raise ValueError("역할 변경 권한이 없습니다.")
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
            raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
        if ad == "a":
            if cur_td not in ("o", "u"):
                raise ValueError("부서 관리자는 운영자·일반 사용자만 변경할 수 있습니다.")
            if nd not in ("o", "u"):
                raise ValueError("부서 관리자는 o·u만 부여할 수 있습니다.")
        elif ad == "sa":
            if cur_td in ("sa", "sa_dev"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if cur_td not in ("a", "o", "u"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if nd not in ("a", "o", "u"):
                raise ValueError("허용되지 않는 역할입니다.")
        elif ad == "sa_dev":
            if cur_td in ("sa", "sa_dev"):
                raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
            if nd not in ("a", "o", "u"):
                raise ValueError("허용되지 않는 역할입니다.")
        cur.execute(
            "UPDATE user_info SET user_dvsn = %s, update_dtm = NOW() WHERE user_id = %s",
            (nd, target_user_id),
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


# 6.
def set_user_etl_flag(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    target_user_id: int,
    etl_yn: str,
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
            "SELECT user_dvsn FROM user_info WHERE user_id = %s",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        td = (row.get("user_dvsn") or "").strip().lower()
        if td == "sa_dev":
            raise ValueError("SA_DEV 계정의 etl_yn은 변경할 수 없습니다.")
        cur.execute(
            "UPDATE user_info SET etl_yn = %s, update_dtm = NOW() WHERE user_id = %s",
            (flag, target_user_id),
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


def list_departments_for_org_settings(
    conn, actor_dvsn: str, actor_dptmt_id: int
) -> list[dict[str, Any]]:
    """
    부서 관리 화면 목록. dptmt_info_id=0 행은 제외(어떤 역할도 미표시).
    SA_DEV: 전체(사용/미사용 포함). sa: 본인 소속 부서 루트 하위 트리(use_yn 무관).
    """
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        if ad == "sa_dev":
            cur.execute(
                """
                SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                       p.dptmt_name AS parent_dptmt_name, p.dptmt_code AS parent_dptmt_code,
                       d.sort_order, d.use_yn, d.create_dtm
                FROM dptmt_info d
                LEFT JOIN dptmt_info p ON p.dptmt_info_id = d.parent_dptmt_info_id
                WHERE d.dptmt_info_id <> 0
                ORDER BY d.dptmt_info_id
                """
            )
        elif ad == "sa":
            aid = int(actor_dptmt_id)
            if aid == 0:
                return []
            cur.execute(
                """
                WITH RECURSIVE sub AS (
                    SELECT dptmt_info_id, dptmt_code, dptmt_name, parent_dptmt_info_id, sort_order, use_yn, create_dtm
                    FROM dptmt_info
                    WHERE dptmt_info_id = %s
                    UNION ALL
                    SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                           d.sort_order, d.use_yn, d.create_dtm
                    FROM dptmt_info d
                    INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
                    WHERE d.dptmt_info_id <> 0
                )
                SELECT d.dptmt_info_id, d.dptmt_code, d.dptmt_name, d.parent_dptmt_info_id,
                       p.dptmt_name AS parent_dptmt_name, p.dptmt_code AS parent_dptmt_code,
                       d.sort_order, d.use_yn, d.create_dtm
                FROM sub d
                LEFT JOIN dptmt_info p ON p.dptmt_info_id = d.parent_dptmt_info_id
                WHERE d.dptmt_info_id <> 0
                ORDER BY d.dptmt_info_id
                """,
                (aid,),
            )
        else:
            return []
        return [dict(r) for r in cur.fetchall()]
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


def _assert_department_clear_for_invalidate_or_remove(conn, tid: int) -> None:
    """
    # 10b. [부서 비활성·삭제]
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
            reasons.append(f"부서 역할(pmssn_master) {n}건")
    finally:
        cur.close()

    if not reasons:
        return
    raise ValueError(
        "이 부서를 참조하는 데이터가 있어 비활성화하거나 삭제할 수 없습니다: "
        + ", ".join(reasons)
        + ". 참조를 정리한 뒤 다시 시도하거나, 부서명·코드만 수정하세요."
    )


def update_department_in_org_settings(
    conn,
    dptmt_info_id: int,
    new_name: str | None,
    new_code: str | None,
    new_use_yn: str | None,
    actor_dvsn: str,
    actor_dptmt_id: int,
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
    _assert_actor_can_manage_department(conn, eff, int(actor_dptmt_id), int(dptmt_info_id))
    if has_use and use_v == "N":
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
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_department_in_org_settings(
    conn, dptmt_info_id: int, actor_dvsn: str, actor_dptmt_id: int
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
            "DELETE FROM dptmt_info WHERE dptmt_info_id = %s",
            (tid,),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("부서를 찾을 수 없습니다.")
        conn.commit()
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
            """
            INSERT INTO dptmt_info (
                dptmt_code, dptmt_name, parent_dptmt_info_id, sort_order, use_yn,
                dptmt_create_user_id, create_dtm, update_dtm
            ) VALUES (%s, %s, %s, 0, 'Y', %s, NOW(), NOW())
            RETURNING dptmt_info_id
            """,
            (code[:80], name[:100], pid, int(actor_user_id)),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise ValueError("부서 등록에 실패했습니다.")
        new_id = int(row["dptmt_info_id"] if hasattr(row, "get") else row[0])
        conn.commit()
        return new_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def update_department_name(conn, dptmt_info_id: int, new_name: str) -> None:
    name = (new_name or "").strip()
    if not name:
        raise ValueError("부서명이 필요합니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE dptmt_info SET dptmt_name = %s, update_dtm = NOW() WHERE dptmt_info_id = %s",
            (name, dptmt_info_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("부서를 찾을 수 없습니다.")
        conn.commit()
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
    """대상 사용자의 작업물 요약. table_master는 생성자 FK가 없어 조회만, ETL은 별도 DB·문자열 등록자만 있어 안내문만."""
    tid = int(target_user_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
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
            SELECT DISTINCT m.table_master_id, m.db_type, m.table_name,
                   COALESCE(m.table_label, '') AS table_label
            FROM table_master m
            INNER JOIN table_project_mapping tpm ON tpm.table_master_id = m.table_master_id
            INNER JOIN project_info pi ON pi.project_info_id = tpm.project_info_id
            WHERE pi.project_create_user_id = %s
            ORDER BY m.table_name
            """,
            (tid,),
        )
        linked_tables = [
            {
                **dict(r),
                "transferable": False,
                "kind": "table",
                "note": "table_master에 생성자 FK가 없어 이관 API는 제공하지 않습니다.",
            }
            for r in cur.fetchall()
        ]
    finally:
        cur.close()
    return {
        "created_projects": created_projects,
        "participant_projects": participant_projects,
        "created_custom_roles": created_custom_roles,
        "linked_tables": linked_tables,
        "etl_assets_note": (
            "ETL 원천·테이블·작업 메타는 etl_db 등 별도 연결에 있으며 등록자는 문자열 필드 위주라 "
            "system_db 기준 생성자 이관은 지원하지 않습니다."
        ),
    }


# 12.
def list_ownership_transfer_targets(
    conn,
    actor_dvsn: str,
    actor_dptmt_id: int,
    dept_id: int,
    exclude_user_id: int,
) -> list[dict[str, Any]]:
    assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt_id, int(dept_id))
    ex = int(exclude_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_email, user_nickname, user_dvsn
            FROM user_info
            WHERE dptmt_info_id = %s
              AND user_id <> %s
              AND UPPER(TRIM(COALESCE(user_active_yn, ''))) = 'Y'
            ORDER BY user_email
            """,
            (int(dept_id), ex),
        )
        rows = [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
    out: list[dict[str, Any]] = []
    for r in rows:
        cd = canon_user_dvsn(r.get("user_dvsn"))
        if cd in _OWNERSHIP_TRANSFER_ELIGIBLE:
            out.append(r)
    return out


# 13.
def transfer_resource_ownership(
    conn,
    actor_dptmt: int,
    actor_dvsn: str,
    resource_type: str,
    resource_id: int,
    from_user_id: int,
    to_user_id: int,
) -> None:
    rt = (resource_type or "").strip().lower()
    rid = int(resource_id)
    fid = int(from_user_id)
    tid = int(to_user_id)
    if fid == tid:
        raise ValueError("동일 사용자로는 이관할 수 없습니다.")
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, fid)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, dptmt_info_id, user_dvsn,
                   UPPER(TRIM(COALESCE(user_active_yn,''))) AS ua
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        to_row = cur.fetchone()
        if not to_row:
            raise ValueError("이관 대상 사용자를 찾을 수 없습니다.")
        if (to_row.get("ua") or "") != "Y":
            raise ValueError("비활성 사용자에게는 이관할 수 없습니다.")
        if canon_user_dvsn(to_row.get("user_dvsn")) not in _OWNERSHIP_TRANSFER_ELIGIBLE:
            raise ValueError(
                "이관 가능한 역할은 sa_dev·Super Admin(sa)·Admin(a) 만입니다."
            )
        to_dpt = int(to_row["dptmt_info_id"])
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
                """
                UPDATE project_info
                SET project_create_user_id = %s, update_dtm = NOW()
                WHERE project_info_id = %s
                """,
                (tid, rid),
            )
            conn.commit()
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
                raise ValueError("역할을 찾을 수 없습니다.")
            if (mrow.get("sy") or "").upper() == "Y":
                raise ValueError("시스템 기본 역할은 이관할 수 없습니다.")
            if int(mrow["user_id"]) != fid:
                raise ValueError("해당 사용자가 등록자가 아닌 역할입니다.")
            md = int(mrow["dptmt_info_id"] or 0)
            if md and to_dpt != md:
                raise ValueError("이관 대상은 역할 소속 부서와 동일한 부서 사용자여야 합니다.")
            assert_invite_dptmt_allowed(conn, actor_dvsn, actor_dptmt, md)
            cur.execute(
                """
                UPDATE pmssn_master
                SET user_id = %s, update_dtm = NOW()
                WHERE pmssn_master_id = %s
                """,
                (tid, rid),
            )
            conn.commit()
            return
        raise ValueError("지원하지 않는 리소스 유형입니다.")
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


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
        raise ValueError("허용되지 않은 역할 코드입니다.")
    if _DVSN_RANK.get(td, 0) > _DVSN_RANK.get(ad, 0):
        raise ValueError("본인보다 상위 역할 사용자는 변경할 수 없습니다.")


def _list_departments_for_change(conn, actor_dvsn: str, actor_dptmt_id: int) -> list[dict[str, Any]]:
    ad = (actor_dvsn or "").strip().lower()
    cur = conn.cursor()
    try:
        if ad == "sa_dev":
            cur.execute(
                """
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                FROM dptmt_info
                ORDER BY dptmt_name NULLS LAST
                """
            )
            return [dict(r) for r in cur.fetchall()]
        cur.execute(
            """
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                FROM dptmt_info WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id, d.dptmt_name, d.parent_dptmt_info_id
                FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
            )
            SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
            FROM sub
            ORDER BY dptmt_name NULLS LAST
            """,
            (int(actor_dptmt_id),),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def _user_has_role_change_blockers(cur, user_id: int) -> bool:
    uid = int(user_id)
    cur.execute("SELECT 1 FROM dptmt_info WHERE dptmt_create_user_id = %s LIMIT 1", (uid,))
    if cur.fetchone():
        return True
    cur.execute("SELECT 1 FROM project_info WHERE project_create_user_id = %s LIMIT 1", (uid,))
    if cur.fetchone():
        return True
    cur.execute(
        """
        SELECT 1 FROM pmssn_master
        WHERE user_id = %s AND COALESCE(system_dflt_yn,'') <> 'Y'
        LIMIT 1
        """,
        (uid,),
    )
    if cur.fetchone():
        return True
    # table_master는 생성자 FK가 없어 직접 판별 불가. 현재 스키마 기준으로는 프로젝트 생성자 소유만 검증.
    return False


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
        raise ValueError("프로젝트 기본 역할(pmssn_master)이 없습니다.")
    for r in rows:
        if (r.get("pmssn_name") or "").strip() == "뷰어":
            return int(r["pmssn_master_id"])
    return int(rows[0]["pmssn_master_id"])


def _list_project_role_options(cur, project_info_id: int) -> list[dict[str, Any]]:
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
            SELECT user_id, user_email, user_nickname, user_dvsn, dptmt_info_id
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
    cur2 = conn.cursor()
    try:
        for pid, obj in proj_by_id.items():
            obj["role_options"] = _list_project_role_options(cur2, pid)
    finally:
        cur2.close()
    return {
        "target_user": dict(target),
        "departments": _list_departments_for_change(conn, actor_dvsn, actor_dptmt),
        "role_options": [
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
) -> None:
    tid = int(target_user_id)
    _assert_target_exists_or_same_dept(conn, actor_dptmt, actor_dvsn, tid)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_dvsn, dptmt_info_id
            FROM user_info WHERE user_id = %s
            """,
            (tid,),
        )
        target = cur.fetchone()
        if not target:
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_target_role_manageable(actor_dvsn, target.get("user_dvsn") or "")

        if dptmt_info_id is not None:
            allow_ids = {
                int(r["dptmt_info_id"])
                for r in _list_departments_for_change(conn, actor_dvsn, actor_dptmt)
            }
            nd = int(dptmt_info_id)
            if nd not in allow_ids:
                raise ValueError("해당 부서로는 변경할 수 없습니다.")
            cur.execute(
                "UPDATE user_info SET dptmt_info_id = %s, update_dtm = NOW() WHERE user_id = %s",
                (nd, tid),
            )

        if user_dvsn is not None:
            nd = canon_user_dvsn(user_dvsn)
            allowed = set(_role_change_allowed_for_actor(actor_dvsn))
            if nd not in allowed:
                raise ValueError("해당 역할로는 변경할 수 없습니다.")
            if _user_has_role_change_blockers(cur, tid):
                raise ValueError(
                    "해당 사용자는 생성한 부서·프로젝트·역할 등의 생성물이 있어 역할을 변경할 수 없습니다."
                )
            cur.execute(
                "UPDATE user_info SET user_dvsn = %s, update_dtm = NOW() WHERE user_id = %s",
                (nd, tid),
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
            current_role = {
                int(r["project_info_id"]): int(r["pmssn_master_id"])
                for r in current_rows
                if r.get("pmssn_master_id") is not None
            }
            remove_ids = sorted(current - desired)
            add_ids = sorted(desired - current)
            same_ids = sorted(current & desired)
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
                        """
                        INSERT INTO project_ptcpnt_info (
                            ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
                        ) VALUES (%s, %s, %s, %s, NOW())
                        ON CONFLICT (project_info_id, ptcpnt_user_id) DO NOTHING
                        """,
                        (tid, int(actor_user_id), pid, desired_map[pid]),
                    )
            for pid in same_ids:
                if int(current_role.get(pid, 0)) == int(desired_map[pid]):
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
                cur.execute(
                    """
                    UPDATE project_ptcpnt_info
                    SET pmssn_master_id = %s, update_dtm = NOW()
                    WHERE project_info_id = %s AND ptcpnt_user_id = %s
                    """,
                    (desired_map[pid], pid, tid),
                )
            for pid in remove_ids:
                cur.execute(
                    """
                    DELETE FROM project_ptcpnt_info
                    WHERE project_info_id = %s AND ptcpnt_user_id = %s
                    """,
                    (pid, tid),
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
