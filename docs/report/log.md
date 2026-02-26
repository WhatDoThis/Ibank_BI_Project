## 2026-02-26 ETL2 파일 단위 적재 롤백 (batch_loaded_keys)

**목적:** 특정 파일로 적재된 데이터만 타겟 테이블에서 DELETE. 고객 테이블·적재 로직 변경 없이 시스템 DB `batch_loaded_keys`로 PK 추적.

**흐름:**
- 적재 시: PK가 있고 출처 정보가 넘어오면 `load_dataframe` 내부에서 `_record_loaded_keys`로 해당 파일의 행별 PK를 `batch_loaded_keys`에 INSERT.
- 롤백 시: `rollback_file_from_target`이 batch_loaded_keys에서 job+run+filename으로 PK 목록 조회 → 타겟 테이블에서 해당 PK들 DELETE → batch_loaded_keys에서 해당 건 DELETE.

**구현:**
- **load_service_file.py**: `load_dataframe`에 선택 인자 `batch_job_id`, `run_id`, `source_filename`, `sys_conn` 추가. PK가 있을 때만 `_record_loaded_keys(sys_conn, ...)` 호출. `_record_loaded_keys`: 행별 pk_values(JSONB) 벌크 INSERT(1000건씩), 실패 시 rollback 후 경고만 로깅.
- **batch_executor_file.py**: `load_dataframe` 호출 시 위 4개 인자 전달.
- **service_file.py**: `rollback_file_from_target(batch_job_id, run_id, filename, storage_connection_id, target_table, pk_columns_str)` 추가. PK 비면 ValueError. 시스템 DB에서 PK 목록 조회 → 타겟 DB에서 1000건씩 배치 DELETE → 시스템 DB에서 해당 loaded_keys 삭제. 반환: 삭제된 행 수.
- **router_file.py**: `RollbackFileBody(filename, run_id)`, POST `/jobs/{batch_job_id}/rollback-file` 추가. 실행 상세 응답에 `pk_columns` 포함(롤백 버튼 활성화용).
- **client.js**: `batchRollbackFile(batchJobId, body)` 추가.
- **BatchHistoryDetailFile.jsx**: `pk_columns` 있으면 해당 런에서 성공(status=ok) 파일만 "적재 롤백" 버튼 활성화. 클릭 시 확인 후 `batchRollbackFile(batchJobId, { run_id: runId, filename })` 호출, 완료 후 상세 재조회. PK 없으면 버튼 비활성 + 툴팁 "PK를 설정하면 파일 단위 롤백이 가능합니다."

**제약:** PK가 없는 배치(APPEND만)는 파일 단위 롤백 미지원.

**검증:** linker(연결 추적), verifier(API·빌드) 통과.

**변경 파일:** load_service_file.py, batch_executor_file.py, service_file.py, router_file.py, client.js, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 파일 단위 커밋 복원 + 파일 로우별 상세·원격 삭제

**의도 반영:** 정상 파일/문제 파일이 섞일 수 있으므로 **파일 단위 커밋**이 맞음. 런 전체 롤백 대신 **이미 처리된 파일은 커밋 유지**, 취소는 **다음 파일부터 중단**만 수행.

**Executor 변경:**
- `batch_executor_file.py`: 적재 후 다시 **파일 단위 commit** (각 파일 처리 직후 `target_conn.commit()`).
- 런 종료 시 한 번만 commit하던 블록 제거.
- 취소 시: `target_conn.rollback()` 제거. 이미 처리된 파일은 커밋된 상태로 두고, `finish_run('cancelled')` 후 return만 수행.

