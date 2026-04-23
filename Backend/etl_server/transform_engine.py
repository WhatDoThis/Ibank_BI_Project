"""
Backend.etl_server.transform_engine (변환 룰 적용 엔진)
=======================================================
DataFrame에 etl_transform_rules를 apply_order 순으로 적용.
Phase 3: numeric(round, arithmetic, bucket, clamp), row(filter, deduplicate),
masking(hash, redact), cleansing(fill_forward, fill_backward, normalize_unicode).

[Main Functions]
===========
1. apply_mapping_type_cast: column_mapping 기준 DataFrame 형변환(on_error·skip_row 등)
2. apply_rules: rules 순서대로 룰 적용(_COLUMN_TRANSFORMERS·_ROW_TRANSFORMERS 디스패치)
- 그 외 `_apply_*`·`_parse_config` 등은 위 1·2 내부에서만 사용하는 헬퍼(본문 번호 생략).

[Dependencies]
=========
- pandas, re, hashlib, json
"""

import hashlib
import inspect
import json
import logging
import re
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import pandas as pd

# 시간대 변환용 (timezone_convert operation)
try:
    import pytz
    def _get_tz(name: str):
        return pytz.timezone(name)
except ImportError:
    from zoneinfo import ZoneInfo
    def _get_tz(name: str):
        return ZoneInfo(name)

logger = logging.getLogger(__name__)


