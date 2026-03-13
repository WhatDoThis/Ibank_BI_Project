/**
 * FunnelBar (퍼널 가로 막대 — 공용)
 * ================================
 * OverviewSection, CouponSection 등에서 사용하는 퍼널 단계 바.
 *
 * [Props]
 * 1. label, value, maxValue, prevValue, color
 *
 * [Dependencies]
 * - new-dashboard2.css (.nd2-funnel-bar)
 */

// 1.
export default function FunnelBar({ label, value, maxValue, prevValue, color }) {
  const pctOfTotal = maxValue > 0 ? (value / maxValue) * 100 : 0
  const pctOfPrev = prevValue != null && prevValue > 0 ? (value / prevValue) * 100 : null
  return (
    <div className="nd2-funnel-bar">
      <div className="nd2-funnel-bar__label">{label}</div>
      <div className="nd2-funnel-bar__track">
        <div className="nd2-funnel-bar__fill" style={{ width: `${pctOfTotal}%`, background: color }} />
      </div>
      <div className="nd2-funnel-bar__value">{Number(value).toLocaleString()}</div>
      <div className="nd2-funnel-bar__pct">{pctOfPrev != null ? `${pctOfPrev.toFixed(1)}%` : '100%'}</div>
    </div>
  )
}
