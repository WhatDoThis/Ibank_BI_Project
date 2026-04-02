/**
 * TargetTableSelectModal/constants.js (테이블선택 모달 상수·순수 함수)
 * ================================================================================
 * 타입 패밀리·호환 여부·변환 옵션·on_error 옵션·소스 컬럼 정규화 등 상수 및 순수 함수.
 *
 * [Main Exports]
 * ===========
 * 1. DATETIME_TYPES, NEW_TABLE_VALUE, ETL_TABLE_LABEL_MAX_LEN, ETL_TABLE_DSCRTN_MAX_LEN (etl_tables 길이 제한)
 * 2. TYPE_CAST_TARGET_OPTIONS, ON_ERROR_OPTIONS, TRANSFORM_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, DATETIME_EXTRACT_PART_OPTIONS, DATETIME_DATE_DIFF_UNIT_OPTIONS
 * 3. typeFamily, isTypeCompatible, inferredTypeToPg
 * 4. getOnErrorValue, normalizeSourceCol, parsePkColumns
 * 5. buildEmptyTransformSettings, TRANSFORM_OPTION_LABELS (모달↔부모 변환 스냅샷)
 * 6. getTransformTypeGuidance — 소스·변환 종류·타겟 타입 기준 비차단 안내 문구 배열
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 JS)
 */

export const DATETIME_TYPES = ['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'];

/** etl_tables.table_label — 운영 DDL varchar(30), UNIQUE */
export const ETL_TABLE_LABEL_MAX_LEN = 30;
/** etl_tables.table_dscrtn — 운영 DDL varchar(100) */
export const ETL_TABLE_DSCRTN_MAX_LEN = 100;

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

/** 소스 패밀리 한글 (안내 문구용) */
const _SRC_FAMILY_KO = {
  integer: '정수',
  float: '실수',
  boolean: '참/거짓',
  datetime: '날짜·시간',
  text: '문자열'
};

/**
 * 변환 상세 영역에 표시할 비차단 안내 문구 목록 (중복 제거).
 * @param {{ sourceType?: string, kind?: string, typeCastTarget?: string, targetPgType?: string|null, stringOperation?: string }} params
 * @returns {string[]}
 */
