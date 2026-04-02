"""
Backend.etl_server.transform_rules_service (변환 룰 메타 CRUD)
=============================================================
etl_transform_rules 테이블 조회·등록·수정·삭제. Phase 2: rule_category + operation (마이그레이션 선행).

[Main Functions]
===========
1. _get_db, _schema, _q: DB·스키마·쿼리 식별자 헬퍼
2. _normalize_category: 레거시 rule_type 정규화
3. _enrich_rule_dict: expression→rule_config, apply_order↔rule_order, operation 보정
4. list_transform_rules: etl_table_id별 룰 목록(apply_order 또는 rule_order 정렬)
5. create_transform_rule: 룰 1건 등록(운영 DB에 rule_order+expression만 있으면 그에 맞춤, rule_config 컬럼이 있으면 JSONB 경로 사용)
6. get_transform_rule: rule_id로 1건 조회
7. update_transform_rule: 존재 컬럼만 갱신(expression/rule_order 호환)
8. delete_transform_rule: 룰 1건 삭제

[Dependencies]
=========
- Backend.etl_server.service (스키마·_table_columns_lower·_q)
- Backend.core.db: ETL 메타는 get_db_connection_etl()만 사용(system_db와 분리)
"""

import json
from typing import Any, Dict, List, Optional

from Backend.etl_server import service as etl_service


# 1.
def _get_db():
    return etl_service._get_db()


# 1b.
def _etl_data_conn():
    """etl_transform_rules 등 ibank_etl_data 전용 연결. get_db_connection_system과 동일 풀이나 명시적."""
    return _get_db().get_db_connection_etl()


# 2.
def _schema():
    return etl_service._schema()


# 3.
def _q(schema_name: str, table_name: str) -> str:
    return etl_service._q(schema_name, table_name)


_VALID_CATEGORIES = frozenset({
    "cleansing", "type_cast", "string", "datetime", "numeric", "mapping", "masking", "row",
})
_VALID_RULE_TYPES = frozenset({
    "cleansing", "type_cast", "code_map", "derived", "masking", "string",
})


# 4.
def _normalize_category(cat: str) -> str:
    """레거시: code_map→mapping, derived→string."""
    if not cat:
        return cat
    c = cat.strip().lower()
    if c == "code_map":
        return "mapping"
    if c == "derived":
        return "string"
    return c


# 5.
def _enrich_rule_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    """조회 결과에 rule_config·apply_order/rule_order·operation을 엔진 호환 형태로 맞춤."""
    if "rule_category" in d and d.get("rule_category") is not None:
        d.setdefault("rule_type", d["rule_category"])
    elif "rule_type" in d:
        d.setdefault("rule_category", _normalize_category(str(d["rule_type"])))
    ao = d.get("apply_order")
    ro = d.get("rule_order")
    if ao is None and ro is not None:
        d["apply_order"] = ro
    if ro is None and ao is not None:
        d["rule_order"] = ao
    _rc = d.get("rule_config")
    if isinstance(_rc, str):
        try:
            _rc = json.loads(_rc)
        except Exception:
            _rc = {}
    elif not isinstance(_rc, dict):
        _rc = {}
    if (not _rc or (isinstance(_rc, dict) and len(_rc) == 0)) and d.get("expression"):
        expr = d["expression"]
        if isinstance(expr, str) and expr.strip():
            try:
                _rc = json.loads(expr)
            except Exception:
                _rc = {"raw_expression": expr}
    d["rule_config"] = _rc
    db_op = (d.get("operation") or "").strip() if isinstance(d.get("operation"), str) else ""
    config_op = (_rc.get("operation") or "").strip() if isinstance(_rc, dict) else ""
    if db_op and db_op != "default":
        d["operation"] = db_op
    elif config_op:
        d["operation"] = config_op
    else:
        d["operation"] = "default"
    return d


