/**
 * dateUtils (날짜/주차 변환 유틸)
 * ===============================
 * SummaryHeader, TrendLineChart 등에서 공통 사용. 주차: 월요일 시작, 목요일 포함(ISO 8601). 표시 "M월 N주차".
 *
 * [Main Functions]
 * 1. getISOWeekNumber: ISO 연간 주차(1~53)
 * 2. getMonthWeekLabel: YYYY-MM-DD → "M월 N주차"
 * 3. toLocalDateString: Date → YYYY-MM-DD (UTC 비틀림 방지)
 * 4. dateToWeekValue: 날짜 → input type="week" 값
 * 5. weekValueToDate: YYYY-Www → 해당 주 월요일 YYYY-MM-DD
 * 6. weeklySnapshotTargetDate: 주간 API용 target_date — 해당 주 일요일과 오늘 중 이른 날
 * 7. formatDateLabel: period별 축 라벨 (daily MM/DD, weekly getMonthWeekLabel, monthly YYYY/MM)
 */

// 1.
/** ISO 연간 주차 (1~53). 목요일 포함 주 기준. */
export function getISOWeekNumber(dateStr) {
  if (!dateStr || dateStr.length < 10) return 0
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// 2.
/**
 * 월별 N주차 계산 후 "M월 N주차" 라벨 반환.
 * 1주차: 1일이 월~목에 있으면 그 주가 1주차, 1일이 금~일이면 다음 주 월요일부터 1주차.
 */
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
/** Date → YYYY-MM-DD (로컬 기준, UTC 비틀림 방지) */
export function toLocalDateString(d) {
  if (!d || !(d instanceof Date)) return ''
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

// 4.
/** 날짜 → input type="week" 값 (YYYY-Www) */
export function dateToWeekValue(dateStr) {
  if (!dateStr || dateStr.length < 10) return ''
  const w = getISOWeekNumber(dateStr)
  const y = new Date(dateStr + 'T00:00:00').getFullYear()
  return `${y}-W${String(w).padStart(2, '0')}`
}

// 5.
/** YYYY-Www → 해당 주 월요일 YYYY-MM-DD */
export function weekValueToDate(weekStr) {
  if (!weekStr || !/^\d{4}-W\d{2}$/.test(weekStr)) return null
  const [y, w] = weekStr.split('-W').map(Number)
  const jan4 = new Date(y, 0, 4)
  const mon = jan4.getDate() - (jan4.getDay() || 7) + 1
  const start = new Date(y, 0, mon + (w - 1) * 7)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
}

// 6.
/**
 * 주간 모드 API target_date. state가 월요일만 저장되므로, 일요일 말 스냅샷을 쓰려면 오늘과의 min 필요.
 */
export function weeklySnapshotTargetDate(anchorYmd) {
  if (!anchorYmd || anchorYmd.length < 10) return anchorYmd
  const d = new Date(`${anchorYmd.slice(0, 10)}T12:00:00`)
  const dow = d.getDay()
  const monOffset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + monOffset)
  const sun = new Date(d)
  sun.setDate(sun.getDate() + 6)
  const sunStr = toLocalDateString(sun)
  const todayStr = toLocalDateString(new Date())
  return sunStr < todayStr ? sunStr : todayStr
}

// 7.
/** YYYY-MM-DD와 period에 따른 차트 축 라벨 (daily: MM/DD, weekly: M월 N주차, monthly: YYYY/MM) */
export function formatDateLabel(ymd, period) {
  if (!ymd) return ymd
  if (period === 'monthly') return `${ymd.slice(0, 4)}/${ymd.slice(5, 7)}`
  if (period === 'weekly') return getMonthWeekLabel(ymd) || ymd
  return ymd.length >= 10 ? `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}` : ymd
}
