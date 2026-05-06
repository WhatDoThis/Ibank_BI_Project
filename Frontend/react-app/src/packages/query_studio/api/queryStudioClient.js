/**
 * query_studio/api/queryStudioClient.js (쿼리 스튜디오 패키지 API)
 * ================================================================
 * /health, /api/list-tables, execute-query 등 쿼리 스튜디오 전용.
 * listTables·describeTable·executeQuery 는 shared/api/queryStudioTableApi.js 에서 re-export.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (request), shared/api/queryStudioTableApi.js
 */

import { request } from '@/shared/api/http.js'
import { getTableRelationshipsMode } from '@/shared/config/api.js'

export { listTables, describeTable, executeQuery } from '@/shared/api/queryStudioTableApi.js'

export async function health() {
  return request('GET', '/health')
}

export async function tableRelationships(mode) {
  const m = mode != null && String(mode).trim() !== '' ? String(mode).trim().toLowerCase() : getTableRelationshipsMode()
  const q = `?mode=${encodeURIComponent(m)}`
  return request('GET', `/api/table-relationships${q}`)
}

export async function joinOrder(baseTable, requiredTables, filterTables = []) {
  return request('POST', '/api/join-order', {
    base_table: baseTable,
    required_tables: requiredTables || [],
    filter_tables: filterTables,
  })
}

export async function saveQueryAsTable(tableName, query, columnCommentHints = null) {
  const body = { table_name: tableName, query }
  if (columnCommentHints != null && Array.isArray(columnCommentHints) && columnCommentHints.length > 0) {
    body.column_comment_hints = columnCommentHints
  }
  return request('POST', '/api/save-query-as-table', body)
}

export async function getSaveQueryAsTableStatus(jobId) {
  return request('GET', `/api/save-query-as-table/status/${encodeURIComponent(jobId)}`)
}

/** 현재 프로젝트의 테이블 저장 큐 목록 (최신순, total/offset/limit 응답) */
export async function getSaveTableQueueList({ status = null, limit = 20, offset = 0 } = {}) {
  const p = new URLSearchParams()
  p.set('limit', String(Math.min(500, Math.max(1, limit))))
  p.set('offset', String(Math.max(0, Math.min(500000, Number(offset) || 0))))
  if (status && String(status).trim() !== '') p.set('status', String(status).trim())
  return request('GET', `/api/save-query-as-table/queue?${p.toString()}`)
}

export async function cancelSaveTableQueueJob(jobId) {
  return request('POST', `/api/save-query-as-table/queue/${encodeURIComponent(jobId)}/cancel`, {})
}

export async function requeueSaveTableJob(jobId) {
  return request('POST', `/api/save-query-as-table/queue/${encodeURIComponent(jobId)}/requeue`, {})
}

export async function explainSql(query) {
  return request('POST', '/api/explain-sql', { query })
}

/** 저장 직전 SELECT에 대해 EXPLAIN 기반 예상 행·데이터 크기 추정 (실행 없음) */
export async function estimateQueryResultSize(query) {
  return request('POST', '/api/estimate-query-result', { query })
}

export async function saveColumnLabels(tableName, labels, tableLabel = null) {
  const body = { table_name: tableName, labels }
  if (tableLabel != null) body.table_label = tableLabel
  return request('POST', '/api/column-labels', body)
}
