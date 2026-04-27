/**
 * app/guards/etlAccess.js (ETL 관리자 접근 판별)
 * =====================================
 * 백엔드 require_etl_infrastructure 와 동일: SA개발자 랭크·구 ETL 관리자 구분·또는 ETL 관리 자격 부여.
 *
 * [Main Functions]
 * ===========
 * - canAccessEtl
 *
 * [Dependencies]
 * =========
 * - 없음 (순수 함수)
 */

/** @param {{ user_dvsn?: string | null, etl_yn?: string | null } | null} me `/me` 조직 역할·ETL 관리 자격 */
export function canAccessEtl(me) {
  const d = (me?.user_dvsn || '').trim().toLowerCase()
  if (d === 'sa_dev' || d === 'etl_manager') return true
  const e = (me?.etl_yn || 'N').trim().toUpperCase()
  return e === 'Y'
}
