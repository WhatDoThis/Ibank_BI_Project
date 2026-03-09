"""
Backend.api_server.analysis_store (분석 결과 저장/조회)
======================================================
allowlist_analysis 테이블에 분석 결과 저장/조회. report 라우터 등에서 사용.

[Functions]
===========
15 - save_analysis_result: allowed_tables, table_columns, relationships를 JSONB로 저장
40 - get_latest_analysis_result: 가장 최근 분석 결과 1건 조회 (dict 또는 None)

[Dependencies]
=========
- Backend.api_server.db
- json
"""

import json

from Backend.api_server import db


def save_analysis_result(allowed_tables, table_columns, relationships):
    """
    allowlist_analysis 테이블에 분석 스냅샷 한 건 저장.
    allowed_tables: list[str]
    table_columns: dict[str, list[dict]]  e.g. {"campaigns": [{"column_name":"id","data_type":"integer"}, ...]}
    relationships: list[dict]  e.g. [{"from_table","from_column","to_table","to_column","confidence","reason",...}]
    """
    schema = db.get_table_schema()
    conn = db.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO allowlist_analysis (table_schema, allowed_tables, table_columns, relationships)
            VALUES (%s, %s::jsonb, %s::jsonb, %s::jsonb)
            """,
            (schema, json.dumps(list(allowed_tables)), json.dumps(table_columns), json.dumps(relationships)),
        )
        conn.commit()
        return cur.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_latest_analysis_result():
    """
    가장 최근 분석 결과 한 건 조회.
    반환: {"id", "analyzed_at", "table_schema", "allowed_tables", "table_columns", "relationships"} 또는 None
    """
    conn = db.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, analyzed_at, table_schema, allowed_tables, table_columns, relationships
            FROM allowlist_analysis
            ORDER BY analyzed_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        cur.close()
        conn.close()
