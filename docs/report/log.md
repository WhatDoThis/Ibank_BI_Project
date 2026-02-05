# 작업 완료 로그 (Task Completion Log)

## 2025-02-02: 대시보드 정렬 기준 UI (멀티 정렬·적용 문구)

### 완료 작업
1. **정렬 기준 행 추가 (DashboardHeader)**
   - 집계 기준 아래에 동일 포맷의 "정렬 기준" 행 추가. 일자·발송수·성공수·오픈수·클릭수 버튼.
   - 클릭 시: 1회=내림차순, 2회=오름차순, 3회=정렬 해제. 먼저 누른 항목이 1순위인 멀티 정렬.
   - 적용된 정렬을 버튼 div 오른쪽에 표시: "1. 일자 - 오름차순 2. 발송수 - 내림차순" 형식.

2. **정렬 로직 (DashboardPage)**
   - sortOrder 상태: `[{ key, order: 'asc'|'desc' }, ...]`. sortAggregatedData(rows, sortOrder)로 정렬 후 sortedAggregatedData 를 AggregatedBarChart·AggregatedDataTable·ChartWidget 에 전달.

3. **스타일 (dashboard.css)**
   - .dashboard-header__sort-row, .dashboard-header__sort-label, .dashboard-header__sort-buttons, .dashboard-header__sort-btn(--desc/--asc), .dashboard-header__sort-applied 추가.

### 비고
- 백엔드 기본 ORDER BY(success_count DESC 등)는 유지. 프론트에서 정렬 기준이 있으면 그 순서로 덮어서 표시.

---

## 2025-02-02: docs/main 문서 분리 — 01_FRONTEND_GUIDE 생성·ADVANCED_FEATURES 통합 후 삭제

### 완료 작업
1. **01_FRONTEND_GUIDE.md 생성**
   - 00_PRD.md·ADVANCED_FEATURES.md 의 프론트 관련 내용을 통합. 참고 포맷: Chart_Gen 02_Frontend_Guide.md (카테고리만 참고, 우리 시스템에 맞게 구성).
   - 개요·접속 경로·기술 스택·아키텍처(디렉토리 구조)·패키지별 구성(report·dashboard·shared)·추가 기능(Claude 해석·페이지네이션)·스타일링·문서 구성 수록. 코드 블록은 최소화하고 구조·역할·동작 위주로 기술.

2. **00_PRD.md 수정**
   - 섹션 4(프론트엔드): 상세 제거, 한 단락 요약 + "상세는 01_FRONTEND_GUIDE.md 참고" 로 정리.
   - 섹션 7(문서 구성): 00_PRD.md, 01_FRONTEND_GUIDE.md 로 갱신. ADVANCED_FEATURES.md 제거.
   - 변경 이력: 문서 분리(프론트 상세 이관·ADVANCED_FEATURES 통합 후 삭제) 항목 추가.

3. **ADVANCED_FEATURES.md 삭제**
   - 내용 전부 01_FRONTEND_GUIDE.md 로 이관 완료 후 삭제.

4. **README.md**
   - 상세 명세 참조: "00_PRD.md, 01_FRONTEND_GUIDE.md" 로 수정.

### 비고
- docs/main: 00_PRD(요약·코드 세부 없음), 01_FRONTEND_GUIDE(프론트 전용 상세).

---

## 2025-02-02: docs/main 문서 정리 — PRD 통합·CURSOR_SPEC 삭제·ADVANCED_FEATURES 갱신

### 완료 작업
1. **PRD.md 유지·검토**
   - CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md 의 유효 내용은 이미 PRD로 통합된 상태로 유지. 한 줄씩 검토하여 현재 시스템과 일치함을 확인.

2. **CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md 삭제**
   - 두 파일 삭제 완료. 요구사항·아키텍처·설정·기능 요약은 docs/main/PRD.md 만 참조.

3. **ADVANCED_FEATURES.md 전면 수정**
   - 기존 HTML/CSS/JavaScript 코드 블록 전부 제거 (과거 바닐라 구현 기준이었음).
   - 현재 구현 기준으로 재작성: 프론트 React(Vite), Claude 해석은 백엔드 `/api/explain-sql` (API 키는 config.backend), 페이지네이션은 COUNT 쿼리 + LIMIT/OFFSET, ReportPage/MainArea·client.js 기준으로 동작·UI 개요만 기술.

4. **README.md 수정**
   - 상세 명세 참조를 "PRD.md, CURSOR_SPEC.md 등" → "PRD.md, ADVANCED_FEATURES.md" 로 변경.
   - 접속 URL 안내: 웹 `http://localhost:8080/ibank-bi/`, 리포트 `/ibank-bi/report`, 대시보드 `/ibank-bi/dashboard` 명시.

### 비고
- docs/main 문서 구성: PRD.md(요구사항·아키텍처·설정), ADVANCED_FEATURES.md(Claude 해석·페이지네이션 등 추가 기능 명세).

---

## 2025-02-02: 대시보드 필수 컬럼 타입 검증·금지 키워드 문맥 검사(CREATE 등 오탐 제거)

### 완료 작업
1. **대시보드: 필수 컬럼에 데이터 타입 검증 추가**
   - **db.py**: `get_table_columns_with_types(table_name)` 추가 — information_schema에서 column_name, data_type 반환.
   - **dashboard_service.py**: `DASHBOARD_REQUIRED_COLUMNS`를 (컬럼명, 허용 data_type 목록) 구조로 변경. `get_aggregatable_tables()`는 `get_table_columns_with_types()`로 컬럼·타입 조회 후, 이름 존재 여부와 실제 타입이 허용 타입 목록에 있는지 검사. `get_required_columns()`는 `[{ name, allowed_types }, ...]` 형태로 반환.
   - **DashboardHeader.jsx**: info 모달 오픈 시 `getDashboardRequiredColumns()` 호출하여 필수 컬럼 목록 로드, 컬럼명과 허용 타입(예: `delivery_date (date | timestamp without time zone)`)을 함께 표시. 안내 문구에 "이름과 타입 모두 일치" 필요하다고 명시.
   - **dashboard.css**: `.dashboard-modal__column-type` 스타일 추가(타입 표시용).

2. **리포트: 금지 키워드 검사를 문맥 기반으로 통일 (CREATE·UPDATE 등 오탐 제거)**
   - **routes.py** `_contains_dangerous_sql()`: 기존 `\bCREATE(?!\w)\s+\bTABLE(?!\w)` 등 전체 검색 방식을 제거. **세미콜론으로 분리한 각 문장**만 검사하여, **문장 시작**에서만 위험 구문(DROP TABLE, CREATE TABLE, DELETE FROM, UPDATE 등)으로 시작할 때만 금지 처리.
   - 이에 따라 `SELECT created_at ...`, `SELECT * FROM some_table`, 문자열 리터럴 내 'create table' 등은 더 이상 "금지된 키워드"로 잡히지 않음. 메시지 출처는 백엔드 `/api/execute-query` 등 400 응답의 `error` 필드이며, 프론트는 해당 메시지를 toast(우하단)에 표시.

### 검수 결과
- Lint: db.py, dashboard_service.py, routes.py, DashboardHeader.jsx, dashboard.css 오류 없음.

### 비고
- 백엔드 재시작 후 대시보드 테이블 목록·필수 컬럼 API 동작 확인 권장. 리포트에서 created_at/updated_at/some_table 등 사용 시 금지 키워드 오탐 없음 확인.

---

## 2025-02-02: 대시보드 테이블 필터 강화·금지 키워드(updated_at) 오탐 수정·base 경로 확인

