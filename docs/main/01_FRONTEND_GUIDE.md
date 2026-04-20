# 프론트엔드 개발 가이드

본 문서는 **docs/main** 내 프론트엔드 전용 명세이며, **현재 코드 기준** 경로·패키지·API만 기술한다.

- **구현 위치**: `Frontend/react-app`
- **작업 이력**: **docs/log/log.md**
- **백엔드 대응·전체 지도**: **docs/report/03_AI_DEVELOP_GUIDE.md**

---

## 1. 프론트엔드 개요

### 1.1 역할

1) **인증(S5/S6/S7)**

- `/login` — 이메일·비밀번호 후 2차 코드, `POST /api/auth/login`·`verify-login`.
- `/signup`(초대 코드)는 공개 라우트. 최초 조직·계정은 DB 시드·운영 절차로 두고, 웹 공개 화면 `/create-org`는 제공하지 않는다(백엔드 `POST /api/auth/create-org`는 필요 시 운영 도구로 호출 가능).
- `/mypage` — 닉네임·비밀번호·로그인 이력(`PATCH /api/auth/me`·`/me/password`·`GET login-history`).

2) **S8(관리·알림)**

- `NotificationBell`·`notificationsClient`.
- `/admin/users`(`OrgAdminRoute`)·`/admin/roles`·`/admin/projects`·`/admin/projects/:id/members`(`ProjectAdminRoute`, operator 포함)·`/admin/org`(`SuperAdminRoute`).

3) **`adminClient.js`**

- roles·projects·members·invite·search 등 관리 API 호출을 한곳에 둔다.

4) **`/` 홈·프로젝트·가드**

- `homeAccess.js`·`adminAccess.js`(프로젝트 관리 카드는 operator 포함).
- 토큰은 `localStorage`, API는 `shared/api/http.js` 가 `Authorization: Bearer`·401 시 `refresh` 후 1회 재시도.
- `/` — `GET /api/projects`·`POST /api/projects/{id}/select`.
- 쿼리 스튜디오·대시보드·위젯 경로는 JWT에 `project_info_id` 없으면 `/` 로 유도(`NeedProjectRoute`).
- ETL은 `me.etl_yn=Y` 또는 `user_dvsn=sa_dev` 일 때만 네비·`/etl` (`EtlAccessRoute`).

5) **헤더·작업 프로젝트**

- 로그인 후 상단 **작업 프로젝트** 드롭다운(이메일·알림 벨 사이).
- `POST /api/projects/{id}/select`로 전환 시 JWT가 갱신되고, 쿼리 스튜디오·캠페인 대시보드·위젯보드는 해당 프로젝트 기준으로 데이터 재조회·빌더 초기화 등이 맞춰진다.

6) **앱 스택·빌드·정적 서버**

- **React(Vite)** 단일 앱, **base 경로 `/ibank-bi/`** (`vite.config.js`).
- **기능 패키지**: `query_studio`, `campaign_dashboard`(대시보드 UI 단일), `widgetboard`, `etl`.
- **SPA 전용 `app/`**: `auth/`, `home/`, `mypage/`, `admin/`, `layout/`, `guards/`, `routes.jsx`.
- **공용 `shared/`**: `config/api.js`, `api/http.js`·`adminClient.js`·`authClient.js`·`notificationsClient.js`·`queryStudioTableApi.js`, `auth/jwtUtils.js`·`tokenStorage.js`, `utils/` 등.
- **패키지별 API**: 각 `packages/<이름>/api/*Client.js`.
- **정적 서버**: `Frontend/static_server/main.py`가 `dist/` 서빙, `/ibank-bi` 경로 변환·SPA fallback, `/api-config.js` 주입 → `window.APP_CONFIG.apiBaseUrl`.

### 1.2 접속 경로

- **로컬(DEV)**
  - UI 베이스: `http://localhost:8080/ibank-bi/`
  - 예: `.../query-studio`, `.../dashboard`, `.../widgetboard`, `.../etl`
  - `/campaign-dashboard` → `/dashboard` 리다이렉트
- **Linux 배포(실제 서비스)**
  - base URL: `https://ajo.sdev-ibank.co.kr/ibank-bi/`
  - Nginx: `/ibank-bi/` → 정적 서버, API는 `api_base_url`로 호출

### 1.3 프론트와 설정

- **`config.frontend`** (`Env/config/config.json`): `static_port`, `main_page`, `api_base_url`, `static_dir`.
- **API 베이스 URL**: 빌드 시 config 또는 런타임 `api-config.js` 주입 → `shared/config/api.js`에서 사용.

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

- **설정**: `.env` 미사용. API URL 등은 `config.json` → `api-config.js` 또는 `shared/config`에서 처리.

