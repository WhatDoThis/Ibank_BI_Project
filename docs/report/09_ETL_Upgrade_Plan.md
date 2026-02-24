# ETL 업그레이드 계획 (09_ETL_Upgrade_Plan)

**목적**: 저장 DB 등록·저장 DB 선택·테이블/컬럼 선택·컬럼 매핑 기능을 Phase별로 도입하기 위한 구체적 계획.  
**범위**: ETL 페이지 UI 확장, 백엔드 저장 DB 메타·연결 검증·적재 대상 분기, config 한도 적용 검토.  
**작업 원칙**: 한 Phase 내에서도 **한 번에 한 파일(또는 한 관심사)만** 변경하도록 끊어서 진행하면 Cursor 작업 성공률이 높음. 각 Phase 끝에 권장 작업 순서를 둠.

---

## 1. 용어 정리

| 용어 | 의미 |
|------|------|
| **소스(Source)** | 데이터를 **가져오는** 쪽. 파일 업로드 또는 **DB 연결** 탭에서 등록한 외부 DB(etl_connections). |
| **저장 DB(Target/Storage DB)** | 테이블을 **만들고 데이터를 넣는** DB. 현재는 1개 고정(config의 비즈니스 DB = ibank_db). 업그레이드 후에는 사용자가 등록한 DB + 기본 ibank_db 선택 가능. |
| **ibank_db(기본 저장 DB)** | config `backend.db_*`로 연결되는 DB. 우리 시스템에 base로 연결된 DB이며, `backend.etl_limits`가 적용되는 기본 적재 대상. |
| **연결 테스트(저장 DB)** | 방화벽/접속 가능 여부 + **테이블 생성·삭제·쓰기** 권한 검증. CREATE TABLE / INSERT / DROP TABLE 가능한 계정만 등록 허용. |

---

## 2. config.json etl_limits 적용 여부

**결론: 그대로 백엔드에서 적용하면 됨.**

- 적재는 **항상 우리 Backend를 경유**함.
- `etl_limits`(max_file_size_mb, max_rows_per_load, max_batch_size)는 **저장 DB를 사용자 등록 DB로 바꿔도 동일하게 적용**.
- 저장 DB가 외부 DB여도, 우리 서버가 그 DB로 INSERT를 보내기 전에 행 수·배치 크기를 이미 제한하므로 config 한도는 변경 없이 유지.

---

## 3. 저장 DB는 PostgreSQL 전용

- **소스 DB**: 이미 PostgreSQL·MySQL·Oracle 등 다양하게 지원함.
- **저장 DB**: **PostgreSQL만 지원**하는 것으로 한정하는 것을 권장.
  - MySQL/Oracle 저장 DB를 쓰려면 ON CONFLICT(PostgreSQL) → ON DUPLICATE KEY UPDATE(MySQL), MERGE INTO(Oracle) 등 DB별 분기와 CREATE TABLE DDL·타입 매핑 분기가 전부 필요해 복잡도가 급증함.
- **구현**: DDL에는 확장 여지를 위해 `source_type` 컬럼을 남겨두되, **UI에서는 PostgreSQL만 선택 가능**하게 함. 추후 다른 엔진을 넣을 때 같은 테이블에 컬럼만 활용하면 됨.

---

## 4. Phase 0: 적재 DB 연결 획득 헬퍼 추출 (Phase 2 전 선행)

현재 `load_service.run_file_load`, `db_load_service.run_db_load` 등에서 아래 패턴이 **반복**됨:

```text
main_schema = api_db.get_table_schema()
conn_main = api_db.get_db_connection()
cur_main = conn_main.cursor()
full_name = f'"{main_schema}"."{target_table}"'
```

이를 **한 번에 한 함수**로 모아 두면, Phase 2b에서 적재 분기 시 기존 코드를 최소만 건드릴 수 있음.

### 4.1 추가할 함수 (service.py 또는 적재 연결 전용 모듈)

```python
def get_target_db_connection(storage_connection_id: Optional[int] = None):
    """
    적재 대상 DB 연결 획득.
    - storage_connection_id가 None이면 기본 ibank_db(config).
    - 있으면 etl_storage_connections에서 조회해 해당 PostgreSQL 연결 반환.
    반환: (conn, schema_name: str)
    """
    if storage_connection_id is None:
        api_db = _get_db()
        return api_db.get_db_connection(), api_db.get_table_schema()

    sc = get_storage_connection(storage_connection_id)
    if not sc:
        raise ValueError("저장 DB 연결을 찾을 수 없습니다.")
    conn = _connect_postgres(
        sc["host"], sc.get("port") or 5432, sc["database_name"],
        sc["username"], sc.get("encrypted_password") or "",
    )
    schema = (sc.get("schema_name") or "").strip() or "public"
    return conn, schema
```

