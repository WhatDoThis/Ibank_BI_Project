# 백엔드 코드 학습 흐름도

**목적**: 코드 리뷰를 위해 백엔드(api_server, etl_server) 구조를 파악하고, **의존도가 낮은 파일부터** 읽는 학습 순서를 제시합니다.  
**대상**: Backend/api_server, Backend/etl_server (Python). Env/config는 설정 로드만 다룹니다.

---

## 1. 학습 흐름 요약

1. **설정·DB 기반** → Env, api_server/db (진입 시 필수).
2. **내부 의존 0** → pluralize, join_path, join_metrics, schemas, etl_limits, schema_infer, transform_engine.
3. **내부 의존 1** → dependencies, dashboard_service, analysis_store, service(etl).
4. **관계·JOIN** → relationship_inference(pluralize 사용), transform_rules_service(service 사용).
5. **라우터·서비스** → health, dashboard, dashboard2, report(가장 의존 많음), load_service, db_load_service, preview_service.
6. **큐·진입** → queue_worker, etl_server/router, main.

---

## 2. 파일별 의존도 수치

**의존도**: 해당 파일이 **import하는 Backend/Env 내부 모듈 개수**. 0이면 가장 먼저 읽기 좋고, 숫자가 클수록 나중에 읽는 것이 좋습니다.

### 2.1 api_server

