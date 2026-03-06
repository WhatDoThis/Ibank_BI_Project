"""
Backend.api_server.routers.report (리포트/쿼리 빌더 API)
========================================================
FastAPI 라우터. prefix /api. 테이블 목록·구조·JOIN 관계·쿼리 실행·Claude 해석·컬럼 고유값·쿼리 통계.

[Helpers]
===========
62 - _log: 디버그 로그 출력·파일 기록
72 - _contains_dangerous_sql: 금지 SQL 키워드 검사
112 - _fetch_relationships: FK/추론 관계 조회
214 - _get_or_compute_relationships_all: 관계 캐시·추론
384 - _ensure_queue_table: save_query_as_table 작업 큐 테이블 생성
409 - _save_table_worker: 쿼리 결과 저장 워커 (백그라운드)

[Endpoints]
===========
233 - list_tables: GET /api/list-tables (allowed_tables)
266 - describe_table: POST /api/describe-table (테이블 구조)
305 - table_relationships: GET /api/table-relationships (mode=fk|all)
320 - api_join_order: POST /api/api-join-order (JOIN 순서)
544 - save_query_as_table: POST /api/save-query-as-table (쿼리 결과→테이블)
605 - save_query_as_table_status: GET /api/save-query-as-table/status/{job_id}
639 - execute_query: POST /api/execute-query (SELECT 실행)
698 - explain_sql: POST /api/explain-sql (Claude 해석)
754 - get_column_values: POST /api/get-column-values (컬럼 고유값)
780 - query_stats: POST /api/query-stats (쿼리 통계)

[Dependencies]
=========
- Backend.api_server.db, dependencies.get_db, get_config, schemas, pluralize, join_path, join_metrics, relationship_inference, analysis_store
- fastapi, psycopg2, requests
"""

import json
import logging
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
import requests
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response

from Backend.api_server import db
from Backend.api_server import analysis_store
from Env.config.loader import add_allowed_table as add_allowed_table_to_config
from Backend.api_server.relationship_inference import infer_relationships
from Backend.api_server.dependencies import get_db, get_config
from Backend.api_server.join_path import determine_join_order, validate_join_order
from Backend.api_server.join_metrics import join_accuracy_score
from Backend.api_server.schemas import (
    ColumnLabelsRequest,
    DescribeTableRequest,
    ExecuteQueryRequest,
    ExplainSqlRequest,
    GetColumnValuesRequest,
    JoinOrderRequest,
    QueryStatsRequest,
    SaveQueryAsTableRequest,
)

_DEBUG_LOG_DIR = Path(__file__).resolve().parent.parent.parent / "Env" / "logs"
_DEBUG_LOG_PATH = _DEBUG_LOG_DIR / "execute_query_debug.log"
_COLUMN_LABELS_PATH = Path(__file__).resolve().parent.parent.parent / "Env" / "config" / "column_labels.json"

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


def _save_labels_file(data):
    """table_labels + column_labels 저장."""
    _COLUMN_LABELS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_COLUMN_LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _get_table_label(table_name):
    """저장된 값 우선, 없으면 기본 라벨, 없으면 테이블명."""
    data = _load_labels_file()
    saved = (data.get("table_labels") or {}).get(table_name)
    if saved:
        return saved
    return DEFAULT_TABLE_LABELS.get(table_name) or table_name


def _get_column_label(table_name, column_name):
    """저장된 값 우선, 테이블별 기본값, 공통 기본값, 없으면 컬럼명."""
    data = _load_labels_file()
    col_labels = (data.get("column_labels") or {}).get(table_name, {})
    if column_name in col_labels and col_labels[column_name]:
        return col_labels[column_name]
    by_table = DEFAULT_COLUMN_LABELS_BY_TABLE.get(table_name, {}).get(column_name)
    if by_table:
        return by_table
    return COMMON_COLUMN_LABELS.get(column_name) or column_name


def _load_column_labels():
    """구형 호환: column_labels만 반환 (table_name -> { col -> label })."""
    data = _load_labels_file()
    return data.get("column_labels") or {}


