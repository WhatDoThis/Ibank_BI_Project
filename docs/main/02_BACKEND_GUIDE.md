# 백엔드 개발 가이드

본 문서는 **docs/main** 내 백엔드 전용 명세입니다. 구현 위치: `Backend/api_server`, `Backend/etl_server`.  
**목적**: 백엔드 구조·기술 스택·API·설정·모듈 역할을 정리한 가이드.  
(Flask → FastAPI 전환 계획은 **부록 A**에 참고용으로 둠.)

---

## 1. 백엔드 개요

### 1.1 역할

- **FastAPI** 기반 REST API 서버. 리포트(쿼리 빌더)·대시보드1·대시보드2·**ETL** 용 API 제공.
- **PostgreSQL** 연동: 비즈니스 DB(리포트·대시보드·allowed_tables), 선택 시 **시스템 DB**(ETL 메타·etl_connections, etl_tables, etl_jobs 등).
- **CORS** 허용. 쿼리 실행 시 SELECT만 허용, 금지 키워드 문맥 검사(SELECT 문장 제외).
- **실행**: `python run.py back` → config.backend.api_host/api_port(기본 5001), uvicorn 기동. ETL Job 큐 워커는 startup 시 백그라운드 기동(pending → running, 동시 2건 제한).

### 1.2 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | FastAPI | 라우터·의존성·자동 검증 |
| 서버 | uvicorn | ASGI |
| DB | PostgreSQL | psycopg2 (비즈니스·시스템 DB), PyMySQL(ETL MySQL 소스), oracledb(ETL Oracle 소스) |
| 설정 | Env/config/config.json | .env 미사용, config.backend / config.frontend |

### 1.3 실행 방식

- **로컬**: `python run.py back` → API 서버만 기동.
- **배포**: 루트 **deploy.sh** 사용(빌드 + report-api/report-front 재시작). 상세는 docs/report/DEPLOY_SERVER.md.
- **접속**: API 베이스 URL은 config.frontend.api_base_url(예: 로컬 `http://localhost:5001`, 배포 `https://도메인/report_api`).

---

## 2. 아키텍처·디렉토리 구조

```
Backend/
├── api_server/                    # 리포트·대시보드 API
│   ├── main.py                    # FastAPI 앱·CORS·라우터 등록·예외 핸들러·ETL 워커 startup
│   ├── db.py                      # config.backend 기반 DB 연결(get_connection, get_db_config, get_allowed_tables, get_db_connection_system 등)
│   ├── dependencies.py            # get_db, get_config (요청 단위 주입)
│   ├── schemas.py                 # Pydantic 요청 스키마 (POST 바디 검증)
│   ├── dashboard_service.py      # 대시보드1·2 집계 비즈니스 로직
│   └── routers/
│       ├── health.py              # GET /, /api, /api/, /health
│       ├── report.py              # prefix /api — list-tables, describe-table, table-relationships, join-order, save-query-as-table, execute-query, explain-sql, get-column-values, query-stats
│       ├── dashboard.py           # prefix /api/dashboard — data, filter-options, tables, required-columns, chart-data
│       └── dashboard2.py           # prefix /api/dashboard2 — 동일
│
└── etl_server/                    # ETL API·메타·업로드·DB 적재·Job 큐
    ├── router.py                  # prefix /api/etl — connections, tables, jobs, preview, run, add-file, add-files-zip 등
    ├── service.py                 # 시스템 DB 메타 CRUD·Job 상태·list_source_tables(PostgreSQL/MySQL/Oracle)
    ├── load_service.py            # 파일 적재(파싱·변환·메인 DB DROP/CREATE/INSERT)
    ├── db_load_service.py         # DB 적재(PostgreSQL/MySQL Full·Incremental, Oracle Phase 3 예정)
    ├── preview_service.py         # 미리보기(파일·DB 10행)
    ├── queue_worker.py             # pending Job 선점·실행·동시 2건 제한
    ├── schema_infer.py            # 스키마 추론(pandas)
    ├── transform_engine.py        # 변환 룰 적용(pandas)
    ├── transform_rules_service.py # etl_transform_rules CRUD
    └── etl_limits.py              # max_file_size_mb, max_rows_per_load, max_batch_size 적용
```

