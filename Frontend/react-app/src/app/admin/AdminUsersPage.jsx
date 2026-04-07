/**
 * app/admin/AdminUsersPage.jsx (부서 사용자 관리 S8)
 * ===========================================
 * SA_DEV 전사 사용자 목록(부서·역할·ETL순), 그 외 동일 부서. 부서/하위부서명·ETL 컬럼. 변경·정지 시 소유 매트릭스 불가면 409·blocking_assets(등록 부서 생성자 포함)·목록에서 부서 생성자 이관(dptmt_creator).
 * 본인 행: 이메일 옆「본인」배지. 목록(작업물·이관)만 허용·변경·정지·활성 비활성 시 호버로 안내. 사용자 변경 모달: SA·SA_DEV만 ETL 관리자 자격(etl_yn) 토글.
 * SA_DEV가 마지막 SA를 하향 변경할 때는 저장 직전 추가 확인(confirm)으로 오조작을 방지.
 * 작업물 목록이 비어 있으면 빈 화면 대신 "생성/등록 이력 없음" 안내 문구를 표시.
 * 테이블 마스터가 ETL 생성 테이블이면 목록에서 └ 연쇄 이관 예정을 안내하고, · 줄로 ETL 테이블·Job·배치 Job 식별 라벨을 함께 표시.
 * 작업물 패널: 카테고리(섹션)별 헤더·하위 목록. 각 섹션「전체이관」은 해당 섹션만(전체 작업물 통합 아님). ETL은 대분류로 묶고 하위 6종은 중분류·동일 etl_infra 수신 규칙으로 대분류 전체이관 가능.
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
  getAdminUserChangeOptions,
  getAdminUserWorkAssets,
  getAdminUsers,
  patchAdminUserActivate,
  patchAdminUserSuspend,
  postAdminInvite,
  postAdminTransferOwnership,
  putAdminUserManagement,
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

/** ETL 관리자 자격: sa_dev·레거시 etl_manager·또는 etl_yn=Y (프로젝트 pmssn과 무관, 05 문서와 동일) */
function hasEtlInfra(row) {
  const d = String(row.user_dvsn || '')
    .trim()
    .toLowerCase()
  if (d === 'sa_dev' || d === 'etl_manager') return true
  const e = String(row.etl_yn ?? 'N')
    .trim()
    .toUpperCase()
  return e === 'Y'
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
  const [changeCtx, setChangeCtx] = useState(null)
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeErr, setChangeErr] = useState('')
  /** PUT management 409 — 소유 매트릭스 불가 시 서버 detail(changeable·blocking_assets) */
  const [changeOwnershipBlock, setChangeOwnershipBlock] = useState(null)
  /** PATCH suspend 409 — 동일 payload를 전역 모달로 표시 */
  const [suspendOwnershipBlock, setSuspendOwnershipBlock] = useState(null)
  const [changeForm, setChangeForm] = useState({
    dptmt_info_id: '',
    user_dvsn: '',
    etl_yn: 'N',
    project_info_ids: [],
    project_roles: {},
  })

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
    if (inviteDeptId === '' || inviteDeptId == null) {
      setInviteProjects([])
      setInvitePmssns([])
      return
    }
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
    setTransferCtx({ ...ctx, bulkItems: undefined })
    setTransferErr('')
    setTransferTargets([])
    setTransferLoading(true)
    try {
      const d = await getAdminOwnershipTransferTargets(
        ctx.dptmtInfoId,
        ctx.fromUserId,
        {
          etlInfra: !!ctx.etlInfra,
          resourceType:
            ctx.resourceType === 'table_master'
              ? 'table_master'
              : ctx.resourceType === 'dptmt_creator'
                ? 'dptmt_creator'
                : null,
          tableMasterId:
            ctx.resourceType === 'table_master' ? ctx.resourceId : undefined,
        },
      )
      setTransferTargets(Array.isArray(d?.items) ? d.items : [])
    } catch (e) {
      setTransferErr(e?.message || '이관 가능한 사용자 목록을 불러오지 못했습니다.')
    } finally {
      setTransferLoading(false)
    }
  }, [])

  const openBulkTransferModal = useCallback(async (payloads, fromUserId, categoryTitle) => {
    if (!Array.isArray(payloads) || payloads.length < 2) return
    const first = payloads[0]
    const allEtlInfra = payloads.every((p) => p.etlInfra)
    const label =
      categoryTitle === 'ETL' && allEtlInfra
        ? `「ETL」${payloads.length}건 (대분류·DB·테이블·Job·저장DB·폴더·배치만)`
        : `「${categoryTitle}」${payloads.length}건 (이 카테고리만)`
    setTransferCtx({
      bulkItems: payloads,
      fromUserId,
      categoryTitle,
      label,
      resourceType: first.resourceType,
      resourceId: first.resourceId,
      dptmtInfoId: first.dptmtInfoId,
      etlInfra: !!first.etlInfra,
      tableMasterId: first.resourceType === 'table_master' ? first.resourceId : undefined,
    })
    setTransferErr('')
    setTransferTargets([])
    setTransferLoading(true)
    try {
      const d = await getAdminOwnershipTransferTargets(
        first.dptmtInfoId,
        fromUserId,
        {
          etlInfra: !!first.etlInfra,
          resourceType:
            first.resourceType === 'table_master'
              ? 'table_master'
              : first.resourceType === 'dptmt_creator'
                ? 'dptmt_creator'
                : null,
          tableMasterId:
            first.resourceType === 'table_master' ? first.resourceId : undefined,
        },
      )
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
      const bulk = transferCtx.bulkItems
      const confirmMsg =
        bulk && bulk.length >= 2
          ? transferCtx.categoryTitle === 'ETL' && bulk.every((x) => x.etlInfra)
            ? `「ETL」대분류에 속한 이관 가능 등록 건 ${bulk.length}건을 동일 수신자에게 한 번에 이관합니다. 프로젝트·권한·테이블 마스터 등 비ETL 자산은 포함되지 않습니다. 진행할까요?`
            : `「${transferCtx.categoryTitle || '이 카테고리'}」에 속한 이관 가능 항목 ${bulk.length}건만 동일 수신자에게 이관합니다. 다른 카테고리(섹션) 자산은 포함되지 않습니다. 진행할까요?`
          : '정말 이관하시겠습니까?'
      if (!confirmCrud(confirmMsg)) return
      setTransferLoading(true)
      setTransferErr('')
      try {
        if (bulk && bulk.length >= 2) {
          for (let i = 0; i < bulk.length; i += 1) {
            const it = bulk[i]
            await postAdminTransferOwnership({
              resource_type: it.resourceType,
              resource_id: it.resourceId,
              from_user_id: transferCtx.fromUserId,
              to_user_id: toUserId,
            })
          }
        } else {
          await postAdminTransferOwnership({
            resource_type: transferCtx.resourceType,
            resource_id: transferCtx.resourceId,
            from_user_id: transferCtx.fromUserId,
            to_user_id: toUserId,
          })
        }
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

  const openChangeModal = useCallback(async (uid) => {
    setChangeCtx({ userId: uid, options: null })
    setChangeErr('')
    setChangeOwnershipBlock(null)
    setChangeLoading(true)
    try {
      const data = await getAdminUserChangeOptions(uid)
      const currentIds = Array.isArray(data?.current_project_ids)
        ? data.current_project_ids.map((x) => Number(x))
        : []
      const currentRoleMap = {}
      ;(data?.current_project_assignments || []).forEach((a) => {
        const pid = Number(a?.project_info_id)
        const mid = Number(a?.pmssn_master_id)
        if (Number.isFinite(pid) && Number.isFinite(mid) && pid > 0 && mid > 0) currentRoleMap[pid] = mid
      })
      setChangeCtx({ userId: uid, options: data || null })
      const rawEtl = String(data?.target_user?.etl_yn ?? 'N').toUpperCase()
      const etlNorm = rawEtl === 'Y' ? 'Y' : 'N'
      setChangeForm({
        dptmt_info_id: String(data?.target_user?.dptmt_info_id ?? ''),
        user_dvsn: String(data?.target_user?.user_dvsn ?? ''),
        etl_yn: etlNorm,
        project_info_ids: currentIds,
        project_roles: currentRoleMap,
      })
    } catch (e) {
      setChangeErr(e?.message || '변경 옵션을 불러오지 못했습니다.')
    } finally {
      setChangeLoading(false)
    }
  }, [])

  const toggleProjectSelection = useCallback((projectId, checked) => {
    const pid = Number(projectId)
    setChangeForm((prev) => {
      const set = new Set((prev.project_info_ids || []).map((x) => Number(x)))
      const roles = { ...(prev.project_roles || {}) }
      if (checked) {
        set.add(pid)
        if (!roles[pid]) {
          const project = (changeCtx?.options?.projects || []).find((p) => Number(p.project_info_id) === pid)
          const firstRole = Number(project?.role_options?.[0]?.pmssn_master_id || 0)
          if (firstRole > 0) roles[pid] = firstRole
        }
      } else {
        set.delete(pid)
        delete roles[pid]
      }
      return {
        ...prev,
        project_info_ids: Array.from(set.values()).sort((a, b) => a - b),
        project_roles: roles,
      }
    })
  }, [changeCtx?.options?.projects])

  const changeProjectRole = useCallback((projectId, pmssnId) => {
    const pid = Number(projectId)
    const mid = Number(pmssnId)
    setChangeForm((prev) => ({
      ...prev,
      project_roles: {
        ...(prev.project_roles || {}),
        [pid]: mid,
      },
    }))
  }, [])

  const submitChange = useCallback(async () => {
    if (!changeCtx?.userId) return
    const selected = (changeForm.project_info_ids || []).map((x) => Number(x))
    const hasMissingRole = selected.some((pid) => Number(changeForm.project_roles?.[pid] || 0) <= 0)
    if (hasMissingRole) {
      setChangeErr('체크한 프로젝트의 권한(pmssn)을 모두 선택하세요.')
      return
    }
    const actorDvsn = String(changeCtx.options?.actor_user_dvsn || '').toLowerCase().trim()
    const targetDvsnBefore = String(changeCtx.options?.target_user?.user_dvsn || '').toLowerCase().trim()
    const nextDvsn = String(changeForm.user_dvsn || '').toLowerCase().trim()
    const isSaDemotion = targetDvsnBefore === 'sa' && nextDvsn !== 'sa'
    const isLastSa = !!changeCtx.options?.last_sa_in_department
    if (actorDvsn === 'sa_dev' && isSaDemotion && isLastSa) {
      const dptName = String(changeCtx.options?.last_sa_department_name || '해당')
      const ok = window.confirm(
        `${dptName} 부서의 마지막 SA 사용자입니다. 정말 권한을 변경하시겠습니까?`,
      )
      if (!ok) return
    }
    if (!confirmCrud('해당 사용자의 부서/역할/프로젝트 참여를 변경할까요?')) return
    setChangeErr('')
    setChangeLoading(true)
    try {
      const payload = {
        dptmt_info_id: Number(changeForm.dptmt_info_id),
        user_dvsn: changeForm.user_dvsn,
        project_info_ids: (changeForm.project_info_ids || []).map((x) => Number(x)),
        project_assignments: (changeForm.project_info_ids || []).map((pid) => ({
          project_info_id: Number(pid),
          pmssn_master_id: Number(changeForm.project_roles?.[pid] || 0),
        })),
      }
      if (changeCtx.options?.can_manage_etl_yn) {
        const td = String(changeCtx.options?.target_user?.user_dvsn || '').toLowerCase().trim()
        if (td !== 'sa_dev') {
          payload.etl_yn = changeForm.etl_yn === 'Y' ? 'Y' : 'N'
        }
      }
      await putAdminUserManagement(changeCtx.userId, payload)
      setChangeCtx(null)
      setChangeOwnershipBlock(null)
      await load()
      setExpandedUid(null)
      setWorkByUser({})
    } catch (e) {
      const d = e?.data?.detail
      if (e?.status === 409 && d && typeof d === 'object' && d.changeable === false) {
        setChangeOwnershipBlock(d)
        setChangeErr('')
        return
      }
      setChangeErr(e?.message || '변경 실패')
    } finally {
      setChangeLoading(false)
    }
  }, [changeCtx, changeForm, load])

  async function handleSuspend(userId) {
    if (!confirmCrud('이 사용자를 비활성(정지) 처리할까요?')) return
    setBusyId(userId)
    setError('')
    try {
      await patchAdminUserSuspend(userId)
      await load()
      setSuspendOwnershipBlock(null)
    } catch (e) {
      const d = e?.data?.detail
      if (e?.status === 409 && d && typeof d === 'object' && d.changeable === false) {
        setSuspendOwnershipBlock({ userId, detail: d })
        return
      }
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

  function renderAssetList(
    title,
    rows,
    uid,
    resourceType,
    idKey,
    labelKey,
    showTransfer,
    ownerDeptFallback,
    etlInfraModal,
    nested = false,
    allowBulk = true,
  ) {
    if (!rows?.length) return null
    const transferablePayloads = rows
      .filter((r) => showTransfer && r.transferable)
      .map((r) => {
        const rid = r[idKey]
        const dept = r.dptmt_info_id ?? ownerDeptFallback
        return {
          resourceType,
          resourceId: Number(rid),
          dptmtInfoId: Number(dept),
          etlInfra: !!etlInfraModal,
        }
      })
    const showBulkTransfer = allowBulk && transferablePayloads.length >= 2
    const scopeHint = nested
      ? `「ETL」대분류 안의 중분류「${title}」에 속한 이관 가능 항목만입니다.`
      : `「${title}」섹션의 이관 가능 항목만입니다. 다른 카테고리는 포함되지 않습니다.`
    const headClass = nested ? 'admin-users__work-subsection-head' : 'admin-users__work-section-head'
    const titleClass = nested ? 'admin-users__work-subsection-title' : 'admin-users__work-section-title'
    const panelClass = nested
      ? 'admin-users__work-list-panel admin-users__work-list-panel--nested'
      : 'admin-users__work-list-panel'
    const blockInner = (
      <>
        <div className={headClass}>
          {nested ? (
            <h5 className={titleClass}>{title}</h5>
          ) : (
            <h4 className={titleClass}>{title}</h4>
          )}
          {showBulkTransfer ? (
            <button
              type="button"
              className="ibank-btn-table"
              title={`${scopeHint} ${transferablePayloads.length}건 일괄 이관.`}
              aria-label={`${title} 중분류 전체 이관, ${transferablePayloads.length}건`}
              onClick={() => openBulkTransferModal(transferablePayloads, uid, title)}
            >
              전체이관
            </button>
          ) : null}
        </div>
        <div className={panelClass}>
          <ul className="admin-users__work-list">
            {rows.map((r) => {
              const rid = r[idKey]
              const label =
                labelKey === 'table_label'
                  ? r.table_label || r.table_name || rid
                  : resourceType === 'dptmt_creator' && (r.parent_dptmt_name || '').trim()
                    ? `${r[labelKey] || rid} · 상위 ${r.parent_dptmt_name}`
                    : r[labelKey] || rid
              const dept = r.dptmt_info_id ?? ownerDeptFallback
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
                      className="ibank-btn-table"
                      onClick={() =>
                        openTransferModal({
                          resourceType,
                          resourceId: Number(rid),
                          fromUserId: uid,
                          dptmtInfoId: Number(dept),
                          label: `${title}: ${label}`,
                          etlInfra: !!etlInfraModal,
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
                  {Array.isArray(r.cascade_children) && r.cascade_children.length ? (
                    <div className="admin-users__work-note admin-users__work-cascade">
                      {r.cascade_children.map((line, idx) => {
                        const s = typeof line === 'string' ? line : String(line ?? '')
                        const isDetail = s.startsWith('·')
                        return (
                          <div
                            key={`${title}-${rid}-cascade-${idx}`}
                            className={
                              isDetail
                                ? 'admin-users__work-cascade-line admin-users__work-cascade-line--detail'
                                : 'admin-users__work-cascade-line'
                            }
                          >
                            {s}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      </>
    )
    if (nested) {
      return (
        <div className="admin-users__work-subsection" role="group" aria-label={title}>
          {blockInner}
        </div>
      )
    }
    return (
      <section className="admin-users__work-section" aria-label={title}>
        {blockInner}
      </section>
    )
  }

  /** ETL 대분류: DB연결·테이블·Job·저장DB·폴더·배치. 수신 검증은 etl_infra 동일. */
  function renderEtlMegaSection(work, uid) {
    const ownerDept = work.target_user_dptmt_info_id
    const blocks = [
      ['등록한 ETL DB 연결', work.etl_connections, 'etl_connection', 'connection_id', 'connection_name'],
      ['등록한 ETL 테이블', work.etl_tables, 'etl_table', 'etl_table_id', 'label'],
      ['등록한 ETL 실행 Job', work.etl_jobs, 'etl_job', 'job_id', 'label'],
      ['등록한 저장 DB 연결', work.etl_storage_connections, 'etl_storage_connection', 'storage_connection_id', 'connection_name'],
      ['등록한 배치 폴더 연결', work.batch_folder_connections, 'batch_folder_connection', 'folder_connection_id', 'connection_name'],
      ['등록한 배치 Job', work.batch_jobs, 'batch_job', 'batch_job_id', 'job_name'],
    ]
    const allEtlPayloads = []
    for (const [, rows, rt, ik] of blocks) {
      if (!rows?.length) continue
      for (const r of rows) {
        if (!r.transferable) continue
        const rid = r[ik]
        const dept = r.dptmt_info_id ?? ownerDept
        allEtlPayloads.push({
          resourceType: rt,
          resourceId: Number(rid),
          dptmtInfoId: Number(dept),
          etlInfra: true,
        })
      }
    }
    const hasAnyEtlRows = blocks.some(([, rows]) => Array.isArray(rows) && rows.length > 0)
    if (!hasAnyEtlRows && !work.etl_assets_note) return null
    const showMegaBulk = allEtlPayloads.length >= 2
    return (
      <section className="admin-users__work-section admin-users__work-section--etl-mega" aria-label="ETL">
        <div className="admin-users__work-section-head">
          <h4 className="admin-users__work-section-title">ETL</h4>
          {showMegaBulk ? (
            <button
              type="button"
              className="ibank-btn-table"
              title={`「ETL」대분류의 이관 가능 등록 건 ${allEtlPayloads.length}건(DB·테이블·Job·저장DB·폴더·배치)을 한 번에 이관합니다. 프로젝트·권한·테이블 마스터 등 비ETL 자산은 포함되지 않습니다.`}
              aria-label={`ETL 대분류 전체 이관 ${allEtlPayloads.length}건`}
              onClick={() => openBulkTransferModal(allEtlPayloads, uid, 'ETL')}
            >
              전체이관
            </button>
          ) : null}
        </div>
        {hasAnyEtlRows ? (
          <div className="admin-users__work-etl-nested-wrap">
            {blocks.map(([btitle, rows, rt, ik, lk]) =>
              renderAssetList(
                btitle,
                rows || [],
                uid,
                rt,
                ik,
                lk,
                true,
                ownerDept,
                true,
                true,
              ),
            )}
          </div>
        ) : null}
        {work.etl_assets_note ? (
          <p className="admin-users__hint admin-users__work-etl-note">{work.etl_assets_note}</p>
        ) : null}
      </section>
    )
  }

  function hasAnyWorkAssets(work) {
    if (!work) return false
    const keys = [
      'created_projects',
      'participant_projects',
      'created_custom_roles',
      'created_departments',
      'linked_tables',
      'etl_connections',
      'etl_tables',
      'etl_jobs',
      'etl_storage_connections',
      'batch_folder_connections',
      'batch_jobs',
    ]
    return keys.some((k) => Array.isArray(work[k]) && work[k].length > 0)
  }

  function ownershipGroupTitle(t) {
    const m = {
      project: '프로젝트 (생성자)',
      pmssn_master: '등록한 권한',
      table_master: '테이블 마스터',
      dptmt_creator: '등록한 부서 (생성자)',
      etl_meta: 'ETL 등록',
    }
    return m[t] || t
  }

  function renderOwnershipBlock(detail) {
    if (!detail?.blocking_assets?.length) return null
    return (
      <div className="admin-users__ownership-block" role="region" aria-label="이관 필요 소유">
        {detail.message ? <p className="admin-users__ownership-summary">{detail.message}</p> : null}
        {detail.blocking_assets.map((g) => (
          <div key={g.type} className="admin-users__ownership-group">
            <h4 className="admin-users__ownership-group-title">{ownershipGroupTitle(g.type)}</h4>
            <ul className="admin-users__ownership-list">
              {(g.items || []).map((it, idx) => (
                <li key={`${g.type}-${it.resource_type}-${it.resource_id}-${idx}`}>
                  <span className="admin-users__ownership-name">{it.name}</span>
                  <span className="admin-users__ownership-reason">{it.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {Array.isArray(detail.allowed_assets) && detail.allowed_assets.length ? (
          <div className="admin-users__ownership-allowed">
            <strong>역할·ETL 자격 유지 시 그대로 두는 항목</strong>
            <ul>
              {detail.allowed_assets.map((a) => (
                <li key={a.type}>
                  {ownershipGroupTitle(a.type)} {a.count}건 — {a.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="admin-users__hint">「목록」에서 해당 항목을 이관한 뒤 다시 저장하세요.</p>
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
              ? 'SA_DEV는 전사 사용자를 부서·역할 순으로 봅니다. SA·A는 관리 트리 내 사용자만 표시됩니다. 정지 전 이관 필요 자산(프로젝트·역할·ETL 등록)이 있으면 안내합니다.'
              : '관리 트리 내 사용자만 표시됩니다. 프로젝트·역할 이관은 sa_dev·sa·a, ETL 등록 건 이관은 동일 부서 ETL 관리자 자격(etl_yn 또는 SA_DEV)이 있는 사용자가 받을 수 있습니다.'}
          </p>
        </div>
        {roleOpts.length ? (
          <button
            type="button"
            className="ibank-btn-toolbar"
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
            <h2 id="admin-invite-title" className="admin-users__modal-title">
              이메일 초대
            </h2>
            <p className="admin-users__modal-hint">
              {canSetEtlOnInvite
                ? '부서(sa_dev는 전체, sa·a는 본인 부서 트리)를 선택한 뒤 역할·옵션을 지정합니다.'
                : 'a(Admin)은 본인 부서 트리 내로만 초대할 수 있습니다.'}
            </p>
            <form className="admin-users__invite-form admin-users__modal-form" onSubmit={handleInviteSubmit}>
              <label className="admin-users__field admin-users__field--full">
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
              <div className="admin-users__grid-2">
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
                        {d.display_label || d.dptmt_name || d.dptmt_info_id}
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
              </div>
              {canSetEtlOnInvite ? (
                <label className="admin-users__check">
                  <input
                    type="checkbox"
                    checked={inviteEtl}
                    onChange={(e) => setInviteEtl(e.target.checked)}
                  />
                  가입 직후 ETL 관리자 자격 (etl_yn=Y)
                </label>
              ) : null}
              {inviteRole === 'u' ? (
                <div className="admin-users__grid-2">
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
                </div>
              ) : null}
              <div className="admin-users__modal-actions">
                <button type="button" className="ibank-btn-toolbar ibank-btn-toolbar--secondary" onClick={() => setInviteOpen(false)}>
                  닫기
                </button>
                <button type="submit" className="ibank-btn-toolbar" disabled={inviteBusy}>
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

      {changeCtx ? (
        <div
          className="admin-users__modal-backdrop"
          role="presentation"
          onClick={() => {
            if (changeLoading) return
            setChangeCtx(null)
            setChangeOwnershipBlock(null)
          }}
        >
          <div className="admin-users__modal admin-users__modal--change" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-users__modal-title">사용자 변경</h3>
            {changeErr ? <p className="admin-users__error">{changeErr}</p> : null}
            {changeOwnershipBlock ? renderOwnershipBlock(changeOwnershipBlock) : null}
            {changeLoading && !changeCtx.options ? (
              <p className="admin-users__hint">불러오는 중…</p>
            ) : (
              <>
                <label className="admin-users__field">
                  부서
                  <select
                    className="admin-users__select"
                    value={changeForm.dptmt_info_id}
                    onChange={(e) => setChangeForm((p) => ({ ...p, dptmt_info_id: e.target.value }))}
                  >
                    {(changeCtx.options?.departments || []).map((d) => (
                      <option key={String(d.dptmt_info_id)} value={String(d.dptmt_info_id)}>
                        {d.display_label || d.dptmt_name || d.dptmt_info_id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-users__field">
                  역할
                  <select
                    className="admin-users__select"
                    value={changeForm.user_dvsn}
                    onChange={(e) => setChangeForm((p) => ({ ...p, user_dvsn: e.target.value }))}
                  >
                    {(changeCtx.options?.role_options || []).map((r) => (
                      <option key={String(r.value)} value={String(r.value)}>
                        {r.label || r.value}
                      </option>
                    ))}
                  </select>
                </label>
                {changeCtx.options?.can_manage_etl_yn &&
                String(changeCtx.options?.target_user?.user_dvsn || '')
                  .toLowerCase()
                  .trim() !== 'sa_dev' ? (
                  <label className="admin-users__check">
                    <input
                      type="checkbox"
                      checked={changeForm.etl_yn === 'Y'}
                      onChange={(e) =>
                        setChangeForm((p) => ({ ...p, etl_yn: e.target.checked ? 'Y' : 'N' }))
                      }
                    />
                    ETL 관리자 자격 부여
                  </label>
                ) : changeCtx.options?.can_manage_etl_yn &&
                  String(changeCtx.options?.target_user?.user_dvsn || '')
                    .toLowerCase()
                    .trim() === 'sa_dev' ? (
                  <div className="admin-users__field">
                    ETL 관리자 자격
                    <p className="admin-users__hint">SA_DEV 계정은 etl_yn을 변경할 수 없습니다.</p>
                  </div>
                ) : (
                  <div className="admin-users__field">
                    ETL 관리자 자격
                    <p className="admin-users__hint">
                      현재 {changeForm.etl_yn === 'Y' ? '부여(Y)' : '미부여(N)'} — SA 또는 SA_DEV만 변경할 수 있습니다.
                    </p>
                  </div>
                )}
                <div className="admin-users__field">
                  프로젝트 참여
                  <div className="admin-users__panel-scroll admin-users__panel-scroll--change">
                    {(changeCtx.options?.projects || []).length ? (
                      (changeCtx.options?.projects || []).map((p) => {
                        const pid = Number(p.project_info_id)
                        const selected = (changeForm.project_info_ids || []).includes(pid)
                        const assignable = String(p.assignable_by_actor || 'N').toUpperCase() === 'Y'
                        const disabled = !assignable && !selected
                        const selectedRoleId = Number(changeForm.project_roles?.[pid] || 0)
                        const selectedRoleName =
                          (p.role_options || []).find((r) => Number(r.pmssn_master_id) === selectedRoleId)?.pmssn_name ||
                          (selected ? p.pmssn_name || '권한 미선택' : '')
                        return (
                          <div key={String(pid)} className="admin-users__proj-item">
                            <label className="admin-users__check admin-users__proj-check">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={disabled}
                                onChange={(e) => toggleProjectSelection(pid, e.target.checked)}
                              />
                              <span className="admin-users__proj-name">{p.project_name || pid}</span>
                              {selected ? (
                                <span className="admin-users__proj-role-badge">{selectedRoleName}</span>
                              ) : null}
                              {!assignable ? <span className="admin-users__hint"> (타부서 추가 불가)</span> : null}
                            </label>
                            {selected ? (
                              <div className="admin-users__proj-role-row">
                                <select
                                  className="admin-users__select"
                                  value={selectedRoleId ? String(selectedRoleId) : ''}
                                  onChange={(e) => changeProjectRole(pid, e.target.value)}
                                  disabled={!assignable}
                                >
                                  <option value="">— 권한 선택 —</option>
                                  {(p.role_options || []).map((r) => (
                                    <option key={String(r.pmssn_master_id)} value={String(r.pmssn_master_id)}>
                                      {r.pmssn_name || r.pmssn_master_id}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <p className="admin-users__empty">참여 가능한 프로젝트가 없습니다.</p>
                    )}
                  </div>
                </div>
                <div className="admin-users__modal-actions">
                  <button
                    type="button"
                    className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                    disabled={changeLoading}
                    onClick={() => {
                      setChangeCtx(null)
                      setChangeOwnershipBlock(null)
                    }}
                  >
                    취소
                  </button>
                  <button type="button" className="ibank-btn-toolbar" disabled={changeLoading} onClick={submitChange}>
                    {changeLoading ? '변경 중…' : '변경'}
                  </button>
                </div>
              </>
            )}
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
            <h3 className="admin-users__modal-title">이관 대상 선택</h3>
            <p className="admin-users__modal-hint">{transferCtx.label}</p>
            {transferCtx.bulkItems && transferCtx.bulkItems.length >= 2 ? (
              <p className="admin-users__modal-hint admin-users__modal-hint--emph">
                {transferCtx.bulkItems.every((x) => x.etlInfra) ? (
                  <>
                    <strong>「{transferCtx.categoryTitle || 'ETL'}」</strong> 범위의 ETL 등록 건만{' '}
                    {transferCtx.bulkItems.length}건 이관합니다. 수신 조건은 모두{' '}
                    <strong>ETL 관리자(활성·etl_yn 또는 SA_DEV·관리 범위)</strong>로 동일합니다. 수신 후보 목록은{' '}
                    <strong>첫 번째 항목</strong> 기준으로 조회됩니다.
                    {transferCtx.categoryTitle === 'ETL' ? (
                      <>
                        {' '}
                        프로젝트·권한·테이블 마스터(원장) 등 <strong>비ETL</strong> 섹션은 포함되지 않습니다.
                      </>
                    ) : (
                      <>
                        {' '}
                        다른 대분류(프로젝트·권한·테이블 마스터·ETL의 다른 중분류 일괄)는 이 작업에 포함되지 않습니다.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <strong>「{transferCtx.categoryTitle || '이 카테고리'}」</strong> 안의 이관 가능 항목{' '}
                    {transferCtx.bulkItems.length}건만 이관합니다. 위·아래 다른 섹션은 <strong>포함되지 않습니다</strong>.
                    수신 후보 목록은 <strong>첫 번째 항목</strong> 기준으로 조회됩니다. 테이블 마스터 등은 항목별 수신
                    조건이 달라 동일 수신자로 일부만 성공할 수 있습니다.
                  </>
                )}
              </p>
            ) : null}
            <p className="admin-users__modal-hint">
              아래 목록은 서버에서 이관 수신이 가능한 사용자만 골라 보여 줍니다. 부서원 전체가 아닙니다. 원 소유자는 제외됩니다.
            </p>
            <p className="admin-users__modal-hint">
              {transferCtx.etlInfra
                ? '조건: 동일 부서·활성·(ETL 관리자 자격 etl_yn=Y 또는 SA_DEV 역할)·관리자 관리 범위 내. 부서 SA는 SA_DEV 수신 불가.'
                : transferCtx.resourceType === 'table_master'
                  ? '조건: 매핑 프로젝트에서 query.execute(저장 테이블과 동일) 또는 원 소유자와 동일 부서 SA/A, 또는 SA_DEV·관리 범위 내. 부서 SA는 SA_DEV 수신 불가.'
                  : transferCtx.resourceType === 'dptmt_creator'
                    ? '조건: 해당 부서와 동일 부서 트리(상·하위) 소속·활성·부서 추가 가능 역할(SA 또는 SA_DEV)·관리 범위 내. 부서 SA는 SA_DEV 수신 불가.'
                    : '조건: 동일 부서·활성·SA_DEV·SA·A 역할·관리 범위 내.'}
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
                  <div className="admin-users__empty" role="status">
                    <p className="admin-users__empty-title">이관을 받을 수 있는 사용자가 없습니다</p>
                    <p className="admin-users__hint">
                      {transferCtx.etlInfra
                        ? '동일 부서에서 ETL 관리자 자격(etl_yn=Y) 또는 SA_DEV이면서, 귀하의 관리 범위에 속한 다른 활성 사용자가 없습니다.'
                        : transferCtx.resourceType === 'table_master'
                          ? '테이블 마스터 수신 조건(query.execute·동일 부서 SA/A·SA_DEV 등)과 관리 범위를 동시에 만족하는 다른 사용자가 없습니다.'
                          : transferCtx.resourceType === 'dptmt_creator'
                            ? '동일 부서 트리에서 부서 생성 가능(SA·SA_DEV)이면서 관리 범위에 속한 다른 활성 사용자가 없습니다.'
                            : '동일 부서의 SA_DEV·SA·A 중 관리 범위에 속한 다른 활성 사용자가 없습니다.'}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="admin-users__modal-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                disabled={transferLoading}
                onClick={() => setTransferCtx(null)}
              >
                취소
              </button>
            </div>
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
                <th
                  title="ETL API(etl_db) 관리 자격: SA_DEV 또는 user_info.etl_yn=Y. 프로젝트 pmssn(예: project_all)과 별개입니다."
                >
                  ETL 관리
                </th>
                <th>상태</th>
                <th>가입일</th>
                <th className="admin-users__th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const uid = row.user_id
                const isSelf = myId != null && uid === myId
                const active = isActive(row)
                const isAdminLockedSa =
                  actorDvsn === 'a' && String(row.user_dvsn || '').toLowerCase() === 'sa'
                const listDisabled = busyId === uid
                const actionDisabled = isSelf || busyId === uid || isAdminLockedSa
                const actionDisabledTitle =
                  busyId === uid
                    ? '처리 중입니다.'
                    : isSelf
                      ? '본인 계정입니다. 목록에서 작업물 확인·소유 이관만 가능합니다.'
                      : isAdminLockedSa
                        ? 'Admin(A)은 SA 사용자의 변경·정지·활성을 할 수 없습니다.'
                        : ''
                const expanded = expandedUid === uid
                const work = workByUser[uid]
                const wBusy = workLoadingUid === uid
                return (
                  <Fragment key={String(uid)}>
                    <tr>
                      <td>{row.dept_name || '—'}</td>
                      <td>{row.dept_sub_name || '—'}</td>
                      <td>
                        <span className="admin-users__email-cell">
                          <span className="admin-users__email-text">{row.user_email || '—'}</span>
                          {isSelf ? (
                            <span className="admin-users__self-badge" title="본인 계정">
                              본인
                            </span>
                          ) : null}
                        </span>
                      </td>
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
                            className="ibank-btn-table"
                            disabled={listDisabled}
                            onClick={() => toggleWorkPanel(uid)}
                          >
                            {expanded ? '목록 닫기' : '목록'}
                          </button>
                          {actionDisabled ? (
                            <span
                              className="admin-users__action-disabled-wrap"
                              title={actionDisabledTitle}
                            >
                              <button type="button" className="ibank-btn-table" disabled>
                                변경
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ibank-btn-table"
                              onClick={() => openChangeModal(uid)}
                            >
                              변경
                            </button>
                          )}
                          {active ? (
                            actionDisabled ? (
                              <span
                                className="admin-users__action-disabled-wrap"
                                title={actionDisabledTitle}
                              >
                                <button type="button" className="ibank-btn-table ibank-btn-table--danger" disabled>
                                  정지
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="ibank-btn-table ibank-btn-table--danger"
                                onClick={() => handleSuspend(uid)}
                              >
                                정지
                              </button>
                            )
                          ) : actionDisabled ? (
                            <span
                              className="admin-users__action-disabled-wrap"
                              title={actionDisabledTitle}
                            >
                              <button type="button" className="ibank-btn-table ibank-btn-table--primary" disabled>
                                활성
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ibank-btn-table ibank-btn-table--primary"
                              onClick={() => handleActivate(uid)}
                            >
                              활성
                            </button>
                          )}
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
                                  work.target_user_dptmt_info_id,
                                  false,
                                )}
                                {renderAssetList(
                                  '참여한 프로젝트',
                                  work.participant_projects,
                                  uid,
                                  'project',
                                  'project_info_id',
                                  'project_name',
                                  false,
                                  work.target_user_dptmt_info_id,
                                  false,
                                )}
                                {renderAssetList(
                                  '등록한 권한',
                                  work.created_custom_roles,
                                  uid,
                                  'pmssn_master',
                                  'pmssn_master_id',
                                  'pmssn_name',
                                  true,
                                  work.target_user_dptmt_info_id,
                                  false,
                                )}
                                {renderAssetList(
                                  '등록한 부서',
                                  work.created_departments,
                                  uid,
                                  'dptmt_creator',
                                  'dptmt_info_id',
                                  'dptmt_name',
                                  true,
                                  work.target_user_dptmt_info_id,
                                  false,
                                  false,
                                )}
                                {renderAssetList(
                                  '등록한 테이블 마스터(저장·적재 원장)',
                                  work.linked_tables,
                                  uid,
                                  'table_master',
                                  'table_master_id',
                                  'table_label',
                                  true,
                                  work.target_user_dptmt_info_id,
                                  false,
                                )}
                                {renderEtlMegaSection(work, uid)}
                                {!hasAnyWorkAssets(work) ? (
                                  <p className="admin-users__hint">생성/등록한 이력이 없습니다.</p>
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

      {suspendOwnershipBlock ? (
        <div
          className="admin-users__modal-backdrop"
          role="presentation"
          onClick={() => setSuspendOwnershipBlock(null)}
        >
          <div className="admin-users__modal admin-users__modal--change" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-users__modal-title">정지 전 이관 필요</h3>
            {renderOwnershipBlock(suspendOwnershipBlock.detail)}
            <div className="admin-users__modal-actions">
              <button
                type="button"
                className="ibank-btn-toolbar"
                onClick={() => {
                  const uid = suspendOwnershipBlock.userId
                  setSuspendOwnershipBlock(null)
                  setExpandedUid(uid)
                }}
              >
                목록 열고 이관
              </button>
              <button
                type="button"
                className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                onClick={() => setSuspendOwnershipBlock(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
