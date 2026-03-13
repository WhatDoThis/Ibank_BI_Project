/**
 * StarSection (별 분석 섹션)
 * ==========================
 * S2 get_star_analyze 응답 기반: 기간 라벨, 4개 스칼라 카드, 별 발급/선물/최초발급 비교 바, 발급·선물 연령/성별 차트.
 *
 * [Main]
 * 1. 날짜 라벨, 스칼라 카드, 비교 바, 추이 SectionTrendChart, 발급/선물 연령·성별 (AgeGenderBarChart, DemographicDonut)
 *
 * [Props]
 * 1. data, dateRangeActual, period
 *
 * [Dependencies]
 * - ../utils/dateUtils, ../utils/chartHelpers, ./AgeGenderBarChart, ./DemographicDonut, ./SectionTrendChart
 */

import { getMonthWeekLabel, formatDateRangeLabel } from '../utils/dateUtils'
import { mapGenderToDonut } from '../utils/chartHelpers'
import AgeGenderBarChart from './AgeGenderBarChart'
import DemographicDonut from './DemographicDonut'
import SectionBlock from './SectionBlock'
import SectionTrendChart from './SectionTrendChart'

const SCALAR_SPEC = [
  { key: 'order_cnt', label: '주문건수', color: '#ef4444' },
  { key: 'star_issue_cnt', label: '별 발급수', color: '#a855f7' },
  { key: 'star_first_issue_cnt', label: '최초 별 발급수', color: '#06b6d4' },
  { key: 'star_send_cnt', label: '별 선물수', color: '#7c5cfc' },
]

const COMPARISON_SPEC = [
  { key: 'star_issue_cnt', label: '별 발급', color: '#a855f7' },
  { key: 'star_send_cnt', label: '별 선물', color: '#7c5cfc' },
  { key: 'star_first_issue_cnt', label: '최초 별 발급', color: '#06b6d4' },
]

const STAR_TREND_METRICS = [
  { key: 'star_issue_cnt', label: '별 발급수', color: '#a855f7' },
  { key: 'star_send_cnt', label: '별 선물수', color: '#7c5cfc' },
  { key: 'star_first_issue_cnt', label: '최초 별 발급수', color: '#06b6d4' },
]

// 1.
export default function StarSection({ data, dateRangeActual, period }) {
  if (!data) return null

  const dateLabel =
    (period === 'weekly' || period === 'monthly') && dateRangeActual
      ? formatDateRangeLabel(dateRangeActual, period)
      : null

  const issueAge = Array.isArray(data.issue_age_distribution) ? data.issue_age_distribution : []
  const issueGender = mapGenderToDonut(data.issue_gender_distribution)
  const sendAge = Array.isArray(data.send_age_distribution) ? data.send_age_distribution : []
  const sendGender = mapGenderToDonut(data.send_gender_distribution)

  const maxComparison = Math.max(
    Number(data.star_issue_cnt) || 0,
    Number(data.star_send_cnt) || 0,
    Number(data.star_first_issue_cnt) || 0,
    1
  )

  return (
    <section className="nd2-star-section">
      <SectionBlock title="별 지표·비교" subtitle={dateLabel ?? undefined}>
        <div className="nd2-overview-grid">
          {SCALAR_SPEC.map(({ key, label, color }) => (
            <div key={key} className="nd2-kpi-card" style={{ borderTop: `3px solid ${color}` }}>
              <div className="nd2-kpi-card__label">{label}</div>
              <div className="nd2-kpi-card__value">
                {(data[key] != null ? Number(data[key]) : 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="nd2-star-comparison">
          <div className="nd2-star-comparison__bars">
            {COMPARISON_SPEC.map(({ key, label, color }) => {
              const value = Number(data[key]) || 0
              const pct = maxComparison > 0 ? (value / maxComparison) * 100 : 0
              return (
                <div key={key} className="nd2-star-comparison__row">
                  <span className="nd2-star-comparison__label">{label}</span>
                  <div className="nd2-star-comparison__track">
                    <div
                      className="nd2-star-comparison__fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className="nd2-star-comparison__value">{value.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      </SectionBlock>
      <SectionTrendChart trend={data?.trend} period={period} metrics={STAR_TREND_METRICS} />
      <SectionBlock title="별 발급/선물 통계" subtitle="발급·선물 고객의 연령·성별 분포">
        <div className="nd2-section-row">
          <AgeGenderBarChart
            data={issueAge}
            title="발급 연령대"
            color="#a855f7"
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
            data={sendAge}
            title="선물 연령대"
            color="#7c5cfc"
          />
          <div className="nd2-donut-card">
            <DemographicDonut
              data={sendGender}
              title="선물 성별"
            />
          </div>
        </div>
      </SectionBlock>
    </section>
  )
}
