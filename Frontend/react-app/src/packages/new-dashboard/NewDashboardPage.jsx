/**
 * NewDashboardPage (뉴 대시보드 메인 페이지)
 * ===========================================
 * 일간/주간/월간 현황판. getNewDashboardSummary + getNewDashboardTrendMulti 연동.
 *
 * [Main Functions]
 * 1. todayStr
 * 2. loadData (useCallback), moveDate, handleDateChange. 로딩은 새로고침 버튼 '조회 중...' 표시.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getNewDashboardTables,
  getNewDashboardSummary,
  getNewDashboardTrendMulti,
} from '@/shared/api/client'
import './new-dashboard.css'
import SummaryHeader from './components/SummaryHeader'
import KPISummaryCards from './components/KPISummaryCards'
import TrendLineChart from './components/TrendLineChart'
import CampaignRankTable from './components/CampaignRankTable'
import FunnelSection from './components/FunnelSection'

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
    try {
      const [summary, trendMulti] = await Promise.all([
        getNewDashboardSummary(tableId, targetDate, period),
        getNewDashboardTrendMulti(tableId, {
          endDate: targetDate,
          period,
          days: 10,
          count: 10,
          byChannel: true,
        }),
      ])
      setSummaryData(summary)
      setTrendMultiData(trendMulti)
    } catch (e) {
      setError(e.message || '데이터 조회 실패')
      setSummaryData(null)
      setTrendMultiData(null)
    } finally {
      setLoading(false)
    }
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

      {kpi && (
        <>
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

          <section className="nd-section">
            <h2 className="nd-section__title">전체 추이 그래프</h2>
            <TrendLineChart
              data={trendMultiData?.rows ?? []}
              byChannel={trendMultiData?.by_channel ?? false}
              period={period}
              endDate={targetDate}
              days={10}
              count={10}
            />
          </section>

          <section className="nd-section">
            <h2 className="nd-section__title">전체 발송 분석</h2>
            <FunnelSection kpi={kpi} />
          </section>

          <section className="nd-section">
            <h2 className="nd-section__title">캠페인 발송 순위</h2>
            <CampaignRankTable data={aggregatedData} />
          </section>
        </>
      )}

      {!kpi && !loading && !error && (
        <div className="new-dashboard-page__empty">조회된 데이터가 없습니다.</div>
      )}
    </div>
  )
}
