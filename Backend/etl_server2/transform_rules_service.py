"""
Backend.etl_server.transform_rules_service (변환 룰 메타 CRUD)
==============================================================
etl_transform_rules 테이블 조회·등록·수정·삭제. rule_type: cleansing, type_cast, code_map, derived, masking.

[Helpers]
===========
30 - _get_db: api_server.db 지연 로드
34 - _schema: get_system_table_schema()
38 - _q: 스키마.테이블명 따옴표 감싼 문자열

[Functions]
===========
42 - list_transform_rules: etl_table_id별 룰 목록(apply_order, rule_id 순)
65 - create_transform_rule: 룰 1건 등록, rule_id 반환
107 - get_transform_rule: rule_id로 1건 조회
129 - update_transform_rule: 룰 수정(전달 필드만)
180 - delete_transform_rule: 룰 1건 삭제

[Dependencies]
=========
- Backend.etl_server.service
"""

from typing import Any, Dict, List, Optional

from Backend.etl_server2 import service as etl_service


def _get_db():
    return etl_service._get_db()


def _schema():
    return etl_service._schema()


def _q(schema_name: str, table_name: str) -> str:
    return etl_service._q(schema_name, table_name)


def list_transform_rules(etl_table_id: int) -> List[Dict[str, Any]]:
    """etl_table_id에 속한 변환 룰 목록. apply_order, rule_id 순."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT rule_id, etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active, created_at, updated_at
            FROM {_q(schema, "etl_transform_rules")}
            WHERE etl_table_id = %s
            ORDER BY apply_order ASC, rule_id ASC
            """,
            (etl_table_id,),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
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
) -> int:
    """변환 룰 1건 등록. target_column이 None이면 source_column과 동일. 반환: rule_id."""
    api_db = _get_db()
    schema = _schema()
    source_column = etl_service._validate_identifier(source_column.strip(), "source_column")
    target_column = (target_column or source_column).strip()
    if target_column:
        target_column = etl_service._validate_identifier(target_column, "target_column")
    else:
        target_column = source_column
    if rule_type not in ("cleansing", "type_cast", "code_map", "derived", "masking"):
        raise ValueError("rule_type은 cleansing, type_cast, code_map, derived, masking 중 하나여야 합니다.")
    import json
    config_json = json.dumps(rule_config if rule_config is not None else {})
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_transform_rules")}
            (etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active, updated_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, NOW())
            RETURNING rule_id
            """,
            (etl_table_id, source_column, target_column, rule_type, config_json, int(apply_order), bool(is_active)),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["rule_id"])
    finally:
        cur.close()
        conn.close()


def get_transform_rule(rule_id: int) -> Optional[Dict[str, Any]]:
    """rule_id로 룰 1건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT rule_id, etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active, created_at, updated_at
            FROM {_q(schema, "etl_transform_rules")}
            WHERE rule_id = %s
            """,
            (rule_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
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
) -> None:
    """변환 룰 수정. 전달된 필드만 갱신."""
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
        if rule_type is not None:
            if rule_type not in ("cleansing", "type_cast", "code_map", "derived", "masking"):
                raise ValueError("rule_type은 cleansing, type_cast, code_map, derived, masking 중 하나여야 합니다.")
            updates.append("rule_type = %s")
            params.append(rule_type)
        if rule_config is not None:
            import json
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
        cur.execute(
            f"UPDATE {_q(schema, 'etl_transform_rules')} SET {', '.join(updates)} WHERE rule_id = %s",
            params,
        )
        conn.commit()
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
