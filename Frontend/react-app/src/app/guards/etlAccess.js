/**
 * app/guards/etlAccess.js (ETL 관리자 접근 판별)
 * =====================================
 * 백엔드 require_etl_infrastructure 와 동일: sa_dev·레거시 etl_manager·또는 etl_yn=Y.
 *
 * [Main Functions]
 * ===========
 * - canAccessEtl
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 함수)
 */

/** @param {{ user_dvsn?: string | null, etl_yn?: string | null } | null} me */
export function canAccessEtl(me) {
  const d = (me?.user_dvsn || '').trim().toLowerCase()
  if (d === 'sa_dev' || d === 'etl_manager') return true
  const e = (me?.etl_yn || 'N').trim().toUpperCase()
  return e === 'Y'
}
