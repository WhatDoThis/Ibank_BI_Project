"""
Backend.query_studio_server (쿼리 스튜디오 API 패키지)
====================================================
`/api/*` list-tables·execute-query 등. 프론트 `packages/query_studio` 와 쌍을 이룸. join_path·relationship_inference 등 패키지 전용 유틸.

[Exports]
=========
- router: FastAPI APIRouter (prefix /api)

[Dependencies]
=========
- Backend.query_studio_server.router
"""

from Backend.query_studio_server.router import router

__all__ = ["router"]
