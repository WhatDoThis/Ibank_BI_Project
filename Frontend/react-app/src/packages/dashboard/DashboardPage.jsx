/**
 * dashboard/DashboardPage.jsx (대시보드1 메인 페이지)
 * ===================================================
 * 캠페인/일자/워크플로우/채널별 집계. 헤더·목표·KPI·채널 도넛·막대·집계 테이블·차트 생성·위젯 생성(beta). /api/dashboard 사용.
 *
 * [Main Functions]
 * ===========
 * 1. loadTargetsFromStorage, saveTargetsToStorage, mergeTarget, targetMatchesPeriod, getTargetStatusByKey
 * 2. keyOfNoDate, aggregateByKeyNoDate, buildMergedCompareData, getPrimaryDimensionForChart, buildMergedCompareDataSingleDimension, buildSummaryCompareData, sortAggregatedData, getDefaultDateRange
 * 3. DashboardPage: tableId, filters, loadData, compareRange, formatRangeLabel. 헤더·목표·KPI·채널 도넛·막대·집계 테이블·위젯
 *
 * [Dependencies]
 * =========
 * - React, dashboard/api/dashboardClient, dashboard/utils/dateRange, dashboard/components/PeriodLabel, dashboard/utils/periodCompare
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDashboardData, getDashboardFilterOptions, getDashboardTables } from '@/packages/dashboard/api/dashboardClient.js'
import { normalizeDateRange } from './utils/dateRange.js'
import { getWeekRange, getMonthRange, getPreviousWeekRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange } from './utils/periodCompare'
import './dashboard.css'
import DashboardHeader from './components/DashboardHeader'
import CollapsibleSection from './components/CollapsibleSection'
import TargetContextSection from './components/TargetContextSection'
import KPICards from './components/KPICards'
import ChannelDonutCharts from './components/ChannelDonutCharts'
import AggregatedBarChart from './components/AggregatedBarChart'
import AggregatedDataTable from './components/AggregatedDataTable'
import ChartWidget from './components/ChartWidget'
import ChartWidget2 from './components/ChartWidget2'
import PeriodLabel from './components/PeriodLabel.jsx'

const TARGETS_STORAGE_KEY = 'dashboard_targets'

// 1.
function loadTargetsFromStorage() {
  try {
    const raw = localStorage.getItem(TARGETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 2.
function saveTargetsToStorage(targets) {
  try {
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets))
  } catch (e) {
    console.warn('dashboard targets save failed', e)
  }
}

// 3.
function mergeTarget(list, one) {
  const key = (t) => `${t.periodType}|${t.metric}|${t.year}|${t.month ?? ''}|${t.rangeStart ?? ''}|${t.rangeEnd ?? ''}`
  const oneKey = key(one)
  const idx = list.findIndex((t) => key(t) === oneKey)
  const next = [...list]
  if (idx >= 0) next[idx] = one
  else next.push(one)
  return next
}

// 4.
function targetMatchesPeriod(target, dateRange) {
  if (!dateRange?.length || dateRange.length < 2) return false
  const start = String(dateRange[0]).trim()
  const end = String(dateRange[1]).trim()
  const startYear = parseInt(start.slice(0, 4), 10)
  const startMonth = start.length >= 7 ? parseInt(start.slice(5, 7), 10) : 0
  const startMonthStr = start.length >= 7 ? start.slice(0, 7) : ''
  const endMonthStr = end.length >= 7 ? end.slice(0, 7) : ''

  if (target.periodType === 'year') return target.year === startYear
  if (target.periodType === 'month') return target.year === startYear && target.month === startMonth
  if (target.periodType === 'range' && target.rangeStart && target.rangeEnd) {
    return !(endMonthStr < target.rangeStart || startMonthStr > target.rangeEnd)
  }
  return false
}

const METRIC_HIGHER_IS_BETTER = {
  campaign_count: true,
  workflow_count: true,
  channel_count: true,
  total_send: true,
  total_success: true,
  total_failed: false,
  total_open: true,
  total_click: true,
  success_rate: true,
  failed_rate: false,
  open_rate: true,
  click_rate: true
}

// 5.
function getTargetStatusByKey(targets, dateRange, kpi) {
  if (!targets?.length || !dateRange?.length || !kpi) return {}
  const result = {}
  for (const target of targets) {
    if (!targetMatchesPeriod(target, dateRange)) continue
    const metric = target.metric
    if (result[metric] != null) continue
    const targetValue = Number(target.targetValue)
    if (!Number.isFinite(targetValue) || targetValue <= 0) continue
    const actualValue = Number(kpi[metric])
    if (!Number.isFinite(actualValue) && actualValue !== 0) continue

    const higherIsBetter = METRIC_HIGHER_IS_BETTER[metric] !== false
    const ratioPct = higherIsBetter
      ? (actualValue / targetValue) * 100
      : (targetValue / Math.max(actualValue, 1e-9)) * 100

    let status = 'fail'
    if (ratioPct >= 100) status = 'ok'
    else if (ratioPct >= 80) status = 'warning'

    result[metric] = { ratioPct, status, targetValue, actualValue }
  }
  return result
}

// 최초 대시보드 진입 시(세션 미유지) 집계 기준: 일자별만 적용
const defaultGroupBy = { campaign: false, date: true, workflow: false, channel: false }

// 6.
/** 집계 키에서 일자 제외 (캠페인/워크플로우/채널만). 비교 시 기간별 합산 후 매칭용 */
function keyOfNoDate(r, groupBy) {
  const parts = []
  if (groupBy.campaign) parts.push(String(r.campaign_label ?? r.campaign_id ?? ''))
  if (groupBy.workflow) parts.push(String(r.workflow_label ?? r.workflow_id ?? ''))
  if (groupBy.channel) parts.push(String(r.channel_name ?? r.channel_code ?? ''))
  return parts.join('\0')
}

