/**
 * dashboard/components/AggregatedBarChart.jsx (집계 막대 차트)
 * ===========================================================
 * aggregated_data를 막대 차트로 시각화. 기준(일자/캠페인/채널 등)별 발송·성공 비교.
 *
 * [주요 기능]
 * - groupBy 전체 조합으로 X축 라벨 명확 규정(일자+캠페인+워크플로우+채널 순). 복수 값은 줄바꿈으로 표시.
 * - 상위 10건만 표시(정렬 기준: 발송성공 수). 발송 요청(total_count)·발송 성공(success_count) 막대 표시.
 * - 차트 폭: 컨테이너 100%, min-width 70%·max-width 980px (Recharts/대시보드 권장 비율 유지).
 *
 * [의존성]
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
/** 레이블당 슬롯 폭(px): 막대 간격 = 레이블 가독 확보. 100px = 약 10~12자 + 여백 (권장 60~100px) */
const LABEL_SLOT_WIDTH = 100
/** 세그먼트(한 줄)당 최대 글자 수, 초과 시 ... 처리 */
const MAX_LABEL_CHARS = 12
/** 일자별 막대 색상 (날짜 인덱스 → 발송요청/발송성공 색) */
const DATE_BAR_PALETTE = [
  { primary: '#4f46e5', secondary: '#059669' },
  { primary: '#7c3aed', secondary: '#0d9488' },
  { primary: '#2563eb', secondary: '#10b981' },
  { primary: '#0d9488', secondary: '#047857' },
  { primary: '#6366f1', secondary: '#4f46e5' }
]

function truncateSegment(str, maxChars = MAX_LABEL_CHARS) {
  const s = String(str || '').trim()
  if (s.length <= maxChars) return s
  return s.slice(0, maxChars) + '...'
}

/** X축 복수 값(일자/캠페인/워크플로우/채널)을 " / " 기준으로 줄바꿈 표시. 세그먼트당 길이 제한 후 overflow 효과로 겹침 방지 */
function XAxisTickMultiline({ x, y, payload }) {
  const label = payload?.value ?? ''
  const parts = String(label).split(' / ').filter(Boolean).map((p) => truncateSegment(p.trim()))
  const fontSize = 11
  return (
    <g transform={`translate(${x}, ${y + X_LABEL_OFFSET})`}>
      <text textAnchor="middle" fill="#374151" fontSize={fontSize}>
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

export default function AggregatedBarChart({ data = [], groupBy = {} }) {
  if (!data.length) return null
  // 발송성공 수 기준 내림차순 정렬 후 상위 N건 (백엔드와 동일 기준, 프론트에서도 보장)
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
    const pair = DATE_BAR_PALETTE[idx % DATE_BAR_PALETTE.length]
    return pair
  }
  const hasMultiline = chartData.some((d) => (d.name || '').includes(' / '))
  const bottomMargin = hasMultiline ? X_AXIS_BOTTOM_MARGIN : 24
  const barCount = chartData.length
  const chartMinWidth = Math.max(280, barCount * LABEL_SLOT_WIDTH)
  return (
    <section className="aggregated-bar-chart aggregated-bar-chart-section">
      <div
        className="aggregated-bar-chart__chart-wrap"
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
