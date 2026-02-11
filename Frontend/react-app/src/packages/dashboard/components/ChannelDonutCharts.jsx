/**
 * dashboard/components/ChannelDonutCharts.jsx (채널별 도넛 차트)
 * =================================================================
 * KPI channel_distribution을 도넛 차트로 시각화. 발송 요청·발송 성공 채널별 비중.
 *
 * [Main Functions]
 * ===========
 * - ChannelDonutCharts: kpi prop. send·success 채널별 분포 PieChart (Recharts)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - ChannelDonutCharts (default export)
 *
 * [Dependencies]
 * =========
 * - React, recharts (PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip)
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
    <div className="donut-block channel-donut-charts__block">
      <div className="donut-block__title">{title}</div>
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
        <div className="donut-block__total">
          합계: {formatNum(total)} {totalLabel}
        </div>
      )}
    </div>
  )
}

export default function ChannelDonutCharts({ kpi }) {
  const dist = kpi?.channel_distribution
  if (!dist || (!dist.send?.length && !dist.success?.length)) return null
  return (
    <section className="channel-donut-charts-section channel-donut-charts">
      <div className="donut-row channel-donut-charts__row">
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
