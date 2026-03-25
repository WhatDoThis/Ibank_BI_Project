"""
Backend.core.db (DB 연결 및 검증)
=================================
Env/config/config.json의 backend만 사용. FastAPI 라우터는 dependencies.get_db()로 연결 주입.
메인 DB·시스템 DB 분리. ETL 타겟 테이블은 get_table_columns_for_etl_target, get_primary_key_columns_for_etl_target로 allowed_tables 미검사 조회.

[Main Functions / Classes]
===========
1. _PooledConnection: 풀에서 빌린 연결 래퍼 (close 시 putconn)
2. get_db_config: config.backend에서 DB 연결용 dict 반환 (필수 키 없으면 ValueError)
3. get_system_db_config: config.backend.system_db에서 시스템 DB 연결용 dict 반환
4. get_system_table_schema: 시스템 DB의 table_schema (ETL 메타 등)
5. get_allowed_tables: 허용 테이블 목록 (allowed_tables)
6. get_table_schema: 테이블 스키마명 (table_schema)
7. _table_exists, _query_table_columns, _query_primary_key_columns: 내부 공통 SQL 헬퍼 (conn 인자로 커넥션 1회 사용)
8. get_table_columns: 테이블 컬럼명 목록 (information_schema, 허용 테이블만)
9. get_table_columns_with_types: 컬럼명·data_type 목록 (대시보드 필수 컬럼 검증용)
10. get_all_tables_columns_with_types: 복수 테이블 컬럼·타입 일괄 조회
11. get_primary_key_columns: 테이블 PK 컬럼명 목록 (허용 테이블만)
12. table_exists_in_schema: 테이블 스키마 내 존재 여부 (allowed_tables 미검사)
13. get_table_columns_for_etl_target: ETL 타겟 테이블 컬럼명 목록 (allowed_tables 미검사, 커넥션 1회)
14. get_primary_key_columns_for_etl_target: ETL 타겟 테이블 PK 목록 (allowed_tables 미검사, 커넥션 1회)
15. get_db_connection: 메인 DB 연결을 풀에서 반환 (최대 20연결, close 시 풀 반환). 풀 고갈 시 직접 연결 fallback.
16. get_db_connection_system: 시스템 DB 연결을 풀에서 반환. ETL 메타·세션 등용.
17. get_dash_db_config / get_dash_table_schema / get_db_connection_dash: 뉴 대시보드 전용 dash_db(ibank_dash_data 등) 연결
18. is_new_dash_physical_table: ibank_1·ibank_1_0~4·ibank_*_star_1|2 여부 (dash_db 집계·Star JSONB 테이블)
19. validate_dashboard_data_table_name: 대시보드 API용 테이블명 — 뉴 대시보드 물리 테이블이면 허용 목록 없이 검증, 그 외는 validate_table_name
20. format_value: JSON 직렬화용 값 포맷 (datetime/date/decimal 등)
21. validate_table_name: 허용 패턴·허용 테이블 검증
22. validate_column_name: 컬럼명 허용 패턴 검증

[Package Usage]
===========
1. _PooledConnection: Backend/core/db.py 내부(get_db_connection 등이 풀 연결 반환 시)
2. get_db_config: Backend/api_server/main.py, scripts/check_db_connections.py
3. get_system_db_config: scripts/check_db_connections.py
4. get_system_table_schema: Backend/etl_server(다수 모듈), scripts/check_db_connections.py
5. get_allowed_tables: Backend/api_server/main.py, Backend/report_server/router.py, Backend/core/dashboard_service.py
6. get_table_schema: Backend/report_server/router.py, analysis_store.py, Backend/etl_server/service.py(get_target_db_connection), scripts/create_I1_derived_tables.py, dump_four_tables_schema.py
7. _table_exists, _query_table_columns, _query_primary_key_columns: Backend/core/db.py 내부(다른 db 함수에서 호출)
8. get_table_columns: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
9. get_table_columns_with_types: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_all_tables_columns_with_types 등)
10. get_all_tables_columns_with_types: Backend/report_server/router.py
11. get_primary_key_columns: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
12. table_exists_in_schema: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
13. get_table_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
14. get_primary_key_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
15. get_db_connection: Backend/core/dependencies.py, Backend/report_server/router.py, analysis_store.py, scripts/*.py
16. get_db_connection_system: Backend/etl_server(광범위), Backend/etl_server/batch_executor_db.py, batch_executor_file.py, scripts/check_db_connections.py
17. get_dash_db_config: Backend/core/db.py 내부(get_db_connection_dash 풀·fallback). get_dash_table_schema·get_db_connection_dash: Backend/core/dashboard_service.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py
18. is_new_dash_physical_table: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_table_columns_with_types·validate_dashboard_data_table_name)
19. validate_dashboard_data_table_name: Backend/core/dashboard_service.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py
20. format_value: Backend/report_server/router.py
21. validate_table_name: Backend/report_server/router.py, Backend/core/dashboard_service.py
22. validate_column_name: Backend/report_server/router.py

[Dependencies]
=========
- Env (config.backend)
- psycopg2, psycopg2.extras.RealDictCursor
"""