- **라우터 등록 순서**: health → report → dashboard → dashboard2 → **etl_router**(Backend.etl_server.router).

---

## 3. 설정

### 3.1 config 로드

- **위치**: `Env/config/config.json` (또는 config.json.example 복사 후 수정).
- **로드**: `Env/__init__.py` → loader.load_config() → config.backend, config.frontend.
- **백엔드 사용**: main.py(api_host, api_port), db.py(db_host, db_port, db_name, db_user, db_password, allowed_tables, table_schema), report 라우터(query_timeout_seconds, claude_api_key, claude_api_url).

### 3.2 시스템 DB (ETL)

- **backend.system_db**: ETL 메타 저장용. db_name 예: `ibank_system_data`. db.get_db_connection_system(), get_system_table_schema() 사용.
- **메타 테이블** (시스템 DB에 4개 필수):

| 테이블 | 용도 |
|--------|------|
| **etl_connections** | 소스 연결 정보(연결명, source_type, host, port, database_name, schema_name, username, encrypted_password). |
| **etl_tables** | 작업 정의(connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, status, batch_size, batch_interval_seconds 등). |
| **etl_transform_rules** | 변환 룰(etl_table_id, source_column, target_column, rule_type, rule_config, apply_order, is_active). |
| **etl_jobs** | Job 이력(job_id, etl_table_id, status, started_at, finished_at, rows_processed, total_rows, error_message). |

- batch_size: DB 적재 시 한 번에 가져올 행 수. NULL/0이면 전체. batch_interval_seconds: 배치 간 대기(초). 0이면 대기 없음.

### 3.3 ETL 한도 (etl_limits)

- **backend.etl_limits**: 없으면 한도 미적용(0). config.json의 backend 안에 추가.

| 키 | 의미 | 기본(0) |
|----|------|---------|
| **max_file_size_mb** | 파일 적재 시 파일 크기 상한(MB). 초과 시 거부. | 검사 안 함 |
| **max_rows_per_load** | 1회 적재당 최대 행 수. 파일은 해당 행까지만 읽고, DB는 이 행 수까지만 가져와 적재. | 무제한 |
| **max_batch_size** | DB 적재 시 배치당 최대 행 수(사용자 batch_size 상한). 스트리밍 시 메모리 상한. | 사용자값 그대로 |

- **파일**: 크기 > max_file_size_mb 이면 실패. CSV는 max_rows_per_load만큼만 읽고, Excel/Parquet는 읽은 뒤 해당 행 수로 자름.
- **DB**: 사용자 batch_size가 있으면 min(사용자값, max_batch_size)로 배치. batch_size가 0이면 SELECT에 LIMIT max_rows_per_load 적용.

### 3.4 ETL 배치·실행 시점

- **배치 크기(batch_size)**: 한 번의 실행 안에서 소스에서 몇 행씩 가져올지. 0/NULL이면 전체 한 번에.
- **배치 간 대기(batch_interval_seconds)**: 한 번의 실행 안에서 배치마다 쉬는 시간(초). 소스 DB 부하 완화용.
- **매일 몇 시 자동 실행**: 미구현. 스케줄(cron/정해진 시각) 없음.
- **실행 시점**: 사용자가 "실행" 버튼을 눌렀을 때만 대기열(pending) 등록 → 워커가 실행. draft/done/error 여부와 관계없이 자동 실행 없음.

---

## 4. API 엔드포인트

### 4.1 health

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | / | 루트 안내 |
| GET | /api, /api/ | API 안내 |
| GET | /health | 헬스체크 |

### 4.2 report (prefix /api)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/list-tables | 테이블 목록 |
| POST | /api/describe-table | 테이블 구조 |
| GET | /api/table-relationships | JOIN 관계 |
| POST | /api/join-order | JOIN 순서 제안 |
| POST | /api/save-query-as-table | 쿼리 결과를 테이블로 저장 요청(백그라운드 큐) |
| GET | /api/save-query-as-table/status/{job_id} | 저장 작업 상태 조회 |
| POST | /api/execute-query | 쿼리 실행 |
| POST | /api/explain-sql | Claude SQL 해석 |
| POST | /api/get-column-values | 컬럼 고유값 |
| POST | /api/query-stats | 쿼리 통계 |

