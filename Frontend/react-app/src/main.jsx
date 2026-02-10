/**
 * main.jsx (React + Vite 진입점)
 * ==============================
 * createRoot로 루트에 App 마운트. StrictMode 적용.
 *
 * [의존성]
 * - React, react-dom/client, App, index.css, styles/main.css
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/main.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
