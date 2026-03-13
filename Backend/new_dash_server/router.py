"""
Backend.new_dash_server.router (뉴 대시보드 API 라우터)
=======================================================
일간/주간/월간 요약·증감률·trend·trend-multi·tables. dashboard_service·db 재활용.

[Helpers]
=========
_calc_date_range, _calc_previous_range, _calc_change_pct: 기간·증감률
_trend_multi_range: period별 start_dt, date_expr, group_expr
_build_trend_multi_query: trend-multi 단일 쿼리 생성 (by_channel 분기)

[Endpoints]
===========
GET /api/new-dashboard/summary — 기간별 KPI·aggregated_data·증감률
GET /api/new-dashboard/trend — 단일 메트릭 추이
GET /api/new-dashboard/trend-multi — 일자별 복수 메트릭 (by_channel=True면 채널별 분리)
GET /api/new-dashboard/tables — 집계 가능 테이블 목록

[Dependencies]
==============
- Backend.api_server.dashboard_service, Backend.api_server.db
- datetime, calendar, fastapi
"""

import calendar
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from Backend.api_server import dashboard_service, db
from Backend.api_server.dashboard_service import CHANNEL_MAPPING

router = APIRouter(prefix="/api/new-dashboard", tags=["new-dashboard"])


# 1.
def _calc_date_range(target_date: str, period: str) -> list:
    """period에 따라 date_range [start, end] 계산."""
    dt = datetime.strptime(target_date, "%Y-%m-%d").date()
    if period == "weekly":
        start = dt - timedelta(days=dt.weekday())
        end = start + timedelta(days=6)
        return [start.isoformat(), end.isoformat()]
    if period == "monthly":
        start = dt.replace(day=1)
        last_day = calendar.monthrange(dt.year, dt.month)[1]
        end = dt.replace(day=last_day)
        return [start.isoformat(), end.isoformat()]
    # daily
    return [target_date, target_date]


# 2.
def _calc_previous_range(date_range: list, period: str) -> list:
    """직전 동일 기간 [start, end] 계산."""
    start = datetime.strptime(date_range[0], "%Y-%m-%d").date()
    end = datetime.strptime(date_range[1], "%Y-%m-%d").date()
    if period == "monthly":
        prev_end = start - timedelta(days=1)
        return [prev_end.replace(day=1).isoformat(), prev_end.isoformat()]
    if period == "weekly":
        delta = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        return [(prev_end - timedelta(days=delta - 1)).isoformat(), prev_end.isoformat()]
    prev = start - timedelta(days=1)
    return [prev.isoformat(), prev.isoformat()]


# 3.
def _calc_change_pct(current, previous):
    """이전 대비 증감률 %. previous 0/None이면 None."""
    if previous is None or previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


# 4.
@router.get("/summary")
def summary(
    table_id: str = Query(..., description="테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """기간별 요약 KPI·aggregated_data·증감률. period에 따라 date_range 계산."""
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        date_range = _calc_date_range(target_date, period)
        group_by = {"campaign": True, "date": True, "workflow": True, "channel": True}
        req = {
            "table_id": table_id.strip(),
            "date_range": date_range,
            "campaign_ids": None,
            "workflow_ids": None,
            "channels": None,
            "group_by": group_by,
        }
        result = dashboard_service.get_dashboard_data(req)
        kpi = result["kpi"]

        # 이전 기간 조회 후 증감률 계산
        req_prev = {**req, "date_range": _calc_previous_range(date_range, period)}
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
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 5.
@router.get("/trend")
def trend(
    table_id: str = Query(..., description="테이블 ID"),
    end_date: Optional[str] = Query(None, description="종료 일자 YYYY-MM-DD"),
    days: int = Query(30, ge=1, le=365, description="최근 N일"),
    metric: str = Query("success_count", description="집계 지표"),
):
    """단일 메트릭 일자별 추이."""
    try:
        if not end_date:
            end_date = date.today().isoformat()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        start_dt = end_dt - timedelta(days=days - 1)
        req = {
            "table_id": table_id.strip(),
            "date_range": [start_dt.isoformat(), end_dt.isoformat()],
            "campaign_ids": None,
            "workflow_ids": None,
            "channels": None,
            "dimension": "delivery_date",
            "metric": metric.strip(),
        }
        result = dashboard_service.get_chart_data(req)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 6.
def _week_start(dt):
    """해당 일이 속한 주의 월요일."""
    return dt - timedelta(days=dt.weekday())


# 7.
def _month_start(dt):
    """해당 일이 속한 월의 1일."""
    return dt.replace(day=1)


# 8.
def _trend_multi_range(end_dt, period, days, count):
    """period별 시작일·date 표현식·group 표현식 반환. (start_dt, date_expr, group_expr)."""
    if period == "monthly":
        start_dt = _month_start(end_dt)
        for _ in range(count - 1):
            start_dt = (start_dt.replace(day=1) - timedelta(days=1)).replace(day=1)
        date_expr = "to_char(date_trunc('month', delivery_date)::date, 'YYYY-MM-DD')"
        group_expr = "date_trunc('month', delivery_date)"
    elif period == "weekly":
        end_week_monday = _week_start(end_dt)
        start_dt = end_week_monday - timedelta(weeks=count - 1)
        date_expr = "to_char(date_trunc('week', delivery_date)::date, 'YYYY-MM-DD')"
        group_expr = "date_trunc('week', delivery_date)"
    else:
        start_dt = end_dt - timedelta(days=days - 1)
        date_expr = "to_char(delivery_date, 'YYYY-MM-DD')"
        group_expr = "delivery_date"
    return start_dt, date_expr, group_expr


# 9.
def _build_trend_multi_query(full_table, date_expr, group_expr, by_channel):
    """trend-multi 쿼리 생성. by_channel 여부만 SELECT/GROUP BY/ORDER BY에 반영."""
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


# 10.
@router.get("/trend-multi")
def trend_multi(
    table_id: str = Query(..., description="테이블 ID"),
    end_date: Optional[str] = Query(None, description="종료 일자 YYYY-MM-DD"),
    days: int = Query(10, ge=1, le=365, description="일간일 때 최근 N일"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    count: int = Query(10, ge=1, le=52, description="주간/월간일 때 기간 개수"),
    by_channel: bool = Query(False, description="True면 채널별 분리, False면 전체 합산"),
):
    """기간별 복수 메트릭. period=daily: 일별 N일, weekly: 주별 N주, monthly: 월별 N개월. by_channel=True면 채널별."""
    try:
        if not end_date:
            end_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        table_name = db.validate_table_name(table_id.strip())
        schema = db.get_table_schema()
        full_table = f'"{schema}"."{table_name}"'

        start_dt, date_expr, group_expr = _trend_multi_range(end_dt, period, days, count)
        query = _build_trend_multi_query(full_table, date_expr, group_expr, by_channel)
        params = (start_dt.isoformat(), end_dt.isoformat())

        conn = db.get_db_connection()
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
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 11.
@router.get("/tables")
def new_dashboard_tables():
    """집계 가능 테이블 목록."""
    try:
        aggregatable = dashboard_service.get_aggregatable_tables()
        tables = [{"id": t, "name": t} for t in aggregatable]
        return {"tables": tables}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
