/**
 * GradeDonutChart (등급 분포 도넛)
 * ================================
 * A~E 합계 100% 전제로 도넛+범례. count>0 등급만 슬라이스. props: data — [{ grade, count }, ...].
 * 3열 그리드에서 가로 row 레이아웃 시 도넛 너비 0 이슈 방지: `.nd-demo-chart--grade` 세로 스택(성별 도넛과 동일 패턴).
 *
 * [Components]
 * ===========
 * 1. GradeDonutChart (default export)
 *
 * [Dependencies]
 * =========
 * - recharts: PieChart, Pie, Cell, Tooltip, ResponsiveContainer
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const GRADE_COLORS = {
  A: '#7c5cfc',
  B: '#3b82f6',
  C: '#22c55e',
  D: '#f59e0b',
  E: '#ef4444',
}

// 1.
export default function GradeDonutChart({ data = [] }) {
  const filtered = (data || []).filter((d) => (d.count ?? 0) > 0)
  if (!filtered.length) return <div className="nd-empty">등급 데이터 없음</div>

  const total = filtered.reduce((s, d) => s + (d.count || 0), 0)
  const chartData = filtered.map((d) => ({ name: d.grade, value: d.count }))

  return (
    <div className="nd-demo-chart nd-demo-chart--grade">
      <div className="nd-demo-chart__donut">
        <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={200}>
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              dataKey="value"
              stroke="none"
              label={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={GRADE_COLORS[entry.name] || '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="nd-demo-chart__legend">
        {filtered.map((d) => (
          <div key={d.grade} className="nd-demo-chart__legend-item">
            <span className="nd-demo-chart__legend-dot" style={{ background: GRADE_COLORS[d.grade] }} />
            <span>{d.grade}등급</span>
            <span className="nd-demo-chart__legend-val">{d.count.toLocaleString()}</span>
            <span className="nd-demo-chart__legend-pct">
              ({((d.count / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
