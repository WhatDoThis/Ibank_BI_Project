# 26. 위젯보드 시각화 엔진 개선 — 컬럼 프로파일·차트 추천 개발 계획서

**목적**: 커서 AI·서브에이전트가 **본 문서만으로** Phase 1~4 구현·검증을 진행할 수 있도록, 요구사항·파일 경로·코드베이스 정합 사항·체크리스트를 한곳에 정리한다.  
**전제**: `table_master.column_profiles`(JSONB), `table_master.profile_updated_at`(TIMESTAMPTZ) DDL은 **이미 적용됨**(저장소에 마이그레이션 SQL 파일을 추가하지 않는다는 프로젝트 규칙 유지).

---

## 0. 읽는 순서·산출물

| 순서 | 섹션 | 산출물 |
|------|------|--------|
| 1 | §1 개요 | 제품 목적(§1.0)·기술 목표·원칙 확정 |
| 2 | **§2 코드베이스 정합(필수)** | 경로·동기 API·ETL 훅 위치·물리 스키마 |
| 3 | §3 Phase 1 | `column_profiler.py` |
| 4 | §4 Phase 1-B | QS·ETL 트리거, 백필, 관리 API |
| 5 | §5 Phase 2 | `chart_recommender.py`, 스키마, 서비스, API |
| 6 | §6 Phase 4 | FE 일자 필터(백엔드 비의존, 병렬 가능) |
| 7 | §7 Phase 3 | FE 자동 추천·적합도·미리보기 |
| 8 | §8 검증 체크리스트 | 사양 대조 완료 표 |

**§0와 §8 참고 — Phase 번호 vs 실행 순서**: 문서 목차는 **§6 = Phase 4(FE 일자)** 가 **§7 = Phase 3(FE 추천 UI)** 보다 앞에 나온다. **실행 순서**는 §8과 같이 **Phase 3(FE 추천·적합도)이 Phase 4(일자 필터)보다 선행**하는 것이 자연스럽다(프로파일 API·상태가 먼저). **§6 내용은 Phase 2(GET profile) 이후·Phase 3과 병렬 가능**한 FE 작업으로 읽는다.

---

## 1. 프로젝트 개요

### 1.0 제품 목적(북극성) — 위젯 아이템 제작 도구

**최종 목적은 컬럼 프로파일 자체가 아니라**, 사용자가 보드에 올릴 **위젯 아이템(차트·카드·표 등)을 빠르고 덜 실수로 완성하는 제작 UX**이다.

- **수단**: `table_master`에 캐시되는 컬럼 프로파일 + 차트 추천 엔진 + 적합도·미리보기 UI.
- **결과**: 제작 창에서 테이블을 고르면 **차트 타입·X/Y·color_by·집계·(일자 필터 노출 여부)** 가 합리한 기본값으로 채워지고, 사용자는 필요 시만 수정한 뒤 **기존 위젯 저장 API**(`POST /api/widget-boards/{board_id}/widgets` 등)로 페이로드를 확정한다.

**성공 기준(구현 완료 판단에 사용)**:

1. 템플릿 드롭 후 테이블 선택만으로 **첫 추천이 위젯 설정 상태에 반영**된다.
2. 추천 결과가 **DB `widget_item.data_config`(JSONB)** 및 API 페이로드와 모순 없이 연결된다. 현행 프론트 기준 키는 `Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx`의 `WIDGET_DATA_CONFIG_KEYS` 및 `buildDataConfigForApi`와 동일해야 한다.
3. 프로파일이 없거나 실패해도 **수동 제작·저장**은 가능하고, 테이블 등록( QS / ETL )은 깨지지 않는다.

**성공 기준 2 — `data_config` 키·추천 필드 매핑(현행 코드 기준)**

| 용도 | `data_config` 키(카멜케이스) | 비고 |
|------|------------------------------|------|
| 차트 종류 | `chartType` | 값은 `line` / `bar` / `pie` / `area` 등 **기존 설정 UI·`CHART_TYPES`와 동일한 집합**으로 정규화 |
| 범주·X축(비시계열) | `dimensionKey` | 바·파이 등에서 추천 `x_axis`가 범주형이면 매핑 |
| 수치·Y축 | `metricKey` | 추천 `y_axis[0]`(단일 지표 위주); 복수 Y는 현 UI가 확장되면 `yAxisKeys` 등 **별도 키 추가 설계** |
| 기간 축(시계열) | `dateColumn`, `dateGrain`, `dateStart`, `dateEnd` | 추천 축이 TEMPORAL이면 `dateColumn` 우선 채움; 기간 UI는 기존 마법사와 동일 |
| 표 컬럼 등 | `visibleColumns`, `columnOrder`, `sortKey`, `sortDir`, `limit` | 테이블 위젯·정렬 확장 시 |
| 메모 | `noteContent` | 비데이터 위젯 |

