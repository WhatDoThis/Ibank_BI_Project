/**
 * packages/etl2/components/TargetTableSelectModal.jsx (테이블선택 및 컬럼매핑 모달)
 * ================================================================================
 * Phase 3: 저장 DB(선택된 storage_connection_id) 기준 테이블·컬럼 조회.
 * sourceColumns 있으면: 소스 컬럼별로 타겟 매핑 제안(이름/순서) + 커스텀 드롭다운(제외 가능). 타입 불일치 시 알럿.
 * sourceColumns 없으면: 타겟 테이블 + 적재할 컬럼 체크박스만 (기존 동작).
 *
 * [Main Functions]
 * ===========
 * - open 시 etl2ListTargetTables(storage_connection_id)로 테이블 목록 로드
 * - 테이블 선택 시 etl2ListTargetColumns로 타겟 컬럼 로드
 * - sourceColumns 있을 때: 소스별 매핑 행(드롭다운), 타입 호환 검사, 적용 시 onSelect(tableName, columnMapping)
 * - sourceColumns 없을 때: 체크박스로 적재 컬럼 선택, 적용 시 source=target 매핑 반환
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListTargetTables, etl2ListTargetColumns)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { etl2ListTargetTables, etl2ListTargetColumns } from '@/shared/api/client';

/** 소스/타겟 타입을 하나의 "패밀리"로 정규화. 호환 여부는 같은 패밀리만 허용 */
function typeFamily(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int', 'int4', 'int8', 'bigint', 'smallint', 'serial', 'bigserial'].some((x) => t === x || t.startsWith(x))) return 'integer';
  if (['float', 'double', 'double precision', 'real', 'numeric', 'decimal'].some((x) => t === x || t.startsWith(x))) return 'float';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'boolean';
  if (['datetime', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'interval', 'year'].some((x) => t === x || t.includes('date') || t.includes('time'))) return 'datetime';
  return 'text'; // text, varchar, char, character varying 등
}

function isTypeCompatible(sourceType, targetType) {
  return typeFamily(sourceType) === typeFamily(targetType);
}

/** sourceColumns 항목 정규화: { name, type } */
function normalizeSourceCol(c) {
  const name = (c && (c.name ?? c.column_name)) ? String(c.name ?? c.column_name).trim() : '';
  const type = (c && (c.inferred_type ?? c.data_type)) ? String(c.inferred_type ?? c.data_type).trim() : 'text';
  return { name, type };
}

