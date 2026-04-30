/**
 * widgetboard/api/widgetBoardClient.js (위젯 보드 API)
 * =====================================================
 * /api/widget-boards/* — JWT·작업 프로젝트는 shared/api/http.request 가 Bearer로 처리.
 *
 * [Main Functions]
 * ===========
 * - listWidgetBoards, getWidgetBoard, createWidgetBoard, updateWidgetBoard, deleteWidgetBoard
 * - addWidget, updateWidget, deleteWidget, patchWidgetBoardLayout
 * - upsertWidgetBoardShare, deleteWidgetBoardShare
 * - getWidgetBoardParticipants, getWidgetBoardInviteCandidates
 * - postWidgetBoardInviteNotifications, postAcceptWidgetBoardInvite, postRejectWidgetBoardInvite
 * - fetchWidgetData (응답 columns에 type, 기간 필터 시 meta.applied_date_column)
 * - getTableProfile(tableMasterId): GET `/api/widget-boards/table/{id}/profile` — 컬럼 프로파일·추천·샘플
 *
 * [Dependencies]
 * =========
 * - @/shared/api/http.js request
 */

import { request } from '@/shared/api/http.js'

export async function listWidgetBoards() {
  return request('GET', '/api/widget-boards')
}

export async function createWidgetBoard(body) {
  return request('POST', '/api/widget-boards', body)
}

export async function getWidgetBoard(boardId) {
  return request('GET', `/api/widget-boards/${boardId}`)
}

export async function updateWidgetBoard(boardId, body) {
  return request('PATCH', `/api/widget-boards/${boardId}`, body)
}

export async function deleteWidgetBoard(boardId) {
  return request('DELETE', `/api/widget-boards/${boardId}`)
}

export async function addWidget(boardId, body) {
  return request('POST', `/api/widget-boards/${boardId}/widgets`, body)
}

export async function updateWidget(boardId, widgetId, body) {
  return request('PATCH', `/api/widget-boards/${boardId}/widgets/${widgetId}`, body)
}

export async function deleteWidget(boardId, widgetId) {
  return request('DELETE', `/api/widget-boards/${boardId}/widgets/${widgetId}`)
}

export async function patchWidgetBoardLayout(boardId, items) {
  return request('PATCH', `/api/widget-boards/${boardId}/layout`, { items })
}

export async function upsertWidgetBoardShare(boardId, body) {
  return request('POST', `/api/widget-boards/${boardId}/share`, body)
}

export async function deleteWidgetBoardShare(boardId, sharedUserId) {
  return request('DELETE', `/api/widget-boards/${boardId}/share/${sharedUserId}`)
}

export async function getWidgetBoardParticipants(boardId) {
  return request('GET', `/api/widget-boards/${boardId}/participants`)
}

export async function getWidgetBoardInviteCandidates(boardId) {
  return request('GET', `/api/widget-boards/${boardId}/invite-candidates`)
}

/** @param {{ invitations: Array<{ shared_user_id: number, can_edit?: boolean }> }} body */
export async function postWidgetBoardInviteNotifications(boardId, body) {
  return request('POST', `/api/widget-boards/${boardId}/invite-notifications`, body)
}

/** @param {{ notification_info_id: number }} body */
export async function postAcceptWidgetBoardInvite(boardId, body) {
  return request('POST', `/api/widget-boards/${boardId}/accept-invite`, body)
}

/** @param {{ notification_info_id: number }} body */
export async function postRejectWidgetBoardInvite(boardId, body) {
  return request('POST', `/api/widget-boards/${boardId}/reject-invite`, body)
}

export async function fetchWidgetData(boardId, widgetId) {
  return request('POST', `/api/widget-boards/${boardId}/widgets/${widgetId}/data`)
}

/** @param {number|string} tableMasterId table_master_id */
export async function getTableProfile(tableMasterId) {
  const id = String(tableMasterId)
  return request('GET', `/api/widget-boards/table/${id}/profile`)
}
