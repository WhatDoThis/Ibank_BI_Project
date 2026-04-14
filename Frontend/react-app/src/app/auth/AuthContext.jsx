/**
 * app/auth/AuthContext.jsx (인증 컨텍스트)
 * ================================
 * /api/auth/me 로 프로필 로드·refreshMe(갱신 후 프로필 반환)·logout. /me 응답에 access_token·refresh_token이 있으면(무효 작업 프로젝트 정리 시) setTokens. project_info_id 변경 시 projectContextNonce 증가.
 * notifyParticipatingProjectsChanged: GET /api/projects(헤더 드롭다운 등) 목록 재로드용 nonce.
 * S5/S6·마이페이지(S7) 공용.
 *
 * [Main Functions]
 * ===========
 * - AuthProvider, useAuth
 *
 * [Dependencies]
 * =========
 * - shared/api/authClient.js, shared/auth/tokenStorage.js
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getMe, postLogout } from '@/shared/api/authClient.js'
import { clearTokens, getAccessToken, setTokens } from '@/shared/auth/tokenStorage.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projectContextNonce, setProjectContextNonce] = useState(0)
  const [participatingProjectsNonce, setParticipatingProjectsNonce] = useState(0)
  const meRef = useRef(null)
  meRef.current = me

  const notifyParticipatingProjectsChanged = useCallback(() => {
    setParticipatingProjectsNonce((n) => n + 1)
  }, [])

  const refreshMe = useCallback(async () => {
    const at = getAccessToken()
    if (!at) {
      setMe(null)
      return null
    }
    const prevPid = meRef.current?.project_info_id
    try {
      const data = await getMe()
      if (data?.access_token && data?.refresh_token) {
        setTokens(data.access_token, data.refresh_token)
      }
      const {
        access_token: _at,
        refresh_token: _rt,
        expires_in: _ei,
        token_type: _tt,
        ...profile
      } = data || {}
      setMe(profile)
      const nextPid = profile?.project_info_id
      if (profile && String(prevPid ?? '') !== String(nextPid ?? '')) {
        setProjectContextNonce((n) => n + 1)
      }
      return profile
    } catch (e) {
      setMe(null)
      if (e?.status === 401) clearTokens()
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshMe()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMe])

  const logout = useCallback(async () => {
    try {
      await postLogout()
    } catch {
      clearTokens()
    }
    setMe(null)
  }, [])

  const value = useMemo(
    () => ({
      me,
      loading,
      isAuthenticated: !loading && !!me,
      refreshMe,
      logout,
      setMe,
      projectContextNonce,
      participatingProjectsNonce,
      notifyParticipatingProjectsChanged,
    }),
    [
      me,
      loading,
      refreshMe,
      logout,
      projectContextNonce,
      participatingProjectsNonce,
      notifyParticipatingProjectsChanged,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
