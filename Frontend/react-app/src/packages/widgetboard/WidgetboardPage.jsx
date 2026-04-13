/**
 * packages/widgetboard/WidgetboardPage.jsx (위젯보드 캔버스)
 * ======================================================
 * 라우트 `/widgetboard/:boardId`. 왼쪽: 위젯 팔레트(드롭). 오른쪽: 캔버스. 목록은 WidgetboardListPage.
 * 연결한 테이블 기준 listTables/describeTable/executeQuery → dataUtils로 KPI·차트·테이블 자동 렌더링.
 *
 * [Main Functions]
 * ===========
 * 1. /api/widget-boards 보드·위젯 CRUD·레이아웃 PATCH·데이터 fetch(저장 테이블)
 * 2. 데이터 위젯: 생성 마법사·설정 모달(취소 시 스냅샷 복구·확인 닫기·오버레이 비닫기)에서 테이블(list-tables=프로젝트 매핑 전체)·기간·지표·(단일 일) 차원; PATCH 완료 후 fetchWidgetData
 * 3. react-grid-layout 드래그/리사이즈(수정 권한 시에만)
 *
 * [Dependencies]
 * =========
 * - React, react-grid-layout, recharts, echarts, @/shared/api/queryStudioTableApi.js, ./api/widgetBoardClient.js, ./utils/dataUtils, ./utils/dateRangePolicy.js(formatWidgetPeriodSubtitle·formatWidgetPeriodSubtitleCompact), ./components/WidgetDataWizardModal.jsx, @/shared/utils/crudConfirm.js
 * - app/auth/AuthContext projectContextNonce·me: 프로젝트 변경 시 보드·위젯 API 재로드
 * - app/layout/ShellChromeOverrideContext: 셸·브레드크럼에 보드명 반영
 * - 프로젝트 변경·보드 없음·권한 없음(로드 실패) 시 `/widgetboard` 목록으로 replace 네비게이션(URL·캔버스 정리)
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { listTables, describeTable, executeQuery } from '@/shared/api/queryStudioTableApi.js'
import {
  getWidgetBoard,
  addWidget,
  updateWidget,
  deleteWidget,
  patchWidgetBoardLayout,
  fetchWidgetData
} from '@/packages/widgetboard/api/widgetBoardClient.js'
import {
  pickDimensionAndMetric,
  aggregateForChart,
  aggregateForChartByTimeGrain,
  computeKpi,
  getDateColumns,
  resolveWidgetDateColumnName,
  isNumericType,
  isDimensionType,
  isDateType
} from './utils/dataUtils'
import {
  defaultRangeForGrain,
  validateWidgetDateRange,
  formatWidgetPeriodSubtitle,
  formatWidgetPeriodSubtitleCompact,
  isMultiDayWidgetRange
} from './utils/dateRangePolicy.js'
import './widgetboard.css'
import '@/app/admin/admin-pages.css'
import { PageHeader } from '@/app/layout/PageHeader.jsx'
import { useShellChrome } from '@/app/layout/ShellChromeOverrideContext.jsx'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'
import { WidgetDataWizardModal } from '@/packages/widgetboard/components/WidgetDataWizardModal.jsx'

/** API data_config 페이로드에 실을 키(제목·테이블 제외) */
const WIDGET_DATA_CONFIG_KEYS = [
  'noteContent',
  'dimensionKey',
  'metricKey',
  'chartType',
  'visibleColumns',
  'columnOrder',
  'sortKey',
  'sortDir',
  'dateGrain',
  'dateStart',
  'dateEnd',
  'dateColumn',
  'limit'
]

// 0.
/** 위젯 패치 시 서버에 보낼 data_config 병합(prev + patch) */
function buildDataConfigForApi(prevCfg, patch) {
  const o = {}
  WIDGET_DATA_CONFIG_KEYS.forEach((k) => {
    if (k === 'dateColumn' && patch[k] === '') {
      return
    }
    let v
    if (patch[k] !== undefined) v = patch[k]
    else v = prevCfg[k]
    if (v !== undefined && v !== null && v !== '') o[k] = v
  })
  if (prevCfg.minW != null) o.minW = prevCfg.minW
  if (prevCfg.minH != null) o.minH = prevCfg.minH
  return o
}

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

const DATA_LIKE_WIDGET_TYPES = ['kpi', 'lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge', 'table']

