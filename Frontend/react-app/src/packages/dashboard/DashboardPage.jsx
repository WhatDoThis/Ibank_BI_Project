/**
 * dashboard/DashboardPage.jsx (대시보드 메인 페이지)
 * ===================================================
 * 캠페인/일자/워크플로우/채널별 GROUP BY 집계 대시보드.
 * - 헤더: 테이블 선택 + 필터 조건(기간·캠페인·워크플로우·채널·집계 기준) → 적용 시 해당 조건 데이터만 표시
 * - 본문: KPI 카드 + 채널 도넛 + 기준별 막대 차트 + 집계 테이블 + 나만의 차트 위젯
 * - 기본 일자: 시작/종료 모두 오늘. 메인 영역 스크롤 가능.
 *
 * [주요 기능]
 * - 테이블 선택 (getDashboardTables), 필터·GROUP BY 변경 시 getDashboardData 호출
 * - KPI 카드·집계 테이블·차트 위젯( X축 임의 / Y축 실수만, 막대·선·영역 ) 표시
 *
 * [의존성]
 * - React, shared/api/client, dashboard/components (DashboardHeader, KPICards, ChannelDonutCharts, AggregatedBarChart, AggregatedDataTable, ChartWidget)
 */

import { useState, useEffect, useCallback } from 'react'
import { getDashboardData, getDashboardFilterOptions, getDashboardTables } from '@/shared/api/client'
import './dashboard.css'
import DashboardHeader from './components/DashboardHeader'
import KPICards from './components/KPICards'
import ChannelDonutCharts from './components/ChannelDonutCharts'
import AggregatedBarChart from './components/AggregatedBarChart'
import AggregatedDataTable from './components/AggregatedDataTable'
import ChartWidget from './components/ChartWidget'

const defaultGroupBy = { campaign: true, date: true, workflow: false, channel: true }

function getDefaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const today = `${y}-${m}-${d}`
  return [today, today]
}

export default function DashboardPage() {
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [filters, setFilters] = useState({
    table_id: '',
    date_range: getDefaultDateRange(),
    campaign_ids: [],
    workflow_ids: [],
    channels: [],
    group_by: { ...defaultGroupBy }
  })
  const [filterOptions, setFilterOptions] = useState({ campaigns: [], workflows: [], channels: [] })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chartWidgets, setChartWidgets] = useState([])

  // 테이블 목록 로드
  useEffect(() => {
    let cancelled = false
    getDashboardTables()
      .then((res) => {
        if (cancelled) return
        const list = res.tables || []
        setTables(list)
        if (list.length > 0 && !tableId) {
          const first = list[0].id
          setTableId(first)
          setFilters((prev) => ({ ...prev, table_id: first }))
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || '테이블 목록 조회 실패')
      })
    return () => { cancelled = true }
  }, [])

  // table_id 동기화
  useEffect(() => {
    if (tableId) setFilters((prev) => ({ ...prev, table_id: tableId }))
  }, [tableId])

  // 필터 옵션 로드: table_id 및 선택된 필터(campaign_ids, workflow_ids, channels) 변경 시 연동 옵션만 재조회
  useEffect(() => {
    if (!tableId) return
    let cancelled = false
    getDashboardFilterOptions(tableId, {
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || []
    })
      .then((res) => {
        if (cancelled) return
        const campaigns = res.campaigns || []
        const workflows = res.workflows || []
        const channels = res.channels || []
        setFilterOptions({ campaigns, workflows, channels })
        // 선택된 값 중 옵션 목록에 없는 것은 제거(다른 컬럼 선택 시 유효하지 않은 조합 방지). 변경 시에만 setFilters 호출해 루프 방지.
        setFilters((prev) => {
          const newCampaignIds = (prev.campaign_ids || []).filter((id) => campaigns.some((c) => c.id == id))
          const newWorkflowIds = (prev.workflow_ids || []).filter((id) => workflows.some((w) => w.id == id))
          const newChannels = (prev.channels || []).filter((code) => channels.some((ch) => String(ch.code) === String(code)))
          const changed =
            newCampaignIds.length !== (prev.campaign_ids || []).length ||
            newWorkflowIds.length !== (prev.workflow_ids || []).length ||
            newChannels.length !== (prev.channels || []).length
          if (!changed) return prev
          return { ...prev, campaign_ids: newCampaignIds, workflow_ids: newWorkflowIds, channels: newChannels }
        })
      })
      .catch(() => {
        if (!cancelled) setFilterOptions({ campaigns: [], workflows: [], channels: [] })
      })
    return () => { cancelled = true }
  }, [tableId, filters.campaign_ids, filters.workflow_ids, filters.channels])

  // 대시보드 데이터 로드 (filters 변경 시)
  const loadData = useCallback(() => {
    if (!filters.table_id || !filters.date_range?.length) return
    setLoading(true)
    setError(null)
    getDashboardData(filters)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || '대시보드 데이터 조회 실패')
        setData(null)
        setLoading(false)
      })
  }, [filters])

  useEffect(() => {
    if (filters.table_id && filters.date_range?.length >= 2) loadData()
  }, [loadData])

  const updateFilters = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateGroupBy = useCallback((updates) => {
    setFilters((prev) => ({
      ...prev,
      group_by: { ...(prev.group_by || defaultGroupBy), ...updates }
    }))
  }, [])

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh', background: '#f9fafb', padding: 24, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 헤더: 테이블 선택 + 필터 조건 (3번 이미지 스타일) */}
      <DashboardHeader
        tables={tables}
        tableId={tableId}
        onTableChange={setTableId}
        filters={filters}
        onFiltersChange={updateFilters}
        onGroupByChange={updateGroupBy}
        filterOptions={filterOptions}
        loading={loading}
        onLoad={loadData}
      />

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {!tableId && (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
          헤더에서 테이블을 선택한 뒤 조회하세요.
        </div>
      )}

      {tableId && (
        <>
          {data?.kpi && <KPICards kpi={data.kpi} />}
          {data?.kpi && <ChannelDonutCharts kpi={data.kpi} />}
          {data?.aggregated_data?.length > 0 && (
            <AggregatedBarChart
              data={data.aggregated_data}
              groupBy={filters.group_by ?? defaultGroupBy}
            />
          )}
          <AggregatedDataTable
            data={data?.aggregated_data ?? []}
            groupBy={filters.group_by ?? defaultGroupBy}
          />
          <ChartWidget
            data={data?.aggregated_data ?? []}
            widgets={chartWidgets}
            onWidgetsChange={setChartWidgets}
          />
        </>
      )}
    </div>
  )
}
