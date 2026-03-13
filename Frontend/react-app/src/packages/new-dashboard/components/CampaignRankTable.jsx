/**
 * CampaignRankTable (캠페인 발송 순위 테이블)
 * ==========================================
 * 탭(전체/캠페인별/워크플로우별), 모든 탭 정렬 가능, 고정 컬럼 폭, 페이지네이션 10건.
 *
 * [Main Functions]
 * 1. round2
 * 2. aggregateBy
 * 3. compareBySortKeys
 * 4. formatCell
 * 5. CampaignRankTable (default export)
 */
import { useState, useMemo, useCallback } from 'react'

const CHANNEL_MAP = { 0: 'Email', 1: 'SMS', 41: 'iOS', 42: 'Android', 121: 'Kakao' }
const PAGE_SIZE = 10

const COLUMNS = [
  { key: 'total_count', label: '발송요청', width: 90, format: 'number' },
  { key: 'success_count', label: '발송성공', width: 90, format: 'number' },
  { key: 'success_rate', label: '성공률', width: 75, format: 'rate' },
  { key: 'open_count', label: '오픈', width: 80, format: 'number' },
  { key: 'open_rate', label: '오픈률', width: 75, format: 'rate' },
  { key: 'click_count', label: '클릭', width: 80, format: 'number' },
  { key: 'click_rate', label: '클릭률', width: 75, format: 'rate' },
]

const VIEW_TABS = [
  { key: 'all', label: '전체' },
  { key: 'campaign', label: '캠페인별' },
  { key: 'workflow', label: '워크플로우별' },
]

// 1.
function round2(n, d) {
  const f = 10 ** d
  return Math.round(n * f) / f
}

// 2.
/** campaign 또는 workflow 기준 집계 (groupKey로 분기) */
function aggregateBy(data, groupKey) {
  const idKey = `${groupKey}_id`
  const labelKey = `${groupKey}_label`
  const map = {}
  for (const row of data || []) {
    const key = row[idKey] ?? row[labelKey] ?? 'unknown'
    if (!map[key]) {
      map[key] = {
        [idKey]: row[idKey],
        [labelKey]: row[labelKey],
        channel_code: null,
        channel_name: null,
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        open_count: 0,
        click_count: 0,
      }
    }
    const g = map[key]
    g.total_count += row.total_count ?? 0
    g.success_count += row.success_count ?? 0
    g.failed_count += row.failed_count ?? 0
    g.open_count += row.open_count ?? 0
    g.click_count += row.click_count ?? 0
  }
  return Object.values(map).map((g) => ({
    ...g,
    success_rate: g.total_count ? round2((g.success_count / g.total_count) * 100, 2) : 0,
    open_rate: g.success_count ? round2((g.open_count / g.success_count) * 100, 2) : 0,
    click_rate: g.open_count ? round2((g.click_count / g.open_count) * 100, 2) : 0,
  }))
}

// 3.
function compareBySortKeys(sortKeys) {
  return (a, b) => {
    for (const { key, order } of sortKeys) {
      const va = a[key], vb = b[key]
      const cmp = (typeof va === 'number' && typeof vb === 'number')
        ? (va ?? 0) - (vb ?? 0)
        : String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true })
      if (cmp !== 0) return order === 'desc' ? -cmp : cmp
    }
    return 0
  }
}

// 4.
function formatCell(value, format) {
  if (format === 'rate') return `${(value ?? 0).toFixed(2)}%`
  return (value ?? 0).toLocaleString()
}

// 5.
export default function CampaignRankTable({ data }) {
  const [page, setPage] = useState(0)
  const [view, setView] = useState('all')
  const [sortKeys, setSortKeys] = useState([{ key: 'success_count', order: 'desc' }])

  const handleViewChange = useCallback((key) => {
    setView(key)
    setPage(0)
    setSortKeys([{ key: 'success_count', order: 'desc' }])
  }, [])

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
    let list = data ?? []
    if (view === 'campaign') list = aggregateBy(list, 'campaign')
    else if (view === 'workflow') list = aggregateBy(list, 'workflow')
    return sortKeys.length
      ? [...list].sort(compareBySortKeys(sortKeys))
      : [...list].sort((a, b) => (b.success_count ?? 0) - (a.success_count ?? 0))
  }, [data, view, sortKeys])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (!sorted.length) return <div className="nd-empty">캠페인 데이터가 없습니다.</div>

  const nameLabel = view === 'workflow' ? '워크플로우명' : '캠페인명'
  const nameKey = view === 'workflow' ? 'workflow_label' : 'campaign_label'
  const nameIdKey = view === 'workflow' ? 'workflow_id' : 'campaign_id'
  const showChannel = view === 'all'

  return (
    <div className="nd-rank-table-wrap">
      <div className="nd-rank-table__tabs">
        {VIEW_TABS.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            className={`nd-rank-table__tab ${view === key ? 'nd-rank-table__tab--active' : ''}`}
            onClick={() => handleViewChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="nd-rank-table__scroll">
        <table className="nd-rank-table">
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: showChannel ? 200 : 260 }} />
            {showChannel && <col style={{ width: 72 }} />}
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="nd-rank-table__th--center">순위</th>
              <th className="nd-rank-table__th--left">{nameLabel}</th>
              {showChannel && <th className="nd-rank-table__th--left">채널</th>}
              {COLUMNS.map((col) => {
                const sortState = sortKeys.find((s) => s.key === col.key)
                const isSorted = !!sortState
                const multiIndex = sortKeys.findIndex((s) => s.key === col.key) + 1
                return (
                  <th
                    key={col.key}
                    className={[
                      'nd-rank-table__th--sortable',
                      'nd-rank-table__th--right',
                      isSorted ? 'nd-rank-table__th--sorted' : '',
                    ].join(' ')}
                    onClick={(e) => handleSort(col.key, e.shiftKey)}
                    title="클릭: 정렬, Shift+클릭: 다중 정렬"
                  >
                    {col.label}
                    {isSorted && (
                      <span className="nd-rank-table__sort-icon" aria-hidden>
                        {sortState.order === 'desc' ? ' ▼' : ' ▲'}
                        {sortKeys.length > 1 && (
                          <span className="nd-rank-table__sort-priority">{multiIndex}</span>
                        )}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => {
              const name = row[nameKey] ?? row[nameIdKey] ?? '-'
              return (
                <tr key={`${row.campaign_id}-${row.workflow_id}-${row.channel_code}-${i}`}>
                  <td className="nd-rank-table__td--center">{page * PAGE_SIZE + i + 1}</td>
                  <td className="nd-rank-table__td--name" title={name}>{name}</td>
                  {showChannel && (
                    <td>{row.channel_name ?? CHANNEL_MAP[row.channel_code] ?? '-'}</td>
                  )}
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="nd-rank-table__td--right">
                      {formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="nd-rank-table__pagination">
        <button type="button" className="nd-rank-table__page-btn" disabled={page <= 0} onClick={() => setPage(0)} title="처음">≪</button>
        <button type="button" className="nd-rank-table__page-btn" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>◀</button>
        <span className="nd-rank-table__page-info">{page + 1} / {totalPages}</span>
        <button type="button" className="nd-rank-table__page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>▶</button>
        <button type="button" className="nd-rank-table__page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} title="마지막">≫</button>
      </div>
    </div>
  )
}
