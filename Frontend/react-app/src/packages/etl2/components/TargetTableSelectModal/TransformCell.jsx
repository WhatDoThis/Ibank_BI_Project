/**
 * TransformCell.jsx (변환 열 셀 — 종류 선택만)
 * ================================================================================
 * 매핑 테이블에서 변환 종류 select만 표시. 상세 설정은 TransformDetailRow(서브 행)에서 표시.
 *
 * [Main Functions]
 * ===========
 * - TransformCell: excluded, src, transformKind, setTransformKind
 *
 * [Dependencies]
 * =========
 * - React
 * - ./constants (TRANSFORM_OPTIONS)
 */

import { TRANSFORM_OPTIONS } from './constants.js';

export function TransformCell({
  excluded,
  src,
  transformKind,
  setTransformKind
}) {
  if (excluded) return '—';
  return (
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
  );
}