---

## 3. 아키텍처·디렉토리 구조

- 저장소 **현행** 폴더 트리 요약(세부 파일명은 코드 기준).

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

- **라우팅 요약 (`routes.jsx`)**
  - 위젯보드: `NeedProjectRoute` + `ProjectFeatureRoute(feature="widgetboard")` 하위 **Outlet**
  - `index` → `WidgetboardListPage`, `:boardId` → `WidgetboardPage`
- **정적 서버**
  - `Frontend/static_server/main.py`
  - `config.frontend.static_dir` = `Frontend/react-app/dist`
  - `/ibank-bi*` 요청 처리, 미존재 경로 → `index.html`

---

## 4. 패키지별 구성

### 4.1 query_studio (쿼리 스튜디오)

- **`QueryStudioPage.jsx`**
  - 그리드 컬럼·테이블 추가·필터·정렬·집계·피벗·HAVING·날짜 단위·실행·페이지네이션 상태
  - 상태 예: `joinMode`, `relationshipOptions`, `joinConditions`, `joinTypes`, `joinLogicalOperators`, `joinConfigs`, `tableRelationships`, `groupBy`, `pivot`, `pivotRowAggs`, `dateGranularity`, `havings`
  - `runExecuteQuery`, `runExplainSql`, 초기화; `Sidebar`·`MainArea`에 props 전달
- **`hooks/useQueryStudioData.js`**: 테이블·관계 등 서버 데이터 로딩·캐시와 페이지 상태 연동
- **`utils/relationshipDiagram.js`**: 관계 시각화·그래프 보조(있는 경우)
- **`Sidebar`**: 테이블 목록·테이블별 컬럼(드래그), JOIN 불가 테이블 비활성화(`joinRules.isTableAvailable`), `list-tables`·`table-relationships` 연동
- **`MainArea`**: 드롭 존·그리드·필터/정렬 칩·SQL 패널(실행 SQL, 🤖 해석, 📋 복사)·Claude 영역·페이지네이션 바
- **`utils/sqlBuilder.js`**: `getJoinKey`, `generateSQL`, `generateCountSQL`, `generateDistinctPivotSQL`; 옵션 `joinConfigs`, `groupBy`, `dateGranularity`, `havings`, `pivot`, `pivotRowAggs`; 별칭 `t1`, `t2`
- **`utils/joinRules.js`**: `canAddTableByColumn`, `findIntermediateParent`, `isTableAvailable` — `relationshipOptions` 기반
- **`utils/safetyCheck.js`**: `detectCircularReference`, `detectManyToMany`, `validateJoinPath`, `canAddTableSafely`
- **`utils/constants.js`**, **`utils/helpers.js`**: 연산자 라벨·집계 함수·기타 유틸
- **`__tests__/`**: `sqlBuilder.test.js`, `joinRules.test.js` 등

**쿼리 스튜디오 기능 요약**

- **빌더**: 사이드바 드래그로 그리드·헤더 순서; JOIN은 직접 관계·중간 부모·순환/N:N 검사
- **집계·SQL**: 기준축·피벗·HAVING·정렬·날짜 단위·JOIN 유형·AND/OR; 생성 SQL 실행·페이지네이션(건수 선택)
- **해석·초기화**: 실행 SQL 표시·복사·Claude 해석(`/api/explain-sql`); 초기화 시 그리드·필터·정렬·집계·피벗 리셋

### 4.2 campaign_dashboard (대시보드 — Star /api/campaign-dashboard)

- **`CampaignDashboardPage.jsx`**: 발송 KPI·추이·회원·인구통계·시간대 등
- **API**: `packages/campaign_dashboard/api/campaignDashboardClient.js`
- **라우트**: `/dashboard` (`/campaign-dashboard` → 리다이렉트)
- **백엔드**: `campaign_dash_server` — 상세는 **02_BACKEND_GUIDE.md §4.6.2**

### 4.3 widgetboard (위젯보드)

- **라우트 (`routes.jsx`)**
  - `/widgetboard` — `Outlet` 기준 **`/`(index)** → `WidgetboardListPage.jsx`(목록·생성·초대 등)
  - **`/:boardId`** → `WidgetboardPage.jsx`(캔버스·팔레트·편집)
- **`WidgetboardPage.jsx`**: DnD 격자·위젯; 데이터는 `queryStudioClient.js`(`listTables`, `describeTable`, `executeQuery`) + `widgetBoardClient.js`(보드·레이아웃·참여자 등) 병행
- **`WidgetboardListPage.jsx`**: 프로젝트별 보드 카드, 생성·수정·초대·비활성·참여자 진입
- **`components/WidgetDataWizardModal.jsx`**: 위젯 생성 마법사
- **`utils/dataUtils.js`**, **`utils/dateRangePolicy.js`**: 가공·조회 기간 상한
- **`constants.js`**, **`index.jsx`**, **`widgetboard.css`**

