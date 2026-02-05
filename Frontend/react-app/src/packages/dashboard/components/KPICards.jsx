/**
 * dashboard/components/KPICards.jsx (KPI 카드)
 * ============================================
 * 대시보드 KPI를 카드 형태로 시각화. 캠페인 수, 발송/성공/실패/오픈/클릭.
 *
 * [주요 기능]
 * - 숫자·단위·라벨, 카드별 색상·아이콘으로 비교·가독성 강화
 *
 * [의존성]
 * - React
 */

function formatNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('ko-KR').format(n)
}

const CARD_CONFIG = [
  { label: '캠페인 수', valueKey: 'campaign_count', unit: '개', icon: '📋', bg: '#f0f9ff', color: '#0369a1' },
  { label: '발송 요청', valueKey: 'total_send', unit: '건', icon: '📤', bg: '#eff6ff', color: '#1d4ed8' },
  { label: '발송 성공', valueKey: 'total_success', unit: '건', icon: '✅', bg: '#f0fdf4', color: '#15803d' },
  { label: '발송 실패', valueKey: 'total_failed', unit: '건', icon: '❌', bg: '#fef2f2', color: '#b91c1c' },
  { label: '오픈', valueKey: 'total_open', unit: '건', icon: '👁', bg: '#faf5ff', color: '#7c3aed' },
  { label: '클릭', valueKey: 'total_click', unit: '건', icon: '👆', bg: '#fff7ed', color: '#c2410c' }
]

export default function KPICards({ kpi }) {
  if (!kpi) return null
  return (
    <section className="kpi-cards-section kpi-cards">
      <div className="kpi-grid">
        {CARD_CONFIG.map((c) => {
          const value = kpi[c.valueKey] ?? 0
          return (
            <div
              key={c.valueKey}
              className="kpi-card"
              style={{
                background: c.bg,
                border: `1px solid ${c.color}20`,
                color: c.color
              }}
            >
              <div className="kpi-card__label">
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
              <div className="kpi-card__value" style={{ color: c.color }}>
                {formatNum(value)}
                <span className="kpi-card__unit">{c.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
