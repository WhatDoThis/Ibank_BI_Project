/**
 * app/ProjectAdminRoute.jsx (프로젝트 어드민·운영자 라우트 가드)
 * ==========================================================
 * operator·조직 어드민이 /admin/projects·멤버 화면 접근.
 *
 * [Main Functions]
 * ===========
 * - ProjectAdminRoute
 *
 * [Dependencies]
 * =========
 * - app/auth/AuthContext, app/admin/adminAccess
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { canAccessProjectAdminPages } from '@/app/admin/adminAccess.js'

export function ProjectAdminRoute({ children }) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: 24 }}>
        로딩 중…
      </div>
    )
  }

  if (!canAccessProjectAdminPages(me)) {
    return <Navigate to="/" replace />
  }

  return children
}
