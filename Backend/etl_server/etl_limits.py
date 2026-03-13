"""
Backend.etl_server.etl_limits (ETL 한도 설정)
=============================================
config.backend.etl_limits 에서 최대 파일 크기·행 수·배치 크기 한도 조회. 없으면 기본값 사용.
램 오버 방지용: 파일 업로드/DB 적재 시 해당 한도로 잘라서 처리.

[기본값 권장 근거 (일반적 서버 4~8GB 메모리 가정)]
- max_file_size_mb: 웹/ETL 파일 업로드 상한. PHP 128MB, Apache 50~100MB 등 사례 참고. 100MB면 CSV/Excel 대부분 수용.
- max_rows_per_load: 1회 적재 Job 전체 행 상한. SSIS 1만 행/버퍼, Oracle 2~3만/배치 권장. 50만 건이면 스트리밍으로 나눠 처리 시 메모리 안전.
- max_batch_size: DB fetch/적재 배치당 상한. PostgreSQL 500~1000, Oracle JDBC 100~500, SSIS 1만 행. 1만 건이면 MySQL net_write_timeout·Oracle 메모리와 양립.

config에 etl_limits를 넣으면 이 기본값 대신 config 값 사용. 0이면 "한도 없음"으로 동작.

[Main Functions]
===========
1. _safe_int: config 값 정수 변환 헬퍼 (None/비숫자 시 default, 음수는 0으로 보정).
2. get_etl_limits: (max_file_size_mb, max_rows_per_load, max_batch_size) 반환. 0이면 해당 한도 미적용.
3. get_max_zip_extract_total_mb: ZIP 압축 해제 총 용량 상한(MB). config에 없으면 2048(2GB).

[Dependencies]
=========
- Env.config (backend.etl_limits)
"""

# 기본값: config에 etl_limits가 없을 때 적용. 일반적 서버 사양 기준 권장치.
DEFAULT_MAX_FILE_SIZE_MB = 50
DEFAULT_MAX_ROWS_PER_LOAD = 100000
DEFAULT_MAX_BATCH_SIZE = 50000
# ZIP 압축 해제 시 총 용량 상한(MB). ZIP bomb 방지. 2GB 기본.
DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB = 2048


# 1.
def _safe_int(val, default: int) -> int:
    """config 값 정수 변환. None/비숫자 시 default 반환. 음수는 0으로 보정."""
    try:
        return max(0, int(val)) if val is not None else default
    except (TypeError, ValueError):
        return default


# 2.
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
        max_file = _safe_int(max_file, 0)
        max_rows = _safe_int(max_rows, 0)
        max_batch = _safe_int(max_batch, 0)
        return (max_file, max_rows, max_batch)
    except Exception:
        return (DEFAULT_MAX_FILE_SIZE_MB, DEFAULT_MAX_ROWS_PER_LOAD, DEFAULT_MAX_BATCH_SIZE)


# 3.
def get_max_zip_extract_total_mb() -> int:
    """
    config.backend.etl_limits.max_zip_extract_total_mb 조회.
    ZIP 압축 해제 전 총 용량(압축 해제 크기) 상한(MB). 초과 시 extractall 거부(ZIP bomb 방지).
    없으면 DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB(2048 = 2GB) 반환.
    """
    try:
        from Env import config
        backend = getattr(config, "backend", None)
        if backend is None:
            return DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB
        limits = getattr(backend, "etl_limits", None)
        if limits is None:
            return DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB
        val = getattr(limits, "max_zip_extract_total_mb", DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB)
        return _safe_int(val, DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB)
    except Exception:
        return DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB
