/**
 * adminListTable.js (관리 목록 테이블 정렬·필터 공통)
 * =====================================================
 * 컬럼 헤더 3단계 정렬(desc → asc → 해제), 문자열 contains, 날짜(로컬일) 범위 필터용 유틸.
 *
 * [Main Functions]
 * ===========
 * 1. cycleListSort — 단일 컬럼 정렬 상태 순환
 * 2. compareValues — 숫자·날짜·문자열 비교
 * 3. strContains — 대소문자 무시 부분 일치
 * 4. dateFieldInRange — ISO/타임스탬프 문자열이 로컬일 범위 안인지
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1.
/**
 * @param {{ key: string | null, dir: 'asc' | 'desc' | null }} current
 * @param {string} clickedKey
 * @returns {{ key: string | null, dir: 'asc' | 'desc' | null }}
 */
export function cycleListSort(current, clickedKey) {
  if (!clickedKey) return { key: null, dir: null }
  if (current.key !== clickedKey) return { key: clickedKey, dir: 'desc' }
  if (current.dir === 'desc') return { key: clickedKey, dir: 'asc' }
  return { key: null, dir: null }
}

// 2.
export function compareValues(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number' && !Number.isNaN(a) && !Number.isNaN(b)) {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a) === String(na) && String(b) === String(nb)) {
    if (na < nb) return -1
    if (na > nb) return 1
    return 0
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// 3.
export function strContains(haystack, needle) {
  const n = String(needle ?? '').trim()
  if (!n) return true
  const h = String(haystack ?? '').toLowerCase()
  return h.includes(n.toLowerCase())
}

// 4.
/** @param {string} [dateStr] yyyy-mm-dd */
function dayStartMs(dateStr) {
  const s = String(dateStr ?? '').trim()
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

/** @param {string} [dateStr] yyyy-mm-dd */
function dayEndMs(dateStr) {
  const s = String(dateStr ?? '').trim()
  if (!s) return null
  const d = new Date(`${s}T23:59:59.999`)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * @param {unknown} value — Date 객체 또는 ISO 문자열 등
 * @param {string} [fromStr] yyyy-mm-dd
 * @param {string} [toStr] yyyy-mm-dd
 */
export function dateFieldInRange(value, fromStr, toStr) {
  const fromMs = dayStartMs(fromStr)
  const toMs = dayEndMs(toStr)
  if (fromMs == null && toMs == null) return true
  if (value == null || value === '') return false
  let t
  if (value instanceof Date) t = value.getTime()
  else t = new Date(value).getTime()
  if (Number.isNaN(t)) return false
  if (fromMs != null && t < fromMs) return false
  if (toMs != null && t > toMs) return false
  return true
}

/**
 * @template T
 * @param {T[]} rows
 * @param {{ key: string | null, dir: 'asc' | 'desc' | null }} sort
 * @param {(row: T, key: string) => unknown} getComparable
 * @returns {T[]}
 */
export function sortRowsByState(rows, sort, getComparable) {
  if (!sort.key || !sort.dir) return rows
  const mult = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((ra, rb) => mult * compareValues(getComparable(ra, sort.key), getComparable(rb, sort.key)))
}
