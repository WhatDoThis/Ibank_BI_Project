/**
 * TransformDetailRow.jsx (변환 상세 설정 — 서브 행)
 * ================================================================================
 * 매핑 테이블에서 변환 종류 선택 시 해당 행 아래 colspan으로 펼쳐지는 상세 설정 UI.
 * type_cast: 변환 대상 타입 select. string: 가공 방식 + 파라미터. code_map: 인라인 편집. masking: 방식 + n/char.
 *
 * [Main Functions]
 * ===========
 * - TransformDetailRow: kind별 서브 UI (타입 변환 대상, 문자열 가공, 값 치환, 마스킹)
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (TYPE_CAST_TARGET_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, inferredTypeToPg)
 * - ./CodeMapInlineEditor
 */

import {
  TYPE_CAST_TARGET_OPTIONS,
  STRING_OPERATION_OPTIONS,
  MASKING_OPERATION_OPTIONS,
  inferredTypeToPg
} from './constants.js';
import { CodeMapInlineEditor } from './CodeMapInlineEditor.jsx';

/* ─── 힌트 툴팁 ─── */
function HintIcon({ text }) {
  if (!text) return null;
  return (
    <span className="etl-hint-icon" title={text} aria-label={text}>
      ?
    </span>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <label className="etl-target-select-modal__transform-detail-label">
      {children}
      {hint && <HintIcon text={hint} />}
    </label>
  );
}

function HintSelect({ options, value, onChange, className }) {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="etl-detail__select-wrap">
      <select value={value} onChange={onChange} className={className}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {selected?.hint && <HintIcon text={selected.hint} />}
    </div>
  );
}

function ParamInput({ label, hint, type = 'text', value, onChange, placeholder, min, max, maxLength, className }) {
  const inputClass = className || 'etl-target-select-modal__input--detail';
  return (
    <div className="etl-target-select-modal__transform-detail-group">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        className={inputClass}
      />
    </div>
  );
}

