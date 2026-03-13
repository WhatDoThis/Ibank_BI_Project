/**
 * report/utils/helpers.js (리포트 쿼리 빌더 헬퍼)
 * ==============================================
 * 날짜 컬럼 판별·SQL 이스케이프·WHERE 값 포맷.
 *
 * [Main Functions]
 * ===========
 * 1. isDateColumn, isDateType, isDateTimeType: MainArea에서 사용 (날짜/시간 컬럼·타입 여부)
 * 2. escapeSqlString, escapeLikePattern, isNumericValue, formatWhereValue (미사용 — sqlBuilder.js가 자체 이스케이프 사용)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1. 날짜/시간 컬럼인지 확인 (컬럼명 + 타입)
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

// 2.
export function isDateType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2'
}

// 3.
export function isDateTimeType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('timestamp') || t === 'datetime' || t === 'datetime2' || t === 'datetimeoffset'
}

// 4. [미사용] 현재 리포트에서 호출 없음. sqlBuilder가 자체 이스케이프 사용.
export function escapeSqlString(val) {
  return String(val).replace(/'/g, "''")
}

// 5. [미사용]
export function escapeLikePattern(val) {
  return String(val).replace(/[%_\\]/g, '\\$&')
}

// 6. [미사용]
export function isNumericValue(val) {
  const t = String(val).trim()
  return t !== '' && !isNaN(Number(t))
}

// 7. [미사용] WHERE 절 값 포맷 (연산자별). 현재 리포트에서 호출 없음.
export function formatWhereValue(operator, value) {
  if (operator === 'LIKE') return `'%${escapeLikePattern(escapeSqlString(value))}%'`
  if (isNumericValue(value)) return String(Number(value))
  return `'${escapeSqlString(value)}'`
}
