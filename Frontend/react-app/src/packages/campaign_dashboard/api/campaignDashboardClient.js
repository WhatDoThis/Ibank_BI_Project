/**
 * campaign_dashboard/api/campaignDashboardClient.js (캠페인 대시보드 API)
 * ======================================================================
 * /api/campaign-dashboard/* — ibank_*_star_1 팩트 테이블.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (fetchOkJson)
 */

import { fetchOkJson } from '@/shared/api/http.js'

export async function getCampaignDashboardTables() {
  return fetchOkJson('/api/campaign-dashboard/tables', '캠페인 대시보드 테이블 목록 조회 실패')
}

export async function getCampaignDashboardSummary(tableId, targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/campaign-dashboard/summary?${params}`, '캠페인 대시보드 요약 조회 실패')
}

export async function getCampaignDashboardTrend(tableId, { endDate = null, days = 30, metric = 'success_count' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, days: String(days), metric })
  if (endDate) params.set('end_date', endDate)
  return fetchOkJson(`/api/campaign-dashboard/trend?${params}`, '캠페인 대시보드 추이 조회 실패')
}

export async function getCampaignDashboardTrendMulti(tableId, { endDate = null, period = 'daily', days = 10, count = 10, byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, days: String(days), count: String(count) })
  if (endDate) params.set('end_date', endDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/campaign-dashboard/trend-multi?${params}`, '캠페인 대시보드 복수 추이 조회 실패')
}

export async function getCampaignDashboardMemberSummary(tableId, { targetDate = null, period = 'daily' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/campaign-dashboard/member-summary?${params}`, '캠페인 대시보드 회원 현황 조회 실패')
}

export async function getCampaignDashboardDeliveryDemographics(tableId, { targetDate = null, period = 'daily', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/campaign-dashboard/delivery-demographics?${params}`, '캠페인 대시보드 발송 인구통계 조회 실패')
}

export async function getCampaignDashboardHourly(tableId, { targetDate = null, period = 'daily', metric = 'success', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, metric })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  return fetchOkJson(`/api/campaign-dashboard/hourly?${params}`, '캠페인 대시보드 시간대별 조회 실패')
}
