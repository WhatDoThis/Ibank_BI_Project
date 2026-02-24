"""
Backend.etl_server.etl_limits (ETL 한도 설정)
=============================================
config.backend.etl_limits 에서 최대 파일 크기·행 수·배치 크기 한도 조회. 없으면 기본값 사용.
램 오버 방지용: 파일 업로드/DB 적재 시 해당 한도로 잘라서 처리.

[Functions]
===========
22 - get_etl_limits: (max_file_size_mb, max_rows_per_load, max_batch_size) 반환. 0이면 해당 한도 미적용.

[Dependencies]
=========
- Env.config (backend.etl_limits)
"""

# 기본값: 한도 미설정 시 사용. 0이면 "한도 없음"으로 동작하도록 함.
DEFAULT_MAX_FILE_SIZE_MB = 0
DEFAULT_MAX_ROWS_PER_LOAD = 0
DEFAULT_MAX_BATCH_SIZE = 0


def get_etl_limits():
    """
    config.backend.etl_limits 에서 ETL 한도 조회.
    반환: (max_file_size_mb, max_rows_per_load, max_batch_size). 각 0 또는 양수.
    - max_file_size_mb: 파일 적재 시 파일 크기 상한(MB). 초과 시 거부. 0이면 검사 안 함.
    - max_rows_per_load: 1회 적재당 최대 행 수. 초과 분은 잘라서 처리 또는 거부. 0이면 무제한.
    - max_batch_size: DB 적재 시 배치당 최대 행 수(사용자 batch_size 상한). 0이면 사용자 설정 그대로.
    """
    try:
        from Env import config
        backend = getattr(config, "backend", None)
        if backend is None:
            return (DEFAULT_MAX_FILE_SIZE_MB, DEFAULT_MAX_ROWS_PER_LOAD, DEFAULT_MAX_BATCH_SIZE)
        limits = getattr(backend, "etl_limits", None)
        if limits is None:
            return (DEFAULT_MAX_FILE_SIZE_MB, DEFAULT_MAX_ROWS_PER_LOAD, DEFAULT_MAX_BATCH_SIZE)
        max_file = getattr(limits, "max_file_size_mb", DEFAULT_MAX_FILE_SIZE_MB)
        max_rows = getattr(limits, "max_rows_per_load", DEFAULT_MAX_ROWS_PER_LOAD)
        max_batch = getattr(limits, "max_batch_size", DEFAULT_MAX_BATCH_SIZE)
        try:
            max_file = int(max_file) if max_file is not None else 0
            max_file = max(0, max_file)
        except (TypeError, ValueError):
            max_file = 0
        try:
            max_rows = int(max_rows) if max_rows is not None else 0
            max_rows = max(0, max_rows)
        except (TypeError, ValueError):
            max_rows = 0
        try:
            max_batch = int(max_batch) if max_batch is not None else 0
            max_batch = max(0, max_batch)
        except (TypeError, ValueError):
            max_batch = 0
        return (max_file, max_rows, max_batch)
    except Exception:
        return (DEFAULT_MAX_FILE_SIZE_MB, DEFAULT_MAX_ROWS_PER_LOAD, DEFAULT_MAX_BATCH_SIZE)
