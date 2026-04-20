"""
Backend.system_log_server.service (system_log 목록 조회)
======================================================
부서 트리 스코프(sa/sa_dev/a)·필터·페이징. admin_server.service_projects 의 부서 재귀와 동일 규칙.

[Main Functions]
===========
1. list_system_logs_paged: GET /api/system-logs 비즈니스 조회(정렬 `sort_by`·`sort_dir`, `actor_user_email` 은 user_info 조인)
2. export_system_logs_csv_bytes: 목록과 동일 필터·정렬·최대 `MAX_CSV_EXPORT_ROWS` 행 UTF-8 CSV(BOM, 화면 테이블과 동일 한글 헤더·셀 표기)

[Endpoints/Classes/Functions]
=======================
- list_system_logs_paged(conn, actor, …) → dict (total, items, page, page_size)
- export_system_logs_csv_bytes(conn, actor, …) → (row_count, bytes) 화면 7열 CSV(일시~IP·상세)
- _format_system_log_detail_for_csv·_csv_dtm_display 등 CSV 표시 헬퍼
- _build_system_log_where(actor, …) → (where_sql, params)
- _system_log_order_sql(sort_by, sort_dir) → ORDER BY 절

[Dependencies]
=========
- csv, io, json, logging, datetime, typing
- Backend.core.user_dvsn_codes.canon_user_dvsn
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from Backend.core.user_dvsn_codes import canon_user_dvsn

logger = logging.getLogger(__name__)

MAX_CSV_EXPORT_ROWS = 50_000

_SYSTEM_LOG_CSV_UI_HEADERS = ("일시", "페이지", "행위", "상태", "사용자", "IP", "상세내용")

# system_log 목록·CSV: 행위자 이메일 표시용 user_info 조인(1:1).
_JOIN_ACTOR_USER = "LEFT JOIN user_info actor_u ON actor_u.user_id = sl.actor_user_id"

_SYSTEM_LOG_SORT_COLUMNS: dict[str, str] = {
    "create_dtm": "sl.create_dtm",
    "system_log_id": "sl.system_log_id",
    "channel": "sl.channel",
    "action_kind": "sl.action_kind",
    "success_yn": "sl.success_yn",
    "actor_user_id": "sl.actor_user_id",
}


def _system_log_order_sql(sort_by: str | None, sort_dir: str | None) -> str:
    """목록·CSV 공통 ORDER BY. 컬럼·방향은 화이트리스트만 허용."""
    key = (sort_by or "create_dtm").strip().lower()
    if key not in _SYSTEM_LOG_SORT_COLUMNS:
        key = "create_dtm"
    d = (sort_dir or "desc").strip().lower()
    if d not in ("asc", "desc"):
        d = "desc"
    primary = _SYSTEM_LOG_SORT_COLUMNS[key]
    d_up = d.upper()
    id_dir = "ASC" if d == "asc" else "DESC"
    return f"ORDER BY {primary} {d_up}, sl.system_log_id {id_dir}"


def _csv_dtm_display(cd: Any) -> str:
    """통합 이력 CSV·화면 정합: 일시 `YYYY-MM-DD HH:MM:SS`."""
    if cd is None:
        return ""
    if hasattr(cd, "strftime"):
        try:
            return cd.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return str(cd)


def _csv_success_yn_display(yn: Any) -> str:
    u = str(yn or "").strip().upper()
    if u == "Y":
        return "성공"
    if u == "N":
        return "실패"
    return "—"


def _shorten_json_str_for_csv(obj: Any, max_len: int = 240) -> str:
    try:
        if obj is None:
            s = "{}"
        elif isinstance(obj, dict):
            s = json.dumps(obj, ensure_ascii=False)
        else:
            s = json.dumps(dict(obj), ensure_ascii=False)
    except Exception:
        s = str(obj) if obj is not None else ""
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _format_system_log_detail_for_csv(d: dict[str, Any]) -> str:
    """프론트 `formatSystemDetailCell` 과 동일(기능·/ 상세·JSON truncate 240)."""
    parts = [
        str(d.get("target_summary") or "").strip(),
        str(d.get("sql_template_key") or "").strip(),
        str(d.get("business_action") or "").strip(),
    ]
    parts = [p for p in parts if p]
    summary = " · ".join(parts) if parts else "—"
    detail = _shorten_json_str_for_csv(d.get("detail_json"), 240)
    return f"기능: {summary} / 상세: {detail}"


def _csv_actor_user_display(d: dict[str, Any]) -> str:
    em = d.get("actor_user_email")
    if em:
        return str(em)
    aid = d.get("actor_user_id")
    if aid is not None:
        return str(aid)
    return "—"


_RECURSIVE_SUBTREE = """
(
    WITH RECURSIVE sub AS (
        SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s
        UNION ALL
        SELECT d.dptmt_info_id
        FROM dptmt_info d
        INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
    )
    SELECT dptmt_info_id FROM sub
)
"""


# 1. [필터 WHERE]
# channel·action_kind: UI `contains` 와 동일하게 LIKE(양끝 %).
def _build_system_log_where(
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    channel: str | None,
    action_kind: str | None,
    success_yn: str | None,
) -> tuple[str, list[Any]]:
    """system_log 목록·CSV 공통 WHERE(sl 별칭)."""
    dpt = int(actor["dptmt_info_id"])
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    full_access = dvsn == "sa_dev"

    where: list[str] = []
    params: list[Any] = []

    if not full_access:
        where.append(
            f"""
            sl.actor_user_id IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM user_info u_scope
                INNER JOIN {_RECURSIVE_SUBTREE} scope ON scope.dptmt_info_id = u_scope.dptmt_info_id
                WHERE u_scope.user_id = sl.actor_user_id
                  AND UPPER(TRIM(COALESCE(u_scope.user_active_yn, 'Y'))) = 'Y'
            )
            """
        )
        params.append(dpt)

    if user_key and str(user_key).strip():
        pat = f"%{str(user_key).strip()}%"
        where.append(
            """
            (
                CAST(sl.actor_user_id AS TEXT) LIKE %s
                OR EXISTS (
                    SELECT 1 FROM user_info uk
                    WHERE uk.user_id = sl.actor_user_id
                      AND LOWER(COALESCE(uk.user_email, '')) LIKE LOWER(%s)
                )
            )
            """
        )
        params.extend([pat, pat])

    if from_dtm is not None:
        where.append("sl.create_dtm >= %s")
        params.append(datetime.combine(from_dtm, time.min))

    if to_dtm is not None:
        end_excl = datetime.combine(to_dtm + timedelta(days=1), time.min)
        where.append("sl.create_dtm < %s")
        params.append(end_excl)

    if ip_contains and str(ip_contains).strip():
        where.append("sl.client_ip_masked LIKE %s")
        params.append(f"%{str(ip_contains).strip()}%")

    if channel and str(channel).strip():
        where.append("sl.channel LIKE %s")
        params.append(f"%{str(channel).strip()[:40]}%")

    if action_kind and str(action_kind).strip():
        where.append("sl.action_kind LIKE %s")
        params.append(f"%{str(action_kind).strip()[:20]}%")

    if success_yn and str(success_yn).strip():
        yn = str(success_yn).strip().upper()[:1]
        if yn in ("Y", "N"):
            where.append("UPPER(TRIM(sl.success_yn)) = %s")
            params.append(yn)

    where_sql = " AND ".join(where) if where else "TRUE"
    return where_sql, params


# 2.
def list_system_logs_paged(
    conn,
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    page: int,
    page_size: int,
    channel: str | None,
    action_kind: str | None,
    success_yn: str | None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
) -> dict[str, Any]:
    """
    system_log 목록. 정렬은 `sort_by`·`sort_dir`(기본 create_dtm desc).
    sa_dev: 전체. sa/a: actor_user_id 가 액터 부서 서브트리에 속한 활성 사용자인 행만(NULL actor 제외).
    """
    page = max(1, int(page))
    page_size = min(200, max(1, int(page_size)))
    offset = (page - 1) * page_size

    where_sql, params = _build_system_log_where(
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        channel=channel,
        action_kind=action_kind,
        success_yn=success_yn,
    )

    base_from = f"FROM system_log sl {_JOIN_ACTOR_USER} WHERE {where_sql}"

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"

    order_sql = _system_log_order_sql(sort_by, sort_dir)
    list_sql = f"""
        SELECT
            sl.system_log_id,
            sl.create_dtm,
            sl.actor_user_id,
            actor_u.user_email AS actor_user_email,
            sl.request_correlation_id,
            sl.client_ip_masked,
            sl.user_agent_summary,
            sl.channel,
            sl.action_kind,
            sl.business_action,
            sl.db_target,
            sl.schema_name,
            sl.table_name,
            sl.resource_name,
            sl.rows_affected,
            sl.success_yn,
            sl.http_status,
            sl.error_code,
            sl.sql_fingerprint,
            sl.sql_template_key,
            sl.risk_tier,
            sl.target_summary,
            sl.detail_json
        {base_from}
        {order_sql}
        LIMIT %s OFFSET %s
    """

    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0

        list_params = list(params)
        list_params.extend([page_size, offset])
        cur.execute(list_sql, list_params)
        rows = cur.fetchall() or []
        items: list[dict[str, Any]] = []
        for r in rows:
            d = dict(r)
            rid = d.get("request_correlation_id")
            if rid is not None:
                d["request_correlation_id"] = str(rid)
            dj = d.get("detail_json")
            if dj is not None and not isinstance(dj, dict):
                try:
                    d["detail_json"] = dict(dj) if hasattr(dj, "keys") else {}
                except Exception:
                    d["detail_json"] = {}
            items.append(d)
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except Exception:
        logger.exception("list_system_logs_paged failed actor_user_id=%s", actor.get("user_id"))
        raise
    finally:
        cur.close()


# 3.
def export_system_logs_csv_bytes(
    conn,
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    channel: str | None,
    action_kind: str | None,
    success_yn: str | None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
) -> tuple[int, bytes]:
    """
    목록 API와 동일 필터·정렬로 CSV. 헤더·셀 값은 사용자 이력 화면(시스템 탭)과 동일 규칙.
    COUNT > MAX_CSV_EXPORT_ROWS 이면 ValueError (`CSV_EXPORT_ROW_LIMIT_EXCEEDED:총건수:상한`).
    """
    where_sql, params = _build_system_log_where(
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
        channel=channel,
        action_kind=action_kind,
        success_yn=success_yn,
    )
    base_from = f"FROM system_log sl {_JOIN_ACTOR_USER} WHERE {where_sql}"
    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    order_sql = _system_log_order_sql(sort_by, sort_dir)
    export_sql = f"""
        SELECT
            sl.create_dtm,
            sl.channel,
            sl.action_kind,
            sl.success_yn,
            sl.actor_user_id,
            actor_u.user_email AS actor_user_email,
            sl.client_ip_masked,
            sl.target_summary,
            sl.sql_template_key,
            sl.business_action,
            sl.detail_json
        {base_from}
        {order_sql}
        LIMIT %s
    """
    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0
        if total > MAX_CSV_EXPORT_ROWS:
            raise ValueError(
                f"CSV_EXPORT_ROW_LIMIT_EXCEEDED:{total}:{MAX_CSV_EXPORT_ROWS}"
            )
        lim = min(total, MAX_CSV_EXPORT_ROWS) if total > 0 else 0
        if lim == 0:
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(list(_SYSTEM_LOG_CSV_UI_HEADERS))
            raw = "\ufeff" + buf.getvalue()
            return 0, raw.encode("utf-8")

        qparams = list(params)
        qparams.append(lim)
        cur.execute(export_sql, qparams)
        rows = cur.fetchall() or []
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(list(_SYSTEM_LOG_CSV_UI_HEADERS))
        for r in rows:
            d = dict(r)
            w.writerow(
                [
                    _csv_dtm_display(d.get("create_dtm")),
                    d.get("channel") or "—",
                    d.get("action_kind") or "—",
                    _csv_success_yn_display(d.get("success_yn")),
                    _csv_actor_user_display(d),
                    d.get("client_ip_masked") or "—",
                    _format_system_log_detail_for_csv(d),
                ]
            )
        raw = "\ufeff" + buf.getvalue()
        return len(rows), raw.encode("utf-8")
    except ValueError:
        raise
    except Exception:
        logger.exception("export_system_logs_csv_bytes failed actor_user_id=%s", actor.get("user_id"))
        raise
    finally:
        cur.close()
