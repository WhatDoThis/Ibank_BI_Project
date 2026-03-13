/**
 * FrequencySection (프리퀀시 섹션)
 * ================================
 * S3 get_frequency_analyze 응답 기반: 기간 라벨, 프리퀀시 달성 건수 스칼라, 달성 연령대·성별 차트.
 *
 * [Main]
 * 1. 날짜 라벨, 스칼라, SectionTrendChart, 달성 연령대·성별 (AgeGenderBarChart, DemographicDonut)
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

const FREQUENCY_TREND_METRICS = [
  { key: 'frequency_complete_cnt', label: '프리퀀시 달성 건수', color: '#06b6d4' },
]

// 1.
export default function FrequencySection({ data, dateRangeActual, period }) {
  if (!data) return null

  const dateLabel =
    (period === 'weekly' || period === 'monthly') && dateRangeActual
      ? formatDateRangeLabel(dateRangeActual, period)
      : null

  const completeAge = Array.isArray(data.complete_age_distribution) ? data.complete_age_distribution : []
  const completeGender = mapGenderToDonut(data.complete_gender_distribution)

  return (
    <section className="nd2-frequency-section">
      <SectionBlock title="프리퀀시 달성" subtitle={dateLabel ?? undefined}>
        <div className="nd2-overview-grid">
          <div className="nd2-kpi-card" style={{ borderTop: '3px solid #06b6d4' }}>
            <div className="nd2-kpi-card__label">프리퀀시 달성 건수</div>
            <div className="nd2-kpi-card__value">
              {(data.frequency_complete_cnt != null ? Number(data.frequency_complete_cnt) : 0).toLocaleString()}
            </div>
          </div>
        </div>
      </SectionBlock>
      <SectionTrendChart trend={data?.trend} period={period} metrics={FREQUENCY_TREND_METRICS} />
      <SectionBlock title="프리퀀시 달성 통계" subtitle="연령·성별 분포">
        <div className="nd2-section-row">
          <AgeGenderBarChart
            data={completeAge}
            title="달성 연령대"
            color="#06b6d4"
          />
          <div className="nd2-donut-card">
            <DemographicDonut
              data={completeGender}
              title="달성 성별"
            />
          </div>
        </div>
      </SectionBlock>
    </section>
  )
}
