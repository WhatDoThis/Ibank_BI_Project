/**
 * TargetTableSelectModal/constants.js (테이블선택 모달 상수·순수 함수)
 * ================================================================================
 * 타입 패밀리·호환 여부·변환 옵션·on_error 옵션·소스 컬럼 정규화 등 상수 및 순수 함수.
 *
 * [Main Exports]
 * ===========
 * - DATETIME_TYPES, NEW_TABLE_VALUE
 * - ON_ERROR_OPTIONS, TRANSFORM_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS
 * - typeFamily, isTypeCompatible, inferredTypeToPg
 * - getOnErrorValue, normalizeSourceCol, parsePkColumns
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

export const ON_ERROR_OPTIONS = [
  { value: 'null', label: 'NULL' },
  { value: 'zero', label: '0/빈값' },
  { value: 'keep', label: '원본 유지' },
  { value: 'skip_row', label: '행 제외' },
  { value: 'fail', label: '실패' }
];

export const TRANSFORM_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'cleansing', label: '정리' },
  { value: 'type_cast', label: '타입 변환' },
  { value: 'cleansing_and_type_cast', label: '정리 + 타입 변환' },
  { value: 'code_map', label: '값 매핑' },
  { value: 'string', label: '문자열 변환' },
  { value: 'masking', label: '마스킹' }
];

export const STRING_OPERATION_OPTIONS = [
  { value: 'uppercase', label: '대문자 변환' },
  { value: 'lowercase', label: '소문자 변환' },
  { value: 'pad_left', label: '왼쪽 패딩' },
  { value: 'pad_right', label: '오른쪽 패딩' },
  { value: 'substring', label: '부분 문자열' },
  { value: 'replace', label: '문자열 치환' },
  { value: 'regex_replace', label: '정규식 치환' },
  { value: 'concat', label: '컬럼 합치기' }
];

export const MASKING_OPERATION_OPTIONS = [
  { value: 'mask_right', label: '뒷자리 마스킹' },
  { value: 'mask_left', label: '앞자리 마스킹' },
  { value: 'mask_email', label: '이메일 마스킹' },
  { value: 'mask_phone', label: '전화번호 마스킹' },
  { value: 'mask_name', label: '이름 마스킹' }
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
