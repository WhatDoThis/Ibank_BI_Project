/**
 * app/routes.jsx (앱 라우트 집합 — 페이지는 auth/home/mypage/admin/layout/guards)
 * ===============================
 * app/layout/ProtectedLayout. /admin: users·user-history·… ETL은 EtlAccessRoute. 프로젝트 작업은 NeedProjectRoute + ProjectFeatureRoute.
 *
 * [Main]
 * 1. AppRoutes — 전체 Route 트리
 */

import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import QueryStudioPage from '@/packages/query_studio'
import WidgetboardPage from '@/packages/widgetboard'
import WidgetboardListPage from '@/packages/widgetboard/WidgetboardListPage.jsx'
import ETLPage from '@/packages/etl'
import CampaignDashboardPage from '@/packages/campaign_dashboard'

import LoginPage from '@/app/auth/LoginPage.jsx'
import SignupPage from '@/app/auth/SignupPage.jsx'
import HomePage from '@/app/home/HomePage.jsx'
import MyPage from '@/app/mypage/MyPage.jsx'
import AdminUsersPage from '@/app/admin/AdminUsersPage.jsx'
import UserHistoryPage from '@/app/admin/UserHistoryPage.jsx'
import AdminOrgPage from '@/app/admin/AdminOrgPage.jsx'
import AdminRolesPage from '@/app/admin/AdminRolesPage.jsx'
import AdminProjectsPage from '@/app/admin/AdminProjectsPage.jsx'
import AdminProjectMembersPage from '@/app/admin/AdminProjectMembersPage.jsx'
import { ProtectedLayout } from '@/app/layout/ProtectedLayout.jsx'
import { NeedProjectRoute } from '@/app/guards/NeedProjectRoute.jsx'
import { ProjectFeatureRoute } from '@/app/guards/ProjectFeatureRoute.jsx'
import { EtlAccessRoute } from '@/app/guards/EtlAccessRoute.jsx'
import { OrgAdminRoute } from '@/app/guards/OrgAdminRoute.jsx'
import { SuperAdminRoute } from '@/app/guards/SuperAdminRoute.jsx'
import { ProjectAdminRoute } from '@/app/guards/ProjectAdminRoute.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
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
          path="/admin/user-history"
          element={
            <OrgAdminRoute>
              <UserHistoryPage />
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
        <Route
          path="/admin/roles"
          element={
            <OrgAdminRoute>
              <AdminRolesPage />
            </OrgAdminRoute>
          }
        />
        <Route
          path="/admin/projects"
          element={
            <ProjectAdminRoute>
              <AdminProjectsPage />
            </ProjectAdminRoute>
          }
        />
        <Route
          path="/admin/projects/:projectId/members"
          element={
            <ProjectAdminRoute>
              <AdminProjectMembersPage />
            </ProjectAdminRoute>
          }
        />
        <Route path="/report" element={<Navigate to="/query-studio" replace />} />
        <Route
          path="/query-studio"
          element={
            <NeedProjectRoute>
              <ProjectFeatureRoute feature="query-studio">
                <QueryStudioPage />
              </ProjectFeatureRoute>
            </NeedProjectRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <NeedProjectRoute>
              <ProjectFeatureRoute feature="dashboard">
                <CampaignDashboardPage />
              </ProjectFeatureRoute>
            </NeedProjectRoute>
          }
        />
        <Route path="/campaign-dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/widgetboard"
          element={
            <NeedProjectRoute>
              <ProjectFeatureRoute feature="widgetboard">
                <Outlet />
              </ProjectFeatureRoute>
            </NeedProjectRoute>
          }
        >
          <Route index element={<WidgetboardListPage />} />
          <Route path=":boardId" element={<WidgetboardPage />} />
        </Route>
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
