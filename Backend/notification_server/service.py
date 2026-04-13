"""
Backend.notification_server.service (알림 CRUD)
=============================================
`notification_info`에 대한 SELECT·INSERT·UPDATE·DELETE의 **단일 소유** 계층. HTTP 라우터 외
프로젝트·어드민·위젯보드 등은 동일 `conn` 트랜잭션 안에서 `*_in_txn`·`fetch_*`만 호출한다.
`insert_notification`·`mark_read_one` 등 `autocommit`/즉시 commit 경로는 API 전용.
초대자 알림 문구용 `project_info`·`user_info` 조회는 알림 제목 구성 목적으로만 이 모듈에서 수행한다.

[Main Functions]
===========
1. list_notifications / count_unread
2. mark_read_one / mark_read_all(API용 commit 포함)
3. fetch_notification_by_id / mark_notification_read_in_txn / delete_notification_by_id_in_txn
4. delete_notifications_for_user_in_txn / delete_project_invite_notifications_for_project_in_txn
5. fetch_pending_project_invite_rows_for_project / pending_project_invite_exists_for_user_project
6. user_has_pending_widget_board_invite / delete_widget_board_notifications_for_board_in_txn
7. user_display_label_for_notification — 알림 제목용 닉네임·이메일 라벨(COALESCE)
8. notify_inviter_project_invite_resolved / notify_inviter_widget_board_invite_resolved
9. insert_notification(autocommit 옵션)

[Dependencies]
=========
- json(초대 JSON 검사 헬퍼)
- (conn — system_db)
"""

from __future__ import annotations

import json
from typing import Any


# 1.
def list_notifications(conn, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT notification_info_id, noti_type, noti_title, noti_content,
                   read_yn, create_dtm, update_dtm
            FROM notification_info
            WHERE user_id = %s
            ORDER BY create_dtm DESC
            LIMIT %s
            """,
            (user_id, lim),
        )
        rows = cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            cd = d.get("create_dtm")
            if cd is not None:
                d["create_dtm"] = cd.isoformat()
            ud = d.get("update_dtm")
            if ud is not None:
                d["update_dtm"] = ud.isoformat()
            out.append(d)
        return out
    finally:
        cur.close()


# 2.
def count_unread(conn, user_id: int) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM notification_info
            WHERE user_id = %s AND (read_yn IS NULL OR UPPER(TRIM(read_yn)) <> 'Y')
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return int(row["c"]) if row else 0
    finally:
        cur.close()


# 3.
def mark_notification_read_in_txn(
    conn, user_id: int, notification_info_id: int
) -> bool:
    """동일 트랜잭션 내 읽음 처리. commit/rollback은 호출자."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notification_info
            SET read_yn = 'Y', update_dtm = NOW()
            WHERE notification_info_id = %s AND user_id = %s
            """,
            (int(notification_info_id), int(user_id)),
        )
        return cur.rowcount > 0
    finally:
        cur.close()


def mark_read_one(conn, user_id: int, notification_info_id: int) -> bool:
    try:
        ok = mark_notification_read_in_txn(conn, user_id, notification_info_id)
        conn.commit()
        return ok
    except Exception:
        conn.rollback()
        raise


def mark_read_all(conn, user_id: int) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notification_info
            SET read_yn = 'Y', update_dtm = NOW()
            WHERE user_id = %s AND (read_yn IS NULL OR UPPER(TRIM(read_yn)) <> 'Y')
            """,
            (user_id,),
        )
        n = cur.rowcount
        conn.commit()
        return n
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# 4.
def fetch_notification_by_id(
    conn, notification_info_id: int
) -> dict[str, Any] | None:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT notification_info_id, noti_content, noti_type, user_id
            FROM notification_info
            WHERE notification_info_id = %s
            """,
            (int(notification_info_id),),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()


def delete_notification_by_id_in_txn(conn, notification_info_id: int) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM notification_info WHERE notification_info_id = %s",
            (int(notification_info_id),),
        )
        return int(cur.rowcount)
    finally:
        cur.close()


def delete_notifications_for_user_in_txn(conn, user_id: int) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM notification_info WHERE user_id = %s",
            (int(user_id),),
        )
        return int(cur.rowcount)
    finally:
        cur.close()


def delete_project_invite_notifications_for_project_in_txn(
    conn, project_info_id: int
) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            DELETE FROM notification_info
            WHERE noti_type = 'project_invite'
              AND COALESCE(noti_content::text, '') <> ''
              AND NULLIF(TRIM(noti_content::json->>'project_info_id'), '') IS NOT NULL
              AND (noti_content::json->>'project_info_id')::int = %s
            """,
            (int(project_info_id),),
        )
        return int(cur.rowcount)
    finally:
        cur.close()


