"""
Backend.etl_server (ETL 백엔드 패키지)
========================================
ETL 페이지 전용 API. prefix /api/etl. 저장 DB·컬럼 매핑·폴더/DB 배치·변환 룰·Job 큐.
router(메인) + router_file(배치) 포함 → /api/etl, /api/etl/batch.

[Exports]
===========
1. router: FastAPI APIRouter (api_server.main에서 include_router). router_file은 router 내부에서 include.

[Dependencies]
=========
- Backend.etl_server.router
"""

from Backend.etl_server.router import router

__all__ = ["router"]
