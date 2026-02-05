/**
 * report/components/Sidebar.jsx (리포트 페이지 사이드바)
 * =====================================================
 * DB 상태, 테이블 목록(JOIN 가능만 활성화), 검색, 펼치기/접기, 컬럼 드래그.
 *
 * [의존성]
 * - React
 */

import { useState } from 'react'

function isTableAvailable(tableName, addedTables, tableRelationships) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(tableName)) return true
  const last = addedTables[addedTables.length - 1]
  const relLast = tableRelationships[last] || {}
  const relTable = tableRelationships[tableName] || {}
  return !!relLast[tableName] || !!relTable[last]
}

export default function Sidebar({ tables = [], tableRelationships = {}, addedTables = [], loading, dbStatus = {}, joinMode = 'all', setJoinMode }) {
  const [tableExpanded, setTableExpanded] = useState({})
  const [searchKeyword, setSearchKeyword] = useState('')

  function toggleTable(tableName) {
    setTableExpanded((prev) => ({ ...prev, [tableName]: !prev[tableName] }))
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
  const filteredTables = keyword
    ? tables.filter((t) => String(t.table_name || '').toLowerCase().includes(keyword))
    : tables

  return (
    <div className="sidebar">
      <div className="sidebar-header">📁 테이블</div>
      <div className={`sidebar-db-status ${dbStatus.ok === true ? 'ok' : dbStatus.ok === false ? 'error' : ''}`} title="API /health 결과">
        {dbStatus.message ?? '확인 중...'}
      </div>
      <div className="sidebar-join-mode">
        <label className="sidebar-join-mode-label">조인 기준</label>
        <select
          className="sidebar-join-mode-select"
          value={joinMode}
          onChange={(e) => setJoinMode(e.target.value)}
          title="FK만 / 동일 컬럼명·타입 / 둘 다"
        >
          <option value="all">둘 다 (FK + 동일 컬럼·타입)</option>
          <option value="fk">FK만</option>
          <option value="column">동일 컬럼명·타입</option>
        </select>
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
            {filteredTables.map((t) => {
              const expanded = !!tableExpanded[t.table_name]
              const cols = t.columns || []
              const disabled = !isTableAvailable(t.table_name, addedTables, tableRelationships)
              return (
                <div
                  key={t.table_name}
                  className={`table-group ${disabled ? 'disabled' : ''}`}
                  data-table={t.table_name}
                >
                  <div className="table-header" onClick={() => !disabled && toggleTable(t.table_name)}>
                    <span className="toggle-icon">{expanded ? '▼' : '▶'}</span>
                    <span className="table-name">{t.table_name}</span>
                    <span className="table-count">({cols.length}개)</span>
                    {disabled && <span className="disabled-hint">🚫 JOIN 불가</span>}
                  </div>
                  <div className={`column-list ${expanded ? 'expanded' : ''}`}>
                    {cols.map((c) => (
                      <div
                        key={c.name}
                        className="column-item"
                        draggable={!disabled}
                        data-table={t.table_name}
                        data-column={c.name}
                        data-type={c.type}
                        onDragStart={(e) => !disabled && onColumnDragStart(e, t.table_name, c)}
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
            })}
          </>
        )}
      </div>
    </div>
  )
}
