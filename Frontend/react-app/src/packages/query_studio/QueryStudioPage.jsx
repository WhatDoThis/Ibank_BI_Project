/**
 * query_studio/QueryStudioPage.jsx (쿼리 스튜디오·쿼리 빌더 페이지)
 * ================================================================
 * 노코드 쿼리 빌더. 그리드·테이블/컬럼·필터·GROUP BY·피벗·HAVING·정렬·실행·페이지네이션·JOIN 설정·Claude 해석·저장.
 *
 * [Main Functions]
 * ===========
 * 1. 상태: addedTables, gridColumns, filters, orderBy, groupBy, pivot, havings, joinMode, relationshipOptions, joinConditions, joinTypes, joinOrderData, resultData, executedSql, explanation, pagination. 실행 성공 시 lastSuccessWorkspaceRef 스냅샷, 실패 시 빌더·결과 원상복구
 * 2. runExecuteQuery, runExplainSql, 초기화(clearAll). listTables, describeTable, tableRelationships, joinOrder, executeQuery, explainSql, saveQueryAsTable API 호출
 * 3. QueryStudioPage: Sidebar, MainArea에 props 전달. generateSQL, generateCountSQL, canAddTableSafely, validateJoinPath, getReachableTables 등 utils 연동
 *
 * [Dependencies]
 * =========
 * - React, @/packages/query_studio/api/queryStudioClient.js, @/shared/config/api, query_studio/utils (sqlBuilder, joinRules, safetyCheck, constants), query_studio/components (Sidebar, MainArea)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './queryStudio.css'
import { listTables, describeTable, tableRelationships as fetchTableRelationships, joinOrder as fetchJoinOrder, executeQuery as apiExecuteQuery, explainSql, saveQueryAsTable, getSaveQueryAsTableStatus, saveColumnLabels } from '@/packages/query_studio/api/queryStudioClient.js'
import { useQueryStudioData } from './hooks/useQueryStudioData'
import { generateSQL, generateCountSQL, generateDistinctPivotSQL } from './utils/sqlBuilder'
import { canAddTableByColumn, findIntermediateParent } from './utils/joinRules'
import { canAddTableSafely, validateJoinPath, getReachableTables } from './utils/safetyCheck'
import { AGG_FUNCTIONS } from './utils/constants'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import { PageHeader } from '@/app/layout/PageHeader.jsx'

const DEFAULT_PAGE_SIZE = 100

// 1.
function isGroupByColumn(groupBy, table, column) {
  return groupBy.some((g) => g.table === table && g.column === column)
}

/** 마지막 성공 실행 직후 UI 복원용 (실행 실패 시 그리드·조인·결과까지 되돌림) */
function cloneWorkspaceSnapshot(o) {
  const cloneRows = (rows) => {
    if (!Array.isArray(rows)) return []
    try {
      return typeof structuredClone === 'function' ? structuredClone(rows) : JSON.parse(JSON.stringify(rows))
    } catch {
      return rows.map((row) => (row && typeof row === 'object' ? { ...row } : row))
    }
  }
  return {
    gridColumns: o.gridColumns.map((c) => ({ ...c })),
    addedTables: [...o.addedTables],
    groupBy: o.groupBy.map((g) => ({ ...g })),
    pivot: o.pivot ? { ...o.pivot, values: [...(o.pivot.values || [])] } : null,
    pivotRowAggs: o.pivotRowAggs.map((x) => ({ ...x })),
    dateGranularity: { ...o.dateGranularity },
    havings: o.havings.map((h) => ({ ...h })),
    filters: o.filters.map((f) => ({ ...f })),
    orderBy: o.orderBy.map((x) => ({ ...x })),
    joinConditions: Object.fromEntries(
      Object.entries(o.joinConditions).map(([k, arr]) => [k, (arr || []).map((c) => ({ ...c }))])
    ),
    joinTypes: { ...o.joinTypes },
    joinLogicalOperators: { ...o.joinLogicalOperators },
    joinOrderData: o.joinOrderData ? JSON.parse(JSON.stringify(o.joinOrderData)) : null,
    currentPage: o.currentPage,
    pageSize: o.pageSize,
    executedSql: o.executedSql,
    resultData: cloneRows(o.resultData),
    totalCount: o.totalCount,
  }
}

