/**
 * TargetTableSelectModal/constants.js (테이블선택 모달 상수·순수 함수)
 * ================================================================================
 * 타입 패밀리·호환 여부·변환 옵션·on_error 옵션·소스 컬럼 정규화 등 상수 및 순수 함수.
 *
 * [Main Exports]
 * ===========
 * 1. DATETIME_TYPES, NEW_TABLE_VALUE
 * 2. TYPE_CAST_TARGET_OPTIONS, ON_ERROR_OPTIONS, TRANSFORM_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, DATETIME_EXTRACT_PART_OPTIONS, DATETIME_DATE_DIFF_UNIT_OPTIONS
 * 3. typeFamily, isTypeCompatible, inferredTypeToPg
 * 4. getOnErrorValue, normalizeSourceCol, parsePkColumns
 * 5. buildEmptyTransformSettings, TRANSFORM_OPTION_LABELS (모달↔부모 변환 스냅샷)
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 JS)
 */

export const DATETIME_TYPES = ['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'];

// 1.
/** 소스/타겟 타입을 하나의 "패밀리"로 정규화. 호환 여부는 같은 패밀리만 허용. */
export function typeFamily(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int', 'int4', 'int8', 'bigint', 'smallint', 'serial', 'bigserial'].some((x) => t === x || t.startsWith(x))) return 'integer';
  if (['float', 'double', 'double precision', 'real', 'numeric', 'decimal'].some((x) => t === x || t.startsWith(x))) return 'float';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'boolean';
  if (DATETIME_TYPES.some((x) => t === x)) return 'datetime';
  return 'text';
}

// 2.
export function isTypeCompatible(sourceType, targetType) {
  return typeFamily(sourceType) === typeFamily(targetType);
}

// 3.
/** 소스 추론 타입 → 적재 시 사용할 PG 타입명. Oracle NUMBER/INTEGER 등 원본 타입·백엔드 _pg_type_from_* 반환값 모두 호환. */
export function inferredTypeToPg(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int', 'bigint', 'smallint', 'serial', 'bigserial'].some((x) => t === x || t.startsWith(x))) return 'BIGINT';
  /* Oracle NUMBER, MySQL decimal/float 등 → DOUBLE PRECISION. number는 Oracle 원본 타입명. */
  if (['float', 'double precision', 'double', 'numeric', 'decimal', 'real', 'number'].some((x) => t === x || t.startsWith(x))) return 'DOUBLE PRECISION';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'BOOLEAN';
  if (['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'].some((x) => t === x)) return 'TIMESTAMP';
  return 'TEXT';
}

export const NEW_TABLE_VALUE = '__new__';

/** 타입 변환 시 사용자가 선택할 대상 타입 (서브 드롭다운). hint는 툴팁용. */
export const TYPE_CAST_TARGET_OPTIONS = [
  { value: 'TEXT', label: '텍스트', hint: 'TEXT — 문자열로 변환' },
  { value: 'BIGINT', label: '정수', hint: 'BIGINT — 소수점 없는 숫자' },
  { value: 'DOUBLE PRECISION', label: '실수', hint: 'DOUBLE PRECISION — 소수점 포함 숫자' },
  { value: 'BOOLEAN', label: '참/거짓', hint: 'BOOLEAN — true / false' },
  { value: 'TIMESTAMP', label: '날짜시간', hint: 'TIMESTAMP — 2024-01-15 09:30:00' },
  { value: 'DATE', label: '날짜', hint: 'DATE — 2024-01-15' }
];

export const ON_ERROR_OPTIONS = [
  { value: 'null', label: 'NULL 처리', hint: '변환 실패 시 빈값(NULL)으로 저장' },
  { value: 'zero', label: '기본값', hint: '숫자→0, 문자열→빈 문자열' },
  { value: 'keep', label: '원본 유지', hint: '변환하지 않고 원래 값 그대로 저장' },
  { value: 'skip_row', label: '행 제외', hint: '해당 행 전체를 적재하지 않음' },
  { value: 'fail', label: '중단', hint: '변환 실패 즉시 전체 적재 중단' }
];

export const TRANSFORM_OPTIONS = [
  { value: 'none', label: '없음', hint: '변환 없이 원본 그대로 적재' },
  { value: 'cleansing', label: '정리', hint: '앞뒤 공백 제거, 빈값→NULL' },
  { value: 'type_cast', label: '타입 변환', hint: '다른 데이터 타입으로 캐스팅' },
  { value: 'cleansing_and_type_cast', label: '정리+변환', hint: '공백 정리 후 타입 변환' },
  { value: 'code_map', label: '값 매핑', hint: '특정 값을 다른 값으로 치환 (M→남성)' },
  { value: 'string', label: '문자열', hint: '대소문자, 추출, 치환 등 문자열 가공' },
  { value: 'datetime', label: '날짜/시간', hint: '날짜 포맷·추출·시간대 변환 등' },
  { value: 'masking', label: '마스킹', hint: '개인정보 비식별화 (비가역)' }
];

