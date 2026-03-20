"""
Backend.new_dash_server.router (뉴 대시보드 API 라우터)
=======================================================
일간/주간/월간 요약·증감률·회원·인구통계·시간대·trend·trend-multi·tables. dashboard_service·db 재활용.

[Helpers]
=========
_calc_date_range, _calc_previous_range, _calc_change_pct: 기간·증감률
_get_sub_table, _sub_table_date_col: 서브 테이블(_0~_4) 풀네임·날짜 컬럼명
_snapshot_end_clamped, _snapshot_prev_end_clamped, _row_date_iso: member-summary 스냅샷 일자 정렬
member-summary member_net_flow: 기간 말 total_recipients 끝점 빼기(일/주/월 공통, inc/dec 합산 없음)
_trend_multi_range: period별 start_dt, date_expr, group_expr
_build_trend_multi_query: trend-multi 단일 쿼리 생성 (by_channel 분기)

[Endpoints]
===========
GET /api/new-dashboard/summary — 기간별 KPI·aggregated_data·증감률
GET /api/new-dashboard/trend — 단일 메트릭 추이
GET /api/new-dashboard/trend-multi — 일자별 복수 메트릭 (by_channel=True면 채널별 분리)
GET /api/new-dashboard/tables — 집계 가능 테이블 목록
GET /api/new-dashboard/member-summary — 회원 현황 스냅샷 (snapshot_date·prev_snapshot_date, member_net_flow_* 유입·이탈 순증감)
GET /api/new-dashboard/delivery-demographics — 발송 기준 인구통계
GET /api/new-dashboard/hourly — 시간대별 집계 (success|open|click)

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


# ── 서브 테이블 관련 상수 ──

GRADE_COLS = ["a_grade_count", "b_grade_count", "c_grade_count", "d_grade_count", "e_grade_count"]
GRADE_LABELS = ["A", "B", "C", "D", "E"]

AGE_COLS = ["age_10s", "age_20s", "age_30s", "age_40s", "age_50s", "age_60s_plus"]
AGE_LABELS = ["10대", "20대", "30대", "40대", "50대", "60대+"]

GENDER_COLS = ["male_count", "female_count"]

HOUR_SLOTS = [f"{h}_{h+1}" for h in range(24)]


# 4.
def _get_sub_table(table_id: str, suffix: str) -> str:
    """table_id에 suffix를 붙여 서브 테이블 풀네임 반환. dash_db 사용.
    suffix: '_0', '_1', '_2', '_3', '_4'
    예: table_id='ibank_1', suffix='_0' → '"schema"."ibank_1_0"'
    """
    full_table_id = table_id.strip() + suffix
    table_name = db.validate_dashboard_data_table_name(full_table_id)
    schema = db.get_dash_table_schema()
    return f'"{schema}"."{table_name}"'


# 5.
def _sub_table_date_col(suffix: str) -> str:
    """서브 테이블별 날짜 컬럼명. _0만 base_date, 나머지는 delivery_date."""
    return "base_date" if suffix == "_0" else "delivery_date"


# 5a.
def _clamp_date_to_range(d: date, start: date, end: date) -> date:
    """날짜 d를 [start, end] 구간으로 제한."""
    if d < start:
        return start
    if d > end:
        return end
    return d


# 5b.
def _snapshot_end_clamped(date_range: list, target_date: str) -> str:
    """현재 기간 스냅샷 상한일: min(기간말, target_date). 주/월에서 헤더 선택일과 일치."""
    td = datetime.strptime(target_date, "%Y-%m-%d").date()
    start = datetime.strptime(date_range[0], "%Y-%m-%d").date()
    end = datetime.strptime(date_range[1], "%Y-%m-%d").date()
    return _clamp_date_to_range(td, start, end).isoformat()


# 5c.
def _same_day_prev_month(d: date) -> date:
    """같은 일자의 전월(말일 보정)."""
    y, m, day = d.year, d.month, d.day
    if m == 1:
        y -= 1
        m = 12
    else:
        m -= 1
    last_day = calendar.monthrange(y, m)[1]
    day = min(day, last_day)
    return date(y, m, day)


# 5d.
def _prev_snapshot_ref_date(target_date: str, period: str) -> date:
    """이전 동일 기간에서 target_date에 대응하는 비교 기준일(일/주/월)."""
    td = datetime.strptime(target_date, "%Y-%m-%d").date()
    if period == "daily":
        return td - timedelta(days=1)
    if period == "weekly":
        return td - timedelta(days=7)
    return _same_day_prev_month(td)


# 5e.
def _snapshot_prev_end_clamped(prev_range: list, target_date: str, period: str) -> str:
    """이전 기간 질의 상한: 비교 기준일을 prev_range에 클램프."""
    ref = _prev_snapshot_ref_date(target_date, period)
    ps = datetime.strptime(prev_range[0], "%Y-%m-%d").date()
    pe = datetime.strptime(prev_range[1], "%Y-%m-%d").date()
    return _clamp_date_to_range(ref, ps, pe).isoformat()


# 5f.
def _row_date_iso(row, col: str) -> Optional[str]:
    """fetchone 행의 날짜 컬럼을 YYYY-MM-DD 문자열로."""
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


# 6.
@router.get("/member-summary")
def member_summary(
    table_id: str = Query(..., description="테이블 ID (예: ibank_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        date_range = _calc_date_range(target_date, period)
        prev_range = _calc_previous_range(date_range, period)
        full_table = _get_sub_table(table_id, "_0")
        date_col = _sub_table_date_col("_0")

        # 스냅샷: 기간말만 보던 것을 target_date(및 이전기간 대응일)까지로 제한해 헤더 일자와 불일치 방지
        curr_end = _snapshot_end_clamped(date_range, target_date)
        prev_end = _snapshot_prev_end_clamped(prev_range, target_date, period)

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
            cur.execute(query_prev, (prev_range[0], prev_end))
            prev_row = cur.fetchone()
        finally:
            cur.close()
            conn.close()

        if not row:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"member-summary: {full_table}에서 {date_range} 기간 데이터 없음")
            return JSONResponse(status_code=404, content={"error": "해당 기간 데이터 없음"})

        total = row.get("total_recipients") or 0
        target = row.get("target_recipients") or 0
        increased = row.get("increased_count") or 0
        decreased = row.get("decreased_count") or 0

        prev_total = (prev_row.get("total_recipients") or 0) if prev_row else None
        prev_target = (prev_row.get("target_recipients") or 0) if prev_row else None
        prev_increased = (prev_row.get("increased_count") or 0) if prev_row else None
        prev_decreased = (prev_row.get("decreased_count") or 0) if prev_row else None

        # 이탈률: 탈퇴(감소) 건수 / 전체 회원 (타겟 모수와 무관)
        churn_rate = round((decreased / total) * 100, 2) if total > 0 else 0
        # 유입 비중(참고): 신규 건수 / 전체 — 발송 타겟과 무관
        inflow_share_pct = round((increased / total) * 100, 2) if total > 0 else 0.0
        # 회원 순증감(전환 카드): 끝점 빼기 — 기간 말 total − 직전 기간 말 total. 비율은 total_recipients_change_pct 와 동일 정의.
        member_net_flow_count = None
        member_net_flow_pct = None
        if prev_row is not None and prev_total is not None:
            pt = prev_total or 0
            member_net_flow_count = int(total - pt)
            member_net_flow_pct = _calc_change_pct(total, pt)

        result = {
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
                "male": row.get("male_count") or 0,
                "female": row.get("female_count") or 0,
            },
            "age": [
                {"group": AGE_LABELS[i], "count": row.get(AGE_COLS[i]) or 0}
                for i in range(len(AGE_COLS))
            ],
            "grade": [
                {"grade": GRADE_LABELS[i], "count": row.get(GRADE_COLS[i]) or 0}
                for i in range(len(GRADE_COLS))
            ],
            "opt_in": {
                "email": row.get("email_opt_in_count") or 0,
                "sms": row.get("sms_opt_in_count") or 0,
                "kakao": row.get("kakao_opt_in_count") or 0,
                "push": row.get("push_opt_in_count") or 0,
            },
        }
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 7.
@router.get("/delivery-demographics")
def delivery_demographics(
    table_id: str = Query(..., description="테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        date_range = _calc_date_range(target_date, period)
        full_table = _get_sub_table(table_id, "_1")
        date_col = _sub_table_date_col("_1")

        grade_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in GRADE_COLS)
        age_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in AGE_COLS)
        gender_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in GENDER_COLS)

        channel_select = ", delivery_channel" if by_channel else ""
        channel_group = " GROUP BY delivery_channel" if by_channel else ""

        query = f"""
            SELECT {grade_sums}, {age_sums}, {gender_sums}{channel_select}
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
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


