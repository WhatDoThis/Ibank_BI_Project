/**
 * app/AdminOrgPage.jsx (부서 정보 — super_admin·sa_dev)
 * ===================================================
 * GET/PATCH /api/admin/org — 소속 부서명 수정.
 *
 * [Main Functions]
 * ===========
 * - AdminOrgPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient
 */

import { useCallback, useEffect, useState } from 'react'

import { getAdminOrg, patchAdminOrg } from '@/shared/api/adminClient.js'

import './admin-org.css'

export default function AdminOrgPage() {
  const [name, setName] = useState('')
  const [dptmtId, setDptmtId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = useCallback(async () => {
    setError('')
    setOk('')
    setLoading(true)
    try {
      const data = await getAdminOrg()
      setName(data?.dptmt_name || '')
      setDptmtId(data?.dptmt_info_id ?? null)
    } catch (e) {
      setError(e?.message || '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    try {
      await patchAdminOrg({ dptmt_name: name.trim() })
      setOk('저장되었습니다.')
      await load()
    } catch (e) {
      setError(e?.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-org">
      <h1 className="admin-org__title">부서 관리</h1>
      <p className="admin-org__hint">소속 부서 이름을 변경합니다. (슈퍼어드민·SA_DEV)</p>
      {loading ? (
        <p className="admin-org__meta">불러오는 중…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {dptmtId != null ? (
            <p className="admin-org__meta">부서 ID: {dptmtId}</p>
          ) : null}
          <label className="admin-org__label">
            부서명
            <input
              type="text"
              className="admin-org__input"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              maxLength={100}
              required
            />
          </label>
          {error ? <p className="admin-org__error">{error}</p> : null}
          {ok ? <p className="admin-org__ok">{ok}</p> : null}
          <button type="submit" className="admin-org__submit" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </form>
      )}
    </div>
  )
}
