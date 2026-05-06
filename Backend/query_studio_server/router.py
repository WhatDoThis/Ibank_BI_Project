"""
Backend.query_studio_server.router (쿼리 스튜디오 API)
===================================================
FastAPI 라우터. prefix /api. 테이블 목록·구조·JOIN 관계·쿼리 실행·Claude 해석·컬럼 고유값·쿼리 통계.

[Helpers]
===========
1. _load_labels_file, _save_labels_file: 공통 라벨 JSON 파일 로드·저장(레거시·디폴트 보조)
2. query_studio_user_labels: 시스템 DB에 user_id+project_info_id별 labels_json(JSONB) 저장
3. _resolve_table_display_label / _resolve_column_display_label: 유저 JSON → 파일 → table_master(테이블명만) → 코드 기본 → 물리명
4. _get_table_label, _get_column_label: 유저 컨텍스트 없을 때 파일+기본만
5. _load_column_labels: 파일 column_labels만
6. _log: 디버그 로그 출력·파일 기록
7. _contains_dangerous_sql: Backend.core.sql_safety 래퍼(디버그 로그)
8. _fetch_relationships: FK/추론 관계 조회(`*, project_info_id` 필수, 병합 허용 집합)
9. _compute_relationships_all_raw: FK+추론 전체 관계 계산(무캐시)
9a. _compute_relationships_all: peak_guard(TTL 캐시·동시성 상한) 적용 래퍼
9b. _resolve_project_table_db_type / _qs_mapped_table_conn: list/describe/고유값용 main_db 매핑 검증·연결 선택
10. _ensure_queue_table: save_query_as_table 작업 큐 테이블 생성(create_user_id 컬럼 포함)
11. _save_table_worker: 쿼리 결과 저장 워커 (백그라운드, CREATE 후 table_master·매핑 upsert 3회 재시도)
12. _upsert_table_master_and_mapping: table_master·table_project_mapping UPSERT + `data_change_log` track_* (create_user_id>0일 때)

[Endpoints]
===========
11. list_tables: GET /api/list-tables?mapping_usage=query_studio|widgetboard (채널별 매핑·`table_master_id`·`role_summary`)
12. describe_table: POST /api/describe-table (mapping_usage 동일, main_db 매핑 테이블만·항상 main 연결)
13. get_column_labels: GET /api/column-labels (테이블·컬럼 라벨)
14. save_column_labels: POST /api/column-labels (라벨 저장·성공 시 `labels_save` 계측)
15. table_relationships: GET /api/table-relationships (mode=fk|all, JWT project_info_id 필수)
16. api_join_order: POST /api/join-order (JOIN 순서, 허용 테이블은 프로젝트 매핑 병합 집합)
17. save_query_as_table: POST /api/save-query-as-table (쿼리 결과→테이블; DDL 완료는 워커에서 `emit_query_studio_log`·`saved_table_create`)
18. save_query_as_table_status: GET /api/save-query-as-table/status/{job_id}
19. execute_query: POST /api/execute-query (SELECT, main_db만·성공 시 `query_execute` 계측·`sql_fingerprint`·`user_id`는 JWT 클레임 정수로 확정)
19a. estimate_query_result: POST /api/estimate-query-result (EXPLAIN FORMAT JSON만·플래너 예상 행·폭으로 결과 데이터 크기 추정)
20. explain_sql: POST /api/explain-sql (Claude 해석)
21. get_column_values: POST /api/get-column-values (main_db·main 매핑만)
22. query_stats: POST /api/query-stats (COUNT·EXPLAIN, main_db만)

[Dependencies]
=========
- Backend.query_studio_server.audit_emit.emit_query_studio_log
- Backend.core.change_tracker (`_upsert_table_master_and_mapping` 내 track_insert·track_update)
- Backend.core.db, Backend.core.sql_safety, Backend.core.sql_fingerprint.compute_sql_fingerprint_hex, Backend.core.dependencies(get_db·get_config·get_system_db)
- Backend.auth_server.deps.require_active_access, Backend.auth_server.permissions(require_permission, compute_effective_project_permission_ids, get_user_dvsn_lower, is_project_active)
- require_query_read_perm / require_query_execute_perm: 테스트·오버라이드용 공통 Depends 대상
- Backend.query_studio_server.schemas, pluralize, join_path, join_metrics, relationship_inference, peak_guard
- fastapi, psycopg2, psycopg2.extras.RealDictCursor, requests
"""

import json
import logging
import math
import re
import threading
import time
import traceback
import uuid
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

import psycopg2
from psycopg2 import sql as pg_sql
from psycopg2.extras import Json, RealDictCursor
import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response

from Backend.core import db
from Backend.core.change_tracker import track_insert, track_update
from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex
from Backend.core.sql_safety import contains_dangerous_sql as _core_contains_dangerous_sql
from Backend.query_studio_server import peak_guard
from Backend.query_studio_server.relationship_inference import infer_relationships
from Backend.auth_server.deps import require_active_access
from Backend.auth_server.permissions import (
    compute_effective_project_permission_ids,
    get_user_dvsn_lower,
    is_project_active,
    require_permission,
)
from Backend.core.dependencies import get_db, get_config, get_system_db
from Backend.widget_board_server.column_profiler import ensure_profile, summarize_semantic_roles
from Backend.query_studio_server.audit_emit import emit_query_studio_log
from Backend.query_studio_server.join_path import determine_join_order, validate_join_order
from Backend.query_studio_server.join_metrics import join_accuracy_score
from Backend.query_studio_server.schemas import (
    ColumnLabelsRequest,
    DescribeTableRequest,
    ExecuteQueryRequest,
    ExplainSqlRequest,
    GetColumnValuesRequest,
    JoinOrderRequest,
    QueryStatsRequest,
    SaveQueryAsTableRequest,
)

require_query_read_perm = require_permission("query.read")
require_query_execute_perm = require_permission("query.execute")

_MSG_MAPPING_LIST_FEATURE_OFF = "이 프로젝트에서 사용할 수 없는 기능입니다."
_MSG_MAPPING_LIST_INACTIVE = "비활성화된 프로젝트입니다. 홈에서 다른 프로젝트를 선택하세요."

logger = logging.getLogger(__name__)


def _normalize_mapping_usage(raw: str) -> str:
    mu = (raw or "query_studio").strip().lower()
    if mu not in ("query_studio", "widgetboard"):
        raise HTTPException(
            status_code=400,
            detail="mapping_usage는 query_studio 또는 widgetboard 여야 합니다.",
        )
    return mu


def _assert_mapping_list_perm(mapping_usage: str, payload: dict, conn) -> str:
    """list-tables·describe-table 공통: 채널별로 query.read 또는 widgetboard 권한 검사."""
    mu = _normalize_mapping_usage(mapping_usage)
    raw_pid = payload.get("project_info_id")
    if raw_pid is None:
        raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
    project_info_id = int(raw_pid)
    user_id = int(payload["user_id"])
    raw_dvsn = get_user_dvsn_lower(conn, user_id)
    eff = compute_effective_project_permission_ids(
        conn, user_id, project_info_id, raw_dvsn
    )
    eff_set = set(eff)
    need = "query.read" if mu == "query_studio" else "widgetboard"
    if need not in eff_set:
        if not is_project_active(conn, project_info_id):
            raise HTTPException(status_code=403, detail=_MSG_MAPPING_LIST_INACTIVE)
        raise HTTPException(status_code=403, detail=_MSG_MAPPING_LIST_FEATURE_OFF)
    return mu

# 프로젝트 루트: Backend/query_studio_server/router.py → 3단계 상위
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DEBUG_LOG_DIR = _PROJECT_ROOT / "Env" / "logs"
_DEBUG_LOG_PATH = _DEBUG_LOG_DIR / "execute_query_debug.log"
_COLUMN_LABELS_PATH = _PROJECT_ROOT / "Env" / "config" / "column_labels.json"

# 기본 테이블 라벨 (사용자 저장값 없을 때 사용)
DEFAULT_TABLE_LABELS = {
    "campaigns": "캠페인",
    "test_coupons_data": "쿠폰 데이터",
    "test_deliveries_data": "발송 데이터",
    "test_delivery_tracking": "발송 트래킹",
    "workflows": "워크플로우",
    "i1_campaign_workflow_list": "캠페인·워크플로우 목록",
    "i1_delivery_tracking_joined": "발송·트래킹 조인",
    "i1_daily_delivery_count": "일별 발송 건수",
    "i1_campaign_delivery_count": "캠페인별 발송 건수",
    "i1_workflow_delivery_count": "워크플로우별 발송 건수",
    "i1_channel_delivery_count": "채널별 발송 건수",
    "i1_daily_campaign_delivery": "일별·캠페인별 발송",
    "i1_daily_workflow_delivery": "일별·워크플로우별 발송",
    "i1_tracking_by_type": "발송별 트래킹 타입 건수",
    "i1_campaign_daily_channel": "캠페인·일·채널 발송",
    "i1_delivery_status_summary": "발송 상태별 건수",
    "i1_workflow_list_per_campaign": "캠페인별 워크플로우 목록",
    "i1_recent_deliveries": "최근 발송",
    "i1_delivery_with_campaign_workflow": "발송+캠페인+워크플로우",
    "i1_tracking_daily_count": "일별 트래킹 건수",
    "i1_campaign_coupon_count": "캠페인별 쿠폰 건수",
    "i1_workflow_coupon_count": "워크플로우별 쿠폰 건수",
    "i1_daily_coupon_count": "일별 쿠폰 건수",
    "i1_daily_campaign_coupon": "일별·캠페인별 쿠폰",
    "i1_daily_workflow_coupon": "일별·워크플로우별 쿠폰",
    "i1_coupon_with_campaign_workflow": "쿠폰+캠페인+워크플로우",
    "i1_recent_coupons": "최근 쿠폰",
    "i1_campaign_workflow_coupon_count": "캠페인·워크플로우별 쿠폰 건수",
}

# 공통 컬럼 라벨 (테이블별 지정 없을 때)
COMMON_COLUMN_LABELS = {
    "id": "ID",
    "campaign_id": "캠페인 ID",
    "workflow_id": "워크플로우 ID",
    "delivery_id": "발송 ID",
    "recipient_id": "수신자 ID",
    "coupon_id": "쿠폰 ID",
    "delivery_date": "발송일",
    "delivery_channel": "발송 채널",
    "delivery_status": "발송 상태",
    "campaign_label": "캠페인 라벨",
    "workflow_label": "워크플로우 라벨",
    "campaign_internal_name": "캠페인 내부명",
    "workflow_internal_name": "워크플로우 내부명",
    "tracking_type": "트래킹 유형",
    "tracking_date": "트래킹 일시",
    "coupon_date": "쿠폰 일자",
    "created": "생성일시",
    "last_modified": "최종 수정",
    "created_at": "생성일시",
    "updated_at": "수정일시",
    "cnt": "건수",
    "delivery_pk": "발송 PK",
    "tracking_id": "트래킹 ID",
    "tracking_recipient_id": "트래킹 수신자 ID",
    "delivery_internal_name": "발송 내부명",
    "delivery_code": "발송 코드",
    "delivery_label": "발송 라벨",
}

# 테이블별 컬럼 라벨 (공통보다 우선)
DEFAULT_COLUMN_LABELS_BY_TABLE = {
    "campaigns": {"campaign_internal_name": "캠페인 내부명", "campaign_label": "캠페인 라벨"},
    "workflows": {"workflow_internal_name": "워크플로우 내부명", "workflow_label": "워크플로우 라벨"},
}


