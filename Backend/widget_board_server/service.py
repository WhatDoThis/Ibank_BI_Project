"""
widget_board_server.service (위젯 보드 CRUD·데이터 조회)
======================================================
system_db: widget_board, widget_item, widget_board_share.
메인 DB: saved_table / query 타입 SELECT (프로젝트 허용 테이블·SQL 안전 검사).

[Main Functions]
===========
1. list_boards — 접근 가능 보드 목록
2. create_board
3. get_board_detail — 보드 + 위젯 + can_edit(소유자·초대(widget_board_share) 편집)
4. patch_board / delete_board (논리 삭제)
5. add_widget(create_user_id 저장) / patch_widget / delete_widget
6. patch_layout
7. upsert_share / delete_share(제외 시 create_user_id 소유자 이관)
8. list_board_participants / list_invite_candidates / send_invite_notifications(알림 초대)
9. accept_widget_board_invite / reject_widget_board_invite — 수락 시 widget_board_share 반영
10. fetch_widget_data — saved_table 시 data_config.dateStart/End/Grain/Column 기간 필터(상한: 14일·12주·12개월)

[Dependencies]
=========
- psycopg2.extras.Json, psycopg2.sql
- Backend.auth_server.permissions.is_project_participant
- Backend.core.db (get_db_connection, get_table_schema, validate_table_name, validate_column_name, get_allowed_tables_by_project, get_table_columns_with_types, format_value)
- Backend.core.sql_safety.contains_dangerous_sql
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from psycopg2 import sql as psql
from psycopg2.extras import Json, RealDictCursor

from Backend.auth_server.permissions import (
    compute_effective_project_permission_ids,
    get_user_dvsn_lower,
    is_project_participant,
)
from Backend.core import db
from Backend.widget_board_server import schemas
from Backend.core.sql_safety import contains_dangerous_sql

_DEFAULT_LIMIT = 500
_INVITE_VALID_DAYS = 7
_SCOPES = frozenset({"private", "project"})


# --- data_config 날짜 필터 (컬럼 추가 없음, JSON만 사용) ---


def _scope(s: str | None) -> str:
    v = (s or "private").strip().lower()
    if v not in _SCOPES:
        raise ValueError(f"share_scope 은 private 또는 project 만 가능합니다: {s}")
    return v


def _invite_expired_from_payload(payload: dict[str, Any]) -> bool:
    raw = payload.get("invite_expires_at")
    if raw is None or raw == "":
        return False
    try:
        s = str(raw).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > dt
    except (ValueError, TypeError, OSError):
        return False


def _notify_widget_board_inviter(
    cur,
    inviter_user_id: int,
    widget_board_id: int,
    board_name: str,
    invitee_user_id: int,
    resolved_notification_id: int,
    accepted: bool,
) -> None:
    if not inviter_user_id or inviter_user_id <= 0:
        return
    cur.execute(
        "SELECT user_email, user_nickname FROM user_info WHERE user_id = %s",
        (int(invitee_user_id),),
    )
    urow = cur.fetchone()
    em = (urow.get("user_email") if urow else None) or ""
    nk = (urow.get("user_nickname") if urow else None) or ""
    who = (
        (str(nk).strip() if nk else "")
        or (str(em).strip() if em else "")
        or f"user_id {invitee_user_id}"
    )
    bname = (board_name or "").strip() or "위젯 보드"
    if accepted:
        typ = "widget_board_invite_accepted"
        title = f"{who} 님이 '{bname}' 위젯 보드 초대를 수락했습니다"
    else:
        typ = "widget_board_invite_rejected"
        title = f"{who} 님이 '{bname}' 위젯 보드 초대를 거절했습니다"
    meta = json.dumps(
        {
            "widget_board_id": int(widget_board_id),
            "invitee_user_id": int(invitee_user_id),
            "resolved_notification_info_id": int(resolved_notification_id),
        },
        ensure_ascii=False,
    )
    cur.execute(
        """
        INSERT INTO notification_info (
            user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
        ) VALUES (%s, %s, %s, %s, 'N', NOW())
        """,
        (int(inviter_user_id), typ[:30], title[:200], meta),
    )


def _user_has_pending_widget_invite(
    cur, invitee_user_id: int, board_id: int
) -> bool:
    cur.execute(
        """
        SELECT noti_content, read_yn
        FROM notification_info
        WHERE user_id = %s
          AND noti_type = 'widget_board_invite'
          AND COALESCE(UPPER(TRIM(read_yn)), 'N') <> 'Y'
        """,
        (int(invitee_user_id),),
    )
    for row in cur.fetchall():
        try:
            p = json.loads(row.get("noti_content") or "{}")
            if int(p.get("widget_board_id") or 0) == int(board_id):
                return True
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return False


def _is_date_like_pg_type(data_type: str) -> bool:
    t = (data_type or "").lower()
    return "timestamp" in t or t == "date" or t.startswith("time")


def _first_date_column_name(table_name: str) -> str | None:
    try:
        cols = db.get_table_columns_with_types(table_name)
    except Exception:
        return None
    for c in cols:
        if _is_date_like_pg_type(c.get("data_type") or ""):
            return c["column_name"]
    return None


def _resolve_widget_date_column(ref: str, dc: dict) -> str | None:
    raw = (dc.get("dateColumn") or "").strip()
    if raw:
        db.validate_column_name(raw)
        cols = db.get_table_columns_with_types(ref)
        names = {c["column_name"] for c in cols}
        if raw not in names:
            raise ValueError(f"날짜 컬럼이 테이블에 없습니다: {raw}")
        return raw
    return _first_date_column_name(ref)


def _parse_iso_date_dc(val: Any) -> date | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError("dateStart/dateEnd 는 YYYY-MM-DD 형식이어야 합니다.") from e


def _validate_date_span_for_grain(d1: date, d2: date, grain: str) -> None:
    if d1 > d2:
        raise ValueError("시작일이 종료일보다 늦습니다.")
    g = (grain or "day").strip().lower()
    if g not in ("day", "week", "month"):
        raise ValueError("dateGrain 은 day, week, month 중 하나여야 합니다.")
    delta_days = (d2 - d1).days
    if g == "day":
        if delta_days > 13:
            raise ValueError("일별 조회는 시작~종료 최대 14일(포함)까지입니다.")
    elif g == "week":
        if delta_days > 12 * 7 - 1:
            raise ValueError("주별 조회는 시작~종료 최대 12주(84일) 범위입니다.")
    else:
        months = (d2.year - d1.year) * 12 + (d2.month - d1.month) + 1
        if months > 12:
            raise ValueError("월별 조회는 시작~종료 최대 12개월(포함)입니다.")


def _board_row_any(cur, board_id: int) -> dict | None:
    cur.execute(
        "SELECT * FROM widget_board WHERE widget_board_id = %s",
        (board_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _board_is_active(b: dict) -> bool:
    return (b.get("active_yn") or "Y").strip().upper() == "Y"


def _can_read_board(conn, user_id: int, project_id: int, b: dict) -> bool:
    """소유자, widget_board_share 초대, 또는 share_scope=project 인 동일 프로젝트 참여자(읽기)."""
    if int(b["project_info_id"]) != int(project_id):
        return False
    uid = int(user_id)
    if int(b["owner_user_id"]) == uid:
        return True
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM widget_board_share
            WHERE widget_board_id = %s AND shared_user_id = %s
            """,
            (b["widget_board_id"], uid),
        )
        if cur.fetchone() is not None:
            return True
        scope = (b.get("share_scope") or "private").strip().lower()
        if scope == "project" and is_project_participant(conn, uid, int(project_id)):
            return True
        return False
    finally:
        cur.close()


