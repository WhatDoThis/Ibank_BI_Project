"""
Backend.admin_server 패키지
===========================
/api/admin 라우터 export.

[Main Functions]
===========
- (단일 진입) `router` re-export — 엔드포인트·`# N.` 번호는 `router.py`에만 둔다.

[Dependencies]
=========
- Backend.admin_server.router
"""

from Backend.admin_server.router import router

__all__ = ["router"]
