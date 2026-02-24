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
 * - "새 테이블로 만들기" 선택 시 모달 내 "새 테이블명" 입력란 표시, 적용 시 newTableName 사용(폼에는 타겟 입력란 없음)
 * - 새 테이블 모드: 소스별 타겟 컬럼명 입력 + "제외" 체크(적재에서 빼기). 전부 제외 시 적용 비활성화.
 * - PK: 별도 섹션 없음. 매핑 테이블 첫 열이 "PK"(체크박스 + 기존 키면 [PK] 표시). 새 테이블/기존 매핑: PK | 소스→타겟 | 제외. 소스 없음: PK | 선택 | 컬럼(타입).
 * - onSelect(tableName, columnMapping, pkColumns). currentPkColumns로 기존 PK 디폴트 선택.
 * - sourceColumns 없을 때: 테이블(PK | 선택 | 컬럼), 전체선택/해제 링크, 적용 시 source=target 매핑 반환
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListTargetTables, etl2ListTargetColumns)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

/** 소스 추론 타입 → 적재 시 사용할 PG 타입명 */
function inferredTypeToPg(typeStr) {
  const t = (typeStr || '').toString().trim().toLowerCase();
  if (['integer', 'int'].some((x) => t === x || t.startsWith(x))) return 'BIGINT';
  if (t === 'float') return 'DOUBLE PRECISION';
  if (['boolean', 'bool'].some((x) => t === x || t.startsWith(x))) return 'BOOLEAN';
  if (['datetime', 'date', 'timestamp'].some((x) => t === x || t.includes('date') || t.includes('time'))) return 'TIMESTAMP';
  return 'TEXT';
}

const NEW_TABLE_VALUE = '__new__';

/** 형변환 실패 시 선택 옵션 (모달 내 const TDZ 방지를 위해 모듈 스코프) */
const ON_ERROR_OPTIONS = [
  { value: 'null', label: 'NULL' },
  { value: 'zero', label: '0/빈값' },
  { value: 'keep', label: '원본 유지' },
  { value: 'skip_row', label: '행 제외' },
  { value: 'fail', label: '실패' }
];

/** mappingOnError에서 sourceKey에 해당하는 on_error 값 반환 (모듈 스코프로 TDZ 방지) */
function getOnErrorValue(map, sourceKey) {
  if (!map || typeof map !== 'object') return 'null';
  const v = map[sourceKey];
  return (v != null ? String(v) : 'null').trim().replace(/\s/g, '') || 'null';
}

/** sourceColumns 항목 정규화: { name, type } */
function normalizeSourceCol(c) {
  const name = (c && (c.name ?? c.column_name)) ? String(c.name ?? c.column_name).trim() : '';
  const type = (c && (c.inferred_type ?? c.data_type)) ? String(c.inferred_type ?? c.data_type).trim() : 'text';
  return { name, type };
}

