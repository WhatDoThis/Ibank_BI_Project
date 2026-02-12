# ETL 페이지 제작 Phase별 구현 가이드

**문서 목적**: 고객(웹앱 사용자)이 데이터를 업로드하거나 외부 DB를 연동해 **우리 PostgreSQL**에 적재하는 ETL 페이지의 Phase별 구현 계획 정리.  
**범위**: 파일 업로드(일회성)·DB 연동(배치·Upsert), 변환(T) 1차, 단일 페이지 UI, Backend `etl_server`, 다중 ETL 시 큐 관리. **실시간 스트리밍은 미구현.**

---

## 1. 문서 목적·범위

| 항목 | 내용 |
|------|------|
| **목적** | ETL 페이지 및 백엔드(`etl_server`)를 Phase 단위로 구현할 때 참고하는 개발 가이드. |
| **대상** | 개발자·구현 담당. 요구사항 검토는 완료된 상태를 전제로 함. |
| **범위** | 방식 1(파일 업로드 → 테이블 생성·적재), 방식 2(서버 DB 등록 → 배치 CDC·Upsert), 변환(T) 1차(클렌징·타입·매핑·파생·마스킹), 단일 ETL 페이지, Job 큐. |
| **미포함** | 실시간 스트리밍, 변환 2차(조인·피벗·SCD Type 2 등)는 별도 Phase 또는 추후 확장. |

---

## 2. 요구사항 정리

| # | 요지 | 상세 |
|---|------|------|
| 1 | **고객 업로드/설정** | 웹앱 사용자가 ETL 페이지에서 본인 데이터를 업로드·설정. **테이블명**, **설명** 입력. |
| 2-1 | **방식 1: 파일 업로드** | CSV, Excel, Parquet 등 데이터 파일 업로드 → 우리 DB에 **테이블 생성 및 적재**. **일회성**. |
| 2-2 | **방식 2: 서버 DB 연동** | 외부 DB 등록 후 해당 DB의 테이블·데이터 연동. 지원 DB(1차 이후 확장): PostgreSQL, Snowflake, BigQuery, Oracle, MSSQL(Maria). **배치성 CDC** → **Upsert** 적재. |
| 2-3 | **실시간** | 실시간 스트리밍은 **구현하지 않음**. |
| 4 | **변환(T)** | 우리 PostgreSQL에 맞게 **필요한 변환만 선별** 적용. 1차: 클렌징, 타입 변환, 코드 매핑, 단순 파생 컬럼, 마스킹(선택). 2차: 집계/조인/피벗/SCD 등은 추후. |
| 5 | **화면** | **페이지 1개**, 패키지명 `etl`. 컴포넌트는 기능별로 분리. **파일 업로드 / DB 설정** 중 선택 시 그에 맞는 UI만 노출. |
| 6 | **Backend** | Backend 하위 **별도 `etl_server`** 폴더로 ETL 전용 백엔드 구성. |
| 7 | **다중 ETL·큐** | 여러 ETL이 등록된 경우 **큐 관리** 정의(순차 또는 동시 실행 수 제한, Job 상태·재시도 등). |

---

## 3. 시스템 개요·아키텍처

### 3.1 전체 흐름

```
[소스] ──┬── 파일(CSV/Excel/Parquet) ──▶ [업로드] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
         │
         └── 외부 DB(PostgreSQL 등) ────▶ [추출 E] ──▶ [변환 T] ──▶ [우리 PostgreSQL]
```

- **E(Extract)**: 파일 파싱 또는 외부 DB에서 SELECT.
- **T(Transform)**: 클렌징, 타입 변환, 매핑, 파생, 마스킹(1차 범위).
- **L(Load)**: 우리 PostgreSQL에 INSERT(일회성) 또는 Upsert(배치).

### 3.2 Backend `etl_server`

