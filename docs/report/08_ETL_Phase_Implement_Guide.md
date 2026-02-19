# ETL 가이드 및 참조

**목적**: ETL 페이지·백엔드(etl_server)의 **참조 정보**와 **운영 시 확인 방법**을 한 문서에 정리.  
**범위**: 파일 업로드·DB 연동, 변환(T) 1차, Job 큐. 실시간 스트리밍·변환 2차는 미구현.

---

## 1. 목적·범위·요구사항 요약

| 항목 | 내용 |
|------|------|
| **목적** | 고객이 데이터를 업로드하거나 외부 DB를 연동해 우리 PostgreSQL에 적재. |
| **방식** | (1) 파일 업로드 → 테이블 생성·일회성 적재 (2) 서버 DB 등록 → 배치 Full/Incremental·Upsert. |
| **변환** | 클렌징, 타입 변환, 코드 매핑, 파생, 마스킹(1차). 조인/피벗/SCD 등은 추후. |
| **Backend** | `Backend/etl_server/`. ETL 메타·업로드·적재·큐. |
| **Frontend** | `Frontend/react-app/src/packages/etl/`. 단일 ETL 페이지, 소스 유형(파일/DB) 선택. |
| **큐** | Job pending → 워커가 running으로 선점, 동시 2건 제한, 완료/실패 시 상태 갱신. |

---

## 2. 시스템 개요

```
[소스] ──┬── 파일(CSV/Excel/Parquet) ──▶ [업로드] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
         └── 외부 DB(PostgreSQL 등) ────▶ [추출 E] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
```

- **E**: 파일 파싱 또는 외부 DB SELECT.
- **T**: 클렌징, 타입 변환, 매핑, 파생, 마스킹.
- **L**: 우리 PostgreSQL에 INSERT(일회) 또는 Upsert(배치).
- **Job 상태**: pending → running → completed / failed / cancelled.

---

## 3. 전제 조건·config

- **지원 파일**: CSV, Excel(.xlsx/.xls), Parquet. CSV 인코딩 UTF-8 우선.
- **DB 연동 1차 목표**: PostgreSQL, Oracle, MySQL. **현재 구현**: PostgreSQL만 동작. Oracle·MySQL은 미구현(추가 개발 필요).
- **업로드 파일 보관**: **3일** 초과 시 자동 삭제. 3일 후 동일 ETL 재실행 시 파일 없음으로 실패할 수 있음.

**DB 연동 구현 현황**

| DB | 포트(기본) | 연결 테스트 | 소스 테이블 목록 | DB 적재(Full/Incremental) | 비고 |
|----|------------|------------|------------------|---------------------------|------|
| **PostgreSQL** | 5432 | ✅ | ✅ | ✅ | psycopg2. |
| **MySQL** | 3306 | ✅ | ✅ | ✅(Phase 2 완료) | PyMySQL. TABLE_SCHEMA=DB명, backtick 인용. |
| **Oracle** | 1521 | ✅ | ✅ | 🔲 Phase 3 예정 | oracledb. ALL_TABLES/USER_TABLES. |

**§3.3 DB 연동 MySQL·Oracle 적재 구현 페이즈**

| Phase | 내용 | 상태 |
|-------|------|------|
| **Phase 1** | 소스 테이블 목록(list_source_tables) MySQL·Oracle 지원. create_etl_table 시 PK 자동 조회 MySQL·Oracle. | ✅ 완료 |
| **Phase 2** | run_db_load에서 **MySQL** 소스 지원: MySQL 연결·컬럼 조회·PK·SELECT(배치/전체)·메인 DB 적재. | ✅ 완료 |
| **Phase 3** | run_db_load에서 **Oracle** 소스 지원: Oracle 연결·컬럼 조회·PK·SELECT·메인 DB 적재. | 🔲 예정 |

### 3.1 config 구분 (시스템 DB)

리포트/대시보드용 DB와 **시스템용 DB**를 구분한다.

- **backend.db_name**: 비즈니스 데이터(리포트·대시보드·allowed_tables).
- **backend.system_db**: 시스템 테이블용. DB명 예: `ibank_system_data`. ETL 메타(`etl_connections`, `etl_tables`, `etl_transform_rules`, `etl_jobs`) 등.

