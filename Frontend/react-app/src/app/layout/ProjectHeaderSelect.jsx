/**
 * app/layout/ProjectHeaderSelect.jsx (헤더 작업 프로젝트 선택)
 * ==============================================
 * GET /api/projects 목록으로 `<select>` 구성. POST select 후 refreshMe. 참여 프로젝트 없으면 고정 문구.
 *
 * [Main Functions]
 * ===========
 * - ProjectHeaderSelect
 *
 * [Dependencies]
 * =========
 * - shared/api/authClient (getProjects, postSelectProject)
 * - shared/auth/tokenStorage, jwtUtils (parseJwtPayload)
 * - app/auth/AuthContext (refreshMe)
 */

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { getProjects, postSelectProject } from '@/shared/api/authClient.js'
import { parseJwtPayload } from '@/shared/auth/jwtUtils.js'
import { getAccessToken } from '@/shared/auth/tokenStorage.js'

import './project-header-select.css'

function currentTokenProjectId() {
  const p = parseJwtPayload(getAccessToken())
  if (p?.project_info_id == null || p?.project_info_id === '') return ''
  return String(p.project_info_id)
}

export function ProjectHeaderSelect() {
  const { refreshMe } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProjects()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tokenPid = currentTokenProjectId()
  const pidInList = items.some((row) => String(row.project_info_id) === tokenPid)
  const needsPlaceholder = !tokenPid || !pidInList
  const selectValue = needsPlaceholder ? '' : tokenPid

  async function handleChange(e) {
    const v = e.target.value
    if (!v) return
    const pid = Number(v)
    if (Number.isNaN(pid) || String(pid) === tokenPid) return
    setBusy(true)
    try {
      await postSelectProject(pid)
      await refreshMe()
    } catch (err) {
      window.alert(err?.message || '프로젝트 전환에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <span className="phs phs--muted">프로젝트 목록 불러오는 중…</span>
  }

  if (items.length === 0) {
    return <span className="phs phs--empty">참여중인 프로젝트 없음</span>
  }

  return (
    <div className="phs">
      <label className="phs__label">
        <span className="phs__text">작업 프로젝트</span>
        <select
          className="phs__select"
          value={selectValue}
          onChange={handleChange}
          disabled={busy}
          aria-label="작업 프로젝트 선택"
        >
          {needsPlaceholder ? <option value="">프로젝트 선택</option> : null}
          {items.map((row) => (
            <option key={row.project_info_id} value={String(row.project_info_id)}>
              {row.project_name}
              {row.role_name ? ` (${row.role_name})` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
