"""
Backend.core.db (DB 연결 및 검증)
=================================
Env/config/config.json의 backend만 사용. FastAPI 라우터는 dependencies.get_db()로 연결 주입.
메인 DB·시스템 DB·ETL DB를 분리 관리한다. ETL 타겟 테이블은 get_table_columns_for_etl_target, get_primary_key_columns_for_etl_target로 allowed_tables 미검사 조회.

[Main Functions / Classes]
===========
1. _PooledConnection: 풀에서 빌린 연결 래퍼 (close 시 putconn). cursor() 호출 시 psycopg2가 닫힌 연결로 판단하면 풀에 폐기 후 재획득
1a. safe_rollback: 서버 연결 종료 후에도 InterfaceError 없이 트랜잭션 정리 시도
1b. _pool_threaded_kwargs / _direct_db_connect / _acquire_from_threaded_pool: libpq TCP keepalive·checkout 시 끊김 연결 폐기·직접 연결 fallback
2. get_main_db_config: config.backend.main_db 에서 메인 DB dict (필수 블록, system_db 와 동일 키 구조)
3. get_system_db_config: config.backend.system_db에서 시스템 DB 연결용 dict 반환
4. get_etl_db_config: config.backend.etl_db 우선, 없으면 system_db fallback으로 ETL DB dict 반환
5. get_system_table_schema: ETL 스키마 우선(backend.etl_db.table_schema), 없으면 system_db.table_schema fallback
6. get_system_table_schema_core: 비ETL 시스템 기능용 system_db.table_schema 고정 반환
7. list_dash_schema_table_names: dash_db 스키마 BASE TABLE 목록(대시보드 후보 스캔)
8. get_allowed_tables_by_project: project_info_id + db_type + 선택적 QS/위젯 플래그 필터(table_project_mapping); include_meta 시 table_master_id·column_profiles 포함
9. get_allowed_tables: get_allowed_tables_by_project 위임
9a. get_merged_allowed_table_names_for_project: 쿼리스튜디오·위젯보드용 허용명 — main_db 매핑만(dash 제외)
9. get_table_schema: backend.main_db.table_schema(비면 public; main_db 필수)
10. _table_exists, _query_table_columns, _query_primary_key_columns: 내부 공통 SQL 헬퍼 (conn 인자로 커넥션 1회 사용)
11. get_table_columns_with_types: 컬럼명·data_type 목록 (대시보드 필수 컬럼 검증용)
12. get_all_tables_columns_with_types: 복수 테이블 컬럼·타입 일괄 조회(project_info_id 필수, 병합 허용 집합과 교집합)
13. get_table_columns_for_etl_target: ETL 타겟 테이블 컬럼명 목록 (allowed_tables 미검사, 커넥션 1회)
14. get_primary_key_columns_for_etl_target: ETL 타겟 테이블 PK 목록 (allowed_tables 미검사, 커넥션 1회)
15. get_db_connection: 메인 DB 연결을 풀에서 반환(close 시 풀 반환). checkout 시 끊김·인코딩 실패 시 해당 소켓 폐기 후 직접 연결 fallback, 풀 생성 시 TCP keepalive 포함
16. get_db_connection_etl: ETL DB 연결을 풀에서 반환(etl_db 우선, 없으면 system_db fallback)
17. get_db_connection_system: ETL 호환 alias. 기존 ETL 호출부를 위해 get_db_connection_etl() 위임
18. get_db_connection_system_core: 비ETL 시스템 기능(auth/admin/project/notification)용 system_db 고정 연결
19. get_dash_db_config / get_dash_table_schema / get_db_connection_dash: 뉴 대시보드 전용 dash_db(ibank_dash_data 등) 연결
20. is_new_dash_physical_table: ibank_1·ibank_1_0~4·ibank_*_star_1|2 여부 (dash_db 집계·Star JSONB 테이블)
21. validate_dashboard_data_table_name: 대시보드 API용 테이블명 — 뉴 대시보드 물리 테이블이면 허용 목록 없이 검증, 그 외는 validate_table_name
22. project_dashboard_feature_enabled: project_info.feature_flags.dash 가 False가 아니면 True(레거시·NULL→True)
22a. get_table_master_table_names_by_db_type: table_master에서 db_type 일치하는 table_name 집합
22b. is_table_allowed_for_project_dashboard: *_star_1|2 물리 존재 시 매핑 없이 허용; 그 외 dash는 대시보드 기능 켜진 프로젝트는 table_master dash 카탈로그, 아니면 매핑만
23. format_value: JSON 직렬화용 값 포맷 (datetime/date/decimal 등)
24. validate_table_name: 이름 패턴·메인 DB 스키마 내 실제 존재 여부 검증
24a. validate_table_identifier: 이름 패턴만 검증(메인/대시 물리 존재는 호출부에서 해당 연결·스키마로 확인)
25. validate_column_name: 컬럼명 허용 패턴 검증

[Package Usage]
===========
1. _PooledConnection: Backend/core/db.py 내부(get_db_connection 등이 풀 연결 반환 시)
2. get_main_db_config: Backend/api_server/main.py, scripts/check_db_connections.py
3. get_system_db_config: scripts/check_db_connections.py, Backend/core/dependencies.py(get_system_db 경유)
4. get_etl_db_config / get_system_table_schema / get_db_connection_etl / get_db_connection_system: Backend/etl_server(다수 모듈), scripts/check_db_connections.py
5. get_system_table_schema_core / get_db_connection_system_core: Backend/core/dependencies.py(get_system_db) 경유 auth/admin/project/notification
6. get_allowed_tables_by_project / get_allowed_tables / get_merged_allowed_table_names_for_project / is_table_allowed_for_project_dashboard: Backend/query_studio_server/router.py, Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
7. get_table_schema: Backend/query_studio_server/router.py, Backend/etl_server/service.py(get_target_db_connection), scripts/create_I1_derived_tables.py, dump_four_tables_schema.py
8. _table_exists, _query_table_columns, _query_primary_key_columns: Backend/core/db.py 내부(다른 db 함수에서 호출)
9. get_table_columns_with_types: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_all_tables_columns_with_types 등)
10. get_all_tables_columns_with_types / get_merged_allowed_table_names_for_project: Backend/query_studio_server/router.py
11. get_table_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
12. get_primary_key_columns_for_etl_target: Backend/etl_server/router.py, load_service.py
13. get_db_connection: Backend/core/dependencies.py, Backend/query_studio_server/router.py, scripts/*.py
14. get_dash_db_config: Backend/core/db.py 내부(get_db_connection_dash 풀·fallback). get_dash_table_schema·get_db_connection_dash: Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
15. is_new_dash_physical_table: Backend/core/dashboard_service.py, Backend/core/db.py 내부(get_table_columns_with_types·validate_dashboard_data_table_name)
16. validate_dashboard_data_table_name: Backend/core/dashboard_service.py, Backend/campaign_dash_server/router.py
17. format_value: Backend/query_studio_server/router.py
18. validate_table_name: Backend/core/dashboard_service.py 등(메인 물리 테이블 검증)
18a. validate_table_identifier: Backend/query_studio_server/router.py(describe_table), Backend/widget_board_server/service.py(_allowed_saved_table)
19. validate_column_name: Backend/query_studio_server/router.py

[Dependencies]
=========
- Env (config.backend)
- json, psycopg2, psycopg2.extras.RealDictCursor
"""

