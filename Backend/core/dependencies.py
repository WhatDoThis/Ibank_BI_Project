"""
Backend.core.dependencies (FastAPI 의존성 주입)
================================================
DB 연결·설정을 라우트에 주입. Depends(get_db), Depends(get_config)로 사용.

[Main Functions]
===========
1. get_db: 요청당 메인 DB 연결(yield), 응답 후 close
2. get_config: config.backend 반환
3. get_system_db: 요청당 system_db 고정 연결(yield) — auth·project·notification·admin

[Package Usage]
===========
1. get_db: Backend/api_server/routers/health.py, Backend/query_studio_server/router.py(다수 엔드포인트 Depends)
2. get_config: Backend/query_studio_server/router.py(execute_query, save_query_as_table, explain_sql 등 Depends)
3. get_system_db: Backend/auth_server, project_server, notification_server, admin_server router Depends (system_db 고정)

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


# 3.
def get_system_db() -> Generator:
    """system_db 고정 연결. auth/admin/project/notification 서버용. 사용 후 close."""
    conn = db.get_db_connection_system_core()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