**실행 상세 UI (파일 로우별):**
- `BatchHistoryDetailFile.jsx`: 파일별 결과 테이블에 **동작** 열 추가.
  - **상세**: 클릭 시 해당 로우 아래에 파일명·타임스탬프·상태·행 수·삽입·갱신·체크섬·사유/에러 등 상세 블록 토글.
  - **원격 삭제**: 확인 후 `batchDeleteSkippedFiles(batchJobId, [filename])` 호출. 원격(SFTP/S3)에서 해당 파일 삭제 후 상세 재조회.
  - **적재 롤백**: 해당 파일만 롤백하려면 배치 실행 시 PK 목록 저장이 필요하므로, 현재는 비활성 + 툴팁으로 "추후 지원 예정" 안내.
- 런 전체 **실행 취소** 버튼 문구: "실행 취소 (다음 파일부터 중단)"으로 변경.

**추후 검토:** 특정 파일로 올라간 데이터만 롤백하려면, 적재 시 해당 파일에서 insert/upsert된 PK 목록을 `file_list` 등에 저장하고, 롤백 API에서 해당 PK로 DELETE하는 방식이 필요.

**변경 파일:** batch_executor_file.py, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 타겟 테이블 셀렉트·검증·실행 상세·취소 롤백

**1. 타겟 테이블 셀렉트 + 새 테이블 입력**
- Backend: GET `/batch/target-tables?storage_connection_id=` 추가 (etl_service.list_target_tables). POST `/batch/jobs/validate-target` 추가 (ValidateTargetBody: folder_connection_id, storage_connection_id, file_pattern, target_table). 기존 테이블일 때 파일 패턴 1건 컬럼 vs 타겟 테이블 컬럼 비교, 적재 가능 여부만 반환(valid, message). 컬럼 매핑 UI/검증 제외.
- Frontend: `batchListTargetTables`, `batchValidateTarget` 추가(client.js). BatchJobFormFile: 저장 DB 선택 시 target-tables 로드. 타겟 테이블 = 셀렉트(기존 테이블 목록) + "새 테이블 (직접 입력)" 선택 시 텍스트 입력. 등록 시 기존 테이블 선택이면 validate-target 호출 후 valid가 아니면 에러 메시지로 막고, valid이거나 새 테이블이면 batchCreateJob 호출.

**2. 실행 상세 UI**
- BatchHistoryDetailFile: 요약에 "성공 N건 · 실패 N건 · 스킵 N건" 추가. 파일별 테이블에 상태 뱃지(etl-db-form__status--success/error/idle), 행 수·삽입·갱신 열 분리 표시.

**3. 실행 취소 + 롤백**
- Backend: `batch_run_history`에 `cancel_requested_at TIMESTAMP NULL` 컬럼 필요. 마이그레이션: `ALTER TABLE ... ADD COLUMN cancel_requested_at TIMESTAMP NULL;` (시스템 DB 스키마). service_file: `set_run_cancel_requested(run_id)`, `is_run_cancel_requested(run_id, conn)` 추가. router_file: POST `/jobs/{batch_job_id}/history/{run_id}/cancel` 추가.
- batch_executor_file: 파일별 commit 제거, 루프 종료 후 target_conn.commit() 1회만 수행. 매 파일 처리 전 `is_run_cancel_requested(run_id)` 확인, True면 target_conn.rollback(), finish_run('cancelled', file_list=현재까지), return. 파일 예외 시에도 rollback 후 finish_run('error') 및 return.
- Frontend: BatchHistoryDetailFile에서 status=running일 때 "실행 취소 (적재 롤백)" 버튼 표시, batchCancelRun 호출 후 상세 재조회. client.js에 batchCancelRun 추가.

**변경 파일:** router_file.py, service_file.py, batch_executor_file.py, load_service_file (normalize_col import), client.js, BatchJobFormFile.jsx, BatchHistoryDetailFile.jsx, log.md.

---

## 2026-02-26 ETL2 배치 Job 등록 422 원인 수정 (기본 DB 처리)

**원인:** POST /api/etl2/batch/jobs는 `storage_connection_id`를 필수로 요구하는데, 프론트 "저장 DB" 셀렉트의 기본 옵션이 "기본 DB"(value="")라서 그대로 두면 `null`이 전달되어 422 발생.

