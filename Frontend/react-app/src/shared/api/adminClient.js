/**
 * shared/api/adminClient.js (조직 어드민 API)
 * ============================================
 * /api/admin/* — users·roles·projects·members·org·invite·search(403 시 메시지).
 *
 * [Main Functions]
 * ===========
 * - getAdminUsers, patchAdminUserSuspend, patchAdminUserActivate
 * - getAdminOrg, patchAdminOrg, getAdminOrgDepartments, postAdminOrgDepartment, patchAdminOrgDepartment, deleteAdminOrgDepartment
 * - getAdminRoles, postAdminRole, putAdminRole, deleteAdminRole
 * - getAdminProjects, postAdminProject, patchAdminProject, deleteAdminProject
 * - getAdminProjectMembers, postAdminProjectMember, patchAdminProjectMember, deleteAdminProjectMember
 * - getAdminUsersSearch
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

export async function getAdminOrgDepartments() {
  return request('GET', '/api/admin/org/departments')
}

/** @param {{ dptmt_name: string, parent_dptmt_info_id?: number|null, dptmt_code?: string|null }} body */
export async function postAdminOrgDepartment(body) {
  return request('POST', '/api/admin/org/departments', body)
}

/** @param {{ dptmt_name?: string|null, dptmt_code?: string|null, use_yn?: 'Y'|'N'|null }} body */
export async function patchAdminOrgDepartment(dptmtInfoId, body) {
  return request('PATCH', `/api/admin/org/departments/${dptmtInfoId}`, body)
}

export async function deleteAdminOrgDepartment(dptmtInfoId) {
  return request('DELETE', `/api/admin/org/departments/${dptmtInfoId}`)
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

export async function getAdminUsersSearch(q) {
  const qq = encodeURIComponent((q || '').trim())
  return request('GET', `/api/admin/users/search?q=${qq}`)
}

export async function getAdminRoles() {
  return request('GET', '/api/admin/roles')
}

/** @param {{ pmssn_name: string, pmssn_list?: string[] }} body */
export async function postAdminRole(body) {
  return request('POST', '/api/admin/roles', body)
}

/** @param {{ pmssn_name?: string|null, pmssn_list?: string[]|null }} body */
export async function putAdminRole(pmssnMasterId, body) {
  return request('PUT', `/api/admin/roles/${pmssnMasterId}`, body)
}

export async function deleteAdminRole(pmssnMasterId) {
  return request('DELETE', `/api/admin/roles/${pmssnMasterId}`)
}

export async function getAdminProjects() {
  return request('GET', '/api/admin/projects')
}

/** @param {{ project_name: string, project_dscrtn?: string|null }} body */
export async function postAdminProject(body) {
  return request('POST', '/api/admin/projects', body)
}

/** @param {{ project_name?: string|null, project_dscrtn?: string|null, active_yn?: string|null }} body */
export async function patchAdminProject(projectInfoId, body) {
  return request('PATCH', `/api/admin/projects/${projectInfoId}`, body)
}

export async function deleteAdminProject(projectInfoId) {
  return request('DELETE', `/api/admin/projects/${projectInfoId}`)
}

export async function getAdminProjectMembers(projectInfoId) {
  return request('GET', `/api/admin/projects/${projectInfoId}/members`)
}

/** @param {{ ptcpnt_user_id: number, pmssn_master_id: number }} body */
export async function postAdminProjectMember(projectInfoId, body) {
  return request('POST', `/api/admin/projects/${projectInfoId}/members`, body)
}

/** @param {{ pmssn_master_id: number }} body */
export async function patchAdminProjectMember(projectInfoId, ptcpntUserId, body) {
  return request(
    'PATCH',
    `/api/admin/projects/${projectInfoId}/members/${ptcpntUserId}`,
    body,
  )
}

export async function deleteAdminProjectMember(projectInfoId, ptcpntUserId) {
  return request('DELETE', `/api/admin/projects/${projectInfoId}/members/${ptcpntUserId}`)
}