**config 예시**

```json
"backend": {
  "db_host": "호스트", "db_port": 5432, "db_name": "리포트용_DB명",
  "db_user": "계정", "db_password": "비밀번호", "table_schema": "public",
  "system_db": {
    "db_host": "동일_호스트", "db_port": 5432, "db_name": "ibank_system_data",
    "db_user": "동일_계정", "db_password": "동일_비밀번호", "table_schema": "public"
  }
}
```

- 기존 로직: `db.get_db_connection()` → backend DB.
- ETL 메타: `db.get_db_connection_system()`, `db.get_system_table_schema()`.

### 3.2 ETL 한도(etl_limits, 램 오버 방지)

`backend.etl_limits` 로 1회 적재당 최대 행 수·파일 크기·배치 크기 상한을 둘 수 있다. 없으면 한도 미적용(0).

| 키 | 의미 | 기본 |
|----|------|------|
| **max_file_size_mb** | 파일 적재 시 파일 크기 상한(MB). 초과 시 거부. | 0(검사 안 함) |
| **max_rows_per_load** | 1회 적재당 최대 행 수. 파일은 해당 행까지만 읽고, DB는 이 행 수까지만 가져와 적재. | 0(무제한) |
| **max_batch_size** | DB 적재 시 배치당 최대 행 수(사용자 batch_size 상한). 배치 스트리밍 시 메모리에 쌓는 행 수 상한. | 0(사용자 설정 그대로) |

**config 예시** (config.json 의 `backend` 안에 추가)

```json
"etl_limits": {
  "max_file_size_mb": 200,
  "max_rows_per_load": 1000000,
  "max_batch_size": 50000
}
```

- **파일**: 크기 > max_file_size_mb 이면 실패. CSV는 max_rows_per_load 만큼만 읽고, Excel/Parquet는 읽은 뒤 해당 행 수로 자른다.
- **DB**: 사용자 batch_size가 있으면 min(사용자값, max_batch_size) 로 배치 단위 스트리밍(메모리에 전체를 쌓지 않음). batch_size가 0이면 SELECT에 LIMIT max_rows_per_load 적용.

### 3.4 배치 설정·실행 시점 (중요)

| 항목 | 의미 | 비고 |
|------|------|------|
| **배치 크기(batch_size)** | **한 번의 실행** 안에서 소스에서 몇 행씩 가져올지. | 0/NULL이면 전체 한 번에. 목록 "배치" 열에 표시. |
| **배치 간 대기(batch_interval_seconds)** | **한 번의 실행** 안에서 배치마다 쉬는 시간(초). 소스 DB 부하 완화용. | 0이면 대기 없음. 목록 "배치" 열에 표시. |
| **매일 몇 시 실행** | **현재 미구현.** 스케줄(cron/정해진 시각) 없음. | "매일 02시에 증분 적재" 같은 기능은 없음. |
| **실행 시점** | **사용자가 "실행" 버튼을 눌렀을 때만** 대기열(pending) 등록 → 워커가 실행. | API/워커에 스케줄러 없음. |
| **draft 상태와 자동 실행** | **draft여도 자동 실행 없음.** 스케줄이 없으므로, 증분을 돌리려면 사용자가 직접 "실행"을 눌러야 함. | done/error여도 마찬가지로 자동 실행 없음. |

- 요약: 배치 크기·배치 간 대기는 **한 번 실행할 때의 내부 설정**일 뿐이며, **"매일 몇 시에 자동으로 증분 적재"**는 현재 제공하지 않음. 자동 스케줄이 필요하면 추후 스케줄러(예: cron 호출, 또는 etl_tables에 schedule_cron 등 메타 추가) 개발이 필요함.

---

## 4. 메타 테이블·DDL 참조

시스템 DB에 아래 4개 테이블 필요. etl_jobs, etl_tables 배치 컬럼(batch_size, batch_interval_seconds), etl_jobs.total_rows 등은 일회성 DDL로 이미 적용된 상태를 가정.