**수정:** "기본 DB" 선택(value="")일 때는 저장 DB 목록의 **첫 번째 연결 ID**를 사용하도록 변경. 목록이 비어 있을 때만 "저장 DB 목록이 비어 있습니다. 저장 DB를 먼저 등록하세요."로 막음.

**변경 파일:** BatchJobFormFile.jsx, log.md.

---

## 2026-02-26 ETL2 폴더 연결 폼 레이아웃·UI 정리

**폴더 연결 추가 — 호스트·포트 한 줄 정렬:**
- `FolderConnectionFormFile.jsx`: 호스트·포트를 `etl-db-form__grid--2` 대신 `etl-db-form__row etl-db-form__row--host-port`로 감싸 한 줄 배치. 호스트 필드에 `etl-db-form__field--host`, 포트 필드에 `etl-db-form__field--port` 적용.
- `etl.css`: `.etl-db-form__row--host-port` 추가 — `display: flex`, `gap: 16px`, `align-items: flex-start`. 호스트는 `flex: 1`, 포트는 `flex: 0 0 90px`로 고정 폭. 행 내 필드 `margin-bottom: 0`으로 중복 간격 제거. 720px 이하에서 `flex-direction: column`, 포트 필드 `max-width: 120px` 유지.

**변경 파일:** FolderConnectionFormFile.jsx, etl.css, log.md.

---

## 2026-02-26 ETL2 효율·정리·운영 기능 (1-1, 1-2, 2-1, 2-2, 3-1, 3-2)

**효율 개선:**
- **1-1** `load_service_file.py` `_batch_insert` / `_batch_upsert`: 행 생성을 `[tuple(batch[c].iloc[i] for c in columns) for i in range(len(batch))]`에서 `[tuple(row) for row in batch[columns].itertuples(index=False, name=None)]`로 변경. 수천~수만 행·다수 컬럼 시 성능 개선.
- **1-2** `service_file.py` `list_skipped_files`: 쿼리에 `LIMIT %s` 추가, 인자 `limit=50` (기본 최근 50회 이력만 스캔). 이력 수백 건 시 불필요한 데이터 읽기 감소.

**불필요 코드·방어 로직:**
- **2-1** `load_service_file.py` `load_dataframe`: `if not mapping_used: mapping_used = []` 제거. `if mapping_used:`만 유지.
- **2-2** `batch_executor_file.py` except 블록: 순서를 finish_run(선행) → update_job_status(항상) → check_consecutive_failures로 변경. 이력 먼저 닫고 Job 상태 갱신. `finish_run`을 try/except로 감싸 복구 실패 시 로그만 남기고, `update_job_status`도 try/except로 방어.

**추가 기능:**
- **3-1** `service_file.py` `update_last_processed_ts`: 인자 `ts`를 `Optional[str]`로 변경. `ts=None`이면 DB에 NULL 저장(처음부터 재시작). `router_file.py`에 `ResetTsBody`(timestamp: Optional[str]), POST `/jobs/{batch_job_id}/reset-ts` 추가. Body에 timestamp 생략 또는 null이면 last_processed_ts=NULL.
- **3-2** `router_file.py`: POST `/jobs/{batch_job_id}/clone` 추가. 기존 Job 기준으로 `job_name (복제)`, `target_table_copy`, `is_active=False`로 새 Job 생성 후 batch_job_id 반환.

**변경 파일:** load_service_file.py, service_file.py, batch_executor_file.py, router_file.py, log.md.

---

## 2026-02-26 ETL2 추가 보강 — 예외 처리·SQL·메모리·스킵 파일 기능

