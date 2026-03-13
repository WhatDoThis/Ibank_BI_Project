/**
 * CampaignSegmentTable (캠페인 세그먼트 테이블)
 * =============================================
 * GET /api/new-dashboard2/campaign-segments 응답(segments) 표시. 주간/월간 시 기준일 컬럼, 다중 정렬, 페이지네이션 10건.
 *
 * [Components / Functions]
 * 1. compareBySortKeys: 다중 정렬 비교
 * 2. formatCell: 셀 포맷(날짜/비율/숫자/first)
 * 3. CampaignSegmentTable
 *
 * [Dependencies]
 * - ../utils/dateUtils (formatDateRangeLabel)
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { formatDateRangeLabel } from '../utils/dateUtils'
import SectionBlock from './SectionBlock'

const PAGE_SIZE = 10

const BASE_DATE_COLUMN = { key: 'base_date', label: '기준일', width: 100, format: 'date', align: 'center' }

const COLUMNS_BASE = [
  { key: 'campaign_id', label: '캠페인ID', width: 100, format: 'string', align: 'left' },
  { key: 'workflow_id', label: '워크플로우ID', width: 110, format: 'string', align: 'left' },
  { key: 'total_target_cnt', label: '타겟수', width: 85, format: 'number', align: 'right' },
  { key: 'send_request_cnt', label: '발송요청', width: 90, format: 'number', align: 'right' },
  { key: 'send_success_cnt', label: '발송성공', width: 90, format: 'number', align: 'right' },
  { key: 'success_rate', label: '성공률', width: 75, format: 'rate', align: 'right' },
  { key: 'order_cnt', label: '주문건수', width: 85, format: 'number', align: 'right' },
  { key: 'coupon_use_cnt', label: '쿠폰사용', width: 85, format: 'number', align: 'right' },
  { key: 'first_order_age_range', label: '주요연령대', width: 95, format: 'first', align: 'center' },
  { key: 'first_order_gender', label: '주요성별', width: 80, format: 'first', align: 'center' },
  { key: 'first_coupon_use_age_range', label: '쿠폰주요연령', width: 105, format: 'first', align: 'center' },
  { key: 'first_coupon_use_gender', label: '쿠폰주요성별', width: 95, format: 'first', align: 'center' },
]

// 1.
function compareBySortKeys(sortKeys) {
  return (a, b) => {
    for (const { key, order } of sortKeys) {
      const va = a[key]
      const vb = b[key]
      if (va == null && vb == null) continue
      if (va == null) return 1
      if (vb == null) return -1
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true })
      if (cmp !== 0) return order === 'desc' ? -cmp : cmp
    }
    return 0
  }
}

// 2.
function formatCell(value, format, row) {
  if (format === 'first') {
    if (value == null || value === '') return '—'
    return String(value)
  }
  if (format === 'date') {
    if (value == null || value === '') return '—'
    const s = String(value).slice(0, 10)
    return s || '—'
  }
  if (format === 'rate') {
    if (value != null) return `${Number(value).toFixed(2)}%`
    return '—'
  }
  if (format === 'number') {
    const n = Number(value)
    if (Number.isNaN(n)) return '—'
    return n.toLocaleString()
  }
  return value != null ? String(value) : '—'
}

// 3.
export default function CampaignSegmentTable({ segments, dateRangeActual, period }) {
  const [page, setPage] = useState(0)
  const [sortKeys, setSortKeys] = useState([{ key: 'send_success_cnt', order: 'desc' }])

  useEffect(() => {
    setPage(0)
  }, [segments])

  const rowsWithRate = useMemo(() => {
    return (segments || []).map((s) => ({
      ...s,
      success_rate:
        s.send_request_cnt > 0
          ? (s.send_success_cnt / s.send_request_cnt) * 100
          : null,
    }))
  }, [segments])

  const handleSort = useCallback((colKey, shiftKey) => {
    setPage(0)
    setSortKeys((prev) => {
      const idx = prev.findIndex((s) => s.key === colKey)
      if (shiftKey) {
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { key: colKey, order: next[idx].order === 'desc' ? 'asc' : 'desc' }
          return next
        }
        return [...prev, { key: colKey, order: 'desc' }]
      }
      if (idx >= 0 && prev[idx].order === 'desc') return [{ key: colKey, order: 'asc' }]
      return [{ key: colKey, order: 'desc' }]
    })
  }, [])

  const sorted = useMemo(() => {
    if (!sortKeys.length) return [...rowsWithRate].sort((a, b) => (b.send_success_cnt ?? 0) - (a.send_success_cnt ?? 0))
    return [...rowsWithRate].sort(compareBySortKeys(sortKeys))
  }, [rowsWithRate, sortKeys])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const dateLabel =
    (period === 'weekly' || period === 'monthly') && dateRangeActual
      ? formatDateRangeLabel(dateRangeActual, period)
      : null

  const columns = useMemo(
    () => (period !== 'daily' ? [BASE_DATE_COLUMN, ...COLUMNS_BASE] : COLUMNS_BASE),
    [period]
  )

  if (!segments?.length) {
    return (
      <div className="nd2-campaign-segment-empty">
        {dateLabel && <div className="nd2-campaign-segment__date-label">{dateLabel}</div>}
        <p>캠페인 세그먼트 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <SectionBlock
      title="캠페인 세그먼트 분석"
      subtitle={dateLabel ?? undefined}
      headerRight={<span className="nd2-badge">{segments.length}건</span>}
    >
      <div className="nd2-rank-table-wrap">
        <div className="nd2-rank-table__scroll">
          <table className="nd2-rank-table">
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col) => {
                  const sortState = sortKeys.find((s) => s.key === col.key)
                  const isSorted = !!sortState
                  const multiIndex = sortKeys.findIndex((s) => s.key === col.key) + 1
                  const thClass = [
                    'nd2-rank-table__th--sortable',
                    `nd2-rank-table__th--${col.align}`,
                    isSorted ? 'nd2-rank-table__th--sorted' : '',
                  ].join(' ')
                  return (
                    <th
                      key={col.key}
                      className={thClass}
                      onClick={(e) => handleSort(col.key, e.shiftKey)}
                      title="클릭: 정렬, Shift+클릭: 다중 정렬"
                    >
                      {col.label}
                      {isSorted && (
                        <span className="nd2-rank-table__sort-icon" aria-hidden>
                          {sortState.order === 'desc' ? ' ▼' : ' ▲'}
                          {sortKeys.length > 1 && (
                            <span className="nd2-rank-table__sort-priority">{multiIndex}</span>
                          )}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr key={`${row.campaign_id}-${row.workflow_id}-${i}`}>
                  {columns.map((col) => {
                    const cellText = formatCell(row[col.key], col.format, row)
                    return (
                      <td
                        key={col.key}
                        className={`nd2-rank-table__td--${col.align}`}
                        title={cellText != null && String(cellText).trim() !== '' && cellText !== '—' ? String(cellText) : undefined}
                      >
                        {cellText}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="nd2-rank-table__pagination">
          <button
            type="button"
            className="nd2-rank-table__page-btn"
            disabled={page <= 0}
            onClick={() => setPage(0)}
            title="처음"
          >
            ≪
          </button>
          <button
            type="button"
            className="nd2-rank-table__page-btn"
            disabled={page <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ◀
          </button>
          <span className="nd2-rank-table__page-info">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="nd2-rank-table__page-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            ▶
          </button>
          <button
            type="button"
            className="nd2-rank-table__page-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            title="마지막"
          >
            ≫
          </button>
        </div>
      </div>
    </SectionBlock>
  )
}
