/**
 * dashboard/components/DashboardHeader.jsx (대시보드 헤더)
 * ========================================================
 * 테이블 선택 + 집계 기준 + 정렬 기준 + 필터(캠페인·워크플로우·채널) 구성.
 * 집계 체크 해제 시 해당 셀렉트 음영·해당 데이터 전체 노출.
 *
 * [주요 기능]
 * - 1행: 테이블 셀렉트 + info 버튼(필수 컬럼 안내 모달) + 기간 + 조회
 * - 2행: 집계 기준 체크박스 (캠페인별·일자별·워크플로우별·채널별)
 * - 정렬 기준: 일자·발송수·성공수·오픈수·클릭수 버튼 (1회=내림 2회=오름 3회=해제), 멀티 정렬·적용 문구 표시
 * - 3행: 캠페인·워크플로우·채널 셀렉트, 집계 체크 해제 시 비활성화
 *
 * [의존성]
 * - React, @/shared/api/client (getDashboardRequiredColumns)
 */

import { useState, useEffect } from 'react'
import { getDashboardRequiredColumns } from '@/shared/api/client'
import { normalizeDateRange } from '@/shared/utils/dateRange'

const SORT_OPTIONS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'total_count', label: '발송수' },
  { key: 'success_count', label: '성공수' },
  { key: 'open_count', label: '오픈수' },
  { key: 'click_count', label: '클릭수' }
]

