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
 * - project_invite·widget_board_invite: 수락·거절·만료 표시(위젯 보드는 작업 프로젝트 일치 필요)
 * - 수락/거절·초대 JSON 등 내부용 noti_content는 제목·보조줄만 표시(원문 JSON 비노출)
 * - org_role_changed 등 관리 변경: `summary_plain`(◎ 블록)을 보조줄로 표시(tryAdminChangeSummary)
 * - project_invite: 수락 전 안내·수락 완료(needs_select 시 홈 선택 안내)·토스트와 행 문구 정렬
 * - 거절: 패널 상단 토스트
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import {
  postAcceptProjectInvite,
  postRejectProjectInvite,
  postSelectProject,
} from '@/shared/api/authClient.js'
import {
  postAcceptWidgetBoardInvite,
  postRejectWidgetBoardInvite,
} from '@/packages/widgetboard/api/widgetBoardClient.js'
import {
  getNotifications,
  getUnreadCount,
  patchReadAll,
  patchReadOne,
} from '@/shared/api/notificationsClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import './notification-bell.css'

const POLL_MS = 60_000

/** 관리 변경 알림(noti_type) — 제목 외 짧은 안내(본문 JSON은 숨김) */
const ADMIN_NOTI_TYPE_HINT = {
  org_role_changed: '조직 역할이 변경되었습니다.',
  etl_access_changed: 'ETL 자격이 변경되었습니다.',
  user_mgmt_changed: '계정·프로젝트 배정 등 관리 설정이 변경되었습니다.',
  project_pmssn_changed: '프로젝트 권한(배정)이 변경되었습니다.',
  user_activated: '계정이 활성화되었습니다.',
}
const INVITE_RESOLVED_STORAGE_KEY = 'ibank_bi_invite_resolved'
const PANEL_TOAST_MS = 5200

/** 수락 가능한 초대 행에 표시 — JWT·/me 권한과 동기화되는 이유 안내 */
const PROJECT_INVITE_HINT_PENDING =
  '수락하면 이 프로젝트가 현재 작업 프로젝트로 바뀌며, 부여된 권한으로 쿼리 스튜디오·대시보드·위젯보드를 이용할 수 있습니다.'

const PROJECT_INVITE_HINT_DONE =
  '수락 완료 · 이 프로젝트가 선택된 상태입니다. 사이드바에서 작업 메뉴를 여세요.'

const PROJECT_INVITE_HINT_DONE_NEEDS_HOME =
  '수락은 완료되었습니다. 홈에서 해당 프로젝트를 선택해야 쿼리·대시보드·위젯보드 권한이 적용됩니다.'

const WIDGET_BOARD_INVITE_HINT_PENDING =
  '수락하면 해당 위젯 보드에 참여자로 등록됩니다. 작업 프로젝트가 초대와 같은 프로젝트여야 수락할 수 있습니다.'

