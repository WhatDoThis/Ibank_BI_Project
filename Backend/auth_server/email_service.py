"""
Backend.auth_server.email_service (인증·초대 메일 발송)
=====================================================
SMTP 설정 시 발송, 미설정 시 서버 로그에 인증코드·링크 출력(문서 17 §2.7).

[Main Functions]
===========
1. send_email: SMTP 또는 로그 폴백(비 465 포트 STARTTLS 실패 시 경고 후 평문 시도)
2. send_login_code_email: 2차 인증 코드
3. send_invite_email: 초대 가입 URL

[Dependencies]
=========
- smtplib, ssl, logging
- Backend.core.auth_config
"""

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
            "[email_service.send_email] SMTP 생략(개발). to=%s subject=%s\n%s",
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

    # --- 465: 처음부터 SSL ---
    if port == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx) as smtp:
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return

    # --- 그 외 포트: 1차 STARTTLS(인증서 검증 스킵) 시도 ---
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
        _log.warning(
            "[email_service] STARTTLS 연결 실패, 평문 재시도. host=%s port=%s: %s",
            host,
            port,
            ex,
        )

    # --- 2차: 새 소켓으로 평문 발송 ---
    with smtplib.SMTP(host, port, timeout=10) as smtp:
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)


# 2.
def send_login_code_email(to_email: str, code: str) -> None:
    send_email(
        subject="[Ibank BI] 로그인 인증 코드",
        body_text=f"인증 코드: {code}\n5분 이내에 입력해 주세요.",
        to_addrs=[to_email],
    )


# 3.
def send_invite_email(to_email: str, signup_url: str) -> None:
    send_email(
        subject="[Ibank BI] 초대",
        body_text=f"가입 링크:\n{signup_url}",
        to_addrs=[to_email],
    )
