# ETL 가이드 및 참조

**목적**: ETL 페이지·백엔드(etl_server) **참조** 및 **운영 시 확인 방법**.  
**범위**: 파일 업로드·DB 연동, 변환(T) 1차, Job 큐. 실시간 스트리밍·변환 2차 미구현.

---

## 1. 요약

| 항목 | 내용 |
|------|------|
| 목적 | 고객 데이터 업로드 또는 외부 DB 연동 → 우리 PostgreSQL 적재 |
| 방식 | (1) 파일 업로드 → 테이블 생성·일회 적재 (2) DB 등록 → Full/Incremental·Upsert |
| Backend | `Backend/etl_server/` |
| Frontend | `Frontend/react-app/src/packages/etl/` |
| 큐 | Job pending → 워커 running, 동시 2건 제한 |

---

## 2. 시스템 개요

```
[소스] ──┬── 파일(CSV/Excel/Parquet) ──▶ [업로드] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
         └── 외부 DB(PostgreSQL 등) ────▶ [추출 E] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
```

- E: 파일 파싱 또는 외부 DB SELECT. T: 클렌징·타입·매핑·파생·마스킹. L: INSERT 또는 Upsert.
- Job: pending → running → completed / failed / cancelled.

---

## 3. 전제·config

- **지원 파일**: CSV, Excel(.xlsx/.xls), Parquet. UTF-8 우선. **업로드 파일 3일** 초과 시 자동 삭제.
- **DB**: PostgreSQL(✅), MySQL(✅), Oracle(목록·PK 조회 ✅, 적재 Phase 3 예정).

**config**

- **backend.db_*** : 비즈니스 DB(리포트·대시보드·allowed_tables).
- **backend.system_db**: ETL 메타용 DB(예: `ibank_system_data`). `etl_connections`, `etl_tables`, `etl_transform_rules`, `etl_jobs`.
- **backend.etl_limits** (선택): `max_file_size_mb`, `max_rows_per_load`, `max_batch_size`. 0이면 한도 미적용.

**배치·실행 시점**

| 항목 | 의미 |
|------|------|
| 배치 크기/배치 간 대기 | **한 번 실행** 안에서의 fetch 단위·대기. 스케줄 아님. |
| 매일 몇 시 실행 | **미구현.** 스케줄러 없음. |
| 실행 시점 | **"실행" 버튼**으로만 pending 등록 → 워커가 실행. draft여도 자동 실행 없음. |

---

## 4. 메타 테이블 (시스템 DB)

| 테이블 | 용도 |
|--------|------|
| etl_connections | 연결명, source_type, host, port, database_name, schema_name, username, encrypted_password |
| etl_tables | connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, status, batch_size, batch_interval_seconds |
| etl_transform_rules | etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active |
| etl_jobs | job_id, etl_table_id, status, started_at, finished_at, rows_processed, total_rows, error_message |

---

## 5. 모듈 의존

