"""
tests/test_query_builder_performance.py
=======================================
쿼리 빌더가 사용하는 API 호출 구간별 소요 시간 측정.
(프론트 초기 로드: health → list-tables → describe-table × N → table-relationships?mode=all)

실행: pytest tests/test_query_builder_performance.py -v -s
      (-s 로 print 출력 보기)
"""
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from fastapi.testclient import TestClient
from Backend.api_server.main import app

client = TestClient(app)


def _elapsed(start):
    return round((time.perf_counter() - start) * 1000)


def test_query_builder_load_timing(capsys):
    """쿼리 빌더 초기 로드와 동일한 순서로 API 호출 후 구간별 시간 출력."""
    results = []

    # 1) health
    t0 = time.perf_counter()
    r = client.get("/health")
    results.append(("GET /health", _elapsed(t0), r.status_code))
    assert r.status_code == 200, "health 실패 시 이후 의미 없음"

    # 2) list-tables
    t0 = time.perf_counter()
    r = client.get("/api/list-tables")
    results.append(("GET /api/list-tables", _elapsed(t0), r.status_code))
    assert r.status_code == 200
    tables = r.json().get("tables") or []
    table_names = [t.get("table_name") for t in tables if t.get("table_name")]

    # 3) describe-table × N (프론트는 순차 호출)
    describe_total = 0
    for name in table_names:
        t0 = time.perf_counter()
        r = client.post("/api/describe-table", json={"table_name": name})
        ms = _elapsed(t0)
        describe_total += ms
        results.append((f"  POST /api/describe-table ({name})", ms, r.status_code))
    results.append(("  [describe-table 합계]", describe_total, None))

    # 4) table-relationships?mode=all (백엔드에서 N개 테이블 컬럼 조회 + 추론)
    t0 = time.perf_counter()
    r = client.get("/api/table-relationships?mode=all")
    results.append(("GET /api/table-relationships?mode=all", _elapsed(t0), r.status_code))

    # 5) (선택) execute-query 단순 쿼리
    t0 = time.perf_counter()
    r = client.post("/api/execute-query", json={"query": "SELECT 1 AS n"})
    results.append(("POST /api/execute-query (SELECT 1)", _elapsed(t0), r.status_code))

    # 출력
    total_ms = 0
    with capsys.disabled():
        print("\n========== 쿼리 빌더 구간별 소요 시간 (ms) ==========")
        for label, ms, status in results:
            if status is not None:
                total_ms += ms
            if "합계" in label:
                print(f"  {label}: {ms} ms")
            else:
                print(f"  {label}: {ms} ms  [status={status}]")
        print(f"  [총합 (health~execute)]: {total_ms} ms")
        print("====================================================\n")

    assert True  # 테스트는 통과시키되, 느린 구간은 위 print로 확인


# 쿼리 빌더에서 자주 쓰는 JOIN 쿼리 실행 시간 측정 (DB 실행이 오래 걸리는지 확인)
JOIN_QUERY = """
SELECT
    t1.delivery_code,
    t1.delivery_status,
    t3.campaign_label
FROM test_deliveries_data AS t1
LEFT JOIN campaigns AS t2 ON t1.campaign_id = t2.id
LEFT JOIN test_coupons_data AS t3 ON t2.id = t3.campaign_id
LIMIT 100 OFFSET 0
"""


def test_join_query_execution_timing(capsys):
    """
    JOIN 쿼리 실행 시 어디가 오래 걸리는지: execute-query 한 번 호출 = 대부분 DB 실행 시간.
    서버 로그에 [execute_query: DB 실행 N ms, 행 M] 출력됨.
    """
    t0 = time.perf_counter()
    r = client.post("/api/execute-query", json={"query": JOIN_QUERY.strip()})
    total_ms = _elapsed(t0)
    with capsys.disabled():
        print("\n========== JOIN 쿼리 실행 (round-trip) ==========")
        print(f"  POST /api/execute-query (JOIN 3테이블, LIMIT 100): {total_ms} ms  [status={r.status_code}]")
        print("  → 대부분이 DB에서 JOIN 실행 시간입니다. 서버 로그에 'DB 실행 N ms' 확인.")
        print("  → test_deliveries_data, test_coupons_data 테이블이 크면 JOIN이 오래 걸립니다.")
        print("================================================\n")
    assert r.status_code in (200, 408, 500, 503)
