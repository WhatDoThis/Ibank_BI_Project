/**
 * app/guards/ProjectFeatureRoute.jsx (프로젝트 기능별 /me 권한 가드)
 * ==========================================================
 * project_info.feature_flags·역할 권한은 백엔드가 DB 기준으로 계산해 GET /me 의 permissions에 내려준다.
 * 이 가드는 그 스냅샷(me)으로 라우트를 막는다 — feature_flags 변경 직후에는 refreshMe()로 /me를 다시 받아야 한다.
 * NeedProjectRoute 안쪽에 둔다(JWT 프로젝트 클레임 이후).
 *
 * [Main Functions]
 * ===========
 * - ProjectFeatureRoute
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, app/home/homeAccess
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import {
  canAccessDashboard,
  canAccessQueryStudio,
  canAccessWidgetboard,
} from '@/app/home/homeAccess.js'

/** @param {{ feature: 'query-studio'|'dashboard'|'widgetboard', children: import('react').ReactNode }} props */
export function ProjectFeatureRoute({ feature, children }) {
  const { me } = useAuth()
  let ok = false
  if (feature === 'query-studio') ok = canAccessQueryStudio(me)
  else if (feature === 'dashboard') ok = canAccessDashboard(me)
  else if (feature === 'widgetboard') ok = canAccessWidgetboard(me)
  if (!ok) return <Navigate to="/" replace />
  return children
}
