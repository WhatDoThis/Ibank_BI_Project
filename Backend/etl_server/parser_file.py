"""
Backend.etl_server.parser_file (파일명 파싱·패턴 추출·파일 읽기)
===============================================================
09_ETL_SFTP_Connection §4.1, §4.3. 파일명 형식: {pattern}_ib_yyyyMMddHHmmss.확장자
파싱, 타임스탬프 검증, 대기 파일 목록·패턴별 집계. 로컬 파일 읽기(CSV/Excel/Parquet).

[Main Functions]
===========
- parse_filename: 단일 파일명에서 file_pattern 일치 시 timestamp, extension 반환 (미일치/무효날짜 시 None)
- get_pending_files: 전체 목록에서 패턴 매칭 파일만 타임스탬프 오름차순. 첫 실행(last_processed_ts 없음) 시 max_ts 이전 전부 반환(한 run에서 큐 처리). 이후는 last_processed_ts 기준 증분.
- extract_patterns_from_files: _ib_14자리 매칭 파일만 접두사별 그룹화 → pattern, file_count, latest_ts, oldest_ts, extensions
- read_file: 로컬 파일을 pandas DataFrame으로 읽기 (csv, xlsx, xls, parquet). max_rows 지원.

[Dependencies]
=========
- re, datetime, pandas, openpyxl, xlrd, pyarrow, Backend.etl_server.csv_reader (CSV 읽기)
"""

import re
from datetime import datetime
from typing import List, Optional, Tuple

import pandas as pd


def parse_filename(
    filename: str,
    file_pattern: str,
    extensions_str: str,
) -> Optional[dict]:
    """
    파일명이 {file_pattern}_ib_(14자리).(허용확장자) 형식인지 검사하고,
    타임스탬프 유효 시 {"timestamp": str, "extension": str} 반환. 아니면 None.

    - 14자리는 datetime.strptime(ts, "%Y%m%d%H%M%S")로 검증; 무효면 None.
    """
    if not filename or not extensions_str:
        return None
    ext_list = [e.strip().lower() for e in extensions_str.split(",") if e.strip()]
    if not ext_list:
        return None
    extensions_regex = "|".join(re.escape(e) for e in ext_list)
    pattern = rf"^{re.escape(file_pattern)}_ib_(\d{{14}})\.({extensions_regex})$"
    m = re.match(pattern, filename, re.IGNORECASE)
    if not m:
        return None
    ts_str, ext = m.group(1), m.group(2).lower()
    try:
        datetime.strptime(ts_str, "%Y%m%d%H%M%S")
    except ValueError:
        return None
    return {"timestamp": ts_str, "extension": ext}


def get_pending_files(
    all_files: List[str],
    file_pattern: str,
    extensions: str,
    last_processed_ts: Optional[str],
    max_ts: Optional[str] = None,
) -> List[Tuple[str, str]]:
    """
    all_files 중 file_pattern + _ib_ + 14자리 형식만 수집해 타임스탬프 오름차순 정렬.
    - last_processed_ts가 None이면 첫 실행: max_ts 이전의 매칭 파일 전부 반환(한 run에서 큐처럼 순차 처리).
    - 아니면 ts > last_processed_ts 이고 ts <= max_ts 인 파일만 반환.
    - last_processed_ts가 빈 문자열/공백이면 None으로 간주(동일 파일이 매 주기 pending에 포함되는 것 방지).
    - max_ts 미지정 시 현재 시각(미래 파일 제외).
    """
    # datetime 객체 또는 빈 문자열이면 14자리 문자열로 정규화 또는 None
    if last_processed_ts is not None:
        if hasattr(last_processed_ts, "strftime"):
            last_processed_ts = last_processed_ts.strftime("%Y%m%d%H%M%S")
        elif isinstance(last_processed_ts, str):
            last_processed_ts = last_processed_ts.strip() or None
        else:
            last_processed_ts = None
    if max_ts is None:
        max_ts = datetime.now().strftime("%Y%m%d%H%M%S")
    matched: List[Tuple[str, str]] = []
    for f in all_files:
        parsed = parse_filename(f, file_pattern, extensions)
        if parsed is None:
            continue
        matched.append((f, parsed["timestamp"]))
    matched.sort(key=lambda x: x[1])
    if last_processed_ts is None:
        return [(f, ts) for f, ts in matched if ts <= max_ts]
    return [(f, ts) for f, ts in matched if ts > last_processed_ts and ts <= max_ts]


def extract_patterns_from_files(
    file_list: List[str],
    extensions_str: str = "csv,xlsx,xls,parquet",
) -> List[dict]:
    """
    파일명이 .*_ib_\\d{14}.(허용확장자) 형식인 것만 대상으로,
    접두사(패턴)별로 그룹화해 file_count, latest_ts, oldest_ts, extensions 반환.
    반환 리스트는 pattern 이름 오름차순.
    """
    ext_list = [e.strip().lower() for e in extensions_str.split(",") if e.strip()]
    if not ext_list:
        return []
    extensions_regex = "|".join(re.escape(e) for e in ext_list)
    # prefix = anything before _ib_ ; then _ib_ + 14 digits + .ext
    pattern_re = re.compile(
        rf"^(.+)_ib_(\d{{14}})\.({extensions_regex})$",
        re.IGNORECASE,
    )
    by_pattern: dict = {}
    for name in file_list:
        if not name:
            continue
        m = pattern_re.match(name)
        if not m:
            continue
        prefix, ts_str, ext = m.group(1), m.group(2), m.group(3).lower()
        try:
            datetime.strptime(ts_str, "%Y%m%d%H%M%S")
        except ValueError:
            continue
        if prefix not in by_pattern:
            by_pattern[prefix] = {"timestamps": [], "extensions": set()}
        by_pattern[prefix]["timestamps"].append(ts_str)
        by_pattern[prefix]["extensions"].add(ext)
    out = []
    for pattern_name, data in sorted(by_pattern.items()):
        ts_list = data["timestamps"]
        out.append({
            "pattern": pattern_name,
            "file_count": len(ts_list),
            "latest_ts": max(ts_list),
            "oldest_ts": min(ts_list),
            "extensions": sorted(data["extensions"]),
        })
    return out


def read_file(
    local_path: str,
    extension: str,
    max_rows: Optional[int] = None,
) -> pd.DataFrame:
    """
    로컬 파일을 pandas DataFrame으로 읽기.
    - extension: csv, xlsx, xls, parquet 중 하나. 미지원 시 ValueError.
    - max_rows: 지정 시 해당 행 수까지만 읽기 (csv/excel은 nrows, parquet는 head).
    - CSV: csv_reader.read_csv_robust 사용(인코딩 자동 감지 또는 UTF-8/CP949 등 순차 시도).
    """
    import os

    if not os.path.isfile(local_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {local_path}")
    ext = (extension or "").strip().lower()
    if ext not in ("csv", "xlsx", "xls", "parquet"):
        raise ValueError(f"지원하지 않는 확장자: {extension}. csv, xlsx, xls, parquet 중 하나를 사용하세요.")

    nrows = int(max_rows) if max_rows is not None and max_rows > 0 else None

    if ext == "csv":
        from Backend.etl_server import csv_reader
        df, _encoding_used, _ = csv_reader.read_csv_robust(local_path, nrows=nrows)
        return df

    if ext in ("xlsx", "xls"):
        return pd.read_excel(local_path, nrows=nrows)

    if ext == "parquet":
        df = pd.read_parquet(local_path)
        if nrows is not None and len(df) > nrows:
            df = df.head(nrows)
        return df

    raise ValueError(f"지원하지 않는 확장자: {extension}")
