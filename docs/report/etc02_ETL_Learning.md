

# ETL Server 2 시스템 완전 가이드

> **대상 독자**: 이 시스템을 처음 접하는 개발자
> **목적**: 코드 구조 이해 → 기능별 흐름 파악 → 실무 응용

---

## 1. 시스템 개요

### 1.1 이 시스템은 무엇인가?

ETL Server 2는 **외부 데이터를 수집해서 PostgreSQL 데이터베이스에 적재하는 파이프라인 시스템**입니다.

```
ETL = Extract(추출) → Transform(변환) → Load(적재)
```

쉽게 말하면, "여기저기 흩어진 데이터(CSV 파일, 외부 DB, SFTP 서버 등)를 가져와서, 필요한 형태로 바꾸고, 우리 DB에 넣는 자동화 시스템"입니다.

### 1.2 지원하는 데이터 소스

| 소스 유형 | 설명 | 예시 |
|-----------|------|------|
| **파일 업로드** | 사용자가 직접 웹에서 업로드 | CSV, Excel(.xlsx/.xls), Parquet |
| **외부 DB** | PostgreSQL, MySQL, Oracle에서 직접 SELECT | 실시간 DB-to-DB 동기화 |
| **SFTP 폴더** | 원격 서버의 파일을 주기적으로 가져옴 | 매일 생성되는 매출 파일 |
| **S3 버킷** | AWS S3 또는 MinIO 호환 스토리지 | 클라우드 데이터 레이크 |

### 1.3 핵심 특징

```
┌─────────────────────────────────────────────────┐
│  ① 수동 실행: 파일 업로드 → 즉시 적재            │
│  ② 수동 실행: DB 연결 → SELECT → 적재            │
│  ③ 자동 배치: SFTP/S3 폴더 감시 → 주기적 적재    │
│  ④ 자동 배치: DB 증분 동기화 → 주기적 적재        │
│                                                   │
│  + 변환 룰 적용 (마스킹, 타입변환, 문자열 가공)    │
│  + 증분 적재 (PK 기반 Upsert, 시간 기반 증분)     │
│  + 파일 단위 롤백                                 │
│  + 연속 실패 시 자동 비활성화                      │
└─────────────────────────────────────────────────┘
```

---

## 2. 전체 아키텍처

### 2.1 레이어 구조

```
┌──────────────────────────────────────────────────────────┐
│                    프론트엔드 (Vue.js 등)                  │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼───────────────────────────────────┐
│              API 라우터 계층 (FastAPI)                     │
│  ┌─────────────────┐  ┌───────────────────┐              │
│  │  router.py      │  │  router_file.py   │              │
│  │  /api/etl2/*    │  │  /api/etl2/batch/*│              │
│  └────────┬────────┘  └────────┬──────────┘              │
└───────────┼─────────────────────┼────────────────────────┘
            │                     │
┌───────────▼─────────────────────▼────────────────────────┐
│              서비스 계층 (비즈니스 로직)                     │
│                                                          │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │  service.py  │ │ service_file.py│ │transform_rules │  │
│  │  ETL 메타    │ │ 배치 메타        │ │ _service.py    │  │
│  │  CRUD        │ │ CRUD           │ │ 변환 룰 CRUD    │  │
│  └──────┬───────┘ └───────┬────────┘ └────────────────┘  │
│         │                 │                              │
│  ┌──────▼───────┐ ┌───────▼────────┐ ┌────────────────┐  │
│  │load_service  │ │batch_executor  │ │transform_engine│  │
│  │db_load_svc   │ │  _file.py      │ │  .py           │  │
│  │(실행 엔진)    │ │batch_executor  │ │ (변환 엔진)      │  │
│  │              │ │  _db.py        │ │                │  │
│  └──────┬───────┘ └───────┬────────┘ └────────────────┘  │
│         │                 │                              │
│  ┌──────▼─────────────────▼────────────────────────────┐ │
│  │          load_service_file.py                       │ │
│  │        (공통 적재: CREATE TABLE / INSERT / UPSERT)   │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│              인프라 계층                                   │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ PostgreSQL   │ │ SFTP/S3      │ │ APScheduler      │  │
│  │ (시스템DB     │ │ (원격 폴더)   │ │ (주기 실행)        │  │
│  │  + 타겟DB)    │ │              │ │                  │  │
│  └──────────────┘ └──────────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 DB 구조 (시스템 테이블)

```
etl_connections          ← 소스 DB 연결 정보 (PG/MySQL/Oracle)
etl_storage_connections  ← 타겟(적재) DB 연결 정보
etl_tables               ← ETL 정의 (소스↔타겟 매핑, 동기화 모드 등)
etl_jobs                 ← 실행 이력/큐 (pending → running → completed/failed)
etl_transform_rules      ← 변환 룰 정의

batch_folder_connections ← SFTP/S3 폴더 연결
batch_folder_sftp        ← SFTP 상세 (host, port, key 등)
batch_folder_s3          ← S3 상세 (bucket, prefix 등)
batch_jobs               ← 배치 Job 정의 (주기, 패턴, 타겟 등)
batch_run_history        ← 배치 실행 이력
batch_loaded_keys        ← 파일별 적재 PK 기록 (롤백용)
etl_batch_target_registry ← 배치 타겟 테이블 등록 목록
```

---

## 3. 실행 경로별 흐름도

### 3.1 파일 업로드 → 적재

```
사용자 브라우저
    │
    │ POST /api/etl2/upload (파일 + target_table)
    ▼
router.py :: upload_file()
    │
    ├─ _save_upload()           → uploads/ 디렉토리에 파일 저장
    ├─ schema_infer.infer_schema()  → 컬럼명·타입 추론
    ├─ service.get_or_create_file_connection()  → file 타입 연결 확보
    └─ service.create_etl_table()   → etl_tables에 메타 INSERT
    │
    │ POST /api/etl2/tables/{id}/run
    ▼
router.py :: run_table_load()
    │
    ├─ service.insert_job(status="running")
    └─ threading.Thread → _run_file_load_in_process()
                              │
                              ▼
                    load_service.run_file_load()
                              │
                    ┌─────────┴──────────┐
                    │                    │
                 파일 읽기              변환 적용
             _read_file()          transform_engine
             csv_reader              .apply_rules()
           .read_csv_robust()      .apply_mapping
                    │               _type_cast()
                    │                    │
                    └─────────┬──────────┘
                              │
                         타겟 DB에 적재
                    ┌─────────┴──────────┐
                    │ 테이블 없음:          │ 테이블 있음:
                    │ CREATE TABLE       │ 컬럼 매칭
                    │ + INSERT           │ + UPSERT
                    └─────────┬──────────┘
                              │
                    service.update_job("completed")
```

### 3.2 DB 소스 → 적재

```
POST /api/etl2/tables/{id}/run
    │
    ▼
router.py :: run_table_load()
    │
    ├─ service.insert_job(status="pending")
    └─ queue_worker.start_background_worker()
              │
              ▼
    queue_worker :: _worker_loop()
              │
    claim_next_pending_job()  ← SELECT FOR UPDATE SKIP LOCKED
              │
              ▼
    _run_one_job(job_id, etl_table_id)
              │
              ▼
    db_load_service.run_db_load()
              │
    ┌─────────┴──────────────────────┐
    │  소스 DB 연결                    │
    │ (PG: psycopg2                  │
    │  MySQL: PyMySQL + SSCursor     │
    │  Oracle: oracledb)             │
    └─────────┬──────────────────────┘
              │
    SELECT * FROM source_table
    [WHERE incremental_col > last_synced_at]
              │
    ┌─────────┴──────────────────────┐
    │ batch_size 단위 fetchmany       │
    │ → DataFrame 변환                │
    │ → transform_engine.apply_rules │
    │ → apply_mapping_type_cast      │
    │ → COPY + INSERT ON CONFLICT    │
    │ → commit                       │
    │ → sleep(batch_interval_sec)    │
    │ → 다음 배치 반복                   │
    └─────────┬──────────────────────┘
              │
    update_last_synced_at()
    update_job("completed")
