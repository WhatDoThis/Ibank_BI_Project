"""
Backend.api_server.routers (호스트용 라우터 재export)
====================================================
health는 로컬, report·dashboard는 분리 패키지에서 로드. main에서 include_router로 등록.

[Main]
===========
1. health_router, report_router, dashboard_router: 각 APIRouter 인스턴스

[Endpoints]
=======================
1. health: /health, /, /api, /api/
2. report: /api/* (list-tables, execute-query 등)
3. dashboard: /api/dashboard/* (data, filter-options, tables, required-columns, chart-data)

[Dependencies]
=========
- .health, Backend.report_server.router, Backend.legacy_dashboard_server.router
"""

from .health import router as health_router
from Backend.report_server.router import router as report_router
from Backend.legacy_dashboard_server.router import router as dashboard_router

__all__ = ["health_router", "report_router", "dashboard_router"]
