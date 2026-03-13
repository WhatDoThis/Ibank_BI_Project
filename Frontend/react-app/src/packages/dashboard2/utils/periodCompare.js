/**
 * dashboard2/utils/periodCompare.js (일/주/월/연 비교 기간 계산)
 * =============================================================
 * 일간(단일일)·주간(월~일)·월간·연간 [시작일, 종료일] 계산. ISO 주(월요일=주 시작)·달력 월·연도 1/1~12/31.
 *
 * [Main Functions]
 * ===========
 * 1. getPreviousDay(anchorDate): 전일 [date, date] (YYYY-MM-DD)
 * 2. getWeekRange(anchorDate): 해당 주 월요일~일요일 [start, end]
 * 3. getPreviousWeekRange(anchorDate): 이전 주 [start, end]
 * 4. getMonthRange(year, month): 해당 월 1일~말일 [start, end]
 * 5. getPreviousMonthRange(year, month): 이전 월 [start, end]
 * 6. getYearRange(year): 해당 연도 1/1~12/31 [start, end]
 * 7. getPreviousYearRange(year): 전년 [start, end]
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
/**
 * 주어진 날짜가 속한 주의 월요일 00:00 (Date). ISO 8601 (월=1, 일=7).
 * @param {Date} d
 * @returns {Date} 해당 주 월요일
 */
function getMondayOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay() // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day // 월요일로 보정
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// 3.
/**
 * 해당 주(월요일~일요일)의 [시작일, 종료일]을 YYYY-MM-DD 배열로 반환.
 * @param {string|Date} anchorDate - 해당 주에 속한 아무 날짜 (YYYY-MM-DD 또는 Date)
 * @returns {[string, string]} [월요일, 일요일]
 */
export function getWeekRange(anchorDate) {
  const d = typeof anchorDate === 'string' ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
  if (Number.isNaN(d.getTime())) return ['', '']
  const mon = getMondayOfWeek(d)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return [toDateString(mon), toDateString(sun)]
}

// 4.
/**
 * anchorDate가 속한 주의 바로 이전 주 [시작일, 종료일].
 * @param {string|Date} anchorDate
 * @returns {[string, string]} [이전 주 월요일, 이전 주 일요일]
 */
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
/**
 * 해당 월 1일~말일 [시작일, 종료일].
 * @param {number} year - 연도
 * @param {number} month - 월 (1~12)
 * @returns {[string, string]} [YYYY-MM-01, YYYY-MM-DD(말일)]
 */
export function getMonthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ['', '']
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0) // 다음 달 0일 = 이번 달 말일
  return [toDateString(first), toDateString(last)]
}

// 6.
/**
 * 해당 월의 이전 월 [시작일, 종료일].
 * @param {number} year - 연도
 * @param {number} month - 월 (1~12)
 * @returns {[string, string]}
 */
export function getPreviousMonthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ['', '']
  if (m === 1) return getMonthRange(y - 1, 12)
  return getMonthRange(y, m - 1)
}

// 7.
/**
 * anchorDate의 전일 [날짜, 날짜] (단일일).
 * @param {string|Date} anchorDate - YYYY-MM-DD 또는 Date
 * @returns {[string, string]} [전일, 전일]
 */
export function getPreviousDay(anchorDate) {
  const d = typeof anchorDate === 'string' ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
  if (Number.isNaN(d.getTime())) return ['', '']
  const prev = new Date(d)
  prev.setDate(prev.getDate() - 1)
  const s = toDateString(prev)
  return [s, s]
}

// 8.
/**
 * 해당 연도 1월 1일~12월 31일 [시작일, 종료일].
 * @param {number} year - 연도 (예: 2026)
 * @returns {[string, string]} [YYYY-01-01, YYYY-12-31]
 */
export function getYearRange(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return ['', '']
  const first = new Date(y, 0, 1)
  const last = new Date(y, 11, 31)
  return [toDateString(first), toDateString(last)]
}

// 9.
/**
 * 해당 연도의 전년 [시작일, 종료일].
 * @param {number} year - 연도
 * @returns {[string, string]}
 */
export function getPreviousYearRange(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return ['', '']
  return getYearRange(y - 1)
}
