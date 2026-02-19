"""
Backend.etl_server.transform_engine (변환 룰 적용 엔진)
=====================================================
DataFrame에 etl_transform_rules를 apply_order 순으로 적용. cleansing/type_cast/code_map/derived/masking.

[Functions]
===========
26 - _apply_cleansing: TRIM, empty_to_null, default_value
36 - _apply_type_cast: target_type(date/timestamp/integer/bigint/numeric/text), on_error, date_format
69 - _apply_code_map: mappings, default
76 - _apply_derived: formula(concat, year_minus), columns/separator, source_column
97 - _apply_masking: type(right_n/left_n/email_domain), n, char
136 - apply_rules: (df, rules) → 변환된 DataFrame. is_active=True만, source_column→target_column

[Dependencies]
=========
- pandas
"""

from datetime import datetime
from typing import Any, Dict, List

import pandas as pd


def _apply_cleansing(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """TRIM, empty_to_null, default_value."""
    out = series.astype(str).str.strip()
    if config.get("empty_to_null"):
        out = out.replace("", None).replace("nan", None)
    if "default_value" in config and config["default_value"] is not None:
        out = out.fillna(config["default_value"])
    return out


def _apply_type_cast(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """target_type: date, timestamp, integer, bigint, numeric, text. on_error: null | keep."""
    target = (config.get("target_type") or "text").strip().lower()
    on_error = (config.get("on_error") or "null").strip().lower()
    date_fmt = config.get("date_format") or "%Y-%m-%d"

    def try_convert(val):
        if pd.isna(val) or val == "":
            return None
        try:
            if target == "integer" or target == "bigint":
                return int(float(val))
            if target == "numeric":
                return float(val)
            if target == "date":
                if isinstance(val, datetime):
                    return val.date() if hasattr(val, "date") else val
                return datetime.strptime(str(val).strip()[:10], date_fmt).date()
            if target == "timestamp":
                if isinstance(val, datetime):
                    return val
                return pd.to_datetime(val)
            if target == "text":
                return str(val).strip()
        except Exception:
            if on_error == "null":
                return None
            return val
        return None

    return series.map(try_convert)


def _apply_code_map(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """mappings: { "원본": "대상" }, default: 매핑 없을 때 값."""
    mappings = config.get("mappings") or {}
    default = config.get("default")
    return series.map(lambda x: mappings.get(x, mappings.get(str(x).strip(), default)) if pd.notna(x) else default)


def _apply_derived(series: pd.Series, config: Dict[str, Any], df: pd.DataFrame) -> pd.Series:
    """formula: concat(columns, separator) | year_minus(source_column)."""
    formula = (config.get("formula") or "").strip().lower()
    if formula == "concat":
        cols = config.get("columns") or []
        sep = config.get("separator") or ""
        if not cols:
            return series
        parts = [df[c].astype(str).fillna("") for c in cols if c in df.columns]
        if not parts:
            return series
        return pd.Series([sep.join(p) for p in zip(*parts)], index=df.index)
    if formula == "year_minus":
        src_col = config.get("source_column")
        if src_col and src_col in df.columns:
            year_now = datetime.now().year
            return (year_now - pd.to_numeric(df[src_col], errors="coerce")).astype("Int64")
        return series
    return series


def _apply_masking(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """type: right_n | left_n (n, char) | email_domain."""
    mask_type = (config.get("type") or "right_n").strip().lower()
    n = int(config.get("n") or 4)
    char = config.get("char") or "*"

    def mask_right(s):
        if pd.isna(s) or not str(s).strip():
            return s
        s = str(s)
        if len(s) <= n:
            return char * len(s)
        return s[: len(s) - n] + char * n

    def mask_left(s):
        if pd.isna(s) or not str(s).strip():
            return s
        s = str(s)
        if len(s) <= n:
            return char * len(s)
        return char * n + s[n:]

    def mask_email_domain(s):
        if pd.isna(s) or not str(s).strip():
            return s
        s = str(s).strip()
        if "@" in s:
            return "*@" + s.split("@", 1)[1]
        return char * min(len(s), 4)

    if mask_type == "right_n":
        return series.map(mask_right)
    if mask_type == "left_n":
        return series.map(mask_left)
    if mask_type == "email_domain":
        return series.map(mask_email_domain)
    return series.map(mask_right)


def apply_rules(df: pd.DataFrame, rules: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    rules 순서대로 각 룰 적용. is_active=True인 것만.
    source_column이 DataFrame에 없으면 스킵.
    target_column으로 결과 저장(같은 이름이면 덮어씀).
    """
    if df.empty or not rules:
        return df
    out = df.copy()
    for r in rules:
        if not r.get("is_active", True):
            continue
        src = (r.get("source_column") or "").strip()
        tgt = (r.get("target_column") or src).strip()
        if not src or src not in out.columns:
            continue
        rule_type = (r.get("rule_type") or "").strip().lower()
        config = r.get("rule_config")
        if isinstance(config, str):
            import json
            try:
                config = json.loads(config)
            except Exception:
                config = {}
        if not isinstance(config, dict):
            config = {}
        try:
            if rule_type == "cleansing":
                out[tgt] = _apply_cleansing(out[src], config)
            elif rule_type == "type_cast":
                out[tgt] = _apply_type_cast(out[src], config)
            elif rule_type == "code_map":
                out[tgt] = _apply_code_map(out[src], config)
            elif rule_type == "derived":
                out[tgt] = _apply_derived(out[src], config, out)
            elif rule_type == "masking":
                out[tgt] = _apply_masking(out[src], config)
        except Exception:
            pass
    return out