- **위치**: 프로젝트 내 `Backend/etl_server/` (또는 `Backend/api_server` 하위 `etl` 모듈로 통합 가능. 본 문서는 별도 폴더 전제).
- **역할**: ETL 메타(연결 정보·테이블명·설명) 저장, 파일 업로드 수신, 파싱·스키마 추론, 테이블 생성·적재, 외부 DB 연결·추출·Upsert, Job 큐·상태 관리.
- **DB**: 우리 PostgreSQL에 `etl_*` 메타 테이블(연결, 작업 정의, Job 이력) 사용.

### 3.3 Frontend `packages/etl`

- **위치**: `Frontend/react-app/src/packages/etl/`.
- **역할**: 단일 ETL 페이지. 소스 유형 선택(파일 / DB) → 선택에 따라 파일 업로드 폼 또는 DB 연결·테이블 선택 폼 표시. 테이블명·설명 입력, 등록된 ETL 목록, Job 실행·큐·로그 표시.

### 3.4 큐·Job 정책

- **Job 상태**: 대기(pending), 실행중(running), 완료(completed), 실패(failed).
- **실행**: 순차(1개씩) 또는 동시 실행 수 상한(예: 2개). DB 테이블로 Job 등록·상태 갱신, 워커(또는 API 요청 시 동기/비동기)가 처리.
- **재시도**: 실패 시 재시도 횟수·간격은 정책으로 정의(예: 최대 2회).

---

## 4. 전제 조건·제약

| 항목 | 내용 |
|------|------|
| **지원 파일** | CSV, Excel(.xlsx/.xls), Parquet. 인코딩(CSV): UTF-8 우선, 필요 시 사용자 지정. |
| **1차 지원 DB** | **PostgreSQL** 간 연동으로 파이프라인·큐 검증. Snowflake/BigQuery/Oracle/MSSQL(Maria)는 추후 커넥터 확장. |
| **변환 1차** | 클렌징(TRIM, NULL 처리), 타입 변환(문자→날짜/숫자), 코드 매핑(키→값), 단순 파생 컬럼, 마스킹(선택). |
| **파일 크기·타임아웃** | 업로드 파일 크기 상한(예: 50~100MB), 처리 타임아웃 설정. 초과 시 청크 처리 또는 백그라운드 Job으로 분리. |
| **보안** | 외부 DB 연결 정보(비밀번호 등)는 암호화 저장. API는 웹앱 인증(세션/토큰) 연동. |

### 4.1 config 구분 (시스템 DB 분리)

리포트/대시보드용 DB와 **시스템용 DB가 다르게** 운영된다. 호스트·포트·계정은 동일하고 **DB명만** 구분한다.

- **backend.db_name**: 리포트·대시보드·allowed_tables 등 **비즈니스 데이터**용 DB.
- **backend.system_db**: **시스템 관련 테이블**용 DB. DB명 `ibank_system_data`. ETL 메타(`etl_connections`, `etl_tables`, `etl_transform_rules`, `etl_jobs`)를 비롯해 추후 로그인·세션·프로젝트 등도 이 DB에 둘 예정. 현재는 ETL용으로만 사용.

**config.json / config.json.example 예시**

```json
"backend": {
  "db_host": "호스트",
  "db_port": 5432,
  "db_name": "리포트·대시보드용_DB명",
  "db_user": "계정",
  "db_password": "비밀번호",
  "table_schema": "public",
  "system_db": {
    "db_host": "동일_호스트",
    "db_port": 5432,
    "db_name": "ibank_system_data",
    "db_user": "동일_계정",
    "db_password": "동일_비밀번호",
    "table_schema": "public"
  }
}
```

**백엔드에서 사용**

- 리포트/대시보드 등 기존 로직: `db.get_db_connection()` → `config.backend` 의 DB 사용.
- ETL 메타·기타 시스템 테이블: `db.get_system_db_config()`, `db.get_db_connection_system()`, `db.get_system_table_schema()` 사용. (`Backend/api_server/db.py` 에 정의됨.)

---

## 5. Phase 0: 사전 작업

**목표**: ETL 개발을 위한 폴더·스키마·의존성 준비.

