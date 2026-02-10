/**
 * report/utils/helpers.js (리포트 쿼리 빌더 헬퍼)
 * ==============================================
 * 날짜 컬럼 판별, SQL 이스케이프, WHERE 값 포맷. ReportPage·MainArea 등에서 사용.
 *
 * [주요 함수]
 * - isDateColumn, isDateType, isDateTimeType: 날짜/시간 컬럼 여부
 * - escapeSqlString, escapeLikePattern: SQL injection 방지
 * - formatWhereValue: 연산자별 WHERE 값 문자열
 *
 * [의존성]
 * - 없음
 */

/**
 * 날짜/시간 컬럼인지 확인 (컬럼명 + 타입)
 * @param {string} column - 컬럼명
 * @param {string} type - 컬럼 타입
 */
export function isDateColumn(column, type) {
  const colName = (column || '').toLowerCase()
  const colType = (type || '').toLowerCase()
  return (
    colName.startsWith('dt') ||
    colName.endsWith('dt') ||
    colName.includes('date') ||
    colType.includes('date') ||
    colType.includes('timestamp') ||
    colType.includes('datetime')
  )
}

export function isDateType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2'
}

export function isDateTimeType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('timestamp') || t === 'datetime' || t === 'datetime2' || t === 'datetimeoffset'
}

export function escapeSqlString(val) {
  return String(val).replace(/'/g, "''")
}

export function escapeLikePattern(val) {
  return String(val).replace(/[%_\\]/g, '\\$&')
}

export function isNumericValue(val) {
  const t = String(val).trim()
  return t !== '' && !isNaN(Number(t))
}

/**
 * WHERE 절 값 포맷 (연산자별)
 * @param {string} operator - =, !=, >, <, LIKE 등
 * @param {string} value - 사용자 입력값
 */
export function formatWhereValue(operator, value) {
  if (operator === 'LIKE') return `'%${escapeLikePattern(escapeSqlString(value))}%'`
  if (isNumericValue(value)) return String(Number(value))
  return `'${escapeSqlString(value)}'`
}
