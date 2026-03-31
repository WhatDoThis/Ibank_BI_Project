/**
 * app/admin/adminAccess.js (조직 어드민 UI 판별)
 * ======================================
 * user_dvsn 허용값: sa_dev, sa, a, o, u 만. 그 외는 canonUserDvsn 이 빈 문자열 → 메뉴·권한 없음.
 * 백엔드 user_dvsn_codes·require_org_admin 과 동일 집합.
 *
 * [Main Functions]
 * ===========
 * - canonUserDvsn, canAccessOrgAdmin, canAccessDeptSettings, canAccessProjectAdminPages(o 포함)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

const _ALLOWED_DVSN = new Set(['sa_dev', 'sa', 'a', 'o', 'u'])

/** @param {{ user_dvsn?: string | null } | null} me */
export function canonUserDvsn(me) {
  const d = (me?.user_dvsn || '').trim().toLowerCase()
  return _ALLOWED_DVSN.has(d) ? d : ''
}

/** @param {{ user_dvsn?: string | null } | null} me */
export function canAccessOrgAdmin(me) {
  const c = canonUserDvsn(me)
  return c === 'sa_dev' || c === 'sa' || c === 'a'
}

/** sa·sa_dev — 백엔드 require_super_admin 과 동일 */
export function canAccessDeptSettings(me) {
  const c = canonUserDvsn(me)
  return c === 'sa' || c === 'sa_dev'
}

/** sa_dev·sa·a·o — /api/admin/projects·멤버(참여 시) */
export function canAccessProjectAdminPages(me) {
  const c = canonUserDvsn(me)
  return c === 'sa_dev' || c === 'sa' || c === 'a' || c === 'o'
}
