"""
Backend.etl_server2.preview_service (ETL 미리보기)
==================================================
파일/DB 소스에 대해 상위 10행·컬럼별 저장 가능 여부 반환. 미리보기 API·모달용.

[Helpers]
===========
- _read_file_preview: load_service._read_file 호출, DataFrame만 반환(튜플 언패킹)
- _pg_type: inferred_type → PostgreSQL 타입 문자열
- _check_column_save: 컬럼명 저장 가능 여부 (can_save, reason)
- _serialize_row: 행 값 직렬화(datetime→isoformat 등)
- _preview_file: 파일 소스 10행·컬럼 저장 가능 여부·정규화명
- _preview_db: DB 소스 10행·컬럼 저장 가능 여부

[Main Functions]
===========
- get_preview: etl_table_id로 소스 타입 분기 → columns(저장가능/이유) + preview_rows + preview_columns 반환. column_mapping 있으면 해당 매핑만 반영(제외 컬럼 미표시, 타겟명·순서로 표시).

[Dependencies]
=========
- Backend.etl_server2.service, load_service._read_file, schema_infer
- pandas
"""

import json
import re
from datetime import date, datetime
from typing import Any, List, Optional

from Backend.etl_server2 import schema_infer
from Backend.etl_server2 import service as etl_service

# load_service에서 읽기만 사용 (순환 방지). _read_file은 (DataFrame, data_verification_needed) 반환 → DataFrame만 사용
def _read_file_preview(file_path: str, file_type: str, max_rows: int = 10):
    from Backend.etl_server2.load_service import _read_file
    df, _ = _read_file(file_path, file_type, max_rows=max_rows)
    return df


def _pg_type(inferred_type: str) -> str:
    t = (inferred_type or "text").strip().lower()
    if t in ("integer", "int"):
        return "BIGINT"
    if t == "float":
        return "DOUBLE PRECISION"
    if t == "boolean":
        return "BOOLEAN"
    if t in ("datetime", "date"):
        return "TIMESTAMP"
    return "TEXT"


def _check_column_save(name: str) -> tuple:
    """컬럼명 저장 가능 여부. (can_save: bool, reason: str|None)"""
    if not name or len(name) > 63:
        return (False, "컬럼명 63자 초과" if name else "컬럼명 없음")
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        return (False, "허용되지 않은 문자(영문, 숫자, _ 만 가능)")
    return (True, None)


