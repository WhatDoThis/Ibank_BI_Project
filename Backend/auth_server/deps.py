"""
Backend.auth_server.deps (Bearer access JWT 의존성)
================================================
보호 라우트용 access 토큰 검증.

[Main Functions]
===========
1. get_access_payload: Authorization Bearer → JWT payload (typ=access)

[Dependencies]
=========
- fastapi Header HTTPException
- jwt, Backend.auth_server.security
"""

from typing import Annotated, Any

import jwt
from fastapi import Header, HTTPException

from Backend.core import auth_config


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
