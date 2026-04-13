"""
Backend.api_server.routers.health (헬스·루트·API 안내)
=====================================================
FastAPI 라우터. DB 연결 확인·루트·API 엔드포인트 목록 안내. tags=["health"].

[Main Functions]
===========
1. health_check: GET /health (DB SELECT 1 포함)
2. index: GET / (루트 안내)
3. api_index: GET /api, GET /api/ (`main.py` include_router 기준 요약 목록 JSON)

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
    """API 진입점: `Backend/api_server/main.py`에 마운트된 라우터 기준 요약(세부는 각 router.py)."""
    return {
        "message": "Starbucks CRM Query Builder API",
        "note": "요약입니다. 전 경로·스키마는 각 패키지 router.py 및 OpenAPI(/docs, 비활성일 수 있음)를 참고하세요.",
        "endpoints": [
            "GET  /health",
            "GET  /  (루트 안내)",
            "GET  /api, /api/ (본 목록)",
            "— 인증 /api/auth — POST signup, create-org, login, verify-login, refresh, logout",
            "GET/PATCH /api/auth/me, PATCH /me/password, GET /me/login-history, GET /invite/validate",
            "— 프로젝트 /api/projects — GET 목록, POST {id}/select, accept-invite, reject-invite",
            "— 알림 /api/notifications — GET 목록, GET unread-count, PATCH read-all, PATCH {id}/read",
            "— 어드민 /api/admin — users·roles·projects·tables·org·invite-codes 등 (세부는 router.py)",
            "— 쿼리 스튜디오 /api — GET list-tables, POST describe-table, GET table-relationships",
            "POST /api/execute-query, explain-sql, get-column-values, query-stats 등 (router.py 전체)",
            "— ETL /api/etl, /api/etl/batch — 연결·테이블·Job·배치 등 (etl_server/router*.py)",
            "GET  /api/campaign-dashboard/summary",
            "GET  /api/campaign-dashboard/trend",
            "GET  /api/campaign-dashboard/trend-multi",
            "GET  /api/campaign-dashboard/tables",
            "GET  /api/campaign-dashboard/member-summary",
            "GET  /api/campaign-dashboard/delivery-demographics",
            "GET  /api/campaign-dashboard/hourly",
            "— 위젯 보드 /api/widget-boards — 보드·위젯·레이아웃·초대·공유·데이터 (widget_board_server/router.py)",
        ],
    }