import json
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
_POOL_MAX = 30
_system_pool_lock = threading.Lock()
_etl_pool_lock = threading.Lock()
_main_pool_lock = threading.Lock()
_dash_pool_lock = threading.Lock()

# libpq TCP keepalive: 중간 경로(방화벽·NAT)가 유휴 TCP를 끊는 환경에서 풀 재사용 오류 완화
_POOL_CONNECT_EXTRA: dict[str, Any] = {
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 5,
}

# 뉴 대시보드 물리 테이블: ibank_1(집계), ibank_1_0~ibank_1_4(서브), ibank_*_star_1|2(JSONB 집약). backend.dash_db.
_NEW_DASH_PHYSICAL_TABLE_RE = re.compile(r"^ibank_1(_[0-4])?$|^ibank_[a-z0-9_]+_star_[12]$")

# 1.
class _PooledConnection:
    """풀에서 빌린 연결. close() 시 실제 TCP 종료 대신 putconn()으로 풀에 반환. 기존 conn.close() 호출 패턴과 호환."""

    def __init__(self, pool: psycopg2_pool.ThreadedConnectionPool, conn):
        self._pool = pool
        self._conn = conn

    def cursor(self, *args, **kwargs):
        # 풀에 반환된 뒤 서버·네트워크가 끊은 연결: psycopg2.closed != 0 이면 폐기 후 재획득
        if self._conn is not None and getattr(self._conn, "closed", 0) != 0:
            try:
                self._pool.putconn(self._conn, close=True)
            except Exception:
                pass
            try:
                self._conn = self._pool.getconn()
                self._conn.set_client_encoding("UTF8")
            except Exception as exc:
                self._conn = None
                raise psycopg2.InterfaceError(
                    "풀 연결을 갱신하지 못했습니다."
                ) from exc
        if self._conn is None:
            raise psycopg2.InterfaceError("연결이 이미 닫혔습니다.")
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

    @property
    def autocommit(self):
        """getattr로는 읽을 수 있으나, 직접 대입(c.autocommit=...)이 래퍼 __dict__에만 남는 버그를 막기 위해 _conn에 위임."""
        if self._conn is None:
            raise psycopg2.InterfaceError("연결이 이미 닫혔습니다.")
        return self._conn.autocommit

    @autocommit.setter
    def autocommit(self, value):
        if self._conn is None:
            raise psycopg2.InterfaceError("연결이 이미 닫혔습니다.")
        self._conn.autocommit = value

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


