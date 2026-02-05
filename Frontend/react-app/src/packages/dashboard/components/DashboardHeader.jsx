/**
 * dashboard/components/DashboardHeader.jsx (대시보드 헤더)
 * ========================================================
 * 테이블 선택 + 집계 기준(테이블/컬럼 라인 사이) + 필터(캠페인·워크플로우·채널) 구성.
 * 집계 체크 해제 시 해당 셀렉트 음영·해당 데이터 전체 노출.
 *
 * [주요 기능]
 * - 1행: 테이블 셀렉트 + 테이블 오른쪽 info 버튼(필수 컬럼 안내 모달) + 기간 + 조회
 * - 2행: 집계 기준 체크박스 (테이블 라인과 컬럼 선택 라인 사이)
 * - 3행: 캠페인·워크플로우·채널 셀렉트 (넓은 폭), 집계 체크 해제 시 비활성화
 *
 * [의존성]
 * - React, @/shared/api/client (getDashboardRequiredColumns)
 */

import { useState, useEffect } from 'react'
import { getDashboardRequiredColumns } from '@/shared/api/client'

export default function DashboardHeader({
  tables = [],
  tableId,
  onTableChange,
  filters,
  onFiltersChange,
  onGroupByChange,
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
              onChange={(e) => onFiltersChange({ date_range: [e.target.value, date_range[1] || ''] })}
            />
            <span className="dashboard-header__date-sep">~</span>
            <input
              type="date"
              className="dashboard-header__date-input"
              value={date_range[1] || ''}
              onChange={(e) => onFiltersChange({ date_range: [date_range[0] || '', e.target.value] })}
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
              checked={!!group_by.date}
              onChange={(e) => onGroupByChange({ date: e.target.checked })}
              className="dashboard-header__checkbox"
            />
            <span>일자별</span>
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

      {/* 3행: 캠페인·워크플로우·채널 필터 */}
      <div className="dashboard-header__filter-row filter-row-three">
        <div className="dashboard-header__filter-cell">
          <label className={`dashboard-header__filter-label ${campaignDisabled ? 'dashboard-header__filter-label--disabled' : ''}`}>
            캠페인
          </label>
          <select
            multiple
            className="filter-select-campaign dashboard-header__filter-select"
            value={(campaign_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                campaign_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={campaignDisabled}
            title={campaignDisabled ? '집계 기준에서 캠페인별을 선택하면 활성화됩니다' : ''}
          >
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
            value={(workflow_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                workflow_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={workflowDisabled}
            title={workflowDisabled ? '집계 기준에서 워크플로우별을 선택하면 활성화됩니다' : ''}
          >
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
            value={(channels || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                channels: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={channelDisabled}
            title={channelDisabled ? '집계 기준에서 채널별을 선택하면 활성화됩니다' : ''}
          >
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
