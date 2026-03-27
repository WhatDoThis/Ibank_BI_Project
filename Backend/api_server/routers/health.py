"""
Backend.api_server.routers.health (헬스·루트·API 안내)
=====================================================
FastAPI 라우터. DB 연결 확인·루트·API 엔드포인트 목록 안내. tags=["health"].

[Main Functions]
===========
1. health_check: GET /health (DB SELECT 1 포함)
2. index: GET / (루트 안내)
3. api_index: GET /api, GET /api/ (엔드포인트 목록 JSON)

[Dependencies]
=========
- Backend.core.db, Backend.core.dependencies.get_db
- fastapi
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from Backend.core import db
from Backend.core.dependencies import get_db

router = APIRouter(tags=["health"])


# 1.
@router.get("/health")
def health_check(conn=Depends(get_db)):
    """DB 연결 확인 포함 헬스체크."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        return {
            "status": "healthy",
            "db": "connected",
            "message": "API 서버가 정상 작동 중입니다",
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "unhealthy", "error": str(e)},
        )


# 2.
@router.get("/")
def index():
    """루트: API 안내."""
    return {
        "message": "Starbucks CRM NoCode Query Builder API",
        "docs": "GET /api 에서 엔드포인트 목록 확인",
        "health": "GET /health 로 서버 상태 확인",
        "endpoints": ["/api", "/health"],
    }


# 3.
@router.get("/api")
@router.get("/api/")
def api_index():
    """API 진입점: 엔드포인트 목록."""
    return {
        "message": "Starbucks CRM Query Builder API",
        "endpoints": [
            "GET  /health",
            "GET  /api/list-tables",
            "POST /api/describe-table",
            "GET  /api/table-relationships",
            "POST /api/execute-query",
            "POST /api/explain-sql",
            "POST /api/get-column-values",
            "POST /api/query-stats",
            "GET  /api/campaign-dashboard/summary",
            "GET  /api/campaign-dashboard/trend",
            "GET  /api/campaign-dashboard/trend-multi",
            "GET  /api/campaign-dashboard/tables",
            "GET  /api/campaign-dashboard/member-summary",
            "GET  /api/campaign-dashboard/delivery-demographics",
            "GET  /api/campaign-dashboard/hourly",
        ],
    }
