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
| 04_레이더차트_변경이력_데이터.md | 레이더 차트(ChartWidget2) 수정 회차별 요소·적용값·결과 데이터화, Recharts 동작 정리, 최적 속성 도출 및 적용 요약 |
| 06_I1_파생테이블_정의.md | I1 파생 테이블 정의, 생성 스크립트, 리포트 사이드바 폴더, 테이블명 소문자 등 |
| 07_newDashboard_Develop_Plan.md | NewDashboard 범용 대시보드: 요구사항 정리, 현행 대비 검토, 가능성 검토, Phase 0~5 개발 계획(백엔드 범용 API → 프론트 테이블/헤더 → KPI·목표·집계 테이블 → 위젯 beta → 비교·정리) |
| 08_ETL_Phase_Implement_Guide.md | ETL 가이드·참조: 목적·범위·시스템 개요, config·메타 테이블·모듈 의존, Job 확인(운영), 재실행·파일/DB 동작, DB 연결 실패 시 점검, Phase·구현 요약, ZIP 추가 적재, ETL 목록 버튼·설정 모달, **COPY 적재 이해하기**(비유·단계·Upsert·on_row_error), DB 적재 상세(COPY·Upsert·fallback), 매핑 형변환·행 실패 정책. |
| 09_ETL_SFTP_Connection.md | Batch Sync 설계서: 원격 폴더(SFTP/S3) 기반 자동 증분 적재. DB(batch_*) 반영 완료. 아키텍처: Backend/etl_server2 통합(*_file.py), packages/etl2/components(*File.jsx), ETL2 페이지 "폴더 등록" 탭. |
| 10_DB_Batch_Scheduling_Upgrade.md | DB 연결 기반 배치 스케줄링: batch_jobs 확장(job_type, connection_id, source_table 등), batch_executor_db·스케줄러 분기·service_file·router_file 작업 체크리스트, 정제 사항 7건, DB 실행 명령 참고. 서브에이전트 병렬 작업용. |
| 11_ETL_Transform_Upgrade_Guide.md | ETL Transform 업그레이드 — **커서 AI 실행 가이드**: Step 1~20(엔진·서비스·라우터), **§2 화면 설계** Step UI-1~UI-10(변환 미리보기 API·버튼·패널, 문자열 4종 입력·안내, Before→After 예시, 마스킹 비가역 경고, 하이라이트/필터, 값 매핑 팝오버, boolean/date 설정). 병렬 실행 표·체크리스트 포함. |
| 12_뉴대시보드_제작_플랜.md | **뉴대시보드(일간/주간/월간 현황판) 제작 플랜**: ibank_test_data.ibank_1 연동. Phase 1(summary+증감률, trend-multi, tables) → 2a/2b(API 4함수, period 기본값 monthly) → 3(period 기본 monthly, trendMulti) → 4(SummaryHeader, KPISummaryCards 미니도넛+증감, ChannelDonutSection, TrendLineChart 5라인, FunnelSection 5단계 전환, CampaignRankTable 탭) → 5(CSS) → 6(라우팅·사이드바) → 7(검증). 프로토타입 대조 표·체크리스트·서브에이전트 배정 포함. |
| 13_New_Dashboard2_Develop_Plan.md | **New Dashboard 2(마케팅 성과 분석 대시보드) 개발 계획서**: star_db(ibank_star_data) 전용 백엔드 new_dash_server2 + 프론트 new-dashboard2 패키지. 6개 집계 테이블(dashboard_overall, star_analyze_overall, frequency_analyze_overall, coupon_analyze_overall, campaign_segment_overall, store_order_analyze_overall) + star_product_master. Phase 1(DB·service·router) → 1-reg(main 등록) → 2(client 8함수) → 3~9(공통 컴포넌트·탭별 섹션) → 10(CSS) → 11(라우팅) → 12(검증). 서브에이전트 단위 구현용 Step·체크리스트·API·Props 명시. |
| 14_ETL_PK_DIFF.md | **ETL PK Diff 동기화 모드 설계서**: sync_mode=diff 추가. 소스/타겟 PK 목록 비교로 신규·삭제 행만 동기화. Backend/etl_server 기준 파일별 수정(service, db_load_service, batch_executor_db, service_file, router, router_file), 스키마·검증·테스트 시나리오·구현 순서. |
| 15_New_Dashboard_Upgrade_Plan.md | **뉴 대시보드 업그레이드 설계서(커서 실행용)**: 회원 현황·발송 인구통계·시간대별 분석 섹션 추가. Phase 1(router 3 엔드포인트) → 2(client 3함수) → 3A(회원/인구통계 컴포넌트 4종) → 3B(formatDateLabel export) → 3C(ChannelStackBarChart, HourlyBarChart) → 4(NewDashboardPage 통합) → 5(CSS) → 6(검증). 서브에이전트 배정·체크리스트·파일 목록 포함. |
| 16_Campaign_Dashboard_Star_Schema_Plan.md | **캠페인 대시보드(Star 스키마) 개발 계획서**: `ibank_1`~`ibank_1_4` → `ibank_1_star_1`/`ibank_1_star_2` 컬럼·JSONB 매핑 검증, API 계약 유지 전제하의 `campaign_dash_server`·`campaign_dashboard` 패키지 Phase 표·체크리스트·table_id·db 검증 주의사항. |
| 17_SystemDB_Commercialization_Implementation_Guide.md | **시스템 DB 추가 및 상용화 개발 구현 가이드**: DB·config·인증·권한·프로젝트·알림·화면·API. **§10.4 M1/M2**, **§13** 전사 공통 `table_master`/ETL·`require_etl_infrastructure`. **docs/main/04·05·06** 과 교차 참조. **§12** 서브에이전트·`.cursor/`. |
| 18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md | **ibank_etl_data 실측 스키마·생성자·CURL/FE 체크리스트**: `protocol`/`folder_type`, `id`/`registry_id` PK, `create_user_id`·`create_user_label` API/화면 정합, 동적 컬럼 감지 요약. |
| etc01_Backend_Learning_Flow.md | **ETL2 학습 가이드**: Backend/etl_server2 + packages/etl2 기준. 시스템 목적·아키텍처·레이어별 파일 역할·데이터 흐름(함수·라이브러리 단위)·학습 순서(의존도)·API·패턴·한도·ERD. 처음 접하는 개발자용. | 백엔드 코드 학습 흐름도: 파일별 내부 의존도 수치·역할, 권장 학습 순서(의존 0→1→2→4단계), 학습 흐름도·기능 대응표. 코드 리뷰용 |
| log.md | 작업 완료 로그. 코드 정리·실행·점검 등 태스크 완료 시 갱신 |
| ETL_Transform_Rules_Implementation_Plan.md | ETL 변환 룰 매핑 모달 통합 제작 플랜. Phase 1(미리보기 API)·Phase 4(client.js)·Phase 2(변환 열)·Phase 3(미리보기 패널)·적용 시 룰 삭제 후 생성, 제약 사항 |
| DEPLOY_SERVER.md | Linux 서버 배포 절차. 실제 배포: deploy.sh (빌드 + report-api/report-front 재시작). report-front 서비스는 run.py serve |
| nginx_report.conf | Nginx location 설정 (SPA: /ibank-bi/query-studio 등 → 3500, /report_api → 8500). 서버 배포 시 참고 |
| REACT_MIGRATION_PLAN.md | Frontend React 전환 Phase 계획 (Phase 0~5, 검수 기준) |
