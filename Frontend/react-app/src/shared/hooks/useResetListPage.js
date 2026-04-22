/**
 * shared/hooks/useResetListPage.js (관리 목록 페이지 1로 리셋)
 * ============================================================
 * 필터·정렬·원본 행 집합 등이 바뀌면 클라이언트 페이지 인덱스를 1로 맞춰, 이전 페이지가 빈 목록을 가리키는 것을 방지한다.
 *
 * [Main Functions]
 * ===========
 * 1. useResetListPage — `deps` 값이 이전 렌더와 달리면 `setPage(1)` (최초 마운트에서는 호출하지 않음)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - useResetListPage(setPage, ...deps)
 *
 * [Dependencies]
 * =========
 * - React(useEffect, useRef)
 */

import { useEffect, useRef } from 'react'

// 1.
/**
 * @param {import('react').Dispatch<import('react').SetStateAction<number>>} setPage
 * @param {...unknown} deps — 필터·정렬·원본 행 등(참조·값이 바뀌면 1페이지로)
 */
export function useResetListPage(setPage, ...deps) {
  const prevRef = useRef(null)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = deps
    if (prev == null) return
    const unchanged =
      prev.length === deps.length && prev.every((v, i) => Object.is(v, deps[i]))
    if (!unchanged) setPage(1)
  })
}
