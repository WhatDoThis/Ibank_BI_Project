"""
Backend.api_server.routers (호스트용 라우터 재export)
====================================================
health는 로컬, 쿼리 스튜디오는 query_studio_server에서 로드. 구 대시보드(/api/dashboard)는 main에 미등록(legacy_dashboard_server 패키지는 보존).

[Main]
===========
1. health_router, query_studio_router: 각 APIRouter 인스턴스

[Endpoints]
=======================
1. health: /health, /, /api, /api/
2. query_studio: /api/* (list-tables, execute-query 등)

[Dependencies]
=========
- .health, Backend.query_studio_server.router
"""

from .health import router as health_router
from Backend.query_studio_server.router import router as query_studio_router

__all__ = ["health_router", "query_studio_router"]
