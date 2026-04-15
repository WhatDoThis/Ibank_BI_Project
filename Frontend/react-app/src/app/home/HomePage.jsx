/**
 * app/home/HomePage.jsx (프로젝트 선택 + §5.2 빠른 액세스)
 * =================================================
 * GET /api/projects, select. 빠른 액세스: homeAccess·etlAccess·adminAccess(역할·프로젝트·운영자). 작업 프로젝트 전환은 헤더 드롭다운과 동일 API(`postSelectProject`)를 쓰므로 홈의「이전에 선택…」버튼은 제거됨. 프로젝트 목록: `home__list` 2열(880px 미만 1열)·카드 내부 3열 그리드·제목·역할 pill·설명 말줄임(2줄)·좁은 화면 버튼 전폭. `빠른 액세스` h2는 `home__section-title--quick-access`(제목 크기·목록과 구분선).
 *
 * [Main Functions]
 * ===========
 * - HomePage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/authClient, shared/auth/jwtUtils·tokenStorage
 * - ./homeAccess, app/guards/etlAccess, app/admin/adminAccess, app/auth/AuthContext
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getAccessToken } from '@/shared/auth/tokenStorage.js'
import { hasProjectClaim } from '@/shared/auth/jwtUtils.js'
import { getProjects, postSelectProject } from '@/shared/api/authClient.js'
import {
  canAccessDeptSettings,
  canAccessOrgAdmin,
  canAccessProjectAdminPages,
} from '@/app/admin/adminAccess.js'
import { canAccessEtl } from '@/app/guards/etlAccess.js'
import { PageHeader } from '@/app/layout/PageHeader.jsx'
import {
  canAccessDashboard,
  canAccessQueryStudio,
  canAccessWidgetboard,
  pickDefaultProjectPath,
} from '@/app/home/homeAccess.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
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
      const prof = await refreshMe()
      navigate(pickDefaultProjectPath(prof || me), { replace: true })
    } catch (e) {
      setError(e?.message || '프로젝트 선택 실패')
    } finally {
      setBusyId(null)
    }
  }

  const hasProject = hasProjectClaim(getAccessToken())
  const showQuery = hasProject && canAccessQueryStudio(me)
  const showDash = hasProject && canAccessDashboard(me)
  const showWidget = hasProject && canAccessWidgetboard(me)
  const showEtl = canAccessEtl(me)
  const showUsers = canAccessOrgAdmin(me)
  const showRoles = canAccessOrgAdmin(me)
  const showProjects = canAccessProjectAdminPages(me)
  const showDept = canAccessDeptSettings(me)
  const anyProjectCard = showQuery || showDash || showWidget

  return (
    <div className="home">
      <PageHeader description="작업할 프로젝트를 선택하세요. 선택 후 리포트·대시보드 등에서 해당 프로젝트 권한이 적용됩니다." />

      {error ? <p className="home__error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="home__note">참여 중인 프로젝트가 없습니다. 관리자에게 초대를 요청하세요.</p>
      ) : (
        <ul className="home__list">
          {items.map((row) => (
            <li key={row.project_info_id} className="home__project">
              <div className="home__project-icon" aria-hidden="true" title="프로젝트">
                <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  />
                </svg>
              </div>
              <div className="home__project-body">
                <strong className="home__project-name">{row.project_name}</strong>
                {row.role_name ? (
                  <div className="home__project-role">
                    <span className="home__project-role-label">부여된 권한</span>
                    <span className="home__project-role-value">{row.role_name}</span>
                  </div>
                ) : null}
                {row.project_dscrtn ? (
                  <p className="home__project-desc">{row.project_dscrtn}</p>
                ) : null}
              </div>
              <div className="home__project-actions">
                <button
                  type="button"
                  className="home__project-btn"
                  disabled={busyId != null}
                  onClick={() => handleOpen(row.project_info_id)}
                >
                  {busyId === row.project_info_id ? '선택 중…' : '이 프로젝트로 작업'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="home__section-title home__section-title--quick-access">빠른 액세스</h2>
      <p className="home__note">
        프로젝트 작업 목록은 프로젝트가 선택된 뒤, 부여된 권한에 따라 표시됩니다.
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
              <span className="home__card-desc">노코드 쿼리 빌더</span>
            </Link>
          ) : null}
          {showDash ? (
            <Link to="/dashboard" className="home__card">
              대시보드
              <span className="home__card-desc">캠페인 마케팅 데이터</span>
            </Link>
          ) : null}
          {showWidget ? (
            <Link to="/widgetboard" className="home__card">
              위젯보드
              <span className="home__card-desc">위젯보드 생성·수정</span>
            </Link>
          ) : null}
        </div>
      )}

      <h3 className="home__section-title" style={{ fontSize: '0.95rem' }}>
        관리 · 인프라
      </h3>
      {showEtl || showUsers || showRoles || showProjects || showDept ? (
        <div className="home__cards">
          {showEtl ? (
            <Link to="/etl" className="home__card">
              ETL 관리리
              <span className="home__card-desc">ETL 관리자 전용</span>
            </Link>
          ) : null}
          {showUsers ? (
            <Link to="/admin/users" className="home__card">
              사용자 관리
              <span className="home__card-desc">부서 유저</span>
            </Link>
          ) : null}
          {showRoles ? (
            <Link to="/admin/roles" className="home__card">
              권한 관리
              <span className="home__card-desc">프로젝트 권한</span>
            </Link>
          ) : null}
          {showProjects ? (
            <Link to="/admin/projects" className="home__card">
              프로젝트 관리
              <span className="home__card-desc">프로젝트·멤버</span>
            </Link>
          ) : null}
          {showDept ? (
            <Link to="/admin/org" className="home__card">
              부서 관리
              <span className="home__card-desc">부서·하위부서</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="home__note">표시할 관리·인프라 바로가기가 없습니다.</p>
      )}
    </div>
  )
}
