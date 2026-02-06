"""
Backend.api_server.routers.report (리포트/쿼리 빌더 API)
========================================================
list-tables, describe-table, table-relationships, execute-query, explain-sql,
get-column-values, query-stats. Depends(get_db), Depends(get_config) 활용.
"""

import re
from datetime import datetime
from pathlib import Path

import psycopg2
import requests
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from Backend.api_server import db
from Backend.api_server.dependencies import get_db, get_config
from Backend.api_server.schemas import (
    DescribeTableRequest,
    ExecuteQueryRequest,
    ExplainSqlRequest,
    GetColumnValuesRequest,
    QueryStatsRequest,
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
def table_relationships(conn=Depends(get_db), mode: str = Query("all")):
    try:
        allowed = list(db.get_allowed_tables())
        if not allowed:
            return {"relationships": [], "count": 0}
        mode = (mode or "all").strip().lower()
        if mode not in ("fk", "column", "all"):
            mode = "all"
        relationships = []
        if mode in ("fk", "all"):
            schema = db.get_table_schema()
            cur = conn.cursor()
            try:
                placeholders = ", ".join(["%s"] * len(allowed))
                sql = (
                    "SELECT kcu.table_name AS from_table, kcu.column_name AS from_column, "
                    "ccu.table_name AS to_table, ccu.column_name AS to_column "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
                    "JOIN information_schema.constraint_column_usage ccu "
                    "ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema "
                    "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = %s "
                    "AND kcu.table_name IN (" + placeholders + ") "
                    "AND ccu.table_name IN (" + placeholders + ") "
                    "ORDER BY kcu.table_name, ccu.table_name, kcu.column_name"
                )
                cur.execute(sql, (schema,) + tuple(allowed) + tuple(allowed))
                for r in cur.fetchall():
                    row = dict(r)
                    if mode == "all":
                        row["source"] = "fk"
                        row["confidence"] = "HIGH"
                        row["reason"] = "FK 관계"
                    relationships.append(row)
            finally:
                cur.close()
        if mode in ("fk", "all"):
            allowed_set = set(allowed)
            table_columns = {}
            for table_name in allowed:
                try:
                    table_columns[table_name] = db.get_table_columns_with_types(table_name)
                except Exception:
                    table_columns[table_name] = []
            for table_name in allowed:
                for c in table_columns.get(table_name, []):
                    col = c.get("column_name") or ""
                    if col == "id" or not col.endswith("_id"):
                        continue
                    base = col[:-3].rstrip("_")
                    if not base:
                        continue
                    to_table = None
                    if base in allowed_set:
                        to_table = base
                    elif (base + "s") in allowed_set:
                        to_table = base + "s"
                    if not to_table:
                        continue
                    already = any(
                        r.get("from_table") == table_name
                        and r.get("from_column") == col
                        and r.get("to_table") == to_table
                        and r.get("to_column") == "id"
                        for r in relationships
                    )
                    if already:
                        continue
                    rel = {
                        "from_table": table_name,
                        "from_column": col,
                        "to_table": to_table,
                        "to_column": "id",
                        "source": "inferred" if mode == "all" else None,
                    }
                    if mode == "all":
                        rel["confidence"] = "HIGH"
                        rel["reason"] = "FK 미정의 시 _id 패턴 추론 (부모.id=자식.부모_id)"
                    relationships.append(rel)
        if mode in ("column", "all"):
            table_columns = {}
            for table_name in allowed:
                try:
                    table_columns[table_name] = db.get_table_columns_with_types(table_name)
                except Exception:
                    table_columns[table_name] = []
            for i, t1 in enumerate(allowed):
                cols1 = {(c["column_name"], c["data_type"]) for c in table_columns.get(t1, [])}
                for t2 in allowed[i + 1 :]:
                    cols2 = {(c["column_name"], c["data_type"]) for c in table_columns.get(t2, [])}
                    common = cols1 & cols2
                    for col_name, data_type in sorted(common):
                        if col_name in ("id", "created_at", "updated_at"):
                            continue
                        if data_type:
                            t = data_type.lower()
                            if "date" in t or "timestamp" in t or t == "time" or "interval" in t:
                                continue
                        if col_name.endswith("_id"):
                            continue
                        rel1 = {
                            "from_table": t1, "to_table": t2,
                            "from_column": col_name, "to_column": col_name,
                            "source": "column" if mode == "all" else None,
                        }
                        rel2 = {
                            "from_table": t2, "to_table": t1,
                            "from_column": col_name, "to_column": col_name,
                            "source": "column" if mode == "all" else None,
                        }
                        if mode == "all":
                            rel1["confidence"] = rel2["confidence"] = "MEDIUM"
                            rel1["reason"] = rel2["reason"] = "동일 컬럼명·타입"
                        relationships.append(rel1)
                        relationships.append(rel2)
        return {"relationships": relationships, "count": len(relationships)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "JOIN 관계 조회 실패"})


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
        cur.execute(query)
        rows = cur.fetchall()
        result = [dict((k, db.format_value(v)) for k, v in row.items()) for row in rows]
        cur.close()
        return {"data": result, "count": len(result), "query": query}
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
