/**
 * app/guards/EtlAccessRoute.jsx (ETL 라우트 가드)
 * ======================================
 * sa_dev 또는 etl_yn=Y 가 아니면 `/` 로 이동. ProtectedLayout 하위에서만 사용.
 *
 * [Main Functions]
 * ===========
 * - EtlAccessRoute
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, ./etlAccess
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { canAccessEtl } from './etlAccess.js'

export function EtlAccessRoute({ children }) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: 24 }}>
        로딩 중…
      </div>
    )
  }

  if (!canAccessEtl(me)) {
    return <Navigate to="/" replace />
  }

  return children
}
