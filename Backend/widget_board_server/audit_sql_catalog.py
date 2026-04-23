"""
Backend.widget_board_server.audit_sql_catalog (감사용 SQL 템플릿·지문)
================================================================
`emit_widget_board_log` 가 `sql_fingerprint` 를 생략할 때 `business_action` 별 대표 DML 템플릿으로
지문을 계산한다. 원문 SQL 전체는 저장하지 않는다(`docs/main/04_DB_ARCHITECTURE.md` 13절).

[Main Functions]
===========
1. _fingerprint_hex_cached: SQL 템플릿 → 지문 hex(lru_cache)
2. widget_board_audit_sql_fingerprint: business_action·detail_json → 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- _fingerprint_hex_cached(sql_template)
- widget_board_audit_sql_fingerprint(business_action, detail_json)

[Dependencies]
=========
- functools.lru_cache, typing.Any
- Backend.core.sql_fingerprint.compute_sql_fingerprint_hex
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex

_SQL_BY_ACTION: dict[str, str] = {
    "widget_board_create": """
            INSERT INTO widget_board (
                project_info_id, owner_user_id, board_name, board_dscrtn,
                board_order, is_default, share_scope, active_yn
            ) VALUES (%s, %s, %s, %s, 0, FALSE, %s, 'Y')
            RETURNING *
            """,
    "widget_board_update": """
            UPDATE widget_board SET board_name = %s, update_dtm = NOW() WHERE widget_board_id = %s
            """,
    "widget_board_delete": """
            DELETE FROM widget_item WHERE widget_board_id = %s;
            DELETE FROM widget_board_share WHERE widget_board_id = %s;
            DELETE FROM widget_board WHERE widget_board_id = %s
            """,
    "widget_create": """
            INSERT INTO widget_item (
                widget_board_id, widget_type, widget_title, data_source_type,
                data_source_query, data_source_ref, data_config,
                layout_x, layout_y, layout_w, layout_h, widget_order, create_user_id, active_yn
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, 'Y')
            RETURNING *
            """,
    "widget_update": """
            UPDATE widget_item SET widget_title = %s, update_dtm = NOW()
            WHERE widget_item_id = %s AND widget_board_id = %s
            """,
    "widget_delete": """
            DELETE FROM widget_item
            WHERE widget_item_id = %s AND widget_board_id = %s
            """,
    "widget_layout_update": """
            UPDATE widget_item
            SET layout_x = %s, layout_y = %s, layout_w = %s, layout_h = %s, update_dtm = NOW()
            WHERE widget_item_id = %s AND widget_board_id = %s AND active_yn = 'Y'
            """,
    "widget_share_upsert": """
            INSERT INTO widget_board_share (widget_board_id, shared_user_id, can_edit)
            VALUES (%s, %s, %s)
            ON CONFLICT (widget_board_id, shared_user_id)
            DO UPDATE SET can_edit = EXCLUDED.can_edit
            """,
    "widget_share_delete": """
            UPDATE widget_item SET create_user_id = %s, update_dtm = NOW()
            WHERE widget_board_id = %s AND active_yn = 'Y' AND create_user_id = %s;
            DELETE FROM widget_board_share WHERE widget_board_id = %s AND shared_user_id = %s
            """,
    "invite_send": """
            INSERT INTO notification_info (
                user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, %s, NOW())
            """,
    "invite_accept": """
            INSERT INTO widget_board_share (widget_board_id, shared_user_id, can_edit)
            VALUES (%s, %s, %s)
            ON CONFLICT (widget_board_id, shared_user_id)
            DO UPDATE SET can_edit = EXCLUDED.can_edit
            """,
    "invite_reject": """
            DELETE FROM notification_info WHERE notification_info_id = %s AND user_id = %s
            """,
}


# 1.
@lru_cache(maxsize=64)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


# 2.
def widget_board_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    _ = detail_json
    ba = (business_action or "").strip()
    tpl = _SQL_BY_ACTION.get(ba)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
