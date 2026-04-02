"""
Backend.core.db (DB 연결 및 검증)
=================================
Env/config/config.json의 backend만 사용. FastAPI 라우터는 dependencies.get_db()로 연결 주입.
메인 DB·시스템 DB·ETL DB를 분리 관리한다. ETL 타겟 테이블은 get_table_columns_for_etl_target, get_primary_key_columns_for_etl_target로 allowed_tables 미검사 조회.

[Main Functions / Classes]
===========
1. _PooledConnection: 풀에서 빌린 연결 래퍼 (close 시 putconn)
2. _resolve_main_db / get_db_config: config.backend.main_db(또는 레거시 평면 db_*)에서 메인 DB dict
3. get_system_db_config: config.backend.system_db에서 시스템 DB 연결용 dict 반환
4. get_etl_db_config: config.backend.etl_db 우선, 없으면 system_db fallback으로 ETL DB dict 반환
5. get_system_table_schema: ETL 스키마 우선(backend.etl_db.table_schema), 없으면 system_db.table_schema fallback
6. get_system_table_schema_core: 비ETL 시스템 기능용 system_db.table_schema 고정 반환
7. get_allowed_tables_by_project: project_info_id + db_type 기반 허용 테이블 조회(table_project_mapping+table_master)
8. get_allowed_tables: project_info_id 지정 시 get_allowed_tables_by_project 우선, 미지정 시 레거시 스키마 전체 호환
9. get_table_schema: main_db.table_schema(또는 레거시 backend.table_schema)
10. _table_exists, _query_table_columns, _query_primary_key_columns: 내부 공통 SQL 헬퍼 (conn 인자로 커넥션 1회 사용)
11. get_table_columns: 테이블 컬럼명 목록 (information_schema, 허용 테이블만)
12. get_table_columns_with_types: 컬럼명·data_type 목록 (대시보드 필수 컬럼 검증용)
13. get_all_tables_columns_with_types: 복수 테이블 컬럼·타입 일괄 조회
14. get_primary_key_columns: 테이블 PK 컬럼명 목록 (허용 테이블만)
15. table_exists_in_schema: 테이블 스키마 내 존재 여부 (allowed_tables 미검사)
16. get_table_columns_for_etl_target: ETL 타겟 테이블 컬럼명 목록 (allowed_tables 미검사, 커넥션 1회)
17. get_primary_key_columns_for_etl_target: ETL 타겟 테이블 PK 목록 (allowed_tables 미검사, 커넥션 1회)
18. get_db_connection: 메인 DB 연결을 풀에서 반환 (최대 20연결, close 시 풀 반환). 풀 고갈 시 직접 연결 fallback.
19. get_db_connection_etl: ETL DB 연결을 풀에서 반환(etl_db 우선, 없으면 system_db fallback)
20. get_db_connection_system: ETL 호환 alias. 기존 ETL 호출부를 위해 get_db_connection_etl() 위임
21. get_db_connection_system_core: 비ETL 시스템 기능(auth/admin/project/notification)용 system_db 고정 연결
22. get_dash_db_config / get_dash_table_schema / get_db_connection_dash: 뉴 대시보드 전용 dash_db(ibank_dash_data 등) 연결
23. is_new_dash_physical_table: ibank_1·ibank_1_0~4·ibank_*_star_1|2 여부 (dash_db 집계·Star JSONB 테이블)
24. validate_dashboard_data_table_name: 대시보드 API용 테이블명 — 뉴 대시보드 물리 테이블이면 허용 목록 없이 검증, 그 외는 validate_table_name
25. is_table_allowed_for_project_dashboard: 프로젝트·table_master·매핑 기준 대시보드 테이블 허용 여부(M1-8)
26. format_value: JSON 직렬화용 값 포맷 (datetime/date/decimal 등)
27. validate_table_name: 이름 패턴·스키마 내 실제 존재 여부 검증
28. validate_column_name: 컬럼명 허용 패턴 검증

[Package Usage]
===========
1. _PooledConnection: Backend/core/db.py 내부(get_db_connection 등이 풀 연결 반환 시)
2. get_db_config: Backend/api_server/main.py, scripts/check_db_connections.py
3. get_system_db_config: scripts/check_db_connections.py, Backend/core/dependencies.py(get_system_db 경유)
4. get_etl_db_config / get_system_table_schema / get_db_connection_etl / get_db_connection_system: Backend/etl_server(다수 모듈), scripts/check_db_connections.py
5. get_system_table_schema_core / get_db_connection_system_core: Backend/core/dependencies.py(get_system_db) 경유 auth/admin/project/notification
6. get_allowed_tables_by_project / get_allowed_tables / is_table_allowed_for_project_dashboard: Backend/query_studio_server/router.py, Backend/api_server/main.py, Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
7. get_table_schema: Backend/query_studio_server/router.py, analysis_store.py, Backend/etl_server/service.py(get_target_db_connection), scripts/create_I1_derived_tables.py, dump_four_tables_schema.py
8. _table_exists, _query_table_columns, _query_primary_key_columns: Backend/core/db.py 내부(다른 db 함수에서 호출)
9. get_table_columns: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
10. get_table_columns_with_types: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_all_tables_columns_with_types 등)
11. get_all_tables_columns_with_types: Backend/query_studio_server/router.py
12. get_primary_key_columns: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
13. table_exists_in_schema: (현 레포 Python 코드에서 직접 호출 없음 — 공개 API)
14. get_table_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
15. get_primary_key_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
16. get_db_connection: Backend/core/dependencies.py, Backend/query_studio_server/router.py, analysis_store.py, scripts/*.py
17. get_dash_db_config: Backend/core/db.py 내부(get_db_connection_dash 풀·fallback). get_dash_table_schema·get_db_connection_dash: Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
18. is_new_dash_physical_table: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_table_columns_with_types·validate_dashboard_data_table_name)
19. validate_dashboard_data_table_name: Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
20. format_value: Backend/query_studio_server/router.py
21. validate_table_name: Backend/query_studio_server/router.py, Backend/core/dashboard_service.py
22. validate_column_name: Backend/query_studio_server/router.py

[Dependencies]
=========
- Env (config.backend)
- psycopg2, psycopg2.extras.RealDictCursor
"""

