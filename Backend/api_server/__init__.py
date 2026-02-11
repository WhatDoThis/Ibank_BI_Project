"""
Backend.api_server (FastAPI API 서버 패키지)
============================================
Starbucks CRM 노코드 쿼리 빌더·대시보드 REST API. main 모듈의 FastAPI 앱을 재export.

[Main Functions]
===========
- app: FastAPI 앱 인스턴스 (main.py에서 생성, 라우터 등록·uvicorn 기동용)

[Endpoints/Classes/Functions]
=======================
- app (FastAPI): 진입점. health·report·dashboard·dashboard2 라우터 포함.

[Dependencies]
=========
- Backend.api_server.main (FastAPI, uvicorn)
"""

from Backend.api_server.main import app

__all__ = ['app']