```

### 3.3 SFTP/S3 배치 자동 실행

```
서버 시작
    │
    ▼
scheduler_file.start_scheduler()
    │
    ├─ APScheduler (BackgroundScheduler) 기동
    └─ load_active_batch_jobs()  → DB에서 is_active=True 잡 로드
              │
              ▼ (interval_minutes 마다 반복)
    batch_executor_file.run_batch_job(batch_job_id)
              │
    ┌─────────┴──────────────────────────┐
    │ 1. get_batch_job() → Job 조회       │
    │ 2. get_folder_adapter() → SFTP/S3  │
    │ 3. adapter.list_files()            │
    │ 4. get_pending_files()             │
    │    (패턴 매칭 + ts > last_processed) │
    │ 5. 대기 파일 없으면 → return (기록X)     │
    └─────────┬──────────────────────────┘
              │ (대기 파일 있음)
    ┌─────────┴──────────────────────────┐
    │ create_batch_run()                 │
    │                                    │
    │ for filename in pending:           │
    │   ├─ _wait_for_stable_size()       │
    │   ├─ adapter.download_file() → tmp │
    │   ├─ 크기 검사 (max_file_mb)          │
    │   ├─ SHA-256 체크섬 계산              │
    │   ├─ is_duplicate_checksum() 중복?  │
    │   ├─ read_file() → DataFrame       │
    │   ├─ load_dataframe() → DB 적재     │
    │   ├─ commit                        │
    │   └─ update_last_processed_ts()    │
    │                                    │
    │ finish_run("success")              │
    │ update_job_status("success")       │
    └────────────────────────────────────┘
              │
              │ (연속 5회 실패 시)
              ▼
    check_consecutive_failures()
    → is_active = FALSE + 스케줄러 제거
```

### 3.4 DB 배치 자동 실행

```
scheduler → batch_executor_db.run_db_batch_job(batch_job_id)
    │
    ├─ get_batch_job() → etl_table_id 있으면 etl_tables에서 설정 조회
    ├─ create_batch_run()
    ├─ 소스 DB 연결 (PG/MySQL/Oracle)
    ├─ pk_columns 없으면 _fetch_source_pk()로 자동 감지
    ├─ SELECT (증분: WHERE col >= last_synced_at)
    │
    │  ┌── fetchmany(batch_size) 루프 ──┐
    │  │ DataFrame 변환                 │
    │  │ 헤더 유사 행 제거                 │
    │  │ transform_rules 적용           │
    │  │ apply_mapping_type_cast       │
    │  │ load_dataframe() → UPSERT     │
    │  │ commit                        │
    │  │ sleep(batch_interval_seconds) │
    │  └───────────────────────────────┘
    │
    ├─ update_last_synced_at_db_batch()
    ├─ etl_tables.last_synced_at도 동기화
    └─ finish_run("success")
