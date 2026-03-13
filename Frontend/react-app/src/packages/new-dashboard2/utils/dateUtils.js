/**
 * dateUtils.js (날짜/주차 변환 유틸)
 * ===================================
 * New Dashboard 2 전용. 주차: 월요일 시작, 목요일 포함 기준(ISO 8601·마케팅 관례).
 * Dash2Header의 week label, input type="week"/"month" 용.
 *
 * [Main Functions]
 * 1. getISOWeekNumber: ISO 연간 주차(1~53)
 * 2. getMonthWeekLabel: YYYY-MM-DD → "M월 N주차"
 * 3. formatDateRangeLabel: dateRangeActual, period → 기간 라벨
 * 4. toLocalDateString: Date → YYYY-MM-DD (UTC 비틀림 방지)
 * 5. dateToWeekValue, weekValueToDate: input type="week" 용
 *
 * [Dependencies]
 * - 없음 (new-dashboard 패키지 import 금지)
 */

// 1.
export function getISOWeekNumber(dateStr) {
  if (!dateStr || dateStr.length < 10) return 0
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// 2.
export function getMonthWeekLabel(dateStr) {
  if (!dateStr || dateStr.length < 10) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = new Date(y, m, 1)
  const dowFirst = first.getDay()
  const firstMondayOffset = (8 - (dowFirst === 0 ? 7 : dowFirst)) % 7
  const firstMondayDate = 1 + firstMondayOffset

  const dayOfMonth = d.getDate()
  const dow = d.getDay()
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const thisMondayDate = dayOfMonth - mondayOffset

  let weekNum = 1 + Math.floor((thisMondayDate - firstMondayDate) / 7)
  if (thisMondayDate < firstMondayDate) weekNum = 1
  if (weekNum < 1) weekNum = 1
  return `${m + 1}월 ${weekNum}주차`
}

// 3.
export function formatDateRangeLabel(dateRangeActual, period) {
  if (!dateRangeActual || !Array.isArray(dateRangeActual) || dateRangeActual.length < 2) return null
  const [start, end] = dateRangeActual
  if (!start || !end) return null
  const s = String(start).slice(0, 10)
  const e = String(end).slice(0, 10)
  const startFormatted = `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)}`
  const endFormatted = `${e.slice(5, 7)}.${e.slice(8, 10)}`
  let label = `${startFormatted} ~ ${endFormatted}`
  if (period === 'weekly') {
    const weekLabel = getMonthWeekLabel(s)
    if (weekLabel) label += ` (${weekLabel})`
  }
  if (period === 'monthly') {
    label += ` (${s.slice(0, 4)}년 ${parseInt(s.slice(5, 7), 10)}월)`
  }
  return label
}

// 4.
export function toLocalDateString(d) {
  if (!d || !(d instanceof Date)) return ''
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

// 5.
export function dateToWeekValue(dateStr) {
  if (!dateStr || dateStr.length < 10) return ''
  const w = getISOWeekNumber(dateStr)
  const y = new Date(dateStr + 'T00:00:00').getFullYear()
  return `${y}-W${String(w).padStart(2, '0')}`
}

// 6.
export function weekValueToDate(weekStr) {
  if (!weekStr || !/^\d{4}-W\d{2}$/.test(weekStr)) return null
  const [y, w] = weekStr.split('-W').map(Number)
  const jan4 = new Date(y, 0, 4)
  const mon = jan4.getDate() - (jan4.getDay() || 7) + 1
  const start = new Date(y, 0, mon + (w - 1) * 7)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
}