**추가 개선 (2-1 ~ 2-4):**
- **2-1** `batch_executor_file.py` except 블록: `check_consecutive_failures(batch_job_id, threshold=5)` 호출 시 `conn`을 넘기지 않도록 변경. 별도 커넥션으로 격리해 rollback이 선행 commit에 영향을 주지 않도록 함.
- **2-2** `load_service_file.py` `_batch_upsert`: `non_pk`가 비어 있으면 `ON CONFLICT (pk) DO NOTHING` 사용. PK만 있고 나머지 컬럼이 없을 때 `DO UPDATE SET` 문법 오류 방지.
- **2-3** `batch_executor_file.py` except 블록: `run_id`와 무관하게 `update_job_status(batch_job_id, "error", ...)` 항상 호출. `create_batch_run` 실패로 run_id가 None이어도 last_run_status가 "running"에 머물지 않도록 복구. `finish_run`·`check_consecutive_failures`는 run_id가 있을 때만 호출.
- **2-4** `batch_executor_file.py`: SHA-256 계산을 `_compute_sha256(file_path, chunk_size=8192)` 청크 읽기로 변경. 대용량 파일 시 메모리 사용 완화.

**미래 파일 필터링:**
- `parser_file.py` `get_pending_files`: 선택 인자 `max_ts=None` 추가. 미지정 시 현재 시각으로 설정해 `ts <= max_ts` 조건으로 미래 타임스탬프 파일 제외. batch_executor 호출부는 변경 없음(기본값으로 동작).

**스킵/에러 파일 관리 (문제 파일 목록·원격 삭제):**
- `folder_adapter_file.py`: `FolderAdapter`에 `delete_file(filename)` 추상 메서드 추가. `SFTPAdapter`는 `sftp.remove(remote)`, `S3Adapter`는 `s3.delete_object(Bucket, Key)` 구현.
- `service_file.py`: `list_skipped_files(batch_job_id, conn=None)` — batch_run_history.file_list에서 status=skipped|error만 추출, 동일 파일명 최신 1건. `delete_remote_files(folder_connection_id, filenames)` — 어댑터로 원격 삭제 후 `{ deleted, failed }` 반환.
- `router_file.py`: `DeleteRemoteFilesBody`(filenames). GET `/jobs/{id}/skipped-files`, POST `/jobs/{id}/skipped-files/delete` 엔드포인트 추가.
- `client.js`: `batchListSkippedFiles(batchJobId)`, `batchDeleteSkippedFiles(batchJobId, filenames)` 추가.
- `SkippedFilesPanelFile.jsx` 신규: 배치 Job별 스킵/에러 파일 목록 테이블, 체크박스 선택 후 원격 삭제, 새로고침·닫기.
- `BatchJobListFile.jsx`: 동작 열에 "문제 파일" 버튼 추가, 클릭 시 해당 Job의 `SkippedFilesPanelFile` 패널 표시.

**변경 파일:** batch_executor_file.py, load_service_file.py, parser_file.py, folder_adapter_file.py, service_file.py, router_file.py, client.js, SkippedFilesPanelFile.jsx(신규), BatchJobListFile.jsx, log.md.

---

## 2026-02-26 ETL2 파일 연결 기능 보강 (09_ETL_SFTP_Connection 설계서 정합성)

**버그/위험 보강:**
- **1-2** `Backend/etl_server2/service_file.py`: `check_consecutive_failures(batch_job_id, threshold=5, conn=None)` 구현. 최근 5회 연속 status='error' 시 batch_jobs.is_active=False, last_error_message 설정, 스케줄러에서 제거. batch_executor_file 예외 블록에서 호출하여 에러 기록 후 연속 실패 시 자동 비활성화.
- **1-3** `Backend/etl_server2/batch_executor_file.py`: `_connect_with_retry(folder_connection_id, retries=3)` 추가. get_folder_adapter 호출을 2초·4초·8초 exponential backoff로 재시도 (§7.4). run_batch_job에서 adapter 획득 시 사용.
- **1-4** `Backend/etl_server2/load_service_file.py`: PostgreSQL 파라미터 한도(65,535) 대비 `MAX_PARAMS=60000`, `_calc_batch_size(num_columns)` 도입. `_batch_insert`/`_batch_upsert`에서 `effective_batch = min(BATCH_SIZE, _calc_batch_size(len(columns)))` 적용하여 컬럼 수가 많을 때 SQL 크기 초과 방지.
- **1-1** `Backend/etl_server2/batch_executor_file.py`: SFTP 대기 로직을 `time.sleep(3)`에서 `_wait_for_stable_size(adapter, filename, checks=3, interval=3)`로 변경 (§7.8). stat()으로 크기 조회 → 3초 간격 재조회, 동일하면 완료(최대 3회). S3 등 sftp 미보유 어댑터는 no-op.

