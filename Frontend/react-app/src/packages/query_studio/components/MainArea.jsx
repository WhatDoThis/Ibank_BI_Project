/**
 * query_studio/components/MainArea.jsx (쿼리 스튜디오 메인 영역)
 * =======================================================
 * 그리드·드롭 존·툴바 모달(조건·정렬·피벗·HAVING 통합·조인·관계도)·페이지네이션·SQL 패널·해석.
 *
 * [Main Functions]
 * ===========
 * 1. isGroupByColumn, joinOptionLabel, getColumnDisplayName (헬퍼)
 * 2. MainArea: gridColumns, addedTables, joinOrder, relationshipOptions, joinConditions, joinTypes, resultData, executedSql, explanation, pagination 등 props. 테이블 관계도 모달에 관계 트리·Mermaid·JOIN 조건 통합.
 *
 * [Dependencies]
 * =========
 * - React, query_studio/utils/constants (AGG_FUNCTIONS, OPERATOR_LABELS), query_studio/utils/helpers (isDateColumn, isDateType, isDateTimeType), query_studio/utils/relationshipDiagram (buildRelationshipTree, buildRelationshipMermaid)
 */

import { useState, useEffect, useRef } from 'react'
import { AGG_FUNCTIONS, OPERATOR_LABELS } from '../utils/constants'
import { getResultColumnKey } from '../utils/sqlBuilder'
import { isDateColumn, isDateType, isDateTimeType } from '../utils/helpers'
import { buildRelationshipTree, buildRelationshipMermaid } from '../utils/relationshipDiagram'

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

// 1.
function isGroupByColumn(groupBy, table, column) {
  return groupBy.some((g) => g.table === table && g.column === column)
}

// 2.
function joinOptionLabel(opt) {
  return opt ? `${opt.prevColumn} = ${opt.currColumn}` : ''
}

const JOIN_TYPE_OPTIONS = [
  { value: 'LEFT', label: 'LEFT JOIN' },
  { value: 'INNER', label: 'INNER JOIN' },
  { value: 'RIGHT', label: 'RIGHT JOIN' }
]

// 3. 라벨 우선, 없으면 컬럼명. 같은 이름 컬럼이 여러 개 있으면 테이블(alias)로 구분해 표시
function getColumnDisplayName(col, gridColumns) {
  if (!col) return ''
  const g = gridColumns?.find((c) => c.table === col.table && c.column === col.column)
  const displayName = g?.label ?? col?.label ?? col?.column ?? ''
  if (!gridColumns?.length) return displayName
  const alias = col.alias ?? g?.alias
  const sameNameCount = gridColumns.filter((c) => c.column === col.column).length
  return sameNameCount > 1 ? `${alias || col.table}.${displayName}` : displayName
}

