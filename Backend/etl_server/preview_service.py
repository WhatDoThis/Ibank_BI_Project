"""
Backend.etl_server.preview_service (ETL 미리보기)
=================================================
파일/DB 소스에 대해 상위 10행·컬럼별 저장 가능 여부 반환. 미리보기 API·모달용.

[Helpers]
===========
33 - _read_file_preview: load_service._read_file 호출, DataFrame만 반환(튜플 언패킹)
39 - _pg_type: inferred_type → PostgreSQL 타입 문자열
52 - _check_column_save: 컬럼명 저장 가능 여부 (can_save, reason)
61 - _serialize_row: 행 값 직렬화(datetime→isoformat 등)
71 - _preview_file: 파일 소스 10행·컬럼 저장 가능 여부·정규화명
119 - _preview_db: DB 소스 10행·컬럼 저장 가능 여부

[Main]
===========
169 - get_preview: etl_table_id로 소스 타입 분기 → columns(저장가능/이유) + preview_rows + preview_columns 반환

[Dependencies]
=========
- Backend.etl_server.service, load_service._read_file, schema_infer
- pandas
"""

import re
from datetime import date, datetime
from typing import Any, List, Optional

from Backend.etl_server import schema_infer
from Backend.etl_server import service as etl_service

# load_service에서 읽기만 사용 (순환 방지). _read_file은 (DataFrame, data_verification_needed) 반환 → DataFrame만 사용
def _read_file_preview(file_path: str, file_type: str, max_rows: int = 10):
    from Backend.etl_server.load_service import _read_file
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


def _preview_file(row: dict) -> dict:
    import pandas as pd
    file_path = row.get("file_path")
    file_type = row.get("file_type")
    if not file_path or not file_type:
        raise ValueError("file_path, file_type이 필요합니다.")
    df = _read_file_preview(file_path, file_type, max_rows=10)
    if df.empty:
        return {"columns": [], "preview_rows": [], "source_type": "file"}

    used = set()
    normalized_names = []
    for col in df.columns:
        base = str(col).strip() or "unnamed"
        base = re.sub(r"[^a-zA-Z0-9_]", "_", base) or "col"
        name = base
        idx = 0
        while name in used:
            idx += 1
            name = f"{base}_{idx}"
        used.add(name)
        normalized_names.append(name)
    df.columns = normalized_names

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
    col_names = list(df.columns)

    return {
        "columns": columns_out,
        "preview_rows": preview_rows,
        "preview_columns": col_names,
        "source_type": "file",
    }


def _preview_db(row: dict) -> dict:
    from Backend.etl_server.db_load_service import (
        _get_source_connection,
        _fetch_source_columns,
        _fetch_source_columns_mysql,
        _pg_type_from_info_schema,
        _pg_type_from_mysql,
    )
    connection_id = row.get("connection_id")
    source_table = (row.get("source_table") or "").strip()
    if not connection_id or not source_table:
        raise ValueError("connection_id, source_table이 필요합니다.")
    etl_service._validate_source_table(source_table)
    c = etl_service.get_connection_for_etl(connection_id)
    stype = (c.get("source_type") or "postgresql").strip().lower()

    src_schema, source_table_name = etl_service.parse_source_table_parts(
        source_table,
        stype,
        conn_schema=(c.get("schema_name") or "public").strip(),
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
        return {"columns": [], "preview_rows": [], "source_type": "db"}

    col_names = [c[0] for c in columns]
    select_list = ", ".join(_quote(c) for c in col_names)
    cur = conn.cursor()
    cur.execute(f"SELECT {select_list} FROM {quoted_src} LIMIT 10")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if stype == "mysql":
        rows = [dict(zip(col_names, r)) for r in rows]

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
        "preview_columns": col_names,
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
    if source_type in ("postgresql", "mysql") or (row.get("connection_id") and row.get("source_table")):
        return _preview_db(row)
    raise ValueError("미리보기 지원 소스가 아닙니다. 파일(path/type) 또는 DB(connection_id/source_table)가 필요합니다.")