| 파일 | 내부 의존 수 | 의존 모듈 | 역할 한 줄 |
|------|--------------|-----------|------------|
| **db.py** | 1 | Env.config | PostgreSQL 연결(비즈니스·시스템 DB), get_connection, get_db_config, get_allowed_tables, get_db_connection_system |
| **pluralize.py** | 0 | — | 테이블명 복수형·부모 테이블 추론(find_parent_table, pluralize). 표준 라이브러리만 사용 |
| **join_path.py** | 0 | — | JOIN 순서 결정(determine_join_order, validate_join_order). collections.deque 등 |
| **join_metrics.py** | 0 | — | JOIN 점수(confidence_to_score, join_accuracy_score), 파생 테이블 컬럼(derived_table_columns) |
| **schemas.py** | 0 | — | Pydantic 요청 스키마(DescribeTableRequest, ExecuteQueryRequest, DashboardDataRequest 등) |
| **dependencies.py** | 1 | db | get_db, get_config (FastAPI 의존성 주입) |
| **dashboard_service.py** | 1 | db | 대시보드1·2 집계 비즈니스 로직. db만 사용 |
| **analysis_store.py** | 1 | db | save-query-as-table 백그라운드 저장·상태 조회. db 사용 |
| **relationship_inference.py** | 1 | pluralize | FK·컬럼명 기반 관계 추론(infer_relationships). pluralize 사용 |
| **routers/health.py** | 2 | db, dependencies | GET /, /api, /api/, /health |
| **routers/dashboard.py** | 2 | dashboard_service, schemas | POST/GET /api/dashboard/* (data, filter-options, tables, required-columns, chart-data) |
| **routers/dashboard2.py** | 2 | dashboard_service, schemas | POST/GET /api/dashboard2/* |
| **routers/report.py** | 8 | db, analysis_store, Env.config.loader, relationship_inference, dependencies, join_path, join_metrics, schemas | list-tables, describe-table, execute-query, explain-sql, join-order, save-query-as-table 등 |
| **main.py** | 4 | db, routers(4), etl_router | FastAPI 앱·CORS·라우터 등록·ETL 워커 startup·uvicorn |

- **routers/__init__.py**, **api_server/__init__.py**: 재export만 하므로 학습 순서에서 제외(필요 시 main 직전에 라우터 목록만 확인).

### 2.2 etl_server

| 파일 | 내부 의존 수 | 의존 모듈 | 역할 한 줄 |
|------|--------------|-----------|------------|
| **etl_limits.py** | 1 | Env.config | get_etl_limits (max_file_size_mb, max_rows_per_load, max_batch_size). 함수 내부에서 Env 로드 |
| **schema_infer.py** | 0 | — | 파일 스키마 추론(infer_schema). pandas, openpyxl, pyarrow |
| **transform_engine.py** | 0 | — | 변환 룰 적용(apply_rules). pandas만 사용 |
| **service.py** | 1 | api_server.db(지연 로드) | ETL 메타 CRUD(connections, tables, jobs), list_source_tables, test_connection, 외부 DB 연결(PostgreSQL/MySQL/Oracle) |
| **transform_rules_service.py** | 1 | service | etl_transform_rules CRUD. service만 사용 |
| **load_service.py** | 5 | schema_infer, service, transform_engine, transform_rules_svc, etl_limits | 파일 적재(run_file_load, run_file_upsert). 파싱·변환·메인 DB DROP/CREATE/INSERT |
| **db_load_service.py** | 4 | service, transform_engine, transform_rules_svc, etl_limits | DB 적재(run_db_load). PostgreSQL/MySQL Full·Incremental |
| **preview_service.py** | 2 | schema_infer, service | 미리보기(파일·DB 10행) |
| **queue_worker.py** | 3 | service, load_service, db_load_service(지연 로드) | pending Job 선점·실행, 동시 2건 제한, _run_one_job 분기 |
| **router.py** | 6 | db_load_service, load_service, preview_service, schema_infer, service, transform_rules_svc | /api/etl 진입. connections, tables, jobs, upload, run, add-file, add-files-zip 등 |
| **__init__.py** | 1 | router | router 재export |

---

## 3. 권장 학습 순서 (의존도 오름차순)

아래 순서대로 읽으면, 이미 읽은 모듈만 참조하게 되어 흐름이 자연스럽습니다.

### 3.1 1단계: 의존 0 (설정·표준/외부만)

| 순서 | 경로 | 비고 |
|------|------|------|
| 1 | Env/config/loader.py, config.json.example | 설정 로드 방식(선택) |
| 2 | Backend/api_server/pluralize.py | 복수형·부모 테이블 |
| 3 | Backend/api_server/join_path.py | JOIN 순서 |
| 4 | Backend/api_server/join_metrics.py | JOIN 점수·파생 컬럼 |
| 5 | Backend/api_server/schemas.py | 요청 스키마 |
| 6 | Backend/etl_server/schema_infer.py | 파일 스키마 추론 |
| 7 | Backend/etl_server/transform_engine.py | 변환 룰 적용 |

### 3.2 2단계: 의존 1

| 순서 | 경로 | 비고 |
|------|------|------|
| 8 | Backend/api_server/db.py | DB 연결(비즈니스·시스템) |
| 9 | Backend/api_server/dependencies.py | get_db, get_config |
| 10 | Backend/api_server/dashboard_service.py | 대시보드 집계 |
| 11 | Backend/api_server/analysis_store.py | 쿼리 결과 테이블 저장 |
| 12 | Backend/etl_server/etl_limits.py | ETL 한도 |
| 13 | Backend/etl_server/service.py | ETL 메타·연결 테스트·list_source_tables |
| 14 | Backend/etl_server/transform_rules_service.py | 변환 룰 CRUD |

### 3.3 3단계: 의존 2

| 순서 | 경로 | 비고 |
|------|------|------|
| 15 | Backend/api_server/relationship_inference.py | 관계 추론 |
| 16 | Backend/api_server/routers/health.py | 헬스 체크 |
| 17 | Backend/api_server/routers/dashboard.py | 대시보드1 API |
| 18 | Backend/api_server/routers/dashboard2.py | 대시보드2 API |
| 19 | Backend/etl_server/preview_service.py | ETL 미리보기 |

### 3.4 4단계: 의존 3 이상 (서비스·라우터)

| 순서 | 경로 | 비고 |
|------|------|------|
| 20 | Backend/etl_server/load_service.py | 파일 적재 |
| 21 | Backend/etl_server/db_load_service.py | DB 적재 |
| 22 | Backend/etl_server/queue_worker.py | Job 큐 워커 |
| 23 | Backend/api_server/routers/report.py | 리포트 API(의존 최다) |
| 24 | Backend/etl_server/router.py | ETL API |
| 25 | Backend/api_server/main.py | 앱 진입·라우터 등록·워커 startup |

---

## 4. 학습 흐름도 (텍스트)

```
[설정]
  Env/config
       │
       ▼
[DB·의존성 0]
  db.py ◄── dependencies.py
  pluralize.py ◄── relationship_inference.py
  join_path.py ──┐
  join_metrics.py ──┼──► routers/report.py
  schemas.py ──────┘     dashboard_service.py ──► routers/dashboard.py, routers/dashboard2.py
                         analysis_store.py ──────► routers/report.py
                                                         │
  routers/health.py ─────────────────────────────────────┤
                                                         ▼
                                                    main.py
[ETL 의존 0]
  schema_infer.py ──┐
  transform_engine.py ──┼──► load_service.py ──┐
  etl_limits.py ────────┘                      │
  service.py ◄── transform_rules_service.py   ├──► queue_worker.py
       │              │                        │
       │              └────────────────────────┼──► db_load_service.py
       │                                        │
       └──► preview_service.py ◄────────────────┘
       │
       └──► router.py (etl) ────────────────────────────► main.py
```

---

## 5. 설치·구현 기능과의 대응

| 기능 영역 | 관련 파일 | 구현 요약 |
|-----------|-----------|-----------|
| **리포트 API** | routers/report.py, db, analysis_store, relationship_inference, join_path, join_metrics, schemas | 테이블 목록·구조·관계·JOIN 순서·쿼리 실행·Claude 해석·save-query-as-table |
| **대시보드1·2 API** | routers/dashboard.py, dashboard2.py, dashboard_service.py, schemas | data, filter-options, tables, required-columns, chart-data |
| **ETL 메타·연결** | etl_server/service.py, router.py | connections CRUD·테스트·list_source_tables(PostgreSQL/MySQL/Oracle) |
| **ETL 파일 적재** | load_service.py, schema_infer, transform_engine, transform_rules_service, etl_limits | CSV/Excel/Parquet 파싱·변환·DROP/CREATE/INSERT·upsert |
| **ETL DB 적재** | db_load_service.py, service, transform_engine, transform_rules_svc, etl_limits | Full/Incremental, PostgreSQL·MySQL |
| **ETL 미리보기·Job** | preview_service.py, queue_worker.py, service | 10행 미리보기, pending→running·동시 2건 |
| **앱 진입** | main.py | FastAPI·CORS·라우터·ETL 워커 startup |

---

## 6. 참고

- **의존 수**는 코드 상 `from Backend.*` / `from Env.*` 기준으로만 셌습니다. 동적 import(예: queue_worker 내부의 load_service, db_load_service)도 포함했습니다.
- **__init__.py**는 재export만 있으면 리뷰 시 생략해도 됩니다.
- 코드 리뷰 시: 1단계 → 2단계 → 3단계 → 4단계 순으로 보면, 각 파일이 참조하는 모듈은 이미 읽은 상태가 됩니다.
