/**
 * TargetTableSelectModal/index.jsx (테이블선택 및 컬럼매핑 모달)
 * ================================================================================
 * 저장 DB 테이블 선택·소스→타겟 매핑·변환 룰·미리보기. state/effect/handler 보유, TableSelector/ColumnMappingSection/PreviewSection 조합.
 *
 * [Main Functions]
 * ===========
 * 1. loadTables, getAssembledRules, buildIndexDefinitions, saveRulesIfNeeded, handleApply, handlePreviewClick
 * 2. onSelect 7번째 인자 tableMeta: { table_label, table_dscrtn } (선택). 길이: 라벨 ≤30자(UNIQUE)·설명 ≤100자(constants 동기)
 * 3. TableSelector / ColumnMappingSection / CustomIndexSection / PreviewSection / 변환 도움말 모달
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js, ../utils/storageDb(normalizeStorageConnectionId, formatEtlStorageLabel), ./constants, ./TableSelector, ./ColumnMappingSection, ./PreviewSection
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { etl2ListTargetTables, etl2ListTargetColumns, etl2ListTransformRules, etl2CreateTransformRule, etl2DeleteTransformRule, etl2TransformPreview, etl2ListTimezones } from '@/packages/etl/api/etlClient.js';
import { normalizeStorageConnectionId, formatEtlStorageLabel } from '../../utils/storageDb.js';
import {
  normalizeSourceCol,
  NEW_TABLE_VALUE,
  getOnErrorValue,
  inferredTypeToPg,
  parsePkColumns,
  isTypeCompatible,
  ETL_TABLE_LABEL_MAX_LEN,
  ETL_TABLE_DSCRTN_MAX_LEN
} from './constants.js';
import { TableSelector } from './TableSelector.jsx';
import { ColumnMappingSection, CustomIndexSection } from './ColumnMappingSection.jsx';
import { PreviewSection } from './PreviewSection.jsx';

// 1.
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
  currentTransformSettings,
  currentTableLabel = '',
  currentTableDscrtn = '',
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
  const [newTableName, setNewTableName] = useState('');
  const [selectedPkColumns, setSelectedPkColumns] = useState([]);
  const [newTableTargetNames, setNewTableTargetNames] = useState({});
  const [newTableExcluded, setNewTableExcluded] = useState({});
  const [mappingOnError, setMappingOnError] = useState({});
  const [sourceToTarget, setSourceToTarget] = useState({});
  const [transformKind, setTransformKind] = useState({});
  const [codeMapConfig, setCodeMapConfig] = useState({});
  const [codeMapEditorOpen, setCodeMapEditorOpen] = useState({});
  const [stringConfig, setStringConfig] = useState({});
  const [maskingConfig, setMaskingConfig] = useState({});
  const [typeCastConfig, setTypeCastConfig] = useState({});
  const [datetimeConfig, setDateTimeConfig] = useState({});
  const [timezones, setTimezones] = useState([]);
  const [showTransformHelpModal, setShowTransformHelpModal] = useState(false);
  const [customIndexDefinitions, setCustomIndexDefinitions] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [showOnlyWithTransform, setShowOnlyWithTransform] = useState(false);
  const [codeMapPopoverSource, setCodeMapPopoverSource] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [tableLabel, setTableLabel] = useState('');
  const [tableDscrtn, setTableDscrtn] = useState('');

  useEffect(() => {
    setPreviewData(null);
    setPreviewError(null);
  }, [transformKind, stringConfig, maskingConfig, codeMapConfig, typeCastConfig, datetimeConfig]);

  const prevSelectedTableRef = useRef(selectedTable);
  const pkSyncedForOpenRef = useRef(false);

  const sourceIndexes = useMemo(() => Array.isArray(sourceIndexesProp) ? sourceIndexesProp : [], [sourceIndexesProp]);
  const sourcePkFromSource = useMemo(() => {
    const primary = sourceIndexes.find((i) => i && i.is_primary);
    if (!primary || !Array.isArray(primary.columns)) return '';
    return primary.columns.join(', ');
  }, [sourceIndexes]);
  const sourcePkColumnNames = useMemo(() => {
    const primary = sourceIndexes.find((i) => i && i.is_primary);
    if (!primary || !Array.isArray(primary.columns)) return [];
    return primary.columns.map((c) => (c && String(c).trim())).filter(Boolean);
  }, [sourceIndexes]);
  const nonPrimarySourceIndexes = useMemo(
    () => sourceIndexes.filter((i) => i && !i.is_primary),
    [sourceIndexes]
  );
  const targetColumnsInReflectedIndexes = useMemo(() => {
    const set = new Set();
    nonPrimarySourceIndexes.forEach((idx) => {
      const cols = Array.isArray(idx.columns) ? idx.columns : [];
      cols.forEach((c) => set.add(String(c).trim()));
    });
    return set;
  }, [nonPrimarySourceIndexes]);
  const targetColumnsInCustomIndexes = useMemo(() => {
    const set = new Set();
    (customIndexDefinitions || []).forEach((def) => {
      const cols = Array.isArray(def.columns) ? def.columns : [];
      cols.forEach((c) => set.add(String(c).trim()));
    });
    return set;
  }, [customIndexDefinitions]);

  const sid = useMemo(() => normalizeStorageConnectionId(storageConnectionId), [storageConnectionId]);
  const storageTargetLabel = useMemo(
    () => formatEtlStorageLabel(sid, null),
    [sid],
  );
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
      setTableLabel(
        (currentTableLabel != null ? String(currentTableLabel) : '').trim().slice(0, ETL_TABLE_LABEL_MAX_LEN)
      );
      setTableDscrtn(
        (currentTableDscrtn != null ? String(currentTableDscrtn) : '').trim().slice(0, ETL_TABLE_DSCRTN_MAX_LEN)
      );
      setTransformKind({});
      setTypeCastConfig({});
      setStringConfig({});
      setMaskingConfig({});
      setCodeMapConfig({});
      setMappingOnError({});
      setCodeMapEditorOpen({});
      setCodeMapPopoverSource(null);
      setPreviewData(null);
      setPreviewError(null);
    }
  }, [open, loadTables, currentTargetTable, currentTableLabel, currentTableDscrtn]);

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
      if (byName && isTypeCompatible(src.type, byName.data_type || '')) {
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

  /* 제외 체크/선택해도 행은 유지하고, 모달에서 제외를 다시 해제할 수 있도록 표시 목록에서 제외하지 않음 */
  const displaySourcesForNewTable = useMemo(
    () => sourceColumns
      .filter((src) => !showOnlyWithTransform || (transformKind[src.name] || 'none') !== 'none'),
    [sourceColumns, showOnlyWithTransform, transformKind]
  );
  const displaySourcesForExisting = useMemo(
    () => sourceColumns
      .filter((src) => !showOnlyWithTransform || (transformKind[src.name] || 'none') !== 'none'),
    [sourceColumns, showOnlyWithTransform, transformKind]
  );

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

  useEffect(() => {
    if (!open) return;
    etl2ListTimezones()
      .then((res) => setTimezones(res.timezones || []))
      .catch(() => setTimezones([]));
  }, [open]);

  useEffect(() => {
    if (!open || etlTableId == null || etlTableId === '') return;
    etl2ListTransformRules(etlTableId)
      .then(({ rules }) => {
        const kinds = {};
        const strCfg = {};
        const maskCfg = {};
        const codeCfg = {};
        const typeCastCfg = {};
        const datetimeCfg = {};
        const onErrors = {};
        for (const r of rules || []) {
          const src = r.source_column;
          const type = (r.rule_category || r.rule_type || '').trim().toLowerCase();
          const cfg = r.rule_config || {};
          if (type === 'cleansing') {
            kinds[src] = kinds[src] === 'type_cast' ? 'cleansing_and_type_cast' : 'cleansing';
          } else if (type === 'type_cast') {
            kinds[src] = kinds[src] === 'cleansing' ? 'cleansing_and_type_cast' : 'type_cast';
            if (cfg.target_type) typeCastCfg[src] = { target_type: cfg.target_type };
          } else if (type === 'string') {
            kinds[src] = 'string';
            strCfg[src] = { operation: cfg.operation, width: cfg.width, fill_char: cfg.fill_char, start: cfg.start, length: cfg.length, old: cfg.old, new: cfg.new, pattern: cfg.pattern, replacement: cfg.replacement, columns: cfg.columns, separator: cfg.separator };
          } else if (type === 'masking') {
            kinds[src] = 'masking';
            maskCfg[src] = { operation: cfg.operation, n: cfg.n, char: cfg.char };
          } else if (type === 'code_map' || type === 'mapping') {
            kinds[src] = 'code_map';
            const def = cfg.default;
            codeCfg[src] = {
              map: cfg.mappings || {},
              unmapped: def === null ? 'null' : (def !== undefined && def !== '' ? 'default' : 'keep'),
              default_value: def != null ? String(def) : ''
            };
          } else if (type === 'datetime') {
            kinds[src] = 'datetime';
            datetimeCfg[src] = {
              operation: cfg.operation || 'timezone_convert',
              source_timezone: cfg.source_timezone || 'UTC',
              target_timezone: cfg.target_timezone || 'Asia/Seoul',
              input_format: cfg.input_format,
              output_format: cfg.output_format,
              part: cfg.part,
              other_column: cfg.other_column,
              unit: cfg.unit,
              days: cfg.days,
              months: cfg.months,
              years: cfg.years
            };
          }
          if (cfg.on_error) onErrors[src] = cfg.on_error;
        }
        setTransformKind((prev) => ({ ...prev, ...kinds }));
        setStringConfig((prev) => ({ ...prev, ...strCfg }));
        setMaskingConfig((prev) => ({ ...prev, ...maskCfg }));
        setCodeMapConfig((prev) => ({ ...prev, ...codeCfg }));
        setTypeCastConfig((prev) => ({ ...prev, ...typeCastCfg }));
        setDateTimeConfig((prev) => ({ ...prev, ...datetimeCfg }));
        setMappingOnError((prev) => ({ ...prev, ...onErrors }));
      })
      .catch(() => {});
  }, [open, etlTableId]);

  useEffect(() => {
    if (!open) return;
    if (etlTableId != null && etlTableId !== '') return;
    if (!currentTransformSettings) return;
    const s = currentTransformSettings;
    if (s.transformKind && Object.keys(s.transformKind).length > 0) {
      setTransformKind((prev) => ({ ...prev, ...s.transformKind }));
    }
    if (s.typeCastConfig && Object.keys(s.typeCastConfig).length > 0) {
      setTypeCastConfig((prev) => ({ ...prev, ...s.typeCastConfig }));
    }
    if (s.stringConfig && Object.keys(s.stringConfig).length > 0) {
      setStringConfig((prev) => ({ ...prev, ...s.stringConfig }));
    }
    if (s.maskingConfig && Object.keys(s.maskingConfig).length > 0) {
      setMaskingConfig((prev) => ({ ...prev, ...s.maskingConfig }));
    }
    if (s.codeMapConfig && Object.keys(s.codeMapConfig).length > 0) {
      setCodeMapConfig((prev) => ({ ...prev, ...s.codeMapConfig }));
    }
    if (s.datetimeConfig && Object.keys(s.datetimeConfig).length > 0) {
      setDateTimeConfig((prev) => ({ ...prev, ...s.datetimeConfig }));
    }
    if (s.mappingOnError && Object.keys(s.mappingOnError).length > 0) {
      setMappingOnError((prev) => ({ ...prev, ...s.mappingOnError }));
    }
  }, [open, currentTransformSettings, etlTableId]);

  const effectivePkForDisplay = useMemo(() => {
    const isCurrentTable = (selectedTable || '').trim() === (currentTargetTable || '').trim();
    return isCurrentTable ? parsePkColumns(currentPkColumns) : [];
  }, [selectedTable, currentTargetTable, currentPkColumns]);

  const togglePkColumn = (name) => {
    setSelectedPkColumns((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

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
      const pgType = typeCastConfig[src.name]?.target_type
        || (selectedTable === NEW_TABLE_VALUE ? inferredTypeToPg(src.type) : (targetColByName[targetName]?.data_type || 'TEXT'));
      if (kind === 'cleansing') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'cleansing', rule_category: 'cleansing', operation: 'trim', rule_config: { empty_to_null: true }, apply_order: baseOrder });
      } else if (kind === 'type_cast') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'type_cast', rule_category: 'type_cast', operation: 'default', rule_config: { target_type: pgType, on_error: onError }, apply_order: baseOrder });
      } else if (kind === 'cleansing_and_type_cast') {
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'cleansing', rule_category: 'cleansing', operation: 'trim', rule_config: { empty_to_null: true }, apply_order: baseOrder });
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'type_cast', rule_category: 'type_cast', operation: 'default', rule_config: { target_type: pgType, on_error: onError }, apply_order: baseOrder + 1 });
      } else if (kind === 'code_map') {
        const cfg = codeMapConfig[src.name] || {};
        const defaultVal = cfg.unmapped === 'default' ? (cfg.default_value ?? '') : (cfg.unmapped === 'null' ? null : undefined);
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'code_map', rule_category: 'mapping', operation: 'value_map', rule_config: { mappings: cfg.map || {}, default: defaultVal }, apply_order: baseOrder });
      } else if (kind === 'string') {
        const cfg = stringConfig[src.name] || {};
        const op = cfg.operation || 'uppercase';
        const ruleConfig = { operation: op };
        if (op === 'pad_left' || op === 'pad_right') {
          ruleConfig.width = parseInt(cfg.width, 10) || 10;
          ruleConfig.fill_char = (cfg.fill_char !== undefined && cfg.fill_char !== '') ? String(cfg.fill_char) : (op === 'pad_left' ? '0' : ' ');
        }
        if (op === 'substring') {
          ruleConfig.start = parseInt(cfg.start, 10) || 0;
          if (cfg.length != null && cfg.length !== '') ruleConfig.length = parseInt(cfg.length, 10);
        }
        if (op === 'replace') {
          ruleConfig.old = cfg.old != null ? String(cfg.old) : '';
          ruleConfig.new = cfg.new != null ? String(cfg.new) : '';
        }
        if (op === 'regex_replace') {
          ruleConfig.pattern = cfg.pattern != null ? String(cfg.pattern) : '';
          ruleConfig.replacement = cfg.replacement != null ? String(cfg.replacement) : '';
        }
        if (op === 'concat') {
          ruleConfig.columns = Array.isArray(cfg.columns) ? cfg.columns : (cfg.columns ? [cfg.columns].flat() : [src.name]);
          ruleConfig.separator = cfg.separator != null ? String(cfg.separator) : '';
        }
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'string', rule_category: 'string', operation: op, rule_config: ruleConfig, apply_order: baseOrder });
      } else if (kind === 'masking') {
        const cfg = maskingConfig[src.name] || {};
        const ruleConfig = { operation: cfg.operation || 'mask_right', char: (cfg.char != null && cfg.char !== '') ? String(cfg.char) : '*' };
        if (cfg.operation === 'mask_right' || cfg.operation === 'mask_left') {
          ruleConfig.n = parseInt(cfg.n, 10) || 4;
        }
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'masking', rule_category: 'masking', operation: ruleConfig.operation || 'mask_right', rule_config: ruleConfig, apply_order: baseOrder });
      } else if (kind === 'datetime') {
        const cfg = datetimeConfig[src.name] || {};
        const op = cfg.operation || 'timezone_convert';
        const ruleConfig = { operation: op };
        if (op === 'timezone_convert') {
          ruleConfig.source_timezone = (cfg.source_timezone || 'UTC').trim();
          ruleConfig.target_timezone = (cfg.target_timezone || 'Asia/Seoul').trim();
        } else if (op === 'date_format') {
          if (cfg.input_format != null) ruleConfig.input_format = String(cfg.input_format).trim() || undefined;
          if (cfg.output_format != null) ruleConfig.output_format = String(cfg.output_format).trim() || undefined;
        } else if (op === 'extract') {
          if (cfg.part != null) ruleConfig.part = String(cfg.part).trim() || undefined;
        } else if (op === 'date_diff') {
          if (cfg.other_column != null) ruleConfig.other_column = String(cfg.other_column).trim() || undefined;
          if (cfg.unit != null) ruleConfig.unit = String(cfg.unit).trim() || undefined;
        } else if (op === 'date_add') {
          if (cfg.days != null && cfg.days !== '') ruleConfig.days = parseInt(cfg.days, 10) || 0;
          if (cfg.months != null && cfg.months !== '') ruleConfig.months = parseInt(cfg.months, 10) || 0;
          if (cfg.years != null && cfg.years !== '') ruleConfig.years = parseInt(cfg.years, 10) || 0;
        } else if (op === 'date_subtract') {
          if (cfg.days != null && cfg.days !== '') ruleConfig.days = parseInt(cfg.days, 10) || 0;
          if (cfg.months != null && cfg.months !== '') ruleConfig.months = parseInt(cfg.months, 10) || 0;
          if (cfg.years != null && cfg.years !== '') ruleConfig.years = parseInt(cfg.years, 10) || 0;
        }
        rules.push({ source_column: src.name, target_column: targetName, rule_type: 'datetime', rule_category: 'datetime', operation: op, rule_config: ruleConfig, apply_order: baseOrder });
      }
    });
    return rules;
  }, [selectedTable, sourceColumns, newTableExcluded, newTableTargetNames, sourceToTarget, transformKind, mappingOnError, typeCastConfig, codeMapConfig, stringConfig, maskingConfig, datetimeConfig, targetColByName]);

  const getColumnMappingForPreview = useCallback(() => {
    if (selectedTable === NEW_TABLE_VALUE) {
      return sourceColumns
        .filter((src) => !newTableExcluded[src.name])
        .map((src) => ({
          source: src.name,
          target: (newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name,
          type: inferredTypeToPg(src.type),
          on_error: getOnErrorValue(mappingOnError, src.name)
        }));
    }
    if (!hasSourceMapping || !sourceColumns.length) return [];
    const list = [];
    sourceColumns.forEach((src) => {
      const targetName = sourceToTarget[src.name];
      if (!targetName) return;
      const tgtCol = targetColByName[targetName];
      if (!tgtCol) return;
      list.push({
        source: src.name,
        target: targetName,
        type: (tgtCol.data_type && String(tgtCol.data_type).toUpperCase()) || 'TEXT',
        on_error: getOnErrorValue(mappingOnError, src.name)
      });
    });
    return list;
  }, [selectedTable, sourceColumns, newTableExcluded, newTableTargetNames, sourceToTarget, mappingOnError, targetColByName, hasSourceMapping]);

  const handlePreviewClick = useCallback(async () => {
    if (etlTableId == null || etlTableId === '') return;
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const rules = getAssembledRules();
      const column_mapping = getColumnMappingForPreview();
      const res = await etl2TransformPreview({ etl_table_id: Number(etlTableId), rules, column_mapping: column_mapping.length ? column_mapping : undefined });
      setPreviewData(res);
    } catch (err) {
      setPreviewError(err?.message || '미리보기 요청 실패');
    } finally {
      setPreviewLoading(false);
    }
  }, [etlTableId, getAssembledRules, getColumnMappingForPreview]);

  const ensureIndexName = useCallback((name, columns) => {
    const trimmed = (name || '').trim();
    if (trimmed) return trimmed;
    if (!Array.isArray(columns) || columns.length === 0) return '';
    const safe = columns.map((c) => String(c).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean);
    return safe.length ? `idx_${safe.join('_')}` : '';
  }, []);

  const buildIndexDefinitions = useCallback(() => {
    if (sourceIndexes.length > 0) {
      // 소스 컬럼명 → 타겟 컬럼명 매핑 (적재 시 테이블은 타겟 컬럼명으로 생성되므로 인덱스도 타겟명 사용)
      const sourceToTargetMap = selectedTable === NEW_TABLE_VALUE
        ? sourceColumns
            .filter((src) => !newTableExcluded[src.name])
            .reduce((acc, src) => {
              const t = (newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name;
              acc[src.name] = t;
              return acc;
            }, {})
        : { ...sourceToTarget };

      return nonPrimarySourceIndexes
        .map((i) => {
          const srcCols = Array.isArray(i.columns) ? i.columns : [];
          if (srcCols.length === 0) return null;
          const targetCols = srcCols.map((c) => sourceToTargetMap[String(c).trim()]).filter(Boolean);
          if (targetCols.length !== srcCols.length) return null;
          const name = (i && i.index_name) ? String(i.index_name).trim() : '';
          return {
            index_name: name || ensureIndexName(name, targetCols),
            columns: targetCols,
            is_unique: !!i.is_unique
          };
        })
        .filter((d) => d && d.index_name && d.columns.length > 0);
    }
    return (customIndexDefinitions || [])
      .filter((d) => Array.isArray(d.columns) && d.columns.length > 0)
      .map((d) => {
        const cols = (d.columns || []).map((c) => String(c).trim()).filter(Boolean);
        const name = String(d.index_name || '').trim();
        return { index_name: name || ensureIndexName(name, cols), columns: cols, is_unique: !!d.is_unique };
      });
  }, [sourceIndexes.length, nonPrimarySourceIndexes, customIndexDefinitions, ensureIndexName, selectedTable, sourceColumns, newTableExcluded, newTableTargetNames, sourceToTarget]);

  const saveRulesIfNeeded = useCallback(async (etlTableIdVal, allSourceColumnNames, assembled) => {
    if (etlTableIdVal == null || etlTableIdVal === '') return;
    const { rules: existing } = await etl2ListTransformRules(etlTableIdVal);
    const scopeSet = new Set(Array.isArray(allSourceColumnNames) ? allSourceColumnNames : []);
    try {
      await Promise.all(
        (existing || [])
          .filter((r) => r.rule_id != null && scopeSet.has(r.source_column))
          .map((r) => etl2DeleteTransformRule(r.rule_id))
      );
    } catch (err) {
      throw new Error('기존 룰 삭제 중 실패: ' + (err?.message || String(err)));
    }
    try {
      await Promise.all(
        assembled.map((r) => etl2CreateTransformRule({ etl_table_id: etlTableIdVal, ...r, is_active: true }))
      );
    } catch (err) {
      throw new Error('새 룰 등록 중 실패 (일부 삭제된 상태일 수 있음): ' + (err?.message || String(err)));
    }
  }, []);

  const handleApply = useCallback(async () => {
    const assembled = getAssembledRules();
    if (assembled.some((r) => r.rule_type === 'masking')) {
      if (!window.confirm('마스킹된 데이터는 원본으로 복구할 수 없습니다. 계속하시겠습니까?')) return;
    }
    const tlCheck = (tableLabel || '').trim();
    const tdCheck = (tableDscrtn || '').trim();
    if (tlCheck.length > ETL_TABLE_LABEL_MAX_LEN) {
      window.alert(`테이블 라벨은 최대 ${ETL_TABLE_LABEL_MAX_LEN}자까지 입력할 수 있습니다.`);
      return;
    }
    if (tdCheck.length > ETL_TABLE_DSCRTN_MAX_LEN) {
      window.alert(`테이블 설명은 최대 ${ETL_TABLE_DSCRTN_MAX_LEN}자까지 입력할 수 있습니다.`);
      return;
    }
    setApplyLoading(true);
    let applied = false;
    const currentSettings = {
      transformKind: { ...transformKind },
      typeCastConfig: { ...typeCastConfig },
      stringConfig: { ...stringConfig },
      maskingConfig: { ...maskingConfig },
      codeMapConfig: { ...codeMapConfig },
      datetimeConfig: { ...datetimeConfig },
      mappingOnError: { ...mappingOnError }
    };
    const tableMeta = {
      table_label: (tableLabel || '').trim() || null,
      table_dscrtn: (tableDscrtn || '').trim() || null
    };
    try {
      const indexDefinitions = buildIndexDefinitions();
      if (selectedTable === NEW_TABLE_VALUE) {
        const rawTableName = (newTableName || '').trim().replace(/\s+/g, '_') || (currentTargetTable || '').trim();
        if (!rawTableName) {
          window.alert('테이블명을 입력해 주세요.');
          return;
        }
        const tableName = rawTableName;
        const columnMapping = sourceColumns
          .filter((src) => !newTableExcluded[src.name])
          .map((src) => ({
            source: src.name,
            target: (newTableTargetNames[src.name] || src.name).trim().replace(/\s+/g, '_') || src.name,
            type: inferredTypeToPg(src.type),
            on_error: getOnErrorValue(mappingOnError, src.name)
          }));
        const pkCols = targetColumnNamesForPk.filter((n) => selectedPkColumns.includes(n)).join(',').trim() || '';
        if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions, currentSettings, assembled, tableMeta);
        if (etlTableId != null && etlTableId !== '') {
          try {
            await saveRulesIfNeeded(
              etlTableId,
              sourceColumns.filter((src) => !newTableExcluded[src.name]).map((src) => src.name),
              assembled
            );
          } catch (err) {
            console.error('변환 룰 저장 실패:', err);
            window.alert('변환 룰 저장에 실패했습니다. ' + (err?.message || ''));
          }
        }
        applied = true;
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
        if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions, currentSettings, assembled, tableMeta);
        if (etlTableId != null && etlTableId !== '') {
          try {
            await saveRulesIfNeeded(
              etlTableId,
              sourceColumns.filter((src) => sourceToTarget[src.name]).map((src) => src.name),
              assembled
            );
          } catch (err) {
            console.error('변환 룰 저장 실패:', err);
            window.alert('변환 룰 저장에 실패했습니다. ' + (err?.message || ''));
          }
        }
        applied = true;
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
      if (onSelect) onSelect(tableName, columnMapping, pkCols, indexDefinitions, currentSettings, assembled, tableMeta);
      applied = true;
    } finally {
      setApplyLoading(false);
      if (applied) onClose();
    }
  }, [
    getAssembledRules, buildIndexDefinitions, saveRulesIfNeeded,
    selectedTable, newTableName, currentTargetTable, sourceColumns, newTableExcluded, newTableTargetNames,
    mappingOnError, targetColumnNamesForPk, selectedPkColumns, onSelect, onClose,
    hasSourceMapping, columns, sourceToTarget, targetColByName, selectedColumns, etlTableId,
    transformKind, typeCastConfig, stringConfig, maskingConfig, codeMapConfig,
    tableLabel, tableDscrtn, datetimeConfig
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
          <p className="etl-target-select-modal__intro etl-target-select-modal__storage-banner">
            현재 적재 대상 DB: <strong>{storageTargetLabel}</strong>
            {' '}(바깥 화면의 &quot;저장할 DB&quot; 셀렉트와 동일합니다. 바꾸려면 모달을 닫고 셀렉트를 변경하세요.)
          </p>
          <p className="etl-target-select-modal__intro">
            아래에서 <strong>저장할 DB</strong>에 있는 테이블을 고르고, 필요하면 소스 컬럼을 타겟 컬럼에 맞춰 주세요. 숫자/날짜 등 타입이 다를 때는 <strong>변환 실패 시</strong>에서 NULL·0·원본 유지·행 제외·실패 중 동작을 선택할 수 있습니다. &quot;적용&quot;을 누르면 테이블명과 매핑이 저장됩니다.
          </p>

          <TableSelector
            tables={tables}
            tablesLoading={tablesLoading}
            tablesError={tablesError}
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            sourceColumns={sourceColumns}
            newTableName={newTableName}
            setNewTableName={setNewTableName}
            currentTargetTable={currentTargetTable}
          />

          <div className="etl-target-select-modal__table-meta">
            <p id="etl-tm-meta-hint" className="etl-target-select-modal__meta-hint">
              저장 메타(<span className="etl-target-select-modal__meta-hint-code">etl_tables</span>) 기준: 라벨은 최대{' '}
              {ETL_TABLE_LABEL_MAX_LEN}자이며, 입력한 경우 시스템에서 유일해야 합니다(UNIQUE). 설명은 최대{' '}
              {ETL_TABLE_DSCRTN_MAX_LEN}자입니다. 둘 다 비워 두어도 됩니다.
            </p>
            <label className="etl-target-select-modal__label" htmlFor="etl-tm-label">테이블 라벨 (선택)</label>
            <input
              id="etl-tm-label"
              type="text"
              className="etl-target-select-modal__table-meta-input"
              value={tableLabel}
              onChange={(e) => setTableLabel(e.target.value.slice(0, ETL_TABLE_LABEL_MAX_LEN))}
              maxLength={ETL_TABLE_LABEL_MAX_LEN}
              placeholder={`표시용 (최대 ${ETL_TABLE_LABEL_MAX_LEN}자)`}
              autoComplete="off"
              aria-describedby="etl-tm-meta-hint etl-tm-label-count"
            />
            <p
              id="etl-tm-label-count"
              className={
                tableLabel.length >= ETL_TABLE_LABEL_MAX_LEN
                  ? 'etl-target-select-modal__meta-counter etl-target-select-modal__meta-counter--limit'
                  : 'etl-target-select-modal__meta-counter'
              }
              aria-live="polite"
            >
              {tableLabel.length}/{ETL_TABLE_LABEL_MAX_LEN}자
            </p>
            <label className="etl-target-select-modal__label etl-target-select-modal__label--spaced" htmlFor="etl-tm-dsc">테이블 설명 (선택)</label>
            <textarea
              id="etl-tm-dsc"
              className="etl-target-select-modal__table-meta-textarea"
              value={tableDscrtn}
              onChange={(e) => setTableDscrtn(e.target.value.slice(0, ETL_TABLE_DSCRTN_MAX_LEN))}
              maxLength={ETL_TABLE_DSCRTN_MAX_LEN}
              placeholder={`설명 (최대 ${ETL_TABLE_DSCRTN_MAX_LEN}자)`}
              rows={2}
              aria-describedby="etl-tm-meta-hint etl-tm-dsc-count"
            />
            <p
              id="etl-tm-dsc-count"
              className={
                tableDscrtn.length >= ETL_TABLE_DSCRTN_MAX_LEN
                  ? 'etl-target-select-modal__meta-counter etl-target-select-modal__meta-counter--limit'
                  : 'etl-target-select-modal__meta-counter'
              }
              aria-live="polite"
            >
              {tableDscrtn.length}/{ETL_TABLE_DSCRTN_MAX_LEN}자
            </p>
          </div>

          <ColumnMappingSection
            hasSourceMapping={hasSourceMapping}
            sourceColumns={sourceColumns}
            selectedTable={selectedTable}
            showOnlyWithTransform={showOnlyWithTransform}
            setShowOnlyWithTransform={setShowOnlyWithTransform}
            setShowTransformHelpModal={setShowTransformHelpModal}
            displaySourcesForNewTable={displaySourcesForNewTable}
            newTableTargetNames={newTableTargetNames}
            newTableExcluded={newTableExcluded}
            setNewTableTargetNames={setNewTableTargetNames}
            setNewTableExcludedFor={setNewTableExcludedFor}
            mappingOnError={mappingOnError}
            setMappingOnError={setMappingOnError}
            selectedPkColumns={selectedPkColumns}
            togglePkColumn={togglePkColumn}
            effectivePkForDisplay={effectivePkForDisplay}
            sourceIndexes={sourceIndexes}
            pkReadOnlyFromSource={pkReadOnlyFromSource}
            sourcePkColumnNames={sourcePkColumnNames}
            targetColumnsInReflectedIndexes={targetColumnsInReflectedIndexes}
            targetColumnsInCustomIndexes={targetColumnsInCustomIndexes}
            transformKind={transformKind}
            setTransformKind={setTransformKind}
            typeCastConfig={typeCastConfig}
            setTypeCastConfig={setTypeCastConfig}
            stringConfig={stringConfig}
            setStringConfig={setStringConfig}
            maskingConfig={maskingConfig}
            setMaskingConfig={setMaskingConfig}
            codeMapConfig={codeMapConfig}
            setCodeMapConfig={setCodeMapConfig}
            codeMapEditorOpen={codeMapEditorOpen}
            setCodeMapEditorOpen={setCodeMapEditorOpen}
            codeMapPopoverSource={codeMapPopoverSource}
            setCodeMapPopoverSource={setCodeMapPopoverSource}
            datetimeConfig={datetimeConfig}
            setDateTimeConfig={setDateTimeConfig}
            timezones={timezones}
            displaySourcesForExisting={displaySourcesForExisting}
            sourceToTarget={sourceToTarget}
            setMappingForSource={setMappingForSource}
            columns={columns}
            columnsLoading={columnsLoading}
            columnsError={columnsError}
            selectedColumns={selectedColumns}
            toggleColumn={toggleColumn}
            selectAllColumns={selectAllColumns}
            clearAllColumns={clearAllColumns}
          />

          {sourceIndexes.length === 0 && (
            <CustomIndexSection
              sourceIndexes={sourceIndexes}
              customIndexDefinitions={customIndexDefinitions}
              setCustomIndexDefinitions={setCustomIndexDefinitions}
              targetColumnNamesForPk={targetColumnNamesForPk}
            />
          )}

          <PreviewSection previewData={previewData} previewError={previewError} />

        </div>
        <div className="etl-target-select-modal__footer">
          <button type="button" className="etl-target-select-modal__btn etl-target-select-modal__btn--secondary" onClick={onClose}>취소</button>
          {etlTableId != null && etlTableId !== '' && hasSourceMapping && sourceColumns.length > 0 && (
            <button
              type="button"
              className="etl-target-select-modal__btn etl-target-select-modal__btn--secondary"
              onClick={handlePreviewClick}
              disabled={previewLoading}
            >
              {previewLoading ? '미리보기 중…' : '미리보기'}
            </button>
          )}
          <button
            type="button"
            className="etl-target-select-modal__btn etl-target-select-modal__btn--primary"
            onClick={handleApply}
            disabled={applyLoading || (selectedTable === NEW_TABLE_VALUE ? (!(newTableName || '').trim() || newTableAllExcluded) : !selectedTable.trim())}
          >
            {applyLoading ? '적용 중…' : '적용'}
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
                <dd>먼저 정리(공백 제거, 빈값→NULL) 적용 후 타입 변환합니다. 두 단계가 순서대로 실행됩니다.</dd>
                <dt>값 매핑</dt>
                <dd>원본값 → 변환값 치환. 매핑 없음은 NULL·유지·기본값 선택. 예: M→남성, F→여성</dd>
                <dt>문자열 변환</dt>
                <dd>대문자/소문자/패딩/부분문자열/치환/정규식/컬럼 합치기. 예: 대문자 hello → HELLO</dd>
                <dt>마스킹</dt>
                <dd>뒷자리·앞자리·이메일·전화번호·이름 마스킹. 비가역적이며 원본 복구 불가. 예: 전화 010-1234-5678 → 010-****-5678, 이름 홍길동 → 홍*동</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TargetTableSelectModal;
