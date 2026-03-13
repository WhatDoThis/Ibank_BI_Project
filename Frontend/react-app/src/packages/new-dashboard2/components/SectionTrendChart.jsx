/**
 * SectionTrendChart (섹션별 추이 차트 — 다중 메트릭 한 그래프)
 * =============================================================
 * trend.rows 기반 Recharts LineChart. 한 그래프에 여러 메트릭을 동시에 라인으로 표시.
 *
 * [Main]
 * 1. metrics 배열의 각 메트릭마다 Line 1개, X축 period별 날짜 라벨, Y축 K 단위, Tooltip 해당 일자 모든 메트릭 값
 *
 * [Props]
 * 1. trend, period, metrics, loading
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
  Legend,
} from 'recharts'
import { getMonthWeekLabel } from '../utils/dateUtils'
import SectionBlock from './SectionBlock'

// 1.
function formatDateLabel(ymd, period) {
  if (!ymd) return ''
  const s = String(ymd).slice(0, 10)
  if (period === 'monthly') return `${s.slice(0, 4)}-${s.slice(5, 7)}`
  if (period === 'weekly') return getMonthWeekLabel(s) || s
  return `${s.slice(5, 7)}/${s.slice(8, 10)}`
}

function formatYAxis(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return String(value)
}

// 2.
export default function SectionTrendChart({ trend, period, metrics = [], loading = false }) {
  const rows = trend?.rows ?? []
  const chartData = rows.map((r) => ({
    ...r,
    dateLabel: formatDateLabel(r.base_date ?? r.date, period),
  }))

  if (!Array.isArray(metrics) || metrics.length === 0) return null

  return (
    <SectionBlock title="추이">
      <div className="nd2-trend-chart__chart nd2-section-trend" style={{ minHeight: 280 }}>
        {loading && (
          <div className="nd2-trend-chart__overlay">추이 로딩 중...</div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => (value != null ? Number(value).toLocaleString() : '—')}
              labelFormatter={(label) => label}
            />
            <Legend />
            {metrics.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={m.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionBlock>
  )
}
