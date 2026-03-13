/**
 * dashboard2/components/AggregatedBarChart2.jsx (집계 막대 차트)
 * ==============================================================
 * 대시보드2 aggregated_data 막대 차트. 기준별 발송 요청·발송 성공. 상위 10건(success_count). 클래스명 dashboard2-*.
 *
 * [Components]
 * ===========
 * 1. getCompositeXLabel, getPrimaryDimensionForChart, aggregateByPrimaryDimension
 * 2. truncateSegment, XAxisTickMultiline, BarChartBlock, MergedBarChart, SummaryBarChart
 * 3. AggregatedBarChart2 (default export): data, groupBy, compareView, mergedChartData, summaryChartData
 *
 * [Dependencies]
 * =========
 * - React, recharts (BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer)
 */

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

// 1.
const formatNum = (n) => (n != null ? new Intl.NumberFormat('ko-KR').format(n) : '0')

// 2.
function getCompositeXLabel(row, groupBy) {
  const parts = []
  if (groupBy.date) parts.push(row.delivery_date != null && row.delivery_date !== '' ? String(row.delivery_date) : '-')
  if (groupBy.campaign) parts.push(row.campaign_label ?? row.campaign_id ?? '-')
  if (groupBy.workflow) parts.push(row.workflow_label ?? row.workflow_id ?? '-')
  if (groupBy.channel) parts.push(row.channel_name ?? row.channel_code ?? '-')
  if (parts.length === 0) return '-'
  return parts.join(' / ')
}

// 3.
/** 복수 차원일 때 X축용 단일 차원 선택 (가장 분류가 많은 하나). 기간 비교 시 의미 유지를 위해 일자(date)는 후보에서 제외 */
function getPrimaryDimensionForChart(data, groupBy) {
  const dims = []
  if (groupBy.campaign) dims.push({ key: 'campaign', getVal: (r) => String(r.campaign_label ?? r.campaign_id ?? '') })
  if (groupBy.workflow) dims.push({ key: 'workflow', getVal: (r) => String(r.workflow_label ?? r.workflow_id ?? '') })
  if (groupBy.channel) dims.push({ key: 'channel', getVal: (r) => String(r.channel_name ?? r.channel_code ?? '') })
  if (dims.length === 0) return null
  let best = dims[0]
  let maxCount = 0
  dims.forEach((d) => {
    const count = new Set((data || []).map(d.getVal)).size
    if (count > maxCount) {
      maxCount = count
      best = d
    }
  })
  return best
}

// 4.
/** 단일 차원으로 행 합산 (차트용). primaryDim = getPrimaryDimensionForChart 반환값 */
function aggregateByPrimaryDimension(rows, primaryDim) {
  if (!primaryDim || !rows?.length) return rows
  const map = new Map()
  rows.forEach((r) => {
    const k = primaryDim.getVal(r) || '-'
    const cur = map.get(k) || { total_count: 0, success_count: 0, delivery_date: r.delivery_date }
    map.set(k, {
      total_count: cur.total_count + (Number(r.total_count) || 0),
      success_count: cur.success_count + (Number(r.success_count) || 0),
      delivery_date: cur.delivery_date ?? r.delivery_date
    })
  })
  return [...map.entries()].map(([name, v]) => ({
    name,
    total_count: v.total_count,
    success_count: v.success_count,
    delivery_date: v.delivery_date
  }))
}

const TOP_N = 10
const LINE_HEIGHT = 14
const X_AXIS_BOTTOM_MARGIN = 100
const X_LABEL_OFFSET = 14
const MAX_LABEL_CHARS = 12
const LABEL_SLOT_WIDTH = 100
const DATE_BAR_PALETTE = [
  { primary: '#4f46e5', secondary: '#059669' },
  { primary: '#7c3aed', secondary: '#0d9488' },
  { primary: '#2563eb', secondary: '#10b981' },
  { primary: '#0d9488', secondary: '#047857' },
  { primary: '#6366f1', secondary: '#4f46e5' }
]

// 5.
function truncateSegment(str, maxChars = MAX_LABEL_CHARS) {
  const s = String(str || '').trim()
  return s.length <= maxChars ? s : s.slice(0, maxChars) + '...'
}

// 6.
function XAxisTickMultiline({ x, y, payload }) {
  const label = payload?.value ?? ''
  const parts = String(label).split(' / ').filter(Boolean).map((p) => truncateSegment(p.trim()))
  return (
    <g transform={`translate(${x}, ${y + X_LABEL_OFFSET})`}>
      <text textAnchor="middle" fill="#374151" fontSize={11}>
        {parts.length <= 1 ? (
          <tspan x={0} dy={4}>{parts[0] || '-'}</tspan>
        ) : (
          parts.map((part, i) => (
            <tspan key={i} x={0} dy={i === 0 ? 0 : LINE_HEIGHT}>{part || '-'}</tspan>
          ))
        )}
      </text>
    </g>
  )
}

