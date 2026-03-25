"""
Backend.new_dash_server2.star_db (Star DB 연결 풀 — New Dashboard 2 전용)
=========================================================================
config.backend.star_db 전용. Backend.core.db import 금지. 패키지 내 자족 구현.

[Main Functions]
================
1. _PooledConnection: 풀 연결 래퍼 (close 시 putconn)
2. get_star_db_config: star_db 연결용 dict (host, port, database, user, password)
3. get_star_schema: table_schema 또는 "public"
4. get_star_db_connection: 풀에서 연결 반환; 풀 고갈 시 직접 connect fallback. RealDictCursor.

[Dependencies]
==============
- Env (config.backend.star_db)
- psycopg2, psycopg2.extras.RealDictCursor, psycopg2.pool
- threading
"""

import threading

import psycopg2
from psycopg2 import pool as psycopg2_pool
from psycopg2.extras import RealDictCursor

try:
    from Env import config
except ImportError:
    import sys as _sys
    from pathlib import Path as _Path
    _project_root = _Path(__file__).resolve().parent.parent.parent
    if str(_project_root) not in _sys.path:
        _sys.path.insert(0, str(_project_root))
    from Env import config

_STAR_DB_POOL: psycopg2_pool.ThreadedConnectionPool | None = None
_POOL_MIN = 1
_POOL_MAX = 5
_star_pool_lock = threading.Lock()


# 1.
class _PooledConnection:
    """풀에서 빌린 연결. close() 시 putconn()으로 풀 반환. db.py와 동일 구조(복사)."""

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


# 2.
def get_star_db_config():
    """config.backend.star_db에서 연결용 dict 반환. 없거나 비면 ValueError."""
    star = getattr(config.backend, "star_db", None)
    if star is None:
        raise ValueError("backend.star_db가 없습니다.")
    host = getattr(star, "db_host", None)
    port = getattr(star, "db_port", None)
    database = getattr(star, "db_name", None)
    user = getattr(star, "db_user", None)
    password = getattr(star, "db_password", None)

    if not host or not str(host).strip():
        raise ValueError("backend.star_db.db_host가 없거나 비어 있습니다.")
    if database is None or not str(database).strip():
        raise ValueError("backend.star_db.db_name이 없거나 비어 있습니다.")
    if not user or not str(user).strip():
        raise ValueError("backend.star_db.db_user가 없거나 비어 있습니다.")
    if port is None or port == "":
        raise ValueError("backend.star_db.db_port가 없습니다.")
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ValueError("backend.star_db.db_port는 숫자여야 합니다.")

    return {
        "host": str(host).strip(),
        "port": port,
        "database": str(database).strip(),
        "user": str(user).strip(),
        "password": str(password).strip() if password is not None else "",
    }


# 3.
def get_star_schema():
    """star_db의 table_schema. 없으면 'public'."""
    star = getattr(config.backend, "star_db", None)
    if star is None:
        return "public"
    return getattr(star, "table_schema", None) or "public"


# 4.
def get_star_db_connection():
    """Star DB 연결 반환. 풀 사용, 고갈 시 직접 connect fallback. UTF8, RealDictCursor."""
    global _STAR_DB_POOL
    with _star_pool_lock:
        if _STAR_DB_POOL is None:
            cfg = {**get_star_db_config(), "cursor_factory": RealDictCursor}
            _STAR_DB_POOL = psycopg2_pool.ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX, **cfg
            )
    try:
        raw = _STAR_DB_POOL.getconn()
        raw.set_client_encoding("UTF8")
        return _PooledConnection(_STAR_DB_POOL, raw)
    except Exception:
        cfg = get_star_db_config()
        conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
        conn.set_client_encoding("UTF8")
        return conn
