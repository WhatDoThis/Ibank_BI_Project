/**
 * SaveTableQueuePanel: 테이블 저장(report_save_queue) 백그라운드 큐 모니터
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  getSaveTableQueueList,
  cancelSaveTableQueueJob,
  requeueSaveTableJob,
} from '@/packages/query_studio/api/queryStudioClient.js'

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'queued', label: '대기' },
  { value: 'running', label: '실행 중' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'cancelled', label: '취소' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

function statusLabel(s) {
  const m = { queued: '대기', running: '실행 중', completed: '완료', failed: '실패', cancelled: '취소' }
  return m[s] || s || '—'
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

/** 표 셀용: 공백 정리 + 한 줄 요약(긴 DB 오류도 제목 툴팁에 전체) */
function summarizeErrorText(text, maxLen = 200) {
  if (text == null) return ''
  const t = String(text).replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export default function SaveTableQueuePanel({ showToast, projectInfoId, active, variant = 'default' }) {
  const isSidebar = variant === 'sidebar'
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [actionId, setActionId] = useState(null)

  const totalPages = total <= 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total)

  useEffect(() => {
    setExpanded({})
  }, [page, pageSize, statusFilter])

  const load = useCallback(async () => {
    if (projectInfoId == null) return
    setLoading(true)
    try {
      const res = await getSaveTableQueueList({
        status: statusFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      const t = res?.total != null ? Number(res.total) : 0
      setItems(res?.items || [])
      setTotal(Number.isFinite(t) ? t : 0)
      const maxP = t <= 0 ? 1 : Math.max(1, Math.ceil(t / pageSize))
      if (page > maxP) {
        setPage(maxP)
      }
    } catch (e) {
      const msg = e?.data?.error || e?.data?.detail || e?.message || '큐 목록을 불러오지 못했습니다.'
      showToast?.('error', typeof msg === 'string' ? msg : '큐 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectInfoId, statusFilter, showToast, page, pageSize])

  useEffect(() => {
    if (!active || projectInfoId == null) return
    void load()
  }, [active, projectInfoId, load])

  const onCancel = async (jobId) => {
    if (!window.confirm('대기 중인 이 작업을 취소할까요?')) return
    setActionId(jobId)
    try {
      const r = await cancelSaveTableQueueJob(jobId)
      if (r?.ok) {
        showToast?.('success', '취소되었습니다.')
        await load()
      } else {
        showToast?.('error', r?.error || '취소에 실패했습니다.')
      }
    } catch (e) {
      showToast?.('error', e?.message || '취소에 실패했습니다.')
    } finally {
      setActionId(null)
    }
  }

  const onRequeue = async (jobId) => {
    if (!window.confirm('동일한 테이블명·쿼리로 다시 대기열에 넣을까요? (기존 테이블이 있으면 DB에서 실패할 수 있음)')) return
    setActionId(`re-${jobId}`)
    try {
      const r = await requeueSaveTableJob(jobId)
      if (r?.ok) {
        showToast?.('success', r?.message || '다시 대기열에 등록되었습니다.')
        await load()
      } else {
        showToast?.('error', r?.error || '재실행 등록에 실패했습니다.')
      }
    } catch (e) {
      const msg = e?.data?.error || e?.data?.detail || e?.message || '재실행 등록에 실패했습니다.'
      showToast?.('error', msg)
    } finally {
      setActionId(null)
    }
  }

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (projectInfoId == null) {
    return (
      <div
        className={`save-queue-panel save-queue-panel--empty ${isSidebar ? 'save-queue-panel--sidebar' : ''}`.trim()}
      >
        <p>프로젝트를 선택한 뒤 저장 큐를 사용할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div
      className={`save-queue-panel ${isSidebar ? 'save-queue-panel--sidebar' : ''}`.trim()}
    >
      <div className="save-queue-toolbar">
        <label className="save-queue-filter">
          <span>상태</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            disabled={loading}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-small" onClick={() => void load()} disabled={loading}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>
      {isSidebar ? (
        <p className="save-queue-hint save-queue-hint--sidebar">
          대기만 <strong>취소</strong> 가능 · 완료/실패/취소는 <strong>다시 대기</strong> (실행 중 취소 불가)
        </p>
      ) : (
        <p className="save-queue-hint">
          테이블로 저장 요청이 큐에 들어가면 이곳에 표시됩니다. <strong>취소</strong>는 <strong>대기</strong>일 때만 가능하며, 실행
          중에는 취소할 수 없습니다. <strong>다시 대기</strong>는 끝난 작업을 동일 SQL로 다시 큐에 넣습니다(덮어쓰기 아님, DB
          쪽 중복·권한은 그대로 적용).
        </p>
      )}
      <div className="ibank-table-wrap save-queue-table-wrap" role="region" aria-label="테이블 저장 큐 목록">
        <table className="ibank-data-table save-queue-data-table">
          <colgroup>
            <col className="save-queue-col save-queue-col--status" />
            <col className="save-queue-col save-queue-col--table" />
            <col className="save-queue-col save-queue-col--user" />
            <col className="save-queue-col save-queue-col--created" />
            <col className="save-queue-col save-queue-col--span" />
            <col className="save-queue-col save-queue-col--err" />
            <col className="save-queue-col save-queue-col--actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="save-queue-th save-queue-th--status" scope="col">
                상태
              </th>
              <th className="save-queue-th" scope="col">
                대상 테이블명
              </th>
              <th className="save-queue-th" scope="col">
                요청자
              </th>
              <th className="save-queue-th save-queue-th--nowrap" scope="col">
                요청 시각
              </th>
              <th className="save-queue-th" scope="col">
                실행 · 완료
              </th>
              <th className="save-queue-th" scope="col">
                실패/메시지
              </th>
              <th className="save-queue-th save-queue-th--actions" scope="col">
                동작
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="save-queue-status-cell">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="save-queue-status-cell save-queue-status-cell--empty">
                  표시할 큐 항목이 없습니다.
                </td>
              </tr>
            )}
            {items.map((row, rowIndex) => {
              const id = row.id
              const open = expanded[id]
              const st = (row.status || '').toLowerCase()
              const canRequeue = st && st !== 'running' && st !== 'queued'
              const globalRow = (page - 1) * pageSize + rowIndex
              const stripy = globalRow % 2 === 1
              return (
                <Fragment key={id}>
                  <tr
                    className={[
                      'save-queue-tr',
                      stripy ? 'save-queue-tr--striped' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td className="save-queue-td save-queue-td--status">
                      <span className={`save-queue-badge save-queue-badge--${(row.status || '').toLowerCase()}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="save-queue-td save-queue-td--tname" title={row.table_name || ''}>
                      <span className="ibank-data-table__clip">
                        {row.table_name}
                        {row.result_table_name && row.result_table_name !== row.table_name && (
                          <span className="save-queue-res"> → {row.result_table_name}</span>
                        )}
                      </span>
                    </td>
                    <td
                      className="save-queue-td save-queue-td--user"
                      title={row.create_user_id != null ? `user_id ${row.create_user_id}` : undefined}
                    >
                      <span className="ibank-data-table__clip">
                        {row.create_user_name || (row.create_user_id != null ? `ID ${row.create_user_id}` : '—')}
                      </span>
                    </td>
                    <td className="save-queue-td save-queue-td--mono save-queue-td--nowrap" title={row.created_at || undefined}>
                      {formatTime(row.created_at)}
                    </td>
                    <td className="save-queue-td save-queue-td--span">
                      <div className="save-queue-td__time-block">
                        <div className="save-queue-td__time-line">
                          <span className="save-queue-td__label">시작</span>
                          <span className="save-queue-td__val">{formatTime(row.started_at)}</span>
                        </div>
                        <div className="save-queue-td__time-line">
                          <span className="save-queue-td__label">완료</span>
                          <span className="save-queue-td__val">{formatTime(row.completed_at)}</span>
                        </div>
                      </div>
                    </td>
                    <td
                      className={[
                        'save-queue-td',
                        'save-queue-td--err',
                        st === 'failed' && row.error ? 'save-queue-td--err-fail' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={row.error || undefined}
                    >
                      {row.error ? (
                        <span className="save-queue-errcell">{summarizeErrorText(row.error)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="save-queue-td save-queue-td--actions">
                      <div className="save-queue-actions">
                        <button type="button" className="btn-small" onClick={() => toggleExpand(id)} title="SELECT SQL">
                          {open ? '쿼리 닫기' : '쿼리'}
                        </button>
                        {row.status === 'queued' && (
                          <button
                            type="button"
                            className="btn-small save-queue-btn-cancel"
                            onClick={() => onCancel(id)}
                            disabled={actionId === id}
                          >
                            취소
                          </button>
                        )}
                        {canRequeue && (
                          <button
                            type="button"
                            className="btn-small primary"
                            onClick={() => onRequeue(id)}
                            disabled={actionId === `re-${id}`}
                          >
                            다시 대기
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="save-queue-tr save-queue-tr--detail">
                      <td colSpan={7} className="save-queue-td save-queue-td--detail">
                        <pre className="save-queue-sql">{row.query || '(쿼리 없음)'}</pre>
                        {row.error && (
                          <div className="save-queue-err" role="status">
                            <strong>오류/메시지</strong>
                            <pre>{row.error}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="save-queue-pagination" aria-label="큐 목록 페이지네이션">
        <div className="pagination-bar">
          <div className="pagination-info">
            {total === 0 ? (
              <span>0건</span>
            ) : (
              <>
                <span>
                  {rangeStart}-{rangeEnd}건
                </span>
                <span style={{ color: 'var(--text-light, #7f7f7f)' }}> / 총 </span>
                <span>{total}건</span>
              </>
            )}
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn-small secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
            >
              처음
            </button>
            <button
              type="button"
              className="btn-small secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            <span className="page-indicator">
              페이지 <span>{page}</span> / <span>{totalPages}</span>
            </span>
            <button
              type="button"
              className="btn-small secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>
            <button
              type="button"
              className="btn-small secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}
            >
              마지막
            </button>
          </div>
          <div className="page-size-selector">
            <span className="save-queue-page-size-hint" id="save-queue-page-size-label">
              페이지당
            </span>
            <select
              aria-labelledby="save-queue-page-size-label"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              disabled={loading}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}건
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
