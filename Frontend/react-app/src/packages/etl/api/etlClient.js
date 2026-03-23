/**
 * etl/api/etlClient.js (ETL·배치 API)
 * ===================================
 * /api/etl, /api/etl/batch 단일 ETL·폴더 배치 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (request, apiBaseUrl, formatFetchErrorMessage)
 */

import { request, apiBaseUrl, formatFetchErrorMessage } from '@/shared/api/http.js'

const UPLOAD_FETCH_TIMEOUT_MS = 5 * 60 * 1000

async function fetchUploadWithTimeout(url, formData) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'POST', body: formData, signal: controller.signal })
    clearTimeout(timeoutId)
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    const msg = err?.message || ''
    if (err?.name === 'AbortError' || msg.includes('aborted')) {
      throw new Error('업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 네트워크를 확인하세요.')
    }
    if (msg === 'Failed to fetch' || msg.includes('Load failed') || msg.includes('NetworkError')) {
      throw new Error('API 서버에 연결할 수 없습니다. 백엔드(python run.py back)가 실행 중인지, 주소가 맞는지 확인하세요.')
    }
    throw err
  }
}

export async function etl2ListTables() {
  return request('GET', '/api/etl/tables')
}

export async function etl2CreateTable(body) {
  return request('POST', '/api/etl/tables', body)
}

export async function etl2UploadFile(formData) {
  const url = `${apiBaseUrl()}/api/etl/upload`
  const res = await fetch(url, { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = formatFetchErrorMessage(data, res)
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function etl2InferSchema(file) {
  const url = `${apiBaseUrl()}/api/etl/infer-schema`
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(url, { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.detail != null ? String(data.detail) : (data.error || data.message || `HTTP ${res.status}`)
    throw new Error(msg)
  }
  return data
}

export async function etl2DeleteTable(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}`)
}

export async function etl2UpdateTable(etlTableId, body) {
  return request('PATCH', `/api/etl/tables/${encodeURIComponent(etlTableId)}`, body)
}

export async function etl2RefreshColumnMapping(etlTableId) {
  return request('POST', `/api/etl/tables/${encodeURIComponent(etlTableId)}/refresh-column-mapping`)
}

export async function etl2DeleteTableRow(etlTableId) {
  return request('DELETE', `/api/etl/tables/${encodeURIComponent(etlTableId)}/row`)
}

export async function etl2PreviewTable(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/preview`)
}

export async function etl2TransformPreview(body) {
  return request('POST', '/api/etl/transform/preview', body)
}

export async function etl2TargetExists(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/target-exists`)
}

export async function etl2RunTable(etlTableId) {
  return request('POST', `/api/etl/tables/${encodeURIComponent(etlTableId)}/run`)
}

export async function etl2AddFileToTable(etlTableId, file) {
  const url = `${apiBaseUrl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-file`
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetchUploadWithTimeout(url, formData)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)
  return data
}

export async function etl2AddFilesZipToTable(etlTableId, file) {
  const url = `${apiBaseUrl()}/api/etl/tables/${encodeURIComponent(etlTableId)}/add-files-zip`
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetchUploadWithTimeout(url, formData)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)
  return data
}

export async function etl2ListJobs(etlTableId = null, statuses = null) {
  const params = new URLSearchParams({ limit: '500' })
  if (etlTableId != null) params.set('etl_table_id', String(etlTableId))
  if (statuses != null && statuses !== '') params.set('statuses', statuses)
  return request('GET', `/api/etl/jobs?${params.toString()}`)
}

export async function etl2GetJob(jobId) {
  return request('GET', `/api/etl/jobs/${encodeURIComponent(jobId)}`)
}

export async function etl2CancelJob(jobId) {
  return request('POST', `/api/etl/jobs/${encodeURIComponent(jobId)}/cancel`)
}

export async function etl2DeleteJob(jobId) {
  return request('DELETE', `/api/etl/jobs/${encodeURIComponent(jobId)}`)
}

export async function etl2DeleteConnection(connectionId) {
  return request('DELETE', `/api/etl/connections/${encodeURIComponent(connectionId)}`)
}

export async function etl2ListTimezones() {
  return request('GET', '/api/etl/timezones')
}

export async function etl2ListConnections() {
  return request('GET', '/api/etl/connections')
}

export async function etl2CreateConnection(body) {
  return request('POST', '/api/etl/connections', body)
}

export async function etl2TestConnection(body) {
  return request('POST', '/api/etl/connections/test', body)
}

export async function etl2ListConnectionTables(connectionId) {
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/tables`)
}

export async function etl2GetSourceColumns(connectionId, sourceTable) {
  const params = new URLSearchParams({ source_table: sourceTable })
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/source-columns?${params.toString()}`)
}

export async function etl2GetSourceIndexes(connectionId, sourceTable) {
  const params = new URLSearchParams({ source_table: sourceTable })
  return request('GET', `/api/etl/connections/${encodeURIComponent(connectionId)}/source-indexes?${params.toString()}`)
}

export async function etl2ValidateIncrementalColumn(connectionId, sourceTable, columnName) {
  return request('POST', `/api/etl/connections/${encodeURIComponent(connectionId)}/validate-incremental-column`, {
    source_table: sourceTable,
    column_name: columnName,
  })
}

export async function etl2ListTransformRules(etlTableId) {
  return request('GET', `/api/etl/tables/${encodeURIComponent(etlTableId)}/transform-rules`)
}

export async function etl2CreateTransformRule(body) {
  return request('POST', '/api/etl/transform-rules', body)
}

export async function etl2UpdateTransformRule(ruleId, body) {
  return request('PUT', `/api/etl/transform-rules/${encodeURIComponent(ruleId)}`, body)
}

export async function etl2DeleteTransformRule(ruleId) {
  return request('DELETE', `/api/etl/transform-rules/${encodeURIComponent(ruleId)}`)
}

export async function etl2ListStorageConnections() {
  return request('GET', '/api/etl/storage-connections')
}

export async function etl2CreateStorageConnection(body) {
  return request('POST', '/api/etl/storage-connections', body)
}

export async function etl2UpdateStorageConnection(storageConnectionId, body) {
  return request('PATCH', `/api/etl/storage-connections/${encodeURIComponent(storageConnectionId)}`, body)
}

export async function etl2DeleteStorageConnection(storageConnectionId) {
  return request('DELETE', `/api/etl/storage-connections/${encodeURIComponent(storageConnectionId)}`)
}

export async function etl2TestStorageConnection(body) {
  return request('POST', '/api/etl/storage-connections/test', body)
}

export async function etl2ListTargetTables(storageConnectionId = null) {
  const params = new URLSearchParams()
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId))
  const q = params.toString() ? `?${params.toString()}` : ''
  return request('GET', `/api/etl/target-tables${q}`)
}

export async function etl2ListTargetColumns(storageConnectionId, tableName) {
  const params = new URLSearchParams({ table_name: tableName })
  if (storageConnectionId != null && storageConnectionId !== '') params.set('storage_connection_id', String(storageConnectionId))
  return request('GET', `/api/etl/target-columns?${params.toString()}`)
}

export async function batchListFolderConnections() {
  return request('GET', '/api/etl/batch/folder-connections')
}

export async function batchCreateFolderConnection(body) {
  return request('POST', '/api/etl/batch/folder-connections', body)
}

export async function batchUpdateFolderConnection(id, body) {
  return request('PATCH', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}`, body)
}

export async function batchDeleteFolderConnection(id) {
  return request('DELETE', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}`)
}

export async function batchTestFolderConnection(body) {
  return request('POST', '/api/etl/batch/folder-connections/test', body)
}

export async function batchListFolderFiles(id) {
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/files`)
}

