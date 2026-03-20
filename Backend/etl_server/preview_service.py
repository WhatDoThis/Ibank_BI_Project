"""
Backend.etl_server.preview_service (ETL 미리보기)
==================================================
파일/DB 소스에 대해 상위 10행·컬럼별 저장 가능 여부 반환. 미리보기 API·모달용.

[Main Functions]
===========
1. _quote_ident_pg, _quote_ident_mysql: SQL 식별자 이스케이프
2. _read_file_preview, _pg_type, _check_column_save, _serialize_row
3. _format_single_rule_summary, _build_transform_remarks_by_column, _normalize_mapping
4. _preview_file, _preview_db: 파일/DB 소스 10행·컬럼 저장 가능 여부
5. get_source_dataframe, _get_source_df_db: 변환 미리보기용 소스 DataFrame
6. get_transform_preview, _get_preview_with_transform: 변환 룰 적용 미리보기
7. get_preview: 변환 룰·타입 캐스트 적용 후 columns + preview_rows + preview_columns 반환

[Dependencies]
=========
- Backend.etl_server.service, load_service._read_file, schema_infer, transform_engine, transform_rules_service
- pandas
"""

import json
import logging
import re
from datetime import date, datetime
from typing import Any, List, Optional

import pandas as pd

from Backend.etl_server import schema_infer
from Backend.etl_server import service as etl_service

# 첫 번째 컬럼 값=컬럼명인 행(헤더 유사) 제외 여부. False 시 실제 데이터가 컬럼명과 같을 때 제거될 위험 감소
SKIP_HEADER_LIKE_ROWS = True
from Backend.etl_server.transform_engine import _parse_config as _parse_rule_config

logger = logging.getLogger(__name__)


# 1.
def _quote_ident_pg(ident: str) -> str:
    """PostgreSQL/Oracle 식별자: 큰따옴표 감싸기, 내부 " → "" 이스케이프."""
    s = (ident or "").strip()
    if not s:
        return ""
    return f'"{s.replace(chr(34), chr(34) + chr(34))}"'


# 2.
def _quote_ident_mysql(ident: str) -> str:
    """MySQL 식별자: 백틱 감싸기, 내부 ` → `` 이스케이프."""
    s = (ident or "").strip()
    if not s:
        return ""
    return "`" + s.replace("`", "``") + "`"

# load_service에서 읽기만 사용 (순환 방지). _read_file은 (DataFrame, data_verification_needed) 반환 → DataFrame만 사용
# 3.
def _read_file_preview(file_path: str, file_type: str, max_rows: int = 10):
    from Backend.etl_server.load_service import _read_file
    df, _ = _read_file(file_path, file_type, max_rows=max_rows)
    return df


# 4.
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


# 5.
def _check_column_save(name: str) -> tuple:
    """컬럼명 저장 가능 여부. (can_save: bool, reason: str|None)"""
    if not name or len(name) > 63:
        return (False, "컬럼명 63자 초과" if name else "컬럼명 없음")
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        return (False, "허용되지 않은 문자(영문, 숫자, _ 만 가능)")
    return (True, None)


