# ETL2 학습 가이드 (Backend + Frontend)

**대상:** ETL 시스템을 처음 접하는 개발자  
**목표:** 코드를 읽기 전에 "이 시스템이 뭘 하는지, 데이터가 어떻게 흘러가는지"를 먼저 잡는 것  
**범위:** `Backend/etl_server2` · `Frontend/react-app/src/packages/etl2` (ETL2 패키지만 기준)

---

## 1. 이 시스템은 뭘 하는가?

한 문장: **외부 데이터(파일 / DB / 원격 폴더)를 가져와서 변환한 뒤, PostgreSQL에 넣는 파이프라인**이다.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Extract    │ ──▶ │  Transform  │ ──▶ │    Load     │
│  추출       │     │  변환       │     │    적재     │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
 CSV/Excel/          클렌징·타입변환·      PostgreSQL
 Parquet 파일         코드매핑·마스킹      CREATE TABLE
 외부 DB                                       INSERT/UPSERT
 (PG/MySQL/Oracle)
 SFTP/S3 폴더
```

- **추출:** 파일 업로드, 외부 DB SELECT, SFTP/S3 `list_files` + `download_file`
- **변환:** `transform_engine.apply_rules` (5가지 룰) + `column_mapping` 기반 타입/이름 매핑
- **적재:** 타겟 DB에 `DROP+CREATE+INSERT` 또는 `INSERT ... ON CONFLICT DO UPDATE` (Upsert)

---

## 2. 전체 아키텍처 한눈에

```
                    ┌─────────────────────────────────────────────────────┐
                    │  FastAPI (main.py)                                  │
                    │  etl_router: /api/etl2/* (router.py)                │
                    │  etl2_router: /api/etl2/batch/* (router_file.py)    │
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

- **진입점:** `main.py` → `etl_router`(router.py), `etl2_router`(router_file.py)
- **파일/DB 1회 실행:** `router.run_table_load` → 파일이면 `threading.Thread`로 `load_service.run_file_load`, DB면 `insert_job(pending)` 후 `queue_worker.start_background_worker` → `queue_worker._run_one_job` → `db_load_service.run_db_load`
- **배치 주기 실행:** `scheduler_file.get_scheduler()`(APScheduler)가 `batch_executor_file.run_batch_job`을 주기 호출

---

## 3. 파일 역할 맵 (레이어별)

**Backend/etl_server2** 를 6개 레이어로 나누면 의존 방향이 보인다.

| 레이어 | 파일 | 역할 (실제 함수·라이브러리) |
|--------|------|-----------------------------|
| **Layer 6: API 진입점** | `router.py` | 파일/DB ETL: `upload_file`, `run_table_load`, `list_jobs`, `get_job`, `cancel_job` 등. `_save_upload`(파일 저장), `_run_file_load_in_process`(스레드에서 `load_service.run_file_load` 호출) |
| | `router_file.py` | 배치/폴더: `list_folder_connections`, `create_batch_job`, `run_batch_job_now`, `list_batch_run_history`, `batch_executor_file.run_batch_job` 트리거 등 |
| **Layer 5: 오케스트레이션** | `queue_worker.py` | `run_worker_iteration` → `etl_service.claim_next_pending_job` → `_run_one_job`(분기: `load_service.run_file_load` / `run_file_upsert` / `db_load_service.run_db_load`). `threading.Thread` + `time.sleep(POLL_INTERVAL_SEC)` |
| | `scheduler_file.py` | `get_scheduler()`(BackgroundScheduler), `add_job`/`remove_job`/`reschedule_job`, `batch_executor_file.run_batch_job` 등록. `apscheduler` |
| | `batch_executor_file.py` | `run_batch_job`: `service_file.get_batch_job` → `create_batch_run` → `_connect_with_retry`(폴더) → `parser_file.get_pending_files` → 파일별 `read_file` → `load_service_file.load_dataframe` → `update_last_processed_ts` → `finish_run` |
| **Layer 4: 핵심 적재** | `load_service.py` | `run_file_load`: `get_etl_limits` → `_read_file`(pandas: CSV/Excel/Parquet) → `transform_engine.apply_rules` → `get_target_db_connection` → DROP/CREATE/INSERT(2000건 배치). `run_file_upsert`: 추가 파일 UPSERT |
| | `db_load_service.py` | `run_db_load`: `get_etl_limits`, `get_connection_for_etl`, `_fetch_source_columns_*`, `effective_batch_size`(MySQL/Oracle 0→10000) → 스트리밍 시 `cur_src.fetchmany(effective_batch_size)` → `_copy_insert_batch`/`_copy_upsert_batch`(COPY 프로토콜). `_row_fallback`(on_row_error=skip 시 행 단위 재시도) |
| | `load_service_file.py` | `get_target_connection`, `load_dataframe`: `table_exists` → 없으면 `create_table_from_dataframe`, 있으면 `_batch_upsert`(ON CONFLICT DO UPDATE). `_record_loaded_keys`(batch_loaded_keys), `_batch_insert`/`_batch_upsert` |
| **Layer 3: 변환** | `transform_engine.py` | `apply_rules(df, rules)` — cleansing, type_cast, code_map, derived, masking. `apply_mapping_type_cast`(column_mapping). pandas |
| | `transform_rules_service.py` | 룰 메타 CRUD (시스템 DB `etl_transform_rules`) |
| **Layer 2: 연결·메타** | `service.py` | 메타 CRUD: `get_etl_table`, `insert_job`, `claim_next_pending_job`, `get_connection_for_etl`, `get_sync_mode_for_load`, `get_target_db_connection`. 외부 DB: `_connect_postgres`(psycopg2), `_connect_mysql`(PyMySQL), `_connect_oracle`(oracledb) |
| | `service_file.py` | 배치 메타: `get_batch_job`, `create_batch_run`, `finish_run`, `get_folder_adapter`, `is_duplicate_checksum`, `check_consecutive_failures`, `update_run_progress` 등. 시스템 DB |
| | `folder_adapter_file.py` | `FolderAdapter`(ABC) → `SFTPAdapter`(paramiko), `S3Adapter`(boto3). `list_files`, `download_file`, `delete_file` |
| | `parser_file.py` | `get_pending_files`(last_processed_ts 기준), `read_file`(CSV/Excel/Parquet), `parse_filename`(패턴_ib_타임스탬프.확장자), `extract_patterns_from_files` |
| **Layer 1: 유틸** | `schema_infer.py` | `infer_schema(file_path, file_type, max_rows)` — pandas dtype → 타입명. `_dtype_to_inferred` |
| | `etl_limits.py` | `get_etl_limits()` → `(max_file_size_mb, max_rows_per_load, max_batch_size)`. config.backend.etl_limits 또는 DEFAULT_* 상수 |
| | `preview_service.py` | 10행 미리보기 (파일/DB 소스 공통) |

---

## 4. 기능별 데이터 흐름 (함수·라이브러리 단위)

### 4-1. 파일 업로드 → 적재 (즉시 실행)

**흐름:** 사용자 업로드 → API → 파일 저장 → 스키마 추론 → 메타 등록 → 실행 요청 → **같은 프로세스 스레드**에서 적재.

| 단계 | 호출 경로 | 사용 라이브러리/함수 |
|------|-----------|----------------------|
| 1. 업로드 | `POST /api/etl2/upload` → `router.upload_file` | `_save_upload`(UploadFile → 디스크, flush+fsync), `schema_infer.infer_schema`(pandas: read_csv/read_excel) |
| 2. 메타 등록 | `etl_service.create_etl_table` | 시스템 DB INSERT (`etl_tables`) |
| 3. 실행 요청 | `POST /api/etl2/tables/{id}/run` → `router.run_table_load` | `etl_service.insert_job(..., status="running")` → `threading.Thread(target=_run_file_load_in_process, args=(etl_table_id, job_id))` |
| 4. 적재 스레드 | `_run_file_load_in_process` → `load_service.run_file_load` | `get_etl_limits` → `_read_file`(pandas) → `transform_rules_svc.list_transform_rules` → `transform_engine.apply_rules` → `get_target_db_connection` → 커서로 DROP/CREATE/INSERT(2000건씩) → `etl_service.update_job("completed", rows_processed=...)` |

**포인트:** 파일 적재는 **업로드와 동일 프로세스**에서 스레드로 실행된다. 워커 프로세스가 따로 있으면 업로드 경로를 못 찾을 수 있어서, DB 적재만 `pending` → `queue_worker`로 보낸다.

### 4-2. 외부 DB → 적재 (Full / Incremental)

**흐름:** 실행 요청 → Job `pending` 등록 → `queue_worker`가 선점 → `db_load_service.run_db_load` 호출.

| 단계 | 호출 경로 | 사용 라이브러리/함수 |
|------|-----------|----------------------|
| 1. 실행 요청 | `POST /api/etl2/tables/{id}/run` → `router.run_table_load` | `etl_service.insert_job(..., status="pending")` → `queue_worker.start_background_worker()` |
| 2. 워커 선점 | `queue_worker.run_worker_iteration` → `etl_service.claim_next_pending_job` | 시스템 DB `SELECT ... FOR UPDATE SKIP LOCKED`, `set_job_running` |
| 3. DB 적재 | `_run_one_job` → `db_load_service.run_db_load` | `get_etl_table` → `get_etl_limits` → `get_connection_for_etl` → `_connect_mysql`/`_connect_oracle`/`_get_source_connection`(psycopg2) → `_fetch_source_columns_*` → `effective_batch_size`(0이면 MySQL/Oracle 10000) |
| 4. 스트리밍 루프 | `run_db_load` 내부 | `cur_src.execute(SELECT...)` → `while True: batch = cur_src.fetchmany(effective_batch_size)` → `transform_engine.apply_rules` → `_copy_insert_batch`/`_copy_upsert_batch`(COPY 또는 INSERT) → `etl_service.update_job_progress` → 100건마다 취소 체크 |
| 5. Full | sync_mode=full | DROP TABLE → CREATE TABLE(소스 PK 반영) → COPY/INSERT |
| 6. Incremental | sync_mode=incremental | SELECT WHERE incremental_column > last_synced_at → TEMP TABLE + INSERT...ON CONFLICT DO UPDATE → `update_last_synced_at` |

**라이브러리:** 소스: `psycopg2`, `pymysql`, `oracledb`. 타겟: `psycopg2`(COPY/INSERT). 변환: `pandas`, `transform_engine`.

### 4-3. SFTP/S3 배치 자동 적재

**흐름:** 스케줄러가 주기적으로 `run_batch_job` 호출 → 폴더 연결 → 대기 파일 목록 → 파일별 다운로드·체크섬·파싱·적재.

| 단계 | 호출 경로 | 사용 라이브러리/함수 |
|------|-----------|----------------------|
| 1. 주기 실행 | `scheduler_file` (APScheduler) | `get_scheduler().add_job(..., 'interval', minutes=interval_minutes)` → 트리거 시 `batch_executor_file.run_batch_job(batch_job_id)` |
| 2. Job·Run 준비 | `run_batch_job` | `service_file.get_batch_job` → `create_batch_run` → `update_job_status("running")` → `_connect_with_retry`(exponential backoff) → `service_file.get_folder_adapter`(SFTPAdapter/S3Adapter) |
| 3. 대기 파일 | `adapter.list_files` → `parser_file.get_pending_files` | `last_processed_ts` 기준 타임스탬프 정렬, `parse_filename`(패턴_ib_yyyyMMddHHmmss.확장자) |
| 4. 파일별 처리 | for filename in pending | `_wait_for_stable_size`(SFTP만, stat 3회 동일 시 진행) → `adapter.download_file`(임시 파일) → `get_etl_limits`(크기 한도) → `_compute_sha256`(hashlib) → `service_file.is_duplicate_checksum` → skip 또는 `parser_file.read_file` → `load_service_file.load_dataframe`(column_mapping, pk) → `update_last_processed_ts` → `update_run_progress`(file_list) |
| 5. 종료 | `finish_run`, `update_job_status` | `check_consecutive_failures`(5회 연속 실패 시 자동 비활성) |

**라이브러리:** `paramiko`(SFTP), `boto3`(S3), `hashlib`, `pandas`, `parser_file.read_file`, `load_service_file.load_dataframe`.

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

- **함수:** `transform_engine.apply_rules`, `transform_engine.apply_mapping_type_cast`
- **메타:** `transform_rules_service.list_transform_rules`(시스템 DB)

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

- 새 프로토콜 추가 시: `FolderAdapter` 상속 후 위 메서드 구현. `service_file.get_folder_adapter`에서 `protocol`에 따라 인스턴스 반환.

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

| 상황 | 처리 | 코드 위치 |
|------|------|-----------|
| 폴더 연결 실패 | exponential backoff 3회 (2s→4s→8s) | `batch_executor_file._connect_with_retry` |
| SFTP 전송 중 | 크기 안정화 대기 (3초 간격 3회) | `batch_executor_file._wait_for_stable_size` |
| 중복 파일 | SHA-256 체크섬 → skip | `service_file.is_duplicate_checksum` |
| 행 단위 적재 실패 | on_row_error=skip 시 해당 행만 건너뛰고 계속 | `db_load_service._row_fallback` |
| 동일 에러 50건 연속 | 조기 중단 (구조적 문제 가정) | `db_load_service._row_fallback` |
| 배치 5회 연속 실패 | 자동 비활성화 + 스케줄러 제거 | `service_file.check_consecutive_failures` |
| 취소 체크 시 시스템 DB 실패 | 경고 로그 후 계속 (적재는 중단하지 않음) | `db_load_service._safe_is_job_cancelled` (etl_server 쪽과 동일 개념) |

---

## 10. 학습 순서 (의존도 기준)

아래 순서대로 읽으면 **이미 읽은 모듈만 참조**하게 된다.

**Phase 1: 독립 유틸리티**

| 순서 | 경로 | 내용 |
|------|------|------|
| 1 | `etl_server2/schema_infer.py` | `infer_schema`, `_dtype_to_inferred` — pandas dtype → 타입명 |
| 2 | `etl_server2/etl_limits.py` | `get_etl_limits`, DEFAULT_* — config 또는 기본 한도 |
| 3 | `etl_server2/transform_engine.py` | `apply_rules`, `apply_mapping_type_cast` — pandas만 사용 |
| 4 | `etl_server2/parser_file.py` | `get_pending_files`, `read_file`, `parse_filename` — re, datetime, pandas |

**Phase 2: 연결·메타**

| 5 | `etl_server2/folder_adapter_file.py` | ABC + SFTPAdapter, S3Adapter |
| 6 | `etl_server2/service.py` | 메타 CRUD, `get_connection_for_etl`, `get_target_db_connection`, `_connect_*` |
| 7 | `etl_server2/service_file.py` | 배치 메타, `get_folder_adapter`, `create_batch_run`, `finish_run`, `is_duplicate_checksum` |
| 8 | `etl_server2/transform_rules_service.py` | 룰 CRUD (service 의존) |

**Phase 3: 핵심 적재**

| 9 | `etl_server2/load_service.py` | `run_file_load`, `_read_file`, DROP/CREATE/INSERT |
| 10 | `etl_server2/db_load_service.py` | `run_db_load`, `_copy_insert_batch`, `_copy_upsert_batch`, `_row_fallback` |
| 11 | `etl_server2/load_service_file.py` | `load_dataframe`, `_batch_insert`, `_batch_upsert`, `create_table_from_dataframe` |
| 12 | `etl_server2/preview_service.py` | 10행 미리보기 |

**Phase 4: 오케스트레이션**

| 13 | `etl_server2/batch_executor_file.py` | `run_batch_job` 전체 흐름 |
| 14 | `etl_server2/queue_worker.py` | `_run_one_job`, `run_worker_iteration`, `_worker_loop` |
| 15 | `etl_server2/scheduler_file.py` | `get_scheduler`, `add_job`, `load_active_batch_jobs` |

**Phase 5: API 진입점**

| 16 | `etl_server2/router_file.py` | 배치·폴더 엔드포인트 |
| 17 | `etl_server2/router.py` | 파일/DB ETL 엔드포인트, `run_table_load`, `_run_file_load_in_process` |

**Phase 6: 프론트엔드 (packages/etl2)**

| 18 | `shared/api/client.js` | `etl2ListTables`, `etl2RunTable`, `etl2GetJob`, `batchListJobs`, `batchCreateJob`, `batchRunJobNow` 등 |
| 19 | `etl2/ETLPage.jsx` | 탭·상태·폴링, `etl2RunTable` → `etl2GetJob` 2초 폴링 |
| 20 | `etl2/components/ETLTableList.jsx` | 목록, 설정 모달, 실행/취소 버튼 |
| 21 | `etl2/components/DbConnectionForm.jsx` | DB 연결 등록·테이블 선택·배치 크기 |
| 22 | `etl2/components/FileUploadForm.jsx` | 업로드·스키마 추론·타겟 테이블 선택 |
| 23 | `etl2/components/BatchJobFormFile.jsx`, `BatchHistoryPanelFile.jsx` | 배치 등록·이력·상세 |

---

## 11. 설계 패턴 요약

| 패턴 | 적용 위치 | 이유 |
|------|-----------|------|
| Strategy (어댑터) | FolderAdapter → SFTP/S3 | 프로토콜 추가 시 기존 코드 수정 없이 클래스만 추가 |
| Template Method | `run_batch_job` | 다운로드→체크섬→파싱→적재 순서 고정, 단계별 함수만 교체 |
| Lazy Import | `service._get_db()` | 순환 import 방지 |
| Claim & Lock | `claim_next_pending_job` | `SELECT FOR UPDATE SKIP LOCKED` 로 중복 실행 방지 |
| Exponential Backoff | `_connect_with_retry` | 일시적 네트워크 오류 대응 |
| 파일별 격리 | `run_batch_job` 내 for 루프 | 파일 단위 try/except로 한 파일 실패가 전체를 중단하지 않음 |
| Streaming Batch | `db_load_service` fetchmany | 대용량을 메모리에 올리지 않고 청크 단위 처리 |

---

## 12. API 엔드포인트 요약 (실제 경로·함수)

**파일/DB ETL** (`router.py`, prefix `/api/etl2`)

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

**배치** (`router_file.py`, prefix `/api/etl2/batch`)

| Method | Path | 라우터 함수 | 하는 일 |
|--------|------|-------------|--------|
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

**시스템 DB 접근 (service / service_file)**

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

```python
conn_main, main_schema = etl_service.get_target_db_connection(row.get("storage_connection_id"))
# storage_connection_id None → 기본 DB(ibank_db)
cur = conn_main.cursor()
# DROP / CREATE / COPY 또는 INSERT
conn_main.commit()
```

**COPY 대량 적재 (db_load_service)**

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

**기본값 (config 없을 때):** `etl_limits.py` 의 DEFAULT_MAX_FILE_SIZE_MB(100), DEFAULT_MAX_ROWS_PER_LOAD(500_000), DEFAULT_MAX_BATCH_SIZE(10_000). config에 0을 넣으면 해당 한도 미적용.

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
- **ETL1(etl_server):** 본 문서는 ETL2(etl_server2 + packages/etl2)만 다룸. etl_server는 별도 학습 흐름 참고.
- **상세 설계:** `docs/report/09_ETL_SFTP_Connection.md`, `08_ETL_Phase_Implement_Guide.md`.
