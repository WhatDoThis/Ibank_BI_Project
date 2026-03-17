# Log

## Log Index
2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원

## Log Body

2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
Purpose: 컬럼 변환 카테고리(타입 변환·문자열·마스킹·날짜/시간) 진입 시 셀렉트박스·입력 필드가 모달 레이아웃에 맞게 통일되도록 스타일 정리.

Changes:
- etl.css: 변환 상세 공통 셀렉트 스타일(--detail, --type-cast-target, --string-op, --masking-op 통일). etl-detail__select-wrap을 flex로 넓이 100%·max-width 220px 적용. transform-detail-group gap·min-width·max-width 정리. transform-detail-summary 스타일 추가. input--detail 패딩/폰트/최대폭 셀렉트와 맞춤.
- TransformDetailRow.jsx: 모든 변환 상세 셀렉트에 etl-target-select-modal__select--detail 사용(타입 변환·문자열·마스킹·날짜 연산/시간대 등).

Changed files:
- Frontend/react-app/src/packages/etl/etl.css
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- docs/log/log.md

1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원
Purpose: 컬럼 매핑에서 날짜 포맷·부분 추출·날짜 차이·나이 계산·날짜 더하기 연산을 시간대 변환과 동일하게 UI 입력 및 API rule_config 저장이 가능하도록 세팅.

Changes:
- constants.js: DATETIME_EXTRACT_PART_OPTIONS, DATETIME_DATE_DIFF_UNIT_OPTIONS, DATETIME_DEFAULT_INPUT_FORMAT, DATETIME_DEFAULT_OUTPUT_FORMAT 추가. DATETIME_OPERATION_OPTIONS 주석 수정.
- TransformDetailRow.jsx: datetime 연산별 입력 UI 추가 — date_format(입력/출력 형식), extract(추출 부분), date_diff(비교 컬럼·단위), age(설명만), date_add(일/월/년).
- TargetTableSelectModal/index.jsx: getAssembledRules에서 datetime 연산별 rule_config 필드 채우기; 규칙 로드 시 datetimeConfig 전체 복원.
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 datetime 연산별 rule_config 동일하게 조립.

Changed files:
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- docs/log/log.md (신규)
