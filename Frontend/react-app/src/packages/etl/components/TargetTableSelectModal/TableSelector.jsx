/**
 * TableSelector.jsx (저장 DB 테이블 선택 + 새 테이블명)
 * ================================================================================
 * 저장 DB 테이블 select + "새 테이블로 만들기" 시 새 테이블명 input.
 * 테이블 목록은 커스텀 드롭다운으로 표시해 목록 높이를 제한함.
 *
 * [Main Functions]
 * ===========
 * 1. TableSelector: tables, tablesLoading, tablesError, selectedTable, setSelectedTable, sourceColumns, newTableName, setNewTableName, currentTargetTable
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (NEW_TABLE_VALUE)
 */

import { useState, useRef, useEffect } from 'react';
import { NEW_TABLE_VALUE } from './constants.js';

function getTableOptionLabel(value, tables, sourceColumns) {
  if (value === '') return '테이블 선택';
  if (value === NEW_TABLE_VALUE) return '새 테이블로 만들기';
  const t = (tables || []).find((x) => (x.table_name || '') === value);
  return t ? (t.table_name || '(이름 없음)') : value;
}

// 1.
export function TableSelector({
  tables,
  tablesLoading,
  tablesError,
  selectedTable,
  setSelectedTable,
  sourceColumns,
  newTableName,
  setNewTableName,
  currentTargetTable
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const handleSelect = (value) => {
    setSelectedTable(value);
    setOpen(false);
  };

  const displayLabel = getTableOptionLabel(selectedTable, tables, sourceColumns);

  return (
    <>
      <div className="etl-target-select-modal__row">
        <label className="etl-target-select-modal__label">저장 DB 테이블</label>
        {tablesLoading ? (
          <p className="etl-target-select-modal__loading">테이블 목록 로딩 중…</p>
        ) : tablesError ? (
          <p className="etl-target-select-modal__error">{tablesError}</p>
        ) : (
          <div className="etl-target-select-modal__table-dropdown" ref={containerRef}>
            <button
              type="button"
              className="etl-target-select-modal__select etl-target-select-modal__select--table"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label="저장 DB 테이블 선택"
            >
              {displayLabel}
              <span className="etl-target-select-modal__table-dropdown-arrow" aria-hidden>▾</span>
            </button>
            {open && (
              <ul
                className="etl-target-select-modal__table-dropdown-list"
                role="listbox"
                aria-label="저장 DB 테이블 목록"
              >
                <li role="option" aria-selected={selectedTable === ''}>
                  <button type="button" onClick={() => handleSelect('')}>테이블 선택</button>
                </li>
                {sourceColumns.length > 0 && (
                  <li role="option" aria-selected={selectedTable === NEW_TABLE_VALUE}>
                    <button type="button" onClick={() => handleSelect(NEW_TABLE_VALUE)}>새 테이블로 만들기</button>
                  </li>
                )}
                {(tables || []).map((t) => {
                  const val = t.table_name || '';
                  return (
                    <li key={val || 'empty'} role="option" aria-selected={selectedTable === val}>
                      <button type="button" onClick={() => handleSelect(val)}>{t.table_name || '(이름 없음)'}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {selectedTable === NEW_TABLE_VALUE && sourceColumns.length > 0 && (
        <div className="etl-target-select-modal__row">
          <label className="etl-target-select-modal__label">새 테이블명</label>
          <input
            type="text"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="예: my_new_table"
            className="etl-target-select-modal__input etl-target-select-modal__input--target-name"
          />
          <p className="etl-target-select-modal__hint">생성할 테이블 이름을 입력하세요.</p>
        </div>
      )}
    </>
  );
}
