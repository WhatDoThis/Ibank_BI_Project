## 2026-03-16 ETL PK Diff Phase 7: router run_table_load diff 사전 검증

**목적:** run_table_load에서 DB 소스·sync_mode=diff일 때 pk_columns·타겟 테이블 존재 사전 검증 및 suggested_action 반환 (14_ETL_PK_DIFF.md §3.5).

**적용 내용:**
1. DB 소스(postgresql/mysql/oracle)이고 get_sync_mode_for_load(etl_table_id)=="diff"일 때, Job 등록 전 검증.
2. pk_columns 미설정 시 HTTPException(400, detail={message, suggested_action: "ETL 테이블 설정에서 pk_columns를 지정하세요."}).
3. target_table_exists(storage_connection_id, target_table) False 시 HTTPException(400, detail={message, suggested_action: "sync_mode를 full로 설정하여 최초 적재를 실행한 뒤, sync_mode를 diff로 변경하세요."}).
4. 검증 통과 후 기존대로 insert_job(pending) 및 queue_worker 시작.

**변경 파일:** Backend/etl_server/router.py, docs/report/log.md.

---

## 2026-03-16 ETL PK Diff Phase 6: batch_executor_db에 diff 분기

**목적:** batch_executor_db에서 sync_mode=diff 시 _run_diff_sync(is_batch=True) 호출 (14_ETL_PK_DIFF.md §3.3).

**적용 내용:**
1. sync_mode 정규화에 "diff" 추가 (etl_table_id 모드·독립 모드 공통).
2. mapping_used 확정 직후, while fetch 루프 전에 sync_mode == "diff" 분기: pk_list 없으면 ValueError. diff_delete_orphans는 etl_table_id면 etl_def, 독립 모드면 job에서 조회.
3. row_diff, columns_tuples, type_mapper(stype별), select_list_diff·col_names_diff(매핑 시 소스 컬럼만) 구성 후 _run_diff_sync(..., is_batch=True) 호출.
4. finish_run(success, rows_inserted=result), update_job_status(success) 후 return. last_synced_at 갱신 없음.
5. 상단 Main Functions·Dependencies 갱신.

**변경 파일:** Backend/etl_server/batch_executor_db.py, docs/report/log.md.

---

## 2026-03-16 ETL PK Diff Phase 5: run_db_load에 diff 분기

**목적:** run_db_load 내 sync_mode=diff 전용 분기 추가 (14_ETL_PK_DIFF.md §3.2.4).

**적용 내용:**
1. select_list 확정 직후, where_clause/params 설정 전에 `if sync_mode == "diff":` 분기 추가.
2. pk_columns 없으면 실패 반환 + suggested_action. 타겟 연결 후 타겟 테이블 존재 확인(SELECT 1 ... LIMIT 1), 실패 시 실패 반환 + suggested_action.
3. _run_diff_sync(..., is_batch=False) 호출 후 완료 시 update_job(completed), update_etl_table_status(done), 연결 정리 후 return. 예외 시 update_job(failed), suggested_action 포함 반환.
4. 분기 전체 try/except/finally: finally에서 conn_main_diff·src_conn close. return 직전 성공/타겟검사실패 경로에서 close 후 None 설정으로 상위 except의 중복 close 방지.

**변경 파일:** Backend/etl_server/db_load_service.py, docs/report/log.md.

---

## 2026-03-16 ETL PK Diff Phase 4: _run_diff_sync 구현

**목적:** sync_mode=diff 핵심 로직 _run_diff_sync 추가 (14_ETL_PK_DIFF.md §3.2.3).

**적용 내용:**
1. **_run_diff_sync**: 소스/타겟 PK 집합 조회 → new_pks/deleted_pks 계산, MAX_DIFF_PK_COUNT(10_000_000) 검사, is_batch 분기(진행률·취소 생략).
2. 신규 PK 배치(1000건)별: Oracle 복합 PK는 OR 체인 WHERE, 단일/비Oracle은 IN 절 → SELECT → DataFrame → 시간대·변환 룰·매핑 형변환 → _copy_insert_batch. 커서 1개 재사용·finally에서 close.
3. diff_delete_orphans 시 타겟에서 deleted_pks 배치 DELETE (PostgreSQL VALUES 구문).
4. 반환: rows_inserted, rows_deleted. 상단 Main Functions 목록 갱신.

**변경 파일:** Backend/etl_server/db_load_service.py, docs/report/log.md.

---

## 2026-03-16 ETL PK Diff Phase 3: db_load_service PK 값 집합 조회 함수 추가

**목적:** sync_mode=diff용 소스/타겟 PK 값 집합 조회 함수 추가 (14_ETL_PK_DIFF.md §3.2.1, §3.2.2).

**적용 내용:**
1. **_fetch_pk_values_from_source**: conn, quoted_table, pk_columns, quote_fn, source_type 인자. SELECT pk1,pk2,... FROM quoted_table → fetchmany(10000) 반복, set 수집. 단일/복합 PK 각각 스칼라·튜플 set.
2. **_fetch_pk_values_from_target**: conn, schema, table_name, pk_columns. 타겟(PostgreSQL)에서 동일 방식으로 PK 값 set 조회.
3. **_row_to_pk_key**: tuple/dict 행에서 PK 키 추출 (Oracle 대문자 컬럼명 대비).
4. _DIFF_PK_FETCH_BATCH = 10000 상수, 상단 Main Functions 목록 갱신.

**변경 파일:** Backend/etl_server/db_load_service.py, docs/report/log.md.

---

## 2026-03-16 ETL PK Diff: migrations 폴더 삭제, Phase 1·2 완료

**목적:** 사용자가 DB 마이그레이션을 직접 적용했으므로 Backend/etl_server/migrations 폴더 삭제. 14_ETL_PK_DIFF.md 기준 Phase 1·2 구현.

**적용 내용:**
1. **migrations 폴더 삭제**: 001_etl_pk_diff_sync_mode.sql, README.md 삭제 후 폴더 제거.
2. **Phase 1 (service.py)**: get_sync_mode_for_load에 'diff' 반환, create_etl_table·update_etl_table에 sync_mode 'diff' 허용, diff 시 타겟 테이블 존재 검사 추가.
3. **Phase 2**: service_file.py — create_batch_job에 diff_delete_orphans 인자·INSERT 컬럼, update_batch_job에 sync_mode 'diff'·diff_delete_orphans 허용. router.py — CreateTableBody/UpdateTableBody sync_mode description에 diff. router_file.py — CreateBatchJobBody/UpdateBatchJobBody에 diff_delete_orphans, sync_mode description에 diff. etl_tables·batch_jobs 목록/단건 SELECT에 diff_delete_orphans 추가.

**변경 파일:** Backend/etl_server/service.py, service_file.py, router.py, router_file.py, docs/report/log.md.

---

## 2026-03-16 docs/report 14_ETL_PK_DIFF 설계서 최종 점검 3건 반영

**목적:** PK Diff 설계서(14_ETL_PK_DIFF.md)에 남은 이슈 3건을 반영해 Cursor AI 구현 시 누락·모호함이 없도록 보완.

**적용 내용:**
1. **§3.2.3 _run_diff_sync**: 인자 `is_batch: bool = False` 추가. `is_batch=True`이면 set_job_total_rows/update_job_progress/is_job_cancelled 호출 생략. run_db_load는 is_batch=False, batch_executor_db는 is_batch=True로 호출하도록 명시.
2. **§3.2.4 run_db_load diff 분기**: diff 분기 전체를 try/except/finally로 감싸고, finally에서 conn_main.close()·src_conn.close() 보장. return 직전 src_conn=None, conn_main=None 설정으로 상위 finally 중복 close 방지.
3. **§3.4 service_file.py**: create_batch_job에 diff_delete_orphans 인자·INSERT 컬럼 추가, update_batch_job에 "diff_delete_orphans" updatable 필드 추가.
4. **§3.6 router_file.py**: CreateBatchJobBody·UpdateBatchJobBody에 diff_delete_orphans 필드 추가 명시.

**변경 파일:** docs/report/14_ETL_PK_DIFF.md.

---

## 2026-03-16 docs/report 14_ETL_PK_DIFF 설계서 작성

**목적:** ETL PK Diff 동기화 모드(sync_mode=diff) 계획·설계서를 현재 패키지 구조(Backend/etl_server) 기준으로 docs/report에 추가.

**적용 내용:**
1. **14_ETL_PK_DIFF.md** 신규 작성: 개요·동작 원리·전제 조건, DB 스키마(sync_mode에 diff 허용·diff_delete_orphans 선택 컬럼), Backend/etl_server 파일별 수정(service, db_load_service, batch_executor_db, service_file, router, router_file), 검증·프론트 라벨·테스트 시나리오·구현 순서·향후 확장·패키지 대응표.
2. **00_ReportIndex.md**: 14_ETL_PK_DIFF.md 항목 추가.

**변경 파일:** docs/report/14_ETL_PK_DIFF.md, docs/report/00_ReportIndex.md, docs/report/log.md.

---

## 2026-03-13 docs/main·README 현재 구조 반영 (ETL 단일화·뉴 대시보드 2종)

**목적:** log.md 및 코드 구조 기준으로 개발 문서(docs/main)·README를 현재 시스템에 맞게 개편. ETL1 제거·ETL2 단일 ETL로 통일, 뉴 대시보드 2종(뉴 대시보드·마케팅 대시보드) 반영.

**적용 내용:**
1. **00_PRD.md**: §1.2 ETL2 제거·ETL 단일(저장 DB·배치·폴더)·뉴 대시보드·마케팅 대시보드 추가. §2.1 패키지/백엔드 구조(etl_server 단일, new_dash_server, new_dash_server2). §2.2 접속 경로에서 /etl2 제거, /new-dashboard·/new-dashboard2 추가. §4·§5.2 API 목록. §6.3·§6.3.1 단일 ETL로 통합, §6.3.2 뉴 대시보드·마케팅 대시보드 요약. §8 변경 이력 추가.
2. **01_FRONTEND_GUIDE.md**: §1.1·§1.2 패키지·접속 경로(etl 단일, new-dashboard, new-dashboard2). §3 디렉터리 트리(etl2 제거, new-dashboard·new-dashboard2·etl 단일). §4.5 ETL 단일·§4.5.2 new-dashboard·§4.5.3 new-dashboard2. §4.6 shared client.js API 목록. 변경 이력 추가.
3. **02_BACKEND_GUIDE.md**: 구현 위치에 new_dash_server·new_dash_server2. §2 아키텍처 트리(etl_server2 제거, etl_server 단일에 router_file·batch·저장 DB 등 통합, new_dash_server·new_dash_server2 추가). 라우터 등록 순서 etl2_router 제거·new_dashboard_router·new_dash2_router 추가. §4.6 ETL prefix /api/etl·/api/etl/batch, §4.7 뉴 대시보드·§4.8 마케팅 대시보드 API 표. §5.1 main.py 라우터. §6.7 "etl_server (단일 ETL)". 변경 이력 추가.
4. **README.md**: ETL2 섹션 제거·뉴 대시보드·마케팅 대시보드 섹션 추가. ETL 단일(저장 DB·배치·폴더) 설명. 접속 경로·사용 흐름·프로젝트 구조 트리(etl2 제거, new-dashboard·new-dashboard2·etl 단일). docs/main 최종 반영 일자 2026-03-13.

**변경 파일:** docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, README.md, docs/report/log.md.

---

## 2026-03-13 Frontend/packages 주석 설명 정리 (서브에이전트 분산 적용)

