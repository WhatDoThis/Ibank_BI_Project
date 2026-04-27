/**
 * app/guards/EtlAccessRoute.jsx (ETL 라우트 가드)
 * ======================================
 * 전사 운영(SA개발자) 랭크가 아니면서 ETL 관리 자격도 없으면 `/` 로 이동. ProtectedLayout 하위에서만 사용.
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