```

---

## 4. 코드 파일별 함수 사전

### 4.1 `service.py` — ETL 메타 CRUD·시스템 DB

**시스템의 "두뇌" 역할. 모든 메타데이터 관리.**

| 함수명 | 설명 |
|--------|------|
| `_get_db()` | api_server.db 지연 로드 (순환 import 방지) |
| `_schema()` | 시스템 테이블 스키마명 반환 |
| `_q(schema, table)` | `"schema"."table"` 형태 SQL 식별자 생성 |
| `_sys_cursor()` | 시스템 DB 커서 context manager |
| `_validate_identifier(value, name)` | 테이블/컬럼명 검증 (영문·숫자·_ 만) |
| `_validate_source_table(value)` | source_table 검증 (점 유사문자 정규화 포함) |
| `_normalize_source_table_dots(value)` | 전각 점 등 유니코드 점 → ASCII 점 통일 |
| `parse_source_table_parts(source_table, stype, ...)` | `schema.table` → `(schema, table)` 분리 |
| `_connection_error_to_user_message(ex, port)` | DB 연결 실패 → 한글 안내 메시지 |
| `_connect_postgres(host, port, db, user, pw)` | PostgreSQL 연결 (psycopg2, RealDictCursor) |
| `_connect_mysql(host, port, db, user, pw)` | MySQL 연결 (PyMySQL, timeout 설정) |
| `_connect_oracle(host, port, db, user, pw)` | Oracle 연결 (oracledb, DSN 방식) |
| `_fetch_pk_from_mysql(conn, schema, table)` | MySQL PK 컬럼 목록 조회 |
| `_fetch_pk_from_oracle(conn, owner, table)` | Oracle PK 컬럼 목록 조회 |
| `get_target_db_connection(storage_conn_id)` | 적재 대상 DB 연결 (None이면 기본 DB) |
| **연결 관리** | |
| `create_connection(...)` | 소스 DB 연결 등록 |
| `list_connections()` | 연결 목록 (비밀번호 제외) |
| `get_connection_for_etl(conn_id)` | 연결 상세 (비밀번호 포함, 내부용) |
| `test_connection(...)` | 연결 테스트 (SELECT 1) |
| `list_source_tables(conn_id)` | 소스 DB 테이블 목록 |
| `delete_connection(conn_id)` | 연결 + 관련 ETL + 타겟 테이블 일괄 삭제 |
| `get_or_create_file_connection(created_by)` | 파일 업로드용 연결 확보 |
| **저장 DB 관리** | |
| `list_storage_connections()` | 저장 DB 연결 목록 |
| `get_storage_connection(id)` | 저장 DB 연결 상세 |
| `create_storage_connection(...)` | 저장 DB 등록 |
| `update_storage_connection(...)` | 저장 DB 수정 |
| `delete_storage_connection(id)` | 저장 DB 삭제 |
| `test_storage_connection(...)` | 저장 DB 권한 테스트 (CREATE+INSERT+DROP) |
| `list_target_tables(storage_conn_id)` | 타겟 DB 테이블 목록 |
| `list_target_columns(storage_conn_id, table)` | 타겟 테이블 컬럼 목록 |
| `target_table_exists(storage_conn_id, table)` | 타겟 테이블 존재 여부 |
| `get_target_table_column_names(...)` | 타겟 컬럼명 리스트 |
| `get_target_pk_columns(...)` | 타겟 PK 컬럼 목록 |
| **ETL 테이블 관리** | |
| `list_etl_tables()` | ETL 정의 목록 (연결명, 소스타입 JOIN) |
| `create_etl_table(...)` | ETL 정의 등록 (PK 자동 감지 포함) |
| `get_etl_table(id)` | ETL 정의 1건 조회 |
| `get_sync_mode_for_load(id)` | 동기화 모드 조회 (full/incremental) |
| `update_etl_table(...)` | ETL 설정 부분 수정 |
| `delete_etl_table(id)` | ETL + 타겟 테이블 DROP + 파일 삭제 |
| `delete_etl_table_row_only(id)` | ETL 행만 삭제 (테이블 유지) |
| `update_last_synced_at(id, synced_at)` | 증분 동기화 시점 갱신 |
| **Job 관리** | |
| `insert_job(etl_table_id, status, ...)` | Job 등록 |
| `set_job_running(job_id)` | 상태 → running |
| `set_job_total_rows(job_id, total)` | 전체 행 수 설정 (진행률 계산용) |
| `update_job_progress(job_id, rows)` | 진행 중 행 수 갱신 |
| `get_job(job_id)` | Job 상세 조회 |
| `list_jobs(etl_table_id, limit, statuses)` | Job 목록 |
| `delete_job(job_id)` | Job 삭제 (파일도 삭제) |
| `fetch_pending_jobs(limit)` | pending 상태 Job 조회 |
| `claim_next_pending_job()` | pending → running 선점 (SKIP LOCKED) |
| `count_running_jobs()` | 실행 중 Job 수 |
| `is_job_cancelled(job_id)` | 취소 여부 확인 |
| `update_job(job_id, status, ...)` | Job 완료/실패 처리 |
| `update_etl_table_status(id, status)` | ETL 상태 갱신 |

### 4.2 `service_file.py` — 배치 폴더·Job·이력 CRUD

**배치 자동화의 메타데이터 관리.**

| 함수명 | 설명 |
|--------|------|
| **폴더 연결** | |
| `list_folder_connections()` | SFTP/S3 연결 목록 |
| `get_folder_connection(id)` | 폴더 연결 상세 (비밀번호 포함) |
| `create_folder_connection(...)` | 폴더 연결 등록 |
| `update_folder_connection(...)` | 폴더 연결 수정 |
| `delete_folder_connection(id)` | 폴더 연결 삭제 (CASCADE) |
| `set_folder_connection_verified(id, bool)` | 테스트 성공 여부 마킹 |
| `get_folder_adapter(id)` | FolderAdapter 인스턴스 생성 (SFTP/S3) |
| **배치 Job** | |
| `list_batch_jobs(folder_id, is_active, job_type)` | 배치 Job 목록 |
| `get_batch_job(id)` | 배치 Job 상세 |
| `create_batch_job(...)` | 배치 Job 등록 (중복 검사 포함) |
| `update_batch_job(id, **kwargs)` | 배치 Job 수정 |
| `delete_batch_job(id)` | 배치 Job 삭제 (자식 테이블 포함) |
| `update_last_synced_at_db_batch(id, ts)` | DB 배치 동기화 시점 갱신 |
| **레지스트리** | |
| `list_batch_target_registry()` | ETL 목록용 배치 타겟 등록 목록 |
| `upsert_batch_target_registry(table, sid, jid)` | 레지스트리 등록/갱신 |
| `clear_batch_job_from_registry(jid)` | Job 삭제 시 레지스트리 NULL 처리 |
| `delete_batch_target_registry_and_drop_table(rid)` | 레지스트리 + 테이블 DROP |
| **실행 이력** | |
| `create_batch_run(job_id, conn)` | 실행 이력 시작 |
| `finish_run(run_id, status, ...)` | 실행 이력 완료 |
| `update_run_progress(run_id, ...)` | 진행 상황 갱신 |
| `update_job_status(job_id, status, ...)` | Job 최종 상태 갱신 |
| `update_last_processed_ts(job_id, ts)` | 마지막 처리 타임스탬프 갱신 |
| `is_duplicate_checksum(job_id, checksum)` | SHA-256 중복 파일 검사 |
| `check_consecutive_failures(job_id, threshold)` | 연속 실패 시 자동 비활성화 |
| `set_run_cancel_requested(run_id)` | 실행 취소 플래그 |
| `is_run_cancel_requested(run_id)` | 취소 요청 여부 확인 |
| `list_run_history(job_id, limit)` | 실행 이력 목록 |
| `get_run_detail(run_id)` | 실행 이력 상세 |
| `list_skipped_files(job_id)` | 스킵/에러 파일 목록 |
| `delete_remote_files(folder_id, filenames)` | 원격 파일 삭제 |
| `rollback_file_from_target(...)` | 파일 단위 롤백 (PK 기반 DELETE) |

### 4.3 `transform_engine.py` — 변환 룰 적용 엔진

**DataFrame에 변환 룰을 순차 적용하는 핵심 엔진.**

| 함수명 | 설명 |
|--------|------|
| `apply_rules(df, rules)` | 룰 목록을 apply_order 순으로 적용 (메인 디스패치) |
| `apply_mapping_type_cast(df, mapping, ...)` | column_mapping 기반 타입 캐스트 |
| **컬럼 변환 (1열 단위)** | |
| `_apply_cleansing(series, config)` | TRIM, empty→null, fill_forward/backward, unicode 정규화 |
| `_apply_type_cast(series, config)` | 타입 변환 (integer, numeric, date, boolean, text) |
| `_apply_type_cast_with_mask(series, config)` | 타입 변환 + 실패 행 마스크 반환 |
| `_apply_string_transform(series, config, df)` | uppercase, lowercase, pad, substring, replace, concat |
| `_apply_code_map(series, config)` | 값 매핑 (예: "M"→"남", "F"→"여") |
| `_apply_derived(series, config, df)` | 파생 컬럼 (concat, year_minus) |
| `_apply_masking(series, config)` | 마스킹 (이름, 전화번호, 이메일, SHA-256 해시) |
| `_apply_datetime_transform(series, config, df)` | 날짜 포맷 변환, extract(year/month), date_diff, age |
| `_apply_mapping(series, config, df)` | value_map, range_map, conditional (CASE WHEN) |
| `_apply_numeric_transform(series, config, df)` | round, arithmetic, bucket, clamp |
| **행 변환 (전체 DataFrame)** | |
| `_apply_row_transform(df, config)` | filter (행 필터), deduplicate (중복 제거) |

### 4.4 `transform_rules_service.py` — 변환 룰 CRUD

| 함수명 | 설명 |
|--------|------|
| `list_transform_rules(etl_table_id)` | ETL별 변환 룰 목록 (apply_order 순) |
| `create_transform_rule(...)` | 룰 1건 등록 |
| `get_transform_rule(rule_id)` | 룰 1건 조회 |
| `update_transform_rule(rule_id, ...)` | 룰 수정 |
| `delete_transform_rule(rule_id)` | 룰 삭제 |

### 4.5 `load_service.py` — 파일 기반 적재 엔진

| 함수명 | 설명 |
|--------|------|
| `run_file_load(etl_table_id, job_id)` | 파일 → 파싱 → DROP/CREATE → INSERT 전체 흐름 |
| `run_file_upsert(etl_table_id, job_id)` | 추가 파일 → 기존 테이블에 PK 기반 UPSERT |
| `_read_file(path, type, max_rows)` | CSV/Excel/Parquet 읽기 |
| `_pg_type(inferred_type)` | 추론 타입 → PG 타입 매핑 |
| `_resolve_upload_path(file_path)` | 경로 불일치 시 uploads/ 폴백 해석 |

### 4.6 `db_load_service.py` — DB 소스 적재 엔진

| 함수명 | 설명 |
|--------|------|
| `run_db_load(etl_table_id, job_id)` | DB SELECT → 변환 → CREATE/UPSERT 전체 흐름 |
| `get_source_columns(conn_id, table)` | 소스 테이블 컬럼 목록 |
| `get_source_indexes(conn_id, table)` | 소스 테이블 인덱스/PK 목록 |
| `validate_incremental_column(conn_id, table, col)` | 증분 컬럼 날짜 여부 검증 |
| `_copy_insert_batch(cur, name, cols, rows)` | COPY로 벌크 INSERT (Full 모드) |
| `_copy_upsert_batch(cur, name, cols, types, pk, rows)` | TEMP → INSERT SELECT ON CONFLICT (증분) |
| `_copy_upsert_batch_safe(...)` | COPY 실패 시 행 단위 fallback |
| `_row_fallback(...)` | 행 단위 INSERT ON CONFLICT (에러 50건 연속 시 조기 중단) |
| `_ensure_unique_constraint(...)` | UNIQUE 제약 자동 추가 |
| `_create_indexes_on_target(...)` | 인덱스 생성 (PK 제외) |
| `_serialize_value(v)` | COPY TEXT 포맷 직렬화 (\\N, 이스케이프) |

### 4.7 `load_service_file.py` — 배치용 공통 적재

| 함수명 | 설명 |
|--------|------|
| `get_target_connection(storage_conn_id)` | 타겟 DB 연결 획득 |
| `table_exists(conn, schema, table)` | 테이블 존재 여부 |
| `create_table_from_dataframe(conn, schema, table, df, pk)` | DataFrame 기반 CREATE TABLE |
| `load_dataframe(conn, schema, table, df, pk, mapping, ...)` | 테이블 없으면 CREATE, 있으면 매칭 후 INSERT/UPSERT |
| `_batch_insert(conn, name, cols, df)` | 배치 INSERT |
| `_batch_upsert(conn, name, cols, pk, df)` | INSERT ON CONFLICT DO NOTHING + UPDATE FROM VALUES |
| `_record_loaded_keys(sys_conn, job_id, run_id, file, df, pk)` | 파일별 PK 기록 (롤백용) |
| `_get_table_column_types(conn, schema, table)` | 컬럼별 PG 타입 캐스트 맵 |

### 4.8 `batch_executor_file.py` — SFTP/S3 배치 실행기

| 함수명 | 설명 |
|--------|------|
| `run_batch_job(batch_job_id)` | 파일 배치 1건 전체 실행 |
| `_compute_sha256(path)` | 파일 SHA-256 해시 계산 |
| `_connect_with_retry(folder_id, retries)` | 폴더 연결 재시도 (exponential backoff) |
| `_wait_for_stable_size(adapter, filename)` | SFTP 파일 크기 안정화 대기 |

### 4.9 `batch_executor_db.py` — DB 배치 실행기

| 함수명 | 설명 |
|--------|------|
| `run_db_batch_job(batch_job_id)` | DB 배치 1건 전체 실행 |
| `_fetch_source_pk(conn, stype, schema, table)` | 소스 PK 자동 감지 (PG/MySQL/Oracle) |

### 4.10 `folder_adapter_file.py` — 원격 폴더 어댑터

| 클래스/함수 | 설명 |
|------------|------|
| `FolderAdapter` (ABC) | 추상 인터페이스: test, list, download, delete, close |
| `SFTPAdapter` | paramiko 기반 SFTP 구현 |
| `S3Adapter` | boto3 기반 S3 구현 |

### 4.11 `parser_file.py` — 파일명 파싱

| 함수명 | 설명 |
|--------|------|
| `parse_filename(filename, pattern, extensions)` | `{pattern}_ib_20240301120000.csv` 파싱 |
| `get_pending_files(all_files, pattern, exts, last_ts)` | 대기 파일 목록 (ts 오름차순) |
| `extract_patterns_from_files(file_list, exts)` | 접두사별 그룹화 (패턴 자동 탐지) |
| `read_file(local_path, ext, max_rows)` | 로컬 파일 → DataFrame |

### 4.12 `csv_reader.py` — CSV 인코딩 자동 감지

| 함수명 | 설명 |
|--------|------|
| `read_csv_robust(path, nrows)` | 인코딩 감지(chardet) → UTF-8/CP949 순차 시도 → EOF 제거 폴백 |

### 4.13 `schema_infer.py` — 스키마 추론

| 함수명 | 설명 |
|--------|------|
| `infer_schema(path, type, max_rows)` | 파일 → `[{name, inferred_type}]` |
| `_dtype_to_inferred(dtype)` | pandas dtype → UI용 타입명 |

### 4.14 `preview_service.py` — 미리보기

| 함수명 | 설명 |
|--------|------|
| `get_preview(etl_table_id)` | 소스 타입 분기 → 10행 미리보기 + 컬럼 저장 가능성 |
| `get_source_dataframe(etl_table_id)` | 변환 미리보기용 소스 DataFrame 반환 |
| `get_transform_preview(etl_table_id, rules)` | 변환 룰 적용 미리보기 |

### 4.15 `queue_worker.py` — Job 큐 워커

| 함수명 | 설명 |
|--------|------|
| `start_background_worker()` | 데몬 스레드 + ThreadPoolExecutor 기동 |
| `stop_background_worker()` | 스레드 풀 shutdown |
| `run_worker_iteration()` | pending Job 선점 → 스레드 풀 제출 |
| `_run_one_job(job_id, etl_table_id)` | 파일/DB 분기 후 실행 |

### 4.16 `scheduler_file.py` — APScheduler 배치 스케줄러

| 함수명 | 설명 |
|--------|------|
| `get_scheduler()` | BackgroundScheduler lazy 초기화 |
| `start_scheduler()` | 스케줄러 시작 (SCHEDULER_ENABLED 환경변수) |
| `load_active_batch_jobs()` | 활성 배치 Job 일괄 등록 |
| `add_job(job)` | 스케줄러에 배치 등록 |
| `remove_job(batch_job_id)` | 스케줄러에서 제거 |
| `reschedule_job(batch_job_id, interval)` | 주기 변경 |
| `run_now(batch_job_id)` | 즉시 1회 실행 |

### 4.17 `etl_limits.py` — 한도 설정

| 함수명 | 설명 |
|--------|------|
| `get_etl_limits()` | `(max_file_size_mb, max_rows_per_load, max_batch_size)` 반환 |

### 4.18 `transform_upsert_verification.py` — 변환→적재 호환 검증

| 함수명 | 설명 |
|--------|------|
| `get_expected_pg_cast_for_series(series)` | pandas dtype → PG 캐스트명 |
| `verify_transform_output_columns(df, target_cols)` | DataFrame 호환성 검증 |
| `run_dry_run_pipeline(sample_df, rules, mapping)` | 드라이런 (DB 접근 없음) |

### 4.19 `router.py` — 메인 API 라우터

| 엔드포인트 | 함수 | 설명 |
|-----------|------|------|
| `GET /api/etl2/` | `etl_index` | 서비스 안내 |
| `GET /tables` | `list_tables` | ETL 목록 |
| `POST /tables` | `create_table` | ETL 등록 |
| `PATCH /tables/{id}` | `update_table` | ETL 수정 |
| `DELETE /tables/{id}` | `delete_table` | ETL + 테이블 삭제 |
| `DELETE /tables/{id}/row` | `delete_table_row_only` | ETL 행만 삭제 |
| `POST /upload` | `upload_file` | 파일 업로드 + 스키마 추론 |
| `POST /infer-schema` | `infer_schema_from_file` | 스키마만 추론 (파일 미보관) |
| `POST /tables/{id}/add-file` | `add_file_to_table` | 단일 파일 추가 적재 |
| `POST /tables/{id}/add-files-zip` | `add_files_zip_to_table` | ZIP 일괄 추가 적재 |
| `POST /tables/{id}/run` | `run_table_load` | ETL 실행 |
| `GET /tables/{id}/preview` | `preview_table` | 미리보기 10행 |
| `GET /tables/{id}/target-exists` | `check_target_table_exists` | 타겟 테이블 존재 확인 |
| `GET/POST /connections` | 연결 CRUD | DB 연결 관리 |
| `POST /connections/test` | `test_connection` | 연결 테스트 |
| `GET /connections/{id}/tables` | `list_connection_tables` | 소스 테이블 목록 |
| `GET /connections/{id}/source-columns` | `list_source_columns` | 소스 컬럼 목록 |
| `GET /connections/{id}/source-indexes` | `list_source_indexes` | 소스 인덱스/PK |
| `GET/POST /storage-connections` | 저장 DB CRUD | |
| `GET /target-tables` | `list_target_tables` | 타겟 DB 테이블 목록 |
| `GET/POST/PUT/DELETE /transform-rules` | 변환 룰 CRUD | |
| `GET /jobs` | `list_jobs` | Job 목록 |
| `GET /jobs/{id}` | `get_job` | Job 상세 (폴링용) |
| `POST /jobs/{id}/cancel` | `cancel_job` | Job 취소 |
| `POST /transform/preview` | `transform_preview` | 변환 미리보기 |

### 4.20 `router_file.py` — 배치 API 라우터

| 엔드포인트 | 함수 | 설명 |
|-----------|------|------|
| `GET/POST/PATCH/DELETE /batch/folder-connections` | 폴더 연결 CRUD | |
| `POST /batch/folder-connections/test` | 연결 테스트 | |
| `GET /batch/folder-connections/{id}/files` | 파일 목록 | |
| `GET /batch/folder-connections/{id}/patterns` | 패턴 자동 탐지 | |
| `GET /batch/folder-connections/{id}/columns` | 샘플 파일 컬럼 | |
| `GET/POST/PATCH/DELETE /batch/jobs` | 배치 Job CRUD | |
| `POST /batch/jobs/from-etl-table` | ETL 테이블 기반 배치 등록 | |
| `POST /batch/jobs/{id}/run-now` | 즉시 실행 | |
| `POST /batch/jobs/{id}/toggle` | 활성/비활성 토글 | |
| `GET /batch/jobs/{id}/history` | 실행 이력 | |
| `GET /batch/jobs/{id}/skipped-files` | 스킵 파일 목록 | |
| `POST /batch/jobs/{id}/reset-ts` | 타임스탬프 리셋 | |
| `POST /batch/jobs/{id}/clone` | 배치 복제 | |
| `POST /batch/jobs/{id}/rollback-file` | 파일 단위 롤백 | |

---

## 5. 기능별 함수 그룹 & 흐름

### 5.1 기능 A: DB 연결 등록 ~ 소스 테이블 선택

> **페이지**: "연결 관리" 탭

```
[사용자 액션]  DB 연결 정보 입력 → "테스트" 클릭 → "등록" 클릭 → 소스 테이블 선택

