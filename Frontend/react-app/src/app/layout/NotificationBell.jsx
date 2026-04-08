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
 * - shared/api/notificationsClient, shared/api/authClient, shared/utils/crudConfirm, app/auth/AuthContext
 * - project_invite: 수락·거절·invite_expires_at 표시·만료 시 버튼 비활성
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { postAcceptProjectInvite, postRejectProjectInvite } from '@/shared/api/authClient.js'
import {
  getNotifications,
  getUnreadCount,
  patchReadAll,
  patchReadOne,
} from '@/shared/api/notificationsClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

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

function parseProjectInvitePayload(raw) {
  try {
    const o = JSON.parse(raw || '{}')
    const pid = o.project_info_id
    const projectId = pid != null ? Number(pid) : null
    const expiresRaw = o.invite_expires_at != null ? String(o.invite_expires_at) : null
    let inviteExpired = false
    if (expiresRaw) {
      const d = new Date(expiresRaw)
      inviteExpired = !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
    }
    return { projectId, expiresAt: expiresRaw, inviteExpired }
  } catch {
    return { projectId: null, expiresAt: null, inviteExpired: false }
  }
}

export function NotificationBell() {
  const { refreshMe } = useAuth()
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
    if (!confirmCrud('모든 알림을 읽음 처리할까요?')) return
    try {
      await patchReadAll()
      await refreshCount()
      await loadList()
    } catch {
      /* ignore */
    }
  }

  async function handleAcceptProjectInvite(row) {
    const nid = row.notification_info_id
    const { projectId: pid, inviteExpired } = parseProjectInvitePayload(row.noti_content)
    if (inviteExpired) {
      window.alert('초대 유효 기간이 지났습니다.')
      return
    }
    if (nid == null || pid == null || Number.isNaN(pid)) {
      window.alert('초대 정보를 확인할 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.')
      return
    }
    if (!confirmCrud('프로젝트 초대를 수락할까요?')) return
    try {
      await postAcceptProjectInvite(pid, { notification_info_id: Number(nid) })
      await refreshMe()
      await refreshCount()
      await loadList()
      window.alert('프로젝트 초대를 수락했습니다. 필요하면 홈에서 해당 프로젝트를 선택하세요.')
    } catch (e) {
      window.alert(e?.message || '수락에 실패했습니다.')
    }
  }

  async function handleRejectProjectInvite(row) {
    const nid = row.notification_info_id
    const { projectId: pid, inviteExpired } = parseProjectInvitePayload(row.noti_content)
    if (inviteExpired) {
      window.alert('초대 유효 기간이 지났습니다.')
      return
    }
    if (nid == null || pid == null || Number.isNaN(pid)) {
      window.alert('초대 정보를 확인할 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.')
      return
    }
    if (
      !confirmCrud(
        '초대를 거절할까요? 초대자에게 거절 알림이 전송되며, 이 알림은 삭제됩니다.',
      )
    )
      return
    try {
      await postRejectProjectInvite(pid, { notification_info_id: Number(nid) })
      await refreshCount()
      await loadList()
      window.alert('초대를 거절했습니다.')
    } catch (e) {
      window.alert(e?.message || '거절 처리에 실패했습니다.')
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
              items.map((row) => {
                const isInvite = (row.noti_type || '').trim() === 'project_invite'
                const inv = isInvite ? parseProjectInvitePayload(row.noti_content) : null
                const invitePid = inv?.projectId
                const expLine =
                  inv?.expiresAt && !Number.isNaN(new Date(inv.expiresAt).getTime())
                    ? `만료: ${formatDtm(inv.expiresAt)}`
                    : null
                const inviteActions =
                  isInvite &&
                  invitePid != null &&
                  !Number.isNaN(invitePid) &&
                  !inv?.inviteExpired
                const inviteExpiredUi = isInvite && inv?.inviteExpired
                return (
                  <div
                    key={String(row.notification_info_id)}
                    className={`nb-item ${isUnread(row) ? 'nb-item--unread' : ''}`}
                  >
                    <button
                      type="button"
                      className="nb-item__main"
                      onClick={() => handleReadOne(row)}
                    >
                      <div className="nb-item__title">{row.noti_title || '(제목 없음)'}</div>
                      {!isInvite && row.noti_content ? (
                        <div className="nb-item__meta">{row.noti_content}</div>
                      ) : null}
                      {isInvite && expLine ? (
                        <div className="nb-item__meta nb-item__meta--expire">{expLine}</div>
                      ) : null}
                      {inviteExpiredUi ? (
                        <div className="nb-item__meta nb-item__meta--warn">
                          유효 기간이 지난 초대입니다. 새 초대가 필요하면 관리자에게 요청하세요.
                        </div>
                      ) : null}
                      <div className="nb-item__meta">{formatDtm(row.create_dtm)}</div>
                    </button>
                    {inviteActions ? (
                      <div className="nb-item__actions">
                        <button
                          type="button"
                          className="nb-item__reject"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRejectProjectInvite(row)
                          }}
                        >
                          거절
                        </button>
                        <button
                          type="button"
                          className="nb-item__accept"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAcceptProjectInvite(row)
                          }}
                        >
                          수락
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
