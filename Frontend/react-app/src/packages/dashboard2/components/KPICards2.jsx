/**
 * dashboard2/components/KPICards2.jsx (KPI 카드)
 * ================================================
 * 대시보드2 전용. KPI를 카드 형태로 시각화. 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭 + 성공률/실패률/오픈률/클릭률.
 * rate 지표는 formatRateDisplay로 소수 둘째 자리(00.00%) 고정 표시.
 * 표시할 지표 선택: 접이식 체크박스, localStorage(storageKey) 저장. 추후 대시보드 테이블 시 JSON 컬럼으로 이전 가능.
 *
 * [의존성]
 * - React
 */

import { useState, useEffect, useMemo } from 'react'

const ALL_KPI_KEYS = [
  'campaign_count', 'workflow_count', 'channel_count',
  'total_send', 'total_success', 'total_failed', 'total_open', 'total_click',
  'success_rate', 'failed_rate', 'open_rate', 'click_rate'
]

function loadVisibleKeys(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return ALL_KPI_KEYS
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return ALL_KPI_KEYS
    const valid = arr.filter((k) => ALL_KPI_KEYS.includes(k))
    return valid.length > 0 ? valid : ALL_KPI_KEYS
  } catch {
    return ALL_KPI_KEYS
  }
}

function saveVisibleKeys(storageKey, keys) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys))
  } catch (e) {
    console.warn('KPICards2 visibleKeys save failed', e)
  }
}

function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

/** rate 지표(성공률·실패률·오픈률·클릭률) 표시: 소수점 둘째 자리 반올림, 정수여도 00.00% 형식 */
function formatRateDisplay(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.00'
  const val = Math.round(Number(n) * 100) / 100
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

/** 신호등 달성률: 소수점 첫째 자리까지 반올림 */
function formatRatioPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.0'
  const val = Math.round(Number(n) * 10) / 10
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val)
}

const CARD_CONFIG = [
  { label: '캠페인 수', valueKey: 'campaign_count', unit: '개', icon: '📋', bg: '#f0f9ff', color: '#0369a1', definition: '집계 구간 내 서로 다른 캠페인(campaign_id) 개수' },
  { label: '워크플로우 수', valueKey: 'workflow_count', unit: '개', icon: '🔄', bg: '#f0fdfa', color: '#0d9488', definition: '집계 구간 내 서로 다른 워크플로우(workflow_id) 개수' },
  { label: '채널 수', valueKey: 'channel_count', unit: '개', icon: '📡', bg: '#fefce8', color: '#a16207', definition: '집계 구간 내 서로 다른 배송 채널(delivery_channel) 개수' },
  { label: '발송 요청', valueKey: 'total_send', unit: '건', icon: '📤', bg: '#eff6ff', color: '#1d4ed8', definition: '발송 요청 건수 합계 (total_count)' },
  { label: '발송 성공', valueKey: 'total_success', unit: '건', icon: '✅', bg: '#f0fdf4', color: '#15803d', definition: '발송 성공 건수 합계 (success_count)' },
  { label: '발송 실패', valueKey: 'total_failed', unit: '건', icon: '❌', bg: '#fef2f2', color: '#b91c1c', definition: '발송 실패 건수 합계 (failed_count)' },
  { label: '오픈', valueKey: 'total_open', unit: '건', icon: '👁', bg: '#faf5ff', color: '#7c3aed', definition: '오픈 건수 합계 (open_count)' },
  { label: '클릭', valueKey: 'total_click', unit: '건', icon: '👆', bg: '#fff7ed', color: '#c2410c', definition: '클릭 건수 합계 (click_count)' },
  { label: '성공률', valueKey: 'success_rate', unit: '%', icon: '📊', bg: '#ecfdf5', color: '#047857', definition: '(발송 성공 / 발송 요청) × 100' },
  { label: '실패률', valueKey: 'failed_rate', unit: '%', icon: '⚠️', bg: '#fef2f2', color: '#dc2626', definition: '(발송 실패 / 발송 요청) × 100' },
  { label: '오픈률', valueKey: 'open_rate', unit: '%', icon: '📈', bg: '#f5f3ff', color: '#6d28d9', definition: '(오픈 / 발송 성공) × 100' },
  { label: '클릭률', valueKey: 'click_rate', unit: '%', icon: '🎯', bg: '#fffbeb', color: '#d97706', definition: '(클릭 / 발송 성공) × 100' }
]

