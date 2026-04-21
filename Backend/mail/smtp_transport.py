"""
Backend.mail.smtp_transport (SMTP 전송 코어)
====================================
`Backend.core.auth_config`의 SMTP 설정으로 `EmailMessage`를 발송한다. host 비어 있으면 로그 폴백만(`docs/report/17` SMTP 폴백 정책과 동일).

[Main Functions]
===========
1. send_email — 465 SSL / 그 외 STARTTLS 실패 시 평문 재시도; smtp 미설정 시 콘솔 폴백

[Endpoints/Classes/Functions]
=======================
- send_email(subject, body_text, to_addrs)

[Dependencies]
=========
- smtplib, ssl, logging
- Backend.core.auth_config
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from Backend.core import auth_config

_log = logging.getLogger(__name__)


# 1.
def send_email(subject: str, body_text: str, to_addrs: list[str]) -> None:
    if not to_addrs:
        return
    settings = auth_config.get_smtp_settings()
    if auth_config.is_smtp_skipped():
        _log.warning(
            "mail_smtp console_fallback reason=no_smtp_host to=%s subject=%s\n%s",
            to_addrs,
            subject,
            body_text,
        )
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings["from_addr"] or "no-reply@localhost"
    msg["To"] = ", ".join(to_addrs)
    msg.set_content(body_text)

    host = settings["host"]
    port = settings["port"]
    user = settings["user"]
    password = settings["password"]

    if port == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx) as smtp:
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls(context=ctx)
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
            return
    except Exception as ex:
        _log.warning("mail_smtp starttls_fail fallback_plain host=%s port=%s: %s", host, port, ex)

    with smtplib.SMTP(host, port, timeout=10) as smtp:
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
