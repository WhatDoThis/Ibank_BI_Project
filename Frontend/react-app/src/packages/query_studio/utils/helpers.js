/**
 * query_studio/utils/helpers.js (쿼리 스튜디오 헬퍼)
 * ==============================================
 * 날짜 컬럼 판별·SQL 이스케이프·WHERE 값 포맷.
 *
 * [Main Functions]
 * ===========
 * 1. isDateColumn, isDateType, isDateTimeType: MainArea에서 사용 (날짜/시간 컬럼·타입 여부)
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
