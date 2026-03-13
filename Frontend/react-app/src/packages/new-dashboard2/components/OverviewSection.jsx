/**
 * OverviewSection (종합현황 섹션)
 * ================================
 * get_dashboard_overall(S1) 응답 기반: 기간 라벨, 4개 KPI 카드(발송/열람/주문/주문전환률), 부문별 요약(ScoreCardGrid).
 *
 * [Components / Functions]
 * 1. Sparkline: KPI 스파크라인
 * 2. getKpiSpec: KPI 스펙 배열
 * 3. formatValue: spec에 따른 값 포맷
 * 4. ChangePct: 전기 대비 증감률 표시
 * 5. buildScoreItems: summaryData → ScoreCardGrid용 items
 * 6. OverviewSection: summary, dateRangeActual, period, trendRows, summaryData, summaryLoading, prevSummary
 *
 * [Dependencies]
 * - ../utils/dateUtils (formatDateRangeLabel), ./SectionBlock, ./ScoreCardGrid
 */

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { formatDateRangeLabel } from '../utils/dateUtils'
import SectionBlock from './SectionBlock'
import ScoreCardGrid from './ScoreCardGrid'

// 1.
function Sparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return null
  return (
    <div className="nd2-kpi-card__sparkline">
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const ORDER_CONVERSION_COMPUTE = (d) =>
  d && Number(d.send_request_cnt) > 0 ? (Number(d.order_cnt) / Number(d.send_request_cnt)) * 100 : 0

// 2.
function getKpiSpec(summary) {
  const hasRead = summary?.read_cnt != null
  return [
    { key: 'send_request_cnt', label: '발송 건수', changeKey: 'send_request_cnt_change_pct', color: '#7c5cfc', format: 'number' },
    hasRead
      ? { key: 'read_cnt', label: '열람 건수', changeKey: 'read_cnt_change_pct', color: '#3b82f6', format: 'number' }
      : { key: 'send_success_cnt', label: '발송 성공', changeKey: 'send_success_cnt_change_pct', color: '#3b82f6', format: 'number' },
    { key: 'order_cnt', label: '주문 건수', changeKey: 'order_cnt_change_pct', color: '#ef4444', format: 'number' },
    {
      key: 'order_conversion',
      label: '주문전환률',
      changeKey: 'order_conversion_pp',
      color: '#10b981',
      format: 'percent',
      compute: ORDER_CONVERSION_COMPUTE,
    },
  ]
}

// 3.
function formatValue(spec, value) {
  if (value == null && !spec.compute) return '—'
  const n = Number(value)
  if (spec.format === 'percent') {
    return `${(n ?? 0).toFixed(1)}%`
  }
  return (n ?? 0).toLocaleString()
}

// 4.
function ChangePct({ changePct, suffix = '%' }) {
  if (changePct == null) return <span className="nd2-kpi-card__change">—</span>
  const n = Number(changePct)
  if (n === 0) return <span className="nd2-kpi-card__change">— 0{suffix}</span>
  const isUp = n > 0
  const cls = `nd2-kpi-card__change nd2-kpi-card__change--${isUp ? 'up' : 'down'}`
  return (
    <span className={cls}>
      {isUp ? '▲' : '▼'} {Math.abs(n).toFixed(1)}{suffix}
    </span>
  )
}

// 5.
function buildScoreItems(summaryData) {
  if (!summaryData) return []
  const items = []

  if (summaryData.star != null) {
    const s = summaryData.star
    items.push({
      title: '별',
      metrics: [
        { label: '별 발급수', value: s.issueCnt != null ? s.issueCnt.toLocaleString() : '—', unit: '건' },
        { label: '별 선물수', value: s.giftCnt != null ? s.giftCnt.toLocaleString() : '—', unit: '건' },
      ],
    })
  }
  if (summaryData.frequency != null) {
    const f = summaryData.frequency
    items.push({
      title: '프리퀀시',
      metrics: [
        { label: '프리퀀시 달성 건수', value: f.completeCnt != null ? f.completeCnt.toLocaleString() : '—', unit: '건' },
      ],
    })
  }
  if (summaryData.coupon != null) {
    const c = summaryData.coupon
    const hasContribution = c.estimatedCouponOrders != null && c.contributionRatio != null
    items.push({
      title: '쿠폰',
      metrics: [
        {
          label: '쿠폰 사용률',
          value: c.usageRate != null ? c.usageRate.toFixed(1) : '—',
          unit: '%',
        },
        hasContribution
          ? { label: '추정 기여 주문', value: c.estimatedCouponOrders.toLocaleString(), unit: '건' }
          : { label: '쿠폰 주문수', value: c.couponOrders != null ? c.couponOrders.toLocaleString() : '—', description: '기여도는 캠페인 탭 조회 후 갱신' },
      ],
    })
  }
  if (summaryData.campaign != null) {
    const c = summaryData.campaign
    items.push({
      title: '캠페인',
      metrics: [
        { label: '워크플로우 수', value: c.activeCampaigns != null ? c.activeCampaigns : '—' },
        { label: '평균 발송성공률', value: c.avgSuccessRate != null ? c.avgSuccessRate.toFixed(1) : '—', unit: '%' },
      ],
    })
  }
  if (summaryData.store != null) {
    const s = summaryData.store
    items.push({
      title: '매장',
      metrics: [
        { label: '총 매출', value: s.totalSales ?? '—' },
        { label: '매출 1위 매장', value: s.salesTopStore ?? '—' },
        { label: '쿠폰사용 1위 매장', value: s.couponUseTopStore ?? '—' },
      ],
    })
  }
  return items
}

// 6.
export default function OverviewSection({ summary, dateRangeActual, period, trendRows, summaryData, summaryLoading, prevSummary }) {
  if (!summary) return null

  const dateLabel = (period === 'weekly' || period === 'monthly') && dateRangeActual
    ? formatDateRangeLabel(dateRangeActual, period)
    : null

  const kpiSpec = getKpiSpec(summary)

  const getDisplayValue = (spec) => {
    if (spec.compute) return spec.compute(summary)
    const raw = summary[spec.valueKey ?? spec.key]
    return raw != null ? Number(raw) : null
  }

  const getChangePct = (spec) => {
    if (spec.key === 'order_conversion') {
      const curr = ORDER_CONVERSION_COMPUTE(summary)
      if (prevSummary) {
        const prev = ORDER_CONVERSION_COMPUTE(prevSummary)
        return Math.round((curr - prev) * 100) / 100
      }
      if ('prev_send_request_cnt' in summary && 'prev_order_cnt' in summary) {
        const prevSend = Number(summary.prev_send_request_cnt) || 0
        const prevOrder = Number(summary.prev_order_cnt) || 0
        const prevConv = prevSend > 0 ? (prevOrder / prevSend) * 100 : 0
        return Math.round((curr - prevConv) * 100) / 100
      }
      if (typeof summary.order_conversion_pp === 'number') return summary.order_conversion_pp
      if (summary.order_conversion_pp != null && !Number.isNaN(Number(summary.order_conversion_pp))) {
        return Number(summary.order_conversion_pp)
      }
      return null
    }
    const key = spec.changeKeyFallback || spec.changeKey
    return summary[key] != null ? Number(summary[key]) : null
  }

  const getChangeSuffix = (spec) => (spec.format === 'percent' && spec.key === 'order_conversion' ? 'pp' : '%')

  const sparklineKey = (spec) => spec.valueKey ?? spec.key

  const scoreItems = buildScoreItems(summaryData)

  return (
    <section className="nd2-overview-section">
      <SectionBlock title="핵심 지표" subtitle={dateLabel ?? undefined}>
        <div className="nd2-overview-grid">
          {kpiSpec.map((spec) => {
            const value = getDisplayValue(spec)
            const changePct = getChangePct(spec)
            const isOrderConversion = spec.key === 'order_conversion'
            return (
              <div key={spec.key} className="nd2-kpi-card" style={{ borderTop: `3px solid ${spec.color}` }}>
                <div className="nd2-kpi-card__label">{spec.label}</div>
                <div className="nd2-kpi-card__value">{formatValue(spec, value)}</div>
                <ChangePct changePct={changePct} suffix={getChangeSuffix(spec)} />
                {isOrderConversion && (
                  <p className="nd2-kpi-card__formula nd2-info-note">주문 전환률 = (주문 건수 ÷ 발송 건수) × 100 (%)</p>
                )}
                {trendRows && trendRows.length > 1 && trendRows[0]?.[sparklineKey(spec)] !== undefined && (
                  <Sparkline data={trendRows} dataKey={sparklineKey(spec)} color={spec.color} />
                )}
              </div>
            )
          })}
        </div>
        <div className="nd2-kpi-change-guide">
          <p className="nd2-kpi-change-guide__title">증감률 계산 방식</p>
          <p className="nd2-kpi-change-guide__period">「이전」은 선택한 기간 단위에 따라 <strong>전일</strong>(일간), <strong>전주</strong>(주간), <strong>전월</strong>(월간)입니다.</p>
          <ul className="nd2-kpi-change-guide__list">
            <li><strong>발송 건수·열람 건수(또는 발송 성공)·주문 건수</strong>: 전기 대비 증감률(%) = (현재 − 이전) ÷ 이전 × 100. 이전이 0이면 표시하지 않음.</li>
            <li><strong>주문 전환률</strong>: 전기 대비 변화는 %p(퍼센트포인트) = 현재 전환률 − 이전 전환률. (전환률 = 주문 건수 ÷ 발송 건수 × 100)</li>
          </ul>
        </div>
      </SectionBlock>
      <SectionBlock title="부문별 요약" subtitle={dateLabel ?? '선택 기간 기준'}>
        <ScoreCardGrid items={scoreItems} loading={summaryLoading} />
      </SectionBlock>
    </section>
  )
}
