"""
Backend.core (공유 DB·의존성·대시보드 집계 서비스)
=================================================
api_server·report_server·legacy_dashboard·new_dash_server·campaign_dash_server·etl_server 등이 공유하는 코어 모듈.

[Submodules]
===========
- db: 연결 풀·스키마·테이블 검증
- dependencies: FastAPI get_db, get_config
- dashboard_service: 구 대시보드·뉴/캠페인 대시보드 공통 집계 로직

[Package Usage]
===========
1. db: Backend/api_server, Backend/report_server, Backend/etl_server, Backend/new_dash_server, Backend/campaign_dash_server, Backend/core(내부), scripts
2. dependencies: Backend/api_server/routers, Backend/report_server
3. dashboard_service: 함수·패키지 대응은 dashboard_service.py의 [Package Usage] (1.~11.) 참고
"""
