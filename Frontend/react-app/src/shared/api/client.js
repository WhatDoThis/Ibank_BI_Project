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
 * - getNewDashboardTables, getNewDashboardSummary, getNewDashboardTrend, getNewDashboardTrendMulti (뉴 대시보드)
 * - getNewDash2Overview, getNewDash2Star, getNewDash2Frequency, getNewDash2Coupon, getNewDash2CampaignSegments, getNewDash2Store, getNewDash2Trend, getNewDash2ProductMaster (뉴 대시보드2)
 * - ETL: /api/etl 단일 사용 — etl2* (테이블·업로드·연결·Job), batch* (배치 Job·폴더연결)
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
  if (body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.detail !== undefined && data.detail !== null
        ? Array.isArray(data.detail)
          ? data.detail.map((d) => (d.msg != null ? d.msg : (d.loc && d.loc.join('.')) || '')).filter(Boolean).join(', ') || `HTTP ${res.status}`
          : String(data.detail)
        : (data.error || data.message || `HTTP ${res.status}`);
    const err = new Error(msg);
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

/** POST /api/save-query-as-table - 쿼리 결과를 테이블로 저장 (큐 등록, 백그라운드 실행). 반환: job_id, status: "queued" */
export async function saveQueryAsTable(tableName, query) {
  return request('POST', '/api/save-query-as-table', { table_name: tableName, query });
}

/** GET /api/save-query-as-table/status/:job_id - 백그라운드 저장 작업 상태 */
export async function getSaveQueryAsTableStatus(jobId) {
  return request('GET', `/api/save-query-as-table/status/${encodeURIComponent(jobId)}`);
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

/** GET /api/column-labels - 테이블 컬럼 라벨 조회 */
export async function getColumnLabels(tableName) {
  return request('GET', `/api/column-labels?table_name=${encodeURIComponent(tableName)}`);
}

/** POST /api/column-labels - 테이블·컬럼 라벨 저장 */
export async function saveColumnLabels(tableName, labels, tableLabel = null) {
  const body = { table_name: tableName, labels };
  if (tableLabel != null) body.table_label = tableLabel;
  return request('POST', '/api/column-labels', body);
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

// ---------- New Dashboard (뉴 대시보드: 일간/주간/월간 현황판) ----------

function baseUrlNewDashboard() {
  return getApiBase().replace(/\/$/, '');
}

/** GET /api/new-dashboard/tables - 뉴 대시보드 집계 가능 테이블 목록 */
export async function getNewDashboardTables() {
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/tables`);
  if (!res.ok) throw new Error(`테이블 목록 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard/summary - 뉴 대시보드 기간별 요약 (KPI·증감률·aggregated_data) */
export async function getNewDashboardSummary(tableId, targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ table_id: tableId, period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/summary?${params}`);
  if (!res.ok) throw new Error(`요약 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard/trend - 뉴 대시보드 단일 메트릭 추이 */
export async function getNewDashboardTrend(tableId, { endDate = null, days = 30, metric = 'success_count' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, days: String(days), metric });
  if (endDate) params.set('end_date', endDate);
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/trend?${params}`);
  if (!res.ok) throw new Error(`추이 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard/trend-multi - 뉴 대시보드 기간별 복수 메트릭 (period: daily 10일 / weekly 10주 / monthly 10개월) */
export async function getNewDashboardTrendMulti(tableId, { endDate = null, period = 'daily', days = 10, count = 10, byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, days: String(days), count: String(count) });
  if (endDate) params.set('end_date', endDate);
  if (byChannel) params.set('by_channel', 'true');
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/trend-multi?${params}`);
  if (!res.ok) throw new Error(`추이(멀티) 조회 실패: ${res.status}`);
  return res.json();
}

// ---------- New Dashboard 2 (마케팅 성과 분석) ----------

function baseUrlNewDashboard2() {
  return getApiBase().replace(/\/$/, '');
}

/** GET /api/new-dashboard2/overview */
export async function getNewDash2Overview(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/overview?${params}`);
  if (!res.ok) throw new Error(`Overview 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/star */
export async function getNewDash2Star(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/star?${params}`);
  if (!res.ok) throw new Error(`Star 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/frequency */
export async function getNewDash2Frequency(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/frequency?${params}`);
  if (!res.ok) throw new Error(`Frequency 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/coupon */
export async function getNewDash2Coupon(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/coupon?${params}`);
  if (!res.ok) throw new Error(`Coupon 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/campaign-segments */
export async function getNewDash2CampaignSegments(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/campaign-segments?${params}`);
  if (!res.ok) throw new Error(`Campaign segments 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/store */
export async function getNewDash2Store(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period });
  if (targetDate) params.set('target_date', targetDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/store?${params}`);
  if (!res.ok) throw new Error(`Store 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/trend - table_name, metrics(comma-separated), end_date, days, period, count. Returns { rows, period, table_name } */
export async function getNewDash2Trend(tableName, metrics, { endDate = null, days = 30, period = 'daily', count = 12 } = {}) {
  const params = new URLSearchParams({ table_name: tableName, metrics, days: String(days), period, count: String(count) });
  if (endDate) params.set('end_date', endDate);
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/trend?${params}`);
  if (!res.ok) throw new Error(`Trend 조회 실패: ${res.status}`);
  return res.json();
}

/** GET /api/new-dashboard2/product-master - 상품 마스터 (쿼리 파라미터 없음) */
export async function getNewDash2ProductMaster() {
  const res = await fetch(`${baseUrlNewDashboard2()}/api/new-dashboard2/product-master`);
  if (!res.ok) throw new Error(`Product master 조회 실패: ${res.status}`);
  return res.json();
}

// ---------- ETL (단일, /api/etl) ----------

function baseUrlForEtl() {
  return getApiBase().replace(/\/$/, '');
}

/** GET /api/etl/tables - ETL 테이블 목록 */
export async function etl2ListTables() {
  return request('GET', '/api/etl/tables');
}

/** POST /api/etl/tables - ETL 테이블 1건 등록 */
export async function etl2CreateTable(body) {
  return request('POST', '/api/etl/tables', body);
}

/** POST /api/etl/upload - 파일 업로드 (multipart) */
export async function etl2UploadFile(formData) {
  const url = `${baseUrlForEtl()}/api/etl/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.detail !== undefined && data.detail !== null
        ? Array.isArray(data.detail)
          ? data.detail.map((d) => (d.msg != null ? d.msg : (d.loc && d.loc.join('.')) || '')).filter(Boolean).join(', ') || `HTTP ${res.status}`
          : String(data.detail)
        : (data.error || data.message || `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** POST /api/etl/infer-schema - 파일만 업로드하여 스키마(컬럼·타입) 반환, 메타 등록 없음. 테이블선택 및 컬럼매핑용 */
export async function etl2InferSchema(file) {
  const url = `${baseUrlForEtl()}/api/etl/infer-schema`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail != null ? String(data.detail) : (data.error || data.message || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

/** DELETE /api/etl/tables/:id */
export async function etl2DeleteTable(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}`);
}

/** PATCH /api/etl/tables/:id */
export async function etl2UpdateTable(etlTableId, body) {
  return request('PATCH', `/api/etl/tables/${encodeURIComponent(etlTableId)}`, body);
}

/** DELETE /api/etl/tables/:id/row */
export async function etl2DeleteTableRow(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}/row`);
}

/** GET /api/etl/tables/:id/preview */
export async function etl2PreviewTable(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/preview`);
}

/**
 * POST /api/etl/transform/preview — 현재 설정한 변환 룰 적용 미리보기
 * @param {{ etl_table_id: number, rules: Array<object>, column_mapping?: Array<object> }} body
 * @returns {Promise<{ preview_columns: string[], preview_rows: any[][], row_count: number, transform_failed_count?: number }>}
 */
export async function etl2TransformPreview(body) {
  return request('POST', '/api/etl/transform/preview', body);
}

/** GET /api/etl/tables/:id/target-exists */
export async function etl2TargetExists(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/target-exists`);
}

/** POST /api/etl/tables/:id/run */
export async function etl2RunTable(etlTableId) {
  return request('POST', `/api/etl/tables/${encodeURIComponent(etlTableId)}/run`);
}

/** 업로드 요청 공통: 긴 타임아웃(5분) + 네트워크 오류 시 안내 메시지 */
const UPLOAD_FETCH_TIMEOUT_MS = 5 * 60 * 1000;

async function fetchUploadWithTimeout(url, formData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err?.message || '';
    if (err?.name === 'AbortError' || msg.includes('aborted')) {
      throw new Error('업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 네트워크를 확인하세요.');
    }
    if (msg === 'Failed to fetch' || msg.includes('Load failed') || msg.includes('NetworkError')) {
      throw new Error('API 서버에 연결할 수 없습니다. 백엔드(python run.py back)가 실행 중인지, 주소가 맞는지 확인하세요.');
    }
    throw err;
  }
}

/** POST /api/etl/tables/:id/add-file */
export async function etl2AddFileToTable(etlTableId, file) {
  const url = `${baseUrlForEtl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-file`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchUploadWithTimeout(url, formData);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** POST /api/etl/tables/:id/add-files-zip */
export async function etl2AddFilesZipToTable(etlTableId, file) {
  const url = `${baseUrlForEtl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-files-zip`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchUploadWithTimeout(url, formData);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** GET /api/etl/jobs */
export async function etl2ListJobs(etlTableId = null, statuses = null) {
  const params = new URLSearchParams({ limit: '500' });
  if (etlTableId != null) params.set('etl_table_id', String(etlTableId));
  if (statuses != null && statuses !== '') params.set('statuses', statuses);
  return request('GET', `/api/etl/jobs?${params.toString()}`);
}

/** GET /api/etl/jobs/:job_id */
export async function etl2GetJob(jobId) {
  return request('GET', `/api/etl/jobs/${encodeURIComponent(jobId)}`);
}

/** POST /api/etl/jobs/:job_id/cancel */
export async function etl2CancelJob(jobId) {
  return request('POST', `/api/etl/jobs/${encodeURIComponent(jobId)}/cancel`);
}

/** DELETE /api/etl/jobs/:job_id */
export async function etl2DeleteJob(jobId) {
  return request('DELETE', `/api/etl/jobs/${encodeURIComponent(jobId)}`);
}

/** DELETE /api/etl/connections/:id */
export async function etl2DeleteConnection(connectionId) {
  return request('DELETE', `/api/etl/connections/${encodeURIComponent(connectionId)}`);
}

/** GET /api/etl/timezones - 서버 시간대 마스터 목록(셀렉트박스용) */
export async function etl2ListTimezones() {
  return request('GET', '/api/etl/timezones');
}

/** GET /api/etl/connections */
export async function etl2ListConnections() {
  return request('GET', '/api/etl/connections');
}

/** POST /api/etl/connections */
export async function etl2CreateConnection(body) {
  return request('POST', '/api/etl/connections', body);
}

/** POST /api/etl/connections/test */
export async function etl2TestConnection(body) {
  return request('POST', '/api/etl/connections/test', body);
}

/** GET /api/etl/connections/:id/tables */
export async function etl2ListConnectionTables(connectionId) {
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/tables`);
}

/** GET /api/etl/connections/:id/source-columns - 소스 테이블 컬럼 목록(증분 컬럼 셀렉트용) */
export async function etl2GetSourceColumns(connectionId, sourceTable) {
  const params = new URLSearchParams({ source_table: sourceTable });
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/source-columns?${params.toString()}`);
}

/** GET /api/etl/connections/:id/source-indexes - 소스 테이블 인덱스 목록(PK 포함, is_primary 구분) */
export async function etl2GetSourceIndexes(connectionId, sourceTable) {
  const params = new URLSearchParams({ source_table: sourceTable });
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/source-indexes?${params.toString()}`);
}

/** POST /api/etl/connections/:id/validate-incremental-column - 증분 컬럼 날짜 검증(커스텀 입력 시) */
export async function etl2ValidateIncrementalColumn(connectionId, sourceTable, columnName) {
  return request('POST', `/api/etl/connections/${encodeURIComponent(connectionId)}/validate-incremental-column`, {
    source_table: sourceTable,
    column_name: columnName
  });
}

/** GET /api/etl/tables/:id/transform-rules */
export async function etl2ListTransformRules(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/transform-rules`);
}

/** POST /api/etl/transform-rules - 변환 룰 1건 등록 */
export async function etl2CreateTransformRule(body) {
  return request('POST', '/api/etl/transform-rules', body);
}

/** PUT /api/etl/transform-rules/:id - 변환 룰 수정 */
export async function etl2UpdateTransformRule(ruleId, body) {
  return request('PUT', `/api/etl/transform-rules/${encodeURIComponent(ruleId)}`, body);
}

/** DELETE /api/etl/transform-rules/:id - 변환 룰 삭제 */
export async function etl2DeleteTransformRule(ruleId) {
  return request('DELETE', `/api/etl/transform-rules/${encodeURIComponent(ruleId)}`);
}

/** GET /api/etl/storage-connections - 저장 DB(적재 대상) 목록 */
export async function etl2ListStorageConnections() {
  return request('GET', '/api/etl/storage-connections');
}

/** POST /api/etl/storage-connections - 저장 DB 1건 등록 */
export async function etl2CreateStorageConnection(body) {
  return request('POST', '/api/etl/storage-connections', body);
}

/** PATCH /api/etl/storage-connections/:id */
export async function etl2UpdateStorageConnection(storageConnectionId, body) {
  return request('PATCH', `/api/etl/storage-connections/${encodeURIComponent(storageConnectionId)}`, body);
}

/** DELETE /api/etl/storage-connections/:id */
export async function etl2DeleteStorageConnection(storageConnectionId) {
  return request('DELETE', `/api/etl/storage-connections/${encodeURIComponent(storageConnectionId)}`);
}

/** POST /api/etl/storage-connections/test - 저장 DB 연결 테스트(접속+권한) */
export async function etl2TestStorageConnection(body) {
  return request('POST', '/api/etl/storage-connections/test', body);
}

/** GET /api/etl/target-tables - Phase 3: 저장 DB(적재 대상) 테이블 목록. storage_connection_id 없으면 기본 DB */
export async function etl2ListTargetTables(storageConnectionId = null) {
  const params = new URLSearchParams();
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId));
  const q = params.toString() ? `?${params.toString()}` : '';
  return request('GET', `/api/etl/target-tables${q}`);
}

