/**
 * SummaryHeader (뉴 대시보드 상단 헤더)
 * =====================================
 * 날짜 네비(클릭 시 네이티브 달력), 주간 N주차, period 토글, 새로고침. 테이블은 페이지에서 단일 Star 테이블만 사용.
 * onDateChange: 날짜 직접 선택 시 호출.
 *
 * [Components]
 * 1. SummaryHeader (default export)
 */
import { getMonthWeekLabel, dateToWeekValue, weekValueToDate } from './dateUtils'

// 1.
export default function SummaryHeader({
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
      const s = dateRangeActual[0], e = dateRangeActual[1]
      return `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)} ~ ${e.slice(5, 7)}.${e.slice(8, 10)}`
    }
    return `${y}.${m}.${d}`
  }

  const weekLabel =
    period === 'weekly' && dateRangeActual?.[0]
      ? getMonthWeekLabel(dateRangeActual[0])
      : null

  const inputType = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'date'
  const inputValue = period === 'monthly'
    ? targetDate.slice(0, 7)
    : period === 'weekly'
      ? dateToWeekValue(targetDate)
      : targetDate

  const handleDateInput = (e) => {
    const val = e.target.value
    if (!val) return
    if (period === 'monthly') return onDateChange(`${val}-01`)
    if (period === 'weekly') {
      const date = weekValueToDate(val)
      if (date) onDateChange(date)
      return
    }
    onDateChange(val)
  }

  return (
    <header className="nd-header">
      <div className="nd-header__center">
        <button type="button" className="nd-header__nav-btn" onClick={onPrev} aria-label="이전">
          ◀
        </button>
        <label className="nd-header__date-label" title="클릭 시 달력에서 날짜 선택">
          <span className="nd-header__date-display">{formatDateDisplay()}</span>
          <span className="nd-header__date-calendar-hint" aria-hidden>📅</span>
          <input
            type={inputType}
            className="nd-header__date-input"
            value={inputValue}
            onChange={handleDateInput}
          />
        </label>
        <button type="button" className="nd-header__nav-btn" onClick={onNext} aria-label="다음">
          ▶
        </button>
        {weekLabel && <span className="nd-header__week-label">{weekLabel}</span>}
      </div>
      <div className="nd-header__right">
        <div className="nd-header__period-toggle">
          {[
            { key: 'daily', label: '일간' },
            { key: 'weekly', label: '주간' },
            { key: 'monthly', label: '월간' },
          ].map(({ key, label }) => (
            <button
              type="button"
              key={key}
              className={`nd-header__period-btn ${period === key ? 'nd-header__period-btn--active' : ''}`}
              onClick={() => onPeriodChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="nd-header__refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>
    </header>
  )
}