[관련 함수 그룹]
┌──────────────────────────────────────────────────────────────────┐
│  router.py                                                       │
│    test_connection()  ← POST /connections/test                   │
│    create_connection() ← POST /connections                       │
│    list_connection_tables() ← GET /connections/{id}/tables       │
│    list_source_columns()  ← GET /connections/{id}/source-columns │
│    list_source_indexes()  ← GET /connections/{id}/source-indexes │
│                                                                  │
│  service.py                                                      │
│    test_connection()     → _connect_postgres/mysql/oracle        │
│    create_connection()   → INSERT INTO etl_connections           │
│    list_source_tables()  → information_schema.tables 조회         │
│    _connection_error_to_user_message()  → 한글 에러 안내             │
│                                                                  │
│  db_load_service.py                                              │
│    get_source_columns()  → 컬럼 목록 (증분컬럼 선택 UI용)               │
│    get_source_indexes()  → PK/인덱스 목록                           │
│    validate_incremental_column() → 증분컬럼 날짜 검증                 │
└──────────────────────────────────────────────────────────────────┘
```

**흐름 상세**:
```
1. 사용자가 host, port, database, user, password 입력
2. "테스트" → test_connection() → _connect_postgres() → SELECT 1 실행
3. 성공하면 "등록" → create_connection() → etl_connections INSERT
4. 소스 테이블 드롭다운 → list_source_tables() → information_schema 조회
5. 테이블 선택하면 → get_source_columns() → 컬럼 목록 표시
6. PK 자동 감지 → get_source_indexes() → is_primary=True인 것 표시
7. 증분 컬럼 선택 시 → validate_incremental_column() → 날짜 타입 확인
```

### 5.2 기능 B: 파일 업로드 → ETL 등록 → 적재 실행

> **페이지**: "파일 업로드" 탭

```
[사용자 액션]  파일 업로드 → 타겟 테이블명 입력 → 컬럼 매핑 → "실행"