_HOURLY_PREFIX_MAP = {
    "success": ("_2", "success_at"),
    "open": ("_3", "open_at"),
    "click": ("_4", "click_at"),
}


# 8.
@router.get("/hourly")
def hourly(
    table_id: str = Query(..., description="테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    metric: str = Query("success", description="success | open | click"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        if metric not in _HOURLY_PREFIX_MAP:
            return JSONResponse(status_code=400, content={"error": "metric은 success|open|click 중 하나"})

        suffix, prefix = _HOURLY_PREFIX_MAP[metric]
        date_range = _calc_date_range(target_date, period)
        full_table = _get_sub_table(table_id, suffix)
        date_col = _sub_table_date_col(suffix)

        hour_sums = ", ".join(
            f'COALESCE(SUM({prefix}_{slot}), 0)::bigint AS "{prefix}_{slot}"'
            for slot in HOUR_SLOTS
        )
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
            # 데이터 없을 때 로깅 (디버깅용)
            if not raw_rows:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"hourly {metric}: {full_table}에서 {date_range} 기간 데이터 없음")

        return {
            "metric": metric,
            "data": data,
            "by_channel": by_channel,
            "date_range": date_range,
            "period": period,
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 9.
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


# 10.
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


# 11.
def _week_start(dt):
    """해당 일이 속한 주의 월요일."""
    return dt - timedelta(days=dt.weekday())


# 12.
def _month_start(dt):
    """해당 일이 속한 월의 1일."""
    return dt.replace(day=1)


# 13.
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


# 14.
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


# 15.
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
        table_name = db.validate_dashboard_data_table_name(table_id.strip())
        schema = db.get_dash_table_schema()
        full_table = f'"{schema}"."{table_name}"'

        start_dt, date_expr, group_expr = _trend_multi_range(end_dt, period, days, count)
        query = _build_trend_multi_query(full_table, date_expr, group_expr, by_channel)
        params = (start_dt.isoformat(), end_dt.isoformat())

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
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 16.
@router.get("/tables")
def new_dashboard_tables():
    """집계 가능 테이블 목록."""
    try:
        aggregatable = dashboard_service.get_aggregatable_tables()
        tables = [{"id": t, "name": t} for t in aggregatable]
        return {"tables": tables}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
