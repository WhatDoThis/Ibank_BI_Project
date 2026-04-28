/**
 * app/admin/UserHistoryPage.jsx (통합 이력 조회 — 로그인·시스템·데이터 추적)
 * ============================================================
 * `docs/report/22` §8.1: `tab=login|system|changes` URL 동기화(ETLPage 패턴). 로그인은 GET …/login-history/org, 시스템은 GET …/system-logs, 데이터 추적은 GET …/change-logs(`getChangeLogsPaged`, 시스템 이력과 동일하게 일시 오른쪽에 UUID·상관 ID 노출).
 *
 * [Main Functions]
 * ===========
 * 1. UserHistoryPage — 필터 폼·시스템 상세·시스템「추적」모달(`has_scoped_change_logs`일 때만 조회 버튼)·`changes`(데이터 추적) 탭: 일시 다음 UUID·행 재클릭 시 상세 접기·JSON 복사·페이지네이션(AdminListPaginationFooter)
 *
 * [Dependencies]
 * =========
 * - react-router-dom (useSearchParams, Link)
 * - shared/api/systemLogClient (getLoginHistoryOrg, getSystemLogsOrg, getSystemLogChanges, getChangeLogsPaged, downloadUserHistoryCsv)
 * - app/admin/admin-pages.css(`ap__back` 상단 링크), app/admin/admin-users.css, app/admin/admin-list-table.css(필터 바·1~6과 동일), app/admin/user-history.css
 * - shared/components/AdminListPaginationFooter(admin-list-pagination.css 포함)
 */

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import AdminListPaginationFooter from '@/shared/components/AdminListPaginationFooter.jsx'
import {
  downloadUserHistoryCsv,
  getChangeLogsPaged,
  getLoginHistoryOrg,
  getSystemLogChanges,
  getSystemLogsOrg,
} from '@/shared/api/systemLogClient.js'

import './admin-pages.css'
import './admin-users.css'
import './admin-list-table.css'
import './user-history.css'

const VALID_TABS = ['login', 'system', 'changes']

/** 서버 `MAX_CSV_EXPORT_ROWS` 와 동일(안내·확인 버튼 비활성) */
const CSV_MAX_ROWS = 50000

/** 서버 `MAX_HISTORY_FILTER_SPAN_DAYS` 와 동일(시작·종료일 둘 다 있을 때) */
const MAX_FILTER_SPAN_DAYS = 92

/** 로그인 테이블 헤더(일시·사용자·결과)와 동일한 정렬 라벨, value 는 API `sort_by` */
const LOGIN_SORT_OPTIONS = [
  { value: 'create_dtm', label: '일시' },
  { value: 'user_email', label: '사용자' },
  { value: 'login_success_yn', label: '결과' },
]

/** 시스템 테이블 헤더와 동일한 정렬 라벨 */
const SYSTEM_SORT_OPTIONS = [
  { value: 'create_dtm', label: '일시' },
  { value: 'channel', label: '페이지' },
  { value: 'action_kind', label: '행위' },
  { value: 'success_yn', label: '상태' },
  { value: 'actor_user_id', label: '사용자' },
]

function sortLabel(tab, sortBy) {
  const opts = tab === 'login' ? LOGIN_SORT_OPTIONS : SYSTEM_SORT_OPTIONS
  return opts.find((o) => o.value === sortBy)?.label ?? sortBy
}

