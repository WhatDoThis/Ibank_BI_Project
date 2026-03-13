/**
 * OverviewTrendChart (종합현황 추이 차트)
 * =======================================
 * trend.rows 기반 Recharts LineChart. 메트릭 탭 4개(발송요청/발송성공/주문건수/총매출), 탭 변경 시 onMetricChange로 부모가 재조회.
 *
 * [Main]
 * 1. 메트릭 탭, X축 period별 라벨, Y축 K 단위, dataKey=selectedMetric
 *
 * [Props]
 * 1. trend, period, selectedMetric, onMetricChange, loading
 *
 * [Dependencies]
 * - recharts, ../utils/dateUtils (getMonthWeekLabel), ./SectionBlock
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getMonthWeekLabel } from '../utils/dateUtils'
import SectionBlock from './SectionBlock'

const METRIC_TABS = [
  { key: 'send_request_cnt', label: '발송요청', color: '#7c5cfc' },
  { key: 'send_success_cnt', label: '발송성공', color: '#3b82f6' },
  { key: 'order_cnt', label: '주문건수', color: '#ef4444' },
  { key: 'total_sales_cnt', label: '총매출', color: '#10b981' },
]

// 2.
function formatDateLabel(ymd, period) {
  if (!ymd) return ''
  const s = String(ymd).slice(0, 10)
  if (period === 'monthly') return `${s.slice(0, 4)}-${s.slice(5, 7)}`
  if (period === 'weekly') return getMonthWeekLabel(s) || s
  return `${s.slice(5, 7)}/${s.slice(8, 10)}`
}

// 3.
function formatYAxis(value, metricKey) {
  const n = Number(value)
  if (metricKey === 'total_sales_cnt') {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
  }
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return String(value)
}

// 4.
function formatTooltipValue(value, metricKey) {
  const n = Number(value)
  if (metricKey === 'total_sales_cnt') {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B 원`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M 원`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K 원`
    return `${n.toLocaleString()}원`
  }
  return n.toLocaleString()
}

// 5.
export default function OverviewTrendChart({
  trend,
  period,
  selectedMetric,
  onMetricChange,
  loading = false,
}) {
  const rows = trend?.rows ?? []
  const chartData = rows.map((r) => ({
    ...r,
    dateLabel: formatDateLabel(r.base_date ?? r.date, period),
  }))

  const currentMetric = METRIC_TABS.find((t) => t.key === selectedMetric)
  const lineColor = currentMetric?.color ?? '#7c5cfc'
  const yAxisFormatter = (value) => formatYAxis(value, selectedMetric)

  return (
    <SectionBlock
      title="추이 분석"
      headerRight={
        <div className="nd2-trend-chart__tabs">
          {METRIC_TABS.map(({ key, label, color }) => (
            <button
              type="button"
              key={key}
              className={`nd2-trend-chart__tab ${selectedMetric === key ? 'nd2-trend-chart__tab--active' : ''}`}
              style={selectedMetric === key ? { background: color, borderColor: color, color: '#fff' } : undefined}
              onClick={() => onMetricChange(key)}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="nd2-trend-chart__chart" style={{ minHeight: 280 }}>
        {loading && (
          <div className="nd2-trend-chart__overlay">추이 로딩 중...</div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => formatTooltipValue(value, selectedMetric)}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke={lineColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={currentMetric?.label ?? selectedMetric}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionBlock>
  )
}