def _can_edit_board(conn, user_id: int, project_id: int, b: dict) -> bool:
    uid = int(user_id)
    if int(b["owner_user_id"]) == uid:
        return True
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT can_edit FROM widget_board_share
            WHERE widget_board_id = %s AND shared_user_id = %s
            """,
            (b["widget_board_id"], uid),
        )
        row = cur.fetchone()
        return bool(row and row.get("can_edit"))
    finally:
        cur.close()


def assert_board_read(conn, user_id: int, project_id: int, board_id: int) -> dict:
    cur = conn.cursor()
    try:
        b = _board_row_any(cur, board_id)
    finally:
        cur.close()
    if not b:
        raise ValueError("보드를 찾을 수 없습니다.")
    if int(b["project_info_id"]) != int(project_id):
        raise ValueError("이 보드를 볼 권한이 없습니다.")
    uid = int(user_id)
    if not _board_is_active(b) and int(b["owner_user_id"]) != uid:
        raise ValueError("보드를 찾을 수 없습니다.")
    if not _can_read_board(conn, user_id, project_id, b):
        raise ValueError("이 보드를 볼 권한이 없습니다.")
    return b


def assert_board_edit(conn, user_id: int, project_id: int, board_id: int) -> dict:
    b = assert_board_read(conn, user_id, project_id, board_id)
    if not _board_is_active(b):
        raise ValueError("비활성화된 보드는 수정할 수 없습니다.")
    if not _can_edit_board(conn, user_id, project_id, b):
        raise ValueError("이 보드를 수정할 권한이 없습니다.")
    return b


def assert_board_owner(conn, user_id: int, project_id: int, board_id: int) -> dict:
    b = assert_board_read(conn, user_id, project_id, board_id)
    if int(b["owner_user_id"]) != int(user_id):
        raise ValueError("소유자만 이 작업을 할 수 있습니다.")
    return b


# 1.
def list_boards(conn, user_id: int, project_id: int) -> list[dict]:
    uid = int(user_id)
    pid = int(project_id)
    dvsn = get_user_dvsn_lower(conn, uid)
    eff_ids = compute_effective_project_permission_ids(conn, uid, pid, dvsn)
    has_widget = "widgetboard" in eff_ids
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                wb.*,
                (wb.owner_user_id = %s) AS is_owner,
                o.user_email AS owner_email,
                o.user_nickname AS owner_nickname,
                EXISTS (
                    SELECT 1 FROM widget_board_share sh
                    WHERE sh.widget_board_id = wb.widget_board_id
                      AND sh.shared_user_id = %s
                ) AS has_share,
                CASE
                    WHEN wb.owner_user_id = %s THEN TRUE
                    ELSE COALESCE(
                        (
                            SELECT s.can_edit
                            FROM widget_board_share s
                            WHERE s.widget_board_id = wb.widget_board_id
                              AND s.shared_user_id = %s
                            LIMIT 1
                        ),
                        FALSE
                    )
                END AS can_edit,
                (
                    1 + COALESCE(
                        (
                            SELECT COUNT(*)::int
                            FROM widget_board_share s
                            WHERE s.widget_board_id = wb.widget_board_id
                        ),
                        0
                    )
                ) AS participant_count
            FROM widget_board wb
            LEFT JOIN user_info o ON o.user_id = wb.owner_user_id
            WHERE wb.project_info_id = %s
              AND (
                wb.owner_user_id = %s
                OR (
                  wb.active_yn = 'Y'
                  AND (
                      EXISTS (
                          SELECT 1 FROM widget_board_share s
                          WHERE s.widget_board_id = wb.widget_board_id
                            AND s.shared_user_id = %s
                      )
                      OR (
                          LOWER(TRIM(COALESCE(wb.share_scope, ''))) = 'project'
                          AND EXISTS (
                              SELECT 1 FROM project_ptcpnt_info p
                              WHERE p.project_info_id = wb.project_info_id
                                AND p.ptcpnt_user_id = %s
                          )
                      )
                  )
                )
              )
            ORDER BY
              CASE WHEN wb.active_yn = 'Y' THEN 0 ELSE 1 END,
              wb.board_order ASC NULLS LAST,
              wb.board_name ASC
            """,
            (uid, uid, uid, uid, pid, uid, uid, uid),
        )
        rows = [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
    out: list[dict] = []
    for r in rows:
        scope = (r.get("share_scope") or "private").strip().lower()
        is_owner = bool(r.get("is_owner"))
        has_share = bool(r.get("has_share"))
        if (
            scope == "project"
            and not is_owner
            and not has_share
            and not has_widget
        ):
            continue
        out.append(r)
    return out


# 2.
def create_board(
    conn,
    user_id: int,
    project_id: int,
    body: schemas.WidgetBoardCreateBody,
) -> dict:
    if not is_project_participant(conn, int(user_id), int(project_id)):
        raise ValueError("프로젝트 참여자만 보드를 만들 수 있습니다.")
    name = (body.board_name or "").strip() or "새 보드"
    dsc = body.board_dscrtn
    sc = _scope(body.share_scope)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO widget_board (
                project_info_id, owner_user_id, board_name, board_dscrtn,
                board_order, is_default, share_scope, active_yn
            ) VALUES (%s, %s, %s, %s, 0, FALSE, %s, 'Y')
            RETURNING *
            """,
            (int(project_id), int(user_id), name, dsc, sc),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 3.
def get_board_detail(conn, user_id: int, project_id: int, board_id: int) -> dict:
    b = assert_board_read(conn, user_id, project_id, board_id)
    if not _board_is_active(b):
        raise ValueError("비활성화된 보드입니다. 목록에서 활성화한 뒤 캔버스를 열 수 있습니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT * FROM widget_item
            WHERE widget_board_id = %s AND active_yn = 'Y'
            ORDER BY widget_order ASC NULLS LAST, widget_item_id ASC
            """,
            (board_id,),
        )
        widgets = []
        for row in cur.fetchall():
            w = dict(row)
            dc = w.get("data_config")
            if isinstance(dc, str):
                try:
                    dc = json.loads(dc)
                except json.JSONDecodeError:
                    dc = {}
            if not isinstance(dc, dict):
                dc = {}
            w["data_config"] = dc
            w["layout"] = {
                "i": str(w["widget_item_id"]),
                "x": int(w["layout_x"] or 0),
                "y": int(w["layout_y"] or 0),
                "w": int(w["layout_w"] or 6),
                "h": int(w["layout_h"] or 4),
            }
            widgets.append(w)
        out = dict(b)
        out["widgets"] = widgets
        out["can_edit"] = _can_edit_board(conn, user_id, project_id, b)
        return out
    finally:
        cur.close()


