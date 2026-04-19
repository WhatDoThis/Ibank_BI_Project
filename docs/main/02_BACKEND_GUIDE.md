# 백엔드 개발 가이드

본 문서는 **docs/main** 내 백엔드 전용 명세이며, **현재 코드 기준** 구조·API·설정·모듈 역할만 다룬다(로드맵·Phase 표현 없음).

- **주요 구현 위치**: `Backend/core`, `Backend/api_server`(호스트), `auth_server`, `project_server`, `notification_server`, `admin_server`, `query_studio_server`, `etl_server`, `campaign_dash_server`, `widget_board_server`
- **작업 이력**: **docs/log/log.md**
- **레이어·의존·탐색**: **docs/report/03_AI_DEVELOP_GUIDE.md**
- **API·인증 흐름 통합**: **03_API_GUIDE.md**
- **ETL 운영·COPY·모달 보조**: **docs/report/08_ETL_Phase_Implement_Guide.md**
- **부록 A**: Flask→FastAPI 전환 당시 참고 요약

---

## 1. 백엔드 개요

### 1.1 역할

1) **호스트·라우터 (`api_server/main.py`)**

- **FastAPI** REST — `include_router` 순서: health → auth → project → notification → admin → **query_studio_server** → **etl_server**(전 라우트 `require_etl_infrastructure`) → **campaign_dash_server**(`require_permission("dashboard")`) → **widget_board_server**(`require_permission("widgetboard")`)

2) **PostgreSQL 용도**

- **메인 DB**: 쿼리 스튜디오·`execute-query` 물리 테이블
- **시스템 DB**: 예 `ibank_system_data` — ETL 메타·`user_info`·부서·프로젝트·`pmssn_master`·매핑 등 — **04_DB_ARCHITECTURE.md**
- **dash_db**: 캠페인 대시보드 Star·집계 물리 테이블

3) **CORS·쿼리 안전**

- CORS 허용
- 쿼리 실행: **SELECT만**, 금지 키워드 문맥 검사(SELECT 문장 제외)

4) **실행·백그라운드**

- `python run.py back` → `config.backend.api_host` / `api_port`(기본 **5001**), uvicorn
- **lifespan**: ETL 폴더/DB 배치 스케줄러(APScheduler)
- **ETL Job 워커**(`queue_worker`): pending 등록 시 **최초 1회** 기동 — 동시 최대 **3건**(`MAX_CONCURRENT`)

5) **인증·인가**

- **`/api/auth/*`**: 로그인·토큰·세션
- 보호 API: **`Authorization: Bearer`** + `session_log.access_token_encrypt`·`refresh_exprtn_dtm` → **`require_active_access`**
- **`POST /api/auth/logout`**: **`require_access_session_bound`**(JWT+세션만, 비활성·잠금 허용)
- 리프레시·세션 끊김: **03_API_GUIDE.md §2.3.3**
- 기능별 권한: **`auth_server.permissions.require_permission`**(`project_info_id`, 멤버, `pmssn_list`) — **03_API_GUIDE.md §2.3**, **05_Permission_ARCHITECTURE.md**

6) **전역 예외**

- 404/500 → `error`·`message` JSON — **docs/report/03_AI_DEVELOP_GUIDE.md §10**

### 1.2 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | FastAPI | 라우터·의존성·자동 검증 |
| 서버 | uvicorn | ASGI |
| DB | PostgreSQL | psycopg2 (비즈니스·시스템 DB), PyMySQL(ETL MySQL 소스), oracledb(ETL Oracle 소스) |
| 설정 | Env/config/config.json | .env 미사용, config.backend / config.frontend |

### 1.3 실행 방식

- **로컬**: `python run.py back` → API 서버만 기동
- **배포**: 루트 **deploy.sh**(빌드 + report-api/report-front 재시작) — **docs/report/DEPLOY_SERVER.md**
- **접속(API 베이스)**: `config.frontend.api_base_url` 예: 로컬 `http://localhost:5001`, 배포 `https://도메인/report_api`

---

## 2. 아키텍처·디렉토리 구조

- 저장소 **현행** 폴더 트리 요약(세부는 코드·`main.py` 기준).