### 완료 작업
1. **대시보드: 필수 컬럼 없는 테이블 제외 로직 강화 (dashboard_service.py)**
   - `get_aggregatable_tables()`: 컬럼명을 `str(c).strip().lower()`로 정규화, 필수 컬럼 개수 미달(`len(col_set) < required_count`)이거나 `required.issubset(col_set)`이 아니면 해당 테이블 제외.
   - 필수 컬럼을 모두 가진 테이블만 대시보드 테이블 셀렉트에 노출되도록 명시적 검사 유지.

2. **리포트: 금지 키워드 검사에서 updated_at 오탐 방지 (routes.py)**
   - `_contains_dangerous_sql()`: UPDATE 검사를 `\bUPDATE\s`에서 **문맥 기반**으로 변경.
   - **쿼리 맨 앞** 또는 **세미콜론 직후**에 오는 `UPDATE ` 만 금지하도록 정규식 적용: `^\s*UPDATE\s`, `\s;\s*UPDATE\s`.
   - `SELECT ... updated_at ...` 등 컬럼명 `updated_at`은 매칭되지 않아 "금지된 키워드: UPDATE" 알림이 더 이상 발생하지 않음.

3. **base 경로 확인**
   - Vite `base: '/ibank-bi/'`, static_server에서 `/ibank-bi` 요청을 dist 기준으로 서빙하도록 이미 적용됨.
   - 접속 URL: `http://127.0.0.1:8080/ibank-bi/` (report/report 중복 없음).

### 검수 결과
- Lint: routes.py, dashboard_service.py 오류 없음.

### 비고
- 백엔드 수정 반영을 위해 API 서버 재시작 필요. 대시보드 테이블 목록 갱신을 위해 프론트 재빌드 후 확인 권장.

---

## 2025-02-02: 대시보드 Info 버튼 노출·집계 테이블 필터 검수·리포트 헤더 제거·버튼 이동

### 완료 작업
1. **대시보드 Info 버튼 노출**
   - 테이블 셀렉트와 같은 줄이 아닌, **테이블 div 아래 한 줄**로 배치. `dashboard-header__table-cell`을 flex column으로 변경, `dashboard-header__table-input-row`(라벨+셀렉트) 아래에 `dashboard-header__info-btn-wrap`(info 버튼) 배치.

2. **집계 가능 테이블 필터 검수**
   - Backend `get_aggregatable_tables()`: 컬럼명 비교 시 **대소문자 무시** (`c.lower()`, `required.issubset(col_set)`) 적용. DB가 대문자/혼합 컬럼명을 주어도 집계 가능 테이블이 누락되지 않도록 함.
   - 서버에 최신 코드 반영 후 `report-api` 재시작 시 셀렉트에는 필수 컬럼을 가진 테이블만 노출됨.

3. **리포트 페이지**
   - **header class div 삭제**: `Header` 컴포넌트를 ReportPage에서 제거(렌더링·import 제거). 제목·초기화·실행이 있던 상단 헤더 영역 제거.
   - **nav 상하 폭**: App.jsx `app-nav` padding을 `8px 16px` → **`14px 16px`** 로 변경.
   - **초기화·실행 버튼**: filter-order-bar **우측 상단**으로 이동. MainArea에 `onClearAll` prop 추가, `filter-order-bar__actions-row`(우측 정렬) 안에 `filter-order-bar__actions`(초기화·실행 버튼) 배치. report.css에 `.filter-order-bar__actions-row`, `.btn-report-secondary` 스타일 추가.

### 비고
- 대시보드에서 여전히 모든 테이블이 보이면, 배포 서버에서 `report-api` 재시작 및 프론트 `npm run build` 후 `report-front` 재시작 필요.

---

## 2025-02-02: 대시보드 집계 가능 테이블만 셀렉트·info 모달·class 기반 CSS

### 완료 작업
1. **Backend: 집계 가능 테이블만 셀렉트에 노출**
   - `db.get_table_columns(table_name)`: information_schema 기반 컬럼명 목록 반환.
   - `dashboard_service.DASHBOARD_REQUIRED_COLUMNS`: delivery_date, campaign_id, campaign_label, workflow_id, workflow_label, delivery_channel, total_count, success_count, failed_count, open_count, click_count.
   - `get_aggregatable_tables()`: allowed_tables 중 위 필수 컬럼을 모두 가진 테이블만 반환.
   - `GET /api/dashboard/tables`: get_aggregatable_tables() 사용으로 변경. `GET /api/dashboard/required-columns`: 필수 컬럼 목록 반환(안내용).

2. **Frontend: 테이블 div 아래 info 버튼 + 모달**
   - DashboardHeader에 "info" 버튼 추가(테이블 셀렉트 옆). 클릭 시 모달 오픈.
   - 모달: "대시보드 조회를 위한 테이블 필수 컬럼" 제목, getDashboardRequiredColumns()로 목록 로드, 닫기 버튼·오버레이 클릭 시 닫힘.

3. **전체 div 기능별 class 부여 및 CSS 클래스 기반 적용**
   - DashboardPage: dashboard-page, dashboard-page__header-wrap, __error, __empty, __content.
   - DashboardHeader: dashboard-header, __table-row, __table-cell, __table-label, __table-select-wrap, dashboard-table-select, __info-btn-wrap, dashboard-info-btn, __date-cell, __date-label, __date-inputs, __load-btn, __group-by-row, __group-by-label, __group-by-checkboxes, __checkbox-label, __filter-row, __filter-cell, __filter-label, dashboard-modal-overlay, dashboard-modal, dashboard-modal__title/__body/__list/__close 등.
   - KPICards: kpi-cards-section, kpi-cards__title, kpi-grid, kpi-card, kpi-card__label/__value/__unit.
   - ChannelDonutCharts: channel-donut-charts__title, __row, donut-block__title, __total.
   - AggregatedBarChart: aggregated-bar-chart-section, __title, __chart-wrap.
   - AggregatedDataTable: aggregated-data-table-section, __toolbar, __title, __search-wrap, __search-input, __pagination-info, __table-wrap, __table, __thead, __tbody, __pagination, __pagination-btn, __pagination-label.
   - ChartWidget: chart-widget, chart-widget__header, __title, __add-btn, __desc, __grid.
   - dashboard.css: 위 클래스 기준으로 스타일 정리(인라인 제거 가능한 부분 class로 이전).

### 검수 결과
- Lint: Backend db/dashboard_service/routes, Frontend DashboardHeader/DashboardPage/ KPICards/ChannelDonutCharts/AggregatedBarChart/AggregatedDataTable/ChartWidget 대상 오류 없음.

### 비고
- 집계 불가 테이블은 셀렉트에 아예 노출되지 않음. 사용자는 info 모달로 필수 컬럼을 확인할 수 있음.

---

## 2025-02-02: Linux api_base_url 안내 및 Git 푸시

### 완료 작업
1. **DEPLOY_SERVER.md §6 추가**
   - Linux 서버에서 `frontend.api_base_url` 은 **백엔드 경로**여야 함을 명시.
   - 잘못된 예: `https://도메인/report` → API 요청이 프론트(3500)로 가서 실패.
   - 올바른 예: `https://도메인/report_api` → API 요청이 백엔드(8500)로 전달되어 정상 동작.
   - Nginx `location /report/`(프론트) vs `location /report_api/`(API) 구조에 따른 설정 가이드.

2. **기타 검수**
   - Backend api_server, Frontend react-app/src, static_server, Env: Lint 오류 없음.
   - 로컬 config.json은 개발용(8080, localhost:5001) 유지; Linux 서버 쪽 config는 서버에서 `report_api` 로 수정 후 재시작 필요.