export function getTransformTypeGuidance(params = {}) {
  const sourceType = params.sourceType || '';
  const kind = params.kind || 'none';
  const typeCastTarget = (params.typeCastTarget || '').toString().trim();
  const targetPgType =
    params.targetPgType != null && String(params.targetPgType).trim() !== ''
      ? String(params.targetPgType).trim()
      : null;
  const stringOperation = (params.stringOperation || '').toString().trim();

  const srcFam = typeFamily(sourceType);
  const srcKo = _SRC_FAMILY_KO[srcFam] || '문자열';
  const tgtFam = targetPgType ? typeFamily(targetPgType) : null;
  const notes = [];

  const push = (s) => {
    if (s && !notes.includes(s)) notes.push(s);
  };

  if (kind === 'cleansing') {
    push('앞뒤 공백을 제거하고 빈 문자열을 NULL로 만듭니다. 이후 타겟 타입으로 캐스팅될 때는 매핑의「변환 실패 시」옵션을 함께 확인하세요.');
    return notes;
  }

  if (kind === 'masking') {
    push(`${srcKo} 소스 값은 내부적으로 문자열로 바뀐 뒤 마스킹됩니다.`);
    if (srcFam === 'integer' || srcFam === 'float') {
      push('결과는 항상 문자열입니다. 타겟 컬럼이 BIGINT·실수 등 숫자형이면 적재 시 NULL이 되기 쉽습니다. 값을 보관하려면 타겟 타입을 TEXT로 두거나「변환 실패 시 → 원본 유지」를 검토하세요.');
    }
    if (srcFam === 'boolean') {
      push('true/false가 텍스트로 바뀐 뒤 마스킹됩니다.');
    }
    if (srcFam === 'datetime') {
      push('날짜·시간이 문자열로 변환된 뒤 마스킹되므로, 결과는 텍스트 형태입니다.');
    }
    if (tgtFam === 'integer' || tgtFam === 'float') {
      push(
        `선택한 타겟 컬럼은 숫자 계열(${targetPgType})로 보입니다. 마스킹 문자열과 맞지 않을 수 있어 TEXT 컬럼을 권장합니다.`
      );
    }
    return notes;
  }

  if (kind === 'string') {
    push(`${srcKo} 값은 문자열로 바꾼 뒤 선택한 방식으로 가공됩니다.`);
    if (srcFam === 'integer' || srcFam === 'float') {
      push('타겟이 숫자형이면 가공 후 캐스트 결과를 미리보기로 확인하세요.');
    }
    if (srcFam === 'boolean') {
      push('참/거짓이 "True"/"False" 등 문자열로 바뀐 뒤 가공됩니다.');
    }
    if (srcFam === 'datetime') {
      push('날짜·시간이 ISO 형태 등 문자열로 바뀐 뒤 대소문자·치환 등이 적용됩니다.');
    }
    if (stringOperation === 'concat') {
      push('여러 컬럼을 합친 결과는 문자열입니다. 타겟 타입을 TEXT로 두는 것이 안전합니다.');
    }
    if (stringOperation === 'regex_replace' || stringOperation === 'replace') {
      push('치환 결과가 숫자·날짜 형식을 깨뜨리면 이후 캐스트가 실패할 수 있습니다.');
    }
    if (stringOperation === 'substring') {
      push('부분 추출 후 길이가 짧아지면 타겟 타입(특히 고정 길이 숫자)과 기대가 다를 수 있습니다.');
    }
    return notes;
  }

  if (kind === 'type_cast' || kind === 'cleansing_and_type_cast') {
    const sel = typeCastTarget || inferredTypeToPg(sourceType);
    const fromPg = inferredTypeToPg(sourceType);
    if (kind === 'cleansing_and_type_cast') {
      push('먼저 공백 정리·빈값 NULL 처리 후, 아래에서 선택한 타입으로 캐스팅합니다.');
    }
    push(`저장 시 값은 소스(${fromPg}에 가깝게 해석)에서 ${sel}(으)로 맞춥니다.`);
    if (srcFam === 'text' && typeFamily(sel) === 'integer') {
      push('문자열→정수는 숫자만 있는 값에서만 안전합니다.');
    }
    if (srcFam === 'text' && typeFamily(sel) === 'float') {
      push('문자열→실수는 소수점·지수 표기가 데이터와 일치해야 합니다.');
    }
    if (srcFam === 'text' && typeFamily(sel) === 'datetime') {
      push('문자열→날짜·시간은 형식이 맞지 않으면 NULL이 될 수 있습니다.');
    }
    if (srcFam === 'text' && typeFamily(sel) === 'boolean') {
      push('문자열→참/거짓은 허용 토큰(Y/N, true/false 등)이 데이터와 맞아야 합니다.');
    }
    if ((srcFam === 'integer' || srcFam === 'float') && typeFamily(sel) === 'boolean') {
      push('숫자→참/거짓 변환은 백엔드 규칙에 따라 처리됩니다. 0/1 외 값은 실패할 수 있습니다.');
    }
    if (srcFam === 'datetime' && typeFamily(sel) === 'integer') {
      push('날짜·시간에서 정수 추출(타임스탬프 에폭 등)이 아닌 경우 결과가 예상과 다를 수 있습니다.');
    }
    return notes;
  }

  if (kind === 'datetime') {
    if (srcFam === 'text') {
      push('문자열을 날짜로 해석합니다. 연산별 입력 형식과 실제 데이터 형식이 일치하는지 확인하세요.');
    }
    if (srcFam === 'integer' || srcFam === 'float') {
      push('숫자 컬럼에 날짜 연산을 적용하면 결과가 기대와 다르거나 NULL이 될 수 있습니다.');
    }
    if (srcFam === 'boolean') {
      push('참/거짓 값에는 날짜·시간 연산이 어울리지 않습니다.');
    }
    if (srcFam === 'datetime') {
      push('시간대 변환·차이 연산은 원본·대상 타임존 설정의 영향을 받습니다.');
    }
    return notes;
  }

  if (kind === 'code_map') {
    push('매핑표에 없는 값은 규칙에 따라 유지되거나 기본값으로 처리될 수 있습니다. 적용 전 샘플 미리보기로 검증하세요.');
    if (srcFam !== 'text') {
      push(`${srcKo} 값은 비교 시 문자열로 맞출 수 있으니, 매핑 키(원본 값) 표기와 DB에 보이는 표기를 일치시키세요.`);
    }
    return notes;
  }

  return notes;
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