```
Backend/
├── core/                          # 공유 DB·SQL 안전·의존성·대시보드·인증 URL·로깅·초대 만료 (여러 *_server가 import)
│   ├── db.py                      # main/system/dash/etl DB 설정·연결·허용 테이블
│   ├── invite_expiry.py           # 초대 만료 공통
│   ├── sql_safety.py              # contains_dangerous_sql — execute-query·위젯보드 등 SELECT 전용 검사
│   ├── dependencies.py            # get_db, get_config
│   ├── auth_config.py             # JWT·SMTP·get_app_url
│   ├── logging_setup.py
│   ├── dashboard_service.py       # 대시보드 집계(물리 테이블·Star 등)
│   └── user_dvsn_codes.py         # user_dvsn 정규화(조직 역할 코드)
│
├── api_server/                    # FastAPI 호스트 — 앱 조립·CORS·라우터 등록·lifespan
│   ├── main.py
│   └── routers/
│       ├── __init__.py            # health_router, query_studio_router 재export
│       └── health.py
│
├── auth_server/                   # /api/auth — 로그인·2FA·refresh·me·가입·비밀번호
│   ├── router.py                  # 엔드포인트 매핑
│   ├── service.py                 # 가입·로그인·세션·비밀번호·프로필
│   ├── deps.py                    # JWT 검증·세션 바인딩·활성 검사 Depends
│   ├── permissions.py             # 프로젝트·ETL 권한 검증·require_permission 팩토리
│   ├── security.py                # bcrypt·JWT·OTP·비밀번호 정책
│   ├── email_service.py           # SMTP 발송 (로그인 코드·초대)
│   └── schemas.py                 # Pydantic 요청 모델
│
├── project_server/                # /api/projects — 목록·선택(JWT)·초대 수락/거절
│   ├── router.py                  # 엔드포인트 매핑
│   └── service.py                 # 목록·선택·초대 검증·수락·거절
│
├── notification_server/           # /api/notifications — 목록·읽음·알림 적재(내부 호출)
│   ├── router.py                  # 엔드포인트 매핑 (조회·읽음만)
│   └── service.py                 # CRUD + 트랜잭션 내 헬퍼(*_in_txn) + 초대자 알림 + 위젯보드 알림
│
├── admin_server/                  # /api/admin — 부서·사용자·권한·프로젝트·멤버
│   ├── router.py                  # 엔드포인트 매핑
│   ├── deps.py                    # 인증·역할 Depends (org_admin, super_admin, project_admin_or_operator)
│   ├── schemas.py                 # Pydantic 요청 모델 (TableMappingEntry, TransferOwnershipBody 등)
│   ├── service.py                 # 패키지 진입점 (비즈니스는 service_* 분리)
│   ├── service_users.py           # 유저·초대·부서·이관·정지·일괄 변경
│   ├── service_projects.py        # 프로젝트 CRUD·멤버·초대·purge(위젯보드 연쇄)
│   ├── service_roles.py           # 역할 CRUD·사용현황
│   ├── service_tables.py          # 테이블 마스터·프로젝트 매핑 (채널 플래그)
│   └── ownership_guards.py        # 정지·역할 변경 시 소유 자산 409 매트릭스 (widget_board 포함)
│
├── query_studio_server/           # /api/* (list-tables, execute-query 등) — prefix /api
│   ├── router.py                  # 엔드포인트 + 라벨(system_db JSONB)·관계·큐 워커·peak_guard 적용
│   ├── schemas.py                 # Pydantic 요청 모델 (DescribeTableRequest.mapping_usage 등)
│   ├── analysis_store.py          # allowlist_analysis 테이블 CRUD
│   ├── pluralize.py               # 단수→복수 변환·부모 테이블 추론
│   ├── relationship_inference.py  # _id 컬럼 기반 관계 추론
│   ├── join_path.py               # BFS JOIN 경로·순서 결정·순환 검증
│   ├── join_metrics.py            # JOIN 정확도 점수·파생 테이블 컬럼
│   └── peak_guard.py              # 선택 설정: TTL 캐시·동시 계산 상한·분당 한도 (429·503)
│
├── etl_server/                    # /api/etl, /api/etl/batch (main.py는 etl_server.router 만 include)
│   ├── __init__.py                # router re-export (router_file는 router.py가 include)
│   ├── router.py
│   ├── router_file.py             # prefix /batch → 합쳐진 URL /api/etl/batch/*
│   ├── service.py
│   ├── service_file.py
│   ├── load_service.py
│   ├── load_service_file.py
│   ├── db_load_service.py
│   ├── transform_engine.py
│   ├── transform_rules_service.py
│   ├── transform_upsert_verification.py
│   ├── batch_executor_db.py
│   ├── batch_executor_file.py
│   ├── queue_worker.py
│   ├── schema_infer.py
│   ├── preview_service.py
│   ├── csv_reader.py
│   ├── parser_file.py
│   ├── folder_adapter_file.py
│   ├── scheduler_file.py
│   ├── table_master_hook.py
│   ├── etl_limits.py
│   └── timezone_utils.py
│
├── campaign_dash_server/          # /api/campaign-dashboard — Star 집계·/page 번들
│   ├── router.py                  # 엔드포인트 + 내부 집계 함수 (summary·member·hourly·trend-multi·page)
│   └── campaign_period.py         # 기간·추이 창 공통 (calc_summary_date_range, fact_inclusive_end_date 등)
│
└── widget_board_server/           # /api/widget-boards — 보드·레이아웃·초대·공유·위젯 데이터
    ├── router.py                  # 엔드포인트 매핑 (CRUD·초대·공유·데이터)
    ├── service.py                 # 비즈니스 로직 (접근 정책·초대·saved_table·기간 필터)
    ├── schemas.py                 # Pydantic 요청 모델 (초대·공유·레이아웃)
    └── constants.py               # BOARD_DSCRTN_MAX_LEN
```

- **라우터 등록 순서 (`main.py` `include_router`)**
  - health → auth → project → notification → admin → **query_studio_router** → **etl_router** → **campaign_dashboard_router** → **widget_board_router**
- **etl_limits**
  - 모듈: `etl_server/etl_limits.py`
  - config에 `etl_limits` 없으면 기본값(`max_file_size_mb`, `max_rows_per_load`, `max_batch_size`, `max_zip_extract_total_mb`)
  - 항목에 **0** → 해당 한도 없음

---

## 3. 설정

### 3.1 config 로드

- **파일**: `Env/config/config.json` (또는 `config.json.example` 복사 후 수정)
- **로드 경로**: `Env/__init__.py` → `loader.load_config()` → `config.backend`, `config.frontend`
- **백엔드에서 쓰는 블록**
  - `main.py`: `api_host`, `api_port`
  - **`Backend.core.db`**: `backend.main_db`, `system_db`, `etl_db`, `dash_db` — 키 구조 동일 계열(`db_host`, `db_port`, `db_name`, `db_user`, `db_password`, 선택 `table_schema`)
  - 평면 `backend.db_*` 는 **지원하지 않음**
- **쿼리 스튜디오 라우터**: `query_timeout_seconds`, `claude_api_key`, `claude_api_url`, 선택 **`backend.query_studio_peak_guard`** → `query_studio_server/peak_guard.py`

### 3.1.1 메인 DB (main_db)

- **backend.main_db**: 쿼리 스튜디오·execute-query 등 **기본 비즈니스 PostgreSQL**. 키 구조는 **system_db**와 동일.
- **로드**: `Backend.core.db` 의 `get_main_db_config()`, `get_table_schema()` — **`backend.main_db` 만 사용**(블록 없으면 `ValueError`).

### 3.2 시스템 DB (ETL 메타 + 상용 메타)

- **backend.system_db**: db_name 예: `ibank_system_data`. ETL 메타 외 **`user_info`·조직·프로젝트·권한·매핑** 등 동일 DB에 둔다(`04_DB_ARCHITECTURE.md`). `get_db_connection_system()`, `get_system_table_schema()` 사용.
- **ETL 필수 메타 테이블** (시스템 DB, 아래 5종):

