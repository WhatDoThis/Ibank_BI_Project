/**
 * app/layout/ProtectedLayout.jsx (로그인 후 공통 레이아웃)
 * Analytica 셸: 좌측 주 메뉴(풀 라벨) + 고정 헤더·브레드크럼 + 스크롤 본문
 * docs/ui/UI_UX_재사용_가이드.md §2·§5
 */

import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { NAV_ITEMS } from './navConfig.js'
import { pageTitleFromPath } from './pageTitles.js'
import { useAuth } from '@/app/auth/AuthContext.jsx'
import {
  canAccessDeptSettings,
  canAccessOrgAdmin,
  canAccessProjectAdminPages,
} from '@/app/admin/adminAccess.js'
import { canAccessEtl } from '@/app/guards/etlAccess.js'
import { NotificationBell } from './NotificationBell.jsx'

import '@/styles/app-shell.css'
import '@/styles/ibank-scrollbars.css'

const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

const navLinkClass = ({ isActive }) =>
  isActive ? 'ibank-sidebar-link active' : 'ibank-sidebar-link'

export function ProtectedLayout() {
  const { loading, me, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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

  const headerTitle = pageTitleFromPath(location.pathname)

  if (!loading && !me) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return <div className="app-loading--shell">로딩 중…</div>
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="ibank-app-shell">
      <aside className="ibank-sidebar" aria-label="주 메뉴">
        <div className="ibank-sidebar-brand">
          <img
            src={`${ROUTER_BASENAME}/ibank-bi-logo.svg`}
            alt="IBank BI"
            width={40}
            height={32}
            decoding="async"
          />
        </div>
        <nav className="ibank-sidebar-nav">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={navLinkClass}
              title={label}
              end={to === '/'}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="ibank-shell-main-col">
        <header className="ibank-shell-header">
          <h1 className="ibank-shell-header-title">{headerTitle}</h1>
          <div className="ibank-shell-header-actions">
            <NotificationBell />
            <span className="ibank-shell-user">{me?.email}</span>
            <button type="button" className="ibank-shell-logout" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </header>

        <div className="ibank-shell-breadcrumb" aria-label="breadcrumb">
          <span>IBank BI</span>
          <span className="ibank-bc-sep">/</span>
          <span className="ibank-bc-current">{headerTitle}</span>
        </div>

        <main className="ibank-shell-body">
          <div className="ibank-outlet">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
