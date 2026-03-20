/**
 * AgeBarChart (나이대 분포 — 가로 막대)
 * =====================================
 * layout="vertical" BarChart. props: data — [{ group, count }, ...] (API age 배열).
 *
 * [Components]
 * ===========
 * 1. AgeBarChart (default export)
 *
 * [Dependencies]
 * =========
 * - recharts: BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const AGE_COLOR = '#7c5cfc'

export default function AgeBarChart({ data = [] }) {
  if (!data.length) return <div className="nd-empty">나이대 데이터 없음</div>

  const total = data.reduce((s, d) => s + (d.count || 0), 0)
  const chartData = data.map((d) => ({
    ...d,
    pct: total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0,
  }))

  return (
    <div className="nd-demo-chart">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
          <YAxis type="category" dataKey="group" tick={{ fontSize: 12 }} width={50} />
          <Tooltip
            formatter={(value) => [value.toLocaleString() + '명', '인원']}
            labelFormatter={(label) => `나이대: ${label}`}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={AGE_COLOR} fillOpacity={Math.min(1, 0.7 + (i * 0.05))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
