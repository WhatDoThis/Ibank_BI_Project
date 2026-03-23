/**
 * shared/api/http.js (API 공통 HTTP 레이어)
 * =========================================
 * 패키지별 *Client.js에서만 사용. base URL·JSON request·에러 파싱 공통화.
 *
 * [Main Functions]
 * ===========
 * - apiBaseUrl: getApiBase 정규화 (끝 슬래시 제거)
 * - request: method/path/body JSON API
 * - fetchOkJson: GET 등 fetch + ok 검사 + json
 *
 * [Dependencies]
 * =========
 * - shared/config/api (getApiBase)
 */

import { getApiBase } from '../config/api.js'

/** @returns {string} */
export function apiBaseUrl() {
  return getApiBase().replace(/\/$/, '')
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
 */
export async function request(method, path, body = null) {
  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : '/' + path}`
  const options = { method, headers: {} }
  if (body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
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
 */
export async function fetchOkJson(pathQuery, errorLabel) {
  const url = `${apiBaseUrl()}${pathQuery.startsWith('/') ? pathQuery : '/' + pathQuery}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${errorLabel}: ${res.status}`)
  }
  return data
}
