"""
Backend.api_server (FastAPI API 서버)
=====================================
Starbucks CRM NoCode Query Builder API. config.backend 사용.

[Main Exports]
===========
- app: FastAPI 앱 인스턴스 (main.py)

[Dependencies]
=========
- Backend.api_server.main (FastAPI, uvicorn)
"""

from Backend.api_server.main import app

__all__ = ['app']
