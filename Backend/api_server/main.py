"""
Backend.api_server.main (FastAPI 앱 진입점)
===========================================
CORS, 라우터 등록, 예외 핸들러. config.backend 로 host/port 사용.

[Main Functions]
===========
- 루트·API 안내, 404/500 JSON 응답 (기존 형식 유지)

[Endpoints]
=======================
- GET /, GET /api, GET /api/ → health 라우터
- GET /health, /api/* → health·report·dashboard 라우터

[Dependencies]
=========
- Env (config.backend)
- Backend.api_server.db, Backend.api_server.routers
- fastapi, uvicorn
"""

import io
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
from Backend.api_server.routers import health_router, report_router, dashboard_router

app = FastAPI(
    title="Starbucks CRM NoCode Query Builder API",
    description="노코드 쿼리 빌더 및 대시보드 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router)
app.include_router(report_router)
app.include_router(dashboard_router)


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
