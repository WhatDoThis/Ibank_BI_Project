/**
 * app/admin/UserHistoryPage.jsx (통합 이력 조회 — 로그인·시스템)
 * ============================================================
 * `docs/report/22` §8.1: `tab=login|system` URL 동기화(ETLPage 패턴). 로그인은 GET …/login-history/org, 시스템은 GET …/system-logs.
 *
 * [Main Functions]
 * ===========
 * 1. UserHistoryPage — 필터(일자 `min`/`max`·기준일 먼저 선택 시 ±92일)·정렬·탭 유지·CSV 모달
 *
 * [Dependencies]
 * =========
 * - react-router-dom (useSearchParams, Link)
 * - shared/api/systemLogClient (getLoginHistoryOrg, getSystemLogsOrg, downloadUserHistoryCsv)
 * - app/admin/admin-users.css, app/admin/user-history.css
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  downloadUserHistoryCsv,
  getLoginHistoryOrg,
  getSystemLogsOrg,
} from '@/shared/api/systemLogClient.js'

import './admin-users.css'
import './user-history.css'

const VALID_TABS = ['login', 'system']

/** 서버 `MAX_CSV_EXPORT_ROWS` 와 동일(안내·확인 버튼 비활성) */
const CSV_MAX_ROWS = 50000

/** 서버 `MAX_HISTORY_FILTER_SPAN_DAYS` 와 동일(시작·종료일 둘 다 있을 때) */
const MAX_FILTER_SPAN_DAYS = 92

const LOGIN_SORT_OPTIONS = [
  { value: 'create_dtm', label: '일시' },
  { value: 'user_login_log_id', label: '로그 ID' },
  { value: 'login_success_yn', label: '로그인 성공 여부' },
  { value: 'user_id', label: '사용자 ID' },
  { value: 'user_email', label: '이메일' },
]

const SYSTEM_SORT_OPTIONS = [
  { value: 'create_dtm', label: '일시' },
  { value: 'system_log_id', label: '로그 ID' },
  { value: 'channel', label: 'channel' },
  { value: 'action_kind', label: 'action_kind' },
  { value: 'success_yn', label: '성공 여부' },
  { value: 'actor_user_id', label: '행위자 user_id' },
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
  if (applied.userKey?.trim()) lines.push(`사용자 키워드: ${applied.userKey.trim()}`)
  if (applied.fromD?.trim()) lines.push(`시작일: ${applied.fromD}`)
  if (applied.toD?.trim()) lines.push(`종료일: ${applied.toD}`)
  if (applied.ipContains?.trim()) lines.push(`IP 포함: ${applied.ipContains.trim()}`)
  if (tab === 'system') {
    if (applied.channel?.trim()) lines.push(`channel: ${applied.channel.trim()}`)
    if (applied.actionKind?.trim()) lines.push(`action_kind: ${applied.actionKind.trim()}`)
    if (applied.successYn?.trim()) lines.push(`success: ${applied.successYn.trim()}`)
  }
  return lines.length ? lines : ['없음']
}