def _serialize_row(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


def _normalize_mapping(column_mapping: Any) -> List[tuple]:
    """column_mapping을 [(source, target, type), ...] 리스트로 정규화. 유효한 항목만."""
    if column_mapping is None:
        return []
    if isinstance(column_mapping, str):
        try:
            column_mapping = json.loads(column_mapping)
        except Exception:
            return []
    if not isinstance(column_mapping, list):
        return []
    out = []
    for m in column_mapping:
        if not isinstance(m, dict):
            continue
        s = (m.get("source") or "").strip()
        t = (m.get("target") or "").strip()
        if not s or not t:
            continue
        ty = (m.get("type") or "TEXT").strip().upper() or "TEXT"
        out.append((s, t, ty))
    return out


def _preview_file(row: dict) -> dict:
    import pandas as pd
    file_path = row.get("file_path")
    file_type = row.get("file_type")
    if not file_path or not file_type:
        raise ValueError("file_path, file_type이 필요합니다.")
    df = _read_file_preview(file_path, file_type, max_rows=10)
    if df.empty:
        return {"columns": [], "preview_rows": [], "preview_columns": [], "source_type": "file"}

    # 컬럼명 정규화하지 않음: column_mapping의 source는 추론 스키마(파일 원본 컬럼명)와 동일해야 하므로, df.columns를 바꾸면 매칭이 깨져 미리보기가 비어 버림.
    column_mapping = _normalize_mapping(row.get("column_mapping"))
    if column_mapping:
        # ETL에 설정된 컬럼 매핑만 사용: 소스명이 df에 있는 것만, 매핑 순서 유지
        mapping_filtered = [(s, t, ty) for s, t, ty in column_mapping if s in df.columns]
        preview_columns = [t for s, t, ty in mapping_filtered]
        columns_out = []
        for s, t, ty in mapping_filtered:
            can_save, reason = _check_column_save(t)
            columns_out.append({"name": t, "inferred_type": ty, "can_save": can_save, "reason": reason})
        rows = df.replace({pd.NA: None}).to_dict("records")
        preview_rows = [[_serialize_row(r.get(s)) for s, t, ty in mapping_filtered] for r in rows]
    else:
        columns_out = []
        for col in df.columns:
            dtype = schema_infer._dtype_to_inferred(df[col].dtype)
            pg_t = _pg_type(dtype)
            can_save, reason = _check_column_save(str(col))
            columns_out.append({
                "name": str(col),
                "inferred_type": pg_t,
                "can_save": can_save,
                "reason": reason,
            })
        rows = df.replace({pd.NA: None}).to_dict("records")
        preview_rows = [[_serialize_row(r.get(c)) for c in df.columns] for r in rows]
        preview_columns = list(df.columns)

    return {
        "columns": columns_out,
        "preview_rows": preview_rows,
        "preview_columns": preview_columns,
        "source_type": "file",
    }


def _preview_db(row: dict) -> dict:
    from Backend.etl_server2.db_load_service import (
        _get_source_connection,
        _fetch_source_columns,
        _fetch_source_columns_mysql,
        _fetch_source_columns_oracle,
        _pg_type_from_info_schema,
        _pg_type_from_mysql,
        _pg_type_from_oracle,
    )
    connection_id = row.get("connection_id")
    source_table = (row.get("source_table") or "").strip()
    if not connection_id or not source_table:
        raise ValueError("connection_id, source_table이 필요합니다.")
    etl_service._validate_source_table(source_table)
    c = etl_service.get_connection_for_etl(connection_id)
    stype = (c.get("source_type") or "postgresql").strip().lower()

    conn_schema_pg = (c.get("schema_name") or "public").strip()
    conn_schema_oracle = (c.get("schema_name") or c.get("username") or "").strip()
    src_schema, source_table_name = etl_service.parse_source_table_parts(
        source_table,
        stype,
        conn_schema=conn_schema_oracle if stype == "oracle" else conn_schema_pg,
        conn_db=(c.get("database_name") or "").strip(),
    )
    if not source_table_name:
        raise ValueError("source_table이 비어 있습니다.")

    if stype == "mysql":
        conn = etl_service._connect_mysql(
            c["host"],
            c.get("port") or 3306,
            c["database_name"],
            c["username"],
            c.get("encrypted_password") or "",
        )
        columns = _fetch_source_columns_mysql(conn, src_schema, source_table_name)
        type_mapper = _pg_type_from_mysql
        quoted_src = f"`{src_schema}`.`{source_table_name}`"
        _quote = lambda x: f"`{x}`"
    elif stype == "oracle":
        conn = etl_service._connect_oracle(
            c["host"],
            c.get("port") or 1521,
            c["database_name"],
            c["username"],
            c.get("encrypted_password") or "",
        )
        owner = (src_schema or "").strip().upper() or (c.get("username") or "").strip().upper()
        tbl = source_table_name.strip().upper()
        columns = _fetch_source_columns_oracle(conn, owner, tbl)
        type_mapper = _pg_type_from_oracle
        quoted_src = f'"{owner}"."{tbl}"'
        _quote = lambda x: f'"{x}"'
    else:
        conn = _get_source_connection(connection_id)
        columns = _fetch_source_columns(conn, src_schema, source_table_name)
        type_mapper = _pg_type_from_info_schema
        quoted_src = f'"{src_schema}"."{source_table_name}"'
        _quote = lambda x: f'"{x}"'

    if not columns:
        try:
            conn.close()
        except Exception:
            pass
        return {"columns": [], "preview_rows": [], "preview_columns": [], "source_type": "db"}

    col_names = [c[0] for c in columns]
    column_mapping = _normalize_mapping(row.get("column_mapping"))
    if column_mapping:
        mapping_filtered = [(s, t, ty) for s, t, ty in column_mapping if s in col_names]
        select_cols = [s for s, t, ty in mapping_filtered]
    else:
        mapping_filtered = []
        select_cols = col_names

    if not select_cols:
        try:
            conn.close()
        except Exception:
            pass
        return {"columns": [], "preview_rows": [], "preview_columns": [], "source_type": "db"}

    select_list = ", ".join(_quote(c) for c in select_cols)
    cur = conn.cursor()
    # 헤더 유사 행이 앞에 많을 수 있으므로 여유 있게 조회 후 필터·상위 10건만 사용
    fetch_limit = 50
    if stype == "oracle":
        cur.execute(f"SELECT {select_list} FROM {quoted_src} FETCH FIRST {fetch_limit} ROWS ONLY")
    else:
        cur.execute(f"SELECT {select_list} FROM {quoted_src} LIMIT {fetch_limit}")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # row가 이미 dict-like(RealDictRow 등)면 zip 시 key만 나와 값이 컬럼명으로 채워지는 버그 방지
    if rows and hasattr(rows[0], "keys"):
        rows = [dict(r) for r in rows]
    else:
        rows = [dict(zip(select_cols, r)) for r in rows]

    # 첫 번째 컬럼 값이 컬럼명과 동일한 행(헤더가 데이터로 들어간 행) 제외
    if select_cols and rows:
        first_col = select_cols[0]
        def _is_header_like(r):
            val = r.get(first_col)
            if val is None:
                return False
            return str(val).strip().lower() == first_col.strip().lower()
        rows = [r for r in rows if not _is_header_like(r)]
    rows = rows[:10]

    if column_mapping and mapping_filtered:
        preview_columns = [t for s, t, ty in mapping_filtered]
        columns_out = []
        for s, t, ty in mapping_filtered:
            can_save, reason = _check_column_save(t)
            columns_out.append({"name": t, "inferred_type": ty, "can_save": can_save, "reason": reason})
        preview_rows = [[_serialize_row(r.get(s)) for s, t, ty in mapping_filtered] for r in rows]
    else:
        preview_columns = col_names
        columns_out = []
        for col_name, data_type in columns:
            pg_t = type_mapper(data_type)
            can_save, reason = _check_column_save(col_name)
            columns_out.append({
                "name": col_name,
                "inferred_type": pg_t,
                "can_save": can_save,
                "reason": reason,
            })
        preview_rows = [[_serialize_row(r.get(c)) for c in col_names] for r in rows]

    return {
        "columns": columns_out,
        "preview_rows": preview_rows,
        "preview_columns": preview_columns,
        "source_type": "db",
    }


def get_preview(etl_table_id: int) -> dict:
    """ETL 테이블 1건에 대한 미리보기. columns(저장가능/이유) + preview_rows(최대 10행)."""
    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    source_type = (row.get("source_type") or "").strip().lower()
    if source_type == "file" or (row.get("file_path") and row.get("file_type")):
        return _preview_file(row)
    if source_type in ("postgresql", "mysql", "oracle") or (row.get("connection_id") and row.get("source_table")):
        return _preview_db(row)
    raise ValueError("미리보기 지원 소스가 아닙니다. 파일(path/type) 또는 DB(connection_id/source_table)가 필요합니다.")
