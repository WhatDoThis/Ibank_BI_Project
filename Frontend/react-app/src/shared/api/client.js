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

// ---------- ETL (Phase 5 UI) ----------

function baseUrlForEtl() {
  return getApiBase().replace(/\/$/, '');
}

/** GET /api/etl/tables - ETL 테이블 목록 */
export async function etlListTables() {
  return request('GET', '/api/etl/tables');
}

/** POST /api/etl/tables - ETL 테이블 1건 등록 */
export async function etlCreateTable(body) {
  return request('POST', '/api/etl/tables', body);
}

/** POST /api/etl/upload - 파일 업로드 (multipart). file: File, target_table?, description?, created_by? */
export async function etlUploadFile(formData) {
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

/** DELETE /api/etl/tables/:id - ETL 테이블 1건 삭제 (타겟 테이블 DROP, 업로드 파일 삭제) */
export async function etlDeleteTable(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}`);
}

/** PATCH /api/etl/tables/:id - ETL 테이블 설정 일부 갱신 (pk_columns 등) */
export async function etlUpdateTable(etlTableId, body) {
  return request('PATCH', `/api/etl/tables/${encodeURIComponent(etlTableId)}`, body);
}

/** DELETE /api/etl/tables/:id/row - ETL 등록 행만 삭제(메인 DB 테이블 유지, 업로드 파일·해당 행 삭제) */
export async function etlDeleteTableRow(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}/row`);
}

/** GET /api/etl/tables/:id/preview - 미리보기: 컬럼 저장 가능 여부 + 10행 */
export async function etlPreviewTable(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/preview`);
}

/** GET /api/etl/tables/:id/target-exists - 타겟 테이블이 메인 DB에 존재하는지. 실행 전 컨펌용 */
export async function etlTargetExists(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/target-exists`);
}

/** POST /api/etl/tables/:id/run - ETL 테이블 1건 대기열 등록 (Phase 6). 반환 job_id로 폴링 */
export async function etlRunTable(etlTableId) {
  return request('POST', `/api/etl/tables/${encodeURIComponent(etlTableId)}/run`);
}

