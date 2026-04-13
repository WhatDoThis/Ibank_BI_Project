"""
Backend (백엔드 패키지)
======================
FastAPI 기반 API 서버. 추후 확장 예정.

[Main Modules]
===========
- Backend.core: 공유 DB·의존성·dashboard_service
- Backend.query_studio_server: 쿼리 스튜디오 `/api/*` 라우터 및 조인·추론 유틸
- Backend.campaign_dash_server: 캠페인 대시보드 /api/campaign-dashboard
- Backend.api_server: FastAPI 앱 조립·CORS·라우터 등록 (호스트)

[Dependencies]
=========
- Env (config), FastAPI, uvicorn, psycopg2 등 (api_server 하위 모듈에서 사용)
"""
