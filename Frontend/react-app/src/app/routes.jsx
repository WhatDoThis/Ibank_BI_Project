/**
 * app/routes.jsx (앱 라우트 집합)
 * ===============================
 * 공개: login·signup·create-org. ProtectedLayout. /mypage. /admin/users·/admin/org(SuperAdminRoute). ETL EtlAccessRoute.
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
import MyPage from '@/app/MyPage.jsx'
import AdminUsersPage from '@/app/AdminUsersPage.jsx'
import AdminOrgPage from '@/app/AdminOrgPage.jsx'
import { ProtectedLayout } from '@/app/ProtectedLayout.jsx'
import { NeedProjectRoute } from '@/app/NeedProjectRoute.jsx'
import { EtlAccessRoute } from '@/app/EtlAccessRoute.jsx'
import { OrgAdminRoute } from '@/app/OrgAdminRoute.jsx'
import { SuperAdminRoute } from '@/app/SuperAdminRoute.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/create-org" element={<CreateOrgPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route
          path="/admin/users"
          element={
            <OrgAdminRoute>
              <AdminUsersPage />
            </OrgAdminRoute>
          }
        />
        <Route
          path="/admin/org"
          element={
            <SuperAdminRoute>
              <AdminOrgPage />
            </SuperAdminRoute>
          }
        />
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
