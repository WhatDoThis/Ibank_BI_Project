"""
widget_board_server (위젯 보드 API 패키지)
========================================
/api/widget-boards/* — system_db 메타·메인 DB 조회.

[Main Functions]
===========
- router: FastAPI APIRouter(`router.py`·`service.py`에서 `# N.` 정의).
- admin_router: 위젯보드 관리용(`require_org_admin`로 별도 include).

[Dependencies]
=========
- Backend.widget_board_server.router
"""

from Backend.widget_board_server.router import admin_router, router

__all__ = ["router", "admin_router"]
