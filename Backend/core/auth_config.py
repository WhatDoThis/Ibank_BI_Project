"""
Backend.core.auth_config (인증·메일·JWT 설정 읽기)
=================================================
Env/config/config.json 의 backend 에서 JWT·SMTP·app_url 만 읽는다.
상용화 auth_server 및 email_service 에서 사용.

[Main Functions]
===========
1. get_jwt_secret: 서명용 비밀 문자열 (비어 있으면 ValueError — 호출부에서 개발 예외 처리 가능)
2. get_jwt_pre_auth_expire_minutes: pre_auth_token 만료(분)
3. get_jwt_access_expire_minutes: access_token 만료(분)
4. get_jwt_refresh_expire_days: refresh_token 만료(일)
5. get_app_url: 프론트/초대 링크 기준 URL
6. get_smtp_settings: SMTP dict (host, port, user, password, from_addr)
7. is_smtp_skipped: smtp_host 비어 있으면 True — 개발 시 콘솔 출력 모드(문서 17 §2.7)

[Dependencies]
=========
- Env.config (config.backend)
"""

try:
    from Env import config
except ImportError:
    import sys as _sys
    from pathlib import Path as _Path
    _root = _Path(__file__).resolve().parent.parent.parent
    if str(_root) not in _sys.path:
        _sys.path.insert(0, str(_root))
    from Env import config


# 1.
def get_jwt_secret() -> str:
    """backend.jwt_secret. 비어 있으면 ValueError."""
    backend = config.backend
    secret = getattr(backend, "jwt_secret", None)
    if secret is None or not str(secret).strip():
        raise ValueError(
            "Env/config/config.json 의 backend.jwt_secret 이 없거나 비어 있습니다."
        )
    return str(secret).strip()


# 2.
def get_jwt_pre_auth_expire_minutes() -> int:
    """backend.jwt_pre_auth_expire_minutes, 기본 5."""
    v = getattr(config.backend, "jwt_pre_auth_expire_minutes", None)
    if v is None or v == "":
        return 5
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 5
    return max(1, min(n, 60))


# 3.
def get_jwt_access_expire_minutes() -> int:
    """backend.jwt_access_expire_minutes, 기본 30."""
    v = getattr(config.backend, "jwt_access_expire_minutes", None)
    if v is None or v == "":
        return 30
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 30
    return max(1, n)


# 4.
def get_jwt_refresh_expire_days() -> int:
    """backend.jwt_refresh_expire_days, 기본 7."""
    v = getattr(config.backend, "jwt_refresh_expire_days", None)
    if v is None or v == "":
        return 7
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 7
    return max(1, n)


# 5.
def get_app_url() -> str:
    """backend.app_url. 없으면 빈 문자열."""
    v = getattr(config.backend, "app_url", None)
    if v is None:
        return ""
    return str(v).strip().rstrip("/")


# 6.
def get_smtp_settings() -> dict:
    """
    SMTP 설정 dict.
    키: host, port, user, password, from_addr
    """
    b = config.backend
    port = getattr(b, "smtp_port", 587)
    try:
        port = int(port)
    except (TypeError, ValueError):
        port = 587
    return {
        "host": (getattr(b, "smtp_host", None) or "").strip(),
        "port": port,
        "user": (getattr(b, "smtp_user", None) or "").strip(),
        "password": (getattr(b, "smtp_password", None) or "").strip(),
        "from_addr": (getattr(b, "smtp_from", None) or "").strip(),
    }


# 7.
def is_smtp_skipped() -> bool:
    """smtp_host 가 비어 있으면 True — 이메일 발송 스킵·콘솔 로그 모드."""
    return not get_smtp_settings()["host"]
