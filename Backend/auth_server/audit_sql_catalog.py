"""
Backend.auth_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
==========================================================
`emit_auth_system_log` 가 `sql_fingerprint` 를 넘기지 않을 때, `business_action` 에 대응하는
**대표 DML/조회 템플릿**만 해시한다. 원문 SQL 전체는 `system_log` 에 저장하지 않는다(`docs/main/04_DB_ARCHITECTURE.md` 13절).

[Main Functions]
===========
1. _fingerprint_hex_cached: SQL 템플릿 → `compute_sql_fingerprint_hex` 결과 LRU 캐시(`lru_cache`)
2. auth_audit_sql_fingerprint: business_action → 등록 템플릿 조회 후 1번으로 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- _fingerprint_hex_cached(sql_template) -> str | None
- auth_audit_sql_fingerprint(business_action, detail_json) -> str | None

[Dependencies]
=========
- functools.lru_cache, typing.Any
- Backend.core.sql_fingerprint.compute_sql_fingerprint_hex
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex

# 대표 템플릿(실행문과 의미상 동일한 형태; 리터럴은 지문 정규화 시 ? 로 묶임)
_SQL_BY_ACTION: dict[str, str] = {
    "signup_invite": """
            INSERT INTO user_info (
                user_email, pswd_hash, user_active_yn, user_dvsn, auth_yn,
                dptmt_info_id, user_nickname, etl_yn, create_dtm
            ) VALUES (%s, %s, 'Y', %s, 'Y', %s, %s, %s, NOW())
            RETURNING user_id
            """,
    "org_create": """
            INSERT INTO dptmt_info (dptmt_name, use_yn, dptmt_create_user_id, create_dtm)
            VALUES (%s, 'Y', NULL, NOW())
            RETURNING dptmt_info_id;
            INSERT INTO user_info (
                user_email, pswd_hash, user_active_yn, user_dvsn, auth_yn,
                dptmt_info_id, user_nickname, create_dtm
            ) VALUES (%s, %s, 'Y', 'sa', 'Y', %s, %s, NOW())
            RETURNING user_id;
            UPDATE dptmt_info SET dptmt_create_user_id = %s, update_dtm = NOW() WHERE dptmt_info_id = %s
            """,
    "login_failure": """
            SELECT user_id, dptmt_info_id, scnd_auth_token, scnd_auth_expire_dtm,
                   user_active_yn, user_lock_yn
            FROM user_info WHERE user_id = %s
            """,
    "login_success": """
            UPDATE user_info SET scnd_auth_token = NULL, scnd_auth_expire_dtm = NULL,
                   last_login_dtm = NOW(), last_login_ip = %s, update_dtm = NOW()
            WHERE user_id = %s;
            INSERT INTO session_log (
                session_create_user_id, access_token_encrypt, refresh_token_encrypt,
                access_exprtn_dtm, refresh_exprtn_dtm, create_dtm, update_dtm
            ) VALUES (%s, '', '', NOW(), NOW(), NOW(), NOW())
            RETURNING session_log_id;
            UPDATE session_log SET
                access_token_encrypt = %s, refresh_token_encrypt = %s,
                access_exprtn_dtm = %s, refresh_exprtn_dtm = %s, update_dtm = NOW()
            WHERE session_log_id = %s;
            INSERT INTO user_login_log (user_id, login_trial_ip, login_success_yn, login_trial_browser, create_dtm)
            VALUES (%s, %s, %s, %s, NOW())
            """,
    "password_change": """
            UPDATE user_info SET pswd_hash = %s, pswd_update_dtm = NOW(), update_dtm = NOW()
            WHERE user_id = %s
            """,
}


# 1.
@lru_cache(maxsize=32)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


# 2.
def auth_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    """business_action 에 등록된 대표 템플릿이 있으면 SHA-256 hex 지문을 반환한다."""
    _ = detail_json
    ba = (business_action or "").strip()
    tpl = _SQL_BY_ACTION.get(ba)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