### 4.4 etl (ETL, 단일)

- **`ETLPage.jsx`**
  - 탭: 파일 업로드 · DB 연결 · 폴더 · 저장 DB 등록 · ETL 이력
  - `SourceTypeSelector` → `FileUploadForm`, `DbConnectionForm`, 폴더·배치 Job, `StorageConnectionForm`, `JobHistoryPanel`
  - `ETLTableList`(`etl2ListTables` + 배치 레지스트리), 배치 설정(`status=done` 시 활성)
  - 라우트: `/etl` — API prefix **`/api/etl`**, **`/api/etl/batch/`**
- **`SourceTypeSelector.jsx`**: 소스 유형 — 파일 / PostgreSQL · MySQL · Oracle
- **`FileUploadForm.jsx`**
  - CSV / Excel / Parquet, `etlUploadFile`(multipart), `target_table`·`description`·`created_by`
  - 업로드 파일 **3일** 초과 시 삭제. 삭제는 **새 파일 업로드 시** `_cleanup_expired_uploads`가 자동 실행되거나 `POST /api/etl/cleanup-expired-uploads`로 수동 트리거할 수 있다. cron 등 **주기 스케줄 자동 삭제는 미구현**이다. 만료 후 동일 ETL 재실행 시 파일 없음으로 실패할 수 있음
- **`DbConnectionForm.jsx`**
  - 필드: 이름·host·port·database·schema·username·password — **`etlTestConnection` 통과 후에만** 등록
  - Oracle: **서비스명(Service Name)** 라벨·안내(JDBC `@호스트:1521/서비스명`, SID 미지원), placeholder 예 `FREEPDB1`
  - 등록 연결·ETL 테이블 등록 셀렉트에 **호스트:포트/DB명** 표시; 소스 테이블 `etlListConnectionTables`; `sync_mode`, `batch_size`, `batch_interval_seconds`, `etlCreateTable`
  - Oracle 소스 테이블: **`OWNER.TABLE_NAME`** 저장(value·label); 2열 그리드·카드 UI
  - **방화벽**: 연결은 브라우저가 아니라 **Backend 호스트 IP**가 외부 DB에 허용돼야 함
- **`ETLTableList.jsx`**
  - `etl2ListTables` — 열: 타겟·설명·PK·소스 유형·**연결**·소스·**배치**·**동기화**(전체·증분·PK diff 등)·상태(`draft`/`error`/`done`)·동작(미리보기·실행·데이터 추가·PK·삭제)
  - 도움말(?): 상태별 버튼·배치·실행 시점 안내
- **상태별 버튼 동작**
  - **`draft` / `error`**: 미리보기(파일 10행+컬럼) · 실행(DROP→CREATE→INSERT 전체 교체) · 데이터 추가(타겟 없으면 실패) · 삭제(메타+파일, `DROP TABLE IF EXISTS`)
  - **`done`**: 미리보기(동일) · 실행(전체 교체, 기존 타겟 시 컨펌) · 데이터 추가(PK 업서트) · 삭제(메타+파일+`DROP TABLE`)
- **배치·실행 시점**
  - 배치 크기·간격 = **해당 실행**당 소스 fetch 행 수·배치 간 대기(초)
  - **스케줄 자동 실행(매일 n시)** 은 **미구현** — 사용자 **실행** 클릭 시만 큐 등록 → 워커 처리
- **`JobHistoryPanel.jsx`**: `etl2ListJobs`·`etl2GetJob` 폴링; 상태 `pending`→`running`→`completed`/`failed`/`cancelled`; 워커 동시 **최대 3건**(`queue_worker.MAX_CONCURRENT`)
- **`AddFileModal.jsx`**: 단일 파일 추가; ZIP은 `etlAddFilesZipToTable` — 해제 후 지원 형식·용량만 Job 등록, `skipped_files`(사유 등) UI 표시
- **`PreviewModal.jsx`**: 미리보기 10행 — **`PkColumnsModal.jsx`**: PK 체크박스
- **`etl.css`**: 목록·연결·배치·동기화 열 스타일
- **`packages/etl/api/etlClient.js`**: `etl2*`·`batch*` 함수명(경로는 `/api/etl`, `/api/etl/batch/`) — 패키지는 **`packages/etl`** 단일

### 4.5 shared (공용)

