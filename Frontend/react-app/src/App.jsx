/**
 * App.jsx (앱 루트 — BrowserRouter·네비·Outlet)
 * =============================================
 * 라우트 트리는 app/routes.jsx(AppRoutes), 네비 항목은 app/navConfig.js(NAV_ITEMS).
 *
 * [Main Functions]
 * ===========
 * - AppLayout: 상단 네비 + main 안에 AppRoutes
 * - App: BrowserRouter + basename(Vite base)
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/routes, app/navConfig, packages/* (간접)
 */

import { BrowserRouter, NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './app/navConfig.js'
import { AppRoutes } from './app/routes.jsx'

const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? '#FFF95B' : 'white',
  textDecoration: 'none',
  opacity: isActive ? 1 : 0.85,
})

const navLinkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

function AppLayout() {
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
        }}
      >
        <img
          src={`${ROUTER_BASENAME}/starbucks-logo.png`}
          alt="스타벅스 CRM"
          className="app-brand"
          style={{ height: 14, objectFit: 'contain', display: 'block' }}
        />
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClass} style={navLinkStyle}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <AppRoutes />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
