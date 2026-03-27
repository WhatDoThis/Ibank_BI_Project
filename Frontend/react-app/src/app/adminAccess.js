/**
 * app/adminAccess.js (조직 어드민 UI 판별)
 * ======================================
 * 백엔드 require_org_admin 과 동일: user_dvsn 이 admin·super_admin·sa_dev.
 *
 * [Main Functions]
 * ===========
 * - canAccessOrgAdmin, canAccessDeptSettings (부서 관리 /api/admin/org)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/** @param {{ user_dvsn?: string | null } | null} me */
export function canAccessOrgAdmin(me) {
  const d = (me?.user_dvsn || '').trim().toLowerCase()
  return d === 'admin' || d === 'super_admin' || d === 'sa_dev'
}

/** super_admin·sa_dev — 백엔드 require_super_admin 과 동일 */
export function canAccessDeptSettings(me) {
  const d = (me?.user_dvsn || '').trim().toLowerCase()
  return d === 'super_admin' || d === 'sa_dev'
}
