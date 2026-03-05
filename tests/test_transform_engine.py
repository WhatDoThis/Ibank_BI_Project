"""
tests/test_transform_engine.py
==============================
ETL Transform 엔진(Phase 1~3) 단위·통합 테스트.
- Phase 1: string, masking, type_cast(boolean, date_formats), apply_rules 통합
- Phase 2: rule_category 폴백, mapping range_map, datetime age
- Phase 3: numeric round, row deduplicate, masking hash
"""
import sys
import importlib.util
from pathlib import Path
from datetime import date

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import pandas as pd

# transform_engine만 로드 (router 등 의존성 없이)
_spec = importlib.util.spec_from_file_location(
    "transform_engine",
    _root / "Backend" / "etl_server2" / "transform_engine.py",
)
_te = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_te)
_apply_string_transform = _te._apply_string_transform
_apply_masking = _te._apply_masking
_apply_type_cast = _te._apply_type_cast
apply_rules = _te.apply_rules


def test_string_uppercase():
    df = pd.DataFrame({"name": ["hello", "World", None]})
    result = _apply_string_transform(df["name"], {"operation": "uppercase"}, df)
    assert result.tolist()[0] == "HELLO"
    assert result.tolist()[1] == "WORLD"


def test_string_pad_left():
    df = pd.DataFrame({"code": ["1", "23", "456"]})
    result = _apply_string_transform(
        df["code"],
        {"operation": "pad_left", "width": 5, "fill_char": "0"},
        df,
    )
    assert result.tolist() == ["00001", "00023", "00456"]


def test_string_concat():
    df = pd.DataFrame({"first": ["홍", "김"], "last": ["길동", "영희"]})
    result = _apply_string_transform(
        df["first"],
        {"operation": "concat", "columns": ["first", "last"], "separator": " "},
        df,
    )
    assert result.tolist() == ["홍 길동", "김 영희"]


def test_mask_phone():
    s = pd.Series(["010-1234-5678", "0212345678", "01012345678", None])
    result = _apply_masking(s, {"operation": "mask_phone"})
    assert result.iloc[0] == "010-****-5678"
    assert result.iloc[3] is None or pd.isna(result.iloc[3])


def test_mask_name():
    s = pd.Series(["홍길동", "김수", "박", "남궁민수", None])
    result = _apply_masking(s, {"operation": "mask_name"})
    assert result.tolist()[0] == "홍*동"
    assert result.tolist()[1] == "김*"
    assert result.tolist()[2] == "*"
    assert result.tolist()[3] == "남**수"


def test_masking_legacy_compat():
    s = pd.Series(["hello"])
    result = _apply_masking(s, {"type": "right_n", "n": 3, "char": "*"})
    assert result.iloc[0] == "he***"


def test_type_cast_boolean():
    s = pd.Series(["Y", "no", "1", "거짓", "maybe", None])
    result = _apply_type_cast(s, {"target_type": "boolean", "on_error": "null"})
    assert result.tolist()[0] is True
    assert result.tolist()[1] is False
    assert result.tolist()[2] is True
    assert result.tolist()[3] is False
    assert result.tolist()[4] is None or pd.isna(result.tolist()[4])
    assert result.tolist()[5] is None or pd.isna(result.tolist()[5])


def test_type_cast_multi_date_formats():
    s = pd.Series(["2024-03-15", "2024/03/16", "20240317", "invalid"])
    result = _apply_type_cast(
        s,
        {
            "target_type": "date",
            "date_formats": ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"],
            "on_error": "null",
        },
    )
    assert result.iloc[0] == date(2024, 3, 15)
    assert result.iloc[1] == date(2024, 3, 16)
    assert result.iloc[2] == date(2024, 3, 17)
    assert pd.isna(result.iloc[3]) or result.iloc[3] is None


