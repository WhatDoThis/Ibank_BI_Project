# ETL 학습 가이드 (Backend + Frontend)

**대상:** ETL 시스템을 처음 접하는 개발자  
**목표:** "데이터가 어떻게 흘러가는지" 흐름을 잡은 뒤, **실제 코드(파일·함수)**를 찾아가며 학습  
**범위:** `Backend/etl_server` · `Frontend/react-app/src/packages/etl` (단일 ETL 패키지 기준)

---

## 이 가이드 읽는 순서

1. **§1·§2** — 시스템이 뭘 하는지, E/T/L 단계와 두 가지 실행 경로(즉시 vs 배치)를 한눈에 본다.
2. **§3** — 레이어별 **파일 역할 맵**에서 "이 일은 어느 파일이 맡는지"를 확인한다.
3. **§4** — 시나리오별(파일 업로드 / DB 연동 / 폴더 배치) **데이터 흐름**을 단계별로 따라가며, 각 단계의 **코드 위치(파일 → 함수)**를 찾아 읽는다.
4. **§10 학습 순서** — 의존도 순으로 "이 파일부터 열어보기" 목록을 따라 코드를 읽는다.

> 문서 곳곳에 **▶ 코드:** 표기가 있으면, 해당 파일을 열고 함수명으로 검색해 보면 된다.

---

## 1. 이 시스템은 뭘 하는가?

한 문장: **외부 데이터(파일 / DB / 원격 폴더)를 가져와서 변환한 뒤, PostgreSQL에 넣는 파이프라인**이다.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Extract    │ ──▶ │  Transform  │ ──▶ │    Load     │
│  추출        │     │  변환       │     │    적재     │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
 CSV/Excel/          클렌징·타입변환·      PostgreSQL
 Parquet 파일         코드매핑·마스킹      CREATE TABLE
 외부 DB                                       INSERT/UPSERT
 (PG/MySQL/Oracle)
 SFTP/S3 폴더
