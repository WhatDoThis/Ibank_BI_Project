/**
 * dashboard2/components/AggregatedDataTable2.jsx (집계 데이터 테이블)
 * ===================================================================
 * 대시보드2 전용. GROUP BY 기준 집계 테이블, 페이징, 테이블 내 검색. Phase 0: dashboard AggregatedDataTable 복사, 클래스명 dashboard2-* 사용.
 *
 * [의존성]
 * - React
 */

import { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE = 50

/** Phase 3: 테이블 헤더별 지표 정의 (호버 시 툴팁) */
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

function rowMatchesFilter(row, filterText, groupBy) {
  if (!filterText?.trim()) return true
  const t = filterText.trim().toLowerCase()
  const s = (v) => (v != null ? String(v).toLowerCase() : '')
  if (groupBy.campaign && s(row.campaign_label || row.campaign_id).includes(t)) return true
  if (groupBy.date && s(row.delivery_date).includes(t)) return true
  if (groupBy.workflow && s(row.workflow_label || row.workflow_id).includes(t)) return true
  if (groupBy.channel && s(row.channel_name || row.channel_code).includes(t)) return true
  if (s(row.total_count).includes(t) || s(row.success_count).includes(t)) return true
  return false
}

export default function AggregatedDataTable2({ data = [], groupBy = {} }) {
  const [page, setPage] = useState(1)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    setPage(1)
  }, [data.length, groupBy.campaign, groupBy.date, groupBy.workflow, groupBy.channel])

  const filteredData = useMemo(
    () => data.filter((row) => rowMatchesFilter(row, filterText, groupBy)),
    [data, filterText, groupBy]
  )

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
      <div className="dashboard2-aggregated-data-table__toolbar">
        <div className="dashboard2-aggregated-data-table__search-wrap">
          <input
            type="text"
            className="dashboard2-aggregated-data-table__search-input"
            placeholder="테이블 내 검색..."
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
          />
          <span className="dashboard2-aggregated-data-table__pagination-info">
            {filteredData.length}건 중 {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, filteredData.length)} (페이지 {currentPage}/{totalPages})
          </span>
        </div>
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
              <ThWithDef defKey="open_count" align="right">오픈</ThWithDef>
              <ThWithDef defKey="click_count" align="right">클릭</ThWithDef>
              <ThWithDef defKey="success_rate" align="right">성공률</ThWithDef>
              <ThWithDef defKey="open_rate" align="right">오픈률</ThWithDef>
              <ThWithDef defKey="click_rate" align="right">클릭률</ThWithDef>
            </tr>
          </thead>
          <tbody className="dashboard2-aggregated-data-table__tbody">
            {pageData.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                  {filteredData.length === 0 ? (filterText.trim() ? '검색 결과가 없습니다.' : '조건에 맞는 데이터가 없습니다.') : '해당 페이지에 데이터가 없습니다.'}
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
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.open_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.click_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>{formatRate(row.success_rate)}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2563eb' }}>{formatRate(row.open_rate)}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#7c3aed' }}>{formatRate(row.click_rate)}%</td>
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