/** datetime 카테고리 내 operation. UI에서 모두 설정 가능. */
export const DATETIME_OPERATION_OPTIONS = [
  { value: 'date_format', label: '날짜 포맷' },
  { value: 'extract', label: '부분 추출' },
  { value: 'date_diff', label: '날짜 차이' },
  { value: 'age', label: '나이 계산' },
  { value: 'date_add', label: '날짜 더하기' },
  { value: 'date_subtract', label: '날짜 빼기' },
  { value: 'timezone_convert', label: '시간대 변환' }
];

/** 날짜 포맷 연산: 입력/출력 형식(strftime 스타일). 백엔드 기본값과 동일. */
export const DATETIME_DEFAULT_INPUT_FORMAT = '%Y-%m-%d';
export const DATETIME_DEFAULT_OUTPUT_FORMAT = '%Y/%m/%d';

/** 부분 추출 연산: 추출할 부분. transform_engine part 값과 일치. */
export const DATETIME_EXTRACT_PART_OPTIONS = [
  { value: 'year', label: '연도' },
  { value: 'month', label: '월' },
  { value: 'day', label: '일' },
  { value: 'hour', label: '시' },
  { value: 'quarter', label: '분기' },
  { value: 'weekday', label: '요일(0=월)' }
];

/** 날짜 차이 연산: 단위. transform_engine unit 값과 일치. */
export const DATETIME_DATE_DIFF_UNIT_OPTIONS = [
  { value: 'days', label: '일 수' },
  { value: 'years', label: '년 수' }
];

export const STRING_OPERATION_OPTIONS = [
  { value: 'uppercase', label: '대문자', hint: 'hello → HELLO' },
  { value: 'lowercase', label: '소문자', hint: 'HELLO → hello' },
  { value: 'pad_left', label: '좌측 채움', hint: '42 → 0042 (지정 길이만큼)' },
  { value: 'pad_right', label: '우측 채움', hint: '42 → 4200' },
  { value: 'substring', label: '부분 추출', hint: '시작 위치부터 N자 추출' },
  { value: 'replace', label: '치환', hint: '특정 문자열을 다른 문자열로 교체' },
  { value: 'regex_replace', label: '정규식 치환', hint: '정규표현식 패턴으로 교체' },
  { value: 'concat', label: '컬럼 결합', hint: '여러 컬럼을 구분자로 합침' }
];

export const MASKING_OPERATION_OPTIONS = [
  { value: 'mask_right', label: '뒷자리', hint: '1234-5678 → 1234-****' },
  { value: 'mask_left', label: '앞자리', hint: '1234-5678 → ****-5678' },
  { value: 'mask_email', label: '이메일', hint: 'hong@mail.com → *@mail.com' },
  { value: 'mask_phone', label: '전화번호', hint: '010-1234-5678 → 010-****-5678' },
  { value: 'mask_name', label: '이름', hint: '홍길동 → 홍*동' }
];

// 4.
export function getOnErrorValue(map, sourceKey) {
  if (!map || typeof map !== 'object') return 'null';
  const v = map[sourceKey];
  return (v != null ? String(v) : 'null').trim().replace(/\s/g, '') || 'null';
}

// 5.
export function normalizeSourceCol(c) {
  const name = (c && (c.name ?? c.column_name)) ? String(c.name ?? c.column_name).trim() : '';
  const type = (c && (c.inferred_type ?? c.data_type)) ? String(c.inferred_type ?? c.data_type).trim() : 'text';
  return { name, type };
}

// 6.
export function parsePkColumns(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * 모달 ↔ 부모 간 변환 설정 스냅샷. 모달 닫힐 때 조립, 모달 열릴 때 복원.
 * @returns {{ transformKind: {}, typeCastConfig: {}, stringConfig: {}, maskingConfig: {}, codeMapConfig: {}, mappingOnError: {} }}
 */
// 7.
export function buildEmptyTransformSettings() {
  return {
    transformKind: {},
    typeCastConfig: {},
    stringConfig: {},
    maskingConfig: {},
    codeMapConfig: {},
    datetimeConfig: {},
    mappingOnError: {}
  };
}

/** 변환 종류 value → 요약 표시용 라벨 (부모 요약 UI) */
export const TRANSFORM_OPTION_LABELS = {
  none: '없음',
  cleansing: '정리',
  type_cast: '타입 변환',
  cleansing_and_type_cast: '정리+변환',
  datetime: '날짜/시간',
  code_map: '값 매핑',
  string: '문자열',
  masking: '마스킹'
};