# 1a.
def safe_rollback(conn) -> None:
    """
    트랜잭션 정리용 rollback.
    서버가 연결을 끊은 뒤에는 rollback()이 InterfaceError·OperationalError를 낼 수 있어 무시한다.
    """
    if conn is None:
        return
    try:
        closed = getattr(conn, "closed", None)
        if closed is not None and closed != 0:
            return
        conn.rollback()
    except Exception:
        pass


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
def get_main_db_config():
    """
    config.backend.main_db 에서 메인 비즈니스 DB 연결 dict 반환.
    main_db 블록이 없거나 필수 키가 비어 있으면 ValueError (system_db·dash_db 와 동일 정책).
    """
    backend = config.backend
    main = getattr(backend, "main_db", None)
    if main is None:
        raise ValueError(
            "Env/config/config.json 에 backend.main_db 가 없습니다. "
            "메인 비즈니스 DB 연결을 위해 main_db 블록(db_host, db_port, db_name, db_user, db_password)을 추가하세요."
        )
    host = getattr(main, "db_host", None)
    port = getattr(main, "db_port", None)
    database = getattr(main, "db_name", None)
    user = getattr(main, "db_user", None)
    password = getattr(main, "db_password", None)

    if not host or not str(host).strip():
        raise ValueError("backend.main_db.db_host 가 없거나 비어 있습니다.")
    if database is None or not str(database).strip():
        raise ValueError("backend.main_db.db_name 이 없거나 비어 있습니다.")
    if not user or not str(user).strip():
        raise ValueError("backend.main_db.db_user 가 없거나 비어 있습니다.")
    if port is None or port == "":
        raise ValueError("backend.main_db.db_port 가 없습니다.")
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError("backend.main_db.db_port 는 숫자여야 합니다.")

    return {
        "host": str(host).strip(),
        "port": port,
        "database": str(database).strip(),
        "user": str(user).strip(),
        "password": str(password).strip() if password is not None else "",
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


# 5b.
def list_dash_schema_table_names() -> list[str]:
    """dash_db 스키마의 BASE TABLE 이름 목록(정렬). 캠페인 대시보드 후보 테이블 스캔용."""
    schema = get_dash_table_schema()
    conn = get_db_connection_dash()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (schema,),
        )
        return [str(r["table_name"]) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


# 6.
def get_allowed_tables_by_project(
    project_info_id: int,
    db_type: str = "main",
    include_meta: bool = False,
    *,
    usage_query_studio: bool | None = None,
    usage_widgetboard: bool | None = None,
) -> set[str] | list[dict[str, Any]]:
    """
    프로젝트 기반 허용 테이블 조회.
    system_db의 table_project_mapping + table_master를 조인한다.
    usage_query_studio=True 이면 use_query_studio_yn='Y' 인 매핑만, usage_widgetboard=True 이면 위젯 플래그만 필터.
    """
    norm_db_type = _normalize_db_type(db_type)
    extra_sql = ""
    if usage_query_studio is True:
        extra_sql += (
            " AND UPPER(COALESCE(NULLIF(TRIM(mp.use_query_studio_yn), ''), 'Y')) = 'Y'"
        )
    if usage_widgetboard is True:
        extra_sql += (
            " AND UPPER(COALESCE(NULLIF(TRIM(mp.use_widgetboard_yn), ''), 'Y')) = 'Y'"
        )
    conn = get_db_connection_system_core()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT
                m.table_master_id,
                m.table_name,
                m.table_label,
                m.table_dscrtn,
                m.db_type,
                m.column_profiles
            FROM table_project_mapping mp
            JOIN table_master m
              ON mp.table_master_id = m.table_master_id
            WHERE mp.project_info_id = %s
              AND LOWER(TRIM(COALESCE(m.db_type, ''))) = %s
            {extra_sql}
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


# 6a.
def get_allowed_tables(
    project_info_id: int,
    db_type: str = "main",
    include_meta: bool = False,
    *,
    usage_query_studio: bool | None = None,
    usage_widgetboard: bool | None = None,
) -> set[str] | list[dict[str, Any]]:
    """허용 테이블 조회. project_info_id 필수."""
    norm_db_type = _normalize_db_type(db_type)
    return get_allowed_tables_by_project(
        project_info_id=int(project_info_id),
        db_type=norm_db_type,
        include_meta=include_meta,
        usage_query_studio=usage_query_studio,
        usage_widgetboard=usage_widgetboard,
    )


# 6b.
def get_merged_allowed_table_names_for_project(
    project_info_id: int,
    *,
    usage_query_studio: bool | None = True,
    usage_widgetboard: bool | None = None,
) -> list[str]:
    """
    쿼리 스튜디오·위젯보드: table_master.db_type=main 매핑만 허용. dash 테이블은 대시보드 등 별도 경로.
    usage_widgetboard=True 이면 위젯보드 채널 플래그만, 그 외 기본은 쿼리 스튜디오 채널 필터.
    """
    pid = int(project_info_id)
    kw: dict[str, Any] = {}
    if usage_widgetboard is True:
        kw["usage_widgetboard"] = True
    elif usage_query_studio is not False:
        kw["usage_query_studio"] = True
    allowed_rows_main = get_allowed_tables_by_project(
        pid, db_type="main", include_meta=True, **kw
    )
    return sorted({row["table_name"] for row in allowed_rows_main})


# 6c.
def get_table_schema():
    """
    리포트·허용 테이블 조회용 스키마명.
    backend.main_db.table_schema 가 비어 있거나 없으면 'public' (해당 스키마의 테이블·뷰 전부 조회).
    backend.main_db 가 없으면 ValueError.
    """
    main = getattr(config.backend, "main_db", None)
    if main is None:
        raise ValueError(
            "Env/config/config.json 에 backend.main_db 가 없습니다. "
            "get_table_schema() 는 main_db.table_schema 를 사용합니다."
        )
    schema = getattr(main, "table_schema", None)
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


# 11.
def get_all_tables_columns_with_types(table_names, project_info_id: int):
    """여러 테이블의 컬럼명·데이터타입을 한 번에 조회. { table_name: [...] }. 허용 집합은 main+쿼리스튜디오 채널 매핑만.

    dash_db 테이블은 쿼리 스튜디오 관계 추론 대상에서 제외한다.
    """
    pid = int(project_info_id)
    allowed = set(
        get_merged_allowed_table_names_for_project(pid, usage_query_studio=True)
    )
    raw_names = [t for t in (table_names or []) if t in allowed]
    if not raw_names:
        return {}

    schema = get_table_schema()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        placeholders = ", ".join(["%s"] * len(raw_names))
        cur.execute(
            """
            SELECT c.table_name, c.column_name, c.data_type,
                   (
                       SELECT pg_catalog.col_description(a.attrelid, a.attnum)
                       FROM pg_catalog.pg_attribute a
                       JOIN pg_catalog.pg_class cl ON a.attrelid = cl.oid
                       JOIN pg_catalog.pg_namespace ns ON cl.relnamespace = ns.oid
                       WHERE ns.nspname = c.table_schema
                         AND cl.relname = c.table_name
                         AND a.attname::text = c.column_name
                         AND a.attnum > 0
                         AND NOT a.attisdropped
                       LIMIT 1
                   ) AS column_comment
            FROM information_schema.columns c
            WHERE c.table_schema = %s AND c.table_name IN (""" + placeholders + """)
            ORDER BY c.table_name, c.ordinal_position
            """,
            (schema,) + tuple(raw_names),
        )
        out: dict[str, list[dict[str, str]]] = {}
        for row in cur.fetchall():
            t = row["table_name"]
            if t not in out:
                out[t] = []
            cm = row.get("column_comment")
            entry = {"column_name": row["column_name"], "data_type": row["data_type"]}
            if cm is not None and str(cm).strip():
                entry["column_comment"] = str(cm).strip()
            out[t].append(entry)
        for t in raw_names:
            if t not in out:
                out[t] = []
        return out
    finally:
        cur.close()
        conn.close()


# 12.
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


# 13.
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


def _pool_threaded_kwargs(get_cfg_fn):
    """ThreadedConnectionPool·psycopg2.connect 공통 연결 kwargs."""
    return {**get_cfg_fn(), "cursor_factory": RealDictCursor, **_POOL_CONNECT_EXTRA}


def _direct_db_connect(get_cfg_fn):
    """풀 고갈·끊긴 풀 연결 등으로 풀에서 못 쓸 때 직접 연결(close 시 실제 종료)."""
    conn = psycopg2.connect(**_pool_threaded_kwargs(get_cfg_fn))
    conn.set_client_encoding("UTF8")
    return conn


def _acquire_from_threaded_pool(
    pool: psycopg2_pool.ThreadedConnectionPool,
    get_cfg_fn,
):
    """
    풀에서 연결 획득.
    getconn 실패·연결 closed·set_client_encoding 실패 시 해당 소켓을 풀에서 제거하고 직접 연결.
    """
    raw = None
    try:
        raw = pool.getconn()
    except Exception:
        return _direct_db_connect(get_cfg_fn)
    try:
        if getattr(raw, "closed", 0) != 0:
            raise psycopg2.OperationalError("stale pooled connection (closed)")
        raw.set_client_encoding("UTF8")
        return _PooledConnection(pool, raw)
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        try:
            pool.putconn(raw, close=True)
        except Exception:
            pass
        return _direct_db_connect(get_cfg_fn)


# 14.
def get_db_connection():
    """메인 DB 연결을 풀에서 반환. close() 시 풀에 반환. 풀 고갈 시 직접 연결 fallback(close 시 실제 종료)."""
    global _MAIN_DB_POOL
    with _main_pool_lock:
        if _MAIN_DB_POOL is None:
            _MAIN_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **_pool_threaded_kwargs(get_main_db_config)
            )
    return _acquire_from_threaded_pool(_MAIN_DB_POOL, get_main_db_config)