def _log(msg, *args):
    line = f"[execute-query] {msg % args if args else msg}"
    print(line, flush=True)
    try:
        _DEBUG_LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(datetime.now().strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")
    except Exception:
        pass


def _contains_dangerous_sql(query):
    if not query or not query.strip():
        _log("dangerous_sql: query empty -> None")
        return None
    text = query.upper()
    phrases = [
        "DROP TABLE", "DROP INDEX", "DROP VIEW", "DROP SCHEMA", "DROP DATABASE",
        "DELETE FROM", "INSERT INTO",
        "ALTER TABLE", "ALTER INDEX", "ALTER VIEW",
        "CREATE TABLE", "CREATE INDEX", "CREATE VIEW", "CREATE SCHEMA",
        "TRUNCATE TABLE",
    ]
    segments = text.split(";")
    _log("dangerous_sql: segments count=%s", len(segments))
    for i, segment in enumerate(segments):
        segment = segment.strip()
        if not segment:
            continue
        seg_preview = (segment[:80] + "...") if len(segment) > 80 else segment
        seg_preview = seg_preview.replace("\n", "\\n")
        if re.match(r"^\s*SELECT\b", segment):
            _log("dangerous_sql: segment[%s] starts with SELECT -> skip", i)
            continue
        for phrase in phrases:
            words = phrase.split()
            parts = [r"\b" + re.escape(w) + r"\b" for w in words]
            pattern = r"^\s*" + r"\s+".join(parts) + r"(?:\s|$)"
            if re.match(pattern, segment):
                _log("dangerous_sql: segment[%s] matched phrase=%s", i, phrase)
                return phrase
        if re.match(r"^\s*UPDATE\b\s", segment):
            _log("dangerous_sql: segment[%s] matched UPDATE", i)
            return "UPDATE"
    _log("dangerous_sql: all segments passed -> None")
    return None


router = APIRouter(prefix="/api", tags=["report"])


def _fetch_relationships(conn, mode="fk", table_columns=None):
    """관계 목록 반환 (dedup: 쌍당 한 방향). mode=all일 때 table_columns를 넘기면 컬럼 조회를 한 번만 수행."""
    allowed = list(db.get_allowed_tables())
    if not allowed:
        return []
    mode = (mode or "fk").strip().lower()
    if mode not in ("fk", "column", "all"):
        mode = "fk"
    relationships = []
    if mode in ("fk", "all"):
        schema = db.get_table_schema()
        cur = conn.cursor()
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
            table_columns = db.get_all_tables_columns_with_types(allowed)
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


def _get_or_compute_relationships_all(conn):
    """저장된 분석이 있고 allowlist가 같으면 그대로 반환, 없으면 분석 후 저장하고 반환. mode=all 기준."""
    current_allowed = set(db.get_allowed_tables())
    try:
        latest = analysis_store.get_latest_analysis_result()
        if latest and set(latest.get("allowed_tables") or []) == current_allowed:
            return latest["relationships"]
    except Exception:
        pass
    table_columns = db.get_all_tables_columns_with_types(list(current_allowed))
    rels = _fetch_relationships(conn, "all", table_columns=table_columns)
    try:
        analysis_store.save_analysis_result(list(current_allowed), table_columns, rels)
    except Exception:
        pass
    return rels


@router.get("/list-tables")
def list_tables(conn=Depends(get_db)):
    try:
        allowed = list(db.get_allowed_tables())
        schema = db.get_table_schema()
        if not allowed:
            return {"tables": [], "count": 0}
        placeholders = ", ".join(["%s"] * len(allowed))
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                table_name,
                pg_size_pretty(pg_total_relation_size((table_schema || '.' || table_name)::regclass)) AS size
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
              AND table_name IN (""" + placeholders + """)
            ORDER BY table_name
            """,
            (schema,) + tuple(allowed),
        )
        rows = cur.fetchall()
        cur.close()
        data = _load_labels_file()
        table_labels_saved = data.get("table_labels") or {}
        tables = []
        for row in rows:
            tname = row["table_name"]
            tables.append({
                "table_name": tname,
                "size": row.get("size"),
                "table_label": table_labels_saved.get(tname) or DEFAULT_TABLE_LABELS.get(tname) or tname,
            })
        return {"tables": tables, "count": len(tables)}
    except ValueError as e:
        return JSONResponse(status_code=503, content={"error": str(e), "message": "DB 설정 없음"})
    except psycopg2.OperationalError as e:
        return JSONResponse(status_code=503, content={"error": str(e), "message": "DB 연결 실패(네트워크/접속정보 확인)"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 목록 조회 실패"})


@router.post("/describe-table")
def describe_table(body: DescribeTableRequest, conn=Depends(get_db)):
    try:
        table_name = db.validate_table_name(body.table_name)
        schema = db.get_table_schema()
        cur = conn.cursor()
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
            columns.append({
                "name": col_name,
                "type": col_type,
                "nullable": row["is_nullable"] == "YES",
                "default": row["column_default"],
                "label": _get_column_label(table_name, col_name),
            })
        cur.close()
        return {"table_name": table_name, "columns": columns, "count": len(columns)}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 구조 조회 실패"})


@router.get("/column-labels")
def get_column_labels(table_name: str = Query(..., description="테이블명")):
    """테이블별 컬럼 라벨·테이블 라벨 조회."""
    try:
        table_name = db.validate_table_name(table_name)
        data = _load_labels_file()
        col_labels = (data.get("column_labels") or {}).get(table_name, {})
        table_label = _get_table_label(table_name)
        return {"table_name": table_name, "table_label": table_label, "labels": col_labels}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.post("/column-labels")
def save_column_labels(body: ColumnLabelsRequest):
    """테이블·컬럼 라벨 저장. 사용자가 수정한 라벨만 저장(기본값 덮어씀)."""
    try:
        table_name = db.validate_table_name(body.table_name)
        data = _load_labels_file()
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
        _save_labels_file(data)
        return {
            "table_name": table_name,
            "table_label": data["table_labels"].get(table_name) or _get_table_label(table_name),
            "labels": data["column_labels"].get(table_name, {}),
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "컬럼 라벨 저장 실패"})


@router.get("/table-relationships")
def table_relationships(conn=Depends(get_db), mode: str = Query("fk", description="fk=FK만(문서기본), all=FK+_id추론")):
    """개선된 관계 분석. mode=all이면 저장된 분석 결과가 있고 allowlist가 같으면 그대로 사용, 없으면 분석 후 저장."""
    try:
        mode = (mode or "fk").strip().lower()
        if mode == "all":
            rels = _get_or_compute_relationships_all(conn)
            return {"relationships": rels, "count": len(rels)}
        rels = _fetch_relationships(conn, mode)
        return {"relationships": rels, "count": len(rels)}
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "JOIN 관계 조회 실패"})


@router.post("/join-order")
def api_join_order(body: JoinOrderRequest, conn=Depends(get_db)):
    """
    JOIN 자동 생성 명세: base_table 기준 required_tables의 JOIN 순서 + 엣지 정보.
    반환: join_order (각 단계 table, from_table, from_column, to_table, to_column), warnings, errors
    """
    try:
        base_table = (body.base_table or "").strip()
        required_tables = [t.strip() for t in (body.required_tables or []) if t and t.strip()]
        if not base_table:
            return JSONResponse(status_code=400, content={"error": "base_table 필요", "join_order": [], "warnings": [], "errors": ["base_table이 비어 있습니다."]})
        allowed = list(db.get_allowed_tables())
        if base_table not in allowed:
            return JSONResponse(status_code=400, content={"error": "base_table이 허용 목록에 없음", "join_order": [], "warnings": [], "errors": [f"테이블 '{base_table}'을 사용할 수 없습니다."]})
        for t in required_tables:
            if t not in allowed:
                return JSONResponse(status_code=400, content={"error": "required_tables에 허용되지 않은 테이블 있음", "join_order": [], "warnings": [], "errors": [f"테이블 '{t}'을 사용할 수 없습니다."]})
        fk_list = _get_or_compute_relationships_all(conn)
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


def _ensure_queue_table(conn):
    """큐 테이블이 없으면 생성 (allowed_tables와 무관, 내부용)."""
    schema = db.get_table_schema()
    cur = conn.cursor()
    try:
        cur.execute(
            pg_sql.SQL("""
                CREATE TABLE IF NOT EXISTS {schema_table} (
                    id UUID PRIMARY KEY,
                    table_name VARCHAR(255) NOT NULL,
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
        conn.commit()
    finally:
        cur.close()


def _save_table_worker():
    """큐 테이블에서 status='queued'인 행을 확인해 하나씩 CREATE TABLE 실행."""
    global _save_table_worker_last_conn_err_log
    from Env import config as env_config
    while True:
        conn_sel = None
        conn_create = None
        try:
            conn_sel = db.get_db_connection()
            _ensure_queue_table(conn_sel)
            schema = db.get_table_schema()
            cur = conn_sel.cursor()
            cur.execute(
                pg_sql.SQL("""
                    SELECT id, table_name, query
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
            cur = conn_sel.cursor()
            cur.execute(
                pg_sql.SQL("UPDATE {schema_table} SET status = 'running', started_at = NOW() WHERE id = %s").format(
                    schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)
                ),
                (job_id,),
            )
            conn_sel.commit()
            cur.close()
            conn_sel.close()
            conn_sel = None

            timeout = int(getattr(env_config.backend, "query_timeout_seconds", None) or 120)
            conn_create = db.get_db_connection()
            cur_create = conn_create.cursor()
            try:
                cur_create.execute(f"SET statement_timeout = '{timeout}s'")
                cur_create.execute(pg_sql.SQL("CREATE TABLE {} AS ({})").format(pg_sql.Identifier(schema, table_name), pg_sql.SQL(query)))
                conn_create.commit()
                cur_create.close()
                conn_create.close()
                conn_create = None
                added, _ = add_allowed_table_to_config(table_name)
                if added:
                    try:
                        from Env import config
                        if hasattr(config, "backend") and hasattr(config.backend, "allowed_tables") and isinstance(config.backend.allowed_tables, list):
                            if table_name not in config.backend.allowed_tables:
                                config.backend.allowed_tables.append(table_name)
                    except Exception:
                        pass
                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor()
                cur_up.execute(
                    pg_sql.SQL("""
                        UPDATE {schema_table}
                        SET status = 'completed', completed_at = NOW(), result_table_name = %s
                        WHERE id = %s
                    """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                    (table_name, job_id),
                )
                conn_up.commit()
                cur_up.close()
                conn_up.close()
            except psycopg2.Error as e:
                if conn_create:
                    try:
                        conn_create.rollback()
                        conn_create.close()
                    except Exception:
                        pass
                    conn_create = None
                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor()
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
                traceback.print_exc()
                if conn_create:
                    try:
                        conn_create.close()
                    except Exception:
                        pass
                conn_up = db.get_db_connection()
                cur_up = conn_up.cursor()
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
                        "save_table_worker: DB connection unavailable (%s). Next log in %ds.",
                        err_msg.split("\n")[0].strip(),
                        _save_table_worker_conn_err_interval_sec,
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


@router.post("/save-query-as-table")
def save_query_as_table(body: SaveQueryAsTableRequest, conn=Depends(get_db), cfg=Depends(get_config)):
    """
    쿼리 결과를 테이블로 저장. 요청은 큐 테이블(report_save_queue)에 INSERT 후 즉시 반환. 워커가 큐를 확인해 CREATE TABLE 실행.
    """
    try:
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

        _ensure_queue_table(conn)
        job_id = uuid.uuid4()
        schema = db.get_table_schema()
        cur = conn.cursor()
        try:
            cur.execute(
                pg_sql.SQL("""
                    INSERT INTO {schema_table} (id, table_name, query, status)
                    VALUES (%s, %s, %s, 'queued')
                """).format(schema_table=pg_sql.Identifier(schema, REPORT_SAVE_QUEUE_TABLE)),
                (str(job_id), table_name, query),
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
    except Exception as e:
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"error": str(e), "message": "저장 요청 실패"})


@router.get("/save-query-as-table/status/{job_id}")
def save_query_as_table_status(job_id: str, conn=Depends(get_db)):
    """백그라운드 저장 작업 상태 조회 (큐 테이블에서 조회)."""
    try:
        _ensure_queue_table(conn)
        schema = db.get_table_schema()
        cur = conn.cursor()
        try:
            cur.execute(
                pg_sql.SQL("""
                    SELECT id, status, table_name, result_table_name, error, created_at, started_at, completed_at
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
        return {
            "job_id": job_id,
            "status": row.get("status", "unknown"),
            "table_name": row.get("result_table_name") or row.get("table_name"),
            "error": row.get("error"),
            "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
            "completed_at": row.get("completed_at").isoformat() if row.get("completed_at") else None,
        }
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "상태 조회 실패"})


@router.post("/execute-query")
def execute_query(body: ExecuteQueryRequest, conn=Depends(get_db), cfg=Depends(get_config)):
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
        timeout = getattr(cfg, "query_timeout_seconds", None)
        if timeout is None:
            raise ValueError("Env/config/config.json 에 backend.query_timeout_seconds 가 없습니다.")
        timeout = int(timeout)
        if timeout < 60:
            timeout = 120
        cur = conn.cursor()
        cur.execute(f"SET statement_timeout = '{timeout}s'")
        _t0 = __import__("time").perf_counter()
        cur.execute(query)
        rows = cur.fetchall()
        _db_ms = int((__import__("time").perf_counter() - _t0) * 1000)
        _log("execute_query: DB 실행 %d ms, 행 %d", _db_ms, len(rows))
        result = [dict((k, db.format_value(v)) for k, v in row.items()) for row in rows]
        cur.close()
        payload = {"data": result, "count": len(result), "query": query}

        def _json_default(obj):
            """Decimal, date 등 JSON 미지원 타입을 문자열로."""
            return str(obj)

        body_bytes = json.dumps(payload, ensure_ascii=False, default=_json_default).encode("utf-8")
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


@router.post("/explain-sql")
def explain_sql(body: ExplainSqlRequest, cfg=Depends(get_config)):
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


@router.post("/get-column-values")
def get_column_values(body: GetColumnValuesRequest, conn=Depends(get_db)):
    try:
        table_name = db.validate_table_name(body.table_name)
        column_name = db.validate_column_name(body.column_name)
        limit = min(body.limit or 100, 1000)
        cur = conn.cursor()
        cur.execute(
            f'SELECT DISTINCT "{column_name}" FROM {table_name} WHERE "{column_name}" IS NOT NULL ORDER BY "{column_name}" LIMIT %s',
            (limit,),
        )
        rows = cur.fetchall()
        values = [db.format_value(row[column_name]) for row in rows]
        cur.close()
        return {
            "table": table_name,
            "column": column_name,
            "values": values,
            "count": len(values),
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "고유값 조회 실패"})


@router.post("/query-stats")
def query_stats(body: QueryStatsRequest, conn=Depends(get_db)):
    try:
        query = (body.query or "").strip()
        if not query or not query.upper().startswith("SELECT"):
            return JSONResponse(status_code=400, content={"error": "SELECT 쿼리가 필요합니다"})
        dangerous = _contains_dangerous_sql(query)
        if dangerous:
            return JSONResponse(status_code=400, content={"error": f"금지된 키워드: {dangerous}"})
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as total FROM (" + query + ") as subquery")
        count_result = cur.fetchone()
        cur.execute("EXPLAIN " + query)
        explain_result = cur.fetchall()
        cur.close()
        return {
            "total_rows": count_result["total"],
            "explain": [row["QUERY PLAN"] for row in explain_result],
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "통계 조회 실패"})
