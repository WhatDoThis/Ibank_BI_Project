# 14. ETL PK Diff 동기화 모드 설계서

**문서 목적**: 증분 컬럼(updated_at 등)이 없고 PK가 비순차적으로 INSERT되는 소스에 대해 **소스·타겟 PK 목록 비교(diff)**로 신규/삭제 행만 동기화하는 `sync_mode=diff` 모드 추가. 계획·설계·파일별 수정 사항를 현재 패키지 구조(**Backend/etl_server**) 기준으로 정리함.

**관련 코드**: `Backend/etl_server` (service, db_load_service, batch_executor_db, service_file, router, router_file). 패키지명 etl_server2가 아닌 **etl_server** 기준.

---

## 1. 개요

### 1.1 목적
증분 컬럼이 없고, PK가 비순차적으로 INSERT되는 소스 테이블에 대해 **소스와 타겟의 PK 목록을 비교(diff)**하여 신규/삭제 행만 효율적으로 동기화하는 `sync_mode=diff` 모드를 추가한다.

### 1.2 동작 원리
```
1단계: 소스 DB에서 PK 값 목록만 SELECT (가벼운 쿼리)
2단계: 타겟 DB에서 PK 값 목록만 SELECT
3단계: 집합 비교
       - 소스에만 있는 PK → INSERT 대상
       - 타겟에만 있는 PK → DELETE 대상 (선택적, diff_delete_orphans)
       - 양쪽 다 있는 PK → 스킵 (변경 감지 미포함, Phase 2에서 해시 비교 확장 가능)
4단계: INSERT 대상 PK에 해당하는 전체 행만 소스에서 SELECT → 타겟에 적재
5단계: (선택) DELETE 대상 PK를 타겟에서 삭제
```

### 1.3 전제 조건
- `pk_columns`가 반드시 설정되어 있어야 함
- `incremental_column`은 불필요 (없어도 동작)
- 타겟 테이블이 이미 존재해야 함 (최초 적재는 `full` 모드로 수행)

**⚠️ diff 모드 제약사항**
- **소스에서 기존 행의 값이 변경(UPDATE)된 경우 감지하지 않음.** 신규 INSERT와 소스에서 삭제된 행(DELETE)만 처리한다.
- 양쪽에 모두 있는 PK는 "스킵"하며, 해당 행의 컬럼 값 변경은 반영되지 않는다.
- 변경 감지가 필요하면 `incremental`(updated_at 등 증분 컬럼)을 사용하거나, Phase 2의 행 해시 비교 확장을 검토한다.

---

## 2. DB 스키마 변경

### 2.1 etl_tables 테이블
변경 없음. 기존 `sync_mode` 컬럼(TEXT)에 `'diff'` 값을 추가로 허용.

### 2.2 batch_jobs 테이블
- 기존 `sync_mode` CHECK 제약에 `'diff'` 추가. (현재 `CHECK (sync_mode IN ('full', 'incremental'))` 인 경우)
```sql
-- 기존 CHECK가 있다면 제거 후 재적용
ALTER TABLE batch_jobs DROP CONSTRAINT IF EXISTS batch_jobs_sync_mode_check;
ALTER TABLE batch_jobs ADD CONSTRAINT batch_jobs_sync_mode_check
  CHECK (sync_mode IN ('full', 'incremental', 'diff'));
```

### 2.3 신규 설정 컬럼: diff_delete_orphans

**저장 위치**: ETL 테이블 단위 실행은 `etl_tables`에서만 읽음. 배치 Job은 **etl_table_id 모드**일 때 `etl_tables.diff_delete_orphans`를 사용하고, **독립 모드**일 때는 `batch_jobs.diff_delete_orphans`를 사용하므로 **두 테이블 모두** 컬럼이 필요하다.

```sql
-- etl_tables: ETL 수동 실행·배치(etl_table_id 연결) 시 사용
ALTER TABLE etl_tables ADD COLUMN IF NOT EXISTS diff_delete_orphans BOOLEAN DEFAULT FALSE;

-- batch_jobs: job_type='db' 독립 모드에서 diff_delete_orphans 사용 시 필요
ALTER TABLE batch_jobs ADD COLUMN IF NOT EXISTS diff_delete_orphans BOOLEAN DEFAULT FALSE;
```

