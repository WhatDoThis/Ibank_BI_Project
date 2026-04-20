"""
Backend.system_log_server (패키지 진입)
======================================
system_log 조회 API 라우터 재export.

[Main Functions]
===========
- router: FastAPI APIRouter

[Dependencies]
=========
- Backend.system_log_server.router
"""

from Backend.system_log_server.router import router

__all__ = ["router"]
