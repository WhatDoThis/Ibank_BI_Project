/**
 * KPISummaryCards — 2행 3열 KPI 카드
 * 상단: 캠페인 건수, 총 발송요청(채널 % 도넛), 총 발송성공(채널 % 도넛)
 * 하단: 워크플로우 건수, 총 오픈수(채널 % 도넛), 총 클릭수(채널 % 도넛)
 */
import { PieChart, Pie, Cell, Tooltip } from 'recharts'

const CHANNEL_COLORS = {
  Email: '#7c5cfc',
  SMS: '#f59e0b',
  iOS: '#3b82f6',
  Android: '#22c55e',
  Kakao: '#fbbf24',
  Unknown: '#9ca3af',
}

function formatNum(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString()
}

function MiniStat({ label, description, value, change, color }) {
  return (
    <div className="nd-kpi-card" style={{ borderTop: `3px solid ${color || '#7c5cfc'}` }}>
      <div className="nd-kpi-card__header">
        <span className="nd-kpi-card__label">{label}</span>
        {change != null && (
          <span className={`nd-kpi-card__change ${change >= 0 ? 'nd-kpi-card__change--up' : 'nd-kpi-card__change--down'}`}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="nd-kpi-card__value">{formatNum(value)}</div>
      {description && <div className="nd-kpi-card__desc">{description}</div>}
    </div>
  )
}

function MiniDonutCard({ label, description, value, change, items, color }) {
  const hasItems = items?.length > 0
  const data = hasItems ? items.map((i) => ({ name: i.channel, value: i.value || 0 })) : []

  return (
    <div className="nd-kpi-card nd-kpi-card--with-donut" style={{ borderTop: `3px solid ${color || '#7c5cfc'}` }}>
      <div className="nd-kpi-card__header">
        <span className="nd-kpi-card__label">{label}</span>
        {change != null && (
          <span className={`nd-kpi-card__change ${change >= 0 ? 'nd-kpi-card__change--up' : 'nd-kpi-card__change--down'}`}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="nd-kpi-card__donut-row">
        <div className="nd-kpi-card__donut-left">
          <div className="nd-kpi-card__value">{formatNum(value)}</div>
          {description && <div className="nd-kpi-card__desc">{description}</div>}
          {hasItems && (
            <div className="nd-kpi-card__donut-legend">
              {items.map((item, i) => (
                <div key={i} className="nd-kpi-card__donut-legend-item">
                  <span
                    className="nd-kpi-card__donut-legend-dot"
                    style={{ background: CHANNEL_COLORS[item.channel] || '#9ca3af' }}
                  />
                  <span className="nd-kpi-card__donut-legend-label">{item.channel}</span>
                  <span className="nd-kpi-card__donut-legend-pct">{item.percentage ?? 0}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {hasItems && (
          <div className="nd-kpi-card__donut-right">
            <PieChart width={80} height={80}>
              <Pie
                data={data}
                cx={40}
                cy={40}
                innerRadius={22}
                outerRadius={35}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={CHANNEL_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString()} />
            </PieChart>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KPISummaryCards({ kpi, changePcts }) {
  if (!kpi) return null
  const dist = kpi.channel_distribution ?? {}
  return (
    <div className="nd-kpi-grid">
      <MiniStat
        label="캠페인 건수"
        description="조회 기간 내 발송된 캠페인 수"
        value={kpi.campaign_count}
        color="#7c5cfc"
      />
      <MiniDonutCard
        label="총 발송요청"
        description="채널별 발송 비율"
        value={kpi.total_send}
        change={changePcts?.send_change_pct}
        items={dist.send ?? []}
        color="#6366f1"
      />
      <MiniDonutCard
        label="총 발송성공"
        description="채널별 성공 비율"
        value={kpi.total_success}
        change={changePcts?.success_change_pct}
        items={dist.success ?? []}
        color="#22c55e"
      />
      <MiniStat
        label="워크플로우 건수"
        description="조회 기간 내 발송된 워크플로우 수"
        value={kpi.workflow_count}
        color="#3b82f6"
      />
      <MiniDonutCard
        label="총 오픈수"
        description="채널별 오픈 비율"
        value={kpi.total_open}
        change={changePcts?.open_change_pct}
        items={dist.open ?? []}
        color="#f59e0b"
      />
      <MiniDonutCard
        label="총 클릭수"
        description="채널별 클릭 비율"
        value={kpi.total_click}
        change={changePcts?.click_change_pct}
        items={dist.click ?? []}
        color="#06b6d4"
      />
    </div>
  )
}
