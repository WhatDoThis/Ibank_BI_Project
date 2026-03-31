/**
 * app/admin/AdminUsersPage.jsx (부서 사용자 관리 S8)
 * ===========================================
 * SA_DEV 전사 사용자 목록(부서·역할·ETL순), 그 외 동일 부서. 부서/하위부서명·ETL 컬럼, 정지 전 이관 검증.
 *
 * [Main Functions]
 * ===========
 * - AdminUsersPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, app/auth/AuthContext, shared/utils/crudConfirm
 */

import { Fragment, useCallback, useEffect, useState } from 'react'

import {
  getAdminInviteDepartments,
  getAdminInviteProjects,
  getAdminInviteRoles,
  getAdminOwnershipTransferTargets,
  getAdminUserWorkAssets,
  getAdminUsers,
  patchAdminUserActivate,
  patchAdminUserSuspend,
  postAdminInvite,
  postAdminTransferOwnership,
} from '@/shared/api/adminClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import './admin-users.css'

function formatDtm(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ko-KR')
  } catch {
    return String(v)
  }
}

function isActive(row) {
  return (row.user_active_yn || '').toUpperCase() === 'Y'
}

/** ETL 인프라 자격: sa_dev 또는 etl_yn=Y (05 문서 require_etl_infrastructure와 동일 취지) */
function hasEtlInfra(row) {
  const d = (row.user_dvsn || '').toLowerCase()
  if (d === 'sa_dev') return true
  return (row.etl_yn || '').toUpperCase() === 'Y'
}

const ROLE_OPTIONS_SA = [
  { value: 'sa', label: 'Super Admin (sa)' },
  { value: 'a', label: 'Admin (a)' },
  { value: 'o', label: 'Operator (o)' },
  { value: 'u', label: 'User (u)' },
]

const ROLE_OPTIONS_ADMIN = [
  { value: 'a', label: 'Admin (a)' },
  { value: 'o', label: 'Operator (o)' },
  { value: 'u', label: 'User (u)' },
]

function roleChoices(actorDvsn) {
  const d = (actorDvsn || '').toLowerCase()
  if (d === 'sa_dev' || d === 'sa') return ROLE_OPTIONS_SA
  if (d === 'a') return ROLE_OPTIONS_ADMIN
  return []
}

