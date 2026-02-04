/**
 * dashboard/components/AggregatedDataTable.jsx (집계 데이터 테이블)
 * ===============================================================
 * GROUP BY 기준에 따른 집계 행 테이블. 50건 단위 페이징, 테이블 내 검색 필터(다른 집계에는 미적용).
 *
 * [의존성]
 * - React
 */

import { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE = 50

function formatNum(num) {
  if (num == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(num)
}

function getColumnCount(groupBy) {
  let n = 7 // 발송요청·발송성공·오픈·클릭·성공률·오픈률·클릭률
  if (groupBy.campaign) n += 1
  if (groupBy.date) n += 1
  if (groupBy.workflow) n += 1
  if (groupBy.channel) n += 1
  return n
}

function rowMatchesFilter(row, filterText, groupBy) {
  if (!filterText || !filterText.trim()) return true
  const t = filterText.trim().toLowerCase()
  const s = (v) => (v != null ? String(v).toLowerCase() : '')
  if (groupBy.campaign && s(row.campaign_label || row.campaign_id).includes(t)) return true
  if (groupBy.date && s(row.delivery_date).includes(t)) return true
  if (groupBy.workflow && s(row.workflow_label || row.workflow_id).includes(t)) return true
  if (groupBy.channel && s(row.channel_name || row.channel_code).includes(t)) return true
  if (s(row.total_count).includes(t) || s(row.success_count).includes(t)) return true
  return false
}

export default function AggregatedDataTable({ data = [], groupBy = {} }) {
  const [page, setPage] = useState(1)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    setPage(1)
  }, [data.length, groupBy.campaign, groupBy.date, groupBy.workflow, groupBy.channel])

  const filteredData = useMemo(() => {
    return data.filter((row) => rowMatchesFilter(row, filterText, groupBy))
  }, [data, filterText, groupBy])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIdx = (currentPage - 1) * PAGE_SIZE
  const pageData = filteredData.slice(startIdx, startIdx + PAGE_SIZE)

  const colCount = getColumnCount(groupBy)

  return (
    <section
      className="aggregated-data-table"
      style={{
        background: '#fff',
        padding: 20,
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: '#374151', margin: 0 }}>집계 데이터 테이블</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="테이블 내 검색..."
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 160 }}
          />
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            {filteredData.length}건 중 {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, filteredData.length)} (페이지 {currentPage}/{totalPages})
          </span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
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
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>성공률</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>오픈률</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>클릭률</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                  {filteredData.length === 0 ? (filterText.trim() ? '검색 결과가 없습니다.' : '조건에 맞는 데이터가 없습니다.') : '해당 페이지에 데이터가 없습니다.'}
                </td>
              </tr>
            )}
            {pageData.map((row, idx) => (
              <tr key={startIdx + idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.open_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNum(row.click_count)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>{row.success_rate}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2563eb' }}>{row.open_rate}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#7c3aed' }}>{row.click_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1 }}
          >
            이전
          </button>
          <span style={{ fontSize: 14, color: '#374151' }}>{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1 }}
          >
            다음
          </button>
        </div>
      )}
    </section>
  )
}
