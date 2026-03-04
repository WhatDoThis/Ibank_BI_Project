# 10. DB 연결 기반 배치 스케줄링 업그레이드

**문서 목적**: `batch_jobs` 테이블 확장을 통한 DB 소스 배치 스케줄링 기능 추가. 서브에이전트가 Phase별로 병렬·순차 작업 시 본 문서만으로 요구사항·파일·체크리스트를 확인할 수 있도록 정리함.

**관련 설계**: 기존 파일 배치 인프라(스케줄러, 실행 이력, 레지스트리, 실행기)를 그대로 활용하고, "데이터 소스"만 파일 → DB로 확장.

---

## 1. 개요

- **목표**: DB 연결에서 등록한 증분 Job을 배치잡을 통해 주기적으로 자동 upsert.
- **방식**: 새 테이블 없이 `batch_jobs`에 컬럼 추가(`job_type`, `connection_id`, `source_table`, `incremental_column`, `sync_mode`, `last_synced_at`, `batch_size`, `batch_interval_seconds`, `on_row_error`). `job_type='file'`은 기존 파일 배치, `job_type='db'`는 DB 소스 배치.
- **전제**: 아래 **§2 DB 명령어**는 운영 DB에서 **사용자가 직접 실행**한 뒤, 코드 업그레이드를 진행한다. 코드에서는 이미 해당 스키마가 적용된 것으로 가정함.
- **batch_size / batch_interval_seconds**: ETL 테이블(1회 실행)과 배치잡(주기 자동 실행)은 **별개**. 배치잡 자체에 `batch_size`(한 번에 가져올 행 수), `batch_interval_seconds`(배치 간 대기 초)를 저장하고, 실행 시 chunk 단위 fetch → 적재 → `time.sleep(batch_interval_seconds)` 후 다음 chunk 반복. 동일 소스라도 수동 실행과 자동 배치에서 다른 값을 쓰는 유연함 유지.

---

## 2. DB에서 실행할 명령어 (참고용 — 코드 반영 전 사용자 실행)

다음 명령은 **시스템 스키마**(예: `ibank_system_data`) 기준이며, 실제 스키마명은 프로젝트 규칙에 맞게 치환하여 실행한다.

```sql
-- 2.1 batch_jobs 컬럼 추가
ALTER TABLE batch_jobs
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(10) NOT NULL DEFAULT 'file'
    CHECK (job_type IN ('file', 'db')),
  ADD COLUMN IF NOT EXISTS connection_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS source_table VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS incremental_column VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS sync_mode VARCHAR(20) NULL DEFAULT 'incremental'
    CHECK (sync_mode IN ('full', 'incremental')),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS batch_size INTEGER NULL,
  ADD COLUMN IF NOT EXISTS batch_interval_seconds INTEGER NULL,
  ADD COLUMN IF NOT EXISTS on_row_error VARCHAR(10) NULL DEFAULT 'fail'
    CHECK (on_row_error IN ('fail', 'skip'));

-- 2.2 folder_connection_id nullable
ALTER TABLE batch_jobs ALTER COLUMN folder_connection_id DROP NOT NULL;

-- 2.3 file_pattern nullable (DB 배치는 file_pattern 미사용, 중복 검사에서 제외)
ALTER TABLE batch_jobs ALTER COLUMN file_pattern DROP NOT NULL;

-- 2.4 connection_id FK (etl_connections와 동일 스키마 가정)
ALTER TABLE batch_jobs
  DROP CONSTRAINT IF EXISTS batch_jobs_connection_id_fkey;
ALTER TABLE batch_jobs
  ADD CONSTRAINT batch_jobs_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES etl_connections(connection_id);

-- 2.5 partial index: folder_connection_id가 NULL인 행은 인덱스에서 제외
DROP INDEX IF EXISTS idx_batch_jobs_folder;
CREATE INDEX idx_batch_jobs_folder ON batch_jobs (folder_connection_id)
  WHERE folder_connection_id IS NOT NULL;

-- 2.6 컬럼 코멘트
COMMENT ON COLUMN batch_jobs.job_type IS 'file=폴더파일배치, db=DB연결배치';
COMMENT ON COLUMN batch_jobs.last_synced_at IS 'DB배치: 마지막 증분 적재 기준 시각';
```

