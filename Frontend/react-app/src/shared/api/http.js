/**
 * shared/api/http.js (API 공통 HTTP 레이어)
 * =========================================
 * 패키지별 *Client.js에서만 사용. base URL·Authorization·401 시 refresh·403 프로젝트 유도.
 *
 * [Main Functions]
 * ===========
 * - apiBaseUrl: getApiBase 정규화 (끝 슬래시 제거)
 * - request: method/path/body JSON API (Bearer·401 1회 재시도)
 * - fetchOkJson: GET + fetch + ok 검사 + json (동일)
 *
 * [Dependencies]
 * =========
 * - shared/config/api (getApiBase)
 * - shared/auth/tokenStorage (get/set/clearTokens)
 */

import { getAccessToken, clearTokens, getRefreshToken, setTokens } from '../auth/tokenStorage.js'
import { getApiBase } from '../config/api.js'

/** 로그인·리프레시 등 Bearer 불필요 경로 */
const AUTH_FREE_PREFIXES = [
  '/api/auth/login',
  '/api/auth/verify-login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/invite/validate',
]

function pathWithoutQuery(p) {
  const s = p.startsWith('/') ? p : `/${p}`
  const q = s.indexOf('?')
  return q === -1 ? s : s.slice(0, q)
}

function shouldAttachAuth(path) {
  const n = pathWithoutQuery(path)
  return !AUTH_FREE_PREFIXES.some((pre) => n === pre || n.startsWith(`${pre}/`))
}

let refreshInFlight = null

async function tryRefreshOnce() {
  if (refreshInFlight) return refreshInFlight
  const rt = getRefreshToken()
  if (!rt) return false
  refreshInFlight = (async () => {
    try {
      const url = `${getApiBase().replace(/\/$/, '')}/api/auth/refresh`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.access_token || !data.refresh_token) {
        return false
      }
      setTokens(data.access_token, data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function redirectToProjectSelect() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '') || ''
  window.location.assign(`${base}/`)
}

function handleProjectForbidden(data) {
  const d = data?.detail
  const msg = typeof d === 'string' ? d : ''
  if (msg.includes('프로젝트를 선택')) {
    redirectToProjectSelect()
    return true
  }
  return false
}

function redirectToLogin() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '') || ''
  window.location.assign(`${base}/login`)
}

/** @returns {string} */
export function apiBaseUrl() {
  return getApiBase().replace(/\/$/, '')
}

function buildAuthHeaders(path) {
  const headers = {}
  if (!shouldAttachAuth(path)) return headers
  const at = getAccessToken()
  if (at) headers.Authorization = `Bearer ${at}`
  return headers
}

/** FastAPI detail / error 필드 파싱 */
export function formatFetchErrorMessage(data, res) {
  const detail = data?.detail
  if (detail !== undefined && detail !== null) {
    if (Array.isArray(detail)) {
      const s = detail
        .map((d) => (d.msg != null ? d.msg : (d.loc && d.loc.join('.')) || ''))
        .filter(Boolean)
        .join(', ')
      return s || `HTTP ${res.status}`
    }
    return String(detail)
  }
  return data?.error || data?.message || `HTTP ${res.status}`
}

/**
 * @param {string} method
 * @param {string} path
 * @param {object | null} body
 * @param {boolean} didRefresh 재시도 여부(내부)
 */
export async function request(method, path, body = null, didRefresh = false) {
  const norm = path.startsWith('/') ? path : `/${path}`
  const url = `${apiBaseUrl()}${norm}`
  const options = { method, headers: { ...buildAuthHeaders(norm) } }
  if (body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))

  if (res.status === 401 && shouldAttachAuth(norm) && !didRefresh) {
    const ok = await tryRefreshOnce()
    if (ok) return request(method, path, body, true)
    clearTokens()
    redirectToLogin()
    const err = new Error('세션이 만료되었습니다. 다시 로그인하세요.')
    err.status = 401
    err.data = data
    throw err
  }

  if (res.status === 403 && handleProjectForbidden(data)) {
    const err = new Error(typeof data?.detail === 'string' ? data.detail : 'Forbidden')
    err.status = 403
    err.data = data
    throw err
  }

  if (!res.ok) {
    const msg = formatFetchErrorMessage(data, res)
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/**
 * @param {string} pathQuery '/api/...?...'
 * @param {string} errorLabel 실패 시 Error 메시지 접두
 * @param {boolean} didRefresh
 */
export async function fetchOkJson(pathQuery, errorLabel, didRefresh = false) {
  const norm = pathQuery.startsWith('/') ? pathQuery : `/${pathQuery}`
  const url = `${apiBaseUrl()}${norm}`
  const res = await fetch(url, { headers: { ...buildAuthHeaders(norm) } })
  const data = await res.json().catch(() => ({}))

  if (res.status === 401 && shouldAttachAuth(norm) && !didRefresh) {
    const ok = await tryRefreshOnce()
    if (ok) return fetchOkJson(pathQuery, errorLabel, true)
    clearTokens()
    redirectToLogin()
    throw new Error(`${errorLabel}: 세션 만료`)
  }

  if (res.status === 403 && handleProjectForbidden(data)) {
    throw new Error(`${errorLabel}: 프로젝트를 선택해주세요`)
  }

  if (!res.ok) {
    throw new Error(`${errorLabel}: ${res.status}`)
  }
  return data
}