- `TRUE`: 타겟에만 있는 PK(소스에서 삭제된 행)를 타겟에서도 DELETE.
- `FALSE`(기본): 삭제 전파하지 않음, 신규 INSERT만 수행.

---

## 3. 파일별 수정 사항 (Backend/etl_server)

### 3.1 Backend/etl_server/service.py

| 위치 | 현재 코드 | 변경 내용 |
|------|-----------|-----------|
| `get_sync_mode_for_load` | `return "full" if normalized == "full" else "incremental"` | `if normalized in ("full", "diff"): return normalized` 추가 후 `return "incremental"` |
| `create_etl_table` 내 sync_mode 검증 | `if sync_mode not in ("full", "incremental"): sync_mode = "incremental"` | `if sync_mode not in ("full", "incremental", "diff"): sync_mode = "incremental"` |
| `create_etl_table` 내 타겟 검사 | full 모드만 기존 테이블 존재 시 에러 | **diff 모드 추가**: `if sync_mode == "diff" and not target_table_exists(storage_connection_id, target_table): raise ValueError("diff 모드는 타겟 테이블이 이미 존재해야 합니다. 먼저 full 모드로 최초 적재한 뒤 diff 모드로 전환하세요.")` |
| `update_etl_table` 내 sync_mode | `val = "full" if raw == "full" else "incremental"` | `if raw in ("full", "diff"): val = raw` else `val = "incremental"` |

**get_sync_mode_for_load 변경 예시:**
```python
def get_sync_mode_for_load(etl_table_id: int) -> str:
    row = get_etl_table(etl_table_id)
    if not row:
        return "incremental"
    raw = row.get("sync_mode")
    normalized = (str(raw).strip().lower() if raw is not None else "") or ""
    if normalized in ("full", "diff"):
        return normalized
    return "incremental"
```

---

### 3.2 Backend/etl_server/db_load_service.py

#### 3.2.1 신규 함수: `_fetch_pk_values_from_source`
**추가 위치**: `_fetch_source_pk_columns` 함수 아래

- 소스 테이블에서 PK 값 집합 조회. 복합 PK면 튜플의 set, 단일 PK면 스칼라의 set.
- 인자: `conn`, `quoted_table`(이미 인용된 테이블명), `pk_columns: List[str]`, `quote_fn`(컬럼 인용 함수), `source_type: str`.
- `SELECT pk1, pk2, ... FROM quoted_table` → fetchmany(10000) 반복하여 set 수집.
- MySQL/Oracle은 각 DB별 인용·바인드 규칙 적용(`quote_fn`은 호출부에서 stype별로 전달).

#### 3.2.2 신규 함수: `_fetch_pk_values_from_target`
- 타겟(PostgreSQL) 테이블에서 PK 값 집합 조회.
- 인자: `conn`, `schema`, `table_name`, `pk_columns: List[str]`.
- `SELECT "pk1", "pk2" FROM "schema"."table"` → fetchmany(10000) 반복.

#### 3.2.3 신규 함수: `_run_diff_sync`
**추가 위치**: `run_db_load` 함수 위

- 인자: `etl_table_id`, `job_id`, `row`, `src_conn`, `conn_main`, `main_schema`, `target_table`, `stype`, `columns`, `col_names`, `quoted_src`, `quote_fn`, `type_mapper`, `mapping_used`, `pk_list`, `source_tz`, `target_tz`, `tz_convert_needed`, **`is_batch: bool = False`**.
- **`is_batch` 분기**: `is_batch=True`이면 `etl_service.set_job_total_rows`, `etl_service.update_job_progress`, `etl_service.is_job_cancelled` 호출을 **전부 생략**한다. (배치 실행기에서 호출 시 etl_jobs가 없으므로 job_id=0을 넘기면 의미 없는 UPDATE가 발생할 수 있음.)  
  - `run_db_load`에서 호출 시 **`is_batch=False`**(기본값).  
  - `batch_executor_db`에서 호출 시 **`is_batch=True`**.
- `row.get("diff_delete_orphans", False)` 로 삭제 여부 결정.
- 매핑 있으면 PK는 타겟 컬럼명 기준으로 `target_pk_list` 사용.

