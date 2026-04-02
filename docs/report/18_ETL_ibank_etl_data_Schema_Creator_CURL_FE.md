# ETL DB(ibank_etl_data) 실측 스키마 · 생성자(create_user_id) · CURL/FE 체크리스트

**목적**: 운영 DB `information_schema` 기준 컬럼과 앱 코드 정합성 유지. 백엔드 CURL 예제·프론트 표시에 **생성자**를 반드시 포함할 때 참고.

**단일 기준**: 아래 표는 프로젝트에서 확정한 **실측 DDL**(2026-04 기준). `docs/main/04_DB_ARCHITECTURE.md` §13~19와 다를 수 있으며, **코드는 `information_schema` 동적 컬럼 감지**로 양쪽 변형을 흡수한다.

---

## 1. 테이블별 컬럼(실측 요약)

| 테이블 | 생성자 컬럼 | 비고 |
|--------|-------------|------|
| `batch_folder_connections` | `create_user_id` | 구분 컬럼: **`protocol`** (sftp/s3). 레거시 `folder_type`만 있는 DB도 지원. |
| `batch_jobs` | `create_user_id` | |
| `etl_connections` | `create_user_id` | DB 종류 컬럼: **`source_type`** 또는 레거시 **`db_type`**. 비밀번호: **`encrypted_password`** 또는 **`password`**. `extra_config`(jsonb) 있으면 INSERT 시 `{}` 기본값 포함. |
| `etl_jobs` | `create_user_id` | |
| `etl_storage_connections` | `create_user_id` | 종류 컬럼: **`source_type`** 또는 레거시 **`storage_type`**. `config_json` 필수. |
| `etl_tables` | `create_user_id` | |
| `etl_transform_rules` | *(없음)* | |
| `etl_batch_target_registry` | *(없음)* | PK: **`id`** (실측). 레거시 `registry_id` PK DB도 지원. |

기타 메타: `batch_folder_sftp`, `batch_folder_s3`, `batch_loaded_keys`, `batch_run_history`, `etl_batch_target_registry`의 나머지 컬럼은 기존 서비스 코드의 동적 INSERT/SELECT와 일치하도록 유지.

---

## 2. API 응답·생성자 표시(프론트)

다음 목록 API/상세는 **`create_user_label`**(및 가능 시 `create_user_id`)를 내려주도록 백엔드에서 맞춤. 프론트 `packages/etl`는 해당 필드를 표시.

| 영역 | 컴포넌트/기능 | 필드 |
|------|----------------|------|
| 폴더 연결 목록 | `FolderConnectionListFile.jsx` | `create_user_label` |
| ETL 테이블 목록 | `ETLTableList.jsx` | `create_user_label` |
| 배치 Job 목록 | `BatchJobListFile.jsx` | `create_user_label` |
| Job 이력 | `JobHistoryPanel.jsx` | `create_user_label` |
| 배치 타겟 레지스트리(ETL 목록 연동) | `ETLTableList` 등 | `create_user_label`(배치 job JOIN) |

`user_info` 테이블이 system 스키마에 없으면 닉네임/이메일 대신 `ID {n}` 형식으로 라벨링.

---

## 3. CURL/문서화 시 생성자 포함 체크리스트

JWT가 필요한 엔드포인트에서 **등록·생성 POST** 호출 시, 백엔드가 `create_user_id`를 저장한다. CURL 예제 작성 시:

1. 헤더: `Authorization: Bearer <token>` (운영 가이드에 맞는 키명).
2. 응답 JSON 예시에 **`create_user_id`**, 목록 응답에는 **`create_user_label`** 포함 여부를 명시.
3. 다음 경로군을 문서화할 때 생성자 컬럼을 빠뜨리지 않을 것:
   - `POST /api/etl/connections`, `POST /api/etl/storage-connections`
   - `POST /api/etl/tables`, 파일 업로드 기반 테이블 생성 흐름
   - `POST /api/etl/batch/folder-connections`, `POST /api/etl/batch/jobs`
   - Job 생성을 유발하는 `POST .../run` 등(내부 `insert_job`에 `create_user_id` 전달)

---

## 4. 코드 쪽 DDL 차이 흡수 포인트

| 이슈 | 처리 |
|------|------|
| `batch_folder_connections.folder_type` vs `protocol` | `service_file._folder_conn_type_*` — INSERT는 물리 컬럼 하나만 사용, SELECT는 API용 `folder_type` 별칭 통일. |
| `etl_batch_target_registry.registry_id` vs `id` | `_registry_pk_column`, `upsert`/`delete`/`list`에서 PK 컬럼 동적 선택, 목록 SELECT는 `registry_id` 별칭 유지. |
| 존재하지 않는 컬럼 | `service._table_columns_lower` 기반으로 INSERT/SELECT에서 제외. |

---

## 5. 전수검사 요약 (코드·연동·테스트)

- **SQL 컬럼**: `etl_connections`·`etl_storage_connections`·`batch_folder_connections`·`etl_batch_target_registry`는 `information_schema` 기반 동적 매핑(`service.py`, `service_file.py`). 하드코딩 `db_type`/`password`/`storage_type`/`folder_type`/`registry_id`만 가정하는 INSERT/SELECT는 제거·보완됨.
- **프론트 ↔ API 경로**: `tests/etl_api_route_audit.py`로 `etlClient.js`의 `/api/etl/*` 호출과 FastAPI 등록 경로 패턴 대조. **누락 경로 0건**(스크립트 통과).
- **단위 테스트**: `tests/test_transform_engine.py` — 로드 경로를 `Backend/etl_server/transform_engine.py`로 수정 후 **15 passed**.
- **연결 스모크**: `TestClient`로 `GET /health` → **200**, DB connected. `GET /api/etl`·`/api/etl/batch` → **401**(JWT·인프라 게이트 정상).
- **문서 `docs/main/04_DB_ARCHITECTURE.md`**: ETL 절은 여전히 구 DDL(`db_type`, `registry_id` 등) 서술이 있을 수 있음. **런타임 기준은 본 문서(18)·코드 동적 분기**를 우선.

## 6. 후속 작업(사용자 메모 반영)

- **CURL 샘플 문서**: 위 체크리스트대로 생성자 필드를 응답 예시에 포함해 갱신.
- **추가 UI**: 저장 DB 연결·원천 DB 연결 목록 화면에 `create_user_label` 열이 필요하면 동일 패턴으로 확장.
