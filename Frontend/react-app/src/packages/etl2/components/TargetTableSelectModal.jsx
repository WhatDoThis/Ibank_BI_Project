/**
 * packages/etl2/components/TargetTableSelectModal.jsx (테이블선택 및 컬럼매핑 모달)
 * ================================================================================
 * Phase 3: 저장 DB(선택된 storage_connection_id) 기준 테이블 목록 조회 → 테이블 선택
 * → 해당 테이블 컬럼 목록 + 컬럼별 선택 체크박스. 적용 시 타겟 테이블명·선택 컬럼 반환.
 *
 * [Main Functions]
 * ===========
 * - open 시 etl2ListTargetTables(storage_connection_id)로 테이블 목록 로드
 * - 테이블 선택 시 etl2ListTargetColumns(storage_connection_id, table_name)로 컬럼 로드
 * - 적용: onSelect(tableName, selectedColumnNames)
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListTargetTables, etl2ListTargetColumns)
 */

import { useState, useEffect, useCallback } from 'react';
import { etl2ListTargetTables, etl2ListTargetColumns } from '@/shared/api/client';

function TargetTableSelectModal({ open, onClose, storageConnectionId, currentTargetTable, onSelect }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [tablesError, setTablesError] = useState('');
  const [columnsError, setColumnsError] = useState('');

  const sid = storageConnectionId === '' || storageConnectionId == null ? null : storageConnectionId;

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError('');
    try {
      const res = await etl2ListTargetTables(sid);
      setTables(res.tables || []);
    } catch (err) {
      setTablesError(err.message || '테이블 목록을 불러오지 못했습니다.');
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  }, [sid]);

  useEffect(() => {
    if (open) {
      loadTables();
      setSelectedTable('');
      setColumns([]);
      setSelectedColumns([]);
      setColumnsError('');
    }
  }, [open, loadTables]);

  useEffect(() => {
    if (!open || !selectedTable.trim()) {
      setColumns([]);
      setSelectedColumns([]);
      return;
    }
    setColumnsLoading(true);
    setColumnsError('');
    etl2ListTargetColumns(sid, selectedTable.trim())
      .then((res) => {
        const cols = res.columns || [];
        setColumns(cols);
        setSelectedColumns(cols.map((c) => (c && c.column_name ? String(c.column_name) : '').trim()).filter(Boolean));
      })
      .catch((err) => {
        setColumnsError(err.message || '컬럼 목록을 불러오지 못했습니다.');
        setColumns([]);
        setSelectedColumns([]);
      })
      .finally(() => setColumnsLoading(false));
  }, [open, selectedTable, sid]);

  const toggleColumn = (name) => {
    setSelectedColumns((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(columns.map((c) => (c && c.column_name ? String(c.column_name) : '')).filter(Boolean));
  };

  const clearAllColumns = () => {
    setSelectedColumns([]);
  };

  function handleApply() {
    const tableName = selectedTable.trim();
    if (!tableName) return;
    // Phase 4: 선택된 컬럼으로 column_mapping [{source, target, type}, ...] 전달 (기본: source=target)
    const selectedList = (columns || []).filter((c) => selectedColumns.includes((c && c.column_name) ? String(c.column_name) : ''));
    const columnMapping = selectedList.map((c) => ({
      source: (c && c.column_name) ? String(c.column_name) : '',
      target: (c && c.column_name) ? String(c.column_name) : '',
      type: (c && c.data_type) ? String(c.data_type).toUpperCase() : 'TEXT',
    }));
    if (onSelect) onSelect(tableName, columnMapping);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="etl-target-select-modal" role="dialog" aria-modal="true" aria-label="테이블선택 및 컬럼매핑">
      <div className="etl-target-select-modal__backdrop" onClick={onClose} />
      <div className="etl-target-select-modal__box">
        <div className="etl-target-select-modal__header">
          <h3 className="etl-target-select-modal__title">테이블선택 및 컬럼매핑</h3>
          <button type="button" className="etl-target-select-modal__close" onClick={onClose} aria-label="닫기">&times;</button>
        </div>
        <div className="etl-target-select-modal__body">
          <p className="etl-target-select-modal__intro">선택한 &quot;저장할 DB&quot; 기준으로 테이블·컬럼을 조회합니다. 테이블 선택 후 적용하면 타겟 테이블명과 컬럼 매핑이 저장됩니다.</p>
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
                {(tables || []).map((t) => (
                  <option key={t.table_name} value={t.table_name || ''}>{t.table_name || '(이름 없음)'}</option>
                ))}
              </select>
            )}
          </div>
          <div className="etl-target-select-modal__row">
            <label className="etl-target-select-modal__label">컬럼 선택 (적재할 컬럼)</label>
            {columnsLoading ? (
              <p className="etl-target-select-modal__loading">컬럼 목록 로딩 중…</p>
            ) : columnsError ? (
              <p className="etl-target-select-modal__error">{columnsError}</p>
            ) : columns.length === 0 ? (
              <p className="etl-target-select-modal__hint">테이블을 선택하면 컬럼 목록이 표시됩니다.</p>
            ) : (
              <div className="etl-target-select-modal__columns">
                <div className="etl-target-select-modal__column-actions">
                  <button type="button" className="etl-target-select-modal__btn-link" onClick={selectAllColumns}>전체 선택</button>
                  <span className="etl-target-select-modal__sep">|</span>
                  <button type="button" className="etl-target-select-modal__btn-link" onClick={clearAllColumns}>전체 해제</button>
                </div>
                <ul className="etl-target-select-modal__column-list">
                  {columns.map((c) => {
                    const name = (c && c.column_name) ? String(c.column_name) : '';
                    const dtype = (c && c.data_type) ? String(c.data_type) : '';
                    const checked = selectedColumns.includes(name);
                    return (
                      <li key={name} className="etl-target-select-modal__column-item">
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn(name)}
                          />
                          <span className="etl-target-select-modal__column-name">{name}</span>
                          {dtype && <span className="etl-target-select-modal__column-type"> ({dtype})</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="etl-target-select-modal__footer">
          <button type="button" className="etl-target-select-modal__btn etl-target-select-modal__btn--secondary" onClick={onClose}>취소</button>
          <button
            type="button"
            className="etl-target-select-modal__btn etl-target-select-modal__btn--primary"
            onClick={handleApply}
            disabled={!selectedTable.trim()}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export default TargetTableSelectModal;
