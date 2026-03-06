/**
 * TargetTableSelectModal/constants.js (테이블선택 모달 상수·순수 함수)
 * ================================================================================
 * 타입 패밀리·호환 여부·변환 옵션·on_error 옵션·소스 컬럼 정규화 등 상수 및 순수 함수.
 *
 * [Main Exports]
 * ===========
 * - DATETIME_TYPES, NEW_TABLE_VALUE
 * - TYPE_CAST_TARGET_OPTIONS, ON_ERROR_OPTIONS, TRANSFORM_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS
 * - typeFamily, isTypeCompatible, inferredTypeToPg
 * - getOnErrorValue, normalizeSourceCol, parsePkColumns
 * - buildEmptyTransformSettings, TRANSFORM_OPTION_LABELS (모달↔부모 변환 스냅샷)
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 JS)
 */

export const DATETIME_TYPES = ['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'];

/** 소스/타겟 타입을 하나의 "패밀리"로 정규화. 호환 여부는 같은 패밀리만 허용. */
export function typeFamily(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int', 'int4', 'int8', 'bigint', 'smallint', 'serial', 'bigserial'].some((x) => t === x || t.startsWith(x))) return 'integer';
  if (['float', 'double', 'double precision', 'real', 'numeric', 'decimal'].some((x) => t === x || t.startsWith(x))) return 'float';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'boolean';
  if (DATETIME_TYPES.some((x) => t === x)) return 'datetime';
  return 'text';
}

export function isTypeCompatible(sourceType, targetType) {
  return typeFamily(sourceType) === typeFamily(targetType);
}

/** 소스 추론 타입 → 적재 시 사용할 PG 타입명 */
export function inferredTypeToPg(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int'].some((x) => t === x || t.startsWith(x))) return 'BIGINT';
  if (t === 'float') return 'DOUBLE PRECISION';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'BOOLEAN';
  if (['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'].some((x) => t === x)) return 'TIMESTAMP';
  return 'TEXT';
}

export const NEW_TABLE_VALUE = '__new__';

/** 타입 변환 시 사용자가 선택할 대상 타입 (서브 드롭다운) */
export const TYPE_CAST_TARGET_OPTIONS = [
  { value: 'TEXT', label: '텍스트 (TEXT)' },
  { value: 'BIGINT', label: '정수 (BIGINT)' },
  { value: 'DOUBLE PRECISION', label: '실수 (DOUBLE PRECISION)' },
  { value: 'BOOLEAN', label: '참/거짓 (BOOLEAN)' },
  { value: 'TIMESTAMP', label: '날짜+시간 (TIMESTAMP)' },
  { value: 'DATE', label: '날짜 (DATE)' }
];

export const ON_ERROR_OPTIONS = [
  { value: 'null', label: 'NULL (빈값)' },
  { value: 'zero', label: '0 또는 빈 문자열' },
  { value: 'keep', label: '원래 값 유지' },
  { value: 'skip_row', label: '이 행 건너뛰기' },
  { value: 'fail', label: '적재 중단' }
];

export const TRANSFORM_OPTIONS = [
  { value: 'none', label: '변환 없음' },
  { value: 'cleansing', label: '공백·빈값 정리' },
  { value: 'type_cast', label: '타입 변환' },
  { value: 'cleansing_and_type_cast', label: '정리 후 타입 변환' },
  { value: 'code_map', label: '값 치환 (M→남성)' },
  { value: 'string', label: '문자열 가공' },
  { value: 'masking', label: '마스킹 (비가역)' }
];

export const STRING_OPERATION_OPTIONS = [
  { value: 'uppercase', label: '대문자로' },
  { value: 'lowercase', label: '소문자로' },
  { value: 'pad_left', label: '왼쪽 채우기 (예: 001)' },
  { value: 'pad_right', label: '오른쪽 채우기' },
  { value: 'substring', label: '일부 추출 (시작~길이)' },
  { value: 'replace', label: '문자열 바꾸기' },
  { value: 'regex_replace', label: '정규식 바꾸기' },
  { value: 'concat', label: '여러 컬럼 합치기' }
];

export const MASKING_OPERATION_OPTIONS = [
  { value: 'mask_right', label: '뒷자리 가리기 (****5678)' },
  { value: 'mask_left', label: '앞자리 가리기' },
  { value: 'mask_email', label: '이메일 가리기 (h***@...)' },
  { value: 'mask_phone', label: '전화번호 가리기 (010-****-5678)' },
  { value: 'mask_name', label: '이름 가리기 (홍*동)' }
];

export function getOnErrorValue(map, sourceKey) {
  if (!map || typeof map !== 'object') return 'null';
  const v = map[sourceKey];
  return (v != null ? String(v) : 'null').trim().replace(/\s/g, '') || 'null';
}

export function normalizeSourceCol(c) {
  const name = (c && (c.name ?? c.column_name)) ? String(c.name ?? c.column_name).trim() : '';
  const type = (c && (c.inferred_type ?? c.data_type)) ? String(c.inferred_type ?? c.data_type).trim() : 'text';
  return { name, type };
}

export function parsePkColumns(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * 모달 ↔ 부모 간 변환 설정 스냅샷. 모달 닫힐 때 조립, 모달 열릴 때 복원.
 * @returns {{ transformKind: {}, typeCastConfig: {}, stringConfig: {}, maskingConfig: {}, codeMapConfig: {}, mappingOnError: {} }}
 */
export function buildEmptyTransformSettings() {
  return {
    transformKind: {},
    typeCastConfig: {},
    stringConfig: {},
    maskingConfig: {},
    codeMapConfig: {},
    mappingOnError: {}
  };
}

/** 변환 종류 value → 요약 표시용 라벨 (부모 요약 UI) */
export const TRANSFORM_OPTION_LABELS = {
  none: '변환 없음',
  cleansing: '공백·빈값 정리',
  type_cast: '타입 변환',
  cleansing_and_type_cast: '정리 후 타입 변환',
  code_map: '값 치환',
  string: '문자열 가공',
  masking: '마스킹'
};
