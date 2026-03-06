"""
Backend.etl_server2.transform_rules_service (변환 룰 메타 CRUD)
=============================================================
etl_transform_rules 테이블 조회·등록·수정·삭제. Phase 2: rule_category + operation (마이그레이션 선행).

[Helpers]
===========
- _get_db: api_server.db 지연 로드
- _schema: get_system_table_schema()
- _q: 스키마.테이블명 따옴표 감싼 문자열

[Main Functions]
===========
- list_transform_rules: etl_table_id별 룰 목록(apply_order, rule_id 순)
- create_transform_rule: 룰 1건 등록, rule_id 반환
- get_transform_rule: rule_id로 1건 조회
- update_transform_rule: 룰 수정(전달 필드만)
- delete_transform_rule: 룰 1건 삭제

[Dependencies]
=========
- Backend.etl_server2.service
"""

import json
from typing import Any, Dict, List, Optional

from Backend.etl_server2 import service as etl_service


def _get_db():
    return etl_service._get_db()


def _schema():
    return etl_service._schema()


def _q(schema_name: str, table_name: str) -> str:
    return etl_service._q(schema_name, table_name)


_VALID_CATEGORIES = frozenset({
    "cleansing", "type_cast", "string", "datetime", "numeric", "mapping", "masking", "row",
})
_VALID_RULE_TYPES = frozenset({
    "cleansing", "type_cast", "code_map", "derived", "masking", "string",
})


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


def list_transform_rules(etl_table_id: int) -> List[Dict[str, Any]]:
    """etl_table_id에 속한 변환 룰 목록. apply_order, rule_id 순. rule_category/operation 또는 rule_type 반환(스키마에 따름)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT * FROM {_q(schema, "etl_transform_rules")}
            WHERE etl_table_id = %s
            ORDER BY apply_order ASC, rule_id ASC
            """,
            (etl_table_id,),
        )
        rows = cur.fetchall()
        colnames = [c.name for c in cur.description] if cur.description else []
        out = []
        for r in rows:
            d = dict(zip(colnames, r)) if not hasattr(r, "keys") else dict(r)
            if "rule_category" in d:
                d.setdefault("rule_type", d["rule_category"])
            elif "rule_type" in d:
                d.setdefault("rule_category", _normalize_category(str(d["rule_type"])))
            if "operation" not in d:
                d["operation"] = "default"
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


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
    api_db = _get_db()
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
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
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


def get_transform_rule(rule_id: int) -> Optional[Dict[str, Any]]:
    """rule_id로 룰 1건 조회. rule_category/operation 또는 rule_type 반환(스키마에 따름)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
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
        if "rule_category" in d:
            d.setdefault("rule_type", d["rule_category"])
        elif "rule_type" in d:
            d.setdefault("rule_category", _normalize_category(str(d["rule_type"])))
        d.setdefault("operation", "default")
        return d
    finally:
        cur.close()
        conn.close()


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
    """변환 룰 수정. 전달된 필드만 갱신. rule_type/rule_category → rule_category, operation 지원(마이그레이션 후)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        updates = ["updated_at = NOW()"]
        params = []
        if source_column is not None:
            updates.append("source_column = %s")
            params.append(etl_service._validate_identifier(source_column.strip(), "source_column"))
        if target_column is not None:
            updates.append("target_column = %s")
            params.append(etl_service._validate_identifier(target_column.strip(), "target_column"))
        cat = rule_category or rule_type
        if cat is not None:
            c = _normalize_category(str(cat).strip())
            if c and c in _VALID_CATEGORIES:
                updates.append("rule_category = %s")
                params.append(c)
            elif (rule_type or "").strip() in _VALID_RULE_TYPES:
                updates.append("rule_category = %s")
                params.append(_normalize_category(str(rule_type).strip()))
        if operation is not None:
            updates.append("operation = %s")
            params.append((operation or "default").strip() or "default")
        if rule_config is not None:
            updates.append("rule_config = %s::jsonb")
            params.append(json.dumps(rule_config))
        if apply_order is not None:
            updates.append("apply_order = %s")
            params.append(int(apply_order))
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(bool(is_active))
        if len(params) == 0:
            return
        params.append(rule_id)
        try:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_transform_rules')} SET {', '.join(updates)} WHERE rule_id = %s",
                params,
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            err_msg = str(e).lower()
            is_schema_mismatch = (
                "rule_category" in err_msg
                or "operation" in err_msg
                or "undefined column" in err_msg
                or "does not exist" in err_msg
            )
            if is_schema_mismatch:
                fixed_updates = []
                fixed_params = []
                for i, u in enumerate(updates):
                    if "operation" in u:
                        continue
                    fixed_updates.append(
                        u.replace("rule_category", "rule_type") if "rule_category" in u else u
                    )
                    if "rule_category" in u and rule_type is not None:
                        fixed_params.append(rule_type)
                    else:
                        fixed_params.append(params[i])
                fixed_params.append(rule_id)
                if len(fixed_updates) > 0 and len(fixed_params) == len(fixed_updates) + 1:
                    cur.execute(
                        f"UPDATE {_q(schema, 'etl_transform_rules')} SET {', '.join(fixed_updates)} WHERE rule_id = %s",
                        fixed_params,
                    )
                    conn.commit()
            else:
                raise
    finally:
        cur.close()
        conn.close()


def delete_transform_rule(rule_id: int) -> None:
    """변환 룰 삭제."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(f"DELETE FROM {_q(schema, 'etl_transform_rules')} WHERE rule_id = %s", (rule_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()
