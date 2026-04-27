# 25. 데이터 변경 추적(Change Tracking) 계획서

**한 줄 요약**: `system_log`는 **행위(누가·무엇을 했는가)** 를 유지하고, **`data_change_log`** 는 **데이터 스냅샷·diff(무엇이 바뀌었는가)** 를 서비스 레이어에서 기록한다. DB 트리거·pgAudit은 현 단계에서 제외하고, **`request_correlation_id`(UUID)** 로 두 로그를 논리적으로 연결한다. **제품이 최종적으로 덮고 싶은 수집 범위**는 §1a, **현행 구현 범위**는 §5·Phase 표를 본다.

**관련 문서**: [22_System_Log_Development_Plan.md](./22_System_Log_Development_Plan.md), **docs/main/04_DB_ARCHITECTURE.md** §13, **docs/main/03_API_GUIDE.md** §3.4.

---

## §1. 교차 분석 요약 — 확정한 “하나의 최적 경로”

| 요소 | 판단 |
|------|------|
| **강점** | `system_log` + `detail_json`(JSONB) + 도메인 `emit_*` + `append_system_log` 파이프라인·상관 ID·`actor_user_id` 가 이미 있음. |
| **제약** | 멀티 DB·1인 개발 기준에서 트리거 다중 관리·디버깅 비용이 큼. pgAudit은 운영·GDPR 합의 전 단계에서 부담. |
| **확정안** | **B(행위 로그 강화) + A(전용 `data_change_log`) 하이브리드**, 구현 위치는 **애플리케이션(서비스) 레이어**만. |

**역할 분리**

- `system_log`: 채널·`business_action`·HTTP 맥락·`sql_fingerprint` 등 **행위 단위**.
- `data_change_log`: `target_table`·PK·`operation`·`old_data`/`new_data`/`changed_fields` **데이터 단위**.
- **연결 키**: `system_log.request_correlation_id` = `data_change_log.correlation_id` (동일 요청·동일 UUID). FK는 두지 않음(append-only·비동기 실패 허용).

---

## §1a. 목표 수집 범위 vs 현행 구현(정합, 2026-04)

본 절은 **제품이 최종적으로 담고 싶은 변경 추적 범위**(요구)와, **지금 코드에 반영된 범위**(현행)를 분리해 둔다. Phase 1 구현은 **우선 연결·인프라 검증**에 초점을 두었고, 아래 **목표 A·B** 전체를 만족하지는 않는다.

### A. `ibank_system_data` — `system_log` 계측과 정합되는 테이블 변경 **전부**(목표)

- **의도**: `append_system_log`가 심겨 있는(또는 `audit_sql_catalog` 등으로 **대표 DML이 식별**되는) **사용자 유발 쓰기 경로**마다, 해당 DML이 건드리는 **`public` 테이블 행**에 대해 **`data_change_log`에 before/after·diff**를 남긴다.
- **주의(집약 원칙과의 관계)**: `system_log`는 **한 HTTP 액션당 한 행** 집약 원칙(문서 22 §2.7)을 유지한다. **`data_change_log`는 같은 요청에서 여러 행·여러 테이블이 바뀌면 여러 행**이 생길 수 있으며, 이는 **의도된 차이**다(행위 로그 1행 + 데이터 변경 N행).
- **정렬 기준(구현 시)**: `Backend/admin_server/audit_sql_catalog.py` 등 **도메인별 카탈로그·`business_action` ↔ DML** 목록을 기준으로, 누락 없이 `track_*` 삽입 위치를 전수한다(22 §6.5·본 문서 Phase 2 표와 동기).

