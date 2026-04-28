/**
 * shared/api/systemLogClient.js (system_log_server 조회 API)
 * ==========================================================
 * 조직 어드민 전용 `/api/system-logs`·`/api/system-logs/login-history/org`. Bearer는 `http.request` 공통.
 *
 * [Main Functions]
 * ===========
 * 1. getSystemLogsOrg — system_log 목록 페이징(필터·정렬, 기본 page_size 10)
 * 2. getLoginHistoryOrg — 부서 트리 범위 로그인 이력 페이징(필터·정렬, 기본 page_size 10)
 * 3. downloadUserHistoryCsv — login·system·changes 탭 CSV(blob, 파일명 `login_log_*` / `system_log_*` / `data_track_*` + 타임스탬프, 상한 초과 시 400; system·changes CSV는 일시 다음 UUID 열 포함)
 * 4. getSystemLogChanges — system_log_id별 data_change_log 항목 배열(JSON 배열 응답)
 * 5. getChangeLogsPaged — change_log 목록 페이징(필터·`from`·`to`, ChangeLogListOut)
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js (request, fetchBlobWithAuth, apiBaseUrl, formatFetchErrorMessage)
 * - shared/auth/tokenStorage (미직접 import; Bearer·401 재시도는 http.fetchBlobWithAuth)
 */

import { apiBaseUrl, fetchBlobWithAuth, request } from './http.js'

/**
 * @param {string | null} cd
 * @param {string} fallback
 */
function filenameFromContentDisposition(cd, fallback) {
  if (!cd || typeof cd !== 'string') return fallback
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(cd)
  if (quoted?.[1]) return quoted[1].trim()
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(cd)
  if (plain?.[1]) return plain[1].trim()
  return fallback
}

/**
 * @param {'login'|'system'|'changes'} tab
 */
function orgLogCsvFallbackFilename(tab) {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
  if (tab === 'login') return `login_log_${ts}.csv`
  if (tab === 'changes') return `data_track_${ts}.csv`
  return `system_log_${ts}.csv`
}

/** @param {Record<string, string|number|undefined|null>} params */
function toQuery(params) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// 1.
/** @param {{ page?: number, page_size?: number, user_key?: string, from?: string, to?: string, ip_contains?: string, channel?: string, action_kind?: string, success_yn?: string, sort_by?: string, sort_dir?: string }} p */
export async function getSystemLogsOrg(p = {}) {
  const qs = toQuery({
    page: p.page ?? 1,
    page_size: p.page_size ?? 10,
    user_key: p.user_key,
    from: p.from,
    to: p.to,
    ip_contains: p.ip_contains,
    channel: p.channel,
    action_kind: p.action_kind,
    success_yn: p.success_yn,
    sort_by: p.sort_by,
    sort_dir: p.sort_dir,
  })
  return request('GET', `/api/system-logs${qs}`)
}

// 2.
/** @param {{ page?: number, page_size?: number, user_key?: string, from?: string, to?: string, ip_contains?: string, sort_by?: string, sort_dir?: string }} p */
export async function getLoginHistoryOrg(p = {}) {
  const qs = toQuery({
    page: p.page ?? 1,
    page_size: p.page_size ?? 10,
    user_key: p.user_key,
    from: p.from,
    to: p.to,
    ip_contains: p.ip_contains,
    sort_by: p.sort_by,
    sort_dir: p.sort_dir,
  })
  return request('GET', `/api/system-logs/login-history/org${qs}`)
}

// 3.
/**
 * @param {'login'|'system'|'changes'} tab
 * @param {{ userKey: string, fromD: string, toD: string, ipContains: string, channel: string, actionKind: string, successYn: string, chgTable: string, chgPk: string, chgChannel: string, sortLoginBy: string, sortLoginDir: string, sortSystemBy: string, sortSystemDir: string }} applied
 */
export async function downloadUserHistoryCsv(tab, applied) {
  const base = {
    user_key: applied.userKey || undefined,
    from: applied.fromD || undefined,
    to: applied.toD || undefined,
    ip_contains: applied.ipContains || undefined,
  }
  const path =
    tab === 'login'
      ? `/api/system-logs/login-history/org/export.csv${toQuery({
          ...base,
          sort_by: applied.sortLoginBy || undefined,
          sort_dir: applied.sortLoginDir || undefined,
        })}`
      : tab === 'changes'
        ? `/api/system-logs/change-logs/export.csv${toQuery({
            from: applied.fromD || undefined,
            to: applied.toD || undefined,
            target_table: applied.chgTable || undefined,
            target_pk_value: applied.chgPk || undefined,
            channel: applied.chgChannel || undefined,
          })}`
        : `/api/system-logs/export.csv${toQuery({
            ...base,
            channel: applied.channel || undefined,
            action_kind: applied.actionKind || undefined,
            success_yn: applied.successYn || undefined,
            sort_by: applied.sortSystemBy || undefined,
            sort_dir: applied.sortSystemDir || undefined,
          })}`
  const norm = path.startsWith('/') ? path : `/${path}`
  const res = await fetchBlobWithAuth(norm)
  const blob = await res.blob()
  const fallback = orgLogCsvFallbackFilename(tab)
  const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), fallback)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

// 4.
/**
 * @param {string|number} systemLogId
 * @returns {Promise<unknown[]>} 백엔드 JSON 배열(래핑 없음)
 */
export async function getSystemLogChanges(systemLogId) {
  const data = await request(
    'GET',
    `/api/system-logs/${encodeURIComponent(String(systemLogId))}/changes`
  )
  return Array.isArray(data) ? data : []
}

// 5.
/** @param {{ page?: number, page_size?: number, target_table?: string, target_pk_value?: string, channel?: string, from?: string, to?: string }} p */
export async function getChangeLogsPaged(p = {}) {
  const qs = toQuery({
    page: p.page ?? 1,
    page_size: p.page_size ?? 10,
    target_table: p.target_table,
    target_pk_value: p.target_pk_value,
    channel: p.channel,
    from: p.from,
    to: p.to,
  })
  return request('GET', `/api/system-logs/change-logs${qs}`)
}

