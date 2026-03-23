/**
 * new-dashboard2/api/newDashboard2Client.js (마케팅 대시보드 API)
 * ================================================================
 * /api/new-dashboard2/* 전용.
 *
 * [Dependencies]
 * =========
 * - shared/api/http (fetchOkJson)
 */

import { fetchOkJson } from '@/shared/api/http.js'

export async function getNewDash2Overview(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/overview?${params}`, 'Overview 조회 실패')
}

export async function getNewDash2Star(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/star?${params}`, 'Star 조회 실패')
}

export async function getNewDash2Frequency(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/frequency?${params}`, 'Frequency 조회 실패')
}

export async function getNewDash2Coupon(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/coupon?${params}`, 'Coupon 조회 실패')
}

export async function getNewDash2CampaignSegments(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/campaign-segments?${params}`, 'Campaign segments 조회 실패')
}

export async function getNewDash2Store(targetDate = null, period = 'daily') {
  const params = new URLSearchParams({ period })
  if (targetDate) params.set('target_date', targetDate)
  return fetchOkJson(`/api/new-dashboard2/store?${params}`, 'Store 조회 실패')
}

export async function getNewDash2Trend(tableName, metrics, { endDate = null, days = 30, period = 'daily', count = 12 } = {}) {
  const params = new URLSearchParams({ table_name: tableName, metrics, days: String(days), period, count: String(count) })
  if (endDate) params.set('end_date', endDate)
  return fetchOkJson(`/api/new-dashboard2/trend?${params}`, 'Trend 조회 실패')
}

export async function getNewDash2ProductMaster() {
  return fetchOkJson('/api/new-dashboard2/product-master', 'Product master 조회 실패')
}
