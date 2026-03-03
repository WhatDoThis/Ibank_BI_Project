/**
 * packages/etl2/components/TargetTableSelectModal.jsx (테이블선택 및 컬럼매핑 모달)
 * ================================================================================
 * Phase 3: 저장 DB(선택된 storage_connection_id) 기준 테이블·컬럼 조회.
 * sourceColumns 있으면: 소스 컬럼별로 타겟 매핑 제안(이름/순서) + 커스텀 드롭다운(제외 가능). 타입 불일치 시 알럿.
 * sourceColumns 없으면: 타겟 테이블 + 적재할 컬럼 체크박스만 (기존 동작).
 * sourceIndexes 있으면(DB 연동): 매핑 테이블에 PK·INDEX 열 통합. 소스 PK/인덱스 컬럼은 ✓(읽기 전용), 제외 행은 —. 타겟에는 소스 인덱스 전부 반영(선택 UI 없음).
 * sourceIndexes 없으면(파일 업로드/배치): 인덱스(선택) 수동 목록(+ 인덱스 추가).
 *
 * [Main Functions]
 * ===========
 * - open 시 etl2ListTargetTables(storage_connection_id)로 테이블 목록 로드
 * - 테이블 선택 시 etl2ListTargetColumns로 타겟 컬럼 로드
 * - sourceColumns 있을 때: 소스별 매핑 행(드롭다운), 타입 호환 검사, 적용 시 onSelect(tableName, columnMapping, pkColumns, indexDefinitions)
 * - "새 테이블로 만들기" 선택 시 모달 내 "새 테이블명" 입력란 표시, 적용 시 newTableName 사용
 * - PK/INDEX: 매핑 테이블에서 PK 오른쪽에 INDEX 열. DB 연동 시 소스 기준 컬럼은 ✓(체크 이모티콘)만 표시, 제외 행은 —. 테이블 생성/이관 시 제외 컬럼은 constraint 미적용.
 * - 인덱스: sourceIndexes 있으면 인라인 반영 체크; 없으면(파일 업로드) 매핑 테이블 아래 "인덱스 추가"로 다중/단일 인덱스 추가, 위 테이블 INDEX 열에 ✓ 반영.
 * - onSelect(tableName, columnMapping, pkColumns, indexDefinitions). currentPkColumns/currentIndexDefinitions로 기존 값 반영.
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListTargetTables, etl2ListTargetColumns, etl2ListTransformRules, etl2CreateTransformRule, etl2DeleteTransformRule)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { etl2ListTargetTables, etl2ListTargetColumns, etl2ListTransformRules, etl2CreateTransformRule, etl2DeleteTransformRule } from '@/shared/api/client';
import { normalizeStorageConnectionId } from '../utils/storageDb.js';

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

/** 변환 종류: 없음 | 정리 | 타입 변환 | 정리+타입 변환 | 값 매핑 (derived, masking은 이번 UI 미포함) */
const TRANSFORM_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'cleansing', label: '정리' },
  { value: 'type_cast', label: '타입 변환' },
  { value: 'cleansing_and_type_cast', label: '정리 + 타입 변환' },
  { value: 'code_map', label: '값 매핑' }
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

