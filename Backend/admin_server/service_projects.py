"""
Backend.admin_server.service_projects (프로젝트·멤버)
================================================
부서 소유 프로젝트 CRUD, 멤버 추가 시 알림.

[Main Functions]
===========
1. create_project_full — 단일 트랜잭션: project_info·table_project_mapping(`audit_sql_catalog` 공용 SQL)·…·타부서 알림
2. list_projects_in_dept / list_projects_for_participant(pmssn_master JOIN·creator_email)
3. update_project / deactivate_project / get_inactive_project_purge_preview / purge_inactive_project(비활성만·위젯보드·참여·매핑·알림·초대 참조 정리 후 DELETE) — commit 성공 후 `audit_emit.emit_admin_system_log`(actor_user_id 있을 때)
4. list_members(items·pending_invites에 user_department_display) · cancel_project_invite / add_member / remove_member / update_member_role — 동일 계측
5. validate_invite_user_project
6. _user_in_actor_dept_scope — 생성자 부서 트리 소속 여부
7. _actor_may_manage_system_dev_department_users / _assert_target_not_hidden_system_dev_member — dptmt_info_id=0(개발·시스템) 노출·멤버 지정은 sa_dev 또는 소속 0번만

[Dependencies]
=========
- Backend.admin_server.audit_emit.emit_admin_system_log
- Backend.admin_server.audit_sql_catalog
- Backend.admin_server.change_notify
- Backend.mail.outbound.send_project_invite_existing_user_email
- Backend.notification_server.service (`insert_notification`, `*_in_txn`, `fetch_*`, `user_display_label_for_notification`, pending 조회)
- Backend.core.invite_expiry.invite_expired_from_payload
- json
- psycopg2, psycopg2.errors, psycopg2.extras.Json(feature_flags)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg2
from psycopg2 import errors as pg_errors
from psycopg2.extras import Json

from Backend.admin_server import audit_sql_catalog
from Backend.admin_server import change_notify
from Backend.admin_server.audit_emit import emit_admin_system_log
from Backend.admin_server.service_roles import (
    _attach_user_department_display,
    _user_department_display_from_join,
)
from Backend.core.invite_expiry import invite_expired_from_payload
from Backend.mail.outbound import send_project_invite_existing_user_email
from Backend.notification_server.service import (
    delete_notification_by_id_in_txn,
    delete_project_invite_notifications_for_project_in_txn,
    delete_project_invite_notifications_for_user_project_in_txn,
    delete_widget_board_notifications_for_board_in_txn,
    fetch_notification_by_id,
    fetch_pending_project_invite_rows_for_project,
    insert_notification,
    pending_project_invite_exists_for_user_project,
    user_display_label_for_notification,
)

_DEFAULT_FEATURE_FLAGS: dict[str, bool] = {"query": True, "dash": True, "widget": True}

# 타부서 project_invite 알림 JSON `invite_expires_at`(UTC ISO) — 기본 7일
_PROJECT_INVITE_VALID_DAYS = 7


def normalize_feature_flags_for_db(raw: Any) -> dict[str, bool]:
    """API 바디·부분 dict → DB 저장용 {query,dash,widget}. 생략 시 전부 true."""
    if raw is None:
        return dict(_DEFAULT_FEATURE_FLAGS)
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return dict(_DEFAULT_FEATURE_FLAGS)
    out = dict(_DEFAULT_FEATURE_FLAGS)
    for k in ("query", "dash", "widget"):
        if k in raw:
            out[k] = bool(raw[k])
    return out


def _sync_project_table_mappings_with_usage(
    cur, project_info_id: int, entries: list[dict[str, Any]]
) -> None:
    """table_project_mapping 을 엔트리와 일치시킨다. 둘 다 N이면 해당 행은 제외(미매핑)."""
    normalized: list[tuple[int, str, str]] = []
    seen: set[int] = set()
    for raw in entries:
        tmid = int(raw["table_master_id"])
        if tmid in seen:
            continue
        seen.add(tmid)
        cur.execute(
            audit_sql_catalog.SQL_TABLE_MASTER_SELECT_DB_TYPE_NORM,
            (tmid,),
        )
        trow = cur.fetchone()
        if not trow:
            raise ValueError(f"테이블 마스터를 찾을 수 없습니다. (table_master_id={tmid})")
        master_dbt = str(trow.get("db_type_norm") or "").strip() or "main"
        if master_dbt != "main":
            raise ValueError(
                "프로젝트 테이블 매핑은 main_db(table_master)만 가능합니다. "
                f"(table_master_id={tmid})"
            )
        qs = bool(raw.get("use_query_studio", True))
        wb = bool(raw.get("use_widgetboard", True))
        if not qs and not wb:
            continue
        normalized.append((tmid, "Y" if qs else "N", "Y" if wb else "N"))
    ids = [x[0] for x in normalized]
    if not ids:
        cur.execute(
            audit_sql_catalog.SQL_DELETE_TABLE_PROJECT_MAPPING_BY_PROJECT,
            (int(project_info_id),),
        )
        return
    ph = ", ".join(["%s"] * len(ids))
    cur.execute(
        audit_sql_catalog.sql_delete_table_project_mapping_not_in(ph),
        (int(project_info_id), *ids),
    )
    for tmid, qyn, wyn in normalized:
        cur.execute(
            audit_sql_catalog.SQL_TABLE_PROJECT_MAPPING_UPSERT_USAGE_FLAGS,
            (int(project_info_id), tmid, qyn, wyn),
        )


def _sync_project_table_mappings(cur, project_info_id: int, table_master_ids: list[int]) -> None:
    """레거시: 나열된 table_master 는 쿼리 스튜디오·위젯보드 모두 Y (main 테이블만)."""
    ids = list(dict.fromkeys(int(x) for x in table_master_ids if x is not None))
    entries: list[dict[str, Any]] = []
    for i in ids:
        cur.execute(
            audit_sql_catalog.SQL_TABLE_MASTER_SELECT_DB_TYPE_NORM,
            (i,),
        )
        trow = cur.fetchone()
        if not trow:
            raise ValueError(f"테이블 마스터를 찾을 수 없습니다. (table_master_id={i})")
        if str(trow.get("db_type_norm") or "").strip() != "main":
            continue
        entries.append({
            "table_master_id": i,
            "use_query_studio": True,
            "use_widgetboard": True,
        })
    _sync_project_table_mappings_with_usage(cur, project_info_id, entries)


def _user_in_actor_dept_scope(cur, actor_dptmt_id: int, target_user_id: int) -> bool:
    """생성자 부서를 루트로 한 서브트리에 target_user가 속하는지(활성 사용자만)."""
    cur.execute(
        """
        SELECT u.user_id
        FROM user_info u
        INNER JOIN (
            WITH RECURSIVE sub AS (
                SELECT dptmt_info_id FROM dptmt_info WHERE dptmt_info_id = %s
                UNION ALL
                SELECT d.dptmt_info_id
                FROM dptmt_info d
                INNER JOIN sub s ON d.parent_dptmt_info_id = s.dptmt_info_id
            )
            SELECT dptmt_info_id FROM sub
        ) scope ON scope.dptmt_info_id = u.dptmt_info_id
        WHERE u.user_id = %s
          AND UPPER(TRIM(COALESCE(u.user_active_yn, 'Y'))) = 'Y'
        """,
        (int(actor_dptmt_id), int(target_user_id)),
    )
    return cur.fetchone() is not None


def _actor_may_manage_system_dev_department_users(
    actor_dvsn: str | None, actor_dptmt_id: int
) -> bool:
    """dptmt_info_id=0 소속 사용자를 검색·프로젝트 멤버로 지정할 수 있는지: sa_dev 또는 액터 소속이 0번 부서."""
    ad = (actor_dvsn or "").strip().lower()
    if ad == "sa_dev":
        return True
    try:
        return int(actor_dptmt_id) == 0
    except (TypeError, ValueError):
        return False


def _assert_target_not_hidden_system_dev_member(
    cur,
    actor_dvsn: str | None,
    actor_dptmt_id: int,
    target_user_id: int,
) -> None:
    """일반 부서 관리자가 개발(0) 부서 소속 계정을 멤버로 넣지 못하게 한다."""
    if _actor_may_manage_system_dev_department_users(actor_dvsn, actor_dptmt_id):
        return
    cur.execute(
        "SELECT dptmt_info_id FROM user_info WHERE user_id = %s",
        (int(target_user_id),),
    )
    row = cur.fetchone()
    if not row:
        return
    td = row.get("dptmt_info_id")
    if td is not None and int(td) == 0:
        raise ValueError(
            "개발(시스템) 부서 소속 사용자는 일반 부서 관리 화면에서 지정할 수 없습니다."
        )


def _assert_project_owned(cur, dptmt_info_id: int, project_info_id: int) -> None:
    cur.execute(
        "SELECT project_info_id, dptmt_info_id, active_yn FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if int(row["dptmt_info_id"]) != dptmt_info_id:
        raise ValueError("다른 부서의 프로젝트입니다.")
    if (row.get("active_yn") or "").upper() != "Y":
        raise ValueError("비활성 프로젝트에는 작업할 수 없습니다.")


def _assert_member_list_allowed(
    cur,
    actor_dptmt_id: int,
    project_info_id: int,
    actor_user_id: int,
    actor_dvsn: str,
) -> None:
    """소속 부서 소유 프로젝트이거나 타부서라면 참여자면 멤버 목록 조회(o가 타부서 경로로 호출할 때). org 관리자는 deps상 타부서 project_info_id 라우트 불가."""
    _ = actor_dvsn
    cur.execute(
        "SELECT dptmt_info_id, UPPER(TRIM(COALESCE(active_yn, 'Y'))) AS ay FROM project_info WHERE project_info_id = %s",
        (int(project_info_id),),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if (row.get("ay") or "") != "Y":
        raise ValueError("비활성 프로젝트에는 작업할 수 없습니다.")
    pd = int(row["dptmt_info_id"])
    if int(actor_dptmt_id) == pd:
        return
    cur.execute(
        """
        SELECT 1 FROM project_ptcpnt_info
        WHERE project_info_id = %s AND ptcpnt_user_id = %s
        """,
        (int(project_info_id), int(actor_user_id)),
    )
    if cur.fetchone():
        return
    raise ValueError("다른 부서의 프로젝트입니다.")


def _assert_project_owned_allow_inactive(cur, dptmt_info_id: int, project_info_id: int) -> None:
    """active_yn 변경·비활성화 등 관리 작업용 — 비활성 프로젝트도 허용."""
    cur.execute(
        "SELECT project_info_id, dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    if int(row["dptmt_info_id"]) != dptmt_info_id:
        raise ValueError("다른 부서의 프로젝트입니다.")


def _assert_pmssn_for_project(cur, project_info_id: int, pmssn_master_id: int) -> None:
    cur.execute(
        "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
        (project_info_id,),
    )
    prow = cur.fetchone()
    if not prow:
        raise ValueError("프로젝트를 찾을 수 없습니다.")
    pdpt = int(prow["dptmt_info_id"])
    cur.execute(
        """
        SELECT pmssn_master_id, dptmt_info_id, system_dflt_yn
        FROM pmssn_master WHERE pmssn_master_id = %s
        """,
        (pmssn_master_id,),
    )
    mrow = cur.fetchone()
    if not mrow:
        raise ValueError("권한을 찾을 수 없습니다.")
    mdpt = mrow.get("dptmt_info_id")
    sysd = (mrow.get("system_dflt_yn") or "").upper() == "Y"
    if sysd and mdpt is None:
        return
    if mdpt is not None and int(mdpt) == pdpt:
        return
    raise ValueError("이 프로젝트에 부여할 수 없는 권한입니다.")


# 2.
def list_projects_in_dept(conn, dptmt_info_id: int) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pi.project_info_id, pi.dptmt_info_id, pi.project_name, pi.project_dscrtn, pi.active_yn,
                   pi.create_dtm, pi.project_create_user_id, pi.feature_flags,
                   NULLIF(TRIM(u.user_email), '') AS creator_email
            FROM project_info pi
            LEFT JOIN user_info u ON u.user_id = pi.project_create_user_id
            WHERE pi.dptmt_info_id = %s
            ORDER BY pi.project_name
            """,
            (dptmt_info_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def list_projects_for_participant(
    conn, user_id: int, dptmt_info_id: int
) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pi.project_info_id, pi.dptmt_info_id, pi.project_name, pi.project_dscrtn,
                   pi.active_yn, pi.create_dtm, pi.project_create_user_id, pi.feature_flags,
                   NULLIF(TRIM(uc.user_email), '') AS creator_email,
                   m.pmssn_name AS role_name
            FROM project_info pi
            INNER JOIN project_ptcpnt_info p
              ON p.project_info_id = pi.project_info_id AND p.ptcpnt_user_id = %s
            LEFT JOIN pmssn_master m ON m.pmssn_master_id = p.pmssn_master_id
            LEFT JOIN user_info uc ON uc.user_id = pi.project_create_user_id
            WHERE pi.dptmt_info_id = %s
            ORDER BY pi.project_name
            """,
            (user_id, dptmt_info_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def create_project_full(
    conn,
    actor_user_id: int,
    actor_dptmt_id: int,
    actor_dvsn: str | None,
    project_name: str,
    project_dscrtn: str | None,
    creator_pmssn_master_id: int,
    table_master_ids: list[int] | None,
    members: list[dict[str, Any]] | None,
    external_invites: list[dict[str, Any]] | None,
    feature_flags: dict[str, Any] | None = None,
    table_mappings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    프로젝트 생성 + 테이블 매핑 + 부서 내 멤버 + 타부서 알림 초대를 단일 트랜잭션으로 처리한다.
    시스템 기본 pmssn 자동 배정 없음 — creator_pmssn_master_id 필수.
    """
    pname = (project_name or "").strip()
    if not pname:
        raise ValueError("프로젝트명이 필요합니다.")
    tid_list = list(dict.fromkeys(int(x) for x in (table_master_ids or []) if x is not None))
    mem_list = members or []
    ext_list = external_invites or []
    flags_store = normalize_feature_flags_for_db(feature_flags)
    cur = conn.cursor()
    try:
        cur.execute(
            audit_sql_catalog.SQL_PROJECT_INFO_INSERT,
            (
                actor_dptmt_id,
                actor_user_id,
                pname,
                project_dscrtn,
                Json(flags_store),
            ),
        )
        pid = int(cur.fetchone()["project_info_id"])

        _assert_pmssn_for_project(cur, pid, int(creator_pmssn_master_id))

        cur.execute(
            audit_sql_catalog.SQL_PROJECT_PTCPNT_INFO_INSERT,
            (actor_user_id, actor_user_id, pid, int(creator_pmssn_master_id)),
        )

        if table_mappings is not None:
            _sync_project_table_mappings_with_usage(cur, pid, list(table_mappings))
        else:
            for tmid in tid_list:
                cur.execute(
                    audit_sql_catalog.SQL_TABLE_MASTER_SELECT_DB_TYPE_NORM,
                    (tmid,),
                )
                trow = cur.fetchone()
                if not trow:
                    raise ValueError(
                        f"테이블 마스터를 찾을 수 없습니다. (table_master_id={tmid})"
                    )
                if str(trow.get("db_type_norm") or "").strip() != "main":
                    continue
                cur.execute(
                    audit_sql_catalog.SQL_TABLE_PROJECT_MAPPING_INSERT_UPSERT_YY,
                    (pid, tmid),
                )

        members_added = 0
        seen_u: set[int] = {int(actor_user_id)}
        for m in mem_list:
            uid = int(m.get("user_id") or 0)
            mid = int(m.get("pmssn_master_id") or 0)
            if uid <= 0 or mid <= 0:
                raise ValueError("members 항목에 user_id와 pmssn_master_id가 필요합니다.")
            if uid in seen_u:
                continue
            if uid == actor_user_id:
                continue
            _assert_target_not_hidden_system_dev_member(cur, actor_dvsn, actor_dptmt_id, uid)
            if not _user_in_actor_dept_scope(cur, actor_dptmt_id, uid):
                raise ValueError(f"부서 트리에 속하지 않는 사용자입니다. (user_id={uid})")
            _assert_pmssn_for_project(cur, pid, mid)
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info
                WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (pid, uid),
            )
            if cur.fetchone():
                raise ValueError(f"이미 멤버로 지정된 사용자입니다. (user_id={uid})")
            cur.execute(
                audit_sql_catalog.SQL_PROJECT_PTCPNT_INFO_INSERT,
                (uid, actor_user_id, pid, mid),
            )
            _notify_project_member_added_pair(
                conn, cur, pid, pname, int(actor_user_id), uid
            )
            members_added += 1
            seen_u.add(uid)

        invites_sent = 0
        ext_invite_email_targets: list[tuple[int, str]] = []
        for inv in ext_list:
            iuid = int(inv.get("user_id") or 0)
            imid = int(inv.get("pmssn_master_id") or 0)
            if iuid <= 0 or imid <= 0:
                raise ValueError("external_invites 항목에 user_id와 pmssn_master_id가 필요합니다.")
            if iuid == actor_user_id:
                raise ValueError("본인을 타부서 초대 대상으로 지정할 수 없습니다.")
            if iuid in seen_u:
                raise ValueError(f"이미 부서 내 멤버로 등록된 사용자입니다. (user_id={iuid})")
            if _user_in_actor_dept_scope(cur, actor_dptmt_id, iuid):
                raise ValueError(
                    "같은 부서 트리 소속은「부서 내 참여자」로 추가하세요. (user_id=%s)"
                    % iuid
                )
            cur.execute(
                """
                SELECT dptmt_info_id FROM user_info
                WHERE user_id = %s AND UPPER(TRIM(COALESCE(user_active_yn,'Y'))) = 'Y'
                """,
                (iuid,),
            )
            uinv = cur.fetchone()
            if not uinv:
                raise ValueError(f"초대 대상 사용자를 찾을 수 없거나 비활성입니다. (user_id={iuid})")
            td_inv = uinv.get("dptmt_info_id")
            if (
                td_inv is not None
                and int(td_inv) == 0
                and not _actor_may_manage_system_dev_department_users(
                    actor_dvsn, actor_dptmt_id
                )
            ):
                raise ValueError(
                    "개발(시스템) 부서 소속 사용자는 타부서 초대로 지정할 수 없습니다."
                )
            _assert_pmssn_for_project(cur, pid, imid)
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (pid, iuid),
            )
            if cur.fetchone():
                raise ValueError("이미 프로젝트 멤버입니다.")
            invite_expires_at = (
                datetime.now(timezone.utc)
                + timedelta(days=_PROJECT_INVITE_VALID_DAYS)
            ).isoformat()
            payload = json.dumps(
                {
                    "project_info_id": pid,
                    "pmssn_master_id": imid,
                    "invite_user_id": actor_user_id,
                    "invite_expires_at": invite_expires_at,
                },
                ensure_ascii=False,
            )
            title = (f"'{pname}' 프로젝트에 초대되었습니다")[:200]
            insert_notification(
                conn,
                iuid,
                "project_invite",
                title,
                payload,
                autocommit=False,
            )
            ext_invite_email_targets.append((iuid, invite_expires_at))
            invites_sent += 1

        conn.commit()
        emit_admin_system_log(
            int(actor_user_id),
            business_action="project_create",
            action_kind="CREATE",
            detail_json={
                "project_info_id": pid,
                "members_added": members_added,
                "invites_sent": invites_sent,
            },
            risk_tier="MED",
        )
        inviter_label = user_display_label_for_notification(
            conn, int(actor_user_id), max_len=80
        )
        for iuid_mail, exp_iso in ext_invite_email_targets:
            if int(iuid_mail) == int(actor_user_id):
                continue
            em_u = change_notify.fetch_user_email_for_notify(conn, int(iuid_mail))
            if em_u:
                send_project_invite_existing_user_email(
                    em_u,
                    project_name=pname,
                    inviter_label=inviter_label,
                    invite_expires_at=exp_iso,
                )
        return {
            "project_info_id": pid,
            "members_added": members_added,
            "invites_sent": invites_sent,
        }
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 3.
def update_project(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    project_name: str | None,
    project_dscrtn: str | None,
    active_yn: str | None,
    actor_dvsn: str | None = None,
    feature_flags: dict[str, Any] | None = None,
    table_master_ids: list[int] | None = None,
    table_mappings: list[dict[str, Any]] | None = None,
    *,
    actor_user_id: int | None = None,
) -> None:
    cur = conn.cursor()
    try:
        if active_yn is not None:
            _assert_project_owned_allow_inactive(cur, dptmt_info_id, project_info_id)
        else:
            _assert_project_owned(cur, dptmt_info_id, project_info_id)

        ad = (actor_dvsn or "").strip().lower()
        if ad == "o" and active_yn is not None:
            raise ValueError("프로젝트 운영자는 활성 여부를 변경할 수 없습니다.")
        if ad == "o" and (
            feature_flags is not None
            or table_master_ids is not None
            or table_mappings is not None
        ):
            raise ValueError(
                "프로젝트 운영자는 기능 플래그·테이블 매핑을 변경할 수 없습니다."
            )

        sets: list[str] = []
        params: list[Any] = []
        if project_name is not None:
            sets.append(audit_sql_catalog.SQL_PROJECT_SET_PROJECT_NAME)
            params.append((project_name or "").strip())
        if project_dscrtn is not None:
            sets.append(audit_sql_catalog.SQL_PROJECT_SET_PROJECT_DSCRTN)
            params.append(project_dscrtn)
        if active_yn is not None:
            sets.append(audit_sql_catalog.SQL_PROJECT_SET_ACTIVE_YN)
            params.append((active_yn or "")[:1])
        if feature_flags is not None:
            sets.append(audit_sql_catalog.SQL_PROJECT_SET_FEATURE_FLAGS)
            params.append(Json(normalize_feature_flags_for_db(feature_flags)))
        if sets:
            params.append(project_info_id)
            cur.execute(
                audit_sql_catalog.sql_project_info_update(sets),
                params,
            )
        elif (
            feature_flags is None
            and table_master_ids is None
            and table_mappings is None
        ):
            conn.commit()
            emit_admin_system_log(
                actor_user_id,
                business_action="project_update",
                detail_json={
                    "project_info_id": project_info_id,
                    "x_note": "no_field_changes",
                },
            )
            return

        if table_mappings is not None:
            _sync_project_table_mappings_with_usage(
                cur, project_info_id, list(table_mappings)
            )
        elif table_master_ids is not None:
            _sync_project_table_mappings(cur, project_info_id, list(table_master_ids))

        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="project_update",
            detail_json={
                "project_info_id": project_info_id,
                "x_has_project_fields": bool(sets),
                "x_table_mappings": table_mappings is not None,
                "x_table_master_ids": table_master_ids is not None,
            },
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def deactivate_project(
    conn, dptmt_info_id: int, project_info_id: int, *, actor_user_id: int | None = None
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned_allow_inactive(cur, dptmt_info_id, project_info_id)
        cur.execute(
            audit_sql_catalog.SQL_PROJECT_DEACTIVATE,
            (project_info_id,),
        )
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="project_deactivate",
            action_kind="UPDATE",
            detail_json={"project_info_id": project_info_id},
            risk_tier="MED",
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def _purge_run_optional_sql(cur, sql: str, params: tuple[Any, ...]) -> None:
    """invite_* 확장 컬럼이 없는 DB에서는 UndefinedColumn 시 해당 UPDATE만 생략한다."""
    try:
        cur.execute("SAVEPOINT sp_admin_purge_project_opt")
        cur.execute(sql, params)
        cur.execute("RELEASE SAVEPOINT sp_admin_purge_project_opt")
    except pg_errors.UndefinedColumn:
        cur.execute("ROLLBACK TO SAVEPOINT sp_admin_purge_project_opt")


def get_inactive_project_purge_preview(
    conn, dptmt_info_id: int, project_info_id: int
) -> dict[str, Any]:
    """비활성 프로젝트 물리 삭제 전 위젯보드·위젯·공유 행 요약( purge_inactive_project 와 동일 소유·상태 검증)."""
    cur = conn.cursor()
    pid = int(project_info_id)
    did = int(dptmt_info_id)
    try:
        cur.execute(
            """
            SELECT project_info_id, dptmt_info_id, project_name,
                   UPPER(TRIM(COALESCE(active_yn, 'Y'))) AS ay
            FROM project_info WHERE project_info_id = %s
            """,
            (pid,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("프로젝트를 찾을 수 없습니다.")
        if int(row["dptmt_info_id"]) != did:
            raise ValueError("다른 부서의 프로젝트입니다.")
        if (row.get("ay") or "") == "Y":
            raise ValueError("활성 프로젝트는 미리보기할 수 없습니다. 먼저 비활성화하세요.")
        cur.execute(
            """
            SELECT wb.widget_board_id, wb.board_name,
                   UPPER(TRIM(COALESCE(wb.active_yn, 'Y'))) AS board_active_yn,
                   (SELECT COUNT(*)::int FROM widget_item wi
                    WHERE wi.widget_board_id = wb.widget_board_id) AS widget_item_rows,
                   (SELECT COUNT(*)::int FROM widget_board_share sh
                    WHERE sh.widget_board_id = wb.widget_board_id) AS share_rows
            FROM widget_board wb
            WHERE wb.project_info_id = %s
            ORDER BY wb.widget_board_id
            """,
            (pid,),
        )
        boards = [dict(r) for r in cur.fetchall()]
        tw = sum(int(b.get("widget_item_rows") or 0) for b in boards)
        ts = sum(int(b.get("share_rows") or 0) for b in boards)
        return {
            "project_info_id": pid,
            "project_name": row.get("project_name"),
            "widget_boards": boards,
            "totals": {
                "widget_boards": len(boards),
                "widget_item_rows": tw,
                "widget_board_share_rows": ts,
            },
        }
    finally:
        cur.close()


def purge_inactive_project(
    conn, dptmt_info_id: int, project_info_id: int, *, actor_user_id: int | None = None
) -> None:
    """`active_yn`이 Y가 아닌 프로젝트만 물리 삭제. 단일 트랜잭션에서 선행 정리 후 `project_info` DELETE.

    순서: project_invite 알림 → user_info·email_invite 초대 프로젝트 쌍 NULL → 위젯보드(알림·위젯·공유·보드) →
    table_project_mapping → project_ptcpnt_info → project_info
    """
    cur = conn.cursor()
    pid = int(project_info_id)
    did = int(dptmt_info_id)
    try:
        cur.execute(
            """
            SELECT project_info_id, dptmt_info_id,
                   UPPER(TRIM(COALESCE(active_yn, 'Y'))) AS ay
            FROM project_info WHERE project_info_id = %s
            """,
            (pid,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("프로젝트를 찾을 수 없습니다.")
        if int(row["dptmt_info_id"]) != did:
            raise ValueError("다른 부서의 프로젝트입니다.")
        if (row.get("ay") or "") == "Y":
            raise ValueError("활성 프로젝트는 삭제할 수 없습니다. 먼저 비활성화하세요.")

        try:
            cur.execute("SAVEPOINT sp_admin_purge_notif")
            delete_project_invite_notifications_for_project_in_txn(conn, pid)
            cur.execute("RELEASE SAVEPOINT sp_admin_purge_notif")
        except (pg_errors.InvalidTextRepresentation, pg_errors.UntranslatableCharacter):
            cur.execute("ROLLBACK TO SAVEPOINT sp_admin_purge_notif")

        _purge_run_optional_sql(
            cur,
            audit_sql_catalog.SQL_PURGE_USER_INFO_CLEAR_INVITE_PROJECT,
            (pid,),
        )
        _purge_run_optional_sql(
            cur,
            audit_sql_catalog.SQL_PURGE_EMAIL_INVITE_CODE_MASTER_CLEAR_INVITE_PROJECT,
            (pid,),
        )

        cur.execute(
            audit_sql_catalog.SQL_PURGE_SELECT_WIDGET_BOARD_IDS_BY_PROJECT,
            (pid,),
        )
        for wb_row in cur.fetchall():
            bid = int(wb_row["widget_board_id"])
            try:
                cur.execute("SAVEPOINT sp_admin_purge_wb_notif")
                delete_widget_board_notifications_for_board_in_txn(conn, bid)
                cur.execute("RELEASE SAVEPOINT sp_admin_purge_wb_notif")
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT sp_admin_purge_wb_notif")

        cur.execute(
            audit_sql_catalog.SQL_PURGE_WIDGET_ITEM_USING_PROJECT,
            (pid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_PURGE_WIDGET_BOARD_SHARE_USING_PROJECT,
            (pid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_PURGE_WIDGET_BOARD_BY_PROJECT,
            (pid,),
        )

        cur.execute(
            audit_sql_catalog.SQL_PURGE_TABLE_PROJECT_MAPPING_BY_PROJECT,
            (pid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_PURGE_PROJECT_PTCPNT_BY_PROJECT,
            (pid,),
        )
        cur.execute(
            audit_sql_catalog.SQL_PURGE_PROJECT_INFO_BY_ID,
            (pid,),
        )
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="project_purge",
            action_kind="DELETE",
            detail_json={"project_info_id": pid},
            risk_tier="HIGH",
        )
    except ValueError:
        conn.rollback()
        raise
    except (pg_errors.ForeignKeyViolation, pg_errors.NotNullViolation) as ex:
        conn.rollback()
        raise ValueError(
            "프로젝트 삭제가 다른 데이터와 충돌합니다. DB 제약·참조를 확인하세요."
        ) from ex
    except psycopg2.Error as ex:
        conn.rollback()
        raise ValueError(
            "프로젝트 삭제 중 DB 오류가 발생했습니다. 알림 JSON 등 데이터 형식을 확인하세요."
        ) from ex
    finally:
        cur.close()


# 4.
def _list_pending_project_invites(
    conn, cur, project_info_id: int
) -> list[dict[str, Any]]:
    """noti_type=project_invite 이지만 아직 project_ptcpnt_info에 없는 수신자(타부서 초대 대기)."""
    pid = int(project_info_id)
    rows = fetch_pending_project_invite_rows_for_project(conn, pid)
    out: list[dict[str, Any]] = []
    pmssn_cache: dict[int, str | None] = {}
    inviter_cache: dict[int, tuple[Any, Any]] = {}

    def _role_label(mid: int) -> str | None:
        if mid in pmssn_cache:
            return pmssn_cache[mid]
        cur.execute(
            "SELECT pmssn_name FROM pmssn_master WHERE pmssn_master_id = %s",
            (mid,),
        )
        r = cur.fetchone()
        name = r.get("pmssn_name") if r else None
        pmssn_cache[mid] = name
        return name

    def _inviter_labels(uid: int) -> tuple[Any, Any]:
        if uid in inviter_cache:
            return inviter_cache[uid]
        cur.execute(
            "SELECT user_email, user_nickname FROM user_info WHERE user_id = %s",
            (uid,),
        )
        r = cur.fetchone()
        t = (r.get("user_email"), r.get("user_nickname")) if r else (None, None)
        inviter_cache[uid] = t
        return t

    for row in rows:
        raw = row.get("noti_content")
        if raw is None:
            continue
        if not isinstance(raw, str):
            raw = str(raw)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        try:
            row_pid = int(payload["project_info_id"])
        except (KeyError, TypeError, ValueError):
            continue
        if row_pid != pid:
            continue
        mid_raw = payload.get("pmssn_master_id")
        iuid_raw = payload.get("invite_user_id")
        try:
            mid = int(mid_raw) if mid_raw is not None else None
        except (TypeError, ValueError):
            mid = None
        try:
            iuid = int(iuid_raw) if iuid_raw is not None else None
        except (TypeError, ValueError):
            iuid = None
        role_name = None
        if mid is not None and mid > 0:
            role_name = _role_label(mid)
        ie, ink = (None, None)
        if iuid is not None and iuid > 0:
            ie, ink = _inviter_labels(iuid)
        exp_raw = payload.get("invite_expires_at")
        udd = _user_department_display_from_join(
            row.get("user_dptmt_info_id"),
            row.get("user_dptmt_name"),
            row.get("user_parent_dptmt_info_id"),
            row.get("user_parent_dptmt_name"),
        )
        out.append(
            {
                "notification_info_id": int(row["notification_info_id"]),
                "ptcpnt_user_id": int(row["user_id"]),
                "user_email": row.get("user_email"),
                "user_nickname": row.get("user_nickname"),
                "user_department_display": udd,
                "pmssn_master_id": mid,
                "role_name": role_name,
                "create_dtm": row.get("create_dtm"),
                "invite_user_id": iuid,
                "invite_user_email": ie,
                "invite_user_nickname": ink,
                "invite_expires_at": exp_raw,
                "invite_expired": invite_expired_from_payload(payload),
                "membership_status": "pending_invite",
            }
        )
    return out


def list_members(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    *,
    actor_user_id: int,
    actor_dvsn: str,
) -> dict[str, Any]:
    cur = conn.cursor()
    try:
        _assert_member_list_allowed(
            cur, dptmt_info_id, project_info_id, actor_user_id, actor_dvsn
        )
        pid = int(project_info_id)
        cur.execute(
            """
            SELECT p.project_ptcpnt_info_id, p.ptcpnt_user_id, u.user_email, u.user_nickname,
                   p.pmssn_master_id, m.pmssn_name AS role_name, p.create_dtm,
                   p.invite_user_id,
                   iu.user_email AS invite_user_email,
                   iu.user_nickname AS invite_user_nickname,
                   u.dptmt_info_id AS user_dptmt_info_id,
                   ud.dptmt_name AS user_dptmt_name,
                   ud.parent_dptmt_info_id AS user_parent_dptmt_info_id,
                   upd.dptmt_name AS user_parent_dptmt_name
            FROM project_ptcpnt_info p
            JOIN user_info u ON u.user_id = p.ptcpnt_user_id
            JOIN pmssn_master m ON m.pmssn_master_id = p.pmssn_master_id
            LEFT JOIN user_info iu ON iu.user_id = p.invite_user_id
            LEFT JOIN dptmt_info ud ON ud.dptmt_info_id = u.dptmt_info_id
            LEFT JOIN dptmt_info upd ON upd.dptmt_info_id = ud.parent_dptmt_info_id
            WHERE p.project_info_id = %s
            ORDER BY u.user_email
            """,
            (pid,),
        )
        items = [dict(r) for r in cur.fetchall()]
        for d in items:
            d["membership_status"] = "active"
            _attach_user_department_display(d)
        pending = _list_pending_project_invites(conn, cur, pid)
        return {"items": items, "pending_invites": pending}
    except ValueError:
        raise
    finally:
        cur.close()


def cancel_project_invite(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    notification_info_id: int,
    *,
    actor_user_id: int | None = None,
) -> None:
    """미수락 project_invite 알림 행을 삭제한다(초대 취소)."""
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        pid = int(project_info_id)
        nid = int(notification_info_id)
        row = fetch_notification_by_id(conn, nid)
        if not row:
            raise ValueError(
                "초대 알림을 찾을 수 없습니다. 이미 수락했거나 취소되었을 수 있습니다."
            )
        if (row.get("noti_type") or "").strip() != "project_invite":
            raise ValueError("프로젝트 초대 알림이 아닙니다.")
        raw = row.get("noti_content")
        if not raw:
            raise ValueError("초대 알림 내용이 없습니다.")
        try:
            payload = json.loads(raw) if isinstance(raw, str) else raw
            row_pid = int(payload["project_info_id"])
        except (json.JSONDecodeError, TypeError, KeyError, ValueError) as e:
            raise ValueError("초대 알림이 올바르지 않습니다.") from e
        if row_pid != pid:
            raise ValueError("해당 프로젝트의 초대가 아닙니다.")
        target_uid = int(row["user_id"])
        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, target_uid),
        )
        if cur.fetchone():
            raise ValueError("이미 멤버입니다. 멤버 제거는 별도 작업을 사용하세요.")
        if delete_notification_by_id_in_txn(conn, nid) == 0:
            conn.rollback()
            raise ValueError("초대 취소에 실패했습니다.")
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="invite_cancel",
            action_kind="DELETE",
            detail_json={
                "project_info_id": pid,
                "notification_info_id": nid,
                "target_user_id": target_uid,
            },
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def _notify_project_member_added_pair(
    conn,
    cur,
    project_info_id: int,
    project_name: str,
    actor_user_id: int,
    target_user_id: int,
) -> None:
    """즉시 멤버 등록 시 피추가자·실행자 각각 알림(noti_content는 연동용 JSON)."""
    pid = int(project_info_id)
    aid = int(actor_user_id)
    tid = int(target_user_id)
    pname = (project_name or "").strip() or "프로젝트"
    al = user_display_label_for_notification(conn, aid, max_len=100)
    tl = user_display_label_for_notification(conn, tid, max_len=100)
    meta = json.dumps(
        {"project_info_id": pid, "actor_user_id": aid, "target_user_id": tid},
        ensure_ascii=False,
    )
    title_t = (f"{al} 님이 '{pname}' 프로젝트에 멤버로 추가했습니다")[:200]
    title_a = (f"{tl} 님을 '{pname}' 프로젝트에 멤버로 추가했습니다")[:200]
    for uid, typ, title in (
        (tid, "project_member_added", title_t),
        (aid, "project_member_add_done", title_a),
    ):
        insert_notification(
            conn,
            uid,
            typ,
            title,
            meta,
            autocommit=False,
        )


def _notify_project_member_removed_pair(
    conn,
    cur,
    project_info_id: int,
    project_name: str,
    actor_user_id: int,
    target_user_id: int,
) -> None:
    """멤버 제외 시 피제외자·실행자 각각 알림."""
    pid = int(project_info_id)
    aid = int(actor_user_id)
    tid = int(target_user_id)
    pname = (project_name or "").strip() or "프로젝트"
    meta = json.dumps(
        {"project_info_id": pid, "actor_user_id": aid, "target_user_id": tid},
        ensure_ascii=False,
    )
    if aid == tid:
        title = (f"본인을 '{pname}' 프로젝트에서 멤버에서 제외했습니다")[:200]
        insert_notification(
            conn,
            aid,
            "project_member_remove_done",
            title,
            meta,
            autocommit=False,
        )
        return
    al = user_display_label_for_notification(conn, aid, max_len=100)
    tl = user_display_label_for_notification(conn, tid, max_len=100)
    title_t = (
        f"{al} 님이 '{pname}' 프로젝트에서 멤버에서 제외했습니다"
    )[:200]
    title_a = (f"{tl} 님을 '{pname}' 프로젝트에서 제외했습니다")[:200]
    for uid, typ, title in (
        (tid, "project_member_removed", title_t),
        (aid, "project_member_remove_done", title_a),
    ):
        insert_notification(
            conn,
            uid,
            typ,
            title,
            meta,
            autocommit=False,
        )


def add_member(
    conn,
    actor_user_id: int,
    dptmt_info_id: int,
    actor_dvsn: str | None,
    project_info_id: int,
    ptcpnt_user_id: int,
    pmssn_master_id: int,
) -> dict[str, Any]:
    """부서 트리 소속이면 즉시 `project_ptcpnt_info` INSERT, 아니면 타부서와 동일 `project_invite` 알림.
    actor==target(본인 재참여) 허용 — 이미 멤버·미수락 초대는 아래에서 거절한다."""
    cur = conn.cursor()
    try:
        pid = int(project_info_id)
        target_uid = int(ptcpnt_user_id)
        mid = int(pmssn_master_id)
        aid = int(actor_user_id)
        adpt = int(dptmt_info_id)

        _assert_project_owned(cur, adpt, pid)
        _assert_pmssn_for_project(cur, pid, mid)

        cur.execute(
            "SELECT user_id FROM user_info WHERE user_id = %s",
            (target_uid,),
        )
        if not cur.fetchone():
            raise ValueError("사용자를 찾을 수 없습니다.")
        _assert_target_not_hidden_system_dev_member(
            cur, actor_dvsn, adpt, target_uid
        )

        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (pid, target_uid),
        )
        if cur.fetchone():
            raise ValueError("이미 프로젝트 멤버입니다.")

        if pending_project_invite_exists_for_user_project(conn, pid, target_uid):
            raise ValueError("이미 초대 대기 중인 사용자입니다.")

        if _user_in_actor_dept_scope(cur, adpt, target_uid):
            cur.execute(
                "SELECT project_name FROM project_info WHERE project_info_id = %s",
                (pid,),
            )
            pname_immediate = (cur.fetchone() or {}).get("project_name") or ""
            cur.execute(
                audit_sql_catalog.SQL_PROJECT_PTCPNT_INFO_INSERT,
                (target_uid, aid, pid, mid),
            )
            _notify_project_member_added_pair(
                conn, cur, pid, str(pname_immediate), aid, target_uid
            )
            conn.commit()
            emit_admin_system_log(
                aid,
                business_action="member_add",
                detail_json={
                    "project_info_id": pid,
                    "affected_user_id": target_uid,
                    "pmssn_master_id": mid,
                    "x_outcome": "member_added",
                },
                risk_tier="MED",
            )
            return {"outcome": "member_added"}

        cur.execute(
            """
            SELECT dptmt_info_id FROM user_info
            WHERE user_id = %s AND UPPER(TRIM(COALESCE(user_active_yn,'Y'))) = 'Y'
            """,
            (target_uid,),
        )
        uinv = cur.fetchone()
        if not uinv:
            raise ValueError(
                f"초대 대상 사용자를 찾을 수 없거나 비활성입니다. (user_id={target_uid})"
            )
        td_inv = uinv.get("dptmt_info_id")
        if (
            td_inv is not None
            and int(td_inv) == 0
            and not _actor_may_manage_system_dev_department_users(
                actor_dvsn, adpt
            )
        ):
            raise ValueError(
                "개발(시스템) 부서 소속 사용자는 타부서 초대로 지정할 수 없습니다."
            )

        cur.execute(
            "SELECT project_name FROM project_info WHERE project_info_id = %s",
            (pid,),
        )
        pnrow = cur.fetchone()
        pname = (pnrow or {}).get("project_name") or ""

        invite_expires_at = (
            datetime.now(timezone.utc) + timedelta(days=_PROJECT_INVITE_VALID_DAYS)
        ).isoformat()
        payload = json.dumps(
            {
                "project_info_id": pid,
                "pmssn_master_id": mid,
                "invite_user_id": aid,
                "invite_expires_at": invite_expires_at,
            },
            ensure_ascii=False,
        )
        title = (f"'{pname}' 프로젝트에 초대되었습니다")[:200]
        insert_notification(
            conn,
            target_uid,
            "project_invite",
            title,
            payload,
            autocommit=False,
        )
        conn.commit()
        emit_admin_system_log(
            aid,
            business_action="member_add",
            detail_json={
                "project_info_id": pid,
                "affected_user_id": target_uid,
                "pmssn_master_id": mid,
                "x_outcome": "invite_sent",
            },
            risk_tier="MED",
        )
        if aid != target_uid:
            em_inv = change_notify.fetch_user_email_for_notify(conn, target_uid)
            if em_inv:
                send_project_invite_existing_user_email(
                    em_inv,
                    project_name=str(pname),
                    inviter_label=user_display_label_for_notification(
                        conn, aid, max_len=80
                    ),
                    invite_expires_at=invite_expires_at,
                )
        return {"outcome": "invite_sent"}
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def update_member_role(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    ptcpnt_user_id: int,
    pmssn_master_id: int,
    *,
    actor_user_id: int | None = None,
    actor_dvsn: str | None = None,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        _assert_pmssn_for_project(cur, project_info_id, pmssn_master_id)
        if (actor_dvsn or "").strip().lower() == "o":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "u":
                raise ValueError(
                    "운영자는 일반 사용자(u)의 프로젝트 권한만 변경할 수 있습니다."
                )
        cur.execute(
            """
            SELECT pmssn_master_id FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (project_info_id, ptcpnt_user_id),
        )
        prev_row = cur.fetchone()
        prev_mid = int(prev_row["pmssn_master_id"]) if prev_row else None
        cur.execute(
            "SELECT project_name FROM project_info WHERE project_info_id = %s",
            (int(project_info_id),),
        )
        pn_mu = cur.fetchone()
        pname_mu = (pn_mu or {}).get("project_name") or ""
        cur.execute(
            audit_sql_catalog.SQL_MEMBER_ROLE_UPDATE,
            (pmssn_master_id, project_info_id, ptcpnt_user_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("멤버를 찾을 수 없습니다.")
        conn.commit()
        emit_admin_system_log(
            actor_user_id,
            business_action="member_role_update",
            detail_json={
                "project_info_id": project_info_id,
                "affected_user_id": int(ptcpnt_user_id),
                "old_pmssn_master_id": prev_mid,
                "new_pmssn_master_id": int(pmssn_master_id),
            },
        )
        if prev_mid is None or int(pmssn_master_id) != int(prev_mid):
            old_lab = (
                change_notify.fetch_pmssn_name(conn, int(prev_mid))
                if prev_mid is not None
                else "—"
            )
            new_lab = change_notify.fetch_pmssn_name(conn, int(pmssn_master_id))
            change_notify.notify_project_pmssn_changed(
                conn,
                actor_user_id,
                int(ptcpnt_user_id),
                str(pname_mu),
                old_lab,
                new_lab,
                project_info_id=int(project_info_id),
            )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def remove_member(
    conn,
    dptmt_info_id: int,
    project_info_id: int,
    ptcpnt_user_id: int,
    actor_user_id: int,
    actor_dvsn: str | None = None,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, dptmt_info_id, project_info_id)
        if (actor_dvsn or "").strip().lower() == "o":
            cur.execute(
                "SELECT user_dvsn FROM user_info WHERE user_id = %s",
                (ptcpnt_user_id,),
            )
            urow = cur.fetchone()
            if not urow:
                raise ValueError("사용자를 찾을 수 없습니다.")
            if (urow.get("user_dvsn") or "").strip().lower() != "u":
                raise ValueError(
                    "운영자는 일반 사용자(u)만 프로젝트에서 제외할 수 있습니다."
                )
        cur.execute(
            "SELECT project_name FROM project_info WHERE project_info_id = %s",
            (int(project_info_id),),
        )
        pname_rm = (cur.fetchone() or {}).get("project_name") or ""
        cur.execute(
            audit_sql_catalog.SQL_MEMBER_REMOVE,
            (project_info_id, ptcpnt_user_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise ValueError("멤버를 찾을 수 없습니다.")
        delete_project_invite_notifications_for_user_project_in_txn(
            conn, int(project_info_id), int(ptcpnt_user_id)
        )
        _notify_project_member_removed_pair(
            conn,
            cur,
            int(project_info_id),
            str(pname_rm),
            int(actor_user_id),
            int(ptcpnt_user_id),
        )
        conn.commit()
        emit_admin_system_log(
            int(actor_user_id),
            business_action="member_remove",
            action_kind="DELETE",
            detail_json={
                "project_info_id": int(project_info_id),
                "affected_user_id": int(ptcpnt_user_id),
            },
            risk_tier="HIGH",
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 5.
def validate_invite_user_project(
    conn,
    invite_dptmt_id: int,
    project_info_id: int,
    pmssn_master_id: int,
) -> None:
    cur = conn.cursor()
    try:
        _assert_project_owned(cur, invite_dptmt_id, project_info_id)
        _assert_pmssn_for_project(cur, project_info_id, pmssn_master_id)
    finally:
        cur.close()