# 1.
def _load_labels_file():
    """Env/config/column_labels.json 읽기. 형식: { table_labels?: {}, column_labels?: { table: { col: label } } } 또는 구형 { table: { col: label } }"""
    if not _COLUMN_LABELS_PATH.exists():
        return {"table_labels": {}, "column_labels": {}}
    try:
        with open(_COLUMN_LABELS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {"table_labels": {}, "column_labels": {}}
    if "table_labels" in data and "column_labels" in data:
        return data
    # 구형: 전체가 column_labels (테이블명 -> { 컬럼 -> 라벨 })
    return {"table_labels": {}, "column_labels": data if isinstance(data, dict) else {}}


# 2.
def _save_labels_file(data):
    """table_labels + column_labels 저장."""
    _COLUMN_LABELS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_COLUMN_LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# 2a. 계정·프로젝트별 라벨 (시스템 DB JSONB)
_QUERY_STUDIO_USER_LABELS_TABLE = "query_studio_user_labels"
_user_labels_table_lock = threading.Lock()
_user_labels_table_ready = False


def _ensure_query_studio_user_labels_table():
    global _user_labels_table_ready
    if _user_labels_table_ready:
        return
    with _user_labels_table_lock:
        if _user_labels_table_ready:
            return
        conn = db.get_db_connection_system_core()
        cur = conn.cursor()
        try:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {_QUERY_STUDIO_USER_LABELS_TABLE} (
                    user_id INT4 NOT NULL,
                    project_info_id INT4 NOT NULL,
                    labels_json JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, project_info_id)
                )
                """
            )
            conn.commit()
            _user_labels_table_ready = True
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()


def _empty_user_labels():
    return {"table_labels": {}, "column_labels": {}}


def _normalize_stored_labels(raw):
    if raw is None:
        return _empty_user_labels()
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return _empty_user_labels()
    if not isinstance(raw, dict):
        return _empty_user_labels()
    tl = raw.get("table_labels") or {}
    cl = raw.get("column_labels") or {}
    if not isinstance(tl, dict):
        tl = {}
    if not isinstance(cl, dict):
        cl = {}
    col_norm = {}
    for tk, tv in cl.items():
        if isinstance(tv, dict):
            col_norm[str(tk)] = {str(ck): ("" if cv is None else str(cv)) for ck, cv in tv.items()}
    return {
        "table_labels": {str(k): ("" if v is None else str(v)) for k, v in tl.items()},
        "column_labels": col_norm,
    }


def _load_user_project_labels(user_id: int, project_info_id: int) -> dict:
    _ensure_query_studio_user_labels_table()
    conn = db.get_db_connection_system_core()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f"SELECT labels_json FROM {_QUERY_STUDIO_USER_LABELS_TABLE} WHERE user_id = %s AND project_info_id = %s",
            (int(user_id), int(project_info_id)),
        )
        row = cur.fetchone()
        if not row:
            return _empty_user_labels()
        return _normalize_stored_labels(row.get("labels_json"))
    finally:
        cur.close()
        conn.close()


def _persist_user_project_labels(user_id: int, project_info_id: int, data: dict) -> None:
    _ensure_query_studio_user_labels_table()
    normalized = {
        "table_labels": dict(data.get("table_labels") or {}),
        "column_labels": {str(k): dict(v) for k, v in (data.get("column_labels") or {}).items()},
    }
    conn = db.get_db_connection_system_core()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_QUERY_STUDIO_USER_LABELS_TABLE} (user_id, project_info_id, labels_json, updated_at)
            VALUES (%s, %s, %s::jsonb, NOW())
            ON CONFLICT (user_id, project_info_id)
            DO UPDATE SET labels_json = EXCLUDED.labels_json, updated_at = NOW()
            """,
            (int(user_id), int(project_info_id), json.dumps(normalized, ensure_ascii=False)),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def _resolve_table_display_label(table_name, user_data, file_data, row_meta=None):
    """유저 JSON → table_master 메타 → 파일 → DEFAULT_TABLE_LABELS → 물리명."""
    row_meta = row_meta or {}
    ut = (user_data.get("table_labels") or {}).get(table_name)
    if ut is not None and str(ut).strip():
        return str(ut).strip()
    rm = row_meta.get("table_label") if isinstance(row_meta, dict) else None
    if rm is not None and str(rm).strip():
        return str(rm).strip()
    ft = (file_data.get("table_labels") or {}).get(table_name)
    if ft is not None and str(ft).strip():
        return str(ft).strip()
    return DEFAULT_TABLE_LABELS.get(table_name) or table_name


def _resolve_column_display_label(table_name, column_name, user_data, file_data, meta_row=None):
    """유저 JSON → 파일 → 테이블별/공통 기본 → PG 컬럼 코멘트(logical_key) → 물리명."""
    uc = (user_data.get("column_labels") or {}).get(table_name, {}).get(column_name)
    if uc is not None and str(uc).strip():
        return str(uc).strip()
    fc = (file_data.get("column_labels") or {}).get(table_name, {}).get(column_name)
    if fc is not None and str(fc).strip():
        return str(fc).strip()
    by_table = DEFAULT_COLUMN_LABELS_BY_TABLE.get(table_name, {}).get(column_name)
    if by_table:
        return by_table
    cm = COMMON_COLUMN_LABELS.get(column_name)
    if cm:
        return cm
    if meta_row and meta_row.get("logical_key"):
        lk = str(meta_row["logical_key"]).strip()
        if lk:
            return lk
    return column_name


# 3.
def _get_table_label(table_name):
    """파일·기본만 (유저 컨텍스트 없음)."""
    fd = _load_labels_file()
    return _resolve_table_display_label(table_name, _empty_user_labels(), fd, {})


# 4.
def _get_column_label(table_name, column_name):
    """파일·기본만 (유저 컨텍스트 없음)."""
    fd = _load_labels_file()
    return _resolve_column_display_label(table_name, column_name, _empty_user_labels(), fd)


# 5.
def _load_column_labels():
    """구형 호환: column_labels만 반환 (table_name -> { col -> label })."""
    data = _load_labels_file()
    return data.get("column_labels") or {}


