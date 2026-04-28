"""
Backend.system_log_server.service (system_log 목록 조회)
======================================================
부서 트리 스코프(sa/sa_dev/a)·필터·페이징. admin_server.service_projects 의 부서 재귀와 동일 규칙.

[Main Functions]
===========
1. `# 1.` _build_system_log_where — 목록·CSV 공통 WHERE(sl 별칭)
2. `# 2.` list_system_logs_paged — GET /api/system-logs 비즈니스 조회(정렬 `sort_by`·`sort_dir`, `actor_user_email` 조인·`has_scoped_change_logs` EXISTS)
3. `# 3.` export_system_logs_csv_bytes — 동일 필터·정렬·최대 `MAX_CSV_EXPORT_ROWS` 행 UTF-8 CSV(BOM, 화면 9열·일시 다음 UUID)
4. _dcl_filter_where_params — `data_change_log` 목록·CSV 공통 WHERE(`dcl.` 접두; 스코프·테이블·PK·채널·기간)
5. `# 4.` get_change_logs_by_system_log_id — `system_log_id` 가시 범위·`request_correlation_id` 로 연결된 변경 로그(`user_info`·`project_info` 조인으로 이메일·프로젝트명)
6. `# 6.` list_data_change_logs_paged — GET `/api/system-logs/change-logs` 페이징(동일 조인, `_dcl_filter_where_params` 사용)
7. `# 7.` export_data_change_logs_csv_bytes — 변경 이력 CSV(동일 필터·BOM·행 상한·일시 다음 UUID, JSON 열 3개)

[Endpoints/Classes/Functions]
=======================
- _build_system_log_where(actor, …) → (where_sql, params)
- _dcl_filter_where_params(actor, …) → (wcomb, params) — dcl. 접두
- list_system_logs_paged(conn, actor, …) → dict (total, items, page, page_size)
- export_system_logs_csv_bytes(conn, actor, …) → (row_count, bytes)
- list_data_change_logs_paged, export_data_change_logs_csv_bytes(conn, actor, …) → (row_count, bytes)
- _system_log_order_sql·_format_system_log_detail_for_csv·_csv_dtm_display·_dcl_json_for_csv_cell 등

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

_SYSTEM_LOG_CSV_UI_HEADERS = ("일시", "UUID", "페이지", "행위", "상태", "사용자", "IP", "SQL 지문", "상세내용")

_DATA_CHANGE_LOG_CSV_UI_HEADERS = (
    "일시",
    "UUID",
    "카테고리",
    "대상 테이블",
    "행위",
    "PK",
    "사용자(이메일)",
    "프로젝트",
    "변경_필드_JSON",
    "이전_데이터_JSON",
    "변경_데이터_JSON",
)

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


def _csv_uuid_display(val: Any) -> str:
    """통합 이력 화면·CSV: 상관 UUID 없으면 —."""
    if val is None:
        return "—"
    s = str(val).strip()
    return s if s else "—"


_SL_RECURSIVE_SUBTREE = """
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
                INNER JOIN {_SL_RECURSIVE_SUBTREE} scope ON scope.dptmt_info_id = u_scope.dptmt_info_id
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


# `data_change_log` 액터 범위 — `actor_user_id`에 대해 `list_system_logs`와 동일 부서 서브트리 CTE
def _build_data_change_log_scope_where(
    actor: dict[str, Any],
) -> tuple[str, list[Any]]:
    dpt = int(actor["dptmt_info_id"])
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    full_access = dvsn == "sa_dev"
    if full_access:
        return "TRUE", []
    return (
        f"""
        dcl.actor_user_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM user_info u_scope
            INNER JOIN {_SL_RECURSIVE_SUBTREE} scope ON scope.dptmt_info_id = u_scope.dptmt_info_id
            WHERE u_scope.user_id = dcl.actor_user_id
              AND UPPER(TRIM(COALESCE(u_scope.user_active_yn, 'Y'))) = 'Y'
        )
        """,
        [dpt],
    )


def _dcl_table_filter_safe(v: str | None) -> str | None:
    if v is None or not str(v).strip():
        return None
    t = str(v).strip()[:80]
    if not all(c.isalnum() or c == "_" for c in t):
        return None
    return t


def _dcl_filter_where_params(
    actor: dict[str, Any],
    *,
    target_table: str | None,
    target_pk_value: str | None,
    channel: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
) -> tuple[str, list[Any]]:
    """`data_change_log` 목록·CSV 공통 WHERE — `list_data_change_logs_paged` 와 동일 필터(`dcl.` 접두)."""
    scope_sql, p_scope = _build_data_change_log_scope_where(actor)
    extra_where: list[str] = [f"({scope_sql})"]
    params: list[Any] = list(p_scope)

    ttf = _dcl_table_filter_safe(target_table)
    if ttf is not None:
        extra_where.append("dcl.target_table = %s")
        params.append(ttf)
    if target_pk_value is not None and str(target_pk_value).strip():
        extra_where.append("dcl.target_pk_value = %s")
        params.append(str(target_pk_value).strip()[:128])
    if channel is not None and str(channel).strip():
        extra_where.append("dcl.channel LIKE %s")
        params.append(f"%{str(channel).strip()[:40]}%")

    if from_dtm is not None:
        extra_where.append("dcl.created_at >= %s")
        params.append(datetime.combine(from_dtm, time.min))
    if to_dtm is not None:
        end_excl = datetime.combine(to_dtm + timedelta(days=1), time.min)
        extra_where.append("dcl.created_at < %s")
        params.append(end_excl)

    wcomb = " AND ".join(extra_where) if extra_where else "TRUE"
    return wcomb, params