import re
import threading
from datetime import datetime, date

import psycopg2
from psycopg2 import pool as psycopg2_pool
from psycopg2.extras import RealDictCursor

# 시스템/메인 DB 연결 풀: 동시 연결 수 제한으로 PostgreSQL max_connections 초과 방지
_SYSTEM_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_MAIN_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_DASH_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_POOL_MIN = 1
_POOL_MAX = 20
_system_pool_lock = threading.Lock()
_main_pool_lock = threading.Lock()
_dash_pool_lock = threading.Lock()

# 뉴 대시보드 물리 테이블: ibank_1(집계), ibank_1_0~ibank_1_4(서브), ibank_*_star_1|2(JSONB 집약). backend.dash_db.
_NEW_DASH_PHYSICAL_TABLE_RE = re.compile(r"^ibank_1(_[0-4])?$|^ibank_[a-z0-9_]+_star_[12]$")


# 1.
class _PooledConnection:
    """풀에서 빌린 연결. close() 시 실제 TCP 종료 대신 putconn()으로 풀에 반환. 기존 conn.close() 호출 패턴과 호환."""

    def __init__(self, pool: psycopg2_pool.ThreadedConnectionPool, conn):
        self._pool = pool
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def set_client_encoding(self, encoding):
        return self._conn.set_client_encoding(encoding)

    def close(self):
        if self._conn is not None:
            try:
                self._pool.putconn(self._conn)
            except Exception:
                pass
            self._conn = None

    def __getattr__(self, name):
        if name in ("_pool", "_conn"):
            raise AttributeError(name)
        if self._conn is None:
            raise AttributeError(name)
        return getattr(self._conn, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

try:
    from Env import config
except ImportError:
    import sys as _sys
    from pathlib import Path as _Path
    _project_root = _Path(__file__).resolve().parent.parent.parent
    if str(_project_root) not in _sys.path:
        _sys.path.insert(0, str(_project_root))
    from Env import config


# 2.
def get_db_config():
    """config.backend 에서만 DB 설정 읽기. 없거나 비어 있으면 ValueError."""
    backend = config.backend
    host = getattr(backend, 'db_host', None)
    port = getattr(backend, 'db_port', None)
    database = getattr(backend, 'db_name', None)
    user = getattr(backend, 'db_user', None)
    password = getattr(backend, 'db_password', None)

    if not host or not str(host).strip():
        raise ValueError('Env/config/config.json 에 backend.db_host 가 없거나 비어 있습니다.')
    if database is None or not str(database).strip():
        raise ValueError('Env/config/config.json 에 backend.db_name 이 없거나 비어 있습니다.')
    if not user or not str(user).strip():
        raise ValueError('Env/config/config.json 에 backend.db_user 가 없거나 비어 있습니다.')
    if port is None or port == '':
        raise ValueError('Env/config/config.json 에 backend.db_port 가 없습니다.')
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError('Env/config/config.json 의 backend.db_port 는 숫자여야 합니다.')

    return {
        'host': str(host).strip(),
        'port': port,
        'database': str(database).strip(),
        'user': str(user).strip(),
        'password': str(password).strip() if password is not None else '',
    }


# 3.
def get_system_db_config():
    """
    config.backend.system_db 에서 시스템 DB 연결 설정 읽기.
    시스템 관련 테이블(ETL 메타, 로그인·세션·프로젝트 등)용 DB(예: ibank_system_data).
    system_db 가 없으면 ValueError.
    """
    backend = config.backend
    sys_db = getattr(backend, 'system_db', None)
    if sys_db is None:
        raise ValueError(
            'Env/config/config.json 에 backend.system_db 가 없습니다. '
            '시스템 DB(ibank_system_data 등) 연결을 위해 system_db 를 추가하세요.'
        )
    host = getattr(sys_db, 'db_host', None)
    port = getattr(sys_db, 'db_port', None)
    database = getattr(sys_db, 'db_name', None)
    user = getattr(sys_db, 'db_user', None)
    password = getattr(sys_db, 'db_password', None)

    if not host or not str(host).strip():
        raise ValueError('backend.system_db.db_host 가 없거나 비어 있습니다.')
    if database is None or not str(database).strip():
        raise ValueError('backend.system_db.db_name 이 없거나 비어 있습니다.')
    if not user or not str(user).strip():
        raise ValueError('backend.system_db.db_user 가 없거나 비어 있습니다.')
    if port is None or port == '':
        raise ValueError('backend.system_db.db_port 가 없습니다.')
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError('backend.system_db.db_port 는 숫자여야 합니다.')

    return {
        'host': str(host).strip(),
        'port': port,
        'database': str(database).strip(),
        'user': str(user).strip(),
        'password': str(password).strip() if password is not None else '',
    }


# 3a.
def get_dash_db_config():
    """
    config.backend.dash_db 에서 뉴 대시보드 전용 DB 연결 설정 읽기.
    대시보드 물리 테이블(ibank_1, ibank_1_0~4, ibank_*_star_1|2) 적재 DB. 없으면 ValueError.
    """
    backend = config.backend
    dash = getattr(backend, "dash_db", None)
    if dash is None:
        raise ValueError(
            "Env/config/config.json 에 backend.dash_db 가 없습니다. "
            "뉴 대시보드용 DB(ibank_dash_data 등) 연결을 위해 dash_db 를 추가하세요."
        )
    host = getattr(dash, "db_host", None)
    port = getattr(dash, "db_port", None)
    database = getattr(dash, "db_name", None)
    user = getattr(dash, "db_user", None)
    password = getattr(dash, "db_password", None)

    if not host or not str(host).strip():
        raise ValueError("backend.dash_db.db_host 가 없거나 비어 있습니다.")
    if database is None or not str(database).strip():
        raise ValueError("backend.dash_db.db_name 이 없거나 비어 있습니다.")
    if not user or not str(user).strip():
        raise ValueError("backend.dash_db.db_user 가 없거나 비어 있습니다.")
    if port is None or port == "":
        raise ValueError("backend.dash_db.db_port 가 없습니다.")
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError("backend.dash_db.db_port 는 숫자여야 합니다.")

    return {
        "host": str(host).strip(),
        "port": port,
        "database": str(database).strip(),
        "user": str(user).strip(),
        "password": str(password).strip() if password is not None else "",
    }


# 3b.
def get_dash_table_schema():
    """dash_db 의 table_schema. backend.dash_db.table_schema 가 있으면 사용, 없으면 'public'."""
    dash = getattr(config.backend, "dash_db", None)
    if dash is None:
        return "public"
    return getattr(dash, "table_schema", None) or "public"


# 4.
def get_system_table_schema():
    """시스템 DB의 table_schema. backend.system_db.table_schema 가 있으면 사용, 없으면 'public'."""
    sys_db = getattr(config.backend, 'system_db', None)
    if sys_db is None:
        return 'public'
    return getattr(sys_db, 'table_schema', None) or 'public'


# 5.
def get_allowed_tables():
    """허용 테이블 목록. config.backend.allowed_tables 만 사용. 없으면 ValueError."""
    tables = getattr(config.backend, 'allowed_tables', None)
    if tables is None:
        raise ValueError('Env/config/config.json 에 backend.allowed_tables 가 없습니다.')
    if isinstance(tables, list):
        return set(tables)
    raise ValueError('Env/config/config.json 의 backend.allowed_tables 는 배열이어야 합니다.')


# 6.
def get_table_schema():
    """테이블 스키마. config.backend.table_schema 만 사용. 없으면 ValueError."""
    schema = getattr(config.backend, 'table_schema', None)
    if schema is None or not str(schema).strip():
        raise ValueError('Env/config/config.json 에 backend.table_schema 가 없거나 비어 있습니다.')
    return str(schema).strip()


# 7.
def _table_exists(conn, schema: str, table_name: str) -> bool:
    """내부: 동일 conn으로 테이블 존재 여부 조회. conn은 호출자가 열고 닫음."""
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = %s AND table_name = %s",
            (schema, table_name),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


# 8.
def _query_table_columns(conn, schema: str, table_name: str):
    """내부: information_schema에서 컬럼명 목록 조회. conn은 호출자가 열고 닫음."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name),
        )
        return [row["column_name"] for row in cur.fetchall()]
    finally:
        cur.close()


# 9.
def _query_primary_key_columns(conn, schema: str, table_name: str):
    """내부: information_schema에서 PK 컬럼명 목록 조회. conn은 호출자가 열고 닫음."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = %s AND tc.table_name = %s
            ORDER BY kcu.ordinal_position
            """,
            (schema, table_name),
        )
        return [row["column_name"] for row in cur.fetchall()]
    finally:
        cur.close()


# 10.
def get_table_columns(table_name):
    """테이블의 컬럼명 목록 반환 (information_schema 기준). 허용된 테이블만 조회 가능."""
    validate_table_name(table_name)
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        return _query_table_columns(conn, schema, table_name)
    finally:
        conn.close()


# 11.
def get_table_columns_with_types(table_name):
    """테이블의 컬럼명·데이터타입 목록 반환. [{ column_name, data_type }, ...]. 대시보드 필수 컬럼 타입 검증용."""
    if is_new_dash_physical_table(table_name):
        validate_dashboard_data_table_name(table_name)
        schema = get_dash_table_schema()
        conn = get_db_connection_dash()
    else:
        validate_table_name(table_name)
        schema = get_table_schema()
        conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name),
        )
        return [{"column_name": row["column_name"], "data_type": row["data_type"]} for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


# 12.
def get_all_tables_columns_with_types(table_names):
    """여러 테이블의 컬럼명·데이터타입을 한 번에 조회. { table_name: [{ column_name, data_type }, ...] }. 테이블 수가 많을 때 분석 부하 감소용."""
    allowed = get_allowed_tables()
    raw_names = [t for t in (table_names or []) if t in allowed]
    main_names = [t for t in raw_names if not is_new_dash_physical_table(t)]
    dash_names = [t for t in raw_names if is_new_dash_physical_table(t)]

    def _fetch_batch(schema, names, conn_getter):
        if not names:
            return {}
        conn = conn_getter()
        cur = conn.cursor()
        try:
            placeholders = ", ".join(["%s"] * len(names))
            cur.execute(
                """
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name IN (""" + placeholders + """)
                ORDER BY table_name, ordinal_position
                """,
                (schema,) + tuple(names),
            )
            out = {}
            for row in cur.fetchall():
                t = row["table_name"]
                if t not in out:
                    out[t] = []
                out[t].append({"column_name": row["column_name"], "data_type": row["data_type"]})
            for t in names:
                if t not in out:
                    out[t] = []
            return out
        finally:
            cur.close()
            conn.close()

    out = {}
    if main_names:
        out.update(_fetch_batch(get_table_schema(), main_names, get_db_connection))
    if dash_names:
        out.update(_fetch_batch(get_dash_table_schema(), dash_names, get_db_connection_dash))
    return out


# 13.
def get_primary_key_columns(table_name):
    """테이블의 PK 컬럼명 목록 반환 (information_schema). 허용된 테이블만. PK 없으면 []."""
    validate_table_name(table_name)
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        return _query_primary_key_columns(conn, schema, table_name)
    finally:
        conn.close()


# 14.
def table_exists_in_schema(table_name: str) -> bool:
    """메인 DB의 table_schema에 해당 table_name이 존재하는지 조회. allowed_tables 미검사(ETL 실행 전 타겟 존재 여부 확인용)."""
    if not table_name or not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        return False
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        return _table_exists(conn, schema, table_name)
    finally:
        conn.close()


# 15.
def get_table_columns_for_etl_target(table_name: str):
    """ETL 타겟 테이블의 컬럼명 목록 반환. allowed_tables 미검사(ETL로 생성된 테이블용). 테이블이 없으면 ValueError."""
    if not table_name or not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        raise ValueError(f"잘못된 테이블 이름: {table_name}")
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        if not _table_exists(conn, schema, table_name):
            raise ValueError(f"타겟 테이블이 메인 DB에 없습니다: {table_name}")
        return _query_table_columns(conn, schema, table_name)
    finally:
        conn.close()


# 16.
def get_primary_key_columns_for_etl_target(table_name: str):
    """ETL 타겟 테이블의 PK 컬럼명 목록 반환. allowed_tables 미검사. PK 없으면 []."""
    if not table_name or not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        raise ValueError(f"잘못된 테이블 이름: {table_name}")
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        if not _table_exists(conn, schema, table_name):
            raise ValueError(f"타겟 테이블이 메인 DB에 없습니다: {table_name}")
        return _query_primary_key_columns(conn, schema, table_name)
    finally:
        conn.close()


# 17.
def get_db_connection():
    """메인 DB 연결을 풀에서 반환. close() 시 풀에 반환. 풀 고갈 시 직접 연결 fallback(close 시 실제 종료)."""
    global _MAIN_DB_POOL
    with _main_pool_lock:
        if _MAIN_DB_POOL is None:
            cfg = {**get_db_config(), "cursor_factory": RealDictCursor}
            _MAIN_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **cfg
            )
    try:
        raw = _MAIN_DB_POOL.getconn()
        raw.set_client_encoding("UTF8")
        return _PooledConnection(_MAIN_DB_POOL, raw)
    except Exception:
        cfg = get_db_config()
        conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
        conn.set_client_encoding("UTF8")
        return conn


# 18.
def get_db_connection_system():
    """시스템 DB 연결을 풀에서 반환. ETL 메타·로그인·세션 등용. close() 시 풀 반환. 풀 고갈 시 직접 연결 fallback(close 시 실제 종료)."""
    global _SYSTEM_DB_POOL
    with _system_pool_lock:
        if _SYSTEM_DB_POOL is None:
            cfg = {**get_system_db_config(), "cursor_factory": RealDictCursor}
            _SYSTEM_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **cfg
            )
    try:
        raw = _SYSTEM_DB_POOL.getconn()
        raw.set_client_encoding("UTF8")
        return _PooledConnection(_SYSTEM_DB_POOL, raw)
    except Exception:
        cfg = get_system_db_config()
        conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
        conn.set_client_encoding("UTF8")
        return conn


# 19.
def get_db_connection_dash():
    """뉴 대시보드용 dash_db 연결을 풀에서 반환. close() 시 풀 반환. 풀 고갈 시 직접 연결 fallback."""
    global _DASH_DB_POOL
    with _dash_pool_lock:
        if _DASH_DB_POOL is None:
            cfg = {**get_dash_db_config(), "cursor_factory": RealDictCursor}
            _DASH_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **cfg
            )
    try:
        raw = _DASH_DB_POOL.getconn()
        raw.set_client_encoding("UTF8")
        return _PooledConnection(_DASH_DB_POOL, raw)
    except Exception:
        cfg = get_dash_db_config()
        conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
        conn.set_client_encoding("UTF8")
        return conn


# 19a.
def is_new_dash_physical_table(table_name: str) -> bool:
    """ibank_1·ibank_1_0~4 또는 ibank_*_star_1|2 (backend.dash_db 뉴 대시보드·Star 물리 테이블)."""
    if not table_name or not str(table_name).strip():
        return False
    return _NEW_DASH_PHYSICAL_TABLE_RE.match(str(table_name).strip()) is not None


# 19b.
def validate_dashboard_data_table_name(table_name):
    """
    대시보드·뉴 대시보드 API용 테이블명 검증.
    뉴 대시보드 물리 테이블(ibank_1 계열)은 allowed_tables 없이 패턴만 검증, 그 외는 validate_table_name.
    """
    if not table_name:
        raise ValueError("테이블 이름이 필요합니다")
    name = str(table_name).strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        raise ValueError(f"잘못된 테이블 이름: {table_name}")
    if is_new_dash_physical_table(name):
        return name
    return validate_table_name(name)


# 20.
def format_value(value):
    """값 포맷팅 (JSON 직렬화 가능하도록)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float, bool)):
        return value
    # Decimal, UUID 등 → 문자열로 (json.dumps 호환)
    return str(value)


# 21.
def validate_table_name(table_name):
    """테이블 이름 검증."""
    if not table_name:
        raise ValueError('테이블 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise ValueError(f'잘못된 테이블 이름: {table_name}')
    allowed = get_allowed_tables()
    if allowed and table_name not in allowed:
        raise ValueError(f'허용되지 않은 테이블: {table_name}')
    return table_name


# 22.
def validate_column_name(column_name):
    """컬럼 이름 검증 (영문, 숫자, 언더스코어만 허용)."""
    if not column_name:
        raise ValueError('컬럼 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        raise ValueError(f'잘못된 컬럼 이름: {column_name}')
    return column_name