// 1.
/** GET 보드 상세 → react-grid-layout·configs 상태 */
function mapServerDetailToState(detail) {
  const widgets = detail?.widgets || []
  const nextLayout = []
  const nextConfigs = {}
  for (const w of widgets) {
    const id = String(w.widget_item_id)
    const L = w.layout || {}
    const dc = w.data_config && typeof w.data_config === 'object' ? w.data_config : {}
    const sz = DEFAULT_SIZES[w.widget_type] || DEFAULT_SIZES.kpi
    nextLayout.push({
      i: id,
      x: L.x ?? 0,
      y: L.y ?? 0,
      w: L.w ?? 6,
      h: L.h ?? 4,
      minW: dc.minW ?? sz.minW,
      minH: dc.minH ?? sz.minH
    })
    nextConfigs[id] = {
      type: w.widget_type,
      title: w.widget_title || '',
      tableName: w.data_source_type === 'saved_table' ? w.data_source_ref : undefined,
      noteContent: dc.noteContent,
      dimensionKey: dc.dimensionKey ?? null,
      metricKey: dc.metricKey ?? null,
      chartType: dc.chartType,
      visibleColumns: dc.visibleColumns,
      columnOrder: dc.columnOrder,
      sortKey: dc.sortKey ?? null,
      sortDir: dc.sortDir,
      dateGrain: dc.dateGrain,
      dateStart: dc.dateStart,
      dateEnd: dc.dateEnd,
      dateColumn: dc.dateColumn,
      minW: dc.minW ?? sz.minW,
      minH: dc.minH ?? sz.minH,
      widgetItemId: w.widget_item_id,
      dataSourceType: w.data_source_type
    }
  }
  return { layout: nextLayout, configs: nextConfigs }
}

