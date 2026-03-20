/**
 * ChannelConsentBars (채널별 동의 현황 — 가로 막대)
 * ================================================
 * ibank_1_0 기반 opt_in 카운트를 total_recipients 대비 비율(%)로 표시.
 * props: optIn — { email, sms, push }, totalRecipients — 전체 회원수(분모).
 *
 * [Main Functions]
 * ===========
 * 1. pctOfTotal — 동의 건수 / total_recipients * 100
 * 2. ChannelConsentBars (default export)
 *
 * [Dependencies]
 * =========
 * - (UI 전용)
 */
const ROWS = [
  { key: 'email', label: '이메일', color: '#7c5cfc' },
  { key: 'sms', label: 'SMS', color: '#f59e0b' },
  { key: 'push', label: '푸시', color: '#22c55e' },
]

// 1.
function pctOfTotal(count, total) {
  const c = Number(count) || 0
  const t = Number(total) || 0
  if (t <= 0) return 0
  return Math.round((c / t) * 1000) / 10
}

// 2.
export default function ChannelConsentBars({ optIn = {}, totalRecipients = 0 }) {
  const total = totalRecipients

  return (
    <div className="nd-channel-consent">
      {ROWS.map(({ key, label, color }) => {
        const raw = optIn[key] ?? 0
        const pct = pctOfTotal(raw, total)
        const w = Math.min(100, Math.max(0, pct))
        return (
          <div key={key} className="nd-consent-row">
            <span className="nd-consent-row__label">{label}</span>
            <div className="nd-consent-row__track" aria-hidden>
              <div
                className="nd-consent-row__fill"
                style={{ width: `${w}%`, backgroundColor: color }}
              />
            </div>
            <span className="nd-consent-row__meta">
              <span className="nd-consent-row__pct">{pct.toFixed(0)}%</span>
              <span className="nd-consent-row__suffix"> 동의</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
