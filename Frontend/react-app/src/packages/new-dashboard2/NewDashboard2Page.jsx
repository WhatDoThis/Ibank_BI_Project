/**
 * NewDashboard2Page (뉴 대시보드2 메인 페이지)
 * ============================================
 * 마케팅 성과 분석 대시보드. targetDate/period/activeTab 상태, useNewDash2Data 훅으로 탭별 데이터 로드.
 *
 * [Main]
 * 1. moveDate, handleDateChange, 탭 전환
 * 2. Dash2Header + 탭바, overview: OverviewSection + OverviewTrendChart, star: StarSection, frequency: FrequencySection, coupon: CouponSection, campaign: CampaignSegmentTable, store: StoreSection
 *
 * [Dependencies]
 * - utils/dateUtils (toLocalDateString), hooks/useNewDash2Data, components/Dash2Header, OverviewSection, OverviewTrendChart, StarSection, FrequencySection, CouponSection, CampaignSegmentTable, StoreSection
 * - new-dashboard2.css
 */

import { useState, useMemo } from 'react'
import { toLocalDateString } from './utils/dateUtils'
import { useNewDash2Data } from './hooks/useNewDash2Data'
import Dash2Header from './components/Dash2Header'
import OverviewSection from './components/OverviewSection'
import OverviewTrendChart from './components/OverviewTrendChart'
import StarSection from './components/StarSection'
import FrequencySection from './components/FrequencySection'
import CouponSection from './components/CouponSection'
import CampaignSegmentTable from './components/CampaignSegmentTable'
import StoreSection from './components/StoreSection'
import './new-dashboard2.css'

const TABS = [
  { id: 'overview', label: '종합현황' },
  { id: 'star', label: '별' },
  { id: 'frequency', label: '프리퀀시' },
  { id: 'coupon', label: '쿠폰' },
  { id: 'store', label: '매장' },
  { id: 'campaign', label: '캠페인' },
]

const PLACEHOLDER_TABS = {}

const DEFAULT_TREND_METRIC = 'send_request_cnt'

// 1.
export default function NewDashboard2Page() {
  const [targetDate, setTargetDate] = useState(() => toLocalDateString(new Date()))
  const [period, setPeriod] = useState('daily')
  const [activeTab, setActiveTab] = useState('overview')
  const [overviewTrendMetric, setOverviewTrendMetric] = useState(DEFAULT_TREND_METRIC)

  const { data, loading, error, refresh, summaryData, summaryLoading, getCachedData } = useNewDash2Data(targetDate, period, activeTab)

  const dateRangeActual = useMemo(() => {
    if (!data) return null
    if (activeTab === 'overview' && data.summary) return data.summary.date_range_actual ?? null
    return data.date_range_actual ?? null
  }, [data, activeTab])

  const moveDate = (delta) => {
    const d = new Date(targetDate)
    if (period === 'monthly') {
      d.setMonth(d.getMonth() + delta)
    } else if (period === 'weekly') {
      d.setDate(d.getDate() + delta * 7)
    } else {
      d.setDate(d.getDate() + delta)
    }
    setTargetDate(toLocalDateString(d))
  }

  const handleDateChange = (val) => {
    setTargetDate(val)
  }

  return (
    <div className="nd2-page">
      <Dash2Header
        targetDate={targetDate}
        onDateChange={handleDateChange}
        period={period}
        onPeriodChange={setPeriod}
        dateRangeActual={dateRangeActual}
        onPrev={() => moveDate(-1)}
        onNext={() => moveDate(1)}
        onRefresh={refresh}
        loading={loading}
      />

      <nav className="nd2-tab-bar">
        {TABS.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            className={`nd2-tab ${activeTab === id ? 'nd2-tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="nd2-page__error" role="alert">
          {error}
        </div>
      )}

      <main className="nd2-page__content">
        {activeTab === 'overview' && (
          <div className="nd2-overview-tab">
            <OverviewSection
              summary={data?.summary}
              dateRangeActual={data?.summary?.date_range_actual}
              period={period}
              trendRows={data?.trend?.rows}
              summaryData={summaryData}
              summaryLoading={summaryLoading}
            />
            <OverviewTrendChart
              trend={data?.trend}
              period={period}
              selectedMetric={overviewTrendMetric}
              onMetricChange={setOverviewTrendMetric}
              loading={loading}
            />
          </div>
        )}
        {activeTab === 'star' && (
          <div className="nd2-star-tab">
            {loading ? (
              <div className="nd2-placeholder">별 데이터 로딩 중...</div>
            ) : (
              <StarSection data={data} dateRangeActual={dateRangeActual} period={period} />
            )}
          </div>
        )}
        {activeTab === 'frequency' && (
          <div className="nd2-frequency-tab">
            {loading ? (
              <div className="nd2-placeholder">프리퀀시 데이터 로딩 중...</div>
            ) : (
              <FrequencySection data={data} dateRangeActual={dateRangeActual} period={period} />
            )}
          </div>
        )}
        {activeTab === 'coupon' && (
          <div className="nd2-coupon-tab">
            {loading ? (
              <div className="nd2-placeholder">쿠폰 데이터 로딩 중...</div>
            ) : (
              <CouponSection
                data={data}
                dateRangeActual={dateRangeActual}
                period={period}
                campaignSegments={getCachedData('campaign')?.segments}
                overviewOrderCnt={getCachedData('overview')?.summary?.order_cnt}
              />
            )}
          </div>
        )}
        {activeTab === 'campaign' && (
          <div className="nd2-campaign-tab">
            {loading ? (
              <div className="nd2-placeholder">캠페인 데이터 로딩 중...</div>
            ) : (
              <CampaignSegmentTable
                segments={data?.segments}
                dateRangeActual={dateRangeActual}
                period={period}
              />
            )}
          </div>
        )}
        {activeTab === 'store' && (
          <div className="nd2-store-tab">
            {loading ? (
              <div className="nd2-placeholder">매장 데이터 로딩 중...</div>
            ) : (
              <StoreSection
                data={data}
                dateRangeActual={dateRangeActual}
                period={period}
              />
            )}
          </div>
        )}
        {PLACEHOLDER_TABS[activeTab] && (
          <div className="nd2-placeholder">
            {loading
              ? `${PLACEHOLDER_TABS[activeTab]} 데이터 로딩 중...`
              : activeTab}
          </div>
        )}
      </main>
    </div>
  )
}
