"""
Backend.mail.outbound (발송용 메시지 조립·호출)
====================================
로그인 2차 인증·가입 초대 등 **도메인별 본문**을 만든 뒤 `smtp_transport.send_email`로 넘긴다. 신규 메일 유형은 이 모듈(또는 동일 패키지 내 분리 파일)에 함수를 추가한다.

[Main Functions]
===========
1. send_login_code_email — ◎ 인증 코드·5분 강조(HTML)·평문(빈 줄)
2. send_invite_email — ◎ 가입 링크·유효 일수·초대코드 안내(HTML 링크)
3. format_invite_deadline_kr — UTC ISO → 한국 시각 `YYYY/MM/DD HH:MM:SS`(접미사 없음)
4. build_project_invite_plain_body / build_project_invite_noti_summary — 초대 평문(메일 등) / 알림 벨용 짧은 요약
5. send_plain_notice_email_try — 관리 알림 등, 실패 시 로그만(선택 `body_html` 시 HTML 파트 추가)
6. send_project_invite_existing_user_email — 가입 완료자 타부서 프로젝트 초대(◎ 블록·KR 만료·HTML)

[Endpoints/Classes/Functions]
=======================
- send_login_code_email, send_invite_email, format_invite_deadline_kr, build_project_invite_plain_body, build_project_invite_noti_summary
- send_plain_notice_email_try, send_project_invite_existing_user_email

[Dependencies]
=========
- logging, html.escape, datetime, zoneinfo.ZoneInfo
- Backend.mail.smtp_transport.send_email
- Backend.core.auth_config.get_app_url
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from html import escape

from Backend.core import auth_config
from Backend.mail.smtp_transport import send_email

_log = logging.getLogger(__name__)

try:
    from zoneinfo import ZoneInfo

    _KR = ZoneInfo("Asia/Seoul")
except Exception:  # noqa: BLE001 — Windows 등에서 tzdata 미설치 시 UTC+9 고정
    _KR = timezone(timedelta(hours=9))


def format_invite_deadline_kr(iso_utc: str | None) -> str:
    """초대·만료 ISO(UTC)를 **한국(Asia/Seoul)** 로 변환한 `YYYY/MM/DD HH:MM:SS`(타임존 접미사 없음)."""
    if not (iso_utc or "").strip():
        return "—"
    try:
        s = iso_utc.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(_KR).strftime("%Y/%m/%d %H:%M:%S")
    except Exception:
        return iso_utc.strip()


def build_project_invite_plain_body(
    *,
    project_name: str,
    project_department_name: str,
    permission_line: str,
    inviter_plain: str,
    deadline_kr: str,
    app_url: str,
    include_bell_footer: bool,
) -> str:
    """◎ 블록 + 만료 문구 + ◎ URL. 빈 줄은 `\\n` 연속으로 구성."""
    pname = (project_name or "").strip() or "—"
    pdept = (project_department_name or "").strip() or "—"
    perm = (permission_line or "").strip() or "—"
    who = (inviter_plain or "").strip() or "관리자"
    url = (app_url or "").strip() or "—"
    lines: list[str] = [
        "",
        "IBank BI 프로젝트 초대가 도착했습니다.",
        "",
        "",
        f"◎ 프로젝트명: {pname}",
        "",
        f"◎ 프로젝트 진행부서: {pdept}",
        "",
        f"◎ 프로젝트 권한: {perm}",
        "",
        f"◎ 초대한 유저: {who}",
        "",
        "",
        f"{deadline_kr} 까지 초대 상태가 유지됩니다.",
        "위 만료일시 전까지 초대를 수락하거나, 원치 않으시면 거절해 주세요.",
        "",
        "◎ URL:",
        url,
    ]
    if include_bell_footer:
        lines.extend(
            [
                "",
                "로그인한 뒤 우측 상단 알림(벨)에서 수락 또는 거절할 수 있습니다.",
            ]
        )
    return "\n".join(lines)


def build_project_invite_noti_summary(
    *,
    project_name: str,
    project_department_name: str,
    permission_line: str,
    inviter_plain: str,
    deadline_kr: str,
    max_perm_chars: int = 140,
) -> str:
    """프로젝트 초대 알림 벨용. `build_project_invite_plain_body`(메일용)와 분리·빈 줄 없음."""
    pname = (project_name or "").strip() or "—"
    pdept = (project_department_name or "").strip() or "—"
    perm = (permission_line or "").strip() or "—"
    if len(perm) > int(max_perm_chars):
        perm = perm[: int(max_perm_chars) - 1].rstrip() + "…"
    who = (inviter_plain or "").strip() or "—"
    dl = (deadline_kr or "").strip() or "—"
    return "\n".join(
        [
            f"프로젝트: {pname}",
            f"부서: {pdept}",
            f"권한: {perm}",
            f"초대: {who}",
            f"만료: {dl}",
        ]
    )


# 1.
def send_login_code_email(to_email: str, code: str) -> None:
    c_plain = (code or "").strip()
    c_esc = escape(c_plain)
    body_text = "\n".join(
        [
            "",
            "",
            f"◎ 인증 코드: {c_plain}",
            "",
            "",
            "5분 이내에 입력해 주세요.",
        ]
    )
    body_html = (
        '<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#111;">'
        "<p style=\"margin:0 0 14px;\">&nbsp;</p>"
        f"<p style=\"margin:0 0 10px;\"><strong>◎ 인증 코드:</strong> <strong>{c_esc}</strong></p>"
        "<p style=\"margin:0 0 14px;\">&nbsp;</p>"
        "<p style=\"margin:0;\"><strong>5분</strong> 이내에 입력해 주세요.</p>"
        "</div>"
    )
    send_email(
        subject="[Ibank BI] 로그인 인증 코드",
        body_text=body_text,
        to_addrs=[to_email],
        body_html=body_html,
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
    valid_days: int = 7,
) -> None:
    url = (signup_url or "").strip()
    vd = int(valid_days) if int(valid_days) > 0 else 7
    lines_plain: list[str] = [
        "",
        "",
        "IBank BI 가입 초대입니다.",
        "",
        "",
        "◎ 가입 링크:",
        url,
        "",
    ]
    if department_name:
        lines_plain.extend(["", f"◎ 초대 부서: {department_name}"])
    if org_role_ko:
        lines_plain.extend(["", f"◎ 부여될 조직 역할: {org_role_ko}"])
    if include_etl_y:
        lines_plain.extend(["", "◎ ETL(데이터 연동·저장) 권한: 가입 후 활성화됩니다."])
    if project_name and project_permission_name:
        lines_plain.extend(
            [
                "",
                f"◎ 가입 후 참여 프로젝트: {project_name}",
                "",
                f"◎ 해당 프로젝트 권한 템플릿: {project_permission_name}",
            ]
        )
    elif project_name:
        lines_plain.extend(["", f"◎ 가입 후 참여 프로젝트: {project_name}"])
    lines_plain.extend(
        [
            "",
            "",
            f"{vd}일 이내에 위 URL에 접속하셔서 가입을 진행하시거나, "
            "URL의 'code=' 뒷 부분인 초대코드를 사용하지 않으시면 소멸됩니다.",
        ]
    )

    url_esc = escape(url)
    html_parts: list[str] = [
        '<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#111;">',
        '<p style="margin:0 0 14px;">&nbsp;</p>',
        "<p><strong>IBank BI 가입 초대입니다.</strong></p>",
        '<p style="margin:0 0 14px;">&nbsp;</p>',
        f'<p><strong>◎ 가입 링크:</strong><br><a href="{url_esc}">{url_esc}</a></p>',
    ]
    if department_name:
        html_parts.append(
            f'<p style="margin:14px 0 0;"><strong>◎ 초대 부서:</strong> {escape(department_name)}</p>'
        )
    if org_role_ko:
        html_parts.append(
            f'<p style="margin:14px 0 0;"><strong>◎ 부여될 조직 역할:</strong> {escape(org_role_ko)}</p>'
        )
    if include_etl_y:
        html_parts.append(
            '<p style="margin:14px 0 0;"><strong>◎ ETL(데이터 연동·저장) 권한:</strong> 가입 후 활성화됩니다.</p>'
        )
    if project_name and project_permission_name:
        html_parts.append(
            f'<p style="margin:14px 0 0;"><strong>◎ 가입 후 참여 프로젝트:</strong> {escape(project_name)}</p>'
        )
        html_parts.append(
            f'<p style="margin:14px 0 0;"><strong>◎ 해당 프로젝트 권한 템플릿:</strong> {escape(project_permission_name)}</p>'
        )
    elif project_name:
        html_parts.append(
            f'<p style="margin:14px 0 0;"><strong>◎ 가입 후 참여 프로젝트:</strong> {escape(project_name)}</p>'
        )
    html_parts.append('<p style="margin:18px 0 0;">&nbsp;</p>')
    html_parts.append(
        f"<p>{escape(str(vd))}일 이내에 위 URL에 접속하셔서 가입을 진행하시거나, "
        "URL의 <code>code=</code> 뒷 부분인 초대코드를 사용하지 않으시면 소멸됩니다.</p>"
    )
    html_parts.append("</div>")
    body_html = "".join(html_parts)

    send_email(
        subject="[Ibank BI] 초대",
        body_text="\n".join(lines_plain),
        to_addrs=[to_email],
        body_html=body_html,
    )


# 5.
def send_plain_notice_email_try(
    to_email: str,
    subject: str,
    body_text: str,
    *,
    body_html: str | None = None,
) -> None:
    """SMTP·수신자 오류 시 본 업무를 막지 않도록 try/except로 감싼 일반 메일."""
    if not (to_email or "").strip():
        return
    try:
        send_email(
            subject=subject,
            body_text=body_text,
            to_addrs=[to_email.strip()],
            body_html=body_html,
        )
    except Exception:
        _log.warning(
            "mail outbound send_plain_notice_email_try failed to=%s subject=%s",
            to_email,
            subject,
            exc_info=True,
        )


# 6.
def send_project_invite_existing_user_email(
    to_email: str,
    *,
    project_name: str,
    project_department_name: str,
    permission_line: str,
    inviter_plain: str,
    inviter_html: str,
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
    pname = (project_name or "").strip() or "—"
    pdept = (project_department_name or "").strip() or "—"
    perm = (permission_line or "").strip() or "—"
    who_p = (inviter_plain or "").strip() or "관리자"
    who_h = (inviter_html or "").strip() or escape(who_p)
    deadline_kr = format_invite_deadline_kr(invite_expires_at)
    open_esc = escape(open_hint)

    body_text = build_project_invite_plain_body(
        project_name=pname,
        project_department_name=pdept,
        permission_line=perm,
        inviter_plain=who_p,
        deadline_kr=deadline_kr,
        app_url=open_hint,
        include_bell_footer=True,
    )

    body_html = (
        '<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#111;">'
        '<p style="margin:0 0 14px;">&nbsp;</p>'
        "<p><strong>IBank BI 프로젝트 초대가 도착했습니다.</strong></p>"
        '<p style="margin:0 0 14px;">&nbsp;</p>'
        f"<p><strong>◎ 프로젝트명:</strong> {escape(pname)}</p>"
        '<p style="margin:0 0 10px;">&nbsp;</p>'
        f"<p><strong>◎ 프로젝트 진행부서:</strong> {escape(pdept)}</p>"
        '<p style="margin:0 0 10px;">&nbsp;</p>'
        f"<p><strong>◎ 프로젝트 권한:</strong> {escape(perm)}</p>"
        '<p style="margin:0 0 10px;">&nbsp;</p>'
        f"<p><strong>◎ 초대한 유저:</strong> {who_h}</p>"
        '<p style="margin:0 0 14px;">&nbsp;</p>'
        f"<p>{escape(deadline_kr)} 까지 초대 상태가 유지됩니다.<br>"
        "위 만료일시 전까지 초대를 수락하거나, 원치 않으시면 거절해 주세요.</p>"
        '<p style="margin:0 0 10px;">&nbsp;</p>'
        f'<p><strong>◎ URL:</strong><br><a href="{open_esc}">{open_esc}</a></p>'
        '<p style="margin:0 0 10px;">&nbsp;</p>'
        "<p>로그인한 뒤 우측 상단 알림(벨)에서 수락 또는 거절할 수 있습니다.</p>"
        "</div>"
    )

    send_plain_notice_email_try(
        to_email.strip(),
        subject="[Ibank BI] 프로젝트 초대",
        body_text=body_text,
        body_html=body_html,
    )
