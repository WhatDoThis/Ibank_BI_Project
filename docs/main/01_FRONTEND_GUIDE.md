# 프론트엔드 개발 가이드

본 문서는 **docs/main** 내 프론트엔드 전용 명세이며, **현재 코드 기준** 경로·패키지·API만 기술한다. 구현 위치: `Frontend/react-app`. 작업 이력은 **docs/log/log.md** 참고. 백엔드 패키지와의 대응·전체 지도는 **docs/report/03_AI_DEVELOP_GUIDE.md** 참고.

---

## 1. 프론트엔드 개요

### 1.1 역할

- **인증(S5/S6/S7)**: `/login` — 이메일·비밀번호 후 2차 코드, `POST /api/auth/login`·`verify-login`. `/signup`(초대 코드)는 공개 라우트. 최초 조직·계정은 DB 시드·운영 절차로 두고, 웹 공개 화면 `/create-org`는 제공하지 않는다(백엔드 `POST /api/auth/create-org`는 필요 시 운영 도구로 호출 가능). `/mypage` — 닉네임·비밀번호·로그인 이력(`PATCH /api/auth/me`·`/me/password`·`GET login-history`). **S8**: `NotificationBell`·`notificationsClient`·`/admin/users`(`OrgAdminRoute`)·`/admin/roles`·`/admin/projects`·`/admin/projects/:id/members`(`ProjectAdminRoute`, operator 포함)·`/admin/org`(`SuperAdminRoute`). **`adminClient.js`** 에 roles·projects·members·invite·search. **`/` 홈**: `homeAccess.js`·`adminAccess.js`(프로젝트 관리 카드는 operator 포함). 토큰은 `localStorage`, API는 `shared/api/http.js` 가 `Authorization: Bearer`·401 시 `refresh` 후 1회 재시도. `/` — `GET /api/projects`·`POST /api/projects/{id}/select`. 쿼리 스튜디오·대시보드·위젯 경로는 JWT에 `project_info_id` 없으면 `/` 로 유도(`NeedProjectRoute`). ETL은 `me.etl_yn=Y` 또는 `user_dvsn=sa_dev` 일 때만 네비·`/etl` (`EtlAccessRoute`).
- **헤더·작업 프로젝트**: 로그인 후 상단 **작업 프로젝트** 드롭다운(이메일·알림 벨 사이). `POST /api/projects/{id}/select`로 전환 시 JWT가 갱신되고, 쿼리 스튜디오·캠페인 대시보드·위젯보드는 해당 프로젝트 기준으로 데이터 재조회·빌더 초기화 등이 맞춰진다.
- **React(Vite)** 단일 앱이며, **base 경로 `/ibank-bi/`** (vite.config.js) 로 서빙됩니다.
- **패키지**: **query_studio**, **campaign_dashboard**(대시보드 UI 단일), **widgetboard**, **etl**. **SPA 앱 전용**: `app/` — `auth/`, `home/`, `mypage/`, `admin/`, `layout/`, `guards/`, `routes.jsx`. **공용**: `shared/config/api.js`, `shared/api/http.js`·`adminClient.js`·`authClient.js`·`notificationsClient.js`·`queryStudioTableApi.js`, `shared/auth/jwtUtils.js`·`tokenStorage.js`, `shared/utils/` 등. **패키지별 API**는 각 `packages/<이름>/api/*Client.js` 에 둔다.
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
| 스타일 | CSS | 패키지 전용 CSS + `styles/`(`design-tokens`, `shared-ui`, `app-shell`, `main` 등) + `index.css` |
| API | fetch | `shared/api/http.js` + 패키지별 `api/*Client.js` |
| 언어 | JavaScript (ESM) | JSX |

- .env 미사용. API URL 등은 config.json → api-config.js 또는 shared/config 에서 처리.

---

## 3. 아키텍처·디렉토리 구조

