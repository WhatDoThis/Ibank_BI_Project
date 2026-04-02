/**
 * EtlStorageDbSelect.jsx (ETL 저장 DB 공용 셀렉트)
 * ==================================================
 * 파일/DB 연동·배치 등에서 동일한 저장 DB 옵션을 쓰기 위한 select. 옵션은 getEtlStorageSelectOptions(etl2ListStorageConnections)로 생성.
 *
 * [Main Functions]
 * ===========
 * 1. 저장 DB 셀렉트 렌더(value/onChange·connections)
 *
 * [Dependencies]
 * =========
 * - React, ../utils/storageDb.js (getEtlStorageSelectOptions)
 */

import { useMemo } from 'react';
import { getEtlStorageSelectOptions } from '../utils/storageDb.js';

// 1.
function EtlStorageDbSelect({
  value,
  onChange,
  connections,
  className,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}) {
  const opts = useMemo(() => getEtlStorageSelectOptions(connections), [connections]);
  const v = value === undefined || value === null ? '' : String(value);

  return (
    <select
      id={id}
      className={className}
      disabled={disabled}
      value={v}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      {opts.map((o) => (
        <option key={o.key} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default EtlStorageDbSelect;
