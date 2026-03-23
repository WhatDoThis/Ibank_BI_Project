/**
 * ChannelStackBarChart (채널별 스택 바 차트)
 * ==========================================
 * trend-multi rows(by_channel=true) + 메트릭 탭. recharts BarChart(stacked).
 * props: data — rows[], period — daily|weekly|monthly.
 *
 * [Main Functions]
 * ===========
 * 1. pivotForStack: 날짜·채널별 metric 합산 → chartData, channels
 *
 * [Components]
 * ===========
 * 2. ChannelStackBarChart (default export)
 *
 * [Dependencies]
 * =========
 * - react: useState, useMemo
 * - recharts: BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
 * - ./dateUtils: formatDateLabel
 */
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatDateLabel } from './dateUtils'

const CHANNEL_COLORS = {
  Email: '#7c5cfc', SMS: '#f59e0b', iOS: '#3b82f6',
  Android: '#22c55e', Kakao: '#fbbf24', Unknown: '#9ca3af',
}

const METRIC_TABS = [
  { key: 'total_count', label: '발송수' },
  { key: 'success_count', label: '성공수' },
  { key: 'open_count', label: '오픈수' },
  { key: 'click_count', label: '클릭수' },
]

// 1.
function pivotForStack(rows, metric, period) {
  const dateMap = {}
  const channels = new Set()
  for (const r of rows || []) {
    const d = r.date
    const ch = r.channel || 'Unknown'
    channels.add(ch)
    if (!dateMap[d]) dateMap[d] = { date: d, dateLabel: formatDateLabel(d, period) }
    dateMap[d][ch] = (dateMap[d][ch] || 0) + (r[metric] || 0)
  }
  return {
    chartData: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
    channels: [...channels].sort(),
  }
}

// 2.
export default function ChannelStackBarChart({ data, period }) {
  const [metric, setMetric] = useState('total_count')

  const { chartData, channels } = useMemo(
    () => pivotForStack(data, metric, period),
    [data, metric, period]
  )

  if (!chartData.length) return <div className="nd-empty">채널별 데이터 없음</div>

  return (
    <div className="nd-channel-stack">
      <div className="nd-trend-chart__tabs">
        {METRIC_TABS.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            className={`nd-trend-chart__tab ${metric === key ? 'nd-trend-chart__tab--active' : ''}`}
            onClick={() => setMetric(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
          <Tooltip formatter={(v) => v.toLocaleString()} />
          <Legend />
          {channels.map((ch) => (
            <Bar
              key={ch}
              dataKey={ch}
              stackId="channel"
              fill={CHANNEL_COLORS[ch] || '#9ca3af'}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
