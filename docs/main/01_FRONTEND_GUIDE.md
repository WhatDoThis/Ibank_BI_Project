# 프론트엔드 개발 가이드

본 문서는 **docs/main** 내 프론트엔드 전용 명세입니다. 구현 위치: `Frontend/react-app`.

---

## 1. 프론트엔드 개요

### 1.1 역할

- **React(Vite)** 단일 앱이며, **base 경로 `/ibank-bi/`** (vite.config.js) 로 서빙됩니다.
- **패키지**: report(쿼리 빌더), dashboard(집계 대시보드), dashboard2(ECharts 템플릿 대시보드). 공용 API·설정은 shared 에서 사용합니다.
- 정적 서버(`Frontend/static_server/main.py`)가 React 빌드 결과(`dist/`)를 서빙하며, `/ibank-bi` 요청 시 dist 기준 경로로 변환하고 SPA fallback, `/api-config.js` 주입으로 `window.APP_CONFIG.apiBaseUrl` 을 제공합니다.

### 1.2 접속 경로

- **로컬(DEV)**: `http://localhost:8080/ibank-bi/`, `.../report`, `.../dashboard`, `.../dashboard2`
- **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`** (동일 경로 report, dashboard, dashboard2). Nginx가 `/ibank-bi/` → 정적 서버, API는 api_base_url(예: `https://ajo.sdev-ibank.co.kr/report_api`) 로 호출.

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
| 차트 | Recharts, ECharts | Recharts 2.x (대시보드), ECharts 6.x (대시보드2) |
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
│   │   │   ├── ReportPage.jsx  # 페이지·상태·실행·해석·페이지네이션
│   │   │   ├── index.jsx
│   │   │   ├── report.css
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.jsx   # 테이블·컬럼 목록, 드래그
│   │   │   │   ├── MainArea.jsx  # 그리드·SQL 패널·해석 영역·페이지네이션 바
│   │   │   │   └── Header.jsx
│   │   │   └── utils/
│   │   │       ├── sqlBuilder.js  # generateSQL, generateCountSQL 등
│   │   │       ├── constants.js
│   │   │       └── helpers.js
│   │   │
│   │   └── dashboard/          # 대시보드
│   │       ├── DashboardPage.jsx
│   │       ├── index.jsx
│   │       ├── dashboard.css
│   │       └── components/
│   │           ├── DashboardHeader.jsx   # 테이블 선택·필수 컬럼 안내 모달
│   │           ├── DashboardFilters.jsx  # 기간·캠페인·워크플로우·채널·집계 기준
│   │           ├── CollapsibleSection.jsx
│   │           ├── KPICards.jsx
│   │           ├── ChannelDonutCharts.jsx
│   │           ├── AggregatedBarChart.jsx
│   │           ├── AggregatedDataTable.jsx
│   │           └── ChartWidget.jsx       # 차트 생성 (Dimension/Metric/막대·선형·영역, 전용 API·Y축 고정·X축 검색 찾기/다음)
│   │   │
│   │   └── dashboard2/          # ECharts 대시보드
│   │       ├── Dashboard2Page.jsx
│   │       ├── index.jsx
│   │       ├── dashboard2.css
│   │       └── components/
│   │           └── EChartsChart.jsx  # ECharts 템플릿·커스텀, dataZoom·X축 검색·강조·선형/영역 Y축 scale
│   │
│   ├── shared/
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

- **ReportPage.jsx**: 그리드 컬럼·추가 테이블·필터·정렬·집계·피벗·HAVING·날짜 단위·실행·페이지네이션 상태. `runExecuteQuery`, `runExplainSql`, 초기화. Sidebar, MainArea 에 props 전달.
- **Sidebar**: 테이블 목록, 테이블별 컬럼(드래그 가능). JOIN 불가 테이블 비활성화. `list-tables`, `table-relationships` 연동.
- **MainArea**: 드롭 존·그리드·필터/정렬 칩·SQL 패널(실행된 SQL, 🤖 해석, 📋 복사)·Claude 해석 영역·페이지네이션 바(처음/이전/다음/마지막, 페이지 크기 선택).
- **sqlBuilder.js**: SELECT/WHERE/ORDER BY/GROUP BY/HAVING/LIMIT·OFFSET 생성, COUNT 쿼리 생성. 별칭(t1, t2) 사용.

**리포트 기능 요약**

