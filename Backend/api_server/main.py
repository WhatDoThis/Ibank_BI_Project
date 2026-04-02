"""
Backend.api_server.main (FastAPI 앱 진입점)
===========================================
FastAPI 앱 생성·CORS·라우터 등록·예외 핸들러. config.backend로 host/port 사용, uvicorn 기동.

[Main Functions]
===========
1. lifespan: ETL 배치 스케줄러(etl_server.scheduler_file) 기동
2. not_found_handler: 404 예외 시 JSON 응답
3. internal_error_handler: 500 예외 시 JSON 응답

[라우터]
===========
1. health_router: GET /health, GET /, GET /api, GET /api/ (api_server/routers/health)
2. auth_router: /api/auth/* — Backend.auth_server.router
3. project_router: /api/projects — Backend.project_server.router
4. notification_router: /api/notifications — Backend.notification_server.router
5. admin_router: /api/admin — Backend.admin_server.router
6. query_studio_router: /api/* — Backend.query_studio_server.router (엔드포인트별 require_permission)
7. etl_router: /api/etl/* — `dependencies=[require_etl_infrastructure]` (sa_dev 또는 etl_yn=Y)
8. campaign_dashboard_router: /api/campaign-dashboard/* — Star 테이블(`dependencies=[require_permission("dashboard")]`)
   (구 /api/dashboard·뉴 대시보드·마케팅 대시보드 라우터는 미등록 — 패키지는 저장소에 보존, 재연결 시 main에 include)

[Dependencies]
=========
- Env (config.backend), Backend.core.db, Backend.auth_server(router·permissions), Backend.api_server.routers, Backend.query_studio_server, Backend.etl_server.router, Backend.campaign_dash_server
- fastapi, uvicorn
"""

import os
import sys

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from Env import config
except ImportError:
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from Env import config

from Backend.core import db
from Backend.auth_server import router as auth_router
from Backend.auth_server.permissions import require_etl_infrastructure, require_permission
from Backend.project_server import router as project_router
from Backend.notification_server import router as notification_router
from Backend.admin_server import router as admin_router
from Backend.api_server.routers import health_router, query_studio_router
from Backend.etl_server import router as etl_router
from Backend.campaign_dash_server import router as campaign_dashboard_router

from contextlib import asynccontextmanager


# 1.
@asynccontextmanager
async def lifespan(app: FastAPI):
    """ETL 배치 스케줄러 기동. shutdown 시 yield 이후 정리 가능."""
    try:
        from Backend.etl_server import scheduler_file
        scheduler_file.start_scheduler()
        scheduler_file.load_active_batch_jobs()
    except Exception:
        pass
    yield


app = FastAPI(
    title="Starbucks CRM NoCode Query Builder API",
    description="노코드 쿼리 빌더 및 대시보드 API",
    lifespan=lifespan,
)

# 프론트(127.0.0.1:8080 등)에서 API 호출 시 CORS 허용. 500 응답에도 헤더가 붙도록 명시 origin 포함.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(project_router)
app.include_router(notification_router)
app.include_router(admin_router)
app.include_router(query_studio_router)
app.include_router(
    etl_router,
    dependencies=[Depends(require_etl_infrastructure)],
)
app.include_router(
    campaign_dashboard_router,
    dependencies=[Depends(require_permission("dashboard"))],
)


# 2.
@app.exception_handler(404)
def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "API 엔드포인트를 찾을 수 없습니다",
            "message": str(exc),
        },
    )


# 3.
@app.exception_handler(500)
def internal_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "서버 내부 오류",
            "message": str(exc),
        },
    )


if __name__ == "__main__":
    import io
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    backend = config.backend
    host = getattr(backend, "api_host", None)
    if host is None or not str(host).strip():
        raise ValueError("Env/config/config.json 에 backend.api_host 가 없거나 비어 있습니다.")
    host = str(host).strip()
    port = getattr(backend, "api_port", None)
    if port is None or port == "":
        raise ValueError("Env/config/config.json 에 backend.api_port 가 없습니다.")
    port = int(port)
    db_config = db.get_db_config()
    allowed = db.get_allowed_tables()

    print("=" * 50)
    print("Starbucks CRM NoCode Query Builder API (FastAPI)")
    print("=" * 50)
    print(f"Database: {db_config.get('database')}@{db_config.get('host')}")
    print(f"메인 스키마 테이블·뷰: {len(allowed)}개 (DB 메타데이터 기준)")
    print(f"Server: http://localhost:{port}")
    print(f"Health Check: http://localhost:{port}/health")
    print("=" * 50)

    import uvicorn
    uvicorn.run(app, host=host, port=port)