- `get_storage_connection(storage_connection_id)` 는 Phase 1에서 etl_storage_connections 조회로 구현하면 됨.
- Phase 0에서는 **storage_connection_id는 항상 None으로 두고**, 기존 `api_db.get_db_connection()`, `get_table_schema()` 호출부만 위 함수 한 번 호출로 치환. 반환값 `(conn, schema)` 사용해 `full_name = f'"{schema}"."{target_table}"'` 등으로 통일.

### 4.2 Phase 0 작업 순서(권장)

1. `get_target_db_connection(None)` 만 지원하는 형태로 함수 추가(내부는 기존 api_db 호출만).
2. `load_service.run_file_load` 에서 해당 3줄(또는 4줄)을 `conn_main, main_schema = get_target_db_connection(None)` + `cur_main = conn_main.cursor()` 등으로 교체.
3. `db_load_service.run_db_load` 내 동일 패턴이 나오는 **모든 위치**를 같은 방식으로 교체(스트리밍/비스트리밍 경로 모두).
4. 동작이 기존과 동일한지 확인 후 Phase 1 진행.

---

## 5. Phase 1: 저장 DB 등록 페이지 및 연결·권한 검증

### 5.1 UI

- **탭 순서**: `파일 업로드` | `DB 연결` | **`저장 DB 등록`** | `ETL 이력`
- **패널**: 기존 DB 연결(etl_connections) 폼과 동일한 입력 항목(DB 종류는 PostgreSQL만 노출), **연결 테스트** 버튼으로 접속+권한 검증.

### 5.2 저장 DB 전용 메타 테이블

- **테이블명**: `etl_storage_connections` (시스템 DB)
- **저장 DB는 PostgreSQL 전용**이므로, DDL에는 확장 여지를 위해 `source_type`을 두되 기본값 `postgresql`만 사용.

**DDL (시스템 DB public 스키마)**

```sql
CREATE TABLE IF NOT EXISTS public.etl_storage_connections (
  storage_connection_id SERIAL PRIMARY KEY,
  connection_name        VARCHAR(255) NOT NULL,
  source_type            VARCHAR(32) NOT NULL DEFAULT 'postgresql',
  host                   VARCHAR(255) NOT NULL,
  port                   INTEGER NOT NULL DEFAULT 5432,
  database_name          VARCHAR(255) NOT NULL,
  schema_name            VARCHAR(255),
  username               VARCHAR(255) NOT NULL,
  encrypted_password     TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.etl_storage_connections IS 'ETL 적재 대상 DB(PostgreSQL). 테이블 생성·삭제·쓰기 권한이 있는 계정만 등록.';
```

### 5.3 연결 테스트(접근 + 권한) 구현

접속 성공 후 **CREATE TABLE → INSERT 1건 → DROP TABLE**까지 수행해 권한을 검증. 임시 테이블명은 충돌 방지를 위해 UUID 등 포함.

```python
def test_storage_connection(host, port, database_name, schema_name, username, password):
    """접속 + CREATE TABLE + INSERT + DROP TABLE 권한 검증."""
    conn = _connect_postgres(host, port, database_name, username, password or "")
    schema = (schema_name or "").strip() or "public"
    test_table = f'"_etl_permission_test_{uuid.uuid4().hex[:8]}"'
    full_name = f'"{schema}".{test_table}'
    cur = conn.cursor()
    try:
        cur.execute(f"CREATE TABLE {full_name} (id INTEGER)")
        cur.execute(f"INSERT INTO {full_name} VALUES (1)")
        cur.execute(f"DROP TABLE {full_name}")
        conn.commit()
        return {"ok": True, "message": "접속 및 권한 확인 완료"}
    except Exception as e:
        conn.rollback()
        try:
            cur.execute(f"DROP TABLE IF EXISTS {full_name}")
            conn.commit()
        except Exception:
            conn.rollback()
        return {"ok": False, "message": f"권한 부족: {e}"}
    finally:
        cur.close()
        conn.close()
```

- 등록 폼에서 “연결 테스트” 시 위 함수 호출. `ok: True`일 때만 등록 허용하거나, 실패 시 메시지 표시.

### 5.4 Phase 1 작업 순서(권장)