# 15.
def get_db_connection_etl():
    """ETL DB 연결(etl_db 우선, 없으면 system_db fallback)을 풀에서 반환. close() 시 풀 반환."""
    global _ETL_DB_POOL
    with _etl_pool_lock:
        if _ETL_DB_POOL is None:
            _ETL_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **_pool_threaded_kwargs(get_etl_db_config)
            )
    return _acquire_from_threaded_pool(_ETL_DB_POOL, get_etl_db_config)


# 16.
def get_db_connection_system():
    """ETL 호환 alias. 기존 ETL 호출부 영향 최소화를 위해 ETL DB 연결(get_db_connection_etl)을 반환."""
    return get_db_connection_etl()


# 17.
def get_db_connection_system_core():
    """비ETL 시스템 기능(auth/admin/project/notification)용 system_db 고정 연결."""
    global _SYSTEM_DB_POOL
    with _system_pool_lock:
        if _SYSTEM_DB_POOL is None:
            _SYSTEM_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **_pool_threaded_kwargs(get_system_db_config)
            )
    return _acquire_from_threaded_pool(_SYSTEM_DB_POOL, get_system_db_config)


# 18.
def get_db_connection_dash():
    """뉴 대시보드용 dash_db 연결을 풀에서 반환. close() 시 풀 반환. 풀 고갈 시 직접 연결 fallback."""
    global _DASH_DB_POOL
    with _dash_pool_lock:
        if _DASH_DB_POOL is None:
            _DASH_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **_pool_threaded_kwargs(get_dash_db_config)
            )
    return _acquire_from_threaded_pool(_DASH_DB_POOL, get_dash_db_config)


