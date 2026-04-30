"""
widget_board_server.column_profiler (테이블 컬럼 프로파일·캐시)
==========================================================
데이터 DB에서 information_schema·랜덤 샘플 기반 통계를 수집하고 semantic_role을 부여한다.
결과는 system_db `table_master.column_profiles`(JSONB)·`profile_updated_at`에 저장한다.
QS·ETL 등록 후 트랜잭션 밖에서 `ensure_profile(..., force=True)` 호출 패턴을 지원한다.

[Main Functions]
===========
1. fetch_column_metadata — information_schema 컬럼·PK 목록
2. fetch_column_stats — COUNT(*), 샘플 행·컬럼별 통계(`sample_rows`는 본 함수에서만 생성); `column_meta_list`가 있으면 information_schema 재조회 생략
3. classify_column — §3.2 우선순위(role)·MEASURE 수치형 선행 시 IDENTIFIER 접미사 스킵
4. profile_table — 메타+통계 병합·`profiled_at`(UTC ISO8601)·`sample_rows` 패스스루
5. save_profile_to_table_master — UPDATE column_profiles·NOW()
6. ensure_profile — TTL은 DB `NOW()` 비교·실패 시 경고 후 캐시 또는 최소 dict 반환(등록 흐름에서 예외 전파 최소화)
7. summarize_semantic_roles — 프로파일 JSON `columns`에서 role 카운트
8. backfill_missing_profiles — 프로파일이 비어 있는 행(NULL·`{}`·`columns` 없음/빈 배열) 일괄 프로파일(sync); `db_type`별 데이터 커넥션 재사용·행 실패 시 해당 연결 `safe_rollback`

[Dependencies]
=========
- re, logging, datetime.timezone
- collections.abc.Callable
- typing.Any
- psycopg2.extras.RealDictCursor, psycopg2.extras.Json
- Backend.core.db (`format_value`, `safe_rollback`)
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from psycopg2.extras import Json, RealDictCursor

logger = logging.getLogger(__name__)

IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

_MEASURE_PG_TYPES = frozenset(
    {
        "smallint",
        "integer",
        "bigint",
        "decimal",
        "numeric",
        "real",
        "double precision",
        "float",
        "serial",
        "bigserial",
    }
)


def _validate_identifier(name: str, label: str) -> str:
    s = (name or "").strip()
    if not s or not IDENTIFIER_RE.match(s):
        raise ValueError(f"{label} 식별자가 허용 패턴이 아닙니다: {name!r}")
    return s


# 1.
def fetch_column_metadata(conn, schema: str, table_name: str) -> list[dict[str, Any]]:
    sch = _validate_identifier(schema, "schema")
    tbl = _validate_identifier(table_name, "table_name")
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT column_name, data_type, ordinal_position, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (sch, tbl),
        )
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.ordinal_position
            """,
            (sch, tbl),
        )
        pk_cols = {r["column_name"] for r in cur.fetchall()}
        out: list[dict[str, Any]] = []
        for r in rows:
            cn = r["column_name"]
            dt = (r.get("data_type") or "").strip().lower()
            out.append(
                {
                    "name": cn,
                    "pg_type": dt,
                    "ordinal": int(r["ordinal_position"] or 0),
                    "nullable": str(r.get("is_nullable") or "").upper() == "YES",
                    "is_pk": cn in pk_cols,
                }
            )
        return out
    finally:
        cur.close()


def _normalize_pg_type_for_measure(data_type: str) -> str:
    t = (data_type or "").strip().lower()
    if t.startswith("timestamp") or t == "date":
        return t
    base = t.split("(", 1)[0].strip()
    return base


def _is_measure_pg_type(data_type: str) -> bool:
    base = _normalize_pg_type_for_measure(data_type)
    return base in _MEASURE_PG_TYPES


def _is_temporal_pg_type(data_type: str) -> bool:
    t = (data_type or "").strip().lower()
    return t == "date" or "timestamp" in t


def _is_string_pg_type(data_type: str) -> bool:
    base = _normalize_pg_type_for_measure(data_type)
    return base in ("character varying", "varchar", "text", "character", "char", "name")