def fetch_pending_project_invite_rows_for_project(
    conn, project_info_id: int
) -> list[dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT n.notification_info_id, n.user_id, n.create_dtm, n.noti_content,
                   u.user_email, u.user_nickname
            FROM notification_info n
            INNER JOIN user_info u ON u.user_id = n.user_id
            WHERE n.noti_type = 'project_invite'
              AND NOT EXISTS (
                SELECT 1 FROM project_ptcpnt_info pp
                WHERE pp.project_info_id = %s AND pp.ptcpnt_user_id = n.user_id
              )
            ORDER BY n.create_dtm
            """,
            (int(project_info_id),),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def pending_project_invite_exists_for_user_project(
    conn, project_info_id: int, target_user_id: int
) -> bool:
    """미수락 project_invite 중 noti_content.project_info_id가 일치하는 행 존재 여부."""
    pid = int(project_info_id)
    uid = int(target_user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT noti_content FROM notification_info
            WHERE user_id = %s AND noti_type = 'project_invite'
              AND NOT EXISTS (
                SELECT 1 FROM project_ptcpnt_info pp
                WHERE pp.project_info_id = %s AND pp.ptcpnt_user_id = %s
              )
            """,
            (uid, pid, uid),
        )
        for row in cur.fetchall():
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
            if row_pid == pid:
                return True
        return False
    finally:
        cur.close()


def user_has_pending_widget_board_invite(
    conn, invitee_user_id: int, board_id: int
) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT noti_content, read_yn
            FROM notification_info
            WHERE user_id = %s
              AND noti_type = 'widget_board_invite'
              AND COALESCE(UPPER(TRIM(read_yn)), 'N') <> 'Y'
            """,
            (int(invitee_user_id),),
        )
        for row in cur.fetchall():
            try:
                p = json.loads(row.get("noti_content") or "{}")
                if int(p.get("widget_board_id") or 0) == int(board_id):
                    return True
            except (json.JSONDecodeError, TypeError, ValueError):
                continue
        return False
    finally:
        cur.close()


def delete_widget_board_notifications_for_board_in_txn(
    conn, widget_board_id: int
) -> int:
    like_pat = f'%"widget_board_id": {int(widget_board_id)}%'
    cur = conn.cursor()
    try:
        cur.execute(
            """
            DELETE FROM notification_info
            WHERE noti_type IN (
                'widget_board_invite',
                'widget_board_invite_accepted',
                'widget_board_invite_rejected'
            )
              AND noti_content IS NOT NULL
              AND noti_content LIKE %s
            """,
            (like_pat,),
        )
        return int(cur.rowcount)
    finally:
        cur.close()


# 5. [초대자 알림 — project_info/user_info 는 제목 구성용 조회]
def user_display_label_for_notification(
    conn, user_id: int, *, max_len: int | None = None
) -> str:
    """user_nickname·user_email COALESCE 후 표시 문자열. max_len 있으면 잘라낸다(어드민 알림 제목 등)."""
    uid = int(user_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COALESCE(
                NULLIF(TRIM(user_nickname), ''),
                NULLIF(TRIM(user_email), '')
            ) AS lab
            FROM user_info WHERE user_id = %s
            """,
            (uid,),
        )
        row = cur.fetchone()
        lab = row.get("lab") if row else None
        if lab:
            s = str(lab).strip()
        else:
            s = f"user_id {uid}"
        if max_len is not None and max_len > 0 and len(s) > max_len:
            return s[:max_len]
        return s
    finally:
        cur.close()


