# 백엔드 코드·API 통합 가이드

본 문서는 **docs/main** 내에서 **`Backend/`** 패키지를 **호스트 앱 → 인증 → 각 서버 라우터** 순으로 따라가며 정리한 **API·모듈 통합 레퍼런스**다.

- **표**: 모듈·파일 단위로 함수·엔드포인트를 요약한다.
- **ASCII 흐름도**: 시스템·업무 흐름을 도식으로 보인다.
- **절 구성**: 동작 단위(호스트 → auth → admin → project → 대시보드 등)로 §1~§7을 나눈다. **라우터 마운트 순서**는 §1.1과 같다(auth 다음 project·notification·admin). **§3·§4**는 조직 관리 → 프로젝트 선택 흐름을 읽기 쉽게 admin을 앞에 둔다.
- **절 안 배치**: 흐름도 바로 아래에 그 흐름에 쓰이는 모듈·함수 표를 둔다(한 화면에서 API 한 줄의 원인을 추적하기 쉽게).

**병행 문서**

- **구조·실행·디렉터리**: **02_BACKEND_GUIDE.md**
- **DB 스키마**: **04_DB_ARCHITECTURE.md**
- **권한·역할**: **05_PERMISSION_GUIDE.md**
- **동작 기준**: **docs/main** 번호 문서(00~08: PRD·프론트·백엔드·본 문서·DB·권한·여정·기능·용어). 엔드포인트·인증·동작 설명은 본 디렉터리가 정본이며, 다른 위치의 작업 메모와 충돌 시 **`docs/main`** 을 따른다.

**도식(ASCII) 표기**

- 흐름도 박스·주요 단계는 **`한글 단계명 (함수·Depends·엔드포인트 등 코드 식별자)`** 한 줄을 소제목으로 둔다.
- 괄호 안 이름은 저장소 코드와 동일하게 쓴다.

---

## 목차

아래 번호 순서대로 읽으면 된다.

