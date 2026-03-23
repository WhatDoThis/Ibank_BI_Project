/**
 * NewDashboardPage (뉴 대시보드 메인 페이지)
 * ===========================================
 * 일간/주간/월간 현황판. 캠페인 요약·추이와 회원 요약·시간대별 분석을 분리 로딩한다.
 *
 * [Main Functions]
 * 1. todayStr
 * 2. loadData (useCallback): 주간 시 weeklySnapshotTargetDate(월요일 state → min(일요일, 오늘))로 API target_date 보정 후 캠페인(summary+trendMulti) / 회원+시간대(member+hourly×3). moveDate, handleDateChange.
 *    회원 현황·회원 분석·채널 발송+동의·전체 추이(하단 전폭)·시간대 차트 등 신규 섹션 렌더.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getNewDashboardTables,
  getNewDashboardSummary,
  getNewDashboardTrendMulti,
  getNewDashboardMemberSummary,
  getNewDashboardHourly,
} from '@/packages/new-dashboard/api/newDashboardClient.js'
import './new-dashboard.css'
import { weeklySnapshotTargetDate } from './components/dateUtils.js'
import SummaryHeader from './components/SummaryHeader'
import KPISummaryCards from './components/KPISummaryCards'
import TrendLineChart from './components/TrendLineChart'
import CampaignRankTable from './components/CampaignRankTable'
import FunnelSection from './components/FunnelSection'
import MemberKPICards from './components/MemberKPICards'
import GenderDonutChart from './components/GenderDonutChart'
import AgeBarChart from './components/AgeBarChart'
import GradeDonutChart from './components/GradeDonutChart'
import ChannelStackBarChart from './components/ChannelStackBarChart'
import ChannelConsentBars from './components/ChannelConsentBars'
import HourlyBarChart from './components/HourlyBarChart'

// 1.
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 2.
export default function NewDashboardPage() {
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [targetDate, setTargetDate] = useState(todayStr())
  const [period, setPeriod] = useState('daily')
  const [summaryData, setSummaryData] = useState(null)
  const [trendMultiData, setTrendMultiData] = useState(null)
  const [memberData, setMemberData] = useState(null)
  const [hourlySuccess, setHourlySuccess] = useState(null)
  const [hourlyOpen, setHourlyOpen] = useState(null)
  const [hourlyClick, setHourlyClick] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getNewDashboardTables()
      .then((res) => {
        if (cancelled) return
        const list = res.tables || []
        setTables(list)
        if (list.length > 0 && !tableId) setTableId(list[0].id)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!tableId) return
    setLoading(true)
    setError(null)
    const apiTargetDate = period === 'weekly' ? weeklySnapshotTargetDate(targetDate) : targetDate
    try {
      const [summary, trendMulti] = await Promise.all([
        getNewDashboardSummary(tableId, apiTargetDate, period),
        getNewDashboardTrendMulti(tableId, {
          endDate: apiTargetDate,
          period,
          days: 10,
          count: 10,
          byChannel: true,
        }),
      ])
      setSummaryData(summary)
      setTrendMultiData(trendMulti)
    } catch (e) {
      setError(e.message || '캠페인 데이터 조회 실패')
      setSummaryData(null)
      setTrendMultiData(null)
    }
    try {
      const [member, hSuccess, hOpen, hClick] = await Promise.all([
        getNewDashboardMemberSummary(tableId, { targetDate: apiTargetDate, period }),
        getNewDashboardHourly(tableId, { targetDate: apiTargetDate, period, metric: 'success' }),
        getNewDashboardHourly(tableId, { targetDate: apiTargetDate, period, metric: 'open' }),
        getNewDashboardHourly(tableId, { targetDate: apiTargetDate, period, metric: 'click' }),
      ])
      setMemberData(member)
      setHourlySuccess(hSuccess)
      setHourlyOpen(hOpen)
      setHourlyClick(hClick)
      // 데이터 확인 로그
      if (!member) console.warn('member-summary: 데이터 없음')
      if (!hSuccess?.data?.length) console.warn('hourly success: 데이터 없음', hSuccess)
      if (!hOpen?.data?.length) console.warn('hourly open: 데이터 없음', hOpen)
      if (!hClick?.data?.length) console.warn('hourly click: 데이터 없음', hClick)
    } catch (e) {
      console.error('신규 섹션 데이터 로딩 실패:', e.message, e)
      setMemberData(null)
      setHourlySuccess(null)
      setHourlyOpen(null)
      setHourlyClick(null)
    }
    setLoading(false)
  }, [tableId, targetDate, period])

  useEffect(() => {
    loadData()
  }, [loadData])

  const moveDate = (delta) => {
    const d = new Date(targetDate)
    if (period === 'monthly') {
      d.setMonth(d.getMonth() + delta)
    } else if (period === 'weekly') {
      d.setDate(d.getDate() + delta * 7)
    } else {
      d.setDate(d.getDate() + delta)
    }
    setTargetDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }

  const handleDateChange = (newDate) => {
    setTargetDate(newDate)
  }

  const kpi = summaryData?.kpi ?? null
  const aggregatedData = summaryData?.aggregated_data ?? []
  const dateRangeActual = summaryData?.date_range_actual ?? null

  return (
    <div className="new-dashboard-page">
      <SummaryHeader
        tables={tables}
        tableId={tableId}
        onTableChange={setTableId}
        targetDate={targetDate}
        onDateChange={handleDateChange}
        period={period}
        onPeriodChange={setPeriod}
        dateRangeActual={dateRangeActual}
        onPrev={() => moveDate(-1)}
        onNext={() => moveDate(1)}
        onRefresh={loadData}
        loading={loading}
      />

      {error && <div className="new-dashboard-page__error">{error}</div>}

      {(kpi || memberData) && (
        <>
          {/* ━━━ 섹션 1: 회원 현황 KPI (1행 4열) ━━━ */}
          {memberData && (
            <section className="nd-section">
              <h2 className="nd-section__title">회원 현황</h2>
              <MemberKPICards memberData={memberData} />
            </section>
          )}

          {/* ━━━ 섹션 2: 회원 인구통계 (1행 3열: 나이대 | 성별 | 등급) ━━━ */}
          {memberData && (
            <section className="nd-section">
              <h2 className="nd-section__title">회원 분석</h2>
              <div className="nd-demo-grid nd-demo-grid--3col">
                <div className="nd-demo-grid__item">
                  <h3 className="nd-demo-grid__subtitle">나이대 분포</h3>
                  <AgeBarChart data={memberData.age} />
                </div>
                <div className="nd-demo-grid__item">
                  <h3 className="nd-demo-grid__subtitle">성별 분포</h3>
                  <GenderDonutChart
                    male={memberData.gender?.male || 0}
                    female={memberData.gender?.female || 0}
                  />
                </div>
                <div className="nd-demo-grid__item">
                  <h3 className="nd-demo-grid__subtitle">등급 분포</h3>
                  <GradeDonutChart data={memberData.grade} />
                </div>
              </div>
            </section>
          )}

          {/* ━━━ 섹션 3: 캠페인 요약 KPI (기존 — 2행 3열) ━━━ */}
          {kpi && (
            <section className="nd-section">
              <h2 className="nd-section__title">캠페인 요약</h2>
              <KPISummaryCards
                kpi={kpi}
                changePcts={{
                  send_change_pct: kpi.send_change_pct,
                  success_change_pct: kpi.success_change_pct,
                  open_change_pct: kpi.open_change_pct,
                  click_change_pct: kpi.click_change_pct,
                }}
              />
            </section>
          )}

          {/* ━━━ 섹션 4: 채널별 발송 | 채널별 동의 (2열) + 전체 추이 그래프 (하단 전폭) ━━━ */}
          <section className="nd-section">
            <div className="nd-channel-trend-stack">
              <div className="nd-two-col">
                <div className="nd-two-col__left">
                  <h2 className="nd-section__title">채널별 발송 현황</h2>
                  <ChannelStackBarChart
                    data={trendMultiData?.rows ?? []}
                    period={period}
                  />
                </div>
                <div className="nd-two-col__right">
                  <h2 className="nd-section__title">마켓팅 수신 동의 현황</h2>
                  {memberData ? (
                    <ChannelConsentBars
                      optIn={memberData.opt_in}
                      totalRecipients={memberData.total_recipients}
                    />
                  ) : (
                    <div className="nd-empty">회원 현황 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
              <div className="nd-full-width-trend">
                <h2 className="nd-section__title">전체 추이 그래프</h2>
                <TrendLineChart
                  data={trendMultiData?.rows ?? []}
                  byChannel={trendMultiData?.by_channel ?? false}
                  period={period}
                  endDate={targetDate}
                  days={10}
                  count={10}
                />
              </div>
            </div>
          </section>

          {/* ━━━ 섹션 5: 시간대별 분석 (1행 3열) ━━━ */}
          <section className="nd-section">
            <h2 className="nd-section__title">시간대별 분석</h2>
            <div className="nd-hourly-grid">
              <HourlyBarChart
                data={hourlySuccess?.data ?? []}
                title="발송 성공"
                color="#3b82f6"
              />
              <HourlyBarChart
                data={hourlyOpen?.data ?? []}
                title="오픈"
                color="#f59e0b"
              />
              <HourlyBarChart
                data={hourlyClick?.data ?? []}
                title="클릭"
                color="#22c55e"
              />
            </div>
          </section>

          {/* ━━━ 섹션 6: 전체 발송 분석 퍼널 (기존) ━━━ */}
          {kpi && (
            <section className="nd-section">
              <h2 className="nd-section__title">전체 발송 분석</h2>
              <FunnelSection kpi={kpi} />
            </section>
          )}

          {/* ━━━ 섹션 7: 캠페인 발송 순위 (기존) ━━━ */}
          <section className="nd-section">
            <h2 className="nd-section__title">캠페인 발송 순위</h2>
            <CampaignRankTable data={aggregatedData} />
          </section>
        </>
      )}

      {!kpi && !memberData && !loading && !error && (
        <div className="new-dashboard-page__empty">조회된 데이터가 없습니다.</div>
      )}
    </div>
  )
}
