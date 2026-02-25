# ETL 가이드 및 참조

**목적**: ETL 페이지·백엔드(etl_server2) **참조** 및 **운영 시 확인 방법**.  
**범위**: 파일 업로드·DB 연동, 변환(T), Job 큐, 저장 DB 선택, 컬럼 매핑·COPY 적재. 실시간 스트리밍·변환 2차는 미구현.

---

## 1. 요약

| 항목 | 내용 |
|------|------|
| 목적 | 고객 데이터 업로드 또는 외부 DB 연동 → PostgreSQL 적재 |
| 방식 | (1) 파일 업로드 → 테이블 생성·일회 적재 (2) DB 등록 → Full/Incremental·Upsert |
| Backend | `Backend/etl_server2/` |
| Frontend | `Frontend/react-app/src/packages/etl2/` |
| 큐 | Job pending → 워커 running, 동시 2건 제한 |
| 적재 프로토콜 | PostgreSQL 적재 시 **COPY FROM STDIN** 사용(Full·Incremental 공통). Incremental은 임시 테이블 COPY 후 INSERT...ON CONFLICT. |

---

## 2. 시스템 개요

```
[소스] ──┬── 파일(CSV/Excel/Parquet) ──▶ [업로드] ──▶ [변환 T] ──▶ [저장 DB PostgreSQL]
         └── 외부 DB(PostgreSQL/MySQL/Oracle) ──▶ [추출 E] ──▶ [변환 T] ──▶ [저장 DB PostgreSQL]
```

- E: 파일 파싱 또는 외부 DB SELECT. T: 클렌징·타입·매핑·파생·마스킹. L: INSERT 또는 Upsert(COPY 기반).
- Job: pending → running → completed / failed / cancelled.
- 저장 DB: 기본 ibank_db 또는 등록한 저장 DB(etl_storage_connections) 선택 가능.

---

## 3. 전제·config

- **지원 파일**: CSV, Excel(.xlsx/.xls), Parquet. UTF-8 우선. **업로드 파일 3일** 초과 시 자동 삭제.
- **소스 DB**: PostgreSQL, MySQL, Oracle(목록·PK·적재 모두 지원).
- **저장 DB**: PostgreSQL 전용. `etl_storage_connections`로 등록·선택.

**config**

- **backend.db_*** : 비즈니스 DB(리포트·대시보드·allowed_tables).
- **backend.system_db**: ETL 메타용 DB(예: `ibank_system_data`). `etl_connections`, `etl_tables`, `etl_storage_connections`, `etl_transform_rules`, `etl_jobs`.
- **backend.etl_limits** (선택): `max_file_size_mb`, `max_rows_per_load`, `max_batch_size`. 0이면 한도 미적용. 저장 DB를 사용자 등록 DB로 바꿔도 동일 적용.

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
| etl_storage_connections | 저장 DB(PostgreSQL) 등록. connection_name, host, port, database_name, schema_name, username, encrypted_password, is_active |
| etl_tables | connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, status, batch_size, batch_interval_seconds, storage_connection_id, column_mapping, **on_row_error**, created_at 등 |
| etl_transform_rules | etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active |
| etl_jobs | job_id, etl_table_id, status, started_at, finished_at, rows_processed, total_rows, error_message, notice |

**etl_tables 주요 필드**

- **on_row_error**: `fail`(한 건이라도 실패 시 Job 전체 실패) 또는 `skip`(실패 행 제외 적재, 실패 내역은 Job notice에 기록). Incremental 모드에서만 적용.
- **target_table**: 동일 타겟 테이블명을 다른 연결(다른 DB)에서 추가 적재할 수 있도록 **중복 허용**. 삭제 시 같은 target_table을 쓰는 다른 ETL이 있으면 해당 테이블은 DROP하지 않음.

---

## 5. 모듈 의존