function TargetTableSelectModal({
  open,
  onClose,
  storageConnectionId,
  currentTargetTable,
  currentColumnMapping,
  sourceColumns: sourceColumnsProp,
  onSelect
}) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [tablesError, setTablesError] = useState('');
  const [columnsError, setColumnsError] = useState('');

  const sid = storageConnectionId === '' || storageConnectionId == null ? null : storageConnectionId;
  const mapping = Array.isArray(currentColumnMapping) ? currentColumnMapping : [];
  const sourceColumns = useMemo(() => {
    const list = Array.isArray(sourceColumnsProp) ? sourceColumnsProp : [];
    return list.map(normalizeSourceCol).filter((c) => c.name);
  }, [sourceColumnsProp]);

  const hasSourceMapping = sourceColumns.length > 0;

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError('');
    try {
      const res = await etl2ListTargetTables(sid);
      const list = res.tables || [];
      setTables(list);
      const current = (currentTargetTable || '').trim();
      if (current && list.some((t) => (t && t.table_name) === current)) {
        setSelectedTable(current);
      } else {
        setSelectedTable('');
      }
    } catch (err) {
      setTablesError(err.message || '테이블 목록을 불러오지 못했습니다.');
      setTables([]);
      setSelectedTable('');
    } finally {
      setTablesLoading(false);
    }
  }, [sid, currentTargetTable]);

  useEffect(() => {
    if (open) {
      loadTables();
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
        const colNames = cols.map((c) => (c && c.column_name ? String(c.column_name) : '').trim()).filter(Boolean);
        if (mapping.length > 0) {
          const fromMapping = mapping.map((m) => (m && m.target ? String(m.target).trim() : '')).filter(Boolean);
          setSelectedColumns(fromMapping.filter((n) => colNames.includes(n)));
        } else {
          setSelectedColumns(colNames);
        }
      })
      .catch((err) => {
        setColumnsError(err.message || '컬럼 목록을 불러오지 못했습니다.');
        setColumns([]);
        setSelectedColumns([]);
      })
      .finally(() => setColumnsLoading(false));
  }, [open, selectedTable, sid, mapping.length]);

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

  // --- 소스→타겟 매핑 모드: 소스별로 선택한 타겟 컬럼명 (빈 문자열 = 제외)
  const [sourceToTarget, setSourceToTarget] = useState({});
  const targetColByName = useMemo(() => {
    const m = {};
    (columns || []).forEach((c) => {
      const n = (c && c.column_name) ? String(c.column_name).trim() : '';
      if (n) m[n] = c;
    });
    return m;
  }, [columns]);

  const buildDefaultSourceToTarget = useCallback(() => {
    const result = {};
    const used = new Set();
    sourceColumns.forEach((src, idx) => {
      const targetCols = columns || [];
      const byName = targetCols.find((c) => {
        const name = (c && c.column_name) ? String(c.column_name).trim() : '';
        return name && (src.name === name || name === src.name);
      });
      if (byName && isTypeCompatible(src.type, (byName.data_type || ''))) {
        const tn = (byName.column_name && String(byName.column_name).trim()) || '';
        if (tn && !used.has(tn)) {
          result[src.name] = tn;
          used.add(tn);
          return;
        }
      }
      const byIndex = targetCols[idx];
      if (byIndex) {
        const tn = (byIndex.column_name && String(byIndex.column_name).trim()) || '';
        if (tn && isTypeCompatible(src.type, byIndex.data_type || '') && !used.has(tn)) {
          result[src.name] = tn;
          used.add(tn);
          return;
        }
      }
      const firstCompatible = targetCols.find((c) => {
        const tn = (c && c.column_name) ? String(c.column_name).trim() : '';
        return tn && !used.has(tn) && isTypeCompatible(src.type, c.data_type || '');
      });
      if (firstCompatible) {
        const tn = (firstCompatible.column_name && String(firstCompatible.column_name).trim()) || '';
        if (tn) {
          result[src.name] = tn;
          used.add(tn);
        }
      }
    });
    return result;
  }, [sourceColumns, columns]);

  const mappingKey = useMemo(() => mapping.map((m) => `${(m && m.source) || ''}:${(m && m.target) || ''}`).join(','), [mapping]);

  useEffect(() => {
    if (!hasSourceMapping || !columns.length) {
      setSourceToTarget({});
      return;
    }
    if (mapping.length > 0) {
      const fromMapping = {};
      mapping.forEach((m) => {
        const src = (m && m.source) ? String(m.source).trim() : '';
        const tgt = (m && m.target) ? String(m.target).trim() : '';
        if (src && tgt) fromMapping[src] = tgt;
      });
      setSourceToTarget(fromMapping);
      return;
    }
    setSourceToTarget(buildDefaultSourceToTarget());
  }, [hasSourceMapping, columns.length, mappingKey, buildDefaultSourceToTarget]);

  const setMappingForSource = (sourceName, targetColumnName) => {
    if (targetColumnName === '') {
      setSourceToTarget((prev) => {
        const next = { ...prev };
        delete next[sourceName];
        return next;
      });
      return;
    }
    const srcCol = sourceColumns.find((c) => c.name === sourceName);
    const tgtCol = targetColByName[targetColumnName];
    if (!srcCol || !tgtCol) return;
    if (!isTypeCompatible(srcCol.type, tgtCol.data_type || '')) {
      window.alert('선택한 타겟 컬럼의 타입이 소스와 맞지 않습니다. 같은 타입 계열만 매핑할 수 있습니다.');
      return;
    }
    setSourceToTarget((prev) => ({ ...prev, [sourceName]: targetColumnName }));
  };

  function handleApply() {
    const tableName = selectedTable.trim();
    if (!tableName) return;

    if (hasSourceMapping && sourceColumns.length > 0 && columns.length > 0) {
      const columnMapping = [];
      sourceColumns.forEach((src) => {
        const targetName = sourceToTarget[src.name];
        if (!targetName) return;
        const tgtCol = targetColByName[targetName];
        if (!tgtCol) return;
        columnMapping.push({
          source: src.name,
          target: targetName,
          type: (tgtCol.data_type && String(tgtCol.data_type).toUpperCase()) || 'TEXT'
        });
      });
      if (onSelect) onSelect(tableName, columnMapping);
      onClose();
      return;
    }

    const selectedList = (columns || []).filter((c) => selectedColumns.includes((c && c.column_name) ? String(c.column_name) : ''));
    const columnMapping = selectedList.map((c) => ({
      source: (c && c.column_name) ? String(c.column_name) : '',
      target: (c && c.column_name) ? String(c.column_name) : '',
      type: (c && c.data_type) ? String(c.data_type).toUpperCase() : 'TEXT'
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
          <p className="etl-target-select-modal__intro">
            아래에서 <strong>저장할 DB</strong>에 있는 테이블을 고르고, 필요하면 소스 컬럼을 타겟 컬럼에 맞춰 주세요. &quot;적용&quot;을 누르면 테이블명과 매핑이 저장됩니다.
          </p>
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

          {hasSourceMapping && sourceColumns.length > 0 ? (
            <div className="etl-target-select-modal__row">
              <label className="etl-target-select-modal__label">소스 → 타겟 컬럼 매핑 (타입이 다른 경우 매핑 불가)</label>
              {columnsLoading ? (
                <p className="etl-target-select-modal__loading">타겟 컬럼 로딩 중…</p>
              ) : columnsError ? (
                <p className="etl-target-select-modal__error">{columnsError}</p>
              ) : columns.length === 0 ? (
                <p className="etl-target-select-modal__hint">테이블을 선택하면 매핑할 타겟 컬럼이 표시됩니다.</p>
              ) : (
                <div className="etl-target-select-modal__mapping-wrap">
                  <table className="etl-target-select-modal__mapping-table">
                    <thead>
                      <tr>
                        <th>소스 컬럼 (타입)</th>
                        <th>→</th>
                        <th>타겟 컬럼</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceColumns.map((src) => (
                        <tr key={src.name}>
                          <td className="etl-target-select-modal__mapping-source">
                            <span className="etl-target-select-modal__column-name">{src.name}</span>
                            <span className="etl-target-select-modal__column-type"> ({src.type})</span>
                          </td>
                          <td className="etl-target-select-modal__mapping-arrow">→</td>
                          <td className="etl-target-select-modal__mapping-target">
                            <select
                              value={sourceToTarget[src.name] ?? ''}
                              onChange={(e) => setMappingForSource(src.name, e.target.value)}
                              className="etl-target-select-modal__select etl-target-select-modal__select--mapping"
                            >
                              <option value="">제외</option>
                              {(columns || []).map((c) => {
                                const name = (c && c.column_name) ? String(c.column_name) : '';
                                const dtype = (c && c.data_type) ? String(c.data_type) : '';
                                const compatible = isTypeCompatible(src.type, dtype);
                                return (
                                  <option key={name} value={name} disabled={!compatible}>
                                    {name} ({dtype}){compatible ? '' : ' — 타입 불일치'}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="etl-target-select-modal__row">
              <label className="etl-target-select-modal__label">컬럼 매핑 (적재할 컬럼 선택 — 선택한 컬럼은 소스→타겟 동일명으로 매핑)</label>
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
          )}
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
