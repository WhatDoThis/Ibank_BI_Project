/**
 * shared/api/notificationsClient.js (알림 API)
 * ===========================================
 * GET/PATCH /api/notifications — request·Bearer(http.js).
 *
 * [Main Functions]
 * ===========
 * - getNotifications, getUnreadCount, patchReadAll, patchReadOne
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js
 */

import { request } from './http.js'

export async function getNotifications(limit = 50) {
  return request('GET', `/api/notifications?limit=${encodeURIComponent(limit)}`)
}

export async function getUnreadCount() {
  return request('GET', '/api/notifications/unread-count')
}

export async function patchReadAll() {
  return request('PATCH', '/api/notifications/read-all', {})
}

export async function patchReadOne(notificationInfoId) {
  return request('PATCH', `/api/notifications/${notificationInfoId}/read`, {})
}
