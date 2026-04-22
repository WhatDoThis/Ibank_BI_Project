/**
 * AdminSortableTh.jsx (관리 목록 정렬 가능 th)
 * ============================================
 * nd-rank-table 스타일(화살표)과 동일한 3단계: desc → asc → 비활성.
 *
 * [Main Functions]
 * ===========
 * 1. AdminSortableTh
 *
 * [Dependencies]
 * =========
 * - React
 * - app/admin/admin-list-table.css (부모에서 import)
 */

// 1.
/**
 * @param {{
 *   children: import('react').ReactNode
 *   sortKey: string
 *   activeKey: string | null
 *   dir: 'asc' | 'desc' | null
 *   onSort: (key: string) => void
 *   className?: string
 *   scope?: string
 *   align?: 'left' | 'center' | 'right'
 *   title?: string
 * }} props
 */
export default function AdminSortableTh({
  children,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = '',
  scope,
  align = 'left',
  title,
}) {
  const active = activeKey === sortKey && dir != null
  const alignClass =
    align === 'center' ? 'admin-list-sort__th--center' : align === 'right' ? 'admin-list-sort__th--right' : ''
  return (
    <th
      scope={scope || 'col'}
      className={[
        'admin-list-sort__th',
        alignClass,
        active ? 'admin-list-sort__th--sorted' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="admin-list-sort__btn"
        onClick={() => onSort(sortKey)}
        title={[title, '클릭: 내림차순 → 오름차순 → 기본'].filter(Boolean).join(' · ')}
      >
        <span className="admin-list-sort__label">{children}</span>
        {active ? (
          <span className="admin-list-sort__icon" aria-hidden>
            {dir === 'desc' ? '▼' : '▲'}
          </span>
        ) : (
          <span className="admin-list-sort__icon admin-list-sort__icon--muted" aria-hidden>
            ↕
          </span>
        )}
      </button>
    </th>
  )
}