- 추천 엔진의 **`color_by`**, **`aggregation`(컬럼→집계)** 은 **현재 `WIDGET_DATA_CONFIG_KEYS`에 없음**. **본 문서 기본안**: **Phase 3에서는** UI·상태에만 반영하고, **`data_config`에 `colorBy` / `aggregations` 키를 넣는 확장은 Phase 3 이후 별도 작업(백로그)** 으로 둔다(저장 페이로드는 기존 키 `chartType`·`metricKey`·`dimensionKey`·`dateColumn` 등만 사용). 저장까지 동기화가 같은 스프린트에 필요하면 **Phase 3 범위에 명시적으로 포함**하고 §7.6·`buildDataConfigForApi`·위젯 데이터 서비스를 함께 수정한다.
- **`chart_recommender`의 `chart_type`(스네이크)** 과 **`data_config.chartType`(카멜)** 명명 불일치 — FE 매핑 레이어에서만 변환한다.

**엔드투엔드 흐름(구현자가 범위를 잃지 않도록)**:

`템플릿 배치 → 제작 UI 열림 → 프로젝트 테이블 목록(role_summary) → 테이블 선택 → GET …/profile → 추천 안내(팔레트 허용 차트만)·축·집계·일자 필터 조건 → 사용자 조정 → 위젯 저장`

### 1.1 기술 목표(수단)

위젯 생성 시 테이블 컬럼을 **자동 프로파일링**하여 차트 타입·축 매핑을 **추천**한다(§1.0을 위한 백엔드·캐시 전략).

### 1.2 핵심 원칙

- 프로파일은 **`table_master`에 테이블이 등록되는 시점**에 생성(또는 강제 갱신)한다.
- 위젯 생성 시에는 **캐시된 프로파일**을 읽고, **TTL 만료 시에만** 데이터 DB에서 재프로파일한다.
- 기존 `table_master` 중 `column_profiles`가 없는 행은 **일괄 백필**한다.
- 프로파일링이 실패해도(테이블 없음·권한 등) **테이블 등록 트랜잭션/적재 결과는 실패시키지 않는다** — `column_profiles`는 NULL 유지 + 경고 로그.

### 1.3 모듈 위치

- 신규: `Backend/widget_board_server/column_profiler.py`
- 신규: `Backend/widget_board_server/chart_recommender.py`
- 트리거 삽입: `Backend/query_studio_server/router.py`, ETL 측은 **§2.3** 기준 파일.
- 수정: `Backend/widget_board_server/router.py`, `service.py`, `schemas.py`
- FE: `Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx`, **`WidgetDataWizardModal.jsx`**(데이터 위젯 마법사·테이블 선택·저장 흐름이 있으면 **동일 제품 목적(§1.0)** 아래에서 우선 연동 대상)

---

## 2. 코드베이스 정합(구현 전 필독)

### 2.1 HTTP API 접두어

- `Backend/api_server/main.py`에 위젯 보드 라우터는 **`/api/widget-boards`** 로 등록되어 있다(`widget_board_router`).
- 본 명세 초안의 `/api/widget-board/...` 표기는 **구현 시 아래와 같이 정합할 것**.

| 명세(초안) | 구현 권장 경로 |
|------------|----------------|
| `GET /api/widget-board/table/{table_master_id}/profile` | `GET /api/widget-boards/table/{table_master_id}/profile` (또는 동일 라우터에 경로 추가) |
| `POST /api/widget-board/admin/backfill-profiles` | `POST /api/widget-boards/admin/backfill-profiles` |

라우터 `APIRouter(prefix=...)` 조정 시 **기존 클라이언트 깨짐**을 방지하기 위해, 경로만 추가하고 prefix는 유지하는 방식을 권장한다.

### 2.2 동기·비동기 스택

- `widget_board_server.router`의 핸들러는 현재 **`def` + psycopg2 동기 커넥션** 패턴이다.
- `query_studio_server.router`의 `_upsert_table_master_and_mapping`은 **`def` 동기**이다.
- `etl_server/table_master_hook.py`의 `upsert_table_master_after_load`는 **`def` 동기**이다.

**정합 지침**:

- 사양에 `async def`가 있으나, **동일 프로세스에서 기존 동기 코드와 섞일 경우** 구현팀은 다음 중 하나를 선택해 문서·코드에 일관 적용한다.
  - **권장 A**: `column_profiler`의 공개 진입점을 **`def ensure_profile(conn, ...)`** 등 **동기 API**로 구현하고, 내부에서 psycopg2 커서만 사용한다. FastAPI에서 별도 `async` 엔드포인트가 필요하면 `starlette.concurrency.run_in_threadpool` 등으로 래핑한다.
  - **대안 B**: 전 구간 `asyncpg` 등으로 통일(범위 큼, 비권장).

본 문서 함수 시그니처는 사양대로 `async def`로 기술하되, **실제 머지 시 §2.2 권장 A로 바꿔도 요구 기능은 동일**하다.

### 2.3 ETL — `table_master` UPSERT 실제 위치(명세 보정)

- **물리 INSERT/UPSERT SQL**은 `Backend/etl_server/table_master_hook.py`의 **`upsert_table_master_after_load`** 한 곳에 있다.
- 다음 모듈이 이 훅을 호출한다(한 파일만 수정하면 경로 누락 발생):
  - `Backend/etl_server/load_service.py`
  - `Backend/etl_server/load_service_file.py`
  - `Backend/etl_server/db_load_service.py`
  - `Backend/etl_server/batch_executor_db.py`
  - `Backend/etl_server/batch_executor_file.py`

**구현 권장**: 프로파일 트리거는 `load_service.py`에만 넣지 말고,  
**`upsert_table_master_after_load` 성공 직후(같은 함수 내부 또는 직후 퍼)** 에 두어 모든 적재 경로에 적용한다.

