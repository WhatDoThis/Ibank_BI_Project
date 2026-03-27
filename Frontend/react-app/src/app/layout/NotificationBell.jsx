/**
 * app/layout/NotificationBell.jsx (알림 벨 S8)
 * ===================================
 * 미읽음 수 폴링·패널에서 목록·건당 읽음·전체 읽음.
 *
 * [Main Functions]
 * ===========
 * - NotificationBell
 *
 * [Dependencies]
 * =========
 * - shared/api/notificationsClient
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getNotifications,
  getUnreadCount,
  patchReadAll,
  patchReadOne,
} from '@/shared/api/notificationsClient.js'

import './notification-bell.css'

const POLL_MS = 60_000

function formatDtm(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('ko-KR')
  } catch {
    return String(iso)
  }
}

function isUnread(row) {
  const r = (row.read_yn || '').toUpperCase()
  return r !== 'Y'
}

export function NotificationBell() {
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      const data = await getUnreadCount()
      setCount(typeof data?.count === 'number' ? data.count : 0)
    } catch {
      setCount(0)
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications(40)
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, POLL_MS)
    return () => clearInterval(t)
  }, [refreshCount])

  useEffect(() => {
    if (!open) return undefined
    loadList()
    function onDoc(ev) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, loadList])

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      await refreshCount()
      await loadList()
    }
  }

  async function handleReadOne(row) {
    const id = row.notification_info_id
    if (id == null) return
    try {
      await patchReadOne(id)
      await refreshCount()
      await loadList()
    } catch {
      /* ignore */
    }
  }

  async function handleReadAll() {
    try {
      await patchReadAll()
      await refreshCount()
      await loadList()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button
        type="button"
        className="nb-btn"
        aria-label="알림"
        onClick={handleOpen}
      >
        🔔
        {count > 0 ? (
          <span className="nb-badge">{count > 99 ? '99+' : count}</span>
        ) : null}
      </button>
      {open ? (
        <div className="nb-panel" role="dialog" aria-label="알림 목록">
          <div className="nb-panel__head">
            <span>알림</span>
            <button type="button" onClick={handleReadAll}>
              모두 읽음
            </button>
          </div>
          <div className="nb-panel__list">
            {loading ? (
              <div className="nb-empty">불러오는 중…</div>
            ) : items.length === 0 ? (
              <div className="nb-empty">알림이 없습니다.</div>
            ) : (
              items.map((row) => (
                <button
                  key={String(row.notification_info_id)}
                  type="button"
                  className={`nb-item ${isUnread(row) ? 'nb-item--unread' : ''}`}
                  onClick={() => handleReadOne(row)}
                >
                  <div className="nb-item__title">{row.noti_title || '(제목 없음)'}</div>
                  {row.noti_content ? (
                    <div className="nb-item__meta">{row.noti_content}</div>
                  ) : null}
                  <div className="nb-item__meta">{formatDtm(row.create_dtm)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
