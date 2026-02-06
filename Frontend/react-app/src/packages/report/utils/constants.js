/**
 * report/utils/constants.js (리포트 쿼리 빌더 상수)
 * =================================================
 * 연산자 한국어 매핑, 집계 함수 목록.
 *
 * [내용]
 * - OPERATOR_LABELS: WHERE/HAVING 연산자 → 한글 라벨
 * - AGG_FUNCTIONS: 집계 함수 value/label
 */

/** WHERE/HAVING 연산자 → 한글 라벨 */
export const OPERATOR_LABELS = {
  '=': '정확히 같은',
  '!=': '같지 않은',
  '>': '보다 큰',
  '<': '보다 작은',
  '>=': '이상인',
  '<=': '이하인',
  LIKE: '포함하는',
  IN: '목록 중 하나',
  BETWEEN: '범위',
  'IS NULL': '비어 있음',
  'IS NOT NULL': '비어 있지 않음'
}

/** 집계 함수 목록 (value, label) */
export const AGG_FUNCTIONS = [
  { value: 'COUNT', label: '건수' },
  { value: 'SUM', label: '합계' },
  { value: 'AVG', label: '평균' },
  { value: 'MIN', label: '최소값' },
  { value: 'MAX', label: '최대값' }
]
