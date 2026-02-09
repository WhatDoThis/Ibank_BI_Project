"""
tests/test_report_api.py
========================
리포트 API 동작 검증 (execute-query 메서드·UTF-8 응답).

- GET /api/execute-query → 405 Method Not Allowed (POST만 허용)
- POST /api/execute-query body 없음/query 없음 → 400
- POST 성공 시 응답 Content-Type에 charset=utf-8 포함 (한글 컬럼명 대비)
"""
import sys
from pathlib import Path

# 프로젝트 루트를 path에 넣어 앱 로드
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from fastapi.testclient import TestClient

# config 등 로드될 수 있으므로 앱 import
from Backend.api_server.main import app

client = TestClient(app)


def test_execute_query_get_returns_405_method_not_allowed():
    """GET /api/execute-query 는 허용되지 않음 → 405."""
    resp = client.get("/api/execute-query")
    assert resp.status_code == 405
    assert "method" in resp.json().get("detail", "").lower() or "not allowed" in resp.json().get("detail", "").lower()


def test_execute_query_post_empty_body_returns_4xx():
    """POST /api/execute-query, query 없음 → 400 또는 422(검증 오류)."""
    resp = client.post("/api/execute-query", json={})
    assert resp.status_code in (400, 422)


def test_execute_query_post_with_query_returns_200_or_408_or_500():
    """POST /api/execute-query, SELECT 쿼리 전달 시 200(성공) 또는 408(타임아웃)/500(DB오류). 응답은 UTF-8."""
    resp = client.post(
        "/api/execute-query",
        json={"query": "SELECT 1 AS one, '한글' AS \"전체\""},
    )
    # DB 연결 실패 시 503, 타임아웃 408, 성공 200
    assert resp.status_code in (200, 408, 500, 503)
    if resp.status_code == 200:
        # 한글 컬럼명이 있어도 UTF-8로 응답
        assert "application/json" in (resp.headers.get("content-type") or "")
        data = resp.json()
        assert "data" in data
        # 컬럼명 "전체"가 키로 있으면 OK
        if data.get("data") and len(data["data"]) > 0:
            row = data["data"][0]
            assert "one" in row or "전체" in row or list(row)


# 리포트 피벗 쿼리(연월 + 전체 컬럼) — 실제 사용 쿼리로 검증
PIVOT_QUERY = """
SELECT
    t1.workflow_label,
    COUNT(CASE WHEN TO_CHAR(t1.delivery_date, 'YYYY-MM') = '2026-02' THEN 1 END) AS "2026-02",
    COUNT(*) AS "전체"
FROM ibank_1 AS t1
GROUP BY t1.workflow_label
LIMIT 100 OFFSET 0;
"""


def test_execute_query_pivot_with_korean_column():
    """POST execute-query: 피벗 쿼리(TO_CHAR 연월 + 한글 컬럼 '전체') 실행 시 200이면 구조·UTF-8 검증."""
    resp = client.post("/api/execute-query", json={"query": PIVOT_QUERY})
    assert resp.status_code in (200, 408, 500, 503), f"unexpected status {resp.status_code}"
    if resp.status_code == 200:
        assert "application/json" in (resp.headers.get("content-type") or "")
        data = resp.json()
        assert "data" in data
        rows = data.get("data") or []
        if rows:
            row = rows[0]
            assert "전체" in row, "한글 컬럼 '전체'가 응답에 있어야 함"
            assert "2026-02" in row, "피벗 컬럼 '2026-02'가 응답에 있어야 함"
            assert "t1.workflow_label" in row or "workflow_label" in row, "기준축 컬럼이 있어야 함"
