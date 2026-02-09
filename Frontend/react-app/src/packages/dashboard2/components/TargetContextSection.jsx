/**
 * dashboard2/components/TargetContextSection.jsx (목표·컨텍스트 섹션)
 * ======================================================================
 * Phase 1: 기간 유형(연/월/기간) + 지표 + 목표값 입력·저장, 저장된 목표 목록 표시.
 * 저장소는 상위에서 관리(localStorage). 본 컴포넌트는 targets, onSave, onDelete만 받음.
 *
 * [의존성]
 * - React
 */

import { useState, useCallback } from 'react'

const PERIOD_OPTIONS = [
  { value: 'year', label: '년도' },
  { value: 'month', label: '월' },
  { value: 'range', label: '기간(년.월~년.월)' }
]

const TARGET_METRIC_OPTIONS = [
  { value: 'campaign_count', label: '캠페인 수' },
  { value: 'total_send', label: '발송 요청' },
  { value: 'total_success', label: '발송 성공' },
  { value: 'total_failed', label: '발송 실패' },
  { value: 'total_open', label: '오픈' },
  { value: 'total_click', label: '클릭' },
  { value: 'success_rate', label: '성공률(%)' },
  { value: 'failed_rate', label: '실패률(%)' },
  { value: 'open_rate', label: '오픈률(%)' },
  { value: 'click_rate', label: '클릭률(%)' }
]

/** 목표 1건에 대한 기간 라벨 문자열 */
export function getTargetPeriodLabel(t) {
  if (!t) return '-'
  if (t.periodType === 'year') return `${t.year}.01~${t.year}.12`
  if (t.periodType === 'month') {
    const m = String(t.month ?? 0).padStart(2, '0')
    return `${t.year}.${m}~${t.year}.${m}`
  }
  if (t.periodType === 'range' && t.rangeStart && t.rangeEnd) {
    const s = t.rangeStart.replace('-', '.')
    const e = t.rangeEnd.replace('-', '.')
    return `${s}~${e}`
  }
  return '-'
}

/** 목표 지표 라벨 */
export function getTargetMetricLabel(metricKey) {
  return TARGET_METRIC_OPTIONS.find((m) => m.value === metricKey)?.label ?? metricKey
}

/** targetValue 실수 파싱. 빈 문자열·잘못된 값이면 null */
function parseTargetValue(str) {
  if (str == null || String(str).trim() === '') return null
  const n = Number(String(str).trim().replace(/,/g, ''))
  return Number.isNaN(n) ? null : n
}

export default function TargetContextSection({ dateRange = [], targets = [], onSave, onDelete }) {
  const [periodType, setPeriodType] = useState('month')
  const [metric, setMetric] = useState('total_success')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(1)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [targetValueInput, setTargetValueInput] = useState('')
  const [saveError, setSaveError] = useState('')

  const handleSave = useCallback(() => {
    setSaveError('')
    const y = Number(year)
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      setSaveError('연도를 2000~2100 사이 정수로 입력하세요.')
      return
    }
    const value = parseTargetValue(targetValueInput)
    if (value === null) {
      setSaveError('목표값을 숫자로 입력하세요.')
      return
    }

    const payload = {
      periodType,
      metric,
      year: y,
      month: null,
      rangeStart: null,
      rangeEnd: null,
      targetValue: value
    }

    if (periodType === 'month') {
      const m = Number(month)
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        setSaveError('월을 1~12 사이로 입력하세요.')
        return
      }
      payload.month = m
    } else if (periodType === 'range') {
      const start = String(rangeStart).trim()
      const end = String(rangeEnd).trim()
      if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) {
        setSaveError('기간은 YYYY-MM 형식으로 입력하세요.')
        return
      }
      if (start > end) {
        setSaveError('시작일이 종료일보다 늦을 수 없습니다.')
        return
      }
      payload.rangeStart = start
      payload.rangeEnd = end
    }

    onSave(payload)
    setTargetValueInput('')
  }, [periodType, metric, year, month, rangeStart, rangeEnd, targetValueInput, onSave])

  return (
    <section className="dashboard2-target-context-section">
      <div className="dashboard2-target-context__row">
        <div className="dashboard2-target-context__right">
          <div className="dashboard2-target-context__form">
            <label className="dashboard2-target-context__label">기간 유형</label>
            <select
              className="dashboard2-target-context__select"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <label className="dashboard2-target-context__label">지표</label>
            <select
              className="dashboard2-target-context__select"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {TARGET_METRIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <label className="dashboard2-target-context__label">년도</label>
            <input
              type="number"
              className="dashboard2-target-context__input"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />

            {periodType === 'month' && (
              <>
                <label className="dashboard2-target-context__label">월</label>
                <input
                  type="number"
                  className="dashboard2-target-context__input"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </>
            )}

            {periodType === 'range' && (
              <>
                <label className="dashboard2-target-context__label">시작</label>
                <input
                  type="month"
                  className="dashboard2-target-context__input"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
                <label className="dashboard2-target-context__label">종료</label>
                <input
                  type="month"
                  className="dashboard2-target-context__input"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </>
            )}

            <label className="dashboard2-target-context__label">목표값</label>
            <input
              type="text"
              inputMode="decimal"
              className="dashboard2-target-context__input"
              placeholder="숫자 입력"
              value={targetValueInput}
              onChange={(e) => {
                const v = e.target.value
                if (v === '' || /^-?\d*\.?\d*$/.test(v)) setTargetValueInput(v)
              }}
            />

            <button
              type="button"
              className="dashboard2-target-context__save-btn"
              onClick={handleSave}
            >
              저장
            </button>
          </div>
          {saveError && (
            <div className="dashboard2-target-context__error">{saveError}</div>
          )}
        </div>
      </div>

      {targets.length > 0 && (
        <div className="dashboard2-target-context__list-wrap">
          <div className="dashboard2-target-context__list-title">저장된 목표</div>
          <table className="dashboard2-target-context__table">
            <thead>
              <tr>
                <th>기간</th>
                <th>지표</th>
                <th>목표값</th>
                {typeof onDelete === 'function' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {targets.map((t, idx) => (
                <tr key={idx}>
                  <td>{getTargetPeriodLabel(t)}</td>
                  <td>{getTargetMetricLabel(t.metric)}</td>
                  <td>{typeof t.targetValue === 'number' ? t.targetValue.toLocaleString('ko-KR') : t.targetValue}</td>
                  {typeof onDelete === 'function' && (
                    <td>
                      <button
                        type="button"
                        className="dashboard2-target-context__delete-btn"
                        onClick={() => onDelete(idx)}
                      >
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
