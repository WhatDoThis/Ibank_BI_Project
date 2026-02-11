/**
 * widgetboard/Dashboard3Page.jsx (위젯보드)
 * 왼쪽: 위젯 팔레트(드래그). 오른쪽: 캔버스(드롭).
 * 테이블은 test_report_ 로 시작하는 것만 선택 가능 (allowed_tables와 별개).
 * 연결한 테이블 데이터 기준으로 KPI/차트/테이블 자동 렌더링.
 */
import { useState, useCallback, useEffect } from 'react'
import GridLayout from 'react-grid-layout/legacy'
import { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import {
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { listTables, describeTable, executeQuery } from '@/shared/api/client'
import {
  pickDimensionAndMetric,
  aggregateForChart,
  computeKpi
} from './utils/dataUtils'
import './widgetboard.css'

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
  { type: 'table', label: '테이블', icon: '📋' },
  { type: 'note', label: '메모', icon: '📝' }
]

const DEFAULT_SIZES = {
  kpi: { w: 3, h: 2, minW: 2, minH: 1 },
  lineChart: { w: 6, h: 4, minW: 4, minH: 2 },
  barChart: { w: 6, h: 4, minW: 4, minH: 2 },
  pieChart: { w: 4, h: 4, minW: 3, minH: 2 },
  table: { w: 12, h: 4, minW: 6, minH: 2 },
  note: { w: 4, h: 2, minW: 2, minH: 1 }
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1']

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

function saveLayout(layout) {
  try {
    if (layout?.length) localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch (e) {
    console.warn('widgetboard layout save failed', e)
  }
}

function saveConfigs(configs) {
  try {
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(configs))
  } catch (e) {
    console.warn('widgetboard configs save failed', e)
  }
}

/** SQL 식별자 이스케이프 (PostgreSQL: "name" 형태) */
function escapeTableName(name) {
  if (name == null) return '""'
  const s = String(name).replace(/"/g, '""')
  return `"${s}"`
}

function WidgetBlock({ id, config, tableData, onSelectTable }) {
  if (!config) return null
  const { type, title, tableName } = config
  const typeLabel = WIDGET_PALETTE.find((p) => p.type === type)?.label || type
  const needsTable = type !== 'note'

  const { columns = [], rows = [], error, loading } = tableData || {}
  const { dimensionKey, metricKey } = pickDimensionAndMetric(columns)
  const chartData = aggregateForChart(rows, dimensionKey, metricKey)
  const kpiValue = computeKpi(rows, columns)

  return (
    <div className={`widget-inner widget-${type}`}>
      <div className="widget-header">
        <span>{title || `${typeLabel} 위젯`}</span>
        <span className="widget-header-right">
          {tableName && <span className="widget-datasource">{tableName}</span>}
          {needsTable && (
            <button type="button" className="btn-change-datasource" onClick={() => onSelectTable(id)} title="테이블 변경">
              {tableName ? '변경' : '연결'}
            </button>
          )}
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
            {(type === 'lineChart' || type === 'barChart') && (
              <div className="widget-chart-wrap">
                {chartData.length === 0 ? (
                  <span className="widget-placeholder">표시할 데이터가 없습니다.</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    {type === 'lineChart' ? (
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [Number(v).toLocaleString('ko-KR'), metricKey || '값']} />
                        <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [Number(v).toLocaleString('ko-KR'), metricKey || '값']} />
                        <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            )}
            {type === 'pieChart' && (
              <div className="widget-chart-wrap">
                {chartData.length === 0 ? (
                  <span className="widget-placeholder">표시할 데이터가 없습니다.</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="70%"
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => Number(v).toLocaleString('ko-KR')} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
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
                        {columns.map((c) => (
                          <th key={c.name}>{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((row, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c.name}>{row[c.name] != null ? String(row[c.name]) : '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {rows.length > 50 && (
                  <div className="widget-table-more">외 {rows.length - 50}행 (상위 50건만 표시)</div>
                )}
              </div>
            )}
          </>
        )}
        {type === 'note' && <span className="widget-placeholder">메모 내용</span>}
      </div>
    </div>
  )
}

export default function Dashboard3Page() {
  const [layout, setLayout] = useState(loadLayout)
  const [configs, setConfigs] = useState(loadConfigs)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tableDataCache, setTableDataCache] = useState({})
  const [modalWidgetId, setModalWidgetId] = useState(null)
  const [dragOver, setDragOver] = useState(false)

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

  const loadTableData = useCallback(async (tableName) => {
    if (!tableName) return
    setTableDataCache((prev) => ({
      ...prev,
      [tableName]: { columns: [], rows: [], loading: true, error: null }
    }))
    try {
      const [descRes, queryRes] = await Promise.all([
        describeTable(tableName),
        executeQuery(`SELECT * FROM ${escapeTableName(tableName)} LIMIT 500`)
      ])
      const columns = descRes?.columns || []
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
  }, [])

  useEffect(() => {
    const tableNames = new Set()
    Object.values(configs).forEach((c) => {
      if (c?.tableName) tableNames.add(c.tableName)
    })
    tableNames.forEach((name) => {
      if (tableDataCache[name] === undefined) loadTableData(name)
    })
  }, [configs, loadTableData])

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

  return (
    <div className="widgetboard">
      <header className="widgetboard-header">
        <h1 className="widgetboard-title">위젯보드</h1>
        <p className="widgetboard-hint">
          왼쪽에서 위젯을 드래그해 오른쪽에 놓으세요. 테이블은 <strong>test_report_</strong> 로 시작하는 것만 선택할 수 있으며, 연결한 테이블 데이터로 자동 차트화됩니다.
        </p>
      </header>

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
    </div>
  )
}
