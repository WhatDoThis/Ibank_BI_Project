"""
Backend.api_server.dependencies (FastAPI 의존성)
=================================================
DB 연결·설정 주입. 라우트에서 Depends(get_db), Depends(get_config) 사용.

[Main Functions]
===========
- get_db: 요청당 DB 연결 생성, 응답 후 자동 close (yield)
- get_config: config.backend 반환 (query_timeout_seconds, claude_api_key 등)

[Dependencies]
=========
- Backend.api_server.db, Env (config)
"""

from typing import Generator

from Backend.api_server import db

try:
    from Env import config
except ImportError:
    import os
    import sys
    from pathlib import Path
    _root = Path(__file__).resolve().parent.parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from Env import config


def get_db() -> Generator:
    """요청 단위 DB 연결. 사용 후 자동 close."""
    conn = db.get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


def get_config():
    """config.backend (Env/config/config.json)."""
    return config.backend
