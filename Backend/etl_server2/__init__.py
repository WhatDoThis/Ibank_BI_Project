"""
Backend.etl_server2 (ETL2 업그레이드 전용 백엔드 패키지)
========================================================
ETL2 페이지용 API. prefix /api/etl2. 09_ETL_Upgrade_Plan 적용 시 저장 DB·컬럼 매핑 등 확장 예정.
현재는 etl_server와 동일 메타(etl_* 테이블) 사용.

[Exports]
===========
router: FastAPI APIRouter. main에서 include_router로 등록.

[Dependencies]
=========
- Backend.etl_server2.router
"""

from Backend.etl_server2.router import router

__all__ = ["router"]
