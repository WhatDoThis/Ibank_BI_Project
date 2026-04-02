/**
 * app/admin/AdminOrgPage.jsx (부서 정보 — sa·sa_dev)
 * ===================================================
 * GET /api/admin/org — 내 소속 부서명·코드 표시(읽기 전용).
 * GET/POST/PATCH/DELETE /api/admin/org/departments — 목록·추가·수정(사용여부 포함)·행 삭제(DB 삭제).
 * 부서 목록: 부서구분(상위·하위) 열, 상위 부서 없으면 상위 부서 칸은 「—」. SA는 본인 소속 행 수정·삭제 UI 비표시(백엔드 동일 정책).
 * 사용 안 함 저장 시 소속 사용자가 있으면 이관 대상 부서 선택 모달(사용 중 부서만·display_label).
 *
 * [Main Functions]
 * ===========
 * - AdminOrgPage, formatParentCell, deptKindLabel
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, app/auth/AuthContext, shared/utils/crudConfirm
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  getAdminOrg,
  getAdminOrgDepartments,
  postAdminOrgDepartment,
  patchAdminOrgDepartment,
  deleteAdminOrgDepartment,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'

import './admin-org.css'

function formatParentCell(d) {
  const pid = d.parent_dptmt_info_id
  if (pid == null || pid === '' || Number(pid) === 0) {
    return '—'
  }
  const pname = d.parent_dptmt_name ?? '—'
  const pcode = d.parent_dptmt_code ?? '—'
  return `${pname} · ${pcode}`
}

/** 상위: 루트 행(parent 없음·0). 하위: 그 외. */
function deptKindLabel(d) {
  const pid = d.parent_dptmt_info_id
  if (pid == null || pid === '' || Number(pid) === 0) return '상위'
  return '하위'
}

function useYnLabel(useYn) {
  const u = (useYn || 'Y').toString().trim().toUpperCase()
  return u === 'N' ? '사용 안 함' : '사용'
}

