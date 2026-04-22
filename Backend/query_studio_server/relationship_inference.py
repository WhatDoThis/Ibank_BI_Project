"""
Backend.query_studio_server.relationship_inference (관계 추론)
=====================================================
DB 허용 테이블 + 컬럼 정보로 관계 추론 (pluralize + 확장: 복수형이 테이블명 일부).
컬럼 dict에 column_comment 가 있으면(저장 테이블 col_n + COMMENT) 물리명 대신 코멘트 문자열로 부모 _id 추론, from_column 은 물리명 유지.

[Main Functions]
===========
1. _table_has_id: 테이블에 id 컬럼 존재 여부
2. find_parent_table_extended: _id 컬럼명→부모 테이블 (delivery_id→test_deliveries_data 등)
3. infer_relationships: 전체 추론 관계 목록 (report API 형식, source/reason 포함)

[Dependencies]
=========
- Backend.query_studio_server.pluralize (find_parent_table, pluralize)
"""

from Backend.query_studio_server.pluralize import find_parent_table as _find_parent_table, pluralize


# 1.
def _table_has_id(table_columns, tbl):
    """테이블에 id 컬럼 있는지."""
    cols = table_columns.get(tbl) or []
    if not cols:
        return False
    if isinstance(cols[0], str):
        return "id" in cols
    return any((c or {}).get("column_name") == "id" for c in cols)


# 2.
def find_parent_table_extended(column_name, from_table, allowed_tables, table_columns):
    """
    find_parent_table 실패 시: 복수형이 테이블명 일부인 경우 매칭.
    예: delivery_id → test_deliveries_data (deliveries 포함)
    """
    if not column_name.endswith("_id"):
        return None
    base = column_name[:-3].rstrip("_")
    if not base:
        return None
    plural = pluralize(base)
    candidates = [
        t for t in allowed_tables
        if t != from_table and plural.lower() in t.lower() and _table_has_id(table_columns, t)
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda x: (plural.lower() not in x.lower().split("_")[-1], len(x)))
    return candidates[0]


# 3.
def infer_relationships(allowed_tables, table_columns, existing_keys=None):
    """
    _id 컬럼 기준 관계 추론 (pluralize + 확장).
    반환: report API와 동일한 형식 [ { from_table, from_column, to_table, to_column, from_columns, to_columns, role, source, reason, relationship_type }, ... ]
    """
    existing_keys = existing_keys or set()
    table_columns = table_columns or {}
    cols_as_dict = {}
    for t in allowed_tables:
        raw = table_columns.get(t, [])
        if raw and isinstance(raw[0], dict):
            cols_as_dict[t] = [c.get("column_name") for c in raw if c.get("column_name")]
        else:
            cols_as_dict[t] = list(raw) if raw else []

    raw_by_table = table_columns or {}

    def _logical_for_inference(table_name: str, physical: str):
        raw = raw_by_table.get(table_name) or []
        if raw and isinstance(raw[0], dict):
            for c in raw:
                if (c or {}).get("column_name") == physical:
                    cm = (c or {}).get("column_comment") or ""
                    cm = str(cm).strip()
                    if cm:
                        return cm, True
                    break
        return physical, False

    out = []
    for table_name in allowed_tables:
        cols = cols_as_dict.get(table_name, [])
        for col_name in cols:
            logical, used_comment = _logical_for_inference(table_name, col_name)
            if logical == "id" or not str(logical).endswith("_id"):
                continue
            parent = _find_parent_table(logical, allowed_tables)
            if not parent:
                parent = find_parent_table_extended(logical, table_name, allowed_tables, cols_as_dict)
            if not parent:
                continue
            key = (table_name, col_name, parent, "id")
            if key in existing_keys:
                continue
            existing_keys.add(key)
            role = (logical[:-3] if str(logical).endswith("_id") and len(str(logical)) > 3 else None)
            hint = f"{col_name}({logical})" if used_comment and col_name != logical else col_name
            out.append({
                "from_table": table_name,
                "from_column": col_name,
                "to_table": parent,
                "to_column": "id",
                "from_columns": [col_name],
                "to_columns": ["id"],
                "role": role,
                "source": "inferred_comment" if used_comment else "inferred",
                "confidence": "HIGH",
                "reason": (f"컬럼 코멘트 기반 _id 추론: {hint} → {parent}.id" if used_comment else f"_id 추론: {col_name} → {parent}.id"),
                "relationship_type": "N:1",
            })
    return out
