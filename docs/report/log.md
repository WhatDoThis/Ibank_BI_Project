# 작업 완료 로그 (Task Completion Log)

## 2026-02-02: README 갱신·대시보드1 미사용 코드 정리

### 완료 작업
1. **README.md**: 대시보드 섹션에 비교 모드(일간/주간/월간/연간)·디멘션별 비교(B)/요약 보기(A)·X축 단일 차원(일자 제외)·위젯 기간 선택 반영. 대시보드2·위젯보드 섹션 및 접속 경로·프로젝트 구조(dashboard2, widgetboard, routers) 추가. 사용 흐름에 대시보드2·위젯보드 안내 추가.
2. **requirements.txt**: 점검 완료. FastAPI·uvicorn·psycopg2-binary·requests 유지(변경 없음).
3. **대시보드1**: **DashboardFilters.jsx** 삭제 — DashboardPage에서 사용하지 않음(필터·집계 기준·정렬은 DashboardHeader에 통합됨).
4. **docs/main/01_FRONTEND_GUIDE.md**: 디렉터리 구조 및 §4.2에서 DashboardFilters 참조 제거.

### 수정/삭제 파일
- README.md
- docs/main/01_FRONTEND_GUIDE.md
- Frontend/react-app/src/packages/dashboard/components/DashboardFilters.jsx (삭제)
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 문서 정리·보강 (최종 검토 반영)

### 완료 작업
1. **00_PRD.md**: §6.2.2 위젯보드 중복 블록 제거(하나로 통합). 변경 이력 2026-02-02 항목 2줄 → 1줄로 통합.
2. **01_FRONTEND_GUIDE.md**: §4.4 widgetboard에 localStorage 키(widgetboard_layout, widgetboard_widget_configs)·index.jsx·widgetboard.css 설명 보강.
3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**: API 목록(join-order, save-query-as-table, status) 이미 반영 확인. 수정 없음.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 문서 최신화 (PRD·프론트 가이드·백엔드 계획)

### 완료 작업
1. **00_PRD.md**: 위젯보드 패키지·/widgetboard 라우트·접속 경로 반영. 대시보드1 비교 모드(일간/주간/월간/연간)·디멘션별 비교(B)/요약 보기(A)·기준별 발송 X축 단일 차원(일자 제외)·periodCompare. 대시보드2 일간/연간 비교·디멘션별 비교/요약·X축 단일 차원(일자 제외)·채널 도넛 기준/비교 구분. §6.2.2 위젯보드 추가. API 엔드포인트에 join-order·save-query-as-table·status 반영. 변경 이력 2026-02-02 항목 추가.
2. **01_FRONTEND_GUIDE.md**: 패키지에 widgetboard 추가. 디렉터리 구조에 dashboard/utils/periodCompare.js·widgetboard 패키지(Dashboard3Page·dataUtils·widgetboard.css) 반영. §4.2 dashboard: 비교 모드·디멘션별 비교/요약·AggregatedBarChart X축 단일 차원(일자 제외)·periodCompare.js. §4.3 dashboard2: 일간/연간 비교·디멘션별 비교/요약·getPrimaryDimensionForChart(일자 제외)·buildMergedCompareDataSingleDimension·AggregatedDataTable2 CompareMerged/Summary·필터 툴바. §4.4 widgetboard 신설. §4.5 shared(기존 4.4). 스타일에 widgetboard.css·dashboard2 상세 보완.
3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**: §1.3 API 엔드포인트에 POST /api/join-order·POST /api/save-query-as-table·GET /api/save-query-as-table/status/{job_id} 추가. 전환 완료 상태 문구에서 구체적 날짜 제거.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: 기간 비교 시 X축 단일 차원에서 일자(date) 제외

### 완료 작업
1. **문제**: 복수 차원 시 X축 단일 차원을 "가장 분류가 많은 하나"로 선택하다 보니 일자(date)가 선택되면, 차트가 일자별 막대로 나와 기간 비교(기준 vs 비교) 의미가 사라짐.
2. **해결**: `getPrimaryDimensionForChart`에서 **일자를 후보에서 제외**. X축 후보는 캠페인·워크플로우·채널만 사용. 일자+캠페인만 선택된 경우에도 캠페인 하나를 반환하도록 `dims.length <= 1` → `dims.length === 0`일 때만 null 반환으로 변경.
3. **적용 파일**: Dashboard2Page.jsx, DashboardPage.jsx, AggregatedBarChart2.jsx, AggregatedBarChart.jsx (4곳).

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 기준별 발송 현황 복수 차원 시 X축 단일 차원 적용 (레이블 겹침 방지)

### 완료 작업
1. **문제**: 캠페인별+워크플로우별 등 복수 차원 선택 시 X축 레이블이 "캠페인 / 워크플로우" 형태로 길어져 겹침.
2. **해결**: 활성 차원이 2개 이상일 때 **가장 분류가 많은 하나**만 X축에 사용하고, 해당 차원 기준으로 합산하여 차트에 표시.
3. **Dashboard2Page.jsx**
   - `getPrimaryDimensionForChart(baseRows, compareRows, groupBy)`: base+compare 합쳐서 각 차원별 distinct 개수 계산 후 최대인 차원 반환.
   - `buildMergedCompareDataSingleDimension(...)`: 단일 차원 키로 기준/비교 각각 합산 후 머지한 행 배열 반환.
   - `mergedChartData`: `activeDimensionKeys.length >= 2`이면 위 단일 차원 머지 결과를 사용, 아니면 기존 `mergedCompareData` 사용.
4. **AggregatedBarChart2.jsx**
   - `getPrimaryDimensionForChart(data, groupBy)`, `aggregateByPrimaryDimension(rows, primaryDim)` 추가.
   - `BarChartBlock`: `dimCount >= 2`일 때 primary 차원으로 합산 후 상위 N건만 차트 데이터로 사용, X축 name은 해당 차원 값만 표시.
5. **DashboardPage.jsx (D1)**  
   - 동일하게 `getPrimaryDimensionForChart`, `buildMergedCompareDataSingleDimension` 추가 및 `mergedChartData`에서 복수 차원 시 단일 차원 소스 사용.
6. **AggregatedBarChart.jsx (D1)**  
   - 동일하게 `getPrimaryDimensionForChart`, `aggregateByPrimaryDimension` 및 BarChartBlock 복수 차원 시 단일 차원 집계 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 기준별 발송 현황·집계 테이블 디멘션별 비교/요약 보기 토글 적용

### 완료 작업
1. **DashboardPage (D1)**  
   - 중복 `showCompareSummary` state 제거.  
   - `buildMergedCompareData`·`buildSummaryCompareData` 및 `mergedCompareData`·`summaryCompareData`·`mergedChartData`·`summaryChartData` useMemo는 기 적용 상태 유지.  
   - 기준별 발송 현황·집계 데이터 테이블 섹션에 **디멘션별 비교 (B) / 요약 보기 (A)** 토글 및 버튼 아래 기간 라벨(`dashboard-compare-period-label--below-toggle`) 적용 상태 유지.
2. **AggregatedBarChart (D1)**  
   - `compareView`·`mergedChartData`·`summaryChartData` 지원 및 MergedBarChart/SummaryBarChart 렌더는 기 적용 상태 유지.
3. **AggregatedDataTable (D1)**  
   - `compareTableMode === 'merged'`·`'summary'`일 때 **정렬 행 + 필터 툴바 + CompareMergedTable/CompareSummaryTable** 조기 반환 추가.  
   - `renderSortRow`·`renderToolbar(options, filteredCount)` 도입, merged/summary 시 필터 적용·건수 표시.
4. **dashboard.css (D1)**  
   - `.dashboard-compare-view-toggle`, `__btn`, `__btn--active`, `.dashboard-compare-period-label--below-toggle` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 비교 모드·캠페인/워크플로우+일자 집계 시 디멘션별 비교 의미 있게 변경

### 완료 작업
- **문제**: 캠페인(또는 워크플로우/채널)+일자 집계 시 디멘션별 비교가 (캠페인, 일자) 키로 매칭되어 비교 기간에 같은 일자가 없으면 비교 컬럼이 전부 0으로 나옴.
- **적용**: 집계에 **일자+그 외 차원**이 함께 있을 때(`hasDateAndOther`) **일자 제외 키**로 기준/비교 기간 각각 **합산** 후 머지. 구분(라벨)은 캠페인/워크플로우/채널만, 값은 기간 내 해당 디멘션 전체 합계. `keyOfNoDate`, `aggregateByKeyNoDate` 추가.
- **대상**: Dashboard2Page.jsx, DashboardPage.jsx 동일 로직 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 디멘션별 비교/요약 보기 토글 정리

### 완료 작업
- 대시보드1에는 이미 **기준별 발송 현황**·**집계 데이터 테이블** 섹션에 **디멘션별 비교 (B) / 요약 보기 (A)** 토글, 버튼→기간 라벨 순서, `compareView`/`compareTableMode`·`mergedChartData`/`summaryChartData`·`mergedTableData`/`summaryTableData` 전달이 적용되어 있음.
- **DashboardPage.jsx**: `buildMergedCompareData`·`buildSummaryCompareData` 함수가 중복 정의되어 있던 부분 제거(후자 정의만 유지).

