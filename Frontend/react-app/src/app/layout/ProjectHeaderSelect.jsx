/**
 * app/layout/ProjectHeaderSelect.jsx (헤더 작업 프로젝트 선택)
 * ==============================================
 * GET /api/projects 목록: participatingProjectsNonce·projectContextNonce·pathname 변경 시 재조회. POST select 후 refreshMe.
 * 네이티브 select 대신 커스텀 드롭다운(옵션 목록·스크롤 영역 브랜드 톤 스타일).
 * 이전 요청이 늦게 와서 최신 목록을 덮어쓰지 않도록 effect cleanup(cancelled)로 무시한다.
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

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

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
  const { refreshMe, participatingProjectsNonce, projectContextNonce } = useAuth()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await getProjects()
        if (cancelled) return
        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch {
        if (cancelled) return
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [participatingProjectsNonce, projectContextNonce, location.pathname])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const tokenPid = currentTokenProjectId()
  const pidInList = items.some((row) => String(row.project_info_id) === tokenPid)
  const needsPlaceholder = !tokenPid || !pidInList

  const selectedRow = items.find((row) => String(row.project_info_id) === tokenPid)
  const triggerLabel = selectedRow
    ? `${selectedRow.project_name || ''}${selectedRow.role_name ? ` (${selectedRow.role_name})` : ''}`
    : '프로젝트 선택'

  async function selectProject(pidStr) {
    const pid = Number(pidStr)
    if (Number.isNaN(pid) || String(pid) === tokenPid) {
      setOpen(false)
      return
    }
    setBusy(true)
    setOpen(false)
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
    <div className="phs" ref={rootRef}>
      <div className="phs__label">
        <span className="phs__text" id="phs-label">
          작업 프로젝트
        </span>
        <div className={`phs__combo ${open ? 'phs__combo--open' : ''}`}>
          <button
            type="button"
            className="phs__trigger"
            onClick={() => !busy && setOpen((v) => !v)}
            disabled={busy}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby="phs-label"
            aria-label="작업 프로젝트 선택"
          >
            <span className="phs__trigger-text">{needsPlaceholder ? '프로젝트 선택' : triggerLabel}</span>
            <span className="phs__trigger-chevron" aria-hidden />
          </button>
          {open ? (
            <ul className="phs__list" role="listbox" aria-label="프로젝트 목록">
              {needsPlaceholder ? (
                <li className="phs__item phs__item--placeholder" role="presentation">
                  <span className="phs__item-label phs__item-label--muted">아래에서 프로젝트를 선택하세요</span>
                </li>
              ) : null}
              {items.map((row) => {
                const idStr = String(row.project_info_id)
                const isCurrent = idStr === tokenPid && !needsPlaceholder
                const label = `${row.project_name || idStr}${row.role_name ? ` (${row.role_name})` : ''}`
                return (
                  <li key={idStr} role="none" className={`phs__item ${isCurrent ? 'phs__item--current' : ''}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => selectProject(idStr)}
                    >
                      <span className="phs__item-label">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
