/**
 * App.jsx (앱 루트 — 라우팅·레이아웃)
 * ===================================
 * React 앱. 공용 레이아웃(네비게이션) + 페이지 패키지 라우팅.
 * - / → /report 로 리다이렉트
 * - /report → 리포트(쿼리 빌더)
 * - /dashboard → 대시보드1, /dashboard2 → 대시보드2(성과리포트·ECharts 차트)
 * - 그 외 → /report 로 리다이렉트. base 경로는 Vite base 설정 반영.
 *
 * [의존성]
 * - React, react-router-dom, packages/report, packages/dashboard, packages/dashboard2
 */

import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import ReportPage from './packages/report'
import DashboardPage from './packages/dashboard'
import Dashboard2Page from './packages/dashboard2'

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
      </nav>
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard2" element={<Dashboard2Page />} />
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