// 7.
/** 동일 키(일자 제외)로 행들을 합산한 맵 반환 */
function aggregateByKeyNoDate(rows, groupBy) {
  const map = new Map()
  const getLabel = (r) => {
    const parts = []
    if (groupBy.campaign) parts.push(r?.campaign_label ?? r?.campaign_id ?? '-')
    if (groupBy.workflow) parts.push(r?.workflow_label ?? r?.workflow_id ?? '-')
    if (groupBy.channel) parts.push(r?.channel_name ?? r?.channel_code ?? '-')
    return parts.join(' / ')
  }
  rows.forEach((r) => {
    const k = keyOfNoDate(r, groupBy)
    const cur = map.get(k) || { total_count: 0, success_count: 0, open_count: 0, click_count: 0, labelRow: r }
    map.set(k, {
      total_count: cur.total_count + (Number(r.total_count) || 0),
      success_count: cur.success_count + (Number(r.success_count) || 0),
      open_count: cur.open_count + (Number(r.open_count) || 0),
      click_count: cur.click_count + (Number(r.click_count) || 0),
      labelRow: r
    })
  })
  return { map, getLabel }
}

// 8.
/** 비교 모드 시 B안: 디멘션별 기준/비교 나란히. 캠페인/워크플로우/채널+일자면 일자 제외하고 기간별 합산 후 매칭 */
function buildMergedCompareData(baseRows, compareRows, groupBy) {
  if (!baseRows?.length && !compareRows?.length) return []
  const base = baseRows || []
  const compare = compareRows || []
  const isDateOnly = groupBy.date && !groupBy.campaign && !groupBy.workflow && !groupBy.channel
  const hasDateAndOther = groupBy.date && (groupBy.campaign || groupBy.workflow || groupBy.channel)
  if (hasDateAndOther) {
    const { map: baseMap, getLabel } = aggregateByKeyNoDate(base, groupBy)
    const { map: compareMap } = aggregateByKeyNoDate(compare, groupBy)
    const allKeys = new Set([...baseMap.keys(), ...compareMap.keys()])
    const rows = []
    allKeys.forEach((k) => {
      const b = baseMap.get(k)
      const c = compareMap.get(k)
      const totalBase = b ? b.total_count : 0
      const totalCompare = c ? c.total_count : 0
      const successBase = b ? b.success_count : 0
      const successCompare = c ? c.success_count : 0
      const openBase = b ? b.open_count : 0
      const openCompare = c ? c.open_count : 0
      const clickBase = b ? b.click_count : 0
      const clickCompare = c ? c.click_count : 0
      const successRateBase = totalBase > 0 ? (successBase / totalBase) * 100 : 0
      const successRateCompare = totalCompare > 0 ? (successCompare / totalCompare) * 100 : 0
      const openRateBase = successBase > 0 ? (openBase / successBase) * 100 : 0
      const openRateCompare = successCompare > 0 ? (openCompare / successCompare) * 100 : 0
      const clickRateBase = successBase > 0 ? (clickBase / successBase) * 100 : 0
      const clickRateCompare = successCompare > 0 ? (clickCompare / successCompare) * 100 : 0
      rows.push({
        dimensionLabel: getLabel((b || c)?.labelRow ?? {}),
        기준_total_count: totalBase,
        비교_total_count: totalCompare,
        기준_success_count: successBase,
        비교_success_count: successCompare,
        기준_success_rate: successRateBase,
        비교_success_rate: successRateCompare,
        기준_open_count: openBase,
        비교_open_count: openCompare,
        기준_click_count: clickBase,
        비교_click_count: clickCompare,
        기준_open_rate: openRateBase,
        비교_open_rate: openRateCompare,
        기준_click_rate: clickRateBase,
        비교_click_rate: clickRateCompare
      })
    })
    return rows
  }
  if (isDateOnly) {
    const baseSorted = [...base].sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || '')))
    const compareSorted = [...compare].sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || '')))
    const maxLen = Math.max(baseSorted.length, compareSorted.length)
    const rows = []
    for (let i = 0; i < maxLen; i++) {
      const b = baseSorted[i]
      const c = compareSorted[i]
      const totalBase = b ? (Number(b.total_count) || 0) : 0
      const totalCompare = c ? (Number(c.total_count) || 0) : 0
      const successBase = b ? (Number(b.success_count) || 0) : 0
      const successCompare = c ? (Number(c.success_count) || 0) : 0
      const openBase = b ? (Number(b.open_count) || 0) : 0
      const openCompare = c ? (Number(c.open_count) || 0) : 0
      const clickBase = b ? (Number(b.click_count) || 0) : 0
      const clickCompare = c ? (Number(c.click_count) || 0) : 0
      const successRateBase = totalBase > 0 ? (successBase / totalBase) * 100 : 0
      const successRateCompare = totalCompare > 0 ? (successCompare / totalCompare) * 100 : 0
      const openRateBase = successBase > 0 ? (openBase / successBase) * 100 : 0
      const openRateCompare = successCompare > 0 ? (openCompare / successCompare) * 100 : 0
      const clickRateBase = successBase > 0 ? (clickBase / successBase) * 100 : 0
      const clickRateCompare = successCompare > 0 ? (clickCompare / successCompare) * 100 : 0
      rows.push({
        dimensionLabel: `${i + 1}일차`,
        delivery_date_base: b?.delivery_date ?? '',
        delivery_date_compare: c?.delivery_date ?? '',
        기준_total_count: totalBase,
        비교_total_count: totalCompare,
        기준_success_count: successBase,
        비교_success_count: successCompare,
        기준_success_rate: successRateBase,
        비교_success_rate: successRateCompare,
        기준_open_count: openBase,
        비교_open_count: openCompare,
        기준_click_count: clickBase,
        비교_click_count: clickCompare,
        기준_open_rate: openRateBase,
        비교_open_rate: openRateCompare,
        기준_click_rate: clickRateBase,
        비교_click_rate: clickRateCompare
      })
    }
    return rows
  }
  const keyOf = (r) => {
    const parts = []
    if (groupBy.campaign) parts.push(String(r.campaign_label ?? r.campaign_id ?? ''))
    if (groupBy.date) parts.push(String(r.delivery_date ?? ''))
    if (groupBy.workflow) parts.push(String(r.workflow_label ?? r.workflow_id ?? ''))
    if (groupBy.channel) parts.push(String(r.channel_name ?? r.channel_code ?? ''))
    return parts.join('\0')
  }
  const baseMap = new Map()
  base.forEach((r) => baseMap.set(keyOf(r), r))
  const compareMap = new Map()
  compare.forEach((r) => compareMap.set(keyOf(r), r))
  const allKeys = new Set([...baseMap.keys(), ...compareMap.keys()])
  const getLabel = (r) => {
    const parts = []
    if (groupBy.campaign) parts.push(r?.campaign_label ?? r?.campaign_id ?? '-')
    if (groupBy.date) parts.push(r?.delivery_date ?? '-')
    if (groupBy.workflow) parts.push(r?.workflow_label ?? r?.workflow_id ?? '-')
    if (groupBy.channel) parts.push(r?.channel_name ?? r?.channel_code ?? '-')
    return parts.join(' / ')
  }
  const rows = []
  allKeys.forEach((k) => {
    const b = baseMap.get(k)
    const c = compareMap.get(k)
    const totalBase = b ? (Number(b.total_count) || 0) : 0
    const totalCompare = c ? (Number(c.total_count) || 0) : 0
    const successBase = b ? (Number(b.success_count) || 0) : 0
    const successCompare = c ? (Number(c.success_count) || 0) : 0
    const openBase = b ? (Number(b.open_count) || 0) : 0
    const openCompare = c ? (Number(c.open_count) || 0) : 0
    const clickBase = b ? (Number(b.click_count) || 0) : 0
    const clickCompare = c ? (Number(c.click_count) || 0) : 0
    const successRateBase = totalBase > 0 ? (successBase / totalBase) * 100 : 0
    const successRateCompare = totalCompare > 0 ? (successCompare / totalCompare) * 100 : 0
    const openRateBase = successBase > 0 ? (openBase / successBase) * 100 : 0
    const openRateCompare = successCompare > 0 ? (openCompare / successCompare) * 100 : 0
    const clickRateBase = successBase > 0 ? (clickBase / successBase) * 100 : 0
    const clickRateCompare = successCompare > 0 ? (clickCompare / successCompare) * 100 : 0
    rows.push({
      dimensionLabel: getLabel(b || c),
      기준_total_count: totalBase,
      비교_total_count: totalCompare,
      기준_success_count: successBase,
      비교_success_count: successCompare,
      기준_success_rate: successRateBase,
      비교_success_rate: successRateCompare,
      기준_open_count: openBase,
      비교_open_count: openCompare,
      기준_click_count: clickBase,
      비교_click_count: clickCompare,
      기준_open_rate: openRateBase,
      비교_open_rate: openRateCompare,
      기준_click_rate: clickRateBase,
      비교_click_rate: clickRateCompare
    })
  })
  return rows
}