[관련 함수 그룹]
┌───────────────────────────────────────────────────────────┐
│  router.py                                                │
│    upload_file()       ← POST /upload                     │
│    run_table_load()    ← POST /tables/{id}/run            │
│    preview_table()     ← GET /tables/{id}/preview         │
│                                                           │
│  schema_infer.py                                          │
│    infer_schema()      → 파일 읽어 컬럼명·타입 추론              │
│                                                           │
│  service.py                                               │
│    get_or_create_file_connection() → file 타입 연결 확보      │
│    create_etl_table()  → etl_tables INSERT                │
│    insert_job()        → etl_jobs INSERT                  │
│                                                           │
│  load_service.py                                          │
│    run_file_load()     → 파일 → 파싱 → CREATE → INSERT      │
│    _read_file()        → CSV/Excel/Parquet 읽기            │
│                                                           │
│  csv_reader.py                                            │
│    read_csv_robust()   → 인코딩 자동 감지                     │
│                                                           │
│  transform_engine.py                                      │
│    apply_rules()       → 변환 룰 적용                        │
│    apply_mapping_type_cast() → 컬럼 타입 변환                 │
│                                                           │
│  preview_service.py                                       │
│    get_preview()       → 10행 미리보기                       │
│    _preview_file()     → 파일 소스 미리보기                    │
└───────────────────────────────────────────────────────────┘
```

**흐름 상세**:
```
1. 파일 드래그 앤 드롭
2. upload_file() → _save_upload() → uploads/ 저장
3. infer_schema() → [{name: "고객코드", type: "text"}, ...]
4. 사용자가 target_table, column_mapping, pk_columns 설정
5. create_etl_table() → etl_tables에 메타 저장
6. "미리보기" → get_preview() → _preview_file() → 10행 표시
7. "실행" → run_table_load() → insert_job(running)
8. threading.Thread → run_file_load()
   8a. _read_file() → csv_reader.read_csv_robust() (인코딩 자동감지)
   8b. 컬럼명 정규화 (특수문자 → 언더스코어)
   8c. transform_engine.apply_rules() → 변환 룰 적용
   8d. apply_mapping_type_cast() → 타입 변환
   8e. CREATE TABLE (pk_columns 있으면 PRIMARY KEY 추가)
   8f. 2000건씩 배치 INSERT
   8g. update_job("completed", rows_processed=N)
```

### 5.3 기능 C: DB 소스 ETL 등록 → 적재 실행

> **페이지**: "DB 연동" 탭

```
[사용자 액션]  연결 선택 → 소스 테이블 선택 → PK/증분컬럼 설정 → "실행"

[관련 함수 그룹]
┌──────────────────────────────────────────────────────────┐
│  router.py                                               │
│    create_table()      ← POST /tables                    │
│    run_table_load()    ← POST /tables/{id}/run           │
│                                                          │
│  service.py                                              │
│    create_etl_table()  → PK 자동 감지 포함                   │
│    get_sync_mode_for_load() → full/incremental 결정       │
│    insert_job(status="pending")                          │
│    claim_next_pending_job() → SKIP LOCKED 선점            │
│                                                          │
│  queue_worker.py                                         │
│    start_background_worker() → 데몬 스레드 기동              │
│    _run_one_job() → 파일/DB 분기                           │
│                                                          │
│  db_load_service.py                                      │
│    run_db_load()       → 소스 SELECT → 변환 → 적재           │
│    _copy_insert_batch() → COPY (Full 모드)                │
│    _copy_upsert_batch() → TEMP + ON CONFLICT (증분)       │
│    _ensure_unique_constraint() → UNIQUE 제약 자동 추가       │
│                                                          │
│  transform_engine.py                                     │
│    apply_rules() + apply_mapping_type_cast()             │
└──────────────────────────────────────────────────────────┘
```

**흐름 상세 (incremental 모드)**:
```
1. create_etl_table(sync_mode="incremental", pk_columns="id", incremental_column="updated_at")
   → PK 없으면 소스 DB에서 _fetch_pk_from_mysql/oracle로 자동 감지
2. "실행" → insert_job(status="pending")
3. queue_worker가 claim_next_pending_job()으로 선점
4. run_db_load() 시작
   4a. _connect_mysql() (예: MySQL 소스)
   4b. SELECT * FROM source WHERE updated_at > '2024-03-01 00:00:00'
   4c. fetchmany(10000) → DataFrame
   4d. apply_rules() → 변환
   4e. _copy_upsert_batch():
       - CREATE TEMP TABLE _etl_stg_xxx (전부 TEXT)
       - COPY TO TEMP
       - INSERT INTO target SELECT col::bigint, ... FROM _etl_stg
         ON CONFLICT (id) DO UPDATE SET col1=EXCLUDED.col1, ...
   4f. commit → 다음 배치 반복