**주의**: 현재 `upsert_table_master_after_load`는 **`table_master_id`를 반환하지 않는다**. `ensure_profile`(또는 동기 동등물)에 ID가 필요하면:

- UPSERT에 **`RETURNING table_master_id`** 추가 후 반환, 또는
- UPSERT 직후 `SELECT table_master_id FROM table_master WHERE db_type=%s AND table_name=%s`

로 조회한다.

### 2.4 물리 테이블 스키마명(`schema`)

- `table_master` 행은 `db_type` + `table_name` 중심이며, **별도 `table_schema` 컬럼이 없는 전제**에서 구현한다.
- 프로파일링 시 `information_schema`·`SELECT * FROM schema.table`의 **`schema`는 기본 `public`** 으로 둔다. 다중 스키마가 도입되면 추후 컬럼 추가·설정화(본 Phase 범위 밖).

### 2.5 데이터 DB vs 시스템 DB 커넥션

- **`save_profile_to_table_master`**: `ibank_system_data`(시스템 DB) — 기존 `Backend.core.db`의 **system** 풀/연결 패턴 사용.
- **`profile_table` / `fetch_*`**: `db_type`에 대응하는 **실제 데이터 DB**(main/dash 등) 연결. `Backend.core.db` 및 ETL·QS에서 쓰는 **타깃 DB 연결 획득 방식**을 재사용한다.

`ensure_profile`은 **(system_conn, data_conn)** 또는 내부에서 각각 획득하도록 설계한다(사양과 동일).

### 2.6 SQL 인젝션 방지

`schema`, `table_name`은 사용 전 **정규식 `^[a-zA-Z_][a-zA-Z0-9_]*$`** 검증. 실패 시 프로파일 단계에서 조용히 실패하거나 명시적 예외(로그용) 처리.

---

## 3. Phase 1 — `column_profiler.py`

### 3.1 파일

`Backend/widget_board_server/column_profiler.py` (신규)

### 3.2 `semantic_role` 분류(우선순위 순)

1. **IDENTIFIER**: PK이거나 컬럼명이 `_id`, `_key`, `_code`로 **끝남**(접미사 일치). **엣지**: `amount_id`처럼 `_id`로 끝나도 수치 의미인 경우 — **v1 확정**: 접미사 검사 **전에** `pg_type`이 **아래 4번 MEASURE**에 해당하는 수치형이면 **IDENTIFIER 접미사 규칙을 적용하지 않고** MEASURE 분기(4번)로 넘긴다.
2. **TEMPORAL**: `pg_type`이 date / timestamp / timestamptz 이거나, 컬럼명에 `_dt`, `_date`, `_dtm`, `created_at`, `updated_at` 포함
3. **GEO**: 컬럼명(소문자)에 `lat`, `lng`, `longitude`, `latitude` 포함
4. **MEASURE**: 숫자형(int, float, numeric, decimal, bigint, smallint, real, double precision) **이면서** 1에서 IDENTIFIER가 아닌 것
5. **DIMENSION**: 문자열(varchar, text, char) + cardinality ≤ `sample_count`의 50%, **또는** boolean
6. **HIGH_CARDINALITY_TEXT**: 문자열 + cardinality > `sample_count`의 50%

(구현 시 타입 문자열은 `information_schema.columns.data_type` 및 PostgreSQL 실제 매핑에 맞춰 정규화한다.)

### 3.3 함수 사양

#### 3.3.1 `fetch_column_metadata(conn, schema, table_name) -> list[dict]`

- `information_schema.columns`에서 `column_name`, `data_type`, `ordinal_position`, `is_nullable` 조회
- PK 컬럼: `information_schema.table_constraints` + `key_column_usage`
- 반환: `[{"name", "pg_type", "ordinal", "nullable", "is_pk"}, ...]`

#### 3.3.2 `fetch_column_stats(conn, schema, table_name, sample_limit=1000) -> dict`

- `SELECT COUNT(*) AS total_count FROM {schema}.{table_name}`
- `SELECT * FROM {schema}.{table_name} ORDER BY random() LIMIT {sample_limit}`  
  - 대용량 테이블 부하가 이슈면 **후속 개선**으로 `TABLESAMPLE` 등 검토(본 문서 범위에서는 사양대로).
- 컬럼별: `distinct_count`, `null_count`, `null_ratio` (= null_count / sample_count), 숫자·날짜형에 한해 `min_value`, `max_value`
- 반환: `{"total_rows", "sample_count", "columns": {컬럼명: {stats}, ...}, "sample_rows": [...] }`
  - **`sample_rows`는 오직 여기서만 생성**한다: 위 random 샘플 행 중 **앞에서 최대 5행**을 `{컬럼명: 값}` dict 리스트로 담는다(§7.3 미리보기).

**`sample_rows`와 `profile_table`의 관계(단일 출처)**: `profile_table`은 `fetch_column_stats`가 반환한 dict에서 **`sample_rows`를 그대로 복사**해 최종 프로파일 JSON에 넣는다. `profile_table` 안에서 샘플을 **다시 조회하지 않는다**.

#### 3.3.3 `classify_column(col_meta, col_stats, sample_count) -> str`

위 §3.2 우선순위 적용 → `semantic_role` 문자열.