- `ADD COLUMN IF NOT EXISTS`는 PostgreSQL 9.5+ 기준. 미지원이면 기존 `ADD COLUMN`만 사용하고, 이미 적용된 컬럼은 건너뛰면 됨.
- `etl_connections`가 다른 스키마에 있으면 `REFERENCES 스키마.etl_connections(connection_id)` 형태로 수정.

---

## 3. 반영된 정제 사항 (설계 시 필수 반영)

구현 시 아래 7가지를 반드시 반영한다.

| # | 항목 | 심각도 | 반영 내용 |
|---|------|--------|-----------|
| 1 | `idx_batch_jobs_folder` NULL 행 누적 | 낮음 | partial index로 교체 (DB 명령 2.5에서 처리). 코드 변경 없음. |
| 2 | `file_pattern` NOT NULL 충돌 | **높음** | DB에서 `file_pattern` nullable(2.3). `service_file.create_batch_job`에서 **중복 검사 분기**: `job_type='db'`일 때는 `(connection_id, source_table, target_table, storage_connection_id)`만 사용하고 `file_pattern`/`folder_connection_id` 제외. |
| 3 | MySQL SSCursor timeout | **높음** | `batch_executor_db.py`에서 소스가 MySQL일 때 `effective_batch_size` 상한 **10000** 적용. Oracle도 배치 없으면 10000 사용. (db_load_service와 동일) |
| 4 | `source_filename="db"` 롤백 무의미 | 중간 | DB 배치에서는 `source_filename`을 `db_batch_{run_id}_{batch_offset}` 형태로 전달하거나, 롤백 미지원 시 `source_filename=None`으로 두어 `_record_loaded_keys` 스킵. |
| 5 | `check_consecutive_failures` 호출 위치 | 중간 | `batch_executor_db.py`에서 **run_id 유무와 무관**하게, 최외곽 `except` 처리 후 **finally 밖**에서 `check_consecutive_failures(batch_job_id, threshold=5)` 호출. (run_id가 None이어도 호출 가능하므로 run_id 체크 없이 job_id만으로 호출) |
| 6 | `last_synced_at` 타입 불일치 | 중간 | 증분 컬럼 MAX 값을 DB에 넣기 전에 `pd.to_datetime(max_incremental_value)`로 변환 후 `update_last_synced_at_db_batch`에 전달. |
| 7 | `clone_batch_job` 필드 누락 | 중간 | `router_file.py`의 clone 엔드포인트에서 `create_batch_job` 호출 시 `job_type`, `connection_id`, `source_table`, `incremental_column`, `sync_mode`, `batch_size`, `on_row_error`를 기존 job에서 복사. `job_type='db'`이면 `folder_connection_id=None`. |

---

## 4. Phase별 구현 체크리스트

아래 순서대로 진행. 각 Phase 완료 시 [ ] → [x]로 체크하여 진행 상황을 관리할 수 있다.

---

### Phase 1: DB 배치 전용 실행기 (`batch_executor_db.py`)

**대상 파일**: `Backend/etl_server2/batch_executor_db.py` (신규)