/** sessionStorage 값: accepted | needs_select(postSelectProject 실패 시 수동 선택 필요) */
function readStoredInviteAccepted() {
  try {
    const raw = sessionStorage.getItem(INVITE_RESOLVED_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return {}
    const out = {}
    for (const [k, v] of Object.entries(o)) {
      if (v === 'accepted' || v === 'needs_select') out[String(k)] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeStoredInviteAccepted(map) {
  try {
    sessionStorage.setItem(INVITE_RESOLVED_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode 등 */
  }
}

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

const ADMIN_CHANGE_SUMMARY_TYPES = new Set([
  'org_role_changed',
  'etl_access_changed',
  'user_mgmt_changed',
  'project_pmssn_changed',
  'user_activated',
])

/** 관리 변경 알림: noti_content JSON의 `summary_plain`(이메일과 동일 ◎ 블록)만 보조줄로 표시 */
function tryAdminChangeSummary(notiType, raw) {
  const t = (notiType || '').trim()
  if (!ADMIN_CHANGE_SUMMARY_TYPES.has(t)) return null
  if (!raw || !String(raw).trim().startsWith('{')) return null
  try {
    const o = JSON.parse(raw)
    const s = o?.summary_plain
    return typeof s === 'string' && s.trim() ? s.trim() : null
  } catch {
    return null
  }
}

/** 알림 본문으로 JSON(프로젝트 ID 등)만 담긴 행은 사용자에게 숨긴다. */
function shouldShowNotiContentBody(notiType, raw) {
  const t = (notiType || '').trim()
  if (t === 'project_invite' || t === 'widget_board_invite') return false
  if (!raw || !String(raw).trim()) return false
  const s = String(raw).trim()
  if (!s.startsWith('{')) return true
  try {
    const o = JSON.parse(s)
    if (!o || typeof o !== 'object' || Array.isArray(o)) return true
    const keys = Object.keys(o)
    if (keys.length === 0) return false
    const internalKeys = new Set([
      'project_info_id',
      'invitee_user_id',
      'resolved_notification_info_id',
      'pmssn_master_id',
      'invite_user_id',
      'invite_expires_at',
      'actor_user_id',
      'target_user_id',
      'widget_board_id',
      'old_user_dvsn',
      'new_user_dvsn',
      'old_etl_yn',
      'new_etl_yn',
      'dvsn_changed',
      'etl_changed',
      'proj_changed',
      'old_pmssn_name',
      'new_pmssn_name',
      'summary_plain',
    ])
    const onlyInternalMeta = keys.every((k) => internalKeys.has(k))
    return !onlyInternalMeta
  } catch {
    return true
  }
}

function parseWidgetBoardInvitePayload(raw) {
  try {
    const o = JSON.parse(raw || '{}')
    const bid = o.widget_board_id
    const pid = o.project_info_id
    const boardId = bid != null ? Number(bid) : null
    const projectId = pid != null ? Number(pid) : null
    const expiresRaw = o.invite_expires_at != null ? String(o.invite_expires_at) : null
    let inviteExpired = false
    if (expiresRaw) {
      const d = new Date(expiresRaw)
      inviteExpired = !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
    }
    return { boardId, projectId, expiresAt: expiresRaw, inviteExpired }
  } catch {
    return { boardId: null, projectId: null, expiresAt: null, inviteExpired: false }
  }
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
  const { me, refreshMe, notifyParticipatingProjectsChanged } = useAuth()
  const wrapRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  /** notification_info_id → 수락 완료(동일 브라우저 탭에서 목록·버튼 숨김 유지) */
  const [inviteAcceptedMap, setInviteAcceptedMap] = useState(readStoredInviteAccepted)
  const [panelToast, setPanelToast] = useState(null)

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

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    },
    [],
  )

  function showPanelToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setPanelToast(message)
    toastTimerRef.current = setTimeout(() => {
      setPanelToast(null)
      toastTimerRef.current = null
    }, PANEL_TOAST_MS)
  }

  /** 목록에 없는(삭제된) 알림 id는 로컬 수락 기록에서 제거 */
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return
    const ids = new Set(items.map((i) => String(i.notification_info_id)))
    setInviteAcceptedMap((prev) => {
      const next = { ...prev }
      let changed = false
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k]
          changed = true
        }
      }
      if (changed) writeStoredInviteAccepted(next)
      return changed ? next : prev
    })
  }, [items])

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
      let inviteUiState = 'accepted'
      try {
        await postSelectProject(pid)
      } catch (e2) {
        inviteUiState = 'needs_select'
        window.alert(
          e2?.message ||
            '수락은 완료되었습니다. 홈에서 해당 프로젝트 카드를 눌러 선택한 뒤 다시 시도해 주세요.',
        )
      }
      const idStr = String(nid)
      setInviteAcceptedMap((prev) => {
        const next = { ...prev, [idStr]: inviteUiState }
        writeStoredInviteAccepted(next)
        return next
      })
      await refreshMe()
      notifyParticipatingProjectsChanged()
      await refreshCount()
      await loadList()
      showPanelToast(
        inviteUiState === 'needs_select'
          ? PROJECT_INVITE_HINT_DONE_NEEDS_HOME
          : PROJECT_INVITE_HINT_DONE,
      )
    } catch (e) {
      window.alert(e?.message || '수락에 실패했습니다.')
    }
  }

  async function handleAcceptWidgetBoardInvite(row) {
    const nid = row.notification_info_id
    const { boardId, projectId, inviteExpired } = parseWidgetBoardInvitePayload(row.noti_content)
    if (inviteExpired) {
      window.alert('초대 유효 기간이 지났습니다.')
      return
    }
    if (nid == null || boardId == null || Number.isNaN(boardId) || projectId == null || Number.isNaN(projectId)) {
      window.alert('초대 정보를 확인할 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.')
      return
    }
    const curPid = me?.project_info_id != null ? Number(me.project_info_id) : null
    if (curPid == null || Number.isNaN(curPid) || curPid !== projectId) {
      window.alert(
        '위젯 보드 초대를 수락하려면 헤더에서 해당 보드가 속한 프로젝트를 작업 프로젝트로 선택한 뒤 다시 시도하세요.',
      )
      return
    }
    if (!confirmCrud('위젯 보드 초대를 수락할까요?')) return
    try {
      await postAcceptWidgetBoardInvite(boardId, { notification_info_id: Number(nid) })
      const idStr = String(nid)
      setInviteAcceptedMap((prev) => {
        const next = { ...prev, [idStr]: 'accepted' }
        writeStoredInviteAccepted(next)
        return next
      })
      await refreshMe()
      await refreshCount()
      await loadList()
      showPanelToast('위젯 보드 초대를 수락했습니다.')
    } catch (e) {
      window.alert(e?.message || '수락에 실패했습니다.')
    }
  }

  async function handleRejectWidgetBoardInvite(row) {
    const nid = row.notification_info_id
    const { boardId, projectId, inviteExpired } = parseWidgetBoardInvitePayload(row.noti_content)
    if (inviteExpired) {
      window.alert('초대 유효 기간이 지났습니다.')
      return
    }
    if (nid == null || boardId == null || Number.isNaN(boardId) || projectId == null || Number.isNaN(projectId)) {
      window.alert('초대 정보를 확인할 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.')
      return
    }
    const curPid = me?.project_info_id != null ? Number(me.project_info_id) : null
    if (curPid == null || Number.isNaN(curPid) || curPid !== projectId) {
      window.alert(
        '거절하려면 헤더에서 해당 보드가 속한 프로젝트를 작업 프로젝트로 선택한 뒤 다시 시도하세요.',
      )
      return
    }
    if (
      !confirmCrud(
        '위젯 보드 초대를 거절할까요? 초대자에게 거절 알림이 전송되며, 이 알림은 삭제됩니다.',
      )
    )
      return
    try {
      await postRejectWidgetBoardInvite(boardId, { notification_info_id: Number(nid) })
      await refreshCount()
      await loadList()
      showPanelToast('초대를 거절했습니다. 초대자에게 알림이 전송되었습니다.')
    } catch (e) {
      window.alert(e?.message || '거절 처리에 실패했습니다.')
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
      showPanelToast('초대를 거절했습니다. 초대자에게 알림이 전송되었습니다.')
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
          {panelToast ? (
            <div className="nb-panel__toast" role="status" aria-live="polite">
              {panelToast}
            </div>
          ) : null}
          <div className="nb-panel__list">
            {loading ? (
              <div className="nb-empty">불러오는 중…</div>
            ) : items.length === 0 ? (
              <div className="nb-empty">알림이 없습니다.</div>
            ) : (
              items.map((row) => {
                const isInvite = (row.noti_type || '').trim() === 'project_invite'
                const isWbInvite = (row.noti_type || '').trim() === 'widget_board_invite'
                const inv = isInvite ? parseProjectInvitePayload(row.noti_content) : null
                const wbInv = isWbInvite ? parseWidgetBoardInvitePayload(row.noti_content) : null
                const invitePid = inv?.projectId
                const adminChangeSummary = tryAdminChangeSummary(row.noti_type, row.noti_content)
                const nidKey =
                  row.notification_info_id != null ? String(row.notification_info_id) : ''
                const inviteResolved =
                  nidKey &&
                  (inviteAcceptedMap[nidKey] === 'accepted' ||
                    inviteAcceptedMap[nidKey] === 'needs_select')
                const inviteAcceptedHere = Boolean(inviteResolved)
                const expLine =
                  inv?.expiresAt && !Number.isNaN(new Date(inv.expiresAt).getTime())
                    ? `만료: ${formatDtm(inv.expiresAt)}`
                    : null
                const wbExpLine =
                  wbInv?.expiresAt && !Number.isNaN(new Date(wbInv.expiresAt).getTime())
                    ? `만료: ${formatDtm(wbInv.expiresAt)}`
                    : null
                const inviteActions =
                  isInvite &&
                  invitePid != null &&
                  !Number.isNaN(invitePid) &&
                  !inv?.inviteExpired &&
                  !inviteAcceptedHere
                const wbInviteActions =
                  isWbInvite &&
                  wbInv?.boardId != null &&
                  !Number.isNaN(wbInv.boardId) &&
                  wbInv?.projectId != null &&
                  !Number.isNaN(wbInv.projectId) &&
                  !wbInv?.inviteExpired &&
                  !inviteAcceptedHere
                const inviteExpiredUi = isInvite && inv?.inviteExpired
                const wbInviteExpiredUi = isWbInvite && wbInv?.inviteExpired
                return (
                  <div
                    key={String(row.notification_info_id)}
                    className={`nb-item ${isUnread(row) ? 'nb-item--unread' : ''}${
                      inviteAcceptedHere ? ' nb-item--invite-done' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="nb-item__main"
                      onClick={() => handleReadOne(row)}
                    >
                      <div className="nb-item__title">{row.noti_title || '(제목 없음)'}</div>
                      {adminChangeSummary ? (
                        <div className="nb-item__meta nb-item__meta--admin-summary">{adminChangeSummary}</div>
                      ) : null}
                      {!adminChangeSummary && shouldShowNotiContentBody(row.noti_type, row.noti_content) ? (
                        <div className="nb-item__meta">{row.noti_content}</div>
                      ) : null}
                      {isInvite && expLine ? (
                        <div className="nb-item__meta nb-item__meta--expire">{expLine}</div>
                      ) : null}
                      {isWbInvite && wbExpLine ? (
                        <div className="nb-item__meta nb-item__meta--expire">{wbExpLine}</div>
                      ) : null}
                      {inviteExpiredUi ? (
                        <div className="nb-item__meta nb-item__meta--warn">
                          유효 기간이 지난 초대입니다. 새 초대가 필요하면 관리자에게 요청하세요.
                        </div>
                      ) : null}
                      {wbInviteExpiredUi ? (
                        <div className="nb-item__meta nb-item__meta--warn">
                          유효 기간이 지난 초대입니다. 소유자에게 새 초대를 요청하세요.
                        </div>
                      ) : null}
                      {isInvite && inviteActions ? (
                        <div className="nb-item__meta nb-item__meta--invite-hint" role="note">
                          {PROJECT_INVITE_HINT_PENDING}
                        </div>
                      ) : null}
                      {isWbInvite && wbInviteActions ? (
                        <div className="nb-item__meta nb-item__meta--invite-hint" role="note">
                          {WIDGET_BOARD_INVITE_HINT_PENDING}
                        </div>
                      ) : null}
                      {isInvite && inviteAcceptedHere ? (
                        <div className="nb-item__meta nb-item__meta--done" role="status">
                          {inviteAcceptedMap[nidKey] === 'needs_select'
                            ? PROJECT_INVITE_HINT_DONE_NEEDS_HOME
                            : PROJECT_INVITE_HINT_DONE}
                        </div>
                      ) : null}
                      {ADMIN_NOTI_TYPE_HINT[row.noti_type] ? (
                        <div className="nb-item__meta nb-item__meta--invite-hint" role="note">
                          {ADMIN_NOTI_TYPE_HINT[row.noti_type]}
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
                    {wbInviteActions ? (
                      <div className="nb-item__actions">
                        <button
                          type="button"
                          className="nb-item__reject"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRejectWidgetBoardInvite(row)
                          }}
                        >
                          거절
                        </button>
                        <button
                          type="button"
                          className="nb-item__accept"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAcceptWidgetBoardInvite(row)
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
