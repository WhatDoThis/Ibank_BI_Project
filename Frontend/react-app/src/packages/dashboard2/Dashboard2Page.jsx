/**
 * dashboard2/Dashboard2Page.jsx (대시보드2·성과리포트 메인 페이지)
 * ===============================================================
 * React 페이지. KPI·채널 도넛·기준별 막대·집계 테이블·차트 생성(ECharts). Backend /api/dashboard2 사용.
 * 목표·컨텍스트(기간 유형·지표·목표값, localStorage), 신호등(목표 대비 달성/주의/미달).
 *
 * [주요 기능]
 * - getDashboard2Tables, getDashboard2FilterOptions, getDashboard2Data, getDashboard2ChartData
 * - ECharts 막대/선형/영역 차트, 목표 저장·로드
 *
 * [의존성]
 * - React, @/shared/api/client, @/shared/utils/dateRange, @/shared/components/PeriodLabel, dashboard2/components
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDashboard2Data, getDashboard2FilterOptions, getDashboard2Tables, getDashboard2ChartData } from '@/shared/api/client'
import { normalizeDateRange } from '@/shared/utils/dateRange'
import './dashboard2.css'
import Dashboard2Header from './components/Dashboard2Header'
import CollapsibleSection2 from './components/CollapsibleSection2'
import KPICards2 from './components/KPICards2'
import ChannelDonutCharts2 from './components/ChannelDonutCharts2'
import AggregatedBarChart2 from './components/AggregatedBarChart2'
import AggregatedDataTable2 from './components/AggregatedDataTable2'
import TargetContextSection from './components/TargetContextSection'
import EChartsChart from './components/EChartsChart'
import PeriodLabel from '@/shared/components/PeriodLabel'

const TARGETS_STORAGE_KEY = 'dashboard2_targets'

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
    console.warn('dashboard2 targets save failed', e)
  }
}

/** 동일 기간+지표면 덮어쓰기, 아니면 추가 */
function mergeTarget(list, one) {
  const key = (t) => `${t.periodType}|${t.metric}|${t.year}|${t.month ?? ''}|${t.rangeStart ?? ''}|${t.rangeEnd ?? ''}`
  const oneKey = key(one)
  const idx = list.findIndex((t) => key(t) === oneKey)
  const next = [...list]
  if (idx >= 0) next[idx] = one
  else next.push(one)
  return next
}

/** Phase 4: 목표가 현재 필터 기간과 일치하는지 */
function targetMatchesPeriod(target, dateRange) {
  if (!dateRange?.length || dateRange.length < 2) return false
  const start = String(dateRange[0]).trim()
  const end = String(dateRange[1]).trim()
  const startYear = parseInt(start.slice(0, 4), 10)
  const startMonth = start.length >= 7 ? parseInt(start.slice(5, 7), 10) : 0
  const startMonthStr = start.length >= 7 ? start.slice(0, 7) : '' // YYYY-MM
  const endMonthStr = end.length >= 7 ? end.slice(0, 7) : ''

  if (target.periodType === 'year') {
    return target.year === startYear
  }
  if (target.periodType === 'month') {
    return target.year === startYear && target.month === startMonth
  }
  if (target.periodType === 'range' && target.rangeStart && target.rangeEnd) {
    return !(endMonthStr < target.rangeStart || startMonthStr > target.rangeEnd)
  }
  return false
}

/** Phase 4: 지표별 "높을수록 좋음" 여부 (실패/실패률은 낮을수록 좋음) */
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

