"""
Backend.system_log_server.service_login_history (로그인 이력 조회)
================================================================
user_login_log 조회·IP 마스킹. 본인(me)·조직 어드민(org·부서 트리) 경로. 적재는 auth_server 유지(계획 §3.3).
`ip_contains` 필터는 원문 IP 부분 일치와, IPv4 4옥텟이면 `a.b.*.*` 마스크 표기와의 부분 일치를 함께 지원한다(표시·`mask_client_ip_for_audit`와 정합).

[Main Functions]
===========
1. fetch_login_history_masked_for_user: 레거시 형식 list[dict] (최근 N건, ISO create_dtm; IP 마스킹은 core.request_context)
2. list_login_history_me_paged: 본인 전용 페이징·필터
3. list_login_history_org_paged: require_org_admin · 부서 트리 스코프(정렬 `sort_by`·`sort_dir`)
4. export_login_history_org_csv_bytes: org 목록과 동일 필터·정렬·CSV(상한 `MAX_CSV_EXPORT_ROWS`, 화면 테이블과 동일 한글 헤더·표기)

[Dependencies]
=========
- csv, io, logging, datetime, typing
- Backend.core.user_dvsn_codes.canon_user_dvsn
- Backend.core.request_context.mask_client_ip_for_audit
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from Backend.core.request_context import mask_client_ip_for_audit
from Backend.core.user_dvsn_codes import canon_user_dvsn

logger = logging.getLogger(__name__)

MAX_CSV_EXPORT_ROWS = 50_000

_LOGIN_CSV_UI_HEADERS = ("일시", "사용자", "결과", "IP", "클라이언트")

_LOGIN_ORG_SORT_COLUMNS: dict[str, str] = {
    "create_dtm": "L.create_dtm",
    "user_login_log_id": "L.user_login_log_id",
    "login_success_yn": "L.login_success_yn",
    "user_id": "L.user_id",
    "user_email": "LOWER(COALESCE(U.user_email, ''))",
}


def _login_org_order_sql(sort_by: str | None, sort_dir: str | None) -> str:
    """조직 로그인 이력 목록·CSV 공통 ORDER BY. 컬럼·방향은 화이트리스트만 허용."""
    key = (sort_by or "create_dtm").strip().lower()
    if key not in _LOGIN_ORG_SORT_COLUMNS:
        key = "create_dtm"
    d = (sort_dir or "desc").strip().lower()
    if d not in ("asc", "desc"):
        d = "desc"
    primary = _LOGIN_ORG_SORT_COLUMNS[key]
    d_up = d.upper()
    id_dir = "ASC" if d == "asc" else "DESC"
    return f"ORDER BY {primary} {d_up}, L.user_login_log_id {id_dir}"


def _csv_dtm_display(cd: Any) -> str:
    """로그인 이력 CSV: 일시 `YYYY-MM-DD HH:MM:SS`(화면 `formatDtm` 에 가깝게)."""
    if cd is None:
        return ""
    if hasattr(cd, "strftime"):
        try:
            return cd.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return str(cd)


def _csv_login_success_display(yn: Any) -> str:
    u = str(yn or "").strip().upper()
    if u == "Y":
        return "성공"
    if u == "N":
        return "실패"
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
        pat = f"%{str(ip_contains).strip()}%"
        where.append(
            f"""
            (
                {table_alias}.login_trial_ip LIKE %s
                OR (
                    {table_alias}.login_trial_ip ~ '^[0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}}$'
                    AND (
                        split_part({table_alias}.login_trial_ip, '.', 1)
                        || '.' ||
                        split_part({table_alias}.login_trial_ip, '.', 2)
                        || '.*.*'
                    ) LIKE %s
                )
            )
            """
        )
        params.extend([pat, pat])


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


# 3. [org WHERE + FROM]
def _build_login_history_org_base(
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
) -> tuple[str, list[Any]]:
    """list_login_history_org_paged·CSV 공통 FROM…WHERE."""
    dpt = int(actor["dptmt_info_id"])
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    full_access = dvsn == "sa_dev"

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
    return base_from, params


# 4.
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
    sort_by: str | None = None,
    sort_dir: str | None = None,
) -> dict[str, Any]:
    """
    조직 어드민용. sa_dev 전체, sa/a 는 로그인 주체(U.user_id)의 부서가 액터 부서 서브트리에 포함되는 행만.
    정렬은 `sort_by`·`sort_dir`(기본 create_dtm desc).
    """
    page = max(1, int(page))
    page_size = min(50, max(1, int(page_size)))
    offset = (page - 1) * page_size

    base_from, params = _build_login_history_org_base(
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
    )

    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    order_sql = _login_org_order_sql(sort_by, sort_dir)
    list_sql = f"""
        SELECT
            L.login_trial_ip,
            L.login_success_yn,
            L.login_trial_browser,
            L.create_dtm,
            L.user_id,
            U.user_email
        {base_from}
        {order_sql}
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


# 5.
def export_login_history_org_csv_bytes(
    conn,
    actor: dict[str, Any],
    *,
    user_key: str | None,
    from_dtm: date | None,
    to_dtm: date | None,
    ip_contains: str | None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
) -> tuple[int, bytes]:
    """
    org 목록과 동일 필터·정렬 CSV. 헤더·셀 값은 사용자 이력 화면(로그인 탭)과 동일 규칙.
    COUNT > MAX_CSV_EXPORT_ROWS 이면 ValueError (`CSV_EXPORT_ROW_LIMIT_EXCEEDED:총건수:상한`).
    """
    base_from, params = _build_login_history_org_base(
        actor,
        user_key=user_key,
        from_dtm=from_dtm,
        to_dtm=to_dtm,
        ip_contains=ip_contains,
    )
    count_sql = f"SELECT COUNT(*)::bigint AS c {base_from}"
    order_sql = _login_org_order_sql(sort_by, sort_dir)
    export_sql = f"""
        SELECT
            L.login_trial_ip,
            L.login_success_yn,
            L.login_trial_browser,
            L.create_dtm,
            L.user_id,
            U.user_email
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
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(list(_LOGIN_CSV_UI_HEADERS))
        if lim == 0:
            raw = "\ufeff" + buf.getvalue()
            return 0, raw.encode("utf-8")
        qparams = list(params)
        qparams.append(lim)
        cur.execute(export_sql, qparams)
        rows = cur.fetchall() or []
        for r in rows:
            d = dict(r)
            user_cell = str(d.get("user_email") or "").strip() or (
                str(d.get("user_id")) if d.get("user_id") is not None else ""
            )
            if not user_cell:
                user_cell = "—"
            w.writerow(
                [
                    _csv_dtm_display(d.get("create_dtm")),
                    user_cell,
                    _csv_login_success_display(d.get("login_success_yn")),
                    mask_client_ip_for_audit(d.get("login_trial_ip")) or "—",
                    d.get("login_trial_browser") or "—",
                ]
            )
        raw = "\ufeff" + buf.getvalue()
        return len(rows), raw.encode("utf-8")
    except ValueError:
        raise
    except Exception:
        logger.exception("export_login_history_org_csv_bytes failed actor=%s", actor.get("user_id"))
        raise
    finally:
        cur.close()
