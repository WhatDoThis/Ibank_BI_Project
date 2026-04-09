"""
sql_safety (SELECT·다중문 금지 키워드 검사)
=========================================
query_studio `/api/execute-query` 등과 widget_board `data_source_type=query` 실행 전 공통 검사.
한 모듈로 두면 규칙 변경 시 한 곳만 수정한다.

[Main Functions]
===========
1. contains_dangerous_sql: 금지 패턴이 있으면 사유 문자열, 없으면 None

[Dependencies]
=========
- re (표준)
"""

import re


# 1.
def contains_dangerous_sql(query: str | None):
    """금지 패턴이 있으면 사유 문자열, 없으면 None."""
    if not query or not str(query).strip():
        return None
    text = str(query).upper()
    phrases = [
        "DROP TABLE", "DROP INDEX", "DROP VIEW", "DROP SCHEMA", "DROP DATABASE",
        "DELETE FROM", "INSERT INTO",
        "ALTER TABLE", "ALTER INDEX", "ALTER VIEW",
        "CREATE TABLE", "CREATE INDEX", "CREATE VIEW", "CREATE SCHEMA",
        "TRUNCATE TABLE",
    ]
    segments = text.split(";")
    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue
        if re.match(r"^\s*SELECT\b", segment):
            continue
        for phrase in phrases:
            words = phrase.split()
            parts = [r"\b" + re.escape(w) + r"\b" for w in words]
            pattern = r"^\s*" + r"\s+".join(parts) + r"(?:\s|$)"
            if re.match(pattern, segment):
                return phrase
        if re.match(r"^\s*UPDATE\b\s", segment):
            return "UPDATE"
    return None
