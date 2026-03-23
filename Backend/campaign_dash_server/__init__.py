"""
Backend.campaign_dash_server (캠페인 대시보드 API 패키지)
======================================================
ibank_*_star_1 / ibank_*_star_2 JSONB 집약 테이블 전용. new_dash_server와 동일 응답 계약, prefix /api/campaign-dashboard.

[Exports]
=========
- router: FastAPI APIRouter
"""

from Backend.campaign_dash_server.router import router

__all__ = ["router"]