/** POST /api/etl/tables/:id/add-file - 동일 테이블에 추가 적재(업서트). file: File. 반환 job_id 등 */
export async function etlAddFileToTable(etlTableId, file) {
  const url = `${baseUrlForEtl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-file`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** POST /api/etl/tables/:id/add-files-zip - ZIP으로 여러 파일 추가 적재. file: File (.zip). 반환 job_ids, skipped_files 등 */
export async function etlAddFilesZipToTable(etlTableId, file) {
  const url = `${baseUrlForEtl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-files-zip`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** GET /api/etl/jobs - Job 목록. statuses=completed,failed 등 쉼표 구분 시 해당 상태만 */
export async function etlListJobs(etlTableId = null, statuses = null) {
  const params = new URLSearchParams({ limit: '500' });
  if (etlTableId != null) params.set('etl_table_id', String(etlTableId));
  if (statuses != null && statuses !== '') params.set('statuses', statuses);
  return request('GET', `/api/etl/jobs?${params.toString()}`);
}

/** GET /api/etl/jobs/:job_id - Job 1건 조회 (폴링용). target_table, started_at 포함 */
export async function etlGetJob(jobId) {
  return request('GET', `/api/etl/jobs/${encodeURIComponent(jobId)}`);
}

/** POST /api/etl/jobs/:job_id/cancel - 실행 중·대기 중 Job 취소 */
export async function etlCancelJob(jobId) {
  return request('POST', `/api/etl/jobs/${encodeURIComponent(jobId)}/cancel`);
}

/** DELETE /api/etl/jobs/:job_id - Job 1건 삭제 (etl_jobs에서 삭제) */
export async function etlDeleteJob(jobId) {
  return request('DELETE', `/api/etl/jobs/${encodeURIComponent(jobId)}`);
}

/** DELETE /api/etl/connections/:id - 연결 해제 (해당 연결의 타겟 테이블 DROP 후 연결 삭제) */
export async function etlDeleteConnection(connectionId) {
  return request('DELETE', `/api/etl/connections/${encodeURIComponent(connectionId)}`);
}

/** GET /api/etl/connections - 연결 목록 */
export async function etlListConnections() {
  return request('GET', '/api/etl/connections');
}

/** POST /api/etl/connections - 연결 1건 등록 */
export async function etlCreateConnection(body) {
  return request('POST', '/api/etl/connections', body);
}

/** POST /api/etl/connections/test - 연결 테스트 (connection_id 또는 host/database_name/username/password) */
export async function etlTestConnection(body) {
  return request('POST', '/api/etl/connections/test', body);
}

/** GET /api/etl/connections/:id/tables - 소스 DB 테이블 목록 */
export async function etlListConnectionTables(connectionId) {
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/tables`);
}

/** GET /api/etl/tables/:id/transform-rules - 변환 룰 목록 */
export async function etlListTransformRules(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/transform-rules`);
}

// ---------- ETL2 (09_ETL_Upgrade_Plan 페이지용, /api/etl2) ----------

function baseUrlForEtl2() {
  return getApiBase().replace(/\/$/, '');
}

/** GET /api/etl2/tables - ETL2 테이블 목록 */
export async function etl2ListTables() {
  return request('GET', '/api/etl2/tables');
}

/** POST /api/etl2/tables - ETL2 테이블 1건 등록 */
export async function etl2CreateTable(body) {
  return request('POST', '/api/etl2/tables', body);
}

/** POST /api/etl2/upload - 파일 업로드 (multipart) */
export async function etl2UploadFile(formData) {
  const url = `${baseUrlForEtl2()}/api/etl2/upload`;
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

/** DELETE /api/etl2/tables/:id */
export async function etl2DeleteTable(etlTableId) {
  return request('DELETE', `/api/etl2/tables/${encodeURIComponent(etlTableId)}`);
}

/** PATCH /api/etl2/tables/:id */
export async function etl2UpdateTable(etlTableId, body) {
  return request('PATCH', `/api/etl2/tables/${encodeURIComponent(etlTableId)}`, body);
}

/** DELETE /api/etl2/tables/:id/row */
export async function etl2DeleteTableRow(etlTableId) {
  return request('DELETE', `/api/etl2/tables/${encodeURIComponent(etlTableId)}/row`);
}

/** GET /api/etl2/tables/:id/preview */
export async function etl2PreviewTable(etlTableId) {
  return request('GET', `/api/etl2/tables/${encodeURIComponent(etlTableId)}/preview`);
}

/** GET /api/etl2/tables/:id/target-exists */
export async function etl2TargetExists(etlTableId) {
  return request('GET', `/api/etl2/tables/${encodeURIComponent(etlTableId)}/target-exists`);
}

/** POST /api/etl2/tables/:id/run */
export async function etl2RunTable(etlTableId) {
  return request('POST', `/api/etl2/tables/${encodeURIComponent(etlTableId)}/run`);
}

/** POST /api/etl2/tables/:id/add-file */
export async function etl2AddFileToTable(etlTableId, file) {
  const url = `${baseUrlForEtl2()}/api/etl2/tables/${encodeURIComponent(etlTableId)}/add-file`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** POST /api/etl2/tables/:id/add-files-zip */
export async function etl2AddFilesZipToTable(etlTableId, file) {
  const url = `${baseUrlForEtl2()}/api/etl2/tables/${encodeURIComponent(etlTableId)}/add-files-zip`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

/** GET /api/etl2/jobs */
export async function etl2ListJobs(etlTableId = null, statuses = null) {
  const params = new URLSearchParams({ limit: '500' });
  if (etlTableId != null) params.set('etl_table_id', String(etlTableId));
  if (statuses != null && statuses !== '') params.set('statuses', statuses);
  return request('GET', `/api/etl2/jobs?${params.toString()}`);
}

/** GET /api/etl2/jobs/:job_id */
export async function etl2GetJob(jobId) {
  return request('GET', `/api/etl2/jobs/${encodeURIComponent(jobId)}`);
}

/** POST /api/etl2/jobs/:job_id/cancel */
export async function etl2CancelJob(jobId) {
  return request('POST', `/api/etl2/jobs/${encodeURIComponent(jobId)}/cancel`);
}

/** DELETE /api/etl2/jobs/:job_id */
export async function etl2DeleteJob(jobId) {
  return request('DELETE', `/api/etl2/jobs/${encodeURIComponent(jobId)}`);
}

/** DELETE /api/etl2/connections/:id */
export async function etl2DeleteConnection(connectionId) {
  return request('DELETE', `/api/etl2/connections/${encodeURIComponent(connectionId)}`);
}

/** GET /api/etl2/connections */
export async function etl2ListConnections() {
  return request('GET', '/api/etl2/connections');
}

/** POST /api/etl2/connections */
export async function etl2CreateConnection(body) {
  return request('POST', '/api/etl2/connections', body);
}

/** POST /api/etl2/connections/test */
export async function etl2TestConnection(body) {
  return request('POST', '/api/etl2/connections/test', body);
}

/** GET /api/etl2/connections/:id/tables */
export async function etl2ListConnectionTables(connectionId) {
  return request('GET', `/api/etl2/connections/${encodeURIComponent(connectionId)}/tables`);
}

/** GET /api/etl2/connections/:id/source-columns - 소스 테이블 컬럼 목록(증분 컬럼 셀렉트용) */
export async function etl2GetSourceColumns(connectionId, sourceTable) {
  const params = new URLSearchParams({ source_table: sourceTable });
  return request('GET', `/api/etl2/connections/${encodeURIComponent(connectionId)}/source-columns?${params.toString()}`);
}

/** POST /api/etl2/connections/:id/validate-incremental-column - 증분 컬럼 날짜 검증(커스텀 입력 시) */
export async function etl2ValidateIncrementalColumn(connectionId, sourceTable, columnName) {
  return request('POST', `/api/etl2/connections/${encodeURIComponent(connectionId)}/validate-incremental-column`, {
    source_table: sourceTable,
    column_name: columnName
  });
}

/** GET /api/etl2/tables/:id/transform-rules */
export async function etl2ListTransformRules(etlTableId) {
  return request('GET', `/api/etl2/tables/${encodeURIComponent(etlTableId)}/transform-rules`);
}

/** GET /api/etl2/storage-connections - 저장 DB(적재 대상) 목록 */
export async function etl2ListStorageConnections() {
  return request('GET', '/api/etl2/storage-connections');
}

/** POST /api/etl2/storage-connections - 저장 DB 1건 등록 */
export async function etl2CreateStorageConnection(body) {
  return request('POST', '/api/etl2/storage-connections', body);
}

/** PATCH /api/etl2/storage-connections/:id */
export async function etl2UpdateStorageConnection(storageConnectionId, body) {
  return request('PATCH', `/api/etl2/storage-connections/${encodeURIComponent(storageConnectionId)}`, body);
}

/** DELETE /api/etl2/storage-connections/:id */
export async function etl2DeleteStorageConnection(storageConnectionId) {
  return request('DELETE', `/api/etl2/storage-connections/${encodeURIComponent(storageConnectionId)}`);
}

/** POST /api/etl2/storage-connections/test - 저장 DB 연결 테스트(접속+권한) */
export async function etl2TestStorageConnection(body) {
  return request('POST', '/api/etl2/storage-connections/test', body);
}

/** GET /api/etl2/target-tables - Phase 3: 저장 DB(적재 대상) 테이블 목록. storage_connection_id 없으면 기본 DB */
export async function etl2ListTargetTables(storageConnectionId = null) {
  const params = new URLSearchParams();
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId));
  const q = params.toString() ? `?${params.toString()}` : '';
  return request('GET', `/api/etl2/target-tables${q}`);
}

/** GET /api/etl2/target-columns - Phase 3: 저장 DB 지정 테이블 컬럼 목록 */
export async function etl2ListTargetColumns(storageConnectionId, tableName) {
  const params = new URLSearchParams({ table_name: tableName });
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId));
  return request('GET', `/api/etl2/target-columns?${params.toString()}`);
}
