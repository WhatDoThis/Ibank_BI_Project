"""
Backend.system_log_server.service (system_log 목록 조회)
======================================================
부서 트리 스코프(sa/sa_dev/a)·필터·페이징. admin_server.service_projects 의 부서 재귀와 동일 규칙.

[Main Functions]
===========
1. list_system_logs_paged: GET /api/system-logs 비즈니스 조회(정렬 `sort_by`·`sort_dir`)
2. export_system_logs_csv_bytes: 목록과 동일 필터·정렬·최대 `MAX_CSV_EXPORT_ROWS` 행 UTF-8 CSV(BOM)

[Endpoints/Classes/Functions]
=======================
- list_system_logs_paged(conn, actor, …) → dict (total, items, page, page_size)
- export_system_logs_csv_bytes(conn, actor, …) → (row_count, bytes)
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
        where.append("sl.channel = %s")
        params.append(str(channel).strip()[:40])

    if action_kind and str(action_kind).strip():
        where.append("sl.action_kind = %s")
        params.append(str(action_kind).strip()[:20])

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

    base_from = f"FROM system_log sl WHERE {where_sql}"

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"

    order_sql = _system_log_order_sql(sort_by, sort_dir)
    list_sql = f"""
        SELECT
            sl.system_log_id,
            sl.create_dtm,
            sl.actor_user_id,
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
    목록 API와 동일 필터·정렬로 CSV. COUNT > MAX_CSV_EXPORT_ROWS 이면 ValueError
    (`CSV_EXPORT_ROW_LIMIT_EXCEEDED:총건수:상한`).
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
    base_from = f"FROM system_log sl WHERE {where_sql}"
    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    order_sql = _system_log_order_sql(sort_by, sort_dir)
    export_sql = f"""
        SELECT
            sl.system_log_id,
            sl.create_dtm,
            sl.actor_user_id,
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
            w.writerow(
                [
                    "system_log_id",
                    "create_dtm",
                    "actor_user_id",
                    "request_correlation_id",
                    "client_ip_masked",
                    "user_agent_summary",
                    "channel",
                    "action_kind",
                    "business_action",
                    "db_target",
                    "schema_name",
                    "table_name",
                    "resource_name",
                    "rows_affected",
                    "success_yn",
                    "http_status",
                    "error_code",
                    "sql_fingerprint",
                    "sql_template_key",
                    "risk_tier",
                    "target_summary",
                    "detail_json",
                ]
            )
            raw = "\ufeff" + buf.getvalue()
            return 0, raw.encode("utf-8")

        qparams = list(params)
        qparams.append(lim)
        cur.execute(export_sql, qparams)
        rows = cur.fetchall() or []
        buf = io.StringIO()
        w = csv.writer(buf)
        headers = [
            "system_log_id",
            "create_dtm",
            "actor_user_id",
            "request_correlation_id",
            "client_ip_masked",
            "user_agent_summary",
            "channel",
            "action_kind",
            "business_action",
            "db_target",
            "schema_name",
            "table_name",
            "resource_name",
            "rows_affected",
            "success_yn",
            "http_status",
            "error_code",
            "sql_fingerprint",
            "sql_template_key",
            "risk_tier",
            "target_summary",
            "detail_json",
        ]
        w.writerow(headers)
        for r in rows:
            d = dict(r)
            rid = d.get("request_correlation_id")
            if rid is not None:
                d["request_correlation_id"] = str(rid)
            cd = d.get("create_dtm")
            cd_out = cd.isoformat() if hasattr(cd, "isoformat") else (cd or "")
            dj = d.get("detail_json")
            if isinstance(dj, dict):
                dj_out = json.dumps(dj, ensure_ascii=False)
            else:
                try:
                    dj_out = json.dumps(dict(dj), ensure_ascii=False) if dj is not None else ""
                except Exception:
                    dj_out = str(dj) if dj is not None else ""
            w.writerow(
                [
                    d.get("system_log_id"),
                    cd_out,
                    d.get("actor_user_id"),
                    d.get("request_correlation_id"),
                    d.get("client_ip_masked"),
                    d.get("user_agent_summary"),
                    d.get("channel"),
                    d.get("action_kind"),
                    d.get("business_action"),
                    d.get("db_target"),
                    d.get("schema_name"),
                    d.get("table_name"),
                    d.get("resource_name"),
                    d.get("rows_affected"),
                    d.get("success_yn"),
                    d.get("http_status"),
                    d.get("error_code"),
                    d.get("sql_fingerprint"),
                    d.get("sql_template_key"),
                    d.get("risk_tier"),
                    d.get("target_summary"),
                    dj_out,
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
