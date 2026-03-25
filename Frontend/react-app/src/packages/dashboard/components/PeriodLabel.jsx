/**
 * dashboard/components/PeriodLabel.jsx (기간 표시 라벨)
 * ======================================================
 * 대시보드 섹션 상단 기간 뱃지.
 *
 * [Dependencies]
 * =========
 * - ../utils/dateRange (formatDateRangeLabel)
 */

import { formatDateRangeLabel } from '../utils/dateRange.js'

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
