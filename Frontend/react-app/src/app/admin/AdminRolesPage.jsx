/**
 * app/admin/AdminRolesPage.jsx (역할 목록·커스텀 CRUD)
 * ===========================================
 * GET/POST/PUT/DELETE /api/admin/roles — 시스템 기본 역할은 읽기 전용.
 *
 * [Main Functions]
 * ===========
 * - AdminRolesPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, shared/utils/crudConfirm
 */

import { useCallback, useEffect, useState } from 'react'

import {
  deleteAdminRole,
  getAdminRoles,
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

export default function AdminRolesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [newName, setNewName] = useState('')
  const [newList, setNewList] = useState('report.read\ndashboard\nwidgetboard')

  const [edit, setEdit] = useState(null)
  const [editName, setEditName] = useState('')
  const [editList, setEditList] = useState('')

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

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!confirmCrud('커스텀 역할을 추가할까요?')) return
    setError('')
    try {
      await postAdminRole({
        pmssn_name: newName.trim(),
        pmssn_list: parsePmssnInput(newList),
      })
      setNewName('')
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
    if (!confirmCrud('이 커스텀 역할을 삭제할까요?')) return
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

  return (
    <div className="ap">
      <h1 className="ap__title">역할 관리</h1>
      <p className="ap__hint">
        시스템 기본 역할은 조회만 가능합니다. 부서 전용 역할은 이름·권한 ID 목록(report.read, dashboard 등)을
        설정해 추가할 수 있습니다.
      </p>
      {error ? <p className="ap__error">{error}</p> : null}

      <div className="ap__form-block">
        <h3>커스텀 역할 추가</h3>
        <form onSubmit={handleCreate}>
          <label className="ap__label">
            역할명
            <input
              className="ap__input"
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="ap__label">
            권한 ID (쉼표 또는 줄바꿈)
            <textarea
              className="ap__textarea"
              value={newList}
              onChange={(ev) => setNewList(ev.target.value)}
              placeholder="report.read"
            />
          </label>
          <button type="submit" className="ap__btn ap__btn--primary">
            추가
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
                <th>이름</th>
                <th>구분</th>
                <th>권한</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const id = row.pmssn_master_id
                const sys = isSystem(row)
                return (
                  <tr key={String(id)}>
                    <td>{row.pmssn_name || '—'}</td>
                    <td>{sys ? '시스템' : '커스텀'}</td>
                    <td className="ap__mono">{formatPmssnList(row.pmssn_list)}</td>
                    <td>
                      {sys ? (
                        '—'
                      ) : (
                        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <div className="ap__modal" role="dialog" aria-modal="true" aria-labelledby="role-edit-title">
            <h3 id="role-edit-title">역할 수정</h3>
            <form onSubmit={handleSaveEdit}>
              <label className="ap__label">
                역할명
                <input
                  className="ap__input"
                  value={editName}
                  onChange={(ev) => setEditName(ev.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label className="ap__label">
                권한 ID
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
    </div>
  )
}
