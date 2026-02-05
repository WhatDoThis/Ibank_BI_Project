/**
 * dashboard/components/AggregatedBarChart.jsx (집계 막대 차트)
 * ===========================================================
 * aggregated_data를 막대 차트로 시각화. 기준(일자/캠페인/채널 등)별 발송·성공 비교.
 *
 * [주요 기능]
 * - groupBy 전체 조합으로 X축 라벨 명확 규정(일자+캠페인+워크플로우+채널 순). 복수 값은 줄바꿈으로 표시.
 * - 상위 10건만 표시(정렬 기준: 발송성공 수). 발송 요청(total_count)·발송 성공(success_count) 막대 표시.
 *
 * [의존성]
 * - React, recharts (BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer)
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const formatNum = (n) => (n != null ? new Intl.NumberFormat('ko-KR').format(n) : '0')

/** groupBy에 적용된 컬럼만 조합해 중복 없는 X축 라벨 생성 (일자+캠페인+워크플로우+채널 순) */
function getCompositeXLabel(row, groupBy) {
  const parts = []
  if (groupBy.date) {
    const v = row.delivery_date
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.campaign) {
    const v = row.campaign_label ?? row.campaign_id
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.workflow) {
    const v = row.workflow_label ?? row.workflow_id
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.channel) {
    const v = row.channel_name ?? row.channel_code
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (parts.length === 0) return '-'
  return parts.join(' / ')
}

const TOP_N = 10
const LINE_HEIGHT = 14
const X_AXIS_BOTTOM_MARGIN = 100
const X_LABEL_OFFSET = 14
/** 막대 개수에 따라 차트 너비 유동 계산 (가독성): 막대당 90px, 좌우 여백 포함, min/max clamp */
const WIDTH_PER_BAR = 90
const CHART_MIN_WIDTH = 280
const CHART_MAX_WIDTH = 980
const CHART_SIDE_PADDING = 48

/** X축 복수 값(일자/캠페인/워크플로우/채널)을 " / " 기준으로 줄바꿈 표시. 차트와 레이블 간격 확보를 위해 아래로 오프셋 */
function XAxisTickMultiline({ x, y, payload }) {
  const label = payload?.value ?? ''
  const parts = String(label).split(' / ').filter(Boolean)
  const fontSize = 11
  return (
    <g transform={`translate(${x}, ${y + X_LABEL_OFFSET})`}>
      <text textAnchor="middle" fill="#374151" fontSize={fontSize}>
        {parts.length <= 1 ? (
          <tspan x={0} dy={4}>{label || '-'}</tspan>
        ) : (
          parts.map((part, i) => (
            <tspan key={i} x={0} dy={i === 0 ? 0 : LINE_HEIGHT}>{part.trim() || '-'}</tspan>
          ))
        )}
      </text>
    </g>
  )
}

export default function AggregatedBarChart({ data = [], groupBy = {} }) {
  if (!data.length) return null
  // 발송성공 수 기준 내림차순 정렬 후 상위 N건 (백엔드와 동일 기준, 프론트에서도 보장)
  const sorted = [...data].sort((a, b) => (b.success_count ?? 0) - (a.success_count ?? 0))
  const chartData = sorted.slice(0, TOP_N).map((row) => ({
    name: getCompositeXLabel(row, groupBy),
    발송요청: row.total_count ?? 0,
    발송성공: row.success_count ?? 0
  }))
  const hasMultiline = chartData.some((d) => (d.name || '').includes(' / '))
  const bottomMargin = hasMultiline ? X_AXIS_BOTTOM_MARGIN : 24
  const barCount = chartData.length
  const chartWidth = Math.min(CHART_MAX_WIDTH, Math.max(CHART_MIN_WIDTH, barCount * WIDTH_PER_BAR + CHART_SIDE_PADDING))
  return (
    <section className="aggregated-bar-chart aggregated-bar-chart-section">
      <h3 className="aggregated-bar-chart__title">
        기준별 발송 현황 (발송성공 수 상위 {TOP_N}건)
      </h3>
      <div className="aggregated-bar-chart__chart-wrap" style={{ width: chartWidth, maxWidth: '100%', margin: '0 auto' }}>
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
          <Bar dataKey="발송요청" fill="#3b82f6" radius={[4, 4, 0, 0]} name="발송 요청" maxBarSize={75} />
          <Bar dataKey="발송성공" fill="#10b981" radius={[4, 4, 0, 0]} name="발송 성공" maxBarSize={75} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </section>
  )
}
