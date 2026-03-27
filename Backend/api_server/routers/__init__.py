"""
Backend.api_server.routers (호스트용 라우터 재export)
====================================================
health는 로컬, report는 report_server에서 로드. 구 대시보드(/api/dashboard)는 main에 미등록(legacy_dashboard_server 패키지는 보존).

[Main]
===========
1. health_router, report_router: 각 APIRouter 인스턴스

[Endpoints]
=======================
1. health: /health, /, /api, /api/
2. report: /api/* (list-tables, execute-query 등)

[Dependencies]
=========
- .health, Backend.report_server.router
"""

from .health import router as health_router
from Backend.report_server.router import router as report_router

__all__ = ["health_router", "report_router"]
