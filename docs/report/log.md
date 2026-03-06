## 2026-03-06 파일 배치: 이력에 스킵/에러된 파일 매 주기 재시도 방지

**배경:** 한 번 skipped(duplicate_checksum, file_size_exceeded 등) 또는 error로 기록된 파일이 다음 주기마다 pending에 다시 포함되어 매번 다운로드·체크섬·스킵을 반복함. 이력/문제 파일 목록으로 이미 확인 가능하므로 재시도할 필요 없음.

**적용 내용:**
- **Backend/etl_server2/service_file.py**
  - `get_skipped_filenames_set(batch_job_id, conn, max_runs=200)`: 배치 실행 이력(batch_run_history)에서 file_list의 status가 skipped 또는 error인 항목의 filename 집합 반환. 최근 max_runs개 run만 스캔.
- **Backend/etl_server2/batch_executor_file.py**
  - create_batch_run 후 `get_skipped_filenames_set` 호출 → pending 목록에서 해당 파일명 제외. 제외 후 pending이 비면 run을 success·files_processed=0으로 마치고 return하여 불필요한 다운로드 없음.

**변경 파일:** Backend/etl_server2/service_file.py, Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-03-06 파일 배치 "마지막 상태"가 성공인데 목록에 오류로 나오는 현상 수정

**배경:** 실행 이력에서는 최근 run이 success인데, 배치 Job 목록의 "마지막 상태"만 오류로 표시되는 경우가 있음. 원인: 목록은 `batch_jobs.last_run_status`를 그대로 사용하며, 파일 배치 실행기(batch_executor_file)에서 **실행이 성공/부분성공으로 끝난 뒤** `update_job_status(batch_job_id, "success")` 호출이 예외를 던지면, 바깥 `except`에서 `update_job_status(batch_job_id, "error", ...)`가 호출되어 정상 완료인데도 last_run_status가 "error"로 덮어써짐.

**적용 내용:**
- **Backend/etl_server2/batch_executor_file.py**
  - `run_completed_ok` 플래그 추가: `finish_run`으로 run을 success/partial_error(또는 cancelled)로 마친 뒤 `update_job_status("success")` 호출 직전에 `True`로 설정.
  - `except Exception` 블록에서 `update_job_status(batch_job_id, "error", ...)` 호출을 `if not run_completed_ok:` 안으로 이동. 성공/취소로 이미 끝난 뒤 `update_job_status("success")`만 실패한 경우에는 "error"로 갱신하지 않음.
  - 취소 경로(사용자 취소 시 finish_run(cancelled) 후 update_job_status("success"))에서도 동일하게 `run_completed_ok = True` 설정 후 update 호출.
- **Backend/etl_server2/batch_executor_db.py**: 동일한 패턴으로 `run_completed_ok` 플래그 추가, 성공 후 `update_job_status("success")` 실패 시 except에서 "error"로 덮어쓰지 않도록 수정.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, Backend/etl_server2/batch_executor_db.py, docs/report/log.md.

---

## 2026-03-06 테이블 목록 미리보기(저장 후 미리보기)에 변환 룰·타입 캐스트 적용

**배경:** ETL 테이블 목록의 "미리보기"(etl-table-list__preview)는 GET /tables/{id}/preview로 호출되며, 기존에는 소스 원본만 보여주고 변환(transform)·타입 캐스트가 반영되지 않았음. 실제 저장 시에는 apply_rules → apply_mapping_type_cast 후 적재되므로, 미리보기도 저장될 모습으로 보여줘야 함.

**적용 내용:**
- **Backend/etl_server2/preview_service.py**
  - `_get_preview_with_transform(etl_table_id)`: get_source_dataframe → list_transform_rules → apply_rules → apply_mapping_type_cast 순으로 적용 후 columns/preview_columns/preview_rows 구성. apply_rules·apply_mapping_type_cast 실패 시 경고 로그 후 기존 데이터로 진행.
  - `get_preview(etl_table_id)`: 기존 _preview_file/_preview_db 분기 제거, `_get_preview_with_transform` 호출만 하도록 변경. 파일/DB 공통으로 변환·타입 캐스트가 적용된 "저장 후 테이블 미리보기"가 표시됨.

**변경 파일:** Backend/etl_server2/preview_service.py, docs/report/log.md.

---

## 2026-03-06 DB 연결 실패 시 로그 과다 출력 완화 및 복구 연결 분리

**배경:** PostgreSQL(49.247.47.206) 또는 MySQL 소스 연결이 끊기면 queue_worker·report _save_table_worker·batch_executor_db에서 동일 예외가 반복 발생하고, 매번 전체 트레이스백이 출력되어 터미널 로그가 비대해짐. 또한 batch 복구(finish_run, update_job_status) 시 이미 끊긴 sys_conn을 재사용해 InterfaceError가 연쇄 발생.

**적용 내용:**
- **etl_server2/queue_worker.py, etl_server/queue_worker.py**: `psycopg2.OperationalError` 중 "connection"/"network" 포함 시 한 줄 경고만 출력하고 60초 동안 동일 유형 재로그 억제. 그 외 예외는 기존대로 `logger.exception` 유지.
- **batch_executor_db.py**: 예외 처리 시 `finish_run`, `update_job_status` 호출에 `conn=None` 사용. 서비스 내부에서 새 시스템 DB 연결을 생성하므로 끊긴 연결로 인한 복구 실패 방지.
- **report.py _save_table_worker**: 연결 관련 `psycopg2.OperationalError` 시 전체 traceback 대신 한 줄 경고 + 60초 억제, 재시도 전 대기 10초로 설정. 그 외 예외는 기존대로 traceback + 0.5초 대기.

**변경 파일:** Backend/etl_server2/queue_worker.py, Backend/etl_server/queue_worker.py, Backend/etl_server2/batch_executor_db.py, Backend/api_server/routers/report.py, docs/report/log.md.

---

## 2026-03-05 ETL2 변환→Upsert 파이프라인 본질적 검증

**배경:** 컬럼 변환(transform_rules_service + transform_engine) 후 upsert 시 타입 오류(bigint=text 등)를 단편적으로 수정한 것에 그치지 않고, 변환 룰·엔진 출력이 load_dataframe/_batch_upsert와 끝까지 호환되는지 검증 체계가 필요함.

**적용 내용:**
- **Backend/etl_server2/transform_upsert_verification.py** 신규:
  - transform_engine 출력 + apply_mapping_type_cast 결과가 load_dataframe/_batch_upsert와 호환되는지 검증(컬럼 집합, pandas dtype→PG 캐스트 매핑).
  - `PANDAS_DTYPE_TO_PG_CAST`: Int64, int64, float64, datetime64, bool, object 등 → bigint, double precision, timestamp, boolean, text 등.
  - `get_expected_pg_cast_for_series(series)`: Series dtype → PG 캐스트명.
  - `verify_transform_output_columns(df, target_columns)`: 중복 컬럼·누락 컬럼·미지원 dtype 검사, 에러 문자열 목록 반환.
  - `run_dry_run_pipeline(sample_df, rules, column_mapping)`: apply_rules → apply_mapping_type_cast 드라이런, errors + dtype_map 반환(DB 없이 실행 가능).
  - `python Backend/etl_server2/transform_upsert_verification.py`로 최소 드라이런 실행 시 OK 및 dtype_map 출력.
- **load_service_file.py**:
  - `_batch_upsert` docstring에 Type flow 문단 추가: DataFrame(pandas) → itertuples(Python) → psycopg2 → VALUES(text 추론) → information_schema 기반 명시 캐스트로 bigint=text 등 방지. SQL 단계에서는 타겟 테이블 컬럼 타입이 기준.
  - 상단 [Transform→Upsert 검증] 섹션: transform_upsert_verification 모듈 참조 및 run_dry_run_pipeline/verify_transform_output_columns 안내.

**변경 파일:** Backend/etl_server2/transform_upsert_verification.py(신규), Backend/etl_server2/load_service_file.py, docs/report/log.md.

---

## 2026-03-05 ETL 삭제 시 batch_jobs 연쇄 삭제 및 last_synced_at 초기화

**배경:** (1) ETL 목록에서 "삭제" 후에도 etl_tables 행이 남거나, 배치 등록만 해둔 ETL을 지울 때 batch_jobs가 남는 문제. (2) 증분 모드에서 한 번 실행하면 last_synced_at이 설정되어, "방금 만든 ETL"처럼 보여도 다음 실행부터는 증분만 조회됨.

**수정 내용:**
- **delete_etl_table / delete_etl_table_row_only**: 해당 etl_table_id를 참조하는 `batch_jobs` 및 자식 `batch_loaded_keys`, `batch_run_history`를 선삭제한 뒤 etl_tables 삭제. batch_jobs 등 테이블이 없으면(구버전 DB) 예외 시 rollback 후 etl_* 삭제만 진행.
- **update_etl_table**: `clear_last_synced_at=True` 시 `last_synced_at`을 NULL로 초기화. 다음 실행 시 증분 조건 없이 전체 조회.
- **PATCH /api/etl2/tables/:id**: body에 `clear_last_synced_at: true` 추가. 설정 모달 등에서 "증분 기준 초기화" 시 사용 가능.

**동작 정리:** last_synced_at은 생성 시 NULL이며, **적재 1회 완료 후** db_load_service에서 갱신됨. 따라서 "방금 만든 ETL"이라도 한 번 실행하면 last_synced_at이 채워지는 것이 정상. 다시 전체 적재하려면 동기화 모드를 "전체"로 바꾸거나, PATCH로 clear_last_synced_at=true 후 실행.

**변경 파일:** Backend/etl_server2/service.py, Backend/etl_server2/router.py, docs/report/log.md.

---

## 2026-03-05 DB 연결 ETL 목록 업로드 시 인덱스 미적용 원인 및 수정

**현상:** DB 연결에서 컬럼변환·인덱스 설정 후 ETL 목록 업로드 및 적재를 실행해도 생성된 테이블에 설정한 인덱스가 없음.

**원인 (프론트엔드 TargetTableSelectModal buildIndexDefinitions):**
1. **필터 오류:** 소스 DB 인덱스의 `columns`는 **소스** 컬럼명인데, 포함 여부를 **타겟** 컬럼명 집합(`targetColumnNamesForPk`)으로 검사함. 컬럼 매핑으로 이름이 바뀌면 모두 제외되어 `index_definitions`가 빈 배열로 전달됨.
2. **컬럼명 미변환:** 통과하더라도 반환 객체의 `columns`에 **소스** 컬럼명을 그대로 넣고 있음. 백엔드는 타겟 테이블(column_mapping 기준 **타겟** 컬럼명)에 대해 `CREATE INDEX ... ON table (소스컬럼명)`을 시도해 컬럼 부재로 실패하고, `logger.warning` 후 스킵되어 인덱스가 생성되지 않음.

**수정 내용:**
- `TargetTableSelectModal/index.jsx`의 `buildIndexDefinitions()`:
  - 소스 인덱스 사용 시 **소스→타겟 컬럼명 매핑** 구성 (신규 테이블: `newTableTargetNames`/`newTableExcluded`, 기존 테이블: `sourceToTarget`).
  - 각 소스 인덱스의 컬럼을 위 매핑으로 **타겟 컬럼명**으로 변환. 매핑되지 않은 컬럼이 있으면 해당 인덱스는 제외.
  - 반환 시 `columns`에 **타겟 컬럼명**만 넣어 백엔드 `_create_indexes_on_target`가 실제 테이블 컬럼명으로 CREATE INDEX 하도록 함.

**변경 파일:** Frontend/.../TargetTableSelectModal/index.jsx, docs/report/log.md.

---

## 2026-03-05 DB 배치잡에 변환 룰(Transform Rules) 적용

**배경:** DB 연결 ETL을 배치잡으로 등록해 주기 실행할 때, `run_db_batch_job`에서는 `apply_mapping_type_cast`만 적용되고 `etl_transform_rules` 기반 변환(cleansing, string, masking, type_cast 등)이 적용되지 않던 문제.

**적용 내용:**
- `Backend/etl_server2/batch_executor_db.py`의 `run_db_batch_job` 내부:
  - `transform_rules_service` import 추가, Dependencies에 명시.
  - `while True:` 루프에서 DataFrame 생성·헤더 유사 행 제거 후, `etl_table_id`가 있을 때만 `list_transform_rules(etl_table_id)`로 룰 조회 → `apply_rules(df, rules)` 적용. 룰 적용 실패 시 `logger.warning` 후 적재는 계속 진행.
- 실행 경로별 정합성: `run_file_load` / `run_db_load`와 동일하게 배치잡에서도 변환 룰 → column_mapping 형변환 순서로 적용.

**변경 파일:** Backend/etl_server2/batch_executor_db.py, docs/report/log.md.

---

## 2026-03-05 Cursor 대용량 diff 방지 개선 (룰·파일 분할·안내)

**배경:** 1600줄+ 단일 파일에서 StrReplace 매칭 실패 시 Write 도구로 전체 덮어쓰기가 발생해 +1611/-1610 수준의 diff가 생기는 문제. 원인: 파일 크기, Cursor 버전/apply 모델 변화, Format on Save·포맷터 확장.

**적용한 개선:**
1. **Write 도구 제한 룰** — `.cursor/rules/write-tool-restriction.mdc` 추가. 기존 파일 수정 시 Write 사용 금지, StrReplace만 사용, 매칭 실패 시 read_file 후 재시도·3회 실패 시 사용자 보고.
2. **TargetTableSelectModal 분할** — 1611줄 단일 파일을 `components/TargetTableSelectModal/` 폴더로 분할(index.jsx, constants.js, CodeMapInlineEditor, TransformCell, TableSelector, ColumnMappingSection, PreviewSection). 메인 index는 여전히 ~827줄; 추가로 훅 분리 시 300~400줄 목표 달성 가능.
3. **사용자 안내 (직접 확인 권장):**  
   - **Format on Save:** Cursor Settings → "format on save" 검색 → 체크 해제. 저장 시 포맷터가 전체 리포맷하면 diff가 파일 전체로 나타날 수 있음.  
   - **확장 없이 테스트:** `cursor --disable-extensions` 로 실행해 포맷터 확장이 원인인지 확인.  
   - **모델 변경:** StrReplace vs Write 선택 패턴이 모델마다 다르므로, 동일 작업을 다른 모델로 시도해 비교 가능.

**변경 파일:** .cursor/rules/write-tool-restriction.mdc(신규), TargetTableSelectModal 분할(아래 항목 참조).

---

## 2026-03-05 오케스트레이션 룰 강화 (메인=기획·위임·정리, 1개 이상 파일=서브 위임)

**목적:** 메인 에이전트가 대용량 파일을 직접 수정할 때 발생하는 거대 diff(+900/-900)·컨텍스트 급증·간헐적 적용 오류를 줄이기 위해, 코드 수정은 서브에이전트에만 맡기고 메인은 기획·위임·결과 정리만 하도록 변경.

**변경 내용 (tech-lead-orchestration.mdc):**
- **메인 역할**: 코드 직접 수정 금지. 플랜 수립 → @에이전트명으로 위임 → 서브 결과 수신 후 요약·제공만 수행.
- **위임 조건**: 수정 대상이 **코드 파일 1개 이상**이면 반드시 서브에이전트 위임. (기존: 3개 이상·백엔드+프론트 등)
- **단독 처리 예외 축소**: 문서/주석만, 설정·룰 파일만, 사용자 명시 요청 시에만 메인 직접 수정. 단일 코드 파일·CSS만 수정도 원칙적으로 위임.
- **대용량 단일 파일**: 수백 줄 이상이면 위임 권장(StrReplace 실패 시 Write fallback·거대 diff 방지).

---

## 2026-03-05 ETL2 변환 설정 유지 (모달↔부모 스냅샷)

**문제:** 모달 닫히면 변환 state 소멸. 신규 등록 시 etlTableId 없어 API 복원 불가.

**해결:** 변환 설정을 부모(DbConnectionForm)가 보관하고, 모달 재오픈 시 currentTransformSettings로 복원. 적용 시 onSelect 5번째 인자로 transformSettings 스냅샷 전달.

