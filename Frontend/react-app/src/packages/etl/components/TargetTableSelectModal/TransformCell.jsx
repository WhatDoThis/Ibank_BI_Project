/**
 * TransformCell.jsx (변환 열 셀 — 종류 선택만)
 * ================================================================================
 * 매핑 테이블에서 변환 종류 select만 표시. 상세 설정은 TransformDetailRow(서브 행)에서 표시.
 *
 * [Main Functions]
 * ===========
 * 1. TransformCell: excluded, src, transformKind, setTransformKind, setMaskingConfig(마스킹 선택 시 n·char 기본값 시드)
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (TRANSFORM_OPTIONS)
 */

import { TRANSFORM_OPTIONS } from './constants.js';

// 1.
export function TransformCell({
  excluded,
  src,
  transformKind,
  setTransformKind,
  setMaskingConfig
}) {
  if (excluded) return '—';
  return (
    <select
      value={transformKind[src.name] || 'none'}
      onChange={(e) => {
        const v = e.target.value;
        setTransformKind((prev) => ({ ...prev, [src.name]: v }));
        if (v === 'masking' && typeof setMaskingConfig === 'function') {
          setMaskingConfig((p) => {
            const cur = p[src.name] || {};
            const hasN = cur.n !== undefined && cur.n !== '';
            const hasChar = cur.char !== undefined && cur.char !== '';
            return {
              ...p,
              [src.name]: {
                ...cur,
                operation: cur.operation || 'mask_right',
                n: hasN ? cur.n : 4,
                char: hasChar ? cur.char : '*',
              },
            };
          });
        }
      }}
      className="etl-target-select-modal__select etl-target-select-modal__select--transform"
      title="변환 룰"
    >
      {TRANSFORM_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