// 2.
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
  canEdit = true,
  onDelete,
  onDuplicate,
  onOpenSettings,
  onNoteContentChange,
  onConfigUpdate
}) {
  if (!config) return null
  const {
    type,
    title,
    tableName,
    dimensionKey: cfgDim,
    metricKey: cfgMetric,
    chartType: cfgChartType,
    noteContent,
    visibleColumns,
    columnOrder,
    sortKey,
    sortDir,
    dateStart,
    dateEnd,
    dateGrain,
    dateColumn
  } = config
  const typeLabel = WIDGET_PALETTE.find((p) => p.type === type)?.label || type
  const needsTable = type !== 'note'
  const periodCfg = { dateStart, dateEnd, dateGrain }
  const periodSubtitleFull = needsTable && tableName ? formatWidgetPeriodSubtitle(periodCfg) : ''
  const periodSubtitleDisplay =
    needsTable && tableName ? formatWidgetPeriodSubtitleCompact(periodCfg) : ''

  const { columns = [], rows = [], error, loading, appliedDateColumn: serverAppliedDate } = tableData || {}
  const { dimensionKey: fallbackDim, metricKey: fallbackMetric } = pickDimensionAndMetric(columns)
  /** 복수 일 차트는 날짜 버킷 집계만 사용 — 서버가 알려 준 applied_date_column·컬럼 type 없이는 category 축으로 campaign_id 등이 잘못 쓰이기 쉬움 */
  const resolvedDateCol =
    resolveWidgetDateColumnName(columns, dateColumn) ||
    (serverAppliedDate ? String(serverAppliedDate) : null)
  const multiDay = isMultiDayWidgetRange(dateStart, dateEnd)
  const chartTypesTime = ['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge']
  const useTimeGrainChart =
    multiDay && resolvedDateCol && chartTypesTime.includes(type)
  const dimensionKey = cfgDim ?? fallbackDim
  const metricKey = cfgMetric ?? fallbackMetric
  const chartData = useTimeGrainChart
    ? aggregateForChartByTimeGrain(rows, resolvedDateCol, metricKey, dateGrain || 'day')
    : multiDay && chartTypesTime.includes(type)
      ? []
      : aggregateForChart(rows, dimensionKey, metricKey)
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
    if (!canEdit || !onConfigUpdate) return
    onConfigUpdate(id, { sortKey: colName, sortDir: sortKey === colName && sortDir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className={`widget-inner widget-${type}`}>
      <div className="widget-header">
        <div className="widget-header-title-line">
          <span className="widget-title-text">{title || `${typeLabel} 위젯`}</span>
          {canEdit ? (
            <div className="widget-header-inline-actions">
              <button type="button" className="btn-widget-settings" onClick={() => onOpenSettings?.(id)} title="설정">
                ⚙
              </button>
              <button type="button" className="btn-widget-duplicate" onClick={() => onDuplicate?.(id)} title="복제">
                ⎘
              </button>
              <button type="button" className="btn-widget-delete" onClick={() => onDelete?.(id)} title="삭제">
                ×
              </button>
            </div>
          ) : null}
        </div>
        {periodSubtitleDisplay ? (
          <span
            className="widget-date-range"
            title={periodSubtitleFull ? `조회 적용 기간 — ${periodSubtitleFull}` : undefined}
          >
            {periodSubtitleDisplay}
          </span>
        ) : null}
      </div>
      <div className="widget-body">
        {needsTable && !tableName && canEdit && (
          <button type="button" className="btn-link-datasource" onClick={() => onOpenSettings?.(id)} title="설정에서 테이블·지표를 연결합니다">
            설정에서 테이블 연결
          </button>
        )}
        {needsTable && !tableName && !canEdit && (
          <span className="widget-placeholder">테이블이 연결되지 않았습니다.</span>
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
                          <th key={c.name} className={sortKey === c.name ? 'sort-active' : ''} onClick={() => handleSort(c.name)} title={canEdit ? '클릭 시 정렬' : ''} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
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
            readOnly={!canEdit}
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
  const { boardId: boardIdParam } = useParams()
  const navigate = useNavigate()
  const numericBoardId = useMemo(() => {
    const n = parseInt(String(boardIdParam), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [boardIdParam])
  const { projectContextNonce, me } = useAuth()
  const prevProjectNonceRef = useRef(undefined)
  const configsRef = useRef({})
  const selectedBoardIdRef = useRef(null)
  const pendingLayoutRef = useRef(null)
  const layoutDebounceTimerRef = useRef(null)
  const [layout, setLayout] = useState([])
  const [configs, setConfigs] = useState({})
  const [selectedBoardId, setSelectedBoardId] = useState(null)
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [boardInitError, setBoardInitError] = useState(null)
  const [canEditBoard, setCanEditBoard] = useState(true)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tableDataCache, setTableDataCache] = useState({})
  /** null | { mode:'create', widgetType } */
  const [dataWizard, setDataWizard] = useState(null)
  const [settingsWidgetId, setSettingsWidgetId] = useState(null)
  /** 설정 모달 오픈 시점 config — 취소 시 서버·로컬 복구 */
  const settingsModalSnapshotRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  /** 셸 헤더·브레드크럼·PageHeader 제목 — GET 보드 상세의 board_name */
  const [boardDisplayName, setBoardDisplayName] = useState('')
  const { setOverride: setShellChromeOverride } = useShellChrome()

  configsRef.current = configs
  selectedBoardIdRef.current = selectedBoardId

  const cacheKeyForConfig = useCallback((cfg) => {
    if (cfg?.widgetItemId != null) {
      const p = [String(cfg.widgetItemId)]
      if (cfg.tableName) p.push(String(cfg.tableName))
      if (cfg.dateStart) p.push(String(cfg.dateStart))
      if (cfg.dateEnd) p.push(String(cfg.dateEnd))
      if (cfg.dateGrain) p.push(String(cfg.dateGrain))
      if (cfg.dateColumn) p.push(String(cfg.dateColumn))
      return p.join(':')
    }
    if (cfg?.tableName) return cfg.tableName
    return null
  }, [])

  const hydrateFromServer = useCallback(async (boardId) => {
    const detail = await getWidgetBoard(boardId)
    const label = (detail?.board_name || '').trim() || `보드 ${boardId}`
    setBoardDisplayName(label)
    const mapped = mapServerDetailToState(detail)
    setLayout(mapped.layout)
    setConfigs(mapped.configs)
    setCanEditBoard(Boolean(detail?.can_edit))
    setTableDataCache({})
  }, [])

  const loadTables = useCallback(async () => {
    setTablesLoading(true)
    try {
      const data = await listTables()
      const list = data?.tables || []
      const raw = Array.isArray(list) ? list : []
      /** listTables = 현재 작업 프로젝트에 매핑된 테이블 전체(main/dash, query_studio /api/list-tables) */
      setTables(raw)
    } catch (e) {
      console.warn('listTables failed', e)
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }, [])

  /** 서버 위젯: /widgets/{id}/data. 로컬 폴백(비상): describe + executeQuery + 기간 필터 */
  const loadWidgetDataset = useCallback(
    async (cfg) => {
      const key = cacheKeyForConfig(cfg)
      if (!key) return
      const bid = selectedBoardIdRef.current
      const wid = cfg?.widgetItemId
      setTableDataCache((prev) => ({
        ...prev,
        [key]: { columns: [], rows: [], loading: true, error: null, appliedDateColumn: null }
      }))
      try {
        if (bid != null && wid != null && cfg?.type !== 'note') {
          const data = await fetchWidgetData(bid, wid)
          const cols = (data?.columns || []).map((c) => ({
            name: c.name,
            type: c.type || 'text'
          }))
          const rows = data?.rows || []
          const applied =
            data?.meta && data.meta.applied_date_column != null
              ? String(data.meta.applied_date_column)
              : null
          setTableDataCache((prev) => ({
            ...prev,
            [key]: { columns: cols, rows, loading: false, error: null, appliedDateColumn: applied }
          }))
          return
        }
        const tableName = cfg?.tableName
        if (!tableName) {
          setTableDataCache((prev) => ({
            ...prev,
            [key]: { columns: [], rows: [], loading: false, error: null, appliedDateColumn: null }
          }))
          return
        }
        const dr = { start: cfg?.dateStart, end: cfg?.dateEnd }
        const descRes = await describeTable(tableName)
        const columns = descRes?.columns || []
        const dateCols = getDateColumns(columns)
        const dateCol = (cfg?.dateColumn && columns.some((c) => c.name === cfg.dateColumn) ? cfg.dateColumn : null) || dateCols[0]
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
          [key]: {
            columns,
            rows,
            loading: false,
            error: null,
            appliedDateColumn: dr?.start && dr?.end && dateCol ? String(dateCol) : null
          }
        }))
      } catch (e) {
        const msg = e?.message || e?.error || '데이터 로드 실패'
        setTableDataCache((prev) => ({
          ...prev,
          [key]: { columns: [], rows: [], loading: false, error: msg, appliedDateColumn: null }
        }))
      }
    },
    [cacheKeyForConfig]
  )

  useEffect(() => {
    let cancelled = false
    setBoardInitError(null)
    if (!me?.project_info_id) {
      setBoardsLoading(false)
      setBoardDisplayName('')
      setSelectedBoardId(null)
      setLayout([])
      setConfigs({})
      return undefined
    }
    if (numericBoardId == null) {
      setBoardsLoading(false)
      setBoardDisplayName('')
      setSelectedBoardId(null)
      setLayout([])
      setConfigs({})
      navigate('/widgetboard', { replace: true })
      return undefined
    }
    setBoardsLoading(true)
    setBoardDisplayName('')
    setSelectedBoardId(numericBoardId)
    ;(async () => {
      try {
        await hydrateFromServer(numericBoardId)
        if (cancelled) return
      } catch (e) {
        if (!cancelled) {
          setBoardDisplayName('')
          setSelectedBoardId(null)
          setLayout([])
          setConfigs({})
          navigate('/widgetboard', { replace: true })
        }
      } finally {
        if (!cancelled) setBoardsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectContextNonce, me?.project_info_id, numericBoardId, hydrateFromServer, navigate])

  useEffect(() => {
    const n = (boardDisplayName || '').trim()
    if (!numericBoardId || !n) {
      setShellChromeOverride(null)
      return
    }
    setShellChromeOverride({ shellTitle: n, breadcrumbCurrent: n })
    return () => setShellChromeOverride(null)
  }, [numericBoardId, boardDisplayName, setShellChromeOverride])

  useEffect(() => {
    if (prevProjectNonceRef.current === undefined) {
      prevProjectNonceRef.current = projectContextNonce
      return
    }
    if (prevProjectNonceRef.current === projectContextNonce) return
    prevProjectNonceRef.current = projectContextNonce
    setTableDataCache({})
    loadTables().catch(() => {})
  }, [projectContextNonce, loadTables])

  useEffect(() => {
    Object.values(configs).forEach((c) => {
      if (c?.type === 'note') return
      const k = cacheKeyForConfig(c)
      if (!k || !c?.tableName) return
      if (tableDataCache[k] === undefined) loadWidgetDataset(c)
    })
  }, [configs, cacheKeyForConfig, loadWidgetDataset, tableDataCache])

  const flushLayoutToServer = useCallback(() => {
    const bid = selectedBoardIdRef.current
    if (bid == null || !canEditBoard) return
    const lay = pendingLayoutRef.current
    if (!lay?.length) return
    const items = lay.map((it) => ({
      widget_item_id: Number(it.i),
      layout_x: it.x,
      layout_y: it.y,
      layout_w: it.w,
      layout_h: it.h
    }))
    patchWidgetBoardLayout(bid, items).catch((e) => console.warn('patchWidgetBoardLayout', e))
  }, [canEditBoard])

  const handleRefresh = useCallback(() => {
    Object.values(configs).forEach((c) => {
      if (c?.type !== 'note' && (c?.widgetItemId != null || c?.tableName)) loadWidgetDataset(c)
    })
  }, [configs, loadWidgetDataset])

  const handleDelete = useCallback(
    async (widgetId) => {
      if (!confirmCrud('이 위젯을 보드에서 제거할까요?')) return
      const bid = selectedBoardIdRef.current
      const wn = Number(widgetId)
      if (bid != null && canEditBoard && !Number.isNaN(wn)) {
        try {
          await deleteWidget(bid, wn)
        } catch (e) {
          console.warn('deleteWidget', e)
          return
        }
      }
      setLayout((prev) => prev.filter((it) => it.i !== widgetId))
      setConfigs((prev) => {
        const next = { ...prev }
        delete next[widgetId]
        return next
      })
    },
    [canEditBoard]
  )

  const handleDuplicate = useCallback(
    async (widgetId) => {
      const cfg = configs[widgetId]
      const item = layout.find((it) => it.i === widgetId)
      const bid = selectedBoardIdRef.current
      if (!cfg || !item || bid == null || !canEditBoard) return
      const maxY = layout.length ? Math.max(...layout.map((it) => it.y + it.h)) : 0
      const dc = {
        noteContent: cfg.noteContent,
        dimensionKey: cfg.dimensionKey,
        metricKey: cfg.metricKey,
        chartType: cfg.chartType,
        visibleColumns: cfg.visibleColumns,
        columnOrder: cfg.columnOrder,
        sortKey: cfg.sortKey,
        sortDir: cfg.sortDir,
        dateGrain: cfg.dateGrain,
        dateStart: cfg.dateStart,
        dateEnd: cfg.dateEnd,
        dateColumn: cfg.dateColumn,
        minW: item.minW,
        minH: item.minH
      }
      try {
        const row = await addWidget(bid, {
          widget_type: cfg.type,
          widget_title: cfg.title || '',
          data_source_type: cfg.type === 'note' ? 'query' : 'saved_table',
          data_source_query: cfg.type === 'note' ? 'SELECT 1 LIMIT 0' : null,
          data_source_ref: cfg.tableName || null,
          data_config: dc,
          layout_x: 0,
          layout_y: maxY,
          layout_w: item.w,
          layout_h: item.h,
          widget_order: 0
        })
        const id = String(row.widget_item_id)
        setLayout((prev) => [
          ...prev,
          {
            i: id,
            x: 0,
            y: maxY,
            w: item.w,
            h: item.h,
            minW: item.minW,
            minH: item.minH
          }
        ])
        setConfigs((prev) => ({
          ...prev,
          [id]: {
            ...cfg,
            widgetItemId: row.widget_item_id,
            dataSourceType: row.data_source_type
          }
        }))
        if (cfg.tableName) loadWidgetDataset({ ...cfg, widgetItemId: row.widget_item_id })
      } catch (e) {
        console.warn('addWidget duplicate', e)
      }
    },
    [configs, layout, canEditBoard, loadWidgetDataset]
  )

  /** PATCH 성공 후에만 데이터 조회: 서버 /widgets/{id}/data 는 DB의 data_config 를 읽으므로, PATCH 전에 fetch 하면 이전 기간·설정이 나올 수 있음 */
  const persistWidgetPatch = useCallback(
    (widgetId, patch, prevCfg, nextCfg) => {
      const bid = selectedBoardIdRef.current
      const wid = prevCfg?.widgetItemId
      if (bid == null || wid == null || !canEditBoard) return undefined
      const body = {}
      if (patch.widget_title !== undefined || patch.title !== undefined) {
        body.widget_title = patch.title ?? patch.widget_title ?? ''
      }
      if (patch.tableName !== undefined) {
        body.data_source_ref = patch.tableName
        body.data_source_type = 'saved_table'
      }
      const touchesDc = WIDGET_DATA_CONFIG_KEYS.some((k) => patch[k] !== undefined)
      if (touchesDc) {
        body.data_config = buildDataConfigForApi(prevCfg || {}, patch)
      }
      if (Object.keys(body).length === 0) return undefined
      const reloadData =
        nextCfg &&
        nextCfg.type !== 'note' &&
        (patch.tableName !== undefined ||
          WIDGET_DATA_CONFIG_KEYS.some((k) => patch[k] !== undefined))
      return updateWidget(bid, wid, body)
        .then(() => {
          if (reloadData) loadWidgetDataset(nextCfg)
        })
        .catch((e) => console.warn('updateWidget', e))
    },
    [canEditBoard, loadWidgetDataset]
  )

  /** 설정 취소 시 전체 cfg를 스냅샷으로 되돌릴 때 한 번에 PATCH */
  const persistWidgetFullConfig = useCallback(
    (widgetId, cfg) => {
      const bid = selectedBoardIdRef.current
      const wid = cfg?.widgetItemId
      if (bid == null || wid == null || !canEditBoard || !cfg) return undefined
      const body = {
        widget_title: cfg.title ?? '',
        data_config: buildDataConfigForApi(cfg, {})
      }
      if (cfg.type === 'note') {
        body.data_source_type = cfg.dataSourceType || 'query'
        body.data_source_query = 'SELECT 1 LIMIT 0'
        body.data_source_ref = null
      } else {
        body.data_source_type = 'saved_table'
        body.data_source_ref = cfg.tableName ?? null
      }
      return updateWidget(bid, wid, body)
        .then(() => {
          if (cfg.type !== 'note') loadWidgetDataset(cfg)
        })
        .catch((e) => console.warn('updateWidget full', e))
    },
    [canEditBoard, loadWidgetDataset]
  )

  const handleOpenSettings = useCallback((id) => {
    const c = configsRef.current[id]
    settingsModalSnapshotRef.current = c ? JSON.parse(JSON.stringify(c)) : null
    setSettingsWidgetId(id)
  }, [])

  const handleSettingsConfirmClose = useCallback(() => {
    settingsModalSnapshotRef.current = null
    setSettingsWidgetId(null)
  }, [])

  const handleSettingsCancel = useCallback(() => {
    const id = settingsWidgetId
    const snap = settingsModalSnapshotRef.current
    if (id && snap) {
      setConfigs((prev) => ({ ...prev, [id]: { ...snap } }))
      persistWidgetFullConfig(id, snap)
    }
    settingsModalSnapshotRef.current = null
    setSettingsWidgetId(null)
  }, [settingsWidgetId, persistWidgetFullConfig])

  const handleConfigUpdate = useCallback(
    (widgetId, patch) => {
      setConfigs((prev) => {
        const prevCfg = prev[widgetId]
        const nextCfg = { ...prevCfg, ...patch }
        const next = { ...prev, [widgetId]: nextCfg }
        persistWidgetPatch(widgetId, patch, prevCfg, nextCfg)
        return next
      })
    },
    [persistWidgetPatch]
  )

  /** 기간·단위 변경 시 복수 일이면 dimensionKey 제거(차트 X축은 기간 단위 자동 집계) */
  const handleDataWidgetRangePatch = useCallback(
    (widgetId, patch) => {
      setConfigs((prev) => {
        const prevCfg = prev[widgetId]
        if (!prevCfg) return prev
        const merged = { ...prevCfg, ...patch }
        const extra = isMultiDayWidgetRange(merged.dateStart, merged.dateEnd) ? { dimensionKey: null } : {}
        const fullPatch = { ...patch, ...extra }
        const nextCfg = { ...prevCfg, ...fullPatch }
        const next = { ...prev, [widgetId]: nextCfg }
        persistWidgetPatch(widgetId, fullPatch, prevCfg, nextCfg)
        return next
      })
    },
    [persistWidgetPatch]
  )

  const handleNoteContentChange = useCallback(
    (widgetId, value) => {
      handleConfigUpdate(widgetId, { noteContent: value })
    },
    [handleConfigUpdate]
  )

  const onLayoutChange = useCallback(
    (newLayout) => {
      setLayout(newLayout)
      if (!canEditBoard) return
      pendingLayoutRef.current = newLayout
      if (layoutDebounceTimerRef.current) clearTimeout(layoutDebounceTimerRef.current)
      layoutDebounceTimerRef.current = setTimeout(() => {
        layoutDebounceTimerRef.current = null
        flushLayoutToServer()
      }, 600)
    },
    [canEditBoard, flushLayoutToServer]
  )

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

    const bid = selectedBoardIdRef.current
    if (!canEditBoard || bid == null) {
      console.warn('handleCanvasDrop: 수정 권한이 없거나 보드가 없습니다.')
      return
    }

    const sizes = DEFAULT_SIZES[type] || DEFAULT_SIZES.kpi
    const isNote = type === 'note'

    if (isNote) {
      const maxY = layout.length ? Math.max(...layout.map((it) => it.y + it.h)) : 0
      ;(async () => {
        try {
          const row = await addWidget(bid, {
            widget_type: type,
            widget_title: '',
            data_source_type: 'query',
            data_source_query: 'SELECT 1 LIMIT 0',
            data_source_ref: null,
            data_config: {},
            layout_x: 0,
            layout_y: maxY,
            layout_w: sizes.w,
            layout_h: sizes.h,
            widget_order: 0
          })
          const newId = String(row.widget_item_id)
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
          const newCfg = {
            type,
            title: '',
            tableName: null,
            widgetItemId: row.widget_item_id,
            dataSourceType: row.data_source_type
          }
          setConfigs((prev) => ({
            ...prev,
            [newId]: newCfg
          }))
          settingsModalSnapshotRef.current = JSON.parse(JSON.stringify(newCfg))
          setSettingsWidgetId(newId)
        } catch (err) {
          console.warn('addWidget', err)
        }
      })()
      return
    }

    setDataWizard({ mode: 'create', widgetType: type })
    loadTables()
  }

  const handleDataWizardSubmit = useCallback(
    async (payload) => {
      if (!dataWizard || !canEditBoard) return
      const bid = selectedBoardIdRef.current
      if (bid == null) return

      if (dataWizard.widgetType) {
        const type = dataWizard.widgetType
        const maxY = layout.length ? Math.max(...layout.map((it) => it.y + it.h)) : 0
        const sz = DEFAULT_SIZES[type] || DEFAULT_SIZES.kpi
        const dcBase = {
          dateGrain: payload.dateGrain,
          dateStart: payload.dateStart,
          dateEnd: payload.dateEnd,
          minW: sz.minW,
          minH: sz.minH
        }
        if (payload.dateColumn) dcBase.dateColumn = payload.dateColumn
        if (payload.metricKey) dcBase.metricKey = payload.metricKey
        if (payload.dimensionKey) dcBase.dimensionKey = payload.dimensionKey
        try {
          const row = await addWidget(bid, {
            widget_type: type,
            widget_title: payload.title?.trim() || '새 위젯',
            data_source_type: 'saved_table',
            data_source_query: null,
            data_source_ref: payload.tableName,
            data_config: dcBase,
            layout_x: 0,
            layout_y: maxY,
            layout_w: sz.w,
            layout_h: sz.h,
            widget_order: 0
          })
          const newId = String(row.widget_item_id)
          setLayout((prev) => [
            ...prev,
            {
              i: newId,
              x: 0,
              y: maxY,
              w: sz.w,
              h: sz.h,
              minW: sz.minW,
              minH: sz.minH
            }
          ])
          setConfigs((prev) => ({
            ...prev,
            [newId]: {
              type,
              title: payload.title?.trim() || '',
              tableName: payload.tableName,
              dateGrain: payload.dateGrain,
              dateStart: payload.dateStart,
              dateEnd: payload.dateEnd,
              dateColumn: payload.dateColumn || undefined,
              metricKey: payload.metricKey || null,
              dimensionKey: payload.dimensionKey || null,
              minW: sz.minW,
              minH: sz.minH,
              widgetItemId: row.widget_item_id,
              dataSourceType: 'saved_table'
            }
          }))
          loadWidgetDataset({
            type,
            title: payload.title,
            tableName: payload.tableName,
            dateGrain: payload.dateGrain,
            dateStart: payload.dateStart,
            dateEnd: payload.dateEnd,
            dateColumn: payload.dateColumn || undefined,
            metricKey: payload.metricKey || null,
            dimensionKey: payload.dimensionKey || null,
            widgetItemId: row.widget_item_id
          })
        } catch (err) {
          console.warn('addWidget wizard', err)
        }
        setDataWizard(null)
        return
      }
    },
    [dataWizard, canEditBoard, layout, loadWidgetDataset]
  )

  const settingsConfig = settingsWidgetId ? configs[settingsWidgetId] : null
  const settingsCacheKey = settingsConfig ? cacheKeyForConfig(settingsConfig) : null
  const settingsTableData = settingsCacheKey ? tableDataCache[settingsCacheKey] : null
  const settingsColumns = settingsTableData?.columns || []
  /** 복수 일(시작≠끝)이면 차원은 기간 단위로 자동 집계·셀렉트 비활성. 단일 일만 차원(범주 축) 선택 가능 */
  const settingsDimLocked =
    Boolean(settingsConfig) &&
    isMultiDayWidgetRange(settingsConfig.dateStart, settingsConfig.dateEnd) &&
    ['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge'].includes(settingsConfig.type)

  useEffect(() => {
    if (settingsWidgetId) loadTables()
  }, [settingsWidgetId, loadTables])

  return (
    <div className="widgetboard">
      <PageHeader
        title={(boardDisplayName || '').trim() || undefined}
        description="데이터 위젯은 좌측의 템플릿을 드래그 앤 드롭 후 생성 마법사에서 설정합니다. 기간은 위젯별 일 14일·주 12주·월 12개월까지 허용됩니다."
        backLink={
          <Link to="/widgetboard" className="ap__back">
            ← 위젯보드 목록
          </Link>
        }
      >
        <div className="widgetboard-header-actions">
          {!canEditBoard && !boardsLoading && <span className="widgetboard-readonly-hint">읽기 전용</span>}
          {boardInitError && <div className="widgetboard-board-error" role="alert">{boardInitError}</div>}
          <button type="button" className="btn-refresh" onClick={handleRefresh} title="전체 새로고침">
            ⟳ 새로고침
          </button>
        </div>
      </PageHeader>

      <div className="widgetboard-body">
        <aside className="widgetboard-sidebar">
          <div className="sidebar-title">위젯</div>
          <div className="widget-palette">
            {WIDGET_PALETTE.map(({ type, label, icon }) => (
              <div
                key={type}
                className={`palette-item${canEditBoard ? '' : ' palette-item-disabled'}`}
                draggable={canEditBoard}
                onDragStart={(e) => canEditBoard && handlePaletteDragStart(e, type)}
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
          {boardsLoading ? (
            <div className="canvas-empty">
              <p>보드를 불러오는 중…</p>
            </div>
          ) : layout.length === 0 ? (
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
              isDraggable={canEditBoard}
              isResizable={canEditBoard}
              compactType="vertical"
              preventCollision={false}
            >
              {layout.map((item) => (
                <div key={item.i}>
                  <WidgetBlock
                    id={item.i}
                    config={configs[item.i] || { type: 'kpi', title: '위젯', tableName: undefined }}
                    canEdit={canEditBoard}
                    tableData={(() => {
                      const c = configs[item.i]
                      if (!c || c.type === 'note') return null
                      const k = cacheKeyForConfig(c)
                      return k ? tableDataCache[k] : null
                    })()}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onOpenSettings={handleOpenSettings}
                    onNoteContentChange={handleNoteContentChange}
                    onConfigUpdate={handleConfigUpdate}
                  />
                </div>
              ))}
            </WidthProvidedGrid>
          )}
        </main>
      </div>

      <WidgetDataWizardModal
        open={dataWizard != null}
        widgetType={dataWizard?.widgetType}
        widgetTypeLabel={WIDGET_PALETTE.find((p) => p.type === dataWizard?.widgetType)?.label}
        initialTitle=""
        initialTableName=""
        initialDateGrain="day"
        initialDateStart=""
        initialDateEnd=""
        initialDateColumn=""
        tables={tables}
        tablesLoading={tablesLoading}
        onReloadTables={loadTables}
        onSubmit={handleDataWizardSubmit}
        onClose={() => setDataWizard(null)}
      />

      {settingsWidgetId && settingsConfig && (
        <div className="modal-overlay modal-overlay--no-dismiss" role="presentation">
          <div className="modal-content modal-settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="wb-settings-title">
            <div className="modal-header">
              <h3 id="wb-settings-title">위젯 설정</h3>
              <button type="button" className="modal-close" onClick={handleSettingsConfirmClose} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="modal-settings-body">
              <div className="settings-row">
                <label htmlFor="wb-set-title">위젯 이름</label>
                <input
                  id="wb-set-title"
                  type="text"
                  className="widget-wizard-input"
                  value={settingsConfig.title ?? ''}
                  onChange={(e) => handleConfigUpdate(settingsWidgetId, { title: e.target.value })}
                  maxLength={200}
                />
              </div>
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
              {settingsConfig.type !== 'note' && DATA_LIKE_WIDGET_TYPES.includes(settingsConfig.type) && (
                <div className="settings-row">
                  <label htmlFor="wb-set-table">테이블 (프로젝트 매핑)</label>
                  {tablesLoading ? (
                    <p className="modal-loading">테이블 목록 로딩 중...</p>
                  ) : (
                    <select
                      id="wb-set-table"
                      className="widget-wizard-select"
                      value={settingsConfig.tableName ?? ''}
                      onChange={(e) => {
                        const v = (e.target.value || '').trim()
                        handleConfigUpdate(settingsWidgetId, {
                          tableName: v || null,
                          dimensionKey: null,
                          metricKey: null
                        })
                      }}
                    >
                      <option value="">선택…</option>
                      {tables.map((t) => {
                        const name = t?.table_name ?? t?.[0] ?? String(t)
                        return (
                          <option key={name} value={name}>{name}</option>
                        )
                      })}
                    </select>
                  )}
                </div>
              )}
              {settingsConfig.type !== 'note' && DATA_LIKE_WIDGET_TYPES.includes(settingsConfig.type) && settingsConfig.tableName && (
                <>
                  <div className="settings-row">
                    <label>기간 단위</label>
                    <select
                      className="widget-wizard-select"
                      value={settingsConfig.dateGrain || 'day'}
                      onChange={(e) => {
                        const g = e.target.value
                        const d = defaultRangeForGrain(g)
                        handleDataWidgetRangePatch(settingsWidgetId, { dateGrain: g, dateStart: d.start, dateEnd: d.end })
                      }}
                    >
                      <option value="day">일별 (최대 14일)</option>
                      <option value="week">주별 (최대 12주)</option>
                      <option value="month">월별 (최대 12개월)</option>
                    </select>
                  </div>
                  <div className="settings-row widget-wizard-dates">
                    <label>적용 기간</label>
                    <div className="widget-wizard-date-row">
                      <input
                        type="date"
                        className="date-input"
                        value={settingsConfig.dateStart ?? ''}
                        onChange={(e) => handleDataWidgetRangePatch(settingsWidgetId, { dateStart: e.target.value })}
                      />
                      <span>~</span>
                      <input
                        type="date"
                        className="date-input"
                        value={settingsConfig.dateEnd ?? ''}
                        onChange={(e) => handleDataWidgetRangePatch(settingsWidgetId, { dateEnd: e.target.value })}
                      />
                    </div>
                    {(() => {
                      const v = validateWidgetDateRange(
                        settingsConfig.dateGrain || 'day',
                        settingsConfig.dateStart,
                        settingsConfig.dateEnd
                      )
                      return !v.ok ? <p className="widget-wizard-error">{v.error}</p> : null
                    })()}
                  </div>
                  {settingsColumns.some((c) => isDateType(c?.type)) && (
                    <div className="settings-row">
                      <label>날짜 컬럼</label>
                      <select
                        className="widget-wizard-select"
                        value={settingsConfig.dateColumn ?? ''}
                        onChange={(e) =>
                          handleConfigUpdate(settingsWidgetId, {
                            dateColumn: e.target.value === '' ? '' : e.target.value
                          })
                        }
                      >
                        <option value="">자동</option>
                        {settingsColumns.filter((c) => isDateType(c?.type)).map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {settingsConfig.type !== 'note' &&
                settingsConfig.tableName &&
                ['kpi', 'lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge'].includes(settingsConfig.type) && (
                <>
                  {settingsColumns.length > 0 && (
                    <>
                      {['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge'].includes(settingsConfig.type) && (
                        <div className="settings-row">
                          <label>차원·구분 (범주 축 · 단일 일일 때만)</label>
                          <select
                            className="settings-select-fluid"
                            value={settingsConfig.dimensionKey ?? ''}
                            onChange={(e) => handleConfigUpdate(settingsWidgetId, { dimensionKey: e.target.value || null })}
                            disabled={settingsDimLocked}
                          >
                            <option value="">자동</option>
                            {settingsColumns.filter((c) => isDimensionType(c?.type)).map((c) => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          {settingsDimLocked ? (
                            <p className="settings-hint">
                              시작일≠종료일인 기간 조회에서는 X축이 일·주·월 등으로 자동이며, 차원 컬럼은 사용하지 않습니다.
                            </p>
                          ) : (
                            <p className="settings-hint">
                              막대/라인 등에서 X축(또는 파이의 조각 기준)에 올 문자열·범주 컬럼입니다. Y축 값은 아래 지표를 사용합니다.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="settings-row">
                        <label>지표 (숫자·집계 값 · Y축)</label>
                        <select
                          className="settings-select-fluid"
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
                        className="widget-wizard-select"
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
                      className="widget-wizard-select"
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
            <div className="modal-footer modal-settings-footer">
              <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={handleSettingsCancel}>
                취소
              </button>
              <button type="button" className="ibank-btn-toolbar" onClick={handleSettingsConfirmClose}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
