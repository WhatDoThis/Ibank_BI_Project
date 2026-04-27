"""
Backend.core.change_tracker (data_change_log 서비스 레이어 추적)
================================================================
`ibank_system_data` 관리 감사 대상 테이블(화이트리스트)의 변경을 `data_change_log`에 append한다.
복합 PK 테이블: `target_pk_value`=`"left:right"` (정수 쌍). `table_project_mapping`(project_info_id:table_master_id), `widget_board_share`(widget_board_id:shared_user_id). 첫 컬럼명을 `target_pk_column`에 둔다.
`request_correlation_id`와 `correlation_id`로 system_log와 논리 연결. 실패 시 `logger.exception`만 하고
업무 트랜잭션을 중단하지 않는다. `record_change`는 `SAVEPOINT` 안에서 INSERT 하여 DCL 실패 시에도 호출부 `commit`이 가능하며 `commit`을 직접 호출하지 않는다.

[Main Functions]
===========
- normalize_json_value, strip_pii_from_mapping — 스냅샷·diff용 JSON 안전·PII 제거
- is_safe_sql_identifier, assert_table_identifier — SQL 식별자(테이블·PK 컬럼) 검증
- capture_before — SELECT 스냅샷(화이트리스트·단일/복합 PK)
- compute_diff — 변경 필드 dict (old/new)
- record_change — data_change_log INSERT(SAVEPOINT 격리·내부 예외 삼킴, commit 없음)
- track_update — contextmanager(성공 시에만 after·diff·기록, diff 없으면 생략)
- track_delete — 삭제 전 old 스냅샷 + DELETE 기록(실제 DELETE는 호출부)
- track_insert — INSERT 이후 new 스냅샷 + INSERT 기록
- get_effective_correlation_id — `get_request_correlation_id` 또는 대체 UUID

[Endpoints/Classes/Functions]
=======================
(라우터 없음) admin_server·widget_board_server·project_server·query_studio 등 `conn`과 동일 트랜잭션에서 호출.

[Dependencies]
=========
- contextlib, datetime, decimal, logging, re, uuid, typing
- psycopg2.extras.Json
- Backend.core.request_context.get_request_correlation_id
"""

from __future__ import annotations

import logging
import re
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generator

from psycopg2.extras import Json

from Backend.core.request_context import get_request_correlation_id

logger = logging.getLogger(__name__)

# 문서 25·§4 — PII·민감 필드(스냅샷·diff에서 키 단위 제거, 소문자 키 기준)
PII_STRIP_FIELDS: frozenset[str] = frozenset(
    {
        "password",
        "passwd",
        "pw",
        "secret",
        "token",
        "refresh_token",
        "access_token",
        "phone",
        "mobile",
        "tel",
        "email",
        "user_email",
        "resident_no",
        "account_no",
        "card_no",
    }
)

# capture_before / DML 대상 — 인젝션 방지용 테이블 화이트리스트(공개 API와 별도)
ALLOWED_CHANGE_TRACK_TABLES: frozenset[str] = frozenset(
    {
        "user_info",
        "project_ptcpnt_info",
        "dptmt_info",
        "pmssn_master",
        "project_info",
        "table_master",
        "table_project_mapping",
        "widget_board",
        "widget_item",
        "widget_board_share",
    }
)

# 복합 PK: target_pk_column 은 첫 컬럼명, target_pk_value 는 "left:right" (정수:int:int)
COMPOSITE_PK_TABLES: dict[str, tuple[str, str]] = {
    "table_project_mapping": ("project_info_id", "table_master_id"),
    "widget_board_share": ("widget_board_id", "shared_user_id"),
}

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def is_safe_sql_identifier(name: str) -> bool:
    s = (name or "").strip()
    return bool(s) and _IDENTIFIER_RE.match(s) is not None


def assert_table_identifier(table: str, pk_column: str) -> None:
    t = (table or "").strip()
    if t not in ALLOWED_CHANGE_TRACK_TABLES:
        raise ValueError(f"change_track: disallowed table {t!r}")
    if not is_safe_sql_identifier(t):
        raise ValueError("change_track: invalid table identifier")
    if t in COMPOSITE_PK_TABLES:
        c1, c2 = COMPOSITE_PK_TABLES[t]
        if not is_safe_sql_identifier(c1) or not is_safe_sql_identifier(c2):
            raise ValueError("change_track: invalid composite pk column identifiers")
        return
    c = (pk_column or "").strip()
    if not is_safe_sql_identifier(c):
        raise ValueError("change_track: invalid pk_column identifier")


