"""
Backend.auth_server.service (가입·로그인·세션 비즈니스)
=====================================================
system_db 트랜잭션·쿼리. 라우터는 ValueError → HTTPException 매핑.

[Main Functions]
===========
1. invite_validate_row: 초대코드 행 조회(프로젝트명·역할명 JOIN)
2. signup_with_invite: 초대 가입(user_dvsn·etl_yn·U 시 프로젝트 멤버)
3. create_org_and_user: 부서+슈퍼어드민 트랜잭션(validate_password_strength)
4. login_send_code: 1단계 비번 검증·OTP 저장·pre_auth 발급
5. verify_login_complete: 2단계·세션·토큰(세션 INSERT 후 토큰 1회 생성)
6. refresh_session_tokens: 슬라이딩 리프레시(project claim 유지)
7. rotate_session_tokens_with_project: 프로젝트 선택 시 access·refresh 재발급
8. logout_one_session: 세션 1건 만료
9. invalidate_all_sessions: 유저 전체 세션 만료
10. get_user_profile: 마이페이지용
11. update_user_nickname / change_password(신규 비밀번호 validate_password_strength)
12. insert_login_log
13. fetch_login_history_masked: 최근 10건 IP 마스킹

[Dependencies]
=========
- Backend.admin_server.service_projects.validate_invite_user_project
- Backend.auth_server.security, Backend.core.auth_config
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import jwt

from Backend.admin_server import service_projects as admin_projects
from Backend.auth_server import email_service, security
from Backend.core import auth_config

_log = logging.getLogger(__name__)

_SIGNUP_DVSN_ALLOWED = frozenset({"sa", "a", "o", "u"})


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


# 1.
def invite_validate_row(conn, code: str) -> dict[str, Any] | None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT e.email_invite_code_master_id,
                   e.invite_target_email,
                   e.invite_target_dvsn,
                   e.exprtn_dtm,
                   e.used_yn,
                   d.dptmt_name,
                   d.dptmt_info_id,
                   e.code_create_user_id,
                   COALESCE(e.invite_etl_yn, 'N') AS invite_etl_yn,
                   e.invite_project_info_id,
                   e.invite_pmssn_master_id,
                   pi.project_name AS invite_project_name,
                   pm.pmssn_name AS invite_pmssn_name
            FROM email_invite_code_master e
            JOIN dptmt_info d ON d.dptmt_info_id = e.dptmt_info_id
            LEFT JOIN project_info pi ON pi.project_info_id = e.invite_project_info_id
            LEFT JOIN pmssn_master pm ON pm.pmssn_master_id = e.invite_pmssn_master_id
            WHERE e.email_invite_code = %s
            """,
            (code.strip(),),
        )
        return cur.fetchone()
    finally:
        cur.close()


