"""
Backend.admin_server.change_notify (권한·역할·계정 변경 알림+메일)
====================================================
관리 API에서 **커밋 성공 후** 호출한다. `actor_user_id`와 대상이 같으면 **앱 알림·이메일 모두 생략**.
`notification_info`는 `insert_notification(..., autocommit=True)`로 즉시 반영한다.
이메일·앱 메타(`summary_plain`)는 동일한 ◎ 블록(변경 범위·관리자·변경 내용)을 사용한다. 조직 역할은 사용자 관리 UI와 동일한 **S/A/B/C/SADEV** 표기, HTML 메일에서 역할·Y/N은 `<strong>` 처리.

[Main Functions]
===========
1. fetch_user_email_for_notify — 대상 사용자 이메일 조회(본문 `# 1.`)
2a. notify_org_role_changed — 조직 역할 변경 알림+메일(본문 `# 2a.`)
2b. notify_etl_access_changed — ETL 자격 변경 알림+메일(본문 `# 2b.`)
2c. notify_user_management_changed — 사용자 관리 일괄 변경 알림+메일(본문 `# 2c.`)
3. notify_project_pmssn_changed — 프로젝트 권한 템플릿 변경 알림+메일(본문 `# 3.`)
4a. notify_user_suspended — 정지 안내 메일(알림 없음, 본문 `# 4a.`)
4b. notify_user_activated — 활성화 알림+메일(본문 `# 4b.`)
4c. fetch_pmssn_name — pmssn_master_id→표시명(알림·메일 본문용, 본문 `# 4c.`)

[Endpoints/Classes/Functions]
=======================
- fetch_user_email_for_notify(conn, user_id) -> str | None
- notify_org_role_changed(conn, actor_user_id, target_user_id, old_dvsn, new_dvsn) -> None
- notify_etl_access_changed(conn, actor_user_id, target_user_id, old_yn, new_yn) -> None
- notify_user_management_changed(conn, actor_user_id, target_user_id, *, ...) -> None
- notify_project_pmssn_changed(conn, actor_user_id, target_user_id, project_name, old_pmssn_name, new_pmssn_name, *, project_info_id) -> None
- notify_user_suspended(conn, actor_user_id, target_user_id) -> None
- notify_user_activated(conn, actor_user_id, target_user_id) -> None
- fetch_pmssn_name(conn, pmssn_master_id) -> str
- (내부) _skip_self, _actor_admin_pair, _dvsn_letter, _notice_email_bodies, _meta_pack, _safe_run
- actor_plain_html_for_email(conn, actor_user_id) -> tuple[str, str] — 프로젝트 초대 메일용 닉(이메일) plain·html

[Dependencies]
=========
- json, logging, html.escape
- Backend.mail.outbound.send_plain_notice_email_try
- Backend.notification_server.service.insert_notification
"""

from __future__ import annotations

import json
import logging
from html import escape
from typing import Any, Callable

from Backend.mail.outbound import send_plain_notice_email_try
from Backend.notification_server.service import insert_notification

_log = logging.getLogger(__name__)

NOTI_ORG_ROLE = "org_role_changed"
NOTI_ETL = "etl_access_changed"
NOTI_USER_MGMT = "user_mgmt_changed"
NOTI_PROJECT_PMSSN = "project_pmssn_changed"
NOTI_ACTIVATED = "user_activated"

_DVSN_LETTER: dict[str, str] = {
    "sa_dev": "SADEV",
    "sa": "S",
    "a": "A",
    "o": "B",
    "u": "C",
}


