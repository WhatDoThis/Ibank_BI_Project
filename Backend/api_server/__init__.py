"""
Backend.api_server (FastAPI 호스트 앱 패키지)
=============================================
앱 조립·CORS·라우터 등록. 대시보드 HTTP는 campaign_dash_server(/api/campaign-dashboard)만 등록.

[Main]
===========
1. app: FastAPI 앱 인스턴스 (main에서 생성, health·report·etl·campaign·dashboard 등 라우터 등록·uvicorn 기동용)

[Dependencies]
=========
- Backend.api_server.main, Backend.core, Backend.query_studio_server, Backend.campaign_dash_server, Backend.etl_server 등
"""

from Backend.api_server.main import app

__all__ = ['app']