| 작업 | 내용 |
|------|------|
| **0.1 폴더 생성** | `Backend/etl_server/` 생성. (또는 기존 `api_server`에 `routers/etl`, `services/etl` 등으로 모듈 추가.) |
| **0.2 메타 DB 테이블 설계** | 우리 PostgreSQL에 ETL 메타 저장용 테이블. 예: `etl_connections`(연결 정보, 소스 유형 file/db), `etl_tables`(테이블명, 설명, 연결 ID, 타겟 스키마), `etl_jobs`(job_id, 상태, 시작/종료 시각, 에러 메시지), `etl_transform_rules`(Phase 4 변환 룰). **DDL은 아래 §5.1에 적용 완료본으로 수록.** |
| **0.3 의존성** | Backend: pandas, openpyxl, pyarrow(Parquet), psycopg2(이미 사용 시 생략). DB 커넥터(추후): snowflake-connector-python 등. |
| **0.4 프론트 패키지** | `Frontend/react-app/src/packages/etl/` 폴더 및 진입점 `index.jsx`, 라우트 등록용 준비. |

**산출물**: 빈 `etl_server` 구조, 메타 테이블 DDL, etl 패키지 폴더.

### 5.1 ETL 메타 테이블 DDL (적용 완료)

아래 DDL은 **우리 시스템 DB(PostgreSQL)에 이미 적용된 상태**이다. 로그 테이블(`etl_jobs`)은 별도 정의·적용.

