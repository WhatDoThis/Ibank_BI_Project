/**
 * dashboard2/components/AggregatedDataTable2.jsx (집계 데이터 테이블)
 * ===================================================================
 * 대시보드2 전용. GROUP BY 기준 집계 테이블, 페이징.
 * 테이블 필터: 컬럼 선택 + 연산자(같다/같지않다/포함/보다 큼/이상/보다 작음/이하) + 값, 다중 조건(AND) + 필터 추가.
 *
 * [의존성]
 * - React
 */

import { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE = 50

const OPERATORS = [
  { key: 'eq', label: '같다 (=)' },
  { key: 'ne', label: '같지 않다 (≠)' },
  { key: 'contains', label: '포함' },
  { key: 'gt', label: '보다 큼 (>)' },
  { key: 'gte', label: '이상 (≥)' },
  { key: 'lt', label: '보다 작음 (<)' },
  { key: 'lte', label: '이하 (≤)' }
]

const SORT_OPTIONS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'total_count', label: '발송수' },
  { key: 'success_count', label: '성공수' },
  { key: 'open_count', label: '오픈수' },
  { key: 'click_count', label: '클릭수' }
]

/** 테이블 헤더별 지표 정의 (호버 시 툴팁) */
const TABLE_HEADER_DEFINITIONS = {
  campaign: '집계 기준: 캠페인(campaign_label)',
  date: '집계 기준: 일자(delivery_date)',
  workflow: '집계 기준: 워크플로우(workflow_label)',
  channel: '집계 기준: 채널(delivery_channel)',
  total_count: '발송 요청 건수 합계 (total_count)',
  success_count: '발송 성공 건수 합계 (success_count)',
  open_count: '오픈 건수 합계 (open_count)',
  click_count: '클릭 건수 합계 (click_count)',
  success_rate: '(발송 성공 / 발송 요청) × 100',
  open_rate: '(오픈 / 발송 성공) × 100',
  click_rate: '(클릭 / 발송 성공) × 100'
}

function ThWithDef({ children, defKey, align = 'left' }) {
  const definition = defKey ? TABLE_HEADER_DEFINITIONS[defKey] : null
  return (
    <th style={{ padding: '10px 12px', textAlign: align, fontWeight: 600, color: '#374151' }}>
      <span className="dashboard2-aggregated-data-table__th-inner">
        {children}
        {definition && (
          <span
            className="dashboard2-aggregated-data-table__th-def"
            title={definition}
            aria-label="지표 정의"
          >
            ?
          </span>
        )}
      </span>
    </th>
  )
}

function formatNum(num) {
  if (num == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(num)
}

function formatRate(num) {
  if (num == null || Number.isNaN(Number(num))) return '0.00'
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(num))
}

function getColumnCount(groupBy) {
  let n = 7
  if (groupBy.campaign) n += 1
  if (groupBy.date) n += 1
  if (groupBy.workflow) n += 1
  if (groupBy.channel) n += 1
  return n
}

function getColumnOptions(groupBy) {
  const list = []
  if (groupBy.campaign) list.push({ key: 'campaign_label', label: '캠페인', type: 'text' })
  if (groupBy.date) list.push({ key: 'delivery_date', label: '일자', type: 'text' })
  if (groupBy.workflow) list.push({ key: 'workflow_label', label: '워크플로우', type: 'text' })
  if (groupBy.channel) list.push({ key: 'channel_name', label: '채널', type: 'text' })
  list.push(
    { key: 'total_count', label: '발송요청', type: 'number' },
    { key: 'success_count', label: '발송성공', type: 'number' },
    { key: 'success_rate', label: '성공률', type: 'number' },
    { key: 'open_count', label: '오픈', type: 'number' },
    { key: 'click_count', label: '클릭', type: 'number' },
    { key: 'open_rate', label: '오픈률', type: 'number' },
    { key: 'click_rate', label: '클릭률', type: 'number' }
  )
  return list
}

function getCellValue(row, columnKey) {
  switch (columnKey) {
    case 'campaign_label':
      return row.campaign_label ?? row.campaign_id ?? ''
    case 'delivery_date':
      return row.delivery_date ?? ''
    case 'workflow_label':
      return row.workflow_label ?? row.workflow_id ?? ''
    case 'channel_name':
      return row.channel_name ?? row.channel_code ?? ''
    default:
      return row[columnKey]
  }
}

