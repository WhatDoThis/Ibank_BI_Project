/**
 * dashboard/DashboardPage.jsx (대시보드 메인 페이지)
 * ===================================================
 * 캠페인/일자/워크플로우/채널별 GROUP BY 집계 대시보드.
 * - 헤더: 테이블 선택 + 필터(기간·캠페인·워크플로우·채널 전체 옵션)·집계 기준
 * - 본문: 목표·컨텍스트 섹션, KPI 카드(목표 대비 신호등·표시 지표 선택), 채널 도넛, 막대 차트, 집계 테이블, 차트 위젯
 *
 * [주요 기능]
 * - getDashboardTables, getDashboardData, getDashboardFilterOptions
 * - 목표 저장/로드(localStorage dashboard_targets), 목표 대비 신호등(달성/주의/미달)
 *
 * [의존성]
 * - React, shared/api/client, dashboard/components (DashboardHeader, TargetContextSection, KPICards, ChannelDonutCharts, AggregatedBarChart, AggregatedDataTable, ChartWidget)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDashboardData, getDashboardFilterOptions, getDashboardTables } from '@/shared/api/client'
import './dashboard.css'
import DashboardHeader from './components/DashboardHeader'
import CollapsibleSection from './components/CollapsibleSection'
import TargetContextSection from './components/TargetContextSection'
import KPICards from './components/KPICards'
import ChannelDonutCharts from './components/ChannelDonutCharts'
import AggregatedBarChart from './components/AggregatedBarChart'
import AggregatedDataTable from './components/AggregatedDataTable'
import ChartWidget from './components/ChartWidget'

const TARGETS_STORAGE_KEY = 'dashboard_targets'

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

function saveTargetsToStorage(targets) {
  try {
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets))
  } catch (e) {
    console.warn('dashboard targets save failed', e)
  }
}

function mergeTarget(list, one) {
  const key = (t) => `${t.periodType}|${t.metric}|${t.year}|${t.month ?? ''}|${t.rangeStart ?? ''}|${t.rangeEnd ?? ''}`
  const oneKey = key(one)
  const idx = list.findIndex((t) => key(t) === oneKey)
  const next = [...list]
  if (idx >= 0) next[idx] = one
  else next.push(one)
  return next
}

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

function getDefaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const today = `${y}-${m}-${d}`
  return [today, today]
}

export default function DashboardPage() {
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [filters, setFilters] = useState({
    table_id: '',
    date_range: getDefaultDateRange(),
    campaign_ids: [],
    workflow_ids: [],
    channels: [],
    group_by: { ...defaultGroupBy }
  })
  const [filterOptions, setFilterOptions] = useState({ campaigns: [], workflows: [], channels: [] })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chartWidgets, setChartWidgets] = useState([])
  /** 정렬 기준: [{ key: 'delivery_date'|'total_count'|..., order: 'asc'|'desc' }, ...]. 미설정 시 기본: 일자 내림차순 */
  const [sortOrder, setSortOrder] = useState([{ key: 'delivery_date', order: 'desc' }])
  /** 섹션 접기/펼치기: kpi, channel, bar, table, chartWidget */
  const [sectionOpen, setSectionOpen] = useState({
    kpi: true,
    channel: true,
    bar: true,
    table: true,
    chartWidget: true
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

  // 대시보드 데이터 로드 (filters 변경 시). 일자별은 항상 적용(집계 기준에서 체크박스 제거됨).
  const loadData = useCallback(() => {
    if (!filters.table_id || !filters.date_range?.length) return
    setLoading(true)
    setError(null)
    const payload = {
      ...filters,
      group_by: { ...(filters.group_by || defaultGroupBy), date: true }
    }
    getDashboardData(payload)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || '대시보드 데이터 조회 실패')
        setData(null)
        setLoading(false)
      })
  }, [filters])

  useEffect(() => {
    if (filters.table_id && filters.date_range?.length >= 2) loadData()
  }, [loadData])

  const updateFilters = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateGroupBy = useCallback((updates) => {
    setFilters((prev) => ({
      ...prev,
      group_by: { ...(prev.group_by || defaultGroupBy), ...updates }
    }))
  }, [])

  const sortedAggregatedData = useMemo(
    () => sortAggregatedData(data?.aggregated_data ?? [], sortOrder),
    [data?.aggregated_data, sortOrder]
  )

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
              <KPICards kpi={data.kpi} targetStatusByKey={targetStatusByKey}>
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
              <ChannelDonutCharts kpi={data.kpi} />
            </CollapsibleSection>
          )}
          {sortedAggregatedData.length > 0 && (
            <CollapsibleSection
              title="기준별 발송 현황 (발송성공수 상위 10건)"
              open={sectionOpen.bar}
              onToggle={() => toggleSection('bar')}
            >
              <AggregatedBarChart
                data={sortedAggregatedData}
                groupBy={{ ...(filters.group_by ?? defaultGroupBy), date: true }}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            title="집계 데이터 테이블"
            open={sectionOpen.table}
            onToggle={() => toggleSection('table')}
          >
            <AggregatedDataTable
              data={sortedAggregatedData}
              groupBy={{ ...(filters.group_by ?? defaultGroupBy), date: true }}
            />
          </CollapsibleSection>
          <CollapsibleSection
            title="차트 생성"
            open={sectionOpen.chartWidget}
            onToggle={() => toggleSection('chartWidget')}
          >
            <ChartWidget
              data={sortedAggregatedData}
              groupBy={{ ...(filters.group_by ?? defaultGroupBy), date: true }}
              widgets={chartWidgets}
              onWidgetsChange={setChartWidgets}
              tableId={tableId}
              filters={filters}
            />
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}