1. **[§1 API 호스트·공유 코어](#1-api-호스트공유-코어-api_server-core)** — 앱 기동, 로깅, DB 풀, sql_safety, invite_expiry, `auth_config`·역할 코드 · §1.6 동기·비동기·동시성(동일 절 본문)
2. **[§2 auth_server](#2-auth_server-인증세션권한-게이트)** — 로그인·토큰·`require_active_access`·`require_permission`·refresh/정지 연동
3. **[§3 admin_server](#3-admin_server-조직프로젝트-관리)** — 초대~생성~멤버, 소유 가드, 이관·정지
4. **[§4 project_server](#4-project_server-프로젝트-목록선택초대-응답)** — 목록, `select`, 타부서 초대 수락·거절
5. **[§5 캠페인 대시보드](#5-캠페인-대시보드-campaign_dash--core)** — [§5.3 HTTP 라우터](#53-campaign_dash_serverrouterpy) · `dashboard_service` · campaign_period
6. **[§6 기타 패키지](#6-기타-패키지)** — [§6.0 패키지 한눈에](#60-패키지-한눈에) · [§6.1 알림](#61-notification_server) · [§6.2 위젯 보드](#62-widget_board_server) · [§6.3 쿼리 스튜디오](#63-query_studio_server)
7. **[§7 etl_server](#7-etl_server)** — `/api/etl`·`/api/etl/batch`·Job 큐·변환 룰·적재 파이프라인

---

## 1. API 호스트·공유 코어 (`api_server`, `core`)

FastAPI 앱 조립·공용 DB 풀·헬스·쿼리 스튜디오/ETL 등 라우터 등록이 모두 이 범주에 해당한다.

### 1.1 앱 기동 흐름

일반 로컬 기동은 **`python run.py back`** 이다. 아래는 **앱 조립 관점**의 순서이며, `api_server/main.py`를 **직접 실행**할 때는 [§2 로깅 초기화](#2-로깅-초기화-직접-실행-시)가 `uvicorn` 이전에 선행된다.

```
서버 시작 (python main.py 또는 run.py → main 진입)
│
▼
┌─────────────────────────────────────────────┐
│  설정 로드 (config.json·Env)                   │
│  config.json 로드                             │
│  ├─ main_db (비즈니스 데이터)                  │
│  ├─ system_db (인증·프로젝트·권한)             │
│  ├─ etl_db (ETL 메타)                         │
│  └─ dash_db (대시보드)                         │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  DB 연결 풀 (core/db.py)                      │
│  core/db.py — 4개 연결 풀 초기화              │
│  ├─ _MAIN_DB_POOL (main_db)                  │
│  ├─ _SYSTEM_DB_POOL (system_db)              │
│  ├─ _ETL_DB_POOL (etl_db)                    │
│  └─ _DASH_DB_POOL (dash_db)                  │
│  각 풀: min=1, max=30, ThreadedConnectionPool │
│  공통: libpq TCP keepalive·checkout 시 끊김 연결 폐기·cursor 시 닫힘 재획득(§1.3) │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  앱·라우터 조립 (FastAPI·main.py)              │
│  FastAPI app 생성                              │
│  ├─ CORS 미들웨어 (allow_origins=["*"])       │
│  ├─ CorrelationIdMiddleware (`X-Request-Correlation-Id`, `core.request_context`) │
│  ├─ lifespan → ETL scheduler 기동             │
│  └─ 라우터 등록(health → … → widget_board):   │
│     ├─ health_router        (인증 없음)       │
│     ├─ auth_router          (/api/auth)       │
│     ├─ project_router       (/api/projects)   │
│     ├─ notification_router  (/api/notifications)│
│     ├─ admin_router         (/api/admin)      │
│     ├─ system_log_router    (/api/system-logs)│
│     ├─ query_studio_router  (/api/*)          │
│     ├─ etl_router           (/api/etl)        │
│     │   router.py + router_file(/batch)       │
│     │   → /api/etl/batch/*                    │
│     │   dependencies=[Depends(require_etl_infrastructure)]│
│     ├─ campaign_dashboard_router (/api/campaign-dashboard)│
│     │   dependencies=[Depends(require_permission("dashboard"))]│
│     └─ widget_board_router  (/api/widget-boards)     │
│         dependencies=[Depends(require_permission("widgetboard"))] │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  HTTP 수신 대기 (uvicorn.run)                 │
│  uvicorn.run(host, port)                      │
│  → HTTP 요청 수신 대기                        │
└─────────────────────────────────────────────┘
```

#### `api_server/main.py`

| 함수 | 기능 |
|------|------|
| `lifespan` | 앱 시작 시 ETL 배치 스케줄러 기동 |
| `app` | FastAPI 인스턴스 생성, CORS, `CorrelationIdMiddleware`, 라우터 등록 |
| `not_found_handler` | 404 JSON 응답 |
| `internal_error_handler` | 500 JSON 응답 |
| `__main__` | config 읽어 uvicorn 실행 (`configure_root_logging` 선행) |

#### `api_server/routers/__init__.py`

| 함수 | 기능 |
|------|------|
| `health_router` | `health.py` 라우터 re-export |
| `query_studio_router` | `query_studio_server` 라우터 re-export |

#### `api_server/routers/health.py`

| 함수 | 기능 |
|------|------|
| `health_check` | DB `SELECT 1` 헬스체크 |
| `index` | 루트 `/` 안내 JSON |
| `api_index` | `/api` 엔드포인트 목록 JSON |

#### 요청 상관 ID (`api_server/middleware/correlation.py`, `core/request_context.py`)

- **요청**: `X-Request-Correlation-Id` 없으면 서버가 UUID 발급. 값이 있으면 최대 128자 트림 후 UUID 파싱, 실패 시 새 UUID 발급.
- **저장**: `contextvars` + `request.state.correlation_id`. `append_system_log` 시 `SystemLogRow.request_correlation_id` 가 비어 있으면 현재 컨텍스트 값을 사용.
- **응답**: 동일 UUID를 `X-Request-Correlation-Id` 로 반사.
- **실패**: 미들웨어 설정 단계 예외는 로깅 후 요청은 계속(상관 ID 없을 수 있음). DB I/O 없음.
- **추가 contextvars**: `request_client_host`, `request_user_agent_raw` — `append_system_log` 가 `client_ip_masked`·`user_agent_summary` 를 비운 행으로 호출될 때 마스킹·요약으로 채운다.

---

### 1.2 로깅 초기화 (직접 실행 시)

`api_server/main.py` 의 **`__main__`** 은 **`core/logging_setup.configure_root_logging()`** 으로 루트 로깅을 구성한 뒤 config 로드·uvicorn을 실행한다.

```
python main.py (직접 실행)
│
▼
┌──────────────────────────────────────────┐
│  루트 로깅 구성 (configure_root_logging)    │
│  configure_root_logging()                 │
│  core/logging_setup.py                    │
│  ├─ 루트에 달린 핸들러 제거 후 재구성       │
│  ├─ StreamHandler(stdout) 추가             │
│  ├─ _AppFormatter 적용                     │
│  │   "2026-04-09 15:30:00 / [INFO] ..."  │
│  └─ uvicorn.access → WARNING              │
└──────────┬───────────────────────────────┘
           ▼
┌──────────────────────────────────────────┐
│  기동 마무리 (__main__: UTF-8·uvicorn)      │
│  Windows: stdout/stderr UTF-8 래핑       │
│  config 로드 → uvicorn.run              │
└──────────────────────────────────────────┘
```

#### `core/logging_setup.py`

| 함수 | 기능 |
|------|------|
| `_AppFormatter` | `YYYY-MM-DD HH:MM:SS / [LEVEL] message` 포맷 |
| `configure_root_logging` | 루트 로거 포맷 적용 + `uvicorn.access` WARNING으로 완화 |

---

### 1.3 DB 연결 분리 구조

```
┌─────────────────────────────────────────────────────┐
│  설정 블록 (config.json — main·system·etl·dash)       │
│                    config.json                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │ main_db  │ │system_db │ │ etl_db │ │ dash_db  │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └────┬─────┘ │
└───────┼─────────────┼───────────┼───────────┼───────┘
        │             │           │           │
        ▼             ▼           ▼           ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 비즈니스 │  │  인증     │ │ ETL 메타 │ │ 대시보드 │
│ 테이블   │  │  프로젝트 │ │ 커넥션   │ │ 집계     │
│ (쿼리)   │  │  권한     │ │ 잡/배치  │ │ Star     │
└──────────┘  └──────────┘ └──────────┘ └──────────┘
     │              │            │            │
     ▼              ▼            ▼            ▼
 get_db()     get_system_db()  get_db_     get_db_
 get_db_      get_db_          connection_ connection_
 connection() connection_      etl()       dash()
              system_core()
```

**누가 어떤 풀을 쓰는가**

```
health, query_studio ──────→ _MAIN_DB_POOL
auth, admin, project ──────→ _SYSTEM_DB_POOL
etl_server ────────────────→ _ETL_DB_POOL
campaign_dashboard ────────→ _DASH_DB_POOL (+ _MAIN_DB_POOL)
widget_board (메타)  ──────→ _SYSTEM_DB_POOL
widget_board (데이터) ─────→ _MAIN_DB_POOL 또는 _DASH_DB_POOL (data_source_type에 따라)
```

**연결 풀·유휴 끊김 (stale)**

- 네 풀과 `get_db_connection*` 이 반환하는 **직접 연결 fallback** 모두, `psycopg2.connect` / `ThreadedConnectionPool` 생성 시 **libpq TCP keepalive**(`keepalives`, `keepalives_idle`, `keepalives_interval`, `keepalives_count`)를 켠다. 유휴 TCP가 NAT·방화벽 등에서 끊기는 빈도를 줄이기 위함이다.
- `getconn()` 직후 **연결 `closed` 검사**와 **`set_client_encoding("UTF8")`** 를 시도한다. `OperationalError`·`InterfaceError`면 해당 소켓을 **`putconn(..., close=True)`** 로 풀에서 제거한 뒤 **동일 설정으로 직접 연결**을 연다.
- `_PooledConnection.cursor()` 에서 psycopg2가 연결을 닫힌 것으로 보면(`closed != 0`) 풀에 폐기 후 **한 번 재획득**한다.
- 중간 경로에서 **half-open**(TCP만 끊기고 클라이언트는 아직 살아 있는 것으로 보는 경우)이면 `closed` 가 0인 채 **첫 `execute` 계열**에서 `server closed the connection unexpectedly` 가 날 수 있다. 그때는 재시도·DB/네트워크 로그로 **서버 재시작·세션 킬**과 구분한다.

#### `core/db.py`

| 함수 | 기능 |
|------|------|
| `_PooledConnection` | 풀 연결 래퍼 (`close` → `putconn`; `cursor()` 시 닫힌 연결이면 풀 폐기 후 재획득) |
| `get_main_db_config` | `backend.main_db` 에서 메인 DB 연결 dict (블록 필수) |
| `get_system_db_config` | 시스템 DB 연결 dict |
| `get_etl_db_config` | ETL DB dict (없으면 system_db fallback) |
| `get_dash_db_config` | 대시보드 DB 연결 dict |
| `get_dash_table_schema` | `dash_db` 스키마명 (기본 `public`) |
| `get_system_table_schema` | ETL 스키마 우선, system_db fallback |
| `get_system_table_schema_core` | system_db 스키마 고정 반환 |
| `get_allowed_tables_by_project` | project_info_id + db_type + 선택적 usage_query_studio/usage_widgetboard 플래그 필터 |
| `get_allowed_tables` | `project_info_id` 필수, 매핑 기반(`get_allowed_tables_by_project`) |
| `get_table_schema` | `main_db.table_schema`(비면 `public`; `main_db` 없으면 오류) |
| `_table_exists` | 테이블 존재 여부 (내부) |
| `_query_table_columns` | 컬럼명 목록 조회 (내부) |
| `_query_primary_key_columns` | PK 컬럼 목록 조회 (내부) |
| `get_table_columns_with_types` | 컬럼명 + `data_type` 목록 |
| `get_all_tables_columns_with_types` | 복수 테이블 일괄 컬럼·타입(`project_info_id` 필수) |
| `get_table_columns_for_etl_target` | ETL 타겟 컬럼 (allowed 미검사) |
| `get_primary_key_columns_for_etl_target` | ETL 타겟 PK (allowed 미검사) |
| `get_db_connection` | 메인 DB 풀 연결(끊김 checkout 시 직접 연결 fallback; keepalive 공통) |
| `get_db_connection_etl` | ETL DB 풀 연결 (`get_etl_db_config`; etl_db 없으면 system_db fallback) |
| `get_db_connection_system` | ETL 호환 alias — 내부적으로 `get_db_connection_etl()` 과 동일 풀 |
| `get_db_connection_system_core` | system_db 고정 풀 연결(동일 checkout·keepalive 정책) |
| `get_db_connection_dash` | 대시보드 DB 풀 연결(동일 checkout·keepalive 정책) |
| `_pool_threaded_kwargs` / `_direct_db_connect` / `_acquire_from_threaded_pool` | (내부) keepalive 포함 연결 kwargs·직접 연결·풀 `getconn` 후 유효성 실패 시 폐기 및 fallback |
| `is_new_dash_physical_table` | `ibank_1` 계열 패턴 판별 |
| `validate_dashboard_data_table_name` | 대시보드 테이블명 검증 |
| `is_table_allowed_for_project_dashboard` | `*_star_1`·`*_star_2` 물리 존재 시 매핑 없이 허용; 그 외 dash는 대시보드 기능 켜진 프로젝트는 table_master dash 카탈로그, 아니면 매핑만 |
| `format_value` | datetime/decimal 등 JSON 직렬화 |
| `validate_table_name` | 이름 패턴 + 스키마 존재 검증 |
| `validate_column_name` | 컬럼명 패턴 검증 |
| `safe_rollback` | 서버 연결 종료 후에도 InterfaceError 없이 rollback 시도 |
| `_normalize_db_type` | db_type(main/dash) 정규화, 유효하지 않으면 ValueError |
| `list_dash_schema_table_names` | dash_db 스키마 BASE TABLE 이름 목록(캠페인 대시보드 후보 스캔) |
| `get_merged_allowed_table_names_for_project` | 쿼리스튜디오·위젯보드용 허용명 — main_db 매핑만(dash 제외) |
| `validate_table_identifier` | 이름 패턴만 검증(물리 존재는 호출부에서 해당 연결·스키마로 확인) |
| `project_dashboard_feature_enabled` | project_info.feature_flags.dash가 False가 아니면 True |
| `get_table_master_table_names_by_db_type` | table_master에서 db_type 일치하는 table_name 집합 |

#### `core/sql_safety.py`

| 함수 | 기능 |
|------|------|
| `contains_dangerous_sql` | 세미콜론 분할 후 비SELECT 구간에서 DDL/DML 금지어 검사 — `query_studio_server.router`의 `_contains_dangerous_sql`은 동일 모듈의 래퍼(디버그 로그 후 `contains_dangerous_sql` 호출). `widget_board_server` `fetch_widget_data`(query 타입)도 동일 `core.sql_safety` 사용 |

#### `core/invite_expiry.py`

| 함수 | 기능 |
|------|------|
| `invite_expired_from_payload` | noti_content 등 dict의 invite_expires_at(UTC ISO) 만료 여부 판별 — project·widget_board·admin 초대 목록 공유 |

#### `core/dependencies.py`

| 함수 | 기능 |
|------|------|
| `get_db` | 요청당 메인 DB 연결 yield → close |
| `get_config` | `config.backend` 반환 |
| `get_system_db` | 요청당 `system_db` 연결 yield → close |

---

### 1.4 JWT·SMTP·역할 코드 (`core`)

#### `core/auth_config.py`

| 함수 | 기능 |
|------|------|
| `_smtp_config_source` | SMTP 설정 소스 결정 (`smtp_info` 우선) |
| `get_jwt_secret` | JWT 서명 비밀키 반환 |
| `get_jwt_pre_auth_expire_minutes` | pre_auth 만료 분 (기본 5) |
| `get_jwt_access_expire_minutes` | access 만료 분 (기본 30) |
| `get_jwt_refresh_expire_days` | refresh 만료 일 (기본 7) |
| `get_app_url` | 공개 SPA 베이스 URL 반환 |
| `get_smtp_settings` | SMTP host/port/user/password/from dict |
| `is_smtp_skipped` | SMTP 미설정 시 true |

#### `core/user_dvsn_codes.py`

| 함수/상수 | 기능 |
|-----------|------|
| `ALLOWED_USER_DVSN` | 허용 역할 집합 (`sa_dev`, `sa`, `a`, `o`, `u`) |
| `ORG_ADMIN_DVSN` | 조직 관리 역할 (`sa_dev`, `sa`, `a`) |
| `SUPER_ORG_DVSN` | 슈퍼 관리 역할 (`sa_dev`, `sa`) |
| `PROJECT_ADMIN_DVSN` | 프로젝트 관리 역할 (`sa_dev`, `sa`, `a`, `o`) |
| `canon_user_dvsn` | 역할 코드 정규화 (허용 외 → 빈 문자열) |

---

### 1.5 로그 출력·실행 참고

| 대상 | 내용 |
|------|------|
| **`core/logging_setup.py`** | `_AppFormatter`: `YYYY-MM-DD HH:MM:SS / [LEVEL] message`. `configure_root_logging`: 루트 로거에 위 포맷 적용, `uvicorn.access` 는 WARNING. |
| **`api_server/main.py`** (`__main__`) | `configure_root_logging()` 후 config 로드·uvicorn 실행. 한 줄 로그 형식은 `asctime / [LEVEL] message` (`logging_setup` 기준). |

---

### 1.6 동기·비동기 처리·동시성 (요청 스레드·백그라운드·경쟁)

- 이 절의 목적: 화면에서 호출하는 대부분의 API가 요청 한 번 안에서 어떻게 끝나는지, ETL·쿼리 저장처럼 응답을 먼저 보내고 뒤에서 돌아가는 부분이 있는지, 두 사람이 같은 행을 거의 동시에 고치면 DB·감사·알림이 어떻게 보일지 한곳에 정리한다.
- 용어(이 절에서만 풀어 쓴다. 다른 `docs/main` 문서에서는 같은 설명을 반복하지 않고 이 절을 가리킨다):
 - 동기 처리: HTTP 요청을 받은 스레드가 DB 작업부터 JSON 응답까지 이어서 처리하는 방식이다.
 - 백그라운드(HTTP와 분리): 응답을 먼저 보내고, 다른 스레드나 워커가 큐 등에서 나머지 작업을 이어 한다.
 - last-write-wins(LWW): 행에 버전 조건 없이 두 트랜잭션이 연달아 `UPDATE` 하면, PostgreSQL 기본 격리 수준(Read Committed)에서 나중에 커밋된 값만 남는 현상이다. 이것만으로는 낙관적 락이 들어간 것이 아니다.
 - 낙관적 락(optimistic locking): 저장 시 `WHERE id=? AND version=?` 처럼 직전에 읽은 버전과 맞을 때만 갱신하고, 이미 다른 사람이 고쳤으면 409 등으로 돌려보내는 설계다. 일반 관리 `UPDATE` 경로에는 없다.
 - 비관적 락에 가까운 선점: `SELECT … FOR UPDATE` 또는 `SKIP LOCKED` 로 한 세션만 행·잡을 가져가 동시 실행을 막는 방식이다.

관리 권한·역할 변경 뒤의 앱 알림·이메일
- 조직 역할(`user_dvsn`)·ETL·사용자 일괄 관리·프로젝트 멤버 권한 변경, 계정 활성·정지, 타부서 프로젝트 초대 안내 메일 등은 업무 DB `commit` 이 끝난 뒤 같은 요청 스레드에서 `admin_server.change_notify` 와 `Backend/mail`(예: `send_plain_notice_email_try`, `send_project_invite_existing_user_email`)를 호출한다.
- `notification_info` 행은 `insert_notification(..., autocommit=True)` 로 바로 확정되는 경우가 많다. SMTP 전송 오류는 try/except 와 로그로만 처리되며, 이미 커밋된 DB 변경이나 API 성공 응답을 되돌리지는 않는다.

1. 동기로 끝나는 것(대부분의 화면 기능)
 - 관리·인증·프로젝트 API: `admin_server`·`auth_server`·`project_server` 라우터가 `psycopg2` 커서로 SQL을 실행하고 같은 스레드에서 응답을 만든다. 트랜잭션·권한 검사를 한 흐름으로 묶기 쉽다.
 - 요청 스코프 DB: `get_system_db` 등으로 연결을 받았다가 요청이 끝나면 풀에 돌려보낸다.
 - 감사 append·대부분의 메일: 동기 호출이며, 메일 실패만 본 요청의 성공과 분리하는 패턴을 쓴다.

2. HTTP와 분리되는 것(장시간·큐가 필요한 부분)
 - ETL 잡 큐·배치: `queue_worker` 와 스레드 풀이 HTTP 밖에서 돌며, `SELECT … FOR UPDATE SKIP LOCKED` 로 동일 잡이 동시에 두 번 실행되지 않게 한다.
 - ETL 스케줄: APScheduler 가 정해진 주기로 깨운다.
 - 쿼리 스튜디오 “쿼리를 테이블로 저장”: 큐에 job 을 넣은 뒤 즉시 반환하고, 별도 워커 스레드가 `CREATE TABLE` 을 수행한다.
 - 코어 DB 풀·`peak_guard`: 짧은 구간만 `threading.Lock` 등으로 보호한다.

3. 두 관리자가 같은 사용자 행을 거의 동시에 저장할 때
 - DB: 낙관적 락이 없으면 둘 다 성공 응답일 수 있어도 최종 값은 나중 커밋(LWW)이다.
 - 감사: `system_log` 등에 요청마다 한 줄씩 남으면 시간 순서로 누가 언제 무엇을 보냈는지 추적할 수 있다. 화면이 자동으로 “당신이 넣은 값은 버려졌습니다”라고 알려 주지는 않는다.
 - 당사자 알림·메일: 성공한 저장마다 발송 로직이 돌면 두 통이 나갈 이론적 가능은 있다.

4. 비슷한 동시 작업을 점검할 때(한 줄 메모)
 - 사용자 일괄 관리·역할 전용 API·프로젝트 멤버 권한: 행 버전 없으면 LWW 에 가깝다.
 - ETL 동일 잡 동시 실행 시도: 선점 한쪽만 진행된다.
 - 로그인·세션: 본 문서 §2.

5. 정책을 더 빡세게 할 때(선택 참고)
 - UI 에서 저장 중 이중 클릭 막기·저장 후 목록 다시 읽기.
 - 필요한 소수의 테이블에만 `version` 컬럼이나 `UPDATE … WHERE version=?` 를 두는 낙관적 락, 또는 `SELECT FOR UPDATE` 를 쓰는 비관적 락.
 - 알림·메일만 메시지 큐로 빼는 것은 재시도·실패 처리 합의 뒤에 검토한다.

---

## 2. `auth_server` — 인증·세션·권한 게이트

로그인·토큰·세션 바인딩·`require_active_access` / `require_permission` / `require_etl_infrastructure` 등 **다른 라우터가 공통으로 거는 게이트**의 기준이다.

### 2.1 로그인·토큰·로그아웃 (프로젝트 선택은 §4)

```
사용자
│
├─ 1. POST /api/auth/login ─────────────────────────────┐
│     { email, password }                                │
│                                                        ▼
│                              ┌──────────────────────────────┐
│                              │  1단계 로그인 (login_send_code) │
│                              │  router → login_send_code     │
│                              │    ├─ user_info 조회          │
│                              │    ├─ verify_password(bcrypt) │
│                              │    ├─ active/lock 확인        │
│                              │    ├─ generate_numeric_code(6)│
│                              │    ├─ hash_otp → DB 저장      │
│                              │    ├─ send_login_code_email   │
│                              │    └─ create_pre_auth_token   │
│                              └──────────────┬───────────────┘
│                                             ▼
│  ◀─── { pre_auth_token, expires_in: 300 } ─┘
│
├─ 2. POST /api/auth/verify-login ──────────────────────┐
│     { pre_auth_token, code }                           │
│                                                        ▼
│                              ┌──────────────────────────────┐
│                              │  2단계 OTP 완료 (verify_login_complete) │
│                              │  verify_login_complete        │
│                              │  ├─ decode_pre_auth_payload   │
│                              │  ├─ verify_otp_code           │
│                              │  ├─ user_active_yn·user_lock_yn │
│                              │  │   재확인 → 불가 시 중단     │
│                              │  ├─ session_log INSERT        │
│                              │  ├─ create_access_token       │
│                              │  ├─ create_refresh_token      │
│                              │  ├─ session_log UPDATE(해시) │
│                              │  └─ insert_login_log(Y)       │
│                              └──────────────┬───────────────┘
│                                             ▼
│  ◀─── { access_token, refresh_token } ─────┘
│
│  (홈에서 프로젝트 카드·JWT에 `project_info_id` 넣기 → §4 `POST …/select`)
│
├─ 3. 보호 API (Bearer access_token) ───────────────────┐
│                                                        ▼
│     ┌────────────────────────────────────────────────────┐
│     │  보호 API 공통 (require_active_access)               │
│     │  대부분: require_active_access                      │
│     │  ├─ JWT(typ=access)·exp·서명 (_parse_bearer…)       │
│     │  ├─ ensure_user_active_not_locked (system_db → 403) │
│     │  └─ 세션 바인딩 (_assert_access_session_bound)     │
│     │      · session_log.access_token_encrypt = SHA256(Bearer원문) │
│     │      · refresh_exprtn_dtm 미만료                   │
│     │                                                      │
│     │  분기:                                               │
│     │  ├─ /api/admin/* → get_authenticated_user_row        │
│     │  │   (동일·비활성·잠금 검사) → org/프로젝트 Depends   │
│     │  ├─ /api/etl*    → require_etl_infrastructure (/batch 포함) │
│     │  └─ 쿼리·대시·위젯 → require_permission("…")          │
│     └────────────────────────────────────────────────────┘
│
├─ 4. POST /api/auth/refresh ────────────────────────────┐
│                                                        ▼
│                              ┌──────────────────────────────┐
│                              │  토큰 갱신 (refresh_session_tokens) │
│                              │  refresh_session_tokens       │
│                              │  ├─ refresh JWT·session_log    │
│                              │  ├─ _fetch_dptmt_id_or_raise_ │
│                              │  │   inactive_locked          │
│                              │  └─ 새 access·refresh +       │
│                              │      session_log UPDATE        │
│                              └──────────────────────────────┘
│
└─ 5. POST /api/auth/logout ───────────────────────────┐
       (Depends: require_access_session_bound — JWT+세션만, 비활성·잠금도 로그아웃 가능) │
                                                        ▼
                               ┌──────────────────────────────┐
                               │  로그아웃 (logout_one_session) │
                               │  session_log.refresh_exprtn_  │
                               │  dtm = NOW()                  │
                               └──────────────────────────────┘
```

---

### 2.2 OTP·세션·토큰 발급 관련 모듈 (`auth_server`)

#### `auth_server/security.py`

| 함수 | 기능 |
|------|------|
| `hash_password` | bcrypt 해시 생성 |
| `verify_password` | bcrypt 해시 검증 |
| `validate_password_strength` | 신규 비밀번호 정책 검증 (10자·대소문자·숫자·특수문자). 가입·변경 시 적용, 로그인 시 기존 약한 비밀번호는 미검사 |
| `hash_otp_code` | OTP SHA-256 해시 |
| `verify_otp_code` | timing-safe OTP 비교 |
| `hash_token` | JWT 문자열 SHA-256 hex |
| `create_pre_auth_token` | 1단계 인증 JWT (5분) |
| `decode_pre_auth_payload` | pre_auth JWT 디코딩 |
| `create_access_token` | access JWT (30분, project 선택) |
| `create_refresh_token` | refresh JWT (7일, project 선택) |
| `decode_token_payload` | JWT 디코딩 + typ 검증 |
| `generate_numeric_code` | 6자리 랜덤 숫자 |

#### `auth_server/schemas.py`

| 클래스 | 기능 |
|--------|------|
| `SignupBody` | 초대 가입 요청 |
| `CreateOrgBody` | 부서+계정 생성 요청 |
| `LoginBody` | 1단계 로그인 요청 |
| `VerifyLoginBody` | 2단계 인증 요청 |
| `RefreshBody` | 토큰 갱신 요청 |
| `MeUpdateBody` | 닉네임 수정 요청 |
| `PasswordChangeBody` | 비밀번호 변경 요청 |

#### `Backend/mail/` (공용 메일 패키지)

| 모듈·함수 | 기능 |
|-----------|------|
| `mail.smtp_transport.send_email` | SMTP 발송 (미설정 시 로그 폴백) |
| `mail.outbound.send_login_code_email` | 2차 인증 코드 메일 |
| `mail.outbound.send_invite_email` | 초대 가입 URL 메일(본문에 초대 부서·조직 역할·ETL·프로젝트 권한 템플릿 선택 반영) |
| `mail.__init__` | 위 함수 재export — `from Backend.mail import send_email` 권장 |

`auth_server/email_service.py`는 **`Backend.mail` 동일 API 재export**만 한다(레거시 `from Backend.auth_server import email_service` 호환).

#### `auth_server/service.py`

| 함수 | 기능 |
|------|------|
| `invite_validate_row` | 초대코드 행 조회 (프로젝트명·역할명 LEFT JOIN 포함) |
| `signup_with_invite` | 초대 기반 가입 (`validate_password_strength` 적용. `invite_target_dvsn`·`invite_etl_yn` 반영. u 역할 + 프로젝트 지정 시 `validate_invite_user_project` → `project_ptcpnt_info` INSERT) |
| `create_org_and_user` | 부서 + sa 생성 |
| `login_send_code` | 1단계 로그인 |
| `_fetch_dptmt_id_or_raise_inactive_locked` | refresh·rotate 경로에서 비활성·잠금 검사 |
| `verify_login_complete` | 2단계 OTP 후 비활성·잠금 재확인, 세션·토큰 발급 |
| `refresh_session_tokens` | 슬라이딩 리프레시 + 비활성·잠금 거절. JWT의 project_info_id가 비활성·비참여면 클레임을 제거하고 토큰 발급 |
| `rotate_session_tokens_clear_project` | JWT·세션에서 project_info_id 클레임을 제거하고 토큰 재발급. `/me` 호출 시 JWT의 프로젝트가 비활성이거나 참여자가 아니면 자동 호출되어 `project_info_id=null`·`permissions=[]` 반환 + 새 토큰 포함 |
| `rotate_session_tokens_with_project` | 프로젝트 선택 — `active_yn=Y`·비활성·잠금 검증 후 토큰 재발급 |
| `logout_one_session` | 세션 만료 |
| `invalidate_all_sessions` | 전체 세션 만료 — `do_commit` 인자 (`suspend` 등에서 `False`로 동일 트랜잭션 commit) |
| `get_user_profile` | 프로필 조회 |
| `update_user_nickname` | 닉네임 변경 |
| `change_password` | 비밀번호 변경 + 세션 무효화 |
| `insert_login_log` | 로그인 기록 |
| `fetch_login_history_masked` | IP 마스킹 이력 |

---

### 2.3 권한 검증 분기 (어드민 vs 프로젝트 기능)

```
(흐름 개요: Depends 체인 — require_access_session_bound / require_active_access / require_* )
HTTP 요청
│
├─ POST /api/auth/logout
│  └─ require_access_session_bound (JWT+세션 바인딩만 — 비활성·잠금 계정도 세션 종료 가능)
│
├─ POST /api/auth/refresh
│  └─ 서비스 레이어에서 session + _fetch_dptmt_id_or_raise_inactive_locked
│
└─ 그 외 대부분의 보호 API
   │
   ▼
   require_active_access
   = JWT 검증 + ensure_user_active_not_locked + _assert_access_session_bound → 401/403
        │
        ├─ /api/admin/*     → get_authenticated_user_row(= Depends(require_active_access) 후 user_dvsn 조회) → 역할·부서·프로젝트 Depends
        │
        ├─ /api/etl*        → require_etl_infrastructure
        │                      (내부적으로 require_active_access)
        │                      + sa_dev | etl_manager | etl_yn=Y (/batch 포함)
        │
        └─ 프로젝트 기능 라우트 → require_permission("dashboard" 등)
                                 (내부적으로 require_active_access)
                                 + compute_effective_project_permission_ids
                                   (활성 프로젝트 · pmssn_list ∩ feature_flags)
```

#### 2.3.1 액세스 JWT·세션 바인딩·`require_active_access`

리프레시로 access가 회전된 뒤에도 **이전 access JWT**가 만료 전이면 API가 열리는 문제를 막기 위해, 보호 API는 **Bearer 원문**을 SHA-256 hex 한 뒤 **`session_log.access_token_encrypt`** 와 비교한다(`security.hash_token` 과 동일 알고리즘). 또 **`refresh_exprtn_dtm`** 이 지난 세션은 401으로 거절한다.

```
_parse_bearer_access_token
  → JWT(typ=access)·exp·서명 검증 → (원문 토큰, payload)

_assert_access_session_bound(conn, token, payload)
  → session_log_id·user_id로 session_log 행 조회
  → refresh_exprtn_dtm 경과 시 401
  → access_token_encrypt == SHA256(token 원문) 아니면 401

ensure_user_active_not_locked
  → system_db user_info: user_active_yn=Y, user_lock_yn≠Y 아니면 403

require_access_session_bound
  = parse + _assert_access_session_bound (비활성·잠금 검사 없음 — 로그아웃용)

require_active_access
  = parse + ensure_user_active_not_locked + _assert_access_session_bound

get_access_payload
  → JWT만 검증(세션 미검증). 보호 라우터 Depends에는 **사용하지 않음**(진단·내부 참고).

적용 예:
┌──────────────────────────────────────────────────┐
│  활성·미잠금 + 세션 바인딩 (require_active_access)  │
│  ├─ GET/PATCH /api/auth/me                        │
│  ├─ PATCH /api/auth/me/password                   │
│  ├─ GET /api/auth/me/login-history                │
│  ├─ require_permission (쿼리·대시보드·위젯)       │
│  ├─ require_etl_infrastructure (/api/etl*, /batch 포함) │
│  ├─ admin_server get_authenticated_user_row       │
│  │   (payload = Depends(require_active_access))   │
│  └─ project·notification 등 동일 패턴              │
└──────────────────────────────────────────────────┘

require_access_session_bound 만
└─ POST /api/auth/logout (비활성·잠금도 세션 종료 허용)

POST /api/auth/refresh
└─ 엔드포인트 Depends는 별도·본문에서 session + 비활성·잠금 검사
```

#### 2.3.2 `require_permission`과 `project.feature_flags`

```
require_permission("dashboard") 등
│
▼
┌──────────────────────────────────────────────────┐
│  프로젝트 기능 권한 (compute_effective_project_permission_ids) │
│  compute_effective_project_permission_ids         │
│                                                    │
│  ① is_project_active?                             │
│     NO → 빈 집합 → 403 (비활성화된 프로젝트)       │
│                                                    │
│  ② get_project_enabled_feature_ids                │
│     project_info.feature_flags JSONB              │
│     { query, dash, widget } → 허용 권한 ID 집합    │
│     (NULL/미설정 → 전 기능 허용으로 취급)          │
│                                                    │
│  ③ get_permission_ids_for_user_project            │
│     pmssn_list 기반 권한 ID 집합                    │
│                                                    │
│  ④ 유효 권한 = ③ ∩ ②                              │
│                                                    │
│  ⑤ 요청 키("dashboard" 등) ∈ ④ ?                 │
│     NO → 403 (이 프로젝트에서 사용할 수 없는 기능)  │
└──────────────────────────────────────────────────┘

`sa_dev`·`sa`·`a`·`o`·`u` 구분 없이 동일 규칙(②③④)으로 유효 권한을 계산한다.
조직 역할(`user_dvsn`)은 프로젝트 UI 권한을 **늘리지 않는다**(어드민·ETL은 각각 별도 가드).
```

#### 2.3.3 리프레시·만료·슬라이딩·프로젝트 select

**기본값** (`core/auth_config.py`): `get_jwt_access_expire_minutes()` → 30분, `get_jwt_refresh_expire_days()` → 7일.

```
N일·슬라이딩 의미 (create_refresh_token · session_log UPDATE)
│
▼
┌──────────────────────────────────────────────────┐
│  발급 시각 + N일 (`get_jwt_refresh_expire_days`)   │
│  ├─ refresh JWT 의 exp                           │
│  └─ session_log.refresh_exprtn_dtm (동일 만료 시각) │
└──────────────────────┬───────────────────────────┘
                       ▼
              POST /api/auth/refresh 성공할 때마다
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│  JWT exp 와 refresh_exprtn_dtm 을 둘 다 다시 N일 뒤로 │
│  (슬라이딩 — refresh_session_tokens 내 UPDATE)    │
└──────────────────────────────────────────────────┘

※ “7일 미사용” = 브라우저 on/off 가 아니라, N일 안에 유효한 갱신이 없어
   JWT·DB 만료가 함께 도래한 경우. (갱신 API 미호출 = 시간만 흐름)
```

```
POST /api/auth/refresh (refresh_session_tokens)
│
▼
┌──────────────────────────────────────────────────┐
│  decode_token_payload(refresh, "refresh")        │
│  (security — 서명·typ·exp 등)                    │
└──────────────────────┬───────────────────────────┘
                       │ 실패(PyJWTError 래핑)
                       ▼
                  ValueError
                  "유효하지 않은 refresh 토큰입니다."
                       │ 성공
                       ▼
┌──────────────────────────────────────────────────┐
│  session_log 행 존재 · session_create_user_id     │
│    = JWT user_id ?                                │
└──────────────────────┬───────────────────────────┘
                       │ 아니오
                       ▼
                  "세션을 찾을 수 없습니다."
                       │ 예
                       ▼
┌──────────────────────────────────────────────────┐
│  refresh_exprtn_dtm 있음 · now 이전 아님 ?        │
└──────────────────────┬───────────────────────────┘
                       │ 만료/NULL
                       ▼
                  "세션이 만료되었습니다. 다시 로그인하세요."
                       │ 유효
                       ▼
┌──────────────────────────────────────────────────┐
│  hash(refresh 문자열) = refresh_token_encrypt ?   │
└──────────────────────┬───────────────────────────┘
                       │ 불일치
                       ▼
                  "세션이 무효화되었습니다."
                       │ 일치
                       ▼
┌──────────────────────────────────────────────────┐
│  _fetch_dptmt_id_or_raise_inactive_locked        │
│  (user 없음 / 비활성 / 잠금 → 각 ValueError)       │
└──────────────────────┬───────────────────────────┘
                       │ 통과
                       ▼
┌──────────────────────────────────────────────────┐
│  project_info_id 클레임 유효성 (refresh 경로)     │
│  JWT에 project_info_id가 있으면:                  │
│  ├─ is_project_active? NO → 클레임 제거(None)     │
│  └─ is_project_participant? NO → 클레임 제거(None)│
│  → 이후 토큰 발급 시 proj_claim 반영              │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  create_access_token · create_refresh_token       │
│  session_log UPDATE (해시·access/refresh 만료)     │
└──────────────────────────────────────────────────┘
```

```
보호 API (require_active_access → _assert_access_session_bound)
│
▼
┌──────────────────────────────────────────────────┐
│  refresh_exprtn_dtm < now ?                      │
└──────────────────────┬───────────────────────────┘
                       │ 예 (로그아웃으로 NOW() 찍힌 경우 포함)
                       ▼
                  401 — 액세스 JWT exp 가 남아 있어도 거절 가능
```

```
즉시 끊김 — N일과 무관 (refresh_exprtn_dtm = NOW() 등)
│
├─ 로그아웃 (logout_one_session) — 해당 세션만
├─ 비밀번호 변경 (change_password → invalidate_all_sessions)
├─ 어드민 정지 (suspend_user → invalidate_all_sessions)
└─ 비활성 사용자 삭제 (delete_inactive_user → invalidate_all_sessions …)
```

```
POST /api/projects/{id}/select (rotate_session_tokens_with_project)
│
▼
┌──────────────────────────────────────────────────┐
│  작업 프로젝트 전환 (rotate_session_tokens_with_project) │
│  ├─ is_project_active (active_yn=Y)              │
│  ├─ _fetch_dptmt_id_or_raise_inactive_locked      │
│  └─ 멤버십·세션 검증 후 토큰 재발급               │
└──────────────────────────────────────────────────┘
```

#### 2.3.4 정지 (`suspend`)와 세션 무효

```
PATCH /api/admin/users/{id}/suspend
│
▼
┌──────────────────────────────────────────────────┐
│  사용자 정지 (suspend_user)                        │
│  suspend_user                                     │
│  ├─ ownership_guards (409 가능)                   │
│  ├─ user_active_yn = 'N'                          │
│  ├─ invalidate_all_sessions(do_commit=False)      │
│  │   → session_log.refresh_exprtn_dtm = NOW()     │
│  │   (호출부 트랜잭션에서 단일 commit)             │
│  └─ commit                                        │
└──────────────────────────────────────────────────┘

결과: 정지 직후 refresh 실패·require_active_access 403
```

---

### 2.4 JWT·Depends·엔드포인트 (`auth_server`)

#### `auth_server/deps.py`

| 함수 | 기능 |
|------|------|
| `_parse_bearer_access_token` | Authorization 헤더 → `(원문 토큰, JWT payload)`. typ=access·exp·서명 검증 |
| `_hash_access_token_raw` | Bearer 원문 → SHA-256 hex (`security.hash_token`과 동일, 순환 import 회피) |
| `get_access_payload` | JWT만 검증(세션 미검증). 보호 API Depends에는 **사용하지 않음**(진단·내부 참고) |
| `ensure_user_active_not_locked` | `system_db`에서 `user_active_yn`·`user_lock_yn` 검사 → 비활성·잠금 시 403 |
| `_assert_access_session_bound` | `session_log`에서 `access_token_encrypt` SHA-256 비교 + `refresh_exprtn_dtm` 미만료 확인 |
| `require_access_session_bound` | JWT + 세션 바인딩만 검사 (비활성·잠금 계정도 세션 종료 가능) — **로그아웃 전용** |
| `require_active_access` | `_parse_bearer_access_token` → `ensure_user_active_not_locked` → `_assert_access_session_bound` — **대부분 보호 API** |

#### `auth_server/permissions.py`

| 함수 | 기능 |
|------|------|
| `get_user_dvsn_lower` | `user_id` → `user_dvsn` 소문자 |
| `user_has_etl_infrastructure_access` | `sa_dev`·원문 `etl_manager`·또는 `etl_yn=Y` |
| `is_project_participant` | `project_ptcpnt_info` 존재 여부 |
| `is_project_active` | `project_info.active_yn == Y` 확인 |
| `resolve_pmssn_list_to_names` | pmssn_list 배열 → `pmssn_master_detail.pmssn_detail_name` 목록으로 정규화 |
| `get_permission_ids_for_user_project` | 유저·프로젝트별 권한 ID 목록 (`project_ptcpnt_info` → `pmssn_master.pmssn_list` → 정규화) |
| `_feature_flags_dict_to_ids` | `{query, dash, widget}` → 권한 ID `frozenset` (`query→query.read+query.execute`, `dash→dashboard`, `widget→widgetboard`) |
| `get_project_enabled_feature_ids` | `project_info.feature_flags` JSONB → 허용 권한 ID 집합 (NULL·컬럼 없음 → 전체 허용) |
| `compute_effective_project_permission_ids` | `pmssn_list`(정규화) ∩ `feature_flags` 허용 ID. 비활성 프로젝트 → 빈 집합. `user_dvsn` 인자는 시그니처 유지용이며 권한 확장 없음 |
| `get_effective_permission_ids_for_me` | `/me`용 — `compute_effective_project_permission_ids` 호출 |
| `require_etl_infrastructure` | `require_active_access` 후 `user_has_etl_infrastructure_access(conn, user_id)` 검사, 미충족 시 403. **`main.py`** 에서 `etl_router` 전체에 `dependencies=[Depends(require_etl_infrastructure)]` 로 일괄 적용. 상세 **[§7.5](#75-security-and-limits)** |
| `require_permission` | FastAPI Depends 팩토리 — `require_active_access` + `compute` + 비활성·기능 off 시 403 분기. 필요 권한 AND 조건 |

#### `auth_server/router.py`

| 엔드포인트 | 기능 |
|------------|------|
| `POST /api/auth/signup` | 초대코드 기반 가입 (`validate_password_strength` 적용. u 역할 + 프로젝트·역할 지정 초대 시 `project_ptcpnt_info` 자동 등록) |
| `POST /api/auth/create-org` | 부서 + sa 생성 (SPA `/create-org` 없음·DB 시드 또는 운영 도구 호출) |
| `POST /api/auth/login` | 1단계 로그인 |
| `POST /api/auth/verify-login` | 2단계 OTP 검증 |
| `POST /api/auth/refresh` | 토큰 리프레시 (서비스에서 비활성·잠금·비활성 프로젝트 검사. project_info_id 비활성·비참여 시 클레임 제거) |
| `POST /api/auth/logout` | 세션 만료 (`require_access_session_bound` — 비활성·잠금도 로그아웃 가능) |
| `GET /api/auth/me` | 프로필+권한. JWT의 project_info_id가 비활성·비참여 시 `rotate_session_tokens_clear_project`로 토큰 재발급·`project_info_id=null`·`permissions=[]` 반환 (`require_active_access`) |
| `PATCH /api/auth/me` | 닉네임 (`require_active_access`) |
| `PATCH /api/auth/me/password` | 비밀번호 (`require_active_access`) |
| `GET /api/auth/me/login-history` | 로그인 이력 (`require_active_access`) |
| `GET /api/auth/invite/validate` | 초대코드 유효성 |

---

## 3. `admin_server` — 조직·프로젝트 관리

부서·사용자·역할·프로젝트·테이블 매핑·초대 등 **조직 단위 관리 API**다.

### 3.0 연계 한눈에

```
[사용자 초대 ~ 프로젝트 업무까지]

조직 관리자(sa_dev·sa·a) 로그인
│
├─ 1. 사용자 초대 → POST /api/admin/users/invite → invite_user_by_email …
├─ 2. 가입 → POST /api/auth/signup → signup_with_invite …
├─ 3. 프로젝트 생성 → POST /api/admin/projects → create_project_full
│        (단일 트랜잭션: project_info + 생성자 pmssn + 매핑(채널 플래그 또는 table_master_ids 호환·main만)
│         + 부서 내 멤버 + 타부서 알림)
├─ 4. 이후 매핑/멤버 → POST …/projects/{id}/tables | …/members (add_member 분기)
├─ 5. 타부서 초대 수락 → POST /api/projects/{id}/accept-invite (project_server)
└─ 6. 프로젝트 카드 선택 → POST /api/projects/{id}/select → require_permission 업무 API
```

프로젝트 생성·멤버·소유 가드·이관·purge·부서 비활성 등 **세부 단계**는 아래 **§3.1** 을 본다.

---

### 3.1 상세 동작 흐름

#### A. 프로젝트 생성 전체 흐름 (`create_project_full`)

```
POST /api/admin/projects
│
▼
┌──────────────────────────────────────────────────┐
│  조직 관리자만 (require_org_admin)                 │
│  Depends: require_org_admin (sa_dev·sa·a)         │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  프로젝트 생성 트랜잭션 (create_project_full)       │
│                                                    │
│  ① project_info INSERT                             │
│     (name, dscrtn, dptmt, creator, feature_flags)  │
│                                                    │
│  ② 생성자 역할 검증 + 멤버 등록                    │
│     _assert_pmssn_for_project(creator_pmssn)       │
│     project_ptcpnt_info INSERT (생성자)             │
│     ※ 시스템 기본 자동 배정 없음                    │
│                                                    │
│  ③ 테이블 매핑                                      │
│     table_mappings 전달 시:                          │
│       _sync_project_table_mappings_with_usage        │
│       (table_master_id별 use_query_studio_yn·        │
│        use_widgetboard_yn 개별 설정, main만 허용,    │
│        둘 다 N이면 해당 행 미매핑)                    │
│     table_mappings 미전달 시 (table_master_ids 호환): │
│       table_master_ids 각각 검증 + INSERT            │
│       (양 채널 모두 Y)                               │
│                                                    │
│  ④ 부서 내 멤버 (members[])                         │
│     각각:                                           │
│     ├─ _assert_target_not_hidden_system_dev_member  │
│     ├─ _user_in_actor_dept_scope 확인               │
│     ├─ _assert_pmssn_for_project                    │
│     ├─ project_ptcpnt_info INSERT                   │
│     └─ _notify_project_member_added_pair            │
│        (피추가자·실행자 각각 알림)                   │
│                                                    │
│  ⑤ 타부서 초대 (external_invites[])                 │
│     각각:                                           │
│     ├─ 같은 트리 소속이면 → 거부 (members로)        │
│     ├─ 개발 부서(0) 소속 제한 확인                  │
│     ├─ _assert_pmssn_for_project                    │
│     └─ notification_info INSERT                     │
│        (noti_type=project_invite, JSON payload:     │
│         project_info_id, pmssn_master_id,           │
│         invite_user_id, invite_expires_at 7일)      │
│                                                    │
│  ⑥ COMMIT                                           │
│                                                    │
│  응답: { project_info_id, members_added,            │
│          invites_sent }                             │
└──────────────────────────────────────────────────┘
```

#### B. 타부서 초대 수락·거절

API·단계별 처리는 **§4.2** (`project_server` — `accept_project_invite` / `reject_project_invite`) 와 동일하다.

#### C. 멤버 추가 분기 (`add_member`)

```
POST /api/admin/projects/{id}/members
│
▼
┌──────────────────────────────────────────────────┐
│  멤버 추가 (add_member)                             │
│  ├─ 프로젝트 소유·pmssn 검증                       │
│  ├─ 본인 추가 불가                                  │
│  ├─ 이미 멤버 확인                                  │
│  ├─ 이미 초대 대기 중 확인                          │
│  │   pending_project_invite_exists_for_user_project  │
│  │   → 이미 대기 중이면 ValueError                  │
│  │                                                  │
│  ├─ _user_in_actor_dept_scope?                      │
│  │   │                                              │
│  │   ├─ YES (부서 트리 소속)                        │
│  │   │   ├─ project_ptcpnt_info INSERT (즉시)       │
│  │   │   ├─ _notify_project_member_added_pair       │
│  │   │   └─ 응답: { outcome: "member_added" }      │
│  │   │                                              │
│  │   └─ NO (타부서)                                 │
│  │       ├─ 개발 부서(0) 소속 제한 확인              │
│  │       ├─ notification_info INSERT                 │
│  │       │   (project_invite JSON, 7일 만료)        │
│  │       └─ 응답: { outcome: "invite_sent" }        │
│  │                                                  │
└──────────────────────────────────────────────────┘
```

#### D. 사용자 정지·삭제 흐름 (`ownership_guards` 연동)

```
PATCH /api/admin/users/{id}/suspend  또는  DELETE /api/admin/users/{id}
│
▼
┌──────────────────────────────────────────────────┐
│  ①② 사전 검증 (라우터·권한)                         │
│  ① 대상 존재 + 부서 트리 검증                      │
│  ② 역할 제한 검증 (a→o·u만, sa→a·o·u만 등)       │
│                                                    │
│  ③ 소유 평가·정지 모드 (_evaluate_ownership_target_or_raise) │
│     (for_suspend=True)                             │
│     │                                              │
│     ├─ system 메타 소유 스캔 (_collect_system_owned_for_guard) │
│     │   ├─ 생성 프로젝트 (project_create_user_id) │
│     │   ├─ 커스텀 pmssn (user_id)                  │
│     │   ├─ table_master (create_user_id)           │
│     │   ├─ 등록 부서 (dptmt_create_user_id)        │
│     │   ├─ 초대자 참여 행 (invite_user_id≠자기)    │
│     │   └─ 위젯 보드 (widget_board.owner_user_id)  │
│     │                                              │
│     ├─ ETL 자산 스캔 (_collect_etl_flat_for_guard) │
│     │   (etl_db에서 create_user_id 기준 스캔)      │
│     │                                              │
│     └─ 409 페이로드·차단 여부 (build_ownership_violation_payload) │
│        ├─ for_suspend=True → 모든 소유 blocking    │
│        ├─ project_invite_rows도 blocking에 포함     │
│        │                                            │
│        ├─ changeable=false → ManagementBlockedError │
│        │   → 409 응답                               │
│        │   { changeable, message,                   │
│        │     blocking_assets, allowed_assets,       │
│        │     target }                               │
│        │                                            │
│        └─ changeable=true → 계속 진행               │
│                                                    │
│  ④ 정지·삭제 실행 (suspend_user / delete_inactive_user) │
│     suspend: user_active_yn='N' + 세션 무효          │
│     delete: 연관 행 정리 + user_info DELETE          │
└──────────────────────────────────────────────────┘
```

#### E. 사용자 일괄 변경 흐름 (`update_user_management`)

```
PUT /api/admin/users/{id}/management
body: { dptmt_info_id?, user_dvsn?, etl_yn?, project_assignments? }
│
▼
┌──────────────────────────────────────────────────┐
│  일괄 변경 (update_user_management)                 │
│  ① 대상 존재 + 역할 관리 가능 검증                 │
│                                                    │
│  ② 목표 상태 결정                                   │
│     eff_dvsn = user_dvsn ?? 현재값                  │
│     eff_etl = etl_yn ?? 현재값                      │
│     u로 변경 시 → eff_etl = 'N' 강제               │
│                                                    │
│  ③ _evaluate_ownership_target_or_raise              │
│     (for_suspend=False)                             │
│     목표 역할·ETL로 유지 불가한 소유 → 409          │
│     예: a→u 변경인데 프로젝트 생성자 있음           │
│         → blocking_assets에 project 표시            │
│                                                    │
│  ④ 부서 변경 (허용 트리 내)                         │
│  ⑤ 역할 변경 (u면 etl_yn='N' 자동)                 │
│  ⑥ ETL 자격 변경 (sa·sa_dev만, N 시 등록 건 검사)  │
│  ⑦ 프로젝트 참여 변경                               │
│     ├─ 추가: 부서 확인 + pmssn 정합                 │
│     ├─ 변경: pmssn UPDATE                           │
│     └─ 제거: DELETE                                  │
│                                                    │
│  ⑧ COMMIT                                           │
└──────────────────────────────────────────────────┘
```

#### F. 이관 흐름 — 테이블 마스터 + ETL 연쇄

```
POST /api/admin/users/transfer-ownership
{ resource_type: "table_master", resource_id, from, to }
│
▼
┌──────────────────────────────────────────────────┐
│  소유 이관 (transfer_resource_ownership)           │
│  ├─ from·to 존재·부서 검증                         │
│  ├─ table_master 소유자 확인                        │
│  ├─ _table_master_recipient_eligible               │
│  │   ├─ sa_dev → 항상 OK                           │
│  │   ├─ 미매핑 → 수직 트리(상·하위) sa·a만          │
│  │   └─ 매핑 → (수직 트리 sa·a) 또는               │
│  │            (매핑 프로젝트 참여 + query.execute)   │
│  │                                                  │
│  ├─ table_master.create_user_id UPDATE              │
│  │                                                  │
│  └─ _cascade_transfer_etl_for_table_master          │
│     (etl_db에서 동일 target_table의                 │
│      etl_tables·etl_jobs·batch_jobs                 │
│      create_user_id도 함께 이관)                    │
└──────────────────────────────────────────────────┘
```

#### G. 이관 후보 검색 범위 (수직 트리 branch CTE)

```
이관 후보는 동일 부서 PK만이 아니라, 수직 브랜치(상위·하위)를 CTE로 묶는다.

예) 부서 트리:
    본사(1)
    ├── 마케팅(2)
    │   └── 디지털마케팅(3)  ← from_user 소속
    └── 영업(4)

이관 후보 검색 범위:
┌──────────────────────────────────┐
│  수직 부서 트리 (WITH RECURSIVE)   │
│  WITH RECURSIVE                   │
│  down: 3 → 하위 전부              │
│  up: 3 → 2 → 1 (조상까지)        │
│  branch = down ∪ up               │
│                                    │
│  결과: {1, 2, 3} (수직 라인)      │
│  제외: {4} (형제 부서)             │
└──────────────────────────────────┘
```

#### H. 부서 비활성화 + 사용자 이관

```
PATCH /api/admin/org/departments/{id}
body: { use_yn: "N", migrate_users_to_dptmt_info_id: 2 }
│
▼
┌──────────────────────────────────────────────────┐
│  부서 비활성·이관 (_assert_actor_can_manage_department ~) │
│  ① _assert_actor_can_manage_department              │
│     (sa_dev 통과 / sa는 본인 부서 불가)            │
│                                                    │
│  ② migrate_users_to_dptmt_info_id 지정됨            │
│     └─ _migrate_users_for_department_invalidate     │
│        ├─ 이관 대상 부서 존재 + use_yn=Y 확인      │
│        ├─ assert_invite_dptmt_allowed              │
│        └─ UPDATE user_info SET dptmt_info_id       │
│           WHERE dptmt_info_id = source              │
│                                                    │
│  ③ _assert_department_clear_for_invalidate          │
│     (이관 후 소속 사용자 0이어야 통과)              │
│     ├─ 하위 부서 있음 → 거부                       │
│     ├─ 소속 사용자 있음 → 거부 (이관 안 했으면)    │
│     ├─ 초대 코드 있음 → 거부                       │
│     ├─ 소속 프로젝트 있음 → 거부                   │
│     └─ 부서 전용 pmssn_master 있음 → 거부          │
│                                                    │
│  ④ dptmt_info UPDATE (use_yn='N')                   │
└──────────────────────────────────────────────────┘
```

#### I-pre. 프로젝트 물리 삭제 미리보기 (`get_inactive_project_purge_preview`)

```
GET /api/admin/projects/{id}/purge-preview
│
▼
┌──────────────────────────────────────────────────┐
│  비활성 프로젝트 purge 미리보기                     │
│  ├─ active_yn = 'Y' → 거부                        │
│  ├─ 소속 부서 검증                                  │
│  └─ widget_board 목록 + widget_item·share 건수     │
│     응답: { project_info_id, project_name,          │
│             widget_boards: [...],                   │
│             totals: { widget_boards, widget_item_   │
│                       rows, widget_board_share_rows │
│             } }                                     │
└──────────────────────────────────────────────────┘
```

#### I. 프로젝트 물리 삭제 (`purge`)

```
DELETE /api/admin/projects/{id}/purge
│
▼
┌──────────────────────────────────────────────────┐
│  비활성 프로젝트 물리 삭제 (purge_inactive_project) │
│  ├─ active_yn = 'Y' → 거부 (먼저 비활성화)       │
│                                                    │
│  정리 순서 (단일 트랜잭션):                         │
│  ① notification_info DELETE                         │
│     (noti_type=project_invite, JSON의 pid 일치)    │
│  ② user_info.invite_project_info_id = NULL          │
│     (확장 컬럼 없으면 SAVEPOINT 스킵)              │
│  ③ email_invite_code_master.invite_project = NULL   │
│  ④ 위젯보드 연쇄 삭제:                             │
│     ├─ widget_board_invite 알림 삭제               │
│     ├─ widget_item DELETE (보드별)                  │
│     ├─ widget_board_share DELETE (보드별)           │
│     └─ widget_board DELETE                          │
│  ⑤ table_project_mapping DELETE                     │
│  ⑥ project_ptcpnt_info DELETE                       │
│  ⑦ project_info DELETE                              │
│                                                    │
│  FK 위반 시 → 안내 에러                             │
└──────────────────────────────────────────────────┘
```

#### J. 멤버 목록 응답 구조

```
GET /api/admin/projects/{id}/members
│
▼
┌──────────────────────────────────────────────────┐
│  멤버·초대 목록 (list_members)                      │
│                                                    │
│  ① 확정 멤버 (project_ptcpnt_info)                  │
│     items: [{                                       │
│       ptcpnt_user_id, user_email, role_name,        │
│       invite_user_id, invite_user_email,            │
│       membership_status: "active"                   │
│     }]                                              │
│                                                    │
│  ② 대기 중 초대 (notification_info 파싱)             │
│     _list_pending_project_invites                   │
│     pending_invites: [{                             │
│       notification_info_id, ptcpnt_user_id,         │
│       pmssn_master_id, role_name,                   │
│       invite_user_id, invite_user_email,            │
│       invite_expires_at, invite_expired,            │
│       membership_status: "pending_invite"           │
│     }]                                              │
│                                                    │
│  응답: { items, pending_invites }                   │
└──────────────────────────────────────────────────┘
```

---

### 3.2 사용자 정지·이관 (개요)

```
관리자: 사용자 정지 시도
│
├─ 1. 자산 조회 (get_user_work_assets)
│     GET /api/admin/users/{id}/work-assets
│     │
│     ▼
│     get_user_work_assets
│     ├─ system_db 조회:
│     │   ├─ 생성 프로젝트 (project_info)
│     │   ├─ 커스텀 역할 (pmssn_master)
│     │   └─ 테이블 마스터 (table_master)
│     └─ etl_db 조회:
│         ├─ etl_connections
│         ├─ etl_tables / etl_jobs
│         ├─ etl_storage_connections
│         └─ batch_folder_connections / batch_jobs
│
├─ 2. 이관 (transfer_resource_ownership)
│     자산이 있으면 → 이관 먼저
│     │
│     ├─ GET /api/admin/users/ownership-transfer-targets
│     │   → 수직 부서 트리·역할에 맞는 후보 목록
│     │
│     └─ POST /api/admin/users/transfer-ownership
│        { resource_type, resource_id, from, to }
│        │
│        ▼
│        transfer_resource_ownership
│        ├─ project → project_create_user_id UPDATE
│        ├─ pmssn_master → user_id UPDATE
│        ├─ table_master → create_user_id UPDATE
│        ├─ widget_board → owner_user_id UPDATE
│        │   + widget_item.create_user_id UPDATE
│        ├─ dptmt_creator → dptmt_create_user_id UPDATE
│        └─ etl_* → ETL `create_user_id` UPDATE
│
└─ 3. 정지 (suspend_user)
      이관 완료 후 정지
      PATCH /api/admin/users/{id}/suspend
      │
      ▼
      suspend_user
      ├─ ownership_guards (409)
      ├─ user_active_yn = 'N'
      └─ invalidate_all_sessions(do_commit=False) → 단일 commit
```

> **보강**: 409·`blocking_assets`·일괄 변경은 **§3.1 D·E** 와 `ownership_guards.py` 를 본다. 정지 직후 세션 무효는 **§2.3.4** 와 맞춘다.

---

### 3.3 `admin_server` 모듈 (`deps` ~ `router`)

#### `admin_server/deps.py`

| 함수 | 기능 |
|------|------|
| `get_authenticated_user_row` | JWT → `user_id`·`user_dvsn`·`dptmt_info_id` + 비활성·잠금 거부(403) |
| `require_org_admin` | `sa_dev`·`sa`·`a`만 통과 |
| `require_super_admin` | `sa_dev`·`sa`만 통과 |
| `require_org_admin_or_operator` | 위 + `o` 통과 |
| `require_project_admin_or_operator_participant` | org 관리자(a/sa/sa_dev)는 소속 부서 소유 프로젝트만; o는 소속 부서 소유이거나 타부서라면 참여자일 때만 |

#### `admin_server/schemas.py`

| 클래스 | 기능 |
|--------|------|
| `InviteBody` | 초대 (이메일·부서·역할·ETL·프로젝트) |
| `UserRoleBody` / `UserEtlYnBody` | 역할 변경 / ETL 자격 변경 |
| `ProjectFeatureFlags` | 프로젝트 기능 on/off (`query`·`dash`·`widget`) |
| `ProjectMemberAssignBody` | 멤버 지정 (`user_id` + `pmssn_master_id`) |
| `TableMappingEntry` | 프로젝트별 table_master 매핑 — `use_query_studio`·`use_widgetboard` 독립 설정 |
| `ProjectAssignmentBody` | 프로젝트 참여 지정 (`project_info_id` + `pmssn_master_id`) |
| `ProjectCreateBody` | 프로젝트 생성 (이름·설명·`feature_flags`·`table_mappings`(채널 플래그) 또는 `table_master_ids`(호환 본문)·`creator_pmssn`·`members`·`external_invites`) |
| `ProjectUpdateBody` | 프로젝트 수정 (이름·설명·`active`·`feature_flags`·`table_mappings`(우선) 또는 `table_master_ids`) |
| `AcceptProjectInviteBody` | 초대 수락/거절 (`notification_info_id`) |
| `MemberAddBody` / `MemberRoleBody` | 멤버 추가 / 역할 변경 |
| `RoleCreateBody` / `RoleUpdateBody` | 커스텀 역할 생성·수정 |
| `OrgPatchBody` | 부서명 수정 |
| `OrgDepartmentCreateBody` / `PatchBody` | 부서 생성·수정 (`migrate_users_to` 포함) |
| `TableMasterPatchBody` / `ProjectTableAddBody` | 테이블 마스터 수정 / 매핑 추가 |
| `TransferOwnershipBody` | 자산 이관 (`project`·`project_invite`·`pmssn_master`·`table_master`·`dptmt_creator`·`widget_board` 또는 etl_db 메타) |
| `UserManageUpdateBody` | 사용자 일괄 변경 (부서·역할·ETL·프로젝트) |

#### `admin_server/ownership_guards.py`

| 함수/클래스 | 기능 |
|-------------|------|
| `can_own_after_change` | 리소스 논리 타입(`project`·`pmssn_master`·`table_master`·`etl_meta`·`dptmt_creator`·`widget_board`)·목표 역할·목표 etl_yn 기준 소유 가능 여부 매트릭스 |
| `_reason_for_block` | 차단 사유 메시지 생성 |
| `ManagementBlockedError` | 409 응답용 예외 (payload dict) |
| `build_ownership_violation_payload` | 스캔 결과(projects·pmssn·table_masters·departments·etl_items·project_invite_rows·widget_boards) → `changeable`·`blocking_assets`·`allowed_assets` 구조화. `for_suspend=True` 시 `project_invite_rows`·`widget_boards`도 blocking에 포함 |

#### `admin_server/service_users.py`

| 함수 | 기능 |
|------|------|
| `list_users_same_dept` | 동일 부서 유저 목록 |
| `list_users_for_admin_ui` | 관리 UI용 (`sa_dev` 전역, 그 외 트리·정렬) |
| `list_users_dept_tree_for_project_create` | 프로젝트 생성 모달용 (본인 제외·부서 트리) |
| `search_users_by_email` | 이메일 검색 (`exclude_dptmt_zero` 옵션) |
| `invite_user_by_email` | 초대 (역할·부서 트리·ETL·U+프로젝트, 초대 메일에 부서·역할·프로젝트 권한 명시, UndefinedColumn 시 DDL 안내) |
| `assert_invite_dptmt_allowed` | 초대 부서 트리 검증 |
| `list_departments_for_invite` | 초대 모달용 부서 목록 (`display_label`) |
| `suspend_user` | 정지 (`ownership_guards` 409 + 세션 무효) |
| `activate_user` | 활성 |
| `delete_inactive_user` | 비활성만 삭제 (409 소유 가드 + 세션 무효 + 알림·참여·초대·로그인 이력 정리 후 user_info DELETE) |
| `set_user_dvsn_admin_user` | 조직 역할 변경 |
| `set_user_etl_flag` | ETL 자격 (`N` 시 등록 건 검사) |
| `list_invite_codes_for_dept` | 초대코드 목록 |
| `get_department` / `update_department_name` | 부서 조회·이름 수정 |
| `list_departments_for_org_settings` | 부서 관리 목록 (`member_count`·`creator_email`·`display_label`) |
| `create_department` | 부서 추가 (`sa`는 하위만) |
| `update_department_in_org_settings` | 부서 수정 (`migrate_users` + 참조 검사) |
| `delete_department_in_org_settings` | 부서 삭제 (참조 검사) |
| `get_user_work_assets` | 자산 조회 (생성·참여·초대자 프로젝트 참여, 커스텀 역할, 등록 부서, table_master + ETL 연쇄 안내, 위젯 보드 소유) |
| `list_ownership_transfer_targets` | 이관 후보 (수직 트리 branch CTE) |
| `list_department_creator_transfer_targets` | 부서 생성자 이관 후보 (수직 트리 내 `sa`·`sa_dev`만, Admin 제외) |
| `list_table_master_transfer_targets` | 테이블 마스터 이관 후보 (수직 트리 SA/A + 매핑 프로젝트 참여자 query.execute + sa_dev) |
| `transfer_resource_ownership` | 이관 실행 (`project`·`project_invite`·`pmssn_master`·`table_master`(ETL 연쇄)·`dptmt_creator`·`widget_board`·ETL 메타 포함) |
| `get_user_change_options` | 변경 옵션 (`user_dvsn_options`·`projects[].pmssn_options`·`can_manage_etl_yn`·마지막 SA 경고·`projects[].project_department_display`(상위(자기)) 포함) |
| `update_user_management` | 일괄 변경 (부서·역할·ETL·프로젝트 참여. `ownership_guards` 409. `u` 시 `etl_yn` N 강제. `project_assignments`로 역할별 개별 지정 가능) |

#### `admin_server/service_roles.py`

| 함수 | 기능 |
|------|------|
| `list_roles_for_dept` | 시스템 기본 + 부서 커스텀 (`creator_email`·`usage_count`) |
| `list_permission_options_for_dept` | 부여 가능 권한 키 목록 |
| `list_role_usages` | 권한 사용 현황 (프로젝트·사용자) |
| `list_role_project_participants` | 권한·프로젝트별 참여자 |
| `list_user_role_usages` | 사용자별 프로젝트·배정 권한 요약 |
| `create_custom_role` | 커스텀 권한 생성 |
| `update_custom_role` | 커스텀 권한 수정 (시스템 기본 불가; `project_ptcpnt_info` 배정이 있으면 `pmssn_list` 내용 변경만 400) |
| `delete_custom_role` | 커스텀 권한 삭제 (사용 중 불가) |

#### `admin_server/service_projects.py`

| 함수 | 기능 |
|------|------|
| `normalize_feature_flags_for_db` | `feature_flags` → DB 저장용 `{query,dash,widget}` 정규화 |
| `_sync_project_table_mappings` | 매핑 집합을 요청 목록과 일치 (추가·삭제) |
| `_sync_project_table_mappings_with_usage` | table_project_mapping을 엔트리와 일치(use_query_studio_yn·use_widgetboard_yn 개별 설정, 둘 다 N이면 미매핑, main만 허용) |
| `_user_in_actor_dept_scope` | 부서 트리 소속 여부 (활성 사용자만) |
| `_actor_may_manage_system_dev_department_users` | `dptmt=0` 소속 관리 가능 여부 |
| `_assert_target_not_hidden_system_dev_member` | 일반 관리자가 개발 부서 계정 지정 차단 |
| `_assert_project_owned` | 부서 소유 + 활성 프로젝트 검증 |
| `_assert_member_list_allowed` | 멤버 목록 조회 권한 (타부서 `o` 참여자 허용) |
| `_assert_pmssn_for_project` | pmssn이 프로젝트 부서 것인지 확인 |
| `list_projects_in_dept` | 부서 소속 프로젝트 목록 (`creator_email` 포함) |
| `list_projects_for_participant` | 참여 프로젝트 목록 (역할명·`creator_email`) |
| `create_project_full` | **단일 트랜잭션**: `project_info` + creator 멤버 + 매핑(table_mappings→채널 플래그 / `table_master_ids` 호환→양쪽 Y, main만) + 부서 내 멤버 + 타부서 알림 |
| `update_project` | 프로젝트 수정 (`feature_flags`·`table_mappings`(우선) 또는 `table_master_ids` 동기화, **`o` 는 생명주기·기능스위치·매핑 변경 불가** — `active_yn`·purge·생성은 **SA개발자·SA·A** 쪽) |
| `deactivate_project` | 소프트 삭제 (`active_yn=N`) |
| `purge_inactive_project` | 비활성만 물리 삭제 (위젯보드 알림·위젯·공유·보드 → 테이블 매핑 → 참여 → 알림·초대 참조 정리 후 DELETE) |
| `get_inactive_project_purge_preview` | 비활성 프로젝트 물리 삭제 전 위젯보드·위젯·공유 행 수 요약 반환 |
| `_list_pending_project_invites` | 미수락 `project_invite` 알림 목록 (만료 체크 포함) |
| `list_members` | 멤버 + `pending_invites` 통합 반환 |
| `cancel_project_invite` | 미수락 초대 알림 삭제 |
| `_pending_invite_for_user_project` | 중복 초대 확인 |
| `_notify_project_member_added_pair` | 멤버 추가 시 양방향 알림 |
| `_notify_project_member_removed_pair` | 멤버 제거 시 양방향 알림 |
| `add_member` | 본인 재참여 허용. 부서 내 → 즉시 INSERT / 타부서 → `project_invite` 알림. 이미 멤버·초대 대기는 SQL로 차단 |
| `update_member_role` | 멤버 역할 변경 (`o`는 `u`만) |
| `remove_member` | 멤버 제거 + 양방향 알림 + 잔존 project_invite 알림 정리 (`o`는 `u`만) |
| `validate_invite_user_project` | 초대 시 프로젝트·pmssn 정합 검증 |

#### `admin_server/service_tables.py`

| 함수 | 기능 |
|------|------|
| `list_table_master` | 전사 테이블 목록 (`sort=project_create`: db_type=main이면 update_dtm·table_name; 그 외 dash 우선·동일) |
| `update_table_master` | 테이블 라벨·설명 수정 |
| `list_project_tables` | 프로젝트별 매핑 테이블 (`use_query_studio`·`use_widgetboard` bool 포함) |
| `add_project_table_mapping` | 매핑 추가 (main table_master만, 양 채널 Y 기본) |
| `delete_project_table_mapping` | 매핑 삭제 |

#### 교차 참조 (`table_master`)

- ETL이 **내장 main_db·dash_db**에 물리 테이블을 적재·갱신하면 **`Backend.etl_server.table_master_hook.upsert_table_master_after_load`** 가 동일 `system_db.table_master` 행을 UPSERT한다(`db_type`은 `main` 또는 `dash`만).
- 관리자 화면의 라벨·설명 수정은 위 **`service_tables`** 가 담당한다.
- ETL 측 상세는 **[§7.5](#75-security-and-limits)**·**[§7.6](#76-related-database-tables)**.

#### 관리·위젯보드 목록 API의 기본 정렬

- 아래 **목록용 GET** 은 프론트가 클라이언트 필터·정렬·페이지 slice의 **출발 순서**로 쓴다. 통합 이력(`system_log_server`)은 서버 `page`/`page_size` 페이징이라 별도다.
- **`GET /api/admin/users`** — `service_users.list_users_for_admin_ui`: 부서 트리 키·`dptmt_info_id`·조직 역할(sa_dev→u)·ETL Y 우선·이메일.
- **`GET /api/admin/roles`** — `service_roles.list_roles_for_dept`: `pmssn_master.update_dtm DESC NULLS LAST`, 시스템 기본 우선·권한명.
- **`GET /api/admin/org`**, **`GET /api/admin/org/departments`** — `service_users.list_departments_for_org_settings`: `dptmt_info.update_dtm DESC NULLS LAST`, 부서 id.
- **`GET /api/admin/projects`** — `service_projects.list_projects_in_dept` / `list_projects_for_participant`: `project_info.update_dtm DESC NULLS LAST`, 프로젝트명.
- **`GET /api/admin/projects/{id}/members`** — `service_projects.list_members`(참여자 UNION 미수락 초대): 참여자는 `project_ptcpnt_info.update_dtm DESC NULLS LAST`·`create_dtm`·이메일; 미수락 초대는 `notification_server` 조회 **`ORDER BY n.update_dtm DESC NULLS LAST, n.create_dtm DESC`**.
- **`GET /api/widget-boards`**(프로젝트 컨텍스트) — `widget_board_server.service.list_boards`: 활성 보드 우선·`widget_board.update_dtm DESC NULLS LAST`·`board_order`·이름.

#### `admin_server/router.py`

`admin_router` 접두사 **`/api/admin`** (아래는 전체 경로).

| 엔드포인트 | 기능 |
|------------|------|
| `GET /api/admin/users` | 사용자 목록 (`scope=dept_tree`: 프로젝트 생성 모달용) |
| `GET /api/admin/users/search` | 이메일 검색 (`o`는 부서 제한, `exclude_dptmt_zero`) |
| `POST /api/admin/users/invite` | 사용자 초대 |
| `GET /api/admin/users/ownership-transfer-targets` | 이관 후보 (`table_master`·`dptmt_creator` 분기) |
| `GET /api/admin/users/{id}/work-assets` | 자산 조회 (초대자·등록 부서·ETL 연쇄 포함) |
| `POST /api/admin/users/transfer-ownership` | 자산 이관 (`project_invite`·`dptmt_creator` 포함) |
| `GET /api/admin/users/{id}/change-options` | 변경 옵션 (`etl_yn`·마지막 SA 경고 포함) |
| `PUT /api/admin/users/{id}/management` | 일괄 변경 (409 소유 가드) |
| `PATCH /api/admin/users/{id}/suspend` | 정지 (세션 무효·409 소유 가드) |
| `PATCH /api/admin/users/{id}/activate` | 활성 |
| `DELETE /api/admin/users/{id}` | 비활성 사용자 삭제 (409 소유 가드·연관 정리) |
| `PATCH /api/admin/users/{id}/role` | 역할 변경 |
| `PATCH /api/admin/users/{id}/etl-access` | ETL 자격 (`N` 시 등록 건 검사) |
| `GET /api/admin/invite/*` | 초대 모달 옵션 |
| `GET /api/admin/org`, `PATCH /api/admin/org` | 부서 조회·수정 |
| `GET/POST/PATCH/DELETE /api/admin/org/departments` | 부서 CRUD (`migrate_users` 포함) |
| `GET/POST/PUT/DELETE /api/admin/roles` | 역할 CRUD |
| `GET /api/admin/roles/{id}/usages` | 역할 사용현황 |
| `GET /api/admin/roles/permission-options` | 권한 옵션 |
| `GET/POST /api/admin/projects` | 프로젝트 목록 / 생성 (`create_project_full` — `table_mappings` 전달 시 채널별 플래그, 미전달 시 `table_master_ids` 호환·양쪽 Y) |
| `PATCH /api/admin/projects/{id}` | 프로젝트 수정 (`feature_flags`·`table_mappings` 동기화. `table_mappings`와 `table_master_ids` 동시 전달 시 `table_mappings` 우선). **운영자(`o`)** 는 이름·설명 등 허용 필드만; 본문에 **`active_yn`(활성/비활성 전환)** 을 넣으면 라우터에서 **403**. 서비스 `update_project` 의 기능 스위치·매핑 제한과 병행 |
| `DELETE /api/admin/projects/{id}` | 소프트 삭제(비활성화). **SA개발자·SA·A** 등 생명주기 관리 권한으로만; **운영자(`o`)** 불가 |
| `GET /api/admin/projects/{id}/purge-preview` | 비활성 프로젝트 물리 삭제 전 위젯보드·위젯·공유 행 요약 |
| `DELETE /api/admin/projects/{id}/purge` | 비활성 프로젝트만 DB에서 제거. 위젯보드(알림·위젯·공유·보드)·참여·매핑·알림·초대 참조 선행 정리 후 DELETE |
| `GET /api/admin/invite-codes` | 초대코드 목록 |
| `GET /api/admin/tables`, `PATCH /api/admin/tables` | 테이블 마스터 (`sort=project_create`) |
| `GET/POST/DELETE /api/admin/projects/{id}/tables` | 테이블 매핑 |
| `GET /api/admin/projects/{id}/members` | 멤버 + `pending_invites` |
| `DELETE /api/admin/projects/{id}/invites/{nid}` | 타부서 초대 취소 |
| `POST /api/admin/projects/{id}/members` | 멤버 추가 (부서 내 즉시 / 타부서 알림) |
| `PATCH /api/admin/projects/{id}/members/{uid}` | 멤버 역할 변경 |
| `DELETE /api/admin/projects/{id}/members/{uid}` | 멤버 제거 |

### 3.4 `system_log_server` — `/api/system-logs` (감사 로그 조회)

#### 등록·prefix

- **prefix**: `/api/system-logs`
- **코드**: `Backend/system_log_server/router.py`
- **등록**: `api_server/main.py` 에서 `admin` 라우터 **직후** `include_router`

#### 인가

| 경로 | Depends | 대상 |
|------|---------|------|
| `GET /api/system-logs`, `…/export.csv`, `GET …/{system_log_id}/changes`, `GET …/change-logs`, `GET …/login-history/org`, `…/org/export.csv` | `require_org_admin` | `sa_dev`·`sa`·`a` |
| `GET …/login-history/me` | `require_active_access` | 본인 `user_login_log` |

#### `GET /api/system-logs` (시스템 감사 목록)

**쿼리**

| 파라미터 | 설명 |
|----------|------|
| `user_key` | 행위자 id 문자열·이메일 **부분 일치** |
| `from`, `to` | 날짜. **둘 다 주면** (종료−시작) 일수 **≤ 92일(약 3개월)** , 위반 시 **400** |
| `ip_contains` | IP 부분 일치 |
| `page` | 기본 `1` |
| `page_size` | 쿼리 **미지정** 시 라우터 기본 `50`, 최대 `200` |
| `channel`, `action_kind`, `success_yn` | 필터 |
| `sort_by` | `create_dtm` \| `system_log_id` \| `channel` \| `action_kind` \| `success_yn` \| `actor_user_id` |
| `sort_dir` | `asc` \| `desc` (기본 `desc`) |

**응답**: `{ items, total, page, page_size }`

**통합 이력 UI(`/admin/user-history`)**: `Frontend/react-app/src/shared/api/systemLogClient.js` 가 목록 요청에 **`page_size` 기본 10**을 붙이고, 화면에서 **10·20·50건**만 고른다. 로그인 조직 API는 서버가 최대 **50**, 시스템 목록·**데이터 변경(`change-logs`)** 목록은 최대 **200**으로 클램프한다. 탭을 바꿔도 같은 `page_size` 를 유지하며, 응답의 `page_size` 로 선택값을 덮어쓰지 않는다.

**조회 범위**

- **`sa_dev`**: 전체.
- **`sa`·`a`**: `actor_user_id` 가 액터 부서 **하위 트리**(재귀 CTE)에 속한 **활성** 사용자인 행만. `actor_user_id` **NULL** 행은 제외.

#### `data_change_log` 조회 (`GET /api/system-logs/{system_log_id}/changes`, `GET /api/system-logs/change-logs`)

**배경**: `data_change_log`는 서비스 레이어에서 캡처한 행 단위 변경(before/after·diff)을 남기며, `system_log.request_correlation_id`와 `correlation_id`(UUID)로 논리 연결한다. 설계·Phase: **docs/report/25_Data_Change_Log_And_Tracking_Plan.md**, 스키마 정본: **04** §13a.

**`GET /api/system-logs/{system_log_id}/changes`**

- 해당 `system_log` 행이 조직 어드민에게 **`GET /api/system-logs` 목록과 동일 가시 범위**에 있을 때, 그 행의 `request_correlation_id`로 연결된 `data_change_log`를 `change_log_id` 오름차순으로 반환한다.
- `request_correlation_id`가 **NULL**이면 응답은 **빈 배열 `[]`**.
- 가시 범위 밖이거나 `system_log_id`가 없으면 **404**.
- 응답: **JSON 배열**(`ChangeLogItemOut` 목록). 프론트 `getSystemLogChanges`가 배열로 수신한다.

**`GET /api/system-logs/change-logs`**

- `data_change_log` 레코드 타임라인 페이징. 부서 트리 스코프는 **`data_change_log.actor_user_id`** 기준으로 `GET /api/system-logs`의 `actor_user_id` 스코프와 **동일 패턴**(`sa_dev` 전체 / `sa`·`a`는 하위 트리 활성 사용자).

**쿼리**

| 파라미터 | 설명 |
|----------|------|
| `target_table`, `target_pk_value`, `channel` | 선택 필터(`channel`은 목록 API와 동일하게 부분 일치 계열) |
| `from`, `to` | 날짜. **둘 다 주면** (종료−시작) 일수 **≤ 92일**, 위반 시 **400** |
| `page` | 기본 `1` |
| `page_size` | 기본 `50`, 최대 `200` |

**응답**: `{ items, total, page, page_size }`

**통합 이력 UI**: `?tab=system`에서 행별 **「변경」**으로 상세 모달(지연 로딩). `?tab=changes`에서는 본 API만으로 목록·인라인 상세(`getChangeLogsPaged`). 이 탭에는 CSV를 제공하지 않는다.

#### `GET /api/system-logs/export.csv`

- 목록과 **동일 필터·정렬**.
- 총건 **50,000행** 초과 시 **400**.
- 파일명 기본: `system_log_YYYYMMDD_HHMMSS.csv` (Asia/Seoul, `Content-Disposition`).

#### 설정·계측(append)

**`backend.system_log_append_enabled`** — `Env/config/config.json` 의 `backend` 블록(bool).

- `false`(예시): `Backend/core/system_audit_log.append_system_log` 는 **INSERT 없이 즉시 반환**.
- `true`: 계측 **INSERT** 수행.

DDL·감사 정책·`sql_fingerprint` 규약: **docs/main/04_DB_ARCHITECTURE.md** §13. 런타임 개요: **docs/main/02_BACKEND_GUIDE.md**.

**계측(요약)** — 업무 커밋 성공 후 `append_system_log` 또는 패키지 `audit_emit`:

- `admin_server`, `auth_server`, `query_studio_server`, `etl_server`(사용자 HTTP 액션), `widget_board_server`, `project_server` 등. (`notification_server` 알림 **읽음** API는 `system_log` 미계측.)
- HTTP: `CorrelationIdMiddleware`·contextvars로 상관 ID·IP·UA 요약 **보강** 가능.
- **스케줄 ETL 자동 실행**은 `system_log`에 **넣지 않음**(사용자 유발만 — 04 §13과 동일).

#### 로그인 이력

**`GET /api/system-logs/login-history/me`**

- 본인 `user_login_log`만.
- 쿼리: 위 목록과 동일 계열(`user_key`, `from`, `to`, `ip_contains`, `page`, `page_size` 미지정 시 기본 50·최대 50). 기간 상한 동일(92일).
- 응답: `{ items, total, page, page_size }`.
- `items` 필드: `login_trial_ip`(마스킹), `login_success_yn`, `login_trial_browser`, `create_dtm`(ISO). `user_id`·`user_email`은 생략(`exclude_none`).

**`GET /api/system-logs/login-history/org`**

- `user_login_log` + `user_info` 조인.
- 부서 트리 스코프: 위 `system_log` 목록과 동일(`sa_dev` 전체 / `sa`·`a`는 로그인 주체 부서가 액터 부서 하위인 행).
- `sort_by`: `create_dtm` \| `user_login_log_id` \| `login_success_yn` \| `user_id` \| `user_email`. `sort_dir`: `asc` \| `desc`.
- `items`에 `user_id`·`user_email` 포함.

**`GET /api/system-logs/login-history/org/export.csv`**

- 동일 필터·정렬. 상한 **50,000행**, 기간 상한 동일.
- 파일명 기본: `login_log_YYYYMMDD_HHMMSS.csv`.

**`GET /api/auth/me/login-history`** (레거시 래퍼)

- 응답 `{ items }` 최근 10건. 내부는 동일 `service_login_history` 마스킹·SELECT 규칙.

---

## 4. `project_server` — 프로젝트 목록·선택·초대 응답

참여 프로젝트 목록·**작업 프로젝트 선택(`select`)**·타부서 **초대 수락/거절**을 담당한다.

### 4.1 프로젝트 선택 → 업무 진입

```
사용자 로그인 후 홈 화면
│
├─ GET /api/projects
│  → 참여 프로젝트 카드 목록 (active_yn=Y만)
│
├─ 프로젝트 카드 클릭
│  → POST /api/projects/{id}/select
│  │
│  ▼
│  ┌──────────────────────────────────────────┐
│  │  JWT 재발급 (select_project_tokens·rotate_session_tokens_with_project) │
│  │  service.select_project_tokens            │
│  │  → auth_service.rotate_session_tokens_    │
│  │    with_project                           │
│  │  ├─ session_log 유효 확인                 │
│  │  ├─ project_ptcpnt_info 참여 확인         │
│  │  ├─ is_project_active (비활성 거부)       │
│  │  ├─ 비활성·잠금 계정 검사                 │
│  │  ├─ 새 access_token (project_info_id 포함)│
│  │  ├─ 새 refresh_token (project_info_id 포함)│
│  │  └─ session_log UPDATE                    │
│  └──────────────────────────────────────────┘
│
└─ 이후 API 호출
   Authorization: Bearer {새 access_token}
   → require_permission이 JWT의 project_info_id로
     pmssn_list ∩ feature_flags 검증
```

### 4.2 타부서 초대 수락·거절

```
초대받은 사용자 (알림 벨에서 project_invite 확인)
│
├─ [수락] POST /api/projects/{id}/accept-invite
│  body: { notification_info_id }
│  │
│  ▼
│  ┌──────────────────────────────────────────────────┐
│  │  초대 수락 (accept_project_invite)                 │
│  │  ① _parse_project_invite_payload                   │
│  │     notification_info 조회 + 본인 확인              │
│  │     noti_type=project_invite 검증                   │
│  │     noti_content JSON 파싱                          │
│  │     { project_info_id, pmssn_master_id,             │
│  │       invite_user_id, invite_expires_at }           │
│  │     invite_expires_at 만료 → ValueError             │
│  │  ② project_info.active_yn = Y? → 비활성 거부       │
│  │  ③ 이미 멤버? → ValueError                         │
│  │  ④ _assert_pmssn_for_project (역할 정합)            │
│  │  ⑤ project_ptcpnt_info INSERT (멤버 등록)           │
│  │  ⑥ notify_inviter_project_invite_resolved           │
│  │     → 초대자에게 "OO님이 수락했습니다"              │
│  │  ⑦ delete_notification_by_id_in_txn                 │
│  │     (초대 알림 삭제 — 잔존 시 초대중 오표시 방지)   │
│  │  ⑧ insert_notification (수락자 참여 완료 알림)      │
│  │     → "프로젝트 참여가 완료되었습니다"              │
│  │  ⑨ COMMIT                                          │
│  └──────────────────────────────────────────────────┘
│
└─ [거절] POST /api/projects/{id}/reject-invite
   body: { notification_info_id }
   │
   ▼
   ┌──────────────────────────────────────────────────┐
   │  초대 거절 (reject_project_invite)                 │
   │  ① _parse_project_invite_payload                   │
   │     (수락과 동일 검증: 알림 존재·본인·타입·만료)    │
   │  ② 이미 멤버? → "알림을 닫아 주세요"               │
   │  ③ delete_notification_by_id_in_txn (알림 삭제)     │
   │  ④ notify_inviter_project_invite_resolved           │
   │     → 초대자에게 "OO님이 거절했습니다"              │
   │  ⑤ COMMIT                                          │
   └──────────────────────────────────────────────────┘
```

### 4.3 `project_server/router.py`

| 엔드포인트 | 기능 |
|------------|------|
| `GET /api/projects` | 내 참여 프로젝트 목록 (활성만) |
| `POST /api/projects/{id}/select` | 프로젝트 선택 → JWT 재발급 (`project_info_id` 포함) |
| `POST /api/projects/{id}/accept-invite` | 타부서 초대 수락 (ValueError → 400 통일, 401 리프레시 혼동 방지) |
| `POST /api/projects/{id}/reject-invite` | 타부서 초대 거절 (ValueError → 400) |

### 4.4 `project_server/service.py`

| 함수 | 기능 |
|------|------|
| `list_projects_for_user` | 참여 프로젝트 목록 (`active_yn=Y`, pmssn_master JOIN으로 역할명 포함) |
| `select_project_tokens` | `auth_service.rotate_session_tokens_with_project` 위임 |
| `_parse_project_invite_payload` | 알림 단건 조회 → 타입·소유자·JSON·project_info_id 일치·만료 검증 후 payload 반환. accept/reject 공통 |
| `accept_project_invite` | `_parse_project_invite_payload` → 활성·중복 확인 → 멤버 등록 → 초대자 수락 알림(`notify_inviter_project_invite_resolved`) → 초대 알림 DELETE → 수락자 참여 완료 알림 |
| `reject_project_invite` | `_parse_project_invite_payload` → 이미 멤버 확인 → 초대 알림 DELETE → 초대자 거절 알림 |

---

## 5. 캠페인 대시보드 (`campaign_dash_server` + `core`)

Star 물리 테이블·`dash_db` 기반 **캠페인 지표 HTTP API**와 **`core.dashboard_service`** 집계 로직이다.

### 5.1 데이터 흐름

```
프론트: 캠페인 대시보드 화면
│
├─ 1. 테이블 후보 (get_aggregatable_tables)
│     GET /api/campaign-dashboard/tables
│     │
│     ▼
│     get_aggregatable_tables(project_info_id)
│     ├─ get_allowed_tables_by_project (main ∪ dash)
│     └─ 각 테이블의 필수 컬럼·타입 검사
│        (DASHBOARD_REQUIRED_COLUMNS 11개)
│        → 통과한 테이블만 반환
│
├─ 2. 집계·추이·회원·시간대 (택1)
│     • **번들(권장)**: `GET /api/campaign-dashboard/page` — summary·trend_multi·member_summary·hourly를 동일 앵커로 한 번에
│     • **개별 GET**: 아래 단계별 호출
│
├─ 2a. 집계·KPI (get_dashboard_data)
│     GET /api/campaign-dashboard/summary
│     │
│     ▼
│     get_dashboard_data(req)
│     ├─ _full_table_name → schema.table
│     ├─ _build_where_clause
│     │   (date_range + campaign/workflow/channel 필터)
│     ├─ _build_group_by_clause
│     │   (campaign/date/workflow/channel 조합)
│     ├─ SQL 실행: SUM 집계 + 비율 계산
│     ├─ _row_to_aggregated (행 변환)
│     └─ _calculate_kpi
│        ├─ 전체 KPI (발송·성공·오픈·클릭 합계/비율)
│        └─ 채널별 분포 (send/success/open/click)
│
└─ 3. 일별 추이 (get_chart_data)
      GET /api/campaign-dashboard/trend
      │
      ▼
      get_chart_data(req)
      ├─ dimension: delivery_date/campaign/workflow/channel
      ├─ metric: success_count/open_rate 등
      ├─ GROUP BY dimension
      └─ rows: [{ name, value }]
```

---

### 5.2 `core/dashboard_service.py`

| 함수 | 기능 |
|------|------|
| `get_required_columns` | 대시보드 필수 컬럼·타입 목록 |
| `get_aggregatable_tables` | dash_db 스키마에서 `*_star_1` 패턴·`is_new_dash_physical_table` 인 물리 테이블을 매핑과 무관하게 후보로 두고, DASHBOARD_REQUIRED_COLUMNS를 만족하는 것만 반환 |
| `_full_table_name` | `table_id` → `schema.table` 문자열 |
| `_build_group_by_clause` | `GROUP BY` SELECT/절 생성 |
| `_build_where_clause` | `WHERE` 절 + params 생성 |
| `_row_to_aggregated` | DB 행 → 집계 dict 변환 |
| `get_dashboard_data` | 필터 기반 집계 데이터 + KPI 반환 |
| `_calculate_kpi` | KPI + 채널별 분포 계산 |
| `_build_filter_linked_where` | 연동 필터 WHERE 조건 생성 |
| `get_filter_options` | 캠페인·워크플로우·채널 옵션 조회 |
| `get_chart_data` | 단일 디멘션·메트릭 차트 데이터 |

---

### 5.3 `campaign_dash_server/router.py`

#### 등록·인가·DB

- 라우터 **`APIRouter(prefix="/api/campaign-dashboard", tags=["campaign-dashboard"])`**.
- 엔드포인트는 모두 **`GET`** 이고 **`require_permission("dashboard")`** 를 공통으로 쓴다(JWT·계정·프로젝트 활성·`pmssn_list` ∩ `feature_flags` 에 `dashboard` 포함 — **§2.3** 과 동일 패턴).
- DB는 **`db.get_db_connection_dash()`** 로 대시보드용 스키마에 접속한다.

#### 엔드포인트

| 메서드 | 경로 | 핵심 | 의존성 |
|--------|------|------|--------|
| `GET` | `/api/campaign-dashboard/tables` | `get_aggregatable_tables` 후 **`*_star_1` 접미사만** 드롭다운용 `{ tables: [{id,name}] }` | `require_permission("dashboard")` |
| `GET` | `/api/campaign-dashboard/page` | SPA용 번들: 동일 `table_id`·기간 앵커로 `summary`·`trend_multi`·`member_summary`·`hourly`(success/open/click)를 한 응답에 포함. 쿼리 파라미터: `trend_days`·`trend_count`·`trend_by_channel` | `require_permission("dashboard")` |
| `GET` | `/api/campaign-dashboard/summary` | KPI 집계 + 전기간 대비 **변동률**(`_calc_change_pct`) 병합 | 위와 동일 + `table_id`·`target_date`·`period` |
| `GET` | `/api/campaign-dashboard/trend` | 단일 지표 **일별** 추이, `days`(1~365)·`metric`, `end_date` — `dashboard_service.get_chart_data` | 위와 동일 |
| `GET` | `/api/campaign-dashboard/trend-multi` | **복수 기간** 추이(`daily`/`weekly`/`monthly`, `count`·`days`, `by_channel`) — 라우터 내 SQL | 위와 동일 |
| `GET` | `/api/campaign-dashboard/member-summary` | `_star_2` 스냅샷 1건(curr/prev)·JSONB 파싱·유입·이탈·순증감 | 위와 동일 |
| `GET` | `/api/campaign-dashboard/delivery-demographics` | `_star_1` 에서 grade/age/gender JSONB **SUM**, `by_channel` 시 채널별 | 위와 동일 |
| `GET` | `/api/campaign-dashboard/hourly` | 24슬롯 JSONB SUM, `metric`: success\|open\|click, `by_channel` 옵션 | 위와 동일 |

공통 쿼리 파라미터(일부 엔드포인트): `table_id`(필수), `target_date`/`end_date`(선택·미지정 시 오늘), `period` = `daily` \| `weekly` \| `monthly`.

#### 기간·추이 창 공통 모듈

**`campaign_dash_server/campaign_period.py`** (라우터가 import): 일간·주간·월간에 대해 summary·hourly·delivery-demographics·trend-multi·`/page` 가 동일한 날짜 상한(팩트 delivery_date 기준)을 쓰도록 한 곳에서 정의한다.

| 함수 | 기능 |
|------|------|
| `calc_summary_date_range` | 기준일이 속한 집계 구간 `[시작, 끝]` ISO 문자열 (주간=월~일) |
| `calc_previous_range` | 직전 동일 단위 구간 |
| `fact_inclusive_end_date` | 팩트 쿼리 WHERE 상한일 — `calc_summary_date_range`의 `[1]`과 동일 |
| `trend_multi_window_start` | trend-multi SQL용 `(start_dt, date_expr, group_expr)` — `fact_inclusive_end_date` 결과를 넣어 summary와 버킷 합계 정합 |

#### 라우터 모듈 내부 함수 정리

| 함수 | 한 줄 설명 |
|------|------------|
| `_assert_campaign_table` | `project_info_id`·`table_id` 로 **`db.is_table_allowed_for_project_dashboard`** → 미매핑 시 **403** |
| `_require_star_fact_table` | `*_star_1` 접미사 + **`db.validate_dashboard_data_table_name`** |
| `_member_table_id_from_fact` | `_star_1` → 동일 접두의 **`_star_2`** 회원 테이블명(검증 포함) |
| `_quoted_table` | **`db.get_dash_table_schema()`** 기준 `"schema"."table"` 인용 |
| `_campaign_summary_result` | summary 엔드포인트와 동일 본문(dict) 반환 — KPI·aggregated_data·전기간 증감률 병합. `/page` 번들에서 재사용 |
| `_member_summary_payload_optional` | 회원 스냅샷 dict 또는 데이터 없음 시 None 반환. `/page` 번들용 |
| `_hourly_payload_dict` | hourly 엔드포인트와 동일 본문(dict) 반환. `/page` 번들용 |
| `_trend_multi_execute` | trend-multi 응답 본문. `fact_inclusive_end_date`로 summary·hourly와 팩트 상한 정합 |
| `_calc_change_pct` | `(cur - prev) / prev × 100` 변동률, `prev` 없거나 0이면 `None` |
| `_jsonb_as_dict` | JSONB / str / None → dict 안전 변환 |
| `_clamp_date_to_range` | 날짜를 `[start, end]` 안으로 클램핑 |
| `_snapshot_end_clamped` | 현재 기간 스냅샷 조회 **종료일** 클램핑 |
| `_snapshot_prev_end_clamped` | 이전 기간 스냅샷 조회 종료일 클램핑 |
| `_same_day_prev_month` | 월간 비교용 **전월 동일일**(말일 보정) |
| `_prev_snapshot_ref_date` | `period` 별 이전 스냅샷 기준일 |
| `_row_date_iso` | 행의 date 컬럼 → `YYYY-MM-DD` 문자열 |
| `_week_start` / `_month_start` | `trend-multi` 용 주·월 시작일 계산 |
| `_build_delivery_demographics_select` | grade/age/gender JSONB → **SUM** SQL 조각 |
| `_build_hourly_select` | 24시간 JSONB(`h0`~`h23`) → **SUM** SQL 조각 |
| `_trend_multi_range` | `period`·`days`·`count` 에 따른 시작일·`date_expr`·`group_expr` |
| `_build_trend_multi_query` | `trend-multi` 전용 **GROUP BY** SQL |

#### 테이블 구조 전제(요약)

`ibank_{N}_star_1`(발송 팩트)·`ibank_{N}_star_2`(회원 스냅샷) 등 **대시보드 집계 테이블**을 전제로 한다. JSON 키·컬럼 별칭은 **`router.py`** 의 `GRADE_JSON_KEYS`·`AGE_COLS`·`HOUR_SLOTS`·`_HOURLY_JSON_COL` 과 실제 ETL 스키마를 병행 확인한다.

```
ibank_{N}_star_1  (발송 팩트)           ibank_{N}_star_2  (회원 스냅샷)
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ delivery_date   DATE         │      │ base_date         DATE       │
│ delivery_channel VARCHAR     │      │ total_recipients  BIGINT     │
│ total_count     BIGINT       │      │ target_recipients BIGINT     │
│ success_count   BIGINT       │      │ increased_count   BIGINT     │
│ open_count      BIGINT       │      │ decreased_count   BIGINT     │
│ click_count     BIGINT       │      │ gender_count      JSONB      │
│ grade_count     JSONB {a~e}  │      │ age_count         JSONB      │
│ age_count       JSONB        │      │ grade_count       JSONB      │
│ gender_count    JSONB        │      │ opt_in_count      JSONB      │
│ success_hourly  JSONB {h0~23}│      └──────────────────────────────┘
│ open_hourly     JSONB {h0~23}│
│ click_hourly    JSONB {h0~23}│
└──────────────────────────────┘
```

#### 핵심 동작 흐름

```
프론트: 대시보드 페이지 진입
│
▼
┌──────────────────────────────────────────────────┐
│  STEP 1: 대시보드 권한 (require_permission("dashboard")) │
│  ① JWT → user_id, project_info_id                │
│  ② 계정 활성·잠금 검사                            │
│  ③ 프로젝트 active_yn 검사                        │
│  ④ pmssn_list ∩ feature_flags → "dashboard"     │
├──────────────────────────────────────────────────┤
│  불포함 → 403                                     │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: 테이블 후보 (GET /tables → get_aggregatable_tables) │
│  ① get_aggregatable_tables(project_info_id)       │
│  ② *_star_1 만 필터 → 테이블 드롭다운             │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 3: UI 입력 (table_id·기간·period)           │
│  → table_id, target_date/end_date, period 등      │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 4: 프로젝트 매핑 검사 (_assert_campaign_table) │
│  ① is_table_allowed_for_project_dashboard         │
│  ② 미매핑 → 403                                   │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 5: Star 팩트 테이블 강제 (_require_star_fact_table) │
│  ① *_star_1 접미사 확인                           │
│  ② validate_dashboard_data_table_name             │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 6: 기간·전기간 (campaign_period.calc_*)    │
│  campaign_period.calc_summary_date_range → [start, end] │
│  campaign_period.calc_previous_range → [prev_start, prev_end] │
│  campaign_period.fact_inclusive_end_date → 팩트 상한일 │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 7: 엔드포인트별 집계·SQL 분기                │
│                                                   │
│  /page (번들)       → _campaign_summary_result     │
│  │                     + _trend_multi_execute       │
│  │                     + _member_summary_payload    │
│  │                       _optional                  │
│  │                     + _hourly_payload_dict ×3    │
│  │                     (success/open/click)         │
│  │                                                │
│  /summary            → dashboard_service            │
│  │                     get_dashboard_data ×2 (현재/전기) │
│  │                     변동률 필드 병합             │
│  │                                                │
│  /member-summary     → _star_2 직접 SELECT        │
│  │                     스냅샷 row 1건·JSONB 파싱  │
│  │                                                │
│  /delivery-demographics → _star_1 SUM + optional  │
│  │                     GROUP BY delivery_channel   │
│  │                                                │
│  /hourly             → _star_1 24슬롯 SUM         │
│  │                                                │
│  /trend              → get_chart_data             │
│  │                                                │
│  /trend-multi        → _trend_multi_range +       │
│                        _build_trend_multi_query    │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 8: JSON 응답·에러 매핑                       │
│  • JSON (kpi, rows, data, date_range, period …)   │
│  • member-summary: 행 없음 → 404 + error 메시지   │
│  • ValueError 등 → 400, 예외 → 500 (JSON error)   │
└──────────────────────────────────────────────────┘
```

#### 보안·데이터 격리 요약

```
  ┌─ 인증·인가 ──────────────────────────┐
  │  단계1 (require_permission("dashboard")) │
  │  require_permission("dashboard")     │
  │  JWT + 활성 + 프로젝트 + feature_flags│
  └──────────────┬───────────────────────┘
                 ▼
  ┌─ 테이블 격리 ────────────────────────┐
  │  단계2 (_assert_campaign_table)        │
  │  _assert_campaign_table                │
  │  project 대시보드 매핑 화이트리스트     │
  └──────────────┬───────────────────────┘
                 ▼
  ┌─ 테이블명 안전성 ───────────────────┐
  │  단계3 (_require_star_fact_table)     │
  │  _require_star_fact_table            │
  │  validate_dashboard_data_table_name  │
  │  *_star_1 접미사 강제                │
  │  _quoted_table → "schema"."table"    │
  └─────────────────────────────────────┘
```

#### 설계 요약

- 읽기 전용 대시보드 API로 **`_star_1`(발송 팩트)** 와 **`_star_2`(회원 스냅샷)** 만 다룬다.
- 권한 → 프로젝트 매핑 → 식별자 검증에 더해 **`_star_1` 강제**로 임의 테이블 경로를 줄인다.
- `/summary`·`/trend` 는 **`dashboard_service`** 에 위임하고, demographics·hourly·member-summary·trend-multi 는 라우터에서 JSONB·SQL을 직접 구성하는 **하이브리드** 구조다.

---

## 6. 기타 패키지

알림·위젯 보드·쿼리 스튜디오는 **§6.1~§6.3** 에서 다룬다. 그 앞의 **§6.0** 에서는 동일 절에 언급되는 나머지 패키지를 한눈에 정리한다.

### 6.0 패키지 한눈에

- **`query_studio_server`**
  - **경로**: `/api` 하위(쿼리 스튜디오·execute-query 등). 상세는 **§6.3**, 코드는 **`query_studio_server/router.py`**, 구조는 **02_BACKEND_GUIDE.md**.
  - **list-tables / describe-table**: `mapping_usage=query_studio|widgetboard` 로 채널별 매핑 필터. **main_db** 매핑만 반환(dash 제외). describe-table 은 항상 main_db 연결.
  - **SQL 안전**: `Backend.core.sql_safety` import. `_contains_dangerous_sql` 은 디버그 로그 래퍼.
  - **라벨**: `query_studio_user_labels`(system_db JSONB, user_id+project_info_id별) 우선, 파일 보조.
  - **peak_guard**(선택 `backend.query_studio_peak_guard`): `table-relationships?mode=all`, `join-order`, `execute-query` 에 분당 한도·동시 계산 상한·TTL 캐시. 초과 시 **429**(`Retry-After`), 대기 초과 시 **503**(`peak_guard.py`).

- **`etl_server`**
  - **경로**: `/api/etl`, `/api/etl/batch`. 가드: **`require_etl_infrastructure`**. 상세는 **§7**, 운영·COPY 등은 **02_BACKEND_GUIDE.md** §6.
  - **라우터**: **`router.py`**(메인) + **`router_file.py`**(`prefix="/batch"` 를 메인에서 `include_router` → URL 은 `/api/etl/batch/*`). 별도 `etl_file_router` 없음.
  - **한도**: **`etl_limits`**(업로드·적재 행·배치 크기 등, `backend.etl_limits` 또는 모듈 기본). **query_studio `peak_guard`** 와 목적·범위가 다르다 → **[§6.3](#63-query_studio_server)** vs **[§7.5](#75-security-and-limits)**.

- **`notification_server`**: **§6.1** — HTTP 는 목록·카운트·읽음만. 생성은 `service.insert_notification` 내부. **`notification_server/router.py`**, **`service.py`**.

- **`campaign_dash_server`**: **§5.1** 흐름 · **§5.3** 엔드포인트·내부함수·보안. **`campaign_dash_server/router.py`**, **02_BACKEND_GUIDE.md** 병행.

- **`widget_board_server`**: **§6.2** — `system_db` 메타·`/api/widget-boards`(초대·참여·공유·레이아웃). **`widget_board_server/router.py`** — 엔드포인트·권한·저장 구조는 **본 문서 §6.2** 가 기준이다.

---

### 6.1 `notification_server`

라우터 **`APIRouter(prefix="/api/notifications", tags=["notifications"])`**. 모든 엔드포인트에 **`require_active_access`** → `get_system_db` 로 **system_db** 의 `notification_info` 만 다룬다.

#### `router.py` — 엔드포인트

| 메서드 | 경로 | 핵심 | 의존성 |
|--------|------|------|--------|
| `GET` | `/api/notifications` | 내 알림 목록(최신순, `limit` 기본 50·최대 200) | `require_active_access` |
| `GET` | `/api/notifications/unread-count` | 미읽음 건수(`read_yn` 이 `Y` 가 아닌 행) | `require_active_access` |
| `PATCH` | `/api/notifications/read-all` | 내 알림 전부 읽음 | `require_active_access` |
| `PATCH` | `/api/notifications/{notification_info_id}/read` | 단건 읽음; 본인 행 없으면 **404** | `require_active_access` |

#### `service.py` — 함수 정리

| 함수 | 한 줄 설명 |
|------|------------|
| `list_notifications` | `user_id` 기준 `notification_info` 최신순 조회, `create_dtm`·`update_dtm` ISO 문자열 변환 |
| `count_unread` | `user_id` 기준 미읽음 건수 반환 |
| `mark_read_one` | 단건 읽음 (API용 commit 포함) |
| `mark_read_all` | 전체 읽음 (API용 commit 포함), 변경 행 수 반환 |
| `mark_notification_read_in_txn` | 동일 트랜잭션 내 읽음 처리 (commit/rollback은 호출자) |
| `fetch_notification_by_id` | 알림 단건 조회 (notification_info_id·noti_content·noti_type·user_id) |
| `delete_notification_by_id_in_txn` | 알림 단건 DELETE (트랜잭션 내, 호출자 commit) |
| `delete_notifications_for_user_in_txn` | 사용자 전체 알림 DELETE (user_info DELETE 전 정리용) |
| `delete_project_invite_notifications_for_project_in_txn` | 프로젝트의 project_invite 알림 전체 DELETE (purge용, JSON project_info_id 매칭) |
| `delete_project_invite_notifications_for_user_project_in_txn` | 특정 사용자·프로젝트 project_invite 알림 DELETE (멤버 제거 시 잔존 초대행 정리) |
| `fetch_pending_project_invite_rows_for_project` | 프로젝트의 미수락 project_invite 알림 목록 (이미 멤버인 행 제외, user_info·dptmt JOIN) |
| `pending_project_invite_exists_for_user_project` | 특정 사용자·프로젝트에 미수락 초대 존재 여부 (중복 초대 방지) |
| `user_has_pending_widget_board_invite` | 미읽음 widget_board_invite 알림 중 해당 board_id 존재 여부 |
| `delete_widget_board_notifications_for_board_in_txn` | 위젯보드 관련 알림(invite·accepted·rejected) 일괄 DELETE (purge용) |
| `user_display_label_for_notification` | user_nickname·user_email COALESCE → 알림 제목용 표시 라벨 |
| `notify_inviter_project_invite_resolved` | 초대자에게 project_invite 수락/거절 결과 알림 INSERT |
| `notify_inviter_widget_board_invite_resolved` | 초대자에게 widget_board_invite 수락/거절 결과 알림 INSERT |
| `insert_notification` | notification_info 1행 삽입 (`autocommit=False`면 호출자 트랜잭션, `True`면 즉시 commit) |

#### 동작 흐름 (벨·패널 등)

```
사용자 액션 (벨 아이콘 클릭 등)
│
▼
┌──────────────────────────────────────────────┐
│  STEP 1: 세션·계정 (require_active_access)    │
│  auth_server/deps.py                         │
│  ① Bearer JWT 검증 (typ=access, exp)         │
│  ② system_db → user_active_yn, user_lock_yn  │
│  ③ 비활성·잠금 → 403                         │
├──────────────────────────────────────────────┤
│  통과 → payload["user_id"] 추출              │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 2: 라우팅 (list_notifications 등)     │
│                                              │
│  GET  /api/notifications     → list_notifications │
│  GET  /unread-count          → count_unread  │
│  PATCH /read-all             → mark_read_all │
│  PATCH /{id}/read            → mark_read_one │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 3: DB 갱신 (notification_service)       │
│  ① system_db.notification_info 직접 조회/갱신 │
│  ② WHERE user_id = 본인 (타인 알림 접근 불가) │
│  ③ 갱신 시 commit, 실패 시 rollback           │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 4: HTTP 응답                            │
│  • list     → { items: [...] }               │
│  • count    → { count: N }                   │
│  • read-all → { updated: N }                 │
│  • read-one → { message: "읽음 처리되었습니다." } │
│              → 404 (본인 알림 아님/없음)       │
└──────────────────────────────────────────────┘
```

#### 알림 생성 경로 (`insert_notification` 호출처)

```
┌─────────────────────────────┐
│  admin_server               │
│  • 멤버 추가/제거 통보       │──┐
│  • 타부서 초대 발송          │  │
├─────────────────────────────┤  │
│  project_server             │  │    ┌───────────────────────────┐
│  • 초대 수락/거절 결과 통보  │  ├──▶ │  insert_notification()    │
│  • 수락자 참여 완료 알림     │  │    │  notification_info INSERT │
├─────────────────────────────┤  │    │  → PK 반환               │
│  widget_board_server        │  │    │                           │
│  • 위젯보드 초대 발송        │──┘    │  autocommit=False →      │
│  • 초대 수락/거절 결과 통보  │       │  호출자 트랜잭션          │
└─────────────────────────────┘       └───────────────────────────┘
```

#### 설계 요약

- HTTP 라우터는 **조회·카운트·읽음 처리**만 담당하고, **알림 적재 책임은 호출 측(admin·project·widget_board 등)** 에 둔다.
- `insert_notification`은 `service`에만 있고 라우터에 노출되지 않으므로 **외부 HTTP로 알림 직접 생성은 불가**하다.
- 트랜잭션 내 호출(`autocommit=False`)과 API 직접 호출(`autocommit=True`) 두 경로를 지원한다.
- `*_in_txn` 접미사 함수는 모두 **호출자가 commit/rollback** 을 제어한다.

---

### 6.2 `widget_board_server`

#### 등록·라우터·DB

- 라우터 **`APIRouter(prefix="/api/widget-boards", tags=["widget-boards"])`**.
- `api_server/main.py` 에서 **`include_router(..., dependencies=[Depends(require_permission("widgetboard"))])`** 로 등록된다.
- JWT에 **`project_info_id`(작업 프로젝트)** 가 없으면 **403**.
- **메타·레이아웃**은 **`get_system_db`** (`ibank_system_data` 등)의 `widget_board`, `widget_item`, `widget_board_share`.

#### 접근 정책

- **읽기**: (1) **소유자**, (2) **`widget_board_share`에 등록된 사용자**, (3) **`share_scope = project`** 이고 동일 프로젝트 **`project_ptcpnt_info` 참여자**(읽기 전용 캔버스).
- **편집**: 소유자 또는 `widget_board_share.can_edit = true` 인 사용자만.
- **`share_scope`**: `POST`/`PATCH` 바디에서 **`private`**(기본·초대·공유 행 위주) 또는 **`project`**.
- **초대**: **`widget_board_invite` 알림** → 수락 시 `widget_board_share` 행 생성.
- **목록**: `share_scope=project` 인 보드 중 **위젯보드 권한이 없는** 비공유 참여자에게는 노출하지 않는다(`list_boards`).
- **비활성 보드**: 소유자만 목록에 노출; 비소유자는 "찾을 수 없음" 처리.

#### 위젯 데이터 (`saved_table` / `query`)

- 소스 테이블·쿼리는 **현재 프로젝트에 매핑된 리소스만** 허용한다.
- `saved_table`: `get_allowed_tables_by_project(..., usage_widgetboard=True, db_type=main)` 만 허용; dash_db 테이블은 사용하지 않는다.
- SQL 금지어 검사는 **`Backend.core.sql_safety`** 를 `query_studio_server` 와 공유한다.
- `saved_table` 조회 시 `data_config`의 `dateStart`·`dateEnd`·`dateGrain`·`dateColumn`으로 기간 필터; 응답 `columns`에 `data_type`, `meta.applied_date_column` 반환.

#### `router.py` — 엔드포인트

| 메서드 | 경로 | 핵심 |
|--------|------|------|
| `GET` | `/api/widget-boards` | 접근 가능 보드 목록 (`is_owner`, `can_edit`, `owner`, `participant_count`, `widget_item_count`, `share_row_count`) |
| `POST` | `/api/widget-boards` | 보드 생성 (프로젝트 참여자만) |
| `GET` | `/api/widget-boards/{board_id}` | 보드 상세 + 위젯(layout 포함) + `can_edit`. 비활성 보드 → 에러 |
| `GET` | `/api/widget-boards/{board_id}/participants` | 소유자 + 공유 대상 목록 (`viewer_is_owner` 포함) |
| `GET` | `/api/widget-boards/{board_id}/invite-candidates` | 초대 후보 (같은 프로젝트 참여자 중 widgetboard 권한 있고 미공유·미초대) |
| `PATCH` | `/api/widget-boards/{board_id}` | 보드 메타 수정. 비활성 보드는 소유자만 이름·설명·활성 여부만. `active_yn`·`share_scope` 소유자 전용 |
| `DELETE` | `/api/widget-boards/{board_id}` | **비활성** 보드만 물리 삭제 (위젯·공유·관련 알림 정리 후 행 삭제). 활성이면 **400** |
| `POST` | `/api/widget-boards/{board_id}/widgets` | 위젯 추가 (`create_user_id` 저장, `saved_table` 시 허용 검사) |
| `PATCH` | `/api/widget-boards/{board_id}/widgets/{widget_id}` | 위젯 패치 (`saved_table` 변경 시 허용 재검사) |
| `DELETE` | `/api/widget-boards/{board_id}/widgets/{widget_id}` | 위젯 물리 DELETE (soft delete 아님) |
| `PATCH` | `/api/widget-boards/{board_id}/layout` | 다건 `layout_x/y/w/h` 일괄 변경 |
| `POST` | `/api/widget-boards/{board_id}/invite-notifications` | 초대 알림 일괄 발송 (widgetboard 권한·미공유·미초대 사용자만) |
| `POST` | `/api/widget-boards/{board_id}/accept-invite` | 알림 ID 기준 초대 수락 → `widget_board_share` INSERT + 초대자 알림 |
| `POST` | `/api/widget-boards/{board_id}/reject-invite` | 초대 거절 → 알림 DELETE + 초대자 알림 |
| `POST` | `/api/widget-boards/{board_id}/share` | 지정 사용자 공유 upsert (소유자 전용, 활성 보드만) |
| `DELETE` | `/api/widget-boards/{board_id}/share/{shared_user_id}` | 공유 제거 + 해당 사용자 create_user_id 소유 위젯을 소유자로 이관 |
| `POST` | `/api/widget-boards/{board_id}/widgets/{widget_id}/data` | 위젯 데이터 조회 (saved_table: 기간 필터·data_type·meta / query: SQL 안전 검사 / note: 빈 응답) |

#### `service.py` — 핵심 함수

| 함수 | 기능 |
|------|------|
| `_can_read_board` / `_can_edit_board` | 소유자·share·project scope 판정 |
| `assert_board_read` / `assert_board_edit` / `assert_board_owner` | 접근 계층별 검증 (비활성 보드 처리 포함) |
| `list_boards` | 접근 가능 보드 목록. project scope 보드는 widgetboard 권한 없으면 미노출 |
| `create_board` | 프로젝트 참여자만. `StringDataRightTruncation` → 안내 에러 |
| `get_board_detail` | 보드 + 위젯(data_config JSON 파싱·layout dict 포함) + `can_edit` |
| `patch_board` | 비활성 보드 → 소유자만 이름·설명·활성 여부. 활성 → 편집자도 가능 |
| `delete_board` | 비활성만. 위젯 → 공유 → 알림 → 보드 행 삭제 |
| `add_widget` / `patch_widget` | `saved_table` 시 `_allowed_saved_table` 검사. `create_user_id` 저장 |
| `delete_widget` | 물리 DELETE |
| `patch_layout` | 다건 layout 일괄 UPDATE |
| `send_invite_notifications` | 소유자만. 참여자·widgetboard 권한·미공유·미초대 필터 후 알림 INSERT |
| `_parse_widget_board_invite_payload` | accept/reject 공통 검증 (알림 존재·타입·소유자·JSON·보드/프로젝트 일치·만료) |
| `accept_widget_board_invite` | 검증 → share INSERT → 알림 read_yn → 초대자 수락 알림 |
| `reject_widget_board_invite` | 검증 → 알림 DELETE → 초대자 거절 알림 |
| `upsert_share` / `delete_share` | 소유자 전용. 제거 시 해당 사용자 소유 위젯의 `create_user_id`를 소유자로 이관 |
| `list_board_participants` / `list_invite_candidates` | 참여자·후보 조회 |
| `_allowed_saved_table` | `usage_widgetboard=True, db_type=main` 매핑 + 물리 존재 검사 |
| `fetch_widget_data` | `saved_table`: 기간 필터(`dateStart/End/Grain/Column`)·`data_type` 포함 columns·`meta.applied_date_column` / `query`: SQL 안전 검사 / `note`: 빈 응답 / `campaign_dash`: 미지원 안내 |

#### `schemas.py` — Pydantic 모델

| 클래스 | 기능 |
|--------|------|
| `WidgetBoardCreateBody` | 보드 생성 (`board_dscrtn` 길이 검증) |
| `WidgetBoardPatchBody` | 보드 수정 (`active_yn` bool 포함) |
| `WidgetItemCreateBody` / `WidgetItemPatchBody` | 위젯 생성·수정 |
| `LayoutItem` / `LayoutPatchBody` | 레이아웃 일괄 변경 |
| `ShareUpsertBody` | 공유 upsert |
| `WidgetBoardInviteItem` / `WidgetBoardInviteBatchBody` | 초대 알림 일괄 발송 |
| `WidgetBoardInviteResolveBody` | 초대 수락·거절 |

#### `constants.py`

| 상수 | 기능 |
|------|------|
| `BOARD_DSCRTN_MAX_LEN` | board_dscrtn 허용 문자 수 (기본 1000) |

프론트: **`Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx`**(캔버스), **`WidgetboardListPage.jsx`**(목록), **`api/widgetBoardClient.js`**. API·권한·데이터 흐름은 **본 문서 §6.2** 를 본다.

### 6.3 `query_studio_server`

라우터 **`APIRouter(prefix="/api", tags=["report"])`**. 엔드포인트별로 `require_permission("query.read")` 또는 `require_permission("query.execute")`를 사용한다. DB는 **`get_db`**(main_db 풀)을 기본으로 쓰며, `list-tables`·`describe-table`은 `mapping_usage` 파라미터에 따라 채널별 매핑을 필터한다.

#### `router.py` — 엔드포인트

| 번호 | 메서드 | 경로 | 핵심 | 권한 |
|------|--------|------|------|------|
| 1 | `GET` | `/api/list-tables` | 프로젝트 매핑 테이블 목록 + 사이즈·라벨. `mapping_usage=query_studio` 또는 `widgetboard` | `require_active_access` + 채널별 권한 검사 |
| 2 | `POST` | `/api/describe-table` | 테이블 컬럼 구조. `mapping_usage` 동일 | 위와 동일 |
| 3 | `GET` | `/api/column-labels` | 테이블·컬럼 라벨 조회 (유저 JSON ∪ 파일) | `query.read` |
| 4 | `POST` | `/api/column-labels` | 라벨 저장 (user_id+project_info_id별 system_db JSONB) | `query.read` |
| 5 | `GET` | `/api/table-relationships` | FK/추론 관계 (`mode=fk` 또는 `all`). peak_guard 적용 | `query.read` |
| 6 | `POST` | `/api/join-order` | JOIN 순서 자동 계산. peak_guard 적용 | `query.read` |
| 7 | `POST` | `/api/save-query-as-table` | 쿼리 결과 → 테이블 (큐 기반 비동기. CREATE 후 `table_master`·`table_project_mapping` upsert 3회 재시도). **동일 `table_master`** 는 ETL 적재 완료 시 **`table_master_hook`** 로도 등록·갱신된다(`db_type`은 `main`/`dash` 컨벤션, **[§7.6](#76-related-database-tables)**) | `query.execute` |
| 8 | `GET` | `/api/save-query-as-table/status/{job_id}` | 저장 작업 상태 조회 | `query.read` |
| 9 | `POST` | `/api/execute-query` | SELECT 실행 (main_db만). peak_guard 적용 | `query.execute` |
| 10 | `POST` | `/api/explain-sql` | Claude API로 SQL 해석 | `query.execute` |
| 11 | `POST` | `/api/get-column-values` | 컬럼 고유값 조회 (main_db 매핑만) | `query.read` |
| 12 | `POST` | `/api/query-stats` | 쿼리 통계 (COUNT + EXPLAIN, main_db만) | `query.execute` |

#### 보조 모듈

| 모듈 | 역할 |
|------|------|
| `schemas.py` | Pydantic 요청 모델 8종. `DescribeTableRequest`에 `mapping_usage` 필드 추가 |
| `analysis_store.py` | `allowlist_analysis` 테이블 CRUD (분석 스냅샷 저장·조회, 기존 호환; 관계 캐시는 `_compute_relationships_all` peak_guard TTL 우선) |
| `join_path.py` | BFS 경로 탐색, JOIN 순서 결정, 순환·깊이 검증 |
| `join_metrics.py` | JOIN 정확도 점수, 경우의 수, 파생 테이블 컬럼 |
| `relationship_inference.py` | `_id` 컬럼 기반 관계 추론 (pluralize 활용) |
| `pluralize.py` | 단수→복수 변환, 부모 테이블명 추론 |
| `peak_guard.py` | 선택 설정: TTL 캐시·동시 계산 상한·분당 한도 (429·503). **query_studio 전용**이며, ETL 파일·적재 한도는 **`etl_limits`** (**[§7.5](#75-security-and-limits)**) |

#### 핵심 내부 함수

| 함수 | 기능 |
|------|------|
| `_assert_mapping_list_perm` | list-tables·describe-table 공통: `mapping_usage`별 `query.read` 또는 `widgetboard` 권한 검사 |
| `_resolve_project_table_db_type` | main_db 매핑에 있을 때만 `main` 반환. dash 매핑은 미사용 |
| `_qs_mapped_table_conn` | QS·위젯보드: 항상 main_db 연결 반환 |
| `_load_user_project_labels` / `_persist_user_project_labels` | system_db `query_studio_user_labels` JSONB 조회·저장 (user_id+project_info_id별) |
| `_resolve_table_display_label` | 유저 JSON → table_master 메타 → 파일 → DEFAULT_TABLE_LABELS → 물리명 |
| `_resolve_column_display_label` | 유저 JSON → 파일 → 테이블별/공통 기본 → 물리명 |
| `_contains_dangerous_sql` | `core.sql_safety.contains_dangerous_sql`의 래퍼로, 디버그 로그를 추가한 뒤 동일 결과를 반환. `widget_board_server`도 동일 `core.sql_safety`를 사용한다 |
| `_fetch_relationships` | FK/추론 관계 조회. `project_info_id` 필수, 병합 허용 집합 기준 |
| `_compute_relationships_all_raw` | FK+추론 전체 관계 계산 (캐시 없음) |
| `_compute_relationships_all` | peak_guard 적용 래퍼 (TTL 캐시·세마포어). 관계 캐시·분석 스냅샷은 이 경로가 우선, `analysis_store`는 기존 호환 유지 |
| `_upsert_table_master_and_mapping` | table_master UPSERT + `table_project_mapping` 연결. feature_flags에 따라 `use_widgetboard_yn` 자동 결정 |
| `_save_table_worker` | 데몬 스레드: queued → running → CREATE TABLE AS → table_master upsert(3회 재시도) → completed/failed |

---

## 7. etl_server

파일·외부 DB → 저장 DB 적재, 변환 룰, Job 큐, SFTP/S3 **배치**(`/api/etl/batch`)까지 포함한 **ETL 백엔드 전역**이다.

### 7.0 호스트·라우터 (요약)

- **`main.py`**: `from Backend.etl_server import router as etl_router` 를 **한 번만** `include_router` 한다.
- **가드**: `dependencies=[Depends(require_etl_infrastructure)]` 가 **`/api/etl/*` 와 `/api/etl/batch/*` 전체**에 적용된다.
- **`router.py`**: `APIRouter(prefix="/api/etl")` + 내부에서 **`router_file.router`** (`prefix="/batch"`) 를 `include_router` → 실제 URL 은 `/api/etl/batch/*`. 별도 **`etl_file_router`** 는 없다.
- **세부 구현·DB 지원 표**: **02_BACKEND_GUIDE.md** §6.

### 7.1 Package overview

```
┌─────────────────────────────────────────────────────────────┐
│  etl_server (FastAPI)                                       │
│  router.py  prefix=/api/etl                                  │
│    └─ include_router(router_file) → /api/etl/batch/*        │
├─────────────────────────────────────────────────────────────┤
│  Meta·CRUD          │ service.py, service_file.py           │
│  HTTP (단일·배치)    │ router.py, router_file.py             │
│  적재               │ load_service.py, load_service_file.py   │
│                     │ db_load_service.py                      │
│  변환·검증         │ transform_engine.py                   │
│                     │ transform_rules_service.py            │
│                     │ transform_upsert_verification.py      │
│  배치 실행         │ batch_executor_db.py, batch_executor_file.py │
│  Job 큐            │ queue_worker.py                         │
│  폴더·스케줄       │ folder_adapter_file.py, scheduler_file.py │
│  미리보기·추론     │ preview_service.py, schema_infer.py    │
│  파일 입출력       │ csv_reader.py, parser_file.py            │
│  원장·한도·시간    │ table_master_hook.py, etl_limits.py, timezone_utils.py │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
              ETL 메타 DB (config `etl_db`, 예: ibank_etl_data)
              + system_db (table_master 등)
```

### 7.2 Router endpoints

**공통 가드**

- 아래 표에서 Guard 열을 생략한 행은 모두 **`require_etl_infrastructure`** 이다(`main.py` 에서 `etl_router` 일괄 Depends).
- 일부 핸들러는 `payload = Depends(require_etl_infrastructure)` 형태로 동일 가드를 명시할 수 있다.

#### A. `router.py` — `/api/etl` (DB·파일 ETL 메타·실행)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/etl` | 서비스 안내·대표 엔드포인트 목록·업로드 보존 일수 |
| GET | `/api/etl/tables` | `etl_tables` 목록 (파일 소스는 `preview_available`) |
| POST | `/api/etl/tables` | ETL 테이블 정의 등록 |
| PATCH | `/api/etl/tables/{etl_table_id}` | 테이블 설정 부분 갱신 |
| DELETE | `/api/etl/tables/{etl_table_id}` | ETL 테이블 삭제 (배치·원장 등 선행 검사) |
| POST | `/api/etl/tables/{etl_table_id}/refresh-column-mapping` | DB 소스 ETL의 `column_mapping`을 소스 테이블 컬럼·타입 기준으로 재조회·반영 |
| DELETE | `/api/etl/tables/{etl_table_id}/row` | `etl_tables` 등록 행만 삭제(메인 DB 타깃 물리 테이블은 유지) |
| POST | `/api/etl/upload` | 파일 업로드 (CSV·Excel·Parquet) |
| POST | `/api/etl/infer-schema` | 샘플 기반 스키마 추론 |
| POST | `/api/etl/tables/{etl_table_id}/add-file` | 기존 파일 ETL에 단일 파일 추가 적재 흐름 |
| POST | `/api/etl/tables/{etl_table_id}/add-files-zip` | ZIP 추가 적재 |
| GET | `/api/etl/timezones` | IANA 타임존 목록 |
| POST | `/api/etl/cleanup-expired-uploads` | 만료 업로드 정리 |
| POST | `/api/etl/connections` | 소스 DB 연결 등록 |
| GET | `/api/etl/connections` | 연결 목록 |
| POST | `/api/etl/connections/test` | 연결 테스트 |
| DELETE | `/api/etl/connections/{connection_id}` | 연결 삭제 |
| GET | `/api/etl/connections/{connection_id}/tables` | 소스 테이블 목록 |
| GET | `/api/etl/connections/{connection_id}/source-columns` | 소스 컬럼 메타 |
| GET | `/api/etl/connections/{connection_id}/source-indexes` | 소스 인덱스 |
| POST | `/api/etl/connections/{connection_id}/validate-incremental-column` | 증분 컬럼 검증 |
| GET | `/api/etl/tables/{etl_table_id}/transform-rules` | 변환 룰 목록 |
| POST | `/api/etl/transform-rules` | 변환 룰 생성 |
| PUT | `/api/etl/transform-rules/{rule_id}` | 변환 룰 수정 |
| DELETE | `/api/etl/transform-rules/{rule_id}` | 변환 룰 삭제 |
| GET | `/api/etl/storage-connections` | 저장 DB 연결 목록(내장 main·dash + 등록 연결) |
| POST | `/api/etl/storage-connections` | 저장 DB 연결 등록 |
| PATCH | `/api/etl/storage-connections/{storage_connection_id}` | 저장 연결 수정 |
| DELETE | `/api/etl/storage-connections/{storage_connection_id}` | 저장 연결 삭제 |
| POST | `/api/etl/storage-connections/test` | 저장 연결 테스트 |
| GET | `/api/etl/target-tables` | 적재 대상 DB의 테이블 목록 |
| GET | `/api/etl/target-columns` | 대상 테이블 컬럼 |
| GET | `/api/etl/tables/{etl_table_id}/target-exists` | 타깃 테이블 존재 여부 및 `sync_mode` 등 메타 |
| GET | `/api/etl/tables/{etl_table_id}/preview` | 변환 반영 미리보기 |
| POST | `/api/etl/transform/preview` | 룰·매핑만으로 변환 미리보기 |
| POST | `/api/etl/tables/{etl_table_id}/run` | 실행: 파일은 **동일 프로세스 스레드**, DB·추가적재는 **pending Job + queue_worker** |
| GET | `/api/etl/jobs` | Job 목록 (`etl_table_id`, `statuses` 필터) |
| GET | `/api/etl/jobs/{job_id}` | Job 단건 |
| DELETE | `/api/etl/jobs/{job_id}` | Job 삭제 |
| POST | `/api/etl/jobs/{job_id}/cancel` | 실행·대기 Job 취소 |

#### B. `router_file.py` — `/api/etl/batch` (SFTP·S3 폴더 배치)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/etl/batch` | 배치 API 안내 |
| GET | `/api/etl/batch/folder-connections` | 폴더 연결 목록 |
| POST | `/api/etl/batch/folder-connections` | 폴더 연결 등록 |
| PATCH | `/api/etl/batch/folder-connections/{folder_connection_id}` | 수정 |
| DELETE | `/api/etl/batch/folder-connections/{folder_connection_id}` | 삭제 |
| POST | `/api/etl/batch/folder-connections/test` | 연결 테스트 |
| GET | `/api/etl/batch/folder-connections/{folder_connection_id}/files` | 원격 파일 목록 |
| GET | `/api/etl/batch/folder-connections/{folder_connection_id}/patterns` | 패턴 목록 |
| GET | `/api/etl/batch/folder-connections/{folder_connection_id}/columns` | 컬럼 샘플 |
| GET | `/api/etl/batch/target-tables` | 배치 타깃 테이블 |
| GET | `/api/etl/batch/target-registry` | `etl_batch_target_registry` 목록 |
| DELETE | `/api/etl/batch/target-registry/{registry_id}` | 레지스트리 행 삭제 |
| GET | `/api/etl/batch/jobs` | 배치 Job 목록 |
| POST | `/api/etl/batch/jobs` | 배치 Job 생성 |
| POST | `/api/etl/batch/jobs/from-etl-table` | 기존 ETL 테이블에서 배치 Job 생성 |
| POST | `/api/etl/batch/jobs/validate-target` | 타깃 검증 |
| PATCH | `/api/etl/batch/jobs/{batch_job_id}` | 배치 Job 수정 |
| DELETE | `/api/etl/batch/jobs/{batch_job_id}` | 배치 Job 삭제 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/run-now` | 즉시 실행 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/toggle` | 활성/비활성 토글 |
| GET | `/api/etl/batch/jobs/{batch_job_id}/db-preview` | DB 배치 미리보기 |
| GET | `/api/etl/batch/jobs/{batch_job_id}/history` | 실행 이력 |
| GET | `/api/etl/batch/jobs/{batch_job_id}/history/{run_id}` | 이력 단건 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/history/{run_id}/cancel` | 실행 취소 |
| GET | `/api/etl/batch/jobs/{batch_job_id}/skipped-files/history` | 스킵 파일 이력 |
| GET | `/api/etl/batch/jobs/{batch_job_id}/skipped-files` | 스킵 파일 집계 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/skipped-files/delete` | 스킵 기록 정리 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/reset-ts` | 처리 시각 리셋 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/rollback-file` | 파일 단위 롤백 |
| POST | `/api/etl/batch/jobs/{batch_job_id}/clone` | Job 복제 |

### 7.3 Module map

| 모듈 | 역할 (요약) |
|------|-------------|
| `service.py` | `etl_connections`·`etl_tables`·`etl_jobs`·`etl_storage_connections` CRUD, 소스 테이블/컬럼/인덱스 조회, Job claim·진행, 동적 컬럼 존재 대응 INSERT/SELECT |
| `service_file.py` | `batch_folder_connections`(SFTP/S3)·`batch_jobs`·`batch_run_history`·`etl_batch_target_registry` 등 배치 메타·실행 이력·스킵/롤백 |
| `load_service.py` | 파일 → 파싱 → 변환 → **main_db** 대상 테이블 DROP/CREATE/INSERT, `run_file_upsert` |
| `load_service_file.py` | 배치·추가 적재 경로의 DataFrame 적재·UPSERT 보조 |
| `db_load_service.py` | PG/MySQL/Oracle 소스 → 저장 DB **full / incremental / diff**, COPY·staging·인덱스 생성 |
| `transform_engine.py` | `etl_transform_rules` 를 pandas DataFrame에 **선언적 오퍼레이션**으로 적용 (`apply_rules` 등). 컬럼 룰 카테고리는 `cleansing`, `type_cast`, `code_map`, `mapping`, `derived`, `masking`, `string`, `datetime`, `numeric` 등이며 행 룰은 `row`만 등록된다. **사용자 임의 코드 실행 경로·`_apply_custom_code` 는 없고**, 임의 Python `eval`도 없다 |
| `transform_rules_service.py` | 변환 룰 CRUD·조회 |
| `transform_upsert_verification.py` | 룰 출력과 적재 파이프라인 정합 검증(dry-run 등) |
| `preview_service.py` | 테이블·파일 미리보기, `transform/preview` 연동 |
| `schema_infer.py` | 업로드/샘플로부터 컬럼 타입 추론 |
| `csv_reader.py` / `parser_file.py` | CSV 견고 읽기, Excel/zip·배치 pending 파일 목록 |
| `queue_worker.py` | `etl_jobs` pending 선점(`SKIP LOCKED`)·동시 최대 3건·`run_db_load` / `run_file_load` / `run_file_upsert` 디스패치 |
| `batch_executor_db.py` / `batch_executor_file.py` | 스케줄러가 호출하는 배치 실행 본체(DB/파일) |
| `scheduler_file.py` | 앱 lifespan에서 기동, 활성 배치 Job 로드·주기 실행 |
| `folder_adapter_file.py` | SFTP/S3 어댑터(목록·다운로드·삭제) |
| `table_master_hook.py` | 적재 성공 후 `system_db.table_master` UPSERT (`db_type` main·dash) |
| `etl_limits.py` | 업로드 크기·적재 행·배치 크기 등 한도 (config 병합) |
| `timezone_utils.py` | 타임존 헬퍼 (`router` 의 `/timezones` 등과 연계) |
| `__init__.py` | 패키지에서 `router` 만 re-export (`main` 은 이것만 import) |

### 7.4 Key flows

#### DB ETL 실행 (요약)

```
Client          router.py                 service.py           queue_worker.py       db_load_service.py
   │ POST …/run  │                         │ insert_job(pending)│                     │
   │─────────────▶│                         │                    │                     │
   │◀ 202 pending │                         │                    │                     │
   │              │                         │     start_background_worker (필요 시)    │
   │              │                         │                    │ claim_next…       │
   │              │                         │                    │────────────────────▶│ run_db_load
   │              │                         │                    │                     │ (transform → COPY/Upsert)
   │              │                         │◀ update_job·table_master_hook ─────────────│
```

#### 파일 ETL (첫 적재)

```
Client POST …/run (source_type=file)
  → service.insert_job(running)
  → 동일 프로세스 Thread → _run_file_load_in_process → load_service.run_file_load (lazy import)
  → queue_worker 를 거치지 않음 — 업로드와 동일 프로세스에서 파일 접근 보장
  → (다중 워커와 파일 경로 불일치 방지)
```

#### 폴더 배치 (요약)

```
lifespan → scheduler_file.start_scheduler → batch_executor_*
  ↔ service_file (batch_jobs, run_history, skipped set)
  ↔ folder_adapter_file (원격 스캔)
```

### 7.5 Security and limits

- **가드 1 — ETL 인프라**: `require_etl_infrastructure` = `require_active_access` + `user_has_etl_infrastructure_access` (`sa_dev`·`etl_manager`·또는 `user_info.etl_yn=Y`). **`permissions.py`** 표는 **[§2.4](#24-jwtdepends엔드포인트-auth_server)**.
- **가드 2 — 프로젝트·메타**: ETL 메타는 JWT `project_info_id` 등과 조인·필터되는 쿼리 패턴을 따른다(상세는 `service.py`·`service_file.py`).
- **가드 3 — `etl_limits`**: 업로드 용량·적재 행·ZIP 추출·배치 크기 등. **쿼리 스튜디오 `peak_guard`**(엔드포인트당 분당 한도·동시 분석·TTL 캐시)와는 **별 모듈·별 설정**이다.
- **가드 4 — 데이터·SQL 안전**: `transform_engine` 은 **룰 타입별 pandas 처리**이며, 사용자 임의 코드 `eval` 샌드박스는 **구현되지 않음**. DB 적재는 파라미터화·COPY 경로 등으로 SQL 인젝션을 피하는 패턴을 사용한다(세부는 소스 주석·`core.sql_safety`는 주로 query_studio).

### 7.6 Related database tables

- **ETL 메타 DB** (`etl_db`): **04_DB_ARCHITECTURE.md** 의 `ibank_etl_data` 절을 본다.
- 아래는 **주요 엔터티 예시**다.

| 테이블(예) | 용도 |
|------------|------|
| `etl_connections` | 소스 DB 연결 |
| `etl_tables` | ETL 단위(소스·타깃·sync_mode·파일 경로·storage_connection_id 등) |
| `etl_transform_rules` | 테이블별 변환 룰 |
| `etl_jobs` | 실행 Job·상태·오류 메시지 |
| `etl_storage_connections` | 적재 대상 PostgreSQL 연결 |
| `batch_folder_connections` / `batch_jobs` / `batch_run_history` | 폴더 배치·실행 이력 |
| `etl_batch_target_registry` | 배치로 생성된 타깃 테이블 레지스트리 |

- **system_db**: 적재가 **내장 main·dash**에 완료되면 **`table_master`** 가 `table_master_hook` 으로 갱신된다.

---

*함수·엔드포인트 표는 **§1~§5** 각 절의 흐름도 바로 아래에 통합되어 있다.*

- **§5.3**: 캠페인 대시보드 HTTP 상세
- **§6.1~§6.3**: 알림 · 위젯 보드 · 쿼리 스튜디오
- **§6.0**: 패키지 한눈에(나머지 패키지 요약)
- **§7**: ETL 서버(`etl_server`) 전체
