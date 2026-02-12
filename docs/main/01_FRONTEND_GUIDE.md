# 프론트엔드 개발 가이드

본 문서는 **docs/main** 내 프론트엔드 전용 명세입니다. 구현 위치: `Frontend/react-app`.

---

## 1. 프론트엔드 개요

### 1.1 역할

- **React(Vite)** 단일 앱이며, **base 경로 `/ibank-bi/`** (vite.config.js) 로 서빙됩니다.
- **패키지**: report(쿼리 빌더), dashboard(집계 대시보드), **dashboard2**(성과리포트·기간 비교), **widgetboard**(위젯보드·드래그 앤 드롭 그리드). 공용 API·설정은 shared 에서 사용합니다.
- 정적 서버(`Frontend/static_server/main.py`)가 React 빌드 결과(`dist/`)를 서빙하며, `/ibank-bi` 요청 시 dist 기준 경로로 변환하고 SPA fallback, `/api-config.js` 주입으로 `window.APP_CONFIG.apiBaseUrl` 을 제공합니다.

### 1.2 접속 경로

- **로컬(DEV)**: `http://localhost:8080/ibank-bi/`, `.../report`, `.../dashboard`, `.../dashboard2`, `.../widgetboard`
- **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`** (동일 경로 report, dashboard, dashboard2, widgetboard). Nginx가 `/ibank-bi/` → 정적 서버, API는 api_base_url(예: `https://ajo.sdev-ibank.co.kr/report_api`) 로 호출.

### 1.3 프론트와 설정

- **config.frontend** (Env/config/config.json): static_port, main_page, api_base_url, static_dir.
- API 베이스 URL: 빌드 시 config 또는 런타임에 api-config.js 로 주입. `shared/config/api.js` 에서 사용.

---

## 2. 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 프레임워크/빌드 | Vite | 7.x, React 플러그인 |
| UI | React | 19.x |
| 라우팅 | react-router-dom | 7.x |
| 차트 | Recharts | Recharts 2.x (대시보드) |
| 스타일 | CSS | report.css, dashboard.css, main.css |
| API | fetch | shared/api/client.js 래퍼 |
| 언어 | JavaScript (ESM) | JSX |

- .env 미사용. API URL 등은 config.json → api-config.js 또는 shared/config 에서 처리.

---

## 3. 아키텍처·디렉토리 구조

