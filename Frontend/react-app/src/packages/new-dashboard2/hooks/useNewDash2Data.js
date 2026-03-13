/**
 * useNewDash2Data (뉴 대시보드2 탭별 데이터 훅)
 * =============================================
 * targetDate, period, activeTab에 따라 해당 탭 데이터를 fetch.
 * overview: summary + trend 병합; overview 진입 시 fetchAllSummaries로 전 탭 요약 병렬 fetch.
 * star/frequency/coupon: 탭 데이터 + 추이(trend) 병렬 fetch 후 data.trend로 병합.
 *
 * [Main Functions]
 * 1. getPreviousTargetDate: 선택 기간의 직전 기간 target_date 반환
 * 2. fetchOverview: overview summary + trend 병합
 * 3. fetchAllSummaries: overview 진입 시 5개 탭 요약 병렬 fetch
 * 4. extractSummaryFromCache: 캐시에서 부문별 요약 추출
 * 5. isRetryableError: 500/502~504 재시도 여부
 * 6. useNewDash2Data → { data, loading, error, refresh, summaryData, summaryLoading, getCachedData }
 *
 * [Dependencies]
 * - @/shared/api/client: getNewDash2Overview, getNewDash2Trend, getNewDash2Star,
 *   getNewDash2Frequency, getNewDash2Coupon, getNewDash2CampaignSegments, getNewDash2Store
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getNewDash2Overview,
  getNewDash2Trend,
  getNewDash2Star,
  getNewDash2Frequency,
  getNewDash2Coupon,
  getNewDash2CampaignSegments,
  getNewDash2Store,
} from '@/shared/api/client'

// 1.
function getPreviousTargetDate(targetDate, period) {
  if (!targetDate || targetDate.length < 10) return null
  const d = new Date(targetDate.slice(0, 10) + 'T12:00:00')
  if (period === 'daily') {
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'weekly') {
    const weekday = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - weekday - 7)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'monthly') {
    d.setMonth(d.getMonth() - 1)
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }
  return null
}

// 2.
async function fetchOverview(targetDate, period) {
  const trendParams =
    period === 'daily'
      ? { endDate: targetDate, days: 30, period }
      : { endDate: targetDate, count: 12, period }
  const [summary, trend] = await Promise.all([
    getNewDash2Overview(targetDate, period),
    getNewDash2Trend('dashboard_overall', 'send_request_cnt,send_success_cnt,order_cnt,total_sales_cnt', trendParams),
  ])
  if (summary && !('prev_send_request_cnt' in summary) && !('prev_order_cnt' in summary)) {
    const prevDate = getPreviousTargetDate(targetDate, period)
    if (prevDate) {
      try {
        const prevSummary = await getNewDash2Overview(prevDate, period)
        if (prevSummary) {
          summary.prev_send_request_cnt = prevSummary.send_request_cnt ?? 0
          summary.prev_order_cnt = prevSummary.order_cnt ?? 0
        }
      } catch (_) {
        /* 이전 기간 조회 실패 시 전기 대비만 미표시 */
      }
    }
  }
  return { summary, trend }
}

// 3.
async function fetchAllSummaries(targetDate, period, cacheRef) {
  const k = (tab) => `${tab}-${targetDate}-${period}`
  const apis = [
    ['star', () => getNewDash2Star(targetDate, period)],
    ['frequency', () => getNewDash2Frequency(targetDate, period)],
    ['coupon', () => getNewDash2Coupon(targetDate, period)],
    ['campaign', () => getNewDash2CampaignSegments(targetDate, period)],
    ['store', () => getNewDash2Store(targetDate, period)],
  ]
  const results = await Promise.allSettled(apis.map(([, fn]) => fn()))
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value != null) {
      cacheRef.current[k(apis[i][0])] = result.value
    }
  })
}

const EMPTY_SUMMARY = { star: null, frequency: null, coupon: null, campaign: null, store: null }