```

- **추출:** 파일 업로드, 외부 DB SELECT, SFTP/S3 `list_files` + `download_file`  
  ▶ 코드: `router.py` → `_save_upload` / `db_load_service.py` → 소스 연결·SELECT / `batch_executor_file.py` → `adapter.download_file`
- **변환:** `transform_engine.apply_rules` (5가지 룰) + `column_mapping` 기반 타입/이름 매핑  
  ▶ 코드: `Backend/etl_server/transform_engine.py` → `apply_rules`, `apply_mapping_type_cast`
- **적재:** 타겟 DB에 `DROP+CREATE+INSERT` 또는 `INSERT ... ON CONFLICT DO UPDATE` (Upsert)  
  ▶ 코드: `load_service.py` → `run_file_load` / `db_load_service.py` → `run_db_load` / `load_service_file.py` → `load_dataframe`, `_batch_upsert`

---

## 2. 전체 아키텍처 · 실행 경로 두 가지

단일 ETL에는 **즉시 실행**(파일/DB 한 번 실행)과 **배치 실행**(폴더 주기 적재) 두 경로가 있다. 요청이 들어오면 아래처럼 갈린다.

```
                    ┌─────────────────────────────────────────────────────┐
                    │  FastAPI (main.py)                                  │
                    │  etl_router: /api/etl/* (router.py)                 │
                    │  include router_file → /api/etl/batch/*             │
                    └──────────────────────┬──────────────────────────────┘
                                           │
              ┌────────────────────────────┴────────────────────────────┐
              ▼                                                          ▼
  ┌─────────────────────────┐                            ┌─────────────────────────────┐
  │  즉시 실행 경로          │                            │  배치 실행 경로              │
  │  (파일/DB 1회 실행)      │                            │  (폴더 주기 적재)            │
  │                          │                            │                             │
  │  router.run_table_load   │                            │  scheduler_file             │
  │    ├─ file → 스레드      │                            │    └─ APScheduler 주기 호출 │
  │    │   load_service      │                            │         batch_executor_file │
  │    │     .run_file_load  │                            │           .run_batch_job    │
  │    └─ DB → pending 등록  │                            │                             │
  │         queue_worker    │                            │  router_file.run_batch_job_now
  │           ._run_one_job │                            │    → 동일 run_batch_job     │
  │             db_load_    │                            └──────────────┬──────────────┘
  │             service     │                                           │
  │             .run_db_load│                                           │
  └────────────┬────────────┘                                           │
               │                                                         │
               └────────────────────┬───────────────────────────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  PostgreSQL (타겟 DB)         │
                    │  get_target_db_connection()    │
                    │  또는 storage_connection_id   │
                    └───────────────────────────────┘
```

### 즉시 실행 경로 (흐름만 따라가기)

| 단계 | 하는 일 | 코드에서 찾기 |
|------|---------|----------------|
| 1 | 사용자가 "실행" 클릭 → API 호출 | `Frontend` → `packages/etl/api/etlClient.js` (`etl2RunTable` 등) → `router.py` **run_table_load** |
| 2 | 파일 소스면 스레드에서 적재, DB 소스면 Job을 pending 등록 | `router.py` → **run_table_load** (분기: 파일 → _run_file_load_in_process / DB → insert_job) |
| 3 | 파일 적재: 디스크 파일 읽기 → 변환 → 타겟 DB INSERT | `load_service.py` → **run_file_load** → _read_file(csv_reader/ pandas) → apply_rules → DROP/CREATE/INSERT |
| 4 | DB 적재: 워커가 Job 선점 → 소스 SELECT → 변환 → 타겟 COPY/INSERT | `queue_worker.py` → **_run_one_job** → `db_load_service.run_db_load` |

### 배치 실행 경로 (흐름만 따라가기)

| 단계 | 하는 일 | 코드에서 찾기 |
|------|---------|----------------|
| 1 | 주기마다 스케줄러가 배치 Job 실행 | `scheduler_file.py` → **get_scheduler().add_job** → 트리거 시 **batch_executor_file.run_batch_job** |
| 2 | Job 메타 조회 → Run 생성 → 폴더 연결 | `batch_executor_file.py` → **run_batch_job** → service_file.get_batch_job, create_batch_run, **_connect_with_retry** |
| 3 | 대기 파일 목록 → 파일별 다운로드·체크섬·파싱·적재 | 같은 파일 → for 루프: adapter.download_file → **parser_file.read_file** → **load_service_file.load_dataframe** → update_last_processed_ts |
| 4 | Run 종료·상태 갱신 | **finish_run**, **update_job_status** (service_file) |

- **진입점:** `Backend/api_server/main.py` → `etl_router`(router.py); `router.py`가 `router_file`를 include하여 `/api/etl/batch/*` 제공
- **파일 1회:** `router.run_table_load` → `_run_file_load_in_process`(스레드) → `load_service.run_file_load`
- **DB 1회:** `router.run_table_load` → `insert_job(pending)` → `queue_worker._run_one_job` → `db_load_service.run_db_load`
- **배치:** `scheduler_file.get_scheduler()` → 주기 트리거 → `batch_executor_file.run_batch_job`

---

## 3. 파일 역할 맵 (레이어별)

**Backend/etl_server** 를 6개 레이어로 나누면 의존 방향이 보인다. 학습 시 **"코드에서 찾기"** 열의 파일을 열고 해당 함수명으로 검색하면 된다.

| 레이어 | 파일 | 역할 (실제 함수·라이브러리) | 코드에서 찾기 |
|--------|------|-----------------------------|---------------|
| **Layer 6: API 진입점** | `router.py` | 파일/DB ETL: upload_file, run_table_load, list_jobs, get_job, cancel_job. _save_upload(파일 저장), _run_file_load_in_process(스레드에서 load_service.run_file_load 호출) | **run_table_load**, **upload_file**, **create_table** |
| | `router_file.py` | 배치/폴더: list_folder_connections, create_batch_job, run_batch_job_now, list_batch_run_history, batch_executor_file.run_batch_job 트리거 | **create_batch_job**, **run_batch_job_now** |
| **Layer 5: 오케스트레이션** | `queue_worker.py` | run_worker_iteration → claim_next_pending_job → _run_one_job(분기: load_service / db_load_service) | **_run_one_job** |
| | `scheduler_file.py` | get_scheduler()(BackgroundScheduler), add_job/remove_job/reschedule_job, batch_executor_file.run_batch_job 등록 | **get_scheduler**, **add_job** |
| | `batch_executor_file.py` | run_batch_job: get_batch_job → create_batch_run → _connect_with_retry → get_pending_files → 파일별 read_file → load_dataframe → finish_run | **run_batch_job**, **_connect_with_retry**, **_wait_for_stable_size** |
| **Layer 4: 핵심 적재** | `load_service.py` | run_file_load: get_etl_limits → _read_file(CSV는 csv_reader) → apply_rules → get_target_db_connection → DROP/CREATE/INSERT. run_file_upsert | **run_file_load**, **_read_file** |
| | `db_load_service.py` | run_db_load: get_connection_for_etl, effective_batch_size, fetchmany → _copy_insert_batch/_copy_upsert_batch. _row_fallback(on_row_error=skip) | **run_db_load**, **_copy_upsert_batch** |
| | `load_service_file.py` | load_dataframe: table_exists → create_table_from_dataframe 또는 _batch_upsert(반환 inserted/updated). _record_loaded_keys | **load_dataframe**, **_batch_upsert** |
| **Layer 3: 변환** | `transform_engine.py` | apply_rules(df, rules): cleansing, type_cast, code_map, derived, masking. apply_mapping_type_cast | **apply_rules**, **apply_mapping_type_cast** |
| | `transform_rules_service.py` | 룰 메타 CRUD (etl_transform_rules) | list_transform_rules, create_transform_rule |
| **Layer 2: 연결·메타** | `service.py` | get_etl_table, insert_job, claim_next_pending_job, get_connection_for_etl, get_target_db_connection. _connect_postgres/_connect_mysql/_connect_oracle | **claim_next_pending_job**, **get_target_db_connection** |
| | `service_file.py` | get_batch_job, create_batch_run, finish_run, get_folder_adapter, is_duplicate_checksum, update_run_progress | **get_batch_job**, **get_folder_adapter**, **create_batch_run** |
| | `folder_adapter_file.py` | FolderAdapter(ABC) → SFTPAdapter(paramiko), S3Adapter(boto3). list_files, download_file, delete_file | **SFTPAdapter**, **S3Adapter**, **download_file** |
| | `parser_file.py` | get_pending_files(last_processed_ts), read_file(CSV/Excel/Parquet), parse_filename, extract_patterns_from_files | **get_pending_files**, **read_file** |
| **Layer 1: 유틸** | `csv_reader.py` | read_csv_robust: 인코딩 감지(chardet/charset_normalizer) 또는 utf-8→cp949 순차 시도. load_service·parser_file에서 CSV 읽기 공용 | **read_csv_robust** |
| | `schema_infer.py` | infer_schema(file_path, file_type, max_rows) — pandas dtype → 타입명 | **infer_schema** |
| | `etl_limits.py` | get_etl_limits() → (max_file_size_mb, max_rows_per_load, max_batch_size) | **get_etl_limits** |
| | `preview_service.py` | 10행 미리보기 (파일/DB 소스 공통) | get_raw_sample 등 |

---

## 4. 기능별 데이터 흐름 (함수·라이브러리 단위)

각 시나리오별로 **단계 → 호출 경로 → 실제 코드(파일·함수)**를 따라가면, 코드를 열어 학습하기 쉬워진다.

### 4-1. 파일 업로드 → 적재 (즉시 실행)

**흐름:** 사용자 업로드 → API → 파일 저장 → 스키마 추론 → 메타 등록 → 실행 요청 → **같은 프로세스 스레드**에서 적재.

| 단계 | 호출 경로 | 사용 라이브러리/함수 | ▶ 코드에서 찾기 |
|------|-----------|----------------------|------------------|
| 1. 업로드 | POST /api/etl/upload → router.upload_file | 파일 디스크 저장, 스키마 추론 | `Backend/etl_server/router.py` → **upload_file**, **_save_upload** / `schema_infer.py` → **infer_schema** |
| 2. 메타 등록 | create_etl_table | 시스템 DB INSERT (etl_tables) | `service.py` → **create_etl_table** |
| 3. 실행 요청 | POST /api/etl/tables/{id}/run → run_table_load | insert_job(running) → 스레드 생성 | `router.py` → **run_table_load** (파일 소스 분기) |
| 4. 적재 스레드 | _run_file_load_in_process → run_file_load | _read_file(CSV는 csv_reader) → apply_rules → DROP/CREATE/INSERT | `router.py` → **_run_file_load_in_process** / `load_service.py` → **run_file_load**, **_read_file** / `csv_reader.py` → **read_csv_robust** / `transform_engine.py` → **apply_rules** |

**포인트:** 파일 적재는 **업로드와 동일 프로세스**에서 스레드로 실행된다. DB 적재만 `pending` → `queue_worker`로 보낸다. ZIP 일괄 추가(`add_files_zip_to_table`)도 파일별 Job 등록·스킵 파일 반환으로 **파일별 격리** 패턴 사용.

### 4-2. 외부 DB → 적재 (Full / Incremental)

**흐름:** 실행 요청 → Job `pending` 등록 → `queue_worker`가 선점 → `db_load_service.run_db_load` 호출.

| 단계 | 호출 경로 | 사용 라이브러리/함수 | ▶ 코드에서 찾기 |
|------|-----------|----------------------|------------------|
| 1. 실행 요청 | POST /api/etl/tables/{id}/run | insert_job(pending) | `router.py` → **run_table_load** (DB 소스 분기) / `service.py` → **insert_job** |
| 2. 워커 선점 | queue_worker 반복 → claim_next_pending_job | SELECT FOR UPDATE SKIP LOCKED | `queue_worker.py` → **run_worker_iteration** / `service.py` → **claim_next_pending_job** |
| 3. DB 적재 진입 | _run_one_job → run_db_load | get_etl_table, get_connection_for_etl, _fetch_source_columns_* | `queue_worker.py` → **_run_one_job** / `db_load_service.py` → **run_db_load** (상단) |
| 4. 스트리밍 루프 | run_db_load 내부 | fetchmany → apply_rules → _copy_insert_batch/_copy_upsert_batch → update_job_progress | `db_load_service.py` → **run_db_load** (while 루프), **_copy_upsert_batch**, **_copy_insert_batch** |
| 5. Full | sync_mode=full | DROP TABLE → CREATE TABLE → COPY/INSERT | 같은 파일 내 Full 분기 |
| 6. Incremental | sync_mode=incremental | SELECT WHERE incremental_column > last_synced_at → TEMP + ON CONFLICT DO UPDATE | 같은 파일 내 Incremental 분기 |

**라이브러리:** 소스 `psycopg2`, `pymysql`, `oracledb`. 타겟 `psycopg2`(COPY/INSERT). 변환 `transform_engine`.

### 4-3. SFTP/S3 배치 자동 적재

**흐름:** 스케줄러가 주기적으로 `run_batch_job` 호출 → 폴더 연결 → 대기 파일 목록 → 파일별 다운로드·체크섬·파싱·적재.

| 단계 | 호출 경로 | 사용 라이브러리/함수 | ▶ 코드에서 찾기 |
|------|-----------|----------------------|------------------|
| 1. 주기 실행 | APScheduler 트리거 | add_job(interval, run_batch_job) | `scheduler_file.py` → **get_scheduler**, **add_job** / `batch_executor_file.py` → **run_batch_job** (진입) |
| 2. Job·Run 준비 | run_batch_job 상단 | get_batch_job, create_batch_run, _connect_with_retry, get_folder_adapter | `batch_executor_file.py` → **run_batch_job** (초반) / `service_file.py` → **get_batch_job**, **create_batch_run**, **get_folder_adapter** |
| 3. 대기 파일 | list_files → get_pending_files | last_processed_ts 기준, parse_filename | `batch_executor_file.py` (pending 루프 전) / `parser_file.py` → **get_pending_files**, **parse_filename** |
| 4. 파일별 처리 | for filename in pending | _wait_for_stable_size → download_file → _compute_sha256 → is_duplicate_checksum → read_file → load_dataframe | `batch_executor_file.py` → **_wait_for_stable_size**, **_compute_sha256** / `parser_file.py` → **read_file** (CSV 시 csv_reader) / `load_service_file.py` → **load_dataframe** |
| 5. 종료 | finish_run, update_job_status | check_consecutive_failures(5회 연속 실패 시 비활성) | `service_file.py` → **finish_run**, **update_job_status**, **check_consecutive_failures** |

**라이브러리:** `paramiko`(SFTP), `boto3`(S3), `hashlib`, `csv_reader`/`pandas`, `load_service_file.load_dataframe`.

---

## 5. 변환 파이프라인 상세

`transform_engine.apply_rules(df, rules)` 에서 **apply_order** 순으로 5가지 룰이 적용된다.

```
원본 DataFrame
    │
    ▼  cleansing   (TRIM, 빈값→NULL, 기본값)
    ▼  type_cast   (문자열→정수/날짜, on_error: null/zero/keep)
    ▼  code_map    ({"M":"남","F":"여"}, default)
    ▼  derived     (concat, year_minus 등)
    ▼  masking     (right_n, email_domain 등)
    │
    ▼  column_mapping 있으면 → apply_mapping_type_cast (소스 컬럼→타겟 컬럼/타입)
    ▼
적재용 DataFrame
```

- **▶ 코드:** `Backend/etl_server/transform_engine.py` → **apply_rules** (cleansing/type_cast/code_map/derived/masking 분기), **apply_mapping_type_cast**
- **메타:** `transform_rules_service.py` → **list_transform_rules** (시스템 DB etl_transform_rules)

---

## 6. Job 생명주기

```
 pending  ──(queue_worker.claim_next_pending_job)──▶  running
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        ▼                                 ▼                                  ▼
                 completed                           failed                            cancelled
```

- **동시 실행:** `queue_worker.MAX_CONCURRENT = 2`
- **선점:** `service.claim_next_pending_job` → `SELECT ... FOR UPDATE SKIP LOCKED`
- **취소:** `POST /jobs/{id}/cancel` → status='cancelled', `db_load_service` 내부에서 주기적으로 취소 여부 확인 후 중단
- **진행률:** `update_job_progress(job_id, total_processed)` → 프론트는 `GET /jobs/{id}` 폴링

---

## 7. 어댑터 패턴 (폴더 연결)

```
FolderAdapter (ABC, folder_adapter_file.py)
  ├── test_connection()
  ├── list_files()
  ├── download_file(remote_path, local_path)
  ├── delete_file(filename)
  └── close()
       │
       ├── SFTPAdapter (paramiko.SFTPClient)
       └── S3Adapter   (boto3.client('s3'))
```

- 새 프로토콜 추가 시: `FolderAdapter` 상속 후 위 메서드 구현. `service_file.get_folder_adapter`에서 `folder_type`에 따라 인스턴스 반환.

**7-1. 폴더 연결 목록 UI (구분용 표시)**

등록된 폴더 연결 테이블(`FolderConnectionListFile.jsx`)에서는 프로토콜별로 **연결 구분용** 정보를 "연결 정보" 열에 표시한다.

| 프로토콜 | 표시 내용 | 백엔드 필드 |
|----------|-----------|--------------|
| SFTP | IP(호스트) | `sftp_host` (list_folder_connections 응답) |
| S3 | 버킷, 있으면 리전 함께 표시 (예: `my-bucket (ap-northeast-2)`) | `s3_bucket`, `s3_region` |

- **목적:** 같은 이름의 연결이 여러 개일 때 호스트/버킷으로 구분하기 위함.
- **API:** `GET /api/etl/batch/folder-connections` → `service_file.list_folder_connections()`가 마스터 + sftp/s3 상세 JOIN으로 `sftp_host`, `sftp_port`, `sftp_remote_path`, `s3_bucket`, `s3_prefix`, `s3_region` 반환 (비밀번호·키·시크릿 제외).

---

## 8. DB 연결 구조

| DB | 용도 | 접근 함수/설정 |
|----|------|----------------|
| **시스템 DB** (ibank_system_data) | 메타·이력 | `api_db.get_db_connection_system()`, `service._get_db()`, `service_file` |
| | 테이블 | etl_connections, etl_tables, etl_jobs, etl_transform_rules, etl_storage_connections, batch_folder_connections, batch_folder_sftp/s3, batch_jobs, batch_run_history, batch_loaded_keys 등 |
| **타겟 DB** (기본 ibank_db 또는 storage) | 적재 대상 | `service.get_target_db_connection(storage_connection_id)` → (conn, schema) |
| **소스 DB** (외부) | 추출 전용 SELECT | `service.get_connection_for_etl` → `_connect_postgres`/`_connect_mysql`/`_connect_oracle` |

---

## 9. 에러 처리 전략

| 상황 | 처리 | ▶ 코드에서 찾기 |
|------|------|------------------|
| 폴더 연결 실패 | exponential backoff 3회 (2s→4s→8s) | `batch_executor_file.py` → **_connect_with_retry** |
| SFTP 전송 중 | 크기 안정화 대기 (3초 간격 3회) | `batch_executor_file.py` → **_wait_for_stable_size** |
| 중복 파일 | SHA-256 체크섬 → skip | `service_file.py` → **is_duplicate_checksum** / `batch_executor_file.py` → **_compute_sha256** |
| 행 단위 적재 실패 | on_row_error=skip 시 해당 행만 건너뛰고 계속 | `db_load_service.py` → **_row_fallback** |
| 동일 에러 50건 연속 | 조기 중단 (구조적 문제 가정) | `db_load_service.py` → **_row_fallback** 내부 |
| 배치 5회 연속 실패 | 자동 비활성화 + 스케줄러 제거 | `service_file.py` → **check_consecutive_failures** |
| 취소 체크 시 시스템 DB 실패 | 경고 로그 후 계속 (적재 중단 안 함) | `db_load_service.py` (etl_server) → _safe_is_job_cancelled |
| 파일 1건 실패 시 다음 파일 계속 | on_file_error=continue | `batch_executor_file.py` → run_batch_job 내 except 분기 |

---

## 10. 학습 순서 (의존도 기준)

아래 순서대로 **파일을 열고 → "이 함수부터 읽기"** 열의 함수명으로 검색하면, 이미 읽은 모듈만 참조하게 되어 이해하기 쉽다.

**Phase 1: 독립 유틸리티**

| 순서 | 경로 | 내용 | 이 함수부터 읽기 |
|------|------|------|------------------|
| 1 | `Backend/etl_server/schema_infer.py` | pandas dtype → 타입명 | **infer_schema**, _dtype_to_inferred |
| 2 | `Backend/etl_server/etl_limits.py` | config 또는 기본 한도 | **get_etl_limits** |
| 3 | `Backend/etl_server/csv_reader.py` | CSV 인코딩 감지·순차 시도 | **read_csv_robust** |
| 4 | `Backend/etl_server/transform_engine.py` | 5가지 룰 + column_mapping | **apply_rules**, **apply_mapping_type_cast** |
| 5 | `Backend/etl_server/parser_file.py` | 대기 파일·파일 읽기 | **get_pending_files**, **read_file**, parse_filename |

**Phase 2: 연결·메타**

| 6 | `Backend/etl_server/folder_adapter_file.py` | SFTP/S3 어댑터 | **FolderAdapter**, **SFTPAdapter**, **download_file** |
| 7 | `Backend/etl_server/service.py` | 메타 CRUD, DB 연결 | **get_target_db_connection**, **claim_next_pending_job**, get_etl_table |
| 8 | `Backend/etl_server/service_file.py` | 배치 메타 | **get_batch_job**, **get_folder_adapter**, **create_batch_run**, **finish_run** |
| 9 | `Backend/etl_server/transform_rules_service.py` | 룰 CRUD | list_transform_rules |

**Phase 3: 핵심 적재**

| 10 | `Backend/etl_server/load_service.py` | 파일 적재 (즉시) | **run_file_load**, **_read_file** |
| 11 | `Backend/etl_server/db_load_service.py` | DB 적재 (스트리밍) | **run_db_load**, **_copy_upsert_batch**, **_copy_insert_batch** |
| 12 | `Backend/etl_server/load_service_file.py` | 배치 파일 적재 | **load_dataframe**, **_batch_upsert**, create_table_from_dataframe |
| 13 | `Backend/etl_server/preview_service.py` | 10행 미리보기 | get_raw_sample 등 |

**Phase 4: 오케스트레이션**

| 14 | `Backend/etl_server/batch_executor_file.py` | 배치 1건 실행 전체 | **run_batch_job**, **_connect_with_retry**, **_wait_for_stable_size** |
| 15 | `Backend/etl_server/queue_worker.py` | pending Job 처리 | **_run_one_job**, run_worker_iteration |
| 16 | `Backend/etl_server/scheduler_file.py` | 주기 실행 | **get_scheduler**, **add_job**, load_active_batch_jobs |

**Phase 5: API 진입점**

| 17 | `Backend/etl_server/router_file.py` | 배치·폴더 API | create_batch_job, run_batch_job_now, list_folder_connections |
| 18 | `Backend/etl_server/router.py` | 파일/DB ETL API | **run_table_load**, **upload_file**, _run_file_load_in_process |

**Phase 6: 프론트엔드 (`packages/etl`)**

| 19 | `Frontend/react-app/src/packages/etl/api/etlClient.js` | API 호출 래퍼(함수명 `etl2*`·`batch*`는 레거시 접두 유지) | etl2ListTables, etl2RunTable, batchListJobs, batchCreateJob |
| 20 | `Frontend/react-app/src/packages/etl/ETLPage.jsx` | 탭·상태·폴링 | 탭 state, etl2RunTable → etl2GetJob 폴링 |
| 21 | `Frontend/react-app/src/packages/etl/components/ETLTableList.jsx` | ETL 목록 | 목록 fetch, 설정 모달, 실행/취소 |
| 22 | `Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx` | DB 연결·테이블 등록 | 소스 테이블 선택, 타겟·인덱스 설정 |
| 23 | `Frontend/react-app/src/packages/etl/components/FileUploadForm.jsx` | 파일 업로드 | 업로드, 스키마 추론, 타겟 선택 |
| 24 | `Frontend/react-app/src/packages/etl/components/FolderConnectionListFile.jsx` | 폴더 연결 목록 | 연결 정보 열 (SFTP=host, S3=bucket/리전) |
| 25 | `Frontend/react-app/src/packages/etl/components/BatchJobFormFile.jsx`, `BatchHistoryPanelFile.jsx` | 배치 등록·이력 | batchCreateJob, batchListJobHistory |

---

## 11. 설계 패턴 요약

| 패턴 | 적용 위치 | 이유 |
|------|-----------|------|
| Strategy (어댑터) | FolderAdapter → SFTP/S3 | 프로토콜 추가 시 기존 코드 수정 없이 클래스만 추가 |
| Template Method | `run_batch_job` | 다운로드→체크섬→파싱→적재 순서 고정, 단계별 함수만 교체 |
| Lazy Import | `service._get_db()` | 순환 import 방지 |
| Claim & Lock | `claim_next_pending_job` | `SELECT FOR UPDATE SKIP LOCKED` 로 중복 실행 방지 |
| Exponential Backoff | `_connect_with_retry` | 일시적 네트워크 오류 대응 |
| 파일별 격리 | `run_batch_job` 내 for 루프, `add_files_zip_to_table`(ZIP 내 파일별 Job 등록) | 파일 단위 try/except 또는 파일별 Job으로 한 파일 실패가 전체를 중단하지 않음 |
| Streaming Batch | `db_load_service` fetchmany | 대용량을 메모리에 올리지 않고 청크 단위 처리 |

---

## 12. API 엔드포인트 요약 (실제 경로·함수)

**파일/DB ETL** (`router.py`, prefix `/api/etl`)

| Method | Path | 라우터 함수 | 하는 일 |
|--------|------|-------------|--------|
| POST | /upload | `upload_file` | 파일 저장 + 스키마 추론 + 메타 등록 |
| POST | /infer-schema | `infer_schema_from_file` | 스키마만 반환 (메타 없음) |
| GET | /tables | `list_tables` | ETL 목록 |
| POST | /tables | `create_table` | 메타 등록 |
| PATCH | /tables/{id} | `update_table` | PK, sync_mode 등 수정 |
| DELETE | /tables/{id} | `delete_table` | 메타 + 타겟 DROP |
| POST | /tables/{id}/run | `run_table_load` | 실행 (파일: 스레드 즉시, DB: pending) |
| POST | /tables/{id}/add-file | `add_file_to_table` | 추가 적재 (UPSERT) |
| POST | /tables/{id}/add-files-zip | `add_files_zip_to_table` | ZIP 일괄 추가 |
| GET | /tables/{id}/preview | `preview_table` | 10행 미리보기 |
| GET | /jobs | `list_jobs` | Job 목록 |
| GET | /jobs/{id} | `get_job` | Job 상세 (폴링용) |
| POST | /jobs/{id}/cancel | `cancel_job` | 취소 |

**배치** (`router_file.py`, prefix `/api/etl/batch`)

| Method | Path | 라우터 함수 | 하는 일 |
|--------|------|-------------|--------|
| GET | /folder-connections | `list_folder_connections` | 폴더 연결 목록 (sftp_host, s3_bucket, s3_region 등, UI "연결 정보" 열용) |
| POST | /folder-connections | `create_folder_connection` | SFTP/S3 연결 등록 |
| POST | /folder-connections/test | `test_folder_connection` | 연결 테스트 |
| GET | /folder-connections/{id}/patterns | `list_folder_patterns` | 패턴 자동 감지 |
| GET | /folder-connections/{id}/columns | `list_folder_columns` | 샘플 컬럼 (CSV는 64KB만) |
| POST | /jobs | `create_batch_job` | 배치 Job 등록 + 스케줄러 등록 |
| POST | /jobs/{id}/run-now | `run_batch_job_now` | 즉시 1회 실행 |
| POST | /jobs/{id}/toggle | `toggle_batch_job` | 활성/비활성 |
| GET | /jobs/{id}/history | `list_batch_run_history` | 실행 이력 |
| GET | /jobs/{id}/history/{run_id} | `get_batch_run_detail` | run 상세 |

---

## 13. 자주 나오는 코드 패턴

실제 코드에서 반복되는 패턴. **파일·함수**를 찾아가면 비슷한 코드가 여러 곳에 있다.

**시스템 DB 접근 (service / service_file)**

- **▶ 코드:** `service.py` 또는 `service_file.py` — `_get_db()`, `_schema()`, `_q(schema, "table_name")` 검색
```python
api_db = _get_db()
schema = _schema()
conn = api_db.get_db_connection_system()
cur = conn.cursor()
try:
    cur.execute(f'SELECT ... FROM {_q(schema, "table_name")} ...', params)
    conn.commit()
finally:
    cur.close()
    conn.close()
```

**타겟 DB 적재**

- **▶ 코드:** `load_service.py`(run_file_load), `db_load_service.py`(run_db_load), `load_service_file.py`(load_dataframe) — **get_target_db_connection** 호출부
```python
conn_main, main_schema = etl_service.get_target_db_connection(row.get("storage_connection_id"))
# storage_connection_id None → 기본 DB(ibank_db)
cur = conn_main.cursor()
# DROP / CREATE / COPY 또는 INSERT
conn_main.commit()
```

**COPY 대량 적재 (db_load_service)**

- **▶ 코드:** `db_load_service.py` → **_copy_insert_batch**, **_copy_upsert_batch** 또는 `copy_expert` 검색
```python
buf = _copy_buf(cols, rows_tuples)  # 탭 구분 텍스트 버퍼
cur.copy_expert(
    f"COPY {table} ({col_str}) FROM STDIN WITH (FORMAT text, NULL '\\N')",
    buf
)
```

---

## 14. 한도(Limits) 체계

`etl_limits.get_etl_limits()` → `(max_file_size_mb, max_rows_per_load, max_batch_size)`

| 한도 | 적용 시점 | 동작 |
|------|-----------|------|
| max_file_size_mb | 업로드·배치 다운로드 후 | 초과 시 거부 |
| max_rows_per_load | 파일 읽기·DB SELECT | nrows/LIMIT 로 상한 |
| max_batch_size | DB 적재 배치 | min(사용자 batch_size, max_batch_size). 사용자 0이면 MySQL/Oracle 10000 적용 |

**기본값 (config 없을 때):** `etl_limits.py` 의 DEFAULT_MAX_FILE_SIZE_MB(50), DEFAULT_MAX_ROWS_PER_LOAD(100_000), DEFAULT_MAX_BATCH_SIZE(50_000). config에 0을 넣으면 해당 한도 미적용.

---

## 15. 핵심 테이블 ERD (간략)

```
etl_connections (소스 DB)
  1 ── N  etl_tables
           1 ── N  etl_jobs
           1 ── N  etl_transform_rules

etl_storage_connections (타겟 DB)
  1 ── N  etl_tables.storage_connection_id

batch_folder_connections
  1 ── 1  batch_folder_sftp | batch_folder_s3
  1 ── N  batch_jobs
           1 ── N  batch_run_history (file_list JSONB)
```

---

## 16. 참고

- **의존 수:** `from Backend.*` / `from Env.*` 기준. 동적 import(예: queue_worker 내부의 load_service, db_load_service) 포함.
- **구조:** 구 `etl_server`/`etl_server2` 이원화는 폐기되었고, 본 문서는 **`Backend/etl_server` + `packages/etl`** 단일 스택만 다룬다.
- **상세 설계:** `docs/report/09_ETL_SFTP_Connection.md`, `08_ETL_Phase_Implement_Guide.md`.

**이 문서의 활용:**  
흐름(§1·§2·§4)으로 "어디서 무엇이 일어나는지"를 잡고, **▶ 코드에서 찾기** / **이 함수부터 읽기** 표를 따라 `Backend/etl_server/`·`Frontend/react-app/src/packages/etl/` 의 실제 파일을 열어 함수명으로 검색하면, 코드를 보며 학습하기 쉽다.