1. **DDL**: `etl_storage_connections` 테이블 생성 스크립트를 별도 SQL 파일로 두고 적용.
2. **service.py**: `etl_storage_connections` CRUD(목록/1건 조회/등록/수정/삭제) 및 `get_storage_connection(storage_connection_id)` 추가.
3. **service.py**: `test_storage_connection(...)` 추가(위 구현).
4. **router.py**: `/api/etl/storage-connections` GET/POST/PATCH/DELETE, `/api/etl/storage-connections/test` POST 추가.
5. **Frontend**: SourceTypeSelector에 “저장 DB 등록” 탭 추가, 저장 DB 등록 패널(폼·목록·연결 테스트 호출) 추가.

---

## 6. Phase 2a: 메타 확장 + UI만 (적재는 여전히 ibank_db)

- **목적**: Phase 2와 3 사이 간극을 줄이고, 한 PR당 변경 범위를 관리 가능하게 함.
- **Backend**: `etl_tables`에 `storage_connection_id` (NULL 허용) 컬럼 추가. ETL 등록/수정 API에서 해당 필드 받아 저장.
- **Frontend**: 파일 업로드 폼·DB 연결 폼에 **저장할 DB** 셀렉트박스 추가.
  - 옵션: “기본 DB (ibank_db)” + Phase 1에서 등록한 저장 DB 목록.
  - 기본값: “기본 DB” (storage_connection_id = null).
- **적재 로직**: 이 단계에서는 **변경하지 않음**. 계속 `get_target_db_connection(None)`만 사용하거나, row에서 `storage_connection_id`를 읽되 **무시하고 None으로 연결 획득**해도 됨.

### 6.1 Phase 2a 작업 순서(권장)

1. **마이그레이션**: `etl_tables`에 `storage_connection_id INTEGER REFERENCES ...` (또는 FK 없이) 추가.
2. **service.py**: create_etl_table / update_etl_table 등에서 `storage_connection_id` 인자 받아 저장.
3. **router.py**: CreateTableBody / UpdateTableBody에 `storage_connection_id` 필드 추가.
4. **Frontend**: 저장 DB 목록 GET, 파일/DB 폼에 셀렉트박스 추가, 등록 시 선택값 전달.

---

## 7. Phase 2b: 적재 시 저장 DB 분기 + add_allowed_table 스킵

- **목적**: 실제로 선택된 저장 DB에 적재하고, 외부 저장 DB일 때는 allowed_tables에 넣지 않음.
- **Backend**:
  - `get_target_db_connection(storage_connection_id)` 구현 완성: `storage_connection_id`가 있으면 `get_storage_connection`으로 조회 후 `_connect_postgres`로 연결, `(conn, schema)` 반환.
  - `load_service.run_file_load`, `db_load_service.run_db_load` 등 **적재 진입부**에서 etl_table row의 `storage_connection_id`를 넘기도록 변경. 내부에서는 기존처럼 `conn_main, main_schema = get_target_db_connection(row.get("storage_connection_id"))` 한 줄로 통일.
  - **add_allowed_table 스킵**: 적재 완료 후 `add_allowed_table(target_table)`를 호출하는 곳에서, **storage_connection_id가 NOT NULL이면 호출하지 않음**. (ibank_db가 아닌 외부 DB에 만든 테이블은 우리 시스템의 allowed_tables와 무관함.)

### 7.1 Phase 2b 작업 순서(권장)

1. **service.py**: `get_target_db_connection(storage_connection_id)` 에서 `storage_connection_id`가 있을 때 `get_storage_connection` + `_connect_postgres` 분기 추가.
2. **load_service.py**: run_file_load에서 row의 `storage_connection_id` 전달, `get_target_db_connection` 사용; 적재 완료 후 `storage_connection_id`가 있으면 `add_allowed_table` 스킵.
3. **db_load_service.py**: run_db_load에서 동일 적용(스트리밍/비스트리밍 경로 모두).
4. (필요 시) **load_service.run_file_upsert** 등 다른 적재 경로에도 동일 규칙 적용.

---

## 8. Phase 3: 테이블 선택 및 컬럼 매핑 버튼·모달

- **위치**: 타겟 테이블명 입력창 오른쪽에 **테이블선택 및 컬럼매핑** 버튼(선택 기능).
- **모달**: 현재 폼에서 선택된 **저장 DB**(Phase 2a/2b 값) 기준으로 해당 DB에 연결해 테이블 목록 조회 → 셀렉트박스로 테이블 선택 → 선택 테이블의 컬럼 목록 표시 + 컬럼별 **선택 체크박스**(이 컬럼에 데이터를 넣을지 여부).
- **Backend**: 저장 DB(ibank_db 또는 storage_connection_id)별 테이블 목록·테이블 지정 시 컬럼 목록(컬럼명, 타입) 조회 API. `get_target_db_connection`으로 연결해 information_schema 등 조회.

