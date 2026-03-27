/**
 * app/layout/ProtectedLayout.jsx (로그인 후 공통 레이아웃)
 * ============================================
 * 미인증 시 /login. 상단 네비·Outlet.
 *
 * [Main Functions]
 * ===========
 * - ProtectedLayout
 *
 * [Dependencies]
 * =========
 * - react-router-dom, ./navConfig, app/auth/AuthContext, app/guards/etlAccess, app/admin/adminAccess, NotificationBell
 */

import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'

import { NAV_ITEMS } from './navConfig.js'
import { useAuth } from '@/app/auth/AuthContext.jsx'
import {
  canAccessDeptSettings,
  canAccessOrgAdmin,
  canAccessProjectAdminPages,
} from '@/app/admin/adminAccess.js'
import { canAccessEtl } from '@/app/guards/etlAccess.js'
import { NotificationBell } from './NotificationBell.jsx'

const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? '#FFF95B' : 'white',
  textDecoration: 'none',
  opacity: isActive ? 1 : 0.85,
})

const navLinkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

export function ProtectedLayout() {
  const { loading, me, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = useMemo(() => {
    if (!me) return []
    return NAV_ITEMS.filter((item) => {
      if (item.to === '/etl' && !canAccessEtl(me)) return false
      if (item.requiresOrgAdmin && !canAccessOrgAdmin(me)) return false
      if (item.requiresDeptAdmin && !canAccessDeptSettings(me)) return false
      if (item.requiresProjectAdmin && !canAccessProjectAdminPages(me)) return false
      return true
    })
  }, [me])

  if (!loading && !me) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: 24 }}>
        로딩 중…
      </div>
    )
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav
        className="app-nav"
        style={{
          flexShrink: 0,
          padding: '14px 16px',
          background: 'var(--primary)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <img
          src={`${ROUTER_BASENAME}/starbucks-logo.png`}
          alt="스타벅스 CRM"
          className="app-brand"
          style={{ height: 14, objectFit: 'contain', display: 'block' }}
        />
        {navItems.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClass} style={navLinkStyle}>
            {label}
          </NavLink>
        ))}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <NotificationBell />
          <span style={{ fontSize: 13, opacity: 0.9 }}>{me?.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      </nav>
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
