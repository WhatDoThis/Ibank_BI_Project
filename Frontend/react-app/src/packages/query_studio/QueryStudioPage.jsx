/**
 * query_studio/QueryStudioPage.jsx (쿼리 스튜디오·쿼리 빌더 페이지)
 * ================================================================
 * 노코드 쿼리 빌더. 그리드·테이블/컬럼·필터·GROUP BY·피벗·HAVING·정렬·실행·페이지네이션·JOIN 설정·Claude 해석·저장.
 *
 * [Main Functions]
 * ===========
 * 1. 상태: addedTables, gridColumns, filters, orderBy, groupBy, pivot, havings, joinMode, relationshipOptions, joinConditions, joinTypes, joinOrderData, resultData, explanation, pagination. SQL 문자열은 빌더 상태로부터 useMemo(workspaceSql)로 항상 최신 반영. 실행 성공 시 lastSuccessWorkspaceRef 스냅샷, 실패 시 빌더·결과 원상복구
 * 2. runExecuteQuery, runExplainSql, 초기화(clearAll). describeTable, tableRelationships, joinOrder, executeQuery, explainSql, saveQueryAsTable API 호출 (main_db만)
 * 3. QueryStudioPage: Sidebar, MainArea에 props 전달. generateSQL, generateCountSQL, canAddTableSafely, validateJoinPath, getReachableTables 등 utils 연동
 * 4. /me project_info_id 변경(헤더 프로젝트 전환): resetBuilderState·테이블 재로드·안내 토스트
 * 5. 참여 프로젝트 목록 갱신(nonce): 테이블 목록만 loadTables(빌더·실행 결과 유지)
 *
 * [Dependencies]
 * =========
 * - React, app/auth/AuthContext(useAuth), @/packages/query_studio/api/queryStudioClient.js, @/shared/config/api, query_studio/utils·components (Sidebar, MainArea)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './queryStudio.css'
import { describeTable, tableRelationships as fetchTableRelationships, joinOrder as fetchJoinOrder, executeQuery as apiExecuteQuery, explainSql, estimateQueryResultSize, saveQueryAsTable, getSaveQueryAsTableStatus, saveColumnLabels } from '@/packages/query_studio/api/queryStudioClient.js'
import { getTableRelationshipsMode } from '@/shared/config/api.js'
import { useQueryStudioData } from './hooks/useQueryStudioData'
import {
  generateSQL,
  generateCountSQL,
  generateDistinctPivotSQL,
  getResultColumnKey,
  buildSaveTableColumnPlan,
  buildSaveTableMaterializedSelect,
} from './utils/sqlBuilder'
import { findAttachPlan } from './utils/joinRules'
import { canAddTableSafely, validateJoinPath, getReachableTables } from './utils/safetyCheck'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import { PageHeader } from '@/app/layout/PageHeader.jsx'
import { useAuth } from '@/app/auth/AuthContext.jsx'

const DEFAULT_PAGE_SIZE = 100

/** 조인으로 새 테이블이 붙을 때 확인창을 띄울 최소 크기(pg_total_relation_size, 바이트) */
const LARGE_JOIN_TABLE_BYTES = 100 * 1024 * 1024

function getOversizedTablesForJoin(newTableNames, tablesList, thresholdBytes) {
  const out = []
  for (const name of newTableNames) {
    const meta = tablesList.find((t) => t.table_name === name)
    const bytes = meta?.size_bytes
    if (!meta || typeof bytes !== 'number' || bytes < thresholdBytes) continue
    out.push({
      table_name: name,
      label: meta.table_label ?? name,
      size: meta.size ?? null,
      size_bytes: bytes,
    })
  }
  return out
}

function formatEstimatedRows(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return String(n)
  return x.toLocaleString('ko-KR')
}

