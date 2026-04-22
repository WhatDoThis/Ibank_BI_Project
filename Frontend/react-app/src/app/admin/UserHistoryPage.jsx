/**
 * app/admin/UserHistoryPage.jsx (통합 이력 조회 — 로그인·시스템)
 * ============================================================
 * `docs/report/22` §8.1: `tab=login|system` URL 동기화(ETLPage 패턴). 로그인은 GET …/login-history/org, 시스템은 GET …/system-logs.
 *
 * [Main Functions]
 * ===========
 * 1. UserHistoryPage — 필터 폼(Enter=적용·초기화)·시스템 상세·테이블(IP·sql_fingerprint)·정렬·CSV 모달·하단 페이지네이션(AdminListPaginationFooter·서버 total·10/20/50·탭 전환 시 페이지만 초기화)
 *
 * [Dependencies]
 * =========
 * - react-router-dom (useSearchParams, Link)
 * - shared/api/systemLogClient (getLoginHistoryOrg, getSystemLogsOrg, downloadUserHistoryCsv)
 * - app/admin/admin-pages.css(`ap__back` 상단 링크), app/admin/admin-users.css, app/admin/admin-list-table.css(필터 바·1~6과 동일), app/admin/user-history.css
 * - shared/components/AdminListPaginationFooter(admin-list-pagination.css 포함)
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import AdminListPaginationFooter from '@/shared/components/AdminListPaginationFooter.jsx'
import {
  downloadUserHistoryCsv,
  getLoginHistoryOrg,
  getSystemLogsOrg,
} from '@/shared/api/systemLogClient.js'

import './admin-pages.css'
import './admin-users.css'
import './admin-list-table.css'
import './user-history.css'

const VALID_TABS = ['login', 'system']

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

/** 적용된 정렬(서버 `sort_by`·`sort_dir`와 동일, 단일). */
function buildSortLines(tab, applied) {
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

function shortenJson(obj, max = 100) {
  try {
    const s = JSON.stringify(obj ?? {})
    if (s.length <= max) return s
    return `${s.slice(0, max)}…`
  } catch {
    return '—'
  }
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
      sortLoginBy,
      sortLoginDir,
      sortSystemBy,
      sortSystemDir,
    })
    setError('')
    setPage(1)
  }, [userKey, fromD, toD, ipContains, channel, actionKind, successYn, sortLoginBy, sortLoginDir, sortSystemBy, sortSystemDir])

  const resetFilters = useCallback(() => {
    setUserKey('')
    setFromD('')
    setToD('')
    setIpContains('')
    setChannel('')
    setActionKind('')
    setSuccessYn('')
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
    try {
      const base = {
        page,
        page_size: pageSize,
        user_key: applied.userKey || undefined,
        from: applied.fromD || undefined,
        to: applied.toD || undefined,
        ip_contains: applied.ipContains || undefined,
      }
      if (tab === 'login') {
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
      </div>

      <form
        className="admin-list-filters user-history__filters"
        onSubmit={handleFiltersSubmit}
        onKeyDown={handleFiltersFormKeyDown}
        aria-label="이력 필터"
      >
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
        ) : (
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
        )}
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
        ) : (
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>일시</th>
                <th>페이지</th>
                <th>행위</th>
                <th>상태</th>
                <th>사용자</th>
                <th>IP</th>
                <th className="user-history__col-fingerprint">SQL 지문</th>
                <th className="user-history__col-detail">상세내용</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="user-history__empty">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.system_log_id}>
                    <td>{formatDtm(row.create_dtm)}</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  )
}
