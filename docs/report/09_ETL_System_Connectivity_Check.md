# ETL 시스템 연결·로직 점검 보고서

**목적**: 새로 제작된 ETL 시스템(Backend/etl_server, Frontend/react-app/src/packages/etl)의 파일 간 의존관계 및 로직 이상 유무를, 의존성이 많은 코드부터 순차적으로 점검한 결과 정리.

**점검일**: 2026-02-02

---

## 1. 의존성 구조 요약

### 1.1 Backend (의존도 높은 순)

| 순서 | 파일 | 의존하는 내부 모듈 | 비고 |
|------|------|---------------------|------|
| 1 | **router.py** | service, load_service, db_load_service, schema_infer, transform_rules_service | API 진입점. prefix /api/etl |
| 2 | **load_service.py** | service, schema_infer, transform_engine, transform_rules_service | 파일 적재 파이프라인 |
| 3 | **db_load_service.py** | service, transform_engine, transform_rules_service | DB 적재 파이프라인 |
| 4 | **transform_rules_service.py** | service | etl_transform_rules CRUD |
| 5 | **service.py** | (런타임) Backend.api_server.db | 시스템 DB 전용 |
| 6 | **transform_engine.py** | pandas만 | 변환 룰 적용, etl_server 내부 의존 없음 |
| 7 | **schema_infer.py** | pandas만 | 스키마 추론, etl_server 내부 의존 없음 |

### 1.2 Frontend

