/**
 * shared/utils/dateRange.js (기간 유틸)
 * ========================================
 * React 대시보드에서 기간 선택 시 선행일/후행일 순서 보장용 정규화. Backend 전송 전에도 사용.
 *
 * [주요 함수]
 * - normalizeDateRange: [시작일, 종료일]을 시작일 <= 종료일이 되도록 정렬해 반환.
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
