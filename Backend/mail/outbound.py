"""
Backend.mail.outbound (발송용 메시지 조립·호출)
====================================
로그인 2차 인증·가입 초대 등 **도메인별 본문**을 만든 뒤 `smtp_transport.send_email`로 넘긴다. 신규 메일 유형은 이 모듈(또는 동일 패키지 내 분리 파일)에 함수를 추가한다.

[Main Functions]
===========
1. send_login_code_email
2. send_invite_email
3. send_plain_notice_email_try — 관리 알림 등, 실패 시 로그만
4. send_project_invite_existing_user_email — 가입 완료자 타부서 프로젝트 초대

[Endpoints/Classes/Functions]
=======================
- send_login_code_email, send_invite_email, send_plain_notice_email_try, send_project_invite_existing_user_email

[Dependencies]
=========
- logging
- Backend.mail.smtp_transport.send_email
- Backend.core.auth_config.get_app_url
"""

from __future__ import annotations

import logging

from Backend.core import auth_config
from Backend.mail.smtp_transport import send_email

_log = logging.getLogger(__name__)


# 1.
def send_login_code_email(to_email: str, code: str) -> None:
    send_email(
        subject="[Ibank BI] 로그인 인증 코드",
        body_text=f"인증 코드: {code}\n5분 이내에 입력해 주세요.",
        to_addrs=[to_email],
    )


# 2.
def send_invite_email(
    to_email: str,
    signup_url: str,
    *,
    department_name: str | None = None,
    org_role_ko: str | None = None,
    include_etl_y: bool = False,
    project_name: str | None = None,
    project_permission_name: str | None = None,
) -> None:
    lines: list[str] = ["IBank BI 가입 초대입니다.", ""]
    if department_name:
        lines.append(f"초대 부서: {department_name}")
    if org_role_ko:
        lines.append(f"부여될 조직 역할: {org_role_ko}")
    if include_etl_y:
        lines.append("ETL(데이터 연동·저장) 권한: 가입 후 활성화됩니다.")
    if project_name and project_permission_name:
        lines.append(f"가입 후 함께 참여할 프로젝트: {project_name}")
        lines.append(f"해당 프로젝트 권한 템플릿: {project_permission_name}")
    elif project_name:
        lines.append(f"가입 후 함께 참여할 프로젝트: {project_name}")
    lines.extend(
        [
            "",
            "아래 링크에서 이 메일 주소로 가입해 주세요. (초대 코드 유효 기간: 약 7일)",
            signup_url,
        ]
    )
    send_email(
        subject="[Ibank BI] 초대",
        body_text="\n".join(lines),
        to_addrs=[to_email],
    )


# 3.
def send_plain_notice_email_try(to_email: str, subject: str, body_text: str) -> None:
    """SMTP·수신자 오류 시 본 업무를 막지 않도록 try/except로 감싼 일반 메일."""
    if not (to_email or "").strip():
        return
    try:
        send_email(subject=subject, body_text=body_text, to_addrs=[to_email.strip()])
    except Exception:
        _log.warning(
            "mail outbound send_plain_notice_email_try failed to=%s subject=%s",
            to_email,
            subject,
            exc_info=True,
        )


# 4.
def send_project_invite_existing_user_email(
    to_email: str,
    *,
    project_name: str,
    inviter_label: str | None = None,
    invite_expires_at: str | None = None,
) -> None:
    """이미 가입된 사용자에게 프로젝트 초대(앱 알림 수락/거절) 안내. 가입 초대 `send_invite_email`과 분리."""
    if not (to_email or "").strip():
        return
    base = auth_config.get_app_url()
    open_hint = (
        f"{base.rstrip('/')}/"
        if base
        else "(앱 URL이 설정되지 않았습니다. 관리자에게 문의하세요.)"
    )
    who = (inviter_label or "").strip() or "관리자"
    exp = (invite_expires_at or "").strip()
    exp_line = f"초대 유효 기간(UTC 기준 안내): {exp}\n" if exp else ""
    lines = [
        "IBank BI 프로젝트 초대가 도착했습니다.",
        "",
        f"프로젝트: {project_name or '—'}",
        f"초대: {who}",
        "",
        exp_line + "로그인한 뒤 우측 상단 알림(벨)에서 수락 또는 거절할 수 있습니다.",
        f"앱 열기: {open_hint}",
    ]
    send_plain_notice_email_try(
        to_email.strip(),
        subject="[Ibank BI] 프로젝트 초대",
        body_text="\n".join(lines),
    )