### 4.3 dashboard (prefix /api/dashboard)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | /api/dashboard/data | 대시보드1 집계 |
| GET | /api/dashboard/filter-options/{table_id} | 필터 옵션 |
| GET | /api/dashboard/tables | 테이블 목록 |
| GET | /api/dashboard/required-columns | 필수 컬럼 |
| POST | /api/dashboard/chart-data | 차트 데이터(단일 디멘션·메트릭, LIMIT 없음) |

### 4.4 dashboard2 (prefix /api/dashboard2)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | /api/dashboard2/data | 대시보드2 집계·KPI |
| GET | /api/dashboard2/filter-options/{table_id} | 필터 옵션 |
| GET | /api/dashboard2/tables | 테이블 목록 |
| GET | /api/dashboard2/required-columns | 필수 컬럼 |
| POST | /api/dashboard2/chart-data | 차트 데이터 |

### 4.5 ETL (prefix /api/etl)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /api/etl/connections | 연결 목록 |
| POST | /api/etl/connections | 연결 1건 등록 |
| POST | /api/etl/connections/test | 연결 테스트 |
| GET | /api/etl/connections/{id}/tables | 소스 DB 테이블 목록 |
| GET | /api/etl/tables | ETL 테이블 목록 |
| POST | /api/etl/tables | ETL 테이블 1건 등록 |
| PATCH | /api/etl/tables/{id} | ETL 테이블 설정 일부 갱신 |
| GET | /api/etl/tables/{id}/preview | 미리보기(10행) |
| POST | /api/etl/tables/{id}/run | 대기열 등록(실행) |
| POST | /api/etl/tables/{id}/add-file | 단일 파일 추가 적재 |
| POST | /api/etl/tables/{id}/add-files-zip | ZIP 다중 파일 추가 적재 |
| GET | /api/etl/jobs | Job 목록 |
| GET | /api/etl/jobs/{job_id} | Job 1건 조회(폴링) |
| POST | /api/etl/upload | 파일 업로드(multipart) |
| DELETE | /api/etl/tables/{id} | ETL 테이블 삭제 |
| POST | /api/etl/jobs/{job_id}/cancel | Job 취소 |

- 요청/응답 형식: JSON.

---

## 5. api_server 상세

### 5.1 main.py

- FastAPI 앱 생성, CORSMiddleware(allow_origins=["*"]), 라우터 등록(health, report, dashboard, dashboard2, etl_router).
- 예외: 404/500 → JSONResponse.
- startup: ETL queue_worker.start_background_worker() 호출(실패 시 무시).
- `__main__`: config.backend.api_host/api_port, uvicorn.run(app).

### 5.2 db.py

- **get_db_config()**, **get_allowed_tables()**, **get_connection()**: config.backend 기반 비즈니스 DB 연결.
- **get_db_connection_system()**, **get_system_table_schema()**: backend.system_db 기반 시스템 DB(ETL 메타).
- 프레임워크 무관(Flask/FastAPI 공통) 사용.

### 5.3 dependencies.py

- **get_db**: 요청 단위 DB 연결(컨텍스트 매니저).
- **get_config**: config 객체 주입.

### 5.4 schemas.py

- Pydantic 모델: 리포트·대시보드 POST 바디 검증(테이블 ID, 필터, 쿼리 등).

### 5.5 routers

- **health_router**: GET /, /api, /api/, /health.
- **report_router**: prefix=/api. list-tables, describe-table, table-relationships, join-order, save-query-as-table, execute-query, explain-sql, get-column-values, query-stats. execute-query 시 SELECT만 허용·금지 키워드 검사.
- **dashboard_router**: prefix=/api/dashboard. dashboard_service 호출, data, filter-options, tables, required-columns, chart-data.
- **dashboard2_router**: prefix=/api/dashboard2. 동일 구조.

### 5.6 dashboard_service.py

- 대시보드1·2 집계 비즈니스 로직. db만 사용(프레임워크 무관).

---

