/**
 * shared/api/adminClient.js (조직 어드민 API)
 * ============================================
 * /api/admin/* — users·roles·projects·members·org·invite·search(403 시 메시지).
 *
 * [Main Functions]
 * ===========
 * - getAdminUsers, patchAdminUserSuspend, patchAdminUserActivate, deleteAdminUser
 * - getAdminOrg, patchAdminOrg, getAdminOrgDepartments, postAdminOrgDepartment, patchAdminOrgDepartment, deleteAdminOrgDepartment
 * - getAdminRoles, postAdminRole, putAdminRole, deleteAdminRole
 * - getAdminRolePermissionOptions, getAdminRoleUsages, getAdminRoleProjectParticipants, getAdminRoleUserUsages
 * - getAdminProjects, getAdminProjectTables, postAdminProject, patchAdminProject, deleteAdminProject(비활성화), getAdminProjectPurgePreview, purgeAdminProject(DB삭제)
 * - getAdminProjectMembers({items,pending_invites}), deleteAdminProjectInvite, postAdminProjectMember, patchAdminProjectMember, deleteAdminProjectMember
 * - getAdminUsersSearch
 * - getAdminInviteDepartments, getAdminInviteProjects, getAdminInviteRoles, postAdminInvite
 * - getAdminUserWorkAssets, getAdminOwnershipTransferTargets, postAdminTransferOwnership
 * - getAdminUserChangeOptions, putAdminUserManagement
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js
 */

import { request } from './http.js'

export async function getAdminUsers() {
  return request('GET', '/api/admin/users')
}

/** 프로젝트 생성 모달: 부서 트리 내 사용자(본인 제외) */
export async function getAdminUsersDeptTree() {
  return request('GET', '/api/admin/users?scope=dept_tree')
}

/** 프로젝트 멤버에 부여 가능한 pmssn 목록(시스템 기본+부서 커스텀) */
export async function getAdminRolesProjectAssignable() {
  return request('GET', '/api/admin/roles?scope=project_assignable')
}

/** 테이블 마스터 — sort=project_create 시 dash 우선 정렬 */
export async function getAdminTablesForProjectCreate() {
  return request('GET', '/api/admin/tables?limit=2000&sort=project_create')
}

export async function patchAdminUserSuspend(userId) {
  return request('PATCH', `/api/admin/users/${userId}/suspend`, {})
}

export async function patchAdminUserActivate(userId) {
  return request('PATCH', `/api/admin/users/${userId}/activate`, {})
}

