/**
 * report/ReportPage.jsx (리포트 페이지)
 * ====================================
 * 쿼리 빌더: 데이터 로드, 그리드·필터·SQL·실행·페이지네이션 상태 및 레이아웃.
 *
 * [주요 기능]
 * - 데이터 로드: health, listTables, describeTable, tableRelationships
 * - 상태: gridColumns(aggFunc), addedTables, filters, orderBy, groupBy, pivot, pivotRowAggs, dateGranularity, havings, resultData, pagination, executedSql, explanation
 * - 콜백: addColumn, moveColumn, toggleGroupBy, setDateGranularity, changeAggFunc, addHaving, removeHaving, pivot/행별집계, executeQuery, 필터/ORDER BY, 페이지, SQL 복사/해석, 초기화
 *
 * [의존성]
 * - React, shared/api/client, report/utils/sqlBuilder, report/utils/constants, report/components (Sidebar, MainArea)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import './report.css'
import { getApiBase } from '@/shared/config/api'
import { health, listTables, describeTable, tableRelationships as fetchTableRelationships, executeQuery as apiExecuteQuery, explainSql } from '@/shared/api/client'
import { generateSQL, generateCountSQL, generateDistinctPivotSQL } from './utils/sqlBuilder'
import { AGG_FUNCTIONS } from './utils/constants'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'

const DEFAULT_PAGE_SIZE = 100

function isGroupByColumn(groupBy, table, column) {
  return groupBy.some((g) => g.table === table && g.column === column)
}

export default function ReportPage() {
  const [dbStatus, setDbStatus] = useState({ ok: null, message: '확인 중...' })
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

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
  const [totalCount, setTotalCount] = useState(0)
  const [executedSql, setExecutedSql] = useState('')
  const [explanation, setExplanation] = useState(null)
  const [toast, setToast] = useState(null)
  const [joinMode, setJoinMode] = useState('all') // 'fk' | 'column' | 'all'
  const [relationshipOptions, setRelationshipOptions] = useState({}) // { "t1-t2": [ { prevColumn, currColumn }, ... ] }
  const [joinSelections, setJoinSelections] = useState({}) // { "t1-t2": { prevColumn, currColumn } }

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
      const sel = joinSelections[key] || opts[0]
      resolved[fromTable][toTable] = sel
      if (!resolved[toTable]) resolved[toTable] = {}
      resolved[toTable][fromTable] = { prevColumn: sel.currColumn, currColumn: sel.prevColumn }
    })
    return resolved
  }, [tables, relationshipOptions, joinSelections])

  useEffect(() => {
    let cancelled = false
    let toastTimeout = null
    async function load() {
      try {
        const healthData = await health()
        const ok = healthData?.status === 'healthy'
        if (!cancelled) setDbStatus({ ok, message: ok ? 'DB 연결됨' : (healthData?.error || healthData?.message || 'DB 연결 안됨') })
      } catch (e) {
        if (!cancelled) setDbStatus({ ok: false, message: `API 서버 연결 실패 (${getApiBase()} 확인)` })
      }
      try {
        const listData = await listTables()
        const rawTables = listData?.tables || []
        const tablesWithColumns = []
        for (const t of rawTables) {
          const name = t?.table_name
          if (!name) continue
          try {
            const desc = await describeTable(name)
            tablesWithColumns.push({ table_name: name, size: t?.size, columns: desc?.columns || [] })
          } catch {
            tablesWithColumns.push({ table_name: name, size: t?.size, columns: [] })
          }
        }
        if (!cancelled) setTables(tablesWithColumns)
      } catch (e) {
        if (!cancelled) {
          setDbStatus((prev) => (prev.ok === null ? { ok: false, message: 'DB 연결 안됨' } : prev))
          setTables([])
          setToast({ type: 'error', msg: e.message || '테이블 로드 실패' })
          toastTimeout = setTimeout(() => setToast(null), 3000)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (toastTimeout) clearTimeout(toastTimeout)
    }
  }, [])

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
          const key = `${fromTable}||${toTable}`
          const optKey = `${key}::${prevCol}::${currCol}`
          if (seen.has(optKey)) return
          seen.add(optKey)
          if (!opts[key]) opts[key] = []
          opts[key].push({ prevColumn: prevCol, currColumn: currCol })
        })
        setRelationshipOptions(opts)
      })
      .catch(() => setRelationshipOptions({}))
    return () => { cancelled = true }
  }, [joinMode, tables])

  const setJoinSelection = useCallback((fromTable, toTable, value) => {
    const key = `${fromTable}||${toTable}`
    setJoinSelections((prev) => (value ? { ...prev, [key]: value } : (() => { const n = { ...prev }; delete n[key]; return n })()))
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
      const newAddedTables = addedTables.includes(columnInfo.table) ? addedTables : [...addedTables, columnInfo.table]
      const tableAliasMap = {}
      newAddedTables.forEach((t, i) => {
        tableAliasMap[t] = 't' + (i + 1)
      })
      const alias = tableAliasMap[columnInfo.table] || 't1'
      const isGB = isGroupByColumn(groupBy, columnInfo.table, columnInfo.column)
      const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null
      setAddedTables(newAddedTables)
      setGridColumns((prev) => syncAggFuncs([...prev, { table: columnInfo.table, column: columnInfo.column, alias, type: columnInfo.type, aggFunc }], groupBy))
      setCurrentPage(1)
      showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast]
  )

  const runExecuteQuery = useCallback(async () => {
    if (gridColumns.length === 0) {
      showToast('warning', '최소 1개의 컬럼을 선택하세요')
      return
    }
    try {
      const options = { groupBy, dateGranularity, havings, pivot, pivotRowAggs }
      const countSQL = generateCountSQL(gridColumns, addedTables, filters, tableRelationships, options)
      if (countSQL) {
        try {
          const countRes = await apiExecuteQuery(countSQL)
          const raw = countRes.data?.[0]?.total
          setTotalCount(typeof raw === 'number' ? raw : parseInt(raw, 10) || 0)
        } catch {
          setTotalCount(0)
        }
      }
      const sql = generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, options)
      setExecutedSql(sql)
      const res = await apiExecuteQuery(sql)
      setResultData(res.data || [])
      showToast('success', `${res.count ?? res.data?.length ?? 0}건 조회 완료`)
    } catch (e) {
      showToast('error', e.message || '실행 실패')
    }
  }, [gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, groupBy, dateGranularity, havings, pivot, pivotRowAggs, showToast])

  useEffect(() => {
    if (gridColumns.length === 0) return
    runExecuteQuery()
  }, [gridColumns, addedTables, filters, orderBy, currentPage, pageSize, runExecuteQuery])

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
      const idx = prev.findIndex((h) => h.table === having.table && h.column === having.column && h.aggFunc === having.aggFunc)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = having
        return next
      }
      return [...prev, having]
    })
    setCurrentPage(1)
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
      const sql = generateDistinctPivotSQL(table, column, gridColumns, addedTables, filters, tableRelationships)
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
    [gridColumns, addedTables, filters, tableRelationships, setPivotFromValues, showToast]
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
    setFilters((prev) => [...prev, filter])
    setCurrentPage(1)
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

  const clearAll = useCallback(() => {
    setGridColumns([])
    setAddedTables([])
    setGroupBy([])
    setPivot(null)
    setPivotRowAggs([])
    setDateGranularity({})
    setHavings([])
    setFilters([])
    setOrderBy([])
    setResultData([])
    setCurrentPage(1)
    setTotalCount(0)
    setExecutedSql('')
    setExplanation(null)
    showToast('success', '초기화되었습니다')
  }, [showToast])

  return (
    <>
      <div className="container">
        <Sidebar
          tables={tables}
          tableRelationships={tableRelationships}
          addedTables={addedTables}
          loading={loading}
          dbStatus={dbStatus}
          joinMode={joinMode}
          setJoinMode={setJoinMode}
        />
        <MainArea
          gridColumns={gridColumns}
          addedTables={addedTables}
          relationshipOptions={relationshipOptions}
          joinSelections={joinSelections}
          onJoinSelection={setJoinSelection}
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
          executedSql={executedSql}
          explanation={explanation}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onMoveColumn={moveColumn}
          onExecute={runExecuteQuery}
          onClearAll={clearAll}
          onToggleGroupBy={toggleGroupBy}
          onSetDateGranularity={setDateGranularityFor}
          onChangeAggFunc={changeAggFuncFor}
          onAddHaving={addHaving}
          onRemoveHaving={removeHaving}
          onFetchAndSetPivot={fetchAndSetPivot}
          onRemovePivot={removePivotCallback}
          onAddPivotAgg={addPivotAgg}
          onRemovePivotAgg={removePivotAgg}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onAddOrderBy={addOrderBy}
          onRemoveOrderBy={removeOrderBy}
          onSetPage={setPage}
          onSetPageSize={setPageSizeOption}
          onCopySql={copySql}
          onExplainSql={runExplainSql}
          onCloseExplanation={() => setExplanation(null)}
        />
      </div>
      {toast && (
        <div className={`toast ${toast.type} show`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
