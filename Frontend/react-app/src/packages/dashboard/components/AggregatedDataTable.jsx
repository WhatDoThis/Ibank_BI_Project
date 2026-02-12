/**
 * dashboard/components/AggregatedDataTable.jsx (집계 데이터 테이블)
 * ===============================================================
 * 대시보드1 집계 테이블. 페이징·검색·필터(컬럼+연산자+값 AND). 컬럼 순서 발송요청→발송성공→성공률→오픈→클릭→오픈률→클릭률. rate 셀 채우기 막대.
 *
 * [Main Functions]
 * ===========
 * - getColumnOptions, getCellValue, matchOne, rowMatchesFilters, formatNum, formatRate. 정렬·페이징·필터 추가/삭제.
 * - rate 컬럼: cell-fill-wrap·cell-fill·cell-fill-text (값 비례 막대)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - AggregatedDataTable (default export)
 *
 * [Dependencies]
 * =========
 * - React
 */

import { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE = 50

/** 연산자: 라벨(표시) + 값(저장) */
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

function formatNum(num) {
  if (num == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(num)
}

/** rate(성공률·오픈률·클릭률): 항상 소수점 둘째 자리까지 (30 → 30.00, 30.1 → 30.10) */
function formatRate(num) {
  if (num == null || Number.isNaN(Number(num))) return '0.00'
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(num))
}

function getColumnCount(groupBy) {
  let n = 7 // 발송요청·발송성공·성공률·오픈·클릭·오픈률·클릭률
  if (groupBy.campaign) n += 1
  if (groupBy.date) n += 1
  if (groupBy.workflow) n += 1
  if (groupBy.channel) n += 1
  return n
}

/** groupBy 기준 사용 가능한 컬럼 목록 (key, label, type) */
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

/** row에서 컬럼 표시값 추출 (key는 campaign_label, delivery_date, total_count 등) */
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

/** 단일 조건 일치 여부 */
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
  if (operator === 'contains') {
    return strCell.includes(strVal)
  }
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

/** 해당 필터가 “조건 없음”(컬럼 미선택 또는 값 비어 있음)이면 true — 이 조건은 적용하지 않음 */
function isFilterConditionEmpty(f) {
  if (!f || !f.columnKey || String(f.columnKey).trim() === '') return true
  const v = f.value
  if (v == null) return true
  if (typeof v === 'string' && v.trim() === '') return true
  return false
}

/** 다중 필터 조건(AND) 적용. 비어 있는 조건은 무시 → 값 지우거나 행 삭제 시 원래 데이터로 복원 */
function rowMatchesFilters(row, filters, columnOptions) {
  if (!filters?.length) return true
  return filters.every((f) => {
    if (isFilterConditionEmpty(f)) return true
    return matchOne(row, f.columnKey, f.operator || 'eq', f.value, columnOptions)
  })
}

function getCellValueMerged(row, columnKey) {
  return row[columnKey]
}
function getCellValueSummary(row, columnKey) {
  return row[columnKey]
}
function matchOneWithGetCell(row, columnKey, operator, value, columnOptions, getCell) {
  const cell = getCell(row, columnKey)
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
function rowMatchesFiltersWithGetCell(row, filters, columnOptions, getCell) {
  if (!filters?.length) return true
  return filters.every((f) => {
    if (isFilterConditionEmpty(f)) return true
    return matchOneWithGetCell(row, f.columnKey, f.operator || 'eq', f.value, columnOptions, getCell)
  })
}
function getMergedColumnOptions() {
  return [
    { key: 'dimensionLabel', label: '구분', type: 'text' },
    { key: '기준_total_count', label: '기준 발송요청', type: 'number' },
    { key: '비교_total_count', label: '비교 발송요청', type: 'number' },
    { key: '기준_success_count', label: '기준 발송성공', type: 'number' },
    { key: '비교_success_count', label: '비교 발송성공', type: 'number' },
    { key: '기준_success_rate', label: '기준 성공률', type: 'number' },
    { key: '비교_success_rate', label: '비교 성공률', type: 'number' },
    { key: '기준_open_count', label: '기준 오픈', type: 'number' },
    { key: '비교_open_count', label: '비교 오픈', type: 'number' },
    { key: '기준_click_count', label: '기준 클릭', type: 'number' },
    { key: '비교_click_count', label: '비교 클릭', type: 'number' },
    { key: '기준_open_rate', label: '기준 오픈률', type: 'number' },
    { key: '비교_open_rate', label: '비교 오픈률', type: 'number' },
    { key: '기준_click_rate', label: '기준 클릭률', type: 'number' },
    { key: '비교_click_rate', label: '비교 클릭률', type: 'number' }
  ]
}
function getSummaryColumnOptions() {
  return [
    { key: '기간', label: '기간', type: 'text' },
    { key: 'total_count', label: '발송요청', type: 'number' },
    { key: 'success_count', label: '발송성공', type: 'number' },
    { key: 'success_rate', label: '성공률', type: 'number' },
    { key: 'open_count', label: '오픈', type: 'number' },
    { key: 'click_count', label: '클릭', type: 'number' },
    { key: 'open_rate', label: '오픈률', type: 'number' },
    { key: 'click_rate', label: '클릭률', type: 'number' }
  ]
}

function CompareMergedTable({ data = [], formatNum, formatRate }) {
  if (!data.length) return null
  return (
    <div className="aggregated-data-table__table-wrap">
      <table className="aggregated-data-table__table">
        <thead className="aggregated-data-table__thead">
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>구분</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 발송요청</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 발송요청</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 발송성공</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 발송성공</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 성공률</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 성공률</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 오픈</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 오픈</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 클릭</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 클릭</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 오픈률</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 오픈률</th>
            <th className="aggregated-data-table__th--base" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>기준 클릭률</th>
            <th className="aggregated-data-table__th--compare" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>비교 클릭률</th>
          </tr>
        </thead>
        <tbody className="aggregated-data-table__tbody">
          {data.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 1 ? '#f9fafb' : undefined }}>
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{row.dimensionLabel ?? '-'}</td>
              <td className="aggregated-data-table__td--base" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.기준_total_count)}</td>
              <td className="aggregated-data-table__td--compare" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.비교_total_count)}</td>
              <td className="aggregated-data-table__td--base" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.기준_success_count)}</td>
              <td className="aggregated-data-table__td--compare" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.비교_success_count)}</td>
              <td className="aggregated-data-table__td--base aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.기준_success_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#059669' }}>{formatRate(row.기준_success_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__td--compare aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.비교_success_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#059669' }}>{formatRate(row.비교_success_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__td--base" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.기준_open_count)}</td>
              <td className="aggregated-data-table__td--compare" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.비교_open_count)}</td>
              <td className="aggregated-data-table__td--base" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.기준_click_count)}</td>
              <td className="aggregated-data-table__td--compare" style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.비교_click_count)}</td>
              <td className="aggregated-data-table__td--base aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.기준_open_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#2563eb' }}>{formatRate(row.기준_open_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__td--compare aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.비교_open_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#2563eb' }}>{formatRate(row.비교_open_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__td--base aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.기준_click_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#7c3aed' }}>{formatRate(row.기준_click_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__td--compare aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.비교_click_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#7c3aed' }}>{formatRate(row.비교_click_rate)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompareSummaryTable({ data = [], formatNum, formatRate }) {
  if (!data.length) return null
  return (
    <div className="aggregated-data-table__table-wrap">
      <table className="aggregated-data-table__table">
        <thead className="aggregated-data-table__thead">
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>기간</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>발송요청</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>발송성공</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>성공률</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈률</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭률</th>
          </tr>
        </thead>
        <tbody className="aggregated-data-table__tbody">
          {data.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 1 ? '#f9fafb' : undefined }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.기간 ?? '-'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.total_count)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.success_count)}</td>
              <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.success_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#059669' }}>{formatRate(row.success_rate)}%</span>
                </div>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.open_count)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.click_count)}</td>
              <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.open_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#2563eb' }}>{formatRate(row.open_rate)}%</span>
                </div>
              </td>
              <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 80 }}>
                <div className="aggregated-data-table__cell-fill-wrap">
                  <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.click_rate) || 0)}%` }} aria-hidden />
                  <span className="aggregated-data-table__cell-fill-text" style={{ color: '#7c3aed' }}>{formatRate(row.click_rate)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const defaultFilterRow = () => ({ id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`, columnKey: '', operator: 'contains', value: '' })