**커서 생명주기 (필수)**  
- `conn_main`에 대해 **배치 루프 밖에서 커서 1개 생성 후 재사용**하거나, 배치마다 `cur = conn_main.cursor()` 후 `try`/`finally`에서 `cur.close()` 호출.  
- `_copy_insert_batch(cur, ...)`에 **인라인 `conn_main.cursor()`를 넘기면 close가 되지 않아 커서 누수**가 발생하므로, `cur_main = conn_main.cursor()` 한 번만 생성하고 동일 `cur_main`을 모든 배치에 전달한 뒤, 함수 종료 전 또는 `try`/`finally`에서 `cur_main.close()` 보장.

**PK 집합 크기 상한 (OOM 방지)**  
- 소스/타겟 PK 집합 조회 직후, `len(source_pks)` 또는 `len(new_pks)`가 상한을 초과하면 즉시 에러 처리.  
- 상한값: `MAX_DIFF_PK_COUNT = 10_000_000` (기본값, config에서 오버라이드 가능).  
- 초과 시: `raise ValueError("소스 PK 수({:,})가 diff 모드 상한({:,})을 초과합니다. full 모드를 사용하거나 증분 컬럼을 설정하세요.".format(len(source_pks), MAX_DIFF_PK_COUNT))`  
- 문자열/UUID PK는 정수 대비 메모리 사용량이 크므로, 상한 도달 시 OOM 가능성을 설계 단계에서 제한한다.

**Oracle 소스 시 IN 절 제약**  
- Oracle은 `WHERE pk IN (v1, v2, ...)` 에 **최대 1000개**만 허용. 배치 크기 1000으로 하면 단일 PK는 문제 없음.  
- **복합 PK**의 경우 Oracle은 `WHERE (pk1, pk2) IN ((a1,b1), (a2,b2), ...)` 문법을 지원하지 않으므로, 아래 중 하나로 분기해야 함.  
  - **대안 A**: `WHERE (pk1 = :1 AND pk2 = :2) OR (pk1 = :3 AND pk2 = :4) OR ...` 형태로 1000건씩 OR 연산 (바인드 2000개).  
  - **대안 B**: 타겟(PostgreSQL)에 임시 테이블을 만들고 PK 배치를 INSERT한 뒤, 소스 측에서 해당 PK와 JOIN하는 방식은 소스가 Oracle이면 드라이버/구문에 따라 구현 비용이 있으므로, 우선 대안 A를 권장.  
- 구현 시 `stype == "oracle"` 이고 `len(pk_list) > 1` 이면 복합 PK용 WHERE 절을 OR 체인으로 생성하고, 단일 PK는 기존 IN 절 유지.

**처리 흐름**  
- 1) 소스 PK 집합 조회 2) 타겟 PK 집합 조회 3) 상한 체크 후 `new_pks = source - target`, `deleted_pks = target - source` (diff_delete_orphans일 때만) 4) 신규 PK에 해당하는 행만 소스에서 SELECT(IN 절 배치 1000건, Oracle 복합 PK는 OR 체인) → DataFrame → 시간대 변환·변환 룰·매핑 형변환 → `_copy_insert_batch(cur_main, ...)` 로 타겟 INSERT 5) (선택) deleted_pks를 타겟에서 DELETE.  
- 반환: `{ "rows_inserted": int, "rows_deleted": int }`.  
- 진행률·취소: **`is_batch=False`일 때만** `etl_service.set_job_total_rows(job_id, len(new_pks))`, 배치마다 `etl_service.update_job_progress(job_id, rows_inserted)`, 루프 안에서 `etl_service.is_job_cancelled(job_id)` 확인 후 중단 처리. `is_batch=True`이면 위 호출 전부 생략.

#### 3.2.4 `run_db_load` 함수 본문
**삽입 위치**: 소스 연결·columns·col_names·mapping_used·quoted_src·_quote 확정 직후, 기존 `where_clause`/`params` 설정 전.

- **`sync_mode == "diff"` 분기 전체를 try/except/finally로 감싼다.**  
  - **finally**: `conn_main`이 설정되어 있으면 `conn_main.close()`, `src_conn`이 설정되어 있으면 `src_conn.close()` 호출하여 정리.  
  - **return 직전**: diff 분기에서 정상/예외 return 하기 전에 `src_conn = None`, `conn_main = None` 을 설정하여, 상위 try/finally(기존 full/incremental 경로용)에서 같은 변수를 다시 close하지 않도록 한다. (중복 close 방지.)