3. **Git**
   - 변경사항 커밋 및 원격 푸시.

### 비고
- 리눅스에 `api_base_url: https://ajo.sdev-ibank.co.kr/report` 로 되어 있으면 `/report` 가 프론트 경로이므로 API 호출이 실패함. 서버 config.json 에서 `https://ajo.sdev-ibank.co.kr/report_api` 로 변경 필요.

---

## 2025-02-02: 로컬 쿼리 빌더( index 1 / app 1 / main 1 ) → React Report 적용

### 완료 작업
1. **Report CSS (report.css)**
   - `main 1.css` 및 `app 1.js` 인라인 스타일을 `Frontend/react-app/src/packages/report/report.css`로 통합.
   - 기준축/피벗/HAVING chip, 그리드 헤더(기준축 토글·제거·집계·날짜단위), 필터 문장형·드릴다운 스타일 반영.
   - ReportPage.jsx에서 `import './report.css'` 추가.

2. **상수·헬퍼 (report/utils)**
   - `constants.js`: OPERATOR_LABELS, AGG_FUNCTIONS export.
   - `helpers.js`: isDateColumn, isDateType, isDateTimeType, escapeSqlString, escapeLikePattern, formatWhereValue, isNumericValue export.

3. **sqlBuilder 확장**
   - `generateSQL` 8번째 인자 options: groupBy, dateGranularity, havings, pivot, pivotRowAggs 지원.
   - GROUP BY, 날짜 단위(TO_CHAR), 컬럼별 aggFunc, HAVING, 피벗(CASE WHEN) 모드 SELECT/COUNT 쿼리 생성.
   - `generateCountSQL` 5번째 인자 options 동일 지원 (GROUP BY 시 서브쿼리).
   - `generateDistinctPivotSQL`: 피벗 축 값 조회용 DISTINCT 쿼리 생성.

4. **ReportPage 상태·콜백**
   - 상태: groupBy, pivot, pivotRowAggs, dateGranularity, havings 추가.
   - gridColumns에 aggFunc 필드; syncAggFuncs, addColumn 시 groupBy 반영.
   - removeColumn: 해당 컬럼/테이블 제거 시 groupBy/havings/pivot/pivotRowAggs/orderBy 정리 및 orderBy columnIndex 재계산.
   - toggleGroupBy, setDateGranularityFor, changeAggFuncFor, addHaving, removeHaving, setPivotFromValues, fetchAndSetPivot, removePivotCallback, addPivotAgg, removePivotAgg 추가.
   - clearAll에 groupBy/pivot/pivotRowAggs/dateGranularity/havings 초기화 추가.
   - runExecuteQuery에서 generateSQL/generateCountSQL에 options 전달.

5. **MainArea UI**
   - filter-order-bar: 기준축(groupby-row), 피벗축(pivot-row), 행별집계(pivot-agg-row), HAVING(having-row), 조건(where-row), 정렬(order-row) 행 추가.
   - Chip 및 버튼: + 피벗 추가, + 집계 추가, + HAVING 추가, + 조건 추가, + 정렬 추가. OPERATOR_LABELS로 조건/HAVING 연산자 한글 표시.
   - 그리드 헤더: 기준축 토글(⊞/기준축 ×), 컬럼 제거(×), 날짜 단위(연/연월/연월일), 집계 드롭다운(AGG_FUNCTIONS, 기준축 활성 시).
   - 피벗 모드: groupBy + pivotRowAggs + pivot.values + 전체 컬럼 테이블 렌더링.
   - HAVING 추가 시 컬럼 선택 메뉴 → 연산자/값 팝업(필터 문장형 스타일).

### 검수 결과
- Lint: ReportPage.jsx, MainArea.jsx, sqlBuilder.js, constants.js, helpers.js 오류 없음.
- `npm run build` 성공.

### 비고
- 기존 React Report(addedTables, gridColumns, filters, orderBy) 호환 유지. orderBy는 columnIndex 기반으로 유지하고, sqlBuilder에서 집계 시 agg 표현식으로 ORDER BY 생성.

---

## 2025-02-02: 차트 생성 Dimension을 집계 체크박스 기준으로 연동

### 완료 작업
1. **Dimension 옵션 = 집계 체크박스 기준**
   - ChartWidget에 `groupBy`(filters.group_by) 전달. `getAvailableDimensions(groupBy)`로 사용 가능 Dimension 목록 계산(일자→캠페인→워크플로우→채널 순, 체크된 것만). 하나도 없으면 전체 노출.

2. **차트 생성 시 기본 Dimension**
   - 새 위젯 추가 시 `xKey` = availableDimensions[0] (집계에서 첫 번째로 체크된 항목). 예: 캠페인만 체크 시 기본 Dimension = 캠페인.

3. **두 개 이상 체크 시**
   - Dimension 드롭다운에 체크된 항목만 표시되어 그중 선택 가능. 선택한 Dimension에 맞게 X축·차트 데이터 표시.

4. **집계 변경 시 위젯 동기화**
   - useEffect로 groupBy/availableDimensions 변경 시, 위젯의 xKey가 목록에 없으면 첫 번째 Dimension으로 자동 변경.

### 검수 결과
- Lint: ChartWidget.jsx, DashboardPage.jsx 오류 없음.

### 비고
- 일자만 체크 시 Dimension 기본값 = 일자, 캠페인만 체크 시 = 캠페인 → X축 레이블이 집계 데이터와 일치하여 이상한 값 방지.

---

## 2025-02-02: 대시보드 최초 진입 시 집계 기준 일자별만 적용

### 완료 작업
1. **집계 체크박스 초기값 변경 (DashboardPage.jsx)**
   - 기존 defaultGroupBy: campaign true, date true, workflow false, channel true
   - 변경: **일자별만** 체크 — campaign false, date true, workflow false, channel false
   - 세션 유지 없이 페이지 로드 시 항상 이 초기값으로 진입.

### 비고
- 대시보드는 sessionStorage/localStorage를 사용하지 않으므로, 새로고침·재진입 시마다 이 초기값이 적용됨.

---

## 2025-02-02: 기준별 발송현황 차트 상위 10건 정렬 기준 명확화

### 완료 작업
1. **정렬 기준 통일: 발송성공 수(success_count)**
   - 기존: group_by.date 여부에 따라 delivery_date DESC 또는 total_count DESC만 적용되어 "상위 10건" 의미가 불명확했음.
   - 변경: 항상 **발송성공 수(success_count) DESC**를 1차 정렬로 적용. 일자 그룹 시 2차로 delivery_date DESC 추가하여 동일 성공 수 내에서는 최신 일자 순.

2. **Backend (dashboard_service.py)**
   - ORDER BY를 `success_count DESC` 고정 후, `group_by.date`일 때만 `delivery_date DESC` 추가.
   - 주석: "기준별 발송현황 차트 상위 N건: 발송성공 수(success_count) 기준으로 통일".

3. **Frontend (AggregatedBarChart.jsx)**
   - 차트 제목: "기준별 발송 현황 (상위 10건)" → **"기준별 발송 현황 (발송성공 수 상위 10건)"**으로 변경하여 사용자에게 정렬 기준 명시.
   - 데이터 표시 전 `[...data].sort((a,b) => (b.success_count ?? 0) - (a.success_count ?? 0))` 적용 후 slice(0, TOP_N)으로, 백엔드와 동일 기준을 프론트에서도 보장.

### 검수 결과
- Lint: AggregatedBarChart.jsx, dashboard_service.py 오류 없음.

### 비고
- 발송요청 수(total_count)가 아닌 발송성공 수(success_count)를 기준으로 한 이유: "발송 현황"에서 실제 전달된 양을 기준으로 상위를 보여주는 것이 더 직관적이라 판단.