# 6.
def _serialize_row(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


# DB 미리보기 비고용: rule_category/rule_type → 한글 라벨
_RULE_CATEGORY_LABEL = {
    "type_cast": "타입변환",
    "string": "문자열",
    "cleansing": "정제",
    "mapping": "매핑",
    "code_map": "매핑",
    "masking": "마스킹",
    "datetime": "날짜/시간",
    "numeric": "숫자",
    "row": "행",
}

# operation/옵션 → 비고용 짧은 한글
_OPERATION_LABEL = {
    "uppercase": "대문자",
    "lowercase": "소문자",
    "trim": "trim",
    "replace": "치환",
    "regex_replace": "정규치환",
    "mask_phone": "휴대폰",
    "mask_email": "이메일",
    "mask_name": "이름",
    "hash": "해시",
    "redact": "가리기",
    "value_map": "값매핑",
    "range_map": "구간매핑",
    "conditional": "조건매핑",
    "date_format": "형식변환",
    "extract": "부분추출",
    "date_add": "날짜가감",
    "date_subtract": "날짜빼기",
    "round": "반올림",
    "arithmetic": "연산",
    "bucket": "구간",
    "clamp": "범위제한",
    "filter": "필터",
    "deduplicate": "중복제거",
}


# 7.
def _format_single_rule_summary(rule: dict) -> str:
    """룰 1건을 비고용 한 줄 요약으로. 예: 타입변환(bigint), 문자열(대문자)."""
    cat = (rule.get("rule_category") or rule.get("rule_type") or "").strip().lower()
    if cat == "code_map":
        cat = "mapping"
    label = _RULE_CATEGORY_LABEL.get(cat, cat or "변환")
    config = _parse_rule_config(rule.get("rule_config"))
    op = (config.get("operation") or "").strip().lower() or (rule.get("operation") or "").strip().lower()
    opt_text = ""
    if cat == "type_cast":
        opt_text = (config.get("target_type") or "text").strip().lower()
    elif op:
        opt_text = _OPERATION_LABEL.get(op, op)
    if opt_text:
        return f"{label}({opt_text})"
    return label


# 8.
def _build_transform_remarks_by_column(etl_table_id: int) -> dict:
    """etl_table_id에 대한 변환 룰을 컬럼( target_column )별로 요약. 반환: { target_column: '타입변환(bigint), 문자열(대문자)' }."""
    try:
        from Backend.etl_server import transform_rules_service as transform_rules_svc
        rules = transform_rules_svc.list_transform_rules(etl_table_id)
    except Exception:
        return {}
    if not rules:
        return {}
    by_col: dict = {}
    for r in rules:
        if not r.get("is_active", True):
            continue
        tgt = (r.get("target_column") or r.get("source_column") or "").strip()
        if not tgt:
            continue
        part = _format_single_rule_summary(r)
        if tgt not in by_col:
            by_col[tgt] = []
        by_col[tgt].append(part)
    return {k: ", ".join(v) for k, v in by_col.items()}


# 9.
def _normalize_mapping(column_mapping: Any) -> List[tuple]:
    """column_mapping을 [(source, target, type), ...] 리스트로 정규화. 유효한 항목만."""
    if column_mapping is None:
        return []
    if isinstance(column_mapping, str):
        try:
            column_mapping = json.loads(column_mapping)
        except Exception as e:
            logger.warning("_normalize_mapping: column_mapping JSON 파싱 실패, 빈 매핑 반환: %s", e)
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


# 11.
# 11.
def _preview_db(row: dict) -> dict:
    from Backend.etl_server.db_load_service import (
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

    conn = None
    try:
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
            quoted_src = f"{_quote_ident_mysql(src_schema)}.{_quote_ident_mysql(source_table_name)}"
            _quote = _quote_ident_mysql
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
            quoted_src = f"{_quote_ident_pg(owner)}.{_quote_ident_pg(tbl)}"
            _quote = _quote_ident_pg
        else:
            conn = _get_source_connection(connection_id)
            columns = _fetch_source_columns(conn, src_schema, source_table_name)
            type_mapper = _pg_type_from_info_schema
            quoted_src = f"{_quote_ident_pg(src_schema)}.{_quote_ident_pg(source_table_name)}"
            _quote = _quote_ident_pg

        if not columns:
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

        # row가 이미 dict-like(RealDictRow 등)면 zip 시 key만 나와 값이 컬럼명으로 채워지는 버그 방지
        if rows and hasattr(rows[0], "keys"):
            rows = [dict(r) for r in rows]
        else:
            rows = [dict(zip(select_cols, r)) for r in rows]

        # DB 소스에는 헤더 행이 없으므로 SKIP_HEADER_LIKE_ROWS 적용하지 않음(정상 데이터 삭제 방지)
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
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


# 12.
def get_source_dataframe(
    etl_table_id: int, column_mapping_override: Any = None
) -> tuple:
    """변환 미리보기용: 소스 컬럼명 기준 DataFrame과 column_mapping 반환. (df, mapping)."""
    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    mapping = _normalize_mapping(column_mapping_override or row.get("column_mapping"))
    source_type = (row.get("source_type") or "").strip().lower()
    has_db = row.get("connection_id") and row.get("source_table")
    # DB 소스가 있으면 DB 우선(양쪽 조건 만족 시 파일로 타는 것 방지)
    if source_type in ("postgresql", "mysql", "oracle") or has_db:
        return _get_source_df_db(row, column_mapping_override)
    if source_type == "file" or (row.get("file_path") and row.get("file_type")):
        df = _read_file_preview(
            row.get("file_path"), row.get("file_type"), max_rows=10
        )
        if df.empty:
            return (df, mapping)
        if mapping:
            cols = [s for s, _t, _ty in mapping if s in df.columns]
            if cols:
                df = df[cols].copy()
        return (df, mapping)
    raise ValueError(
        "미리보기 지원 소스가 아닙니다. 파일(path/type) 또는 DB(connection_id/source_table)가 필요합니다."
    )


# 13.
def _get_source_df_db(row: dict, column_mapping_override: Any = None) -> tuple:
    """DB 소스에서 소스 컬럼명 기준 DataFrame과 mapping 반환. (df, mapping)."""
    from Backend.etl_server.db_load_service import (
        _fetch_source_columns,
        _fetch_source_columns_mysql,
        _fetch_source_columns_oracle,
        _get_source_connection,
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

    conn = None
    try:
        if stype == "mysql":
            conn = etl_service._connect_mysql(
                c["host"],
                c.get("port") or 3306,
                c["database_name"],
                c["username"],
                c.get("encrypted_password") or "",
            )
            columns = _fetch_source_columns_mysql(conn, src_schema, source_table_name)
            quoted_src = f"{_quote_ident_mysql(src_schema)}.{_quote_ident_mysql(source_table_name)}"
            _quote = _quote_ident_mysql
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
            quoted_src = f"{_quote_ident_pg(owner)}.{_quote_ident_pg(tbl)}"
            _quote = _quote_ident_pg
        else:
            conn = _get_source_connection(connection_id)
            columns = _fetch_source_columns(conn, src_schema, source_table_name)
            quoted_src = f"{_quote_ident_pg(src_schema)}.{_quote_ident_pg(source_table_name)}"
            _quote = _quote_ident_pg

        if not columns:
            return (pd.DataFrame(), [])

        col_names = [c[0] for c in columns]
        column_mapping = _normalize_mapping(column_mapping_override or row.get("column_mapping"))
        if column_mapping:
            mapping_filtered = [(s, t, ty) for s, t, ty in column_mapping if s in col_names]
            select_cols = [s for s, t, ty in mapping_filtered]
        else:
            mapping_filtered = []
            select_cols = col_names

        if not select_cols:
            return (pd.DataFrame(), mapping_filtered if column_mapping else [])

        select_list = ", ".join(_quote(c) for c in select_cols)
        cur = conn.cursor()
        fetch_limit = 50
        if stype == "oracle":
            cur.execute(f"SELECT {select_list} FROM {quoted_src} FETCH FIRST {fetch_limit} ROWS ONLY")
        else:
            cur.execute(f"SELECT {select_list} FROM {quoted_src} LIMIT {fetch_limit}")
        rows = cur.fetchall()
        cur.close()

        if rows and hasattr(rows[0], "keys"):
            rows = [dict(r) for r in rows]
        else:
            rows = [dict(zip(select_cols, r)) for r in rows]

        # DB 소스에는 헤더 행이 없으므로 SKIP_HEADER_LIKE_ROWS 적용하지 않음
        rows = rows[:10]

        return (pd.DataFrame(rows), mapping_filtered if column_mapping else [])
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def get_transform_preview(
    etl_table_id: int,
    rules: List[dict],
    column_mapping_override: Any = None,
) -> dict:
    """현재 설정한 변환 룰 적용 미리보기. preview_columns, preview_rows, row_count, transform_failed_count 반환."""
    from Backend.etl_server.transform_engine import apply_rules

    df, _mapping = get_source_dataframe(etl_table_id, column_mapping_override)
    if df.empty or not rules:
        return {
            "preview_columns": list(df.columns) if not df.empty else [],
            "preview_rows": [],
            "row_count": 0,
            "transform_failed_count": 0,
        }

    out = apply_rules(df.copy(), rules)
    preview_columns = list(out.columns)
    records = out.replace({pd.NA: None}).to_dict("records")
    preview_rows = [[_serialize_row(rec.get(c)) for c in preview_columns] for rec in records]

    # transform_failed_count: apply_rules does not return per-cell failure stats yet; reserved for future sprint.
    return {
        "preview_columns": preview_columns,
        "preview_rows": preview_rows,
        "row_count": len(preview_rows),
        "transform_failed_count": 0,
    }


# 15.
def _get_preview_with_transform(etl_table_id: int) -> dict:
    """저장 시와 동일하게 변환 룰 + 타입 캐스트 적용 후 미리보기. columns + preview_columns + preview_rows 반환."""
    from Backend.etl_server import transform_engine
    from Backend.etl_server import transform_rules_service as transform_rules_svc

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    source_type = (row.get("source_type") or "").strip().lower()
    if source_type in ("postgresql", "mysql", "oracle") or (row.get("connection_id") and row.get("source_table")):
        source_type = "db"
    elif source_type == "file" or (row.get("file_path") and row.get("file_type")):
        source_type = "file"
    else:
        raise ValueError("미리보기 지원 소스가 아닙니다.")

    df, mapping = get_source_dataframe(etl_table_id)
    if df.empty:
        return {
            "columns": [],
            "preview_rows": [],
            "preview_columns": [],
            "source_type": source_type,
        }

    rules = transform_rules_svc.list_transform_rules(etl_table_id)
    if rules:
        try:
            df = transform_engine.apply_rules(df.copy(), rules)
        except Exception as e:
            logger.warning("get_preview apply_rules 실패, 변환 없이 진행: %s", e)

    mapping_dicts = [{"source": s, "target": t, "type": ty or "TEXT"} for (s, t, ty) in mapping]
    if mapping_dicts:
        try:
            df = transform_engine.apply_mapping_type_cast(df, mapping_dicts, default_on_error="null")
        except Exception as e:
            logger.warning("get_preview apply_mapping_type_cast 실패: %s", e)
        preview_columns = [m["target"] for m in mapping_dicts]
        records = df.replace({pd.NA: None}).to_dict("records")
        preview_rows = [
            [_serialize_row(rec.get(m["target"], rec.get(m["source"]))) for m in mapping_dicts]
            for rec in records
        ]
        columns_out = []
        for m in mapping_dicts:
            t, ty = m["target"], (m.get("type") or "TEXT").strip().upper() or "TEXT"
            can_save, reason = _check_column_save(t)
            columns_out.append({"name": t, "inferred_type": ty, "can_save": can_save, "reason": reason})
    else:
        preview_columns = list(df.columns)
        records = df.replace({pd.NA: None}).to_dict("records")
        preview_rows = [[_serialize_row(rec.get(c)) for c in preview_columns] for rec in records]
        columns_out = []
        for col in preview_columns:
            can_save, reason = _check_column_save(str(col))
            dtype = schema_infer._dtype_to_inferred(df[col].dtype) if col in df.columns else "text"
            pg_t = _pg_type(dtype)
            columns_out.append({"name": str(col), "inferred_type": pg_t, "can_save": can_save, "reason": reason})

    if source_type == "db":
        remarks = _build_transform_remarks_by_column(etl_table_id)
        for col in columns_out:
            col["transform_remark"] = remarks.get((col.get("name") or "").strip(), "") or ""

    return {
        "columns": columns_out,
        "preview_rows": preview_rows,
        "preview_columns": preview_columns,
        "source_type": source_type,
    }


# 16.
def get_preview(etl_table_id: int) -> dict:
    """ETL 테이블 1건에 대한 미리보기. 변환 룰·타입 캐스트 적용 후 저장될 모습으로 columns + preview_rows(최대 10행) 반환."""
    return _get_preview_with_transform(etl_table_id)
