"""
Backend.etl_server.db_load_service (DB 연동 추출·적재)
=======================================================
외부 DB(PostgreSQL·MySQL·Oracle) 추출(E) → 저장 DB 적재(L). Full Load / Incremental Upsert. 소스 PK는 full 모드 시 타겟 CREATE에 반영.

[Main Functions]
===========
1. _get_source_connection: connection_id로 소스 DB 연결(PostgreSQL 전용)
2. _is_date_type, validate_incremental_column: 증분 컬럼 날짜 검증
3. get_source_columns, get_source_indexes: 소스 컬럼·인덱스 조회
4. _fetch_source_columns(_pg|_mysql|_oracle), _fetch_source_pk_columns
5. _create_indexes_on_target, _pg_type_from_*: 타겟 인덱스 생성·타입 변환
6. _serialize_value, _copy_buf, _copy_insert_batch, _copy_upsert_batch, _copy_upsert_batch_safe
7. _ensure_unique_constraint, _get_target_column_list
8. run_db_load: etl_table_id 기준 소스 SELECT → 변환 → 저장 DB CREATE+INSERT 또는 Upsert (full/incremental)

[Dependencies]
=========
- Backend.api_server.db, Backend.etl_server.service, transform_engine, transform_rules_service, etl_limits
- Env.config.loader.add_allowed_table
- psycopg2 (copy_expert), pandas
"""

import hashlib
import io
import logging
import math
import re
import time
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

from Backend.etl_server import service as etl_service
from Backend.etl_server import timezone_utils
from Backend.etl_server import transform_engine
from Backend.etl_server import transform_rules_service as transform_rules_svc
from Backend.etl_server.etl_limits import get_etl_limits


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


def _fetch_source_indexes_pg(conn, schema: str, table: str) -> List[dict]:
    """PostgreSQL pg_catalog에서 인덱스 목록. 반환: [{index_name, columns: [str], is_unique, is_primary}]."""
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT i.relname AS index_name,
                   array_agg(a.attname ORDER BY x.ordinality) AS columns,
                   ix.indisunique AS is_unique,
                   ix.indisprimary AS is_primary
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
                AND a.attnum > 0 AND NOT a.attisdropped
            WHERE n.nspname = %s AND t.relname = %s
            GROUP BY i.relname, ix.indisunique, ix.indisprimary
            ORDER BY i.relname
            """,
            (schema, table),
        )
        rows = cur.fetchall()
        cur.close()
        out = []
        for r in rows:
            cols = r["columns"]
            if isinstance(cols, (list, tuple)):
                col_list = list(cols)
            else:
                col_list = [c.strip() for c in (str(cols).strip("{}") or "").split(",") if c.strip()]
            out.append({
                "index_name": (r["index_name"] or "").strip(),
                "columns": col_list,
                "is_unique": bool(r.get("is_unique")),
                "is_primary": bool(r.get("is_primary")),
            })
        return out
    except Exception as e:
        logger.warning("_fetch_source_indexes_pg %s.%s: %s", schema, table, e)
        return []


def _fetch_source_indexes_mysql(conn, table_schema: str, table_name: str) -> List[dict]:
    """MySQL information_schema.STATISTICS에서 인덱스 목록. 반환: [{index_name, columns, is_unique, is_primary}]."""
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT INDEX_NAME AS index_name,
                   GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns,
                   NOT NON_UNIQUE AS is_unique,
                   (INDEX_NAME = 'PRIMARY') AS is_primary
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            GROUP BY INDEX_NAME, NON_UNIQUE
            ORDER BY INDEX_NAME
            """,
            (table_schema, table_name),
        )
        rows = cur.fetchall()
        cur.close()
        out = []
        for r in rows:
            if isinstance(r, dict):
                idx_name = (r.get("index_name") or r.get("INDEX_NAME") or "").strip()
                cols_str = r.get("columns") or r.get("COLUMN_NAME") or ""
                is_unique = r.get("is_unique", False)
                is_primary = r.get("is_primary", False) or (idx_name == "PRIMARY")
            else:
                idx_name = (r[0] or "").strip() if len(r) > 0 else ""
                cols_str = (r[1] or "") if len(r) > 1 else ""
                is_unique = bool(r[2]) if len(r) > 2 else False
                is_primary = bool(r[3]) if len(r) > 3 else (idx_name == "PRIMARY")
            col_list = [c.strip() for c in (cols_str or "").split(",") if c.strip()]
            out.append({
                "index_name": idx_name,
                "columns": col_list,
                "is_unique": bool(is_unique),
                "is_primary": bool(is_primary),
            })
        return out
    except Exception as e:
        logger.warning("_fetch_source_indexes_mysql %s.%s: %s", table_schema, table_name, e)
        return []


