"""
Backend.api_server.routers.dashboard (대시보드1 API)
====================================================
FastAPI 라우터. prefix /api/dashboard. 대시보드1용 집계·필터 옵션·테이블 목록·필수 컬럼·차트 데이터.

[Main Functions]
===========
- dashboard_data, dashboard_filter_options, dashboard_tables, dashboard_required_columns, dashboard_chart_data: 라우트 핸들러

[Endpoints/Classes/Functions]
=======================
- POST /api/dashboard/data: 집계 데이터·KPI (DashboardDataRequest)
- GET /api/dashboard/filter-options/{table_id}: 캠페인·워크플로우·채널 옵션
- GET /api/dashboard/tables: 집계 가능 테이블 목록
- GET /api/dashboard/required-columns: 필수 컬럼 목록
- POST /api/dashboard/chart-data: 차트용 단일 dimension·metric 집계 (ChartDataRequest)

[Dependencies]
=========
- Backend.api_server.dashboard_service, Backend.api_server.schemas
- fastapi
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from Backend.api_server import dashboard_service
from Backend.api_server.schemas import ChartDataRequest, DashboardDataRequest

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _parse_int_list(value: Optional[str]):
    if not value or not str(value).strip():
        return None
    try:
        return [int(x.strip()) for x in str(value).split(",") if x.strip()]
    except ValueError:
        return None


@router.post("/data")
def dashboard_data(body: DashboardDataRequest):
    try:
        req = {
            "table_id": body.table_id.strip(),
            "date_range": [str(body.date_range[0]), str(body.date_range[1])],
            "campaign_ids": body.campaign_ids,
            "workflow_ids": body.workflow_ids,
            "channels": body.channels,
            "group_by": body.group_by or {
                "campaign": True,
                "date": True,
                "workflow": False,
                "channel": True,
            },
        }
        result = dashboard_service.get_dashboard_data(req)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "대시보드 데이터 조회 실패"})


@router.get("/filter-options/{table_id}")
def dashboard_filter_options(
    table_id: str,
    campaign_ids: Optional[str] = Query(None),
    workflow_ids: Optional[str] = Query(None),
    channels: Optional[str] = Query(None),
):
    try:
        table_id = (table_id or "").strip()
        if not table_id:
            return JSONResponse(status_code=400, content={"error": "table_id가 필요합니다"})
        result = dashboard_service.get_filter_options(
            table_id,
            campaign_ids=_parse_int_list(campaign_ids),
            workflow_ids=_parse_int_list(workflow_ids),
            channels=_parse_int_list(channels),
        )
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "필터 옵션 조회 실패"})


@router.get("/tables")
def dashboard_tables():
    try:
        aggregatable = dashboard_service.get_aggregatable_tables()
        tables = [{"id": t, "name": t} for t in aggregatable]
        return {"tables": tables}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 목록 조회 실패"})


@router.get("/required-columns")
def dashboard_required_columns():
    try:
        columns = dashboard_service.get_required_columns()
        return {"columns": columns}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "필수 컬럼 조회 실패"})


@router.post("/chart-data")
def dashboard_chart_data(body: ChartDataRequest):
    try:
        req = {
            "table_id": body.table_id.strip(),
            "date_range": [str(body.date_range[0]), str(body.date_range[1])],
            "campaign_ids": body.campaign_ids,
            "workflow_ids": body.workflow_ids,
            "channels": body.channels,
            "dimension": (body.dimension or "delivery_date").strip(),
            "metric": (body.metric or "success_count").strip(),
        }
        result = dashboard_service.get_chart_data(req)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "차트 데이터 조회 실패"})
