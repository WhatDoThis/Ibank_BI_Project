"""
Backend.api_server.routers (FastAPI 라우터 모듈)
=================================================
health, report(리포트/쿼리 빌더), dashboard(대시보드1), dashboard2(대시보드2) 라우터 export.
"""

from .health import router as health_router
from .report import router as report_router
from .dashboard import router as dashboard_router
from .dashboard2 import router as dashboard2_router

__all__ = ["health_router", "report_router", "dashboard_router", "dashboard2_router"]