- 분기 내용:
  - `pk_columns` 없으면 `update_job(job_id, "failed", error_message="diff 모드는 pk_columns가 필요합니다.")` 후 return. (필요 시 반환 dict에 `suggested_action` 포함 가능.)
  - `conn_main, main_schema = etl_service.get_target_db_connection(row.get("storage_connection_id"))` 로 타겟 연결.
  - 타겟 테이블 존재 확인: `SELECT 1 FROM "main_schema"."target_table" LIMIT 1` 실행, 실패 시 `update_job(job_id, "failed", error_message="...", ...)` 후 **반환 dict에 `suggested_action` 포함**: `"sync_mode를 full로 설정하여 최초 적재를 먼저 실행하세요."` (프론트에서 안내 메시지로 활용).
  - `_run_diff_sync(..., is_batch=False)` 호출 후 `etl_service.update_job(job_id, "completed", ...)`, return. 예외 시 `update_job("failed", ...)` 및 반환 dict에 `suggested_action` 포함 가능.
- 이후 기존 full/incremental 로직 유지.

---

### 3.3 Backend/etl_server/batch_executor_db.py

| 위치 | 현재 코드 | 변경 내용 |
|------|-----------|-----------|
| sync_mode 정규화 (etl_table_id 모드·독립 모드 공통) | `if sync_mode not in ("full", "incremental"): sync_mode = "incremental"` | `if sync_mode not in ("full", "incremental", "diff"): sync_mode = "incremental"` |

**추가**: `sync_mode == "diff"` 일 때 전용 분기.
- 소스 연결·타겟 연결·run_id·columns·quoted_src·mapping_used·pk_list 등이 준비된 뒤, 기존 while fetch 루프 **앞**에서 분기.
- `pk_list` 없으면 에러 처리 후 return.
- **diff_delete_orphans 전달**: etl_table_id 모드일 때는 `etl_def.get("diff_delete_orphans", False)`, 독립 모드일 때는 `job.get("diff_delete_orphans", False)`를 사용해 `row={"diff_delete_orphans": diff_delete}` 형태로 `_run_diff_sync`에 전달. (배치에서도 삭제 전파를 쓰려면 §2.3에 따라 `batch_jobs.diff_delete_orphans` 컬럼이 필요하다.)
- `db_load_service._run_diff_sync(..., is_batch=True)` 호출. (`is_batch=True`이므로 set_job_total_rows/update_job_progress/is_job_cancelled는 호출되지 않음.) 반환값만 받아 `batch_service.finish_run(run_id, "success", rows_inserted=..., rows_updated=0, conn=sys_conn)`, `batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)` 호출 후 return.
- diff 모드에서는 `last_synced_at` 갱신하지 않음.

---

### 3.4 Backend/etl_server/service_file.py

| 위치 | 현재 코드 | 변경 내용 |
|------|-----------|-----------|
| `create_batch_job` 내 sync_mode 검증 | `if sync_mode_val not in ("full", "incremental"): sync_mode_val = "incremental"` | `if sync_mode_val not in ("full", "incremental", "diff"): sync_mode_val = "incremental"` |
| `create_batch_job` 함수 인자 | — | **`diff_delete_orphans: bool = False`** 추가. INSERT 문에 `diff_delete_orphans` 컬럼·바인드 파라미터 추가. (job_type='db'일 때만 사용, 'file'이면 None 또는 False.) |
| `create_batch_job` INSERT 문 | — | batch_jobs 테이블에 **diff_delete_orphans** 컬럼 및 대응 파라미터 추가. |
| `update_batch_job` 내 sync_mode 검증 | `if sm not in ("full", "incremental"): raise ValueError(...)` | `if sm not in ("full", "incremental", "diff"): raise ValueError(...)` |
| `update_batch_job` updatable 필드 목록 | — | **`"diff_delete_orphans"`** 추가. kwargs에 포함되면 UPDATE SET에 반영. |

---

### 3.5 Backend/etl_server/router.py

