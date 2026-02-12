/**
 * dashboard2/components/ChannelDonutCharts2.jsx (채널별 도넛 차트)
 * ==================================================================
 * 대시보드2 KPI channel_distribution 도넛. 발송 요청·발송 성공 채널별 비중. 기준/비교 기간 블록 배경·도넛 색상 구분. 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
 *
 * [Main Functions]
 * ===========
 * - getDistributionTotal: 기준/비교 데이터 유무 판별
 * - DonutBlock: variant(default|base|compare). default=CHART_COLORS_PALETTE(기존), base=연한색, compare=짙은색
 * - ChannelDonutCharts2: kpi, compareKpi. 기준 블록(--base), 비교 블록(--compare). 비교 합계 0이면 빈 메시지 노출
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - ChannelDonutCharts2 (default export)
 *
 * [Dependencies]
 * =========
 * - React, recharts (PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip)
 */

import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

/** 공통 팔레트 (비교 미사용 시 또는 기준/비교 대응용). 비교 시 기준=연한색, 비교=짙은색 */
const CHART_COLORS_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']
/** 기준 기간 도넛 색상 (위 팔레트의 연한색) */
const BASE_CHART_COLORS = ['#c4b5fd', '#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5', '#a5b4fc']
/** 비교 기간 도넛 색상 (위 팔레트의 짙은색) */
const COMPARE_CHART_COLORS = ['#6d28d9', '#1d4ed8', '#047857', '#b45309', '#b91c1c', '#4338ca']

function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

function getDistributionTotal(dist) {
  if (!dist) return 0
  const sendTotal = (dist.send || []).reduce((s, d) => s + (d.value || 0), 0)
  const successTotal = (dist.success || []).reduce((s, d) => s + (d.value || 0), 0)
  return sendTotal + successTotal
}

function DonutBlock({ title, data, totalLabel, variant = 'default' }) {
  if (!data || data.length === 0) return null
  const total = data.reduce((s, d) => s + (d.value || 0), 0)
  const colors = variant === 'compare' ? COMPARE_CHART_COLORS : variant === 'base' ? BASE_CHART_COLORS : CHART_COLORS_PALETTE
  const chartData = data.map((d, i) => ({
    name: d.channel,
    value: d.value || 0,
    percentage: d.percentage != null ? d.percentage : (total ? ((d.value || 0) / total) * 100 : 0),
    fill: colors[i % colors.length]
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

export default function ChannelDonutCharts2({ kpi, compareKpi }) {
  const dist = kpi?.channel_distribution
  const compareDist = compareKpi?.channel_distribution
  const hasBase = dist && (dist.send?.length || dist.success?.length)
  const compareTotal = getDistributionTotal(compareDist)
  const hasCompareData = compareTotal > 0
  const showCompareBlock = compareKpi != null
  if (!hasBase && !showCompareBlock) return null
  return (
    <section className="dashboard2-channel-donut-section">
      {hasBase && (
        <div className={`dashboard2-donut-period-block ${showCompareBlock ? 'dashboard2-donut-period-block--base' : ''}`}>
          <div className="dashboard2-donut-period-title">기준 기간</div>
          <div className="dashboard2-donut-row">
            {dist.send?.length > 0 && (
              <DonutBlock title="발송 요청" data={dist.send} totalLabel="건" variant={showCompareBlock ? 'base' : 'default'} />
            )}
            {dist.success?.length > 0 && (
              <DonutBlock title="발송 성공" data={dist.success} totalLabel="건" variant={showCompareBlock ? 'base' : 'default'} />
            )}
          </div>
        </div>
      )}
      {showCompareBlock && (
        <div className="dashboard2-donut-period-block dashboard2-donut-period-block--compare">
          <div className="dashboard2-donut-period-title">비교 기간</div>
          {hasCompareData ? (
            <div className="dashboard2-donut-row">
              {compareDist.send?.length > 0 && (
                <DonutBlock title="발송 요청" data={compareDist.send} totalLabel="건" variant="compare" />
              )}
              {compareDist.success?.length > 0 && (
                <DonutBlock title="발송 성공" data={compareDist.success} totalLabel="건" variant="compare" />
              )}
            </div>
          ) : (
            <div className="dashboard2-donut-period-block__empty-msg" role="status">
              해당 기간 데이터가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