# 4.
def patch_board(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    body: schemas.WidgetBoardPatchBody,
) -> dict:
    b = assert_board_read(conn, user_id, project_id, board_id)
    uid = int(user_id)
    is_owner = int(b["owner_user_id"]) == uid
    active = _board_is_active(b)
    if not active:
        if not is_owner:
            raise ValueError("이 보드를 수정할 권한이 없습니다.")
        if body.board_order is not None or body.is_default is not None or body.share_scope is not None:
            raise ValueError("비활성 보드에서는 이름·설명·활성 여부만 바꿀 수 있습니다.")
    else:
        if not _can_edit_board(conn, uid, project_id, b):
            raise ValueError("이 보드를 수정할 권한이 없습니다.")
        if body.active_yn is not None and not is_owner:
            raise ValueError("소유자만 활성·비활성을 변경할 수 있습니다.")
    fields = []
    params: list[Any] = []
    if body.board_name is not None:
        fields.append("board_name = %s")
        params.append(body.board_name.strip() or "새 보드")
    if body.board_dscrtn is not None:
        fields.append("board_dscrtn = %s")
        params.append(body.board_dscrtn)
    if body.board_order is not None:
        fields.append("board_order = %s")
        params.append(int(body.board_order))
    if body.is_default is not None:
        fields.append("is_default = %s")
        params.append(bool(body.is_default))
    if body.share_scope is not None:
        if not is_owner:
            raise ValueError("소유자만 공유 범위를 변경할 수 있습니다.")
        fields.append("share_scope = %s")
        params.append(_scope(body.share_scope))
    if body.active_yn is not None:
        fields.append("active_yn = %s")
        params.append("Y" if body.active_yn else "N")
    if not fields:
        return get_board_detail(conn, user_id, project_id, board_id)
    fields.append("update_dtm = NOW()")
    params.append(board_id)
    cur = conn.cursor()
    try:
        q = f"UPDATE widget_board SET {', '.join(fields)} WHERE widget_board_id = %s RETURNING *"
        cur.execute(q, params)
        row = cur.fetchone()
        conn.commit()
        if not row:
            raise ValueError("보드를 찾을 수 없습니다.")
        b2 = dict(row)
        if _board_is_active(b2):
            return get_board_detail(conn, user_id, project_id, board_id)
        return dict(b2)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_board(conn, user_id: int, project_id: int, board_id: int) -> None:
    assert_board_owner(conn, user_id, project_id, board_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE widget_board SET active_yn = 'N', update_dtm = NOW()
            WHERE widget_board_id = %s
            """,
            (board_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 5.
def add_widget(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    body: schemas.WidgetItemCreateBody,
) -> dict:
    assert_board_edit(conn, user_id, project_id, board_id)
    title = (body.widget_title or "").strip() or "새 위젯"
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO widget_item (
                widget_board_id, widget_type, widget_title, data_source_type,
                data_source_query, data_source_ref, data_config,
                layout_x, layout_y, layout_w, layout_h, widget_order, create_user_id, active_yn
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, 'Y')
            RETURNING *
            """,
            (
                board_id,
                body.widget_type[:30],
                title[:200],
                body.data_source_type[:20],
                body.data_source_query,
                body.data_source_ref,
                Json(body.data_config or {}),
                int(body.layout_x),
                int(body.layout_y),
                int(body.layout_w),
                int(body.layout_h),
                int(body.widget_order),
                int(user_id),
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def patch_widget(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    widget_id: int,
    body: schemas.WidgetItemPatchBody,
) -> dict:
    assert_board_edit(conn, user_id, project_id, board_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT * FROM widget_item
            WHERE widget_item_id = %s AND widget_board_id = %s AND active_yn = 'Y'
            """,
            (widget_id, board_id),
        )
        if not cur.fetchone():
            raise ValueError("위젯을 찾을 수 없습니다.")
        fields = []
        params: list[Any] = []
        if body.widget_type is not None:
            fields.append("widget_type = %s")
            params.append(body.widget_type[:30])
        if body.widget_title is not None:
            fields.append("widget_title = %s")
            params.append(body.widget_title[:200])
        if body.data_source_type is not None:
            fields.append("data_source_type = %s")
            params.append(body.data_source_type[:20])
        if body.data_source_query is not None:
            fields.append("data_source_query = %s")
            params.append(body.data_source_query)
        if body.data_source_ref is not None:
            fields.append("data_source_ref = %s")
            params.append(body.data_source_ref[:255] if body.data_source_ref else None)
        if body.data_config is not None:
            fields.append("data_config = %s::jsonb")
            params.append(Json(body.data_config))
        for col, val in (
            ("layout_x", body.layout_x),
            ("layout_y", body.layout_y),
            ("layout_w", body.layout_w),
            ("layout_h", body.layout_h),
            ("widget_order", body.widget_order),
        ):
            if val is not None:
                fields.append(f"{col} = %s")
                params.append(int(val))
        if not fields:
            cur.execute(
                "SELECT * FROM widget_item WHERE widget_item_id = %s",
                (widget_id,),
            )
            return dict(cur.fetchone())
        fields.append("update_dtm = NOW()")
        params.extend([widget_id, board_id])
        q = f"UPDATE widget_item SET {', '.join(fields)} WHERE widget_item_id = %s AND widget_board_id = %s RETURNING *"
        cur.execute(q, params)
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_widget(conn, user_id: int, project_id: int, board_id: int, widget_id: int) -> None:
    assert_board_edit(conn, user_id, project_id, board_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE widget_item SET active_yn = 'N', update_dtm = NOW()
            WHERE widget_item_id = %s AND widget_board_id = %s
            """,
            (widget_id, board_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 6.
def patch_layout(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    body: schemas.LayoutPatchBody,
) -> None:
    assert_board_edit(conn, user_id, project_id, board_id)
    cur = conn.cursor()
    try:
        for it in body.items:
            cur.execute(
                """
                UPDATE widget_item
                SET layout_x = %s, layout_y = %s, layout_w = %s, layout_h = %s, update_dtm = NOW()
                WHERE widget_item_id = %s AND widget_board_id = %s AND active_yn = 'Y'
                """,
                (it.layout_x, it.layout_y, it.layout_w, it.layout_h, it.widget_item_id, board_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 7.
def upsert_share(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    body: schemas.ShareUpsertBody,
) -> None:
    b = assert_board_owner(conn, user_id, project_id, board_id)
    if not _board_is_active(b):
        raise ValueError("비활성 보드에는 초대하거나 공유 설정을 바꿀 수 없습니다.")
    if int(body.shared_user_id) == int(user_id):
        raise ValueError("본인에게 공유할 수 없습니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO widget_board_share (widget_board_id, shared_user_id, can_edit)
            VALUES (%s, %s, %s)
            ON CONFLICT (widget_board_id, shared_user_id)
            DO UPDATE SET can_edit = EXCLUDED.can_edit
            """,
            (board_id, int(body.shared_user_id), bool(body.can_edit)),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def send_invite_notifications(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    body: schemas.WidgetBoardInviteBatchBody,
) -> dict[str, Any]:
    """소유자가 프로젝트 참여자에게 위젯 보드 초대 알림을 발송한다(수락 시 share 행 생성)."""
    if not body.invitations:
        raise ValueError("초대할 사용자를 한 명 이상 지정하세요.")
    b = assert_board_owner(conn, user_id, project_id, board_id)
    if not _board_is_active(b):
        raise ValueError("비활성 보드에서는 초대를 보낼 수 없습니다.")
    inviter = int(user_id)
    pid = int(project_id)
    bname = (b.get("board_name") or "").strip() or "위젯 보드"
    cur = conn.cursor()
    sent = 0
    try:
        for it in body.invitations:
            target = int(it.shared_user_id)
            if target == inviter:
                continue
            if not is_project_participant(conn, target, pid):
                continue
            dvsn = get_user_dvsn_lower(conn, target)
            eff = compute_effective_project_permission_ids(conn, target, pid, dvsn)
            if "widgetboard" not in eff:
                continue
            cur.execute(
                """
                SELECT 1 FROM widget_board_share
                WHERE widget_board_id = %s AND shared_user_id = %s
                """,
                (board_id, target),
            )
            if cur.fetchone():
                continue
            if _user_has_pending_widget_invite(cur, target, board_id):
                continue
            invite_expires_at = (
                datetime.now(timezone.utc) + timedelta(days=_INVITE_VALID_DAYS)
            ).isoformat()
            payload = json.dumps(
                {
                    "widget_board_id": int(board_id),
                    "project_info_id": pid,
                    "inviter_user_id": inviter,
                    "can_edit": bool(it.can_edit),
                    "invite_expires_at": invite_expires_at,
                },
                ensure_ascii=False,
            )
            title = (f"'{bname}' 위젯 보드에 초대되었습니다")[:200]
            cur.execute(
                """
                INSERT INTO notification_info (
                    user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
                ) VALUES (%s, %s, %s, %s, 'N', NOW())
                """,
                (target, "widget_board_invite", title, payload),
            )
            sent += 1
        conn.commit()
        return {"sent": sent}
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def accept_widget_board_invite(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    notification_info_id: int,
) -> None:
    uid = int(user_id)
    pid = int(project_id)
    nid = int(notification_info_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT noti_content, noti_type, user_id AS target_uid
            FROM notification_info
            WHERE notification_info_id = %s
            """,
            (nid,),
        )
        noti = cur.fetchone()
        if not noti:
            raise ValueError(
                "이 초대는 취소되었거나 이미 처리되었습니다. 소유자에게 새 초대를 요청하세요."
            )
        if (noti.get("noti_type") or "").strip() != "widget_board_invite":
            raise ValueError("위젯 보드 초대 알림이 아닙니다.")
        if int(noti["target_uid"]) != uid:
            raise ValueError("본인의 알림만 수락할 수 있습니다.")
        payload = json.loads(noti["noti_content"] or "{}")
        wid = int(payload["widget_board_id"])
        if wid != int(board_id):
            raise ValueError("알림과 보드가 일치하지 않습니다.")
        if int(payload.get("project_info_id") or 0) != pid:
            raise ValueError("알림과 프로젝트가 일치하지 않습니다.")
        if _invite_expired_from_payload(payload):
            raise ValueError(
                "초대 유효 기간이 지났습니다. 소유자에게 새 초대를 요청하세요."
            )
        cur.execute(
            "SELECT * FROM widget_board WHERE widget_board_id = %s",
            (board_id,),
        )
        brow = cur.fetchone()
        if not brow:
            raise ValueError("보드를 찾을 수 없습니다.")
        bd = dict(brow)
        if int(bd["project_info_id"]) != pid:
            raise ValueError("보드가 이 프로젝트에 속하지 않습니다.")
        if not _board_is_active(bd):
            raise ValueError("비활성화된 보드입니다. 소유자에게 문의하세요.")
        cur.execute(
            """
            SELECT 1 FROM widget_board_share
            WHERE widget_board_id = %s AND shared_user_id = %s
            """,
            (board_id, uid),
        )
        if cur.fetchone():
            raise ValueError("이미 이 보드에 참여 중입니다.")
        can_edit = bool(payload.get("can_edit"))
        cur.execute(
            """
            INSERT INTO widget_board_share (widget_board_id, shared_user_id, can_edit)
            VALUES (%s, %s, %s)
            ON CONFLICT (widget_board_id, shared_user_id)
            DO UPDATE SET can_edit = EXCLUDED.can_edit
            """,
            (board_id, uid, can_edit),
        )
        cur.execute(
            """
            UPDATE notification_info
            SET read_yn = 'Y', update_dtm = NOW()
            WHERE notification_info_id = %s AND user_id = %s
            """,
            (nid, uid),
        )
        inv_uid = int(payload.get("inviter_user_id") or 0)
        _notify_widget_board_inviter(
            cur,
            inv_uid,
            board_id,
            str(bd.get("board_name") or ""),
            uid,
            nid,
            True,
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except json.JSONDecodeError as e:
        conn.rollback()
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def reject_widget_board_invite(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    notification_info_id: int,
) -> None:
    uid = int(user_id)
    pid = int(project_id)
    nid = int(notification_info_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT noti_content, noti_type, user_id AS target_uid
            FROM notification_info
            WHERE notification_info_id = %s
            """,
            (nid,),
        )
        noti = cur.fetchone()
        if not noti:
            raise ValueError(
                "이 초대는 취소되었거나 이미 처리되었습니다. 소유자에게 새 초대를 요청하세요."
            )
        if (noti.get("noti_type") or "").strip() != "widget_board_invite":
            raise ValueError("위젯 보드 초대 알림이 아닙니다.")
        if int(noti["target_uid"]) != uid:
            raise ValueError("본인의 알림만 거절할 수 있습니다.")
        payload = json.loads(noti["noti_content"] or "{}")
        if int(payload.get("widget_board_id") or 0) != int(board_id):
            raise ValueError("알림과 보드가 일치하지 않습니다.")
        if int(payload.get("project_info_id") or 0) != pid:
            raise ValueError("알림과 프로젝트가 일치하지 않습니다.")
        if _invite_expired_from_payload(payload):
            raise ValueError(
                "초대 유효 기간이 지났습니다. 알림은 삭제하거나 소유자에게 문의하세요."
            )
        cur.execute(
            "SELECT board_name FROM widget_board WHERE widget_board_id = %s",
            (board_id,),
        )
        br = cur.fetchone()
        bname = (dict(br).get("board_name") if br else "") or ""
        inv_uid = int(payload.get("inviter_user_id") or 0)
        cur.execute(
            "DELETE FROM notification_info WHERE notification_info_id = %s",
            (nid,),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("초대 알림을 삭제하지 못했습니다.")
        _notify_widget_board_inviter(
            cur, inv_uid, board_id, str(bname), uid, nid, False
        )
        conn.commit()
    except ValueError:
        conn.rollback()
        raise
    except json.JSONDecodeError as e:
        conn.rollback()
        raise ValueError("알림 내용이 올바르지 않습니다.") from e
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def delete_share(conn, user_id: int, project_id: int, board_id: int, shared_user_id: int) -> None:
    b = assert_board_owner(conn, user_id, project_id, board_id)
    owner_id = int(b["owner_user_id"])
    tu = int(shared_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE widget_item
            SET create_user_id = %s, update_dtm = NOW()
            WHERE widget_board_id = %s
              AND active_yn = 'Y'
              AND create_user_id = %s
            """,
            (owner_id, board_id, tu),
        )
        cur.execute(
            """
            DELETE FROM widget_board_share
            WHERE widget_board_id = %s AND shared_user_id = %s
            """,
            (board_id, tu),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def list_board_participants(
    conn, user_id: int, project_id: int, board_id: int
) -> dict[str, Any]:
    b = assert_board_read(conn, user_id, project_id, board_id)
    cur = conn.cursor()
    items: list[dict[str, Any]] = []
    try:
        o_uid = int(b["owner_user_id"])
        cur.execute(
            "SELECT user_id, user_email, user_nickname FROM user_info WHERE user_id = %s",
            (o_uid,),
        )
        orow = cur.fetchone()
        if orow:
            od = dict(orow)
            items.append(
                {
                    "user_id": od["user_id"],
                    "user_email": od.get("user_email"),
                    "user_nickname": od.get("user_nickname"),
                    "is_owner": True,
                    "can_edit": True,
                }
            )
        cur.execute(
            """
            SELECT s.shared_user_id AS user_id, s.can_edit, u.user_email, u.user_nickname
            FROM widget_board_share s
            JOIN user_info u ON u.user_id = s.shared_user_id
            WHERE s.widget_board_id = %s
            ORDER BY COALESCE(u.user_email, '')
            """,
            (board_id,),
        )
        for row in cur.fetchall():
            rd = dict(row)
            items.append(
                {
                    "user_id": rd["user_id"],
                    "user_email": rd.get("user_email"),
                    "user_nickname": rd.get("user_nickname"),
                    "is_owner": False,
                    "can_edit": bool(rd.get("can_edit")),
                }
            )
        viewer_is_owner = int(b["owner_user_id"]) == int(user_id)
        return {
            "items": items,
            "viewer_is_owner": viewer_is_owner,
        }
    finally:
        cur.close()


def list_invite_candidates(
    conn, user_id: int, project_id: int, board_id: int
) -> dict[str, Any]:
    assert_board_owner(conn, user_id, project_id, board_id)
    pid = int(project_id)
    uid = int(user_id)
    cur = conn.cursor()
    out: list[dict[str, Any]] = []
    try:
        cur.execute(
            """
            SELECT p.ptcpnt_user_id AS user_id, u.user_email, u.user_nickname
            FROM project_ptcpnt_info p
            JOIN user_info u ON u.user_id = p.ptcpnt_user_id
            WHERE p.project_info_id = %s
              AND p.ptcpnt_user_id != %s
            ORDER BY COALESCE(u.user_email, '')
            """,
            (pid, uid),
        )
        for r in cur.fetchall():
            rd = dict(r)
            cand = int(rd["user_id"])
            dvsn = get_user_dvsn_lower(conn, cand)
            eff = compute_effective_project_permission_ids(conn, cand, pid, dvsn)
            if "widgetboard" not in eff:
                continue
            cur.execute(
                """
                SELECT 1 FROM widget_board_share
                WHERE widget_board_id = %s AND shared_user_id = %s
                """,
                (board_id, cand),
            )
            if cur.fetchone():
                continue
            if _user_has_pending_widget_invite(cur, cand, board_id):
                continue
            out.append(
                {
                    "user_id": cand,
                    "user_email": rd.get("user_email"),
                    "user_nickname": rd.get("user_nickname"),
                }
            )
        return {"items": out}
    finally:
        cur.close()


def _allowed_saved_table(project_id: int, table_name: str) -> None:
    ref = (table_name or "").strip()
    if not ref:
        raise ValueError("data_source_ref(테이블명)이 필요합니다.")
    allowed = db.get_allowed_tables_by_project(int(project_id), "main")
    if ref not in allowed:
        if not ref.startswith("test_report_"):
            raise ValueError("프로젝트에 매핑되지 않은 테이블입니다.")
    db.validate_table_name(ref)


# 8.
def fetch_widget_data(
    conn,
    user_id: int,
    project_id: int,
    board_id: int,
    widget_id: int,
) -> dict[str, Any]:
    b = assert_board_read(conn, user_id, project_id, board_id)
    if not _board_is_active(b):
        raise ValueError("비활성화된 보드에서는 위젯 데이터를 불러올 수 없습니다.")
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT * FROM widget_item
            WHERE widget_item_id = %s AND widget_board_id = %s AND active_yn = 'Y'
            """,
            (widget_id, board_id),
        )
        wrow = cur.fetchone()
        if not wrow:
            raise ValueError("위젯을 찾을 수 없습니다.")
        w = dict(wrow)
    finally:
        cur.close()

    wt = (w.get("widget_type") or "").strip().lower()
    if wt == "note":
        return {"columns": [], "rows": []}

    dst = (w.get("data_source_type") or "query").strip().lower()
    limit = _DEFAULT_LIMIT
    dc = w.get("data_config")
    if isinstance(dc, str):
        try:
            dc = json.loads(dc)
        except json.JSONDecodeError:
            dc = {}
    if isinstance(dc, dict) and dc.get("limit"):
        try:
            limit = min(5000, max(1, int(dc["limit"])))
        except (TypeError, ValueError):
            limit = _DEFAULT_LIMIT

    if dst == "saved_table":
        ref = w.get("data_source_ref") or ""
        _allowed_saved_table(project_id, ref)
        schema = db.get_table_schema()
        dc_dict = dc if isinstance(dc, dict) else {}
        ds = _parse_iso_date_dc(dc_dict.get("dateStart"))
        de = _parse_iso_date_dc(dc_dict.get("dateEnd"))
        use_dates = ds is not None and de is not None
        if use_dates:
            grain = str(dc_dict.get("dateGrain") or "day").strip().lower()
            _validate_date_span_for_grain(ds, de, grain)
            dcol = _resolve_widget_date_column(ref, dc_dict)
            if not dcol:
                raise ValueError(
                    "기간 필터를 적용할 날짜/시간 컬럼이 없습니다. data_config.dateColumn 을 지정하세요."
                )
        else:
            dcol = None

        mconn = db.get_db_connection()
        try:
            mcur = mconn.cursor(cursor_factory=RealDictCursor)
            try:
                base = psql.SQL("SELECT * FROM {}.{} ").format(
                    psql.Identifier(schema),
                    psql.Identifier(ref),
                )
                if use_dates and dcol:
                    col = psql.Identifier(dcol)
                    wh = psql.Composed(
                        [
                            psql.SQL("WHERE "),
                            col,
                            psql.SQL("::date >= %s AND "),
                            col,
                            psql.SQL("::date <= %s "),
                        ]
                    )
                    q = psql.Composed([base, wh, psql.SQL("LIMIT %s")])
                    mcur.execute(q, (ds, de, limit))
                else:
                    q = psql.Composed([base, psql.SQL("LIMIT %s")])
                    mcur.execute(q, (limit,))
                rows = mcur.fetchall()
                cols = [d[0] for d in mcur.description] if mcur.description else []
            finally:
                mcur.close()
        finally:
            mconn.close()
        return {
            "columns": [{"name": c} for c in cols],
            "rows": [{k: db.format_value(v) for k, v in dict(r).items()} for r in rows],
        }

    if dst == "query":
        qtext = w.get("data_source_query") or ""
        bad = contains_dangerous_sql(qtext)
        if bad:
            raise ValueError(f"허용되지 않는 SQL입니다: {bad}")
        if not str(qtext).strip().lower().startswith("select"):
            raise ValueError("SELECT 문만 허용됩니다.")
        mconn = db.get_db_connection()
        try:
            mcur = mconn.cursor(cursor_factory=RealDictCursor)
            try:
                qt = qtext.strip().rstrip(";")
                mcur.execute(f"SELECT * FROM ({qt}) AS _wb_sub LIMIT %s", (limit,))
                rows = mcur.fetchall()
                cols = [d[0] for d in mcur.description] if mcur.description else []
            finally:
                mcur.close()
        finally:
            mconn.close()
        return {
            "columns": [{"name": c} for c in cols],
            "rows": [{k: db.format_value(v) for k, v in dict(r).items()} for r in rows],
        }

    if dst == "campaign_dash":
        raise ValueError("campaign_dash 데이터 소스는 아직 지원하지 않습니다.")

    raise ValueError(f"지원하지 않는 data_source_type 입니다: {dst}")
