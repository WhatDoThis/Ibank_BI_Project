# 백엔드 코드·API 통합 가이드

본 문서는 **`Backend/`** 이하 패키지의 **코드 파일(모듈) 단위 기능을 표로 요약**하고, **시스템·업무 흐름을 ASCII 도식**으로 정리하는 통합 레퍼런스다.  
**구성 원칙**: 백엔드 **동작 단위(호스트 앱 → auth → project → admin → 대시보드 등)** 로 큰 절을 나누고, **각 절에서는 흐름도 바로 아래에 그 흐름에 쓰이는 모듈·함수 표**를 둔다. (위에서 아래로 읽으면 API 한 줄의 원인을 같은 화면에서 따라갈 수 있게 한다.)  
디렉터리 트리·실행 방식·패키지 목록은 **02_BACKEND_GUIDE.md**, DB 스키마는 **04_DB_ARCHITECTURE.md**, 권한 모델은 **05_Permission_ARCHITECTURE.md**, AI 작업 분해는 **docs/report/03_AI_DEVELOP_GUIDE.md**를 병행한다.

---

## 문서 구성 (읽는 순서)

1. **[§1 API 호스트·공유 코어](#1-api-호스트공유-코어-api_server-core)** — 앱 기동, 로깅, DB 풀, `auth_config`·역할 코드
2. **[§2 auth_server](#2-auth_server-인증세션권한-게이트)** — 로그인·토큰·`require_active_access`·`require_permission`·refresh/정지 연동
3. **[§3 project_server](#3-project_server-프로젝트-목록선택초대-응답)** — 목록, `select`, 타부서 초대 수락·거절
4. **[§4 admin_server](#4-admin_server-조직프로젝트-관리)** — 초대~생성~멤버, 소유 가드, 이관·정지
5. **[§5 캠페인 대시보드](#5-캠페인-대시보드-campaign_dash--core)** — [§5.3 HTTP 라우터](#53-campaign_dash_serverrouterpy) · `dashboard_service`
6. **[§6 기타 패키지](#6-기타-패키지)** — [§6.1 알림](#61-notification_server) · [§6.2 위젯 보드 API](#62-widget_board_server) · 쿼리 스튜디오(`list-tables`·`describe-table`)·ETL 등

---

## 1. API 호스트·공유 코어 (`api_server`, `core`)

### 1.1 앱 기동 흐름

일반 로컬 기동은 **`python run.py back`** 이다. 아래는 **앱 조립 관점**의 순서이며, `api_server/main.py`를 **직접 실행**할 때는 [§2 로깅 초기화](#2-로깅-초기화-직접-실행-시)가 `uvicorn` 이전에 선행된다.

```
서버 시작 (python main.py 또는 run.py → main 진입)
│
▼
┌─────────────────────────────────────────────┐
│  config.json 로드                             │
│  ├─ main_db (비즈니스 데이터)                  │
│  ├─ system_db (인증·프로젝트·권한)             │
│  ├─ etl_db (ETL 메타)                         │
│  └─ dash_db (대시보드)                         │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  core/db.py — 4개 연결 풀 초기화              │
│  ├─ _MAIN_DB_POOL (main_db)                  │
│  ├─ _SYSTEM_DB_POOL (system_db)              │
│  ├─ _ETL_DB_POOL (etl_db)                    │
│  └─ _DASH_DB_POOL (dash_db)                  │
│  각 풀: min=1, max=20, ThreadedConnectionPool │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  FastAPI app 생성                              │
│  ├─ CORS 미들웨어 (allow_origins=["*"])       │
│  ├─ lifespan → ETL scheduler 기동             │
│  └─ 9개 라우터 등록:                           │
│     ├─ health_router        (인증 없음)       │
│     ├─ auth_router          (/api/auth)       │
│     ├─ project_router       (/api/projects)   │
│     ├─ notification_router  (/api/notifications)│
│     ├─ admin_router         (/api/admin)      │
│     ├─ query_studio_router  (/api/*)          │
│     ├─ etl_router           (/api/etl)        │
│     │   └─ Depends: require_etl_infrastructure│
│     ├─ campaign_dashboard   (/api/campaign-dashboard)│
│     │   └─ Depends: require_permission("dashboard")  │
│     └─ widget_board         (/api/widget-boards)     │
│         └─ Depends: require_permission("widgetboard") │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  uvicorn.run(host, port)                      │
│  → HTTP 요청 수신 대기                        │
└─────────────────────────────────────────────┘
```

#### `api_server/main.py`

| 함수 | 기능 |
|------|------|
| `lifespan` | 앱 시작 시 ETL 배치 스케줄러 기동 |
| `app` | FastAPI 인스턴스 생성, CORS, 9개 라우터 등록 |
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

---

### 1.2 로깅 초기화 (직접 실행 시)

`api_server/main.py` 의 **`__main__`** 은 **`core/logging_setup.configure_root_logging()`** 으로 루트 로깅을 구성한 뒤 config 로드·uvicorn을 실행한다.

```
python main.py (직접 실행)
│
▼
┌──────────────────────────────────────────┐
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
```

#### `core/db.py`

| 함수 | 기능 |
|------|------|
| `_PooledConnection` | 풀 연결 래퍼 (`close` → `putconn`) |
| `get_main_db_config` | `backend.main_db` 에서 메인 DB 연결 dict (블록 필수) |
| `get_system_db_config` | 시스템 DB 연결 dict |
| `get_etl_db_config` | ETL DB dict (없으면 system_db fallback) |
| `get_dash_db_config` | 대시보드 DB 연결 dict |
| `get_dash_table_schema` | `dash_db` 스키마명 (기본 `public`) |
| `get_system_table_schema` | ETL 스키마 우선, system_db fallback |
| `get_system_table_schema_core` | system_db 스키마 고정 반환 |
| `get_allowed_tables_by_project` | 프로젝트별 허용 테이블 (매핑 기반) |
| `get_allowed_tables` | `project_info_id` 필수, 매핑 기반(`get_allowed_tables_by_project`) |
| `get_table_schema` | `main_db.table_schema`(비면 `public`; `main_db` 없으면 오류) |
| `_table_exists` | 테이블 존재 여부 (내부) |
| `_query_table_columns` | 컬럼명 목록 조회 (내부) |
| `_query_primary_key_columns` | PK 컬럼 목록 조회 (내부) |
| `get_table_columns_with_types` | 컬럼명 + `data_type` 목록 |
| `get_all_tables_columns_with_types` | 복수 테이블 일괄 컬럼·타입(`project_info_id` 필수) |
| `get_table_columns_for_etl_target` | ETL 타겟 컬럼 (allowed 미검사) |
| `get_primary_key_columns_for_etl_target` | ETL 타겟 PK (allowed 미검사) |
| `get_db_connection` | 메인 DB 풀 연결 |
| `get_db_connection_etl` | ETL DB 풀 연결 |
| `get_db_connection_system` | ETL 호환 alias → etl 연결 |
| `get_db_connection_system_core` | system_db 고정 풀 연결 |
| `get_db_connection_dash` | 대시보드 DB 풀 연결 |
| `is_new_dash_physical_table` | `ibank_1` 계열 패턴 판별 |
| `validate_dashboard_data_table_name` | 대시보드 테이블명 검증 |
| `is_table_allowed_for_project_dashboard` | 프로젝트 대시보드 허용 여부 |
| `format_value` | datetime/decimal 등 JSON 직렬화 |
| `validate_table_name` | 이름 패턴 + 스키마 존재 검증 |
| `validate_column_name` | 컬럼명 패턴 검증 |

#### `core/sql_safety.py`

| 함수 | 기능 |
|------|------|
| `contains_dangerous_sql` | 세미콜론 분할 후 비SELECT 구간에서 DDL/DML 금지어 검사 — `query_studio_server` `_contains_dangerous_sql`·`widget_board_server` `fetch_widget_data`(query 타입) 공통 |

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

## 2. `auth_server` — 인증·세션·권한 게이트

### 2.1 로그인·토큰·로그아웃 (프로젝트 선택은 §3)

```
사용자
│
├─ 1. POST /api/auth/login ─────────────────────────────┐
│     { email, password }                                │
│                                                        ▼
│                              ┌──────────────────────────────┐
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
│  (홈에서 프로젝트 카드·JWT에 `project_info_id` 넣기 → §3 `POST …/select`)
│
├─ 3. 보호 API (Bearer access_token) ───────────────────┐
│                                                        ▼
│     ┌────────────────────────────────────────────────────┐
│     │  대부분: require_active_access                      │
│     │  ├─ get_access_payload (typ=access, JWT 검증)       │
│     │  └─ ensure_user_active_not_locked (system_db → 403) │
│     │                                                      │
│     │  분기:                                               │
│     │  ├─ /api/admin/* → get_authenticated_user_row        │
│     │  │   (동일·비활성·잠금 검사) → org/프로젝트 Depends   │
│     │  ├─ /api/etl/*   → require_etl_infrastructure        │
│     │  └─ 쿼리·대시·위젯 → require_permission("…")          │
│     └────────────────────────────────────────────────────┘
│
├─ 4. POST /api/auth/refresh ────────────────────────────┐
│                                                        ▼
│                              ┌──────────────────────────────┐
│                              │  refresh_session_tokens       │
│                              │  ├─ refresh JWT·session_log    │
│                              │  ├─ _fetch_dptmt_id_or_raise_ │
│                              │  │   inactive_locked          │
│                              │  └─ 새 access·refresh +       │
│                              │      session_log UPDATE        │
│                              └──────────────────────────────┘
│
└─ 5. POST /api/auth/logout ───────────────────────────┐
       (Depends: get_access_payload 만 — 정지 계정도 로그아웃) │
                                                        ▼
                               ┌──────────────────────────────┐
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
| `validate_password_strength` | 10자·대소문자·숫자·특수문자 정책 |
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

#### `auth_server/email_service.py`

| 함수 | 기능 |
|------|------|
| `send_email` | SMTP 발송 (미설정 시 로그 폴백) |
| `send_login_code_email` | 2차 인증 코드 메일 |
| `send_invite_email` | 초대 가입 URL 메일 |

#### `auth_server/service.py`

| 함수 | 기능 |
|------|------|
| `invite_validate_row` | 초대코드 행 조회 |
| `signup_with_invite` | 초대 기반 가입 |
| `create_org_and_user` | 부서 + sa 생성 |
| `login_send_code` | 1단계 로그인 |
| `_fetch_dptmt_id_or_raise_inactive_locked` | refresh·rotate 경로에서 비활성·잠금 검사 |
| `verify_login_complete` | 2단계 OTP 후 비활성·잠금 재확인, 세션·토큰 발급 |
| `refresh_session_tokens` | 슬라이딩 리프레시 + 비활성·잠금 거절 |
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
HTTP 요청
│
├─ POST /api/auth/logout
│  └─ get_access_payload (JWT만, 정지·잠금 계정도 세션 종료 가능)
│
├─ POST /api/auth/refresh
│  └─ 서비스 레이어에서 session + _fetch_dptmt_id_or_raise_inactive_locked
│
└─ 그 외 대부분의 보호 API
   │
   ▼
   require_active_access
   = get_access_payload + ensure_user_active_not_locked → 403
        │
        ├─ /api/admin/*     → get_authenticated_user_row → 역할·부서·프로젝트 Depends
        │
        ├─ /api/etl/*       → require_etl_infrastructure
        │                      (내부적으로 require_active_access)
        │                      + sa_dev | etl_manager | etl_yn=Y
        │
        └─ 프로젝트 기능 라우트 → require_permission("dashboard" 등)
                                 (내부적으로 require_active_access)
                                 + compute_effective_project_permission_ids
                                   (활성 프로젝트 · pmssn_list ∩ feature_flags)
```

#### 2.3.1 비활성·잠금 계정과 `require_active_access`

```
get_access_payload
  → JWT(typ=access)·exp·서명만 검증

ensure_user_active_not_locked
  → system_db에서 user_active_yn=Y, user_lock_yn≠Y 아니면 403

require_active_access
  = 위 두 단계 (대부분 보호 API의 Depends)

적용 예:
┌──────────────────────────────────────────────────┐
│  require_active_access 사용                       │
│  ├─ GET/PATCH /api/auth/me                        │
│  ├─ PATCH /api/auth/me/password                   │
│  ├─ GET /api/auth/me/login-history                │
│  ├─ require_permission (쿼리·대시보드·위젯)       │
│  ├─ require_etl_infrastructure (/api/etl/*)       │
│  └─ admin_server get_authenticated_user_row       │
└──────────────────────────────────────────────────┘

get_access_payload 만 (JWT만, 정지도 허용)
├─ POST /api/auth/logout
└─ POST /api/auth/refresh 는 엔드포인트 Depends는 유지하되,
   본문 처리에서 별도 비활성·잠금 검사
```

#### 2.3.2 `require_permission`과 `project.feature_flags`

```
require_permission("dashboard") 등
│
▼
┌──────────────────────────────────────────────────┐
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
```

#### 2.3.3 refresh·프로젝트 select·비활성·잠금

```
POST /api/auth/refresh
│
▼
┌──────────────────────────────────────────────────┐
│  refresh_session_tokens                           │
│  ├─ session_log·refresh JWT 검증                  │
│  ├─ _fetch_dptmt_id_or_raise_inactive_locked      │
│  │   ├─ user_active_yn ≠ Y → 거부                 │
│  │   └─ user_lock_yn = Y → 거부                   │
│  └─ 통과 시에만 새 access·refresh 발급            │
└──────────────────────────────────────────────────┘

POST /api/projects/{id}/select  (rotate)
│
▼
┌──────────────────────────────────────────────────┐
│  rotate_session_tokens_with_project               │
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
| `get_access_payload` | Bearer → access JWT payload 추출 (`typ=access`) |
| `ensure_user_active_not_locked` | `system_db`에서 `user_active_yn`·`user_lock_yn` 검사 → 비활성·잠금 시 403 |
| `require_active_access` | JWT 검증 + 활성·미잠금 (`get_access_payload` + `ensure_user_active_not_locked`) |

#### `auth_server/permissions.py`

| 함수 | 기능 |
|------|------|
| `get_user_dvsn_lower` | `user_id` → `user_dvsn` 소문자 |
| `user_has_etl_infrastructure_access` | `sa_dev`·원문 `etl_manager`·또는 `etl_yn=Y` |
| `is_project_participant` | 프로젝트 참여 여부 |
| `is_project_active` | `project_info.active_yn == Y` 확인 |
| `resolve_pmssn_list_to_names` | pmssn 리스트 → 이름 정규화 |
| `get_permission_ids_for_user_project` | 유저·프로젝트별 권한 ID 목록 |
| `_feature_flags_dict_to_ids` | `{query,dash,widget}` → 권한 ID `frozenset` |
| `get_project_enabled_feature_ids` | `project_info.feature_flags` → 허용 권한 ID 집합 |
| `compute_effective_project_permission_ids` | `pmssn_list` ∩ `feature_flags` (비활성 프로젝트 → 빈 집합) |
| `get_effective_permission_ids_for_me` | `/me`용 — `compute_effective_project_permission_ids` 호출 |
| `require_etl_infrastructure` | ETL 라우터 Depends — `require_active_access` + ETL 자격 |
| `require_permission` | 프로젝트 권한 Depends — `require_active_access` + `compute` + 비활성·기능 off 분기 |

#### `auth_server/router.py`

| 엔드포인트 | 기능 |
|------------|------|
| `POST /api/auth/signup` | 초대코드 기반 가입 |
| `POST /api/auth/create-org` | 부서 + sa 생성 |
| `POST /api/auth/login` | 1단계 로그인 |
| `POST /api/auth/verify-login` | 2단계 OTP 검증 |
| `POST /api/auth/refresh` | 토큰 리프레시 (서비스에서 비활성·잠금 검사) |
| `POST /api/auth/logout` | 세션 만료 (`get_access_payload` — 정지 계정도 로그아웃 가능) |
| `GET /api/auth/me` | 프로필+권한 (`require_active_access`) |
| `PATCH /api/auth/me` | 닉네임 (`require_active_access`) |
| `PATCH /api/auth/me/password` | 비밀번호 (`require_active_access`) |
| `GET /api/auth/me/login-history` | 로그인 이력 (`require_active_access`) |
| `GET /api/auth/invite/validate` | 초대코드 유효성 |

---

## 3. `project_server` — 프로젝트 목록·선택·초대 응답

### 3.1 프로젝트 선택 → 업무 진입

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

### 3.2 타부서 초대 수락·거절

```
초대받은 사용자 (알림 벨에서 project_invite 확인)
│
├─ [수락] POST /api/projects/{id}/accept-invite
│  body: { notification_info_id }
│  │
│  ▼
│  ┌──────────────────────────────────────────────────┐
│  │  [accept_project_invite]                          │
│  │  ① notification_info 조회 + 본인 확인              │
│  │  ② noti_content JSON 파싱                          │
│  │     { project_info_id, pmssn_master_id,            │
│  │       invite_user_id, invite_expires_at }          │
│  │  ③ invite_expires_at 만료? → ValueError            │
│  │  ④ project_info.active_yn = Y? → 비활성 거부       │
│  │  ⑤ 이미 멤버? → ValueError                         │
│  │  ⑥ _assert_pmssn_for_project (역할 정합)           │
│  │  ⑦ project_ptcpnt_info INSERT (멤버 등록)          │
│  │  ⑧ notification_info UPDATE (read_yn=Y)            │
│  │  ⑨ _notify_inviter_invite_resolved (수락 알림)     │
│  │     → 초대자에게 "OO님이 수락했습니다"              │
│  │  ⑩ 수락자 본인에게 참여 완료 알림                   │
│  │     → "프로젝트 참여가 완료되었습니다"              │
│  │  ⑪ COMMIT                                          │
│  └──────────────────────────────────────────────────┘
│
└─ [거절] POST /api/projects/{id}/reject-invite
   body: { notification_info_id }
   │
   ▼
   ┌──────────────────────────────────────────────────┐
   │  [reject_project_invite]                          │
   │  ① notification_info 조회 + 본인 확인              │
   │  ② noti_content JSON 파싱                          │
   │  ③ invite_expires_at 만료? → ValueError            │
   │  ④ 이미 멤버? → "알림을 닫아 주세요"               │
   │  ⑤ notification_info DELETE (알림 삭제)             │
   │  ⑥ _notify_inviter_invite_resolved (거절 알림)     │
   │     → 초대자에게 "OO님이 거절했습니다"              │
   │  ⑦ COMMIT                                          │
   └──────────────────────────────────────────────────┘
```

### 3.3 `project_server/router.py`

| 엔드포인트 | 기능 |
|------------|------|
| `GET /api/projects` | 내 참여 프로젝트 목록 (활성만) |
| `POST /api/projects/{id}/select` | 프로젝트 선택 → JWT 재발급 (`project_info_id` 포함) |
| `POST /api/projects/{id}/accept-invite` | 타부서 초대 수락 |
| `POST /api/projects/{id}/reject-invite` | 타부서 초대 거절 |

### 3.4 `project_server/service.py`

| 함수 | 기능 |
|------|------|
| `list_projects_for_user` | 참여 프로젝트 목록 (`active_yn=Y`, 역할명 포함) |
| `select_project_tokens` | `auth_service.rotate_session_tokens_with_project` 위임 |
| `_invite_expired_from_payload` | `invite_expires_at` ISO 파싱 → 만료 여부 |
| `_notify_inviter_invite_resolved` | 초대자에게 수락/거절 결과 알림 INSERT |
| `accept_project_invite` | 수락: 만료 검사 → 활성 확인 → 멤버 등록 → 알림 `read_yn` → 초대자 알림 → 수락자 참여 완료 알림 |
| `reject_project_invite` | 거절: 만료 검사 → 알림 DELETE → 초대자 거절 알림 |

---

## 4. `admin_server` — 조직·프로젝트 관리

### 4.0 연계 한눈에

```
[사용자 초대 ~ 프로젝트 업무까지]

조직 관리자(sa_dev·sa·a) 로그인
│
├─ 1. 사용자 초대 → POST /api/admin/users/invite → invite_user_by_email …
├─ 2. 가입 → POST /api/auth/signup → signup_with_invite …
├─ 3. 프로젝트 생성 → POST /api/admin/projects → create_project_full
│        (단일 트랜잭션: project_info + 생성자 pmssn + 매핑 + 부서 내 멤버 + 타부서 알림)
├─ 4. 이후 매핑/멤버 → POST …/projects/{id}/tables | …/members (add_member 분기)
├─ 5. 타부서 초대 수락 → POST /api/projects/{id}/accept-invite (project_server)
└─ 6. 프로젝트 카드 선택 → POST /api/projects/{id}/select → require_permission 업무 API
```

프로젝트 생성·멤버·소유 가드·이관·purge·부서 비활성 등 **세부 단계**는 아래 **§4.1** 을 본다.

---

### 4.1 상세 동작 흐름

#### A. 프로젝트 생성 전체 흐름 (`create_project_full`)

```
POST /api/admin/projects
│
▼
┌──────────────────────────────────────────────────┐
│  Depends: require_org_admin (sa_dev·sa·a)         │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  [create_project_full] — 단일 트랜잭션            │
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
│     table_master_ids 각각 검증 + INSERT             │
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

API·단계별 처리는 **§3.2** (`project_server` — `accept_project_invite` / `reject_project_invite`) 와 동일하다.

#### C. 멤버 추가 분기 (`add_member`)

```
POST /api/admin/projects/{id}/members
│
▼
┌──────────────────────────────────────────────────┐
│  [add_member]                                      │
│  ├─ 프로젝트 소유·pmssn 검증                       │
│  ├─ 본인 추가 불가                                  │
│  ├─ 이미 멤버 / 이미 초대 대기 중 확인              │
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
│  ① 대상 존재 + 부서 트리 검증                      │
│  ② 역할 제한 검증 (a→o·u만, sa→a·o·u만 등)       │
│                                                    │
│  ③ _evaluate_ownership_target_or_raise             │
│     (for_suspend=True)                             │
│     │                                              │
│     ├─ _collect_system_owned_for_guard             │
│     │   ├─ 생성 프로젝트 (project_create_user_id) │
│     │   ├─ 커스텀 pmssn (user_id)                  │
│     │   ├─ table_master (create_user_id)           │
│     │   ├─ 등록 부서 (dptmt_create_user_id)        │
│     │   └─ 초대자 참여 행 (invite_user_id≠자기)    │
│     │                                              │
│     ├─ _collect_etl_flat_for_guard                 │
│     │   (etl_db에서 create_user_id 기준 스캔)      │
│     │                                              │
│     └─ build_ownership_violation_payload            │
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
│  ④ suspend: user_active_yn='N' + 세션 무효          │
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
│  [transfer_resource_ownership]                     │
│  ├─ from·to 존재·부서 검증                         │
│  ├─ table_master 소유자 확인                        │
│  ├─ _table_master_recipient_eligible               │
│  │   ├─ sa_dev → 항상 OK                           │
│  │   ├─ 미매핑 → 수직 트리 sa·a만                  │
│  │   └─ 매핑 → 트리 sa·a 또는 참여+query.execute   │
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

#### I. 프로젝트 물리 삭제 (`purge`)

```
DELETE /api/admin/projects/{id}/purge
│
▼
┌──────────────────────────────────────────────────┐
│  [purge_inactive_project]                          │
│  ├─ active_yn = 'Y' → 거부 (먼저 비활성화)       │
│                                                    │
│  정리 순서 (단일 트랜잭션):                         │
│  ① notification_info DELETE                         │
│     (noti_type=project_invite, JSON의 pid 일치)    │
│  ② user_info.invite_project_info_id = NULL          │
│     (확장 컬럼 없으면 SAVEPOINT 스킵)              │
│  ③ email_invite_code_master.invite_project = NULL   │
│  ④ table_project_mapping DELETE                     │
│  ⑤ project_ptcpnt_info DELETE                       │
│  ⑥ project_info DELETE                              │
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
│  [list_members]                                    │
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

### 4.2 사용자 정지·이관 (개요)

```
관리자: 사용자 정지 시도
│
├─ 1. GET /api/admin/users/{id}/work-assets
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
├─ 2. 자산이 있으면 → 이관 먼저
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
│        └─ etl_* → ETL `create_user_id` UPDATE
│
└─ 3. 이관 완료 후 정지
      PATCH /api/admin/users/{id}/suspend
      │
      ▼
      suspend_user
      ├─ ownership_guards (409)
      ├─ user_active_yn = 'N'
      └─ invalidate_all_sessions(do_commit=False) → 단일 commit
```

> **보강**: 409·`blocking_assets`·일괄 변경은 **§4.1 D·E** 와 `ownership_guards.py` 를 본다. 정지 직후 세션 무효는 **§2.3.4** 와 맞춘다.

---

### 4.3 `admin_server` 모듈 (`deps` ~ `router`)

#### `admin_server/deps.py`

| 함수 | 기능 |
|------|------|
| `get_authenticated_user_row` | JWT → `user_id`·`user_dvsn`·`dptmt_info_id` + 비활성·잠금 거부(403) |
| `require_org_admin` | `sa_dev`·`sa`·`a`만 통과 |
| `require_super_admin` | `sa_dev`·`sa`만 통과 |
| `require_org_admin_or_operator` | 위 + `o` 통과 |
| `require_project_admin_or_operator_participant` | org 관리자는 소속 부서 프로젝트만, `o`는 참여자일 때만 |

#### `admin_server/schemas.py`

| 클래스 | 기능 |
|--------|------|
| `InviteBody` | 초대 (이메일·부서·역할·ETL·프로젝트) |
| `UserRoleBody` / `UserEtlYnBody` | 역할 변경 / ETL 자격 변경 |
| `ProjectFeatureFlags` | 프로젝트 기능 on/off (`query`·`dash`·`widget`) |
| `ProjectMemberAssignBody` | 멤버 지정 (`user_id` + `pmssn_master_id`) |
| `ProjectCreateBody` | 프로젝트 생성 (이름·설명·`feature_flags`·테이블·`creator_pmssn`·`members`·`external_invites`) |
| `ProjectUpdateBody` | 프로젝트 수정 (이름·설명·`active`·`feature_flags`·`table_master_ids`) |
| `AcceptProjectInviteBody` | 초대 수락/거절 (`notification_info_id`) |
| `MemberAddBody` / `MemberRoleBody` | 멤버 추가 / 역할 변경 |
| `RoleCreateBody` / `RoleUpdateBody` | 커스텀 역할 생성·수정 |
| `OrgPatchBody` | 부서명 수정 |
| `OrgDepartmentCreateBody` / `PatchBody` | 부서 생성·수정 (`migrate_users_to` 포함) |
| `TableMasterPatchBody` / `ProjectTableAddBody` | 테이블 마스터 수정 / 매핑 추가 |
| `TransferOwnershipBody` | 자산 이관 (`project_invite`·`dptmt_creator` 포함) |
| `UserManageUpdateBody` | 사용자 일괄 변경 (부서·역할·ETL·프로젝트) |

#### `admin_server/ownership_guards.py`

| 함수/클래스 | 기능 |
|-------------|------|
| `can_own_after_change` | 목표 역할·ETL 기준 리소스 소유 가능 여부 매트릭스 |
| `_reason_for_block` | 차단 사유 메시지 생성 |
| `ManagementBlockedError` | 409 응답용 예외 (payload dict) |
| `build_ownership_violation_payload` | 소유 스캔 → `changeable`·`blocking`·`allowed` 구조화 |

#### `admin_server/service_users.py`

| 함수 | 기능 |
|------|------|
| `list_users_same_dept` | 동일 부서 유저 목록 |
| `list_users_for_admin_ui` | 관리 UI용 (`sa_dev` 전역, 그 외 트리·정렬) |
| `list_users_dept_tree_for_project_create` | 프로젝트 생성 모달용 (본인 제외·부서 트리) |
| `search_users_by_email` | 이메일 검색 (`exclude_dptmt_zero` 옵션) |
| `invite_user_by_email` | 초대 (역할·부서·ETL·프로젝트 검증) |
| `assert_invite_dptmt_allowed` | 초대 부서 트리 검증 |
| `list_departments_for_invite` | 초대 모달용 부서 목록 (`display_label`) |
| `suspend_user` | 정지 (`ownership_guards` 409 + 세션 무효) |
| `activate_user` | 활성 |
| `delete_inactive_user` | 비활성만 삭제 (409 가드 + 연관 행 정리 + DELETE) |
| `set_user_dvsn_admin_user` | 조직 역할 변경 |
| `set_user_etl_flag` | ETL 자격 (`N` 시 등록 건 검사) |
| `list_invite_codes_for_dept` | 초대코드 목록 |
| `get_department` / `update_department_name` | 부서 조회·이름 수정 |
| `list_departments_for_org_settings` | 부서 관리 목록 (`member_count`·`creator_email`·`display_label`) |
| `create_department` | 부서 추가 (`sa`는 하위만) |
| `update_department_in_org_settings` | 부서 수정 (`migrate_users` + 참조 검사) |
| `delete_department_in_org_settings` | 부서 삭제 (참조 검사) |
| `get_user_work_assets` | 자산 조회 (초대자 참여·등록 부서·ETL 연쇄 안내) |
| `list_ownership_transfer_targets` | 이관 후보 (수직 트리 branch CTE) |
| `list_department_creator_transfer_targets` | 부서 생성자 이관 후보 (`sa`·`sa_dev`만) |
| `list_table_master_transfer_targets` | 테이블 마스터 이관 후보 |
| `transfer_resource_ownership` | 이관 실행 (`project_invite`·`dptmt_creator`·ETL 연쇄 포함) |
| `get_user_change_options` | 변경 모달 옵션 (`can_manage_etl_yn`·마지막 SA 경고) |
| `update_user_management` | 일괄 변경 (`ownership_guards` 409·`u`→`etl_yn` `N`) |

#### `admin_server/service_roles.py`

| 함수 | 기능 |
|------|------|
| `list_roles_for_dept` | 시스템 기본 + 부서 커스텀 (`creator_email`·`usage_count`) |
| `list_permission_options_for_dept` | 부여 가능 권한 키 목록 |
| `list_role_usages` | 역할 사용 현황 (프로젝트·사용자) |
| `list_role_project_participants` | 역할·프로젝트별 참여자 |
| `list_user_role_usages` | 사용자별 프로젝트·역할 요약 |
| `create_custom_role` | 커스텀 역할 생성 |
| `update_custom_role` | 커스텀 역할 수정 (시스템 기본 불가) |
| `delete_custom_role` | 커스텀 역할 삭제 (사용 중 불가) |

#### `admin_server/service_projects.py`

| 함수 | 기능 |
|------|------|
| `normalize_feature_flags_for_db` | `feature_flags` → DB 저장용 `{query,dash,widget}` 정규화 |
| `_sync_project_table_mappings` | 매핑 집합을 요청 목록과 일치 (추가·삭제) |
| `_user_in_actor_dept_scope` | 부서 트리 소속 여부 (활성 사용자만) |
| `_actor_may_manage_system_dev_department_users` | `dptmt=0` 소속 관리 가능 여부 |
| `_assert_target_not_hidden_system_dev_member` | 일반 관리자가 개발 부서 계정 지정 차단 |
| `_assert_project_owned` | 부서 소유 + 활성 프로젝트 검증 |
| `_assert_member_list_allowed` | 멤버 목록 조회 권한 (타부서 `o` 참여자 허용) |
| `_assert_pmssn_for_project` | pmssn이 프로젝트 부서 것인지 확인 |
| `list_projects_in_dept` | 부서 소속 프로젝트 목록 (`creator_email` 포함) |
| `list_projects_for_participant` | 참여 프로젝트 목록 (역할명·`creator_email`) |
| `create_project_full` | **단일 트랜잭션**: `project_info` + creator 멤버 + 매핑 + 부서 내 멤버 + 타부서 알림 |
| `update_project` | 프로젝트 수정 (`feature_flags`·`table_master_ids` 동기화, `o` 제한) |
| `deactivate_project` | 소프트 삭제 (`active_yn=N`) |
| `purge_inactive_project` | 비활성만 물리 삭제 (알림·초대·매핑·참여 정리 후 DELETE) |
| `_list_pending_project_invites` | 미수락 `project_invite` 알림 목록 (만료 체크 포함) |
| `list_members` | 멤버 + `pending_invites` 통합 반환 |
| `cancel_project_invite` | 미수락 초대 알림 삭제 |
| `_pending_invite_for_user_project` | 중복 초대 확인 |
| `_notify_project_member_added_pair` | 멤버 추가 시 양방향 알림 |
| `_notify_project_member_removed_pair` | 멤버 제거 시 양방향 알림 |
| `add_member` | 부서 내 → 즉시 INSERT / 타부서 → `project_invite` 알림 |
| `update_member_role` | 멤버 역할 변경 (`o`는 `u`만) |
| `remove_member` | 멤버 제거 + 양방향 알림 (`o`는 `u`만) |
| `validate_invite_user_project` | 초대 시 프로젝트·pmssn 정합 검증 |

#### `admin_server/service_tables.py`

| 함수 | 기능 |
|------|------|
| `list_table_master` | 전사 테이블 목록 (`sort=project_create`: dash 우선·`update_dtm`) |
| `update_table_master` | 테이블 라벨·설명 수정 |
| `list_project_tables` | 프로젝트별 매핑 테이블 |
| `add_project_table_mapping` | 매핑 추가 |
| `delete_project_table_mapping` | 매핑 삭제 |

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
| `GET/POST /api/admin/projects` | 프로젝트 목록 / 생성 (`create_project_full`) |
| `PATCH /api/admin/projects/{id}` | 프로젝트 수정 (`feature_flags`·`table_master_ids` 동기화) |
| `DELETE /api/admin/projects/{id}` | 소프트 삭제 (비활성화) |
| `DELETE /api/admin/projects/{id}/purge` | 비활성 프로젝트 물리 삭제 |
| `GET /api/admin/invite-codes` | 초대코드 목록 |
| `GET /api/admin/tables`, `PATCH /api/admin/tables` | 테이블 마스터 (`sort=project_create`) |
| `GET/POST/DELETE /api/admin/projects/{id}/tables` | 테이블 매핑 |
| `GET /api/admin/projects/{id}/members` | 멤버 + `pending_invites` |
| `DELETE /api/admin/projects/{id}/invites/{nid}` | 타부서 초대 취소 |
| `POST /api/admin/projects/{id}/members` | 멤버 추가 (부서 내 즉시 / 타부서 알림) |
| `PATCH /api/admin/projects/{id}/members/{uid}` | 멤버 역할 변경 |
| `DELETE /api/admin/projects/{id}/members/{uid}` | 멤버 제거 |

---

## 5. 캠페인 대시보드 (`campaign_dash_server` + `core`)

### 5.1 데이터 흐름

```
프론트: 캠페인 대시보드 화면
│
├─ 1. 테이블 후보 조회
│     GET /api/campaign-dashboard/tables
│     │
│     ▼
│     get_aggregatable_tables(project_info_id)
│     ├─ get_allowed_tables_by_project (main ∪ dash)
│     └─ 각 테이블의 필수 컬럼·타입 검사
│        (DASHBOARD_REQUIRED_COLUMNS 11개)
│        → 통과한 테이블만 반환
│
├─ 2. 집계 데이터 조회
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
└─ 3. 차트 데이터 조회
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
| `get_aggregatable_tables` | 프로젝트별 대시보드 가능 테이블 필터 |
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

라우터 **`APIRouter(prefix="/api/campaign-dashboard", tags=["campaign-dashboard"])`**. 엔드포인트는 모두 **`GET`** 이고 **`require_permission("dashboard")`** 를 공통으로 쓴다( JWT·계정·프로젝트 활성·`pmssn_list` ∩ `feature_flags` 에 `dashboard` 포함 — **§2.3** 과 동일 패턴). DB는 **`db.get_db_connection_dash()`** 로 대시보드용 스키마에 접속한다.

#### 엔드포인트

| 메서드 | 경로 | 핵심 | 의존성 |
|--------|------|------|--------|
| `GET` | `/api/campaign-dashboard/tables` | `get_aggregatable_tables` 후 **`*_star_1` 접미사만** 드롭다운용 `{ tables: [{id,name}] }` | `require_permission("dashboard")` |
| `GET` | `/api/campaign-dashboard/summary` | KPI 집계 + 전기간 대비 **변동률**(`_calc_change_pct`) 병합 | 위와 동일 + `table_id`·`target_date`·`period` |
| `GET` | `/api/campaign-dashboard/trend` | 단일 지표 **일별** 추이, `days`(1~365)·`metric`, `end_date` — `dashboard_service.get_chart_data` | 위와 동일 |
| `GET` | `/api/campaign-dashboard/trend-multi` | **복수 기간** 추이(`daily`/`weekly`/`monthly`, `count`·`days`, `by_channel`) — 라우터 내 SQL | 위와 동일 |
| `GET` | `/api/campaign-dashboard/member-summary` | `_star_2` 스냅샷 1건(curr/prev)·JSONB 파싱·유입·이탈·순증감 | 위와 동일 |
| `GET` | `/api/campaign-dashboard/delivery-demographics` | `_star_1` 에서 grade/age/gender JSONB **SUM**, `by_channel` 시 채널별 | 위와 동일 |
| `GET` | `/api/campaign-dashboard/hourly` | 24슬롯 JSONB SUM, `metric`: success\|open\|click, `by_channel` 옵션 | 위와 동일 |

공통 쿼리 파라미터(일부 엔드포인트): `table_id`(필수), `target_date`/`end_date`(선택·미지정 시 오늘), `period` = `daily` \| `weekly` \| `monthly`.

#### 라우터 모듈 내부 함수 정리

| 함수 | 한 줄 설명 |
|------|------------|
| `_assert_campaign_table` | `project_info_id`·`table_id` 로 **`db.is_table_allowed_for_project_dashboard`** → 미매핑 시 **403** |
| `_require_star_fact_table` | `*_star_1` 접미사 + **`db.validate_dashboard_data_table_name`** |
| `_member_table_id_from_fact` | `_star_1` → 동일 접두의 **`_star_2`** 회원 테이블명(검증 포함) |
| `_quoted_table` | **`db.get_dash_table_schema()`** 기준 `"schema"."table"` 인용 |
| `_calc_date_range` | `target_date` + `period` → `[start, end]` (ISO) |
| `_calc_previous_range` | 현재 범위의 **직전 동일 길이** 기간 |
| `_calc_change_pct` | `(cur - prev) / prev × 100`, `prev` 없거나 0이면 `None` |
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
│  STEP 1: require_permission("dashboard")         │
│  ① JWT → user_id, project_info_id                │
│  ② 계정 활성·잠금 검사                            │
│  ③ 프로젝트 active_yn 검사                        │
│  ④ pmssn_list ∩ feature_flags → "dashboard"     │
├──────────────────────────────────────────────────┤
│  불포함 → 403                                     │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: GET /api/campaign-dashboard/tables       │
│  ① get_aggregatable_tables(project_info_id)       │
│  ② *_star_1 만 필터 → 테이블 드롭다운             │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 3: 사용자가 테이블 + 기간 선택              │
│  → table_id, target_date/end_date, period 등      │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 4: _assert_campaign_table                   │
│  ① is_table_allowed_for_project_dashboard         │
│  ② 미매핑 → 403                                   │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 5: _require_star_fact_table (팩트 기반 API) │
│  ① *_star_1 접미사 확인                           │
│  ② validate_dashboard_data_table_name             │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 6: 기간 계산                                │
│  _calc_date_range → [start, end]                  │
│  _calc_previous_range → 전기간 (summary 등)       │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 7: 엔드포인트별 분기                        │
│                                                   │
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
│  STEP 8: 응답                                     │
│  • JSON (kpi, rows, data, date_range, period …)   │
│  • member-summary: 행 없음 → 404 + error 메시지   │
│  • ValueError 등 → 400, 예외 → 500 (JSON error)   │
└──────────────────────────────────────────────────┘
```

#### 보안·데이터 격리 요약

```
  ┌─ 인증·인가 ──────────────────────────┐
  │  require_permission("dashboard")     │
  │  JWT + 활성 + 프로젝트 + feature_flags│
  └──────────────┬───────────────────────┘
                 ▼
  ┌─ 테이블 격리 ────────────────────────┐
  │  _assert_campaign_table                │
  │  project 대시보드 매핑 화이트리스트     │
  └──────────────┬───────────────────────┘
                 ▼
  ┌─ 테이블명 안전성 ───────────────────┐
  │  _require_star_fact_table            │
  │  validate_dashboard_data_table_name  │
  │  *_star_1 접미사 강제                │
  │  _quoted_table → "schema"."table"    │
  └─────────────────────────────────────┘
```

**설계 요약**: 읽기 전용 대시보드 API로 **`_star_1`(발송 팩트)** 와 **`_star_2`(회원 스냅샷)** 만 다룬다. 권한 → 프로젝트 매핑 → 식별자 검증에 더해 **`_star_1` 강제**로 임의 테이블 경로를 줄인다. `/summary`·`/trend` 는 **`dashboard_service`** 에 위임하고, demographics·hourly·member-summary·trend-multi 는 라우터에서 JSONB·SQL을 직접 구성하는 **하이브리드** 구조다.

---

## 6. 기타 패키지

- **`query_studio_server`**: `/api` 하위 쿼리 스튜디오·execute-query — **02_BACKEND_GUIDE.md**, `query_studio_server/router.py`. **`GET /api/list-tables`**: 현재 프로젝트의 **main·dash 매핑을 합친** 허용 테이블 목록(동일 `table_name`이 양쪽에 있으면 **main 메타 우선**). JSON에는 **`db_type` 키를 넣지 않음**(클라이언트는 “매핑된 테이블” 여부만 사용). **`POST /api/describe-table`**: 요청 테이블이 매핑된 쪽(**main 또는 dash**)을 판별해 해당 스키마의 `information_schema`로 컬럼을 조회한다. 선택 설정 **`backend.query_studio_peak_guard`** 가 있으면 `GET /api/table-relationships?mode=all`·`POST /api/join-order`·`POST /api/execute-query`에 분당 한도(슬라이딩 60초)·관계 전체 계산 동시 상한·관계 결과 TTL 인메모리 캐시를 적용하며, 한도 초과 시 **429**(`Retry-After`)·동시 상한 대기 초과 시 **503**을 반환할 수 있다(`peak_guard.py`).
- **`etl_server`**: `/api/etl`, `/api/etl/batch`, `require_etl_infrastructure` — **02_BACKEND_GUIDE.md**, `etl_server/router.py`·`router_file.py`.
- **`notification_server`**: **§6.1** — HTTP는 목록·카운트·읽음만; 생성은 `service.insert_notification` 내부 호출 — `notification_server/router.py`·`service.py`.
- **`campaign_dash_server`**: **§5.1** 흐름 개요 · **§5.3** 엔드포인트·내부함수·보안 — `campaign_dash_server/router.py` · **02_BACKEND_GUIDE.md** 병행.
- **`widget_board_server`**: **§6.2** — `system_db` 메타·`/api/widget-boards`(초대·참여자·공유 포함) — `widget_board_server/router.py` · 설계 **docs/report/20_Widget_Board_System_Design.md**.

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
| `mark_read_one` | `notification_info_id` + `user_id` 로 단건 `read_yn='Y'`, `update_dtm=NOW()` |
| `mark_read_all` | `user_id` 기준 미읽음 전부 동일 갱신, 변경 행 수 반환 |
| `insert_notification` | admin·project 등 **다른 서버에서 내부 호출**, `notification_info` INSERT 후 PK 반환 |

#### 동작 흐름 (벨·패널 등)

```
사용자 액션 (벨 아이콘 클릭 등)
│
▼
┌──────────────────────────────────────────────┐
│  STEP 1: require_active_access               │
│  auth_server/deps.py                         │
│  ① Bearer JWT 검증 (typ=access, exp)         │
│  ② system_db → user_active_yn, user_lock_yn  │
│  ③ 비활성·잠금 → 403                         │
├──────────────────────────────────────────────┤
│  통과 → payload["user_id"] 추출              │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 2: 엔드포인트 분기                      │
│                                              │
│  GET  /api/notifications     → list_notifications │
│  GET  /unread-count          → count_unread  │
│  PATCH /read-all             → mark_read_all │
│  PATCH /{id}/read            → mark_read_one │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 3: service 함수 실행                    │
│  ① system_db.notification_info 직접 조회/갱신 │
│  ② WHERE user_id = 본인 (타인 알림 접근 불가) │
│  ③ 갱신 시 commit, 실패 시 rollback           │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│  STEP 4: 응답                                 │
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
│  • 초대 발송                 │──┐
│  • 정지/활성화 통보          │  │
│  • 역할 변경 통보            │  │
├─────────────────────────────┤  │    ┌───────────────────────────┐
│  project_server             │  ├──▶ │  insert_notification()    │
│  • 프로젝트 초대             │  │    │  notification_info INSERT │
│  • 초대 수락/거절 결과 통보  │──┘    │  → PK 반환               │
└─────────────────────────────┘       └───────────────────────────┘
```

**설계 요약**: HTTP 라우터는 **조회·카운트·읽음 처리**만 담당하고, **알림 적재 책임은 호출 측(admin·project 등)** 에 둔다. `insert_notification` 은 `service` 에만 있고 라우터에 노출되지 않으므로 **외부 HTTP로 알림 직접 생성은 불가**하다.

---

### 6.2 `widget_board_server`

라우터 **`APIRouter(prefix="/api/widget-boards", tags=["widget-boards"])`**. `api_server/main.py` 에서 **`include_router(..., dependencies=[Depends(require_permission("widgetboard"))])`** 로 등록된다. JWT에 **`project_info_id`(작업 프로젝트)** 가 있어야 한다(없으면 **403**). **메타·레이아웃**은 **`get_system_db`** (`ibank_system_data` 등)의 `widget_board`, `widget_item`, `widget_board_share`.

**접근 정책**: 보드를 **읽을** 수 있는 주체는 (1) **소유자**, (2) **`widget_board_share`에 등록된 사용자**, (3) **`share_scope = project`** 이고 동일 프로젝트 **`project_ptcpnt_info` 참여자**인 경우(읽기 전용 캔버스). **편집**은 소유자 또는 `widget_board_share.can_edit = true` 인 사용자만. **`share_scope`** 는 `POST`/`PATCH` 바디에서 **`private`**(기본·초대·공유 행 위주) 또는 **`project`** 로 설정하며, 스키마·`widget_board_server/service.py`·목록 UI와 정합된다. **초대**는 **`widget_board_invite` 알림** → 수락 시 `widget_board_share` 행이 생기는 흐름을 병행한다. 목록 API는 `share_scope=project` 인 보드 중 **위젯보드 권한이 없는** 비공유 참여자에게는 노출하지 않도록 필터한다(`list_boards`).

**위젯 데이터**(`saved_table` / `query`): 소스 테이블·쿼리는 **현재 프로젝트에 매핑된 리소스만** 허용한다. **`table_project_mapping`의 main·dash** 를 모두 고려해 허용 여부와 **조회 시 DB 연결(main vs dash 스키마)** 을 고른다. SQL 금지어 검사는 **`Backend.core.sql_safety`** 를 `query_studio_server` 와 공유한다(구 `widget_board_server/sql_safety.py` 없음).

#### `router.py` — 엔드포인트

| 메서드 | 경로 | 핵심 |
|--------|------|------|
| `GET` | `/api/widget-boards` | 접근 가능 보드 목록 `{ items }` (`is_owner`, `can_edit`, `owner`, `participant_count`, `widget_item_count` 등 — 알림 건수 필드 없음) |
| `POST` | `/api/widget-boards` | 보드 생성 |
| `GET` | `/api/widget-boards/{board_id}` | 보드 상세 + 위젯 + **`can_edit`** |
| `GET` | `/api/widget-boards/{board_id}/participants` | 참여자·공유 대상 목록 |
| `GET` | `/api/widget-boards/{board_id}/invite-candidates` | 초대 후보(같은 프로젝트 등 정책 반영) |
| `PATCH` | `/api/widget-boards/{board_id}` | 보드 메타(비활성 보드는 소유자만 일부 수정) |
| `DELETE` | `/api/widget-boards/{board_id}` | **비활성** 보드만 물리 삭제(위젯·공유·관련 알림 정리 후 행 삭제). **활성이면 400** |
| `POST` | `/api/widget-boards/{board_id}/widgets` | 위젯 추가(`create_user_id` 등 메타 반영) |
| `PATCH` | `/api/widget-boards/{board_id}/widgets/{widget_id}` | 위젯 패치 |
| `DELETE` | `/api/widget-boards/{board_id}/widgets/{widget_id}` | 위젯 비활성 |
| `PATCH` | `/api/widget-boards/{board_id}/layout` | 다건 `layout_x/y/w/h` |
| `POST` | `/api/widget-boards/{board_id}/invite-notifications` | 초대 알림 일괄 발송 |
| `POST` | `/api/widget-boards/{board_id}/accept-invite` | 알림 ID 기준 초대 수락 → 공유 |
| `POST` | `/api/widget-boards/{board_id}/reject-invite` | 초대 거절 |
| `POST` | `/api/widget-boards/{board_id}/share` | 지정 사용자 공유 upsert(커스텀 공유) |
| `DELETE` | `/api/widget-boards/{board_id}/share/{shared_user_id}` | 공유 제거 |
| `POST` | `/api/widget-boards/{board_id}/widgets/{widget_id}/data` | 위젯 데이터(SELECT·기간·한도 — `data_config` 정책은 서비스·FE 마법사와 정합) |

프론트: **`Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx`**(캔버스), **`WidgetboardListPage.jsx`**(목록), **`api/widgetBoardClient.js`**. 설계 상세는 **docs/report/20_Widget_Board_System_Design.md**.

---

*함수·엔드포인트 표는 **§1~§5** 각 절의 흐름도 바로 아래에 통합되어 있다. 캠페인 대시보드 HTTP 상세는 **§5.3**, 알림은 **§6.1**, 위젯 보드(서버·초대·공유)는 **§6.2**, 그 외 **§6** 은 패키지 안내다.*