# 6.
def _log(msg, *args):
    line = f"[execute-query] {msg % args if args else msg}"
    print(line, flush=True)
    try:
        _DEBUG_LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(datetime.now().strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")
    except Exception:
        pass


# 7.
def _contains_dangerous_sql(query):
    if not query or not str(query).strip():
        _log("dangerous_sql: query empty -> None")
        return None
    matched = _core_contains_dangerous_sql(query)
    if matched:
        _log("dangerous_sql: matched=%s", matched)
    else:
        _log("dangerous_sql: all segments passed -> None")
    return matched


def _explain_json_root_rows_width(plan_payload):
    """EXPLAIN (FORMAT JSON) 최상위 Plan의 Plan Rows·Plan Width (플래너 추정)."""
    if not isinstance(plan_payload, list) or len(plan_payload) == 0:
        return None, None
    root = plan_payload[0]
    if not isinstance(root, dict):
        return None, None
    plan = root.get("Plan")
    if not isinstance(plan, dict):
        return None, None
    rows = plan.get("Plan Rows")
    width = plan.get("Plan Width")
    try:
        rows_f = float(rows) if rows is not None else None
    except (TypeError, ValueError):
        rows_f = None
    try:
        width_i = int(width) if width is not None else None
    except (TypeError, ValueError):
        width_i = None
    return rows_f, width_i


router = APIRouter(prefix="/api", tags=["report"])


# 8.
def _fetch_relationships(conn, mode="fk", table_columns=None, *, project_info_id: int):
    """관계 목록 반환 (dedup: 쌍당 한 방향). mode=all일 때 table_columns를 넘기면 컬럼 조회를 한 번만 수행. project_info_id=프로젝트 허용 집합."""
    allowed = db.get_merged_allowed_table_names_for_project(int(project_info_id))
    if not allowed:
        return []
    mode = (mode or "fk").strip().lower()
    if mode not in ("fk", "column", "all"):
        mode = "fk"
    relationships = []
    if mode in ("fk", "all"):
        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            placeholders = ", ".join(["%s"] * len(allowed))
            sql = (
                "SELECT tc.constraint_name, kcu.ordinal_position, "
                "kcu.table_name AS from_table, kcu.column_name AS from_column, "
                "ccu.table_name AS to_table, ccu.column_name AS to_column "
                "FROM information_schema.table_constraints tc "
                "JOIN information_schema.key_column_usage kcu "
                "ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
                "JOIN information_schema.constraint_column_usage ccu "
                "ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema "
                "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = %s "
                "AND kcu.table_name IN (" + placeholders + ") "
                "AND ccu.table_name IN (" + placeholders + ") "
                "ORDER BY tc.constraint_name, kcu.ordinal_position"
            )
            cur.execute(sql, (schema,) + tuple(allowed) + tuple(allowed))
            fk_raw = [dict(r) for r in cur.fetchall()]

            # UNIQUE 제약 조회: FK 컬럼이 단일 컬럼 UNIQUE이면 1:1, 아니면 N:1 (문서 5.1)
            unique_pairs = set()
            cur.execute(
                """
                SELECT tc.table_name, MAX(kcu.column_name) AS column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = %s
                  AND tc.table_name IN (""" + placeholders + """)
                GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
                HAVING COUNT(*) = 1
                """,
                (schema,) + tuple(allowed),
            )
            for r in cur.fetchall():
                unique_pairs.add((r["table_name"], r["column_name"]))

            # 제약별 그룹화 → from_columns / to_columns 배열 (복합키 지원, 문서 5.1)
            by_constraint = OrderedDict()
            for r in fk_raw:
                key = r["constraint_name"]
                if key not in by_constraint:
                    by_constraint[key] = []
                by_constraint[key].append(r)
            for rows in by_constraint.values():
                rows.sort(key=lambda x: (x["ordinal_position"], x["from_column"]))
                from_cols = [x["from_column"] for x in rows]
                to_cols = [x["to_column"] for x in rows]
                first = rows[0]
                fcol = first["from_column"]
                role = (fcol[:-3] if fcol.endswith("_id") and len(fcol) > 3 else None)  # sender_id → sender (문서 5.3 역할)
                rel = {
                    "from_table": first["from_table"],
                    "from_column": fcol,
                    "to_table": first["to_table"],
                    "to_column": first["to_column"],
                    "from_columns": from_cols,
                    "to_columns": to_cols,
                    "role": role,
                    "source": "fk",
                    "confidence": "HIGH",
                    "reason": "DB FK 제약조건",
                    "relationship_type": "1:1" if (first["from_table"], fcol) in unique_pairs and len(from_cols) == 1 else "N:1",
                }
                if len(from_cols) > 1:
                    rel["reason"] = "DB FK 제약조건(복합키)"
                relationships.append(rel)
        finally:
            cur.close()
    if mode == "all":
        if table_columns is None:
            table_columns = db.get_all_tables_columns_with_types(
                allowed,
                project_info_id=int(project_info_id),
            )
        existing = {
            (r["from_table"], r["from_column"], r["to_table"], r["to_column"])
            for r in relationships
        }
        inferred = infer_relationships(allowed, table_columns, existing_keys=existing)
        relationships.extend(inferred)
    seen_pair = set()
    deduped = []
    for r in relationships:
        a, b = r["from_table"], r["to_table"]
        pair = (min(a, b), max(a, b))
        if pair in seen_pair:
            continue
        seen_pair.add(pair)
        deduped.append(r)
    return deduped


# 9.
def _compute_relationships_all_raw(conn, project_info_id: int):
    """FK+컬럼 추론 포함 전체 관계 목록 계산(캐시·세마포어 없음). project_info_id 필수."""
    current_allowed = set(db.get_merged_allowed_table_names_for_project(int(project_info_id)))
    table_columns = db.get_all_tables_columns_with_types(
        list(current_allowed),
        project_info_id=int(project_info_id),
    )
    return _fetch_relationships(conn, "all", table_columns, project_info_id=int(project_info_id))


# 9a.
def _compute_relationships_all(conn, project_info_id: int, backend_cfg=None):
    """
    전체 관계 계산. backend.query_studio_peak_guard 가 있으면 TTL 캐시·동시 계산 상한 적용. project_info_id 필수.
    """
    pid = int(project_info_id)
    rt = peak_guard.load_runtime(backend_cfg) if backend_cfg is not None else None
    if rt is None:
        return _compute_relationships_all_raw(conn, pid)
    sorted_names = sorted(db.get_merged_allowed_table_names_for_project(pid))
    cache_pid = pid
    cached = peak_guard.get_cached_relationships_full(
        cache_pid, sorted_names, rt.relationship_cache_ttl_seconds
    )
    if cached is not None:
        return cached

    def _once():
        again = peak_guard.get_cached_relationships_full(
            cache_pid, sorted_names, rt.relationship_cache_ttl_seconds
        )
        if again is not None:
            return again
        rels = _compute_relationships_all_raw(conn, pid)
        peak_guard.set_cached_relationships_full(
            cache_pid, sorted_names, rt.relationship_cache_ttl_seconds, rels
        )
        return rels

    try:
        return peak_guard.run_under_relationship_sem(rt.heavy_compute_concurrency, _once)
    except RuntimeError as e:
        if str(e) == "relationship_compute_sem_timeout":
            raise
        raise


def _peak_guard_429(retry_after: int, message: str):
    return JSONResponse(
        status_code=429,
        content={
            "error": "요청 한도 초과",
            "retry_after_seconds": retry_after,
            "message": message,
        },
        headers={"Retry-After": str(max(1, retry_after))},
    )


def _peak_guard_503_busy():
    return JSONResponse(
        status_code=503,
        content={
            "error": "서버 혼잡",
            "message": "관계 분석 처리가 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
        },
        headers={"Retry-After": "30"},
    )


# 9b.
def _resolve_project_table_db_type(
    project_info_id: int,
    table_name: str,
    *,
    for_widgetboard: bool = False,
) -> str:
    """쿼리 스튜디오·위젯보드 채널: main_db(table_master) 매핑에 있을 때만 main. dash 매핑은 사용하지 않는다."""
    t = db.validate_table_identifier(table_name)
    kw: dict = (
        {"usage_widgetboard": True}
        if for_widgetboard
        else {"usage_query_studio": True}
    )
    main_set = db.get_allowed_tables(
        project_info_id=int(project_info_id),
        db_type="main",
        **kw,
    )
    if t in main_set:
        return "main"
    raise ValueError("프로젝트에 매핑되지 않은 테이블입니다. (쿼리 스튜디오·위젯보드는 main DB 테이블만)")


def _qs_mapped_table_conn(
    project_info_id: int,
    table_name: str,
    *,
    for_widgetboard: bool,
    main_conn,
):
    """QS·위젯보드 list/describe/고유값: 항상 main_db 연결(main_conn, 닫지 않음)."""
    _resolve_project_table_db_type(
        int(project_info_id), table_name, for_widgetboard=for_widgetboard
    )
    return main_conn, db.get_table_schema(), False


# 10.
@router.get("/list-tables")
def list_tables(
    mapping_usage: str = Query(
        "query_studio",
        description="query_studio(쿼리 스튜디오 매핑) | widgetboard(위젯보드 매핑)",
    ),
    payload: dict = Depends(require_active_access),
    conn=Depends(get_db),
    sconn=Depends(get_system_db),
):
    try:
        mu = _assert_mapping_list_perm(mapping_usage, payload, sconn)
        project_info_id = payload.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")

        filt: dict = (
            {"usage_widgetboard": True}
            if mu == "widgetboard"
            else {"usage_query_studio": True}
        )
        allowed_rows_main = db.get_allowed_tables(
            project_info_id=int(project_info_id),
            db_type="main",
            include_meta=True,
            **filt,
        )
        allowed_map = {row["table_name"]: row for row in allowed_rows_main}
        allowed_names = sorted(allowed_map.keys())
        if not allowed_names:
            return {"tables": [], "count": 0}

        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        uid = payload.get("user_id")
        pid = int(project_info_id)
        user_labels = (
            _load_user_project_labels(int(uid), pid)
            if uid is not None
            else _empty_user_labels()
        )
        file_labels = _load_labels_file()
        tables = []
        for tname in allowed_names:
            size_pretty = None
            size_bytes = None
            try:
                # regclass 문자열(schema.name)은 예약어·대소문자 식별자에서 자주 실패한다.
                # pg_class OID로 조회하면 메타와 동일하게 맞춘다.
                cur.execute(
                    """
                    SELECT pg_total_relation_size(c.oid) AS size_bytes,
                           pg_size_pretty(pg_total_relation_size(c.oid)) AS size
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = %s AND c.relname = %s
                      AND c.relkind IN ('r', 'p', 'm', 'f')
                    LIMIT 1
                    """,
                    (schema, tname),
                )
                size_row = cur.fetchone() or {}
                size_pretty = size_row.get("size")
                raw_bytes = size_row.get("size_bytes")
                if raw_bytes is not None:
                    size_bytes = int(raw_bytes)
            except Exception:
                size_pretty = None
                size_bytes = None
            row_meta = allowed_map.get(tname) or {}
            cp_raw = row_meta.get("column_profiles")
            if isinstance(cp_raw, str):
                try:
                    cp_dict = json.loads(cp_raw)
                except json.JSONDecodeError:
                    cp_dict = None
            elif isinstance(cp_raw, dict):
                cp_dict = cp_raw
            else:
                cp_dict = None
            tables.append({
                "table_name": tname,
                "table_master_id": row_meta.get("table_master_id"),
                "role_summary": summarize_semantic_roles(cp_dict),
                "size": size_pretty,
                "size_bytes": size_bytes,
                "table_label": _resolve_table_display_label(tname, user_labels, file_labels, row_meta),
                "table_dscrtn": row_meta.get("table_dscrtn"),
            })
        cur.close()
        return {"tables": tables, "count": len(tables)}
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=503, content={"error": str(e), "message": "DB 설정 없음"})
    except psycopg2.OperationalError as e:
        return JSONResponse(status_code=503, content={"error": str(e), "message": "DB 연결 실패(네트워크/접속정보 확인)"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 목록 조회 실패"})


# 11.
@router.post("/describe-table")
def describe_table(
    body: DescribeTableRequest,
    payload: dict = Depends(require_active_access),
    sconn=Depends(get_system_db),
    conn=Depends(get_db),
):
    conn_target = None
    cur = None
    should_close_conn_target = False
    try:
        mu = _assert_mapping_list_perm(body.mapping_usage, payload, sconn)
        for_wb = mu == "widgetboard"
        pid = payload.get("project_info_id")
        if pid is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        table_name = db.validate_table_identifier(body.table_name)
        uid = payload.get("user_id")
        user_labels = (
            _load_user_project_labels(int(uid), int(pid))
            if uid is not None and pid is not None
            else _empty_user_labels()
        )
        file_labels = _load_labels_file()
        conn_target, schema, should_close_conn_target = _qs_mapped_table_conn(
            int(pid), table_name, for_widgetboard=for_wb, main_conn=conn
        )
        if not db._table_exists(conn_target, schema, table_name):
            raise ValueError(f"테이블을 찾을 수 없습니다: {table_name}")
        cur = conn_target.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name),
        )
        columns = []
        for row in cur.fetchall():
            col_name = row["column_name"]
            col_type = row["data_type"]
            if row["character_maximum_length"]:
                col_type += f"({row['character_maximum_length']})"
            col_comment = _get_pg_column_comment(cur, schema, table_name, col_name)
            mrow = (
                {"logical_key": str(col_comment).strip()}
                if col_comment and str(col_comment).strip()
                else None
            )
            columns.append({
                "name": col_name,
                "type": col_type,
                "nullable": row["is_nullable"] == "YES",
                "default": row["column_default"],
                "label": _resolve_column_display_label(
                    table_name, col_name, user_labels, file_labels, meta_row=mrow if mrow else None
                ),
                "logical_key": (mrow.get("logical_key") if mrow else None),
                "source_table": None,
                "source_column": None,
            })
        return {"table_name": table_name, "columns": columns, "count": len(columns)}
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 구조 조회 실패"})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if should_close_conn_target and conn_target is not None:
            try:
                conn_target.close()
            except Exception:
                pass


# 12.
@router.get("/column-labels")
def get_column_labels(
    table_name: str = Query(..., description="테이블명"),
    _perm: dict = Depends(require_query_read_perm),
):
    """테이블별 컬럼 라벨·테이블 라벨 조회(유저 저장 ∪ 파일, 표시용 table_label은 병합 해석)."""
    try:
        table_name = db.validate_table_identifier(table_name)
        uid = _perm.get("user_id")
        pid = _perm.get("project_info_id")
        user_labels = (
            _load_user_project_labels(int(uid), int(pid))
            if uid is not None and pid is not None
            else _empty_user_labels()
        )
        file_labels = _load_labels_file()
        user_cols = (user_labels.get("column_labels") or {}).get(table_name, {})
        file_cols = (file_labels.get("column_labels") or {}).get(table_name, {})
        labels_merged = {**file_cols, **user_cols}
        table_label = _resolve_table_display_label(table_name, user_labels, file_labels, {})
        return {"table_name": table_name, "table_label": table_label, "labels": labels_merged}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


# 13.
@router.post("/column-labels")
def save_column_labels(
    body: ColumnLabelsRequest,
    _perm: dict = Depends(require_query_read_perm),
):
    """테이블·컬럼 라벨을 계정·프로젝트별 JSON(system DB)에 저장. 미입력 시 파일·기본값이 표시에 사용됨."""
    try:
        table_name = db.validate_table_identifier(body.table_name)
        user_id = int(_perm["user_id"])
        project_info_id = int(_perm["project_info_id"])
        data = _load_user_project_labels(user_id, project_info_id)
        if "table_labels" not in data or data["table_labels"] is None:
            data["table_labels"] = {}
        if "column_labels" not in data or data["column_labels"] is None:
            data["column_labels"] = {}
        if body.table_label is not None:
            data["table_labels"][table_name] = (body.table_label or "").strip() or table_name
        if table_name not in data["column_labels"]:
            data["column_labels"][table_name] = {}
        for col_name, label in (body.labels or {}).items():
            if not col_name or not isinstance(col_name, str):
                continue
            if not re.match(r"^[a-zA-Z0-9_]+$", col_name):
                continue
            data["column_labels"][table_name][col_name] = (label or "").strip() or col_name
        _persist_user_project_labels(user_id, project_info_id, data)
        ncols = len((data.get("column_labels") or {}).get(table_name, {}))
        emit_query_studio_log(
            user_id,
            business_action="labels_save",
            action_kind="UPDATE",
            table_name=table_name[:63] if table_name else None,
            detail_json={
                "project_info_id": project_info_id,
                "x_column_label_count": ncols,
                "x_table_label_updated": body.table_label is not None,
            },
        )
        file_labels = _load_labels_file()
        return {
            "table_name": table_name,
            "table_label": _resolve_table_display_label(table_name, data, file_labels, {}),
            "labels": dict((data.get("column_labels") or {}).get(table_name, {})),
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "컬럼 라벨 저장 실패"})


