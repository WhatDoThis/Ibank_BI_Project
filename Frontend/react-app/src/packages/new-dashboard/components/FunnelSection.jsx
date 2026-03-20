/**
 * FunnelSection (전체 발송 분석 퍼널)
 * ===================================
 * 4단계(발송요청→성공→오픈→클릭) + 현재 가이드, 이전 단계 대비 비율 표시.
 *
 * [Main Functions]
 * 1. getSignal
 * 2. FunnelBar — trackScalePct로 오픈/클릭 트랙을 발송성공 비율에 맞춤
 * 3. FunnelSection (default export)
 */
// 1.
function getSignal(value, thresholds) {
  if (value >= thresholds[0]) return { icon: '✅', label: '양호', cls: 'ok' }
  if (value >= thresholds[1]) return { icon: '🔶', label: '주의', cls: 'warning' }
  return { icon: '🔴', label: '미달', cls: 'fail' }
}

// 2.
/** trackScalePct: 막대 트랙 가로 비율(0~100). 오픈/클릭은 발송성공/발송요청 비율로 트랙 폭을 맞춤. */
function FunnelBar({ label, value, maxValue, prevValue, color, trackScalePct = 100 }) {
  const pctOfTotal = maxValue > 0 ? (value / maxValue) * 100 : 0
  const pctOfPrev = prevValue > 0 ? (value / prevValue) * 100 : null
  const scale = Math.min(100, Math.max(0, trackScalePct))
  return (
    <div className="nd-funnel-bar">
      <div className="nd-funnel-bar__label">{label}</div>
      <div className="nd-funnel-bar__track-wrap">
        <div className="nd-funnel-bar__track-scaled" style={{ width: `${scale}%` }}>
          <div className="nd-funnel-bar__track">
            <div className="nd-funnel-bar__fill" style={{ width: `${pctOfTotal}%`, background: color }} />
          </div>
        </div>
      </div>
      <div className="nd-funnel-bar__value">{Number(value).toLocaleString()}</div>
      <div className="nd-funnel-bar__pct">{pctOfPrev != null ? `${pctOfPrev.toFixed(1)}%` : '100%'}</div>
    </div>
  )
}

// 3.
export default function FunnelSection({ kpi }) {
  if (!kpi) return null
  const {
    total_send,
    total_success,
    total_open,
    total_click,
    success_rate,
    open_rate,
    click_rate,
  } = kpi
  const successSignal = getSignal(success_rate || 0, [90, 80])
  const openSignal = getSignal(open_rate || 0, [20, 10])
  const clickSignal = getSignal(click_rate || 0, [5, 2])

  const successTrackPct =
    total_send > 0 ? Math.round((total_success / total_send) * 10000) / 100 : 0

  return (
    <div className="nd-funnel-section">
      <div className="nd-funnel-section__bars">
        <FunnelBar label="발송 요청" value={total_send} maxValue={total_send} prevValue={null} color="#7c5cfc" trackScalePct={100} />
        <FunnelBar label="발송 성공" value={total_success} maxValue={total_send} prevValue={total_send} color="#3b82f6" trackScalePct={100} />
        <FunnelBar
          label="오픈"
          value={total_open}
          maxValue={total_success}
          prevValue={total_success}
          color="#f59e0b"
          trackScalePct={successTrackPct}
        />
        <FunnelBar
          label="클릭"
          value={total_click}
          maxValue={total_success}
          prevValue={total_open}
          color="#22c55e"
          trackScalePct={successTrackPct}
        />
      </div>
      <div className="nd-funnel-section__guide">
        <h3 className="nd-funnel-section__guide-title">현재 가이드</h3>
        <p className="nd-funnel-section__guide-desc">
          아래 지표는 조회 기간 내 발송 성과를 기준으로 판단합니다.
        </p>
        <div className="nd-funnel-section__guide-item">
          <span>{successSignal.icon}</span>
          <span>성공률 {(success_rate ?? 0).toFixed(1)}% — {successSignal.label}</span>
        </div>
        <div className="nd-funnel-section__guide-item">
          <span>{openSignal.icon}</span>
          <span>오픈률 {(open_rate ?? 0).toFixed(1)}% — {openSignal.label}</span>
        </div>
        <div className="nd-funnel-section__guide-item">
          <span>{clickSignal.icon}</span>
          <span>클릭률 {(click_rate ?? 0).toFixed(1)}% — {clickSignal.label}</span>
        </div>
        <div className="nd-funnel-section__guide-thresholds">
          <div className="nd-funnel-section__threshold">✅ 성공률 ≥90% / 오픈률 ≥20% / 클릭률 ≥5%</div>
          <div className="nd-funnel-section__threshold">🔶 성공률 ≥80% / 오픈률 ≥10% / 클릭률 ≥2%</div>
          <div className="nd-funnel-section__threshold">🔴 위 기준 미달</div>
        </div>
      </div>
    </div>
  )
}