| 파일 | 의존 |
|------|------|
| ETLPage.jsx | etlRunTable, SourceTypeSelector, FileUploadForm, DbConnectionForm, ETLTableList, JobLogPanel, etl.css |
| FileUploadForm.jsx | etlUploadFile |
| DbConnectionForm.jsx | etlListConnections, etlCreateConnection, etlTestConnection, etlListConnectionTables, etlCreateTable |
| ETLTableList.jsx | etlListTables |
| JobLogPanel.jsx | 없음(프레젠테이션) |
| SourceTypeSelector.jsx | 없음(프레젠테이션) |
| shared/api/client.js | GET/POST /api/etl/* (etlListTables, etlCreateTable, etlUploadFile, etlRunTable, etlListConnections, etlCreateConnection, etlTestConnection, etlListConnectionTables, etlListTransformRules) |

---

## 2. 백엔드 순차 점검 결과

### 2.1 router.py

- **엔드포인트 ↔ 서비스 호출**
  - `GET /tables` → `etl_service.list_etl_tables()` → `{"tables": rows}` ✓
  - `POST /tables` → `etl_service.create_etl_table(connection_id, target_table, description, created_by, source_table, file_type, file_path, pk_columns, incremental_column, sync_mode)` ✓
  - `POST /upload` → `_save_upload`, `schema_infer.infer_schema(file_path, file_type)`, `get_or_create_file_connection`, `create_etl_table` (파일용, pk/sync 미전달) ✓
  - `POST /connections` → `etl_service.create_connection(...)` ✓
  - `GET /connections` → `etl_service.list_connections()` ✓
  - `POST /connections/test` → `etl_service.test_connection(connection_id, host, port, database_name, username, password)` ✓
  - `GET /connections/{connection_id}/tables` → `etl_service.list_source_tables(connection_id)` → `{"tables": [...]}` ✓
  - `GET /tables/{etl_table_id}/transform-rules` → `transform_rules_svc.list_transform_rules(etl_table_id)` → `{"rules": rows}` ✓
  - `POST /transform-rules` → `transform_rules_svc.create_transform_rule(...)` ✓
  - `PUT /transform-rules/{rule_id}` → `transform_rules_svc.update_transform_rule(rule_id, ...)` ✓
  - `DELETE /transform-rules/{rule_id}` → `transform_rules_svc.delete_transform_rule(rule_id)` ✓
  - `POST /tables/{etl_table_id}/run` → `get_etl_table` 후 `source_type`에 따라 `load_service.run_file_load` 또는 `db_load_service.run_db_load` ✓
- **수정 사항**: `run_table_load`에서 `if not row` 시 `raise HTTPException(404)`가 `except Exception`에 걸려 500으로 바뀌는 문제를 막기 위해 **`except HTTPException: raise`** 를 `except ValueError` 앞에 추가함.

### 2.2 service.py

- **시스템 DB**: `_get_db()` → `Backend.api_server.db`, `_schema()` → `get_system_table_schema()`, 모든 메타 조회·갱신은 `get_db_connection_system()` 사용 ✓
- **테이블**: `_q(schema, "etl_connections")`, `"etl_tables"`, `"etl_jobs"` 사용. 시스템 DB에 동일 스키마·테이블 필요 ✓
- **함수 시그니처**: router/load_service/db_load_service/transform_rules_service에서 호출하는 인자와 일치 ✓
- **get_connection_for_etl**: `encrypted_password` 포함 반환. db_load_service에서 `_connect_postgres(..., c.get("encrypted_password"))` 사용 ✓

### 2.3 load_service.py

- **run_file_load**: `get_etl_table` → `_read_file` → 컬럼 정규화 → `list_transform_rules` → `transform_engine.apply_rules` → 스키마는 변환 후 `df.columns` + `schema_infer._dtype_to_inferred`로 생성 → 메인 DB DROP/CREATE/INSERT → `add_allowed_table`, `update_job`, `update_etl_table_status` ✓
- **메인 DB**: `api_db.get_table_schema()`, `api_db.get_db_connection()` ✓
- **에러/성공 시**: job 상태·etl_tables.status 갱신, 커서/연결 finally에서 정리 ✓

### 2.4 db_load_service.py

- **run_db_load**: `get_etl_table` → `get_connection_for_etl` → `_get_source_connection`(service._connect_postgres) → `_fetch_source_columns` → SELECT(Full/Incremental 분기) → DataFrame화 → `list_transform_rules` → `apply_rules` → 메인 DB Full( DROP+CREATE+INSERT ) 또는 Incremental(테이블 없으면 UNIQUE 포함 CREATE, Upsert) → `update_last_synced_at`(증분 시) → `add_allowed_table`, job/status 갱신 ✓
- **_connect_postgres 인자**: `(host, port, database_name, user, password)` 순서로 service._connect_postgres 호출 ✓
- **list_source_tables 반환**: `table_schema`, `table_name` 키. 프론트 소스 테이블 옵션과 일치 ✓

### 2.5 transform_rules_service.py

- **시스템 DB**: `etl_transform_rules` 테이블 사용. `_get_db()`, `_schema()`, `_q()` 는 service 경유 ✓
- **create_transform_rule**: target_column None이면 source_column과 동일, rule_type 화이트리스트 ✓
- **update_transform_rule**: 전달된 필드만 갱신, params 없으면 return ✓
- **list 반환**: rule_config 등 dict. transform_engine.apply_rules에서 dict/str(JSON) 모두 처리 ✓

### 2.6 transform_engine.py

- **apply_rules**: rules 순서대로 is_active만 적용, source_column 없으면 스킵, target_column에 저장 ✓
- **rule_type**: cleansing, type_cast, code_map, derived, masking 각각 config 구조와 동작 일치 ✓

### 2.7 schema_infer.py

- **infer_schema(file_path, file_type)**: router/upload에서 호출. 반환 `[{ name, inferred_type }]` ✓
- **_dtype_to_inferred**: load_service에서 변환 후 컬럼 dtype → PostgreSQL 타입 매핑용으로 사용 ✓

### 2.8 api_server main.py

- **etl 라우터**: `from Backend.etl_server import router as etl_router`, `app.include_router(etl_router)` 확인 ✓

---

## 3. 프론트엔드 순차 점검 결과

### 3.1 shared/api/client.js

- **baseUrlForEtl / request**: 동일 `getApiBase()` 기반. ETL JSON API는 `request()`, 업로드만 `fetch` + FormData ✓
- **에러 메시지**: `etlUploadFile`에서 FastAPI `detail`(문자열·배열) 파싱 후 Error 메시지로 통일 ✓
- **엔드포인트**: GET/POST 경로가 백엔드 prefix `/api/etl` 및 라우트와 일치 ✓

### 3.2 ETLPage.jsx

- **소스 유형**: `sourceType === 'file'` → FileUploadForm, `'db'` → DbConnectionForm ✓
- **목록 갱신**: `onSuccess={handleRefresh}` → `refreshKey` 변경 → ETLTableList의 `refreshing`으로 전달 ✓
- **실행**: `handleRun(etlTableId)` → `etlRunTable(etlTableId)` → 결과를 `lastRunResult`에 저장 → JobLogPanel에 전달 ✓

### 3.3 FileUploadForm.jsx

- **업로드**: FormData에 file, target_table, description, created_by. `etlUploadFile(form)` ✓
- **응답**: result.columns, result.etl_table_id 표시. 백엔드 upload 응답 구조와 일치 ✓

### 3.4 DbConnectionForm.jsx

- **연결 등록**: `etlCreateConnection({ ...newConn, source_type: 'postgresql' })`. schema_name은 newConn/defaultConn에 포함 ✓
- **테스트**: `etlTestConnection({ host, port, database_name, username, password })` ✓
- **ETL 테이블 등록**: `etlCreateTable({ connection_id, target_table, description, source_table, pk_columns, sync_mode, created_by })`. incremental_column 미전달은 백엔드 Optional과 일치 ✓
- **소스 테이블 옵션**: `res.tables`의 `table_schema`, `table_name` 사용 ✓

### 3.5 ETLTableList.jsx

- **목록**: `etlListTables()` → `res.tables` ✓
- **실행 버튼**: file 유형은 file_path 또는 file_type, db 유형은 source_table 존재 시에만 실행 버튼 노출 ✓

### 3.6 JobLogPanel.jsx

- **lastRunResult**: job_id(null 가능), status, rows_processed, error_message. job_id null 시 항목 비표시 ✓

### 3.7 App.jsx

- **라우트**: `/etl` → ETLPage, 네비 링크 to="/etl" ✓

---

## 4. 수정·보완 사항

| 구분 | 파일 | 내용 |
|------|------|------|
| 수정 | Backend/etl_server/router.py | `run_table_load`에서 404 응답이 500으로 덮이지 않도록 `except HTTPException: raise` 추가 |

---

## 5. 전제 조건 (운영 시 확인)

- **시스템 DB**: config `backend.system_db` 설정 및 시스템 DB에 `etl_connections`, `etl_tables`, `etl_jobs`, `etl_transform_rules` 테이블 존재 (08_ETL_Phase_Implement_Guide.md §5.1 DDL 적용).
- **메인 DB**: `backend.db_name` / `table_schema` 사용. 적재 대상 스키마·테이블 화이트리스트는 `add_allowed_table`로 등록됨.
- **업로드 디렉터리**: `Backend/etl_server/uploads` 존재(또는 첫 업로드 시 생성). 3일 초과 파일은 cleanup-expired-uploads 또는 업로드 시 정리.

---

## 6. 결론

- **연결 관계**: Backend etl_server ↔ api_server.db(시스템/메인 DB), Frontend etl 패키지 ↔ shared/api/client ETL API 경로·body·응답 구조가 일치함.
- **로직**: 파일 적재(정규화→변환→CREATE/INSERT), DB 적재(Full/Incremental, 변환 적용), 변환 룰 CRUD·적용 순서가 설계대로 동작하도록 연결됨.
- **이상 유무**: HTTPException 재발생 처리 반영 후, 의존 관계 및 로직 이상 없음으로 정리함.

---

## 7. 갱신 이력 (추가 점검)

| 일자 | 내용 |
|------|------|
| 2026-02-02 | §2·§3 기준으로 router→service→load_service→db_load_service→transform_rules_service→transform_engine→schema_infer 순으로 한 줄씩 의존 호출 검증. router 모듈 docstring을 Phase 1~5 엔드포인트 목록으로 보강. 추가 로직 이상 없음 확인. |
