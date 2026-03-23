/**
 * dashboard2/api/dashboard2Client.js (대시보드2 API)
 * ===================================================
 * /api/dashboard2/* 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (request)
 */

import { request } from '@/shared/api/http.js'

export async function getDashboard2Tables() {
  return request('GET', '/api/dashboard2/tables')
}

export async function getDashboard2FilterOptions(tableId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.campaign_ids?.length) params.set('campaign_ids', filters.campaign_ids.join(','))
  if (filters.workflow_ids?.length) params.set('workflow_ids', filters.workflow_ids.join(','))
  if (filters.channels?.length) params.set('channels', filters.channels.join(','))
  const qs = params.toString()
  const path = `/api/dashboard2/filter-options/${encodeURIComponent(tableId)}${qs ? '?' + qs : ''}`
  return request('GET', path)
}

export async function getDashboard2Data(body) {
  return request('POST', '/api/dashboard2/data', body)
}

export async function getDashboard2RequiredColumns() {
  return request('GET', '/api/dashboard2/required-columns')
}

export async function getDashboard2ChartData(body) {
  return request('POST', '/api/dashboard2/chart-data', body)
}
