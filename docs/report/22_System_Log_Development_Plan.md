# 22. 시스템 로그(system_log) 및 `system_log_server` 개발 계획

**한 줄 요약**: `ibank_system_data`에 **감사·추적용 append-only 로그**를 두고, **`Backend/system_log_server`** 로 **`system_log`·로그인 이력(`user_login_log`) 조회를 한 패키지에서 제공**한 뒤, **도메인별 서비스에 점진적으로 기록 호출**을 심는다. 스케줄 ETL 자동 실행은 **기존 ETL 실행·이력**에만 두고 `system_log`에는 **사용자(또는 명시적 API 주체) 액션 유발**만 남긴다. 프론트는 **`07` §12 과제 1**에 따라 **로그인 이력·시스템 이력을 한 페이지**(`tab` 쿼리)·**동일 테이블 셸**로 제공한다.

**요구 출처**: `docs/main/07_USER_FUNCTIONAL_GUIDE.md` §12 **과제 1**(사용자 이력 조회·통합 UI), **과제 3**(시스템 로그 이력).

---

## 목차

| 구분 | 섹션 | 내용 |
|------|------|------|
| 메타 | [§0 문서 메타](#0-문서-메타) | 범위·교차 참조 |
| 배경 | [§1 배경·목표](#1-배경목표) | 기능 요구 vs 현행 갭 |
| 설계 | [§2 원칙·비범위](#2-원칙비범위) | ETL 분리·SQL·개인정보 |
| 설계 | [§3 아키텍처 선택](#3-아키텍처-선택) | `system_log_server`·**§3.3 로그인 이력 조회 통합** |
| DB | [§4 `system_log` 스키마](#4-system_log-스키마-적용-ddl과-동기) | 테이블·인덱스·확장 |
| 1차 | [§5 Phase 1 — 인프라](#5-phase-1-system_log_server--저장-인프라) | 패키지·API·DDL·**§5.1 무중단 적용** |
| 2차 | [§6 Phase 2 — 계측](#6-phase-2-백엔드-계측-매핑) | 우선순위·**§6.4~6.6** 매핑·검증 |
| 횡단 | [§7 상관 ID·HTTP 컨텍스트](#7-요청-상관-id--http-컨텍스트) | 미들웨어·UA·IP |
| 3차 | [§8 Phase 3 — UI·운영](#8-phase-3-프론트--운영-정책) | **§8.1** 통합 이력·**§8.2** 보존 만료(추후)·목록·CSV |
| 보완 | [§9 대안·고도화](#9-대안고도화-옵션) | PG 감사·샘플링 |
| 마무리 | [§10 검증·문서 정합](#10-검증체크리스트--문서-정합) | 상단 불릿·**§10.1 종합 롤아웃 체크리스트** |
| 부록 | [§11 문서 이력](#11-문서-이력) | 유지보수 |

---

## 0. 문서 메타

**목적**  
운영·감사·장애 분석에서 **「누가, 언제, 어떤 채널로, 어떤 DB/리소스에 무엇을 했는지」**를 한곳에서 조회할 수 있게 한다. 한 번의 HTTP 요청(또는 사용자 클릭)에 따른 **다중 DB 호출**은 **요청 상관 ID**로 추적하되, **적재 행 수는 §2.7 집약 원칙**(한 액션 한 행)을 따른다.

**본 문서 범위**  
- 백엔드: `system_log` 테이블(DDL), **`system_log_server`**( **`system_log` 조회 + 로그인 이력(`user_login_log`) 조회 표면 통합** · 내부 writer 연동), **`core/system_audit_log.py`**(append 전용) 설계  
- 프론트: Phase 3에서 **§8.1 통합 이력 조회 페이지**(로그인·시스템 모드, `07` §12 과제 1), **목록·필터·권한·CSV** 및 `01` 라우팅·패키지 위치와 정합

**범위 밖(명시적 제외)**  
- **스케줄에 의한 ETL 자동 실행** 전 구간의 row-level 로깅 → **`etl_jobs` / `batch_run_history` 등 ETL 전용 이력**이 정본(중복·용량 방지).  
- **법무·ISMS-P 대응 전체** → `07` §12 선택 과제와 운영 규정 문서가 주도(본 문서는 구현 계획만).

**교차 참조**  
`docs/main/07_USER_FUNCTIONAL_GUIDE.md`(§12 과제 1·3), `docs/main/02_BACKEND_GUIDE.md`, `docs/main/03_API_GUIDE.md`, `docs/main/04_DB_ARCHITECTURE.md`, `docs/main/05_Permission_ARCHITECTURE.md`, `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`, `docs/report/21_Backend_Package_Refactoring_Inventory.md`  
**프론트 UX 레퍼런스(탭·URL)**: `Frontend/react-app/src/packages/etl/ETLPage.jsx` — `useSearchParams`, `tab` 쿼리, `setSourceTypeAndUrl` 패턴.

---

## 1. 배경·목표

| 구분 | 내용 |
|------|------|
| 현행 | 로그인 시도는 `user_login_log` 등으로 일부 존재. **통합 감사 로그**(DDL/DML/채널/상관 ID)는 없음. |
| 목표 | **사용자 액션으로 유발된** 시스템·메인·(필요 시) dash DB 접근·고위험 관리 작업을 **`system_log`**에 적재하고, **SA·A는 부서 트리**, **SA_DEV는 전체**로 조회. |
| 통합 이력 UI(07 과제 1) | 사용자 관리 →「**사용자 이력 조회**」→ **단일 페이지**에서 **`tab=login` 기본**(로그인 이력) / **`tab=system`**(시스템 이력, `system_log`) 전환. 필터·50건 페이징·**테이블 셸은 동일**, 컬럼·데이터 소스만 모드별. |
| UI 필터·정렬(요구) | 로그인·시스템 모드 공통: **사용자 식별 contain**, **일시 from/to**, **IP 마스킹 contain**, **50건 페이징**, **기본 정렬 일시 내림차순(최신 먼저)**. 시스템 모드 추가 필터는 (구현 단계) `channel`, `action_kind`, 성공/실패 등. |

---

## 2. 원칙·비범위

1. **append-only**: 애플리케이션 계정은 `INSERT`만(임의 수정·삭제는 운영 DBA·정책적 아카이브만).  
2. **ETL 스케줄 자동 실행** → `system_log` **미기록**. 사용자가 ETL 화면에서 **저장·수동 실행·연결 테스트·업로드 확정** 등을 한 경우만 기록.  
3. **SQL 원문 비저장(1차)**: 보안·용량 위해 **정규화 요약**(예: `op=execute_query`, `table=…`, `fingerprint=sha256(normalized_sql)`), 필요 시 **바인딩 마스킹 후 일부**.  
4. **개인정보**: IP는 **마스킹 저장**, User-Agent는 **파싱 요약만**(길이 상한). 이메일·이름은 조회 API에서만 필요한 최소 노출(저장은 `user_id` 중심).  
5. **채널·종류**: `channel` 값은 **§6.3 확정 표** 및 `core/system_audit_log.py` 의 `CHANNEL_*` 상수와 일치시킨다. `action_kind`는 **§2.7**에 따른 **대분류**, 세부는 `business_action`.  
6. **고위험 관리 작업**: `business_action`, `target_summary`, `risk_tier` 등 확장 컬럼으로 **admin 정지·프로젝트 비활성·멤버 제거** 등과 통합(07 §12.9).  
7. **집약 원칙**: 한 API 호출(한 사용자 액션) = 한 `system_log` 행. 내부적으로 여러 SQL이 실행되더라도 행을 분리하지 않는다. `action_kind`는 **대분류**로 한정한다: `CREATE`, `UPDATE`, `DELETE`, `EXECUTE`, `LOGIN`, `EXPORT`. `business_action` 컬럼이 세부 식별자(예: `user_suspend`, `project_deactivate`, `member_remove`, `password_change`, `invite_send`, `invite_accept`, `invite_reject`, `ownership_transfer`)를 담는다. DB DML 종류(INSERT/UPDATE/DELETE 몇 건)는 필요 시 `detail_json`에 기록한다.

---

## 3. 아키텍처 선택

### 3.1 왜 `system_log_server` 패키지인가

| 대안 | 장점 | 단점 |
|------|------|------|
| A. **`Backend/system_log_server/`** + **`core` 저장 헬퍼** | 라우터·스키마·조회 SQL이 한 패키지에 모임. `main.py` 등록 패턴이 기존 서버와 동일. | 다른 서버가 writer 호출 시 `core` API를 잘 정의해야 함. |
| B. `admin_server`에만 넣기 | 어드민과 붙어 있음. | 조회·적재·권한이 `admin_server` 비대화, 순환 의존 위험. |
| C. DB 감사만 | 앱 외 접속 포착. | 상관 ID·비즈니스 의미·채널 매핑이 어렵고 앱과 중복 가능. |

**권장(본 계획의 1차)**: **A** — 사용자 요청과 동일하게 **`system_log_server`** 를 신설하고, **다른 패키지는 `core/system_audit_log.append_system_log`** 만 호출한다. HTTP 조회 전용 라우터는 `system_log_server/router.py` 에 둔다.

### 3.2 런타임 등록(예상)

- **prefix**: `/api/system-logs` — 독립 라우터로 `main.py`에 등록.  
- **권한**: `main.py`에서 `dependencies=[Depends(require_org_admin)]` 일괄 적용. SA_DEV는 전체 조회, SA·A는 부서 트리 필터를 **service 레이어**에서 적용.

### 3.3 로그인 이력 조회 백엔드의 `system_log_server` 통합(권장)

**현행(요약)**: 로그인 시도 **적재**는 `auth_server/service.py`의 `insert_login_log` 등이 `user_login_log`를 갱신한다. **본인 최근 조회**는 `auth_server/router.py`의 `GET /api/auth/me/login-history` → `fetch_login_history_masked` 등으로 **인증 패키지에 조회 로직이 붙어 있다**.

**문제**: 통합 이력 UI(§8.1)에서 **로그인 탭·시스템 탭을 같은 “감사 조회” 축**으로 다루려면, 조회·필터·부서 스코프·페이징이 **한 라우터·한 서비스 모듈**에 모이는 편이 운영·문서·권한 테스트에 유리하다.

**권장 방향(본 문서 확정)**  

| 구분 | 위치 | 내용 |
|------|------|------|
| **적재(쓰기)** | **`auth_server` 유지** | `verify_login_complete` / `insert_login_log` — 인증 도메인 소유. `system_log` 이중 기록은 §6.4·§6.5.2 정책대로. |
| **조회(읽기)** | **`system_log_server`로 이전·집결** | `user_login_log` + `user_info` 조인·마스킹·부서 트리 필터·50건 페이징·`ORDER BY create_dtm DESC` 를 **`system_log_server/service.py`**(필요 시 `service_login_history.py` 분리)에 구현. |
| **HTTP** | **`system_log_server/router.py`** | 예: `GET /api/system-logs/login-history/me`(본인), `GET /api/system-logs/login-history/org`(조직 어드민·§8.1). `require_org_admin` / `require_active_access` 등은 엔드포인트별 Depends로 분기. |
| **호환** | **단계적** | 기존 `GET /api/auth/me/login-history`는 **동일 서비스 함수 호출하는 얇은 래퍼**로 두었다가, 프론트·`03_API_GUIDE` 이전 후 제거 또는 영구 래퍼로 유지(팀 선택). |

**검증**: 통합 이력 페이지의 **로그인 모드**는 **`/api/system-logs/login-history/...` 만** 바라보게 하면 클라이언트가 한 베이스 URL로 두 탭을 연동하기 쉽다.

---

## 4. `system_log` 스키마 (적용 DDL과 동기)

**DB·스키마**: `ibank_system_data.public`  
**OWNER(적용 스크립트 기준)**: `ibankbi`  
**문서 정본**: 컬럼·인덱스·NULL 규칙은 **`docs/main/04_DB_ARCHITECTURE.md` §13** 과 동일하게 유지한다. 저장소에 별도 `.sql` 파일을 두지 않는 경우 **운영 적용 스크립트**를 이 절과 04를 기준으로 맞춘다.

### 4.1 컬럼(DDL 순서)

| 컬럼 | 타입 | 제약·기본 | 설명 |
|------|------|-----------|------|
| `system_log_id` | `bigserial` | PK | 일련번호 |
| `create_dtm` | `timestamp` | NOT NULL DEFAULT `now()` | 기록 시각(표시 타임존은 조회·앱 정책). |
| `actor_user_id` | `int` | NULL, **FK 없음** | `user_info.user_id` 논리 참조. 사용자 삭제 후에도 행 보존. |
| `request_correlation_id` | `uuid` | NULL | HTTP 요청 단위 묶음 |
| `client_ip_masked` | `varchar(45)` | NULL | 마스킹된 IP |
| `user_agent_summary` | `varchar(120)` | NULL | UA 파싱 요약 |
| `channel` | `varchar(40)` | NOT NULL | §6.3 확정 값(`auth`, `admin`, …) |
| `action_kind` | `varchar(20)` | NOT NULL | **대분류**: `CREATE`, `UPDATE`, `DELETE`, `EXECUTE`, `LOGIN`, `EXPORT` 등 |
| `business_action` | `varchar(60)` | NULL | 세부 식별자(`user_suspend`, `project_deactivate`, `member_remove`, `password_change`, `invite_send`, …). `action_kind`와 조합 검색. |
| `db_target` | `varchar(20)` | NULL | `system` / `main` / `dash` / `etl_meta` 등 |
| `schema_name` | `varchar(63)` | NULL | |
| `table_name` | `varchar(63)` | NULL | 논리 리소스만이면 NULL + `resource_name` |
| `resource_name` | `varchar(200)` | NULL | 예: 위젯 보드명 |
| `rows_affected` | `int` | NULL | |
| `success_yn` | `varchar(1)` | NOT NULL DEFAULT `'Y'` | |
| `http_status` | `smallint` | NULL | |
| `error_code` | `varchar(80)` | NULL | |
| `sql_fingerprint` | `varchar(64)` | NULL | 원문 비저장·지문(sha256 hex 등) |
| `sql_template_key` | `varchar(120)` | NULL | `channel.operation` 형식 요약 키 |
| `risk_tier` | `varchar(10)` | NULL | `HIGH` / `MED` / `LOW` |
| `target_summary` | `varchar(500)` | NULL | |
| `detail_json` | `jsonb` | NOT NULL DEFAULT `'{}'` | 확장(§4.1.1 규약) |

### 4.1.1 `detail_json` 예약 키 규약

| 키 | 타입 | 설명 |
|---|---|---|
| `target_table` | string | 대상 테이블명 |
| `affected_user_id` | int | 영향 받은 사용자 ID (정지·역할 변경 등) |
| `old_value` | any | 변경 전 값 (스칼라 또는 짧은 JSON) |
| `new_value` | any | 변경 후 값 |
| `sql_fingerprint` | string | `sha256:` 접두 + hex (execute-query 등) |
| `etl_table_id` | int | ETL 관련 액션 시 |
| `project_info_id` | int | 프로젝트 관련 액션 시 |
| `widget_board_id` | int | 위젯보드 관련 액션 시 |
| `file_name` | string | 업로드 파일명 |
| `error_detail` | string | 실패 시 요약 메시지 (개인정보 제외) |

- 예약 키 외 자유 키는 `x_` 접두사를 사용한다.  
- 값에 개인정보(이메일·전화번호 등)를 넣지 않는다.  
- GIN 인덱스 대상이 될 수 있으므로 키 이름은 snake_case, 값은 가능한 스칼라로 유지한다.

### 4.2 인덱스(적용본)

| 인덱스명 | 정의 요지 |
|----------|-----------|
| `idx_system_log_create_dtm` | `create_dtm` DESC — 시계열 조회 |
| `idx_system_log_actor_dtm` | `(actor_user_id, create_dtm DESC)` — 행위자별 |
| `idx_system_log_correlation` | `request_correlation_id` (WHERE 값 NOT NULL) — 요청 추적 |
| `idx_system_log_channel_action` | `(channel, action_kind, create_dtm DESC)` — 채널·대분류 필터 |
| `idx_system_log_business_action` | `(business_action, create_dtm DESC)` WHERE `business_action` IS NOT NULL — 세부 액션 필터 |

### 4.3 보존·파티셔닝

- 월 단위 **RANGE partition**(또는 아카이브 테이블 이동)은 **데이터 적재 후 Phase 3**에서 운영과 합의.  
- 1차는 단일 테이블 + 인덱스로 시작해도 됨(행 수 모니터링 후 파티션).

---

## 5. Phase 1 — `system_log_server` + 저장 인프라

**Exit 기준**: 마이그레이션 적용 DB에서 `INSERT` 후 **조회 API**로 필터·페이징이 동작하고, 권한 오류 시 403이 난다. **P1-7** 완료 시 **로그인 이력 조회**가 `system_log_server` 경로에서 동일 필터·정렬 규칙으로 동작한다.

| Step | 작업 | 산출물 |
|------|------|--------|
| P1-1 | `system_log` DDL 적용·권한(OWNER/GRANT) | 운영 기록 |
| P1-2 | `core/system_audit_log.py` — append 전용 함수 | `append_system_log(*, conn=None, row: SystemLogRow)`. conn이 system_db 풀이면 해당 트랜잭션에 포함, 아니거나 None이면 내부에서 `get_db_connection_system_core()` 획득 후 독립 commit. 적재 실패 시 `logger.exception` + 본 업무 미중단. |
| P1-3 | `Backend/system_log_server/` 생성 | `router.py`, `service.py`, `schemas.py` |
| P1-4 | 목록 조회 API | GET `/api/system-logs`, query: `user_key`, `from`, `to`, `ip_contains`, `page`, `page_size=50`, `channel`, `action_kind`, `success_yn`. **기본 정렬** `create_dtm DESC`(최신 먼). 선택 정렬 파라미터는 구현 단계에서 확장 가능. 권한: `require_org_admin` 라우터 레벨 Depends. |
| P1-5 | admin_server에 계측 2~3건 시범 삽입 | `suspend_user`, `create_project_full` 등에서 `append_system_log` 호출. E2E 검증: INSERT 후 `GET /api/system-logs?user_key=...&channel=admin` 으로 방금 삽입한 행이 필터·페이징되어 조회되는지까지 확인. |
| P1-6 | `api_server/main.py` 라우터 등록 + 문서 반영 | `include_router(system_log_router, dependencies=[Depends(require_org_admin)])`. 02·03·04 문서 갱신. |
| P1-7 | 로그인 이력 **조회** 이전 | `auth_server`의 `fetch_login_history_masked` 등 **읽기 전용** 로직을 **`system_log_server`** 로 이전(복사 후 정리). `GET /api/system-logs/login-history/me`·`.../org`(가칭) 추가. `auth` 라우터의 `/me/login-history`는 §3.3 래퍼 정책. |

**구현 메모**

- **쓰기 경로**: HTTP 엔드포인트로 로그를 받지 않음(위조 방지). 서버 내부에서만 `core/system_audit_log.append_system_log` 호출.  
- **DB 연결**: `system_log` 테이블은 `ibank_system_data`(system_db)에 있으므로, `append_system_log`는 **기본적으로 `get_db_connection_system_core()`로 독립 연결을 획득**한다. 호출부가 이미 system_db 풀의 `conn`을 가지고 있고 동일 트랜잭션에 포함시키고 싶은 경우(예: admin_server의 고위험 DML), **`conn` 인자를 명시적으로 전달**하면 해당 연결을 사용하되 `commit`은 호출부 책임.  
- **스레드 격리**: `queue_worker`·`scheduler_file`의 배경 스레드에서는 `contextvars`로 설정한 `correlation_id`가 전파되지 않는다. §2 원칙상 스케줄 자동 실행은 `system_log` 미기록이므로 이 경로에서 `append_system_log`를 호출하지 않는다. ETL 사용자 수동 실행(router.py에서 직접 처리)만 기록 대상.  
- **에러 시**: 로그 적재 실패가 본 업무를 중단시키지 않도록 **try/except + logger.exception**. 정책: 1차는 로그 유실 허용. 운영 안정화 후 필요 시 재시도/알림 추가.  
- **기동(Startup)**: `system_log_server` 로딩이 **기존 패키지 import 순환**을 만들지 않도록 `main.py` 마운트 순서·지연 import를 **`02_BACKEND_GUIDE`** 와 맞춘다. **앱 기동 시 `system_log` 풀스캔·대량 SELECT 금지**(헬스는 기존 `/health` 유지, `system_log` 의존 검사는 선택).  
- **운영 스위치(권장)**: `config.backend.system_log_append_enabled`(가칭) 등 **기본 `false`**. 스테이징·카나리에서 `true` 검증 후 프로덕션 반영. 긴급 시 **플래그만 false**로 계측 전부 무력화(스키마·조회 API는 유지 가능).  
- **풀·타임아웃**: 로그용 system_db 연결이 **업무 풀을 고갈**하지 않도록 풀 크기·`connect_timeout`/`options -c statement_timeout`은 **`02`**·운영 설정과 합의. `append_system_log` 내부 INSERT는 **단일 짧은 구문**으로 유지.

### 5.1 운영 무중단·구동 안전 적용

**목표**: DDL·배포·신규 라우터·계측이 **기존 API 가용성·p95 지연·프로세스 기동**을 깨지 않는다.

| 단계 | 내용 | 구동·가용성 메모 |
|------|------|-------------------|
| **S0** | P1-1만 선행: `system_log` DDL + 인덱스 + GRANT. | 앱 미배포 시 **영향 없음**. 가능하면 **짧은 락**만 유발하는 절차(운영 DBA 창)로 적용. 인덱스는 PG 버전에 맞게 **CONCURRENTLY** 등 검토. |
| **S1** | P1-2 배포하되 **`system_log_append_enabled=false`** 유지. | `append_system_log`가 **호출되지 않거나 즉시 no-op**이면 업무 경로 **0 추가 비용**. |
| **S2** | P1-3·P1-4·P1-6·(선택 P1-7 일부) — **조회 API·빈 테이블**만 노출. | 신규 라우터는 **기존 라우터와 경로 충돌 없음**(`03`·`main.py` 순서 확인). 목록이 비어도 **200 + 빈 배열**. |
| **S3** | P1-7 완료: 로그인 이력 **신규 경로** 스모크 → `auth` **래퍼만** 전환. | **구 경로와 응답 스키마 동일성** 테스트 후 트래픽 전환. 프론트 미배포 시에도 래퍼로 **회귀 없음**. |
| **S4** | `system_log_append_enabled=true` (스테이징 → 카나리 → 전체). | P1-5·Phase 2 계측은 **소규모 PR·저트래픽 시간** 권장. 한 PR에 **전 패키지** 계측 금지. |
| **S5** | 모니터: system_db INSERT 에러율·풀 대기·API p95. | 이상 시 **S4만 되돌림**(플래그 false). 앱 롤백 시 **라우터 include 제거**로 조회 API만 내림. |

**롤백 요약**

| 상황 | 조치 |
|------|------|
| 계측이 원인으로 의심 | **`system_log_append_enabled=false`** → 원인 분석. 테이블·조회 API는 유지 가능. |
| 신규 라우터만 문제 | `main.py`에서 `system_log_router` **include 제거** 후 재배포. |
| DDL 문제 | 앱 롤백과 별도로 **DB 마이그레이션 역적용**은 운영 절차(드물게). |

**§7 상관 ID 미들웨어**: UUID 발급·헤더 파싱은 **O(1)**·실패 시 **correlation 생략** 후 요청 계속. 기존 핸들러에 **예외 전파 금지**.

**체크리스트(교차)**: 위 S0~S5·P1 단계를 **한表로** 순서 점검할 때는 **[§10.1](#rollout-checklist)** 을 사용한다.

---

## 6. Phase 2 — 백엔드 계층 매핑

**방법**: `21` 문서 **§2 전수검사**와 같이 `main.py` 등록 라우터를 기준으로 삼되, **실제 삽입 위치는 §6.4(공통 수칙)·§6.5(파일·함수 표)·§6.6(검증)** 을 정본으로 한다. **배포(S0~S5)·라우터 연결·Phase 2 패키지·모니터링·문서**를 한表로 점검하려면 **§10.1** 을 쓴다(§6는 계측 매핑 전용). 구현 전 표를 복사해 PR 체크리스트로 쓴다. **계측 PR은 §5.1 S4 이후·플래그 true 구간에서만** 본격 적용하고, PR은 **패키지/도메인 단위로 분할**한다.

### 6.1 우선순위(권장 순서)

| 순위 | 패키지 | 이유 |
|------|--------|------|
| 1 | `admin_server` | 사용자 정지·프로젝트·멤버·권한 — `business_action` / `risk_tier` 정합(07 §12.9). |
| 2 | `auth_server` | 로그인은 `user_login_log` 유지 + **민감 변경**(비밀번호, 2FA 설정 등)만 `system_log` 이중 기록 검토. |
| 3 | `query_studio_server` | `execute-query`, 저장 테이블/리소스 DDL — 감사 가치 높음. |
| 4 | `etl_server` | **사용자 유발** API만(수동 실행·규칙 저장·연결 테스트·업로드 확정 등). 스케줄러 내부는 제외. |
| 5 | `widget_board_server` | 보드/위젯 CRUD. |
| 6 | `project_server` | 초대 수락/거절 등. |
| 7 | `campaign_dash_server` | 필요 시 읽기/집계 호출만 — 용량 대비 **샘플링 또는 생략** 검토. |
| 8 | `notification_server` | 대개 내부 적재; **외부에서 호출되는 변경 API**만 선별. |

**부서 트리 스코프 구현 메모**: Phase 1에서는 `system_log_server/service.py`에 부서 트리 CTE를 독립 구현한다. `admin_server`의 `_user_in_actor_dept_scope` 등과 동일 로직이 3곳 이상 반복되므로, `21_Backend_Package_Refactoring_Inventory.md`에 "부서 트리 재귀 CTE를 `core` 함수로 승격" 항목을 추가하여 기술 부채로 추적한다.

### 6.2 계측 깊이(단계적)

| 단계 | 내용 |
|------|------|
| 2a | **고위험·쓰기 위주**만 (INSERT/UPDATE/DELETE/DDL + admin 비즈니스 액션). |
| 2b | **SELECT** 중에서도 `execute-query`, 대량 다운로드·보내기 — `07` ISMS 메모와 정합되는 지점부터. |
| 2c | 나머지 조회는 샘플링 또는 제외(노이즈·비용). |

### 6.3 `channel` / `sql_template_key` 규칙

#### channel 확정 값 (main.py 라우터 기준)

| channel | 라우터 prefix | 비고 |
|---------|--------------|------|
| `auth` | `/api/auth` | 로그인·세션·비밀번호 |
| `project` | `/api/projects` | 목록·선택·초대 응답 |
| `notification` | `/api/notifications` | 알림 읽음 등 (선별 기록) |
| `admin` | `/api/admin` | 사용자·프로젝트·역할·부서 관리 |
| `query_studio` | `/api` (QS 엔드포인트) | execute-query·save-table 등 |
| `etl` | `/api/etl`, `/api/etl/batch` | 사용자 유발 API만 |
| `campaign_dash` | `/api/campaign-dashboard` | 필요 시 샘플링 |
| `widget_board` | `/api/widget-boards` | 보드·위젯 CRUD |
| `system_log` | `/api/system-logs` | `system_log` 목록·CSV·**§3.3 로그인 이력 조회 하위 경로** 등 감사 조회 표면 전반 |

`core/system_audit_log.py`에 `CHANNEL_*` 상수로 정의한다. `sql_template_key` 형식: `'{channel}.{operation}'` (예: `admin.user_suspend`, `query_studio.execute_query`).

### 6.4 계측 삽입 공통 수칙

| 수칙 | 내용 |
|------|------|
| 선호 레이어 | **`router.py`가 아닌 `service*.py`**(또는 `query_studio_server`처럼 로직이 한 파일이면 **해당 파일의 엔드포인트 핸들러 함수**). 라우터는 권한·파싱만 두고, **DB 반영이 확정된 직후**에 `append_system_log` 호출. |
| 트랜잭션 | **동일 `system_db`/`ibank_system_data` 트랜잭션**에 넣을 때만 `conn` 인자 전달(§5 구현 메모). 그 외는 독립 연결 + 내부 commit. |
| 한 액션 한 행 | §2.7 — **공개 진입 함수 1곳**에만 호출. `_foo` 헬퍼 여러 개로 쪼개진 로직이면 **가장 바깥 `def` 하나**에만 둔다. |
| 예외·롤백·성공 | **하이브리드(본 문서 확정)**: (1) **업무 DML**(`admin_server`·`project_server`·`widget_board_server`·`etl_server` 사용자 설정 등) — **`commit` 성공 후에만** `append_system_log` 적재, **rollback 시 미기록**(DB 실제 반영과 감사 행 일치). (2) **인증 계열**(`auth_server` 로그인 등) — **성공·실패 모두** 1행 집약 가능, 실패는 `success_yn='N'` 및 `error_code` / `detail_json.error_detail` 요약. `user_login_log`와 병행 여부는 운영 정책. |
| 금지 | `queue_worker.py`, `scheduler_file.py`, `batch_executor_*.py` 등 **스케줄·워커 스레드** 내부에서 `append_system_log` 호출 금지(§2·§7). |

### 6.5 패키지별 파일·함수 매핑 (Phase 2 체크리스트)

아래는 **현행 저장소 기준**(2026-04) 파일·함수명이다. 구현 시 시그니처 변경 시 본 표를 같이 갱신한다. **2a**=쓰기·고위험 우선, **2b**=조회·EXECUTE 등, **2c**=선별/생략.

#### 6.5.1 `Backend/admin_server`

`router.py`는 직접 계측하지 않고, **아래 `service_*`의 “커밋 성공 직전/직후”**를 기준으로 한다.

| 파일 | 계측 후보 함수 | 단계 | `business_action`(가칭) |
|------|----------------|------|--------------------------|
| `service_users.py` | `suspend_user`, `activate_user`, `delete_inactive_user` | 2a | `user_suspend`, `user_activate`, `user_delete_inactive` |
| `service_users.py` | `invite_user_by_email` | 2a | `invite_send` |
| `service_users.py` | `set_user_dvsn_admin_user`, `set_user_etl_flag`, `update_user_management` | 2a | `user_role_change`, `user_etl_flag`, `user_management_update` |
| `service_users.py` | `transfer_resource_ownership` | 2a | `ownership_transfer` |
| `service_users.py` | `create_department`, `update_department_name`, `update_department_in_org_settings`, `delete_department_in_org_settings` | 2a | `dept_create`, `dept_update`, `dept_invalidate`, `dept_delete` |
| `service_users.py` | `list_users_for_admin_ui` 등 **조회 전용** | 2c | 기본 제외 |
| `service_projects.py` | `create_project_full` | 2a | `project_create` |
| `service_projects.py` | `update_project`, `deactivate_project`, `purge_inactive_project` | 2a | `project_update`, `project_deactivate`, `project_purge` |
| `service_projects.py` | `add_member`, `remove_member`, `update_member_role`, `cancel_project_invite` | 2a | `member_add`, `member_remove`, `member_role_update`, `invite_cancel` |
| `service_projects.py` | `list_projects_in_dept`, `list_members` 등 | 2c | 제외 |
| `service_roles.py` | `create_custom_role`, `update_custom_role`, `delete_custom_role` | 2a | `role_create`, `role_update`, `role_delete` |
| `service_roles.py` | `list_roles_for_dept`, `list_role_usages` 등 | 2c | 제외 |
| `service_tables.py` | `update_table_master`, `add_project_table_mapping`, `delete_project_table_mapping` | 2a | `table_master_update`, `table_mapping_add`, `table_mapping_delete` |
| `service_tables.py` | `list_table_master`, `list_project_tables` | 2c | 제외 |
| `ownership_guards.py` | 가드만(409 판별) | — | **계측 없음** — 실제 변경은 위 서비스에서 이미 기록 |

#### 6.5.2 `Backend/auth_server`

| 파일 | 계측 후보 함수 | 단계 | 비고 |
|------|----------------|------|------|
| `service.py` | `verify_login_complete` | 2a | `action_kind=LOGIN`, `business_action=login_success` / 실패 시 `success_yn=N`. `user_login_log`와 **이중 기록** 여부는 운영 정책으로 결정. |
| `service.py` | `change_password` | 2a | `password_change` |
| `service.py` | `invalidate_all_sessions`, `logout_one_session` | 2c | 감사 필요 시만 |
| `service.py` | `signup_with_invite`, `create_org_and_user` | 2a | 가입·조직 생성(민감) |
| `service.py` | `insert_login_log` | — | **기존** `user_login_log` 적재 — 여기에 `append_system_log`를 넣지 말고 상위 `verify_login_complete` 등에서 한 번에 집약 권장 |

#### 6.5.3 `Backend/query_studio_server`

비즈니스가 **`router.py`에 집중**되어 있으므로, 아래 **엔드포인트 핸들러** 본문에서 성공 응답 직전에 계측한다.

| 파일 | 계측 후보 함수 | 단계 | `business_action`(가칭) |
|------|----------------|------|--------------------------|
| `router.py` | `execute_query` | 2b | `query_execute` — `action_kind=EXECUTE` |
| `router.py` | `save_query_as_table`, `_save_table_worker`(비동기 완료 시점) | 2a | `saved_table_create` / 상태 조회만이면 2c |
| `router.py` | `save_column_labels`, `_persist_user_project_labels` | 2a | `labels_save` |
| `router.py` | `list_tables`, `describe_table`, `table_relationships`, `query_stats`, `explain_sql` | 2c | 1차 제외 또는 샘플링 |

#### 6.5.4 `Backend/etl_server`

**HTTP 라우터**에서 호출되는 `service.py` / `service_file.py` / `router_file.py` 경로만 대상. **`service.py`의 `insert_job`·`update_job` 등이 워커에서도 호출되면**, HTTP 유입 시에만 구분할 수 있게 **`router.py`/`router_file.py`에서 전달하는 플래그** 또는 **호출 스택 상위**에서만 `append_system_log`를 호출하는 방식을 검토한다.

| 파일 | 계측 후보 함수(사용자 유발) | 단계 | 비고 |
|------|------------------------------|------|------|
| `service.py` | `create_connection`, `delete_connection`, `test_connection` | 2a | 연결 생성·삭제·테스트 |
| `service.py` | `create_storage_connection`, `update_storage_connection`, `delete_storage_connection`, `test_storage_connection` | 2a | 스토리지 |
| `service.py` | `create_etl_table`, `update_etl_table`, `delete_etl_table`, `delete_etl_table_row_only`, `refresh_etl_table_column_mapping` | 2a | 규칙·메타 변경 |
| `service_file.py` | `create_folder_connection`, `update_folder_connection`, `delete_folder_connection` | 2a | 배치 폴더 |
| `service_file.py` | `create_batch_job`, `update_batch_job`, `delete_batch_job` | 2a | 배치 Job 설정 |
| `service_file.py` | `delete_remote_files` 등 **사용자가 명시 실행** | 2a | |
| `service_file.py` | `finish_run`, `try_claim_batch_job_for_run`, `update_run_progress` | — | **스케줄/워커**에서 주로 호출 → `system_log` **미기록** |
| `queue_worker.py`, `scheduler_file.py`, `batch_executor_db.py`, `batch_executor_file.py` | (전역) | — | **계측 금지** |

#### 6.5.5 `Backend/widget_board_server`

| 파일 | 계측 후보 함수 | 단계 | `business_action`(가칭) |
|------|----------------|------|--------------------------|
| `service.py` | `create_board`, `patch_board`, `delete_board` | 2a | `widget_board_create`, … |
| `service.py` | `add_widget`, `patch_widget`, `delete_widget` | 2a | `widget_create`, … |
| `service.py` | `patch_layout`, `upsert_share`, `delete_share` | 2a | `widget_layout_update`, `widget_share_upsert`, `widget_share_delete` |
| `service.py` | `accept_widget_board_invite`, `reject_widget_board_invite` | 2a | `invite_accept`, `invite_reject` |
| `service.py` | `send_invite_notifications` | 2a | `invite_send` — `insert_notification` 은 하위에서 계측하지 않음(§6.5.7); 발송 건수·대상 수는 `detail_json`·`rows_affected` |
| `service.py` | `list_boards`, `fetch_widget_data` | 2c | 1차 제외 |

#### 6.5.6 `Backend/project_server`

| 파일 | 계측 후보 함수 | 단계 | `business_action`(가칭) |
|------|----------------|------|--------------------------|
| `service.py` | `accept_project_invite`, `reject_project_invite` | 2a | `invite_accept`, `invite_reject` |
| `service.py` | `select_project_tokens`, `list_projects_for_user` | 2c | 제외 |

#### 6.5.7 `Backend/notification_server`

| 파일 | 계측 후보 함수 | 단계 | 비고 |
|------|----------------|------|------|
| `service.py` | `mark_read_one`, `mark_read_all` | 2c | `commit` 성공·실제 `UPDATE` 행 있을 때만 기록(`business_action`: `mark_read_one`, `mark_read_all`). 불필요 시 플래그 off로 부하 제어. |
| `service.py` | `insert_notification` | — | **다 도메인에서 호출** — 여기에 넣지 말고 **발행 원인이 있는 상위 서비스**에만 집약 기록 |

#### 6.5.8 `Backend/campaign_dash_server`

| 파일 | 계측 후보 함수 | 단계 | 비고 |
|------|----------------|------|------|
| `router.py` | `summary`, `campaign_dashboard_page`, `member_summary`, `trend_multi` 등 GET 집계 | 2c | **기본 생략**(읽기 폭주). 필요 시 샘플링 별도 설계. |

### 6.6 구현 후 검증(필수)

1. **정적 검색**: `rg "append_system_log" Backend/` 로 삽입 위치 목록을 뽑고, **§6.5 표**와 대조하여 누락·오삽입(헬퍼 중복)을 제거한다.  
2. **금지 경로**: `rg "append_system_log" Backend/etl_server/queue_worker.py Backend/etl_server/scheduler_file.py` 등이 **0건**인지 확인.  
3. **E2E**: P1-5(§5)에 더해, 패키지별로 **대표 API 1건**씩 호출 후 `GET /api/system-logs` 에서 `channel`·`business_action` 필터로 역추적.  
4. **문서**: 본 절 표를 변경한 PR마다 **동일 PR에서 표 갱신**(함수 리네임 동기).  
5. **무중단(§5.1)**: 배포·플래그·롤백 시나리오(S0~S5)를 **릴리즈 노트**에 한 번씩 기록했는가. (상세 순서표는 **§10.1** 과 중복되므로, 마일스톤 종료 시 **§10.1만** 순서대로 체크해도 된다.)

---

## 7. 요청 상관 ID · HTTP 컨텍스트

| 항목 | 제안 |
|------|------|
| 발급 | `api_server` **미들웨어**에서 요청 입구에 `X-Request-Correlation-Id` 없으면 **UUID 생성**, 있으면 신뢰 길이만 허용 후 전파. |
| 전달 | `Request.state.correlation_id` 또는 `contextvars` 로 `append_system_log` 가 읽기. |
| IP·UA | 기존 로그인 로그와 동일한 **마스킹·요약 함수**를 `core` 로 모아 재사용. |
| **구동 영향(필수)** | 미들웨어 본문은 **try/except 전체**로 감싸, UUID·헤더 파싱 실패 시 **로그만 남기고 요청은 그대로 진행**(correlation 생략). **추가 DB I/O 없음**. §5.1과 합쳐 “기존 경로 무지연”을 만족시킨다. |

**⚠️ 스레드 격리 주의**  
Python `contextvars.ContextVar`는 스레드 간 자동 전파되지 않는다. `etl_server/queue_worker.py`의 `ThreadPoolExecutor` 워커 스레드와 `scheduler_file.py`의 APScheduler 스레드에서는 HTTP 미들웨어가 설정한 correlation_id가 보이지 않는다. §2 원칙상 이 경로에서는 `append_system_log`를 호출하지 않으므로 문제없으나, 향후 배경 스레드에서도 기록이 필요해지면 `contextvars.copy_context().run()` 패턴 또는 인자 명시 전달이 필요하다.

**Exit 기준**: §2.7 집약 원칙에 따라 **한 API 호출(한 사용자 액션)당 한 `system_log` 행**이 Phase 2 계측의 기본이다. `request_correlation_id`는 요청 추적·외부 도구 정합용으로 채운다(Phase 2에서 필드 채움·조회 검증).

---

## 8. Phase 3 — 프론트 · 운영 정책

### 8.1 통합 이력 조회 페이지 (`07` §12 과제 1)

**목표**: 정형화된 **한 벌의 이력 목록 UI**(필터 바 + 테이블 + 페이징)로 **로그인 이력**과 **시스템 이력**을 모두 제공한다. 화면 골격·스타일은 동일하고 **내용(컬럼·API 응답 매핑)** 만 모드별로 바꾼다.

| 항목 | 내용 |
|------|------|
| 진입 | 조직 어드민 **사용자 관리** — 초대 버튼 옆「**사용자 이력 조회**」→ 전용 라우트(예: `packages/admin` 하위 신규 페이지). |
| 모드 전환 | **쿼리 파라미터 2값**(가칭 `tab=login` 또는 `tab=system`). **`ETLPage.jsx`**와 같이 `useSearchParams`로 URL 동기화, `replace: true`로 브라우저 뒤로가기 부담 완화. **최초 진입 기본값 `login`**. |
| 로그인 모드 | **원칙**: 목록·필터·페이징·정렬은 **`system_log_server`** 의 `GET /api/system-logs/login-history/...`(§3.3·§5 P1-7)만 사용. 데이터 소스는 `user_login_log`(+ `user_info` 등). 부서 트리·SA_DEV 전체는 `05`·`07`과 동일. **레거시** `GET /api/auth/me/login-history`는 래퍼로만 유지할지 단계 폐기할지 `03`에 명시. |
| 시스템 모드 | `GET /api/system-logs` (§5 P1-4). **동일 필터 폼**을 재사용하고, 추가 쿼리(`channel`, `action_kind`, `success_yn` 등)는 같은 필터 바에 확장하거나 2행 접기 영역으로 배치(구현 택일). |
| 공통 컴포넌트 | `HistoryAuditShell`(가칭): PageHeader + 필터 + 테이블 + 페이지네이션. props: `mode`, `columns`, `fetchPage`, `emptyLabel`. |
| 정렬 기본값 | **로그인·시스템 모드 공통**: 목록은 **일시 내림차순(최신 먼저)** 가 기본. 백엔드는 해당 일시 컬럼 기준 `ORDER BY … DESC` 기본(시스템은 `create_dtm`, 로그인은 `user_login_log` 등 계약 컬럼), 프론트는 첫 로드·필터 적용 시에도 동일 기본을 유지한다. |
| 권한 | API에서 SA·A 부서 트리·SA_DEV 전체를 강제; 프론트는 403 시 안내만. |
| CSV 보내기 | **목록 GET과 동일 쿼리 필터**로 `COUNT` 후 데이터를 내려보냄(현재 화면 페이지만이 **아님**). 무제한 방지: 구현 상한 **`MAX_CSV_EXPORT_ROWS` = 50,000** 행 초과 시 **400** 및 필터 축소 안내. 조회·CSV 공통: `from`·`to` 를 모두 줄 때 **(종료일−시작일) 일수 최대 92일(약 3개월)** 초과 시 **400**. UTF-8 BOM CSV. 성공 시 `system_log`에 `channel=system_log`, `action_kind=EXPORT`, `business_action=audit_csv_export` 1행(행 수·종류는 `detail_json`; 재귀 조회 노이즈는 허용 범위). |

**Exit 기준**: `tab` 전환 시 **필터·정렬(적용값)은 유지**, 페이지만 필요 시 1로 맞춤. 두 모드 모두 50건 페이징·동일 테이블 폭으로 스크린샷 증적 가능.

| Step | 작업 |
|------|------|
| F3-1 | **§8.1** 통합 페이지: 라우트·`UserHistoryPage`(가칭)·`tab` 동기화·공통 셸·로그인/시스템 API 연동. |
| F3-2 | 사용자 관리: 버튼 라벨「사용자 이력 조회」·링크 연결. |
| F3-3 | `*Client.js` — **`/api/system-logs/login-history/...`** 및 **`/api/system-logs`** 목록·CSV(권한·부서 트리는 API가 강제). 레거시 `/api/auth/me/login-history` 사용 시 §3.3 래퍼 계약 준수. |
| F3-4 | CSV보내기: `GET …/export.csv`·`…/login-history/org/export.csv` — **목록과 동일 필터·상한 5만 행**·기간 상한(92일)·다운로드 1행 `audit_csv_export`(재귀적 유의). |
| F3-5 | 보존·아카이브·개인정보: **`system_log` 원본 보존 2년**(원칙) — 아카이브·파티션·삭제 권한 분리·처리방침 문서는 `04` §13·`07` 과제 3·운영 런북과 정합. |
| F3-6 | **보존 만료 후 실제 삭제·아카이브(추후)** — 구현·배치 설계는 **[§8.2](#82-보존-만료-추후)**. |

<a id="82-보존-만료-추후"></a>

### 8.2 보존 만료 처리(미구현 · 추후)

**현재**: 애플리케이션·스케줄 코드 기준으로 **`system_log`·`user_login_log` 를 “보존 2년 경과 후 자동 삭제”하는 잡은 없음**(정책만 `04`·`07`·본 절 F3-5에 명시).

**추후 구현 시 결정할 것(체크리스트)**  

| 항목 | 메모 |
|------|------|
| 삭제 vs 아카이브 | 법무·ISMS: 원본 삭제만 할지, 콜드 스토리지·별도 테이블로 이전 후 원본만 삭제할지. |
| 대상 테이블 | 최소 `system_log`; **`user_login_log` 동일 2년 적용 여부**를 별도 확정. |
| 실행 주체 | **DBA·전용 배치**(권장) — 월 **파티션 `DROP`/detach** 가 대량 `DELETE`보다 유리한 경우가 많음. 앱 API 서버와 분리. |
| 배치 방식(파티션 없을 때) | `create_dtm < now() - interval '2 years'` 등, **청크 단위 DELETE**·인덱스 활용·트랜잭션 크기·VACUUM 부하. |
| 안전장치 | 사전 **COUNT**/드라이런, **이중 승인**, 실행 **감사 로그**(별 테이블·파일 — `system_log` 자기 참조 주의). |
| 금지 정합 | **`append_system_log` 를 주기 배치·워커에 넣지 않는다**는 §6.5.4 정신 유지(삭제 잡은 별 스크립트·DB job). |
| 문서 | 확정 시 `02` 런북·`04` §13 운영 문단·`07` 보존 문구를 **실제 절차**와 동기. |

---

## 9. 대안·고도화(옵션)

1. **PostgreSQL 감사 확장**(pgaudit 등): DBA 직접 접속·DDL 보완. 앱 로그와 **상관 ID 매핑**은 어려울 수 있어 **보조 증적**으로 두는 것이 현실적.  
2. **비동기 버퍼**: 로그 폭주 시 **배치 flush**(메모리 큐 + worker) — Phase 2 후반 또는 별도 스프린트.  
3. **OpenTelemetry** 연동: 분산 추적 ID를 `request_correlation_id` 와 동기화.  

---

## 10. 검증·체크리스트·문서 정합

<a id="rollout-checklist"></a>

### 10.1 종합 롤아웃 체크리스트 (배포·연결·Phase 2·문서)

**위치 이유**: 본 표는 **§5(인프라·S0~S5)·§6(계측 표)·§7·§8** 를 가로지르는 **끝에서 끝 적용 순서**이다. §6은 **어디에 무엇을 심는지**만 두고, “언제 무엇을 배포·검증했는지”는 본 절 **§10.1** 에 둔다.

**쓰는 방법**: 아래 표는 **권장 순서**(인프라 → 플래그 off 배포 → 계측 코드 → 검증 → 플래그 on → 모니터링)대로 두었다. PR·릴리즈마다 해당 행만 체크해도 되고, **마일스톤 종료 시 §10.1 전체를 한 번 훑는 것**을 권장한다. Markdown 편집기에서 `[ ]`를 `[x]`로 바꾸면 된다.

**「백엔드 적용 완료」의 의미(중요)**  
§10.1을 **전부** 체크했다는 것은, 본 문서 기준으로 **시스템 로그 인프라(§5) + Phase 2 계측·운영 적용 축 + §6.6 검증 + 모니터링·아래 문서 행**까지 끝났다는 뜻으로 쓴다. **백엔드 전체(모든 도메인 기능·모든 API)가 완료**된다는 뜻은 **아니다**. 예: **§8 Phase 3**(통합 이력 UI·`*Client.js`)·이 절 **하단 불릿**의 `03`/`05` 문서 정합·CSV 등은 별 축이다.

| 순서 | 구분 | 체크 항목 | 비고 |
|:----:|------|-----------|------|
| 1 | DB·권한 | [ ] **S0**: `system_log` DDL·인덱스·GRANT가 대상 DB에 적용되었고 `04` §13과 서술이 맞는가 | §5.1 |
| 2 | 코드·기동 | [ ] **P1-2**: `core/system_audit_log.py`가 배포되어 있고, **`system_log_append_enabled` 없음/false 시** `append_system_log`가 **no-op**인가 | §5 구현 메모 |
| 3 | 라우터 연결 | [ ] **P1-6**: `api_server/main.py`에 `system_log_router`가 등록되어 있고 prefix·`require_org_admin` 등 **권한 Depends**가 계획과 같은가 | `02`·`03` |
| 4 | 조회 API | [ ] **P1-4·P1-7**: `GET /api/system-logs`·로그인 이력 하위 경로가 **스모크(200·빈 목록 허용)** 되는가 | §5 Exit |
| 5 | 무중단 단계 | [ ] **S1~S3**: 플래그 off로 조회 API만 노출한 채 배포·로그인 이력 경로 전환 등 **§5.1 표** 순서를 지켰는가 | 릴리즈 노트에 S 단계 기록 |
| 6 | 계측 켜기 | [ ] **S4**: 스테이징→카나리→전역으로 **`system_log_append_enabled=true`** 전환했고, 이상 시 **S4만 되돌림** 경로를 팀이 공유하는가 | §5.1 롤백 |
| 7 | §6.5 패키지 | [ ] **§6.1 순서대로** admin → auth → query_studio → etl → widget_board → project → (notification) → (campaign_dash 생략 확정) **계측이 코드에 반영**되었는가 | 패키지별 PR 분할 권장 |
| 8 | 표·코드 일치 | [ ] `rg "append_system_log" Backend/` 결과가 **§6.5 표**와 대조해 누락·중복 삽입이 없는가 | §6.6 항목 1 |
| 9 | 금지 경로 | [ ] `queue_worker`·`scheduler_file`·배치 executor 등 **§6.5.4 비고 금지 경로**에 `append_system_log`가 **0건**인가 | §6.6 항목 2 |
| 10 | 상관·컨텍스트 | [ ] **§7** 미들웨어가 켜져 있으면 `append_system_log` 시 **correlation·IP·UA 보강**이 기대대로 채워지는가(샘플 1건) | 실패 시에도 요청 지속 |
| 11 | E2E | [ ] **채널별** 대표 API 1건 호출 후 `GET /api/system-logs?channel=…`로 **역추적** 가능한가 | §6.6 항목 3 |
| 12 | 모니터링 | [ ] **S5**: system_db INSERT 실패율·풀 대기·관련 API p95를 **대시보드 또는 로그**에서 볼 수 있는가 | 임계 초과 시 플래그 off |
| 13 | 문서 | [ ] **§6.5 표**를 바꾼 PR마다 **동일 PR에서 표 갱신**했는가, **이 절 하단 불릿**의 `03`·`05`·`04` 교차 항목이 열린 것은 목록화되어 있는가 | §6.6 항목 4 |
| 14 | 리팩토링(선택) | [ ] 부서 트리 CTE **`core` 승격** 등 **§6.1 기술 부채**를 `21`에 등록했고, 필요 시 별 스프린트로 뺐는가 | 당장 필수 아님 |
| 15 | 프론트(별 축) | [ ] **§8.1** 통합 이력 페이지·`*Client.js`·`tab` 동기화가 **완료**되었는가(백엔드 완료와 독립) | Phase 3 |

**리팩토링 필요 여부 판단 요약**  
- **필수 아님**: `audit_emit.py` 패턴별 분리는 이미 도메인별로 존재하면 충분.  
- **검토 권장**: 동일 `detail_json` 조립·`SystemLogRow` 매핑이 **3패키지 이상**에서 복붙되면 공용 헬퍼(예: `core/system_audit_log.py` 인근)를 검토.  
- **문서 추적**: `admin_server`와 `system_log_server`의 부서 트리 SQL 중복은 **§6.1**대로 `21` 인벤토리에 항목으로만 남겨도 된다.

**(이하)** 문서·프론트·기능과의 **상시 정합** 항목이다.

- [x] `system_log` DDL이 **`04_DB_ARCHITECTURE`** 트리·본문(§13)에 반영되었는가.  
- [ ] **`03_API_GUIDE`** 에 `system_log`·**로그인 이력(통합 경로)** 조회 API·쿼리 파라미터·응답 필드·`/me/login-history` 래퍼 여부가 있는가.  
- [ ] **`05`** 조직 관리자 vs SA_DEV 조회 범위가 로그인 이력 과제(07 §12.1)와 **동일 규칙**인가.  
- [ ] ETL 스케줄·워커 경로에 `append_system_log` 호출이 **없는지**(§6.6 `rg` 검증).  
- [ ] **§6.5 표**와 실제 `append_system_log` 삽입 파일·함수가 일치하는가(PR마다 표 동기).  
- [ ] `health` 또는 배포 체크에 신규 라우터 노출(선택).  
- [ ] 프론트: `shared/api/http.js` 경로와 백엔드 prefix 일치.  
- [ ] **§8.1**: 통합 이력 페이지 `tab=login` 또는 `tab=system`, 기본 `login`, ETL식 URL 동기화.  
- [ ] 로그인 이력·시스템 이력 **동일 테이블 셸**·동일 필터·50건 페이징(`07` §12 과제 1).  
- [ ] 두 모드 목록 **기본 정렬 일시 내림차순**(§8.1·§5 P1-4·조직용 로그인 목록 API) 일치.  
- [ ] **§5.1**: DDL→읽기 API→append 플래그 off 배포→로그인 경로 이전→플래그 on 순서·`system_log_append_enabled`·롤백 표가 **`02_BACKEND_GUIDE`** 또는 운영 런북에 반영되었는가.  
- [ ] **§7**: 상관 ID 미들웨어가 **예외를 삼키고** 기존 요청에 지연·5xx를 유발하지 않는가(스모크).

---

## 11. 문서 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-20 | §8.2·F3-6: 보존 2년 **만료 후 삭제·아카이브는 미구현** — 추후 배치·파티션 체크리스트만 문서화. |
| 2026-04-20 | §8.1·F3-4·F3-5: CSV **50,000행** 상한·조회 기간 **92일(약 3개월)**·`system_log` **보존 2년** 원칙. `03`·`04`·`07`·라우터·서비스·FE 힌트 반영. |
| 2026-04-20 | §5.1 무중단 적용(S0~S5)·구현 메모(기동·플래그·풀)·§7 미들웨어 무해·§6·§10·목차. |
| 2026-04-20 | §3.3·§5 P1-7·§0·§6.3·§8.1·§10: 로그인 이력 **조회**를 `system_log_server`로 집결, 적재는 `auth` 유지. |
| 2026-04-20 | §6.4 하이브리드(업무 commit 후만 / 인증 성공·실패). §1·§5 P1-4·§8.1·§10: 목록 기본 일시 내림차순. `07` 과제 1 필터·정렬 절 보강. |
| 2026-04-20 | §8.1 로그인 모드: 조직 범위 로그인 이력 API 부재 시 설계 보완 한 줄. |
| 2026-04-20 | §6.4~6.6: 계측 공통 수칙·패키지별 파일·함수 매핑(체크리스트)·검증 절차. §6 도입·§10·목차 반영. |
| 2026-04-20 | §6.7에 두었던 **종합 롤아웃 체크리스트**를 **§10.1** 로 이동(§6는 계측 매핑 전용). §6.6·§6 도입·목차 정리. |
| 2026-04-20 | §8.1 통합 이력 페이지(07 과제 1): 사용자 이력 조회·`tab`·ETL UX 레퍼런스·F3 단계 재편. §0·§1·§10·요구 출처·한 줄 요약·체크리스트 반영. |
| 2026-04-20 | §4: 운영 적용 DDL과 동기 — 컬럼 순서·`timestamp`·`actor_user_id` FK 없음·인덱스 5종·04 §13 교차. §10 첫 항목 반영 완료 처리. |
| 2026-04-20 | §2.7·§4.1: `action_kind` 대분류 6종 + `business_action` 세부 분리. §5 P1-5 E2E 검증 범위 명시. |
| 2026-04-20 | `detail_json` 규약·Phase 1 Step 재정렬·구현 메모(DB 연결·스레드)·§2.7 집약·`action_kind`/channel 확정·§3.2 prefix·§6.3 표·§7 스레드 주의·Exit 기준 정합. |
| 2026-04-20 | 초안 작성 — Phase 1~3, 스키마 초안, 패키지 매핑, 상관 ID, 옵션 정리. |

---

**끝.**