#### 3.3.4 `profile_table(conn, schema, table_name, sample_limit=1000) -> dict`

- `fetch_column_metadata` + `fetch_column_stats` 호출
- 컬럼별 `classify_column` 적용
- `stats = fetch_column_stats(...)` 결과에서 **`sample_rows`를 변경 없이** 최종 dict에 포함한다(§3.3.2).
- 반환:

```json
{
  "table_name": "...",
  "total_rows": 0,
  "sample_count": 0,
  "profiled_at": "<ISO8601 UTC>",
  "columns": [
    {
      "name": "...",
      "pg_type": "...",
      "semantic_role": "...",
      "nullable": true,
      "is_pk": false,
      "distinct_count": 0,
      "null_ratio": 0.0,
      "min_value": null,
      "max_value": null
    }
  ],
  "sample_rows": [ { "...": "..." }, ... ]
}
```

#### 3.3.5 `save_profile_to_table_master(system_conn, table_master_id, profile) -> None`

```sql
UPDATE table_master
SET column_profiles = %s::jsonb,
    profile_updated_at = NOW()
WHERE table_master_id = %s
```

#### 3.3.6 `ensure_profile(system_conn, data_conn, table_master_id, schema, table_name, ttl_hours=24, force=False) -> dict`

1. `table_master`에서 `column_profiles`, `profile_updated_at` 조회
2. `force=True` 이거나 `column_profiles IS NULL` 이거나 **TTL 만료**이면: `profile_table` → `save_profile_to_table_master`
3. 그 외: 캐시된 JSON 반환
4. **단일 진입점**으로 설계

**TTL 만료 판단(시간대·기준 시각)**: `profile_updated_at`은 **TIMESTAMPTZ**이므로 만료 비교는 **DB 세션의 `NOW()`** 기준으로만 수행한다. Python `datetime.utcnow()` 등으로 혼합 비교하지 않는다.

예시(SQL, 파라미터 바인딩):

```sql
SELECT column_profiles, profile_updated_at
FROM table_master
WHERE table_master_id = %s
  AND (
    %s::boolean = true
    OR column_profiles IS NULL
    OR profile_updated_at IS NULL
    OR profile_updated_at < (NOW() - (%s::int * INTERVAL '1 hour'))
  );
```

- 위 조건이 참이면 재프로파일, 거짓이면 캐시 `column_profiles` JSON을 그대로 반환한다(실제 구현은 단일 SELECT + 애플리케이션 분기도 가능).

### 3.4 실패 시 정책

- `profile_table` 실패 시 **`table_master` 원장 UPSERT/INSERT는 실패시키지 않음**. `column_profiles` NULL 유지 + `logger.warning`.

---

## 4. Phase 1-B — 트리거·백필·관리 API

### 4.1 쿼리스튜디오

**파일**: `Backend/query_studio_server/router.py`  
**함수**: `_upsert_table_master_and_mapping`

- `table_master` UPSERT로 **`table_master_id`를 이미 확보**한다(`RETURNING`).
- UPSERT 및 매핑 처리 **직후**, 별도 `try/except`로 감싼다:

```python
# 의사코드 — 실제는 §2.2에 따라 sync/async 선택
try:
    ensure_profile(
        system_conn=...,
        data_conn=...,
        table_master_id=table_master_id,
        schema="public",
        table_name=table_name,
        force=True,
    )
except Exception as e:
    logger.warning("프로파일링 실패 (table_master_id=%s): %s", table_master_id, e)
```

- **기존 트랜잭션 구조를 깨지 않도록** 프로파일은 **커밋 경계**를 설계한다:  
  - 같은 `conn`에서 HOLD 중인 트랜잭션과 섞이면 안 되면, **독립 연결**으로 프로파일만 수행하는 편이 안전할 수 있다(구현자 판단·주석 필수).

### 4.2 ETL

**권장 수정 파일**: `Backend/etl_server/table_master_hook.py` (`upsert_table_master_after_load` 내부 또는 직후)

- **§2.3 필독**: 현재 이 함수는 `table_master_id`를 **반환하지 않는다**. `ensure_profile`에 ID가 필요하므로, 구현 시 **반드시** 다음 중 하나를 적용한다.
  - **권장**: `INSERT … ON CONFLICT … RETURNING table_master_id`로 UPSERT 문을 바꿔 **동일 트랜잭션에서 ID 획득**, 또는
  - UPSERT `commit` 직후 `SELECT table_master_id FROM table_master WHERE db_type=%s AND table_name=%s`.
- 위에서 획득한 `table_master_id`로 QS와 동일 패턴 `ensure_profile(..., force=True)` 호출.
- **try/except**로 ETL 본 적재와 분리
- 배치로 여러 테이블이 연속 등록될 수 있으므로 **테이블 단위**로 호출·로그

**데이터 DB 연결**: `db_type`(`main`/`dash`)에 맞는 연결을 `Backend.etl_server.service` 등 기존 헬퍼로 획득한다.

### 4.3 백필 `backfill_missing_profiles`

**파일**: `Backend/widget_board_server/column_profiler.py`에 추가

