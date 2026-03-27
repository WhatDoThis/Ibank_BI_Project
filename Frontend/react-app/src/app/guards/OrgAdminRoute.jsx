/**
 * app/guards/OrgAdminRoute.jsx (조직 어드민 라우트 가드)
 * ============================================
 * admin·super_admin·sa_dev 만 /admin/* 하위 접근.
 *
 * [Main Functions]
 * ===========
 * - OrgAdminRoute
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, app/admin/adminAccess
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { canAccessOrgAdmin } from '@/app/admin/adminAccess.js'

export function OrgAdminRoute({ children }) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: 24 }}>
        로딩 중…
      </div>
    )
  }

  if (!canAccessOrgAdmin(me)) {
    return <Navigate to="/" replace />
  }

  return children
}
