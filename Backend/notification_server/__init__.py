"""
Backend.notification_server 패키지
==================================
/api/notifications 라우터 export.

[Main Functions]
===========
- router 재export(HTTP 핸들러 번호는 `router.py`).

[Dependencies]
=========
- Backend.notification_server.router
"""

from Backend.notification_server.router import router

__all__ = ["router"]
