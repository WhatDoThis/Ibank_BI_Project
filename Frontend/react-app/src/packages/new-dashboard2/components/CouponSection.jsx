/**
 * CouponSection (쿠폰 분석 섹션)
 * ===============================
 * S4 get_coupon_analyze 응답 기반: 총 주문·발급·사용·추정 기여 주문 스칼라, 퍼널, 사용률·주문전환율, 발급/사용 연령·성별 차트.
 *
 * [Main]
 * 1. 스칼라, 퍼널(발급→사용→추정 기여 주문), SectionTrendChart, 기여도 추정, 발급/사용 연령·성별
 *
 * [Components / Functions]
 * 1. getRateSignal, getOrderConversionSignal: 신호등 기준
 * 2. computeContribution: 캠페인 세그먼트 기반 기여도 추정
 * 3. CouponSection
 *
 * [Dependencies]
 * - ../utils/dateUtils, ../utils/chartHelpers, ./AgeGenderBarChart, ./DemographicDonut, ./FunnelBar, ./SectionTrendChart
 */

import { formatDateRangeLabel } from '../utils/dateUtils'
import { mapGenderToDonut } from '../utils/chartHelpers'
import AgeGenderBarChart from './AgeGenderBarChart'
import DemographicDonut from './DemographicDonut'
import FunnelBar from './FunnelBar'
import SectionBlock from './SectionBlock'
import SectionTrendChart from './SectionTrendChart'

const SCALAR_SPEC = [
  { key: 'order_cnt', label: '총 주문건수', color: '#ef4444' },
  { key: 'coupon_issue_cnt', label: '쿠폰 발급수', color: '#7c5cfc' },
  { key: 'coupon_use_cnt', label: '쿠폰 사용수', color: '#22c55e' },
]

const COUPON_TREND_METRICS = [
  { key: 'coupon_issue_cnt', label: '쿠폰 발급수', color: '#7c5cfc' },
  { key: 'coupon_use_cnt', label: '쿠폰 사용수', color: '#22c55e' },
  { key: 'order_cnt', label: '주문건수', color: '#ef4444' },
]

/* 신호등 기준 (%) */
const RATE_THRESHOLD = { GOOD: 60, WARN: 40 }
const ORDER_CONVERSION_THRESHOLD = { GOOD: 80, WARN: 50 }

// 1.
function getRateSignal(pct) {
  if (pct >= RATE_THRESHOLD.GOOD) return { text: '양호', icon: '✅' }
  if (pct >= RATE_THRESHOLD.WARN) return { text: '주의', icon: '🔶' }
  return { text: '미달', icon: '🔴' }
}

// 2.
function getOrderConversionSignal(pct) {
  if (pct >= ORDER_CONVERSION_THRESHOLD.GOOD) return { text: '양호', icon: '✅' }
  if (pct >= ORDER_CONVERSION_THRESHOLD.WARN) return { text: '주의', icon: '🔶' }
  return { text: '미달', icon: '🔴' }
}

// 3.
function computeContribution(campaignSegments, couponOrderCnt, overviewOrderCnt) {
  if (!Array.isArray(campaignSegments) || campaignSegments.length === 0) return null
  const couponSegs = campaignSegments.filter((s) => (Number(s.coupon_use_cnt) || 0) > 0)
  const couponWfSuccess = couponSegs.reduce((sum, s) => sum + (Number(s.send_success_cnt) || 0), 0)
  const totalSuccess = campaignSegments.reduce((sum, s) => sum + (Number(s.send_success_cnt) || 0), 0)
  const contributionRatio = totalSuccess > 0 ? couponWfSuccess / totalSuccess : 0
  const overallOrders = Number(overviewOrderCnt) || couponOrderCnt
  return {
    couponWorkflowCount: couponSegs.length,
    totalWorkflowCount: campaignSegments.length,
    contributionRatio,
    estimatedOrders: Math.round(overallOrders * contributionRatio),
  }
}

