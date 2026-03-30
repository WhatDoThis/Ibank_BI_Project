/**
 * query_studio/components/Sidebar.jsx (쿼리 스튜디오 페이지 사이드바)
 * =====================================================
 * DB 상태·테이블 목록(JOIN 가능만 노출)·검색·펼치기/접기·컬럼 드래그.
 * 테이블 목록은 폴더로 구분: I1 (I1_*), 쿼리 스튜디오 저장 (test_report_*), 기타.
 *
 * [Main Functions]
 * ===========
 * 1. getTableFolder: 테이블명 → 폴더(I1/쿼리빌더/기타)
 * 2. Sidebar: tables, tableRelationships, relationshipOptions, addedTables, loading, dbStatus props. isTableAvailableOrViaParent로 필터. 컬럼 드래그·테이블명 드래그(전체 컬럼) 데이터 전달
 *
 * [Dependencies]
 * =========
 * - React, query_studio/utils/joinRules (isTableAvailableOrViaParent)
 */

import { useState, useMemo } from 'react'
import { isTableAvailableOrViaParent } from '../utils/joinRules'

const FOLDER_I1 = 'I1'
const FOLDER_QUERY_BUILDER = '쿼리 스튜디오 저장'
const FOLDER_OTHER = '기타'
const PREFIX_I1 = 'I1_'
const PREFIX_TEST_REPORT = 'test_report_'

// 1.
function getTableFolder(tableName) {
  if (!tableName) return FOLDER_OTHER
  const lower = tableName.toLowerCase()
  if (lower.startsWith('i1_')) return FOLDER_I1
  if (lower.startsWith(PREFIX_TEST_REPORT)) return FOLDER_QUERY_BUILDER
  return FOLDER_OTHER
}

const FOLDER_ORDER = [FOLDER_I1, FOLDER_QUERY_BUILDER, FOLDER_OTHER]

// 2.
export default function Sidebar({ tables = [], tableRelationships = {}, relationshipOptions = {}, addedTables = [], loading, dbStatus = {}, onOpenColumnLabelsModal, onRefreshTables, onRefreshDbStatus }) {
  const [tableExpanded, setTableExpanded] = useState({})
  const [folderExpanded, setFolderExpanded] = useState({ [FOLDER_I1]: true, [FOLDER_QUERY_BUILDER]: true, [FOLDER_OTHER]: true })
  const [searchKeyword, setSearchKeyword] = useState('')

  // 3.
  function toggleTable(tableName) {
    setTableExpanded((prev) => ({ ...prev, [tableName]: !prev[tableName] }))
  }

  // 4.
  function toggleFolder(folderName) {
    setFolderExpanded((prev) => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  // 5.
  function onColumnDragStart(e, tableName, column) {
    e.dataTransfer.setData('application/json', JSON.stringify({ table: tableName, column: column.name, type: column.type, label: column.label }))
    e.dataTransfer.effectAllowed = 'copy'
    e.currentTarget.classList.add('dragging')
  }

  // 6.
  function onTableDragStart(e, tableRow) {
    const cols = tableRow.columns || []
    const columns = cols.map((c) => ({ name: c.name, type: c.type, label: c.label }))
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ dragKind: 'table', table: tableRow.table_name, columns })
    )
    e.dataTransfer.effectAllowed = 'copy'
    e.currentTarget.classList.add('dragging')
  }

  // 7.
  function onColumnDragEnd(e) {
    e.currentTarget.classList.remove('dragging')
  }

  const keyword = (searchKeyword || '').trim().toLowerCase()
  const filteredByKeyword = keyword
    ? tables.filter((t) => String(t.table_name || '').toLowerCase().includes(keyword))
    : tables
  /* 조인 불가능한 테이블은 목록에서 제외 (직접 조인 또는 같은 부모 경로로만 노출) */
  const filteredTables = filteredByKeyword.filter((t) =>
    isTableAvailableOrViaParent(t.table_name, addedTables, tableRelationships, relationshipOptions)
  )

  /* 폴더별로 그룹: I1, 쿼리 스튜디오 저장(test_report_), 기타 */
  const tablesByFolder = useMemo(() => {
    const map = { [FOLDER_I1]: [], [FOLDER_QUERY_BUILDER]: [], [FOLDER_OTHER]: [] }
    filteredTables.forEach((t) => {
      const folder = getTableFolder(t.table_name)
      if (map[folder]) map[folder].push(t)
    })
    return map
  }, [filteredTables])

  // 8.
  function renderTableGroup(t) {
    const expanded = !!tableExpanded[t.table_name]
    const cols = t.columns || []
    return (
      <div
        key={t.table_name}
        className="table-group"
        data-table={t.table_name}
      >
        <div className="table-header">
          <span
            className="toggle-icon"
            role="button"
            tabIndex={0}
            onClick={() => toggleTable(t.table_name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleTable(t.table_name)
              }
            }}
            aria-expanded={expanded}
            aria-label={expanded ? '컬럼 목록 접기' : '컬럼 목록 펼치기'}
          >
            {expanded ? '▼' : '▶'}
          </span>
          <span
            className="table-name table-name--draggable"
            draggable={cols.length > 0}
            title={cols.length > 0 ? '테이블의 모든 컬럼을 그리드로 드래그' : '컬럼 없음'}
            onDragStart={(e) => cols.length > 0 && onTableDragStart(e, t)}
            onDragEnd={onColumnDragEnd}
          >
            {t.table_label ?? t.table_name}
          </span>
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
              <span className="column-name">{c.label ?? c.name}</span>
              <span className="column-type">{c.type}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header qs-sidebar__header">
        <span className="qs-sidebar__title">테이블 목록</span>
        {typeof onOpenColumnLabelsModal === 'function' && (
          <button
            type="button"
            className="btn-small secondary qs-sidebar__header-btn"
            onClick={onOpenColumnLabelsModal}
            title="DB 테이블·컬럼명은 그대로 두고, 화면에 보이는 표시명만 변경합니다."
          >
            표시명
          </button>
        )}
      </div>
      <div className="sidebar-db-status-wrap qs-sidebar__status-row">
        <span className={`sidebar-db-status ${dbStatus.ok === true ? 'ok' : dbStatus.ok === false ? 'error' : ''}`} title="API /health 결과">
          {dbStatus.message ?? '확인 중...'}
        </span>
        <div className="qs-sidebar__status-actions">
          {typeof onRefreshDbStatus === 'function' && (
            <button type="button" className="btn-small secondary qs-sidebar__icon-btn" onClick={onRefreshDbStatus} title="DB 연결 상태 재확인">
              상태
            </button>
          )}
          {typeof onRefreshTables === 'function' && (
            <button
              type="button"
              className="btn-small secondary qs-sidebar__icon-btn"
              onClick={onRefreshTables}
              disabled={loading}
              title="테이블 목록 새로고침"
            >
              {loading ? '…' : '목록'}
            </button>
          )}
        </div>
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
