"""
Backend.project_server 패키지
=============================
/api/projects 라우터 export.

[Main Functions]
===========
- (단일 진입) `router` re-export — 엔드포인트·`# N.` 번호는 `router.py`에만 둔다.

[Dependencies]
=========
- Backend.project_server.router
"""

from Backend.project_server.router import router

__all__ = ["router"]
