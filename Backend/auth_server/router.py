"""
Backend.auth_server.router (/api/auth)
=====================================
가입·부서 생성·로그인 2단계·토큰 갱신·마이페이지 API.

[Endpoints]
===========
1. POST /api/auth/signup, create-org, login, verify-login, refresh, logout
2. GET/PATCH /api/auth/me — JWT의 project_info_id가 비활성·탈퇴 시 토큰 재발급·project_info_id null·permissions 빈 배열
3. GET /api/auth/invite/validate

[Dependencies]
=========
- Backend.auth_server.service, schemas, deps, permissions
- Backend.core.dependencies.get_system_db
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from Backend.auth_server import permissions, schemas, service
from Backend.auth_server.deps import get_access_payload, require_active_access
from Backend.core.dependencies import get_system_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    if request.client:
        return request.client.host or ""
    return ""


def _map_error(e: ValueError) -> HTTPException:
    msg = str(e)
    if "찾을 수 없" in msg or "유효하지 않" in msg or "만료" in msg:
        code = 400
        if "세션" in msg or "토큰" in msg:
            code = 401
        return HTTPException(status_code=code, detail=msg)
    if "이미" in msg or "일치하지 않" in msg:
        return HTTPException(status_code=400, detail=msg)
    return HTTPException(status_code=400, detail=msg)


# 1.
@router.post("/signup")
def auth_signup(body: schemas.SignupBody, conn=Depends(get_system_db)):
    try:
        uid = service.signup_with_invite(
            conn, body.invite_code, body.email, body.password, body.nickname
        )
        return {"user_id": uid, "message": "가입이 완료되었습니다."}
    except ValueError as e:
        raise _map_error(e) from e


@router.post("/create-org")
def auth_create_org(body: schemas.CreateOrgBody, conn=Depends(get_system_db)):
    try:
        uid = service.create_org_and_user(
            conn, body.org_name, body.email, body.password, body.nickname
        )
        return {"user_id": uid, "message": "부서와 계정이 생성되었습니다."}
    except ValueError as e:
        raise _map_error(e) from e


@router.post("/login")
def auth_login(
    body: schemas.LoginBody,
    request: Request,
    conn=Depends(get_system_db),
    user_agent: Annotated[str | None, Header()] = None,
):
    try:
        pre, exp_sec = service.login_send_code(
            conn, body.email, body.password, _client_ip(request), user_agent or ""
        )
        return {"pre_auth_token": pre, "expires_in": exp_sec}
    except ValueError as e:
        raise _map_error(e) from e


@router.post("/verify-login")
def auth_verify_login(
    body: schemas.VerifyLoginBody,
    request: Request,
    conn=Depends(get_system_db),
    user_agent: Annotated[str | None, Header()] = None,
):
    try:
        return service.verify_login_complete(
            conn,
            body.pre_auth_token,
            body.code,
            _client_ip(request),
            user_agent or "",
        )
    except ValueError as e:
        raise _map_error(e) from e


@router.post("/refresh")
def auth_refresh(body: schemas.RefreshBody, conn=Depends(get_system_db)):
    try:
        return service.refresh_session_tokens(conn, body.refresh_token)
    except ValueError as e:
        raise _map_error(e) from e


@router.post("/logout")
def auth_logout(payload: dict = Depends(get_access_payload), conn=Depends(get_system_db)):
    sid = payload.get("session_log_id")
    uid = payload.get("user_id")
    if sid is None or uid is None:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    try:
        service.logout_one_session(conn, int(sid), int(uid))
    except Exception:
        raise HTTPException(status_code=500, detail="로그아웃 처리 실패") from None
    return {"message": "로그아웃되었습니다."}


@router.get("/me")
def auth_me(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    try:
        prof = service.get_user_profile(conn, uid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    perm_ids: list[str] = []
    effective_pid = payload.get("project_info_id")
    extra_tokens: dict | None = None
    if effective_pid is not None:
        try:
            pid = int(effective_pid)
        except (TypeError, ValueError):
            effective_pid = None
        else:
            sid_raw = payload.get("session_log_id")
            must_clear = not permissions.is_project_active(
                conn, pid
            ) or not permissions.is_project_participant(conn, uid, pid)
            if must_clear and sid_raw is not None:
                extra_tokens = service.rotate_session_tokens_clear_project(
                    conn, uid, int(sid_raw)
                )
                effective_pid = None
            elif must_clear:
                effective_pid = None
            else:
                effective_pid = pid
    if effective_pid is not None:
        try:
            perm_ids = permissions.get_effective_permission_ids_for_me(
                conn,
                uid,
                int(effective_pid),
                prof.get("user_dvsn"),
            )
        except Exception:
            perm_ids = []
    out = {
        "user_id": prof["user_id"],
        "email": prof["user_email"],
        "nickname": prof.get("user_nickname"),
        "user_dvsn": prof.get("user_dvsn"),
        "etl_yn": prof.get("etl_yn") or "N",
        "dptmt_info_id": prof.get("dptmt_info_id"),
        "dptmt_name": prof.get("dptmt_name"),
        "project_info_id": effective_pid,
        "permissions": perm_ids,
    }
    if extra_tokens:
        out["access_token"] = extra_tokens["access_token"]
        out["refresh_token"] = extra_tokens["refresh_token"]
        out["expires_in"] = extra_tokens["expires_in"]
        out["token_type"] = extra_tokens["token_type"]
    return out


@router.patch("/me")
def auth_patch_me(
    body: schemas.MeUpdateBody,
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    try:
        service.update_user_nickname(conn, uid, body.nickname)
    except Exception:
        raise HTTPException(status_code=500, detail="프로필 수정 실패") from None
    return {"message": "수정되었습니다."}


@router.patch("/me/password")
def auth_password(
    body: schemas.PasswordChangeBody,
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    try:
        service.change_password(conn, uid, body.current_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"message": "비밀번호가 변경되었습니다. 다시 로그인하세요."}


@router.get("/me/login-history")
def auth_login_history(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
):
    uid = int(payload["user_id"])
    return {"items": service.fetch_login_history_masked(conn, uid)}


@router.get("/invite/validate")
def auth_invite_validate(code: str, conn=Depends(get_system_db)):
    row = service.invite_validate_row(conn, code)
    if not row:
        return {"valid": False, "reason": "not_found"}
    if (row.get("used_yn") or "").upper() == "Y":
        return {"valid": False, "reason": "used"}
    ex = row.get("exprtn_dtm")
    if ex is not None and ex < datetime.now():
        return {"valid": False, "reason": "expired"}
    return {
        "valid": True,
        "email": row.get("invite_target_email"),
        "dptmt_name": row.get("dptmt_name"),
        "invite_target_dvsn": row.get("invite_target_dvsn") or "u",
        "invite_etl_yn": (row.get("invite_etl_yn") or "N").strip().upper(),
        "has_project_attachment": bool(
            row.get("invite_project_info_id") and row.get("invite_pmssn_master_id")
        ),
        "invite_project_info_id": row.get("invite_project_info_id"),
        "invite_pmssn_master_id": row.get("invite_pmssn_master_id"),
        "invite_project_name": row.get("invite_project_name"),
        "invite_pmssn_name": row.get("invite_pmssn_name"),
    }