def get_effective_correlation_id() -> uuid.UUID:
    c = get_request_correlation_id()
    if c is not None:
        return c
    return uuid.uuid4()


def normalize_json_value(value: Any) -> Any:
    """JSONB·API 직렬화에 안전한 스칼라/구조로 정규화."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        if hasattr(value, "isoformat"):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return None
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (int, float, str, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): normalize_json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalize_json_value(x) for x in value]
    return str(value)


def strip_pii_from_mapping(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """최상위·중첩 dict에서 PII 키 제거 후 값은 `normalize_json_value` 처리."""
    if data is None:
        return None
    out: dict[str, Any] = {}
    for k, v in data.items():
        if str(k).lower() in PII_STRIP_FIELDS:
            continue
        if isinstance(v, dict):
            sub = strip_pii_from_mapping(v)
            out[str(k)] = sub if sub is not None else {}
        else:
            out[str(k)] = normalize_json_value(v)
    return out


def capture_before(
    conn: Any,
    table: str,
    pk_column: str,
    pk_value: Any,
) -> dict[str, Any] | None:
    """화이트리스트+식별자 검증 후 `SELECT *` 한 행 dict(PII 제거·정규화). 실패·무행은 None."""
    try:
        assert_table_identifier(table, pk_column)
    except Exception:
        logger.exception("capture_before: identifier validation failed table=%s pk=%s", table, pk_column)
        return None
    cur = conn.cursor()
    try:
        if table in COMPOSITE_PK_TABLES:
            c1, c2 = COMPOSITE_PK_TABLES[table]
            raw_pv = str(pk_value if pk_value is not None else "")
            if ":" not in raw_pv:
                logger.warning(
                    "capture_before: composite pk_value needs ':' table=%s pk=%s",
                    table,
                    pk_value,
                )
                return None
            left, _, right = raw_pv.partition(":")
            try:
                v1 = int(str(left).strip())
                v2 = int(str(right).strip())
            except ValueError:
                logger.exception(
                    "capture_before: composite pk_value not int:int table=%s pk=%s",
                    table,
                    pk_value,
                )
                return None
            sql = f'SELECT * FROM "{table}" WHERE "{c1}" = %s AND "{c2}" = %s'
            cur.execute(sql, (v1, v2))
        else:
            sql = f'SELECT * FROM "{table}" WHERE "{pk_column}" = %s'
            cur.execute(sql, (pk_value,))
        row = cur.fetchone()
        if not row:
            return None
        raw = dict(row) if not isinstance(row, dict) else {**row}
        return strip_pii_from_mapping({str(k): v for k, v in raw.items()})
    except Exception:
        logger.exception("capture_before failed table=%s pk=%s", table, pk_value)
        return None
    finally:
        cur.close()


def compute_diff(
    old_data: dict[str, Any] | None,
    new_data: dict[str, Any] | None,
) -> dict[str, Any]:
    """{field: {"old":..., "new":...}} PII·정규화는 호출 전 strip 가정(동일 키 집합 diff)."""
    o = old_data or {}
    n = new_data or {}
    keys = set(o.keys()) | set(n.keys())
    out: dict[str, Any] = {}
    for k in sorted(keys):
        vo = o.get(k)
        vn = n.get(k)
        if vo != vn:
            out[k] = {"old": vo, "new": vn}
    return out


def record_change(
    conn: Any,
    *,
    correlation_id: uuid.UUID,
    actor_user_id: int,
    project_info_id: int | None,
    target_table: str,
    target_pk_column: str,
    target_pk_value: str,
    operation: str,
    old_data: dict[str, Any] | None,
    new_data: dict[str, Any] | None,
    changed_fields: dict[str, Any] | None,
    channel: str,
) -> None:
    """`data_change_log` INSERT. 요청 단위 SAVEPOINT 로 격리하여 INSERT 실패 시에도 상위 트랜잭션은 abort 되지 않게 한다. 예외는 삼키고 로깅만. commit/rollback 없음."""
    op = (operation or "").strip().upper()
    if op not in ("INSERT", "UPDATE", "DELETE"):
        return
    sp = "sp_dcl_" + uuid.uuid4().hex
    try:
        oj = old_data
        nj = new_data
        cj = changed_fields
        cur = conn.cursor()
        try:
            cur.execute(f"SAVEPOINT {sp}")
            try:
                cur.execute(
                    """
                    INSERT INTO data_change_log (
                        correlation_id, actor_user_id, project_info_id,
                        target_table, target_pk_column, target_pk_value,
                        operation, old_data, new_data, changed_fields, channel, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    )
                    """,
                    (
                        correlation_id,
                        int(actor_user_id),
                        int(project_info_id) if project_info_id is not None else None,
                        (target_table or "")[:80],
                        (target_pk_column or "")[:80],
                        (str(target_pk_value) or "")[:128],
                        op,
                        Json(oj) if oj is not None else None,
                        Json(nj) if nj is not None else None,
                        Json(cj) if cj is not None else None,
                        (channel or "")[:40],
                    ),
                )
            except Exception:
                try:
                    cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                except Exception:
                    logger.exception("record_change: ROLLBACK TO SAVEPOINT failed sp=%s", sp)
                raise
            else:
                cur.execute(f"RELEASE SAVEPOINT {sp}")
        finally:
            cur.close()
    except Exception:
        logger.exception(
            "record_change failed op=%s table=%s pk=%s",
            op,
            target_table,
            target_pk_value,
        )


# --- track_* (실패는 내부에서 삼킴) ---


@contextmanager
def track_update(
    conn: Any,
    table: str,
    pk_column: str,
    pk_value: Any,
    *,
    actor_user_id: int,
    project_info_id: int | None,
    channel: str,
) -> Generator[None, None, None]:
    """enter: before / `with` 본문 성공 시: after, diff, record. diff 없으면 기록 생략."""
    before: dict[str, Any] | None
    try:
        before = capture_before(conn, table, pk_column, pk_value)
    except Exception:
        logger.exception("track_update: capture before failed")
        before = None
    try:
        yield
    except Exception:
        raise
    else:
        try:
            if before is None:
                return
            after = capture_before(conn, table, pk_column, pk_value)
            if after is None:
                return
            b = before or {}
            a = after or {}
            diff = compute_diff(b, a)
            if not diff:
                return
            pk_str = str(pk_value)[:128]
            record_change(
                conn,
                correlation_id=get_effective_correlation_id(),
                actor_user_id=int(actor_user_id),
                project_info_id=project_info_id,
                target_table=table,
                target_pk_column=pk_column,
                target_pk_value=pk_str,
                operation="UPDATE",
                old_data=b,
                new_data=a,
                changed_fields=diff,
                channel=channel,
            )
        except Exception:
            logger.exception("track_update: record after yield failed table=%s pk=%s", table, pk_value)


def track_delete(
    conn: Any,
    table: str,
    pk_column: str,
    pk_value: Any,
    *,
    actor_user_id: int,
    project_info_id: int | None,
    channel: str,
) -> None:
    """DELETE SQL 실행 **전** 호출. old 스냅샷 + DELETE row 기록."""
    try:
        before = capture_before(conn, table, pk_column, pk_value)
        if before is None:
            return
        b = before or {}
        if len(b) == 0:
            return
        record_change(
            conn,
            correlation_id=get_effective_correlation_id(),
            actor_user_id=int(actor_user_id),
            project_info_id=project_info_id,
            target_table=table,
            target_pk_column=pk_column,
            target_pk_value=str(pk_value)[:128],
            operation="DELETE",
            old_data=b,
            new_data=None,
            changed_fields=None,
            channel=channel,
        )
    except Exception:
        logger.exception("track_delete failed table=%s pk=%s", table, pk_value)


def track_insert(
    conn: Any,
    table: str,
    pk_column: str,
    pk_value: Any,
    *,
    actor_user_id: int,
    project_info_id: int | None,
    channel: str,
) -> None:
    """INSERT SQL **이후** 동일 PK로 행을 조회해 기록. diff/이전 없음."""
    try:
        row = capture_before(conn, table, pk_column, pk_value)
        if row is None:
            return
        n = row
        record_change(
            conn,
            correlation_id=get_effective_correlation_id(),
            actor_user_id=int(actor_user_id),
            project_info_id=project_info_id,
            target_table=table,
            target_pk_column=pk_column,
            target_pk_value=str(pk_value)[:128],
            operation="INSERT",
            old_data=None,
            new_data=n,
            changed_fields=None,
            channel=channel,
        )
    except Exception:
        logger.exception("track_insert failed table=%s pk=%s", table, pk_value)
