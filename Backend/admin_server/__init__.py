"""
Backend.admin_server 패키지
===========================
/api/admin 라우터 export.

[Dependencies]
=========
- Backend.admin_server.router
"""

from Backend.admin_server.router import router

__all__ = ["router"]