// 5.
export default function MainArea({
  gridColumns = [],
  addedTables = [],
  joinOrder = null,
  joinAccuracy = null,
  relationshipOptions = {},
  joinConditions = {},
  joinTypes = {},
  onSetJoinConditions,
  onSetJoinConditionAt,
  onAddJoinCondition,
  onRemoveJoinCondition,
  onRemoveJoinedTable,
  onSetJoinType,
  joinLogicalOperators = {},
  onSetJoinLogicalOperator,
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
  totalCount = null,
  countLoading = false,
  executedSql = '',
  onFetchTotalCount,
  explanation = null,
  onAddColumn,
  onAddTableColumns,
  onRemoveColumn,
  onMoveColumn,
  onExecute,
  queryRunning = false,
  onClearAll,
  onToggleGroupBy,
  onSetDateGranularity,
  onChangeAggFunc,
  onAddHaving,
  onRemoveHaving,
  onHavingLogicalOpChange,
  onFetchAndSetPivot,
  onRemovePivot,
  onAddPivotAgg,
  onRemovePivotAgg,
  onAddFilter,
  onRemoveFilter,
  onFilterLogicalOpChange,
  onAddOrderBy,
  onRemoveOrderBy,
  onSetPage,
  onSetPageSize,
  onCopySql,
  onExplainSql,
  onCloseExplanation,
  onOpenSaveAsTableModal,
  autoExecute = true,
  onToggleAutoExecute
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
  /** SELECT 실행 구간 경과(초, 소수 둘째 자리) — 실행 중에만 갱신 */
  const [queryElapsedSec, setQueryElapsedSec] = useState('0.00')
  /** 직전 완료된 실행 소요 시간(같은 화면에서 유지, 다음 실행 시작 전까지 사라지지 않음) */
  const [lastRunElapsedSec, setLastRunElapsedSec] = useState(null)
  const queryElapsedIntervalRef = useRef(null)
  const queryRunT0Ref = useRef(null)

  useEffect(() => {
    if (!queryRunning) {
      if (queryElapsedIntervalRef.current != null) {
        clearInterval(queryElapsedIntervalRef.current)
        queryElapsedIntervalRef.current = null
      }
      if (queryRunT0Ref.current != null) {
        const sec = ((performance.now() - queryRunT0Ref.current) / 1000).toFixed(2)
        setLastRunElapsedSec(sec)
        queryRunT0Ref.current = null
      }
      return
    }
    setQueryElapsedSec('0.00')
    queryRunT0Ref.current = performance.now()
    queryElapsedIntervalRef.current = setInterval(() => {
      if (queryRunT0Ref.current == null) return
      setQueryElapsedSec(((performance.now() - queryRunT0Ref.current) / 1000).toFixed(2))
    }, 50)
    return () => {
      if (queryElapsedIntervalRef.current != null) {
        clearInterval(queryElapsedIntervalRef.current)
        queryElapsedIntervalRef.current = null
      }
    }
  }, [queryRunning])
  const [addHavingPopup, setAddHavingPopup] = useState(null)
  const [showQueryOptionsModal, setShowQueryOptionsModal] = useState(false)
  /** 테이블 관계도 + 조인 조건 통합 모달 */
  const [showTableRelationshipModal, setShowTableRelationshipModal] = useState(false)
  const [expandedJoinKey, setExpandedJoinKey] = useState(null)

  const isGroupByActive = groupBy && groupBy.length > 0
  const hasPivot = pivot && pivot.values && pivot.values.length > 0
  const havingCandidates = gridColumns.filter((c) => !isGroupByColumn(groupBy, c.table, c.column) && c.aggFunc)
  const pivotAvailableCols = gridColumns.filter((c) => !isGroupByColumn(groupBy, c.table, c.column))
  const pivotAggAvailableCols = pivotAvailableCols.filter(
    (c) => !(pivot && c.table === pivot.table && c.column === pivot.column)
  ).filter((c) => ['int', 'bigint', 'numeric', 'decimal', 'float', 'double'].some((t) => (c.type || '').toLowerCase().includes(t)))

  // 6.
  function handleDragOver(e) {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropOverlayActive(true)
    }
  }
  // 7.
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropOverlayActive(false)
  }
  // 8.
  function handleDrop(e) {
    setDropOverlayActive(false)
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const payload = JSON.parse(raw)
      if (payload.dragKind === 'table' && payload.table && Array.isArray(payload.columns) && onAddTableColumns) {
        onAddTableColumns(payload.table, payload.columns)
        return
      }
      if (payload.table && payload.column && onAddColumn) onAddColumn(payload)
    } catch (_) {}
  }

  // 9.
  function applyFilter() {
    if (addFilterColumnIndex == null || !gridColumns[addFilterColumnIndex]) return
    const val = (addFilterVal || '').trim()
    const noValueOp = addFilterOp === 'IS NULL' || addFilterOp === 'IS NOT NULL'
    if (!noValueOp && !val) return
    const c = gridColumns[addFilterColumnIndex]
    onAddFilter?.({ table: c.table, column: c.column, operator: addFilterOp, value: noValueOp ? '' : val })
    setAddFilterColumnIndex(null)
    setAddFilterVal('')
  }
  // 10.
  function applyOrderBy() {
    if (addOrderByColumnIndex == null || !gridColumns[addOrderByColumnIndex]) return
    onAddOrderBy?.({ columnIndex: addOrderByColumnIndex, dir: addOrderByDir })
    setAddOrderByColumnIndex(null)
  }

  const countKnown = totalCount != null
  const totalPages = countKnown ? Math.max(1, Math.ceil(totalCount / pageSize)) : null
  const start = (currentPage - 1) * pageSize + 1
  const end = countKnown ? Math.min(currentPage * pageSize, totalCount) : 0
  const displayedStart = resultData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const displayedEnd = resultData.length === 0 ? 0 : (currentPage - 1) * pageSize + resultData.length
  const nextDisabledUnknown = !countKnown && resultData.length < pageSize
  const nextDisabled = countKnown ? currentPage >= totalPages : nextDisabledUnknown
  const lastDisabled = !countKnown || currentPage >= totalPages
  const usedOrderByIndexes = new Set(orderBy.map((ob) => ob.columnIndex))
  const availableOrderByColumns = gridColumns.map((c, i) => ({ c, i })).filter(({ i }) => !usedOrderByIndexes.has(i))

  // 11.
  function orderByLabel(ob) {
    const c = gridColumns[ob.columnIndex]
    if (!c) return ''
    if (isGroupByActive && !isGroupByColumn(groupBy, c.table, c.column) && c.aggFunc) {
      const aggLabel = AGG_FUNCTIONS.find((a) => a.value === c.aggFunc)?.label || c.aggFunc
      return `${aggLabel}(${getColumnDisplayName(c, gridColumns)})`
    }
    return getColumnDisplayName(c, gridColumns)
  }

  const joinPairs = (() => {
    if (joinOrder?.some((s) => s && s.from_table)) {
      return joinOrder.filter((s) => s.from_table).map((s) => ({ prevTable: s.from_table, currTable: s.table || s.to_table }))
    }
    if (addedTables.length < 2) return []
    const stepByTable = {}
    ;(joinOrder || []).forEach((s) => {
      if (s && s.table) stepByTable[s.table] = s
    })
    const pairs = []
    for (let i = 1; i < addedTables.length; i++) {
      const currTable = addedTables[i]
      const step = stepByTable[currTable]
      let prevTable = step?.from_table
      if (!prevTable) {
        for (let j = i - 1; j >= 0; j--) {
          const p = addedTables[j]
          const k1 = `${p}||${currTable}`
          const k2 = `${currTable}||${p}`
          if ((relationshipOptions[k1] || []).length || (relationshipOptions[k2] || []).length) {
            prevTable = p
            break
          }
        }
      }
      if (!prevTable) prevTable = addedTables[i - 1]
      pairs.push({ prevTable, currTable })
    }
    return pairs
  })()

  const hasImpossibleJoin = joinPairs.some(({ prevTable, currTable }) => {
    const key = `${prevTable}||${currTable}`
    return (relationshipOptions[key] || []).length === 0
  })
  useEffect(() => {
    if (hasImpossibleJoin) setShowQueryOptionsModal(false)
  }, [hasImpossibleJoin])

  const relationshipTree = buildRelationshipTree(joinOrder, addedTables)
  const relationshipMermaid = buildRelationshipMermaid(joinOrder, addedTables)

  const joinConditionsModalContent = joinPairs.length > 0 && (
    <div className="qs-join-modal__content">
      {joinAccuracy != null && (
        <span className="join-conditions-bar__accuracy" title="JOIN 경로 정확도 (엣지별 신뢰도 평균)">
          정확도 {Math.round(joinAccuracy * 100)}%
        </span>
      )}
      <div className="join-conditions-bar__pairs">
        {joinPairs.map(({ prevTable, currTable }) => {
          const key = `${prevTable}||${currTable}`
          const opts = relationshipOptions[key] || []
          const noJoinPossible = opts.length === 0
          const firstOpt = opts[0]
          const conds = (joinConditions[key]?.length ? joinConditions[key] : firstOpt ? [firstOpt] : []).filter((c) => c?.prevColumn && c?.currColumn)
          const effectiveConds = conds.length ? conds : (firstOpt ? [{ prevColumn: firstOpt.prevColumn, currColumn: firstOpt.currColumn }] : [])
          const summary = noJoinPossible
            ? `${prevTable} ↔ ${currTable}: 조인 불가`
            : effectiveConds.length > 1
              ? `${prevTable} → ${currTable}: ${effectiveConds.map((c) => `${c.prevColumn}=${c.currColumn}`).join(' AND ')}`
              : `${prevTable} → ${currTable}: ${effectiveConds[0]?.prevColumn ?? firstOpt?.prevColumn ?? ''} = ${effectiveConds[0]?.currColumn ?? firstOpt?.currColumn ?? ''}`
          const isExpanded = expandedJoinKey === key
          const joinType = joinTypes[key] || 'LEFT'
          const logicalOp = joinLogicalOperators[key] || 'AND'
          return (
            <div key={key} className={`join-conditions-pair ${isExpanded ? 'join-conditions-pair--multi' : 'join-conditions-pair--compact'}${noJoinPossible ? ' join-conditions-pair--impossible' : ''}`}>
              <div className="join-conditions-pair__head" style={{ flex: 1, minWidth: 0 }}>
                <span
                  className="join-conditions-pair__summary"
                  onClick={() => !noJoinPossible && setExpandedJoinKey(isExpanded ? null : key)}
                  title={noJoinPossible ? '중간 테이블 추가 또는 다른 조합을 선택하세요' : '클릭하여 JOIN 설정'}
                  style={!noJoinPossible ? { cursor: 'pointer', paddingRight: 4 } : {}}
                >
                  {summary}
                  {!noJoinPossible && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-light)' }}>{isExpanded ? '▲' : '▼'}</span>}
                </span>
                {!noJoinPossible && isExpanded && (
                  <div className="join-conditions-pair__config" style={{ marginTop: 8 }}>
                    <div className="join-conditions-pair__row-wrap" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-light)' }}>JOIN 타입</label>
                      <select
                        className="join-conditions-pair__join-type"
                        value={joinType}
                        onChange={(e) => onSetJoinType?.(key, e.target.value)}
                      >
                        {JOIN_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="join-conditions-pair__conditions">
                      {effectiveConds.map((c, idx) => (
                        <span key={idx} className="join-conditions-pair__row">
                          {idx > 0 && (
                            <select
                              className="join-conditions-pair__logical-op"
                              value={logicalOp}
                              onChange={(e) => onSetJoinLogicalOperator?.(key, e.target.value)}
                              title="조건 간 연결"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          {opts.length > 1 ? (
                            <select
                              className="join-conditions-pair__select"
                              value={Math.max(0, opts.findIndex((o) => o.prevColumn === c.prevColumn && o.currColumn === c.currColumn))}
                              onChange={(e) => {
                                const i = Number(e.target.value)
                                if (i >= 0 && opts[i]) onSetJoinConditionAt?.(key, idx, opts[i])
                              }}
                            >
                              {opts.map((o, i) => (
                                <option key={i} value={i}>{joinOptionLabel(o)}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="join-conditions-pair__row" style={{ fontSize: 12 }}>{c.prevColumn} = {c.currColumn}</span>
                          )}
                          {effectiveConds.length > 1 && (
                            <button type="button" className="join-conditions-pair__remove-condition" onClick={() => onRemoveJoinCondition?.(key, idx)} title="조건 제거">×</button>
                          )}
                        </span>
                      ))}
                      {opts.length > 1 && (
                        <button type="button" className="join-conditions-pair__add-condition" onClick={() => {
                          const next = opts.find((o) => !effectiveConds.some((c) => c.prevColumn === o.prevColumn && c.currColumn === o.currColumn))
                          if (next) onSetJoinConditions?.(key, [...effectiveConds, next])
                        }}>
                          + 조건 추가
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="join-conditions-pair__remove-join"
                onClick={() => onRemoveJoinedTable?.(currTable)}
                title="조인 해제 (이 테이블 제거)"
                aria-label="조인 해제"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  const whereClauseModalContent = gridColumns.length > 0 && (
    <div className="qs-where-modal__content">
      <div className="filter-chips">
        {filters.map((f, i) => {
          const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
          if (!c) return null
          const opLabel = OPERATOR_LABELS[f.operator] || f.operator
          const noValueOp = f.operator === 'IS NULL' || f.operator === 'IS NOT NULL'
          return (
            <span key={i} className="filter-chips-inline">
              {i > 0 && (
                <select
                  className="filter-logical-op"
                  value={filters[i - 1].logicalOperator || 'AND'}
                  onChange={(e) => onFilterLogicalOpChange?.(i - 1, e.target.value)}
                  aria-label="다음 조건과"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}
              <span className="filter-chip">
                {getColumnDisplayName(c, gridColumns)} <span className="chip-op">{opLabel}</span>
                {!noValueOp && f.value != null && f.value !== '' && ` ${f.value}`}{' '}
                <span className="chip-remove" onClick={() => onRemoveFilter?.(i)} role="button" tabIndex={0}>×</span>
              </span>
            </span>
          )
        })}
        {addFilterColumnIndex == null ? (
          <button type="button" className="btn-small secondary" onClick={() => setAddFilterColumnIndex(gridColumns.length ? 0 : null)}>+ 조건 추가</button>
        ) : (
          <span className="filter-chip" style={{ flexWrap: 'nowrap' }}>
            <select value={addFilterColumnIndex} onChange={(e) => setAddFilterColumnIndex(Number(e.target.value))}>
              {gridColumns.map((c, i) => (
                <option key={i} value={i}>{getColumnDisplayName(c, gridColumns)}</option>
              ))}
            </select>
            <select value={addFilterOp} onChange={(e) => setAddFilterOp(e.target.value)}>
              {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {(addFilterOp !== 'IS NULL' && addFilterOp !== 'IS NOT NULL') && (
              <input
                type={isDateTimeType(gridColumns[addFilterColumnIndex]?.type) ? 'datetime-local' : isDateType(gridColumns[addFilterColumnIndex]?.type) ? 'date' : 'text'}
                placeholder={addFilterOp === 'IN' ? 'a,b,c' : addFilterOp === 'BETWEEN' ? 'min,max' : '값'}
                value={addFilterVal}
                onChange={(e) => setAddFilterVal(e.target.value)}
                style={{ width: '120px', padding: '4px' }}
              />
            )}
            <button type="button" className="btn-small primary" onClick={applyFilter}>적용</button>
            <span className="chip-remove" onClick={() => setAddFilterColumnIndex(null)} role="button">×</span>
          </span>
        )}
      </div>
    </div>
  )

  const aggregateOptionsModalBody = (
    <div className="qs-filters-body qs-aggregate-modal__body">
      {isGroupByActive && (
        <>
          <div className="groupby-row">
            <span className="bar-label">기준축</span>
            <div className="filter-chips">
              {groupBy.map((g) => (
                <span key={`${g.table}.${g.column}`} className="filter-chip gb-chip">
                  {getColumnDisplayName(g, gridColumns)}{' '}
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
                  {getColumnDisplayName(pivot, gridColumns)}{' '}
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
                            {getColumnDisplayName(col, gridColumns)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {false && hasPivot && (
            <div className="pivot-agg-row">
              <span className="bar-label">행별집계</span>
              <div className="filter-chips">
                {pivotRowAggs.map((agg, i) => {
                  const aggLabel = AGG_FUNCTIONS.find((a) => a.value === agg.aggFunc)?.label || agg.aggFunc
                  return (
                    <span key={i} className="filter-chip pivot-agg-chip">
                      {aggLabel}({getColumnDisplayName(agg, gridColumns)}) <span className="chip-remove" onClick={() => onRemovePivotAgg?.(i)} role="button" tabIndex={0}>×</span>
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
                            {agg.label}({getColumnDisplayName(col, gridColumns)})
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
                  <span key={i} className="filter-chips-inline">
                    {i > 0 && (
                      <select
                        className="filter-logical-op"
                        value={havings[i - 1].logicalOperator || 'AND'}
                        onChange={(e) => onHavingLogicalOpChange?.(i - 1, e.target.value)}
                        aria-label="다음 조건과"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    )}
                    <span className="filter-chip having-chip">
                      {aggLabel}({getColumnDisplayName(h, gridColumns)}) <span className="chip-op">{opLabel}</span> {h.value}{' '}
                      <span className="chip-remove" onClick={() => onRemoveHaving?.(i)} role="button" tabIndex={0}>×</span>
                    </span>
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
                          {aggLabel}({getColumnDisplayName(c, gridColumns)})
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
  )

  return (
    <>
    <div className="main-area qs-main">
      {gridColumns.length > 0 && (
        <header className="qs-toolbar">
          <div className="qs-toolbar__left">
            {typeof onClearAll === 'function' && (
              <button type="button" className="btn btn-query-studio-secondary" onClick={onClearAll}>
                초기화
              </button>
            )}
            <button
              type="button"
              className="btn btn-query-studio-secondary"
              onClick={() => setShowQueryOptionsModal(true)}
              title="WHERE·기준축·피벗·HAVING·정렬(ORDER BY) 편집"
            >
              조건
            </button>
            {joinPairs.length > 0 && (
              <button
                type="button"
                className="btn btn-query-studio-secondary"
                onClick={() => setShowTableRelationshipModal(true)}
                title="테이블 관계도 및 JOIN 조건"
              >
                테이블 관계도
              </button>
            )}
          </div>
          <div className="qs-toolbar__right">
            {(queryRunning || lastRunElapsedSec != null) && (
              <span className="qs-query-elapsed" aria-live="polite">
                {queryRunning ? (
                  <>
                    쿼리 실행 중… <span className="qs-query-elapsed__value">{queryElapsedSec}</span>초
                  </>
                ) : (
                  <>
                    마지막 실행 시간 <span className="qs-query-elapsed__value">{lastRunElapsedSec}</span>초
                  </>
                )}
              </span>
            )}
            {typeof onToggleAutoExecute === 'function' && (
              <label className="qs-toolbar__auto">
                <input type="checkbox" checked={autoExecute} onChange={onToggleAutoExecute} />
                <span>자동 실행</span>
              </label>
            )}
            {typeof onExecute === 'function' && (
              <button type="button" className="btn btn-primary btn-execute" onClick={onExecute} disabled={queryRunning}>
                {queryRunning ? (
                  <>
                    <span className="btn-execute-spinner" aria-hidden />
                    실행 중…
                  </>
                ) : (
                  '실행'
                )}
              </button>
            )}
            {typeof onOpenSaveAsTableModal === 'function' && (
              <button
                type="button"
                className="btn btn-primary btn-execute"
                onClick={onOpenSaveAsTableModal}
                disabled={queryRunning}
                title="현재 조건의 SQL 결과를 테이블로 저장"
              >
                저장
              </button>
            )}
          </div>
        </header>
      )}

      <div className="qs-workspace">
        <div className="grid-area qs-grid-area">

        {addHavingPopup && (
          <div className="filter-popup" style={{ position: 'fixed', left: 20, top: 80, zIndex: 1102 }}>
            <div className="filter-header">
              <span>HAVING 조건 추가</span>
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
            <div className="drop-message">컬럼 또는 테이블을 이 영역에 놓으세요</div>
          </div>

          {gridColumns.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden />
              <div className="empty-title">왼쪽에서 컬럼 또는 테이블 이름을 드래그하세요</div>
              <div className="empty-desc">개별 컬럼을 드래그하거나, 테이블 이름을 드래그하면<br />해당 테이블의 컬럼이 한 번에 추가됩니다</div>
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
                    const gran = dateGranularity[granKey] // 없으면 원본 표시, 연/연월/연월일 중 선택 시에만 해당 버튼 활성
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
                          <span className="column-name">{getColumnDisplayName(c, gridColumns)}</span>
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
                        const key = getResultColumnKey(c, groupBy, dateGranularity)
                        const val =
                          row[key] ??
                          row[`${c.aggFunc}(${c.alias}.${c.column})`] ??
                          row[`${c.aggFunc}(${c.column})`] ??
                          row[c.column] ??
                          'NULL'
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
                    <th key={`${g.table}.${g.column}`}>{getColumnDisplayName(g, gridColumns)}</th>
                  ))}
                  {pivotRowAggs.map((agg) => {
                    const aggLabel = AGG_FUNCTIONS.find((a) => a.value === agg.aggFunc)?.label || agg.aggFunc
                    return <th key={`${agg.table}.${agg.column}.${agg.aggFunc}`}>{aggLabel}({getColumnDisplayName(agg, gridColumns)})</th>
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
                        const gc = gridColumns.find((c) => c.table === g.table && c.column === g.column)
                        const alias = gc?.alias || gridColumns.find((c) => c.table === g.table)?.alias
                        const gCol = {
                          table: g.table,
                          column: g.column,
                          alias: alias || 't1',
                          outputKey: gc?.outputKey,
                        }
                        const val =
                          row[getResultColumnKey(gCol, groupBy, dateGranularity)] ??
                          row[`${alias}.${g.column}`] ??
                          row[g.column] ??
                          'NULL'
                        return <td key={`${g.table}.${g.column}`}>{val}</td>
                      })}
                      {pivotRowAggs.map((agg) => {
                        const gc = gridColumns.find((c) => c.table === agg.table && c.column === agg.column)
                        const aggAlias = gc?.alias
                        const aggCol = {
                          table: agg.table,
                          column: agg.column,
                          alias: aggAlias || 't1',
                          aggFunc: agg.aggFunc,
                          outputKey: gc?.outputKey,
                        }
                        const val =
                          row[getResultColumnKey(aggCol, groupBy, dateGranularity)] ??
                          row[`${agg.aggFunc}(${agg.column})`] ??
                          'NULL'
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

        {gridColumns.length > 0 && executedSql.trim().length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              {countKnown ? (
                <>
                  <span>{totalCount === 0 ? '0건' : `${start}-${end}건`}</span>
                  <span style={{ color: 'var(--text-light)' }}> / 총 </span>
                  <span>{totalCount}건</span>
                </>
              ) : (
                <>
                  <span>{resultData.length === 0 ? '0건' : `${displayedStart}-${displayedEnd}건`}</span>
                  <span style={{ color: 'var(--text-light)' }}> / 총 </span>
                  <span title="전체 건수는 COUNT 쿼리를 실행합니다">—</span>
                  <button
                    type="button"
                    className="btn-small secondary"
                    onClick={() => onFetchTotalCount?.()}
                    disabled={countLoading || !onFetchTotalCount}
                  >
                    {countLoading ? '조회 중…' : '전체 건수'}
                  </button>
                </>
              )}
            </div>
            <div className="pagination-controls">
              <button type="button" className="btn-small secondary" disabled={currentPage === 1} onClick={() => onSetPage?.(1)}>처음</button>
              <button type="button" className="btn-small secondary" disabled={currentPage === 1} onClick={() => onSetPage?.(currentPage - 1)}>이전</button>
              <span className="page-indicator">페이지 <span>{currentPage}</span> / <span>{countKnown ? totalPages : '?'}</span></span>
              <button type="button" className="btn-small secondary" disabled={nextDisabled} onClick={() => onSetPage?.(currentPage + 1)}>다음</button>
              <button type="button" className="btn-small secondary" disabled={lastDisabled} onClick={() => onSetPage?.(totalPages)}>마지막</button>
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

      <div className="sql-panel qs-sql-panel" role="region" aria-label="실행 SQL">
        <div className="sql-header qs-sql-header">
          <span className="qs-sql-header__title">실행 SQL</span>
          <div className="qs-sql-header__actions">
            <button type="button" className="btn-small secondary qs-sql-header__btn" onClick={onExplainSql}>
              해석
            </button>
            <button type="button" className="btn-small secondary qs-sql-header__btn" onClick={onCopySql}>
              복사
            </button>
          </div>
        </div>
        <textarea readOnly value={executedSql} placeholder="현재 조건 기준 SQL (실행 여부와 관계없이 갱신)" id="sqlDisplay" className="qs-sql-textarea" />
        {explanation != null && (
          <div className="explanation-area">
            <div className="explanation-header">
              <span>쿼리 해석</span>
              <span className="explanation-close" onClick={onCloseExplanation} role="button" tabIndex={0}>×</span>
            </div>
            <div className={`explanation-content ${explanation === 'loading' ? 'loading' : ''}`}>
              {explanation === 'loading' ? '해석 중…' : explanation}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>

    {showQueryOptionsModal && gridColumns.length > 0 && (
      <div
        className="relationship-diagram-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-query-options-modal-title"
        onClick={() => setShowQueryOptionsModal(false)}
      >
        <div
          className="relationship-diagram-modal qs-query-options-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relationship-diagram-header">
            <span id="qs-query-options-modal-title">조건</span>
            <button type="button" className="relationship-diagram-close" onClick={() => setShowQueryOptionsModal(false)} aria-label="닫기">×</button>
          </div>
          <div className="relationship-diagram-body">
            <div className="qs-query-options-modal__section">
              <div className="bar-label qs-query-options-modal__section-label">조건 (WHERE)</div>
              {whereClauseModalContent}
            </div>
            <div className="qs-query-options-modal__divider" aria-hidden />
            {aggregateOptionsModalBody}
          </div>
        </div>
      </div>
    )}

    {showTableRelationshipModal && joinPairs.length > 0 && (
      <div
        className="relationship-diagram-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-table-relationship-modal-title"
        onClick={() => setShowTableRelationshipModal(false)}
      >
        <div
          className="relationship-diagram-modal qs-table-relationship-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relationship-diagram-header">
            <span id="qs-table-relationship-modal-title">테이블 관계도</span>
            <button type="button" className="relationship-diagram-close" onClick={() => setShowTableRelationshipModal(false)} aria-label="닫기">×</button>
          </div>
          <div className="relationship-diagram-body qs-table-relationship-modal__body">
            <div className="qs-query-options-modal__section">
              <div className="bar-label qs-query-options-modal__section-label">경로·관계</div>
              {relationshipTree.baseTable && (
                <p className="relationship-diagram-caption">기준 테이블: <strong>{relationshipTree.baseTable}</strong></p>
              )}
              <pre className="relationship-diagram-tree">{relationshipTree.lines.join('\n')}</pre>
              {relationshipMermaid && (
                <details className="relationship-diagram-mermaid-wrap">
                  <summary>Mermaid 코드 (복사용)</summary>
                  <pre className="relationship-diagram-mermaid">{relationshipMermaid}</pre>
                </details>
              )}
            </div>
            <div className="qs-query-options-modal__divider" aria-hidden />
            <div className="qs-query-options-modal__section">
              <div className="bar-label qs-query-options-modal__section-label">JOIN 조건</div>
              {joinConditionsModalContent}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
