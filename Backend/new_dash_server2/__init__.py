"""
Backend.new_dash_server2 (New Dashboard 2 — 마케팅 성과 분석 대시보드 백엔드)
==============================================================================
star_db(ibank_star_data) 전용 패키지. db.py·dashboard_service import 금지.

[Exports]
=========
1. router: FastAPI APIRouter (prefix /api/new-dashboard2)

[Dependencies]
==============
- Env.config (backend.star_db)
- psycopg2, fastapi
"""

from .router import router

__all__ = ["router"]
