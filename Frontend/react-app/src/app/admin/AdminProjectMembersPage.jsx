/**
 * app/admin/AdminProjectMembersPage.jsx (프로젝트 멤버)
 * =============================================
 * GET/POST/PATCH/DELETE /api/admin/projects/{id}/members — 사용자 검색으로 추가.
 * 멤버 목록: 초대자·참여일시 컬럼, 권한 셀렉트 변경 시 컨펌. 멤버 추가: 안내 라벨 아래 인풋+검색 한 줄(ap__member-add-inline).
 *
 * [Main Functions]
 * ===========
 * - AdminProjectMembersPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/adminClient, shared/utils/crudConfirm
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
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

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

function inviteLabel(m) {
  const em = (m.invite_user_email || '').trim()
  const nick = (m.invite_user_nickname || '').trim()
  if (em) return em
  if (nick) return nick
  return '—'
}

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
    if (!confirmCrud(`${pickUser.user_email || '선택한 사용자'}(을)를 프로젝트 멤버로 추가할까요?`)) return
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
      setOk('프로젝트 권한이 변경되었습니다.')
      await loadMembers()
    } catch (e) {
      setError(e?.message || '권한 변경 실패')
    } finally {
      setBusy(false)
    }
  }

  const handlePmssnSelectIntent = useCallback((uid, savedId, nextVal) => {
    if (String(savedId) === nextVal) {
      setRoleEdits((prev) => {
        const copy = { ...prev }
        delete copy[uid]
        return copy
      })
      return
    }
    if (!confirmCrud('프로젝트 권한을 변경하시겠습니까?')) return
    setRoleEdits((prev) => ({ ...prev, [uid]: nextVal }))
  }, [])

  async function handleRemove(ptcpntUserId) {
    if (pid == null) return
    if (!confirmCrud('이 멤버를 프로젝트에서 제거할까요?')) return
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
      <h1 className="ap__title">프로젝트 멤버</h1>
      <p className="ap__hint">
        프로젝트 ID <strong>{pid}</strong>. 같은 부서 사용자를 검색해 초대하고, 프로젝트 권한(pmssn)을 부여합니다.
      </p>
      {error ? <p className="ap__error">{error}</p> : null}
      {ok ? <p className="ap__ok">{ok}</p> : null}

      <div className="ap__form-block">
        <h3>멤버 추가</h3>
        <div className="ap__member-add-block">
          <label className="ap__member-add-hint" htmlFor="proj-member-email-search">
            이메일 검색 (2자 이상)
          </label>
          <div className="ap__member-add-inline">
            <input
              id="proj-member-email-search"
              className="ap__input ap__member-add-input"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
            />
            <button
              type="button"
              className="ibank-btn-table ap__member-add-search"
              onClick={runSearch}
              disabled={busy}
            >
              검색
            </button>
          </div>
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
              프로젝트 권한
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
            <button type="submit" className="ibank-btn-toolbar" disabled={busy}>
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
                <th>초대자</th>
                <th>참여일시</th>
                <th>프로젝트 권한</th>
                <th className="ap__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const uid = m.ptcpnt_user_id
                const savedId = m.pmssn_master_id
                const cur = roleEdits[uid] != null ? roleEdits[uid] : String(savedId)
                const inviter = inviteLabel(m)
                return (
                  <tr key={String(m.project_ptcpnt_info_id || `${uid}-${m.pmssn_master_id}`)}>
                    <td>{m.user_email}</td>
                    <td>{m.user_nickname || '—'}</td>
                    <td className="ap__td-clip-inviter">
                      <span className="ap__cell-clip" title={inviter !== '—' ? inviter : undefined}>
                        {inviter}
                      </span>
                    </td>
                    <td>{formatDtm(m.create_dtm)}</td>
                    <td>
                      <select
                        className="ap__select ap__select--table-in-cell"
                        value={cur}
                        onChange={(ev) =>
                          handlePmssnSelectIntent(uid, savedId, ev.target.value)
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
                      <div className="ap__cell-actions">
                        <button
                          type="button"
                          className="ibank-btn-table ibank-btn-table--primary"
                          disabled={busy || String(savedId) === cur}
                          onClick={() =>
                            handleRoleChange(uid, parseInt(cur, 10))
                          }
                        >
                          권한 저장
                        </button>
                        <button
                          type="button"
                          className="ibank-btn-table ibank-btn-table--danger"
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
