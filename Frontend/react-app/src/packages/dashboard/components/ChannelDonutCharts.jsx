/**
 * dashboard/components/ChannelDonutCharts.jsx (채널별 도넛 차트)
 * =================================================================
 * KPI channel_distribution을 도넛 차트로 시각화. 발송 요청·발송 성공 채널별 비중.
 * 비교 시 기준 블록(연한색)·비교 블록(짙은색) 구분, 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
 *
 * [Components]
 * ===========
 * 1. formatNum: 숫자 포맷
 * 2. getDistributionTotal: 비교 데이터 유무 판별
 * 3. DonutBlock: variant(default|base|compare). default=기존 팔레트, base=연한색, compare=짙은색
 * 4. ChannelDonutCharts: kpi, compareKpi. 기준/비교 블록 배경·도넛 색상 구분
 *
 * [Dependencies]
 * =========
 * - React, recharts (PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip)
 */

import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

/** 공통 팔레트. 비교 시 기준=연한색, 비교=짙은색 */
const CHART_COLORS_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']
/** 기준 기간 도넛 (연한색) */
const BASE_CHART_COLORS = ['#c4b5fd', '#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5', '#a5b4fc']
/** 비교 기간 도넛 (짙은색) */
const COMPARE_CHART_COLORS = ['#6d28d9', '#1d4ed8', '#047857', '#b45309', '#b91c1c', '#4338ca']

// 1.
function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

// 2.
function getDistributionTotal(dist) {
  if (!dist) return 0
  const sendTotal = (dist.send || []).reduce((s, d) => s + (d.value || 0), 0)
  const successTotal = (dist.success || []).reduce((s, d) => s + (d.value || 0), 0)
  return sendTotal + successTotal
}

// 3.
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

// 4.
export default function ChannelDonutCharts({ kpi, compareKpi }) {
  const dist = kpi?.channel_distribution
  const compareDist = compareKpi?.channel_distribution
  const hasBase = dist && (dist.send?.length || dist.success?.length)
  const compareTotal = getDistributionTotal(compareDist)
  const hasCompareData = compareTotal > 0
  const showCompareBlock = compareKpi != null
  if (!hasBase && !showCompareBlock) return null
  return (
    <section className="channel-donut-charts-section channel-donut-charts">
      {hasBase && (
        <div className={`donut-period-block ${showCompareBlock ? 'donut-period-block--base' : ''}`}>
          <div className="donut-period-title">기준 기간</div>
          <div className="donut-row channel-donut-charts__row">
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
        <div className="donut-period-block donut-period-block--compare">
          <div className="donut-period-title">비교 기간</div>
          {hasCompareData ? (
            <div className="donut-row channel-donut-charts__row">
              {compareDist.send?.length > 0 && (
                <DonutBlock title="발송 요청" data={compareDist.send} totalLabel="건" variant="compare" />
              )}
              {compareDist.success?.length > 0 && (
                <DonutBlock title="발송 성공" data={compareDist.success} totalLabel="건" variant="compare" />
              )}
            </div>
          ) : (
            <div className="donut-period-block__empty-msg" role="status">
              해당 기간 데이터가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
