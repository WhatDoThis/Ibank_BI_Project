"""
Backend.auth_server.deps (Bearer access JWT 의존성)
================================================
보호 라우트용 access 토큰 검증. 비활성·잠금 계정은 DB 조회로 차단(require_active_access).
본 모듈 `# N.` 순서는 docs/main/06 Phase 4(세션·JWT) 흐름과 동일하게 읽는다.

[Main Functions]
===========
1. _parse_bearer_access_token: Authorization → (원문 토큰, JWT payload)
2. get_access_payload: JWT만 검증(레거시·비권장). 보호 API는 require_active_access 사용
3. ensure_user_active_not_locked: system_db에서 user_active_yn·user_lock_yn 검사
4. require_access_session_bound: JWT + access 해시·refresh 만료 검사(로그아웃 — 비활성·잠금 계정도 세션 종료 허용)
5. require_active_access: require_access_session_bound + 활성·미잠금

[Dependencies]
=========
- fastapi Depends Header HTTPException
- jwt, hashlib(SHA-256 hex — security.hash_token 과 동일, 순환 import 회피)
- Backend.core.auth_config, Backend.core.dependencies.get_system_db
"""

import hashlib
from datetime import datetime
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException

from Backend.core import auth_config
from Backend.core.dependencies import get_system_db


def _hash_access_token_raw(token: str) -> str:
    """session_log.access_token_encrypt 비교용. `security.hash_token` 과 동일 알고리즘."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# 1.
def _parse_bearer_access_token(authorization: str | None) -> tuple[str, dict[str, Any]]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    try:
        payload = jwt.decode(
            token,
            auth_config.get_jwt_secret(),
            algorithms=["HS256"],
            options={"require": ["exp"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.") from None
    if payload.get("typ") != "access":
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    return token, payload


# 2.
def get_access_payload(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _, payload = _parse_bearer_access_token(authorization)
    return payload


# 3.
def ensure_user_active_not_locked(conn, user_id: int) -> None:
    """user_info 기준 비활성(N)·잠금(Y)이면 403."""
    uid = int(user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT UPPER(TRIM(COALESCE(user_active_yn, 'N'))) AS ua,
                   UPPER(TRIM(COALESCE(user_lock_yn, 'N'))) AS ul
            FROM user_info WHERE user_id = %s
            """,
            (uid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
        if (row.get("ua") or "") != "Y":
            raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")
        if (row.get("ul") or "") == "Y":
            raise HTTPException(
                status_code=403,
                detail="잠긴 계정입니다. 관리자에게 문의하세요.",
            )
    finally:
        cur.close()


def _assert_access_session_bound(conn, token: str, payload: dict[str, Any]) -> None:
    uid = int(payload["user_id"])
    sid_raw = payload.get("session_log_id")
    if sid_raw is None:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    sid = int(sid_raw)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT access_token_encrypt, session_create_user_id, refresh_exprtn_dtm
            FROM session_log WHERE session_log_id = %s
            """,
            (sid,),
        )
        row = cur.fetchone()
        if not row or int(row["session_create_user_id"]) != uid:
            raise HTTPException(status_code=401, detail="세션이 무효화되었습니다.")
        rex = row.get("refresh_exprtn_dtm")
        if rex is not None and rex < datetime.now():
            raise HTTPException(
                status_code=401,
                detail="세션이 만료되었습니다. 다시 로그인하세요.",
            )
        stored = (row.get("access_token_encrypt") or "").strip()
        if not stored:
            raise HTTPException(
                status_code=401,
                detail="세션 정보가 올바르지 않습니다. 다시 로그인하세요.",
            )
        if _hash_access_token_raw(token) != stored:
            raise HTTPException(status_code=401, detail="세션이 무효화되었습니다.")
    finally:
        cur.close()


# 4.
def require_access_session_bound(
    authorization: Annotated[str | None, Header()] = None,
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    """로그아웃 등: 세션 바인딩만 검사(비활성·잠금 계정도 세션 종료 가능)."""
    token, payload = _parse_bearer_access_token(authorization)
    _assert_access_session_bound(conn, token, payload)
    return payload


# 5.
def require_active_access(
    authorization: Annotated[str | None, Header()] = None,
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    token, payload = _parse_bearer_access_token(authorization)
    ensure_user_active_not_locked(conn, int(payload["user_id"]))
    _assert_access_session_bound(conn, token, payload)
    return payload

