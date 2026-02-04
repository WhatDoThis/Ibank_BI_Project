/**
 * dashboard/components/ChartWidget.jsx (차트 생성 위젯)
 * =====================================================
 * 집계 데이터로 Dimension(축)·Metric(값)·차트 유형을 선택해 막대/선/영역 차트 생성.
 * Dimension: 일자·캠페인·워크플로우·채널 등, Metric: 실수형 지표만. Y축 Nice Numbers 적용.
 *
 * [주요 기능]
 * - 위젯 추가/삭제, Dimension·Metric·차트 유형 선택, 섹션 폭 50%
 * - recharts BarChart, LineChart, AreaChart, Y축 domain Nice Numbers
 *
 * [의존성]
 * - React, recharts
 */

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
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

/** Dimension 후보: 일자·캠페인·워크플로우·채널 등 */
const DIMENSION_FIELDS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'campaign_label', label: '캠페인' },
  { key: 'workflow_label', label: '워크플로우' },
  { key: 'channel_name', label: '채널' }
]

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

function getDisplayValue(row, key) {
  const v = row[key]
  if (v != null && v !== '') return String(v)
  if (key === 'campaign_label') return row.campaign_id ?? '-'
  if (key === 'workflow_label') return row.workflow_id ?? '-'
  if (key === 'channel_name') return row.channel_code ?? '-'
  return '-'
}

function SingleWidget({ widget, data, onRemove, onUpdate }) {
  const { id, xKey, yKey, chartType, title } = widget
  const dimField = DIMENSION_FIELDS.find((f) => f.key === xKey) || DIMENSION_FIELDS[0]
  const metricField = METRIC_FIELDS.find((f) => f.key === yKey) || METRIC_FIELDS[0]
  const chartData = useMemo(() => {
    if (!data?.length) return []
    return data.slice(0, 50).map((row) => ({
      name: getDisplayValue(row, xKey),
      [metricField.label]: typeof row[yKey] === 'number' ? row[yKey] : Number(row[yKey]) || 0
    }))
  }, [data, xKey, yKey, metricField.label])

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
          minHeight: 280
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

  const chartBottomMargin = 56
  const chartTopMargin = 40
  const commonProps = {
    data: chartData,
    margin: { top: chartTopMargin, right: 16, left: 8, bottom: chartBottomMargin }
  }

  const xAxisProps = {
    dataKey: 'name',
    tick: { fontSize: 12 },
    interval: 0,
    angle: chartData.length > 8 ? -35 : 0,
    textAnchor: chartData.length > 8 ? 'end' : 'middle',
    axisLine: { stroke: '#e5e7eb' },
    tickLine: { stroke: '#e5e7eb' }
  }
  const yAxisEl = <YAxis domain={yDomain} tick={{ fontSize: 13 }} tickFormatter={formatNum} />
  const tooltipEl = <Tooltip formatter={(v) => formatNum(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} labelStyle={{ color: '#374151' }} />
  const gridEl = <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  const legendProps = { verticalAlign: 'top', align: 'center', wrapperStyle: { fontSize: 14, paddingBottom: 12 } }

  let chartInner
  if (chartType === 'line') {
    chartInner = (
      <LineChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisProps} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Line type="monotone" dataKey={metricField.label} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name={metricField.label} />
      </LineChart>
    )
  } else if (chartType === 'area') {
    chartInner = (
      <AreaChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisProps} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Area type="monotone" dataKey={metricField.label} stroke="#0d9488" fill="#0d9488" fillOpacity={0.3} name={metricField.label} />
      </AreaChart>
    )
  } else {
    chartInner = (
      <BarChart {...commonProps}>
        {gridEl}
        <XAxis {...xAxisProps} />
        {yAxisEl}
        {tooltipEl}
        <Legend {...legendProps} />
        <Bar dataKey={metricField.label} fill="#3b82f6" radius={[4, 4, 0, 0]} name={metricField.label} />
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
        minHeight: 280
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
            value={xKey}
            onChange={(e) => onUpdate(id, { xKey: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            {DIMENSION_FIELDS.map((f) => (
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
      <ResponsiveContainer width="100%" height={260}>
        {chartInner}
      </ResponsiveContainer>
    </div>
  )
}

export default function ChartWidget({ data = [], widgets = [], onWidgetsChange }) {
  const addWidget = () => {
    const id = `w-${Date.now()}`
    onWidgetsChange([
      ...widgets,
      { id, xKey: 'delivery_date', yKey: 'total_count', chartType: 'bar', title: `차트 생성 ${widgets.length + 1}` }
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
    <section className="chart-widget-section" style={{ marginTop: 24, width: '50%', minWidth: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: '#374151' }}>차트 생성</h3>
        <button
          type="button"
          onClick={addWidget}
          style={{
            padding: '8px 16px',
            fontSize: 15,
            fontWeight: 600,
            background: '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
          }}
        >
          + 차트 생성
        </button>
      </div>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
        Dimension: 일자·캠페인·워크플로우·채널 등 / Metric: 실수형 지표만. Y축은 선택한 Metric에 맞게 자동 조정.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {widgets.map((w) => (
          <SingleWidget
            key={w.id}
            widget={w}
            data={data}
            onRemove={removeWidget}
            onUpdate={updateWidget}
          />
        ))}
      </div>
    </section>
  )
}