# 1.
def fetch_user_email_for_notify(conn, user_id: int) -> str | None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT NULLIF(TRIM(COALESCE(user_email, '')), '') AS em
            FROM user_info WHERE user_id = %s
            """,
            (int(user_id),),
        )
        row = cur.fetchone()
        if not row or not row.get("em"):
            return None
        return str(row["em"]).strip()
    finally:
        cur.close()


def _skip_self(actor_user_id: int | None, target_user_id: int) -> bool:
    if actor_user_id is None:
        return False
    return int(actor_user_id) == int(target_user_id)


def _dvsn_letter(raw: str | None) -> str:
    if raw is None:
        return "—"
    k = str(raw).strip().lower()
    if not k:
        return "—"
    if k in _DVSN_LETTER:
        return _DVSN_LETTER[k]
    return str(raw).strip().upper()


def _actor_admin_pair(conn, actor_user_id: int | None) -> tuple[str, str, str]:
    """변경한 관리자: (plain, html, short_for_title)."""
    if actor_user_id is None or int(actor_user_id) <= 0:
        return ("시스템", "시스템", "시스템")
    uid = int(actor_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
              NULLIF(TRIM(COALESCE(user_nickname, '')), '') AS nick,
              NULLIF(TRIM(COALESCE(user_email, '')), '') AS em
            FROM user_info WHERE user_id = %s
            """,
            (uid,),
        )
        row = cur.fetchone() or {}
        nick_s = str(row.get("nick") or "").strip()
        em_s = str(row.get("em") or "").strip()
        if nick_s and em_s:
            plain = f"{nick_s} ({em_s})"
            html_a = f"{escape(nick_s)} ({escape(em_s)})"
            short = plain if len(plain) <= 72 else f"{nick_s} ({em_s[:28]}…)"
            return plain, html_a, short
        if em_s:
            return em_s, escape(em_s), em_s
        if nick_s:
            return nick_s, escape(nick_s), nick_s
        fb = f"user_id {uid}"
        return fb, escape(fb), fb
    finally:
        cur.close()


def actor_plain_html_for_email(conn, actor_user_id: int | None) -> tuple[str, str]:
    """프로젝트 초대 메일 등: (plain `닉네임 (이메일)`, html 이스케이프 동일)."""
    p, h, _ = _actor_admin_pair(conn, actor_user_id)
    return p, h


def _notice_email_bodies(
    scope: str,
    admin_plain: str,
    admin_html: str,
    change_plain: str,
    change_html: str,
) -> tuple[str, str]:
    plain = "\n".join(
        [
            "",
            "",
            f"◎ 변경 범위: {scope}",
            "",
            "",
            f"◎ 변경한 관리자: {admin_plain}",
            "",
            "",
            "◎ 변경 내용:",
            change_plain,
        ]
    )
    html_body = (
        '<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;'
        'line-height:1.55;color:#111;">'
        '<p style="margin:0 0 12px;">&nbsp;</p>'
        f'<p style="margin:0 0 12px;"><strong>◎ 변경 범위:</strong> {escape(scope)}</p>'
        '<p style="margin:0 0 12px;">&nbsp;</p>'
        f'<p style="margin:0 0 12px;"><strong>◎ 변경한 관리자:</strong> {admin_html}</p>'
        '<p style="margin:0 0 12px;">&nbsp;</p>'
        f'<p style="margin:0;"><strong>◎ 변경 내용:</strong><br>{change_html}</p>'
        "</div>"
    )
    return plain, html_body


def _org_role_change_plain(old_dvsn: str, new_dvsn: str) -> str:
    o = _dvsn_letter(old_dvsn)
    n = _dvsn_letter(new_dvsn)
    return f"조직 역할이 {o} 에서 {n} 로 변경되었습니다."


def _org_role_change_html(old_dvsn: str, new_dvsn: str) -> str:
    o = escape(_dvsn_letter(old_dvsn))
    n = escape(_dvsn_letter(new_dvsn))
    return f"조직 역할이 <strong>{o}</strong> 에서 <strong>{n}</strong> 로 변경되었습니다."


def _etl_change_plain(old_yn: str, new_yn: str) -> str:
    a, b = str(old_yn).strip().upper(), str(new_yn).strip().upper()
    return f"ETL 관리 자격이 {a} 에서 {b} 으로 변경되었습니다."


