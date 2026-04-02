/**
 * TransformDetailRow.jsx (변환 상세 설정 — 서브 행)
 * ================================================================================
 * 매핑 테이블에서 변환 종류 선택 시 해당 행 아래 colspan으로 펼쳐지는 상세 설정 UI.
 * type_cast: 변환 대상 타입 select. string: 가공 방식 + 파라미터. code_map: 인라인 편집. masking: 방식 + n/char.
 *
 * [Main Functions]
 * ===========
 * 1. TransformDetailRow: kind별 서브 UI + getTransformTypeGuidance 기반 타입·적재 안내(비차단)
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (TYPE_CAST_TARGET_OPTIONS, STRING_OPERATION_OPTIONS, MASKING_OPERATION_OPTIONS, inferredTypeToPg, getTransformTypeGuidance)
 * - ./CodeMapInlineEditor
 */

import {
  TYPE_CAST_TARGET_OPTIONS,
  STRING_OPERATION_OPTIONS,
  MASKING_OPERATION_OPTIONS,
  DATETIME_OPERATION_OPTIONS,
  DATETIME_DEFAULT_INPUT_FORMAT,
  DATETIME_DEFAULT_OUTPUT_FORMAT,
  DATETIME_EXTRACT_PART_OPTIONS,
  DATETIME_DATE_DIFF_UNIT_OPTIONS,
  inferredTypeToPg,
  getTransformTypeGuidance
} from './constants.js';
import { CodeMapInlineEditor } from './CodeMapInlineEditor.jsx';

// 1.
/* ─── 힌트 툴팁 ─── */
function HintIcon({ text }) {
  if (!text) return null;
  return (
    <span className="etl-hint-icon" title={text} aria-label={text}>
      ?
    </span>
  );
}

// 2.
function FieldLabel({ children, hint }) {
  return (
    <label className="etl-target-select-modal__transform-detail-label">
      {children}
      {hint && <HintIcon text={hint} />}
    </label>
  );
}

// 3.
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

// 4.
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

