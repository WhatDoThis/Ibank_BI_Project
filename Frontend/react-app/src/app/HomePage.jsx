/**
 * app/HomePage.jsx (프로젝트 선택 + §5.2 빠른 액세스)
 * =================================================
 * GET /api/projects, 선택 시 select. 하단 카드는 JWT 프로젝트·me.permissions·역할.
 *
 * [Main Functions]
 * ===========
 * - HomePage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/authClient, shared/auth/jwtUtils·tokenStorage
 * - app/homeAccess, app/etlAccess, app/adminAccess, app/AuthContext
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getAccessToken } from '@/shared/auth/tokenStorage.js'
import { hasProjectClaim } from '@/shared/auth/jwtUtils.js'
import { getProjects, postSelectProject } from '@/shared/api/authClient.js'
import { canAccessDeptSettings, canAccessOrgAdmin } from '@/app/adminAccess.js'
import { canAccessEtl } from '@/app/etlAccess.js'
import {
  canAccessDashboard,
  canAccessQueryStudio,
  canAccessWidgetboard,
} from '@/app/homeAccess.js'

import { useAuth } from './AuthContext.jsx'
import './home.css'

export default function HomePage() {
  const { me, refreshMe } = useAuth()
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
  const showQuery = hasProject && canAccessQueryStudio(me)
  const showDash = hasProject && canAccessDashboard(me)
  const showWidget = hasProject && canAccessWidgetboard(me)
  const showEtl = canAccessEtl(me)
  const showUsers = canAccessOrgAdmin(me)
  const showDept = canAccessDeptSettings(me)
  const anyProjectCard = showQuery || showDash || showWidget

  return (
    <div className="home">
      <h1 className="home__title">내 프로젝트</h1>
      <p className="home__lead">
        작업할 프로젝트를 선택하세요. 선택 후 리포트·대시보드 등에서 해당 프로젝트 권한이 적용됩니다.
      </p>

      {hasProject ? (
        <div className="home__continue">
          <button type="button" onClick={handleContinueApp}>
            이전에 선택한 프로젝트로 계속 (쿼리 스튜디오)
          </button>
        </div>
      ) : null}

      {error ? <p className="home__error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="home__note">참여 중인 프로젝트가 없습니다. 관리자에게 초대를 요청하세요.</p>
      ) : (
        <ul className="home__list">
          {items.map((row) => (
            <li key={row.project_info_id} className="home__project">
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
                className="home__project-btn"
                disabled={busyId != null}
                onClick={() => handleOpen(row.project_info_id)}
              >
                {busyId === row.project_info_id ? '선택 중…' : '이 프로젝트로 작업'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="home__section-title">빠른 액세스</h2>
      <p className="home__note">
        프로젝트 기능은 JWT에 프로젝트가 선택된 뒤, 부여된 권한에 따라 표시됩니다.
      </p>

      <h3 className="home__section-title" style={{ fontSize: '0.95rem', marginTop: 8 }}>
        프로젝트 작업
      </h3>
      {!hasProject ? (
        <p className="home__note">위에서 프로젝트를 선택하면 쿼리 스튜디오·대시보드·위젯 링크가 열립니다.</p>
      ) : !anyProjectCard ? (
        <p className="home__note">이 프로젝트에서 부여된 리포트·대시보드·위젯 권한이 없습니다.</p>
      ) : (
        <div className="home__cards">
          {showQuery ? (
            <Link to="/query-studio" className="home__card">
              쿼리 스튜디오
              <span className="home__card-desc">리포트·쿼리 (report.read / execute)</span>
            </Link>
          ) : null}
          {showDash ? (
            <Link to="/dashboard" className="home__card">
              대시보드
              <span className="home__card-desc">캠페인 등 (dashboard)</span>
            </Link>
          ) : null}
          {showWidget ? (
            <Link to="/widgetboard" className="home__card">
              위젯보드
              <span className="home__card-desc">widgetboard</span>
            </Link>
          ) : null}
        </div>
      )}

      <h3 className="home__section-title" style={{ fontSize: '0.95rem' }}>
        관리 · 인프라
      </h3>
      {showEtl || showUsers || showDept ? (
        <div className="home__cards">
          {showEtl ? (
            <Link to="/etl" className="home__card">
              ETL
              <span className="home__card-desc">전사 ETL 인프라 (etl_yn 또는 SA_DEV)</span>
            </Link>
          ) : null}
          {showUsers ? (
            <Link to="/admin/users" className="home__card">
              사용자 관리
              <span className="home__card-desc">같은 부서 사용자</span>
            </Link>
          ) : null}
          {showDept ? (
            <Link to="/admin/org" className="home__card">
              부서 관리
              <span className="home__card-desc">부서명 수정 (슈퍼어드민·SA_DEV)</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="home__note">표시할 관리·인프라 바로가기가 없습니다.</p>
      )}
    </div>
  )
}
