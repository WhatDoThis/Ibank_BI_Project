"""
Backend.system_log_server.service_login_history (로그인 이력 조회)
================================================================
user_login_log 조회·IP 마스킹. 본인(me)·조직 어드민(org·부서 트리) 경로. 적재는 auth_server 유지(계획 §3.3).

[Main Functions]
===========
1. fetch_login_history_masked_for_user: 레거시 형식 list[dict] (최근 N건, ISO create_dtm; IP 마스킹은 core.request_context)
2. list_login_history_me_paged: 본인 전용 페이징·필터
3. list_login_history_org_paged: require_org_admin · 부서 트리 스코프

[Dependencies]
=========
- logging, datetime, typing
- Backend.core.user_dvsn_codes.canon_user_dvsn
- Backend.core.request_context.mask_client_ip_for_audit
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from Backend.core.request_context import mask_client_ip_for_audit
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
def fetch_login_history_masked_for_user(
    conn, user_id: int, limit: int = 10
) -> list[dict[str, Any]]:
    """최근 N건. 항목 키: login_trial_ip, login_success_yn, login_trial_browser, create_dtm(ISO 문자열)."""
    lim = max(1, min(100, int(limit)))
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT login_trial_ip, login_success_yn, login_trial_browser, create_dtm
            FROM user_login_log
            WHERE user_id = %s
            ORDER BY create_dtm DESC
            LIMIT %s
            """,
            (int(user_id), lim),
        )
        rows = cur.fetchall() or []
    finally:
        cur.close()
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        cd = d.get("create_dtm")
        out.append(
            {
                "login_trial_ip": mask_client_ip_for_audit(d.get("login_trial_ip")),
                "login_success_yn": d.get("login_success_yn"),
                "login_trial_browser": d.get("login_trial_browser"),
                "create_dtm": cd.isoformat() if cd else None,
            }
        )
    return out


def _apply_login_history_filters(
    where: list[str],
    params: list[Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    table_alias: str = "L",
) -> None:
    if user_key and str(user_key).strip():
        pat = f"%{str(user_key).strip()}%"
        where.append(
            f"""
            (
                CAST({table_alias}.user_id AS TEXT) LIKE %s
                OR EXISTS (
                    SELECT 1 FROM user_info uk
                    WHERE uk.user_id = {table_alias}.user_id
                      AND LOWER(COALESCE(uk.user_email, '')) LIKE LOWER(%s)
                )
            )
            """
        )
        params.extend([pat, pat])

    if from_dtm is not None:
        where.append(f"{table_alias}.create_dtm >= %s")
        params.append(datetime.combine(from_dtm, time.min))

    if to_dtm is not None:
        end_excl = datetime.combine(to_dtm + timedelta(days=1), time.min)
        where.append(f"{table_alias}.create_dtm < %s")
        params.append(end_excl)

    if ip_contains and str(ip_contains).strip():
        where.append(f"{table_alias}.login_trial_ip LIKE %s")
        params.append(f"%{str(ip_contains).strip()}%")


# 2.
def list_login_history_me_paged(
    conn,
    user_id: int,
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """본인 user_login_log. 정렬 create_dtm DESC."""
    page = max(1, int(page))
    page_size = min(50, max(1, int(page_size)))
    offset = (page - 1) * page_size

    where = ["L.user_id = %s"]
    params: list[Any] = [int(user_id)]
    _apply_login_history_filters(where, params, user_key=user_key, from_dtm=from_dtm, to_dtm=to_dtm, ip_contains=ip_contains)

    where_sql = " AND ".join(where)
    base_from = f"FROM user_login_log L WHERE {where_sql}"

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    list_sql = f"""
        SELECT L.login_trial_ip, L.login_success_yn, L.login_trial_browser, L.create_dtm
        {base_from}
        ORDER BY L.create_dtm DESC, L.user_login_log_id DESC
        LIMIT %s OFFSET %s
    """

    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0
        lp = list(params)
        lp.extend([page_size, offset])
        cur.execute(list_sql, lp)
        rows = cur.fetchall() or []
        items: list[dict[str, Any]] = []
        for r in rows:
            d = dict(r)
            cd = d.get("create_dtm")
            items.append(
                {
                    "login_trial_ip": mask_client_ip_for_audit(d.get("login_trial_ip")),
                    "login_success_yn": d.get("login_success_yn"),
                    "login_trial_browser": d.get("login_trial_browser"),
                    "create_dtm": cd.isoformat() if cd else None,
                }
            )
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except Exception:
        logger.exception("list_login_history_me_paged failed user_id=%s", user_id)
        raise
    finally:
        cur.close()


# 3.
def list_login_history_org_paged(
    conn,
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """
    조직 어드민용. sa_dev 전체, sa/a 는 로그인 주체(U.user_id)의 부서가 액터 부서 서브트리에 포함되는 행만.
    """
    dpt = int(actor["dptmt_info_id"])
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    full_access = dvsn == "sa_dev"

    page = max(1, int(page))
    page_size = min(50, max(1, int(page_size)))
    offset = (page - 1) * page_size

    where: list[str] = []
    params: list[Any] = []

    if not full_access:
        where.append(
            f"""
            EXISTS (
                SELECT 1
                FROM user_info u_scope
                INNER JOIN {_RECURSIVE_SUBTREE} scope ON scope.dptmt_info_id = u_scope.dptmt_info_id
                WHERE u_scope.user_id = L.user_id
                  AND UPPER(TRIM(COALESCE(u_scope.user_active_yn, 'Y'))) = 'Y'
            )
            """
        )
        params.append(dpt)

    _apply_login_history_filters(where, params, user_key=user_key, from_dtm=from_dtm, to_dtm=to_dtm, ip_contains=ip_contains)

    where_sql = " AND ".join(where) if where else "TRUE"
    base_from = f"""
        FROM user_login_log L
        INNER JOIN user_info U ON U.user_id = L.user_id
        WHERE {where_sql}
    """

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    list_sql = f"""
        SELECT
            L.login_trial_ip,
            L.login_success_yn,
            L.login_trial_browser,
            L.create_dtm,
            L.user_id,
            U.user_email
        {base_from}
        ORDER BY L.create_dtm DESC, L.user_login_log_id DESC
        LIMIT %s OFFSET %s
    """

    cur = conn.cursor()
    try:
        cur.execute(count_sql, params)
        crow = cur.fetchone()
        total = int(crow["c"]) if crow and crow.get("c") is not None else 0
        lp = list(params)
        lp.extend([page_size, offset])
        cur.execute(list_sql, lp)
        rows = cur.fetchall() or []
        items: list[dict[str, Any]] = []
        for r in rows:
            d = dict(r)
            cd = d.get("create_dtm")
            items.append(
                {
                    "login_trial_ip": mask_client_ip_for_audit(d.get("login_trial_ip")),
                    "login_success_yn": d.get("login_success_yn"),
                    "login_trial_browser": d.get("login_trial_browser"),
                    "create_dtm": cd.isoformat() if cd else None,
                    "user_id": int(d["user_id"]) if d.get("user_id") is not None else None,
                    "user_email": d.get("user_email"),
                }
            )
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except Exception:
        logger.exception("list_login_history_org_paged failed actor=%s", actor.get("user_id"))
        raise
    finally:
        cur.close()
