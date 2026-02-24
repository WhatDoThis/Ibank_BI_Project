"""
Backend.api_server (FastAPI API 서버 패키지)
============================================
노코드 쿼리 빌더·대시보드·ETL REST API. main 모듈의 FastAPI 앱을 재export.

[Main]
===========
app: FastAPI 앱 인스턴스 (main에서 생성, health·report·dashboard·dashboard2·etl 라우터 등록·uvicorn 기동용)

[Dependencies]
=========
- Backend.api_server.main
"""

from Backend.api_server.main import app

__all__ = ['app']