def notify_inviter_project_invite_resolved(
    conn,
    inviter_user_id: int,
    project_info_id: int,
    invitee_user_id: int,
    resolved_notification_id: int,
    accepted: bool,
    *,
    autocommit: bool = False,
) -> None:
    """초대자에게 project_invite 수락/거절 알림. inviter 없거나 ≤0 이면 생략."""
    iuid = int(inviter_user_id)
    if iuid <= 0:
        return
    pid = int(project_info_id)
    invitee = int(invitee_user_id)
    rid = int(resolved_notification_id)
    who = user_display_label_for_notification(conn, invitee)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT project_name FROM project_info WHERE project_info_id = %s",
            (pid,),
        )
        pnrow = cur.fetchone()
        pname = (pnrow.get("project_name") if pnrow else None) or "프로젝트"
        if accepted:
            typ = "project_invite_accepted"
            title = f"{who} 님이 '{pname}' 초대를 수락했습니다"
        else:
            typ = "project_invite_rejected"
            title = f"{who} 님이 '{pname}' 초대를 거절했습니다"
        meta = json.dumps(
            {
                "project_info_id": pid,
                "invitee_user_id": invitee,
                "resolved_notification_info_id": rid,
            },
            ensure_ascii=False,
        )
    finally:
        cur.close()
    insert_notification(
        conn, iuid, typ, title, meta, autocommit=autocommit
    )


def notify_inviter_widget_board_invite_resolved(
    conn,
    inviter_user_id: int,
    widget_board_id: int,
    board_display_name: str,
    invitee_user_id: int,
    resolved_notification_id: int,
    accepted: bool,
    *,
    autocommit: bool = False,
) -> None:
    """초대자에게 위젯 보드 초대 수락/거절 알림. 보드명은 호출자가 이미 조회한 값을 넘긴다."""
    iuid = int(inviter_user_id)
    if iuid <= 0:
        return
    wid = int(widget_board_id)
    invitee = int(invitee_user_id)
    rid = int(resolved_notification_id)
    bname = (board_display_name or "").strip() or "위젯 보드"
    who = user_display_label_for_notification(conn, invitee)
    if accepted:
        typ = "widget_board_invite_accepted"
        title = f"{who} 님이 '{bname}' 위젯 보드 초대를 수락했습니다"
    else:
        typ = "widget_board_invite_rejected"
        title = f"{who} 님이 '{bname}' 위젯 보드 초대를 거절했습니다"
    meta = json.dumps(
        {
            "widget_board_id": wid,
            "invitee_user_id": invitee,
            "resolved_notification_info_id": rid,
        },
        ensure_ascii=False,
    )
    insert_notification(
        conn, iuid, typ, title, meta, autocommit=autocommit
    )


# 6.
def insert_notification(
    conn,
    user_id: int,
    noti_type: str,
    noti_title: str,
    noti_content: str | None = None,
    *,
    autocommit: bool = False,
) -> int:
    """notification_info 1행 삽입. autocommit=False면 호출자가 트랜잭션 commit/rollback."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notification_info (
                user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, 'N', NOW())
            RETURNING notification_info_id
            """,
            (
                int(user_id),
                (noti_type or "")[:30],
                (noti_title or "")[:200],
                noti_content,
            ),
        )
        row = cur.fetchone()
        nid = int(row["notification_info_id"])
        if autocommit:
            conn.commit()
        return nid
    except Exception:
        if autocommit:
            conn.rollback()
        raise
    finally:
        cur.close()
