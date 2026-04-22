/**
 * shared/components/AdminListPaginationFooter.jsx (관리 목록 공통 페이지네이션 푸터)
 * =============================================================================
 * 필터·정렬 후 클라이언트 목록 또는 서버 total 기준으로 동일 UI(건수·10·20·50·«‹›»·페이지 입력)를 제공한다.
 *
 * [Main Functions]
 * ===========
 * 1. AdminListPaginationFooter — 요약·페이지 크기·페이지 이동·입력 검증·totalPages 축소 시 page 클램프
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - props: total, page, pageSize, onPageChange, onPageSizeChange, loading?, disabled?, pageSizeChoices?, idPrefix?, className?
 *
 * [Dependencies]
 * =========
 * - React(useCallback, useEffect, useMemo, useState)
 * - app/admin/admin-list-pagination.css(페이지 입력란 포함)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import '@/app/admin/admin-list-pagination.css'

/** 관리 1~6·통합 이력과 동일한 페이지당 행 수 선택지(파일 내부 상수 — fast-refresh는 default export만 유지) */
const DEFAULT_PAGE_SIZE_CHOICES = [10, 20, 50]

// 1.
/**
 * @param {{
 *   total: number
 *   page: number
 *   pageSize: number
 *   onPageChange: (p: number) => void
 *   onPageSizeChange: (n: number) => void
 *   loading?: boolean
 *   disabled?: boolean
 *   pageSizeChoices?: number[]
 *   idPrefix?: string
 *   className?: string
 * }} props
 */
export default function AdminListPaginationFooter({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  disabled = false,
  pageSizeChoices = DEFAULT_PAGE_SIZE_CHOICES,
  idPrefix = 'admin-list-pager',
  className = '',
}) {
  const totalN = Number(total) || 0
  const sizeN = Math.max(1, Number(pageSize) || 10)
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalN / sizeN) || 1),
    [totalN, sizeN],
  )

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages)
  }, [page, totalPages, onPageChange])

  const [pageField, setPageField] = useState(String(page))
  useEffect(() => {
    setPageField(String(page))
  }, [page])

  const commitPageField = useCallback(() => {
    const raw = String(pageField).trim()
    const n = parseInt(raw, 10)
    if (Number.isNaN(n) || n < 1) {
      setPageField(String(page))
      return
    }
    const clamped = Math.min(totalPages, n)
    setPageField(String(clamped))
    if (clamped !== page) onPageChange(clamped)
  }, [pageField, page, totalPages, onPageChange])

  const rowFrom = totalN === 0 ? 0 : (page - 1) * sizeN + 1
  const rowTo = totalN === 0 ? 0 : Math.min(page * sizeN, totalN)
  const busy = Boolean(loading) || Boolean(disabled)
  const rootClass = ['admin-list-pager', className.trim()].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <p className="admin-list-pager__summary" aria-live="polite">
        {totalN === 0 ? (
          <>
            총 <strong>0</strong>건
          </>
        ) : (
          <>
            총 <strong>{totalN.toLocaleString('ko-KR')}</strong>건 ·{' '}
            <strong>{rowFrom.toLocaleString('ko-KR')}</strong>–<strong>{rowTo.toLocaleString('ko-KR')}</strong>번째 표시
          </>
        )}
      </p>
      <div className="admin-list-pager__right">
        <div className="admin-list-pager__sizes" role="group" aria-label="페이지당 표시 행 수">
          {pageSizeChoices.map((n) => (
            <button
              key={n}
              type="button"
              className={`admin-list-pager__size-btn${pageSize === n ? ' admin-list-pager__size-btn--active' : ''}`}
              disabled={busy}
              aria-pressed={pageSize === n}
              onClick={() => {
                if (pageSize === n) return
                onPageSizeChange(n)
              }}
            >
              {n}개
            </button>
          ))}
        </div>
        <nav className="admin-list-pager__nav" aria-label="페이지 이동">
          <button
            type="button"
            className="admin-list-pager__page-btn"
            disabled={busy || page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="첫 페이지"
            title="첫 페이지"
          >
            «
          </button>
          <button
            type="button"
            className="admin-list-pager__page-btn"
            disabled={busy || page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="이전 페이지"
            title="이전 페이지"
          >
            ‹
          </button>
          <span className="admin-list-pager__jump">
            <input
              id={`${idPrefix}-page-input`}
              className="admin-list-pager__page-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label="페이지 번호"
              disabled={busy}
              value={pageField}
              onChange={(e) => setPageField(e.target.value.replace(/\D/g, ''))}
              onBlur={commitPageField}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitPageField()
                }
              }}
            />
            <span className="admin-list-pager__slash" aria-hidden="true">
              /
            </span>
            <span className="admin-list-pager__total" aria-label={`전체 ${totalPages}페이지`}>
              {totalPages}
            </span>
          </span>
          <button
            type="button"
            className="admin-list-pager__page-btn"
            disabled={busy || page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-label="다음 페이지"
            title="다음 페이지"
          >
            ›
          </button>
          <button
            type="button"
            className="admin-list-pager__page-btn"
            disabled={busy || page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="마지막 페이지"
            title="마지막 페이지"
          >
            »
          </button>
        </nav>
      </div>
    </div>
  )
}
