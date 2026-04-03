"""
Backend.core.auth_config (인증·메일·JWT 설정 읽기)
=================================================
Env/config/config.json 의 backend 에서 JWT·SMTP·app_url 을 읽고, SPA 공개 베이스 URL은 **frontend.app_url** 을 보조 출처로 사용한다.
SMTP는 **backend.smtp_info** 우선, 없으면 레거시 **backend** 평면 키(smtp_*·app_url)로 읽는다.
상용화 auth_server 및 email_service 에서 사용.

[Main Functions]
===========
1. get_jwt_secret: 서명용 비밀 문자열 (비어 있으면 ValueError — 호출부에서 개발 예외 처리 가능)
2. get_jwt_pre_auth_expire_minutes: pre_auth_token 만료(분)
3. get_jwt_access_expire_minutes: access_token 만료(분)
4. get_jwt_refresh_expire_days: refresh_token 만료(일)
5. get_app_url: smtp_info.app_url → backend.app_url → frontend.app_url (Vite base `/ibank-bi/`와 맞는 공개 베이스; localhost 하드코딩 없음)
6. get_smtp_settings: SMTP dict (host, port, user, password, from_addr) — smtp_info 또는 평면 키
7. is_smtp_skipped: smtp_host 비어 있으면 True — 이때만 메일 미발송·로그 폴백(환경이 dev인지와 무관)

[Dependencies]
=========
- Env.config (config.backend, config.frontend)
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


def _smtp_config_source():
    """
    SMTP 필드가 들어 있는 설정 소스.
    backend.smtp_info 가 있으면 그 객체를, 없으면 backend 전체(레거시 평면 smtp_*).
    """
    b = config.backend
    info = getattr(b, "smtp_info", None)
    if info is not None:
        return info
    return b


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
    """
    공개 SPA 베이스 URL(초대 등 `{base}/signup` 조립).
    순서: smtp_info.app_url → backend.app_url → frontend.app_url.
    환경(리눅스·도메인·포트)마다 다르므로 config 에 반드시 지정할 것; 추측·localhost 고정 없음.
    """
    b = config.backend
    info = getattr(b, "smtp_info", None)
    if info is not None:
        v = getattr(info, "app_url", None)
        if v is not None and str(v).strip():
            return str(v).strip().rstrip("/")
    v = getattr(b, "app_url", None)
    if v is not None and str(v).strip():
        return str(v).strip().rstrip("/")
    fe = getattr(config, "frontend", None)
    if fe is not None:
        v = getattr(fe, "app_url", None)
        if v is not None and str(v).strip():
            return str(v).strip().rstrip("/")
    return ""


# 6.
def get_smtp_settings() -> dict:
    """
    SMTP 설정 dict.
    키: host, port, user, password, from_addr
    """
    src = _smtp_config_source()
    port = getattr(src, "smtp_port", 587)
    try:
        port = int(port)
    except (TypeError, ValueError):
        port = 587
    return {
        "host": (getattr(src, "smtp_host", None) or "").strip(),
        "port": port,
        "user": (getattr(src, "smtp_user", None) or "").strip(),
        "password": (getattr(src, "smtp_password", None) or "").strip(),
        "from_addr": (getattr(src, "smtp_from", None) or "").strip(),
    }


# 7.
def is_smtp_skipped() -> bool:
    """smtp_host 가 비어 있으면 True — 실제 SMTP 연결 없이 발송 생략(로그 폴백만). dev 전용 동작 아님."""
    return not get_smtp_settings()["host"]
