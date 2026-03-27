/**
 * shared/auth/jwtUtils.js (JWT 페이로드 디코드 — 검증 없음)
 * =======================================================
 * 클라이언트에서 project_info_id·exp 여부만 확인할 때 사용. 서명 검증은 백엔드.
 *
 * [Main Functions]
 * ===========
 * - parseJwtPayload: access_token 문자열 → 객체 또는 null
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/**
 * @param {string} accessToken
 * @returns {Record<string, unknown> | null}
 */
export function parseJwtPayload(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null
  try {
    const part = accessToken.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * @param {string} accessToken
 * @returns {boolean}
 */
export function hasProjectClaim(accessToken) {
  const p = parseJwtPayload(accessToken)
  if (!p) return false
  return p.project_info_id != null && p.project_info_id !== ''
}
