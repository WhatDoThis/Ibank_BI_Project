"""
Backend.api_server (Flask API 서버)
===================================
Starbucks CRM NoCode Query Builder API. config.backend 사용.

[Main Exports]
===========
- app: Flask 앱 (main.py)

[Dependencies]
=========
- Backend.api_server.main
"""

from Backend.api_server.main import app

__all__ = ['app']