// 4.
function extractSummaryFromCache(cache, targetDate, period) {
  const out = { ...EMPTY_SUMMARY }
  const k = (tab) => `${tab}-${targetDate}-${period}`

  const starData = cache[k('star')]
  if (starData != null) {
    out.star = {
      issueCnt: Number(starData.star_issue_cnt) ?? 0,
      giftCnt: Number(starData.star_send_cnt) ?? 0,
    }
  }

  const freqData = cache[k('frequency')]
  if (freqData != null) {
    const cnt = Number(freqData.frequency_complete_cnt) ?? 0
    out.frequency = {
      completeCnt: cnt,
    }
  }

  const campaignData = cache[k('campaign')]
  const couponData = cache[k('coupon')]
  if (couponData != null) {
    const issue = Number(couponData.coupon_issue_cnt) || 0
    const use = Number(couponData.coupon_use_cnt) || 0
    const couponOrders = Number(couponData.order_cnt) ?? 0
    let contributionRatio = null
    let estimatedCouponOrders = null
    let couponWorkflowCount = null
    let totalWorkflowCount = null
    if (campaignData?.segments?.length) {
      const segs = campaignData.segments
      const couponSegs = segs.filter((s) => (Number(s.coupon_use_cnt) || 0) > 0)
      const couponWfSuccess = couponSegs.reduce((sum, s) => sum + (Number(s.send_success_cnt) || 0), 0)
      const totalSuccess = segs.reduce((sum, s) => sum + (Number(s.send_success_cnt) || 0), 0)
      contributionRatio = totalSuccess > 0 ? couponWfSuccess / totalSuccess : 0
      const overallOrderCnt = Number(cache[k('overview')]?.summary?.order_cnt) || couponOrders
      estimatedCouponOrders = Math.round(overallOrderCnt * contributionRatio)
      couponWorkflowCount = couponSegs.length
      totalWorkflowCount = segs.length
    }
    out.coupon = {
      usageRate: issue > 0 ? (use / issue) * 100 : null,
      couponOrders,
      contributionRatio,
      estimatedCouponOrders,
      couponWorkflowCount,
      totalWorkflowCount,
    }
  }

  if (campaignData != null && Array.isArray(campaignData.segments) && campaignData.segments.length > 0) {
    const segs = campaignData.segments
    const sumRate = segs.reduce((acc, s) => {
      const req = Number(s.send_request_cnt) || 0
      const succ = Number(s.send_success_cnt) || 0
      return acc + (req > 0 ? (succ / req) * 100 : 0)
    }, 0)
    const totalOrders = segs.reduce((sum, s) => sum + (Number(s.order_cnt) || 0), 0)
    out.campaign = {
      activeCampaigns: segs.length,
      avgSuccessRate: sumRate / segs.length,
      totalOrders,
    }
  }

  const storeData = cache[k('store')]
  if (storeData != null) {
    const salesTopStore = storeData.first_total_sales?.store?.st_name ?? (Array.isArray(storeData.store_ranking?.store) && storeData.store_ranking.store[0]?.st_name) ?? null
    const couponUseTopStore = storeData.first_total_sales?.coupon_use_store?.st_name ?? null
    let totalSales = storeData.total_sales_cnt
    if (totalSales != null && Number(totalSales) >= 1e8) totalSales = `${(Number(totalSales) / 1e8).toFixed(0)}억`
    else if (totalSales != null) totalSales = `₩${Number(totalSales).toLocaleString()}`
    out.store = {
      totalSales: totalSales ?? null,
      salesTopStore,
      couponUseTopStore,
    }
  }

  return out
}

const MAX_RETRIES = 3

// 5.
function isRetryableError(err) {
  const status = err?.status
  return status === 500 || status === 502 || status === 503 || status === 504
}

