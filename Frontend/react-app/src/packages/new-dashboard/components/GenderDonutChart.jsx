/**
 * GenderDonutChart (성별 분포 도넛)
 * =================================
 * PieChart 기반 남/여 분포. props: male, female (숫자). 3열 그리드 대응: 슬라이스 라벨 비표시(label=false), 범례만 사용.
 *
 * [Components]
 * ===========
 * 1. GenderDonutChart (default export)
 *
 * [Dependencies]
 * =========
 * - recharts: PieChart, Pie, Cell, Tooltip, ResponsiveContainer
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const GENDER_COLORS = { 남성: '#3b82f6', 여성: '#ec4899' }

export default function GenderDonutChart({ male = 0, female = 0 }) {
  const total = male + female
  if (total === 0) return <div className="nd-empty">성별 데이터 없음</div>

  const data = [
    { name: '남성', value: male },
    { name: '여성', value: female },
  ]

  return (
    <div className="nd-demo-chart nd-demo-chart--gender">
      <div className="nd-demo-chart__donut">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={62}
              dataKey="value"
              stroke="none"
              label={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={GENDER_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="nd-demo-chart__legend">
        {data.map((d) => (
          <div key={d.name} className="nd-demo-chart__legend-item">
            <span className="nd-demo-chart__legend-dot" style={{ background: GENDER_COLORS[d.name] }} />
            <span>{d.name}</span>
            <span className="nd-demo-chart__legend-val">{d.value.toLocaleString()}명</span>
            <span className="nd-demo-chart__legend-pct">
              ({total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
