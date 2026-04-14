"""
Backend.campaign_dash_server.campaign_period (캠페인 대시보드 기간·추이 창 공통 해석)
==================================================================================
일간·주간·월간에 대해 summary·hourly·delivery-demographics·trend-multi가 동일한
날짜 상한(팩트 delivery_date 기준)을 쓰도록 한 곳에서 정의한다.

[Main Functions]
===========
1. calc_summary_date_range: 기준일이 속한 집계 구간 [시작, 끝] ISO 문자열
2. calc_previous_range: 직전 동일 단위 구간
3. fact_inclusive_end_date: 팩트 쿼리 WHERE 상한일 (주=일요일, 월=말일)
4. trend_multi_window_start: trend-multi SQL용 (start_dt, date_expr, group_expr)

[Dependencies]
=========
- datetime, calendar (표준 라이브러리)
"""

import calendar
from datetime import date, datetime, timedelta
from typing import List, Tuple


# 1.
def calc_summary_date_range(target_date: str, period: str) -> List[str]:
    """기준일이 속한 일/주/월의 [시작, 끝] (YYYY-MM-DD). 주간=월요일~일요일."""
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
    return [target_date, target_date]


# 2.
def calc_previous_range(date_range: List[str], period: str) -> List[str]:
    """직전 동일 단위 구간 [시작, 끝]."""
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


def _week_start(dt: date) -> date:
    return dt - timedelta(days=dt.weekday())


def _month_start(dt: date) -> date:
    return dt.replace(day=1)


# 3.
def fact_inclusive_end_date(anchor_date_str: str, period: str) -> date:
    """
    팩트 테이블 delivery_date 상한(포함).
    summary의 date_range[1]과 동일 — 월간·주간은 기준일이 아닌 주/월 전체 말일·일요일까지 포함.
    """
    dr = calc_summary_date_range(anchor_date_str, period)
    return datetime.strptime(dr[1], "%Y-%m-%d").date()


# 4.
def trend_multi_window_start(end_dt: date, period: str, days: int, count: int) -> Tuple[date, str, str]:
    """
    trend-multi 쿼리: 창 시작일 + SELECT/GROUP 표현식.
    end_dt는 fact_inclusive_end_date 결과를 넣어 summary와 버킷 합계가 맞도록 한다.
    """
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
