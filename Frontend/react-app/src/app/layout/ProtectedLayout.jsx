/**
 * app/layout/ProtectedLayout.jsx (로그인 후 공통 레이아웃)
 * Analytica 셸: 좌측 주 메뉴(풀 라벨) + 고정 헤더·브레드크럼 + 스크롤 본문
 * requiresProject 항목은 JWT에 프로젝트 클레임 없으면 비활성 표시(클릭 시 홈으로 튕김 방지)
 * 헤더: 이메일 · ProjectHeaderSelect(GET /api/projects) · NotificationBell
 * 사이드바 브랜드: 접힘 시 시린 마크, 펼침 시 워드마크. 클릭 시 홈(`/`) 이동. 네비 접힘 시 항목은 아이콘만 표시.
 * docs/ui/UI_UX_재사용_가이드.md §2·§5
 * ShellChromeProvider: 하위 페이지가 셸 헤더·브레드크럼 현재 칸 제목을 덮어쓸 수 있음(위젯보드 캔버스 보드명).
 */

import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { NAV_ITEMS } from './navConfig.js'
import { pageTitleFromPath } from './pageTitles.js'
import { ShellChromeProvider, useShellChrome } from './ShellChromeOverrideContext.jsx'
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

function ProtectedLayoutContent({ me, logout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { override } = useShellChrome()

  const navItems = useMemo(() => {
    if (!me) return []
    return NAV_ITEMS.map((item) => {
      if (item.to === '/etl' && !canAccessEtl(me)) return null
      if (item.requiresOrgAdmin && !canAccessOrgAdmin(me)) return null
      if (item.requiresDeptAdmin && !canAccessDeptSettings(me)) return null
      if (item.requiresProjectAdmin && !canAccessProjectAdminPages(me)) return null

      if (item.children?.length) {
        const children = item.children.filter((ch) => {
          if (ch.to === '/query-studio' && !canAccessQueryStudio(me)) return false
          if (ch.to === '/dashboard' && !canAccessDashboard(me)) return false
          if (ch.to === '/widgetboard' && !canAccessWidgetboard(me)) return false
          return true
        })
        return { ...item, children }
      }
      return item
    }).filter(Boolean)
  }, [me])

  const defaultPageTitle = pageTitleFromPath(location.pathname)
  const shellHeaderTitle = override?.shellTitle ?? defaultPageTitle
  const breadcrumbCurrent = override?.breadcrumbCurrent ?? defaultPageTitle

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="ibank-app-shell">
      <aside className="ibank-sidebar" aria-label="주 메뉴">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `ibank-sidebar-brand${isActive ? ' ibank-sidebar-brand--active' : ''}`
          }
          aria-label="홈으로 이동"
          title="홈"
        >
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
        </NavLink>
        <nav className="ibank-sidebar-nav">
          {navItems.map((item) => {
            const renderLink = (it) => {
              const { to, label, icon, requiresProject } = it
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
                  className={({ isActive }) => (isActive ? 'ibank-sidebar-link active' : 'ibank-sidebar-link')}
                  title={label}
                  aria-label={label}
                  end={to === '/'}
                >
                  {linkBody}
                </NavLink>
              )
            }

            if (item.children?.length) {
              return (
                <div key={item.to} className="ibank-sidebar-nav__subsection">
                  {renderLink(item)}
                  <div className="ibank-sidebar-nav__children" role="group" aria-label="프로젝트 작업">
                    {item.children.map((ch) => renderLink(ch))}
                  </div>
                </div>
              )
            }

            return renderLink(item)
          })}
        </nav>
      </aside>

      <div className="ibank-shell-main-col">
        <header className="ibank-shell-header">
          <h1 className="ibank-shell-header-title">{shellHeaderTitle}</h1>
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
          <span className="ibank-bc-current">{breadcrumbCurrent}</span>
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

export function ProtectedLayout() {
  const { loading, me, logout } = useAuth()

  if (!loading && !me) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return <div className="app-loading--shell">로딩 중…</div>
  }

  return (
    <ShellChromeProvider>
      <ProtectedLayoutContent me={me} logout={logout} />
    </ShellChromeProvider>
  )
}
