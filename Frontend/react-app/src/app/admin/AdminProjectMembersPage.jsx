/**
 * app/admin/AdminProjectMembersPage.jsx (프로젝트 멤버)
 * =============================================
 * GET members: items(참여) + pending_invites(미수락 타부서 알림), user_department_display. 멤버 목록 필터·헤더 정렬(참여일시=create_dtm). POST/PATCH/DELETE members.
 * 상단「멤버 추가」: ap__modal--create-wide·부서 내 테이블 + 타부서 검색 초대·멤버에 없을 때「본인을 멤버로 추가」(재참여).
 * API: 부서 트리 소속은 즉시 추가(outcome member_added), 타부서는 project_invite 알림(outcome invite_sent). 본인은 멤버·초대대기가 아니면 목록·추가 가능(add_member).
 * pending 행: 초대중·초대 취소. 활성 행: 권한 편집·제거.
 *
 * [Main Functions]
 * ===========
 * - AdminProjectMembersPage, handleSelfAddRejoin(본인 POST 멤버·모달 닫기)
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/adminClient, shared/utils/crudConfirm, shared/utils/userDvsnDisplay(formatUserDvsnDisplay), shared/utils/adminListTable, shared/hooks/useResetListPage, shared/components/AdminSortableTh, shared/components/AdminListPaginationFooter, app/auth/AuthContext.jsx, admin-pages.css, admin-list-table.css
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AdminListPaginationFooter from '@/shared/components/AdminListPaginationFooter.jsx'
import AdminSortableTh from '@/shared/components/AdminSortableTh.jsx'
import { useResetListPage } from '@/shared/hooks/useResetListPage.js'
import {
  cycleListSort,
  dateFieldInRange,
  sortRowsByState,
  strContains,
} from '@/shared/utils/adminListTable.js'

import {
  deleteAdminProjectInvite,
  deleteAdminProjectMember,
  getAdminProjectMembers,
  getAdminRoles,
  getAdminRolesProjectAssignable,
  getAdminUsersDeptTree,
  getAdminUsersSearch,
  patchAdminProjectMember,
  postAdminProjectMember,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'
import { formatUserDvsnDisplay } from '@/shared/utils/userDvsnDisplay.js'
import { useAuth } from '@/app/auth/AuthContext.jsx'

import './admin-pages.css'
import './admin-list-table.css'

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

function initialMemberListFilters() {
  return {
    email: '',
    nickname: '',
    dept: '',
    inviter: '',
    partFrom: '',
    partTo: '',
  }
}

function memberRowComparable(entry, key) {
  const m = entry.data
  switch (key) {
    case 'email':
      return String(m?.user_email ?? '').toLowerCase()
    case 'nickname':
      return String(m?.user_nickname ?? '').toLowerCase()
    case 'dept':
      return String(m?.user_department_display ?? '').toLowerCase()
    case 'inviter':
      return String(inviteLabel(m) ?? '').toLowerCase()
    case 'joined': {
      const t = m?.create_dtm ? new Date(m.create_dtm).getTime() : 0
      return Number.isNaN(t) ? 0 : t
    }
    default:
      return ''
  }
}

export default function AdminProjectMembersPage() {
  const { me } = useAuth()
  const { projectId } = useParams()
  const pid = useMemo(() => {
    const n = parseInt(String(projectId), 10)
    return Number.isNaN(n) ? null : n
  }, [projectId])

  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalLoading, setAddModalLoading] = useState(false)
  const [addFormBusy, setAddFormBusy] = useState(false)
  const [assignableRoles, setAssignableRoles] = useState([])
  const [deptMemberRows, setDeptMemberRows] = useState([])
  const [deptTreeUserIds, setDeptTreeUserIds] = useState(() => new Set())
  const [externalInvites, setExternalInvites] = useState([])
  const [extSearchQ, setExtSearchQ] = useState('')
  const [extSearchResults, setExtSearchResults] = useState([])
  const [extSearchBusy, setExtSearchBusy] = useState(false)
  const [highlightDeptUserIds, setHighlightDeptUserIds] = useState(() => new Set())
  const [highlightExtKeys, setHighlightExtKeys] = useState(() => new Set())
  /** 멤버 추가 모달: 본인 재참여용 기본 권한 */
  const [selfAddRoleId, setSelfAddRoleId] = useState('')

  const [roleEdits, setRoleEdits] = useState({})

  const [memberFilters, setMemberFilters] = useState(() => initialMemberListFilters())
  const [memberSort, setMemberSort] = useState({ key: null, dir: null })

  const memberAndPendingUserIds = useMemo(() => {
    const s = new Set()
    for (const m of members) {
      if (m.ptcpnt_user_id != null) s.add(Number(m.ptcpnt_user_id))
    }
    for (const p of pendingInvites) {
      if (p.ptcpnt_user_id != null) s.add(Number(p.ptcpnt_user_id))
    }
    return s
  }, [members, pendingInvites])

  const loadRoles = useCallback(async () => {
    try {
      const data = await getAdminRoles()
      const list = Array.isArray(data?.items) ? data.items : []
      setRoles(list)
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
      setPendingInvites(
        Array.isArray(data?.pending_invites) ? data.pending_invites : [],
      )
      setRoleEdits({})
    } catch (e) {
      setError(e?.message || '멤버 목록을 불러오지 못했습니다.')
      setMembers([])
      setPendingInvites([])
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

  const handleMemberSort = useCallback((key) => {
    setMemberSort((prev) => cycleListSort(prev, key))
  }, [])

  const resetMemberListQuery = useCallback(() => {
    setMemberFilters(initialMemberListFilters())
    setMemberSort({ key: null, dir: null })
  }, [])

  const memberRowsFlat = useMemo(
    () => [
      ...pendingInvites.map((m) => ({ kind: 'pending', data: m })),
      ...members.map((m) => ({ kind: 'member', data: m })),
    ],
    [pendingInvites, members],
  )

  const displayMemberRows = useMemo(() => {
    const f = memberFilters
    let rows = memberRowsFlat.slice()
    rows = rows.filter((entry) => {
      const m = entry.data
      if (!strContains(m.user_email, f.email)) return false
      if (!strContains(m.user_nickname, f.nickname)) return false
      if (!strContains(m.user_department_display, f.dept)) return false
      if (!strContains(inviteLabel(m), f.inviter)) return false
      if (!dateFieldInRange(m.create_dtm, f.partFrom, f.partTo)) return false
      return true
    })
    return sortRowsByState(rows, memberSort, memberRowComparable)
  }, [memberRowsFlat, memberFilters, memberSort])

  const [memberListPage, setMemberListPage] = useState(1)
  const [memberListPageSize, setMemberListPageSize] = useState(10)

  const pagedDisplayMemberRows = useMemo(() => {
    const start = (memberListPage - 1) * memberListPageSize
    return displayMemberRows.slice(start, start + memberListPageSize)
  }, [displayMemberRows, memberListPage, memberListPageSize])

  useResetListPage(setMemberListPage, memberFilters, memberSort, memberRowsFlat)

  function resetAddModalFields() {
    setAssignableRoles([])
    setDeptMemberRows([])
    setDeptTreeUserIds(new Set())
    setExternalInvites([])
    setExtSearchQ('')
    setExtSearchResults([])
    setHighlightDeptUserIds(new Set())
    setHighlightExtKeys(new Set())
    setSelfAddRoleId('')
  }

  async function openAddModal() {
    if (pid == null) return
    setError('')
    setOk('')
    resetAddModalFields()
    setAddModalOpen(true)
    setAddModalLoading(true)
    try {
      const [tu, tr] = await Promise.all([
        getAdminUsersDeptTree(),
        getAdminRolesProjectAssignable(),
      ])
      const users = Array.isArray(tu?.items) ? tu.items : []
      const ritems = Array.isArray(tr?.items) ? tr.items : []
      setAssignableRoles(ritems)
      const firstRid = ritems[0]?.pmssn_master_id
      setSelfAddRoleId(firstRid != null ? String(firstRid) : '')
      const treeIds = new Set(users.map((u) => u.user_id).filter((id) => id != null))
      setDeptTreeUserIds(treeIds)
      const exclude = new Set(memberAndPendingUserIds)
      setDeptMemberRows(
        users
          .filter((u) => u.user_id != null && !exclude.has(Number(u.user_id)))
          .map((u) => ({
            ...u,
            checked: false,
            pmssn_master_id: null,
          })),
      )
    } catch (e) {
      setError(e?.message || '모달 데이터를 불러오지 못했습니다.')
      setAddModalOpen(false)
    } finally {
      setAddModalLoading(false)
    }
  }

  function closeAddModal() {
    if (addFormBusy) return
    resetAddModalFields()
    setAddModalOpen(false)
  }

  async function handleSelfAddRejoin() {
    if (pid == null || me?.user_id == null) return
    const uid = Number(me.user_id)
    const mid = Number(selfAddRoleId)
    if (!mid) {
      setError('프로젝트 권한을 선택하세요.')
      return
    }
    if (!confirmCrud('본인을 이 프로젝트 멤버로 추가할까요?')) return
    setAddFormBusy(true)
    setError('')
    setOk('')
    try {
      const res = await postAdminProjectMember(pid, {
        ptcpnt_user_id: uid,
        pmssn_master_id: mid,
      })
      if (res?.outcome === 'invite_sent') {
        setOk('초대 알림을 보냈습니다. 알림에서 수락해 주세요.')
      } else {
        setOk('멤버로 추가되었습니다.')
      }
      closeAddModal()
      await loadMembers()
    } catch (e) {
      setError(e?.message || '본인 추가에 실패했습니다.')
    } finally {
      setAddFormBusy(false)
    }
  }

  function setDeptRowChecked(uid, checked) {
    setDeptMemberRows((rows) =>
      rows.map((r) => (r.user_id === uid ? { ...r, checked } : r)),
    )
  }

  function setDeptRowPmssn(uid, pmssnMasterId) {
    setDeptMemberRows((rows) =>
      rows.map((r) => (r.user_id === uid ? { ...r, pmssn_master_id: pmssnMasterId } : r)),
    )
  }

  async function runExtSearch() {
    const q = (extSearchQ || '').trim()
    if (q.length < 2) {
      setExtSearchResults([])
      return
    }
    setExtSearchBusy(true)
    try {
      const data = await getAdminUsersSearch(q)
      const items = Array.isArray(data?.items) ? data.items : []
      const inDept = new Set(deptTreeUserIds)
      const ex = new Set(memberAndPendingUserIds)
      setExtSearchResults(
        items.filter(
          (u) =>
            u.user_id != null &&
            !inDept.has(u.user_id) &&
            !ex.has(Number(u.user_id)) &&
            !externalInvites.some((x) => x.user_id === u.user_id),
        ),
      )
    } catch {
      setExtSearchResults([])
    } finally {
      setExtSearchBusy(false)
    }
  }

  function addExternalInvite(row) {
    const uid = Number(row.user_id)
    if (!uid) return
    if (externalInvites.some((x) => x.user_id === uid)) return
    setExternalInvites((prev) => [
      ...prev,
      {
        user_id: uid,
        pmssn_master_id: null,
        user_email: row.user_email,
        dptmt_name: row.dptmt_name || '',
      },
    ])
    setExtSearchResults([])
  }

  function setExtInvitePmssn(uid, pmssnMasterId) {
    setExternalInvites((rows) =>
      rows.map((r) => (r.user_id === uid ? { ...r, pmssn_master_id: pmssnMasterId } : r)),
    )
  }

  function removeExternalInvite(uid) {
    setExternalInvites((rows) => rows.filter((r) => r.user_id !== uid))
  }

  async function handleAddModalSubmit(e) {
    e.preventDefault()
    if (pid == null) return
    const badDept = []
    const membersPayload = []
    for (const r of deptMemberRows) {
      if (!r.checked) continue
      const mid = r.pmssn_master_id != null ? Number(r.pmssn_master_id) : 0
      if (!mid) {
        badDept.push(r.user_id)
        continue
      }
      membersPayload.push({ user_id: r.user_id, pmssn_master_id: mid })
    }
    setHighlightDeptUserIds(new Set(badDept))
    if (badDept.length) {
      setError('체크한 부서 내 참여자에게 프로젝트 권한을 선택하세요.')
      return
    }
    const badExt = []
    const extPayload = []
    for (const x of externalInvites) {
      const mid = x.pmssn_master_id != null ? Number(x.pmssn_master_id) : 0
      if (!mid) {
        badExt.push(String(x.user_id))
        continue
      }
      extPayload.push({ user_id: x.user_id, pmssn_master_id: mid })
    }
    setHighlightExtKeys(new Set(badExt))
    if (badExt.length) {
      setError('타부서 초대 목록에서 프로젝트 권한을 선택하세요.')
      return
    }
    if (!membersPayload.length && !extPayload.length) {
      setError('추가할 멤버를 선택하거나 타부서 초대를 지정하세요.')
      return
    }
    if (
      !confirmCrud(
        `부서 내 ${membersPayload.length}명 추가, 타부서 초대 ${extPayload.length}건을 진행할까요?`,
      )
    ) {
      return
    }
    setAddFormBusy(true)
    setError('')
    setOk('')
    let added = 0
    let invited = 0
    const failures = []
    try {
      const ops = [...membersPayload, ...extPayload]
      for (const row of ops) {
        try {
          const res = await postAdminProjectMember(pid, {
            ptcpnt_user_id: row.user_id,
            pmssn_master_id: row.pmssn_master_id,
          })
          if (res?.outcome === 'invite_sent') invited += 1
          else added += 1
        } catch (err) {
          failures.push(err?.message || String(err))
        }
      }
      if (failures.length) {
        setError(
          failures.length === 1
            ? failures[0]
            : `${failures.length}건 실패: ${failures[0]}`,
        )
      }
      if (added || invited) {
        const parts = []
        if (added) parts.push(`즉시 추가 ${added}명`)
        if (invited) parts.push(`초대 발송 ${invited}건`)
        setOk(parts.join(', '))
      }
      closeAddModal()
      await loadMembers()
    } finally {
      setAddFormBusy(false)
    }
  }

  async function handleCancelInvite(notificationInfoId) {
    if (pid == null) return
    if (!confirmCrud('이 초대를 취소할까요?')) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      await deleteAdminProjectInvite(pid, notificationInfoId)
      setOk('초대를 취소했습니다.')
      await loadMembers()
    } catch (e) {
      setError(e?.message || '초대 취소 실패')
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
      <div className="ap__header-row">
        <div>
          <h1 className="ap__title">프로젝트 멤버</h1>
          <p className="ap__hint">
            프로젝트 ID <strong>{pid}</strong>. 같은 부서 트리는 즉시 추가되고, 타부서는 초대 알림 후 수락 시 참여합니다. 미수락은{' '}
            <strong>초대중</strong>으로 표시됩니다.
          </p>
        </div>
        <button
          type="button"
          className="ibank-btn-toolbar"
          onClick={openAddModal}
          disabled={busy || loading}
        >
          멤버 추가
        </button>
      </div>
      {error ? <p className="ap__error">{error}</p> : null}
      {ok ? <p className="ap__ok">{ok}</p> : null}

      {addModalOpen ? (
        <div className="ap__modal-overlay" role="presentation">
          <div
            className="ap__modal ap__modal--create ap__modal--create-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proj-member-add-title"
          >
            <div className="ap__create-head">
              <h3 id="proj-member-add-title">멤버 추가</h3>
              <button
                type="button"
                className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                disabled={addFormBusy}
                onClick={closeAddModal}
              >
                닫기
              </button>
            </div>
            {addModalLoading ? (
              <p className="ap__hint">불러오는 중…</p>
            ) : (
              <form
                className="ap__modal-form ap__modal-form--create"
                onSubmit={handleAddModalSubmit}
              >
                {me?.user_id != null &&
                !memberAndPendingUserIds.has(Number(me.user_id)) ? (
                  <div className="ap__create-section">
                    <div className="ap__create-section-title">본인 참여 추가</div>
                    <p className="ap__hint" style={{ marginTop: 0 }}>
                      멤버 목록에서 본인을 제외한 경우, 부서 트리에서 선택하거나 여기서 권한을 고른 뒤 바로 추가할 수 있습니다.
                    </p>
                    <div className="ap__create-section-tools">
                      <label className="ap__label ap__label--inline-select">
                        권한
                        <select
                          className="ap__select ap__select--sm"
                          value={selfAddRoleId}
                          onChange={(ev) => setSelfAddRoleId(ev.target.value)}
                          disabled={addFormBusy || assignableRoles.length === 0}
                        >
                          <option value="">선택</option>
                          {assignableRoles.map((x) => (
                            <option
                              key={String(x.pmssn_master_id)}
                              value={String(x.pmssn_master_id)}
                            >
                              {x.pmssn_name || x.pmssn_master_id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="ibank-btn-toolbar"
                        disabled={addFormBusy || !selfAddRoleId}
                        onClick={() => handleSelfAddRejoin()}
                      >
                        본인을 멤버로 추가
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="ap__create-section">
                  <div className="ap__create-section-title">부서 내 참여자 추가</div>
                  <p className="ap__hint" style={{ marginTop: 0 }}>
                    부서 트리에 속한 사용자만 표시됩니다. 체크 후 프로젝트 권한을 선택하세요.
                  </p>
                  <div className="ap__member-pick-body">
                    <table className="ap__table ap__table--compact">
                      <thead>
                        <tr>
                          <th>이메일</th>
                          <th>닉네임</th>
                          <th>프로젝트 권한</th>
                          <th>프로젝트 권한</th>
                          <th>선택</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptMemberRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="ap__td-muted">
                              추가 가능한 부서 내 사용자가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          deptMemberRows.map((r) => (
                            <tr
                              key={String(r.user_id)}
                              className={
                                highlightDeptUserIds.has(r.user_id)
                                  ? 'ap__row--warn'
                                  : undefined
                              }
                            >
                              <td className="ap__mono">{r.user_email || '—'}</td>
                              <td>{r.user_nickname || '—'}</td>
                              <td>{formatUserDvsnDisplay(r.user_dvsn)}</td>
                              <td>
                                <select
                                  className="ap__select ap__select--sm"
                                  value={r.pmssn_master_id ?? ''}
                                  onChange={(ev) =>
                                    setDeptRowPmssn(
                                      r.user_id,
                                      ev.target.value ? Number(ev.target.value) : null,
                                    )
                                  }
                                  disabled={addFormBusy || !r.checked}
                                >
                                  <option value="">선택</option>
                                  {assignableRoles.map((x) => (
                                    <option
                                      key={String(x.pmssn_master_id)}
                                      value={x.pmssn_master_id}
                                    >
                                      {x.pmssn_name || x.pmssn_master_id}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={!!r.checked}
                                  onChange={(ev) =>
                                    setDeptRowChecked(r.user_id, ev.target.checked)
                                  }
                                  disabled={addFormBusy}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ap__create-section">
                  <div className="ap__create-section-title">타부서 참여자 초대</div>
                  <p className="ap__hint" style={{ marginTop: 0 }}>
                    이메일 검색으로 사용자를 찾은 뒤 목록에 담고 프로젝트 권한을 지정하세요. 알림 수락 후 멤버가 됩니다.
                  </p>
                  <div className="ap__ext-search">
                    <input
                      className="ap__input"
                      placeholder="이메일 검색 (2자 이상)"
                      value={extSearchQ}
                      onChange={(ev) => setExtSearchQ(ev.target.value)}
                      disabled={addFormBusy}
                    />
                    <button
                      type="button"
                      className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                      disabled={addFormBusy || extSearchBusy}
                      onClick={() => runExtSearch()}
                    >
                      {extSearchBusy ? '검색…' : '검색'}
                    </button>
                  </div>
                  {extSearchResults.length ? (
                    <ul className="ap__ext-results">
                      {extSearchResults.map((u) => (
                        <li key={String(u.user_id)}>
                          <span className="ap__mono">{u.user_email}</span>
                          <span>{u.user_nickname || ''}</span>
                          <button
                            type="button"
                            className="ibank-btn-table"
                            disabled={
                              addFormBusy ||
                              externalInvites.some((x) => x.user_id === u.user_id)
                            }
                            onClick={() => addExternalInvite(u)}
                          >
                            추가
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="ap__member-pick-body">
                    <table className="ap__table ap__table--compact">
                      <thead>
                        <tr>
                          <th>이메일</th>
                          <th>부서</th>
                          <th>프로젝트 권한</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {externalInvites.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="ap__td-muted">
                              초대할 사용자가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          externalInvites.map((x) => (
                            <tr
                              key={String(x.user_id)}
                              className={
                                highlightExtKeys.has(String(x.user_id))
                                  ? 'ap__row--warn'
                                  : undefined
                              }
                            >
                              <td className="ap__mono">{x.user_email}</td>
                              <td>{x.dptmt_name || '—'}</td>
                              <td>
                                <select
                                  className="ap__select ap__select--sm"
                                  value={x.pmssn_master_id ?? ''}
                                  onChange={(ev) =>
                                    setExtInvitePmssn(
                                      x.user_id,
                                      ev.target.value ? Number(ev.target.value) : null,
                                    )
                                  }
                                  disabled={addFormBusy}
                                >
                                  <option value="">선택</option>
                                  {assignableRoles.map((ro) => (
                                    <option
                                      key={String(ro.pmssn_master_id)}
                                      value={ro.pmssn_master_id}
                                    >
                                      {ro.pmssn_name || ro.pmssn_master_id}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="ibank-btn-table ibank-btn-table--danger"
                                  disabled={addFormBusy}
                                  onClick={() => removeExternalInvite(x.user_id)}
                                >
                                  제거
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ap__row ap__modal-actions">
                  <button
                    type="button"
                    className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                    disabled={addFormBusy}
                    onClick={closeAddModal}
                  >
                    취소
                  </button>
                  <button type="submit" className="ibank-btn-toolbar" disabled={addFormBusy}>
                    {addFormBusy ? '처리 중…' : '추가·초대 실행'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <h2 className="ap__title" style={{ fontSize: '1.1rem', marginTop: 8 }}>
        멤버 목록
      </h2>
      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <>
          <div className="admin-list-filters" aria-label="멤버 목록 필터">
            <div className="admin-list-filters__field">
              <label htmlFor="pm-f-email">이메일</label>
              <input
                id="pm-f-email"
                type="text"
                value={memberFilters.email}
                onChange={(ev) => setMemberFilters((p) => ({ ...p, email: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="pm-f-nick">닉네임</label>
              <input
                id="pm-f-nick"
                type="text"
                value={memberFilters.nickname}
                onChange={(ev) => setMemberFilters((p) => ({ ...p, nickname: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="pm-f-dept">부서</label>
              <input
                id="pm-f-dept"
                type="text"
                value={memberFilters.dept}
                onChange={(ev) => setMemberFilters((p) => ({ ...p, dept: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="pm-f-inv">초대자</label>
              <input
                id="pm-f-inv"
                type="text"
                value={memberFilters.inviter}
                onChange={(ev) => setMemberFilters((p) => ({ ...p, inviter: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <span id="pm-f-part">참여일</span>
              <div className="admin-list-filters__datepair" aria-labelledby="pm-f-part">
                <input
                  type="date"
                  value={memberFilters.partFrom}
                  onChange={(ev) => setMemberFilters((p) => ({ ...p, partFrom: ev.target.value }))}
                  aria-label="참여일 시작"
                />
                <span>~</span>
                <input
                  type="date"
                  value={memberFilters.partTo}
                  onChange={(ev) => setMemberFilters((p) => ({ ...p, partTo: ev.target.value }))}
                  aria-label="참여일 끝"
                />
              </div>
            </div>
            <div className="admin-list-filters__actions">
              <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={resetMemberListQuery}>
                초기화
              </button>
            </div>
          </div>
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead>
              <tr>
                <AdminSortableTh sortKey="email" activeKey={memberSort.key} dir={memberSort.dir} onSort={handleMemberSort}>
                  이메일
                </AdminSortableTh>
                <AdminSortableTh sortKey="nickname" activeKey={memberSort.key} dir={memberSort.dir} onSort={handleMemberSort}>
                  닉네임
                </AdminSortableTh>
                <AdminSortableTh sortKey="dept" activeKey={memberSort.key} dir={memberSort.dir} onSort={handleMemberSort}>
                  사용자 부서
                </AdminSortableTh>
                <th>상태</th>
                <AdminSortableTh sortKey="inviter" activeKey={memberSort.key} dir={memberSort.dir} onSort={handleMemberSort}>
                  초대자
                </AdminSortableTh>
                <AdminSortableTh sortKey="joined" activeKey={memberSort.key} dir={memberSort.dir} onSort={handleMemberSort}>
                  참여일시
                </AdminSortableTh>
                <th>만료</th>
                <th>프로젝트 권한</th>
                <th className="ap__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {displayMemberRows.length === 0 && memberRowsFlat.length > 0 ? (
                <tr>
                  <td colSpan={9} className="ap__hint">
                    필터 조건에 맞는 행이 없습니다.
                  </td>
                </tr>
              ) : null}
              {pagedDisplayMemberRows.map((entry) => {
                if (entry.kind === 'pending') {
                  const m = entry.data
                  const inviter = inviteLabel(m)
                  const nid = m.notification_info_id
                  return (
                    <tr key={`pend-${nid}`} className="ap__tr--pending-invite">
                      <td>{m.user_email || '—'}</td>
                      <td>{m.user_nickname || '—'}</td>
                      <td className="ap__td-muted">{m.user_department_display ?? '—'}</td>
                      <td>
                        <span className="ap__status-badge ap__status-badge--pending">
                          초대중
                        </span>
                        {m.invite_expired ? (
                          <span className="ap__status-badge ap__status-badge--expired">
                            만료
                          </span>
                        ) : null}
                      </td>
                      <td className="ap__td-clip-inviter">
                        <span
                          className="ap__cell-clip"
                          title={inviter !== '—' ? inviter : undefined}
                        >
                          {inviter}
                        </span>
                      </td>
                      <td>{formatDtm(m.create_dtm)}</td>
                      <td className="ap__td-muted">
                        {m.invite_expires_at ? formatDtm(m.invite_expires_at) : '—'}
                      </td>
                      <td className="ap__td-muted">
                        {(m.role_name || '').trim() || '—'}
                      </td>
                      <td>
                        <div className="ap__cell-actions">
                          <button
                            type="button"
                            className="ibank-btn-table ibank-btn-table--danger"
                            disabled={busy}
                            onClick={() => handleCancelInvite(nid)}
                          >
                            초대 취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                const m = entry.data
                const uid = m.ptcpnt_user_id
                const savedId = m.pmssn_master_id
                const cur = roleEdits[uid] != null ? roleEdits[uid] : String(savedId)
                const inviter = inviteLabel(m)
                return (
                  <tr key={String(m.project_ptcpnt_info_id || `${uid}-${m.pmssn_master_id}`)}>
                    <td>{m.user_email}</td>
                    <td>{m.user_nickname || '—'}</td>
                    <td className="ap__td-muted">{m.user_department_display ?? '—'}</td>
                    <td>
                      <span className="ap__status-badge ap__status-badge--active">
                        참여
                      </span>
                    </td>
                    <td className="ap__td-clip-inviter">
                      <span className="ap__cell-clip" title={inviter !== '—' ? inviter : undefined}>
                        {inviter}
                      </span>
                    </td>
                    <td>{formatDtm(m.create_dtm)}</td>
                    <td className="ap__td-muted">—</td>
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
          <AdminListPaginationFooter
            idPrefix="admin-project-members"
            total={displayMemberRows.length}
            page={memberListPage}
            pageSize={memberListPageSize}
            loading={loading}
            onPageChange={setMemberListPage}
            onPageSizeChange={(n) => {
              setMemberListPageSize(n)
              setMemberListPage(1)
            }}
          />
        </>
      )}
    </div>
  )
}
