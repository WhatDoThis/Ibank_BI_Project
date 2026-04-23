"""
Backend.campaign_dash_server.router (캠페인 대시보드 API 라우터)
===============================================================
ibank_*_star_1(발송 팩트·JSONB 인구·시간대)·ibank_*_star_2(회원 스냅샷·JSONB). main에 등록되는 유일 대시보드 API.
table_id 허용은 db.is_table_allowed_for_project_dashboard(대시보드 기능 켜짐 시 dash는 table_master 카탈로그, 꺼짐 시 dash 매핑·*_star_ 물리 규칙).

[Main Functions]
================
1. campaign_period: calc_summary_date_range, calc_previous_range, fact_inclusive_end_date, trend_multi_window_start
2. _calc_change_pct, _campaign_summary_result, _trend_multi_execute, _member_summary_payload, _hourly_payload
3. _require_star_fact_table / _member_table_id_from_fact / _quoted_table
4. _assert_campaign_table — perm·is_table_allowed_for_project_dashboard
5. _jsonb_as_dict, _snapshot_*, _row_date_iso, delivery/hourly JSONB 빌더
6. GET 엔드포인트 — require_permission("dashboard"), table_id 검사

[본문 번호 규칙]
===========
기간·추이 공통 함수는 `campaign_period.py`에 있어 본 파일에서는 `# 2.`·`# 3.` 생략. 헬퍼는 `# 1.`·`# 1a.` 다음 **`# 4.`**부터 연번(중간 생략은 `campaign_period` 모듈에 대응).

[Endpoints]
===========
GET /api/campaign-dashboard/page(번들), member-summary, delivery-demographics, hourly, summary, trend, trend-multi, tables

[Dependencies]
==============
- Backend.campaign_dash_server.campaign_period (기간·추이 창 공통)
- Backend.core.dashboard_service, Backend.core.db
- Backend.auth_server.permissions.require_permission
- datetime, calendar, fastapi, json
"""

import calendar
import json
import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from Backend.auth_server.permissions import require_permission
from Backend.core import dashboard_service, db
from Backend.core.dashboard_service import CHANNEL_MAPPING
from Backend.campaign_dash_server.campaign_period import (
    calc_previous_range,
    calc_summary_date_range,
    fact_inclusive_end_date,
    trend_multi_window_start,
)

router = APIRouter(prefix="/api/campaign-dashboard", tags=["campaign-dashboard"])

_MSG_TABLE_FORBIDDEN = "프로젝트에 매핑된 테이블만 사용할 수 있습니다."


def _assert_campaign_table(perm: dict, table_id: str) -> None:
    if not db.is_table_allowed_for_project_dashboard(int(perm["project_info_id"]), table_id):
        raise HTTPException(status_code=403, detail=_MSG_TABLE_FORBIDDEN)

GRADE_COLS = ["a_grade_count", "b_grade_count", "c_grade_count", "d_grade_count", "e_grade_count"]
GRADE_LABELS = ["A", "B", "C", "D", "E"]
GRADE_JSON_KEYS = ["a", "b", "c", "d", "e"]

AGE_COLS = ["age_10s", "age_20s", "age_30s", "age_40s", "age_50s", "age_60s_plus"]
AGE_LABELS = ["10대", "20대", "30대", "40대", "50대", "60대+"]

GENDER_COLS = ["male_count", "female_count"]
HOUR_SLOTS = [f"{h}_{h+1}" for h in range(24)]

_HOURLY_JSON_COL = {
    "success": ("success_hourly", "success_at"),
    "open": ("open_hourly", "open_at"),
    "click": ("click_hourly", "click_at"),
}


# 1.
def _calc_change_pct(current, previous):
    if previous is None or previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


