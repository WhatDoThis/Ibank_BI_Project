/**
 * dashboard2/components/AggregatedBarChart2.jsx (집계 막대 차트)
 * ==============================================================
 * 대시보드2 전용. aggregated_data 막대 차트. Phase 0: dashboard AggregatedBarChart 복사, 클래스명 dashboard2-* 사용.
 *
 * [의존성]
 * - React, recharts
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

const formatNum = (n) => (n != null ? new Intl.NumberFormat('ko-KR').format(n) : '0')

function getCompositeXLabel(row, groupBy) {
  const parts = []
  if (groupBy.date) parts.push(row.delivery_date != null && row.delivery_date !== '' ? String(row.delivery_date) : '-')
  if (groupBy.campaign) parts.push(row.campaign_label ?? row.campaign_id ?? '-')
  if (groupBy.workflow) parts.push(row.workflow_label ?? row.workflow_id ?? '-')
  if (groupBy.channel) parts.push(row.channel_name ?? row.channel_code ?? '-')
  if (parts.length === 0) return '-'
  return parts.join(' / ')
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

function truncateSegment(str, maxChars = MAX_LABEL_CHARS) {
  const s = String(str || '').trim()
  return s.length <= maxChars ? s : s.slice(0, maxChars) + '...'
}

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

export default function AggregatedBarChart2({ data = [], groupBy = {} }) {
  if (!data.length) return null
  const sorted = [...data].sort((a, b) => (b.success_count ?? 0) - (a.success_count ?? 0))
  const topRows = sorted.slice(0, TOP_N)
  const dateOrder = [...new Set(topRows.map((r) => r.delivery_date).filter(Boolean))].sort()
  const chartData = topRows.map((row) => ({
    name: getCompositeXLabel(row, groupBy),
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
    <section className="dashboard2-aggregated-bar-chart-section">
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
    </section>
  )
}