| 구분(예시) | `ibank_system_data` 테이블 예(04 본문) | system_log 계측·카탈로그와의 관계 | 현행 `data_change_log` |
|------------|----------------------------------------|-------------------------------------|---------------------------|
| 사용자·조직 | `user_info`, `dptmt_info` | admin 감사 DML 다수 | **`user_info`·`dptmt_info`** 주요 경로 + 일부 대량 삭제 시 생략 메모(`detail_json`) |
| 프로젝트·멤버 | `project_info`, `project_ptcpnt_info` | admin 감사 | **`project_info`·`project_ptcpnt_info`** 주요 경로 + purge 시 대량 생략 메모 |
| 권한 템플릿 | `pmssn_master` | admin | **`pmssn_master`** CRUD·이관(`service_roles`·`service_users`) |
| 테이블 마스터·매핑 | `table_master`, `table_project_mapping` | admin | **`table_master` 이관**, **`table_project_mapping`** 매핑 sync·purge(복합 PK `pid:tmid`) |
| 위젯 | `widget_board`(·`widget_item`·`widget_board_share` 화이트리스트) | admin | **`widget_board`** 소유 이관·purge(보드 10건 초과 시 일부 생략 메모); cascade 행은 대량 bulk 시 per-row 미기록 |
| 초대·알림 등 | `email_invite_code_master`, `notification_info` 등 | admin·정책에 따라 선별 | **미적용**(알림 등은 제외 검토 유지) |
| QS 메타 | `query_studio_user_labels` | query_studio | **미적용** |
| 위젯·기타 | `widget_board` 등 | widget_board 등 | **`widget_board`** 일부 경로(§5 Phase 1 표); `widget_item`·`widget_board_share`는 화이트리스트만(세부 purge per-row는 제한적) |

### B. Query Studio — **등록·매핑된 물리 테이블** 및 **신규 생성 테이블** 변경 **전부**(목표)

- **의도**: 프로젝트에 **`table_master` ↔ `table_project_mapping`**으로 노출·허용된 **main / dash** 물리 테이블(및 “저장 테이블 생성” 등으로 **새로 생기는** 테이블)에 대해, QS에서 수행되는 **CREATE / ALTER / DROP / INSERT / UPDATE / DELETE** 등 **스키마·데이터 변경**을 추적 가능하게 한다.
- **설계 이슈(필수 분기)**: 현재 `data_change_log` DDL(§3)은 **`ibank_system_data`** 에만 둔다. QS의 실제 DML은 **`main`·`dash` 등 별 DB 커넥션**에서 실행되므로, 아래 중 하나를 **Phase 설계로 확정**해야 한다(미확정 상태에서는 “전 테이블 자동 수집”을 약속할 수 없음).
  1. **`data_change_log`에 `db_target`(및 필요 시 `schema_name`) 컬럼을 추가**하고, 동일 append 정책으로 system_db에 적재하되 `target_table`은 물리 테이블명만 둔다.
  2. **DB별 `data_change_log` 동형 테이블**을 두고, 조회 API에서만 통합한다(운영·권한 복잡도 증가).
  3. QS 전용 **요약/지문 중심** 로그만 `system_log`에 두고, 행 단위 스냅샷은 **별 저장소·샘플링** 등 정책 분리(용량·개인정보).
- **비동기·상관 ID**: 저장 테이블 워커 등 **HTTP 밖** 경로는 `request_correlation_id`가 없을 수 있어(문서 22 §7), “전 구간 동일 상관 ID”를 요구하면 **명시 UUID 전달·워커 컨텍스트** 설계가 필요하다.

### 현행 코드 기준(한 줄)

- `Backend/core/change_tracker.py`의 **테이블 화이트리스트**는 §5 Phase 1 표와 같으며, **`admin_server`·`widget_board_server`·`project_server`·`query_studio_server`( `_upsert_table_master_and_mapping` ) 등 `track_*`가 삽입된 경로**에서만 기록된다. **ETL 메타(별도 DB)** 는 동일 트랜잭션 한계로 제외. **`system_log` INSERT만으로 `data_change_log`가 자동 생성되지는 않는다.**

---

## §2. 단계별 적용 범위 (문서·구현 게이트)

구현을 한 번에 넣지 않고, **섹션 단위로 PR/커서 작업을 나눈다.**

| 단계 | 범위 | 산출물 | 비고 |
|------|------|--------|------|
| **Phase 1.0** | 설계 고정·DDL 수동 실행 | 본 문서 §3 SQL을 운영에서 실행 | **저장소에 `.sql` 파일을 두지 않음** — 필요 시 채팅/문서의 블록 복사 |
| **Phase 1.1** | `Backend/core/change_tracker.py` | PII 스트립·capture·diff·record·contextmanager | 실패 시 로깅만, 업무 트랜잭션 중단 금지 |
| **Phase 1.2** | `admin_server` 우선 | `service_users.py`·`service_projects.py` 일부 함수에 적용 | 표 §5 Phase 1 |
| **Phase 1.3** | `system_log_server` | `GET .../system-logs/{id}/changes`, `GET .../change-logs` | 권한·부서 스코프는 기존 목록과 동일 패턴 |
| **Phase 1.4** | 프론트 통합 이력 | `UserHistoryPage` 시스템 탭 UX(§7) | `systemLogClient.js` 확장 |
| **Phase 2.0** | `service_roles`, `project_info`, `etl_server`, `widget_board_server` | 표 §5 Phase 2 | 트랜잭션·PK 형태에 맞게 `track_*` 조정 |
| **Phase 2.1** | 문서 동기화 | **04** §13 보조 절, **22** §4.x 요약 링크 | `detail_json` 예약 키 `change_log_count` 등 |

