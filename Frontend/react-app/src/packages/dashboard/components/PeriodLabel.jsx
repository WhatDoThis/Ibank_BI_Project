/**
 * dashboard/components/PeriodLabel.jsx (기간 표시 라벨)
 * ======================================================
 * 대시보드1·2 섹션 상단 뱃지. dashboard2는 이 컴포넌트를 import하여 사용.
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
