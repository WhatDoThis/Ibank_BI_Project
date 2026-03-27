"""
Backend.notification_server 패키지
==================================
/api/notifications 라우터 export.

[Dependencies]
=========
- Backend.notification_server.router
"""

from Backend.notification_server.router import router

__all__ = ["router"]