| 위치 | 현재 코드 | 변경 내용 |
|------|-----------|-----------|
| `CreateTableBody.sync_mode` | `description="full \| incremental"` | `description="full \| incremental \| diff. diff는 PK 목록 비교 방식(증분 컬럼 불필요, 타겟 테이블 사전 존재 필수)"` |
| `UpdateTableBody.sync_mode` | `description="full \| incremental. DB 연동 ETL만 적용."` | `description="full \| incremental \| diff. DB 연동 ETL만 적용."` |

**검증 로직 추가 (run_table_load 직전 또는 run_table_load 내부)**  
DB 소스 실행 시, sync_mode가 diff이면:
- `pk_columns` 미설정 시 `HTTPException(400, detail="diff 모드는 pk_columns가 설정되어 있어야 합니다.")`  
  - 응답 본문에 **suggested_action** 포함 권장: `{"detail": "...", "suggested_action": "ETL 테이블 설정에서 pk_columns를 지정하세요."}` (프론트에서 안내 메시지·버튼 노출 가능)
- `etl_service.target_table_exists(storage_connection_id, target_table)` False 시 `HTTPException(400, detail="diff 모드는 타겟 테이블이 이미 존재해야 합니다. 먼저 full 모드로 최초 적재하세요.")`  
  - **suggested_action** 포함: `"sync_mode를 full로 설정하여 최초 적재를 실행한 뒤, sync_mode를 diff로 변경하세요."`

※ `run_table_load`는 즉시 job 등록만 하고 실제 실행은 queue_worker가 `run_db_load`를 호출하므로, 사전 검증은 run_table_load에서 row 조회 후 sync_mode·pk_columns·target_table 존재 여부를 확인하는 방식으로 넣는다.  
※ **run_db_load** 반환 dict(실패 시)에도 `suggested_action` 필드를 넣으면, Job 상세/이력 API에서 프론트가 동일한 안내를 보여줄 수 있다. 예: `return {"job_id": job_id, "status": "failed", "error_message": "diff 모드는 타겟 테이블이 이미 존재해야 합니다.", "suggested_action": "sync_mode를 full로 설정하여 최초 적재를 먼저 실행하세요."}`

---

### 3.6 Backend/etl_server/router_file.py

| 위치 | 현재 코드 | 변경 내용 |
|------|-----------|-----------|
| `CreateBatchJobBody.sync_mode` | `description="DB 배치: full \| incremental"` | `description="DB 배치: full \| incremental \| diff"` |
| **CreateBatchJobBody** | — | **`diff_delete_orphans: Optional[bool] = Field(False, description="diff 모드: 소스에서 삭제된 행을 타겟에서도 DELETE")`** 추가. create_batch_job 호출 시 전달. |
| `UpdateBatchJobBody`에 sync_mode 필드가 있다면 | 동일 | 허용값에 `diff` 포함 |
| **UpdateBatchJobBody** | — | **`diff_delete_orphans: Optional[bool] = None`** 추가. update_batch_job 호출 시 kwargs에 포함. |

---

### 3.7 Backend/etl_server/preview_service.py
변경 없음. diff 모드는 실제 적재 로직에만 영향.

### 3.8 Backend/etl_server/transform_engine.py
변경 없음. diff 모드에서도 기존 변환 룰 동일 적용.

---

## 4. 프론트엔드 표시용 sync_mode 라벨 및 API 연동

| 값 | 한글 라벨 | 설명 |
|----|-----------|------|
| full | 전체 | 매번 DROP → 재생성. 완전 교체 |
| incremental | 증분 | 증분 컬럼 기준 WHERE > last_synced_at |
| diff | PK 비교 | 소스/타겟 PK 목록 대조. 증분 컬럼 불필요 |

- UI: sync_mode 셀렉트박스에 "PK 비교(diff)" 옵션 추가. (선택) `diff_delete_orphans` 토글 스위치.

**에러 시 suggested_action 활용**  
- run_table_load 검증 실패(400) 또는 run_db_load 실패 반환 시, 응답에 `suggested_action` 필드가 있으면 프론트에서 해당 문구를 안내 메시지·툴팁으로 노출하면 된다. 예: "sync_mode를 full로 설정하여 최초 적재를 먼저 실행하세요."

---

## 5. 테스트 시나리오

