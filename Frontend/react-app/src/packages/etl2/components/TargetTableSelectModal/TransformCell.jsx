/**
 * TransformCell.jsx (변환 열 셀)
 * ================================================================================
 * 새 테이블/기존 테이블 매핑 테이블에서 공통 사용. select + 값매핑/문자열/마스킹 UI.
 *
 * [Main Functions]
 * ===========
 * - TransformCell: excluded, src, sourceColumns, transformKind, setTransformKind, stringConfig, setStringConfig, maskingConfig, setMaskingConfig, codeMapConfig, setCodeMapConfig, codeMapEditorOpen, setCodeMapEditorOpen, codeMapPopoverSource, setCodeMapPopoverSource
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (TRANSFORM_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS)
 * - ./CodeMapInlineEditor
 */

import {
  TRANSFORM_OPTIONS,
  STRING_OPERATION_OPTIONS,
  MASKING_OPERATION_OPTIONS
} from './constants.js';
import { CodeMapInlineEditor } from './CodeMapInlineEditor.jsx';

export function TransformCell({
  excluded,
  src,
  sourceColumns,
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
  setCodeMapPopoverSource
}) {
  if (excluded) return '—';
  const kind = transformKind[src.name] || 'none';
  return (
    <>
      <select
        value={kind}
        onChange={(e) => setTransformKind((prev) => ({ ...prev, [src.name]: e.target.value }))}
        className="etl-target-select-modal__select etl-target-select-modal__select--transform"
        title="변환 룰"
      >
        {TRANSFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {kind === 'code_map' && (
        (Object.keys(codeMapConfig[src.name]?.map || {}).length >= 4 ? (
          <>
            <button type="button" className="etl-target-select-modal__btn-link etl-target-select-modal__btn--code-map-edit" onClick={() => setCodeMapPopoverSource((s) => (s === src.name ? null : src.name))}>
              {codeMapPopoverSource === src.name ? '닫기' : '편집'}
            </button>
            {codeMapPopoverSource === src.name && (
              <div className="etl-target-select-modal__code-map-popover">
                <CodeMapInlineEditor sourceName={src.name} config={codeMapConfig[src.name] || {}} onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))} />
                <button type="button" className="etl-target-select-modal__btn etl-target-select-modal__btn--secondary" onClick={() => setCodeMapPopoverSource(null)}>닫기</button>
              </div>
            )}
          </>
        ) : (
          <>
            <button type="button" className="etl-target-select-modal__btn-link etl-target-select-modal__btn--code-map-edit" onClick={() => setCodeMapEditorOpen((p) => ({ ...p, [src.name]: !p[src.name] }))}>
              {codeMapEditorOpen[src.name] ? '접기' : '편집'}
            </button>
            {codeMapEditorOpen[src.name] && (
              <CodeMapInlineEditor sourceName={src.name} config={codeMapConfig[src.name] || {}} onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))} />
            )}
          </>
        ))
      )}
      {kind === 'string' && (
        <span className="etl-target-select-modal__string-op">
          <select
            value={stringConfig[src.name]?.operation || 'uppercase'}
            onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), operation: e.target.value } }))}
            className="etl-target-select-modal__select etl-target-select-modal__select--string-op"
          >
            {STRING_OPERATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(stringConfig[src.name]?.operation === 'pad_left' || stringConfig[src.name]?.operation === 'pad_right') && (
            <>
              <input type="number" min={1} placeholder="길이" value={stringConfig[src.name]?.width ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), width: e.target.value } }))} className="etl-target-select-modal__input--small" />
              <input type="text" maxLength={1} placeholder="채울 문자" value={stringConfig[src.name]?.fill_char ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), fill_char: e.target.value } }))} className="etl-target-select-modal__input--tiny" />
            </>
          )}
          {stringConfig[src.name]?.operation === 'substring' && (
            <>
              <input type="number" min={0} placeholder="시작" value={stringConfig[src.name]?.start ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), start: e.target.value } }))} className="etl-target-select-modal__input--small" />
              <input type="number" min={0} placeholder="길이" value={stringConfig[src.name]?.length ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), length: e.target.value } }))} className="etl-target-select-modal__input--small" />
            </>
          )}
          {stringConfig[src.name]?.operation === 'replace' && (
            <>
              <input type="text" placeholder="찾을 문자열" value={stringConfig[src.name]?.old ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), old: e.target.value } }))} className="etl-target-select-modal__input--small" />
              <input type="text" placeholder="바꿀 문자열" value={stringConfig[src.name]?.new ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), new: e.target.value } }))} className="etl-target-select-modal__input--small" />
            </>
          )}
          {stringConfig[src.name]?.operation === 'regex_replace' && (
            <>
              <input type="text" placeholder="정규식" value={stringConfig[src.name]?.pattern ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), pattern: e.target.value } }))} className="etl-target-select-modal__input--small" />
              <input type="text" placeholder="치환" value={stringConfig[src.name]?.replacement ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), replacement: e.target.value } }))} className="etl-target-select-modal__input--small" />
            </>
          )}
          {stringConfig[src.name]?.operation === 'concat' && (
            <>
              <select multiple className="etl-target-select-modal__select--concat-cols" value={Array.isArray(stringConfig[src.name]?.columns) && stringConfig[src.name].columns.length > 0 ? stringConfig[src.name].columns : [src.name]} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), columns: Array.from(e.target.selectedOptions, (o) => o.value) } }))}>
                {sourceColumns.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
              </select>
              <input type="text" placeholder="구분자" value={stringConfig[src.name]?.separator ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), separator: e.target.value } }))} className="etl-target-select-modal__input--small" />
              <span className="etl-target-select-modal__hint etl-target-select-modal__hint--concat">Ctrl+클릭으로 여러 컬럼 선택</span>
            </>
          )}
        </span>
      )}
      {kind === 'masking' && (
        <span className="etl-target-select-modal__masking-op">
          <select
            value={maskingConfig[src.name]?.operation || 'mask_right'}
            onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), operation: e.target.value } }))}
            className="etl-target-select-modal__select etl-target-select-modal__select--masking-op"
          >
            {MASKING_OPERATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(maskingConfig[src.name]?.operation === 'mask_right' || maskingConfig[src.name]?.operation === 'mask_left') && (
            <>
              <input type="number" min={0} placeholder="n" title="마스킹 자릿수" value={maskingConfig[src.name]?.n ?? ''} onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), n: e.target.value } }))} className="etl-target-select-modal__input--tiny" />
              <input type="text" maxLength={1} placeholder="*" value={maskingConfig[src.name]?.char ?? ''} onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), char: e.target.value } }))} className="etl-target-select-modal__input--tiny" />
            </>
          )}
        </span>
      )}
    </>
  );
}