---

## §3. DB 적용 SQL (수동 실행용 — 파일 미생성)

**대상 DB**: `ibank_system_data` (system_db), 스키마 `public`, owner **`ibankbi`** (프로젝트 관례).

**주의**

- `system_log.request_correlation_id`는 **UUID** 타입이다. `data_change_log.correlation_id`도 **UUID**로 맞추는 것을 권장한다(문자열 36자 컬럼보다 조인·타입 안전).
- 앱 미들웨어가 상관 ID를 항상 넣지 않는 경로가 있다면, 적재 시 `correlation_id` **NULL 허용** 여부를 운영 정책으로 결정한다(아래 SQL은 **NOT NULL** 가정 — 관리 API만 먼저 적용 시 유효).

**실행 절차(예시)**

1. `psql` 또는 DBeaver에서 `ibank_system_data` 연결.
2. 아래 블록을 **한 번에** 검토 후 실행.
3. 권한·시퀀스는 환경의 앱 롤명에 맞게 조정(`ibankbi`).

```sql
-- §3.1 data_change_log (서비스 레이어 변경 추적)
-- 실행 전: 백업·스테이징 검증 권장.

CREATE TABLE IF NOT EXISTS data_change_log (
    change_log_id     BIGSERIAL       PRIMARY KEY,
    correlation_id    UUID            NOT NULL,
    actor_user_id     INTEGER         NOT NULL,
    project_info_id   INTEGER         NULL,
    target_table      VARCHAR(80)     NOT NULL,
    target_pk_column  VARCHAR(80)     NOT NULL DEFAULT 'id',
    target_pk_value   VARCHAR(128)    NOT NULL,
    operation         VARCHAR(10)     NOT NULL,
    old_data          JSONB           NULL,
    new_data          JSONB           NULL,
    changed_fields    JSONB           NULL,
    channel           VARCHAR(40)     NOT NULL,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_data_change_log_operation
        CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

COMMENT ON TABLE data_change_log IS
    '서비스 레이어 변경 추적 — system_log.request_correlation_id 와 correlation_id 로 논리 연결(비FK)';

CREATE INDEX IF NOT EXISTS idx_dcl_correlation
    ON data_change_log (correlation_id);
CREATE INDEX IF NOT EXISTS idx_dcl_actor_created
    ON data_change_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcl_target
    ON data_change_log (target_table, target_pk_value);
CREATE INDEX IF NOT EXISTS idx_dcl_created
    ON data_change_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcl_channel_created
    ON data_change_log (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcl_changed_fields
    ON data_change_log USING GIN (changed_fields);

-- 앱 연결 계정에 맞게 조정
GRANT SELECT, INSERT ON data_change_log TO ibankbi;
GRANT USAGE, SELECT ON SEQUENCE data_change_log_change_log_id_seq TO ibankbi;
```

**보존·용량**: `system_log`와 동일 **2년** 원칙(04 §13). 장기적으로 월 파티션은 Phase 2에서 `system_log`와 일괄 검토.

**PII**: `old_data` / `new_data` / `changed_fields` 에 **이메일·전화·계좌·토큰·비밀번호** 등이 들어가지 않도록 앱에서 스트립(§4 상수).

---

## §4. 핵심 모듈 설계 — `Backend/core/change_tracker.py`

| 항목 | 설명 |
|------|------|
| **PII_STRIP_FIELDS** | `password`, `passwd`, `pw`, `secret`, `token`, `refresh_token`, `access_token`, `phone`, `mobile`, `email`, `resident_no`, `account_no`, `card_no` 등 — **프로젝트 민감도에 맞게 목록 확장** |
| **`_strip_pii`** | dict 복사 후 키 제거 + 값 JSON 직렬화 가능 형태로 정규화 |
| **`capture_before`** | 화이트리스트 검증된 `table`·`pk_column` 만 허용(`^[a-zA-Z_][a-zA-Z0-9_]*$`), `SELECT * FROM ... WHERE pk = %s` → dict |
| **`compute_diff`** | 키 합집합, 변경된 필드만 `{"field": {"old": …, "new": …}}` |
| **`record_change`** | `INSERT INTO data_change_log ...` — **예외 삼켜서 로깅만**, `commit` 호출 금지 |
| **`track_update`** | contextmanager: enter에서 before, exit에서 after·diff·`record_change` (diff 비면 생략) |
| **`track_delete`** | 삭제 **전** `capture_before` 후 `record_change(DELETE)` |
| **`track_insert`** | 삽입 후 `new_data` dict 스트립 후 `record_change(INSERT)` |

