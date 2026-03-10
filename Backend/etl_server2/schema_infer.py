"""
Backend.etl_server2.schema_infer (파일 스키마 추론)
===================================================
CSV/Excel/Parquet 샘플 기반 컬럼명·타입 추론. 업로드 직후 스키마 표시 및 ETL 메타 등록 시 사용.

[Main Functions]
===========
- _dtype_to_inferred: pandas dtype → 문서/UI용 타입명(integer, float, boolean, datetime, text)
- infer_schema: file_path, file_type, max_rows → [{ name, inferred_type }, ...]

[Dependencies]
=========
- pandas, openpyxl(Excel), pyarrow(Parquet)
"""

import os
from typing import List

import pandas as pd


# pandas dtype -> 문서/UI용 타입명
def _dtype_to_inferred(dtype) -> str:
    if pd.api.types.is_integer_dtype(dtype):
        return "integer"
    if pd.api.types.is_float_dtype(dtype):
        return "float"
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"
    return "text"


def infer_schema(file_path: str, file_type: str, max_rows: int = 1000) -> List[dict]:
    """
    파일에서 컬럼명·타입 추론.
    :param file_path: 로컬 파일 경로
    :param file_type: 'csv' | 'excel' | 'parquet'
    :param max_rows: 샘플로 읽을 최대 행 수(대용량 시 제한)
    :return: [ { "name": str, "inferred_type": str }, ... ]
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

    ft = (file_type or "").strip().lower()
    if ft == "csv":
        from Backend.etl_server2 import csv_reader
        df, _, _ = csv_reader.read_csv_robust(file_path, nrows=max_rows)
    elif ft in ("excel", "xlsx", "xls"):
        df = pd.read_excel(file_path, nrows=max_rows)
    elif ft == "parquet":
        df = pd.read_parquet(file_path)
        if len(df) > max_rows:
            df = df.head(max_rows)
    else:
        raise ValueError(f"지원하지 않는 파일 유형입니다: {file_type}. csv, excel, parquet 중 하나를 사용하세요.")

    if df.empty:
        return [{"name": "column_1", "inferred_type": "text"}]

    columns = []
    for col in df.columns:
        name = str(col).strip() or "unnamed"
        dtype = df[col].dtype
        inferred = _dtype_to_inferred(dtype)
        columns.append({"name": name, "inferred_type": inferred})
    return columns