export default function AdminUsersPage() {
  const { me } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [depts, setDepts] = useState([])
  const [inviteDeptId, setInviteDeptId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('u')
  const [inviteEtl, setInviteEtl] = useState(false)
  const [inviteProjects, setInviteProjects] = useState([])
  const [invitePmssns, setInvitePmssns] = useState([])
  const [inviteProjectId, setInviteProjectId] = useState('')
  const [invitePmssnId, setInvitePmssnId] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [expandedUid, setExpandedUid] = useState(null)
  const [workByUser, setWorkByUser] = useState({})
  const [workLoadingUid, setWorkLoadingUid] = useState(null)
  const [workPanelErr, setWorkPanelErr] = useState('')
  const [transferCtx, setTransferCtx] = useState(null)
  const [transferTargets, setTransferTargets] = useState([])
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferErr, setTransferErr] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await getAdminUsers()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setItems([])
      setError(e?.message || '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actorDvsn = (me?.user_dvsn || '').toLowerCase()
  const canSetEtlOnInvite = actorDvsn === 'sa' || actorDvsn === 'sa_dev'
  const roleOpts = roleChoices(me?.user_dvsn)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getAdminInviteDepartments()
        const list = Array.isArray(data?.items) ? data.items : []
        if (cancelled) return
        setDepts(list)
        const myD = me?.dptmt_info_id
        if (myD != null && list.some((r) => Number(r.dptmt_info_id) === Number(myD))) {
          setInviteDeptId(String(myD))
        } else if (list.length) {
          setInviteDeptId(String(list[0].dptmt_info_id))
        }
      } catch {
        if (!cancelled) setDepts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me?.dptmt_info_id])

  useEffect(() => {
    const rid = Number(inviteDeptId)
    if (!Number.isFinite(rid) || rid < 0) {
      setInviteProjects([])
      setInvitePmssns([])
      return
    }
    if (inviteRole !== 'u') {
      setInviteProjects([])
      setInvitePmssns([])
      setInviteProjectId('')
      setInvitePmssnId('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [pr, rl] = await Promise.all([
          getAdminInviteProjects(rid),
          getAdminInviteRoles(rid),
        ])
        if (cancelled) return
        setInviteProjects(Array.isArray(pr?.items) ? pr.items : [])
        setInvitePmssns(Array.isArray(rl?.items) ? rl.items : [])
        setInviteProjectId('')
        setInvitePmssnId('')
      } catch {
        if (!cancelled) {
          setInviteProjects([])
          setInvitePmssns([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inviteDeptId, inviteRole])

  useEffect(() => {
    const opts = roleChoices(me?.user_dvsn)
    if (!opts.length) return
    if (!opts.some((o) => o.value === inviteRole)) {
      setInviteRole(opts[0].value)
    }
  }, [me?.user_dvsn, inviteRole])

  async function handleInviteSubmit(ev) {
    ev.preventDefault()
    setInviteMsg('')
    setError('')
    const did = Number(inviteDeptId)
    if (!Number.isFinite(did) || did < 0) {
      setInviteMsg('가입 부서를 선택하세요.')
      return
    }
    if (inviteRole === 'u') {
      const pid = Number(inviteProjectId)
      const mid = Number(invitePmssnId)
      const needP = Number.isFinite(pid) && pid >= 1
      const needM = Number.isFinite(mid) && mid >= 1
      if (needP !== needM) {
        setInviteMsg('U 초대 시 프로젝트와 역할(pmssn)은 둘 다 선택하거나 둘 다 비웁니다.')
        return
      }
    }
    if (!confirmCrud('초대 메일을 발송할까요?')) return
    setInviteBusy(true)
    try {
      const body = {
        email: inviteEmail.trim(),
        dptmt_info_id: did,
        invite_target_dvsn: inviteRole,
      }
      if (canSetEtlOnInvite) {
        body.invite_etl_yn = inviteEtl ? 'Y' : 'N'
      }
      if (inviteRole === 'u' && inviteProjectId && invitePmssnId) {
        body.invite_project_info_id = Number(inviteProjectId)
        body.invite_pmssn_master_id = Number(invitePmssnId)
      }
      await postAdminInvite(body)
      setInviteMsg('초대 메일을 발송했습니다.')
      setInviteEmail('')
      setInviteOpen(false)
    } catch (e) {
      setInviteMsg(e?.message || '초대 실패')
    } finally {
      setInviteBusy(false)
    }
  }

  const toggleWorkPanel = useCallback(async (uid) => {
    if (expandedUid === uid) {
      setExpandedUid(null)
      return
    }
    setExpandedUid(uid)
    setWorkPanelErr('')
    if (workByUser[uid]) return
    setWorkLoadingUid(uid)
    try {
      const data = await getAdminUserWorkAssets(uid)
      setWorkByUser((prev) => ({ ...prev, [uid]: data }))
    } catch (e) {
      setWorkPanelErr(e?.message || '작업물 목록을 불러오지 못했습니다.')
    } finally {
      setWorkLoadingUid(null)
    }
  }, [expandedUid, workByUser])

  const openTransferModal = useCallback(async (ctx) => {
    setTransferCtx(ctx)
    setTransferErr('')
    setTransferTargets([])
    setTransferLoading(true)
    try {
      const d = await getAdminOwnershipTransferTargets(ctx.dptmtInfoId, ctx.fromUserId)
      setTransferTargets(Array.isArray(d?.items) ? d.items : [])
    } catch (e) {
      setTransferErr(e?.message || '이관 가능한 사용자 목록을 불러오지 못했습니다.')
    } finally {
      setTransferLoading(false)
    }
  }, [])

  const runTransfer = useCallback(
    async (toUserId) => {
      if (!transferCtx) return
      if (!confirmCrud('정말 이관하시겠습니까?')) return
      setTransferLoading(true)
      setTransferErr('')
      try {
        await postAdminTransferOwnership({
          resource_type: transferCtx.resourceType,
          resource_id: transferCtx.resourceId,
          from_user_id: transferCtx.fromUserId,
          to_user_id: toUserId,
        })
        setTransferCtx(null)
        setTransferTargets([])
        const eu = expandedUid
        if (eu != null) {
          setWorkByUser((prev) => {
            const next = { ...prev }
            delete next[eu]
            return next
          })
          setWorkLoadingUid(eu)
          try {
            const data = await getAdminUserWorkAssets(eu)
            setWorkByUser((prev) => ({ ...prev, [eu]: data }))
          } catch (e) {
            setWorkPanelErr(e?.message || '목록 갱신 실패')
          } finally {
            setWorkLoadingUid(null)
          }
        }
        await load()
      } catch (e) {
        setTransferErr(e?.message || '이관 실패')
      } finally {
        setTransferLoading(false)
      }
    },
    [transferCtx, expandedUid, load],
  )

  async function handleSuspend(userId) {
    if (!confirmCrud('이 사용자를 비활성(정지) 처리할까요?')) return
    setBusyId(userId)
    setError('')
    try {
      await patchAdminUserSuspend(userId)
      await load()
    } catch (e) {
      const msg = e?.message || '정지 처리 실패'
      window.alert(msg)
      setError(msg)
    } finally {
      setBusyId(null)
    }
  }

  async function handleActivate(userId) {
    if (!confirmCrud('이 사용자를 활성화할까요?')) return
    setBusyId(userId)
    setError('')
    try {
      await patchAdminUserActivate(userId)
      await load()
    } catch (e) {
      setError(e?.message || '활성화 실패')
    } finally {
      setBusyId(null)
    }
  }

  const myId = me?.user_id

  function renderAssetList(title, rows, uid, resourceType, idKey, labelKey, showTransfer) {
    if (!rows?.length) return null
    return (
      <div className="admin-users__work-block">
        <h4 className="admin-users__work-block-title">{title}</h4>
        <ul className="admin-users__work-list">
          {rows.map((r) => {
            const rid = r[idKey]
            const label =
              labelKey === 'table_label'
                ? r.table_label || r.table_name || rid
                : r[labelKey] || rid
            const dept = r.dptmt_info_id
            const canT = showTransfer && r.transferable
            return (
              <li key={`${title}-${rid}`} className="admin-users__work-item">
                <span className="admin-users__work-item-label">
                  {label}
                  {r.active_yn != null ? ` · ${(r.active_yn || '').toUpperCase() === 'Y' ? '활성' : '비활성'}` : ''}
                  {r.pmssn_name ? ` · ${r.pmssn_name}` : ''}
                  {r.db_type && r.table_name && labelKey === 'table_label'
                    ? ` · ${r.db_type} / ${r.table_name}`
                    : ''}
                </span>
                {canT ? (
                  <button
                    type="button"
                    className="admin-users__btn-transfer"
                    onClick={() =>
                      openTransferModal({
                        resourceType,
                        resourceId: Number(rid),
                        fromUserId: uid,
                        dptmtInfoId: Number(dept),
                        label: `${title}: ${label}`,
                      })
                    }
                  >
                    이관
                  </button>
                ) : null}
                {r.note ? (
                  <span className="admin-users__work-note" title={r.note}>
                    {r.note}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="admin-users">
      <div className="admin-users__header-row">
        <div>
          <h1 className="admin-users__title">사용자 관리</h1>
          <p className="admin-users__hint">
            {actorDvsn === 'sa_dev'
              ? 'SA_DEV는 전사 사용자를 부서·역할 순으로 봅니다. SA·A는 동일 부서만 표시됩니다. 정지 전 생성 자산이 있으면 이관이 필요합니다.'
              : '동일 부서 사용자만 표시됩니다. 작업물은「목록」, 이관 대상은 sa_dev·sa·a만. 생성 프로젝트·커스텀 역할이 있으면 정지 시 안내합니다.'}
          </p>
        </div>
        {roleOpts.length ? (
          <button
            type="button"
            className="admin-users__btn-head-invite"
            onClick={() => {
              setInviteMsg('')
              setInviteOpen(true)
            }}
          >
            사용자초대
          </button>
        ) : null}
      </div>

      {inviteOpen && roleOpts.length ? (
        <div
          className="admin-users__modal-backdrop"
          role="presentation"
          onClick={() => setInviteOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setInviteOpen(false)}
        >
          <div
            className="admin-users__modal"
            role="dialog"
            aria-labelledby="admin-invite-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-invite-title" className="admin-users__invite-title">
              이메일 초대
            </h2>
            <p className="admin-users__hint">
              {canSetEtlOnInvite
                ? '부서(sa_dev는 전체, sa·a는 본인 부서 트리)를 선택한 뒤 역할·옵션을 지정합니다.'
                : 'a(Admin)은 본인 부서 트리 내로만 초대할 수 있습니다.'}
            </p>
            <form className="admin-users__invite-form" onSubmit={handleInviteSubmit}>
              <label className="admin-users__field">
                이메일
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="admin-users__input"
                  autoComplete="off"
                />
              </label>
              <label className="admin-users__field">
                가입 부서
                <select
                  required
                  value={inviteDeptId}
                  onChange={(e) => setInviteDeptId(e.target.value)}
                  className="admin-users__select"
                >
                  {depts.map((d) => (
                    <option key={String(d.dptmt_info_id)} value={String(d.dptmt_info_id)}>
                      {d.dptmt_name || d.dptmt_info_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-users__field">
                조직 역할 (가입 후 user_dvsn)
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="admin-users__select"
                >
                  {roleOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {canSetEtlOnInvite ? (
                <label className="admin-users__check">
                  <input
                    type="checkbox"
                    checked={inviteEtl}
                    onChange={(e) => setInviteEtl(e.target.checked)}
                  />
                  가입 직후 ETL 인프라 자격 (etl_yn=Y)
                </label>
              ) : null}
              {inviteRole === 'u' ? (
                <>
                  <label className="admin-users__field">
                    프로젝트 멤버 (선택)
                    <select
                      value={inviteProjectId}
                      onChange={(e) => setInviteProjectId(e.target.value)}
                      className="admin-users__select"
                    >
                      <option value="">— 지정 안 함 —</option>
                      {inviteProjects.map((p) => (
                        <option key={String(p.project_info_id)} value={String(p.project_info_id)}>
                          {p.project_name || p.project_info_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-users__field">
                    프로젝트 역할 (pmssn)
                    <select
                      value={invitePmssnId}
                      onChange={(e) => setInvitePmssnId(e.target.value)}
                      className="admin-users__select"
                    >
                      <option value="">— 지정 안 함 —</option>
                      {invitePmssns.map((m) => (
                        <option key={String(m.pmssn_master_id)} value={String(m.pmssn_master_id)}>
                          {m.pmssn_name || m.pmssn_master_id}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <div className="admin-users__modal-actions">
                <button type="button" className="admin-users__btn-muted" onClick={() => setInviteOpen(false)}>
                  닫기
                </button>
                <button type="submit" className="admin-users__btn-ok" disabled={inviteBusy}>
                  {inviteBusy ? '발송 중…' : '초대 메일 보내기'}
                </button>
              </div>
            </form>
            {inviteMsg ? (
              <p
                className={
                  inviteMsg.includes('실패') || inviteMsg.includes('선택')
                    ? 'admin-users__error'
                    : 'admin-users__hint'
                }
              >
                {inviteMsg}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {transferCtx ? (
        <div
          className="admin-users__modal-backdrop"
          role="presentation"
          onClick={() => !transferLoading && setTransferCtx(null)}
        >
          <div className="admin-users__modal admin-users__modal--transfer" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-users__modal-subtitle">이관 대상 선택</h3>
            <p className="admin-users__hint">{transferCtx.label}</p>
            <p className="admin-users__hint">
              동일 부서의 sa_dev·Super Admin·Admin만 표시됩니다. 본인은 포함·원 소유자는 제외됩니다.
            </p>
            {transferErr ? <p className="admin-users__error">{transferErr}</p> : null}
            {transferLoading ? (
              <p className="admin-users__hint">불러오는 중…</p>
            ) : (
              <div className="admin-users__panel-scroll">
                {transferTargets.length ? (
                  transferTargets.map((u) => (
                    <button
                      type="button"
                      key={String(u.user_id)}
                      className="admin-users__pick-user"
                      disabled={transferLoading}
                      onClick={() => runTransfer(u.user_id)}
                    >
                      {u.user_email || u.user_id}
                      {u.user_nickname ? ` · ${u.user_nickname}` : ''}
                      <span className="admin-users__pick-dvsn"> ({u.user_dvsn})</span>
                    </button>
                  ))
                ) : (
                  <p className="admin-users__hint">이관 가능한 사용자가 없습니다.</p>
                )}
              </div>
            )}
            <button
              type="button"
              className="admin-users__btn-muted"
              disabled={transferLoading}
              onClick={() => setTransferCtx(null)}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="admin-users__error">{error}</p> : null}
      {workPanelErr ? <p className="admin-users__error">{workPanelErr}</p> : null}
      {loading ? (
        <p className="admin-users__hint">불러오는 중…</p>
      ) : (
        <div className="admin-users__table-wrap">
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>부서명</th>
                <th>하위부서</th>
                <th>이메일</th>
                <th>닉네임</th>
                <th>역할</th>
                <th>ETL</th>
                <th>상태</th>
                <th>가입일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const uid = row.user_id
                const isSelf = myId != null && uid === myId
                const active = isActive(row)
                const isAdminLockedSa =
                  actorDvsn === 'a' && String(row.user_dvsn || '').toLowerCase() === 'sa'
                const listDisabled = isSelf || busyId === uid
                const actionDisabled = isSelf || busyId === uid || isAdminLockedSa
                const expanded = expandedUid === uid
                const work = workByUser[uid]
                const wBusy = workLoadingUid === uid
                return (
                  <Fragment key={String(uid)}>
                    <tr>
                      <td>{row.dept_name || '—'}</td>
                      <td>{row.dept_sub_name || '—'}</td>
                      <td>{row.user_email || '—'}</td>
                      <td>{row.user_nickname || '—'}</td>
                      <td>{row.user_dvsn || '—'}</td>
                      <td className="admin-users__cell-center">
                        {hasEtlInfra(row) ? '✓' : '—'}
                      </td>
                      <td>{active ? '활성' : '비활성'}</td>
                      <td>{formatDtm(row.create_dtm)}</td>
                      <td>
                        <div className="admin-users__actions">
                          <button
                            type="button"
                            className="admin-users__btn-list"
                            disabled={listDisabled}
                            onClick={() => toggleWorkPanel(uid)}
                          >
                            {expanded ? '목록 닫기' : '목록'}
                          </button>
                          {active ? (
                            <button
                              type="button"
                              className="admin-users__btn-danger"
                              disabled={actionDisabled}
                              onClick={() => handleSuspend(uid)}
                            >
                              정지
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-users__btn-ok"
                              disabled={actionDisabled}
                              onClick={() => handleActivate(uid)}
                            >
                              활성
                            </button>
                          )}
                          {isSelf ? <span className="admin-users__hint">본인</span> : null}
                          {isAdminLockedSa ? <span className="admin-users__hint">A는 SA 관리 불가</span> : null}
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="admin-users__detail-row">
                        <td colSpan={9}>
                          <div className="admin-users__detail-panel">
                            {wBusy ? (
                              <p className="admin-users__hint">작업물 불러오는 중…</p>
                            ) : work ? (
                              <div className="admin-users__panel-scroll admin-users__panel-scroll--tall">
                                {renderAssetList(
                                  '생성한 프로젝트',
                                  work.created_projects,
                                  uid,
                                  'project',
                                  'project_info_id',
                                  'project_name',
                                  true,
                                )}
                                {renderAssetList(
                                  '참여한 프로젝트',
                                  work.participant_projects,
                                  uid,
                                  'project',
                                  'project_info_id',
                                  'project_name',
                                  false,
                                )}
                                {renderAssetList(
                                  '등록한 부서 역할(커스텀)',
                                  work.created_custom_roles,
                                  uid,
                                  'pmssn_master',
                                  'pmssn_master_id',
                                  'pmssn_name',
                                  true,
                                )}
                                {renderAssetList(
                                  '생성 프로젝트에 연결된 테이블',
                                  work.linked_tables,
                                  uid,
                                  'table',
                                  'table_master_id',
                                  'table_label',
                                  false,
                                )}
                                {work.etl_assets_note ? (
                                  <p className="admin-users__hint admin-users__work-etl-note">{work.etl_assets_note}</p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="admin-users__hint">목록을 불러오지 못했습니다. 다시 눌러 보세요.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