---

## 2025-02-02: Git 커밋 및 푸시 (전체 변경사항 반영)

### 완료 작업
1. **스테이징**
   - `git add -A`로 수정·삭제·추가된 모든 파일 스테이징
   - Backend: dashboard_service.py 신규, main.py·routes.py 수정
   - Frontend: packages/dashboard·packages/report·shared 이동/추가, 삭제된 src/components·api·config·utils 반영
   - 기타: run.py, requirements.txt, static_server/main.py, vite.config.js, docs/report/log.md

2. **커밋**
   - 커밋 해시: d685c25
   - 메시지: feat: React 대시보드 통합 및 UI/UX 개선 (Backend 대시보드 API, Frontend 패키지 구조·대시보드·필터·페이징·검색·ChartWidget·Report 헤더 정리, static_server 포트 대체, run.py 빌드 연동)

3. **푸시**
   - `git push origin main` 성공
   - 원격: https://github.com/GwanHong/IBANK_TEST_PROJECT_001.git (3204bc1..d685c25 main -> main)

### 검수 결과
- 32 files changed, 2984 insertions(+), 371 deletions(-)
- rename/delete/add 모두 반영됨, 누락 없음

### 비고
- 한글 커밋 메시지가 터미널 출력에서 깨져 보일 수 있으나, 원격 저장소에는 UTF-8로 저장됨.

---

## 2025-02-02: 대시보드 폰트·X축 라벨·필터 연동·테이블 페이징·검색

### 완료 작업
1. **KPI 이하 폰트 2pt 증가**
   - KPICards: 제목 17px, 라벨 14px, 숫자 24px/15px
   - ChannelDonutCharts: 제목 16px, 범례 14px, 합계 13px
   - AggregatedBarChart: 제목 17px, 축/툴팁/범례 13~14px
   - AggregatedDataTable: 제목 17px, 테이블 14px, 셀 패딩 10px
   - ChartWidget: 제목 16~17px, 셀렉트/버튼 14~15px

2. **기준별 발송현황 X축: groupBy 전체 조합으로 중복 없이 라벨**
   - AggregatedBarChart: getXKey 단일 키 제거, getCompositeXLabel(row, groupBy) 추가
   - groupBy에 적용된 컬럼만 순서대로(일자→캠페인→워크플로우→채널) 조합해 "일자 / 채널" 등 고유 라벨 생성
   - 일자별+채널별 선택 시 "2026-02-04 / Email", "2026-02-04 / SMS" 형태로 X축에 중복 없이 표시

3. **필터 옵션 연동 (선택된 컬럼에 따라 다른 옵션만 표시)**
   - Backend: get_filter_options(table_id, campaign_ids, workflow_ids, channels) 추가, _build_where_and_params로 캠페인/워크플로우/채널 쿼리별 WHERE 적용(캠페인 목록은 워크플로우·채널 기준, 워크플로우는 캠페인·채널 기준, 채널은 캠페인·워크플로우 기준)
   - routes: GET filter-options 쿼리 파라미터 campaign_ids, workflow_ids, channels 파싱 후 전달
   - Frontend: getDashboardFilterOptions(tableId, filters) 호출 시 선택값 쿼리스트링으로 전달
   - DashboardPage: tableId 및 filters.campaign_ids/workflow_ids/channels 변경 시 필터 옵션 재조회, 옵션 목록에 없는 선택값은 setFilters로 제거(루프 방지 위해 길이 변경 시에만 setFilters)

4. **집계 데이터 테이블: 50건 페이징 + 테이블 내 검색**
   - PAGE_SIZE 50, page state, filteredData(useMemo로 검색어 필터), pageData = filteredData.slice(startIdx, startIdx+PAGE_SIZE)
   - 검색: rowMatchesFilter(row, filterText, groupBy)로 캠페인/일자/워크플로우/채널/숫자 컬럼 텍스트 매칭(해당 테이블에서만 적용, 다른 집계에는 미적용)
   - 상단에 "테이블 내 검색" 입력창, "N건 중 start-end (페이지 p/total)" 표시, 이전/다음 버튼
   - data.length 또는 groupBy 변경 시 page 1로 리셋

### 검수 결과
- Lint: AggregatedBarChart, AggregatedDataTable, DashboardPage, ChartWidget, KPICards, ChannelDonutCharts 대상 오류 없음
- Backend: dashboard_service get_filter_options, routes _parse_int_list 추가

### 비고
- 필터 연동으로 캠페인 C001 선택 시 워크플로우는 C001에 존재하는 것만 노출되어 "데이터가 없다" 조합 방지.

---

## 2025-02-02: 대시보드 스크롤·기본 일자·차트 위젯

### 완료 작업
1. **대시보드 스크롤**
   - App.jsx: 레이아웃을 flex 컨테이너(height 100vh)로 감싸고, nav는 flexShrink 0, main은 flex 1 + overflowY auto + minHeight 0으로 설정
   - 아래로 내려갈수록 스크롤 생성되어 전체 콘텐츠 확인 가능

2. **기본 일자**
   - DashboardPage getDefaultDateRange(): 시작일·종료일 모두 오늘 날짜로 반환하도록 변경 (기간이 아닌 최신일=오늘 기본)

3. **나만의 차트 위젯 (ChartWidget.jsx)**
   - 집계 데이터(aggregated_data) 기반으로 사용자가 차트를 추가·삭제·설정
   - X축: 일자·캠페인·워크플로우·채널 등 어떤 데이터 타입이든 선택 가능
   - Y축: 실수형만(발송요청·발송성공·오픈·클릭·성공률·오픈률·클릭률 등)
   - 차트 유형: 막대(bar)·선형(line)·영역(area) 선택, recharts BarChart/LineChart/AreaChart 사용
   - 위젯별 X/Y/차트유형 셀렉트 및 삭제 버튼, "차트 추가"로 위젯 추가
   - DashboardPage 하단에 ChartWidget 섹션 배치, chartWidgets state로 관리

### 검수 결과
- Lint: App.jsx, DashboardPage.jsx, ChartWidget.jsx 대상 오류 없음

### 비고
- 기존 KPI·채널 도넛·기준별 막대·집계 테이블은 그대로 두고, 가장 아래에 위젯 영역을 추가해 원하는 차트를 꾸며나가는 구조.

---

## 2025-02-02: 대시보드 UI 디자인 개선 (필터·KPI·차트 레이아웃)

### 완료 작업
1. **헤더 필터 UI 현대화 (DashboardHeader.jsx)**
   - 캠페인·워크플로우·채널 셀렉트 박스: 3열 그리드(1fr 1fr 1fr), minWidth 260px, width 100%로 텍스트 잘림 방지
   - 테이블/기간/조회: 패딩·폰트·버튼 스타일 정리, border-radius 8~10px, box-shadow 적용
   - 집계 기준 체크박스: 2행에 배치(테이블 라인과 컬럼 선택 라인 사이), width 100%, justifyContent flex-start로 좌측 정렬
   - 900px 이하에서 필터 3열 → 1열로 반응형 전환

2. **KPI 영역 전체 폭 사용 (KPICards.jsx + dashboard.css)**
   - 섹션에 kpi-cards-section, 그리드에 kpi-grid 클래스 적용
   - grid-template-columns: repeat(6, 1fr)로 6개 카드가 화면 좌우 꽉 채움
   - 1200px 이하 3열, 768px 이하 2열 미디어 쿼리

