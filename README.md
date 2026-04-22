# 스타벅스 CRM — 노코드 쿼리 빌더 & 정형 대시보드

SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더**와 **정형 대시보드**입니다.

동작·API·권한·DB의 **정본**은 **`docs/main`**(00~08)을 따른다. 본 README는 빠른 온보딩용 요약이다.

---

## 주요 기능

### 리포트 (쿼리 빌더)

- **SELECT / FROM / JOIN**  
  사이드바에서 테이블·컬럼을 드래그해 그리드에 표시한다. FK 기반으로 JOIN 가능 테이블만 활성화하고, LEFT / INNER / RIGHT와 복합 조건(AND/OR)을 지원한다. 순환 참조·N:N은 `safetyCheck`로 감지하며, 중간 부모 끼워 넣기는 `joinRules`를 쓴다.

- **WHERE / ORDER BY / GROUP BY**  
  필터·정렬·집계·피벗·HAVING·날짜 단위까지 설정하면 `generateSQL`, `generateCountSQL`, `generateDistinctPivotSQL` 등으로 SQL이 생성된다.

- **결과 화면**  
  그리드·SQL 패널·페이지네이션(건수 선택), 실행 SQL 표시·복사, 선택적으로 **Claude SQL 해석**. `join-order`, `save-query-as-table`·status를 지원한다.

### 대시보드 (`/dashboard`)

- **UI**: **캠페인 대시보드** 단일 제품(`packages/campaign_dashboard`). 발송 KPI·추이·회원·인구통계·시간대 등.

- **데이터**: **Star** 물리 테이블(`ibank_*_star_1`, `ibank_*_star_2`). API는 **`/api/campaign-dashboard`**, 연결은 `config.backend.dash_db`.

- **라우팅**: **`/dashboard`** 가 캠페인 대시보드 페이지이고, **`/campaign-dashboard`** 는 `/dashboard` 로 리다이렉트한다.

- **레거시**: 구형 `/api/dashboard`·뉴 대시보드·마케팅 대시보드용 백엔드/프론트 패키지는 저장소에만 두며 **앱에는 연결하지 않는다**(필요 시 `main.py`·라우트에서 재연결).

- **문서**: **docs/main/00_PRD.md**, **01_FRONTEND_GUIDE.md**, **02_BACKEND_GUIDE.md** §4.6.2. 보조로 **docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md**.

### 위젯보드 (`/widgetboard`)

드래그 앤 드롭 위젯 그리드 대시보드이다. 레이아웃·위젯 설정은 `localStorage`에 저장하고, 기존 대시보드·리포트 API를 활용한다.

### ETL (`/etl`, 단일 패키지)

**적재 흐름**

파일·외부 DB에서 우리 **PostgreSQL**로 적재한다. **저장 DB**를 등록·선택하고, 테이블·컬럼 매핑과 **변환 룰**(타입·값 매핑·날짜/시간 연산 등)을 쓴다. 설정 모달에서 동기화 모드(**전체 / 증분 / PK 차이(diff)**), 증분 컬럼, 배치, 행 실패 시 동작을 다룬다.

**소스**

1. **파일**: CSV, Excel(`.xlsx` / `.xls`), Parquet  
2. **DB**: PostgreSQL·MySQL·Oracle — 연결 테스트, 소스 테이블 목록, 미리보기, Full / Incremental / **diff** 적재  
   - **Oracle**은 **Service Name**만 지원한다.  
   - 등록된 연결에는 **호스트:포트 / DB명**이 표시된다.

PK diff 상세는 **docs/report/14_ETL_PK_DIFF.md**를 본다.

**동기화·배치**

- **전체**: 삭제 후 적재. **증분**: `last_synced_at` 이후 Upsert.  
- **폴더 배치**: SFTP/S3 연결, 파일 패턴, 주기, 배치 Job 등록·이력.  
- **DB 탭 배치**: 적재 완료 후 **배치설정**으로 주기 등록.  
- **수동 실행**: 화면의 실행 버튼. 주기 실행은 배치 설정에 따른다.

**목록·한도**

타겟·설명·PK·소스 유형·연결·소스·배치·동기화·상태·동작(미리보기·실행·데이터 추가·PK 설정·삭제)을 목록에서 본다. Job은 `pending` → `running` 큐이며, 백엔드 **동시 최대 3건**이다. ZIP으로 다중 파일 추가 시 파일당 최대 50MB, ZIP 전체 최대 2GB이며, 건너뛴 파일 목록을 볼 수 있다.

**설정·문서**

