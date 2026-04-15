/**
 * shared/utils/userDvsnDisplay.js (조직 역할 user_dvsn UI 표기)
 * ============================================================
 * API·DB의 `user_dvsn`(소문자 코드)을 화면에만 짧은 표기로 매핑한다. 요청 바디·비교 로직은 원문 코드를 그대로 쓴다.
 *
 * [Main Functions]
 * ===========
 * - formatUserDvsnDisplay: 표시 문자열(미매핑·공백은 원문 trim 또는 '—')
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/** @type {Readonly<Record<string, string>>} */
export const USER_DVSN_DISPLAY_BY_CANON = Object.freeze({
  sa_dev: 'SADEV',
  sa: 'S',
  a: 'A',
  o: 'B',
  u: 'C',
})

/**
 * @param {string | null | undefined} raw `user_info.user_dvsn` 등
 * @returns {string}
 */
export function formatUserDvsnDisplay(raw) {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!k) return '—'
  const mapped = USER_DVSN_DISPLAY_BY_CANON[k]
  if (mapped != null) return mapped
  return String(raw).trim()
}