```
Frontend/react-app/
├── src/
│   ├── App.jsx                 # 라우팅 (/, /report, /dashboard, /dashboard2)
│   ├── main.jsx
│   ├── index.css
│   ├── packages/
│   │   ├── report/             # 쿼리 빌더
│   │   │   ├── ReportPage.jsx  # 페이지·상태·실행·해석·페이지네이션·JOIN 설정
│   │   │   ├── index.jsx
│   │   │   ├── report.css
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.jsx   # 테이블·컬럼 목록, 드래그, JOIN 불가 비활성화
│   │   │   │   ├── MainArea.jsx  # 그리드·SQL 패널·해석 영역·페이지네이션 바
│   │   │   │   └── Header.jsx
│   │   │   ├── utils/
│   │   │   │   ├── sqlBuilder.js   # generateSQL, generateCountSQL, generateDistinctPivotSQL
│   │   │   │   ├── joinRules.js    # canAddTableByColumn, findIntermediateParent, isTableAvailable
│   │   │   │   ├── safetyCheck.js  # detectCircularReference, detectManyToMany, validateJoinPath, canAddTableSafely
│   │   │   │   ├── constants.js
│   │   │   │   └── helpers.js
│   │   │   └── __tests__/
│   │   │       ├── sqlBuilder.test.js
│   │   │       └── joinRules.test.js
│   │   │
│   │   ├── dashboard/          # 대시보드1
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── index.jsx
│   │   │   ├── dashboard.css
│   │   │   ├── utils/
│   │   │   │   └── periodCompare.js   # getWeekRange, getMonthRange, getYearRange, getPrevious* (일/주/월/연)
│   │   │   └── components/
│   │   │       ├── DashboardHeader.jsx   # 테이블·필수 컬럼 안내·보기(일반/일간·주간·월간·연간 비교)·기준·비교 일/주/월/연·집계 기준·정렬·캠페인/워크플로우/채널 필터
│   │   │       ├── TargetContextSection.jsx  # 목표(기간 유형·지표·목표값)·저장된 목표 목록
│   │   │       ├── CollapsibleSection.jsx
│   │   │       ├── KPICards.jsx   # KPI 카드·표시 지표 선택·목표 대비 신호등·compareKpi 시 ±n% vs 비교기간
│   │   │       ├── ChannelDonutCharts.jsx   # 비교 시 기준/비교 블록 구분
│   │   │       ├── AggregatedBarChart.jsx   # 기준별 발송·복수 차원 시 X축 단일 차원(일자 제외)·디멘션별 비교/요약
│   │   │       ├── AggregatedDataTable.jsx   # 집계 테이블·비교 시 merged/summary·필터 툴바
│   │   │       ├── ChartWidget.jsx       # 차트 생성 (Dimension/Metric/막대·선형·영역, 전용 API·Y축 고정·X축 검색)
│   │   │       └── ChartWidget2.jsx      # 위젯 생성 (beta): 파이·도넛·레이더·산점도·막대·선형·영역
│   │   │
│   │   ├── dashboard2/        # 대시보드2 (성과리포트·기간 비교)
│   │   │   ├── Dashboard2Page.jsx
│   │   │   ├── index.jsx
│   │   │   ├── dashboard2.css
│   │   │   ├── utils/
│   │   │   │   └── periodCompare.js   # getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange
│   │   │   └── components/
│   │   │       ├── Dashboard2Header.jsx   # 테이블·보기 모드(일반/일간·주간·월간·연간)·기준·비교 주/월/일/연·집계·정렬·필터
│   │   │       ├── KPICards2.jsx   # KPI 카드·비교 시 전 기간 대비 ±n%
│   │   │       ├── AggregatedDataTable2.jsx   # 집계 테이블·디멘션별 비교/요약·CompareMergedTable/CompareSummaryTable·필터 툴바
│   │   │       ├── EChartsChart.jsx   # ECharts 옵션·rate형 Y축 소수점 둘째자리
│   │   │       ├── AggregatedBarChart2.jsx   # 기준별 발송·복수 차원 시 X축 단일 차원(일자 제외)·MergedBarChart/SummaryBarChart
│   │   │       ├── ChannelDonutCharts2.jsx   # 비교 시 기준/비교 블록·색상 구분·데이터 없음 문구
│   │   │       ├── CollapsibleSection2.jsx
│   │   │       └── TargetContextSection.jsx
│   │   │
│   │   └── widgetboard/       # 위젯보드 (드래그 앤 드롭 그리드)
│   │       ├── Dashboard3Page.jsx
│   │       ├── index.jsx
│   │       ├── widgetboard.css
│   │       └── utils/
│   │           └── dataUtils.js
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   └── PeriodLabel.jsx # 기간 표시 (기준일/기간 뱃지, dateRange.formatDateRangeLabel 연동)
│   │   ├── api/
│   │   │   └── client.js       # listTables, executeQuery, explainSql, getDashboardData 등
│   │   └── config/
│   │       └── api.js          # API 베이스 URL 반환
│   │
│   └── styles/
│       └── main.css
│
├── index.html
├── vite.config.js              # base: '/ibank-bi/'
└── dist/                        # npm run build 결과 (정적 서버가 서빙)
```

- **정적 서버**: `Frontend/static_server/main.py`. `config.frontend.static_dir` = `Frontend/react-app/dist`, `/ibank-bi*` 요청 처리, 미존재 경로 → index.html.

---

## 4. 패키지별 구성

### 4.1 report (쿼리 빌더)