export default function AdminOrgPage() {
  const { me } = useAuth()
  const rawDvsn = (me?.user_dvsn || '').trim().toLowerCase()
  const isSaDev = rawDvsn === 'sa_dev'
  const isSuperAdmin = rawDvsn === 'sa'

  const [name, setName] = useState('')
  const [myCode, setMyCode] = useState('')
  const [dptmtId, setDptmtId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [departments, setDepartments] = useState([])
  const [deptLoading, setDeptLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState('')
  const [addParentId, setAddParentId] = useState('')
  const [addName, setAddName] = useState('')
  const [addCode, setAddCode] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editUseYn, setEditUseYn] = useState('Y')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const [migrateOpen, setMigrateOpen] = useState(false)
  const [migrateTargetId, setMigrateTargetId] = useState('')
  const [migrateBusy, setMigrateBusy] = useState(false)
  const [migrateError, setMigrateError] = useState('')

  const visibleDepartments = useMemo(
    () => departments.filter((d) => Number(d?.dptmt_info_id) !== 0),
    [departments],
  )

  /** 사용 안 함 전 사용자 이관: 사용 중이며 비활성화 대상이 아닌 부서만 */
  const migrateDeptOptions = useMemo(() => {
    if (!editRow) return []
    const sid = Number(editRow.dptmt_info_id)
    return visibleDepartments
      .filter((d) => {
        const u = (d.use_yn || 'Y').toString().trim().toUpperCase()
        return u !== 'N' && Number(d.dptmt_info_id) !== sid
      })
      .sort((a, b) =>
        String(a.display_label || a.dptmt_name || '').localeCompare(
          String(b.display_label || b.dptmt_name || ''),
          'ko',
        ),
      )
  }, [visibleDepartments, editRow])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminOrg()
      setName(data?.dptmt_name || '')
      setMyCode(data?.dptmt_code || '')
      setDptmtId(data?.dptmt_info_id ?? null)
    } catch {
      setName('')
      setMyCode('')
      setDptmtId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    setDeptLoading(true)
    try {
      const data = await getAdminOrgDepartments()
      setDepartments(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setDepartments([])
    } finally {
      setDeptLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  function openAddModal() {
    setAddError('')
    setAddName('')
    setAddCode('')
    if (isSaDev) {
      setAddKind('')
      setAddParentId('')
    }
    setAddOpen(true)
  }

  function closeAddModal() {
    setAddOpen(false)
  }

  async function submitAdd(e) {
    e.preventDefault()
    setAddError('')
    const n = addName.trim()
    if (!n) {
      setAddError('부서명을 입력하세요.')
      return
    }
    if (isSaDev) {
      if (addKind === '') {
        setAddError('추가 유형을 선택하세요.')
        return
      }
      if (addKind === 'child') {
        if (addParentId === '') {
          setAddError('상위 부서를 선택하세요.')
          return
        }
        const pid = Number(addParentId)
        if (!Number.isFinite(pid)) {
          setAddError('상위 부서가 올바르지 않습니다.')
          return
        }
        const parentRow = visibleDepartments.find(
          (x) => Number(x.dptmt_info_id) === pid,
        )
        const pLabel =
          parentRow?.dptmt_name ||
          parentRow?.dptmt_code ||
          '선택한 상위 부서'
        if (
          !confirmCrud(
            `하위 부서 "${n}"을(를) 상위 "${pLabel}" 아래에 추가할까요?`,
          )
        ) {
          return
        }
        setAddBusy(true)
        try {
          await postAdminOrgDepartment({
            dptmt_name: n,
            parent_dptmt_info_id: pid,
            dptmt_code: addCode.trim() || null,
          })
          closeAddModal()
          await loadDepartments()
          await load()
        } catch (err) {
          setAddError(err?.message || '추가 실패')
        } finally {
          setAddBusy(false)
        }
        return
      }
      if (!confirmCrud(`최상위 부서 "${n}"을(를) 추가할까요?`)) return
      setAddBusy(true)
      try {
        await postAdminOrgDepartment({
          dptmt_name: n,
          parent_dptmt_info_id: null,
          dptmt_code: addCode.trim() || null,
        })
        closeAddModal()
        await loadDepartments()
        await load()
      } catch (err) {
        setAddError(err?.message || '추가 실패')
      } finally {
        setAddBusy(false)
      }
      return
    }
    if (!isSuperAdmin || dptmtId == null || Number(dptmtId) === 0) {
      setAddError('부서 정보를 불러올 수 없습니다.')
      return
    }
    if (
      !confirmCrud(
        `본인 소속 부서 "${name || '—'}" 아래에 하위 부서 "${n}"을(를) 추가할까요?`,
      )
    ) {
      return
    }
    setAddBusy(true)
    try {
      await postAdminOrgDepartment({
        dptmt_name: n,
        parent_dptmt_info_id: Number(dptmtId),
        dptmt_code: addCode.trim() || null,
      })
      closeAddModal()
      await loadDepartments()
      await load()
    } catch (err) {
      setAddError(err?.message || '추가 실패')
    } finally {
      setAddBusy(false)
    }
  }

  function openEditModal(row) {
    if (
      isSuperAdmin &&
      !isSaDev &&
      dptmtId != null &&
      Number(row?.dptmt_info_id) === Number(dptmtId)
    ) {
      return
    }
    setEditError('')
    setEditRow(row)
    setEditName(String(row?.dptmt_name ?? ''))
    setEditCode(String(row?.dptmt_code ?? ''))
    const u = (row?.use_yn || 'Y').toString().trim().toUpperCase()
    setEditUseYn(u === 'N' ? 'N' : 'Y')
    setEditOpen(true)
  }

  function closeEditModal() {
    setEditOpen(false)
    setEditRow(null)
    setMigrateOpen(false)
    setMigrateTargetId('')
    setMigrateError('')
  }

  function closeMigrateModal() {
    setMigrateOpen(false)
    setMigrateTargetId('')
    setMigrateError('')
  }

  async function runPatchEdit(extra = {}) {
    if (!editRow) return
    const id = editRow.dptmt_info_id
    const n = editName.trim()
    const c = editCode.trim()
    setEditBusy(true)
    setEditError('')
    try {
      await patchAdminOrgDepartment(id, {
        dptmt_name: n,
        dptmt_code: c,
        use_yn: editUseYn,
        ...extra,
      })
      closeEditModal()
      await loadDepartments()
      await load()
    } catch (err) {
      setEditError(err?.message || '수정 실패')
    } finally {
      setEditBusy(false)
    }
  }

  async function submitMigrateModal(e) {
    e.preventDefault()
    if (!editRow) return
    const pid = Number(migrateTargetId)
    if (!pid) {
      setMigrateError('사용자를 옮길 부서를 선택하세요.')
      return
    }
    setMigrateError('')
    setMigrateBusy(true)
    try {
      await patchAdminOrgDepartment(editRow.dptmt_info_id, {
        dptmt_name: editName.trim(),
        dptmt_code: editCode.trim(),
        use_yn: 'N',
        migrate_users_to_dptmt_info_id: pid,
      })
      closeMigrateModal()
      closeEditModal()
      await loadDepartments()
      await load()
    } catch (err) {
      setMigrateError(err?.message || '처리 실패')
    } finally {
      setMigrateBusy(false)
    }
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editRow) return
    if (
      isSuperAdmin &&
      !isSaDev &&
      dptmtId != null &&
      Number(editRow.dptmt_info_id) === Number(dptmtId)
    ) {
      setEditError('본인 소속(상위) 부서는 수정할 수 없습니다.')
      return
    }
    setEditError('')
    const n = editName.trim()
    const c = editCode.trim()
    if (!n) {
      setEditError('부서명을 입력하세요.')
      return
    }
    if (!c) {
      setEditError('부서 코드를 입력하세요.')
      return
    }
    const id = editRow.dptmt_info_id
    if (Number(id) === 0) {
      setEditError('해당 부서는 수정할 수 없습니다.')
      return
    }
    if (
      !confirmCrud(
        `부서 "${n}" 정보를 저장할까요?`,
      )
    ) {
      return
    }
    const wasY = (editRow.use_yn || 'Y').toString().trim().toUpperCase() !== 'N'
    const goingN = editUseYn === 'N'
    const mc = Number(editRow.member_count ?? 0)
    if (goingN && wasY && mc > 0) {
      setMigrateError('')
      setMigrateTargetId('')
      setMigrateOpen(true)
      return
    }
    await runPatchEdit({})
  }

  async function handleDeleteRow(row) {
    if (
      isSuperAdmin &&
      !isSaDev &&
      dptmtId != null &&
      Number(row?.dptmt_info_id) === Number(dptmtId)
    ) {
      return
    }
    const id = row.dptmt_info_id
    if (Number(id) === 0) return
    const label = row.dptmt_name || row.dptmt_code || '부서'
    if (
      !confirmCrud(
        `부서 "${label}"을(를) DB에서 완전히 삭제할까요? 하위 부서나 소속 사용자가 있으면 삭제되지 않습니다. 삭제 대신 비활성화만 하려면 수정에서「사용 안 함」을 선택하세요.`,
      )
    ) {
      return
    }
    try {
      await deleteAdminOrgDepartment(id)
      await loadDepartments()
      await load()
    } catch (err) {
      window.alert(err?.message || '삭제 실패')
    }
  }

  const listTitle = isSaDev ? '전체 부서 목록' : '소속 부서 트리'
  const canManageDept = isSaDev || isSuperAdmin

  /** SA는 본인 소속 부서 행만 수정·삭제 불가(sa_dev는 전 행 가능). */
  const canManageDeptRow = useCallback(
    (row) => {
      if (!canManageDept) return false
      if (isSaDev) return true
      if (
        isSuperAdmin &&
        dptmtId != null &&
        Number(row?.dptmt_info_id) === Number(dptmtId)
      ) {
        return false
      }
      return true
    },
    [canManageDept, isSaDev, isSuperAdmin, dptmtId],
  )

  return (
    <div className="admin-org">
      <h1 className="admin-org__title">부서 관리</h1>
      <p className="admin-org__hint">
        {isSaDev ? (
          <>
            SA_DEV: 조직 전체 부서를 보고, <strong>추가</strong> 시 최상위·하위를 선택할 수 있습니다.
            <strong>수정</strong>에서 사용 여부를 바꿀 수 있고, <strong>삭제</strong>는 DB에서 행을 제거합니다.
          </>
        ) : (
          <>
            Super Admin: <strong>본인 소속 부서를 루트로 한 트리</strong>만 표시됩니다.{' '}
            <strong>추가</strong> 시 상위는 본인 부서로 고정됩니다.{' '}
            <strong>본인 소속(상위) 부서 행은 수정·삭제할 수 없고</strong>, 그 아래 하위 부서만 관리할 수 있습니다. 부서 번호 0은 목록에 나오지 않습니다.
          </>
        )}
      </p>

      {loading ? (
        <p className="admin-org__meta">불러오는 중…</p>
      ) : (
        <section className="admin-org__card" aria-label="내 소속 부서">
          <h2 className="admin-org__section-title">내 소속 부서</h2>
          <p className="admin-org__meta">
            {isSaDev ? (
              <>
                목록에서 해당 부서의 이름·코드·사용 여부는 <strong>수정</strong> 버튼으로 변경할 수 있습니다.
              </>
            ) : (
              <>
                목록에서 <strong>하위 부서</strong>의 이름·코드·사용 여부만 <strong>수정</strong>할 수 있습니다. 본인 소속 부서는 이 카드에서 확인만 하세요.
              </>
            )}
          </p>
          <div className="admin-org__readonly-grid">
            <div>
              <span className="admin-org__readonly-label">부서명</span>
              <p className="admin-org__readonly-value">{name || '—'}</p>
            </div>
            <div>
              <span className="admin-org__readonly-label">부서 코드</span>
              <p className="admin-org__readonly-value admin-org__mono">{myCode || '—'}</p>
            </div>
          </div>
        </section>
      )}

      <section className="admin-org__card admin-org__card--wide" aria-label="부서 목록">
        <div className="admin-org__table-head">
          <h2 className="admin-org__section-title admin-org__section-title--inline">{listTitle}</h2>
          {canManageDept ? (
            <button
              type="button"
              className="admin-org__toolbar-add"
              onClick={openAddModal}
            >
              부서 추가
            </button>
          ) : null}
        </div>
        {deptLoading ? (
          <p className="admin-org__meta">목록 불러오는 중…</p>
        ) : visibleDepartments.length === 0 ? (
          <p className="admin-org__meta">등록된 부서가 없습니다.</p>
        ) : (
          <div className="admin-org__table-wrap">
            <table className="admin-org__table">
              <thead>
                <tr>
                  <th>부서구분</th>
                  <th>코드</th>
                  <th>부서명</th>
                  <th>상위 부서 (이름 · 코드)</th>
                  <th>사용 여부</th>
                  {canManageDept ? <th className="admin-org__th-actions">작업</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.map((d) => (
                  <tr
                    key={String(d.dptmt_info_id)}
                    className={
                      (d.use_yn || 'Y').toString().trim().toUpperCase() === 'N'
                        ? 'admin-org__row--inactive'
                        : ''
                    }
                  >
                    <td>
                      <span
                        className={
                          deptKindLabel(d) === '상위'
                            ? 'admin-org__dept-kind admin-org__dept-kind--parent'
                            : 'admin-org__dept-kind admin-org__dept-kind--child'
                        }
                      >
                        {deptKindLabel(d)}
                      </span>
                    </td>
                    <td className="admin-org__mono">{d.dptmt_code ?? '—'}</td>
                    <td>{d.dptmt_name ?? '—'}</td>
                    <td className="admin-org__parent-cell">{formatParentCell(d)}</td>
                    <td>{useYnLabel(d.use_yn)}</td>
                    {canManageDept ? (
                      <td className="admin-org__actions">
                        {canManageDeptRow(d) ? (
                          <>
                            <button
                              type="button"
                              className="admin-org__btn-inline"
                              onClick={() => openEditModal(d)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="admin-org__btn-inline admin-org__btn-inline--danger"
                              onClick={() => handleDeleteRow(d)}
                            >
                              삭제
                            </button>
                          </>
                        ) : (
                          <span className="admin-org__meta admin-org__meta--inline">
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen && (
        <div
          className="admin-org__modal-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeAddModal()
          }}
        >
          <div
            className="admin-org__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-org-add-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                submitAdd(ev)
              }}
            >
            <h3 id="admin-org-add-title">부서 추가</h3>
            {isSaDev ? (
              <>
                <label className="admin-org__label">
                  추가 유형
                  <select
                    className="admin-org__input admin-org__select"
                    value={addKind}
                    onChange={(ev) => {
                      setAddKind(ev.target.value)
                      if (ev.target.value !== 'child') setAddParentId('')
                    }}
                  >
                    <option value="">— 선택 —</option>
                    <option value="root">최상위 부서 (루트)</option>
                    <option value="child">하위 부서 (상위 지정)</option>
                  </select>
                </label>
                {addKind === 'child' ? (
                  <label className="admin-org__label">
                    상위 부서
                    <select
                      className="admin-org__input admin-org__select"
                      value={addParentId}
                      onChange={(ev) => setAddParentId(ev.target.value)}
                    >
                      <option value="">— 상위 부서 선택 —</option>
                      {visibleDepartments.map((d) => (
                        <option
                          key={String(d.dptmt_info_id)}
                          value={String(d.dptmt_info_id)}
                        >
                          {d.display_label || d.dptmt_name || '—'} · {d.dptmt_code || '—'}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : (
              <p className="admin-org__meta">
                상위 부서: <strong>{name || '—'}</strong>
                {myCode ? ` · ${myCode}` : ''}
              </p>
            )}
            <label className="admin-org__label">
              {isSuperAdmin && !isSaDev ? '하위 부서명' : '부서명'}
              <input
                type="text"
                className="admin-org__input"
                value={addName}
                onChange={(ev) => setAddName(ev.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label className="admin-org__label">
              부서 코드 (선택, 미입력 시 자동)
              <input
                type="text"
                className="admin-org__input"
                value={addCode}
                onChange={(ev) => setAddCode(ev.target.value)}
                maxLength={80}
              />
            </label>
            {addError ? <p className="admin-org__error">{addError}</p> : null}
            <div className="admin-org__modal-actions">
              <button
                type="button"
                className="admin-org__btn-inline"
                onClick={closeAddModal}
                disabled={addBusy}
              >
                취소
              </button>
              <button
                type="submit"
                className="admin-org__submit"
                disabled={addBusy}
              >
                {addBusy ? '처리 중…' : '추가'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && editRow ? (
        <div
          className="admin-org__modal-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeEditModal()
          }}
        >
          <div
            className="admin-org__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-org-edit-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                submitEdit(ev)
              }}
            >
            <h3 id="admin-org-edit-title">부서 수정</h3>
            <label className="admin-org__label">
              부서명
              <input
                type="text"
                className="admin-org__input"
                value={editName}
                onChange={(ev) => setEditName(ev.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label className="admin-org__label">
              부서 코드
              <input
                type="text"
                className="admin-org__input"
                value={editCode}
                onChange={(ev) => setEditCode(ev.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label className="admin-org__label">
              사용 여부
              <select
                className="admin-org__input admin-org__select"
                value={editUseYn}
                onChange={(ev) => setEditUseYn(ev.target.value)}
              >
                <option value="Y">사용</option>
                <option value="N">사용 안 함</option>
              </select>
            </label>
            {editError ? <p className="admin-org__error">{editError}</p> : null}
            <div className="admin-org__modal-actions">
              <button
                type="button"
                className="admin-org__btn-inline"
                onClick={closeEditModal}
                disabled={editBusy}
              >
                취소
              </button>
              <button
                type="submit"
                className="admin-org__submit"
                disabled={editBusy}
              >
                {editBusy ? '저장 중…' : '저장'}
              </button>
            </div>
            </form>
          </div>
        </div>
      ) : null}

      {migrateOpen && editRow ? (
        <div
          className="admin-org__modal-overlay admin-org__modal-overlay--stack"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !migrateBusy) closeMigrateModal()
          }}
        >
          <div
            className="admin-org__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-org-migrate-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <form onSubmit={submitMigrateModal}>
              <h3 id="admin-org-migrate-title">소속 사용자 이관</h3>
              <p className="admin-org__meta">
                「{editRow.dptmt_name || '—'}」에 소속 사용자{' '}
                <strong>{Number(editRow.member_count ?? 0)}명</strong>이 있어 사용 안 함 처리 전에 다른 부서로
                옮겨야 합니다. 사용 중인 부서만 선택할 수 있습니다.
              </p>
              {migrateDeptOptions.length === 0 ? (
                <p className="admin-org__error">
                  사용 중인 다른 부서가 없어 이관할 수 없습니다. 사용자를 수동으로 옮긴 뒤 다시 시도하세요.
                </p>
              ) : (
                <label className="admin-org__label">
                  이관할 부서
                  <select
                    className="admin-org__input admin-org__select"
                    value={migrateTargetId}
                    onChange={(ev) => setMigrateTargetId(ev.target.value)}
                    required
                  >
                    <option value="">— 부서 선택 —</option>
                    {migrateDeptOptions.map((d) => (
                      <option key={String(d.dptmt_info_id)} value={String(d.dptmt_info_id)}>
                        {d.display_label || d.dptmt_name || d.dptmt_info_id}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {migrateError ? <p className="admin-org__error">{migrateError}</p> : null}
              <div className="admin-org__modal-actions">
                <button
                  type="button"
                  className="admin-org__btn-inline"
                  onClick={closeMigrateModal}
                  disabled={migrateBusy}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="admin-org__submit"
                  disabled={migrateBusy || migrateDeptOptions.length === 0}
                >
                  {migrateBusy ? '처리 중…' : '이관 후 사용 안 함'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
