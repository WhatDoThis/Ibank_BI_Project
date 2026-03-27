"""
Backend.campaign_dash_server (캠페인 대시보드 API 패키지)
======================================================
ibank_*_star_1 / ibank_*_star_2 JSONB 집약 테이블 전용. prefix /api/campaign-dashboard — 앱에서 등록되는 유일 대시보드 API.

[Exports]
=========
- router: FastAPI APIRouter
"""

from Backend.campaign_dash_server.router import router

__all__ = ["router"]
