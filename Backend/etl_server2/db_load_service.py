"""
Backend.etl_server.db_load_service (DB 연동 추출·적재)
======================================================
외부 DB(PostgreSQL·MySQL) 추출(E) → 메인 DB 적재(L). Full Load / Incremental Upsert. 소스 PK는 full 모드 시 타겟 CREATE에 반영.

[Helpers]
===========
41 - _get_source_connection: connection_id로 소스 PostgreSQL 연결
59 - _is_date_type: data_type이 날짜/시간 타입인지 여부(증분 컬럼 추천용)
71 - get_source_columns: connection_id·source_table으로 소스 테이블 컬럼 목록(column_name, data_type) 반환
125 - validate_incremental_column: 증분 컬럼 날짜 검증(date 타입 또는 샘플 isdate)
55 - _fetch_source_columns_mysql: MySQL information_schema.COLUMNS (column_name, data_type)
72 - _pg_type_from_mysql: MySQL DATA_TYPE → PostgreSQL 타입 문자열
88 - _fetch_source_columns: PostgreSQL information_schema.columns
109 - _fetch_source_pk_columns: PostgreSQL 소스 테이블 PRIMARY KEY 컬럼명 목록
128 - _fetch_source_columns_oracle: Oracle ALL_TAB_COLUMNS/USER_TAB_COLUMNS (column_name, data_type)
161 - _pg_type_from_oracle: Oracle DATA_TYPE → PostgreSQL 타입 문자열
168 - _pg_type_from_info_schema: information_schema data_type → PostgreSQL 타입
186 - _pg_type_from_pandas: pandas dtype → PostgreSQL 타입
365 - _serialize_value: COPY TEXT 포맷 값 직렬화 (None/nan/inf/NaT → \\N, 이스케이프)
366 - _copy_buf: rows_tuples → COPY용 StringIO 버퍼
367 - _copy_insert_batch: Full 모드 COPY FROM STDIN 적재
368 - _copy_upsert_batch: Incremental TEMP TABLE COPY + INSERT...SELECT ON CONFLICT DO UPDATE
369 - _row_fallback: COPY 실패 시 행 단위 INSERT...ON CONFLICT, 동일 에러 50건 연속 시 조기 중단
370 - _copy_upsert_batch_safe: 1차 COPY upsert, 실패 시 _row_fallback
371 - _ensure_unique_constraint: 증분 시 타겟 테이블에 pk_list UNIQUE 없으면 ALTER TABLE 추가

[Main]
===========
run_db_load: etl_table_id 기준 소스 SELECT → 변환 룰 적용 → 메인 DB CREATE+INSERT 또는 Upsert. postgresql·mysql·oracle 분기. full 시 소스 PK 반영, incremental 시 pk_columns·ON CONFLICT 사용. incremental_column이 설정된 경우 Full 적재 완료 시에도 해당 컬럼 최대값으로 last_synced_at 갱신(Full→Incremental 전환 시 불필요한 전체 재적재 방지).

[Dependencies]
=========
- Backend.api_server.db, Backend.etl_server.service, transform_engine, transform_rules_service, etl_limits
- Env.config.loader.add_allowed_table
- psycopg2 (copy_expert), pandas
"""

import io
import logging
import math
import re
import time
from datetime import date, datetime
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

from Backend.etl_server2 import service as etl_service
from Backend.etl_server2 import transform_engine
from Backend.etl_server2 import transform_rules_service as transform_rules_svc
from Backend.etl_server2.etl_limits import get_etl_limits


def _get_source_connection(connection_id: int):
    """소스 DB 연결. service에서 가져와 psycopg2 connection 반환. PostgreSQL 전용."""
    c = etl_service.get_connection_for_etl(connection_id)
    if not c or c.get("source_type") != "postgresql":
        raise ValueError("PostgreSQL 연결이 필요합니다.")
    return etl_service._connect_postgres(
        c["host"],
        c.get("port") or 5432,
        c["database_name"],
        c["username"],
        c.get("encrypted_password") or "",
    )


def _is_date_type(data_type: str) -> bool:
    """DB data_type이 날짜/시간 타입인지 여부. 증분 컬럼 추천용."""
    t = (data_type or "").strip().lower()
    if t in ("date", "datetime", "timestamp", "timestamptz", "timestamp with time zone",
             "timestamp without time zone", "time", "timetz", "time with time zone",
             "year", "interval"):
        return True
    if "date" in t or "time" in t:
        return True
    return False


