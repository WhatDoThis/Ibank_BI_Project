/**
 * app/home/homeAccess.js (홈 빠른 액세스 권한)
 * =====================================
 * /api/auth/me 의 permissions·프로젝트 claim·역할로 카드 노출 판단.
 *
 * [Main Functions]
 * ===========
 * - hasPermission, canAccessQueryStudio, canAccessDashboard, canAccessWidgetboard
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/** @param {{ permissions?: string[] } | null} me */
export function hasPermission(me, key) {
  const p = me?.permissions
  if (!Array.isArray(p)) return false
  return p.includes(key)
}

/** 쿼리 스튜디오: query.read 또는 query.execute */
export function canAccessQueryStudio(me) {
  return hasPermission(me, 'query.read') || hasPermission(me, 'query.execute')
}

export function canAccessDashboard(me) {
  return hasPermission(me, 'dashboard')
}

export function canAccessWidgetboard(me) {
  return hasPermission(me, 'widgetboard')
}
