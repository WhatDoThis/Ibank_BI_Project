"""
Backend.etl_server.table_master_hook (ETL 적재 후 table_master 반영)
=====================================================================
ETL이 메인 DB에 물리 테이블을 만들거나 적재를 완료했을 때, system_db의 전사 원장
`table_master`에 (db_type, table_name) 기준 1행을 등록하거나 갱신한다.
`table_label`·`table_dscrtn`은 ETL 메타(`etl_tables`)에서 전달되면 반영하고, 비어 있으면 기존 원장 값을 유지한다.
부서 FK는 두지 않는다(정책). `create_user_id`가 있으면 테이블 생성자로 저장한다.
`db_type`은 main / dash 만 사용한다. `table_project_mapping`은 넣지 않는다(문서 17 §13.2.5).

[Main Functions]
===========
1. upsert_table_master_after_load: 적재 성공 직후 호출. UPSERT `RETURNING table_master_id` 후 커밋·별도 연결로 `ensure_profile(..., force=True)` 시도(실패는 로그만). UPSERT/SQL 오류 시 예외를 삼키고 경고 로그만 남긴다.
2. table_master_texts_from_etl_row: etl_tables 행에서 table_label·table_dscrtn(레거시 description 폴백) 추출.

[Dependencies]
=========
- Backend.core.db (get_db_connection_system_core, get_db_connection, get_db_connection_dash, get_table_schema, get_dash_table_schema)
- Backend.widget_board_server.column_profiler.ensure_profile
- psycopg2, psycopg2.extras.RealDictCursor
"""

import logging
from typing import Optional

from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


def _trim_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


# 1.
def upsert_table_master_after_load(
    table_name: str,
    db_type: str = "main",
    *,
    create_user_id: Optional[int] = None,
    table_label: Optional[str] = None,
    table_dscrtn: Optional[str] = None,
) -> None:
    """
    ETL 적재 완료 후 `table_master` UPSERT.
    DB 제약: UNIQUE (`db_type`, `table_name`). `db_type`은 main·dash 만 허용(그 외는 main으로 처리).
    `table_label`·`table_dscrtn`은 비어 있으면 ON CONFLICT 시 기존 원장 값을 유지한다.
    실패 시에도 적재 결과는 유지한다.
    """
    tn = (table_name or "").strip()
    if not tn:
        return
    dt = (db_type or "main").strip().lower()
    if dt not in ("main", "dash"):
        dt = "main"
    tl = _trim_optional_text(table_label)
    td = _trim_optional_text(table_dscrtn)

    from Backend.core import db as core_db

    conn = None
    tm_id = None
    try:
        conn = core_db.get_db_connection_system_core()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                """
                INSERT INTO table_master (
                    db_type, table_name, create_dtm, update_dtm, create_user_id,
                    table_label, table_dscrtn
                )
                VALUES (%s, %s, NOW(), NOW(), %s, %s, %s)
                ON CONFLICT (db_type, table_name)
                DO UPDATE SET
                    update_dtm = NOW(),
                    table_label = CASE
                        WHEN EXCLUDED.table_label IS NOT NULL AND BTRIM(EXCLUDED.table_label) <> ''
                        THEN EXCLUDED.table_label
                        ELSE table_master.table_label
                    END,
                    table_dscrtn = CASE
                        WHEN EXCLUDED.table_dscrtn IS NOT NULL AND BTRIM(EXCLUDED.table_dscrtn::text) <> ''
                        THEN EXCLUDED.table_dscrtn
                        ELSE table_master.table_dscrtn
                    END
                RETURNING table_master_id
                """,
                (dt, tn, create_user_id, tl, td),
            )
            row_tm = cur.fetchone()
            if row_tm is not None:
                tm_id = int(row_tm["table_master_id"])
            conn.commit()
        finally:
            cur.close()
        if tm_id is not None:
            try:
                from Backend.widget_board_server.column_profiler import ensure_profile

                sch = (
                    core_db.get_table_schema()
                    if dt == "main"
                    else core_db.get_dash_table_schema()
                )
                sys_prof_conn = core_db.get_db_connection_system_core()
                data_prof_conn = (
                    core_db.get_db_connection()
                    if dt == "main"
                    else core_db.get_db_connection_dash()
                )
                try:
                    ensure_profile(
                        sys_prof_conn,
                        data_prof_conn,
                        tm_id,
                        sch,
                        tn,
                        force=True,
                    )
                finally:
                    try:
                        data_prof_conn.close()
                    except Exception:
                        pass
                    try:
                        sys_prof_conn.close()
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(
                    "table_master 프로파일 실패 db_type=%s table=%s id=%s: %s",
                    dt,
                    tn,
                    tm_id,
                    e,
                    exc_info=True,
                )
    except Exception as e:
        logger.warning("table_master_upsert_fail db_type=%s table=%s (load_kept): %s", dt, tn, e)
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


# 2.
def table_master_texts_from_etl_row(row: Optional[dict]) -> tuple:
    """etl_tables 조회 행에서 table_master용 라벨·설명 추출. table_dscrtn 없으면 description 폴백."""
    if not row:
        return None, None
    tl = _trim_optional_text(row.get("table_label"))
    td = _trim_optional_text(row.get("table_dscrtn"))
    if td is None:
        td = _trim_optional_text(row.get("description"))
    return tl, td
