"""
tests/test_join_path.py
======================
join_path 순환 참조·깊이 검증 풀가동 테스트.
에러/경계: 순환(중복 테이블), 빈/단일, 깊이 초과 warning.
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Backend.query_studio_server.join_path import validate_join_order, find_join_path, find_direct_relationship


# ---------- validate_join_order ----------
def test_validate_join_order_no_circular():
    """순환 없으면 valid True."""
    order = [
        {"table": "campaigns"},
        {"table": "test_deliveries_data"},
        {"table": "test_delivery_tracking"},
    ]
    r = validate_join_order(order)
    assert r["valid"] is True
    assert len(r["errors"]) == 0


def test_validate_join_order_empty():
    """빈 join_order는 valid, 에러 없음."""
    r = validate_join_order([])
    assert r["valid"] is True
    assert r["errors"] == []
    assert r["warnings"] == []


def test_validate_join_order_single_table():
    """단일 테이블만 있어도 valid."""
    r = validate_join_order([{"table": "campaigns"}])
    assert r["valid"] is True
    assert len(r["errors"]) == 0


def test_validate_join_order_circular_detected():
    """같은 테이블이 두 번 나오면 순환 참조로 거부."""
    order = [
        {"table": "A"},
        {"table": "B"},
        {"table": "C"},
        {"table": "A"},
    ]
    r = validate_join_order(order)
    assert r["valid"] is False
    assert any("순환 참조" in e and "A" in e for e in r["errors"])


def test_validate_join_order_circular_first_duplicate():
    """첫 중복 테이블 기준으로 에러 메시지."""
    order = [
        {"table": "X"},
        {"table": "Y"},
        {"table": "Y"},
    ]
    r = validate_join_order(order)
    assert r["valid"] is False
    assert any("Y" in e for e in r["errors"])


def test_validate_join_order_multiple_duplicates():
    """여러 중복이 있어도 순환 에러 여러 개."""
    order = [
        {"table": "A"},
        {"table": "B"},
        {"table": "A"},
        {"table": "B"},
    ]
    r = validate_join_order(order)
    assert r["valid"] is False
    assert len(r["errors"]) >= 2


def test_validate_join_order_max_depth_warning():
    """JOIN 깊이가 max_depth+1 초과면 warning."""
    order = [{"table": f"t{i}"} for i in range(6)]  # 6 tables = depth 5, max_depth default 4
    r = validate_join_order(order, max_depth=4)
    assert r["valid"] is True
    assert any("깊이" in w for w in r["warnings"])


def test_validate_join_order_exactly_max_depth_plus_one_no_warning():
    """정확히 max_depth+1(5) 테이블이면 warning 없음 (5 > 5 거짓)."""
    order = [{"table": f"t{i}"} for i in range(5)]
    r = validate_join_order(order, max_depth=4)
    assert r["valid"] is True
    assert not any("깊이" in w for w in r["warnings"])


def test_validate_join_order_step_must_have_table_key():
    """step에 table 키가 있어야 함 (없으면 KeyError 가능; 현재 구현은 step['table'] 사용)."""
    order = [{"table": "A"}, {"table": "B"}]
    r = validate_join_order(order)
    assert r["valid"] is True


# ---------- find_join_path (경로 탐색) ----------
def test_find_join_path_same_table():
    """from == to 이면 빈 경로."""
    assert find_join_path("A", "A", []) == []


def test_find_join_path_no_relation():
    """관계 없으면 None."""
    assert find_join_path("A", "B", []) is None


def test_find_join_path_direct():
    """직접 관계 한 개면 한 엣지."""
    fk_list = [{"from_table": "A", "from_column": "id", "to_table": "B", "to_column": "a_id"}]
    path = find_join_path("A", "B", fk_list)
    assert path is not None
    assert len(path) == 1
    assert path[0]["from_table"] == "A" and path[0]["to_table"] == "B"