/** GET /api/etl/target-columns - Phase 3: 저장 DB 지정 테이블 컬럼 목록 */
export async function etl2ListTargetColumns(storageConnectionId, tableName) {
  const params = new URLSearchParams({ table_name: tableName });
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId));
  return request('GET', `/api/etl/target-columns?${params.toString()}`);
}

// ---------- ETL Batch (09_ETL_SFTP_Connection, /api/etl/batch) ----------

/** GET /api/etl/batch/folder-connections - 폴더 연결 목록 */
export async function batchListFolderConnections() {
  return request('GET', '/api/etl/batch/folder-connections');
}

/** POST /api/etl/batch/folder-connections - 폴더 연결 등록 */
export async function batchCreateFolderConnection(body) {
  return request('POST', '/api/etl/batch/folder-connections', body);
}

/** PATCH /api/etl/batch/folder-connections/:id */
export async function batchUpdateFolderConnection(id, body) {
  return request('PATCH', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}`, body);
}

/** DELETE /api/etl/batch/folder-connections/:id */
export async function batchDeleteFolderConnection(id) {
  return request('DELETE', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}`);
}

/** POST /api/etl/batch/folder-connections/test - 연결 테스트 */
export async function batchTestFolderConnection(body) {
  return request('POST', '/api/etl/batch/folder-connections/test', body);
}