| 테이블 | 용도 |
|--------|------|
| **etl_connections** | 소스 연결 정보(연결명, source_type, host, port, database_name, schema_name, username, encrypted_password). |
| **etl_storage_connections** | 저장 DB(적재 대상 PostgreSQL) 등록. connection_name, host, port, database_name, schema_name, username, encrypted_password, is_active. `etl_server`에서 사용. |
| **etl_tables** | 작업 정의(connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode(full\|incremental\|**diff**), status, batch_size, batch_interval_seconds, **storage_connection_id**, **column_mapping**, **on_row_error**, **index_definitions** JSONB, **diff_delete_orphans** 등). on_row_error: 'fail'\|'skip'. index_definitions: 타겟 테이블 인덱스 정의(적재 후 자동 생성). |
| **etl_transform_rules** | 변환 룰(etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active). |
| **etl_jobs** | Job 이력(job_id, etl_table_id, status, started_at, finished_at, rows_processed, total_rows, error_message, notice). |

- batch_size: DB 적재 시 한 번에 가져올 행 수. NULL/0이면 전체. batch_interval_seconds: 배치 간 대기(초). 0이면 대기 없음.
- **batch_jobs**(폴더 배치): **on_file_error** 'stop'\|'continue'(파일 1건 실패 시 run 중단 vs 다음 파일 계속). **index_definitions** JSONB(타겟 인덱스 정의).

동일 **시스템 DB**에 `user_info`·`dptmt_info`·`project_info`·`pmssn_master`·`table_master`·`table_project_mapping` 등 상용화 메타가 함께 존재한다. FK 트리·컬럼 정의는 **04_DB_ARCHITECTURE.md** 를 본다.

### 3.2.1 뉴 대시보드 전용 DB (dash_db)

- **backend.dash_db**: 뉴 대시보드·관련 집계용 PostgreSQL. db_name 예: `ibank_dash_data`. **필수 키**는 system_db와 동일(`db_host`, `db_port`, `db_name`, `db_user`, `db_password`, 선택 `table_schema`).
- **용도**: 물리 테이블 `ibank_1`(집계용)·`ibank_1_0`~`ibank_1_4`(서브 테이블) 조회. `db.get_db_connection_dash()`, `get_dash_table_schema()`, `is_new_dash_physical_table()`, `validate_dashboard_data_table_name()` 사용.
- **연동**: `dashboard_service`·`campaign_dash_server`는 집계·Star 물리 테이블 조회 시 **dash_db**를 사용한다.

### 3.2.2 인증·메일 (backend)

- **jwt_secret**, **jwt_pre_auth_expire_minutes**, **jwt_access_expire_minutes**, **jwt_refresh_expire_days**: access/refresh·2차 인증 pre 토큰. `jwt_secret` 비어 있으면 기동 시 검증 실패 가능.
- **smtp_info** (선택 객체): **smtp_host**, **smtp_port**, **smtp_user**, **smtp_password**, **smtp_from**, **app_url**(초대·가입 링크용 공개 SPA 베이스, 없으면 `backend.app_url` → `frontend.app_url` 순). **smtp_host가 비어 있으면** 실제 SMTP 발송 없이 로그 폴백만(`Backend.core.auth_config.is_smtp_skipped`). 개발·운영 구분 없이 동일 규칙.

### 3.2.3 ETL 저장 DB · 쿼리 스튜디오 피크 가드

- **backend.etl_db**: ETL **적재 대상(저장) PostgreSQL**. `Backend.core.db` 의 `get_etl_db_config()` 등. 키는 `main_db`와 동일.
- **backend.query_studio_peak_guard** (선택): 관계 그래프 **TTL 캐시**, 무거운 관계 계산 **동시 실행 상한**, 사용자당 **분당 execute/관계 API 상한** 등. `enabled: false` 로 비활성화. 키 생략 시 `peak_guard.py` 기본값. `config.json.example` 참고.

### 3.2.4 SQL 안전 검사 (`core/sql_safety.py`)

`contains_dangerous_sql` 함수는 `query_studio_server/router.py`의 `_contains_dangerous_sql`과 동일 로직을 모듈화한 것이다. `widget_board_server`의 `data_source_type=query` 위젯 데이터 조회에서도 동일 함수를 사용해 SELECT 전용 검사를 보장한다.

### 3.2.5 초대 만료 공통 (`core/invite_expiry.py`)

`invite_expired_from_payload(payload)` — `noti_content` 등 dict의 `invite_expires_at`(UTC ISO 문자열)이 현재(UTC)를 넘었는지 판별. `project_server`·`widget_board_server`·`admin_server` 초대 목록에서 공유.

### 3.3 ETL 한도 (etl_limits)

- **backend.etl_limits**: config.json의 backend 안에 선택적으로 지정. **없으면** `Backend/etl_server/etl_limits.py` **기본값** 사용(일반적 서버 4~8GB 메모리 기준 권장).

| 키 | 의미 | config 없을 때 기본값(etl_limits.py) | config 0일 때 |
|----|------|-----------------------------------|----------------|
| **max_file_size_mb** | 파일 적재 시 파일 크기 상한(MB). 초과 시 거부. | 50 | 검사 안 함 |
| **max_rows_per_load** | 1회 적재당 최대 행 수. 파일은 해당 행까지만 읽고, DB는 이 행 수까지만 가져와 적재. | 100_000 | 무제한 |
| **max_batch_size** | DB 적재 시 배치당 최대 행 수(사용자 batch_size 상한). 스트리밍 시 메모리 상한. | 50_000 | 사용자값 그대로 |
| **max_zip_extract_total_mb** | ZIP 추가 적재 시 압축 해제 **총** 용량 상한(MB). 초과 시 add-files-zip 전체 실패(ZIP bomb 방지). | 2048(2GB) | 검사 안 함(0) |

