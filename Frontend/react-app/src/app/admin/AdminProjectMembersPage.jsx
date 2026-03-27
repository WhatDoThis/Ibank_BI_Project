/**
 * app/admin/AdminProjectMembersPage.jsx (프로젝트 멤버)
 * =============================================
 * GET/POST/PATCH/DELETE /api/admin/projects/{id}/members — 사용자 검색으로 추가.
 *
 * [Main Functions]
 * ===========
 * - AdminProjectMembersPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/adminClient
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  deleteAdminProjectMember,
  getAdminProjectMembers,
  getAdminRoles,
  getAdminUsersSearch,
  patchAdminProjectMember,
  postAdminProjectMember,
} from '@/shared/api/adminClient.js'

import './admin-pages.css'

export default function AdminProjectMembersPage() {
  const { projectId } = useParams()
  const pid = useMemo(() => {
    const n = parseInt(String(projectId), 10)
    return Number.isNaN(n) ? null : n
  }, [projectId])

  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState([])
  const [pickUser, setPickUser] = useState(null)
  const [addRoleId, setAddRoleId] = useState('')

  const [roleEdits, setRoleEdits] = useState({})

  const loadRoles = useCallback(async () => {
    try {
      const data = await getAdminRoles()
      const list = Array.isArray(data?.items) ? data.items : []
      setRoles(list)
      setAddRoleId((prev) => {
        if (prev) return prev
        if (list.length) return String(list[0].pmssn_master_id)
        return ''
      })
    } catch {
      setRoles([])
    }
  }, [])

  const loadMembers = useCallback(async () => {
    if (pid == null) return
    setError('')
    setLoading(true)
    try {
      const data = await getAdminProjectMembers(pid)
      setMembers(Array.isArray(data?.items) ? data.items : [])
      setRoleEdits({})
    } catch (e) {
      setError(e?.message || '멤버 목록을 불러오지 못했습니다.')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [pid])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function runSearch() {
    setOk('')
    setError('')
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      setError('검색어는 2자 이상 입력하세요.')
      return
    }
    try {
      const data = await getAdminUsersSearch(q)
      setSearchHits(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setSearchHits([])
      setError(e?.message || '검색 실패')
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (pid == null || !pickUser || !addRoleId) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      await postAdminProjectMember(pid, {
        ptcpnt_user_id: pickUser.user_id,
        pmssn_master_id: parseInt(addRoleId, 10),
      })
      setOk('멤버가 추가되었습니다.')
      setPickUser(null)
      setSearchQ('')
      setSearchHits([])
      await loadMembers()
    } catch (e) {
      setError(e?.message || '추가 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleRoleChange(ptcpntUserId, pmssnMasterId) {
    if (pid == null) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      await patchAdminProjectMember(pid, ptcpntUserId, {
        pmssn_master_id: pmssnMasterId,
      })
      setOk('역할이 변경되었습니다.')
      await loadMembers()
    } catch (e) {
      setError(e?.message || '역할 변경 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(ptcpntUserId) {
    if (pid == null) return
    if (!window.confirm('이 멤버를 프로젝트에서 제거할까요?')) return
    setBusy(true)
    setError('')
    try {
      await deleteAdminProjectMember(pid, ptcpntUserId)
      setOk('제거되었습니다.')
      await loadMembers()
    } catch (e) {
      setError(e?.message || '제거 실패')
    } finally {
      setBusy(false)
    }
  }

  if (pid == null) {
    return (
      <div className="ap">
        <p className="ap__error">유효하지 않은 프로젝트입니다.</p>
        <Link to="/admin/projects" className="ap__back">
          ← 프로젝트 목록
        </Link>
      </div>
    )
  }

  return (
    <div className="ap">
      <Link to="/admin/projects" className="ap__back">
        ← 프로젝트 목록
      </Link>
      <h1 className="ap__title">프로젝트 멤버 (ID {pid})</h1>
      <p className="ap__hint">같은 부서 사용자를 검색해 초대하고, 프로젝트 역할(pmssn)을 부여합니다.</p>
      {error ? <p className="ap__error">{error}</p> : null}
      {ok ? <p className="ap__ok">{ok}</p> : null}

      <div className="ap__form-block">
        <h3>멤버 추가</h3>
        <div className="ap__row">
          <label className="ap__label" style={{ flex: 1, minWidth: 200 }}>
            이메일 검색 (2자 이상)
            <input
              className="ap__input"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="user@example.com"
            />
          </label>
          <button type="button" className="ap__btn" onClick={runSearch} disabled={busy}>
            검색
          </button>
        </div>
        {searchHits.length > 0 ? (
          <div className="ap__search-hits">
            {searchHits.map((u) => (
              <button
                key={u.user_id}
                type="button"
                className="ap__search-hit"
                onClick={() => setPickUser(u)}
              >
                {u.user_email} · {u.user_nickname || '—'} ({u.user_dvsn || '—'})
              </button>
            ))}
          </div>
        ) : null}
        {pickUser ? (
          <form onSubmit={handleAddMember} style={{ marginTop: 12 }}>
            <p className="ap__hint">
              선택: <strong>{pickUser.user_email}</strong> (user_id {pickUser.user_id})
            </p>
            <label className="ap__label">
              프로젝트 역할
              <select
                className="ap__select"
                value={addRoleId}
                onChange={(ev) => setAddRoleId(ev.target.value)}
                required
              >
                {roles.map((r) => (
                  <option key={r.pmssn_master_id} value={String(r.pmssn_master_id)}>
                    {r.pmssn_name} (id {r.pmssn_master_id})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="ap__btn ap__btn--primary" disabled={busy}>
              멤버로 추가
            </button>
          </form>
        ) : null}
      </div>

      <h2 className="ap__title" style={{ fontSize: '1.1rem', marginTop: 8 }}>
        멤버 목록
      </h2>
      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead>
              <tr>
                <th>이메일</th>
                <th>닉네임</th>
                <th>역할</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const uid = m.ptcpnt_user_id
                const cur = roleEdits[uid] != null ? roleEdits[uid] : String(m.pmssn_master_id)
                return (
                  <tr key={String(m.project_ptcpnt_info_id || `${uid}-${m.pmssn_master_id}`)}>
                    <td>{m.user_email}</td>
                    <td>{m.user_nickname || '—'}</td>
                    <td>
                      <select
                        className="ap__select"
                        value={cur}
                        onChange={(ev) =>
                          setRoleEdits((prev) => ({ ...prev, [uid]: ev.target.value }))
                        }
                      >
                        {roles.map((r) => (
                          <option key={r.pmssn_master_id} value={String(r.pmssn_master_id)}>
                            {r.pmssn_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ap__btn ap__btn--primary"
                          disabled={busy || String(m.pmssn_master_id) === cur}
                          onClick={() =>
                            handleRoleChange(uid, parseInt(cur, 10))
                          }
                        >
                          역할 저장
                        </button>
                        <button
                          type="button"
                          className="ap__btn ap__btn--danger"
                          disabled={busy}
                          onClick={() => handleRemove(uid)}
                        >
                          제거
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