# 1a.
def _campaign_summary_result(fact_id: str, target_date: str, period: str) -> dict:
    """summary 엔드포인트와 동일 본문(dict). KPI·aggregated_data·증감률 포함."""
    date_range = calc_summary_date_range(target_date, period)
    group_by = {"campaign": True, "date": True, "workflow": True, "channel": True}
    req = {
        "table_id": fact_id,
        "date_range": date_range,
        "campaign_ids": None,
        "workflow_ids": None,
        "channels": None,
        "group_by": group_by,
    }
    result = dashboard_service.get_dashboard_data(req)
    kpi = result["kpi"]
    req_prev = {**req, "date_range": calc_previous_range(date_range, period)}
    kpi_prev = dashboard_service.get_dashboard_data(req_prev)["kpi"]
    for key, prev_key in [
        ("send_change_pct", "total_send"),
        ("success_change_pct", "total_success"),
        ("open_change_pct", "total_open"),
        ("click_change_pct", "total_click"),
    ]:
        kpi[key] = _calc_change_pct(kpi[prev_key], kpi_prev[prev_key])
    result["period"] = period
    result["date_range_actual"] = date_range
    return result


# 4.
def _require_star_fact_table(table_id: str) -> str:
    """table_id는 ..._star_1 팩트 테이블이어야 함."""
    name = (table_id or "").strip()
    if not name.endswith("_star_1"):
        raise ValueError("캠페인 대시보드 table_id는 *_star_1 팩트 테이블이어야 합니다 (예: ibank_1_star_1)")
    db.validate_dashboard_data_table_name(name)
    return name


# 5.
def _member_table_id_from_fact(fact_id: str) -> str:
    suf = "_star_1"
    if not fact_id.endswith(suf):
        raise ValueError("internal: fact_id must end with _star_1")
    mid = fact_id[: -len(suf)] + "_star_2"
    return db.validate_dashboard_data_table_name(mid)


# 6.
def _quoted_table(table_name: str) -> str:
    schema = db.get_dash_table_schema()
    return f'"{schema}"."{table_name}"'


# 7.
def _jsonb_as_dict(val: Any) -> Dict[str, Any]:
    if val is None:
        return {}
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            o = json.loads(val)
            return o if isinstance(o, dict) else {}
        except Exception:
            return {}
    return {}


# 7a.
def _clamp_date_to_range(d: date, start: date, end: date) -> date:
    if d < start:
        return start
    if d > end:
        return end
    return d


# 7b.
def _snapshot_end_clamped(date_range: list, target_date: str) -> str:
    td = datetime.strptime(target_date, "%Y-%m-%d").date()
    start = datetime.strptime(date_range[0], "%Y-%m-%d").date()
    end = datetime.strptime(date_range[1], "%Y-%m-%d").date()
    return _clamp_date_to_range(td, start, end).isoformat()


# 7c.
def _same_day_prev_month(d: date) -> date:
    y, m, day = d.year, d.month, d.day
    if m == 1:
        y -= 1
        m = 12
    else:
        m -= 1
    last_day = calendar.monthrange(y, m)[1]
    day = min(day, last_day)
    return date(y, m, day)


# 7d.
def _prev_snapshot_ref_date(target_date: str, period: str) -> date:
    td = datetime.strptime(target_date, "%Y-%m-%d").date()
    if period == "daily":
        return td - timedelta(days=1)
    if period == "weekly":
        return td - timedelta(days=7)
    return _same_day_prev_month(td)


# 7e.
def _snapshot_prev_end_clamped(prev_range: list, target_date: str, period: str) -> str:
    ref = _prev_snapshot_ref_date(target_date, period)
    ps = datetime.strptime(prev_range[0], "%Y-%m-%d").date()
    pe = datetime.strptime(prev_range[1], "%Y-%m-%d").date()
    return _clamp_date_to_range(ref, ps, pe).isoformat()


# 7f.
def _row_date_iso(row, col: str) -> Optional[str]:
    if not row:
        return None
    v = row.get(col)
    if v is None:
        return None
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    if hasattr(v, "isoformat"):
        s = v.isoformat()
        return s[:10] if len(s) >= 10 else s
    return str(v)[:10]