3. **채널 도넛 차트·막대 차트 잘림 방지**
   - ChannelDonutCharts: donut-row 그리드(auto-fit, minmax(320px,1fr)), donut-block minWidth 0, ResponsiveContainer height 240
   - dashboard.css: channel-donut-charts-section, aggregated-bar-chart에 width 100%, overflow visible

4. **대시보드 전용 스타일 (dashboard.css)**
   - .dashboard-page, .dashboard-header 전체 폭
   - 필터 셀렉트 클래스별 minWidth 260px, box-sizing border-box
   - DashboardPage.jsx에 dashboard.css import, 루트 div에 width/maxWidth 100%, boxSizing border-box

### 검수 결과
- Lint: DashboardHeader, KPICards, ChannelDonutCharts, DashboardPage 대상 오류 없음
- 집계 체크박스 해제 시 해당 셀렉트 비활성화·필터 초기화 로직은 기존 유지

### 비고
- 상단 필터는 3행 구조 유지(테이블 라인 → 집계 기준 라인 → 컬럼 선택 라인). 집계 기준은 2행에 좌측 정렬로 “테이블과 컬럼 선택 사이”에 명확히 배치.

---

## 2025-02-02: PRD 작성 및 아키텍처 재구성

### 완료 작업
1. **PRD 문서 작성**
   - docs/report/01_PRD.md 생성 (docs/main 기반)
   - 기본 아키텍처: Project / Frontend, Backend, Env 패키지, Env/config config.json (backend{}, frontend{})

2. **패키지 폴더 및 Env config**
   - Frontend/, Backend/, Env/ 패키지 생성
   - Env/config/config.json: backend (api_port, db_*, allowed_tables, claude_* 등), frontend (static_port, main_page, api_base_url)
   - Env/config/loader.py: config.json 로드 후 config.backend / config.frontend attribute 접근

3. **Backend api_server 분리 및 Env 연동**
   - Backend/api_server/main.py: Flask 앱, CORS, 라우트 등록, config.backend 로 host/port
   - Backend/api_server/db.py: get_db_connection, format_value, validate_*, config.backend 사용
   - Backend/api_server/routes.py: health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats
   - 각 모듈에서 Env config import 후 config.backend.xxx 사용

4. **Frontend static_server 및 HTML/CSS/JS 분리**
   - Frontend/static_server/main.py: config.frontend.static_port, main_page, DIR=Frontend 패키지 디렉터리
   - Frontend/index.html: 템플릿(구조만), link href="static/css/main.css", script src="static/js/app.js"
   - Frontend/static/css/main.css: 기존 인라인 스타일 분리
   - Frontend/static/js/app.js: 기존 인라인 스크립트 분리, API_BASE_URL은 window.APP_CONFIG?.apiBaseUrl 또는 기본값

5. **실행 스크립트**
   - start.bat: 프로젝트 루트에서 `python run.py back`, `python run.py front` 실행 (통합 진입점 run.py)

### 검수 결과
- Env config 로드 정상 (backend. api_port 5001, frontend.static_port 8080)
- Frontend serve: DIR=Frontend, index.html / static/css/main.css / static/js/app.js 존재 확인
- Lint: Backend, Env, Frontend static_server 대상 오류 없음

### 비고
- 루트 run.py는 API·웹 통합 진입점 (python run.py back | front). 실제 앱·라우트·DB는 Backend/api_server/, 정적 서빙은 Frontend/static_server/ 에만 있음.
- Backend 실행 시 Flask 등 의존성은 `pip install -r requirements.txt` 필요.

---

## 2025-02-02: 가상환경 설치 및 실행 테스트

### 순차 테스트 과정
1. **Python 가상환경 생성**  
   - `python -m venv .venv` (프로젝트 루트에 .venv 생성)

2. **의존성 설치**  
   - `.venv\Scripts\Activate.ps1` 후 `pip install -r requirements.txt`  
   - flask, flask-cors, psycopg2-binary, python-dotenv, requests 설치 완료

3. **Backend API 서버 실행**  
   - `python run.py back` (백그라운드, Backend.api_server.main 실행)  
   - 포트 5001 리스닝 확인  
   - `/health` 호출 시 DB 미설정으로 `unhealthy` 반환 (예상 동작)

4. **Frontend 웹 서버 실행**  
   - `python run.py front` (백그라운드, Frontend.static_server.main 실행)  
   - 포트 8080 리스닝 확인  
   - `http://localhost:8080/` 요청 시 Frontend/index.html 정상 응답 확인

5. **start.bat 수정**  
   - 새 창에서 `.venv\Scripts\activate` 후 API/웹 서버 실행하도록 변경

### 검증 결과
- 가상환경(.venv) 생성 및 requirements.txt 설치 성공
- API 서버(5001), 웹 서버(8080) 정상 기동
- 브라우저에서 **http://localhost:8080** 접속 시 쿼리 빌더 화면 표시 가능 (DB 설정 시 테이블 로드 등 API 연동 정상 동작)

---

## 2025-02-02: config.json 적용 설정 점검 및 로딩 정리

### 완료 작업
1. **Frontend static_server (main.py)**
   - 서빙 디렉터리를 config.frontend.static_dir 기준으로 변경: `DIR = project_root / static_dir` (기본값 'Frontend')
   - config.frontend.api_base_url 을 프론트에 주입하기 위해 `/api-config.js` 동적 응답 추가: `window.APP_CONFIG = { apiBaseUrl }` 반환

2. **Frontend index.html**
   - `api-config.js` 스크립트를 app.js 이전에 로드하여, config.json의 frontend.api_base_url 이 앱에서 사용되도록 함

3. **config.json 적용 현황**
   - backend: api_host, api_port → main.py / db_* → db.py / allowed_tables, table_schema → db.py / query_timeout_seconds, claude_api_key, claude_api_url → routes.py
   - frontend: static_port, main_page, static_dir, api_base_url → main.py (api_base_url 은 api-config.js 로 주입)

### 검수 결과
- Env/config/loader.py: project_root 기준 config.json 탐색 유지, 수정 없음
- Backend db/main/routes: 기존 config.backend 사용 유지
- Lint: Frontend/static_server/main.py 오류 없음

---

## 2025-02-02: api_server.py 배치 및 Backend 단일 구현 정리

### 완료 작업
1. **루트 run.py 배치 (구 api_server.py → run.py 로 변경)**
   - 위치: 프로젝트 루트 (최적). `python run.py` 한 줄로 실행 가능.
   - 역할: Backend 진입점(launcher)만 담당. sys.path에 프로젝트 루트 추가 후 runpy.run_path(Backend/api_server/main.py) 로 Backend 실행. 실제 앱·라우트·DB 로직 없음.

2. **연결 점검 (한 줄씩)**
   - run.py: sys.path 삽입 → runpy.run_path(Backend/api_server/main.py) → main 의 `if __name__ == '__main__'` 블록 실행.
   - Backend.api_server.main: Env config, db, routes import → register_routes(app) → host/port는 config.backend → app.run().
   - Backend.api_server.db: Env config 로드, get_db_config/get_allowed_tables/get_table_schema, get_db_connection, format_value, validate_table_name/validate_column_name.
   - Backend.api_server.routes: register_routes(app) 내부에서 db 사용, config.backend (query_timeout_seconds, claude_api_key, claude_api_url) 사용. 엔드포인트: /health, /api/list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats.

3. **Backend 하위 겹침 정리**
   - Backend/api_server/ 에만 구현 존재. main.py(Flask+CORS+/, /api+에러핸들러), db.py(DB+검증), routes.py(API 라우트). 겹치는 코드 없음. 루트 run.py는 호출만 담당.

4. **start.bat**
   - API 서버: `python run.py back`, 웹 서버: `python run.py front` 로 통일.

