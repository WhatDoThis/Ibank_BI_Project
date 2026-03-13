"""
Backend.api_server.routers (FastAPI 라우터 패키지)
==================================================
health·report·dashboard·dashboard2 라우터를 재export. main에서 include_router로 등록.

[Main]
===========
1. health_router, report_router, dashboard_router, dashboard2_router: 각 APIRouter 인스턴스

[Endpoints]
=======================
1. health: /health, /, /api, /api/
2. report: /api/* (list-tables, execute-query 등)
3. dashboard: /api/dashboard/* (data, filter-options, tables, required-columns, chart-data)
4. dashboard2: /api/dashboard2/* (동일 엔드포인트)

[Dependencies]
=========
- .health, .report, .dashboard, .dashboard2
"""

from .health import router as health_router
from .report import router as report_router
from .dashboard import router as dashboard_router
from .dashboard2 import router as dashboard2_router

__all__ = ["health_router", "report_router", "dashboard_router", "dashboard2_router"]
