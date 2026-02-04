/**
 * report/ReportPage.jsx (리포트 페이지)
 * ====================================
 * 쿼리 빌더: 데이터 로드, 그리드·필터·SQL·실행·페이지네이션 상태 및 레이아웃.
 *
 * [주요 기능]
 * - 데이터 로드: health, listTables, describeTable, tableRelationships
 * - 상태: gridColumns, addedTables, filters, orderBy, resultData, pagination, executedSql, explanation
 * - 콜백: addColumn, moveColumn, executeQuery, 필터/ORDER BY, 페이지, SQL 복사/해석, 초기화
 *
 * [의존성]
 * - React, shared/api/client, report/utils/sqlBuilder, report/components (Header, Sidebar, MainArea)
 */

import { useState, useEffect, useCallback } from 'react'
import { health, listTables, describeTable, tableRelationships as fetchTableRelationships, executeQuery as apiExecuteQuery, explainSql } from '@/shared/api/client'
import { generateSQL, generateCountSQL } from './utils/sqlBuilder'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'

const DEFAULT_PAGE_SIZE = 100

export default function ReportPage() {
  const [dbStatus, setDbStatus] = useState({ ok: null, message: '확인 중...' })
  const [tables, setTables] = useState([])
  const [tableRelationships, setTableRelationships] = useState({})
  const [loading, setLoading] = useState(true)

  const [gridColumns, setGridColumns] = useState([])
  const [addedTables, setAddedTables] = useState([])
  const [filters, setFilters] = useState([])
  const [orderBy, setOrderBy] = useState([])
  const [resultData, setResultData] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [executedSql, setExecutedSql] = useState('')
  const [explanation, setExplanation] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let cancelled = false
    let toastTimeout = null
    async function load() {
      try {
        const healthData = await health()
        const ok = healthData?.status === 'healthy'
        if (!cancelled) setDbStatus({ ok, message: ok ? 'DB 연결됨' : (healthData?.error || healthData?.message || 'DB 연결 안됨') })
      } catch (e) {
        if (!cancelled) setDbStatus({ ok: false, message: 'API 서버 연결 실패 (5001 포트 확인)' })
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
        const relData = await fetchTableRelationships()
        const rels = relData?.relationships || []
        const relMap = {}
        rels.forEach((r) => {
          const fromTable = r.from_table
          const toTable = r.to_table
          const fromCol = r.from_column
          const toCol = r.to_column
          if (!relMap[fromTable]) relMap[fromTable] = {}
          if (!relMap[toTable]) relMap[toTable] = {}
          relMap[fromTable][toTable] = { prevColumn: fromCol, currColumn: toCol }
          relMap[toTable][fromTable] = { prevColumn: toCol, currColumn: fromCol }
        })
        tablesWithColumns.forEach((t) => {
          if (!relMap[t.table_name]) relMap[t.table_name] = {}
        })
        if (!cancelled) setTableRelationships(relMap)
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

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
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
      setAddedTables(newAddedTables)
      setGridColumns((prev) => [...prev, { table: columnInfo.table, column: columnInfo.column, alias, type: columnInfo.type }])
      setCurrentPage(1)
      showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
    },
    [gridColumns, addedTables, showToast]
  )

  const runExecuteQuery = useCallback(async () => {
    if (gridColumns.length === 0) {
      showToast('warning', '최소 1개의 컬럼을 선택하세요')
      return
    }
    try {
      const countSQL = generateCountSQL(gridColumns, addedTables, filters, tableRelationships)
      if (countSQL) {
        try {
          const countRes = await apiExecuteQuery(countSQL)
          const raw = countRes.data?.[0]?.total
          setTotalCount(typeof raw === 'number' ? raw : parseInt(raw, 10) || 0)
        } catch {
          setTotalCount(0)
        }
      }
      const sql = generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships)
      setExecutedSql(sql)
      const res = await apiExecuteQuery(sql)
      setResultData(res.data || [])
      showToast('success', `${res.count ?? res.data?.length ?? 0}건 조회 완료`)
    } catch (e) {
      showToast('error', e.message || '실행 실패')
    }
  }, [gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, showToast])

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
      <Header onExecute={runExecuteQuery} onClearAll={clearAll} />
      <div className="container">
        <Sidebar
          tables={tables}
          tableRelationships={tableRelationships}
          addedTables={addedTables}
          loading={loading}
          dbStatus={dbStatus}
        />
        <MainArea
          gridColumns={gridColumns}
          addedTables={addedTables}
          filters={filters}
          orderBy={orderBy}
          resultData={resultData}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          executedSql={executedSql}
          explanation={explanation}
          onAddColumn={addColumn}
          onMoveColumn={moveColumn}
          onExecute={runExecuteQuery}
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