/** Phase 4: 목표 대비 신호등 색상·라벨 */
const STATUS_STYLE = {
  ok: { border: '#16a34a', bg: '#dcfce7', label: '달성' },
  warning: { border: '#ca8a04', bg: '#fef9c3', label: '주의' },
  fail: { border: '#dc2626', bg: '#fee2e2', label: '미달' }
}

export default function KPICards2({ kpi, targetStatusByKey = {}, storageKey = 'dashboard2_kpi_visible', children }) {
  const [visibleKeys, setVisibleKeys] = useState(() => loadVisibleKeys(storageKey))
  const [selectorOpen, setSelectorOpen] = useState(false)

  useEffect(() => {
    saveVisibleKeys(storageKey, visibleKeys)
  }, [storageKey, visibleKeys])

  const toggleKey = (valueKey) => {
    setVisibleKeys((prev) =>
      prev.includes(valueKey)
        ? prev.filter((k) => k !== valueKey)
        : [...prev, valueKey]
    )
  }

  const visibleConfig = useMemo(
    () => CARD_CONFIG.filter((c) => visibleKeys.includes(c.valueKey)),
    [visibleKeys]
  )

  if (!kpi) return null
  return (
    <section className="dashboard2-kpi-cards-section">
      <div className="dashboard2-kpi-grid">
        {visibleConfig.map((c) => {
          const value = kpi[c.valueKey] ?? 0
          const statusInfo = targetStatusByKey[c.valueKey]
          const style = statusInfo ? STATUS_STYLE[statusInfo.status] : null
          return (
            <div
              key={c.valueKey}
              className={`dashboard2-kpi-card${style ? ` dashboard2-kpi-card--${statusInfo.status}` : ''}`}
              style={{
                background: style?.bg ?? c.bg,
                border: `2px solid ${style ? style.border : `${c.color}20`}`,
                color: c.color
              }}
            >
              <div className="dashboard2-kpi-card__label">
                <span>{c.icon}</span>
                <span>{c.label}</span>
                {c.definition && (
                  <span
                    className="dashboard2-kpi-card__def-trigger"
                    title={c.definition}
                    aria-label="지표 정의"
                  >
                    ?
                  </span>
                )}
                {statusInfo && (
                  <span
                    className={`dashboard2-kpi-card__badge dashboard2-kpi-card__badge--${statusInfo.status}`}
                    title={`목표 대비 ${formatRatioPct(statusInfo.ratioPct)}%`}
                  >
                    {STATUS_STYLE[statusInfo.status].label} {formatRatioPct(statusInfo.ratioPct)}%
                  </span>
                )}
              </div>
              <div className="dashboard2-kpi-card__value" style={{ color: c.color }}>
                {c.unit === '%' ? formatRateDisplay(value) : formatNum(value)}
                <span className="dashboard2-kpi-card__unit">{c.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
      {children}
      <div className="dashboard2-kpi-selector-wrap">
        <button
          type="button"
          className="dashboard2-kpi-selector-trigger"
          onClick={() => setSelectorOpen((o) => !o)}
          aria-expanded={selectorOpen}
        >
          표시할 지표 선택 {selectorOpen ? '▲' : '▼'}
        </button>
        {selectorOpen && (
          <div className="dashboard2-kpi-selector-checkboxes">
            {CARD_CONFIG.map((c) => (
              <label key={c.valueKey} className="dashboard2-kpi-selector-label">
                <input
                  type="checkbox"
                  checked={visibleKeys.includes(c.valueKey)}
                  onChange={() => toggleKey(c.valueKey)}
                />
                <span>{c.icon} {c.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
