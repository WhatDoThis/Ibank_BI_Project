/**
 * report/components/MainArea.jsx (리포트 페이지 메인 영역)
 * =======================================================
 * 그리드·드롭·기준축/피벗/행별집계/HAVING/조건/정렬·페이지네이션·SQL 패널.
 *
 * [의존성]
 * - React, report/utils/constants, report/utils/helpers
 */

import { useState } from 'react'
import { AGG_FUNCTIONS, OPERATOR_LABELS } from '../utils/constants'
import { isDateColumn, isDateType, isDateTimeType } from '../utils/helpers'

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

function isGroupByColumn(groupBy, table, column) {
  return groupBy.some((g) => g.table === table && g.column === column)
}

export default function MainArea({
  gridColumns = [],
  addedTables = [],
  groupBy = [],
  pivot = null,
  pivotRowAggs = [],
  dateGranularity = {},
  havings = [],
  filters = [],
  orderBy = [],
  resultData = [],
  currentPage = 1,
  pageSize = 100,
  totalCount = 0,
  executedSql = '',
  explanation = null,
  onAddColumn,
  onRemoveColumn,
  onMoveColumn,
  onExecute,
  onToggleGroupBy,
  onSetDateGranularity,
  onChangeAggFunc,
  onAddHaving,
  onRemoveHaving,
  onFetchAndSetPivot,
  onRemovePivot,
  onAddPivotAgg,
  onRemovePivotAgg,
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
  const [addPivotMenuOpen, setAddPivotMenuOpen] = useState(false)
  const [addPivotAggMenuOpen, setAddPivotAggMenuOpen] = useState(false)
  const [addHavingMenuOpen, setAddHavingMenuOpen] = useState(false)
  const [addHavingPopup, setAddHavingPopup] = useState(null)

  const isGroupByActive = groupBy && groupBy.length > 0
  const hasPivot = pivot && pivot.values && pivot.values.length > 0
  const havingCandidates = gridColumns.filter((c) => !isGroupByColumn(groupBy, c.table, c.column) && c.aggFunc)
  const pivotAvailableCols = gridColumns.filter((c) => !isGroupByColumn(groupBy, c.table, c.column))
  const pivotAggAvailableCols = pivotAvailableCols.filter(
    (c) => !(pivot && c.table === pivot.table && c.column === pivot.column)
  ).filter((c) => ['int', 'bigint', 'numeric', 'decimal', 'float', 'double'].some((t) => (c.type || '').toLowerCase().includes(t)))

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

  function orderByLabel(ob) {
    const c = gridColumns[ob.columnIndex]
    if (!c) return ''
    if (isGroupByActive && !isGroupByColumn(groupBy, c.table, c.column) && c.aggFunc) {
      const aggLabel = AGG_FUNCTIONS.find((a) => a.value === c.aggFunc)?.label || c.aggFunc
      return `${aggLabel}(${c.column})`
    }
    return c.column
  }

  return (
    <div className="main-area">
      <div className="grid-area">
        {gridColumns.length > 0 && (
          <div className="filter-order-bar">
            {isGroupByActive && (
              <>
                <div className="groupby-row">
                  <span className="bar-label">기준축</span>
                  <div className="filter-chips">
                    {groupBy.map((g) => (
                      <span key={`${g.table}.${g.column}`} className="filter-chip gb-chip">
                        {g.column}{' '}
                        <span className="chip-remove" onClick={() => onToggleGroupBy?.(g.table, g.column)} role="button" tabIndex={0}>×</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pivot-row">
                  <span className="bar-label">피벗축</span>
                  <div className="filter-chips">
                    {pivot ? (
                      <span className="filter-chip pivot-chip">
                        {pivot.column}{' '}
                        {pivot.values.map((v) => (
                          <span key={v} className="pivot-value-badge">{v}</span>
                        ))}{' '}
                        <span className="chip-remove" onClick={onRemovePivot} role="button" tabIndex={0}>×</span>
                      </span>
                    ) : null}
                    {!pivot && (
                      <>
                        <button type="button" className="btn-small secondary" onClick={() => setAddPivotMenuOpen(!addPivotMenuOpen)}>+ 피벗 추가</button>
                        {addPivotMenuOpen && (
                          <div className="add-filter-menu" style={{ position: 'absolute', marginTop: 4 }}>
                            {pivotAvailableCols.length === 0 ? (
                              <div className="add-filter-menu-empty">피벗 가능한 컬럼이 없습니다</div>
                            ) : (
                              pivotAvailableCols.map((col) => (
                                <button
                                  key={`${col.table}.${col.column}`}
                                  type="button"
                                  onClick={() => {
                                    onFetchAndSetPivot?.(col.table, col.column)
                                    setAddPivotMenuOpen(false)
                                  }}
                                >
                                  {col.column}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {hasPivot && (
                  <div className="pivot-agg-row">
                    <span className="bar-label">행별집계</span>
                    <div className="filter-chips">
                      {pivotRowAggs.map((agg, i) => {
                        const aggLabel = AGG_FUNCTIONS.find((a) => a.value === agg.aggFunc)?.label || agg.aggFunc
                        return (
                          <span key={i} className="filter-chip pivot-agg-chip">
                            {aggLabel}({agg.column}) <span className="chip-remove" onClick={() => onRemovePivotAgg?.(i)} role="button" tabIndex={0}>×</span>
                          </span>
                        )
                      })}
                      <button type="button" className="btn-small secondary" onClick={() => setAddPivotAggMenuOpen(!addPivotAggMenuOpen)}>+ 집계 추가</button>
                      {addPivotAggMenuOpen && (
                        <div className="add-filter-menu" style={{ position: 'absolute', marginTop: 4 }}>
                          {pivotAggAvailableCols.length === 0 ? (
                            <div className="add-filter-menu-empty">집계 가능한 숫자형 컬럼이 없습니다</div>
                          ) : (
                            pivotAggAvailableCols.flatMap((col) =>
                              AGG_FUNCTIONS.map((agg) => (
                                <button
                                  key={`${col.table}.${col.column}.${agg.value}`}
                                  type="button"
                                  onClick={() => {
                                    onAddPivotAgg?.({ table: col.table, column: col.column, aggFunc: agg.value })
                                    setAddPivotAggMenuOpen(false)
                                  }}
                                >
                                  {agg.label}({col.column})
                                </button>
                              ))
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="having-row">
                  <span className="bar-label">HAVING</span>
                  <div className="filter-chips">
                    {havings.map((h, i) => {
                      const aggLabel = AGG_FUNCTIONS.find((a) => a.value === h.aggFunc)?.label || h.aggFunc
                      const opLabel = OPERATOR_LABELS[h.operator] || h.operator
                      return (
                        <span key={i} className="filter-chip having-chip">
                          {aggLabel}({h.column}) <span className="chip-op">{opLabel}</span> {h.value}{' '}
                          <span className="chip-remove" onClick={() => onRemoveHaving?.(i)} role="button" tabIndex={0}>×</span>
                        </span>
                      )
                    })}
                    <button type="button" className="btn-small secondary" onClick={() => setAddHavingMenuOpen(!addHavingMenuOpen)}>+ HAVING 추가</button>
                    {addHavingMenuOpen && (
                      <div className="add-filter-menu" style={{ position: 'absolute', marginTop: 4 }}>
                        {havingCandidates.length === 0 ? (
                          <div className="add-filter-menu-empty">집계 컬럼이 없습니다</div>
                        ) : (
                          havingCandidates.map((c) => {
                            const aggLabel = AGG_FUNCTIONS.find((a) => a.value === c.aggFunc)?.label || c.aggFunc
                            return (
                              <button
                                key={`${c.table}.${c.column}`}
                                type="button"
                                onClick={() => {
                                  setAddHavingMenuOpen(false)
                                  setAddHavingPopup({ table: c.table, column: c.column, aggFunc: c.aggFunc })
                                }}
                              >
                                {aggLabel}({c.column})
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="where-row">
              <span className="bar-label">조건</span>
              <div className="filter-chips">
                {filters.map((f, i) => {
                  const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
                  if (!c) return null
                  const opLabel = OPERATOR_LABELS[f.operator] || f.operator
                  return (
                    <span key={i} className="filter-chip">
                      {f.column} <span className="chip-op">{opLabel}</span> {f.value}{' '}
                      <span className="chip-remove" onClick={() => onRemoveFilter?.(i)} role="button" tabIndex={0}>×</span>
                    </span>
                  )
                })}
                {addFilterColumnIndex == null ? (
                  <button type="button" className="btn-small secondary" onClick={() => setAddFilterColumnIndex(gridColumns.length ? 0 : null)}>+ 조건 추가</button>
                ) : (
                  <span className="filter-chip" style={{ flexWrap: 'nowrap' }}>
                    <select value={addFilterColumnIndex} onChange={(e) => setAddFilterColumnIndex(Number(e.target.value))}>
                      {gridColumns.map((c, i) => (
                        <option key={i} value={i}>{c.column}</option>
                      ))}
                    </select>
                    <select value={addFilterOp} onChange={(e) => setAddFilterOp(e.target.value)}>
                      {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
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
              <span className="bar-label">정렬</span>
              <div className="filter-chips">
                {orderBy.map((ob, i) => {
                  const c = gridColumns[ob.columnIndex]
                  if (!c) return null
                  return (
                    <span key={i} className="filter-chip">
                      {orderByLabel(ob)} {ob.dir === 'DESC' ? '내림차순' : '오름차순'}{' '}
                      <span className="chip-remove" onClick={() => onRemoveOrderBy?.(i)} role="button" tabIndex={0}>×</span>
                    </span>
                  )
                })}
                {addOrderByColumnIndex == null ? (
                  <button type="button" className="btn-small secondary" disabled={availableOrderByColumns.length === 0} onClick={() => availableOrderByColumns.length > 0 && setAddOrderByColumnIndex(availableOrderByColumns[0].i)}>+ 정렬 추가</button>
                ) : (
                  <span className="filter-chip" style={{ flexWrap: 'nowrap' }}>
                    <select value={addOrderByColumnIndex} onChange={(e) => setAddOrderByColumnIndex(Number(e.target.value))}>
                      {availableOrderByColumns.map(({ c, i }) => (
                        <option key={i} value={i}>{orderByLabel({ columnIndex: i })}</option>
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

        {addHavingPopup && (
          <div className="filter-popup" style={{ position: 'fixed', left: 20, top: 80, zIndex: 1000 }}>
            <div className="filter-header">
              <span>📊 HAVING 조건 추가</span>
              <span className="filter-close" onClick={() => setAddHavingPopup(null)} role="button">×</span>
            </div>
            <div className="filter-body">
              <div className="filter-sentence">
                <span className="filter-col-name">
                  {AGG_FUNCTIONS.find((a) => a.value === addHavingPopup.aggFunc)?.label}({addHavingPopup.column}) 는
                </span>
                <select
                  id="havingOp"
                  onChange={(e) => setAddHavingPopup((p) => ({ ...p, operator: e.target.value }))}
                  value={addHavingPopup.operator || '>'}
                >
                  {Object.entries(OPERATOR_LABELS)
                    .filter(([v]) => v !== 'LIKE')
                    .map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                </select>
              </div>
              <input
                type="number"
                id="havingVal"
                placeholder="값 입력"
                value={addHavingPopup.value || ''}
                onChange={(e) => setAddHavingPopup((p) => ({ ...p, value: e.target.value }))}
              />
            </div>
            <div className="filter-actions">
              <button type="button" className="btn-small secondary" onClick={() => setAddHavingPopup(null)}>취소</button>
              <button
                type="button"
                className="btn-small primary"
                onClick={() => {
                  const val = (addHavingPopup.value || '').trim()
                  if (val) {
                    onAddHaving?.({ table: addHavingPopup.table, column: addHavingPopup.column, aggFunc: addHavingPopup.aggFunc, operator: addHavingPopup.operator || '>', value: val })
                    setAddHavingPopup(null)
                  }
                }}
              >
                적용
              </button>
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

          {gridColumns.length > 0 && !hasPivot && (
            <table className="data-grid">
              <thead>
                <tr>
                  {gridColumns.map((c, i) => {
                    const isGB = isGroupByColumn(groupBy, c.table, c.column)
                    const isDate = isDateColumn(c.column, c.type)
                    const granKey = `${c.table}.${c.column}`
                    const gran = dateGranularity[granKey] || 'YYYY-MM-DD'
                    return (
                      <th
                        key={i}
                        draggable
                        data-column-index={i}
                        className={`${draggedColumnIndex === i ? 'dragging' : ''} ${isGB ? 'is-groupby' : ''}`}
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
                          <span className="header-actions">
                            {isGB ? (
                              <span className="gb-badge" onClick={(ev) => { ev.stopPropagation(); onToggleGroupBy?.(c.table, c.column) }} role="button" tabIndex={0}>기준축 ×</span>
                            ) : (
                              <span className="col-gb" onClick={(ev) => { ev.stopPropagation(); onToggleGroupBy?.(c.table, c.column) }} title="기준축으로 설정" role="button" tabIndex={0}>⊞</span>
                            )}
                            <span className="col-remove" onClick={(ev) => { ev.stopPropagation(); onRemoveColumn?.(c.table, c.column) }} role="button" tabIndex={0}>×</span>
                          </span>
                        </div>
                        {isDate && (
                          <div className="date-granularity-buttons">
                            {['YYYY', 'YYYY-MM', 'YYYY-MM-DD'].map((g) => (
                              <button
                                key={g}
                                type="button"
                                className={`date-btn ${gran === g ? 'active' : ''}`}
                                onClick={(ev) => { ev.stopPropagation(); onSetDateGranularity?.(c.table, c.column, g) }}
                              >
                                {g === 'YYYY' ? '연' : g === 'YYYY-MM' ? '연월' : '연월일'}
                              </button>
                            ))}
                          </div>
                        )}
                        {isGroupByActive && !isGB && (
                          <select
                            className="agg-select"
                            value={c.aggFunc || 'COUNT'}
                            onChange={(ev) => { ev.stopPropagation(); onChangeAggFunc?.(c.table, c.column, ev.target.value) }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {AGG_FUNCTIONS.map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </select>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {resultData.length > 0 ? (
                  resultData.map((row, ri) => (
                    <tr key={ri}>
                      {gridColumns.map((c) => {
                        let key = `${c.alias}.${c.column}`
                        if (isGroupByActive && !isGroupByColumn(groupBy, c.table, c.column) && c.aggFunc) {
                          key = `${c.aggFunc}(${c.alias}.${c.column})`
                        }
                        const val = row[key] ?? row[`${c.aggFunc}(${c.column})`] ?? row[c.column] ?? 'NULL'
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

          {gridColumns.length > 0 && hasPivot && (
            <table className="data-grid">
              <thead>
                <tr>
                  {groupBy.map((g) => (
                    <th key={`${g.table}.${g.column}`}>{g.column}</th>
                  ))}
                  {pivotRowAggs.map((agg) => {
                    const aggLabel = AGG_FUNCTIONS.find((a) => a.value === agg.aggFunc)?.label || agg.aggFunc
                    return <th key={`${agg.table}.${agg.column}.${agg.aggFunc}`}>{aggLabel}({agg.column})</th>
                  })}
                  {pivot.values.map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                  <th>전체</th>
                </tr>
              </thead>
              <tbody>
                {resultData.length > 0 ? (
                  resultData.map((row, ri) => (
                    <tr key={ri} className="data-row">
                      {groupBy.map((g) => {
                        const alias = gridColumns.find((c) => c.table === g.table)?.alias
                        const val = row[`${alias}.${g.column}`] ?? row[g.column] ?? 'NULL'
                        return <td key={`${g.table}.${g.column}`}>{val}</td>
                      })}
                      {pivotRowAggs.map((agg) => {
                        const val = row[`${agg.aggFunc}(${agg.column})`] ?? 'NULL'
                        return <td key={`${agg.table}.${agg.column}.${agg.aggFunc}`}>{val}</td>
                      })}
                      {pivot.values.map((v) => (
                        <td key={v}>{row[v] ?? 0}</td>
                      ))}
                      <td>{row['전체'] ?? 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={groupBy.length + pivotRowAggs.length + pivot.values.length + 1} style={{ textAlign: 'center', padding: '40px' }}>
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
        <textarea readOnly value={executedSql} placeholder="SQL 쿼리가 여기에 표시됩니다" id="sqlDisplay" style={{ flex: 1, minHeight: 80, padding: 10, border: 'none', resize: 'none', fontFamily: 'monospace', fontSize: 11, background: '#f9f9f9' }} />
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
