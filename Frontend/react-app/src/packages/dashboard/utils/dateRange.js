/**
 * dashboard/utils/dateRange.js (대시보드1·2 기간 유틸)
 * =====================================================
 * 대시보드 패키지 전용. dashboard2는 동일 유틸을 import하여 사용.
 *
 * [Main Functions]
 * ===========
 * - normalizeDateRange, formatDateRangeLabel
 *
 * [Dependencies]
 * =========
 * - 없음
 */

export function normalizeDateRange(range) {
  if (!Array.isArray(range) || range.length < 2) return range
  const a = String(range[0] ?? '').trim()
  const b = String(range[1] ?? '').trim()
  if (!a || !b) return range
  return a > b ? [b, a] : [a, b]
}

function toDisplayDate(str) {
  if (!str || typeof str !== 'string') return ''
  const s = str.trim()
  if (s.length >= 10) return `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)}`
  if (s.length >= 7) return `${s.slice(0, 4)}.${s.slice(5, 7)}`
  return s
}

export function formatDateRangeLabel(dateRange) {
  if (!Array.isArray(dateRange) || dateRange.length < 2) {
    return { label: '기간 미선택', isSingleDay: false }
  }
  const start = String(dateRange[0] ?? '').trim()
  const end = String(dateRange[1] ?? '').trim()
  if (!start || !end) return { label: '기간 미선택', isSingleDay: false }
  const startD = toDisplayDate(start)
  const endD = toDisplayDate(end)
  if (start === end) {
    return { label: startD, isSingleDay: true }
  }
  return { label: `${startD} ~ ${endD}`, isSingleDay: false }
}
