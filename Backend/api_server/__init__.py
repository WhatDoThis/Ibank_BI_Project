"""
Backend.api_server (FastAPI 호스트 앱 패키지)
=============================================
앱 조립·CORS·라우터 등록. 리포트·구 대시보드 라우터는 Backend.report_server·Backend.legacy_dashboard_server에서 로드.

[Main]
===========
1. app: FastAPI 앱 인스턴스 (main에서 생성, health·report·dashboard·etl 등 라우터 등록·uvicorn 기동용)

[Dependencies]
=========
- Backend.api_server.main, Backend.core, Backend.report_server, Backend.legacy_dashboard_server, Backend.etl_server 등
"""

from Backend.api_server.main import app

__all__ = ['app']
