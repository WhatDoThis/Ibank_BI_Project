/**
 * dashboard/components/ChartWidget.jsx (차트 생성 위젯)
 * =====================================================
 * Dimension(축)·Metric(값)·차트 유형 선택으로 막대/선/영역 차트 생성.
 * 차트 데이터는 별도 API(getChartData)로 단일 디멘션·메트릭 집계 조회(Adobe/GA 방식). tableId·filters 있으면 API 사용, 없으면 data prop 폴백.
 * Dimension: 집계 체크박스 기준. Metric: 실수형 지표만. Y축 Nice Numbers 적용.
 *
 * [주요 기능]
 * - 위젯 추가/삭제, Dimension·Metric·차트 유형 선택. 차트 포맷은 기준별 발송 현황과 동일.
 * - 막대·선형·영역 공통: 범례·Y축 고정 + 오른쪽만 가로 스크롤, X축 minWidth(LABEL_SLOT_WIDTH×건수)·XAxisTickTruncate로 레이블 겹침/잘림 방지. 차트 영역 max-width 1200px. 스크롤 영역 차트에는 domain 적용을 위해 숨김 YAxis 사용.
 *
 * [의존성]
 * - React, recharts, shared/api/client (getChartData)
 */

import { useState, useMemo, useEffect } from 'react'
import { getChartData } from '@/shared/api/client'
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const formatNum = (n) => (n != null ? new Intl.NumberFormat('ko-KR').format(n) : '0')

/** Nice Numbers: Y축 간격(stepSize) 계산 */
function calculateNiceStepSize(dataMin, dataMax) {
  const dataRange = dataMax - dataMin
  if (dataRange === 0) return 1.0
  const magnitude = 10 ** Math.floor(Math.log10(dataRange))
  const normalizedRange = dataRange / magnitude
  let stepSize
  if (normalizedRange <= 1) stepSize = 0.2 * magnitude
  else if (normalizedRange <= 2) stepSize = 0.5 * magnitude
  else if (normalizedRange <= 5) stepSize = 1.0 * magnitude
  else if (normalizedRange <= 10) stepSize = 2.0 * magnitude
  else stepSize = 5.0 * magnitude
  const maxStepSize = dataMax * 0.3
  if (stepSize > maxStepSize) {
    const magnitudeLimit = 10 ** Math.floor(Math.log10(maxStepSize))
    const normalizedLimit = maxStepSize / magnitudeLimit
    if (normalizedLimit <= 1) stepSize = 0.2 * magnitudeLimit
    else if (normalizedLimit <= 2) stepSize = 0.5 * magnitudeLimit
    else if (normalizedLimit <= 5) stepSize = 1.0 * magnitudeLimit
    else if (normalizedLimit <= 10) stepSize = 2.0 * magnitudeLimit
    else stepSize = 5.0 * magnitudeLimit
  }
  let minStepSize = dataRange < 1000 ? dataRange * 0.1 : 0
  if (dataRange < 1) {
    if (dataRange <= 0.2) stepSize = Math.max(0.05, minStepSize)
    else if (dataRange <= 0.5) stepSize = Math.max(0.1, minStepSize)
    else stepSize = Math.max(0.2, minStepSize)
  } else if (dataRange < 10) {
    if (dataRange <= 1) stepSize = Math.max(0.2, minStepSize)
    else if (dataRange <= 2) stepSize = Math.max(0.5, minStepSize)
    else if (dataRange <= 5) stepSize = Math.max(1.0, minStepSize)
    else stepSize = Math.max(1.0, minStepSize)
  } else if (dataRange < 100) {
    if (dataRange <= 10) stepSize = Math.max(1.0, minStepSize)
    else if (dataRange <= 20) stepSize = Math.max(2.0, minStepSize)
    else if (dataRange <= 50) stepSize = Math.max(5.0, minStepSize)
    else stepSize = Math.max(10.0, minStepSize)
  } else {
    stepSize = Math.max(stepSize, minStepSize)
  }
  return stepSize
}