export default function AggregatedDataTable({
  data = [],
  groupBy = {},
  sortOrder = [],
  onSortOrderChange,
  compareTableMode = null,
  mergedTableData = [],
  summaryTableData = []
}) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState([])

  const columnOptions = useMemo(() => getColumnOptions(groupBy), [groupBy])
  const mergedColumnOptions = useMemo(() => getMergedColumnOptions(), [])
  const summaryColumnOptions = useMemo(() => getSummaryColumnOptions(), [])

  useEffect(() => {
    setPage(1)
  }, [data.length, groupBy.campaign, groupBy.date, groupBy.workflow, groupBy.channel])

  const filteredData = useMemo(() => {
    const hasAnyActive = filters?.some((f) => !isFilterConditionEmpty(f))
    if (!hasAnyActive) return data
    return data.filter((row) => rowMatchesFilters(row, filters, columnOptions))
  }, [data, filters, columnOptions])
  const filteredMergedData = useMemo(() => {
    const hasAny = filters?.some((f) => !isFilterConditionEmpty(f))
    if (!hasAny) return mergedTableData
    return mergedTableData.filter((row) => rowMatchesFiltersWithGetCell(row, filters, mergedColumnOptions, getCellValueMerged))
  }, [mergedTableData, filters, mergedColumnOptions])
  const filteredSummaryData = useMemo(() => {
    const hasAny = filters?.some((f) => !isFilterConditionEmpty(f))
    if (!hasAny) return summaryTableData
    return summaryTableData.filter((row) => rowMatchesFiltersWithGetCell(row, filters, summaryColumnOptions, getCellValueSummary))
  }, [summaryTableData, filters, summaryColumnOptions])

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

  /** 일자별 구분: 고유 일자 순서로 행 배경 음영(짝수 번째 일자 = 음영) */
  const dateOrder = useMemo(() => {
    if (!groupBy.date) return []
    const dates = [...new Set(data.map((r) => r.delivery_date).filter(Boolean))].sort()
    return dates
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

  const renderSortRow = () =>
    onSortOrderChange ? (
      <div className="dashboard-header__sort-row aggregated-data-table__sort-row">
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
        {sortAppliedText && <span className="dashboard-header__sort-applied">{sortAppliedText}</span>}
      </div>
    ) : null

  const renderToolbar = (options, filteredCount = null) => (
    <div className="aggregated-data-table__toolbar">
      <div className="aggregated-data-table__filters">
        {filters.map((f) => (
          <div key={f.id} className="aggregated-data-table__filter-row">
            <select className="aggregated-data-table__filter-select" value={f.columnKey} onChange={(e) => updateFilter(f.id, { columnKey: e.target.value })} aria-label="컬럼 선택">
              <option value="">컬럼 선택</option>
              {options.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <select className="aggregated-data-table__filter-select" value={f.operator} onChange={(e) => updateFilter(f.id, { operator: e.target.value })} aria-label="조건">
              {OPERATORS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <input type="text" className="aggregated-data-table__filter-input" placeholder="값" value={f.value ?? ''} onChange={(e) => updateFilter(f.id, { value: e.target.value })} aria-label="검색값" />
            <button type="button" className="aggregated-data-table__filter-remove" onClick={() => removeFilter(f.id)} title="이 조건 제거" aria-label="조건 제거">삭제</button>
          </div>
        ))}
        <button type="button" className="aggregated-data-table__filter-add" onClick={addFilter}>+ 필터 추가</button>
      </div>
      <span className="aggregated-data-table__pagination-info">
        {filteredCount != null ? `${filteredCount}건` : ''}
        {filteredCount != null && hasActiveFilters ? ' · 필터 적용 중' : hasActiveFilters ? '필터 적용 중' : ''}
      </span>
    </div>
  )

  if (compareTableMode === 'merged' && mergedTableData.length > 0) {
    return (
      <section className="aggregated-data-table aggregated-data-table-section">
        {renderSortRow()}
        {renderToolbar(mergedColumnOptions, filteredMergedData.length)}
        <CompareMergedTable data={filteredMergedData} formatNum={formatNum} formatRate={formatRate} />
      </section>
    )
  }
  if (compareTableMode === 'summary' && summaryTableData.length > 0) {
    return (
      <section className="aggregated-data-table aggregated-data-table-section">
        {renderSortRow()}
        {renderToolbar(summaryColumnOptions, filteredSummaryData.length)}
        <CompareSummaryTable data={filteredSummaryData} formatNum={formatNum} formatRate={formatRate} />
      </section>
    )
  }

  return (
    <section className="aggregated-data-table aggregated-data-table-section">
      {onSortOrderChange && (
        <div className="dashboard-header__sort-row aggregated-data-table__sort-row">
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
            <span className="dashboard-header__sort-applied">{sortAppliedText}</span>
          )}
        </div>
      )}
      <div className="aggregated-data-table__toolbar">
        <div className="aggregated-data-table__filters">
          {filters.map((f) => (
            <div key={f.id} className="aggregated-data-table__filter-row">
              <select
                className="aggregated-data-table__filter-select"
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
                className="aggregated-data-table__filter-select"
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
                className="aggregated-data-table__filter-input"
                placeholder="값"
                value={f.value ?? ''}
                onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                aria-label="검색값"
              />
              <button
                type="button"
                className="aggregated-data-table__filter-remove"
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
            className="aggregated-data-table__filter-add"
            onClick={addFilter}
          >
            + 필터 추가
          </button>
        </div>
        <span className="aggregated-data-table__pagination-info">
          {filteredData.length}건 중 {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, filteredData.length)} (페이지 {currentPage}/{totalPages})
          {hasActiveFilters && ' · 필터 적용 중'}
        </span>
      </div>
      <div className="aggregated-data-table__table-wrap">
        <table className="aggregated-data-table__table">
          <thead className="aggregated-data-table__thead">
            <tr>
              {groupBy.campaign && (
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>캠페인</th>
              )}
              {groupBy.date && (
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>일자</th>
              )}
              {groupBy.workflow && (
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>워크플로우</th>
              )}
              {groupBy.channel && (
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>채널</th>
              )}
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>발송요청</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>발송성공</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>성공률</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈률</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭률</th>
            </tr>
          </thead>
          <tbody className="aggregated-data-table__tbody">
            {pageData.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                  {filteredData.length === 0 ? (hasActiveFilters ? '조건에 맞는 데이터가 없습니다.' : '데이터가 없습니다.') : '해당 페이지에 데이터가 없습니다.'}
                </td>
              </tr>
            )}
            {pageData.map((row, idx) => (
              <tr key={startIdx + idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: getRowBg(row) }}>
                {groupBy.campaign && (
                  <td style={{ padding: '10px 12px' }}>{row.campaign_label ?? row.campaign_id ?? '-'}</td>
                )}
                {groupBy.date && (
                  <td style={{ padding: '10px 12px' }}>{row.delivery_date ?? '-'}</td>
                )}
                {groupBy.workflow && (
                  <td style={{ padding: '10px 12px' }}>{row.workflow_label ?? row.workflow_id ?? '-'}</td>
                )}
                {groupBy.channel && (
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', fontSize: 13 }}>
                      {row.channel_name ?? row.channel_code ?? '-'}
                    </span>
                  </td>
                )}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.total_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.success_count)}</td>
                <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="aggregated-data-table__cell-fill-wrap">
                    <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.success_rate) || 0)}%` }} aria-hidden />
                    <span className="aggregated-data-table__cell-fill-text" style={{ color: '#059669' }}>{formatRate(row.success_rate)}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.open_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.click_count)}</td>
                <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="aggregated-data-table__cell-fill-wrap">
                    <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.open_rate) || 0)}%` }} aria-hidden />
                    <span className="aggregated-data-table__cell-fill-text" style={{ color: '#2563eb' }}>{formatRate(row.open_rate)}%</span>
                  </div>
                </td>
                <td className="aggregated-data-table__cell-rate" style={{ padding: '10px 12px', textAlign: 'right', minWidth: 90 }}>
                  <div className="aggregated-data-table__cell-fill-wrap">
                    <div className="aggregated-data-table__cell-fill" style={{ width: `${Math.min(100, Number(row.click_rate) || 0)}%` }} aria-hidden />
                    <span className="aggregated-data-table__cell-fill-text" style={{ color: '#7c3aed' }}>{formatRate(row.click_rate)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="aggregated-data-table__pagination">
          <button
            type="button"
            className="aggregated-data-table__pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            이전
          </button>
          <span className="aggregated-data-table__pagination-label">{currentPage} / {totalPages}</span>
          <button
            type="button"
            className="aggregated-data-table__pagination-btn"
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