def _etl_change_html(old_yn: str, new_yn: str) -> str:
    a, b = escape(str(old_yn).strip().upper()), escape(str(new_yn).strip().upper())
    return f"ETL 관리 자격이 <strong>{a}</strong> 에서 <strong>{b}</strong> 으로 변경되었습니다."


def _project_pmssn_change_plain(pname: str, old_n: str, new_n: str) -> str:
    pn = (pname or "").strip() or "프로젝트"
    o = (old_n or "").strip() or "—"
    n = (new_n or "").strip() or "—"
    return f"프로젝트 ‘{pn}’의 권한이 {o} 에서 {n} 으로 변경되었습니다."


def _project_pmssn_change_html(pname: str, old_n: str, new_n: str) -> str:
    pn = escape((pname or "").strip() or "프로젝트")
    o = escape((old_n or "").strip() or "—")
    n = escape((new_n or "").strip() or "—")
    return f"프로젝트 ‘{pn}’의 권한이 <strong>{o}</strong> 에서 <strong>{n}</strong> 으로 변경되었습니다."


def _meta_pack(extra: dict[str, Any]) -> str:
    return json.dumps(extra, ensure_ascii=False)


def _safe_run(label: str, fn: Callable[[], None]) -> None:
    try:
        fn()
    except Exception:
        _log.warning("change_notify %s failed", label, exc_info=True)