function calculateYAxisMax(dataMax, stepSize) {
  const baseMax = Math.ceil(dataMax / stepSize) * stepSize
  return baseMax + stepSize
}

function calculateYAxisMin(dataMin, stepSize) {
  let baseMin = Math.floor(dataMin / stepSize) * stepSize
  let calculatedMin = baseMin - stepSize
  calculatedMin = Math.max(0, calculatedMin)
  const multiplier = calculatedMin > 0 ? Math.floor(calculatedMin / stepSize) : 0
  return multiplier * stepSize
}

/** 선형/영역 전용: 간격 0.5 단위만(0.5,1,2,5,10…), Y축 구간 4개 이상, yMin=dataMin-간격, yMax=dataMax+간격 */
function calculateNiceStepSizeLineArea(dataMin, dataMax) {
  const dataRange = dataMax - dataMin
  const maxStep = dataRange <= 0 ? 1 : dataRange / 4
  const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
  let step = 0.5
  for (const c of candidates) {
    if (c <= maxStep) step = c
    else break
  }
  return step
}

/** Dimension 후보: 일자·캠페인·워크플로우·채널 (집계 체크박스와 1:1 대응) */
const DIMENSION_FIELDS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'campaign_label', label: '캠페인' },
  { key: 'workflow_label', label: '워크플로우' },
  { key: 'channel_name', label: '채널' }
]

/** groupBy(집계 체크박스)에 따라 사용 가능한 Dimension 목록 반환. 순서: 일자→캠페인→워크플로우→채널. 하나도 없으면 전체. */
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

/** Metric 후보: 실수형 데이터만 (건수·비율) */
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

/** 차트 생성 막대: 일자별 색상 구분용 팔레트 */
const CHART_WIDGET_DATE_COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0d9488', '#059669', '#6366f1']

/** X축 레이블·막대 간격 (기준별 발송 현황과 동일): 슬롯 폭(px), 세그먼트당 최대 글자 수 */
const LABEL_SLOT_WIDTH = 100
const MAX_LABEL_CHARS = 12
/** 막대 차트 가로 스크롤 시 고정할 Y축 영역 너비(px) */
const Y_AXIS_FIXED_WIDTH = 56
/** 차트 캔버스 높이(px). Y축 레이블 잘림 방지로 500 사용 */
const CHART_HEIGHT = 500
/** 차트 배경과 내부 차트 사이 상하좌우 패딩(px) */
const CHART_PADDING = 30

function truncateLabel(str, maxChars = MAX_LABEL_CHARS) {
  const s = String(str ?? '').trim()
  if (s.length <= maxChars) return s || '-'
  return s.slice(0, maxChars) + '...'
}

/** 차트 생성 X축 틱: 레이블 길이 제한으로 겹침 방지 */
function XAxisTickTruncate({ x, y, payload }) {
  const text = truncateLabel(payload?.value)
  return (
    <g transform={`translate(${x}, ${y})`}>
      <text textAnchor="middle" fill="#374151" fontSize={12} x={0} y={0} dy={8}>
        {text}
      </text>
    </g>
  )
}

function getDisplayValue(row, key) {
  const v = row[key]
  if (v != null && v !== '') return String(v)
  if (key === 'campaign_label') return row.campaign_id ?? '-'
  if (key === 'workflow_label') return row.workflow_id ?? '-'
  if (key === 'channel_name') return row.channel_code ?? '-'
  return '-'
}