**설계 보강:**
- **2-4** `Backend/etl_server2/scheduler_file.py`: 모듈 레벨 BackgroundScheduler 인스턴스를 제거하고 `_scheduler` + `get_scheduler()` lazy 초기화로 변경. 멀티 워커(gunicorn --workers N) 시 import 시점 중복 인스턴스 방지. `start_scheduler()`에서 `SCHEDULER_ENABLED` 환경변수 지원: `false` 시 스케줄러 기동 생략(단일 프로세스에서만 기동 권장).
- **2-1** `Backend/etl_server2/service_file.py`: 배치 실행 경로에서 커넥션 재사용을 위해 `create_batch_run`, `finish_run`, `update_job_status`, `update_last_processed_ts`, `is_duplicate_checksum`, `check_consecutive_failures`에 선택적 인자 `conn=None` 추가. 호출부에서 conn 전달 시 해당 커넥션 사용 후 close 책임은 호출부. `batch_executor_file.run_batch_job`에서 시스템 DB 커넥션 1개를 열어 위 함수들에 전달하고 finally에서 close하여 대량 파일 시 커넥션 과다 오픈 완화.

**UX/API:**
- **3-1** `Backend/etl_server2/router_file.py`: GET /jobs 응답에 §11.3에 따른 `next_run_time` 추가. `scheduler_file.get_scheduler().get_job(f"batch_{id}")`로 next_run_time 조회 후 ISO 문자열로 직렬화. 프론트 배치 목록 "다음 실행 시각" 표시에 사용 가능.
- **3-2** PK 미설정 경고: `BatchJobListFile.jsx`에 이미 `pk_columns` 비어 있을 때 "PK 미설정: 중복 행 발생 가능" 경고 표시 구현됨. 추가 변경 없음.

**기타:** parser_file.py의 `extract_patterns_from_files`는 이미 구현되어 있음(2-3 확인 완료).

**변경 파일:** service_file.py, batch_executor_file.py, load_service_file.py, scheduler_file.py, router_file.py, log.md.

---

## 2026-02-25 Phase 6 UI 일관성 (09_ETL_SFTP_Connection §7.6, §12)

**Part 1 — UI polish:**
- `BatchJobFormFile.jsx`: PK 컬럼이 비어 있을 때 "PK 미설정: 중복 행 발생 가능" 경고를 `etl-db-form__message etl-db-form__message--warning`으로 PK 입력란 아래 상시 표시.
- `BatchJobListFile.jsx`: last_run_status를 뱃지로 표시 (성공=녹색, 에러=빨강, 실행중=파랑, 대기=회색). `etl.css`에 `.etl-db-form__status-badge`, `.etl-db-form__status--success|--error|--running|--idle` 추가. "다음 예상 실행" 열 추가: last_run_at + interval_minutes 계산, last_run_at 없으면 "-". Job 행에서 pk_columns 비어 있으면 "PK 미설정: 중복 행 발생 가능" 작은 경고 표시.

**Part 2 — Design consistency (minimal unification):**
- 방향: 섹션 제목 계층 통일. 폴더 탭의 "배치 Job" 블록 제목을 `etl-page__section-title`에서 `etl-db-form__heading`으로 변경하여 Storage·DB 탭과 동일한 블록 제목 스타일 적용. 폴더/배치 목록은 테이블 유지, 저장 DB 목록은 conn-list 유지 (정보량에 맞게 그대로 사용).