- **`config/api.js`**: `getApiBase()` — 빌드·`api-config.js` 반영
- **`api/http.js`**: `request`, `fetchOkJson`, `formatFetchErrorMessage` 등 — 패키지 `*Client.js` 공통 전송
- **`api/adminClient.js`**: `/api/admin/*` — 사용자·부서·권한·프로젝트·멤버
- **`api/authClient.js`**: `/api/auth/*` — 로그인·refresh·me·비밀번호 등
- **`api/notificationsClient.js`**: `/api/notifications/*`
- **`api/queryStudioTableApi.js`**: `list-tables`·`describe-table`·`execute-query` 등 — 쿼리 스튜디오·위젯보드 **공유**(중복 방지)
- **`auth/jwtUtils.js`**, **`auth/tokenStorage.js`**: JWT 클레임·로컬 스토리지
- **`utils/crudConfirm.js`**, **`userDvsnDisplay.js`**, **`passwordPolicy.js`**: 관리·가입 공통

**엔드포인트 추가 시**: 해당 패키지 `api/*Client.js` 및 필요 시 `shared/api/*`·`http.js` 수정한다. 저장소에는 **루트 단일 `client.js`** 를 두지 않는다.

---

## 5. 추가 기능 (쿼리 스튜디오)

### 5.1 Claude API 쿼리 해석

- **역할**: 실행 SQL을 백엔드 경유 Claude로 자연어 해석 표시
- **API 키**: `config.backend.claude_api_key`, `claude_api_url` — **백엔드만**, 프론트 비노출
- **동작**: **🤖 해석** → `POST /api/explain-sql` → 응답을 **MainArea** 💬 영역에 표시
- **구현**: `QueryStudioPage.runExplainSql` → `queryStudioClient.explainSql()` → MainArea
- **UI**: 패널 헤더 `📄 실행된 SQL | 🤖 해석 | 📋 복사` — 로딩 후 결과·닫기
- **주의**: 키 미설정 시 오류 가능; 과금·Rate Limit

### 5.2 페이지네이션 (LIMIT / OFFSET)

- **역할**: `LIMIT`+`OFFSET` 페이지 조회; 총건수는 **COUNT**(`generateCountSQL` + `execute-query`)
- **동작**
  - 실행: `generateCountSQL` → `apiExecuteQuery(countSQL)` → `setTotalCount` → `generateSQL`(LIMIT/OFFSET) 실행
  - 페이지·페이지 크기 변경 시 `runExecuteQuery` 재호출
  - 컬럼·필터·정렬·집계·피벗 변경 시 `currentPage = 1` 후 실행
- **UI**: 그리드 하단 바(결과 있을 때) — 범위/총건수, ⏮◀ 페이지 N/M ▶⏭, 페이지 크기(50/100/200/500 등); MainArea props: `currentPage`, `pageSize`, `totalCount`, `onSetPage`, `onSetPageSize`
- **주의**: COUNT+데이터 **2회** 실행; 대용량 시 지연 가능

---

## 6. 스타일링

- **패키지 전용 CSS** (패키지 간 공유 **금지**)
  - `queryStudio.css`, `campaign-dashboard.css`, `widgetboard.css`, `packages/etl/etl.css` 등
- **`src/styles/`** (앱 셸·토큰·스크롤바)
  - `design-tokens.css`, `shared-ui.css`, `app-shell.css`, `ibank-scrollbars.css`, `main.css`
- **`app/` 화면별 `*.css`**
  - `login.css`, `home.css`, `mypage.css`, `admin-pages.css`, `admin-users.css`, `admin-org.css`
  - `layout/`: `notification-bell.css`, `project-header-select.css` 등
- **`index.css`**: 엔트리 보조 — 별도 유틸 CSS 프레임워크 없음

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 (본 문서) |
| 02_BACKEND_GUIDE.md | 백엔드 구조·API·설정·etl_server |
| 03_API_GUIDE.md | 통합 API·모듈 레퍼런스(대용량, 엔드포인트·인증 흐름 상세) |
| docs/report/03_AI_DEVELOP_GUIDE.md | 시스템 아키텍처·프론트↔백 매핑·확장 시 탐색 경로 (AI·온보딩) |

- **`docs/report`**: 배포·보조 설계·체크리스트 — **동작 정의 기준은 `docs/main`**
- **문서 이력**: 본 파일에 날짜 타임라인 없음 → **docs/log/log.md**·Git
- **현재 구조 요약**
  - API: `packages/<도메인>/api/*Client.js`, `shared/api/*`, `app/layout/navConfig.js`, `app/routes.jsx`
  - SPA: `app/auth`, `home`, `mypage`, `admin`, `layout`, `guards`
  - 대시보드: **campaign_dashboard** — `/dashboard`
  - 위젯보드: **widgetboard** — `/widgetboard`, `/widgetboard/:boardId`