/** 값 매핑 인라인 편집: 원본값→변환값 쌍, [+ 추가], 매핑 안 된 값: NULL/유지/기본값 */
function CodeMapInlineEditor({ sourceName, config, onChange }) {
  const map = config.map || {};
  const entries = Object.entries(map);
  const unmapped = config.unmapped || 'null';
  const defaultVal = config.default_value ?? '';

  const setMap = (next) => onChange({ ...config, map: next });
  const setUnmapped = (v) => onChange({ ...config, unmapped: v });
  const setDefault = (v) => onChange({ ...config, default_value: v });

  const addRow = () => {
    const next = { ...map, '': '' };
    setMap(next);
  };
  const setKey = (idx, key) => {
    const keys = Object.keys(map);
    const oldKey = keys[idx];
    const val = map[oldKey];
    const newMap = {};
    for (const k of keys) if (k !== oldKey) newMap[k] = map[k];
    newMap[key] = val;
    setMap(newMap);
  };
  const setVal = (idx, val) => {
    const keys = Object.keys(map);
    const k = keys[idx];
    if (k === undefined) return;
    const newMap = { ...map, [k]: val };
    setMap(newMap);
  };
  const removeRow = (idx) => {
    const keys = Object.keys(map);
    const k = keys[idx];
    if (k === undefined) return;
    const newMap = { ...map };
    delete newMap[k];
    setMap(newMap);
  };

  return (
    <div className="etl-target-select-modal__code-map-editor" data-source={sourceName}>
      <div className="etl-target-select-modal__code-map-rows">
        {entries.map(([k, v], idx) => (
          <div key={idx} className="etl-target-select-modal__code-map-row">
            <input type="text" value={k} onChange={(e) => setKey(idx, e.target.value)} placeholder="원본값" className="etl-target-select-modal__input--code-map" />
            <span>→</span>
            <input type="text" value={v} onChange={(e) => setVal(idx, e.target.value)} placeholder="변환값" className="etl-target-select-modal__input--code-map" />
            <button type="button" className="etl-target-select-modal__btn--code-map-remove" onClick={() => removeRow(idx)} aria-label="삭제">×</button>
          </div>
        ))}
      </div>
      <button type="button" className="etl-target-select-modal__btn-link" onClick={addRow}>+ 추가</button>
      <div className="etl-target-select-modal__code-map-unmapped">
        <span>매핑 안 된 값:</span>
        <select value={unmapped} onChange={(e) => setUnmapped(e.target.value)} className="etl-target-select-modal__select--unmapped">
          <option value="null">NULL</option>
          <option value="keep">유지</option>
          <option value="default">기본값</option>
        </select>
        {unmapped === 'default' && (
          <input type="text" value={defaultVal} onChange={(e) => setDefault(e.target.value)} placeholder="기본값" className="etl-target-select-modal__input--code-map-default" />
        )}
      </div>
    </div>
  );
}

