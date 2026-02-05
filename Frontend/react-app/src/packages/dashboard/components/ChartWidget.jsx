/**
 * dashboard/components/ChartWidget.jsx (차트 생성 위젯)
 * =====================================================
 * 집계 데이터로 Dimension(축)·Metric(값)·차트 유형을 선택해 막대/선/영역 차트 생성.
 * Dimension: 집계 체크박스 기준(일자·캠페인·워크플로우·채널 중 선택된 것만). Metric: 실수형 지표만. Y축 Nice Numbers 적용.
 *
 * [주요 기능]
 * - 위젯 추가/삭제, Dimension·Metric·차트 유형 선택. 차트 포맷은 기준별 발송 현황(AggregatedBarChart)과 동일(margin, 축/툴팁/범례, 높이 440).
 * - recharts BarChart, LineChart, AreaChart, Y축 domain Nice Numbers, Bar maxBarSize 75
 *
 * [의존성]
 * - React, recharts
 */

import { useState, useMemo, useEffect } from 'react'
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
  Legend,
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

function SingleWidget({ widget, data, availableDimensions, onRemove, onUpdate }) {
  const { id, xKey, yKey, chartType, title } = widget
  const dims = availableDimensions?.length ? availableDimensions : DIMENSION_FIELDS
  const effectiveXKey = dims.some((d) => d.key === xKey) ? xKey : (dims[0]?.key ?? 'delivery_date')
  const dimField = dims.find((f) => f.key === effectiveXKey) || dims[0]
  const metricField = METRIC_FIELDS.find((f) => f.key === yKey) || METRIC_FIELDS[0]
  const chartData = useMemo(() => {
    if (!data?.length) return []
    return data.slice(0, 50).map((row) => ({
      name: getDisplayValue(row, effectiveXKey),
      [metricField.label]: typeof row[yKey] === 'number' ? row[yKey] : Number(row[yKey]) || 0,
      delivery_date: row.delivery_date
    }))
  }, [data, effectiveXKey, yKey, metricField.label])

  const dateOrderForBar = useMemo(() => {
    const dates = [...new Set(chartData.map((d) => d.delivery_date).filter(Boolean))].sort()
    return dates
  }, [chartData])

  const getBarFillByDate = (deliveryDate) => {
    const idx = dateOrderForBar.indexOf(deliveryDate)
    return CHART_WIDGET_DATE_COLORS[idx % CHART_WIDGET_DATE_COLORS.length] ?? '#4f46e5'
  }

  /* Y축 도메인: 실제 데이터 min/max 기준으로 조정(0 강제 포함 제거 → 변동 구간이 잘 보이도록) */
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 1]
    const values = chartData.map((d) => d[metricField.label])
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    if (dataMax === dataMin) return [dataMin - 1, dataMax + 1]
    const stepSize = calculateNiceStepSize(dataMin, dataMax)
    const yMin = calculateYAxisMin(dataMin, stepSize)
    const yMax = calculateYAxisMax(dataMax, stepSize)
    return [yMin, yMax]
  }, [chartData, metricField.label])

  if (!chartData.length) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          minHeight: 500
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
          <button
            type="button"
            onClick={() => onRemove(id)}
            style={{ padding: '4px 8px', fontSize: 14, color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
          >
            삭제
          </button>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>표시할 데이터가 없습니다.</div>
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
  const xAxisPropsOthers = {
    ...xAxisPropsBase,
    tick: { fontSize: 12 },
    angle: chartData.length > 8 ? -35 : 0,
    textAnchor: chartData.length > 8 ? 'end' : 'middle'
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
  const legendProps = { verticalAlign: 'top', align: 'center', wrapperStyle: { fontSize: 14, paddingBottom: 12 } }

  let chartInner
  if (chartType === 'line') {
    chartInner = (
      <LineChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisPropsOthers} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Line type="monotone" dataKey={metricField.label} stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0d9488' }} activeDot={{ r: 6, fill: '#0f766e' }} name={metricField.label} />
      </LineChart>
    )
  } else if (chartType === 'area') {
    chartInner = (
      <AreaChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisPropsOthers} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Area type="monotone" dataKey={metricField.label} stroke="#7c3aed" strokeWidth={2} fill="#7c3aed" fillOpacity={0.35} name={metricField.label} />
      </AreaChart>
    )
  } else {
    chartInner = (
      <BarChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisPropsBar} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Bar dataKey={metricField.label} radius={[4, 4, 0, 0]} name={metricField.label} maxBarSize={75}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getBarFillByDate(entry.delivery_date)} />
          ))}
        </Bar>
      </BarChart>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        minHeight: 500
      }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
          <button
            type="button"
            onClick={() => onRemove(id)}
            style={{ padding: '4px 8px', fontSize: 14, color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
          >
            삭제
          </button>
        </div>
      </div>
      {chartType === 'bar' ? (
        <div style={{ minWidth: Math.max(280, chartData.length * LABEL_SLOT_WIDTH), width: '100%' }}>
          <ResponsiveContainer width="100%" height={440}>
            {chartInner}
          </ResponsiveContainer>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={440}>
          {chartInner}
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function ChartWidget({ data = [], groupBy = {}, widgets = [], onWidgetsChange }) {
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
      <div className="chart-widget__header">
        <button type="button" className="chart-widget__add-btn" onClick={addWidget}>
          + 차트 생성
        </button>
      </div>
      <p className="chart-widget__desc">
        Dimension: 집계 기준에서 선택한 항목만 표시. 두 개 이상이면 그중 선택 가능. Metric: 실수형 지표만. Y축은 선택한 Metric에 맞게 자동 조정.
      </p>
      <div className="chart-widget__grid">
        {widgets.map((w) => (
          <SingleWidget
            key={w.id}
            widget={w}
            data={data}
            availableDimensions={availableDimensions}
            onRemove={removeWidget}
            onUpdate={updateWidget}
          />
        ))}
      </div>
    </section>
  )
}