# 6.
def list_transform_rules(etl_table_id: int) -> List[Dict[str, Any]]:
    """etl_table_id에 속한 변환 룰 목록. apply_order 또는 rule_order·rule_id 순."""
    schema = _schema()
    conn = _etl_data_conn()
    cur = conn.cursor()
    try:
        tcols = etl_service._table_columns_lower(cur, schema, "etl_transform_rules")
        order_clause = "rule_id ASC"
        if "apply_order" in tcols:
            order_clause = "apply_order ASC, rule_id ASC"
        elif "rule_order" in tcols:
            order_clause = "rule_order ASC, rule_id ASC"
        cur.execute(
            f"""
            SELECT * FROM {_q(schema, "etl_transform_rules")}
            WHERE etl_table_id = %s
            ORDER BY {order_clause}
            """,
            (etl_table_id,),
        )
        rows = cur.fetchall()
        colnames = [c.name for c in cur.description] if cur.description else []
        out = []
        for r in rows:
            d = dict(zip(colnames, r)) if not hasattr(r, "keys") else dict(r)
            out.append(_enrich_rule_dict(d))
        return out
    finally:
        cur.close()
        conn.close()


# 7.
def create_transform_rule(
    etl_table_id: int,
    source_column: str,
    rule_type: str,
    rule_config: Optional[Dict[str, Any]] = None,
    target_column: Optional[str] = None,
    apply_order: int = 1,
    is_active: bool = True,
    rule_category: Optional[str] = None,
    operation: str = "default",
) -> int:
    """변환 룰 1건 등록. rule_type(또는 rule_category) 사용. operation 기본 'default'. 반환: rule_id."""
    schema = _schema()
    source_column = etl_service._validate_identifier(source_column.strip(), "source_column")
    target_column = (target_column or source_column).strip()
    if target_column:
        target_column = etl_service._validate_identifier(target_column, "target_column")
    else:
        target_column = source_column
    cat = _normalize_category((rule_category or rule_type or "").strip())
    if not cat:
        raise ValueError("rule_category 또는 rule_type이 필요합니다.")
    if cat not in _VALID_CATEGORIES:
        legacy = (rule_type or rule_category or "").strip().lower()
        if legacy not in _VALID_RULE_TYPES:
            raise ValueError(f"rule_type/rule_category는 {', '.join(sorted(_VALID_CATEGORIES | _VALID_RULE_TYPES))} 중 하나여야 합니다.")
    config_json = json.dumps(rule_config if rule_config is not None else {})
    op = (operation or "default").strip() or "default"
    conn = _etl_data_conn()
    cur = conn.cursor()
    try:
        tcols = etl_service._table_columns_lower(cur, schema, "etl_transform_rules")
        if "expression" in tcols and "rule_config" not in tcols:
            ord_col = "apply_order" if "apply_order" in tcols else ("rule_order" if "rule_order" in tcols else None)
            if not ord_col:
                raise ValueError("etl_transform_rules에 rule_order 또는 apply_order 컬럼이 필요합니다.")
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "etl_transform_rules")}
                (etl_table_id, {ord_col}, rule_type, source_column, target_column, expression, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING rule_id
                """,
                (etl_table_id, int(apply_order), (rule_type or cat), source_column, target_column, config_json),
            )
            row = cur.fetchone()
            conn.commit()
            return int(row["rule_id"])
        try:
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "etl_transform_rules")}
                (etl_table_id, source_column, target_column, rule_category, operation, rule_config, apply_order, is_active, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, NOW())
                RETURNING rule_id
                """,
                (etl_table_id, source_column, target_column, cat, op, config_json, int(apply_order), bool(is_active)),
            )
            row = cur.fetchone()
            conn.commit()
            return int(row["rule_id"])
        except Exception as e:
            conn.rollback()
            err_msg = str(e).lower()
            is_schema_mismatch = (
                "rule_category" in err_msg
                or "undefined column" in err_msg
                or "does not exist" in err_msg
            )
            if is_schema_mismatch:
                cur.execute(
                    f"""
                    INSERT INTO {_q(schema, "etl_transform_rules")}
                    (etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active, updated_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, NOW())
                    RETURNING rule_id
                    """,
                    (etl_table_id, source_column, target_column, rule_type or cat, config_json, int(apply_order), bool(is_active)),
                )
                row = cur.fetchone()
                conn.commit()
                return int(row["rule_id"])
            raise
    finally:
        cur.close()
        conn.close()