- 사이드바에서 테이블/컬럼 드래그 → 그리드 추가, 헤더 드래그로 순서 변경.
- 기준축·피벗·HAVING·조건·정렬·날짜 단위·집계 함수. SQL 자동 생성 후 실행·페이지네이션(건수 선택).
- 실행된 SQL 표시·복사·Claude 해석(백엔드 `/api/explain-sql` 경유). 초기화 시 그리드·필터·정렬·집계·피벗 등 전부 리셋.

### 4.2 dashboard (대시보드)

- **DashboardPage.jsx**: 테이블 ID·기간·캠페인·워크플로우·채널 필터·집계 기준 상태. `getDashboardData`, `getDashboardFilterOptions` 호출. KPI·도넛·막대·집계 테이블·ChartWidget 배치. CollapsibleSection으로 섹션 접기/펼치기.
- **DashboardHeader**: 테이블 셀렉트, 필수 컬럼 안내 모달, 초기화·실행 버튼.
- **DashboardFilters**: 기간·캠페인·워크플로우·채널 필터·집계 기준 체크·정렬 기준. 선택 필터에 따른 옵션 연동.
- **CollapsibleSection**: 섹션 제목·접기/펼치기 토글.
- **KPICards**: 총 발송·성공·실패 등 KPI 카드.
- **ChannelDonutCharts**: 채널별 도넛.
- **AggregatedBarChart**: 기준별 발송 현황 막대 차트(상위 10건, success_count 기준).
- **AggregatedDataTable**: 집계 데이터 테이블, 페이징·테이블 내 검색.
- **ChartWidget**: 차트 생성. Dimension/Metric/막대·선형·영역 선택, 제목 편집. tableId·filters 있으면 `getChartData` 전용 API로 조회(LIMIT 없음). 막대·선형·영역 공통: Y축 고정·가로 스크롤·X축 minWidth·XAxisTickTruncate. X축 레이블 검색(찾기/다음·Enter 연속·강조·마우스 이동 시 해제). 삭제 버튼(연한 빨간 배경·흰글씨).

### 4.3 dashboard2 (ECharts 대시보드)

- **Dashboard2Page.jsx**: 테이블·필터·집계 기준은 dashboard와 동일. 차트 유형(템플릿) 선택·커스텀 차트(디멘션·메트릭·유형) 선택. EChartsChart 로 렌더.
- **EChartsChart.jsx**: 템플릿(일자별 발송 성공/요청/요청·성공, 오픈/클릭/오픈·클릭, 전 메트릭 등) 또는 customChartData·metricLabel·chartType 으로 단일 시리즈. dataZoom(카테고리 10개 초과 시 슬라이더·inside), X축 레이블 검색(찾기/다음·Enter·강조·마우스 이동 해제), emphasis 스타일. 선형/영역 시 Y축 scale:true(데이터 구간 기준). 차트 영역 패딩·검색 필터 패딩.

**대시보드2 기능 요약**

- 대시보드와 동일한 테이블·필터·집계. ECharts 기반 템플릿 차트 7종 또는 나만의 차트(디멘션·메트릭·막대/선형/영역). dataZoom 구간 선택·X축 검색으로 이동·찾은 항목 강조.

**대시보드 기능 요약**

- 테이블 선택(필수 컬럼·타입 만족 테이블만 노출), 기간·캠페인·워크플로우·채널 필터, 집계 기준·정렬 기준.
- KPI 카드, 채널 도넛, 기준별 막대 차트, 집계 테이블(페이징·검색), 차트 생성 위젯(전용 API·Y축 고정·가로 스크롤). 필수 컬럼 안내 모달. 섹션 접기/펼치기.

### 4.4 shared

- **api/client.js**: health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats, getDashboardData, getDashboardFilterOptions, getDashboardTables, getDashboardRequiredColumns, getChartData.
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
- **dashboard.css**: 대시보드 패키지 전용 (헤더, 필터, KPI, 차트, 테이블, 모달 등).
- **main.css / index.css**: 앱 공통. 별도 유틸리티 CSS 프레임워크 없음.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 (간결, 세부는 01/02 참고) |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 (본 문서) |
| 02_BACKEND_FASTAPI_MIGRATION_PLAN.md | 백엔드 FastAPI 구조·라우터·전환 계획·현재 구성 정밀 명세 |

- docs/report: 배포·실행 로그·nginx 등.
