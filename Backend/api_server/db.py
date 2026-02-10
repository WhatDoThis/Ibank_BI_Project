"""
Backend.api_server.db (DB 연결 및 검증)
=======================================
Env/config/config.json 의 backend 만 사용. 환경 변수·기본값 없음. 없으면 예외.
FastAPI 라우터에서 dependencies.get_db() 통해 의존성 주입용으로 사용.

[Main Functions]
===========
- get_db_config: config.backend 에서만 DB 연결용 dict (필수 키 없으면 ValueError)
- get_allowed_tables, get_table_schema, get_table_columns, get_table_columns_with_types: config.backend 에서만
- get_db_connection: DB 연결 생성
- format_value, validate_table_name, validate_column_name

[Dependencies]
=========
- Env (config.backend)
- psycopg2, psycopg2.extras.RealDictCursor
"""

import re
from datetime import datetime, date

import psycopg2
from pathlib import Path

from psycopg2.extras import RealDictCursor

# 프로젝트 루트를 sys.path 맨 앞에 넣어 Env가 프로젝트 쪽으로 로드되도록 함
import sys
_db_module_dir = Path(__file__).resolve().parent
_project_root_from_db = _db_module_dir.parent.parent
if str(_project_root_from_db) not in sys.path:
    sys.path.insert(0, str(_project_root_from_db))

from Env import config


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


def get_allowed_tables():
    """허용 테이블 목록. config.backend.allowed_tables 만 사용. 없으면 ValueError."""
    tables = getattr(config.backend, 'allowed_tables', None)
    if tables is None:
        raise ValueError('Env/config/config.json 에 backend.allowed_tables 가 없습니다.')
    if isinstance(tables, list):
        return set(tables)
    raise ValueError('Env/config/config.json 의 backend.allowed_tables 는 배열이어야 합니다.')


def get_table_schema():
    """테이블 스키마. config.backend.table_schema 만 사용. 없으면 ValueError."""
    schema = getattr(config.backend, 'table_schema', None)
    if schema is None or not str(schema).strip():
        raise ValueError('Env/config/config.json 에 backend.table_schema 가 없거나 비어 있습니다.')
    return str(schema).strip()


def get_table_columns(table_name):
    """테이블의 컬럼명 목록 반환 (information_schema 기준). 허용된 테이블만 조회 가능."""
    validate_table_name(table_name)
    schema = get_table_schema()
    conn = get_db_connection()
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
        conn.close()


def get_table_columns_with_types(table_name):
    """테이블의 컬럼명·데이터타입 목록 반환. [{ column_name, data_type }, ...]. 대시보드 필수 컬럼 타입 검증용."""
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


def get_db_connection():
    """DB 연결 생성. config.backend 만 사용 (get_db_config에서 이미 검증). 한글 등 UTF-8 쿼리 지원을 위해 client_encoding 설정."""
    cfg = get_db_config()
    conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
    conn.set_client_encoding("UTF8")
    return conn


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


def validate_column_name(column_name):
    """컬럼 이름 검증 (영문, 숫자, 언더스코어만 허용)."""
    if not column_name:
        raise ValueError('컬럼 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        raise ValueError(f'잘못된 컬럼 이름: {column_name}')
    return column_name
