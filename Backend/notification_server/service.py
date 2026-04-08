"""
Backend.notification_server.service (알림 CRUD)
=============================================
notification_info 조회·읽음·타 유저 알림 생성(어드민·프로젝트용).

[Main Functions]
===========
1. list_notifications: 최근 목록(create_dtm·update_dtm ISO)
2. count_unread: 안 읽은 건수
3. mark_read_one / mark_read_all(read_yn·update_dtm)
4. insert_notification: 시스템 알림 적재

[Dependencies]
=========
- (없음 — conn만 사용)
"""

from __future__ import annotations

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
def mark_read_one(conn, user_id: int, notification_info_id: int) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notification_info
            SET read_yn = 'Y', update_dtm = NOW()
            WHERE notification_info_id = %s AND user_id = %s
            """,
            (notification_info_id, user_id),
        )
        ok = cur.rowcount > 0
        conn.commit()
        return ok
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


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
def insert_notification(
    conn,
    user_id: int,
    noti_type: str,
    noti_title: str,
    noti_content: str | None = None,
) -> int:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notification_info (
                user_id, noti_type, noti_title, noti_content, read_yn, create_dtm
            ) VALUES (%s, %s, %s, %s, 'N', NOW())
            RETURNING notification_info_id
            """,
            (user_id, (noti_type or "")[:30], (noti_title or "")[:200], noti_content),
        )
        nid = cur.fetchone()["notification_info_id"]
        conn.commit()
        return int(nid)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