# 8.
def _build_delivery_demographics_select():
    grade_parts = [
        f"SUM(COALESCE((grade_count->>'{gk}')::bigint, 0))::bigint AS {GRADE_COLS[i]}"
        for i, gk in enumerate(GRADE_JSON_KEYS)
    ]
    age_parts = [
        f"SUM(COALESCE((age_count->>'{ak}')::bigint, 0))::bigint AS {ak}" for ak in AGE_COLS
    ]
    gender_parts = [
        "SUM(COALESCE((gender_count->>'male')::bigint, 0))::bigint AS male_count",
        "SUM(COALESCE((gender_count->>'female')::bigint, 0))::bigint AS female_count",
    ]
    return ", ".join(grade_parts + age_parts + gender_parts)


# 9.
def _build_hourly_select(json_col: str, prefix: str) -> str:
    parts = []
    for h in range(24):
        hk = f"h{h}"
        slot = HOUR_SLOTS[h]
        parts.append(
            f'SUM(COALESCE(({json_col}->>\'{hk}\')::bigint, 0))::bigint AS "{prefix}_{slot}"'
        )
    return ", ".join(parts)


# 9a.
def _member_summary_payload_optional(fact_id: str, target_date: str, period: str) -> Optional[dict]:
    """회원 스냅샷 dict 또는 데이터 없음 시 None (/page 번들용)."""
    date_range = calc_summary_date_range(target_date, period)
    prev_range = calc_previous_range(date_range, period)
    member_name = _member_table_id_from_fact(fact_id)
    full_table = _quoted_table(member_name)
    date_col = "base_date"

    curr_end = _snapshot_end_clamped(date_range, target_date)
    prev_end = _snapshot_prev_end_clamped(prev_range, target_date, period)
    prev_query_end = prev_range[1] if period in ("weekly", "monthly") else prev_end

    query = f"""
        SELECT * FROM {full_table}
        WHERE {date_col} >= %s AND {date_col} <= %s
        ORDER BY {date_col} DESC
        LIMIT 1
    """
    query_prev = f"""
        SELECT * FROM {full_table}
        WHERE {date_col} >= %s AND {date_col} <= %s
        ORDER BY {date_col} DESC
        LIMIT 1
    """

    conn = db.get_db_connection_dash()
    cur = conn.cursor()
    try:
        cur.execute(query, (date_range[0], curr_end))
        row = cur.fetchone()
        cur.execute(query_prev, (prev_range[0], prev_query_end))
        prev_row = cur.fetchone()
        if prev_row is None and period in ("weekly", "monthly"):
            fb = f"""
                SELECT * FROM {full_table}
                WHERE {date_col} < %s
                ORDER BY {date_col} DESC
                LIMIT 1
            """
            cur.execute(fb, (date_range[0],))
            prev_row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not row:
        logging.getLogger(__name__).warning(
            "campaign_dash_router member_summary_no_data table=%s range=%s", full_table, date_range
        )
        return None

    total = row.get("total_recipients") or 0
    target = row.get("target_recipients") or 0
    increased = row.get("increased_count") or 0
    decreased = row.get("decreased_count") or 0

    prev_total = (prev_row.get("total_recipients") or 0) if prev_row else None
    prev_target = (prev_row.get("target_recipients") or 0) if prev_row else None
    prev_increased = (prev_row.get("increased_count") or 0) if prev_row else None
    prev_decreased = (prev_row.get("decreased_count") or 0) if prev_row else None

    churn_rate = round((decreased / total) * 100, 2) if total > 0 else 0
    inflow_share_pct = round((increased / total) * 100, 2) if total > 0 else 0.0
    member_net_flow_count = None
    member_net_flow_pct = None
    if prev_row is not None and prev_total is not None:
        pt = prev_total or 0
        member_net_flow_count = int(total - pt)
        member_net_flow_pct = _calc_change_pct(total, pt)

    gc = _jsonb_as_dict(row.get("gender_count"))
    ac = _jsonb_as_dict(row.get("age_count"))
    gr = _jsonb_as_dict(row.get("grade_count"))
    oi = _jsonb_as_dict(row.get("opt_in_count"))

    return {
        "date_range": date_range,
        "period": period,
        "snapshot_date": _row_date_iso(row, date_col),
        "prev_snapshot_date": _row_date_iso(prev_row, date_col),
        "total_recipients": total,
        "total_recipients_change_pct": _calc_change_pct(total, prev_total),
        "target_recipients": target,
        "target_recipients_change_pct": _calc_change_pct(target, prev_target),
        "increased_count": increased,
        "decreased_count": decreased,
        "increased_change_pct": _calc_change_pct(increased, prev_increased),
        "decreased_change_pct": _calc_change_pct(decreased, prev_decreased),
        "inflow_share_pct": inflow_share_pct,
        "churn_rate": churn_rate,
        "member_net_flow_count": member_net_flow_count,
        "member_net_flow_pct": member_net_flow_pct,
        "gender": {
            "male": int(gc.get("male") or 0),
            "female": int(gc.get("female") or 0),
        },
        "age": [
            {"group": AGE_LABELS[i], "count": int(ac.get(AGE_COLS[i]) or 0)}
            for i in range(len(AGE_COLS))
        ],
        "grade": [
            {"grade": GRADE_LABELS[i], "count": int(gr.get(GRADE_JSON_KEYS[i]) or 0)}
            for i in range(len(GRADE_JSON_KEYS))
        ],
        "opt_in": {
            "email": int(oi.get("email") or 0),
            "sms": int(oi.get("sms") or 0),
            "kakao": 0,
            "push": int(oi.get("push") or 0),
        },
    }


