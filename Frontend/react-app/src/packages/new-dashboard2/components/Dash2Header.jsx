/**
 * Dash2Header (뉴 대시보드2 상단 헤더)
 * =====================================
 * 날짜 네비(◀ ▶) + 날짜 표시/input(date|week|month) + 주간 시 N주차 라벨 + period 토글(일간/주간/월간) + 새로고침.
 *
 * [Props]
 * 1. targetDate, onDateChange, period, onPeriodChange, dateRangeActual, onPrev, onNext, onRefresh, loading
 *
 * [Dependencies]
 * - ../utils/dateUtils: getMonthWeekLabel, dateToWeekValue, weekValueToDate
 */

import { getMonthWeekLabel, dateToWeekValue, weekValueToDate } from '../utils/dateUtils'

// 1.
export default function Dash2Header({
  targetDate,
  onDateChange,
  period,
  onPeriodChange,
  dateRangeActual,
  onPrev,
  onNext,
  onRefresh,
  loading,
}) {
  const formatDateDisplay = () => {
    if (!targetDate) return ''
    const [y, m, d] = [targetDate.slice(0, 4), targetDate.slice(5, 7), targetDate.slice(8, 10)]
    if (period === 'monthly') return `${y}.${m}`
    if (period === 'weekly' && dateRangeActual?.[0] && dateRangeActual?.[1]) {
      const s = dateRangeActual[0]
      const e = dateRangeActual[1]
      return `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)} ~ ${e.slice(5, 7)}.${e.slice(8, 10)}`
    }
    return `${y}.${m}.${d}`
  }

  const weekLabel =
    period === 'weekly' && dateRangeActual?.[0] ? getMonthWeekLabel(dateRangeActual[0]) : null

  const inputType = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'date'
  const inputValue =
    period === 'monthly'
      ? targetDate.slice(0, 7)
      : period === 'weekly'
        ? dateToWeekValue(targetDate)
        : targetDate

  const handleDateInput = (e) => {
    const val = e.target.value
    if (!val) return
    if (period === 'monthly') {
      onDateChange(`${val}-01`)
      return
    }
    if (period === 'weekly') {
      const date = weekValueToDate(val)
      if (date) onDateChange(date)
      return
    }
    onDateChange(val)
  }

  return (
    <header className="nd2-header">
      <div className="nd2-header__left" />
      <div className="nd2-header__center">
        <button type="button" className="nd2-header__nav-btn" onClick={onPrev} aria-label="이전">
          ◀
        </button>
        <label className="nd2-header__date-label" title="클릭 시 달력에서 날짜 선택">
          <span className="nd2-header__date-display">{formatDateDisplay()}</span>
          <input
            type={inputType}
            className="nd2-header__date-input"
            value={inputValue}
            onChange={handleDateInput}
          />
        </label>
        <button type="button" className="nd2-header__nav-btn" onClick={onNext} aria-label="다음">
          ▶
        </button>
        {weekLabel && <span className="nd2-header__week-label">{weekLabel}</span>}
      </div>
      <div className="nd2-header__right">
        <div className="nd2-header__period-toggle">
          {[
            { key: 'daily', label: '일간' },
            { key: 'weekly', label: '주간' },
            { key: 'monthly', label: '월간' },
          ].map(({ key, label }) => (
            <button
              type="button"
              key={key}
              className={`nd2-header__period-btn ${period === key ? 'nd2-header__period-btn--active' : ''}`}
              onClick={() => onPeriodChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="nd2-header__refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>
    </header>
  )
}
