"""
Backend.api_server.routers
==========================
FastAPI 라우터 모듈. health(헬스·루트), report(리포트/쿼리 빌더 API), dashboard(대시보드 API).
"""

from .health import router as health_router
from .report import router as report_router
from .dashboard import router as dashboard_router

__all__ = ["health_router", "report_router", "dashboard_router"]
