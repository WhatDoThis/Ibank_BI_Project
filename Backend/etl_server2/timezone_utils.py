"""
Backend.etl_server2.timezone_utils (ETL 시간대 변환 유틸리티)
============================================================
ETL 시간대 변환 유틸리티.
소스 DB와 타겟 DB의 시간대가 다를 때 date/timestamp 컬럼을 변환.
소스 TZ == 타겟 TZ이면 아무것도 하지 않음 (성능·안전).

[Functions]
===========
- needs_conversion(source_tz, target_tz): 변환 필요 여부
- convert_timezone_columns(df, columns_meta, source_tz, target_tz): DataFrame의 시간 컬럼 일괄 변환
- convert_single_datetime(dt, from_tz, to_tz): 단일 datetime 변환 (last_synced_at용)

[Dependencies]
=========
- pandas, pytz (또는 zoneinfo)
"""

import logging
from datetime import datetime
from typing import List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# pytz 우선, 없으면 zoneinfo 사용
try:
    import pytz
    def _get_tz(name: str):
        return pytz.timezone(name)
    def _localize(dt, tz):
        if dt.tzinfo is None:
            return tz.localize(dt, is_dst=None)
        return dt.astimezone(tz)
    def _localize_series(series, tz):
        return series.dt.tz_localize(tz, ambiguous="NaT", nonexistent="NaT")
except ImportError:
    from zoneinfo import ZoneInfo
    def _get_tz(name: str):
        return ZoneInfo(name)
    def _localize(dt, tz):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=tz)
        return dt.astimezone(tz)
    def _localize_series(series, tz):
        return series.dt.tz_localize(tz)


_TEMPORAL_KEYWORDS = ("date", "time", "timestamp", "interval", "year")


def _is_temporal_type(data_type: str) -> bool:
    """DB data_type 문자열이 날짜/시간 관련인지 판별."""
    t = (data_type or "").strip().lower()
    return any(kw in t for kw in _TEMPORAL_KEYWORDS)


def needs_conversion(source_tz: Optional[str], target_tz: Optional[str]) -> bool:
    """소스와 타겟 시간대가 다른지 확인. None이면 Asia/Seoul로 간주."""
    s = (source_tz or "Asia/Seoul").strip()
    t = (target_tz or "Asia/Seoul").strip()
    return s != t


def convert_timezone_columns(
    df: pd.DataFrame,
    columns_meta: List[dict],
    source_tz: str,
    target_tz: str,
) -> pd.DataFrame:
    """
    DataFrame에서 date/timestamp 타입 컬럼만 찾아 source_tz → target_tz 변환.

    Parameters:
        df: 변환할 DataFrame
        columns_meta: [{"column_name": str, "data_type": str}, ...] 소스 컬럼 메타 정보
        source_tz: 소스 DB 시간대 (IANA). 예: "UTC", "Asia/Seoul"
        target_tz: 타겟 DB 시간대 (IANA)

    Returns:
        변환된 DataFrame (in-place 아님, 새 df 반환)

    주의:
    - source_tz == target_tz이면 그대로 반환 (호출부에서 needs_conversion 체크하지만 방어)
    - tz-naive datetime은 source_tz로 localize → target_tz로 convert → naive로 strip
    - DST 전환 시점의 ambiguous/nonexistent 값은 NaT 처리됨 (한국/일본/중국 등 DST 없는 TZ는 해당 없음)
    - 텍스트 날짜 컬럼은 변환하지 않음 (별도 transform_rule로 처리해야 함)
    """
    s = (source_tz or "Asia/Seoul").strip()
    t = (target_tz or "Asia/Seoul").strip()
    if s == t:
        return df

    src = _get_tz(s)
    tgt = _get_tz(t)

    # columns_meta에서 시간 타입인 컬럼명 집합 구성
    date_columns = set()
    for c in columns_meta:
        col_name = (c.get("column_name") or "").strip()
        data_type = c.get("data_type") or ""
        if col_name and _is_temporal_type(data_type):
            date_columns.add(col_name)

    if not date_columns:
        return df

    df = df.copy()
    converted_count = 0

    for col in df.columns:
        if col not in date_columns:
            continue

        try:
            # object/string → datetime 파싱 시도
            if not pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = pd.to_datetime(df[col], errors="coerce")

            # 전부 NaT이면 스킵
            if df[col].isna().all():
                continue

            series = df[col].copy()

            # tz-aware면 바로 convert, tz-naive면 localize 먼저
            if series.dt.tz is None:
                series = _localize_series(series, src)

            series = series.dt.tz_convert(tgt)
            df[col] = series.dt.tz_localize(None)  # naive로 strip (타겟 DB가 timestamp without tz인 경우 대비)
            converted_count += 1

        except Exception as e:
            logger.warning(
                "timezone_utils: 컬럼 '%s' 시간대 변환 실패 (%s → %s): %s. 원본 유지.",
                col, s, t, e,
            )
            # 변환 실패 시 원본 유지 (데이터 유실 방지)
            continue

    if converted_count > 0:
        logger.info(
            "timezone_utils: %s개 컬럼 시간대 변환 완료 (%s → %s)",
            converted_count, s, t,
        )

    return df


def convert_single_datetime(
    dt: datetime,
    from_tz: str,
    to_tz: str,
) -> datetime:
    """
    단일 datetime 값을 from_tz → to_tz로 변환.
    last_synced_at을 소스 DB 시간대로 변환할 때 사용.

    Parameters:
        dt: 변환할 datetime (naive 또는 aware)
        from_tz: 현재 시간대 (IANA)
        to_tz: 변환할 시간대 (IANA)

    Returns:
        변환된 naive datetime
    """
    f = (from_tz or "Asia/Seoul").strip()
    t = (to_tz or "Asia/Seoul").strip()
    if f == t:
        return dt
    if dt is None:
        return dt

    src = _get_tz(f)
    tgt = _get_tz(t)
    localized = _localize(dt, src)
    converted = localized.astimezone(tgt)
    return converted.replace(tzinfo=None)