5. update_last_synced_at(max(updated_at))
6. update_job("completed")
```

### 5.4 기능 D: SFTP/S3 폴더 연결 → 배치 Job 등록 → 자동 실행

> **페이지**: "배치 설정" 탭

```
[사용자 액션]  폴더 연결 → 테스트 → 패턴 선택 → Job 등록 → 자동 실행

[관련 함수 그룹]
┌────────────────────────────────────────────────────────────────────┐
│  router_file.py                                                    │
│    create_folder_connection() ← POST /batch/folder-connections     │
│    test_folder_connection()   ← POST /batch/folder-connections/test│
│    list_folder_patterns()     ← GET  /{id}/patterns                │
│    create_batch_job()         ← POST /batch/jobs                   │
│    toggle_batch_job()         ← POST /batch/jobs/{id}/toggle       │
│    run_batch_job_now()        ← POST /batch/jobs/{id}/run-now      │
│                                                                    │
│  service_file.py                                                   │
│    create_folder_connection() → INSERT batch_folder_connections    │
│    get_folder_adapter()       → SFTPAdapter/S3Adapter 생성          │
│    create_batch_job()         → INSERT batch_jobs (중복검사)         │
│    create_batch_run()         → INSERT batch_run_history           │
│    finish_run()               → UPDATE status/finished_at          │
│    is_duplicate_checksum()    → JSONB 내 체크섬 검색                   │
│    check_consecutive_failures() → 5회 연속 실패 → 비활성화               │
│                                                                    │
│  folder_adapter_file.py                                            │
│    SFTPAdapter → paramiko 기반                                      │
│      test_connection() → listdir() 가능 여부                         │
│      list_files() → listdir_attr() → 파일만 필터                      │
│      download_file() → sftp.get()                                  │
│    S3Adapter → boto3 기반                                           │
│      list_files() → paginate list_objects_v2                       │
│      download_file() → s3.download_file()                          │
│                                                                    │
│  parser_file.py                                                    │
│    extract_patterns_from_files() → 패턴 자동 탐지                      │
│    parse_filename() → {pattern}_ib_yyyyMMddHHmmss.ext              │
│    get_pending_files() → ts > last_processed 필터                   │
│    read_file() → DataFrame                                         │
│                                                                    │
│  scheduler_file.py                                                 │
│    add_job() → APScheduler IntervalTrigger 등록                     │
│    remove_job() → 스케줄러에서 제거                                     │
│    run_now() → next_run_time=now 즉시 실행                           │
│                                                                    │
│  batch_executor_file.py                                            │
│    run_batch_job() → 전체 파일 배치 흐름                                │
│    _compute_sha256() → 중복 파일 방지                                  │
│    _wait_for_stable_size() → SFTP 업로드 완료 대기                     │
│                                                                    │
│  load_service_file.py                                              │
│    load_dataframe() → CREATE/INSERT/UPSERT                         │
│    _batch_upsert() → INSERT ON CONFLICT + UPDATE FROM VALUES       │
│    _record_loaded_keys() → 롤백용 PK 기록                             │
└────────────────────────────────────────────────────────────────────┘
```

**흐름 상세**:
```
Phase 1: 폴더 연결
  1. 사용자가 SFTP host/port/user/password 입력
  2. test_folder_connection() → SFTPAdapter 생성 → listdir 시도
  3. 성공 → create_folder_connection() → batch_folder_connections + batch_folder_sftp INSERT

Phase 2: 패턴 탐지
  4. list_folder_patterns() → adapter.list_files()
  5. extract_patterns_from_files() → "sales_data" 패턴 발견 (3개 파일, 최신 20240301)
  6. 사용자가 패턴 선택 → 타겟 테이블명 입력

Phase 3: 배치 Job 등록
  7. create_batch_job(pattern="sales_data", target="t_sales", interval=60)
  8. is_active=True → scheduler_file.add_job() → APScheduler에 60분 간격 등록

Phase 4: 자동 실행 (매 60분)
  9. APScheduler → batch_executor_file.run_batch_job(batch_job_id)
  10. adapter.list_files() → get_pending_files() → 새 파일 2건
  11. 파일별:
      a. download_file() → /tmp/xxx.csv
      b. _compute_sha256() → is_duplicate_checksum() → 중복? → skip
      c. read_file() → DataFrame
      d. load_dataframe() → INSERT/UPSERT
      e. _record_loaded_keys() → batch_loaded_keys에 PK 기록
      f. update_last_processed_ts() → 다음 실행 시 이 파일 건너뜀
  12. finish_run("success")

Phase 5: 문제 파일 처리
  13. list_skipped_files() → 체크섬 중복/크기 초과 파일 표시
  14. delete_remote_files() → 원격에서 삭제

Phase 6: 롤백
  15. rollback_file_from_target() → batch_loaded_keys에서 PK 조회
      → 타겟 테이블 DELETE WHERE pk IN (...) → loaded_keys 삭제
```

### 5.5 기능 E: ETL 테이블 기반 DB 배치 등록

> **페이지**: "배치 설정" 탭 (DB 배치)

```
[사용자 액션]  기존 ETL 선택 → "배치로 전환" → 주기 설정 → 자동 실행

[관련 함수 그룹]
┌──────────────────────────────────────────────────────────┐
│  router_file.py                                          │
│    create_batch_job_from_etl_table()                     │
│                                                          │
│  service_file.py                                         │
│    create_batch_job(etl_table_id=N)                      │
│    update_last_synced_at_db_batch()                      │
│                                                          │
│  batch_executor_db.py                                    │
│    run_db_batch_job()                                    │
│      → get_etl_table() (실행 시 실시간 조회)                  │
│      → 소스/타겟/매핑은 etl_tables에서 참조                     │
│      → _fetch_source_pk() 자동 감지                        │
│                                                          │
│  scheduler_file.py                                       │
│    add_job() → run_func = run_db_batch_job               │
└──────────────────────────────────────────────────────────┘
```

### 5.6 기능 F: 변환 룰 설정 → 미리보기

> **페이지**: "변환 설정" 탭 (ETL 상세)

```
[사용자 액션]  변환 룰 추가 → 미리보기 → 저장

[관련 함수 그룹]
┌───────────────────────────────────────────────────────────────────┐
│  router.py                                                        │
│    list_transform_rules()    ← GET /tables/{id}/transform-rules   │
│    create_transform_rule()   ← POST /transform-rules              │
│    update_transform_rule()   ← PUT /transform-rules/{id}          │
│    transform_preview()       ← POST /transform/preview            │
│                                                                   │
│  transform_rules_service.py                                       │
│    list_transform_rules()    → SELECT ORDER BY apply_order        │
│    create_transform_rule()   → INSERT (rule_category+operation)   │
│                                                                   │
│  preview_service.py                                               │
│    get_transform_preview()   → 소스 10행 + apply_rules              │
│    get_source_dataframe()    → 소스 DataFrame 반환                   │
│                                                                   │
│  transform_engine.py                                              │
│    apply_rules()             → 룰 순차 적용 (디스패치)                  │
│    _COLUMN_TRANSFORMERS      → 카테고리별 함수 매핑                     │
│    _ROW_TRANSFORMERS         → 행 단위 변환 (filter 등)               │
└───────────────────────────────────────────────────────────────────┘
```

**변환 룰 카테고리와 operation 매핑**:
```
cleansing
  ├─ trim (기본)
  ├─ fill_forward
  ├─ fill_backward
  └─ normalize_unicode

type_cast
  ├─ integer, bigint, numeric, boolean
  ├─ date (date_formats 리스트 지원)
  ├─ timestamp
  └─ text

string
  ├─ uppercase, lowercase
  ├─ pad_left, pad_right
  ├─ substring
  ├─ replace, regex_replace
  └─ concat

