"""
Backend.new_dash_server (뉴 대시보드 API 패키지)
================================================
일간/주간/월간 현황판 전용 라우터. api_server.dashboard_service·db 재활용.

[Exports]
=========
- router: FastAPI APIRouter, prefix /api/new-dashboard
"""

from Backend.new_dash_server.router import router

__all__ = ["router"]
