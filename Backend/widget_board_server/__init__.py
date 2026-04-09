"""
widget_board_server (위젯 보드 API 패키지)
========================================
/api/widget-boards/* — system_db 메타·메인 DB 조회.

[Dependencies]
=========
- router: FastAPI APIRouter
"""

from Backend.widget_board_server.router import router

__all__ = ["router"]
