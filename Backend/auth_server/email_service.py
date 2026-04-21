"""
Backend.auth_server.email_service (호환용 재export)
====================================
구현은 **`Backend.mail`** 패키지로 이전되었다. 기존 `from Backend.auth_server import email_service` 경로를 깨지 않기 위해 동일 이름을 재export한다. **신규 코드는 `Backend.mail`을 직접 import**한다.

[Main Functions]
===========
- send_email, send_login_code_email, send_invite_email → Backend.mail

[Dependencies]
=========
- Backend.mail
"""

from Backend.mail import send_email, send_invite_email, send_login_code_email

__all__ = ["send_email", "send_invite_email", "send_login_code_email"]