- **파일**: 크기 > max_file_size_mb 이면 실패. CSV는 max_rows_per_load만큼만 읽고, Excel/Parquet는 읽은 뒤 해당 행 수로 자름.
- **ZIP 추가 적재**(POST add-files-zip): 압축 해제 **전**에 `get_max_zip_extract_total_mb()`로 상한(MB) 조회 후, `zf.infolist()`의 `file_size` 합계가 상한을 초과하면 HTTP 400으로 거부. 상한 0이면 검사 생략. UI 안내: 각 파일 최대 50MB(초과 시 해당 파일 Skip), ZIP 전체 최대 2GB(초과 시 데이터 추가 실패).
- **DB**: 사용자 batch_size가 있으면 min(사용자값, max_batch_size)로 배치. **배치 크기 미입력(batch_size=0)** 시: config의 max_rows_per_load가 있으면 그 값을 상한으로 사용하고, 없으면 **기본 10_000건** 상한 적용(PostgreSQL·MySQL·Oracle 공통, `db_load_service`의 `DEFAULT_FETCH_LIMIT_WHEN_NO_BATCH` 등).
- **취소 체크 견고화(etl_server)**: DB 적재 중 `is_job_cancelled` 조회 시 시스템 DB 연결 실패 등 예외가 나면 `_safe_is_job_cancelled`가 False(취소 아님)를 반환해 적재를 계속 진행. 스트리밍·비스트리밍 경로 모두 적용.

### 3.4 ETL 배치·실행 시점

- **배치 크기(batch_size)**: 한 번의 실행 안에서 소스에서 몇 행씩 가져올지. 0/NULL이면 전체 한 번에.
- **배치 간 대기(batch_interval_seconds)**: 한 번의 실행 안에서 배치마다 쉬는 시간(초). 소스 DB 부하 완화용.
- **매일 몇 시 자동 실행**: 미구현. 스케줄(cron/정해진 시각) 없음.
- **실행 시점**: 사용자가 "실행" 버튼을 눌렀을 때만 대기열(pending) 등록 → 워커가 실행. draft/done/error 여부와 관계없이 자동 실행 없음.

---

## 4. API 엔드포인트

### 4.0 auth·project·notification·admin (prefix `/api`)

- **`/api/auth`**: 로그인·2FA·refresh·`/me`·초대 가입·비밀번호 — `Backend/auth_server`
- **`/api/projects`**: 목록·선택(JWT rotate)·생성·멤버·초대·수락/거절 — `Backend/project_server`
- **`/api/notifications`**: 알림·읽음·초대 연동 — `Backend/notification_server`
- **`/api/admin`**: 부서·사용자·역할·프로젝트(어드민) CRUD·초대 메일 — `Backend/admin_server` (프론트 `adminClient.js`)

**세부 표·함수**: **03_API_GUIDE.md** — 흐름 **06_CUSTOMER_JOURNEY.md**, 권한 **05_Permission_ARCHITECTURE.md**

### 4.1 health

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | / | 루트 안내 |
| GET | /api, /api/ | API 안내 |
| GET | /health | 헬스체크 |

### 4.2 query_studio (쿼리 스튜디오, prefix /api)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/list-tables | 테이블 목록 |
| POST | /api/describe-table | 테이블 구조 |
| GET | /api/table-relationships | JOIN 관계 |
| POST | /api/join-order | JOIN 순서 제안 |
| POST | /api/save-query-as-table | 쿼리 결과를 테이블로 저장 요청(백그라운드 큐) |
| GET | /api/save-query-as-table/status/{job_id} | 저장 작업 상태 조회 |
| POST | /api/execute-query | 쿼리 실행 |
| POST | /api/explain-sql | Claude SQL 해석 |
| POST | /api/get-column-values | 컬럼 고유값 |
| POST | /api/query-stats | 쿼리 통계 |

### 4.3 dashboard (prefix /api/dashboard) — 미제공

- **`api_server/main.py`에 라우터 없음** → **404**. 과거 구현 패키지는 제거되었다. UI·API는 **§4.6.2 캠페인 대시보드**만 사용한다.

### 4.4 ETL (prefix /api/etl)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/etl/connections | 연결 목록 |
| POST | /api/etl/connections | 연결 1건 등록 |
| POST | /api/etl/connections/test | 연결 테스트 |
| GET | /api/etl/connections/{id}/tables | 소스 DB 테이블 목록 |
| GET | /api/etl/tables | ETL 테이블 목록 |
| POST | /api/etl/tables | ETL 테이블 1건 등록 |
| PATCH | /api/etl/tables/{id} | ETL 테이블 설정 일부 갱신 |
| GET | /api/etl/tables/{id}/preview | 미리보기(10행) |
| POST | /api/etl/tables/{id}/run | 대기열 등록(실행) |
| POST | /api/etl/tables/{id}/add-file | 단일 파일 추가 적재 |
| POST | /api/etl/tables/{id}/add-files-zip | ZIP 다중 파일 추가 적재 |
| GET | /api/etl/jobs | Job 목록 |
| GET | /api/etl/jobs/{job_id} | Job 1건 조회(폴링) |
| POST | /api/etl/upload | 파일 업로드(multipart) |
| DELETE | /api/etl/tables/{id} | ETL 테이블 삭제 |
| POST | /api/etl/jobs/{job_id}/cancel | Job 취소 |

- 요청/응답 형식: JSON.