- **constants.js:** buildEmptyTransformSettings(), TRANSFORM_OPTION_LABELS 추가.
- **모달 index.jsx:** currentTransformSettings prop. open 시 변환 state 초기화 후, etlTableId 없을 때만 currentTransformSettings 복원 useEffect. handleApply에서 currentSettings 조립 후 onSelect(tableName, mapping, pk, idx, currentSettings) 3분기 모두 적용.
- **DbConnectionForm:** transformSettings state, currentTransformSettings/onSelect(tSettings) 전달. 설정 요약에 변환 룰 컬럼 수·종류별 카운트 표시. selectedSourceTable 변경 시 transformSettings/매핑/PK/인덱스/타겟 초기화. 등록 성공 후 setTransformSettings(buildEmpty...).
- **FileUploadForm:** onSelect 4인자 유지(5번째 인자 무시). 변경 없음.

---

## 2026-03-05 ETL2 변환 UI UX 개선 (타입 변환 선택·라벨·서브 행)

**작업:** 변환 기능이 “기능은 있는데 사용 불가”에 가깝던 문제 해결.

- **A-1. 타입 변환 대상 선택:** constants에 TYPE_CAST_TARGET_OPTIONS 추가. typeCastConfig state 추가, getAssembledRules·룰 복원·preview 초기화에 반영. TransformDetailRow에서 type_cast/cleansing_and_type_cast 시 “변환 대상 타입” 서브 드롭다운 표시.
- **A-2. 변환·문자열·마스킹·실패 시 라벨:** TRANSFORM_OPTIONS(변환 없음, 공백·빈값 정리, 값 치환 (M→남성), 문자열 가공, 마스킹 (비가역)), STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, ON_ERROR_OPTIONS 예시/설명 보강.
- **B. 매핑 테이블 가독성:** TransformCell은 변환 종류 select만 표시. 상세 설정은 해당 행 아래 서브 행(TransformDetailRow)으로 분리. 새 테이블 colSpan=8, 기존 테이블 colSpan=7.
- **파일:** constants.js, index.jsx, TransformCell.jsx, TransformDetailRow.jsx(신규), ColumnMappingSection.jsx, etl.css. 빌드·린트 통과.

---

## 2026-03-05 TargetTableSelectModal 패키지 연결 검증 (cross-check)

**작업:** 패키지 분할 후 import·API·CSS·export 연결 정합성 검증.

- **import 경로:** DbConnectionForm.jsx, FileUploadForm.jsx에서 `lazy(() => import('./TargetTableSelectModal'))` → 폴더 `TargetTableSelectModal/index.jsx` default export 정상 해석. ✅
- **내부 export:** index.jsx → TableSelector, ColumnMappingSection, CustomIndexSection, PreviewSection import. ColumnMappingSection.jsx에서 `export function ColumnMappingSection`, `export function CustomIndexSection` 존재. ✅
- **constants·TransformCell·CodeMapInlineEditor:** index/ColumnMappingSection/TransformCell에서 ./constants.js, ./TransformCell.jsx, ./CodeMapInlineEditor.jsx 상대 경로 정상. ✅
- **client.js ↔ router:** etl2ListTargetTables(GET /api/etl2/target-tables), etl2ListTargetColumns(GET /api/etl2/target-columns), etl2TransformPreview(POST /api/etl2/transform/preview), etl2ListTransformRules(GET /api/etl2/tables/{id}/transform-rules), etl2CreateTransformRule(POST), etl2DeleteTransformRule(DELETE) — 라우터 prefix /api/etl2 및 경로 일치. ✅
- **CSS:** etl.css에 etl-target-select-modal__* 클래스 정의 존재. 분할된 컴포넌트에서 동일 클래스명 사용. ✅
- **빌드:** `npm run build` 성공(exit 0). ✅

**요약:** 통과 6건, 실패 0건.

---

## 2026-03-05 TargetTableSelectModal 논리 단위 분할 (파일당 300~400줄 이하)

**작업:** TargetTableSelectModal.jsx(1611줄)를 components/TargetTableSelectModal/ 폴더로 분할. 기존 동작·export·import 경로 유지.

- **구조:** index.jsx(메인 모달·state/effect/handler·footer·변환 도움말), constants.js(상수·순수 함수), CodeMapInlineEditor.jsx, TransformCell.jsx, TableSelector.jsx, ColumnMappingSection.jsx(+ CustomIndexSection), PreviewSection.jsx.
- **규칙:** CSS 클래스명(etl-target-select-modal__*) 유지. 검증된 로직(loadTables, getAssembledRules, buildIndexDefinitions, saveRulesIfNeeded, handleApply, handlePreviewClick, useEffect/useCallback) 수정 없이 index.jsx에 유지. JSX만 서브 컴포넌트로 분리.
- **import:** DbConnectionForm, FileUploadForm에서 `import('./TargetTableSelectModal')`로 폴더 index 사용. 기존 단일 파일 TargetTableSelectModal.jsx 삭제.
- **파일:** TargetTableSelectModal/constants.js, CodeMapInlineEditor.jsx, TransformCell.jsx, TableSelector.jsx, ColumnMappingSection.jsx, PreviewSection.jsx, index.jsx. 각 파일 상단 file-header 규칙 한글 설명·Main Functions·Dependencies 갱신.