| 테이블 | 용도 |
|--------|------|
| **etl_connections** | 소스 연결 정보(연결명, source_type, host, port, database_name, schema_name, username, encrypted_password 등). |
| **etl_tables** | 작업 정의(connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, status, batch_size, batch_interval_seconds 등). |
| **etl_transform_rules** | 변환 룰(etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active). |
| **etl_jobs** | Job 이력(job_id, etl_table_id, status, started_at, finished_at, rows_processed, total_rows, error_message). |

- **batch_size**: DB 적재 시 한 번에 가져올 행 수. NULL/0이면 전체.
- **batch_interval_seconds**: 배치 간 대기(초). 0이면 대기 없음.

---

## 5. 모듈·의존 관계

### 5.1 Backend (의존도 높은 순)

| 순서 | 파일 | 역할 |
|------|------|------|
| 1 | router.py | /api/etl API 진입. service, load_service, db_load_service, schema_infer, transform_rules_service 호출. |
| 2 | load_service.py | 파일 적재: get_etl_table → 파싱 → 변환 룰 → 메인 DB DROP/CREATE/INSERT. |
| 3 | db_load_service.py | DB 적재: get_etl_table → 소스 연결 → Full/Incremental → 변환 → 메인 DB. |
| 4 | transform_rules_service.py | etl_transform_rules CRUD. |
| 5 | service.py | 시스템 DB 전용(메타 CRUD, Job 상태). api_server.db 사용. |
| 6 | transform_engine.py | 변환 룰 적용(pandas). |
| 7 | schema_infer.py | 스키마 추론(pandas). |

### 5.2 Frontend