function TargetTableSelectModal({
  open,
  onClose,
  storageConnectionId,
  currentTargetTable,
  currentColumnMapping,
  currentPkColumns,
  sourceColumns: sourceColumnsProp,
  sourceIndexes: sourceIndexesProp = [],
  currentIndexDefinitions = [],
  pkReadOnlyFromSource = false,
  etlTableId = null,
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
  /** 컬럼별 변환 종류: none | cleansing | type_cast | cleansing_and_type_cast | code_map */
  const [transformKind, setTransformKind] = useState({});
  /** 값 매핑(code_map) 설정: { [sourceName]: { map: { [원본값]: 변환값 }, unmapped: 'null'|'keep'|'default', default_value? } } */
  const [codeMapConfig, setCodeMapConfig] = useState({});
  /** 값 매핑 인라인 편집 열림: sourceName → true */
  const [codeMapEditorOpen, setCodeMapEditorOpen] = useState({});
  /** 변환 열 안내 모달 표시 여부 */
  const [showTransformHelpModal, setShowTransformHelpModal] = useState(false);
  /** 수동 인덱스 목록(다중 인덱스). 파일 업로드/배치에서 소스 인덱스 없을 때 사용. */
  const [customIndexDefinitions, setCustomIndexDefinitions] = useState([]);

  const prevSelectedTableRef = useRef(selectedTable);
  /** 모달이 열릴 때만 부모 currentPkColumns로 selectedPkColumns 초기화. 이후 targetColumnNamesForPk 변경 시 사용자 선택을 덮어쓰지 않음(파일 업로드 시 PK 체크 후에도 유지). */
  const pkSyncedForOpenRef = useRef(false);

  const sourceIndexes = useMemo(() => Array.isArray(sourceIndexesProp) ? sourceIndexesProp : [], [sourceIndexesProp]);
  /** 소스 PK 컬럼 문자열 (is_primary인 인덱스의 columns). DB 연동 시 읽기 전용 표시용 */
  const sourcePkFromSource = useMemo(() => {
    const primary = sourceIndexes.find((i) => i && i.is_primary);
    if (!primary || !Array.isArray(primary.columns)) return '';
    return primary.columns.join(', ');
  }, [sourceIndexes]);
  /** PK가 소스에서 왔을 때 선택할 컬럼명 목록 (타겟 컬럼명과 매칭되는 것만) */
  const sourcePkColumnNames = useMemo(() => {
    const primary = sourceIndexes.find((i) => i && i.is_primary);
    if (!primary || !Array.isArray(primary.columns)) return [];
    return primary.columns.map((c) => (c && String(c).trim())).filter(Boolean);
  }, [sourceIndexes]);
  /** 소스 인덱스 중 PK 제외 (타겟에 생성할 인덱스 후보) */
  const nonPrimarySourceIndexes = useMemo(
    () => sourceIndexes.filter((i) => i && !i.is_primary),
    [sourceIndexes]
  );
  /** 소스 인덱스(PK 제외)에 포함된 타겟 컬럼명 집합. 매핑 테이블 INDEX 열에 ✓ 표시용. DB 연동 시 타겟에 소스 인덱스 전부 반영. */
  const targetColumnsInReflectedIndexes = useMemo(() => {
    const set = new Set();
    nonPrimarySourceIndexes.forEach((idx) => {
      const cols = Array.isArray(idx.columns) ? idx.columns : [];
      cols.forEach((c) => set.add(String(c).trim()));
    });
    return set;
  }, [nonPrimarySourceIndexes]);
  /** 파일 업로드 시 수동 추가 인덱스에 포함된 타겟 컬럼명 집합. 매핑 테이블 INDEX 열에 ✓ 표시용 */
  const targetColumnsInCustomIndexes = useMemo(() => {
    const set = new Set();
    (customIndexDefinitions || []).forEach((def) => {
      const cols = Array.isArray(def.columns) ? def.columns : [];
      cols.forEach((c) => set.add(String(c).trim()));
    });
    return set;
  }, [customIndexDefinitions]);

  const sid = useMemo(() => normalizeStorageConnectionId(storageConnectionId), [storageConnectionId]);
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
    if (!open) {
      pkSyncedForOpenRef.current = false;
      return;
    }
    if (targetColumnNamesForPk.length === 0) return;
    if (pkReadOnlyFromSource && sourcePkColumnNames.length > 0) {
      const valid = sourcePkColumnNames.filter((n) => targetColumnNamesForPk.includes(n));
      setSelectedPkColumns(valid);
      pkSyncedForOpenRef.current = true;
      return;
    }
    if (!pkSyncedForOpenRef.current) {
      const isCurrentTable = (selectedTable || '').trim() === (currentTargetTable || '').trim();
      const current = isCurrentTable ? parsePkColumns(currentPkColumns) : [];
      const valid = current.filter((n) => targetColumnNamesForPk.includes(n));
      setSelectedPkColumns(valid);
      pkSyncedForOpenRef.current = true;
    } else {
      setSelectedPkColumns((prev) => prev.filter((n) => targetColumnNamesForPk.includes(n)));
    }
  }, [open, currentPkColumns, currentTargetTable, selectedTable, targetColumnNamesForPk.join(','), pkReadOnlyFromSource, sourcePkColumnNames.join(',')]);

  useEffect(() => {
    if (!open) return;
    if (sourceIndexes.length === 0) {
      if (currentIndexDefinitions.length > 0) {
        setCustomIndexDefinitions(
          currentIndexDefinitions.map((d) => ({
            index_name: (d && d.index_name) ? String(d.index_name).trim() : '',
            columns: Array.isArray(d && d.columns) ? d.columns : [],
            is_unique: !!(d && d.is_unique)
          }))
        );
      } else {
        setCustomIndexDefinitions([]);
      }
    }
  }, [open, sourceIndexes.length, currentIndexDefinitions]);

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

  /** 현재 모달 상태에서 변환 룰 배열 조립 (적용 시 저장용). apply_order = 컬럼인덱스*10 + 서브인덱스 */
  const getAssembledRules = useCallback(() => {
    const list = selectedTable === NEW_TABLE_VALUE
      ? sourceColumns.filter((src) => !newTableExcluded[src.name])
      : sourceColumns.filter((src) => sourceToTarget[src.name]);
    const rules = [];
    list.forEach((src, idx) => {
      const targetName = selectedTable === NEW_TABLE_VALUE
        ? ((newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name)
        : sourceToTarget[src.name];
      if (!targetName) return;
      const kind = transformKind[src.name] || 'none';
      if (kind === 'none') return;
      const baseOrder = idx * 10;
      const onError = getOnErrorValue(mappingOnError, src.name);
      const pgType = selectedTable === NEW_TABLE_VALUE
        ? inferredTypeToPg(src.type)
        : (targetColByName[targetName]?.data_type || 'TEXT');
      if (kind === 'cleansing') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'cleansing', rule_config: { empty_to_null: true }, apply_order: baseOrder });
      } else if (kind === 'type_cast') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'type_cast', rule_config: { target_type: pgType, on_error: onError }, apply_order: baseOrder });
      } else if (kind === 'cleansing_and_type_cast') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'cleansing', rule_config: { empty_to_null: true }, apply_order: baseOrder });
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'type_cast', rule_config: { target_type: pgType, on_error: onError }, apply_order: baseOrder + 1 });
      } else if (kind === 'code_map') {
        const cfg = codeMapConfig[src.name] || {};
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'code_map', rule_config: { map: cfg.map || {}, unmapped: cfg.unmapped || 'null', default_value: cfg.default_value }, apply_order: baseOrder });
      }
    });
    return rules;
  }, [selectedTable, sourceColumns, newTableExcluded, newTableTargetNames, sourceToTarget, transformKind, mappingOnError, codeMapConfig, targetColByName]);

  /** 인덱스명이 비어 있으면 컬럼명 기반 자동 생성 (예: idx_campaign_id_created_at) */
  const ensureIndexName = useCallback((name, columns) => {
    const trimmed = (name || '').trim();
    if (trimmed) return trimmed;
    if (!Array.isArray(columns) || columns.length === 0) return '';
    const safe = columns.map((c) => String(c).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean);
    return safe.length ? `idx_${safe.join('_')}` : '';
  }, []);

  const buildIndexDefinitions = useCallback(() => {
    if (sourceIndexes.length > 0) {
      const includedSet = new Set(targetColumnNamesForPk.map((c) => String(c).trim()));
      return nonPrimarySourceIndexes
        .filter((i) => {
          const cols = Array.isArray(i.columns) ? i.columns : [];
          if (cols.length === 0) return false;
          return cols.every((c) => includedSet.has(String(c).trim()));
        })
        .map((i) => {
          const cols = Array.isArray(i.columns) ? i.columns : [];
          const name = (i && i.index_name) ? String(i.index_name).trim() : '';
          return {
            index_name: name || ensureIndexName(name, cols),
            columns: cols,
            is_unique: !!i.is_unique
          };
        })
        .filter((d) => d.index_name && d.columns.length > 0);
    }
    return (customIndexDefinitions || [])
      .filter((d) => Array.isArray(d.columns) && d.columns.length > 0)
      .map((d) => {
        const cols = (d.columns || []).map((c) => String(c).trim()).filter(Boolean);
        const name = String(d.index_name || '').trim();
        return { index_name: name || ensureIndexName(name, cols), columns: cols, is_unique: !!d.is_unique };
      });
  }, [sourceIndexes.length, nonPrimarySourceIndexes, targetColumnNamesForPk, customIndexDefinitions, ensureIndexName]);

  const handleApply = useCallback(async () => {
    const indexDefinitions = buildIndexDefinitions();
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
      if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions);
      if (etlTableId != null && etlTableId !== '') {
        const assembled = getAssembledRules();
        try {
          const { rules: existing } = await etl2ListTransformRules(etlTableId);
          const sourceColumnsWithTransform = new Set(assembled.map((r) => r.source_column));
          for (const r of existing || []) {
            if (r.rule_id != null && sourceColumnsWithTransform.has(r.source_column)) {
              await etl2DeleteTransformRule(r.rule_id);
            }
          }
          for (const r of assembled) {
            await etl2CreateTransformRule({ etl_table_id: etlTableId, ...r, is_active: true });
          }
        } catch (err) {
          console.error('변환 룰 저장 실패:', err);
          window.alert('변환 룰 저장에 실패했습니다. ' + (err.message || ''));
        }
      }
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
      if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions);
      if (etlTableId != null && etlTableId !== '') {
        const assembled = getAssembledRules();
        try {
          const { rules: existing } = await etl2ListTransformRules(etlTableId);
          const sourceColumnsWithTransform = new Set(assembled.map((r) => r.source_column));
          for (const r of existing || []) {
            if (r.rule_id != null && sourceColumnsWithTransform.has(r.source_column)) {
              await etl2DeleteTransformRule(r.rule_id);
            }
          }
          for (const r of assembled) {
            await etl2CreateTransformRule({ etl_table_id: etlTableId, ...r, is_active: true });
          }
        } catch (err) {
          console.error('변환 룰 저장 실패:', err);
          window.alert('변환 룰 저장에 실패했습니다. ' + (err.message || ''));
        }
      }
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
    if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions);
    onClose();
  }, [
    selectedTable, newTableName, currentTargetTable, sourceColumns, newTableExcluded, newTableTargetNames,
    mappingOnError, targetColumnNamesForPk, selectedPkColumns, onSelect, onClose,
    hasSourceMapping, columns, sourceToTarget, targetColByName, selectedColumns, etlTableId, getAssembledRules,
    buildIndexDefinitions
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
                  <p className="etl-target-select-modal__hint">새 테이블 컬럼명을 정하세요. PK로 쓸 컬럼은 PK 체크(여러 개 선택 시 복합 PK), 적재에서 빼려면 제외를 체크하세요. 기존 PK로 설정돼 있던 컬럼은 [PK]로 표시됩니다.</p>
                  <div className="etl-target-select-modal__mapping-wrap">
                    <table className="etl-target-select-modal__mapping-table">
                      <thead>
                        <tr>
                          <th className="etl-target-select-modal__th--pk">PK</th>
                          <th className="etl-target-select-modal__th--index">INDEX</th>
                          <th>소스 컬럼 (타입)</th>
                          <th>→</th>
                          <th>타겟 컬럼명</th>
                          <th className="etl-target-select-modal__th--on-error" title="형변환 실패 시 동작">변환 실패 시</th>
                          <th className="etl-target-select-modal__th--transform">
                            변환
                            <button type="button" className="etl-target-select-modal__th-help" onClick={() => setShowTransformHelpModal(true)} title="변환 옵션 안내" aria-label="변환 옵션 안내">?</button>
                          </th>
                          <th className="etl-target-select-modal__th--exclude">제외</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceColumns.map((src) => {
                          const targetColName = ((newTableTargetNames[src.name] ?? src.name).trim().replace(/\s+/g, '_') || src.name);
                          const excluded = !!newTableExcluded[src.name];
                          const wasPk = effectivePkForDisplay.includes(targetColName);
                          const hasIndexFromSource = sourceIndexes.length > 0 && targetColumnsInReflectedIndexes.has(targetColName);
                          const hasIndexFromCustom = sourceIndexes.length === 0 && targetColumnsInCustomIndexes.has(targetColName);
                          return (
                            <tr key={src.name} className={excluded ? 'etl-target-select-modal__row--excluded' : ''}>
                              <td className="etl-target-select-modal__cell--pk">
                                {excluded ? (
                                  '—'
                                ) : sourceIndexes.length > 0 && pkReadOnlyFromSource ? (
                                  sourcePkColumnNames.includes(targetColName) ? <span className="etl-target-select-modal__constraint-check" aria-label="PK(소스)">✓</span> : '—'
                                ) : (
                                  <label className="etl-target-select-modal__pk-cell-label">
                                    <input
                                      type="checkbox"
                                      checked={selectedPkColumns.includes(targetColName)}
                                      onChange={() => togglePkColumn(targetColName)}
                                      disabled={pkReadOnlyFromSource && sourcePkColumnNames.includes(targetColName)}
                                      className="etl-target-select-modal__pk-checkbox"
                                    />
                                    {wasPk && <span className="etl-target-select-modal__pk-badge">[PK]</span>}
                                  </label>
                                )}
                              </td>
                              <td className="etl-target-select-modal__cell--index">
                                {excluded ? '—' : (hasIndexFromSource || hasIndexFromCustom ? <span className="etl-target-select-modal__constraint-check" aria-label="인덱스 포함">✓</span> : '—')}
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
                              <td className="etl-target-select-modal__cell--transform">
                                {excluded ? '—' : (
                                  <>
                                    <select
                                      value={transformKind[src.name] || 'none'}
                                      onChange={(e) => setTransformKind((prev) => ({ ...prev, [src.name]: e.target.value }))}
                                      className="etl-target-select-modal__select etl-target-select-modal__select--transform"
                                    >
                                      {TRANSFORM_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                    {(transformKind[src.name] || '') === 'code_map' && (
                                      <button type="button" className="etl-target-select-modal__btn-link" onClick={() => setCodeMapEditorOpen((p) => ({ ...p, [src.name]: !p[src.name] }))}>
                                        {codeMapEditorOpen[src.name] ? '접기' : '편집'}
                                      </button>
                                    )}
                                    {(transformKind[src.name] || '') === 'code_map' && codeMapEditorOpen[src.name] && (
                                      <CodeMapInlineEditor sourceName={src.name} config={codeMapConfig[src.name] || {}} onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))} />
                                    )}
                                  </>
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
                        <th className="etl-target-select-modal__th--index">INDEX</th>
                        <th>소스 컬럼 (타입)</th>
                        <th>→</th>
                        <th>타겟 컬럼</th>
                        <th className="etl-target-select-modal__th--on-error" title="형변환 실패 시 동작">변환 실패 시</th>
                        <th className="etl-target-select-modal__th--transform">
                          변환
                          <button type="button" className="etl-target-select-modal__th-help" onClick={() => setShowTransformHelpModal(true)} title="변환 옵션 안내" aria-label="변환 옵션 안내">?</button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceColumns.map((src) => {
                        const targetColName = sourceToTarget[src.name] ?? '';
                        const wasPk = targetColName && effectivePkForDisplay.includes(targetColName);
                        const excluded = !targetColName;
                        const hasIndexFromSource = sourceIndexes.length > 0 && targetColumnsInReflectedIndexes.has(targetColName);
                        const hasIndexFromCustom = sourceIndexes.length === 0 && targetColumnsInCustomIndexes.has(targetColName);
                        return (
                          <tr key={src.name} className={excluded ? 'etl-target-select-modal__row--excluded' : ''}>
                            <td className="etl-target-select-modal__cell--pk">
                              {excluded ? (
                                '—'
                              ) : sourceIndexes.length > 0 && pkReadOnlyFromSource ? (
                                sourcePkColumnNames.includes(targetColName) ? <span className="etl-target-select-modal__constraint-check" aria-label="PK(소스)">✓</span> : '—'
                              ) : (
                                <label className="etl-target-select-modal__pk-cell-label">
                                  <input
                                    type="checkbox"
                                    checked={selectedPkColumns.includes(targetColName)}
                                    onChange={() => togglePkColumn(targetColName)}
                                    disabled={pkReadOnlyFromSource && sourcePkColumnNames.includes(targetColName)}
                                    className="etl-target-select-modal__pk-checkbox"
                                  />
                                  {wasPk && <span className="etl-target-select-modal__pk-badge">[PK]</span>}
                                </label>
                              )}
                            </td>
                            <td className="etl-target-select-modal__cell--index">
                              {excluded ? '—' : (hasIndexFromSource || hasIndexFromCustom ? <span className="etl-target-select-modal__constraint-check" aria-label="인덱스 포함">✓</span> : '—')}
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
                            <td className="etl-target-select-modal__cell--transform">
                              {!targetColName ? '—' : (
                                <>
                                  <select
                                    value={transformKind[src.name] || 'none'}
                                    onChange={(e) => setTransformKind((prev) => ({ ...prev, [src.name]: e.target.value }))}
                                    className="etl-target-select-modal__select etl-target-select-modal__select--transform"
                                    title="변환 룰"
                                  >
                                    {TRANSFORM_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                  {(transformKind[src.name] || '') === 'code_map' && (
                                    <button
                                      type="button"
                                      className="etl-target-select-modal__btn-link etl-target-select-modal__btn--code-map-edit"
                                      onClick={() => setCodeMapEditorOpen((p) => ({ ...p, [src.name]: !p[src.name] }))}
                                    >
                                      {codeMapEditorOpen[src.name] ? '접기' : '편집'}
                                    </button>
                                  )}
                                  {(transformKind[src.name] || '') === 'code_map' && codeMapEditorOpen[src.name] && (
                                    <CodeMapInlineEditor
                                      sourceName={src.name}
                                      config={codeMapConfig[src.name] || {}}
                                      onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))}
                                    />
                                  )}
                                </>
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
              <label className="etl-target-select-modal__label">컬럼 매핑 (적재할 컬럼 선택 — 선택한 컬럼은 소스→타겟 동일명으로 매핑. PK로 쓸 컬럼은 PK 체크, 여러 개 선택 시 복합 PK.)</label>
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
                                  disabled={pkReadOnlyFromSource && sourcePkColumnNames.includes(name)}
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

          {sourceIndexes.length === 0 && (
            <div className="etl-target-select-modal__row etl-target-select-modal__row--custom-indexes">
              <label className="etl-target-select-modal__label">인덱스 추가 (테이블 아래)</label>
              <p className="etl-target-select-modal__hint">위 매핑 테이블의 INDEX 열에 반영됩니다. 컬럼 선택·인덱스 명·UNIQUE를 설정하고, 인덱스 명을 비우면 컬럼명 기반 자동 생성됩니다.</p>
              <div className="etl-target-select-modal__custom-index-list">
                {(customIndexDefinitions || []).map((def, idx) => {
                  const selectedCols = Array.isArray(def.columns) ? def.columns : [];
                  return (
                    <div key={idx} className="etl-target-select-modal__custom-index-row">
                      <div className="etl-target-select-modal__index-cols-select etl-target-select-modal__index-cols-select--first">
                        <span className="etl-target-select-modal__index-cols-label">컬럼 선택:</span>
                        {targetColumnNamesForPk.length === 0 ? (
                          <span className="etl-target-select-modal__hint">위에서 저장 DB 테이블·매핑을 정한 뒤 선택 가능</span>
                        ) : (
                          <div className="etl-target-select-modal__index-cols-checkboxes">
                            {targetColumnNamesForPk.map((colName) => {
                              const selected = selectedCols.includes(colName);
                              return (
                                <label key={colName} className="etl-target-select-modal__index-col-check">
                                  <input
                                    type="checkbox"
                                    checked={!!selected}
                                    onChange={() => {
                                      setCustomIndexDefinitions((prev) => {
                                        const list = [...(prev || [])];
                                        const row = { ...(list[idx] || { index_name: '', columns: [], is_unique: false }) };
                                        const cols = Array.isArray(row.columns) ? [...row.columns] : [];
                                        const next = cols.includes(colName) ? cols.filter((c) => c !== colName) : [...cols, colName];
                                        list[idx] = { ...row, columns: next };
                                        return list;
                                      });
                                    }}
                                  />
                                  <span>{colName}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {selectedCols.length > 0 && (
                        <div className="etl-target-select-modal__index-name-by-column">
                          <div className="etl-target-select-modal__index-name-line">
                            <span className="etl-target-select-modal__index-name-line-label">인덱스 명</span>
                            <input
                              type="text"
                              placeholder="예: idx_campaign_id (비우면 자동 생성)"
                              value={def.index_name || ''}
                              onChange={(e) => {
                                setCustomIndexDefinitions((prev) => {
                                  const list = [...(prev || [])];
                                  list[idx] = { ...(list[idx] || {}), index_name: e.target.value };
                                  return list;
                                });
                              }}
                              className="etl-target-select-modal__input etl-target-select-modal__input--index-name"
                            />
                          </div>
                        </div>
                      )}
                      {selectedCols.length > 0 && (
                        <div className="etl-target-select-modal__custom-index-row-footer">
                          <label className="etl-target-select-modal__custom-index-unique" title="체크 시 해당 인덱스를 UNIQUE로 생성합니다(선택한 컬럼 조합 값이 테이블 내에서 중복 불가).">
                            <input
                              type="checkbox"
                              checked={!!def.is_unique}
                              onChange={(e) => {
                                setCustomIndexDefinitions((prev) => {
                                  const list = [...(prev || [])];
                                  list[idx] = { ...(list[idx] || {}), is_unique: e.target.checked };
                                  return list;
                                });
                              }}
                            />
                            UNIQUE
                          </label>
                          <button type="button" className="etl-target-select-modal__btn-remove" onClick={() => setCustomIndexDefinitions((prev) => prev.filter((_, i) => i !== idx))} aria-label="삭제">삭제</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="etl-target-select-modal__btn-add" onClick={() => setCustomIndexDefinitions((prev) => [...(prev || []), { index_name: '', columns: [], is_unique: false }])}>+ 인덱스 추가</button>
              </div>
              <p className="etl-target-select-modal__hint" style={{ marginTop: '6px' }}><strong>UNIQUE</strong> 체크 시 해당 인덱스가 UNIQUE 인덱스로 생성됩니다(선택한 컬럼 조합 값이 테이블 내에서 중복될 수 없음).</p>
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
      {showTransformHelpModal && (
        <div className="etl-target-select-modal__transform-help-wrap" role="dialog" aria-modal="true" aria-labelledby="transform-help-title">
          <div className="etl-target-select-modal__transform-help-backdrop" onClick={() => setShowTransformHelpModal(false)} />
          <div className="etl-target-select-modal__transform-help-box">
            <div className="etl-target-select-modal__transform-help-head">
              <h4 id="transform-help-title">변환 옵션 안내</h4>
              <button type="button" className="etl-target-select-modal__close" onClick={() => setShowTransformHelpModal(false)} aria-label="닫기">&times;</button>
            </div>
            <div className="etl-target-select-modal__transform-help-body">
              <dl className="etl-target-select-modal__transform-help-dl">
                <dt>없음</dt>
                <dd>해당 컬럼에 변환을 적용하지 않습니다. 원본 값 그대로 적재됩니다.</dd>
                <dt>정리</dt>
                <dd>앞뒤 공백 제거(TRIM) 후, 빈 문자열을 NULL로 바꾸거나 기본값을 채울 수 있습니다. 문자열 정제용입니다.</dd>
                <dt>타입 변환</dt>
                <dd>날짜·숫자·문자 등으로 형 변환합니다. 변환 실패 시 NULL·0·원본 유지 등은 &quot;변환 실패 시&quot; 열에서 선택합니다.</dd>
                <dt>정리 + 타입 변환</dt>
                <dd>먼저 정리(공백·빈값 처리)를 적용한 뒤, 타입 변환을 적용합니다. 두 단계가 순서대로 실행됩니다.</dd>
                <dt>값 매핑</dt>
                <dd>원본값 → 변환값으로 치환합니다. 예: active→1, inactive→0. 매핑에 없는 값은 NULL·유지·사용자 지정 기본값 중 하나로 처리합니다.</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TargetTableSelectModal;