/** GET /api/etl/batch/folder-connections/:id/files - 폴더 내 파일 목록 */
export async function batchListFolderFiles(id) {
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/files`);
}

/** GET /api/etl/batch/folder-connections/:id/patterns - 폴더 내 파일 패턴 목록. 반환: { patterns: [{ pattern, file_count, latest_ts, oldest_ts, extensions }] } */
export async function batchListFolderPatterns(id) {
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/patterns`);
}

/** GET /api/etl/batch/folder-connections/:id/columns?file_pattern=xxx - 패턴 일치 파일 중 가장 오래된 1건의 컬럼명 목록. 반환: { columns: string[] } */
export async function batchGetFolderColumns(id, filePattern) {
  const params = new URLSearchParams();
  params.set('file_pattern', filePattern || '');
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/columns?${params.toString()}`);
}

/** GET /api/etl/batch/target-tables?storage_connection_id= - 저장 DB 테이블 목록. 반환: { tables: [{ table_name }] } */
export async function batchListTargetTables(storageConnectionId = null) {
  const params = new URLSearchParams();
  if (storageConnectionId != null) params.set('storage_connection_id', String(storageConnectionId));
  const qs = params.toString();
  return request('GET', `/api/etl/batch/target-tables${qs ? '?' + qs : ''}`);
}

/** POST /api/etl/batch/jobs/validate-target - 기존 테이블 적재 가능 여부 검증. 반환: { valid: boolean, message: string } */
export async function batchValidateTarget(body) {
  return request('POST', '/api/etl/batch/jobs/validate-target', body);
}

/** GET /api/etl/batch/target-registry - ETL 목록용 배치 타겟 등록 목록 (batch_job_id NULL 포함) */
export async function etl2ListBatchTargetRegistry() {
  return request('GET', '/api/etl/batch/target-registry');
}

/** DELETE /api/etl/batch/target-registry/:id - 배치 유래 행 삭제 + 타겟 테이블 DROP */
export async function etl2DeleteBatchTargetRegistry(registryId) {
  return request('DELETE', `/api/etl/batch/target-registry/${encodeURIComponent(registryId)}`);
}

/** GET /api/etl/batch/jobs - 배치 Job 목록. folderConnectionId, isActive, jobType 쿼리 선택 */
export async function batchListJobs(folderConnectionId = null, isActive = null, jobType = null) {
  const params = new URLSearchParams();
  if (folderConnectionId != null) params.set('folder_connection_id', String(folderConnectionId));
  if (isActive != null) params.set('is_active', isActive === true ? 'true' : 'false');
  if (jobType != null && String(jobType).trim()) params.set('job_type', String(jobType).trim());
  const qs = params.toString();
  return request('GET', `/api/etl/batch/jobs${qs ? '?' + qs : ''}`);
}

/** GET /api/etl/batch/jobs/:id/db-preview - DB 배치 Job 소스 테이블 10행 미리보기 */
export async function batchGetJobDbPreview(batchJobId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/db-preview`);
}