```sql
-- ============================================================
-- 1. ETL 소스 연결 정보
-- ============================================================
CREATE TABLE etl_connections (
    connection_id    BIGSERIAL       PRIMARY KEY,
    connection_name  VARCHAR(100)    NOT NULL,
    source_type      VARCHAR(20)     NOT NULL,          -- 'file' | 'postgresql' | 'snowflake' | 'bigquery' | 'oracle' | 'mssql'
    host             VARCHAR(255),
    port             INTEGER,
    database_name    VARCHAR(100),
    schema_name      VARCHAR(100)    DEFAULT 'public',
    username         VARCHAR(100),
    encrypted_password TEXT,
    extra_config     JSONB           DEFAULT '{}',      -- DB별 추가 옵션 (SSL, 서비스계정 키 등)
    is_active        BOOLEAN         DEFAULT TRUE,
    created_by       VARCHAR(100)    NOT NULL,
    created_at       TIMESTAMP       DEFAULT NOW(),
    updated_at       TIMESTAMP       DEFAULT NOW()
);

COMMENT ON TABLE  etl_connections IS 'ETL 소스 연결 정보 (파일/외부DB)';
COMMENT ON COLUMN etl_connections.connection_id    IS 'PK. 자동 증가';
COMMENT ON COLUMN etl_connections.connection_name  IS '사용자가 지정하는 연결 이름 (예: "운영DB", "마케팅 Snowflake")';
COMMENT ON COLUMN etl_connections.source_type      IS '소스 유형. file / postgresql / snowflake / bigquery / oracle / mssql';
COMMENT ON COLUMN etl_connections.host             IS 'DB 호스트 주소. file이면 NULL';
COMMENT ON COLUMN etl_connections.port             IS 'DB 포트. file이면 NULL';
COMMENT ON COLUMN etl_connections.database_name    IS 'DB명. file이면 NULL';
COMMENT ON COLUMN etl_connections.schema_name      IS '스키마명. 기본값 public';
COMMENT ON COLUMN etl_connections.username         IS 'DB 접속 계정. file이면 NULL';
COMMENT ON COLUMN etl_connections.encrypted_password IS 'DB 비밀번호 (암호화 저장). file이면 NULL';
COMMENT ON COLUMN etl_connections.extra_config     IS 'DB별 추가 설정을 JSON으로 저장 (SSL 모드, GCP 키 경로, Snowflake warehouse 등)';
COMMENT ON COLUMN etl_connections.is_active        IS '활성 여부. 비활성 시 연동 중지';
COMMENT ON COLUMN etl_connections.created_by       IS '등록한 사용자 ID';
COMMENT ON COLUMN etl_connections.created_at       IS '등록 일시';
COMMENT ON COLUMN etl_connections.updated_at       IS '최종 수정 일시';


-- ============================================================
-- 2. ETL 작업 정의 (테이블 단위)
-- ============================================================
CREATE TABLE etl_tables (
    etl_table_id     BIGSERIAL       PRIMARY KEY,
    connection_id    BIGINT          REFERENCES etl_connections(connection_id),
    source_table     VARCHAR(200),                      -- DB 연동 시 소스 테이블명. 파일이면 원본 파일명
    target_table     VARCHAR(200)    NOT NULL,           -- 우리 PostgreSQL에 생성할 테이블명
    description      VARCHAR(500),
    pk_columns       VARCHAR(500),                      -- Upsert 기준 PK 컬럼 (콤마 구분)
    incremental_column VARCHAR(100),                    -- 증분 추출 기준 컬럼명 (예: updated_at)
    last_synced_at   TIMESTAMP,                         -- 마지막 증분 동기화 시점
    sync_mode        VARCHAR(20)     DEFAULT 'full',    -- 'full' | 'incremental'
    file_type        VARCHAR(20),                       -- 파일인 경우: csv / excel / parquet
    file_path        VARCHAR(500),                      -- 업로드된 파일 서버 저장 경로
    status           VARCHAR(20)     DEFAULT 'draft',   -- 'draft' | 'ready' | 'running' | 'done' | 'error'
    created_by       VARCHAR(100)    NOT NULL,
    created_at       TIMESTAMP       DEFAULT NOW(),
    updated_at       TIMESTAMP       DEFAULT NOW()
);

COMMENT ON TABLE  etl_tables IS 'ETL 작업 정의. 소스 1개 = 타겟 테이블 1개 매핑';
COMMENT ON COLUMN etl_tables.etl_table_id       IS 'PK. 자동 증가';
COMMENT ON COLUMN etl_tables.connection_id      IS 'FK → etl_connections. 어떤 소스 연결을 쓰는지';
COMMENT ON COLUMN etl_tables.source_table       IS 'DB 연동 시 소스 테이블명. 파일이면 원본 파일명 저장';
COMMENT ON COLUMN etl_tables.target_table       IS '우리 PostgreSQL에 생성/적재할 타겟 테이블명';
COMMENT ON COLUMN etl_tables.description        IS '사용자가 입력하는 테이블 설명';
COMMENT ON COLUMN etl_tables.pk_columns         IS 'Upsert 시 기준이 되는 PK 컬럼명. 콤마 구분 (예: "id" 또는 "order_id,product_id")';
COMMENT ON COLUMN etl_tables.incremental_column IS '증분 추출 기준 컬럼 (예: updated_at). full 모드면 NULL';
COMMENT ON COLUMN etl_tables.last_synced_at     IS '마지막 증분 동기화 시점. 다음 배치 시 이 시점 이후만 추출';
COMMENT ON COLUMN etl_tables.sync_mode          IS '동기화 방식. full(전체) / incremental(증분)';
COMMENT ON COLUMN etl_tables.file_type          IS '파일 업로드인 경우 파일 유형. csv / excel / parquet. DB 연동이면 NULL';
COMMENT ON COLUMN etl_tables.file_path          IS '업로드된 파일의 서버 저장 경로. DB 연동이면 NULL';
COMMENT ON COLUMN etl_tables.status             IS '현재 상태. draft(설정중) / ready(실행대기) / running(실행중) / done(완료) / error(오류)';
COMMENT ON COLUMN etl_tables.created_by         IS '등록한 사용자 ID';
COMMENT ON COLUMN etl_tables.created_at         IS '등록 일시';
COMMENT ON COLUMN etl_tables.updated_at         IS '최종 수정 일시';


-- ============================================================
-- 3. ETL 변환 룰 정의 (컬럼 단위)
-- ============================================================
CREATE TABLE etl_transform_rules (
    rule_id          BIGSERIAL       PRIMARY KEY,
    etl_table_id     BIGINT          NOT NULL REFERENCES etl_tables(etl_table_id),
    source_column    VARCHAR(200)    NOT NULL,           -- 소스 컬럼명
    target_column    VARCHAR(200),                       -- 타겟 컬럼명. NULL이면 source_column과 동일
    rule_type        VARCHAR(30)     NOT NULL,           -- 'cleansing' | 'type_cast' | 'code_map' | 'derived' | 'masking'
    rule_config      JSONB           NOT NULL DEFAULT '{}',
    apply_order      INTEGER         DEFAULT 1,          -- 같은 컬럼에 여러 룰 시 적용 순서
    is_active        BOOLEAN         DEFAULT TRUE,
    created_at       TIMESTAMP       DEFAULT NOW(),
    updated_at       TIMESTAMP       DEFAULT NOW()
);

COMMENT ON TABLE  etl_transform_rules IS 'ETL 변환 룰. 컬럼 단위로 변환 규칙 정의';
COMMENT ON COLUMN etl_transform_rules.rule_id        IS 'PK. 자동 증가';
COMMENT ON COLUMN etl_transform_rules.etl_table_id   IS 'FK → etl_tables. 어떤 ETL 작업에 속하는 룰인지';
COMMENT ON COLUMN etl_transform_rules.source_column   IS '변환 대상 소스 컬럼명';
COMMENT ON COLUMN etl_transform_rules.target_column   IS '변환 후 저장할 타겟 컬럼명. NULL이면 소스 컬럼명 그대로 사용';
COMMENT ON COLUMN etl_transform_rules.rule_type       IS '변환 유형. cleansing / type_cast / code_map / derived / masking';
COMMENT ON COLUMN etl_transform_rules.rule_config     IS '변환 상세 설정 (JSON). rule_type별로 구조가 다름';
COMMENT ON COLUMN etl_transform_rules.apply_order     IS '같은 컬럼에 여러 룰 적용 시 실행 순서. 숫자가 작을수록 먼저 실행';
COMMENT ON COLUMN etl_transform_rules.is_active       IS '활성 여부. 비활성 시 해당 룰 스킵';
COMMENT ON COLUMN etl_transform_rules.created_at      IS '등록 일시';
COMMENT ON COLUMN etl_transform_rules.updated_at      IS '최종 수정 일시';
```

