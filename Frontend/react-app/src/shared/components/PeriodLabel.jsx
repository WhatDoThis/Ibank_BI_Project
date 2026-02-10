/**
 * shared/components/PeriodLabel.jsx (기간 표시 라벨)
 * ================================================
 * 대시보드 섹션 상단에 "언제부터 언제까지" 기간을 표시. 필터에서 선택한 단일일/기간 반영.
 * 패러디: 리포트·분석 대시보드의 Reporting period 뱃지/라벨 패턴.
 *
 * [의존성]
 * - React, @/shared/utils/dateRange (formatDateRangeLabel)
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