function SingleWidget({ widget, data, availableDimensions, onRemove, onUpdate, tableId, filters }) {
  const { id, xKey, yKey, chartType, title } = widget
  const dims = availableDimensions?.length ? availableDimensions : DIMENSION_FIELDS
  const effectiveXKey = dims.some((d) => d.key === xKey) ? xKey : (dims[0]?.key ?? 'delivery_date')
  const dimField = dims.find((f) => f.key === effectiveXKey) || dims[0]
  const metricField = METRIC_FIELDS.find((f) => f.key === yKey) || METRIC_FIELDS[0]

  const [chartDataFromApi, setChartDataFromApi] = useState([])
  const [chartDataLoading, setChartDataLoading] = useState(false)
  const useChartApi = Boolean(tableId && filters?.date_range?.length >= 2)

  useEffect(() => {
    if (!useChartApi) {
      setChartDataFromApi([])
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
      dimension: effectiveXKey,
      metric: yKey,
      limit: 50
    })
      .then((res) => {
        if (cancelled) return
        const rows = res.rows || []
        setChartDataFromApi(
          rows.map((r) => ({
            name: r.name ?? '-',
            [metricField.label]: typeof r.value === 'number' ? r.value : Number(r.value) || 0,
            delivery_date: r.delivery_date
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setChartDataFromApi([])
      })
      .finally(() => {
        if (!cancelled) setChartDataLoading(false)
      })
    return () => { cancelled = true }
  }, [useChartApi, tableId, filters?.date_range, filters?.campaign_ids, filters?.workflow_ids, filters?.channels, effectiveXKey, yKey, metricField.label])

  const chartDataFromProp = useMemo(() => {
    if (!data?.length) return []
    return data.slice(0, 50).map((row) => ({
      name: getDisplayValue(row, effectiveXKey),
      [metricField.label]: typeof row[yKey] === 'number' ? row[yKey] : Number(row[yKey]) || 0,
      delivery_date: row.delivery_date
    }))
  }, [data, effectiveXKey, yKey, metricField.label])

  const chartData = useChartApi ? chartDataFromApi : chartDataFromProp

  const dateOrderForBar = useMemo(() => {
    const dates = [...new Set(chartData.map((d) => d.delivery_date).filter(Boolean))].sort()
    return dates
  }, [chartData])

  const getBarFillByDate = (deliveryDate) => {
    const idx = dateOrderForBar.indexOf(deliveryDate)
    return CHART_WIDGET_DATE_COLORS[idx % CHART_WIDGET_DATE_COLORS.length] ?? '#4f46e5'
  }

  /* Y축 도메인: 막대=0부터, yMax=dataMax+간격(항상 상단 여유). 선형/영역=0.5단위·4구간 이상·yMin=dataMin-간격, yMax=dataMax+간격 */
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 1]
    const values = chartData.map((d) => d[metricField.label])
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    if (chartType === 'bar') {
      const stepSize = (dataMin === dataMax && dataMax > 0)
        ? calculateNiceStepSize(0, dataMax)
        : calculateNiceStepSize(dataMin, dataMax)
      const yMax = dataMax + Math.max(stepSize, 1)
      return [0, yMax]
    }
    const step = calculateNiceStepSizeLineArea(dataMin, dataMax)
    const yMin = dataMin - step
    const yMax = dataMax + step
    return [yMin, yMax]
  }, [chartData, metricField.label, chartType])

  if (!chartData.length) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          minHeight: CHART_HEIGHT + CHART_PADDING * 2
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <input
            type="text"
            value={title || ''}
            onChange={(e) => onUpdate(id, { title: e.target.value })}
            placeholder="차트 제목"
            style={{ fontSize: 16, fontWeight: 600, color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', minWidth: 140 }}
          />
          <button type="button" className="chart-widget__delete-btn" onClick={() => onRemove(id)}>
            삭제
          </button>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          {chartDataLoading ? '차트 데이터 조회 중...' : '표시할 데이터가 없습니다.'}
        </div>
      </div>
    )
  }

  /* 기준별 발송 현황 차트(AggregatedBarChart)와 동일 포맷: margin, 축/툴팁/범례 스타일 */
  const chartBottomMargin = 24
  const commonProps = {
    data: chartData,
    margin: { top: 40, right: 16, left: 8, bottom: chartBottomMargin }
  }

  const xAxisPropsBase = {
    dataKey: 'name',
    interval: 0,
    axisLine: { stroke: '#e5e7eb' },
    tickLine: false
  }
  const xAxisPropsBar = {
    ...xAxisPropsBase,
    tick: <XAxisTickTruncate />
  }
  const yAxisEl = <YAxis domain={yDomain} tick={{ fontSize: 13 }} tickFormatter={formatNum} />
  const tooltipEl = (
    <Tooltip
      formatter={(v) => formatNum(v)}
      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
      labelStyle={{ color: '#374151', fontSize: 13 }}
    />
  )
  const gridEl = <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  const legendColor = chartType === 'line' ? '#0d9488' : chartType === 'area' ? '#7c3aed' : '#4f46e5'
  const fixedLegendRow = (
    <div className="chart-widget__legend-fixed">
      <div style={{ width: Y_AXIS_FIXED_WIDTH, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', minWidth: 0 }}>
        <span style={{ width: 12, height: 12, borderRadius: 2, background: legendColor, flexShrink: 0 }} />
        <span>{metricField.label}</span>
      </div>
    </div>
  )

  /* 막대·선형·영역 공통: 가로 스크롤 시 Y축 고정, 범례 고정. X축 간격 확보(minWidth) 후 스크롤. 스크롤 영역 차트는 domain 적용을 위해 숨김 YAxis 사용 */
  const marginLeftOnly = { top: 40, right: 0, left: 8, bottom: chartBottomMargin }
  const marginRightOnly = { top: 40, right: 24, left: 32, bottom: chartBottomMargin }
  const scrollContentMinWidth = Math.max(280, chartData.length * LABEL_SLOT_WIDTH)
  const hiddenYAxis = <YAxis domain={yDomain} hide width={0} />
  const fixedYAxisBlock = (
    <div className="chart-widget__y-axis-fixed" style={{ width: Y_AXIS_FIXED_WIDTH }}>
      <ResponsiveContainer width={Y_AXIS_FIXED_WIDTH} height={CHART_HEIGHT}>
        <BarChart data={chartData} margin={marginLeftOnly}>
          <YAxis domain={yDomain} tick={{ fontSize: 13 }} tickFormatter={formatNum} width={Y_AXIS_FIXED_WIDTH - 16} />
          <Bar dataKey={metricField.label} barSize={0} fill="transparent" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  let chartInner
  if (chartType === 'line') {
    chartInner = (
      <>
        {fixedLegendRow}
        {fixedYAxisBlock}
        <div className="chart-widget__chart-scroll">
          <div style={{ minWidth: scrollContentMinWidth }}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart {...commonProps} margin={marginRightOnly}>
                {hiddenYAxis}
                {gridEl}
                <XAxis {...xAxisPropsBar} />
                {tooltipEl}
                <Line type="monotone" dataKey={metricField.label} stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0d9488' }} activeDot={{ r: 6, fill: '#0f766e' }} name={metricField.label} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    )
  } else if (chartType === 'area') {
    chartInner = (
      <>
        {fixedLegendRow}
        {fixedYAxisBlock}
        <div className="chart-widget__chart-scroll">
          <div style={{ minWidth: scrollContentMinWidth }}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <AreaChart {...commonProps} margin={marginRightOnly}>
                {hiddenYAxis}
                {gridEl}
                <XAxis {...xAxisPropsBar} />
                {tooltipEl}
                <Area type="monotone" dataKey={metricField.label} stroke="#7c3aed" strokeWidth={2} fill="#7c3aed" fillOpacity={0.35} name={metricField.label} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    )
  } else {
    /* 막대 차트: bar만 barCategoryGap·maxBarSize·Cell 적용, 나머지 레이아웃은 위와 동일 */
    const barMaxSize = Math.min(75, Math.floor(LABEL_SLOT_WIDTH * 0.55))
    chartInner = (
      <>
        {fixedLegendRow}
        {fixedYAxisBlock}
        <div className="chart-widget__chart-scroll">
          <div style={{ minWidth: scrollContentMinWidth }}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart {...commonProps} margin={marginRightOnly} barCategoryGap="8%">
                {hiddenYAxis}
                {gridEl}
                <XAxis {...xAxisPropsBar} />
                {tooltipEl}
                <Bar dataKey={metricField.label} radius={[4, 4, 0, 0]} name={metricField.label} maxBarSize={barMaxSize}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getBarFillByDate(entry.delivery_date)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        minHeight: CHART_HEIGHT + CHART_PADDING * 2
      }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text"
          value={title || ''}
          onChange={(e) => onUpdate(id, { title: e.target.value })}
          placeholder="차트 제목"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '6px 12px',
            minWidth: 140,
            flex: '1 1 140px',
            maxWidth: 280
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="chart-widget__save-btn" onClick={() => { /* 저장: DB 정립 후 구현 */ }}>
            저장
          </button>
          <button type="button" className="chart-widget__delete-btn" onClick={() => onRemove(id)}>
            삭제
          </button>
        </div>
      </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <select
            value={effectiveXKey}
            onChange={(e) => onUpdate(id, { xKey: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            {dims.map((f) => (
              <option key={f.key} value={f.key}>{f.label} (Dimension)</option>
            ))}
          </select>
          <select
            value={yKey}
            onChange={(e) => onUpdate(id, { yKey: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            {METRIC_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>{f.label} (Metric)</option>
            ))}
          </select>
          <select
            value={chartType}
            onChange={(e) => onUpdate(id, { chartType: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            {CHART_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="chart-widget__chart-wrap chart-widget__chart-wrap--y-fixed" style={{ padding: CHART_PADDING }}>
          {chartInner}
        </div>
    </div>
  )
}

export default function ChartWidget({ data = [], groupBy = {}, widgets = [], onWidgetsChange, tableId, filters }) {
  const availableDimensions = useMemo(() => getAvailableDimensions(groupBy), [groupBy])

  // 집계 체크박스 변경 시, 현재 선택된 Dimension이 목록에 없으면 첫 번째로 맞춤
  useEffect(() => {
    const keys = availableDimensions.map((d) => d.key)
    const firstKey = availableDimensions[0]?.key ?? 'delivery_date'
    const needsUpdate = widgets.some((w) => !keys.includes(w.xKey))
    if (!needsUpdate || widgets.length === 0) return
    onWidgetsChange(
      widgets.map((w) => ({ ...w, xKey: keys.includes(w.xKey) ? w.xKey : firstKey }))
    )
  }, [groupBy, availableDimensions, widgets, onWidgetsChange])

  const addWidget = () => {
    const id = `w-${Date.now()}`
    const defaultXKey = availableDimensions[0]?.key ?? 'delivery_date'
    onWidgetsChange([
      ...widgets,
      { id, xKey: defaultXKey, yKey: 'total_count', chartType: 'bar', title: `차트 생성 ${widgets.length + 1}` }
    ])
  }

  const removeWidget = (id) => {
    onWidgetsChange(widgets.filter((w) => w.id !== id))
  }

  const updateWidget = (id, updates) => {
    onWidgetsChange(
      widgets.map((w) => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  return (
    <section className="chart-widget-section chart-widget">
      <p className="chart-widget__desc">
        Dimension: 집계 기준에서 선택한 항목만 표시. 두 개 이상이면 그중 선택 가능. Metric: 실수형 지표만. Y축은 선택한 Metric에 맞게 자동 조정.
      </p>
      <div className="chart-widget__header">
        <button type="button" className="chart-widget__add-btn" onClick={addWidget}>
          + 차트 생성
        </button>
      </div>
      <div className="chart-widget__grid">
        {widgets.map((w) => (
          <SingleWidget
            key={w.id}
            widget={w}
            data={data}
            availableDimensions={availableDimensions}
            onRemove={removeWidget}
            onUpdate={updateWidget}
            tableId={tableId}
            filters={filters}
          />
        ))}
      </div>
    </section>
  )
}