def _is_boolean_pg_type(data_type: str) -> bool:
    return _normalize_pg_type_for_measure(data_type) == "boolean"


# 2.
def fetch_column_stats(
    conn,
    schema: str,
    table_name: str,
    sample_limit: int = 1000,
    *,
    column_meta_list: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    column_meta_list: `fetch_column_metadata` 결과를 넘기면 동일 테이블에 대해
    information_schema·PK 쿼리를 반복하지 않는다(`profile_table` 경로 권장).
    """
    sch = _validate_identifier(schema, "schema")
    tbl = _validate_identifier(table_name, "table_name")
    lim = max(1, min(int(sample_limit or 1000), 50_000))
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f'SELECT COUNT(*) AS total_count FROM "{sch}"."{tbl}"'
        )
        total_row = cur.fetchone() or {}
        total_count = int(total_row.get("total_count") or 0)

        # 대용량 테이블 부하 시 TABLESAMPLE 등 후속 개선(문서 26 §3.3.2)
        cur.execute(
            f'SELECT * FROM "{sch}"."{tbl}" ORDER BY random() LIMIT %s',
            (lim,),
        )
        sample_rows_raw = cur.fetchall()
        sample_count = len(sample_rows_raw)
        col_names: list[str] = []
        if cur.description:
            col_names = [d[0] for d in cur.description]

        if column_meta_list is not None:
            meta_by_name = {m["name"]: m for m in column_meta_list}
        else:
            meta_by_name = {m["name"]: m for m in fetch_column_metadata(conn, sch, tbl)}
        columns_stats: dict[str, dict[str, Any]] = {}

        for cn in col_names:
            meta = meta_by_name.get(cn, {})
            pg_t = meta.get("pg_type") or ""
            vals: list[Any] = []
            null_count = 0
            for row in sample_rows_raw:
                rd = dict(row)
                v = rd.get(cn)
                if v is None:
                    null_count += 1
                else:
                    vals.append(v)
            try:
                distinct_count = len(set(vals))
            except TypeError:
                distinct_count = len({str(v) for v in vals})
            null_ratio = (null_count / sample_count) if sample_count else 0.0

            entry: dict[str, Any] = {
                "distinct_count": distinct_count,
                "null_count": null_count,
                "null_ratio": float(null_ratio),
                "min_value": None,
                "max_value": None,
            }

            if sample_count > 0 and (_is_measure_pg_type(pg_t) or _is_temporal_pg_type(pg_t)):
                non_null = list(vals)
                if non_null:
                    try:
                        entry["min_value"] = min(non_null)
                        entry["max_value"] = max(non_null)
                    except TypeError:
                        pass

            columns_stats[cn] = entry

        from Backend.core import db as core_db

        preview: list[dict[str, Any]] = []
        for row in sample_rows_raw[:5]:
            rd = dict(row)
            preview.append({k: core_db.format_value(rd[k]) for k in rd})

        return {
            "total_rows": total_count,
            "sample_count": sample_count,
            "columns": columns_stats,
            "sample_rows": preview,
        }
    finally:
        cur.close()


def _name_temporal_hint(col_name: str) -> bool:
    n = (col_name or "").lower()
    hints = ("_dt", "_date", "_dtm", "created_at", "updated_at")
    return any(h in n for h in hints)


def _name_geo_hint(col_name: str) -> bool:
    n = (col_name or "").lower()
    return any(
        x in n
        for x in ("lat", "lng", "longitude", "latitude")
    )


def _name_identifier_suffix(col_name: str) -> bool:
    n = (col_name or "").lower()
    return n.endswith("_id") or n.endswith("_key") or n.endswith("_code")


# 3.
def classify_column(col_meta: dict[str, Any], col_stats: dict[str, Any], sample_count: int) -> str:
    """
    §3.2 순서: PK→IDENTIFIER; TEMPORAL·GEO; 수치형 MEASURE는 접미사 _id 등보다 우선(비PK만);
    접미사 IDENTIFIER; 문자열 카디널리티·불리언 등.
    """
    name = col_meta.get("name") or ""
    pg_type = col_meta.get("pg_type") or ""
    is_pk = bool(col_meta.get("is_pk"))
    distinct_count = int(col_stats.get("distinct_count") or 0)

    if is_pk:
        return "IDENTIFIER"

    if _is_temporal_pg_type(pg_type) or _name_temporal_hint(name):
        return "TEMPORAL"
    if _name_geo_hint(name):
        return "GEO"

    if _is_measure_pg_type(pg_type):
        return "MEASURE"

    if _name_identifier_suffix(name):
        return "IDENTIFIER"

    if _is_boolean_pg_type(pg_type):
        return "DIMENSION"
    if _is_string_pg_type(pg_type):
        half = (sample_count * 0.5) if sample_count else 0
        if distinct_count <= half:
            return "DIMENSION"
        return "HIGH_CARDINALITY_TEXT"

    return "DIMENSION"


# 4.
def profile_table(
    conn,
    schema: str,
    table_name: str,
    sample_limit: int = 1000,
) -> dict[str, Any]:
    sch = _validate_identifier(schema, "schema")
    tbl = _validate_identifier(table_name, "table_name")
    meta = fetch_column_metadata(conn, sch, tbl)
    stats = fetch_column_stats(
        conn, sch, tbl, sample_limit=sample_limit, column_meta_list=meta
    )
    sample_cnt = int(stats.get("sample_count") or 0)
    col_stats_map = stats.get("columns") or {}

    from Backend.core import db as core_db

    columns_out: list[dict[str, Any]] = []
    for m in meta:
        cn = m["name"]
        st = col_stats_map.get(cn, {})
        role = classify_column(m, st, sample_cnt)
        columns_out.append(
            {
                "name": cn,
                "pg_type": m.get("pg_type"),
                "semantic_role": role,
                "nullable": bool(m.get("nullable")),
                "is_pk": bool(m.get("is_pk")),
                "distinct_count": int(st.get("distinct_count") or 0),
                "null_ratio": float(st.get("null_ratio") or 0.0),
                "min_value": core_db.format_value(st.get("min_value")),
                "max_value": core_db.format_value(st.get("max_value")),
            }
        )

    profiled_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "table_name": tbl,
        "total_rows": int(stats.get("total_rows") or 0),
        "sample_count": sample_cnt,
        "profiled_at": profiled_at,
        "columns": columns_out,
        "sample_rows": list(stats.get("sample_rows") or []),
    }


# 5.
def save_profile_to_table_master(system_conn, table_master_id: int, profile: dict[str, Any]) -> None:
    cur = system_conn.cursor()
    try:
        cur.execute(
            """
            UPDATE table_master
            SET column_profiles = %s::jsonb,
                profile_updated_at = NOW()
            WHERE table_master_id = %s
            """,
            (Json(profile), int(table_master_id)),
        )
        system_conn.commit()
    finally:
        cur.close()


def _parse_profiles_raw(raw: Any) -> dict[str, Any] | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return None


# 6.
def ensure_profile(
    system_conn,
    data_conn,
    table_master_id: int,
    schema: str,
    table_name: str,
    ttl_hours: int = 24,
    force: bool = False,
) -> dict[str, Any]:
    tid = int(table_master_id)
    ttl = max(0, int(ttl_hours))
    cur = system_conn.cursor(cursor_factory=RealDictCursor)
    cached: dict[str, Any] | None = None
    try:
        cur.execute(
            """
            SELECT column_profiles, profile_updated_at,
                   (%s::boolean
                    OR column_profiles IS NULL
                    OR profile_updated_at IS NULL
                    OR profile_updated_at < (NOW() - (%s::int * INTERVAL '1 hour'))
                   ) AS needs_refresh
            FROM table_master
            WHERE table_master_id = %s
            """,
            (bool(force), ttl, tid),
        )
        row = cur.fetchone()
        if not row:
            logger.warning("ensure_profile: table_master_id=%s 행 없음", tid)
            return {}
        cached = _parse_profiles_raw(row.get("column_profiles"))
        needs = bool(row.get("needs_refresh"))
        if not needs and cached is not None:
            return cached
    finally:
        cur.close()

    try:
        sch = _validate_identifier(schema, "schema")
        tbl = _validate_identifier(table_name, "table_name")
        prof = profile_table(data_conn, sch, tbl)
        save_profile_to_table_master(system_conn, tid, prof)
        return prof
    except Exception as e:
        logger.warning(
            "프로파일링 실패 table_master_id=%s schema=%s table=%s: %s",
            tid,
            schema,
            table_name,
            e,
            exc_info=True,
        )
        if cached is not None:
            return cached
        return {
            "table_name": table_name,
            "total_rows": 0,
            "sample_count": 0,
            "profiled_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "columns": [],
            "sample_rows": [],
        }


# 7.
def summarize_semantic_roles(column_profiles: dict[str, Any] | None) -> dict[str, Any] | None:
    if not column_profiles or not isinstance(column_profiles, dict):
        return None
    cols = column_profiles.get("columns")
    if not isinstance(cols, list):
        return None
    counts: dict[str, int] = {}
    for c in cols:
        if not isinstance(c, dict):
            continue
        role = (c.get("semantic_role") or "").strip()
        if not role:
            continue
        counts[role] = counts.get(role, 0) + 1
    return counts if counts else None


# 8.
def backfill_missing_profiles(
    system_conn: Any,
    get_data_conn: Callable[[str], Any],
    batch_size: int = 10,
) -> dict[str, Any]:
    """
    get_data_conn: db_type('main'|'dash' 등)마다 데이터 DB 커넥션 반환.
    """
    bs = max(1, min(int(batch_size or 10), 500))
    cur = system_conn.cursor(cursor_factory=RealDictCursor)
    failures: list[dict[str, Any]] = []
    success = 0
    total = 0
    data_conns_by_type: dict[str, Any] = {}
    try:
        cur.execute(
            """
            SELECT table_master_id, db_type, table_name
            FROM table_master
            WHERE UPPER(TRIM(COALESCE(del_yn, 'N'))) = 'N'
              AND (
                column_profiles IS NULL
                OR column_profiles = '{}'::jsonb
                OR (
                  jsonb_typeof(column_profiles) = 'object'
                  AND (
                    NOT (column_profiles ? 'columns')
                    OR jsonb_array_length(
                      COALESCE(column_profiles->'columns', '[]'::jsonb)
                    ) = 0
                  )
                )
              )
            ORDER BY table_master_id
            """
        )
        rows = [dict(r) for r in cur.fetchall()]
        total = len(rows)

        for i in range(0, len(rows), bs):
            chunk = rows[i : i + bs]
            for r in chunk:
                tmid = int(r["table_master_id"])
                dt = str(r.get("db_type") or "main").strip().lower()
                tn = (r.get("table_name") or "").strip()
                try:
                    if dt not in data_conns_by_type:
                        data_conns_by_type[dt] = get_data_conn(dt)
                    data_conn = data_conns_by_type[dt]
                    from Backend.core import db as core_db

                    schema = (
                        core_db.get_table_schema()
                        if dt != "dash"
                        else core_db.get_dash_table_schema()
                    )
                    prof = profile_table(data_conn, schema, tn)
                    save_profile_to_table_master(system_conn, tmid, prof)
                    success += 1
                except Exception as e:
                    failures.append(
                        {
                            "table_master_id": tmid,
                            "table_name": tn,
                            "error": str(e),
                        }
                    )
                    logger.warning(
                        "backfill 프로파일 실패 table_master_id=%s table=%s: %s",
                        tmid,
                        tn,
                        e,
                    )
                    try:
                        from Backend.core import db as _db

                        dc = data_conns_by_type.get(dt)
                        if dc is not None:
                            _db.safe_rollback(dc)
                    except Exception:
                        pass
    finally:
        for c in data_conns_by_type.values():
            try:
                c.close()
            except Exception:
                pass
        data_conns_by_type.clear()
        cur.close()

    return {
        "total": total,
        "success": success,
        "failed": len(failures),
        "failures": failures,
    }
