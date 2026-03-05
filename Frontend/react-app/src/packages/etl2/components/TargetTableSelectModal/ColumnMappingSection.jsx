/**
 * ColumnMappingSection.jsx (소스→타겟 매핑 + 인덱스 추가)
 * ================================================================================
 * 소스 있을 때: 새 테이블 매핑 테이블 / 기존 테이블 매핑 테이블. 소스 없을 때: 컬럼 체크박스. + 인덱스 추가 영역.
 *
 * [Main Functions]
 * ===========
 * - ColumnMappingSection: hasSourceMapping, sourceColumns, selectedTable, displaySourcesForNewTable, newTableTargetNames, newTableExcluded, setNewTableTargetNames, setNewTableExcludedFor, ... (매핑/변환/PK/인덱스 관련 props)
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (ON_ERROR_OPTIONS, getOnErrorValue, isTypeCompatible)
 * - ./TransformCell
 */

import { ON_ERROR_OPTIONS, getOnErrorValue, isTypeCompatible, NEW_TABLE_VALUE } from './constants.js';
import { TransformCell } from './TransformCell.jsx';

export function ColumnMappingSection({
  hasSourceMapping,
  sourceColumns,
  selectedTable,
  showOnlyWithTransform,
  setShowOnlyWithTransform,
  setShowTransformHelpModal,
  displaySourcesForNewTable,
  newTableTargetNames,
  newTableExcluded,
  setNewTableTargetNames,
  setNewTableExcludedFor,
  mappingOnError,
  setMappingOnError,
  selectedPkColumns,
  togglePkColumn,
  effectivePkForDisplay,
  sourceIndexes,
  pkReadOnlyFromSource,
  sourcePkColumnNames,
  targetColumnsInReflectedIndexes,
  targetColumnsInCustomIndexes,
  transformKind,
  setTransformKind,
  stringConfig,
  setStringConfig,
  maskingConfig,
  setMaskingConfig,
  codeMapConfig,
  setCodeMapConfig,
  codeMapEditorOpen,
  setCodeMapEditorOpen,
  codeMapPopoverSource,
  setCodeMapPopoverSource,
  displaySourcesForExisting,
  sourceToTarget,
  setMappingForSource,
  columns,
  columnsLoading,
  columnsError,
  selectedColumns,
  toggleColumn,
  selectAllColumns,
  clearAllColumns,
  customIndexDefinitions,
  setCustomIndexDefinitions,
  targetColumnNamesForPk
}) {
  if (hasSourceMapping && sourceColumns.length > 0) {
    return (
      <div className="etl-target-select-modal__row">
        <div className="etl-target-select-modal__mapping-header">
          <label className="etl-target-select-modal__label">소스 → 타겟 컬럼 매핑 (타입이 다른 경우 매핑 불가)</label>
          <label className="etl-target-select-modal__filter-toggle">
            <input type="checkbox" checked={showOnlyWithTransform} onChange={(e) => setShowOnlyWithTransform(e.target.checked)} />
            <span>변환 설정된 컬럼만 보기</span>
          </label>
        </div>
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
                  {displaySourcesForNewTable.map((src) => {
                    const targetColName = ((newTableTargetNames[src.name] ?? src.name).trim().replace(/\s+/g, '_') || src.name);
                    const excluded = !!newTableExcluded[src.name];
                    const hasTransform = (transformKind[src.name] || 'none') !== 'none';
                    const wasPk = effectivePkForDisplay.includes(targetColName);
                    const hasIndexFromSource = sourceIndexes.length > 0 && targetColumnsInReflectedIndexes.has(targetColName);
                    const hasIndexFromCustom = sourceIndexes.length === 0 && targetColumnsInCustomIndexes.has(targetColName);
                    return (
                      <tr key={src.name} className={excluded ? 'etl-target-select-modal__row--excluded' : (hasTransform ? 'etl-target-select-modal__row--has-transform' : '')}>
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
                          <TransformCell
                            excluded={excluded}
                            src={src}
                            sourceColumns={sourceColumns}
                            transformKind={transformKind}
                            setTransformKind={setTransformKind}
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
                          />
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
                {displaySourcesForExisting.map((src) => {
                  const targetColName = sourceToTarget[src.name] ?? '';
                  const wasPk = targetColName && effectivePkForDisplay.includes(targetColName);
                  const excluded = !targetColName;
                  const hasTransform = (transformKind[src.name] || 'none') !== 'none';
                  const hasIndexFromSource = sourceIndexes.length > 0 && targetColumnsInReflectedIndexes.has(targetColName);
                  const hasIndexFromCustom = sourceIndexes.length === 0 && targetColumnsInCustomIndexes.has(targetColName);
                  return (
                    <tr key={src.name} className={excluded ? 'etl-target-select-modal__row--excluded' : (hasTransform ? 'etl-target-select-modal__row--has-transform' : '')}>
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
                        <TransformCell
                          excluded={!targetColName}
                          src={src}
                          sourceColumns={sourceColumns}
                          transformKind={transformKind}
                          setTransformKind={setTransformKind}
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
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
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
  );
}

export function CustomIndexSection({
  sourceIndexes,
  customIndexDefinitions,
  setCustomIndexDefinitions,
  targetColumnNamesForPk
}) {
  if (sourceIndexes.length > 0) return null;
  return (
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
  );
}
