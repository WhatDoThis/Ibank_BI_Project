/**
 * shared/utils/dateRange.js (기간 유틸)
 * ========================================
 * 대시보드 기간 정규화·표시 라벨. Backend 전송 전·PeriodLabel 등에서 사용.
 *
 * [Main Functions]
 * ===========
 * - normalizeDateRange: [시작일, 종료일]을 시작일 <= 종료일 순으로 정렬 반환
 * - formatDateRangeLabel: [시작일, 종료일] → { label, isSingleDay } (YYYY.MM.DD 형식)
 * - toDisplayDate: YYYY-MM-DD → YYYY.MM.DD (내부)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - normalizeDateRange, formatDateRangeLabel (export)
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 유틸)
 */

/**
 * 기간 배열을 [시작일, 종료일] 순서로 정규화. (선행일 <= 후행일)
 * @param {[string, string] | string[]} range - [from, to] 형식
 * @returns {[string, string]} 항상 from <= to (문자열 비교), 빈 값이 있으면 원본 유지
 */
export function normalizeDateRange(range) {
  if (!Array.isArray(range) || range.length < 2) return range
  const a = String(range[0] ?? '').trim()
  const b = String(range[1] ?? '').trim()
  if (!a || !b) return range
  return a > b ? [b, a] : [a, b]
}

/** YYYY-MM-DD → YYYY.MM.DD (한국식 표기) */
function toDisplayDate(str) {
  if (!str || typeof str !== 'string') return ''
  const s = str.trim()
  if (s.length >= 10) return `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)}`
  if (s.length >= 7) return `${s.slice(0, 4)}.${s.slice(5, 7)}`
  return s
}

/**
 * 기간 배열을 섹션 헤더/카드 상단 표시용 라벨로 포맷.
 * @param {[string, string] | string[]} dateRange - [시작일, 종료일] (YYYY-MM-DD)
 * @returns {{ label: string, isSingleDay: boolean }} 표시 문자열 및 단일일 여부
 */
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