---

## 6. Phase 1: 백엔드 기초·파일 업로드 API

**목표**: ETL 메타 저장, 파일 업로드 수신, 스키마 추론·정의 API 제공.

| 작업 | 내용 |
|------|------|
| **1.1 ETL 메타 API** | 연결(소스 유형=file) 등록: 테이블명, 설명, (파일인 경우) 업로드 시점 정보. `POST /api/etl/connections` 또는 `POST /api/etl/tables` 형태. 목록 조회 `GET /api/etl/tables`. |
| **1.2 파일 업로드 API** | `POST /api/etl/upload` (multipart/form-data). 수신 파일을 임시 저장 또는 메모리에서 파싱. 요청에 테이블명·설명 포함 가능. |
| **1.3 스키마 추론** | CSV/Excel/Parquet 첫 행(또는 샘플) 기반 컬럼명·타입 추론. 응답: `{ columns: [ { name, inferred_type } ] }`. 사용자가 컬럼명·타입 수정 가능하도록 API 지원(선택). |
| **1.4 인증** | 기존 웹앱 사용자 인증 연동. 업로드·메타 API는 인증된 사용자만 호출 가능하도록 미들웨어 적용. |

**산출물**: 파일 업로드 수신, 스키마 추론 결과 반환, ETL 테이블 메타 등록·조회 API.

---

## 7. Phase 2: 파일 기반 E/L

**목표**: 업로드된 파일을 파싱해 우리 PostgreSQL에 **테이블 생성 + 일회성 적재**까지 수행.