// 9.
/** 차트 X축용: 복수 차원일 때 가장 분류가 많은 하나만 사용. 기간 비교 시 의미 유지를 위해 일자(date)는 후보에서 제외(캠페인/워크플로우/채널만) */
function getPrimaryDimensionForChart(baseRows, compareRows, groupBy) {
  const combined = [...(baseRows || []), ...(compareRows || [])]
  const dims = []
  if (groupBy.campaign) dims.push({ key: 'campaign', getVal: (r) => String(r.campaign_label ?? r.campaign_id ?? '') })
  if (groupBy.workflow) dims.push({ key: 'workflow', getVal: (r) => String(r.workflow_label ?? r.workflow_id ?? '') })
  if (groupBy.channel) dims.push({ key: 'channel', getVal: (r) => String(r.channel_name ?? r.channel_code ?? '') })
  if (dims.length === 0) return null
  let best = dims[0]
  let maxCount = 0
  dims.forEach((d) => {
    const count = new Set(combined.map(d.getVal)).size
    if (count > maxCount) {
      maxCount = count
      best = d
    }
  })
  return best
}

// 10.
/** 단일 차원으로 합산 후 머지 (차트용). primaryDim = getPrimaryDimensionForChart 반환값 */
function buildMergedCompareDataSingleDimension(baseRows, compareRows, groupBy, primaryDim) {
  if (!primaryDim || (!baseRows?.length && !compareRows?.length)) return []
  const getKey = (r) => primaryDim.getVal(r)
  const sumRows = (rows) => {
    const map = new Map()
    ;(rows || []).forEach((r) => {
      const k = getKey(r)
      const cur = map.get(k) || { total_count: 0, success_count: 0 }
      map.set(k, {
        total_count: cur.total_count + (Number(r.total_count) || 0),
        success_count: cur.success_count + (Number(r.success_count) || 0)
      })
    })
    return map
  }
  const baseMap = sumRows(baseRows)
  const compareMap = sumRows(compareRows)
  const allKeys = new Set([...baseMap.keys(), ...compareMap.keys()])
  return [...allKeys].map((k) => {
    const b = baseMap.get(k)
    const c = compareMap.get(k)
    return {
      dimensionLabel: k || '-',
      기준_total_count: b ? b.total_count : 0,
      비교_total_count: c ? c.total_count : 0,
      기준_success_count: b ? b.success_count : 0,
      비교_success_count: c ? c.success_count : 0
    }
  })
}