def test_apply_rules_phase1_integration():
    """Phase 1: cleansing → string → type_cast(boolean) → masking → type_cast(date)."""
    df = pd.DataFrame({
        "name": ["  홍길동  ", "  김영희  "],
        "phone": ["010-1234-5678", "01098765432"],
        "is_vip": ["Y", "N"],
        "birth_date": ["1990-01-15", "1985/06/20"],
    })
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "name",
            "target_column": "name",
            "rule_type": "cleansing",
            "rule_config": {"empty_to_null": False},
        },
        {
            "rule_id": 2,
            "is_active": True,
            "source_column": "name",
            "target_column": "name_masked",
            "rule_type": "masking",
            "rule_config": {"operation": "mask_name"},
        },
        {
            "rule_id": 3,
            "is_active": True,
            "source_column": "phone",
            "target_column": "phone_masked",
            "rule_type": "masking",
            "rule_config": {"operation": "mask_phone"},
        },
        {
            "rule_id": 4,
            "is_active": True,
            "source_column": "is_vip",
            "target_column": "is_vip",
            "rule_type": "type_cast",
            "rule_config": {"target_type": "boolean", "on_error": "null"},
        },
        {
            "rule_id": 5,
            "is_active": True,
            "source_column": "birth_date",
            "target_column": "birth_date",
            "rule_type": "type_cast",
            "rule_config": {
                "target_type": "date",
                "date_formats": ["%Y-%m-%d", "%Y/%m/%d"],
            },
        },
        {
            "rule_id": 6,
            "is_active": True,
            "source_column": "name",
            "target_column": "name_upper",
            "rule_type": "string",
            "rule_config": {"operation": "uppercase"},
        },
    ]
    result = apply_rules(df, rules)
    assert result["name"].iloc[0] == "홍길동"
    assert result["name_masked"].iloc[0] == "홍*동"
    assert result["phone_masked"].iloc[0] == "010-****-5678"
    assert result["is_vip"].iloc[0] == True
    assert result["birth_date"].iloc[1] == date(1985, 6, 20)
    assert result["name_upper"].iloc[0] == "홍길동"


def test_apply_rules_rule_category_fallback():
    """Phase 2: rule_category 사용 시 동작, rule_type 없어도 rule_category만 있으면 적용."""
    df = pd.DataFrame({"x": ["a", "b", "c"]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "x",
            "target_column": "x_upper",
            "rule_category": "string",
            "rule_config": {"operation": "uppercase"},
        }
    ]
    result = apply_rules(df, rules)
    assert result["x_upper"].tolist() == ["A", "B", "C"]


def test_apply_rules_mapping_range_map():
    """Phase 2: mapping + range_map."""
    df = pd.DataFrame({"score": [45, 65, 85, 95]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "score",
            "target_column": "grade",
            "rule_category": "mapping",
            "operation": "range_map",
            "rule_config": {
                "ranges": [
                    {"min": 0, "max": 59, "value": "F"},
                    {"min": 60, "max": 69, "value": "D"},
                    {"min": 70, "max": 79, "value": "C"},
                    {"min": 80, "max": 89, "value": "B"},
                    {"min": 90, "max": 100, "value": "A"},
                ],
                "default": "N/A",
            },
        }
    ]
    result = apply_rules(df, rules)
    assert result["grade"].tolist() == ["F", "D", "B", "A"]


def test_apply_rules_datetime_age():
    """Phase 2: datetime + age."""
    df = pd.DataFrame({"birth": ["1990-01-15", "1985-06-20"]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "birth",
            "target_column": "age",
            "rule_category": "datetime",
            "operation": "age",
            "rule_config": {},
        }
    ]
    result = apply_rules(df, rules)
    assert result["age"].iloc[0] is not None and result["age"].iloc[0] >= 30


def test_apply_rules_numeric_round():
    """Phase 3: numeric + round."""
    df = pd.DataFrame({"x": [1.234, 2.567, 3.0]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "x",
            "target_column": "x2",
            "rule_category": "numeric",
            "rule_config": {"operation": "round", "decimals": 2},
        }
    ]
    result = apply_rules(df, rules)
    assert result["x2"].tolist() == [1.23, 2.57, 3.0]


def test_apply_rules_row_deduplicate():
    """Phase 3: row + deduplicate."""
    df = pd.DataFrame({"a": [1, 1, 2], "b": [10, 10, 20]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "rule_category": "row",
            "rule_config": {"operation": "deduplicate", "subset": ["a"], "keep": "first"},
        }
    ]
    result = apply_rules(df, rules)
    assert len(result) == 2
    assert result["a"].tolist() == [1, 2]


def test_apply_rules_masking_hash():
    """Phase 3: masking + hash."""
    df = pd.DataFrame({"secret": ["hello", "world"]})
    rules = [
        {
            "rule_id": 1,
            "is_active": True,
            "source_column": "secret",
            "target_column": "hashed",
            "rule_category": "masking",
            "rule_config": {"operation": "hash", "algorithm": "sha256"},
        }
    ]
    result = apply_rules(df, rules)
    assert len(result["hashed"].iloc[0]) == 64
    assert result["hashed"].iloc[0] != "hello"