# 9b.
def _hourly_payload_dict(fact_id: str, target_date: str, period: str, metric: str, by_channel: bool) -> dict:
    """hourly 엔드포인트와 동일 본문(dict)."""
    json_col, prefix = _HOURLY_JSON_COL[metric]
    date_range = calc_summary_date_range(target_date, period)
    full_table = _quoted_table(fact_id)
    date_col = "delivery_date"

    hour_sums = _build_hourly_select(json_col, prefix)
    channel_select = ", delivery_channel" if by_channel else ""
    channel_group = " GROUP BY delivery_channel" if by_channel else ""

    query = f"""
        SELECT {hour_sums}{channel_select}
        FROM {full_table}
        WHERE {date_col} >= %s AND {date_col} <= %s
        {channel_group}
    """

    conn = db.get_db_connection_dash()
    cur = conn.cursor()
    try:
        cur.execute(query, (date_range[0], date_range[1]))
        raw_rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    def row_to_hours(r):
        return [
            {"hour": f"{h}-{h+1}", "count": r.get(f"{prefix}_{h}_{h+1}") or 0}
            for h in range(24)
        ]

    if by_channel:
        results = []
        for r in raw_rows:
            ch_code = r.get("delivery_channel")
            results.append({
                "channel_code": ch_code,
                "channel": CHANNEL_MAPPING.get(ch_code, f"Unknown({ch_code})"),
                "hours": row_to_hours(r),
            })
        data = results
    else:
        data = row_to_hours(raw_rows[0]) if raw_rows else []
    return {
        "metric": metric,
        "data": data,
        "by_channel": by_channel,
        "date_range": date_range,
        "period": period,
    }