export function TransformDetailRow({
  src,
  colSpan,
  kind,
  sourceColumns,
  typeCastConfig,
  setTypeCastConfig,
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
  if (kind === 'none' || kind === 'cleansing') return null;

  return (
    <tr className="etl-target-select-modal__row--transform-detail">
      <td colSpan={colSpan} className="etl-target-select-modal__cell--transform-detail">
        <div className="etl-target-select-modal__transform-detail-inner">

          {(kind === 'type_cast' || kind === 'cleansing_and_type_cast') && (
            <div className="etl-target-select-modal__transform-detail-group etl-detail__card">
              <FieldLabel hint="저장 시 적용할 PostgreSQL 타입">변환 대상 타입</FieldLabel>
              <HintSelect
                options={TYPE_CAST_TARGET_OPTIONS}
                value={typeCastConfig[src.name]?.target_type || inferredTypeToPg(src.type)}
                onChange={(e) => setTypeCastConfig((p) => ({
                  ...p,
                  [src.name]: { ...(p[src.name] || {}), target_type: e.target.value }
                }))}
                className="etl-target-select-modal__select--type-cast-target"
              />
            </div>
          )}

          {kind === 'string' && (
            <div className="etl-detail__card">
              <div className="etl-target-select-modal__transform-detail-group">
                <FieldLabel hint="문자열에 적용할 연산">가공 방식</FieldLabel>
                <HintSelect
                  options={STRING_OPERATION_OPTIONS}
                  value={stringConfig[src.name]?.operation || 'uppercase'}
                  onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), operation: e.target.value } }))}
                  className="etl-target-select-modal__select--string-op"
                />
              </div>

              {(stringConfig[src.name]?.operation === 'pad_left' || stringConfig[src.name]?.operation === 'pad_right') && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">전체 길이</label>
                    <input type="number" min={1} placeholder="10" value={stringConfig[src.name]?.width ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), width: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">채울 문자</label>
                    <input type="text" maxLength={1} placeholder="0" value={stringConfig[src.name]?.fill_char ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), fill_char: e.target.value } }))} className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  </div>
                </>
              )}

              {stringConfig[src.name]?.operation === 'substring' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">시작 위치</label>
                    <input type="number" min={0} placeholder="0" value={stringConfig[src.name]?.start ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), start: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">추출 길이</label>
                    <input type="number" min={0} placeholder="전체" value={stringConfig[src.name]?.length ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), length: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                </>
              )}

              {stringConfig[src.name]?.operation === 'replace' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">찾을 문자열</label>
                    <input type="text" placeholder="abc" value={stringConfig[src.name]?.old ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), old: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">바꿀 문자열</label>
                    <input type="text" placeholder="xyz" value={stringConfig[src.name]?.new ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), new: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                </>
              )}

              {stringConfig[src.name]?.operation === 'regex_replace' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">정규식 패턴</label>
                    <input type="text" placeholder="\d+" value={stringConfig[src.name]?.pattern ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), pattern: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <label className="etl-target-select-modal__transform-detail-label">치환 문자열</label>
                    <input type="text" placeholder="" value={stringConfig[src.name]?.replacement ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), replacement: e.target.value } }))} className="etl-target-select-modal__input--detail" />
                  </div>
                </>
              )}

              {stringConfig[src.name]?.operation === 'concat' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel hint="체크한 컬럼을 순서대로 구분자로 이어 붙입니다">합칠 컬럼</FieldLabel>
                    <div className="etl-target-select-modal__concat-checkboxes">
                      {sourceColumns.map((c) => {
                        const cols = Array.isArray(stringConfig[src.name]?.columns) && stringConfig[src.name].columns.length > 0 ? stringConfig[src.name].columns : [src.name];
                        const checked = cols.includes(c.name);
                        const orderNum = checked ? cols.indexOf(c.name) + 1 : null;
                        return (
                          <label key={c.name} className="etl-concat-checkbox">
                            <span className="etl-concat-order-badge">{orderNum != null ? orderNum : ''}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? cols.filter((x) => x !== c.name) : [...cols, c.name];
                                setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), columns: next.length > 0 ? next : [src.name] } }));
                              }}
                            />
                            <span className="etl-concat-checkbox-label">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel hint="컬럼 사이에 넣을 문자">구분자</FieldLabel>
                    <input type="text" placeholder="-" value={stringConfig[src.name]?.separator ?? ''} onChange={(e) => setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), separator: e.target.value } }))} className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  </div>
                </>
              )}
            </div>
          )}

          {kind === 'code_map' && (
            <div className="etl-target-select-modal__transform-detail-group etl-target-select-modal__transform-detail-group--wide">
              {Object.keys(codeMapConfig[src.name]?.map || {}).length >= 4 ? (
                <>
                  <button type="button" className="etl-target-select-modal__btn-link" onClick={() => setCodeMapPopoverSource((s) => (s === src.name ? null : src.name))}>
                    {codeMapPopoverSource === src.name ? '닫기' : '편집 (팝업)'}
                  </button>
                  {codeMapPopoverSource === src.name && (
                    <div className="etl-target-select-modal__code-map-popover">
                      <CodeMapInlineEditor sourceName={src.name} config={codeMapConfig[src.name] || {}} onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))} />
                      <button type="button" className="etl-target-select-modal__btn etl-target-select-modal__btn--secondary" onClick={() => setCodeMapPopoverSource(null)}>닫기</button>
                    </div>
                  )}
                </>
              ) : (
                <CodeMapInlineEditor sourceName={src.name} config={codeMapConfig[src.name] || {}} onChange={(cfg) => setCodeMapConfig((prev) => ({ ...prev, [src.name]: cfg }))} />
              )}
            </div>
          )}

          {kind === 'masking' && (
            <div className="etl-detail__card">
              <div className="etl-target-select-modal__transform-detail-group">
                <FieldLabel hint="개인정보 비식별화 방식">마스킹 방식</FieldLabel>
                <HintSelect
                  options={MASKING_OPERATION_OPTIONS}
                  value={maskingConfig[src.name]?.operation || 'mask_right'}
                  onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), operation: e.target.value } }))}
                  className="etl-target-select-modal__select--masking-op"
                />
              </div>
              {(maskingConfig[src.name]?.operation === 'mask_right' || maskingConfig[src.name]?.operation === 'mask_left') && (
                <>
                  <ParamInput label="가릴 자릿수" hint="숫자/문자열에서 가릴 개수" type="number" min={0} placeholder="4" value={maskingConfig[src.name]?.n ?? ''} onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), n: e.target.value } }))} className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  <ParamInput label="마스킹 문자" hint="대체할 문자 1개" type="text" maxLength={1} placeholder="*" value={maskingConfig[src.name]?.char ?? ''} onChange={(e) => setMaskingConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), char: e.target.value } }))} className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                </>
              )}
            </div>
          )}

        </div>
      </td>
    </tr>
  );
}