```python
from collections.abc import Callable
from typing import Any

def backfill_missing_profiles(
    system_conn: Any,
    get_data_conn: Callable[[str], Any],
    batch_size: int = 10,
) -> dict:
    """
    get_data_conn: db_type 문자열('main' | 'dash' 등 `table_master.db_type` 값)마다
        프로파일링에 쓸 **데이터 DB 커넥션**을 반환. 호출자가 풀에서 꺼내거나 매 행마다
        연결을 열어도 되나, 사용 후 close 정책은 호출 측·풀 규칙에 맞출 것.
    Returns:
      {"total", "success", "failed", "failures": [{"table_master_id", "table_name", "error"}]}
    """
```

1. `SELECT … FROM table_master WHERE del_yn = 'N'` 이면서 프로파일이 비어 있는 행: `column_profiles IS NULL` **또는** `{}` **또는** JSON 객체인데 `columns` 키가 없거나 `columns`가 빈 배열. `ORDER BY table_master_id`
2. `batch_size`씩 순회, 행마다 `data_conn = get_data_conn(row['db_type'])` → `profile_table(data_conn, …)` → `save_profile_to_table_master(system_conn, …)`
3. 실패 행은 `failures`에 누적

**관리 API(§4.4)** 에서는 `get_data_conn`을 `lambda dt: core_db.get_db_connection()` / dash 전용 팩토리 등 **프로젝트 기존 db 헬퍼로 구현**해 넘긴다.

### 4.4 관리 API(방법 A 기본)

**파일**: `Backend/widget_board_server/router.py`

- `POST .../admin/backfill-profiles`
- 인증: **`require_org_admin`** — `user_dvsn` 이 **sa_dev / sa / a** 인 JWT(일반 O·U·위젯보드 권한만으로는 403)
- Body: `{"batch_size": 10}` 선택
- 응답: §4.3 반환 구조

### 4.5 방법 B(선택)

`Backend/scripts/backfill_column_profiles.py`  
실행: `python -m Backend.scripts.backfill_column_profiles`  
`backfill_missing_profiles(system_conn, get_data_conn, batch_size=…)` 를 **동기** 호출한다(§4.3 시그니처).

---

## 5. Phase 2 — 차트 추천·API 통합

### 5.1 `chart_recommender.py` (신규)

**순수 함수만** — DB 없음. 입력: 프로파일의 `columns` 리스트(dict).

#### 5.1.1 데이터 클래스

```python
@dataclass
class ChartRecommendation:
    rank: int
    chart_type: str
    confidence: float
    x_axis: str | None
    y_axis: list[str]
    color_by: str | None
    aggregation: dict[str, str]
    reason_ko: str
```

`chart_type` 허용 값: `line`, `bar`, `grouped_bar`, `stacked_bar`, `scatter`, `pie`, `number`, `trend`, `combo`, `table`, `heatmap` (사양 나열 유지; 미사용 타입은 규칙에서 생략 가능하나 스키마는 유지)

#### 5.1.2 규칙(우선순위 순 매칭)

| Rule | 조건 | 결과 |
|------|------|------|
| 1 | TEMPORAL ≥ 1, MEASURE == 1 | line, x=첫 temporal, y=[measure], conf 0.95, reason 한글 |
| 2 | TEMPORAL ≥ 1, MEASURE ≥ 2 | combo, x=첫 temporal, y=모든 measure, conf 0.90 |
| 3 | TEMPORAL == 0, DIMENSION ≥ 1, MEASURE == 1 | bar, x=첫 dimension, y=[measure], conf 0.90 |
| 4 | TEMPORAL == 0, DIMENSION ≥ 1, MEASURE ≥ 2 | grouped_bar, conf 0.85 |
| 5 | DIMENSION == 1 & distinct_count ≤ 5, MEASURE == 1 | pie, conf 0.80 — **독립 규칙이 아님** |
| 6 | TEMPORAL ≥ 1, DIMENSION ≥ 1, MEASURE ≥ 1 | stacked_bar, x=temporal, y=[첫 measure], color_by=첫 dimension, conf 0.85 |
| 7 | MEASURE ≥ 2 & IDENTIFIER 존재 | scatter, x=measure1, y=[measure2], conf 0.75 |
| 8 | MEASURE == 1 & TEMPORAL·DIMENSION 둘 다 0 | number, x=None, y=[measure], conf 0.90 |
| 9 | 위 미매칭 | table, conf 0.50, x=None, y=[] |

**Rule 3와 Rule 5의 관계(필수 동작)**:

- **Rule 5(pie)는 Rule 3(bar)가 이미 매칭된 경우에만** “보조 추천”으로 추가한다. Rule 3 단독으로는 pie 후보를 넣지 않는다.
- 정렬 후 rank 부여 시: **Rule 3 결과가 있으면 그것을 rank 1**, 같은 데이터에 Rule 5 조건까지 만족하면 **pie를 rank 2**로 **추가**한다(동일 차트를 두 번 넣지 않음).
- Rule 3이 매칭되지 않으면 Rule 5만으로 pie를 rank 1에 올리지 않는다(모호한 파이 남발 방지). *예외*: 명시적으로 “pie만 가능한 UI”를 둘 경우는 별 스펙.

**Rule 6과 Rule 1·2의 중복(의도됨)**: TEMPORAL·DIMENSION·MEASURE가 모두 있으면 Rule 6(stacked_bar)은 Rule 1(line)·Rule 2(combo)와 **조건이 겹칠 수 있다**. §5.1.4대로 **여러 규칙이 동시에 append**되면 되고, `confidence` 정렬 후 rank를 부여하면 된다(예: MEASURE 1개면 line이 stacked_bar보다 위에 오는 식).