# 2.
def signup_with_invite(conn, invite_code: str, email: str, password: str, nickname: str) -> int:
    email_n = _norm_email(email)
    row = invite_validate_row(conn, invite_code)
    if not row:
        raise ValueError("유효하지 않은 초대 코드입니다.")
    if (row.get("used_yn") or "").upper() == "Y":
        raise ValueError("이미 사용된 초대 코드입니다.")
    ex = row.get("exprtn_dtm")
    if ex is not None and ex < datetime.now():
        raise ValueError("만료된 초대 코드입니다.")
    target = _norm_email(row.get("invite_target_email") or "")
    if target != email_n:
        raise ValueError("초대된 이메일과 일치하지 않습니다.")
    raw_dvsn = row.get("invite_target_dvsn")
    if raw_dvsn is None or str(raw_dvsn).strip() == "":
        effective_dvsn = "u"
    else:
        effective_dvsn = str(raw_dvsn).strip().lower()
    if effective_dvsn not in _SIGNUP_DVSN_ALLOWED:
        raise ValueError("초대 코드의 역할 정보가 올바르지 않습니다.")
    dptmt_id = row["dptmt_info_id"]
    etl_inv = (row.get("invite_etl_yn") or "N").strip().upper()
    if etl_inv not in ("Y", "N"):
        etl_inv = "N"
    raw_proj = row.get("invite_project_info_id")
    raw_pmssn = row.get("invite_pmssn_master_id")
    inviter_uid = row.get("code_create_user_id")
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id FROM user_info WHERE LOWER(TRIM(user_email)) = %s",
            (email_n,),
        )
        if cur.fetchone():
            raise ValueError("이미 가입된 이메일입니다.")
        security.validate_password_strength(password)
        p_hash = security.hash_password(password)
        nick = (nickname or "").strip() or email_n.split("@")[0]
        cur.execute(
            """
            INSERT INTO user_info (
                user_email, pswd_hash, user_active_yn, user_dvsn, auth_yn,
                dptmt_info_id, user_nickname, etl_yn, create_dtm
            ) VALUES (%s, %s, 'Y', %s, 'Y', %s, %s, %s, NOW())
            RETURNING user_id
            """,
            (email_n, p_hash, effective_dvsn, dptmt_id, nick, etl_inv),
        )
        uid = int(cur.fetchone()["user_id"])
        if (
            effective_dvsn == "u"
            and raw_proj is not None
            and raw_pmssn is not None
            and inviter_uid is not None
        ):
            admin_projects.validate_invite_user_project(
                conn, int(dptmt_id), int(raw_proj), int(raw_pmssn)
            )
            cur.execute(
                """
                INSERT INTO project_ptcpnt_info (
                    ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm
                ) VALUES (%s, %s, %s, %s, NOW())
                """,
                (uid, int(inviter_uid), int(raw_proj), int(raw_pmssn)),
            )
        cur.execute(
            "UPDATE email_invite_code_master SET used_yn = 'Y', update_dtm = NOW() WHERE email_invite_code = %s",
            (invite_code.strip(),),
        )
        conn.commit()
        return uid
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 3.
def create_org_and_user(conn, org_name: str, email: str, password: str, nickname: str) -> int:
    email_n = _norm_email(email)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id FROM user_info WHERE LOWER(TRIM(user_email)) = %s",
            (email_n,),
        )
        if cur.fetchone():
            raise ValueError("이미 가입된 이메일입니다.")
        name = (org_name or "").strip()
        if not name:
            raise ValueError("부서명이 필요합니다.")
        cur.execute(
            """
            INSERT INTO dptmt_info (dptmt_name, use_yn, dptmt_create_user_id, create_dtm)
            VALUES (%s, 'Y', NULL, NOW())
            RETURNING dptmt_info_id
            """,
            (name,),
        )
        dptmt_id = cur.fetchone()["dptmt_info_id"]
        security.validate_password_strength(password)
        p_hash = security.hash_password(password)
        nick = (nickname or "").strip() or email_n.split("@")[0]
        cur.execute(
            """
            INSERT INTO user_info (
                user_email, pswd_hash, user_active_yn, user_dvsn, auth_yn,
                dptmt_info_id, user_nickname, create_dtm
            ) VALUES (%s, %s, 'Y', 'sa', 'Y', %s, %s, NOW())
            RETURNING user_id
            """,
            (email_n, p_hash, dptmt_id, nick),
        )
        uid = cur.fetchone()["user_id"]
        cur.execute(
            "UPDATE dptmt_info SET dptmt_create_user_id = %s, update_dtm = NOW() WHERE dptmt_info_id = %s",
            (uid, dptmt_id),
        )
        conn.commit()
        return uid
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 4.
def login_send_code(
    conn, email: str, password: str, client_ip: str = "", user_agent: str = ""
) -> tuple[str, int]:
    email_n = _norm_email(email)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, pswd_hash, user_active_yn, user_lock_yn, dptmt_info_id
            FROM user_info WHERE LOWER(TRIM(user_email)) = %s
            """,
            (email_n,),
        )
        row = cur.fetchone()
        if not row:
            conn.commit()
            raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")
        if not security.verify_password(password, row.get("pswd_hash") or ""):
            insert_login_log(conn, row["user_id"], client_ip, "N", user_agent or "")
            conn.commit()
            raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")
        if (row.get("user_active_yn") or "").upper() != "Y":
            insert_login_log(conn, row["user_id"], client_ip, "N", user_agent or "")
            conn.commit()
            raise ValueError("비활성화된 계정입니다.")
        if (row.get("user_lock_yn") or "").upper() == "Y":
            insert_login_log(conn, row["user_id"], client_ip, "N", user_agent or "")
            conn.commit()
            raise ValueError("잠긴 계정입니다. 관리자에게 문의하세요.")
        code = security.generate_numeric_code(6)
        code_hash = security.hash_otp_code(code)
        cur.execute(
            """
            UPDATE user_info SET scnd_auth_token = %s, scnd_auth_expire_dtm = NOW() + INTERVAL '5 minutes', update_dtm = NOW()
            WHERE user_id = %s
            """,
            (code_hash, row["user_id"]),
        )
        conn.commit()
    except ValueError:
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    try:
        email_service.send_login_code_email(email_n, code)
    except Exception as e:
        _log.exception("login_send_code email: %s", e)
    pre = security.create_pre_auth_token(row["user_id"])
    exp_sec = auth_config.get_jwt_pre_auth_expire_minutes() * 60
    return pre, exp_sec


# 11.
def insert_login_log(conn, user_id: int, ip: str, success: str, browser: str) -> None:
    cur = conn.cursor()
    try:
        ip_s = (ip or "")[:45]
        br = (browser or "")[:200]
        cur.execute(
            """
            INSERT INTO user_login_log (user_id, login_trial_ip, login_success_yn, login_trial_browser, create_dtm)
            VALUES (%s, %s, %s, %s, NOW())
            """,
            (user_id, ip_s, success, br),
        )
    finally:
        cur.close()


# 5.
def verify_login_complete(
    conn,
    pre_auth_token: str,
    code: str,
    client_ip: str,
    user_agent: str,
) -> dict[str, Any]:
    try:
        payload = security.decode_pre_auth_payload(pre_auth_token)
    except Exception:
        raise ValueError("유효하지 않거나 만료된 인증 토큰입니다.")
    user_id = int(payload["user_id"])
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, dptmt_info_id, scnd_auth_token, scnd_auth_expire_dtm
            FROM user_info WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        exp = row.get("scnd_auth_expire_dtm")
        if exp is not None and exp < datetime.now():
            raise ValueError("인증 코드가 만료되었습니다.")
        if not security.verify_otp_code(code, row.get("scnd_auth_token")):
            insert_login_log(conn, user_id, client_ip, "N", user_agent or "")
            conn.commit()
            raise ValueError("인증 코드가 올바르지 않습니다.")
        cur.execute(
            "UPDATE user_info SET scnd_auth_token = NULL, scnd_auth_expire_dtm = NULL, last_login_dtm = NOW(), last_login_ip = %s, update_dtm = NOW() WHERE user_id = %s",
            ((client_ip or "")[:45], user_id),
        )
        cur.execute(
            """
            INSERT INTO session_log (
                session_create_user_id, access_token_encrypt, refresh_token_encrypt,
                access_exprtn_dtm, refresh_exprtn_dtm, create_dtm, update_dtm
            ) VALUES (%s, '', '', NOW(), NOW(), NOW(), NOW())
            RETURNING session_log_id
            """,
            (user_id,),
        )
        sid = cur.fetchone()["session_log_id"]

        access_t, access_exp = security.create_access_token(
            user_id, row["dptmt_info_id"], sid, None
        )
        refresh_t, refresh_exp = security.create_refresh_token(user_id, sid)

        cur.execute(
            """
            UPDATE session_log SET
                access_token_encrypt  = %s,
                refresh_token_encrypt = %s,
                access_exprtn_dtm     = %s,
                refresh_exprtn_dtm    = %s,
                update_dtm            = NOW()
            WHERE session_log_id = %s
            """,
            (
                security.hash_token(access_t),
                security.hash_token(refresh_t),
                access_exp,
                refresh_exp,
                sid,
            ),
        )
        insert_login_log(conn, user_id, client_ip, "Y", user_agent or "")
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    return {
        "access_token": access_t,
        "refresh_token": refresh_t,
        "token_type": "bearer",
        "expires_in": auth_config.get_jwt_access_expire_minutes() * 60,
    }


# 6.
def refresh_session_tokens(conn, refresh_token_str: str) -> dict[str, Any]:
    try:
        payload = security.decode_token_payload(refresh_token_str, "refresh")
    except jwt.PyJWTError:
        raise ValueError("유효하지 않은 refresh 토큰입니다.") from None
    user_id = int(payload["user_id"])
    session_log_id = int(payload["session_log_id"])
    raw_proj = payload.get("project_info_id")
    proj_claim = int(raw_proj) if raw_proj is not None else None
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT session_log_id, session_create_user_id, refresh_token_encrypt, refresh_exprtn_dtm, access_exprtn_dtm
            FROM session_log WHERE session_log_id = %s
            """,
            (session_log_id,),
        )
        srow = cur.fetchone()
        if not srow or int(srow["session_create_user_id"]) != user_id:
            raise ValueError("세션을 찾을 수 없습니다.")
        rex = srow.get("refresh_exprtn_dtm")
        if rex is None or rex < datetime.now():
            raise ValueError("세션이 만료되었습니다. 다시 로그인하세요.")
        if security.hash_token(refresh_token_str) != (srow.get("refresh_token_encrypt") or ""):
            raise ValueError("세션이 무효화되었습니다.")
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (user_id,),
        )
        urow = cur.fetchone()
        if not urow:
            raise ValueError("사용자를 찾을 수 없습니다.")
        dptmt_id = urow["dptmt_info_id"]
        access_t, access_exp = security.create_access_token(
            user_id, dptmt_id, session_log_id, proj_claim
        )
        refresh_t, refresh_exp = security.create_refresh_token(
            user_id, session_log_id, proj_claim
        )
        cur.execute(
            """
            UPDATE session_log SET
                access_token_encrypt = %s,
                refresh_token_encrypt = %s,
                access_exprtn_dtm = %s,
                refresh_exprtn_dtm = %s,
                update_dtm = NOW()
            WHERE session_log_id = %s
            """,
            (
                security.hash_token(access_t),
                security.hash_token(refresh_t),
                access_exp,
                refresh_exp,
                session_log_id,
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
    exp_sec = auth_config.get_jwt_access_expire_minutes() * 60
    return {
        "access_token": access_t,
        "refresh_token": refresh_t,
        "token_type": "bearer",
        "expires_in": exp_sec,
    }


# 7.
def rotate_session_tokens_with_project(
    conn,
    user_id: int,
    session_log_id: int,
    project_info_id: int,
) -> dict[str, Any]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT session_log_id, session_create_user_id, refresh_exprtn_dtm
            FROM session_log WHERE session_log_id = %s
            """,
            (session_log_id,),
        )
        srow = cur.fetchone()
        if not srow or int(srow["session_create_user_id"]) != user_id:
            raise ValueError("세션을 찾을 수 없습니다.")
        rex = srow.get("refresh_exprtn_dtm")
        if rex is None or rex < datetime.now():
            raise ValueError("세션이 만료되었습니다. 다시 로그인하세요.")
        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (project_info_id, user_id),
        )
        if not cur.fetchone():
            raise ValueError("해당 프로젝트에 참여하지 않은 사용자입니다.")
        cur.execute(
            "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
            (user_id,),
        )
        urow = cur.fetchone()
        if not urow:
            raise ValueError("사용자를 찾을 수 없습니다.")
        dptmt_id = urow["dptmt_info_id"]
        access_t, access_exp = security.create_access_token(
            user_id, dptmt_id, session_log_id, project_info_id
        )
        refresh_t, refresh_exp = security.create_refresh_token(
            user_id, session_log_id, project_info_id
        )
        cur.execute(
            """
            UPDATE session_log SET
                access_token_encrypt = %s,
                refresh_token_encrypt = %s,
                access_exprtn_dtm = %s,
                refresh_exprtn_dtm = %s,
                update_dtm = NOW()
            WHERE session_log_id = %s
            """,
            (
                security.hash_token(access_t),
                security.hash_token(refresh_t),
                access_exp,
                refresh_exp,
                session_log_id,
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
    exp_sec = auth_config.get_jwt_access_expire_minutes() * 60
    return {
        "access_token": access_t,
        "refresh_token": refresh_t,
        "token_type": "bearer",
        "expires_in": exp_sec,
    }


# 8.
def logout_one_session(conn, session_log_id: int, user_id: int) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE session_log SET refresh_exprtn_dtm = NOW(), update_dtm = NOW()
            WHERE session_log_id = %s AND session_create_user_id = %s
            """,
            (session_log_id, user_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 9.
def invalidate_all_sessions(conn, user_id: int) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE session_log SET refresh_exprtn_dtm = NOW(), update_dtm = NOW()
            WHERE session_create_user_id = %s
            """,
            (user_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 10.
def get_user_profile(conn, user_id: int) -> dict[str, Any]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT u.user_id, u.user_email, u.user_nickname, u.user_dvsn,
                   COALESCE(u.etl_yn, 'N') AS etl_yn, u.dptmt_info_id, d.dptmt_name
            FROM user_info u
            LEFT JOIN dptmt_info d ON d.dptmt_info_id = u.dptmt_info_id
            WHERE u.user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("사용자를 찾을 수 없습니다.")
        return dict(row)
    finally:
        cur.close()


# 11.
def update_user_nickname(conn, user_id: int, nickname: str | None) -> None:
    if nickname is None:
        return
    nick = nickname.strip()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE user_info SET user_nickname = %s, update_dtm = NOW() WHERE user_id = %s",
            (nick, user_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 12.
def change_password(conn, user_id: int, current_password: str, new_password: str) -> None:
    cur = conn.cursor()
    try:
        cur.execute("SELECT pswd_hash FROM user_info WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if not row or not security.verify_password(current_password, row.get("pswd_hash") or ""):
            raise ValueError("현재 비밀번호가 올바르지 않습니다.")
        security.validate_password_strength(new_password)
        new_hash = security.hash_password(new_password)
        cur.execute(
            "UPDATE user_info SET pswd_hash = %s, pswd_update_dtm = NOW(), update_dtm = NOW() WHERE user_id = %s",
            (new_hash, user_id),
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
    invalidate_all_sessions(conn, user_id)


# 13.
def fetch_login_history_masked(conn, user_id: int, limit: int = 10) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT login_trial_ip, login_success_yn, login_trial_browser, create_dtm
            FROM user_login_log
            WHERE user_id = %s
            ORDER BY create_dtm DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        rows = cur.fetchall()
    finally:
        cur.close()
    out = []
    for r in rows:
        ip = r.get("login_trial_ip") or ""
        parts = ip.split(".")
        if len(parts) == 4 and all(p.isdigit() for p in parts):
            masked = f"{parts[0]}.{parts[1]}.*.*"
        else:
            masked = ip
        out.append(
            {
                "login_trial_ip": masked,
                "login_success_yn": r.get("login_success_yn"),
                "login_trial_browser": r.get("login_trial_browser"),
                "create_dtm": r.get("create_dtm").isoformat() if r.get("create_dtm") else None,
            }
        )
    return out