/** GET table-relationships 응답 relationships[] → relationshipOptions 맵 */
function buildRelationshipOptionsFromRels(rels) {
  const opts = {}
  const seen = new Set()
  for (const r of rels || []) {
    const fromTable = r.from_table
    const toTable = r.to_table
    const prevCol = r.from_column
    const currCol = r.to_column
    if (prevCol === 'id' && currCol === 'id') continue
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
        role: r.role,
        source: r.source,
      })
    }
    push(`${fromTable}||${toTable}`, prevCol, currCol)
    push(`${toTable}||${fromTable}`, currCol, prevCol)
  }
  return opts
}

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
    resultData: cloneRows(o.resultData),
    totalCount: o.totalCount,
  }
}

// 2.
export default function QueryStudioPage() {
  const { me, participatingProjectsNonce } = useAuth()
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
  const [explanation, setExplanation] = useState(null)
  const [toast, setToast] = useState(null)
  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false)
  const [saveAsTableName, setSaveAsTableName] = useState('')
  const [saveAsTableSubmitting, setSaveAsTableSubmitting] = useState(false)
  /** 저장 모달: EXPLAIN 기반 예상 행·크기 — { loading } | { error } | API 응답 필드 */
  const [saveTableEstimate, setSaveTableEstimate] = useState(null)
  const [showJoinImpossibleModal, setShowJoinImpossibleModal] = useState(false)
  /** 대용량 테이블 조인 확인: { tables: [{ table_name, label, size, size_bytes }] } */
  const [largeTableJoinConfirm, setLargeTableJoinConfirm] = useState(null)
  const [showColumnLabelsModal, setShowColumnLabelsModal] = useState(false)
  const [autoExecute, setAutoExecute] = useState(true)
  /** 선택된 컬럼 기준: 테이블별 테이블 라벨 draft */
  const [tableLabelsDraft, setTableLabelsDraft] = useState({}) // { tableName: label }
  /** 선택된 컬럼 기준: 테이블별 컬럼 라벨 draft */
  const [columnLabelsByTableDraft, setColumnLabelsByTableDraft] = useState({}) // { tableName: { columnName: label } }
  const [columnLabelsSaving, setColumnLabelsSaving] = useState(false)
  const [joinMode, setJoinMode] = useState(() => getTableRelationshipsMode()) // config: frontend.table_relationships_mode (예: all)
  const [relationshipOptions, setRelationshipOptions] = useState({}) // { key: [ { prevColumn, currColumn, confidence?, reason? } ] }
  const [joinConditions, setJoinConditions] = useState({}) // { key: [ { prevColumn, currColumn }, ... ] } 복합 조건
  const [joinTypes, setJoinTypes] = useState({}) // { key: 'LEFT'|'INNER'|'RIGHT' }
  const [joinLogicalOperators, setJoinLogicalOperators] = useState({}) // { key: 'AND'|'OR' } 조건 간 연결
  const [joinOrderData, setJoinOrderData] = useState(null) // { join_order: [{ table, from_table, from_column, to_table, to_column }] } — A→B, A→C 브랜치
  const [queryRunning, setQueryRunning] = useState(false)
  const [countLoading, setCountLoading] = useState(false)

  const lastSuccessWorkspaceRef = useRef(null)
  const largeJoinProceedRef = useRef(null)
  /** table-relationships 병렬 요청 시 마지막 응답만 반영 */
  const relationshipFetchGenRef = useRef(0)

  /** 목록 새로고침만으로 tables 참조가 바뀌어도 내용이 같으면 동일 문자열 → tableRelationships·자동 실행 effect 불필요 갱신 방지 */
  const tableNamesKey = useMemo(() => {
    const names = tables.map((t) => t.table_name).filter(Boolean)
    return names.length ? [...names].sort().join('\x1e') : ''
  }, [tables])

  const tableRelationships = useMemo(() => {
    const resolved = {}
    if (tableNamesKey) {
      for (const name of tableNamesKey.split('\x1e')) {
        resolved[name] = {}
      }
    }
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
  }, [tableNamesKey, relationshipOptions, joinConditions])

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

  /** 실행 여부와 무관하게 현재 빌더 조건 기준 SELECT (표시·복사·저장·해석 공통) */
  const workspaceSql = useMemo(() => {
    if (gridColumns.length === 0) return ''
    try {
      const options = {
        groupBy,
        dateGranularity,
        havings,
        pivot,
        pivotRowAggs,
        joinConfigs,
        joinOrder: joinOrderData?.join_order,
      }
      return generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, options)
    } catch {
      return ''
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
  ])

  const loadRelationshipOptions = useCallback(() => {
    const gen = ++relationshipFetchGenRef.current
    return fetchTableRelationships(joinMode)
      .then((relData) => {
        if (gen !== relationshipFetchGenRef.current) return
        setRelationshipOptions(buildRelationshipOptionsFromRels(relData?.relationships || []))
      })
      .catch(() => {
        if (gen !== relationshipFetchGenRef.current) return
        setRelationshipOptions({})
      })
  }, [joinMode])

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
    if (!tableNamesKey) return
    void loadRelationshipOptions()
  }, [joinMode, tableNamesKey, loadRelationshipOptions])

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

  const cancelLargeTableJoin = useCallback(() => {
    largeJoinProceedRef.current = null
    setLargeTableJoinConfirm(null)
  }, [])

  const confirmLargeTableJoin = useCallback(() => {
    const fn = largeJoinProceedRef.current
    largeJoinProceedRef.current = null
    setLargeTableJoinConfirm(null)
    fn?.()
  }, [])

  /** toastMessage 없으면 토스트 없음 — 헤더 프로젝트 전환 시 초기 단계용 */
  const resetBuilderState = useCallback((toastType, toastMessage) => {
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
    setRelationshipOptions({})
    setResultData([])
    setCurrentPage(1)
    setTotalCount(null)
    setExplanation(null)
    setShowSaveAsTableModal(false)
    setSaveAsTableName('')
    setShowJoinImpossibleModal(false)
    setShowColumnLabelsModal(false)
    setTableLabelsDraft({})
    setColumnLabelsByTableDraft({})
    setQueryRunning(false)
    setCountLoading(false)
    if (toastMessage) showToast(toastType, toastMessage)
  }, [showToast])

  const prevProjectIdRef = useRef(undefined)
  const participatingProjectsNonceRef = useRef(null)

  useEffect(() => {
    if (me == null) return
    const raw = me.project_info_id
    const pid = raw != null && raw !== '' ? String(raw) : ''

    if (prevProjectIdRef.current === undefined) {
      prevProjectIdRef.current = pid
      return
    }
    if (prevProjectIdRef.current === pid) return

    prevProjectIdRef.current = pid

    let cancelled = false
    resetBuilderState(null, null)

    ;(async () => {
      await loadHealth()
      const res = await loadTables((msg) => {
        if (!cancelled) setToast({ type: 'error', msg })
      })
      if (cancelled) return
      if (res.ok === false && res.error) {
        setDbStatus((prev) => (prev.ok === null ? { ok: false, message: 'DB 연결 안됨' } : prev))
      }
      showToast('info', '작업 프로젝트가 변경되어 쿼리 빌더를 초기화했습니다.')
    })()

    return () => {
      cancelled = true
    }
  }, [me, me?.project_info_id, resetBuilderState, loadHealth, loadTables, showToast, setDbStatus])

  /** 헤더 등에서 참여 프로젝트 목록이 갱신된 뒤(매핑 변경 등) 테이블 목록만 서버와 동기화 */
  useEffect(() => {
    if (participatingProjectsNonceRef.current === null) {
      participatingProjectsNonceRef.current = participatingProjectsNonce
      return
    }
    if (participatingProjectsNonceRef.current === participatingProjectsNonce) return
    participatingProjectsNonceRef.current = participatingProjectsNonce
    let cancelled = false
    ;(async () => {
      await loadHealth()
      const res = await loadTables((msg) => {
        if (!cancelled) setToast({ type: 'error', msg })
      })
      if (cancelled) return
      if (res.ok === false && res.error) {
        setDbStatus((prev) => (prev.ok === null ? { ok: false, message: 'DB 연결 안됨' } : prev))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [participatingProjectsNonce, loadHealth, loadTables, setDbStatus])

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
      } else {
        const plan = findAttachPlan(addedTables, columnInfo.table, relationshipOptions)
        if (!plan) {
          setShowJoinImpossibleModal(true)
          return
        }
        newAddedTables = plan.newAddedTables
        intermediateParent = plan.intermediateParent
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

      const newNames = newAddedTables.filter((t) => !addedTables.includes(t))
      const oversized = getOversizedTablesForJoin(newNames, tables, LARGE_JOIN_TABLE_BYTES)

      const proceed = () => {
        const tableAliasMap = {}
        newAddedTables.forEach((t, i) => {
          tableAliasMap[t] = 't' + (i + 1)
        })
        const alias = tableAliasMap[columnInfo.table] || 't1'
        const isGB = isGroupByColumn(groupBy, columnInfo.table, columnInfo.column)
        const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null
        setAddedTables(newAddedTables)
        setGridColumns((prev) =>
          syncAggFuncs(
            [
              ...prev,
              {
                table: columnInfo.table,
                column: columnInfo.column,
                alias,
                type: columnInfo.type,
                aggFunc,
                label: columnInfo.label ?? columnInfo.column,
                ...(columnInfo.logical_key || columnInfo.outputKey
                  ? { outputKey: String(columnInfo.logical_key || columnInfo.outputKey).trim() }
                  : {}),
                ...(columnInfo.logical_key
                  ? { pgCommentRoot: String(columnInfo.logical_key).trim() }
                  : {}),
                ...(columnInfo.source_table ? { sourceTable: columnInfo.source_table } : {}),
                ...(columnInfo.source_column ? { sourceColumn: columnInfo.source_column } : {}),
              },
            ],
            groupBy
          )
        )
        setCurrentPage(1)
        if (intermediateParent) {
          showToast('success', `'${intermediateParent}' 테이블을 거쳐 '${columnInfo.table}'를 추가했습니다`)
        } else {
          showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
        }
        if (!tableAlreadyAdded) void loadRelationshipOptions()
      }

      if (!tableAlreadyAdded && oversized.length > 0) {
        largeJoinProceedRef.current = proceed
        setLargeTableJoinConfirm({ tables: oversized })
        return
      }
      proceed()
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions, tables, loadRelationshipOptions]
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
      } else {
        const plan = findAttachPlan(addedTables, tableName, relationshipOptions)
        if (!plan) {
          setShowJoinImpossibleModal(true)
          return
        }
        newAddedTables = plan.newAddedTables
        intermediateParent = plan.intermediateParent
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

      const newNames = newAddedTables.filter((t) => !addedTables.includes(t))
      const oversized = getOversizedTablesForJoin(newNames, tables, LARGE_JOIN_TABLE_BYTES)

      const proceed = () => {
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
            ...(c.logical_key ? { outputKey: String(c.logical_key).trim() } : {}),
            ...(c.logical_key ? { pgCommentRoot: String(c.logical_key).trim() } : {}),
            ...(c.source_table ? { sourceTable: c.source_table } : {}),
            ...(c.source_column ? { sourceColumn: c.source_column } : {}),
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
        if (!tableAlreadyAdded) void loadRelationshipOptions()
      }

      if (!tableAlreadyAdded && oversized.length > 0) {
        largeJoinProceedRef.current = proceed
        setLargeTableJoinConfirm({ tables: oversized })
        return
      }
      proceed()
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions, tables, loadRelationshipOptions]
  )

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
    const priorResult = resultData
    const priorTotal = totalCount
    setQueryRunning(true)
    try {
      setTotalCount(null)
      const options = { groupBy, dateGranularity, havings, pivot, pivotRowAggs, joinConfigs, joinOrder: joinOrderData?.join_order }
      // 1) 현재 조건 기준 SQL 생성 후 실행 (joinOrder 있으면 A→B, A→C 브랜치 지원). 전체 건수 COUNT는 별도 버튼으로만 실행.
      const sql = generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, options)

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
        setResultData(typeof structuredClone === 'function' ? structuredClone(snap.resultData) : JSON.parse(JSON.stringify(snap.resultData || [])))
        setTotalCount(snap.totalCount)
        setExplanation(null)
      } else {
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
  }, [
    autoExecute,
    gridColumns,
    addedTables,
    filters,
    orderBy,
    currentPage,
    pageSize,
    joinOrderData,
    pivot,
    pivotRowAggs,
    havings,
    groupBy,
    dateGranularity,
    joinConditions,
    joinTypes,
    joinLogicalOperators,
    tableRelationships,
    joinConfigs,
    relationshipOptions,
  ])

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
        const pivotCol = { table, column, alias }
        const rk = getResultColumnKey(pivotCol, [], dateGranularity)
        const values = data.map((row) => row[rk] ?? row[`${alias}.${column}`] ?? row[column] ?? row[Object.keys(row)[0]]).filter((v) => v != null)
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
    [gridColumns, addedTables, filters, tableRelationships, joinConfigs, dateGranularity, joinOrderData, setPivotFromValues, showToast]
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
    if (!workspaceSql) {
      showToast('warning', '복사할 SQL이 없습니다')
      return
    }
    navigator.clipboard.writeText(workspaceSql).then(
      () => showToast('success', 'SQL이 클립보드에 복사되었습니다'),
      () => showToast('error', '복사 실패')
    )
  }, [workspaceSql, showToast])

  const runExplainSql = useCallback(async () => {
    if (!workspaceSql) {
      showToast('warning', '표시할 SQL이 없습니다')
      return
    }
    setExplanation('loading')
    try {
      const data = await explainSql(workspaceSql)
      setExplanation(data.explanation || '')
      showToast('success', '해석 완료')
    } catch (e) {
      setExplanation('❌ 해석 실패: ' + (e.message || 'API 호출 실패'))
      showToast('error', 'Claude API 호출 실패')
    }
  }, [workspaceSql, showToast])

  /** 테이블로 저장 시 워커에 넘기는 materialized SELECT·코멘트 힌트 (모달 추정·저장 확인 공통) */
  const getSaveTableSqlBundle = useCallback(() => {
    const saveOpts = {
      groupBy,
      dateGranularity,
      havings,
      pivot,
      pivotRowAggs,
      joinConfigs,
      joinOrder: joinOrderData?.join_order,
    }
    const { innerKeys, column_comment_hints } = buildSaveTableColumnPlan(gridColumns, groupBy, dateGranularity, saveOpts)
    const sqlForSave = generateSQL(
      gridColumns,
      addedTables,
      filters,
      orderBy,
      currentPage,
      pageSize,
      tableRelationships,
      { ...saveOpts, saveAsTableSelectKeys: innerKeys }
    )
    const materializedSql = buildSaveTableMaterializedSelect(sqlForSave, innerKeys)
    return { materializedSql, column_comment_hints }
  }, [
    gridColumns,
    groupBy,
    dateGranularity,
    havings,
    pivot,
    pivotRowAggs,
    joinConfigs,
    joinOrderData,
    addedTables,
    filters,
    orderBy,
    currentPage,
    pageSize,
    tableRelationships,
  ])

  useEffect(() => {
    if (!showSaveAsTableModal) {
      setSaveTableEstimate(null)
      return
    }
    let cancelled = false
    setSaveTableEstimate({ loading: true })
    let bundle
    try {
      bundle = getSaveTableSqlBundle()
    } catch (e) {
      setSaveTableEstimate({ loading: false, error: e?.message || 'SQL 생성 실패' })
      return
    }
    const sql = bundle?.materializedSql
    if (!sql || !String(sql).trim()) {
      setSaveTableEstimate({ loading: false, error: '저장용 SQL이 비어 있습니다.' })
      return
    }
    estimateQueryResultSize(sql)
      .then((res) => {
        if (cancelled) return
        setSaveTableEstimate({ loading: false, ...res })
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e?.message || e?.error || String(e)
        setSaveTableEstimate({ loading: false, error: msg || '추정 실패' })
      })
    return () => {
      cancelled = true
    }
  }, [showSaveAsTableModal, getSaveTableSqlBundle])

  const openSaveAsTableModal = useCallback(() => {
    if (!workspaceSql || !workspaceSql.trim()) {
      showToast('warning', '저장할 SQL이 없습니다. 컬럼을 추가하거나 조건을 확인하세요.')
      return
    }
    setSaveAsTableName('')
    setShowSaveAsTableModal(true)
  }, [workspaceSql, showToast])

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
      const { materializedSql, column_comment_hints } = getSaveTableSqlBundle()
      const res = await saveQueryAsTable(name, materializedSql, column_comment_hints)
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
              let errMsg = statusRes.error || '테이블 저장 실패'
              if (errMsg.length > 900) {
                errMsg = errMsg.slice(0, 900) + '…'
              }
              showToast('error', errMsg)
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
  }, [
    saveAsTableName,
    showToast,
    getSaveTableSqlBundle,
  ])

  const clearAll = useCallback(() => {
    resetBuilderState('success', '초기화되었습니다')
  }, [resetBuilderState])

  /** 왼쪽 목록 테이블 행 ⚙ — 해당 테이블 전체 컬럼 표시명 편집 (미지정 시 물리명·목록 기본값) */
  const openTableLabelsModal = useCallback(
    (tableName) => {
      const name = (tableName || '').trim()
      if (!name) return
      const t = tables.find((x) => x.table_name === name)
      if (!t) {
        showToast('warning', '테이블을 찾을 수 없습니다. 목록을 새로고침해 보세요.')
        return
      }
      const cols = t.columns || []
      const colDraft = {}
      cols.forEach((c) => {
        colDraft[c.name] = c.label ?? c.name ?? ''
      })
      setTableLabelsDraft({ [name]: t.table_label ?? t.table_name ?? name })
      setColumnLabelsByTableDraft({ [name]: colDraft })
      setShowColumnLabelsModal(true)
    },
    [tables, showToast]
  )

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

  const columnLabelsModalTableName =
    showColumnLabelsModal && Object.keys(columnLabelsByTableDraft).length > 0
      ? Object.keys(columnLabelsByTableDraft)[0]
      : null

  return (
    <>
      <div className="qs-page">
        <PageHeader description="왼쪽에서 테이블·컬럼을 끌어 그리드에 놓고, 조건을 구성한 뒤 실행합니다." />
        <div className="container query-studio qs-page__workspace">
        <Sidebar
          tables={tables}
          onOpenTableLabelsModal={openTableLabelsModal}
          tableRelationships={tableRelationships}
          relationshipOptions={relationshipOptions}
          addedTables={addedTables}
          loading={loading}
          dbStatus={dbStatus}
          onRefreshSidebar={async () => {
            setToast(null)
            await loadHealth()
            const res = await loadTables((msg) => setToast({ type: 'error', msg }))
            if (res?.ok) setToast({ type: 'success', msg: '새로고침했습니다.' })
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
          executedSql={workspaceSql}
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
      {showColumnLabelsModal && columnLabelsModalTableName && (
        <div
          className="relationship-diagram-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`표시명 편집 ${columnLabelsModalTableName}`}
          onClick={() => setShowColumnLabelsModal(false)}
        >
          <div className="relationship-diagram-modal" style={{ minWidth: 360, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="relationship-diagram-header">
              <span>표시명 — {columnLabelsModalTableName}</span>
              <button type="button" className="relationship-diagram-close" onClick={() => setShowColumnLabelsModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="relationship-diagram-body">
              <p style={{ marginBottom: 12, padding: 8, background: 'var(--bg-muted, #f1f5f9)', borderRadius: 6, fontSize: 12, color: 'var(--text-light)' }}>
                <strong>DB 테이블·컬럼명은 변경되지 않습니다.</strong> 왼쪽 목록·그리드에 보이는 이름만 바꿉니다. 비우면 물리명이 표시됩니다.
              </p>
              <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-light)', fontFamily: 'monospace', marginBottom: 2 }}>
                    테이블 물리명 (변경 불가): {columnLabelsModalTableName}
                  </span>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 11 }}>테이블 표시 라벨</label>
                  <input
                    type="text"
                    value={tableLabelsDraft[columnLabelsModalTableName] ?? ''}
                    onChange={(e) =>
                      setTableLabelsDraft((prev) => ({ ...prev, [columnLabelsModalTableName]: e.target.value }))
                    }
                    placeholder={columnLabelsModalTableName}
                    style={{ width: '100%', padding: 6, fontSize: 12 }}
                  />
                </div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 11 }}>컬럼 표시 라벨</label>
                {Object.keys(columnLabelsByTableDraft[columnLabelsModalTableName] || {}).map((colName) => (
                  <div key={colName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ flex: '0 0 110px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-light)' }} title="물리명">
                      {colName}
                    </span>
                    <span style={{ color: 'var(--text-light)', fontSize: 12 }}>→</span>
                    <input
                      type="text"
                      value={columnLabelsByTableDraft[columnLabelsModalTableName][colName] ?? ''}
                      onChange={(e) =>
                        setColumnLabelsByTableDraft((prev) => ({
                          ...prev,
                          [columnLabelsModalTableName]: {
                            ...(prev[columnLabelsModalTableName] || {}),
                            [colName]: e.target.value
                          }
                        }))
                      }
                      placeholder={colName}
                      style={{ flex: 1, padding: 6, fontSize: 12 }}
                      title="비워두면 물리명 표시"
                    />
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
      {largeTableJoinConfirm && (
        <div
          className="relationship-diagram-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="대용량 테이블 조인 확인"
          onClick={cancelLargeTableJoin}
        >
          <div className="relationship-diagram-modal join-impossible-modal" onClick={(e) => e.stopPropagation()}>
            <div className="relationship-diagram-header">
              <span>대용량 테이블 조인</span>
              <button type="button" className="relationship-diagram-close" onClick={cancelLargeTableJoin} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="relationship-diagram-body">
              <p className="join-impossible-message">
                아래 테이블은 전체 크기가 약 {LARGE_JOIN_TABLE_BYTES / (1024 * 1024)}MB 이상입니다. 조인하면 스캔·메모리 부하가 커질 수 있습니다. 그래도
                추가할까요?
              </p>
              <ul className="large-join-confirm-list" style={{ margin: '8px 0', paddingLeft: 20 }}>
                {largeTableJoinConfirm.tables.map((row) => (
                  <li key={row.table_name}>
                    <strong>{row.label}</strong> ({row.table_name}) — {row.size ?? '용량 정보 없음'}
                  </li>
                ))}
              </ul>
              <div className="save-as-table-actions" style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-small secondary" onClick={cancelLargeTableJoin}>
                  취소
                </button>
                <button type="button" className="btn-small primary" onClick={confirmLargeTableJoin}>
                  추가
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
              <div className="save-as-table-estimate" aria-live="polite">
                {saveTableEstimate?.loading && (
                  <p className="save-as-table-estimate__muted">생성될 결과 크기 추정 중(EXPLAIN)…</p>
                )}
                {!saveTableEstimate?.loading && saveTableEstimate?.error && (
                  <p className="save-as-table-estimate__err">{saveTableEstimate.error}</p>
                )}
                {!saveTableEstimate?.loading &&
                  !saveTableEstimate?.error &&
                  (saveTableEstimate?.estimated_rows != null || saveTableEstimate?.estimated_data_pretty) && (
                    <>
                      <p className="save-as-table-estimate__main">
                        예상 결과(통계 기준):
                        {saveTableEstimate.estimated_rows != null && (
                          <>
                            {' '}
                            약 <strong>{formatEstimatedRows(saveTableEstimate.estimated_rows)}</strong>행
                          </>
                        )}
                        {saveTableEstimate.estimated_data_pretty && (
                          <>
                            {saveTableEstimate.estimated_rows != null ? ' · ' : ' '}
                            데이터 크기 추정 <strong>{saveTableEstimate.estimated_data_pretty}</strong>
                          </>
                        )}
                      </p>
                      {saveTableEstimate.disclaimer && (
                        <p className="save-as-table-estimate__muted">{saveTableEstimate.disclaimer}</p>
                      )}
                    </>
                  )}
                {!saveTableEstimate?.loading &&
                  !saveTableEstimate?.error &&
                  saveTableEstimate?.estimated_rows == null &&
                  !saveTableEstimate?.estimated_data_pretty && (
                    <p className="save-as-table-estimate__muted">
                      플래너에서 행·크기 추정을 얻지 못했습니다.
                    </p>
                  )}
              </div>
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