**구현 구조**: `_try_line_rule()`, `_try_combo_rule()`, … 각 Rule별 함수 분리.

#### 5.1.3 `determine_aggregation(column_name, semantic_role) -> str`

사양의 키워드 규칙 + IDENTIFIER → `COUNT_DISTINCT`, 기본 `SUM`.

#### 5.1.4 `recommend(columns, top_n=3) -> list[ChartRecommendation]`

1. `semantic_role`별 분류
2. **규칙 1~8을 전부 순회**하며, 조건을 만족하는 규칙은 **매칭될 때마다 결과 리스트에 append**한다(**첫 매칭에서 중단하지 않음**). Rule 1·6·2 등이 동시에 맞으면 **후보가 여러 개** 쌓이는 것이 정상이다. **Rule 5(pie)만 예외**: §5.1.2대로 **Rule 3(bar)가 매칭된 경우에만** append. **Rule 9(`table`)**: 위 1~8 순회를 마친 뒤 **후보 리스트가 비어 있을 때만** append한다(비어 있지 않으면 Rule 9는 넣지 않음).
3. `confidence` 내림차순 정렬
4. `rank` 1..N 부여
5. 각 결과의 `y_axis`에 대해 `determine_aggregation`으로 `aggregation` 채움
6. 상위 `top_n` 반환

### 5.2 `schemas.py` 추가 모델

- `ColumnProfileItem`
- `ChartRecommendation` (Pydantic)
- `TableProfileResponse`: `table_master_id`, `table_name`, `total_rows`, `sample_count`, `profiled_at`, `columns`, `recommendations`, **`sample_rows`**(§7.3)

### 5.3 `service.py`

#### 5.3.1 `get_table_profile_with_recommendations(conn, table_master_id, project_info_id) -> dict`

1. `table_master`에서 테이블명·`db_type`·`column_profiles`·`profile_updated_at`
2. `table_project_mapping`으로 **해당 프로젝트에 매핑된 테이블인지** 검증 — 아니면 403/404에 해당하는 `ValueError` 등 기존 패턴
3. `ensure_profile` 호출
4. `chart_recommender.recommend(profile["columns"])`
5. 통합 dict 반환

#### 5.3.2 테이블 목록에 `role_summary` (**Phase 2** 범위)

**Phase 배정**: `role_summary` 추가는 **Phase 2**와 같은 PR·스프린트에서 처리한다(GET profile·`chart_recommender`와 함께 FE 적합도에 쓰일 데이터이므로 Phase 3 전에 완료). 수정 파일은 **`Backend/core/db.py`** + **`Backend/query_studio_server/router.py`** 두 곳(§11 `@be-impl` Phase 2 작업에 포함).

위젯보드·쿼리스튜디오가 쓰는 **프로젝트 매핑 테이블 목록**은 `widget_board_server`가 아니라 **쿼리 스튜디오 HTTP API**에서 제공된다.

| 항목 | 위치 |
|------|------|
| HTTP | **`GET /api/list-tables?mapping_usage=widgetboard`** (위젯보드 채널 매핑만) |
| 라우터 함수 | `Backend/query_studio_server/router.py` 의 **`list_tables`** (`# 10.` 근처) |
| 허용 테이블 행 소스 | `Backend/core/db.py` 의 **`get_allowed_tables`** / **`get_allowed_tables_by_project`** (`include_meta=True`일 때 dict 리스트) |

**수정 절차(권장)**:

1. `get_allowed_tables_by_project`의 SELECT에 `table_master`의 **`table_master_id`**, **`column_profiles`** 컬럼을 추가한다(`JOIN`은 기존과 동일).
2. `list_tables` 루프에서 각 테이블 dict에 대해 `column_profiles`가 NULL이면 **`role_summary`: null**, 있으면 JSON의 `columns[].semantic_role`을 세어 **`{"TEMPORAL": n, …}`** 를 붙인다. 순수 함수는 `widget_board_server`에 `summarize_semantic_roles(column_profiles: dict) -> dict | None` 로 두어도 된다.

### 5.4 `router.py` 엔드포인트

- `GET /api/widget-boards/table/{table_master_id}/profile`  
  - 인증: 기존 위젯보드 권한과 동일  
  - 권한: **프로젝트 참가자** + 매핑 검증  
  - 응답: `TableProfileResponse`
- `POST /api/widget-boards/admin/backfill-profiles` (§4.4)

엔드포인트 추가 시 **파일 상단 docstring**의 `[Endpoints]` 목록·본문 `# N.` 주석을 프로젝트 규칙에 맞게 갱신한다.

---

## 6. Phase 4 — 일자 필터 버그(FE, 병렬 가능)

**실행 순서**: §0 주석 참고. 본 섹션은 **GET profile(Phase 2) 이후**에 적용하며, Phase 3과 **병렬 작업 가능**(프로파일 응답의 `hasTemporal`과 동일 로직).

**파일**: `Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx`