## 6. etl_server 상세

### 6.1 역할

- **router.py**: /api/etl API 진입. service, load_service, db_load_service, preview_service, schema_infer, transform_rules_service 호출.
- **service.py**: 메타 CRUD(connections, tables, jobs), list_source_tables(PostgreSQL/MySQL/Oracle 분기), 연결 테스트. **create_etl_table** 시 타겟 테이블명 중복 검사: etl_tables에 동일 target_table 있으면 거부; 메인 DB에 테이블 존재 시 **full** 모드만 거부, **incremental** 모드면 허용(파일로 만든 테이블에 DB 증분 ETL 추가 가능).
- **load_service.py**: 파일 적재 — get_etl_table → 파싱(CSV/Excel/Parquet) → 변환 룰 → 메인 DB DROP/CREATE/INSERT. 업로드 파일은 **3일** 초과 시 자동 삭제.
- **db_load_service.py**: DB 적재 — get_etl_table → 소스 연결 → Full(DROP+CREATE+INSERT) / Incremental(last_synced_at 이후 Upsert). PostgreSQL·MySQL 지원, Oracle은 Phase 3 예정.
- **preview_service.py**: 파일·DB 소스 미리보기(10행).
- **queue_worker.py**: pending Job 선점 → running, 동시 2건 제한, load_service/db_load_service 호출 후 completed/failed 갱신.

### 6.2 DB 지원 현황

| DB | 포트(기본) | 연결 테스트 | 소스 테이블 목록 | DB 적재(Full/Incremental) | 비고 |
|----|------------|------------|------------------|---------------------------|------|
| **PostgreSQL** | 5432 | ✅ | ✅ | ✅ | psycopg2. |
| **MySQL** | 3306 | ✅ | ✅ | ✅ | PyMySQL. TABLE_SCHEMA=DB명, backtick 인용. |
| **Oracle** | 1521 | ✅ | ✅ | 🔲 Phase 3 예정 | oracledb. **Service Name만** 지원(DSN host:port/서비스명, SID 미지원). 목록·미리보기·PK 자동 조회. list_source_tables: 스키마 미지정·PUBLIC이면 USER_TABLES(접속 사용자 소유만), 스키마 지정 시 ALL_TABLES 해당 OWNER. source_table 저장 형식 OWNER.TABLE_NAME. |

### 6.3 외부 DB 연결 구조·실패 시 점검

- **연결 경로**: 브라우저 → (HTTP) → **Backend API** → (TCP) → **외부 DB**. 브라우저는 외부 DB에 직접 연결하지 않음.
- **경유 IP**: 외부 DB(또는 방화벽) 로그에 찍히는 "연결 시도 클라이언트 IP" = **Backend가 실행 중인 호스트의 IP**. 로컬에서 run.py back 이면 그 PC의 IP, 서버에서 실행하면 그 서버의 IP.
- **연결 실패 시 점검 순서**: (1) Backend 실행 호스트 확인(그 IP가 외부 DB 입장의 클라이언트 IP). (2) Backend 터미널 로그 확인(ETL DB 연결 시도/실패 로그). (3) 외부 DB 서버: 방화벽 해당 포트(PostgreSQL 5432, Oracle 1521 등) 인바운드 허용·**Backend 호스트 IP** 허용, DB listen·접속 허용 설정. (4) Backend 호스트에서 해당 호스트:포트로 telnet/Test-NetConnection으로 연결 테스트.
- **실패 메시지 예**: 타임아웃(방화벽·포트 미개방), connection refused(DB 미실행·listen 확인), password authentication failed(인증), could not translate host(호스트명·DNS). service.py _connection_error_to_user_message()에서 사용자용 메시지 변환. 연결 타임아웃 15초(connect_timeout). **Oracle**: Service Name만 지원(JDBC @호스트:1521/서비스명 형태). 3306은 MySQL 포트이므로 PostgreSQL 연결 시 5432 사용.

### 6.4 Job 확인 방법 (운영)

