"""
Backend.admin_server.service_users (유저·초대·부서)
================================================
동일 부서 유저 목록, 전역 검색, 초대, 정지/활성, 역할(슈퍼), 초대코드 목록, org.

[Main Functions]
===========
1. list_users_same_dept
2. search_users_by_email (operator 시 동일 부서만)
3. invite_user_by_email (invite_target_dvsn·초대자 역할별 허용 집합)
4. suspend_user / activate_user (actor_dvsn·A는 O/U만)
5. set_user_dvsn_admin_user (admin/SA/sa_dev·매트릭스 범위)
6. list_invite_codes_for_dept
7. get_department / update_department_name

[Dependencies]
=========
- secrets, Backend.auth_server.email_service, Backend.core.auth_config
"""

from __future__ import annotations

import secrets
from typing import Any

from Backend.auth_server import email_service
from Backend.core import auth_config

_INVITE_TARGETS_BY_ACTOR: dict[str, tuple[str, ...]] = {
    "sa_dev": ("etl_manager", "super_admin", "admin", "operator", "user"),
    "super_admin": ("super_admin", "admin", "operator", "user"),
    "admin": ("operator", "user"),
}


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


# 1.
def list_users_same_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_email, user_nickname, user_dvsn, user_active_yn, create_dtm
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
) -> None:
    email_n = _norm_email(target_email)
    if not email_n or "@" not in email_n:
        raise ValueError("유효한 이메일이 필요합니다.")
    target_role = _validate_invite_target_for_actor(actor_dvsn, invite_target_dvsn)
    dptmt_id = int(dptmt_override) if dptmt_override is not None else actor_dptmt_id
    if dptmt_id != actor_dptmt_id:
        raise ValueError("다른 부서로 초대할 수 없습니다.")
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
                exprtn_dtm, used_yn, code_create_user_id, create_dtm
            ) VALUES (%s, %s, %s, %s, NOW() + INTERVAL '7 days', 'N', %s, NOW())
            """,
            (code, email_n, dptmt_id, target_role, actor_user_id),
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
    base = auth_config.get_app_url() or "http://localhost:8080"
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
        if td in ("super_admin", "sa_dev", "etl_manager"):
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
    if nd not in ("admin", "operator", "user", "etl_manager"):
        raise ValueError(
            "user_dvsn은 admin, operator, user, etl_manager 중 하나여야 합니다."
        )
    ad = (actor_dvsn or "").strip().lower()
    if ad not in ("admin", "super_admin", "sa_dev"):
        raise ValueError("역할 변경 권한이 없습니다.")
    if nd == "etl_manager" and ad != "sa_dev":
        raise ValueError("etl_manager 역할은 시스템 관리자(sa_dev)만 부여할 수 있습니다.")
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
        cur_td = (row.get("user_dvsn") or "").strip().lower()
        if cur_td in ("super_admin", "sa_dev"):
            raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
        if cur_td == "etl_manager" and ad != "sa_dev":
            raise ValueError("ETL 매니저 역할은 시스템 관리자만 변경할 수 있습니다.")
        if ad == "admin":
            if cur_td not in ("operator", "user"):
                raise ValueError("부서 관리자는 운영자·일반 사용자만 변경할 수 있습니다.")
            if nd not in ("operator", "user"):
                raise ValueError("부서 관리자는 operator·user만 부여할 수 있습니다.")
        elif ad == "super_admin":
            if cur_td in ("super_admin", "sa_dev", "etl_manager"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if cur_td not in ("admin", "operator", "user"):
                raise ValueError("대상 사용자 역할을 변경할 수 없습니다.")
            if nd not in ("admin", "operator", "user"):
                raise ValueError("허용되지 않는 역할입니다.")
        elif ad == "sa_dev":
            if cur_td in ("super_admin", "sa_dev"):
                raise ValueError("해당 역할은 이 API로 변경할 수 없습니다.")
            if nd not in ("admin", "operator", "user", "etl_manager"):
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
def list_invite_codes_for_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT email_invite_code_master_id, invite_target_email, invite_target_dvsn,
                   exprtn_dtm, used_yn, create_dtm
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


# 7.
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
