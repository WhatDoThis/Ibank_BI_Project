"""
widget_board_server (위젯 보드 API 패키지)
========================================
/api/widget-boards/* — system_db 메타·메인 DB 조회.

[Main Functions]
===========
- router: FastAPI APIRouter(`router.py`·`service.py`에서 `# N.` 정의).

[Dependencies]
=========
- Backend.widget_board_server.router
"""

from Backend.widget_board_server.router import router

__all__ = ["router"]