| 작업 | 내용 |
|------|------|
| **2.1 파싱** | CSV: pandas `read_csv`(인코딩·구분자 옵션). Excel: `read_excel`. Parquet: `read_parquet`. 대용량은 청크 단위 읽기(예: `chunksize`)로 메모리 제한. |
| **2.2 타겟 스키마 생성** | 추론된(또는 사용자 지정) 컬럼명·타입으로 우리 PostgreSQL에 `CREATE TABLE` 실행. 테이블명·스키마는 메타에 저장된 값 사용. **화이트리스트**: 테이블명·컬럼명은 검증(예: 식별자 규칙, SQL injection 방지). |
| **2.3 적재** | 파싱된 DataFrame(또는 청크)을 `INSERT` 또는 `COPY`로 적재. 일회성이므로 **기존 테이블이 있으면 TRUNCATE 후 INSERT 또는 DROP 후 CREATE** 등 정책 하나로 통일(문서에 명시). |
| **2.4 Job 기록** | 적재 시작/종료 시각, 처리 건수, 상태(completed/failed), 에러 메시지를 `etl_jobs`에 기록. 나중에 큐 연동 시 같은 테이블 사용. |
| **2.5 에러 처리** | 파싱 실패(인코딩, 형식 오류), DDL/INSERT 실패 시 사용자에게 메시지 반환. 실패 시 Job 상태를 failed로 갱신. |

**산출물**: 파일 업로드 → 테이블 생성 → 일회성 적재가 끝까지 동작. Job 이력 저장.

---

## 8. Phase 3: DB 연동 E/L

**목표**: 외부 DB(1차: PostgreSQL)를 등록하고, 해당 DB의 테이블·데이터를 **추출(E)** 후 우리 PostgreSQL에 **Upsert(L)** 로 적재. 배치성 증분(CDC) 지원.

| 작업 | 내용 |
|------|------|
| **3.1 연결 등록 API** | `POST /api/etl/connections` (소스 유형=db). 호스트, 포트, DB명, 사용자, 비밀번호(암호화 저장). 1차는 PostgreSQL만. 연결 테스트 `POST /api/etl/connections/test` 반환. |
| **3.2 소스 테이블 목록** | 등록된 연결로 외부 DB에 접속해 테이블 목록 조회. `GET /api/etl/connections/{id}/tables`. information_schema 또는 해당 DB 메타 사용. |
| **3.3 ETL 작업 정의** | 소스 연결 + 소스 테이블 + **타겟 테이블명**(우리 DB) + 설명 저장. PK 또는 유니크 키 컬럼 지정( Upsert 시 사용). `etl_tables` 또는 `etl_job_definitions` 에 저장. |
| **3.4 Full Load** | 최초 1회: 소스 테이블 전체 SELECT → 우리 DB에 INSERT(또는 TRUNCATE 후 INSERT). Job으로 기록. |
| **3.5 Incremental / Upsert** | 배치성 CDC: **증분 컬럼**(예: `updated_at`) 기준으로 "마지막 동기화 시점 이후"만 SELECT. 우리 DB에는 `INSERT ... ON CONFLICT (pk_col) DO UPDATE SET ...` 로 Upsert. 마지막 동기화 시점은 Job 완료 시점 또는 메타에 저장. |
| **3.6 스케줄(선택)** | 주기 실행(매일 새벽 등)은 Phase 6 큐·스케줄러와 연동. Phase 3에서는 "수동 실행" API만 제공해도 됨. |

**산출물**: DB 연결 등록, 소스 테이블 선택, Full Load·Incremental Upsert 실행, Job 이력 기록.

---

## 9. Phase 4: 변환(T) 1차

**목표**: 적재 전에 **클렌징, 타입 변환, 코드 매핑, 단순 파생 컬럼, 마스킹**을 적용해 우리 PostgreSQL에 맞게 데이터 정제.

