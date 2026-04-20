"""
Backend.system_log_server.service (system_log 목록 조회)
======================================================
부서 트리 스코프(sa/sa_dev/a)·필터·페이징. admin_server.service_projects 의 부서 재귀와 동일 규칙.

[Main Functions]
===========
1. list_system_logs_paged: GET /api/system-logs 비즈니스 조회

[Endpoints/Classes/Functions]
=======================
- list_system_logs_paged(conn, actor, …) → dict (total, items, page, page_size)

[Dependencies]
=========
- datetime, typing
- Backend.core.user_dvsn_codes.canon_user_dvsn
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from Backend.core.user_dvsn_codes import canon_user_dvsn

logger = logging.getLogger(__name__)

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


# 1.
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
) -> dict[str, Any]:
    """
    system_log 목록. 기본 정렬 create_dtm DESC.
    sa_dev: 전체. sa/a: actor_user_id 가 액터 부서 서브트리에 속한 활성 사용자인 행만(NULL actor 제외).
    """
    dpt = int(actor["dptmt_info_id"])
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    full_access = dvsn == "sa_dev"

    page = max(1, int(page))
    page_size = min(200, max(1, int(page_size)))
    offset = (page - 1) * page_size

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

    base_from = f"FROM system_log sl WHERE {where_sql}"

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"

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
        ORDER BY sl.create_dtm DESC, sl.system_log_id DESC
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