### 4.5 ETL (prefix /api/etl, /api/etl/batch) — 단일

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/etl/tables | ETL 테이블 목록 |
| POST | /api/etl/tables | ETL 테이블 1건 등록 |
| POST | /api/etl/upload | 파일 업로드(multipart)·target_table·column_mapping·storage_connection_id |
| **POST** | **/api/etl/infer-schema** | 파일만 업로드 → 스키마(컬럼·inferred_type) 반환, 메타 등록 없음 |
| GET | /api/etl/target-tables | 저장 DB 기준 테이블 목록 (query: storage_connection_id) |
| GET | /api/etl/target-columns | 저장 DB 지정 테이블 컬럼 목록 |
| GET | /api/etl/storage-connections | 저장 DB(적재 대상) 목록 |
| POST | /api/etl/storage-connections | 저장 DB 1건 등록 |
| POST | /api/etl/storage-connections/test | 저장 DB 연결 테스트 |
| GET | /api/etl/connections/{id}/source-columns | 소스 테이블 컬럼 목록 (query: source_table) |
| **GET** | **/api/etl/connections/{id}/source-indexes** | 소스 테이블 PK·인덱스 목록 (query: source_table, is_primary 구분) |
| POST | /api/etl/connections/{id}/validate-incremental-column | 증분 컬럼 날짜 검증 |
| GET | /api/etl/tables/{id}/preview | 미리보기(변환 룰·타입 캐스트 적용 후 저장될 모습) |
| PATCH | /api/etl/tables/{id} | ETL 테이블 설정 일부 갱신(sync_mode, on_row_error, incremental_column, batch_size, **clear_last_synced_at** 등) |
| POST | /api/etl/tables/{id}/run | 실행(대기열 등록) |
| POST | /api/etl/tables/{id}/add-files-zip | ZIP 다중 파일 추가 적재 |
| GET | /api/etl/jobs | Job 목록 |
| GET | /api/etl/jobs/{job_id} | Job 1건 조회 |
| **POST** | **/api/etl/transform/preview** | 변환 룰 적용 미리보기(before/after·column_changes) |
| GET | /api/etl/batch/target-registry | 배치 타겟 레지스트리 목록(ETL 목록용) |
| DELETE | /api/etl/batch/target-registry/{id} | 레지스트리 삭제·배치 Job cascade·타겟 테이블 DROP |
| **POST** | **/api/etl/batch/jobs/from-etl-table** | ETL 테이블 기반 DB 배치 등록. etl_table.status=done 검증(아니면 400). 등록 직후 etl_tables.last_synced_at → batch_jobs.last_synced_at 초기 세팅. |
| (기타) | /api/etl/batch/jobs, validate-target, run/now, history, skipped-files, rollback 등 | 배치 Job CRUD·즉시실행·이력·스킵 파일·롤백 |

### 4.6 뉴 대시보드 (prefix /api/new-dashboard) — 계약 참고

- **운영 API**: **§4.6.2** `/api/campaign-dashboard/*` — 요청·응답은 본 절 **new-dashboard** 계약과 동일
- **데이터 소스**: Star 물리 테이블 — **`config.backend.dash_db`**
- **아래 표 `/api/new-dashboard/*`**: 과거 경로명·계약 정의 보존 — 현재 `main` 에 해당 prefix 라우터 **없음**

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/new-dashboard/summary | 기간별 요약(KPI·증감률·aggregated_data) |
| GET | /api/new-dashboard/trend | 단일 메트릭 추이 |
| GET | /api/new-dashboard/trend-multi | 기간별 복수 메트릭(period: daily/weekly/monthly) |
| GET | /api/new-dashboard/tables | 집계 가능 테이블 목록 |
| GET | /api/new-dashboard/member-summary | 회원 현황(끝점 빼기·분포 등, **§4.6.1** 계산 공식) |
| GET | /api/new-dashboard/delivery-demographics | 발송 기준 인구통계(성별·나이대 등) |
| GET | /api/new-dashboard/hourly | 시간대별 집계(success·open·click 등) |

#### 4.6.1 `member-summary` 계산 공식 (회원 KPI·전환·분포)

BI용 일별 회원 집계(예: Star `ibank_*_star_2`, `base_date`)를 사용한다. **구현**: `Backend/campaign_dash_server/router.py` — `member_summary`.

**핵심 원칙: 끝점 빼기(endpoint subtraction)**

- 일별 `increased_count` / `decreased_count`를 **기간에 대해 SUM 하지 않는다.** 컬럼 정의가 이벤트 건수·전일 대비 등으로 달라질 수 있어 합산은 오해 소지가 있다.
- `total_recipients`가 **일별 잔액(말일·말 시점 총원)** 이라는 전제에서, **기간 순증감**은 **`기간 말 총원 − 직전 동일 단위 기간 말 총원`** 한 번의 뺄셈으로 정한다.

**스냅샷 row 선택**

- **현재 기간(base)**: `date_range`·`curr_end = _snapshot_end_clamped(...)` 로 `[시작, 상한]` 안에서 `base_date` **최신 1건** (`ORDER BY base_date DESC LIMIT 1`). **진행 중인 주·월**은 상한이 `target_date` 등으로 줄어든다.
- **직전 기간(compare)**:
  - **일간**: 직전일 구간 — 상한 `_snapshot_prev_end_clamped` (전일까지).
  - **주간·월간**: 비교 스냅샷은 **직전 기간** `[prev_range[0], prev_range[1]]` 구간에서 `base_date` **최신 1건**을 고른다.

**지표별 정의**

| 구분 | 내용 |
|------|------|
| **전체 회원수** | 표시값 = **base** 행의 `total_recipients`. 증감률 `total_recipients_change_pct` = `(base.total − compare.total) / compare.total × 100` (소수 둘째 자리). **compare** = 직전 기간에 대해 동일 규칙으로 고른 행의 `total_recipients`. |
| **발송 대상 회원수** | 동일 구조로 `target_recipients` 및 `target_recipients_change_pct`. (워크플로 중복 제거 등 의미의 타겟 모수.) |
| **전환(회원 순증감)** | `member_net_flow_count` = `base.total_recipients − compare.total_recipients`. `member_net_flow_pct` = **위 증감률과 동일 공식**(`_calc_change_pct(base.total, compare.total)`). 즉 **전체 회원수 KPI 배지의 증감률과 수치가 일치**한다. |
| **분포**(성별·나이·등급·opt_in 등) | **base 행**의 해당 컬럼만 반환. **증감·비교 없음.** |
| **참고** | `churn_rate` = `decreased_count / total_recipients`, `inflow_share_pct` = `increased_count / total_recipients` — 당일 **base 행** 기준(참고 지표). |

**주간·월간**

- **주간**: 주 범위는 월요일~일요일(`_calc_date_range`). 비교는 **직전 동일 주**의 끝점 행.
- **월간**: 달력 월 초~말. 비교는 **직전 달** 끝점 행.

**요약 식** (compare = 직전 기간 말 스냅샷 총원)

```text
순증감(명) = total_recipients(base) − total_recipients(compare)
증감률(%) = (순증감(명) / total_recipients(compare)) × 100
```

### 4.6.2 캠페인 대시보드 (prefix /api/campaign-dashboard)