ETL 사용 시 `config`에 `backend.system_db`, `backend.etl_limits`를 둔다. 상세는 **docs/main/00_PRD.md** §6.3·§6.3.1, **02_BACKEND_GUIDE.md** §3·§6.

### 공통

**설정**

환경은 **`Env/config/config.json`** 만 쓴다(`.env` 미사용).

**API 개요**

FastAPI 기반이다. health, **auth / projects / notifications / admin**, **시스템·로그인 이력**(`system_log_server`, **`/api/system-logs`** — 통합 이력 UI는 `page_size` 기본 10, 화면 10/20/50건, 탭 간 유지), **쿼리 스튜디오**(`/api/*`), **ETL**(`/api/etl`, `/api/etl/batch`), **캠페인 대시보드**(`/api/campaign-dashboard`), **위젯보드**(`/api/widget-boards`)가 있다. PostgreSQL과 연동하며, 쿼리 스튜디오는 `join-order`, `save-query-as-table`·status, `execute-query` 등을 제공한다.

**관리·목록 UI**

사용자·권한·프로젝트·멤버·조직·위젯보드 보드 목록에 공통 필터·정렬·하단 페이지네이션을 쓴다. 목록 API의 기본 정렬은 엔드포인트별로 다르며(다수 `update_dtm DESC NULLS LAST`, 사용자 목록은 부서·역할 고정 순), 세부는 **docs/main/01_FRONTEND_GUIDE.md**, **03_API_GUIDE.md**, **07_USER_FUNCTIONAL_GUIDE.md** §11.0.

---

## 실행 방법

### 1. Python 의존성

```bash
pip install -r requirements.txt
```

가상환경을 만든 뒤 설치하는 것을 권장한다.

### 2. 프론트엔드(React) 의존성

프론트엔드는 **React(Vite)** 로 구성된다.

`python run.py front` 는 `Frontend/react-app` 에서 `npm run build` 를 자동 실행한다. **최초 1회** 또는 `package.json` 변경 후에는 아래를 한 번 실행한다.

```bash
cd Frontend/react-app
npm install
```

### 3. 서버 실행

**방법 A — Windows에서 한 번에**

`start.bat` 을 실행하면 API 서버와 웹 서버가 **각각 새 창**에서 뜬다.

- API: http://localhost:5001  
- 웹: http://localhost:8080/ibank-bi/ — `query-studio`, `dashboard`, `widgetboard`, `etl`

**방법 B — 터미널에서 나눠 실행**

```bash
# 백엔드 API
python run.py back

# 프론트엔드 (다른 터미널) — React 빌드 후 정적 서버
python run.py front
```

| 명령 | 동작 |
|------|------|
| `python run.py` | 인자 없음 → 사용법 출력 |
| `python run.py back` | Backend API (`config.backend.api_port`, 기본 **5001**) |
| `python run.py front` | `Frontend/react-app` 빌드 후 정적 서버 (`config.frontend.static_port`, 기본 **8080**) |
| `python run.py serve` | 빌드 없이 정적 서버만 (배포 시 502 방지용) |

브라우저에서 **http://localhost:8080/ibank-bi/** 로 접속한다.

### 4. 설정 (필수)

API·웹 서버 설정은 **`Env/config/config.json`** 에서 한다.

`Env/config/config.json.example` 을 복사해 `config.json` 으로 만든 뒤 값을 채운다.

**backend**

