/**
 * report/components/Sidebar.jsx (리포트 페이지 사이드바)
 * =====================================================
 * DB 상태·테이블 목록(JOIN 가능만 노출)·검색·펼치기/접기·컬럼 드래그.
 * 테이블 목록은 폴더로 구분: I1 (I1_*), 쿼리빌더 (test_report_*), 기타.
 *
 * [Main Functions]
 * ===========
 * - Sidebar: tables, tableRelationships, relationshipOptions, addedTables, loading, dbStatus props. isTableAvailableOrViaParent로 필터. onColumnDragStart 데이터 전달
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - Sidebar (default export)
 *
 * [Dependencies]
 * =========
 * - React, report/utils/joinRules (isTableAvailableOrViaParent)
 */

import { useState, useMemo } from 'react'
import { isTableAvailableOrViaParent } from '../utils/joinRules'

const FOLDER_I1 = 'I1'
const FOLDER_QUERY_BUILDER = '쿼리빌더'
const FOLDER_OTHER = '기타'
const PREFIX_I1 = 'I1_'
const PREFIX_TEST_REPORT = 'test_report_'

function getTableFolder(tableName) {
  if (!tableName) return FOLDER_OTHER
  const lower = tableName.toLowerCase()
  if (lower.startsWith('i1_')) return FOLDER_I1
  if (lower.startsWith(PREFIX_TEST_REPORT)) return FOLDER_QUERY_BUILDER
  return FOLDER_OTHER
}

const FOLDER_ORDER = [FOLDER_I1, FOLDER_QUERY_BUILDER, FOLDER_OTHER]

export default function Sidebar({ tables = [], tableRelationships = {}, relationshipOptions = {}, addedTables = [], loading, dbStatus = {} }) {
  const [tableExpanded, setTableExpanded] = useState({})
  const [folderExpanded, setFolderExpanded] = useState({ [FOLDER_I1]: true, [FOLDER_QUERY_BUILDER]: true, [FOLDER_OTHER]: true })
  const [searchKeyword, setSearchKeyword] = useState('')

  function toggleTable(tableName) {
    setTableExpanded((prev) => ({ ...prev, [tableName]: !prev[tableName] }))
  }

  function toggleFolder(folderName) {
    setFolderExpanded((prev) => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  function onColumnDragStart(e, tableName, column) {
    e.dataTransfer.setData('application/json', JSON.stringify({ table: tableName, column: column.name, type: column.type }))
    e.dataTransfer.effectAllowed = 'copy'
    e.target.classList.add('dragging')
  }

  function onColumnDragEnd(e) {
    e.target.classList.remove('dragging')
  }

  const keyword = (searchKeyword || '').trim().toLowerCase()
  const filteredByKeyword = keyword
    ? tables.filter((t) => String(t.table_name || '').toLowerCase().includes(keyword))
    : tables
  /* 조인 불가능한 테이블은 목록에서 제외 (직접 조인 또는 같은 부모 경로로만 노출) */
  const filteredTables = filteredByKeyword.filter((t) =>
    isTableAvailableOrViaParent(t.table_name, addedTables, tableRelationships, relationshipOptions)
  )

  /* 폴더별로 그룹: I1, 쿼리빌더(test_report_), 기타 */
  const tablesByFolder = useMemo(() => {
    const map = { [FOLDER_I1]: [], [FOLDER_QUERY_BUILDER]: [], [FOLDER_OTHER]: [] }
    filteredTables.forEach((t) => {
      const folder = getTableFolder(t.table_name)
      if (map[folder]) map[folder].push(t)
    })
    return map
  }, [filteredTables])

  function renderTableGroup(t) {
    const expanded = !!tableExpanded[t.table_name]
    const cols = t.columns || []
    return (
      <div
        key={t.table_name}
        className="table-group"
        data-table={t.table_name}
      >
        <div className="table-header" onClick={() => toggleTable(t.table_name)}>
          <span className="toggle-icon">{expanded ? '▼' : '▶'}</span>
          <span className="table-name">{t.table_name}</span>
          <span className="table-count">({cols.length}개)</span>
        </div>
        <div className={`column-list ${expanded ? 'expanded' : ''}`}>
          {cols.map((c) => (
            <div
              key={c.name}
              className="column-item"
              draggable
              data-table={t.table_name}
              data-column={c.name}
              data-type={c.type}
              onDragStart={(e) => onColumnDragStart(e, t.table_name, c)}
              onDragEnd={onColumnDragEnd}
            >
              <span className="drag-handle">⋮⋮</span>
              <span className="column-name">{c.name}</span>
              <span className="column-type">{c.type}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">📁 테이블</div>
      <div className={`sidebar-db-status ${dbStatus.ok === true ? 'ok' : dbStatus.ok === false ? 'error' : ''}`} title="API /health 결과">
        {dbStatus.message ?? '확인 중...'}
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="테이블명 검색..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
      </div>
      <div className="sidebar-content">
        {loading && '로딩 중...'}
        {!loading && tables.length === 0 && 'DB 설정 후 새로고침하세요. (Env/config/config.json)'}
        {!loading && tables.length > 0 && (
          <>
            {FOLDER_ORDER.map((folderName) => {
              const list = tablesByFolder[folderName] || []
              if (list.length === 0) return null
              const isFolderOpen = !!folderExpanded[folderName]
              return (
                <div key={folderName} className="sidebar-folder" data-folder={folderName}>
                  <div
                    className="sidebar-folder-header"
                    onClick={() => toggleFolder(folderName)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFolder(folderName) } }}
                  >
                    <span className="folder-toggle">{isFolderOpen ? '▼' : '▶'}</span>
                    <span className="folder-name">{folderName}</span>
                    <span className="folder-count">({list.length})</span>
                  </div>
                  {isFolderOpen && (
                    <div className="sidebar-folder-body">
                      {list.map((t) => renderTableGroup(t))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
