"""
Backend.core.user_dvsn_codes (user_dvsn 허용 코드)
================================================
DB·JWT·권한에서 사용하는 조직 역할은 아래 5가지만 유효하다.
그 외 값은 canon_user_dvsn 이 빈 문자열을 반환하며, 목록 API는 빈 items 로 응답한다.

[Main Functions]
===========
- canon_user_dvsn: 허용 집합에 있으면 소문자 정규화 값, 아니면 ""

[Constants]
===========
- ALLOWED_USER_DVSN, ORG_ADMIN_DVSN, SUPER_ORG_DVSN, PROJECT_ADMIN_DVSN, ORG_OR_OPERATOR_DVSN

[Dependencies]
=========
- 없음
"""

from __future__ import annotations

# 1. 허용 코드: sa_dev, sa(Super Admin), a(Admin), o(Operator), u(User)
ALLOWED_USER_DVSN: frozenset[str] = frozenset({"sa_dev", "sa", "a", "o", "u"})

ORG_ADMIN_DVSN: frozenset[str] = frozenset({"sa_dev", "sa", "a"})
SUPER_ORG_DVSN: frozenset[str] = frozenset({"sa_dev", "sa"})
PROJECT_ADMIN_DVSN: frozenset[str] = frozenset({"sa_dev", "sa", "a", "o"})
ORG_OR_OPERATOR_DVSN: frozenset[str] = frozenset({"sa_dev", "sa", "a", "o"})


def canon_user_dvsn(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    return s if s in ALLOWED_USER_DVSN else ""
