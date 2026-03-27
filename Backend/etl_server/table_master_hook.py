"""
Backend.etl_server.table_master_hook (ETL 적재 후 table_master 반영)
=====================================================================
ETL이 메인 DB에 물리 테이블을 만들거나 적재를 완료했을 때, system_db의 전사 원장
`table_master`에 (db_type, table_name) 1행을 등록하거나 `update_dtm`만 갱신한다.
`table_project_mapping`은 넣지 않는다(문서 17 §13.2.5).

[Main Functions]
===========
1. upsert_table_master_after_load: 적재 성공 직후 호출. 실패 시 로그만 남기고 적재 결과는 유지

[Dependencies]
=========
- Backend.core.db (get_db_connection_system_core)
- psycopg2
"""

import logging

logger = logging.getLogger(__name__)


# 1.
def upsert_table_master_after_load(table_name: str, db_type: str = "main") -> None:
    """
    ETL 적재 완료 후 `table_master` UPSERT. 연결 실패·SQL 오류 시 예외를 삼키고 경고 로그만 남긴다.
    """
    tn = (table_name or "").strip()
    if not tn:
        return
    dt = (db_type or "main").strip().lower()
    if dt not in ("main", "dash", "star"):
        dt = "main"

    from Backend.core import db as core_db

    conn = None
    try:
        conn = core_db.get_db_connection_system_core()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO table_master (db_type, table_name, create_dtm, update_dtm)
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT (db_type, table_name)
            DO UPDATE SET update_dtm = NOW()
            """,
            (dt, tn),
        )
        conn.commit()
        logger.info("table_master upsert ok db_type=%s table_name=%s", dt, tn)
    except Exception as e:
        logger.warning(
            "table_master upsert failed (load success kept) db_type=%s table_name=%s: %s",
            dt,
            tn,
            e,
        )
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
