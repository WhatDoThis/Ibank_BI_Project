"""
Backend.auth_server.security (bcrypt·JWT·코드 해시)
================================================
비밀번호·2차 인증코드·세션 토큰 해시 및 JWT 발급/검증.
`# N.`/`# 1a.` 순서는 docs/main/06 Phase 4(세션·JWT)와 동일하게 읽는다.

[Main Functions]
===========
1. hash_password / verify_password: bcrypt
1a. validate_password_strength: 신규 비밀번호 정책(10자·대소문자·숫자·특수문자)
2. hash_otp_code / verify_otp_code: 로그인 2차 코드 검증
3. hash_token: 세션 로그에 저장할 JWT 문자열 SHA-256 hex
4. create_pre_auth_token / decode_pre_auth_payload
5. create_access_token / create_refresh_token(선택 project_info_id) / decode_token_payload / generate_numeric_code(로그인 OTP 자릿수)

[Endpoints/Classes/Functions]
=======================
- hash_password, verify_password (# 1.)
- validate_password_strength (# 1a.)
- hash_otp_code, verify_otp_code (# 2.)
- hash_token (# 3.)
- create_pre_auth_token, decode_pre_auth_payload (# 4.)
- create_access_token, create_refresh_token, decode_token_payload, generate_numeric_code (# 5.)
- (내부) _utcnow, _exp_ts

[Dependencies]
=========
- bcrypt, jwt (PyJWT), hashlib, hmac, secrets
- Backend.core.auth_config
"""

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from Backend.core import auth_config


# 1.
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# 1a. 신규 비밀번호만(가입·변경). 로그인 시 기존 약한 비밀번호는 검사하지 않음.
_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"\d")
_RE_SPECIAL = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?~`]')


def validate_password_strength(plain: str) -> None:
    if not plain or len(plain) < 10:
        raise ValueError("비밀번호는 10자 이상이어야 합니다.")
    if not _RE_UPPER.search(plain):
        raise ValueError("비밀번호에 영문 대문자를 1자 이상 포함해 주세요.")
    if not _RE_LOWER.search(plain):
        raise ValueError("비밀번호에 영문 소문자를 1자 이상 포함해 주세요.")
    if not _RE_DIGIT.search(plain):
        raise ValueError("비밀번호에 숫자를 1자 이상 포함해 주세요.")
    if not _RE_SPECIAL.search(plain):
        raise ValueError(
            "비밀번호에 특수문자를 1자 이상 포함해 주세요. (!, @, #, $ 등)"
        )


# 2.
def hash_otp_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


def verify_otp_code(code: str, stored_hash: str | None) -> bool:
    if not code or not stored_hash:
        return False
    return hmac.compare_digest(hash_otp_code(code), stored_hash)


# 3.
def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utcnow():
    return datetime.now(timezone.utc)


def _exp_ts(dt: datetime) -> int:
    return int(dt.timestamp())


# 4.
def create_pre_auth_token(user_id: int) -> str:
    minutes = auth_config.get_jwt_pre_auth_expire_minutes()
    exp_dt = _utcnow() + timedelta(minutes=minutes)
    payload = {"typ": "pre_auth", "user_id": user_id, "exp": _exp_ts(exp_dt)}
    return jwt.encode(payload, auth_config.get_jwt_secret(), algorithm="HS256")


def decode_pre_auth_payload(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        auth_config.get_jwt_secret(),
        algorithms=["HS256"],
        options={"require": ["exp"]},
    )
    if payload.get("typ") != "pre_auth" or "user_id" not in payload:
        raise jwt.InvalidTokenError("invalid pre_auth token")
    return payload


# 5.
def create_access_token(
    user_id: int,
    dptmt_info_id: int,
    session_log_id: int,
    project_info_id: int | None = None,
) -> tuple[str, datetime]:
    minutes = auth_config.get_jwt_access_expire_minutes()
    exp_dt = _utcnow() + timedelta(minutes=minutes)
    payload: dict[str, Any] = {
        "typ": "access",
        "user_id": user_id,
        "dptmt_info_id": dptmt_info_id,
        "session_log_id": session_log_id,
        "exp": _exp_ts(exp_dt),
    }
    if project_info_id is not None:
        payload["project_info_id"] = project_info_id
    token = jwt.encode(payload, auth_config.get_jwt_secret(), algorithm="HS256")
    return token, exp_dt


def create_refresh_token(
    user_id: int,
    session_log_id: int,
    project_info_id: int | None = None,
) -> tuple[str, datetime]:
    days = auth_config.get_jwt_refresh_expire_days()
    exp_dt = _utcnow() + timedelta(days=days)
    payload: dict[str, Any] = {
        "typ": "refresh",
        "user_id": user_id,
        "session_log_id": session_log_id,
        "exp": _exp_ts(exp_dt),
    }
    if project_info_id is not None:
        payload["project_info_id"] = int(project_info_id)
    token = jwt.encode(payload, auth_config.get_jwt_secret(), algorithm="HS256")
    return token, exp_dt


def decode_token_payload(token: str, expected_typ: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        auth_config.get_jwt_secret(),
        algorithms=["HS256"],
        options={"require": ["exp"]},
    )
    if payload.get("typ") != expected_typ:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def generate_numeric_code(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))