// 6.
export function useNewDash2Data(targetDate, period, activeTab) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summaryData, setSummaryData] = useState(EMPTY_SUMMARY)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const cacheRef = useRef(Object.create(null))
  const prevTargetPeriodRef = useRef({ targetDate: '', period: '' })
  /** 요청 시점의 cacheKey. 탭/날짜 변경 시 새 요청이 이 값을 덮어써서, 이전 요청의 setState가 stale 응답으로 덮어쓰지 않도록 함 */
  const fetchRequestKeyRef = useRef(null)

  const cacheKey = `${activeTab}-${targetDate}-${period}`

  const getCachedData = useCallback(
    (tabName) => cacheRef.current[`${tabName}-${targetDate}-${period}`] ?? null,
    [targetDate, period]
  )

  const fetchTab = useCallback(async () => {
    if (prevTargetPeriodRef.current.targetDate !== targetDate || prevTargetPeriodRef.current.period !== period) {
      cacheRef.current = Object.create(null)
      prevTargetPeriodRef.current = { targetDate, period }
    }
    const key = cacheKey
    const myRequestKey = key
    fetchRequestKeyRef.current = myRequestKey

    if (activeTab === 'overview') {
      setSummaryLoading(true)
      const hadOverview = cacheRef.current[key] !== undefined
      try {
        if (hadOverview) {
          setData(cacheRef.current[key])
          setError(null)
          await fetchAllSummaries(targetDate, period, cacheRef)
          if (fetchRequestKeyRef.current !== myRequestKey) return
          setSummaryData(extractSummaryFromCache(cacheRef.current, targetDate, period))
        } else {
          setLoading(true)
          setError(null)
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
              const [overviewResult] = await Promise.all([
                fetchOverview(targetDate, period),
                fetchAllSummaries(targetDate, period, cacheRef),
              ])
              if (fetchRequestKeyRef.current !== myRequestKey) return
              cacheRef.current[key] = overviewResult
              setData(overviewResult)
              setSummaryData(extractSummaryFromCache(cacheRef.current, targetDate, period))
              break
            } catch (e) {
              if (fetchRequestKeyRef.current !== myRequestKey) return
              if (attempt < MAX_RETRIES - 1 && isRetryableError(e)) {
                await new Promise((r) => setTimeout(r, 1000))
                continue
              }
              setError(e?.message || '데이터 조회 실패')
              setData(null)
              setSummaryData(EMPTY_SUMMARY)
              break
            }
          }
        }
      } catch (e) {
        if (fetchRequestKeyRef.current !== myRequestKey) return
        setError(e?.message || '데이터 조회 실패')
        if (!hadOverview) setData(null)
        setSummaryData(EMPTY_SUMMARY)
      } finally {
        if (fetchRequestKeyRef.current === myRequestKey) {
          setLoading(false)
          setSummaryLoading(false)
        }
      }
      return
    }

    const cached = cacheRef.current[key]
    const needsTrend = activeTab === 'star' || activeTab === 'frequency' || activeTab === 'coupon'
    const cacheHasTrend = cached?.trend?.rows?.length > 0
    if (cached !== undefined && (!needsTrend || cacheHasTrend)) {
      setData(cached)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const trendParams =
      period === 'daily'
        ? { endDate: targetDate, days: 30, period }
        : { endDate: targetDate, count: 12, period }
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        let result
        switch (activeTab) {
          case 'star': {
            const [starRes, trendRes] = await Promise.all([
              getNewDash2Star(targetDate, period),
              getNewDash2Trend('star_analyze_overall', 'star_issue_cnt,star_send_cnt,star_first_issue_cnt', trendParams),
            ])
            result = starRes != null ? { ...starRes, trend: trendRes } : null
            break
          }
          case 'frequency': {
            const [freqRes, trendRes] = await Promise.all([
              getNewDash2Frequency(targetDate, period),
              getNewDash2Trend('frequency_analyze_overall', 'frequency_complete_cnt', trendParams),
            ])
            result = freqRes != null ? { ...freqRes, trend: trendRes } : null
            break
          }
          case 'coupon': {
            const [couponRes, trendRes] = await Promise.all([
              getNewDash2Coupon(targetDate, period),
              getNewDash2Trend('coupon_analyze_overall', 'coupon_issue_cnt,coupon_use_cnt,order_cnt', trendParams),
            ])
            result = couponRes != null ? { ...couponRes, trend: trendRes } : null
            const cKey = `campaign-${targetDate}-${period}`
            if (cacheRef.current[cKey] === undefined) {
              try {
                const campaignRes = await getNewDash2CampaignSegments(targetDate, period)
                cacheRef.current[cKey] = campaignRes
              } catch (_) {
                /* 쿠폰 기여도 추정 없이 진행 */
              }
            }
            break
          }
          case 'campaign':
            result = await getNewDash2CampaignSegments(targetDate, period)
            break
          case 'store':
            result = await getNewDash2Store(targetDate, period)
            break
          default:
            result = null
        }
        if (fetchRequestKeyRef.current !== myRequestKey) return
        cacheRef.current[key] = result
        setData(result)
        break
      } catch (e) {
        if (fetchRequestKeyRef.current !== myRequestKey) return
        if (attempt < MAX_RETRIES - 1 && isRetryableError(e)) {
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        setError(e?.message || '데이터 조회 실패')
        setData(null)
        break
      }
    }
    if (fetchRequestKeyRef.current === myRequestKey) setLoading(false)
  }, [activeTab, targetDate, period, cacheKey])

  useEffect(() => {
    fetchTab()
  }, [fetchTab])

  const refresh = useCallback(() => {
    const k = (tab) => `${tab}-${targetDate}-${period}`
    if (activeTab === 'overview') {
      ;['overview', 'star', 'frequency', 'coupon', 'campaign', 'store'].forEach((t) => delete cacheRef.current[k(t)])
    } else {
      delete cacheRef.current[cacheKey]
    }
    fetchTab()
  }, [cacheKey, activeTab, targetDate, period, fetchTab])

  return { data, loading, error, refresh, summaryData, summaryLoading, getCachedData }
}