**변경 파일:** `etl.css`(뱃지·경고 스타일), `BatchJobFormFile.jsx`, `BatchJobListFile.jsx`, `ETLPage.jsx`, `log.md`.

---

## 2026-02-25 Phase 5 Frontend (실행 이력 패널·상세)

**구현 내용 (09_ETL_SFTP_Connection §11.3):**
- `packages/etl2/components/BatchHistoryPanelFile.jsx`: 배치 Job 실행 이력 목록. Props: batchJobId, onClose, onSelectRun(optional). 마운트 시 batchListJobHistory(batchJobId) 호출. 테이블: run_id, started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message, [상세]. [상세] 클릭 시 onSelectRun(run_id) 호출. etl-db-form__table, etl-db-form__table-wrap 사용. 로딩·빈 목록·에러 상태 처리. 한글 파일 상단 주석.
- `packages/etl2/components/BatchHistoryDetailFile.jsx`: 실행 1건 상세. Props: batchJobId, runId, onBack, onClose. batchGetJobHistoryDetail(batchJobId, runId) 호출 후 요약(started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message) 및 file_list 테이블(filename, timestamp, status, 행/삽입·갱신, 에러·사유). [뒤로]/[닫기] 버튼. etl-db-form 클래스 사용. 한글 파일 상단 주석.
- `packages/etl2/ETLPage.jsx`: folder 탭에 실행 이력 모달 연동. state: batchHistoryJobId, batchHistoryRunId. BatchJobListFile에 onOpenHistory 전달 → [이력] 클릭 시 모달 오픈. 모달 제목 "실행 이력", etl-add-file-modal 패턴(backdrop + box, maxWidth 900px). batchHistoryRunId가 null이면 BatchHistoryPanelFile, 설정 시 BatchHistoryDetailFile 표시. onSelectRun으로 상세 전환, onBack으로 목록 복귀.

---

## 2026-02-25 Phase 5 Backend (File checksum duplicate detection §7.7)

**구현 내용 (09_ETL_SFTP_Connection §7.7):**
- `Backend/etl_server2/service_file.py`: `is_duplicate_checksum(batch_job_id, checksum)` 추가. batch_run_history에서 해당 batch_job_id의 file_list(JSONB)에 동일 checksum이 있는지 조회 (jsonb_array_elements + elem->>'checksum'). _get_db(), _schema(), _q() 패턴 사용. True/False 반환.
- `Backend/etl_server2/batch_executor_file.py`: 다운로드 후·read_file 전에 SHA-256 체크섬 계산 (hashlib). `is_duplicate_checksum` 호출 시 True면 file_results에 `{"filename", "status": "skipped", "reason": "duplicate_checksum"}` 추가 후 continue (load·last_processed_ts 갱신 없음). 비중복 시 기존대로 read_file → load_dataframe → update_last_processed_ts, 성공 시 file_results 항목에 `"checksum": checksum` 포함하여 batch_run_history.file_list에 저장. parser_file, load_service_file 미수정.

---

## 2026-02-25 Phase 4 Backend (Batch execution: download → parse → load)

**구현 내용 (09_ETL_SFTP_Connection §4.3, §7.5, §10):**
- `Backend/etl_server2/parser_file.py`: `read_file(local_path, extension, max_rows=None)` 이미 구현됨. csv/xlsx/xls/parquet 지원, CSV는 utf-8/cp949, engine=python·on_bad_lines=skip. parse_filename/get_pending_files/extract_patterns_from_files 미수정.
- `Backend/etl_server2/load_service_file.py`: get_target_connection(storage_connection_id), table_exists, create_table_from_dataframe(df→PG 타입·PK), load_dataframe(테이블 없으면 CREATE 후 INSERT, 있으면 PK upsert 또는 INSERT만). 배치 2000건, column_mapping 지원. etl_server2.service.get_target_db_connection 재사용.
- `Backend/etl_server2/batch_executor_file.py`: 스텁 제거 후 실제 흐름 구현. run_batch_job: get_batch_job → last_run_status=running 시 skip → create_batch_run → get_folder_adapter → list_files → get_pending_files → 없으면 finish_run(skipped) → success. 있으면 get_target_connection → 파일별: SFTP 시 3초 대기 → 임시파일 다운로드 → max_file_size_mb 초과 시 skip → read_file → load_dataframe(column_mapping) → commit → update_last_processed_ts → file_results에 결과 추가. 예외 시 파일별 error 추가 후 계속. finally 임시파일 삭제, target_conn.close(), adapter.close(). finish_run(success/error), update_job_status.
- `Backend/etl_server2/service_file.py`: get_batch_job에 이미 c.protocol 포함되어 있어 executor에서 SFTP 대기 가능.

