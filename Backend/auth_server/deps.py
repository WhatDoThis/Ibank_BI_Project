"""
Backend.auth_server.deps (Bearer access JWT 의존성)
================================================
보호 라우트용 access 토큰 검증. 비활성·잠금 계정은 DB 조회로 차단(require_active_access).

[Main Functions]
===========
1. get_access_payload: Authorization Bearer → JWT payload (typ=access)
2. ensure_user_active_not_locked: system_db에서 user_active_yn·user_lock_yn 검사
3. require_active_access: JWT + 활성·미잠금 (대부분 보호 API)

[Dependencies]
=========
- fastapi Depends Header HTTPException
- jwt, Backend.core.auth_config, Backend.core.dependencies.get_system_db
"""

from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException

from Backend.core import auth_config
from Backend.core.dependencies import get_system_db


def get_access_payload(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
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
    return payload


# 2.
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


# 3.
def require_active_access(
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    ensure_user_active_not_locked(conn, int(payload["user_id"]))
    return payload
