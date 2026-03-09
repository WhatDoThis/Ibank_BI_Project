"""
Backend.api_server.main (FastAPI 앱 진입점)
===========================================
FastAPI 앱 생성·CORS·라우터 등록·예외 핸들러. config.backend로 host/port 사용, uvicorn 기동.

[Functions]
===========
lifespan: ETL Job 큐 워커·배치 스케줄러(etl_server2.scheduler_file) 기동
not_found_handler: 404 예외 시 JSON 응답
internal_error_handler: 500 예외 시 JSON 응답

[라우터]
===========
health_router: GET /health, GET /, GET /api, GET /api/
report_router: /api/* (list-tables, describe-table, execute-query, explain-sql 등)
dashboard_router: /api/dashboard/* (data, filter-options, tables, required-columns, chart-data)
dashboard2_router: /api/dashboard2/* (동일)
etl_router: /api/etl/* (ETL 메타·업로드·연결 테스트·Job·add-file·add-files-zip 등)
etl2_router: /api/etl2/* (ETL2 페이지용, 09_ETL_Upgrade_Plan 확장 예정)
new_dashboard_router: /api/new-dashboard/* (summary, trend, trend-multi, tables)

[Dependencies]
=========
- Env (config.backend), Backend.api_server.db, Backend.api_server.routers, Backend.etl_server.router, Backend.etl_server2.router, Backend.new_dash_server
- fastapi, uvicorn
"""

import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from Env import config
except ImportError:
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from Env import config

from Backend.api_server import db
from Backend.api_server.routers import health_router, report_router, dashboard_router, dashboard2_router
from Backend.etl_server import router as etl_router
from Backend.etl_server2 import router as etl2_router
from Backend.new_dash_server import router as new_dashboard_router

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """ETL Job 큐 워커·배치 스케줄러 기동. shutdown 시 yield 이후 정리 가능."""
    try:
        from Backend.etl_server import queue_worker
        queue_worker.start_background_worker()
    except Exception:
        pass
    try:
        from Backend.etl_server2 import scheduler_file
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
app.include_router(report_router)
app.include_router(dashboard_router)
app.include_router(dashboard2_router)
app.include_router(etl_router)
app.include_router(etl2_router)
app.include_router(new_dashboard_router)


@app.exception_handler(404)
def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "API 엔드포인트를 찾을 수 없습니다",
            "message": str(exc),
        },
    )


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
    print(f"Allowed Tables: {len(allowed)}개")
    print(f"Server: http://localhost:{port}")
    print(f"Health Check: http://localhost:{port}/health")
    print("=" * 50)

    import uvicorn
    uvicorn.run(app, host=host, port=port)
