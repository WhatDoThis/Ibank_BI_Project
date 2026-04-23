"""
Backend.core (공유 DB·의존성·대시보드 집계 서비스)
=================================================
api_server·campaign_dash_server·etl_server·widget_board_server 등이 공유하는 코어 모듈(query_studio_server 등 다른 앱에서도 import 가능).

[Submodules]
===========
- db: 연결 풀·스키마·테이블 검증
- logging_setup: 루트 로거 포맷(발생일시 / [LEVEL] 메시지)
- dependencies: FastAPI get_db, get_config
- dashboard_service: 캠페인 대시보드 등에서 사용하는 집계 로직(구형 라우터 미등록 시 일부 함수는 API 미사용)

[Package Usage]
===========
1. db: 함수·패키지 대응은 db.py의 [Package Usage] (1.~22.) 참고
2. dependencies: 함수·패키지 대응은 dependencies.py의 [Package Usage] (1.~2.) 참고
3. dashboard_service: 함수·패키지 대응은 dashboard_service.py의 [Package Usage] (1.~11.) 참고
"""
