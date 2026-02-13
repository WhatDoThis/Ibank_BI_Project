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
- **1차 지원 DB**: PostgreSQL. Snowflake/BigQuery 등은 추후.
- **업로드 파일 보관**: **3일** 초과 시 자동 삭제. 3일 후 동일 ETL 재실행 시 파일 없음으로 실패할 수 있음.

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

- 다른 DB 커넥터(Snowflake, BigQuery 등), 스케줄 실행(cron·스케줄러), 변환 2차(조인·피벗·SCD), 데이터 내보내기(CSV/Excel) 등은 요구 시 별도 설계.
