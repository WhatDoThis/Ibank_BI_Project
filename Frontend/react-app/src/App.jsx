/**
 * App.jsx (앱 루트 — BrowserRouter·AuthProvider·라우트)
 * ==================================================
 * 레이아웃·네비는 ProtectedLayout(app/ProtectedLayout.jsx). 라우트는 app/routes.jsx.
 *
 * [Main Functions]
 * ===========
 * - App: BrowserRouter + basename + AuthProvider + AppRoutes
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/AuthContext, app/routes
 */

import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from './app/AuthContext.jsx'
import { AppRoutes } from './app/routes.jsx'

const ROUTER_BASENAME = (import.meta.env.BASE_URL || '').replace(/\/$/, '') || ''

function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
