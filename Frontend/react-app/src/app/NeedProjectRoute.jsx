/**
 * app/NeedProjectRoute.jsx (프로젝트 선택 필수 라우트)
 * ================================================
 * JWT에 project_info_id 없으면 `/` 로 이동. 리포트·대시보드 등에 사용.
 *
 * [Main Functions]
 * ===========
 * - NeedProjectRoute
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/auth/jwtUtils, shared/auth/tokenStorage
 */

import { Navigate } from 'react-router-dom'

import { hasProjectClaim } from '@/shared/auth/jwtUtils.js'
import { getAccessToken } from '@/shared/auth/tokenStorage.js'

export function NeedProjectRoute({ children }) {
  const at = getAccessToken()
  if (!hasProjectClaim(at)) {
    return <Navigate to="/" replace />
  }
  return children
}