- **데이터 소스**: **config.backend.dash_db** 의 Star 물리 테이블 — 발송 팩트 `ibank_*_star_1`, 회원 스냅샷 `ibank_*_star_2`(JSONB 컬럼). 집계·스냅샷 선택 규칙은 `Backend/campaign_dash_server/router.py` 가 담당한다.
- **요청/응답**: 경로·쿼리 파라미터·JSON 필드 이름이 **§4.6 뉴 대시보드**와 동일하다(프론트는 `campaignDashboardClient.js`로 호출).

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/campaign-dashboard/summary | 기간별 요약 |
| GET | /api/campaign-dashboard/trend | 단일 메트릭 추이 |
| GET | /api/campaign-dashboard/trend-multi | 복수 메트릭 추이 |
| GET | /api/campaign-dashboard/tables | 집계 가능 테이블 목록(`*_star_1` 만) |
| GET | /api/campaign-dashboard/member-summary | 회원 현황(계산 원칙은 §4.6.1과 동일 패턴) |
| GET | /api/campaign-dashboard/delivery-demographics | 발송 기준 인구통계 |
| GET | /api/campaign-dashboard/hourly | 시간대별 집계 |

### 4.7 마케팅 대시보드 (prefix /api/new-dashboard2) — 제거됨

- 과거 패키지 및 엔드포인트는 저장소에서 삭제되었다. 동종 기능이 필요하면 별도 패키지·`main` 등록으로 재도입한다.

---

## 5. api_server·core·query_studio_server 상세

### 5.1 main.py (api_server)

- **앱**: FastAPI 생성, `CORSMiddleware(allow_origins=["*"])`, 라우터 등록(health, auth, project, notification, admin, query_studio, etl, **campaign_dashboard**, **widget_board**)
- **예외**: 404/500 → `JSONResponse`
- **lifespan**: ETL 폴더 배치 스케줄러(`etl_server.scheduler_file`) — 실패 시 스택 로깅·API는 계속 기동
- **`__main__`**: `uvicorn.run(app)` — 시작 시 **core.db** 설정 로그 출력

### 5.2 core/db.py

- **메인 DB**: `get_main_db_config()`, `get_allowed_tables(project_info_id, …)`, `get_db_connection()` — 프로젝트 매핑 기준 허용 테이블 필수
- **시스템 DB**: `get_db_connection_system()`, `get_system_table_schema()` — ETL 메타 등
- **dash_db**: `get_dash_db_config()`, `get_dash_table_schema()`, `get_db_connection_dash()`, `is_new_dash_physical_table()`, `validate_dashboard_data_table_name()` — `ibank_1`, `ibank_1_0`~`ibank_1_4`, `ibank_*_star_1`, `ibank_*_star_2` 등
- **공용 모듈**: Flask/FastAPI 무관 — **etl_server**, **campaign_dash_server**, **widget_board_server**, **admin_server** 등에서 import

### 5.3 core/dependencies.py

- **get_db**: 요청 단위 DB 연결(컨텍스트 매니저).
- **get_config**: config 객체 주입.

### 5.4 query_studio_server/schemas.py

- **query_studio_server.schemas**: 쿼리 스튜디오 POST 바디 검증(describe-table, execute-query, join-order 등).

### 5.5 routers (등록 소스)

- **health_router** (`api_server/routers/health.py`): `GET /`, `/api`, `/api/`, `/health`
- **auth_router**: `/api/auth/*`
- **project_router**: `/api/projects`
- **notification_router**: `/api/notifications`
- **admin_router**: `/api/admin/*`
- **query_studio_router** (`query_studio_server/router.py`): prefix `/api` — list/describe/relationships/join-order/save-query-as-table/execute-query/explain-sql/get-column-values/query-stats — **execute-query**: SELECT만·금지 키워드 검사
- **etl_router** (`etl_server/router.py` + `router_file.py`): `/api/etl`, `/api/etl/batch` — `require_etl_infrastructure`(등록은 `main.py`)
- **campaign_dashboard_router**: prefix `/api/campaign-dashboard` — **core.dashboard_service** 등
- **widget_board_router**: `/api/widget-boards/*` — 위젯 보드 메타·레이아웃(`dependencies=[Depends(require_permission("widgetboard"))]`)

### 5.6 core/dashboard_service.py

- 대시보드 집계 비즈니스 로직. db만 사용(프레임워크 무관). `table_id`가 뉴 대시보드 물리 테이블(`ibank_1` 등)이면 dash_db 연결·스키마로 집계.
- **get_aggregatable_tables**: dash_db 스키마에서 `*_star_1` 패턴·`is_new_dash_physical_table` 인 물리 테이블을 매핑과 무관하게 후보로 두고, DASHBOARD_REQUIRED_COLUMNS를 만족하는 것만 반환.

---

## 6. etl_server 상세

### 6.1 역할

- **`router.py`**: `/api/etl` 진입 — `service`, `load_service`, `db_load_service`, `preview_service`, `schema_infer`, `transform_rules_service` 호출
- **`service.py`**
  - 메타 CRUD(connections, tables, jobs), `list_source_tables`(PG/MySQL/Oracle), 연결 테스트
  - **`create_etl_table`**: 동일 `target_table` in `etl_tables` → 거부; 메인 DB에 테이블 있으면 **full**만 거부·**incremental**은 허용
  - 삭제·DROP 생략 등: **`delete_etl_table`** 등 구현 참고
- **`load_service.py`**: 파일 적재 — 파싱(CSV/Excel/Parquet) → 변환 룰 → 메인 DB DROP/CREATE/INSERT; 업로드 파일 **3일** 초과 시 삭제
- **`db_load_service.py`**: DB 적재 — Full / Incremental / **diff**(`_run_diff_sync`); PG·MySQL·Oracle; COPY·`on_row_error`·인덱스
- **`preview_service.py`**: 파일·DB 미리보기(10행)
- **`queue_worker.py`**: pending→running, 동시 **최대 3건**, 완료/실패 갱신

### 6.2 DB 지원 현황