| 파일 | 역할 |
|------|------|
| ETLPage.jsx | 소스 유형 선택, FileUploadForm / DbConnectionForm, ETLTableList, JobLogPanel. |
| FileUploadForm.jsx | 파일 업로드, etlUploadFile. |
| DbConnectionForm.jsx | 연결 등록·테스트·소스 테이블 선택·etlCreateTable. |
| ETLTableList.jsx | etlListTables, 실행/삭제 버튼. |
| shared/api/client.js | GET/POST/DELETE /api/etl/* (tables, upload, run, jobs, connections 등). |

---

## 6. Job 확인 방법 (운영)

상태가 **running**인데 적재가 안 되는 것 같을 때 아래 순서로 확인.

### 6.1 터미널 로그

`python run.py back` 터미널에서:

| 로그 | 의미 |
|------|------|
| `ETL file load started etl_table_id=... job_id=...` | 파일 적재 시작. |
| `ETL db load started etl_table_id=...` | DB 적재 시작. |
| `ETL file/db load completed job_id=... rows_processed=...` | 성공. |
| `ETL file/db load failed job_id=...` | 실패. 아래 traceback 확인. |

"started"만 있고 "completed"/"failed"가 없으면 실행 중이거나 워커 예외 가능.

### 6.2 DB 조회 (시스템 DB)

```sql
SELECT job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message
FROM etl_jobs ORDER BY job_id DESC LIMIT 20;

SELECT etl_table_id, target_table, status, source_type, file_path, source_table
FROM etl_tables ORDER BY etl_table_id DESC LIMIT 20;
```

- `status = 'running'` 이고 `finished_at` NULL → 실행 중 또는 워커 종료로 미갱신.
- `status = 'failed'` → `error_message` 확인.

### 6.3 파일 적재 시

- `etl_tables.file_path` 경로가 서버에 존재하는지. (3일 지나면 정리로 삭제됨.)
- 메인 DB에 `target_table` 존재·건수: `SELECT COUNT(*) FROM "스키마"."타겟테이블";`

### 6.4 DB 적재 시

- 소스 연결: `POST /api/etl/connections/test` 등으로 확인.
- incremental 모드: `pk_columns` 필수. 비어 있으면 실패.

### 6.5 running으로 멈춘 Job 수동 정리

```sql
UPDATE etl_jobs
SET status = 'failed', finished_at = NOW(), error_message = '수동 종료(확인 후 정리)'
WHERE status = 'running' AND job_id = <job_id>;

UPDATE etl_tables SET status = 'error', updated_at = NOW() WHERE etl_table_id = <etl_table_id>;
```

---

## 7. 재실행·예상 완료 시간

### 7.1 이미 올라간 테이블에 "실행" 다시 누를 때

| 소스 | sync_mode | 재실행 시 동작 |
|------|-----------|----------------|
| **파일** | - | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **full** | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **incremental** | 테이블 유지. last_synced_at 이후만 조회 후 **Upsert.** |

### 7.2 예상 완료 시간(ETA)

- **가능 여부**: 가능(구현 필요). 총 건수 + 주기적 `rows_processed` 갱신 후, 프론트에서 진행률·ETA 계산.
- **전제**: 파일은 전체 읽은 뒤 INSERT이므로, ETA를 쓰려면 배치 단위 처리·진행률 갱신 선행 필요. DB는 COUNT(*) 또는 배치 추출로 total 확보 후 동일.

---

## 8. 파일/DB 동작 검증 요약

### 8.1 파일 업로드

| 상황 | 기대 | 현재 | 비고 |
|------|------|------|------|
| 업로드 후 목록 | 목록에 현황 + 실행/삭제 | ✅ 표시 | - |
| **실행 중 삭제** | 인서트 멈춤 → DROP·파일 삭제 | ⚠️ DROP·메타·파일 삭제만. Job을 cancelled로 바꾸지 않아 워커는 취소 인지 못함. 테이블 DROP 후 INSERT 에러로 중단. | 삭제 전 Job cancelled 권장. |
| **실행 완료 후** | 실행 버튼 비활성화(완료), 삭제 시 DROP·파일 삭제 | 삭제 동작 ✅. 실행 버튼은 완료(done)여도 비활성화 안 함. | 완료 시 Run 비활성화 권장. |
| 3일 후 파일 없을 때 삭제 | DROP만 | ✅ DROP, 파일 unlink no-op | - |

### 8.2 DB 연결(postgresql)

| 상황 | 현재 동작 |
|------|-----------|
| 목록 | 타겟·설명·소스 유형·소스 테이블·상태·실행/삭제 표시. |
| 실행 | pending → 워커 run_db_load. full: DROP+CREATE+INSERT, incremental: Upsert. |
| 실행 중 삭제 | 파일과 동일. Job cancelled 선처리 없음. DROP·메타 삭제. |
| 실행 완료 후 | Run 비활성화 없음. 삭제 시 타겟 DROP·메타 삭제(파일 없음). |

### 8.3 권장 수정

1. **삭제 시**: 해당 `etl_table_id`의 running/pending Job을 먼저 **cancelled**로 UPDATE한 뒤 DROP·메타·파일 삭제.
2. **목록 UI**: `etl_tables.status === 'done'` 일 때 해당 행 **실행 버튼 비활성화**.

---

## 9. Phase 순서·공통 주의

| Phase | 요약 |
|-------|------|
| 0 | 사전(폴더, 메타 테이블 4개, 의존성, etl 패키지). |
| 1 | 백엔드 기초·파일 업로드 API(메타, 스키마 추론). |
| 2 | 파일 기반 E/L(파싱, 테이블 생성, 일회성 적재). |
| 3 | DB 연동 E/L(연결 등록, Full·Incremental, Upsert). |
| 4 | 변환(T) 1차(클렌징, 타입, 매핑, 파생, 마스킹). |
| 5 | ETL 페이지 UI(소스 선택, 파일/DB 폼, 목록, Job·로그). |
| 6 | 큐·모니터링(Job 큐, 동시 실행 제한, 취소·연결 해제, 재시도 등). |

**공통**: 테이블명·컬럼명 화이트리스트 검증, API 인증, 실패 시 Job failed·에러 메시지 저장. 대용량 시 청크·타임아웃 고려.

---

## 10. 확장·추가 제안

### 10.1 DB 연동 1차 목표(PostgreSQL·Oracle·MySQL) — Oracle·MySQL 미구현

- ETL DB 연결 시스템의 **1차 목표**는 **PostgreSQL, Oracle, MySQL** 세 가지 소스 DB 지원이었으나, **현재는 PostgreSQL만 구현**된 상태입니다.
- 구현 당시 우선 PostgreSQL만 적용하고 Oracle·MySQL은 추후로 미뤄진 것으로 보이며, 문서에도 “1차 지원 DB: PostgreSQL”만 명시되어 있었습니다. 본 가이드에서는 1차 목표를 위 표(§3)와 같이 정리했습니다.
- **Oracle·MySQL 추가 시 필요한 작업 요약**  
  - **연결 테스트**: `service.py`에 `_connect_mysql`, `_connect_oracle` (또는 공통 `_connect( source_type, ... )`) 추가, `test_connection()`에서 `source_type` 분기.  
  - **소스 테이블 목록**: MySQL은 `information_schema.tables`, Oracle은 `ALL_TABLES`/`USER_TABLES` 등으로 조회 로직 추가.  
  - **DB 적재**: `db_load_service.py`에서 소스 연결·컬럼 조회·PK 조회·SELECT·타입 매핑을 DB별로 분기(또는 어댑터 패턴).  
  - **의존성**: MySQL → PyMySQL 또는 mysqlclient, Oracle → cx_Oracle 또는 oracledb.  
- 요구 시 Oracle·MySQL 지원을 별도 Phase로 설계·구현하면 됩니다.

### 10.2 기타 확장

- 다른 DB 커넥터(Snowflake, BigQuery 등), 스케줄 실행(cron·스케줄러), 변환 2차(조인·피벗·SCD), 데이터 내보내기(CSV/Excel) 등은 요구 시 별도 설계.

---

## 11. 추가 구현: 압축(zip) 다중 파일 추가 적재

대용량 데이터를 여러 파일로 나눠 압축(zip)으로 업로드하면, 서버에서 압축 해제 후 **파일명 순(넘버링)**으로 순차 Job 등록. 각 파일은 기존 "데이터 추가"와 동일하게 업서트(ON CONFLICT DO UPDATE)로 처리되며, **파일당 1 Job**으로 등록되어 워커가 `created_at ASC` 순으로 순차 실행.

### 11.1 흐름

1. 사용자가 **ZIP 파일 1개** 업로드 (`POST /api/etl/tables/{etl_table_id}/add-files-zip`).
2. 서버: ZIP을 **요청별 고유 디렉터리** `uploads/zip_<uuid>/` 에 압축 해제.
3. 해제된 파일 목록을 **자연 정렬**(파일명 앞/뒤 넘버링 인식, 예: part_001.csv, part_002.csv, part_010.csv 순).
4. 지원 형식(.csv, .xlsx, .xls, .parquet)이면서 **max_file_size_mb 이하**인 파일만 유효 처리.
5. 유효 파일에 대해 **동일 순서로** `insert_job(..., add_file_path=절대경로, add_file_type=...)` 호출 → Job이 등록 순서대로 워커에 의해 순차 실행.
6. **건너뛴 파일**(용량 초과, 미지원 형식, 스키마/PK 검증 실패)은 **목록과 사유**를 API 응답에 포함해 사용자에게 전달. **한 파일이 실패해도 전체가 멈추지 않음** — 컬럼이 다른 등 쌩뚱맞은 파일은 해당 파일만 건너뛰고(`schema_or_pk_failed`) 나머지 파일은 순서대로 Job 등록·실행.
7. **컬럼 생성과 무관**: add-files-zip은 **이미 존재하는 타겟 테이블**에만 추가 적재(업서트)함. 타겟 테이블·컬럼은 메인 DB에 이미 있고(최초 "실행"으로 생성된 상태), **압축 해제된 어떤 파일도 컬럼 정의/생성에 쓰이지 않음**. 각 파일은 기존 `table_columns`·`pk_columns` 기준으로만 검증됨. 따라서 "최초로 넣는 파일을 스키마 기준으로 삼는다" 같은 설정은 없음.

### 11.2 건너뛴 파일 목록 제공 방법

- **API 응답**  
  - `skipped_files: [{ "filename": "큰파일.csv", "reason": "file_too_large" }, { "filename": "readme.txt", "reason": "unsupported_format" }]`  
  - `reason` 예: `file_too_large`(용량 초과), `unsupported_format`(미지원 확장자/디렉터리), `schema_or_pk_failed`(첫 유효 파일 기준 스키마·PK 검증 실패 시 해당 파일만 또는 전체 배치 실패 시 목록).
- **UI**  
  - 응답 수신 후 결과 화면에 **"N개 파일이 대기열에 등록되었습니다"**와 함께, **건너뛴 파일이 있으면** "다음 파일은 건너뛰었습니다. 정리 후 다시 업로드하세요." 안내 + **파일명·사유 목록** 표시.  
  - 필요 시 **건너뛴 파일명만 텍스트로 복사**하거나 **텍스트 파일로 다운로드**해, 사용자가 로컬에서 파일 정리(분할·제거·재압축) 후 다시 업로드할 수 있게 한다.

### 11.3 다중 사용자 동시 ZIP 업로드 시 넘버링·충돌 방지

- **요청별 고유 디렉터리**  
  - ZIP 업로드마다 `uuid.uuid4()` 로 고유 ID 생성 후, 압축 해제 경로를 **`uploads/zip_<uuid>/`** 로 둔다.  
  - 각 요청이 자신의 `zip_<uuid>` 폴더만 사용하므로, **다른 사용자(다른 요청)와 파일명·경로가 겹치지 않는다.**  
  - Job의 `add_file_path`는 해당 요청의 `zip_<uuid>` 내 **절대 경로**를 저장하므로, 넘버링은 "해당 ZIP 내부 파일 순서"만 의미하고, 다른 ZIP과는 무관하다.
- **정렬**  
  - 넘버링 정렬은 **같은 ZIP 내부**에서만 적용. `zip_<uuid>` 폴더 안의 파일명을 자연 정렬한 순서로 Job을 등록하면, 해당 업로드에 대해서만 part_001 → part_002 → … 순이 보장된다.
- **정리**  
  - `uploads/` 아래는 기존처럼 **보관 기간(예: 3일) 초과 시** 정리 대상. `zip_<uuid>` 디렉터리와 그 안 파일들의 mtime 기준으로 삭제하면 된다.

### 11.4 구현 요약

| 항목 | 내용 |
|------|------|
| **엔드포인트** | `POST /api/etl/tables/{etl_table_id}/add-files-zip` (multipart: zip 파일 1개) |
| **압축 해제** | `uploads/zip_<uuid>/` 에 해제. 지원 확장자만 처리, 디렉터리/기타는 skipped. |
| **혼합 형식** | 한 ZIP에 CSV·Excel(.xlsx/.xls)·Parquet를 섞어도 됨. 파일별로 확장자에 맞는 타입(csv/excel/parquet)으로 읽어 동일 타겟 테이블에 순서대로 업서트. |
| **정렬** | 파일명 자연 정렬(숫자 구간 인식) 후 순서대로 Job 등록. 이 순서는 **실행 순서**만 의미하며, 스키마/컬럼 기준으로 쓰이지 않음(타겟 테이블은 이미 존재). |
| **한도** | `etl_limits.max_file_size_mb` 초과 파일은 건너뛰고 `skipped_files`에 `file_too_large` 기록. |
| **응답** | `job_ids`, `enqueued_count`, `skipped_files: [{ filename, reason }]`, 기존 add-file과 동일한 메타 정보. |
| **프론트** | "데이터 추가" 모달에서 "ZIP으로 여러 파일" 옵션, 결과에 건너뛴 파일 목록 표시·복사/다운로드 지원. |

---

## 12. ETL 목록 동작 정리 (등록된 ETL 목록)

등록된 ETL 목록에서 **미리보기 / 실행 / 데이터 추가 / 삭제** 버튼의 동작을 상태(draft, error, done)별로 정리.

### 12.1 상태별 의미

| 상태   | 의미 |
|--------|------|
| **draft** | ETL만 등록됨. 아직 한 번도 실행 안 함. 메인 DB에 타겟 테이블 **없음**. |
| **error** | 실행했으나 실패. 타겟 테이블은 **생성되었을 수도, 안 되었을 수도** 있음. (실패 시점에 따라) |
| **done**  | 마지막 실행이 성공. 메인 DB에 타겟 테이블 **있음**. |

### 12.2 draft / error 일 때 (테이블이 없거나 불확실할 때)

| 동작       | 실제 동작 | 비고 |
|------------|-----------|------|
| **미리보기** | **등록된 파일**을 읽어 상위 10행 + 컬럼별 저장 가능 여부 표시. | 테이블 유무와 무관. 항상 **파일** 기준. |
| **실행**     | 등록된 **file_path** 파일로 메인 DB에 **DROP TABLE IF EXISTS → CREATE TABLE → INSERT**. | 타겟 테이블이 이미 있으면 **컨펌** 후 진행. 테이블이 없으면 생성, 있어도 **삭제 후 재생성** (전체 교체). |
| **데이터 추가** | **현재 구현: "기존 타겟 테이블에 업로드한 파일을 업서트"**. 타겟 테이블이 없으면 `get_table_columns(target_table)` 실패 → 400. | draft/error(테이블 없음)에서는 **실패**. "소스 파일 변경" 기능이 아님. |
| **삭제**     | 메인 DB에서 타겟 테이블 **DROP TABLE IF EXISTS** + 시스템 DB에서 etl_tables·etl_jobs·etl_transform_rules 삭제 + **업로드 파일 삭제**. | 테이블 없어도 DROP IF EXISTS 로 안전. |

**정정:**  
- "데이터 추가 = 파일 변경"이 **아닙니다.**  
- 데이터 추가는 **"새 파일을 업로드해서, 이미 있는 타겟 테이블에 PK 기준 업서트"** (분할 적재용).  
- "등록된 ETL의 소스 파일을 다른 파일로 바꾸는 것"은 현재 없음. (삭제 후 새로 업로드하거나 별도 기능 필요.)

### 12.3 done 일 때 (테이블이 이미 있을 때)

| 동작       | 실제 동작 | 비고 |
|------------|-----------|------|
| **미리보기** | **등록된 파일**을 읽어 상위 10행 + 컬럼별 저장 가능 여부 표시. | draft/error와 동일. **테이블이 아니라 파일**을 읽음. |
| **실행**     | 등록된 **file_path** 파일로 메인 DB 타겟 테이블 **전체 교체**: DROP → CREATE → INSERT. | **실행 전** 타겟 테이블 존재 시 컨펌. 기존 데이터 전부 삭제 후, **현재 등록된 파일** 내용으로 다시 채움. |
| **데이터 추가** | 사용자가 **새 파일**을 업로드 → 그 파일을 **같은 타겟 테이블**에 **PK 기준 업서트** (INSERT ... ON CONFLICT DO UPDATE). | 분할 적재(50+50+40MB → 한 테이블) 시 사용. 타겟 테이블 + PK 필요. |
| **삭제**     | 메인 DB 타겟 테이블 **DROP** + 메타(etl_tables·etl_jobs·etl_transform_rules) 삭제 + **업로드 파일 삭제**. | draft/error와 동일 흐름. |

### 12.4 요약 표 (한눈에)

| 버튼       | draft/error 시                | done 시                          |
|------------|--------------------------------|----------------------------------|
| **미리보기** | 파일 읽어 10행 + 컬럼 표시     | 동일 (파일 읽어 10행 + 컬럼 표시) |
| **실행**     | 파일로 테이블 생성(또는 재생성) | 파일로 테이블 **전체 교체**       |
| **데이터 추가** | 실패 (테이블 없음)              | 새 파일을 같은 테이블에 **업서트** |
| **삭제**     | 메타 + 파일 삭제, 테이블 DROP IF EXISTS | 메타 + 파일 삭제, 테이블 DROP   |

### 12.5 참고 (구현 위치)

- 미리보기: `Backend/etl_server/preview_service.py` (파일: `_read_file`로 10행, 반환 튜플에서 DataFrame만 사용)
- 실행(파일): `Backend/etl_server/load_service.py` → `run_file_load` (DROP → CREATE → INSERT). 실행 전 `GET /api/etl/tables/{id}/target-exists`로 테이블 존재 시 컨펌.
- 데이터 추가: `Backend/etl_server/router.py` `POST /tables/{id}/add-file`, `load_service.run_file_upsert`
- 삭제: `Backend/etl_server/service.py` `delete_etl_table`, 라우터에서 file_path 받아 파일 삭제