mapping
  ├─ value_map (코드→이름)
  ├─ range_map (구간→라벨)
  └─ conditional (CASE WHEN 스타일)

masking
  ├─ mask_right, mask_left
  ├─ mask_email, mask_phone, mask_name
  ├─ hash (sha256 등)
  └─ redact

datetime
  ├─ date_format (입출력 포맷 변환)
  ├─ extract (year, month, day, weekday)
  ├─ date_diff, age
  └─ date_add

numeric
  ├─ round
  ├─ arithmetic (+, -, *, /)
  ├─ bucket (구간 분류)
  └─ clamp (min/max 제한)

row (행 단위, 전체 DataFrame 변환)
  ├─ filter (조건 만족 행만)
  └─ deduplicate (중복 제거)
```

---

## 6. 주요 라이브러리 & API 특징

### 6.1 FastAPI

```python
# 이 프로젝트에서의 사용 패턴
from fastapi import APIRouter, File, Form, UploadFile, Query, HTTPException

router = APIRouter(prefix="/api/etl2", tags=["etl2"])

# 라우터 중첩: router_file을 batch/ 접두사로 include
router.include_router(batch_router)  # → /api/etl2/batch/*

# Pydantic 모델로 요청 body 자동 검증
class CreateConnectionBody(BaseModel):
    host: str = Field(..., description="호스트")
    port: int = Field(5432, ge=1, le=65535)

# Form + File 혼합 (multipart/form-data)
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    target_table: Optional[str] = Form(None),
):
```

**핵심 특징**: 타입 힌트 기반 자동 직렬화, OpenAPI 문서 자동 생성, 비동기 지원

### 6.2 psycopg2 (PostgreSQL)

```python
# RealDictCursor: 행을 dict로 반환 (row["column_name"])
from psycopg2.extras import RealDictCursor
conn = psycopg2.connect(..., cursor_factory=RealDictCursor)

# Server-side cursor (대량 데이터 스트리밍)
cur = conn.cursor(name="etl_src_123")  # name을 주면 서버 사이드 커서
cur.execute("SELECT * FROM big_table")
while True:
    batch = cur.fetchmany(10000)  # 10000건씩 fetch
    if not batch: break

# COPY (벌크 적재, INSERT보다 5~10배 빠름)
cur.copy_expert(
    "COPY target (col1, col2) FROM STDIN WITH (FORMAT text, NULL '\\N')",
    buffer  # StringIO 버퍼
)

# SELECT FOR UPDATE SKIP LOCKED (Job 큐 경쟁 방지)
cur.execute("""
    SELECT job_id FROM etl_jobs
    WHERE status = 'pending'
    ORDER BY created_at LIMIT 1
    FOR UPDATE SKIP LOCKED
""")
```

**이 프로젝트에서 특히 중요한 패턴**:
- `COPY FROM STDIN`: `_copy_insert_batch()`에서 Full 모드 벌크 적재
- `TEMP TABLE + INSERT SELECT ON CONFLICT`: `_copy_upsert_batch()`에서 증분 Upsert
- `VALUES + IS DISTINCT FROM`: `_batch_upsert()`에서 실제 변경된 행만 UPDATE (WAL 절감)

### 6.3 PyMySQL

```python
import pymysql
import pymysql.cursors

# SSCursor (Server-Side Cursor): 메모리에 전체 결과를 안 올림
conn = pymysql.connect(
    host=host, port=port, database=db,
    read_timeout=7200,    # 2시간 (net_write_timeout 대응)
    write_timeout=7200,
)
cur = conn.cursor(pymysql.cursors.SSCursor)
cur.execute("SELECT * FROM big_table")
batch = cur.fetchmany(10000)  # 서버에서 10000건씩 스트리밍
```

**주의점**: MySQL SSCursor는 fetchmany 간격이 길면 `net_write_timeout`으로 끊김. 이 프로젝트에서는 `MYSQL_BATCH_SIZE_CAP = 10000`으로 제한.

### 6.4 oracledb (Oracle)

```python
import oracledb

# DSN 형식: host:port/service_name
conn = oracledb.connect(
    user=user, password=pw,
    dsn=f"{host}:{port}/{service_name}",
    tcp_connect_timeout=15
)

cur = conn.cursor()
cur.arraysize = 5000  # fetchmany 기본 크기
cur.execute("SELECT * FROM big_table FETCH FIRST 10000 ROWS ONLY")
```

**Oracle 특이점**: `LIMIT` 대신 `FETCH FIRST N ROWS ONLY`, 바인드 변수 `:1`, 날짜는 초 단위만 저장(마이크로초 절삭).

### 6.5 pandas

```python
import pandas as pd

# 이 프로젝트에서의 핵심 사용 패턴

# 1. DataFrame을 변환 파이프라인의 중심 자료구조로 사용
df = pd.DataFrame(rows_dict, columns=col_names)

# 2. 벡터 연산으로 변환 (행 단위 루프 대신)
df["name"] = df["name"].str.upper()                    # _apply_string_transform
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")  # _apply_type_cast

# 3. NaN/NA → None 변환 (PostgreSQL NULL과 호환)
df = df.replace({pd.NA: None}).where(pd.notnull(df), None)

# 4. to_dict("records") → SQL INSERT용 딕셔너리 리스트
rows = df.to_dict("records")  # [{col1: val1, col2: val2}, ...]

# 5. itertuples → COPY/VALUES용 튜플 리스트
rows_tuples = [tuple(row) for row in df.itertuples(index=False)]

# 6. 컬럼 타입 검사
pd.api.types.is_integer_dtype(dtype)    # True/False
pd.api.types.is_datetime64_any_dtype(dtype)
```

### 6.6 APScheduler

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor

# 이 프로젝트에서의 설정
scheduler = BackgroundScheduler(
    executors={"default": ThreadPoolExecutor(max_workers=3)},
    job_defaults={
        "coalesce": True,       # 밀린 실행은 1번만
        "max_instances": 1,     # 동시 실행 금지
        "misfire_grace_time": 300,  # 5분 이내 지연은 실행
    },
)

# IntervalTrigger로 주기 실행
scheduler.add_job(
    run_batch_job,
    trigger="interval",
    minutes=60,
    id="batch_42",
    args=[42],
    replace_existing=True,
    next_run_time=datetime.now() + timedelta(seconds=10),
)

# 즉시 실행: next_run_time=now
scheduler.add_job(..., next_run_time=datetime.now())

# 주기 변경
from apscheduler.triggers.interval import IntervalTrigger
scheduler.reschedule_job("batch_42", trigger=IntervalTrigger(minutes=30))
```

### 6.7 paramiko (SFTP)

```python
import paramiko

transport = paramiko.Transport((host, port))
transport.connect(username=user, password=pw)
sftp = paramiko.SFTPClient.from_transport(transport)

sftp.listdir_attr("/data")  # 파일 목록 + 메타(크기, 수정일)
sftp.get("/data/file.csv", "/tmp/local.csv")  # 다운로드
sftp.stat("/data/file.csv").st_size  # 파일 크기 확인

# 부분 다운로드 (헤더만)
with sftp.open("/data/file.csv", "rb") as f:
    head = f.read(65536)  # 64KB만
```

### 6.8 boto3 (S3)

```python
import boto3

s3 = boto3.client("s3",
    endpoint_url="https://minio.example.com",  # MinIO 호환
    aws_access_key_id=key,
    aws_secret_access_key=secret,
)

# 페이지네이션으로 1000개 이상 파일도 순회
paginator = s3.get_paginator("list_objects_v2")
for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
    for obj in page.get("Contents", []):
        print(obj["Key"])

# 부분 다운로드 (Range 헤더)
resp = s3.get_object(Bucket=bucket, Key=key, Range="bytes=0-65535")
head = resp["Body"].read()
```

### 6.9 chardet / charset_normalizer (인코딩 감지)