```
Frontend/react-app/
├── index.html
├── vite.config.js                    # base: '/ibank-bi/'
├── dist/                             # npm run build (정적 서버가 서빙)
└── src/
    ├── App.jsx                       # BrowserRouter, ShellChrome 등 앱 루트
    ├── main.jsx                      # createRoot, 전역 CSS 로드 순서
    ├── index.css
    ├── assets/
    ├── styles/                       # 앱 셸·디자인 토큰·스크롤바 등 전역
    │   ├── design-tokens.css, shared-ui.css, main.css
    │   ├── app-shell.css, ibank-scrollbars.css
    ├── app/                          # SPA 전용 (라우트·레이아웃·가드·페이지)
    │   ├── routes.jsx                # AppRoutes — /login, /signup, ProtectedLayout 하위 전부
    │   ├── auth/                     # LoginPage, SignupPage, AuthContext, login.css
    │   ├── home/                     # HomePage, homeAccess.js, home.css
    │   ├── mypage/                   # MyPage, mypage.css
    │   ├── admin/                    # AdminUsers|Org|Roles|Projects|ProjectMembersPage, adminAccess.js, admin-pages.css, admin-users.css, admin-org.css
    │   ├── layout/                   # ProtectedLayout, navConfig.js, ProjectHeaderSelect, NotificationBell, PageHeader, SidebarNavIcon, ShellChromeOverrideContext, pageTitles, *.css
    │   └── guards/                   # NeedProjectRoute, ProjectFeatureRoute, EtlAccessRoute, OrgAdminRoute, SuperAdminRoute, ProjectAdminRoute, etlAccess.js
    ├── packages/
    │   ├── query_studio/             # /query-studio
    │   │   ├── QueryStudioPage.jsx, index.jsx, queryStudio.css
    │   │   ├── api/queryStudioClient.js
    │   │   ├── components/           # Sidebar, MainArea, Header
    │   │   ├── hooks/useQueryStudioData.js
    │   │   ├── utils/                # sqlBuilder, joinRules, safetyCheck, constants, helpers, relationshipDiagram.js
    │   │   └── __tests__/            # sqlBuilder, joinRules, safetyCheck 테스트
    │   ├── campaign_dashboard/       # /dashboard (리다이렉트: /campaign-dashboard → /dashboard)
    │   │   ├── CampaignDashboardPage.jsx, index.jsx, campaign-dashboard.css
    │   │   ├── api/campaignDashboardClient.js
    │   │   └── components/           # KPI·차트·퍼널 등 (다수 .jsx)
    │   ├── widgetboard/              # /widgetboard (중첩 라우트: index 목록, :boardId 캔버스)
    │   │   ├── WidgetboardListPage.jsx, WidgetboardPage.jsx, index.jsx, widgetboard.css, constants.js
    │   │   ├── api/widgetBoardClient.js
    │   │   ├── components/WidgetDataWizardModal.jsx
    │   │   └── utils/dataUtils.js, dateRangePolicy.js
    │   └── etl/                      # /etl — ETLPage, index.jsx, etl.css, api/etlClient.js, utils/storageDb.js
    │       └── components/           # SourceTypeSelector, File/Db/Folder 폼, 배치·이력·저장DB·ETLTableList 등 + TargetTableSelectModal/ (서브폴더: CodeMapInlineEditor 등)
    └── shared/
        ├── api/http.js, adminClient.js, authClient.js, notificationsClient.js, queryStudioTableApi.js
        ├── auth/jwtUtils.js, tokenStorage.js
        ├── config/api.js
        └── utils/crudConfirm.js, userDvsnDisplay.js, passwordPolicy.js
```

- **라우팅 요약**: `routes.jsx` — 위젯보드는 `NeedProjectRoute` + `ProjectFeatureRoute(feature="widgetboard")` 아래 **Outlet**: `index` → `WidgetboardListPage`, `:boardId` → `WidgetboardPage`.
- **정적 서버**: `Frontend/static_server/main.py`. `config.frontend.static_dir` = `Frontend/react-app/dist`, `/ibank-bi*` 요청 처리, 미존재 경로 → index.html.

---

## 4. 패키지별 구성

### 4.1 query_studio (쿼리 스튜디오)

