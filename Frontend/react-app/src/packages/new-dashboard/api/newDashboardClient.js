/**
 * new-dashboard/api/newDashboardClient.js (뉴 대시보드 API)
 * ==========================================================
 * /api/new-dashboard/* 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (fetchOkJson)
 */

import { fetchOkJson } from '@/shared/api/http.js'

export async function getNewDashboardTables() {
  return fetchOkJson('/api/new-dashboard/tables', '테이블 목록 조회 실패')
}

export async function getNewDashboardSummary(tableId, targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard/summary?${params}`, '요약 조회 실패')
}

export async function getNewDashboardTrend(tableId, { endDate = null, days = 30, metric = 'success_count' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, days: String(days), metric })
  if (endDate) params.set('end_date', endDate)
  return fetchOkJson(`/api/new-dashboard/trend?${params}`, '추이 조회 실패')
}

export async function getNewDashboardTrendMulti(tableId, { endDate = null, period = 'daily', days = 10, count = 10, byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, days: String(days), count: String(count) })
  if (endDate) params.set('end_date', endDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/new-dashboard/trend-multi?${params}`, '추이(멀티) 조회 실패')
}

export async function getNewDashboardMemberSummary(tableId, { targetDate = null, period = 'daily' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard/member-summary?${params}`, '회원 현황 조회 실패')
}

export async function getNewDashboardDeliveryDemographics(tableId, { targetDate = null, period = 'daily', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/new-dashboard/delivery-demographics?${params}`, '발송 인구통계 조회 실패')
}

export async function getNewDashboardHourly(tableId, { targetDate = null, period = 'daily', metric = 'success', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, metric })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/new-dashboard/hourly?${params}`, '시간대별 조회 실패')
}