- **ReportPage.jsx**: 그리드 컬럼·추가 테이블·필터·정렬·집계·피벗·HAVING·날짜 단위·실행·페이지네이션 상태. joinMode, relationshipOptions, joinConditions, joinTypes, joinLogicalOperators, joinConfigs, tableRelationships, groupBy, pivot, pivotRowAggs, dateGranularity, havings. `runExecuteQuery`, `runExplainSql`, 초기화. Sidebar, MainArea 에 props 전달.
- **Sidebar**: 테이블 목록, 테이블별 컬럼(드래그 가능). JOIN 불가 테이블 비활성화(`joinRules.isTableAvailable`). `list-tables`, `table-relationships` 연동.
- **MainArea**: 드롭 존·그리드·필터/정렬 칩·SQL 패널(실행된 SQL, 🤖 해석, 📋 복사)·Claude 해석 영역·페이지네이션 바(처음/이전/다음/마지막, 페이지 크기 선택).
- **utils/sqlBuilder.js**: getJoinKey, generateSQL, generateCountSQL, generateDistinctPivotSQL. 옵션: joinConfigs(joinType, conditions, logicalOperator), groupBy, dateGranularity, havings, pivot, pivotRowAggs. 별칭(t1, t2) 사용.
- **utils/joinRules.js**: canAddTableByColumn(직접 관계만 추가 허용), findIntermediateParent(같은 부모_id 쓰는 두 테이블 시 끼워 넣을 부모), isTableAvailable(사이드바/드롭다운 노출 여부). relationshipOptions 기반.
- **utils/safetyCheck.js**: JOIN 안전성 검증 — detectCircularReference, detectManyToMany, validateJoinPath, canAddTableSafely. 테이블 추가 전 검증.
- **utils/constants.js**: OPERATOR_LABELS(WHERE/HAVING 연산자 한글), AGG_FUNCTIONS. **utils/helpers.js**: 기타 유틸.
- **__tests__/**: sqlBuilder.test.js, joinRules.test.js 등 단위 테스트.

**리포트 기능 요약**

- 사이드바에서 테이블/컬럼 드래그 → 그리드 추가, 헤더 드래그로 순서 변경. JOIN 시 직접 관계·중간 부모 끼워 넣기·순환/N:N 검사.
- 기준축·피벗·HAVING·조건·정렬·날짜 단위·집계 함수. JOIN 유형(LEFT/INNER/RIGHT)·복합 조건(AND/OR). SQL 자동 생성 후 실행·페이지네이션(건수 선택).
- 실행된 SQL 표시·복사·Claude 해석(백엔드 `/api/explain-sql` 경유). 초기화 시 그리드·필터·정렬·집계·피벗 등 전부 리셋.

### 4.2 dashboard (대시보드)

- **DashboardPage.jsx**: 테이블 ID·필터·**view_mode**(일반/일간·주간·월간·연간 비교)·compareData·compareRange. **디멘션별 비교(B)/요약 보기(A)** 토글(showCompareSummary). buildMergedCompareData·buildSummaryCompareData·mergedCompareData·summaryCompareData·mergedChartData·summaryChartData. 목표(targets)·getDashboardData 2회(비교 시 기준·비교). **periodCompare.js** 연동(getWeekRange, getMonthRange, getYearRange, getPrevious*). TargetContextSection·KPI(compareKpi)·도넛·막대(compareView·mergedChartData·summaryChartData)·집계 테이블(compareTableMode·mergedTableData·summaryTableData)·ChartWidget·ChartWidget2. 비교 모드 시 위젯은 **기준 기간/비교 기간** 셀렉트(widgetPeriodChoice)로 선택한 기간만 표시. PeriodLabel·CollapsibleSection.
- **utils/periodCompare.js**: getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange (대시보드2와 동일 규격).
- **TargetContextSection**: 목표·컨텍스트 섹션. 기간 유형(연/월/기간)·지표·년도·월/기간·목표값 입력·저장. 저장된 목표 테이블·삭제. targets, onSave, onDelete props.
- **DashboardHeader**: 테이블 셀렉트, 필수 컬럼 안내, 캠페인·워크플로우·채널 multi-select. **보기 라디오**(일반→일간 비교→주간 비교→월간 비교→연간 비교), 기준·비교 일/주/월/연 입력. 초기화·실행 버튼.
- **CollapsibleSection**: 섹션 제목·접기/펼치기 토글.
- **KPICards**: 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭, 성공률·실패률·오픈률·클릭률. rate 00.00% 포맷. 표시 지표 선택(`dashboard_kpi_visible`). 목표 대비 신호등(targetStatusByKey). **compareKpi** 시 "±n% vs 비교기간" 표시.
- **ChannelDonutCharts**: 채널별 도넛. **비교 시** 기준/비교 블록 배경·테두리(donut-period-block--base/--compare)·색상 구분.
- **AggregatedBarChart**: 기준별 발송 현황 막대(상위 10건, success_count 기준). **비교 시** compareView·mergedChartData·summaryChartData로 디멘션별 비교(MergedBarChart)/요약(SummaryBarChart) 전환. **복수 차원 시** getPrimaryDimensionForChart(일자 제외)·aggregateByPrimaryDimension으로 X축 단일 차원만 표시.
- **AggregatedDataTable**: 집계 테이블, 페이징·테이블 내 검색. **비교 시** compareTableMode(merged/summary)·정렬 행·필터 툴바·CompareMergedTable/CompareSummaryTable.
- **ChartWidget**: 차트 생성. Dimension/Metric/막대·선형·영역, 전용 API·Y축 고정·X축 검색 찾기/다음.
- **ChartWidget2**: 위젯 생성 (beta). 파이·도넛·레이더·산점도·막대·선형·영역. Y축-플롯 세로 길이 일치. 비교 모드 시 차트 기간 셀렉트(기준 기간|비교 기간)로 선택한 기간만 반영.
- **PeriodLabel** (shared/components/PeriodLabel.jsx): 기간 표시. filters.date_range → formatDateRangeLabel 뱃지. 주요 지표·채널별 분석 CollapsibleSection 본문 최상단에 배치.

### 4.3 dashboard2 (성과리포트)

- **Dashboard2Page.jsx**: 테이블 ID·필터·view_mode(일반/**day_compare**/week_compare/month_compare/**year_compare**)·compare_base_day/week/month/year·compare_day/week/month/year. loadData 시 기준 기간 1회·비교 기간 1회 getDashboard2Data 호출. compareRange useMemo(일간/주간/월간/연간 분기). **디멘션별 비교(B)/요약 보기(A)** 토글·mergedChartData·summaryChartData·mergedTableData·summaryTableData. **getPrimaryDimensionForChart**(일자 제외)·**buildMergedCompareDataSingleDimension**로 기준별 발송 차트 복수 차원 시 X축 단일 차원. hasDateAndOther 시 keyOfNoDate·aggregateByKeyNoDate로 일자 제외 키 머지. TargetContextSection·KPICards2(compareKpi)·채널 도넛·막대(AggregatedBarChart2 compareView·mergedChartData·summaryChartData)·AggregatedDataTable2·위젯 생성(EChartsChart). 비교 모드 시 기준 기간/비교 기간 차트 각각 렌더.
- **Dashboard2Header.jsx**: 테이블 셀렉트·필수 컬럼 info. 보기 모드 라디오(일반/일간 비교/주간 비교/월간 비교/연간 비교). 기준·비교 일/주/월/연 입력(비어두면 전일/전 주/전 월/전년). 집계 기준·정렬·캠페인·워크플로우·채널 필터.
- **utils/periodCompare.js**: getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, **getPreviousDay**, **getYearRange**, **getPreviousYearRange**. ISO 주(월~일)·달력 월 1일~말일·연도 1/1~12/31.
- **KPICards2.jsx**: KPI 순서(캠페인→워크플로우→채널→발송요청→성공수→실패수→성공률→실패율→오픈→클릭→오픈률→클릭률). compareKpi 시 이전 기간 값·±n% vs 이전기간 표시.
- **AggregatedDataTable2.jsx**: 컬럼 순서 발송요청→발송성공→성공률→오픈→클릭→오픈률→클릭률. rate 셀 채우기 막대·내부 테두리만. **디멘션별 비교** 시 CompareMergedTable(기준/비교 컬럼 배경 구분·오픈률·클릭률 포함)·**요약** 시 CompareSummaryTable. 정렬 행·필터 툴바(getMergedColumnOptions/getSummaryColumnOptions·rowMatchesFiltersWithGetCell)·필터 적용 건수.
- **AggregatedBarChart2.jsx**: 기준별 발송 막대. **복수 차원 시** getPrimaryDimensionForChart(일자 제외)·aggregateByPrimaryDimension으로 X축 단일 차원만. compareView 시 MergedBarChart(기준/비교 막대 색상 구분)·SummaryBarChart.
- **ChannelDonutCharts2.jsx**: 비교 시 기준/비교 블록 배경·테두리·색상(dashboard2-donut-period-block--base/--compare). 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
- **EChartsChart.jsx**: buildOptionFromCustom(chartData, metricLabel, chartType, metricKey). rate형 지표 시 Y축·툴팁 소수점 둘째자리. info 버튼 차트유형 셀렉트 오른쪽.

**대시보드2 기능 요약**

- 보기 모드: 일반 / 일간·주간·월간·연간 비교(기준·비교 일/주/월/연 선택, 비어두면 전일/전 주/전 월/전년). 기간 라벨 "기준: … / 비교: …".
- 디멘션별 비교(B)/요약 보기(A) 토글. 기준별 발송·집계 테이블 복수 차원 시 **X축 단일 차원(일자 제외)**. KPI 순서 통일·비교 시 ±n%. 집계 테이블 컬럼 순서·rate 채우기 막대·내부 테두리·디멘션별 비교 시 기준/비교 컬럼 배경 구분. 위젯: rate형 Y축 소수점 둘째자리·info 버튼 차트유형 오른쪽. 비교 시 기준 기간/비교 기간 차트 각각.

**대시보드 기능 요약**

- 테이블 선택(필수 컬럼·타입 만족 테이블만 노출), 기간·캠페인·워크플로우·채널 필터(전체 옵션·디폴트 전체), 집계 기준·정렬 기준.
- **비교 모드**: 일반/일간/주간/월간/연간. 기준·비교 일/주/월/연 선택. **디멘션별 비교(B)/요약 보기(A)** 토글. 기준별 발송·집계 테이블 복수 차원 시 **X축 단일 차원(일자 제외)**.
- 목표 섹션: 기간 유형·지표·목표값 저장(localStorage)·저장된 목표 목록·삭제.
- **기간 표시**: 주요 지표·채널별 분석 섹션 상단 PeriodLabel(기준일/기간 뱃지).
- KPI 카드(캠페인/워크플로우/채널 수·rate 00.00%·표시 지표 선택·목표 대비 신호등·compareKpi 시 ±n% vs 비교기간), 채널 도넛(비교 시 기준/비교 블록 구분), 기준별 막대 차트(복수 차원 시 X축 단일 차원·일자 제외), 집계 테이블(페이징·검색·비교 시 merged/summary·필터 툴바), 차트 생성 위젯, **위젯 생성 (beta)**(ChartWidget2). 비교 모드 시 위젯은 기준 기간/비교 기간 셀렉트로 선택한 기간만 표시. 필수 컬럼 안내 모달. 섹션 접기/펼치기(차트 생성·위젯 생성 beta 기본 접힘).

### 4.4 widgetboard (위젯보드)

- **Dashboard3Page.jsx**: 드래그 앤 드롭 위젯 그리드 대시보드. App에서 `/widgetboard` 라우트로 렌더. 레이아웃·위젯 설정은 localStorage 저장(`widgetboard_layout`, `widgetboard_widget_configs`). 기존 대시보드·리포트 API 및 shared 데이터 유틸 활용.
- **index.jsx**: WidgetboardPage export. App.jsx에서 `/widgetboard` → WidgetboardPage.
- **utils/dataUtils.js**: 위젯보드용 데이터 처리 유틸.
- **widgetboard.css**: 위젯보드 전용 스타일(헤더·사이드바·캔버스·드래그 오버 등).

### 4.5 shared

- **api/client.js**: health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats, getDashboardData, getDashboardFilterOptions, getDashboardTables, getDashboardRequiredColumns, getChartData, getDashboard2Tables, getDashboard2FilterOptions, getDashboard2Data, getDashboard2RequiredColumns, getDashboard2ChartData. (리포트 save-query-as-table·join-order 등 추가 API는 필요 시 client에 래퍼 추가.)
- **config/api.js**: API 베이스 URL (환경·api-config 주입 반영).

---

## 5. 추가 기능 (리포트)

### 5.1 Claude API 쿼리 해석

- **역할**: 실행된 SQL을 백엔드 경유로 Claude API에 보내 자연어 해석을 받아 표시합니다.
- **API 키**: 백엔드 설정(`config.backend.claude_api_key`, `claude_api_url`)만 사용. 프론트에는 노출되지 않습니다.
- **동작**: 쿼리 실행 후 **🤖 해석** 클릭 → `POST /api/explain-sql` 로 SQL 전달 → 백엔드가 Claude 호출 후 해석 문구 반환 → MainArea 의 **💬 Claude 해석** 영역에 표시.
- **구현**: ReportPage `runExplainSql` → `client.explainSql()` → MainArea 해석 영역.
- **UI**: SQL 패널 헤더에 "📄 실행된 SQL | 🤖 해석 | 📋 복사". 해석 요청 시 로딩 문구 후 결과 표시, 닫기로 숨김.
- **주의**: claude_api_key 비어 있으면 explain-sql 오류 가능. 토큰 과금·Rate Limit 유의.

### 5.2 페이지네이션 (LIMIT / OFFSET)

- **역할**: LIMIT + OFFSET 페이지 단위 조회. 전체 건수는 **COUNT 쿼리**로 별도 조회(generateCountSQL + execute-query).
- **동작**: 실행 시 ReportPage 에서 generateCountSQL → apiExecuteQuery(countSQL) → setTotalCount. 이어서 generateSQL(LIMIT/OFFSET) 실행. 페이지/페이지 크기 변경 시 runExecuteQuery 재호출. 컬럼 추가·필터·정렬·집계·피벗 변경 시 currentPage=1 로 리셋 후 실행.
- **UI**: 그리드 하단 페이지네이션 바(결과가 있을 때만): 현재 범위/총 건수, ⏮️처음 ◀이전 페이지 N/M 다음▶ 마지막⏭️, 페이지 크기(50/100/200/500 등). MainArea 에서 currentPage, pageSize, totalCount, onSetPage, onSetPageSize props 로 제어.
- **주의**: COUNT + 데이터로 2회 실행. 대용량 시 COUNT 지연·OFFSET 큰 경우 지연 가능.

---

## 6. 스타일링

- **report.css**: 리포트 패키지 전용 (사이드바, 그리드, SQL 패널, 필터/정렬 칩, 페이지네이션 바, 해석 영역 등).
- **dashboard.css**: 대시보드1 패키지 전용 (헤더, 필터, KPI, 차트, 테이블, 모달, 집계 테이블 rate 채우기·내부 테두리 등).
- **dashboard2.css**: 대시보드2 패키지 전용 (헤더, 보기 모드·기준/비교 주·월·일·연, KPI, 디멘션별 비교 토글·기간 라벨, 집계 테이블 rate 채우기·내부 테두리·기준/비교 컬럼 배경, 위젯·차트유형 wrap, 도넛 기준/비교 블록 등).
- **widgetboard.css**: 위젯보드 패키지 전용.
- **main.css / index.css**: 앱 공통. 별도 유틸리티 CSS 프레임워크 없음.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 (간결, 세부는 01/02 참고) |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 (본 문서) |
| 02_BACKEND_FASTAPI_MIGRATION_PLAN.md | 백엔드 FastAPI 구조·라우터·전환 계획·현재 구성 정밀 명세 |

- docs/report: 배포·실행 로그·nginx 등.
