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
| log.md | 작업 완료 로그. 코드 정리·실행·점검 등 태스크 완료 시 갱신 |
| DEPLOY_SERVER.md | Linux 서버 배포 절차 (report-front는 run.py serve, 배포 시 빌드 후 재시작) |
| nginx_report.conf | Nginx location 설정 (Report 대시보드: /report → 3500, /report_api → 8500). 서버 배포 시 참고 |
| REACT_MIGRATION_PLAN.md | Frontend React 전환 Phase 계획 (Phase 0~5, 검수 기준) |