function parsePkColumns(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function TargetTableSelectModal({
  open,
  onClose,
  storageConnectionId,
  currentTargetTable,
  currentColumnMapping,
  currentPkColumns,
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
  /** 새 테이블로 만들기일 때 사용할 테이블명 (폼에 입력란 없이 모달에서만 설정) */
  const [newTableName, setNewTableName] = useState('');
  /** PK로 사용할 타겟 컬럼명 (체크박스) */
  const [selectedPkColumns, setSelectedPkColumns] = useState([]);
  /** 새 테이블 모드: 소스별 타겟 컬럼명(입력, 기본=소스명) + 제외 여부 */
  const [newTableTargetNames, setNewTableTargetNames] = useState({});
  const [newTableExcluded, setNewTableExcluded] = useState({});
  /** 컬럼별 형변환 실패 시 정책: null | zero | keep | skip_row | fail */
  const [mappingOnError, setMappingOnError] = useState({});
  /** 소스→타겟 매핑 모드: 소스별로 선택한 타겟 컬럼명 (빈 문자열 = 제외) */
  const [sourceToTarget, setSourceToTarget] = useState({});

  const prevSelectedTableRef = useRef(selectedTable);

  const sid = useMemo(() => (storageConnectionId === '' || storageConnectionId == null ? null : storageConnectionId), [storageConnectionId]);
  const mapping = useMemo(() => (Array.isArray(currentColumnMapping) ? currentColumnMapping : []), [currentColumnMapping]);
  const sourceColumns = useMemo(() => {
    const list = Array.isArray(sourceColumnsProp) ? sourceColumnsProp : [];
    return list.map(normalizeSourceCol).filter((c) => c.name);
  }, [sourceColumnsProp]);

  const hasSourceMapping = useMemo(() => sourceColumns.length > 0, [sourceColumns.length]);
  const mappingKey = useMemo(() => mapping.map((m) => `${(m && m.source) || ''}:${(m && m.target) || ''}`).join(','), [mapping]);

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
      } else if (current && sourceColumns.length > 0) {
        setSelectedTable(NEW_TABLE_VALUE);
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
  }, [sid, currentTargetTable, sourceColumns.length]);

  useEffect(() => {
    if (open) {
      loadTables();
      setColumns([]);
      setSelectedColumns([]);
      setColumnsError('');
      setNewTableName((currentTargetTable || '').trim());
    }
  }, [open, loadTables, currentTargetTable]);

  useEffect(() => {
    if (!open || !selectedTable.trim()) {
      setColumns([]);
      setSelectedColumns([]);
      return;
    }
    if (selectedTable === NEW_TABLE_VALUE) {
      setColumns([]);
      setSelectedColumns([]);
      setColumnsLoading(false);
      setColumnsError('');
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

  useEffect(() => {
    if (open && mapping.length > 0) {
      const next = {};
      mapping.forEach((m) => {
        const s = (m && m.source) ? String(m.source).trim() : '';
        if (s) next[s] = ((m.on_error != null && m.on_error !== undefined) ? String(m.on_error) : 'null').trim().toLowerCase() || 'null';
      });
      setMappingOnError((prev) => (Object.keys(next).length ? { ...prev, ...next } : prev));
    }
  }, [open, mappingKey]);

  useEffect(() => {
    const prev = prevSelectedTableRef.current;
    prevSelectedTableRef.current = selectedTable;
    if (selectedTable !== NEW_TABLE_VALUE || !sourceColumns.length) return;
    const cameFromExistingTable = prev && prev !== '' && prev !== NEW_TABLE_VALUE;
    if (cameFromExistingTable) {
      const next = {};
      sourceColumns.forEach((src) => { next[src.name] = src.name; });
      setNewTableTargetNames(next);
      setNewTableExcluded({});
    } else if (mapping.length > 0) {
      const next = {};
      const excluded = {};
      sourceColumns.forEach((src) => {
        const m = mapping.find((x) => (x && x.source) === src.name);
        if (m && m.target) {
          next[src.name] = String(m.target).trim();
          excluded[src.name] = false;
        } else {
          next[src.name] = src.name;
          excluded[src.name] = true;
        }
      });
      setNewTableTargetNames(next);
      setNewTableExcluded(excluded);
    } else {
      const next = {};
      sourceColumns.forEach((src) => { next[src.name] = src.name; });
      setNewTableTargetNames(next);
      setNewTableExcluded({});
    }
  }, [selectedTable, sourceColumns, mapping.length]);

  const setNewTableExcludedFor = (sourceName, excluded) => {
    setNewTableExcluded((prev) => ({ ...prev, [sourceName]: excluded }));
  };

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

  const newTableAllExcluded = useMemo(
    () => selectedTable === NEW_TABLE_VALUE && sourceColumns.length > 0 && sourceColumns.every((src) => newTableExcluded[src.name]),
    [selectedTable, sourceColumns, newTableExcluded]
  );

  /** 적용 시 테이블에 들어갈 타겟 컬럼명 목록 (PK 선택 후보) */
  const targetColumnNamesForPk = useMemo(() => {
    if (selectedTable === NEW_TABLE_VALUE && sourceColumns.length > 0) {
      return sourceColumns
        .filter((src) => !newTableExcluded[src.name])
        .map((src) => ((newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name))
        .filter(Boolean);
    }
    if (hasSourceMapping && sourceColumns.length > 0 && columns.length > 0) {
      const names = sourceColumns.map((src) => sourceToTarget[src.name]).filter(Boolean);
      return [...new Set(names)];
    }
    if (columns.length > 0 && selectedColumns.length > 0) {
      return selectedColumns.slice();
    }
    return [];
  }, [selectedTable, sourceColumns, newTableExcluded, newTableTargetNames, hasSourceMapping, columns.length, sourceToTarget, selectedColumns]);

  useEffect(() => {
    if (!open) return;
    if (targetColumnNamesForPk.length === 0) {
      return;
    }
    const isCurrentTable = (selectedTable || '').trim() === (currentTargetTable || '').trim();
    const current = isCurrentTable ? parsePkColumns(currentPkColumns) : [];
    const valid = current.filter((n) => targetColumnNamesForPk.includes(n));
    setSelectedPkColumns(valid);
  }, [open, currentPkColumns, currentTargetTable, selectedTable, targetColumnNamesForPk.join(',')]);

  /** 선택된 테이블이 폼의 현재 테이블과 같을 때만 기존 PK 표시([PK] 뱃지용) */
  const effectivePkForDisplay = useMemo(() => {
    const isCurrentTable = (selectedTable || '').trim() === (currentTargetTable || '').trim();
    return isCurrentTable ? parsePkColumns(currentPkColumns) : [];
  }, [selectedTable, currentTargetTable, currentPkColumns]);

  const togglePkColumn = (name) => {
    setSelectedPkColumns((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleApply = useCallback(() => {
    if (selectedTable === NEW_TABLE_VALUE) {
      const tableName = (newTableName || '').trim().replace(/\s+/g, '_') || (currentTargetTable || '').trim() || 'new_table';
      if (!tableName) return;
      const columnMapping = sourceColumns
        .filter((src) => !newTableExcluded[src.name])
        .map((src) => ({
          source: src.name,
          target: (newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name,
          type: inferredTypeToPg(src.type),
          on_error: getOnErrorValue(mappingOnError, src.name)
        }));
      const pkCols = targetColumnNamesForPk.filter((n) => selectedPkColumns.includes(n)).join(',').trim() || '';
      if (onSelect) onSelect(tableName, columnMapping, pkCols);
      onClose();
      return;
    }

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
          type: (tgtCol.data_type && String(tgtCol.data_type).toUpperCase()) || 'TEXT',
          on_error: getOnErrorValue(mappingOnError, src.name)
        });
      });
      const pkCols = targetColumnNamesForPk.filter((n) => selectedPkColumns.includes(n)).join(',').trim() || '';
      if (onSelect) onSelect(tableName, columnMapping, pkCols);
      onClose();
      return;
    }

    const selectedList = (columns || []).filter((c) => selectedColumns.includes((c && c.column_name) ? String(c.column_name) : ''));
    const columnMapping = selectedList.map((c) => {
      const name = (c && c.column_name) ? String(c.column_name) : '';
      return {
        source: name,
        target: name,
        type: (c && c.data_type) ? String(c.data_type).toUpperCase() : 'TEXT',
        on_error: getOnErrorValue(mappingOnError, name)
      };
    });
    const pkCols = targetColumnNamesForPk.filter((n) => selectedPkColumns.includes(n)).join(',').trim() || '';
    if (onSelect) onSelect(tableName, columnMapping, pkCols);
    onClose();
  }, [
    selectedTable, newTableName, currentTargetTable, sourceColumns, newTableExcluded, newTableTargetNames,
    mappingOnError, targetColumnNamesForPk, selectedPkColumns, onSelect, onClose,
    hasSourceMapping, columns, sourceToTarget, targetColByName, selectedColumns
  ]);

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
            아래에서 <strong>저장할 DB</strong>에 있는 테이블을 고르고, 필요하면 소스 컬럼을 타겟 컬럼에 맞춰 주세요. 숫자/날짜 등 타입이 다를 때는 <strong>변환 실패 시</strong>에서 NULL·0·원본 유지·행 제외·실패 중 동작을 선택할 수 있습니다. &quot;적용&quot;을 누르면 테이블명과 매핑이 저장됩니다.
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

          {hasSourceMapping && sourceColumns.length > 0 ? (
            <div className="etl-target-select-modal__row">
              <label className="etl-target-select-modal__label">소스 → 타겟 컬럼 매핑 (타입이 다른 경우 매핑 불가)</label>
              {selectedTable === NEW_TABLE_VALUE ? (
                <>
                  <p className="etl-target-select-modal__hint">새 테이블 컬럼명을 정하세요. PK로 쓸 컬럼은 PK 체크, 적재에서 빼려면 제외를 체크하세요. 기존 PK로 설정돼 있던 컬럼은 [PK]로 표시됩니다.</p>
                  <div className="etl-target-select-modal__mapping-wrap">
                    <table className="etl-target-select-modal__mapping-table">
                      <thead>
                        <tr>
                          <th className="etl-target-select-modal__th--pk">PK</th>
                          <th>소스 컬럼 (타입)</th>
                          <th>→</th>
                          <th>타겟 컬럼명</th>
                          <th className="etl-target-select-modal__th--on-error" title="형변환 실패 시 동작">변환 실패 시</th>
                          <th className="etl-target-select-modal__th--exclude">제외</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceColumns.map((src) => {
                          const targetColName = ((newTableTargetNames[src.name] ?? src.name).trim().replace(/\s+/g, '_') || src.name);
                          const excluded = !!newTableExcluded[src.name];
                          const wasPk = effectivePkForDisplay.includes(targetColName);
                          return (
                            <tr key={src.name} className={excluded ? 'etl-target-select-modal__row--excluded' : ''}>
                              <td className="etl-target-select-modal__cell--pk">
                                {excluded ? (
                                  '—'
                                ) : (
                                  <label className="etl-target-select-modal__pk-cell-label">
                                    <input
                                      type="checkbox"
                                      checked={selectedPkColumns.includes(targetColName)}
                                      onChange={() => togglePkColumn(targetColName)}
                                      className="etl-target-select-modal__pk-checkbox"
                                    />
                                    {wasPk && <span className="etl-target-select-modal__pk-badge">[PK]</span>}
                                  </label>
                                )}
                              </td>
                              <td className="etl-target-select-modal__mapping-source">
                                <span className="etl-target-select-modal__column-name">{src.name}</span>
                                <span className="etl-target-select-modal__column-type"> ({src.type})</span>
                              </td>
                              <td className="etl-target-select-modal__mapping-arrow">→</td>
                              <td className="etl-target-select-modal__mapping-target">
                                <input
                                  type="text"
                                  value={newTableTargetNames[src.name] ?? src.name}
                                  onChange={(e) => setNewTableTargetNames((prev) => ({ ...prev, [src.name]: e.target.value }))}
                                  placeholder={src.name}
                                  className="etl-target-select-modal__input--target-name"
                                  disabled={!!newTableExcluded[src.name]}
                                />
                              </td>
                              <td className="etl-target-select-modal__cell--on-error">
                                {excluded ? '—' : (
                                  <select
                                    value={getOnErrorValue(mappingOnError, src.name)}
                                    onChange={(e) => setMappingOnError((prev) => ({ ...prev, [src.name]: e.target.value }))}
                                    className="etl-target-select-modal__select--on-error"
                                    title="형변환 실패 시 NULL·0·원본 유지·행 제외·실패 중 선택"
                                  >
                                    {ON_ERROR_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="etl-target-select-modal__cell--exclude">
                                <label className="etl-target-select-modal__exclude-label">
                                  <input
                                    type="checkbox"
                                    checked={!!newTableExcluded[src.name]}
                                    onChange={(e) => setNewTableExcludedFor(src.name, e.target.checked)}
                                  />
                                  <span>제외</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : columnsLoading ? (
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
                        <th className="etl-target-select-modal__th--pk">PK</th>
                        <th>소스 컬럼 (타입)</th>
                        <th>→</th>
                        <th>타겟 컬럼</th>
                        <th className="etl-target-select-modal__th--on-error" title="형변환 실패 시 동작">변환 실패 시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceColumns.map((src) => {
                        const targetColName = sourceToTarget[src.name] ?? '';
                        const wasPk = targetColName && effectivePkForDisplay.includes(targetColName);
                        return (
                          <tr key={src.name}>
                            <td className="etl-target-select-modal__cell--pk">
                              {!targetColName ? (
                                '—'
                              ) : (
                                <label className="etl-target-select-modal__pk-cell-label">
                                  <input
                                    type="checkbox"
                                    checked={selectedPkColumns.includes(targetColName)}
                                    onChange={() => togglePkColumn(targetColName)}
                                    className="etl-target-select-modal__pk-checkbox"
                                  />
                                  {wasPk && <span className="etl-target-select-modal__pk-badge">[PK]</span>}
                                </label>
                              )}
                            </td>
                            <td className="etl-target-select-modal__mapping-source">
                              <span className="etl-target-select-modal__column-name">{src.name}</span>
                              <span className="etl-target-select-modal__column-type"> ({src.type})</span>
                            </td>
                            <td className="etl-target-select-modal__mapping-arrow">→</td>
                            <td className="etl-target-select-modal__mapping-target">
                              <select
                                value={targetColName}
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
                            <td className="etl-target-select-modal__cell--on-error">
                              {!targetColName ? '—' : (
                                <select
                                  value={getOnErrorValue(mappingOnError, src.name)}
                                  onChange={(e) => setMappingOnError((prev) => ({ ...prev, [src.name]: e.target.value }))}
                                  className="etl-target-select-modal__select--on-error"
                                  title="형변환 실패 시 NULL·0·원본 유지·행 제외·실패 중 선택"
                                >
                                  {ON_ERROR_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="etl-target-select-modal__row">
              <label className="etl-target-select-modal__label">컬럼 매핑 (적재할 컬럼 선택 — 선택한 컬럼은 소스→타겟 동일명으로 매핑. PK로 쓸 컬럼은 PK 체크.)</label>
              {columnsLoading ? (
                <p className="etl-target-select-modal__loading">컬럼 목록 로딩 중…</p>
              ) : columnsError ? (
                <p className="etl-target-select-modal__error">{columnsError}</p>
              ) : columns.length === 0 ? (
                <p className="etl-target-select-modal__hint">테이블을 선택하면 컬럼 목록이 표시됩니다.</p>
              ) : (
                <>
                  <div className="etl-target-select-modal__column-actions">
                    <button type="button" className="etl-target-select-modal__btn-link" onClick={selectAllColumns}>전체 선택</button>
                    <span className="etl-target-select-modal__sep">|</span>
                    <button type="button" className="etl-target-select-modal__btn-link" onClick={clearAllColumns}>전체 해제</button>
                  </div>
                  <div className="etl-target-select-modal__mapping-wrap">
                    <table className="etl-target-select-modal__mapping-table etl-target-select-modal__mapping-table--no-source">
                      <thead>
                        <tr>
                          <th className="etl-target-select-modal__th--pk">PK</th>
                          <th className="etl-target-select-modal__th--include">선택</th>
                          <th>컬럼 (타입)</th>
                          <th className="etl-target-select-modal__th--on-error" title="형변환 실패 시 동작">변환 실패 시</th>
                        </tr>
                      </thead>
                    <tbody>
                      {columns.map((c) => {
                        const name = (c && c.column_name) ? String(c.column_name) : '';
                        const dtype = (c && c.data_type) ? String(c.data_type) : '';
                        const checked = selectedColumns.includes(name);
                        const wasPk = effectivePkForDisplay.includes(name);
                        return (
                          <tr key={name}>
                            <td className="etl-target-select-modal__cell--pk">
                              <label className="etl-target-select-modal__pk-cell-label">
                                <input
                                  type="checkbox"
                                  checked={selectedPkColumns.includes(name)}
                                  onChange={() => togglePkColumn(name)}
                                  className="etl-target-select-modal__pk-checkbox"
                                />
                                {wasPk && <span className="etl-target-select-modal__pk-badge">[PK]</span>}
                              </label>
                            </td>
                            <td className="etl-target-select-modal__cell--include">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleColumn(name)}
                                />
                              </label>
                            </td>
                            <td className="etl-target-select-modal__mapping-source">
                              <span className="etl-target-select-modal__column-name">{name}</span>
                              {dtype && <span className="etl-target-select-modal__column-type"> ({dtype})</span>}
                            </td>
                            <td className="etl-target-select-modal__cell--on-error">
                              <select
                                value={getOnErrorValue(mappingOnError, name)}
                                onChange={(e) => setMappingOnError((prev) => ({ ...prev, [name]: e.target.value }))}
                                className="etl-target-select-modal__select--on-error"
                                title="형변환 실패 시 NULL·0·원본 유지·행 제외·실패 중 선택"
                              >
                                {ON_ERROR_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
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
            disabled={selectedTable === NEW_TABLE_VALUE ? (!(newTableName || '').trim() || newTableAllExcluded) : !selectedTable.trim()}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export default TargetTableSelectModal;
