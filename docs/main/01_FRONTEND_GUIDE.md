# 프론트엔드 개발 가이드

본 문서는 **docs/main** 내 프론트엔드 전용 명세이며, **현재 코드 기준** 경로·패키지·API만 기술한다. 구현 위치: `Frontend/react-app`. 작업 이력은 **docs/log/log.md** 참고. 백엔드 패키지와의 대응·전체 지도는 **03_AI_DEVELOP_GUIDE.md** 참고.

---

## 1. 프론트엔드 개요

### 1.1 역할

- **인증(S5/S6)**: `/login` — 이메일·비밀번호 후 2차 코드, `POST /api/auth/login`·`verify-login`. `/signup`(초대 코드)·`/create-org`(부서 생성)는 공개 라우트. 토큰은 `localStorage`, API는 `shared/api/http.js` 가 `Authorization: Bearer`·401 시 `refresh` 후 1회 재시도. `/` — `GET /api/projects`·`POST /api/projects/{id}/select`. 리포트·대시보드·위젯 경로는 JWT에 `project_info_id` 없으면 `/` 로 유도(`NeedProjectRoute`). ETL은 `user_dvsn` 이 `sa_dev`·`etl_manager` 일 때만 네비·`/etl` (`EtlAccessRoute`, 백엔드 `require_etl_infrastructure` 와 동일).
- **React(Vite)** 단일 앱이며, **base 경로 `/ibank-bi/`** (vite.config.js) 로 서빙됩니다.
- **패키지**: report, **campaign_dashboard**(대시보드 UI 단일), **widgetboard**, **etl**. **공용 최소**: `shared/config/api.js`(베이스 URL), `shared/api/http.js`(JSON `request`·`fetchOkJson`). **패키지별 API**는 각 `packages/<이름>/api/*Client.js` 에 둔다.
- 정적 서버(`Frontend/static_server/main.py`)가 React 빌드 결과(`dist/`)를 서빙하며, `/ibank-bi` 요청 시 dist 기준 경로로 변환하고 SPA fallback, `/api-config.js` 주입으로 `window.APP_CONFIG.apiBaseUrl` 을 제공합니다.

### 1.2 접속 경로

