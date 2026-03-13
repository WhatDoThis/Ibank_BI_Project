/**
 * chartHelpers.js (차트용 헬퍼)
 * =============================
 * new-dashboard2 전용. Donut/차트 데이터 변환 유틸.
 *
 * [Main Functions]
 * 1. mapGenderToDonut: { label, count }[] → { label, value }[] (DemographicDonut용)
 *
 * [Dependencies]
 * - 없음 (순수 유틸)
 */

// 1.
export function mapGenderToDonut(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(({ label, count }) => ({ label: label ?? '', value: Number(count) || 0 }))
}
