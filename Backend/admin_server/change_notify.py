"""
Backend.admin_server.change_notify (권한·역할·계정 변경 알림+메일)
====================================================
관리 API에서 **커밋 성공 후** 호출한다. `actor_user_id`와 대상이 같으면 **앱 알림·이메일 모두 생략**.
`notification_info`는 `insert_notification(..., autocommit=True)`로 즉시 반영한다.
본문 `# N.`은 파일 읽기 순서이며, `2a`~`2c`·`4a`~`4c`는 동일 흐름 블록 내 연번이다.

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
- notify_user_management_changed(conn, actor_user_id, target_user_id, *, dvsn_changed, etl_changed, proj_changed, old_dvsn, new_dvsn, old_etl, new_etl) -> None
- notify_project_pmssn_changed(conn, actor_user_id, target_user_id, project_name, old_pmssn_name, new_pmssn_name, *, project_info_id) -> None
- notify_user_suspended(conn, actor_user_id, target_user_id) -> None
- notify_user_activated(conn, actor_user_id, target_user_id) -> None
- fetch_pmssn_name(conn, pmssn_master_id) -> str
- (내부·번호 없음) _skip_self, _actor_label, _safe_run — 자기 자신 생략·처리자 표시·예외 삼킴 로깅

[Dependencies]
=========
- json, logging
- Backend.mail.outbound.send_plain_notice_email_try
- Backend.notification_server.service.insert_notification, user_display_label_for_notification
"""

from __future__ import annotations

import json
import logging
from typing import Callable

from Backend.mail.outbound import send_plain_notice_email_try
from Backend.notification_server.service import (
    insert_notification,
    user_display_label_for_notification,
)

_log = logging.getLogger(__name__)

NOTI_ORG_ROLE = "org_role_changed"
NOTI_ETL = "etl_access_changed"
NOTI_USER_MGMT = "user_mgmt_changed"
NOTI_PROJECT_PMSSN = "project_pmssn_changed"
NOTI_ACTIVATED = "user_activated"


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


def _actor_label(conn, actor_user_id: int | None) -> str:
    if actor_user_id is None or int(actor_user_id) <= 0:
        return "시스템"
    return user_display_label_for_notification(conn, int(actor_user_id), max_len=80)


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
    al = _actor_label(conn, actor_user_id)
    title = (f"{al} 님이 조직 역할을 {old_dvsn}에서 {new_dvsn}(으)로 변경했습니다")[:200]
    plain = f"처리자: {al}\n조직 역할: {old_dvsn} → {new_dvsn}"
    meta = json.dumps(
        {"actor_user_id": actor_user_id, "old_user_dvsn": old_dvsn, "new_user_dvsn": new_dvsn},
        ensure_ascii=False,
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ORG_ROLE, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 조직 역할 변경 안내",
                body_text=plain,
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
    al = _actor_label(conn, actor_user_id)
    title = (f"{al} 님이 ETL 자격을 {old_yn}에서 {new_yn}(으)로 변경했습니다")[:200]
    plain = f"처리자: {al}\nETL 자격: {old_yn} → {new_yn}"
    meta = json.dumps(
        {"actor_user_id": actor_user_id, "old_etl_yn": old_yn, "new_etl_yn": new_yn},
        ensure_ascii=False,
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ETL, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] ETL 자격 변경 안내",
                body_text=plain,
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
    al = _actor_label(conn, actor_user_id)
    parts: list[str] = []
    if dvsn_changed and old_dvsn is not None and new_dvsn is not None:
        parts.append(f"조직 역할 {old_dvsn}→{new_dvsn}")
    if etl_changed and old_etl is not None and new_etl is not None:
        parts.append(f"ETL {old_etl}→{new_etl}")
    if proj_changed:
        parts.append("프로젝트 참여·권한 배정 변경")
    summary = ", ".join(parts) if parts else "계정 설정 변경"
    title = (f"{al} 님이 사용자 관리에서 변경했습니다 ({summary})")[:200]
    plain = f"처리자: {al}\n변경: {summary}"
    meta = json.dumps(
        {
            "actor_user_id": actor_user_id,
            "dvsn_changed": dvsn_changed,
            "etl_changed": etl_changed,
            "proj_changed": proj_changed,
        },
        ensure_ascii=False,
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_USER_MGMT, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 사용자 관리 변경 안내",
                body_text=plain,
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
    al = _actor_label(conn, actor_user_id)
    pname = (project_name or "").strip() or "프로젝트"
    title = (f"{al} 님이 '{pname}'에서 프로젝트 권한을 변경했습니다")[:200]
    plain = (
        f"처리자: {al}\n프로젝트: {pname}\n권한 템플릿: {old_pmssn_name} → {new_pmssn_name}"
    )
    meta = json.dumps(
        {
            "actor_user_id": actor_user_id,
            "project_info_id": int(project_info_id),
            "old_pmssn_name": old_pmssn_name,
            "new_pmssn_name": new_pmssn_name,
        },
        ensure_ascii=False,
    )

    def _go() -> None:
        insert_notification(conn, tid, NOTI_PROJECT_PMSSN, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 프로젝트 권한 변경 안내",
                body_text=plain,
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
    al = _actor_label(conn, actor_user_id)
    plain = f"처리자: {al}\n귀하의 계정이 정지되었습니다. 문의는 관리자에게 연락해 주세요."

    def _go() -> None:
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 계정 정지 안내",
                body_text=plain,
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
    al = _actor_label(conn, actor_user_id)
    title = (f"{al} 님이 계정을 활성화했습니다")[:200]
    plain = f"처리자: {al}\n계정이 활성화되었습니다. 로그인할 수 있습니다."
    meta = json.dumps({"actor_user_id": actor_user_id}, ensure_ascii=False)

    def _go() -> None:
        insert_notification(conn, tid, NOTI_ACTIVATED, title, meta, autocommit=True)
        em = fetch_user_email_for_notify(conn, tid)
        if em:
            send_plain_notice_email_try(
                em,
                subject="[Ibank BI] 계정 활성화 안내",
                body_text=plain,
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
