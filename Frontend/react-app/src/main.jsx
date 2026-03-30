/**
 * main.jsx (React + Vite 진입점)
 * ==============================
 * createRoot로 #root에 App 마운트. StrictMode 적용.
 *
 * [Main Functions]
 * ===========
 * - createRoot(...).render(StrictMode > App)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - (엔드포인트 없음. 진입점만)
 *
 * [Dependencies]
 * =========
 * - React, react-dom/client, App.jsx, index.css, styles/main.css
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/design-tokens.css'
import './index.css'
import './styles/main.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
