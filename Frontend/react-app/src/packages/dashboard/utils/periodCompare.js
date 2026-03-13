/**
 * dashboard/utils/periodCompare.js (일/주/월/연 비교 기간 계산)
 * =============================================================
 * 일간(단일일)·주간(월~일)·월간·연간 [시작일, 종료일] 계산. ISO 주(월요일=주 시작)·달력 월·연도 1/1~12/31.
 *
 * [Main Functions]
 * ===========
 * 1. toDateString: YYYY-MM-DD 문자열 (로컬)
 * 2. getMondayOfWeek: 해당 주 월요일 Date
 * 3. getWeekRange: 해당 주 [start, end]
 * 4. getPreviousWeekRange: 이전 주 [start, end]
 * 5. getMonthRange: 해당 월 1일~말일
 * 6. getPreviousMonthRange: 이전 월
 * 7. getPreviousDay: 전일 [date, date]
 * 8. getYearRange: 해당 연도 1/1~12/31
 * 9. getPreviousYearRange: 전년
 *
 * [Dependencies]
 * =========
 * - 없음 (표준 Date)
 */

// 1.
/** YYYY-MM-DD 문자열로 포맷 (로컬 날짜) */
function toDateString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 2.
function getMondayOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// 3.
export function getWeekRange(anchorDate) {
  const d = typeof anchorDate === 'string' ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
  if (Number.isNaN(d.getTime())) return ['', '']
  const mon = getMondayOfWeek(d)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return [toDateString(mon), toDateString(sun)]
}

// 4.
export function getPreviousWeekRange(anchorDate) {
  const d = typeof anchorDate === 'string' ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
  if (Number.isNaN(d.getTime())) return ['', '']
  const mon = getMondayOfWeek(d)
  const prevMon = new Date(mon)
  prevMon.setDate(prevMon.getDate() - 7)
  const prevSun = new Date(prevMon)
  prevSun.setDate(prevSun.getDate() + 6)
  return [toDateString(prevMon), toDateString(prevSun)]
}

// 5.
export function getMonthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ['', '']
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  return [toDateString(first), toDateString(last)]
}

// 6.
export function getPreviousMonthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ['', '']
  if (m === 1) return getMonthRange(y - 1, 12)
  return getMonthRange(y, m - 1)
}

// 7.
export function getPreviousDay(anchorDate) {
  const d = typeof anchorDate === 'string' ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
  if (Number.isNaN(d.getTime())) return ['', '']
  const prev = new Date(d)
  prev.setDate(prev.getDate() - 1)
  const s = toDateString(prev)
  return [s, s]
}

// 8.
export function getYearRange(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return ['', '']
  const first = new Date(y, 0, 1)
  const last = new Date(y, 11, 31)
  return [toDateString(first), toDateString(last)]
}

// 9.
export function getPreviousYearRange(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return ['', '']
  return getYearRange(y - 1)
}
