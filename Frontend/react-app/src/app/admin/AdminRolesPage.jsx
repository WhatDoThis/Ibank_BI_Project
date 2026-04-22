/**
 * app/admin/AdminRolesPage.jsx (권한 관리·사용현황 드릴다운)
 * ===============================================
 * 권한 목록·우상단「권한 생성」모달·수정/삭제·사용현황(사용자 부서 열·요약 행은 프로젝트명/사용자명 일반 텍스트, 이동은 작업 열 `프로젝트`/`권한` 버튼). 생성일·수정일 열, 목록 필터·컬럼 정렬(내림·오름·해제). 생성자 열은 이메일 셀 패턴(본인만 배지). 사용 중(usage_count>0) 커스텀 권한은 상세 목록 편집·전송 없이 권한명만 저장(`ap__notice--locked`). 수정 실패는 모달 `editError`·스냅샷으로 폼 복구.
 *
 * [Main Functions]
 * ===========
 * - AdminRolesPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, shared/utils/crudConfirm, shared/utils/adminListTable, shared/hooks/useResetListPage, shared/components/AdminSortableTh, shared/components/AdminListPaginationFooter, app/auth/AuthContext, app/admin/adminAccess, admin-list-table.css
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

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
  deleteAdminProjectMember,
  deleteAdminRole,
  getAdminRolePermissionOptions,
  getAdminRoleProjectParticipants,
  getAdminRoles,
  getAdminRoleUsages,
  getAdminRoleUserUsages,
  patchAdminProjectMember,
  postAdminRole,
  putAdminRole,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { isCreatorSelf } from '@/app/admin/adminAccess.js'

import './admin-pages.css'
import './admin-users.css'
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

function formatPmssnList(pl) {
  if (Array.isArray(pl)) return pl.join(', ')
  if (pl == null) return '—'
  return String(pl)
}

function parsePmssnInput(s) {
  return String(s || '')
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** API의 pmssn_list(배열·문자열)를 편집용 문자열 배열로 정규화 */
function pmssnListToArray(pl) {
  if (Array.isArray(pl)) {
    return pl.map((x) => String(x).trim()).filter(Boolean)
  }
  if (pl == null || pl === '') return []
  return parsePmssnInput(String(pl))
}

function isSystem(row) {
  return (row.system_dflt_yn || '').toUpperCase() === 'Y'
}

function normalizePermissionOptions(data) {
  const raw = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.options)
      ? data.options
      : Array.isArray(data)
        ? data
        : []
  return raw
    .map((it) => {
      if (typeof it === 'string') return { value: it, label: it }
      const value = String(it?.pmssn_detail_name || it?.value || it?.key || '').trim()
      if (!value) return null
      const label = String(it?.pmssn_detail_dscrtn || it?.label || value)
      return { value, label }
    })
    .filter(Boolean)
}

function initialRoleListFilters() {
  return {
    name: '',
    listDetail: '',
    usage: '',
    creator: '',
    createFrom: '',
    createTo: '',
    updateFrom: '',
    updateTo: '',
  }
}

function roleComparable(row, key) {
  switch (key) {
    case 'name':
      return String(row?.pmssn_name ?? '').toLowerCase()
    case 'list':
      return String(formatPmssnList(row?.pmssn_list) ?? '').toLowerCase()
    case 'usage':
      return Number(row?.usage_count || 0)
    case 'creator':
      return String(row?.creator_email ?? '').toLowerCase()
    case 'created': {
      const t = row?.create_dtm ? new Date(row.create_dtm).getTime() : 0
      return Number.isNaN(t) ? 0 : t
    }
    case 'updated': {
      const t = row?.update_dtm ? new Date(row.update_dtm).getTime() : 0
      return Number.isNaN(t) ? 0 : t
    }
    default:
      return ''
  }
}

