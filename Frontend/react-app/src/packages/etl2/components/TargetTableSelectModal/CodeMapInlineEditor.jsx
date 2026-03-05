/**
 * CodeMapInlineEditor.jsx (값 매핑 인라인 편집)
 * ================================================================================
 * 원본값→변환값 쌍을 배열로 관리해 중복 키 시 행 유실 방지. [+ 추가], 매핑 안 된 값: NULL/유지/기본값.
 *
 * [Main Functions]
 * ===========
 * - CodeMapInlineEditor: sourceName, config, onChange props로 값 매핑 편집 UI
 *
 * [Dependencies]
 * =========
 * - React (useState, useEffect)
 */

import { useState, useEffect } from 'react';

export function CodeMapInlineEditor({ sourceName, config, onChange }) {
  const [items, setItems] = useState(() =>
    Object.entries(config.map || {}).map(([k, v]) => ({ key: k, value: v }))
  );
  const unmapped = config.unmapped || 'null';
  const defaultVal = config.default_value ?? '';

  const flushMap = (nextItems) => {
    const map = Object.fromEntries(nextItems.map((i) => [i.key, i.value]));
    onChange({ ...config, map });
  };
  const setUnmapped = (v) => onChange({ ...config, unmapped: v });
  const setDefault = (v) => onChange({ ...config, default_value: v });

  const configMapKey = JSON.stringify(config.map || {});
  useEffect(() => {
    setItems(Object.entries(config.map || {}).map(([k, v]) => ({ key: k, value: v })));
  }, [sourceName, configMapKey]);

  const addRow = () => {
    const next = [...items, { key: '', value: '' }];
    setItems(next);
    flushMap(next);
  };
  const setKey = (idx, key) => {
    if (idx < 0 || idx >= items.length) return;
    const next = items.map((e, i) => (i === idx ? { ...e, key } : e));
    setItems(next);
    flushMap(next);
  };
  const setVal = (idx, val) => {
    if (idx < 0 || idx >= items.length) return;
    const next = items.map((e, i) => (i === idx ? { ...e, value: val } : e));
    setItems(next);
    flushMap(next);
  };
  const removeRow = (idx) => {
    if (idx < 0 || idx >= items.length) return;
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    flushMap(next);
  };

  return (
    <div className="etl-target-select-modal__code-map-editor" data-source={sourceName}>
      <div className="etl-target-select-modal__code-map-rows">
        {items.map((item, idx) => (
          <div key={idx} className="etl-target-select-modal__code-map-row">
            <input type="text" value={item.key} onChange={(e) => setKey(idx, e.target.value)} placeholder="원본값" className="etl-target-select-modal__input--code-map" />
            <span>→</span>
            <input type="text" value={item.value} onChange={(e) => setVal(idx, e.target.value)} placeholder="변환값" className="etl-target-select-modal__input--code-map" />
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
