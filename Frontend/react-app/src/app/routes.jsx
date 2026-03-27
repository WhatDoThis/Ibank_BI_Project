/**
 * app/routes.jsx (앱 라우트 집합)
 * ===============================
 * /login·/signup·/create-org 공개, 그 외 ProtectedLayout. ETL은 EtlAccessRoute(sa_dev·etl_manager).
 *
 * [Main]
 * 1. AppRoutes — 전체 Route 트리
 */

import { Routes, Route, Navigate } from 'react-router-dom'

import QueryStudioPage from '@/packages/query_studio'
import WidgetboardPage from '@/packages/widgetboard'
import ETLPage from '@/packages/etl'
import CampaignDashboardPage from '@/packages/campaign_dashboard'

import LoginPage from '@/app/LoginPage.jsx'
import SignupPage from '@/app/SignupPage.jsx'
import CreateOrgPage from '@/app/CreateOrgPage.jsx'
import HomePage from '@/app/HomePage.jsx'
import { ProtectedLayout } from '@/app/ProtectedLayout.jsx'
import { NeedProjectRoute } from '@/app/NeedProjectRoute.jsx'
import { EtlAccessRoute } from '@/app/EtlAccessRoute.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/create-org" element={<CreateOrgPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/report" element={<Navigate to="/query-studio" replace />} />
        <Route
          path="/query-studio"
          element={
            <NeedProjectRoute>
              <QueryStudioPage />
            </NeedProjectRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <NeedProjectRoute>
              <CampaignDashboardPage />
            </NeedProjectRoute>
          }
        />
        <Route path="/campaign-dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/widgetboard"
          element={
            <NeedProjectRoute>
              <WidgetboardPage />
            </NeedProjectRoute>
          }
        />
        <Route
          path="/etl"
          element={
            <EtlAccessRoute>
              <ETLPage />
            </EtlAccessRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
