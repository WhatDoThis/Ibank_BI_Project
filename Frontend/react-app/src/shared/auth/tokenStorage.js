/**
 * shared/auth/tokenStorage.js (액세스·리프레시 토큰 저장)
 * =====================================================
 * localStorage 키 고정. http.js·AuthContext에서만 사용.
 *
 * [Main Functions]
 * ===========
 * - getAccessToken / getRefreshToken / setTokens / clearTokens
 *
 * [Dependencies]
 * =========
 * - 없음 (브라우저 localStorage)
 */

const KEY_ACCESS = 'ibank_access_token'
const KEY_REFRESH = 'ibank_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(KEY_ACCESS)
}

export function getRefreshToken() {
  return localStorage.getItem(KEY_REFRESH)
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(KEY_ACCESS, accessToken)
  if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(KEY_ACCESS)
  localStorage.removeItem(KEY_REFRESH)
}