/** Phase 4: targets + dateRange + kpi → 지표별 목표 대비 status (달성/주의/미달) */
function getTargetStatusByKey(targets, dateRange, kpi) {
  if (!targets?.length || !dateRange?.length || !kpi) return {}
  const result = {}
  for (const target of targets) {
    if (!targetMatchesPeriod(target, dateRange)) continue
    const metric = target.metric
    if (result[metric] != null) continue // 이미 해당 지표에 매칭된 목표 있음(첫 번째만 사용)
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
  const [sectionOpen, setSectionOpen] = useState({
    kpi: true,
    channel: true,
    bar: true,
    table: true,
    chartWidget: true
  })
  const [targets, setTargets] = useState([])
  const [showDimensionInfoModal, setShowDimensionInfoModal] = useState(false)

  const toggleSection = useCallback((key) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    setTargets(loadTargetsFromStorage())
  }, [])

  useEffect(() => {
    let cancelled = false
    getDashboard2Tables()
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
    getDashboard2FilterOptions(tableId, {
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
      date_range: normalizeDateRange(filters.date_range || []),
      group_by: { ...(filters.group_by || defaultGroupBy), date: true }
    }
    getDashboard2Data(payload)
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

  const handleSaveTarget = useCallback((one) => {
    setTargets((prev) => {
      const next = mergeTarget(prev, one)
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

  const sortedAggregatedData = useMemo(
    () => sortAggregatedData(data?.aggregated_data ?? [], sortOrder),
    [data?.aggregated_data, sortOrder]
  )
  const groupBy = { ...(filters.group_by ?? defaultGroupBy), date: true }
  const availableDimensions = useMemo(() => getAvailableDimensions(groupBy), [groupBy])
  const effectiveDimensionKey = availableDimensions.some((d) => d.key === dimensionKey) ? dimensionKey : (availableDimensions[0]?.key ?? 'delivery_date')
  const metricField = useMemo(() => METRIC_FIELDS.find((f) => f.key === metricKey) || METRIC_FIELDS[0], [metricKey])

  /** Phase 4: 목표 대비 달성 여부(신호등) — targets·기간·kpi 매칭 */
  const targetStatusByKey = useMemo(
    () => getTargetStatusByKey(targets, filters.date_range, data?.kpi),
    [targets, filters.date_range, data?.kpi]
  )

  useEffect(() => {
    if (!tableId || !filters.date_range?.length || filters.date_range.length < 2) {
      setChartData([])
      return
    }
    let cancelled = false
    setChartDataLoading(true)
    getDashboard2ChartData({
      table_id: tableId,
      date_range: normalizeDateRange(filters.date_range || []),
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || [],
      dimension: effectiveDimensionKey,
      metric: metricKey
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
        <Dashboard2Header
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
          <TargetContextSection
            dateRange={filters.date_range}
            targets={targets}
            onSave={handleSaveTarget}
            onDelete={handleDeleteTarget}
          />
          {data?.kpi && (
            <CollapsibleSection2 title="주요 지표" open={sectionOpen.kpi} onToggle={() => toggleSection('kpi')}>
              <PeriodLabel dateRange={filters.date_range} className="dashboard2-period-label" />
              <KPICards2 kpi={data.kpi} targetStatusByKey={targetStatusByKey}>
                <p className="dashboard2-kpi-section-hint">
                  신호등 표시: 저장된 목표 중 현재 선택한 기간(날짜 범위)과 일치하는 지표에만 신호등(달성/주의/미달)이 표시됩니다.
                </p>
              </KPICards2>
            </CollapsibleSection2>
          )}
          {data?.kpi && (
            <CollapsibleSection2 title="채널별 분석" open={sectionOpen.channel} onToggle={() => toggleSection('channel')}>
              <PeriodLabel dateRange={filters.date_range} className="dashboard2-period-label" />
              <ChannelDonutCharts2 kpi={data.kpi} />
            </CollapsibleSection2>
          )}
          {sortedAggregatedData.length > 0 && (
            <CollapsibleSection2 title="기준별 발송 현황 (발송성공수 상위 10건)" open={sectionOpen.bar} onToggle={() => toggleSection('bar')}>
              <AggregatedBarChart2 data={sortedAggregatedData} groupBy={groupBy} />
            </CollapsibleSection2>
          )}
          <CollapsibleSection2 title="집계 데이터 테이블" open={sectionOpen.table} onToggle={() => toggleSection('table')}>
            <AggregatedDataTable2
              data={sortedAggregatedData}
              groupBy={groupBy}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
          </CollapsibleSection2>
          <CollapsibleSection2 title="위젯 생성" open={sectionOpen.chartWidget} onToggle={() => toggleSection('chartWidget')}>
            <div className="dashboard2-chart-options">
              <div className="dashboard2-chart-option-col">
                <span className="dashboard2-chart-option-label" aria-hidden="true" />
                <div className="dashboard2-header__info-btn-wrap">
                  <button
                    type="button"
                    className="dashboard2-info-btn"
                    onClick={() => setShowDimensionInfoModal(true)}
                    title="Dimension(X축) 안내"
                  >
                    info
                  </button>
                </div>
              </div>
              <div className="dashboard2-chart-option-col">
                <label htmlFor="dashboard2-dimension" className="dashboard2-chart-option-label">Dimension</label>
                <select id="dashboard2-dimension" className="dashboard2-option-select" value={effectiveDimensionKey} onChange={(e) => setDimensionKey(e.target.value)}>
                  {availableDimensions.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="dashboard2-chart-option-col">
                <label htmlFor="dashboard2-metric" className="dashboard2-chart-option-label">Metric</label>
                <select id="dashboard2-metric" className="dashboard2-option-select" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
                  {METRIC_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="dashboard2-chart-option-col">
                <label htmlFor="dashboard2-chart-type" className="dashboard2-chart-option-label">차트 유형</label>
                <select id="dashboard2-chart-type" className="dashboard2-option-select" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  {CHART_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dashboard2-chart-wrap">
              {chartDataLoading && <div className="dashboard2-chart-loading">차트 데이터 조회 중…</div>}
              <EChartsChart customChartData={chartData} metricLabel={metricField.label} chartType={chartType} />
            </div>

            {showDimensionInfoModal && (
              <div
                className="dashboard2-modal-overlay"
                onClick={() => setShowDimensionInfoModal(false)}
                onKeyDown={(e) => e.key === 'Escape' && setShowDimensionInfoModal(false)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dashboard2-dimension-info-title"
              >
                <div className="dashboard2-modal" onClick={(e) => e.stopPropagation()}>
                  <h2 id="dashboard2-dimension-info-title" className="dashboard2-modal__title">
                    Dimension(X축) 안내
                  </h2>
                  <div className="dashboard2-modal__body">
                    <p className="dashboard2-modal__desc">
                      X축에는 집계 기준 중 선택한 1개만 사용하고, 나머지는 합산해 표시합니다. 일자 선택 시 기간 내 일자별로, 캠페인/워크플로우/채널 선택 시 해당 기간 전체 합산이며, 비일자 디멘션일 때는 차트에서 기준 기간을 선택할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="dashboard2-modal__close"
                    onClick={() => setShowDimensionInfoModal(false)}
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </CollapsibleSection2>
        </div>
      )}
    </div>
  )
}