// 11.
/** 비교 모드 시 A안: 기간 2행 요약(기준 합산, 비교 합산) */
function buildSummaryCompareData(baseRows, compareRows) {
  const sum = (rows, key) => (rows || []).reduce((s, r) => s + (Number(r[key]) || 0), 0)
  const base = baseRows || []
  const compare = compareRows || []
  const totalBase = sum(base, 'total_count')
  const totalCompare = sum(compare, 'total_count')
  const successBase = sum(base, 'success_count')
  const successCompare = sum(compare, 'success_count')
  const openBase = sum(base, 'open_count')
  const openCompare = sum(compare, 'open_count')
  const clickBase = sum(base, 'click_count')
  const clickCompare = sum(compare, 'click_count')
  return [
    { 기간: '기준', total_count: totalBase, success_count: successBase, success_rate: totalBase > 0 ? (successBase / totalBase) * 100 : 0, open_count: openBase, click_count: clickBase, open_rate: successBase > 0 ? (openBase / successBase) * 100 : 0, click_rate: successBase > 0 ? (clickBase / successBase) * 100 : 0 },
    { 기간: '비교', total_count: totalCompare, success_count: successCompare, success_rate: totalCompare > 0 ? (successCompare / totalCompare) * 100 : 0, open_count: openCompare, click_count: clickCompare, open_rate: successCompare > 0 ? (openCompare / successCompare) * 100 : 0, click_rate: successCompare > 0 ? (clickCompare / successCompare) * 100 : 0 }
  ]
}