1. 상태에 `hasTemporalColumn: boolean` 추가
2. 프로파일 수신 시: `profile.columns.some(c => c.semantic_role === 'TEMPORAL')`
3. `false`: 일자 범위 필터 숨김, `time_grain` 비활성화, X축 기본을 TEMPORAL로 강제하지 않음
4. `true`: 일자 필터 표시, **첫 TEMPORAL**을 X축 기본, `time_grain` 활성

---

## 7. Phase 3 — 프론트엔드

**실행 순서**: §8 표에서 Phase 3이 Phase 4보다 **먼저** 진행되는 것이 일반적이다(§0 참고).

### 7.1 테이블 선택 → 프로파일 로드·자동 적용

- `GET .../table/{tableMasterId}/profile` 호출
- `filterRecommendationsForWidget(recommendations, widgetType)` 후 **1순위**가 있으면 차트 타입·X·Y·color_by·aggregation 자동 세팅(팔레트에 없는 `chart_type`은 UI에 노출·자동 적용 대상에서 제외)
- 사용자 오버라이드 허용
- **`WidgetboardPage` 설정 모달**: 테이블 변경 직후 자동 추천 적용은 **`GET profile` 완료 직후**(같은 async 흐름에서 `pendingSettingsRecApplyRef` 등)에서 처리한다. 프로파일 로드와 별도의 `useEffect`가 `settingsConfig`까지 의존하면 React 배치 순서에 따라 추천 적용이 건너뛸 수 있다.

### 7.2 추천 안내 UI(마법사·설정 공통)

- 차트 **유형 선택은 기존 셀렉터**로만 한다. 추천은 **클릭 가능한 칩이 아니라** 안내 문구(최대 3건)로만 표시한다.
- 각 줄: `formatRecommendationChipLabel(rec)` + `reason_ko`(있으면 회색 보조 문구).
- 백엔드 `recommendations`는 **`uiChartTypesAllowedForWidgetPalette(widgetType)`** 로 필터한 뒤 표시한다(`lineChart` → line/area, `barChart` → bar, `pieChart` → pie, 그 외 팔레트는 **추천 안내 블록 자체를 표시하지 않음**). 필터 결과가 비면 “이 유형에 맞는 추천 없음” 문구만 표시한다.
- 테이블 선택 직후 **자동 적용**은 필터 후 **1순위 한 건**만 `buildConfigPatchFromRecommendation`에 넘긴다.
- 백엔드 `chart_type`이 **`scatter`**이고 UI `CHART_TYPES`에 scatter가 없으면 적용 시 **`line`**으로 매핑한다. 라벨은 `formatRecommendationChipLabel`로 **「라인(산점도 대체) …%」** 처럼 UI와 혼동되지 않게 한다(`chartMatchScore.js`).

### 7.3 컬럼 태그·드롭다운

- X/Y 축 옵션 옆에 `semantic_role` 태그 색상 매핑:  
  TEMPORAL 파랑「일자」, MEASURE 초록「수치」, DIMENSION 주황「분류」, IDENTIFIER 회색「ID」, HIGH_CARDINALITY_TEXT 회색「텍스트」, GEO 보라「위치」

### 7.4 적합도(테이블 목록)

`calculateMatchScore(templateType, columns)` — 아래 `requirements`로 구현한다.

**`bar`(막대) 요구사항 보정**: `MEASURE`만 있으면 모든 테이블이 “적합”으로 몰리어 필터가 무의미해지므로, **최소 `DIMENSION: 1` + `MEASURE: 1`** 을 요구한다(시계열 막대는 `TEMPORAL`을 DIMENSION 대신 쓰는 템플릿이면 별도 `bar_time` 템플릿 타입을 두거나, `TEMPORAL ≥ 1`이면 DIMENSION 요건을 면제하는 등 **한 가지 규칙을 문서·코드에 통일**한다).

```javascript
const requirements = {
  line:        { TEMPORAL: 1, MEASURE: 1 },
  bar:         { DIMENSION: 1, MEASURE: 1 },
  pie:         { DIMENSION: 1, MEASURE: 1 },
  scatter:     { MEASURE: 2 },
  number:      { MEASURE: 1 },
  combo:       { TEMPORAL: 1, MEASURE: 2 },
  stacked_bar: { TEMPORAL: 1, DIMENSION: 1, MEASURE: 1 },
  table:       {}
}
```

- 리스트 3구간: 적합(score==1), 부분(0<score<1), 부적합(score==0, disabled)
- 정렬: score 내림차순, 동일 시 `table_name` 가나다
- 툴팁: 부족한 role 구체 안내
- 백엔드 `role_summary`가 null이면 「프로파일 없음」 표시 + 적합도 계산 스킵 또는 별도 처리

### 7.5 데이터 미리보기 패널(아코디언)

- 제목: `데이터 미리보기 (샘플 {sample_count}행 / 전체 {total_rows}행)`
- 기본 접힘
- 상단: 컬럼 요약 테이블(이름·타입·분류·NULL%·고유값·min·max)
- 하단: 샘플 5행 — 기존 테이블 렌더 컴포넌트 재사용
- 샘플 표 **헤더·열 순서**는 `sample_rows[0]`의 `Object.keys` 순에만 의존하지 않고, **`columns[].name` 순(ordinal 정합)** 을 우선한다(`profileSampleTableColumnNames`).

### 7.6 집계 드롭다운