// 7.
function BarChartBlock({ data, groupBy, periodLabel }) {
  if (!data.length) return null
  const dimCount = ['date', 'campaign', 'workflow', 'channel'].filter((k) => groupBy[k]).length
  const primaryDim = dimCount >= 2 ? getPrimaryDimensionForChart(data, groupBy) : null
  const rowsForChart = primaryDim
    ? aggregateByPrimaryDimension(data, primaryDim).sort((a, b) => (b.success_count ?? 0) - (a.success_count ?? 0)).slice(0, TOP_N)
    : [...data].sort((a, b) => (b.success_count ?? 0) - (a.success_count ?? 0)).slice(0, TOP_N)
  const dateOrder = [...new Set(rowsForChart.map((r) => r.delivery_date).filter(Boolean))].sort()
  const chartData = rowsForChart.map((row) => ({
    name: row.name ?? getCompositeXLabel(row, groupBy),
    발송요청: row.total_count ?? 0,
    발송성공: row.success_count ?? 0,
    delivery_date: row.delivery_date
  }))
  const getDateColor = (dateKey) => {
    const idx = dateOrder.indexOf(dateKey)
    return DATE_BAR_PALETTE[idx % DATE_BAR_PALETTE.length]
  }
  const hasMultiline = chartData.some((d) => (d.name || '').includes(' / '))
  const bottomMargin = hasMultiline ? X_AXIS_BOTTOM_MARGIN : 24
  const chartMinWidth = Math.max(280, chartData.length * LABEL_SLOT_WIDTH)

  return (
    <div className="dashboard2-aggregated-bar-chart__period-block">
      {periodLabel && <div className="dashboard2-aggregated-bar-chart__period-title">{periodLabel}</div>}
      <div
        className="dashboard2-aggregated-bar-chart__chart-wrap"
        style={{ minWidth: `max(70%, ${chartMinWidth}px)` }}
      >
        <ResponsiveContainer width="100%" height={440}>
          <BarChart
            data={chartData}
            margin={{ top: 40, right: 16, left: 8, bottom: bottomMargin }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              interval={0}
              tick={<XAxisTickMultiline />}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis tick={{ fontSize: 13 }} tickFormatter={formatNum} />
            <Tooltip
              formatter={(value) => formatNum(value)}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
              labelStyle={{ color: '#374151', fontSize: 13 }}
            />
            <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 14, paddingBottom: 12 }} />
            <Bar dataKey="발송요청" radius={[4, 4, 0, 0]} name="발송 요청" maxBarSize={75}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getDateColor(entry.delivery_date)?.primary ?? '#4f46e5'} />
              ))}
            </Bar>
            <Bar dataKey="발송성공" radius={[4, 4, 0, 0]} name="발송 성공" maxBarSize={75}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getDateColor(entry.delivery_date)?.secondary ?? '#059669'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// 8.
/** B안: 디멘션별 기준/비교 한 차트. data = [{ name, 기준_발송요청, 비교_발송요청, 기준_발송성공, 비교_발송성공 }, ...] */
function MergedBarChart({ chartData }) {
  if (!chartData?.length) return null
  const chartMinWidth = Math.max(280, chartData.length * LABEL_SLOT_WIDTH)
  return (
    <div className="dashboard2-aggregated-bar-chart__chart-wrap" style={{ minWidth: `max(70%, ${chartMinWidth}px)` }}>
      <ResponsiveContainer width="100%" height={440}>
        <BarChart data={chartData} margin={{ top: 40, right: 16, left: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <YAxis tick={{ fontSize: 13 }} tickFormatter={formatNum} />
          <Tooltip formatter={(v) => formatNum(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} labelStyle={{ color: '#374151', fontSize: 13 }} />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 14, paddingBottom: 12 }} />
          <Bar dataKey="기준_발송요청" radius={[4, 4, 0, 0]} name="기준 발송 요청" fill="#2563eb" maxBarSize={40} />
          <Bar dataKey="비교_발송요청" radius={[4, 4, 0, 0]} name="비교 발송 요청" fill="#ea580c" maxBarSize={40} />
          <Bar dataKey="기준_발송성공" radius={[4, 4, 0, 0]} name="기준 발송 성공" fill="#0ea5e9" maxBarSize={40} />
          <Bar dataKey="비교_발송성공" radius={[4, 4, 0, 0]} name="비교 발송 성공" fill="#f97316" maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// 9.
/** A안: 기간 2막대 요약. chartData = [{ name: '기준', 발송요청, 발송성공 }, { name: '비교', ... }] */
function SummaryBarChart({ chartData }) {
  if (!chartData?.length) return null
  return (
    <div className="dashboard2-aggregated-bar-chart__chart-wrap" style={{ minWidth: '280px' }}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 13 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <YAxis tick={{ fontSize: 13 }} tickFormatter={formatNum} />
          <Tooltip formatter={(v) => formatNum(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 14, paddingBottom: 8 }} />
          <Bar dataKey="발송요청" radius={[4, 4, 0, 0]} name="발송 요청" fill="#4f46e5" maxBarSize={60} />
          <Bar dataKey="발송성공" radius={[4, 4, 0, 0]} name="발송 성공" fill="#059669" maxBarSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// 10.
export default function AggregatedBarChart2({
  data = [],
  compareData = [],
  groupBy = {},
  compareView = 'split',
  mergedChartData = [],
  summaryChartData = []
}) {
  const hasCompare = compareData && compareData.length > 0
  if (compareView === 'merged' && mergedChartData.length > 0) {
    return (
      <section className="dashboard2-aggregated-bar-chart-section">
        <MergedBarChart chartData={mergedChartData} />
      </section>
    )
  }
  if (compareView === 'summary' && summaryChartData.length > 0) {
    return (
      <section className="dashboard2-aggregated-bar-chart-section">
        <SummaryBarChart chartData={summaryChartData} />
      </section>
    )
  }
  if (!data.length && !hasCompare) return null
  return (
    <section className="dashboard2-aggregated-bar-chart-section">
      {data.length > 0 && (
        <BarChartBlock data={data} groupBy={groupBy} periodLabel={hasCompare ? '기준 기간' : null} />
      )}
      {hasCompare && (
        <BarChartBlock data={compareData} groupBy={groupBy} periodLabel="비교 기간" />
      )}
    </section>
  )
}