def _apply_cleansing(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """TRIM, empty_to_null, default_value. Phase 3: fill_forward, fill_backward, normalize_unicode."""
    op = (config.get("operation") or "trim").strip().lower()
    if op == "fill_forward":
        return series.ffill()
    if op == "fill_backward":
        return series.bfill()
    if op == "normalize_unicode":
        import unicodedata
        form = (config.get("form") or "NFC").strip().upper()
        return series.astype(str).map(
            lambda s: unicodedata.normalize(form, s) if pd.notna(s) and s else s
        )
    out = series.astype(str).str.strip()
    if config.get("empty_to_null"):
        out = out.replace("", None).replace("nan", None)
    if "default_value" in config and config["default_value"] is not None:
        out = out.fillna(config["default_value"])
    return out


def _apply_type_cast(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """target_type: date, timestamp, integer, bigint, numeric, text, boolean. on_error: null | zero | keep. date_formats 리스트 지원. empty(NA/빈문자열/nan 문자열)는 항상 None 처리."""
    target = (config.get("target_type") or "text").strip().lower()
    if "timestamp" in target:
        target = "timestamp"
    elif "time" in target and "text" not in target:
        target = "timestamp"
    elif target in ("serial", "bigserial", "int4", "int8", "mediumint", "tinyint", "smallint", "integer", "int"):
        target = "bigint"
    elif target in ("decimal", "real", "double precision", "float", "number"):
        target = "numeric"
    elif target in ("bool",):
        target = "boolean"
    elif target in ("varchar", "character varying", "character", "char", "nvarchar", "clob", "nclob", "varchar2", "nvarchar2"):
        target = "text"
    on_error = (config.get("on_error") or "null").strip().lower()
    date_fmts = config.get("date_formats")
    if not date_fmts:
        date_fmt = config.get("date_format") or "%Y-%m-%d"
        date_fmts = [date_fmt]

    empty = series.isna() | (series.astype(str).str.strip() == "") | (series.astype(str).str.lower() == "nan")

    def _fallback(val, on_err: str):
        if on_err == "null":
            return None
        if on_err == "zero":
            if target in ("integer", "bigint", "numeric"):
                return 0.0 if target == "numeric" else 0
            if target in ("date", "timestamp"):
                return None
            return "" if target == "text" else val
        return val  # keep

    if target in ("integer", "bigint"):
        converted = pd.to_numeric(series, errors="coerce")
        failed = ~empty & converted.isna()
        for idx in series.index[failed]:
            converted.at[idx] = _fallback(series.at[idx], on_error)
        out = converted.where(~empty, None)
        if target in ("integer", "bigint") and on_error != "keep":
            try:
                out = out.astype("Int64")
            except (TypeError, ValueError):
                pass
        return out
    if target == "numeric":
        converted = pd.to_numeric(series, errors="coerce")
        failed = ~empty & converted.isna()
        for idx in series.index[failed]:
            converted.at[idx] = _fallback(series.at[idx], on_error)
        return converted.where(~empty, None)
    if target == "timestamp":
        converted = pd.to_datetime(series, errors="coerce")
        failed = ~empty & converted.isna()
        for idx in series.index[failed]:
            converted.at[idx] = _fallback(series.at[idx], on_error)
        return converted.where(~empty, None)

    if target == "boolean":
        true_vals = set(config.get("true_values") or ["Y", "yes", "1", "TRUE", "true", "참", "T"])
        false_vals = set(config.get("false_values") or ["N", "no", "0", "FALSE", "false", "거짓", "F"])
        stripped = series.astype(str).str.strip()
        result = pd.Series([None] * len(series), index=series.index, dtype=object)
        result.loc[stripped.isin(true_vals)] = True
        result.loc[stripped.isin(false_vals)] = False
        not_matched = ~empty & result.isna()
        for idx in series.index[not_matched]:
            result.at[idx] = _fallback(series.at[idx], on_error)
        return result.where(~empty, None)

    if target == "date":
        converted = pd.Series([None] * len(series), index=series.index, dtype=object)
        for fmt in date_fmts:
            still_none = converted.isna() & ~empty
            if not still_none.any():
                break
            sub = series[still_none]
            _dt = pd.to_datetime(sub, format=fmt, errors="coerce")
            success = _dt.notna()
            for idx in _dt.index[success]:
                v = _dt.at[idx]
                converted.at[idx] = v.date() if hasattr(v, "date") else v
        still_failed = ~empty & converted.isna()
        for idx in series.index[still_failed]:
            converted.at[idx] = _fallback(series.at[idx], on_error)
        return converted.where(~empty, None)

    def try_convert(val):
        if pd.isna(val) or val == "":
            return None
        try:
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
    date_formats 리스트 지원. boolean 지원.
    """
    target = (config.get("target_type") or "text").strip().lower()
    if "timestamp" in target:
        target = "timestamp"
    elif "time" in target and "text" not in target:
        target = "timestamp"
    elif target in ("serial", "bigserial", "int4", "int8", "mediumint", "tinyint", "smallint", "integer", "int"):
        target = "bigint"
    elif target in ("decimal", "real", "double precision", "float", "number"):
        target = "numeric"
    elif target in ("bool",):
        target = "boolean"
    elif target in ("varchar", "character varying", "character", "char", "nvarchar", "clob", "nclob", "varchar2", "nvarchar2"):
        target = "text"
    on_error = (config.get("on_error") or "null").strip().lower()
    date_fmts = config.get("date_formats") or [config.get("date_format") or "%Y-%m-%d"]
    failed_mask = pd.Series(False, index=series.index)

    # 원본이 비어있으면 None (변환 시도하지 않음)
    empty = series.isna() | (series.astype(str).str.strip() == "") | (series.astype(str).str.lower() == "nan")

    if target == "text":
        out = series.astype(str).str.strip()
        out = out.where(~empty, None)
        return out, failed_mask

    if target == "boolean":
        true_vals = set(config.get("true_values") or ["Y", "yes", "1", "TRUE", "true", "참", "T"])
        false_vals = set(config.get("false_values") or ["N", "no", "0", "FALSE", "false", "거짓", "F"])
        stripped = series.astype(str).str.strip()
        converted = pd.Series([pd.NA] * len(series), index=series.index, dtype=object)
        converted.loc[stripped.isin(true_vals)] = True
        converted.loc[stripped.isin(false_vals)] = False
        failed = ~empty & converted.isna()
        if failed.any() and on_error == "fail":
            first_fail_idx = failed.idxmax()
            raise ValueError(
                f"행 변환 실패 (인덱스 {first_fail_idx}, 값: {series.at[first_fail_idx]!r})"
            ) from None
        for idx in series.index[failed]:
            if on_error == "skip_row":
                failed_mask.at[idx] = True
        out = converted.where(~empty, None)
        for idx in series.index[failed]:
            if on_error == "null":
                out.at[idx] = None
            elif on_error == "keep":
                out.at[idx] = series.at[idx]
        return out, failed_mask

    # 1차: 벡터 변환 (errors='coerce')
    if target in ("integer", "bigint"):
        converted = pd.to_numeric(series, errors="coerce")
    elif target == "numeric":
        converted = pd.to_numeric(series, errors="coerce")
    elif target == "timestamp":
        converted = pd.to_datetime(series, errors="coerce")
    elif target == "date":
        converted = pd.Series([pd.NA] * len(series), index=series.index)
        for fmt in date_fmts:
            still_none = converted.isna()
            if not still_none.any():
                break
            sub = series[still_none]
            _dt = pd.to_datetime(sub, format=fmt, errors="coerce")
            success_mask = _dt.notna()
            for idx in _dt.index[success_mask]:
                v = _dt.at[idx]
                converted.at[idx] = v.date() if hasattr(v, "date") else v
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


# 1.
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
        if pg_type in ("INTEGER", "INT", "BIGINT", "SMALLINT", "SERIAL", "BIGSERIAL", "INT4", "INT8", "MEDIUMINT", "TINYINT"):
            target = "bigint"
        elif pg_type in ("NUMERIC", "DECIMAL", "REAL", "DOUBLE PRECISION", "FLOAT", "NUMBER", "BINARY_FLOAT", "BINARY_DOUBLE"):
            target = "numeric"
        elif pg_type in ("DATE",):
            target = "date"
        elif pg_type in ("TIMESTAMP", "TIMESTAMPTZ", "TIME", "TIMETZ", "DATETIME", "YEAR", "INTERVAL"):
            target = "timestamp"
        elif "TIMESTAMP" in pg_type:
            target = "timestamp"
        elif "TIME" in pg_type and "TEXT" not in pg_type:
            target = "timestamp"
        elif pg_type in ("BOOLEAN", "BOOL"):
            target = "boolean"
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


def _apply_string_transform(
    series: pd.Series, config: Dict[str, Any], df: Optional[pd.DataFrame] = None
) -> pd.Series:
    """
    operation: uppercase, lowercase, pad_left, pad_right, substring, replace, regex_replace, concat.
    알 수 없는 operation이면 series 그대로 반환.
    """
    op = (config.get("operation") or "").strip().lower()
    s = series.astype(str)
    if op == "uppercase":
        return s.str.upper()
    if op == "lowercase":
        return s.str.lower()
    if op == "pad_left":
        width = int(config.get("width", 10))
        fill_char = config.get("fill_char", "0")
        return s.str.pad(width, side="left", fillchar=fill_char)
    if op == "pad_right":
        width = int(config.get("width", 10))
        fill_char = config.get("fill_char", " ")
        return s.str.pad(width, side="right", fillchar=fill_char)
    if op == "substring":
        start = int(config.get("start", 0))
        length = config.get("length")
        if length is not None:
            end = start + int(length)
            return s.str[start:end]
        return s.str[start:]
    if op == "replace":
        old = config.get("old", "")
        new = config.get("new", "")
        return s.str.replace(old, new, regex=False)
    if op == "regex_replace":
        pattern = config.get("pattern", "")
        replacement = config.get("replacement", "")
        return s.str.replace(pattern, replacement, regex=True)
    if op == "concat" and df is not None:
        columns = config.get("columns") or []
        separator = config.get("separator", "")
        if not columns:
            return series
        parts = [df[c].astype(str).fillna("") for c in columns if c in df.columns]
        if not parts:
            return series
        return parts[0].str.cat(parts[1:], sep=separator)
    return series


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
    """type/operation: right_n→mask_right, left_n→mask_left, email_domain→mask_email, mask_phone, mask_name."""
    _LEGACY_MASK_MAP = {"right_n": "mask_right", "left_n": "mask_left", "email_domain": "mask_email"}
    op = config.get("operation") or config.get("type", "right_n")
    op = (op or "right_n").strip().lower()
    op = _LEGACY_MASK_MAP.get(op, op)
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

    def mask_phone(s):
        if pd.isna(s) or not str(s).strip():
            return s
        s = str(s).strip()
        m = re.match(r"^(\d{2,4})-(\d{3,4})-(\d{4})$", s)
        if m:
            return f"{m.group(1)}-{char * len(m.group(2))}-{m.group(3)}"
        digits = re.sub(r"\D", "", s)
        if len(digits) >= 9:
            prefix_len = 3 if digits.startswith("01") else 2
            suffix_len = 4
            mid_len = len(digits) - prefix_len - suffix_len
            return digits[:prefix_len] + char * mid_len + digits[-suffix_len:]
        return s

    def mask_name(s):
        if pd.isna(s) or not str(s).strip():
            return s
        s = str(s).strip()
        if len(s) <= 1:
            return "*"
        if len(s) == 2:
            return s[0] + "*"
        return s[0] + char * (len(s) - 2) + s[-1]

    if op == "mask_right":
        return series.map(mask_right)
    if op == "mask_left":
        return series.map(mask_left)
    if op == "mask_email":
        return series.map(mask_email_domain)
    if op == "mask_phone":
        return series.map(mask_phone)
    if op == "mask_name":
        return series.map(mask_name)
    if op == "hash":
        algo = (config.get("algorithm") or "sha256").strip().lower()
        _hash_cls = getattr(hashlib, algo, None)
        if _hash_cls is not None and callable(_hash_cls):

            def do_hash(s):
                if pd.isna(s) or (isinstance(s, str) and not s.strip()):
                    return None
                return _hash_cls(str(s).encode("utf-8")).hexdigest()
        else:

            def do_hash(s):
                if pd.isna(s) or (isinstance(s, str) and not s.strip()):
                    return None
                try:
                    return hashlib.new(algo, str(s).encode("utf-8")).hexdigest()
                except Exception:
                    return s
        return series.map(do_hash)
    if op == "redact":
        redact_char = config.get("char") or "*"
        return series.map(lambda s: redact_char * min(len(str(s)), 32) if pd.notna(s) and str(s).strip() else s)
    return series.map(mask_right)


def _apply_datetime_transform(
    series: pd.Series, config: Dict[str, Any], df: Optional[pd.DataFrame] = None
) -> pd.Series:
    """
    operation: date_format, extract, date_diff, age, date_add, date_subtract, timezone_convert.
    dt는 date_format이 아닐 때만 계산(성능).
    """
    from datetime import date as date_type
    op = (config.get("operation") or "").strip().lower()
    if op == "date_format":
        in_fmt = config.get("input_format", "%Y-%m-%d")
        out_fmt = config.get("output_format", "%Y/%m/%d")
        try:
            parsed = pd.to_datetime(series, format=in_fmt, errors="coerce")
            return parsed.dt.strftime(out_fmt)
        except Exception:
            return series.astype(str)
    dt = pd.to_datetime(series, errors="coerce")
    if op == "extract":
        part = (config.get("part") or "year").strip().lower()
        if part == "weekday":
            return dt.dt.weekday
        if part in ("year", "month", "day", "hour", "quarter") and hasattr(dt.dt, part):
            return getattr(dt.dt, part)
        return dt.dt.year
    if op == "date_diff" and df is not None:
        other_col = config.get("other_column")
        if not other_col or other_col not in df.columns:
            return series
        unit = (config.get("unit") or "days").strip().lower()
        dt2 = pd.to_datetime(df[other_col], errors="coerce")
        delta = dt - dt2
        if unit == "years":
            return (delta.dt.days / 365.25).astype("Int64")
        return delta.dt.days.astype("Int64")
    if op == "age":
        today = date_type.today()
        def age_at(x):
            if pd.isna(x):
                return None
            try:
                d = x.date() if hasattr(x, "date") else x
                return today.year - d.year - ((today.month, today.day) < (d.month, d.day))
            except Exception:
                return None
        return series.map(lambda x: age_at(pd.to_datetime(x, errors="coerce")) if pd.notna(x) else None)
    if op == "date_add":
        days = int(config.get("days") or 0)
        months = int(config.get("months") or 0)
        years = int(config.get("years") or 0)
        if days or months or years:
            return (dt + pd.DateOffset(days=days, months=months, years=years)).dt.strftime("%Y-%m-%d")
        return series
    if op == "date_subtract":
        days = int(config.get("days") or 0)
        months = int(config.get("months") or 0)
        years = int(config.get("years") or 0)
        if days or months or years:
            return (dt - pd.DateOffset(days=days, months=months, years=years)).dt.strftime("%Y-%m-%d")
        return series
    if op == "timezone_convert":
        source_tz_str = (config.get("source_timezone") or "").strip()
        target_tz_str = (config.get("target_timezone") or "").strip()
        if not source_tz_str or not target_tz_str:
            logger.warning("etl_transform timezone_convert missing_tz keep_source")
            return series
        if source_tz_str == target_tz_str:
            return series
        try:
            src_tz = _get_tz(source_tz_str)
            tgt_tz = _get_tz(target_tz_str)
        except Exception as e:
            logger.warning("etl_transform timezone_parse_fail %s_to_%s: %s", source_tz_str, target_tz_str, e)
            return series
        # 텍스트 날짜 파싱 성공률 검증: 50% 미만이면 원본 유지
        non_null_count = int(series.notna().sum())
        if non_null_count > 0:
            parsed_count = int(dt.notna().sum())
            if parsed_count < non_null_count * 0.5:
                logger.warning(
                    "etl_transform timezone_parse_low_rate pct=%.0f parsed=%s total=%s keep_source",
                    (parsed_count / non_null_count) * 100, parsed_count, non_null_count,
                )
                return series
        try:
            if dt.dt.tz is None:
                try:
                    localized = dt.dt.tz_localize(src_tz, ambiguous="NaT", nonexistent="NaT")
                except TypeError:
                    localized = dt.dt.tz_localize(src_tz)
            else:
                localized = dt.dt.tz_convert(src_tz)
            converted = localized.dt.tz_convert(tgt_tz)
            return converted.dt.tz_localize(None)
        except Exception as e:
            logger.warning("etl_transform timezone_convert_fail %s_to_%s keep_source: %s", source_tz_str, target_tz_str, e)
            return series
    return series


def _apply_range_map(series: pd.Series, config: Dict[str, Any]) -> pd.Series:
    """ranges: [{min, max, value}], default. pd.to_numeric 후 첫 매칭 value 반환(첫 번째 매칭 우선)."""
    ranges = config.get("ranges") or []
    default = config.get("default")
    num = pd.to_numeric(series, errors="coerce")
    result = pd.Series([default] * len(series), index=series.index)
    matched = pd.Series(False, index=series.index)
    for r in ranges:
        lo = r.get("min")
        hi = r.get("max")
        val = r.get("value")
        if lo is None and hi is None:
            continue
        mask = True
        if lo is not None:
            mask = mask & (num >= lo)
        if hi is not None:
            mask = mask & (num <= hi)
        to_apply = mask & ~matched
        result = result.where(~to_apply, val)
        matched = matched | mask
    return result


def _apply_conditional(series: pd.Series, config: Dict[str, Any], df: pd.DataFrame) -> pd.Series:
    """conditions: [{when: {column, operator, value}, then}], default. CASE WHEN 스타일(첫 번째 매칭 우선)."""
    conditions = config.get("conditions") or []
    default = config.get("default")
    result = pd.Series([default] * len(series), index=series.index)
    matched = pd.Series(False, index=series.index)
    for cond in conditions:
        when = cond.get("when") or {}
        col = when.get("column")
        op = (when.get("operator") or "==").strip().lower()
        val = when.get("value")
        then_val = cond.get("then")
        if not col or col not in df.columns:
            continue
        other = df[col]
        if op == "==":
            mask = other == val
        elif op == "!=":
            mask = other != val
        elif op == ">":
            mask = pd.to_numeric(other, errors="coerce") > val
        elif op == ">=":
            mask = pd.to_numeric(other, errors="coerce") >= val
        elif op == "<":
            mask = pd.to_numeric(other, errors="coerce") < val
        elif op == "<=":
            mask = pd.to_numeric(other, errors="coerce") <= val
        elif op == "in":
            mask = other.isin(val if isinstance(val, (list, tuple)) else [val])
        elif op == "not_in":
            mask = ~other.isin(val if isinstance(val, (list, tuple)) else [val])
        elif op == "is_null":
            mask = other.isna()
        elif op == "is_not_null":
            mask = ~other.isna()
        else:
            continue
        to_apply = mask & ~matched
        result = result.where(~to_apply, then_val)
        matched = matched | mask
    return result


def _apply_mapping(
    series: pd.Series, config: Dict[str, Any], df: Optional[pd.DataFrame] = None
) -> pd.Series:
    """operation: value_map(_apply_code_map), range_map, conditional."""
    op = (config.get("operation") or "value_map").strip().lower()
    if op == "value_map":
        return _apply_code_map(series, config)
    if op == "range_map":
        return _apply_range_map(series, config)
    if op == "conditional" and df is not None:
        return _apply_conditional(series, config, df)
    return series


def _apply_numeric_transform(
    series: pd.Series, config: Dict[str, Any], df: Optional[pd.DataFrame] = None
) -> pd.Series:
    """operation: round, arithmetic, bucket, clamp."""
    op = (config.get("operation") or "").strip().lower()
    num = pd.to_numeric(series, errors="coerce")
    if op == "round":
        decimals = int(config.get("decimals", 0))
        return num.round(decimals)
    if op == "arithmetic" and df is not None:
        operator = (config.get("operator") or "+").strip()
        if "value" in config:
            operand = config["value"]
        elif config.get("column") and config["column"] in df.columns:
            operand = pd.to_numeric(df[config["column"]], errors="coerce")
        else:
            return num
        if operator == "+":
            return num + operand
        if operator == "-":
            return num - operand
        if operator == "*":
            return num * operand
        if operator == "/":
            if hasattr(operand, "replace"):
                operand = operand.replace(0, pd.NA)
            elif operand == 0:
                return pd.Series([pd.NA] * len(num), index=num.index)
            return num / operand
        return num
    if op == "bucket":
        bins = config.get("bins") or []
        labels = config.get("labels") or []
        if len(bins) < 2 or len(labels) != len(bins) - 1:
            return num
        try:
            return pd.cut(num, bins=bins, labels=labels, include_lowest=True)
        except Exception:
            return num
    if op == "clamp":
        min_val = config.get("min")
        max_val = config.get("max")
        if min_val is not None or max_val is not None:
            return num.clip(lower=min_val, upper=max_val)
        return num
    return num


def _apply_row_transform(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """operation: filter(조건 만족 행만), deduplicate(지정 컬럼 기준 중복 제거)."""
    if df.empty:
        return df
    op = (config.get("operation") or "").strip().lower()
    if op == "filter":
        col = config.get("column")
        operator = (config.get("operator") or "==").strip().lower()
        val = config.get("value")
        if not col or col not in df.columns:
            return df
        other = df[col]
        if operator == "==":
            mask = other == val
        elif operator == "!=":
            mask = other != val
        elif operator in (">", ">=", "<", "<="):
            num = pd.to_numeric(other, errors="coerce")
            if operator == ">":
                mask = num > val
            elif operator == ">=":
                mask = num >= val
            elif operator == "<":
                mask = num < val
            else:
                mask = num <= val
        elif operator == "is_null":
            mask = other.isna()
        elif operator == "is_not_null":
            mask = ~other.isna()
        else:
            return df
        return df.loc[mask].reset_index(drop=True)
    if op == "deduplicate":
        subset = config.get("subset")
        keep = config.get("keep", "first")
        if subset and isinstance(subset, list):
            subset = [c for c in subset if c in df.columns]
        return df.drop_duplicates(subset=subset or None, keep=keep).reset_index(drop=True)
    return df


def _parse_config(rule_config: Any) -> Dict[str, Any]:
    """rule_config를 dict로 반환."""
    if isinstance(rule_config, dict):
        return rule_config
    if isinstance(rule_config, str):
        try:
            return json.loads(rule_config)
        except Exception:
            return {}
    return {}


# 컬럼 단위 변환 디스패치 (Phase 2). Phase 3: numeric, row(행 단위).
_COLUMN_TRANSFORMERS: Dict[str, Callable] = {
    "cleansing": _apply_cleansing,
    "type_cast": _apply_type_cast,
    "code_map": _apply_code_map,
    "mapping": _apply_mapping,
    "derived": _apply_derived,
    "masking": _apply_masking,
    "string": _apply_string_transform,
    "datetime": _apply_datetime_transform,
    "numeric": _apply_numeric_transform,
}
_NEEDS_DF: Dict[str, bool] = {
    k: "df" in inspect.signature(v).parameters for k, v in _COLUMN_TRANSFORMERS.items()
}
_ROW_TRANSFORMERS: Dict[str, Callable] = {
    "row": _apply_row_transform,
}
_LEGACY_CATEGORY_MAP = {"code_map": "mapping", "derived": "string"}


# 2.
def apply_rules(df: pd.DataFrame, rules: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    rules 순서대로 각 룰 적용. is_active=True인 것만.
    rule_category 우선, 없으면 rule_type. row는 행 단위(전체 df 변환).
    """
    if df.empty or not rules:
        return df
    out = df.copy()
    for r in rules:
        if not r.get("is_active", True):
            continue
        category = (r.get("rule_category") or r.get("rule_type") or "").strip().lower()
        category = _LEGACY_CATEGORY_MAP.get(category, category)
        config = _parse_config(r.get("rule_config"))
        if "operation" not in config or not config.get("operation"):
            config["operation"] = (r.get("operation") or "default").strip()
        elif r.get("operation") and str(r.get("operation")).strip() != "default":
            config["operation"] = r["operation"]
        if category in _ROW_TRANSFORMERS:
            try:
                out = _ROW_TRANSFORMERS[category](out, config)  # out 교체·인덱스 리셋됨
            except Exception as exc:
                logger.warning(
                    "etl_transform rule_fail rule_id=%s row_op=%s: %s",
                    r.get("rule_id"), config.get("operation", "default"), exc,
                )
            continue
        src = (r.get("source_column") or "").strip()
        tgt = (r.get("target_column") or src).strip()
        if not src or src not in out.columns:
            if src:
                logger.warning(
                    "etl_transform rule_skip_missing_source rule_id=%s source=%s cols=%s",
                    r.get("rule_id"), src, list(out.columns),
                )
            continue
        transformer = _COLUMN_TRANSFORMERS.get(category)
        if not transformer:
            continue
        try:
            if _NEEDS_DF.get(category, False):
                result = transformer(out[src], config, out)
            else:
                result = transformer(out[src], config)
            if category == "datetime" and result is not None and result.equals(out[src]):
                logger.warning(
                    "etl_transform rule_noop rule_id=%s cat=%s op=%s target=%s",
                    r.get("rule_id"), category, config.get("operation", "?"), tgt,
                )
            out[tgt] = result
        except Exception as exc:
            logger.warning(
                "etl_transform rule_fail rule_id=%s cat=%s op=%s target=%s: %s",
                r.get("rule_id"), category, config.get("operation", "default"), tgt, exc,
            )
    return out