// 4.
export default function CouponSection({ data, dateRangeActual, period, campaignSegments, overviewOrderCnt }) {
  if (!data) return null

  const dateLabel =
    (period === 'weekly' || period === 'monthly') && dateRangeActual
      ? formatDateRangeLabel(dateRangeActual, period)
      : null

  const issueCnt = Number(data.coupon_issue_cnt) || 0
  const useCnt = Number(data.coupon_use_cnt) || 0
  const orderCnt = Number(data.order_cnt) || 0

  const useRatePct = issueCnt > 0 ? (useCnt / issueCnt) * 100 : 0
  const contributionData = computeContribution(campaignSegments, orderCnt, overviewOrderCnt)
  const effectiveOrderForConversion = contributionData ? contributionData.estimatedOrders : orderCnt
  const orderConversionPct = useCnt > 0 ? (effectiveOrderForConversion / useCnt) * 100 : 0
  const rateSig = getRateSignal(useRatePct)
  const orderSig = getOrderConversionSignal(orderConversionPct)

  const issueAge = Array.isArray(data.issue_age_distribution) ? data.issue_age_distribution : []
  const issueGender = mapGenderToDonut(data.issue_gender_distribution)
  const useAge = Array.isArray(data.use_age_distribution) ? data.use_age_distribution : []
  const useGender = mapGenderToDonut(data.use_gender_distribution)

  const estimatedOrders = contributionData?.estimatedOrders ?? 0
  const funnelThirdValue = contributionData ? estimatedOrders : orderCnt
  const funnelMax = Math.max(issueCnt || 1, useCnt, funnelThirdValue)

  return (
    <section className="nd2-coupon-section">
      <SectionBlock title="쿠폰 핵심 지표" subtitle={dateLabel ?? undefined}>
        <div className="nd2-overview-grid">
          {SCALAR_SPEC.map(({ key, label, color }) => (
            <div key={key} className="nd2-kpi-card" style={{ borderTop: `3px solid ${color}` }}>
              <div className="nd2-kpi-card__label">{label}</div>
              <div className="nd2-kpi-card__value">
                {(data[key] != null ? Number(data[key]) : 0).toLocaleString()}
              </div>
            </div>
          ))}
          {contributionData != null && (
            <div className="nd2-kpi-card" style={{ borderTop: '3px solid #f59e0b' }}>
              <div className="nd2-kpi-card__label">추정 기여 주문수</div>
              <div className="nd2-kpi-card__value">
                {contributionData.estimatedOrders.toLocaleString()}
              </div>
              <p className="nd2-info-note" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                전체 주문건수 × 쿠폰 워크플로우 발송성공 비중
              </p>
            </div>
          )}
        </div>
      </SectionBlock>
      <SectionTrendChart trend={data?.trend} period={period} metrics={COUPON_TREND_METRICS} />
      <SectionBlock
        title="쿠폰 전환 퍼널"
        subtitle={contributionData
          ? '발급 → 사용 → 추정 기여 주문수 (발송성공 비중 기반 추정)'
          : '쿠폰이 포함된 워크플로우만 집계 · 발급 → 사용 → 주문'}
      >
        <p className="nd2-info-note">
          {contributionData
            ? '※ 추정 기여 주문수 = 전체 주문 중 쿠폰 워크플로우 발송성공 비중만큼의 기여분으로 산출합니다.'
            : '※ 본 퍼널은 쿠폰이 발급된 캠페인의 데이터만 집계합니다. 캠페인 세그먼트 탭을 조회하면 추정 기여 주문수 퍼널로 전환됩니다.'}
        </p>
        <div className="nd2-funnel">
          <div className="nd2-funnel__bars">
            <FunnelBar
              label="쿠폰 발급"
              value={issueCnt}
              maxValue={issueCnt || 1}
              prevValue={null}
              color="#7c5cfc"
            />
            <FunnelBar
              label="쿠폰 사용"
              value={useCnt}
              maxValue={issueCnt || 1}
              prevValue={issueCnt}
              color="#22c55e"
            />
            <FunnelBar
              label={contributionData ? '추정 기여 주문수' : '주문'}
              value={funnelThirdValue}
              maxValue={funnelMax}
              prevValue={useCnt}
              color="#ef4444"
            />
          </div>
          <div className="nd2-funnel__rates">
            <div className="nd2-funnel__rate-card">
              <span className="nd2-funnel__rate-label">사용률</span>
              <span className="nd2-funnel__rate-value">{useRatePct.toFixed(1)}%</span>
            </div>
            <div className="nd2-funnel__rate-card">
              <span className="nd2-funnel__rate-label">사용 상태</span>
              <span className="nd2-funnel__rate-value">{rateSig.icon} {rateSig.text}</span>
            </div>
            <div className="nd2-funnel__rate-card">
              <span className="nd2-funnel__rate-label">{contributionData ? '추정 기여 전환율' : '주문전환율'}</span>
              <span className="nd2-funnel__rate-value">{orderConversionPct.toFixed(1)}%</span>
            </div>
            <div className="nd2-funnel__rate-card">
              <span className="nd2-funnel__rate-label">전환 상태</span>
              <span className="nd2-funnel__rate-value">{orderSig.icon} {orderSig.text}</span>
            </div>
          </div>
          {contributionData ? (
            <>
              <div className="nd2-coupon-contribution">
                <div className="nd2-coupon-contribution__card">
                  <span className="nd2-coupon-contribution__label">쿠폰 워크플로우(전체 워크플로우)</span>
                  <span className="nd2-coupon-contribution__value">
                    {contributionData.couponWorkflowCount}개(총 {contributionData.totalWorkflowCount}개)
                  </span>
                </div>
                <div className="nd2-coupon-contribution__card">
                  <span className="nd2-coupon-contribution__label">발송성공 비중</span>
                  <span className="nd2-coupon-contribution__value">
                    {(contributionData.contributionRatio * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="nd2-coupon-contribution__card">
                  <span className="nd2-coupon-contribution__label">추정 기여 주문수</span>
                  <span className="nd2-coupon-contribution__value">
                    {contributionData.estimatedOrders.toLocaleString()}건
                  </span>
                </div>
              </div>
              <p className="nd2-info-note">
                ※ 발송성공 비중 기반으로 전체 주문 중 쿠폰 기여분을 추정합니다.
              </p>
            </>
          ) : (
            <p className="nd2-info-note" style={{ marginTop: '1rem' }}>
              캠페인 세그먼트 탭을 조회하면 기여도 추정이 표시됩니다.
            </p>
          )}
        </div>
      </SectionBlock>
      <SectionBlock title="쿠폰 발급/사용 통계" subtitle="발급/사용 고객의 연령·성별">
        <div className="nd2-section-row">
          <AgeGenderBarChart
            data={issueAge}
            title="발급 연령대"
            color="#7c5cfc"
          />
          <div className="nd2-donut-card">
            <DemographicDonut
              data={issueGender}
              title="발급 성별"
            />
          </div>
        </div>
        <div className="nd2-section-row" style={{ marginTop: '1.5rem' }}>
          <AgeGenderBarChart
            data={useAge}
            title="사용 연령대"
            color="#22c55e"
          />
          <div className="nd2-donut-card">
            <DemographicDonut
              data={useGender}
              title="사용 성별"
            />
          </div>
        </div>
      </SectionBlock>
    </section>
  )
}
