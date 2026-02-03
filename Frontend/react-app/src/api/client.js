/**
 * api/client.js (Backend API 클라이언트)
 * ======================================
 * Backend API 호출용 fetch 래퍼. config/api.getApiBase() 사용.
 * 기존 Frontend/static/js/app.js 의 API 호출 패턴을 참고하여 구현.
 *
 * [주요 기능]
 * - health, listTables, describeTable, tableRelationships
 * - executeQuery, explainSql, getColumnValues, queryStats
 *
 * [Endpoints]
 * - GET  /health, GET /api/list-tables, GET /api/table-relationships
 * - POST /api/describe-table, /api/execute-query, /api/explain-sql, /api/get-column-values, /api/query-stats
 *
 * [의존성]
 * - config/api (getApiBase)
 */

import { getApiBase } from '../config/api.js';

function baseUrl() {
  return getApiBase().replace(/\/$/, '');
}

async function request(method, path, body = null) {
  const url = `${baseUrl()}${path.startsWith('/') ? path : '/' + path}`;
  const options = { method, headers: {} };
  if (body != null && (method === 'POST' || method === 'PUT')) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** GET /health - DB 연결 상태 */
export async function health() {
  return request('GET', '/health');
}

/** GET /api/list-tables - 테이블 목록 */
export async function listTables() {
  return request('GET', '/api/list-tables');
}

/** POST /api/describe-table - 테이블 컬럼 목록 */
export async function describeTable(tableName) {
  return request('POST', '/api/describe-table', { table_name: tableName });
}

/** GET /api/table-relationships - FK 관계 */
export async function tableRelationships() {
  return request('GET', '/api/table-relationships');
}

/** POST /api/execute-query - SQL 실행 */
export async function executeQuery(query) {
  return request('POST', '/api/execute-query', { query });
}

/** POST /api/explain-sql - SQL 해석 (Claude) */
export async function explainSql(query) {
  return request('POST', '/api/explain-sql', { query });
}

/** POST /api/get-column-values - 컬럼 고유값 */
export async function getColumnValues(tableName, columnName, limit = 100) {
  return request('POST', '/api/get-column-values', {
    table_name: tableName,
    column_name: columnName,
    limit: Math.min(limit, 1000)
  });
}

/** POST /api/query-stats - 쿼리 통계 */
export async function queryStats(query) {
  return request('POST', '/api/query-stats', { query });
}