| DB | 포트(기본) | 연결 테스트 | 소스 테이블 목록 | DB 적재(Full/Incremental) | 비고 |
|----|------------|------------|------------------|---------------------------|------|
| **PostgreSQL** | 5432 | ✅ | ✅ | ✅ | psycopg2. |
| **MySQL** | 3306 | ✅ | ✅ | ✅ | PyMySQL. TABLE_SCHEMA=DB명, backtick 인용. |
| **Oracle** | 1521 | ✅ | ✅ | ✅ | oracledb. **Service Name만** 지원(DSN host:port/서비스명, SID 미지원). 목록·미리보기·PK 자동 조회·적재 모두 지원. list_source_tables: 스키마 미지정·PUBLIC이면 USER_TABLES(접속 사용자 소유만), 스키마 지정 시 ALL_TABLES 해당 OWNER. source_table 저장 형식 OWNER.TABLE_NAME. |

### 6.3 외부 DB 연결 구조·실패 시 점검

- **연결 경로**: 브라우저 → HTTP → **Backend API** → TCP → **외부 DB** (브라우저는 DB에 직접 연결하지 않음)
- **경유 IP**: 방화벽/DB 로그의 클라이언트 IP = **Backend 호스트 IP** (`python run.py back` 실행 머신)
- **실패 시 점검 순서**
  1. Backend 실행 호스트·IP 확인
  2. Backend 터미널 로그(연결 시도/실패)
  3. 외부 DB: 포트 인바운드·**Backend IP** 허용·listen·접속 권한
  4. Backend 호스트에서 `telnet` / `Test-NetConnection` 등으로 포트 확인
- **실패 메시지 예**: 타임아웃, `connection refused`, 인증 실패, 호스트/DNS 오류 — `service.py` `_connection_error_to_user_message()`; `connect_timeout` **15초**
- **Oracle**: **Service Name**만(`@호스트:1521/서비스명`); PG는 **5432**, MySQL **3306** 구분

### 6.4 Job 확인 방법 (운영)

- **터미널 로그** (`python run.py back`)
  - 포맷: `core/logging_setup.py` — `YYYY-MM-DD HH:MM:SS / [LEVEL] message`
  - 파일 적재: `etl_file_load` start/done/fail 등
  - DB 적재: `etl_db_load_done` / `etl_db_load_fail` 등 — `logger.exception` 블록으로 스택 확인
- **시스템 DB `etl_jobs`**: `status`, `finished_at`, `error_message` — `running`+`finished_at` NULL은 실행 중 또는 미갱신; `failed`는 `error_message` 확인
- **파일 적재**: `etl_tables.file_path` 존재(3일 후 정리)·메인 DB `target_table` 건수
- **DB 적재**: `POST /api/etl/connections/test`; incremental이면 **`pk_columns` 필수**
- **running 고착 시 수동 정리**: `etl_jobs` UPDATE → `failed`, `finished_at`, 메시지 `수동 종료`; 필요 시 `etl_tables.status='error'`

### 6.5 재실행 시 동작

| 소스 | sync_mode | 재실행 시 동작 |
|------|-----------|----------------|
| **파일** | - | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **full** | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **incremental** | 테이블 유지. last_synced_at 이후만 조회 후 **Upsert.** |
| **DB** | **diff** | 테이블 유지. 소스/타겟 PK 집합 비교 후 신규 행 INSERT·선택 시 타겟만 DELETE orphan. last_synced_at 갱신 없음. 최초 적재는 full 후 전환. 상세 **docs/report/14_ETL_PK_DIFF.md**. |

### 6.6 모듈 의존