# 14.
@router.get("/table-relationships")
def table_relationships(
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
    mode: str = Query("fk", description="fk=FK만, all=FK+_id추론+컬럼코멘트 힌트"),
):
    """개선된 관계 분석. mode=all은 peak_guard(설정 시)로 분당 한도·동시 계산·TTL 캐시 적용."""
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        pid = int(project_info_id)
        mode = (mode or "fk").strip().lower()
        if mode == "all":
            rt = peak_guard.load_runtime(cfg)
            if rt:
                ok, retry = peak_guard.check_heavy_rate_limit(_perm.get("user_id"), rt)
                if not ok:
                    return _peak_guard_429(retry, "관계 분석(mode=all) 요청이 너무 잦습니다.")
            try:
                rels = _compute_relationships_all(conn, project_info_id=pid, backend_cfg=cfg)
            except RuntimeError as e:
                if str(e) == "relationship_compute_sem_timeout":
                    return _peak_guard_503_busy()
                raise
            return {"relationships": rels, "count": len(rels)}
        rels = _fetch_relationships(conn, mode, project_info_id=pid)
        return {"relationships": rels, "count": len(rels)}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "JOIN 관계 조회 실패"})


# 15.
@router.post("/join-order")
def api_join_order(
    body: JoinOrderRequest,
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
):
    """
    JOIN 자동 생성 명세: base_table 기준 required_tables의 JOIN 순서 + 엣지 정보.
    반환: join_order (각 단계 table, from_table, from_column, to_table, to_column), warnings, errors
    """
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        pid = int(project_info_id)
        base_table = (body.base_table or "").strip()
        required_tables = [t.strip() for t in (body.required_tables or []) if t and t.strip()]
        if not base_table:
            return JSONResponse(status_code=400, content={"error": "base_table 필요", "join_order": [], "warnings": [], "errors": ["base_table이 비어 있습니다."]})
        allowed = db.get_merged_allowed_table_names_for_project(pid)
        if base_table not in allowed:
            return JSONResponse(status_code=400, content={"error": "base_table이 허용 목록에 없음", "join_order": [], "warnings": [], "errors": [f"테이블 '{base_table}'이 현재 프로젝트에 매핑된 테이블에 없습니다."]})
        for t in required_tables:
            if t not in allowed:
                return JSONResponse(status_code=400, content={"error": "required_tables에 없는 테이블 있음", "join_order": [], "warnings": [], "errors": [f"테이블 '{t}'이 현재 프로젝트에 매핑된 테이블에 없습니다."]})
        rt = peak_guard.load_runtime(cfg)
        if rt:
            ok, retry = peak_guard.check_heavy_rate_limit(_perm.get("user_id"), rt)
            if not ok:
                return _peak_guard_429(retry, "JOIN 순서 분석 요청이 너무 잦습니다.")
        try:
            fk_list = _compute_relationships_all(conn, project_info_id=pid, backend_cfg=cfg)
        except RuntimeError as e:
            if str(e) == "relationship_compute_sem_timeout":
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "서버 혼잡",
                        "join_order": [],
                        "warnings": [],
                        "errors": ["관계 분석 처리가 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."],
                    },
                    headers={"Retry-After": "30"},
                )
            raise
        join_order = determine_join_order(base_table, required_tables, fk_list)
        validation = validate_join_order(join_order, max_depth=4)
        filter_tables = set((body.filter_tables or []) if getattr(body, "filter_tables", None) else [])
        # JOIN 타입 자동 제안: 필터 걸린 테이블 또는 1:1 관계 → INNER, 그 외 LEFT (문서 5.2)
        for step in join_order:
            ft, tt = step.get("from_table"), step.get("to_table")
            if not ft or not tt:
                step["suggested_join_type"] = "LEFT"
                continue
            rel = next((r for r in fk_list if r.get("from_table") == ft and r.get("to_table") == tt), None)
            is_1_1 = rel and rel.get("relationship_type") == "1:1"
            step["suggested_join_type"] = "INNER" if (tt in filter_tables) or is_1_1 else "LEFT"
        # Base 테이블 점수화: required 내 직접 연결 수로 대안 제안 (문서 5.2)
        required_set = set(required_tables)
        base_scores = []
        for t in required_set:
            direct = 0
            for r in fk_list:
                a, b = r.get("from_table"), r.get("to_table")
                if a == t and b in required_set and b != t:
                    direct += 1
                if b == t and a in required_set and a != t:
                    direct += 1
            base_scores.append({"table": t, "direct_connections": direct})
        base_scores.sort(key=lambda x: -x["direct_connections"])
        base_alternatives = base_scores[:5]
        accuracy = join_accuracy_score(join_order, fk_list)
        return {
            "join_order": join_order,
            "base_alternatives": base_alternatives,
            "warnings": validation.get("warnings", []),
            "errors": validation.get("errors", []),
            "valid": validation.get("valid", True),
            "join_accuracy": accuracy,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "JOIN 순서 계산 실패", "join_order": [], "warnings": [], "errors": [str(e)]})


REPORT_SAVED_TABLE_PREFIX = "test_report_"

# ---------- 큐 테이블 기반 저장 (report_save_queue) ----------
REPORT_SAVE_QUEUE_TABLE = "report_save_queue"
_worker_poll_interval = 3
_save_table_worker_last_conn_err_log = 0.0
_save_table_worker_conn_err_interval_sec = 60
_save_table_worker_conn_err_sleep_sec = 10

def _ordered_table_physical_columns(cur, table_schema: str, table_name: str) -> list[str]:
    """CREATE TABLE AS 직후 attnum 순서의 물리 컬럼명(코멘트 대상·ordinal 정렬)."""
    cur.execute(
        """
        SELECT a.attname::text
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = %s AND c.relname = %s
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """,
        (table_schema, table_name),
    )
    rows = cur.fetchall()
    out: list[str] = []
    for r in rows:
        if isinstance(r, dict):
            v = r.get("attname")
        else:
            v = r[0]
        if v is not None and str(v).strip():
            out.append(str(v).strip())
    return out


def _get_pg_column_comment(cur, table_schema: str, table_name: str, column_name: str) -> str | None:
    """pg_catalog 기준 컬럼 코멘트. 없으면 None."""
    cur.execute(
        """
        SELECT pg_catalog.col_description(a.attrelid, a.attnum) AS col_description
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = %s AND c.relname = %s AND a.attname = %s
          AND a.attnum > 0 AND NOT a.attisdropped
        """,
        (table_schema, table_name, column_name),
    )
    r = cur.fetchone()
    if not r:
        return None
    if isinstance(r, dict):
        v = r.get("col_description")
    else:
        v = r[0]
    return v if v is None else str(v)


def _count_nonempty_pg_column_comments(cur, table_schema: str, table_name: str) -> int:
    """테이블의 비어있지 않은 컬럼 COMMENT 개수."""
    cur.execute(
        """
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN d IS NOT NULL AND LENGTH(TRIM(d)) > 0 THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS n
        FROM (
          SELECT pg_catalog.col_description(a.attrelid, a.attnum) AS d
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
          JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
          WHERE n.nspname = %s AND c.relname = %s
            AND a.attnum > 0 AND NOT a.attisdropped
        ) t
        """,
        (table_schema, table_name),
    )
    r = cur.fetchone()
    if not r:
        return 0
    if isinstance(r, dict):
        v = r.get("n")
    else:
        v = r[0]
    try:
        return int(v or 0)
    except Exception:
        return 0


def _apply_one_saved_column_pg_comment_detailed(
    cur,
    table_schema: str,
    table_name: str,
    entry,
    actual_column_at_index: str | None = None,
) -> dict:
    """
    저장 컬럼에 원본 논리명(테이블_컬럼)을 COMMENT로 남김.
    physical_name(힌트)이 CTAS 실제 컬럼과 다를 수 있으므로(프론트 네이밍·빌드 혼용),
    실패 시 `actual_column_at_index`(CREATE 직후 ordinal 위치의 실제 컬럼명)로 1회 재시도.

    status:
      - applied: COMMENT 실행함 (resolved_physical에 실제 붙인 컬럼명)
      - skipped_existing: 이미 코멘트가 있어 유지
      - invalid_not_dict / invalid_no_physical_name / invalid_no_comment_text: 힌트 형식 오류
      - failed_execute: 힌트/폴백 모두 실패
    """
    if not isinstance(entry, dict):
        return {"status": "invalid_not_dict", "physical_name": None, "error": None}
    phys = (entry.get("physical_name") or "").strip()
    if not phys and not (actual_column_at_index or "").strip():
        return {"status": "invalid_no_physical_name", "physical_name": None, "error": None}
    lk = (entry.get("logical_key") or "").strip()
    st = entry.get("source_table")
    sc = entry.get("source_column")
    st = str(st).strip() if st is not None and str(st).strip() else ""
    sc = str(sc).strip() if sc is not None and str(sc).strip() else ""
    comment_text = lk if lk else (f"{st}_{sc}" if st and sc else "")
    if not comment_text:
        p0 = phys or (actual_column_at_index or "").strip()
        return {"status": "invalid_no_comment_text", "physical_name": p0, "error": None}

    def _try_comment(target: str) -> dict | None:
        if not target or not str(target).strip():
            return None
        t = str(target).strip()
        ex = _get_pg_column_comment(cur, table_schema, table_name, t)
        if ex is not None and str(ex).strip():
            return {"status": "skipped_existing", "physical_name": phys, "error": None, "resolved_physical": t}
        stmt = pg_sql.SQL("COMMENT ON COLUMN {}.{}.{} IS %s").format(
            pg_sql.Identifier(table_schema),
            pg_sql.Identifier(table_name),
            pg_sql.Identifier(t),
        )
        try:
            cur.execute(stmt, (comment_text,))
        except Exception as e:
            return {
                "status": "failed_execute",
                "physical_name": phys,
                "error": str(e).strip(),
                "resolved_physical": t,
            }
        return {"status": "applied", "physical_name": phys, "error": None, "resolved_physical": t}

    cands: list[str] = []
    if phys:
        cands.append(phys)
    act = (actual_column_at_index or "").strip()
    if act and act not in cands:
        cands.append(act)

    last_err = None
    for target in cands:
        r = _try_comment(target)
        if r is None:
            continue
        if r.get("status") == "failed_execute":
            last_err = r
            continue
        return r
    if last_err:
        return last_err
    return {
        "status": "failed_execute",
        "physical_name": phys,
        "error": "no_applicable_column_for_comment",
    }


def _format_comment_failure_message(comment_rows: list) -> str:
    """column_comment_hints 적용 실패 시 큐 error 컬럼용 요약 문자열."""
    parts = []
    for r in comment_rows:
        if not isinstance(r, dict):
            continue
        if r.get("status") in ("applied", "skipped_existing"):
            continue
        phys = r.get("physical_name") or "(알 수 없음)"
        st = r.get("status") or ""
        err = (r.get("error") or "").strip()
        if st == "failed_execute" and err:
            parts.append(f"{phys}: {err.splitlines()[0][:400]}")
        elif st == "invalid_not_dict":
            parts.append("(항목이 객체가 아님)")
        elif st == "invalid_no_physical_name":
            parts.append("(physical_name 없음)")
        elif st == "invalid_no_comment_text":
            parts.append(f"{phys}: logical_key·출처 컬럼으로 코멘트 문자열을 만들 수 없음")
        else:
            parts.append(f"{phys}: {st}")
    summary = "; ".join(parts[:20])
    if len(parts) > 20:
        summary += f" … 외 {len(parts) - 20}건"
    return summary[:7900]


