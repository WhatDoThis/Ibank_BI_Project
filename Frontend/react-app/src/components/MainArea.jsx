/**
 * MainArea.jsx (메인 영역 컴포넌트)
 * ==================================
 * Phase 4: 그리드·드롭·필터/ORDER BY·실행·페이지네이션·SQL 패널.
 *
 * [주요 기능]
 * - 그리드 영역: 컬럼 드롭, 헤더 드래그 재정렬, 결과 테이블
 * - WHERE/ORDER BY 칩 UI, 필터·정렬 추가/제거
 * - 페이지네이션, SQL 패널(복사·해석)
 *
 * [의존성]
 * - React
 */

import { useState } from 'react'

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

function isDateType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2'
}
function isDateTimeType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('timestamp') || t === 'datetime' || t === 'datetime2' || t === 'datetimeoffset'
}

export default function MainArea({
  gridColumns = [],
  addedTables = [],
  filters = [],
  orderBy = [],
  resultData = [],
  currentPage = 1,
  pageSize = 100,
  totalCount = 0,
  executedSql = '',
  explanation = null,
  onAddColumn,
  onMoveColumn,
  onExecute,
  onAddFilter,
  onRemoveFilter,
  onAddOrderBy,
  onRemoveOrderBy,
  onSetPage,
  onSetPageSize,
  onCopySql,
  onExplainSql,
  onCloseExplanation
}) {
  const [dropOverlayActive, setDropOverlayActive] = useState(false)
  const [draggedColumnIndex, setDraggedColumnIndex] = useState(null)
  const [addFilterColumnIndex, setAddFilterColumnIndex] = useState(null)
  const [addFilterOp, setAddFilterOp] = useState('=')
  const [addFilterVal, setAddFilterVal] = useState('')
  const [addOrderByColumnIndex, setAddOrderByColumnIndex] = useState(null)
  const [addOrderByDir, setAddOrderByDir] = useState('ASC')

  function handleDragOver(e) {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropOverlayActive(true)
    }
  }
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropOverlayActive(false)
  }
  function handleDrop(e) {
    setDropOverlayActive(false)
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const columnInfo = JSON.parse(raw)
      if (columnInfo.table && columnInfo.column && onAddColumn) onAddColumn(columnInfo)
    } catch (_) {}
  }

  function applyFilter() {
    if (addFilterColumnIndex == null || !gridColumns[addFilterColumnIndex]) return
    const val = (addFilterVal || '').trim()
    if (!val) return
    const c = gridColumns[addFilterColumnIndex]
    onAddFilter?.({ table: c.table, column: c.column, operator: addFilterOp, value: val })
    setAddFilterColumnIndex(null)
    setAddFilterVal('')
  }
  function applyOrderBy() {
    if (addOrderByColumnIndex == null || !gridColumns[addOrderByColumnIndex]) return
    onAddOrderBy?.({ columnIndex: addOrderByColumnIndex, dir: addOrderByDir })
    setAddOrderByColumnIndex(null)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalCount)
  const usedOrderByIndexes = new Set(orderBy.map((ob) => ob.columnIndex))
  const availableOrderByColumns = gridColumns.map((c, i) => ({ c, i })).filter(({ i }) => !usedOrderByIndexes.has(i))

  return (
    <div className="main-area">
      <div className="grid-area">
        {gridColumns.length > 0 && (
          <div className="filter-order-bar">
            <div className="where-row">
              <span className="bar-label">WHERE</span>
              <div className="filter-chips">
                {filters.map((f, i) => {
                  const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
                  if (!c) return null
                  return (
                    <span key={i} className="filter-chip">
                      {f.column} {f.operator} {f.value}{' '}
                      <span className="chip-remove" onClick={() => onRemoveFilter?.(i)} role="button" tabIndex={0}>×</span>
                    </span>
                  )
                })}
                {addFilterColumnIndex == null ? (
                  <button type="button" className="btn-small secondary" onClick={() => setAddFilterColumnIndex(0)}>+ 필터 추가</button>
                ) : (
                  <span className="filter-chip" style={{ flexWrap: 'nowrap' }}>
                    <select value={addFilterColumnIndex} onChange={(e) => setAddFilterColumnIndex(Number(e.target.value))}>
                      {gridColumns.map((c, i) => (
                        <option key={i} value={i}>{c.column}</option>
                      ))}
                    </select>
                    <select value={addFilterOp} onChange={(e) => setAddFilterOp(e.target.value)}>
                      <option value="=">= (같음)</option>
                      <option value="!=">!= (다름)</option>
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value=">=">≥</option>
                      <option value="<=">≤</option>
                      <option value="LIKE">포함</option>
                    </select>
                    <input
                      type={isDateTimeType(gridColumns[addFilterColumnIndex]?.type) ? 'datetime-local' : isDateType(gridColumns[addFilterColumnIndex]?.type) ? 'date' : 'text'}
                      placeholder="값"
                      value={addFilterVal}
                      onChange={(e) => setAddFilterVal(e.target.value)}
                      style={{ width: '120px', padding: '4px' }}
                    />
                    <button type="button" className="btn-small primary" onClick={applyFilter}>적용</button>
                    <span className="chip-remove" onClick={() => setAddFilterColumnIndex(null)} role="button">×</span>
                  </span>
                )}
              </div>
            </div>
            <div className="order-row">
              <span className="bar-label">ORDER BY</span>
              <div className="filter-chips">
                {orderBy.map((ob, i) => {
                  const c = gridColumns[ob.columnIndex]
                  if (!c) return null
                  return (
                    <span key={i} className="filter-chip">
                      {c.column} {ob.dir === 'DESC' ? '내림차순' : '오름차순'}{' '}
                      <span className="chip-remove" onClick={() => onRemoveOrderBy?.(i)} role="button" tabIndex={0}>×</span>
                    </span>
                  )
                })}
                {addOrderByColumnIndex == null ? (
                  <button type="button" className="btn-small secondary" disabled={availableOrderByColumns.length === 0} onClick={() => availableOrderByColumns.length > 0 && setAddOrderByColumnIndex(availableOrderByColumns[0].i)}>+ ORDER BY 추가</button>
                ) : (
                  <span className="filter-chip" style={{ flexWrap: 'nowrap' }}>
                    <select value={addOrderByColumnIndex} onChange={(e) => setAddOrderByColumnIndex(Number(e.target.value))}>
                      {availableOrderByColumns.map(({ c, i }) => (
                        <option key={i} value={i}>{c.column}</option>
                      ))}
                    </select>
                    <select value={addOrderByDir} onChange={(e) => setAddOrderByDir(e.target.value)}>
                      <option value="ASC">오름차순</option>
                      <option value="DESC">내림차순</option>
                    </select>
                    <button type="button" className="btn-small primary" onClick={applyOrderBy}>적용</button>
                    <span className="chip-remove" onClick={() => setAddOrderByColumnIndex(null)} role="button">×</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className={`grid-container ${gridColumns.length === 0 ? 'empty' : ''}`}
          style={{ position: 'relative' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`drop-overlay ${dropOverlayActive ? 'active' : ''}`}>
            <div className="drop-message">👇 컬럼을 여기에 드롭하세요</div>
          </div>

          {gridColumns.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-title">왼쪽에서 컬럼을 드래그하세요</div>
              <div className="empty-desc">테이블을 선택하고 원하는 컬럼을 드래그하여<br />데이터를 조회할 수 있습니다</div>
            </div>
          )}

          {gridColumns.length > 0 && (
            <table className="data-grid">
              <thead>
                <tr>
                  {gridColumns.map((c, i) => (
                    <th
                      key={i}
                      draggable
                      data-column-index={i}
                      className={draggedColumnIndex === i ? 'dragging' : ''}
                      onDragStart={() => setDraggedColumnIndex(i)}
                      onDragEnd={() => setDraggedColumnIndex(null)}
                      onDragOver={(e) => {
                        if (draggedColumnIndex == null) return
                        e.preventDefault()
                        const idx = Number(e.currentTarget.dataset.columnIndex)
                        if (idx !== draggedColumnIndex) {
                          e.currentTarget.classList.add(e.nativeEvent.offsetX < e.currentTarget.offsetWidth / 2 ? 'drag-over-left' : 'drag-over-right')
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('drag-over-left', 'drag-over-right')
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const th = e.currentTarget
                        th.classList.remove('drag-over-left', 'drag-over-right')
                        if (draggedColumnIndex == null) return
                        const toIndex = Number(th.dataset.columnIndex)
                        if (toIndex !== draggedColumnIndex) {
                          const insertBefore = e.nativeEvent.offsetX < th.offsetWidth / 2
                          onMoveColumn?.(draggedColumnIndex, toIndex, insertBefore)
                        }
                        setDraggedColumnIndex(null)
                      }}
                    >
                      <div className="header-content">
                        <span className="column-name">{c.column}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultData.length > 0 ? (
                  resultData.map((row, ri) => (
                    <tr key={ri}>
                      {gridColumns.map((c) => {
                        const key = `${c.alias}.${c.column}`
                        const val = row[key] ?? row[c.column] ?? 'NULL'
                        return <td key={key}>{String(val)}</td>
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={gridColumns.length} style={{ textAlign: 'center', padding: '40px' }}>
                      실행 버튼을 눌러 조회하세요
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {gridColumns.length > 0 && totalCount > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              <span>{start}-{end}건</span>
              <span style={{ color: 'var(--text-light)' }}> / 총 </span>
              <span>{totalCount}건</span>
            </div>
            <div className="pagination-controls">
              <button type="button" className="btn-small secondary" disabled={currentPage === 1} onClick={() => onSetPage?.(1)}>⏮️ 처음</button>
              <button type="button" className="btn-small secondary" disabled={currentPage === 1} onClick={() => onSetPage?.(currentPage - 1)}>◀ 이전</button>
              <span className="page-indicator">페이지 <span>{currentPage}</span> / <span>{totalPages}</span></span>
              <button type="button" className="btn-small secondary" disabled={currentPage >= totalPages} onClick={() => onSetPage?.(currentPage + 1)}>다음 ▶</button>
              <button type="button" className="btn-small secondary" disabled={currentPage >= totalPages} onClick={() => onSetPage?.(totalPages)}>마지막 ⏭️</button>
            </div>
            <div className="page-size-selector">
              <select value={pageSize} onChange={(e) => onSetPageSize?.(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}건</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="sql-panel">
        <div className="sql-header">
          <span>📄 실행된 SQL</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-small" onClick={onExplainSql}>🤖 해석</button>
            <button type="button" className="btn-small" onClick={onCopySql}>📋 복사</button>
          </div>
        </div>
        <textarea readOnly value={executedSql} placeholder="SQL 쿼리가 여기에 표시됩니다" style={{ flex: 1, minHeight: 80, padding: 10, border: 'none', resize: 'none', fontFamily: 'monospace', fontSize: 11, background: '#f9f9f9' }} />
        {explanation != null && (
          <div className="explanation-area">
            <div className="explanation-header">
              <span>💬 Claude 해석</span>
              <span className="explanation-close" onClick={onCloseExplanation} role="button" tabIndex={0}>×</span>
            </div>
            <div className={`explanation-content ${explanation === 'loading' ? 'loading' : ''}`}>
              {explanation === 'loading' ? '🤖 Claude가 쿼리를 해석하는 중...' : explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
