# ETL 변환 룰 — 매핑 모달 내 통합 제작 플랜

## 목표
타겟 테이블 매핑 모달(TargetTableSelectModal)에서 컬럼 매핑과 변환 설정을 한 화면에서 처리하고, 미리보기로 결과를 즉시 확인.

## 원칙
- 변환 설정은 매핑 모달 안에서만. 별도 변환 룰 모달 없음.
- transform_engine.py, transform_rules_service.py 수정 금지.
- 폴더 배치 Job에는 변환 룰 미적용.

---

## Phase 1: 미리보기 API (Backend)
**파일:** `Backend/etl_server2/router.py`

- **엔드포인트:** `POST /api/etl2/transform/preview`
- **Body (Pydantic):** `etl_table_id?: int`, `rules?: list`, `sample_data?: list`, `max_rows?: int` (기본 10)
- **로직:**
  - `sample_data` 있음 → `pd.DataFrame(sample_data)` 사용
  - 없고 `etl_table_id` 있음 → 해당 ETL의 원본에서 샘플: 파일이면 `load_service._read_file(path, type, max_rows)` 반환 DataFrame, DB면 소스 연결로 `SELECT * FROM ... LIMIT max_rows` 후 `pd.DataFrame(rows)`
  - `rules` 있음 → 그대로 사용; 없고 `etl_table_id` 있음 → `transform_rules_svc.list_transform_rules(etl_table_id)` 사용
  - `transform_engine.apply_rules(df, rules)` 호출
  - 응답: `before`(df.to_dict('records')), `after`(변환 후), `column_changes`(컬럼별 changed_rows, null_before, null_after), `new_columns`, `rows_before`, `rows_after`
- **주의:** datetime 등 직렬화 시 `.isoformat()` 적용. transform_engine/transform_rules_service 는 수정하지 않음.

---

## Phase 4: client.js API
**파일:** `Frontend/react-app/src/shared/api/client.js`

- `etl2TransformPreview(body)` — `POST /api/etl2/transform/preview`, body: `{ etl_table_id?, rules?, sample_data?, max_rows? }`
- `etl2CreateTransformRule(body)` — `POST /api/etl2/transform-rules`, body: CreateTransformRuleBody 형식
- `etl2UpdateTransformRule(ruleId, body)` — `PUT /api/etl2/transform-rules/{ruleId}`
- `etl2DeleteTransformRule(ruleId)` — `DELETE /api/etl2/transform-rules/{ruleId}`
- (이미 있음: `etl2ListTransformRules(etlTableId)`)

---

## Phase 2: 매핑 테이블에 "변환" 열
**파일:** `Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx`

- 매핑 테이블 각 행에 **변환** 드롭다운 추가.
- 옵션: **없음** | **정리** | **타입 변환** | **정리 + 타입 변환** | **값 매핑**
- **정리:** cleansing 룰 1건, `rule_config: { empty_to_null: true }` + TRIM(엔진 기본 동작)
- **타입 변환:** type_cast 룰, 매핑의 타입(DATE/INTEGER/NUMERIC 등) + 같은 행의 "변환 실패 시" 셀렉트 값을 on_error로
- **정리+타입 변환:** cleansing(apply_order=col*10) + type_cast(apply_order=col*10+1) 두 건
- **값 매핑:** 클릭 시 인라인 key-value 편집기 (원본값 → 변환값, [+ 추가], 매핑 안 된 값: NULL/유지/기본값)
- **적용 버튼 시:** 기존대로 테이블·매핑·PK 저장 후, 변환 설정된 컬럼에 대해: 기존 룰 삭제(해당 etl_table_id + source_column인 rule_id 목록 조회 후 DELETE) → 새 룰 POST. apply_order = 컬럼 인덱스 × 10 + 서브인덱스(0=정리, 1=타입변환 등).

---

## Phase 3: 미리보기 패널
**파일:** `Frontend/react-app/src/packages/etl2/components/TransformPreviewPanel.jsx` (신규)

- 매핑 모달 하단에 "미리보기" 토글. 펼치면 패널 표시.
- 현재 매핑 테이블에서 설정된 변환을 `rules` 배열로 조립(저장 전이므로 `sample_data` + `rules` 전달).
- `POST /api/etl2/transform/preview` 호출.
- 응답 before/after를 나란히 테이블로 표시. 변경된 셀은 배경색 하이라이트.
- 컬럼별 변화 요약(changed_rows, null 증가) 뱃지로 상단 표시.
- "미리보기 새로고침" 버튼으로만 갱신(자동 갱신 없음).

---

## 적용 시 룰 삭제 후 생성 (Phase 2에 포함)
- 적용 시 해당 `etl_table_id`의 기존 rules를 `etl2ListTransformRules(etl_table_id)`로 조회.
- 변환을 설정한 source_column에 해당하는 rule_id만 `etl2DeleteTransformRule(rule_id)` 호출.
- 그 다음 새 룰들을 `etl2CreateTransformRule`로 생성 (apply_order = columnIndex*10 + subIndex).

---

## 제약
- derived, masking 타입은 이번 작업에서 UI 미포함.
- transform_engine.py, transform_rules_service.py 수정 금지.
- 폴더 배치(batch_executor_file.py)에는 변환 룰 미적용.
