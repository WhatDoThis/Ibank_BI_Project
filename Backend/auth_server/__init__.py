"""
Backend.auth_server 패키지
========================
/api/auth 라우터 export. `from Backend.auth_server import router` 가 APIRouter 인스턴스를 가리키도록 함.

[Dependencies]
=========
- Backend.auth_server.router
"""

from Backend.auth_server.router import router

__all__ = ["router"]
