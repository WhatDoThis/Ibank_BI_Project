/**
 * app/HomePage.jsx (프로젝트 선택 — 내 프로젝트)
 * ===========================================
 * GET /api/projects, 선택 시 POST /api/projects/{id}/select 후 앱으로 이동.
 *
 * [Main Functions]
 * ===========
 * - HomePage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/authClient, shared/auth/jwtUtils
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getAccessToken } from '@/shared/auth/tokenStorage.js'
import { hasProjectClaim } from '@/shared/auth/jwtUtils.js'
import { getProjects, postSelectProject } from '@/shared/api/authClient.js'
import { useAuth } from './AuthContext.jsx'

export default function HomePage() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await getProjects()
      setItems(data.items || [])
    } catch (e) {
      setError(e?.message || '목록을 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleOpen(projectInfoId) {
    setBusyId(projectInfoId)
    setError('')
    try {
      await postSelectProject(projectInfoId)
      await refreshMe()
      navigate('/query-studio', { replace: true })
    } catch (e) {
      setError(e?.message || '프로젝트 선택 실패')
    } finally {
      setBusyId(null)
    }
  }

  function handleContinueApp() {
    navigate('/query-studio')
  }

  const hasProject = hasProjectClaim(getAccessToken())

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, fontSize: '1.35rem' }}>내 프로젝트</h1>
      <p style={{ color: '#555', fontSize: '0.95rem' }}>
        작업할 프로젝트를 선택하세요. 선택 후 리포트·대시보드·ETL에서 해당 프로젝트 권한이 적용됩니다.
      </p>
      {hasProject ? (
        <p style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={handleContinueApp}
            style={{
              padding: '10px 16px',
              background: '#00754a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            이전에 선택한 프로젝트로 계속 (쿼리 스튜디오)
          </button>
        </p>
      ) : null}
      {error ? <p style={{ color: '#c62828' }}>{error}</p> : null}
      {items.length === 0 ? (
        <p>참여 중인 프로젝트가 없습니다. 관리자에게 초대를 요청하세요.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((row) => (
            <li
              key={row.project_info_id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <strong>{row.project_name}</strong>
                {row.role_name ? (
                  <span style={{ marginLeft: 8, color: '#666', fontSize: '0.9rem' }}>
                    ({row.role_name})
                  </span>
                ) : null}
                {row.project_dscrtn ? (
                  <div style={{ fontSize: '0.875rem', color: '#555', marginTop: 6 }}>
                    {row.project_dscrtn}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => handleOpen(row.project_info_id)}
                style={{
                  padding: '8px 14px',
                  background: '#1e3932',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {busyId === row.project_info_id ? '선택 중…' : '이 프로젝트로 작업'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
