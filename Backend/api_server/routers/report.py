"""
Backend.api_server.routers.report (리포트/쿼리 빌더 API)
========================================================
FastAPI 라우터. list-tables, describe-table, table-relationships, execute-query,
explain-sql, get-column-values, query-stats. Depends(get_db), Depends(get_config) 사용.
"""

import json
import re
import traceback
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
from Backend.api_server.relationship_inference import infer_relationships
from Backend.api_server.dependencies import get_db, get_config
from Backend.api_server.join_path import determine_join_order, validate_join_order
from Backend.api_server.join_metrics import join_accuracy_score
from Backend.api_server.schemas import (
    DescribeTableRequest,
    ExecuteQueryRequest,
    ExplainSqlRequest,
    GetColumnValuesRequest,
    JoinOrderRequest,
    QueryStatsRequest,
    SaveQueryAsTableRequest,
)

_DEBUG_LOG_PATH = Path(__file__).resolve().parent.parent.parent / "execute_query_debug.log"


def _log(msg, *args):
    line = f"[execute-query] {msg % args if args else msg}"
    print(line, flush=True)
    try:
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
        tables = cur.fetchall()
        cur.close()
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
            col_type = row["data_type"]
            if row["character_maximum_length"]:
                col_type += f"({row['character_maximum_length']})"
            columns.append({
                "name": row["column_name"],
                "type": col_type,
                "nullable": row["is_nullable"] == "YES",
                "default": row["column_default"],
            })
        cur.close()
        return {"table_name": table_name, "columns": columns, "count": len(columns)}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 구조 조회 실패"})


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


@router.post("/save-query-as-table")
def save_query_as_table(body: SaveQueryAsTableRequest, conn=Depends(get_db), cfg=Depends(get_config)):
    """
    사용했던 SELECT 쿼리 결과를 지정한 이름의 테이블로 저장.
    table_name: 영문/숫자/언더스코어만 허용 (1~128자).
    """
    try:
        table_name = (body.table_name or "").strip()
        if not table_name:
            return JSONResponse(status_code=400, content={"error": "테이블명을 입력하세요."})
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
        schema = db.get_table_schema()
        timeout = int(getattr(cfg, "query_timeout_seconds", None) or 120)
        cur = conn.cursor()
        try:
            cur.execute(f"SET statement_timeout = '{timeout}s'")
            cur.execute(pg_sql.SQL("CREATE TABLE {} AS ({})").format(pg_sql.Identifier(schema, table_name), pg_sql.SQL(query)))
            conn.commit()
        finally:
            cur.close()
        return {"ok": True, "table_name": table_name, "schema": schema}
    except psycopg2.Error as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"error": str(e), "message": "테이블 생성 실패"})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e), "message": "저장 실패"})


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
