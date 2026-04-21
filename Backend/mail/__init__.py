"""
Backend.mail (공용 SMTP·발송 메시지)
====================================
인증·관리·향후 알림 계열에서 공유하는 **메일 전송 패키지**. HTTP 서버가 아니라 **라이브러리 모듈**이다.

[Main Functions]
===========
- smtp_transport.send_email
- outbound.send_login_code_email, send_invite_email, send_plain_notice_email_try, send_project_invite_existing_user_email

[Dependencies]
=========
- Backend.mail.smtp_transport, Backend.mail.outbound
"""

from Backend.mail.outbound import (
    send_invite_email,
    send_login_code_email,
    send_plain_notice_email_try,
    send_project_invite_existing_user_email,
)
from Backend.mail.smtp_transport import send_email

__all__ = [
    "send_email",
    "send_invite_email",
    "send_login_code_email",
    "send_plain_notice_email_try",
    "send_project_invite_existing_user_email",
]
