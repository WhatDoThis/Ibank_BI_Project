"""
Backend.project_server 패키지
=============================
/api/projects 라우터 export.

[Dependencies]
=========
- Backend.project_server.router
"""

from Backend.project_server.router import router

__all__ = ["router"]
