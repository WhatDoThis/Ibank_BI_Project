/**
 * app/routes.jsx (앱 라우트 집합)
 * ===============================
 * 페이지 컴포넌트는 packages/* 에서 import. App.jsx는 BrowserRouter·레이아웃만 담당.
 *
 * [Main]
 * 1. AppRoutes — 전체 Route 트리
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import ReportPage from '@/packages/report'
import DashboardPage from '@/packages/dashboard'
import WidgetboardPage from '@/packages/widgetboard'
import ETLPage from '@/packages/etl'
import NewDashboardPage from '@/packages/new-dashboard'
import CampaignDashboardPage from '@/packages/campaign_dashboard'
import NewDashboard2Page from '@/packages/new-dashboard2'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/new-dashboard" element={<NewDashboardPage />} />
      <Route path="/campaign-dashboard" element={<CampaignDashboardPage />} />
      <Route path="/new-dashboard2" element={<NewDashboard2Page />} />
      <Route path="/widgetboard" element={<WidgetboardPage />} />
      <Route path="/etl" element={<ETLPage />} />
      <Route path="*" element={<Navigate to="/report" replace />} />
    </Routes>
  )
}