- **로컬(DEV)**: `http://localhost:8080/ibank-bi/`, `.../query-studio`, `.../dashboard`, `.../widgetboard`, `.../etl` (`/campaign-dashboard` → `/dashboard` 리다이렉트)
- **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`**. Nginx가 `/ibank-bi/` → 정적 서버, API는 api_base_url 로 호출.

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
| 스타일 | CSS | queryStudio.css, campaign-dashboard.css, main.css |
| API | fetch | `shared/api/http.js` + 패키지별 `api/*Client.js` |
| 언어 | JavaScript (ESM) | JSX |

- .env 미사용. API URL 등은 config.json → api-config.js 또는 shared/config 에서 처리.

---

## 3. 아키텍처·디렉토리 구조

```
Frontend/react-app/
├── src/
│   ├── App.jsx                 # BrowserRouter·상단 네비
│   ├── app/
│   │   ├── navConfig.js        # NAV_ITEMS
│   │   └── routes.jsx          # AppRoutes (Route 트리)
│   ├── main.jsx
│   ├── index.css
│   ├── packages/
│   │   ├── query_studio/       # 쿼리 스튜디오(쿼리 빌더)
│   │   │   ├── QueryStudioPage.jsx  # 페이지·상태·실행·해석·페이지네이션·JOIN 설정
│   │   │   ├── index.jsx
│   │   │   ├── queryStudio.css
│   │   │   ├── api/
│   │   │   │   └── queryStudioClient.js
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
│   │   ├── campaign_dashboard/  # 대시보드 (캠페인·Star) — 라우트 /dashboard
│   │   │   ├── CampaignDashboardPage.jsx, campaign-dashboard.css, index.jsx
│   │   │   ├── api/campaignDashboardClient.js
│   │   │   └── components/     # SummaryHeader, TrendLineChart, … (new-dashboard 복사 기반)
│   │   │
│   │   ├── widgetboard/       # 위젯보드 (드래그 앤 드롭 그리드)
│   │   │   ├── Dashboard3Page.jsx
│   │   │   ├── index.jsx
│   │   │   ├── widgetboard.css
│   │   │   └── utils/
│   │   │       └── dataUtils.js
│   │   │
│   │   └── etl/               # ETL (단일) — 파일·DB·저장 DB·폴더/DB 배치
│   │       ├── ETLPage.jsx
│   │       ├── index.jsx
│   │       ├── etl.css
│   │       ├── api/etlClient.js
│   │       ├── utils/
│   │       │   └── storageDb.js        # storage_connection_id 정규화(기본 DB null 통일)
│   │       └── components/
│   │           ├── SourceTypeSelector.jsx   # 탭: 파일|DB|폴더|저장 DB 등록|ETL 이력
│   │           ├── FileUploadForm.jsx       # 단계 안내·etlInferSchema·테이블선택 및 컬럼매핑
│   │           ├── DbConnectionForm.jsx    # 저장 DB 선택·소스 컬럼·테이블선택 및 컬럼매핑·증분 컬럼·on_row_error
│   │           ├── FolderConnectionFormFile.jsx   # 폴더(SFTP/S3) 연결 등록
│   │           ├── FolderConnectionListFile.jsx   # 등록된 폴더 연결 목록·연결 정보 열(SFTP=host, S3=버킷/리전)
│   │           ├── BatchJobFormFile.jsx     # 배치 Job 등록(패턴·타겟·저장 DB·주기·index_definitions)·중복 시 안내
│   │           ├── BatchJobListFile.jsx     # 배치 Job 목록·새로고침·활성/비활성·즉시실행·이력·삭제
│   │           ├── BatchHistoryPanelFile.jsx # 배치 이력 목록·새로고침·폴링(running 시)·partial_error 시 "일부 실패 (N/M 성공)"
│   │           ├── BatchHistoryDetailFile.jsx # 이력 1건 상세·파일별 결과·원격 삭제·적재 롤백
│   │           ├── SkippedFilesPanelFile.jsx # 스킵/에러 파일 목록·원격 삭제
│   │           ├── CollapsibleCardSection.jsx # DB·폴더·저장 DB 섹션 접기/펼치기
│   │           ├── StorageConnectionForm.jsx # 저장 DB(적재 대상) 등록·테스트
│   │           ├── TargetTableSelectModal.jsx # 저장 DB 테이블·소스→타겟 매핑·PK·INDEX 열(✓ 읽기 전용)·변환(타입·값매핑·날짜/시간 연산 등)·인덱스 추가(테이블 아래)·미리보기
│   │           ├── (TargetTableSelectModal 내) TransformPreviewPanel # 변환 미리보기(before/after)·POST /api/etl/transform/preview
│   │           ├── ETLTableList.jsx         # 목록(etlListTables+배치 레지스트리)·배치 행 삭제=cascade·배치설정 버튼(status=done 시 활성)·새로고침
│   │           ├── BatchScheduleModal.jsx  # ETL 테이블 기반 배치 등록/수정/토글/삭제/즉시실행(batchCreateJobFromEtlTable·batchListJobs db)
│   │           ├── EtlTableSettingsModal.jsx # 설정 모달: 동기화 모드(전체/증분/diff)·증분 컬럼·배치·on_row_error
│   │           ├── JobHistoryPanel.jsx      # ETL 이력·새로고침
│   │           ├── JobLogPanel.jsx
│   │           ├── AddFileModal.jsx
│   │           ├── PkColumnsModal.jsx
│   │           └── PreviewModal.jsx
│   │
│   ├── shared/
│   │   ├── api/
│   │   │   └── http.js         # request(), fetchOkJson() — 패키지 *Client.js 공통
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

- **QueryStudioPage.jsx**: 그리드 컬럼·추가 테이블·필터·정렬·집계·피벗·HAVING·날짜 단위·실행·페이지네이션 상태. joinMode, relationshipOptions, joinConditions, joinTypes, joinLogicalOperators, joinConfigs, tableRelationships, groupBy, pivot, pivotRowAggs, dateGranularity, havings. `runExecuteQuery`, `runExplainSql`, 초기화. Sidebar, MainArea 에 props 전달.
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

### 4.2 campaign_dashboard (대시보드 — Star /api/campaign-dashboard)

- **CampaignDashboardPage.jsx**: 발송 KPI·추이·회원·인구통계·시간대 등. **API**: `packages/campaign_dashboard/api/campaignDashboardClient.js`. 라우트 **`/dashboard`** (`/campaign-dashboard` → 리다이렉트). Backend **campaign_dash_server**. 상세 **02_BACKEND_GUIDE.md §4.6.2**.

### 4.3 widgetboard (위젯보드)

- **Dashboard3Page.jsx**: 드래그 앤 드롭 위젯 그리드 대시보드. `/widgetboard`. 위젯 데이터는 **report** API(`packages/query_studio/api/queryStudioClient.js` — listTables, describeTable, executeQuery) 사용.
- **index.jsx**: WidgetboardPage export. App.jsx에서 `/widgetboard` → WidgetboardPage.
- **utils/dataUtils.js**: 위젯보드용 데이터 처리 유틸.
- **widgetboard.css**: 위젯보드 전용 스타일(헤더·사이드바·캔버스·드래그 오버 등).

### 4.4 etl (ETL, 단일)

- **ETLPage.jsx**: 탭(파일 업로드 | DB 연결 | 폴더 | 저장 DB 등록 | ETL 이력). SourceTypeSelector → FileUploadForm, DbConnectionForm, 폴더 연결·배치 Job, StorageConnectionForm, JobHistoryPanel. ETLTableList(etlListTables+배치 레지스트리)·배치설정(status=done 시 활성). App.jsx에서 `/etl` 라우트. API prefix **/api/etl**, **/api/etl/batch/**.
- **SourceTypeSelector.jsx**: 소스 유형(파일 / PostgreSQL·MySQL·Oracle) 선택.
- **FileUploadForm.jsx**: 파일 업로드(CSV/Excel/Parquet), etlUploadFile(multipart). target_table·description·created_by. 업로드 파일은 서버에서 **3일** 초과 시 자동 삭제되며, 3일 후 동일 ETL 재실행 시 파일 없음으로 실패할 수 있음.
- **DbConnectionForm.jsx**: 연결 등록(이름·host·port·database·schema·username·password). **연결 테스트(etlTestConnection) 통과 후에만** 등록 가능. Oracle 선택 시 **서비스명(Service Name)** 라벨·안내(JDBC @호스트:1521/서비스명, SID 미지원)·placeholder 예: FREEPDB1. **등록된 연결** 목록·**ETL 테이블 등록** 연결 선택 옵션에 **호스트:포트/DB명** 형식 표시. 소스 테이블 목록(etlListConnectionTables)·타겟 테이블·설명·sync_mode(전체/증분)·batch_size·batch_interval_seconds·etlCreateTable. Oracle 소스 테이블 선택 시 **OWNER.TABLE_NAME**으로 저장(드롭다운 value·label). 2열 그리드·카드 섹션 UI. **DB 연결 실패 시**: 실제 연결은 브라우저가 아닌 Backend가 수행하므로, 외부 DB 방화벽에 **Backend가 실행 중인 호스트 IP**가 허용돼야 함.
- **ETLTableList.jsx**: etlListTables 목록. **목록 열**: 타겟 테이블·설명·PK·소스 유형·**연결**(connection_name, 서버 구분)·소스·**배치**(batch_size/batch_interval_seconds, "5,000행 / 1초" 등)·**동기화**(전체·증분·**PK 차이(diff)** 등)·상태(draft/error/done)·동작(미리보기·실행·데이터 추가·PK 설정·삭제). **도움말(?)**: 상태별 버튼 설명·배치·실행 시점 안내.
- **상태별 버튼 동작**:
  - **draft/error**(타겟 테이블 없거나 불확실): **미리보기** — 등록된 파일 읽어 10행+컬럼 표시. **실행** — 파일로 메인 DB DROP→CREATE→INSERT(전체 교체). **데이터 추가** — 타겟 테이블 없으면 실패(이미 있는 테이블에 새 파일 업서트용). **삭제** — 메타+파일 삭제, DROP TABLE IF EXISTS.
  - **done**(타겟 테이블 있음): **미리보기** — 동일(파일 10행). **실행** — 파일로 테이블 **전체 교체**(실행 전 타겟 존재 시 컨펌). **데이터 추가** — 새 파일을 같은 타겟 테이블에 PK 기준 **업서트**(분할 적재용). **삭제** — 메타+파일 삭제, 테이블 DROP.
- **배치·실행 시점**(도움말 및 UI 안내): **배치 크기·배치 간 대기**는 **한 번 실행할 때** 소스에서 몇 행씩 가져오는지·배치마다 쉬는 초. **"매일 몇 시 자동 실행"**은 **미구현**. 실행은 **사용자가 "실행" 버튼을 눌렀을 때만** 대기열 등록 → 워커가 처리. draft/done 여부와 관계없이 자동 실행 없음.
- **JobHistoryPanel.jsx**: etlListJobs·etlGetJob 폴링. Job 목록·실행 이력·상태(pending→running→completed/failed/cancelled). 동시 실행 2건 제한.
- **AddFileModal.jsx**: 단일 파일 추가 적재. **ZIP 다중 파일**: etlAddFilesZipToTable. 서버가 ZIP 압축 해제 후 지원 형식(.csv, .xlsx, .xls, .parquet)·용량 한도 이하 파일만 순서대로 Job 등록. **건너뛴 파일**이 있으면 API 응답 skipped_files(파일명·사유: file_too_large, unsupported_format, schema_or_pk_failed 등)로 전달되며, UI에서 "다음 파일은 건너뛰었습니다" 안내+파일명·사유 목록 표시.
- **PreviewModal.jsx**: 미리보기 10행. **PkColumnsModal.jsx**: PK 컬럼 체크박스.
- **etl.css**: ETL 목록·연결·배치·동기화 열 스타일.
- **API**(`packages/etl/api/etlClient.js`): etl2ListTables, etl2UploadFile, batchListJobs, batchCreateJobFromEtlTable 등(함수명은 `etl2*`·`batch*` 접두). 라우트 **/etl**, API prefix **/api/etl**, **/api/etl/batch/**.

### 4.5 shared (최소 공용)

- **config/api.js**: `getApiBase()` — 빌드 주입·api-config.js 반영.
- **api/http.js**: `apiBaseUrl`, `request`(JSON POST/GET), `fetchOkJson`(GET + 상태 검사), `formatFetchErrorMessage`. 패키지별 `*Client.js`에서만 import.

엔드포인트 추가 시 **해당 패키지의 `api/*Client.js`** 와 `http.js`를 수정한다. (구 monolithic `client.js` 없음.)

---

## 5. 추가 기능 (리포트)

### 5.1 Claude API 쿼리 해석

- **역할**: 실행된 SQL을 백엔드 경유로 Claude API에 보내 자연어 해석을 받아 표시합니다.
- **API 키**: 백엔드 설정(`config.backend.claude_api_key`, `claude_api_url`)만 사용. 프론트에는 노출되지 않습니다.
- **동작**: 쿼리 실행 후 **🤖 해석** 클릭 → `POST /api/explain-sql` 로 SQL 전달 → 백엔드가 Claude 호출 후 해석 문구 반환 → MainArea 의 **💬 Claude 해석** 영역에 표시.
- **구현**: QueryStudioPage `runExplainSql` → `queryStudioClient.explainSql()` → MainArea 해석 영역.
- **UI**: SQL 패널 헤더에 "📄 실행된 SQL | 🤖 해석 | 📋 복사". 해석 요청 시 로딩 문구 후 결과 표시, 닫기로 숨김.
- **주의**: claude_api_key 비어 있으면 explain-sql 오류 가능. 토큰 과금·Rate Limit 유의.

### 5.2 페이지네이션 (LIMIT / OFFSET)

- **역할**: LIMIT + OFFSET 페이지 단위 조회. 전체 건수는 **COUNT 쿼리**로 별도 조회(generateCountSQL + execute-query).
- **동작**: 실행 시 QueryStudioPage 에서 generateCountSQL → apiExecuteQuery(countSQL) → setTotalCount. 이어서 generateSQL(LIMIT/OFFSET) 실행. 페이지/페이지 크기 변경 시 runExecuteQuery 재호출. 컬럼 추가·필터·정렬·집계·피벗 변경 시 currentPage=1 로 리셋 후 실행.
- **UI**: 그리드 하단 페이지네이션 바(결과가 있을 때만): 현재 범위/총 건수, ⏮️처음 ◀이전 페이지 N/M 다음▶ 마지막⏭️, 페이지 크기(50/100/200/500 등). MainArea 에서 currentPage, pageSize, totalCount, onSetPage, onSetPageSize props 로 제어.
- **주의**: COUNT + 데이터로 2회 실행. 대용량 시 COUNT 지연·OFFSET 큰 경우 지연 가능.

---

## 6. 스타일링

- **queryStudio.css**: 리포트 패키지 전용 (사이드바, 그리드, SQL 패널, 필터/정렬 칩, 페이지네이션 바, 해석 영역 등).
- **campaign-dashboard.css**: 캠페인 대시보드 패키지 전용.
- **widgetboard.css**: 위젯보드 패키지 전용.
- **main.css / index.css**: 앱 공통. 별도 유틸리티 CSS 프레임워크 없음.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 (본 문서) |
| 02_BACKEND_GUIDE.md | 백엔드 구조·API·설정·etl_server |
| 03_AI_DEVELOP_GUIDE.md | 시스템 아키텍처·프론트↔백 매핑·확장 시 탐색 경로 (AI·온보딩) |

- **docs/report**: 배포·보조 설계·체크리스트. **동작 정의의 기준은 docs/main** 이다.
- **문서 이력**: 본 파일에 날짜별 수정 타임라인을 두지 않는다. 작업 이력은 **docs/log/log.md** 를 본다. **현재 구조**: 패키지별 `packages/<도메인>/api/*Client.js`, `shared/api/http.js`, `app/navConfig.js`·`app/routes.jsx`, **campaign_dashboard** (`/dashboard`).
