"""
Backend.core.sql_fingerprint (SQL 정규화·지문 SHA-256 hex)
==========================================================
`docs/main/04_DB_ARCHITECTURE.md` §13: UTF-8 정규화 문자열의 SHA-256 소문자 hex 64자. 원문 비적재. **계측은 기본적으로 도메인 `audit_sql_catalog` 템플릿(1), 동적 DML 등 필요 시에만 호출부가 실행 SQL 문자열로 지문 명시(2).**

[Main Functions]
===========
1. normalize_sql_for_fingerprint: 블록 주석 제거·리터럴 `?` 치환·행 주석 제거·공백 축약·ASCII 소문자화
2. compute_sql_fingerprint_hex: 정규화 후 해시(빈 문자열이면 None)

[Endpoints/Classes/Functions]
=======================
- normalize_sql_for_fingerprint(raw_sql) -> str
- compute_sql_fingerprint_hex(raw_sql) -> str | None

[Dependencies]
=========
- hashlib, re
- PostgreSQL 달러 인용(`$tag$`) 구문은 1차 미지원(희귀; 추후 확장)

[제한]
=====
- 완전한 SQL 파서가 아니다. 감사·유사 실행 묶음용 지문으로만 사용한다.
"""

from __future__ import annotations

import hashlib
import re


# 1.
def normalize_sql_for_fingerprint(raw_sql: str) -> str:
    """선행·후행 공백, `/* */` 제거, 따옴표 문자열을 `?`로, `--` 행 주석 제거, 공백 축약, ASCII 소문자."""
    s = (raw_sql or "").strip()
    if not s:
        return ""
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.DOTALL)
    s = _replace_quoted_literals_with_placeholder(s)
    parts: list[str] = []
    for line in s.splitlines():
        line = re.sub(r"--.*$", "", line)
        parts.append(line)
    s = " ".join(parts)
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()


def _replace_quoted_literals_with_placeholder(s: str) -> str:
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        if ch == "'":
            out.append(" ? ")
            i += 1
            while i < n:
                if s[i] == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue
        if ch == '"':
            out.append(" ? ")
            i += 1
            while i < n:
                if s[i] == '"':
                    if i + 1 < n and s[i + 1] == '"':
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


# 2.
def compute_sql_fingerprint_hex(raw_sql: str) -> str | None:
    """정규화 SQL이 비어 있으면 None, 아니면 SHA-256 hex 64자."""
    norm = normalize_sql_for_fingerprint(raw_sql)
    if not norm:
        return None
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()