- **QueryStudioPage.jsx**: 그리드 컬럼·추가 테이블·필터·정렬·집계·피벗·HAVING·날짜 단위·실행·페이지네이션 상태. joinMode, relationshipOptions, joinConditions, joinTypes, joinLogicalOperators, joinConfigs, tableRelationships, groupBy, pivot, pivotRowAggs, dateGranularity, havings. `runExecuteQuery`, `runExplainSql`, 초기화. Sidebar, MainArea 에 props 전달.
- **hooks/useQueryStudioData.js**: 테이블·관계 등 서버 데이터 로딩·캐시와 페이지 상태 연동.
- **utils/relationshipDiagram.js**: 관계 시각화·그래프 보조(있는 경우).
- **Sidebar**: 테이블 목록, 테이블별 컬럼(드래그 가능). JOIN 불가 테이블 비활성화(`joinRules.isTableAvailable`). `list-tables`, `table-relationships` 연동.
- **MainArea**: 드롭 존·그리드·필터/정렬 칩·SQL 패널(실행된 SQL, 🤖 해석, 📋 복사)·Claude 해석 영역·페이지네이션 바(처음/이전/다음/마지막, 페이지 크기 선택).
- **utils/sqlBuilder.js**: getJoinKey, generateSQL, generateCountSQL, generateDistinctPivotSQL. 옵션: joinConfigs(joinType, conditions, logicalOperator), groupBy, dateGranularity, havings, pivot, pivotRowAggs. 별칭(t1, t2) 사용.
- **utils/joinRules.js**: canAddTableByColumn(직접 관계만 추가 허용), findIntermediateParent(같은 부모_id 쓰는 두 테이블 시 끼워 넣을 부모), isTableAvailable(사이드바/드롭다운 노출 여부). relationshipOptions 기반.
- **utils/safetyCheck.js**: JOIN 안전성 검증 — detectCircularReference, detectManyToMany, validateJoinPath, canAddTableSafely. 테이블 추가 전 검증.
- **utils/constants.js**: OPERATOR_LABELS(WHERE/HAVING 연산자 한글), AGG_FUNCTIONS. **utils/helpers.js**: 기타 유틸.
- **__tests__/**: sqlBuilder.test.js, joinRules.test.js 등 단위 테스트.

**쿼리 스튜디오 기능 요약**

- 사이드바에서 테이블/컬럼 드래그 → 그리드 추가, 헤더 드래그로 순서 변경. JOIN 시 직접 관계·중간 부모 끼워 넣기·순환/N:N 검사.
- 기준축·피벗·HAVING·조건·정렬·날짜 단위·집계 함수. JOIN 유형(LEFT/INNER/RIGHT)·복합 조건(AND/OR). SQL 자동 생성 후 실행·페이지네이션(건수 선택).
- 실행된 SQL 표시·복사·Claude 해석(백엔드 `/api/explain-sql` 경유). 초기화 시 그리드·필터·정렬·집계·피벗 등 전부 리셋.

### 4.2 campaign_dashboard (대시보드 — Star /api/campaign-dashboard)

- **CampaignDashboardPage.jsx**: 발송 KPI·추이·회원·인구통계·시간대 등. **API**: `packages/campaign_dashboard/api/campaignDashboardClient.js`. 라우트 **`/dashboard`** (`/campaign-dashboard` → 리다이렉트). Backend **campaign_dash_server**. 상세 **02_BACKEND_GUIDE.md §4.6.2**.

### 4.3 widgetboard (위젯보드)

- **라우트**: `routes.jsx`에서 `/widgetboard`는 `Outlet` 기반 — **`/`(index)** → `WidgetboardListPage.jsx`(보드 목록·생성·초대 등), **`/:boardId`** → `WidgetboardPage.jsx`(캔버스·팔레트·위젯 편집).
- **WidgetboardPage.jsx**: 드래그 앤 드롭 격자·위젯 아이템. 위젯 데이터는 **쿼리 스튜디오** API(`queryStudioClient.js` — listTables, describeTable, executeQuery)와 **위젯보드** API(`api/widgetBoardClient.js` — 보드·레이아웃·참여자 등)를 함께 사용.
- **WidgetboardListPage.jsx**: 프로젝트별 보드 카드 목록, 생성·수정·초대·비활성·참여자 관리 진입.
- **components/WidgetDataWizardModal.jsx**: 위젯 생성 마법사.
- **utils/dataUtils.js**, **utils/dateRangePolicy.js**: 데이터 가공·조회 기간 상한 정책.
- **constants.js**, **index.jsx**(패키지 엔트리), **widgetboard.css**(전용 스타일).

### 4.4 etl (ETL, 단일)

- **ETLPage.jsx**: 탭(파일 업로드 | DB 연결 | 폴더 | 저장 DB 등록 | ETL 이력). SourceTypeSelector → FileUploadForm, DbConnectionForm, 폴더 연결·배치 Job, StorageConnectionForm, JobHistoryPanel. ETLTableList(`etl2ListTables`+배치 레지스트리)·배치설정(status=done 시 활성). App.jsx에서 `/etl` 라우트. API prefix **/api/etl**, **/api/etl/batch/**.
- **SourceTypeSelector.jsx**: 소스 유형(파일 / PostgreSQL·MySQL·Oracle) 선택.
- **FileUploadForm.jsx**: 파일 업로드(CSV/Excel/Parquet), etlUploadFile(multipart). target_table·description·created_by. 업로드 파일은 서버에서 **3일** 초과 시 자동 삭제되며, 3일 후 동일 ETL 재실행 시 파일 없음으로 실패할 수 있음.
- **DbConnectionForm.jsx**: 연결 등록(이름·host·port·database·schema·username·password). **연결 테스트(etlTestConnection) 통과 후에만** 등록 가능. Oracle 선택 시 **서비스명(Service Name)** 라벨·안내(JDBC @호스트:1521/서비스명, SID 미지원)·placeholder 예: FREEPDB1. **등록된 연결** 목록·**ETL 테이블 등록** 연결 선택 옵션에 **호스트:포트/DB명** 형식 표시. 소스 테이블 목록(etlListConnectionTables)·타겟 테이블·설명·sync_mode(전체/증분)·batch_size·batch_interval_seconds·etlCreateTable. Oracle 소스 테이블 선택 시 **OWNER.TABLE_NAME**으로 저장(드롭다운 value·label). 2열 그리드·카드 섹션 UI. **DB 연결 실패 시**: 실제 연결은 브라우저가 아닌 Backend가 수행하므로, 외부 DB 방화벽에 **Backend가 실행 중인 호스트 IP**가 허용돼야 함.
- **ETLTableList.jsx**: `etl2ListTables` 목록. **목록 열**: 타겟 테이블·설명·PK·소스 유형·**연결**(connection_name, 서버 구분)·소스·**배치**(batch_size/batch_interval_seconds, "5,000행 / 1초" 등)·**동기화**(전체·증분·**PK 차이(diff)** 등)·상태(draft/error/done)·동작(미리보기·실행·데이터 추가·PK 설정·삭제). **도움말(?)**: 상태별 버튼 설명·배치·실행 시점 안내.
- **상태별 버튼 동작**:
  - **draft/error**(타겟 테이블 없거나 불확실): **미리보기** — 등록된 파일 읽어 10행+컬럼 표시. **실행** — 파일로 메인 DB DROP→CREATE→INSERT(전체 교체). **데이터 추가** — 타겟 테이블 없으면 실패(이미 있는 테이블에 새 파일 업서트용). **삭제** — 메타+파일 삭제, DROP TABLE IF EXISTS.
  - **done**(타겟 테이블 있음): **미리보기** — 동일(파일 10행). **실행** — 파일로 테이블 **전체 교체**(실행 전 타겟 존재 시 컨펌). **데이터 추가** — 새 파일을 같은 타겟 테이블에 PK 기준 **업서트**(분할 적재용). **삭제** — 메타+파일 삭제, 테이블 DROP.
- **배치·실행 시점**(도움말 및 UI 안내): **배치 크기·배치 간 대기**는 **한 번 실행할 때** 소스에서 몇 행씩 가져오는지·배치마다 쉬는 초. **"매일 몇 시 자동 실행"**은 **미구현**. 실행은 **사용자가 "실행" 버튼을 눌렀을 때만** 대기열 등록 → 워커가 처리. draft/done 여부와 관계없이 자동 실행 없음.
- **JobHistoryPanel.jsx**: `etl2ListJobs`·`etl2GetJob` 폴링. Job 목록·실행 이력·상태(pending→running→completed/failed/cancelled). 백엔드 워커 **동시 최대 3건**(`queue_worker.MAX_CONCURRENT`).
- **AddFileModal.jsx**: 단일 파일 추가 적재. **ZIP 다중 파일**: etlAddFilesZipToTable. 서버가 ZIP 압축 해제 후 지원 형식(.csv, .xlsx, .xls, .parquet)·용량 한도 이하 파일만 순서대로 Job 등록. **건너뛴 파일**이 있으면 API 응답 skipped_files(파일명·사유: file_too_large, unsupported_format, schema_or_pk_failed 등)로 전달되며, UI에서 "다음 파일은 건너뛰었습니다" 안내+파일명·사유 목록 표시.
- **PreviewModal.jsx**: 미리보기 10행. **PkColumnsModal.jsx**: PK 컬럼 체크박스.
- **etl.css**: ETL 목록·연결·배치·동기화 열 스타일.
- **API**(`packages/etl/api/etlClient.js`): `etl2ListTables`, `etl2UploadFile`, `batchListJobs`, `batchCreateJobFromEtlTable` 등(함수명은 역사적 `etl2*`·`batch*` 접두, HTTP 경로는 **/api/etl**, **/api/etl/batch/**). 패키지 경로는 **`packages/etl`** 단일.

### 4.5 shared (공용)

- **config/api.js**: `getApiBase()` — 빌드 주입·api-config.js 반영.
- **api/http.js**: `request`, `fetchOkJson`, `formatFetchErrorMessage` 등 — 패키지 `*Client.js`의 공통 전송층.
- **api/adminClient.js**: `/api/admin/*`(사용자·부서·권한·프로젝트·멤버).
- **api/authClient.js**: `/api/auth/*`(로그인·refresh·me·비밀번호 등).
- **api/notificationsClient.js**: `/api/notifications/*`.
- **api/queryStudioTableApi.js**: `list-tables`·`describe-table`·`execute-query` 등 쿼리 스튜디오와 위젯보드가 **공유**하는 호출(패키지 중복 방지).
- **auth/jwtUtils.js**, **auth/tokenStorage.js**: JWT 클레임·로컬 스토리지 토큰.
- **utils/crudConfirm.js**, **userDvsnDisplay.js**, **passwordPolicy.js**: 관리 화면·가입 등 공통.

엔드포인트 추가 시 **해당 패키지의 `api/*Client.js`** 및 필요 시 `shared/api/*`·`http.js`를 수정한다. (구 monolithic `client.js` 없음.)

---

## 5. 추가 기능 (쿼리 스튜디오)

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

- **패키지 전용**: `queryStudio.css`, `campaign-dashboard.css`, `widgetboard.css`, `packages/etl/etl.css` 등 — 패키지 간 공유 금지(프로젝트 규칙).
- **`src/styles/`**: `design-tokens.css`, `shared-ui.css`, `app-shell.css`, `ibank-scrollbars.css`, `main.css` — 앱 셸·전역 토큰·스크롤바.
- **`app/` 하위 `*.css`**: `login.css`, `home.css`, `mypage.css`, `admin-pages.css`, `admin-users.css`, `admin-org.css`, `layout`의 `notification-bell.css`, `project-header-select.css` 등 화면별 스타일.
- **`index.css`**: 엔트리 보조. 별도 유틸리티 CSS 프레임워크 없음.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 (본 문서) |
| 02_BACKEND_GUIDE.md | 백엔드 구조·API·설정·etl_server |
| 03_API_GUIDE.md | 통합 API·모듈 레퍼런스(대용량, 엔드포인트·인증 흐름 상세) |
| docs/report/03_AI_DEVELOP_GUIDE.md | 시스템 아키텍처·프론트↔백 매핑·확장 시 탐색 경로 (AI·온보딩) |

- **docs/report**: 배포·보조 설계·체크리스트. **동작 정의의 기준은 docs/main** 이다.
- **문서 이력**: 본 파일에 날짜별 수정 타임라인을 두지 않는다. 작업 이력은 **docs/log/log.md** 를 본다. **현재 구조**: 패키지별 `packages/<도메인>/api/*Client.js`, `shared/api/*`, `app/layout/navConfig.js`·`app/routes.jsx`, SPA 화면은 `app/auth|home|mypage|admin|layout|guards/`, 대시보드 **campaign_dashboard** (`/dashboard`), 위젯보드 **widgetboard** (`/widgetboard`·`/widgetboard/:boardId`).