// 12.
/** 집계 데이터 정렬: sortOrder = [{ key, order: 'asc'|'desc' }, ...], 먼저 누른 것이 1순위 */
function sortAggregatedData(rows, sortOrder) {
  if (!rows?.length || !sortOrder?.length) return rows || []
  return [...rows].sort((a, b) => {
    for (const { key, order } of sortOrder) {
      const va = a[key]
      const vb = b[key]
      let cmp = 0
      if (va == null && vb == null) cmp = 0
      else if (va == null) cmp = 1
      else if (vb == null) cmp = -1
      else if (key === 'delivery_date') cmp = String(va).localeCompare(String(vb))
      else cmp = Number(va) - Number(vb)
      if (cmp !== 0) return order === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

// 13.
function getDefaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const today = `${y}-${m}-${d}`
  return [today, today]
}

// 14.
export default function DashboardPage() {
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [filters, setFilters] = useState({
    table_id: '',
    date_range: getDefaultDateRange(),
    view_mode: 'normal',
    compare_base_week: '',
    compare_base_month: '',
    compare_base_day: '',
    compare_base_year: '',
    compare_week: '',
    compare_month: '',
    compare_day: '',
    compare_year: '',
    campaign_ids: [],
    workflow_ids: [],
    channels: [],
    group_by: { ...defaultGroupBy }
  })
  const [filterOptions, setFilterOptions] = useState({ campaigns: [], workflows: [], channels: [] })
  const [data, setData] = useState(null)
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  /** 위젯 생성: 비교 모드일 때 표시할 기간 선택 (기준 기간 / 비교 기간) */
  const [widgetPeriodChoice, setWidgetPeriodChoice] = useState('base')
  /** 비교 모드 시 기준별 발송 현황·집계 테이블: false=디멘션별 비교(B), true=요약 보기(A) */
  const [showCompareSummary, setShowCompareSummary] = useState(false)
  const [chartWidgets, setChartWidgets] = useState([])
  const [chartWidgets2, setChartWidgets2] = useState([])
  /** 정렬 기준: [{ key: 'delivery_date'|'total_count'|..., order: 'asc'|'desc' }, ...]. 미설정 시 기본: 일자 내림차순 */
  const [sortOrder, setSortOrder] = useState([{ key: 'delivery_date', order: 'desc' }])
  /** 섹션 접기/펼치기: kpi, channel, bar, table, chartWidget, chartWidget2 */
  const [sectionOpen, setSectionOpen] = useState({
    kpi: true,
    channel: true,
    bar: true,
    table: true,
    chartWidget: false,
    chartWidget2: false
  })
  const [targets, setTargets] = useState([])

  useEffect(() => {
    setTargets(loadTargetsFromStorage())
  }, [])

  const handleSaveTarget = useCallback((payload) => {
    setTargets((prev) => {
      const next = mergeTarget(prev, payload)
      saveTargetsToStorage(next)
      return next
    })
  }, [])

  const handleDeleteTarget = useCallback((index) => {
    setTargets((prev) => {
      const next = prev.filter((_, i) => i !== index)
      saveTargetsToStorage(next)
      return next
    })
  }, [])

  const targetStatusByKey = useMemo(
    () => getTargetStatusByKey(targets, filters.date_range, data?.kpi),
    [targets, filters.date_range, data?.kpi]
  )

  const toggleSection = useCallback((key) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // 테이블 목록 로드
  useEffect(() => {
    let cancelled = false
    getDashboardTables()
      .then((res) => {
        if (cancelled) return
        const list = res.tables || []
        setTables(list)
        if (list.length > 0 && !tableId) {
          const first = list[0].id
          setTableId(first)
          setFilters((prev) => ({ ...prev, table_id: first }))
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || '테이블 목록 조회 실패')
      })
    return () => { cancelled = true }
  }, [])

  // table_id 동기화
  useEffect(() => {
    if (tableId) setFilters((prev) => ({ ...prev, table_id: tableId }))
  }, [tableId])

  // 필터 옵션 로드: table_id 및 선택된 필터(campaign_ids, workflow_ids, channels) 변경 시 연동 옵션만 재조회
  useEffect(() => {
    if (!tableId) return
    let cancelled = false
    getDashboardFilterOptions(tableId, {
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || []
    })
      .then((res) => {
        if (cancelled) return
        const campaigns = res.campaigns || []
        const workflows = res.workflows || []
        const channels = res.channels || []
        setFilterOptions({ campaigns, workflows, channels })
        // 선택된 값 중 옵션 목록에 없는 것은 제거(다른 컬럼 선택 시 유효하지 않은 조합 방지). 변경 시에만 setFilters 호출해 루프 방지.
        setFilters((prev) => {
          const newCampaignIds = (prev.campaign_ids || []).filter((id) => campaigns.some((c) => c.id == id))
          const newWorkflowIds = (prev.workflow_ids || []).filter((id) => workflows.some((w) => w.id == id))
          const newChannels = (prev.channels || []).filter((code) => channels.some((ch) => String(ch.code) === String(code)))
          const changed =
            newCampaignIds.length !== (prev.campaign_ids || []).length ||
            newWorkflowIds.length !== (prev.workflow_ids || []).length ||
            newChannels.length !== (prev.channels || []).length
          if (!changed) return prev
          return { ...prev, campaign_ids: newCampaignIds, workflow_ids: newWorkflowIds, channels: newChannels }
        })
      })
      .catch(() => {
        if (!cancelled) setFilterOptions({ campaigns: [], workflows: [], channels: [] })
      })
    return () => { cancelled = true }
  }, [tableId, filters.campaign_ids, filters.workflow_ids, filters.channels])

  const loadData = useCallback(() => {
    if (!filters.table_id || !filters.date_range?.length) return
    setLoading(true)
    setError(null)
    setCompareData(null)
    const currentRange = normalizeDateRange(filters.date_range || [])
    const basePayload = {
      table_id: filters.table_id,
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || [],
      group_by: { ...(filters.group_by || defaultGroupBy), date: true }
    }
    const isCompare = filters.view_mode === 'week_compare' || filters.view_mode === 'month_compare' || filters.view_mode === 'day_compare' || filters.view_mode === 'year_compare'
    let compareRange = null
    if (filters.view_mode === 'week_compare' && filters.compare_base_week) {
      compareRange = filters.compare_week ? getWeekRange(filters.compare_week) : getPreviousWeekRange(filters.compare_base_week)
    } else if (filters.view_mode === 'month_compare' && filters.compare_base_month) {
      if (filters.compare_month) {
        const [cy, cm] = filters.compare_month.split('-').map(Number)
        if (cy && cm) compareRange = getMonthRange(cy, cm)
      } else {
        const [y, m] = filters.compare_base_month.split('-').map(Number)
        if (y && m) compareRange = getPreviousMonthRange(y, m)
      }
    } else if (filters.view_mode === 'day_compare' && filters.compare_base_day) {
      compareRange = filters.compare_day ? [filters.compare_day, filters.compare_day] : getPreviousDay(filters.compare_base_day)
    } else if (filters.view_mode === 'year_compare' && filters.compare_base_year) {
      const baseY = Number(filters.compare_base_year)
      if (filters.compare_year && Number.isFinite(Number(filters.compare_year))) compareRange = getYearRange(Number(filters.compare_year))
      else if (Number.isFinite(baseY)) compareRange = getPreviousYearRange(baseY)
    }
    const payloadCurrent = { ...basePayload, date_range: currentRange }
    getDashboardData(payloadCurrent)
      .then((res) => {
        setData(res)
        if (!isCompare || !compareRange?.[0] || !compareRange?.[1]) {
          setLoading(false)
          return null
        }
        return getDashboardData({ ...basePayload, date_range: compareRange })
      })
      .then((resCompare) => {
        if (resCompare != null) setCompareData(resCompare)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || '대시보드 데이터 조회 실패')
        setData(null)
        setCompareData(null)
        setLoading(false)
      })
  }, [filters])

  useEffect(() => {
    if (filters.table_id && filters.date_range?.length >= 2) loadData()
  }, [loadData])

  const updateFilters = useCallback((updates) => {
    if (updates?.date_range != null && Array.isArray(updates.date_range)) {
      updates = { ...updates, date_range: normalizeDateRange(updates.date_range) }
    }
    setFilters((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateGroupBy = useCallback((updates) => {
    setFilters((prev) => ({
      ...prev,
      group_by: { ...(prev.group_by || defaultGroupBy), ...updates }
    }))
  }, [])

  const groupBy = { ...(filters.group_by ?? defaultGroupBy), date: true }
  const sortedAggregatedData = useMemo(
    () => sortAggregatedData(data?.aggregated_data ?? [], sortOrder),
    [data?.aggregated_data, sortOrder]
  )
  const sortedCompareAggregatedData = useMemo(
    () => sortAggregatedData(compareData?.aggregated_data ?? [], sortOrder),
    [compareData?.aggregated_data, sortOrder]
  )
  const mergedCompareData = useMemo(
    () => buildMergedCompareData(sortedAggregatedData, sortedCompareAggregatedData, groupBy),
    [sortedAggregatedData, sortedCompareAggregatedData, groupBy]
  )
  const summaryCompareData = useMemo(
    () => buildSummaryCompareData(data?.aggregated_data ?? [], compareData?.aggregated_data ?? []),
    [data?.aggregated_data, compareData?.aggregated_data]
  )
  const activeDimensionKeys = useMemo(
    () => ['date', 'campaign', 'workflow', 'channel'].filter((k) => groupBy[k]),
    [groupBy]
  )
  const mergedChartData = useMemo(() => {
    const source =
      activeDimensionKeys.length >= 2
        ? buildMergedCompareDataSingleDimension(
            sortedAggregatedData,
            sortedCompareAggregatedData,
            groupBy,
            getPrimaryDimensionForChart(sortedAggregatedData, sortedCompareAggregatedData, groupBy)
          )
        : mergedCompareData
    return (source || []).map((r) => ({
      name: r.dimensionLabel,
      기준_발송요청: r.기준_total_count,
      비교_발송요청: r.비교_total_count,
      기준_발송성공: r.기준_success_count,
      비교_발송성공: r.비교_success_count
    }))
  }, [mergedCompareData, sortedAggregatedData, sortedCompareAggregatedData, groupBy, activeDimensionKeys.length])
  const summaryChartData = useMemo(
    () => summaryCompareData.map((r) => ({
      name: r.기간,
      발송요청: r.total_count,
      발송성공: r.success_count
    })),
    [summaryCompareData]
  )

  const compareRange = useMemo(() => {
    if (filters.view_mode === 'week_compare' && filters.compare_base_week) {
      if (filters.compare_week) return getWeekRange(filters.compare_week)
      return getPreviousWeekRange(filters.compare_base_week)
    }
    if (filters.view_mode === 'month_compare' && filters.compare_base_month) {
      if (filters.compare_month) {
        const [cy, cm] = filters.compare_month.split('-').map(Number)
        return cy && cm ? getMonthRange(cy, cm) : null
      }
      const [y, m] = filters.compare_base_month.split('-').map(Number)
      return y && m ? getPreviousMonthRange(y, m) : null
    }
    if (filters.view_mode === 'day_compare' && filters.compare_base_day) {
      if (filters.compare_day) return [filters.compare_day, filters.compare_day]
      return getPreviousDay(filters.compare_base_day)
    }
    if (filters.view_mode === 'year_compare' && filters.compare_base_year) {
      const baseY = Number(filters.compare_base_year)
      if (filters.compare_year && Number.isFinite(Number(filters.compare_year))) return getYearRange(Number(filters.compare_year))
      if (Number.isFinite(baseY)) return getPreviousYearRange(baseY)
    }
    return null
  }, [filters.view_mode, filters.compare_base_week, filters.compare_base_month, filters.compare_base_day, filters.compare_base_year, filters.compare_week, filters.compare_month, filters.compare_day, filters.compare_year])

  const formatRangeLabel = (range) => {
    if (!range?.[0] || !range?.[1]) return ''
    const s = range[0]; const e = range[1]
    const toD = (str) => str.length >= 10 ? `${str.slice(0, 4)}.${str.slice(5, 7)}.${str.slice(8, 10)}` : str
    return `${toD(s)} ~ ${toD(e)}`
  }

  const effectiveWidgetFilters = useMemo(() => {
    if (!compareRange) return filters
    return widgetPeriodChoice === 'compare'
      ? { ...filters, date_range: compareRange }
      : filters
  }, [filters, compareRange, widgetPeriodChoice])
  const effectiveWidgetData = widgetPeriodChoice === 'compare' ? sortedCompareAggregatedData : sortedAggregatedData

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header-wrap">
        <DashboardHeader
        tables={tables}
        tableId={tableId}
        onTableChange={setTableId}
        filters={filters}
        onFiltersChange={updateFilters}
        onGroupByChange={updateGroupBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        filterOptions={filterOptions}
        loading={loading}
        onLoad={loadData}
      />
      </div>

      {error && (
        <div className="dashboard-page__error">
          {error}
        </div>
      )}

      {!tableId && (
        <div className="dashboard-page__empty">
          헤더에서 테이블을 선택한 뒤 조회하세요.
        </div>
      )}

      {tableId && (
        <div className="dashboard-page__content">
          <TargetContextSection
            dateRange={filters.date_range}
            targets={targets}
            onSave={handleSaveTarget}
            onDelete={handleDeleteTarget}
          />
          {data?.kpi && (
            <CollapsibleSection
              title="주요 지표"
              open={sectionOpen.kpi}
              onToggle={() => toggleSection('kpi')}
            >
              {compareRange ? (
                <div className="dashboard-period-label dashboard-compare-period-label" role="status">
                  <span className="period-label__icon">📅</span>
                  <span className="period-label__text">
                    기준: {formatRangeLabel(filters.date_range)}
                    {' / '}
                    비교: {formatRangeLabel(compareRange)}
                  </span>
                </div>
              ) : (
                <PeriodLabel dateRange={filters.date_range} className="dashboard-period-label" />
              )}
              <KPICards kpi={data.kpi} compareKpi={compareData?.kpi} targetStatusByKey={targetStatusByKey}>
                <p className="dashboard-kpi-section-hint">
                  신호등 표시: 저장된 목표 중 현재 선택한 기간(날짜 범위)과 일치하는 지표에만 신호등(달성/주의/미달)이 표시됩니다.
                </p>
              </KPICards>
            </CollapsibleSection>
          )}
          {data?.kpi && (
            <CollapsibleSection
              title="채널별 분석"
              open={sectionOpen.channel}
              onToggle={() => toggleSection('channel')}
            >
              {compareRange ? (
                <div className="dashboard-period-label dashboard-compare-period-label" role="status">
                  <span className="period-label__icon">📅</span>
                  <span className="period-label__text">
                    기준: {formatRangeLabel(filters.date_range)}
                    {' / '}
                    비교: {formatRangeLabel(compareRange)}
                  </span>
                </div>
              ) : (
                <PeriodLabel dateRange={filters.date_range} className="dashboard-period-label" />
              )}
              <ChannelDonutCharts kpi={data.kpi} compareKpi={compareData?.kpi} />
            </CollapsibleSection>
          )}
          {(sortedAggregatedData.length > 0 || sortedCompareAggregatedData.length > 0) && (
            <CollapsibleSection
              title="기준별 발송 현황 (발송성공수 상위 10건)"
              open={sectionOpen.bar}
              onToggle={() => toggleSection('bar')}
            >
              {compareRange ? (
                <>
                  <div className="dashboard-compare-view-toggle">
                    <button
                      type="button"
                      className={`dashboard-compare-view-toggle__btn ${!showCompareSummary ? 'dashboard-compare-view-toggle__btn--active' : ''}`}
                      onClick={() => setShowCompareSummary(false)}
                      aria-pressed={!showCompareSummary}
                    >
                      디멘션별 비교 (B)
                    </button>
                    <button
                      type="button"
                      className={`dashboard-compare-view-toggle__btn ${showCompareSummary ? 'dashboard-compare-view-toggle__btn--active' : ''}`}
                      onClick={() => setShowCompareSummary(true)}
                      aria-pressed={showCompareSummary}
                      title="기준·비교 기간 합산만 2막대로 보기"
                    >
                      요약 보기 (A)
                    </button>
                  </div>
                  <div className="dashboard-period-label dashboard-compare-period-label dashboard-compare-period-label--below-toggle" role="status">
                    <span className="period-label__icon">📅</span>
                    <span className="period-label__text">
                      기준: {formatRangeLabel(filters.date_range)}
                      {' / '}
                      비교: {formatRangeLabel(compareRange)}
                    </span>
                  </div>
                </>
              ) : null}
              <AggregatedBarChart
                data={sortedAggregatedData}
                compareData={sortedCompareAggregatedData}
                groupBy={groupBy}
                compareView={compareRange ? (showCompareSummary ? 'summary' : 'merged') : 'split'}
                mergedChartData={mergedChartData}
                summaryChartData={summaryChartData}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            title="집계 데이터 테이블"
            open={sectionOpen.table}
            onToggle={() => toggleSection('table')}
          >
            {compareRange ? (
              <>
                <div className="dashboard-compare-view-toggle">
                  <button
                    type="button"
                    className={`dashboard-compare-view-toggle__btn ${!showCompareSummary ? 'dashboard-compare-view-toggle__btn--active' : ''}`}
                    onClick={() => setShowCompareSummary(false)}
                    aria-pressed={!showCompareSummary}
                  >
                    디멘션별 비교 (B)
                  </button>
                  <button
                    type="button"
                    className={`dashboard-compare-view-toggle__btn ${showCompareSummary ? 'dashboard-compare-view-toggle__btn--active' : ''}`}
                    onClick={() => setShowCompareSummary(true)}
                    aria-pressed={showCompareSummary}
                    title="기준·비교 기간 합산만 2행으로 보기"
                  >
                    요약 보기 (A)
                  </button>
                </div>
                <div className="dashboard-period-label dashboard-compare-period-label dashboard-compare-period-label--below-toggle" role="status">
                  <span className="period-label__icon">📅</span>
                  <span className="period-label__text">
                    기준: {formatRangeLabel(filters.date_range)}
                    {' / '}
                    비교: {formatRangeLabel(compareRange)}
                  </span>
                </div>
                <AggregatedDataTable
                  compareTableMode={showCompareSummary ? 'summary' : 'merged'}
                  mergedTableData={mergedCompareData}
                  summaryTableData={summaryCompareData}
                  data={sortedAggregatedData}
                  groupBy={groupBy}
                  sortOrder={sortOrder}
                  onSortOrderChange={setSortOrder}
                />
              </>
            ) : (
              <AggregatedDataTable data={sortedAggregatedData} groupBy={groupBy} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
            )}
          </CollapsibleSection>
          <CollapsibleSection
            title="위젯 생성"
            open={sectionOpen.chartWidget}
            onToggle={() => toggleSection('chartWidget')}
          >
            {compareRange ? (
              <div className="dashboard-period-label dashboard-compare-period-label" role="status">
                <span className="period-label__icon">📅</span>
                <span className="period-label__text">
                  기준: {formatRangeLabel(filters.date_range)}
                  {' / '}
                  비교: {formatRangeLabel(compareRange)}
                </span>
              </div>
            ) : null}
            {compareRange && (
              <div className="dashboard-widget-period-select-wrap">
                <label className="dashboard-widget-period-select-label">차트 기간</label>
                <select
                  className="dashboard-widget-period-select"
                  value={widgetPeriodChoice}
                  onChange={(e) => setWidgetPeriodChoice(e.target.value)}
                  aria-label="기준 기간 또는 비교 기간 중 표시할 차트 선택"
                >
                  <option value="base">기준 기간</option>
                  <option value="compare">비교 기간</option>
                </select>
              </div>
            )}
            <ChartWidget
              data={effectiveWidgetData}
              groupBy={groupBy}
              widgets={chartWidgets}
              onWidgetsChange={setChartWidgets}
              tableId={tableId}
              filters={effectiveWidgetFilters}
            />
          </CollapsibleSection>
          <CollapsibleSection
            title="위젯 생성 (beta)"
            open={sectionOpen.chartWidget2}
            onToggle={() => toggleSection('chartWidget2')}
          >
            {compareRange ? (
              <div className="dashboard-period-label dashboard-compare-period-label" role="status">
                <span className="period-label__icon">📅</span>
                <span className="period-label__text">
                  기준: {formatRangeLabel(filters.date_range)}
                  {' / '}
                  비교: {formatRangeLabel(compareRange)}
                </span>
              </div>
            ) : null}
            {compareRange && (
              <div className="dashboard-widget-period-select-wrap">
                <label className="dashboard-widget-period-select-label">차트 기간</label>
                <select
                  className="dashboard-widget-period-select"
                  value={widgetPeriodChoice}
                  onChange={(e) => setWidgetPeriodChoice(e.target.value)}
                  aria-label="기준 기간 또는 비교 기간 중 표시할 차트 선택"
                >
                  <option value="base">기준 기간</option>
                  <option value="compare">비교 기간</option>
                </select>
              </div>
            )}
            <ChartWidget2
              data={effectiveWidgetData}
              groupBy={groupBy}
              widgets={chartWidgets2}
              onWidgetsChange={setChartWidgets2}
              tableId={tableId}
              filters={effectiveWidgetFilters}
            />
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}
