/**
 * ScoreCardGrid (부문별 스코어카드 그리드)
 * =========================================
 * 각 분석 탭의 핵심 지표 1~2개를 미니 카드로 보여주는 컴포넌트.
 *
 * [Components / Functions]
 * 1. ScoreCardChange: 증감률 표시
 * 2. ScoreCardGrid: items, loading 기반 그리드 렌더
 *
 * [Dependencies]
 * - new-dashboard2.css (.nd2-score-card-grid, .nd2-score-card, .nd2-score-card--skeleton, ...)
 */

const TITLE_COLORS = {
  별: '#fbbf24',
  프리퀀시: '#8b5cf6',
  쿠폰: '#ec4899',
  캠페인: '#3b82f6',
  매장: '#10b981',
}

const SIGNAL_COLORS = {
  good: '#10b981',
  warn: '#f59e0b',
  poor: '#ef4444',
}

// 1.
function ScoreCardChange({ changePct }) {
  if (changePct == null) return null
  const n = Number(changePct)
  if (n === 0) return <span className="nd2-score-card__change">— 0%</span>
  const isUp = n > 0
  const cls = `nd2-score-card__change nd2-score-card__change--${isUp ? 'up' : 'down'}`
  return (
    <span className={cls}>
      {isUp ? '▲' : '▼'} {Math.abs(n).toFixed(1)}%
    </span>
  )
}

// 2.
export default function ScoreCardGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="nd2-score-card-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="nd2-score-card nd2-score-card--skeleton" aria-busy="true" />
        ))}
      </div>
    )
  }
  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="nd2-score-card-grid">
      {items.map((item, idx) => {
        const barColor = TITLE_COLORS[item.title] || '#6b7280'
        return (
          <div
            key={item.title + idx}
            className="nd2-score-card"
            style={{ borderLeft: `2px solid ${barColor}` }}
          >
            <div className="nd2-score-card__title">{item.title}</div>
            <div className="nd2-score-card__metrics">
              {item.metrics.map((m, i) => {
                const valueStyle = m.signal ? { color: SIGNAL_COLORS[m.signal] } : undefined
                const displayValue = m.value != null ? String(m.value) : '—'
                const withUnit = m.unit != null ? `${displayValue}${m.unit}` : displayValue
                return (
                  <div key={i} className="nd2-score-card__metric">
                    <span className="nd2-score-card__label">{m.label}</span>
                    <span className="nd2-score-card__value" style={valueStyle}>
                      {withUnit}
                    </span>
                    {m.changePct != null && <ScoreCardChange changePct={m.changePct} />}
                    {m.description && (
                      <div className="nd2-score-card__desc">{m.description}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