def _drop_orphan_saved_physical_table_if_any(table_schema: str, table_name: str) -> None:
    """
    CREATE TABLE ... AS 직후 main_db 쪽 commit은 돌이킬 수 없다. 그 뒤 단계(매핑·큐 갱신 등)가
    예외로 끊기면 큐는 failed인데 물리 테이블만 남아, 재시도 시 already exists가 난다. 고아만 DROP.
    (큐 행이 최종 반영·커밋되기 전에만 호출. completed/failed(코멘트) 확정 뒤에는 호출하지 않는다.)
    """
    try:
        conn = db.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                pg_sql.SQL("DROP TABLE IF EXISTS {}.{}").format(
                    pg_sql.Identifier(table_schema),
                    pg_sql.Identifier(table_name),
                )
            )
            conn.commit()
        finally:
            cur.close()
            conn.close()
    except Exception as ex:
        logging.getLogger(__name__).warning(
            "saved_table_orphan_drop_failed schema=%s table=%s: %s",
            table_schema,
            table_name,
            str(ex)[:300],
        )


def _format_save_table_ctas_error_for_queue(err: Exception) -> str:
    """큐 error 컬럼용: 중복 테이블명(42P07)은 덮어쓰지 않는다는 안내를 붙인다."""
    raw = str(err).strip()
    c = getattr(err, "pgcode", None)
    if c == "42P07" or "already exists" in raw.lower():
        return (
            "같은 이름의 테이블이 이미 있어 저장할 수 없습니다(기존 데이터/테이블을 덮어쓰지 않습니다). "
            "다른 저장 이름을 쓰거나, 기존 테이블을 직접 정리(DROP)한 뒤 다시 시도하세요.\n"
            + raw
        )
    if c == "57014" or "statement timeout" in raw.lower():
        return (
            raw
            + "\n\n[안내] DB 세션 statement_timeout(테이블 저장 CTAS)은 "
            "Env/config/config.json 의 backend.save_table_ctas_timeout_seconds 입니다. "
            "0 또는 생략 시 제한 없음(다음 큐 작업부터 config 파일을 다시 읽습니다). API 서버 재시작을 권장합니다."
        )
    return raw


def _read_save_table_ctas_timeout_seconds() -> int:
    """
    CTAS 1건마다 config.json을 다시 읽음(Import 시점의 Env.config 와 달리 파일 최신값 반영).
    save_table_ctas_timeout_seconds: 초 단위. 0·미설정·음수 → 0(SET statement_timeout 0, PostgreSQL 제한 없음).
    """
    try:
        from Env.config import loader

        cfg = loader.load_config()
        v = getattr(cfg.backend, "save_table_ctas_timeout_seconds", None)
        if v is None:
            return 0
        n = int(v)
        return n if n > 0 else 0
    except Exception:
        return 0


# 16.
def _upsert_table_master_and_mapping(
    project_info_id: int,
    db_type: str,
    table_name: str,
    create_user_id: int | None = None,
    table_label: str | None = None,
    table_dscrtn: str | None = None,
) -> None:
    """전사 table_master upsert 후 table_project_mapping 연결. QS 경로이므로 use_query_studio_yn=Y 고정."""
    conn = db.get_db_connection_system_core()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        dt = str(db_type or "main").strip().lower()
        if dt not in ("main", "dash"):
            dt = "main"

        def _t(v: str | None) -> str | None:
            if v is None:
                return None
            s = str(v).strip()
            return s if s else None

        tl = _t(table_label)
        td = _t(table_dscrtn)
        aid = int(create_user_id or 0)
        pid = int(project_info_id)
        insert_tm_sql = """
            INSERT INTO table_master (
                db_type, table_name, create_dtm, update_dtm, create_user_id,
                table_label, table_dscrtn
            )
            VALUES (%s, %s, NOW(), NOW(), %s, %s, %s)
            ON CONFLICT (db_type, table_name)
            DO UPDATE SET
                update_dtm = NOW(),
                table_label = CASE
                    WHEN EXCLUDED.table_label IS NOT NULL AND BTRIM(EXCLUDED.table_label) <> ''
                    THEN EXCLUDED.table_label
                    ELSE table_master.table_label
                END,
                table_dscrtn = CASE
                    WHEN EXCLUDED.table_dscrtn IS NOT NULL AND BTRIM(EXCLUDED.table_dscrtn::text) <> ''
                    THEN EXCLUDED.table_dscrtn
                    ELSE table_master.table_dscrtn
                END
            RETURNING table_master_id
            """
        cur.execute(
            "SELECT table_master_id FROM table_master WHERE db_type = %s AND table_name = %s",
            (dt, table_name),
        )
        ex_tm = cur.fetchone()
        params_tm = (dt, table_name, create_user_id, tl, td)
        if ex_tm is not None:
            tmid_ex = int(ex_tm["table_master_id"])
            if aid > 0:
                with track_update(
                    conn,
                    "table_master",
                    "table_master_id",
                    tmid_ex,
                    actor_user_id=aid,
                    project_info_id=pid,
                    channel="query_studio",
                ):
                    cur.execute(insert_tm_sql, params_tm)
            else:
                cur.execute(insert_tm_sql, params_tm)
            row = cur.fetchone()
            table_master_id = int(row["table_master_id"])
        else:
            cur.execute(insert_tm_sql, params_tm)
            row = cur.fetchone()
            table_master_id = int(row["table_master_id"])
            if aid > 0:
                track_insert(
                    conn,
                    "table_master",
                    "table_master_id",
                    table_master_id,
                    actor_user_id=aid,
                    project_info_id=pid,
                    channel="query_studio",
                )
        cur.execute(
            "SELECT feature_flags FROM project_info WHERE project_info_id = %s",
            (pid,),
        )
        ff_row = cur.fetchone()
        ff_raw = ff_row.get("feature_flags") if ff_row else None
        if isinstance(ff_raw, str):
            try:
                ff = json.loads(ff_raw)
            except json.JSONDecodeError:
                ff = {}
        elif isinstance(ff_raw, dict):
            ff = ff_raw
        else:
            ff = {}
        q_on = bool(ff.get("query", True))
        w_on = bool(ff.get("widget", True))
        wb_auto = q_on and w_on
        wb_yn = "Y" if wb_auto else "N"
        insert_map_sql = """
            INSERT INTO table_project_mapping (
                project_info_id, table_master_id, create_dtm,
                use_query_studio_yn, use_widgetboard_yn
            ) VALUES (%s, %s, NOW(), 'Y', %s)
            ON CONFLICT (project_info_id, table_master_id) DO UPDATE SET
                use_query_studio_yn = 'Y',
                use_widgetboard_yn = CASE
                    WHEN %s THEN 'Y'
                    ELSE table_project_mapping.use_widgetboard_yn
                END
            """
        cur.execute(
            "SELECT 1 FROM table_project_mapping WHERE project_info_id = %s AND table_master_id = %s",
            (pid, table_master_id),
        )
        has_map = cur.fetchone() is not None
        pkv = f"{pid}:{table_master_id}"
        params_map = (pid, table_master_id, wb_yn, wb_auto)
        if has_map:
            if aid > 0:
                with track_update(
                    conn,
                    "table_project_mapping",
                    "project_info_id",
                    pkv,
                    actor_user_id=aid,
                    project_info_id=pid,
                    channel="query_studio",
                ):
                    cur.execute(insert_map_sql, params_map)
            else:
                cur.execute(insert_map_sql, params_map)
        else:
            cur.execute(insert_map_sql, params_map)
            if aid > 0:
                track_insert(
                    conn,
                    "table_project_mapping",
                    "project_info_id",
                    pkv,
                    actor_user_id=aid,
                    project_info_id=pid,
                    channel="query_studio",
                )
        conn.commit()
        sys_prof_conn = None
        data_prof_conn = None
        try:
            profile_schema = db.get_table_schema() if dt == "main" else db.get_dash_table_schema()
            sys_prof_conn = db.get_db_connection_system_core()
            data_prof_conn = (
                db.get_db_connection() if dt == "main" else db.get_db_connection_dash()
            )
            ensure_profile(
                sys_prof_conn,
                data_prof_conn,
                table_master_id,
                profile_schema,
                table_name,
                force=True,
            )
        except Exception as e:
            logger.warning(
                "프로파일링 실패 (table_master_id=%s): %s",
                table_master_id,
                e,
                exc_info=True,
            )
        finally:
            if data_prof_conn is not None:
                try:
                    data_prof_conn.close()
                except Exception:
                    pass
            if sys_prof_conn is not None:
                try:
                    sys_prof_conn.close()
                except Exception:
                    pass
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# 17.
def _ensure_queue_table(conn):
    """큐 테이블이 없으면 생성 (allowed_tables와 무관, 내부용)."""
    schema = db.get_table_schema()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            pg_sql.SQL("""
                CREATE TABLE IF NOT EXISTS {schema_table} (
                    id UUID PRIMARY KEY,
                    table_name VARCHAR(255) NOT NULL,
                    project_info_id INT4 NOT NULL,
                    query TEXT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'queued',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    error TEXT,
                    result_table_name VARCHAR(255)
                )
            """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
        )
        cur.execute(
            pg_sql.SQL(
                "ALTER TABLE {schema_table} "
                "ADD COLUMN IF NOT EXISTS project_info_id INT4"
            ).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
        )
        cur.execute(
            pg_sql.SQL(
                "ALTER TABLE {schema_table} "
                "ADD COLUMN IF NOT EXISTS create_user_id INT4"
            ).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
        )
        cur.execute(
            pg_sql.SQL(
                "ALTER TABLE {schema_table} "
                "ADD COLUMN IF NOT EXISTS column_comment_hints JSONB"
            ).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
        )
        cur.execute(
            pg_sql.SQL(
                "ALTER TABLE {schema_table} "
                "ADD COLUMN IF NOT EXISTS column_comment_result JSONB"
            ).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
        )
        conn.commit()
    finally:
        cur.close()


