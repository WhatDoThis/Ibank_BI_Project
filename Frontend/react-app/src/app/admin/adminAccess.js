/**
 * app/admin/adminAccess.js (조직 어드민 UI 판별)
 * ======================================
 * user_dvsn 허용값: sa_dev, sa, a, o, u 만. 그 외는 canonUserDvsn 이 빈 문자열 → 메뉴·권한 없음.
 * 백엔드 user_dvsn_codes·require_org_admin 과 동일 집합.
 *
 * [Main Functions]
 * ===========
 * - canonUserDvsn, canAccessOrgAdmin, canAccessDeptSettings, canAccessProjectAdminPages(o 포함)
 * - meLoginEmail(/me 의 email·호환 user_email), isCreatorSelf, isEtlCreateLabelSelf(생성자 열·본인 배지)
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

/** /api/auth/me 는 `email` 필드 사용(표준). 레거시 `user_email` 병행. */
export function meLoginEmail(me) {
  if (!me) return ''
  return String(me.email ?? me.user_email ?? '').trim().toLowerCase()
}

/** @param {{ user_id?: number | null, email?: string | null, user_email?: string | null } | null} me */
export function isCreatorSelfEmail(me, creatorEmail) {
  const a = meLoginEmail(me)
  const b = String(creatorEmail ?? '').trim().toLowerCase()
  return Boolean(a && b && a === b)
}

/** @param {{ user_id?: number | null } | null} me */
export function isCreatorSelfByUserId(me, creatorUserId) {
  if (me?.user_id == null || creatorUserId == null || creatorUserId === '') return false
  return Number(me.user_id) === Number(creatorUserId)
}

/**
 * 생성자 열: project_create_user_id·dptmt_create_user_id·creator_user_id 우선, 없으면 creator_email.
 * @param {{ user_id?: number | null, email?: string | null, user_email?: string | null } | null} me
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isCreatorSelf(me, row) {
  if (!me || !row || typeof row !== 'object') return false
  const uid =
    row.project_create_user_id ??
    row.dptmt_create_user_id ??
    row.creator_user_id ??
    row.create_user_id
  if (isCreatorSelfByUserId(me, uid)) return true
  return isCreatorSelfEmail(me, row.creator_email)
}

/**
 * ETL: create_user_id 일치 또는 라벨이 로그인 이메일과 동일·접두.
 * @param {{ user_id?: number | null, email?: string | null, user_email?: string | null } | null} me
 * @param {string | null | undefined} label
 * @param {number | string | null | undefined} createUserId — API가 주면 우선 비교
 */
export function isEtlCreateLabelSelf(me, label, createUserId) {
  if (isCreatorSelfByUserId(me, createUserId)) return true
  const email = meLoginEmail(me)
  if (!email) return false
  const s = String(label || '').trim()
  if (!s) return false
  const sl = s.toLowerCase()
  if (sl === email) return true
  return (
    sl.startsWith(`${email} `) ||
    sl.startsWith(`${email}(`) ||
    sl.startsWith(`${email}|`) ||
    sl.startsWith(`${email},`)
  )
}