function normalizeUsageRows(data) {
  const rows = Array.isArray(data?.items) ? data.items : []
  return rows.map((row, idx) => ({
    key: String(row?.id || `${row?.project_info_id || ''}-${row?.ptcpnt_user_id || ''}-${idx}`),
    project_info_id: row?.project_info_id,
    project_name: row?.project_name || '-',
    ptcpnt_user_id: row?.ptcpnt_user_id,
    user_name: row?.user_name || row?.user_nickname || row?.user_email || '-',
    user_department_display: row?.user_department_display ?? '—',
    pmssn_master_id: row?.pmssn_master_id,
    pmssn_name: row?.pmssn_name || '-',
  }))
}

export default function AdminRolesPage() {
  const { me } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [roleFilters, setRoleFilters] = useState(() => initialRoleListFilters())
  const [roleSort, setRoleSort] = useState({ key: null, dir: null })

  const [permissionOptions, setPermissionOptions] = useState([])
  const [selectedPermission, setSelectedPermission] = useState('')
  const [newName, setNewName] = useState('')
  const [newPmssnList, setNewPmssnList] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)

  const [edit, setEdit] = useState(null)
  const [editInUse, setEditInUse] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSnapshotName, setEditSnapshotName] = useState('')
  const [editSnapshotPmssnList, setEditSnapshotPmssnList] = useState([])
  const [editName, setEditName] = useState('')
  const [editPmssnList, setEditPmssnList] = useState([])
  const [editSelectedPermission, setEditSelectedPermission] = useState('')

  const [usageOpen, setUsageOpen] = useState(false)
  const [usageRole, setUsageRole] = useState(null)
  const [usageView, setUsageView] = useState('usage')
  const [usageStack, setUsageStack] = useState([])
  const [usageRows, setUsageRows] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')
  const [memberEditKey, setMemberEditKey] = useState('')
  const [memberEditRoleId, setMemberEditRoleId] = useState('')
  const [usageBusy, setUsageBusy] = useState(false)

  const roleMap = useMemo(() => {
    const m = new Map()
    items.forEach((x) => m.set(String(x.pmssn_master_id), x.pmssn_name || `권한 ${x.pmssn_master_id}`))
    return m
  }, [items])

  const roleOptions = useMemo(
    () =>
      items.map((r) => ({
        value: String(r.pmssn_master_id),
        label: r.pmssn_name || `권한 ${r.pmssn_master_id}`,
      })),
    [items],
  )
  const permissionOptionMap = useMemo(() => {
    const m = new Map()
    permissionOptions.forEach((opt) => {
      m.set(String(opt.value), String(opt.label || opt.value))
    })
    return m
  }, [permissionOptions])

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await getAdminRoles()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setError(e?.message || '목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPermissionOptions = useCallback(async () => {
    try {
      const data = await getAdminRolePermissionOptions()
      const list = normalizePermissionOptions(data)
      setPermissionOptions(list)
      setSelectedPermission((prev) => (prev ? prev : list[0]?.value || ''))
    } catch {
      setPermissionOptions([])
      setSelectedPermission('')
    }
  }, [])

  useEffect(() => {
    load()
    loadPermissionOptions()
  }, [load, loadPermissionOptions])

  const handleRoleSort = useCallback((key) => {
    setRoleSort((prev) => cycleListSort(prev, key))
  }, [])

  const resetRoleListQuery = useCallback(() => {
    setRoleFilters(initialRoleListFilters())
    setRoleSort({ key: null, dir: null })
  }, [])

  const displayRoles = useMemo(() => {
    const f = roleFilters
    let rows = Array.isArray(items) ? items.slice() : []
    rows = rows.filter((row) => {
      if (!strContains(row.pmssn_name, f.name)) return false
      if (!strContains(formatPmssnList(row.pmssn_list), f.listDetail)) return false
      const uc = Number(row?.usage_count || 0)
      if (f.usage === 'in_use' && uc <= 0) return false
      if (f.usage === 'unused' && uc > 0) return false
      if (!strContains(row.creator_email, f.creator)) return false
      if (!dateFieldInRange(row.create_dtm, f.createFrom, f.createTo)) return false
      if (!dateFieldInRange(row.update_dtm, f.updateFrom, f.updateTo)) return false
      return true
    })
    return sortRowsByState(rows, roleSort, roleComparable)
  }, [items, roleFilters, roleSort])

  const [roleListPage, setRoleListPage] = useState(1)
  const [roleListPageSize, setRoleListPageSize] = useState(10)

  const pagedDisplayRoles = useMemo(() => {
    const start = (roleListPage - 1) * roleListPageSize
    return displayRoles.slice(start, start + roleListPageSize)
  }, [displayRoles, roleListPage, roleListPageSize])

  useResetListPage(setRoleListPage, roleFilters, roleSort, items)

  useEffect(() => {
    if (edit == null) return
    if (editSelectedPermission || permissionOptions.length === 0) return
    setEditSelectedPermission(String(permissionOptions[0].value))
  }, [edit, editSelectedPermission, permissionOptions])

  function addPermissionToNewList() {
    const picked = String(selectedPermission || '').trim()
    if (!picked) return
    if (newPmssnList.includes(picked)) {
      window.alert('이미 적용되었습니다.')
      return
    }
    setNewPmssnList((prev) => [...prev, picked])
  }

  function removePermissionFromNewList(value) {
    setNewPmssnList((prev) => prev.filter((x) => x !== value))
  }

  function addPermissionToEditList() {
    const picked = String(editSelectedPermission || '').trim()
    if (!picked) return
    if (editPmssnList.includes(picked)) {
      window.alert('이미 적용되었습니다.')
      return
    }
    setEditError('')
    setEditPmssnList((prev) => [...prev, picked])
  }

  function removePermissionFromEditList(value) {
    setEditError('')
    setEditPmssnList((prev) => prev.filter((x) => x !== value))
  }

  function openCreateModal() {
    setError('')
    setNewName('')
    setNewPmssnList([])
    setSelectedPermission(permissionOptions[0]?.value || '')
    setCreateOpen(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!confirmCrud('프로젝트 권한을 생성할까요?')) return
    setError('')
    setCreateBusy(true)
    try {
      await postAdminRole({
        pmssn_name: newName.trim(),
        pmssn_list: newPmssnList,
      })
      setNewName('')
      setNewPmssnList([])
      setSelectedPermission(permissionOptions[0]?.value || '')
      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e?.message || '생성 실패')
    } finally {
      setCreateBusy(false)
    }
  }

  function openEdit(row) {
    if (isSystem(row)) return
    const name = row.pmssn_name || ''
    const list = pmssnListToArray(row.pmssn_list)
    setEdit(row.pmssn_master_id)
    setEditInUse(Number(row?.usage_count || 0) > 0)
    setEditError('')
    setEditSnapshotName(name)
    setEditSnapshotPmssnList(list)
    setEditName(name)
    setEditPmssnList(list)
    setEditSelectedPermission(permissionOptions[0]?.value || '')
  }

  function closeEditModal() {
    setEdit(null)
    setEditInUse(false)
    setEditError('')
    setEditSnapshotName('')
    setEditSnapshotPmssnList([])
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (edit == null) return
    setBusyId(edit)
    setEditError('')
    try {
      const body = { pmssn_name: editName.trim() }
      if (!editInUse) body.pmssn_list = editPmssnList
      await putAdminRole(edit, body)
      closeEditModal()
      await load()
    } catch (e) {
      setEditError(e?.message || '수정 실패')
      setEditName(editSnapshotName)
      setEditPmssnList([...editSnapshotPmssnList])
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id) {
    if (!confirmCrud('이 커스텀 권한을 삭제할까요?')) return
    setBusyId(id)
    setError('')
    try {
      await deleteAdminRole(id)
      await load()
    } catch (e) {
      setError(e?.message || '삭제 실패')
    } finally {
      setBusyId(null)
    }
  }

  async function openUsageModal(row) {
    setUsageOpen(true)
    setUsageRole({
      pmssn_master_id: row.pmssn_master_id,
      pmssn_name: row.pmssn_name || `권한 ${row.pmssn_master_id}`,
    })
    setUsageView('usage')
    setUsageStack([])
    setUsageRows([])
    setUsageError('')
    setMemberEditKey('')
    setMemberEditRoleId('')
    setUsageLoading(true)
    try {
      const data = await getAdminRoleUsages(row.pmssn_master_id)
      setUsageRows(normalizeUsageRows(data))
    } catch (e) {
      setUsageRows([])
      setUsageError(e?.message || '사용현황을 불러오지 못했습니다.')
    } finally {
      setUsageLoading(false)
    }
  }

  async function moveToProjectParticipants(projectInfoId, projectName) {
    if (!usageRole?.pmssn_master_id) return
    setUsageStack((prev) => [...prev, { view: usageView, rows: usageRows }])
    setUsageView('project')
    setUsageRows([])
    setUsageError('')
    setMemberEditKey('')
    setMemberEditRoleId('')
    setUsageLoading(true)
    try {
      const data = await getAdminRoleProjectParticipants(usageRole.pmssn_master_id, projectInfoId)
      const rows = normalizeUsageRows(data).map((r) => ({ ...r, project_name: projectName || r.project_name }))
      setUsageRows(rows)
    } catch (e) {
      setUsageRows([])
      setUsageError(e?.message || '프로젝트 참여자 목록을 불러오지 못했습니다.')
    } finally {
      setUsageLoading(false)
    }
  }

  async function moveToUserUsages(userId, userName) {
    setUsageStack((prev) => [...prev, { view: usageView, rows: usageRows }])
    setUsageView('user')
    setUsageRows([])
    setUsageError('')
    setMemberEditKey('')
    setMemberEditRoleId('')
    setUsageLoading(true)
    try {
      const data = await getAdminRoleUserUsages(userId)
      const rows = normalizeUsageRows(data).map((r) => ({ ...r, user_name: userName || r.user_name }))
      setUsageRows(rows)
    } catch (e) {
      setUsageRows([])
      setUsageError(e?.message || '사용자 권한 목록을 불러오지 못했습니다.')
    } finally {
      setUsageLoading(false)
    }
  }

  function goBackUsage() {
    const prev = usageStack[usageStack.length - 1]
    if (!prev) return
    setUsageStack((stack) => stack.slice(0, -1))
    setUsageView(prev.view)
    setUsageRows(prev.rows)
    setUsageError('')
    setMemberEditKey('')
    setMemberEditRoleId('')
  }

  async function handleSaveParticipantRole(row) {
    const key = String(row.key)
    const nextRoleId = parseInt(String(memberEditRoleId || ''), 10)
    if (Number.isNaN(nextRoleId) || !row?.project_info_id || !row?.ptcpnt_user_id) return
    if (!confirmCrud('이 참여자의 권한을 변경할까요?')) return
    setUsageBusy(true)
    setUsageError('')
    try {
      await patchAdminProjectMember(row.project_info_id, row.ptcpnt_user_id, {
        pmssn_master_id: nextRoleId,
      })
      setUsageRows((prev) =>
        prev.map((item) =>
          String(item.key) === key
            ? {
                ...item,
                pmssn_master_id: nextRoleId,
                pmssn_name: roleMap.get(String(nextRoleId)) || `권한 ${nextRoleId}`,
              }
            : item,
        ),
      )
      setMemberEditKey('')
      setMemberEditRoleId('')
    } catch (e) {
      setUsageError(e?.message || '권한 변경 실패')
    } finally {
      setUsageBusy(false)
    }
  }

  async function handleRemoveParticipant(row) {
    if (!row?.project_info_id || !row?.ptcpnt_user_id) return
    if (!confirmCrud('해당 프로젝트 참여자를 제거할까요?')) return
    setUsageBusy(true)
    setUsageError('')
    try {
      await deleteAdminProjectMember(row.project_info_id, row.ptcpnt_user_id)
      setUsageRows((prev) => prev.filter((item) => String(item.key) !== String(row.key)))
    } catch (e) {
      setUsageError(e?.message || '참여자 제거 실패')
    } finally {
      setUsageBusy(false)
    }
  }

  function usageTitle() {
    if (!usageRole) return '사용현황'
    if (usageView === 'project') return `${usageRole.pmssn_name} - 프로젝트 참여자`
    if (usageView === 'user') return `${usageRole.pmssn_name} - 사용자 권한`
    return `${usageRole.pmssn_name} - 사용현황`
  }

  return (
    <div className="ap">
      <div className="ap__header-row">
        <div>
          <h1 className="ap__title">권한 관리</h1>
          <p className="ap__hint">
            목록에는 전사 시스템 기본 권한과 본인 부서에 등록된 커스텀 권한만 표시됩니다. 시스템 기본 권한은 조회만
            가능합니다.
          </p>
        </div>
        <button type="button" className="ibank-btn-toolbar" onClick={openCreateModal}>
          권한 생성
        </button>
      </div>
      {error ? <p className="ap__error">{error}</p> : null}

      {createOpen ? (
        <div
          className="ap__modal-overlay"
          role="presentation"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            className="ap__modal ap__modal--create"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pmssn-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pmssn-create-title">프로젝트 권한 생성</h3>
            <p className="ap__hint ap__hint--tight">
              권한명과 권한 상세 목록을 지정합니다. 상세는 `pmssn_master_detail`에 정의된 항목만 선택할 수 있습니다.
            </p>
            <form className="ap__modal-form" onSubmit={handleCreate}>
              <label className="ap__label">
                권한명
                <input
                  className="ap__input"
                  value={newName}
                  onChange={(ev) => setNewName(ev.target.value)}
                  required
                  maxLength={100}
                  disabled={createBusy}
                />
              </label>

              <label className="ap__label">
                권한 상세 목록
                <div className="ap__row">
                  <select
                    className="ap__select"
                    value={selectedPermission}
                    onChange={(ev) => setSelectedPermission(ev.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                    disabled={createBusy}
                  >
                    {permissionOptions.length === 0 ? <option value="">선택 가능한 항목이 없습니다.</option> : null}
                    {permissionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} {opt.label && opt.label !== opt.value ? `- ${opt.label}` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="ibank-btn-table" onClick={addPermissionToNewList} disabled={createBusy}>
                    추가
                  </button>
                </div>
              </label>

              <div className="ap__permission-list-wrap">
                {newPmssnList.length === 0 ? <span className="ap__hint">선택된 권한 상세가 없습니다.</span> : null}
                {newPmssnList.length > 0 ? (
                  <table className="ap__permission-list">
                    <thead>
                      <tr>
                        <th>권한명</th>
                        <th>권한설명</th>
                        <th aria-label="삭제" />
                      </tr>
                    </thead>
                    <tbody>
                      {newPmssnList.map((value) => {
                        const label = permissionOptionMap.get(value) || value
                        const description = label === value ? '-' : label
                        return (
                          <tr key={value}>
                            <td>{value}</td>
                            <td>{description}</td>
                            <td className="ap__permission-remove-cell">
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                onClick={() => removePermissionFromNewList(value)}
                                disabled={createBusy}
                              >
                                x
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : null}
              </div>

              <div className="ap__row ap__modal-actions">
                <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" disabled={createBusy} onClick={() => setCreateOpen(false)}>
                  닫기
                </button>
                <button type="submit" className="ibank-btn-toolbar" disabled={createBusy}>
                  {createBusy ? '생성 중…' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <>
          <div className="admin-list-filters" aria-label="권한 목록 필터">
            <div className="admin-list-filters__field">
              <label htmlFor="role-f-name">권한명</label>
              <input
                id="role-f-name"
                type="text"
                value={roleFilters.name}
                onChange={(ev) => setRoleFilters((p) => ({ ...p, name: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field admin-list-filters__field--grow">
              <label htmlFor="role-f-list">권한 상세 목록</label>
              <input
                id="role-f-list"
                type="text"
                value={roleFilters.listDetail}
                onChange={(ev) => setRoleFilters((p) => ({ ...p, listDetail: ev.target.value }))}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="role-f-usage">사용 현황</label>
              <select
                id="role-f-usage"
                value={roleFilters.usage}
                onChange={(ev) => setRoleFilters((p) => ({ ...p, usage: ev.target.value }))}
              >
                <option value="">전체</option>
                <option value="in_use">사용 중</option>
                <option value="unused">미사용</option>
              </select>
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="role-f-creator">생성자</label>
              <input
                id="role-f-creator"
                type="text"
                value={roleFilters.creator}
                onChange={(ev) => setRoleFilters((p) => ({ ...p, creator: ev.target.value }))}
                placeholder="이메일 contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <span id="role-f-cr-lbl">생성일</span>
              <div className="admin-list-filters__datepair" aria-labelledby="role-f-cr-lbl">
                <input
                  type="date"
                  value={roleFilters.createFrom}
                  onChange={(ev) => setRoleFilters((p) => ({ ...p, createFrom: ev.target.value }))}
                  aria-label="생성일 시작"
                />
                <span>~</span>
                <input
                  type="date"
                  value={roleFilters.createTo}
                  onChange={(ev) => setRoleFilters((p) => ({ ...p, createTo: ev.target.value }))}
                  aria-label="생성일 끝"
                />
              </div>
            </div>
            <div className="admin-list-filters__field">
              <span id="role-f-up-lbl">수정일</span>
              <div className="admin-list-filters__datepair" aria-labelledby="role-f-up-lbl">
                <input
                  type="date"
                  value={roleFilters.updateFrom}
                  onChange={(ev) => setRoleFilters((p) => ({ ...p, updateFrom: ev.target.value }))}
                  aria-label="수정일 시작"
                />
                <span>~</span>
                <input
                  type="date"
                  value={roleFilters.updateTo}
                  onChange={(ev) => setRoleFilters((p) => ({ ...p, updateTo: ev.target.value }))}
                  aria-label="수정일 끝"
                />
              </div>
            </div>
            <div className="admin-list-filters__actions">
              <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={resetRoleListQuery}>
                초기화
              </button>
            </div>
          </div>
        <div className="ap__table-wrap">
          <table className="ap__table ap__table--roles">
            <thead>
              <tr>
                <AdminSortableTh sortKey="name" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  권한명
                </AdminSortableTh>
                <AdminSortableTh sortKey="list" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  권한상세목록
                </AdminSortableTh>
                <AdminSortableTh sortKey="usage" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  사용현황
                </AdminSortableTh>
                <AdminSortableTh sortKey="creator" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  생성자
                </AdminSortableTh>
                <AdminSortableTh sortKey="created" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  생성일
                </AdminSortableTh>
                <AdminSortableTh sortKey="updated" activeKey={roleSort.key} dir={roleSort.dir} onSort={handleRoleSort}>
                  수정일
                </AdminSortableTh>
                <th className="ap__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {displayRoles.length === 0 && items.length > 0 ? (
                <tr>
                  <td colSpan={7} className="ap__hint">
                    필터 조건에 맞는 권한이 없습니다.
                  </td>
                </tr>
              ) : null}
              {pagedDisplayRoles.map((row) => {
                const id = row.pmssn_master_id
                const sys = isSystem(row)
                const usageCount = Number(row?.usage_count || 0)
                const inUse = usageCount > 0
                return (
                  <tr key={String(id)}>
                    <td>{row.pmssn_name || '—'}</td>
                    <td>
                      <span className="ap__cell-clip ap__cell-clip--mono">{formatPmssnList(row.pmssn_list)}</span>
                    </td>
                    <td>
                      {inUse ? (
                        <span className="ap__cell-actions">
                          <span>사용중</span>
                          <button type="button" className="ibank-btn-table" onClick={() => openUsageModal(row)}>
                            목록
                          </button>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
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
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td>{formatDtm(row.update_dtm)}</td>
                    <td>
                      {sys ? (
                        '—'
                      ) : (
                        <span className="ap__cell-actions">
                          <button
                            type="button"
                            className="ibank-btn-table"
                            disabled={busyId != null}
                            onClick={() => openEdit(row)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="ibank-btn-table ibank-btn-table--danger"
                            disabled={busyId != null}
                            onClick={() => handleDelete(id)}
                          >
                            삭제
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
          <AdminListPaginationFooter
            idPrefix="admin-roles-list"
            total={displayRoles.length}
            page={roleListPage}
            pageSize={roleListPageSize}
            loading={loading}
            onPageChange={setRoleListPage}
            onPageSizeChange={(n) => {
              setRoleListPageSize(n)
              setRoleListPage(1)
            }}
          />
        </>
      )}

      {edit != null ? (
        <div className="ap__modal-overlay" role="presentation">
          <div className="ap__modal ap__modal--edit" role="dialog" aria-modal="true" aria-labelledby="pmssn-edit-title">
            <h3 id="pmssn-edit-title">권한 수정</h3>
            <form onSubmit={handleSaveEdit}>
              {editError ? <p className="ap__error">{editError}</p> : null}
              <label className="ap__label">
                권한명
                <input
                  className="ap__input"
                  value={editName}
                  onChange={(ev) => {
                    setEditError('')
                    setEditName(ev.target.value)
                  }}
                  required
                  maxLength={100}
                />
              </label>
              {editInUse ? (
                <div className="ap__notice--locked" role="status">
                  <span className="ap__notice--locked-badge">사용 중 · 배정됨</span>
                  <p className="ap__notice--locked-text">
                    이 권한은 프로젝트에 배정되어 사용 중입니다. 상세 권한 목록은 변경할 수 없으며 권한명만 수정할 수
                    있습니다.
                  </p>
                </div>
              ) : null}
              <label className="ap__label">
                권한 상세 목록
                <div className="ap__row">
                  <select
                    className="ap__select"
                    value={editSelectedPermission}
                    onChange={(ev) => setEditSelectedPermission(ev.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                    disabled={editInUse || busyId != null}
                  >
                    {permissionOptions.length === 0 ? <option value="">선택 가능한 항목이 없습니다.</option> : null}
                    {permissionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} {opt.label && opt.label !== opt.value ? `- ${opt.label}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ibank-btn-table"
                    onClick={addPermissionToEditList}
                    disabled={editInUse || busyId != null}
                  >
                    추가
                  </button>
                </div>
              </label>
              <div className="ap__permission-list-wrap">
                {editPmssnList.length === 0 ? <span className="ap__hint">선택된 권한 상세가 없습니다.</span> : null}
                {editPmssnList.length > 0 ? (
                  <table className="ap__permission-list">
                    <thead>
                      <tr>
                        <th>권한명</th>
                        <th>권한설명</th>
                        <th aria-label="삭제" />
                      </tr>
                    </thead>
                    <tbody>
                      {editPmssnList.map((value) => {
                        const label = permissionOptionMap.get(value) || value
                        const description = label === value ? '-' : label
                        return (
                          <tr key={value}>
                            <td>{value}</td>
                            <td>{description}</td>
                            <td className="ap__permission-remove-cell">
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                onClick={() => removePermissionFromEditList(value)}
                                disabled={editInUse || busyId != null}
                              >
                                x
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : null}
              </div>
              {!editInUse ? (
                <p className="ap__hint" style={{ marginTop: 0 }}>
                  권한 상세는 위 셀렉트에 있는 항목만 추가할 수 있습니다. x로 제거한 항목은 저장 시 목록에서 빠지며,
                  다시 넣으려면 셀렉트에서 선택하세요.
                </p>
              ) : null}
              <div className="ap__row ap__modal-actions">
                <button
                  type="button"
                  className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                  onClick={closeEditModal}
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

      {usageOpen ? (
        <div className="ap__modal-overlay" role="presentation">
          <div className="ap__modal ap__modal--usage" role="dialog" aria-modal="true" aria-labelledby="pmssn-usage-title">
            <div className="ap__row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 id="pmssn-usage-title" style={{ margin: 0 }}>
                {usageTitle()}
              </h3>
              <div className="ap__row">
                {usageStack.length > 0 ? (
                  <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={goBackUsage}>
                    뒤로가기
                  </button>
                ) : null}
                <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={() => setUsageOpen(false)}>
                  닫기
                </button>
              </div>
            </div>
            {usageError ? <p className="ap__error">{usageError}</p> : null}
            {usageLoading ? (
              <p className="ap__hint">불러오는 중…</p>
            ) : (
              <div className="ap__usage-wrap">
                <table className="ap__table ap__usage-table">
                  <thead>
                    <tr>
                      <th>프로젝트명</th>
                      <th>사용자명</th>
                      <th>사용자 부서</th>
                      <th className="ap__th-actions">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row) => {
                      const key = String(row.key)
                      const inEdit = memberEditKey === key && usageView !== 'usage'
                      return (
                        <tr key={key}>
                          <td>{row.project_name}</td>
                          <td>{row.user_name}</td>
                          <td className="ap__td-muted">{row.user_department_display || '—'}</td>
                          <td>
                            {usageView === 'usage' ? (
                              <span className="ap__cell-actions ap__cell-actions--usage-nav">
                                <button
                                  type="button"
                                  className="ibank-btn-table"
                                  disabled={usageBusy}
                                  onClick={() =>
                                    moveToProjectParticipants(row.project_info_id, row.project_name)
                                  }
                                >
                                  프로젝트
                                </button>
                                <button
                                  type="button"
                                  className="ibank-btn-table"
                                  disabled={usageBusy}
                                  onClick={() => moveToUserUsages(row.ptcpnt_user_id, row.user_name)}
                                >
                                  권한
                                </button>
                              </span>
                            ) : inEdit ? (
                              <span className="ap__cell-actions">
                                <select
                                  className="ap__select"
                                  value={memberEditRoleId}
                                  onChange={(ev) => setMemberEditRoleId(ev.target.value)}
                                >
                                  {roleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="ibank-btn-table ibank-btn-table--primary"
                                  disabled={usageBusy}
                                  onClick={() => handleSaveParticipantRole(row)}
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  className="ibank-btn-table"
                                  disabled={usageBusy}
                                  onClick={() => {
                                    setMemberEditKey('')
                                    setMemberEditRoleId('')
                                  }}
                                >
                                  취소
                                </button>
                              </span>
                            ) : (
                              <span className="ap__cell-actions">
                                <button
                                  type="button"
                                  className="ibank-btn-table"
                                  disabled={usageBusy}
                                  onClick={() => {
                                    setMemberEditKey(key)
                                    setMemberEditRoleId(String(row.pmssn_master_id || usageRole?.pmssn_master_id || ''))
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  className="ibank-btn-table ibank-btn-table--danger"
                                  disabled={usageBusy}
                                  onClick={() => handleRemoveParticipant(row)}
                                >
                                  x
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {usageRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ap__hint">
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