**Backend**: router.py → load_service.py, db_load_service.py, transform_rules_service.py, service.py, transform_engine.py, schema_infer.py.  
**Frontend**: ETLPage.jsx, FileUploadForm.jsx, DbConnectionForm.jsx, ETLTableList.jsx, shared/api/client.js (GET/POST/DELETE /api/etl/*).

---

## 6. Job 확인 (운영)

- **터미널**: `ETL file/db load started/completed/failed job_id=...` 로그.
- **시스템 DB**: `etl_jobs` (status, rows_processed, error_message), `etl_tables` (target_table, status).
- **running 멈춤 시 수동 정리**: `etl_jobs` 해당 행 status='failed', error_message='수동 종료'; `etl_tables` 해당 etl_table_id status='error'.
- **파일 적재**: file_path 존재 여부(3일 경과 시 삭제). **DB 적재**: incremental 시 pk_columns 필수.

---

## 7. 재실행 동작

| 소스 | sync_mode | 재실행 시 |
|------|-----------|-----------|
| 파일 | - | DROP → CREATE → 전체 INSERT |
| DB | full | DROP → CREATE → 전체 INSERT |
| DB | incremental | 테이블 유지, last_synced_at 이후만 Upsert |

---

## 8. 파일/DB 동작 요약

- **실행 중 삭제**: Job을 cancelled로 바꾸지 않으면 워커는 계속 진행. 삭제 전 취소 권장.
- **done 후 실행**: 파일은 전체 교체; DB full은 DROP 후 재생성. Run 비활성화는 UI 선택 사항.
- **타겟 테이블명 중복**: etl_tables에 동일 target_table 있으면 등록 거부. 메인 DB에 테이블 있으면 **full**일 때만 거부, **incremental**일 때는 허용(파일로 만든 테이블에 DB 증분 ETL 추가 가능).

---

## 9. DB 연결 실패 시 점검 (09 통합)

**연결 구조**

- 브라우저 → (HTTP) → **Backend** → (TCP) → **외부 DB**. 브라우저는 외부 DB에 직접 연결하지 않음.
- **외부 DB 입장의 접속 출발지 IP** = **Backend가 실행 중인 호스트의 IP**.

**실패 지점 (코드)**

| 순서 | 위치 | 실패 시 사용자 메시지 예 |
|------|------|---------------------------|
| 1 | router.py `POST /connections/test` | 500, detail |
| 2 | service.py `test_connection()` | 연결 없음 → "연결을 찾을 수 없습니다." |
| 3 | service.py `test_connection()` | host/database_name/username 누락 → "host, database_name, username가 필요합니다." |
| 4 | service.py `_connect_postgres()` | **TCP/인증 실패(가장 많음)** → 아래 예외별 표 |
| 5 | test_connection() | SELECT 1 예외 → _connection_error_to_user_message 변환 |

**예외별 메시지 (PostgreSQL)**

| 예외/패턴 | message | hint |
|-----------|---------|------|
| timed out / 10060 / connection timed out | 서버에 연결할 수 없습니다. 시간이 초과되었습니다. | 방화벽·포트·DB 수신·VPN |
| connection refused / 111 | 연결이 거부되었습니다. | DB 실행·listen_addresses·pg_hba.conf |
| password authentication failed | 인증에 실패했습니다. | 사용자명·비밀번호·pg_hba.conf |
| could not translate host / getaddrinfo failed | 호스트(주소)를 찾을 수 없습니다. | 호스트명·IP·DNS |
| database or role does not exist | 지정한 데이터베이스 또는 사용자가 존재하지 않습니다. | DB명·사용자명 |
| 기타 | 연결에 실패했습니다. | 호스트·포트·DB명·방화벽 점검 |

- **타임아웃**: `service.py` `_CONNECT_TIMEOUT_SEC = 15`. 15초 내 TCP 미완료 시 실패.
- **3306**: MySQL 포트. ETL 연결 테스트·DB 적재는 PostgreSQL(5432) 전용. 3306 사용 시 프로토콜 불일치·타임아웃 가능.

**점검 순서**

1. Backend 실행 호스트 확인 → 그 IP가 외부 DB 쪽 "접속 시도 클라이언트 IP".
2. Backend 터미널: `ETL DB 연결 시도/실패` 로그로 error_type·error 확인.
3. 외부 DB 서버: 방화벽 5432 인바운드, 허용 소스에 **Backend 호스트 IP** 포함. PostgreSQL `listen_addresses`('*' 또는 '0.0.0.0'), `pg_hba.conf`에 Backend IP 허용.
4. Backend 호스트에서 `telnet <외부DB호스트> 5432` 또는 `Test-NetConnection -Port 5432` 로 TCP 연결 가능 여부 확인.

**구현 위치**: router.py `POST /connections/test`, service.py `test_connection()`, `_connect_postgres()`, `_connection_error_to_user_message()`.

---

## 10. Phase 순서

| Phase | 요약 |
|-------|------|
| 0 | 사전(폴더, 메타 4개, 의존성, etl 패키지) |
| 1 | 백엔드 기초·파일 업로드 API |
| 2 | 파일 E/L(파싱, 테이블 생성, 일회 적재) |
| 3 | DB E/L(연결 등록, Full·Incremental, Upsert) |
| 4 | 변환(T) 1차(클렌징, 타입, 매핑, 파생, 마스킹) |
| 5 | ETL 페이지 UI(소스 선택, 파일/DB 폼, 목록, Job·로그) |
| 6 | 큐·모니터링(동시 2건, 취소·연결 해제 등) |

---

## 11. ZIP 다중 파일 추가 적재

- **엔드포인트**: `POST /api/etl/tables/{etl_table_id}/add-files-zip` (multipart: zip 1개).
- **흐름**: ZIP을 `uploads/zip_<uuid>/`에 해제 → 지원 형식(.csv, .xlsx, .xls, .parquet)·max_file_size_mb 이하만 유효 → **파일명 자연 정렬** 순으로 Job 등록 → 워커가 순차 실행. 타겟 테이블은 **이미 존재** 가정(컬럼 생성 없음).
- **건너뛴 파일**: API 응답 `skipped_files: [{ filename, reason }]`. reason: `file_too_large`, `unsupported_format`, `schema_or_pk_failed`. 한 파일 실패해도 나머지 Job 등록·실행.

---

## 12. ETL 목록 버튼·상태별 동작

**상태**: draft(미실행, 타겟 없음), error(실패), done(성공, 타겟 있음).

| 버튼 | draft/error | done |
|------|-------------|------|
| 미리보기 | 파일 10행 + 컬럼 표시 | 동일(파일 기준) |
| 실행 | 파일로 테이블 생성(또는 재생성) | 파일로 **전체 교체** |
| 데이터 추가 | 실패(테이블 없음) | 새 파일을 같은 테이블에 **업서트** |
| 삭제 | 메타+파일 삭제, DROP IF EXISTS | 메타+파일 삭제, DROP |

- 데이터 추가 = "등록된 소스 파일 변경"이 아님. 이미 있는 타겟 테이블에 새 파일 업서트(분할 적재용).
