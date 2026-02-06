/**
 * dashboard2/Dashboard2Page.jsx (ECharts 대시보드 페이지)
 * =======================================================
 * 테이블·필터는 dashboard와 동일. 본문은 Dimension·Metric·차트 유형 자유 선택 + getChartData API + ECharts.
 *
 * [주요 기능]
 * - getDashboardTables / getDashboardFilterOptions / getDashboardData (헤더·집계용)
 * - getChartData: 단일 Dimension·Metric 조회 후 ECharts로 막대/선형/영역 차트
 * - 기존 대시보드와 동일하게 Dimension(일자·캠페인·워크플로우·채널), Metric(발송요청·성공·오픈·클릭·비율), 차트 유형(막대·선형·영역) 선택
 *
 * [의존성]
 * - React, shared/api/client, dashboard/components/DashboardHeader, dashboard2/components/EChartsChart
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDashboardData, getDashboardFilterOptions, getDashboardTables, getChartData } from '@/shared/api/client'
import '../dashboard/dashboard.css'
import './dashboard2.css'
import DashboardHeader from '../dashboard/components/DashboardHeader'
import EChartsChart from './components/EChartsChart'

const DIMENSION_FIELDS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'campaign_label', label: '캠페인' },
  { key: 'workflow_label', label: '워크플로우' },
  { key: 'channel_name', label: '채널' }
]

function getAvailableDimensions(groupBy) {
  const order = [
    { g: 'date', key: 'delivery_date', label: '일자' },
    { g: 'campaign', key: 'campaign_label', label: '캠페인' },
    { g: 'workflow', key: 'workflow_label', label: '워크플로우' },
    { g: 'channel', key: 'channel_name', label: '채널' }
  ]
  const filtered = order.filter(({ g }) => groupBy && groupBy[g])
  return filtered.length ? filtered : [...DIMENSION_FIELDS]
}

const METRIC_FIELDS = [
  { key: 'total_count', label: '발송요청' },
  { key: 'success_count', label: '발송성공' },
  { key: 'failed_count', label: '발송실패' },
  { key: 'open_count', label: '오픈' },
  { key: 'click_count', label: '클릭' },
  { key: 'success_rate', label: '성공률(%)' },
  { key: 'open_rate', label: '오픈률(%)' },
  { key: 'click_rate', label: '클릭률(%)' }
]

const CHART_TYPES = [
  { key: 'bar', label: '막대' },
  { key: 'line', label: '선형' },
  { key: 'area', label: '영역' }
]

const defaultGroupBy = { campaign: false, date: true, workflow: false, channel: false }

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
  return [`${y}-${m}-${d}`, `${y}-${m}-${d}`]
}

export default function Dashboard2Page() {
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
  const [sortOrder, setSortOrder] = useState([{ key: 'delivery_date', order: 'desc' }])
  const [dimensionKey, setDimensionKey] = useState('delivery_date')
  const [metricKey, setMetricKey] = useState('total_count')
  const [chartType, setChartType] = useState('bar')
  const [chartData, setChartData] = useState([])
  const [chartDataLoading, setChartDataLoading] = useState(false)

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

  useEffect(() => {
    if (tableId) setFilters((prev) => ({ ...prev, table_id: tableId }))
  }, [tableId])

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
  const groupBy = { ...(filters.group_by ?? defaultGroupBy), date: true }
  const availableDimensions = useMemo(() => getAvailableDimensions(groupBy), [groupBy])
  const effectiveDimensionKey = availableDimensions.some((d) => d.key === dimensionKey) ? dimensionKey : (availableDimensions[0]?.key ?? 'delivery_date')
  const metricField = useMemo(() => METRIC_FIELDS.find((f) => f.key === metricKey) || METRIC_FIELDS[0], [metricKey])

  useEffect(() => {
    if (!tableId || !filters.date_range?.length || filters.date_range.length < 2) {
      setChartData([])
      return
    }
    let cancelled = false
    setChartDataLoading(true)
    getChartData({
      table_id: tableId,
      date_range: filters.date_range,
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || [],
      dimension: effectiveDimensionKey,
      metric: metricKey,
      limit: 50
    })
      .then((res) => {
        if (cancelled) return
        const rows = res.rows || []
        setChartData(rows.map((r) => ({ name: r.name ?? '-', value: r.value })))
      })
      .catch(() => {
        if (!cancelled) setChartData([])
      })
      .finally(() => {
        if (!cancelled) setChartDataLoading(false)
      })
    return () => { cancelled = true }
  }, [tableId, filters.date_range, filters.campaign_ids, filters.workflow_ids, filters.channels, effectiveDimensionKey, metricKey])

  return (
    <div className="dashboard2-page">
      <div className="dashboard2-page__header-wrap">
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

      {error && <div className="dashboard2-page__error">{error}</div>}

      {!tableId && (
        <div className="dashboard2-page__empty">
          헤더에서 테이블을 선택한 뒤 조회하세요.
        </div>
      )}

      {tableId && (
        <div className="dashboard2-page__content">
          <div className="dashboard2-chart-options">
            <label htmlFor="dashboard2-dimension">Dimension</label>
            <select
              id="dashboard2-dimension"
              className="dashboard2-option-select"
              value={effectiveDimensionKey}
              onChange={(e) => setDimensionKey(e.target.value)}
            >
              {availableDimensions.map((d) => (
                <option key={d.key} value={d.key}>{d.label} (Dimension)</option>
              ))}
            </select>
            <label htmlFor="dashboard2-metric">Metric</label>
            <select
              id="dashboard2-metric"
              className="dashboard2-option-select"
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
            >
              {METRIC_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label} (Metric)</option>
              ))}
            </select>
            <label htmlFor="dashboard2-chart-type">차트 유형</label>
            <select
              id="dashboard2-chart-type"
              className="dashboard2-option-select"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
            >
              {CHART_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="dashboard2-chart-wrap">
            {chartDataLoading && <div className="dashboard2-chart-loading">차트 데이터 조회 중…</div>}
            <EChartsChart
              customChartData={chartData}
              metricLabel={metricField.label}
              chartType={chartType}
            />
          </div>
        </div>
      )}
    </div>
  )
}
