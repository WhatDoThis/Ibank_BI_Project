"""
Backend.new_dash_server2.router (New Dashboard 2 API 라우터)
==========================================================
GET /overview, /star, /frequency, /coupon, /campaign-segments, /store, /trend, /product-master.
target_date, period 쿼리. handle_errors 데코레이터로 ValueError→400, 기타 Exception→500 통합 처리.

[Main Functions]
===========
1. handle_errors: ValueError→400, Exception→500 데코레이터
2. _today: 오늘 날짜 YYYY-MM-DD
3. overview, star, frequency, coupon, campaign_segments, store, trend, product_master: GET 엔드포인트

[Dependencies]
==============
- Backend.new_dash_server2.service
- datetime, fastapi, functools.wraps
"""

import logging
from datetime import date
from functools import wraps
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from Backend.new_dash_server2 import service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/new-dashboard2", tags=["new-dashboard2"])


# 1.
def handle_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            return JSONResponse(status_code=400, content={"error": str(e)})
        except Exception as e:
            logger.exception("new_dash2_router endpoint_error")
            return JSONResponse(status_code=500, content={"error": str(e)})
    return wrapper


# 2.
def _today():
    return date.today().isoformat()


# 3.
@router.get("/overview")
@handle_errors
def overview(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S1: 종합 KPI + 증감률."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    return service.get_dashboard_overall(target_date, period)


# 4.
@router.get("/star")
@handle_errors
def star(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S2: 별 분석."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    return service.get_star_analyze(target_date, period)


# 5.
@router.get("/frequency")
@handle_errors
def frequency(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S3: 프리퀀시 분석."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    return service.get_frequency_analyze(target_date, period)


# 6.
@router.get("/coupon")
@handle_errors
def coupon(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S4: 쿠폰 분석."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    return service.get_coupon_analyze(target_date, period)


# 7.
@router.get("/campaign-segments")
@handle_errors
def campaign_segments(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S5: 캠페인 세그먼트 목록."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    segments = service.get_campaign_segments(target_date, period)
    date_range = service._calc_date_range(target_date, period)
    return {"segments": segments, "period": period, "date_range_actual": date_range}


# 8.
@router.get("/store")
@handle_errors
def store(
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    """S6: 매장 주문 분석. period≠daily 시 기간 마지막 일자 1행 반환."""
    if not target_date:
        target_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    return service.get_store_order_analyze(target_date, period)


# 9.
@router.get("/trend")
@handle_errors
def trend(
    table_name: str = Query(..., description="테이블명 (화이트리스트)"),
    metrics: str = Query(..., description="쉼표 구분 메트릭"),
    end_date: Optional[str] = Query(None, description="종료 일자 YYYY-MM-DD"),
    days: int = Query(30, ge=1, le=365, description="일간일 때 최근 N일"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    count: int = Query(12, ge=1, le=52, description="주간/월간일 때 기간 개수"),
):
    """S7: 추이. 응답 { rows, period, table_name }."""
    if not end_date:
        end_date = _today()
    if period not in ("daily", "weekly", "monthly"):
        period = "daily"
    metric_list = [m.strip() for m in metrics.split(",") if m.strip()]
    rows = service.get_trend_data(table_name, metric_list, end_date, days=days, period=period, count=count)
    return {"rows": rows, "period": period, "table_name": table_name}


# 10.
@router.get("/product-master")
@handle_errors
def product_master():
    """S8: 제품 마스터 목록."""
    return service.get_product_master()