### 8.1 Phase 3 작업 순서(권장)

1. **Backend**: 저장 DB 연결로 테이블 목록·컬럼 목록 조회 API 추가(router + service).
2. **Frontend**: 타겟 테이블명 옆 버튼, 모달(테이블 셀렉트, 컬럼 목록+체크박스), API 연동.

---

## 9. Phase 4: 컬럼 매핑·커스텀 컬럼명 및 메타 저장

### 9.1 기존 테이블 선택된 경우

- 소스 컬럼(파일 파싱 또는 DB 소스 테이블) ↔ 타겟 컬럼(Phase 3에서 선택한 기존 테이블의 선택된 컬럼) 1:1 매핑.
- **디폴트 매핑**: 타입 일치 + 컬럼명 유사도 높은 것끼리 자동 연결.
- **수동 매핑**: 타입만 일치하면 컬럼명이 달라도 소스→타겟 연결 가능.

### 9.2 기존 테이블 미선택 시(새 테이블 생성)

- 디폴트: 소스 컬럼명을 그대로 타겟 컬럼명으로 사용.
- 컬럼명 **커스텀 수정** 가능(예: 소스 `col_a` → 타겟 컬럼명 `custom_name`).

### 9.3 메타 저장: etl_tables.column_mapping JSONB

- **별도 테이블 대신** `etl_tables`에 **JSONB 컬럼 하나** 추가. ETL 1건당 매핑 1세트이고, 매핑만 따로 CRUD할 일이 거의 없기 때문.

**마이그레이션 예시**

```sql
ALTER TABLE etl_tables ADD COLUMN IF NOT EXISTS column_mapping JSONB;
```

**저장 값 예시**

```json
[
  {"source": "col_a", "target": "customer_id", "type": "BIGINT"},
  {"source": "col_b", "target": "name", "type": "TEXT"}
]
```

- 적재 시 이 매핑을 읽어 SELECT 컬럼 순서와 INSERT 컬럼 순서를 맞추면 됨.

### 9.4 Phase 4 작업 순서(권장)

1. **마이그레이션**: `etl_tables.column_mapping` JSONB 추가.
2. **Backend**: create/update 시 `column_mapping` 저장, 적재 시 매핑 읽어서 INSERT 컬럼/순서 반영(load_service, db_load_service).
3. **Frontend**: 기존 테이블 선택 시 매핑 UI(디폴트 매핑 + 수동), 미선택 시 컬럼명 커스텀 입력 UI.

---

## 10. Phase 5: 통합·검증 및 정리

- Phase 2~4 연동 검증: 저장 DB 선택 → 테이블 선택/미선택 → 컬럼 선택·매핑(또는 커스텀 컬럼명) → 실행 시 선택 저장 DB·매핑 반영.
- etl_limits·권한 정리 문서 반영.
- **add_allowed_table** 스킵 조건은 Phase 2b에서 이미 반영됨.

---

## 11. Phase 순서 요약

| Phase | 내용 |
|-------|------|
| **Phase 0** | 적재 DB 연결 획득을 `get_target_db_connection(None)` 한 함수로 추출. load_service / db_load_service에서 해당 패턴 전부 교체. |
| **Phase 1** | 저장 DB 등록 탭·페이지, etl_storage_connections 테이블·CRUD, `get_storage_connection`, `test_storage_connection`(접속+CREATE/INSERT/DROP 권한), API·UI. |
| **Phase 2a** | etl_tables.storage_connection_id 추가, 파일/DB 폼에 저장할 DB 셀렉트박스. **적재는 아직 ibank_db 고정.** |
| **Phase 2b** | `get_target_db_connection(storage_connection_id)` 분기 구현, 적재 시 저장 DB 분기, **storage_connection_id 있으면 add_allowed_table 스킵.** |
| **Phase 3** | 타겟 테이블명 옆 테이블선택·컬럼매핑 버튼, 모달(테이블 목록, 컬럼 목록+체크박스), 저장 DB 기준 테이블/컬럼 조회 API. |
| **Phase 4** | 소스↔타겟 매핑 UI(디폴트+수동), 미선택 시 컬럼명 커스텀, etl_tables.column_mapping JSONB, 적재 로직에 매핑 반영. |
| **Phase 5** | 전 플로우 통합 검증, 문서·권한 정리. |

---

## 12. Cursor 작업 시 실전 팁

