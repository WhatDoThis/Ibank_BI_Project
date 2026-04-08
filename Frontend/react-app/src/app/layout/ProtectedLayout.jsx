/**
 * app/layout/ProtectedLayout.jsx (로그인 후 공통 레이아웃)
 * Analytica 셸: 좌측 주 메뉴(풀 라벨) + 고정 헤더·브레드크럼 + 스크롤 본문
 * requiresProject 항목은 JWT에 프로젝트 클레임 없으면 비활성 표시(클릭 시 홈으로 튕김 방지)
 * 헤더: 이메일 · ProjectHeaderSelect(GET /api/projects) · NotificationBell
 * 사이드바 브랜드: 접힘 시 시린 마크, 펼침 시 워드마크. 네비 접힘 시 항목은 아이콘만 표시.
 * docs/ui/UI_UX_재사용_가이드.md §2·§5
 */

import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { NAV_ITEMS } from './navConfig.js'
import { pageTitleFromPath } from './pageTitles.js'
import { useAuth } from '@/app/auth/AuthContext.jsx'
import { hasProjectClaim } from '@/shared/auth/jwtUtils.js'
import { getAccessToken } from '@/shared/auth/tokenStorage.js'
import {
  canAccessDeptSettings,
  canAccessOrgAdmin,
  canAccessProjectAdminPages,
} from '@/app/admin/adminAccess.js'
import { canAccessEtl } from '@/app/guards/etlAccess.js'
import {
  canAccessDashboard,
  canAccessQueryStudio,
  canAccessWidgetboard,
} from '@/app/home/homeAccess.js'
import { NotificationBell } from './NotificationBell.jsx'
import { ProjectHeaderSelect } from './ProjectHeaderSelect.jsx'
import { SidebarNavIcon } from './SidebarNavIcon.jsx'

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
      if (item.to === '/query-studio' && !canAccessQueryStudio(me)) return false
      if (item.to === '/dashboard' && !canAccessDashboard(me)) return false
      if (item.to === '/widgetboard' && !canAccessWidgetboard(me)) return false
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
            src={`${ROUTER_BASENAME}/starbucks-siren-mark.png`}
            alt=""
            className="ibank-sidebar-brand__mark"
            width={40}
            height={40}
            decoding="async"
          />
          <img
            src={`${ROUTER_BASENAME}/starbucks-logo.png`}
            alt="Starbucks"
            className="ibank-sidebar-brand__wordmark"
            width={160}
            height={32}
            decoding="async"
          />
        </div>
        <nav className="ibank-sidebar-nav">
          {navItems.map((item) => {
            const { to, label, icon, requiresProject } = item
            const blocked = requiresProject && !hasProjectClaim(getAccessToken())
            const linkBody = (
              <>
                <span className="ibank-sidebar-link__icon" aria-hidden="true">
                  <SidebarNavIcon name={icon} />
                </span>
                <span className="ibank-sidebar-link__full" aria-hidden="true">
                  {label}
                </span>
              </>
            )
            if (blocked) {
              return (
                <span
                  key={to}
                  className="ibank-sidebar-link ibank-sidebar-link--disabled"
                  title={`${label} — 홈에서 프로젝트를 선택한 뒤 이용할 수 있습니다.`}
                  role="presentation"
                >
                  {linkBody}
                </span>
              )
            }
            return (
              <NavLink
                key={to}
                to={to}
                className={navLinkClass}
                title={label}
                aria-label={label}
                end={to === '/'}
              >
                {linkBody}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="ibank-shell-main-col">
        <header className="ibank-shell-header">
          <h1 className="ibank-shell-header-title">{headerTitle}</h1>
          <div className="ibank-shell-header-actions">
            <span className="ibank-shell-user">{me?.email}</span>
            <ProjectHeaderSelect />
            <NotificationBell />
            <NavLink
              to="/mypage"
              className={({ isActive }) =>
                `ibank-shell-mypage-link${isActive ? ' ibank-shell-mypage-link--active' : ''}`
              }
            >
              마이페이지
            </NavLink>
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
          <div className="ibank-outlet-scroll">
            <div className="ibank-outlet">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