import re
import threading
from typing import Any
from datetime import datetime, date

import psycopg2
from psycopg2 import pool as psycopg2_pool
from psycopg2.extras import RealDictCursor

# 시스템/메인 DB 연결 풀: 동시 연결 수 제한으로 PostgreSQL max_connections 초과 방지
_SYSTEM_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_ETL_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_MAIN_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_DASH_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_POOL_MIN = 1
_POOL_MAX = 20
_system_pool_lock = threading.Lock()
_etl_pool_lock = threading.Lock()
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
def _resolve_main_db():
    """메인 비즈니스 DB 설정 객체. backend.main_db 우선, 없으면 레거시(평면 db_*·table_schema)."""
    backend = config.backend
    main = getattr(backend, "main_db", None)
    if main is not None:
        return main
    return backend


def get_db_config():
    """config.backend.main_db(또는 레거시 backend db_*)에서 DB 설정 읽기. 없거나 비어 있으면 ValueError."""
    src = _resolve_main_db()
    host = getattr(src, "db_host", None)
    port = getattr(src, "db_port", None)
    database = getattr(src, "db_name", None)
    user = getattr(src, "db_user", None)
    password = getattr(src, "db_password", None)

    loc = "backend.main_db"
    if getattr(config.backend, "main_db", None) is None:
        loc = "backend (레거시 평면 키)"

    if not host or not str(host).strip():
        raise ValueError(f"Env/config/config.json 의 {loc}.db_host 가 없거나 비어 있습니다.")
    if database is None or not str(database).strip():
        raise ValueError(f"Env/config/config.json 의 {loc}.db_name 이 없거나 비어 있습니다.")
    if not user or not str(user).strip():
        raise ValueError(f"Env/config/config.json 의 {loc}.db_user 가 없거나 비어 있습니다.")
    if port is None or port == "":
        raise ValueError(f"Env/config/config.json 의 {loc}.db_port 가 없습니다.")
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError(f"Env/config/config.json 의 {loc}.db_port 는 숫자여야 합니다.")

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
def get_etl_db_config():
    """
    config.backend.etl_db 에서 ETL DB 연결 설정 읽기.
    etl_db 가 없으면 system_db 설정으로 fallback 하여 기존 ETL 호출부와 호환한다.
    """
    backend = config.backend
    etl_db = getattr(backend, "etl_db", None)
    if etl_db is None:
        return get_system_db_config()

    host = getattr(etl_db, "db_host", None)
    port = getattr(etl_db, "db_port", None)
    database = getattr(etl_db, "db_name", None)
    user = getattr(etl_db, "db_user", None)
    password = getattr(etl_db, "db_password", None)

    if not host or not str(host).strip():
        raise ValueError("backend.etl_db.db_host 가 없거나 비어 있습니다.")
    if database is None or not str(database).strip():
        raise ValueError("backend.etl_db.db_name 이 없거나 비어 있습니다.")
    if not user or not str(user).strip():
        raise ValueError("backend.etl_db.db_user 가 없거나 비어 있습니다.")
    if port is None or port == "":
        raise ValueError("backend.etl_db.db_port 가 없습니다.")
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError("backend.etl_db.db_port 는 숫자여야 합니다.")

    return {
        "host": str(host).strip(),
        "port": port,
        "database": str(database).strip(),
        "user": str(user).strip(),
        "password": str(password).strip() if password is not None else "",
    }


