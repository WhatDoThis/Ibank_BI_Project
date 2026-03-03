"""
Backend.etl_server.transform_engine (변환 룰 적용 엔진)
=====================================================
DataFrame에 etl_transform_rules를 apply_order 순으로 적용. cleansing/type_cast/code_map/derived/masking.

[Functions]
===========
26 - _apply_cleansing: TRIM, empty_to_null, default_value
36 - _apply_type_cast: target_type(date/timestamp/integer/bigint/numeric/text), on_error(null|zero|keep), date_format
69 - _apply_type_cast_with_mask: 2-pass 벡터 변환(coerce) 후 실패 행만 on_error 적용. fail 시 ValueError
76 - _apply_code_map: mappings, default
77 - _apply_derived: formula(concat, year_minus), columns/separator, source_column
98 - _apply_masking: type(right_n/left_n/email_domain), n, char
137 - apply_rules: (df, rules) → 변환된 DataFrame. is_active=True만, source_column→target_column
138 - apply_mapping_type_cast: column_mapping의 type·on_error로 소스 컬럼 형변환. skip_row/fail 지원

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
    """target_type: date, timestamp, integer, bigint, numeric, text. on_error: null | zero | keep."""
    target = (config.get("target_type") or "text").strip().lower()
    on_error = (config.get("on_error") or "null").strip().lower()
    date_fmt = config.get("date_format") or "%Y-%m-%d"

    def _fallback(val, on_err: str):
        if on_err == "null":
            return None
        if on_err == "zero":
            if target in ("integer", "bigint", "numeric"):
                return 0 if target == "numeric" else 0
            if target in ("date", "timestamp"):
                return None
            return "" if target == "text" else val
        return val  # keep

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
            return _fallback(val, on_error)
        return None

    return series.map(try_convert)


def _apply_type_cast_with_mask(series: pd.Series, config: Dict[str, Any]):
    """
    target_type + on_error 적용. 반환: (변환된 Series, 실패한 행 마스크).
    on_error가 'fail'이면 변환 실패 시 ValueError 발생.
    2-pass: 1차 벡터 변환(errors='coerce') 후, 실패 행만 on_error 로직 적용.
    """
    target = (config.get("target_type") or "text").strip().lower()
    on_error = (config.get("on_error") or "null").strip().lower()
    date_fmt = config.get("date_format") or "%Y-%m-%d"
    failed_mask = pd.Series(False, index=series.index)

    # 원본이 비어있으면 None (변환 시도하지 않음)
    empty = series.isna() | (series.astype(str).str.strip() == "") | (series.astype(str).str.lower() == "nan")

    if target == "text":
        out = series.astype(str).str.strip()
        out = out.where(~empty, None)
        return out, failed_mask

    # 1차: 벡터 변환 (errors='coerce')
    if target in ("integer", "bigint"):
        converted = pd.to_numeric(series, errors="coerce")
    elif target == "numeric":
        converted = pd.to_numeric(series, errors="coerce")
    elif target == "timestamp":
        converted = pd.to_datetime(series, errors="coerce")
    elif target == "date":
        _dt = pd.to_datetime(series, format=date_fmt, errors="coerce")
        converted = _dt.dt.date if _dt is not None and hasattr(_dt, "dt") else _dt
        if converted is None:
            converted = pd.Series([pd.NA] * len(series), index=series.index)
    else:
        converted = series.copy()

    # 실패 행: 변환 결과가 NA인데 원본은 비어있지 않음
    if hasattr(converted, "isna"):
        failed = (~empty & converted.isna()).reindex(series.index, fill_value=False)
    else:
        failed = pd.Series(False, index=series.index)

    if failed.any():
        if on_error == "fail":
            first_fail_idx = failed.idxmax()
            raise ValueError(
                f"행 변환 실패 (인덱스 {first_fail_idx}, 값: {series.at[first_fail_idx]!r})"
            ) from None
        for idx in series.index[failed]:
            if on_error == "skip_row":
                failed_mask.at[idx] = True

    # 결과 조립: 비어있으면 None, 실패면 on_error에 따라, 성공이면 converted
    def _fallback_val(idx):
        if empty.at[idx]:
            return None
        if failed.at[idx]:
            if on_error == "skip_row":
                return None
            if on_error == "null":
                return None
            if on_error == "zero":
                if target in ("integer", "bigint", "numeric"):
                    return 0
                if target in ("date", "timestamp"):
                    return None
                return "" if target == "text" else series.at[idx]
            return series.at[idx]  # keep
        return converted.at[idx] if hasattr(converted, "at") else converted

    if failed.any() and on_error != "fail":
        # 실패 행만 스칼라로 채우고 나머지는 벡터 결과 사용
        out = converted.copy()
        if hasattr(out, "astype") and target in ("integer", "bigint"):
            out = out.astype(object)
        for idx in series.index[failed]:
            out.at[idx] = _fallback_val(idx)
    else:
        out = converted.copy()

    # empty 위치는 None
    out = out.where(~empty, None)
    return out, failed_mask


def apply_mapping_type_cast(
    df: pd.DataFrame,
    column_mapping: List[Dict[str, Any]],
    default_on_error: str = "null",
) -> pd.DataFrame:
    """
    column_mapping의 type·on_error에 따라 소스 컬럼을 형변환.
    on_error: null | zero | keep | skip_row | fail.
    skip_row면 변환 실패 행 제거, fail이면 첫 실패 시 ValueError.
    """
    if df.empty or not column_mapping:
        return df
    out = df.copy()
    drop_mask = pd.Series(False, index=df.index)
    for m in column_mapping:
        src = (m.get("source") or "").strip()
        if not src or src not in out.columns:
            continue
        pg_type = (m.get("type") or "TEXT").strip().upper() or "TEXT"
        target = "text"
        if pg_type in ("INTEGER", "INT", "BIGINT", "SMALLINT"):
            target = "bigint"
        elif pg_type in ("NUMERIC", "DECIMAL", "REAL", "DOUBLE PRECISION", "FLOAT"):
            target = "numeric"
        elif pg_type in ("DATE",):
            target = "date"
        elif pg_type in ("TIMESTAMP", "TIMESTAMPTZ", "TIME"):
            target = "timestamp"
        elif pg_type in ("BOOLEAN", "BOOL"):
            target = "text"  # keep as text for simplicity; could add boolean
        on_error = (m.get("on_error") or default_on_error).strip().lower()
        if on_error not in ("null", "zero", "keep", "skip_row", "fail"):
            on_error = default_on_error
        config = {"target_type": target, "on_error": on_error}
        try:
            if on_error == "fail":
                converted, _ = _apply_type_cast_with_mask(out[src], config)
                out[src] = converted
            elif on_error == "skip_row":
                converted, failed = _apply_type_cast_with_mask(out[src], config)
                out[src] = converted
                drop_mask = drop_mask | failed
            else:
                out[src] = _apply_type_cast(out[src], config)
        except ValueError:
            raise
    if drop_mask.any():
        out = out.loc[~drop_mask].reset_index(drop=True)
    return out


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