- [ ] **1.1** 파일 생성 및 상단 docstring: 모듈 역할, `run_db_batch_job`, 의존성(service_file, db_load_service, load_service_file, transform_engine, etl_service 등) 명시.
- [ ] **1.2** `run_db_batch_job(batch_job_id: int) -> None` 구현.
  - [ ] `service_file.get_batch_job(batch_job_id)`로 조회.
  - [ ] `job_type != 'db'` 이면 return. `is_active` False 또는 `last_run_status == 'running'` 이면 return.
  - [ ] `create_batch_run` → `update_job_status("running")`.
  - [ ] `etl_service.get_connection_for_etl(connection_id)`로 소스 타입 확인 후 Postgres/MySQL/Oracle 연결 (db_load_service와 동일 패턴).
  - [ ] **batch_size / batch_interval_seconds**: job에서 `batch_size`, `batch_interval_seconds` 읽기. **MySQL/Oracle 상한**: MySQL이면 `effective_batch_size` 최대 10000, Oracle이고 0이면 10000. (정제 #3)
  - [ ] 증분: `incremental_column` + `last_synced_at` 있으면 `WHERE incremental_column > last_synced_at`; 없으면 전체. `sync_mode='full'`이면 전체 SELECT 후 타겟 DROP/CREATE (db_load_service 로직 재사용 가능).
  - [ ] **chunk 루프**: `effective_batch_size` 단위로 fetch → DataFrame → `transform_engine.apply_mapping_type_cast`(있으면) → `load_service_file.load_dataframe` → commit. **매 chunk 후** `batch_interval_seconds > 0`이면 `time.sleep(batch_interval_seconds)` 후 다음 chunk. (ETL 테이블과 독립적으로 배치잡 전용 설정 사용)
  - [ ] 타겟 적재: `load_service_file.load_dataframe(..., source_filename=...)` 호출. **정제 #4**: `source_filename`은 `f"db_batch_{run_id}_{batch_offset}"` 또는 None(롤백 미지원 시).
  - [ ] 성공 시: 조회 결과에서 `incremental_column` MAX → **정제 #6**: `pd.to_datetime` 처리 후 `service_file.update_last_synced_at_db_batch(batch_job_id, max_value)` → `finish_run("success")`, `update_job_status("success")`.
  - [ ] 예외 시: `finish_run("error")`, `update_job_status("error")`.
  - [ ] **정제 #5**: `finally`에서 소스/타겟 conn 정리 후, **finally 밖**에서 `check_consecutive_failures(batch_job_id, threshold=5)` 호출 (run_id 여부와 무관).
- [ ] **1.3** db_load_service에서 `_fetch_source_columns`, `_fetch_source_columns_mysql`, `_fetch_source_columns_oracle`, `_copy_upsert_batch`(또는 `_copy_upsert_batch_safe`), full 모드 DROP/CREATE·INSERT 관련 로직 재사용(import 후 호출). 소스/타겟 커서·conn은 batch_executor_db에서 준비해 전달.

---

### Phase 2: 스케줄러 분기 (`scheduler_file.py`)

**대상 파일**: `Backend/etl_server2/scheduler_file.py`

- [ ] **2.1** `add_job(job)` 수정: `job.get('job_type') == 'db'`이면 실행 함수로 `batch_executor_db.run_db_batch_job` 사용, 아니면 `batch_executor_file.run_batch_job`. `get_scheduler().add_job(실행함수, trigger="interval", minutes=..., id=job_id, args=[batch_job_id], ...)`.
- [ ] **2.2** `run_now(batch_job_id)` 수정: `get_batch_job`으로 조회 후 `job_type == 'db'`이면 `batch_executor_db.run_db_batch_job`, 아니면 `batch_executor_file.run_batch_job` 호출. (기존처럼 `add_job(..., next_run_time=now)` 패턴 유지 가능)
- [ ] **2.3** 상단 docstring/Dependencies에 `batch_executor_db` 언급 추가.

---

### Phase 3: 서비스 레이어 확장 (`service_file.py`)

**대상 파일**: `Backend/etl_server2/service_file.py`

- [ ] **3.1** `create_batch_job` 시그니처 확장: 인자 추가 `job_type='file'`, `connection_id=None`, `source_table=None`, `incremental_column=None`, `sync_mode='incremental'`, `batch_size=None`, `batch_interval_seconds=None`, `on_row_error='fail'`. INSERT 시 위 신규 컬럼 + `last_synced_at=NULL` 포함.
  - [ ] **정제 #2**: 중복 검사 분기. `job_type='db'`일 때: `(connection_id, source_table, target_table, storage_connection_id)`로만 조회. `job_type='file'`일 때: 기존대로 `(folder_connection_id, file_pattern, target_table, storage_connection_id)`.
  - [ ] `job_type='file'`이면 `folder_connection_id` 필수; `job_type='db'`이면 `connection_id` 필수, `folder_connection_id`는 NULL 허용.
- [ ] **3.2** `update_batch_job`: `allowed` set에 `"connection_id"`, `"source_table"`, `"incremental_column"`, `"sync_mode"`, `"batch_size"`, `"batch_interval_seconds"`, `"on_row_error"` 추가. JSON/타입 처리 필요 시 기존 패턴 유지.
- [ ] **3.3** `update_last_synced_at_db_batch(batch_job_id, synced_at, conn=None)` 신규: `batch_jobs.last_synced_at = synced_at`, `updated_at = NOW()`. conn 미전달 시 내부에서 get/close.
- [ ] **3.4** `get_batch_job`: SELECT에 `j.job_type`, `j.connection_id`, `j.source_table`, `j.incremental_column`, `j.sync_mode`, `j.last_synced_at`, `j.batch_size`, `j.batch_interval_seconds`, `j.on_row_error` 추가. `LEFT JOIN etl_connections ec ON j.connection_id = ec.connection_id` → `ec.connection_name AS source_connection_name` (또는 프로젝트 컬럼명에 맞게).
- [ ] **3.5** `list_batch_jobs`: 동일 컬럼 + 동일 LEFT JOIN. 인자에 `job_type: Optional[str] = None` 추가, 값이 있으면 `AND j.job_type = %s` 조건 추가.
- [ ] **3.6** 파일 상단 [Main Functions] / [Endpoints/...] 주석에 위 함수·컬럼 반영.

---

### Phase 4: API·라우터 확장 (`router_file.py`)

**대상 파일**: `Backend/etl_server2/router_file.py`

- [ ] **4.1** `CreateBatchJobBody`: 필드 추가 `job_type: str = "file"`, `connection_id: Optional[int] = None`, `source_table: Optional[str] = None`, `incremental_column: Optional[str] = None`, `sync_mode: Optional[str] = "incremental"`, `batch_size: Optional[int] = None`, `batch_interval_seconds: Optional[int] = None`, `on_row_error: Optional[str] = "fail"`. `folder_connection_id`는 Optional로 두거나, 검증 단계에서 `job_type='file'`일 때만 필수로 검사.
- [ ] **4.2** `UpdateBatchJobBody`: 위 필드들 Optional로 동일 추가.
- [ ] **4.3** POST `/jobs`: `job_type='db'`일 때 `connection_id` 필수 검증; `job_type='file'`일 때 `folder_connection_id` 필수. `batch_service.create_batch_job(..., job_type=..., connection_id=..., source_table=..., incremental_column=..., sync_mode=..., batch_size=..., batch_interval_seconds=..., on_row_error=...)` 전달.
- [ ] **4.4** GET `/jobs`: 쿼리 파라미터 `job_type: Optional[str] = Query(None, description="file | db")` 추가 후 `list_batch_jobs(..., job_type=job_type)` 호출.
- [ ] **4.5** GET `/jobs/{batch_job_id}/db-preview` 신규: `get_batch_job(batch_job_id)` → `job_type != 'db'`이면 400. `preview_service._preview_db({"connection_id": job["connection_id"], "source_table": job["source_table"], "column_mapping": job.get("column_mapping")})` 호출하여 미리보기 반환. (Phase 5 래핑 함수는 불필요하다고 가정)
- [ ] **4.6** PATCH `/jobs/{id}`: body에서 새 필드들(`connection_id`, `source_table`, `incremental_column`, `sync_mode`, `batch_size`, `batch_interval_seconds`, `on_row_error`) 있으면 `update_batch_job`에 전달.
- [ ] **4.7** **정제 #7** clone_batch_job: `create_batch_job` 호출 시 기존 job에서 `job_type`, `connection_id`, `source_table`, `incremental_column`, `sync_mode`, `batch_size`, `batch_interval_seconds`, `on_row_error` 전부 전달. `job_type='db'`이면 `folder_connection_id=None`, `file_pattern`은 빈 문자열 또는 기존 값 유지(서비스 레이어에서 nullable 허용 시).
- [ ] **4.8** 파일 상단 [Pydantic Models] / [Endpoints] 주석 갱신.

---

### Phase 5: 프론트엔드 UI — DB 탭 배치잡 등록

**위치**: DB 연결 섹션(ETL2 페이지 **db** 탭)의 **ETL 테이블 등록 아래**에 "배치 Job (DB 소스)" 블록 추가. 기존 폴더 탭의 배치 Job과 동일한 패턴(폼 + 목록)으로, **DB 소스 전용** 폼과 목록(필터)만 추가하면 됨.

#### 5.1 UI 구성 제안 (최적안)

- **레이아웃**: `ETLPage.jsx`에서 `sourceType === 'db'`일 때, `DbConnectionForm` 아래에 동일한 스타일의 섹션 추가.
  - 제목: **배치 Job (DB 소스)** — "등록된 DB 연결로 주기 자동 적재를 설정합니다."
  - **폼**: DB 배치 전용 입력 (connection_id, source_table, target_table, storage, 증분/동기화/배치 설정, 주기).
  - **목록**: DB 배치만 표시 (job_type=db 필터), 즉시 실행·이력·토글·삭제·미리보기 버튼.

- **폼 컴포넌트**: `BatchJobFormDb.jsx` **신규** 권장.  
  - 이유: 파일 배치(BatchJobFormFile)는 folder_connection_id·file_pattern·패턴 목록 등 플로우가 다름. DB 배치는 connection_id·source_table·증분 컬럼·sync_mode·batch_size·batch_interval_seconds 중심이라 한 컴포넌트에 타입 분기보다 **분리**가 유지보수에 유리.
  - **입력 항목**:  
    - 연결: `connection_id` (etl2ListConnections로 채운 셀렉트).  
    - 소스 테이블: `source_table` (텍스트 입력, 예: `schema.table` 또는 연결별 기본 스키마 하의 테이블명).  
    - 타겟 테이블: `target_table`, 저장 DB: `storage_connection_id` (기존 저장 DB 셀렉트 재사용).  
    - 증분: `incremental_column` (선택 또는 입력), `sync_mode` (full / incremental).  
    - 배치: `batch_size`, `batch_interval_seconds` (chunk 간 대기 초).  
    - 주기: `interval_minutes`, Job 이름: `job_name`, PK: `pk_columns`, `on_row_error` (fail/skip).  
    - (선택) 컬럼 매핑: 기존 ETL 테이블 등록과 동일한 모달/패턴 재사용 가능.
  - **등록**: `batchCreateJob`에 `job_type: 'db'`, 위 필드 전부 전달. 성공 시 목록 새로고침·onSuccess.

- **목록**: `BatchJobListFile.jsx` **재사용** + **job_type 필터**.
  - `batchListJobs(folderConnectionId, isActive, job_type)` 호출 시 `job_type` 쿼리 파라미터 추가 (client.js에 반영).
  - DB 탭에서는 `jobTypeFilter="db"` prop으로 `batchListJobs(..., job_type='db')`만 호출해 **DB 배치만** 표시.
  - 테이블 컬럼: job_name, 소스(connection_name / source_table), 타겟, 주기, 상태, 마지막 실행, 다음 예상, 동작(즉시 실행·이력·토글·삭제). **DB 배치 전용**: "미리보기" 버튼 → GET `/jobs/{id}/db-preview` 결과를 모달 또는 드로어로 표시.
  - 폴더 탭에서는 기존처럼 `jobTypeFilter` 없음 또는 `'file'` → 파일 배치만 표시.  
  - **job_type 뱃지**: 목록에서 각 행에 `file` / `db` 뱃지 표시하면, 나중에 "전체 배치" 뷰를 만들 때도 구분 가능.

- **ETLPage.jsx 변경 요약**:
  - `sourceType === 'db'`일 때: `<DbConnectionForm ... />` 다음에  
    `<section className="etl-db-form__section etl-db-form__section--batch-job">`  
    - `<h3>배치 Job (DB 소스)</h3>`  
    - `<BatchJobFormDb onSuccess={handleRefresh} refreshKey={refreshKey} />`  
    - `<BatchJobListFile jobTypeFilter="db" onSuccess={handleRefresh} refreshKey={refreshKey} onOpenHistory={...} />`  
  - "처음 사용하시나요?" 안내에 DB 탭용 문구 추가: "2. 아래 **배치 Job (DB 소스)**에서 같은 연결·소스 테이블을 주기적으로 자동 적재할 수 있습니다."

#### 5.2 체크리스트 (Phase 5)

- [ ] **5.2.1** `client.js`: `batchListJobs(folderConnectionId, isActive, jobType)` 시그니처에 `jobType` 추가, 쿼리 파라미터 `job_type` 전달. `batchGetJobDbPreview(batchJobId)` 신규: GET `/api/etl2/batch/jobs/:id/db-preview` 호출.
- [ ] **5.2.2** `BatchJobFormDb.jsx` 신규: DB 연결 셀렉트, source_table, target_table, storage_connection_id, incremental_column, sync_mode, batch_size, batch_interval_seconds, interval_minutes, job_name, pk_columns, on_row_error. 등록 시 `batchCreateJob({ job_type: 'db', ... })`. etl.css 기존 클래스 재사용(etl-db-form 등).
- [ ] **5.2.3** `BatchJobListFile.jsx`: prop `jobTypeFilter` 추가. `batchListJobs(..., jobType)` 호출 시 `jobTypeFilter` 전달. 테이블에 `job_type` 뱃지 표시. DB 배치 행에 "미리보기" 버튼 추가 → `batchGetJobDbPreview(id)` 호출 후 미리보기 모달/패널 표시.
- [ ] **5.2.4** `ETLPage.jsx`: db 탭에 "배치 Job (DB 소스)" 섹션 추가. `BatchJobFormDb`, `BatchJobListFile`(jobTypeFilter="db") 렌더. howToDb 안내 문구에 배치 Job 설명 추가.
- [ ] **5.2.5** (선택) DB 배치용 소스 테이블 목록: 연결 선택 시 해당 연결의 테이블 목록 API가 있으면 셀렉트로 채우기. 없으면 source_table은 텍스트 입력 유지.

---

### Phase 6: 미리보기 (선택)

- **선택**: `preview_service`에 `get_db_source_preview(...)` 공개 함수를 두지 않아도 됨. router에서 `_preview_db`에 dict만 넘겨 호출하면 충분. 나중에 필요 시 래핑 추가.

---

## 7. 검증 체크리스트 (구현 완료 후)

- [ ] DB 배치 1건 등록(POST `/jobs`, `job_type=db`, `connection_id`, `source_table`, `target_table`, `storage_connection_id`, `incremental_column` 등) 후 목록/상세에 `job_type`, `source_connection_name` 등 노출.
- [ ] 스케줄러에 DB 배치가 등록되고, 주기 실행 시 `run_db_batch_job`이 호출되어 소스 SELECT → 타겟 upsert → `last_synced_at` 갱신·`batch_run_history` 기록.
- [ ] GET `/jobs/{id}/db-preview` 호출 시 10행 미리보기 반환.
- [ ] `job_type` 필터(GET `/jobs?job_type=db`) 동작.
- [ ] DB 배치 clone 시 새 컬럼 전부 복사.
- [ ] MySQL 소스 시 `batch_size` 10000 상한 적용; `check_consecutive_failures`는 에러 시 finally 밖에서 호출; `last_synced_at`은 pd.to_datetime 후 저장.
- [ ] DB 탭에서 배치 Job (DB 소스) 폼으로 등록 후 목록에 표시·즉시 실행·미리보기 동작.
- [ ] `batch_interval_seconds` 설정 시 실행기에서 chunk 간 대기 적용.

---

## 8. 참조

- **09_ETL_SFTP_Connection.md**: 파일 배치 아키텍처·테이블·플로우.
- **08_ETL_Phase_Implement_Guide.md**: DB 적재·COPY·Upsert·형변환.
- **Backend/etl_server2/db_load_service.py**: `run_db_load`, `_get_source_connection`, `_fetch_source_columns*`, `_copy_upsert_batch`, full 모드.
- **Backend/etl_server2/service.py**: `get_connection_for_etl`, `_connect_postgres`, `_connect_mysql`, `_connect_oracle`, `parse_source_table_parts`.