# 8.
def get_transform_rule(rule_id: int) -> Optional[Dict[str, Any]]:
    """rule_id로 룰 1건 조회. rule_category/operation 또는 rule_type 반환(스키마에 따름)."""
    schema = _schema()
    conn = _etl_data_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""SELECT * FROM {_q(schema, "etl_transform_rules")} WHERE rule_id = %s""",
            (rule_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        colnames = [c.name for c in cur.description] if cur.description else []
        d = dict(zip(colnames, row)) if not hasattr(row, "keys") else dict(row)
        return _enrich_rule_dict(d)
    finally:
        cur.close()
        conn.close()


# 9.
def update_transform_rule(
    rule_id: int,
    source_column: Optional[str] = None,
    target_column: Optional[str] = None,
    rule_type: Optional[str] = None,
    rule_config: Optional[Dict[str, Any]] = None,
    apply_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    rule_category: Optional[str] = None,
    operation: Optional[str] = None,
) -> None:
    """변환 룰 수정. information_schema에 있는 컬럼만 SET (레거시: rule_type·rule_order·expression)."""
    schema = _schema()
    conn = _etl_data_conn()
    cur = conn.cursor()
    try:
        tcols = etl_service._table_columns_lower(cur, schema, "etl_transform_rules")
        updates: List[str] = []
        params: List[Any] = []
        if source_column is not None and "source_column" in tcols:
            updates.append("source_column = %s")
            params.append(etl_service._validate_identifier(source_column.strip(), "source_column"))
        if target_column is not None and "target_column" in tcols:
            updates.append("target_column = %s")
            params.append(etl_service._validate_identifier(target_column.strip(), "target_column"))
        cat = rule_category or rule_type
        if cat is not None:
            c = _normalize_category(str(cat).strip())
            if "rule_category" in tcols and c and c in _VALID_CATEGORIES:
                updates.append("rule_category = %s")
                params.append(c)
            elif "rule_category" in tcols and (rule_type or "").strip() in _VALID_RULE_TYPES:
                updates.append("rule_category = %s")
                params.append(_normalize_category(str(rule_type).strip()))
            elif "rule_type" in tcols:
                updates.append("rule_type = %s")
                params.append((rule_type or cat or c or "").strip())
        if operation is not None and "operation" in tcols:
            updates.append("operation = %s")
            params.append((operation or "default").strip() or "default")
        if rule_config is not None:
            if "rule_config" in tcols:
                updates.append("rule_config = %s::jsonb")
                params.append(json.dumps(rule_config))
            elif "expression" in tcols:
                updates.append("expression = %s")
                params.append(json.dumps(rule_config) if rule_config is not None else "")
        if apply_order is not None:
            if "apply_order" in tcols:
                updates.append("apply_order = %s")
                params.append(int(apply_order))
            elif "rule_order" in tcols:
                updates.append("rule_order = %s")
                params.append(int(apply_order))
        if is_active is not None and "is_active" in tcols:
            updates.append("is_active = %s")
            params.append(bool(is_active))
        if not updates:
            return
        if "updated_at" in tcols:
            updates.append("updated_at = NOW()")
        params.append(rule_id)
        cur.execute(
            f"UPDATE {_q(schema, 'etl_transform_rules')} SET {', '.join(updates)} WHERE rule_id = %s",
            params,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# 10.
def delete_transform_rule(rule_id: int) -> None:
    """변환 룰 삭제."""
    schema = _schema()
    conn = _etl_data_conn()
    cur = conn.cursor()
    try:
        cur.execute(f"DELETE FROM {_q(schema, 'etl_transform_rules')} WHERE rule_id = %s", (rule_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()