---

## 2026-02-25 Phase 4 Backend (Real batch execution: download → parse → load)

**구현 내용:**
- `Backend/etl_server2/parser_file.py`: `read_file(local_path, extension, max_rows=None)` 추가. csv/xlsx/xls/parquet 지원. CSV는 utf-8·cp949 폴백, engine=python, on_bad_lines=skip. max_rows 시 nrows 또는 head 적용. `_read_csv_robust` 헬퍼 추가. parse_filename, get_pending_files, extract_patterns_from_files 미수정.
- `Backend/etl_server2/load_service_file.py`: 신규. `get_target_connection(storage_connection_id)` → etl_server2.service.get_target_db_connection, (conn, schema). `table_exists(conn, schema, table_name)`. `create_table_from_dataframe(conn, schema, table_name, df, pk_columns_list)` — dtype→PG(BIGINT/DOUBLE PRECISION/BOOLEAN/TIMESTAMP/TEXT), 컬럼명 정규화, PK 옵션. `load_dataframe(conn, schema, table_name, df, pk_columns_str, column_mapping)` — 테이블 없으면 CREATE 후 INSERT, 있으면 PK 있으면 ON CONFLICT DO UPDATE/없으면 INSERT. 배치 2000건. column_mapping 시 rename/select 및 transform_engine.apply_mapping_type_cast 적용.
- `Backend/etl_server2/batch_executor_file.py`: 스텁 제거, 전체 흐름 구현. run_batch_job: get_batch_job → 중복 실행 방지(last_run_status==running) → create_batch_run → get_folder_adapter → list_files → get_pending_files. pending 없으면 finish_run(skipped, error_message='신규 파일 없음'). get_target_connection, get_etl_limits. 파일별: tempfile 다운로드, SFTP 시 3초 대기, 크기 검사(max_file_size_mb), parser_file.read_file, load_service_file.load_dataframe, commit, update_last_processed_ts, file_results 누적. 예외 시 파일별 error 기록·계속. finally 로컬 파일 삭제·adapter/target_conn close. finish_run(success, file_list), update_job_status(success). 외부 예외 시 finish_run(error), update_job_status(error).
- `Backend/etl_server2/service_file.py`: get_batch_job·list_batch_jobs에 batch_folder_connections JOIN으로 `protocol` 컬럼 추가. executor에서 wait_for_stable(SFTP) 분기용.

---

## 2026-02-25 Phase 3 Backend (Batch Jobs, Scheduler, Run History)

**구현 내용:**
- `Backend/etl_server2/service_file.py`: batch_jobs·batch_run_history 확장.
  - list_batch_jobs(folder_connection_id, is_active), get_batch_job, create_batch_job(interval_minutes 10~1440, file_extensions 기본값), update_batch_job(**kwargs), delete_batch_job.
  - create_batch_run, finish_run, update_job_status, update_last_processed_ts, list_run_history, get_run_detail. 시스템 DB _get_db/_schema/_q 패턴 사용.
