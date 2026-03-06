"""
transform_upsert_verification (ETL2 transform→upsert 검증)
=========================================================
transform_engine 출력 + apply_mapping_type_cast 결과가 load_dataframe/_batch_upsert와
호환되는지 검증. 컬럼 집합, pandas dtype→Python 직렬화→psycopg2 수용 타입,
그리고 _get_table_column_types 캐스트 맵이 필요한 PG 타입을 모두 커버하는지 확인.

[Main Functions]
===========
- get_expected_pg_cast_for_series: Series dtype → PG 캐스트명
- verify_transform_output_columns: DataFrame 컬럼·dtype 검증, 에러 문자열 목록 반환
- run_dry_run_pipeline: apply_rules → apply_mapping_type_cast 드라이런, 검증 결과·dtype_map 반환

[Dependencies]
=========
- pandas
- Backend.etl_server2.transform_engine (apply_rules, apply_mapping_type_cast)
"""

from typing import Any, Dict, List, Optional

import pandas as pd


# load_service_file._get_table_column_types에서 사용하는 PG 캐스트명과 동일하게 유지
PANDAS_DTYPE_TO_PG_CAST: Dict[str, str] = {
    "int64": "bigint",
    "Int64": "bigint",
    "int32": "integer",
    "Int32": "integer",
    "int16": "smallint",
    "Int16": "smallint",
    "float64": "double precision",
    "float32": "real",
    "bool": "boolean",
    "boolean": "boolean",
    "datetime64[ns]": "timestamp",
    "datetime64[ns, UTC]": "timestamptz",
    "datetime64[ns, Asia/Seoul]": "timestamptz",
    "object": "text",
    "string": "text",
    "category": "text",
    "timedelta64[ns]": "interval",
}


def get_expected_pg_cast_for_series(series: pd.Series) -> str:
    """
    pandas Series의 dtype에 대응하는 PostgreSQL 캐스트명 반환.
    PANDAS_DTYPE_TO_PG_CAST에 없으면 "text" 반환.
    """
    if series is None or len(series) == 0:
        return "text"
    name = str(series.dtype)
    return PANDAS_DTYPE_TO_PG_CAST.get(name, "text")


def verify_transform_output_columns(
    df: pd.DataFrame,
    target_columns: Optional[List[str]] = None,
) -> List[str]:
    """
    transform 출력 DataFrame이 load_dataframe/_batch_upsert와 호환되는지 검증.
    반환: 에러 메시지 목록 (비어 있으면 OK).
    - 중복 컬럼 없음
    - target_columns가 주어지면 df.columns가 해당 컬럼을 모두 포함
    - 각 컬럼 dtype이 PANDAS_DTYPE_TO_PG_CAST 또는 object(→text)로 처리 가능
    """
    errors: List[str] = []
    if df is None:
        errors.append("DataFrame is None")
        return errors
    if df.columns.duplicated().any():
        errors.append("DataFrame has duplicate column names")
    cols = list(df.columns)
    if target_columns is not None:
        for c in target_columns:
            if c not in cols:
                errors.append(f"Missing target column: {c}")
    for col in cols:
        dtype_name = str(df[col].dtype)
        if dtype_name not in PANDAS_DTYPE_TO_PG_CAST and dtype_name != "object":
            # datetime64[ns, TZ] 변형은 timestamptz로 처리 가능
            if "datetime64" in dtype_name:
                pass
            elif "timedelta" in dtype_name:
                pass
            else:
                errors.append(f"Column '{col}' has unhandled dtype: {dtype_name}")
    return errors


def run_dry_run_pipeline(
    sample_df: pd.DataFrame,
    rules: List[Dict[str, Any]],
    column_mapping: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    apply_rules → (선택) apply_mapping_type_cast 까지 드라이런.
    DB 접근 없음. 반환: {"df": result_df, "errors": [...], "dtype_map": {col: pg_cast_name}}.
    """
    from Backend.etl_server2 import transform_engine

    out = transform_engine.apply_rules(sample_df.copy(), rules)
    if column_mapping:
        out = transform_engine.apply_mapping_type_cast(out, column_mapping, default_on_error="null")
    errors = verify_transform_output_columns(out, target_columns=None)
    dtype_map = {col: get_expected_pg_cast_for_series(out[col]) for col in out.columns}
    return {"df": out, "errors": errors, "dtype_map": dtype_map}


if __name__ == "__main__":
    import importlib.util
    from pathlib import Path
    _dir = Path(__file__).resolve().parent
    _spec = importlib.util.spec_from_file_location("transform_engine", _dir / "transform_engine.py")
    _te = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_te)
    # Minimal dry run: small sample_df, one rule, one mapping (no Backend.etl_server2 package import)
    sample = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
    rules = [
        {
            "is_active": True,
            "rule_type": "string",
            "rule_config": '{"operation": "uppercase", "column": "b"}',
        }
    ]
    column_mapping = [
        {"source": "a", "target": "a", "type": "BIGINT"},
        {"source": "b", "target": "b", "type": "TEXT"},
    ]
    out = _te.apply_rules(sample.copy(), rules)
    out = _te.apply_mapping_type_cast(out, column_mapping, default_on_error="null")
    errors = verify_transform_output_columns(out)
    dtype_map = {col: get_expected_pg_cast_for_series(out[col]) for col in out.columns}
    if errors:
        print("Errors:", errors)
    else:
        print("OK")
    print("dtype_map:", dtype_map)