/** 적용된 정렬 1순위(서버 `sort_by`·`sort_dir`와 동일). */
function buildSortLines(tab, applied) {
  const byNorm =
    tab === 'login' ? applied.sortLoginBy || 'create_dtm' : applied.sortSystemBy || 'create_dtm'
  const dirNorm =
    tab === 'login' ? applied.sortLoginDir || 'desc' : applied.sortSystemDir || 'desc'
  const label = sortLabel(tab, byNorm)
  const dirKo = dirNorm === 'asc' ? '오름차순' : '내림차순'
  return [`1. ${label} (${dirKo})`]
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
  const [pageSize, setPageSize] = useState(50)
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
        setPageSize(Number(data?.page_size) || 50)
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
        setPageSize(Number(data?.page_size) || 50)
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)

  const { fromMin, fromMax, toMin, toMax } = dateInputBounds(fromD, toD)

  const filterLines = buildAppliedFilterLines(applied, tab)
  const sortLines = buildSortLines(tab, applied)
  const totalRowsLabel = `${Number(total || 0).toLocaleString('ko-KR')}행`

  return (
    <div className="admin-users user-history">
      <div className="admin-users__header-row">
        <div>
          <h1 className="admin-users__title">사용자 이력 조회</h1>
          <p className="admin-users__hint">
            로그인 이력은 부서 트리 범위의 `user_login_log`, 시스템 이력은 `system_log` 입니다. 필터·정렬을 바꾼 뒤 **필터 적용**을 누르면 첫 페이지부터 다시 조회합니다. **탭 전환** 시 입력·적용된 필터·정렬은 유지되고 페이지만 1로 맞춥니다. **시작일 또는 종료일**을 먼저 고르면 다른 쪽 달력은 그 날짜 기준 **최대 {MAX_FILTER_SPAN_DAYS}일(약 3개월)** 범위로만 선택되도록 막습니다(브라우저 기본 **날짜** 입력 달력). **CSV** 는 동일 조건당 **최대 {CSV_MAX_ROWS.toLocaleString('ko-KR')}행**이며, 초과 시 안내 후 내려받을 수 없습니다. 감사 데이터 **보존 기간은 2년**(운영·`07`·`22` 참고)입니다.
          </p>
        </div>
        <Link to="/admin/users" className="ibank-btn-toolbar ibank-btn-toolbar--secondary">
          사용자 관리로
        </Link>
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

      <div className="user-history__filters">
        <label className="user-history__field">
          사용자 키워드
          <input
            className="admin-users__input"
            value={userKey}
            onChange={(e) => setUserKey(e.target.value)}
            placeholder="id·이메일 일부"
            autoComplete="off"
          />
        </label>
        <label className="user-history__field">
          시작일
          <input
            className="admin-users__input"
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
        </label>
        <label className="user-history__field">
          종료일
          <input
            className="admin-users__input"
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
        </label>
        <label className="user-history__field">
          IP 포함
          <input
            className="admin-users__input"
            value={ipContains}
            onChange={(e) => setIpContains(e.target.value)}
            placeholder="부분 일치"
            autoComplete="off"
          />
        </label>
        {tab === 'system' ? (
          <>
            <label className="user-history__field">
              channel
              <input
                className="admin-users__input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="예: admin"
                autoComplete="off"
              />
            </label>
            <label className="user-history__field">
              action_kind
              <input
                className="admin-users__input"
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="user-history__field">
              success
              <select
                className="admin-users__select"
                value={successYn}
                onChange={(e) => setSuccessYn(e.target.value)}
              >
                <option value="">전체</option>
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </label>
          </>
        ) : null}
        {tab === 'login' ? (
          <>
            <label className="user-history__field user-history__field--sort">
              정렬 기준
              <select
                className="admin-users__select"
                value={sortLoginBy}
                onChange={(e) => setSortLoginBy(e.target.value)}
                aria-label="로그인 이력 정렬 기준"
              >
                {LOGIN_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="user-history__field user-history__field--sort">
              정렬 방향
              <select
                className="admin-users__select"
                value={sortLoginDir}
                onChange={(e) => setSortLoginDir(e.target.value)}
                aria-label="로그인 이력 정렬 방향"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="user-history__field user-history__field--sort">
              정렬 기준
              <select
                className="admin-users__select"
                value={sortSystemBy}
                onChange={(e) => setSortSystemBy(e.target.value)}
                aria-label="시스템 이력 정렬 기준"
              >
                {SYSTEM_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="user-history__field user-history__field--sort">
              정렬 방향
              <select
                className="admin-users__select"
                value={sortSystemDir}
                onChange={(e) => setSortSystemDir(e.target.value)}
                aria-label="시스템 이력 정렬 방향"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </label>
          </>
        )}
        <div className="user-history__filter-actions">
          <button type="button" className="ibank-btn-toolbar" onClick={applyFilters} disabled={loading}>
            필터 적용
          </button>
        </div>
      </div>

      {error ? <p className="admin-users__error">{error}</p> : null}
      {csvError && !csvConfirmOpen ? <p className="admin-users__error">{csvError}</p> : null}

      <div className="user-history__pager">
        <span className="user-history__pager-meta">
          총 {total}건 · {page}/{totalPages}페이지
        </span>
        <button
          type="button"
          className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
          disabled={csvBusy || loading}
          onClick={openCsvConfirm}
          title="적용된 필터·건수를 확인한 뒤 CSV를 브라우저 기본 다운로드 폴더로 저장합니다."
        >
          CSV 받기
        </button>
        <button
          type="button"
          className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <button
          type="button"
          className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
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
                    <td>{(row.login_success_yn || '').toUpperCase() === 'Y' ? '성공' : '실패'}</td>
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
                <th>channel</th>
                <th>action</th>
                <th>business</th>
                <th>성공</th>
                <th>actor</th>
                <th>요약</th>
                <th>detail</th>
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
                    <td>{row.business_action || '—'}</td>
                    <td>{row.success_yn || '—'}</td>
                    <td>{row.actor_user_id ?? '—'}</td>
                    <td>{row.target_summary || row.sql_template_key || '—'}</td>
                    <td className="user-history__cell-json">{shortenJson(row.detail_json, 120)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

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
              아래는 <strong>필터 적용</strong> 직후 목록 API와 동일한 필터·정렬 조건입니다. 확인 시 브라우저가 파일을 받아
              기본 다운로드 폴더(또는 저장 위치 선택 대화상자)로 저장합니다.
            </p>

            <div className="user-history__modal-section-title">필터</div>
            <ul className="user-history__modal-list">
              {filterLines.map((line, i) => (
                <li key={`f-${i}`}>{line}</li>
              ))}
            </ul>

            <div className="user-history__modal-section-title">정렬</div>
            <ul className="user-history__modal-list">
              {sortLines.map((line, i) => (
                <li key={`s-${i}`}>{line}</li>
              ))}
            </ul>
            <p className="user-history__modal-note">
              ※ 동일 정렬이 목록·CSV에 적용됩니다. 2순위 키(로그 ID)는 서버에서 같은 방향으로 맞춥니다.
            </p>

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