- **터미널 로그**(python run.py back): `ETL file load started etl_table_id=... job_id=...` / `ETL db load started ...` → 시작. `ETL file/db load completed job_id=... rows_processed=...` → 성공. `ETL file/db load failed job_id=...` → 실패(traceback 확인). "started"만 있고 completed/failed 없으면 실행 중 또는 워커 예외.
- **시스템 DB**: etl_jobs에서 job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message. status='running'이고 finished_at NULL이면 실행 중 또는 미갱신. status='failed'면 error_message 확인.
- **파일 적재**: etl_tables.file_path 경로 존재 여부(3일 지나면 정리로 삭제). 메인 DB target_table 존재·건수 확인.
- **DB 적재**: POST /api/etl/connections/test로 소스 연결 확인. incremental 모드면 pk_columns 필수.
- **running으로 멈춘 Job 수동 정리**: etl_jobs에서 해당 job_id를 status='failed', finished_at=NOW(), error_message='수동 종료'로 UPDATE. 필요 시 etl_tables 해당 행 status='error'로 UPDATE.

### 6.5 재실행 시 동작

| 소스 | sync_mode | 재실행 시 동작 |
|------|-----------|----------------|
| **파일** | - | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **full** | DROP → CREATE → 전체 INSERT. **전체 교체.** |
| **DB** | **incremental** | 테이블 유지. last_synced_at 이후만 조회 후 **Upsert.** |

### 6.6 모듈 의존

| 순서 | 파일 | 역할 |
|------|------|------|
| 1 | router.py | /api/etl 진입, service·load_service·db_load_service·preview_service·schema_infer·transform_rules 호출 |
| 2 | load_service.py | 파일 적재 |
| 3 | db_load_service.py | DB 적재(PostgreSQL·MySQL, Oracle 예정) |
| 4 | transform_rules_service.py | etl_transform_rules CRUD |
| 5 | service.py | 시스템 DB 메타·Job·list_source_tables |
| 6 | transform_engine.py | 변환 룰 적용(pandas) |
| 7 | schema_infer.py | 스키마 추론(pandas) |

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 |
| 02_BACKEND_GUIDE.md | 백엔드 구조·기술 스택·API·설정·etl_server 가이드 명세 (본 문서) |

- docs/report: 배포·실행 로그 등. 대외 소개 시에는 본 docs/main 문서만 사용.

---

## 부록 A. Flask → FastAPI 전환 계획 (참고)

아래는 과거 **마이그레이션 계획** 요약. 전환은 완료된 상태이며, 구조 이해·롤백 시 참고용.

### A.1 목적·원칙

- **목적**: Flask 기반 Backend API를 FastAPI로 전면 교체.
- **상태**: **전환 완료**. 상세 로그는 docs/report/log.md 참고.
- **원칙**: config 로드 방식 유지, 프론트 영향 최소화, 의존성 낮은 파일부터 순차 적용.

### A.2 파일별 의존성 (전환 후 구조)

| 순서 | 파일 | 비고 |
|------|------|------|
| 1 | db.py | Env.config, psycopg2 |
| 2 | dashboard_service.py | db만 사용 |
| 3 | dependencies.py | get_db, get_config |
| 4 | schemas.py | Pydantic |
| 5 | routers/ | health, report, dashboard, dashboard2 |
| 6 | main.py | FastAPI, CORS, 라우터, uvicorn |

### A.3 Phase 요약

| Phase | 대상 | 내용 |
|-------|------|------|
| 0 | 계획서 | 문서 작성 |
| 1 | db.py, Env | 설정·DB 검증 |
| 2 | dashboard_service.py | 변경 없음 |
| 3 | routes.py | Flask → FastAPI APIRouter, 동일 경로·응답 |
| 4 | main.py | FastAPI 앱·CORS·라우터·uvicorn |
| 5 | run.py | 의존성 오류 시 fastapi/uvicorn 안내 |
| 6 | requirements.txt | flask 제거, fastapi·uvicorn 추가 |
| 7 | README, docs/main | Flask → FastAPI 문구 |
| 8 | 검수·report | 연동 테스트, log.md |

### A.4 롤백 시 참고

- Phase 3·4 완료 후 롤백: Git에서 main.py·routers/ 이전 커밋 복원, requirements.txt·run.py를 Flask 기준으로 되돌림.
