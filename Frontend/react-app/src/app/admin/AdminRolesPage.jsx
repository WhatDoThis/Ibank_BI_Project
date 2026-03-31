/**
 * app/admin/AdminRolesPage.jsx (권한 관리·사용현황 드릴다운)
 * ===============================================
 * 권한 생성/수정/삭제와 사용현황 모달(프로젝트·사용자 드릴다운)을 제공한다.
 *
 * [Main Functions]
 * ===========
 * - AdminRolesPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, shared/utils/crudConfirm
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

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

import './admin-pages.css'

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

function normalizeUsageRows(data) {
  const rows = Array.isArray(data?.items) ? data.items : []
  return rows.map((row, idx) => ({
    key: String(row?.id || `${row?.project_info_id || ''}-${row?.ptcpnt_user_id || ''}-${idx}`),
    project_info_id: row?.project_info_id,
    project_name: row?.project_name || '-',
    ptcpnt_user_id: row?.ptcpnt_user_id,
    user_name: row?.user_name || row?.user_nickname || row?.user_email || '-',
    pmssn_master_id: row?.pmssn_master_id,
    pmssn_name: row?.pmssn_name || '-',
  }))
}

export default function AdminRolesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [permissionOptions, setPermissionOptions] = useState([])
  const [selectedPermission, setSelectedPermission] = useState('')
  const [newName, setNewName] = useState('')
  const [newPmssnList, setNewPmssnList] = useState([])

  const [edit, setEdit] = useState(null)
  const [editName, setEditName] = useState('')
  const [editList, setEditList] = useState('')

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

  async function handleCreate(e) {
    e.preventDefault()
    if (!confirmCrud('프로젝트 권한을 생성할까요?')) return
    setError('')
    try {
      await postAdminRole({
        pmssn_name: newName.trim(),
        pmssn_list: newPmssnList,
      })
      setNewName('')
      setNewPmssnList([])
      await load()
    } catch (e) {
      setError(e?.message || '생성 실패')
    }
  }

  function openEdit(row) {
    if (isSystem(row)) return
    setEdit(row.pmssn_master_id)
    setEditName(row.pmssn_name || '')
    setEditList(formatPmssnList(row.pmssn_list))
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (edit == null) return
    setBusyId(edit)
    setError('')
    try {
      await putAdminRole(edit, {
        pmssn_name: editName.trim(),
        pmssn_list: parsePmssnInput(editList),
      })
      setEdit(null)
      await load()
    } catch (e) {
      setError(e?.message || '수정 실패')
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
      <h1 className="ap__title">권한 관리</h1>
      <p className="ap__hint">
        시스템 기본 권한은 조회만 가능합니다. 부서 전용 권한은 권한명과 권한 상세 목록을 지정해 생성할 수 있습니다.
      </p>
      {error ? <p className="ap__error">{error}</p> : null}

      <div className="ap__form-block">
        <h3>프로젝트 권한 생성</h3>
        <form onSubmit={handleCreate}>
          <label className="ap__label">
            권한명
            <input
              className="ap__input"
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              required
              maxLength={100}
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
              >
                {permissionOptions.length === 0 ? <option value="">선택 가능한 항목이 없습니다.</option> : null}
                {permissionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} {opt.label && opt.label !== opt.value ? `- ${opt.label}` : ''}
                  </option>
                ))}
              </select>
              <button type="button" className="ap__btn" onClick={addPermissionToNewList}>
                추가
              </button>
            </div>
          </label>

          <div className="ap__chips">
            {newPmssnList.length === 0 ? <span className="ap__hint">선택된 권한 상세가 없습니다.</span> : null}
            {newPmssnList.map((value) => (
              <span key={value} className="ap__chip">
                {value}
                <button type="button" className="ap__chip-remove" onClick={() => removePermissionFromNewList(value)}>
                  x
                </button>
              </span>
            ))}
          </div>

          <button type="submit" className="ap__btn ap__btn--primary">
            생성
          </button>
        </form>
      </div>

      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead>
              <tr>
                <th>권한명</th>
                <th>권한상세목록</th>
                <th>사용현황</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const id = row.pmssn_master_id
                const sys = isSystem(row)
                const usageCount = Number(row?.usage_count || 0)
                const inUse = usageCount > 0
                return (
                  <tr key={String(id)}>
                    <td>{row.pmssn_name || '—'}</td>
                    <td className="ap__mono">{formatPmssnList(row.pmssn_list)}</td>
                    <td>
                      {inUse ? (
                        <span className="ap__row" style={{ alignItems: 'center' }}>
                          <span>사용중</span>
                          <button type="button" className="ap__btn" onClick={() => openUsageModal(row)}>
                            목록
                          </button>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {sys ? (
                        '—'
                      ) : (
                        <span className="ap__row">
                          <button
                            type="button"
                            className="ap__btn"
                            disabled={busyId != null}
                            onClick={() => openEdit(row)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="ap__btn ap__btn--danger"
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
      )}

      {edit != null ? (
        <div className="ap__modal-overlay" role="presentation">
          <div className="ap__modal" role="dialog" aria-modal="true" aria-labelledby="pmssn-edit-title">
            <h3 id="pmssn-edit-title">권한 수정</h3>
            <form onSubmit={handleSaveEdit}>
              <label className="ap__label">
                권한명
                <input
                  className="ap__input"
                  value={editName}
                  onChange={(ev) => setEditName(ev.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label className="ap__label">
                권한상세목록 (쉼표 또는 줄바꿈)
                <textarea
                  className="ap__textarea"
                  value={editList}
                  onChange={(ev) => setEditList(ev.target.value)}
                />
              </label>
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

      {usageOpen ? (
        <div className="ap__modal-overlay" role="presentation">
          <div className="ap__modal ap__modal--usage" role="dialog" aria-modal="true" aria-labelledby="pmssn-usage-title">
            <div className="ap__row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 id="pmssn-usage-title" style={{ margin: 0 }}>
                {usageTitle()}
              </h3>
              <div className="ap__row">
                {usageStack.length > 0 ? (
                  <button type="button" className="ap__btn" onClick={goBackUsage}>
                    뒤로가기
                  </button>
                ) : null}
                <button type="button" className="ap__btn" onClick={() => setUsageOpen(false)}>
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
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row) => {
                      const key = String(row.key)
                      const inEdit = memberEditKey === key && usageView !== 'usage'
                      return (
                        <tr key={key}>
                          <td>
                            {usageView === 'usage' ? (
                              <button
                                type="button"
                                className="ap__btn ap__btn--link"
                                onClick={() => moveToProjectParticipants(row.project_info_id, row.project_name)}
                              >
                                {row.project_name}
                              </button>
                            ) : (
                              row.project_name
                            )}
                          </td>
                          <td>
                            {usageView === 'usage' ? (
                              <button
                                type="button"
                                className="ap__btn ap__btn--link"
                                onClick={() => moveToUserUsages(row.ptcpnt_user_id, row.user_name)}
                              >
                                {row.user_name}
                              </button>
                            ) : (
                              row.user_name
                            )}
                          </td>
                          <td>
                            {usageView === 'usage' ? (
                              '-'
                            ) : inEdit ? (
                              <span className="ap__row">
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
                                  className="ap__btn ap__btn--primary"
                                  disabled={usageBusy}
                                  onClick={() => handleSaveParticipantRole(row)}
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  className="ap__btn"
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
                              <span className="ap__row">
                                <button
                                  type="button"
                                  className="ap__btn"
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
                                  className="ap__btn ap__btn--danger"
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
                        <td colSpan={3} className="ap__hint">
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