def get_source_columns(connection_id: int, source_table: str) -> List[dict]:
    """
    소스 DB의 지정 테이블 컬럼 목록. connection_id, source_table 필수.
    반환: [{"column_name": str, "data_type": str}, ...] (ordinal_position 순)
    """
    c = etl_service.get_connection_for_etl(connection_id)
    if not c:
        raise ValueError("연결을 찾을 수 없습니다.")
    stype = (c.get("source_type") or "postgresql").strip().lower()
    if stype not in ("postgresql", "mysql", "oracle"):
        raise ValueError("postgresql, mysql, oracle만 지원합니다.")
    source_table = etl_service._validate_source_table(source_table)
    conn_schema_pg = (c.get("schema_name") or "public").strip()
    conn_db_mysql = (c.get("database_name") or "").strip()
    conn_schema_oracle = (c.get("schema_name") or c.get("username") or "").strip()
    src_schema, source_table_name = etl_service.parse_source_table_parts(
        source_table, stype,
        conn_schema=conn_schema_oracle if stype == "oracle" else conn_schema_pg,
        conn_db=conn_db_mysql,
    )
    if not source_table_name:
        raise ValueError("source_table이 비어 있습니다.")
    src_conn = None
    try:
        if stype == "mysql":
            src_conn = etl_service._connect_mysql(
                c["host"], c.get("port") or 3306, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            cols = _fetch_source_columns_mysql(src_conn, src_schema, source_table_name)
        elif stype == "oracle":
            src_conn = etl_service._connect_oracle(
                c["host"], c.get("port") or 1521, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
            tbl = source_table_name.strip().upper()
            cols = _fetch_source_columns_oracle(src_conn, owner, tbl)
        else:
            src_conn = _get_source_connection(connection_id)
            cols = _fetch_source_columns(src_conn, src_schema, source_table_name)
        return [{"column_name": col[0], "data_type": col[1]} for col in cols]
    finally:
        if src_conn:
            try:
                src_conn.close()
            except Exception:
                pass


def validate_incremental_column(connection_id: int, source_table: str, column_name: str) -> dict:
    """
    증분 컬럼이 날짜(또는 날짜 파싱 가능)인지 검증.
    - 날짜/시간 타입이면 valid=True.
    - 그 외 타입이면 샘플 행으로 pd.to_datetime 파싱 시도; 모두 파싱 가능하면 valid=True, 아니면 valid=False.
    반환: {"valid": bool, "message": str}
    """
    if not (column_name or "").strip():
        return {"valid": False, "message": "컬럼명이 비어 있습니다."}
    etl_service._validate_identifier(column_name.strip(), "incremental_column")
    columns = get_source_columns(connection_id, source_table)
    col_map = {(c.get("column_name") or "").strip().lower(): c for c in columns}
    col_key = column_name.strip().lower()
    if col_key not in col_map:
        return {"valid": False, "message": f"소스 테이블에 컬럼 '{column_name}'이(가) 없습니다."}
    data_type = (col_map[col_key].get("data_type") or "").strip().lower()
    if _is_date_type(data_type):
        return {"valid": True, "message": "날짜/시간 타입 컬럼입니다."}
    # 비날짜 타입: 샘플로 isdate 검사
    c = etl_service.get_connection_for_etl(connection_id)
    if not c:
        return {"valid": False, "message": "연결을 찾을 수 없습니다."}
    stype = (c.get("source_type") or "postgresql").strip().lower()
    source_table = etl_service._validate_source_table(source_table)
    conn_schema_pg = (c.get("schema_name") or "public").strip()
    conn_db_mysql = (c.get("database_name") or "").strip()
    conn_schema_oracle = (c.get("schema_name") or c.get("username") or "").strip()
    src_schema, source_table_name = etl_service.parse_source_table_parts(
        source_table, stype,
        conn_schema=conn_schema_oracle if stype == "oracle" else conn_schema_pg,
        conn_db=conn_db_mysql,
    )
    if not source_table_name:
        return {"valid": False, "message": "source_table이 비어 있습니다."}
    # 실제 컬럼명(원본 대소문자)
    orig_col = next((x.get("column_name") for x in columns if (x.get("column_name") or "").strip().lower() == col_key), column_name.strip())
    src_conn = None
    try:
        if stype == "mysql":
            src_conn = etl_service._connect_mysql(
                c["host"], c.get("port") or 3306, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            quoted_src = f"`{src_schema}`.`{source_table_name}`"
            qcol = f"`{orig_col}`"
        elif stype == "oracle":
            src_conn = etl_service._connect_oracle(
                c["host"], c.get("port") or 1521, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
            tbl = source_table_name.strip().upper()
            quoted_src = f'"{owner}"."{tbl}"'
            qcol = f'"{orig_col.upper()}"' if orig_col else f'"{column_name.upper()}"'
        else:
            src_conn = _get_source_connection(connection_id)
            quoted_src = f'"{src_schema}"."{source_table_name}"'
            qcol = f'"{orig_col}"'
        cur = src_conn.cursor()
        try:
            if stype == "oracle":
                cur.execute(f"SELECT {qcol} FROM {quoted_src} WHERE ROWNUM <= 200")
            else:
                cur.execute(f"SELECT {qcol} FROM {quoted_src} LIMIT 200")
            rows = cur.fetchall()
            if not rows:
                return {"valid": True, "message": "테이블에 데이터가 없어 샘플 검증을 건너뜁니다."}
            if hasattr(rows[0], "keys") and rows:
                vals = [r.get(orig_col) or r.get(orig_col.upper()) or (r[0] if isinstance(r, (list, tuple)) else None) for r in rows]
            else:
                vals = [r[0] if isinstance(r, (list, tuple)) else r for r in rows] if rows else []
        finally:
            cur.close()
        for v in vals:
            if v is None or (isinstance(v, str) and not v.strip()):
                continue
            try:
                conv = pd.to_datetime(v, errors="coerce")
                if pd.isna(conv):
                    return {"valid": False, "message": f"일부 값이 날짜 형식이 아닙니다. (예: '{str(v)[:50]}')"}
            except Exception:
                return {"valid": False, "message": "날짜로 파싱할 수 없는 값이 있습니다."}
        return {"valid": True, "message": "샘플 값이 모두 날짜 형식으로 파싱됩니다."}
    finally:
        if src_conn:
            try:
                src_conn.close()
            except Exception:
                pass


def _fetch_source_columns_mysql(conn, table_schema: str, table_name: str) -> List[Tuple[str, str]]:
    """MySQL information_schema.COLUMNS에서 (column_name, data_type) 목록. conn은 PyMySQL."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COLUMN_NAME, DATA_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        ORDER BY ORDINAL_POSITION
        """,
        (table_schema, table_name),
    )
    rows = cur.fetchall()
    cur.close()
    return [(r[0], r[1]) for r in rows]


def _pg_type_from_mysql(data_type: str) -> str:
    """MySQL DATA_TYPE → PostgreSQL 타입 문자열(메인 DB CREATE용)."""
    t = (data_type or "").lower()
    if t in ("int", "integer", "smallint", "bigint", "mediumint", "tinyint"):
        return "BIGINT"
    if t in ("decimal", "numeric", "float", "double", "real"):
        return "DOUBLE PRECISION"
    if t in ("date", "datetime", "timestamp", "time", "year"):
        return "TIMESTAMP"
    if t in ("tinyint",) and "bool" in t:
        return "BOOLEAN"
    return "TEXT"


def _fetch_source_columns(conn, schema: str, table: str) -> List[Tuple[str, str]]:
    """information_schema.columns에서 (column_name, data_type) 목록."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )
    rows = cur.fetchall()
    cur.close()
    return [(r["column_name"], r["data_type"]) for r in rows]


def _fetch_source_pk_columns(conn, schema: str, table: str) -> List[str]:
    """소스 DB의 information_schema에서 해당 테이블 PRIMARY KEY 컬럼명 목록. 없으면 []."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = %s AND tc.table_name = %s
            ORDER BY kcu.ordinal_position
            """,
            (schema, table),
        )
        return [r["column_name"] for r in cur.fetchall()]
    finally:
        cur.close()


def _ensure_unique_constraint(
    cur, conn, main_schema: str, target_table: str, pk_list: List[str]
) -> Optional[str]:
    """
    타겟 테이블에 pk_list 컬럼에 대한 UNIQUE 또는 PRIMARY KEY가 있는지 확인.
    없으면 ALTER TABLE ADD CONSTRAINT ... UNIQUE (pk_list) 시도.
    반환: None(성공 또는 이미 존재), 실패 시 에러 메시지 문자열.
    """
    if not pk_list:
        return None
    try:
        cur.execute(
            """
            SELECT tc.constraint_name,
                   array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS cols
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_catalog = kcu.table_catalog
            WHERE tc.table_schema = %s AND tc.table_name = %s
              AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
            GROUP BY tc.constraint_name
            """,
            (main_schema, target_table),
        )
        pk_set = set(pk_list)
        for row in cur.fetchall():
            raw = row["cols"]
            if isinstance(raw, list):
                cols = raw
            elif hasattr(raw, "__iter__") and not isinstance(raw, str):
                cols = list(raw)
            else:
                cols = [x.strip() for x in str(raw).strip("{}").split(",")] if raw else []
            if set(cols) == pk_set:
                return None
        safe_name = "".join(c if c.isalnum() or c == "_" else "_" for c in target_table)[:50]
        constraint_name = f"{safe_name}_etl_uq"
        pk_cols = ", ".join(f'"{p}"' for p in pk_list)
        full_name = f'"{main_schema}"."{target_table}"'
        cur.execute(f'ALTER TABLE {full_name} ADD CONSTRAINT "{constraint_name}" UNIQUE ({pk_cols})')
        conn.commit()
        return None
    except Exception as e:
        conn.rollback()
        return str(e)[:500]


def _fetch_source_columns_oracle(conn, owner: str, table_name: str) -> List[Tuple[str, str]]:
    """Oracle ALL_TAB_COLUMNS / USER_TAB_COLUMNS에서 (column_name, data_type) 목록. owner 없으면 USER_TAB_COLUMNS. 테이블/컬럼명은 대문자로 조회."""
    cur = conn.cursor()
    try:
        o = (owner or "").strip().upper()
        t = (table_name or "").strip().upper()
        if not t:
            return []
        if o:
            cur.execute(
                """
                SELECT COLUMN_NAME, DATA_TYPE
                FROM ALL_TAB_COLUMNS
                WHERE OWNER = :1 AND TABLE_NAME = :2
                ORDER BY COLUMN_ID
                """,
                (o, t),
            )
        else:
            cur.execute(
                """
                SELECT COLUMN_NAME, DATA_TYPE
                FROM USER_TAB_COLUMNS
                WHERE TABLE_NAME = :1
                ORDER BY COLUMN_ID
                """,
                (t,),
            )
        rows = cur.fetchall()
        return [(r[0], r[1]) for r in rows]
    finally:
        cur.close()


def _pg_type_from_oracle(data_type: str) -> str:
    """Oracle DATA_TYPE → PostgreSQL 타입 문자열(메인 DB CREATE용)."""
    t = (data_type or "").upper()
    if t in ("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE"):
        return "DOUBLE PRECISION"
    if t in ("INTEGER", "SMALLINT"):
        return "BIGINT"
    if t in ("VARCHAR2", "NVARCHAR2", "VARCHAR", "CHAR", "NCHAR", "CLOB", "NCLOB", "LONG", "BLOB", "RAW"):
        return "TEXT"
    if t in ("DATE", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITH LOCAL TIME ZONE"):
        return "TIMESTAMP"
    return "TEXT"


def _pg_type_from_info_schema(data_type: str) -> str:
    """information_schema data_type → PostgreSQL 타입."""
    t = (data_type or "").lower()
    if t in ("integer", "smallint"):
        return "BIGINT"
    if t == "bigint":
        return "BIGINT"
    if t in ("numeric", "decimal", "real", "double precision"):
        return "DOUBLE PRECISION"
    if t == "boolean":
        return "BOOLEAN"
    if t in ("timestamp with time zone", "timestamp without time zone", "timestamptz", "timestamp"):
        return "TIMESTAMP"
    if t == "date":
        return "DATE"
    return "TEXT"


def _pg_type_from_pandas(dtype) -> str:
    """pandas dtype → PostgreSQL 타입 (변환 룰으로 추가된 컬럼용)."""
    s = str(dtype).lower()
    if "int" in s:
        return "BIGINT"
    if "float" in s:
        return "DOUBLE PRECISION"
    if "bool" in s:
        return "BOOLEAN"
    if "datetime" in s or "date" in s:
        return "TIMESTAMP"
    return "TEXT"


def _serialize_value(v) -> str:
    """COPY TEXT 포맷용 값 직렬화. None/nan/inf/NaT → \\N, 그 외는 str 후 \\ \\t \\n \\r 이스케이프."""
    if v is None:
        return "\\N"
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return "\\N"
    try:
        if pd.isna(v):
            return "\\N"
    except Exception:
        pass
    if isinstance(v, (datetime, date)) or hasattr(v, "isoformat"):
        s = v.isoformat() if hasattr(v, "isoformat") else str(v)
    else:
        s = str(v)
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def _copy_buf(cols: List[str], rows_tuples: List[tuple]) -> io.StringIO:
    """rows_tuples를 COPY TEXT용 버퍼로 변환. 탭 구분·행마다 개행. seek(0) 완료."""
    lines = []
    for row in rows_tuples:
        cells = [_serialize_value(row[i]) if i < len(row) else "\\N" for i in range(len(cols))]
        lines.append("\t".join(cells))
    buf = io.StringIO("\n".join(lines) + "\n")
    buf.seek(0)
    return buf


def _copy_insert_batch(cur, full_name: str, cols: List[str], rows_tuples: List[tuple]) -> None:
    """Full 모드: COPY로 본 테이블에 직접 적재."""
    if not rows_tuples:
        return
    col_str = ", ".join(f'"{c}"' for c in cols)
    buf = _copy_buf(cols, rows_tuples)
    cur.copy_expert(
        f"COPY {full_name} ({col_str}) FROM STDIN WITH (FORMAT text, NULL '\\N')",
        buf,
    )


def _copy_upsert_batch(
    cur, full_name: str, cols: List[str], col_types: List[str], pk_list: List[str], rows_tuples: List[tuple]
) -> None:
    """Incremental: TEMP 테이블(TEXT)에 COPY 후 INSERT...SELECT로 CAST·ON CONFLICT DO UPDATE."""
    if not rows_tuples:
        return
    stg = f"_etl_stg_{id(cur)}"
    col_str = ", ".join(f'"{c}"' for c in cols)
    cur.execute(
        f'CREATE TEMP TABLE "{stg}" ({", ".join(chr(34) + c + chr(34) + " TEXT" for c in cols)}) ON COMMIT DROP'
    )
    buf = _copy_buf(cols, rows_tuples)
    cur.copy_expert(f'COPY "{stg}" ({col_str}) FROM STDIN WITH (FORMAT text, NULL \'\\N\')', buf)
    pk_str = ", ".join(f'"{p}"' for p in pk_list)
    col_cast = ", ".join(f'"{c}"::{t}' for c, t in zip(cols, col_types))
    set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk_list]
    if not set_parts:
        set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols]
    set_str = ", ".join(set_parts)
    cur.execute(
        f'INSERT INTO {full_name} ({col_str}) SELECT {col_cast} FROM "{stg}" '
        f"ON CONFLICT ({pk_str}) DO UPDATE SET {set_str}"
    )


def _row_fallback(
    cur, conn, full_name: str, cols: List[str], pk_list: List[str], rows_tuples: List[tuple],
    job_id: Optional[int] = None, batch_offset: int = 0,
) -> Tuple[int, List[dict]]:
    """
    행 단위 INSERT...ON CONFLICT 시도. 성공 행은 적재, 실패 행은 스킵하고 기록.
    동일 에러가 연속 50건 이상이면 구조적 문제로 판단하고 조기 중단.
    반환: (inserted_count, failed_rows) — failed_rows는 [{"row_index", "data", "error"}, ...]
    """
    col_str = ", ".join(f'"{c}"' for c in cols)
    pk_str = ", ".join(f'"{p}"' for p in pk_list)
    set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in pk_list]
    if not set_parts:
        set_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols]
    set_str = ", ".join(set_parts)
    placeholders = ", ".join(["%s"] * len(cols))
    upsert_sql = (
        f'INSERT INTO {full_name} ({col_str}) VALUES ({placeholders}) '
        f'ON CONFLICT ({pk_str}) DO UPDATE SET {set_str}'
    )
    inserted = 0
    failed_rows: List[dict] = []
    consecutive_same_error = 0
    last_error: Optional[str] = None
    early_stop_at: Optional[int] = None
    for i, row in enumerate(rows_tuples):
        if early_stop_at is not None and i >= early_stop_at:
            break
        try:
            cur.execute(upsert_sql, row)
            inserted += 1
            consecutive_same_error = 0
            last_error = None
        except Exception as row_err:
            conn.rollback()
            err_str = str(row_err)[:200]
            failed_rows.append({
                "row_index": batch_offset + i,
                "data": row[:5] if len(row) > 5 else row,
                "error": err_str,
            })
            logger.warning(
                "행 적재 실패 job_id=%s row_index=%s: %s",
                job_id, batch_offset + i, err_str,
            )
            if last_error == err_str:
                consecutive_same_error += 1
                if consecutive_same_error >= 50:
                    early_stop_at = i + 1
                    remaining = len(rows_tuples) - early_stop_at
                    failed_rows.append({
                        "row_index": batch_offset + early_stop_at,
                        "data": None,
                        "error": f"동일 오류 50건 연속 → 조기 중단 (구조적 문제 가능성). 미적재 {remaining}건.",
                    })
                    logger.warning(
                        "행 단위 fallback 조기 중단 job_id=%s: 동일 에러 50건 연속, 미적재 %s건",
                        job_id, remaining,
                    )
                    break
            else:
                last_error = err_str
                consecutive_same_error = 1
    if inserted > 0:
        conn.commit()
    return inserted, failed_rows


def _copy_upsert_batch_safe(
    cur, conn, full_name: str, cols: List[str], col_types: List[str], pk_list: List[str],
    rows_tuples: List[tuple], job_id: Optional[int] = None, batch_offset: int = 0,
) -> Tuple[int, List[dict]]:
    """
    1차: _copy_upsert_batch 시도. 실패 시 rollback 후 행 단위 fallback.
    반환: (inserted_count, failed_rows)
    """
    try:
        _copy_upsert_batch(cur, full_name, cols, col_types, pk_list, rows_tuples)
        return len(rows_tuples), []
    except Exception as e:
        conn.rollback()
        logger.warning(
            "COPY upsert 실패, 행 단위 fallback 전환 (batch_offset=%s): %s",
            batch_offset, e,
        )
        return _row_fallback(cur, conn, full_name, cols, pk_list, rows_tuples, job_id, batch_offset)


def run_db_load(etl_table_id: int, job_id: Optional[int] = None) -> dict:
    """
    ETL 테이블(DB 연동) 1건에 대해 추출·적재 실행.
    - job_id가 있으면(Phase 6 큐) 해당 Job 사용; 없으면 새 Job 삽입 후 실행.
    - sync_mode=full: 소스 전체 SELECT → 메인 DB DROP+CREATE+INSERT.
    - sync_mode=incremental: incremental_column > last_synced_at 조건 SELECT → Upsert.
    반환: { job_id, status, rows_processed, error_message? }
    """
    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    if row.get("source_type") == "file":
        raise ValueError("파일 기반 ETL입니다. POST /tables/{id}/run 은 파일·DB 자동 분기됩니다.")
    connection_id = row.get("connection_id")
    source_table = row.get("source_table")
    target_table = row.get("target_table")
    pk_columns = (row.get("pk_columns") or "").strip() or None
    incremental_column = (row.get("incremental_column") or "").strip() or None
    # 명시적으로 "full"인 경우만 전체 적재(DROP+INSERT). 그 외는 모두 증분(Upsert). service.get_sync_mode_for_load로 통일.
    sync_mode = etl_service.get_sync_mode_for_load(etl_table_id)
    batch_size = (row.get("batch_size") or 0) if row.get("batch_size") is not None else 0
    try:
        batch_size = int(batch_size) if batch_size else 0
    except (TypeError, ValueError):
        batch_size = 0
    batch_interval_seconds = row.get("batch_interval_seconds")
    if batch_interval_seconds is None:
        batch_interval_seconds = 0
    try:
        batch_interval_seconds = max(0, int(batch_interval_seconds))
    except (TypeError, ValueError):
        batch_interval_seconds = 0
    on_row_error = (row.get("on_row_error") or "fail").strip().lower()
    if on_row_error not in ("fail", "skip"):
        on_row_error = "fail"

    if not connection_id or not source_table or not target_table:
        raise ValueError("connection_id, source_table, target_table가 필요합니다.")

    max_file_mb, max_rows_per_load, max_batch_size = get_etl_limits()
    effective_batch_size = batch_size
    if max_batch_size > 0:
        effective_batch_size = min(batch_size, max_batch_size) if batch_size > 0 else max_batch_size
    target_table = etl_service._validate_identifier(target_table, "target_table")
    source_table = etl_service._validate_source_table(source_table)
    if job_id is None:
        job_id = etl_service.insert_job(etl_table_id, status="running")
    else:
        etl_service.set_job_running(job_id)
    etl_service.update_etl_table_status(etl_table_id, "running")
    logger.info(
        "ETL db load started etl_table_id=%s job_id=%s sync_mode=%s incremental_column=%s",
        etl_table_id, job_id, sync_mode, incremental_column or "(none)",
    )

    try:
        c = etl_service.get_connection_for_etl(connection_id)
        stype = (c.get("source_type") or "postgresql").strip().lower()
        if stype not in ("postgresql", "mysql", "oracle"):
            raise ValueError(f"DB 적재는 postgresql, mysql, oracle만 지원합니다. source_type={stype}")

        conn_schema_pg = (c.get("schema_name") or "public").strip()
        conn_db_mysql = (c.get("database_name") or "").strip()
        conn_schema_oracle = (c.get("schema_name") or c.get("username") or "").strip()
        src_schema, source_table_name = etl_service.parse_source_table_parts(
            source_table,
            stype,
            conn_schema=conn_schema_oracle if stype == "oracle" else conn_schema_pg,
            conn_db=conn_db_mysql,
        )
        if not source_table_name:
            raise ValueError("source_table이 비어 있습니다.")

        if stype == "mysql":
            src_conn = etl_service._connect_mysql(
                c["host"],
                c.get("port") or 3306,
                c["database_name"],
                c["username"],
                c.get("encrypted_password") or "",
            )
            columns = _fetch_source_columns_mysql(src_conn, src_schema, source_table_name)
            source_pk_list = etl_service._fetch_pk_from_mysql(src_conn, src_schema, source_table_name)
            quoted_src = f"`{src_schema}`.`{source_table_name}`"
            type_mapper = _pg_type_from_mysql
            row_type = "tuple"
            _quote = lambda x: f"`{x}`"
            bind_placeholder = "%s"
        elif stype == "oracle":
            src_conn = etl_service._connect_oracle(
                c["host"],
                c.get("port") or 1521,
                c["database_name"],
                c["username"],
                c.get("encrypted_password") or "",
            )
            owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
            tbl = source_table_name.strip().upper()
            columns = _fetch_source_columns_oracle(src_conn, owner, tbl)
            source_pk_list = etl_service._fetch_pk_from_oracle(src_conn, owner, tbl)
            quoted_src = f'"{owner}"."{tbl}"'
            type_mapper = _pg_type_from_oracle
            row_type = "tuple"
            _quote = lambda x: f'"{x}"'
            bind_placeholder = ":1"
        else:
            src_conn = _get_source_connection(connection_id)
            columns = _fetch_source_columns(src_conn, src_schema, source_table_name)
            source_pk_list = _fetch_source_pk_columns(src_conn, src_schema, source_table_name)
            quoted_src = f'"{src_schema}"."{source_table_name}"'
            type_mapper = _pg_type_from_info_schema
            row_type = "dict"
            _quote = lambda x: f'"{x}"'
            bind_placeholder = "%s"

        if not columns:
            try:
                src_conn.close()
            except Exception:
                pass
            etl_service.update_job(job_id, "failed", error_message="소스 테이블에 컬럼이 없습니다.")
            etl_service.update_etl_table_status(etl_table_id, "error")
            return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "소스 테이블에 컬럼이 없습니다."}

        col_names = [c[0] for c in columns]
        # Phase 4: column_mapping 있으면 소스→타겟 매핑으로 SELECT 컬럼·타겟 컬럼 제한
        column_mapping = row.get("column_mapping")
        mapping_used: List[dict] = []
        if isinstance(column_mapping, list) and column_mapping:
            col_set = set(col_names)
            for m in column_mapping:
                src = (m.get("source") or "").strip()
                tgt = (m.get("target") or "").strip()
                if src in col_set and tgt:
                    etl_service._validate_identifier(tgt, "target")
                    mapping_used.append({
                        "source": src,
                        "target": tgt,
                        "type": (m.get("type") or "TEXT").strip().upper() or "TEXT",
                        "on_error": (m.get("on_error") or "null").strip().lower() or "null",
                    })
            if mapping_used:
                select_sources = [m["source"] for m in mapping_used]
                select_list = ", ".join(_quote(s) for s in select_sources)
                col_names = select_sources
        else:
            select_list = ", ".join(_quote(c) for c in col_names)
        where_clause = ""
        params = []
        if sync_mode == "incremental" and incremental_column:
            etl_service._validate_identifier(incremental_column, "incremental_column")
            last_synced = row.get("last_synced_at")
            if last_synced is not None:
                where_clause = f" WHERE {_quote(incremental_column)} > {bind_placeholder}"
                params.append(last_synced)
        elif sync_mode == "incremental" and not incremental_column:
            logger.info(
                "ETL db load etl_table_id=%s: 증분 모드이나 증분 컬럼 미지정 → 소스 전체 조회 후 업서트. "
                "소스 테이블의 시간/순서 컬럼(예: updated_at)을 증분 컬럼으로 지정하면 이후 행만 조회합니다.",
                etl_table_id,
            )
        if stype in ("mysql", "oracle") and effective_batch_size == 0:
            effective_batch_size = 10000
            logger.info("ETL db load etl_table_id=%s: MySQL/Oracle batch_size=0 → 스트리밍 배치 10000 적용", etl_table_id)
        # MySQL SSCursor: INSERT를 COPY로 빠르게 하면 fetch 간격이 줄어 net_write_timeout 위험 감소. 상한 10000 허용.
        if stype == "mysql" and effective_batch_size > 10000:
            effective_batch_size = 10000
            logger.info("ETL db load etl_table_id=%s: MySQL SSCursor 배치 상한 10000 적용", etl_table_id)
        if stype == "oracle":
            limit_sql = f" FETCH FIRST {max_rows_per_load} ROWS ONLY" if (effective_batch_size == 0 and max_rows_per_load > 0) else ""
        else:
            limit_sql = f" LIMIT {max_rows_per_load}" if (effective_batch_size == 0 and max_rows_per_load > 0) else ""
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}

    try:

        if effective_batch_size > 0:
            # 배치 단위 스트리밍: 메모리에 전체를 쌓지 않고 fetch -> 변환 -> 적재 반복. config 한도 적용.
            # ETA용 total_rows: PostgreSQL만 COUNT(*) (MySQL/Oracle은 대용량에서 COUNT 비용 큼).
            if row_type == "dict":
                cur_count = src_conn.cursor()
                cur_count.execute(f'SELECT COUNT(*) FROM {quoted_src}{where_clause}', params)
                row_count = cur_count.fetchone()
                total_from_src = list(row_count.values())[0] if hasattr(row_count, "values") else row_count[0]
                cur_count.close()
                total_rows_cap = min(total_from_src, max_rows_per_load) if max_rows_per_load > 0 else total_from_src
                etl_service.set_job_total_rows(job_id, total_rows_cap)
            else:
                etl_service.set_job_total_rows(job_id, 0)
            if row_type == "dict":
                cur_src = src_conn.cursor(name="etl_src_%s" % job_id)
            elif stype == "mysql":
                try:
                    import pymysql.cursors
                    cur_src = src_conn.cursor(pymysql.cursors.SSCursor)
                except ImportError:
                    cur_src = src_conn.cursor()
            else:
                cur_src = src_conn.cursor()
            if stype == "oracle":
                cur_src.arraysize = min(effective_batch_size, 5000)
            cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}', params)
            total_processed, first_batch = 0, True
            total_failed: List[dict] = []
            run_is_full = False
            last_synced_candidate = None
            conn_main, main_schema = etl_service.get_target_db_connection(row.get("storage_connection_id"))
            cur_main = conn_main.cursor()
            full_name = f'"{main_schema}"."{target_table}"'
            try:
                rules = []
                try:
                    rules = transform_rules_svc.list_transform_rules(etl_table_id)
                except Exception:
                    pass
                cols, col_types = None, None
                pk_list_inc = []
                while True:
                    batch = cur_src.fetchmany(effective_batch_size)
                    if not batch:
                        break
                    if row_type == "tuple":
                        batch = [dict(zip(col_names, r)) for r in batch]
                    if max_rows_per_load > 0 and total_processed + len(batch) > max_rows_per_load:
                        batch = batch[: max_rows_per_load - total_processed]
                    df_batch = pd.DataFrame(batch, columns=col_names)
                    try:
                        df_batch = transform_engine.apply_rules(df_batch, rules)
                    except Exception:
                        pass
                    if mapping_used:
                        try:
                            df_batch = transform_engine.apply_mapping_type_cast(df_batch, mapping_used, default_on_error="null")
                        except ValueError as cast_err:
                            etl_service.update_job(job_id, "failed", error_message=str(cast_err))
                            etl_service.update_etl_table_status(etl_table_id, "error")
                            cur_src.close()
                            src_conn.close()
                            return {"job_id": job_id, "status": "failed", "rows_processed": total_processed, "error_message": str(cast_err)}
                    rows_batch = df_batch.replace({pd.NA: None}).to_dict("records")
                    if first_batch:
                        if mapping_used:
                            columns_final = [(m["target"], m["type"]) for m in mapping_used]
                            cols = [m["target"] for m in mapping_used]
                            pk_list_full = [m["target"] for m in mapping_used if m["source"] in source_pk_list]
                        else:
                            source_col_map = {c[0]: c[1] for c in columns}
                            columns_final = []
                            for col in df_batch.columns:
                                pg_t = source_col_map.get(col)
                                if pg_t is not None:
                                    columns_final.append((col, type_mapper(pg_t)))
                                else:
                                    columns_final.append((col, _pg_type_from_pandas(df_batch[col].dtype)))
                            cols = [c[0] for c in columns_final]
                            pk_list_full = [p for p in source_pk_list if p in cols]
                        col_types = [t for _, t in columns_final]
                        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns_final)
                        effective_sync = etl_service.get_sync_mode_for_load(etl_table_id)
                        run_is_full = (effective_sync == "full")
                        if sync_mode == "full" and effective_sync != "full":
                            logger.warning("ETL db load etl_table_id=%s: sync_mode re-check is incremental, forcing incremental (no DROP)", etl_table_id)
                            sync_mode = "incremental"
                        if effective_sync == "full":
                            cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                            pk_part = (", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in pk_list_full) + ")") if pk_list_full else ""
                            cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{pk_part})")
                            conn_main.commit()
                        else:
                            if not pk_columns:
                                etl_service.update_job(job_id, "failed", error_message="incremental 모드는 pk_columns가 필요합니다.")
                                etl_service.update_etl_table_status(etl_table_id, "error")
                                return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "pk_columns 필요"}
                            pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                            if mapping_used:
                                pk_list = [m["target"] for m in mapping_used if m["source"] in pk_list] or pk_list
                            for pk in pk_list:
                                etl_service._validate_identifier(pk, "pk_columns")
                            try:
                                cur_main.execute(f"SELECT 1 FROM {full_name} LIMIT 1")
                                cur_main.fetchone()
                            except Exception:
                                conn_main.rollback()
                                uniq_part = f", UNIQUE ({', '.join(chr(34) + p + chr(34) for p in pk_list)})" if pk_list else ""
                                cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{uniq_part})")
                                conn_main.commit()
                            else:
                                err_msg = _ensure_unique_constraint(cur_main, conn_main, main_schema, target_table, pk_list)
                                if err_msg:
                                    etl_service.update_job(job_id, "failed", error_message=f"타겟 테이블에 UNIQUE 제약을 추가할 수 없습니다. {err_msg}")
                                    etl_service.update_etl_table_status(etl_table_id, "error")
                                    cur_main.close()
                                    conn_main.close()
                                    cur_src.close()
                                    src_conn.close()
                                    return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": err_msg}
                        if sync_mode != "full":
                            pk_list_inc = [x.strip() for x in pk_columns.split(",") if x.strip()]
                            if mapping_used:
                                pk_list_inc = [m["target"] for m in mapping_used if m["source"] in pk_list_inc] or pk_list_inc
                        first_batch = False
                    if etl_service.is_job_cancelled(job_id):
                        conn_main.rollback()
                        cur_main.close()
                        conn_main.close()
                        cur_src.close()
                        src_conn.close()
                        etl_service.update_job(job_id, "cancelled", rows_processed=total_processed, error_message="사용자 취소")
                        etl_service.update_etl_table_status(etl_table_id, "error")
                        return {"job_id": job_id, "status": "cancelled", "rows_processed": total_processed, "error_message": "사용자 취소"}
                    rows_tuples = [
                        tuple(r.get(m["source"]) for m in mapping_used) if mapping_used else tuple(r.get(c) for c in cols)
                        for r in rows_batch
                    ]
                    if sync_mode == "full":
                        _copy_insert_batch(cur_main, full_name, cols, rows_tuples)
                        conn_main.commit()
                        batch_inserted = len(rows_tuples)
                    else:
                        if on_row_error == "skip":
                            batch_inserted, failed = _copy_upsert_batch_safe(
                                cur_main, conn_main, full_name, cols, col_types, pk_list_inc,
                                rows_tuples, job_id=job_id, batch_offset=total_processed,
                            )
                            total_failed.extend(failed)
                            conn_main.commit()
                        else:
                            _copy_upsert_batch(cur_main, full_name, cols, col_types, pk_list_inc, rows_tuples)
                            conn_main.commit()
                            batch_inserted = len(rows_tuples)
                    total_processed += batch_inserted
                    if incremental_column and incremental_column in col_names and rows_batch:
                        max_vals = [r.get(incremental_column) for r in rows_batch if r.get(incremental_column) is not None]
                        if max_vals:
                            from datetime import datetime as dt
                            latest = max(max_vals) if isinstance(max_vals[0], dt) else max(max_vals)
                            if run_is_full:
                                last_synced_candidate = latest if last_synced_candidate is None else max(last_synced_candidate, latest)
                            else:
                                etl_service.update_last_synced_at(etl_table_id, latest)
                    etl_service.update_job_progress(job_id, total_processed)
                    if max_rows_per_load > 0 and total_processed >= max_rows_per_load:
                        break
                    if batch_interval_seconds > 0:
                        time.sleep(batch_interval_seconds)
            finally:
                cur_main.close()
                conn_main.close()
                try:
                    cur_src.close()
                except Exception:
                    pass
                try:
                    src_conn.close()
                except Exception:
                    pass
            if run_is_full and last_synced_candidate is not None:
                etl_service.update_last_synced_at(etl_table_id, last_synced_candidate)
            if not row.get("storage_connection_id"):
                from Env.config.loader import add_allowed_table
                add_allowed_table(target_table)
            if total_failed:
                notice = f"적재 실패 {len(total_failed)}건 (총 {total_processed + len(total_failed)}건 중)"
                details = "; ".join(f"row#{f['row_index']}: {f['error'][:80]}" for f in total_failed[:10])
                etl_service.update_job(
                    job_id, "completed", rows_processed=total_processed,
                    notice=f"{notice}. {details}",
                )
            else:
                etl_service.update_job(job_id, "completed", rows_processed=total_processed)
            etl_service.update_etl_table_status(etl_table_id, "done")
            logger.info("ETL db load completed job_id=%s rows_processed=%s (streaming)", job_id, total_processed)
            return {"job_id": job_id, "status": "completed", "rows_processed": total_processed}
        else:
            cur_src = src_conn.cursor()
            cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}{limit_sql}', params)
            rows_data = cur_src.fetchall()
            cur_src.close()
            src_conn.close()
            if row_type == "tuple":
                rows_data = [dict(zip(col_names, r)) for r in rows_data]
            etl_service.set_job_total_rows(job_id, len(rows_data))

        if rows_processed == 0:
            etl_service.update_job(job_id, "completed", rows_processed=0)
            etl_service.update_etl_table_status(etl_table_id, "done")
            logger.info("ETL db load completed job_id=%s rows_processed=0 (no rows)", job_id)
            return {"job_id": job_id, "status": "completed", "rows_processed": 0}

        # Phase 4: 변환 룰 적용 + 매핑 기반 형변환
        df = pd.DataFrame(rows_data, columns=col_names)
        try:
            rules = transform_rules_svc.list_transform_rules(etl_table_id)
            df = transform_engine.apply_rules(df, rules)
        except Exception:
            pass
        if mapping_used:
            try:
                df = transform_engine.apply_mapping_type_cast(df, mapping_used, default_on_error="null")
            except ValueError as cast_err:
                etl_service.update_job(job_id, "failed", error_message=str(cast_err))
                etl_service.update_etl_table_status(etl_table_id, "error")
                return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(cast_err)}
        rows_data = df.replace({pd.NA: None}).to_dict("records")
        rows_processed = len(rows_data)
        if mapping_used:
            columns_final = [(m["target"], m["type"]) for m in mapping_used]
            cols = [m["target"] for m in mapping_used]
            pk_list_full = [m["target"] for m in mapping_used if m["source"] in source_pk_list]
        else:
            source_col_map = {c[0]: c[1] for c in columns}
            columns_final = []
            for col in df.columns:
                pg_t = source_col_map.get(col)
                if pg_t is not None:
                    columns_final.append((col, type_mapper(pg_t)))
                else:
                    columns_final.append((col, _pg_type_from_pandas(df[col].dtype)))
            cols = [c[0] for c in columns_final]
            pk_list_full = [p for p in source_pk_list if p in cols]
        col_defs = ", ".join(f'"{c[0]}" {c[1]}' for c in columns_final)
        col_types = [t for _, t in columns_final]

        conn_main, main_schema = etl_service.get_target_db_connection(row.get("storage_connection_id"))
        cur_main = conn_main.cursor()
        full_name = f'"{main_schema}"."{target_table}"'

        # DROP 직전 항상 DB에서 sync_mode 재조회. full일 때만 DROP(증분인데 전체 삭제 방지).
        effective_sync = etl_service.get_sync_mode_for_load(etl_table_id)
        if sync_mode == "full" and effective_sync != "full":
            logger.warning("ETL db load etl_table_id=%s: sync_mode re-check is incremental, forcing incremental (no DROP)", etl_table_id)
            sync_mode = "incremental"
        full_fetch_notice = None
        try:
            if effective_sync == "full":
                cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                pk_part = (", PRIMARY KEY (" + ", ".join(f'"{p}"' for p in pk_list_full) + ")") if pk_list_full else ""
                cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{pk_part})")
                conn_main.commit()
                if etl_service.is_job_cancelled(job_id):
                    conn_main.rollback()
                    try:
                        cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                        conn_main.commit()
                    except Exception:
                        conn_main.rollback()
                    etl_service.update_job(job_id, "cancelled", rows_processed=0, error_message="사용자 취소")
                    etl_service.update_etl_table_status(etl_table_id, "error")
                    return {"job_id": job_id, "status": "cancelled", "rows_processed": 0, "error_message": "사용자 취소"}
                rows_tuples = [
                    tuple(r.get(m["source"]) for m in mapping_used) if mapping_used else tuple(r.get(c) for c in cols)
                    for r in rows_data
                ]
                _copy_insert_batch(cur_main, full_name, cols, rows_tuples)
                conn_main.commit()
                if incremental_column and incremental_column in col_names:
                    max_vals = [r.get(incremental_column) for r in rows_data if r.get(incremental_column) is not None]
                    if max_vals:
                        from datetime import datetime as dt
                        latest = max(max_vals) if isinstance(max_vals[0], dt) else max(max_vals)
                        etl_service.update_last_synced_at(etl_table_id, latest)
            else:
                # incremental: Upsert. PK 필요.
                if not pk_columns:
                    etl_service.update_job(job_id, "failed", error_message="incremental 모드는 pk_columns가 필요합니다.")
                    etl_service.update_etl_table_status(etl_table_id, "error")
                    return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "pk_columns 필요"}
                pk_list = [x.strip() for x in pk_columns.split(",") if x.strip()]
                if mapping_used:
                    pk_list = [m["target"] for m in mapping_used if m["source"] in pk_list] or pk_list
                for pk in pk_list:
                    etl_service._validate_identifier(pk, "pk_columns")
                try:
                    cur_main.execute(f"SELECT 1 FROM {full_name} LIMIT 1")
                    cur_main.fetchone()
                except Exception:
                    uniq_part = f", UNIQUE ({', '.join(chr(34) + p + chr(34) for p in pk_list)})" if pk_list else ""
                    cur_main.execute(f"CREATE TABLE {full_name} ({col_defs}{uniq_part})")
                    conn_main.commit()
                else:
                    err_msg = _ensure_unique_constraint(cur_main, conn_main, main_schema, target_table, pk_list)
                    if err_msg:
                        etl_service.update_job(job_id, "failed", error_message=f"타겟 테이블에 UNIQUE 제약을 추가할 수 없습니다. {err_msg}")
                        etl_service.update_etl_table_status(etl_table_id, "error")
                        cur_main.close()
                        conn_main.close()
                        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": err_msg}
                if etl_service.is_job_cancelled(job_id):
                    conn_main.rollback()
                    etl_service.update_job(job_id, "cancelled", rows_processed=0, error_message="사용자 취소")
                    etl_service.update_etl_table_status(etl_table_id, "error")
                    return {"job_id": job_id, "status": "cancelled", "rows_processed": 0, "error_message": "사용자 취소"}
                rows_tuples_inc = [
                    tuple(r.get(m["source"]) for m in mapping_used) if mapping_used else tuple(r.get(c) for c in cols)
                    for r in rows_data
                ]
                if on_row_error == "skip":
                    rows_processed, full_fetch_failed = _copy_upsert_batch_safe(
                        cur_main, conn_main, full_name, cols, col_types, pk_list,
                        rows_tuples_inc, job_id=job_id, batch_offset=0,
                    )
                    conn_main.commit()
                    full_fetch_notice = None
                    if full_fetch_failed:
                        full_fetch_notice = f"적재 실패 {len(full_fetch_failed)}건 (총 {rows_processed + len(full_fetch_failed)}건 중). "
                        full_fetch_notice += "; ".join(f"row#{f['row_index']}: {f['error'][:80]}" for f in full_fetch_failed[:10])
                else:
                    _copy_upsert_batch(cur_main, full_name, cols, col_types, pk_list, rows_tuples_inc)
                    conn_main.commit()
                    full_fetch_notice = None
                # last_synced_at: 이번에 가져온 행들 중 incremental_column 최대값
                if incremental_column and incremental_column in col_names:
                    max_vals = [r.get(incremental_column) for r in rows_data if r.get(incremental_column) is not None]
                    if max_vals:
                        from datetime import datetime as dt
                        if isinstance(max_vals[0], dt):
                            latest = max(max_vals)
                        else:
                            latest = max(max_vals)
                        etl_service.update_last_synced_at(etl_table_id, latest)
        finally:
            cur_main.close()
            conn_main.close()

        if not row.get("storage_connection_id"):
            from Env.config.loader import add_allowed_table
            add_allowed_table(target_table)

        if full_fetch_notice:
            etl_service.update_job(job_id, "completed", rows_processed=rows_processed, notice=full_fetch_notice)
        else:
            etl_service.update_job(job_id, "completed", rows_processed=rows_processed)
        etl_service.update_etl_table_status(etl_table_id, "done")
        logger.info("ETL db load completed job_id=%s rows_processed=%s", job_id, rows_processed)
        return {"job_id": job_id, "status": "completed", "rows_processed": rows_processed}

    except Exception as e:
        logger.exception("ETL db load failed job_id=%s: %s", job_id, e)
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
