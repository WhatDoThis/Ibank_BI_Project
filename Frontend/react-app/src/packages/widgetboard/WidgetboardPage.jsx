/**
 * packages/widgetboard/WidgetboardPage.jsx (위젯보드 페이지)
 * ==========================================================
 * 왼쪽: 위젯 팔레트(드래그). 오른쪽: 캔버스(드롭). 테이블은 test_report_ 접두사만 선택 가능(allowed_tables와 별개).
 * 연결한 테이블 기준 listTables/describeTable/executeQuery → dataUtils로 KPI·차트·테이블 자동 렌더링.
 *
 * [Main Functions]
 * ===========
 * 1. 레이아웃·위젯 설정 localStorage 저장
 * 2. 위젯 타입(KPI/차트/테이블)·테이블·컬럼 선택
 * 3. react-grid-layout 드래그/리사이즈
 *
 * [Dependencies]
 * =========
 * - React, react-grid-layout, recharts, echarts, @/packages/query_studio/api/queryStudioClient.js, ./utils/dataUtils, @/shared/utils/crudConfirm.js
 * - app/auth/AuthContext projectContextNonce: 작업 프로젝트 변경 시 테이블 목록·위젯 데이터 재로드
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/app/auth/AuthContext.jsx'
import GridLayout from 'react-grid-layout/legacy'
import { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  Line,
  Bar,
  Pie,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import * as echarts from 'echarts'
import { listTables, describeTable, executeQuery } from '@/packages/query_studio/api/queryStudioClient.js'
import {
  pickDimensionAndMetric,
  aggregateForChart,
  computeKpi,
  getDateColumns,
  isNumericType,
  isDimensionType
} from './utils/dataUtils'
import './widgetboard.css'
import { PageHeader } from '@/app/layout/PageHeader.jsx'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

const LAYOUT_STORAGE_KEY = 'widgetboard_layout'
const CONFIGS_STORAGE_KEY = 'widgetboard_widget_configs'

/** 위젯보드에서 선택 가능한 테이블 접두사 (allowed_tables와 별개) */
const WIDGETBOARD_TABLE_PREFIX = 'test_report_'

const WidthProvidedGrid = WidthProvider(GridLayout)

const WIDGET_PALETTE = [
  { type: 'kpi', label: 'KPI', icon: '📊' },
  { type: 'lineChart', label: '라인 차트', icon: '📈' },
  { type: 'barChart', label: '막대 차트', icon: '📊' },
  { type: 'pieChart', label: '파이/도넛', icon: '🍩' },
  { type: 'echartsRadar', label: '레이더', icon: '📡' },
  { type: 'echartsGauge', label: '게이지', icon: '🎯' },
  { type: 'table', label: '테이블', icon: '📋' },
  { type: 'note', label: '메모', icon: '📝' }
]

const DEFAULT_SIZES = {
  kpi: { w: 3, h: 2, minW: 2, minH: 1 },
  lineChart: { w: 6, h: 4, minW: 4, minH: 2 },
  barChart: { w: 6, h: 4, minW: 4, minH: 2 },
  pieChart: { w: 4, h: 4, minW: 3, minH: 2 },
  echartsRadar: { w: 5, h: 4, minW: 4, minH: 3 },
  echartsGauge: { w: 4, h: 3, minW: 3, minH: 2 },
  table: { w: 12, h: 4, minW: 6, minH: 2 },
  note: { w: 4, h: 2, minW: 2, minH: 1 }
}

const CHART_TYPES = [
  { value: 'line', label: '라인' },
  { value: 'bar', label: '막대' },
  { value: 'pie', label: '파이' },
  { value: 'area', label: '영역' }
]

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1']

