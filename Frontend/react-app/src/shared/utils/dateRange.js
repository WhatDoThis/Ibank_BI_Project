/**
 * shared/utils/dateRange.js (기간 유틸)
 * ========================================
 * React 대시보드에서 기간 선택 시 선행일/후행일 순서 보장용 정규화. Backend 전송 전·기간 표시 라벨용.
 *
 * [주요 함수]
 * - normalizeDateRange: [시작일, 종료일]을 시작일 <= 종료일이 되도록 정렬해 반환.
 * - formatDateRangeLabel: [시작일, 종료일]을 화면 표시용 문자열로 반환(단일일/기간 구분).
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