# 18.
def _save_table_worker():
    """큐 테이블에서 status='queued'인 행을 확인해 하나씩 CREATE TABLE 실행."""
    global _save_table_worker_last_conn_err_log
    while True:
        conn_sel = None
        conn_create = None
        try:
            conn_sel = db.get_db_connection()
            _ensure_queue_table(conn_sel)
            schema = db.get_table_schema()
            cur = conn_sel.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                pg_sql.SQL("""
                    SELECT id, table_name, query, project_info_id, create_user_id, column_comment_hints
                    FROM {schema_table}
                    WHERE status = 'queued'
                    ORDER BY created_at
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE))
            )
            row = cur.fetchone()
            cur.close()
            if not row:
                conn_sel.close()
                time.sleep(_worker_poll_interval)
                continue
            job_id = str(row["id"])
            table_name = row["table_name"]
            query = row["query"]
            project_info_id = int(row["project_info_id"])
            hints_raw = row.get("column_comment_hints")
            cm_list = hints_raw
            if isinstance(cm_list, str):
                try:
                    cm_list = json.loads(cm_list)
                except json.JSONDecodeError:
                    cm_list = None
            save_create_uid = row.get("create_user_id")
            save_create_uid = int(save_create_uid) if save_create_uid is not None else None
            cur = conn_sel.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                pg_sql.SQL(
                    "UPDATE {schema_table} SET status = 'running', started_at = NOW() "
                    "WHERE id = %s AND status = 'queued'"
                ).format(
                    schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)
                ),
                (job_id,),
            )
            if cur.rowcount == 0:
                conn_sel.commit()
                cur.close()
                conn_sel.close()
                conn_sel = None
                continue
            conn_sel.commit()
            cur.close()
            conn_sel.close()
            conn_sel = None

            # CTAS(테이블 저장): 매 작업 config.json 다시 읽기 + 기본 0(무제한). 풀 연결이 이전 10s 세션을 쓸 수 있어 SET 필수
            timeout_sec = _read_save_table_ctas_timeout_seconds()
            conn_create = db.get_db_connection()
            cur_create = conn_create.cursor(cursor_factory=RealDictCursor)
            ctas_committed = False
            job_queue_finalized = False
            try:
                if timeout_sec <= 0:
                    cur_create.execute("SET statement_timeout = 0")
                else:
                    cur_create.execute(f"SET statement_timeout = '{timeout_sec}s'")
                logging.getLogger(__name__).info(
                    "saved_table_ctas statement_timeout_sec=%s job_id=%s table=%s",
                    "unlimited" if timeout_sec <= 0 else str(timeout_sec),
                    job_id,
                    table_name,
                )
                cur_create.execute(
                    pg_sql.SQL("CREATE TABLE {} AS ({})").format(
                        pg_sql.Identifier(schema, table_name), pg_sql.SQL(query)
                    )
                )
                conn_create.commit()
                ctas_committed = True
                comment_rows: list = []
                actual_cols: list[str] = []
                expected_comment_targets = 0
                if isinstance(cm_list, list) and len(cm_list) > 0:
                    # autocommit 은 트랜잭션 밖에서만 set_session 으로 바꿀 수 있음.
                    # _ordered_table_physical_columns 가 SELECT 로 암시적 BEGIN 을 열면 그 다음 autocommit=True 가 실패한다.
                    prev_ac = getattr(conn_create, "autocommit", False)
                    conn_create.autocommit = True
                    try:
                        actual_cols = _ordered_table_physical_columns(cur_create, schema, table_name)
                        for idx, ent in enumerate(cm_list):
                            at_ord = (
                                actual_cols[idx]
                                if idx < len(actual_cols)
                                else None
                            )
                            row = _apply_one_saved_column_pg_comment_detailed(
                                cur_create, schema, table_name, ent, at_ord
                            )
                            comment_rows.append(row)
                            if row.get("status") not in ("invalid_no_comment_text", "invalid_not_dict"):
                                expected_comment_targets += 1
                            if row.get("status") == "failed_execute":
                                logging.getLogger(__name__).warning(
                                    "saved_table_column_comment_skip table=%s col=%s: %s",
                                    table_name,
                                    row.get("physical_name"),
                                    (row.get("error") or "")[:200],
                                )
                        # 1차 적용 후 실제 COMMENT 수가 기대치보다 적으면 ordinal 기준으로 한 번 더 재적용.
                        # 프론트/백엔드 배포 시점이 엇갈려 physical_name이 달라진 경우를 복구한다.
                        applied_now = _count_nonempty_pg_column_comments(cur_create, schema, table_name)
                        expected_min = min(expected_comment_targets, len(actual_cols))
                        if expected_min > 0 and applied_now < expected_min:
                            logging.getLogger(__name__).warning(
                                "saved_table_column_comment_reconcile table=%s have=%s expected_at_least=%s",
                                table_name,
                                applied_now,
                                expected_min,
                            )
                            for idx, ent in enumerate(cm_list):
                                at_ord = actual_cols[idx] if idx < len(actual_cols) else None
                                if not at_ord:
                                    continue
                                ent2 = dict(ent) if isinstance(ent, dict) else {}
                                if not (ent2.get("physical_name") or "").strip():
                                    ent2["physical_name"] = at_ord
                                row2 = _apply_one_saved_column_pg_comment_detailed(
                                    cur_create, schema, table_name, ent2, at_ord
                                )
                                if row2.get("status") == "failed_execute":
                                    logging.getLogger(__name__).warning(
                                        "saved_table_column_comment_reconcile_skip table=%s col=%s: %s",
                                        table_name,
                                        row2.get("physical_name"),
                                        (row2.get("error") or "")[:200],
                                    )
                                comment_rows.append(row2)
                    finally:
                        conn_create.autocommit = prev_ac

                comment_result_payload = None
                comment_apply_ok = True
                if isinstance(cm_list, list) and len(cm_list) > 0:
                    final_with_comments = _count_nonempty_pg_column_comments(cur_create, schema, table_name)
                    comment_result_payload = {"hint_count": len(cm_list), "results": comment_rows}
                    comment_apply_ok = all(
                        r.get("status") in ("applied", "skipped_existing") for r in comment_rows
                    ) and final_with_comments >= min(expected_comment_targets, len(actual_cols))

                cur_create.close()
                conn_create.close()
                conn_create = None
                # table_master + table_project_mapping: CREATE 직후 system_db 일시 오류 대비 짧은 재시도
                last_map_err: Exception | None = None
                for attempt in range(3):
                    try:
                        _upsert_table_master_and_mapping(
                            project_info_id=project_info_id,
                            db_type="main",
                            table_name=table_name,
                            create_user_id=save_create_uid,
                        )
                        last_map_err = None
                        break
                    except Exception as _map_e:
                        last_map_err = _map_e
                        if attempt < 2:
                            time.sleep(0.35 * (attempt + 1))
                if last_map_err is not None:
                    raise last_map_err

                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor(cursor_factory=RealDictCursor)
                try:
                    if not comment_apply_ok:
                        err_body = (
                            "테이블은 생성되었으나 컬럼 코멘트 적용에 실패했습니다. "
                            + _format_comment_failure_message(comment_rows)
                        )
                        cur_up.execute(
                            pg_sql.SQL("""
                                UPDATE {schema_table}
                                SET status = 'failed', completed_at = NOW(), error = %s,
                                    result_table_name = %s, column_comment_result = %s
                                WHERE id = %s
                            """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                            (
                                err_body,
                                table_name,
                                Json(comment_result_payload),
                                job_id,
                            ),
                        )
                        conn_up.commit()
                        job_queue_finalized = True
                        emit_query_studio_log(
                            save_create_uid,
                            business_action="saved_table_create_comment_failed",
                            action_kind="CREATE",
                            table_name=str(table_name)[:63] if table_name else None,
                            sql_fingerprint=compute_sql_fingerprint_hex(str(query or "")),
                            detail_json={
                                "job_id": job_id,
                                "project_info_id": project_info_id,
                                "column_comment_hint_rows": len(cm_list) if isinstance(cm_list, list) else 0,
                                "comment_apply_ok": False,
                                "column_comment_result": comment_result_payload,
                            },
                            risk_tier="MED",
                        )
                    else:
                        cur_up.execute(
                            pg_sql.SQL("""
                                UPDATE {schema_table}
                                SET status = 'completed', completed_at = NOW(),
                                    result_table_name = %s,
                                    column_comment_result = %s
                                WHERE id = %s
                            """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                            (
                                table_name,
                                Json(comment_result_payload) if comment_result_payload else None,
                                job_id,
                            ),
                        )
                        conn_up.commit()
                        job_queue_finalized = True
                        emit_query_studio_log(
                            save_create_uid,
                            business_action="saved_table_create",
                            action_kind="CREATE",
                            table_name=str(table_name)[:63] if table_name else None,
                            sql_fingerprint=compute_sql_fingerprint_hex(str(query or "")),
                            detail_json={
                                "job_id": job_id,
                                "project_info_id": project_info_id,
                                "column_comment_hint_rows": (
                                    len(cm_list) if isinstance(cm_list, list) else 0
                                ),
                                "comment_apply_ok": True,
                                "column_comment_result": comment_result_payload,
                            },
                            risk_tier="MED",
                        )
                finally:
                    cur_up.close()
                    conn_up.close()
            except psycopg2.Error as e:
                if ctas_committed and not job_queue_finalized:
                    _drop_orphan_saved_physical_table_if_any(schema, table_name)
                if conn_create:
                    try:
                        conn_create.rollback()
                        conn_create.close()
                    except Exception:
                        pass
                    conn_create = None
                err_q = _format_save_table_ctas_error_for_queue(e)
                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor(cursor_factory=RealDictCursor)
                cur_up.execute(
                    pg_sql.SQL("""
                        UPDATE {schema_table}
                        SET status = 'failed', completed_at = NOW(), error = %s
                        WHERE id = %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (err_q, job_id),
                )
                conn_up.commit()
                cur_up.close()
                conn_up.close()
            except Exception as e:
                if ctas_committed and not job_queue_finalized:
                    _drop_orphan_saved_physical_table_if_any(schema, table_name)
                traceback.print_exc()
                if conn_create:
                    try:
                        conn_create.close()
                    except Exception:
                        pass
                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor(cursor_factory=RealDictCursor)
                cur_up.execute(
                    pg_sql.SQL("""
                        UPDATE {schema_table}
                        SET status = 'failed', completed_at = NOW(), error = %s
                        WHERE id = %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (str(e), job_id),
                )
                conn_up.commit()
                cur_up.close()
                conn_up.close()
        except Exception as e:
            err_msg = str(e)
            is_conn_err = (
                isinstance(e, psycopg2.OperationalError)
                and ("connection" in err_msg.lower() or "network" in err_msg.lower())
            )
            if is_conn_err:
                now = time.time()
                if now - _save_table_worker_last_conn_err_log >= _save_table_worker_conn_err_interval_sec:
                    logging.getLogger(__name__).warning(
                        "query_studio_save_worker db_unavailable retry_in_s=%s detail=%s",
                        _save_table_worker_conn_err_interval_sec,
                        err_msg.split("\n")[0].strip(),
                    )
                    _save_table_worker_last_conn_err_log = now
                time.sleep(_save_table_worker_conn_err_sleep_sec)
            else:
                traceback.print_exc()
                time.sleep(0.5)
            if conn_sel:
                try:
                    conn_sel.close()
                except Exception:
                    pass
            if conn_create:
                try:
                    conn_create.close()
                except Exception:
                    pass


_save_table_worker_thread = threading.Thread(target=_save_table_worker, daemon=True)
_save_table_worker_thread.start()


# 19.
@router.post("/save-query-as-table")
def save_query_as_table(
    body: SaveQueryAsTableRequest,
    _perm: dict = Depends(require_query_execute_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
):
    """
    쿼리 결과를 테이블로 저장. 요청은 큐 테이블(report_save_queue)에 INSERT 후 즉시 반환. 워커가 큐를 확인해 CREATE TABLE 실행.
    """
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        save_user_id = _perm.get("user_id")
        save_user_id = int(save_user_id) if save_user_id is not None else None

        table_name = (body.table_name or "").strip()
        if not table_name:
            return JSONResponse(status_code=400, content={"error": "테이블명을 입력하세요."})
        if not table_name.startswith(REPORT_SAVED_TABLE_PREFIX):
            table_name = REPORT_SAVED_TABLE_PREFIX + table_name
        if len(table_name) > 128:
            return JSONResponse(
                status_code=400,
                content={"error": "테이블명이 너무 깁니다. (접두사 test_report_ 포함 최대 128자)"},
            )
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]{0,127}$", table_name):
            return JSONResponse(
                status_code=400,
                content={"error": "테이블명은 영문, 숫자, 언더스코어만 사용 가능합니다. (최대 128자)"},
            )
        query = (body.query or "").strip().rstrip(";").strip()
        if not query:
            return JSONResponse(status_code=400, content={"error": "저장할 쿼리가 비어 있습니다. 먼저 쿼리를 실행하세요."})
        if not query.upper().startswith("SELECT"):
            return JSONResponse(status_code=400, content={"error": "SELECT 쿼리만 테이블로 저장할 수 있습니다."})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})

        hints_payload = body.column_comment_hints
        if hints_payload is not None and not isinstance(hints_payload, list):
            return JSONResponse(status_code=400, content={"error": "column_comment_hints는 JSON 배열이어야 합니다."})

        _ensure_queue_table(conn)
        job_id = uuid.uuid4()
        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            hints_val = Json(hints_payload) if hints_payload else None
            cur.execute(
                pg_sql.SQL("""
                    INSERT INTO {schema_table} (id, table_name, project_info_id, query, status, create_user_id, column_comment_hints)
                    VALUES (%s, %s, %s, %s, 'queued', %s, %s)
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                (str(job_id), table_name, int(project_info_id), query, save_user_id, hints_val),
            )
            conn.commit()
        finally:
            cur.close()
        return {
            "ok": True,
            "job_id": str(job_id),
            "status": "queued",
            "message": "저장이 큐 테이블에 등록되었습니다. 백그라운드에서 순서대로 처리됩니다.",
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"error": str(e), "message": "저장 요청 실패"})


