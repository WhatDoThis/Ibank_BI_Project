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

export async function explainSql(query) {
  return request('POST', '/api/explain-sql', { query })
}

export async function saveColumnLabels(tableName, labels, tableLabel = null) {
  const body = { table_name: tableName, labels }
  if (tableLabel != null) body.table_label = tableLabel
  return request('POST', '/api/column-labels', body)
}
