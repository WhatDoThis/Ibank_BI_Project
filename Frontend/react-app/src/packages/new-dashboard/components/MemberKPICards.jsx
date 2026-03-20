/**
 * MemberKPICards (회원 현황 KPI 카드 — 1행 3열)
 * ==============================================
 * 전체 회원수, 발송 대상, 전환(증감 건·퍼센트포인트)을 nd-kpi-card·nd-kpi-grid--3col로 표시.
 * 전환: 증감 톤별 녹/적 색, 하단 ‘증가 또는 감소된 회원 전환률’ 안내.
 * API member-summary 응답 객체를 받는다.
 *
 * [Components]
 * ===========
 * 1. formatSignedInt — 증감 건 (+/- 및 천단위)
 * 2. formatSignedPct — 증감 %(소수 둘째)
 * 3. conversionTone — 타겟 증감 건·전환율 pp 부호로 up|down|neutral
 * 4. MemberKPICards (default export)
 *
 * [Dependencies]
 * =========
 * - (UI 전용, 외부 차트 라이브러리 없음)
 */

// 1.
function formatSignedInt(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n === 0) return '0'
  const sign = n > 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toLocaleString()}`
}

// 2.
function formatSignedPct(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n === 0) return '0.00%'
  const sign = n > 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

// 3.
function conversionTone(targetDelta, rateDeltaPp) {
  const t = targetDelta
  const p = rateDeltaPp
  if (t != null && t !== 0) return t > 0 ? 'up' : 'down'
  if (p != null && p !== 0) return p > 0 ? 'up' : 'down'
  return 'neutral'
}

// 4.
export default function MemberKPICards({ memberData }) {
  if (!memberData) return null

  const {
    total_recipients,
    total_recipients_change_pct,
    target_recipients,
    target_recipients_change_pct,
    conversion_target_delta,
    conversion_rate_delta_pp,
  } = memberData

  const convTone = conversionTone(conversion_target_delta, conversion_rate_delta_pp)

  const cards = [
    {
      label: '전체 회원수',
      value: total_recipients,
      change: total_recipients_change_pct,
      color: '#7c5cfc',
      variant: 'default',
    },
    {
      label: '발송 대상 회원수',
      value: target_recipients,
      change: target_recipients_change_pct,
      color: '#3b82f6',
      description: '타겟 모수',
      variant: 'default',
    },
    {
      label: '전환',
      color: '#22c55e',
      variant: 'conversion',
      countStr: formatSignedInt(conversion_target_delta),
      pctStr: formatSignedPct(conversion_rate_delta_pp),
    },
  ]

  return (
    <div className="nd-kpi-grid nd-kpi-grid--3col nd-kpi-grid--member">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`nd-kpi-card${card.variant === 'conversion' ? ' nd-kpi-card--conversion' : ''}`}
          style={{ borderTop: `3px solid ${card.color}` }}
        >
          <div className="nd-kpi-card__header">
            <span className="nd-kpi-card__label">{card.label}</span>
            {card.variant === 'default' && card.change != null && (
              <span
                className={`nd-kpi-card__change ${card.change >= 0 ? 'nd-kpi-card__change--up' : 'nd-kpi-card__change--down'}`}
              >
                {card.change >= 0 ? '▲' : '▼'} {Math.abs(card.change).toFixed(2)}%
              </span>
            )}
          </div>
          {card.variant === 'conversion' ? (
            <>
              <div
                className={`nd-kpi-card__value nd-kpi-card__value--conversion nd-kpi-card__value--conversion-${convTone}`}
              >
                <span className="nd-kpi-card__conversion-part">{card.countStr}</span>
                <span className="nd-kpi-card__conversion-sep">/</span>
                <span className="nd-kpi-card__conversion-part">{card.pctStr}</span>
              </div>
              <div className="nd-kpi-card__conversion-guide">
                증가 또는 감소된 회원 전환률
              </div>
            </>
          ) : (
            <>
              <div className="nd-kpi-card__value">
                {card.value != null ? Number(card.value).toLocaleString() : '-'}
              </div>
              {card.description && (
                <div className="nd-kpi-card__desc">{card.description}</div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
