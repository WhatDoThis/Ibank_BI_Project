# Report 인덱스 (Report Index)

**docs/report** 는 **코드 정리·코드 분석·코드 실행** 관련 내용만 포함합니다.  
개발문서(요구사항, 명세 등)는 **docs/main** 에만 둡니다.

- **백엔드 가이드**: 구조·API·etl_server 상세는 **docs/main/02_BACKEND_GUIDE.md** 참고. Flask→FastAPI 전환 계획은 해당 문서 부록 A에 참고용으로 정리됨. 전환 완료 로그는 log.md에 기록.

---

## docs/report 폴더 내 문서

| 파일명 | 용도 |
|--------|------|
| 00_ReportIndex.md | 본 인덱스. report 폴더 내 파일 목록 및 설명 |
| 01_ChartReadability.md | 차트 가독성: 디멘션·메트릭 불명확 시 가독성 저하 원인, ECharts 참고 요소·적용 방법, 기존 대시보드 적용 사항, EChartsChart 개선 방안 |
| 02_성과지표_리포트_체크리스트_대비_분석.md | 성과지표 리포트 6대 영역(목표·컨텍스트, 측정지표, 시각화, 분석·해석, 실행제안, 요약) 대비 현행 대시보드·문서 부합 현황, 개선 인사이트, 미구현 기능 구현 방향 |
| 03_대시보드2_성과리포트_개선_플랜.md | 대시보드2: 대시보드1 복사(공유 없음) → 목표·컨텍스트(HttpOnly 쿠키)·기간 표시·Executive Summary·지표 툴팁·신호등 등 페이즈별 개선 플랜 |
| 04_레이더차트_변경이력_데이터.md | 레이더 차트(ChartWidget2) 수정 회차별 요소·적용값·결과 데이터화, Recharts 동작 정리, 최적 속성 도출 및 적용 요약 |
| 05_대시보드2_주간월간_비교리포팅_플랜.md | 대시보드2: 주간/월간 취합·이전 주·이전 월 비교 리포팅 기능 테스트 적용 방안, 데이터/API 옵션, UI 설계, 페이즈별 구현 제안 |
| 06_I1_파생테이블_정의.md | I1 파생 테이블 정의, 생성 스크립트, 리포트 사이드바 폴더, 테이블명 소문자 등 |
| 07_newDashboard_Develop_Plan.md | NewDashboard 범용 대시보드: 요구사항 정리, 현행 대비 검토, 가능성 검토, Phase 0~5 개발 계획(백엔드 범용 API → 프론트 테이블/헤더 → KPI·목표·집계 테이블 → 위젯 beta → 비교·정리) |
| 08_ETL_Phase_Implement_Guide.md | ETL 가이드·참조 통합: 목적·범위·시스템 개요, config·메타 테이블·DDL 참조, 모듈 의존 관계, Job 확인 방법(운영), 재실행·ETA, 파일/DB 동작 검증 요약, Phase 순서·확장, §12 ETL 목록 동작 정리(등록 목록 버튼·상태별 동작) |
| 09_ETL_DB_Connection_Flow.md | ETL DB 연결 구조·실패 지점: 브라우저→API→외부 DB(49.247.47.206) 흐름 모식도, 경유 IP(Backend 호스트 IP) 설명, 코드 기준 fail 위치·메시지, 점검 순서 |
| log.md | 작업 완료 로그. 코드 정리·실행·점검 등 태스크 완료 시 갱신 |
| DEPLOY_SERVER.md | Linux 서버 배포 절차. 실제 배포: deploy.sh (빌드 + report-api/report-front 재시작). report-front 서비스는 run.py serve |
| nginx_report.conf | Nginx location 설정 (Report 대시보드: /report → 3500, /report_api → 8500). 서버 배포 시 참고 |
| REACT_MIGRATION_PLAN.md | Frontend React 전환 Phase 계획 (Phase 0~5, 검수 기준) |
