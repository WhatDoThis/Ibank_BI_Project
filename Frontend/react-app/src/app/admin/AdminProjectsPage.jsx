/**
 * app/admin/AdminProjectsPage.jsx (프로젝트 목록·생성·수정·비활성)
 * ======================================================
 * GET/POST/PATCH/DELETE /api/admin/projects — 생성·비활성은 조직 어드민만.
 *
 * [Main Functions]
 * ===========
 * - AdminProjectsPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/adminClient, shared/utils/crudConfirm, app/adminAccess, app/AuthContext
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  deleteAdminProject,
  getAdminProjects,
  patchAdminProject,
  postAdminProject,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { canAccessOrgAdmin } from '@/app/admin/adminAccess.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import './admin-pages.css'

function formatDtm(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ko-KR')
  } catch {
    return String(v)
  }
}

export default function AdminProjectsPage() {
  const { me } = useAuth()
  const isOrgAdmin = canAccessOrgAdmin(me)
  const isOperator = (me?.user_dvsn || '').trim().toLowerCase() === 'o'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')

  const [edit, setEdit] = useState(null)
  const [eName, setEName] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eActive, setEActive] = useState('Y')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await getAdminProjects()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setError(e?.message || '목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!confirmCrud('새 프로젝트를 생성할까요?')) return
    setError('')
    try {
      await postAdminProject({
        project_name: cName.trim(),
        project_dscrtn: cDesc.trim() || null,
      })
      setCName('')
      setCDesc('')
      await load()
    } catch (e) {
      setError(e?.message || '생성 실패')
    }
  }

  function openEdit(row) {
    setEdit(row.project_info_id)
    setEName(row.project_name || '')
    setEDesc(row.project_dscrtn || '')
    setEActive((row.active_yn || 'Y').toUpperCase() === 'Y' ? 'Y' : 'N')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (edit == null) return
    if (!confirmCrud('프로젝트 정보를 저장할까요?')) return
    setBusyId(edit)
    setError('')
    try {
      const body = {
        project_name: eName.trim(),
        project_dscrtn: eDesc.trim() || null,
      }
      if (isOrgAdmin) {
        body.active_yn = eActive
      }
      await patchAdminProject(edit, body)
      setEdit(null)
      await load()
    } catch (err) {
      setError(err?.message || '수정 실패')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeactivate(projectInfoId) {
    if (!confirmCrud('프로젝트를 비활성화할까요? (소프트 삭제)')) return
    setBusyId(projectInfoId)
    setError('')
    try {
      await deleteAdminProject(projectInfoId)
      await load()
    } catch (e) {
      setError(e?.message || '비활성화 실패')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="ap">
      <h1 className="ap__title">프로젝트 관리</h1>
      <p className="ap__hint">
        {isOperator
          ? '참여 중인 프로젝트만 표시될 수 있습니다. 이름·설명 수정은 가능하며, 활성 여부·신규 생성·비활성화는 조직 어드민만 가능합니다.'
          : '부서 소속 프로젝트를 관리합니다. 멤버는 각 행의 링크에서 설정합니다.'}
      </p>
      {error ? <p className="ap__error">{error}</p> : null}

      {isOrgAdmin ? (
        <div className="ap__form-block">
          <h3>새 프로젝트</h3>
          <form onSubmit={handleCreate}>
            <label className="ap__label">
              프로젝트명
              <input
                className="ap__input"
                value={cName}
                onChange={(ev) => setCName(ev.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label className="ap__label">
              설명 (선택)
              <textarea
                className="ap__textarea"
                style={{ minHeight: 60 }}
                value={cDesc}
                onChange={(ev) => setCDesc(ev.target.value)}
                maxLength={500}
              />
            </label>
            <button type="submit" className="ap__btn ap__btn--primary">
              생성
            </button>
          </form>
        </div>
      ) : null}

      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead>
              <tr>
                <th>이름</th>
                <th>상태</th>
                <th>생성일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const pid = row.project_info_id
                const active = (row.active_yn || '').toUpperCase() === 'Y'
                return (
                  <tr key={String(pid)}>
                    <td>
                      <strong>{row.project_name || '—'}</strong>
                      {row.project_dscrtn ? (
                        <div className="ap__mono" style={{ marginTop: 6 }}>
                          {row.project_dscrtn}
                        </div>
                      ) : null}
                    </td>
                    <td>{active ? '활성' : '비활성'}</td>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <Link
                          to={`/admin/projects/${pid}/members`}
                          className="ap__back"
                          style={{ marginBottom: 0 }}
                        >
                          멤버 관리
                        </Link>
                        <button
                          type="button"
                          className="ap__btn"
                          disabled={busyId != null}
                          onClick={() => openEdit(row)}
                        >
                          수정
                        </button>
                        {isOrgAdmin ? (
                          <button
                            type="button"
                            className="ap__btn ap__btn--danger"
                            disabled={busyId != null || !active}
                            onClick={() => handleDeactivate(pid)}
                          >
                            비활성화
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit != null ? (
        <div className="ap__modal-overlay" role="presentation">
          <div className="ap__modal" role="dialog" aria-modal="true" aria-labelledby="proj-edit-title">
            <h3 id="proj-edit-title">프로젝트 수정</h3>
            <form onSubmit={handleSaveEdit}>
              <label className="ap__label">
                이름
                <input
                  className="ap__input"
                  value={eName}
                  onChange={(ev) => setEName(ev.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label className="ap__label">
                설명
                <textarea
                  className="ap__textarea"
                  style={{ minHeight: 60 }}
                  value={eDesc}
                  onChange={(ev) => setEDesc(ev.target.value)}
                  maxLength={500}
                />
              </label>
              {isOrgAdmin ? (
                <label className="ap__label">
                  활성
                  <select
                    className="ap__select"
                    value={eActive}
                    onChange={(ev) => setEActive(ev.target.value)}
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
              ) : null}
              <div className="ap__row">
                <button type="submit" className="ap__btn ap__btn--primary" disabled={busyId != null}>
                  저장
                </button>
                <button
                  type="button"
                  className="ap__btn"
                  onClick={() => setEdit(null)}
                  disabled={busyId != null}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
