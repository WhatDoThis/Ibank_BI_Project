/**
 * packages/widgetboard/WidgetboardListPage.jsx (위젯 보드 목록)
 * ============================================================
 * 프로젝트 단위 보드 목록(소유·공유). 캔버스 진입·제목/설명 수정·초대·비활성/활성·삭제·참여자 모달.
 *
 * [Main Functions]
 * ===========
 * 1. listWidgetBoards 로 테이블 렌더, 생성/수정/참여자/초대 모달
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, ./api/widgetBoardClient, shared/utils/crudConfirm
 * - app/admin/admin-pages.css, admin-users.css, admin-org.css(생성·수정 모달), widgetboard.css
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'
import {
  listWidgetBoards,
  createWidgetBoard,
  updateWidgetBoard,
  deleteWidgetBoard,
  getWidgetBoardParticipants,
  getWidgetBoardInviteCandidates,
  upsertWidgetBoardShare,
  deleteWidgetBoardShare,
  postWidgetBoardInviteNotifications
} from '@/packages/widgetboard/api/widgetBoardClient.js'

import '@/app/admin/admin-pages.css'
import '@/app/admin/admin-users.css'
import '@/app/admin/admin-org.css'
import '@/packages/widgetboard/widgetboard.css'

function formatDtm(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ko-KR')
  } catch {
    return String(v)
  }
}

function isBoardActive(row) {
  return String(row?.active_yn ?? 'Y').toUpperCase() === 'Y'
}

function ownerLabel(row) {
  const em = (row?.owner_email || '').trim()
  const nk = (row?.owner_nickname || '').trim()
  if (em) return em
  if (nk) return nk
  return '—'
}

export default function WidgetboardListPage() {
  const { me, projectContextNonce } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cShareScope, setCShareScope] = useState('private')

  const [editRow, setEditRow] = useState(null)
  const [eName, setEName] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eShareScope, setEShareScope] = useState('private')

  const [partBoardId, setPartBoardId] = useState(null)
  const [partLoading, setPartLoading] = useState(false)
  const [partData, setPartData] = useState(null)
  const [partError, setPartError] = useState('')

  const [inviteBoardId, setInviteBoardId] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteItems, setInviteItems] = useState([])
  const [inviteChecked, setInviteChecked] = useState({})
  const [inviteCanEdit, setInviteCanEdit] = useState(false)

  const load = useCallback(async () => {
    if (!me?.project_info_id) {
      setItems([])
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await listWidgetBoards()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setError(e?.message || '목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [me?.project_info_id])

  useEffect(() => {
    load()
  }, [load, projectContextNonce])

  const openParticipants = async (boardId) => {
    setPartBoardId(boardId)
    setPartData(null)
    setPartError('')
    setPartLoading(true)
    try {
      const data = await getWidgetBoardParticipants(boardId)
      setPartData(data)
    } catch (e) {
      setPartError(e?.message || '참여자를 불러오지 못했습니다.')
    } finally {
      setPartLoading(false)
    }
  }

  const openInvite = async (boardId) => {
    setInviteBoardId(boardId)
    setInviteCanEdit(false)
    setInviteItems([])
    setInviteChecked({})
    setInviteLoading(true)
    try {
      const data = await getWidgetBoardInviteCandidates(boardId)
      const list = Array.isArray(data?.items) ? data.items : []
      setInviteItems(list)
      const init = {}
      for (const u of list) {
        init[String(u.user_id)] = false
      }
      setInviteChecked(init)
    } catch {
      setInviteItems([])
      setInviteChecked({})
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCreate = async () => {
    const name = cName.trim() || '새 위젯 보드'
    setBusyId(-1)
    try {
      await createWidgetBoard({
        board_name: name,
        board_dscrtn: cDesc.trim() || null,
        share_scope: cShareScope === 'project' ? 'project' : 'private'
      })
      setCreateOpen(false)
      setCName('')
      setCDesc('')
      setCShareScope('private')
      await load()
    } catch (e) {
      setError(e?.message || '생성에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!editRow) return
    const id = editRow.widget_board_id
    setBusyId(id)
    try {
      await updateWidgetBoard(id, {
        board_name: eName.trim() || '새 위젯 보드',
        board_dscrtn: eDesc.trim() || null,
        share_scope: eShareScope === 'project' ? 'project' : 'private'
      })
      setEditRow(null)
      await load()
    } catch (e) {
      setError(e?.message || '저장에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeactivate = async (row) => {
    if (!confirmCrud(`「${row.board_name || '보드'}」을(를) 비활성화할까요?`)) return
    setBusyId(row.widget_board_id)
    try {
      await updateWidgetBoard(row.widget_board_id, { active_yn: false })
      await load()
    } catch (e) {
      setError(e?.message || '비활성화에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const handleActivate = async (row) => {
    setBusyId(row.widget_board_id)
    try {
      await updateWidgetBoard(row.widget_board_id, { active_yn: true })
      await load()
    } catch (e) {
      setError(e?.message || '활성화에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteBoard = async (row) => {
    if (!confirmCrud(`「${row.board_name || '보드'}」을(를) 삭제(비공개 처리)할까요?`)) return
    setBusyId(row.widget_board_id)
    try {
      await deleteWidgetBoard(row.widget_board_id)
      await load()
    } catch (e) {
      setError(e?.message || '삭제에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const patchParticipantEdit = async (boardId, userId, canEdit) => {
    setBusyId(boardId)
    try {
      await upsertWidgetBoardShare(boardId, { shared_user_id: userId, can_edit: canEdit })
      await openParticipants(boardId)
      await load()
    } catch (e) {
      setPartError(e?.message || '저장에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const removeParticipant = async (boardId, userId) => {
    if (
      !confirmCrud(
        '이 참여자를 제외할까요? 제외 시 해당 사용자가 이 보드에서 만든 위젯의 생성자 표시는 보드 소유자로 이관됩니다.'
      )
    ) {
      return
    }
    setBusyId(boardId)
    try {
      await deleteWidgetBoardShare(boardId, userId)
      await openParticipants(boardId)
      await load()
    } catch (e) {
      setPartError(e?.message || '제외에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const submitInvite = async () => {
    if (!inviteBoardId) return
    const invitations = inviteItems
      .filter((u) => inviteChecked[String(u.user_id)])
      .map((u) => ({
        shared_user_id: Number(u.user_id),
        can_edit: inviteCanEdit
      }))
    if (invitations.length === 0) {
      setError('초대할 사용자를 한 명 이상 선택하세요.')
      return
    }
    setBusyId(inviteBoardId)
    try {
      await postWidgetBoardInviteNotifications(inviteBoardId, { invitations })
      setInviteBoardId(null)
      await load()
    } catch (e) {
      setError(e?.message || '초대 알림 발송에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const toggleInviteAll = (on) => {
    const next = { ...inviteChecked }
    for (const u of inviteItems) {
      next[String(u.user_id)] = on
    }
    setInviteChecked(next)
  }

  const myId = me?.user_id != null ? Number(me.user_id) : null

  return (
    <div className="ap">
      <div className="ap__header-row">
        <div>
          <h1 className="ap__title">위젯 보드</h1>
          <p className="ap__hint">
            소유·초대(수락 후)·프로젝트 범위(project) 보드가 표시됩니다. project 는 동일 프로젝트 위젯보드 권한이 있으면 캔버스만 읽기 전용으로 열 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="ibank-btn-toolbar"
          onClick={() => setCreateOpen(true)}
          disabled={loading || !me?.project_info_id}
        >
          위젯보드 생성
        </button>
      </div>
      {error ? <p className="ap__error">{error}</p> : null}

      {loading ? (
        <p className="ap__hint">불러오는 중…</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table ap__table--projects">
            <thead>
              <tr>
                <th>위젯명</th>
                <th>위젯 설명</th>
                <th>범위</th>
                <th>소유자</th>
                <th>생성일</th>
                <th>참여자</th>
                <th className="ap__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ap__hint">
                    등록된 보드가 없습니다. 위젯보드 생성으로 추가하세요.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const id = row.widget_board_id
                  const active = isBoardActive(row)
                  const isOwner = Boolean(row.is_owner)
                  const canEdit = Boolean(row.can_edit)
                  const hasShare = Boolean(row.has_share)
                  const scope = String(row.share_scope || 'private').toLowerCase()
                  const canvasOnly =
                    scope === 'project' && !isOwner && !hasShare && active
                  const canvasOk = active
                  const scopeLabel = scope === 'project' ? '프로젝트' : '비공개'
                  const bname = row.board_name || `보드 ${id}`
                  const bdesc = (row.board_dscrtn || '').trim()
                  return (
                    <tr key={id}>
                      <td className="ap__td-clip-name">
                        <span className="ap__cell-clip ap__cell-clip--project-name" title={bname}>
                          {bname}
                        </span>
                      </td>
                      <td className="ap__td-clip-desc">
                        <span className="ap__cell-clip" title={bdesc || undefined}>
                          {bdesc || '—'}
                        </span>
                      </td>
                      <td>{scopeLabel}</td>
                      <td>{ownerLabel(row)}</td>
                      <td>{formatDtm(row.create_dtm)}</td>
                      <td>
                        {canvasOnly ? (
                          <span className="ap__hint">—</span>
                        ) : (
                          <div className="admin-users__actions wb-list-participant-actions">
                            <button
                              type="button"
                              className="ibank-btn-table"
                              onClick={() => openParticipants(id)}
                            >
                              목록
                            </button>
                            <span className="wb-list-participant-count">
                              ({row.participant_count ?? '—'}명)
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="admin-users__actions">
                          <button
                            type="button"
                            className="ibank-btn-table"
                            disabled={!canvasOk || busyId === id}
                            onClick={() => navigate(`/widgetboard/${id}`)}
                          >
                            캔버스
                          </button>
                          {isOwner && active ? (
                            <>
                              <button
                                type="button"
                                className="ibank-btn-table"
                                disabled={busyId === id}
                                onClick={() => {
                                  setEditRow(row)
                                  setEName(row.board_name || '')
                                  setEDesc(row.board_dscrtn || '')
                                  setEShareScope(
                                    String(row.share_scope || 'private').toLowerCase() === 'project'
                                      ? 'project'
                                      : 'private'
                                  )
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="ibank-btn-table"
                                disabled={busyId === id}
                                onClick={() => openInvite(id)}
                              >
                                초대
                              </button>
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                disabled={busyId === id}
                                onClick={() => handleDeactivate(row)}
                              >
                                비활성
                              </button>
                            </>
                          ) : null}
                          {isOwner && !active ? (
                            <>
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--primary"
                                disabled={busyId === id}
                                onClick={() => handleActivate(row)}
                              >
                                활성
                              </button>
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                disabled={busyId === id}
                                onClick={() => handleDeleteBoard(row)}
                              >
                                삭제
                              </button>
                            </>
                          ) : null}
                        </div>
                        {!isOwner && !canEdit && active ? (
                          <div className="ap__hint" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                            {canvasOnly
                              ? '프로젝트 범위 읽기 전용(캔버스만)'
                              : '읽기 전용(캔버스만)'}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div
          className="admin-org__modal-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setCreateOpen(false)
          }}
        >
          <div
            className="admin-org__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wb-list-create-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                handleCreate()
              }}
            >
              <h3 id="wb-list-create-title">위젯보드 생성</h3>
              <label className="admin-org__label">
                위젯명
                <input
                  type="text"
                  className="admin-org__input"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="보드 이름"
                  maxLength={200}
                />
              </label>
              <label className="admin-org__label">
                설명
                <textarea
                  className="admin-org__input wb-list-modal__textarea"
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  rows={3}
                />
              </label>
              <label className="admin-org__label">
                공유 범위
                <select
                  className="admin-org__input admin-org__select"
                  value={cShareScope}
                  onChange={(e) => setCShareScope(e.target.value)}
                >
                  <option value="private">비공개 (초대한 사용자만)</option>
                  <option value="project">프로젝트 (동일 프로젝트는 캔버스 읽기 전용)</option>
                </select>
              </label>
              <div className="admin-org__modal-actions">
                <button
                  type="button"
                  className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                  onClick={() => setCreateOpen(false)}
                  disabled={busyId === -1}
                >
                  취소
                </button>
                <button type="submit" className="ibank-btn-toolbar" disabled={busyId === -1}>
                  {busyId === -1 ? '처리 중…' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div
          className="admin-org__modal-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setEditRow(null)
          }}
        >
          <div
            className="admin-org__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wb-list-edit-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                handleSaveEdit()
              }}
            >
              <h3 id="wb-list-edit-title">보드 수정</h3>
              <label className="admin-org__label">
                위젯명
                <input
                  type="text"
                  className="admin-org__input"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="admin-org__label">
                설명
                <textarea
                  className="admin-org__input wb-list-modal__textarea"
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  rows={3}
                />
              </label>
              <label className="admin-org__label">
                공유 범위
                <select
                  className="admin-org__input admin-org__select"
                  value={eShareScope}
                  onChange={(e) => setEShareScope(e.target.value)}
                >
                  <option value="private">비공개 (초대한 사용자만)</option>
                  <option value="project">프로젝트 (동일 프로젝트는 캔버스 읽기 전용)</option>
                </select>
              </label>
              <div className="admin-org__modal-actions">
                <button
                  type="button"
                  className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                  onClick={() => setEditRow(null)}
                  disabled={busyId === editRow.widget_board_id}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="ibank-btn-toolbar"
                  disabled={busyId === editRow.widget_board_id}
                >
                  {busyId === editRow.widget_board_id ? '저장 중…' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {partBoardId != null ? (
        <div
          className="ap__modal-overlay"
          role="presentation"
          onClick={() => setPartBoardId(null)}
        >
          <div className="ap__modal ap__modal--create-wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="ap__modal-title">참여자</h2>
            <p className="ap__hint">
              비공개 보드는 소유자와 수락한 초대 사용자만 접근합니다. 프로젝트 범위 보드는 동일 프로젝트에서 캔버스 읽기 전용으로 열 수 있습니다.
            </p>
            {partError ? <p className="ap__error">{partError}</p> : null}
            {partLoading ? (
              <p className="ap__hint">불러오는 중…</p>
            ) : (
              <div className="ap__table-wrap">
                <table className="ap__table wb-list-modal-table">
                  <thead>
                    <tr>
                      <th>참여자</th>
                      <th>편집 가능</th>
                      <th className="ap__th-actions">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partData?.items || []).map((p) => {
                      const uid = Number(p.user_id)
                      const self = myId != null && uid === myId
                      const isOwner = Boolean(p.is_owner)
                      const display = (p.user_email || p.user_nickname || '—').trim()
                      return (
                        <tr key={uid}>
                          <td className="ap__td-clip-inviter">
                            <span className="admin-users__email-cell wb-list-modal-email-cell">
                              <span className="admin-users__email-text" title={display}>
                                {display}
                              </span>
                              {self ? (
                                <span className="admin-users__self-badge" title="본인 계정">
                                  본인
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td>{isOwner || p.can_edit ? 'Y' : 'N'}</td>
                          <td>
                            {self || isOwner || !partData?.viewer_is_owner ? (
                              <span className="ap__hint">—</span>
                            ) : (
                              <div className="admin-users__actions">
                                <button
                                  type="button"
                                  className="ibank-btn-table"
                                  disabled={busyId === partBoardId}
                                  onClick={() => patchParticipantEdit(partBoardId, uid, !p.can_edit)}
                                >
                                  편집
                                </button>
                                <button
                                  type="button"
                                  className="ibank-btn-table ibank-btn-table--danger"
                                  disabled={busyId === partBoardId}
                                  onClick={() => removeParticipant(partBoardId, uid)}
                                >
                                  제외
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ap__modal-actions">
              <button type="button" className="ibank-btn-toolbar" onClick={() => setPartBoardId(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteBoardId != null ? (
        <div
          className="ap__modal-overlay"
          role="presentation"
          onClick={() => setInviteBoardId(null)}
        >
          <div className="ap__modal ap__modal--create-wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="ap__modal-title">초대 알림 보내기</h2>
            <p className="ap__hint">
              위젯보드 권한이 있는 프로젝트 참여자만 표시됩니다. 수락하면 참여자로 등록됩니다.
            </p>
            <div className="admin-users__actions" style={{ marginBottom: 8 }}>
              <button type="button" className="ibank-btn-table" onClick={() => toggleInviteAll(true)}>
                모두 초대(전체 선택)
              </button>
              <button type="button" className="ibank-btn-table" onClick={() => toggleInviteAll(false)}>
                전체 해제
              </button>
            </div>
            {inviteLoading ? (
              <p className="ap__hint">불러오는 중…</p>
            ) : inviteItems.length === 0 ? (
              <p className="ap__hint">초대 가능한 사용자가 없습니다.</p>
            ) : (
              <div className="ap__table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
                <table className="ap__table wb-list-modal-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }}>선택</th>
                      <th>사용자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteItems.map((u) => {
                      const id = String(u.user_id)
                      const display = (u.user_email || u.user_nickname || u.user_id).trim()
                      return (
                        <tr key={id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!inviteChecked[id]}
                              onChange={(e) =>
                                setInviteChecked((prev) => ({ ...prev, [id]: e.target.checked }))
                              }
                            />
                          </td>
                          <td className="ap__td-clip-inviter">
                            <span className="ap__cell-clip" title={display}>
                              {display}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <label className="ap__check" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={inviteCanEdit}
                onChange={(e) => setInviteCanEdit(e.target.checked)}
              />
              수락 시 편집 허용
            </label>
            <div className="ap__modal-actions">
              <button type="button" className="ibank-btn-secondary" onClick={() => setInviteBoardId(null)}>
                취소
              </button>
              <button
                type="button"
                className="ibank-btn-toolbar"
                onClick={submitInvite}
                disabled={inviteLoading || busyId === inviteBoardId}
              >
                선택한 사용자에게 알림 보내기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
