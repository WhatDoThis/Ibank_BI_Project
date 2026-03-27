/**
 * shared/api/adminClient.js (조직 어드민 API)
 * ============================================
 * /api/admin/users 등 — org admin 전용(403 시 메시지).
 *
 * [Main Functions]
 * ===========
 * - getAdminUsers, patchAdminUserSuspend, patchAdminUserActivate
 * - getAdminOrg, patchAdminOrg (super_admin·sa_dev)
 * - getAdminInviteDepartments, getAdminInviteProjects, getAdminInviteRoles, postAdminInvite
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js
 */

import { request } from './http.js'

export async function getAdminUsers() {
  return request('GET', '/api/admin/users')
}

export async function patchAdminUserSuspend(userId) {
  return request('PATCH', `/api/admin/users/${userId}/suspend`, {})
}

export async function patchAdminUserActivate(userId) {
  return request('PATCH', `/api/admin/users/${userId}/activate`, {})
}

export async function getAdminOrg() {
  return request('GET', '/api/admin/org')
}

export async function patchAdminOrg(body) {
  return request('PATCH', '/api/admin/org', body)
}

export async function getAdminInviteDepartments() {
  return request('GET', '/api/admin/invite/departments')
}

export async function getAdminInviteProjects(dptmtInfoId) {
  const q = encodeURIComponent(String(dptmtInfoId))
  return request('GET', `/api/admin/invite/projects?dptmt_info_id=${q}`)
}

export async function getAdminInviteRoles(dptmtInfoId) {
  const q = encodeURIComponent(String(dptmtInfoId))
  return request('GET', `/api/admin/invite/roles?dptmt_info_id=${q}`)
}

/** @param {{ email: string, dptmt_info_id?: number|null, invite_target_dvsn: string, invite_etl_yn?: 'Y'|'N', invite_project_info_id?: number, invite_pmssn_master_id?: number }} body */
export async function postAdminInvite(body) {
  return request('POST', '/api/admin/users/invite', body)
}