### 검수 결과
- `python run.py back` 실행 시 Backend.api_server.main 이 __main__ 으로 실행되어 동일 동작.
- Backend 내부: main → db, routes; routes → db, config. 단일 구현, 중복 없음.

---

## 2025-02-02: api_server.py → run.py 변경 및 의존 코드 수정

### 완료 작업
1. **루트 진입점 파일명 변경**
   - api_server.py 삭제, run.py 생성 (동일 로직: sys.path + runpy.run_path(Backend/api_server/main.py)).

2. **run.py 의존 코드 점검 및 수정**
   - start.bat: `python api_server.py` → `python run.py`
   - docs/report/log.md: 루트 진입점 관련 문구 api_server.py → run.py
   - docs/README.md: 실행 예시·파일 구조·트러블슈팅에서 api_server.py → run.py
   - docs/main/CURSOR_SPEC.md: api_server.py → run.py
   - README.md: 실행 예시·프로젝트 구조에서 api_server.py → run.py, 포트 5000 → 5001 안내 보강

### 검수 결과
- Backend/api_server/ 패키지명·모듈명은 유지 (Python 패키지 경로 변경 없음).
- run.py 실행 시 동작은 기존과 동일.

---

## 2025-02-02: serve.py 용도 정의·위치 검증 및 Frontend static_server 정리

### 용도 정의
- **루트 serve.py**: (이후 run.py 통합으로 제거됨) 프론트엔드 정적 서버 루트 진입점이었음.
- **Frontend/static_server/main.py**: **정적 HTTP 서버 진입점**. Env config.frontend(static_port, main_page, static_dir, api_base_url) 사용, Frontend 디렉터리 서빙, /api-config.js 동적 응답, / → main_page, favicon 204.

### 위치 검증
- **Frontend/static_server/main.py**: Frontend 패키지 내 static_server 에 두는 것이 적절. 서빙 대상(Frontend/index.html, static/)과 같은 패키지 하위에 있음. 이동 불필요.

### 완료 작업 (당시)
1. 루트 serve.py를 진입점으로 변경 후, run.py 통합 시 제거.
2. Frontend/static_server/main.py: api-config.js 응답 본문 생성 로직을 `_build_api_config_js(api_base_url)` 함수로 분리.

---

## 2025-02-02: run.py 통합 진입점 (api + serve)

### 완료 작업
1. **run.py와 serve.py를 하나로 통합**
   - run.py: 서브커맨드 `back` | `front` 지원. `python run.py` → 사용법 출력, `python run.py back` → Backend 실행, `python run.py front` → Frontend/static_server/main.py 실행.
   - (구 serve.py → main.py 로 파일명 변경됨.)

2. **start.bat**
   - `python run.py` → `python run.py back`, `python serve.py` → `python run.py front` 로 변경.

3. **진입점 패키지 미도입**
   - 진입점이 api·serve 두 가지뿐이고, 한 파일(run.py)로 충분하므로 별도 패키지(entry/ 등)는 두지 않음. 추후 서브커맨드가 많아지면 `python -m entry api|serve` 형태의 패키지로 분리 검토 가능.

---

## 2025-02-02: React 전환 Phase 1 — React 프로젝트 초기화 및 최소 셸

### 완료 작업
1. **Vite+React 프로젝트 생성**
   - `Frontend/react-app` 생성 (npm create vite@latest -- --template react)
   - package.json, vite.config.js, index.html(root), src/main.jsx, src/App.jsx

2. **전역 스타일 연동**
   - 기존 `Frontend/static/css/main.css` 내용을 `Frontend/react-app/src/styles/main.css`로 복사·연동
   - main.jsx에서 `import './styles/main.css'` 추가
   - index.css는 #root 높이만 지정하여 main.css가 전역으로 적용되도록 정리

3. **최소 셸 UI**
   - App.jsx: 헤더만 표시, 제목 "🔍 스타벅스 CRM 쿼리 빌더" (Backend 호출 없음)
   - index.html: title·lang "스타벅스 CRM 쿼리 빌더", lang="ko"

### 추가/변경된 파일
- **추가**: Frontend/react-app/ (전체), Frontend/react-app/src/styles/main.css
- **변경**: Frontend/react-app/src/App.jsx, src/main.jsx, src/index.css, index.html