**Backend**: router.py → load_service.py, db_load_service.py, transform_rules_service.py, service.py, transform_engine.py, schema_infer.py.  
**Frontend**: ETLPage.jsx, FileUploadForm.jsx, DbConnectionForm.jsx, ETLTableList.jsx, EtlTableSettingsModal.jsx, shared/api/client.js (GET/POST/PATCH/DELETE /api/etl2/*).

---

## 6. Job 확인 (운영)

- **터미널**: `ETL file/db load started/completed/failed job_id=...` 로그.
- **시스템 DB**: `etl_jobs` (status, rows_processed, error_message, notice), `etl_tables` (target_table, status).
- **running 멈춤 시 수동 정리**: `etl_jobs` 해당 행 status='failed', error_message='수동 종료'; `etl_tables` 해당 etl_table_id status='error'.
- **파일 적재**: file_path 존재 여부(3일 경과 시 삭제). **DB 적재**: incremental 시 pk_columns·증분 컬럼 설정 권장(설정 모달에서 수정 가능).

---

## 7. 재실행 동작

| 소스 | sync_mode | 재실행 시 |
|------|-----------|-----------|
| 파일 | - | DROP → CREATE → 전체 INSERT |
| DB | full | DROP → CREATE → 전체 INSERT |
| DB | incremental | 테이블 유지, last_synced_at 이후만 Upsert |

- **동기화 모드 변경**: 목록에서 **설정** 버튼 → 모달에서 전체/증분 전환, 증분 시 증분 컬럼·배치·행 실패 시 동작 등 수정 후 저장. 전체로 한 번 넣은 뒤 증분으로 바꿔 이후만 증분 적재하는 흐름 지원.

---

## 8. 파일/DB 동작 요약

- **실행 중 삭제**: Job을 cancelled로 바꾸지 않으면 워커는 계속 진행. 삭제 전 취소 권장.
- **done 후 실행**: 파일은 전체 교체; DB full은 DROP 후 재생성.
- **타겟 테이블명**: 동일 target_table을 **다른 연결(다른 DB)**에서 같은 테이블로 추가 적재할 수 있도록 등록 허용. 메인 DB에 테이블이 이미 있으면 **full** 등록 시 거부, **incremental**은 허용.
- **연결 해제·ETL 삭제**: 해당 target_table을 다른 ETL이 사용 중이면 타겟 테이블은 DROP하지 않고 메타만 삭제.

---

## 9. DB 연결 실패 시 점검

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
- **MySQL(3306)**: ETL 연결 테스트·적재 시 소스는 MySQL/Oracle 지원. 저장 DB는 PostgreSQL만 지원.

**점검 순서**

1. Backend 실행 호스트 확인 → 그 IP가 외부 DB 쪽 "접속 시도 클라이언트 IP".
2. Backend 터미널: `ETL DB 연결 시도/실패` 로그로 error_type·error 확인.
3. 외부 DB 서버: 방화벽 5432 인바운드, 허용 소스에 **Backend 호스트 IP** 포함. PostgreSQL `listen_addresses`('*' 또는 '0.0.0.0'), `pg_hba.conf`에 Backend IP 허용.
4. Backend 호스트에서 `telnet <외부DB호스트> 5432` 또는 `Test-NetConnection -Port 5432` 로 TCP 연결 가능 여부 확인.

---

## 10. Phase·구현 요약

| Phase | 요약 |
|-------|------|
| 0 | 적재 DB 연결 획득을 `get_target_db_connection(storage_connection_id)`로 통일 |
| 1 | 저장 DB 등록 탭, etl_storage_connections, 연결 테스트(접속+CREATE/INSERT/DROP 권한) |
| 2a | etl_tables.storage_connection_id, UI 저장할 DB 셀렉트박스 |
| 2b | 적재 시 저장 DB 분기, storage_connection_id 있으면 add_allowed_table 스킵 |
| 3 | 테이블선택·컬럼매핑 버튼·모달, 저장 DB 기준 테이블/컬럼 조회 |
| 4 | column_mapping JSONB, 소스↔타겟 매핑·타입·변환 실패 시 정책(on_error) |
| 5 | 통합 검증, 문서·권한 정리 |
| 6 | 큐·모니터링, 동기화 모드·설정 모달, on_row_error, COPY·fallback |

---

## 11. ZIP 다중 파일 추가 적재

- **엔드포인트**: `POST /api/etl2/tables/{etl_table_id}/add-files-zip` (multipart: zip 1개).
- **흐름**: ZIP을 `uploads/zip_<uuid>/`에 해제 → 지원 형식(.csv, .xlsx, .xls, .parquet)·max_file_size_mb 이하만 유효 → **파일명 자연 정렬** 순으로 Job 등록 → 워커가 순차 실행. 타겟 테이블은 **이미 존재** 가정(컬럼 생성 없음).
- **건너뛴 파일**: API 응답 `skipped_files: [{ filename, reason }]`. reason: `file_too_large`, `unsupported_format`, `schema_or_pk_failed`. 한 파일 실패해도 나머지 Job 등록·실행.

---

## 12. ETL 목록 버튼·상태별 동작

**상태**: draft(미실행, 타겟 없음), error(실패), done(성공, 타겟 있음).

| 버튼 | draft/error | done |
|------|-------------|------|
| 미리보기 | 파일 10행 + 컬럼 표시 | 동일(파일 기준) |
| 실행 | 파일로 테이블 생성(또는 재생성) | 파일로 **전체 교체** |
| 데이터 추가 | 실패(테이블 없음) | 새 파일을 같은 테이블에 **업서트** (파일 소스만) |
| **설정** | DB 소스만 표시 | 동기화 모드·증분 컬럼·배치·행 실패 시 동작 수정(모달) |
| 삭제 | 메타+파일 삭제, DROP IF EXISTS(다른 ETL이 같은 target 쓰지 않을 때만) | 동일 |

- 데이터 추가 = "등록된 소스 파일 변경"이 아님. 이미 있는 타겟 테이블에 새 파일 업서트(분할 적재용).

---

## 13. COPY 적재 이해하기

DB 소스에서 가져온 데이터를 저장 DB(PostgreSQL)에 넣을 때 **COPY FROM STDIN** 프로토콜을 사용한다. 왜 쓰는지, 동작을 비유와 단계로 정리한다.

### 13.1 기존 방식(executemany) vs COPY

| 방식 | 비유 | 동작 |
|------|------|------|
| **executemany (기존)** | 편의점 택배 | 박스 하나 가져가서 접수하고, 돌아와서 또 하나… 10,000번 반복. 매번 "이거 보낼게요" → "접수했습니다" 왕복 발생. |
| **COPY (현행)** | 이삿짐 트럭 | 박스 10,000개를 트럭에 싣고, 한 번에 창고에 부어넣음. 왕복 1번. |

실제로는 Python에서 **텍스트 스트림**을 만들고, PostgreSQL이 그 스트림을 **SQL 파싱 없이** 직접 저장하는 방식이다.

### 13.2 단계별 동작

**1단계: Python에서 데이터를 텍스트로 만든다**

- 메모리 안에 가상의 텍스트 파일(`io.StringIO`)을 만들고, 행마다 **탭(`\t`)으로 컬럼 구분**, **줄바꿈(`\n`)으로 행 구분**해서 쓴다. NULL은 `\N`이라는 약속된 표시.
- 예: `홍길동\t30\t서울\n`, `김철수\t25\t부산\n`, `박영희\t\N\t대전\n`
- 이 작업을 하는 함수가 `_copy_buf`(내부에서 `_serialize_value`로 값 직렬화).

**2단계: PostgreSQL에 "벌크로 받아라" 신호를 보낸다**

- `cur.copy_expert("COPY 테이블명 FROM STDIN ...", buf)` 호출.
- `copy_expert`가 하는 일: (1) PostgreSQL에 "지금부터 COPY 모드"라고 알림, (2) 위에서 만든 텍스트 데이터를 네트워크로 스트리밍 전송.

**3단계: PostgreSQL이 받아서 직접 저장한다**

- 일반 INSERT: SQL 텍스트 → 문법 분석(파서) → 실행 계획(플래너) → 실행 → 저장.
- COPY: **데이터 스트림 → 바로 저장**. 문법 분석·실행 계획을 거치지 않아 빠르다.
- PostgreSQL은 테이블 데이터를 디스크 파일로 가지고 있으며, COPY는 그 파일 끝에 데이터를 이어붙이는 형태로 동작한다.

### 13.3 Upsert가 필요할 때(증분 모드)

COPY는 **INSERT만** 지원한다. "이미 있으면 업데이트(UPSERT)" 기능이 없어, 아래 **우회 경로**를 쓴다.

1. **빈 임시 테이블**을 만든다(구조만 같고 데이터 없음). 컬럼은 모두 **TEXT**로 두어 COPY 단계에서는 타입 오류 없이 받을 수 있게 한다.
2. **임시 테이블에 COPY로** 데이터를 쏟아넣는다(초고속).
3. **임시 → 본 테이블**로 옮긴다. "이미 있으면 업데이트, 없으면 새로 넣어"는 SQL 한 문장으로 처리: `INSERT INTO 본테이블 SELECT col::타입 ... FROM 임시 ON CONFLICT (기본키) DO UPDATE SET ...`
4. commit 시 임시 테이블은 `ON COMMIT DROP`으로 자동 삭제.

임시 테이블을 TEXT로 두는 이유: COPY 단계에서 타입이 안 맞으면(예: 숫자 자리에 "abc") **통째로 실패**하고 위치도 안 알려준다. TEXT면 뭐든 받을 수 있어 COPY는 실패하지 않고, 타입 검사는 3단계(INSERT...SELECT)에서 이루어져 "몇 번째 값이 문제다"를 알 수 있다.

### 13.4 on_row_error 옵션

3단계(INSERT...SELECT 또는 행 단위 fallback)에서 타입이 안 맞는 행이 있으면:

| 모드 | 동작 |
|------|------|
| **fail** | 에러 발생 → Job 실패(전체 중단). |
| **skip** | 해당 배치만 **느린 방식(행 단위 INSERT)**으로 전환. 되는 행은 넣고, 안 되는 행은 건너뛰며 실패 내역을 Job **notice**에 기록. |

### 13.5 전체 흐름 한 장 정리

```
MySQL/Oracle에서 N건씩 fetch (배치 크기 적용)
         │
         ▼
  Python DataFrame 변환·가공 (변환 룰·매핑 형변환)
         │
         ▼
  텍스트 직렬화 (TSV 형태)     ← _copy_buf()
         │
         ▼
  ┌── full 모드 ──────────────────┐
  │  COPY로 본 테이블에 직접 넣기   │  ← _copy_insert_batch()
  └──────────────────────────────┘
  ┌── incremental 모드 ───────────┐
  │  COPY로 임시 테이블에 넣기     │  ← _copy_upsert_batch()
  │  임시 → 본 테이블 upsert      │
  │  (실패 시 행 단위 재시도)      │  ← _copy_upsert_batch_safe()
  └──────────────────────────────┘
         │
         ▼
     commit → 다음 배치 반복
```

요약하면, (1) **COPY는 텍스트 스트림을 PostgreSQL에 보내 SQL 파싱 없이 바로 저장**하고, (2) **Upsert가 필요하면 빈 임시 테이블을 거쳐 우회**한다는 두 가지만 이해하면 된다.

---

## 14. DB 적재 상세: COPY·Upsert·fallback

**적용 위치**: `Backend/etl_server2/db_load_service.py`의 `run_db_load` (스트리밍 분기·전체 fetch 분기).

### 14.1 헬퍼 함수

| 함수 | 역할 |
|------|------|
| _serialize_value(v) | COPY TEXT 포맷용 값 직렬화. None·nan·inf·NaT·pd.isna → `\N`. 그 외는 str 후 `\`·`\t`·`\n`·`\r` 이스케이프. |
| _copy_buf(cols, rows_tuples) | rows_tuples를 COPY용 텍스트 버퍼로 변환(탭 구분·줄 끝 개행). io.StringIO 반환, seek(0) 완료. |
| _copy_insert_batch(...) | Full 모드: COPY full_name FROM STDIN으로 직접 적재. |
| _copy_upsert_batch(...) | Incremental: TEMP 테이블(전 컬럼 TEXT) 생성 → COPY 스테이징 → INSERT...SELECT col::타입 ... ON CONFLICT DO UPDATE. |
| _row_fallback(...) | COPY/upsert 실패 시 해당 배치만 행 단위 INSERT...ON CONFLICT 시도. 성공 행 적재, 실패 행은 수집해 반환. |
| _copy_upsert_batch_safe(...) | 1차 _copy_upsert_batch 시도 → 실패 시 rollback 후 _row_fallback 호출. (inserted_count, failed_rows) 반환. |

### 14.2 run_db_load 요약

- **on_row_error**: `fail`이면 기존처럼 _copy_upsert_batch만 호출(한 건 실패 시 Job 실패). `skip`이면 _copy_upsert_batch_safe 사용, 실패 행은 notice에 기록하고 Job은 completed 유지.
- **first_batch에서 확정·재사용**: columns_final, cols, col_defs, col_types. 배치별 commit, is_job_cancelled, last_synced_at, CREATE TABLE/존재 확인 로직 유지.
- **MySQL 배치**: batch_size=0이면 1만 행 단위. 1만 초과 입력 시 최대 1만으로 제한(연결 유지·net_write_timeout 완화).

---

## 15. 매핑 형변환·행 실패 정책

- **column_mapping**: 소스→타겟 매핑에 **target 타입**과 **on_error**(변환 실패 시 정책) 지정. 적재 직전에 `apply_mapping_type_cast(df, column_mapping, default_on_error="null")`로 해당 타입 변환 적용.
- **변환 실패 시 옵션**: `null`(NULL로 적재), `zero`, `keep`(원본 유지), `skip_row`, `fail`. 기본은 `null`.
- **행 단위 적재 실패**(DB 적재 시 CAST/제약 위반 등): etl_tables.**on_row_error**로 제어. `fail`=한 건이라도 실패 시 Job 실패, `skip`=실패 행 제외·성공만 적재·실패 요약을 Job notice에 기록.

---

## 참고 파일

- **Backend**: etl_server2/service.py (연결·메타·get_target_db_connection), db_load_service.py (run_db_load, COPY·fallback), load_service.py (파일 적재), transform_engine.py (apply_rules, apply_mapping_type_cast).
- **Frontend**: etl2/ETLPage.jsx, DbConnectionForm.jsx, ETLTableList.jsx, EtlTableSettingsModal.jsx.
- **인덱스**: 본 문서는 00_ReportIndex.md에 08_ETL_Phase_Implement_Guide.md로 등록.