# 3b.
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


# 3c.
def get_dash_table_schema():
    """dash_db 의 table_schema. backend.dash_db.table_schema 가 있으면 사용, 없으면 'public'."""
    dash = getattr(config.backend, "dash_db", None)
    if dash is None:
        return "public"
    return getattr(dash, "table_schema", None) or "public"


# 4.
def get_system_table_schema():
    """ETL 스키마 우선. backend.etl_db.table_schema가 있으면 사용, 없으면 system_db.table_schema fallback."""
    etl_db = getattr(config.backend, "etl_db", None)
    if etl_db is not None:
        return getattr(etl_db, "table_schema", None) or "public"
    return get_system_table_schema_core()


# 4a.
def get_system_table_schema_core():
    """비ETL 시스템 기능용 system_db 스키마를 강제로 반환."""
    sys_db = getattr(config.backend, "system_db", None)
    if sys_db is None:
        return "public"
    return getattr(sys_db, "table_schema", None) or "public"


# 5.
def _normalize_db_type(db_type: str | None) -> str:
    """db_type(main/dash) 정규화. table_master 정책상 star 구분은 사용하지 않음. 유효하지 않으면 ValueError."""
    norm = str(db_type or "main").strip().lower()
    if norm not in ("main", "dash"):
        raise ValueError(f"지원하지 않는 db_type 입니다: {db_type}")
    return norm


def get_allowed_tables_by_project(
    project_info_id: int,
    db_type: str = "main",
    include_meta: bool = False,
) -> set[str] | list[dict[str, Any]]:
    """
    프로젝트 기반 허용 테이블 조회.
    system_db의 table_project_mapping + table_master를 조인한다.
    db_type 인자는 main 또는 dash 만 허용(table_master 정책).
    include_meta=True면 [{table_name, table_label, table_dscrtn, db_type}] 반환.
    """
    norm_db_type = _normalize_db_type(db_type)
    conn = get_db_connection_system_core()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                m.table_name,
                m.table_label,
                m.table_dscrtn,
                m.db_type
            FROM table_project_mapping mp
            JOIN table_master m
              ON mp.table_master_id = m.table_master_id
            WHERE mp.project_info_id = %s
              AND LOWER(TRIM(COALESCE(m.db_type, ''))) = %s
            ORDER BY m.table_name
            """,
            (int(project_info_id), norm_db_type),
        )
        rows = [dict(r) for r in cur.fetchall()]
        if include_meta:
            return rows
        return {row["table_name"] for row in rows}
    finally:
        cur.close()
        conn.close()


def get_allowed_tables(
    project_info_id: int | None = None,
    db_type: str = "main",
    include_meta: bool = False,
) -> set[str] | list[dict[str, Any]]:
    """
    허용 테이블 조회.
    - project_info_id 지정: system_db의 table_project_mapping + table_master 조인 결과
    - project_info_id 미지정: 기존 호환을 위해 메인 스키마(BASE TABLE/VIEW) 전체 반환
    include_meta=True면 [{table_name, table_label, table_dscrtn, db_type}] 반환.
    """
    norm_db_type = _normalize_db_type(db_type)
    if project_info_id is None:
        schema = get_table_schema()
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = %s
                  AND table_type IN ('BASE TABLE', 'VIEW')
                """,
                (schema,),
            )
            names = [row["table_name"] for row in cur.fetchall()]
            if include_meta:
                return [
                    {
                        "table_name": name,
                        "table_label": None,
                        "table_dscrtn": None,
                        "db_type": norm_db_type,
                    }
                    for name in names
                ]
            return set(names)
        finally:
            cur.close()
            conn.close()

    return get_allowed_tables_by_project(
        project_info_id=int(project_info_id),
        db_type=norm_db_type,
        include_meta=include_meta,
    )