**상관 ID**: `Backend.core.request_context.get_request_correlation_id()` — 별도 `correlation` 모듈 없음.

**트랜잭션**: `track_update`의 before/after `SELECT`는 **호출부 `conn`과 동일 트랜잭션**에서 실행(커밋 전 스냅샷 일관성).

---

## §5. 적용 대상 테이블·우선순위

**목표 대비 현행**: §1a 참고. 아래 표는 **로드맵·우선순위**이며, “목표 A·B 전체 완료”를 뜻하지 않는다.

### Phase 1 (본 문서 구현 완료 기준)

| 순위 | 테이블 | `target_pk_column`(기본) | 대표 동작 | 서비스 | channel |
|------|--------|---------------------------|-----------|--------|---------|
| 1 | `user_info` | `user_id` | 역할·ETL·정지/활성/비활성 삭제 | `service_users.py` | `admin` |
| 2 | `project_ptcpnt_info` | `project_ptcpnt_info_id` | 권한·멤버·초대 수락·초대자 이관·비활성 사용자 삭제(50건 cap+메모) | `service_projects.py`, `service_users.py`, **`project_server/service.py`** | `admin`, **`project`** |
| 3 | `dptmt_info` | `dptmt_info_id` | 부서 CRUD·생성자 이관 | `service_users.py` | `admin` |
| 4 | `pmssn_master` | `pmssn_master_id` | 커스텀 권한 CRUD·등록자 이관 | `service_roles.py`, `service_users.py` | `admin` |
| 5 | `project_info` | `project_info_id` | 생성·필드 PATCH·비활성·purge·생성자 이관 | `service_projects.py`, `service_users.py` | `admin` / `project` |
| 6 | `table_master` | `table_master_id` | 등록자 이관·**QS 저장 테이블 upsert** | `service_users.py`, **`query_studio_server/router.py`** | `admin`, **`query_studio`** |
| 7 | `table_project_mapping` | `project_info_id` + 값 `"{project_info_id}:{table_master_id}"` | 매핑 sync·purge·**QS upsert** | `service_projects.py`, **`query_studio_server/router.py`** | `admin`, **`query_studio`** |
| 8 | `widget_board` | `widget_board_id` | CRUD·소유 이관·purge(10 cap) | **`widget_board_server/service.py`**, `service_users.py`, `service_projects.py` | **`widget_board`**, `admin` |
| 9 | `widget_item` | `widget_item_id` | CRUD·delete_board(10 cap)·purge | **`widget_board_server/service.py`**, `service_projects.py` | `widget_board`, `admin` |
| 10 | `widget_board_share` | `widget_board_id` + 값 `"{board_id}:{shared_user_id}"` | upsert·초대 수락·delete_share·delete_board(10 cap)·purge | **`widget_board_server/service.py`**, `service_projects.py` | `widget_board`, `admin` |

### Phase 2 (후속)

| 순위 | 테이블 | 서비스(예시) | channel |
|------|--------|--------------|---------|
| 1 | `etl_connections` 등 | `etl_server` — **별도 DB 트랜잭션**·cross-DB 설계 확정 후 `track_*` 또는 요약 로그 | `etl` |
| 2 | `etl_jobs` | `etl_server` | `etl` |

**제외(예시)**: `notification_info` 는 Phase 1 범위에서 제외 가능(조회·알림 성격).

**주의**: Phase 1 구현은 위 표의 `target_pk_column`을 기본값으로 사용한다. `project_ptcpnt_info` 갱신 경로 중 `project_info_id + ptcpnt_user_id` 복합 조건을 쓰는 함수는 먼저 `project_ptcpnt_info_id`를 조회한 뒤 `track_update/track_delete`에 넘긴다. `table_project_mapping`·`widget_board_share`는 **복합 PK 문자열**(`:` 구분)과 `capture_before`의 이중 WHERE를 사용한다. `patch_layout`·`query_studio_user_labels`·`notification_info` 등은 제외한다. 신규 테이블 추가 시에만 04·코드를 재대조한다.

