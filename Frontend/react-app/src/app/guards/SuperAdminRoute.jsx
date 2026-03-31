/**
 * app/guards/SuperAdminRoute.jsx (슈퍼어드민·SA_DEV 전용 가드)
 * ==================================================
 * 부서 설정 등 require_super_admin API 화면. sa·sa_dev 만 통과.
 *
 * [Main Functions]
 * ===========
 * - SuperAdminRoute
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, app/admin/adminAccess
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { canAccessDeptSettings } from '@/app/admin/adminAccess.js'

export function SuperAdminRoute({ children }) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: 24 }}>
        로딩 중…
      </div>
    )
  }

  if (!canAccessDeptSettings(me)) {
    return <Navigate to="/" replace />
  }

  return children
}
