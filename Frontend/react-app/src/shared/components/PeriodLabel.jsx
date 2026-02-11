/**
 * shared/components/PeriodLabel.jsx (기간 표시 라벨)
 * ================================================
 * 대시보드 섹션 상단에 기준일/기간 뱃지 표시. dateRange → formatDateRangeLabel 연동.
 *
 * [Main Functions]
 * ===========
 * - PeriodLabel: dateRange, className props → 뱃지(기준일: / 기간: + label)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - PeriodLabel (default export)
 *
 * [Dependencies]
 * =========
 * - @/shared/utils/dateRange (formatDateRangeLabel)
 */

import { formatDateRangeLabel } from '@/shared/utils/dateRange'

export default function PeriodLabel({ dateRange = [], className = '' }) {
  const { label, isSingleDay } = formatDateRangeLabel(dateRange)
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="period-label__icon" aria-hidden="true">📅</span>
      <span className="period-label__text">
        {isSingleDay ? '기준일: ' : '기간: '}
        {label}
      </span>
    </div>
  )
}
