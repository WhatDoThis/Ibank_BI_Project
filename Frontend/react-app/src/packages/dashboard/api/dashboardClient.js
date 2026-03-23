/**
 * dashboard/api/dashboardClient.js (대시보드1 API)
 * ================================================
 * /api/dashboard/* 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (request)
 */

import { request } from '@/shared/api/http.js'

export async function getDashboardData(body) {
  return request('POST', '/api/dashboard/data', body)
}

export async function getDashboardFilterOptions(tableId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.campaign_ids?.length) params.set('campaign_ids', filters.campaign_ids.join(','))
  if (filters.workflow_ids?.length) params.set('workflow_ids', filters.workflow_ids.join(','))
  if (filters.channels?.length) params.set('channels', filters.channels.join(','))
  const qs = params.toString()
  const path = `/api/dashboard/filter-options/${encodeURIComponent(tableId)}${qs ? '?' + qs : ''}`
  return request('GET', path)
}

export async function getDashboardTables() {
  return request('GET', '/api/dashboard/tables')
}

export async function getDashboardRequiredColumns() {
  return request('GET', '/api/dashboard/required-columns')
}

export async function getChartData(body) {
  return request('POST', '/api/dashboard/chart-data', body)
}
