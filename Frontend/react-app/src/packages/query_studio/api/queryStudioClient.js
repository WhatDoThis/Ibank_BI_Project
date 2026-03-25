/**
 * query_studio/api/queryStudioClient.js (쿼리 스튜디오 패키지 API)
 * ================================================================
 * /health, /api/list-tables, execute-query 등 쿼리 스튜디오·쿼리 빌더 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (request)
 */

import { request } from '@/shared/api/http.js'

export async function health() {
  return request('GET', '/health')
}

export async function listTables() {
  return request('GET', '/api/list-tables')
}

export async function describeTable(tableName) {
  return request('POST', '/api/describe-table', { table_name: tableName })
}

export async function tableRelationships(mode = 'all') {
  const q = mode ? `?mode=${encodeURIComponent(mode)}` : '?mode=all'
  return request('GET', `/api/table-relationships${q}`)
}

export async function joinOrder(baseTable, requiredTables, filterTables = []) {
  return request('POST', '/api/join-order', {
    base_table: baseTable,
    required_tables: requiredTables || [],
    filter_tables: filterTables,
  })
}

export async function executeQuery(query) {
  return request('POST', '/api/execute-query', { query })
}

export async function saveQueryAsTable(tableName, query) {
  return request('POST', '/api/save-query-as-table', { table_name: tableName, query })
}

export async function getSaveQueryAsTableStatus(jobId) {
  return request('GET', `/api/save-query-as-table/status/${encodeURIComponent(jobId)}`)
}

export async function explainSql(query) {
  return request('POST', '/api/explain-sql', { query })
}

export async function getColumnValues(tableName, columnName, limit = 100) {
  return request('POST', '/api/get-column-values', {
    table_name: tableName,
    column_name: columnName,
    limit: Math.min(limit, 1000),
  })
}

export async function queryStats(query) {
  return request('POST', '/api/query-stats', { query })
}

export async function getColumnLabels(tableName) {
  return request('GET', `/api/column-labels?table_name=${encodeURIComponent(tableName)}`)
}

export async function saveColumnLabels(tableName, labels, tableLabel = null) {
  const body = { table_name: tableName, labels }
  if (tableLabel != null) body.table_label = tableLabel
  return request('POST', '/api/column-labels', body)
}