- `Backend/etl_server2/scheduler_file.py`: 신규. BackgroundScheduler(ThreadPoolExecutor max_workers=3, coalesce=True, max_instances=1, misfire_grace_time=300). start_scheduler, load_active_batch_jobs, add_job, remove_job, reschedule_job, run_now. batch_executor_file.run_batch_job 연동.
- `Backend/etl_server2/batch_executor_file.py`: 신규(스텁). run_batch_job(batch_job_id): get_batch_job → create_batch_run → update_job_status(running) → finish_run(skipped) → update_job_status(success). Phase 4에서 실제 다운로드·적재 구현 예정.
- `Backend/etl_server2/router_file.py`: 배치 Job API 추가. GET/POST /jobs, PATCH/DELETE /jobs/{id}, POST /jobs/{id}/run-now, POST /jobs/{id}/toggle, GET /jobs/{id}/history, GET /jobs/{id}/history/{run_id}. Pydantic CreateBatchJobBody, UpdateBatchJobBody. 생성/수정/토글 시 스케줄러 add_job·remove_job·reschedule_job 연동.
- `Backend/api_server/main.py`: startup_etl_worker 내 queue_worker 후 scheduler_file.start_scheduler(), scheduler_file.load_active_batch_jobs() try/except 추가.
- `requirements.txt`: apscheduler>=3.10.0 추가.

---

## 2026-02-25 Phase 2 Implementation Verification
### 09_ETL_SFTP_Connection (Batch Sync patterns API and UI)

**Backend:**
- `Backend/etl_server2/parser_file.py`: `parse_filename`, `get_pending_files`, `extract_patterns_from_files` are correctly defined and implement the `_ib_` timestamp pattern.
- `Backend/etl_server2/router_file.py`: `GET /folder-connections/{folder_connection_id}/patterns` endpoint is correctly defined, uses `get_folder_adapter` and `extract_patterns_from_files`, and closes the adapter in `finally`.
**Verdict: All checks passed.**

**Frontend:**
- `shared/api/client.js`: `batchListFolderPatterns(id)` is correctly exported and calls the backend API.
- `packages/etl2/components/PatternSelectModalFile.jsx`: Component exists, accepts required props, uses `batchListFolderPatterns`, and displays the patterns table and direct input.
**Verdict: All checks passed.**

**Consistency:**
- API path in router and client.js match.
- Response shape `{ patterns: [...] }` matches documentation §8.3.
**Verdict: All checks passed.**

**Build/Import:**
- No broken imports or lint errors found in `parser_file.py`, `router_file.py`, or `PatternSelectModalFile.jsx`.
**Verdict: All checks passed.**

**Overall: Phase 2 verification passed.**

---

## 2026-02-25 Phase 3 Frontend (Batch Job UI)

**구현 내용:**
- `shared/api/client.js`: 배치 Job API 8종 추가 (base path `/api/etl2/batch`).
  - `batchListJobs(folderConnectionId, isActive)`, `batchCreateJob(body)`, `batchUpdateJob(id, body)`, `batchDeleteJob(id)`, `batchRunJobNow(id)`, `batchToggleJob(id)`, `batchListJobHistory(id)`, `batchGetJobHistoryDetail(id, runId)`.
- `packages/etl2/components/BatchJobFormFile.jsx`: 배치 Job 등록 폼. 폴더 연결·파일 패턴 선택(PatternSelectModalFile)·저장 DB·job_name·target_table·pk_columns·interval_minutes(10~1440)·is_active. 등록 시 `batchCreateJob` 호출 후 `onSuccess` 콜백.
- `packages/etl2/components/BatchJobListFile.jsx`: 배치 Job 목록 테이블. `batchListJobs()` 조회, refreshKey 반영. 컬럼: job_name, 폴더, file_pattern, 저장 DB, 주기, 상태(활성/비활성), 마지막 상태·시각. 동작: 활성/비활성 토글, 즉시 실행, 이력(optional), 삭제(확인 후).
- `packages/etl2/ETLPage.jsx`: `sourceType === 'folder'` 일 때 "배치 Job" 섹션에 `BatchJobFormFile`, `BatchJobListFile` 렌더. 목록 갱신은 기존 `handleRefresh`/`refreshKey` 사용.