// 5.
export function TransformDetailRow({
  src,
  colSpan,
  kind,
  targetPgType = null,
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
  setCodeMapPopoverSource,
  datetimeConfig,
  setDateTimeConfig,
  timezones = []
}) {
  if (kind === 'none') return null;

  const resolvedTypeCastTarget =
    kind === 'type_cast' || kind === 'cleansing_and_type_cast'
      ? (typeCastConfig[src.name]?.target_type || inferredTypeToPg(src.type))
      : '';

  const guidanceNotes = getTransformTypeGuidance({
    sourceType: src.type,
    kind,
    typeCastTarget: resolvedTypeCastTarget,
    targetPgType,
    stringOperation: stringConfig[src.name]?.operation || ''
  });

  const guidanceBlock =
    guidanceNotes.length > 0 ? (
      <div className="etl-target-select-modal__transform-guidance" role="status">
        <div className="etl-target-select-modal__transform-guidance-title">타입·적재 안내</div>
        <ul className="etl-target-select-modal__transform-guidance-list">
          {guidanceNotes.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    ) : null;

  if (kind === 'cleansing') {
    return (
      <tr className="etl-target-select-modal__row--transform-detail">
        <td colSpan={colSpan} className="etl-target-select-modal__cell--transform-detail">
          <div className="etl-target-select-modal__transform-detail-inner">{guidanceBlock}</div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="etl-target-select-modal__row--transform-detail">
      <td colSpan={colSpan} className="etl-target-select-modal__cell--transform-detail">
        <div className="etl-target-select-modal__transform-detail-inner">
          {guidanceBlock}

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
                className="etl-target-select-modal__select--detail"
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
                  className="etl-target-select-modal__select--detail"
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
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? cols.filter((x) => x !== c.name) : [...cols, c.name];
                                setStringConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), columns: next.length > 0 ? next : [src.name] } }));
                              }}
                            />
                            <span className="etl-concat-checkbox-label">{c.name}</span>
                            <span className="etl-concat-order-badge">{orderNum != null ? orderNum : ''}</span>
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
                  className="etl-target-select-modal__select--detail"
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

          {kind === 'datetime' && (
            <div className="etl-detail__card">
              <div className="etl-target-select-modal__transform-detail-group">
                <FieldLabel hint="날짜/시간에 적용할 연산">연산</FieldLabel>
                <select
                  value={datetimeConfig[src.name]?.operation || 'timezone_convert'}
                  onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), operation: e.target.value } }))}
                  className="etl-target-select-modal__select--detail"
                >
                  {DATETIME_OPERATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'timezone_convert' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel>원본 시간대 (소스 데이터 기준)</FieldLabel>
                    <select
                      value={datetimeConfig[src.name]?.source_timezone || 'UTC'}
                      onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), source_timezone: e.target.value } }))}
                      className="etl-target-select-modal__select--detail"
                    >
                      {(timezones.length ? timezones : [{ timezone_id: 'UTC', display_name: 'UTC (협정 세계시)' }]).map((tz) => (
                        <option key={tz.timezone_id} value={tz.timezone_id}>{tz.display_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel>변환할 시간대</FieldLabel>
                    <select
                      value={datetimeConfig[src.name]?.target_timezone || 'Asia/Seoul'}
                      onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), target_timezone: e.target.value } }))}
                      className="etl-target-select-modal__select--detail"
                    >
                      {(timezones.length ? timezones : [{ timezone_id: 'Asia/Seoul', display_name: '한국 표준시 (UTC+09:00)' }]).map((tz) => (
                        <option key={tz.timezone_id} value={tz.timezone_id}>{tz.display_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'date_format' && (
                <>
                  <ParamInput
                    label="입력 형식"
                    hint="strftime 스타일 (예: %Y-%m-%d)"
                    value={datetimeConfig[src.name]?.input_format ?? DATETIME_DEFAULT_INPUT_FORMAT}
                    onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), input_format: e.target.value || DATETIME_DEFAULT_INPUT_FORMAT } }))}
                    placeholder={DATETIME_DEFAULT_INPUT_FORMAT}
                  />
                  <ParamInput
                    label="출력 형식"
                    hint="strftime 스타일 (예: %Y/%m/%d)"
                    value={datetimeConfig[src.name]?.output_format ?? DATETIME_DEFAULT_OUTPUT_FORMAT}
                    onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), output_format: e.target.value || DATETIME_DEFAULT_OUTPUT_FORMAT } }))}
                    placeholder={DATETIME_DEFAULT_OUTPUT_FORMAT}
                  />
                </>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'extract' && (
                <div className="etl-target-select-modal__transform-detail-group">
                  <FieldLabel hint="날짜에서 추출할 부분">추출 부분</FieldLabel>
                  <HintSelect
                    options={DATETIME_EXTRACT_PART_OPTIONS}
                    value={datetimeConfig[src.name]?.part || 'year'}
                    onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), part: e.target.value } }))}
                    className="etl-target-select-modal__select--detail"
                  />
                </div>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'date_diff' && (
                <>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel hint="이 컬럼과의 날짜 차이를 계산할 다른 소스 컬럼">비교 컬럼</FieldLabel>
                    <select
                      value={datetimeConfig[src.name]?.other_column ?? ''}
                      onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), other_column: e.target.value || undefined } }))}
                      className="etl-target-select-modal__select--detail"
                    >
                      <option value="">선택</option>
                      {(sourceColumns || []).filter((c) => (c.name ?? c.column_name) !== src.name).map((c) => {
                        const name = c.name ?? c.column_name ?? '';
                        return <option key={name} value={name}>{name}</option>;
                      })}
                    </select>
                  </div>
                  <div className="etl-target-select-modal__transform-detail-group">
                    <FieldLabel hint="차이 단위">단위</FieldLabel>
                    <HintSelect
                      options={DATETIME_DATE_DIFF_UNIT_OPTIONS}
                      value={datetimeConfig[src.name]?.unit || 'days'}
                      onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), unit: e.target.value } }))}
                      className="etl-target-select-modal__select--detail"
                    />
                  </div>
                </>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'age' && (
                <p className="etl-target-select-modal__transform-detail-summary">오늘 기준 만 나이(정수)로 변환합니다. 추가 설정 없음.</p>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'date_add' && (
                <>
                  <ParamInput label="일" hint="더할 일 수" type="number" min={0} value={datetimeConfig[src.name]?.days ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), days: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  <ParamInput label="월" hint="더할 월 수" type="number" min={0} value={datetimeConfig[src.name]?.months ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), months: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  <ParamInput label="년" hint="더할 년 수" type="number" min={0} value={datetimeConfig[src.name]?.years ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), years: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                </>
              )}
              {(datetimeConfig[src.name]?.operation || 'timezone_convert') === 'date_subtract' && (
                <>
                  <ParamInput label="일" hint="뺄 일 수" type="number" min={0} value={datetimeConfig[src.name]?.days ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), days: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  <ParamInput label="월" hint="뺄 월 수" type="number" min={0} value={datetimeConfig[src.name]?.months ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), months: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                  <ParamInput label="년" hint="뺄 년 수" type="number" min={0} value={datetimeConfig[src.name]?.years ?? ''} onChange={(e) => setDateTimeConfig((p) => ({ ...p, [src.name]: { ...(p[src.name] || {}), years: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 } }))} placeholder="0" className="etl-target-select-modal__input--detail etl-target-select-modal__input--tiny" />
                </>
              )}
            </div>
          )}

        </div>
      </td>
    </tr>
  );
}