// 1.
function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 2.
function loadConfigs() {
  try {
    const raw = localStorage.getItem(CONFIGS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// 3.
function saveLayout(layout) {
  try {
    if (layout?.length) localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch (e) {
    console.warn('widgetboard layout save failed', e)
  }
}

// 4.
function saveConfigs(configs) {
  try {
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(configs))
  } catch (e) {
    console.warn('widgetboard configs save failed', e)
  }
}

// 5.
/** SQL 식별자 이스케이프 (PostgreSQL: "name" 형태) */
function escapeTableName(name) {
  if (name == null) return '""'
  const s = String(name).replace(/"/g, '""')
  return `"${s}"`
}

// 6.
function EChartsRadarGauge({ chartData, chartType, metricKey }) {
  const chartRef = useRef(null)
  const instanceRef = useRef(null)
  useEffect(() => {
    if (!chartRef.current) return
    if (!instanceRef.current) instanceRef.current = echarts.init(chartRef.current)
    if (!chartData?.length) {
      instanceRef.current.setOption({ title: { text: '데이터 없음', left: 'center', top: 'middle' } }, true)
      return
    }
    const values = chartData.map((d) => (d.value != null ? Number(d.value) : 0))
    const maxVal = Math.max(...values, 1)
    const option = chartType === 'echartsRadar'
      ? {
          radar: {
            indicator: chartData.slice(0, 8).map((d) => ({ name: (d.name || '-').slice(0, 12), max: maxVal })),
            splitNumber: 4
          },
          series: [{ type: 'radar', data: [{ value: values.slice(0, 8), name: metricKey || '값' }], areaStyle: { opacity: 0.3 } }]
        }
      : {
          series: [{
            type: 'gauge',
            startAngle: 180,
            endAngle: 0,
            min: 0,
            max: maxVal,
            progress: { show: true },
            detail: { formatter: (v) => Number(v).toLocaleString('ko-KR'), offsetCenter: [0, '70%'] },
            data: [{ value: values[0] ?? 0, name: chartData[0]?.name || metricKey || '값' }]
          }]
        }
    instanceRef.current.setOption(option, true)
  }, [chartData, chartType, metricKey])
  useEffect(() => {
    const chart = instanceRef.current
    if (!chart || !chartRef.current) return
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => () => {
    if (instanceRef.current) {
      instanceRef.current.dispose()
      instanceRef.current = null
    }
  }, [])
  return <div ref={chartRef} className="widget-echarts" style={{ width: '100%', height: '100%', minHeight: 120 }} />
}

// 7.
function WidgetBlock({
  id,
  config,
  tableData,
  onSelectTable,
  onDelete,
  onDuplicate,
  onOpenSettings,
  onNoteContentChange,
  onConfigUpdate
}) {
  if (!config) return null
  const { type, title, tableName, dimensionKey: cfgDim, metricKey: cfgMetric, chartType: cfgChartType, noteContent, visibleColumns, columnOrder, sortKey, sortDir } = config
  const typeLabel = WIDGET_PALETTE.find((p) => p.type === type)?.label || type
  const needsTable = type !== 'note'

  const { columns = [], rows = [], error, loading } = tableData || {}
  const { dimensionKey: fallbackDim, metricKey: fallbackMetric } = pickDimensionAndMetric(columns)
  const dimensionKey = cfgDim ?? fallbackDim
  const metricKey = cfgMetric ?? fallbackMetric
  const chartData = aggregateForChart(rows, dimensionKey, metricKey)
  const kpiValue = computeKpi(rows, columns, metricKey)

  const effectiveChartType = cfgChartType ?? (type === 'pieChart' ? 'pie' : type === 'barChart' ? 'bar' : type === 'lineChart' ? 'line' : 'line')

  const displayColumns = (() => {
    let cols = columns
    if (visibleColumns?.length) cols = cols.filter((c) => visibleColumns.includes(c.name))
    if (columnOrder?.length) {
      const order = columnOrder.filter((k) => cols.some((c) => c.name === k))
      const rest = cols.filter((c) => !order.includes(c.name))
      cols = [...order.map((k) => cols.find((c) => c.name === k)).filter(Boolean), ...rest]
    }
    return cols
  })()
  const sortedRows = (() => {
    if (!sortKey || !rows.length) return rows
    const dir = sortDir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const na = Number(va)
      const nb = Number(vb)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * dir
      const sa = String(va ?? '').toLowerCase()
      const sb = String(vb ?? '').toLowerCase()
      return (sa < sb ? -1 : sa > sb ? 1 : 0) * dir
    })
  })()
  const displayRows = sortedRows.slice(0, 50)

  const handleSort = (colName) => {
    if (!onConfigUpdate) return
    onConfigUpdate(id, { sortKey: colName, sortDir: sortKey === colName && sortDir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className={`widget-inner widget-${type}`}>
      <div className="widget-header">
        <span>{title || `${typeLabel} 위젯`}</span>
        <span className="widget-header-right">
          {tableName && needsTable && <span className="widget-datasource">{tableName}</span>}
          {needsTable && (
            <button type="button" className="btn-change-datasource" onClick={() => onSelectTable(id)} title="테이블 변경">
              {tableName ? '변경' : '연결'}
            </button>
          )}
          <button type="button" className="btn-widget-settings" onClick={() => onOpenSettings?.(id)} title="설정">⚙</button>
          <button type="button" className="btn-widget-duplicate" onClick={() => onDuplicate?.(id)} title="복제">⎘</button>
          <button type="button" className="btn-widget-delete" onClick={() => onDelete?.(id)} title="삭제">×</button>
        </span>
      </div>
      <div className="widget-body">
        {needsTable && !tableName && (
          <button type="button" className="btn-link-datasource" onClick={() => onSelectTable(id)}>
            테이블 연결하기
          </button>
        )}
        {needsTable && tableName && error && (
          <div className="widget-error">{error}</div>
        )}
        {needsTable && tableName && loading && (
          <div className="widget-loading">데이터 로딩 중...</div>
        )}
        {needsTable && tableName && !error && !loading && (
          <>
            {type === 'kpi' && (
              <div className="widget-kpi-value">{Number(kpiValue).toLocaleString('ko-KR')}</div>
            )}
            {(type === 'lineChart' || type === 'barChart' || type === 'pieChart') && (
              <div className="widget-chart-wrap">
                {chartData.length === 0 ? (
                  <span className="widget-placeholder">표시할 데이터가 없습니다.</span>
                ) : effectiveChartType === 'pie' ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius="50%" outerRadius="70%" paddingAngle={2} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {chartData.map((entry, idx) => <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => Number(v).toLocaleString('ko-KR')} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : effectiveChartType === 'area' ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [Number(v).toLocaleString('ko-KR'), metricKey || '값']} />
                      <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.35} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : effectiveChartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [Number(v).toLocaleString('ko-KR'), metricKey || '값']} />
                      <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [Number(v).toLocaleString('ko-KR'), metricKey || '값']} />
                      <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
            {(type === 'echartsRadar' || type === 'echartsGauge') && (
              <div className="widget-chart-wrap">
                <EChartsRadarGauge chartData={chartData} chartType={type} metricKey={metricKey} />
              </div>
            )}
            {type === 'table' && (
              <div className="widget-table-wrap">
                {rows.length === 0 ? (
                  <span className="widget-placeholder">행이 없습니다.</span>
                ) : (
                  <table className="widget-data-table">
                    <thead>
                      <tr>
                        {displayColumns.map((c) => (
                          <th key={c.name} className={sortKey === c.name ? 'sort-active' : ''} onClick={() => handleSort(c.name)} title="클릭 시 정렬">
                            {c.name} {sortKey === c.name ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, i) => (
                        <tr key={i}>
                          {displayColumns.map((c) => (
                            <td key={c.name}>{row[c.name] != null ? String(row[c.name]) : '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {rows.length > 50 && (
                  <div className="widget-table-more">외 {rows.length - 50}행 (상위 50건만 표시, 정렬 적용)</div>
                )}
              </div>
            )}
          </>
        )}
        {type === 'note' && (
          <textarea
            className="widget-note-textarea"
            value={noteContent ?? ''}
            onChange={(e) => onNoteContentChange?.(id, e.target.value)}
            placeholder="메모 내용을 입력하세요"
          />
        )}
      </div>
    </div>
  )
}

// 8.
export default function WidgetboardPage() {
  const { projectContextNonce } = useAuth()
  const prevProjectNonceRef = useRef(undefined)
  const configsRef = useRef({})
  const [layout, setLayout] = useState(loadLayout)
  const [configs, setConfigs] = useState(loadConfigs)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tableDataCache, setTableDataCache] = useState({})
  const [modalWidgetId, setModalWidgetId] = useState(null)
  const [settingsWidgetId, setSettingsWidgetId] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  configsRef.current = configs

  useEffect(() => {
    saveLayout(layout)
  }, [layout])
  useEffect(() => {
    saveConfigs(configs)
  }, [configs])

  const loadTables = useCallback(async () => {
    setTablesLoading(true)
    try {
      const data = await listTables()
      const list = data?.tables || []
      const raw = Array.isArray(list) ? list : []
      const filtered = raw.filter((t) => {
        const name = t?.table_name ?? t?.[0] ?? ''
        return String(name).startsWith(WIDGETBOARD_TABLE_PREFIX)
      })
      setTables(filtered)
    } catch (e) {
      console.warn('listTables failed', e)
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }, [])

  const loadTableData = useCallback(async (tableName, dateFilter = null) => {
    if (!tableName) return
    const dr = dateFilter ?? dateRange
    setTableDataCache((prev) => ({
      ...prev,
      [tableName]: { columns: [], rows: [], loading: true, error: null }
    }))
    try {
      const descRes = await describeTable(tableName)
      const columns = descRes?.columns || []
      const dateCols = getDateColumns(columns)
      const dateCol = dateCols[0]
      let query = `SELECT * FROM ${escapeTableName(tableName)}`
      if (dr?.start && dr?.end && dateCol) {
        const escCol = `"${String(dateCol).replace(/"/g, '""')}"`
        query += ` WHERE ${escCol} >= '${dr.start}' AND ${escCol} <= '${dr.end}'`
      }
      query += ' LIMIT 500'
      const queryRes = await executeQuery(query)
      const rows = queryRes?.data || []
      setTableDataCache((prev) => ({
        ...prev,
        [tableName]: { columns, rows, loading: false, error: null }
      }))
    } catch (e) {
      const msg = e?.message || e?.error || '데이터 로드 실패'
      setTableDataCache((prev) => ({
        ...prev,
        [tableName]: { columns: [], rows: [], loading: false, error: msg }
      }))
    }
  }, [dateRange])

  useEffect(() => {
    if (prevProjectNonceRef.current === undefined) {
      prevProjectNonceRef.current = projectContextNonce
      return
    }
    if (prevProjectNonceRef.current === projectContextNonce) return
    prevProjectNonceRef.current = projectContextNonce

    let cancelled = false
    setTableDataCache({})
    ;(async () => {
      await loadTables()
      if (cancelled) return
      const tableNames = [
        ...new Set(
          Object.values(configsRef.current)
            .map((c) => c?.tableName)
            .filter(Boolean),
        ),
      ]
      tableNames.forEach((name) => loadTableData(name))
    })()
    return () => {
      cancelled = true
    }
  }, [projectContextNonce, loadTables, loadTableData])

  useEffect(() => {
    const tableNames = new Set()
    Object.values(configs).forEach((c) => {
      if (c?.tableName) tableNames.add(c.tableName)
    })
    tableNames.forEach((name) => {
      if (tableDataCache[name] === undefined) loadTableData(name)
    })
  }, [configs, loadTableData])

  useEffect(() => {
    const tableNames = [...new Set(Object.values(configs).map((c) => c?.tableName).filter(Boolean))]
    if (dateRange?.start || dateRange?.end) {
      tableNames.forEach((name) => loadTableData(name))
    }
  }, [dateRange?.start, dateRange?.end, loadTableData])

  const handleRefresh = useCallback(() => {
    const tableNames = [...new Set(Object.values(configs).map((c) => c?.tableName).filter(Boolean))]
    tableNames.forEach((name) => loadTableData(name))
  }, [configs, loadTableData])

  const handleDelete = useCallback((widgetId) => {
    if (!confirmCrud('이 위젯을 보드에서 제거할까요? (설정은 브라우저 저장소에서 삭제됩니다)')) return
    setLayout((prev) => prev.filter((it) => it.i !== widgetId))
    setConfigs((prev) => {
      const next = { ...prev }
      delete next[widgetId]
      return next
    })
  }, [])

  const handleDuplicate = useCallback((widgetId) => {
    const cfg = configs[widgetId]
    const item = layout.find((it) => it.i === widgetId)
    if (!cfg || !item) return
    const newId = `w-${cfg.type}-${Date.now()}`
    const maxY = layout.length ? Math.max(...layout.map((it) => it.y + it.h)) : 0
    const sizes = DEFAULT_SIZES[cfg.type] || DEFAULT_SIZES.kpi
    setLayout((prev) => [
      ...prev,
      { i: newId, x: 0, y: maxY, w: sizes.w, h: sizes.h, minW: sizes.minW, minH: sizes.minH }
    ])
    setConfigs((prev) => ({ ...prev, [newId]: { ...cfg } }))
  }, [configs, layout])

  const handleConfigUpdate = useCallback((widgetId, patch) => {
    setConfigs((prev) => ({ ...prev, [widgetId]: { ...prev[widgetId], ...patch } }))
  }, [])

  const handleNoteContentChange = useCallback((widgetId, value) => {
    handleConfigUpdate(widgetId, { noteContent: value })
  }, [handleConfigUpdate])

  const applyQuickDate = (days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    })
  }

  const onLayoutChange = useCallback((newLayout) => {
    setLayout(newLayout)
  }, [])

  const handlePaletteDragStart = (e, type) => {
    e.dataTransfer.setData('application/widget-type', type)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', type)
  }

  const handleCanvasDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleCanvasDragLeave = () => {
    setDragOver(false)
  }

  const handleCanvasDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const type = e.dataTransfer.getData('application/widget-type') || e.dataTransfer.getData('text/plain')
    if (!type || !WIDGET_PALETTE.some((p) => p.type === type)) return

    const maxY = layout.length ? Math.max(...layout.map((it) => it.y + it.h)) : 0
    const newId = `w-${type}-${Date.now()}`
    const sizes = DEFAULT_SIZES[type] || DEFAULT_SIZES.kpi

    setLayout((prev) => [
      ...prev,
      {
        i: newId,
        x: 0,
        y: maxY,
        w: sizes.w,
        h: sizes.h,
        minW: sizes.minW,
        minH: sizes.minH
      }
    ])
    setConfigs((prev) => ({
      ...prev,
      [newId]: {
        type,
        title: '',
        tableName: type === 'note' ? null : undefined
      }
    }))
    if (type !== 'note') {
      setModalWidgetId(newId)
      loadTables()
    } else {
      setSettingsWidgetId(newId)
    }
  }

  const handleSelectTable = (widgetId) => {
    setModalWidgetId(widgetId)
    loadTables()
  }

  const handleTableSelect = (tableName) => {
    if (!modalWidgetId) return
    setConfigs((prev) => ({
      ...prev,
      [modalWidgetId]: { ...prev[modalWidgetId], tableName }
    }))
    setModalWidgetId(null)
  }

  const settingsConfig = settingsWidgetId ? configs[settingsWidgetId] : null
  const settingsTableData = settingsConfig?.tableName ? tableDataCache[settingsConfig.tableName] : null
  const settingsColumns = settingsTableData?.columns || []

  return (
    <div className="widgetboard">
      <PageHeader description="왼쪽에서 위젯을 드래그해 오른쪽에 놓으세요. 테이블은 test_report_ 로 시작하는 것만 선택할 수 있으며, 연결한 테이블 데이터로 자동 차트화됩니다.">
        <div className="widgetboard-header-actions">
          <div className="date-filter">
            <span className="date-filter-label">기간:</span>
            <button type="button" className="btn-quick-date" onClick={() => applyQuickDate(7)}>최근 7일</button>
            <button type="button" className="btn-quick-date" onClick={() => applyQuickDate(30)}>최근 30일</button>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))} className="date-input" />
            <span>~</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))} className="date-input" />
          </div>
          <button type="button" className="btn-refresh" onClick={handleRefresh} title="전체 새로고침">⟳ 새로고침</button>
        </div>
      </PageHeader>

      <div className="widgetboard-body">
        <aside className="widgetboard-sidebar">
          <div className="sidebar-title">위젯</div>
          <div className="widget-palette">
            {WIDGET_PALETTE.map(({ type, label, icon }) => (
              <div
                key={type}
                className="palette-item"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, type)}
              >
                <span className="palette-icon">{icon}</span>
                <span className="palette-label">{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <main
          className={`widgetboard-canvas ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          {layout.length === 0 ? (
            <div className="canvas-empty">
              <p>위젯을 왼쪽에서 드래그해 여기에 놓으세요.</p>
            </div>
          ) : (
            <WidthProvidedGrid
              className="layout"
              layout={layout}
              onLayoutChange={onLayoutChange}
              cols={12}
              rowHeight={60}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              isDraggable
              isResizable
              compactType="vertical"
              preventCollision={false}
            >
              {layout.map((item) => (
                <div key={item.i}>
                  <WidgetBlock
                    id={item.i}
                    config={configs[item.i] || { type: 'kpi', title: '위젯', tableName: undefined }}
                    tableData={configs[item.i]?.tableName ? tableDataCache[configs[item.i].tableName] : null}
                    onSelectTable={handleSelectTable}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onOpenSettings={setSettingsWidgetId}
                    onNoteContentChange={handleNoteContentChange}
                    onConfigUpdate={handleConfigUpdate}
                  />
                </div>
              ))}
            </WidthProvidedGrid>
          )}
        </main>
      </div>

      {modalWidgetId && (
        <div className="modal-overlay" onClick={() => setModalWidgetId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>연결할 테이블 선택 (test_report_*)</h3>
              <button type="button" className="modal-close" onClick={() => setModalWidgetId(null)} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="modal-body">
              {tablesLoading ? (
                <p className="modal-loading">테이블 목록 로딩 중...</p>
              ) : tables.length === 0 ? (
                <p className="modal-empty">
                  <strong>test_report_</strong> 로 시작하는 테이블이 없습니다.
                </p>
              ) : (
                <ul className="table-list">
                  {tables.map((t) => {
                    const name = t?.table_name ?? t?.[0] ?? String(t)
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          className="table-list-btn"
                          onClick={() => handleTableSelect(name)}
                        >
                          {name}
                          {t?.size != null && <span className="table-size">{t.size}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsWidgetId && settingsConfig && (
        <div className="modal-overlay" onClick={() => setSettingsWidgetId(null)}>
          <div className="modal-content modal-settings" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>위젯 설정</h3>
              <button type="button" className="modal-close" onClick={() => setSettingsWidgetId(null)} aria-label="닫기">×</button>
            </div>
            <div className="modal-body">
              {settingsConfig.type === 'note' && (
                <div className="settings-row">
                  <label>메모 내용</label>
                  <textarea
                    value={settingsConfig.noteContent ?? ''}
                    onChange={(e) => handleConfigUpdate(settingsWidgetId, { noteContent: e.target.value })}
                    className="settings-textarea"
                    rows={6}
                  />
                </div>
              )}
              {settingsConfig.type !== 'note' && ['kpi', 'lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge'].includes(settingsConfig.type) && (
                <>
                  {settingsColumns.length > 0 && (
                    <>
                      {['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge'].includes(settingsConfig.type) && (
                        <div className="settings-row">
                          <label>Dimension (X축/레이블)</label>
                          <select
                            value={settingsConfig.dimensionKey ?? ''}
                            onChange={(e) => handleConfigUpdate(settingsWidgetId, { dimensionKey: e.target.value || null })}
                          >
                            <option value="">자동</option>
                            {settingsColumns.filter((c) => isDimensionType(c?.type)).map((c) => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="settings-row">
                        <label>Metric (숫자)</label>
                        <select
                          value={settingsConfig.metricKey ?? ''}
                          onChange={(e) => handleConfigUpdate(settingsWidgetId, { metricKey: e.target.value || null })}
                        >
                          <option value="">자동</option>
                          {settingsColumns.filter((c) => isNumericType(c?.type)).map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {['lineChart', 'barChart', 'pieChart'].includes(settingsConfig.type) && (
                    <div className="settings-row">
                      <label>차트 유형</label>
                      <select
                        value={settingsConfig.chartType ?? 'line'}
                        onChange={(e) => handleConfigUpdate(settingsWidgetId, { chartType: e.target.value })}
                      >
                        {CHART_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {settingsConfig.type === 'table' && settingsColumns.length > 0 && (
                <>
                  <div className="settings-row">
                    <label>표시 컬럼 (체크 해제 시 숨김)</label>
                    <div className="settings-columns">
                      {settingsColumns.map((c) => {
                        const currentVisible = settingsConfig.visibleColumns && settingsConfig.visibleColumns.length > 0
                          ? settingsConfig.visibleColumns
                          : settingsColumns.map((x) => x.name)
                        const checked = currentVisible.includes(c.name)
                        return (
                          <label key={c.name} className="settings-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...currentVisible.filter((x) => x !== c.name), c.name]
                                  : currentVisible.filter((x) => x !== c.name)
                                handleConfigUpdate(settingsWidgetId, { visibleColumns: next.length ? next : settingsColumns.map((x) => x.name) })
                              }}
                            />
                            {c.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div className="settings-row">
                    <label>컬럼 순서</label>
                    <p className="settings-hint">드래그하여 순서 변경</p>
                    <div className="settings-column-order">
                      {(() => {
                        const order = settingsConfig.columnOrder?.length
                          ? settingsConfig.columnOrder.filter((k) => settingsColumns.some((c) => c.name === k))
                          : settingsColumns.map((c) => c.name)
                        const rest = settingsColumns.filter((c) => !order.includes(c.name)).map((c) => c.name)
                        return [...order, ...rest]
                      })().map((colName) => (
                          <div key={colName} className="column-order-item" draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', colName) }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const from = e.dataTransfer.getData('text/plain')
                              const to = e.currentTarget.getAttribute('data-col')
                              if (!to || from === to) return
                              const order = settingsConfig.columnOrder || settingsColumns.map((c) => c.name)
                              const idxFrom = order.indexOf(from)
                              const idxTo = order.indexOf(to)
                              if (idxFrom < 0 || idxTo < 0) return
                              const next = [...order]
                              next.splice(idxFrom, 1)
                              next.splice(idxTo, 0, from)
                              handleConfigUpdate(settingsWidgetId, { columnOrder: next })
                            }}
                            data-col={colName}
                          >
                            ⋮⋮ {colName}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="settings-row">
                    <label>기본 정렬</label>
                    <select
                      value={settingsConfig.sortKey ?? ''}
                      onChange={(e) => handleConfigUpdate(settingsWidgetId, { sortKey: e.target.value || null })}
                    >
                      <option value="">없음</option>
                      {settingsColumns.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {settingsConfig.sortKey && (
                      <select
                        value={settingsConfig.sortDir ?? 'asc'}
                        onChange={(e) => handleConfigUpdate(settingsWidgetId, { sortDir: e.target.value })}
                        className="settings-sort-dir"
                      >
                        <option value="asc">오름차순</option>
                        <option value="desc">내림차순</option>
                      </select>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