/** POST /api/etl/batch/jobs - 배치 Job 등록 */
export async function batchCreateJob(body) {
  return request('POST', '/api/etl/batch/jobs', body);
}

/** POST /api/etl/batch/jobs/from-etl-table - ETL 테이블 기반 DB 배치 등록 */
export async function batchCreateJobFromEtlTable(body) {
  return request('POST', '/api/etl/batch/jobs/from-etl-table', body);
}

/** PATCH /api/etl/batch/jobs/:id - 배치 Job 수정 */
export async function batchUpdateJob(id, body) {
  return request('PATCH', `/api/etl/batch/jobs/${encodeURIComponent(id)}`, body);
}

/** DELETE /api/etl/batch/jobs/:id - 배치 Job 삭제 */
export async function batchDeleteJob(id) {
  return request('DELETE', `/api/etl/batch/jobs/${encodeURIComponent(id)}`);
}

/** POST /api/etl/batch/jobs/:id/run-now - 배치 Job 즉시 실행 */
export async function batchRunJobNow(id) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(id)}/run-now`);
}

/** POST /api/etl/batch/jobs/:id/toggle - 배치 Job 활성/비활성 토글 */
export async function batchToggleJob(id) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(id)}/toggle`);
}

/** GET /api/etl/batch/jobs/:id/history - 배치 Job 실행 이력 목록 */
export async function batchListJobHistory(id) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(id)}/history`);
}

/** GET /api/etl/batch/jobs/:id/history/:runId - 배치 Job 실행 이력 상세 */
export async function batchGetJobHistoryDetail(id, runId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(id)}/history/${encodeURIComponent(runId)}`);
}

/** POST /api/etl/batch/jobs/:id/history/:runId/cancel - 실행 취소 요청(진행 중 롤백) */
export async function batchCancelRun(batchJobId, runId) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/history/${encodeURIComponent(runId)}/cancel`);
}

/** GET /api/etl/batch/jobs/:id/skipped-files - 스킵/에러 파일 목록 */
export async function batchListSkippedFiles(batchJobId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files`);
}

/** GET /api/etl/batch/jobs/:id/skipped-files/history - 스킵/에러 파일 전체 이력 */
export async function batchListSkippedFilesHistory(batchJobId, limit = 200) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files/history?limit=${encodeURIComponent(limit)}`);
}

/** POST /api/etl/batch/jobs/:id/skipped-files/delete - 원격 문제 파일 삭제 */
export async function batchDeleteSkippedFiles(batchJobId, filenames) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files/delete`, { filenames });
}

/** POST /api/etl/batch/jobs/:id/rollback-file - 해당 파일 적재 데이터만 타겟 테이블에서 DELETE (PK 기반) */
export async function batchRollbackFile(batchJobId, body) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/rollback-file`, body);
}