| 작업 | 내용 |
|------|------|
| **4.1 변환 룰 메타** | `etl_transform_rules` 테이블 또는 JSON 설정: (연결/테이블 ID, 컬럼, 룰 유형, 파라미터). 룰 유형: cleanse, type_convert, code_map, derived, mask. |
| **4.2 클렌징** | TRIM(앞뒤 공백), NULL 처리(빈 문자열→NULL, 또는 기본값 지정). 이상치 필터(상·하한)는 선택. |
| **4.3 타입 변환** | 컬럼별: 문자열→DATE/TIMESTAMP, 문자열→INTEGER/BIGINT/NUMERIC. 실패 행은 NULL 또는 에러 테이블로 분리(정책 명시). |
| **4.4 코드 매핑** | 컬럼별 "원본값 → 대상값" 매핑 테이블 또는 키-값 설정. 예: "M"→"남", "F"→"여". 매핑 없으면 원본 유지 또는 기본값. |
| **4.5 파생 컬럼** | 단순 수식: 현재년도 - 생년, 문자열 결합 등. 표현식 엔진은 최소 범위(사전 정의 연산만)로 해서 복잡도 제한. |
| **4.6 마스킹(선택)** | 컬럼별 규칙: 뒷자리 N자리 `*` 처리, 이메일 도메인만 노출 등. 개인정보 비식별화용. |
| **4.7 적용 순서** | E(추출) 또는 파일 파싱 직후 → T(변환 룰 순차 적용) → L(적재). 변환 실패 행은 로그 또는 에러 테이블에 기록. |

**산출물**: 변환 룰 정의·저장, 추출/파싱 결과에 변환 적용 후 적재.

---

## 10. Phase 5: ETL 페이지 UI

**목표**: 단일 ETL 페이지에서 **소스 유형 선택(파일 / DB)** 에 따라 해당 폼만 노출하고, 테이블 목록·Job 실행·큐·로그를 표시.

| 작업 | 내용 |
|------|------|
| **5.1 페이지 구조** | `packages/etl/ETLPage.jsx` (또는 유사명). 상단: 소스 유형 선택(라디오/탭) → **파일 업로드** | **DB 연결**. 하단: 등록된 ETL 목록, Job 큐·로그. |
| **5.2 파일 업로드 UI** | 파일 선택, 테이블명·설명 입력. 업로드 후 스키마 추론 결과(컬럼·타입) 표시, 필요 시 수정. "적재 실행" 버튼 → Phase 2 API 호출. |
| **5.3 DB 연결 UI** | 연결 추가: 호스트, 포트, DB명, 사용자, 비밀번호. 연결 테스트 버튼. 연결 목록에서 선택 후 "소스 테이블 선택" → 타겟 테이블명·설명·PK 지정. "동기화 실행" 버튼 → Phase 3 API 호출. |
| **5.4 ETL 목록** | 등록된 ETL(테이블명, 설명, 소스 유형, 마지막 실행 시각) 테이블/카드. 행별 "실행", "수정", "삭제" 등. |
| **5.5 Job·로그** | 실행 중/대기 Job 목록, 완료/실패 상태. 상세 로그(시작/종료, 건수, 에러 메시지) 표시. |
| **5.6 컴포넌트 분리** | `SourceTypeSelector`, `FileUploadForm`, `DbConnectionForm`, `ETLTableList`, `JobQueuePanel`, `JobLogPanel` 등 기능별로 분리. |

**산출물**: 한 페이지에서 파일/DB 선택에 따라 UI 전환, ETL 등록·실행·로그 확인 가능.

---

## 11. Phase 6: 큐·모니터링·정리

**목표**: 여러 ETL Job이 동시에 요청될 때 **큐 관리**, 순차/동시 실행 제한, 재시도·실패 알림, 라우트·정리.

