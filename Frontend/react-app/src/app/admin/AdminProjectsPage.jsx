/**
 * app/admin/AdminProjectsPage.jsx (프로젝트 목록·생성 모달·수정·비활성)
 * ==========================================================
 * GET/POST/PATCH/DELETE /api/admin/projects — 생성·비활성은 canAccessOrgAdmin(sa_dev·sa·a)만.
 * 생성 모달: creator_pmssn_master_id·페이지 체크·테이블 매핑·부서 내 멤버·타부서 검색 초대·POST 바디 확장.
 * 생성 모달은 배경(오버레이) 클릭으로 닫지 않음 — 닫기·취소 버튼만(입력 실수 방지).
 * 목록 테이블: 프로젝트명·프로젝트설명 열 분리·ap__cell-clip, 작업 열 ibank-btn-table·Link 동일 톤.
 * 생성자 열은 이메일 셀 패턴(본인만 배지).
 *
 * [Main Functions]
 * ===========
 * - AdminProjectsPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/adminClient, shared/utils/crudConfirm, app/admin/adminAccess.js, app/auth/AuthContext.jsx
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  deleteAdminProject,
  getAdminProjects,
  getAdminRolesProjectAssignable,
  getAdminTablesForProjectCreate,
  getAdminUsersDeptTree,
  getAdminUsersSearch,
  patchAdminProject,
  postAdminProject,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { canAccessOrgAdmin, isCreatorSelf } from '@/app/admin/adminAccess.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import './admin-pages.css'
import './admin-users.css'

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
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createModalLoading, setCreateModalLoading] = useState(false)
  const [enabledPages, setEnabledPages] = useState({
    dashboard: true,
    queryStudio: true,
    widgetboard: true,
  })
  const [selectedTableIds, setSelectedTableIds] = useState(() => new Set())
  const [creatorPmssnId, setCreatorPmssnId] = useState(null)
  const [roles, setRoles] = useState([])
  const [tableMasterList, setTableMasterList] = useState([])
  const [deptMemberRows, setDeptMemberRows] = useState([])
  const [externalInvites, setExternalInvites] = useState([])
  const [extSearchQ, setExtSearchQ] = useState('')
  const [extSearchResults, setExtSearchResults] = useState([])
  const [extSearchBusy, setExtSearchBusy] = useState(false)
  const [highlightDeptUserIds, setHighlightDeptUserIds] = useState(() => new Set())
  const [highlightExtKeys, setHighlightExtKeys] = useState(() => new Set())

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

  function resetCreateForm() {
    setCName('')
    setCDesc('')
    setEnabledPages({ dashboard: true, queryStudio: true, widgetboard: true })
    setSelectedTableIds(new Set())
    setCreatorPmssnId(null)
    setRoles([])
    setTableMasterList([])
    setDeptMemberRows([])
    setExternalInvites([])
    setExtSearchQ('')
    setExtSearchResults([])
    setHighlightDeptUserIds(new Set())
    setHighlightExtKeys(new Set())
  }

  async function openCreateModal() {
    setError('')
    resetCreateForm()
    setCreateOpen(true)
    setCreateModalLoading(true)
    try {
      const [tu, tr, tt] = await Promise.all([
        getAdminUsersDeptTree(),
        getAdminRolesProjectAssignable(),
        getAdminTablesForProjectCreate(),
      ])
      const users = Array.isArray(tu?.items) ? tu.items : []
      const ritems = Array.isArray(tr?.items) ? tr.items : []
      const titems = Array.isArray(tt?.items) ? tt.items : []
      setRoles(ritems)
      setTableMasterList(titems)
      setDeptMemberRows(
        users.map((u) => ({
          ...u,
          checked: false,
          pmssn_master_id: null,
        })),
      )
    } catch (err) {
      setError(err?.message || '모달 데이터를 불러오지 못했습니다.')
    } finally {
      setCreateModalLoading(false)
    }
  }

  function closeCreateModal() {
    if (createBusy) return
    resetCreateForm()
    setCreateOpen(false)
  }

  function toggleTableId(id) {
    setSelectedTableIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function selectAllTables(checked) {
    if (!checked) {
      setSelectedTableIds(new Set())
      return
    }
    setSelectedTableIds(new Set(tableMasterList.map((t) => t.table_master_id)))
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
      const inDept = new Set(deptMemberRows.map((r) => r.user_id))
      if (me?.user_id != null) inDept.add(Number(me.user_id))
      setExtSearchResults(items.filter((u) => u.user_id != null && !inDept.has(u.user_id)))
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

  async function handleCreate(e) {
    e.preventDefault()
    const name = cName.trim()
    if (name.length < 1 || name.length > 20) {
      setError('프로젝트명은 1~20자로 입력하세요.')
      return
    }
    const dsc = (cDesc || '').trim()
    if (dsc.length > 100) {
      setError('설명은 100자 이내입니다.')
      return
    }
    if (creatorPmssnId == null || Number(creatorPmssnId) <= 0) {
      setError('생성자 프로젝트 권한(역할)을 선택하세요.')
      return
    }
    const badDept = []
    const members = []
    for (const r of deptMemberRows) {
      if (!r.checked) continue
      const mid = r.pmssn_master_id != null ? Number(r.pmssn_master_id) : 0
      if (!mid) {
        badDept.push(r.user_id)
        continue
      }
      members.push({ user_id: r.user_id, pmssn_master_id: mid })
    }
    setHighlightDeptUserIds(new Set(badDept))
    if (badDept.length) {
      setError('체크한 부서 내 참여자에게 역할을 선택하세요.')
      return
    }
    const badExt = []
    const extPayload = []
    for (const x of externalInvites) {
      const mid = x.pmssn_master_id != null ? Number(x.pmssn_master_id) : 0
      if (!mid) {
        badExt.push(`${x.user_id}`)
        continue
      }
      extPayload.push({ user_id: x.user_id, pmssn_master_id: mid })
    }
    setHighlightExtKeys(new Set(badExt))
    if (badExt.length) {
      setError('타부서 초대 대상에게 역할을 선택하세요.')
      return
    }
    if (enabledPages.queryStudio && selectedTableIds.size === 0) {
      if (!confirmCrud('쿼리 스튜디오를 켠 상태인데 매핑된 테이블이 없습니다. 그대로 생성할까요?')) {
        return
      }
    } else if (!confirmCrud('새 프로젝트를 생성할까요?')) {
      return
    }
    const enabled_pages = []
    if (enabledPages.dashboard) enabled_pages.push('dashboard')
    if (enabledPages.queryStudio) {
      enabled_pages.push('query.read', 'query.execute')
    }
    if (enabledPages.widgetboard) enabled_pages.push('widgetboard')
    setError('')
    setCreateBusy(true)
    try {
      await postAdminProject({
        project_name: name,
        project_dscrtn: dsc || null,
        enabled_pages,
        table_master_ids: [...selectedTableIds],
        creator_pmssn_master_id: Number(creatorPmssnId),
        members,
        external_invites: extPayload,
      })
      closeCreateModal()
      await load()
    } catch (err) {
      setError(err?.message || '생성 실패')
    } finally {
      setCreateBusy(false)
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
      <div className="ap__header-row">
        <div>
          <h1 className="ap__title">프로젝트 관리</h1>
          <p className="ap__hint">
            {isOperator
              ? '참여 중인 프로젝트만 표시될 수 있습니다. 이름·설명 수정은 가능하며, 활성 여부·신규 생성·비활성화는 조직 어드민만 가능합니다.'
              : '부서 소속 프로젝트를 관리합니다. 멤버는 각 행의 링크에서 설정합니다.'}
          </p>
        </div>
        {isOrgAdmin ? (
          <button type="button" className="ibank-btn-toolbar" onClick={openCreateModal}>
            프로젝트 생성
          </button>
        ) : null}
      </div>
      {error ? <p className="ap__error">{error}</p> : null}

      {createOpen ? (
        <div className="ap__modal-overlay" role="presentation">
          <div
            className="ap__modal ap__modal--create ap__modal--create-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proj-create-title"
          >
            <div className="ap__create-head">
              <h3 id="proj-create-title">프로젝트 생성</h3>
              <button
                type="button"
                className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                disabled={createBusy}
                onClick={() => closeCreateModal()}
              >
                닫기
              </button>
            </div>
            {createModalLoading ? (
              <p className="ap__hint">불러오는 중…</p>
            ) : (
              <form className="ap__modal-form ap__modal-form--create" onSubmit={handleCreate}>
                <label className="ap__label">
                  프로젝트명 <span className="ap__muted">({cName.length}/20)</span>
                  <input
                    className="ap__input"
                    value={cName}
                    onChange={(ev) => setCName(ev.target.value)}
                    required
                    minLength={1}
                    maxLength={20}
                    disabled={createBusy}
                  />
                </label>
                <label className="ap__label">
                  프로젝트 설명 <span className="ap__muted">({(cDesc || '').length}/100)</span>
                  <textarea
                    className="ap__textarea ap__textarea--3"
                    value={cDesc}
                    onChange={(ev) => setCDesc(ev.target.value)}
                    maxLength={100}
                    disabled={createBusy}
                  />
                </label>

                <div className="ap__create-section">
                  <div className="ap__create-section-title">내 프로젝트 역할</div>
                  <label className="ap__label">
                    생성 시 본인에게 부여할 권한 <span className="ap__req">*</span>
                    <select
                      className="ap__select"
                      value={creatorPmssnId ?? ''}
                      onChange={(ev) =>
                        setCreatorPmssnId(ev.target.value ? Number(ev.target.value) : null)
                      }
                      required
                      disabled={createBusy}
                    >
                      <option value="">선택</option>
                      {roles.map((r) => (
                        <option key={String(r.pmssn_master_id)} value={r.pmssn_master_id}>
                          {r.pmssn_name || r.pmssn_master_id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="ap__create-section">
                  <div className="ap__create-section-title">프로젝트 페이지 선택</div>
                  <div className="ap__create-check-row">
                    <label className="ap__check">
                      <input
                        type="checkbox"
                        checked={enabledPages.dashboard}
                        onChange={(ev) =>
                          setEnabledPages((p) => ({ ...p, dashboard: ev.target.checked }))
                        }
                        disabled={createBusy}
                      />
                      캠페인 대시보드
                    </label>
                    <label className="ap__check">
                      <input
                        type="checkbox"
                        checked={enabledPages.queryStudio}
                        onChange={(ev) =>
                          setEnabledPages((p) => ({ ...p, queryStudio: ev.target.checked }))
                        }
                        disabled={createBusy}
                      />
                      쿼리 스튜디오
                    </label>
                    <label className="ap__check">
                      <input
                        type="checkbox"
                        checked={enabledPages.widgetboard}
                        onChange={(ev) =>
                          setEnabledPages((p) => ({ ...p, widgetboard: ev.target.checked }))
                        }
                        disabled={createBusy}
                      />
                      위젯보드
                    </label>
                  </div>
                </div>

                {enabledPages.queryStudio ? (
                  <div className="ap__create-section">
                    <div className="ap__create-section-title">테이블 매핑 (쿼리 스튜디오)</div>
                    <div className="ap__table-pick-head">
                      <label className="ap__check">
                        <input
                          type="checkbox"
                          onChange={(ev) => selectAllTables(ev.target.checked)}
                          disabled={createBusy || tableMasterList.length === 0}
                        />
                        전체 선택
                      </label>
                    </div>
                    <div className="ap__table-pick-body">
                      <table className="ap__table ap__table--compact">
                        <thead>
                          <tr>
                            <th>DB</th>
                            <th>테이블명</th>
                            <th>라벨</th>
                            <th>선택</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableMasterList.map((t) => {
                            const id = t.table_master_id
                            const on = selectedTableIds.has(id)
                            return (
                              <tr key={String(id)}>
                                <td>{t.db_type || '—'}</td>
                                <td className="ap__mono">{t.table_name || '—'}</td>
                                <td>{t.table_label || '—'}</td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleTableId(id)}
                                    disabled={createBusy}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="ap__create-section">
                  <div className="ap__create-section-title">부서 내 참여자</div>
                  <div className="ap__member-pick-body">
                    <table className="ap__table ap__table--compact">
                      <thead>
                        <tr>
                          <th>이메일</th>
                          <th>닉네임</th>
                          <th>역할</th>
                          <th>권한</th>
                          <th>선택</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptMemberRows.map((r) => (
                          <tr
                            key={String(r.user_id)}
                            className={
                              highlightDeptUserIds.has(r.user_id) ? 'ap__row--warn' : undefined
                            }
                          >
                            <td className="ap__mono">{r.user_email || '—'}</td>
                            <td>{r.user_nickname || '—'}</td>
                            <td>{(r.user_dvsn || '').toUpperCase()}</td>
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
                                disabled={createBusy || !r.checked}
                              >
                                <option value="">선택</option>
                                {roles.map((x) => (
                                  <option key={String(x.pmssn_master_id)} value={x.pmssn_master_id}>
                                    {x.pmssn_name || x.pmssn_master_id}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!r.checked}
                                onChange={(ev) => setDeptRowChecked(r.user_id, ev.target.checked)}
                                disabled={createBusy}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ap__create-section">
                  <div className="ap__create-section-title">타부서 참여자 초대</div>
                  <div className="ap__ext-search">
                    <input
                      className="ap__input"
                      placeholder="이메일 검색 (2자 이상)"
                      value={extSearchQ}
                      onChange={(ev) => setExtSearchQ(ev.target.value)}
                      disabled={createBusy}
                    />
                    <button
                      type="button"
                      className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                      disabled={createBusy || extSearchBusy}
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
                              createBusy ||
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
                          <th>역할</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {externalInvites.map((x) => (
                          <tr
                            key={String(x.user_id)}
                            className={
                              highlightExtKeys.has(String(x.user_id)) ? 'ap__row--warn' : undefined
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
                                disabled={createBusy}
                              >
                                <option value="">선택</option>
                                {roles.map((ro) => (
                                  <option key={String(ro.pmssn_master_id)} value={ro.pmssn_master_id}>
                                    {ro.pmssn_name || ro.pmssn_master_id}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                disabled={createBusy}
                                onClick={() => removeExternalInvite(x.user_id)}
                              >
                                제거
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ap__row ap__modal-actions">
                  <button
                    type="button"
                    className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                    disabled={createBusy}
                    onClick={() => closeCreateModal()}
                  >
                    취소
                  </button>
                  <button type="submit" className="ibank-btn-toolbar" disabled={createBusy}>
                    {createBusy ? '생성 중…' : '생성'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table ap__table--projects">
            <thead>
              <tr>
                <th>프로젝트명</th>
                <th>프로젝트설명</th>
                <th>상태</th>
                <th>생성일</th>
                <th>생성자</th>
                <th className="ap__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const pid = row.project_info_id
                const active = (row.active_yn || '').toUpperCase() === 'Y'
                const pname = row.project_name || '—'
                const pdesc = row.project_dscrtn || ''
                return (
                  <tr key={String(pid)}>
                    <td className="ap__td-clip-name">
                      <span
                        className="ap__cell-clip ap__cell-clip--project-name"
                        title={pname !== '—' ? pname : undefined}
                      >
                        {pname}
                      </span>
                    </td>
                    <td className="ap__td-clip-desc">
                      <span className="ap__cell-clip" title={pdesc || undefined}>
                        {pdesc || '—'}
                      </span>
                    </td>
                    <td>{active ? '활성' : '비활성'}</td>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td className="ap__creator-cell">
                      <span className="admin-users__email-cell">
                        <span className="admin-users__email-text" title={row.creator_email || undefined}>
                          {row.creator_email || '—'}
                        </span>
                        {isCreatorSelf(me, row) ? (
                          <span className="admin-users__self-badge" title="본인 계정">
                            본인
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <div className="ap__cell-actions">
                        <Link
                          to={`/admin/projects/${pid}/members`}
                          className="ibank-btn-table"
                        >
                          멤버 관리
                        </Link>
                        <button
                          type="button"
                          className="ibank-btn-table"
                          disabled={busyId != null}
                          onClick={() => openEdit(row)}
                        >
                          수정
                        </button>
                        {isOrgAdmin ? (
                          <button
                            type="button"
                            className="ibank-btn-table ibank-btn-table--danger"
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
          <div className="ap__modal ap__modal--edit" role="dialog" aria-modal="true" aria-labelledby="proj-edit-title">
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
              <div className="ap__row ap__modal-actions">
                <button
                  type="button"
                  className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                  onClick={() => setEdit(null)}
                  disabled={busyId != null}
                >
                  취소
                </button>
                <button type="submit" className="ibank-btn-toolbar" disabled={busyId != null}>
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