/** 시작·종료일이 모두 있을 때만 검사. 위반 시 한글 메시지, 없으면 빈 문자열. */
function validateHistoryDateRange(fromD, toD) {
  const f = (fromD || '').trim()
  const t = (toD || '').trim()
  if (!f || !t) return ''
  const a = new Date(`${f}T00:00:00`)
  const b = new Date(`${t}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return '시작일·종료일 형식을 확인하세요.'
  }
  if (b < a) return '종료일은 시작일 이후여야 합니다.'
  const days = Math.round((b.getTime() - a.getTime()) / 86400000)
  if (days > MAX_FILTER_SPAN_DAYS) {
    return `조회 기간은 최대 ${MAX_FILTER_SPAN_DAYS}일(약 3개월)까지입니다.`
  }
  return ''
}

/** `yyyy-mm-dd` 로컬 자정 기준으로 `deltaDays` 만큼 이동한 ISO 일자. */
function addDaysIso(isoDay, deltaDays) {
  const s = (isoDay || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ''
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * `type="date"`용 min/max. 한쪽만 있으면 그날을 기준으로 반대쪽은 [기준, 기준+92] 또는 [기준-92, 기준].
 * 둘 다 있으면 서버와 동일하게 각 필드에 교차 제한.
 */
function dateInputBounds(fromD, toD) {
  const f = (fromD || '').trim()
  const t = (toD || '').trim()
  let fromMin
  let fromMax
  let toMin
  let toMax
  if (f && !t) {
    toMin = f
    toMax = addDaysIso(f, MAX_FILTER_SPAN_DAYS)
  } else if (!f && t) {
    fromMin = addDaysIso(t, -MAX_FILTER_SPAN_DAYS)
    fromMax = t
  } else if (f && t) {
    fromMin = addDaysIso(t, -MAX_FILTER_SPAN_DAYS)
    fromMax = t
    toMin = f
    toMax = addDaysIso(f, MAX_FILTER_SPAN_DAYS)
  }
  return { fromMin, fromMax, toMin, toMax }
}

function buildAppliedFilterLines(applied, tab) {
  if (tab === 'changes') {
    const lines = []
    if (applied.fromD?.trim()) lines.push(`일시 시작: ${applied.fromD}`)
    if (applied.toD?.trim()) lines.push(`일시 종료: ${applied.toD}`)
    if (applied.chgTable?.trim()) lines.push(`대상 테이블: ${applied.chgTable.trim()}`)
    if (applied.chgPk?.trim()) lines.push(`PK 값: ${applied.chgPk.trim()}`)
    if (applied.chgChannel?.trim()) lines.push(`카테고리: ${applied.chgChannel.trim()}`)
    return lines.length ? lines : ['없음']
  }
  const lines = []
  if (applied.userKey?.trim()) lines.push(`사용자: ${applied.userKey.trim()}`)
  if (applied.fromD?.trim()) lines.push(`일시 시작: ${applied.fromD}`)
  if (applied.toD?.trim()) lines.push(`일시 종료: ${applied.toD}`)
  if (applied.ipContains?.trim()) lines.push(`IP: ${applied.ipContains.trim()}`)
  if (tab === 'system') {
    if (applied.channel?.trim()) lines.push(`페이지: ${applied.channel.trim()}`)
    if (applied.actionKind?.trim()) lines.push(`행위: ${applied.actionKind.trim()}`)
    if (applied.successYn?.trim()) {
      const yn = (applied.successYn || '').toUpperCase()
      lines.push(`상태: ${yn === 'Y' ? '성공' : '실패'}`)
    }
  }
  return lines.length ? lines : ['없음']
}

/** 적용된 정렬(서버 `sort_by`·`sort_dir`와 동일, 단일). `changes` 탭은 API 고정 정렬. */
function buildSortLines(tab, applied) {
  if (tab === 'changes') {
    return ['정렬: 일시 내림차순(고정)']
  }
  const byNorm =
    tab === 'login' ? applied.sortLoginBy || 'create_dtm' : applied.sortSystemBy || 'create_dtm'
  const dirNorm =
    tab === 'login' ? applied.sortLoginDir || 'desc' : applied.sortSystemDir || 'desc'
  const label = sortLabel(tab, byNorm)
  const dirKo = dirNorm === 'asc' ? '오름차순' : '내림차순'
  return [`${label} (${dirKo})`]
}

function formatDtm(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ko-KR')
  } catch {
    return String(v)
  }
}

/** 시스템 이력(`request_correlation_id`)·데이터 추적(`correlation_id`) — 일시 오른쪽 열. */
function UuidTableCell({ value }) {
  const s = value != null ? String(value).trim() : ''
  if (!s) {
    return <td className="user-history__col-uuid">—</td>
  }
  return (
    <td className="user-history__col-uuid" title={s}>
      <span className="user-history__uuid-inner">{s}</span>
    </td>
  )
}

function shortenJson(obj, max = 100) {
  try {
    const s = JSON.stringify(obj ?? {})
    if (s.length <= max) return s
    return `${s.slice(0, max)}…`
  } catch {
    return '—'
  }
}

/** 모달 `pre`용: 객체·배열만 pretty-print, 그 외 문자열. */
function formatJsonForPre(v) {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

/** 클립보드 복사(실패 시 prompt 폴백). */
async function copyStringToClipboard(text) {
  const s = String(text ?? '')
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    try {
      window.prompt('클립보드 복사에 실패했습니다. 아래를 선택해 복사(Ctrl+C)하세요.', s)
    } catch {
      /* ignore */
    }
  }
}

/** `changes` 탭·시스템 로그 변경 모달 공통 — changed_fields·이전/변경 데이터 JSON·복사. */
function DataChangeLogDetailBlocks({ row, layoutClass }) {
  const wrap = layoutClass || 'user-history__changes-list-detail'
  const cf = formatJsonForPre(row?.changed_fields)
  const od = formatJsonForPre(row?.old_data)
  const nd = formatJsonForPre(row?.new_data)
  return (
    <div className={wrap}>
      <div className="user-history__changes-json-block">
        <div className="user-history__changes-json-heading">
          <span>변경 필드</span>
          <button
            type="button"
            className="ibank-btn-toolbar ibank-btn-toolbar--secondary user-history__btn-copy-json"
            onClick={() => copyStringToClipboard(cf)}
          >
            JSON 복사
          </button>
        </div>
        <pre className="user-history__changes-json user-history__changes-json--fields user-history__changes-json--scroll">
          {cf}
        </pre>
      </div>

      <details className="user-history__changes-json-details">
        <summary className="user-history__changes-json-summary">
          <span className="user-history__changes-json-summary-text">이전 데이터</span>
          <button
            type="button"
            className="ibank-btn-toolbar ibank-btn-toolbar--secondary user-history__btn-copy-json"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              copyStringToClipboard(od)
            }}
          >
            JSON 복사
          </button>
        </summary>
        <pre className="user-history__changes-json user-history__changes-json--scroll">{od}</pre>
      </details>

      <details className="user-history__changes-json-details">
        <summary className="user-history__changes-json-summary">
          <span className="user-history__changes-json-summary-text">변경 데이터</span>
          <button
            type="button"
            className="ibank-btn-toolbar ibank-btn-toolbar--secondary user-history__btn-copy-json"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              copyStringToClipboard(nd)
            }}
          >
            JSON 복사
          </button>
        </summary>
        <pre className="user-history__changes-json user-history__changes-json--scroll">{nd}</pre>
      </details>
    </div>
  )
}

function formatYnStatus(yn) {
  const u = (yn || '').toString().toUpperCase()
  if (u === 'Y') return '성공'
  if (u === 'N') return '실패'
  return '—'
}

/** 시스템 이력 상세내용: 기능(target_summary·sql_template_key·business_action) + detail_json(화면·CSV 동일 규칙) */
function formatSystemDetailCell(row) {
  const parts = [row?.target_summary, row?.sql_template_key, row?.business_action]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  const summary = parts.length ? parts.join(' · ') : '—'
  const detailJson = shortenJson(row?.detail_json, 240)
  return `기능: ${summary} / 상세: ${detailJson}`
}

// 1.
export default function UserHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = (searchParams.get('tab') || 'login').toLowerCase()
  const tab = VALID_TABS.includes(rawTab) ? rawTab : 'login'

  const [userKey, setUserKey] = useState('')
  const [fromD, setFromD] = useState('')
  const [toD, setToD] = useState('')
  const [ipContains, setIpContains] = useState('')
  const [channel, setChannel] = useState('')
  const [actionKind, setActionKind] = useState('')
  const [successYn, setSuccessYn] = useState('')
  const [chgTable, setChgTable] = useState('')
  const [chgPk, setChgPk] = useState('')
  const [chgChannel, setChgChannel] = useState('')
  const [sortLoginBy, setSortLoginBy] = useState('create_dtm')
  const [sortLoginDir, setSortLoginDir] = useState('desc')
  const [sortSystemBy, setSortSystemBy] = useState('create_dtm')
  const [sortSystemDir, setSortSystemDir] = useState('desc')

  const [applied, setApplied] = useState({
    userKey: '',
    fromD: '',
    toD: '',
    ipContains: '',
    channel: '',
    actionKind: '',
    successYn: '',
    chgTable: '',
    chgPk: '',
    chgChannel: '',
    sortLoginBy: 'create_dtm',
    sortLoginDir: 'desc',
    sortSystemBy: 'create_dtm',
    sortSystemDir: 'desc',
  })

  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false)

  const [changesModalOpen, setChangesModalOpen] = useState(false)
  const [changesSystemLogId, setChangesSystemLogId] = useState(null)
  const [changesLoading, setChangesLoading] = useState(false)
  const [changesError, setChangesError] = useState('')
  const [changes, setChanges] = useState([])
  const [selectedChangeIdx, setSelectedChangeIdx] = useState(null)
  /** `changes` 탭 목록 행 선택(인라인 상세 패널) */
  const [selectedListChangeIdx, setSelectedListChangeIdx] = useState(null)

  const setTab = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', next)
          return p
        },
        { replace: true }
      )
      // 필터·정렬 draft/applied는 유지하고, 탭별 목록만 다시 보기 위해 페이지만 초기화
      setPage(1)
      setSelectedListChangeIdx(null)
    },
    [setSearchParams]
  )

  const applyFilters = useCallback(() => {
    const dateErr = validateHistoryDateRange(fromD, toD)
    if (dateErr) {
      setError(dateErr)
      return
    }
    setApplied({
      userKey: userKey.trim(),
      fromD,
      toD,
      ipContains: ipContains.trim(),
      channel: channel.trim(),
      actionKind: actionKind.trim(),
      successYn: successYn.trim(),
      chgTable: chgTable.trim(),
      chgPk: chgPk.trim(),
      chgChannel: chgChannel.trim(),
      sortLoginBy,
      sortLoginDir,
      sortSystemBy,
      sortSystemDir,
    })
    setError('')
    setPage(1)
  }, [
    userKey,
    fromD,
    toD,
    ipContains,
    channel,
    actionKind,
    successYn,
    chgTable,
    chgPk,
    chgChannel,
    sortLoginBy,
    sortLoginDir,
    sortSystemBy,
    sortSystemDir,
  ])

  const resetFilters = useCallback(() => {
    setUserKey('')
    setFromD('')
    setToD('')
    setIpContains('')
    setChannel('')
    setActionKind('')
    setSuccessYn('')
    setChgTable('')
    setChgPk('')
    setChgChannel('')
    setSortLoginBy('create_dtm')
    setSortLoginDir('desc')
    setSortSystemBy('create_dtm')
    setSortSystemDir('desc')
    setApplied({
      userKey: '',
      fromD: '',
      toD: '',
      ipContains: '',
      channel: '',
      actionKind: '',
      successYn: '',
      chgTable: '',
      chgPk: '',
      chgChannel: '',
      sortLoginBy: 'create_dtm',
      sortLoginDir: 'desc',
      sortSystemBy: 'create_dtm',
      sortSystemDir: 'desc',
    })
    setError('')
    setPage(1)
  }, [])

  const handleFiltersSubmit = useCallback(
    (e) => {
      e.preventDefault()
      if (loading) return
      applyFilters()
    },
    [loading, applyFilters]
  )

  const handleFiltersFormKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter' || loading) return
      const t = e.target
      if (t.tagName === 'BUTTON') return
      if (t.tagName === 'SELECT') {
        window.setTimeout(() => applyFilters(), 0)
        return
      }
      if (t.tagName === 'INPUT') {
        e.preventDefault()
        applyFilters()
      }
    },
    [loading, applyFilters]
  )

  const openCsvConfirm = useCallback(() => {
    setCsvError('')
    setCsvConfirmOpen(true)
  }, [])

  const closeCsvConfirm = useCallback(() => {
    if (csvBusy) return
    setCsvConfirmOpen(false)
  }, [csvBusy])

  const openChangesModal = useCallback(async (systemLogId) => {
    setChangesModalOpen(true)
    setChangesSystemLogId(systemLogId)
    setChangesError('')
    setSelectedChangeIdx(null)
    setChangesLoading(true)
    setChanges([])
    try {
      const data = await getSystemLogChanges(systemLogId)
      setChanges(Array.isArray(data) ? data : [])
    } catch (e) {
      setChangesError(e?.message || '변경 내역을 불러오지 못했습니다.')
    } finally {
      setChangesLoading(false)
    }
  }, [])

  const closeChangesModal = useCallback(() => {
    if (changesLoading) return
    setChangesModalOpen(false)
    setChangesSystemLogId(null)
    setChangesError('')
    setChanges([])
    setSelectedChangeIdx(null)
  }, [changesLoading])

  const executeCsvDownload = useCallback(async () => {
    setCsvError('')
    setCsvBusy(true)
    try {
      await downloadUserHistoryCsv(tab, applied)
      setCsvConfirmOpen(false)
    } catch (e) {
      setCsvError(e?.message || 'CSV 받기에 실패했습니다.')
    } finally {
      setCsvBusy(false)
    }
  }, [tab, applied])

  useEffect(() => {
    if (!csvConfirmOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeCsvConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [csvConfirmOpen, closeCsvConfirm])

  useEffect(() => {
    if (!changesModalOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeChangesModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [changesModalOpen, closeChangesModal])

  useEffect(() => {
    const t = (searchParams.get('tab') || 'login').toLowerCase()
    if (!VALID_TABS.includes(t)) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'login')
          return p
        },
        { replace: true }
      )
    }
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    if (tab === 'changes') {
      setSelectedListChangeIdx(null)
    }
    try {
      const base = {
        page,
        page_size: pageSize,
        user_key: applied.userKey || undefined,
        from: applied.fromD || undefined,
        to: applied.toD || undefined,
        ip_contains: applied.ipContains || undefined,
      }
      if (tab === 'changes') {
        const data = await getChangeLogsPaged({
          page,
          page_size: pageSize,
          from: applied.fromD || undefined,
          to: applied.toD || undefined,
          target_table: applied.chgTable || undefined,
          target_pk_value: applied.chgPk || undefined,
          channel: applied.chgChannel || undefined,
        })
        setItems(data?.items ?? [])
        setTotal(Number(data?.total) || 0)
      } else if (tab === 'login') {
        const data = await getLoginHistoryOrg({
          ...base,
          sort_by: applied.sortLoginBy || undefined,
          sort_dir: applied.sortLoginDir || undefined,
        })
        setItems(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total) || 0)
      } else {
        const data = await getSystemLogsOrg({
          ...base,
          channel: applied.channel || undefined,
          action_kind: applied.actionKind || undefined,
          success_yn: applied.successYn || undefined,
          sort_by: applied.sortSystemBy || undefined,
          sort_dir: applied.sortSystemDir || undefined,
        })
        setItems(Array.isArray(data?.items) ? data.items : [])
        setTotal(Number(data?.total) || 0)
      }
    } catch (e) {
      setItems([])
      setTotal(0)
      setError(e?.message || '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [tab, page, pageSize, applied])

  useEffect(() => {
    load()
  }, [load])

  const { fromMin, fromMax, toMin, toMax } = dateInputBounds(fromD, toD)

  const filterLines = buildAppliedFilterLines(applied, tab)
  const sortLines = buildSortLines(tab, applied)
  const totalRowsLabel = `${Number(total || 0).toLocaleString('ko-KR')}행`
  const selectedChange =
    selectedChangeIdx != null && changes[selectedChangeIdx] != null ? changes[selectedChangeIdx] : null
  return (
    <div className="admin-users user-history">
      <Link to="/admin/users" className="ap__back">
        ← 사용자 관리
      </Link>
      <div className="admin-users__header-row">
        <div>
          <h1 className="admin-users__title">사용자 이력 조회</h1>
          <p className="admin-users__hint">
            기준일(시작일 또는 종료일) 앞뒤 최대 3개월까지 필터 가능합니다.
            <br />
            CSV 받기의 경우 최대 {CSV_MAX_ROWS.toLocaleString('ko-KR')}행까지 가능합니다.
          </p>
        </div>
      </div>

      <div className="user-history__tabs" role="tablist" aria-label="이력 종류">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'login'}
          className={`user-history__tab${tab === 'login' ? ' user-history__tab--active' : ''}`}
          onClick={() => setTab('login')}
        >
          로그인 이력
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'system'}
          className={`user-history__tab${tab === 'system' ? ' user-history__tab--active' : ''}`}
          onClick={() => setTab('system')}
        >
          시스템 이력
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'changes'}
          className={`user-history__tab${tab === 'changes' ? ' user-history__tab--active' : ''}`}
          onClick={() => setTab('changes')}
        >
          데이터 추적
        </button>
      </div>

      <form
        className="admin-list-filters user-history__filters"
        onSubmit={handleFiltersSubmit}
        onKeyDown={handleFiltersFormKeyDown}
        aria-label="이력 필터"
      >
        {tab !== 'changes' ? (
          <div className="admin-list-filters__field admin-list-filters__field--grow">
            <label htmlFor="uh-filter-user">사용자</label>
            <input
              id="uh-filter-user"
              type="text"
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              placeholder="contains"
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="admin-list-filters__field">
          <label htmlFor="uh-filter-from">일시 시작</label>
          <input
            id="uh-filter-from"
            type="date"
            value={fromD}
            min={fromMin || undefined}
            max={fromMax || undefined}
            title={
              toD
                ? `종료일 기준 최대 ${MAX_FILTER_SPAN_DAYS}일 전~종료일까지 선택 가능`
                : '먼저 고르면 종료일은 이 날부터 최대 약 3개월(92일) 이내로만 선택됩니다.'
            }
            onChange={(e) => setFromD(e.target.value)}
          />
        </div>
        <div className="admin-list-filters__field">
          <label htmlFor="uh-filter-to">일시 종료</label>
          <input
            id="uh-filter-to"
            type="date"
            value={toD}
            min={toMin || undefined}
            max={toMax || undefined}
            title={
              fromD
                ? `시작일~시작일+최대 ${MAX_FILTER_SPAN_DAYS}일까지 선택 가능`
                : '먼저 고르면 시작일은 이 날에서 최대 약 3개월(92일) 이내로만 선택됩니다.'
            }
            onChange={(e) => setToD(e.target.value)}
          />
        </div>
        {tab !== 'changes' ? (
          <div className="admin-list-filters__field">
            <label htmlFor="uh-filter-ip">IP</label>
            <input
              id="uh-filter-ip"
              type="text"
              value={ipContains}
              onChange={(e) => setIpContains(e.target.value)}
              placeholder="contains"
              autoComplete="off"
            />
          </div>
        ) : null}
        {tab === 'changes' ? (
          <>
            <div className="admin-list-filters__field admin-list-filters__field--grow">
              <label htmlFor="uh-filter-chg-table">대상 테이블</label>
              <input
                id="uh-filter-chg-table"
                type="text"
                value={chgTable}
                onChange={(e) => setChgTable(e.target.value)}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-filter-chg-pk">PK 값</label>
              <input
                id="uh-filter-chg-pk"
                type="text"
                value={chgPk}
                onChange={(e) => setChgPk(e.target.value)}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-filter-chg-channel">카테고리</label>
              <input
                id="uh-filter-chg-channel"
                type="text"
                value={chgChannel}
                onChange={(e) => setChgChannel(e.target.value)}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
          </>
        ) : null}
        {tab === 'system' ? (
          <>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-filter-channel">페이지</label>
              <input
                id="uh-filter-channel"
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-filter-action">행위</label>
              <input
                id="uh-filter-action"
                type="text"
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value)}
                placeholder="contains"
                autoComplete="off"
              />
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-filter-success">상태</label>
              <select
                id="uh-filter-success"
                value={successYn}
                onChange={(e) => setSuccessYn(e.target.value)}
              >
                <option value="">전체</option>
                <option value="Y">성공</option>
                <option value="N">실패</option>
              </select>
            </div>
          </>
        ) : null}
        {tab === 'login' ? (
          <>
            <div className="admin-list-filters__field admin-list-filters__field--sortwide">
              <label htmlFor="uh-sort-login-by">정렬 기준</label>
              <select
                id="uh-sort-login-by"
                value={sortLoginBy}
                onChange={(e) => setSortLoginBy(e.target.value)}
                aria-label="정렬 기준(로그인 테이블 열과 동일)"
              >
                {LOGIN_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-sort-login-dir">정렬 방향</label>
              <select
                id="uh-sort-login-dir"
                value={sortLoginDir}
                onChange={(e) => setSortLoginDir(e.target.value)}
                aria-label="로그인 이력 정렬 방향"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </div>
          </>
        ) : null}
        {tab === 'system' ? (
          <>
            <div className="admin-list-filters__field admin-list-filters__field--sortwide">
              <label htmlFor="uh-sort-system-by">정렬 기준</label>
              <select
                id="uh-sort-system-by"
                value={sortSystemBy}
                onChange={(e) => setSortSystemBy(e.target.value)}
                aria-label="정렬 기준(시스템 테이블 열과 동일)"
              >
                {SYSTEM_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-list-filters__field">
              <label htmlFor="uh-sort-system-dir">정렬 방향</label>
              <select
                id="uh-sort-system-dir"
                value={sortSystemDir}
                onChange={(e) => setSortSystemDir(e.target.value)}
                aria-label="시스템 이력 정렬 방향"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </div>
          </>
        ) : null}
        {tab === 'changes' ? (
          <p className="user-history__sort-hint" role="status">
            정렬: 일시 내림차순(고정). 행을 다시 클릭하면 상세가 접힙니다.
          </p>
        ) : null}
        <div className="admin-list-filters__actions">
          <button type="submit" className="ibank-btn-toolbar" disabled={loading}>
            필터 적용
          </button>
          <button
            type="button"
            className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
            disabled={loading}
            onClick={resetFilters}
          >
            초기화
          </button>
        </div>
      </form>

      {error ? <p className="admin-users__error">{error}</p> : null}
      {csvError && !csvConfirmOpen ? <p className="admin-users__error">{csvError}</p> : null}

      <div className="user-history__toolbar">
        <button
          type="button"
          className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
          disabled={csvBusy || loading}
          onClick={openCsvConfirm}
          title="적용된 필터·건수를 확인한 뒤 CSV를 브라우저 기본 다운로드 폴더로 저장합니다."
        >
          CSV 받기
        </button>
      </div>

      {loading ? <p className="admin-users__hint">불러오는 중…</p> : null}

      <div className="admin-users__table-wrap user-history__table-wrap">
        {tab === 'login' ? (
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>일시</th>
                <th>사용자</th>
                <th>결과</th>
                <th>IP</th>
                <th>클라이언트</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="user-history__empty">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => (
                  <tr key={`${row.create_dtm || ''}-${row.user_id || ''}-${idx}`}>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td>{row.user_email || row.user_id || '—'}</td>
                    <td>{formatYnStatus(row.login_success_yn)}</td>
                    <td>{row.login_trial_ip || '—'}</td>
                    <td>{row.login_trial_browser || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : tab === 'system' ? (
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>일시</th>
                <th className="user-history__col-uuid">UUID</th>
                <th>페이지</th>
                <th>행위</th>
                <th>상태</th>
                <th>사용자</th>
                <th>IP</th>
                <th className="user-history__col-fingerprint">SQL 지문</th>
                <th className="user-history__col-detail">상세내용</th>
                <th className="user-history__col-change">추적</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={10} className="user-history__empty">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.system_log_id}>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <UuidTableCell value={row.request_correlation_id} />
                    <td>{row.channel || '—'}</td>
                    <td>{row.action_kind || '—'}</td>
                    <td>{formatYnStatus(row.success_yn)}</td>
                    <td>{row.actor_user_email || row.actor_user_id || '—'}</td>
                    <td>{row.client_ip_masked || '—'}</td>
                    <td
                      className="user-history__col-fingerprint"
                      title={row.sql_fingerprint ? String(row.sql_fingerprint) : undefined}
                    >
                      <span className="user-history__fingerprint-inner">
                        {row.sql_fingerprint || '—'}
                      </span>
                    </td>
                    <td className="user-history__col-detail">{formatSystemDetailCell(row)}</td>
                    <td className="user-history__col-change">
                      {row.has_scoped_change_logs ? (
                        <button
                          type="button"
                          className="user-history__change-btn"
                          aria-label="연결된 데이터 추적 내역 조회"
                          onClick={(e) => {
                            e.stopPropagation()
                            openChangesModal(row.system_log_id)
                          }}
                        >
                          <span aria-hidden="true">📋</span> 조회
                        </button>
                      ) : (
                        <span className="user-history__track-empty" title="스코프 내 연결된 데이터 추적 없음">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="user-history__changes-tab">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th className="user-history__col-uuid">UUID</th>
                  <th>카테고리</th>
                  <th>대상 테이블</th>
                  <th>행위</th>
                  <th>PK</th>
                  <th>사용자(이메일)</th>
                  <th>프로젝트</th>
                  <th className="user-history__col-change">상세</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} className="user-history__empty">
                      기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => {
                    const rk = `${idx}-${String(row.created_at)}-${String(row.target_table)}-${String(row.target_pk_value)}`
                    const open = selectedListChangeIdx === idx
                    return (
                      <Fragment key={rk}>
                        <tr
                          className={
                            open
                              ? 'user-history__list-change-tr user-history__list-change-tr--selected'
                              : 'user-history__list-change-tr'
                          }
                          onClick={() =>
                            setSelectedListChangeIdx((cur) => (cur === idx ? null : idx))
                          }
                        >
                          <td>{formatDtm(row.created_at)}</td>
                          <UuidTableCell value={row.correlation_id} />
                          <td>{row.channel || '—'}</td>
                          <td>{row.target_table || '—'}</td>
                          <td>{row.operation || '—'}</td>
                          <td>{row.target_pk_column || '—'}</td>
                          <td>{row.actor_user_email || row.actor_user_id || '—'}</td>
                          <td>{(row.project_name && String(row.project_name).trim()) || '—'}</td>
                          <td className="user-history__col-change">
                            <span className="user-history__track-detail-chevron" aria-hidden="true">
                              {open ? '▲' : '▼'}
                            </span>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="user-history__list-change-detail-tr" aria-live="polite">
                            <td colSpan={9} className="user-history__list-change-detail-td">
                              <DataChangeLogDetailBlocks
                                row={row}
                                layoutClass="user-history__changes-list-detail user-history__changes-list-detail--inline"
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminListPaginationFooter
        idPrefix="user-history"
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n)
          setPage(1)
        }}
      />

      {csvConfirmOpen ? (
        <div className="admin-users__modal-backdrop" role="presentation" onClick={closeCsvConfirm}>
          <div
            className="admin-users__modal user-history__modal-csv"
            role="dialog"
            aria-labelledby="user-history-csv-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-history-csv-title" className="admin-users__modal-title">
              CSV 받기 확인
            </h2>
            <p className="admin-users__modal-hint">
              아래는 <strong>필터·정렬 적용</strong> 내용입니다.
              확인 시 기본 다운로드 폴더로 저장합니다.
            </p>

            <div className="user-history__modal-section-title">필터</div>
            <ul className="user-history__modal-list">
              {filterLines.map((line, i) => (
                <li key={`f-${i}`}>{line}</li>
              ))}
            </ul>

            <div className="user-history__modal-section-title">정렬</div>
            <p className="user-history__modal-sort">{sortLines[0] || '—'}</p>

            <div className="user-history__modal-total">총 행수: {totalRowsLabel}</div>
            {total > CSV_MAX_ROWS ? (
              <p className="user-history__modal-cap">
                ※ 조건에 맞는 건수가 {CSV_MAX_ROWS.toLocaleString('ko-KR')}행을 넘습니다. 이 상태로 확인 시 서버에서
                400으로 거절됩니다. 기간·키워드 등을 좁힌 뒤 필터 적용을 다시 하세요.
              </p>
            ) : null}

            <p className="user-history__modal-confirm-msg">확인을 누르시면 다운로드 됩니다.</p>

            {csvError ? <p className="admin-users__error user-history__modal-error">{csvError}</p> : null}

            <div className="admin-users__modal-actions">
              <button
                type="button"
                className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
                onClick={closeCsvConfirm}
                disabled={csvBusy}
              >
                취소
              </button>
              <button
                type="button"
                className="ibank-btn-toolbar"
                onClick={executeCsvDownload}
                disabled={csvBusy || total > CSV_MAX_ROWS}
              >
                {csvBusy ? '다운로드 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {changesModalOpen ? (
        <div className="admin-users__modal-backdrop" role="presentation" onClick={closeChangesModal}>
          <div
            className="admin-users__modal user-history__modal-changes"
            role="dialog"
            aria-labelledby="user-history-changes-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-history-changes-title" className="admin-users__modal-title">
              데이터 추적 내역
            </h2>
            {changesSystemLogId != null ? (
              <p className="admin-users__modal-hint">system_log_id: {String(changesSystemLogId)}</p>
            ) : null}

            {changesLoading ? <p className="admin-users__hint">불러오는 중…</p> : null}
            {changesError && !changesLoading ? (
              <p className="admin-users__error user-history__modal-error">{changesError}</p>
            ) : null}

            {!changesLoading && !changesError && changes.length === 0 ? (
              <p className="user-history__changes-empty">연결된 데이터 추적 기록이 없습니다.</p>
            ) : null}

            {!changesLoading && !changesError && changes.length > 0 ? (
              <>
                <div className="user-history__changes-table-wrap">
                  <table className="admin-users__table user-history__changes-table">
                    <thead>
                      <tr>
                        <th>일시</th>
                        <th className="user-history__col-uuid">UUID</th>
                        <th>카테고리</th>
                        <th>대상 테이블</th>
                        <th>행위</th>
                        <th>PK</th>
                        <th>사용자(이메일)</th>
                        <th>프로젝트</th>
                        <th className="user-history__col-change">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((ch, i) => {
                        const mk = `${i}-${String(ch?.target_table)}-${String(ch?.target_pk_value)}-${String(ch?.created_at)}`
                        const open = selectedChangeIdx === i
                        return (
                          <Fragment key={mk}>
                            <tr
                              className={
                                open
                                  ? 'user-history__changes-tr user-history__changes-tr--selected'
                                  : 'user-history__changes-tr'
                              }
                              onClick={() =>
                                setSelectedChangeIdx((cur) => (cur === i ? null : i))
                              }
                            >
                              <td>{formatDtm(ch?.created_at)}</td>
                              <UuidTableCell value={ch?.correlation_id} />
                              <td>{ch?.channel ?? '—'}</td>
                              <td>{ch?.target_table ?? '—'}</td>
                              <td>{ch?.operation ?? '—'}</td>
                              <td>{ch?.target_pk_column ?? '—'}</td>
                              <td>{ch?.actor_user_email || ch?.actor_user_id || '—'}</td>
                              <td>
                                {(ch?.project_name && String(ch.project_name).trim()) || '—'}
                              </td>
                              <td className="user-history__col-change">
                                <span className="user-history__track-detail-chevron" aria-hidden="true">
                                  {open ? '▲' : '▼'}
                                </span>
                              </td>
                            </tr>
                            {open && selectedChange ? (
                              <tr className="user-history__changes-modal-detail-tr" aria-live="polite">
                                <td colSpan={9} className="user-history__changes-modal-detail-td">
                                  <DataChangeLogDetailBlocks
                                    row={selectedChange}
                                    layoutClass="user-history__changes-list-detail user-history__changes-list-detail--modal-inline"
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {changes.length > 0 && selectedChangeIdx == null ? (
                  <p className="user-history__changes-hint">행을 클릭하면 아래에 상세가 펼쳐집니다. 같은 행을 다시 누르면 접습니다.</p>
                ) : null}
              </>
            ) : null}

            <div className="admin-users__modal-actions">
              <button
                type="button"
                className="ibank-btn-toolbar"
                onClick={closeChangesModal}
                disabled={changesLoading}
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
