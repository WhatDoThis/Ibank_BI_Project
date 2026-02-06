/**
 * dashboard2/Dashboard2Page.jsx (템플릿 ECharts 대시보드 페이지)
 * =============================================================
 * 테이블 조회·컬럼 선택 등 헤더/필터는 dashboard와 동일. 본문은 템플릿 선택 + ECharts 차트.
 *
 * [주요 기능]
 * - getDashboardTables / getDashboardFilterOptions / getDashboardData 로 동일 데이터 조회
 * - DashboardHeader 재사용, 정렬·집계 기준·필터 동일
 * - 템플릿 선택 시 ECharts API로 차트 옵션 구성 후 렌더링
 *
 * [의존성]
 * - React, shared/api/client, dashboard/components/DashboardHeader, dashboard/dashboard.css,
 *   dashboard2/components/EChartsChart (CHART_TEMPLATES)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDashboardData, getDashboardFilterOptions, getDashboardTables } from '@/shared/api/client'
import '../dashboard/dashboard.css'
import './dashboard2.css'
import DashboardHeader from '../dashboard/components/DashboardHeader'
import EChartsChart, { CHART_TEMPLATES } from './components/EChartsChart'

const defaultGroupBy = { campaign: false, date: true, workflow: false, channel: false }

function sortAggregatedData(rows, sortOrder) {
  if (!rows?.length || !sortOrder?.length) return rows || []
  return [...rows].sort((a, b) => {
    for (const { key, order } of sortOrder) {
      const va = a[key]
      const vb = b[key]
      let cmp = 0
      if (va == null && vb == null) cmp = 0
      else if (va == null) cmp = 1
      else if (vb == null) cmp = -1
      else if (key === 'delivery_date') cmp = String(va).localeCompare(String(vb))
      else cmp = Number(va) - Number(vb)
      if (cmp !== 0) return order === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

function getDefaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return [`${y}-${m}-${d}`, `${y}-${m}-${d}`]
}

export default function Dashboard2Page() {
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
  const [sortOrder, setSortOrder] = useState([{ key: 'delivery_date', order: 'desc' }])
  const [templateId, setTemplateId] = useState(CHART_TEMPLATES[0]?.id || 'bar_success')

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

  useEffect(() => {
    if (tableId) setFilters((prev) => ({ ...prev, table_id: tableId }))
  }, [tableId])

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

  const loadData = useCallback(() => {
    if (!filters.table_id || !filters.date_range?.length) return
    setLoading(true)
    setError(null)
    const payload = {
      ...filters,
      group_by: { ...(filters.group_by || defaultGroupBy), date: true }
    }
    getDashboardData(payload)
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

  const sortedAggregatedData = useMemo(
    () => sortAggregatedData(data?.aggregated_data ?? [], sortOrder),
    [data?.aggregated_data, sortOrder]
  )
  const groupBy = { ...(filters.group_by ?? defaultGroupBy), date: true }

  return (
    <div className="dashboard2-page">
      <div className="dashboard2-page__header-wrap">
        <DashboardHeader
          tables={tables}
          tableId={tableId}
          onTableChange={setTableId}
          filters={filters}
          onFiltersChange={updateFilters}
          onGroupByChange={updateGroupBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          filterOptions={filterOptions}
          loading={loading}
          onLoad={loadData}
        />
      </div>

      {error && <div className="dashboard2-page__error">{error}</div>}

      {!tableId && (
        <div className="dashboard2-page__empty">
          헤더에서 테이블을 선택한 뒤 조회하세요.
        </div>
      )}

      {tableId && (
        <div className="dashboard2-page__content">
          <div className="dashboard2-template-row">
            <label htmlFor="dashboard2-template">차트 템플릿</label>
            <select
              id="dashboard2-template"
              className="dashboard2-template-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {CHART_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="dashboard2-chart-wrap">
            <EChartsChart
              data={sortedAggregatedData}
              groupBy={groupBy}
              templateId={templateId}
            />
          </div>
        </div>
      )}
    </div>
  )
}
