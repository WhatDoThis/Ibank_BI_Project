"""
core.invite_expiry (초대 JSON 만료 시각 판별)
============================================
`noti_content` 등 dict의 `invite_expires_at`(UTC ISO 문자열)이 현재(UTC)를 넘었는지 판별.
프로젝트·위젯보드·어드민 초대 목록에서 동일 로직 공유.

[Main Functions]
===========
1. invite_expired_from_payload: dict → 만료 여부

[Dependencies]
=========
- datetime, timezone
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


# 1.
def invite_expired_from_payload(payload: dict[str, Any]) -> bool:
    raw = payload.get("invite_expires_at")
    if raw is None or raw == "":
        return False
    try:
        s = str(raw).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > dt
    except (ValueError, TypeError, OSError):
        return False