- Y축 컬럼 선택 시 추천 `aggregation` 기본값 적용
- 옵션: SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX
- **`data_config`에 집계·`colorBy` 키를 아직 넣지 않는 경우(§1.0 기본안)**: UI 상태·차트 렌더 경로에서만 집계를 반영하거나, 단일 지표는 기존 `metricKey`만 저장한다. 저장 동기화는 **Phase 3 이후 별도 작업**으로 미룬다.

### 7.7 API 클라이언트

- `packages/widgetboard/api/*` 또는 공용 `http.js` 패턴에 맞춰 신규 함수 추가(구현 시 `api-client-sync` 스킬 점검).

### 7.8 유지보수 백로그(선택)

- `WidgetboardPage` 설정 모달과 `WidgetDataWizardModal`에 추천 안내·프로파일 미리보기·적합도 `optgroup` 테이블 셀렉트 JSX가 유사하게 중복된다. 필요 시 `RecommendationHints`, `ProfilePreviewAccordion`, `TieredTableSelect` 등으로 추출해 단일화한다.

---

## 8. 실행 순서·일정(참고)

| Phase | 기간(참고) | 내용 |
|-------|------------|------|
| 1 | 2일 | `column_profiler.py` |
| 1-B | 1일 | QS·ETL 트리거, 백필, admin API |
| 2 | 2일 | `chart_recommender.py`, 스키마, 서비스, GET profile, **`GET /api/list-tables` + `get_allowed_tables_by_project`에 `role_summary`** (§5.3.2) |
| 4 | 1일 | FE 일자 필터(병렬) |
| 3 | 3일 | FE 추천·적합도·미리보기 |

**의존성**: 1 → 1-B, 1 → 2 → 3. Phase 2에 **`role_summary`** 가 포함되므로 Phase 3(적합도 UI)은 **Phase 2 완료 후** 착수하는 것이 안전하다. Phase 4는 Phase 1 이후 병렬 가능.

---

## 9. 검증 체크리스트(사양 대조)

- [ ] `column_profiles` / `profile_updated_at` 읽기·쓰기
- [ ] `semantic_role` 6분류 + 우선순위
- [ ] `fetch_column_metadata` PK 포함
- [ ] `fetch_column_stats` total + random sample + distinct/null/min/max
- [ ] `sample_rows` 최대 5행·프로필 API 포함
- [ ] 식별자 정규식 검증
- [ ] 프로파일 실패 시 원장/적재 비실패
- [ ] QS `_upsert_table_master_and_mapping` 직후 try/except 트리거
- [ ] ETL **모든 경로**에서 트리거(§2.3 중앙 훅 권장)
- [ ] `backfill_missing_profiles(system_conn, get_data_conn, …)` + admin POST(§4.3)
- [ ] `chart_recommender`: Rule 1~8 전 순회·다중 append, Rule 5는 Rule 3 있을 때만, Rule 9는 빈 리스트일 때만(§5.1.4)
- [ ] **Rule 5**: Rule 3 매칭 시에만 rank 2 보조(pie)(§5.1.2)
- [ ] `determine_aggregation` 키워드 규칙
- [ ] `get_table_profile_with_recommendations` 매핑 검증
- [ ] 테이블 목록 `role_summary`
- [x] FE: 추천 안내·태그·적합도·미리보기·일자 필터 조건부(§7.1~7.6·`chartMatchScore.js`·설정 모달 타이밍 §7.1 보조)
- [ ] **위젯 저장 연계**: 추천으로 채운 `chart_type`·축·집계·필터가 **실제 저장 페이로드**(기존 `widgets` API body)와 필드 대응되는지 수동 저장 1회로 검증
- [ ] **제작 진입점**: `WidgetboardPage`와 `WidgetDataWizardModal`(및 분할된 설정 컴포넌트) 중 **테이블 선택 직후** 프로파일 API를 호출하는 단일 진입점이 중복·누락 없는지
- [ ] §2 HTTP 경로·동기 스택 정합
- [ ] 파일 상단 한글 docstring·`# N.` 갱신(백엔드 규칙)

---

## 10. 부록 — 적용 DDL(참고용, 저장소에 파일 추가하지 않음)

```sql
ALTER TABLE table_master
  ADD COLUMN IF NOT EXISTS column_profiles    JSONB       NULL,
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN table_master.column_profiles IS
  '컬럼 프로파일링 결과 캐시 — column_profiler.profile_table() 반환값 저장';
COMMENT ON COLUMN table_master.profile_updated_at IS
  '프로파일링 마지막 실행 시각 — TTL(24h) 판단용';
```

---

## 11. 서브에이전트 배정 제안

| Phase | 에이전트 | 비고 |
|-------|----------|------|
| 1, 1-B, 2 | @be-impl | profiler, recommender, QS·ETL 훅, router·service·schemas, **`core/db.py`·`list_tables`의 `role_summary`**(§5.3.2) |
| 3, 4 | @fe-impl | WidgetboardPage, API 클라이언트, CSS |
| 전체 후 | @verifier | cross-check 스킬 기준 API·필드 정합 |

(메인 오케스트레이션 규칙: 코드 수정은 위임·플랜 테이블 후 진행.)

---

**문서 버전**: 2026-04-30 / **26번** 개발 계획서 초안 — 구현 중 발견된 정합 이슈는 본 섹션 §2에 역으로 보강한다.