### 검증 결과
- `npm run build` 성공 (dist/index.html, dist/assets/*.css, *.js 생성)
- Lint: App.jsx, main.jsx 오류 없음
- 의존성: Phase 1은 Backend 연동 없음(의존성 최소)

### 비고
- 정적 서빙(운영 시 React 빌드 결과 서빙)은 Phase 5에서 static_server 정리 시 반영 예정.
- 개발 시에는 `cd Frontend/react-app && npm run dev` 로 Vite dev server 사용 가능.

---

## 2025-02-02: React 전환 Phase 2 — API 클라이언트 및 설정 모듈

### 완료 작업
1. **계획서 경로 반영**
   - REACT_MIGRATION_PLAN.md는 docs/report 에 있음(사용자 이동). 해당 경로 기준 진행, 변경 이력에 반영.

2. **api_base_url 설정 모듈**
   - `Frontend/react-app/src/config/api.js`: getApiBase() — window.APP_CONFIG.apiBaseUrl(정적 서빙 시, config.json 기반) 또는 기본값 http://localhost:5001. (.env 미사용, 프로젝트 정책: Env/config/config.json)

3. **API 클라이언트 모듈**
   - `Frontend/react-app/src/api/client.js`: health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats (fetch 래퍼, request() 공통)
   - 기존 Frontend/static/js/app.js 의 API 호출 패턴 참고하여 구현

4. **API 연결 테스트 UI**
   - App.jsx: API 연결 테스트 버튼 추가, health() 호출 후 결과 표시, getApiBase() 표시

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/config/api.js, Frontend/react-app/src/api/client.js
- **변경**: Frontend/react-app/src/App.jsx, docs/report/REACT_MIGRATION_PLAN.md (변경 이력)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, api/client.js, config/api.js 오류 없음
- API 클라이언트 단위로 Backend(5001) 호출 시: 브라우저에서 "API 연결 테스트" 클릭 시 health 응답 확인 가능

### Frontend 정리 (Phase 2 범위)
- 기존 Frontend/index.html, static/js/app.js, static/css/main.css 는 Phase 5에서 React 서빙 전환 시 제거·보관 예정. Phase 2에서는 API 로직만 React 쪽으로 이전·참고했으며, 레거시 파일 삭제 없음.
- docs/report/REACT_MIGRATION_PLAN.md 변경 이력에 "docs/report 로 이동" 명시.

---

## 2025-02-02: React 전환 Phase 3 — 레이아웃 및 독립 컴포넌트 (DB 상태·테이블 목록)

### 완료 작업
1. **환경·gitignore 정책 문서화**
   - docs/main/PRD.md 3.3 추가: .env 미사용, .gitignore는 프로젝트 루트에만 둠.

2. **레이아웃 컴포넌트**
   - Header.jsx: 앱 제목, API 연결 테스트(health)
   - Sidebar.jsx: DB 상태(health), 테이블 목록(list-tables), 테이블명 검색, 테이블 펼치기/접기, 컬럼 목록(describe-table)
   - MainArea.jsx: 플레이스홀더 (Phase 4에서 그리드·SQL 패널 연동)
   - App.jsx: Header + container(Sidebar + MainArea) 구성

3. **Sidebar 데이터 로드**
   - 마운트 시 health() → listTables() → 각 테이블 describeTable() 호출, 테이블·컬럼 상태 유지
   - 검색: 테이블명 필터, 펼치기/접기: tableExpanded 상태

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/components/Header.jsx, Sidebar.jsx, MainArea.jsx
- **변경**: Frontend/react-app/src/App.jsx, docs/main/PRD.md (3.3 환경·gitignore 규칙)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, Header.jsx, Sidebar.jsx, MainArea.jsx 오류 없음
- 화면: DB 상태·테이블 목록·검색·펼치기/접기·컬럼 목록 표시, Backend(health, list-tables, describe-table) 통신 정상

---

## 2025-02-02: React 전환 Phase 4 — 그리드·필터·SQL 패널·실행

### 완료 작업
1. **SQL 생성 유틸**
   - Frontend/react-app/src/utils/sqlBuilder.js: getJoinKey, generateSQL, generateCountSQL (tableRelationships, filters, orderBy, pagination 반영)

2. **App 상태·로드**
   - App.jsx: 데이터 로드(health, list-tables, describe-table, table-relationships) → tables, tableRelationships, dbStatus
   - 상태: gridColumns, addedTables, filters, orderBy, resultData, currentPage, pageSize, totalCount, executedSql, explanation, toast
   - 콜백: addColumn, moveColumn, runExecuteQuery, addFilter/removeFilter, addOrderBy/removeOrderBy, setPage/setPageSize, copySql, explainSql, clearAll
   - 컬럼 추가 시 자동 실행(useEffect), Header에 초기화·실행 버튼

3. **Sidebar (Phase 4 확장)**
   - tables, tableRelationships, addedTables를 props로 수신 (로드는 App에서 수행)
   - JOIN 가능 테이블만 활성화: isTableAvailable(tableName, addedTables, tableRelationships)
   - 컬럼 드래그: dataTransfer에 application/json으로 { table, column, type } 전달

4. **MainArea (그리드·필터·SQL·페이지네이션)**
   - 그리드 영역: 컬럼 드롭(onDrop → onAddColumn), 빈 상태 문구, 결과 테이블
   - 그리드 헤더: 드래그 재정렬(draggedColumnIndex, onMoveColumn)
   - WHERE/ORDER BY 칩 UI: 필터·정렬 추가/제거, 인라인 필터·ORDER BY 추가 폼
   - 페이지네이션: 처음/이전/다음/마지막, 페이지 표시, 페이지 크기 선택
   - SQL 패널: 실행된 SQL 표시, 복사, 🤖 해석(explain-sql), Claude 해석 영역

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/utils/sqlBuilder.js
- **변경**: Frontend/react-app/src/App.jsx (상태·로드·콜백 통합), Header.jsx (onExecute, onClearAll), Sidebar.jsx (props 기반, JOIN 활성화, 드래그), MainArea.jsx (그리드·필터·ORDER BY·페이지네이션·SQL 패널)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, Header, Sidebar, MainArea, utils/sqlBuilder 오류 없음
- 검수: 테이블 선택 → 컬럼 드래그 → 실행 → 결과·SQL 표시, Backend(execute-query, explain-sql) 통신 정상

---

## 2025-02-03: React 전환 Phase 5 — 스타일·에러 처리·정리 및 Frontend 전체 점검

### Phase 5 완료 작업
1. **에러/로딩 메시지**
   - App.jsx: 테이블 로드 실패 시 토스트 표시, cleanup 시 toastTimeout 해제
   - API 실패 시 기존 토스트·사이드바 메시지 유지

2. **static_server: React 빌드 서빙·SPA fallback**
   - config.frontend.static_dir: 기본값/예시를 `Frontend/react-app/dist` 로 변경 (config.json, config.json.example)
   - SPA fallback: 존재하지 않는 경로 요청 시 index.html 응답 (_path_under_dir로 path traversal 방지)
   - index.html 응답 시 api-config.js 스크립트 주입 (_inject_api_config_into_index) — 빌드 결과에 스크립트 미포함 대비

3. **레거시 보관**
   - Frontend/index.html, static/js/app.js, static/css/main.css → Frontend/legacy/ 로 이동 (이후 상용화 정리로 legacy 삭제)
   - Frontend/react-app/src/App.css 삭제 (미사용)

4. **react-app index.html**
   - api-config.js 스크립트 태그 제거 (Vite 번들 경고 방지, static_server 주입으로 대체)

### Frontend 전체 점검·정리
- **의존성**: App → Header, Sidebar, MainArea, api/client, utils/sqlBuilder. Sidebar → tables, tableRelationships, addedTables(prop). MainArea → gridColumns, filters, orderBy 등(prop). api/client → config/api. 연결 정상.
- **불필요 코드**: MainArea에서 미사용 prop tableRelationships 제거. App.css 삭제.
- **파일 정리**: Frontend/__init__.py 설명 갱신 (react-app·static_server). Frontend/static/ 하위 파일은 legacy로 이동 후, 상용화 정리 시 legacy 삭제.
- **에러 유발 요인**: Lint 오류 없음. 빌드 성공. static_server index 주입·SPA fallback 적용.

### 추가/변경/삭제된 파일
- **추가 후 삭제**: Frontend/legacy/ (Phase 5에서 보관, 상용화 정리 시 삭제)
- **변경**: Frontend/react-app/index.html, App.jsx, MainArea.jsx, static_server/main.py, Env/config/config.json, config.json.example, Frontend/__init__.py
- **삭제**: Frontend/index.html, Frontend/static/js/app.js, Frontend/static/css/main.css, Frontend/react-app/src/App.css

### 검증 결과
- `npm run build` 성공 (api-config.js 경고 제거 후 재빌드)
- Lint: Frontend/react-app/src, static_server/main.py 오류 없음
- 전체 플로우: React 빌드 → static_server(Frontend/react-app/dist) 서빙 → api-config.js 주입·SPA fallback 동작

---

## 2025-02-03: run.py front 통합·index.html 설명·Frontend 정리

### run.py front 통합
- `python run.py front` 실행 시 **한 번에**: (1) `Frontend/react-app`에서 `npm run build` 실행, (2) 빌드 성공 후 `Frontend/static_server/main.py` 기동
- 별도 `cd Frontend/react-app && npm run build` 후 `python run.py front` 할 필요 없음

### index.html 두 파일 존재 이유 (둘 다 필요, 중복 아님)
- **Frontend/react-app/index.html**: **소스(템플릿)**. Vite가 `npm run build` / `npm run dev` 시 참조하는 HTML 진입점. `<script src="/src/main.jsx">` 등이 있으며, Vite가 이 파일을 기반으로 **dist/index.html을 생성**함. 삭제하면 빌드·개발 불가.
- **Frontend/react-app/dist/index.html**: **빌드 결과물**. `npm run build` 시 Vite가 **자동 생성**하는 파일. 소스 index.html을 변환한 결과로, 해시된 JS/CSS 경로(`/assets/index-xxx.js`, `index-xxx.css`)가 들어감. static_server는 **dist/** 전체를 서빙하므로 이 파일을 응답함. .gitignore 대상이며, 다음 `npm run build` 시 다시 생성됨.
- **정리**: 소스(개발·빌드 입력) vs 빌드 결과(서빙용 출력) 관계이므로 **둘 다 유지**. 삭제 대상 없음.

### Frontend 정리
- **삭제**: 빈 폴더 `Frontend/static` (및 하위 static/js, static/css) — 레거시 파일을 legacy로 이동한 뒤 남은 빈 디렉터리.
- **유지**: react-app(소스·빌드), static_server(서빙), __init__.py. legacy는 상용화 정리로 삭제(참고용 보관 불필요).

---

## 2025-02-03: Frontend/legacy 삭제 (상용화 정리)

- **삭제**: Frontend/legacy/ 전체 (index.html, README.md, static/css/main.css, static/js/app.js). 구 HTML/CSS/JS 참고용 보관 불필요, 패키지 정리.
- **변경**: Frontend/__init__.py에서 legacy 언급 제거, docs/report/log.md Phase 5·정리 문구에 legacy 삭제 반영.
- **정책**: 사용되지 않을 코드·파일은 남기지 않음. 백업은 요청 시에만.

---

## 2025-02-03: README·requirements·docs/main 반영 및 Git 푸시

- **README.md**: 현재 구성 반영 (React 프론트엔드, run.py front 빌드 후 서버, 프로젝트 구조, config.json·static_dir, .env 미사용)
- **requirements.txt**: Backend 의존성 주석 추가 (flask, flask-cors, psycopg2-binary, requests)
- **docs/main/PRD.md**: 패키지 구조(Frontend/react-app, static_server), 실행 방식(run.py front 시 npm run build), frontend config(static_dir=Frontend/react-app/dist), Frontend 4.2·4.3, 변경 이력(React 전환) 반영
- **Git**: 모든 변경사항 커밋 후 origin main 푸시 완료 (c593353..705e16d)

---

## 2025-02-02: README·requirements·docs/main 현재 구성 재점검 및 명세서 React 참고 문구 추가

- **README.md / requirements.txt**: 이미 현재 구성(React 프론트엔드, run.py front 빌드·정적 서버, config.json·.env 미사용) 반영 확인, 수정 없음
- **docs/main**: PRD.md는 이미 React·static_server·config 반영 상태. 명세서 문서에 현재 구현 참고 문구 추가:
  - **ADVANCED_FEATURES.md**: 상단에 "현재 구현: React(Vite), Frontend/react-app, 본 문서는 기능 명세용" 문구 추가
  - **CURSOR_SPEC.md**, **CURSOR_SPEC_V2_SIMPLIFIED.md**: 프로젝트 개요 하단에 "현재 구현: React(Vite), Frontend/react-app, 아래 HTML/구조는 명세 참고용" 문구 추가
- **docs/report/log.md**: 본 작업 완료 로그 갱신
- **Git**: 변경사항 커밋 후 푸시

---

## 2025-02-02: Frontend 패키지화 — 리포트 패키지 분리·대시보드 플레이스홀더·라우팅

- **공용(shared)**: `src/shared/api/client.js`, `src/shared/config/api.js` — 리포트·대시보드 등 모든 페이지에서 사용하는 API 클라이언트·설정
- **리포트 패키지**: `src/packages/report/` — 쿼리 빌더 페이지. ReportPage.jsx, components(Header, Sidebar, MainArea), utils/sqlBuilder.js. shared API·config 사용, `@/shared/...` alias로 import
- **대시보드 패키지**: `src/packages/dashboard/` — DashboardPage.jsx 플레이스홀더. 추후 사용자 제공 코드로 교체
- **App.jsx**: BrowserRouter + 상단 네비(리포트 | 대시보드) + Routes: `/` → `/report`, `/report` → ReportPage, `/dashboard` → DashboardPage
- **vite.config.js**: resolve.alias `@` → `src` (ESM 호환: fileURLToPath로 __dirname 대체)
- **package.json**: react-router-dom 의존성 추가
- **삭제**: 기존 `src/api`, `src/config`, `src/components`(Header, Sidebar, MainArea), `src/utils/sqlBuilder.js` — report 패키지로 이전
- **유지**: `src/index.css`, `src/styles/main.css`, `src/main.jsx`, `src/App.jsx`, `src/assets` — 전역 스타일·앱 진입점
- **검증**: npm run build 성공, Lint 오류 없음

---

## 2025-02-02: 범용 대시보드 시스템 적용 (PRD 아키텍처 준수)

- **Backend (Flask·Env 연동, report와 분리)**  
  - **dashboard_service.py**: 대시보드 전용 비즈니스 로직. db.get_db_connection(), db.validate_table_name(), db.get_table_schema() 사용. GROUP BY(캠페인/일자/워크플로우/채널) 동적 생성, KPI·채널별 분포, get_filter_options.  
  - **routes.py**: POST /api/dashboard/data, GET /api/dashboard/filter-options/<table_id>, GET /api/dashboard/tables 등록. config·db만 사용, 기존 report 엔드포인트와 구분.  
  - **main.py**: API 안내에 대시보드 엔드포인트 추가.
- **Frontend (packages/dashboard, JSX·shared API)**  
  - **shared/api/client.js**: getDashboardData(body), getDashboardFilterOptions(tableId), getDashboardTables() 추가.  
  - **packages/dashboard**: DashboardPage.jsx(테이블 선택·필터·조회·KPI·집계 테이블), components/DashboardFilters.jsx, KPICards.jsx, AggregatedDataTable.jsx. 공용은 @/shared/api/client 사용, TypeScript·TanStack Query 미사용(useState/useEffect).  
- **검증**: Frontend npm run build 성공, Lint 오류 없음. Backend는 config.backend·allowed_tables 기준 테이블 검증.

---

## 2025-02-02: 대시보드 UI 구상 반영 (헤더 통합·추이/인사이트 미구현 명시)

- **1. 헤더에 테이블 셀렉트박스**: 대시보드로 볼 테이블을 여러 개 중 선택. DashboardHeader에 테이블 셀렉트 포함.
- **2. 전체 추이 그래프 삭제**: 여러 날짜 추이 그래프는 현재 미구현(추후 구현 예정). 코드에 해당 섹션 없음.
- **3. 인사이트 삭제**: 인사이트는 추후 AI 검토 예정. 코드에 인사이트 섹션 없음.
- **4. 헤더에 필터링 조건 통합**: 3번 참고 이미지처럼 헤더 한 블록에 테이블 선택 + 기간(날짜 범위) + 캠페인·워크플로우·채널 필터 + 집계 기준(GROUP BY) + 조회 버튼 배치. DashboardHeader.jsx 신규, DashboardPage에서 기존 테이블 행·DashboardFilters 카드 제거 후 DashboardHeader 사용. 필터 적용 시 해당 조건 데이터만 조회.
- **구성**: packages/dashboard/components/DashboardHeader.jsx 추가. DashboardPage는 헤더 → KPI 카드 → 집계 테이블만 표시. DashboardFilters.jsx는 유지(다른 뷰에서 사용 가능).

---

## 2025-02-02: 대시보드 시각 요소 추가 (차트·다이어그램)

- **목적**: KPI 숫자만이 아니라 차트·다이어그램으로 데이터 시각적 비교·분석 가능하도록 구성(참고 이미지 반영).
- **Recharts 추가**: package.json에 recharts 의존성 추가.
- **채널별 도넛 차트 (ChannelDonutCharts.jsx)**: KPI channel_distribution(발송 요청·발송 성공)을 도넛 차트로 표시. 채널별 비중·합계 표시, 툴팁·범례.
- **집계 막대 차트 (AggregatedBarChart.jsx)**: aggregated_data를 기준(일자/캠페인/채널 등)별 막대 차트로 표시. 발송 요청·발송 성공 막대, 상위 30건, groupBy에 따라 X축 라벨 결정.
- **KPI 카드 시각 강화 (KPICards.jsx)**: 카드별 배경색·테두리·아이콘·숫자 색상 적용(캠페인 수·발송 요청/성공/실패·오픈·클릭). 섹션 제목 "주요 지표".
- **DashboardPage**: 본문 순서 — 주요 지표(KPI) → 채널별 분포(도넛) → 기준별 발송 현황(막대) → 집계 데이터 테이블. AggregatedDataTable 섹션 스타일 통일(둥근 모서리·섹션 제목).
