/**
 * App.jsx (앱 루트 — 라우팅·레이아웃)
 * ===================================
 * React 앱. 공용 레이아웃(네비)·페이지 라우팅. base 경로는 Vite base 설정 반영.
 *
 * [Main Functions]
 * ===========
 * - AppLayout: 네비(리포트/대시보드/대시보드2 링크) + Outlet
 * - Routes: / → /report 리다이렉트, /report, /dashboard, /dashboard2, /widgetboard, /etl, 그 외 → /report
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - Route path "/" → Navigate to="/report"
 * - Route path "/report" → ReportPage, "/dashboard" → DashboardPage, "/dashboard2" → Dashboard2Page, "/etl" → ETLPage
 *
 * [Dependencies]
 * =========
 * - React, react-router-dom (BrowserRouter, Routes, Route, NavLink, Navigate, useLocation)
 * - packages/report, packages/dashboard, packages/dashboard2, packages/etl
 */

import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import ReportPage from './packages/report'
import DashboardPage from './packages/dashboard'
import Dashboard2Page from './packages/dashboard2'
import WidgetboardPage from './packages/widgetboard'
import ETLPage from './packages/etl'

/** 도메인/서브경로 적용 시 vite.config base 설정 시 자동 반영 (끝 슬래시 제거) */
const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

function AppLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="app-nav" style={{ flexShrink: 0, padding: '14px 16px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="app-brand" style={{ fontWeight: 600 }}>스타벅스 CRM</span>
        <NavLink
          to="/report"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          style={({ isActive }) => ({ color: 'white', textDecoration: 'none', opacity: isActive ? 1 : 0.85 })}
        >
          리포트
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          style={({ isActive }) => ({ color: 'white', textDecoration: 'none', opacity: isActive ? 1 : 0.85 })}
        >
          대시보드
        </NavLink>
        <NavLink
          to="/dashboard2"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          style={({ isActive }) => ({ color: 'white', textDecoration: 'none', opacity: isActive ? 1 : 0.85 })}
        >
          대시보드2
        </NavLink>
        <NavLink
          to="/widgetboard"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          style={({ isActive }) => ({ color: 'white', textDecoration: 'none', opacity: isActive ? 1 : 0.85 })}
        >
          위젯보드
        </NavLink>
        <NavLink
          to="/etl"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          style={({ isActive }) => ({ color: 'white', textDecoration: 'none', opacity: isActive ? 1 : 0.85 })}
        >
          ETL
        </NavLink>
      </nav>
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard2" element={<Dashboard2Page />} />
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