| 순서 | 파일 | 역할 |
|------|------|------|
| 1 | router.py | /api/etl 진입, service·load_service·db_load_service·preview_service·schema_infer·transform_rules 호출 |
| 2 | load_service.py | 파일 적재 |
| 3 | db_load_service.py | DB 적재 Full/Incremental/**diff**·PostgreSQL·MySQL·Oracle |
| 4 | transform_rules_service.py | etl_transform_rules CRUD |
| 5 | service.py | 시스템 DB 메타·Job·list_source_tables |
| 6 | transform_engine.py | 변환 룰 적용(pandas)·날짜/시간 연산 등 |
| 7 | schema_infer.py | 스키마 추론(pandas) |

### 6.7 etl_server (단일 ETL)

#### 6.7.1 API 범위·공통

- prefix **`/api/etl`**, **`/api/etl/batch`** — 저장 DB·테이블·컬럼 매핑·**COPY FROM STDIN**·**`on_row_error`**(fail/skip)
- 동일 **`target_table`** 다른 연결에서 추가 적재 허용
- **`GET …/tables/{id}/preview`**: 변환 룰·타입 캐스트 반영 후 미리보기(`preview_service` → `_get_preview_with_transform`)
- **`PATCH …/tables/{id}`**: `clear_last_synced_at: true` → 증분 기준(`last_synced_at`) 초기화
- **`delete_etl_table`**: 참조 **batch_jobs**, `batch_loaded_keys`, `batch_run_history` 선삭제 후 `etl_tables` 삭제
- **폴더 배치**: `batch_jobs`(`on_file_error`, `index_definitions`), `batch_run_history`, **`etl_batch_target_registry`**
- **`get_skipped_filenames_set`** + **`batch_executor_file`**: 스킵/에러 파일명으로 pending 재시도 억제; 타겟 삭제 시 `delete_batch_target_registry_and_drop_table`
- **`create_batch_job`** 중복 검사, **`update_run_progress`** 실시간 갱신

#### 6.7.2 실행기·파일·CSV

- **`batch_executor_file`**: 대기 파일 없으면 run 기록 미생성; `on_file_error=continue` → 파일별 실패 후 계속·`partial_error`; commit 실패 명시 처리
- **`batch_executor_db`**: `etl_table_id` 있으면 `list_transform_rules` → `apply_rules` → `apply_mapping_type_cast` → 적재(파일 적재와 동일 순서)
- **`csv_reader.read_csv_robust`**: 인코딩 감지·순차 시도 — `load_service`·`parser_file` 공용
- **`parser_file.get_pending_files`**: 첫 실행 시 전부 반환
- **`folder_adapter_file.download_file_head`**: 64KB
- **`transform/preview`**: `get_raw_sample`·`apply_rules`
- **`load_service_file`**: `_batch_upsert` — `INSERT DO NOTHING` 후 변경 행만 `UPDATE`(`IS DISTINCT FROM`); `inserted_this_batch == len(rows)`면 UPDATE 생략; 테이블 신규 생성 직후 PK 있으면 `_batch_upsert`; `add_allowed_table`은 `storage_connection_id` 없을 때만

#### 6.7.3 db_load·transform·검증

- **`db_load_service`**: `run_db_load` 연결 누수 방지·`finally` close; 적재 후 **`index_definitions`** → `_create_indexes_on_target`; **`get_source_indexes`**(PG/MySQL/Oracle)
- **`transform_engine._apply_type_cast_with_mask`**: 벡터화
- **`transform_upsert_verification`**: 룰·엔진 출력과 `load_dataframe` / `_batch_upsert` 호환(`run_dry_run_pipeline`, `verify_transform_output_columns`)
- **`service.claim_next_pending_job`**: `finally` rollback-safe; **`_sys_cursor`** 컨텍스트 매니저
- **`load_service`**: `run_file_load` / `run_file_upsert`에서 변수명 **`etl_row`**(shadowing 방지); CSV는 `read_csv_robust`; commit 후 인덱스 생성
- **`batch_executor_db`**: `pk_columns` 없으면 **`_fetch_source_pk`**; **`sync_mode=diff`** → `_run_diff_sync`(batch); 사전 검증은 **14_ETL_PK_DIFF.md**

#### 6.7.4 라우터·서비스 파일

- **`router.py`**: tables, upload, infer-schema, target-tables/columns, storage-connections, source-columns, **`GET …/source-indexes`**, validate-incremental-column, transform/preview, PATCH tables, jobs, preview, run, add-files-zip
- **`router_file.py`**: batch jobs CRUD, **`POST …/from-etl-table`**(`etl_table.status=done`, `last_synced_at` 초기화), target-registry, validate-target, run/now, history, detail, skipped-files, rollback; 폴더 컬럼 조회 시 CSV는 `download_file_head`만
- **`service.py`**: target·storage CRUD, **`create_etl_table`(`index_definitions`)** 등; **`claim_next_pending_job`**, **`_sys_cursor`**
- **`service_file.py`**: `batch_jobs`, 폴더 연결, 이력, 레지스트리 — `create_batch_job`, `delete_batch_job`(FK 순서), `update_run_progress`, `finish_run`, `create_batch_run`

#### 6.7.5 기능 체크리스트·메타

1. 저장 DB: `etl_storage_connections`, `get_target_db_connection`
2. 테이블·컬럼·인덱스: `list_target_tables`, `list_target_columns`, **`get_source_indexes`**
3. **`infer-schema`**: 파일만 업로드 → 스키마
4. **`column_mapping`**·변환 룰: `apply_mapping_type_cast`, transform rules
5. **`on_row_error`**, Incremental
6. COPY 후 **`index_definitions`** → `_create_indexes_on_target`
7. **`etl_batch_target_registry`**: list/upsert/clear/delete
8. 배치 실행: `run_batch_job`, `on_file_error`, `index_definitions`

**메타 테이블**: `etl_tables`, `etl_storage_connections`, **`batch_jobs`**, `batch_folder_connections`, `batch_run_history`, `etl_batch_target_registry` — 상세 **08_ETL_Phase_Implement_Guide.md**, **09_ETL_SFTP_Connection.md**

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 |
| 02_BACKEND_GUIDE.md | 백엔드 구조·기술 스택·API·설정·etl_server 가이드 명세 (본 문서) |
| 03_API_GUIDE.md | 모듈별 API·인증 흐름·엔드포인트 통합 레퍼런스(대용량) |
| docs/report/03_AI_DEVELOP_GUIDE.md | 레이어·의존 방향·DB 연결 매트릭스·확장 체크리스트 (AI·온보딩) |

- **`docs/report`**: 배포·실행 로그·보조 설계
- **동작 정의 기준**: 본 문서·**00_PRD**·**01_FRONTEND_GUIDE**·**docs/report/03_AI_DEVELOP_GUIDE.md**

**문서 이력**: 본 파일에 날짜 타임라인 없음 → **docs/log/log.md**·Git

---

## 부록 A. Flask → FastAPI 전환 요약 (참고)

운영 백엔드는 FastAPI 기준이다. 아래는 전환 당시 구조 정리·참고용 요약이다.

### A.1 목적·원칙

- **목적**: Flask 기반 Backend API를 FastAPI로 전면 교체.
- **상태**: **전환 완료**. 이후 변경 이력은 **docs/log/log.md** 참고.
- **원칙**: config 로드 방식 유지, 프론트 영향 최소화, 의존성 낮은 파일부터 순차 적용.

### A.2 파일별 의존성 (전환 후 구조)

| 순서 | 위치 | 비고 |
|------|------|------|
| 1 | core/db.py | Env.config, psycopg2 |
| 2 | core/dashboard_service.py | db만 사용 |
| 3 | core/dependencies.py | get_db, get_config |
| 4 | query_studio_server/schemas.py | Pydantic |
| 5 | query_studio_server/router.py, api_server/routers/health.py | APIRouter |
| 6 | api_server/main.py | FastAPI, CORS, 라우터, uvicorn |

### A.3 Phase 요약

| Phase | 대상 | 내용 |
|-------|------|------|
| 0 | 계획서 | 문서 작성 |
| 1 | core/db.py, Env | 설정·DB 검증 |
| 2 | core/dashboard_service.py | 변경 없음 |
| 3 | routes.py | Flask → FastAPI APIRouter, 동일 경로·응답 |
| 4 | main.py | FastAPI 앱·CORS·라우터·uvicorn |
| 5 | run.py | 의존성 오류 시 fastapi/uvicorn 안내 |
| 6 | requirements.txt | flask 제거, fastapi·uvicorn 추가 |
| 7 | README, docs/main | Flask → FastAPI 문구 |
| 8 | 검수·query_studio | 연동 테스트, log.md |

### A.4 롤백 시 참고

- Phase 3·4 완료 후 롤백: Git에서 main.py·routers/ 이전 커밋 복원, requirements.txt·run.py를 Flask 기준으로 되돌림.
