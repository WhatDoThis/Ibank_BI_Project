/**
 * shared/api/queryStudioTableApi.js (메인 DB 테이블 목록·구조·SELECT 실행)
 * =====================================================================
 * query_studio_server 라우터(`/api/list-tables`, `describe-table`, `execute-query`) 호출.
 * query_studio 패키지와 widgetboard 패키지가 동일 엔드포인트를 쓰므로 shared에 둔다.
 *
 * [Main Functions]
 * ===========
 * - listTables(opts?: { mappingUsage?: 'query_studio'|'widgetboard' })
 * - describeTable(tableName, opts?: { mappingUsage?: 'query_studio'|'widgetboard' })
 * - executeQuery(query) — main_db만
 * - queryStats(query)
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js request
 */

import { request } from '@/shared/api/http.js'

// 1.
/** @param {{ mappingUsage?: 'query_studio'|'widgetboard' }} [opts] — 위젯보드는 widgetboard(매핑 채널 일치) */
export async function listTables(opts = {}) {
  const mu = opts.mappingUsage === 'widgetboard' ? 'widgetboard' : 'query_studio'
  const q = mu === 'widgetboard' ? '?mapping_usage=widgetboard' : ''
  return request('GET', `/api/list-tables${q}`)
}

// 2.
export async function describeTable(tableName, opts = {}) {
  const mu = opts.mappingUsage === 'widgetboard' ? 'widgetboard' : 'query_studio'
  return request('POST', '/api/describe-table', {
    table_name: tableName,
    mapping_usage: mu,
  })
}

// 3.
export async function executeQuery(query) {
  return request('POST', '/api/execute-query', { query })
}

// 4.
export async function queryStats(query) {
  return request('POST', '/api/query-stats', { query })
}