/** 비활성 사용자만 DB에서 삭제(백엔드 검증). */
export async function deleteAdminUser(userId) {
  return request('DELETE', `/api/admin/users/${userId}`)
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

/**
 * @param {{ dptmt_name?: string|null, dptmt_code?: string|null, use_yn?: 'Y'|'N'|null, migrate_users_to_dptmt_info_id?: number|null }} body
 * migrate_users_to_dptmt_info_id: use_yn=N일 때 소속 사용자 일괄 이관 대상 부서 PK
 */
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

/** @param {number} userId */
export async function getAdminUserWorkAssets(userId) {
  return request('GET', `/api/admin/users/${userId}/work-assets`)
}

/**
 * @param {number} dptmtInfoId
 * @param {number} excludeUserId 소유자 user_id
 * @param {{ etlInfra?: boolean, resourceType?: 'table_master'|'dptmt_creator'|null, tableMasterId?: number }} [opts]
 */
export async function getAdminOwnershipTransferTargets(dptmtInfoId, excludeUserId, opts = {}) {
  const o = typeof opts === 'boolean' ? { etlInfra: opts } : opts || {}
  const etlInfra = !!o.etlInfra
  const q = new URLSearchParams({
    dptmt_info_id: String(dptmtInfoId),
    exclude_user_id: String(excludeUserId),
  })
  if (etlInfra) q.set('etl_infra', 'true')
  if (o.resourceType === 'table_master' && o.tableMasterId != null) {
    q.set('resource_type', 'table_master')
    q.set('table_master_id', String(o.tableMasterId))
  }
  if (o.resourceType === 'dptmt_creator') {
    q.set('resource_type', 'dptmt_creator')
  }
  return request('GET', `/api/admin/users/ownership-transfer-targets?${q}`)
}

/** @param {{ resource_type: string, resource_id: number, from_user_id: number, to_user_id: number }} body — resource_type에 project_invite(행 PK project_ptcpnt_info_id) 가능 */
export async function postAdminTransferOwnership(body) {
  return request('POST', '/api/admin/users/transfer-ownership', body)
}

export async function getAdminUserChangeOptions(userId) {
  return request('GET', `/api/admin/users/${userId}/change-options`)
}

/** @param {{ dptmt_info_id?: number|null, user_dvsn?: 'sa'|'a'|'o'|'u'|null, etl_yn?: 'Y'|'N'|null, project_info_ids?: number[]|null, project_assignments?: {project_info_id:number, pmssn_master_id:number}[]|null }} body */
export async function putAdminUserManagement(userId, body) {
  return request('PUT', `/api/admin/users/${userId}/management`, body)
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

export async function getAdminRolePermissionOptions() {
  return request('GET', '/api/admin/roles/permission-options')
}

export async function getAdminRoleUsages(pmssnMasterId) {
  return request('GET', `/api/admin/roles/${pmssnMasterId}/usages`)
}

export async function getAdminRoleProjectParticipants(pmssnMasterId, projectInfoId) {
  return request('GET', `/api/admin/roles/${pmssnMasterId}/projects/${projectInfoId}/participants`)
}

export async function getAdminRoleUserUsages(userId) {
  return request('GET', `/api/admin/roles/users/${userId}/usages`)
}

export async function getAdminProjects() {
  return request('GET', '/api/admin/projects')
}

/** @returns {Promise<{ items?: Array<{ table_master_id: number, db_type?: string, table_name?: string, table_label?: string, use_query_studio?: boolean, use_widgetboard?: boolean }> }>} */
export async function getAdminProjectTables(projectInfoId) {
  return request('GET', `/api/admin/projects/${projectInfoId}/tables`)
}

/**
 * @param {{
 *   project_name: string,
 *   project_dscrtn?: string|null,
 *   feature_flags?: { query?: boolean, dash?: boolean, widget?: boolean }|null,
 *   table_mappings?: { table_master_id: number, use_query_studio?: boolean, use_widgetboard?: boolean }[],
 *   table_master_ids?: number[],
 *   creator_pmssn_master_id: number,
 *   members?: { user_id: number, pmssn_master_id: number }[],
 *   external_invites?: { user_id: number, pmssn_master_id: number }[],
 * }} body
 */
export async function postAdminProject(body) {
  return request('POST', '/api/admin/projects', body)
}

/**
 * @param {{
 *   project_name?: string|null,
 *   project_dscrtn?: string|null,
 *   active_yn?: string|null,
 *   feature_flags?: { query?: boolean, dash?: boolean, widget?: boolean }|null,
 *   table_mappings?: { table_master_id: number, use_query_studio?: boolean, use_widgetboard?: boolean }[]|null,
 *   table_master_ids?: number[]|null,
 * }} body
 */
export async function patchAdminProject(projectInfoId, body) {
  return request('PATCH', `/api/admin/projects/${projectInfoId}`, body)
}

/** 소프트 삭제: active_yn=N */
export async function deleteAdminProject(projectInfoId) {
  return request('DELETE', `/api/admin/projects/${projectInfoId}`)
}

/** 비활성 프로젝트 물리 삭제 전 위젯보드·위젯·공유 요약 */
export async function getAdminProjectPurgePreview(projectInfoId) {
  return request('GET', `/api/admin/projects/${projectInfoId}/purge-preview`)
}

/** 비활성 프로젝트만 물리 삭제(위젯보드 연쇄·참여·매핑·알림·초대 참조 정리) */
export async function purgeAdminProject(projectInfoId) {
  return request('DELETE', `/api/admin/projects/${projectInfoId}/purge`)
}

export async function getAdminProjectMembers(projectInfoId) {
  return request('GET', `/api/admin/projects/${projectInfoId}/members`)
}

/** 미수락 타부서 project_invite 알림 행 삭제 */
export async function deleteAdminProjectInvite(projectInfoId, notificationInfoId) {
  return request(
    'DELETE',
    `/api/admin/projects/${projectInfoId}/invites/${notificationInfoId}`,
  )
}

/**
 * @param {{ ptcpnt_user_id: number, pmssn_master_id: number }} body
 * @returns {Promise<{ message?: string, outcome?: 'member_added'|'invite_sent' }>}
 */
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
