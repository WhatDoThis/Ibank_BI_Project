"""
Backend (백엔드 패키지)
======================
FastAPI 기반 API 서버. 추후 확장 예정.

[Main Modules]
===========
- Backend.core: 공유 DB·의존성·dashboard_service
- Backend.report_server: 리포트/노코드 쿼리 빌더 라우터 및 조인·추론 유틸
- Backend.legacy_dashboard_server: 구 /api/dashboard 라우터
- Backend.api_server: FastAPI 앱 조립·CORS·라우터 등록 (호스트)

[Dependencies]
=========
- Env (config), FastAPI, uvicorn, psycopg2 등 (api_server 하위 모듈에서 사용)
"""
