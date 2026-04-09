/**
 * ShellChromeOverrideContext.jsx (셸 상단 제목·브레드크럼 현재 칸 오버라이드)
 * =================================================================
 * 위젯보드 캔버스 등 하위 페이지가 로드된 메타(보드명)로 `ProtectedLayout`의
 * `ibank-shell-header-title`·`ibank-bc-current`를 갱신한다. 경로 변경 시 자동 초기화.
 *
 * [Main Functions]
 * ===========
 * - ShellChromeProvider, useShellChrome
 *
 * [Dependencies]
 * =========
 * - react, react-router-dom useLocation
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

const ShellChromeOverrideContext = createContext(null)

export function ShellChromeProvider({ children }) {
  const location = useLocation()
  const [override, setOverride] = useState(null)
  useEffect(() => {
    setOverride(null)
  }, [location.pathname])
  const value = useMemo(() => ({ override, setOverride }), [override])
  return <ShellChromeOverrideContext.Provider value={value}>{children}</ShellChromeOverrideContext.Provider>
}

export function useShellChrome() {
  const v = useContext(ShellChromeOverrideContext)
  if (!v) {
    throw new Error('useShellChrome must be used within ShellChromeProvider')
  }
  return v
}
