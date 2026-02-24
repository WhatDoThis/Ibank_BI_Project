"""
Backend.etl_server (ETL 전용 백엔드 패키지)
===========================================
ETL 메타·파일 업로드·DB 연동·Job 큐 등 ETL API 제공. prefix /api/etl.
시스템 DB(ibank_system_data)의 etl_* 테이블 사용.

[Exports]
===========
17 - router: FastAPI APIRouter. main에서 include_router로 등록.

[Dependencies]
=========
- Backend.etl_server.router
"""

from Backend.etl_server.router import router

__all__ = ["router"]