- **한 번에 한 파일(또는 한 관심사)만** 요청하는 것이 성공률이 높음.
- 예: Phase 1을 할 때  
  - “service.py에 etl_storage_connections CRUD와 get_storage_connection 추가해줘”  
  - “service.py에 test_storage_connection 함수 추가해줘”  
  - “router.py에 /api/etl/storage-connections 엔드포인트 추가해줘”  
  - “Frontend에서 저장 DB 등록 탭과 폼 추가해줘”  
  이렇게 나누면 기존 코드 구조를 유지하기 쉬움.
- 각 Phase 끝의 **작업 순서(권장)**를 그대로 “다음 작업 단위”로 사용하면 됨.

---

## 13. 참고

- **08_ETL_Phase_Implement_Guide.md**: 현행 ETL 구조·메타·config·Job 확인.
- **config.json**: `backend.etl_limits`, `backend.db_*`, `backend.system_db` 구조 유지. 저장 DB 추가는 메타(etl_storage_connections)로만 확장.
- **Report 인덱스**: 본 문서는 00_ReportIndex.md에 `09_ETL_Upgrade_Plan.md` 항목으로 등록.

---

## 14. db_load_service COPY 프로토콜 적용 (성능 업그레이드)

**목적**: 메인 DB(PostgreSQL) 적재 시 `execute_values` 대신 **COPY FROM STDIN** 프로토콜을 사용해 INSERT/Upsert 처리량을 더 높임. 대용량 DB 소스(MySQL/Oracle) 적재 시간 단축.

**범위**: `Backend/etl_server2/db_load_service.py`의 `run_db_load` 내 스트리밍 분기·전체 fetch 분기.

### 14.1 헬퍼 함수 (run_db_load 위에 추가)

| 함수 | 역할 |
|------|------|
| `_serialize_value(v)` | COPY TEXT 포맷용 값 직렬화. `None`, `float('nan')`, `math.isinf`, `pd.NaT`, `pd.isna(v)` → `\N`. 그 외는 `str(v)` 후 `\`→`\\`, `\t`→`\\t`, `\n`→`\\n`, `\r`→`\\r` 이스케이프. |
| `_copy_buf(cols, rows_tuples)` | `rows_tuples`(list of tuple)를 COPY용 텍스트 버퍼로 변환. 행마다 탭 구분·줄 끝 개행. `io.StringIO` 반환, `seek(0)` 완료. |
| `_copy_insert_batch(cur, full_name, cols, rows_tuples)` | Full 모드: `COPY full_name (cols) FROM STDIN WITH (FORMAT text, NULL '\N')`로 직접 적재. |
| `_copy_upsert_batch(cur, full_name, cols, col_types, pk_list, rows_tuples)` | Incremental: (1) TEMP 테이블 전 컬럼 TEXT 생성, ON COMMIT DROP (2) COPY로 스테이징 (3) `INSERT INTO full_name SELECT col::type ... FROM stg ON CONFLICT (pk) DO UPDATE SET ...` 로 Upsert. COPY 단계는 TEXT만 다루어 타입 오류는 INSERT...SELECT 단계에서 명확한 메시지 확보. |

### 14.2 run_db_load 수정 요약

- **루프 진입 전**: `rules = list_transform_rules(etl_table_id)` 1회 (기존 유지).
- **first_batch에서 확정·재사용**: `columns_final`, `cols`, `col_defs`, **`col_types`**(`[t for _, t in columns_final]`). `insert_sql_template`/`upsert_sql_template` 제거.
- **적재 호출**: Full → `_copy_insert_batch(cur_main, full_name, cols, rows_tuples)`. Incremental → `_copy_upsert_batch(cur_main, full_name, cols, col_types, pk_list_inc, rows_tuples)`.
- **전체 fetch 분기**: 동일하게 `col_types` 도출 후 `_copy_insert_batch` / `_copy_upsert_batch` 사용.
- **유지**: 배치별 commit, `is_job_cancelled`, incremental `last_synced_at`, first_batch의 CREATE TABLE/존재 확인, 함수 시그니처·반환 형태.

### 14.3 MySQL 배치 상한

- INSERT가 COPY로 더 빨라지므로 fetch 간격이 줄어듦. MySQL 배치 상한은 10,000 유지(기존 적용분).

### 14.4 참고

- **10_ETL_Mapping_TypeCast_And_DB_Performance.md**: execute_values 적용 후 COPY로 한 단계 업그레이드. COPY는 upsert와 조합 시 임시 테이블 + INSERT...SELECT ON CONFLICT 패턴 사용.
