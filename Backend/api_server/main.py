"""
Backend.api_server.main (FastAPI 앱 진입점)
===========================================
FastAPI 앱 생성·CORS·라우터 등록·예외 핸들러. config.backend로 host/port 사용, uvicorn 기동.

[Main Functions]
===========
1. `# 1.` lifespan: ETL 배치 스케줄러(etl_server.scheduler_file) 기동(실패 시 예외 스택을 로깅하고 API 기동은 계속)
2. `# 2.` not_found_handler: 404 예외 시 JSON 응답
3. `# 3.` internal_error_handler: 500 예외 시 JSON 응답
- CorrelationIdMiddleware: `app.add_middleware`로 등록(본문 `#` 생략, correlation 모듈 `# 1.`).

[기동]
===========
- `python -m Backend.api_server.main`(또는 run.py): 메인 DB 설정 확인·콘솔에 `config.backend` 바인딩(host:port)·127.0.0.1 헬스 URL(0.0.0.0 바인딩 시 안내용)

[라우터]
===========
1. health_router: GET /health, GET /, GET /api, GET /api/ (api_server/routers/health)
2. auth_router: /api/auth/* — Backend.auth_server.router
3. project_router: /api/projects — Backend.project_server.router
4. notification_router: /api/notifications — Backend.notification_server.router
5. admin_router: /api/admin — Backend.admin_server.router
6. system_log_router: /api/system-logs — Backend.system_log_server.router (system_log 목록·`/login-history/me|org`; **라우터 레벨 Depends 미적용**, `/login-history/me`는 `require_active_access`, 그 외는 엔드포인트별 `require_org_admin`)
7. query_studio_router: /api/* — Backend.query_studio_server.router (엔드포인트별 require_permission)
8. etl_router: /api/etl/* — `dependencies=[require_etl_infrastructure]` (sa_dev 또는 etl_yn=Y)
9. campaign_dashboard_router: /api/campaign-dashboard/* — Star 테이블(`dependencies=[require_permission("dashboard")]`)
10. widget_board_router: /api/widget-boards/* — 위젯 보드 메타·레이아웃(`dependencies=[require_permission("widgetboard")]`)
10a. widget_board_admin_router: POST /api/widget-boards/admin/backfill-profiles (`require_org_admin` 단독)

[Dependencies]
=========
- Env (config.backend), Backend.core.db, Backend.core.request_context, Backend.api_server.middleware.correlation, Backend.auth_server(router·permissions), Backend.api_server.routers, Backend.system_log_server, Backend.query_studio_server, Backend.etl_server.router, Backend.campaign_dash_server, Backend.widget_board_server
- logging (표준), fastapi, uvicorn
"""

import logging
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
from Backend.admin_server.deps import require_org_admin
from Backend.api_server.middleware.correlation import CorrelationIdMiddleware
from Backend.api_server.routers import health_router, query_studio_router
from Backend.system_log_server import router as system_log_router
from Backend.etl_server import router as etl_router
from Backend.campaign_dash_server import router as campaign_dashboard_router
from Backend.widget_board_server import admin_router as widget_board_admin_router, router as widget_board_router

from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


# 1.
@asynccontextmanager
async def lifespan(app: FastAPI):
    """ETL 배치 스케줄러 기동. 실패 시 로깅만 하고 API는 계속 기동. shutdown 시 yield 이후 정리 가능."""
    try:
        from Backend.etl_server import scheduler_file
        scheduler_file.start_scheduler()
        scheduler_file.load_active_batch_jobs()
    except Exception:
        logger.exception(
            "ETL 폴더 배치 스케줄러 기동에 실패했습니다. API 서버는 계속 기동하며 "
            "폴더 기반 배치 스케줄링은 비활성 상태입니다."
        )
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
app.add_middleware(CorrelationIdMiddleware)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(project_router)
app.include_router(notification_router)
app.include_router(admin_router)
# system_log_router: 라우터 레벨 Depends(require_org_admin) 미적용.
# /login-history/me 는 require_active_access(일반 사용자 본인 이력),
# 나머지는 엔드포인트별 require_org_admin 개별 적용.
app.include_router(system_log_router)
app.include_router(query_studio_router)
app.include_router(
    etl_router,
    dependencies=[Depends(require_etl_infrastructure)],
)
app.include_router(
    campaign_dashboard_router,
    dependencies=[Depends(require_permission("dashboard"))],
)
app.include_router(
    widget_board_router,
    dependencies=[Depends(require_permission("widgetboard"))],
)
app.include_router(
    widget_board_admin_router,
    prefix="/api/widget-boards",
    dependencies=[Depends(require_org_admin)],
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
    from Backend.core.logging_setup import configure_root_logging

    configure_root_logging()
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
    db_config = db.get_main_db_config()

    print("=" * 50)
    print("Starbucks CRM NoCode Query Builder API (FastAPI)")
    print("=" * 50)
    print(f"Database: {db_config.get('database')}@{db_config.get('host')} (연결 설정 로드됨)")
    print("프로젝트별 허용 테이블은 table_project_mapping 기준이며, 기동 시 전 스키마 테이블 수로 표시하지 않습니다.")
    # api_host 가 0.0.0.0 이면 브라우저 URL은 localhost 가 아님 — 바인딩 주소만 표시
    print(f"Listen: {host}:{port} (uvicorn)")
    print(f"Health (이 호스트 기준): http://127.0.0.1:{port}/health")
    print("=" * 50)

    import uvicorn
    uvicorn.run(app, host=host, port=port)