export async function batchListFolderPatterns(id) {
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/patterns`)
}

export async function batchGetFolderColumns(id, filePattern) {
  const params = new URLSearchParams()
  params.set('file_pattern', filePattern || '')
  return request('GET', `/api/etl/batch/folder-connections/${encodeURIComponent(id)}/columns?${params.toString()}`)
}

export async function batchListTargetTables(storageConnectionId = null) {
  const params = new URLSearchParams()
  if (storageConnectionId != null) params.set('storage_connection_id', String(storageConnectionId))
  const qs = params.toString()
  return request('GET', `/api/etl/batch/target-tables${qs ? '?' + qs : ''}`)
}

export async function batchValidateTarget(body) {
  return request('POST', '/api/etl/batch/jobs/validate-target', body)
}

export async function etl2ListBatchTargetRegistry() {
  return request('GET', '/api/etl/batch/target-registry')
}

export async function etl2DeleteBatchTargetRegistry(registryId) {
  return request('DELETE', `/api/etl/batch/target-registry/${encodeURIComponent(registryId)}`)
}

export async function batchListJobs(folderConnectionId = null, isActive = null, jobType = null) {
  const params = new URLSearchParams()
  if (folderConnectionId != null) params.set('folder_connection_id', String(folderConnectionId))
  if (isActive != null) params.set('is_active', isActive === true ? 'true' : 'false')
  if (jobType != null && String(jobType).trim()) params.set('job_type', String(jobType).trim())
  const qs = params.toString()
  return request('GET', `/api/etl/batch/jobs${qs ? '?' + qs : ''}`)
}

export async function batchGetJobDbPreview(batchJobId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/db-preview`)
}

export async function batchCreateJob(body) {
  return request('POST', '/api/etl/batch/jobs', body)
}

export async function batchCreateJobFromEtlTable(body) {
  return request('POST', '/api/etl/batch/jobs/from-etl-table', body)
}

export async function batchUpdateJob(id, body) {
  return request('PATCH', `/api/etl/batch/jobs/${encodeURIComponent(id)}`, body)
}

export async function batchDeleteJob(id) {
  return request('DELETE', `/api/etl/batch/jobs/${encodeURIComponent(id)}`)
}

export async function batchRunJobNow(id) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(id)}/run-now`)
}

export async function batchToggleJob(id) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(id)}/toggle`)
}

export async function batchListJobHistory(id) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(id)}/history`)
}

export async function batchGetJobHistoryDetail(id, runId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(id)}/history/${encodeURIComponent(runId)}`)
}

export async function batchCancelRun(batchJobId, runId) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/history/${encodeURIComponent(runId)}/cancel`)
}

export async function batchListSkippedFiles(batchJobId) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files`)
}

export async function batchListSkippedFilesHistory(batchJobId, limit = 200) {
  return request('GET', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files/history?limit=${encodeURIComponent(limit)}`)
}

export async function batchDeleteSkippedFiles(batchJobId, filenames) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/skipped-files/delete`, { filenames })
}

export async function batchRollbackFile(batchJobId, body) {
  return request('POST', `/api/etl/batch/jobs/${encodeURIComponent(batchJobId)}/rollback-file`, body)
}