// 2.
export default function QueryStudioPage() {
  const { dbStatus, setDbStatus, tables, setTables, loading, loadHealth, loadTables, refreshAll } = useQueryStudioData()

  const [gridColumns, setGridColumns] = useState([])
  const [addedTables, setAddedTables] = useState([])
  const [groupBy, setGroupBy] = useState([])
  const [pivot, setPivot] = useState(null)
  const [pivotRowAggs, setPivotRowAggs] = useState([])
  const [dateGranularity, setDateGranularity] = useState({})
  const [havings, setHavings] = useState([])
  const [filters, setFilters] = useState([])
  const [orderBy, setOrderBy] = useState([])
  const [resultData, setResultData] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  /** null: 아직 COUNT 안 함(실행만으로는 전체 건수 미조회) */
  const [totalCount, setTotalCount] = useState(null)
  const [executedSql, setExecutedSql] = useState('')
  const [explanation, setExplanation] = useState(null)
  const [toast, setToast] = useState(null)
  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false)
  const [saveAsTableName, setSaveAsTableName] = useState('')
  const [saveAsTableSubmitting, setSaveAsTableSubmitting] = useState(false)
  const [showJoinImpossibleModal, setShowJoinImpossibleModal] = useState(false)
  const [showColumnLabelsModal, setShowColumnLabelsModal] = useState(false)
  const [autoExecute, setAutoExecute] = useState(true)
  /** 선택된 컬럼 기준: 테이블별 테이블 라벨 draft */
  const [tableLabelsDraft, setTableLabelsDraft] = useState({}) // { tableName: label }
  /** 선택된 컬럼 기준: 테이블별 컬럼 라벨 draft */
  const [columnLabelsByTableDraft, setColumnLabelsByTableDraft] = useState({}) // { tableName: { columnName: label } }
  const [columnLabelsSaving, setColumnLabelsSaving] = useState(false)
  const [joinMode, setJoinMode] = useState('all') // 'fk' | 'column' | 'all'
  const [relationshipOptions, setRelationshipOptions] = useState({}) // { key: [ { prevColumn, currColumn, confidence?, reason? } ] }
  const [joinConditions, setJoinConditions] = useState({}) // { key: [ { prevColumn, currColumn }, ... ] } 복합 조건
  const [joinTypes, setJoinTypes] = useState({}) // { key: 'LEFT'|'INNER'|'RIGHT' }
  const [joinLogicalOperators, setJoinLogicalOperators] = useState({}) // { key: 'AND'|'OR' } 조건 간 연결
  const [joinOrderData, setJoinOrderData] = useState(null) // { join_order: [{ table, from_table, from_column, to_table, to_column }] } — A→B, A→C 브랜치

  const lastSuccessWorkspaceRef = useRef(null)

  const tableRelationships = useMemo(() => {
    const resolved = {}
    tables.forEach((t) => {
      if (t.table_name) resolved[t.table_name] = {}
    })
    Object.keys(relationshipOptions).forEach((key) => {
      const opts = relationshipOptions[key]
      if (!opts || opts.length === 0) return
      const parts = key.split('||')
      if (parts.length !== 2) return
      const [fromTable, toTable] = parts
      const conds = joinConditions[key]
      const first = (conds && conds[0]) ? conds[0] : (opts[0] && typeof opts[0] === 'object' && opts[0].prevColumn ? opts[0] : null)
      if (!first) return
      if (!resolved[fromTable]) resolved[fromTable] = {}
      if (!resolved[toTable]) resolved[toTable] = {}
      resolved[fromTable][toTable] = first
      resolved[toTable][fromTable] = { prevColumn: first.currColumn, currColumn: first.prevColumn }
    })
    return resolved
  }, [tables, relationshipOptions, joinConditions])

  const joinConfigs = useMemo(() => {
    const configs = {}
    Object.keys(relationshipOptions).forEach((key) => {
      const opts = relationshipOptions[key]
      if (!opts || opts.length === 0) return
      const conds = joinConditions[key]
      const defaultFirst = opts[0] && (opts[0].prevColumn != null) ? opts[0] : null
      const conditions = (conds && conds.length) ? conds : (defaultFirst ? [defaultFirst] : [])
      if (conditions.length === 0) return
      configs[key] = {
        joinType: joinTypes[key] || 'LEFT',
        logicalOperator: joinLogicalOperators[key] || 'AND',
        conditions: conditions.map((c) => ({ prevColumn: c.prevColumn, currColumn: c.currColumn }))
      }
    })
    return configs
  }, [relationshipOptions, joinConditions, joinTypes, joinLogicalOperators])

  useEffect(() => {
    let cancelled = false
    let toastTimeout = null
    async function load() {
      await loadHealth()
      const res = await loadTables((msg) => {
        if (!cancelled) {
          setToast({ type: 'error', msg })
          toastTimeout = setTimeout(() => setToast(null), 3000)
        }
      })
      if (!cancelled && res.ok === false && res.error) {
        setDbStatus((prev) => (prev.ok === null ? { ok: false, message: 'DB 연결 안됨' } : prev))
      }
    }
    load()
    return () => {
      cancelled = true
      if (toastTimeout) clearTimeout(toastTimeout)
    }
  }, [loadHealth, loadTables])

  useEffect(() => {
    if (!tables.length) return
    let cancelled = false
    fetchTableRelationships(joinMode)
      .then((relData) => {
        if (cancelled) return
        const rels = relData?.relationships || []
        const opts = {}
        const seen = new Set()
        rels.forEach((r) => {
          const fromTable = r.from_table
          const toTable = r.to_table
          const prevCol = r.from_column
          const currCol = r.to_column
          if (prevCol === 'id' && currCol === 'id') return
          const push = (key, prev, curr) => {
            const optKey = `${key}::${prev}::${curr}`
            if (seen.has(optKey)) return
            seen.add(optKey)
            if (!opts[key]) opts[key] = []
            opts[key].push({
              prevColumn: prev,
              currColumn: curr,
              confidence: r.confidence,
              reason: r.reason,
              relationship_type: r.relationship_type,
              role: r.role
            })
          }
          push(`${fromTable}||${toTable}`, prevCol, currCol)
          push(`${toTable}||${fromTable}`, currCol, prevCol)
        })
        setRelationshipOptions(opts)
      })
      .catch(() => setRelationshipOptions({}))
    return () => { cancelled = true }
  }, [joinMode, tables])

  useEffect(() => {
    if (addedTables.length < 2) {
      setJoinOrderData(null)
      return
    }
    let cancelled = false
    const base = addedTables[0]
    const required = addedTables.slice(1)
    fetchJoinOrder(base, required)
      .then((data) => {
        if (cancelled) return
        setJoinOrderData(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setJoinOrderData(null)
          console.warn('[query-studio] join-order API 실패, 순차 조인 fallback 사용:', err?.message || err)
        }
      })
    return () => { cancelled = true }
  }, [addedTables.join(',')])

  const setJoinConditionsForPair = useCallback((key, conditions) => {
    setJoinConditions((prev) => (conditions?.length ? { ...prev, [key]: conditions } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])
  const setJoinConditionAt = useCallback((key, index, value) => {
    setJoinConditions((prev) => {
      const arr = prev[key] ? [...prev[key]] : []
      if (value) {
        arr[index] = value
        return { ...prev, [key]: arr }
      }
      arr.splice(index, 1)
      return arr.length ? { ...prev, [key]: arr } : (() => { const n = { ...prev }; delete n[key]; return n })()
    })
  }, [])
  const addJoinCondition = useCallback((key, value) => {
    if (!value?.prevColumn || !value?.currColumn) return
    setJoinConditions((prev) => {
      const arr = prev[key] ? [...prev[key], value] : [value]
      return { ...prev, [key]: arr }
    })
  }, [])
  const removeJoinCondition = useCallback((key, index) => {
    setJoinConditions((prev) => {
      const arr = prev[key] ? [...prev[key]] : []
      arr.splice(index, 1)
      return arr.length ? { ...prev, [key]: arr } : (() => { const n = { ...prev }; delete n[key]; return n })()
    })
  }, [])
  const setJoinTypeForPair = useCallback((key, joinType) => {
    setJoinTypes((prev) => (joinType ? { ...prev, [key]: joinType } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])
  const setJoinLogicalOperatorForPair = useCallback((key, logicalOperator) => {
    setJoinLogicalOperators((prev) => (logicalOperator ? { ...prev, [key]: logicalOperator } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [])

  const syncAggFuncs = useCallback((cols, gb) => {
    if (!gb || gb.length === 0) {
      return cols.map((c) => ({ ...c, aggFunc: null }))
    }
    return cols.map((c) => {
      if (isGroupByColumn(gb, c.table, c.column)) return { ...c, aggFunc: null }
      return { ...c, aggFunc: c.aggFunc || 'COUNT' }
    })
  }, [])

  const addColumn = useCallback(
    (columnInfo) => {
      const exists = gridColumns.some((c) => c.table === columnInfo.table && c.column === columnInfo.column)
      if (exists) {
        showToast('warning', '이미 추가된 컬럼입니다')
        return
      }
      const tableAlreadyAdded = addedTables.includes(columnInfo.table)
      let newAddedTables
      let intermediateParent = null
      if (tableAlreadyAdded) {
        newAddedTables = addedTables
      } else if (canAddTableByColumn(addedTables, columnInfo.table, relationshipOptions)) {
        newAddedTables = [...addedTables, columnInfo.table]
      } else {
        const lastTable = addedTables[addedTables.length - 1]
        intermediateParent = findIntermediateParent(lastTable, columnInfo.table, relationshipOptions)
        if (intermediateParent) {
          // 중간 부모가 이미 경로에 있으면 끼우지 않음 → 순환 참조 방지 (A, B 넣은 뒤 C 넣을 때 A 다시 넣지 않음)
          if (addedTables.includes(intermediateParent)) {
            newAddedTables = [...addedTables, columnInfo.table]
            intermediateParent = null
} else {
          newAddedTables = [...addedTables, intermediateParent, columnInfo.table]
          }
        } else {
          setShowJoinImpossibleModal(true)
          return
        }
      }
      if (!tableAlreadyAdded) {
        const safetyCheck = canAddTableSafely(
          addedTables,
          columnInfo.table,
          intermediateParent,
          relationshipOptions
        )
        if (!safetyCheck.ok) {
          if (safetyCheck.severity === 'error') {
            showToast('error', safetyCheck.reason)
            if (safetyCheck.detail) console.error('Safety check:', safetyCheck.detail)
            if (safetyCheck.suggestion) showToast('info', `💡 ${safetyCheck.suggestion}`)
            return
          }
          if (safetyCheck.severity === 'warning') {
            showToast('warning', safetyCheck.reason)
            if (safetyCheck.suggestion) showToast('info', safetyCheck.suggestion)
          }
        }
      }
      const tableAliasMap = {}
      newAddedTables.forEach((t, i) => {
        tableAliasMap[t] = 't' + (i + 1)
      })
      const alias = tableAliasMap[columnInfo.table] || 't1'
      const isGB = isGroupByColumn(groupBy, columnInfo.table, columnInfo.column)
      const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null
      setAddedTables(newAddedTables)
      setGridColumns((prev) => syncAggFuncs([...prev, { table: columnInfo.table, column: columnInfo.column, alias, type: columnInfo.type, aggFunc, label: columnInfo.label ?? columnInfo.column }], groupBy))
      setCurrentPage(1)
      if (intermediateParent) {
        showToast('success', `'${intermediateParent}' 테이블을 거쳐 '${columnInfo.table}'를 추가했습니다`)
      } else {
        showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
      }
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions]
  )

  const addTableColumns = useCallback(
    (tableName, columnList) => {
      if (!tableName || !Array.isArray(columnList) || columnList.length === 0) return

      const toAdd = columnList.filter(
        (c) => c && c.name && !gridColumns.some((gc) => gc.table === tableName && gc.column === c.name)
      )
      if (toAdd.length === 0) {
        showToast('warning', '이미 해당 테이블의 컬럼이 모두 추가되어 있거나 추가할 컬럼이 없습니다')
        return
      }

      const tableAlreadyAdded = addedTables.includes(tableName)
      let newAddedTables
      let intermediateParent = null

      if (tableAlreadyAdded) {
        newAddedTables = addedTables
      } else if (canAddTableByColumn(addedTables, tableName, relationshipOptions)) {
        newAddedTables = [...addedTables, tableName]
      } else {
        const lastTable = addedTables[addedTables.length - 1]
        intermediateParent = findIntermediateParent(lastTable, tableName, relationshipOptions)
        if (intermediateParent) {
          if (addedTables.includes(intermediateParent)) {
            newAddedTables = [...addedTables, tableName]
            intermediateParent = null
          } else {
            newAddedTables = [...addedTables, intermediateParent, tableName]
          }
        } else {
          setShowJoinImpossibleModal(true)
          return
        }
      }

      if (!tableAlreadyAdded) {
        const safetyCheck = canAddTableSafely(addedTables, tableName, intermediateParent, relationshipOptions)
        if (!safetyCheck.ok) {
          if (safetyCheck.severity === 'error') {
            showToast('error', safetyCheck.reason)
            if (safetyCheck.detail) console.error('Safety check:', safetyCheck.detail)
            if (safetyCheck.suggestion) showToast('info', `💡 ${safetyCheck.suggestion}`)
            return
          }
          if (safetyCheck.severity === 'warning') {
            showToast('warning', safetyCheck.reason)
            if (safetyCheck.suggestion) showToast('info', safetyCheck.suggestion)
          }
        }
      }

      const tableAliasMap = {}
      newAddedTables.forEach((t, i) => {
        tableAliasMap[t] = 't' + (i + 1)
      })
      const alias = tableAliasMap[tableName] || 't1'

      const newGridEntries = toAdd.map((c) => {
        const isGB = isGroupByColumn(groupBy, tableName, c.name)
        const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null
        return {
          table: tableName,
          column: c.name,
          alias,
          type: c.type,
          aggFunc,
          label: c.label ?? c.name,
        }
      })

      setAddedTables(newAddedTables)
      setGridColumns((prev) => syncAggFuncs([...prev, ...newGridEntries], groupBy))
      setCurrentPage(1)

      const tableMeta = tables.find((t) => t.table_name === tableName)
      const displayLabel = tableMeta?.table_label ?? tableName
      showToast('success', `'${displayLabel}' 컬럼 ${toAdd.length}개를 추가했습니다`)
      if (intermediateParent && !tableAlreadyAdded) {
        showToast('success', `'${intermediateParent}' 테이블을 거쳐 '${tableName}'를 추가했습니다`)
      }
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions, tables]
  )

  const [queryRunning, setQueryRunning] = useState(false)
  const [countLoading, setCountLoading] = useState(false)

  const runExecuteQuery = useCallback(async () => {
    if (gridColumns.length === 0) {
      showToast('warning', '최소 1개의 컬럼을 선택하세요')
      return
    }
    const pathValidation = validateJoinPath(addedTables, relationshipOptions, { join_order: joinOrderData?.join_order })
    if (!pathValidation.valid) {
      const errors = pathValidation.issues.filter((i) => i.severity === 'error')
      const msg = errors.length === 1 ? errors[0].message : `조인 경로 오류 ${errors.length}건: ${errors.map((e) => e.message).join('; ')}`
      showToast('error', msg)
      return
    }
    const warnings = pathValidation.issues.filter((i) => i.severity === 'warning')
    if (warnings.length > 0) {
      const msg = warnings.length === 1 ? warnings[0].message : `경고 ${warnings.length}건: ${warnings.map((w) => w.message).join('; ')}`
      showToast('warning', msg)
    }
    const priorSql = executedSql
    const priorResult = resultData
    const priorTotal = totalCount
    setQueryRunning(true)
    try {
      setTotalCount(null)
      const options = { groupBy, dateGranularity, havings, pivot, pivotRowAggs, joinConfigs, joinOrder: joinOrderData?.join_order }
      // 1) 먼저 쿼리문 생성·표시 후 실행 (joinOrder 있으면 A→B, A→C 브랜치 지원). 전체 건수 COUNT는 별도 버튼으로만 실행.
      const sql = generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, options)
      setExecutedSql(sql)

      const res = await apiExecuteQuery(sql)
      const nextRows = res.data || []
      setResultData(nextRows)
      lastSuccessWorkspaceRef.current = cloneWorkspaceSnapshot({
        gridColumns,
        addedTables,
        groupBy,
        pivot,
        pivotRowAggs,
        dateGranularity,
        havings,
        filters,
        orderBy,
        joinConditions,
        joinTypes,
        joinLogicalOperators,
        joinOrderData,
        currentPage,
        pageSize,
        executedSql: sql,
        resultData: nextRows,
        totalCount: null,
      })
      showToast('success', `${res.count ?? nextRows.length ?? 0}건 조회 완료`)
    } catch (e) {
      const snap = lastSuccessWorkspaceRef.current
      if (snap) {
        setGridColumns(snap.gridColumns.map((c) => ({ ...c })))
        setAddedTables([...snap.addedTables])
        setGroupBy(snap.groupBy.map((g) => ({ ...g })))
        setPivot(snap.pivot ? { ...snap.pivot, values: [...(snap.pivot.values || [])] } : null)
        setPivotRowAggs(snap.pivotRowAggs.map((x) => ({ ...x })))
        setDateGranularity({ ...snap.dateGranularity })
        setHavings(snap.havings.map((h) => ({ ...h })))
        setFilters(snap.filters.map((f) => ({ ...f })))
        setOrderBy(snap.orderBy.map((x) => ({ ...x })))
        setJoinConditions(
          Object.fromEntries(Object.entries(snap.joinConditions).map(([k, arr]) => [k, arr.map((c) => ({ ...c }))]))
        )
        setJoinTypes({ ...snap.joinTypes })
        setJoinLogicalOperators({ ...snap.joinLogicalOperators })
        setJoinOrderData(snap.joinOrderData ? JSON.parse(JSON.stringify(snap.joinOrderData)) : null)
        setCurrentPage(snap.currentPage)
        setPageSize(snap.pageSize)
        setExecutedSql(snap.executedSql)
        setResultData(typeof structuredClone === 'function' ? structuredClone(snap.resultData) : JSON.parse(JSON.stringify(snap.resultData || [])))
        setTotalCount(snap.totalCount)
        setExplanation(null)
      } else {
        setExecutedSql(priorSql)
        setResultData(Array.isArray(priorResult) ? priorResult.slice() : priorResult)
        setTotalCount(priorTotal)
      }
      showToast('error', e.message || '실행 실패')
    } finally {
      setQueryRunning(false)
    }
  }, [
    gridColumns,
    addedTables,
    filters,
    orderBy,
    currentPage,
    pageSize,
    tableRelationships,
    joinConfigs,
    joinOrderData,
    groupBy,
    dateGranularity,
    havings,
    pivot,
    pivotRowAggs,
    joinConditions,
    joinTypes,
    joinLogicalOperators,
    relationshipOptions,
    showToast,
    executedSql,
    resultData,
    totalCount,
  ])

  const runFetchTotalCount = useCallback(async () => {
    if (gridColumns.length === 0) return
    const pathValidation = validateJoinPath(addedTables, relationshipOptions, { join_order: joinOrderData?.join_order })
    if (!pathValidation.valid) {
      const errors = pathValidation.issues.filter((i) => i.severity === 'error')
      const msg = errors.length === 1 ? errors[0].message : `조인 경로 오류 ${errors.length}건: ${errors.map((e) => e.message).join('; ')}`
      showToast('error', msg)
      return
    }
    const options = { groupBy, dateGranularity, havings, pivot, pivotRowAggs, joinConfigs, joinOrder: joinOrderData?.join_order }
    const countSQL = generateCountSQL(gridColumns, addedTables, filters, tableRelationships, options)
    if (!countSQL) {
      showToast('warning', '전체 건수용 COUNT 쿼리를 만들 수 없습니다')
      return
    }
    setCountLoading(true)
    try {
      const countRes = await apiExecuteQuery(countSQL)
      const raw = countRes.data?.[0]?.total
      setTotalCount(typeof raw === 'number' ? raw : parseInt(raw, 10) || 0)
      showToast('success', '전체 건수를 조회했습니다')
    } catch (e) {
      showToast('error', e.message || '전체 건수 조회 실패')
    } finally {
      setCountLoading(false)
    }
  }, [gridColumns, addedTables, filters, tableRelationships, joinConfigs, joinOrderData, groupBy, dateGranularity, havings, pivot, pivotRowAggs, relationshipOptions, showToast])

  const runExecuteQueryRef = useRef(runExecuteQuery)
  runExecuteQueryRef.current = runExecuteQuery
  useEffect(() => {
    if (!autoExecute || gridColumns.length === 0) return
    const tid = setTimeout(() => {
      runExecuteQueryRef.current()
    }, 400)
    return () => clearTimeout(tid)
  }, [autoExecute, gridColumns, addedTables, filters, orderBy, currentPage, pageSize, joinOrderData, pivot, havings])

  const moveColumn = useCallback((fromIndex, toIndex, insertBefore) => {
    setGridColumns((prev) => {
      const arr = [...prev]
      const [moved] = arr.splice(fromIndex, 1)
      let newIndex = toIndex
      if (fromIndex < toIndex) newIndex = insertBefore ? toIndex - 1 : toIndex
      else newIndex = insertBefore ? toIndex : toIndex + 1
      arr.splice(newIndex, 0, moved)
      return arr
    })
    setCurrentPage(1)
  }, [])

  const removeColumn = useCallback(
    (tableName, columnName) => {
      const removedIndex = gridColumns.findIndex((c) => c.table === tableName && c.column === columnName)
      if (removedIndex < 0) return

      let nextCols = gridColumns.filter((c) => !(c.table === tableName && c.column === columnName))
      const tableStillUsed = nextCols.some((c) => c.table === tableName)

      setFilters((prev) => prev.filter((f) => !(f.table === tableName && f.column === columnName)))
      setGroupBy((prev) => prev.filter((g) => !(g.table === tableName && g.column === columnName)))
      setHavings((prev) => prev.filter((h) => !(h.table === tableName && h.column === columnName)))
      setPivotRowAggs((prev) => prev.filter((a) => !(a.table === tableName && a.column === columnName)))
      if (pivot && pivot.table === tableName && pivot.column === columnName) setPivot(null)

      if (!tableStillUsed) {
        nextCols = nextCols.filter((c) => c.table !== tableName)
        setAddedTables((tables) => tables.filter((t) => t !== tableName))
        setGroupBy((g) => g.filter((x) => x.table !== tableName))
        setHavings((h) => h.filter((x) => x.table !== tableName))
        setPivot((p) => (p && p.table === tableName ? null : p))
        setPivotRowAggs((a) => a.filter((x) => x.table !== tableName))
        setOrderBy((prev) =>
          prev
            .filter((ob) => {
              const c = gridColumns[ob.columnIndex]
              return c && c.table !== tableName
            })
            .map((ob) => {
              const c = gridColumns[ob.columnIndex]
              const newIdx = nextCols.findIndex((n) => n.table === c.table && n.column === c.column)
              return newIdx >= 0 ? { ...ob, columnIndex: newIdx } : null
            })
            .filter(Boolean)
        )
        setGridColumns(nextCols)
      } else {
        setOrderBy((prev) =>
          prev
            .filter((ob) => gridColumns[ob.columnIndex] && !(gridColumns[ob.columnIndex].table === tableName && gridColumns[ob.columnIndex].column === columnName))
            .map((ob) => (ob.columnIndex > removedIndex ? { ...ob, columnIndex: ob.columnIndex - 1 } : ob))
        )
        setGridColumns(syncAggFuncs(nextCols, groupBy.filter((g) => !(g.table === tableName && g.column === columnName))))
      }
      setCurrentPage(1)
    },
    [gridColumns, groupBy, pivot, syncAggFuncs]
  )

  /** 조인 해제: 해당 테이블 + 그 테이블 컬럼 제거, 조인 경로에서 끊긴 테이블도 자동 제거 */
  const removeJoinedTable = useCallback(
    (tableName) => {
      if (!addedTables.includes(tableName)) return
      const afterRemove = addedTables.filter((t) => t !== tableName)
      if (afterRemove.length === 0) {
        setAddedTables([])
        setGridColumns([])
        setFilters([])
        setGroupBy([])
        setHavings([])
        setPivot(null)
        setPivotRowAggs([])
        setOrderBy([])
        setCurrentPage(1)
        return
      }
      const reachable = getReachableTables(afterRemove[0], afterRemove, relationshipOptions)
      const tablesToRemove = afterRemove.filter((t) => !reachable.includes(t))
      const allRemoved = [tableName, ...tablesToRemove]
      const nextCols = gridColumns.filter((c) => !allRemoved.includes(c.table))
      setFilters((prev) => prev.filter((f) => !allRemoved.includes(f.table)))
      setGroupBy((prev) => prev.filter((g) => !allRemoved.includes(g.table)))
      setHavings((prev) => prev.filter((h) => !allRemoved.includes(h.table)))
      setPivotRowAggs((prev) => prev.filter((a) => !allRemoved.includes(a.table)))
      if (pivot && allRemoved.includes(pivot.table)) setPivot(null)
      setAddedTables(reachable)
      setOrderBy((prev) =>
        prev
          .filter((ob) => gridColumns[ob.columnIndex] && !allRemoved.includes(gridColumns[ob.columnIndex].table))
          .map((ob) => {
            const c = gridColumns[ob.columnIndex]
            const newIdx = nextCols.findIndex((n) => n.table === c.table && n.column === c.column)
            return newIdx >= 0 ? { ...ob, columnIndex: newIdx } : null
          })
          .filter(Boolean)
      )
      setGridColumns(nextCols)
      setCurrentPage(1)
    },
    [gridColumns, addedTables, groupBy, pivot, relationshipOptions]
  )

  const toggleGroupBy = useCallback(
    (table, column) => {
      setGroupBy((prev) => {
        const exists = prev.some((g) => g.table === table && g.column === column)
        if (exists) {
          const next = prev.filter((g) => !(g.table === table && g.column === column))
          setGridColumns((cols) => syncAggFuncs(cols, next))
          if (next.length === 0) setHavings([])
          return next
        }
        const next = [{ table, column }]
        setGridColumns((cols) => syncAggFuncs(cols, next))
        return next
      })
      setCurrentPage(1)
    },
    [syncAggFuncs]
  )

  const setDateGranularityFor = useCallback((table, column, granularity) => {
    const key = `${table}.${column}`
    setDateGranularity((prev) => {
      const current = prev[key]
      if (current === granularity) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: granularity }
    })
    setCurrentPage(1)
  }, [])

  const changeAggFuncFor = useCallback((table, column, newAgg) => {
    setGridColumns((prev) =>
      prev.map((c) => (c.table === table && c.column === column ? { ...c, aggFunc: newAgg } : c))
    )
    setHavings((prev) =>
      prev.map((h) => (h.table === table && h.column === column ? { ...h, aggFunc: newAgg } : h))
    )
    setCurrentPage(1)
  }, [])

  const addHaving = useCallback((having) => {
    setHavings((prev) => {
      const withOp = { ...having, logicalOperator: having.logicalOperator || 'AND' }
      const idx = prev.findIndex((h) => h.table === having.table && h.column === having.column && h.aggFunc === having.aggFunc)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = withOp
        return next
      }
      return [...prev, withOp]
    })
    setCurrentPage(1)
  }, [])

  const setHavingLogicalOperator = useCallback((index, logicalOperator) => {
    setHavings((prev) => prev.map((h, i) => (i === index ? { ...h, logicalOperator } : h)))
  }, [])

  const removeHaving = useCallback((index) => {
    setHavings((prev) => prev.filter((_, i) => i !== index))
    setCurrentPage(1)
  }, [])

  const setPivotFromValues = useCallback((table, column, values) => {
    setPivot({ table, column, values })
    setCurrentPage(1)
  }, [])

  const fetchAndSetPivot = useCallback(
    async (table, column) => {
      const alias = gridColumns.find((c) => c.table === table)?.alias
      if (!alias) return
      const sql = generateDistinctPivotSQL(table, column, gridColumns, addedTables, filters, tableRelationships, { joinConfigs, dateGranularity, joinOrder: joinOrderData?.join_order })
      if (!sql) {
        showToast('error', '피벗 값 조회 SQL 생성 실패')
        return
      }
      try {
        showToast('warning', '⏳ 피벗 값을 조회 중...')
        const res = await apiExecuteQuery(sql)
        const data = res.data || []
        const values = data.map((row) => row[`${alias}.${column}`] ?? row[column] ?? row[Object.keys(row)[0]]).filter((v) => v != null)
        if (values.length === 0) {
          showToast('error', '피벗 값을 찾을 수 없습니다')
          return
        }
        setPivotFromValues(table, column, values)
        showToast('success', `피벗축 설정 완료 (${values.length}개 값)`)
      } catch (e) {
        showToast('error', '피벗 값 조회 실패: ' + (e.message || ''))
      }
    },
    [gridColumns, addedTables, filters, tableRelationships, joinConfigs, dateGranularity, setPivotFromValues, showToast]
  )

  const removePivotCallback = useCallback(() => {
    setPivot(null)
    setPivotRowAggs([])
    setCurrentPage(1)
  }, [])

  const addPivotAgg = useCallback((agg) => {
    setPivotRowAggs((prev) => {
      if (prev.some((a) => a.table === agg.table && a.column === agg.column && a.aggFunc === agg.aggFunc)) return prev
      return [...prev, agg]
    })
    setCurrentPage(1)
  }, [])

  const removePivotAgg = useCallback((index) => {
    setPivotRowAggs((prev) => prev.filter((_, i) => i !== index))
    setCurrentPage(1)
  }, [])

  const addFilter = useCallback((filter) => {
    setFilters((prev) => [...prev, { ...filter, logicalOperator: filter.logicalOperator || 'AND' }])
    setCurrentPage(1)
  }, [])
  const setFilterLogicalOperator = useCallback((index, logicalOperator) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, logicalOperator } : f)))
  }, [])
  const removeFilter = useCallback((index) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
    setCurrentPage(1)
  }, [])
  const addOrderBy = useCallback((ob) => {
    setOrderBy((prev) => [...prev, ob])
    setCurrentPage(1)
  }, [])
  const removeOrderBy = useCallback((index) => {
    setOrderBy((prev) => prev.filter((_, i) => i !== index))
    setCurrentPage(1)
  }, [])

  const setPage = useCallback((p) => setCurrentPage(p), [])
  const setPageSizeOption = useCallback((size) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const copySql = useCallback(() => {
    if (!executedSql) {
      showToast('warning', '복사할 SQL이 없습니다')
      return
    }
    navigator.clipboard.writeText(executedSql).then(
      () => showToast('success', 'SQL이 클립보드에 복사되었습니다'),
      () => showToast('error', '복사 실패')
    )
  }, [executedSql, showToast])

  const runExplainSql = useCallback(async () => {
    if (!executedSql) {
      showToast('warning', '실행된 쿼리가 없습니다')
      return
    }
    setExplanation('loading')
    try {
      const data = await explainSql(executedSql)
      setExplanation(data.explanation || '')
      showToast('success', '해석 완료')
    } catch (e) {
      setExplanation('❌ 해석 실패: ' + (e.message || 'API 호출 실패'))
      showToast('error', 'Claude API 호출 실패')
    }
  }, [executedSql, showToast])

  const openSaveAsTableModal = useCallback(() => {
    if (!executedSql || !executedSql.trim()) {
      showToast('warning', '먼저 쿼리를 실행한 뒤 저장하세요.')
      return
    }
    setSaveAsTableName('')
    setShowSaveAsTableModal(true)
  }, [executedSql, showToast])

  const confirmSaveAsTable = useCallback(async () => {
    const name = (saveAsTableName || '').trim()
    if (!name) {
      showToast('warning', '테이블 이름을 입력하세요.')
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,116}$/.test(name)) {
      showToast('error', '테이블명은 영문, 숫자, 언더스코어만 사용 가능합니다. (저장 시 test_report_ 가 붙어 최대 116자)')
      return
    }
    setSaveAsTableSubmitting(true)
    try {
      const res = await saveQueryAsTable(name, executedSql)
      setShowSaveAsTableModal(false)
      setSaveAsTableName('')
      showToast('success', res.message || '저장이 대기열에 등록되었습니다. 백그라운드에서 처리됩니다.')
      const jobId = res.job_id
      if (jobId) {
        const maxPolls = 60
        let polls = 0
        const interval = setInterval(async () => {
          polls += 1
          if (polls > maxPolls) {
            clearInterval(interval)
            return
          }
          try {
            const statusRes = await getSaveQueryAsTableStatus(jobId)
            if (statusRes.status === 'completed') {
              clearInterval(interval)
              showToast('success', `테이블 "${statusRes.table_name || name}"이(가) 생성되었습니다.`)
            } else if (statusRes.status === 'failed') {
              clearInterval(interval)
              showToast('error', statusRes.error || '테이블 저장 실패')
            }
          } catch {
            // ignore poll errors
          }
        }, 2000)
      }
    } catch (e) {
      showToast('error', e.message || '테이블 저장 요청 실패')
    } finally {
      setSaveAsTableSubmitting(false)
    }
  }, [saveAsTableName, executedSql, showToast])

  const clearAll = useCallback(() => {
    lastSuccessWorkspaceRef.current = null
    setGridColumns([])
    setAddedTables([])
    setGroupBy([])
    setPivot(null)
    setPivotRowAggs([])
    setDateGranularity({})
    setHavings([])
    setFilters([])
    setOrderBy([])
    setJoinConditions({})
    setJoinTypes({})
    setJoinLogicalOperators({})
    setJoinOrderData(null)
    setResultData([])
    setCurrentPage(1)
    setTotalCount(null)
    setExecutedSql('')
    setExplanation(null)
    showToast('success', '초기화되었습니다')
  }, [showToast])

  const openColumnLabelsModal = useCallback(() => {
    if (gridColumns.length === 0) {
      showToast('info', '먼저 그리드에 표시할 컬럼을 선택한 뒤 표시명 편집을 사용할 수 있습니다.')
      return
    }
    const byTable = {}
    gridColumns.forEach((c) => {
      if (!byTable[c.table]) byTable[c.table] = []
      byTable[c.table].push(c)
    })
    const tableLabels = {}
    const columnLabelsByTable = {}
    Object.keys(byTable).forEach((tableName) => {
      const t = tables.find((x) => x.table_name === tableName)
      tableLabels[tableName] = t?.table_label ?? t?.table_name ?? tableName
      columnLabelsByTable[tableName] = {}
      byTable[tableName].forEach((col) => {
        columnLabelsByTable[tableName][col.column] = col.label ?? col.column ?? ''
      })
    })
    setTableLabelsDraft(tableLabels)
    setColumnLabelsByTableDraft(columnLabelsByTable)
    setShowColumnLabelsModal(true)
  }, [tables, gridColumns, showToast])

  const saveColumnLabelsAndClose = useCallback(async () => {
    const tableNames = Object.keys(columnLabelsByTableDraft)
    if (tableNames.length === 0) return
    setColumnLabelsSaving(true)
    try {
      for (const tableName of tableNames) {
        await saveColumnLabels(
          tableName,
          columnLabelsByTableDraft[tableName] || {},
          tableLabelsDraft[tableName] != null ? tableLabelsDraft[tableName] : undefined
        )
      }
      const descs = await Promise.all(tableNames.map((name) => describeTable(name)))
      const tableLabelByName = { ...tableLabelsDraft }
      setTables((prev) =>
        prev.map((t) => {
          const idx = tableNames.indexOf(t.table_name)
          if (idx === -1) return t
          const desc = descs[idx]
          return { ...t, table_label: tableLabelByName[t.table_name] ?? t.table_name, columns: desc?.columns || t.columns }
        })
      )
      setGridColumns((prev) =>
        prev.map((c) => ({
          ...c,
          label: (columnLabelsByTableDraft[c.table] && columnLabelsByTableDraft[c.table][c.column]) ?? c.label ?? c.column
        }))
      )
      setShowColumnLabelsModal(false)
      showToast('success', '표시명이 저장되었습니다. DB 테이블·컬럼명은 변경되지 않았습니다.')
    } catch (e) {
      showToast('error', e.message || '라벨 저장 실패')
    } finally {
      setColumnLabelsSaving(false)
    }
  }, [tableLabelsDraft, columnLabelsByTableDraft, showToast])

  return (
    <>
      <div className="qs-page">
        <PageHeader description="왼쪽에서 테이블·컬럼을 끌어 그리드에 놓고, 조건을 구성한 뒤 실행합니다." />
        <div className="container query-studio qs-page__workspace">
        <Sidebar
          tables={tables}
          onOpenColumnLabelsModal={openColumnLabelsModal}
          tableRelationships={tableRelationships}
          relationshipOptions={relationshipOptions}
          addedTables={addedTables}
          loading={loading}
          dbStatus={dbStatus}
          onRefreshTables={async () => {
            setToast(null)
            const res = await loadTables((msg) => setToast({ type: 'error', msg }))
            if (res?.ok) setToast({ type: 'success', msg: '테이블 목록을 새로고침했습니다.' })
          }}
          onRefreshDbStatus={async () => {
            await loadHealth()
            setToast({ type: 'success', msg: 'DB 상태를 확인했습니다.' })
          }}
        />
        <MainArea
          gridColumns={gridColumns}
          addedTables={addedTables}
          joinOrder={joinOrderData?.join_order}
          joinAccuracy={joinOrderData?.join_accuracy}
          relationshipOptions={relationshipOptions}
          joinConditions={joinConditions}
          joinTypes={joinTypes}
          onSetJoinConditions={setJoinConditionsForPair}
          onSetJoinConditionAt={setJoinConditionAt}
          onAddJoinCondition={addJoinCondition}
          onRemoveJoinCondition={removeJoinCondition}
          onRemoveJoinedTable={removeJoinedTable}
          onSetJoinType={setJoinTypeForPair}
          joinLogicalOperators={joinLogicalOperators}
          onSetJoinLogicalOperator={setJoinLogicalOperatorForPair}
          groupBy={groupBy}
          pivot={pivot}
          pivotRowAggs={pivotRowAggs}
          dateGranularity={dateGranularity}
          havings={havings}
          filters={filters}
          orderBy={orderBy}
          resultData={resultData}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          countLoading={countLoading}
          onFetchTotalCount={runFetchTotalCount}
          executedSql={executedSql}
          explanation={explanation}
          onAddColumn={addColumn}
          onAddTableColumns={addTableColumns}
          onRemoveColumn={removeColumn}
          onMoveColumn={moveColumn}
          onExecute={runExecuteQuery}
          queryRunning={queryRunning}
          onClearAll={clearAll}
          onToggleGroupBy={toggleGroupBy}
          onSetDateGranularity={setDateGranularityFor}
          onChangeAggFunc={changeAggFuncFor}
          onAddHaving={addHaving}
          onRemoveHaving={removeHaving}
          onHavingLogicalOpChange={setHavingLogicalOperator}
          onFetchAndSetPivot={fetchAndSetPivot}
          onRemovePivot={removePivotCallback}
          onAddPivotAgg={addPivotAgg}
          onRemovePivotAgg={removePivotAgg}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onFilterLogicalOpChange={setFilterLogicalOperator}
          onAddOrderBy={addOrderBy}
          onRemoveOrderBy={removeOrderBy}
          onSetPage={setPage}
          onSetPageSize={setPageSizeOption}
          onCopySql={copySql}
          onExplainSql={runExplainSql}
          onCloseExplanation={() => setExplanation(null)}
          onOpenSaveAsTableModal={openSaveAsTableModal}
          autoExecute={autoExecute}
          onToggleAutoExecute={() => setAutoExecute((v) => !v)}
        />
        </div>
      </div>
      {showColumnLabelsModal && (
        <div
          className="relationship-diagram-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="컬럼 라벨 편집"
          onClick={() => setShowColumnLabelsModal(false)}
        >
          <div className="relationship-diagram-modal" style={{ minWidth: 360, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="relationship-diagram-header">
              <span>표시명 편집</span>
              <button type="button" className="relationship-diagram-close" onClick={() => setShowColumnLabelsModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="relationship-diagram-body">
              <p style={{ marginBottom: 12, padding: 8, background: 'var(--bg-muted, #f1f5f9)', borderRadius: 6, fontSize: 12, color: 'var(--text-light)' }}>
                <strong>DB 테이블·컬럼명은 변경되지 않습니다.</strong> 화면에 보이는 표시명만 수정합니다. 비워두면 물리명이 표시됩니다.
              </p>
              <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                {Object.keys(columnLabelsByTableDraft).map((tableName) => (
                  <div key={tableName} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-light)', fontFamily: 'monospace', marginBottom: 2 }}>테이블 물리명 (변경 불가): {tableName}</span>
                      <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 11 }}>표시 라벨 (화면에만 표시)</label>
                      <input
                        type="text"
                        value={tableLabelsDraft[tableName] ?? ''}
                        onChange={(e) => setTableLabelsDraft((prev) => ({ ...prev, [tableName]: e.target.value }))}
                        placeholder={`예: ${tableName} → 캠페인 목록`}
                        style={{ width: '100%', padding: 6, fontSize: 12 }}
                      />
                    </div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 11 }}>컬럼 표시 라벨</label>
                    {Object.keys(columnLabelsByTableDraft[tableName] || {}).map((colName) => (
                      <div key={colName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ flex: '0 0 110px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-light)' }} title="물리명">{colName}</span>
                        <span style={{ color: 'var(--text-light)', fontSize: 12 }}>→</span>
                        <input
                          type="text"
                          value={columnLabelsByTableDraft[tableName][colName] ?? ''}
                          onChange={(e) =>
                            setColumnLabelsByTableDraft((prev) => ({
                              ...prev,
                              [tableName]: { ...(prev[tableName] || {}), [colName]: e.target.value }
                            }))
                          }
                          placeholder={colName}
                          style={{ flex: 1, padding: 6, fontSize: 12 }}
                          title="비워두면 물리명 표시"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="save-as-table-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-small secondary" onClick={() => setShowColumnLabelsModal(false)}>취소</button>
                <button type="button" className="btn-small primary" onClick={saveColumnLabelsAndClose} disabled={columnLabelsSaving}>
                  {columnLabelsSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showJoinImpossibleModal && (
        <div
          className="relationship-diagram-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="조인 불가"
          onClick={() => setShowJoinImpossibleModal(false)}
        >
          <div className="relationship-diagram-modal join-impossible-modal" onClick={(e) => e.stopPropagation()}>
            <div className="relationship-diagram-header">
              <span>⚠️ 조인 불가</span>
              <button type="button" className="relationship-diagram-close" onClick={() => setShowJoinImpossibleModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="relationship-diagram-body">
              <p className="join-impossible-message">조인 불가능한 컬럼입니다.</p>
              <p className="join-impossible-hint">현재 선택한 테이블들과 조인 경로가 없습니다. 사이드바에는 조인 가능한 테이블만 표시됩니다.</p>
              <div className="save-as-table-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn-small primary" onClick={() => setShowJoinImpossibleModal(false)}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSaveAsTableModal && (
        <div
          className="relationship-diagram-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="쿼리 결과를 테이블로 저장"
          onClick={() => !saveAsTableSubmitting && setShowSaveAsTableModal(false)}
        >
          <div className="relationship-diagram-modal save-as-table-modal" onClick={(e) => e.stopPropagation()}>
            <div className="relationship-diagram-header">
              <span>💾 쿼리 결과를 테이블로 저장</span>
              <button type="button" className="relationship-diagram-close" onClick={() => !saveAsTableSubmitting && setShowSaveAsTableModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="relationship-diagram-body">
              <p className="save-as-table-caption">실행했던 쿼리 결과가 지정한 이름의 테이블로 생성됩니다. 저장 시 <strong>test_report_</strong> 접두사가 자동으로 붙습니다.</p>
              <label className="save-as-table-label">
                테이블 이름 (영문, 숫자, 언더스코어)
                <input
                  type="text"
                  className="save-as-table-input"
                  value={saveAsTableName}
                  onChange={(e) => setSaveAsTableName(e.target.value)}
                  placeholder="예: my_report_202501 → test_report_my_report_202501"
                  disabled={saveAsTableSubmitting}
                  autoFocus
                />
              </label>
              <div className="save-as-table-actions">
                <button type="button" className="btn-small" onClick={() => !saveAsTableSubmitting && setShowSaveAsTableModal(false)} disabled={saveAsTableSubmitting}>취소</button>
                <button type="button" className="btn-small primary" onClick={confirmSaveAsTable} disabled={saveAsTableSubmitting || !saveAsTableName.trim()}>
                  {saveAsTableSubmitting ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.type} show`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
