"""
tests/test_four_tables_join.py
==============================
campaigns / test_deliveries_data / test_delivery_tracking / workflows
4개 테이블의 컬럼을 API로 불러와서, 어떻게 JOIN 해야 완벽한지 순차 테스트.

TODO (순차 실행 순서):
  1. Step1: list-tables 후 describe-table로 4테이블 컬럼 로드  → test_step1_load_four_tables_columns
  2. Step2: table-relationships?mode=all 로 관계 목록 로드   → test_step2_load_relationships
  3. Step3: join-order API로 각 base_table별 JOIN 순서·엣지 검증 → test_step3_join_order_valid_for_each_base
  4. Step4: 기대 관계(campaigns↔deliveries, deliveries↔tracking, campaigns↔workflows) assert → test_step4_*

실행: pytest tests/test_four_tables_join.py -v -s
      (-s 로 print 출력)
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import pytest
from fastapi.testclient import TestClient

from Backend.api_server.main import app

client = TestClient(app)

# 4개 테이블 (컬럼 로드·JOIN 검증 대상)
FOUR_TABLES = ["campaigns", "test_deliveries_data", "test_delivery_tracking", "workflows"]


# ---------- Step 1: 4테이블 컬럼 로드 ----------
@pytest.fixture(scope="module")
def tables_and_columns():
    """list-tables 후 4개 테이블에 대해 describe-table 호출해 컬럼 수집. 실패 시 skip."""
    resp = client.get("/api/list-tables")
    if resp.status_code != 200:
        pytest.skip(f"list-tables 실패: {resp.status_code}")
    tables = resp.json().get("tables") or []
    table_names = [t.get("table_name") for t in tables if t.get("table_name")]
    missing = [t for t in FOUR_TABLES if t not in table_names]
    if missing:
        pytest.skip(f"4테이블 중 허용 목록에 없음: {missing}")

    result = {}
    for name in FOUR_TABLES:
        r = client.post("/api/describe-table", json={"table_name": name})
        if r.status_code != 200:
            pytest.skip(f"describe-table({name}) 실패: {r.status_code}")
        data = r.json()
        cols = data.get("columns") or []
        result[name] = [c.get("name") for c in cols if c.get("name")]
    return result


def test_step1_load_four_tables_columns(tables_and_columns):
    """Step1: 4테이블 컬럼을 API로 불러와서 보유 여부·id/_id 컬럼 확인."""
    for t in FOUR_TABLES:
        cols = tables_and_columns.get(t) or []
        assert len(cols) > 0, f"{t} 컬럼 없음"
    # 관계 추론에 필요한 id, *_id 컬럼 존재 여부
    for t in FOUR_TABLES:
        cols = tables_and_columns[t]
        assert "id" in cols, f"{t}에 id 컬럼 없음"
    # campaigns -> test_deliveries_data (campaign_id), test_deliveries_data -> test_delivery_tracking (delivery_id)
    assert "campaign_id" in tables_and_columns.get("test_deliveries_data", []), "test_deliveries_data.campaign_id 없음"
    assert "delivery_id" in tables_and_columns.get("test_delivery_tracking", []), "test_delivery_tracking.delivery_id 없음"
    assert "campaign_id" in tables_and_columns.get("workflows", []), "workflows.campaign_id 없음"
    print("\n[Step1 OK] 4테이블 컬럼 로드 완료:", {t: len(tables_and_columns[t]) for t in FOUR_TABLES})


# ---------- Step 2: table-relationships 로드 ----------
@pytest.fixture(scope="module")
def relationships():
    """table-relationships?mode=all 로 관계 목록 로드."""
    resp = client.get("/api/table-relationships?mode=all")
    if resp.status_code != 200:
        pytest.skip(f"table-relationships 실패: {resp.status_code}")
    return resp.json().get("relationships") or []


def test_step2_load_relationships(relationships):
    """Step2: 관계 목록 로드 후 4테이블 간 기대 엣지 존재 여부."""
    rel_pairs = set()
    for r in relationships:
        a, b = r.get("from_table"), r.get("to_table")
        if a and b:
            rel_pairs.add((a, b))

    # campaigns -> test_deliveries_data, test_deliveries_data -> test_delivery_tracking, campaigns -> workflows (또는 역방향)
    expected_links = [
        ("test_deliveries_data", "campaigns"),
        ("test_delivery_tracking", "test_deliveries_data"),
        ("workflows", "campaigns"),
    ]
    for child, parent in expected_links:
        assert (child, parent) in rel_pairs or (parent, child) in rel_pairs, (
            f"관계 없음: {child} <-> {parent}"
        )
    print("\n[Step2 OK] 관계 수:", len(relationships))


# ---------- Step 3: join-order 로 각 base별 JOIN 순서 검증 ----------
@pytest.fixture(scope="module")
def join_orders():
    """각 테이블을 base로 두고 나머지 3개 required 로 join-order 호출."""
    orders = {}
    for base in FOUR_TABLES:
        required = [t for t in FOUR_TABLES if t != base]
        resp = client.post("/api/join-order", json={"base_table": base, "required_tables": required})
        if resp.status_code != 200:
            orders[base] = {"error": resp.status_code, "body": resp.json()}
            continue
        data = resp.json()
        orders[base] = {
            "join_order": data.get("join_order") or [],
            "valid": data.get("valid", True),
            "errors": data.get("errors") or [],
            "warnings": data.get("warnings") or [],
        }
    return orders


def test_step3_join_order_valid_for_each_base(join_orders):
    """Step3: 4개 base 각각에 대해 join-order가 valid하고, 4개 테이블 모두 포함."""
    for base in FOUR_TABLES:
        data = join_orders.get(base) or {}
        if data.get("error"):
            pytest.skip(f"join-order(base={base}) API 오류: {data.get('error')}")
        assert data.get("valid") is True, f"base={base} valid 아님: {data.get('errors')}"
        steps = data.get("join_order") or []
        tables_in_order = [s.get("table") for s in steps if s.get("table")]
        for t in FOUR_TABLES:
            assert t in tables_in_order, f"base={base} join_order에 {t} 없음"
    print("\n[Step3 OK] 4 base 모두 join_order valid, 4테이블 포함")


# ---------- Step 4: 기대 관계로 완벽 JOIN 구조 assert ----------
def test_step4_expected_join_edges(join_orders):
    """Step4: campaigns 기준 join_order에서 기대 엣지가 나오는지 검증.
    기대: campaigns -> test_deliveries_data (campaign_id),
          campaigns -> workflows (campaign_id),
          test_deliveries_data -> test_delivery_tracking (delivery_id)
    """
    data = join_orders.get("campaigns") or {}
    if data.get("error"):
        pytest.skip("join-order(campaigns) 없음")
    steps = data.get("join_order") or []
    edges = []
    for s in steps:
        ft, tt = s.get("from_table"), s.get("to_table")
        if ft and tt:
            edges.append((ft, tt, s.get("from_column"), s.get("to_column")))

    # campaigns 기준: 자식들이 campaigns에 붙거나, test_deliveries_data에 test_delivery_tracking이 붙어야 함
    from_tables = {e[0] for e in edges}
    to_tables = {e[1] for e in edges}
    assert "campaigns" in from_tables or "campaigns" in to_tables, "campaigns가 엣지에 없음"
    # test_delivery_tracking -> test_deliveries_data (delivery_id) 또는 test_deliveries_data -> test_delivery_tracking
    delivery_tracking_edge = [
        e for e in edges
        if ("test_delivery_tracking" in (e[0], e[1]) and "test_deliveries_data" in (e[0], e[1]))
    ]
    assert len(delivery_tracking_edge) >= 1, "test_deliveries_data <-> test_delivery_tracking 엣지 없음"
    print("\n[Step4 OK] 기대 JOIN 엣지 존재. 엣지 수:", len(edges))
    for e in edges:
        print("  ", e[0], "->", e[1], f"({e[2]} -> {e[3]})")


def test_step4_full_join_order_print(join_orders, capsys):
    """Step4 보조: campaigns 기준 전체 join_order를 출력해 '완벽한 JOIN 순서' 문서화."""
    data = join_orders.get("campaigns") or {}
    if data.get("error"):
        pytest.skip("join-order(campaigns) 없음")
    steps = data.get("join_order") or []
    with capsys.disabled():
        print("\n========== campaigns 기준 완벽 JOIN 순서 (4테이블) ==========")
        for i, s in enumerate(steps):
            t = s.get("table")
            ft, fc = s.get("from_table"), s.get("from_column")
            tt, tc = s.get("to_table"), s.get("to_column")
            if ft and tt:
                print(f"  {i+1}. {t}  (JOIN ON {ft}.{fc} = {tt}.{tc})")
            else:
                print(f"  {i+1}. {t}  (FROM)")
        print("============================================================\n")


# ---------- JOIN 지표(경우의 수·정확도) 및 파생 테이블 컬럼 ----------
def test_step5_join_metrics_and_derived_columns(tables_and_columns, relationships, join_orders):
    """Step5: 경우의 수·정확도 점수 계산, 파생 테이블 컬럼이 여러 개인지 검증."""
    from Backend.query_studio_server.join_metrics import (
        join_case_count,
        join_accuracy_score,
        derived_table_columns,
    )

    # 경우의 수: base별 valid join_order 개수
    by_base = {
        base: {"valid": (d.get("valid") is True), "join_order": d.get("join_order") or []}
        for base, d in join_orders.items()
        if not d.get("error")
    }
    counts = join_case_count(FOUR_TABLES, by_base)
    assert counts["base_candidates"] == 4
    assert counts["valid_join_orders"] == 4
    assert counts["total_edges_in_valid"] >= 3

    # 정확도: campaigns 기준 join_order의 엣지 confidence 평균
    data = join_orders.get("campaigns") or {}
    if not data.get("error") and data.get("join_order"):
        score = join_accuracy_score(data["join_order"], relationships)
        assert 0 <= score <= 1.0
        assert score >= 0.5

    # 파생 테이블: join_order + 테이블별 컬럼 → derived_columns (컬럼이 여러 개)
    table_columns_for_derived = {}
    for t, cols in tables_and_columns.items():
        table_columns_for_derived[t] = [{"name": c, "type": ""} for c in cols]
    data = join_orders.get("campaigns") or {}
    if data.get("error"):
        pytest.skip("join-order(campaigns) 없음")
    derived = derived_table_columns(data.get("join_order") or [], table_columns_for_derived)
    assert "derived_columns" in derived
    assert "tables" in derived
    assert "total_columns" in derived
    assert derived["total_columns"] == len(derived["derived_columns"])
    # 4테이블 컬럼 합이므로 7+17+7+8 = 39개 이상
    assert derived["total_columns"] >= 30
    assert len(derived["tables"]) == 4
    for row in derived["derived_columns"]:
        assert "table" in row and "alias" in row and "column" in row

    print("\n[Step5 OK] 경우의 수:", counts)
    print("  정확도(campaigns 기준):", join_accuracy_score(data["join_order"], relationships))
    print("  파생 테이블 컬럼 수:", derived["total_columns"])
    print("  테이블별:", [f"{t['table']}({t['alias']}):{t['column_count']}개" for t in derived["tables"]])