function matchOne(row, columnKey, operator, value, columnOptions) {
  const cell = getCellValue(row, columnKey)
  const col = columnOptions.find((c) => c.key === columnKey)
  const isNum = col?.type === 'number'
  const numCell = isNum ? Number(cell) : NaN
  const numVal = isNum ? Number(value) : NaN
  const strCell = String(cell ?? '').trim().toLowerCase()
  const strVal = String(value ?? '').trim().toLowerCase()
  if (operator === 'eq') {
    if (isNum && !Number.isNaN(numVal)) return numCell === numVal
    return strCell === strVal
  }
  if (operator === 'ne') {
    if (isNum && !Number.isNaN(numVal)) return numCell !== numVal
    return strCell !== strVal
  }
  if (operator === 'contains') return strCell.includes(strVal)
  if (operator === 'gt') {
    if (isNum && !Number.isNaN(numVal)) return numCell > numVal
    return strCell > strVal
  }
  if (operator === 'gte') {
    if (isNum && !Number.isNaN(numVal)) return numCell >= numVal
    return strCell >= strVal
  }
  if (operator === 'lt') {
    if (isNum && !Number.isNaN(numVal)) return numCell < numVal
    return strCell < strVal
  }
  if (operator === 'lte') {
    if (isNum && !Number.isNaN(numVal)) return numCell <= numVal
    return strCell <= strVal
  }
  return true
}

function isFilterConditionEmpty(f) {
  if (!f || !f.columnKey || String(f.columnKey).trim() === '') return true
  const v = f.value
  if (v == null) return true
  if (typeof v === 'string' && v.trim() === '') return true
  return false
}

function rowMatchesFilters(row, filters, columnOptions) {
  if (!filters?.length) return true
  return filters.every((f) => {
    if (isFilterConditionEmpty(f)) return true
    return matchOne(row, f.columnKey, f.operator || 'eq', f.value, columnOptions)
  })
}

