"""
Backend.core.dependencies (FastAPI 의존성 주입)
================================================
DB 연결·설정을 라우트에 주입. Depends(get_db), Depends(get_config)로 사용.

[Main Functions]
===========
1. get_db: 요청당 DB 연결 생성(yield), 응답 후 자동 close
2. get_config: config.backend 반환 (query_timeout_seconds, claude_api_key 등)

[Package Usage]
===========
1. Backend/api_server/routers/health, Backend/report_server/router

[Dependencies]
=========
- Backend.core.db, Env (config)
"""

from typing import Generator

from Backend.core import db

try:
    from Env import config
except ImportError:
    import sys
    from pathlib import Path
    _root = Path(__file__).resolve().parent.parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from Env import config


# 1.
def get_db() -> Generator:
    """요청 단위 DB 연결. 사용 후 자동 close."""
    conn = db.get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


# 2.
def get_config():
    """config.backend (Env/config/config.json)."""
    return config.backend