def _fetch_source_indexes_oracle(conn, owner: str, table_name: str) -> List[dict]:
    """Oracle ALL_INDEXES + ALL_IND_COLUMNS에서 인덱스 목록. is_primary는 ALL_CONSTRAINTS로 판별."""
    try:
        cur = conn.cursor()
        o = (owner or "").strip().upper()
        t = (table_name or "").strip().upper()
        if not t:
            return []
        cur.execute(
            """
            SELECT i.INDEX_NAME,
                   LISTAGG(c.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY c.COLUMN_POSITION) AS columns,
                   CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END AS is_unique
            FROM ALL_INDEXES i
            JOIN ALL_IND_COLUMNS c ON i.INDEX_NAME = c.INDEX_NAME AND i.TABLE_OWNER = c.INDEX_OWNER
            WHERE i.TABLE_OWNER = :1 AND i.TABLE_NAME = :2
            GROUP BY i.INDEX_NAME, i.UNIQUENESS
            ORDER BY i.INDEX_NAME
            """,
            (o, t),
        )
        rows = cur.fetchall()
        pk_index_names = set()
        try:
            cur.execute(
                """
                SELECT CONSTRAINT_NAME FROM ALL_CONSTRAINTS
                WHERE TABLE_OWNER = :1 AND TABLE_NAME = :2 AND CONSTRAINT_TYPE = 'P'
                """,
                (o, t),
            )
            for pk_row in cur.fetchall():
                name = pk_row[0] if isinstance(pk_row, (tuple, list)) else pk_row.get("CONSTRAINT_NAME")
                if name:
                    pk_index_names.add((name or "").strip().upper())
        except Exception:
            pass
        cur.close()
        out = []
        for r in rows:
            idx_name = (r[0] if isinstance(r, (tuple, list)) else r.get("INDEX_NAME") or "").strip()
            cols_str = r[1] if isinstance(r, (tuple, list)) and len(r) > 1 else (r.get("columns") or r.get("COLUMN_NAME") or "")
            is_unique = bool(r[2] if isinstance(r, (tuple, list)) and len(r) > 2 else r.get("is_unique"))
            is_primary = (idx_name or "").upper() in pk_index_names
            col_list = [c.strip() for c in (cols_str or "").split(",") if c.strip()]
            out.append({
                "index_name": idx_name,
                "columns": col_list,
                "is_unique": bool(is_unique),
                "is_primary": bool(is_primary),
            })
        return out
    except Exception as e:
        logger.warning("_fetch_source_indexes_oracle %s.%s: %s", owner, table_name, e)
        return []


