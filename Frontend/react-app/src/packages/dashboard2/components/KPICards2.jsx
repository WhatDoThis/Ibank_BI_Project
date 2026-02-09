/**
 * dashboard2/components/KPICards2.jsx (KPI 카드)
 * ================================================
 * 대시보드2 전용. KPI를 카드 형태로 시각화. 캠페인 수, 발송/성공/실패/오픈/클릭 + 성공률/실패률/오픈률/클릭률.
 *
 * [의존성]
 * - React
 */

function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

/** 신호등 달성률: 소수점 첫째 자리까지 반올림 */
function formatRatioPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.0'
  const val = Math.round(Number(n) * 10) / 10
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val)
}

const CARD_CONFIG = [
  { label: '캠페인 수', valueKey: 'campaign_count', unit: '개', icon: '📋', bg: '#f0f9ff', color: '#0369a1', definition: '집계 구간 내 서로 다른 캠페인(campaign_id) 개수' },
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

export default function KPICards2({ kpi, targetStatusByKey = {} }) {
  if (!kpi) return null
  return (
    <section className="dashboard2-kpi-cards-section">
      <div className="dashboard2-kpi-grid">
        {CARD_CONFIG.map((c) => {
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
                {formatNum(value)}
                <span className="dashboard2-kpi-card__unit">{c.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
