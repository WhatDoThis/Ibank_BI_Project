/**
 * dashboard2/components/ChannelDonutCharts2.jsx (채널별 도넛 차트)
 * ==================================================================
 * 대시보드2 전용. KPI channel_distribution 도넛 시각화. 클래스명 dashboard2-*.
 *
 * [의존성]
 * - React, recharts
 */

import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

function DonutBlock({ title, data, totalLabel }) {
  if (!data || data.length === 0) return null
  const total = data.reduce((s, d) => s + (d.value || 0), 0)
  const chartData = data.map((d, i) => ({
    name: d.channel,
    value: d.value || 0,
    percentage: d.percentage != null ? d.percentage : (total ? ((d.value || 0) / total) * 100 : 0),
    fill: CHART_COLORS[i % CHART_COLORS.length]
  }))
  return (
    <div className="dashboard2-donut-block">
      <div className="dashboard2-donut-block__title">{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [
              `${formatNum(value)} (${Number(props.payload?.percentage ?? 0).toFixed(2)}%)`,
              name
            ]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            layout="vertical"
            align="left"
            verticalAlign="middle"
            formatter={(value, entry) => (
              <span style={{ fontSize: 14, color: '#374151' }}>
                {value} {entry.payload?.percentage != null ? `(${Number(entry.payload.percentage).toFixed(2)}%)` : ''}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {totalLabel && (
        <div className="dashboard2-donut-block__total">
          합계: {formatNum(total)} {totalLabel}
        </div>
      )}
    </div>
  )
}

export default function ChannelDonutCharts2({ kpi }) {
  const dist = kpi?.channel_distribution
  if (!dist || (!dist.send?.length && !dist.success?.length)) return null
  return (
    <section className="dashboard2-channel-donut-section">
      <div className="dashboard2-donut-row">
        {dist.send?.length > 0 && (
          <DonutBlock title="발송 요청" data={dist.send} totalLabel="건" />
        )}
        {dist.success?.length > 0 && (
          <DonutBlock title="발송 성공" data={dist.success} totalLabel="건" />
        )}
      </div>
    </section>
  )
}