**목적:** Backend와 동일 규칙으로 Frontend/react-app/src/packages 내 각 패키지의 상단 docstring 및 함수/컴포넌트 위 순번 주석(// 1. // 2. …) 적용. 파일 수가 많아 fe-impl 서브에이전트로 패키지별 분산 처리.

**적용 내용:**
1. **report**: 상단 [Main Functions]/[Components] 번호 목록화, 함수/컴포넌트 위 // 1.~N. 추가. (QueryStudioPage, Sidebar, MainArea, utils/*, hooks/useQueryStudioData 등 11개 파일)
2. **dashboard**: 상단 번호 목록화, periodCompare·DashboardPage·컴포넌트별 순번 주석. AggregatedDataTable.jsx에 isFilterConditionEmpty 위 // 7. 추가(유니코드 이슈로 서브에이전트에서 누락된 부분 메인에서 보완). (12개 파일)
3. **dashboard2**: 상단 번호 목록화, 11개 파일 전체 함수/컴포넌트 순번 주석.
4. **widgetboard**: index.jsx, Dashboard3Page.jsx, utils/dataUtils.js 상단·순번 주석. (3개 파일)
5. **etl**: ETLPage, index, utils/storageDb, components 28개 파일 상단·순번 주석.
6. **new-dashboard**: index, NewDashboardPage, KPISummaryCards, SummaryHeader, TrendLineChart, CampaignRankTable, dateUtils, FunnelSection 등 8개 파일.
7. **new-dashboard2**: index, NewDashboard2Page, hooks/useNewDash2Data, utils, components 19개 파일.

**규칙:** 기존 파일은 StrReplace만 사용, 5~30줄 단위 소규모 수정. __tests__ 제외.

**변경 파일:** Frontend/react-app/src/packages/{report,dashboard,dashboard2,widgetboard,etl,new-dashboard,new-dashboard2} 내 .js/.jsx 소스 파일 전체, docs/report/log.md.

---

## 2026-03-13 Backend/new_dash_server, new_dash_server2 주석 설명 정리

**목적:** api_server·etl_server와 동일 규칙으로 new_dash_server·new_dash_server2 패키지 상단 docstring 및 함수/클래스 위 순번 주석(# 1. # 2. …) 적용.

**적용 내용:**
1. **new_dash_server**: __init__.py Exports 1. / router.py 함수별 # 1.~# 11. (_calc_date_range, _calc_previous_range, _calc_change_pct, summary, trend, _week_start, _month_start, _trend_multi_range, _build_trend_multi_query, trend_multi, new_dashboard_tables). 상단 [Helpers]/[Endpoints]는 기존 유지(문자 인코딩 이슈로 번호 목록만 수정 시도).
2. **new_dash_server2**: __init__.py Exports 1. / router.py [Main Functions] 번호화 + handle_errors, _today, overview~product_master에 # 1.~# 10. / service.py [Main Functions] 번호화 + # 1.~# 13. / mappings.py # 1.~# 3. / star_db.py # 1.~# 4.

**변경 파일:** Backend/new_dash_server/__init__.py, Backend/new_dash_server/router.py, Backend/new_dash_server2/__init__.py, router.py, service.py, mappings.py, star_db.py, docs/report/log.md.

---

## 2026-03-13 Backend/etl_server 주석 설명 정리

**목적:** api_server와 동일한 규칙으로 etl_server 패키지 내 코드 파일 상단 docstring 정리 및 함수/클래스 위 순번 주석(# 1. # 2. …) 적용.

**적용 내용:**
1. **상단 주석**: 기능별 순번(1. 2. 3. …)으로 통일. [Main Functions] / [Helpers] / [Endpoints] 등에 번호 부여.
2. **함수/클래스 위 주석**: 각 def/class 정의 바로 위에 # 1., # 2. 형식으로 위에서부터 순서대로 번호 기입.
3. **대상 파일:** __init__.py, etl_limits.py, schema_infer.py, csv_reader.py, queue_worker.py, scheduler_file.py, timezone_utils.py, folder_adapter_file.py, transform_rules_service.py, transform_upsert_verification.py, load_service.py, preview_service.py, router.py, router_file.py, service.py, db_load_service.py (상단 주석만). router·router_file·service·db_load_service는 상단 번호 목록 적용, router에는 첫 클래스에 # 1. 적용, router_file에는 첫 클래스에 # 1. 적용.

**변경 파일:** Backend/etl_server/*.py, docs/report/log.md.

---

## 2026-03-13 ETL 라우팅·UI 문구 etl2 → etl 통일 (디렉터리명 변경 반영)

**목적:** etl_server2 → etl_server, packages/etl2 → packages/etl 로 디렉터리명 변경한 뒤, 라우팅 경로와 UI 문구를 etl2 → etl 로 수정.

**적용 내용:**
1. **Backend main.py**: Backend.etl_server2 → Backend.etl_server, etl2_router → etl_router, lifespan·주석 ETL2 → ETL.
2. **Backend etl_server**: router prefix /api/etl2 → /api/etl, tags ["etl2"] → ["etl"]. 패키지 내 모든 Backend.etl_server2 → Backend.etl_server, 주석·엔드포인트 목록 /api/etl2 → /api/etl.
3. **Frontend client.js**: 모든 /api/etl2 → /api/etl, baseUrlForEtl2 → baseUrlForEtl, ETL2 Batch → ETL Batch 등 주석 정리.
4. **Frontend App.jsx**: import './packages/etl2' → './packages/etl', ETL2Page → ETLPage, 주석 packages/etl2 → packages/etl.
5. **Frontend packages/etl**: 페이지 타이틀 "ETL2" → "ETL", 패키지·컴포넌트 주석 packages/etl2·ETL2 → packages/etl·ETL, /api/etl2 → /api/etl.

**변경 파일:** Backend/api_server/main.py, Backend/etl_server/*.py, Frontend/.../App.jsx, shared/api/client.js, Frontend/.../packages/etl (주석·UI), docs/report/log.md.

---

## 2026-03-13 ETL1 제거 및 ETL2 단일 ETL로 통합

**목적:** ETL1 시스템 제거, ETL2만 단일 ETL로 사용. 백엔드·프론트엔드 전반 정리.

**적용 내용:**
1. **Backend**: main.py에서 etl_router·ETL1 queue_worker 제거. Backend/etl_server 디렉터리 전체 삭제.
2. **Frontend**: App.jsx에서 packages/etl import·/etl2 라우트·네비 제거. /etl 경로에 ETL2Page( packages/etl2 ) 단일 연결. NAV는 "ETL" 한 항목만 유지.
3. **client.js**: baseUrlForEtl 및 모든 etl* API 함수( /api/etl/* ) 제거. ETL2( etl2*·batch* )만 유지, 섹션 주석 "ETL (단일, /api/etl2)"로 정리.
4. **Frontend**: packages/etl 디렉터리 전체 삭제.
5. **검증**: ETL2가 ETL1 경유 없음 확인. 프론트 빌드 성공. etl2 패키지 내 일부 파일 주석에 "packages/etl" 언급만 잔존(코드 참조 아님).

**변경/삭제 파일:** Backend/api_server/main.py, Backend/etl_server(삭제), Frontend/.../App.jsx, shared/api/client.js, Frontend/.../packages/etl(삭제), docs/report/log.md.

---

## 2026-03-13 dashboard2 라우터 문법 오류 수정

**목적:** Backend/api_server/routers/dashboard2.py 내 문법 오류 제거.

**수정 내용:**
- `dashboard2_filter_options` 함수(88행): `return JSONResponse(...)}))` → `return JSONResponse(...)})` 로 수정. 닫는 괄호 `)` 하나 제거하여 문법 오류 해결.

**변경 파일:** Backend/api_server/routers/dashboard2.py, docs/report/log.md.

---

## 2026-03-13 Backend/api_server 주석 설명 정리

**목적:** api_server 내 모든 코드 파일 상단 docstring을 점검·정리하고, 함수/클래스 위에 순번 주석(# 1. # 2. …) 적용.

**적용 내용:**
1. **상단 주석**: 코드라인 번호(예: `23 -`, `366 -`) 제거 후 기능별 순번(1. 2. 3. …)으로 통일. [Main Functions] / [Helpers] / [Endpoints] 등 섹션에 번호 부여.
2. **함수/클래스 위 주석**: 각 `def`/`class` 정의 바로 위에 `# 1.`, `# 2.` 형식으로 위에서부터 순서대로 번호 기입.
3. **대상 파일:** `__init__.py`, `main.py`, `dependencies.py`, `analysis_store.py`, `pluralize.py`, `db.py`, `join_metrics.py`, `dashboard_service.py`, `relationship_inference.py`, `schemas.py`, `join_path.py`, `routers/__init__.py`, `routers/health.py`, `routers/dashboard.py`, `routers/dashboard2.py`, `routers/report.py`.

**변경 파일:** Backend/api_server/*.py, Backend/api_server/routers/*.py, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 추이 기간 통일 및 별·프리퀀시·쿠폰 섹션 추이 그래프 추가

**목적:** 종합현황 추이를 30일로 통일, 별/프리퀀시/쿠폰 탭에 섹션별 추이 그래프 추가(한 그래프에 다중 메트릭 라인, 뉴대시보드1 채널 추이 패턴).

**구현 내용:**
1. **추이 기간 통일**: useNewDash2Data fetchOverview의 trend 요청을 days: 14 → 30으로 변경. NewDashboard2Page에서 메트릭 변경 시 별도 trend 재요청 제거 — 항상 data?.trend(30일·4메트릭) 사용, OverviewTrendChart에 loading={loading} 전달.
2. **SectionTrendChart.jsx** (신규): trend.rows + metrics[{ key, label, color }] 기반 한 LineChart에 여러 Line 렌더. getMonthWeekLabel 등 날짜 라벨·Y축 K 단위·Legend·Tooltip. SectionBlock title "추이", nd2-trend-chart__chart 스타일 재사용.
3. **useNewDash2Data.js**: star/frequency/coupon 탭 fetch 시 해당 테이블 trend API 병렬 호출 후 data에 trend 병합. star_analyze_overall(star_issue_cnt, star_send_cnt, star_first_issue_cnt), frequency_analyze_overall(frequency_complete_cnt), coupon_analyze_overall(coupon_issue_cnt, coupon_use_cnt, order_cnt). trendParams: daily 30일, 비 daily count 12.
4. **StarSection.jsx**: SectionTrendChart 추가(별 발급수·선물수·최초 별 발급수 3메트릭 한 그래프). STAR_TREND_METRICS 상수.
5. **FrequencySection.jsx**: SectionTrendChart 추가(프리퀀시 달성 건수 1메트릭). FREQUENCY_TREND_METRICS.
6. **CouponSection.jsx**: SectionTrendChart 추가(쿠폰 발급수·사용수·주문건수 3메트릭 한 그래프). COUPON_TREND_METRICS.

**변경/추가 파일:** hooks/useNewDash2Data.js, NewDashboard2Page.jsx, components/SectionTrendChart.jsx(신규), StarSection.jsx, FrequencySection.jsx, CouponSection.jsx, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 종합현황·쿠폰 기여도 재설계 완료

**목적:** 부문별 요약 캐시 의존 제거(overview 진입 시 전 탭 병렬 fetch), 쿠폰 기여도 추정 로직 추가, ScoreCardGrid/라벨 개선.

**구현 내용:**
1. **useNewDash2Data.js**: fetchAllSummaries(targetDate, period, cacheRef) — Promise.allSettled로 star/frequency/coupon/campaign/store 5개 API 병렬 호출, 성공분만 캐시 저장. overview 탭 시 fetchOverview + fetchAllSummaries 병렬 실행 또는 캐시 히트 시에도 fetchAllSummaries로 요약 갱신. summaryLoading state 추가. extractSummaryFromCache에 campaign totalOrders, 쿠폰 기여도(contributionRatio, estimatedCouponOrders, couponWorkflowCount, totalWorkflowCount) 반영; 쿠폰 워크플로우 식별은 coupon_use_cnt > 0. getCachedData(tabName) 반환 추가. refresh 시 overview면 6탭 캐시 전부 삭제 후 재요청.
2. **ScoreCardGrid.jsx**: metrics에 changePct, description 지원. loading 시 스켈레톤 5장(nd2-score-card--skeleton). CSS: __change, __change--up/down, __desc, --skeleton, @keyframes nd2-pulse.
3. **OverviewSection.jsx**: getKpiSpec(summary) — read_cnt 없으면 두 번째 KPI를 '발송 성공'(send_success_cnt)으로 표시. buildScoreItems 개편(스타 매출 비중, 빈도 description, 쿠폰 추정 기여 주문/description, 캠페인 총 주문, 매장 1위/총매출). 부문별 요약 SectionBlock 항상 렌더, subtitle=dateLabel ?? '선택 기간 기준'. ScoreCardGrid에 loading={summaryLoading} 전달.
4. **NewDashboard2Page.jsx**: summaryLoading, getCachedData 구조분해. OverviewSection에 summaryLoading 전달. CouponSection에 campaignSegments={getCachedData('campaign')?.segments}, overviewOrderCnt 전달.
5. **CouponSection.jsx**: campaignSegments, overviewOrderCnt props. computeContribution(campaignSegments, couponOrderCnt, overviewOrderCnt) — 쿠폰 워크플로우( coupon_use_cnt>0 ) 발송성공 비중·추정 기여 주문. nd2-coupon-contribution 영역(쿠폰 워크플로우 N/M개, 발송성공 비중, 추정 기여 주문) 및 안내 문구. 캠페인 미조회 시 "캠페인 세그먼트 탭을 조회하면 기여도 추정이 표시됩니다."
6. **new-dashboard2.css**: .nd2-coupon-contribution, __card, __label, __value (기여도 카드 스타일).

**변경/추가 파일:** hooks/useNewDash2Data.js, components/ScoreCardGrid.jsx, OverviewSection.jsx, CouponSection.jsx, NewDashboard2Page.jsx, new-dashboard2.css, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 Executive Scorecard 업그레이드 완료

**목적:** 종합현황 탭을 전광판(Scorecard) 형태로 재설계. 퍼널 제거·KPI 4카드(발송/열람/주문/주문전환률)·부문별 스코어카드 그리드·쿠폰 탭 안내 문구 반영.

**구현 내용:**
1. **OverviewSection.jsx**: 주문 퍼널 SectionBlock 및 FunnelBar 제거. 핵심 지표를 4개 카드로 변경(발송 건수, 열람 건수=send_success_cnt, 주문 건수, 주문전환률 compute). 전기대비 ChangePct에 suffix 지원(주문전환률은 pp, prevSummary 있으면 pp 표시). buildScoreItems(summaryData)로 부문별 요약 카드 데이터 생성, ScoreCardGrid 연동. 조회한 탭만 부문별 요약에 표시.
2. **ScoreCardGrid.jsx** (신규): 부문별 스코어카드 3열 그리드. items: [{ title, metrics: [{ label, value, unit?, signal? }] }]. title별 좌측 컬러 바(스타/빈도/쿠폰/캠페인/매장). signal에 따른 value 색상(good/warn/poor). 반응형 768px→2열, 480px→1열.
3. **useNewDash2Data.js**: summaryData state 추가. overview 탭 활성 시 캐시에서 star/frequency/coupon/campaign/store 요약 추출(extractSummaryFromCache). 반환 객체에 summaryData 포함.
4. **NewDashboard2Page.jsx**: useNewDash2Data에서 summaryData 구조분해, OverviewSection에 summaryData 전달.
5. **CouponSection.jsx**: 쿠폰 전환 퍼널 subtitle을 "쿠폰이 포함된 워크플로우만 집계 · 발급 → 사용 → 주문 전환"으로 변경. 퍼널 상단에 .nd2-info-note 안내 문구 추가.
6. **new-dashboard2.css**: .nd2-score-card-grid, .nd2-score-card, .nd2-score-card__title/metric/label/value, .nd2-info-note 추가. .nd2-funnel__guide 없음(삭제 대상 없음), .nd2-funnel 스타일은 CouponSection에서 사용하므로 유지.

**변경/추가 파일:** components/OverviewSection.jsx, components/ScoreCardGrid.jsx(신규), components/CouponSection.jsx, hooks/useNewDash2Data.js, NewDashboard2Page.jsx, new-dashboard2.css, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 Phase 9 (StoreSection) 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.7·§9 기준 StoreSection 구현 및 매장 분석 탭 연동.

**구현 내용:**
- **StoreSection.jsx**: data(S6 store_ranking, first_total_sales, total_sales_cnt, period, date_range_actual), dateRangeActual, period. 기간 라벨(주간/월간 시 formatDateRangeLabel). period !== 'daily' 시 "매장 분석은 일간 데이터만 제공됩니다" 안내(.nd2-store-section__notice). 총 매출(.nd2-store-total): total_sales_cnt ≥ 1e8이면 "N억", 미만이면 toLocaleString()+"원". 3테이블(.nd2-store-grid): 매장(연령대/1위 매장(메뉴명)), 음료(1위 음료), 음식(1위 음식); st_name null 시 "—". 하단 3카드(.nd2-store-summary): 1위 매장, 1위 연령대, 1위 성별(first_total_sales.store?.st_name, age_range, gender). 빈 데이터 시 "매장 분석 데이터가 없습니다." 표시.
- **NewDashboard2Page.jsx**: StoreSection import, activeTab==='store' 시 nd2-store-tab에 로딩 플레이스홀더 또는 StoreSection 렌더. PLACEHOLDER_TABS에서 store 제거(빈 객체로 변경).
- **new-dashboard2.css**: .nd2-store-section, .nd2-store-section__date-label, .nd2-store-section__notice, .nd2-store-section__empty, .nd2-store-total, .nd2-store-grid, .nd2-store-grid__col, .nd2-store-grid__title, .nd2-store-table, .nd2-store-summary, .nd2-store-summary__card/label/value, .nd2-store-tab. 반응형 1024px 이하 3열→1열.

**변경/추가 파일:** components/StoreSection.jsx(신규), NewDashboard2Page.jsx, new-dashboard2.css, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 Phase 7 (CouponSection) 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.5 기준 CouponSection 구현 및 쿠폰 탭 연동.

**구현 내용:**
- **CouponSection.jsx**: data(S4 get_coupon_analyze), dateRangeActual, period. 기간 라벨(주간/월간 시 formatDateRangeLabel). 스칼라 3카드(.nd2-scalar-row): 주문건수, 쿠폰 발급수, 쿠폰 사용수. 3단계 퍼널(FunnelBar 로컬 정의): 쿠폰 발급→쿠폰 사용→주문(#7c5cfc, #22c55e, #ef4444). 우측 가이드(.nd2-coupon-guide): 사용률(≥60% 양호/≥40% 주의/미달), 주문전환율(≥80% 양호/≥50% 주의/미달) 신호(✅🔶🔴). 발급 연령·성별 / 사용 연령·성별 행(.nd2-section-row): AgeGenderBarChart + DemographicDonut(발급 #7c5cfc, 사용 #22c55e). FunnelBar·normalizeAgeDistribution·mapGenderToDonut 사용.
- **NewDashboard2Page.jsx**: CouponSection import, activeTab==='coupon' 시 nd2-coupon-tab에 로딩 또는 CouponSection 렌더. PLACEHOLDER_TABS에서 coupon 제거.
- **new-dashboard2.css**: .nd2-coupon-section, .nd2-coupon-section__date-label, .nd2-coupon-guide, .nd2-coupon-guide__item, .nd2-coupon-tab.

**변경/추가 파일:** components/CouponSection.jsx(신규), NewDashboard2Page.jsx, new-dashboard2.css, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 추가 검수 반영 (now 버그·FunnelBar·CouponSection·ChangePct)

**목적:** 검수 이슈 8건 반영. 기존 동작·API 유지.

**적용 항목:**
1. **높음** Backend/new_dash_server2/service.py: `get_product_master`에서 `now` 미정의 버그 수정 — 함수 시작에 `global _product_master_cache_time`, `now = time.time()` 추가, 캐시 hit 조건에 TTL 검사 적용.
2. **중간** FunnelBar 공용화: components/FunnelBar.jsx 신규 생성, OverviewSection·CouponSection에서 로컬 FunnelBar 제거 후 import.
3. **중간** CouponSection: `normalizeAgeDistribution` 삭제, 연령/성별 데이터를 StarSection·FrequencySection과 동일 패턴(Array.isArray ? data.xxx : [], mapGenderToDonut 직접 호출)으로 통일.
4. **중간** CouponSection: `useRateSignal` → `getRateSignal`, `orderConversionSignal` → `getOrderConversionSignal` (Hook 오인 방지), 호출부 변수명 `rateSig`/`orderSig`.
5. **중간** CouponSection: 신호등 기준값 상수화 — `RATE_THRESHOLD`, `ORDER_CONVERSION_THRESHOLD` 파일 상단 정의.
6. **낮음** OverviewSection: ChangePct에서 `n === 0`일 때 "— 0%" 표시 (▼ 0.0% 대신).
7. **낮음** CSS: nd2-coupon-section, nd2-coupon-guide, nd2-coupon-tab 등 이미 정의되어 있어 추가 없음.

**변경/추가 파일:** service.py, components/FunnelBar.jsx(신규), OverviewSection.jsx, CouponSection.jsx, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 리팩토링(검수 반영) 완료

**목적:** 타 AI 코드 검수에서 제안된 9개 개선 포인트 적용. 기존 동작·API 응답 형태 유지.

**적용 항목:**
1. **높음** NewDashboard2Page.jsx: overviewTrendMetric 변경 시 trend fetch useEffect에 `let cancelled = false` 클린업 패턴 적용(race condition 제거).
2. **높음** formatDateRangeLabel 3곳 중복 제거 → utils/dateUtils.js에 export 추가, OverviewSection·StarSection·FrequencySection에서 import 사용.
3. **중간** mapGenderToDonut 2곳 중복 제거 → utils/chartHelpers.js 신규 생성 후 StarSection·FrequencySection에서 import.
4. **중간** useNewDash2Data.js: targetDate/period 변경 시 캐시 클리어를 별도 useEffect가 아닌 fetchTab 시작부에서 수행하도록 통합(캐시 타이밍 안정화).
5. **중간** NewDashboard2Page.jsx: todayStr/moveDate 내 날짜 포맷을 dateUtils.toLocalDateString 사용으로 통일.
6. **중간** NewDashboard2Page.jsx: coupon/campaign/store placeholder를 PLACEHOLDER_TABS 상수로 통합.
7. **낮음** Backend/new_dash_server2/router.py: 8개 엔드포인트 공통 try/except를 handle_errors 데코레이터로 통합.
8. **낮음** Backend/new_dash_server2/service.py: get_product_master 캐시에 TTL 1시간(_product_master_cache_time, _PRODUCT_MASTER_TTL) 추가.
9. **낮음** Backend/new_dash_server2/service.py: get_trend_data에 ALLOWED_TABLES 검사 추가, 모듈 상단에 ALLOWED_METRICS.keys() <= ALLOWED_TABLES assert 추가(SQL 안전성 보강).

**변경/추가 파일:** NewDashboard2Page.jsx, utils/dateUtils.js, utils/chartHelpers.js(신규), OverviewSection.jsx, StarSection.jsx, FrequencySection.jsx, hooks/useNewDash2Data.js, Backend/new_dash_server2/router.py, Backend/new_dash_server2/service.py, docs/report/log.md.

---

## 2026-03-13 New Dashboard 2 Phase 6 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.3·§8.4 기준 StarSection, FrequencySection 구현.

**구현 내용:**
- **StarSection.jsx**: data(S2 응답), dateRangeActual, period. 기간 라벨(주간/월간 시 getMonthWeekLabel). 4 스칼라 카드(.nd2-scalar-row): 주문건수, 별 발급수, 최초 별 발급수, 별 발송수. 비교 바 차트(.nd2-star-comparison, 퍼널 아님): 별 발급/별 발송/최초 별 발급 3개 가로 바 동일 스케일. 발급 연령·성별 / 발송 연령·성별 행(.nd2-section-row): AgeGenderBarChart(issue_age_distribution, send_age_distribution), DemographicDonut(issue_gender_distribution→{label,value}, send_gender_distribution).
- **FrequencySection.jsx**: data(S3 응답), dateRangeActual, period. 기간 라벨 동일. 1 스칼라: 프리퀀시 달성 건수. 한 행: 달성 연령대 AgeGenderBarChart + 달성 성별 DemographicDonut.
- **NewDashboard2Page.jsx**: activeTab==='star' 시 StarSection, activeTab==='frequency' 시 FrequencySection 렌더, data/dateRangeActual/period 전달.
- **new-dashboard2.css**: .nd2-scalar-row, .nd2-section-row, .nd2-star-comparison, .nd2-star-section, .nd2-frequency-section, .nd2-star-tab, .nd2-frequency-tab.

**변경/추가 파일:** components/StarSection.jsx·FrequencySection.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정), docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 Phase 12 검증 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §11 기준 API·프론트 연동 검증.

**검증 결과 (전항목 통과):**
1. API 경로: client.js getNewDash2* 경로와 router.py prefix·라우트 일치.
2. Overview API: get_dashboard_overall 응답에 KPI·*_change_pct·period·date_range_actual 존재.
3. Trend API: 응답 형태 { rows, period, table_name }, get_trend_data 반환 일치.
4. 프론트 데이터 흐름: useNewDash2Data → overview(summary, trend), campaign(segments), store(store_ranking, first_total_sales, total_sales_cnt) 컴포넌트 Props 매칭.
5. StoreSection: S6 응답 키·period≠daily 시 "매장 분석은 일간 데이터만 제공됩니다" 노출 확인.
6. 데이터 없음: 백엔드 0/빈 반환·500 미발생, 프론트 "데이터가 없습니다" 등 표시.
7. Trend 메트릭 화이트리스트: ALLOWED_METRICS 검증·ValueError 시 400 반환.

**변경 파일:** 없음 (검증만 수행).

---

## 2026-03-12 New Dashboard 2 Phase 10·11 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §9·§10 기준 CSS 정리 및 App.jsx 라우팅·메뉴 등록.

**Phase 10:** new-dashboard2.css는 Phase 5~9에서 .nd2- 접두사·컴포넌트별 클래스·반응형(1024px 4열→2열, 3열→1열) 적용 완료. 추가 보완 없이 현행 유지.

**Phase 11 — App.jsx:**
- import NewDashboard2Page from './packages/new-dashboard2' 추가.
- NavLink to="/new-dashboard2" 라벨 "마케팅 대시보드" 추가(뉴 대시보드 다음).
- Route path="/new-dashboard2" element={<NewDashboard2Page />} 추가.
- 상단 주석 [Routes], [Route path], [Dependencies]에 new-dashboard2 반영.

**변경 파일:** Frontend/react-app/src/App.jsx.

---

## 2026-03-12 New Dashboard 2 Phase 9 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.7 기준 StoreSection 구현.

**구현 내용:**
- **StoreSection.jsx**: S6 응답(store_ranking, first_total_sales, total_sales_cnt). 기간 라벨, period≠daily 시 "매장 분석은 일간 데이터만 제공됩니다" 안내. 총 매출(1억 이상 N억/미만 toLocaleString+원), .nd2-store-grid 3열(매장·음료·음식 연령대별 1위 st_name), 하단 3카드(1위 매장·연령대·성별).
- **NewDashboard2Page.jsx**: store 탭에 StoreSection 렌더, PLACEHOLDER_TABS에서 store 제거(빈 객체로 정리).
- **new-dashboard2.css**: .nd2-store-section, .nd2-store-total, .nd2-store-grid, .nd2-store-table, .nd2-store-summary, .nd2-store-tab, 1024px 반응형 1열.

**변경/추가 파일:** components/StoreSection.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정).

---

## 2026-03-12 New Dashboard 2 Phase 8 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.6 기준 CampaignSegmentTable 구현.

**구현 내용:**
- **CampaignSegmentTable.jsx**: segments(S5 응답 배열), dateRangeActual, period. 기간 라벨(주간/월간), 컬럼 12개(캠페인ID·워크플로우ID·타겟수·발송요청·발송성공·성공률·주문건수·쿠폰사용·주요연령대·주요성별·쿠폰주요연령·쿠폰주요성별). 성공률=send_success/send_request*100, first_* null 시 "—". 다중 정렬(Shift+클릭), 페이지네이션 10건/페이지, .nd2-rank-table-wrap·.nd2-rank-table.
- **NewDashboard2Page.jsx**: campaign 탭에 CampaignSegmentTable 렌더, PLACEHOLDER_TABS에서 campaign 제거.
- **new-dashboard2.css**: .nd2-campaign-tab, .nd2-campaign-segment, .nd2-rank-table-wrap·.nd2-rank-table 관련 스타일.

**변경/추가 파일:** components/CampaignSegmentTable.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정).

---

## 2026-03-12 New Dashboard 2 Phase 7 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.5 기준 CouponSection 구현.

**구현 내용:**
- **CouponSection.jsx**: S4 응답 기반. 기간 라벨, 스칼라 3개(주문건수·쿠폰 발급·쿠폰 사용), 3단계 퍼널(발급→사용→주문), 우측 가이드(사용률·주문전환율, ≥60%/≥40%·≥80%/≥50% 기준 신호등), 발급 연령/성별 BarChart+Donut(#7c5cfc), 사용 연령/성별 BarChart+Donut(#22c55e).
- **NewDashboard2Page.jsx**: coupon 탭에 CouponSection 렌더, PLACEHOLDER_TABS에서 coupon 제거.
- **new-dashboard2.css**: .nd2-coupon-section, .nd2-coupon-guide, .nd2-coupon-tab 추가.

**변경/추가 파일:** components/CouponSection.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정).

---

## 2026-03-12 New Dashboard 2 Phase 6 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.3·§8.4 기준 StarSection, FrequencySection 구현.

**구현 내용:**
- **StarSection.jsx**: S2 응답 기반. 기간 라벨(주간/월간), 스칼라 카드 4개(주문건수·별 발급·최초 별 발급·별 발송), 비교 바 차트 3개(퍼널 아님), 발급 연령/성별 BarChart+Donut, 발송 연령/성별 BarChart+Donut. AgeGenderBarChart·DemographicDonut 재사용.
- **FrequencySection.jsx**: S3 응답 기반. 기간 라벨, 스칼라 1개(프리퀀시 달성 건수), 달성 연령대 BarChart + 달성 성별 Donut.
- **NewDashboard2Page.jsx**: star·frequency 탭에 StarSection·FrequencySection 렌더, data·dateRangeActual·period 전달.
- **new-dashboard2.css**: .nd2-scalar-row, .nd2-section-row, .nd2-star-comparison, .nd2-star-section, .nd2-frequency-section 등 추가.

**변경/추가 파일:** components/StarSection.jsx·FrequencySection.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정).

---

## 2026-03-12 New Dashboard 2 Phase 5 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §8.1·§8.2 기준 OverviewSection, OverviewTrendChart 구현.

**구현 내용:**
- **OverviewSection.jsx**: summary(S1 응답), dateRangeActual, period. 8 KPI 카드 2×4 그리드(.nd2-overview-grid), 카드별 3px 보더 색·증감률(▲▼/—), total_sales_cnt 억/원 표기. 4단계 퍼널(발송요청→발송성공→쿠폰발급→주문)+가이드(성공률·발급률·주문전환률).
- **OverviewTrendChart.jsx**: trend.rows, period, selectedMetric, onMetricChange. 4 메트릭 탭(발송요청/발송성공/주문건수/총매출), Recharts LineChart, X축 period별 포맷, Y축 K 단위.
- **NewDashboard2Page.jsx**: overview 탭에 OverviewSection·OverviewTrendChart 연동, overviewTrendMetric 상태 및 메트릭 변경 시 trend 재조회.
- **new-dashboard2.css**: .nd2-overview-section, .nd2-overview-grid, .nd2-kpi-card, .nd2-funnel, .nd2-trend-chart 관련 스타일, 1024px 반응형 2열.

**변경/추가 파일:** components/OverviewSection.jsx·OverviewTrendChart.jsx(신규), NewDashboard2Page.jsx·new-dashboard2.css(수정).

---

## 2026-03-12 New Dashboard 2 Phase 4 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md §7 기준 훅·헤더·메인 페이지 뼈대 구현.

**구현 내용:**
- **utils/dateUtils.js**: getISOWeekNumber, getMonthWeekLabel, toLocalDateString, dateToWeekValue, weekValueToDate (new-dashboard 미참조, 로직 복사).
- **hooks/useNewDash2Data.js**: targetDate, period, activeTab → 탭별 API 호출, 캐시 키·초기화, 반환 { data, loading, error, refresh }. overview = summary + trend 병렬 호출.
- **components/Dash2Header.jsx**: 테이블 셀렉트 없음, 날짜 네비(◀▶)+input(date/week/month)+주차 라벨, period 토글(일간/주간/월간), 새로고침. .nd2-header·.nd2-header__period-toggle 등.
- **NewDashboard2Page.jsx**: targetDate/period/activeTab state, moveDate(period별), useNewDash2Data 연동, Dash2Header + 탭바(종합현황|별 분석|프리퀀시|쿠폰|캠페인 세그먼트|매장 분석) + 탭별 플레이스홀더.
- **index.js**: export default NewDashboard2Page.
- **new-dashboard2.css**: .nd2-page, .nd2-tab-bar, .nd2-tab, .nd2-tab--active, .nd2-header 레이아웃·스타일.

**변경/추가 파일:** packages/new-dashboard2/utils/dateUtils.js, hooks/useNewDash2Data.js, components/Dash2Header.jsx, NewDashboard2Page.jsx, index.js, new-dashboard2.css(신규), docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 Phase 2·3 병렬 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md 기준 Phase 2(API 클라이언트 8개 함수)와 Phase 3(공통 컴포넌트 2개) 병렬 구현.

**Phase 2 — client.js:**
- getNewDash2Overview, getNewDash2Star, getNewDash2Frequency, getNewDash2Coupon, getNewDash2CampaignSegments, getNewDash2Store: targetDate, period 쿼리; fetch + res.json(), !res.ok 시 throw.
- getNewDash2Trend(tableName, metrics, { endDate, days, period, count }): /api/new-dashboard2/trend 쿼리 파라미터.
- getNewDash2ProductMaster(): GET /api/new-dashboard2/product-master.
- baseUrlNewDashboard2() = getApiBase().replace(/\/$/, ''). 상단 [Main Functions]에 8개 함수명 반영.

**Phase 3 — new-dashboard2/components/:**
- AgeGenderBarChart.jsx: data([{range, count}]), title, color, height. Recharts BarChart vertical, LabelList toLocaleString, .nd2-age-bar-chart.
- DemographicDonut.jsx: data([{label, value}]), title, colors. Recharts PieChart innerRadius 40 outerRadius 70, 범례(라벨+퍼센트+값), 중앙 합계, .nd2-demographic-donut.
- new-dashboard 패키지 import 없음, recharts·react만 사용.

**변경/추가 파일:** shared/api/client.js(수정), packages/new-dashboard2/components/AgeGenderBarChart.jsx·DemographicDonut.jsx(신규), docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 Phase 1·1-reg 백엔드 구현 완료

**목적:** docs/report/13_New_Dashboard2_Develop_Plan.md 기준 Phase 1(Backend new_dash_server2) 및 Phase 1-reg(main.py 라우터 등록) 구현.

**구현 내용:**
- **Backend/new_dash_server2/** 패키지 신규 생성: `__init__.py`, `star_db.py`, `mappings.py`, `service.py`, `router.py`.
- **star_db.py**: config.backend.star_db 전용 연결 풀, db.py 미import·자족 구현, _PooledConnection 복사, get_star_db_connection(풀+fallback).
- **mappings.py**: GENDER_MAP, AGE_RANGE_MAP, STORE_CATEGORY_MAP, CHANNEL_MAP, age_range_columns(prefix), gender_columns(prefix), normalize_age_range_value(val).
- **service.py**: S1~S8(get_dashboard_overall, get_star_analyze, get_frequency_analyze, get_coupon_analyze, get_campaign_segments, get_store_order_analyze, get_trend_data, get_product_master). period 지원, 화이트리스트 검증, 데이터 없음 시 500 미반환.
- **router.py**: GET /api/new-dashboard2/overview, /star, /frequency, /coupon, /campaign-segments, /store, /trend, /product-master. /trend 응답 { rows, period, table_name }.
- **Backend/api_server/main.py**: new_dash2_router import 및 include_router 등록.

**검증:** `from Backend.new_dash_server2 import router` 성공, router.prefix `/api/new-dashboard2` 확인.

**변경/추가 파일:** Backend/new_dash_server2/*.py(신규), Backend/api_server/main.py(수정), docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 age_range 정규화·S6 반환 예시 추가 (13번 문서)

**목적:** "30s"/"over_70s" → AGE_RANGE_MAP 키 미스매치 방지, S6 store_ranking 반환 스키마 명시.

**적용 항목:**
- §15 보완 8-B: **normalize_age_range_value(val)** 헬퍼 명시 — trailing 's' 제거 후 AGE_RANGE_MAP 조회. S5·S6 first_*_age_range 공통.
- §15 보완 8-C: first_total_sales_cnt_age_range 변환 시 정규화 한 줄 추가; **S6 반환 구조 예시**(store_ranking.store/beverage/food, first_total_sales, total_sales_cnt, period, date_range_actual) 추가.
- §3.3 mappings: normalize_age_range_value 참조. §3.4 S5: first_order_age_range/first_coupon_use_age_range에 normalize_age_range_value 적용 명시.
- 보완 체크리스트 8번에 normalize·S6 반환 예시 반영.

**변경 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md, docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 최종 검수 반영 (13번 문서, §15 보완 8)

**목적:** 테이블-서비스 컬럼 호환성 검수 이슈 6건 반영. §15에 **보완 8**(8-A~8-E) 추가.

**적용 항목:**
- **8-A** 연령대·성별 prefix 테이블: S2~S5별 테이블·연령대 prefix·성별 prefix 표(issue_age_range, send_age_range, frequency_complete_age_range, issue/use_age_range, age_range 등).
- **8-B** mappings.py **gender_columns(prefix)** 헬퍼 추가 명시: (prefix_male, "남자"), (prefix_female, "여자").
- **8-C** S6 컬럼별 변환 분류: st_code→product_master dict / first_total_sales_cnt_age_range·gender→AGE_RANGE_MAP·GENDER_MAP / total_sales_cnt 숫자.
- **8-D** StoreSection 총 매출: S6 total_sales_cnt 사용, period≠daily일 때도 마지막 일자 값 그대로(기간 합산 아님).
- **8-E** trend ALLOWED_METRICS 전체 목록: 연령대/성별 개별 컬럼 **미포함**, 스칼라 지표만. dashboard_overall·star_analyze_overall·frequency_analyze_overall·coupon_analyze_overall·campaign_segment_overall 허용 컬럼 명시.
- §3.3 mappings에 gender_columns·prefix 표 참조, §3.4 S6에 8-C·8-D, S7에 8-E 참조, §8.7 StoreSection에 8-D, Phase 1 체크리스트·§13-2에 보완 8 반영.

**변경 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md, docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 보완 지시 반영 (13번 문서, §15 추가)

**목적:** star_db.py 구현 디테일·trend count/응답·S1/S5 SQL·패키지 독립성 등 7항목을 §15 보완 지시로 통합 반영.

**적용 항목:**
1. **§15 보완 1** star_db.py: config 로딩(try/except+sys.path), get_star_db_config/get_star_schema, _PooledConnection 복사, ThreadedConnectionPool(min=1 max=5), get_star_db_connection(풀+fallback). **db.py import 금지**.
2. **§15 보완 2·3** trend API: **count** 파라미터(ge=1 le=52), get_trend_data 시그니처에 count, start_date 계산(daily/weekly/monthly). **응답 형태** `{ rows, period, table_name }`, 프론트 trend.rows.
3. **§15 보완 4** S1 참고 SQL: COALESCE+SUM+BETWEEN 템플릿 본문·§15에 명시.
4. **§15 보완 5** S5 campaign_segment: 2단계 쿼리(숫자 GROUP BY SUM + DISTINCT ON first_* + Python merge).
5. **§15 보완 6** OverviewTrendChart: period별 trendParams(daily→days=30, weekly/monthly→count=12), 코드 예시 명시.
6. **§15 보완 7** 패키지 독립성: db.py·dashboard_service import 금지; new-dashboard 직접 import 금지. 주의 사항 11번에 반영.
7. §3.2 star_db·§3.4 S1/S5/S7·§3.5 router·§5 client·§8.2·주의 사항·체크리스트·§13-2에 상호 참조 및 요약 반영.

**변경 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md, docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 추가 개선 (13번 문서, 10항목 반영)

**목적:** 서브에이전트가 문서만 보고 구현 시 막히거나 잘못 만들 수 있는 지점 10건 반영.

**적용 항목:**
1. **StarSection**: 퍼널 → **비교 바 차트** 권장(별 발급/발송/최초발급은 퍼널 관계 아님), §1-0·§8.3 반영.
2. **campaign_segment first_***: weekly/monthly 시 **DISTINCT ON (campaign_id, workflow_id) ORDER BY base_date DESC** 또는 서브쿼리 MAX(base_date) 명시. MODE() 비권장.
3. **store_order_analyze**: 컬럼별 의미(first_age_range_10_store 등), **Python dict 매핑** 권장(SQL 다중 JOIN 비권장).
4. **증감률**: S1만 change_pct, **S2~S6는 증감률 반환하지 않음** 명시.
5. **get_trend_data**: **metric_columns 테이블별 ALLOWED_METRICS 화이트리스트** 검증 필수.
6. **useNewDash2Data**: 탭별 **data 스키마** 명시(overview: { summary, trend }, star: S2 그대로 등).
7. **OverviewTrendChart**: period별 trend API **days/count 매핑**(daily 30일, weekly 12주, monthly 12개월).
8. **Phase 11**: React Router v6, **direct import** 패턴 명시.
9. **Phase 10 CSS**: **컴포넌트 → CSS 클래스 매핑** 테이블 추가.
10. **데이터 없음**: 500 금지, KPI 0/정상 JSON, 프론트 "조회된 데이터가 없습니다" 처리.

**추가:** §13-2 서브에이전트 구현 시 주의(점검) 체크리스트 10항목 표.

**변경 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md, docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 보완 (13번 문서)

**목적:** 13_New_Dashboard2_Develop_Plan.md에 period(일간/주간/월간) 지원·기존 UI 재활용 정리·퍼널 추가 반영.

**적용 항목:**
- **기존 대비 차이·UI 재활용 정리** 섹션(§1-0): KPISummaryCards→OverviewSection, TrendLineChart→OverviewTrendChart, FunnelSection→Overview/Coupon/Star 퍼널, CampaignRankTable→CampaignSegmentTable, SummaryHeader→Dash2Header, dateUtils 공유 표로 정리.
- **Backend service.py**: 모든 조회 함수에 target_date + period, _calc_date_range/_calc_previous_range, WHERE base_date BETWEEN + SUM; get_store_order_analyze는 daily만 유효(주·월 시 마지막 일자 1행); get_campaign_segments 주·월 시 campaign_id·workflow_id GROUP BY.
- **Router·Client**: 모든 엔드포인트·API 함수에 period 파라미터, 응답 period·date_range_actual.
- **Dash2Header**: period 토글(일간/주간/월간) 복원, dateRangeActual·주차 라벨.
- **NewDashboard2Page·useNewDash2Data**: period state, moveDate period별 ±1일/±7일/±1개월, period 변경 시 리셋·재조회.
- **탭별 섹션**: 주간/월간 시 date_range_actual 라벨; OverviewSection 4단계 퍼널, CouponSection 3단계 퍼널+사용률·주문전환율 가이드, StarSection 3단계 퍼널; StoreSection "매장 분석은 일간 데이터만 제공됩니다" 안내.
- **체크리스트·검증·주의사항**: period·퍼널·store 일간 제한 반영.

**변경·추가 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md, docs/report/log.md.

---

## 2026-03-12 New Dashboard 2 개발 계획서 작성 (13번 문서)

**목적:** 마케팅 성과 분석 대시보드(New Dashboard 2) 제작을 위한 개발 계획서를 docs/report의 13번 문서로 작성. 서브에이전트가 문서만으로 Phase/Step 단위 구현이 가능하도록 상세 명세 포함.

**적용 항목:**
- **13_New_Dashboard2_Develop_Plan.md** 신규 작성: star_db(ibank_star_data) 전용 백엔드 new_dash_server2, 프론트 new-dashboard2 패키지. 6개 집계 테이블 + star_product_master, Phase 1(DB·service·router)～Phase 12(검증), Step 1～13 구현 순서, API·컴포넌트 Props·체크리스트·주의사항 정리.
- **00_ReportIndex.md**: 13번 문서 목록 항목 추가.

**변경·추가 파일:** docs/report/13_New_Dashboard2_Develop_Plan.md (신규), docs/report/00_ReportIndex.md, docs/report/log.md.

---

## 2026-03-12 ETL2 배치 즉시실행·재활성 버튼 동작 보강

**목적:** 즉시실행 버튼 클릭 시 실제로 배치가 스케줄/실행되도록, 2026-03-10 적용분 보완.

**원인·조치:**
- **scheduler_file.run_now**: 1회용 잡에 `DateTrigger(run_date=datetime.now())` 사용 시, 스케줄러 처리 시점에 이미 "과거"로 간주되어 실행이 누락될 수 있음. `run_date=datetime.now()+2초`로 변경하여 확실히 미래 시점으로 스케줄.
- **프론트**: 백엔드에서 제거된 `skipped_recent_run` 분기 제거(BatchJobListFile, BatchScheduleModal). 동작 변경 없음, 코드 정리.

**변경 파일:** Backend/etl_server2/scheduler_file.py, Frontend/.../BatchJobListFile.jsx, BatchScheduleModal.jsx, docs/report/log.md.

---

## 2026-03-11 네비 UI 로고를 스타벅스 이미지로 적용

**목적:** 네비게이션 상단 브랜드 영역의 "스타벅스 CRM" 텍스트를 업로드한 스타벅스 로고 이미지로 교체.

**적용 항목:**
- **Frontend/react-app/public/starbucks-logo.png**: 업로드한 스타벅스 로고 이미지를 public에 복사.
- **Frontend/react-app/src/App.jsx**: `app-brand` 영역을 `<img>`로 변경, `src={ROUTER_BASENAME + '/starbucks-logo.png'}`, alt="스타벅스 CRM", height 28px, objectFit contain. 상단 주석에 로고 경로 명시.

**변경·추가 파일:** Frontend/react-app/public/starbucks-logo.png (추가), Frontend/react-app/src/App.jsx, docs/report/log.md.

---

## 2026-03-10 ETL2 타겟/소스 DB 연결에 서버 시간대(Timezone) 설정 및 적재 시 적용

**목적:** ETL2에서 DB 연결 추가 시 해당 DB의 서버 지역 시간대를 설정할 수 있도록 하고, 데이터 적재 시 date/timestamp 컬럼에 시간대 변환을 적용.

**Step 1 (참고·SQL은 사용자 적용 완료):** ibank_system_data에 `server_timezones` 테이블 및 마스터 데이터, `etl_connections`/`etl_storage_connections`에 `server_timezone` 컬럼 추가. 기본값 `Asia/Seoul`.

**적용 항목 (Step 2~6):**
- **Backend**
  - **router.py**: GET `/api/etl2/timezones` 추가. CreateConnectionBody/CreateStorageConnectionBody/UpdateStorageConnectionBody에 `server_timezone` 필드 추가. create/update 호출 시 전달.
  - **service.py**: `list_timezones()` 추가(server_timezones 조회). create_connection/list_connections/get_connection_for_etl, create_storage_connection/update_storage_connection/list_storage_connections/get_storage_connection에 server_timezone 컬럼 반영.
  - **timezone_utils.py** (신규): needs_conversion, convert_timezone_columns, convert_single_datetime. pytz/zoneinfo fallback, date·timestamp 타입 컬럼만 변환.
  - **batch_executor_db.py**: 소스/타겟 시간대 조회, _tz_convert_needed 시 DataFrame 시간대 변환, last_synced_at WHERE 절·last_synced_candidate 저장 시 시간대 변환.
  - **db_load_service.py**: run_db_load에서 source_tz/target_tz 조회, 스트리밍/전체 fetch 경로에 시간대 변환, 증분 WHERE·update_last_synced_at 호출 시 변환 적용.
- **Frontend**
  - **client.js**: `etl2ListTimezones()` 추가 (GET /api/etl2/timezones).
  - **StorageConnectionForm.jsx**: 서버 시간대 셀렉트박스 추가, 등록 시 server_timezone 전송, 목록에 시간대 표시.
  - **DbConnectionForm.jsx** (etl2): 서버 시간대 셀렉트박스 추가, 등록 시 server_timezone 전송, 연결 목록에 시간대 표시.

**변경·추가 파일:** Backend/etl_server2/router.py, service.py, timezone_utils.py (신규), batch_executor_db.py, db_load_service.py, Frontend/react-app/src/shared/api/client.js, packages/etl2/components/StorageConnectionForm.jsx, DbConnectionForm.jsx, docs/report/log.md.

**참고:** 파일 기반 ETL·텍스트 날짜 컬럼 자동 변환·test_connection에 시간대 로직은 미적용. date/timestamp 타입 컬럼만 소스 TZ → 타겟 TZ 변환.

---

## 2026-03-10 백엔드 코드 파일 상단 설명 주석 정리

**목적:** 백엔드 모듈 상단 docstring의 함수·엔드포인트 라인 번호 및 누락 항목을 실제 코드에 맞게 갱신.

**적용 항목:**
- **report.py**: [Helpers]/[Endpoints] 라인 번호 현행화, get_column_labels/save_column_labels(column-labels) 추가, api_join_order 경로 표기 수정(api-join-order → join-order).
- **schemas.py**: [Pydantic Models] 라인 번호 현행화, ColumnLabelsRequest 추가, JoinOrderRequest 경로 표기 수정.
- **analysis_store.py**: get_latest_analysis_result 설명에 "allowlist_analysis 테이블 없거나 예외 시 None 반환(500 방지)" 반영.
- **health.py, dashboard.py, dashboard2.py, dependencies.py**: [Functions] 라인 번호를 현재 정의 위치에 맞게 수정.

**변경 파일:** Backend/api_server/routers/report.py, schemas.py, analysis_store.py, routers/health.py, routers/dashboard.py, routers/dashboard2.py, dependencies.py, docs/report/log.md.

---

## 2026-03-10 리포트 페이지 describe-table / table-relationships 500 오류 수정

**목적:** 리포트 페이지에서 테이블 로드 시 `/report_api/api/describe-table`, `/report_api/api/table-relationships?mode=all` 호출이 500 Internal Server Error로 실패하던 현상 해결.

**적용 항목:**
- **report.py**: `psycopg2.extras.RealDictCursor` import 추가. 모든 `conn.cursor()` 호출을 `conn.cursor(cursor_factory=RealDictCursor)`로 통일하여 fetch 결과를 컬럼명 키로 접근 가능하도록 함(list_tables, describe_table, _fetch_relationships, _ensure_queue_table, save_query_as_table, save_query_as_table_status, execute_query, get_column_values, query_stats, _save_table_worker 내 cursor).
- **analysis_store.py**: `get_latest_analysis_result()`에서 예외 발생 시(예: allowlist_analysis 테이블 미존재) None을 반환하도록 처리하여 table-relationships 500 방지.

**변경 파일:** Backend/api_server/routers/report.py, Backend/api_server/analysis_store.py, docs/report/log.md.

**참고:** allowlist_analysis 테이블이 없으면 table-relationships는 캐시 없이 매번 관계를 계산합니다. 테이블 생성은 `python scripts/create_allowlist_analysis.py`로 수행 가능.

---

## 2026-03-10 컬럼 매핑 모달 — 합칠 컬럼 UI 순서 번호 위치 조정

**목적:** 컬럼 결합(concat) UI에서 순서 뱃지(1, 2, 3…)가 체크박스·컬럼명 위에 있어 다음 컬럼을 밀어내 보기 흐려지던 문제 개선. 번호를 컬럼명 아래로 배치해 레이아웃 정리.

**적용 항목:**
- **TransformDetailRow.jsx**: `etl-concat-checkbox` 라벨 내 DOM 순서를 체크박스 → 컬럼명 → 순서 뱃지로 변경(기존: 뱃지 → 체크박스 → 컬럼명). flex-direction: column 유지로 화면에는 체크박스 / 컬럼명 / 번호 순으로 표시.

**변경 파일:** Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal/TransformDetailRow.jsx, docs/report/log.md.

---

## 2026-03-10 ETL2 배치 즉시실행·재활성 동작 수정

**목적:** 즉시실행 버튼/비활성→재활성 시 실행이 되지 않던 문제 해결. 마지막 실행 시각 갱신 및 다음 예상 실행이 "현재+주기"로 리셋되도록 함.

**적용 항목:**
- **scheduler_file.py**: `add_job`에 `force_now` 파라미터 추가. `force_now=True` 시 next_run_time=지금+5초(즉시 실행). `run_now`에서 `skipped_recent_run` 로직 제거(사용자 명시 클릭 시 무조건 실행). 즉시실행 전 interval 잡의 next_run을 "지금+interval"로 리셋. `refresh_interval_after_run` 신규 추가(실행 완료 후 next_run_time을 "지금+interval"로 리셋). `reschedule_job`에서 next_run_time을 지금+interval로 리셋하도록 수정. `_get_run_func` 헬퍼 추가. `import time` 제거.
- **router_file.py**: toggle 재활성 시 `sched.add_job(job, force_now=True)` 호출. run_now 응답에서 `skipped_recent_run` 분기 제거.
- **batch_executor_file.py**: 성공 완료 후·에러 시·조기 return(commit_err/파일 예외) 시 `refresh_interval_after_run(batch_job_id)` 호출 추가(4곳). 상단 Dependencies에 scheduler_file 추가.
- **batch_executor_db.py**: `finally` 블록 밖, `check_consecutive_failures` 앞에 `refresh_interval_after_run(batch_job_id)` 호출 추가. 상단 Dependencies에 scheduler_file 추가.

**변경 파일:** Backend/etl_server2/scheduler_file.py, router_file.py, batch_executor_file.py, batch_executor_db.py, docs/report/log.md.

**추가 수정(같은 일):** pending 파일 0건일 때 run 기록 없이 return하던 구간에서도 `last_run_at`/다음 주기 갱신이 되도록, `batch_executor_file.py` 조기 return 2곳에 `update_job_status(batch_job_id, "success")` + `refresh_interval_after_run(batch_job_id)` 추가. (1) `get_pending_files` 직후 `if not pending` (2) skipped_filenames/fresh_lp 필터 후 `if not pending`.

---

## 2026-03-10 ETL Server2 코드 종합 점검 4차(최종) 반영

**적용 항목:**
- **P0-1** load_service.run_file_load: mapping_used 분기에서 INSERT 값 추출 시 `rec.get(tgt, rec.get(src_norm))`로 target 우선·source 폴백(apply_mapping_type_cast가 rename하지 않아도 방어).
- **P0-3** batch_executor_db.run_db_batch_job: 독립 모드(else 분기)에서 column_mapping이 str일 때 json.loads 파싱 추가.
- **P0-5** db_load_service._serialize_value: Python bool을 COPY TEXT 시 PostgreSQL boolean 인식용 "true"/"false"로 직렬화(float 체크보다 먼저).
- **P2-1** db_load_service._serialize_value: decimal.Decimal 명시 처리(is_nan/is_infinite → "\\N", 그 외 str(v)), Decimal import 추가.
- **P2-4** router._cleanup_expired_uploads: zip_* 빈 디렉터리(max_mtime==0)일 때 디렉터리 자체 mtime으로 폴백 후 삭제 판단.
- **P2-7** db_load_service.run_db_load: 배치 경로 finally에서 MySQL SSCursor 미소비 결과 drain 후 cur_src.close()(batch_executor_db와 동일 패턴).
- **P2-8** csv_reader.read_csv_robust: EOF(0x1a) 처리를 replace(b"\\x1a", b" ") 대신 rstrip(b"\\x1a")로 변경(파일 끝만 제거, 중간 데이터 보존).
- **P3-1** db_load_service._create_indexes_on_target: 사용자 지정 index_name에 re.sub(r"[^a-zA-Z0-9_]", "_", idx_name)[:63] 적용(SQL 식별자·인젝션 방지).

**스킵·이유:**
- **P0-4** delete_etl_table rollback 후 주석: psycopg2 동작상 코드 변경 불필요, 주석만 정리된 상태 유지.
- **P1-5** preview_service SKIP_HEADER_LIKE_ROWS 상수 삭제: 파일 미리보기에서 향후 사용 가능성 있음, 동작 변경 없이 데드 코드만 제거하는 것은 스킵(문서화로 대체).

**변경 파일:** Backend/etl_server2/load_service.py, batch_executor_db.py, db_load_service.py, router.py, csv_reader.py, docs/report/log.md.

---

## 2026-03-10 ETL 코드 종합 점검 3차 반영

**적용 항목:**
- **P0-1** load_service.run_file_upsert: `{batch_ph}` 문자열 치환 제거, 루프 안에서 f-string으로 INSERT SQL 직접 조립(SQL Injection·파라미터 깨짐 방지).
- **P0-2** load_service.run_file_load: column_mapping 블록 전에 `columns: list = []` 초기화.
- **P0-3** batch_executor_db: except 블록에서 finish_run 호출 전 `run_completed_ok` 체크 추가(이미 성공한 run을 error로 덮어쓰지 않음).
- **P0-4** db_load_service._copy_upsert_batch: TEMP 테이블명을 `id(cur)` 대신 `uuid.uuid4().hex[:12]` 사용.
- **P0-5** service_file.create_batch_job: DB 배치 시 file_extensions를 None 대신 빈 문자열(`""`)로 저장(parser_file·프론트 기본값 호환).
- **P1-2** batch_executor_db: SKIP_HEADER_LIKE_ROWS = False (DB 소스에는 헤더 행 없음, 정상 데이터 삭제 방지).
- **P1-3** preview_service: _preview_db 등 DB 소스 미리보기에서 SKIP_HEADER_LIKE_ROWS 필터 제거.
- **P1-4** db_load_service.run_db_load: 비배치 경로에서 cur_src/src_conn close 후 None 할당(except 이중 close 방지).
- **P1-6** router.upload_file: column_mapping·index_definitions JSON 파싱 실패 시 HTTPException(400) 반환.
- **P2-1** load_service_file._batch_upsert: distinct_where를 col_types 기반 캐스트로 변경(TIMESTAMP 등 일관성).
- **P2-2** batch_executor_file._wait_for_stable_size: 안정 판정 조건에 `prev_size >= 0` 추가.
- **P2-4** csv_reader._read_with_pandas: 1차 engine="c", 실패 시 engine="python" 폴백.
- **P2-5** db_load_service._ensure_unique_constraint: 제약 이름에 pk_list 해시 추가(`_etl_uq_{pk_hash}`).
- **P2-6** scheduler_file.run_now: one_shot_id를 time 대신 uuid.uuid4().hex[:8] 사용.
- **P3-1** load_service._resolve_upload_path: fallback 경로에 is_relative_to(UPLOAD_DIR) 검사 추가(Path traversal 방어).
- **P3-2** router.add_files_zip_to_table: extractall 전 각 멤버 경로가 extract_dir 하위인지 검증(Zip Slip 방어).

**스킵·이유:** 명시된 항목은 모두 반영. 별도 스킵 없음.

**변경 파일:** Backend/etl_server2/load_service.py, batch_executor_db.py, db_load_service.py, service_file.py, preview_service.py, router.py, load_service_file.py, batch_executor_file.py, csv_reader.py, scheduler_file.py, docs/report/log.md.

---

## 2026-03-10 ETL2 코드 점검 결과 2차 반영

**적용 항목:**
- **P0-1** batch_executor_file: run_batch_job 본문의 import 4줄을 함수 안으로 들여쓰기 이동(SyntaxError 방지).
- **P0-2** load_service_file._batch_upsert: UPDATE의 pk_where에서 v 쪽 캐스트를 `(v."{p}")::{col_types.get(p, "text")}`로 명시(UUID 등 비text PK 대응).
- **P0-3** batch_executor_db: etl_table_id 참조 모드에서 column_mapping이 문자열이면 json.loads 처리 추가.
- **P0-4** service.delete_etl_table: batch_jobs 삭제 실패 시 rollback 후 etl_transform_rules/etl_jobs/etl_tables 삭제가 새 트랜잭션에서 실행되도록 주석 정리.
- **P1-5** scheduler_file.run_now: skip_seconds = max(interval_minutes * 30, 60)으로 수정(주기 절반 또는 최소 60초).
- **P1-6** preview_service._get_preview_with_transform: apply_mapping_type_cast 후 preview_rows 조회 시 rec.get(m["target"], rec.get(m["source"])) 사용.
- **P1-7** service_file.create_batch_job: jtype == "db"일 때 file_extensions를 None으로 저장.
- **P1-8** batch_executor_db: finally에서 MySQL SSCursor close 전에 fetchmany로 남은 결과 소비 로직 추가.
- **P2-9** service.update_etl_table: 필드별 개별 UPDATE를 동적 SET 절 1회 UPDATE로 통합.
- **P2-10** router._save_upload: file.file.read() 대신 shutil.copyfileobj(file.file, f, 65536)으로 대용량 업로드 시 메모리 절감.
- **P3-11** service_file.list_batch_jobs: SELECT에 j.on_file_error 컬럼 추가(get_batch_job은 j.*로 이미 포함).

**스킵·이유:** 이번 지시에서 명시된 항목은 모두 반영함. 별도 스킵 없음.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, load_service_file.py, batch_executor_db.py, service.py, scheduler_file.py, preview_service.py, service_file.py, router.py, docs/report/log.md.

---

## 2026-03-10 ETL2 코드 전체 점검 리포트 반영 (P0·P1·P2·P3)

**적용 항목:**
- **P0-1** service_file.get_last_processed_ts: DB에서 datetime/ISO 문자열로 오는 last_processed_ts를 14자리 형식으로 통일해 get_pending_files 비교와 일치시킴.
- **P0-2** parser_file.get_pending_files: last_processed_ts에 datetime 객체가 들어와도 14자리 문자열로 정규화.
- **P0-3** load_service_file._batch_upsert: PK 비교를 ::text가 아닌 col_types 기준 캐스트로 변경(타입 불일치 방지).
- **P0-4** service.create_etl_table: full 모드 시 테이블 존재 여부를 기본 DB가 아닌 storage_connection_id 기준 target_table_exists로 확인.
- **P1-5** batch_executor_file: 모든 파일이 skipped일 때 run status를 "skipped"로 마감하도록 분기 추가.
- **P1-6** schema_infer: CSV 읽기 시 pd.read_csv(utf-8) 대신 csv_reader.read_csv_robust 사용(인코딩 감지).
- **P1-7** batch_executor_db, preview_service: 헤더 유사 행 제거를 SKIP_HEADER_LIKE_ROWS 플래그로 제어(False 시 비활성화 가능).
- **P2-10** load_service_file.get_target_connection 제거, 호출처(batch_executor_file, batch_executor_db, service_file)에서 service.get_target_db_connection 직접 사용.
- **P2-13** batch_executor_db: 루프 직후 중복 cur_src.close() 제거, finally에서만 close.
- **P3-14** service_file.create_batch_job: file 배치에서 file_pattern 빈 값이어도 (folder + target_table + storage) 중복 검사 수행.
- **P3-15** service_file._ensure_batch_target_registry_table: 프로세스당 1회만 DDL 실행하도록 _registry_table_ensured 플래그 추가.

**스킵·이유:**
- **#8 type_mapping 통합**: 신규 모듈·다수 파일 수정으로 영향 범위 큼. 별도 작업으로 진행 권장.
- **#9 file_reader 통합**: 동일. 별도 리팩토링으로 진행 권장.
- **#11 service_file dict/tuple 정리**: 시스템 DB가 항상 RealDictCursor인지 전제 검증 필요. 일괄 제거 시 tuple 전달 경로에서 오동작 가능해 보수적으로 스킵.
- **#12 JSONB 불필요 json.loads 제거**: 드라이버/환경에 따라 JSONB가 문자열로 올 수 있어 제거 시 호환성 리스크.

**변경 파일:** Backend/etl_server2/service_file.py, parser_file.py, load_service_file.py, service.py, batch_executor_file.py, batch_executor_db.py, schema_infer.py, preview_service.py, docs/report/log.md.

---

## 2026-03-10 ETL2 폴더 배치 duplicate_checksum 스킵 후에도 run 반복 생성 방지(보강)

**문제:** duplicate_checksum 시 update_last_processed_ts 호출을 추가했음에도, 재시작 후 동일 파일(test_sftp_1_ib_20260306100001.csv)이 매 주기 pending에 남아 run이 계속 생성됨(244, 241, 239, 237 등).

**원인 추정:** (1) last_processed_ts가 빈 문자열로 읽히면 get_pending_files에서 `ts > ""`가 항상 참이 되어 해당 파일이 계속 포함됨. (2) run 시작 시점의 job 캐시와 실제 DB의 last_processed_ts 불일치 가능성.

**조치:**
- **parser_file.get_pending_files**: last_processed_ts가 빈 문자열/공백이면 None으로 정규화.
- **service_file.get_last_processed_ts**: batch_jobs.last_processed_ts를 DB에서 직접 조회하는 함수 추가(빈 문자열이면 None 반환).
- **batch_executor_file**: skipped_filenames 필터 후, get_last_processed_ts로 DB에서 last_processed_ts 재조회하여 `pending`을 한 번 더 필터(ts > fresh_lp). 실제 처리할 파일이 없으면 run 생성 없이 return.

**변경 파일:** Backend/etl_server2/parser_file.py, service_file.py, batch_executor_file.py, docs/report/log.md.

---

## 2026-03-09 ETL2 DB 배치 동일 시각 이중 실행 방지

**문제:** DB 연결 배치 잡 실행 이력에서 동일 시간대에 두 번씩 조회되는 현상(예: 17:40:18 run 225, 17:40:20 run 226). 원인: run_now가 `add_job(..., replace_existing=True, next_run_time=now)`로 기존 interval 잡을 덮어써, interval 실행 직후 '지금 실행'이 한 번 더 스케줄되어 이중 실행됨.

**조치:**
- **scheduler_file.run_now**: (1) last_run_at이 최근(min(주기/2초, 60초) 이내)이면 스킵하고 `skipped_recent_run` 반환. (2) interval 잡을 덮어쓰지 않고, 1회용 잡만 추가(DateTrigger, id=`batch_{id}_run_now_{ts}`)하여 동일 배치가 짧은 간격으로 두 번 실행되지 않도록 함.
- **router_file**: run-now 응답에 `skipped_recent_run` 시 메시지 반환.
- **BatchJobListFile, BatchScheduleModal**: run-now 응답의 `skipped_recent_run` 처리 및 에러 영역에 메시지 표시.

**변경 파일:** Backend/etl_server2/scheduler_file.py, router_file.py, Frontend/.../BatchJobListFile.jsx, BatchScheduleModal.jsx, docs/report/log.md.

---

## 2026-03-09 ETL2 실행 이력·문제파일 목록 UI 개선

**적용 내용:**
- **실행 이력 목록 모달**: 테이블 wrap에 `etl-db-form__table-wrap--viewport-scroll` 적용. `max-height: min(55vh, 480px)`, `overflow: auto`로 좌우·상하 스크롤이 보이는 창 안에서 동작하도록 변경(이전에는 row 맨 아래에 스크롤이 있어 사용 불편).
- **문제 파일 목록**: 테이블에 `etl-skipped-files-table` 클래스 추가. 파일명·타임스탬프·상태·감지 시각 컬럼은 `min-width`·`white-space: nowrap`으로 줄바꿈 없이 폭 여유 확보. 사유 컬럼은 `max-width: 220px`, `overflow: hidden`, `text-overflow: ellipsis`, 호버 시 `title`로 전체 내용 표시.

**변경 파일:** Frontend/.../etl2/etl.css, BatchHistoryPanelFile.jsx, SkippedFilesPanelFile.jsx, docs/report/log.md.

---

## 2026-03-09 ETL2 폴더 배치: duplicate_checksum 스킵 시 재진입 방지

**문제:** 동일 내용 파일이 다른 일자명으로 올라올 때 duplicate_checksum으로 스킵되나, 스킵 시 `last_processed_ts`를 갱신하지 않아 다음 주기마다 같은 파일이 pending에 다시 포함되고, 매번 새 run이 생성되어 실행 이력 행이 불필요하게 누적됨.

**조치:** `Backend/etl_server2/batch_executor_file.py`에서 duplicate_checksum으로 스킵할 때도 `update_last_processed_ts(batch_job_id, ts)` 호출. 해당 파일(타임스탬프)을 이미 본 것으로 처리해 다음 `get_pending_files`에서 제외되도록 함. file_results 항목에 `timestamp` 필드 추가(이력/문제파일 목록 표시 일관성).

**변경 파일:** Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-03-09 KPI 카드 채널별 도넛 추가

**적용 내용:**
- **총 발송요청·총 발송성공·총 오픈수·총 클릭수** 4개 카드에 채널별 % 도넛 차트 및 범례 추가. 캠페인 건수·워크플로우 건수는 도넛 없이 MiniStat 유지.
- **Backend dashboard_service.py**: 채널 집계 쿼리에 open_count, click_count 추가. channel_distribution.open, channel_distribution.click 채널별 value·percentage 반환.
- **Frontend KPISummaryCards**: MiniDonutCard 복원(증감률 표시 포함), 4개 지표에 dist.send/success/open/click 전달.

**변경 파일:** Backend/api_server/dashboard_service.py, Frontend/.../KPISummaryCards.jsx.

---

## 2026-03-09 KPI 카드 구성·라벨 변경

**적용 내용:**
- **KPISummaryCards**: 상단 3개 — 캠페인 건수, 총 발송요청, 총 발송성공 / 하단 3개 — 워크플로우 건수, 총 오픈수, 총 클릭수. 6개 모두 MiniStat 카드로 통일, 도넛 카드 제거. 증감률은 발송요청·발송성공·오픈수·클릭수에만 표시(kpi.send_change_pct 등).
- **NewDashboardPage**: KPISummaryCards에 distribution prop 제거.
- **백엔드**: summary API가 이미 campaign_count, workflow_count, total_send, total_success, total_open, total_click 및 증감률 4종 반환 — 변경 없음.

**변경 파일:** KPISummaryCards.jsx, NewDashboardPage.jsx.

---

## 2026-03-09 주차 표준(M월 N주차)·주간 추이 W00 수정·테이블 헤더 정렬

**적용 내용:**
- **주차 기준**: ISO 8601·마케팅 관례 적용 — 월요일 시작, 목요일 포함 기준. 표시는 "몇월 몇주차"(M월 N주차). 매월 1주차 = 1일이 월~목에 있으면 그 주가 1주차, 1일이 금~일이면 다음 주 월요일부터 1주차.
- **dateUtils.js**: getMonthWeekLabel(ymd) → "M월 N주차" 추가. toLocalDateString(d) 추가(UTC 비틀림 방지). getISOWeekNumber 유지(연간 주차·input type="week" 용).
- **TrendLineChart**: getFullDateRange/getFullWeekRange에서 toISOString 대신 toLocalDateString 사용(로컬 YYYY-MM-DD 보장). getFullWeekRange 월요일 계산 수정. 주간 X축 라벨을 getMonthWeekLabel(ymd)로 변경(W00 제거, 각 주 "M월 N주차" 표시).
- **SummaryHeader**: 주차 라벨을 getISOWeekNumber 기반 "N주차" → getMonthWeekLabel 기반 "M월 N주차"로 변경.
- **CampaignRankTable**: 컬럼 헤더 정렬 — 순위·캠페인명(워크플로우명)만 nd-rank-table__th--center, 채널·숫자 컬럼 nd-rank-table__th--right.

**변경 파일:** dateUtils.js, TrendLineChart.jsx, SummaryHeader.jsx, CampaignRankTable.jsx.

---

## 2026-03-09 CampaignRankTable UI 전면 개선

**적용 내용:**
- **컬럼 폭**: `table-layout: fixed` + `<colgroup>`으로 컬럼별 고정 width(순위 52px, 이름 200/260px, 채널 72px, 숫자/비율 75~90px). `min-width: 820px`로 좁은 화면에서 가로 스크롤.
- **정렬**: 전체/캠페인별/워크플로우별 모든 탭에서 동일 정렬 UX. 탭 전환 시 정렬 기본값(발송성공 내림차순)으로 리셋(handleViewChange).
- **숫자·비율**: `nd-rank-table__th--right`, `nd-rank-table__td--right` + `font-variant-numeric: tabular-nums`.
- **캠페인명**: `nd-rank-table__td--name` + `max-width: 0` + ellipsis, `title` 툴팁.
- **구조**: COLUMNS 배열에 width·format(number/rate), formatCell, VIEW_TABS, nd-rank-table__scroll 래퍼. CSS 랭킹 테이블 블록 전면 교체.

**변경 파일:** CampaignRankTable.jsx, new-dashboard.css.

---

## 2026-03-09 추이 첫 구간·퍼널 정합성·비율 표시 개선 및 검증

**적용 내용:**
- **Backend/new_dash_server/router.py**: trend-multi 응답 `date` 포맷 통일. weekly는 `date_trunc(...)::date::text` → `to_char(date_trunc('week', delivery_date)::date, 'YYYY-MM-DD')`, daily는 `delivery_date::text` → `to_char(delivery_date, 'YYYY-MM-DD')`로 변경. 프론트 fullDates와의 매칭 보장(첫 구간 누락 가능성 제거).
- **Backend/api_server/dashboard_service.py**: KPI `click_rate` 정의 수정. 기존 `total_click/total_success` → `total_click/total_open`(오픈 대비 클릭). 퍼널 바의 "클릭" pct(click/open)와 가이드 "클릭률" 표시 일치.
- **TrendLineChart**: 오픈률/클릭률 탭 선택 시 툴팁·범례·Y축에 `%` 표시 확인됨(isRate 기반 toFixed(2)% / tickFormatter `${v}%`) — 추가 수정 없음.
- **FunnelSection**: 가이드(success_rate, open_rate, click_rate)와 바(발송성공=성공/발송, 오픈=오픈/성공, 클릭=클릭/오픈) 정합성 — 백엔드 click_rate 수정으로 해소. CampaignRankTable은 이미 click_rate = click/open 사용 중.

**검증 요약:** trend-multi API 응답 date 필드명·형식 변경 없음(YYYY-MM-DD 유지). summary KPI 필드명 변경 없음(click_rate 계산식만 수정). 프론트 FunnelSection·KPISummaryCards·CampaignRankTable 연동 필드 일치.

**변경 파일:** Backend/new_dash_server/router.py, Backend/api_server/dashboard_service.py.

---

## 2026-03-09 뉴 대시보드 백엔드 코드 품질 개선 (router.py)

**적용 내용:**
- **Backend/new_dash_server/router.py**: trend-multi 6개 쿼리(by_channel×period) → `_build_trend_multi_query(full_table, date_expr, group_expr, by_channel)` 1개 함수로 통합. `_trend_multi_range(end_dt, period, days, count)`로 period별 start_dt·date_expr·group_expr 계산 분리. CHANNEL_MAPPING 중복 제거 → dashboard_service에서 import. summary 증감률 4줄 → for 루프로 통합. _calc_previous_range 중간 변수 정리.
- **db.py, dashboard_service.py, analysis_store.py, dependencies.py, main.py**: 변경 없음.

**변경 파일:** Backend/new_dash_server/router.py.

---

## 2026-03-09 뉴 대시보드 코드 품질 개선 (중복 제거·유틸 분리·연산 최적화)

**적용 내용:**
- **dateUtils.js (신규)**: `getISOWeekNumber`, `dateToWeekValue`, `weekValueToDate` 공통 유틸 분리. SummaryHeader·TrendLineChart 중복 제거.
- **SummaryHeader.jsx**: 로컬 날짜 유틸 3개 삭제 → `./dateUtils` import. formatDateDisplay·handleDateInput 간소화.
- **TrendLineChart.jsx**: METRIC_TABS에 dataKey·stroke 통합 → 6단 분기 제거. RATE_KEYS를 Set으로 변경(.has). calcRate 공통화, getChannelMetricValue·buildTotalChartData에서 사용. buildTotalChartData는 byDate 구성 시 한 번만 계산 후 dates.map으로 매핑. 전체 모드 범례에서 오픈률/클릭률 중복 제거(탭으로 이미 분리). 툴팁 하단 오픈률/클릭률 블록 제거, isRate 기반 값 포맷만 유지.
- **CampaignRankTable.jsx**: aggregateByCampaign·aggregateByWorkflow → `aggregateBy(data, groupKey)` 하나로 통합. 비정렬 모드 헤더를 SORTABLE_COLUMNS.map으로 통일. isAll 변수 추출.
- **ChannelDonutSection.jsx**: 미사용 빈 컴포넌트 삭제.
- **new-dashboard.css**: nd-loading-overlay, nd-loading-spinner, @keyframes nd-spin 제거(미사용).

**변경 파일:** components/dateUtils.js(신규), SummaryHeader.jsx, TrendLineChart.jsx, CampaignRankTable.jsx, new-dashboard.css. 삭제: ChannelDonutSection.jsx.

---

## 2026-03-09 뉴 대시보드 로딩·추이 탭·주차·기간·정렬 개선

**적용 내용:**
- **로딩**: nd-loading-overlay div 제거. 새로고침 버튼에만 "조회 중..." 표시(최초 진입 시에도 동일).
- **TrendLineChart**: 메트릭 탭에 오픈률·클릭률 추가(발송수/성공수/오픈수/클릭수/오픈률/클릭률 6개). 탭은 항상 노출, 선택한 메트릭 1개만 라인 표시. 채널 모드에서 오픈률/클릭률은 성공수 기준 계산 후 피벗. Y축·툴팁 rate 시 % 포맷.
- **SummaryHeader**: 주간 선택 시 ◀ 날짜 ▶ 와 period 토글 사이에 "N주차" 표시(ISO 주차). 달력: 주간 시 input type="week"(YYYY-Www), 월간 시 type="month". dateToWeekValue/weekValueToDate/getISOWeekNumber 추가. nd-header__week-label 스타일.
- **trend-multi API**: period(daily|weekly|monthly), count(10) 파라미터 추가. 일간=해당 일 포함 이전 10일, 주간=해당 주 포함 이전 10주(date_trunc week), 월간=해당 월 포함 이전 10개월(date_trunc month). 응답에 period 포함.
- **client.js**: getNewDashboardTrendMulti에 period, count 전달.
- **NewDashboardPage**: trend 호출 시 period, days:10, count:10. TrendLineChart에 period, count 전달.
- **TrendLineChart**: fullDates를 period별 생성(getFullWeekRange, getFullMonthRange). dateLabel을 period에 따라 일(MM/DD)·주(Wn)·월(YYYY/MM) 형식. buildTotalChartData/pivotByChannel에 period 전달.
- **CampaignRankTable**: view===전체 일 때 발송요청~클릭률 컬럼 헤더 클릭 정렬. 클릭=단일 컬럼 오름/내림 전환, Shift+클릭=다중 정렬 추가. 정렬된 헤더 시각 표시(배경·▼▲·우선순위). nd-rank-table__th--sortable/__th--sorted 등 CSS.

**변경 파일:** NewDashboardPage.jsx, TrendLineChart.jsx, SummaryHeader.jsx, CampaignRankTable.jsx, new-dashboard.css, Backend/new_dash_server/router.py, shared/api/client.js, docs/report/log.md.

---

## 2026-03-09 뉴 대시보드 추이 기간·채널별 탭 수정

**적용 내용:**
- **기간**: 추이 그래프를 "기준일(targetDate) 포함 이전 30일"로 통일. loadData를 Promise.all 병렬 호출로 복원, endDate=targetDate 사용(date_range_actual 종료일 제거).
- **trend-multi by_channel**: Backend new_dash_server/router.py에 by_channel 쿼리 파라미터 추가. True일 때 delivery_channel별 GROUP BY, 응답 rows에 channel/channel_code, by_channel 플래그 반환.
- **client.js**: getNewDashboardTrendMulti에 byChannel 옵션 추가, by_channel=true 쿼리 전달.
- **TrendLineChart**: 메트릭 탭(발송수/성공수/열람수/클릭수) 추가. byChannel이면 탭 선택 시 해당 지표 채널별 라인(Email/SMS/iOS/Android/Kakao), 아니면 전체 합산 4라인. pivotByChannel, buildTotalChartData, dateLabel 사용. Tooltip labelFormatter·contentStyle 적용.
- **NewDashboardPage**: trend-multi 호출 시 byChannel: true, TrendLineChart에 byChannel={trendMultiData?.by_channel} 전달.
- **CSS**: nd-trend-chart__tabs, nd-trend-chart__tab, nd-trend-chart__tab--active 스타일 추가.

**변경 파일:** NewDashboardPage.jsx, Backend/new_dash_server/router.py, shared/api/client.js, TrendLineChart.jsx, new-dashboard.css, docs/report/log.md.

---

## 2026-03-09 뉴 대시보드 UX/품질 개선 (날짜 달력·KPI·퍼널·추이·페이지네이션·로딩)

**적용 내용:**
- **SummaryHeader**: 날짜 영역 클릭 시 네이티브 `<input type="date|month">` 달력 표시. `onDateChange` props 추가, period별 input type(daily/weekly: date, monthly: month).
- **NewDashboardPage**: trend-multi 호출 시 `endDate`를 summary의 `date_range_actual[1]`로 변경(월간 시 기간 정확성). `handleDateChange`, 로딩 시 `nd-loading-overlay`+스피너 표시.
- **KPISummaryCards**: MiniStat에 description·header(증감률 우측), value 32px, nd-kpi-card__desc 추가. MiniDonutCard 80×80 도넛, 카드 내 범례(donut-legend), description 추가.
- **FunnelSection**: "전환" 바 제거(4단계). FunnelBar에 prevValue 추가, 이전 단계 대비 비율(%) 표시. 가이드에 guide-desc·guide-thresholds(✅🔶🔴 기준) 추가.
- **TrendLineChart**: "전환" 라인 제거. recharts Legend를 커스텀(renderLegend)으로 교체, 메트릭명+최신값 한 곳에 표시. nd-trend-chart__legend-values 제거.
- **CampaignRankTable**: PAGE_SIZE 5→10. 페이지네이션을 ≪ ◀ "1/N" ▶ ≫ 방식으로 변경(nd-rank-table__page-btn, nd-rank-table__page-info).
- **new-dashboard.css**: nd-header__date-label/date-display/date-input, nd-loading-overlay/spinner, nd-spin 키프레임, KPI 카드·도넛 레이아웃·범례, trend 커스텀 범례, funnel guide-desc/thresholds, rank 테이블 페이지네이션 스타일.

**변경 파일:** SummaryHeader.jsx, NewDashboardPage.jsx, KPISummaryCards.jsx, FunnelSection.jsx, TrendLineChart.jsx, CampaignRankTable.jsx, new-dashboard.css, docs/report/log.md.

---

## 2026-03-09 뉴 대시보드 페이지 제작 구현 완료

**적용 내용:**
- **백엔드**: `Backend/new_dash_server` 패키지 신규 생성. `router.py`에 summary(period·증감률), trend, trend-multi, tables 엔드포인트 및 `_calc_date_range`, `_calc_previous_range`, `_calc_change_pct` 구현. `api_server/main.py`에 new_dashboard_router 등록.
- **프론트 API**: `shared/api/client.js`에 getNewDashboardTables, getNewDashboardSummary, getNewDashboardTrend, getNewDashboardTrendMulti 4함수 추가.
- **프론트 패키지**: `packages/new-dashboard` — index.jsx, NewDashboardPage.jsx(loadData: summary+trendMulti, period 기본 monthly, moveDate), new-dashboard.css(전체 스타일). components: SummaryHeader(period 토글·날짜 표시), KPISummaryCards(증감·미니 도넛), ChannelDonutSection(빈 껍데기), TrendLineChart(5라인 recharts), FunnelSection(5단계+가이드), CampaignRankTable(탭 전체/캠페인별/워크플로우별·페이지네이션).
- **App.jsx**: import NewDashboardPage, NavLink "뉴 대시보드", Route /new-dashboard, 상단 주석 갱신.
- 플랜 문서 최종 점검 반영: summary period 기본값 monthly, 하단 퍼널도 별도 파일 미생성, Phase 6 주석 갱신 체크리스트 추가.

**변경·신규 파일:** Backend/new_dash_server/__init__.py, router.py, api_server/main.py, Frontend/react-app/src/shared/api/client.js, packages/new-dashboard/*, App.jsx, docs/report/12_뉴대시보드_제작_플랜.md, docs/report/log.md.

---

## 2026-03-09 뉴대시보드 제작 플랜 — Phase 6 App.jsx 구체화

**적용 내용:**
- **docs/report/12_뉴대시보드_제작_플랜.md** Phase 6 (§8) 수정: App.jsx 확인 결과 반영.
  - **구조 확정**: 좌측 사이드바가 아닌 **상단 수평 네비바**. 프로토타입 이미지의 좌측 사이드바 영역은 무시.
  - **수정 파일**: App.jsx **단일 파일**. import 1줄, NavLink 1개(대시보드2 다음), Route 1줄 추가. **lazy 미사용**(직접 import, 기존 패턴과 동일).
  - §8.2에 추가할 **구체 코드** 명시: `import NewDashboardPage from './packages/new-dashboard'`, NavLink(to="/new-dashboard", 라벨 "뉴 대시보드"), `<Route path="/new-dashboard" element={<NewDashboardPage />} />`.
  - §8.3 체크리스트: 사이드바 관련 항목 제거, App.jsx 기준 import·NavLink·Route 추가·동작 확인으로 정리.
  - §1 Phase 6 테이블: 대상 파일 `App.jsx`로 명시. §1-1 영역 A: 상단 네비바 확정·이미지 사이드바 무시. §12 관련 파일: 라우팅·네비 = App.jsx.

**변경 파일:** docs/report/12_뉴대시보드_제작_플랜.md, docs/report/log.md.

---

## 2026-03-09 뉴대시보드 제작 플랜 — 2차 검증 반영(구멍 메우기 8건)

**적용 내용:**
- **docs/report/12_뉴대시보드_제작_플랜.md** 수정: 1차 검증(이미지↔플랜)·2차 검증(문서 내부 일관성)·실행 실패 가능 지점 보완.
  - **수정 1**: Phase 2a "API 클라이언트 4종"으로 정정 (getNewDashboardTrendMulti 포함).
  - **수정 2**: summary 엔드포인트 **group_by 전부 True** 명시 (CampaignRankTable 워크플로우별 탭에서 workflow 데이터 필요).
  - **수정 3**: trend-multi에 **db import**·**SQL 패턴 pseudo-code** 추가.
  - **수정 4**: Phase 3 loadData에서 **trend-multi만 호출**, 상태는 trendMultiData만 사용(trendData 제거).
  - **수정 5**: **ChannelDonutSection** Phase 4에서 미구현·빈 껍데기, NewDashboardPage 레이아웃에서 호출 제거. FunnelSection은 영역 F만, 영역 H(하단 퍼널도)는 플레이스홀더/주석 명시.
  - **수정 6**: Phase 4 체크리스트 최상단 **recharts 설치 확인** 항목 추가.
  - **수정 7**: Phase 6 체크리스트에 **사이드바·라우터 파일 확인** 추가. 상위 페이지(App.jsx 등) 수정은 프로젝트 구조에 따라 확인하도록 §8 목표·수정 대상·체크리스트 완화.
  - **수정 8**: Phase 5 체크리스트에 **증감 표시 색상 방향 확인** 항목 추가.

**변경 파일:** docs/report/12_뉴대시보드_제작_플랜.md, docs/report/log.md.

---

## 2026-03-09 뉴대시보드 제작 플랜 — 프로토타입 대조 반영(증감률·멀티라인·기본값·탭 등)

**적용 내용:**
- **docs/report/12_뉴대시보드_제작_플랜.md** 수정: 프로토타입 이미지와의 누락·불일치 사항 반영.
  - **추가 A — 증감률**: Phase 1 summary에 `_calc_previous_range`, `_calc_change_pct` 및 현재·이전 기간 2회 조회, kpi에 `send_change_pct`, `success_change_pct`, `open_change_pct`, `click_change_pct` 반환 명세.
  - **추가 B — trend-multi**: `GET /api/new-dashboard/trend-multi`, 일자별 total_count·success_count·open_count·click_count 한 번에 반환.
  - **추가 C — KPISummaryCards**: 2행 카드에 미니 도넛(60×60) 인라인, Props에 distribution·changePcts.
  - **추가 D — TrendLineChart**: trendMulti rows 기준 5라인(발송요청/성공/오픈/클릭/전환), 범례+최신값.
  - **추가 E — CampaignRankTable**: 상단 탭 전체/캠페인별/워크플로우별, 프론트 reduce 재집계.
  - **추가 F — period 기본값**: period 기본값 `monthly`, getNewDashboardSummary 기본 period `monthly`.
  - **FunnelSection**: 전환 단계 0 또는 N/A 표시(5단계).
  - **§1-1 프로토타입 이미지 vs 플랜 대조 요약** 표 추가(A~H 영역·심각도).
  - Phase 6에 **사이드바** 설명(좌측 사이드바 있으면 항목만 추가).
  - Phase 4·7 체크리스트 세분화(컴포넌트별·증감률·trend-multi·기본값 monthly).
- **docs/report/00_ReportIndex.md**: 12_뉴대시보드_제작_플랜.md 설명 갱신.

**변경 파일:** docs/report/12_뉴대시보드_제작_플랜.md, docs/report/00_ReportIndex.md, docs/report/log.md.

---

## 2026-03-09 뉴대시보드 제작 플랜 — 일간/주간/월간 반영

**적용 내용:**
- **docs/report/12_뉴대시보드_제작_플랜.md** 수정: 프로토타입 헤더 우측 **일간·주간·월간** 토글 사양 반영.
  - Phase 1: `/daily-summary` → `/summary`, `period`(daily|weekly|monthly) 파라미터 및 `_calc_date_range`로 기간별 date_range 계산, 응답에 `period`, `date_range_actual` 포함.
  - Phase 2a: `getNewDashboardDailySummary` → `getNewDashboardSummary(tableId, targetDate, period)`.
  - Phase 3: `period` 상태, `moveDate`를 period별 이동 단위(daily ±1일, weekly ±7일, monthly ±1개월), `dateRangeActual` 전달.
  - Phase 4 SummaryHeader: period 토글 버튼 3개, period별 날짜 표시 형식(daily: YYYY.MM.DD, weekly: 시작~종료, monthly: YYYY.MM).
  - Phase 5: 기간 토글 CSS 클래스 추가. Phase 7 검증: `/summary` 및 period별 검증 항목.
  - §10 **최종 데이터 흐름** 추가(period=weekly 예시). 교체 가이드: Phase 1·2a·3·4-1·5는 사용자 제공 Cursor 프롬프트로 교체 적용.

**변경 파일:** docs/report/12_뉴대시보드_제작_플랜.md, docs/report/log.md.

---

## 2026-03-09 뉴대시보드 제작 플랜 문서 작성

**적용 내용:**
- **docs/report/12_뉴대시보드_제작_플랜.md** 신규 작성: 일간 현황판 스타일 New Dashboard 제작을 위한 Phase별 플랜. 데이터 소스는 ibank_test_data 스키마의 ibank_1 테이블(table_id="ibank_1"). Phase 1(백엔드 라우터 daily-summary/trend/tables) → 2a(API 클라이언트 3종)·2b(패키지 껍데기, 병렬 가능) → 3(메인 페이지)·4(6개 컴포넌트)·5(CSS)·6(라우팅·네비)·7(검증). 서브에이전트 배정(@be-router, @fe-impl, @fe-style, @linker, @verifier)·대상 파일·체크리스트·API·컴포넌트 명세 포함.
- **docs/report/00_ReportIndex.md**: 12_뉴대시보드_제작_플랜.md 항목 추가.

**변경 파일:** docs/report/12_뉴대시보드_제작_플랜.md(신규), docs/report/00_ReportIndex.md, docs/report/log.md.

---

## 2026-03-06 API Server 코드 품질 점검·개선

**적용 내용:**
- **Backend/api_server/analysis_store.py**: `save_analysis_result`에서 예외 시 `conn.rollback()` 후 `raise` 하도록 try/except/finally 추가.
- **Backend/api_server/dashboard_service.py**: `get_chart_data`에서 dimension·metric 식별자 SQL 삽입 시 이스케이프용 큰따옴표 적용 및 화이트리스트 검증 주석 추가. `_calculate_kpi`의 channel_distribution open/click 빈 배열에 TODO 주석. `_build_where_and_params` → `_build_filter_linked_where` 함수명 변경 및 get_filter_options 호출부 3곳 수정.
- **Backend/api_server/db.py**: `from Env import config`를 먼저 시도하고, 실패 시에만 try/except ImportError 내에서 sys.path·pathlib.Path로 프로젝트 루트 추가 후 재import. 모듈 상단 `from pathlib import Path` 제거.
- **Backend/api_server/dependencies.py**: except ImportError 블록에서 미사용 `import os` 제거.
- **Backend/api_server/main.py**: `import io`를 `if __name__ == "__main__"` 블록 안으로 이동. allow_origins를 `["*"]`만 사용하도록 단순화. `@app.on_event("startup")` 제거 후 `contextlib.asynccontextmanager` lifespan 패턴으로 전환, FastAPI(lifespan=lifespan)로 ETL 워커·배치 스케줄러 기동 유지.

**변경 파일:** Backend/api_server/analysis_store.py, dashboard_service.py, db.py, dependencies.py, main.py, docs/report/log.md.

---

## 2026-03-06 개발문서·README 반영 (log 기준)

**적용 내용:** docs/report/log.md 최종 개발문서 업데이트 이후 반영분을 docs/main·README에 반영.
- **02_BACKEND_GUIDE.md**: §3.3 etl_limits에 max_zip_extract_total_mb·add-files-zip 동작, §4.6 GET preview·PATCH clear_last_synced_at·add-files-zip, §2 etl_server2에 transform_upsert_verification·etl_limits 설명 보강, §6.7 preview 변환 룰·clear_last_synced_at·delete_etl_table cascade·get_skipped_filenames_set·batch_executor_db apply_rules·transform_upsert_verification, 변경 이력 2026-03-06.
- **00_PRD.md**: §3.2 etl_limits ZIP 총량 상한, §6.3.1 데이터 추가 모달 ZIP 안내 문구.
- **README.md**: etl_limits ZIP 한도 언급, ETL 목록 ZIP 안내(50MB·2GB), docs/main 최종 반영일 2026-03-06.
- **requirements.txt**: 대규모 코드 품질 개선 작업에서 신규 패키지 추가 없음(기존 의존성·표준 라이브러리만 사용). 수정 없음.

---

## 2026-03-06 ZIP 압축 해제 총량 제한 (ZIP bomb 방지)

**적용 내용:**
- **Backend/etl_server2/etl_limits.py**: `DEFAULT_MAX_ZIP_EXTRACT_TOTAL_MB = 2048`, `get_max_zip_extract_total_mb()` 추가. config.backend.etl_limits.max_zip_extract_total_mb 조회, 없으면 2GB 기본.
- **Env/config/config.json**: backend.etl_limits에 `max_zip_extract_total_mb: 2048` 추가.
- **Backend/etl_server2/router.py** `add_files_zip_to_table`: 압축 해제 전 `zf.infolist()`로 총 압축 해제 크기 합산 후 `get_max_zip_extract_total_mb()`와 비교, 초과 시 HTTP 400 및 메시지 반환. 제한 0이면 검사 생략. HTTPException 시 extract_dir 정리 후 재발생.

**변경 파일:** Backend/etl_server2/etl_limits.py, Backend/etl_server2/router.py, Env/config/config.json, docs/report/log.md.

---

## 2026-03-06 service_file·transform_rules_service 코드 품질 정리

**적용 내용:**
- **Backend/etl_server2/service_file.py**: `import re` 상단 이동(delete_batch_target_registry_and_drop_table 내부 제거). `_get_db`, `_schema`, `_q` 독자 구현 제거 → `from Backend.etl_server2 import service as etl_service` 후 etl_service 위임으로 통일(transform_rules_service와 동일 패턴). delete_batch_target_registry_and_drop_table 내부 중복 etl_service import 제거.
- **Backend/etl_server2/transform_rules_service.py**: `import json` 상단 이동, create_transform_rule·update_transform_rule 내부 2곳 제거.

**변경 파일:** Backend/etl_server2/service_file.py, Backend/etl_server2/transform_rules_service.py, docs/report/log.md.

---

## 2026-03-06 transform_engine·scheduler·컬럼정규화·_parse_config 통합

**적용 내용:**
- **Backend/etl_server2/transform_engine.py**: `import re`, `import hashlib`, `import json` 상단 이동. `_apply_masking` 내부 re/hashlib, `_parse_config` 내부 json 제거.
- **Backend/etl_server2/scheduler_file.py**: `from apscheduler.triggers.interval import IntervalTrigger` 상단 이동, `reschedule_job` 내부 lazy import 제거.
- **Backend/etl_server2/load_service_file.py**: `normalize_column_name_for_sequence(name, used)` 추가 — 컬럼명 정규화 + used 기준 유일 이름 반환. router/load_service와 공유.
- **Backend/etl_server2/load_service.py**: run_file_load·run_file_upsert 내부 인라인 컬럼 정규화 루프 제거 → `normalize_column_name_for_sequence` 사용.
- **Backend/etl_server2/router.py**: `_normalize_column_name_for_check` 제거 → `load_service_file.normalize_column_name_for_sequence` import 후 호출로 대체.
- **Backend/etl_server2/preview_service.py**: `_parse_rule_config` 로컬 정의 제거 → `transform_engine._parse_config` import(`_parse_rule_config` 별칭) 사용.

**변경 파일:** transform_engine.py, scheduler_file.py, load_service_file.py, load_service.py, router.py, preview_service.py, docs/report/log.md.

---

## 2026-03-06 router_file·db_load_service·service 코드 품질 정리

**적용 내용:**
- **Backend/etl_server2/router_file.py**: `scheduler_file` 상단 import 추가, 7곳 함수 내부 lazy import 제거. `update_batch_job`: 18개 필드 if 분기 → `body.model_dump(exclude_none=True)` 한 줄로 대체.
- **Backend/etl_server2/db_load_service.py**: `run_db_load` 내부 3곳의 `from datetime import datetime as dt` 제거, 상단 `datetime` 사용. `_pg_type_from_mysql` 내 도달 불가능한 `if t in ("tinyint",) and "bool" in t` 분기(dead code) 삭제.
- **Backend/etl_server2/service.py**: `create_etl_table` 내 빈 try/finally(conn 열고 닫기만 하던 블록) 삭제.

**변경 파일:** Backend/etl_server2/router_file.py, Backend/etl_server2/db_load_service.py, Backend/etl_server2/service.py, docs/report/log.md.

---

## 2026-03-06 queue_worker·db·etl_limits 코드 품질 정리

**적용 내용:**
- **Backend/etl_server2/queue_worker.py**: `run_worker_iteration` 내부의 중복 `from Backend.etl_server2 import service as etl_service` 삭제 (상단 import만 사용).
- **Backend/api_server/db.py**: 컬럼/PK 조회 공통화 및 ETL 타겟 함수 커넥션 1회 사용.
  - 내부 헬퍼 추가: `_table_exists(conn, schema, table_name)`, `_query_table_columns(conn, schema, table_name)`, `_query_primary_key_columns(conn, schema, table_name)`.
  - `get_table_columns` / `get_primary_key_columns`: 위 헬퍼 사용으로 중복 SQL 제거.
  - `table_exists_in_schema`: `_table_exists` 사용으로 SELECT 1 로직 일원화.
  - `get_table_columns_for_etl_target`, `get_primary_key_columns_for_etl_target`: 존재 확인 + 본 쿼리를 동일 conn으로 수행해 커넥션 2회 → 1회로 축소.
- **Backend/etl_server2/etl_limits.py**: `_safe_int(val, default)` 헬퍼 추가, `get_etl_limits` 내 3회 반복 try/except 정수 변환을 헬퍼 호출로 대체.

**변경 파일:** Backend/etl_server2/queue_worker.py, Backend/api_server/db.py, Backend/etl_server2/etl_limits.py, docs/report/log.md.

---

## 2026-03-06 ETL2 router.py import·엔드포인트 안내 정리

**배경:** 미사용 import 제거, lazy import 유지, threading 상단 이동, etl_index 엔드포인트 문자열을 실제 prefix(/api/etl2)에 맞춤.

**적용 내용:**
- **Backend/etl_server2/router.py**
  - 삭제: `from Backend.etl_server2 import load_service`, `from Backend.etl_server2 import transform_engine` (상단 미사용; load_service는 `_run_file_load_in_process` 내부 lazy import만 사용).
  - 상단 추가: `import threading`. `run_table_load` 내부의 `import threading` 제거.
  - `etl_index()`의 endpoints 리스트: `/api/etl/` → `/api/etl2/` 로 전부 수정. 로그 메시지 "GET /api/etl/jobs failed" → "GET /api/etl2/jobs failed".
  - 파일 상단 [Dependencies]: load_service·transform_engine 제거, load_service는 내부 lazy import 주석으로 명시.

**변경 파일:** Backend/etl_server2/router.py, docs/report/log.md.

---

## 2026-03-06 파일 배치: 이력에 스킵/에러된 파일 매 주기 재시도 방지

**배경:** 한 번 skipped(duplicate_checksum, file_size_exceeded 등) 또는 error로 기록된 파일이 다음 주기마다 pending에 다시 포함되어 매번 다운로드·체크섬·스킵을 반복함. 이력/문제 파일 목록으로 이미 확인 가능하므로 재시도할 필요 없음.

**적용 내용:**
- **Backend/etl_server2/service_file.py**
  - `get_skipped_filenames_set(batch_job_id, conn, max_runs=200)`: 배치 실행 이력(batch_run_history)에서 file_list의 status가 skipped 또는 error인 항목의 filename 집합 반환. 최근 max_runs개 run만 스캔.
- **Backend/etl_server2/batch_executor_file.py**
  - create_batch_run 후 `get_skipped_filenames_set` 호출 → pending 목록에서 해당 파일명 제외. 제외 후 pending이 비면 run을 success·files_processed=0으로 마치고 return하여 불필요한 다운로드 없음.

**변경 파일:** Backend/etl_server2/service_file.py, Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-03-06 파일 배치 "마지막 상태"가 성공인데 목록에 오류로 나오는 현상 수정

**배경:** 실행 이력에서는 최근 run이 success인데, 배치 Job 목록의 "마지막 상태"만 오류로 표시되는 경우가 있음. 원인: 목록은 `batch_jobs.last_run_status`를 그대로 사용하며, 파일 배치 실행기(batch_executor_file)에서 **실행이 성공/부분성공으로 끝난 뒤** `update_job_status(batch_job_id, "success")` 호출이 예외를 던지면, 바깥 `except`에서 `update_job_status(batch_job_id, "error", ...)`가 호출되어 정상 완료인데도 last_run_status가 "error"로 덮어써짐.

**적용 내용:**
- **Backend/etl_server2/batch_executor_file.py**
  - `run_completed_ok` 플래그 추가: `finish_run`으로 run을 success/partial_error(또는 cancelled)로 마친 뒤 `update_job_status("success")` 호출 직전에 `True`로 설정.
  - `except Exception` 블록에서 `update_job_status(batch_job_id, "error", ...)` 호출을 `if not run_completed_ok:` 안으로 이동. 성공/취소로 이미 끝난 뒤 `update_job_status("success")`만 실패한 경우에는 "error"로 갱신하지 않음.
  - 취소 경로(사용자 취소 시 finish_run(cancelled) 후 update_job_status("success"))에서도 동일하게 `run_completed_ok = True` 설정 후 update 호출.
- **Backend/etl_server2/batch_executor_db.py**: 동일한 패턴으로 `run_completed_ok` 플래그 추가, 성공 후 `update_job_status("success")` 실패 시 except에서 "error"로 덮어쓰지 않도록 수정.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, Backend/etl_server2/batch_executor_db.py, docs/report/log.md.

---

## 2026-03-06 테이블 목록 미리보기(저장 후 미리보기)에 변환 룰·타입 캐스트 적용

**배경:** ETL 테이블 목록의 "미리보기"(etl-table-list__preview)는 GET /tables/{id}/preview로 호출되며, 기존에는 소스 원본만 보여주고 변환(transform)·타입 캐스트가 반영되지 않았음. 실제 저장 시에는 apply_rules → apply_mapping_type_cast 후 적재되므로, 미리보기도 저장될 모습으로 보여줘야 함.

**적용 내용:**
- **Backend/etl_server2/preview_service.py**
  - `_get_preview_with_transform(etl_table_id)`: get_source_dataframe → list_transform_rules → apply_rules → apply_mapping_type_cast 순으로 적용 후 columns/preview_columns/preview_rows 구성. apply_rules·apply_mapping_type_cast 실패 시 경고 로그 후 기존 데이터로 진행.
  - `get_preview(etl_table_id)`: 기존 _preview_file/_preview_db 분기 제거, `_get_preview_with_transform` 호출만 하도록 변경. 파일/DB 공통으로 변환·타입 캐스트가 적용된 "저장 후 테이블 미리보기"가 표시됨.

**변경 파일:** Backend/etl_server2/preview_service.py, docs/report/log.md.

---

## 2026-03-06 DB 연결 실패 시 로그 과다 출력 완화 및 복구 연결 분리

**배경:** PostgreSQL(49.247.47.206) 또는 MySQL 소스 연결이 끊기면 queue_worker·report _save_table_worker·batch_executor_db에서 동일 예외가 반복 발생하고, 매번 전체 트레이스백이 출력되어 터미널 로그가 비대해짐. 또한 batch 복구(finish_run, update_job_status) 시 이미 끊긴 sys_conn을 재사용해 InterfaceError가 연쇄 발생.

**적용 내용:**
- **etl_server2/queue_worker.py, etl_server/queue_worker.py**: `psycopg2.OperationalError` 중 "connection"/"network" 포함 시 한 줄 경고만 출력하고 60초 동안 동일 유형 재로그 억제. 그 외 예외는 기존대로 `logger.exception` 유지.
- **batch_executor_db.py**: 예외 처리 시 `finish_run`, `update_job_status` 호출에 `conn=None` 사용. 서비스 내부에서 새 시스템 DB 연결을 생성하므로 끊긴 연결로 인한 복구 실패 방지.
- **report.py _save_table_worker**: 연결 관련 `psycopg2.OperationalError` 시 전체 traceback 대신 한 줄 경고 + 60초 억제, 재시도 전 대기 10초로 설정. 그 외 예외는 기존대로 traceback + 0.5초 대기.

**변경 파일:** Backend/etl_server2/queue_worker.py, Backend/etl_server/queue_worker.py, Backend/etl_server2/batch_executor_db.py, Backend/api_server/routers/report.py, docs/report/log.md.

---

## 2026-03-05 ETL2 변환→Upsert 파이프라인 본질적 검증

**배경:** 컬럼 변환(transform_rules_service + transform_engine) 후 upsert 시 타입 오류(bigint=text 등)를 단편적으로 수정한 것에 그치지 않고, 변환 룰·엔진 출력이 load_dataframe/_batch_upsert와 끝까지 호환되는지 검증 체계가 필요함.

**적용 내용:**
- **Backend/etl_server2/transform_upsert_verification.py** 신규:
  - transform_engine 출력 + apply_mapping_type_cast 결과가 load_dataframe/_batch_upsert와 호환되는지 검증(컬럼 집합, pandas dtype→PG 캐스트 매핑).
  - `PANDAS_DTYPE_TO_PG_CAST`: Int64, int64, float64, datetime64, bool, object 등 → bigint, double precision, timestamp, boolean, text 등.
  - `get_expected_pg_cast_for_series(series)`: Series dtype → PG 캐스트명.
  - `verify_transform_output_columns(df, target_columns)`: 중복 컬럼·누락 컬럼·미지원 dtype 검사, 에러 문자열 목록 반환.
  - `run_dry_run_pipeline(sample_df, rules, column_mapping)`: apply_rules → apply_mapping_type_cast 드라이런, errors + dtype_map 반환(DB 없이 실행 가능).
  - `python Backend/etl_server2/transform_upsert_verification.py`로 최소 드라이런 실행 시 OK 및 dtype_map 출력.
- **load_service_file.py**:
  - `_batch_upsert` docstring에 Type flow 문단 추가: DataFrame(pandas) → itertuples(Python) → psycopg2 → VALUES(text 추론) → information_schema 기반 명시 캐스트로 bigint=text 등 방지. SQL 단계에서는 타겟 테이블 컬럼 타입이 기준.
  - 상단 [Transform→Upsert 검증] 섹션: transform_upsert_verification 모듈 참조 및 run_dry_run_pipeline/verify_transform_output_columns 안내.

**변경 파일:** Backend/etl_server2/transform_upsert_verification.py(신규), Backend/etl_server2/load_service_file.py, docs/report/log.md.

---

## 2026-03-05 ETL 삭제 시 batch_jobs 연쇄 삭제 및 last_synced_at 초기화

**배경:** (1) ETL 목록에서 "삭제" 후에도 etl_tables 행이 남거나, 배치 등록만 해둔 ETL을 지울 때 batch_jobs가 남는 문제. (2) 증분 모드에서 한 번 실행하면 last_synced_at이 설정되어, "방금 만든 ETL"처럼 보여도 다음 실행부터는 증분만 조회됨.

**수정 내용:**
- **delete_etl_table / delete_etl_table_row_only**: 해당 etl_table_id를 참조하는 `batch_jobs` 및 자식 `batch_loaded_keys`, `batch_run_history`를 선삭제한 뒤 etl_tables 삭제. batch_jobs 등 테이블이 없으면(구버전 DB) 예외 시 rollback 후 etl_* 삭제만 진행.
- **update_etl_table**: `clear_last_synced_at=True` 시 `last_synced_at`을 NULL로 초기화. 다음 실행 시 증분 조건 없이 전체 조회.
- **PATCH /api/etl2/tables/:id**: body에 `clear_last_synced_at: true` 추가. 설정 모달 등에서 "증분 기준 초기화" 시 사용 가능.

**동작 정리:** last_synced_at은 생성 시 NULL이며, **적재 1회 완료 후** db_load_service에서 갱신됨. 따라서 "방금 만든 ETL"이라도 한 번 실행하면 last_synced_at이 채워지는 것이 정상. 다시 전체 적재하려면 동기화 모드를 "전체"로 바꾸거나, PATCH로 clear_last_synced_at=true 후 실행.

**변경 파일:** Backend/etl_server2/service.py, Backend/etl_server2/router.py, docs/report/log.md.

---

## 2026-03-05 DB 연결 ETL 목록 업로드 시 인덱스 미적용 원인 및 수정

**현상:** DB 연결에서 컬럼변환·인덱스 설정 후 ETL 목록 업로드 및 적재를 실행해도 생성된 테이블에 설정한 인덱스가 없음.

**원인 (프론트엔드 TargetTableSelectModal buildIndexDefinitions):**
1. **필터 오류:** 소스 DB 인덱스의 `columns`는 **소스** 컬럼명인데, 포함 여부를 **타겟** 컬럼명 집합(`targetColumnNamesForPk`)으로 검사함. 컬럼 매핑으로 이름이 바뀌면 모두 제외되어 `index_definitions`가 빈 배열로 전달됨.
2. **컬럼명 미변환:** 통과하더라도 반환 객체의 `columns`에 **소스** 컬럼명을 그대로 넣고 있음. 백엔드는 타겟 테이블(column_mapping 기준 **타겟** 컬럼명)에 대해 `CREATE INDEX ... ON table (소스컬럼명)`을 시도해 컬럼 부재로 실패하고, `logger.warning` 후 스킵되어 인덱스가 생성되지 않음.

**수정 내용:**
- `TargetTableSelectModal/index.jsx`의 `buildIndexDefinitions()`:
  - 소스 인덱스 사용 시 **소스→타겟 컬럼명 매핑** 구성 (신규 테이블: `newTableTargetNames`/`newTableExcluded`, 기존 테이블: `sourceToTarget`).
  - 각 소스 인덱스의 컬럼을 위 매핑으로 **타겟 컬럼명**으로 변환. 매핑되지 않은 컬럼이 있으면 해당 인덱스는 제외.
  - 반환 시 `columns`에 **타겟 컬럼명**만 넣어 백엔드 `_create_indexes_on_target`가 실제 테이블 컬럼명으로 CREATE INDEX 하도록 함.

**변경 파일:** Frontend/.../TargetTableSelectModal/index.jsx, docs/report/log.md.

---

## 2026-03-05 DB 배치잡에 변환 룰(Transform Rules) 적용

**배경:** DB 연결 ETL을 배치잡으로 등록해 주기 실행할 때, `run_db_batch_job`에서는 `apply_mapping_type_cast`만 적용되고 `etl_transform_rules` 기반 변환(cleansing, string, masking, type_cast 등)이 적용되지 않던 문제.

**적용 내용:**
- `Backend/etl_server2/batch_executor_db.py`의 `run_db_batch_job` 내부:
  - `transform_rules_service` import 추가, Dependencies에 명시.
  - `while True:` 루프에서 DataFrame 생성·헤더 유사 행 제거 후, `etl_table_id`가 있을 때만 `list_transform_rules(etl_table_id)`로 룰 조회 → `apply_rules(df, rules)` 적용. 룰 적용 실패 시 `logger.warning` 후 적재는 계속 진행.
- 실행 경로별 정합성: `run_file_load` / `run_db_load`와 동일하게 배치잡에서도 변환 룰 → column_mapping 형변환 순서로 적용.

**변경 파일:** Backend/etl_server2/batch_executor_db.py, docs/report/log.md.

---

## 2026-03-05 Cursor 대용량 diff 방지 개선 (룰·파일 분할·안내)

**배경:** 1600줄+ 단일 파일에서 StrReplace 매칭 실패 시 Write 도구로 전체 덮어쓰기가 발생해 +1611/-1610 수준의 diff가 생기는 문제. 원인: 파일 크기, Cursor 버전/apply 모델 변화, Format on Save·포맷터 확장.

**적용한 개선:**
1. **Write 도구 제한 룰** — `.cursor/rules/write-tool-restriction.mdc` 추가. 기존 파일 수정 시 Write 사용 금지, StrReplace만 사용, 매칭 실패 시 read_file 후 재시도·3회 실패 시 사용자 보고.
2. **TargetTableSelectModal 분할** — 1611줄 단일 파일을 `components/TargetTableSelectModal/` 폴더로 분할(index.jsx, constants.js, CodeMapInlineEditor, TransformCell, TableSelector, ColumnMappingSection, PreviewSection). 메인 index는 여전히 ~827줄; 추가로 훅 분리 시 300~400줄 목표 달성 가능.
3. **사용자 안내 (직접 확인 권장):**  
   - **Format on Save:** Cursor Settings → "format on save" 검색 → 체크 해제. 저장 시 포맷터가 전체 리포맷하면 diff가 파일 전체로 나타날 수 있음.  
   - **확장 없이 테스트:** `cursor --disable-extensions` 로 실행해 포맷터 확장이 원인인지 확인.  
   - **모델 변경:** StrReplace vs Write 선택 패턴이 모델마다 다르므로, 동일 작업을 다른 모델로 시도해 비교 가능.

**변경 파일:** .cursor/rules/write-tool-restriction.mdc(신규), TargetTableSelectModal 분할(아래 항목 참조).

---

## 2026-03-05 오케스트레이션 룰 강화 (메인=기획·위임·정리, 1개 이상 파일=서브 위임)

**목적:** 메인 에이전트가 대용량 파일을 직접 수정할 때 발생하는 거대 diff(+900/-900)·컨텍스트 급증·간헐적 적용 오류를 줄이기 위해, 코드 수정은 서브에이전트에만 맡기고 메인은 기획·위임·결과 정리만 하도록 변경.

**변경 내용 (tech-lead-orchestration.mdc):**
- **메인 역할**: 코드 직접 수정 금지. 플랜 수립 → @에이전트명으로 위임 → 서브 결과 수신 후 요약·제공만 수행.
- **위임 조건**: 수정 대상이 **코드 파일 1개 이상**이면 반드시 서브에이전트 위임. (기존: 3개 이상·백엔드+프론트 등)
- **단독 처리 예외 축소**: 문서/주석만, 설정·룰 파일만, 사용자 명시 요청 시에만 메인 직접 수정. 단일 코드 파일·CSS만 수정도 원칙적으로 위임.
- **대용량 단일 파일**: 수백 줄 이상이면 위임 권장(StrReplace 실패 시 Write fallback·거대 diff 방지).

---

## 2026-03-05 ETL2 변환 설정 유지 (모달↔부모 스냅샷)

**문제:** 모달 닫히면 변환 state 소멸. 신규 등록 시 etlTableId 없어 API 복원 불가.

**해결:** 변환 설정을 부모(DbConnectionForm)가 보관하고, 모달 재오픈 시 currentTransformSettings로 복원. 적용 시 onSelect 5번째 인자로 transformSettings 스냅샷 전달.

- **constants.js:** buildEmptyTransformSettings(), TRANSFORM_OPTION_LABELS 추가.
- **모달 index.jsx:** currentTransformSettings prop. open 시 변환 state 초기화 후, etlTableId 없을 때만 currentTransformSettings 복원 useEffect. handleApply에서 currentSettings 조립 후 onSelect(tableName, mapping, pk, idx, currentSettings) 3분기 모두 적용.
- **DbConnectionForm:** transformSettings state, currentTransformSettings/onSelect(tSettings) 전달. 설정 요약에 변환 룰 컬럼 수·종류별 카운트 표시. selectedSourceTable 변경 시 transformSettings/매핑/PK/인덱스/타겟 초기화. 등록 성공 후 setTransformSettings(buildEmpty...).
- **FileUploadForm:** onSelect 4인자 유지(5번째 인자 무시). 변경 없음.

---

## 2026-03-05 ETL2 변환 UI UX 개선 (타입 변환 선택·라벨·서브 행)

**작업:** 변환 기능이 “기능은 있는데 사용 불가”에 가깝던 문제 해결.

- **A-1. 타입 변환 대상 선택:** constants에 TYPE_CAST_TARGET_OPTIONS 추가. typeCastConfig state 추가, getAssembledRules·룰 복원·preview 초기화에 반영. TransformDetailRow에서 type_cast/cleansing_and_type_cast 시 “변환 대상 타입” 서브 드롭다운 표시.
- **A-2. 변환·문자열·마스킹·실패 시 라벨:** TRANSFORM_OPTIONS(변환 없음, 공백·빈값 정리, 값 치환 (M→남성), 문자열 가공, 마스킹 (비가역)), STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, ON_ERROR_OPTIONS 예시/설명 보강.
- **B. 매핑 테이블 가독성:** TransformCell은 변환 종류 select만 표시. 상세 설정은 해당 행 아래 서브 행(TransformDetailRow)으로 분리. 새 테이블 colSpan=8, 기존 테이블 colSpan=7.
- **파일:** constants.js, index.jsx, TransformCell.jsx, TransformDetailRow.jsx(신규), ColumnMappingSection.jsx, etl.css. 빌드·린트 통과.

---

## 2026-03-05 TargetTableSelectModal 패키지 연결 검증 (cross-check)

**작업:** 패키지 분할 후 import·API·CSS·export 연결 정합성 검증.

- **import 경로:** DbConnectionForm.jsx, FileUploadForm.jsx에서 `lazy(() => import('./TargetTableSelectModal'))` → 폴더 `TargetTableSelectModal/index.jsx` default export 정상 해석. ✅
- **내부 export:** index.jsx → TableSelector, ColumnMappingSection, CustomIndexSection, PreviewSection import. ColumnMappingSection.jsx에서 `export function ColumnMappingSection`, `export function CustomIndexSection` 존재. ✅
- **constants·TransformCell·CodeMapInlineEditor:** index/ColumnMappingSection/TransformCell에서 ./constants.js, ./TransformCell.jsx, ./CodeMapInlineEditor.jsx 상대 경로 정상. ✅
- **client.js ↔ router:** etl2ListTargetTables(GET /api/etl2/target-tables), etl2ListTargetColumns(GET /api/etl2/target-columns), etl2TransformPreview(POST /api/etl2/transform/preview), etl2ListTransformRules(GET /api/etl2/tables/{id}/transform-rules), etl2CreateTransformRule(POST), etl2DeleteTransformRule(DELETE) — 라우터 prefix /api/etl2 및 경로 일치. ✅
- **CSS:** etl.css에 etl-target-select-modal__* 클래스 정의 존재. 분할된 컴포넌트에서 동일 클래스명 사용. ✅
- **빌드:** `npm run build` 성공(exit 0). ✅

**요약:** 통과 6건, 실패 0건.

---

## 2026-03-05 TargetTableSelectModal 논리 단위 분할 (파일당 300~400줄 이하)

**작업:** TargetTableSelectModal.jsx(1611줄)를 components/TargetTableSelectModal/ 폴더로 분할. 기존 동작·export·import 경로 유지.

- **구조:** index.jsx(메인 모달·state/effect/handler·footer·변환 도움말), constants.js(상수·순수 함수), CodeMapInlineEditor.jsx, TransformCell.jsx, TableSelector.jsx, ColumnMappingSection.jsx(+ CustomIndexSection), PreviewSection.jsx.
- **규칙:** CSS 클래스명(etl-target-select-modal__*) 유지. 검증된 로직(loadTables, getAssembledRules, buildIndexDefinitions, saveRulesIfNeeded, handleApply, handlePreviewClick, useEffect/useCallback) 수정 없이 index.jsx에 유지. JSX만 서브 컴포넌트로 분리.
- **import:** DbConnectionForm, FileUploadForm에서 `import('./TargetTableSelectModal')`로 폴더 index 사용. 기존 단일 파일 TargetTableSelectModal.jsx 삭제.
- **파일:** TargetTableSelectModal/constants.js, CodeMapInlineEditor.jsx, TransformCell.jsx, TableSelector.jsx, ColumnMappingSection.jsx, PreviewSection.jsx, index.jsx. 각 파일 상단 file-header 규칙 한글 설명·Main Functions·Dependencies 갱신.

**변경 파일:** Frontend/.../TargetTableSelectModal/* (신규 7개), DbConnectionForm.jsx, FileUploadForm.jsx. 삭제: TargetTableSelectModal.jsx. docs/report/log.md.

---

## 2026-03-05 ETL2 프로덕션 배포 전 정리 (남은 버그·중간/낮음·구조 개선 일괄)

**작업:** 즉시/높음 이외 남은 버그, 미리보기 stale·룰 에러 메시지, TransformCell·saveRulesIfNeeded 구조 개선, get_preview 주석까지 한 번에 반영.

- **A. typeFamily / inferredTypeToPg datetime 오탐 (프론트):** `t.includes('date')`/`t.includes('time')` 제거. `DATETIME_TYPES` 배열과 `t === x` 정확 매칭만 사용해 `updated_at_text` 등이 datetime으로 오탐되지 않도록 수정. inferredTypeToPg도 동일하게 datetime 계열은 정확 매칭만.
- **A. CodeMapInlineEditor useEffect deps:** `configMapKey = JSON.stringify(config.map || {})` 추가 후 deps에 `[sourceName, configMapKey]` 사용. 부모에서 기존 룰(etl2ListTransformRules) 복원 후 config.map이 바뀌면 items가 갱신되도록 함.
- **A. NEW_TABLE tableName 빈값 시 피드백:** `rawTableName`으로 사용자 입력만 검사, 빈 문자열이면 `window.alert('테이블명을 입력해 주세요.')` 후 return. fallback `'new_table'` 제거해 빈 상태로 적용되는 경로 차단.
- **B. 미리보기 stale 초기화:** `transformKind`/`stringConfig`/`maskingConfig`/`codeMapConfig` 변경 시 `setPreviewData(null)`, `setPreviewError(null)` 호출하는 useEffect 추가.
- **B. 룰 삭제/등록 에러 메시지 구체화:** `saveRulesIfNeeded(etlTableId, allSourceColumnNames, assembled)` 공통 함수 추출. 삭제 단계 실패 시 `throw new Error('기존 룰 삭제 중 실패: ' + ...)`, 등록 단계 실패 시 `throw new Error('새 룰 등록 중 실패 (일부 삭제된 상태일 수 있음): ' + ...)`로 구분해 사용자 재시도 판단 가능하도록 함.
- **C. TransformCell 컴포넌트 분리:** 새 테이블/기존 테이블 매핑 테이블의 변환 열(select + 값매핑/문자열/마스킹 UI)을 공통 `TransformCell({ excluded, src, sourceColumns, transformKind, setTransformKind, ... })`로 추출. 한쪽 수정 시 양쪽 동일 반영.
- **C. handleApply 내 saveRulesIfNeeded 사용:** NEW_TABLE 분기·기존 테이블(소스매핑) 분기에서 룰 삭제/등록 블록을 `await saveRulesIfNeeded(...)` 호출로 치환.
- **D. get_preview 주석:** docstring에 "양쪽 조건(DB·파일) 만족 시 DB 우선" 한 줄 추가.

**변경 파일:** Frontend/.../TargetTableSelectModal.jsx, Backend/etl_server2/preview_service.py, docs/report/log.md.

---

## 2026-03-05 ETL2 버그/안정성·UX 개선 (리뷰 반영)

**작업:** 코드 리뷰 우선순위(즉시·높음) 항목 반영.

- **즉시 — DB 커넥션 try/finally (preview_service.py):** `_preview_db`, `_get_source_df_db`에서 conn을 열고 쿼리 실행 후 예외가 나도 항상 닫도록 `try`/`finally` 패턴 적용. `conn = None` 초기화 후 `finally`에서 `if conn is not None: conn.close()` 호출.
- **즉시 — handleApply onClose 순서 (TargetTableSelectModal.jsx):** try 블록 안에서 `onClose()` 호출 제거. `applied` 플래그를 두고 적용 성공 시에만 `applied = true`, `finally`에서 `setApplyLoading(false)` 후 `if (applied) onClose()` 호출해 언마운트 후 setState 방지.
- **높음 — SQL 식별자 이스케이프 (preview_service.py):** `_quote_ident_pg`(PostgreSQL/Oracle: `"` → `""`), `_quote_ident_mysql`(MySQL: `` ` `` → ` `` ` ``) 헬퍼 추가. `_preview_db`/`_get_source_df_db`에서 스키마·테이블·컬럼명에 위 헬퍼 사용해 단순 문자열 감싸기 대신 이스케이프 적용.
- **높음 — CodeMapInlineEditor 중복 키 (TargetTableSelectModal.jsx):** 값 매핑을 `Object.entries`/`Object.fromEntries` 대신 내부 state `items = [{ key, value }, ...]` 배열로 관리. `setKey(idx, key)` 시 해당 인덱스만 갱신하고 `flushMap`으로 객체 변환해 전달해, 동일 키 입력 시 행이 사라지는 문제 제거. `sourceName` 변경 시 `useEffect`로 items 초기화.
- **기타:** `_normalize_mapping`에서 JSON 파싱 실패 시 `logger.warning` 로그 추가. `get_source_dataframe`/`get_preview`에서 DB 소스(connection_id·source_table) 있으면 파일보다 DB 우선 분기해, 양쪽 조건 동시 만족 시 의도치 않게 파일로 처리되던 문제 수정.

**변경 파일:** Backend/etl_server2/preview_service.py, Frontend/.../TargetTableSelectModal.jsx, docs/report/log.md.

---

## 2026-03-05 ETL2 모달 max-height·상하 스크롤 통일

**작업:** 배치잡 실행 이력 모달 및 전체 모달에 적정 max 높이 고정 + 내용 초과 시 상하 스크롤 적용.

- **실행 이력 모달 (ETLPage.jsx):** `etl-add-file-modal__box`에 `etl-add-file-modal__box--scroll-body` 추가, 헤더 아래 콘텐츠를 `etl-add-file-modal__body`로 감싸 헤더 고정·본문만 스크롤.
- **etl.css:** `.etl-add-file-modal__box`에 `max-height: 90vh`, `overflow-y: auto` 적용(기본: 전체 박스 스크롤). `--scroll-body` 수정자 시 flex 컬럼 + `__body`에 `flex: 1; min-height: 0; overflow-y: auto`로 본문만 스크롤.
- **BatchJobListFile:** DB 소스 미리보기 모달에 `--scroll-body` 적용, 인라인 `maxHeight`/`overflow` 제거하여 공통 스타일 사용.
- **PreviewModal:** `.etl-preview-modal__body`에 `flex: 1; min-height: 0` 추가, `.etl-preview-modal__head`에 `flex-shrink: 0` 추가.
- **PkColumnsModal:** `.etl-pk-modal__box`에 `max-height: 90vh; overflow-y: auto` 추가.
- **EtlTableSettingsModal:** 기존 `max-height: 90vh; overflow-y: auto` 유지.
- **TargetTableSelectModal:** `.etl-target-select-modal__body`에 `flex: 1; min-height: 0` 추가(박스는 기존 max-height·flex 유지).
- AddFileModal, PatternSelectModalFile 등 `etl-add-file-modal__box` 사용 모달은 공통으로 90vh 제한·전체 스크롤 적용.

---

## 2026-03-05 ETL 변환 UI 개선 구현 (11번 화면 설계 기준)

**작업:** 11_ETL_Transform_Upgrade_Guide.md §2 화면 설계 Step UI-1~UI-8 반영.

- **UI-1:** Backend — preview_service에 get_source_dataframe, _get_source_df_db, get_transform_preview 추가. router에 TransformPreviewBody, POST /transform/preview 엔드포인트 추가.
- **UI-2:** client.js — etl2TransformPreview(body) 함수 추가.
- **UI-3:** TargetTableSelectModal — 미리보기 버튼(etlTableId·hasSourceMapping 시), handlePreviewClick, previewData 패널(테이블·변환 실패 N건), previewLoading/previewError.
- **UI-4:** 문자열 변환 — substring(시작·길이), replace(찾을·바꿀), regex_replace(정규식·치환), concat(합칠 컬럼 멀티셀렉트·구분자) 입력 필드 추가(새 테이블/기존 테이블 매핑 테이블 모두).
- **UI-5:** 변환 옵션 안내 — 값 매핑·문자열 변환·마스킹 설명 및 Before→After 예시 추가. 정리+타입 변환 순서 문구 정리.
- **UI-6:** handleApply 진입 시 assembled 중 rule_type === 'masking' 있으면 window.confirm 비가역 경고 후 진행/취소.
- **UI-7:** 매핑 헤더에 "변환 설정된 컬럼만 보기" 토글. displaySourcesForNewTable/displaySourcesForExisting 사용. 변환 설정 행에 etl-target-select-modal__row--has-transform 클래스(배경 강조).
- **UI-8:** 값 매핑 4개 이상 시 "편집" 클릭 시 팝오버(코드맵 인라인 에디터 + 닫기). 4개 미만은 기존 인라인 토글 유지.
- **CSS:** etl.css에 미리보기 패널·필터 토글·row--has-transform·code-map-popover 스타일 추가.

---

## 2026-03-05 ETL Transform 가이드 — 화면 설계 섹션 추가 (11번 문서)

**작업:** 11_ETL_Transform_Upgrade_Guide.md에 **§2 화면 설계 (변환 UI 개선)** 섹션 추가.

- **목표**: 저장 전 변환 확인·최소 입력·선택 위주 UX·마스킹 비가역 경고 등 8개 제안 반영.
- **Step UI-1**: 백엔드 POST /api/etl2/transform/preview API 스펙(etl_table_id, rules, column_mapping → preview_columns, preview_rows, transform_failed_count).
- **Step UI-2**: client.js etl2TransformPreview(body) 함수.
- **Step UI-3**: 모달 미리보기 버튼·결과 패널·실패 N건 표시(의존: UI-1, UI-2).
- **Step UI-4**: 문자열 substring/replace/regex_replace/concat 입력 필드·안내.
- **Step UI-5**: 변환 옵션 안내에 문자열·마스킹 설명 + Before→After 예시.
- **Step UI-6**: 마스킹 저장 시 비가역 확인 다이얼로그.
- **Step UI-7**: 변환 설정 행 하이라이트 + "변환 설정된 컬럼만 보기" 토글.
- **Step UI-8**: 값 매핑 4개 이상 시 팝오버/서브모달.
- **Step UI-9**: 정리+타입 변환 순서 문서·검증.
- **Step UI-10**: boolean/date 조건부 설정 필드(선택, 다음 스프린트).
- 병렬 실행 표(그룹 A: UI-1·UI-2 동시, B: UI-3, C: UI-4~8, D: UI-10), 체크리스트, 대상 파일 경로(preview_service, client.js) 보강. 00_ReportIndex.md 11번 설명 갱신.

---

## 2026-03-05 ETL Transform 추가 코드 리뷰 반영 (3차)

**작업:** 3차 리뷰 P1~P3 및 동작 명시 반영.

- **P1:** update_transform_rule — 마이그레이션 전 DB(rule_category/operation 컬럼 없음)에서 UPDATE 실패 시 rollback 후 fallback. rule_category→rule_type 치환, operation 항목 제거 후 재시도. rule_type 인자 있으면 해당 값 사용.
- **P2:** _apply_type_cast_with_mask — boolean 경로를 _apply_type_cast와 동일하게 벡터화(stripped.isin(true_vals/false_vals), failed 후 on_error 처리).
- **P3:** _apply_type_cast — date를 try_convert 밖으로 벡터 경로 추가. still_none = converted.isna() & ~empty, 포맷별 pd.to_datetime(sub, format=fmt), still_failed 시 _fallback. try_convert는 text만 유지.
- **P3:** router.py — upload_file 내부 `import json as _json` 제거, 파일 상단 `import json` 추가, json.loads 사용처를 json으로 통일.
- **동작 명시:** _apply_type_cast docstring에 "empty(NA/빈문자열/nan 문자열)는 항상 None 처리" 문구 추가.

---

## 2026-03-05 ETL Transform 추가 코드 리뷰 반영 (2차)

**작업:** 추가 리뷰 P0~P3 항목 반영.

- **P0:** _apply_type_cast — integer/bigint 벡터화 후 on_error="keep"이면 원본(문자 등)이 섞여 Int64 캐스팅 시 TypeError. `on_error != "keep"`일 때만 `astype("Int64")` 시도, 실패 시 try/except로 유지.
- **P1:** _apply_type_cast_with_mask date — 멀티포맷 루프에서 성공한 행만 순회. `success_mask = _dt.notna()`, `for idx in _dt.index[success_mask]` 로 변경.
- **P1:** create_transform_rule fallback — "column" 문자열 매칭이 과도함(null value in column ... 등). `is_schema_mismatch`: "rule_category", "undefined column", "does not exist" 로 한정.
- **P1:** apply_rules — 예외 완전 삼킴 제거. 컬럼/row 변환 실패 시 `logger.warning`(rule_id, category, operation, tgt, exc) 기록.
- **P2:** _apply_type_cast boolean — true_vals/false_vals를 try_convert 밖에서 한 번만 생성하고, boolean 전용 벡터 경로 추가(stripped.isin, not_matched만 _fallback).
- **P2:** _apply_range_map — conditional과 동일하게 첫 매칭 우선. `matched` 플래그, `to_apply = mask & ~matched` 적용.
- **P3:** _apply_datetime_transform — date_format은 dt 미사용. `dt = pd.to_datetime(series, ...)` 를 date_format 분기 아래로 이동(필요 시에만 계산).

---

## 2026-03-05 ETL Transform 코드 리뷰 반영 (11번 문서·리뷰 피드백)

**작업:** 코드 리뷰 P0/P1/P2 항목 검증 후 반영.

- **P0:** transform_rules_service — create_transform_rule에서 첫 INSERT 실패 시 `conn.rollback()` 후 rule_type fallback INSERT. (PostgreSQL 트랜잭션 abort 상태에서 두 번째 execute 방지.)
- **P0:** _apply_conditional — 첫 번째 매칭 우선(CASE WHEN 스타일). `matched` 플래그로 이미 매칭된 행은 이후 condition으로 덮어쓰지 않음.
- **P0:** _apply_type_cast_with_mask — date 멀티포맷: 실패한 행만 다음 포맷으로 시도하도록 변경. `still_none` 구간만 `pd.to_datetime(sub, format=fmt)` 호출.
- **P1:** _apply_type_cast — integer/bigint/numeric/timestamp 벡터 연산 우선 적용. `pd.to_numeric`/`pd.to_datetime` 후 실패 행만 _fallback 처리.
- **P1:** router _save_upload — 파일명 sanitize(`re.sub(r"[^\w.\-]", "_", ...)`), `path.resolve().is_relative_to(UPLOAD_DIR.resolve())` 검증.
- **P1:** transform_engine — `_NEEDS_DF` 모듈 레벨 캐시로 매 룰마다 `inspect.signature` 호출 제거.
- **P2:** _apply_cleansing — operation 기본값 `"trim"` 명시 (`config.get("operation") or "trim"`).
- **P2:** mask_phone — 하이픈 형식 `^(\d{2,4})-(\d{3,4})-(\d{4})$` 먼저, 없으면 숫자만 추출 후 01x 3자리/그 외 2자리 prefix + 중간 마스킹 + 뒤 4자리.
- **P2:** masking hash — `getattr(hashlib, algo, None)`으로 직접 참조 시 사용, 없으면 `hashlib.new(algo, ...)` 유지.
- **기타:** apply_rules에서 row transform 후 `out` 교체·인덱스 리셋됨 주석 추가. 기존 테스트 14개 통과.

**미반영:** P3 스키마 버전 캐싱(모듈 로드 시 rule_category 컬럼 존재 여부 체크) — 현재 rollback fallback으로 동작하므로 추후 개선 시 검토. router 내부 `import json` — 해당 위치 미확인, 필요 시 별도 수정.

---

## 2026-03-05 ETL Transform Phase 3 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** Phase 3 Step 16~20 반영.

- **Step 16:** transform_engine — `_apply_numeric_transform` 추가. operation: round(decimals), arithmetic(operator, value/column), bucket(bins, labels), clamp(min, max). _COLUMN_TRANSFORMERS에 "numeric" 등록.
- **Step 17:** _apply_masking에 operation hash(algorithm: sha256), redact(char) 추가.
- **Step 18:** _apply_row_transform 추가. operation: filter(column, operator, value), deduplicate(subset, keep). apply_rules에서 rule_category "row"일 때 _ROW_TRANSFORMERS로 전체 DataFrame 변환 후 continue.
- **Step 19:** _apply_cleansing에 operation fill_forward, fill_backward, normalize_unicode(form) 추가.
- **Step 20:** transform_engine 상단 docstring 갱신. tests/test_transform_engine.py에 Phase 3 테스트 추가(test_apply_rules_numeric_round, test_apply_rules_row_deduplicate, test_apply_rules_masking_hash). 14개 테스트 통과.

---

## 2026-03-05 ETL Transform Phase 2 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** Phase 2 Step 9~15 반영.

- **Step 9:** DB 마이그레이션 명령 적용(사용자 실행). rule_type→rule_category 리네임, operation 컬럼 추가, code_map→mapping/derived→string·datetime 데이터 변환, chk_rule_category 제약. (SQL 파일은 저장하지 않고 명령만 제공하는 방식으로 정리)
- **Step 10:** transform_rules_service — _VALID_CATEGORIES, _normalize_category(code_map→mapping, derived→string). list/get는 SELECT *로 rule_category·rule_type·operation 모두 대응. create는 rule_category+operation INSERT 시도 후 실패 시 rule_type만 INSERT(마이그레이션 전 호환). update에 rule_category, operation 파라미터 추가.
- **Step 11:** transform_engine — _parse_config, _COLUMN_TRANSFORMERS 디스패치 테이블, _LEGACY_CATEGORY_MAP. apply_rules에서 rule_category 우선·rule_type 폴백, operation config 병합, inspect.signature로 df 인자 여부 판단.
- **Step 12:** _apply_datetime_transform 추가. date_format, extract, date_diff, age, date_add.
- **Step 13:** _apply_range_map, _apply_conditional, _apply_mapping 추가. mapping 카테고리에서 value_map/range_map/conditional 분기.
- **Step 14:** router — CreateTransformRuleBody/UpdateTransformRuleBody에 rule_category, operation 필드 추가. create/update 시 서비스에 전달.
- **Step 15:** tests/test_transform_engine.py에 Phase 2 테스트 추가(test_apply_rules_rule_category_fallback, test_apply_rules_mapping_range_map, test_apply_rules_datetime_age). 기존 Phase 1 테스트 포함 전체 통과.

---

## 2026-03-05 ETL Transform Phase 1 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** 11_ETL_Transform_Upgrade_Guide.md Phase 1 Step 1~8 전부 구현.

- **Step 1~4 (transform_engine.py):** `_apply_string_transform` 추가(uppercase, lowercase, pad_left, pad_right, substring, replace, regex_replace, concat), `_apply_masking`에 mask_phone·mask_name·레거시 type→operation 매핑, `_apply_type_cast`/`_apply_type_cast_with_mask`에 boolean·date_formats 리스트 지원, `apply_mapping_type_cast`에 boolean 타겟 반영, `apply_rules`에 rule_type `string` 분기.
- **Step 5 (transform_rules_service.py):** `_VALID_RULE_TYPES`에 `string` 추가, create/update 검증 통일.
- **Step 6 (router.py):** CreateTransformRuleBody의 rule_type·rule_config Field description 및 examples 보강.
- **Step 7 (TargetTableSelectModal.jsx):** 변환 옵션에 "문자열 변환"(string)·"마스킹"(masking) 추가, operation 드롭다운 및 pad_left/pad_right·mask_right/mask_left 시 n·char 입력 필드, getAssembledRules에서 string/masking rule_config 조립, code_map 시 mappings/default 전송으로 정리.
- **Step 8 (tests/test_transform_engine.py):** transform_engine 단위·통합 테스트 추가(직접 모듈 로드), 9개 테스트 통과.

---

## 2026-03-05 ETL Transform 업그레이드 가이드 — 커서 AI 실행용 스펙 보강 (11번)

**작업:** **11_ETL_Transform_Upgrade_Guide.md** 를 “커서 AI가 코드를 뽑기 위한 스펙” 수준으로 재구성. (1) **Step 1~20** 단위로 분리(파일 1~2개·함수 1~3개 단위). (2) **함수 시그니처·config 스펙·테스트 케이스**를 Step별로 명시. (3) **하위 호환** 경계 명확화(Phase 1 DB 미변경, rule_type 확장만). (4) **서브에이전트 병렬 실행 표** 추가 — Phase 1에서 Step 2~4(엔진), Step 5(서비스), Step 6(라우터), Step 7(프론트)를 서로 다른 에이전트로 병렬 가능하도록 의존성·대상 파일 표기. (5) Phase 2 마이그레이션·디스패치·datetime·mapping Step(9~15), Phase 3 요약(16~20), 네이밍 매핑 표, 커서 프롬프트 작성 팁 수록. 00_ReportIndex.md 설명 갱신.

---

## 2026-03-05 ETL Transform 벤치마킹·업그레이드 가이드 문서화 (11번)

**작업:** docs/report에 **11_ETL_Transform_Upgrade_Guide.md** 신규 작성. 업계 표준 Transform 카테고리·오퍼레이션과 현재 코드(rule_type 5개) 매핑, rule_category + operation 2단 구조 제안, DB 스키마 변경안, apply_rules 엔진 개선 방향, Phase 1~3 우선순위·체크리스트, 네이밍 컨벤션을 정리함. 대상 파일은 Backend/etl_server2/transform_engine.py, transform_rules_service.py, router.py, Frontend etl2 TargetTableSelectModal 등으로 명시. 00_ReportIndex.md에 11번 문서 항목 추가.

---

## 2026-03-04 DB 배치: 150행 기대 시 1행만 삽입·헤더처럼 보이는 행

**증상:** DB 연결 배치잡 실행 시 150행을 넣었으나 1행만 삽입되고, 그 행이 `id / campaign_id / test_id` 등 컬럼명만 있는 것처럼 보임.

**원인 후보 (우선순위):**
1. **증분(incremental) 모드 + last_synced_at**  
   `WHERE incremental_column > last_synced_at` 조건으로 인해 **소스에서 1행만 조회**되는 경우.  
   - ETL 테이블 실행 완료 시점으로 `last_synced_at`이 세팅되어 있으면, 그 시점보다 큰 값을 가진 행이 1개뿐일 수 있음.  
   - 그 1행이 소스 테이블에 “헤더처럼” 저장된 행(예: id='id', campaign_id='campaign_id', test_id='test_id')이면, 삽입 결과가 컬럼명만 있는 것처럼 보임.
2. **소스 테이블에 헤더 행이 데이터로 존재**  
   CSV 등에서 헤더를 한 줄 넣은 경우, 증분 컬럼 기준으로 그 행 1개만 선택될 수 있음.
3. **Full 모드인데 소스가 1행만 반환**  
   연결/스키마/테이블이 잘못되어 해당 테이블이 1행만 가지는 DB를 바라보는 경우.

**권장 확인:**
- 배치잡/ETL 테이블의 **sync_mode**: `incremental`이면 `last_synced_at`이 너무 최근이 아닌지 확인.
- **전체 재적재**가 목적이면: 한 번 `sync_mode=full`로 실행하거나, `last_synced_at`을 NULL/과거로 초기화 후 증분 재실행.
- 소스 테이블에 **컬럼명과 동일한 값의 행**이 있는지 확인; 필요 시 해당 행 제거 또는 증분 조건에서 제외.

**조치:** `batch_executor_db.py`에 배치당 소스 조회 행 수 로그 추가.  
`run_db_batch_job job_id=%s batch_offset=%s: 소스에서 %s행 조회` — 로그로 실제로 몇 행이 조회되는지 확인 가능.

---

## 2026-03-04 DB 배치: 실행 이력 삽입 0건·소스 0행 조회 시 진단 로그

**증상:** 배치 주기/즉시실행 시 상세 이력에 삽입 0~1건만 기록. 실제 서버 타겟 테이블에는 600행 등 더 많은 데이터가 있는데 로컬/해당 환경에서는 추가 삽입이 없음.

**원인:** 증분(incremental) 모드에서 `WHERE incremental_column > last_synced_at` 조건으로 소스를 조회할 때, `last_synced_at`이 이미 최근이라 **소스에서 조회되는 행이 0건**인 경우. (해당 환경 소스가 150행뿐이고 이미 동기화된 상태이거나, 서버와 다른 DB를 바라보는 경우 등.)

**조치:** `batch_executor_db.py`에 다음 로그 추가.  
- 실행 시: `sync_mode`, `incremental_column`, `last_synced_at` 출력 → 증분 조건 확인 가능.  
- 소스에서 한 건도 안 나온 경우: `batch_offset == 0`일 때 경고 로그로 "소스에서 조회된 행 없음. 증분 모드일 경우 last_synced_at 확인 또는 full 동기화 권장" 출력.

**운영 측 대응:** 증분인데 새 행이 안 잡히면 1) 타겟/소스가 같은지 확인, 2) 한 번 `sync_mode=full`로 실행하거나 배치잡/ETL의 `last_synced_at`을 NULL 또는 과거로 초기화 후 재실행.

---

## 2026-03-04 소스 DB fetch 결과 row 타입 분기 (RealDictRow 버그)

**증상:** 소스 테이블 미리보기·배치 실행 시 모든 행이 컬럼명 문자열로 채워짐 (id 컬럼 값이 "id" 등).

**원인:** PostgreSQL 소스 연결이 `RealDictCursor`를 사용해 `fetchall()`/`fetchmany()`가 `RealDictRow`(dict-like)를 반환함. 이때 `dict(zip(col_names, r))`에서 `r`을 이터레이션하면 **키(컬럼명)**만 나와, 값이 컬럼명으로 채워짐.

**조치:** 소스 SELECT 결과를 dict 리스트로 바꾸는 모든 위치에서 row 타입 분기 적용.
- `rows and hasattr(rows[0], "keys")` → 이미 dict-like → `[dict(r) for r in rows]`
- 그 외(tuple) → `[dict(zip(col_names, r)) for r in rows]`

**수정 파일:**
- `preview_service.py` `_preview_db`: fetch 후 위 분기로 rows 변환.
- `batch_executor_db.py`: fetchmany 배치에 동일 분기 적용.
- `db_load_service.py`: `row_type == "dict"`일 때 `[dict(r) for r in batch/rows_data]` 명시 추가, tuple일 때만 zip 변환.

---

## 2026-03-05 파일 배치: 동일 실패 파일 반복 재시도 + 연속 실패 시 자동 비활성화

**증상:** run_id 61에서 파일 적재 실패 후 63, 65, 68, 71, 74까지 같은 파일로 5번 더 시도됨.

**원인:**  
1) 실패한 파일에 대해 `last_processed_ts`를 갱신하지 않아, 다음 주기에서 `get_pending_files`가 같은 파일을 다시 pending으로 반환함.  
2) 파일 1건 적재 실패 시 `finish_run(error)` 후 `return`하는 경로에서는 `check_consecutive_failures`가 호출되지 않아, 연속 5회 실패 시 자동 비활성화가 적용되지 않음.

**조치:**  
1) 파일 적재 실패 시에도 `update_last_processed_ts(batch_job_id, ts)` 호출. 실패한 파일도 "시도 완료"로 기록해 다음 주기에서 `get_pending_files`의 `ts > last_processed_ts` 조건으로 자동 제외되며, 동일 파일 반복 실패로 이력이 쌓이는 것을 방지. (commit 실패·load 예외·file_size_exceeded 스킵 모두 적용. on_file_error=continue/stop 동일.)  
2) 파일 실패로 run을 error로 끝낼 때 `check_consecutive_failures(batch_job_id, threshold=5)` 호출 유지.  
3) **제거:** `list_skipped_files` 기반 문제 파일 제외 로직 제거. 매 실행 시 이력 JSONB 스캔 부하·일시 장애 파일 영구 차단 부작용을 없애고, last_processed_ts + 체크섬 + check_consecutive_failures만으로 동작.

---

## 2026-03-04 DB 배치: 소스 헤더 행이 데이터로 적재되는 것 방지

**증상:** 소스 151건 중 150건만 실제 데이터이고, 151번째 행이 컬럼명(id, campaign_id, test_id)으로 채워진 “헤더 행”이 타겟에 적재됨. 타겟 600건 중 해당 1건이 비정상 행.

**원인:** 소스 테이블(또는 소스로 로드된 CSV 등)에 컬럼명과 동일한 값을 가진 한 행이 데이터로 포함된 경우.

**조치:** `batch_executor_db.py`에서 소스 조회 후 DataFrame 생성 직후, **첫 번째 컬럼 값이 해당 컬럼명과 동일한 행**을 헤더 유사 행으로 간주해 제외. 제외 시 로그: `헤더 유사 행 N건 제외 (컬럼 '컬럼명' 값=컬럼명)`. 해당 배치 전체가 헤더 행뿐이면 적재 스킵.

---

## 2026-03-04 DB 배치: 증분 조건 > → >=, NULL 제외, 디버그 로깅

**증상:** 소스 600건(updated_at 동일), 타겟 150건만 적재. 즉시 실행 시 450건이 들어와야 하는데 1건(헤더)만 삽입, 이후 0건.

**원인:** 1) `WHERE updated_at > last_synced_at`에서 last_synced_at이 150건 적재 시 max(updated_at)과 동일해, 나머지 450건(동일 시각)이 제외됨. 2) 증분 컬럼 NULL인 헤더 행이 조건을 통과할 수 있는 경우 처리 필요.

**조치 (batch_executor_db.py):**
- 증분 조건을 **`>` → `>=`** 로 변경: 동일 시각 데이터 포함, 중복은 PK upsert로 방지.
- **`AND incremental_column IS NOT NULL`** 추가: 증분 컬럼이 NULL인 행(헤더/쓰레기) 제외.
- 디버그 로깅: `last_synced_at` (batch_jobs 기준), 생성된 **SELECT 쿼리 전문 + params** 로그 출력.

---

## 2026-03-04 DB 배치 적재 시 duplicate key (sample_accdb_p_pkey) 수정

**원인:** `load_dataframe`에서 테이블이 없을 때 CREATE 후 항상 `_batch_insert`만 사용. 소스에 동일 PK가 있거나 배치 내 중복이 있으면 `UniqueViolation: duplicate key value violates unique constraint` 발생.

**조치:** `Backend/etl_server2/load_service_file.py` — 테이블 생성 직후에도 PK가 있고 `df_work`에 PK 컬럼이 모두 있으면 `_batch_upsert`로 적재하도록 변경. (동일 배치/소스 내 PK 중복은 ON CONFLICT DO UPDATE로 갱신 처리.)

**추가(근본 원인):** 배치잡/ETL 테이블에 `pk_columns`가 저장되지 않으면 `pk_columns_str`이 None으로 넘어가 `load_dataframe` 내부 `pk_list`가 빈 리스트가 되어 여전히 `_batch_insert`만 타는 문제.  
**조치:** `Backend/etl_server2/batch_executor_db.py` — `_fetch_source_pk(conn, stype, schema, table_name)` 헬퍼 추가(postgresql/mysql/oracle에서 PK 컬럼 목록 조회). `pk_columns_str`이 비어 있을 때 소스 연결 후·chunk 루프 전에 소스 DB에서 PK 자동 조회해 사용. 배치 등록 시 PK를 넣지 않아도 실행 시점에 자동 감지되어 upsert 정상 동작.

---

## 2026-03-04 ETL 테이블 status=done 기준 배치설정 흐름

**목적:** ETL 등록 → 수동 실행으로 검증 → 배치 설정 시 마지막 적재 시점 이후부터 증분. 사용자 흐름 정리 및 서버 검증 추가.

**플로우:** ETL 등록(status=draft) → 배치설정 버튼 비활성 → 실행 후 적재 완료(status=done) → 배치설정 활성화 → 배치 등록 시 `etl_tables.last_synced_at`을 `batch_jobs.last_synced_at` 초기값으로 세팅.

**변경 사항**
- **Backend/etl_server2/router_file.py**  
  - POST `/jobs/from-etl-table`: `etl_table.status`가 `done`이 아니면 400 응답. "ETL 테이블이 아직 실행되지 않았습니다. 먼저 실행하여 적재를 확인한 뒤 배치를 설정해 주세요."  
  - 배치 등록 직후 `etl_table.last_synced_at`이 있으면 `update_last_synced_at_db_batch(batch_job_id, initial_synced_at)` 호출로 증분 기준점 세팅.
- **Frontend/.../ETLTableList.jsx**  
  - DB 소스 행의 "배치설정" 버튼: `disabled={runDisabled || statusLower !== 'done'}`, 비활성 시 툴팁 "먼저 실행하여 적재를 확인한 뒤 배치를 설정할 수 있습니다.", 활성 시 "주기 자동 실행 설정".

---

## 2026-03-03 DB 배치 스케줄링 업그레이드 (10_DB_Batch_Scheduling_Upgrade) 구현

**목적:** docs/report/10_DB_Batch_Scheduling_Upgrade.md 계획에 따라 DB 연결 기반 배치 Job 주기 실행 기능 구현. (DB 스키마는 사용자가 별도 반영 완료 가정.)

**Phase 1 — batch_executor_db.py**
- 신규 파일: `Backend/etl_server2/batch_executor_db.py`. `run_db_batch_job(batch_job_id)`로 job_type='db' 배치 실행. 소스 연결(PostgreSQL/MySQL/Oracle), 증분·전체 SELECT, batch_size 단위 fetch → DataFrame → column_mapping → load_dataframe → batch_interval_seconds sleep 반복. last_synced_at 갱신, finish_run, update_job_status. MySQL batch_size 상한 10000, check_consecutive_failures는 finally 밖에서 호출.

**Phase 2 — scheduler_file.py**
- `add_job`: job_type='db'이면 `batch_executor_db.run_db_batch_job`, 아니면 `batch_executor_file.run_batch_job` 사용.
- `run_now`: 동일하게 job_type에 따라 실행 함수 분기.

**Phase 3 — service_file.py**
- `list_batch_jobs`: job_type 쿼리 파라미터 추가, 새 컬럼(job_type, connection_id, source_table 등) SELECT, etl_connections LEFT JOIN으로 source_connection_name.
- `get_batch_job`: source_connection_name(etl_connections JOIN) 추가.
- `create_batch_job`: job_type(file|db), connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error 추가. file은 folder_connection_id·file_pattern 필수·중복 검사 기존 로직; db는 connection_id·source_table 필수·(connection_id, source_table, target_table, storage) 중복 검사.
- `update_batch_job`: connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error allowed 및 검증 추가.
- `update_last_synced_at_db_batch`: 신규. batch_jobs.last_synced_at 갱신(conn 선택).

**Phase 4 — router_file.py**
- CreateBatchJobBody/UpdateBatchJobBody: job_type, connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error 추가. Create 시 folder_connection_id·file_pattern Optional.
- POST /jobs: job_type 검증, db 시 connection_id·source_table 필수 검사, create_batch_job에 새 인자 전달.
- GET /jobs: job_type 쿼리 파라미터 추가.
- GET /jobs/{batch_job_id}/db-preview: DB 배치 소스 10행 미리보기(preview_service._preview_db).
- PATCH /jobs/{id}: 새 필드 반영. clone_batch_job: job_type·connection_id·source_table 등 DB 배치 필드 복사.

**Phase 5 — 프론트엔드**
- client.js: batchListJobs에 jobType 인자 추가, batchGetJobDbPreview(batchJobId) 추가.
- BatchJobFormDb.jsx 신규: DB 연결·소스 테이블·저장 DB·타겟 테이블·주기·배치 크기/간격·증분 컬럼·sync_mode·on_row_error 등 입력, job_type='db'로 batchCreateJob 호출.
- BatchJobListFile.jsx: jobTypeFilter prop 추가, batchListJobs(undefined, undefined, jobTypeFilter) 호출. 유형(파일/DB) 컬럼, 소스 연결/소스 테이블 열 표시. DB 배치 행에 "미리보기" 버튼 및 미리보기 모달(preview_columns/preview_rows).
- ETLPage.jsx: db 탭에서 DbConnectionForm 아래 "배치 Job (DB 소스)" 섹션에 BatchJobFormDb, BatchJobListFile(jobTypeFilter="db") 배치. howToDb에 4번 항목 추가.

**변경·추가 파일:** Backend/etl_server2/batch_executor_db.py(신규), scheduler_file.py, service_file.py, router_file.py, Frontend/.../client.js, BatchJobFormDb.jsx(신규), BatchJobListFile.jsx, ETLPage.jsx, docs/report/log.md.

---

## 2026-03-04 ETL 테이블 기반 배치 통합 (DB 탭 단일 출처)

**목적:** etl_tables를 소스→타겟 정의의 단일 출처로 두고, 배치잡은 "어떤 ETL 테이블을 얼마나 자주 돌릴지"만 저장. DB 탭에서 BatchJobFormDb·BatchJobListFile(db) 제거, 등록된 ETL 목록의 "배치설정" 버튼으로 통합.

**DB (사용자 직접 반영):** `batch_jobs.etl_table_id` INTEGER NULL FK, `batch_jobs.on_file_error` 등 필요 시 ALTER TABLE로 추가.

**백엔드**
- service_file.py: `create_batch_job`에 `etl_table_id` 인자 추가. db+etl_table_id 있으면 etl_table_id로 중복 검사, INSERT에 etl_table_id 포함. `list_batch_jobs` SELECT에 `j.etl_table_id` 추가.
- router_file.py: `CreateBatchJobFromEtlTableBody`, POST `/jobs/from-etl-table` 추가. get_etl_table로 조회 후 create_batch_job(etl_table_id, connection_id/source_table/target_table/storage 스냅샷, job_name/interval_minutes/batch_size 등).
- batch_executor_db.py: `job.etl_table_id` 있으면 get_etl_table에서 connection_id·source_table·target_table·column_mapping·incremental_column·sync_mode·pk_columns·index_definitions 조회; 없으면 기존대로 job에서 읽기. 배치 전용 설정(batch_size, batch_interval_seconds, on_row_error, last_synced_at)은 항상 job에서.

**프론트엔드**
- client.js: `batchCreateJobFromEtlTable(body)` 추가.
- BatchScheduleModal.jsx 신규: ETL 테이블 기반 배치 등록/수정/토글/삭제/즉시실행. 배치 없으면 등록 폼, 있으면 현재 설정 표시+액션.
- ETLTableList.jsx: load 시 `batchListJobs(undefined, undefined, 'db')` 병렬 조회, `batchJobByEtlTable` 매핑. DB 소스 행에 "배치설정" 버튼, 배치 컬럼에 연결된 배치 시 "N분 ●/○" 또는 "미설정" 표시. BatchScheduleModal 연동.
- ETLPage.jsx: DB 탭에서 BatchJobFormDb·BatchJobListFile(db) 섹션 제거. howToDb 4번을 "배치설정을 눌러 스케줄 등록"으로 수정.
- etl.css: `.etl-table-list__batch-schedule` 스타일 추가.

**변경·추가 파일:** service_file.py, router_file.py, batch_executor_db.py, client.js, BatchScheduleModal.jsx(신규), ETLTableList.jsx, ETLPage.jsx, etl.css, log.md.

---

## 2026-03-04 DB 배치 스케줄링 코드 검증 (8건 이슈 확인)

**목적:** log.md·10_DB_Batch_Scheduling_Upgrade.md 기반으로 DB 연결+배치잡 시스템 코드 전반 검증. 제기된 8건 이슈가 현재 코드에서 반영·특이사항 없는지 확인.

**검증 결과 요약**

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | check_consecutive_failures 조건 제거 + 에러 이력 순서 | ✅ 반영됨 | create_batch_run 최상단 선행, finally 밖에서 run_id 무관 호출 |
| 2 | except에서 sys_conn.rollback() 선행 | ✅ 반영됨 | except 블록 최상단에서 sys_conn.rollback() 후 finish_run·update_job_status |
| 3 | full 모드 DROP → TRUNCATE | ✅ 반영됨 | table_exists 확인 후 TRUNCATE만 수행, 구조 보존 |
| 4 | Oracle bind :1 검증 | ✅ 일치 | db_load_service와 동일 :1 positional bind 사용, 별도 수정 불필요 |
| 5 | DB 배치 source_filename=None | ✅ 반영됨 | load_dataframe(..., source_filename=None)으로 _record_loaded_keys 스킵 |
| 6 | 프론트 파일 전용 버튼 분기 | ✅ 반영됨 | "문제 파일"은 jtype !== 'db'일 때만, "미리보기"는 jtype === 'db'일 때만 노출 |
| 7 | cancel 체크 + sleep 분할 | ✅ 반영됨 | 루프 상단 is_run_cancel_requested, sleep은 1초 단위 반복+취소 확인 |
| 8 | list_batch_jobs storage JOIN is_active | ✅ 의도 유지 | storage JOIN에 is_active 조건 없음 → 비활성 저장 DB도 이름 표시, 혼란 방지 |

**대상 파일 확인:** batch_executor_db.py, service_file.py, BatchJobListFile.jsx, db_load_service.py(Oracle :1). 추가 수정 없음.

---

## 2026-03-03 DB 배치 스케줄링 리뷰 반영 (1~3, 5, 7, 8번)

**목적:** 10_DB_Batch_Scheduling_Upgrade 구현에 대한 코드 리뷰 8건 중 추가 조치 필요 항목 반영.

**1. check_consecutive_failures + 에러 이력 순서 (높음)**
- `check_consecutive_failures` 호출에서 `if run_id is not None` 조건 제거 → **항상** 호출. create_batch_run 전 예외에서도 연속 실패 카운트로 자동 비활성화 가능.
- **create_batch_run**을 try 최상단으로 이동: `sys_conn` 획득 → `create_batch_run` → `update_job_status("running")` → target_conn·full 모드 TRUNCATE → 소스 연결·SELECT·루프. 소스 연결 실패 등에서도 실행 이력이 남고 `finish_run("error")`로 정리됨.

**2. sys_conn 재사용 시 rollback 선행 (높음)**
- except 블록 맨 앞에서 `if sys_conn: sys_conn.rollback()` 호출 후 `finish_run`·`update_job_status` 호출. PostgreSQL 등에서 트랜잭션 aborted 상태 전파 방지.

**3. full 모드 DROP → TRUNCATE (높음)**
- `sync_mode == "full"`일 때 `DROP TABLE IF EXISTS` 제거. **테이블이 존재할 때만** `load_service_file.table_exists` 확인 후 `TRUNCATE TABLE` 수행. 테이블 구조 유지, 적재 실패 시 다음 주기 재시도 가능.

**5. DB 배치 source_filename=None (중간)**
- `load_dataframe` 호출 시 `source_filename=None`으로 고정. DB 배치는 파일 단위 롤백 미지원이므로 `batch_loaded_keys` 기록 스킵, 테이블 비대화 방지.

**7. 취소 체크 + sleep 분할 (낮음)**
- chunk 루프 진입 시 `is_run_cancel_requested(run_id, conn=sys_conn)` 체크 후 break.
- `batch_interval_seconds` 대기를 `time.sleep(batch_interval_seconds)` 대신 1초 단위 루프로 변경하고, 매 초 `is_run_cancel_requested` 확인해 취소 시 즉시 break.

**8. list_batch_jobs storage JOIN (낮음)**
- `etl_storage_connections` LEFT JOIN 조건에서 `AND sc.is_active = TRUE` 제거. 비활성 저장 DB에 연결된 Job도 목록에서 저장 DB명이 표시되도록 함.

**4. Oracle bind :1** — db_load_service와 동일 패턴임을 주석으로 명시. **6. 프론트 파일 전용 버튼** — BatchJobListFile에서 "문제 파일"은 이미 `jtype !== 'db'`로 숨김. 타임스탬프 리셋·파일 롤백은 이력 상세(BatchHistoryDetailFile)에 있으며 DB 배치는 file_list 구조가 달라 별도 분기 없이 적용 제한됨.

**변경 파일:** Backend/etl_server2/batch_executor_db.py, Backend/etl_server2/service_file.py (list_batch_jobs JOIN), docs/report/log.md.

---

## 2026-03-03 docs/main·README 최신화 (log 2026-03-03·2026-02-23 반영)

**목적:** log.md 기준 마지막 개발문서 수정(2026-02-27) 이후 반영된 기능을 백엔드·프론트엔드 코드 참조하여 docs/main 개발문서 및 README에 반영.

**반영 요약:**
- **00_PRD.md**: §1.2 ETL2에 on_file_error(stop/continue), index_definitions·source-indexes, csv_reader(CSV 인코딩 통합), 배치 대기 파일 없으면 run 미기록, 폴더 연결 목록 연결정보 열, 실행 이력 partial_error·삽입/갱신 의미, 매핑 모달 PK·INDEX 열·인덱스 추가 테이블 아래, _batch_upsert IS DISTINCT FROM. §6.3.1·§8 변경 이력 2026-03-03 항목 추가.
- **01_FRONTEND_GUIDE.md**: §3 FolderConnectionListFile 연결 정보, BatchJobFormFile index_definitions·on_file_error, BatchHistoryPanelFile partial_error, TargetTableSelectModal PK·INDEX·인덱스 추가 테이블 아래. §4.5.1 FileUploadForm/DbConnectionForm/BatchJobFormFile indexDefinitions·etl2GetSourceIndexes·sourceIndexes·pkReadOnlyFromSource, BatchHistoryPanelFile "일부 실패 (N/M 성공)", TargetTableSelectModal 소스 PK/인덱스·indexDefinitions onSelect, client.js etl2GetSourceIndexes. 변경 이력 2026-03-03.
- **02_BACKEND_GUIDE.md**: §2 csv_reader.py. §3.2 etl_tables index_definitions, batch_jobs on_file_error·index_definitions. §4.6 GET source-indexes, API 설명 보강(csv_reader·on_file_error·_batch_upsert·배치 run 미기록·commit 실패·run_db_load·transform_engine·claim_next_pending_job). §6.7 전면 보강: csv_reader, on_file_error, index_definitions, get_source_indexes, _create_indexes_on_target, _batch_upsert 최적화, batch_executor_file·db_load_service·load_service·service·service_file·load_service_file 상세. 변경 이력 2026-03-03.
- **README.md**: ETL2 행에 인덱스 설정·on_file_error·partial_error·csv_reader. Backend/etl_server2 행에 인덱스·csv_reader·on_file_error. 최종 업데이트 2026-03-03.

**변경 파일:** docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, log.md.

---

## 2026-03-03 CSV 인코딩 통합(csv_reader) + claim_next_pending_job finally rollback 제거

**목적:** (1) CSV 읽기 로직 중복 제거 및 인코딩 감지 확장. (2) commit 후 불필요한 rollback 제거.

**개선 포인트 5 — CSV 인코딩 통합:**
- **Backend/etl_server2/csv_reader.py** 신규: `read_csv_robust(file_path, nrows=None)` → (DataFrame, encoding_used, data_verification_needed).
- chardet 또는 charset_normalizer 있으면 앞부분 바이트로 인코딩 자동 감지 후 해당 인코딩 우선 시도. 없으면 기존처럼 순차 시도만 사용.
- 시도 순서: 감지값 → utf-8 → utf-8-sig → cp949 → euc-kr → latin-1 → cp1252. 'unexpected end of data' 시 EOF(\\x1a) 제거 후 재시도.
- **load_service.py**: `_read_csv_robust` 제거. `_read_file`에서 CSV일 때 `csv_reader.read_csv_robust` 호출 후 (df, data_verification_needed) 반환 유지.
- **parser_file.py**: `_read_csv_robust` 제거. `read_file`에서 CSV일 때 `csv_reader.read_csv_robust` 호출 후 DataFrame만 반환.

**개선 포인트 6 — claim_next_pending_job:**
- **etl_server2/service.py**: `claim_next_pending_job`의 finally 블록에서 `conn.rollback()` 제거. commit 성공 후 rollback 호출은 불필요한 왕복·autocommit 아닐 때 부작용 가능. 예외 시에만 except 블록에서 rollback 유지.

**변경 파일:** Backend/etl_server2/csv_reader.py(신규), load_service.py, parser_file.py, service.py, docs/report/log.md.

---

## 2026-03-03 run_batch_job 파일별 에러 정책(on_file_error) + _batch_upsert UPDATE 최적화

**목적:** (1) 파일 1건 실패 시 전체 중단 대신 "다음 파일 계속" 옵션 추가. (2) upsert 시 실제로 값이 변경된 행만 UPDATE.

**on_file_error (개선 포인트 3):**
- **batch_jobs.on_file_error** 컬럼 추가 (migration_on_file_error.sql). 값: `stop`(기본) | `continue`.
- **stop**: 기존 동작. 파일 처리 중 예외 시 finish_run("error") 후 return → 나머지 파일 미처리.
- **continue**: 해당 파일만 file_results에 status="error" 기록, target_conn.rollback() 후 다음 파일 계속. last_processed_ts는 성공한 파일의 마지막 ts만 갱신. 전체 처리 후 에러 파일이 1건이라도 있으면 finish_run("partial_error"), 없으면 "success". update_job_status는 항상 "success"로 호출해 다음 주기 정상 실행.
- service_file: create_batch_job/update_batch_job에 on_file_error 파라미터·allowed 추가. router_file: CreateBatchJobBody/UpdateBatchJobBody, create_batch_job/clone/update_batch_job에 on_file_error 반영.
- BatchHistoryPanelFile: status가 "partial_error"일 때도 "일부 실패 (N/M 성공)" 표시.

**_batch_upsert (개선 포인트 4):**
- UPDATE ... FROM (VALUES ...)에 `AND (t."col1" IS DISTINCT FROM v."col1" OR ...)` 조건 추가. 실제로 non_pk 컬럼 값이 변경된 행만 UPDATE되어 WAL/디스크 I/O 절감. 반환 updated 카운트도 실제 변경 건수만 반영.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, service_file.py, router_file.py, load_service_file.py, Frontend/.../BatchHistoryPanelFile.jsx, docs/report/migration_on_file_error.sql, docs/report/log.md.

---

## 2026-03-03 run_db_load 커넥션 누수 방지 + _apply_type_cast_with_mask 벡터화

**목적:** (1) DB 커넥션 누수 위험 제거. (2) 형변환 실패 행 처리 성능 개선.

**run_db_load (db_load_service.py):**
- 함수 상단에서 `src_conn = conn_main = cur_src = cur_main = None` 초기화.
- 첫 번째 try(소스 연결·컬럼 조회 등)에서 예외 발생 시 `except` 블록에서 `src_conn`이 열려 있으면 `close()` 호출 후 재예외/반환. effective_batch_size 분기 진입 전 예외 시에도 src_conn이 닫히도록 보장.

**_apply_type_cast_with_mask (transform_engine.py):**
- 기존: `for idx in series.index` 파이썬 루프로 행 단위 `series.at[idx]` 접근 → 수십만 행에서 지연.
- 변경: 2-pass 방식. (1) 1차로 `pd.to_numeric`/`pd.to_datetime`(errors='coerce') 등 벡터 변환. (2) 실패 행만 식별(결과 NA이고 원본 비어있지 않음). (3) on_error='fail'이면 첫 실패 행에서 ValueError. (4) on_error='skip_row'면 해당 위치만 failed_mask=True. (5) null/zero/keep은 실패 행만 스칼라로 후처리. 대부분 행은 벡터 연산으로 처리되어 성능 개선.

**변경 파일:** Backend/etl_server2/db_load_service.py, Backend/etl_server2/transform_engine.py, docs/report/log.md.

---

## 2026-03-03 파일 업로드 모달: 인덱스 추가를 테이블 아래로, INDEX 열에 ✓ 연동

**목적:** 동일 모달을 쓰는 파일 업로드에서 PK·INDEX 열 유지, 인덱스 추가 UI를 매핑 테이블 아래로 배치하고, 추가한 인덱스 컬럼은 위 테이블 INDEX 열에 ✓로 표시.

**변경 내용:**
- **TargetTableSelectModal**: (1) sourceIndexes 없을 때도 매핑 테이블에 INDEX 열 항상 표시. (2) targetColumnsInCustomIndexes useMemo 추가 — customIndexDefinitions에 포함된 타겟 컬럼명 집합, INDEX 셀에 ✓ 표시용. (3) "인덱스 추가" 블록을 "저장 DB 테이블" 위에서 제거 후, 매핑 테이블 섹션 바로 아래로 이동(라벨: "인덱스 추가 (테이블 아래)"). (4) 새 테이블/기존 테이블 매핑 모두에서 INDEX 열: sourceIndexes 있으면 targetColumnsInReflectedIndexes, 없으면 targetColumnsInCustomIndexes로 ✓ 표시.

**변경 파일:** Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, docs/report/log.md.

---

## 2026-03-03 DB 연결 컬럼 매핑: PK·INDEX 열 통합 및 읽기 전용 ✓ 표기

**목적:** DB 연결 시 컬럼 매핑 창에서 소스 PK/인덱스를 별도 블록이 아닌 매핑 테이블 내 PK·INDEX 열로 통합하고, 소스 기준 컬럼은 체크 이모티콘(✓)으로만 표시.

**변경 내용:**
- **TargetTableSelectModal**: DB 연동(sourceIndexes.length > 0) 시 (1) "소스 PK" 단독 라인 및 "소스 인덱스" 별도 테이블 제거. (2) "소스 PK/인덱스" 인라인 블록 추가 — 안내 문구 + 인덱스 반영 체크(칩 형태). (3) 매핑 테이블에 **INDEX** 열 추가(PK 오른쪽). (4) PK 열: 제외 행은 "—", 소스 PK 컬럼은 ✓(읽기 전용), 그 외는 "—"(다른 컬럼에 PK 추가 불가). (5) INDEX 열: 제외 행은 "—", 반영된 소스 인덱스에 포함된 컬럼은 ✓, 그 외 "—". (6) targetColumnsInReflectedIndexes useMemo로 반영 인덱스에 포함된 타겟 컬럼명 집합 계산.
- **etl.css**: `.etl-target-select-modal__th--index`, `__cell--index`, `__constraint-check`, `__row--source-indexes-inline`, `__index-reflect-inline`, `__index-reflect-label`, `__index-reflect-chip`, `__index-reflect-cols` 추가.
- 제외된 행은 PK·INDEX 모두 "—"이며, 테이블 생성·데이터 이관 시 해당 컬럼은 constraint 미적용(기존 동작 유지).

**변경 파일:** Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 실행 이력: 삽입 집계 설명 + 일부 실패 표기 (ETL2 배치)

**목적:** (1) run 단위 "삽입 행" 500,000 vs 파일별 합 480,000 이해 정리. (2) 실행 이력 목록에서 "일부만 실패"한 run을 "전체 실패"와 구분해 표시.

**삽입/갱신 의미 (DB 행 수와의 관계):**
- **삽입(inserted)**: 이번 파일에서 **새로 추가된 행 수**. 테이블 총 행 수에 그대로 더해짐.
- **갱신(updated)**: 이번 파일에서 **이미 테이블에 있던 행(PK 동일)**의 비PK 컬럼만 갱신된 수. **행 수 증가 없음**.
- 따라서 **테이블 총 행 수 = sum(파일별 삽입)**. 갱신은 행 수에 기여하지 않음.
- 예: 파일1 220,000 삽입 + 파일2 180,001 삽입 + 20,000 갱신 + 파일3 99,999 삽입 → 삽입 합 500,000, 갱신 합 20,000. DB에는 500,000행만 있음(파일2의 20,000건은 기존 행 업데이트).

**갱신이 나오는 이유:** PK가 같은 행이 이미 테이블에 있을 때(예: 파일1에서 넣은 PK를 파일2에서 다시 넣는 경우) INSERT는 건너뛰고(ON CONFLICT DO NOTHING), UPDATE 단계에서 해당 행의 비PK 컬럼만 갱신하기 때문. 그 20,000건이 "갱신"으로 집계됨.

**검증 방법:** load_service_file._batch_upsert 주석 보강. 아래 절차로 확인 가능.
- (1) 테이블에 PK 설정 후 파일 A만 적재 → 삽입 N, 갱신 0. `SELECT COUNT(*)` = N.
- (2) 동일 PK를 가진 파일 B를 같은 타겟에 업서트(비PK 컬럼만 다름) → 삽입 0, 갱신 N. `SELECT COUNT(*)` = N 유지.
- (3) 파일 C(신규 PK M건) 적재 → 삽입 M, 갱신 0. `SELECT COUNT(*)` = N + M.

**UI 변경:**
- **BatchHistoryPanelFile**: run의 status가 "error"이고 file_list에 ok와 error가 둘 다 있을 때, 상태 컬럼에 **"일부 실패 (N/M 성공)"**으로 표기. 뱃지 클래스 `etl-db-form__status--partial`(노란 계열) 적용.
- **etl.css**: `.etl-db-form__status--partial` 추가 (color #b45309, background #fef3c7).

**변경 파일:** Frontend/react-app/src/packages/etl2/components/BatchHistoryPanelFile.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 인덱스 설정 기능 — 프론트엔드 UI 연동 (Part 2 프론트)

**목적:** 백엔드 인덱스 API·메타 반영에 맞춰 ETL2 패키지에서 파일 업로드/파일 배치의 인덱스 설정 UI, DB 연동 시 소스 PK·인덱스 라인 UI를 구현.

**변경·추가 내용:**

- **client.js**: `etl2GetSourceIndexes(connectionId, sourceTable)` 추가. GET `/api/etl2/connections/:id/source-indexes?source_table=...` 호출.
- **TargetTableSelectModal**:  
  - props: `sourceIndexes`, `currentIndexDefinitions`, `pkReadOnlyFromSource` 추가.  
  - 소스 PK 라인: `sourcePkFromSource` 있으면 "소스 PK" 읽기 전용 표시.  
  - 소스 인덱스: `nonPrimarySourceIndexes` 테이블(반영 체크, 인덱스명, 컬럼, UNIQUE). `sourceIndexReflect` 상태로 타겟 반영 여부 선택.  
  - 인덱스(선택): `sourceIndexes` 없을 때 `customIndexDefinitions` 수동 목록(인덱스명, 컬럼, UNIQUE, + 인덱스 추가/삭제).  
  - PK 체크박스: `pkReadOnlyFromSource && sourcePkColumnNames` 포함 컬럼은 disabled.  
  - `onSelect(tableName, columnMapping, pkColumns, indexDefinitions)` 4번째 인자로 indexDefinitions 전달.
- **FileUploadForm**: `indexDefinitions` 상태 추가. 모달에 `currentIndexDefinitions` 전달, onSelect에서 `setIndexDefinitions(idxDefs)`. 업로드 FormData에 `index_definitions` JSON append. 요약에 "인덱스: N개" 표시.
- **DbConnectionForm**: `sourceIndexes`, `indexDefinitions` 상태. `openTargetTableSelectModal`에서 `etl2GetSourceColumns`와 `etl2GetSourceIndexes` 병렬 호출 후 소스 PK가 있으면 `setPkColumns(primary.columns.join(', '))`. 모달에 `sourceIndexes`, `pkReadOnlyFromSource`, `currentIndexDefinitions` 전달. 등록 시 `etl2CreateTable` body에 `index_definitions` 포함. 요약에 인덱스 개수 표시.
- **BatchJobFormFile**: `index_definitions` 상태. "인덱스 (선택)" 섹션(인덱스명, 컬럼(쉼표), UNIQUE 체크, 삭제, + 인덱스 추가). `batchCreateJob` body에 `index_definitions` 포함. 등록 성공 시 초기화.
- **etl.css**: 모달용 `.etl-target-select-modal__row--source-pk`, `__source-pk-value`, `__row--source-indexes`, `__index-table-wrap`, `__th--reflect`, `__row--custom-indexes`, `__custom-index-list/row`, `__input--index-name`, `__index-cols-select/__index-cols-label/__index-cols-checkboxes/__index-col-check`, `__custom-index-unique`, `__btn-remove`, `__btn-add` 스타일 추가.
- **인덱스 컬럼 선택 방식 (PK와 동일)**: 인덱스 컬럼을 직접 입력이 아닌 **선택(체크박스)**으로 변경. TargetTableSelectModal에서는 타겟 컬럼 후보(`targetColumnNamesForPk`)를 체크박스로 표시, BatchJobFormFile에서는 `availableColumns`(컬럼 가져와서 선택 결과)를 체크박스로 표시. 컬럼 미로드 시 안내 문구 표시.

**변경 파일:** Frontend/react-app/src/shared/api/client.js, Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, FileUploadForm.jsx, DbConnectionForm.jsx, BatchJobFormFile.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 인덱스 설정 기능 추가 (Part 2 — 백엔드)

**목적:** 파일 업로드/배치·DB 연동 시 PK 외에 타겟 테이블 인덱스를 설정·자동 생성. DB 소스는 소스 테이블 PK·인덱스 조회 API 제공.

**스키마:** etl_tables, batch_jobs에 `index_definitions JSONB` 추가. migration: docs/report/migration_index_definitions.sql (시스템 DB에서 실행).

**백엔드 요약:**
- **db_load_service**: _fetch_source_indexes_pg/mysql/oracle, get_source_indexes(connection_id, source_table), _create_indexes_on_target(cur, conn, schema, table, index_definitions). run_db_load(streaming·non-streaming) 적재 완료 후 index_definitions 있으면 인덱스 생성.
- **router**: GET /connections/{connection_id}/source-indexes?source_table= — 소스 테이블 인덱스 목록(PK 포함, is_primary 구분).
- **service**: create_etl_table/update_etl_table/get_etl_table/list_etl_tables에 index_definitions 반영.
- **router**: CreateTableBody/UpdateTableBody·create_table/update_table·upload_file에 index_definitions.
- **load_service.run_file_load**: commit 후 index_definitions 있으면 _create_indexes_on_target 호출.
- **load_service_file.load_dataframe**: index_definitions 파라미터 추가, 테이블 신규 생성 시 인덱스 생성. batch_executor_file에서 job.get("index_definitions") 전달.
- **service_file/router_file**: batch_jobs에 index_definitions 저장·조회, CreateBatchJobBody/UpdateBatchJobBody·create_batch_job/update_batch_job 반영.

**프론트:** GET /source-indexes와 기존 source-columns 조합으로 소스 PK·인덱스 표시 후, PK는 고정·비활성, 인덱스는 체크박스로 타겟 반영 여부 선택 가능. PATCH /tables/{id} body에 index_definitions 포함해 저장.

**변경·추가 파일:** Backend/etl_server2/db_load_service.py, service.py, router.py, load_service.py, load_service_file.py, service_file.py, router_file.py, batch_executor_file.py, docs/report/migration_index_definitions.sql, docs/report/log.md.

---

## 2026-03-03 load_service_file·parser_file·service.py 개선 3건 (etl_server2)

**6. load_service_file.py _batch_upsert — 불필요한 UPDATE 스킵**
- INSERT ON CONFLICT DO NOTHING 후 `inserted_this_batch == len(rows)`이면 충돌 없음이므로 UPDATE FROM VALUES 불필요. 해당 시 `continue`로 UPDATE 쿼리 건너뜀.

**7. parser_file.py _read_csv_robust — 반환 타입 차이 주석**
- `_read_csv_robust` 위에 주석 추가: "배치 파일 파싱용. load_service._read_csv_robust와 달리 DataFrame만 반환(data_verification 미지원)." — parser_file은 배치용, load_service는 파일 업로드용으로 별도 모듈이지만 혼동 방지용 명시.

**8. service.py — _sys_cursor context manager 추가**
- 상단에 `from contextlib import contextmanager` 및 `@contextmanager def _sys_cursor():` 추가. yield (cur, conn), finally에서 cur.close()/conn.close(). 기존 함수는 점진적 변환 대상이며, 새 함수 작성 시 `with _sys_cursor() as (cur, conn):` 사용 권장.

**변경 파일:** Backend/etl_server2/load_service_file.py, Backend/etl_server2/parser_file.py, Backend/etl_server2/service.py, docs/report/log.md.

---

## 2026-03-03 service.py claim_next_pending_job finally에 rollback-safe 패턴 추가 (etl_server2)

**목적:** `claim_next_pending_job`에서 `conn.commit()` 전 예외 시 except에서만 rollback하고, finally에서는 close만 하던 것을 보완. finally에서 close 전에 `try: conn.rollback() except: pass`를 넣어, 어떤 경로로 나가든 트랜잭션 정리 후 커넥션 반환.

**수정 내용 (Backend/etl_server2/service.py):**
- `claim_next_pending_job`의 finally 블록에서 `conn.close()` 직전에 `try: conn.rollback() except Exception: pass` 추가. 이미 commit된 경우 rollback은 no-op이므로 안전.

**변경 파일:** Backend/etl_server2/service.py, docs/report/log.md.

---

## 2026-03-03 batch_executor_file.py 파일 루프 내 commit 실패 명시 처리 (etl_server2)

**목적:** `run_batch_job` 파일 루프에서 `target_conn.commit()` 실패 시 원인(commit 실패)을 로그·이력에 명확히 남기고, rollback 후 run을 error로 종료하도록 처리.

**수정 내용 (Backend/etl_server2/batch_executor_file.py):**
- `load_dataframe` 직후 `target_conn.commit()` 호출을 `try`/`except`로 감쌈.
- `except Exception as commit_err`: `logger.exception("run_batch_job commit failed for %s: %s", filename, commit_err)` 로그, `target_conn.rollback()`(실패 시 무시), `file_results.append({..., "status": "error", "error": str(commit_err)})`, `finish_run(..., "error", ...)`, `update_job_status(..., "error", ...)`, `return`.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-03-03 db_load_service.py non-streaming 경로 conn_main 커넥션 누수 방지 (etl_server2)

**목적:** non-streaming 경로에서 `conn_main` 생성 후 중간 예외 시 최상위 except만 타고 finally가 없어 커넥션이 닫히지 않을 수 있는 누수 방지.

**수정 내용 (Backend/etl_server2/db_load_service.py):**
- non-streaming 블록에서 `conn_main = None` 선언 후 `get_target_db_connection`·이하 전체를 `try` 안에 배치.
- 해당 `try`에 대응하는 `finally` 추가: `if conn_main:` 일 때 `try: conn_main.close() except Exception: pass`로 예외 경로에서도 커넥션 정리.

**변경 파일:** Backend/etl_server2/db_load_service.py, docs/report/log.md.

---

## 2026-03-03 load_service.py run_file_load·run_file_upsert 변수 shadowing 정리 (etl_server2)

**목적:** ETL 메타 dict와 혼동될 수 있는 `row` 변수명을 `etl_row`로 통일하여 가독성·유지보수성 개선.

**수정 내용 (Backend/etl_server2/load_service.py):**
- `run_file_load`: `row = etl_service.get_etl_table(...)` → `etl_row`, 함수 내 모든 `row.get(...)`·`if not row` → `etl_row.get(...)`·`if not etl_row`.
- `run_file_upsert`: 동일하게 `row` → `etl_row` 리네임 및 `row.get` → `etl_row.get` 일괄 치환.

**변경 파일:** Backend/etl_server2/load_service.py, docs/report/log.md.

---

## 2026-03-03 db_load_service.py non-streaming 경로 미정의 변수 버그 수정 (etl_server2)

**목적:** `run_db_load`에서 `effective_batch_size == 0`인 non-streaming 경로에서 `rows_processed`가 정의되기 전에 사용되어 NameError가 발생할 수 있는 버그 수정.

**원인:** non-streaming 분기(else) 안에서 `rows_data`만 구성하고 `rows_processed`는 이후 Phase 4 이후(약 1046행)에서만 할당되는데, 그 전에 `if rows_processed == 0:`으로 조기 반환하는 코드가 있어, 행이 0건일 때 미정의 변수 참조 발생.

**수정 내용 (Backend/etl_server2/db_load_service.py):**
- non-streaming 분기 끝(etl_service.set_job_total_rows 직후)에 `rows_processed = len(rows_data)` 추가.
- `if rows_processed == 0:` → `if len(rows_data) == 0:` 로 변경하여, 해당 분기에서 명시적으로 행 개수 기준으로 조기 반환하도록 함.

**변경 파일:** Backend/etl_server2/db_load_service.py, docs/report/log.md.

---

## 2026-02-23 배치 주기에서 대기 파일 없을 때 run 기록 미생성

**목적:** 해당 배치 주기에서 처리할 대기 파일이 없을 때 `batch_run_history`에 run 로우를 넣지 않고, 그 주기는 그냥 건너뛰도록 변경.

**변경 전:** `create_batch_run()` 호출 후 `list_files`·`get_pending_files` 실행 → pending 비었을 때 `finish_run(run_id, "skipped", files_processed=0)` 호출. 매 주기마다 run 1건이 이력에 쌓임.

**변경 후:** 먼저 폴더 어댑터 연결 → `list_files`·`get_pending_files` 실행. **pending이 비어 있으면** run 생성·갱신 없이 return(로그만 "no pending files, skip (run 기록 없음)"). pending이 있을 때만 `create_batch_run`·`update_job_status(running)` 호출 후 적재 진행.

**효과:** 대기 파일이 없는 주기에는 `batch_run_history`에 로우가 쌓이지 않음. 실행 이력에는 실제로 파일을 처리했거나 시도한 run만 표시됨.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-02-23 등록된 폴더 연결 테이블: 연결 정보 열 (SFTP IP, S3 버킷/리전) + 학습 가이드 반영

**목적:** 등록된 폴더 연결 목록에서 SFTP는 IP(host), S3는 버킷(및 리전)을 구분용으로 표시. 동일 내용을 학습 가이드에 반영.

**적용 내용:**
- **FolderConnectionListFile.jsx:** 테이블에 "연결 정보" 열 추가. SFTP → `sftp_host`, S3 → `s3_bucket`(있으면 `s3_region` 함께 표시). 백엔드 `list_folder_connections` 응답 필드 그대로 사용.
- **etc01_Backend_Learning_Flow.md:** §7-1 "폴더 연결 목록 UI (구분용 표시)" 추가(프로토콜별 표시 내용·백엔드 필드 표). §10 Phase 6에 `FolderConnectionListFile.jsx` 항목 추가. §12 배치 API에 `GET /folder-connections` 목록 조회 행 추가.

**변경 파일:** Frontend/react-app/src/packages/etl2/components/FolderConnectionListFile.jsx, docs/report/etc01_Backend_Learning_Flow.md, log.md.

---

## 2026-02-27 docs/main·README 동기화 (log 적용분 반영)

**목적:** log.md에 기록된 2026-02-27 적용 시스템·기능이 docs/main 및 README에 반영되었는지 확인 후, 미반영 분을 문서에 반영.

**반영 내용:**
- **02_BACKEND_GUIDE.md**: §2 etl_server2에 etl_limits.py 추가. §3.3 ETL 한도: config 없을 때 etl_server2 기본값(50/100_000/50_000), 배치 크기 미입력 시 기본 10_000건 상한(etl_server·etl_server2), etl_server db_load_service _safe_is_job_cancelled(시스템 DB 연결 실패 시에도 적재 계속) 명시.
- **00_PRD.md**: §3.2·§6.3 설정에 etl_limits 미지정 시 기본값·배치 미입력 시 1만 건 상한 반영. 변경 이력에 2026-02-27 동기화 항목 추가.
- **README.md**: 설정 요약에 ETL 한도 기본값·배치 기본 1만 건 문구 추가, 최종 업데이트 2026-02-27로 갱신.

**변경 파일:** docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, log.md.

---

## 2026-02-27 ETL2 학습 가이드 전면 재구성 (etc01_Backend_Learning_Flow.md)

**목적:** ETL 시스템을 처음 접하는 개발자가 코드 전에 "시스템이 뭘 하는지, 데이터가 어떻게 흘러가는지"를 잡을 수 있도록, ETL2(Backend/etl_server2, Frontend/packages/etl2) 기준으로 학습 문서 전면 재구성.

**구성:** (1) 시스템 한 문장 정의·E/T/L 다이어그램 (2) 전체 아키텍처(즉시 실행 vs 배치 경로) (3) 6개 레이어별 파일 역할 맵—실제 함수명·라이브러리 명시 (4) 기능별 데이터 흐름 3가지—파일 업로드→적재, 외부 DB→적재, SFTP/S3 배치—단계별 **호출 경로·함수·라이브러리** 표 (5) 변환 파이프라인·Job 생명주기·어댑터 패턴·DB 연결 구조·에러 처리 (6) 의존도 기준 학습 순서(Phase 1~6, 프론트 포함) (7) 설계 패턴·API 엔드포인트·자주 나오는 코드 패턴·한도·ERD.

**변경 파일:** docs/report/etc01_Backend_Learning_Flow.md, 00_ReportIndex.md, log.md.

---

## 2026-02-27 ETL2 etl_limits 기본값 설정 (일반적 서버 사양 기준)

**목적:** config에 etl_limits가 없을 때 0(한도 없음) 대신, 일반적 서버(4~8GB 메모리)에서 무난한 기본 한도 적용.

**적용 값 (Backend/etl_server2/etl_limits.py):**
| 한도 | 이전 | 제안 기본값 | 근거 |
|------|------|-------------|------|
| DEFAULT_MAX_FILE_SIZE_MB | 0 | 100 | PHP 128MB, Apache 50~100MB 등 사례; CSV/Excel 대부분 수용 |
| DEFAULT_MAX_ROWS_PER_LOAD | 0 | 500_000 | SSIS 1만 행/버퍼, Oracle 2~3만/배치; 50만 건이면 스트리밍으로 나눠 처리 시 메모리 안전 |
| DEFAULT_MAX_BATCH_SIZE | 0 | 10_000 | PostgreSQL 500~1k, Oracle JDBC 100~500, SSIS 1만 행; MySQL net_write_timeout·Oracle 메모리와 양립 |

**동작:** config.backend.etl_limits에 값을 넣으면 해당 값 사용; 키가 없을 때만 위 기본값 사용. config에서 0을 넣으면 여전히 "한도 없음"으로 동작.

**변경 파일:** Backend/etl_server2/etl_limits.py, log.md.

---

## 2026-02-27 DB 적재 배치 크기 미입력 시 기본 10000건 limit 적용

**목적:** 배치 크기를 넣지 않으면 전체 fetch 경로로 가서 메모리·부하 위험이 있으므로, 적절한 기본 limit을 적용.

**동작:** `effective_batch_size == 0`(배치 크기 미입력)일 때:
- config `max_rows_per_load`가 있으면 그 값을 사용,
- 없으면 **10000건**을 기본 상한으로 적용 (PostgreSQL·MySQL·Oracle 공통).

**구현:** `db_load_service.py`에 `DEFAULT_FETCH_LIMIT_WHEN_NO_BATCH = 10000` 상수 추가. limit_sql 계산 시 `effective_batch_size == 0`이면 `fetch_limit_when_no_batch = max_rows_per_load if max_rows_per_load > 0 else DEFAULT_FETCH_LIMIT_WHEN_NO_BATCH`로 두고, Oracle은 `FETCH FIRST {n} ROWS ONLY`, MySQL/PostgreSQL은 `LIMIT {n}` 적용.

**참고:** MySQL에만 10000 limit이 있던 것은 아님. 기존에는 배치 미입력 시 config 한도가 없으면 limit 없이 전체 fetch였음. 이번에 세 DB 공통으로 기본 10000 적용.

**백엔드 정정:** ETL2 실행 시 etl_server2 라우터가 etl_server2.queue_worker를 기동하며, 해당 워커는 **etl_server2/db_load_service.py**의 run_db_load를 사용함. etl_server2에는 이미 **MySQL/Oracle batch_size=0 → effective_batch_size=10000** 스트리밍 로직(773–779라인)이 있어, 배치 크기 없이 MySQL 적재 시 1만 건씩 적재되는 것이 맞음. 제가 처음에 etl_server만 보고 "백엔드 미구현"이라고 한 것은 잘못이었음. etl_server에도 동일 로직(MySQL/Oracle 0 → 10000 스트리밍)을 추가해 두 경로를 맞춤.

**UI 문구 정합성:** ETL 설정 모달·등록 폼·목록 도움말을 실제 동작에 맞게 수정(0 = 1만 행 공통, 목록 표시 "전체" → "1만 행(기본)").

**변경 파일:** db_load_service.py(etl_server), EtlTableSettingsModal.jsx, DbConnectionForm.jsx, ETLTableList.jsx, log.md.

---

## 2026-02-27 ETL DB 적재 0건 진행 원인 분석 및 취소 체크 견고화

**현상:** Job 107 (sample_newdb_oracle) 18:00 시작 → 14시간 후 08:28 실패, 처리 건수 0/900000, 에러 "connection to server 49.247.47.206:5432 failed: server closed the connection unexpectedly".

**원인 요약:**
1. **에러 발생 위치:** `run_db_load` 스트리밍 경로에서 **100건마다** 호출하는 `is_job_cancelled(job_id)`가 **시스템 DB**(49.247.47.206:5432)에 새 연결을 만들 때 실패한 것임. 적재 루프 자체는 타겟(메인) DB에 INSERT 중이었음.
2. **왜 0건으로 보였는지:** 진행률(`rows_processed`)은 **배치 단위**로만 갱신됨(각 배치 처리 후 `update_job_progress` 호출). 첫 배치 안에서 100건 처리 후 첫 취소 체크 시 시스템 DB 연결 실패 → 예외 발생 → 해당 배치의 `commit`/`update_job_progress` 미실행 → 롤백되어 타겟에도 0건, UI에도 0건으로 표시됨.
3. **14시간이 걸린 이유:** 첫 100건 INSERT가 **타겟(메인) DB 또는 네트워크 지연**으로 매우 느렸을 가능성이 큼(건당 수 분 수준). 그 후 첫 취소 체크에서 시스템 DB가 이미 끊어진 상태였을 수 있음.

**대응:**  
- **db_load_service:** `_safe_is_job_cancelled(job_id)` 헬퍼 추가. `is_job_cancelled` 호출을 try/except로 감싸, 시스템 DB 연결 실패 등 예외 시 경고 로그만 남기고 **False(취소 아님)** 반환하여 적재를 계속 진행하도록 함. 스트리밍·비스트리밍(full/incremental) 세 곳 모두 `_safe_is_job_cancelled` 사용하도록 변경.  
- **운영 권장:** 타겟 DB(메인 DB) INSERT 지연 원인 점검(인덱스, 네트워크, 동시 부하). 시스템 DB(49.247.47.206) 안정성·타임아웃 점검.

**변경 파일:** db_load_service.py, log.md.

---

## 2026-02-26 배치 Job 중복 등록 방지 (동일 폴더·패턴·타겟·저장DB)

**목표:** 동일한 폴더 연결·파일 패턴·타겟 테이블·저장 DB 조합으로 배치 Job을 두 개 이상 등록하지 않도록 하고, 이미 있으면 새 행을 추가하지 않고 안내만 하기.

**구현:**
- **service_file.create_batch_job:** INSERT 전에 (folder_connection_id, file_pattern, target_table, storage_connection_id) 조합으로 기존 행 존재 여부 조회. storage_connection_id는 NULL·값 동일 비교를 위해 `IS NOT DISTINCT FROM` 사용. 타겟 테이블·파일 패턴이 비어 있으면 검사 생략.
- 중복이 있으면 `ValueError("이미 동일한 폴더·파일 패턴·타겟 테이블·저장 DB로 등록된 배치 Job이 있습니다. 기존 Job을 수정하거나 삭제한 뒤 다시 등록해 주세요.")` 발생.
- **router_file:** 기존대로 ValueError → HTTP 400, detail=str(e). 프론트는 err.message로 안내 문구 표시.

**효과:** 동일 조합으로 등록 시 로우가 추가되지 않고, 에러 메시지로 기존 Job 수정/삭제 후 등록하라고 안내됨.

**변경 파일:** service_file.py, log.md.

---

## 2026-02-26 배치 upsert 갱신 건수 중복 집계 수정

**문제:** 파일별 상세에서 두 번째 파일이 전부 새 행(삽입)인데도 "삽입 180001, 갱신 200001"처럼 갱신 건수가 과다하게 나옴. 행 수 200001인데 삽입+갱신이 380002로 맞지 않음.

**원인:** `load_service_file._batch_upsert` 2단계에서 UPDATE ... FROM (VALUES ...) WHERE t.pk = v.pk 를 배치 전체에 대해 실행하면, 방금 1단계에서 INSERT한 행까지 매칭되어 함께 갱신됨. 그래서 UPDATE의 rowcount에 "실제 기존 행 갱신"과 "이번에 삽입한 행"이 모두 포함되어 갱신 건수가 부풀어 오름.

**수정:** 2단계 후 `total_updated`에 `cur.rowcount`를 그대로 더하지 않고, `max(0, cur.rowcount - inserted_this_batch)`를 더하도록 변경. 이번 배치에서 삽입된 건수만큼 빼서 실제로 기존에 있던 행만 갱신 건수로 집계.

**효과:** 파일별·run별 삽입/갱신 건수가 실제 INSERT/UPDATE 건수와 일치하고, 행 수 = 삽입 + 갱신으로 맞게 표시됨.

**변경 파일:** load_service_file.py, log.md.

---

## 2026-02-26 배치 Job 목록 섹션 패딩 및 새로고침 버튼

**목표:** 폴더 탭에서 배치 Job 목록을 위 섹션(폴더 연결 목록)과 시각적으로 구분하고, 목록 테이블만 재조회할 수 있는 새로고침 버튼 추가.

**구현:**
- **ETLPage.jsx:** 배치 Job 섹션(`etl-db-form__section--batch-job`) 상단 여백을 24px → 40px로 증가.
- **BatchJobListFile.jsx:** 목록 상단에 툴바(`etl-batch-job-list__toolbar`)와 [새로고침] 버튼 추가. 로딩/빈 목록/테이블 표시 모든 상태에서 버튼 노출, 로딩 중에는 비활성화. 클릭 시 `loadList()`로 `batchListJobs()`만 재호출.
- **etl.css:** `.etl-batch-job-list__section`(margin-top: 24px), `.etl-batch-job-list__toolbar`, `.etl-batch-job-list__refresh` 스타일 추가.

**변경 파일:** ETLPage.jsx, BatchJobListFile.jsx, etl.css, log.md.

---

## 2026-02-26 ETL 목록 배치 행 삭제 시 배치 Job cascade 삭제

**문제:** ETL 목록에서 배치 유래 행을 먼저 삭제하면 삭제가 되지 않음. 배치 잡을 먼저 지우고 ETL 목록에서 지우는 흐름이 아님.

**변경:** ETL 목록에서 "삭제" 시 연결된 배치 Job이 있으면 먼저 cascade 삭제(스케줄러 제거 + delete_batch_job), 이어서 타겟 테이블 DROP 및 레지스트리 행 삭제. 한 번에 ETL 목록에서만 삭제해도 배치 Job·테이블·레지스트리가 정리되도록 함.

**변경 파일:** service_file.py (delete_batch_target_registry_and_drop_table), ETLTableList.jsx (확인 문구), log.md.

---

## 2026-02-26 ETL 목록에 배치 타겟 레지스트리 연동 (배치 행 = 테이블 관리용만)

**목표:** 배치 Job을 ETL 목록에 “행”으로 넣어 관리. 배치 삭제 시 잡만 삭제·테이블 유지; ETL 목록에서 해당 행 삭제 시에만 타겟 DROP. 동일 target_table로 새 배치 생성 시 기존 행 업데이트.

**구현:**
- **etl_batch_target_registry** (시스템 DB): id, target_table, storage_connection_id, batch_job_id(NULLABLE), created_at, updated_at. UNIQUE(target_table, storage_connection_id). CREATE TABLE IF NOT EXISTS로 초기 생성.
- **service_file:** list_batch_target_registry(backfill 포함), upsert_batch_target_registry, clear_batch_job_from_registry, delete_batch_target_registry_and_drop_table. create_batch_job 후 upsert 호출; delete_batch_job 전에 clear_batch_job_from_registry 호출.
- **router_file:** GET /batch/target-registry, DELETE /batch/target-registry/:id.
- **client.js:** etl2ListBatchTargetRegistry, etl2DeleteBatchTargetRegistry.
- **ETLTableList:** 목록 소스를 etl2ListTables + etl2ListBatchTargetRegistry로 변경. type 'batch_target' 행은 즉시실행·이력 없이 삭제 버튼만 표시. 삭제 시 etl2DeleteBatchTargetRegistry(id) → 타겟 DROP + 레지스트리 행 삭제.

**효과:** (1) 배치 Job 삭제 시 타겟 테이블 유지, ETL 목록에는 해당 타겟 행이 계속 표시. (2) ETL 목록에서 해당 행 삭제 시에만 타겟 DROP. (3) 동일 target_table+storage로 새 배치 생성 시 기존 레지스트리 행의 batch_job_id만 갱신.

**변경 파일:** service_file.py, router_file.py, client.js, ETLTableList.jsx, log.md.

---

## 2026-02-26 배치 upsert 삽입/갱신 건수 구분 수정

**문제:** 두 번째 파일 적재 시 실제로는 새 행 추가(삽입)인데도 이력에 "갱신 200001"로만 표시됨. 삽입 행 0, 갱신 행 200001로 나옴.

**원인:** `load_service_file._batch_upsert`가 INSERT ... ON CONFLICT DO UPDATE 한 번만 실행하고 반환을 항상 `(0, total)`로 해서, 실제 INSERT된 행도 전부 "갱신"으로 집계됨.

**수정:** `_batch_upsert`에서 삽입/갱신 건수를 구분하도록 2단계 실행.
1. `INSERT ... ON CONFLICT (pk) DO NOTHING` 실행 → `cursor.rowcount` = 실제 삽입 건수.
2. 같은 배치로 `UPDATE table SET ... FROM (VALUES ...) AS v(...) WHERE table.pk = v.pk` 실행 → `cursor.rowcount` = 갱신 건수.
non_pk가 없으면 기존처럼 DO NOTHING만 사용하며 updated=0.

**효과:** 이력의 "삽입 행"/"갱신 행"이 실제 INSERT/UPDATE 건수와 일치함.

**변경 파일:** load_service_file.py, log.md.

---

## 2026-02-26 배치 첫 실행 큐 처리 변경 — 잠재 이슈 점검

**목적:** "첫 실행 시 대기 파일 전부 반환" 변경에 따른 기능·로직·알고리즘 잠재 문제 점검.

**점검 결과 요약:**
- **정상:** run 시작 시 get_pending_files 1회 호출, 동일 pending으로 파일별 순회. 메모리는 파일 단위만 사용. 에러/취소 시 이미 처리분 커밋 유지·다음 run에서 실패 파일부터 재시도. list_folder_columns/validate-target은 pending[0]만 사용해 변경 영향 없음.
- **주의:** 스킵(크기 초과/중복 체크섬) 시 last_processed_ts 미갱신 — 스킵 파일이 중간에 있으면 영구 스킵, 맨 마지막이면 매 run 재시도. 대량 대기 파일 시 1 run 장시간·연결 유지 가능성; 필요 시 run당 상한 확장 고려.
- **문서:** 09_ETL_SFTP_Connection.md §4.2에 "주의·잠재 이슈" 문단 추가.

**변경 파일:** 09_ETL_SFTP_Connection.md, log.md.

---

## 2026-02-26 배치 Job 첫 실행 시 이전 시점 파일 큐 처리 수정

**문제:** 새로 등록한 배치 Job(예: 오후 3:25 등록) 실행 시, 해당 시점 이전에 SFTP에 올라온 동일 패턴 파일이 2개 있어도 1개만 처리되고 두 번째 파일은 다음 주기(예: 6시간 후)까지 처리되지 않음.

**원인:** `parser_file.get_pending_files`에서 `last_processed_ts`가 None(첫 실행)일 때 `candidates[:1]`로 **가장 오래된 1건만** 반환하도록 되어 있었음. 문서(09_ETL_SFTP_Connection.md)에도 "첫 실행 1건 → 다음 주기에서 나머지"로 기술되어 있었으나, 기대 동작은 "이전 시점 파일들을 큐로 쌓아 한 run에서 순차 처리".

**수정:**
- **parser_file.py:** `get_pending_files` 첫 실행 분기에서 `candidates[:1]` 제거. `last_processed_ts is None`일 때 `ts <= max_ts`인 매칭 파일 **전부** 반환하도록 변경. `batch_executor_file`은 이미 `pending`을 for 루프로 순회하며 파일별 `update_last_processed_ts` 호출하므로 추가 수정 없음.
- **09_ETL_SFTP_Connection.md:** §4.2 증분 판단 설명을 "첫 실행 시에도 대기 파일 전부 처리(한 run에서 큐처럼 순차 적재)"로 정리.

**효과:** 배치 등록 후 즉시 실행(또는 첫 주기 실행) 시, 등록 시점 이전에 올라온 동일 패턴 파일이 여러 개 있으면 타임스탬프 오름차순으로 한 run에서 모두 처리됨.

**변경 파일:** parser_file.py, 09_ETL_SFTP_Connection.md, log.md.

---

## 2026-02-26 ETL 목록·잡 이력 테이블 새로고침 버튼 추가

**목표:** ETL 목록 테이블과 잡 이력 테이블에서 해당 테이블만 다시 불러오는 [새로고침] 버튼 제공.

**구현:**
- **ETLTableList.jsx:** 상단에 툴바(`etl-table-list__toolbar`)와 [새로고침] 버튼 추가. 클릭 시 `load()` 호출로 `etl2ListTables`·`batchListJobs`만 재호출. 로딩/에러/빈 목록/테이블 표시 모든 상태에서 버튼 노출, 로딩 중에는 비활성화.
- **BatchHistoryPanelFile.jsx:** 이력 테이블 위에 `etl-db-form__table-actions` 영역과 [새로고침] 버튼 추가. 클릭 시 `loadHistory(false)` 호출로 해당 배치 Job의 `batchListJobHistory`만 재호출.
- **JobHistoryPanel.jsx:** 상태 필터와 같은 줄에 `etl-history__bar`로 [새로고침] 버튼 배치. 클릭 시 `load()` 호출로 `etl2ListJobs`만 재호출(현재 선택된 상태 필터 유지).
- **etl.css:** `etl-table-list__toolbar`, `etl-table-list__refresh`, `etl-db-form__table-actions`, `etl-history__bar`, `etl-history__refresh` 스타일 추가.

**변경 파일:** ETLTableList.jsx, BatchHistoryPanelFile.jsx, JobHistoryPanel.jsx, etl.css, log.md.

---

## 2026-02-25 서브에이전트 동작 보강 (be-impl/fe-impl, @태그, 모델 안내)

**목표:** 메인 혼자만 일하는 문제 해결 — 서브에이전트 실제 호출을 위해 에이전트 추가·오케스트레이터·커맨드·안내 문서 반영.

**원인 대응:**
- Auto/Composer 1 모델은 서브에이전트(Task 도구) 미지원 → 오케스트레이터·README에 지원 모델(Claude Opus 4.6, Gemini 2.5 Flash 등) 명시.
- 위임 시 룰만 참고하고 메인이 직접 처리 → **@에이전트명** 호출 강제 및 add-feature에서 "위임과 조율만, 직접 코드 작성 금지" 명시.

**구현 요약:**
- **.cursor/agents/be-impl.md** (신규): 백엔드 service + router 통합 전담. description 짧고 구체적.
- **.cursor/agents/fe-impl.md** (신규): 프론트 client.js + 컴포넌트 + CSS 통합 전담.
- **.cursor/agents/verifier.md**: "파일을 수정하지 않습니다" 명시, 검증 항목·출력 형식 간결화.
- **.cursor/rules/tech-lead-orchestration.mdc**: 필수 확인(서브에이전트 지원 모델), MUST @태그 사용, 위임 조건에 @be-impl @fe-impl @verifier 예시 추가.
- **.cursor/commands/add-feature.md**: @be-impl @fe-impl @verifier 위임 순서로 재작성, "당신은 위임과 조율만 합니다" 명시, 모델 안내 문구 추가.
- **.cursor/README.md** (신규): 서브에이전트 동작 조건(모델 선택·@호출·회색 박스 확인), 디렉터리 역할, 에이전트·커맨드 요약.

**변경·신규 파일:** .cursor/agents/be-impl.md(신규), .cursor/agents/fe-impl.md(신규), .cursor/agents/verifier.md, .cursor/rules/tech-lead-orchestration.mdc, .cursor/commands/add-feature.md, .cursor/README.md(신규), log.md.

---

## 2026-02-25 Cursor commands 추가 (add-feature, pr, verify)

**목표:** 반복 워크플로우를 `/명령어`로 실행할 수 있도록 .cursor/commands에 커맨드 3종 추가.

**추가 파일:**
- **add-feature.md**: 새 기능 백엔드→프론트 전체 체인. 플랜 테이블 출력 → be-data → be-router → fe-state → fe-markup → fe-style → cross-check → 결과 요약.
- **pr.md**: 현재 변경사항으로 PR 생성. git diff 확인 → 커밋 메시지(한국어) → 커밋+푸시 → gh pr create → PR URL 출력.
- **verify.md**: 전체 연결 정합성 검증. client.js↔라우터, Pydantic↔프론트, SELECT↔row 접근, className↔CSS, npm run build → ✅/❌ 결과 테이블.

**변경 파일:** .cursor/commands/add-feature.md(신규), .cursor/commands/pr.md(신규), .cursor/commands/verify.md(신규), log.md.

---

## 2026-02-25 Cursor 멀티에이전트 오케스트레이션·스킬 보강

**목표:** 병렬 위임이 동작하도록 오케스트레이션 룰 강제화, 신규 스킬 추가, cross-check 자동 실행 조건 명시.

**구현 요약:**
- **tech-lead-orchestration.mdc**: MUST 키워드·플랜 테이블 선출력 강제. 자동 위임 조건(백엔드+프론트 동시 수정 / 수정 3개 이상 / router+service+client 체인) 1개라도 해당 시 반드시 서브에이전트 위임. Phase 순서(1: be-data+fe-style 병렬 → 2: be-router → 3: fe-state+fe-markup → 4: be-worker → 5: verifier/linker). 예외: 단일 파일·CSS만·주석/문서만. `alwaysApply: true` 유지.
- **error-resolver 스킬**: `.cursor/skills/error-resolver/SKILL.md` 신규. 빌드/런타임/타입 에러 시 파일:라인 추출 → 관련 코드 확인 → 수정안(diff) 제시. 프론트(Module not found, JSX), 백엔드(ImportError, ValidationError, psycopg2) 분류.
- **migration-helper 스킬**: `.cursor/skills/migration-helper/SKILL.md` 신규. DB 스키마 변경 시 ALTER TABLE → service.py → Pydantic → client.js → UI → cross-check 체크리스트.
- **cross-check SKILL.md**: "자동 실행 조건 (MUST)" 섹션 추가. 엔드포인트 추가/수정, client.js 함수 추가/수정, service.py 반환값 변경, DB 스키마 변경 후 반드시 cross-check 실행.

**변경·신규 파일:** .cursor/rules/tech-lead-orchestration.mdc, .cursor/skills/error-resolver/SKILL.md(신규), .cursor/skills/migration-helper/SKILL.md(신규), .cursor/skills/cross-check/SKILL.md, log.md.

---

## 2026-02-26 ETL 변환 룰 — 매핑 모달 내 통합

**목표:** 타겟 테이블 매핑 모달(TargetTableSelectModal)에서 컬럼 매핑과 변환 설정을 한 화면에서 처리하고, 미리보기로 결과를 즉시 확인.

**구현 요약:**
- **Phase 1 (Backend):** `POST /api/etl2/transform/preview` 추가. Body: `etl_table_id?`, `rules?`, `sample_data?`, `max_rows`(기본 10). `sample_data` 있으면 DataFrame으로 사용, 없고 `etl_table_id` 있으면 `preview_service.get_raw_sample()`로 파일/DB 원본 샘플 조회. `transform_engine.apply_rules(df, rules)` 호출 후 `before`/`after`/`column_changes`/`new_columns`/`rows_before`/`rows_after` 반환. `preview_service`에 `get_raw_sample`, `_raw_sample_db` 추가.
- **Phase 4 (client.js):** `etl2TransformPreview(body)`, `etl2CreateTransformRule(body)`, `etl2UpdateTransformRule(ruleId, body)`, `etl2DeleteTransformRule(ruleId)` 추가.
- **Phase 2 (TargetTableSelectModal):** 매핑 테이블에 **변환** 열 추가. 드롭다운: 없음 | 정리 | 타입 변환 | 정리+타입 변환 | 값 매핑. 값 매핑 선택 시 `CodeMapInlineEditor` 인라인 편집(원본값→변환값, 매핑 안 된 값: NULL/유지/기본값). 적용 시 `etlTableId`가 있으면 기존 룰(해당 source_column) 삭제 후 `getAssembledRules()`로 새 룰 POST. `apply_order` = 컬럼 인덱스×10 + 서브인덱스.
- **Phase 3 (TransformPreviewPanel):** 신규 `TransformPreviewPanel.jsx`. 매핑 모달 하단 미리보기 토글, "미리보기 새로고침" 버튼으로 `etl2TransformPreview({ etl_table_id, rules })` 호출. before/after 테이블 나란히 표시, 변경 셀 하이라이트, 컬럼별 요약 뱃지. `etlTableId` 없으면 "ETL 등록 후 미리보기를 사용할 수 있습니다." 안내.

**제약:** `transform_engine.py`, `transform_rules_service.py` 수정 없음. derived, masking 타입 UI 미포함. 폴더 배치 Job에는 변환 룰 미적용.

**변경·신규 파일:** router.py, preview_service.py, client.js, TargetTableSelectModal.jsx, TransformPreviewPanel.jsx(신규), etl.css, log.md. 제작 플랜: docs/report/ETL_Transform_Rules_Implementation_Plan.md.

---

## 2026-02-26 ETL2 실행 이력·상세 실시간 갱신 (폴링 + 진행 중 file_list 반영)

**문제:** 실행 이력 모달에서 진행 중(running)인 run이 있어도 목록·상세가 한 번만 로드되어 실시간으로 갱신되지 않음. 상세 창에서 파일별 진행이 보이지 않음.

**원인:** (1) 프론트: 이력 목록·상세 모두 마운트 시 1회만 API 호출, 폴링 없음. (2) 백엔드: `file_list`·집계는 `finish_run` 시에만 DB 반영되어, running 중에는 상세 API가 빈 결과만 반환.

**수정:**
- **BatchHistoryPanelFile.jsx**: `status === 'running'`인 run이 있으면 2초 간격으로 `batchListJobHistory` 재호출(조용한 갱신, 로딩 플래그 없음).
- **BatchHistoryDetailFile.jsx**: `detail.status === 'running'`이면 2초 간격으로 `batchGetJobHistoryDetail` 재호출. `loadDetail(silent=true)`로 배경 갱신하여 로딩 깜빡임 없음.
- **service_file.py**: `update_run_progress(run_id, files_processed, rows_inserted, rows_updated, file_list, conn)` 추가. `status='running'`인 run만 갱신(상세 화면 실시간 반영용).
- **batch_executor_file.py**: 파일 1건 처리(성공·스킵) 후 매번 `update_run_progress` 호출. 스킵(크기 초과·중복·빈 파일) 시에도 호출.

**효과:** 이력 목록에서 진행 중 run의 상태가 주기적으로 갱신되고, 상세 창을 열어두면 처리된 파일 수·file_list·삽입/갱신 행이 실시간으로 표시됨.

**변경 파일:** BatchHistoryPanelFile.jsx, BatchHistoryDetailFile.jsx, service_file.py, batch_executor_file.py, log.md.

---

## 2026-02-26 ETL2 PK 컬럼 "컬럼 가져와서 선택" 로딩 최적화

**원인:** 컬럼명만 필요한데도 원격(SFTP/S3)에서 **파일 전체**를 다운로드한 뒤 `read_file(..., max_rows=1)`로 1행만 읽고 있어, 대용량 CSV일수록 전송 시간이 길어짐.

**수정:**  
- **folder_adapter_file.py**: `FolderAdapter`에 `download_file_head(filename, local_path, max_bytes=65536)` 추가. SFTP는 `sftp.open(remote).read(max_bytes)`로 앞부분만 읽어 로컬에 저장. S3는 `get_object(..., Range='bytes=0-65535')`로 앞 64KB만 받음.  
- **router_file.py** `list_folder_columns`: 확장자가 **csv**일 때는 `adapter.download_file_head(...)`만 호출하고, xlsx/xls/parquet는 기존대로 전체 다운로드.

**효과:** CSV 기준으로 "컬럼 가져와서 선택" 시 수십~수백 MB 파일도 최대 64KB만 전송하므로 로딩 시간 단축.

**변경 파일:** folder_adapter_file.py, router_file.py, log.md.

---

## 2026-02-26 ETL2 DB 연결·폴더·저장 DB 섹션 카드 접기/펼치기 통일

**목적:** DB 연결에만 있던 섹션 넘버링(1, 2) 제거하고, DB 연결·폴더·저장 DB 등록 탭의 섹션을 공통 접기/펼치기 카드로 통일.

**구현:**
- **CollapsibleCardSection.jsx**: title, defaultOpen, subtitle, children. 헤더(▶/▼) 클릭으로 본문 토글. defaultOpen이 false로 바뀌면 한 번 닫힘.
- **연결 추가 섹션** 디폴트: 등록된 항목이 있으면 닫힘(defaultOpen=false), 없으면 열림(defaultOpen=true). DB 연결·저장 DB는 동일 컴포넌트에서 목록 개수로 판단. 폴더는 목록이 별도 컴포넌트라 defaultOpen=true 유지.
- DbConnectionForm: "연결 추가", "등록된 연결", "ETL 테이블 등록" 각각 CollapsibleCardSection 적용, step-num 제거.
- StorageConnectionForm: "저장 DB 추가", "등록된 저장 DB" CollapsibleCardSection 적용.
- FolderConnectionFormFile: "폴더 연결 추가" CollapsibleCardSection 적용.
- FolderConnectionListFile: "등록된 폴더 연결" CollapsibleCardSection 적용.
- etl.css: .etl-db-form__section--collapsible, .etl-db-form__card-toggle, .etl-db-form__card-body 등 추가.

**변경 파일:** CollapsibleCardSection.jsx(신규), etl.css, DbConnectionForm.jsx, StorageConnectionForm.jsx, FolderConnectionFormFile.jsx, FolderConnectionListFile.jsx, log.md.

---

## 2026-02-26 ETL 목록 배치 Job 행 컬럼 정렬·저장 DB/상태 표시 수정

**문제:** 등록된 ETL 목록에 배치 Job 행이 들어갈 때 컬럼이 어긋나고(저장 DB/상태가 잘못된 칸에 표시), 저장 DB·상태가 "—" 또는 raw 값(success)으로만 보임.

**원인:** 배치 행에 `<td>`가 하나 더 있어 13개 칸이 됨(헤더 12개와 불일치). 저장 DB는 API에서 내려주지 않음.

**수정:** (1) 배치 행에서 불필요한 `<td>—</td>` 제거해 12열로 맞춤. (2) 백엔드 `list_batch_jobs`에 `etl_storage_connections` LEFT JOIN 추가해 `storage_connection_name` 반환. (3) 프론트 mergedRows에 `storage_connection_name` 반영(storage_connection_id 없으면 '기본 DB'). (4) 배치 상태 셀에 한글 표기(성공/에러/실행중/활성/비활성) 적용.

**변경 파일:** service_file.py, ETLTableList.jsx, log.md.

---

## 2026-02-26 ETL2 배치 Job 삭제 시 FK 위반 해결

**문제:** 배치 Job 삭제 시 `batch_run_history_batch_job_id_fkey` 위반 — `batch_run_history`가 `batch_jobs.batch_job_id`를 참조하여 DELETE가 거부됨.

**원인:** `delete_batch_job`이 `batch_jobs`만 DELETE하고, 자식 테이블(`batch_run_history`, `batch_loaded_keys`)을 먼저 지우지 않음.

**수정:** `service_file.delete_batch_job`에서 삭제 순서를 ① `batch_loaded_keys` ② `batch_run_history` ③ `batch_jobs` 로 하고, 각각 해당 `batch_job_id` 행만 삭제한 뒤 `batch_jobs` 삭제하도록 변경.

**변경 파일:** service_file.py, log.md.

---

## 2026-02-26 ETL2 배치 Job 주기 수정 UI

**목적:** 등록된 배치 Job의 실행 주기(interval_minutes)를 목록에서 수정 가능하도록 함.

**구현:** BatchJobListFile에 "주기 수정" 버튼 추가. 클릭 시 모달(etl-pk-modal 스타일 재사용)에서 주기(분) 10~1440 입력 후 저장 시 `batchUpdateJob(id, { interval_minutes })` 호출. 백엔드 PATCH `/api/etl2/batch/jobs/:id` 및 `reschedule_job`은 기존 구현 사용.

**변경 파일:** BatchJobListFile.jsx, log.md.

---

## 2026-02-26 ETL2 폴더 배치 "기본 DB" = ibank_db 정합성 수정

**문제:** "기본 DB"로 설정해도 폴더 배치의 테이블 생성·적재가 저장 DB 목록의 첫 번째(PostgreSQL) 연결로 들어감. 파일 업로드/DB 연결 탭에서는 `storage_connection_id` 없을 때 `get_target_db_connection(None)` → ibank_db를 사용함.

**원인:**  
- 프론트: "기본 DB"(value="") 선택 시 422 방지를 위해 `storage_connection_id`를 저장 DB 목록 첫 번째 ID로 대체해 전송.  
- 백엔드: `create_batch_job(storage_connection_id: int)` 필수, 실행기/롤백은 `job["storage_connection_id"]`만 사용 → "기본 DB" 경로 없음.

**수정 요약:**  
- **기본 DB 정의:** `etl_server2.service.get_target_db_connection(None)` = config 기반 ibank_db (파일/DB 탭과 동일).  
- **백엔드:** `storage_connection_id` Optional 처리. `CreateBatchJobBody`/`ValidateTargetBody`에서 `Optional[int] = None`. `service_file.create_batch_job`·`rollback_file_from_target` 인자 `Optional[int]`. `load_service_file.get_target_connection(None)` → `get_target_db_connection(None)` 호출. 배치 실행기·롤백·clone 시 `job["storage_connection_id"]`가 None이면 그대로 전달.  
- **프론트:** "기본 DB" 선택 시 `storage_connection_id`를 null로 두고 전송(sid 계산 시 첫 번째 연결 사용 제거). 타겟 테이블 목록은 `sidForTarget === null`일 때도 `batchListTargetTables(null)` 호출해 기본 DB 테이블 로드.  
- **DB:** `batch_jobs.storage_connection_id`에 NULL 허용 필요. 기존 컬럼이 NOT NULL이면 마이그레이션:  
  `ALTER TABLE <system_schema>.batch_jobs ALTER COLUMN storage_connection_id DROP NOT NULL;`

**변경 파일:** router_file.py, service_file.py, load_service_file.py, BatchJobFormFile.jsx, log.md.

---

## 2026-02-26 ETL2 파일 단위 적재 롤백 (batch_loaded_keys)

**목적:** 특정 파일로 적재된 데이터만 타겟 테이블에서 DELETE. 고객 테이블·적재 로직 변경 없이 시스템 DB `batch_loaded_keys`로 PK 추적.

**흐름:**
- 적재 시: PK가 있고 출처 정보가 넘어오면 `load_dataframe` 내부에서 `_record_loaded_keys`로 해당 파일의 행별 PK를 `batch_loaded_keys`에 INSERT.
- 롤백 시: `rollback_file_from_target`이 batch_loaded_keys에서 job+run+filename으로 PK 목록 조회 → 타겟 테이블에서 해당 PK들 DELETE → batch_loaded_keys에서 해당 건 DELETE.

**구현:**
- **load_service_file.py**: `load_dataframe`에 선택 인자 `batch_job_id`, `run_id`, `source_filename`, `sys_conn` 추가. PK가 있을 때만 `_record_loaded_keys(sys_conn, ...)` 호출. `_record_loaded_keys`: 행별 pk_values(JSONB) 벌크 INSERT(1000건씩), 실패 시 rollback 후 경고만 로깅.
- **batch_executor_file.py**: `load_dataframe` 호출 시 위 4개 인자 전달.
- **service_file.py**: `rollback_file_from_target(batch_job_id, run_id, filename, storage_connection_id, target_table, pk_columns_str)` 추가. PK 비면 ValueError. 시스템 DB에서 PK 목록 조회 → 타겟 DB에서 1000건씩 배치 DELETE → 시스템 DB에서 해당 loaded_keys 삭제. 반환: 삭제된 행 수.
- **router_file.py**: `RollbackFileBody(filename, run_id)`, POST `/jobs/{batch_job_id}/rollback-file` 추가. 실행 상세 응답에 `pk_columns` 포함(롤백 버튼 활성화용).
- **client.js**: `batchRollbackFile(batchJobId, body)` 추가.
- **BatchHistoryDetailFile.jsx**: `pk_columns` 있으면 해당 런에서 성공(status=ok) 파일만 "적재 롤백" 버튼 활성화. 클릭 시 확인 후 `batchRollbackFile(batchJobId, { run_id: runId, filename })` 호출, 완료 후 상세 재조회. PK 없으면 버튼 비활성 + 툴팁 "PK를 설정하면 파일 단위 롤백이 가능합니다."

**제약:** PK가 없는 배치(APPEND만)는 파일 단위 롤백 미지원.

**검증:** linker(연결 추적), verifier(API·빌드) 통과.

**변경 파일:** load_service_file.py, batch_executor_file.py, service_file.py, router_file.py, client.js, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 파일 단위 커밋 복원 + 파일 로우별 상세·원격 삭제

**의도 반영:** 정상 파일/문제 파일이 섞일 수 있으므로 **파일 단위 커밋**이 맞음. 런 전체 롤백 대신 **이미 처리된 파일은 커밋 유지**, 취소는 **다음 파일부터 중단**만 수행.

**Executor 변경:**
- `batch_executor_file.py`: 적재 후 다시 **파일 단위 commit** (각 파일 처리 직후 `target_conn.commit()`).
- 런 종료 시 한 번만 commit하던 블록 제거.
- 취소 시: `target_conn.rollback()` 제거. 이미 처리된 파일은 커밋된 상태로 두고, `finish_run('cancelled')` 후 return만 수행.

**실행 상세 UI (파일 로우별):**
- `BatchHistoryDetailFile.jsx`: 파일별 결과 테이블에 **동작** 열 추가.
  - **상세**: 클릭 시 해당 로우 아래에 파일명·타임스탬프·상태·행 수·삽입·갱신·체크섬·사유/에러 등 상세 블록 토글.
  - **원격 삭제**: 확인 후 `batchDeleteSkippedFiles(batchJobId, [filename])` 호출. 원격(SFTP/S3)에서 해당 파일 삭제 후 상세 재조회.
  - **적재 롤백**: 해당 파일만 롤백하려면 배치 실행 시 PK 목록 저장이 필요하므로, 현재는 비활성 + 툴팁으로 "추후 지원 예정" 안내.
- 런 전체 **실행 취소** 버튼 문구: "실행 취소 (다음 파일부터 중단)"으로 변경.

**추후 검토:** 특정 파일로 올라간 데이터만 롤백하려면, 적재 시 해당 파일에서 insert/upsert된 PK 목록을 `file_list` 등에 저장하고, 롤백 API에서 해당 PK로 DELETE하는 방식이 필요.

**변경 파일:** batch_executor_file.py, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 타겟 테이블 셀렉트·검증·실행 상세·취소 롤백

**1. 타겟 테이블 셀렉트 + 새 테이블 입력**
- Backend: GET `/batch/target-tables?storage_connection_id=` 추가 (etl_service.list_target_tables). POST `/batch/jobs/validate-target` 추가 (ValidateTargetBody: folder_connection_id, storage_connection_id, file_pattern, target_table). 기존 테이블일 때 파일 패턴 1건 컬럼 vs 타겟 테이블 컬럼 비교, 적재 가능 여부만 반환(valid, message). 컬럼 매핑 UI/검증 제외.
- Frontend: `batchListTargetTables`, `batchValidateTarget` 추가(client.js). BatchJobFormFile: 저장 DB 선택 시 target-tables 로드. 타겟 테이블 = 셀렉트(기존 테이블 목록) + "새 테이블 (직접 입력)" 선택 시 텍스트 입력. 등록 시 기존 테이블 선택이면 validate-target 호출 후 valid가 아니면 에러 메시지로 막고, valid이거나 새 테이블이면 batchCreateJob 호출.

**2. 실행 상세 UI**
- BatchHistoryDetailFile: 요약에 "성공 N건 · 실패 N건 · 스킵 N건" 추가. 파일별 테이블에 상태 뱃지(etl-db-form__status--success/error/idle), 행 수·삽입·갱신 열 분리 표시.

**3. 실행 취소 + 롤백**
- Backend: `batch_run_history`에 `cancel_requested_at TIMESTAMP NULL` 컬럼 필요. 마이그레이션: `ALTER TABLE ... ADD COLUMN cancel_requested_at TIMESTAMP NULL;` (시스템 DB 스키마). service_file: `set_run_cancel_requested(run_id)`, `is_run_cancel_requested(run_id, conn)` 추가. router_file: POST `/jobs/{batch_job_id}/history/{run_id}/cancel` 추가.
- batch_executor_file: 파일별 commit 제거, 루프 종료 후 target_conn.commit() 1회만 수행. 매 파일 처리 전 `is_run_cancel_requested(run_id)` 확인, True면 target_conn.rollback(), finish_run('cancelled', file_list=현재까지), return. 파일 예외 시에도 rollback 후 finish_run('error') 및 return.
- Frontend: BatchHistoryDetailFile에서 status=running일 때 "실행 취소 (적재 롤백)" 버튼 표시, batchCancelRun 호출 후 상세 재조회. client.js에 batchCancelRun 추가.

**변경 파일:** router_file.py, service_file.py, batch_executor_file.py, load_service_file (normalize_col import), client.js, BatchJobFormFile.jsx, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 배치 Job 등록 422 원인 수정 (기본 DB 처리)

**원인:** POST /api/etl2/batch/jobs는 `storage_connection_id`를 필수로 요구하는데, 프론트 "저장 DB" 셀렉트의 기본 옵션이 "기본 DB"(value="")라서 그대로 두면 `null`이 전달되어 422 발생.

**수정:** "기본 DB" 선택(value="")일 때는 저장 DB 목록의 **첫 번째 연결 ID**를 사용하도록 변경. 목록이 비어 있을 때만 "저장 DB 목록이 비어 있습니다. 저장 DB를 먼저 등록하세요."로 막음.

**변경 파일:** BatchJobFormFile.jsx, log.md.

---

## 2026-02-26 ETL2 폴더 연결 폼 레이아웃·UI 정리

**폴더 연결 추가 — 호스트·포트 한 줄 정렬:**
- `FolderConnectionFormFile.jsx`: 호스트·포트를 `etl-db-form__grid--2` 대신 `etl-db-form__row etl-db-form__row--host-port`로 감싸 한 줄 배치. 호스트 필드에 `etl-db-form__field--host`, 포트 필드에 `etl-db-form__field--port` 적용.
- `etl.css`: `.etl-db-form__row--host-port` 추가 — `display: flex`, `gap: 16px`, `align-items: flex-start`. 호스트는 `flex: 1`, 포트는 `flex: 0 0 90px`로 고정 폭. 행 내 필드 `margin-bottom: 0`으로 중복 간격 제거. 720px 이하에서 `flex-direction: column`, 포트 필드 `max-width: 120px` 유지.

**변경 파일:** FolderConnectionFormFile.jsx, etl.css, log.md.

---

## 2026-02-26 ETL2 효율·정리·운영 기능 (1-1, 1-2, 2-1, 2-2, 3-1, 3-2)

**효율 개선:**
- **1-1** `load_service_file.py` `_batch_insert` / `_batch_upsert`: 행 생성을 `[tuple(batch[c].iloc[i] for c in columns) for i in range(len(batch))]`에서 `[tuple(row) for row in batch[columns].itertuples(index=False, name=None)]`로 변경. 수천~수만 행·다수 컬럼 시 성능 개선.
- **1-2** `service_file.py` `list_skipped_files`: 쿼리에 `LIMIT %s` 추가, 인자 `limit=50` (기본 최근 50회 이력만 스캔). 이력 수백 건 시 불필요한 데이터 읽기 감소.

**불필요 코드·방어 로직:**
- **2-1** `load_service_file.py` `load_dataframe`: `if not mapping_used: mapping_used = []` 제거. `if mapping_used:`만 유지.
- **2-2** `batch_executor_file.py` except 블록: 순서를 finish_run(선행) → update_job_status(항상) → check_consecutive_failures로 변경. 이력 먼저 닫고 Job 상태 갱신. `finish_run`을 try/except로 감싸 복구 실패 시 로그만 남기고, `update_job_status`도 try/except로 방어.

**추가 기능:**
- **3-1** `service_file.py` `update_last_processed_ts`: 인자 `ts`를 `Optional[str]`로 변경. `ts=None`이면 DB에 NULL 저장(처음부터 재시작). `router_file.py`에 `ResetTsBody`(timestamp: Optional[str]), POST `/jobs/{batch_job_id}/reset-ts` 추가. Body에 timestamp 생략 또는 null이면 last_processed_ts=NULL.
- **3-2** `router_file.py`: POST `/jobs/{batch_job_id}/clone` 추가. 기존 Job 기준으로 `job_name (복제)`, `target_table_copy`, `is_active=False`로 새 Job 생성 후 batch_job_id 반환.

**변경 파일:** load_service_file.py, service_file.py, batch_executor_file.py, router_file.py, log.md.

---

## 2026-02-26 ETL2 추가 보강 — 예외 처리·SQL·메모리·스킵 파일 기능

**추가 개선 (2-1 ~ 2-4):**
- **2-1** `batch_executor_file.py` except 블록: `check_consecutive_failures(batch_job_id, threshold=5)` 호출 시 `conn`을 넘기지 않도록 변경. 별도 커넥션으로 격리해 rollback이 선행 commit에 영향을 주지 않도록 함.
- **2-2** `load_service_file.py` `_batch_upsert`: `non_pk`가 비어 있으면 `ON CONFLICT (pk) DO NOTHING` 사용. PK만 있고 나머지 컬럼이 없을 때 `DO UPDATE SET` 문법 오류 방지.
- **2-3** `batch_executor_file.py` except 블록: `run_id`와 무관하게 `update_job_status(batch_job_id, "error", ...)` 항상 호출. `create_batch_run` 실패로 run_id가 None이어도 last_run_status가 "running"에 머물지 않도록 복구. `finish_run`·`check_consecutive_failures`는 run_id가 있을 때만 호출.
- **2-4** `batch_executor_file.py`: SHA-256 계산을 `_compute_sha256(file_path, chunk_size=8192)` 청크 읽기로 변경. 대용량 파일 시 메모리 사용 완화.

**미래 파일 필터링:**
- `parser_file.py` `get_pending_files`: 선택 인자 `max_ts=None` 추가. 미지정 시 현재 시각으로 설정해 `ts <= max_ts` 조건으로 미래 타임스탬프 파일 제외. batch_executor 호출부는 변경 없음(기본값으로 동작).

**스킵/에러 파일 관리 (문제 파일 목록·원격 삭제):**
- `folder_adapter_file.py`: `FolderAdapter`에 `delete_file(filename)` 추상 메서드 추가. `SFTPAdapter`는 `sftp.remove(remote)`, `S3Adapter`는 `s3.delete_object(Bucket, Key)` 구현.
- `service_file.py`: `list_skipped_files(batch_job_id, conn=None)` — batch_run_history.file_list에서 status=skipped|error만 추출, 동일 파일명 최신 1건. `delete_remote_files(folder_connection_id, filenames)` — 어댑터로 원격 삭제 후 `{ deleted, failed }` 반환.
- `router_file.py`: `DeleteRemoteFilesBody`(filenames). GET `/jobs/{id}/skipped-files`, POST `/jobs/{id}/skipped-files/delete` 엔드포인트 추가.
- `client.js`: `batchListSkippedFiles(batchJobId)`, `batchDeleteSkippedFiles(batchJobId, filenames)` 추가.
- `SkippedFilesPanelFile.jsx` 신규: 배치 Job별 스킵/에러 파일 목록 테이블, 체크박스 선택 후 원격 삭제, 새로고침·닫기.
- `BatchJobListFile.jsx`: 동작 열에 "문제 파일" 버튼 추가, 클릭 시 해당 Job의 `SkippedFilesPanelFile` 패널 표시.

**변경 파일:** batch_executor_file.py, load_service_file.py, parser_file.py, folder_adapter_file.py, service_file.py, router_file.py, client.js, SkippedFilesPanelFile.jsx(신규), BatchJobListFile.jsx, log.md.

---

## 2026-02-26 ETL2 파일 연결 기능 보강 (09_ETL_SFTP_Connection 설계서 정합성)

**버그/위험 보강:**
- **1-2** `Backend/etl_server2/service_file.py`: `check_consecutive_failures(batch_job_id, threshold=5, conn=None)` 구현. 최근 5회 연속 status='error' 시 batch_jobs.is_active=False, last_error_message 설정, 스케줄러에서 제거. batch_executor_file 예외 블록에서 호출하여 에러 기록 후 연속 실패 시 자동 비활성화.
- **1-3** `Backend/etl_server2/batch_executor_file.py`: `_connect_with_retry(folder_connection_id, retries=3)` 추가. get_folder_adapter 호출을 2초·4초·8초 exponential backoff로 재시도 (§7.4). run_batch_job에서 adapter 획득 시 사용.
- **1-4** `Backend/etl_server2/load_service_file.py`: PostgreSQL 파라미터 한도(65,535) 대비 `MAX_PARAMS=60000`, `_calc_batch_size(num_columns)` 도입. `_batch_insert`/`_batch_upsert`에서 `effective_batch = min(BATCH_SIZE, _calc_batch_size(len(columns)))` 적용하여 컬럼 수가 많을 때 SQL 크기 초과 방지.
- **1-1** `Backend/etl_server2/batch_executor_file.py`: SFTP 대기 로직을 `time.sleep(3)`에서 `_wait_for_stable_size(adapter, filename, checks=3, interval=3)`로 변경 (§7.8). stat()으로 크기 조회 → 3초 간격 재조회, 동일하면 완료(최대 3회). S3 등 sftp 미보유 어댑터는 no-op.

**설계 보강:**
- **2-4** `Backend/etl_server2/scheduler_file.py`: 모듈 레벨 BackgroundScheduler 인스턴스를 제거하고 `_scheduler` + `get_scheduler()` lazy 초기화로 변경. 멀티 워커(gunicorn --workers N) 시 import 시점 중복 인스턴스 방지. `start_scheduler()`에서 `SCHEDULER_ENABLED` 환경변수 지원: `false` 시 스케줄러 기동 생략(단일 프로세스에서만 기동 권장).
- **2-1** `Backend/etl_server2/service_file.py`: 배치 실행 경로에서 커넥션 재사용을 위해 `create_batch_run`, `finish_run`, `update_job_status`, `update_last_processed_ts`, `is_duplicate_checksum`, `check_consecutive_failures`에 선택적 인자 `conn=None` 추가. 호출부에서 conn 전달 시 해당 커넥션 사용 후 close 책임은 호출부. `batch_executor_file.run_batch_job`에서 시스템 DB 커넥션 1개를 열어 위 함수들에 전달하고 finally에서 close하여 대량 파일 시 커넥션 과다 오픈 완화.

**UX/API:**
- **3-1** `Backend/etl_server2/router_file.py`: GET /jobs 응답에 §11.3에 따른 `next_run_time` 추가. `scheduler_file.get_scheduler().get_job(f"batch_{id}")`로 next_run_time 조회 후 ISO 문자열로 직렬화. 프론트 배치 목록 "다음 실행 시각" 표시에 사용 가능.
- **3-2** PK 미설정 경고: `BatchJobListFile.jsx`에 이미 `pk_columns` 비어 있을 때 "PK 미설정: 중복 행 발생 가능" 경고 표시 구현됨. 추가 변경 없음.

**기타:** parser_file.py의 `extract_patterns_from_files`는 이미 구현되어 있음(2-3 확인 완료).

**변경 파일:** service_file.py, batch_executor_file.py, load_service_file.py, scheduler_file.py, router_file.py, log.md.

---

## 2026-02-25 Phase 6 UI 일관성 (09_ETL_SFTP_Connection §7.6, §12)

**Part 1 — UI polish:**
- `BatchJobFormFile.jsx`: PK 컬럼이 비어 있을 때 "PK 미설정: 중복 행 발생 가능" 경고를 `etl-db-form__message etl-db-form__message--warning`으로 PK 입력란 아래 상시 표시.
- `BatchJobListFile.jsx`: last_run_status를 뱃지로 표시 (성공=녹색, 에러=빨강, 실행중=파랑, 대기=회색). `etl.css`에 `.etl-db-form__status-badge`, `.etl-db-form__status--success|--error|--running|--idle` 추가. "다음 예상 실행" 열 추가: last_run_at + interval_minutes 계산, last_run_at 없으면 "-". Job 행에서 pk_columns 비어 있으면 "PK 미설정: 중복 행 발생 가능" 작은 경고 표시.

**Part 2 — Design consistency (minimal unification):**
- 방향: 섹션 제목 계층 통일. 폴더 탭의 "배치 Job" 블록 제목을 `etl-page__section-title`에서 `etl-db-form__heading`으로 변경하여 Storage·DB 탭과 동일한 블록 제목 스타일 적용. 폴더/배치 목록은 테이블 유지, 저장 DB 목록은 conn-list 유지 (정보량에 맞게 그대로 사용).

**변경 파일:** `etl.css`(뱃지·경고 스타일), `BatchJobFormFile.jsx`, `BatchJobListFile.jsx`, `ETLPage.jsx`, `log.md`.

---

## 2026-02-25 Phase 5 Frontend (실행 이력 패널·상세)

**구현 내용 (09_ETL_SFTP_Connection §11.3):**
- `packages/etl2/components/BatchHistoryPanelFile.jsx`: 배치 Job 실행 이력 목록. Props: batchJobId, onClose, onSelectRun(optional). 마운트 시 batchListJobHistory(batchJobId) 호출. 테이블: run_id, started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message, [상세]. [상세] 클릭 시 onSelectRun(run_id) 호출. etl-db-form__table, etl-db-form__table-wrap 사용. 로딩·빈 목록·에러 상태 처리. 한글 파일 상단 주석.
- `packages/etl2/components/BatchHistoryDetailFile.jsx`: 실행 1건 상세. Props: batchJobId, runId, onBack, onClose. batchGetJobHistoryDetail(batchJobId, runId) 호출 후 요약(started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message) 및 file_list 테이블(filename, timestamp, status, 행/삽입·갱신, 에러·사유). [뒤로]/[닫기] 버튼. etl-db-form 클래스 사용. 한글 파일 상단 주석.
- `packages/etl2/ETLPage.jsx`: folder 탭에 실행 이력 모달 연동. state: batchHistoryJobId, batchHistoryRunId. BatchJobListFile에 onOpenHistory 전달 → [이력] 클릭 시 모달 오픈. 모달 제목 "실행 이력", etl-add-file-modal 패턴(backdrop + box, maxWidth 900px). batchHistoryRunId가 null이면 BatchHistoryPanelFile, 설정 시 BatchHistoryDetailFile 표시. onSelectRun으로 상세 전환, onBack으로 목록 복귀.

---

## 2026-02-25 Phase 5 Backend (File checksum duplicate detection §7.7)

**구현 내용 (09_ETL_SFTP_Connection §7.7):**
- `Backend/etl_server2/service_file.py`: `is_duplicate_checksum(batch_job_id, checksum)` 추가. batch_run_history에서 해당 batch_job_id의 file_list(JSONB)에 동일 checksum이 있는지 조회 (jsonb_array_elements + elem->>'checksum'). _get_db(), _schema(), _q() 패턴 사용. True/False 반환.
- `Backend/etl_server2/batch_executor_file.py`: 다운로드 후·read_file 전에 SHA-256 체크섬 계산 (hashlib). `is_duplicate_checksum` 호출 시 True면 file_results에 `{"filename", "status": "skipped", "reason": "duplicate_checksum"}` 추가 후 continue (load·last_processed_ts 갱신 없음). 비중복 시 기존대로 read_file → load_dataframe → update_last_processed_ts, 성공 시 file_results 항목에 `"checksum": checksum` 포함하여 batch_run_history.file_list에 저장. parser_file, load_service_file 미수정.

---

## 2026-02-25 Phase 4 Backend (Batch execution: download → parse → load)

**구현 내용 (09_ETL_SFTP_Connection §4.3, §7.5, §10):**
- `Backend/etl_server2/parser_file.py`: `read_file(local_path, extension, max_rows=None)` 이미 구현됨. csv/xlsx/xls/parquet 지원, CSV는 utf-8/cp949, engine=python·on_bad_lines=skip. parse_filename/get_pending_files/extract_patterns_from_files 미수정.
- `Backend/etl_server2/load_service_file.py`: get_target_connection(storage_connection_id), table_exists, create_table_from_dataframe(df→PG 타입·PK), load_dataframe(테이블 없으면 CREATE 후 INSERT, 있으면 PK upsert 또는 INSERT만). 배치 2000건, column_mapping 지원. etl_server2.service.get_target_db_connection 재사용.
- `Backend/etl_server2/batch_executor_file.py`: 스텁 제거 후 실제 흐름 구현. run_batch_job: get_batch_job → last_run_status=running 시 skip → create_batch_run → get_folder_adapter → list_files → get_pending_files → 없으면 finish_run(skipped) → success. 있으면 get_target_connection → 파일별: SFTP 시 3초 대기 → 임시파일 다운로드 → max_file_size_mb 초과 시 skip → read_file → load_dataframe(column_mapping) → commit → update_last_processed_ts → file_results에 결과 추가. 예외 시 파일별 error 추가 후 계속. finally 임시파일 삭제, target_conn.close(), adapter.close(). finish_run(success/error), update_job_status.
- `Backend/etl_server2/service_file.py`: get_batch_job에 이미 c.protocol 포함되어 있어 executor에서 SFTP 대기 가능.

---

## 2026-02-25 Phase 4 Backend (Real batch execution: download → parse → load)

**구현 내용:**
- `Backend/etl_server2/parser_file.py`: `read_file(local_path, extension, max_rows=None)` 추가. csv/xlsx/xls/parquet 지원. CSV는 utf-8·cp949 폴백, engine=python, on_bad_lines=skip. max_rows 시 nrows 또는 head 적용. `_read_csv_robust` 헬퍼 추가. parse_filename, get_pending_files, extract_patterns_from_files 미수정.
- `Backend/etl_server2/load_service_file.py`: 신규. `get_target_connection(storage_connection_id)` → etl_server2.service.get_target_db_connection, (conn, schema). `table_exists(conn, schema, table_name)`. `create_table_from_dataframe(conn, schema, table_name, df, pk_columns_list)` — dtype→PG(BIGINT/DOUBLE PRECISION/BOOLEAN/TIMESTAMP/TEXT), 컬럼명 정규화, PK 옵션. `load_dataframe(conn, schema, table_name, df, pk_columns_str, column_mapping)` — 테이블 없으면 CREATE 후 INSERT, 있으면 PK 있으면 ON CONFLICT DO UPDATE/없으면 INSERT. 배치 2000건. column_mapping 시 rename/select 및 transform_engine.apply_mapping_type_cast 적용.
- `Backend/etl_server2/batch_executor_file.py`: 스텁 제거, 전체 흐름 구현. run_batch_job: get_batch_job → 중복 실행 방지(last_run_status==running) → create_batch_run → get_folder_adapter → list_files → get_pending_files. pending 없으면 finish_run(skipped, error_message='신규 파일 없음'). get_target_connection, get_etl_limits. 파일별: tempfile 다운로드, SFTP 시 3초 대기, 크기 검사(max_file_size_mb), parser_file.read_file, load_service_file.load_dataframe, commit, update_last_processed_ts, file_results 누적. 예외 시 파일별 error 기록·계속. finally 로컬 파일 삭제·adapter/target_conn close. finish_run(success, file_list), update_job_status(success). 외부 예외 시 finish_run(error), update_job_status(error).
- `Backend/etl_server2/service_file.py`: get_batch_job·list_batch_jobs에 batch_folder_connections JOIN으로 `protocol` 컬럼 추가. executor에서 wait_for_stable(SFTP) 분기용.

---

## 2026-02-25 Phase 3 Backend (Batch Jobs, Scheduler, Run History)

**구현 내용:**
- `Backend/etl_server2/service_file.py`: batch_jobs·batch_run_history 확장.
  - list_batch_jobs(folder_connection_id, is_active), get_batch_job, create_batch_job(interval_minutes 10~1440, file_extensions 기본값), update_batch_job(**kwargs), delete_batch_job.
  - create_batch_run, finish_run, update_job_status, update_last_processed_ts, list_run_history, get_run_detail. 시스템 DB _get_db/_schema/_q 패턴 사용.
- `Backend/etl_server2/scheduler_file.py`: 신규. BackgroundScheduler(ThreadPoolExecutor max_workers=3, coalesce=True, max_instances=1, misfire_grace_time=300). start_scheduler, load_active_batch_jobs, add_job, remove_job, reschedule_job, run_now. batch_executor_file.run_batch_job 연동.
- `Backend/etl_server2/batch_executor_file.py`: 신규(스텁). run_batch_job(batch_job_id): get_batch_job → create_batch_run → update_job_status(running) → finish_run(skipped) → update_job_status(success). Phase 4에서 실제 다운로드·적재 구현 예정.
- `Backend/etl_server2/router_file.py`: 배치 Job API 추가. GET/POST /jobs, PATCH/DELETE /jobs/{id}, POST /jobs/{id}/run-now, POST /jobs/{id}/toggle, GET /jobs/{id}/history, GET /jobs/{id}/history/{run_id}. Pydantic CreateBatchJobBody, UpdateBatchJobBody. 생성/수정/토글 시 스케줄러 add_job·remove_job·reschedule_job 연동.
- `Backend/api_server/main.py`: startup_etl_worker 내 queue_worker 후 scheduler_file.start_scheduler(), scheduler_file.load_active_batch_jobs() try/except 추가.
- `requirements.txt`: apscheduler>=3.10.0 추가.

---

## 2026-02-25 Phase 2 Implementation Verification
### 09_ETL_SFTP_Connection (Batch Sync patterns API and UI)

**Backend:**
- `Backend/etl_server2/parser_file.py`: `parse_filename`, `get_pending_files`, `extract_patterns_from_files` are correctly defined and implement the `_ib_` timestamp pattern.
- `Backend/etl_server2/router_file.py`: `GET /folder-connections/{folder_connection_id}/patterns` endpoint is correctly defined, uses `get_folder_adapter` and `extract_patterns_from_files`, and closes the adapter in `finally`.
**Verdict: All checks passed.**

**Frontend:**
- `shared/api/client.js`: `batchListFolderPatterns(id)` is correctly exported and calls the backend API.
- `packages/etl2/components/PatternSelectModalFile.jsx`: Component exists, accepts required props, uses `batchListFolderPatterns`, and displays the patterns table and direct input.
**Verdict: All checks passed.**

**Consistency:**
- API path in router and client.js match.
- Response shape `{ patterns: [...] }` matches documentation §8.3.
**Verdict: All checks passed.**

**Build/Import:**
- No broken imports or lint errors found in `parser_file.py`, `router_file.py`, or `PatternSelectModalFile.jsx`.
**Verdict: All checks passed.**

**Overall: Phase 2 verification passed.**

---

## 2026-02-25 Phase 3 Frontend (Batch Job UI)

**구현 내용:**
- `shared/api/client.js`: 배치 Job API 8종 추가 (base path `/api/etl2/batch`).
  - `batchListJobs(folderConnectionId, isActive)`, `batchCreateJob(body)`, `batchUpdateJob(id, body)`, `batchDeleteJob(id)`, `batchRunJobNow(id)`, `batchToggleJob(id)`, `batchListJobHistory(id)`, `batchGetJobHistoryDetail(id, runId)`.
- `packages/etl2/components/BatchJobFormFile.jsx`: 배치 Job 등록 폼. 폴더 연결·파일 패턴 선택(PatternSelectModalFile)·저장 DB·job_name·target_table·pk_columns·interval_minutes(10~1440)·is_active. 등록 시 `batchCreateJob` 호출 후 `onSuccess` 콜백.
- `packages/etl2/components/BatchJobListFile.jsx`: 배치 Job 목록 테이블. `batchListJobs()` 조회, refreshKey 반영. 컬럼: job_name, 폴더, file_pattern, 저장 DB, 주기, 상태(활성/비활성), 마지막 상태·시각. 동작: 활성/비활성 토글, 즉시 실행, 이력(optional), 삭제(확인 후).
- `packages/etl2/ETLPage.jsx`: `sourceType === 'folder'` 일 때 "배치 Job" 섹션에 `BatchJobFormFile`, `BatchJobListFile` 렌더. 목록 갱신은 기존 `handleRefresh`/`refreshKey` 사용.

---

## 2026-03-12 New Dashboard 2 Phase 4 (훅·헤더·페이지 뼈대)

**구현 내용 (docs/report/13_New_Dashboard2_Develop_Plan.md §7):**
- **packages/new-dashboard2/utils/dateUtils.js** (신규): getISOWeekNumber, getMonthWeekLabel, toLocalDateString, dateToWeekValue, weekValueToDate. new-dashboard 패키지 import 없이 동일 로직 복사.
- **packages/new-dashboard2/hooks/useNewDash2Data.js** (신규): useNewDash2Data(targetDate, period, activeTab) → { data, loading, error, refresh }. overview → Promise.all(Overview + Trend) 병합, star/frequency/coupon/campaign/store → 각 API 단일 호출. 캐시 키 `${activeTab}-${targetDate}-${period}`, targetDate/period 변경 시 캐시 클리어. API는 @/shared/api/client 사용.
- **packages/new-dashboard2/components/Dash2Header.jsx** (신규): targetDate, onDateChange, period, onPeriodChange, dateRangeActual, onPrev, onNext, onRefresh, loading. 테이블 셀렉트 없음. 좌측 빈 영역, 중앙 ◀+날짜표시+input(date|week|month)+▶+주간 시 N주차 라벨, 우측 period 토글(일간/주간/월간)+새로고침. 클래스 .nd2-header, .nd2-header__period-toggle, .nd2-header__period-btn, .nd2-header__period-btn--active.
- **packages/new-dashboard2/NewDashboard2Page.jsx** (신규): state targetDate(오늘), period('daily'), activeTab('overview'). 탭 6개(종합현황|별 분석|프리퀀시|쿠폰 분석|캠페인 세그먼트|매장 분석). useNewDash2Data 연동, moveDate(delta) 일/주/월 단위 이동, dateRangeActual은 data?.summary?.date_range_actual(overview) 또는 data?.date_range_actual. Dash2Header + .nd2-tab-bar + 탭별 플레이스홀더만 표시(OverviewSection 등 미구현).
- **packages/new-dashboard2/index.js** (신규): export { default } from './NewDashboard2Page'.
- **packages/new-dashboard2/new-dashboard2.css** (신규): .nd2-page, .nd2-tab-bar, .nd2-tab, .nd2-tab--active, .nd2-header 및 period 토글·레이아웃 최소 스타일.
**규칙:** new-dashboard 패키지 import 금지. shared/api/client, new-dashboard2 내부만 사용.

---

## 2026-03-12 New Dashboard 2 Phase 5 (OverviewSection, OverviewTrendChart)

**구현 내용 (docs/report/13_New_Dashboard2_Develop_Plan.md §8.1, §8.2, §9):**
- **packages/new-dashboard2/components/OverviewSection.jsx** (신규): summary(S1), dateRangeActual, period. 주간/월간 시 상단 기간 라벨( getMonthWeekLabel 활용). 8개 KPI 카드 2×4 그리드(.nd2-overview-grid), 카드별 상단 3px 보더 색상(발송요청 #7c5cfc 등). total_sales_cnt 1억 이상 "N억", 미만 toLocaleString+원. 증감률 green ▲ / red ▼ / "—". 4단계 퍼널(발송요청→발송성공→쿠폰발급→주문) FunnelBar 패턴, 가이드(성공률·발급률·주문전환률).
- **packages/new-dashboard2/components/OverviewTrendChart.jsx** (신규): trend({ rows }), period, selectedMetric, onMetricChange, loading. 메트릭 탭 4개(발송요청/발송성공/주문건수/총매출). Recharts LineChart, X축 period별(MM/DD·주차·YYYY-MM), Y축 K 단위, dataKey=selectedMetric. API 호출 없음, 부모가 trend 전달·메트릭 변경 시 재조회.
- **packages/new-dashboard2/NewDashboard2Page.jsx** (수정): overview 탭에 OverviewSection + OverviewTrendChart 배치. overviewTrendMetric 상태(기본 send_request_cnt), overviewTrendData·overviewTrendLoading. 메트릭 변경 시 getNewDash2Trend 호출 후 overviewTrendData 반영. trend prop은 기본 메트릭이면 data?.trend, 그 외 overviewTrendData.
- **packages/new-dashboard2/new-dashboard2.css** (수정): .nd2-overview-section, .nd2-overview-grid, .nd2-kpi-card, .nd2-kpi-card__label/__value/__change(—up/—down), .nd2-funnel, .nd2-funnel-bar*, .nd2-trend-chart, .nd2-trend-chart__tabs/__tab/__loading/__chart. 반응형 1024px 이하 4열→2열.