---

## §6. 조회 API (system_log_server)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/system-logs/{system_log_id}/changes` | 해당 행의 `request_correlation_id`로 `data_change_log` 목록 |
| GET | `/api/system-logs/change-logs` | `target_table`, `target_pk_value`, `channel`, 기간, 페이징 — **레코드 타임라인** |

**권한**: 기존 `system_log` 목록과 동일 — `sa_dev` 전체, `sa`/`a` 는 부서 트리 내 `actor_user_id` 필터(기존 `_JOIN_ACTOR_USER` / 재귀 CTE 패턴 재사용).

**스키마**: `ChangeLogItem`, `ChangeLogListResponse` 등 Pydantic 모델 추가.

---

## §7. 프론트 — 사용자 이력 조회(`UserHistoryPage`) 제안

**현행**: `Frontend/react-app/src/app/admin/UserHistoryPage.jsx` — 탭 `login` | `system`, 시스템 테이블에 SQL 지문·상세(`formatSystemDetailCell`) 표시.

### §7.1 시스템 이력 탭 보강 (Phase 1.4 권장)

1. **열 추가: `변경`**  
   - 기존 행 클릭 동작(`formatSystemDetailCell` 기반 상세)과 충돌을 피하기 위해, 행 우측 **아이콘 버튼(예: 🔍/📋)** 으로 `GET /api/system-logs/{id}/changes` 를 지연 로딩한다.  
   - 응답 건수가 0이면 `—`, 1건 이상이면 **`N건`** 배지 또는 링크. 필요 시 목록 API가 `change_log_count`를 별도 필드(또는 `detail_json`)로 내려 아이콘 활성화를 선판단한다.

2. **상세 패널 / 모달**  
   - 열기 시 목록: `target_table`, `operation`, `target_pk_value`, `created_at`.  
   - 행 선택 시 `changed_fields` 를 **읽기 전용 JSON 트리** 또는 `필드 / 이전 / 이후` 소표로 표시.  
   - `old_data`·`new_data` 전체는 접이식(기본은 `changed_fields`만).

3. **상관 ID 표시(선택)**  
   - 디버깅·운영용으로 상세 모달 하단에 `request_correlation_id` 복사 버튼(관리자만).

### §7.2 (선택) 세 번째 탭 `데이터 변경`

- 필터: `target_table`, `target_pk_value`, 기간, `channel`.  
- API: `GET /api/system-logs/change-logs`.  
- 로그인/시스템과 동일한 **필터 바·페이지네이션** 패턴 재사용.

### §7.3 API 클라이언트

- `Frontend/react-app/src/shared/api/systemLogClient.js` 에  
  `getSystemLogChanges(systemLogId)`, `getChangeLogsPaged(params)` 추가.

### §7.4 스타일

- `user-history.css`: 배지·모달 폭·JSON 영역(`max-height`+스크롤) — 기존 `admin-users` 모달과 톤 맞춤.

---

## §8. 22번·04번 문서와의 정합

| 작업 | 위치 |
|------|------|
| `data_change_log` 요약 | **22** 에 §4.x 로 “논리 ER·운영 규칙” 링크(본 25번 참조) |
| `detail_json` 예약 키 | **04** §13 표에 `change_log_count`(int, 선택) — 동일 `correlation_id`의 변경 건수 캐시용(선택) |
| 보존 2년 | 22·04 기존 정책과 동일 문구 유지 |

---

## §9. Cursor AI 실행 명령문 (복사용)

아래 블록을 커서에 붙여 단계별 구현에 사용한다. 상관 ID는 프로젝트 현재 구현 경로를 고정해 사용한다: `from Backend.core.request_context import get_request_correlation_id`.

