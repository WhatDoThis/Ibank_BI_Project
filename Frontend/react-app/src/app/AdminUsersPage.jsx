/**
 * app/AdminUsersPage.jsx (부서 사용자 관리 S8)
 * ===========================================
 * GET /api/admin/users, 초대 폼(/users/invite·/invite/*), PATCH suspend|activate.
 *
 * [Main Functions]
 * ===========
 * - AdminUsersPage
 *
 * [Dependencies]
 * =========
 * - shared/api/adminClient, app/AuthContext
 */

import { useCallback, useEffect, useState } from 'react'

import {
  getAdminInviteDepartments,
  getAdminInviteProjects,
  getAdminInviteRoles,
  getAdminUsers,
  patchAdminUserActivate,
  patchAdminUserSuspend,
  postAdminInvite,
} from '@/shared/api/adminClient.js'

import { useAuth } from './AuthContext.jsx'
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

const ROLE_OPTIONS_SA = [
  { value: 'super_admin', label: 'Super Admin (부서장)' },
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'user', label: 'User' },
]

const ROLE_OPTIONS_ADMIN = [
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'user', label: 'User' },
]

function roleChoices(actorDvsn) {
  const d = (actorDvsn || '').toLowerCase()
  if (d === 'sa_dev' || d === 'super_admin') return ROLE_OPTIONS_SA
  if (d === 'admin') return ROLE_OPTIONS_ADMIN
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
  const [inviteRole, setInviteRole] = useState('user')
  const [inviteEtl, setInviteEtl] = useState(false)
  const [inviteProjects, setInviteProjects] = useState([])
  const [invitePmssns, setInvitePmssns] = useState([])
  const [inviteProjectId, setInviteProjectId] = useState('')
  const [invitePmssnId, setInvitePmssnId] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

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
  const canSetEtlOnInvite = actorDvsn === 'super_admin' || actorDvsn === 'sa_dev'
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
    if (!Number.isFinite(rid) || rid < 1) {
      setInviteProjects([])
      setInvitePmssns([])
      return
    }
    if (inviteRole !== 'user') {
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
    if (!Number.isFinite(did) || did < 1) {
      setInviteMsg('가입 부서를 선택하세요.')
      return
    }
    if (inviteRole === 'user') {
      const pid = Number(inviteProjectId)
      const mid = Number(invitePmssnId)
      const needP = Number.isFinite(pid) && pid >= 1
      const needM = Number.isFinite(mid) && mid >= 1
      if (needP !== needM) {
        setInviteMsg('U 초대 시 프로젝트와 역할(pmssn)은 둘 다 선택하거나 둘 다 비웁니다.')
        return
      }
    }
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
      if (inviteRole === 'user' && inviteProjectId && invitePmssnId) {
        body.invite_project_info_id = Number(inviteProjectId)
        body.invite_pmssn_master_id = Number(invitePmssnId)
      }
      await postAdminInvite(body)
      setInviteMsg('초대 메일을 발송했습니다.')
      setInviteEmail('')
    } catch (e) {
      setInviteMsg(e?.message || '초대 실패')
    } finally {
      setInviteBusy(false)
    }
  }

  async function handleSuspend(userId) {
    setBusyId(userId)
    setError('')
    try {
      await patchAdminUserSuspend(userId)
      await load()
    } catch (e) {
      setError(e?.message || '정지 처리 실패')
    } finally {
      setBusyId(null)
    }
  }

  async function handleActivate(userId) {
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

  return (
    <div className="admin-users">
      <h1 className="admin-users__title">사용자 관리</h1>
      <p className="admin-users__hint">
        같은 부서 소속 사용자 목록입니다. 역할 정책에 따라 정지·활성 대상이 제한됩니다.
      </p>
      {roleOpts.length ? (
        <section className="admin-users__invite" aria-label="회원 초대">
          <h2 className="admin-users__invite-title">이메일 초대</h2>
          <p className="admin-users__hint">
            {canSetEtlOnInvite
              ? '부서(SA_DEV는 전체, SA·A는 본인 부서 트리)를 선택한 뒤 역할·옵션을 지정합니다.'
              : 'Admin은 본인 부서 트리 내로만 초대할 수 있습니다.'}
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
            {inviteRole === 'user' ? (
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
            <button type="submit" className="admin-users__btn-ok" disabled={inviteBusy}>
              {inviteBusy ? '발송 중…' : '초대 메일 보내기'}
            </button>
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
        </section>
      ) : null}
      {error ? <p className="admin-users__error">{error}</p> : null}
      {loading ? (
        <p className="admin-users__hint">불러오는 중…</p>
      ) : (
        <div className="admin-users__table-wrap">
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>이메일</th>
                <th>닉네임</th>
                <th>역할</th>
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
                const disabled = isSelf || busyId === uid
                return (
                  <tr key={String(uid)}>
                    <td>{row.user_email || '—'}</td>
                    <td>{row.user_nickname || '—'}</td>
                    <td>{row.user_dvsn || '—'}</td>
                    <td>{active ? '활성' : '비활성'}</td>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td>
                      <div className="admin-users__actions">
                        {active ? (
                          <button
                            type="button"
                            className="admin-users__btn-danger"
                            disabled={disabled}
                            onClick={() => handleSuspend(uid)}
                          >
                            정지
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-users__btn-ok"
                            disabled={disabled}
                            onClick={() => handleActivate(uid)}
                          >
                            활성
                          </button>
                        )}
                        {isSelf ? (
                          <span className="admin-users__hint">본인</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
