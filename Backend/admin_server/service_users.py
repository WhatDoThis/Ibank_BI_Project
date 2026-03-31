"""
Backend.admin_server.service_users (유저·초대·부서)
================================================
동일 부서 유저 목록, 전역 검색, 초대, 정지/활성, 역할(슈퍼), 초대코드 목록, org.
초대 메일 링크는 auth_config.get_app_url() + `/signup`; 공개 베이스는 smtp_info.app_url·backend.app_url·frontend.app_url 중 설정(환경별·localhost 고정 없음).

[Main Functions]
===========
1. list_users_same_dept
2. search_users_by_email (operator 시 동일 부서만)
3. invite_user_by_email (초대 역할·부서 트리·ETL·U+프로젝트)
3b. list_departments_for_invite / assert_invite_dptmt_allowed
4. suspend_user / activate_user (_assert_target_exists_or_same_dept·SA_DEV 우회)
5. set_user_dvsn_admin_user (admin/SA/sa_dev·5역할만)
6. set_user_etl_flag (SA·sa_dev·etl_yn)
7. list_invite_codes_for_dept
8. get_department / update_department_name

[Dependencies]
=========
- secrets, logging
- Backend.auth_server.email_service, Backend.core.auth_config
- Backend.admin_server.service_projects.validate_invite_user_project
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

from Backend.admin_server import service_projects
from Backend.auth_server import email_service
from Backend.core import auth_config

_log = logging.getLogger(__name__)

_INVITE_TARGETS_BY_ACTOR: dict[str, tuple[str, ...]] = {
    "sa_dev": ("super_admin", "admin", "operator", "user"),
    "super_admin": ("super_admin", "admin", "operator", "user"),
    "admin": ("admin", "operator", "user"),
}


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
            cur.execute(
                """
                SELECT dptmt_info_id, dptmt_name, parent_dptmt_info_id
                FROM dptmt_info
                WHERE COALESCE(use_yn, 'Y') = 'Y'
                  AND dptmt_info_id > 0
                ORDER BY dptmt_name NULLS LAST
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
    td = (invite_target_dvsn or "").strip().lower() or "user"
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
    assert_invite_dptmt_allowed(conn, ad, int(actor_dptmt_id), dptmt_id)

    raw_etl = (invite_etl_yn or "N").strip().upper()
    if raw_etl not in ("Y", "N"):
        raise ValueError("invite_etl_yn은 Y 또는 N이어야 합니다.")
    if ad == "admin":
        etl_store = "N"
    elif ad in ("super_admin", "sa_dev"):
        etl_store = raw_etl
    else:
        etl_store = "N"

    proj_id = invite_project_info_id
    pmssn_id = invite_pmssn_master_id
    if target_role != "user":
        if proj_id is not None or pmssn_id is not None:
            raise ValueError("프로젝트·역할 지정은 user 초대일 때만 가능합니다.")
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


def _assert_target_exists_or_same_dept(
    conn, actor_dptmt: int, actor_dvsn: str, target_user_id: int
) -> None:
    """SA_DEV는 부서 제한 없이 대상 존재만 확인, 나머지는 동일 부서 검증."""
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
    _assert_same_dept(conn, actor_dptmt, target_user_id)


def _assert_suspend_activate_target(actor_dvsn: str, target_user_dvsn: str) -> None:
    ad = (actor_dvsn or "").strip().lower()
    td = (target_user_dvsn or "").strip().lower()
    if ad == "admin":
        if td not in ("operator", "user"):
            raise ValueError(
                "부서 관리자는 운영자·일반 사용자만 정지·활성 처리할 수 있습니다."
            )
        return
    if ad == "super_admin":
        if td in ("super_admin", "sa_dev"):
            raise ValueError("해당 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        if td not in ("admin", "operator", "user"):
            raise ValueError("대상 사용자를 정지·활성 처리할 수 없습니다.")
        return
    if ad == "sa_dev":
        if td in ("super_admin", "sa_dev"):
            raise ValueError("해당 역할은 이 API로 정지·활성 처리할 수 없습니다.")
        return
    raise ValueError("정지·활성 처리 권한이 없습니다.")


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
    if nd not in ("admin", "operator", "user"):
        raise ValueError("user_dvsn은 admin, operator, user 중 하나여야 합니다.")
    ad = (actor_dvsn or "").strip().lower()
    if ad not in ("admin", "super_admin", "sa_dev"):
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
        if cur_td in ("super_admin", "sa_dev"):
            raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
        if ad == "admin":
            if cur_td not in ("operator", "user"):
                raise ValueError("부서 관리자는 운영자·일반 사용자만 변경할 수 있습니다.")
            if nd not in ("operator", "user"):
                raise ValueError("부서 관리자는 operator·user만 부여할 수 있습니다.")
        elif ad == "super_admin":
            if cur_td in ("super_admin", "sa_dev"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if cur_td not in ("admin", "operator", "user"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if nd not in ("admin", "operator", "user"):
                raise ValueError("허용되지 않는 역할입니다.")
        elif ad == "sa_dev":
            if cur_td in ("super_admin", "sa_dev"):
                raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
            if nd not in ("admin", "operator", "user"):
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
    if ad not in ("sa_dev", "super_admin"):
        raise ValueError("ETL 자격 변경 권한이 없습니다.")
    if ad == "super_admin":
        _assert_same_dept(conn, actor_dptmt, target_user_id)
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