| # | 시나리오 | 확인 내용 |
|---|----------|-----------|
| 5.1 | 기본 동작 | full → 1000건 적재 후 sync_mode를 diff로 변경, 소스에 비순차 PK 101건 INSERT → diff 실행 시 101건만 INSERT |
| 5.2 | 삭제 감지 | diff_delete_orphans=true, 소스에서 id=100 DELETE → diff 실행 시 타겟에서도 id=100 DELETE |
| 5.3 | 복합 PK | pk_columns="campaign_id,seq_no" 설정 후 diff 실행 정상 동작 |
| 5.4 | 대량 데이터 | 소스·타겟 각 500만 건 수준에서 diff 실행 시 PK 집합 메모리 사용량·실행 시간 확인 |
| 5.5 | 에러 케이스 | pk_columns 미설정 시 diff 실행 → 400/에러 메시지; 타겟 테이블 미존재 시 diff 실행 → 400/에러 메시지 |

---

## 6. 구현 순서 (권장)

| 단계 | 내용 | 예상 시간 |
|------|------|------------|
| **0** | **DB 마이그레이션**: batch_jobs CHECK 제약 변경(sync_mode에 'diff' 추가), etl_tables·batch_jobs에 diff_delete_orphans 컬럼 추가. (§2.2, §2.3 SQL 실행) | 5분 |
| 1 | service.py: get_sync_mode_for_load, create_etl_table, update_etl_table 에 sync_mode "diff" 반영 및 diff 시 타겟 테이블 존재 검사 | 10분 |
| 2 | service_file.py, router.py, router_file.py: sync_mode 검증·description에 "diff" 추가; batch_jobs용 diff_delete_orphans 저장/조회 반영 | 10분 |
| 3 | db_load_service.py: _fetch_pk_values_from_source, _fetch_pk_values_from_target 추가 | 25분 |
| 4 | db_load_service.py: _run_diff_sync 추가 (커서 생명주기·PK 상한·Oracle IN/복합 PK 분기·INSERT 배치·DELETE·취소·진행률) | 45분 |
| 5 | db_load_service.py: run_db_load 에 diff 분기 삽입, 실패 시 반환 dict에 suggested_action 포함 | 20분 |
| 6 | batch_executor_db.py: sync_mode "diff" 허용, diff_delete_orphans 전달(etl_def/job), diff 분기에서 _run_diff_sync 호출·finish_run/update_job_status | 20분 |
| 7 | router.py: run_table_load 또는 실행 직전 diff 모드 사전 검증 (pk_columns·타겟 존재), HTTPException 시 suggested_action 포함 | 10분 |
| 8 | 테스트 시나리오 5.1~5.5 실행 | 30분 |

---

## 7. 향후 확장 (Phase 2, 본 구현 범위 아님)

- **행 해시 비교**: 양쪽에 있는 PK(common_pks)에 대해 행 전체 해시 비교로 변경된 행 감지. (MD5(col1\|\|col2\|\|...) 등)
- **메모리 최적화**: PK 1000만 건 이상 시 Bloom Filter 또는 DB-side EXCEPT 쿼리로 대체.
- **UI**: diff_delete_orphans 토글, sync_mode "PK 비교(diff)" 설명 툴팁.

---

## 8. 참고: 패키지·파일 대응표

| 설계서 항목 | 현재 프로젝트 경로 |
|-------------|---------------------|
| Backend.etl_server2.service | **Backend/etl_server/service.py** |
| Backend.etl_server2.db_load_service | **Backend/etl_server/db_load_service.py** |
| Backend.etl_server2.batch_executor_db | **Backend/etl_server/batch_executor_db.py** |
| Backend.etl_server2.service_file | **Backend/etl_server/service_file.py** |
| Backend.etl_server2.router | **Backend/etl_server/router.py** |
| Backend.etl_server2.router_file | **Backend/etl_server/router_file.py** |
| Backend.etl_server2.preview_service | **Backend/etl_server/preview_service.py** |
| Backend.etl_server2.transform_engine | **Backend/etl_server/transform_engine.py** |

- ETL API prefix: `/api/etl` (router), 배치: `/api/etl/batch` (router_file include).
- DB 적재 실행: queue_worker가 `db_load_service.run_db_load` 호출; 배치 DB 실행: 스케줄러가 `batch_executor_db.run_db_batch_job` 호출.