# 10.
@router.get("/member-summary")
def member_summary(
    table_id: str = Query(..., description="팩트 테이블 ID (예: ibank_1_star_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        payload = _member_summary_payload_optional(fact_id, target_date, period)
        if not payload:
            return JSONResponse(status_code=404, content={"error": "해당 기간 데이터 없음"})
        return payload
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 11.
@router.get("/delivery-demographics")
def delivery_demographics(
    table_id: str = Query(..., description="팩트 테이블 ID (예: ibank_1_star_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        date_range = calc_summary_date_range(target_date, period)
        full_table = _quoted_table(fact_id)
        date_col = "delivery_date"
        sums = _build_delivery_demographics_select()

        channel_select = ", delivery_channel" if by_channel else ""
        channel_group = " GROUP BY delivery_channel" if by_channel else ""

        query = f"""
            SELECT {sums}{channel_select}
            FROM {full_table}
            WHERE {date_col} >= %s AND {date_col} <= %s
            {channel_group}
        """

        conn = db.get_db_connection_dash()
        cur = conn.cursor()
        try:
            cur.execute(query, (date_range[0], date_range[1]))
            raw_rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        def build_item(r, channel_info=None):
            item = {
                "grade": [
                    {"grade": GRADE_LABELS[i], "count": r.get(GRADE_COLS[i]) or 0}
                    for i in range(len(GRADE_COLS))
                ],
                "gender": {
                    "male": r.get("male_count") or 0,
                    "female": r.get("female_count") or 0,
                },
                "age": [
                    {"group": AGE_LABELS[i], "count": r.get(AGE_COLS[i]) or 0}
                    for i in range(len(AGE_COLS))
                ],
            }
            if channel_info is not None:
                item["channel_code"] = channel_info
                item["channel"] = CHANNEL_MAPPING.get(channel_info, f"Unknown({channel_info})")
            return item

        if by_channel:
            data = [build_item(r, r.get("delivery_channel")) for r in raw_rows]
        else:
            data = build_item(raw_rows[0]) if raw_rows else {
                "grade": [], "gender": {"male": 0, "female": 0}, "age": []
            }

        return {
            "data": data,
            "by_channel": by_channel,
            "date_range": date_range,
            "period": period,
        }
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 12.
@router.get("/hourly")
def hourly(
    table_id: str = Query(..., description="팩트 테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    metric: str = Query("success", description="success | open | click"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        if metric not in _HOURLY_JSON_COL:
            return JSONResponse(status_code=400, content={"error": "metric은 success|open|click 중 하나"})

        return _hourly_payload_dict(fact_id, target_date, period, metric, by_channel)
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 13.
@router.get("/summary")
def summary(
    table_id: str = Query(..., description="팩트 테이블 ID (예: ibank_1_star_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        return _campaign_summary_result(fact_id, target_date, period)
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 13a.
@router.get("/page")
def campaign_dashboard_page(
    table_id: str = Query(..., description="팩트 테이블 ID (예: ibank_1_star_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    trend_days: int = Query(10, ge=1, le=365, description="일간 추이 최근 N일"),
    trend_count: int = Query(10, ge=1, le=52, description="주간/월간 추이 버킷 개수"),
    trend_by_channel: bool = Query(True, description="추이 채널별 분리"),
    perm: dict = Depends(require_permission("dashboard")),
):
    """캠페인 대시보드 SPA용 번들: summary·trend_multi·member·hourly를 동일 anchor/period로 한 번에 반환."""
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        summary = _campaign_summary_result(fact_id, target_date, period)
        trend_multi = _trend_multi_execute(
            fact_id, target_date, period, trend_days, trend_count, trend_by_channel
        )
        member_summary = _member_summary_payload_optional(fact_id, target_date, period)
        hourly = {
            "success": _hourly_payload_dict(fact_id, target_date, period, "success", False),
            "open": _hourly_payload_dict(fact_id, target_date, period, "open", False),
            "click": _hourly_payload_dict(fact_id, target_date, period, "click", False),
        }
        return {
            "anchor_date": target_date,
            "period": period,
            "date_range_actual": summary.get("date_range_actual"),
            "summary": summary,
            "trend_multi": trend_multi,
            "member_summary": member_summary,
            "hourly": hourly,
        }
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 14.
@router.get("/trend")
def trend(
    table_id: str = Query(..., description="팩트 테이블 ID"),
    end_date: Optional[str] = Query(None, description="종료 일자 YYYY-MM-DD"),
    days: int = Query(30, ge=1, le=365, description="최근 N일"),
    metric: str = Query("success_count", description="집계 지표"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not end_date:
            end_date = date.today().isoformat()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        start_dt = end_dt - timedelta(days=days - 1)
        req = {
            "table_id": fact_id,
            "date_range": [start_dt.isoformat(), end_dt.isoformat()],
            "campaign_ids": None,
            "workflow_ids": None,
            "channels": None,
            "dimension": "delivery_date",
            "metric": metric.strip(),
        }
        return dashboard_service.get_chart_data(req)
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 15.
def _build_trend_multi_query(full_table, date_expr, group_expr, by_channel):
    channel_select = ", delivery_channel" if by_channel else ""
    channel_group = ", delivery_channel" if by_channel else ""
    channel_order = ", delivery_channel ASC" if by_channel else ""
    return f"""
        SELECT {date_expr} AS date{channel_select},
               COALESCE(SUM(total_count), 0)::bigint AS total_count,
               COALESCE(SUM(success_count), 0)::bigint AS success_count,
               COALESCE(SUM(open_count), 0)::bigint AS open_count,
               COALESCE(SUM(click_count), 0)::bigint AS click_count
        FROM {full_table}
        WHERE delivery_date >= %s AND delivery_date <= %s
        GROUP BY {group_expr}{channel_group}
        ORDER BY {group_expr} ASC{channel_order}
    """


# 16.
def _trend_multi_execute(
    fact_id: str,
    end_date_str: str,
    period: str,
    days: int,
    count: int,
    by_channel: bool,
) -> dict:
    """trend-multi 응답 본문. 팩트 상한은 fact_inclusive_end_date로 summary·hourly와 정합."""
    query_end_dt = fact_inclusive_end_date(end_date_str, period)
    start_dt, date_expr, group_expr = trend_multi_window_start(query_end_dt, period, days, count)
    table_name = db.validate_dashboard_data_table_name(fact_id)
    schema = db.get_dash_table_schema()
    full_table = f'"{schema}"."{table_name}"'
    query = _build_trend_multi_query(full_table, date_expr, group_expr, by_channel)
    params = (start_dt.isoformat(), query_end_dt.isoformat())
    conn = db.get_db_connection_dash()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        raw_rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()
    rows = []
    for r in raw_rows:
        row = {
            "date": r["date"],
            "total_count": r["total_count"],
            "success_count": r["success_count"],
            "open_count": r["open_count"],
            "click_count": r["click_count"],
        }
        if by_channel:
            ch_code = r.get("delivery_channel")
            row["channel_code"] = ch_code
            row["channel"] = CHANNEL_MAPPING.get(ch_code, f"Unknown({ch_code})")
        rows.append(row)
    return {"rows": rows, "by_channel": by_channel, "period": period}


# 17.
@router.get("/trend-multi")
def trend_multi(
    table_id: str = Query(..., description="팩트 테이블 ID"),
    end_date: Optional[str] = Query(None, description="종료 일자 YYYY-MM-DD"),
    days: int = Query(10, ge=1, le=365, description="일간일 때 최근 N일"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    count: int = Query(10, ge=1, le=52, description="주간/월간일 때 기간 개수"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
    perm: dict = Depends(require_permission("dashboard")),
):
    try:
        _assert_campaign_table(perm, table_id)
        fact_id = _require_star_fact_table(table_id)
        if not end_date:
            end_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        return _trend_multi_execute(fact_id, end_date, period, days, count, by_channel)
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 18.
@router.get("/tables")
def campaign_dashboard_tables(perm: dict = Depends(require_permission("dashboard"))):
    try:
        aggregatable = dashboard_service.get_aggregatable_tables(int(perm["project_info_id"]))
        star_facts = [t for t in aggregatable if str(t).endswith("_star_1")]
        tables = [{"id": t, "name": t} for t in star_facts]
        return {"tables": tables}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