```
@file docs/report/25_Data_Change_Log_And_Tracking_Plan.md
@file docs/main/04_DB_ARCHITECTURE.md
@file Backend/core/system_audit_log.py
@file Backend/core/request_context.py
@file Backend/core/db.py
@file Backend/admin_server/service_users.py
@file Backend/admin_server/service_projects.py
@file Backend/system_log_server/router.py
@file Backend/system_log_server/service.py
@file Backend/system_log_server/schemas.py
@file Frontend/react-app/src/shared/api/systemLogClient.js
@file Frontend/react-app/src/app/admin/UserHistoryPage.jsx
@file Frontend/react-app/src/app/admin/user-history.css

## 데이터 변경 추적(Phase 1.1~1.4)

### 전제
- DDL은 저장소에 sql 파일을 만들지 말고, docs/report/25 §3 블록을 운영에서 이미 실행했다고 가정한다.
- data_change_log.correlation_id 는 UUID (system_log.request_correlation_id 와 동일).

### 작업 A: Backend/core/change_tracker.py 신규
- PII_STRIP_FIELDS, _strip_pii, _json_serializable, capture_before(화이트리스트 table/pk_column),
  compute_diff, record_change(INSERT data_change_log, 실패 시 logger.exception 만),
  contextmanager track_update, 함수 track_delete, track_insert.
- record_change 는 conn.commit() 금지.

### 작업 B: admin_server
- service_users: 역할·ETL·정지·활성 등 user_info UPDATE 경로에 track_update (`pk_column='user_id'`).
- update_user_management는 사용자 루프/분기마다 track_update를 개별 적용하고, 실변경이 없는 경우(`compute_diff` 빈 값)는 자동 skip 처리한다.
- update_user_management에서 project 참여/권한 변경은 `project_info_id + ptcpnt_user_id`로 대상을 찾은 뒤 `project_ptcpnt_info_id`를 조회해 track_*에 전달한다.
- 하나의 API 요청에서 발생한 모든 track_*는 동일 `correlation_id(get_request_correlation_id())`를 공유한다.
- service_projects: update_member_role track_update; add_member 는 INSERT 후 track_insert;
  remove_member 는 DELETE 전 track_delete.
- correlation_id import: `from Backend.core.request_context import get_request_correlation_id`.

### 작업 C: system_log_server
- GET /api/system-logs/{system_log_id}/changes
- GET /api/system-logs/change-logs (쿼리: target_table, target_pk_value, channel, from, to, page, page_size)
- 권한·부서 스코프는 list_system_logs_paged 와 동일 패턴.

### 작업 D: schemas
- ChangeLogItem, ChangeLogListResponse (또는 기존 네이밍 규칙에 맞춤).

### 작업 E: 프론트
- systemLogClient: 변경 조회 API 래퍼.
- UserHistoryPage 시스템 탭: 변경 건수/모달(§7.1). 선택적으로 탭 change-logs(§7.2).

### 제약
- change_tracker 실패 시 본 업무 실패로 이어지지 않게 할 것.
- old_data/new_data 에 PII_STRIP_FIELDS 키 제거.
- SQL 식별자 인젝션 방지: table/pk_column 화이트리스트.
```

---

## §10. 검증 체크리스트

**구현·문서 정합(2026-04-27)** — 백엔드(`change_tracker`, admin 계측, `system_log_server` 두 GET)·프론트(시스템 탭 변경 모달·`tab=changes`)·`docs/main/03_API_GUIDE.md` §3.4·`docs/main/07_USER_FUNCTIONAL_GUIDE.md` §12.1 반영 완료. 아래 체크는 **운영 DB·실사용자 시나리오 E2E**에서 최종 확인한다.

- [ ] 관리 API 한 건 실행 후 `system_log` 행과 동일 `correlation_id`로 `data_change_log` 1건 이상 조회되는지.
- [ ] `user_info` 이메일 컬럼이 스냅샷에 **포함되지 않는지**(스트립 확인).
- [ ] 변경 없는 UPDATE 시 `data_change_log` 가 쌓이지 않는지(`track_update` diff 빈 경우).
- [ ] 통합 이력 화면에서 시스템 탭 **변경 상세** 표시.
- [ ] 권한: 타 부서 관리자가 타 부서 액터의 change_log 를 볼 수 없는지(기존 system_log 규칙과 동일).

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-04-27 | Phase 1: `widget_board_server`·`project_server`·`query_studio_server/router` 계측·`widget_board_share` 복합 PK; §5 표 동기 |
| 2026-04-27 | §5 Phase 1 표 전수 확장·Phase 2를 ETL·cross-DB 중심으로 재정렬; §1a 갭 표·현행 한 줄을 코드 반영에 맞춤 |
| 2026-04-27 | §1a: 목표 수집 범위(ibank_system_data·QS)·멀티 DB 이슈 vs 현행 구현 명문화 |
| 2026-04-27 | Phase 1 구현·통합 이력 UI·03·07 문서 동기, §10 구현 반영 문구 |
| 2026-04-20 | 초안: 최적 경로 확정, 단계별 범위, 수동 DDL, API·프론트·커서 명령문 |