# 6.
def get_table_schema():
    """
    리포트·허용 테이블 조회용 스키마명.
    backend.main_db.table_schema 가 비어 있거나 없으면 'public' (해당 스키마의 테이블·뷰 전부 조회).
    레거시 평면 backend.table_schema 동일 규칙.
    """
    src = _resolve_main_db()
    schema = getattr(src, "table_schema", None)
    if schema is None or not str(schema).strip():
        return "public"
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
def get_db_connection_etl():
    """ETL DB 연결(etl_db 우선, 없으면 system_db fallback)을 풀에서 반환. close() 시 풀 반환."""
    global _ETL_DB_POOL
    with _etl_pool_lock:
        if _ETL_DB_POOL is None:
            cfg = {**get_etl_db_config(), "cursor_factory": RealDictCursor}
            _ETL_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **cfg
            )
    try:
        raw = _ETL_DB_POOL.getconn()
        raw.set_client_encoding("UTF8")
        return _PooledConnection(_ETL_DB_POOL, raw)
    except Exception:
        cfg = get_etl_db_config()
        conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
        conn.set_client_encoding("UTF8")
        return conn


# 19.
def get_db_connection_system():
    """ETL 호환 alias. 기존 ETL 호출부 영향 최소화를 위해 ETL DB 연결(get_db_connection_etl)을 반환."""
    return get_db_connection_etl()


# 20.
def get_db_connection_system_core():
    """비ETL 시스템 기능(auth/admin/project/notification)용 system_db 고정 연결."""
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


# 21.
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


# 21a.
def is_new_dash_physical_table(table_name: str) -> bool:
    """ibank_1·ibank_1_0~4 또는 ibank_*_star_1|2 (backend.dash_db 뉴 대시보드·Star 물리 테이블)."""
    if not table_name or not str(table_name).strip():
        return False
    return _NEW_DASH_PHYSICAL_TABLE_RE.match(str(table_name).strip()) is not None


# 21b.
def validate_dashboard_data_table_name(table_name):
    """
    대시보드·뉴 대시보드 API용 테이블명 검증.
    뉴 대시보드 물리 테이블(ibank_1 계열)은 패턴만 검증, 그 외는 validate_table_name(메인 스키마 존재 여부).
    """
    if not table_name:
        raise ValueError("테이블 이름이 필요합니다")
    name = str(table_name).strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        raise ValueError(f"잘못된 테이블 이름: {table_name}")
    if is_new_dash_physical_table(name):
        return name
    return validate_table_name(name)


# 21c.
def is_table_allowed_for_project_dashboard(project_info_id: int, table_id: str) -> bool:
    """
    대시보드 API용 테이블명이 현재 프로젝트의 table_master·table_project_mapping에 허용되는지.
    main / dash 매핑에 정확히 포함되거나, dash에 집계 본표(ibank_n)만 있을 때
    서브 테이블 ibank_n_0~ibank_n_4만 추가 허용(문서 17 M1-8·뉴 대시보드 서브 패턴).
    dash_db 물리명 `*_star_1|2` 는 table_master 에서 db_type=dash 로 등록하는 것을 전제로 한다.
    """
    name = str(table_id or "").strip()
    if not name:
        return False
    main_s = get_allowed_tables_by_project(int(project_info_id), "main")
    dash_s = get_allowed_tables_by_project(int(project_info_id), "dash")
    if name in main_s or name in dash_s:
        return True
    m = re.match(r"^(ibank_\d+)_[0-4]$", name)
    if m and m.group(1) in dash_s:
        return True
    # 캠페인: 회원 스냅샷 *_star_2 는 동일 접두의 *_star_1 이 dash 매핑에 있으면 허용
    if name.endswith("_star_2"):
        partner = name[: -len("_star_2")] + "_star_1"
        if partner in dash_s:
            return True
    return False


# 22.
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


# 23.
def validate_table_name(table_name):
    """테이블 이름 형식 검증 후 메인 스키마에 존재하는지 확인."""
    if not table_name:
        raise ValueError('테이블 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise ValueError(f'잘못된 테이블 이름: {table_name}')
    schema = get_table_schema()
    conn = get_db_connection()
    try:
        if not _table_exists(conn, schema, table_name):
            raise ValueError(f'테이블을 찾을 수 없습니다: {table_name}')
    finally:
        conn.close()
    return table_name


# 24.
def validate_column_name(column_name):
    """컬럼 이름 검증 (영문, 숫자, 언더스코어만 허용)."""
    if not column_name:
        raise ValueError('컬럼 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        raise ValueError(f'잘못된 컬럼 이름: {column_name}')
    return column_name