const defaultFilterRow = () => ({ id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`, columnKey: '', operator: 'contains', value: '' })

export default function AggregatedDataTable2({ data = [], groupBy = {}, sortOrder = [], onSortOrderChange }) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState([])
  const columnOptions = useMemo(() => getColumnOptions(groupBy), [groupBy])

  useEffect(() => {
    setPage(1)
  }, [data.length, groupBy.campaign, groupBy.date, groupBy.workflow, groupBy.channel])

  const filteredData = useMemo(() => {
    const hasAnyActive = filters?.some((f) => !isFilterConditionEmpty(f))
    if (!hasAnyActive) return data
    return data.filter((row) => rowMatchesFilters(row, filters, columnOptions))
  }, [data, filters, columnOptions])
  const addFilter = () => {
    setFilters((prev) => [...prev, defaultFilterRow()])
    setPage(1)
  }
  const removeFilter = (id) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
    setPage(1)
  }
  const updateFilter = (id, updates) => {
    setFilters((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const next = { ...f, ...updates }
        if ('value' in updates && typeof next.value === 'string' && next.value.trim() === '') next.value = ''
        return next
      })
    )
    setPage(1)
  }
  const hasActiveFilters = filters.some((f) => !isFilterConditionEmpty(f))

  const handleSortClick = (optionKey) => {
    if (!onSortOrderChange) return
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
    return entry ? entry.order : null
  }
  const sortAppliedText = sortOrder.length
    ? sortOrder.map((s, i) => {
        const label = SORT_OPTIONS.find((o) => o.key === s.key)?.label ?? s.key
        const orderText = s.order === 'desc' ? '내림차순' : '오름차순'
        return `${i + 1}. ${label} - ${orderText}`
      }).join('  ')
    : ''

  const dateOrder = useMemo(() => {
    if (!groupBy.date) return []
    return [...new Set(data.map((r) => r.delivery_date).filter(Boolean))].sort()
  }, [data, groupBy.date])

  const getRowBg = useMemo(() => {
    if (!groupBy.date || dateOrder.length === 0) return () => undefined
    return (row) => {
      const idx = dateOrder.indexOf(row.delivery_date)
      return idx >= 0 && idx % 2 === 1 ? '#f3f4f6' : undefined
    }
  }, [groupBy.date, dateOrder])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIdx = (currentPage - 1) * PAGE_SIZE
  const pageData = filteredData.slice(startIdx, startIdx + PAGE_SIZE)
  const colCount = getColumnCount(groupBy)

  return (
    <section className="dashboard2-aggregated-data-table-section">
      {onSortOrderChange && (
        <div className="dashboard2-header__sort-row dashboard2-aggregated-data-table__sort-row">
          <span className="dashboard2-header__sort-label">정렬 기준</span>
          <div className="dashboard2-header__sort-buttons">
            {SORT_OPTIONS.map((opt) => {
              const state = getSortState(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`dashboard2-header__sort-btn ${state ? `dashboard2-header__sort-btn--${state}` : ''}`}
                  onClick={() => handleSortClick(opt.key)}
                  title={state === 'desc' ? '다음 클릭: 오름차순' : state === 'asc' ? '다음 클릭: 정렬 해제' : '클릭: 내림차순'}
                >
                  {opt.label}
                  {state && <span className="dashboard2-header__sort-badge">{state === 'desc' ? ' ↓' : ' ↑'}</span>}
                </button>
              )
            })}
          </div>
          {sortAppliedText && (
            <span className="dashboard2-header__sort-applied">{sortAppliedText}</span>
          )}
        </div>
      )}
      <div className="dashboard2-aggregated-data-table__toolbar">
        <div className="dashboard2-aggregated-data-table__filters">
          {filters.map((f) => (
            <div key={f.id} className="dashboard2-aggregated-data-table__filter-row">
              <select
                className="dashboard2-aggregated-data-table__filter-select"
                value={f.columnKey}
                onChange={(e) => updateFilter(f.id, { columnKey: e.target.value })}
                aria-label="컬럼 선택"
              >
                <option value="">컬럼 선택</option>
                {columnOptions.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <select
                className="dashboard2-aggregated-data-table__filter-select"
                value={f.operator}
                onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
                aria-label="조건"
              >
                {OPERATORS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                className="dashboard2-aggregated-data-table__filter-input"
                placeholder="값"
                value={f.value ?? ''}
                onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                aria-label="검색값"
              />
              <button
                type="button"
                className="dashboard2-aggregated-data-table__filter-remove"
                onClick={() => removeFilter(f.id)}
                title="이 조건 제거"
                aria-label="조건 제거"
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            className="dashboard2-aggregated-data-table__filter-add"
            onClick={addFilter}
          >
            + 필터 추가
          </button>
        </div>
        <span className="dashboard2-aggregated-data-table__pagination-info">
          {filteredData.length}건 중 {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, filteredData.length)} (페이지 {currentPage}/{totalPages})
          {hasActiveFilters && ' · 필터 적용 중'}
        </span>
      </div>
      <div className="dashboard2-aggregated-data-table__table-wrap">
        <table className="dashboard2-aggregated-data-table__table">
          <thead className="dashboard2-aggregated-data-table__thead">
            <tr>
              {groupBy.campaign && <ThWithDef defKey="campaign">캠페인</ThWithDef>}
              {groupBy.date && <ThWithDef defKey="date">일자</ThWithDef>}
              {groupBy.workflow && <ThWithDef defKey="workflow">워크플로우</ThWithDef>}
              {groupBy.channel && <ThWithDef defKey="channel">채널</ThWithDef>}
              <ThWithDef defKey="total_count" align="right">발송요청</ThWithDef>
              <ThWithDef defKey="success_count" align="right">발송성공</ThWithDef>
              <ThWithDef defKey="success_rate" align="right">성공률</ThWithDef>
              <ThWithDef defKey="open_count" align="right">오픈</ThWithDef>
              <ThWithDef defKey="click_count" align="right">클릭</ThWithDef>
              <ThWithDef defKey="open_rate" align="right">오픈률</ThWithDef>
              <ThWithDef defKey="click_rate" align="right">클릭률</ThWithDef>
            </tr>
          </thead>
          <tbody className="dashboard2-aggregated-data-table__tbody">
            {pageData.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                  {filteredData.length === 0 ? (hasActiveFilters ? '조건에 맞는 데이터가 없습니다.' : '데이터가 없습니다.') : '해당 페이지에 데이터가 없습니다.'}
                </td>
              </tr>
            )}
            {pageData.map((row, idx) => (
              <tr key={startIdx + idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: getRowBg(row) }}>
                {groupBy.campaign && <td style={{ padding: '10px 12px' }}>{row.campaign_label ?? row.campaign_id ?? '-'}</td>}
                {groupBy.date && <td style={{ padding: '10px 12px' }}>{row.delivery_date ?? '-'}</td>}
                {groupBy.workflow && <td style={{ padding: '10px 12px' }}>{row.workflow_label ?? row.workflow_id ?? '-'}</td>}
                {groupBy.channel && (
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', fontSize: 13 }}>
                      {row.channel_name ?? row.channel_code ?? '-'}
                    </span>
                  </td>
                )}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.total_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.success_count)}</td>
                <td className="dashboard2-aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="dashboard2-aggregated-data-table__cell-fill-wrap">
                    <div className="dashboard2-aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.success_rate) || 0)}%` }} aria-hidden />
                    <span className="dashboard2-aggregated-data-table__cell-fill-text" style={{ color: '#059669' }}>{formatRate(row.success_rate)}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.open_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.click_count)}</td>
                <td className="dashboard2-aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="dashboard2-aggregated-data-table__cell-fill-wrap">
                    <div className="dashboard2-aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.open_rate) || 0)}%` }} aria-hidden />
                    <span className="dashboard2-aggregated-data-table__cell-fill-text" style={{ color: '#2563eb' }}>{formatRate(row.open_rate)}%</span>
                  </div>
                </td>
                <td className="dashboard2-aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="dashboard2-aggregated-data-table__cell-fill-wrap">
                    <div className="dashboard2-aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.click_rate) || 0)}%` }} aria-hidden />
                    <span className="dashboard2-aggregated-data-table__cell-fill-text" style={{ color: '#7c3aed' }}>{formatRate(row.click_rate)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="dashboard2-aggregated-data-table__pagination">
          <button
            type="button"
            className="dashboard2-aggregated-data-table__pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            이전
          </button>
          <span className="dashboard2-aggregated-data-table__pagination-label">{currentPage} / {totalPages}</span>
          <button
            type="button"
            className="dashboard2-aggregated-data-table__pagination-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            다음
          </button>
        </div>
      )}
    </section>
  )
}