# 19a.
@router.get("/save-query-as-table/status/{job_id}")
def save_query_as_table_status(
    job_id: str,
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
):
    """백그라운드 저장 작업 상태 조회 (큐 테이블에서 조회)."""
    try:
        _ensure_queue_table(conn)
        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                pg_sql.SQL("""
                    SELECT id, status, table_name, result_table_name, error,
                           column_comment_result, created_at, started_at, completed_at
                    FROM {schema_table}
                    WHERE id = %s
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                (job_id,),
            )
            row = cur.fetchone()
        finally:
            cur.close()
        if not row:
            return JSONResponse(status_code=404, content={"error": "해당 job_id를 찾을 수 없습니다."})
        cr = row.get("column_comment_result")
        comment_apply_ok = None
        if cr is not None:
            if isinstance(cr, str):
                try:
                    cr = json.loads(cr)
                except json.JSONDecodeError:
                    cr = None
            if isinstance(cr, dict):
                results = cr.get("results") or []
                comment_apply_ok = (
                    len(results) > 0
                    and all(
                        isinstance(x, dict)
                        and x.get("status") in ("applied", "skipped_existing")
                        for x in results
                    )
                )
        return {
            "job_id": job_id,
            "status": row.get("status", "unknown"),
            "table_name": row.get("result_table_name") or row.get("table_name"),
            "error": row.get("error"),
            "column_comment_result": row.get("column_comment_result"),
            "comment_apply_ok": comment_apply_ok,
            "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
            "started_at": row.get("started_at").isoformat() if row.get("started_at") else None,
            "completed_at": row.get("completed_at").isoformat() if row.get("completed_at") else None,
        }
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "상태 조회 실패"})


def _display_name_for_user_info_row(ur: dict) -> str:
    """user_info 한 행 → UI 표시명(닉네임 > 이메일 > id)."""
    if not ur:
        return ""
    nn = (ur.get("user_nickname") or "").strip()
    if nn:
        return nn
    em = (ur.get("user_email") or "").strip()
    if em:
        return em
    uid = ur.get("user_id")
    return str(uid) if uid is not None else ""


# 19b.
@router.get("/save-query-as-table/queue")
def save_query_as_table_queue_list(
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
    conn_sys=Depends(get_system_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=500_000, description="페이지 시작(0 기준)"),
    status: str | None = Query(
        None,
        description="queued|running|completed|failed|cancelled (미지정이면 전체)",
    ),
):
    """현재 프로젝트의 테이블 저장 큐 목록(최신순, limit/offset 페이지네이션)."""
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        _ensure_queue_table(conn)
        schema = db.get_table_schema()
        allowed_status = frozenset({"queued", "running", "completed", "failed", "cancelled"})
        st = (status or "").strip().lower()
        if st and st not in allowed_status:
            return JSONResponse(
                status_code=400,
                content={"error": f"status 는 {', '.join(sorted(allowed_status))} 중 하나여야 합니다."},
            )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            if st:
                cur.execute(
                    pg_sql.SQL("""
                        SELECT COUNT(*)::int AS c
                        FROM {schema_table}
                        WHERE project_info_id = %s AND status = %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (int(project_info_id), st),
                )
            else:
                cur.execute(
                    pg_sql.SQL("""
                        SELECT COUNT(*)::int AS c
                        FROM {schema_table}
                        WHERE project_info_id = %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (int(project_info_id),),
                )
            c_row = cur.fetchone()
            total = int(c_row.get("c", 0) or 0) if c_row is not None else 0
            if st:
                cur.execute(
                    pg_sql.SQL("""
                        SELECT id, table_name, result_table_name, status, error, query,
                               created_at, started_at, completed_at, create_user_id
                        FROM {schema_table}
                        WHERE project_info_id = %s AND status = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (int(project_info_id), st, limit, offset),
                )
            else:
                cur.execute(
                    pg_sql.SQL("""
                        SELECT id, table_name, result_table_name, status, error, query,
                               created_at, started_at, completed_at, create_user_id
                        FROM {schema_table}
                        WHERE project_info_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (int(project_info_id), limit, offset),
                )
            rows = cur.fetchall() or []
        finally:
            cur.close()

        uids: list[int] = []
        seen: set[int] = set()
        for r in rows:
            cuid = r.get("create_user_id")
            if cuid is None:
                continue
            try:
                u = int(cuid)
            except (TypeError, ValueError):
                continue
            if u not in seen:
                seen.add(u)
                uids.append(u)

        user_by_id: dict[int, str] = {}
        if uids:
            csys = conn_sys.cursor(cursor_factory=RealDictCursor)
            try:
                csys.execute(
                    """
                    SELECT user_id, user_email, user_nickname
                    FROM user_info
                    WHERE user_id IN %s
                    """,
                    (tuple(uids),),
                )
                for row_u in csys.fetchall() or []:
                    uid = row_u.get("user_id")
                    if uid is None:
                        continue
                    user_by_id[int(uid)] = _display_name_for_user_info_row(row_u) or f"#{uid}"
            finally:
                csys.close()

        items = []
        for r in rows:
            q = r.get("query") or ""
            if len(q) > 200000:
                q = q[:200000] + "\n-- … (잘림, 총 길이 초과)"
            cuid = r.get("create_user_id")
            create_user_name = None
            if cuid is not None:
                try:
                    create_user_name = user_by_id.get(int(cuid), f"#{cuid}")
                except (TypeError, ValueError):
                    create_user_name = None
            items.append(
                {
                    "id": str(r.get("id")),
                    "table_name": r.get("table_name"),
                    "result_table_name": r.get("result_table_name"),
                    "status": r.get("status"),
                    "error": r.get("error"),
                    "query": q,
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                    "started_at": r["started_at"].isoformat() if r.get("started_at") else None,
                    "completed_at": r["completed_at"].isoformat() if r.get("completed_at") else None,
                    "create_user_id": cuid,
                    "create_user_name": create_user_name,
                }
            )
        return {
            "ok": True,
            "items": items,
            "count": len(items),
            "total": total,
            "offset": offset,
            "limit": limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "큐 목록 조회 실패"})


# 19c.
@router.post("/save-query-as-table/queue/{job_id}/cancel")
def save_query_as_table_queue_cancel(
    job_id: str,
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
):
    """대기(queued) 작업만 취소. 실행 중(running)은 취소되지 않습니다."""
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        _ensure_queue_table(conn)
        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                pg_sql.SQL("""
                    UPDATE {schema_table}
                    SET status = 'cancelled',
                        completed_at = NOW(),
                        error = %s
                    WHERE id = %s::uuid AND project_info_id = %s AND status = 'queued'
                    RETURNING id
                """).format(
                    schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)
                ),
                ("사용자에 의해 취소되었습니다.", str(job_id), int(project_info_id)),
            )
            r = cur.fetchone()
        finally:
            cur.close()
        if not r:
            return JSONResponse(
                status_code=400,
                content={"error": "취소할 수 없습니다. 대기(queued) 상태의 작업만 취소됩니다."},
            )
        conn.commit()
        return {"ok": True, "job_id": job_id, "status": "cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"error": str(e), "message": "취소 실패"})


# 19d.
@router.post("/save-query-as-table/queue/{job_id}/requeue")
def save_query_as_table_queue_requeue(
    job_id: str,
    _perm: dict = Depends(require_query_execute_perm),
    conn=Depends(get_db),
):
    """
    기존 작업과 동일한 파라미터로 새 대기(queued) 작업을 만든다(재시도/동일 쿼리로 다시 큐).
    running 이면 409. (completed/failed/cancelled/queued 등은 새 job_id 로 재등록)
    """
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        save_user_id = _perm.get("user_id")
        save_user_id = int(save_user_id) if save_user_id is not None else None
        _ensure_queue_table(conn)
        schema = db.get_table_schema()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                pg_sql.SQL("""
                    SELECT id, table_name, query, column_comment_hints, status, project_info_id, create_user_id
                    FROM {schema_table}
                    WHERE id = %s::uuid AND project_info_id = %s
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                (job_id, int(project_info_id)),
            )
            row = cur.fetchone()
        finally:
            cur.close()
        if not row:
            return JSONResponse(status_code=404, content={"error": "해당 작업을 찾을 수 없습니다."})
        if (row.get("status") or "").lower() == "running":
            return JSONResponse(
                status_code=409,
                content={"error": "실행 중인 작업은 다시 큐에 넣을 수 없습니다. 끝난 뒤에 재시도하세요."},
            )
        q = (row.get("query") or "").strip().rstrip(";").strip()
        if not q or not q.upper().startswith("SELECT"):
            return JSONResponse(status_code=400, content={"error": "저장된 쿼리가 유효한 SELECT가 아닙니다."})
        dangerous = _contains_dangerous_sql(q)
        if dangerous:
            return JSONResponse(
                status_code=400,
                content={"error": f"재실행 쿼리에 금지 키워드가 있습니다: {dangerous}"},
            )
        table_name = (row.get("table_name") or "").strip()
        if not table_name:
            return JSONResponse(status_code=400, content={"error": "table_name이 비어 있습니다."})
        hints_raw = row.get("column_comment_hints")
        hints_val = None
        if isinstance(hints_raw, str) and hints_raw.strip():
            try:
                j = json.loads(hints_raw)
            except json.JSONDecodeError:
                j = None
            hints_val = Json(j) if isinstance(j, list) and len(j) > 0 else None
        elif isinstance(hints_raw, list) and len(hints_raw) > 0:
            hints_val = Json(hints_raw)
        new_id = str(uuid.uuid4())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                pg_sql.SQL("""
                    INSERT INTO {schema_table}
                        (id, table_name, project_info_id, query, status, create_user_id, column_comment_hints)
                    VALUES (%s, %s, %s, %s, 'queued', %s, %s)
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                (new_id, table_name, int(project_info_id), q, save_user_id, hints_val),
            )
        finally:
            cur.close()
        conn.commit()
        return {
            "ok": True,
            "job_id": new_id,
            "status": "queued",
            "source_job_id": job_id,
            "message": "동일한 설정으로 다시 대기열에 등록되었습니다.",
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"error": str(e), "message": "재실행(재큐) 실패"})


# 20.
@router.post("/execute-query")
def execute_query(
    body: ExecuteQueryRequest,
    _perm: dict = Depends(require_query_execute_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
):
    cur = None
    try:
        query = (body.query or "").strip()
        _log("request: len=%s startswith_SELECT=%s", len(query), query.upper().startswith("SELECT"))
        if not query:
            return JSONResponse(status_code=400, content={"error": "query 파라미터가 필요합니다"})
        if not query.upper().startswith("SELECT"):
            _log("reject: not SELECT")
            return JSONResponse(status_code=400, content={"error": "SELECT 쿼리만 실행 가능합니다"})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            _log("reject: dangerous=%s", dangerous)
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})
        rt = peak_guard.load_runtime(cfg)
        if rt:
            ok, retry = peak_guard.check_execute_query_rate_limit(_perm.get("user_id"), rt)
            if not ok:
                return _peak_guard_429(retry, "쿼리 실행 요청이 너무 잦습니다.")
        timeout = getattr(cfg, "query_timeout_seconds", None)
        if timeout is None:
            raise ValueError("Env/config/config.json 에 backend.query_timeout_seconds 가 없습니다.")
        timeout = int(timeout)
        if timeout < 60:
            timeout = 120
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f"SET statement_timeout = '{timeout}s'")
        _t0 = __import__("time").perf_counter()
        cur.execute(query)
        rows = cur.fetchall()
        _db_ms = int((__import__("time").perf_counter() - _t0) * 1000)
        _log("execute_query: DB 실행 %d ms, 행 %d", _db_ms, len(rows))
        result = [dict((k, db.format_value(v)) for k, v in row.items()) for row in rows]
        cur.close()
        cur = None
        payload = {"data": result, "count": len(result), "query": query}

        def _json_default(obj):
            """Decimal, date 등 JSON 미지원 타입을 문자열로."""
            return str(obj)

        body_bytes = json.dumps(payload, ensure_ascii=False, default=_json_default).encode("utf-8")
        uid_exec = int(_perm["user_id"])
        pid_exec = _perm.get("project_info_id")
        emit_query_studio_log(
            uid_exec,
            business_action="query_execute",
            action_kind="EXECUTE",
            rows_affected=len(result),
            sql_fingerprint=compute_sql_fingerprint_hex(query),
            detail_json={
                "project_info_id": int(pid_exec) if pid_exec is not None else None,
                "query_len": len(query),
                "db_ms": _db_ms,
            },
        )
        return Response(
            content=body_bytes,
            media_type="application/json; charset=utf-8",
        )
    except psycopg2.errors.QueryCanceled:
        timeout = getattr(cfg, "query_timeout_seconds", None)
        sec = max(int(timeout or 0), 120) if timeout is not None else 120
        return JSONResponse(
            status_code=408,
            content={
                "error": f"쿼리 실행 시간 초과 ({sec}초)",
                "message": "쿼리가 너무 오래 걸립니다. LIMIT를 추가하세요.",
            },
        )
    except psycopg2.Error as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "SQL 실행 오류"})
    except Exception as e:
        _log("execute_query exception: %s", repr(e))
        import traceback
        _log("traceback: %s", traceback.format_exc())
        return JSONResponse(status_code=500, content={"error": str(e), "message": "쿼리 실행 실패"})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


# 20a.
@router.post("/estimate-query-result")
def estimate_query_result(
    body: ExecuteQueryRequest,
    _perm: dict = Depends(require_query_execute_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
):
    """SELECT에 대해 EXPLAIN(FORMAT JSON)만 수행하고 최상위 Plan Rows·Width로 결과 데이터 크기를 추정."""
    cur = None
    try:
        query = (body.query or "").strip()
        if not query:
            return JSONResponse(status_code=400, content={"error": "query 파라미터가 필요합니다"})
        if not query.upper().startswith("SELECT"):
            return JSONResponse(status_code=400, content={"error": "SELECT 쿼리만 추정 가능합니다"})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})
        rt = peak_guard.load_runtime(cfg)
        if rt:
            ok, retry = peak_guard.check_execute_query_rate_limit(_perm.get("user_id"), rt)
            if not ok:
                return _peak_guard_429(retry, "쿼리 추정 요청이 너무 잦습니다.")
        timeout = getattr(cfg, "query_timeout_seconds", None)
        if timeout is None:
            raise ValueError("Env/config/config.json 에 backend.query_timeout_seconds 가 없습니다.")
        timeout = int(timeout)
        if timeout < 60:
            timeout = 120
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f"SET statement_timeout = '{timeout}s'")
        cur.execute("EXPLAIN (FORMAT JSON) " + query)
        row = cur.fetchone()
        if not row:
            return JSONResponse(status_code=500, content={"error": "EXPLAIN 결과 없음", "message": "플랜 조회 실패"})
        raw_plan = next(iter(row.values()))
        if isinstance(raw_plan, memoryview):
            raw_plan = raw_plan.tobytes().decode("utf-8")
        if isinstance(raw_plan, (bytes, bytearray)):
            raw_plan = raw_plan.decode("utf-8")
        if isinstance(raw_plan, str):
            plan_payload = json.loads(raw_plan)
        else:
            plan_payload = raw_plan
        rows_f, width_i = _explain_json_root_rows_width(plan_payload)
        est_bytes = None
        pretty = None
        if rows_f is not None and width_i is not None and rows_f >= 0 and width_i >= 0:
            cap = 10**18
            est_bytes = int(min(cap, max(0, math.ceil(rows_f) * width_i)))
            cur.execute("SELECT pg_size_pretty(%s::bigint) AS p", (est_bytes,))
            pr = cur.fetchone() or {}
            pretty = pr.get("p")
        cur.close()
        cur = None
        return {
            "estimated_rows": rows_f,
            "plan_width_bytes": width_i,
            "estimated_data_bytes": est_bytes,
            "estimated_data_pretty": pretty,
            "disclaimer": (
                "PostgreSQL 플래너 통계 기준 추정입니다. "
                "실제 행 수·디스크 테이블 크기(인덱스·TOAST 등)와 다를 수 있습니다."
            ),
        }
    except json.JSONDecodeError as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "EXPLAIN JSON 파싱 실패"})
    except psycopg2.errors.QueryCanceled:
        timeout = getattr(cfg, "query_timeout_seconds", None)
        sec = max(int(timeout or 0), 120) if timeout is not None else 120
        return JSONResponse(
            status_code=408,
            content={
                "error": f"EXPLAIN 시간 초과 ({sec}초)",
                "message": "쿼리가 복잡합니다. 잠시 후 다시 시도하세요.",
            },
        )
    except psycopg2.Error as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "EXPLAIN 실행 오류"})
    except Exception as e:
        _log("estimate_query_result exception: %s", repr(e))
        return JSONResponse(status_code=500, content={"error": str(e), "message": "결과 크기 추정 실패"})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


# 21.
@router.post("/explain-sql")
def explain_sql(
    body: ExplainSqlRequest,
    _perm: dict = Depends(require_query_execute_perm),
    cfg=Depends(get_config),
):
    try:
        query = body.get_query()
        if not query:
            return JSONResponse(status_code=400, content={"error": "query 파라미터가 필요합니다"})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})
        api_key = getattr(cfg, "claude_api_key", None)
        if not api_key or not str(api_key).strip():
            return JSONResponse(
                status_code=503,
                content={"error": "Env/config/config.json 에 backend.claude_api_key 가 없거나 비어 있습니다."},
            )
        url = getattr(cfg, "claude_api_url", None)
        if not url or not str(url).strip():
            return JSONResponse(
                status_code=503,
                content={"error": "Env/config/config.json 에 backend.claude_api_url 이 없거나 비어 있습니다."},
            )
        payload = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1000,
            "messages": [{
                "role": "user",
                "content": (
                    "다음 SQL 쿼리를 한국어로 쉽게 해석해줘. "
                    "기술적인 용어보다는 비즈니스 관점에서 \"이 쿼리가 무엇을 조회하는지\" 설명해줘:\n\n" + query
                ),
            }],
        }
        resp = requests.post(
            url,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        if not resp.ok:
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            msg = err.get("error", {}).get("message", resp.text) if isinstance(err.get("error"), dict) else err.get("error", resp.text)
            return JSONResponse(status_code=resp.status_code, content={"error": msg or "Claude API 호출 실패"})
        result = resp.json()
        content = result.get("content") or []
        text = content[0].get("text", "") if content else ""
        return {"explanation": text}
    except requests.RequestException as e:
        return JSONResponse(status_code=502, content={"error": str(e), "message": "Claude API 통신 오류"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "SQL 해석 실패"})


# 22.
@router.post("/get-column-values")
def get_column_values(
    body: GetColumnValuesRequest,
    _perm: dict = Depends(require_query_read_perm),
    conn=Depends(get_db),
):
    conn_target = None
    cur = None
    should_close = False
    try:
        project_info_id = _perm.get("project_info_id")
        if project_info_id is None:
            raise HTTPException(status_code=403, detail="프로젝트를 먼저 선택해주세요.")
        table_name = db.validate_table_identifier(body.table_name)
        column_name = db.validate_column_name(body.column_name)
        limit = min(body.limit or 100, 1000)
        conn_target, schema, should_close = _qs_mapped_table_conn(
            int(project_info_id), table_name, for_widgetboard=False, main_conn=conn
        )
        if not db._table_exists(conn_target, schema, table_name):
            raise ValueError(f"테이블을 찾을 수 없습니다: {table_name}")
        cur = conn_target.cursor(cursor_factory=RealDictCursor)
        q = pg_sql.SQL(
            "SELECT DISTINCT {col} FROM {tbl} WHERE {col} IS NOT NULL ORDER BY {col} LIMIT %s"
        ).format(
            col=pg_sql.Identifier(column_name),
            tbl=pg_sql.Identifier(schema, table_name),
        )
        cur.execute(q, (limit,))
        rows = cur.fetchall()
        values = [db.format_value(row[column_name]) for row in rows]
        return {
            "table": table_name,
            "column": column_name,
            "values": values,
            "count": len(values),
        }
    except HTTPException:
        raise
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "고유값 조회 실패"})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if should_close and conn_target is not None:
            try:
                conn_target.close()
            except Exception:
                pass


# 23.
@router.post("/query-stats")
def query_stats(
    body: QueryStatsRequest,
    _perm: dict = Depends(require_query_execute_perm),
    conn=Depends(get_db),
    cfg=Depends(get_config),
):
    cur = None
    try:
        query = (body.query or "").strip()
        if not query or not query.upper().startswith("SELECT"):
            return JSONResponse(status_code=400, content={"error": "SELECT 쿼리가 필요합니다"})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})
        timeout = getattr(cfg, "query_timeout_seconds", None)
        if timeout is None:
            raise ValueError("Env/config/config.json 에 backend.query_timeout_seconds 가 없습니다.")
        timeout = int(timeout)
        if timeout < 60:
            timeout = 120
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f"SET statement_timeout = '{timeout}s'")
        cur.execute("SELECT COUNT(*) as total FROM (" + query + ") as subquery")
        count_result = cur.fetchone()
        cur.execute("EXPLAIN " + query)
        explain_result = cur.fetchall()
        cur.close()
        cur = None
        return {
            "total_rows": count_result["total"],
            "explain": [row["QUERY PLAN"] for row in explain_result],
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "통계 조회 실패"})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