def get_source_indexes(connection_id: int, source_table: str) -> List[dict]:
    """
    소스 DB의 지정 테이블 인덱스 목록 반환. PK 포함(is_primary로 구분).
    반환: [{"index_name", "columns": [str], "is_unique": bool, "is_primary": bool}]
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
            return _fetch_source_indexes_mysql(src_conn, src_schema, source_table_name)
        if stype == "oracle":
            src_conn = etl_service._connect_oracle(
                c["host"], c.get("port") or 1521, c["database_name"],
                c["username"], c.get("encrypted_password") or "",
            )
            owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
            tbl = source_table_name.strip().upper()
            return _fetch_source_indexes_oracle(src_conn, owner, tbl)
        src_conn = _get_source_connection(connection_id)
        return _fetch_source_indexes_pg(src_conn, src_schema, source_table_name)
    except Exception as e:
        logger.warning("get_source_indexes connection_id=%s source_table=%s: %s", connection_id, source_table, e)
        return []
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
        pk_hash = hashlib.md5("_".join(pk_list).encode()).hexdigest()[:8]
        constraint_name = f"{safe_name}_etl_uq_{pk_hash}"
        pk_cols = ", ".join(f'"{p}"' for p in pk_list)
        full_name = f'"{main_schema}"."{target_table}"'
        cur.execute(f'ALTER TABLE {full_name} ADD CONSTRAINT "{constraint_name}" UNIQUE ({pk_cols})')
        conn.commit()
        return None
    except Exception as e:
        conn.rollback()
        return str(e)[:500]


def _get_target_column_list(cur, schema: str, table_name: str) -> List[str]:
    """
    타겟(PostgreSQL) 테이블의 컬럼명 목록(ordinal_position 순).
    테이블이 없거나 조회 실패 시 [] 반환. 증분 적재 시 INSERT 컬럼을 타겟에 맞추기 위해 사용.
    """
    try:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name),
        )
        return [r["column_name"] for r in cur.fetchall()]
    except Exception:
        return []


def _create_indexes_on_target(cur, conn, main_schema: str, target_table: str, index_definitions: Optional[List[dict]]) -> None:
    """타겟 테이블에 인덱스 생성. 이미 존재하면 건너뜀. PK 인덱스는 제외(테이블 생성 시 반영)."""
    if not index_definitions:
        return
    full_table = f'"{main_schema}"."{target_table}"'
    for idx_def in index_definitions:
        if not isinstance(idx_def, dict):
            continue
        idx_name = (idx_def.get("index_name") or "").strip()
        columns = idx_def.get("columns") or []
        is_unique = idx_def.get("is_unique", False)
        if idx_def.get("is_primary"):
            continue
        if not columns:
            continue
        # 인덱스명 미입력 시 컬럼명 기반 자동 생성 (예: idx_col1_col2)
        if not idx_name:
            safe_cols = [re.sub(r"[^a-zA-Z0-9_]", "", str(c).strip().replace(" ", "_")) for c in columns if isinstance(c, str) and c.strip()]
            idx_name = "idx_" + "_".join(safe_cols) if safe_cols else ""
        if not idx_name:
            continue
        idx_name = re.sub(r"[^a-zA-Z0-9_]", "_", idx_name)[:63]
        if not idx_name:
            continue
        # 컬럼명은 CSV/테이블 실제 컬럼명(공백·한글 등 가능)이므로 _validate_identifier 사용하지 않음.
        # PostgreSQL 식별자로 사용할 때 큰따옴표만 이스케이프(" → "")하여 SQL 삽입 방지.
        def _quote_ident(s: str) -> str:
            s = (s or "").strip()
            if not s:
                return ""
            return f'"{s.replace(chr(34), chr(34) + chr(34))}"'
        col_quoted = [_quote_ident(str(c)) for c in columns if isinstance(c, str) and str(c).strip()]
        cols_str = ", ".join(c for c in col_quoted if c)
        if not cols_str:
            continue
        unique_str = "UNIQUE " if is_unique else ""
        try:
            cur.execute(f'CREATE {unique_str}INDEX IF NOT EXISTS "{idx_name}" ON {full_table} ({cols_str})')
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.warning("인덱스 생성 실패 %s: %s", idx_name, e)


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
    """COPY TEXT 포맷용 값 직렬화. None/nan/inf/NaT → \\N, bool은 true/false, 그 외는 str 후 \\ \\t \\n \\r 이스케이프."""
    if v is None:
        return "\\N"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, Decimal):
        if v.is_nan() or v.is_infinite():
            return "\\N"
        return str(v)
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
    stg = f"_etl_stg_{uuid.uuid4().hex[:12]}"
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
    - src_conn/conn_main/cur_src/cur_main 상단 None 초기화, 예외 시(첫 try except) src_conn 반드시 close.
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

    src_conn = None
    conn_main = None
    cur_src = None
    cur_main = None

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
        source_tz = (c.get("server_timezone") or "Asia/Seoul").strip()
        stype = (c.get("source_type") or "postgresql").strip().lower()
        if stype not in ("postgresql", "mysql", "oracle"):
            raise ValueError(f"DB 적재는 postgresql, mysql, oracle만 지원합니다. source_type={stype}")
        _storage_conn_id = row.get("storage_connection_id")
        if _storage_conn_id:
            _sc = etl_service.get_storage_connection(_storage_conn_id)
            target_tz = (_sc.get("server_timezone") or "Asia/Seoul").strip() if _sc else "Asia/Seoul"
        else:
            target_tz = "Asia/Seoul"
        _tz_convert_needed = timezone_utils.needs_conversion(source_tz, target_tz)

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
                _synced_val = last_synced
                if _tz_convert_needed and isinstance(last_synced, datetime):
                    try:
                        _synced_val = timezone_utils.convert_single_datetime(
                            last_synced, from_tz=target_tz, to_tz=source_tz,
                        )
                    except Exception:
                        _synced_val = last_synced
                # Oracle DATE는 초 단위만 저장·비교. 바인드 시 마이크로초가 잘려 WHERE > 08:17:11 이 되어
                # 같은 초(08:17:11.xxx)인 176건이 매번 다시 조회됨. last_synced+1초 기준으로 >= 사용해
                # 해당 초 전체를 제외하고 다음 초(08:17:12)부터 포함.
                if stype == "oracle":
                    if isinstance(_synced_val, datetime):
                        bound_val = _synced_val + timedelta(seconds=1)
                    elif hasattr(_synced_val, "to_pydatetime"):
                        bound_val = _synced_val.to_pydatetime() + timedelta(seconds=1)
                    else:
                        bound_val = _synced_val
                    where_clause = f" WHERE {_quote(incremental_column)} >= {bind_placeholder}"
                    params.append(bound_val)
                else:
                    params.append(_synced_val)
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
        if src_conn is not None:
            try:
                src_conn.close()
            except Exception:
                pass
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
                    if row_type == "dict":
                        batch = [dict(r) for r in batch]
                    elif row_type == "tuple":
                        batch = [dict(zip(col_names, r)) for r in batch]
                    if max_rows_per_load > 0 and total_processed + len(batch) > max_rows_per_load:
                        batch = batch[: max_rows_per_load - total_processed]
                    df_batch = pd.DataFrame(batch, columns=col_names)
                    if _tz_convert_needed:
                        try:
                            _col_meta = [{"column_name": cn, "data_type": dt} for cn, dt in columns]
                            df_batch = timezone_utils.convert_timezone_columns(
                                df_batch, _col_meta, source_tz, target_tz,
                            )
                        except Exception as tz_err:
                            logger.warning("run_db_load tz convert failed (skip): %s", tz_err)
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
                        # 증분이고 타겟 테이블이 이미 있을 때: INSERT 컬럼을 타겟에 실제 존재하는 컬럼만으로 제한
                        if not run_is_full and cols:
                            target_columns = _get_target_column_list(cur_main, main_schema, target_table)
                            if target_columns:
                                target_set = set(target_columns)
                                missing_pk = [p for p in pk_list_inc if p not in target_set]
                                if missing_pk:
                                    etl_service.update_job(
                                        job_id, "failed",
                                        error_message=f"타겟 테이블에 PK 컬럼({', '.join(missing_pk)})이 없습니다. 증분 적재를 위해 타겟 테이블에 PK를 추가하거나 동기화 모드를 전체로 변경하세요.",
                                    )
                                    etl_service.update_etl_table_status(etl_table_id, "error")
                                    cur_main.close()
                                    conn_main.close()
                                    cur_src.close()
                                    src_conn.close()
                                    return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "PK 컬럼 없음"}
                                _cols_before = list(cols)
                                cols_filtered = [c for c in cols if c in target_set]
                                if len(cols_filtered) < len(cols):
                                    logger.info(
                                        "ETL db load etl_table_id=%s: 타겟 테이블에 없는 컬럼 %s 건 제외 후 증분 적재",
                                        etl_table_id, len(cols) - len(cols_filtered),
                                    )
                                col_types = [col_types[_cols_before.index(c)] for c in cols_filtered]
                                cols = cols_filtered
                                pk_list_inc = [p for p in pk_list_inc if p in cols]
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
                        tuple(r.get(c) for c in cols)
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
                        # column_mapping 사용 시 rows_batch는 타겟 컬럼명 키 → 증분 컬럼(소스명)에 대응하는 타겟 키로 조회
                        inc_key = next((m["target"] for m in mapping_used if m["source"] == incremental_column), incremental_column) if mapping_used else incremental_column
                        max_vals = [r.get(inc_key) for r in rows_batch if r.get(inc_key) is not None]
                        if max_vals:
                            latest = max(max_vals) if isinstance(max_vals[0], datetime) else max(max_vals)
                            # 전역 최대값 유지(full/증분 공통). 루프 끝에서 한 번만 update_last_synced_at 호출.
                            last_synced_candidate = latest if last_synced_candidate is None else max(last_synced_candidate, latest)
                    etl_service.update_job_progress(job_id, total_processed)
                    if max_rows_per_load > 0 and total_processed >= max_rows_per_load:
                        break
                    if batch_interval_seconds > 0:
                        time.sleep(batch_interval_seconds)
            finally:
                cur_main.close()
                conn_main.close()
                if stype == "mysql" and cur_src is not None:
                    try:
                        while cur_src.fetchmany(1000):
                            pass
                    except Exception:
                        pass
                try:
                    if cur_src is not None:
                        cur_src.close()
                except Exception:
                    pass
                try:
                    if src_conn is not None:
                        src_conn.close()
                except Exception:
                    pass
            idx_def = row.get("index_definitions")
            if idx_def:
                _conn_idx, _schema_idx = etl_service.get_target_db_connection(row.get("storage_connection_id"))
                _cur_idx = _conn_idx.cursor()
                try:
                    _create_indexes_on_target(_cur_idx, _conn_idx, _schema_idx, target_table, idx_def)
                finally:
                    _cur_idx.close()
                    _conn_idx.close()
            if last_synced_candidate is not None:
                # convert_timezone_columns가 이미 df를 타겟 TZ로 변환했으므로 추가 변환 불필요
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
            cur_src = None
            src_conn.close()
            src_conn = None
            if row_type == "dict":
                rows_data = [dict(r) for r in rows_data]
            elif row_type == "tuple":
                rows_data = [dict(zip(col_names, r)) for r in rows_data]
            etl_service.set_job_total_rows(job_id, len(rows_data))
            rows_processed = len(rows_data)

        if len(rows_data) == 0:
            etl_service.update_job(job_id, "completed", rows_processed=0)
            etl_service.update_etl_table_status(etl_table_id, "done")
            logger.info("ETL db load completed job_id=%s rows_processed=0 (no rows)", job_id)
            return {"job_id": job_id, "status": "completed", "rows_processed": 0}

        # Phase 4: 변환 룰 적용 + 매핑 기반 형변환
        df = pd.DataFrame(rows_data, columns=col_names)
        if _tz_convert_needed:
            try:
                _col_meta = [{"column_name": cn, "data_type": dt} for cn, dt in columns]
                df = timezone_utils.convert_timezone_columns(
                    df, _col_meta, source_tz, target_tz,
                )
            except Exception as tz_err:
                logger.warning("run_db_load tz convert failed (skip): %s", tz_err)
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

        conn_main = None
        try:
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
                        inc_key = next((m["target"] for m in mapping_used if m["source"] == incremental_column), incremental_column) if mapping_used else incremental_column
                        max_vals = [r.get(inc_key) for r in rows_data if r.get(inc_key) is not None]
                        if max_vals:
                            latest = max(max_vals) if isinstance(max_vals[0], datetime) else max(max_vals)
                            # convert_timezone_columns가 이미 타겟 TZ로 변환했으므로 추가 변환 불필요
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
                        # 타겟 테이블에 실제 존재하는 컬럼만으로 INSERT 제한
                        target_columns = _get_target_column_list(cur_main, main_schema, target_table)
                        if target_columns:
                            target_set = set(target_columns)
                            missing_pk = [p for p in pk_list if p not in target_set]
                            if missing_pk:
                                etl_service.update_job(
                                    job_id, "failed",
                                    error_message=f"타겟 테이블에 PK 컬럼({', '.join(missing_pk)})이 없습니다. 증분 적재를 위해 타겟 테이블에 PK를 추가하거나 동기화 모드를 전체로 변경하세요.",
                                )
                                etl_service.update_etl_table_status(etl_table_id, "error")
                                cur_main.close()
                                conn_main.close()
                                return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": "PK 컬럼 없음"}
                            _cols_before = list(cols)
                            cols_filtered = [c for c in cols if c in target_set]
                            if len(cols_filtered) < len(cols):
                                logger.info(
                                    "ETL db load etl_table_id=%s: 타겟 테이블에 없는 컬럼 %s 건 제외 후 증분 적재",
                                    etl_table_id, len(cols) - len(cols_filtered),
                                )
                            col_types = [col_types[_cols_before.index(c)] for c in cols_filtered]
                            cols = cols_filtered
                            pk_list = [p for p in pk_list if p in cols]
                    if etl_service.is_job_cancelled(job_id):
                        conn_main.rollback()
                        etl_service.update_job(job_id, "cancelled", rows_processed=0, error_message="사용자 취소")
                        etl_service.update_etl_table_status(etl_table_id, "error")
                        return {"job_id": job_id, "status": "cancelled", "rows_processed": 0, "error_message": "사용자 취소"}
                    rows_tuples_inc = [
                        tuple(r.get(c) for c in cols)
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
                        inc_key = next((m["target"] for m in mapping_used if m["source"] == incremental_column), incremental_column) if mapping_used else incremental_column
                        max_vals = [r.get(inc_key) for r in rows_data if r.get(inc_key) is not None]
                        if max_vals:
                            if isinstance(max_vals[0], datetime):
                                latest = max(max_vals)
                            else:
                                latest = max(max_vals)
                            # convert_timezone_columns가 이미 타겟 TZ로 변환했으므로 추가 변환 불필요
                            etl_service.update_last_synced_at(etl_table_id, latest)
                idx_def = row.get("index_definitions")
                if idx_def:
                    _create_indexes_on_target(cur_main, conn_main, main_schema, target_table, idx_def)
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
        finally:
            if conn_main:
                try:
                    conn_main.close()
                except Exception:
                    pass

    except Exception as e:
        logger.exception("ETL db load failed job_id=%s: %s", job_id, e)
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        return {"job_id": job_id, "status": "failed", "rows_processed": 0, "error_message": str(e)}
