# 21. 백엔드 패키지 리팩터링 인벤토리·체크리스트

**한 줄 요약**: `api_server/main.py`에 붙은 런타임만 “살아 있는 표면”으로 보고, 패키지·파일·잔재·연동 경로를 **섹션 단위로** 정리한 리팩터링 작업서.

---

## 목차

| 구분 | 섹션 | 작업 단위 |
|------|------|-----------|
| 공통 | [§0 메타](#0-문서-메타) | 범위·교차 참조 |
| 공통 | [§1 원칙](#1-리팩터링-원칙) | 품질 기준 |
| 공통 | [§2 전수검사](#2-전수검사-방법) | 절차 |
| 공통 | [§3 글로벌 체크리스트](#3-글로벌-체크리스트) | 전 패키지 공통 확인 |
| 공통 | [§4 런타임 조립](#4-http-런타임-조립) | `main.py` |
| 패키지 | [§5 core](#5-backendcore) | DB·deps·대시보드·SQL 등 |
| 패키지 | [§6 api_server](#6-backendapi_server) | 앱 진입·health |
| 패키지 | [§7 auth_server](#7-backendauth_server) | 인증·권한·§7.1 라우터↔service 표·§7.2 JWT/feature_flags/FE |
| 패키지 | [§8 admin_server](#8-backendadmin_server) | 어드민 API·§8.1 도메인→service·§8.2 409 계약·§8.3 router 분할 판단 |
| 패키지 | [§9 notification_server](#9-backendnotification_server) | 알림·§9.1 HTTP→service·§9.2 적재 경로·§9.3 404 |
| 패키지 | [§10 project_server](#10-backendproject_server) | 프로젝트 |
| 패키지 | [§11 campaign_dash_server](#11-backendcampaign_dash_server) | 캠페인 대시보드 |
| 패키지 | [§12 query_studio_server](#12-backendquery_studio_server) | 쿼리 스튜디오 |
| 패키지 | [§13 widget_board_server](#13-backendwidget_board_server) | 위젯 보드 |
| 횡단 | [§14 미등록 패키지](#14-미등록·보존-패키지) | 삭제/연결 결정 |
| 횡단 | [§15 제거·통합 후보](#15-제거·통합-후보) | 우선순위 |
| 실행 | [§16 단계별 로드맵](#16-단계별-실행-로드맵) | Phase A–D |
| 부록 | [§17 부록](#17-부록) | 스크립트·스모크 |
| 부록 | [§18 문서 이력](#18-문서-이력) | 유지보수 주의 |

---

## 0. 문서 메타

**목적**  
지정 패키지의 기능·함수·잔재를 정리하고, 리팩터 후에도 **동작 보존·최소 구성·명확성**을 유지한다.

**본 문서 범위(패키지)**  
`Backend/core`, `Backend/api_server`, `Backend/auth_server`, `Backend/admin_server`, `Backend/notification_server`, `Backend/project_server`, `Backend/campaign_dash_server`, `Backend/query_studio_server`, `Backend/widget_board_server`

**범위 밖(별도 문서 권장)**  
`Backend/etl_server` 단일 스택 — 절차는 동일하나 **22번대** 문서로 분리.

**교차 참조**  
`docs/main/02_BACKEND_GUIDE.md`, `docs/main/03_API_GUIDE.md`, `docs/main/04_DB_ARCHITECTURE.md`, `docs/main/05_Permission_ARCHITECTURE.md`, `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`, `docs/report/20_Widget_Board_System_Design.md`

---

## 1. 리팩터링 원칙

| 원칙 | 검증 방법 |
|------|-----------|
| 시스템 기능 이상 없음 | 핵심 플로우·API 스모크·회귀(§17) |
| 흐름상 에러 없음 | 로그인→프로젝트→권한별 화면, 403/404 의도 일치 |
| 과거 잔재 제거 | `main` 미등록 라우터, 무인자 `get_allowed_tables()` 등 |
| 최소·명확 | 불필요 폴백·옵션 확장 금지, 현 제품 경로만 |

### 1.1 패키지–테이블 소유 (DML 경계)

시스템 확장 시 역할이 섞이지 않도록, **테이블(또는 동일 도메인 묶음) 단위로 SQL 소유 패키지를 하나** 둔다.

| 규칙 | 설명 |
|------|------|
| 소유 `service` | 해당 테이블을 **직접** 건드리는 `INSERT`/`UPDATE`/`DELETE`와, 그 테이블만을 주대상으로 한 조회 구문은 **소유 패키지**에만 둔다. |
| 타 패키지 | 같은 트랜잭션에서 끼워 넣어야 하면 소유 측의 **`*_in_txn`**, **`fetch_*`** 를 호출한다( `commit`/`rollback`은 호출자가 유지). |
| HTTP 라우터 | 라우팅·권한 검사만 두고, 테이블 접근은 해당 패키지 `service`로 위임한다. |
| 다른 테이블로 확장 시 | 동일 원칙을 적용하고, 전수는 `rg "FROM that_table|INTO that_table|UPDATE that_table"` 등으로 주기적으로 확인한다. |

**적용 예(2026-04-13)**: `notification_info` 의 모든 DML·해당 전용 조회는 `notification_server/service.py` 에만 두고, 프로젝트·어드민·위젯보드는 헬퍼 호출만 한다.

---

## 2. 전수검사 방법

1. **런타임 경계**: `Backend/api_server/main.py` 의 `include_router` = 공개 HTTP 표면.
2. **함수 목록**: 패키지별 `*.py`에서 `^def ` / `^async def ` 추출.
3. **참조 검색**: `Backend/`, `scripts/`, `tests/` 에서 식별자 검색(동명·문자열 오탐 주의).
4. **라우터→서비스**: `router.py` 엔드포인트 ↔ `service` 함수 1:1 표.
5. **프론트**: `packages/*/api/*Client.js`, `shared/api/http.js`, `app/routes.jsx`.

---

## 3. 글로벌 체크리스트

- [x] `main` 에 포함되지 않는 레거시 대시보드 패키지 — **삭제 완료**(2026-04-13).
- [x] `get_allowed_tables()` **무인자** 분기 제거, `project_info_id` 필수(§5).
- [x] `query_studio` 관계/JOIN/order가 JWT 프로젝트와 **동일 허용 집합**을 쓰는가.
- [x] `get_main_db_config` / `system_db` / `dash_db` / `etl_db` / `query_studio_peak_guard` 가 **config.json.example·`02_BACKEND_GUIDE` §3** 와 키 구조 일치(2026-04-13 점검).
- [x] `require_*` 변경 시 **모든 라우터** 재스캔했는가(2026-04-13, §4.1 표·ETL `router_file` 포함).
- [x] 위젯보드 **`share_scope`(private|project)** — **schemas·service·FE·`03_API_GUIDE` §6.2** 정합(과거 “폐기·무시” 문구 제거, 2026-04-13).
- [ ] §17 스모크를 통과·기록했는가.

---

## 4. HTTP 런타임 조립

**파일**: `Backend/api_server/main.py`

**등록 라우터(요약)**  
`health`, `auth`, `project`, `notification`, `admin`, `query_studio`(`/api`), `etl`, `campaign_dashboard`, `widget_board`

| 구분 | 경로 | 조치 |
|------|------|------|
| ~~미등록 대시보드~~ | ~~`legacy_dashboard_server`, `new_dash_server`, `new_dash_server2`~~ | **삭제됨**(저장소에서 제거, 문서 정합) |

### 4.1 Depends·`require_*` 인벤토리 (재스캔 기준)

`permissions.require_permission` / `require_etl_infrastructure` / `deps.require_active_access` / `admin_server.deps.*` / `get_access_payload` 가 바뀌면 아래 **등록 라우터 전부**와 `auth_server/permissions.py`·`auth_server/deps.py`·`admin_server/deps.py` 를 다시 대조한다. (`etl_server/router.py` 가 `router_file` 을 include 하므로 배치 API 포함.)

| 등록 소스 (`main.py`) | HTTP prefix | 라우터 단 `dependencies` (`main`) | 엔드포인트별 Depends(요약) |
|----------------------|-------------|-----------------------------------|-----------------------------|
| `health_router` | `/`, `/health`, `/api`, `/api/` | 없음 | `get_db`: `/health` 만 |
| `auth_router` | `/api/auth` | 없음 | 공개: signup·create-org·login·verify-login·refresh·`/invite/validate` (`get_system_db`). `get_access_payload`: logout. `require_active_access`: `/me`, PATCH `/me`, `/me/password`, `/me/login-history` |
| `project_router` | `/api/projects` | 없음 | 전 엔드포인트 `require_active_access` |
| `notification_router` | `/api/notifications` | 없음 | 전 엔드포인트 `require_active_access` |
| `admin_router` | `/api/admin` | 없음 | `require_org_admin`, `require_super_admin`, `require_project_admin_or_operator_participant` (엔드포인트별) |
| `query_studio_router` | `/api/*` (쿼리 스튜디오 경로) | 없음 | `require_query_read_perm` / `require_query_execute_perm` (= `require_permission("query.read"|"query.execute")`) |
| `etl_router` (+ `router_file`) | `/api/etl`, `/api/etl/batch/…` | `Depends(require_etl_infrastructure)` | 보호 엔드포인트는 추가로 `require_etl_infrastructure` (라우터 단과 중복 허용) |
| `campaign_dashboard_router` | `/api/campaign-dashboard` | `Depends(require_permission("dashboard"))` | GET 계열에 동일 `require_permission("dashboard")` |
| `widget_board_router` | `/api/widget-boards` | `Depends(require_permission("widgetboard"))` | 전 엔드포인트 `require_permission("widgetboard")` |

**구현 참고**: `require_permission`·`require_etl_infrastructure` 는 내부에서 `require_active_access` 에 의존한다(`auth_server/permissions.py`).

---

## 5. `Backend/core`

**이 섹션에서 할 일**: 연결·허용 테이블 정책·대시보드 SQL 헬퍼를 한 번에 검토한다.

### 5.1 파일 맵

| 파일 | 역할 |
|------|------|
| `db.py` | 메인·시스템·ETL·dash 연결, 허용 테이블, 검증, 풀 |
| `dependencies.py` | `get_db`, `get_system_db` |
| `auth_config.py` | SMTP·app_url·JWT 설정 읽기 |
| `logging_setup.py` | 루트 로깅 |
| `dashboard_service.py` | 캠페인 대시보드 집계 |
| `sql_safety.py` | 금지 SQL (`query_studio`·`widget_board` 공유) |
| `user_dvsn_codes.py` | 부서/역할 코드 |
| `invite_expiry.py` | `noti_content` 등의 `invite_expires_at`(UTC ISO) 만료 판별 — 프로젝트·위젯보드·어드민 초대 UI 공유 |

### 5.2 `db.py` 함수 인벤토리(요약)

| 구간 | 내용 | 리팩터 메모 |
|------|------|-------------|
| 설정 | `get_main_db_config`, `get_system_db_config`, `get_etl_db_config`, `get_dash_db_config`, 스키마 헬퍼 | 명명 통일됨 |
| 허용 테이블 | `get_allowed_tables_by_project` (**정본**), `get_allowed_tables` (**project_info_id 필수**) | 무인자 스키마 전체 분기 제거됨 |
| 메타 | (구) `get_table_columns` 등 | Phase C에서 미참조 제거됨 |
| 연결 | `get_db_connection*`, 풀 | 광범위 사용 |
| 검증 | `validate_*`, `format_value`, `is_new_dash_physical_table` 등 | 대시보드·쿼리와 연동 |

### 5.3 무인자 `get_allowed_tables()` (종료)

레거시 무인자 분기는 제거되었다. `get_allowed_tables`·`get_all_tables_columns_with_types`·`_fetch_relationships`는 **`project_info_id` 필수** 경로만 사용한다.

### 5.4 연관 경로

`Frontend/.../query_studio`, `docs/main/03_API_GUIDE.md`, `tests/test_query_studio_api.py`(있을 경우)

### 5.5 이 섹션 전용 체크리스트

- [x] 무인자 분기 제거, `project_info_id` 필수화
- [x] `get_all_tables_columns_with_types` 시그니처/호출부 정합
- [x] 미사용 `get_table_columns` 등 제거(Phase C)

---

## 6. `Backend/api_server`

**이 섹션에서 할 일**: 앱 셸·CORS·라우터 마운트·기동 출력만 다룬다.

| 파일 | 내용 | 비고 |
|------|------|------|
| `main.py` | `lifespan`, `app`, 예외 핸들러, `include_router` | 기동 배너는 스키마 전체 테이블 수 미사용 |
| `routers/health.py` | 헬스·`/api` 인덱스 | `get_db` (`/health`만) |
| `routers/__init__.py` | `query_studio` re-export | |

### 이 섹션 전용 체크리스트

- [x] 기동 배너: 스키마 전체 테이블 수 미표시(연결·안내 문구만)
- [x] `lifespan` 스케줄러 기동 실패: `pass` 제거 → `logger.exception` 후 API 기동 유지(2026-04-13)
- [x] `GET /api`·`/api/` 인덱스 JSON이 `main.py` 등록 라우터 범위와 요약 정합(2026-04-13)

---

## 7. `Backend/auth_server`

**이 섹션에서 할 일**: 인증·권한 게이트와 설정 읽기 경로를 맞춘다.

| 파일 | 역할 |
|------|------|
| `router.py` | HTTP 엔드포인트 |
| `service.py` | 로그인·토큰·사용자 |
| `deps.py` | `require_active_access` |
| `permissions.py` | `require_permission`, `require_etl_infrastructure` |
| `security.py` | 암호·JWT |
| `email_service.py` | SMTP |
| `schemas.py` | DTO |

### 연관 경로


`core/auth_config.py`, `core/dependencies.py`, `core/user_dvsn_codes.py`, `Frontend/.../auth`, `03_API_GUIDE.md` §2

### 7.1 `router.py` → `service`·권한 매핑 (인벤토리 표)

스프레드시트 대신 **본 표를 단일 소스**로 둔다. 엔드포인트 추가 시 여기와 `router.py` docstring을 함께 갱신한다.

| HTTP | 경로 | 라우터 함수 | 주요 호출 |
|------|------|-------------|-----------|
| POST | `/api/auth/signup` | `auth_signup` | `service.signup_with_invite` |
| POST | `/api/auth/create-org` | `auth_create_org` | `service.create_org_and_user` |
| POST | `/api/auth/login` | `auth_login` | `service.login_send_code` |
| POST | `/api/auth/verify-login` | `auth_verify_login` | `service.verify_login_complete` |
| POST | `/api/auth/refresh` | `auth_refresh` | `service.refresh_session_tokens` |
| POST | `/api/auth/logout` | `auth_logout` | `service.logout_one_session` (`get_access_payload`) |
| GET | `/api/auth/me` | `auth_me` | `service.get_user_profile` + `permissions.get_effective_permission_ids_for_me` (`require_active_access`) |
| PATCH | `/api/auth/me` | `auth_patch_me` | `service.update_user_nickname` |
| PATCH | `/api/auth/me/password` | `auth_password` | `service.change_password` |
| GET | `/api/auth/me/login-history` | `auth_login_history` | `service.fetch_login_history_masked` |
| GET | `/api/auth/invite/validate` | `auth_invite_validate` | `service.invite_validate_row` (라우터에서 `valid`/`reason` 조립) |

**참고 (auth `service`이나 `/api/auth` 라우터 밖)**  
- 프로젝트 선택 시 토큰 재발급: `project_server` → `auth_server.service.rotate_session_tokens_with_project` (JWT의 `project_info_id` 갱신).  
- 사용자 정지 등 전 세션 무효: `admin_server.service_users` → `auth_server.service.invalidate_all_sessions` (지연 import).

### 7.2 JWT 클레임·`feature_flags`·프론트 `AuthContext`

**JWT(access / refresh)** — `security.create_access_token` / `create_refresh_token` 기준. `feature_flags`는 **JWT에 넣지 않는다**.

| 클레임 | 의미 |
|--------|------|
| `typ` | `access` 또는 `refresh` |
| `user_id` | 사용자 PK |
| `dptmt_info_id` | 부서 PK(access만) |
| `session_log_id` | 세션 로그 PK |
| `project_info_id` | 선택된 작업 프로젝트(없을 수 있음) |
| `exp` | 만료 시각 |

**`feature_flags`와 `/me`**  
- 프로젝트 기능 on/off는 DB `project_info.feature_flags`(JSONB)에만 있다.  
- `GET /api/auth/me`는 `get_user_profile`으로 `etl_yn` 등을 읽고, JWT의 `project_info_id`가 있으면 `permissions.get_effective_permission_ids_for_me`로 **`pmssn_list` 정규화 ∩ `feature_flags` 허용 집합**을 매 요청 계산해 `permissions` 배열로 내려준다(03_API_GUIDE §2.3.2와 동일).  
- 따라서 **어드민이 `feature_flags`만 바꿔도** 다음 **`GET /me`부터** 새 권한 집합이 반영된다. JWT를 다시 발급할 필요는 없다(단, 클라이언트가 캐시한 `me` 객체를 갱신해야 UI·가드가 따라온다).

**프론트 `AuthContext`**  
- `shared/api/authClient.js`의 `getMe()` 응답 전체를 `me`에 보관. 라우트 가드(`ProjectFeatureRoute` 등)는 **`me.permissions`** 스냅샷을 사용한다.  
- **동기화**: 어드민에서 **현재 JWT의 프로젝트**에 대해 `feature_flags` 등을 PATCH한 뒤에는 `AdminProjectsPage` 등에서 이미 **`refreshMe()`**를 호출해 `/me`를 다시 받는다. 다른 화면에서 플래그만 바뀐 경우에도 동일하게 **`refreshMe()`**가 필요하다.  
- **JWT 클레임을 바꿀 때**(예: `security.py` payload 키 추가/제거): `decode_token_payload` 소비처·`deps.get_access_payload`·토큰을 파싱하는 모든 경로와, 토큰에 의존하는 FE(있을 경우)를 전수 점검한다.

### 이 섹션 전용 체크리스트

- [x] `router` ↔ `service` 매핑 표 — **§7.1** (2026-04-13)
- [x] `feature_flags`·JWT·`AuthContext` 정합 — **§7.2** 문서화; 구현은 JWT에 flags 미포함·`/me`에서 DB 기준 계산·FE는 `refreshMe`로 동기화(2026-04-13)

---

## 8. `Backend/admin_server`

**이 섹션에서 할 일**: `/api/admin` 전 구간을 도메인별로 나누어 본다.

| 파일 | 역할 |
|------|------|
| `router.py` | 전 엔드포인트 |
| `service.py` | 공통 위임 |
| `service_users.py` | 사용자·이관·정지 |
| `service_projects.py` | 프로젝트·멤버·초대·매핑 |
| `service_tables.py` | table_master·매핑 |
| `service_roles.py` | 역할 |
| `ownership_guards.py` | 409 가드 |
| `schemas.py` | DTO |
| `deps.py` | (있으면) 어드민 전용 |

### 연관 경로

`notification_server`, `core/db.py`(ETL 일부), `Frontend/.../admin`, `03_API_GUIDE.md` §3 (`admin_server`)

### 8.1 URL 도메인 → `service_*` (라우터는 `service.py`를 거치지 않음)

`router.py`가 `service_users` / `service_roles` / `service_projects` / `service_tables`를 **직접** 호출한다(`service.py`는 패키지 설명용 빈 진입점).

| 경로 그룹 | 주 호출 모듈 | 비고 |
|-----------|----------------|------|
| `/users`, `/users/search`, `/users/invite`, 소유·이관·`management`, `suspend`/`activate`/`DELETE`, `role`, `etl-access` | `service_users` | `ManagementBlockedError` → 409: `PUT .../management`, `PATCH .../suspend`, `DELETE /users/{id}` |
| `/invite/departments` | `service_users` | |
| `/invite/projects` | `service_users`(`assert_invite_dptmt_allowed`) + `service_projects.list_projects_in_dept` | |
| `/invite/roles` | `service_users` + `service_roles.list_roles_for_dept` | |
| `/invite-codes`, `/org`, `/org/departments` CRUD | `service_users` | |
| `/roles` 전반 | `service_roles` | |
| `/projects` 전반·멤버·초대 취소 | `service_projects` | |
| `/tables`, `/projects/{id}/tables` 매핑 | `service_tables` (+ 목록 일부 `service_projects`) | |

### 8.2 소유 가드 409 응답 계약 (`ownership_guards` ↔ FE)

- **생산**: `build_ownership_violation_payload` → `ManagementBlockedError(payload)` → `router`에서 `HTTPException(409, detail=payload)`.
- **필드**(FastAPI가 `detail`로 JSON 그대로 내려보냄):

| 키 | 타입 | 의미 |
|----|------|------|
| `changeable` | bool | `false`이면 요청 거부·이관 필요 |
| `message` | str | 상단 안내 문구 |
| `blocking_assets` | 배열 | `{ type, items:[{ resource_type, resource_id, name, reason }] }` 그룹 목록 |
| `allowed_assets` | 배열 | 유지 가능 요약(`type`, `count`, `note`) |
| `target` | 객체 | `user_dvsn`, `etl_yn`, `for_suspend` |

- **소비**: `Frontend/.../admin/AdminUsersPage.jsx` — `e.status === 409`일 때 `detail.changeable === false`로 모달 분기, `blocking_assets`·`allowed_assets` 렌더. **키 이름 정합 확인됨**(2026-04-13).
- **변경 시**: `ownership_guards`의 키·`resource_type` 값을 바꾸면 동일 파일 FE와 **cross-check** 스킬로 재검증.

### 8.3 `router.py` 분할 여부 (판단 기록)

- 현재 **단일 `router.py` (~870행, 엔드포인트 ~50)** 유지. 도메인은 주석 블록(`# 1. [users]` 등)으로 이미 구획됨.
- **분할 보류 이유**: `APIRouter`를 쪼개면 `main`의 `include_router` 다중화·프리픽스 정합·리뷰 비용이 커지고, 현재 긴급한 결함·누락 연결 신고 없음.
- **재검토 트리거**: 동일 파일 병렬 편집 충돌 빈번, 특정 도메인만 단위 테스트·권한 미들웨어를 분리하고 싶을 때 → 그때 `users_router` 등으로 옮기고 `router.py`는 `include_router`만 두는 형태 권장.

### 이 섹션 전용 체크리스트

- [x] `router.py` 분할 — **§8.3** 검토 완료, 당분간 단일 유지(2026-04-13)
- [x] `service_users` ↔ `ownership_guards` ↔ FE 409 — **§8.2** 계약·`AdminUsersPage` 키 정합 확인(2026-04-13)

---

## 9. `Backend/notification_server`

**이 섹션에서 할 일**: HTTP 4개 + `notification_info` 적재·읽기 경로를 **HTTP 라우터와 분리된 INSERT**까지 추적한다.

| 계층 | 내용 |
|------|------|
| `router.py` | GET/PATCH 4종, `require_active_access` |
| `service.py` | `list_*`, `mark_*`, `insert_notification`, `notify_inviter_*`, `user_display_label_for_notification`, `*_in_txn` 등 |

### 연관 경로

`admin_server/service_projects`·`service_users`, `project_server/service`, `widget_board_server/service` → `notification_server/service` 의 **`insert_notification`**, **`fetch_*`**, **`mark_notification_read_in_txn`**, **`delete_*_in_txn`**, **`pending_*`**, **`user_has_pending_widget_board_invite`**, **`user_display_label_for_notification`**, **`notify_inviter_project_invite_resolved`**, **`notify_inviter_widget_board_invite_resolved`** 등(동일 `conn` 트랜잭션). FE·`03_API_GUIDE.md` §6.1

### 9.1 HTTP → `service`

| HTTP | 경로 | 서비스 |
|------|------|--------|
| GET | `/api/notifications` | `list_notifications` |
| GET | `/api/notifications/unread-count` | `count_unread` |
| PATCH | `/api/notifications/read-all` | `mark_read_all` |
| PATCH | `/api/notifications/{notification_info_id}/read` | `mark_read_one` → 없으면 **404** |

### 9.2 `notification_info` DML·소유 경계

**소유 모듈**: `notification_server/service.py` 만이 `notification_info` 에 대해 raw SQL 을 수행한다(§1.1).

| 구분 | 함수(요약) |
|------|------------|
| INSERT | `insert_notification` (`autocommit` 옵션, §1.1·타 패키지는 `autocommit=False` 위주) |
| 읽기(단건·목록) | `fetch_notification_by_id`, `list_notifications`, `count_unread`, `fetch_pending_project_invite_rows_for_project` |
| UPDATE 읽음 | `mark_read_one` / `mark_read_all`(API용 즉시 commit), `mark_notification_read_in_txn`(동일 트랜잭션) |
| DELETE | `delete_notification_by_id_in_txn`, `delete_notifications_for_user_in_txn`, `delete_project_invite_notifications_for_project_in_txn`, `delete_widget_board_notifications_for_board_in_txn` |
| 조회·판단 | `pending_project_invite_exists_for_user_project`, `user_has_pending_widget_board_invite` |
| 제목 구성(타 테이블 읽기) | `user_display_label_for_notification`(`user_info`), `notify_inviter_project_invite_resolved`(`project_info`+`user_info`+`insert_notification`), `notify_inviter_widget_board_invite_resolved`(`user_info`+`insert_notification`, 보드명은 인자) |

**타 패키지 호출 맥락**: `admin_server/service_projects.py`(생성·멤버·초대 취소·purge·pending 목록·멤버 알림 라벨), `admin_server/service_users.py`(비활성 사용자 삭제 시 알림 정리), `project_server/service.py`(초대 수락/거절·초대자 알림 위임), `widget_board_server/service.py`(초대·수락/거절·보드 삭제·초대자 알림 위임).

### 9.3 404·문구 가이드 정합

- 단건 읽음: 라우터 `detail="알림을 찾을 수 없습니다."` — **03_API_GUIDE.md** §6.1 “본인 행 없으면 404”와 일치(2026-04-13).

### 이 섹션 전용 체크리스트

- [x] 알림 문구·404와 가이드 일치 — **§9.3**
- [x] `notification_info` DML·조회 전부 `notification_server` 소유·타 패키지는 헬퍼 호출 — **§9.2** (2026-04-13)

---

## 10. `Backend/project_server`

**이 섹션에서 할 일**: 프로젝트 목록·select·초대 수락/거절 흐름만.

| 파일 | 내용 |
|------|------|
| `router.py` | `/api/projects` |
| `service.py` | 비즈니스 로직 |

### 연관 경로

`auth_server`(JWT), `notification_server`, FE 헤더, `03_API_GUIDE.md` §4 (`project_server`)

### 이 섹션 전용 체크리스트

- [x] `select` 후 클라이언트 `refreshMe`·라우트 가드와 정합 — `ProjectHeaderSelect.jsx`에서 `postSelectProject` 직후 `refreshMe()` 호출·`ProjectFeatureRoute` 가드와 대조(2026-04-13)

---

## 11. `Backend/campaign_dash_server`

**이 섹션에서 할 일**: `router.py`·**기간 해석 모듈**·`core/dashboard_service`·`core/db` 경계를 정리한다.

| 파일 | 내용 |
|------|------|
| `router.py` | `GET /api/campaign-dashboard/*` — **`GET /page`** 는 summary·trend_multi·member·hourly를 동일 `table_id`/기간 앵커로 **한 번에** 반환(SPA 단일 조회) |
| `campaign_period.py` | `calc_summary_date_range`, `calc_previous_range`, `fact_inclusive_end_date`, `trend_multi_window_start` — 라우터·집계 기간·추이 창 공통 |
| (외부) | `core/dashboard_service.py`, `core/db.py` |

### 연관 경로

`Frontend/.../campaign_dashboard`(`campaignDashboardClient.js`·`CampaignDashboardPage.jsx`), `03_API_GUIDE.md` §5.3

### 이 섹션 전용 체크리스트

- [x] 기간 계산은 `campaign_period` 단일 모듈로 통일(2026-04-13 코드·로그 339)
- [x] `GET /page` 번들과 개별 GET 엔드포인트의 **동일 앵커·period** 정합 — FE가 `/page` 우선 사용 시 네트워크·일관성 확인
- [ ] 라우터 헬퍼 분리 시 엔드포인트·권한·`_require_star_fact_table` 순서 유지

---

## 12. `Backend/query_studio_server`

**이 섹션에서 할 일**: `/api/*` 쿼리·라벨·execute·관계/JOIN 경로를 프로젝트 허용 집합과 맞춘다.

| 파일 | 역할 |
|------|------|
| `router.py` | 대부분의 HTTP |
| `peak_guard.py` | 선택 설정 **`backend.query_studio_peak_guard`** — 관계 전체 **TTL 캐시**, 무거운 관계 계산 **동시 상한**, 사용자당 **분당 한도**(슬라이딩 60초). 적용 대상: `GET /api/table-relationships?mode=all`, `POST /api/join-order`, `POST /api/execute-query`. 한도 초과 **429**(`Retry-After`)·동시 상한 대기 초과 **503** 가능 |
| `relationship_inference.py`, `join_path.py`, `join_metrics.py`, `pluralize.py` | 추론·JOIN |
| `schemas.py` | 요청 모델 |

### 고우선 잔재

~~§5.3 무인자 `get_allowed_tables()`~~ 제거됨.

### 연관 경로

`shared/api/queryStudioTableApi.js`, `packages/query_studio`, `core/sql_safety.py`, `core/db.py`, `Env/config/config.json.example`(`query_studio_peak_guard`), `docs/main/02_BACKEND_GUIDE.md` §3

### 이 섹션 전용 체크리스트

- [x] `_perm["project_info_id"]` 를 관계·JOIN·order 전 경로에 전달
- [x] ~~`analysis_store` / `allowlist_analysis`~~ 제거됨(관계는 매 요청 계산; `mode=all`은 `peak_guard` TTL 캐시로 완화)
- [x] `peak_guard` 활성 시 429/503·`Retry-After` — FE·가이드(`03_API_GUIDE` 「6. 기타 패키지」`query_studio_server` 항)와 재시도 UX 정합(설정 켠 환경에서만 스모크)

---

## 13. `Backend/widget_board_server`

**이 섹션에서 할 일**: 보드·위젯·초대·공유·데이터 API와 매핑 검증을 맞춘다.

| 파일 | 역할 |
|------|------|
| `router.py` | `/api/widget-boards/*` |
| `service.py` | CRUD·`fetch_widget_data`·매핑 |
| `schemas.py` | DTO |

### 연관 경로

`docs/report/20_Widget_Board_System_Design.md`, `Frontend/.../widgetboard`, `core/db.py`, `core/sql_safety.py`

### 이 섹션 전용 체크리스트

- [x] `share_scope` private|project — schemas·FE·`03_API_GUIDE`·`service` 정합(2026-04-13)
- [x] `saved_table` main/dash — `get_allowed_tables_by_project`·`widget_board_server/service`·쿼리 스튜디오 list-tables가 동일 매핑 계열 사용(2026-04-13 문서·코드 대조, 회귀는 §17 스모크 권장)

---

## 14. 제거된 레거시 대시보드 패키지

| 경로 | 조치 |
|------|------|
| `legacy_dashboard_server`, `new_dash_server`, `new_dash_server2` | **삭제**(2026-04-13). 운영 대시보드는 `campaign_dash_server`만.

---

## 15. 제거·통합 후보

| 항목 | 방향 | 선행 조건 |
|------|------|-----------|
| `get_allowed_tables()` 무인자 | ~~제거·필수화~~ **완료** | — |
| `get_table_columns` 등 미호출 공개 함수 | ~~제거~~ **Phase C 완료** | — |
| 미등록 대시보드 패키지 | ~~삭제 또는 연결~~ **삭제 완료** | — |

---

## 16. 단계별 실행 로드맵

### Phase A — 인벤토리 고정

- [ ] §5~§13을 스프레드시트로 옮기고 `router`→`service` 열 추가
- [ ] 패키지별 `def` 목록 + 참조 수 기입

### Phase B — 허용 테이블 단일화

- [x] 공개 API는 `project_info_id` 포함 경로로 문서화
- [x] `query_studio` 관계/JOIN/order 수정
- [x] `get_all_tables_columns_with_types` 시그니처 정리

### Phase C — dead code

- [x] 미참조 함수 제거 PR(분리)
- [x] `compileall`·pytest(운영 시 주기 실행 권장) — 로컬 `python -m compileall Backend` 확인·기록(2026-04-13, pytest는 DB·환경 의존 시 별도)

### Phase D — 문서·로그

- [x] `02_BACKEND` §3(`etl_db`·`query_studio_peak_guard`), `03_API_GUIDE` §6.2(`share_scope`), 본 문서 §3·§13 체크(2026-04-13)
- [x] 본 문서 §15·§4.1·§3 `require_*` 스캔(2026-04-13)
- [x] `docs/log/log.md` (본 라운드 항목)

---

## 17. 부록

### 17.1 PowerShell — `def` 줄 추출

```powershell
Get-ChildItem -Path Backend\core -Filter *.py -Recurse | ForEach-Object {
  Select-String -Path $_.FullName -Pattern '^(async )?def ' | ForEach-Object {
    "$($_.Filename):$($_.LineNumber) $($_.Line.Trim())"
  }
}
```

패키지 경로만 `Backend\core` → `Backend\auth_server` 등으로 바꿔 반복.

### 17.2 스모크 시나리오(완료 정의)

1. 로그인·refresh·로그아웃  
2. 프로젝트 목록·select·비활성 403  
3. 쿼리 스튜디오: list-tables·describe·execute·(해당 시) join-order·**`table-relationships?mode=all`** — `query_studio_peak_guard` 켠 경우 분당 한도·429/503  
4. 캠페인 대시보드: **`GET /page`**(또는 tables·summary·trend 등 개별 경로)  
5. 위젯 보드: 목록·캔버스·데이터·초대  
6. 어드민: 사용자·프로젝트·매핑 각 1건  
7. 알림: 목록·읽음·unread-count  

---

## 18. 문서 이력

- 함수 단위 «미사용» 판정은 **§2** 절차로 매번 재검증할 것.
- 본 문서 구조는 **섹션(§5~§13) = 패키지 1작업 단위**로 나뉘어, 병렬 작업 시 충돌을 줄이기 위함.
- 2026-04-13: §7에 **§7.1** 라우터→`service` 표, **§7.2** JWT·`feature_flags`·`AuthContext`/`refreshMe` 규칙 추가.
- 2026-04-13: §8에 **§8.1** 도메인→`service_*`, **§8.2** 409 JSON 계약·FE 정합, **§8.3** `router.py` 단일 유지 판단.
- 2026-04-13: §9에 **§9.1**~**§9.3**, `insert_notification` 미호출·인라인 INSERT 위치·404 정합.
- 2026-04-13: §9.2 `insert_notification` 공통화(`autocommit`)·admin/project/widget_board 호출부 통합.
- 2026-04-13: §1.1 패키지–테이블 DML 경계 원칙. §9.2 `notification_info` UPDATE/DELETE/조회까지 `notification_server` 집중·타 패키지 위임.
- 2026-04-13: §9.2 초대자 알림(`notify_inviter_*`)·`user_display_label_for_notification` 정리, admin `_noti_user_label` 제거.
- 2026-04-13: §3·§13 위젯보드 `share_scope`·config 키 정합, `02_BACKEND_GUIDE` §3.2.3·`03_API_GUIDE` §6.2 갱신, Phase D 일부 [x].
- 2026-04-13: §4.1 `require_*`·Depends 전수 인벤토리(`main` 등록 라우터·ETL batch 포함), §3 글로벌 체크 `require_*` 항목 [x].
- 2026-04-13: §6 `health.py` `/api` 인덱스를 `main.py` 마운트 기준으로 갱신, §10 프로젝트 `select`→`refreshMe` 코드 대조 [x], Phase C `compileall` 확인 반영.
- 2026-04-13: §5 `invite_expiry.py`, §11 `campaign_period.py`·`GET /page`, §12 `peak_guard.py`·체크리스트·§17 스모크 보강. `03_API_GUIDE` §5.3·`02_BACKEND_GUIDE` §2 트리 정합.
- 2026-04-13: `03_API_GUIDE` 본문 읽기 순서 **§3 `admin_server` → §4 `project_server`**(라우터 마운트 순서는 §1.1·`main.py`와 동일). 본 문서 §8·§10의 03 절 번호 참조 갱신.
