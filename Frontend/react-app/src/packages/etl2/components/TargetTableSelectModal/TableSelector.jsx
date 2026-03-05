/**
 * TableSelector.jsx (저장 DB 테이블 선택 + 새 테이블명)
 * ================================================================================
 * 저장 DB 테이블 select + "새 테이블로 만들기" 시 새 테이블명 input.
 *
 * [Main Functions]
 * ===========
 * - TableSelector: tables, tablesLoading, tablesError, selectedTable, setSelectedTable, sourceColumns, newTableName, setNewTableName, currentTargetTable
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (NEW_TABLE_VALUE)
 */

import { NEW_TABLE_VALUE } from './constants.js';

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
  return (
    <>
      <div className="etl-target-select-modal__row">
        <label className="etl-target-select-modal__label">저장 DB 테이블</label>
        {tablesLoading ? (
          <p className="etl-target-select-modal__loading">테이블 목록 로딩 중…</p>
        ) : tablesError ? (
          <p className="etl-target-select-modal__error">{tablesError}</p>
        ) : (
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="etl-target-select-modal__select"
          >
            <option value="">테이블 선택</option>
            {sourceColumns.length > 0 && (
              <option value={NEW_TABLE_VALUE}>새 테이블로 만들기</option>
            )}
            {(tables || []).map((t) => (
              <option key={t.table_name} value={t.table_name || ''}>{t.table_name || '(이름 없음)'}</option>
            ))}
          </select>
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