export default function DashboardHeader({
  tables = [],
  tableId,
  onTableChange,
  filters,
  onFiltersChange,
  onGroupByChange,
  sortOrder = [],
  onSortOrderChange,
  filterOptions = {},
  loading,
  onLoad
}) {
  const {
    date_range = ['', ''],
    campaign_ids = [],
    workflow_ids = [],
    channels = [],
    group_by = {}
  } = filters
  const { campaigns = [], workflows = [], channels: channelList = [] } = filterOptions

  const [showRequiredModal, setShowRequiredModal] = useState(false)
  const [requiredColumnsList, setRequiredColumnsList] = useState([])

  useEffect(() => {
    if (!showRequiredModal) return
    let cancelled = false
    getDashboardRequiredColumns()
      .then((res) => {
        if (!cancelled && res?.columns) setRequiredColumnsList(res.columns)
      })
      .catch(() => {
        if (!cancelled) setRequiredColumnsList([])
      })
    return () => { cancelled = true }
  }, [showRequiredModal])

  const campaignDisabled = !group_by.campaign
  const workflowDisabled = !group_by.workflow
  const channelDisabled = !group_by.channel

  const handleGroupByChange = (key, checked) => {
    onGroupByChange({ [key]: checked })
    if (!checked) {
      if (key === 'campaign') onFiltersChange({ campaign_ids: [] })
      if (key === 'workflow') onFiltersChange({ workflow_ids: [] })
      if (key === 'channel') onFiltersChange({ channels: [] })
    }
  }

  /** 정렬 버튼 클릭: 없음 → 내림차순 → 오름차순 → 제거. 먼저 누른 항목이 1순위(멀티 정렬). */
  const handleSortClick = (optionKey) => {
    const idx = sortOrder.findIndex((s) => s.key === optionKey)
    if (idx === -1) {
      onSortOrderChange([...sortOrder, { key: optionKey, order: 'desc' }])
    } else if (sortOrder[idx].order === 'desc') {
      onSortOrderChange(sortOrder.map((s, i) => (i === idx ? { ...s, order: 'asc' } : s)))
    } else {
      onSortOrderChange(sortOrder.filter((_, i) => i !== idx))
    }
  }

  const getSortState = (optionKey) => {
    const entry = sortOrder.find((s) => s.key === optionKey)
    if (!entry) return null
    return entry.order
  }

  const sortAppliedText = sortOrder.length
    ? sortOrder.map((s, i) => {
        const label = SORT_OPTIONS.find((o) => o.key === s.key)?.label ?? s.key
        const orderText = s.order === 'desc' ? '내림차순' : '오름차순'
        return `${i + 1}. ${label} - ${orderText}`
      }).join('  ')
    : ''

  return (
    <header className="dashboard-header">
      {/* 1행: 테이블 선택 + 테이블 오른쪽 info + 기간 + 조회 */}
      <div className="dashboard-header__table-row">
        <div className="dashboard-header__table-cell">
          <label className="dashboard-header__table-label">테이블</label>
          <div className="dashboard-header__table-select-wrap">
            <select
              className="dashboard-table-select"
              value={tableId}
              onChange={(e) => onTableChange(e.target.value)}
            >
              <option value="">선택</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
          </div>
          <div className="dashboard-header__info-btn-wrap">
            <button
              type="button"
              className="dashboard-info-btn"
              onClick={() => setShowRequiredModal(true)}
              title="조회를 위한 테이블 필수 컬럼 안내"
            >
              info
            </button>
          </div>
        </div>
        <div className="dashboard-header__date-cell">
          <label className="dashboard-header__date-label">기간</label>
          <div className="dashboard-header__date-inputs">
            <input
              type="date"
              className="dashboard-header__date-input"
              value={date_range[0] || ''}
              onChange={(e) => onFiltersChange({ date_range: normalizeDateRange([e.target.value, date_range[1] || '']) })}
            />
            <span className="dashboard-header__date-sep">~</span>
            <input
              type="date"
              className="dashboard-header__date-input"
              value={date_range[1] || ''}
              onChange={(e) => onFiltersChange({ date_range: normalizeDateRange([date_range[0] || '', e.target.value]) })}
            />
          </div>
        </div>
        <button
          type="button"
          className="dashboard-header__load-btn"
          onClick={onLoad}
          disabled={loading || !tableId}
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {/* 2행: 집계 기준 체크박스 */}
      <div className="dashboard-header__group-by-row">
        <span className="dashboard-header__group-by-label">집계 기준</span>
        <div className="dashboard-header__group-by-checkboxes">
          <label className="dashboard-header__checkbox-label">
            <input
              type="checkbox"
              checked={!!group_by.campaign}
              onChange={(e) => handleGroupByChange('campaign', e.target.checked)}
              className="dashboard-header__checkbox"
            />
            <span>캠페인별</span>
          </label>
          <label className="dashboard-header__checkbox-label">
            <input
              type="checkbox"
              checked={!!group_by.workflow}
              onChange={(e) => handleGroupByChange('workflow', e.target.checked)}
              className="dashboard-header__checkbox"
            />
            <span>워크플로우별</span>
          </label>
          <label className="dashboard-header__checkbox-label">
            <input
              type="checkbox"
              checked={!!group_by.channel}
              onChange={(e) => handleGroupByChange('channel', e.target.checked)}
              className="dashboard-header__checkbox"
            />
            <span>채널별</span>
          </label>
        </div>
      </div>

      {/* 정렬 기준: 일자·발송수·성공수·오픈수·클릭수 (1회=내림 2회=오름 3회=초기화), 멀티 정렬 지원 */}
      <div className="dashboard-header__sort-row">
        <span className="dashboard-header__sort-label">정렬 기준</span>
        <div className="dashboard-header__sort-buttons">
          {SORT_OPTIONS.map((opt) => {
            const state = getSortState(opt.key)
            return (
              <button
                key={opt.key}
                type="button"
                className={`dashboard-header__sort-btn ${state ? `dashboard-header__sort-btn--${state}` : ''}`}
                onClick={() => handleSortClick(opt.key)}
                title={state === 'desc' ? '다음 클릭: 오름차순' : state === 'asc' ? '다음 클릭: 정렬 해제' : '클릭: 내림차순'}
              >
                {opt.label}
                {state && <span className="dashboard-header__sort-badge">{state === 'desc' ? ' ↓' : ' ↑'}</span>}
              </button>
            )
          })}
        </div>
        {sortAppliedText && (
          <span className="dashboard-header__sort-applied">
            {sortAppliedText}
          </span>
        )}
      </div>

      {/* 3행: 캠페인·워크플로우·채널 필터 */}
      <div className="dashboard-header__filter-row filter-row-three">
        <div className="dashboard-header__filter-cell">
          <label className={`dashboard-header__filter-label ${campaignDisabled ? 'dashboard-header__filter-label--disabled' : ''}`}>
            캠페인
          </label>
          <select
            multiple
            className="filter-select-campaign dashboard-header__filter-select"
            value={(campaign_ids || []).length === 0 ? ['__all__'] : (campaign_ids || []).map(String)}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value)
              const hasAll = selected.includes('__all__')
              onFiltersChange({
                campaign_ids: hasAll && selected.length === 1 ? [] : selected.filter((v) => v !== '__all__').map(Number)
              })
            }}
            disabled={campaignDisabled}
            title={campaignDisabled ? '집계 기준에서 캠페인별을 선택하면 활성화됩니다' : ''}
          >
            <option value="__all__">전체</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="dashboard-header__filter-cell">
          <label className={`dashboard-header__filter-label ${workflowDisabled ? 'dashboard-header__filter-label--disabled' : ''}`}>
            워크플로우
          </label>
          <select
            multiple
            className="filter-select-workflow dashboard-header__filter-select"
            value={(workflow_ids || []).length === 0 ? ['__all__'] : (workflow_ids || []).map(String)}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value)
              const hasAll = selected.includes('__all__')
              onFiltersChange({
                workflow_ids: hasAll && selected.length === 1 ? [] : selected.filter((v) => v !== '__all__').map(Number)
              })
            }}
            disabled={workflowDisabled}
            title={workflowDisabled ? '집계 기준에서 워크플로우별을 선택하면 활성화됩니다' : ''}
          >
            <option value="__all__">전체</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="dashboard-header__filter-cell">
          <label className={`dashboard-header__filter-label ${channelDisabled ? 'dashboard-header__filter-label--disabled' : ''}`}>
            채널
          </label>
          <select
            multiple
            className="filter-select-channel dashboard-header__filter-select"
            value={(channels || []).length === 0 ? ['__all__'] : (channels || []).map(String)}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value)
              const hasAll = selected.includes('__all__')
              onFiltersChange({
                channels: hasAll && selected.length === 1 ? [] : selected.filter((v) => v !== '__all__').map(Number)
              })
            }}
            disabled={channelDisabled}
            title={channelDisabled ? '집계 기준에서 채널별을 선택하면 활성화됩니다' : ''}
          >
            <option value="__all__">전체</option>
            {channelList.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 필수 컬럼 안내 모달 */}
      {showRequiredModal && (
        <div
          className="dashboard-modal-overlay"
          onClick={() => setShowRequiredModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowRequiredModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-required-columns-title"
        >
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="dashboard-required-columns-title" className="dashboard-modal__title">
              대시보드 조회를 위한 테이블 필수 컬럼
            </h2>
            <div className="dashboard-modal__body">
              <p className="dashboard-modal__desc">
                이 대시보드는 정형화된 페이지이며, 아래는 <strong>실제 DB에서 데이터를 읽어올 때 필요한 컬럼명과 데이터 타입</strong>입니다.
                아래에 나열된 컬럼이 <strong>이름과 타입 모두</strong> 일치해야 대시보드 셀렉트에 노출되고 조회할 수 있습니다.
                새 집계 테이블을 설계할 때 컬럼명과 허용 타입을 맞춰 정의해 주세요.
              </p>
              <p className="dashboard-modal__column-label">DB 조회 시 필수 컬럼 (이름·타입 모두 일치 필요)</p>
              <ul className="dashboard-modal__list">
                {requiredColumnsList.length === 0 ? (
                  <li className="dashboard-modal__list-item">로딩 중...</li>
                ) : (
                  requiredColumnsList.map((col) => (
                    <li key={col.name} className="dashboard-modal__list-item">
                      <code className="dashboard-modal__column-name">{col.name}</code>
                      {col.allowed_types && col.allowed_types.length > 0 && (
                        <span className="dashboard-modal__column-type">
                          {' '}({col.allowed_types.join(' | ')})
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <button
              type="button"
              className="dashboard-modal__close"
              onClick={() => setShowRequiredModal(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