**변경 파일:** Frontend/.../TargetTableSelectModal/* (신규 7개), DbConnectionForm.jsx, FileUploadForm.jsx. 삭제: TargetTableSelectModal.jsx. docs/report/log.md.

---

## 2026-03-05 ETL2 프로덕션 배포 전 정리 (남은 버그·중간/낮음·구조 개선 일괄)

**작업:** 즉시/높음 이외 남은 버그, 미리보기 stale·룰 에러 메시지, TransformCell·saveRulesIfNeeded 구조 개선, get_preview 주석까지 한 번에 반영.

- **A. typeFamily / inferredTypeToPg datetime 오탐 (프론트):** `t.includes('date')`/`t.includes('time')` 제거. `DATETIME_TYPES` 배열과 `t === x` 정확 매칭만 사용해 `updated_at_text` 등이 datetime으로 오탐되지 않도록 수정. inferredTypeToPg도 동일하게 datetime 계열은 정확 매칭만.
- **A. CodeMapInlineEditor useEffect deps:** `configMapKey = JSON.stringify(config.map || {})` 추가 후 deps에 `[sourceName, configMapKey]` 사용. 부모에서 기존 룰(etl2ListTransformRules) 복원 후 config.map이 바뀌면 items가 갱신되도록 함.
- **A. NEW_TABLE tableName 빈값 시 피드백:** `rawTableName`으로 사용자 입력만 검사, 빈 문자열이면 `window.alert('테이블명을 입력해 주세요.')` 후 return. fallback `'new_table'` 제거해 빈 상태로 적용되는 경로 차단.
- **B. 미리보기 stale 초기화:** `transformKind`/`stringConfig`/`maskingConfig`/`codeMapConfig` 변경 시 `setPreviewData(null)`, `setPreviewError(null)` 호출하는 useEffect 추가.
- **B. 룰 삭제/등록 에러 메시지 구체화:** `saveRulesIfNeeded(etlTableId, allSourceColumnNames, assembled)` 공통 함수 추출. 삭제 단계 실패 시 `throw new Error('기존 룰 삭제 중 실패: ' + ...)`, 등록 단계 실패 시 `throw new Error('새 룰 등록 중 실패 (일부 삭제된 상태일 수 있음): ' + ...)`로 구분해 사용자 재시도 판단 가능하도록 함.
- **C. TransformCell 컴포넌트 분리:** 새 테이블/기존 테이블 매핑 테이블의 변환 열(select + 값매핑/문자열/마스킹 UI)을 공통 `TransformCell({ excluded, src, sourceColumns, transformKind, setTransformKind, ... })`로 추출. 한쪽 수정 시 양쪽 동일 반영.
- **C. handleApply 내 saveRulesIfNeeded 사용:** NEW_TABLE 분기·기존 테이블(소스매핑) 분기에서 룰 삭제/등록 블록을 `await saveRulesIfNeeded(...)` 호출로 치환.
- **D. get_preview 주석:** docstring에 "양쪽 조건(DB·파일) 만족 시 DB 우선" 한 줄 추가.

**변경 파일:** Frontend/.../TargetTableSelectModal.jsx, Backend/etl_server2/preview_service.py, docs/report/log.md.

---

## 2026-03-05 ETL2 버그/안정성·UX 개선 (리뷰 반영)

**작업:** 코드 리뷰 우선순위(즉시·높음) 항목 반영.

- **즉시 — DB 커넥션 try/finally (preview_service.py):** `_preview_db`, `_get_source_df_db`에서 conn을 열고 쿼리 실행 후 예외가 나도 항상 닫도록 `try`/`finally` 패턴 적용. `conn = None` 초기화 후 `finally`에서 `if conn is not None: conn.close()` 호출.
- **즉시 — handleApply onClose 순서 (TargetTableSelectModal.jsx):** try 블록 안에서 `onClose()` 호출 제거. `applied` 플래그를 두고 적용 성공 시에만 `applied = true`, `finally`에서 `setApplyLoading(false)` 후 `if (applied) onClose()` 호출해 언마운트 후 setState 방지.
- **높음 — SQL 식별자 이스케이프 (preview_service.py):** `_quote_ident_pg`(PostgreSQL/Oracle: `"` → `""`), `_quote_ident_mysql`(MySQL: `` ` `` → ` `` ` ``) 헬퍼 추가. `_preview_db`/`_get_source_df_db`에서 스키마·테이블·컬럼명에 위 헬퍼 사용해 단순 문자열 감싸기 대신 이스케이프 적용.
- **높음 — CodeMapInlineEditor 중복 키 (TargetTableSelectModal.jsx):** 값 매핑을 `Object.entries`/`Object.fromEntries` 대신 내부 state `items = [{ key, value }, ...]` 배열로 관리. `setKey(idx, key)` 시 해당 인덱스만 갱신하고 `flushMap`으로 객체 변환해 전달해, 동일 키 입력 시 행이 사라지는 문제 제거. `sourceName` 변경 시 `useEffect`로 items 초기화.
- **기타:** `_normalize_mapping`에서 JSON 파싱 실패 시 `logger.warning` 로그 추가. `get_source_dataframe`/`get_preview`에서 DB 소스(connection_id·source_table) 있으면 파일보다 DB 우선 분기해, 양쪽 조건 동시 만족 시 의도치 않게 파일로 처리되던 문제 수정.

**변경 파일:** Backend/etl_server2/preview_service.py, Frontend/.../TargetTableSelectModal.jsx, docs/report/log.md.

---

## 2026-03-05 ETL2 모달 max-height·상하 스크롤 통일

**작업:** 배치잡 실행 이력 모달 및 전체 모달에 적정 max 높이 고정 + 내용 초과 시 상하 스크롤 적용.

- **실행 이력 모달 (ETLPage.jsx):** `etl-add-file-modal__box`에 `etl-add-file-modal__box--scroll-body` 추가, 헤더 아래 콘텐츠를 `etl-add-file-modal__body`로 감싸 헤더 고정·본문만 스크롤.
- **etl.css:** `.etl-add-file-modal__box`에 `max-height: 90vh`, `overflow-y: auto` 적용(기본: 전체 박스 스크롤). `--scroll-body` 수정자 시 flex 컬럼 + `__body`에 `flex: 1; min-height: 0; overflow-y: auto`로 본문만 스크롤.
- **BatchJobListFile:** DB 소스 미리보기 모달에 `--scroll-body` 적용, 인라인 `maxHeight`/`overflow` 제거하여 공통 스타일 사용.
- **PreviewModal:** `.etl-preview-modal__body`에 `flex: 1; min-height: 0` 추가, `.etl-preview-modal__head`에 `flex-shrink: 0` 추가.
- **PkColumnsModal:** `.etl-pk-modal__box`에 `max-height: 90vh; overflow-y: auto` 추가.
- **EtlTableSettingsModal:** 기존 `max-height: 90vh; overflow-y: auto` 유지.
- **TargetTableSelectModal:** `.etl-target-select-modal__body`에 `flex: 1; min-height: 0` 추가(박스는 기존 max-height·flex 유지).
- AddFileModal, PatternSelectModalFile 등 `etl-add-file-modal__box` 사용 모달은 공통으로 90vh 제한·전체 스크롤 적용.

---

## 2026-03-05 ETL 변환 UI 개선 구현 (11번 화면 설계 기준)

**작업:** 11_ETL_Transform_Upgrade_Guide.md §2 화면 설계 Step UI-1~UI-8 반영.

- **UI-1:** Backend — preview_service에 get_source_dataframe, _get_source_df_db, get_transform_preview 추가. router에 TransformPreviewBody, POST /transform/preview 엔드포인트 추가.
- **UI-2:** client.js — etl2TransformPreview(body) 함수 추가.
- **UI-3:** TargetTableSelectModal — 미리보기 버튼(etlTableId·hasSourceMapping 시), handlePreviewClick, previewData 패널(테이블·변환 실패 N건), previewLoading/previewError.
- **UI-4:** 문자열 변환 — substring(시작·길이), replace(찾을·바꿀), regex_replace(정규식·치환), concat(합칠 컬럼 멀티셀렉트·구분자) 입력 필드 추가(새 테이블/기존 테이블 매핑 테이블 모두).
- **UI-5:** 변환 옵션 안내 — 값 매핑·문자열 변환·마스킹 설명 및 Before→After 예시 추가. 정리+타입 변환 순서 문구 정리.
- **UI-6:** handleApply 진입 시 assembled 중 rule_type === 'masking' 있으면 window.confirm 비가역 경고 후 진행/취소.
- **UI-7:** 매핑 헤더에 "변환 설정된 컬럼만 보기" 토글. displaySourcesForNewTable/displaySourcesForExisting 사용. 변환 설정 행에 etl-target-select-modal__row--has-transform 클래스(배경 강조).
- **UI-8:** 값 매핑 4개 이상 시 "편집" 클릭 시 팝오버(코드맵 인라인 에디터 + 닫기). 4개 미만은 기존 인라인 토글 유지.
- **CSS:** etl.css에 미리보기 패널·필터 토글·row--has-transform·code-map-popover 스타일 추가.

---

## 2026-03-05 ETL Transform 가이드 — 화면 설계 섹션 추가 (11번 문서)

**작업:** 11_ETL_Transform_Upgrade_Guide.md에 **§2 화면 설계 (변환 UI 개선)** 섹션 추가.

- **목표**: 저장 전 변환 확인·최소 입력·선택 위주 UX·마스킹 비가역 경고 등 8개 제안 반영.
- **Step UI-1**: 백엔드 POST /api/etl2/transform/preview API 스펙(etl_table_id, rules, column_mapping → preview_columns, preview_rows, transform_failed_count).
- **Step UI-2**: client.js etl2TransformPreview(body) 함수.
- **Step UI-3**: 모달 미리보기 버튼·결과 패널·실패 N건 표시(의존: UI-1, UI-2).
- **Step UI-4**: 문자열 substring/replace/regex_replace/concat 입력 필드·안내.
- **Step UI-5**: 변환 옵션 안내에 문자열·마스킹 설명 + Before→After 예시.
- **Step UI-6**: 마스킹 저장 시 비가역 확인 다이얼로그.
- **Step UI-7**: 변환 설정 행 하이라이트 + "변환 설정된 컬럼만 보기" 토글.
- **Step UI-8**: 값 매핑 4개 이상 시 팝오버/서브모달.
- **Step UI-9**: 정리+타입 변환 순서 문서·검증.
- **Step UI-10**: boolean/date 조건부 설정 필드(선택, 다음 스프린트).
- 병렬 실행 표(그룹 A: UI-1·UI-2 동시, B: UI-3, C: UI-4~8, D: UI-10), 체크리스트, 대상 파일 경로(preview_service, client.js) 보강. 00_ReportIndex.md 11번 설명 갱신.

---

## 2026-03-05 ETL Transform 추가 코드 리뷰 반영 (3차)

**작업:** 3차 리뷰 P1~P3 및 동작 명시 반영.

- **P1:** update_transform_rule — 마이그레이션 전 DB(rule_category/operation 컬럼 없음)에서 UPDATE 실패 시 rollback 후 fallback. rule_category→rule_type 치환, operation 항목 제거 후 재시도. rule_type 인자 있으면 해당 값 사용.
- **P2:** _apply_type_cast_with_mask — boolean 경로를 _apply_type_cast와 동일하게 벡터화(stripped.isin(true_vals/false_vals), failed 후 on_error 처리).
- **P3:** _apply_type_cast — date를 try_convert 밖으로 벡터 경로 추가. still_none = converted.isna() & ~empty, 포맷별 pd.to_datetime(sub, format=fmt), still_failed 시 _fallback. try_convert는 text만 유지.
- **P3:** router.py — upload_file 내부 `import json as _json` 제거, 파일 상단 `import json` 추가, json.loads 사용처를 json으로 통일.
- **동작 명시:** _apply_type_cast docstring에 "empty(NA/빈문자열/nan 문자열)는 항상 None 처리" 문구 추가.

---

## 2026-03-05 ETL Transform 추가 코드 리뷰 반영 (2차)

**작업:** 추가 리뷰 P0~P3 항목 반영.

- **P0:** _apply_type_cast — integer/bigint 벡터화 후 on_error="keep"이면 원본(문자 등)이 섞여 Int64 캐스팅 시 TypeError. `on_error != "keep"`일 때만 `astype("Int64")` 시도, 실패 시 try/except로 유지.
- **P1:** _apply_type_cast_with_mask date — 멀티포맷 루프에서 성공한 행만 순회. `success_mask = _dt.notna()`, `for idx in _dt.index[success_mask]` 로 변경.
- **P1:** create_transform_rule fallback — "column" 문자열 매칭이 과도함(null value in column ... 등). `is_schema_mismatch`: "rule_category", "undefined column", "does not exist" 로 한정.
- **P1:** apply_rules — 예외 완전 삼킴 제거. 컬럼/row 변환 실패 시 `logger.warning`(rule_id, category, operation, tgt, exc) 기록.
- **P2:** _apply_type_cast boolean — true_vals/false_vals를 try_convert 밖에서 한 번만 생성하고, boolean 전용 벡터 경로 추가(stripped.isin, not_matched만 _fallback).
- **P2:** _apply_range_map — conditional과 동일하게 첫 매칭 우선. `matched` 플래그, `to_apply = mask & ~matched` 적용.
- **P3:** _apply_datetime_transform — date_format은 dt 미사용. `dt = pd.to_datetime(series, ...)` 를 date_format 분기 아래로 이동(필요 시에만 계산).

---

## 2026-03-05 ETL Transform 코드 리뷰 반영 (11번 문서·리뷰 피드백)

**작업:** 코드 리뷰 P0/P1/P2 항목 검증 후 반영.

- **P0:** transform_rules_service — create_transform_rule에서 첫 INSERT 실패 시 `conn.rollback()` 후 rule_type fallback INSERT. (PostgreSQL 트랜잭션 abort 상태에서 두 번째 execute 방지.)
- **P0:** _apply_conditional — 첫 번째 매칭 우선(CASE WHEN 스타일). `matched` 플래그로 이미 매칭된 행은 이후 condition으로 덮어쓰지 않음.
- **P0:** _apply_type_cast_with_mask — date 멀티포맷: 실패한 행만 다음 포맷으로 시도하도록 변경. `still_none` 구간만 `pd.to_datetime(sub, format=fmt)` 호출.
- **P1:** _apply_type_cast — integer/bigint/numeric/timestamp 벡터 연산 우선 적용. `pd.to_numeric`/`pd.to_datetime` 후 실패 행만 _fallback 처리.
- **P1:** router _save_upload — 파일명 sanitize(`re.sub(r"[^\w.\-]", "_", ...)`), `path.resolve().is_relative_to(UPLOAD_DIR.resolve())` 검증.
- **P1:** transform_engine — `_NEEDS_DF` 모듈 레벨 캐시로 매 룰마다 `inspect.signature` 호출 제거.
- **P2:** _apply_cleansing — operation 기본값 `"trim"` 명시 (`config.get("operation") or "trim"`).
- **P2:** mask_phone — 하이픈 형식 `^(\d{2,4})-(\d{3,4})-(\d{4})$` 먼저, 없으면 숫자만 추출 후 01x 3자리/그 외 2자리 prefix + 중간 마스킹 + 뒤 4자리.
- **P2:** masking hash — `getattr(hashlib, algo, None)`으로 직접 참조 시 사용, 없으면 `hashlib.new(algo, ...)` 유지.
- **기타:** apply_rules에서 row transform 후 `out` 교체·인덱스 리셋됨 주석 추가. 기존 테스트 14개 통과.

**미반영:** P3 스키마 버전 캐싱(모듈 로드 시 rule_category 컬럼 존재 여부 체크) — 현재 rollback fallback으로 동작하므로 추후 개선 시 검토. router 내부 `import json` — 해당 위치 미확인, 필요 시 별도 수정.

---

## 2026-03-05 ETL Transform Phase 3 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** Phase 3 Step 16~20 반영.

- **Step 16:** transform_engine — `_apply_numeric_transform` 추가. operation: round(decimals), arithmetic(operator, value/column), bucket(bins, labels), clamp(min, max). _COLUMN_TRANSFORMERS에 "numeric" 등록.
- **Step 17:** _apply_masking에 operation hash(algorithm: sha256), redact(char) 추가.
- **Step 18:** _apply_row_transform 추가. operation: filter(column, operator, value), deduplicate(subset, keep). apply_rules에서 rule_category "row"일 때 _ROW_TRANSFORMERS로 전체 DataFrame 변환 후 continue.
- **Step 19:** _apply_cleansing에 operation fill_forward, fill_backward, normalize_unicode(form) 추가.
- **Step 20:** transform_engine 상단 docstring 갱신. tests/test_transform_engine.py에 Phase 3 테스트 추가(test_apply_rules_numeric_round, test_apply_rules_row_deduplicate, test_apply_rules_masking_hash). 14개 테스트 통과.

---

## 2026-03-05 ETL Transform Phase 2 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** Phase 2 Step 9~15 반영.

- **Step 9:** DB 마이그레이션 명령 적용(사용자 실행). rule_type→rule_category 리네임, operation 컬럼 추가, code_map→mapping/derived→string·datetime 데이터 변환, chk_rule_category 제약. (SQL 파일은 저장하지 않고 명령만 제공하는 방식으로 정리)
- **Step 10:** transform_rules_service — _VALID_CATEGORIES, _normalize_category(code_map→mapping, derived→string). list/get는 SELECT *로 rule_category·rule_type·operation 모두 대응. create는 rule_category+operation INSERT 시도 후 실패 시 rule_type만 INSERT(마이그레이션 전 호환). update에 rule_category, operation 파라미터 추가.
- **Step 11:** transform_engine — _parse_config, _COLUMN_TRANSFORMERS 디스패치 테이블, _LEGACY_CATEGORY_MAP. apply_rules에서 rule_category 우선·rule_type 폴백, operation config 병합, inspect.signature로 df 인자 여부 판단.
- **Step 12:** _apply_datetime_transform 추가. date_format, extract, date_diff, age, date_add.
- **Step 13:** _apply_range_map, _apply_conditional, _apply_mapping 추가. mapping 카테고리에서 value_map/range_map/conditional 분기.
- **Step 14:** router — CreateTransformRuleBody/UpdateTransformRuleBody에 rule_category, operation 필드 추가. create/update 시 서비스에 전달.
- **Step 15:** tests/test_transform_engine.py에 Phase 2 테스트 추가(test_apply_rules_rule_category_fallback, test_apply_rules_mapping_range_map, test_apply_rules_datetime_age). 기존 Phase 1 테스트 포함 전체 통과.

---

## 2026-03-05 ETL Transform Phase 1 구현 완료 (11_ETL_Transform_Upgrade_Guide 기준)

**작업:** 11_ETL_Transform_Upgrade_Guide.md Phase 1 Step 1~8 전부 구현.

- **Step 1~4 (transform_engine.py):** `_apply_string_transform` 추가(uppercase, lowercase, pad_left, pad_right, substring, replace, regex_replace, concat), `_apply_masking`에 mask_phone·mask_name·레거시 type→operation 매핑, `_apply_type_cast`/`_apply_type_cast_with_mask`에 boolean·date_formats 리스트 지원, `apply_mapping_type_cast`에 boolean 타겟 반영, `apply_rules`에 rule_type `string` 분기.
- **Step 5 (transform_rules_service.py):** `_VALID_RULE_TYPES`에 `string` 추가, create/update 검증 통일.
- **Step 6 (router.py):** CreateTransformRuleBody의 rule_type·rule_config Field description 및 examples 보강.
- **Step 7 (TargetTableSelectModal.jsx):** 변환 옵션에 "문자열 변환"(string)·"마스킹"(masking) 추가, operation 드롭다운 및 pad_left/pad_right·mask_right/mask_left 시 n·char 입력 필드, getAssembledRules에서 string/masking rule_config 조립, code_map 시 mappings/default 전송으로 정리.
- **Step 8 (tests/test_transform_engine.py):** transform_engine 단위·통합 테스트 추가(직접 모듈 로드), 9개 테스트 통과.

---

## 2026-03-05 ETL Transform 업그레이드 가이드 — 커서 AI 실행용 스펙 보강 (11번)

**작업:** **11_ETL_Transform_Upgrade_Guide.md** 를 “커서 AI가 코드를 뽑기 위한 스펙” 수준으로 재구성. (1) **Step 1~20** 단위로 분리(파일 1~2개·함수 1~3개 단위). (2) **함수 시그니처·config 스펙·테스트 케이스**를 Step별로 명시. (3) **하위 호환** 경계 명확화(Phase 1 DB 미변경, rule_type 확장만). (4) **서브에이전트 병렬 실행 표** 추가 — Phase 1에서 Step 2~4(엔진), Step 5(서비스), Step 6(라우터), Step 7(프론트)를 서로 다른 에이전트로 병렬 가능하도록 의존성·대상 파일 표기. (5) Phase 2 마이그레이션·디스패치·datetime·mapping Step(9~15), Phase 3 요약(16~20), 네이밍 매핑 표, 커서 프롬프트 작성 팁 수록. 00_ReportIndex.md 설명 갱신.

---

## 2026-03-05 ETL Transform 벤치마킹·업그레이드 가이드 문서화 (11번)

**작업:** docs/report에 **11_ETL_Transform_Upgrade_Guide.md** 신규 작성. 업계 표준 Transform 카테고리·오퍼레이션과 현재 코드(rule_type 5개) 매핑, rule_category + operation 2단 구조 제안, DB 스키마 변경안, apply_rules 엔진 개선 방향, Phase 1~3 우선순위·체크리스트, 네이밍 컨벤션을 정리함. 대상 파일은 Backend/etl_server2/transform_engine.py, transform_rules_service.py, router.py, Frontend etl2 TargetTableSelectModal 등으로 명시. 00_ReportIndex.md에 11번 문서 항목 추가.

---

## 2026-03-04 DB 배치: 150행 기대 시 1행만 삽입·헤더처럼 보이는 행

**증상:** DB 연결 배치잡 실행 시 150행을 넣었으나 1행만 삽입되고, 그 행이 `id / campaign_id / test_id` 등 컬럼명만 있는 것처럼 보임.

**원인 후보 (우선순위):**
1. **증분(incremental) 모드 + last_synced_at**  
   `WHERE incremental_column > last_synced_at` 조건으로 인해 **소스에서 1행만 조회**되는 경우.  
   - ETL 테이블 실행 완료 시점으로 `last_synced_at`이 세팅되어 있으면, 그 시점보다 큰 값을 가진 행이 1개뿐일 수 있음.  
   - 그 1행이 소스 테이블에 “헤더처럼” 저장된 행(예: id='id', campaign_id='campaign_id', test_id='test_id')이면, 삽입 결과가 컬럼명만 있는 것처럼 보임.
2. **소스 테이블에 헤더 행이 데이터로 존재**  
   CSV 등에서 헤더를 한 줄 넣은 경우, 증분 컬럼 기준으로 그 행 1개만 선택될 수 있음.
3. **Full 모드인데 소스가 1행만 반환**  
   연결/스키마/테이블이 잘못되어 해당 테이블이 1행만 가지는 DB를 바라보는 경우.

**권장 확인:**
- 배치잡/ETL 테이블의 **sync_mode**: `incremental`이면 `last_synced_at`이 너무 최근이 아닌지 확인.
- **전체 재적재**가 목적이면: 한 번 `sync_mode=full`로 실행하거나, `last_synced_at`을 NULL/과거로 초기화 후 증분 재실행.
- 소스 테이블에 **컬럼명과 동일한 값의 행**이 있는지 확인; 필요 시 해당 행 제거 또는 증분 조건에서 제외.

**조치:** `batch_executor_db.py`에 배치당 소스 조회 행 수 로그 추가.  
`run_db_batch_job job_id=%s batch_offset=%s: 소스에서 %s행 조회` — 로그로 실제로 몇 행이 조회되는지 확인 가능.

---

## 2026-03-04 DB 배치: 실행 이력 삽입 0건·소스 0행 조회 시 진단 로그

**증상:** 배치 주기/즉시실행 시 상세 이력에 삽입 0~1건만 기록. 실제 서버 타겟 테이블에는 600행 등 더 많은 데이터가 있는데 로컬/해당 환경에서는 추가 삽입이 없음.

**원인:** 증분(incremental) 모드에서 `WHERE incremental_column > last_synced_at` 조건으로 소스를 조회할 때, `last_synced_at`이 이미 최근이라 **소스에서 조회되는 행이 0건**인 경우. (해당 환경 소스가 150행뿐이고 이미 동기화된 상태이거나, 서버와 다른 DB를 바라보는 경우 등.)

**조치:** `batch_executor_db.py`에 다음 로그 추가.  
- 실행 시: `sync_mode`, `incremental_column`, `last_synced_at` 출력 → 증분 조건 확인 가능.  
- 소스에서 한 건도 안 나온 경우: `batch_offset == 0`일 때 경고 로그로 "소스에서 조회된 행 없음. 증분 모드일 경우 last_synced_at 확인 또는 full 동기화 권장" 출력.

**운영 측 대응:** 증분인데 새 행이 안 잡히면 1) 타겟/소스가 같은지 확인, 2) 한 번 `sync_mode=full`로 실행하거나 배치잡/ETL의 `last_synced_at`을 NULL 또는 과거로 초기화 후 재실행.

---

## 2026-03-04 소스 DB fetch 결과 row 타입 분기 (RealDictRow 버그)

**증상:** 소스 테이블 미리보기·배치 실행 시 모든 행이 컬럼명 문자열로 채워짐 (id 컬럼 값이 "id" 등).

**원인:** PostgreSQL 소스 연결이 `RealDictCursor`를 사용해 `fetchall()`/`fetchmany()`가 `RealDictRow`(dict-like)를 반환함. 이때 `dict(zip(col_names, r))`에서 `r`을 이터레이션하면 **키(컬럼명)**만 나와, 값이 컬럼명으로 채워짐.

**조치:** 소스 SELECT 결과를 dict 리스트로 바꾸는 모든 위치에서 row 타입 분기 적용.
- `rows and hasattr(rows[0], "keys")` → 이미 dict-like → `[dict(r) for r in rows]`
- 그 외(tuple) → `[dict(zip(col_names, r)) for r in rows]`

**수정 파일:**
- `preview_service.py` `_preview_db`: fetch 후 위 분기로 rows 변환.
- `batch_executor_db.py`: fetchmany 배치에 동일 분기 적용.
- `db_load_service.py`: `row_type == "dict"`일 때 `[dict(r) for r in batch/rows_data]` 명시 추가, tuple일 때만 zip 변환.

---

## 2026-03-05 파일 배치: 동일 실패 파일 반복 재시도 + 연속 실패 시 자동 비활성화

**증상:** run_id 61에서 파일 적재 실패 후 63, 65, 68, 71, 74까지 같은 파일로 5번 더 시도됨.

**원인:**  
1) 실패한 파일에 대해 `last_processed_ts`를 갱신하지 않아, 다음 주기에서 `get_pending_files`가 같은 파일을 다시 pending으로 반환함.  
2) 파일 1건 적재 실패 시 `finish_run(error)` 후 `return`하는 경로에서는 `check_consecutive_failures`가 호출되지 않아, 연속 5회 실패 시 자동 비활성화가 적용되지 않음.

**조치:**  
1) 파일 적재 실패 시에도 `update_last_processed_ts(batch_job_id, ts)` 호출. 실패한 파일도 "시도 완료"로 기록해 다음 주기에서 `get_pending_files`의 `ts > last_processed_ts` 조건으로 자동 제외되며, 동일 파일 반복 실패로 이력이 쌓이는 것을 방지. (commit 실패·load 예외·file_size_exceeded 스킵 모두 적용. on_file_error=continue/stop 동일.)  
2) 파일 실패로 run을 error로 끝낼 때 `check_consecutive_failures(batch_job_id, threshold=5)` 호출 유지.  
3) **제거:** `list_skipped_files` 기반 문제 파일 제외 로직 제거. 매 실행 시 이력 JSONB 스캔 부하·일시 장애 파일 영구 차단 부작용을 없애고, last_processed_ts + 체크섬 + check_consecutive_failures만으로 동작.

---

## 2026-03-04 DB 배치: 소스 헤더 행이 데이터로 적재되는 것 방지

**증상:** 소스 151건 중 150건만 실제 데이터이고, 151번째 행이 컬럼명(id, campaign_id, test_id)으로 채워진 “헤더 행”이 타겟에 적재됨. 타겟 600건 중 해당 1건이 비정상 행.

**원인:** 소스 테이블(또는 소스로 로드된 CSV 등)에 컬럼명과 동일한 값을 가진 한 행이 데이터로 포함된 경우.

**조치:** `batch_executor_db.py`에서 소스 조회 후 DataFrame 생성 직후, **첫 번째 컬럼 값이 해당 컬럼명과 동일한 행**을 헤더 유사 행으로 간주해 제외. 제외 시 로그: `헤더 유사 행 N건 제외 (컬럼 '컬럼명' 값=컬럼명)`. 해당 배치 전체가 헤더 행뿐이면 적재 스킵.

---

## 2026-03-04 DB 배치: 증분 조건 > → >=, NULL 제외, 디버그 로깅

**증상:** 소스 600건(updated_at 동일), 타겟 150건만 적재. 즉시 실행 시 450건이 들어와야 하는데 1건(헤더)만 삽입, 이후 0건.

**원인:** 1) `WHERE updated_at > last_synced_at`에서 last_synced_at이 150건 적재 시 max(updated_at)과 동일해, 나머지 450건(동일 시각)이 제외됨. 2) 증분 컬럼 NULL인 헤더 행이 조건을 통과할 수 있는 경우 처리 필요.

**조치 (batch_executor_db.py):**
- 증분 조건을 **`>` → `>=`** 로 변경: 동일 시각 데이터 포함, 중복은 PK upsert로 방지.
- **`AND incremental_column IS NOT NULL`** 추가: 증분 컬럼이 NULL인 행(헤더/쓰레기) 제외.
- 디버그 로깅: `last_synced_at` (batch_jobs 기준), 생성된 **SELECT 쿼리 전문 + params** 로그 출력.

---

## 2026-03-04 DB 배치 적재 시 duplicate key (sample_accdb_p_pkey) 수정

**원인:** `load_dataframe`에서 테이블이 없을 때 CREATE 후 항상 `_batch_insert`만 사용. 소스에 동일 PK가 있거나 배치 내 중복이 있으면 `UniqueViolation: duplicate key value violates unique constraint` 발생.

**조치:** `Backend/etl_server2/load_service_file.py` — 테이블 생성 직후에도 PK가 있고 `df_work`에 PK 컬럼이 모두 있으면 `_batch_upsert`로 적재하도록 변경. (동일 배치/소스 내 PK 중복은 ON CONFLICT DO UPDATE로 갱신 처리.)

**추가(근본 원인):** 배치잡/ETL 테이블에 `pk_columns`가 저장되지 않으면 `pk_columns_str`이 None으로 넘어가 `load_dataframe` 내부 `pk_list`가 빈 리스트가 되어 여전히 `_batch_insert`만 타는 문제.  
**조치:** `Backend/etl_server2/batch_executor_db.py` — `_fetch_source_pk(conn, stype, schema, table_name)` 헬퍼 추가(postgresql/mysql/oracle에서 PK 컬럼 목록 조회). `pk_columns_str`이 비어 있을 때 소스 연결 후·chunk 루프 전에 소스 DB에서 PK 자동 조회해 사용. 배치 등록 시 PK를 넣지 않아도 실행 시점에 자동 감지되어 upsert 정상 동작.

---

## 2026-03-04 ETL 테이블 status=done 기준 배치설정 흐름

**목적:** ETL 등록 → 수동 실행으로 검증 → 배치 설정 시 마지막 적재 시점 이후부터 증분. 사용자 흐름 정리 및 서버 검증 추가.

**플로우:** ETL 등록(status=draft) → 배치설정 버튼 비활성 → 실행 후 적재 완료(status=done) → 배치설정 활성화 → 배치 등록 시 `etl_tables.last_synced_at`을 `batch_jobs.last_synced_at` 초기값으로 세팅.

**변경 사항**
- **Backend/etl_server2/router_file.py**  
  - POST `/jobs/from-etl-table`: `etl_table.status`가 `done`이 아니면 400 응답. "ETL 테이블이 아직 실행되지 않았습니다. 먼저 실행하여 적재를 확인한 뒤 배치를 설정해 주세요."  
  - 배치 등록 직후 `etl_table.last_synced_at`이 있으면 `update_last_synced_at_db_batch(batch_job_id, initial_synced_at)` 호출로 증분 기준점 세팅.
- **Frontend/.../ETLTableList.jsx**  
  - DB 소스 행의 "배치설정" 버튼: `disabled={runDisabled || statusLower !== 'done'}`, 비활성 시 툴팁 "먼저 실행하여 적재를 확인한 뒤 배치를 설정할 수 있습니다.", 활성 시 "주기 자동 실행 설정".

---

## 2026-03-03 DB 배치 스케줄링 업그레이드 (10_DB_Batch_Scheduling_Upgrade) 구현

**목적:** docs/report/10_DB_Batch_Scheduling_Upgrade.md 계획에 따라 DB 연결 기반 배치 Job 주기 실행 기능 구현. (DB 스키마는 사용자가 별도 반영 완료 가정.)

**Phase 1 — batch_executor_db.py**
- 신규 파일: `Backend/etl_server2/batch_executor_db.py`. `run_db_batch_job(batch_job_id)`로 job_type='db' 배치 실행. 소스 연결(PostgreSQL/MySQL/Oracle), 증분·전체 SELECT, batch_size 단위 fetch → DataFrame → column_mapping → load_dataframe → batch_interval_seconds sleep 반복. last_synced_at 갱신, finish_run, update_job_status. MySQL batch_size 상한 10000, check_consecutive_failures는 finally 밖에서 호출.

**Phase 2 — scheduler_file.py**
- `add_job`: job_type='db'이면 `batch_executor_db.run_db_batch_job`, 아니면 `batch_executor_file.run_batch_job` 사용.
- `run_now`: 동일하게 job_type에 따라 실행 함수 분기.

**Phase 3 — service_file.py**
- `list_batch_jobs`: job_type 쿼리 파라미터 추가, 새 컬럼(job_type, connection_id, source_table 등) SELECT, etl_connections LEFT JOIN으로 source_connection_name.
- `get_batch_job`: source_connection_name(etl_connections JOIN) 추가.
- `create_batch_job`: job_type(file|db), connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error 추가. file은 folder_connection_id·file_pattern 필수·중복 검사 기존 로직; db는 connection_id·source_table 필수·(connection_id, source_table, target_table, storage) 중복 검사.
- `update_batch_job`: connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error allowed 및 검증 추가.
- `update_last_synced_at_db_batch`: 신규. batch_jobs.last_synced_at 갱신(conn 선택).

**Phase 4 — router_file.py**
- CreateBatchJobBody/UpdateBatchJobBody: job_type, connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error 추가. Create 시 folder_connection_id·file_pattern Optional.
- POST /jobs: job_type 검증, db 시 connection_id·source_table 필수 검사, create_batch_job에 새 인자 전달.
- GET /jobs: job_type 쿼리 파라미터 추가.
- GET /jobs/{batch_job_id}/db-preview: DB 배치 소스 10행 미리보기(preview_service._preview_db).
- PATCH /jobs/{id}: 새 필드 반영. clone_batch_job: job_type·connection_id·source_table 등 DB 배치 필드 복사.

**Phase 5 — 프론트엔드**
- client.js: batchListJobs에 jobType 인자 추가, batchGetJobDbPreview(batchJobId) 추가.
- BatchJobFormDb.jsx 신규: DB 연결·소스 테이블·저장 DB·타겟 테이블·주기·배치 크기/간격·증분 컬럼·sync_mode·on_row_error 등 입력, job_type='db'로 batchCreateJob 호출.
- BatchJobListFile.jsx: jobTypeFilter prop 추가, batchListJobs(undefined, undefined, jobTypeFilter) 호출. 유형(파일/DB) 컬럼, 소스 연결/소스 테이블 열 표시. DB 배치 행에 "미리보기" 버튼 및 미리보기 모달(preview_columns/preview_rows).
- ETLPage.jsx: db 탭에서 DbConnectionForm 아래 "배치 Job (DB 소스)" 섹션에 BatchJobFormDb, BatchJobListFile(jobTypeFilter="db") 배치. howToDb에 4번 항목 추가.

**변경·추가 파일:** Backend/etl_server2/batch_executor_db.py(신규), scheduler_file.py, service_file.py, router_file.py, Frontend/.../client.js, BatchJobFormDb.jsx(신규), BatchJobListFile.jsx, ETLPage.jsx, docs/report/log.md.

---

## 2026-03-04 ETL 테이블 기반 배치 통합 (DB 탭 단일 출처)

**목적:** etl_tables를 소스→타겟 정의의 단일 출처로 두고, 배치잡은 "어떤 ETL 테이블을 얼마나 자주 돌릴지"만 저장. DB 탭에서 BatchJobFormDb·BatchJobListFile(db) 제거, 등록된 ETL 목록의 "배치설정" 버튼으로 통합.

**DB (사용자 직접 반영):** `batch_jobs.etl_table_id` INTEGER NULL FK, `batch_jobs.on_file_error` 등 필요 시 ALTER TABLE로 추가.

**백엔드**
- service_file.py: `create_batch_job`에 `etl_table_id` 인자 추가. db+etl_table_id 있으면 etl_table_id로 중복 검사, INSERT에 etl_table_id 포함. `list_batch_jobs` SELECT에 `j.etl_table_id` 추가.
- router_file.py: `CreateBatchJobFromEtlTableBody`, POST `/jobs/from-etl-table` 추가. get_etl_table로 조회 후 create_batch_job(etl_table_id, connection_id/source_table/target_table/storage 스냅샷, job_name/interval_minutes/batch_size 등).
- batch_executor_db.py: `job.etl_table_id` 있으면 get_etl_table에서 connection_id·source_table·target_table·column_mapping·incremental_column·sync_mode·pk_columns·index_definitions 조회; 없으면 기존대로 job에서 읽기. 배치 전용 설정(batch_size, batch_interval_seconds, on_row_error, last_synced_at)은 항상 job에서.

**프론트엔드**
- client.js: `batchCreateJobFromEtlTable(body)` 추가.
- BatchScheduleModal.jsx 신규: ETL 테이블 기반 배치 등록/수정/토글/삭제/즉시실행. 배치 없으면 등록 폼, 있으면 현재 설정 표시+액션.
- ETLTableList.jsx: load 시 `batchListJobs(undefined, undefined, 'db')` 병렬 조회, `batchJobByEtlTable` 매핑. DB 소스 행에 "배치설정" 버튼, 배치 컬럼에 연결된 배치 시 "N분 ●/○" 또는 "미설정" 표시. BatchScheduleModal 연동.
- ETLPage.jsx: DB 탭에서 BatchJobFormDb·BatchJobListFile(db) 섹션 제거. howToDb 4번을 "배치설정을 눌러 스케줄 등록"으로 수정.
- etl.css: `.etl-table-list__batch-schedule` 스타일 추가.

**변경·추가 파일:** service_file.py, router_file.py, batch_executor_db.py, client.js, BatchScheduleModal.jsx(신규), ETLTableList.jsx, ETLPage.jsx, etl.css, log.md.

---

## 2026-03-04 DB 배치 스케줄링 코드 검증 (8건 이슈 확인)

**목적:** log.md·10_DB_Batch_Scheduling_Upgrade.md 기반으로 DB 연결+배치잡 시스템 코드 전반 검증. 제기된 8건 이슈가 현재 코드에서 반영·특이사항 없는지 확인.

**검증 결과 요약**

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | check_consecutive_failures 조건 제거 + 에러 이력 순서 | ✅ 반영됨 | create_batch_run 최상단 선행, finally 밖에서 run_id 무관 호출 |
| 2 | except에서 sys_conn.rollback() 선행 | ✅ 반영됨 | except 블록 최상단에서 sys_conn.rollback() 후 finish_run·update_job_status |
| 3 | full 모드 DROP → TRUNCATE | ✅ 반영됨 | table_exists 확인 후 TRUNCATE만 수행, 구조 보존 |
| 4 | Oracle bind :1 검증 | ✅ 일치 | db_load_service와 동일 :1 positional bind 사용, 별도 수정 불필요 |
| 5 | DB 배치 source_filename=None | ✅ 반영됨 | load_dataframe(..., source_filename=None)으로 _record_loaded_keys 스킵 |
| 6 | 프론트 파일 전용 버튼 분기 | ✅ 반영됨 | "문제 파일"은 jtype !== 'db'일 때만, "미리보기"는 jtype === 'db'일 때만 노출 |
| 7 | cancel 체크 + sleep 분할 | ✅ 반영됨 | 루프 상단 is_run_cancel_requested, sleep은 1초 단위 반복+취소 확인 |
| 8 | list_batch_jobs storage JOIN is_active | ✅ 의도 유지 | storage JOIN에 is_active 조건 없음 → 비활성 저장 DB도 이름 표시, 혼란 방지 |

**대상 파일 확인:** batch_executor_db.py, service_file.py, BatchJobListFile.jsx, db_load_service.py(Oracle :1). 추가 수정 없음.

---

## 2026-03-03 DB 배치 스케줄링 리뷰 반영 (1~3, 5, 7, 8번)

**목적:** 10_DB_Batch_Scheduling_Upgrade 구현에 대한 코드 리뷰 8건 중 추가 조치 필요 항목 반영.

**1. check_consecutive_failures + 에러 이력 순서 (높음)**
- `check_consecutive_failures` 호출에서 `if run_id is not None` 조건 제거 → **항상** 호출. create_batch_run 전 예외에서도 연속 실패 카운트로 자동 비활성화 가능.
- **create_batch_run**을 try 최상단으로 이동: `sys_conn` 획득 → `create_batch_run` → `update_job_status("running")` → target_conn·full 모드 TRUNCATE → 소스 연결·SELECT·루프. 소스 연결 실패 등에서도 실행 이력이 남고 `finish_run("error")`로 정리됨.

**2. sys_conn 재사용 시 rollback 선행 (높음)**
- except 블록 맨 앞에서 `if sys_conn: sys_conn.rollback()` 호출 후 `finish_run`·`update_job_status` 호출. PostgreSQL 등에서 트랜잭션 aborted 상태 전파 방지.

**3. full 모드 DROP → TRUNCATE (높음)**
- `sync_mode == "full"`일 때 `DROP TABLE IF EXISTS` 제거. **테이블이 존재할 때만** `load_service_file.table_exists` 확인 후 `TRUNCATE TABLE` 수행. 테이블 구조 유지, 적재 실패 시 다음 주기 재시도 가능.

**5. DB 배치 source_filename=None (중간)**
- `load_dataframe` 호출 시 `source_filename=None`으로 고정. DB 배치는 파일 단위 롤백 미지원이므로 `batch_loaded_keys` 기록 스킵, 테이블 비대화 방지.

**7. 취소 체크 + sleep 분할 (낮음)**
- chunk 루프 진입 시 `is_run_cancel_requested(run_id, conn=sys_conn)` 체크 후 break.
- `batch_interval_seconds` 대기를 `time.sleep(batch_interval_seconds)` 대신 1초 단위 루프로 변경하고, 매 초 `is_run_cancel_requested` 확인해 취소 시 즉시 break.

**8. list_batch_jobs storage JOIN (낮음)**
- `etl_storage_connections` LEFT JOIN 조건에서 `AND sc.is_active = TRUE` 제거. 비활성 저장 DB에 연결된 Job도 목록에서 저장 DB명이 표시되도록 함.

**4. Oracle bind :1** — db_load_service와 동일 패턴임을 주석으로 명시. **6. 프론트 파일 전용 버튼** — BatchJobListFile에서 "문제 파일"은 이미 `jtype !== 'db'`로 숨김. 타임스탬프 리셋·파일 롤백은 이력 상세(BatchHistoryDetailFile)에 있으며 DB 배치는 file_list 구조가 달라 별도 분기 없이 적용 제한됨.

**변경 파일:** Backend/etl_server2/batch_executor_db.py, Backend/etl_server2/service_file.py (list_batch_jobs JOIN), docs/report/log.md.

---

## 2026-03-03 docs/main·README 최신화 (log 2026-03-03·2026-02-23 반영)

**목적:** log.md 기준 마지막 개발문서 수정(2026-02-27) 이후 반영된 기능을 백엔드·프론트엔드 코드 참조하여 docs/main 개발문서 및 README에 반영.

**반영 요약:**
- **00_PRD.md**: §1.2 ETL2에 on_file_error(stop/continue), index_definitions·source-indexes, csv_reader(CSV 인코딩 통합), 배치 대기 파일 없으면 run 미기록, 폴더 연결 목록 연결정보 열, 실행 이력 partial_error·삽입/갱신 의미, 매핑 모달 PK·INDEX 열·인덱스 추가 테이블 아래, _batch_upsert IS DISTINCT FROM. §6.3.1·§8 변경 이력 2026-03-03 항목 추가.
- **01_FRONTEND_GUIDE.md**: §3 FolderConnectionListFile 연결 정보, BatchJobFormFile index_definitions·on_file_error, BatchHistoryPanelFile partial_error, TargetTableSelectModal PK·INDEX·인덱스 추가 테이블 아래. §4.5.1 FileUploadForm/DbConnectionForm/BatchJobFormFile indexDefinitions·etl2GetSourceIndexes·sourceIndexes·pkReadOnlyFromSource, BatchHistoryPanelFile "일부 실패 (N/M 성공)", TargetTableSelectModal 소스 PK/인덱스·indexDefinitions onSelect, client.js etl2GetSourceIndexes. 변경 이력 2026-03-03.
- **02_BACKEND_GUIDE.md**: §2 csv_reader.py. §3.2 etl_tables index_definitions, batch_jobs on_file_error·index_definitions. §4.6 GET source-indexes, API 설명 보강(csv_reader·on_file_error·_batch_upsert·배치 run 미기록·commit 실패·run_db_load·transform_engine·claim_next_pending_job). §6.7 전면 보강: csv_reader, on_file_error, index_definitions, get_source_indexes, _create_indexes_on_target, _batch_upsert 최적화, batch_executor_file·db_load_service·load_service·service·service_file·load_service_file 상세. 변경 이력 2026-03-03.
- **README.md**: ETL2 행에 인덱스 설정·on_file_error·partial_error·csv_reader. Backend/etl_server2 행에 인덱스·csv_reader·on_file_error. 최종 업데이트 2026-03-03.

**변경 파일:** docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, log.md.

---

## 2026-03-03 CSV 인코딩 통합(csv_reader) + claim_next_pending_job finally rollback 제거

**목적:** (1) CSV 읽기 로직 중복 제거 및 인코딩 감지 확장. (2) commit 후 불필요한 rollback 제거.

**개선 포인트 5 — CSV 인코딩 통합:**
- **Backend/etl_server2/csv_reader.py** 신규: `read_csv_robust(file_path, nrows=None)` → (DataFrame, encoding_used, data_verification_needed).
- chardet 또는 charset_normalizer 있으면 앞부분 바이트로 인코딩 자동 감지 후 해당 인코딩 우선 시도. 없으면 기존처럼 순차 시도만 사용.
- 시도 순서: 감지값 → utf-8 → utf-8-sig → cp949 → euc-kr → latin-1 → cp1252. 'unexpected end of data' 시 EOF(\\x1a) 제거 후 재시도.
- **load_service.py**: `_read_csv_robust` 제거. `_read_file`에서 CSV일 때 `csv_reader.read_csv_robust` 호출 후 (df, data_verification_needed) 반환 유지.
- **parser_file.py**: `_read_csv_robust` 제거. `read_file`에서 CSV일 때 `csv_reader.read_csv_robust` 호출 후 DataFrame만 반환.

**개선 포인트 6 — claim_next_pending_job:**
- **etl_server2/service.py**: `claim_next_pending_job`의 finally 블록에서 `conn.rollback()` 제거. commit 성공 후 rollback 호출은 불필요한 왕복·autocommit 아닐 때 부작용 가능. 예외 시에만 except 블록에서 rollback 유지.

**변경 파일:** Backend/etl_server2/csv_reader.py(신규), load_service.py, parser_file.py, service.py, docs/report/log.md.

---

## 2026-03-03 run_batch_job 파일별 에러 정책(on_file_error) + _batch_upsert UPDATE 최적화

**목적:** (1) 파일 1건 실패 시 전체 중단 대신 "다음 파일 계속" 옵션 추가. (2) upsert 시 실제로 값이 변경된 행만 UPDATE.

**on_file_error (개선 포인트 3):**
- **batch_jobs.on_file_error** 컬럼 추가 (migration_on_file_error.sql). 값: `stop`(기본) | `continue`.
- **stop**: 기존 동작. 파일 처리 중 예외 시 finish_run("error") 후 return → 나머지 파일 미처리.
- **continue**: 해당 파일만 file_results에 status="error" 기록, target_conn.rollback() 후 다음 파일 계속. last_processed_ts는 성공한 파일의 마지막 ts만 갱신. 전체 처리 후 에러 파일이 1건이라도 있으면 finish_run("partial_error"), 없으면 "success". update_job_status는 항상 "success"로 호출해 다음 주기 정상 실행.
- service_file: create_batch_job/update_batch_job에 on_file_error 파라미터·allowed 추가. router_file: CreateBatchJobBody/UpdateBatchJobBody, create_batch_job/clone/update_batch_job에 on_file_error 반영.
- BatchHistoryPanelFile: status가 "partial_error"일 때도 "일부 실패 (N/M 성공)" 표시.

**_batch_upsert (개선 포인트 4):**
- UPDATE ... FROM (VALUES ...)에 `AND (t."col1" IS DISTINCT FROM v."col1" OR ...)` 조건 추가. 실제로 non_pk 컬럼 값이 변경된 행만 UPDATE되어 WAL/디스크 I/O 절감. 반환 updated 카운트도 실제 변경 건수만 반영.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, service_file.py, router_file.py, load_service_file.py, Frontend/.../BatchHistoryPanelFile.jsx, docs/report/migration_on_file_error.sql, docs/report/log.md.

---

## 2026-03-03 run_db_load 커넥션 누수 방지 + _apply_type_cast_with_mask 벡터화

**목적:** (1) DB 커넥션 누수 위험 제거. (2) 형변환 실패 행 처리 성능 개선.

**run_db_load (db_load_service.py):**
- 함수 상단에서 `src_conn = conn_main = cur_src = cur_main = None` 초기화.
- 첫 번째 try(소스 연결·컬럼 조회 등)에서 예외 발생 시 `except` 블록에서 `src_conn`이 열려 있으면 `close()` 호출 후 재예외/반환. effective_batch_size 분기 진입 전 예외 시에도 src_conn이 닫히도록 보장.

**_apply_type_cast_with_mask (transform_engine.py):**
- 기존: `for idx in series.index` 파이썬 루프로 행 단위 `series.at[idx]` 접근 → 수십만 행에서 지연.
- 변경: 2-pass 방식. (1) 1차로 `pd.to_numeric`/`pd.to_datetime`(errors='coerce') 등 벡터 변환. (2) 실패 행만 식별(결과 NA이고 원본 비어있지 않음). (3) on_error='fail'이면 첫 실패 행에서 ValueError. (4) on_error='skip_row'면 해당 위치만 failed_mask=True. (5) null/zero/keep은 실패 행만 스칼라로 후처리. 대부분 행은 벡터 연산으로 처리되어 성능 개선.

**변경 파일:** Backend/etl_server2/db_load_service.py, Backend/etl_server2/transform_engine.py, docs/report/log.md.

---

## 2026-03-03 파일 업로드 모달: 인덱스 추가를 테이블 아래로, INDEX 열에 ✓ 연동

**목적:** 동일 모달을 쓰는 파일 업로드에서 PK·INDEX 열 유지, 인덱스 추가 UI를 매핑 테이블 아래로 배치하고, 추가한 인덱스 컬럼은 위 테이블 INDEX 열에 ✓로 표시.

**변경 내용:**
- **TargetTableSelectModal**: (1) sourceIndexes 없을 때도 매핑 테이블에 INDEX 열 항상 표시. (2) targetColumnsInCustomIndexes useMemo 추가 — customIndexDefinitions에 포함된 타겟 컬럼명 집합, INDEX 셀에 ✓ 표시용. (3) "인덱스 추가" 블록을 "저장 DB 테이블" 위에서 제거 후, 매핑 테이블 섹션 바로 아래로 이동(라벨: "인덱스 추가 (테이블 아래)"). (4) 새 테이블/기존 테이블 매핑 모두에서 INDEX 열: sourceIndexes 있으면 targetColumnsInReflectedIndexes, 없으면 targetColumnsInCustomIndexes로 ✓ 표시.

**변경 파일:** Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, docs/report/log.md.

---

## 2026-03-03 DB 연결 컬럼 매핑: PK·INDEX 열 통합 및 읽기 전용 ✓ 표기

**목적:** DB 연결 시 컬럼 매핑 창에서 소스 PK/인덱스를 별도 블록이 아닌 매핑 테이블 내 PK·INDEX 열로 통합하고, 소스 기준 컬럼은 체크 이모티콘(✓)으로만 표시.

**변경 내용:**
- **TargetTableSelectModal**: DB 연동(sourceIndexes.length > 0) 시 (1) "소스 PK" 단독 라인 및 "소스 인덱스" 별도 테이블 제거. (2) "소스 PK/인덱스" 인라인 블록 추가 — 안내 문구 + 인덱스 반영 체크(칩 형태). (3) 매핑 테이블에 **INDEX** 열 추가(PK 오른쪽). (4) PK 열: 제외 행은 "—", 소스 PK 컬럼은 ✓(읽기 전용), 그 외는 "—"(다른 컬럼에 PK 추가 불가). (5) INDEX 열: 제외 행은 "—", 반영된 소스 인덱스에 포함된 컬럼은 ✓, 그 외 "—". (6) targetColumnsInReflectedIndexes useMemo로 반영 인덱스에 포함된 타겟 컬럼명 집합 계산.
- **etl.css**: `.etl-target-select-modal__th--index`, `__cell--index`, `__constraint-check`, `__row--source-indexes-inline`, `__index-reflect-inline`, `__index-reflect-label`, `__index-reflect-chip`, `__index-reflect-cols` 추가.
- 제외된 행은 PK·INDEX 모두 "—"이며, 테이블 생성·데이터 이관 시 해당 컬럼은 constraint 미적용(기존 동작 유지).

**변경 파일:** Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 실행 이력: 삽입 집계 설명 + 일부 실패 표기 (ETL2 배치)

**목적:** (1) run 단위 "삽입 행" 500,000 vs 파일별 합 480,000 이해 정리. (2) 실행 이력 목록에서 "일부만 실패"한 run을 "전체 실패"와 구분해 표시.

**삽입/갱신 의미 (DB 행 수와의 관계):**
- **삽입(inserted)**: 이번 파일에서 **새로 추가된 행 수**. 테이블 총 행 수에 그대로 더해짐.
- **갱신(updated)**: 이번 파일에서 **이미 테이블에 있던 행(PK 동일)**의 비PK 컬럼만 갱신된 수. **행 수 증가 없음**.
- 따라서 **테이블 총 행 수 = sum(파일별 삽입)**. 갱신은 행 수에 기여하지 않음.
- 예: 파일1 220,000 삽입 + 파일2 180,001 삽입 + 20,000 갱신 + 파일3 99,999 삽입 → 삽입 합 500,000, 갱신 합 20,000. DB에는 500,000행만 있음(파일2의 20,000건은 기존 행 업데이트).

**갱신이 나오는 이유:** PK가 같은 행이 이미 테이블에 있을 때(예: 파일1에서 넣은 PK를 파일2에서 다시 넣는 경우) INSERT는 건너뛰고(ON CONFLICT DO NOTHING), UPDATE 단계에서 해당 행의 비PK 컬럼만 갱신하기 때문. 그 20,000건이 "갱신"으로 집계됨.

**검증 방법:** load_service_file._batch_upsert 주석 보강. 아래 절차로 확인 가능.
- (1) 테이블에 PK 설정 후 파일 A만 적재 → 삽입 N, 갱신 0. `SELECT COUNT(*)` = N.
- (2) 동일 PK를 가진 파일 B를 같은 타겟에 업서트(비PK 컬럼만 다름) → 삽입 0, 갱신 N. `SELECT COUNT(*)` = N 유지.
- (3) 파일 C(신규 PK M건) 적재 → 삽입 M, 갱신 0. `SELECT COUNT(*)` = N + M.

**UI 변경:**
- **BatchHistoryPanelFile**: run의 status가 "error"이고 file_list에 ok와 error가 둘 다 있을 때, 상태 컬럼에 **"일부 실패 (N/M 성공)"**으로 표기. 뱃지 클래스 `etl-db-form__status--partial`(노란 계열) 적용.
- **etl.css**: `.etl-db-form__status--partial` 추가 (color #b45309, background #fef3c7).

**변경 파일:** Frontend/react-app/src/packages/etl2/components/BatchHistoryPanelFile.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 인덱스 설정 기능 — 프론트엔드 UI 연동 (Part 2 프론트)

**목적:** 백엔드 인덱스 API·메타 반영에 맞춰 ETL2 패키지에서 파일 업로드/파일 배치의 인덱스 설정 UI, DB 연동 시 소스 PK·인덱스 라인 UI를 구현.

**변경·추가 내용:**

- **client.js**: `etl2GetSourceIndexes(connectionId, sourceTable)` 추가. GET `/api/etl2/connections/:id/source-indexes?source_table=...` 호출.
- **TargetTableSelectModal**:  
  - props: `sourceIndexes`, `currentIndexDefinitions`, `pkReadOnlyFromSource` 추가.  
  - 소스 PK 라인: `sourcePkFromSource` 있으면 "소스 PK" 읽기 전용 표시.  
  - 소스 인덱스: `nonPrimarySourceIndexes` 테이블(반영 체크, 인덱스명, 컬럼, UNIQUE). `sourceIndexReflect` 상태로 타겟 반영 여부 선택.  
  - 인덱스(선택): `sourceIndexes` 없을 때 `customIndexDefinitions` 수동 목록(인덱스명, 컬럼, UNIQUE, + 인덱스 추가/삭제).  
  - PK 체크박스: `pkReadOnlyFromSource && sourcePkColumnNames` 포함 컬럼은 disabled.  
  - `onSelect(tableName, columnMapping, pkColumns, indexDefinitions)` 4번째 인자로 indexDefinitions 전달.
- **FileUploadForm**: `indexDefinitions` 상태 추가. 모달에 `currentIndexDefinitions` 전달, onSelect에서 `setIndexDefinitions(idxDefs)`. 업로드 FormData에 `index_definitions` JSON append. 요약에 "인덱스: N개" 표시.
- **DbConnectionForm**: `sourceIndexes`, `indexDefinitions` 상태. `openTargetTableSelectModal`에서 `etl2GetSourceColumns`와 `etl2GetSourceIndexes` 병렬 호출 후 소스 PK가 있으면 `setPkColumns(primary.columns.join(', '))`. 모달에 `sourceIndexes`, `pkReadOnlyFromSource`, `currentIndexDefinitions` 전달. 등록 시 `etl2CreateTable` body에 `index_definitions` 포함. 요약에 인덱스 개수 표시.
- **BatchJobFormFile**: `index_definitions` 상태. "인덱스 (선택)" 섹션(인덱스명, 컬럼(쉼표), UNIQUE 체크, 삭제, + 인덱스 추가). `batchCreateJob` body에 `index_definitions` 포함. 등록 성공 시 초기화.
- **etl.css**: 모달용 `.etl-target-select-modal__row--source-pk`, `__source-pk-value`, `__row--source-indexes`, `__index-table-wrap`, `__th--reflect`, `__row--custom-indexes`, `__custom-index-list/row`, `__input--index-name`, `__index-cols-select/__index-cols-label/__index-cols-checkboxes/__index-col-check`, `__custom-index-unique`, `__btn-remove`, `__btn-add` 스타일 추가.
- **인덱스 컬럼 선택 방식 (PK와 동일)**: 인덱스 컬럼을 직접 입력이 아닌 **선택(체크박스)**으로 변경. TargetTableSelectModal에서는 타겟 컬럼 후보(`targetColumnNamesForPk`)를 체크박스로 표시, BatchJobFormFile에서는 `availableColumns`(컬럼 가져와서 선택 결과)를 체크박스로 표시. 컬럼 미로드 시 안내 문구 표시.

**변경 파일:** Frontend/react-app/src/shared/api/client.js, Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx, FileUploadForm.jsx, DbConnectionForm.jsx, BatchJobFormFile.jsx, etl.css, docs/report/log.md.

---

## 2026-03-03 인덱스 설정 기능 추가 (Part 2 — 백엔드)

**목적:** 파일 업로드/배치·DB 연동 시 PK 외에 타겟 테이블 인덱스를 설정·자동 생성. DB 소스는 소스 테이블 PK·인덱스 조회 API 제공.

**스키마:** etl_tables, batch_jobs에 `index_definitions JSONB` 추가. migration: docs/report/migration_index_definitions.sql (시스템 DB에서 실행).

**백엔드 요약:**
- **db_load_service**: _fetch_source_indexes_pg/mysql/oracle, get_source_indexes(connection_id, source_table), _create_indexes_on_target(cur, conn, schema, table, index_definitions). run_db_load(streaming·non-streaming) 적재 완료 후 index_definitions 있으면 인덱스 생성.
- **router**: GET /connections/{connection_id}/source-indexes?source_table= — 소스 테이블 인덱스 목록(PK 포함, is_primary 구분).
- **service**: create_etl_table/update_etl_table/get_etl_table/list_etl_tables에 index_definitions 반영.
- **router**: CreateTableBody/UpdateTableBody·create_table/update_table·upload_file에 index_definitions.
- **load_service.run_file_load**: commit 후 index_definitions 있으면 _create_indexes_on_target 호출.
- **load_service_file.load_dataframe**: index_definitions 파라미터 추가, 테이블 신규 생성 시 인덱스 생성. batch_executor_file에서 job.get("index_definitions") 전달.
- **service_file/router_file**: batch_jobs에 index_definitions 저장·조회, CreateBatchJobBody/UpdateBatchJobBody·create_batch_job/update_batch_job 반영.

**프론트:** GET /source-indexes와 기존 source-columns 조합으로 소스 PK·인덱스 표시 후, PK는 고정·비활성, 인덱스는 체크박스로 타겟 반영 여부 선택 가능. PATCH /tables/{id} body에 index_definitions 포함해 저장.

**변경·추가 파일:** Backend/etl_server2/db_load_service.py, service.py, router.py, load_service.py, load_service_file.py, service_file.py, router_file.py, batch_executor_file.py, docs/report/migration_index_definitions.sql, docs/report/log.md.

---

## 2026-03-03 load_service_file·parser_file·service.py 개선 3건 (etl_server2)

**6. load_service_file.py _batch_upsert — 불필요한 UPDATE 스킵**
- INSERT ON CONFLICT DO NOTHING 후 `inserted_this_batch == len(rows)`이면 충돌 없음이므로 UPDATE FROM VALUES 불필요. 해당 시 `continue`로 UPDATE 쿼리 건너뜀.

**7. parser_file.py _read_csv_robust — 반환 타입 차이 주석**
- `_read_csv_robust` 위에 주석 추가: "배치 파일 파싱용. load_service._read_csv_robust와 달리 DataFrame만 반환(data_verification 미지원)." — parser_file은 배치용, load_service는 파일 업로드용으로 별도 모듈이지만 혼동 방지용 명시.

**8. service.py — _sys_cursor context manager 추가**
- 상단에 `from contextlib import contextmanager` 및 `@contextmanager def _sys_cursor():` 추가. yield (cur, conn), finally에서 cur.close()/conn.close(). 기존 함수는 점진적 변환 대상이며, 새 함수 작성 시 `with _sys_cursor() as (cur, conn):` 사용 권장.

**변경 파일:** Backend/etl_server2/load_service_file.py, Backend/etl_server2/parser_file.py, Backend/etl_server2/service.py, docs/report/log.md.

---

## 2026-03-03 service.py claim_next_pending_job finally에 rollback-safe 패턴 추가 (etl_server2)

**목적:** `claim_next_pending_job`에서 `conn.commit()` 전 예외 시 except에서만 rollback하고, finally에서는 close만 하던 것을 보완. finally에서 close 전에 `try: conn.rollback() except: pass`를 넣어, 어떤 경로로 나가든 트랜잭션 정리 후 커넥션 반환.

**수정 내용 (Backend/etl_server2/service.py):**
- `claim_next_pending_job`의 finally 블록에서 `conn.close()` 직전에 `try: conn.rollback() except Exception: pass` 추가. 이미 commit된 경우 rollback은 no-op이므로 안전.

**변경 파일:** Backend/etl_server2/service.py, docs/report/log.md.

---

## 2026-03-03 batch_executor_file.py 파일 루프 내 commit 실패 명시 처리 (etl_server2)

**목적:** `run_batch_job` 파일 루프에서 `target_conn.commit()` 실패 시 원인(commit 실패)을 로그·이력에 명확히 남기고, rollback 후 run을 error로 종료하도록 처리.

**수정 내용 (Backend/etl_server2/batch_executor_file.py):**
- `load_dataframe` 직후 `target_conn.commit()` 호출을 `try`/`except`로 감쌈.
- `except Exception as commit_err`: `logger.exception("run_batch_job commit failed for %s: %s", filename, commit_err)` 로그, `target_conn.rollback()`(실패 시 무시), `file_results.append({..., "status": "error", "error": str(commit_err)})`, `finish_run(..., "error", ...)`, `update_job_status(..., "error", ...)`, `return`.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-03-03 db_load_service.py non-streaming 경로 conn_main 커넥션 누수 방지 (etl_server2)

**목적:** non-streaming 경로에서 `conn_main` 생성 후 중간 예외 시 최상위 except만 타고 finally가 없어 커넥션이 닫히지 않을 수 있는 누수 방지.

**수정 내용 (Backend/etl_server2/db_load_service.py):**
- non-streaming 블록에서 `conn_main = None` 선언 후 `get_target_db_connection`·이하 전체를 `try` 안에 배치.
- 해당 `try`에 대응하는 `finally` 추가: `if conn_main:` 일 때 `try: conn_main.close() except Exception: pass`로 예외 경로에서도 커넥션 정리.

**변경 파일:** Backend/etl_server2/db_load_service.py, docs/report/log.md.

---

## 2026-03-03 load_service.py run_file_load·run_file_upsert 변수 shadowing 정리 (etl_server2)

**목적:** ETL 메타 dict와 혼동될 수 있는 `row` 변수명을 `etl_row`로 통일하여 가독성·유지보수성 개선.

**수정 내용 (Backend/etl_server2/load_service.py):**
- `run_file_load`: `row = etl_service.get_etl_table(...)` → `etl_row`, 함수 내 모든 `row.get(...)`·`if not row` → `etl_row.get(...)`·`if not etl_row`.
- `run_file_upsert`: 동일하게 `row` → `etl_row` 리네임 및 `row.get` → `etl_row.get` 일괄 치환.

**변경 파일:** Backend/etl_server2/load_service.py, docs/report/log.md.

---

## 2026-03-03 db_load_service.py non-streaming 경로 미정의 변수 버그 수정 (etl_server2)

**목적:** `run_db_load`에서 `effective_batch_size == 0`인 non-streaming 경로에서 `rows_processed`가 정의되기 전에 사용되어 NameError가 발생할 수 있는 버그 수정.

**원인:** non-streaming 분기(else) 안에서 `rows_data`만 구성하고 `rows_processed`는 이후 Phase 4 이후(약 1046행)에서만 할당되는데, 그 전에 `if rows_processed == 0:`으로 조기 반환하는 코드가 있어, 행이 0건일 때 미정의 변수 참조 발생.

**수정 내용 (Backend/etl_server2/db_load_service.py):**
- non-streaming 분기 끝(etl_service.set_job_total_rows 직후)에 `rows_processed = len(rows_data)` 추가.
- `if rows_processed == 0:` → `if len(rows_data) == 0:` 로 변경하여, 해당 분기에서 명시적으로 행 개수 기준으로 조기 반환하도록 함.

**변경 파일:** Backend/etl_server2/db_load_service.py, docs/report/log.md.

---

## 2026-02-23 배치 주기에서 대기 파일 없을 때 run 기록 미생성

**목적:** 해당 배치 주기에서 처리할 대기 파일이 없을 때 `batch_run_history`에 run 로우를 넣지 않고, 그 주기는 그냥 건너뛰도록 변경.

**변경 전:** `create_batch_run()` 호출 후 `list_files`·`get_pending_files` 실행 → pending 비었을 때 `finish_run(run_id, "skipped", files_processed=0)` 호출. 매 주기마다 run 1건이 이력에 쌓임.

**변경 후:** 먼저 폴더 어댑터 연결 → `list_files`·`get_pending_files` 실행. **pending이 비어 있으면** run 생성·갱신 없이 return(로그만 "no pending files, skip (run 기록 없음)"). pending이 있을 때만 `create_batch_run`·`update_job_status(running)` 호출 후 적재 진행.

**효과:** 대기 파일이 없는 주기에는 `batch_run_history`에 로우가 쌓이지 않음. 실행 이력에는 실제로 파일을 처리했거나 시도한 run만 표시됨.

**변경 파일:** Backend/etl_server2/batch_executor_file.py, docs/report/log.md.

---

## 2026-02-23 등록된 폴더 연결 테이블: 연결 정보 열 (SFTP IP, S3 버킷/리전) + 학습 가이드 반영

**목적:** 등록된 폴더 연결 목록에서 SFTP는 IP(host), S3는 버킷(및 리전)을 구분용으로 표시. 동일 내용을 학습 가이드에 반영.

**적용 내용:**
- **FolderConnectionListFile.jsx:** 테이블에 "연결 정보" 열 추가. SFTP → `sftp_host`, S3 → `s3_bucket`(있으면 `s3_region` 함께 표시). 백엔드 `list_folder_connections` 응답 필드 그대로 사용.
- **etc01_Backend_Learning_Flow.md:** §7-1 "폴더 연결 목록 UI (구분용 표시)" 추가(프로토콜별 표시 내용·백엔드 필드 표). §10 Phase 6에 `FolderConnectionListFile.jsx` 항목 추가. §12 배치 API에 `GET /folder-connections` 목록 조회 행 추가.

**변경 파일:** Frontend/react-app/src/packages/etl2/components/FolderConnectionListFile.jsx, docs/report/etc01_Backend_Learning_Flow.md, log.md.

---

## 2026-02-27 docs/main·README 동기화 (log 적용분 반영)

**목적:** log.md에 기록된 2026-02-27 적용 시스템·기능이 docs/main 및 README에 반영되었는지 확인 후, 미반영 분을 문서에 반영.

**반영 내용:**
- **02_BACKEND_GUIDE.md**: §2 etl_server2에 etl_limits.py 추가. §3.3 ETL 한도: config 없을 때 etl_server2 기본값(50/100_000/50_000), 배치 크기 미입력 시 기본 10_000건 상한(etl_server·etl_server2), etl_server db_load_service _safe_is_job_cancelled(시스템 DB 연결 실패 시에도 적재 계속) 명시.
- **00_PRD.md**: §3.2·§6.3 설정에 etl_limits 미지정 시 기본값·배치 미입력 시 1만 건 상한 반영. 변경 이력에 2026-02-27 동기화 항목 추가.
- **README.md**: 설정 요약에 ETL 한도 기본값·배치 기본 1만 건 문구 추가, 최종 업데이트 2026-02-27로 갱신.

**변경 파일:** docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, log.md.

---

## 2026-02-27 ETL2 학습 가이드 전면 재구성 (etc01_Backend_Learning_Flow.md)

**목적:** ETL 시스템을 처음 접하는 개발자가 코드 전에 "시스템이 뭘 하는지, 데이터가 어떻게 흘러가는지"를 잡을 수 있도록, ETL2(Backend/etl_server2, Frontend/packages/etl2) 기준으로 학습 문서 전면 재구성.

**구성:** (1) 시스템 한 문장 정의·E/T/L 다이어그램 (2) 전체 아키텍처(즉시 실행 vs 배치 경로) (3) 6개 레이어별 파일 역할 맵—실제 함수명·라이브러리 명시 (4) 기능별 데이터 흐름 3가지—파일 업로드→적재, 외부 DB→적재, SFTP/S3 배치—단계별 **호출 경로·함수·라이브러리** 표 (5) 변환 파이프라인·Job 생명주기·어댑터 패턴·DB 연결 구조·에러 처리 (6) 의존도 기준 학습 순서(Phase 1~6, 프론트 포함) (7) 설계 패턴·API 엔드포인트·자주 나오는 코드 패턴·한도·ERD.

**변경 파일:** docs/report/etc01_Backend_Learning_Flow.md, 00_ReportIndex.md, log.md.

---

## 2026-02-27 ETL2 etl_limits 기본값 설정 (일반적 서버 사양 기준)

**목적:** config에 etl_limits가 없을 때 0(한도 없음) 대신, 일반적 서버(4~8GB 메모리)에서 무난한 기본 한도 적용.

**적용 값 (Backend/etl_server2/etl_limits.py):**
| 한도 | 이전 | 제안 기본값 | 근거 |
|------|------|-------------|------|
| DEFAULT_MAX_FILE_SIZE_MB | 0 | 100 | PHP 128MB, Apache 50~100MB 등 사례; CSV/Excel 대부분 수용 |
| DEFAULT_MAX_ROWS_PER_LOAD | 0 | 500_000 | SSIS 1만 행/버퍼, Oracle 2~3만/배치; 50만 건이면 스트리밍으로 나눠 처리 시 메모리 안전 |
| DEFAULT_MAX_BATCH_SIZE | 0 | 10_000 | PostgreSQL 500~1k, Oracle JDBC 100~500, SSIS 1만 행; MySQL net_write_timeout·Oracle 메모리와 양립 |

**동작:** config.backend.etl_limits에 값을 넣으면 해당 값 사용; 키가 없을 때만 위 기본값 사용. config에서 0을 넣으면 여전히 "한도 없음"으로 동작.

**변경 파일:** Backend/etl_server2/etl_limits.py, log.md.

---

## 2026-02-27 DB 적재 배치 크기 미입력 시 기본 10000건 limit 적용

**목적:** 배치 크기를 넣지 않으면 전체 fetch 경로로 가서 메모리·부하 위험이 있으므로, 적절한 기본 limit을 적용.

**동작:** `effective_batch_size == 0`(배치 크기 미입력)일 때:
- config `max_rows_per_load`가 있으면 그 값을 사용,
- 없으면 **10000건**을 기본 상한으로 적용 (PostgreSQL·MySQL·Oracle 공통).

**구현:** `db_load_service.py`에 `DEFAULT_FETCH_LIMIT_WHEN_NO_BATCH = 10000` 상수 추가. limit_sql 계산 시 `effective_batch_size == 0`이면 `fetch_limit_when_no_batch = max_rows_per_load if max_rows_per_load > 0 else DEFAULT_FETCH_LIMIT_WHEN_NO_BATCH`로 두고, Oracle은 `FETCH FIRST {n} ROWS ONLY`, MySQL/PostgreSQL은 `LIMIT {n}` 적용.

**참고:** MySQL에만 10000 limit이 있던 것은 아님. 기존에는 배치 미입력 시 config 한도가 없으면 limit 없이 전체 fetch였음. 이번에 세 DB 공통으로 기본 10000 적용.

**백엔드 정정:** ETL2 실행 시 etl_server2 라우터가 etl_server2.queue_worker를 기동하며, 해당 워커는 **etl_server2/db_load_service.py**의 run_db_load를 사용함. etl_server2에는 이미 **MySQL/Oracle batch_size=0 → effective_batch_size=10000** 스트리밍 로직(773–779라인)이 있어, 배치 크기 없이 MySQL 적재 시 1만 건씩 적재되는 것이 맞음. 제가 처음에 etl_server만 보고 "백엔드 미구현"이라고 한 것은 잘못이었음. etl_server에도 동일 로직(MySQL/Oracle 0 → 10000 스트리밍)을 추가해 두 경로를 맞춤.

**UI 문구 정합성:** ETL 설정 모달·등록 폼·목록 도움말을 실제 동작에 맞게 수정(0 = 1만 행 공통, 목록 표시 "전체" → "1만 행(기본)").

**변경 파일:** db_load_service.py(etl_server), EtlTableSettingsModal.jsx, DbConnectionForm.jsx, ETLTableList.jsx, log.md.

---

## 2026-02-27 ETL DB 적재 0건 진행 원인 분석 및 취소 체크 견고화

**현상:** Job 107 (sample_newdb_oracle) 18:00 시작 → 14시간 후 08:28 실패, 처리 건수 0/900000, 에러 "connection to server 49.247.47.206:5432 failed: server closed the connection unexpectedly".

**원인 요약:**
1. **에러 발생 위치:** `run_db_load` 스트리밍 경로에서 **100건마다** 호출하는 `is_job_cancelled(job_id)`가 **시스템 DB**(49.247.47.206:5432)에 새 연결을 만들 때 실패한 것임. 적재 루프 자체는 타겟(메인) DB에 INSERT 중이었음.
2. **왜 0건으로 보였는지:** 진행률(`rows_processed`)은 **배치 단위**로만 갱신됨(각 배치 처리 후 `update_job_progress` 호출). 첫 배치 안에서 100건 처리 후 첫 취소 체크 시 시스템 DB 연결 실패 → 예외 발생 → 해당 배치의 `commit`/`update_job_progress` 미실행 → 롤백되어 타겟에도 0건, UI에도 0건으로 표시됨.
3. **14시간이 걸린 이유:** 첫 100건 INSERT가 **타겟(메인) DB 또는 네트워크 지연**으로 매우 느렸을 가능성이 큼(건당 수 분 수준). 그 후 첫 취소 체크에서 시스템 DB가 이미 끊어진 상태였을 수 있음.

**대응:**  
- **db_load_service:** `_safe_is_job_cancelled(job_id)` 헬퍼 추가. `is_job_cancelled` 호출을 try/except로 감싸, 시스템 DB 연결 실패 등 예외 시 경고 로그만 남기고 **False(취소 아님)** 반환하여 적재를 계속 진행하도록 함. 스트리밍·비스트리밍(full/incremental) 세 곳 모두 `_safe_is_job_cancelled` 사용하도록 변경.  
- **운영 권장:** 타겟 DB(메인 DB) INSERT 지연 원인 점검(인덱스, 네트워크, 동시 부하). 시스템 DB(49.247.47.206) 안정성·타임아웃 점검.

**변경 파일:** db_load_service.py, log.md.

---

## 2026-02-26 배치 Job 중복 등록 방지 (동일 폴더·패턴·타겟·저장DB)

**목표:** 동일한 폴더 연결·파일 패턴·타겟 테이블·저장 DB 조합으로 배치 Job을 두 개 이상 등록하지 않도록 하고, 이미 있으면 새 행을 추가하지 않고 안내만 하기.

**구현:**
- **service_file.create_batch_job:** INSERT 전에 (folder_connection_id, file_pattern, target_table, storage_connection_id) 조합으로 기존 행 존재 여부 조회. storage_connection_id는 NULL·값 동일 비교를 위해 `IS NOT DISTINCT FROM` 사용. 타겟 테이블·파일 패턴이 비어 있으면 검사 생략.
- 중복이 있으면 `ValueError("이미 동일한 폴더·파일 패턴·타겟 테이블·저장 DB로 등록된 배치 Job이 있습니다. 기존 Job을 수정하거나 삭제한 뒤 다시 등록해 주세요.")` 발생.
- **router_file:** 기존대로 ValueError → HTTP 400, detail=str(e). 프론트는 err.message로 안내 문구 표시.

**효과:** 동일 조합으로 등록 시 로우가 추가되지 않고, 에러 메시지로 기존 Job 수정/삭제 후 등록하라고 안내됨.

**변경 파일:** service_file.py, log.md.

---

## 2026-02-26 배치 upsert 갱신 건수 중복 집계 수정

**문제:** 파일별 상세에서 두 번째 파일이 전부 새 행(삽입)인데도 "삽입 180001, 갱신 200001"처럼 갱신 건수가 과다하게 나옴. 행 수 200001인데 삽입+갱신이 380002로 맞지 않음.

**원인:** `load_service_file._batch_upsert` 2단계에서 UPDATE ... FROM (VALUES ...) WHERE t.pk = v.pk 를 배치 전체에 대해 실행하면, 방금 1단계에서 INSERT한 행까지 매칭되어 함께 갱신됨. 그래서 UPDATE의 rowcount에 "실제 기존 행 갱신"과 "이번에 삽입한 행"이 모두 포함되어 갱신 건수가 부풀어 오름.

**수정:** 2단계 후 `total_updated`에 `cur.rowcount`를 그대로 더하지 않고, `max(0, cur.rowcount - inserted_this_batch)`를 더하도록 변경. 이번 배치에서 삽입된 건수만큼 빼서 실제로 기존에 있던 행만 갱신 건수로 집계.

**효과:** 파일별·run별 삽입/갱신 건수가 실제 INSERT/UPDATE 건수와 일치하고, 행 수 = 삽입 + 갱신으로 맞게 표시됨.

**변경 파일:** load_service_file.py, log.md.

---

## 2026-02-26 배치 Job 목록 섹션 패딩 및 새로고침 버튼

**목표:** 폴더 탭에서 배치 Job 목록을 위 섹션(폴더 연결 목록)과 시각적으로 구분하고, 목록 테이블만 재조회할 수 있는 새로고침 버튼 추가.

**구현:**
- **ETLPage.jsx:** 배치 Job 섹션(`etl-db-form__section--batch-job`) 상단 여백을 24px → 40px로 증가.
- **BatchJobListFile.jsx:** 목록 상단에 툴바(`etl-batch-job-list__toolbar`)와 [새로고침] 버튼 추가. 로딩/빈 목록/테이블 표시 모든 상태에서 버튼 노출, 로딩 중에는 비활성화. 클릭 시 `loadList()`로 `batchListJobs()`만 재호출.
- **etl.css:** `.etl-batch-job-list__section`(margin-top: 24px), `.etl-batch-job-list__toolbar`, `.etl-batch-job-list__refresh` 스타일 추가.

**변경 파일:** ETLPage.jsx, BatchJobListFile.jsx, etl.css, log.md.

---

## 2026-02-26 ETL 목록 배치 행 삭제 시 배치 Job cascade 삭제

**문제:** ETL 목록에서 배치 유래 행을 먼저 삭제하면 삭제가 되지 않음. 배치 잡을 먼저 지우고 ETL 목록에서 지우는 흐름이 아님.

**변경:** ETL 목록에서 "삭제" 시 연결된 배치 Job이 있으면 먼저 cascade 삭제(스케줄러 제거 + delete_batch_job), 이어서 타겟 테이블 DROP 및 레지스트리 행 삭제. 한 번에 ETL 목록에서만 삭제해도 배치 Job·테이블·레지스트리가 정리되도록 함.

**변경 파일:** service_file.py (delete_batch_target_registry_and_drop_table), ETLTableList.jsx (확인 문구), log.md.

---

## 2026-02-26 ETL 목록에 배치 타겟 레지스트리 연동 (배치 행 = 테이블 관리용만)

**목표:** 배치 Job을 ETL 목록에 “행”으로 넣어 관리. 배치 삭제 시 잡만 삭제·테이블 유지; ETL 목록에서 해당 행 삭제 시에만 타겟 DROP. 동일 target_table로 새 배치 생성 시 기존 행 업데이트.

**구현:**
- **etl_batch_target_registry** (시스템 DB): id, target_table, storage_connection_id, batch_job_id(NULLABLE), created_at, updated_at. UNIQUE(target_table, storage_connection_id). CREATE TABLE IF NOT EXISTS로 초기 생성.
- **service_file:** list_batch_target_registry(backfill 포함), upsert_batch_target_registry, clear_batch_job_from_registry, delete_batch_target_registry_and_drop_table. create_batch_job 후 upsert 호출; delete_batch_job 전에 clear_batch_job_from_registry 호출.
- **router_file:** GET /batch/target-registry, DELETE /batch/target-registry/:id.
- **client.js:** etl2ListBatchTargetRegistry, etl2DeleteBatchTargetRegistry.
- **ETLTableList:** 목록 소스를 etl2ListTables + etl2ListBatchTargetRegistry로 변경. type 'batch_target' 행은 즉시실행·이력 없이 삭제 버튼만 표시. 삭제 시 etl2DeleteBatchTargetRegistry(id) → 타겟 DROP + 레지스트리 행 삭제.

**효과:** (1) 배치 Job 삭제 시 타겟 테이블 유지, ETL 목록에는 해당 타겟 행이 계속 표시. (2) ETL 목록에서 해당 행 삭제 시에만 타겟 DROP. (3) 동일 target_table+storage로 새 배치 생성 시 기존 레지스트리 행의 batch_job_id만 갱신.

**변경 파일:** service_file.py, router_file.py, client.js, ETLTableList.jsx, log.md.

---

## 2026-02-26 배치 upsert 삽입/갱신 건수 구분 수정

**문제:** 두 번째 파일 적재 시 실제로는 새 행 추가(삽입)인데도 이력에 "갱신 200001"로만 표시됨. 삽입 행 0, 갱신 행 200001로 나옴.

**원인:** `load_service_file._batch_upsert`가 INSERT ... ON CONFLICT DO UPDATE 한 번만 실행하고 반환을 항상 `(0, total)`로 해서, 실제 INSERT된 행도 전부 "갱신"으로 집계됨.

**수정:** `_batch_upsert`에서 삽입/갱신 건수를 구분하도록 2단계 실행.
1. `INSERT ... ON CONFLICT (pk) DO NOTHING` 실행 → `cursor.rowcount` = 실제 삽입 건수.
2. 같은 배치로 `UPDATE table SET ... FROM (VALUES ...) AS v(...) WHERE table.pk = v.pk` 실행 → `cursor.rowcount` = 갱신 건수.
non_pk가 없으면 기존처럼 DO NOTHING만 사용하며 updated=0.

**효과:** 이력의 "삽입 행"/"갱신 행"이 실제 INSERT/UPDATE 건수와 일치함.

**변경 파일:** load_service_file.py, log.md.

---

## 2026-02-26 배치 첫 실행 큐 처리 변경 — 잠재 이슈 점검

**목적:** "첫 실행 시 대기 파일 전부 반환" 변경에 따른 기능·로직·알고리즘 잠재 문제 점검.

**점검 결과 요약:**
- **정상:** run 시작 시 get_pending_files 1회 호출, 동일 pending으로 파일별 순회. 메모리는 파일 단위만 사용. 에러/취소 시 이미 처리분 커밋 유지·다음 run에서 실패 파일부터 재시도. list_folder_columns/validate-target은 pending[0]만 사용해 변경 영향 없음.
- **주의:** 스킵(크기 초과/중복 체크섬) 시 last_processed_ts 미갱신 — 스킵 파일이 중간에 있으면 영구 스킵, 맨 마지막이면 매 run 재시도. 대량 대기 파일 시 1 run 장시간·연결 유지 가능성; 필요 시 run당 상한 확장 고려.
- **문서:** 09_ETL_SFTP_Connection.md §4.2에 "주의·잠재 이슈" 문단 추가.

**변경 파일:** 09_ETL_SFTP_Connection.md, log.md.

---

## 2026-02-26 배치 Job 첫 실행 시 이전 시점 파일 큐 처리 수정

**문제:** 새로 등록한 배치 Job(예: 오후 3:25 등록) 실행 시, 해당 시점 이전에 SFTP에 올라온 동일 패턴 파일이 2개 있어도 1개만 처리되고 두 번째 파일은 다음 주기(예: 6시간 후)까지 처리되지 않음.

**원인:** `parser_file.get_pending_files`에서 `last_processed_ts`가 None(첫 실행)일 때 `candidates[:1]`로 **가장 오래된 1건만** 반환하도록 되어 있었음. 문서(09_ETL_SFTP_Connection.md)에도 "첫 실행 1건 → 다음 주기에서 나머지"로 기술되어 있었으나, 기대 동작은 "이전 시점 파일들을 큐로 쌓아 한 run에서 순차 처리".

**수정:**
- **parser_file.py:** `get_pending_files` 첫 실행 분기에서 `candidates[:1]` 제거. `last_processed_ts is None`일 때 `ts <= max_ts`인 매칭 파일 **전부** 반환하도록 변경. `batch_executor_file`은 이미 `pending`을 for 루프로 순회하며 파일별 `update_last_processed_ts` 호출하므로 추가 수정 없음.
- **09_ETL_SFTP_Connection.md:** §4.2 증분 판단 설명을 "첫 실행 시에도 대기 파일 전부 처리(한 run에서 큐처럼 순차 적재)"로 정리.

**효과:** 배치 등록 후 즉시 실행(또는 첫 주기 실행) 시, 등록 시점 이전에 올라온 동일 패턴 파일이 여러 개 있으면 타임스탬프 오름차순으로 한 run에서 모두 처리됨.

**변경 파일:** parser_file.py, 09_ETL_SFTP_Connection.md, log.md.

---

## 2026-02-26 ETL 목록·잡 이력 테이블 새로고침 버튼 추가

**목표:** ETL 목록 테이블과 잡 이력 테이블에서 해당 테이블만 다시 불러오는 [새로고침] 버튼 제공.

**구현:**
- **ETLTableList.jsx:** 상단에 툴바(`etl-table-list__toolbar`)와 [새로고침] 버튼 추가. 클릭 시 `load()` 호출로 `etl2ListTables`·`batchListJobs`만 재호출. 로딩/에러/빈 목록/테이블 표시 모든 상태에서 버튼 노출, 로딩 중에는 비활성화.
- **BatchHistoryPanelFile.jsx:** 이력 테이블 위에 `etl-db-form__table-actions` 영역과 [새로고침] 버튼 추가. 클릭 시 `loadHistory(false)` 호출로 해당 배치 Job의 `batchListJobHistory`만 재호출.
- **JobHistoryPanel.jsx:** 상태 필터와 같은 줄에 `etl-history__bar`로 [새로고침] 버튼 배치. 클릭 시 `load()` 호출로 `etl2ListJobs`만 재호출(현재 선택된 상태 필터 유지).
- **etl.css:** `etl-table-list__toolbar`, `etl-table-list__refresh`, `etl-db-form__table-actions`, `etl-history__bar`, `etl-history__refresh` 스타일 추가.

**변경 파일:** ETLTableList.jsx, BatchHistoryPanelFile.jsx, JobHistoryPanel.jsx, etl.css, log.md.

---

## 2026-02-25 서브에이전트 동작 보강 (be-impl/fe-impl, @태그, 모델 안내)

**목표:** 메인 혼자만 일하는 문제 해결 — 서브에이전트 실제 호출을 위해 에이전트 추가·오케스트레이터·커맨드·안내 문서 반영.

**원인 대응:**
- Auto/Composer 1 모델은 서브에이전트(Task 도구) 미지원 → 오케스트레이터·README에 지원 모델(Claude Opus 4.6, Gemini 2.5 Flash 등) 명시.
- 위임 시 룰만 참고하고 메인이 직접 처리 → **@에이전트명** 호출 강제 및 add-feature에서 "위임과 조율만, 직접 코드 작성 금지" 명시.

**구현 요약:**
- **.cursor/agents/be-impl.md** (신규): 백엔드 service + router 통합 전담. description 짧고 구체적.
- **.cursor/agents/fe-impl.md** (신규): 프론트 client.js + 컴포넌트 + CSS 통합 전담.
- **.cursor/agents/verifier.md**: "파일을 수정하지 않습니다" 명시, 검증 항목·출력 형식 간결화.
- **.cursor/rules/tech-lead-orchestration.mdc**: 필수 확인(서브에이전트 지원 모델), MUST @태그 사용, 위임 조건에 @be-impl @fe-impl @verifier 예시 추가.
- **.cursor/commands/add-feature.md**: @be-impl @fe-impl @verifier 위임 순서로 재작성, "당신은 위임과 조율만 합니다" 명시, 모델 안내 문구 추가.
- **.cursor/README.md** (신규): 서브에이전트 동작 조건(모델 선택·@호출·회색 박스 확인), 디렉터리 역할, 에이전트·커맨드 요약.

**변경·신규 파일:** .cursor/agents/be-impl.md(신규), .cursor/agents/fe-impl.md(신규), .cursor/agents/verifier.md, .cursor/rules/tech-lead-orchestration.mdc, .cursor/commands/add-feature.md, .cursor/README.md(신규), log.md.

---

## 2026-02-25 Cursor commands 추가 (add-feature, pr, verify)

**목표:** 반복 워크플로우를 `/명령어`로 실행할 수 있도록 .cursor/commands에 커맨드 3종 추가.

**추가 파일:**
- **add-feature.md**: 새 기능 백엔드→프론트 전체 체인. 플랜 테이블 출력 → be-data → be-router → fe-state → fe-markup → fe-style → cross-check → 결과 요약.
- **pr.md**: 현재 변경사항으로 PR 생성. git diff 확인 → 커밋 메시지(한국어) → 커밋+푸시 → gh pr create → PR URL 출력.
- **verify.md**: 전체 연결 정합성 검증. client.js↔라우터, Pydantic↔프론트, SELECT↔row 접근, className↔CSS, npm run build → ✅/❌ 결과 테이블.

**변경 파일:** .cursor/commands/add-feature.md(신규), .cursor/commands/pr.md(신규), .cursor/commands/verify.md(신규), log.md.

---

## 2026-02-25 Cursor 멀티에이전트 오케스트레이션·스킬 보강

**목표:** 병렬 위임이 동작하도록 오케스트레이션 룰 강제화, 신규 스킬 추가, cross-check 자동 실행 조건 명시.

**구현 요약:**
- **tech-lead-orchestration.mdc**: MUST 키워드·플랜 테이블 선출력 강제. 자동 위임 조건(백엔드+프론트 동시 수정 / 수정 3개 이상 / router+service+client 체인) 1개라도 해당 시 반드시 서브에이전트 위임. Phase 순서(1: be-data+fe-style 병렬 → 2: be-router → 3: fe-state+fe-markup → 4: be-worker → 5: verifier/linker). 예외: 단일 파일·CSS만·주석/문서만. `alwaysApply: true` 유지.
- **error-resolver 스킬**: `.cursor/skills/error-resolver/SKILL.md` 신규. 빌드/런타임/타입 에러 시 파일:라인 추출 → 관련 코드 확인 → 수정안(diff) 제시. 프론트(Module not found, JSX), 백엔드(ImportError, ValidationError, psycopg2) 분류.
- **migration-helper 스킬**: `.cursor/skills/migration-helper/SKILL.md` 신규. DB 스키마 변경 시 ALTER TABLE → service.py → Pydantic → client.js → UI → cross-check 체크리스트.
- **cross-check SKILL.md**: "자동 실행 조건 (MUST)" 섹션 추가. 엔드포인트 추가/수정, client.js 함수 추가/수정, service.py 반환값 변경, DB 스키마 변경 후 반드시 cross-check 실행.

**변경·신규 파일:** .cursor/rules/tech-lead-orchestration.mdc, .cursor/skills/error-resolver/SKILL.md(신규), .cursor/skills/migration-helper/SKILL.md(신규), .cursor/skills/cross-check/SKILL.md, log.md.

---

## 2026-02-26 ETL 변환 룰 — 매핑 모달 내 통합

**목표:** 타겟 테이블 매핑 모달(TargetTableSelectModal)에서 컬럼 매핑과 변환 설정을 한 화면에서 처리하고, 미리보기로 결과를 즉시 확인.

**구현 요약:**
- **Phase 1 (Backend):** `POST /api/etl2/transform/preview` 추가. Body: `etl_table_id?`, `rules?`, `sample_data?`, `max_rows`(기본 10). `sample_data` 있으면 DataFrame으로 사용, 없고 `etl_table_id` 있으면 `preview_service.get_raw_sample()`로 파일/DB 원본 샘플 조회. `transform_engine.apply_rules(df, rules)` 호출 후 `before`/`after`/`column_changes`/`new_columns`/`rows_before`/`rows_after` 반환. `preview_service`에 `get_raw_sample`, `_raw_sample_db` 추가.
- **Phase 4 (client.js):** `etl2TransformPreview(body)`, `etl2CreateTransformRule(body)`, `etl2UpdateTransformRule(ruleId, body)`, `etl2DeleteTransformRule(ruleId)` 추가.
- **Phase 2 (TargetTableSelectModal):** 매핑 테이블에 **변환** 열 추가. 드롭다운: 없음 | 정리 | 타입 변환 | 정리+타입 변환 | 값 매핑. 값 매핑 선택 시 `CodeMapInlineEditor` 인라인 편집(원본값→변환값, 매핑 안 된 값: NULL/유지/기본값). 적용 시 `etlTableId`가 있으면 기존 룰(해당 source_column) 삭제 후 `getAssembledRules()`로 새 룰 POST. `apply_order` = 컬럼 인덱스×10 + 서브인덱스.
- **Phase 3 (TransformPreviewPanel):** 신규 `TransformPreviewPanel.jsx`. 매핑 모달 하단 미리보기 토글, "미리보기 새로고침" 버튼으로 `etl2TransformPreview({ etl_table_id, rules })` 호출. before/after 테이블 나란히 표시, 변경 셀 하이라이트, 컬럼별 요약 뱃지. `etlTableId` 없으면 "ETL 등록 후 미리보기를 사용할 수 있습니다." 안내.

**제약:** `transform_engine.py`, `transform_rules_service.py` 수정 없음. derived, masking 타입 UI 미포함. 폴더 배치 Job에는 변환 룰 미적용.

**변경·신규 파일:** router.py, preview_service.py, client.js, TargetTableSelectModal.jsx, TransformPreviewPanel.jsx(신규), etl.css, log.md. 제작 플랜: docs/report/ETL_Transform_Rules_Implementation_Plan.md.

---

## 2026-02-26 ETL2 실행 이력·상세 실시간 갱신 (폴링 + 진행 중 file_list 반영)

**문제:** 실행 이력 모달에서 진행 중(running)인 run이 있어도 목록·상세가 한 번만 로드되어 실시간으로 갱신되지 않음. 상세 창에서 파일별 진행이 보이지 않음.

**원인:** (1) 프론트: 이력 목록·상세 모두 마운트 시 1회만 API 호출, 폴링 없음. (2) 백엔드: `file_list`·집계는 `finish_run` 시에만 DB 반영되어, running 중에는 상세 API가 빈 결과만 반환.

**수정:**
- **BatchHistoryPanelFile.jsx**: `status === 'running'`인 run이 있으면 2초 간격으로 `batchListJobHistory` 재호출(조용한 갱신, 로딩 플래그 없음).
- **BatchHistoryDetailFile.jsx**: `detail.status === 'running'`이면 2초 간격으로 `batchGetJobHistoryDetail` 재호출. `loadDetail(silent=true)`로 배경 갱신하여 로딩 깜빡임 없음.
- **service_file.py**: `update_run_progress(run_id, files_processed, rows_inserted, rows_updated, file_list, conn)` 추가. `status='running'`인 run만 갱신(상세 화면 실시간 반영용).
- **batch_executor_file.py**: 파일 1건 처리(성공·스킵) 후 매번 `update_run_progress` 호출. 스킵(크기 초과·중복·빈 파일) 시에도 호출.

**효과:** 이력 목록에서 진행 중 run의 상태가 주기적으로 갱신되고, 상세 창을 열어두면 처리된 파일 수·file_list·삽입/갱신 행이 실시간으로 표시됨.

**변경 파일:** BatchHistoryPanelFile.jsx, BatchHistoryDetailFile.jsx, service_file.py, batch_executor_file.py, log.md.

---

## 2026-02-26 ETL2 PK 컬럼 "컬럼 가져와서 선택" 로딩 최적화

**원인:** 컬럼명만 필요한데도 원격(SFTP/S3)에서 **파일 전체**를 다운로드한 뒤 `read_file(..., max_rows=1)`로 1행만 읽고 있어, 대용량 CSV일수록 전송 시간이 길어짐.

**수정:**  
- **folder_adapter_file.py**: `FolderAdapter`에 `download_file_head(filename, local_path, max_bytes=65536)` 추가. SFTP는 `sftp.open(remote).read(max_bytes)`로 앞부분만 읽어 로컬에 저장. S3는 `get_object(..., Range='bytes=0-65535')`로 앞 64KB만 받음.  
- **router_file.py** `list_folder_columns`: 확장자가 **csv**일 때는 `adapter.download_file_head(...)`만 호출하고, xlsx/xls/parquet는 기존대로 전체 다운로드.

**효과:** CSV 기준으로 "컬럼 가져와서 선택" 시 수십~수백 MB 파일도 최대 64KB만 전송하므로 로딩 시간 단축.

**변경 파일:** folder_adapter_file.py, router_file.py, log.md.

---

## 2026-02-26 ETL2 DB 연결·폴더·저장 DB 섹션 카드 접기/펼치기 통일

**목적:** DB 연결에만 있던 섹션 넘버링(1, 2) 제거하고, DB 연결·폴더·저장 DB 등록 탭의 섹션을 공통 접기/펼치기 카드로 통일.

**구현:**
- **CollapsibleCardSection.jsx**: title, defaultOpen, subtitle, children. 헤더(▶/▼) 클릭으로 본문 토글. defaultOpen이 false로 바뀌면 한 번 닫힘.
- **연결 추가 섹션** 디폴트: 등록된 항목이 있으면 닫힘(defaultOpen=false), 없으면 열림(defaultOpen=true). DB 연결·저장 DB는 동일 컴포넌트에서 목록 개수로 판단. 폴더는 목록이 별도 컴포넌트라 defaultOpen=true 유지.
- DbConnectionForm: "연결 추가", "등록된 연결", "ETL 테이블 등록" 각각 CollapsibleCardSection 적용, step-num 제거.
- StorageConnectionForm: "저장 DB 추가", "등록된 저장 DB" CollapsibleCardSection 적용.
- FolderConnectionFormFile: "폴더 연결 추가" CollapsibleCardSection 적용.
- FolderConnectionListFile: "등록된 폴더 연결" CollapsibleCardSection 적용.
- etl.css: .etl-db-form__section--collapsible, .etl-db-form__card-toggle, .etl-db-form__card-body 등 추가.

**변경 파일:** CollapsibleCardSection.jsx(신규), etl.css, DbConnectionForm.jsx, StorageConnectionForm.jsx, FolderConnectionFormFile.jsx, FolderConnectionListFile.jsx, log.md.

---

## 2026-02-26 ETL 목록 배치 Job 행 컬럼 정렬·저장 DB/상태 표시 수정

**문제:** 등록된 ETL 목록에 배치 Job 행이 들어갈 때 컬럼이 어긋나고(저장 DB/상태가 잘못된 칸에 표시), 저장 DB·상태가 "—" 또는 raw 값(success)으로만 보임.

**원인:** 배치 행에 `<td>`가 하나 더 있어 13개 칸이 됨(헤더 12개와 불일치). 저장 DB는 API에서 내려주지 않음.

**수정:** (1) 배치 행에서 불필요한 `<td>—</td>` 제거해 12열로 맞춤. (2) 백엔드 `list_batch_jobs`에 `etl_storage_connections` LEFT JOIN 추가해 `storage_connection_name` 반환. (3) 프론트 mergedRows에 `storage_connection_name` 반영(storage_connection_id 없으면 '기본 DB'). (4) 배치 상태 셀에 한글 표기(성공/에러/실행중/활성/비활성) 적용.

**변경 파일:** service_file.py, ETLTableList.jsx, log.md.

---

## 2026-02-26 ETL2 배치 Job 삭제 시 FK 위반 해결

**문제:** 배치 Job 삭제 시 `batch_run_history_batch_job_id_fkey` 위반 — `batch_run_history`가 `batch_jobs.batch_job_id`를 참조하여 DELETE가 거부됨.

**원인:** `delete_batch_job`이 `batch_jobs`만 DELETE하고, 자식 테이블(`batch_run_history`, `batch_loaded_keys`)을 먼저 지우지 않음.

**수정:** `service_file.delete_batch_job`에서 삭제 순서를 ① `batch_loaded_keys` ② `batch_run_history` ③ `batch_jobs` 로 하고, 각각 해당 `batch_job_id` 행만 삭제한 뒤 `batch_jobs` 삭제하도록 변경.

**변경 파일:** service_file.py, log.md.

---

## 2026-02-26 ETL2 배치 Job 주기 수정 UI

**목적:** 등록된 배치 Job의 실행 주기(interval_minutes)를 목록에서 수정 가능하도록 함.

**구현:** BatchJobListFile에 "주기 수정" 버튼 추가. 클릭 시 모달(etl-pk-modal 스타일 재사용)에서 주기(분) 10~1440 입력 후 저장 시 `batchUpdateJob(id, { interval_minutes })` 호출. 백엔드 PATCH `/api/etl2/batch/jobs/:id` 및 `reschedule_job`은 기존 구현 사용.

**변경 파일:** BatchJobListFile.jsx, log.md.

---

## 2026-02-26 ETL2 폴더 배치 "기본 DB" = ibank_db 정합성 수정

**문제:** "기본 DB"로 설정해도 폴더 배치의 테이블 생성·적재가 저장 DB 목록의 첫 번째(PostgreSQL) 연결로 들어감. 파일 업로드/DB 연결 탭에서는 `storage_connection_id` 없을 때 `get_target_db_connection(None)` → ibank_db를 사용함.

**원인:**  
- 프론트: "기본 DB"(value="") 선택 시 422 방지를 위해 `storage_connection_id`를 저장 DB 목록 첫 번째 ID로 대체해 전송.  
- 백엔드: `create_batch_job(storage_connection_id: int)` 필수, 실행기/롤백은 `job["storage_connection_id"]`만 사용 → "기본 DB" 경로 없음.

**수정 요약:**  
- **기본 DB 정의:** `etl_server2.service.get_target_db_connection(None)` = config 기반 ibank_db (파일/DB 탭과 동일).  
- **백엔드:** `storage_connection_id` Optional 처리. `CreateBatchJobBody`/`ValidateTargetBody`에서 `Optional[int] = None`. `service_file.create_batch_job`·`rollback_file_from_target` 인자 `Optional[int]`. `load_service_file.get_target_connection(None)` → `get_target_db_connection(None)` 호출. 배치 실행기·롤백·clone 시 `job["storage_connection_id"]`가 None이면 그대로 전달.  
- **프론트:** "기본 DB" 선택 시 `storage_connection_id`를 null로 두고 전송(sid 계산 시 첫 번째 연결 사용 제거). 타겟 테이블 목록은 `sidForTarget === null`일 때도 `batchListTargetTables(null)` 호출해 기본 DB 테이블 로드.  
- **DB:** `batch_jobs.storage_connection_id`에 NULL 허용 필요. 기존 컬럼이 NOT NULL이면 마이그레이션:  
  `ALTER TABLE <system_schema>.batch_jobs ALTER COLUMN storage_connection_id DROP NOT NULL;`

**변경 파일:** router_file.py, service_file.py, load_service_file.py, BatchJobFormFile.jsx, log.md.

---

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