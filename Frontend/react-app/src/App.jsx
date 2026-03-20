/**
 * App.jsx (앱 루트 — 라우팅·레이아웃)
 * ===================================
 * React 앱. 공용 레이아웃(네비)·페이지 라우팅. base 경로는 Vite base 설정 반영.
 *
 * [Main Functions]
 * ===========
 * - AppLayout: 네비(앱 브랜드 로고 public/starbucks-logo.png, 리포트/대시보드/대시보드2 링크) + Routes
 * - Routes: / → /report 리다이렉트, /report, /dashboard, /dashboard2, /new-dashboard, /new-dashboard2, /widgetboard, /etl, 그 외 → /report
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - Route path "/" → Navigate to="/report"
 * - Route path "/report" → ReportPage, "/dashboard" → DashboardPage, "/dashboard2" → Dashboard2Page, "/new-dashboard" → NewDashboardPage, "/new-dashboard2" → NewDashboard2Page, "/etl" → ETLPage (단일 ETL 페이지, packages/etl)
 *
 * [Dependencies]
 * =========
 * - React, react-router-dom (BrowserRouter, Routes, Route, NavLink, Navigate, useLocation)
 * - packages/report, packages/dashboard, packages/dashboard2, packages/new-dashboard, packages/new-dashboard2, packages/etl, packages/widgetboard
 */

import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import ReportPage from './packages/report'
import DashboardPage from './packages/dashboard'
import Dashboard2Page from './packages/dashboard2'
import WidgetboardPage from './packages/widgetboard'
import ETLPage from './packages/etl'
import NewDashboardPage from './packages/new-dashboard'
import NewDashboard2Page from './packages/new-dashboard2'

/** 도메인/서브경로 적용 시 vite.config base 설정 시 자동 반영 (끝 슬래시 제거) */
const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

const NAV_ITEMS = [
  { to: '/report', label: '리포트' },
  { to: '/dashboard', label: '대시보드' },
  { to: '/dashboard2', label: '대시보드2' },
  { to: '/new-dashboard', label: '뉴 대시보드' },
  { to: '/new-dashboard2', label: '마케팅 대시보드' },
  { to: '/widgetboard', label: '위젯보드' },
  { to: '/etl', label: 'ETL' },
]

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? '#FFF95B' : 'white',
  textDecoration: 'none',
  opacity: isActive ? 1 : 0.85,
})

const navLinkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

function AppLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="app-nav" style={{ flexShrink: 0, padding: '14px 16px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={`${ROUTER_BASENAME}/starbucks-logo.png`} alt="스타벅스 CRM" className="app-brand" style={{ height: 14, objectFit: 'contain', display: 'block' }} />
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClass} style={navLinkStyle}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard2" element={<Dashboard2Page />} />
          <Route path="/new-dashboard" element={<NewDashboardPage />} />
          <Route path="/new-dashboard2" element={<NewDashboard2Page />} />
          <Route path="/widgetboard" element={<WidgetboardPage />} />
          <Route path="/etl" element={<ETLPage />} />
          <Route path="*" element={<Navigate to="/report" replace />} />
        </Routes>
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
