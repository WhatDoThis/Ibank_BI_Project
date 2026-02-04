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
    <section className="kpi-cards-section kpi-cards" style={{ marginBottom: 24, width: '100%' }}>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        주요 지표
      </h3>
      <div className="kpi-grid" style={{ width: '100%' }}>
        {CARD_CONFIG.map((c) => {
          const value = kpi[c.valueKey] ?? 0
          return (
            <div
              key={c.valueKey}
              style={{
                background: c.bg,
                border: `1px solid ${c.color}20`,
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>
                {formatNum(value)}
                <span style={{ fontSize: 15, fontWeight: 500, marginLeft: 4, opacity: 0.9 }}>{c.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