### 수정 파일
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 비교분석 UI 반영 및 대시보드2 집계 테이블 필터 유지

### 완료 작업
1. **대시보드1 채널별 분석 (ChannelDonutCharts)**
   - 기준/비교 블록 배경·테두리: donut-period-block--base(#eff6ff), donut-period-block--compare(#fff7ed). 비교 시 도넛 색상: 기준 연한색, 비교 짙은색(동일 팔레트). 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
2. **대시보드1 기준별 발송 현황 (AggregatedBarChart)**
   - 기준 기간 블록: aggregated-bar-chart__period-block--base, 비교 기간 블록: --compare 배경·테두리 적용.
3. **대시보드1 집계 데이터 테이블**
   - 비교 시 기준/비교 테이블을 dashboard-aggregated-table-period-block--base/--compare 래퍼로 감싸 배경·테두리 구분.
4. **대시보드1 dashboard.css**
   - donut-period-block--base/--compare, donut-period-block__empty-msg, aggregated-bar-chart__period-block--base/--compare, dashboard-aggregated-table-period-block--base/--compare 스타일 추가.
5. **대시보드2 집계 테이블 비교 모드 필터 유지**
   - 디멘션별 비교(merged)·요약 보기(summary) 시에도 정렬 기준 행·필터 툴바 노출. getMergedColumnOptions/getSummaryColumnOptions, getCellValueMerged/getCellValueSummary, rowMatchesFiltersWithGetCell로 merged/summary 데이터에 필터 적용. 필터 적용 건수 표시.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChannelDonutCharts.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 집계 데이터 테이블 디멘션별 비교 오픈률·클릭률 및 rate 셀 채우기

### 완료 작업
1. **CompareMergedTable(디멘션별 비교)**
   - **오픈률·클릭률 컬럼 추가**: 기준 오픈률, 비교 오픈률, 기준 클릭률, 비교 클릭률 4개 컬럼 추가. 기존 데이터에 기준_open_rate, 비교_open_rate, 기준_click_rate, 비교_click_rate 포함되어 있음.
   - **rate 셀 채우기**: 성공률·오픈률·클릭률(기준/비교 각 6컬럼)에 cell-fill-wrap·cell-fill·cell-fill-text 적용, minWidth: 80px로 가로 스크롤 시에도 가독성 유지.
2. **CompareSummaryTable(요약 보기)**
   - 성공률·오픈률·클릭률 컬럼에 동일한 셀 채우기 막대 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 채널별 분석 기준/비교 구분 및 비교 기간 데이터 없음 문구

### 완료 작업
1. **기준·비교 블록 시각 구분**
   - 기준 기간 블록: `dashboard2-donut-period-block--base` — 배경 `#eff6ff`, 테두리 `#bfdbfe`.
   - 비교 기간 블록: `dashboard2-donut-period-block--compare` — 배경 `#fff7ed`, 테두리 `#fed7aa`.
   - 도넛 색상: 기준은 BASE_CHART_COLORS(파랑·하늘), 비교는 COMPARE_CHART_COLORS(주황·앰버)로 구분.
2. **비교 기간 데이터 없음**
   - getDistributionTotal로 비교 기간 발송/성공 합계 계산. 합계 0이면 도넛 대신 "해당 기간 데이터가 없습니다." 문구 표시(role="status").

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 집계 테이블 디멘션별 비교 컬럼 배경 구분

### 완료 작업
1. **집계 데이터 테이블 섹션**
   - 버튼→기간 순서·패딩·라인 맞춤은 기존 적용과 동일하게 유지(동일 클래스 사용).
2. **디멘션별 비교 시 컬럼 배경 구분**
   - `ThWithDef`에 `className` prop 추가.
   - `CompareMergedTable`에서 기준 컬럼에 `__th--base`/`__td--base`, 비교 컬럼에 `__th--compare`/`__td--compare` 적용.
   - CSS: 기준 컬럼 `#eff6ff`, 비교 컬럼 `#fff7ed` 배경으로 시각 구분.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 비교 뷰 레이아웃·차트 색상 개선

### 완료 작업
1. **버튼 / 기간 div 순서**
   - 기준별 발송 현황·집계 데이터 테이블 섹션에서 **디멘션별 비교(B)·요약 보기(A) 버튼**을 먼저 두고, **기준 기간 / 비교 기간** 표시 div를 버튼 아래로 이동.
2. **패딩·라인 맞춤**
   - `.dashboard2-compare-view-toggle`에 `margin: 20px 20px 16px 20px`, `gap: 10px`, 버튼 `padding: 10px 18px` 적용해 좌·위·아래 여백 및 라인 정렬.
   - 버튼 아래 기간 라벨에 `.dashboard2-compare-period-label--below-toggle` 추가, `margin: 0 20px 16px 20px`로 좌우 라인 맞춤.
3. **차트 색상 (MergedBarChart)**
   - 기준 묶음: 파란 계열 — 기준 발송 요청 `#2563eb`, 기준 발송 성공 `#0ea5e9`.
   - 비교 묶음: 주황 계열 — 비교 발송 요청 `#ea580c`, 비교 발송 성공 `#f97316`.
   - 기준/비교 그룹이 보색에 가깝게 구분되도록 변경.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1에 비교 기능 적용 (일간/주간/월간/연간, 위젯은 기간 선택)

### 완료 작업
1. **dashboard/utils/periodCompare.js**
   - 대시보드2와 동일한 일/주/월/연 기간 계산 유틸 추가 (getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange).
2. **DashboardHeader (대시보드1)**
   - 보기 라디오 순서: **일반 → 일간 비교 → 주간 비교 → 월간 비교 → 연간 비교**. view_mode, compare_base_day/week/month/year, compare_day/week/month/year 추가. 모드별 기준·비교 입력(날짜/주/월/연).
3. **DashboardPage (대시보드1)**
   - filters에 view_mode·compare_* 필드 추가. compareData state, loadData에서 비교 모드 시 getDashboardData 2회(기준·비교). compareRange useMemo, formatRangeLabel. sortedCompareAggregatedData. KPI·채널 도넛·막대·집계 테이블에 기준/비교 라벨 및 compareData/compareKpi 반영. 집계 테이블은 비교 시 기준 기간/비교 기간 테이블 2개 렌더.
4. **위젯 생성·위젯 생성 (beta)**
   - 비교 모드일 때 **기준 기간 / 비교 기간**을 동시에 표시하지 않고, **차트 기간** 셀렉트박스(기준 기간 | 비교 기간)로 선택한 기간의 데이터만 차트에 반영. widgetPeriodChoice state, effectiveWidgetFilters/effectiveWidgetData로 선택 기간만 ChartWidget·ChartWidget2에 전달.
5. **KPICards (대시보드1)**
   - compareKpi prop 추가. getComparePct, "±n% vs 비교기간" 한 줄 표시. kpi-card__compare 스타일.
6. **ChannelDonutCharts·AggregatedBarChart (대시보드1)**
   - compareKpi/compareData 지원. 기준 기간·비교 기간 블록 각각 표시(도넛 period block, 막대 BarChartBlock).
7. **dashboard.css**
   - compare period label, view-mode 라디오, kpi-card__compare, donut-period-block, aggregated-bar-chart__period-block, dashboard-aggregated-table-period-title, dashboard-widget-period-select-wrap 스타일 추가.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard/utils/periodCompare.js (신규)
- Frontend/react-app/src/packages/dashboard/components/DashboardHeader.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/components/ChannelDonutCharts.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 비교 라디오 순서 및 비교 모드 시 전체 섹션 적용

### 완료 작업
1. **보기 라디오 순서**
   - 순서를 **일반 → 일간 비교 → 주간 비교 → 월간 비교 → 연간 비교** 로 통일 (Dashboard2Header).
2. **비교 적용 범위**
   - 비교 모드(일/주/월/연) 선택 시 **기준 기간 vs 비교 기간**이 KPI뿐 아니라 아래 섹션 전부에 적용되도록 수정.
   - **주요 지표**: 기존과 동일하게 기준/비교 라벨 + compareKpi.
   - **채널별 분석**: 기준/비교 기간 라벨 표시. ChannelDonutCharts2에 compareKpi 전달 → 기준 기간·비교 기간 도넛 블록 각각 표시.
   - **기준별 발송 현황**: 기준/비교 라벨 표시. AggregatedBarChart2에 compareData 전달 → 기준 기간·비교 기간 막대 차트 각각 표시.
   - **집계 데이터 테이블**: 기준/비교 라벨 표시. compareRange 시 기준 기간 테이블·비교 기간 테이블 두 개 렌더 (key="base" / key="compare").
   - **위젯 생성**: 기준/비교 라벨 표시. compareRange 시 기준 기간용 chartData·비교 기간용 compareChartData 각각 조회 후 EChartsChart 두 개(기준 기간 / 비교 기간) 렌더.
3. **데이터·차트**
   - sortedCompareAggregatedData(compareData?.aggregated_data 정렬) 추가.
   - compareChartData·compareChartDataLoading state 및 compareRange 기준 getDashboard2ChartData 호출 useEffect 추가.
4. **스타일**
   - 도넛/막대/테이블/위젯용 기간 블록 제목(.dashboard2-donut-period-title, .dashboard2-aggregated-bar-chart__period-title, .dashboard2-aggregated-table-period-title, .dashboard2-chart-period-title) 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 일간 비교·연간 비교 추가

### 완료 작업
1. **periodCompare.js**
   - `getPreviousDay(anchorDate)`: 기준일의 전일 [date, date] (YYYY-MM-DD) 반환.
   - `getYearRange(year)`: 해당 연도 1/1~12/31 [start, end] 반환.
   - `getPreviousYearRange(year)`: 전년 [start, end] 반환.
2. **Dashboard2Header**
   - 보기 모드 라디오에 **일간 비교**, **연간 비교** 추가.
   - filters에 `compare_base_day`, `compare_day`, `compare_base_year`, `compare_year` 추가. 일반/주간/월간 전환 시 위 필드 초기화.
   - 일간 비교: 기준 일(date)·비교 일(date) 입력. 비어두면 비교 일은 전일.
   - 연간 비교: 기준 연도(number)·비교 연도(number) 입력. 비어두면 비교 연도는 전년.
   - 라벨: "기준 일" / "비교 일", "기준 연도" / "비교 연도".
3. **Dashboard2Page**
   - 초기 filters에 `compare_base_day`, `compare_day`, `compare_base_year`, `compare_year` 추가.
   - loadData: `day_compare` 시 date_range=[기준일, 기준일], compareRange=비교일 있으면 [비교일, 비교일] else getPreviousDay(기준일). `year_compare` 시 date_range=getYearRange(기준연도), compareRange=비교연도 있으면 getYearRange(비교연도) else getPreviousYearRange(기준연도).
   - isCompare에 `day_compare`, `year_compare` 포함. compareRange useMemo에 일간/연간 분기 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 갱신 및 코드 파일 설명 주석 전수검사·보강

### 완료 작업
1. **docs/main**
   - 00_PRD, 01_FRONTEND_GUIDE, 02_BACKEND_FASTAPI_MIGRATION_PLAN: 대시보드2 패키지·API·주간/월간 비교·KPI·집계 테이블·rate 채우기·위젯 rate Y축·info 버튼 등 이미 반영됨 확인. 추가 수정 없음.
2. **백엔드 코드 파일 설명 주석 (user rule 포맷)**
   - pluralize.py: [Dependencies] 섹션 추가.
   - routers/health.py, report.py, dashboard.py, dashboard2.py: [Endpoints], [Dependencies] 섹션 보강.
   - schemas.py: [Endpoints/Classes/Functions](Pydantic 모델 목록), [Dependencies] 정리.
3. **프론트엔드 코드 파일 설명 주석**
   - dashboard2/utils/periodCompare.js: [Main Functions] 정리, [Dependencies] 추가.
   - Dashboard2Page.jsx: 보기 모드·기준/비교 주·월, compareRange, loadData 반영. [Main Functions], [Dependencies] 보강.
   - EChartsChart.jsx: customChartData·metricKey·rate형 소수점 둘째자리 반영. [Main Functions], [Dependencies] 보강.
   - Dashboard2Header.jsx, AggregatedDataTable2.jsx: [Main Functions], [Dependencies] 또는 설명문 보강(컬럼 순서·rate 채우기·내부 테두리).
   - dashboard/components/AggregatedDataTable.jsx: 컬럼 순서·rate 채우기·내부 테두리·[Main Functions], [Dependencies] 보강.

### 수정 파일
- Backend/api_server/pluralize.py, schemas.py, routers/health.py, routers/report.py, routers/dashboard.py, routers/dashboard2.py
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js, Dashboard2Page.jsx, components/EChartsChart.jsx, Dashboard2Header.jsx, AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 주간/월간 비교 시 비교 주·비교 월 선택 기능

### 완료 작업
1. **비교 주/비교 월 선택 UI (Dashboard2Header)**
   - 주간 비교: “비교 주(날짜)” 입력 추가. 비어두면 **전 주**가 비교 기간(디폴트). 날짜 선택 시 해당 주가 비교 기간.
   - 월간 비교: “비교 월” 입력(YYYY-MM) 추가. 비어두면 **전 월** 디폴트. 선택 시 해당 월이 비교 기간.
   - filters에 `compare_week`, `compare_month` 추가. 모드 전환 시 둘 다 초기화.
2. **데이터 조회·라벨 (Dashboard2Page)**
   - loadData: `compare_week` 있으면 getWeekRange(compare_week), 없으면 getPreviousWeekRange(compare_base_week). `compare_month` 있으면 getMonthRange, 없으면 getPreviousMonthRange.
   - 비교 기간 라벨: “비교: … (전 주)” / “(선택 주)” / “(전 월)” / “(선택 월)” 로 구분 표시.
3. **플랜 문서**: 05_대시보드2_주간월간_비교리포팅_플랜.md 5.1절에 비교 주/비교 월 선택·디폴트 설명 반영.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- docs/report/05_대시보드2_주간월간_비교리포팅_플랜.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: 집계 테이블 컬럼 순서 및 rate 컬럼 채우기 막대

### 완료 작업
1. **집계 테이블 컬럼 순서 통일 (대시보드1·2)**
   - 컬럼 순서: **발송요청 → 발송성공 → 성공률 → 오픈 → 클릭 → 오픈률 → 클릭률** (7개).
   - `getColumnOptions`·thead·tbody 순서를 위와 같이 수정. (AggregatedDataTable.jsx, AggregatedDataTable2.jsx)
2. **rate 컬럼(성공률, 오픈률, 클릭률) 채우기 막대 표시**
   - 셀 내 회색(#e5e7eb) 가로 막대를 값(0~100%)에 비례한 너비로 표시. 숫자는 기존 포맷(formatRate + %) 유지, 오른쪽 정렬로 막대 위에 표시.
   - 구조: `td` → `cell-fill-wrap`(relative) → `cell-fill`(absolute, width: value%) + `cell-fill-text`.
   - dashboard.css / dashboard2.css에 `*__cell-rate`, `*__cell-fill-wrap`, `*__cell-fill`, `*__cell-fill-text` 스타일 추가.
3. **집계 테이블 내부 테두리선 (외곽선 없음)**
   - 테이블 자체는 `border: none`. 셀마다 `border-right`, `border-bottom` 1px solid #e5e7eb 적용. 마지막 행·마지막 열은 해당 방향 border 제거하여 외곽선 없이 그리드만 보이도록 처리.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 주간/월간 비교 리포팅 (Phase 1~5)

### 완료 작업
1. **플랜 보완 (05_대시보드2_주간월간_비교리포팅_플랜.md)**
   - 다중 이전 주·이전기간 평균(이미지 스타일) 구현 가능 여부 명시. Phase 6으로 N주 트렌드+미니 차트 추가 권장.
2. **Phase 1**: `dashboard2/utils/periodCompare.js` — getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange (ISO 주 월~일, 월 1일~말일).
3. **Phase 2**: Dashboard2Header — 보기 모드(일반/주간 비교/월간 비교), 주간 시 기준 주 날짜 선택·월간 시 기준 월(YYYY-MM) 선택, 선택 시 date_range 자동 계산.
4. **Phase 3**: Dashboard2Page — view_mode, compare_base_week, compare_base_month, compareData state. 비교 모드 시 기준 기간 1회·비교 기간 1회 getDashboard2Data 호출.
5. **Phase 4**: KPICards2 — compareKpi prop 시 카드에 이전 기간 값·"±n% vs 이전기간" 표시(전비 계산, rate/건수 구분).
6. **Phase 5**: 비교 모드 시 "기준: YYYY.MM.DD ~ ... (이번 주/이번 달) / 비교: ... (이전 주/이전 달)" 라벨 표시.

### 수정/추가 파일
- docs/report/05_대시보드2_주간월간_비교리포팅_플랜.md
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js (신규)
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 내부 수치값 복원(바깥 링 제외·각도 분산)

### 완료 작업
1. **반지름축 숫자 일부 복원 (ChartWidget2.jsx)**
   - **배경**: 사용자 요청 — "대략적인 수치값도 있으면 좋을 것 같다". 이전에 겹침/순서 이슈로 `tick={false}` 적용해 전부 제거했음.
   - **적용**: 바깥쪽 링(dataMax)은 레이블 미표시. **내부 4단계만** 숫자 표시: `ticks=[0, dataMax/4, dataMax/2, 3*dataMax/4]`.
   - **겹침 방지**: Recharts 기본은 한 각도에만 틱을 그려 겹침 발생. 커스텀 `RadarRadiusAxisTickInner`로 각 틱을 서로 다른 각도(270°, 342°, 54°, 126°)에 배치.
   - **구현**: `RadarChartCenterContext`·`RadarChartWithCenter`(cx,cy 측정)·`RadarRadiusAxisTickInner` 추가. 부동소수점 비교는 epsilon으로 처리.
2. **문서**: 04_레이더차트_변경이력_데이터.md에 회차 3 반영, 최적 속성·적용 요약 갱신.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/04_레이더차트_변경이력_데이터.md, docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 변경 이력 데이터화 및 최적 속성 적용

### 완료 작업
1. **변경 이력 데이터화 (docs/report/04_레이더차트_변경이력_데이터.md)**
   - 회차별 변경 요소·적용값·결과를 표로 정리. Recharts PolarRadiusAxis 동작(한 각도에만 틱 렌더 → 겹침/순서 이슈) 정리.
   - 분석 결론: 반지름축 숫자 비표시, 각도축 기본 유지, 범례는 상단 legendRow만, margin으로 하단 여유 확보.
2. **최적 속성 적용 (ChartWidget2.jsx)**
   - **PolarRadiusAxis**: `tick={false}` 로 반지름축 숫자 레이블 비표시(겹침·순서 문제 제거). `domain={[0, dataMax]}` 유지. 툴팁에서만 값 확인.
   - **margin**: `{ top: 64, right: 64, bottom: 72, left: 64 }` (각도 레이블·하단 여유).
   - 차트 내부 Legend 미사용(기존 유지). 코드에 04_레이더차트_변경이력_데이터.md 참조 주석 추가.
3. **인덱스·로그**: 00_ReportIndex.md에 04_레이더차트_변경이력_데이터.md 추가. 본 로그 갱신.

### 수정/추가 파일
- docs/report/04_레이더차트_변경이력_데이터.md (신규)
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/00_ReportIndex.md, docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 Recharts 기본 구성으로 재세팅 (이후 데이터 기반 추가 수정 있음)

### 완료 작업
1. **레이더 차트 단순화 (ChartWidget2.jsx)**
   - **제거**: `RadarChartCenterContext`, `RadarChartWithCenter`(ResizeObserver·중심 계산), `RadarAngleAxisTick`, `RadarRadiusAxisTick` 커스텀 틱 컴포넌트 전부. 차트 내부 `<Legend />` 제거.
   - **적용**: Recharts 기본 `PolarAngleAxis`·`PolarRadiusAxis`만 사용. `PolarRadiusAxis`에 `domain={[0, dataMax]}`만 지정(커스텀 ticks 배열 제거). 반지름축 숫자 순서·겹침 이슈는 당시 미해결 → 04_레이더차트_변경이력_데이터.md 기반으로 `tick={false}` 적용으로 해결.
2. **검수**: 수정 파일 린트 오류 없음.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/log.md (본 로그)

---

## 2025-02-02: 주요 지표·채널별 분석 섹션 상단 기간 표시 (단일일/기간)

### 완료 작업
1. **성과지표 핵심 요소인 "언제부터 언제까지" 기간 명시**
   - **shared/utils/dateRange.js**: `formatDateRangeLabel(dateRange)` 추가. [시작일, 종료일] → 표시 문자열(단일일이면 "YYYY.MM.DD (단일일)", 기간이면 "YYYY.MM.DD ~ YYYY.MM.DD"). `toDisplayDate` 보조 함수(YYYY-MM-DD → YYYY.MM.DD).
   - **shared/components/PeriodLabel.jsx** (신규): 필터에서 선택한 기간을 뱃지 형태로 표시. 캘린더 아이콘 + "기준일:" / "기간:" 접두어. Reporting period 패턴 패러디.
   - **대시보드1**: "주요 지표"·"채널별 분석" CollapsibleSection 본문 최상단에 `<PeriodLabel dateRange={filters.date_range} className="dashboard-period-label" />` 추가.
   - **대시보드2**: 동일하게 "주요 지표"·"채널별 분석" 섹션 상단에 `PeriodLabel` (className="dashboard2-period-label") 추가.
   - **스타일**: dashboard.css / dashboard2.css에 `.dashboard-period-label`, `.dashboard2-period-label` — 연한 파란 배경·테두리·둥근 모서리·아이콘·텍스트 간격.

2. **검수**
   - 수정·추가 파일 린트 오류 없음.

### 수정/추가 파일
- Frontend/react-app/src/shared/utils/dateRange.js
- Frontend/react-app/src/shared/components/PeriodLabel.jsx (신규)
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx, dashboard.css
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx, dashboard2.css
- docs/report/log.md (본 로그)

---

## 2025-02-02: Frontend 코드 파일 상단 설명 정리 (React·현재 구조 반영)

### 완료 작업
1. **Backend와 동일하게 Frontend 전체 코드 파일 상단 설명을 현재 시스템·구성에 맞게 수정**
   - **패키지 진입점**: `packages/dashboard`, `packages/dashboard2`, `packages/report` index.jsx — 플레이스홀더/과거 문구 제거, React 패키지·Export·Backend API 경로 명시.
   - **페이지**: DashboardPage.jsx, Dashboard2Page.jsx, ReportPage.jsx — React 페이지·주요 기능·의존성(shared/api, dateRange, components) 정리.
   - **헤더/컴포넌트**: DashboardHeader, Dashboard2Header — 기간·조회·필터 설명, @/shared 의존성 통일. DashboardFilters — @/shared/utils/dateRange. dashboard2 컴포넌트(CollapsibleSection2, AggregatedBarChart2, ChannelDonutCharts2, TargetContextSection, KPICards2, AggregatedDataTable2) — "Phase 0/1/3" 문구 제거, 현재 역할만 기술.
   - **report**: joinRules.js, safetyCheck.js, constants.js, helpers.js, sqlBuilder.js — 경로·주요 함수·의존성 블록 통일. Sidebar.jsx, MainArea.jsx — [의존성]에 joinRules/constants/helpers 반영.
   - **shared**: dateRange.js — React 대시보드·Backend 전송 전 사용 명시.

2. **검수**
   - 수정한 Frontend 파일들 린트 오류 없음.

### 수정 파일 (Frontend)
- src/App.jsx, main.jsx, shared/api/client.js, shared/config/api.js, shared/utils/dateRange.js
- packages/dashboard/index.jsx, DashboardPage.jsx, components/DashboardHeader.jsx, DashboardFilters.jsx
- packages/dashboard2/index.jsx, Dashboard2Page.jsx, components/Dashboard2Header.jsx, CollapsibleSection2.jsx, AggregatedBarChart2.jsx, ChannelDonutCharts2.jsx, TargetContextSection.jsx, KPICards2.jsx, AggregatedDataTable2.jsx
- packages/report/index.jsx, ReportPage.jsx, utils/joinRules.js, safetyCheck.js, constants.js, helpers.js, sqlBuilder.js, components/Sidebar.jsx, MainArea.jsx
- docs/report/log.md (본 로그)

---

## 2025-02-02: 대시보드2 기능 대시보드(1) 동기화 + 문서·Git

### 완료 작업
1. **대시보드(1)에 대시보드2와 동일 기능 적용 (코드 이중 유지)**
   - **목표·컨텍스트 섹션**: `dashboard/components/TargetContextSection.jsx` 신규. 기간 유형·지표·목표값 저장/로드/삭제. localStorage `dashboard_targets`. 클래스명 `dashboard-target-context-*`. `dashboard.css`에 목표 섹션·삭제 버튼 스타일 추가.
   - **DashboardPage.jsx**: targets state, loadTargetsFromStorage/saveTargetsToStorage, mergeTarget, targetMatchesPeriod, METRIC_HIGHER_IS_BETTER, getTargetStatusByKey, targetStatusByKey useMemo, handleSaveTarget, handleDeleteTarget. TargetContextSection 렌더, KPICards에 targetStatusByKey 전달. 신호등 안내 문구(.dashboard-kpi-section-hint).
   - **KPICards.jsx**: targetStatusByKey prop, formatRatioPct, STATUS_STYLE. 카드별 달성/주의/미달 뱃지·테두리 색상. `.kpi-card__badge`, `--ok`/`--warning`/`--fail` 스타일 추가.
   - 캠페인·워크플로우·채널 "전체" 옵션·워크플로우 수·채널 수·rate 00.00%·표시 지표 선택은 이전 작업에서 이미 대시보드1에 반영됨.

2. **검수**
   - Lint 오류 없음. 목표 저장·삭제·기간 매칭·신호등 표시 로직은 대시보드2와 동일 구조.

3. **문서 업데이트 (대시보드1 기준)**
   - **docs/main/00_PRD.md**: §6.2 대시보드에 목표 섹션·전체 옵션·표시 지표 선택·신호등 반영.
   - **docs/main/01_FRONTEND_GUIDE.md**: §4.2 dashboard에 TargetContextSection, 목표 저장·신호등·전체 옵션, §3 디렉터리 트리에 TargetContextSection.jsx 추가.
   - **README.md**: 대시보드에 목표(저장·신호등) 문구 추가.

4. **Git**
   - 위 변경 + 이전 미커밋 변경 일괄 커밋·푸시.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard/components/TargetContextSection.jsx (신규)
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md
- README.md
- docs/report/log.md (본 로그)

---

## 2025-02-02: 주요 지표 표시 선택 + 컬럼 셀렉트 "전체" 옵션

### 완료 작업
1. **주요 지표 표시할 것만 선택 (접이식 체크박스 + localStorage)**
   - **KPICards2.jsx**: "표시할 지표 선택 ▼/▲" 버튼 클릭 시 체크박스 목록 펼침. 체크된 지표만 카드로 표시. `storageKey` prop 기본값 `dashboard2_kpi_visible`. loadVisibleKeys/saveVisibleKeys로 localStorage 저장·로드. 추후 대시보드 테이블 시 동일 JSON 배열을 컬럼에 저장하면 됨.
   - **KPICards.jsx**: 동일 기능, `storageKey` 기본값 `dashboard_kpi_visible`.
   - **dashboard2.css / dashboard.css**: selector-wrap, selector-trigger, selector-checkboxes, selector-label 스타일 추가.

2. **캠페인·워크플로우·채널 셀렉트에 "전체" 옵션 (디폴트)**
   - **Dashboard2Header.jsx**, **DashboardHeader.jsx**: 각 multi-select 첫 번째 옵션으로 `<option value="__all__">전체</option>` 추가. `campaign_ids`/`workflow_ids`/`channels`가 빈 배열이면 value에 `['__all__']` 사용해 "전체"가 선택된 상태로 표시. onChange에서 "전체"만 선택된 경우 빈 배열로 설정, 그 외에는 `__all__` 제외 후 ID/코드만 전달. 집계 기준에서 해당 컬럼을 선택하기 전에는 디폴트로 전체(필터 없음)로 동작.

3. **기타**
   - Dashboard2Page: METRIC_HIGHER_IS_BETTER에 workflow_count, channel_count 추가.
   - TargetContextSection: TARGET_METRIC_OPTIONS에 워크플로우 수·채널 수 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard/components/DashboardHeader.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 주요 지표는 선택한 것만 표시·localStorage 유지. 캠페인/워크플로우/채널 셀렉트 기본 "전체" 선택.

---

## 2025-02-02: 주요 지표 섹션 개선 — rate 00.00% 포맷·워크플로우 수·채널 수

### 완료 작업
1. **rate 지표(성공률·실패률·오픈률·클릭률) 표시**
   - KPICards2.jsx·KPICards.jsx: `formatRateDisplay(n)` 추가 — 소수 둘째 자리 반올림, 정수여도 `minimumFractionDigits: 2`로 00.00% 형식 표시. `unit === '%'`인 카드에만 적용.

2. **워크플로우 수·채널 수 추가**
   - Backend dashboard_service._calculate_kpi: KPI 쿼리에 `COUNT(DISTINCT workflow_id) AS workflow_count`, `COUNT(DISTINCT delivery_channel) AS channel_count` 추가. 반환 객체에 `workflow_count`, `channel_count` 포함.
   - KPICards2.jsx: CARD_CONFIG에 워크플로우 수(workflow_count), 채널 수(channel_count) 카드 추가(캠페인 수 다음, 정의·아이콘·색상 포함).
   - KPICards.jsx: 동일하게 워크플로우 수·채널 수 카드 및 rate 포맷 적용(대시보드1 동기화).

### 수정 파일
- Backend/api_server/dashboard_service.py
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 성공률~클릭률은 00.00% 형식, 캠페인 수·워크플로우 수·채널 수가 주요 지표에 표시됨.

---

## 2025-02-02: docs/main 문서 업데이트 (report 반영·대시보드2 미반영)

### 완료 작업
1. **00_PRD.md**
   - 대시보드2 관련 문구 전부 제거(§1.2 핵심 가치, §2.1 패키지, §2.2 접속 경로, §6.2, §8 변경 이력).
   - 리포트(§6.1): JOIN 규칙·안전성 반영 — joinRules(canAddTableByColumn, findIntermediateParent, isTableAvailable), safetyCheck(detectCircularReference, detectManyToMany, validateJoinPath, canAddTableSafely), joinMode·joinConfigs(LEFT/INNER/RIGHT·복합 조건·AND/OR), generateDistinctPivotSQL.

2. **01_FRONTEND_GUIDE.md**
   - 대시보드2 제거: §1.1 패키지·§1.2 접속 경로, §3 디렉터리 트리(dashboard2 폴더·라우트), §4.3 dashboard2 절 전체·대시보드2 기능 요약. 차트 스택에서 ECharts(대시보드2) 제거.
   - report(§4.1) 상세 반영: ReportPage 상태(joinMode, relationshipOptions, joinConditions, joinConfigs, tableRelationships 등), utils/sqlBuilder(generateDistinctPivotSQL·joinConfigs 옵션), utils/joinRules, utils/safetyCheck, utils/constants·helpers, __tests__ (sqlBuilder.test.js, joinRules.test.js). 디렉터리 트리에 utils·__tests__ 추가. shared 절 번호 4.4→4.3.

3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**
   - 대시보드2 언급 없음 확인. 수정 없음.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/report/log.md (본 로그)

### 검수 결과
- docs/main 기준 패키지: report, dashboard, shared만 명시. 대시보드2는 테스트용으로 본 문서에 반영하지 않음.

---

## 2025-02-02: Phase 4 신호등 표시 (목표 대비 달성 여부)

### 완료 작업
1. **목표·기간 매칭 및 실적/목표 비율 계산 (Dashboard2Page.jsx)**
   - `targetMatchesPeriod(target, dateRange)`: 목표의 periodType(년도/월/기간)과 현재 필터 기간(date_range) 일치 여부 판별.
   - `METRIC_HIGHER_IS_BETTER`: 지표별 “높을수록 좋음” 여부(total_failed, failed_rate는 낮을수록 좋음).
   - `getTargetStatusByKey(targets, dateRange, kpi)`: 매칭된 목표별로 실적/목표 비율 계산. 높을수록 좋은 지표는 ratio = actual/target×100, 낮을수록 좋은 지표는 ratio = target/actual×100. 구간 ≥100% → ok, 80~100% → warning, <80% → fail.
   - `targetStatusByKey` useMemo로 계산 후 KPICards2에 전달.

2. **KPICards2 신호등 UI**
   - `targetStatusByKey` prop 추가. 매칭된 목표가 있는 카드에 대해: 테두리·배경 색상(초록/노랑/빨강), 뱃지 “달성 105%”/“주의 85%”/“미달 70%” 표시. 뱃지에 `title`로 목표 대비 비율 툴팁.
   - dashboard2.css: `.dashboard2-kpi-card__badge`, `__badge--ok`, `__badge--warning`, `__badge--fail` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 목표 저장 후 해당 기간·지표로 조회 시 주요 지표 카드에 달성/주의/미달 뱃지 및 테두리 색상 표시.

---

## 2025-02-02: 목표 섹션 간소화(리포트 기간 제거) + Phase 3 지표 정의 툴팁

### 완료 작업
1. **목표 저장 섹션에서 리포트 기간 제거**
   - TargetContextSection: "리포트 기간: YYYY-MM-DD ~ YYYY-MM-DD" 표시 블록 및 `reportPeriodLabel` 변수 제거. 기간은 상단 필터에 이미 있으므로 중복 제거, 저장 섹션 간결화.

2. **Phase 3: 지표 정의 툴팁**
   - **KPICards2.jsx**: CARD_CONFIG 각 항목에 `definition` 문자열 추가(캠페인 수, 발송 요청/성공/실패, 오픈/클릭, 성공률/실패률/오픈률/클릭률의 정의·계산식). 카드 라벨 옆에 "?" 아이콘 추가, 호버 시 `title` 툴팁으로 정의 표시. `dashboard2-kpi-card__def-trigger` 스타일 추가.
   - **AggregatedDataTable2.jsx**: TABLE_HEADER_DEFINITIONS 상수(캠페인/일자/워크플로우/채널·발송요청·발송성공·오픈·클릭·성공률·오픈률·클릭률 정의) 추가. ThWithDef 컴포넌트로 헤더 셀 + "?" 툴팁 렌더링. thead 모든 헤더를 ThWithDef로 교체. `dashboard2-aggregated-data-table__th-inner`, `__th-def` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드2 목표 섹션에서 리포트 기간 미표시. 주요 지표 카드·집계 테이블 헤더에서 "?" 호버 시 지표 정의 툴팁 표시.

---

## 2025-02-02: 주요 지표 확장(성공률/실패률/오픈률/클릭률) + Phase 2

### 완료 작업
1. **주요 지표에 비율 지표 추가**
   - **Backend dashboard_service._calculate_kpi**: 반환 객체에 `success_rate`, `failed_rate`, `open_rate`, `click_rate` 추가. 성공률=total_success/total_send*100, 실패률=total_failed/total_send*100, 오픈률=total_open/total_success*100, 클릭률=total_click/total_success*100 (소수 둘째 자리).
   - **Frontend KPICards.jsx, KPICards2.jsx**: 카드 설정에 성공률·실패률·오픈률·클릭률 4개 추가(단위 %, 아이콘·색상 지정). 주요 지표 10개 표시.
   - **TargetContextSection.jsx**: 목표 지표 옵션에 `failed_rate`(실패률) 추가.

2. **Phase 2: 기간 표시 명시화 + Executive Summary**
   - 리포트 기간 라벨("리포트 기간: YYYY-MM-DD ~ YYYY-MM-DD")은 Phase 1에서 이미 적용됨.
   - **TargetContextSection**: Executive Summary 한 줄 요약 입력 필드 추가(로컬 state, placeholder "한 줄 요약 문구 (로컬 입력)").
   - **dashboard2.css**: `.dashboard2-target-context__summary-wrap`, `__summary-input` 스타일 추가.

### 수정/추가 파일
- Backend/api_server/dashboard_service.py
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx, TargetContextSection.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드1·2 주요 지표에 10개 카드(건수 6 + 비율 4) 표시. 대시보드2 목표·컨텍스트 섹션에 Executive Summary 입력란 표시.

---

## 2025-02-02: 대시보드2 전용 백엔드 라우터 분리 및 프론트 연동

### 완료 작업
1. **Backend/api_server/routers/dashboard2.py 신규**
   - prefix `/api/dashboard2`, tags `dashboard2`. dashboard_service·schemas 동일 사용.
   - POST /data, GET /filter-options/{table_id}, GET /tables, GET /required-columns, POST /chart-data (기존 dashboard와 동일 로직, DEV용 분리).

2. **main.py, routers/__init__.py**
   - dashboard2_router import 및 `app.include_router(dashboard2_router)` 등록.

3. **Frontend shared/api/client.js**
   - getDashboard2Tables, getDashboard2FilterOptions, getDashboard2Data, getDashboard2RequiredColumns, getDashboard2ChartData 추가 (/api/dashboard2/* 호출).

4. **Dashboard2Page.jsx, Dashboard2Header.jsx**
   - getDashboardTables → getDashboard2Tables, getDashboardFilterOptions → getDashboard2FilterOptions, getDashboardData → getDashboard2Data, getChartData → getDashboard2ChartData, getDashboardRequiredColumns → getDashboard2RequiredColumns 로 변경하여 테이블 조회·데이터 로드가 대시보드2 전용 API로 연결되도록 수정.

### 수정/추가 파일
- Backend/api_server/routers/dashboard2.py (신규)
- Backend/api_server/routers/__init__.py, main.py
- Frontend/react-app/src/shared/api/client.js
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx, components/Dashboard2Header.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드2 페이지에서 테이블 선택 시 /api/dashboard2/tables, /api/dashboard2/data 등 호출로 데이터 로드 확인 권장.

---

## 2025-02-02: 대시보드2 Phase 1 — 목표·컨텍스트 섹션 + localStorage 저장/로드

### 완료 작업
1. **TargetContextSection.jsx 신규**
   - 기간 유형(년도/월/기간), 지표(캠페인 수·발송 요청·성공·실패·오픈·클릭·성공률·오픈률·클릭률), 년도·월/기간(시작·종료), 목표값 입력·저장.
   - 저장 시 동일 periodType+metric+year+month/range 조합이 있으면 덮어쓰기, 없으면 추가. 목표값 실수만 허용 유효성 검사.
   - 저장된 목표 테이블 표시(기간 라벨·지표·목표값), 삭제 버튼. 리포트 기간 라벨( dateRange ) 표시.

2. **Dashboard2Page.jsx**
   - `TARGETS_STORAGE_KEY = 'dashboard2_targets'`. 마운트 시 localStorage에서 목표 배열 로드.
   - `handleSaveTarget`: mergeTarget 후 localStorage 저장 및 setTargets. `handleDeleteTarget`: 인덱스 삭제 후 저장.
   - 본문 상단(주요 지표 위)에 TargetContextSection 배치, dateRange=filters.date_range, targets, onSave, onDelete 전달.

3. **dashboard2.css**
   - 목표·컨텍스트 섹션 스타일: dashboard2-target-context-section, 폼·테이블·삭제 버튼.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (targets state, localStorage, TargetContextSection 연동)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (목표·컨텍스트 스타일)
- docs/report/log.md (본 로그)

### 검수 결과
- Lint: 오류 없음. 저장 후 새로고침 시 목표 유지(localStorage) 확인 권장.

---

## 2025-02-02: 대시보드2 Phase 0 — 대시보드1 구성 복사(공유 없음)

### 완료 작업
1. **dashboard2 전용 컴포넌트 신규 생성** (dashboard 패키지 참조 제거)
   - `dashboard2/components/CollapsibleSection2.jsx`: 접기/펼치기 섹션
   - `dashboard2/components/Dashboard2Header.jsx`: 테이블 선택·기간·집계 기준·정렬·필터·필수 컬럼 모달
   - `dashboard2/components/KPICards2.jsx`: KPI 카드 6종
   - `dashboard2/components/ChannelDonutCharts2.jsx`: 채널별 도넛(발송 요청·발송 성공)
   - `dashboard2/components/AggregatedBarChart2.jsx`: 기준별 발송 현황 막대 차트(상위 10건)
   - `dashboard2/components/AggregatedDataTable2.jsx`: 집계 데이터 테이블(페이징·테이블 내 검색)

2. **dashboard2.css**
   - Phase 0용 스타일 추가: collapsible, header, modal, KPI 카드, 채널 도넛, 막대 차트, 집계 테이블

3. **Dashboard2Page.jsx 재구성**
   - `../dashboard` import 제거. Dashboard2Header, CollapsibleSection2, KPICards2, ChannelDonutCharts2, AggregatedBarChart2, AggregatedDataTable2 로컬 import.
   - 본문 순서: 주요 지표(KPI) → 채널별 분석 → 기준별 발송 현황 → 집계 데이터 테이블 → 차트 생성(ECharts). 섹션 접기/펼치기 상태(sectionOpen) 추가.

4. **플랜 문서**
   - 목표 저장: DEV용 localStorage 사용으로 적용 결정 반영. Phase 1 설명을 localStorage 기준으로 수정.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/components/CollapsibleSection2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (스타일 추가)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (재구성)
- docs/report/03_대시보드2_성과리포트_개선_플랜.md (Phase 1 localStorage 반영)
- docs/report/log.md (본 로그)

### 검수 결과
- Lint: dashboard2 패키지 오류 없음. dashboard 패키지 참조 없음.

---

## 2025-02-02: docs/main 문서–코드 동기화 및 PRD 간결화·01/02 정밀화

### 완료 작업
1. **문서–코드 동기화**
   - 실제 구현 기준으로 개발문서(docs/main) 점검: 빠진 내용 추가, 달라진 내용 수정, 시스템에서 제거된 내용은 문서에서 삭제 반영 (이전 세션에서 00_PRD·01_FRONTEND_GUIDE 반영 완료).

2. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**
   - §1.1: routes.py 제거, 현재 구조(routers/, dependencies.py, schemas.py) 표로 정리.
   - §1.2: config 사용처 routes.py → routers/report.py, "전환 시" → "현재" 문구로 수정.
   - §1.3: chart-data에 "LIMIT 없음·전건 반환" 명시, 라우터 구분(health/report/dashboard) 추가.
   - Phase 3·4: "완료" 상태로 요약, 산출물 routes.py 삭제·routers 적용 명시.
   - 진행 순서 요약표: routes.py → routers/. 롤백 참고: routes.py/main.py → main·routers 복원 안내로 수정.

3. **00_PRD.md 간결화**
   - §2.1: 전체 디렉터리 트리 → 요약 불릿으로 축약, 상세는 01·02 참조 명시.
   - §4: 프론트 요약만 유지, 상세는 01 참조.
   - §5.2·§5.3: 엔드포인트·구성 상세 → 02 §1.3·§1.1·Phase 3·4 참조로 통합.
   - 변경 이력: PRD 간결화·02 routes→routers 반영 항목 추가.

### 수정 파일
- docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md
- docs/main/00_PRD.md
- docs/report/log.md (본 로그)

### 검수 결과
- 00_PRD에 언급된 프론트/백엔드 내용이 01_FRONTEND_GUIDE·02_BACKEND_FASTAPI_MIGRATION_PLAN에 정밀하게 반영됨. PRD는 간결·참조 위주로 정리됨.

---

## 2025-02-02: 차트 데이터 LIMIT 제거 (차트 신뢰성)

### 완료 작업
1. **차트 전용 API에서 LIMIT 제거**
   - `dashboard_service.get_chart_data`: 차트는 기간·디멘션에 해당하는 **전체** 데이터를 반환하도록 SQL에서 `LIMIT` 절 제거. (표 테이블용 페이지네이션 LIMIT 50은 별도 유지.)
   - docstring: "한 축당 상위 limit건" → "차트는 데이터 신뢰성을 위해 LIMIT 없이 전건 반환"으로 수정.

2. **API·프론트 정리**
   - `ChartDataRequest`: `limit` 필드 제거.
   - `routers/dashboard.py`: 차트 요청 시 `limit` 전달 제거.
   - `ChartWidget.jsx`: `getChartData` 호출 시 `limit: 50` 제거.

### 수정 파일
- Backend/api_server/dashboard_service.py (get_chart_data LIMIT 제거)
- Backend/api_server/routers/dashboard.py (limit 미전달)
- Backend/api_server/schemas.py (ChartDataRequest limit 제거)
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx (limit 미전달)

### 검수 결과
- Lint: 수정 파일 오류 없음.

---

## 2025-02-02: 차트 디멘션 셀렉트 안내 문구 추가 (3개 이상 집계 시 정의 반영)

### 완료 작업
- **ChartWidget.jsx**
  - Dimension 셀렉트 왼쪽 안내: 선택 디멘션별 문구 + 집계 기준 2개 이상일 때 "나머지는 합산" 명시. 예: "일자별 집계 결과가 반영됨. (캠페인·워크플로우는 합산)".
  - 섹션 설명 문구: "Dimension(X축): 집계 기준 중 선택한 1개만 축으로 사용하고, 나머지 집계 기준은 합산하여 표시"로 디멘션·메트릭 관계 정의. "상위 50건" 제거(차트 LIMIT 없음 반영).

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 오류 없음.

---

## 2025-02-02: 백엔드 Flask → FastAPI 전면 전환 완료

### 완료 작업
1. **구조 변경 (FastAPI에 맞게 효율화)**
   - 단일 `routes.py`를 **routers/** 로 분리: `health.py`(/, /api, /health), `query.py`(쿼리 빌더 API), `dashboard.py`(대시보드 API)
   - **dependencies.py**: `get_db`(요청 단위 DB 연결, yield 후 자동 close), `get_config`(config.backend 주입)
   - **schemas.py**: POST 요청 바디 Pydantic 모델 (DescribeTableRequest, ExecuteQueryRequest, ExplainSqlRequest 등) — 검증·문서화

2. **main.py**
   - FastAPI 앱, CORSMiddleware, health/query/dashboard 라우터 등록, 404/500 JSON 예외 핸들러, uvicorn 기동
   - config 로드는 기존과 동일 (`Env/config/config.json` → config.backend)

3. **기존 파일**
   - **db.py**, **dashboard_service.py**: 변경 없음 (프레임워크 무관)
   - **routes.py**: 삭제 (라우터로 이전 완료)

4. **문서·의존성**
   - requirements.txt: flask/flask-cors 제거, fastapi·uvicorn[standard] 명시
   - run.py: ModuleNotFoundError 시 fastapi/uvicorn 안내
   - README.md, docs/main/00_PRD.md: 백엔드 구조를 FastAPI·routers 기준으로 수정

5. **버그 수정**
   - routers/query.py: `Query` import 추가 (table_relationships의 mode 파라미터용)

### 수정/삭제/추가 파일
- Backend/api_server/main.py (FastAPI 전환)
- Backend/api_server/dependencies.py (신규)
- Backend/api_server/schemas.py (신규)
- Backend/api_server/routers/__init__.py, health.py, query.py, dashboard.py (신규)
- Backend/api_server/routes.py (삭제)
- requirements.txt, run.py, README.md, docs/main/00_PRD.md
- docs/report/log.md (본 로그)

### 검수 결과
- API 경로·요청/응답 형식 기존과 동일 유지 → 프론트 수정 없음.
- Lint: query.py 등 수정 파일 오류 없음.

---

## 2025-02-02: 차트 가독성 개선 (ECharts 참고·기존 대시보드 반영)

### 완료 작업
1. **보고서 작성**
   - `docs/report/01_ChartReadability.md`: 디멘션·메트릭 불명확 시 가독성 저하 원인, ECharts 참고 요소(yAxis min/max, axisLabel, dataZoom, stack, label), 기존 dashboard(ChartWidget Y축 Nice Numbers·Rate 구간 확대, AggregatedBarChart TOP_N·복합 라벨) 적용 사항, EChartsChart 개선 방안 정리

2. **EChartsChart.jsx 개선 (dashboard2)**
   - Y축 데이터 구간 확대: 값이 좁은 구간에 몰려 있을 때(range/dataMax < 0.2) yAxis.min/max를 데이터 구간+패딩으로 설정, nice 눈금 적용. 안내 문구 "Y축이 데이터 구간으로 확대되었습니다." 표시
   - 스택 막대: 복수 메트릭 막대 템플릿(bar_both, bar_all)에 `stack: 'total'` 적용
   - dataZoom: 카테고리 20개 초과 시 X축 slider·inside dataZoom으로 초기 20건만 표시
   - 막대 데이터 라벨: 카테고리 15개 이하일 때 막대 위에 값 표시(한글 포맷)

### 수정/추가 파일
- docs/report/01_ChartReadability.md (신규)
- docs/report/00_ReportIndex.md (01_ChartReadability.md 목록 추가)
- Frontend/react-app/src/packages/dashboard2/components/EChartsChart.jsx (Y축 구간 확대, 스택, dataZoom, 라벨)

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: dashboard2 패키지 추가 (템플릿 ECharts 대시보드, 경로 /dashboard2)

### 완료 작업
1. **dashboard2 패키지 구성**
   - `Frontend/react-app/src/packages/dashboard2/` 생성: index.jsx, Dashboard2Page.jsx, dashboard2.css
   - 동일한 헤더/필터/데이터 조회: getDashboardTables, getDashboardFilterOptions, getDashboardData, DashboardHeader 재사용, 정렬·집계 기준·필터 동일

2. **템플릿 선택 + ECharts 차트**
   - `dashboard2/components/EChartsChart.jsx`: CHART_TEMPLATES(막대/선 템플릿 7종), aggregated_data → ECharts option 구성, echarts.init/setOption/resize/dispose 라이프사이클 처리
   - 템플릿: 일자별 발송 성공/요청, 발송 요청·성공, 오픈/클릭, 오픈·클릭, 전 메트릭 막대 등

3. **라우팅·의존성**
   - App.jsx: /dashboard2 라우트 및 네비 "대시보드2" 추가
   - echarts 패키지 npm 설치

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/index.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (신규)
- Frontend/react-app/src/packages/dashboard2/components/EChartsChart.jsx (신규)
- Frontend/react-app/src/App.jsx (라우트·네비 추가)
- package.json (echarts 의존성 추가)

### 검수 결과
- Lint: 수정·추가 파일 오류 없음.

---

## 2025-02-02: Y축 Nice Numbers 전면 개편 (Chart.js 스타일)

### 완료 작업
1. **기존 Y축 함수 제거**
   - `calculateNiceStepSize`, `calculateYAxisMax`, `calculateYAxisMin`, `calculateNiceStepSizeLineArea` 삭제.

2. **새 알고리즘 적용**
   - `niceNum(range, round)`: 1, 2, 5, 10 계열 nice 숫자 반환.
   - `calculateYAxisScale(dataMin, dataMax, options)`: minTicks, maxTicks, paddingRatio, includeZero 옵션으로 min/max/stepSize/ticks/tickCount 반환.
   - `calculateYAxisScaleForLineArea`: 선형/영역용 (minTicks 6, maxTicks 12, paddingRatio 0.05).
   - `calculateYAxisScaleForBar`: 막대용 (includeZero: true, paddingRatio 0.1, minTicks 5, maxTicks 8).

3. **yDomain 연동**
   - 막대: `calculateYAxisScaleForBar` → [scale.min, scale.max].
   - 선형/영역: `calculateYAxisScaleForLineArea` → [scale.min, scale.max].

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: recharts-surface·Y축 Max 잘림 방지 (막대·선형·영역 공통)

### 완료 작업
1. **overflow로 인한 잘림 제거**
   - `.chart-widget__y-axis-fixed`: `overflow: hidden` → `overflow: visible` (Y축 상단/하단 레이블 잘림 방지).
   - `.chart-widget__chart-scroll`: `overflow-y: visible` 명시.
   - `.chart-widget__chart-wrap`: `overflow-y: visible` 추가.
   - `.chart-widget__chart-block`: `overflow: visible` 추가.
   - `.recharts-responsive-container`, `.recharts-wrapper`, `.recharts-surface`: `overflow: visible !important` (캔버스 잘림 방지).

2. **Y축 레이블·여백**
   - `formatYAxisTick`: 1e12 이상은 "Ne12", 1e9~1e12 "Ne9", 1e6~1e9 "Ne6" 등으로 축약해 좁은 영역에서도 잘리지 않도록 적용 (100000000000 → "100e9" 등).
   - Y축 고정 영역 너비 56px → 80px, margin top 40 → 48, bottom 24 → 28로 상하 여유 확대.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 Y축 도메인 버퍼·숫자 파싱·범례 상단 배치

### 완료 작업
1. **Y축 도메인과 데이터 일치**
   - `parseChartNumber(v)`: API/프롭 값이 문자열(쉼표 포함)이어도 숫자로 안전 파싱. 차트 데이터 저장 시와 yDomain 계산 시 동일 함수 사용.
   - yMax 버퍼: `minBuffer = max(dataMax * 10%, 1)` 로 두고, 막대/선형/영역 모두 `yMax >= dataMax + minBuffer` 로 상단 여유 확보.

2. **범례 위치**
   - 범례를 Y축 옆이 아닌 **차트 블록 전체 상단 한 줄**로 이동. `chart-widget__chart-block`(flex column)으로 범례 행 + 차트 영역(Y축 고정 | 스크롤) 세로 배치. `.chart-widget__legend-top` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 범례 recharts-surface 상단 배치 및 막대 Y축 nice number 강제

### 완료 작업
1. **범례 위치**
   - 범례를 Y축 열이 아닌 **recharts-surface 상단**으로 이동. 스크롤 영역(`chart-scroll`) 내부 맨 위에 `chart-widget__legend-strip`을 두어 차트 캔버스 바로 위에 표시. 고정 Y축 열에는 같은 높이의 `chart-widget__legend-strip-spacer` 추가해 세로 정렬 유지.

2. **막대 차트 Y축 nice number**
   - 도메인 계산 시 메트릭 값을 `Number()`로 확실히 숫자화.
   - 막대용 `yMax`: `dataMax + stepSize` 후 step 단위로 올림해 눈금에 맞춤 (`Math.ceil(rawMax / stepSize) * stepSize`).
   - Recharts가 데이터로 domain을 넓히지 않도록 Y축(고정·스크롤 공통)에 `allowDataOverflow` 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 범례 간격 및 막대 Y축 max 보정

### 완료 작업
1. **범례 위치**
   - 범례가 Y축과 겹치지 않도록 상단 여유 확대. `.chart-widget__legend-fixed`에 `padding-top: 12px`, `padding-bottom: 8px` → `padding-bottom: 20px` 적용해 차트와 충분히 간격 확보.

2. **막대 차트 Y축 max**
   - 막대도 `y축 max = data max + 간격` 적용. 기존: `dataMax === dataMin`일 때 `dataMax + 1`만 사용해 막대가 상단에 붙는 문제.
   - 변경: 막대는 항상 `yMax = dataMax + Math.max(stepSize, 1)`. 단일 값일 때는 `stepSize = calculateNiceStepSize(0, dataMax)`로 데이터 크기에 맞는 간격 사용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 범례 고정 및 Y축 Nice number 적용

### 완료 작업
1. **범례 고정**
   - 범례를 Y축과 동일하게 스크롤 영역 밖으로 이동. `chart-widget__legend-fixed`로 차트 상단에 고정 행 추가(메트릭명+색상 블록). Recharts `<Legend />` 제거, 고정 영역만 사용.

2. **Y축 Nice number 적용**
   - 스크롤 영역의 LineChart/AreaChart/BarChart에 `domain={yDomain}`이 반영되도록 숨김 YAxis(`<YAxis domain={yDomain} hide width={0} />`) 추가. 기존에는 왼쪽 고정 BarChart에만 domain이 있어 실제 그리기 스케일은 자동 도메인 사용 → 스크롤 차트에도 동일 domain 적용.
   - `calculateNiceStepSizeLineArea`: 구간 4개 이상을 위해 `maxStep = dataRange/2` → `dataRange/4`로 변경.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 하단 삭제 버튼 제거

### 완료 작업
1. **삭제 버튼 중복 제거**
   - 디멘션·메트릭·차트 타입 셀렉트 옆에 있던 하단 "삭제" 버튼 제거. 상단(저장 버튼 옆) 삭제 버튼만 유지.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 막대 차트 좌우 폭 확대 및 Y축 고정

### 완료 작업
1. **좌우 폭 확대**
   - `.chart-widget__chart-wrap`의 max-width를 980px → 1200px로 변경해 차트가 보이는 영역을 넓힘.

2. **가로 스크롤 시 Y축 고정**
   - 막대 차트만 왼쪽에 Y축 전용 영역을 두고, 오른쪽만 가로 스크롤되도록 분리.
   - 왼쪽: 고정 너비(56px)로 Y축만 표시하는 BarChart(동일 domain·높이).
   - 오른쪽: `chart-widget__chart-scroll`에서 overflow-x: auto로 X축·막대만 스크롤.
   - 클래스 `chart-widget__chart-wrap--y-fixed`로 flex 레이아웃 적용.

3. **선형·영역 차트에 bar와 동일 구성 적용**
   - 선형/영역도 고정 Y축 + 스크롤 영역 분리, minWidth(LABEL_SLOT_WIDTH×건수)로 X축 간격 확보 후 가로 스크롤.
   - X축 레이블은 막대와 동일하게 `XAxisTickTruncate` 적용해 잘림·겹침 방지. bar/line/area 동일 정형 구성.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css: chart-widget__chart-wrap max-width, y-fixed 레이아웃
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: 막대 차트 시 Y축 고정 + 스크롤 영역 분리

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 삭제 버튼 스타일 및 docs/main 최신화

### 완료 작업
1. **차트 생성 섹션 삭제 버튼**
   - 연한 빨간 배경(#f87171), 흰색 글씨. hover 시 #ef4444. 클래스 `.chart-widget__delete-btn` 추가(dashboard.css), ChartWidget.jsx 두 곳 적용.

2. **docs/main 최신화**
   - 00_PRD.md: 차트 생성 전용 API(chart-data), 차트 생성 위젯(전용 조회·Y축 고정·막대/선형/영역 동일), CollapsibleSection 반영. API 엔드포인트·dashboard_service 함수 목록 보강.
   - 01_FRONTEND_GUIDE.md: ADVANCED_FEATURES.md 참조 제거. CollapsibleSection, ChartWidget( getChartData·Y축 고정·삭제 버튼 스타일), getChartData API, DashboardHeader/Filters 최신 설명 반영.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css, ChartWidget.jsx
- docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md

### Git
- 커밋 후 origin/main 푸시 완료.

---

## 2025-02-02: 차트 생성 전용 별도 조회 API (디멘션·메트릭 방식)

### 완료 작업
1. **원인**
   - 차트 생성이 대시보드 메인 집계 데이터(일자별 등)를 그대로 사용해, 캠페인/워크플로우 디멘션 선택 시 카디널리티가 높아져 X축 레이블 겹침·가독성 저하 발생.

2. **Adobe Analytics / Google Analytics 참고**
   - **Adobe**: Report Builder에서 디멘션(비수치·분류)과 메트릭(수치)을 요청 단위로 정의하고, 데이터 블록은 “한 요청 = 한 테이블”로 생성. 디멘션별·메트릭별 전용 요청으로 시각화 가독성 확보.
   - **GA**: Bar/Column 차트는 “한 디멘션 + 다중 메트릭” 또는 “두 디멘션 + 단일 메트릭” 구성 권장. 디멘션/메트릭을 Setup에서 명확히 설정 후 시각화.

3. **백엔드**
   - `dashboard_service.get_chart_data(req)`: 단일 디멘션·단일 메트릭으로 별도 SQL 집계. `dimension`(delivery_date/campaign_label/workflow_label/channel_name), `metric`, 동일 필터(date_range, campaign_ids, workflow_ids, channels), `limit`(기본 50) 지원.
   - `POST /api/dashboard/chart-data` 라우트 추가.

4. **프론트엔드**
   - `getChartData(body)` API 클라이언트 추가.
   - ChartWidget: `tableId`, `filters` 전달 시 `getChartData`로 차트 데이터 조회. 없으면 기존처럼 `data` prop으로 폴백.
   - SingleWidget: API 조회 중 “차트 데이터 조회 중...” 표시.

### 수정·추가 파일
- Backend/api_server/dashboard_service.py: get_chart_data, CHART_DIMENSION_KEYS, CHART_METRIC_KEYS
- Backend/api_server/routes.py: POST /api/dashboard/chart-data
- Frontend/react-app/src/shared/api/client.js: getChartData
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: tableId, filters, getChartData 연동
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx: ChartWidget에 tableId, filters 전달

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 막대 차트 X축 레이블 겹침 수정

### 완료 작업
1. **레이블 간격 확보(차트 생성 막대 차트)**
   - 막대 차트 영역에 `minWidth: max(280, chartData.length * LABEL_SLOT_WIDTH)` 적용. 슬롯당 100px(LABEL_SLOT_WIDTH) 확보로 recharts-cartesian-axis-tick(g) 겹침 제거.
   - `.chart-widget__chart-wrap`에 `overflow-x: auto` 추가. 필요 폭이 980px 초과 시 가로 스크롤로 전체 표시.

2. **막대·간격 조절**
   - `barCategoryGap="8%"`로 막대 간 간격 확보.
   - `maxBarSize`: 고정 75 → `Math.min(75, LABEL_SLOT_WIDTH * 0.55)`(약 55px)로 제한해 슬롯 내 여백 확보.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: ChartWidget.jsx 오류 없음.

---

## 2025-02-02: 차트 생성 섹션 레이아웃·안내 문구·버튼 패딩 조정

### 완료 작업
1. **차트 폭을 기준별 발송 현황과 동일하게 맞춤**
   - ChartWidget 내 SingleWidget 차트 영역을 `.chart-widget__chart-wrap`으로 감싸고, CSS에서 `max-width: 980px`, `margin: 0 auto` 적용(기준별 발송 현황의 `.aggregated-bar-chart__chart-wrap`과 동일).
   - 막대 차트의 `minWidth: chartData.length * LABEL_SLOT_WIDTH` 제거하여 차트가 섹션 폭을 넘어 과도하게 늘어나지 않도록 함.

2. **안내 문구 위치·패딩**
   - "Dimension: 집계 기준에서 선택한 항목만 표시. 두 개 이상이면 그중 선택 가능. Metric: 실수형 지표만. Y축은 선택한 Metric에 맞게 자동 조정." 문구를 섹션 헤더(접기/펼치기 제목) 바로 아래로 이동(ChartWidget 내 첫 번째 요소로 배치).
   - `.chart-widget__desc`에 `padding: 10px 0 0 10px`(상·좌 10px) 적용.

3. **차트 생성 버튼 우측 여백**
   - `.chart-widget__header`에 `padding-right: 30px` 적용하여 섹션 내 우측 여백 확보.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css: chart-widget 영역 스타일 수정·추가
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: 안내 문구 순서 변경, 차트 래퍼에 chart-widget__chart-wrap 적용

### 검수 결과
- Lint: ChartWidget.jsx, dashboard.css 오류 없음.

---

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
