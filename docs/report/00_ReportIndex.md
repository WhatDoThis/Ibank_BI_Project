# Report 인덱스 (Report Index)

**docs/report** 는 **코드 정리·코드 분석·코드 실행** 관련 내용만 포함합니다.  
개발문서(요구사항, 명세 등)는 **docs/main** 에만 둡니다.

- **백엔드 Flask → FastAPI 전환 계획**: 단계별 플랜은 **docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md** 참고. 전환 작업 완료 시 본 report 폴더의 log.md에 기록.

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
| log.md | 작업 완료 로그. 코드 정리·실행·점검 등 태스크 완료 시 갱신 |
| DEPLOY_SERVER.md | Linux 서버 배포 절차. 실제 배포: deploy.sh (빌드 + report-api/report-front 재시작). report-front 서비스는 run.py serve |
| nginx_report.conf | Nginx location 설정 (Report 대시보드: /report → 3500, /report_api → 8500). 서버 배포 시 참고 |
| REACT_MIGRATION_PLAN.md | Frontend React 전환 Phase 계획 (Phase 0~5, 검수 기준) |
