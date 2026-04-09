/**
 * packages/widgetboard/utils/dateRangePolicy.js (위젯 data_config 기간 규칙)
 * ========================================================================
 * 일별 최대 14일·주별 최대 12주·월별 최대 12개월(포함) 검증. 서버 widget_board_service 와 동일 상한.
 *
 * [Main Functions]
 * ===========
 * 1. defaultRangeForGrain: UI 기본 시작·종료 YYYY-MM-DD
 * 2. validateWidgetDateRange: grain·시작·종료 검증 → { ok, error? }
 * 3. formatWidgetPeriodSubtitle: 위젯 헤더 툴팁·전체 문구 `YYYY-MM-DD ~ YYYY-MM-DD (일별|주별|월별)`
 * 4. formatWidgetPeriodSubtitleCompact: 카드 한 줄용 짧은 기간(같은 해·같은 월 시 생략)
 * 5. isMultiDayWidgetRange: 시작일≠종료일이면 true(차트 X축을 기간 단위 자동 집계)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1.
function toYMD(d) {
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 2.
/** @param {'day'|'week'|'month'} grain */
export function defaultRangeForGrain(grain) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  if (grain === 'day') {
    start.setDate(start.getDate() - 6)
  } else if (grain === 'week') {
    start.setDate(start.getDate() - 27)
  } else {
    start.setMonth(start.getMonth() - 2)
  }
  return { start: toYMD(start), end: toYMD(end) }
}

// 3.
function parseYMD(s) {
  if (!s || typeof s !== 'string') return null
  const d = new Date(s.slice(0, 10))
  return Number.isNaN(d.getTime()) ? null : d
}

// 4.
function inclusiveMonthCount(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
}

// 5.
/**
 * @param {string} grain day|week|month
 * @param {string} dateStart YYYY-MM-DD
 * @param {string} dateEnd YYYY-MM-DD
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateWidgetDateRange(grain, dateStart, dateEnd) {
  const g = (grain || 'day').toLowerCase()
  if (!['day', 'week', 'month'].includes(g)) {
    return { ok: false, error: '구간 단위는 일별·주별·월별 중 하나여야 합니다.' }
  }
  if (!dateStart?.trim() || !dateEnd?.trim()) {
    return { ok: false, error: '시작일과 종료일을 모두 선택해 주세요.' }
  }
  const d1 = parseYMD(dateStart)
  const d2 = parseYMD(dateEnd)
  if (!d1 || !d2) {
    return { ok: false, error: '날짜 형식이 올바르지 않습니다.' }
  }
  if (d1 > d2) {
    return { ok: false, error: '시작일이 종료일보다 늦을 수 없습니다.' }
  }
  const deltaDays = Math.round((d2 - d1) / 86400000)
  if (g === 'day') {
    if (deltaDays > 13) return { ok: false, error: '일별은 최대 14일(포함)까지 선택할 수 있습니다.' }
  } else if (g === 'week') {
    if (deltaDays > 12 * 7 - 1) return { ok: false, error: '주별은 최대 12주(84일) 범위입니다.' }
  } else if (inclusiveMonthCount(d1, d2) > 12) {
    return { ok: false, error: '월별은 최대 12개월(포함) 범위입니다.' }
  }
  return { ok: true }
}

// 6.
/**
 * data_config 기간이 있을 때 카드 헤더 부제 문자열
 * @param {{ dateStart?: string, dateEnd?: string, dateGrain?: string }} cfg
 * @returns {string} 둘 다 없으면 빈 문자열
 */
export function formatWidgetPeriodSubtitle(cfg) {
  const a = (cfg?.dateStart || '').trim()
  const b = (cfg?.dateEnd || '').trim()
  if (!a || !b) return ''
  const g = String(cfg?.dateGrain || 'day').toLowerCase()
  const gl = g === 'week' ? '주별' : g === 'month' ? '월별' : '일별'
  return `${a} ~ ${b} (${gl})`
}

// 7.
/**
 * data_config 기간이 있을 때 카드에 한 줄로 넣기 위한 짧은 부제(툴팁은 formatWidgetPeriodSubtitle 권장)
 * @param {{ dateStart?: string, dateEnd?: string, dateGrain?: string }} cfg
 * @returns {string}
 */
export function formatWidgetPeriodSubtitleCompact(cfg) {
  const a = (cfg?.dateStart || '').trim()
  const b = (cfg?.dateEnd || '').trim()
  if (!a || !b) return ''
  const g = String(cfg?.dateGrain || 'day').toLowerCase()
  const gl = g === 'week' ? '주별' : g === 'month' ? '월별' : '일별'
  const pa = a.slice(0, 10).split('-')
  const pb = b.slice(0, 10).split('-')
  if (pa.length !== 3 || pb.length !== 3) {
    return `${a} ~ ${b} · ${gl}`
  }
  const [ya, ma, da] = pa
  const [yb, mb, db] = pb
  if (ya === yb) {
    if (ma === mb) {
      return `${ya}-${ma}-${da} ~ ${db} · ${gl}`
    }
    return `${ya}-${ma}-${da} ~ ${mb}-${db} · ${gl}`
  }
  return `${ya}-${ma}-${da} ~ ${yb}-${mb}-${db} · ${gl}`
}

// 8.
/**
 * 위젯 조회 기간이 하루가 아닌지(YYYY-MM-DD 기준)
 * @param {string} [dateStart]
 * @param {string} [dateEnd]
 * @returns {boolean}
 */
export function isMultiDayWidgetRange(dateStart, dateEnd) {
  const a = (dateStart || '').trim().slice(0, 10)
  const b = (dateEnd || '').trim().slice(0, 10)
  if (!a || !b) return false
  return a !== b
}
