/**
 * shared/api/authClient.js (인증·프로젝트 API)
 * ===========================================
 * /api/auth·/api/projects 호출. 로그인 계열은 Bearer 없이 fetch, 그 외는 request·토큰 갱신은 http.js.
 *
 * [Main Functions]
 * ===========
 * - postLogin, postVerifyLogin, postLogout, postSignup, postCreateOrg, getInviteValidate
 * - getMe, patchMe, patchPassword, getLoginHistory, getProjects, postSelectProject
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js (request, apiBaseUrl)
 * - shared/auth/tokenStorage (setTokens, clearTokens)
 */

import { apiBaseUrl, request } from './http.js'
import { clearTokens, setTokens } from '../auth/tokenStorage.js'

async function postJsonNoAuth(path, body) {
  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data?.detail
    const msg =
      typeof d === 'string' ? d : data?.error || data?.message || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function postLogin(email, password) {
  return postJsonNoAuth('/api/auth/login', { email, password })
}

export async function postVerifyLogin(preAuthToken, code) {
  const data = await postJsonNoAuth('/api/auth/verify-login', {
    pre_auth_token: preAuthToken,
    code,
  })
  if (data.access_token && data.refresh_token) {
    setTokens(data.access_token, data.refresh_token)
  }
  return data
}

export async function postSignup(body) {
  return postJsonNoAuth('/api/auth/signup', body)
}

export async function postCreateOrg(body) {
  return postJsonNoAuth('/api/auth/create-org', body)
}

/** GET /api/auth/invite/validate?code= — Bearer 불필요 */
export async function getInviteValidate(code) {
  const base = apiBaseUrl().replace(/\/$/, '')
  const q = encodeURIComponent(code || '')
  const url = `${base}/api/auth/invite/validate?code=${q}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data?.detail
    const msg =
      typeof d === 'string' ? d : data?.error || data?.message || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function postLogout() {
  try {
    await request('POST', '/api/auth/logout', {})
  } finally {
    clearTokens()
  }
}

export async function getMe() {
  return request('GET', '/api/auth/me')
}

export async function patchMe(body) {
  return request('PATCH', '/api/auth/me', body)
}

export async function patchPassword(currentPassword, newPassword) {
  return request('PATCH', '/api/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function getLoginHistory() {
  return request('GET', '/api/auth/me/login-history')
}

export async function getProjects() {
  return request('GET', '/api/projects')
}

export async function postSelectProject(projectInfoId) {
  const data = await request('POST', `/api/projects/${projectInfoId}/select`, {})
  if (data.access_token && data.refresh_token) {
    setTokens(data.access_token, data.refresh_token)
  }
  return data
}