# 19.
def is_new_dash_physical_table(table_name: str) -> bool:
    """ibank_1·ibank_1_0~4 또는 ibank_*_star_1|2 (backend.dash_db 뉴 대시보드·Star 물리 테이블)."""
    if not table_name or not str(table_name).strip():
        return False
    return _NEW_DASH_PHYSICAL_TABLE_RE.match(str(table_name).strip()) is not None


# 20.
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


# 21.
def project_dashboard_feature_enabled(project_info_id: int) -> bool:
    """
    프로젝트에 대시보드 페이지가 켜져 있는지(feature_flags.dash).
    NULL·키 없음·레거시 JSON → True. 명시적으로 dash=False 인 프로젝트만 False.
    """
    conn = get_db_connection_system_core()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT feature_flags FROM project_info WHERE project_info_id = %s",
            (int(project_info_id),),
        )
        row = cur.fetchone()
        if not row:
            return False
        raw = row.get("feature_flags")
        if raw is None:
            return True
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                return True
        if not isinstance(raw, dict):
            return True
        if raw.get("dash") is False:
            return False
        return True
    finally:
        cur.close()
        conn.close()


# 21a.
def get_table_master_table_names_by_db_type(db_type: str) -> set[str]:
    """system_db table_master 에서 db_type(정규화)이 일치하는 물리 테이블명 집합."""
    norm = _normalize_db_type(db_type)
    conn = get_db_connection_system_core()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT table_name FROM table_master
            WHERE LOWER(TRIM(COALESCE(db_type, ''))) = %s
            """,
            (norm,),
        )
        return {str(r[0]).strip() for r in cur.fetchall() if r and r[0]}
    finally:
        cur.close()
        conn.close()


# 21b.
def is_table_allowed_for_project_dashboard(project_info_id: int, table_id: str) -> bool:
    """
    캠페인 대시보드용 table_id 허용.
    `*_star_1` 팩트는 dash_db에 물리 테이블이 있으면 table_project_mapping 없이 허용한다.
    `*_star_2` 는 동일 접두 `*_star_1` 이 위 규칙으로 허용되면 허용.
    그 외 main 은 프로젝트 매핑(main)을 따른다.
    dash 는 프로젝트에 대시보드 기능이 켜져 있으면 table_master 의 dash 등록 테이블 전체를 허용 집합으로 쓰고,
    대시보드가 꺼진 프로젝트는 기존처럼 dash 매핑만 인정한다.
    """
    pid = int(project_info_id)
    name = str(table_id or "").strip()
    if not name:
        return False
    if name.endswith("_star_1") and is_new_dash_physical_table(name):
        try:
            validate_dashboard_data_table_name(name)
            schema = get_dash_table_schema()
            conn = get_db_connection_dash()
            try:
                if _table_exists(conn, schema, name):
                    return True
            finally:
                conn.close()
        except Exception:
            pass
    if name.endswith("_star_2") and is_new_dash_physical_table(name):
        try:
            validate_dashboard_data_table_name(name)
            partner = name[: -len("_star_2")] + "_star_1"
            schema = get_dash_table_schema()
            conn = get_db_connection_dash()
            try:
                if _table_exists(conn, schema, name) and _table_exists(conn, schema, partner):
                    return True
            finally:
                conn.close()
        except Exception:
            pass
    main_s = get_allowed_tables_by_project(pid, "main")
    if project_dashboard_feature_enabled(pid):
        dash_s = get_table_master_table_names_by_db_type("dash")
    else:
        dash_s = get_allowed_tables_by_project(pid, "dash")
    if name in main_s or name in dash_s:
        return True
    m = re.match(r"^(ibank_\d+)_[0-4]$", name)
    if m and m.group(1) in dash_s:
        return True
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


# 23a.
def validate_table_identifier(table_name):
    """테이블 식별자 패턴만 검증. 물리 존재 여부는 메인/대시 각 연결에서 별도 확인."""
    if not table_name or not str(table_name).strip():
        raise ValueError('테이블 이름이 필요합니다')
    t = str(table_name).strip()
    if not re.match(r'^[a-zA-Z0-9_]+$', t):
        raise ValueError(f'잘못된 테이블 이름: {t}')
    return t


# 24.
def validate_column_name(column_name):
    """컬럼 이름 검증 (영문, 숫자, 언더스코어만 허용)."""
    if not column_name:
        raise ValueError('컬럼 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        raise ValueError(f'잘못된 컬럼 이름: {column_name}')
    return column_name
