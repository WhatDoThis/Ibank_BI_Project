"""
Backend.api_server.db (DB 연결 및 검증)
=======================================
config.backend 기반 DB 연결·검증·포맷. Env config.backend 사용.

[Main Functions]
===========
- get_env: 환경 변수 조회 (따옴표 제거)
- get_db_config: config.backend + 환경 변수 병합 후 DB 연결용 dict
- get_allowed_tables, get_table_schema: 허용 테이블·스키마
- get_db_connection: DB 연결 생성
- format_value: JSON 직렬화용 포맷
- validate_table_name, validate_column_name: 테이블·컬럼명 검증

[Dependencies]
=========
- Env (config.backend)
- psycopg2, psycopg2.extras.RealDictCursor
"""

import os
import re
from datetime import datetime

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


def get_env(key, default):
    """환경 변수 가져오기 (따옴표 제거)."""
    value = os.getenv(key, default)
    if value and isinstance(value, str) and value.startswith('"') and value.endswith('"'):
        value = value.strip('"')
    return value


def get_db_config():
    """config.backend + 환경 변수 병합 후 DB 연결용 dict 반환."""
    backend = config.backend
    return {
        'host': get_env('DB_HOST', getattr(backend, 'db_host', '') or ''),
        'port': int(get_env('DB_PORT', str(getattr(backend, 'db_port', 5432) or 5432))),
        'database': get_env('DB_NAME', getattr(backend, 'db_name', '') or ''),
        'user': get_env('DB_USER', getattr(backend, 'db_user', '') or ''),
        'password': get_env('DB_PASSWORD', getattr(backend, 'db_password', '') or ''),
    }


def get_allowed_tables():
    """허용 테이블 목록. config.backend.allowed_tables 사용."""
    tables = getattr(config.backend, 'allowed_tables', None)
    if isinstance(tables, list):
        return set(tables)
    return set()


def get_table_schema():
    """테이블 스키마. config.backend.table_schema 사용."""
    return getattr(config.backend, 'table_schema', 'public') or 'public'


def get_db_connection():
    """DB 연결 생성. config.backend 기반."""
    cfg = get_db_config()
    if not cfg.get('host') or not cfg.get('database') or not cfg.get('user'):
        raise ValueError(
            'DB 설정이 없습니다. Env/config/config.json (또는 config.json.example 복사) 에 backend.db_host, db_name, db_user, db_password 를 넣어주세요.'
        )
    return psycopg2.connect(**cfg, cursor_factory=RealDictCursor)


def format_value(value):
    """값 포맷팅 (JSON 직렬화 가능하도록)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float, bool)):
        return value
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
