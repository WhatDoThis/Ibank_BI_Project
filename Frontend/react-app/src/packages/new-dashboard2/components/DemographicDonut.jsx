/**
 * DemographicDonut (인구통계 도넛 차트)
 * =====================================
 * New Dashboard 2 전용. 성별/구간별 비율을 도넛 형태로 표시. 범례(라벨+퍼센트+값)는 컴포넌트 하단에 직접 렌더.
 *
 * [Props]
 * 1. data, title, colors (optional)
 *
 * [Dependencies]
 * - recharts (PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label)
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts'

const DEFAULT_COLORS = ['#3b82f6', '#ec4899', '#9ca3af']

// 1.
export default function DemographicDonut({
  data = [],
  title = '',
  colors = DEFAULT_COLORS,
}) {
  const total = data.reduce((s, d) => s + (d.value ?? 0), 0)
  const totalLabel = total > 0 ? total.toLocaleString() : '0'

  return (
    <div className="nd2-demographic-donut">
      {title && <h3 className="nd2-demographic-donut__title">{title}</h3>}
      <div className="nd2-demographic-donut__chart-wrap">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={36}
              outerRadius={65}
              paddingAngle={1}
              cx="50%"
              cy="50%"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || viewBox.cx == null) return null
                  const cx = viewBox.cx ?? 0
                  const cy = viewBox.cy ?? 0
                  return (
                    <g>
                      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" className="nd2-demographic-donut__center-value">{totalLabel}</text>
                      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" className="nd2-demographic-donut__center-caption">합계</text>
                    </g>
                  )
                }}
              />
            </Pie>
            <Tooltip formatter={(v) => [Number(v).toLocaleString(), '']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {data.length > 0 && (
        <ul className="nd2-demographic-donut__legend">
          {data.map((entry, i) => {
            const val = entry.value ?? 0
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
            return (
              <li key={i} className="nd2-demographic-donut__legend-item">
                <span className="nd2-demographic-donut__legend-dot" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="nd2-demographic-donut__legend-label">{entry.label ?? ''}</span>
                <span className="nd2-demographic-donut__legend-pct">{pct}%</span>
                <span className="nd2-demographic-donut__legend-value">{Number(val).toLocaleString()}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