- `api_host`, `api_port`  
- **jwt_secret** 및 JWT 만료  
- 선택 **smtp_info** (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`, **app_url** — 초대 링크·메일). `host` 가 비면 메일 미발송·로그 폴백.  
- **main_db**(필수) — 쿼리 스튜디오·`execute-query`용 비즈니스 DB  
- `query_timeout_seconds`, `claude_api_key`, `claude_api_url`  
- 노출 테이블은 **main_db.table_schema** 기준(비면 `public`)

**ETL을 쓰는 경우**

- **system_db** — ETL 메타·상용 메타·**system_log** 감사 테이블이 같은 DB  
- **etl_limits** — `max_file_size_mb`, `max_rows_per_load`, `max_batch_size`, **max_zip_extract_total_mb**(기본 2GB) 등

**시스템 감사 계측(선택)**

- **system_log_append_enabled** — `true`일 때만 서버가 `system_log`에 `append_system_log` 로 기록한다. 조회·CSV API는 플래그와 무관.  
- 상세: **docs/main/03_API_GUIDE.md** §3.4, **docs/report/22_System_Log_Development_Plan.md**

**캠페인 대시보드**

- **dash_db** — Star·집계 물리 테이블(`ibank_*_star_*` 등)

**frontend**

- `static_port`, `main_page`, `api_base_url`, `static_dir` (기본: `Frontend/react-app/dist`)

**.env 는 사용하지 않는다.** 환경은 `config.json` 에만 정의한다.

DB 설정이 없으면 API 서버는 "DB 설정이 없습니다" 오류를 반환한다.

---

## 프로젝트 구조

저장소 루트 기준 트리 요약이다. 엔드포인트·모듈 세부는 **docs/main** (00_PRD, 01_FRONTEND, 02_BACKEND, **03_API_GUIDE**)을 본다.

```
프로젝트 루트/
├── run.py
├── start.bat
├── requirements.txt
├── README.md
├── docs/
│   ├── main/           # 00~08 현행 가이드(예: 03_API_GUIDE, 05_PERMISSION_GUIDE, 07_USER_FUNCTIONAL_GUIDE)
│   ├── log/            # log.md (작업 이력)
│   ├── report/         # 보조 설계·배포·체크리스트
│   └── README.md       # docs 폴더 안내
├── Backend/
│   ├── api_server/           # FastAPI 앱·CORS·health·라우터 조립 (main.py)
│   │   ├── main.py
│   │   └── routers/
│   ├── core/                 # db, dependencies, auth_config, logging_setup, dashboard_service, system_audit_log, request_context
│   ├── auth_server/          # /api/auth
│   ├── project_server/       # /api/projects
│   ├── notification_server/  # /api/notifications
│   ├── admin_server/         # /api/admin
│   ├── system_log_server/    # /api/system-logs — system_log·로그인 이력 조회·CSV
│   ├── query_studio_server/  # /api/* (쿼리 빌더 API)
│   ├── etl_server/           # /api/etl, /api/etl/batch (단일 ETL)
│   ├── campaign_dash_server/ # /api/campaign-dashboard (대시보드 API)
│   └── widget_board_server/  # /api/widget-boards
├── Frontend/
│   ├── react-app/
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   ├── app/              # navConfig.js, routes.jsx
│   │   │   ├── packages/
│   │   │   │   ├── query_studio/    # api/queryStudioClient.js
│   │   │   │   ├── campaign_dashboard/  # 대시보드 UI (단일)
│   │   │   │   ├── widgetboard/
│   │   │   │   └── etl/             # api/etlClient.js
│   │   │   └── shared/              # api/http.js, adminClient.js, systemLogClient.js, config/api.js
│   │   └── dist/
│   └── static_server/
└── Env/
    └── config/
```

---

## 사용 흐름

### 리포트

1. `/ibank-bi/query-studio` 에서 사이드바 테이블을 펼치고, 컬럼을 **그리드 영역**으로 드래그한다.  
2. 필요하면 WHERE, ORDER BY, GROUP BY·피벗·HAVING을 설정한다.  
3. **실행** 후 결과·SQL을 확인한다. **해석**으로 Claude SQL 해석, **복사**로 SQL을 복사할 수 있다.

### 대시보드

`/ibank-bi/dashboard` 에 접속한다. 캠페인 대시보드(Star 테이블·`/api/campaign-dashboard`)이며, 테이블·기간·주간/월간 보정 등은 화면 안내를 따른다.

### 위젯보드

`/ibank-bi/widgetboard` — 드래그 앤 드롭 위젯 그리드(리포트 API).

### ETL

`/ibank-bi/etl` — 탭으로 **파일 업로드**, **DB 연결**, **폴더**, **저장 DB 등록**, **ETL 이력** 등을 구분한다.

---

## 문서

| 위치 | 용도 |
|------|------|
| **docs/main/** | 현행 시스템 가이드: 00_PRD, 01_FRONTEND, 02_BACKEND, **03_API_GUIDE**, 04_DB_ARCHITECTURE, **05_PERMISSION_GUIDE**, 06_CUSTOMER_JOURNEY, 07_USER_FUNCTIONAL_GUIDE, 08_TERMINOLOGY |
| **docs/report/22_System_Log_Development_Plan.md** | 시스템 감사·통합 이력 설계 |
| **docs/report/03_AI_DEVELOP_GUIDE.md** | AI·온보딩 지도 |
| **docs/README.md** | `docs` 폴더 구성(main / log / report) 안내 |
| **docs/log/log.md** | 작업 이력(목적·변경 파일) |
| **docs/report/** | 배포·보조 설계·체크리스트 — **동작 정의는 docs/main 우선** |