# 2a.
def notify_org_role_changed(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
    old_dvsn: str,
    new_dvsn: str,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    cp = _org_role_change_plain(old_dvsn, new_dvsn)
    ch = _org_role_change_html(old_dvsn, new_dvsn)
    body_plain, body_html = _notice_email_bodies("조직 역할", admin_plain, admin_html, cp, ch)
    title = "조직 역할 변경"[:200]
    meta = _meta_pack(
        {
            "actor_user_id": actor_user_id,
            "old_user_dvsn": old_dvsn,
            "new_user_dvsn": new_dvsn,
            "summary_plain": body_plain,
        }
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ORG_ROLE, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 조직 역할 변경 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_org_role_changed", _go)


# 2b.
def notify_etl_access_changed(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
    old_yn: str,
    new_yn: str,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    cp = _etl_change_plain(old_yn, new_yn)
    ch = _etl_change_html(old_yn, new_yn)
    body_plain, body_html = _notice_email_bodies("ETL 관리", admin_plain, admin_html, cp, ch)
    title = "ETL 관리 변경"[:200]
    meta = _meta_pack(
        {
            "actor_user_id": actor_user_id,
            "old_etl_yn": old_yn,
            "new_etl_yn": new_yn,
            "summary_plain": body_plain,
        }
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ETL, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] ETL 자격 변경 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_etl_access_changed", _go)


# 2c.
def notify_user_management_changed(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
    *,
    dvsn_changed: bool,
    etl_changed: bool,
    proj_changed: bool,
    old_dvsn: str | None,
    new_dvsn: str | None,
    old_etl: str | None,
    new_etl: str | None,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    if not (dvsn_changed or etl_changed or proj_changed):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    scope_parts: list[str] = []
    if dvsn_changed:
        scope_parts.append("조직 역할")
    if etl_changed:
        scope_parts.append("ETL 관리")
    if proj_changed:
        scope_parts.append("프로젝트 권한")
    scope = ", ".join(scope_parts) if scope_parts else "사용자 관리"
    c_plain_lines: list[str] = []
    c_html_parts: list[str] = []
    if dvsn_changed and old_dvsn is not None and new_dvsn is not None:
        c_plain_lines.append(_org_role_change_plain(old_dvsn, new_dvsn))
        c_html_parts.append(_org_role_change_html(old_dvsn, new_dvsn))
    if etl_changed and old_etl is not None and new_etl is not None:
        c_plain_lines.append(_etl_change_plain(old_etl, new_etl))
        c_html_parts.append(_etl_change_html(old_etl, new_etl))
    if proj_changed:
        c_plain_lines.append(
            "프로젝트 참여 또는 프로젝트 권한(템플릿)이 변경되었습니다. "
            "(저장된 배정은 앱 사용자 관리에서 확인해 주세요.)"
        )
        c_html_parts.append(
            escape(
                "프로젝트 참여 또는 프로젝트 권한(템플릿)이 변경되었습니다. "
                "(저장된 배정은 앱 사용자 관리에서 확인해 주세요.)"
            )
        )
    change_plain = "\n\n".join(c_plain_lines)
    change_html = "<br><br>".join(c_html_parts)
    body_plain, body_html = _notice_email_bodies(scope, admin_plain, admin_html, change_plain, change_html)
    title = "사용자 관리 변경"[:200]
    meta = _meta_pack(
        {
            "actor_user_id": actor_user_id,
            "dvsn_changed": dvsn_changed,
            "etl_changed": etl_changed,
            "proj_changed": proj_changed,
            "summary_plain": body_plain,
        }
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_USER_MGMT, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 사용자 관리 변경 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_user_management_changed", _go)


# 3.
def notify_project_pmssn_changed(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
    project_name: str,
    old_pmssn_name: str,
    new_pmssn_name: str,
    *,
    project_info_id: int,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    pname = (project_name or "").strip() or "프로젝트"
    cp = _project_pmssn_change_plain(pname, old_pmssn_name, new_pmssn_name)
    ch = _project_pmssn_change_html(pname, old_pmssn_name, new_pmssn_name)
    body_plain, body_html = _notice_email_bodies("프로젝트 권한", admin_plain, admin_html, cp, ch)
    title = "프로젝트 권한 변경"[:200]
    meta = _meta_pack(
        {
            "actor_user_id": actor_user_id,
            "project_info_id": int(project_info_id),
            "old_pmssn_name": old_pmssn_name,
            "new_pmssn_name": new_pmssn_name,
            "summary_plain": body_plain,
        }
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_PROJECT_PMSSN, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 프로젝트 권한 변경 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_project_pmssn_changed", _go)


# 4a.
def notify_user_suspended(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    cp = "귀하의 계정이 정지되었습니다. 문의는 관리자에게 연락해 주세요."
    ch = escape(cp)
    body_plain, body_html = _notice_email_bodies("계정 정지", admin_plain, admin_html, cp, ch)

    def _go() -> None:
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 계정 정지 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_user_suspended", _go)


# 4b.
def notify_user_activated(
    conn,
    actor_user_id: int | None,
    target_user_id: int,
) -> None:
    if _skip_self(actor_user_id, target_user_id):
        return
    tid = int(target_user_id)
    admin_plain, admin_html, _ = _actor_admin_pair(conn, actor_user_id)
    cp = "계정이 활성화되었습니다. 로그인할 수 있습니다."
    ch = escape(cp)
    body_plain, body_html = _notice_email_bodies("계정 활성화", admin_plain, admin_html, cp, ch)
    title = "계정 활성화"[:200]
    meta = _meta_pack({"actor_user_id": actor_user_id, "summary_plain": body_plain})

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ACTIVATED, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 계정 활성화 안내",
                body_text=body_plain,
                body_html=body_html,
            )

    _safe_run("notify_user_activated", _go)


# 4c. — pmssn_master_id → 표시명 (알림·메일용)
def fetch_pmssn_name(conn, pmssn_master_id: int) -> str:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT NULLIF(TRIM(COALESCE(pmssn_name, '')), '') AS n FROM pmssn_master WHERE pmssn_master_id = %s",
            (int(pmssn_master_id),),
        )
        row = cur.fetchone()
        if row and row.get("n"):
            return str(row["n"]).strip()
        return f"(pmssn_master_id={int(pmssn_master_id)})"
    finally:
        cur.close()
