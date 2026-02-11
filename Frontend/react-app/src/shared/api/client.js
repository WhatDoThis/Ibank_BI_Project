/**
 * shared/api/client.js (Backend API 클라이언트)
 * =============================================
 * FastAPI 백엔드 호출용 fetch 래퍼. request(method, path, body), getApiBase() 사용.
 *
 * [Main Functions]
 * ===========
 * - request: method, path, body로 JSON 요청·파싱 (에러 시 Error 객체 throw)
 * - health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats (리포트)
 * - getDashboardTables, getDashboardFilterOptions, getDashboardData, getDashboardRequiredColumns, getChartData (대시보드1)
 * - getDashboard2Tables, getDashboard2FilterOptions, getDashboard2Data, getDashboard2RequiredColumns, getDashboard2ChartData (대시보드2)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - GET /health, GET/POST /api/* (list-tables, describe-table, execute-query, explain-sql 등), /api/dashboard/*, /api/dashboard2/*
 *
 * [Dependencies]
 * =========
 * - shared/config/api (getApiBase)
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

/** GET /api/table-relationships - mode: 'fk' | 'column' | 'all' (다중 조인키 반환) */
export async function tableRelationships(mode = 'all') {
  const q = mode ? `?mode=${encodeURIComponent(mode)}` : '?mode=all';
  return request('GET', `/api/table-relationships${q}`);
}

/** POST /api/join-order - base_table 기준 JOIN 순서(엣지 정보). A→B, A→C 브랜치 지원 */
export async function joinOrder(baseTable, requiredTables, filterTables = []) {
  return request('POST', '/api/join-order', {
    base_table: baseTable,
    required_tables: requiredTables || [],
    filter_tables: filterTables
  });
}

/** POST /api/execute-query - SQL 실행 */
export async function executeQuery(query) {
  return request('POST', '/api/execute-query', { query });
}

/** POST /api/save-query-as-table - 실행한 쿼리 결과를 지정한 이름의 테이블로 저장 */
export async function saveQueryAsTable(tableName, query) {
  return request('POST', '/api/save-query-as-table', { table_name: tableName, query });
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

// ---------- 대시보드 (report와 분리된 전용 API) ----------

/** POST /api/dashboard/data - 대시보드 집계·KPI */
export async function getDashboardData(body) {
  return request('POST', '/api/dashboard/data', body);
}

/** GET /api/dashboard/filter-options/:table_id - 필터 옵션(캠페인·워크플로우·채널). 선택된 값이 있으면 해당 조건에 맞는 옵션만 반환 */
export async function getDashboardFilterOptions(tableId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.campaign_ids?.length) params.set('campaign_ids', filters.campaign_ids.join(','));
  if (filters.workflow_ids?.length) params.set('workflow_ids', filters.workflow_ids.join(','));
  if (filters.channels?.length) params.set('channels', filters.channels.join(','));
  const qs = params.toString();
  const path = `/api/dashboard/filter-options/${encodeURIComponent(tableId)}${qs ? '?' + qs : ''}`;
  return request('GET', path);
}

/** GET /api/dashboard/tables - 대시보드 사용 가능(집계 가능) 테이블 목록 */
export async function getDashboardTables() {
  return request('GET', '/api/dashboard/tables');
}

/** GET /api/dashboard/required-columns - 대시보드 조회 필수 컬럼 목록 (안내용) */
export async function getDashboardRequiredColumns() {
  return request('GET', '/api/dashboard/required-columns');
}

/** POST /api/dashboard/chart-data - 차트 생성 전용 데이터 (단일 디멘션·메트릭 별도 조회) */
export async function getChartData(body) {
  return request('POST', '/api/dashboard/chart-data', body);
}

// ---------- 대시보드2 (DEV용, /api/dashboard2 전용) ----------

/** GET /api/dashboard2/tables - 대시보드2 사용 가능 테이블 목록 */
export async function getDashboard2Tables() {
  return request('GET', '/api/dashboard2/tables');
}

/** GET /api/dashboard2/filter-options/:table_id - 대시보드2 필터 옵션 */
export async function getDashboard2FilterOptions(tableId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.campaign_ids?.length) params.set('campaign_ids', filters.campaign_ids.join(','));
  if (filters.workflow_ids?.length) params.set('workflow_ids', filters.workflow_ids.join(','));
  if (filters.channels?.length) params.set('channels', filters.channels.join(','));
  const qs = params.toString();
  const path = `/api/dashboard2/filter-options/${encodeURIComponent(tableId)}${qs ? '?' + qs : ''}`;
  return request('GET', path);
}

/** POST /api/dashboard2/data - 대시보드2 집계·KPI */
export async function getDashboard2Data(body) {
  return request('POST', '/api/dashboard2/data', body);
}

/** GET /api/dashboard2/required-columns - 대시보드2 필수 컬럼 목록 */
export async function getDashboard2RequiredColumns() {
  return request('GET', '/api/dashboard2/required-columns');
}

/** POST /api/dashboard2/chart-data - 대시보드2 차트 데이터 */
export async function getDashboard2ChartData(body) {
  return request('POST', '/api/dashboard2/chart-data', body);
}