def _dcl_json_for_csv_cell(val: Any) -> str:
    """CSV JSON 열: None → 빈 문자열; dict·list·기타 JSON 가능 값은 `json.dumps`(compact)."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False, separators=(",", ":"))
    try:
        return json.dumps(val, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return str(val)


# 4.
def get_change_logs_by_system_log_id(
    conn: Any,
    actor: dict[str, Any],
    system_log_id: int,
) -> list[dict[str, Any]] | None:
    """
    `system_log` 한 건이 액터에게 조회 가능할 때, 동일 `request_correlation_id`의 `data_change_log` (스코프 적용).
    권한 없음·없는 행이면 None. correlation NULL이면 빈 리스트.
    """
    where_sl, p_sl = _build_system_log_where(
        actor,
        user_key=None,
        from_dtm=None,
        to_dtm=None,
        ip_contains=None,
        channel=None,
        action_kind=None,
        success_yn=None,
    )
    cur = conn.cursor()
    try:
        sql = f"""
            SELECT sl.request_correlation_id
            FROM system_log sl
            {_JOIN_ACTOR_USER}
            WHERE {where_sl} AND sl.system_log_id = %s
        """
        p = list(p_sl) + [int(system_log_id)]
        cur.execute(sql, p)
        srow = cur.fetchone()
        if not srow:
            return None
        rc = srow.get("request_correlation_id")
        if rc is None:
            return []

        scope_sql, p_scope = _build_data_change_log_scope_where(actor)
        p2 = [rc] + list(p_scope)
        cur.execute(
            f"""
            SELECT
                dcl.change_log_id,
                dcl.correlation_id,
                dcl.actor_user_id,
                actor_u.user_email AS actor_user_email,
                dcl.project_info_id,
                pi.project_name AS project_name,
                dcl.target_table,
                dcl.target_pk_column,
                dcl.target_pk_value,
                dcl.operation,
                dcl.old_data,
                dcl.new_data,
                dcl.changed_fields,
                dcl.channel,
                dcl.created_at
            FROM data_change_log dcl
            LEFT JOIN user_info actor_u ON actor_u.user_id = dcl.actor_user_id
            LEFT JOIN project_info pi ON pi.project_info_id = dcl.project_info_id
            WHERE dcl.correlation_id = %s
              AND ({scope_sql})
            ORDER BY dcl.change_log_id ASC
            """,
            p2,
        )
        return _dcl_rows_to_items(cur.fetchall() or [])
    except Exception:
        logger.exception(
            "get_change_logs_by_system_log_id failed actor=%s id=%s",
            actor.get("user_id"),
            system_log_id,
        )
        raise
    finally:
        cur.close()


def _dcl_rows_to_items(rows: list[Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r) if not isinstance(r, dict) else {**r}
        cid = d.get("correlation_id")
        if cid is not None:
            d["correlation_id"] = str(cid)
        for jk in ("old_data", "new_data", "changed_fields"):
            jv = d.get(jk)
            if jv is not None and not isinstance(jv, dict):
                try:
                    d[jk] = dict(jv) if hasattr(jv, "keys") else {}
                except Exception:
                    d[jk] = {}
        items.append(d)
    return items


# 6.
def list_data_change_logs_paged(
    conn: Any,
    actor: dict[str, Any],
    *,
    target_table: str | None,
    target_pk_value: str | None,
    channel: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    page = max(1, int(page))
    page_size = min(200, max(1, int(page_size)))
    offset = (page - 1) * page_size

    wcomb, params = _dcl_filter_where_params(
        actor,
        target_table=target_table,
        target_pk_value=target_pk_value,
        channel=channel,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
    )

    base_from = f"""FROM data_change_log dcl
            LEFT JOIN user_info actor_u ON actor_u.user_id = dcl.actor_user_id
            LEFT JOIN project_info pi ON pi.project_info_id = dcl.project_info_id
            WHERE {wcomb}"""
    count_sql = f"SELECT COUNT(*)::bigint AS c FROM data_change_log dcl WHERE {wcomb}"
    list_sql = f"""
        SELECT
            dcl.change_log_id,
            dcl.correlation_id,
            dcl.actor_user_id,
            actor_u.user_email AS actor_user_email,
            dcl.project_info_id,
            pi.project_name AS project_name,
            dcl.target_table,
            dcl.target_pk_column,
            dcl.target_pk_value,
            dcl.operation,
            dcl.old_data,
            dcl.new_data,
            dcl.changed_fields,
            dcl.channel,
            dcl.created_at
        {base_from}
        ORDER BY dcl.created_at DESC, dcl.change_log_id DESC
        LIMIT %s OFFSET %s
    """

    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0
        list_params = list(params) + [page_size, offset]
        cur.execute(list_sql, list_params)
        return {
            "items": _dcl_rows_to_items(cur.fetchall() or []),
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception:
        logger.exception("list_data_change_logs_paged failed actor=%s", actor.get("user_id"))
        raise
    finally:
        cur.close()


# 7.
def export_data_change_logs_csv_bytes(
    conn: Any,
    actor: dict[str, Any],
    *,
    target_table: str | None,
    target_pk_value: str | None,
    channel: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
) -> tuple[int, bytes]:
    """
    GET change-logs/export.csv 와 동일 필터. COUNT 초과 시 ValueError
    (`CSV_EXPORT_ROW_LIMIT_EXCEEDED:총건수:상한`). UTF-8 CSV(BOM), 일시는 `_csv_dtm_display`.
    """
    wcomb, params = _dcl_filter_where_params(
        actor,
        target_table=target_table,
        target_pk_value=target_pk_value,
        channel=channel,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
    )
    count_sql = f"SELECT COUNT(*)::bigint AS c FROM data_change_log dcl WHERE {wcomb}"
    export_sql = f"""
        SELECT
            dcl.created_at,
            dcl.correlation_id,
            dcl.channel,
            dcl.target_table,
            dcl.operation,
            dcl.target_pk_value,
            actor_u.user_email AS actor_user_email,
            pi.project_name AS project_name,
            dcl.old_data,
            dcl.new_data,
            dcl.changed_fields
        FROM data_change_log dcl
        LEFT JOIN user_info actor_u ON actor_u.user_id = dcl.actor_user_id
        LEFT JOIN project_info pi ON pi.project_info_id = dcl.project_info_id
        WHERE {wcomb}
        ORDER BY dcl.created_at DESC, dcl.change_log_id DESC
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
            w.writerow(list(_DATA_CHANGE_LOG_CSV_UI_HEADERS))
            raw = "\ufeff" + buf.getvalue()
            return 0, raw.encode("utf-8")

        qparams = list(params)
        qparams.append(lim)
        cur.execute(export_sql, qparams)
        rows = cur.fetchall() or []
        buf = io.StringIO()
        wr = csv.writer(buf)
        wr.writerow(list(_DATA_CHANGE_LOG_CSV_UI_HEADERS))
        for r in rows:
            d = dict(r)
            cid = d.get("correlation_id")
            if cid is not None:
                d["correlation_id"] = str(cid)
            wr.writerow(
                [
                    _csv_dtm_display(d.get("created_at")),
                    _csv_uuid_display(d.get("correlation_id")),
                    d.get("channel") or "—",
                    d.get("target_table") or "—",
                    d.get("operation") or "—",
                    d.get("target_pk_value") or "—",
                    d.get("actor_user_email") or "—",
                    d.get("project_name") or "—",
                    _dcl_json_for_csv_cell(d.get("changed_fields")),
                    _dcl_json_for_csv_cell(d.get("old_data")),
                    _dcl_json_for_csv_cell(d.get("new_data")),
                ]
            )
        raw = "\ufeff" + buf.getvalue()
        return len(rows), raw.encode("utf-8")
    except ValueError:
        raise
    except Exception:
        logger.exception(
            "export_data_change_logs_csv_bytes failed actor=%s", actor.get("user_id")
        )
        raise
    finally:
        cur.close()


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
    scope_dcl_sql, p_scope_dcl = _build_data_change_log_scope_where(actor)
    has_dcl_exists_sql = f"""(SELECT EXISTS (
        SELECT 1 FROM data_change_log dcl
        WHERE dcl.correlation_id = sl.request_correlation_id
          AND ({scope_dcl_sql})
    )) AS has_scoped_change_logs"""
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
            sl.detail_json,
            {has_dcl_exists_sql}
        {base_from}
        {order_sql}
        LIMIT %s OFFSET %s
    """

    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0

        list_params = list(p_scope_dcl) + list(params) + [page_size, offset]
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
            d["has_scoped_change_logs"] = bool(d.get("has_scoped_change_logs"))
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
    목록 API와 동일 필터·정렬로 CSV. 헤더·셀 값은 사용자 이력 화면(시스템 탭)과 동일 규칙(일시 다음 UUID).
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
            sl.request_correlation_id,
            sl.channel,
            sl.action_kind,
            sl.success_yn,
            sl.actor_user_id,
            actor_u.user_email AS actor_user_email,
            sl.client_ip_masked,
            sl.sql_fingerprint,
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
            rid = d.get("request_correlation_id")
            if rid is not None:
                d["request_correlation_id"] = str(rid)
            w.writerow(
                [
                    _csv_dtm_display(d.get("create_dtm")),
                    _csv_uuid_display(d.get("request_correlation_id")),
                    d.get("channel") or "—",
                    d.get("action_kind") or "—",
                    _csv_success_yn_display(d.get("success_yn")),
                    _csv_actor_user_display(d),
                    d.get("client_ip_masked") or "—",
                    d.get("sql_fingerprint") or "—",
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