| 작업 | 내용 |
|------|------|
| **6.1 Job 큐** | Job 등록 시 상태=pending. 워커(또는 API 요청 시 폴링)가 pending Job을 순차 또는 동시 N개까지 가져와 실행. 실행 중에는 running, 완료/실패 시 completed/failed 갱신. |
| **6.2 동시 실행 제한** | 설정값(예: 2)만큼만 동시 running 허용. 나머지는 대기. DB 테이블 `etl_jobs` 의 상태로 제어하거나, 간단한 락/세마포어. |
| **6.3 재시도** | 실패 시 자동 재시도(최대 횟수·간격 정책). 재시도 후에도 실패하면 failed 유지, 에러 메시지 저장. |
| **6.4 로깅·모니터링** | Job별 시작/종료 시각, 처리 건수, 에러 메시지. 필요 시 "실패 시 알림"(이메일/Slack 등)은 추후 확장. |
| **6.5 라우트·네비** | `/etl` (또는 `/ibank-bi/etl`) 라우트 등록, 상단 네비에 "ETL" 메뉴 추가. |
| **6.6 정리** | 미사용 import·파일 제거, 린트·문서 정리. |

**산출물**: 다중 Job 큐 동작, 재시도·로그, ETL 페이지 진입 경로 확정.

---

## 12. 구현 시 공통 주의 사항

| 항목 | 내용 |
|------|------|
| **에러 처리** | 파싱·연결·적재 실패 시 사용자에게 메시지 반환. Job 상태를 failed로 기록하고 에러 메시지 저장. |
| **보안** | DB 비밀번호 등은 암호화 저장. 테이블명·컬럼명은 화이트리스트 검증 후만 DDL/DML에 사용. API 인증 필수. |
| **대용량·타임아웃** | 파일·조회 결과가 크면 청크 처리, 타임아웃 설정. "데이터가 많아 제한된 건수만 처리했습니다" 등 안내. |
| **멱등성** | 같은 데이터로 재실행해도 중복 없이 동작하도록. Upsert는 PK/유니크 기준, Full Load는 TRUNCATE 후 INSERT 등 정책 통일. |
| **건수 검증** | 추출 건수 vs 적재 건수 불일치 시 로그·알림. 선택적으로 검증 API 제공. |

---

## 13. 추가 제안·확장

| # | 제안 | 비고 |
|---|------|------|
| 1 | **다른 DB 커넥터** | Snowflake, BigQuery, Oracle, MSSQL(Maria) 순으로 커넥터 추가. 연결 정보·드라이버만 DB별로 분기. |
| 2 | **스케줄 실행** | cron 또는 내부 스케줄러로 "매일 02:00에 이 ETL 실행" 등 등록. Phase 6 큐와 연동. |
| 3 | **변환 2차** | 조인/병합, 집계 후 적재, 피벗, SCD Type 2 등은 요구 발생 시 별도 Phase로 설계. |
| 4 | **데이터 내보내기** | ETL 결과 테이블을 CSV/Excel로 내보내기 기능은 Phase 5 이후에 추가 가능. |
| 5 | **테스트용 데이터** | 개발·검수 시 소스 파일 2종, 외부 PostgreSQL 1개로 E2E 테스트하면 파이프라인 검증에 유리. |

---

## 14. Phase 순서 요약

| Phase | 요약 |
|-------|------|
| 0 | 사전 작업(폴더, 메타 테이블, 의존성, etl 패키지) |
| 1 | 백엔드 기초·파일 업로드 API(메타, 스키마 추론) |
| 2 | 파일 기반 E/L(파싱, 테이블 생성, 일회성 적재) |
| 3 | DB 연동 E/L(연결 등록, Full·Incremental, Upsert) |
| 4 | 변환(T) 1차(클렌징, 타입, 매핑, 파생, 마스킹) |
| 5 | ETL 페이지 UI(소스 선택, 파일/DB 폼, 목록, Job·로그) |
| 6 | 큐·모니터링·정리(Job 큐, 재시도, 라우트) |

실제 개발 시 Phase 단위로 완료 여부를 결정하고, Phase 완료 시점마다 `docs/report/log.md`에 기록하는 것을 권장한다.