```python
# csv_reader.py에서 사용
# chardet 우선 시도, 없으면 charset_normalizer, 둘 다 없으면 순차 시도

import chardet
raw = open("file.csv", "rb").read(65536)  # 앞부분만 읽어 감지
result = chardet.detect(raw)
# {'encoding': 'EUC-KR', 'confidence': 0.99}

# 순차 시도 순서: utf-8 → utf-8-sig → cp949 → euc-kr → latin-1 → cp1252
```

---

## 7. 핵심 설계 패턴 정리

### 7.1 Upsert 2단계 전략 (load_service_file._batch_upsert)

```sql
-- Step 1: 새 행만 INSERT (기존 행은 무시)
INSERT INTO target (col1, col2, pk)
VALUES (v1, v2, v3), ...
ON CONFLICT (pk) DO NOTHING;
-- rowcount = 실제 삽입된 행 수 (inserted)

-- Step 2: 기존 행 중 값이 바뀐 것만 UPDATE
UPDATE target AS t
SET col1 = v."col1"::bigint, col2 = v."col2"::text
FROM (VALUES (%s, %s, %s), ...) AS v("col1", "col2", "pk")
WHERE t."pk"::text = v."pk"::text
  AND (t."col1"::text IS DISTINCT FROM v."col1"::text
       OR t."col2"::text IS DISTINCT FROM v."col2"::text);
-- rowcount = 실제 변경된 행 수 (updated, WAL 절감)
```

**왜 2단계인가?**: `ON CONFLICT DO UPDATE`는 값이 안 바뀌어도 UPDATE를 실행해 WAL 로그가 쌓임. `IS DISTINCT FROM`으로 실제 변경분만 UPDATE하면 디스크 I/O가 크게 줄어듦.

### 7.2 Job 큐 경쟁 방지 (SELECT FOR UPDATE SKIP LOCKED)

```sql
-- 워커 A, B, C가 동시에 실행해도 같은 Job을 선점하지 않음
SELECT job_id, etl_table_id
FROM etl_jobs
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- 선점 성공한 워커만 running으로 변경
UPDATE etl_jobs SET status = 'running' WHERE job_id = %s;
```

### 7.3 연속 실패 자동 비활성화

```
실행 이력: error → error → error → error → error (5회 연속)
         ↓
check_consecutive_failures(threshold=5)
         ↓
batch_jobs.is_active = FALSE + 스케줄러에서 제거
         ↓
사용자가 문제 해결 후 수동으로 다시 활성화
```

### 7.4 파일 중복 방지 (SHA-256 체크섬)

```
파일 다운로드 → SHA-256 계산 → batch_run_history.file_list JSONB에서 검색
  ├─ 이미 있음 → skip (status: "skipped", reason: "duplicate_checksum")
  └─ 없음 → 정상 적재 → file_list에 checksum 기록
```

### 7.5 SFTP 파일 안정성 확인

```
_wait_for_stable_size(adapter, filename, checks=3, interval=3)
  ├─ stat() → size = 1024
  │  sleep(3초)
  ├─ stat() → size = 2048  (아직 업로드 중)
  │  sleep(3초)
  ├─ stat() → size = 2048  (같음 → 안정)
  └─ 진행
```

---

## 8. 환경 변수 & 설정

| 설정 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `SCHEDULER_ENABLED` | 환경변수 | `true` | `false`면 배치 스케줄러 미기동 (멀티 워커 시 1대만 기동) |
| `config.backend.etl_limits.max_file_size_mb` | Env.config | 50 | 파일 업로드 상한 (MB) |
| `config.backend.etl_limits.max_rows_per_load` | Env.config | 100,000 | 1회 적재 최대 행 수 |
| `config.backend.etl_limits.max_batch_size` | Env.config | 50,000 | DB fetch 배치 상한 |
| `UPLOAD_FILE_RETENTION_DAYS` | router.py | 3 | 업로드 파일 보관 기간 (일) |
| `MAX_CONCURRENT` | queue_worker.py | 3 | 동시 실행 Job 수 |
| `POLL_INTERVAL_SEC` | queue_worker.py | 2 | 워커 폴링 주기 (초) |
| `_CONNECT_TIMEOUT_SEC` | service.py | 15 | DB 연결 타임아웃 (초) |
| `MYSQL_BATCH_SIZE_CAP` | batch_executor_db.py | 10,000 | MySQL SSCursor 배치 상한 |

---

## 9. 트러블슈팅 가이드

### Q: 파일 업로드 후 "파일을 찾을 수 없습니다" 오류
**원인**: 멀티 워커 환경에서 업로드 프로세스와 실행 프로세스가 다름.
**해결**: `_resolve_upload_path()`가 uploads/ 디렉토리에서 파일명 기반으로 폴백 검색. 파일 소스는 `threading.Thread`로 같은 프로세스에서 실행.

### Q: MySQL 배치 중 "Lost connection" 오류
**원인**: `net_write_timeout` 초과 (SSCursor fetchmany 간격 > timeout).
**해결**: `MYSQL_BATCH_SIZE_CAP = 10000`으로 배치 크기 제한, `read_timeout=7200초` 설정.

### Q: Oracle 증분 동기화에서 같은 행이 반복 조회
**원인**: Oracle DATE는 초 단위만 저장. 같은 초에 여러 행이 있으면 `>` 조건으로 잡히지 않음.
**해결**: `last_synced + 1초` 기준으로 `>=` 사용 (batch_executor_db.py 내 Oracle 분기).

### Q: 배치 Job이 자동으로 비활성화됨
**원인**: 최근 5회 연속 실패 → `check_consecutive_failures()` 자동 비활성화.
**해결**: 실행 이력에서 에러 메시지 확인 → 문제 해결 후 `toggle` API로 재활성화.

---

## 10. 빠른 참조 카드

### API 호출 순서 (일반적 사용 시나리오)

```
[시나리오 1: 파일 ETL]
POST /connections/test         → 연결 테스트 (선택)
POST /upload                   → 파일 업로드 + ETL 등록
GET  /tables/{id}/preview      → 미리보기
POST /transform-rules          → 변환 룰 추가 (선택)
POST /transform/preview        → 변환 미리보기 (선택)
PATCH /tables/{id}             → PK/매핑 설정
POST /tables/{id}/run          → 실행
GET  /jobs/{id}                → 진행률 폴링

[시나리오 2: DB ETL]
POST /connections              → DB 연결 등록
POST /connections/test         → 연결 테스트
GET  /connections/{id}/tables  → 소스 테이블 목록
GET  /connections/{id}/source-columns → 컬럼 목록
POST /tables                   → ETL 정의 등록
POST /tables/{id}/run          → 실행
GET  /jobs/{id}                → 진행률 폴링

[시나리오 3: SFTP 배치]
POST /batch/folder-connections       → 폴더 연결
POST /batch/folder-connections/test  → 테스트
GET  /batch/folder-connections/{id}/patterns → 패턴 탐지
POST /batch/jobs                     → 배치 Job 등록 (자동 시작)
GET  /batch/jobs/{id}/history        → 실행 이력 확인
POST /batch/jobs/{id}/run-now        → 즉시 실행 (테스트용)

[시나리오 4: ETL → DB 배치 전환]
POST /tables/{id}/run                → 먼저 1회 실행 (status=done 필요)
POST /batch/jobs/from-etl-table      → 배치로 전환
```

---

> **마지막 팁**: 이 시스템은 "넓고 얕은" 구조입니다. 대부분의 복잡성은 **3가지 DB 타입(PG/MySQL/Oracle) × 2가지 모드(full/incremental) × 2가지 소스(파일/DB) × 2가지 배치(파일/DB)**의 조합에서 옵니다. 하나의 경로(예: "PostgreSQL + incremental + DB 소스")를 먼저 완전히 이해하면, 나머지는 분기 패턴만 다르므로 빠르게 파악할 수 있습니다.