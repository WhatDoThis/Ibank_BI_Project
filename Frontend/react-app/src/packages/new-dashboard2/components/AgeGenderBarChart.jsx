/**
 * AgeGenderBarChart (연령/성별 가로 막대 차트)
 * =============================================
 * New Dashboard 2 전용. 연령대별 또는 성별 count를 가로 막대로 표시.
 *
 * [Props]
 * 1. data, title, color, height
 *
 * [Dependencies]
 * - recharts (BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip, Cell)
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
  Tooltip,
  Cell,
} from 'recharts'

const DEFAULT_COLOR = '#7c5cfc'
const DEFAULT_HEIGHT = 220

// 1.
export default function AgeGenderBarChart({
  data = [],
  title = '',
  color = DEFAULT_COLOR,
  height = DEFAULT_HEIGHT,
}) {
  return (
    <div className="nd2-age-bar-chart">
      {title ? <h3 className="nd2-age-bar-chart__title">{title}</h3> : null}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 24, left: 60, bottom: 8 }}
        >
          <XAxis type="number" />
          <YAxis type="category" dataKey="range" width={50} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v) => [Number(v).toLocaleString(), '건수']}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: '0.8125rem', borderRadius: '6px' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} minPointSize={4}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={color}
                fillOpacity={0.4 + (i / Math.max(data.length - 1, 1)) * 0.6}
              />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(v) => (Number.isFinite(v) ? Number(v).toLocaleString() : '')}
              style={{ fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
