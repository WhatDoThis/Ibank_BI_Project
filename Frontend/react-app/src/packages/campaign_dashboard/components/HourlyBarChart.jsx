/**
 * HourlyBarChart (시간대별 막대 차트)
 * ===================================
 * 24시간대 세로 막대, 피크 구간 opacity 1·그 외 0.6.
 * props: data — [{ hour, count }, ...], title?, color?
 *
 * [Components]
 * ===========
 * 1. HourlyBarChart (default export)
 *
 * [Dependencies]
 * =========
 * - recharts: BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function HourlyBarChart({ data = [], title = '', color = '#7c5cfc' }) {
  if (!data.length) return <div className="nd-empty">{title ? `${title} 데이터 없음` : '데이터 없음'}</div>

  const maxCount = Math.max(...data.map((d) => d.count || 0))

  return (
    <div className="nd-hourly-card">
      {title && <div className="nd-hourly-card__title">{title}</div>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9 }}
            interval={2}
            tickFormatter={(v) => v.split('-')[0]}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
            width={40}
          />
          <Tooltip
            formatter={(value) => [value.toLocaleString() + '건', title || '건수']}
            labelFormatter={(label) => `${label}시`}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={20}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={color}
                fillOpacity={entry.count === maxCount && maxCount > 0 ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
