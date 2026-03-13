/**
 * TrendLineChart (trend-multi 기반 추이 그래프)
 * =============================================
 * 메트릭 탭(6개) + 채널별 라인 또는 전체 합산 단일 라인.
 *
 * [Main Functions]
 * 1. getFullDateRange
 * 2. getFullWeekRange
 * 3. getFullMonthRange
 * 4. formatDateLabel
 * 5. calcRate
 * 6. getChannelMetricValue
 * 7. pivotByChannel
 * 8. buildTotalChartData
 * 9. TrendTooltipContent
 * 10. TrendLineChart (default export)
 */
import { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { getMonthWeekLabel, toLocalDateString } from './dateUtils'

const CHANNEL_COLORS = {
  Email: '#7c5cfc', SMS: '#f59e0b', iOS: '#3b82f6',
  Android: '#22c55e', Kakao: '#fbbf24', Unknown: '#9ca3af',
}

const METRIC_TABS = [
  { key: 'total_count', label: '발송수', dataKey: '발송수', stroke: '#7c5cfc' },
  { key: 'success_count', label: '성공수', dataKey: '성공수', stroke: '#3b82f6' },
  { key: 'open_count', label: '오픈수', dataKey: '오픈수', stroke: '#f59e0b' },
  { key: 'click_count', label: '클릭수', dataKey: '클릭수', stroke: '#22c55e' },
  { key: 'open_rate', label: '오픈률', dataKey: '오픈률', stroke: '#9ca3af' },
  { key: 'click_rate', label: '클릭률', dataKey: '클릭률', stroke: '#6b7280' },
]
const RATE_KEYS = new Set(['open_rate', 'click_rate'])

// 1.
/** endDate 포함 이전 days일의 날짜 배열 (YYYY-MM-DD, 로컬 기준) */
function getFullDateRange(endDateStr, days) {
  if (!endDateStr || days < 1) return []
  const end = new Date(endDateStr + 'T00:00:00')
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    out.push(toLocalDateString(d))
  }
  return out
}

// 2.
/** endDate가 속한 주(월요일 시작) 포함 이전 count주, 각 주 월요일 YYYY-MM-DD (로컬 기준) */
function getFullWeekRange(endDateStr, count) {
  if (!endDateStr || count < 1) return []
  const end = new Date(endDateStr + 'T00:00:00')
  const mondayOffset = end.getDay() === 0 ? 6 : end.getDay() - 1
  const lastMonday = new Date(end)
  lastMonday.setDate(end.getDate() - mondayOffset)
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(lastMonday)
    d.setDate(lastMonday.getDate() - i * 7)
    out.push(toLocalDateString(d))
  }
  return out
}

// 3.
/** endDate가 속한 월 포함 이전 count개월 (각월 1일 YYYY-MM-DD) */
function getFullMonthRange(endDateStr, count) {
  if (!endDateStr || count < 1) return []
  const [y, m] = endDateStr.slice(0, 7).split('-').map(Number)
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    let mm = m - i
    let yy = y
    while (mm < 1) {
      mm += 12
      yy -= 1
    }
    out.push(`${yy}-${String(mm).padStart(2, '0')}-01`)
  }
  return out
}

// 4.
function formatDateLabel(ymd, period) {
  if (!ymd) return ymd
  if (period === 'monthly') return `${ymd.slice(0, 4)}/${ymd.slice(5, 7)}`
  if (period === 'weekly') return getMonthWeekLabel(ymd) || ymd
  return ymd.length >= 10 ? `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}` : ymd
}

// 5.
/** 비율 계산 공통 (성공수 기준 %, 소수 둘째자리) */
function calcRate(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0
}

// 6.
/** 채널 행에서 메트릭 값 (rate는 calcRate 사용) */
function getChannelMetricValue(r, metric) {
  if (metric === 'open_rate') return calcRate(r.open_count ?? 0, r.success_count ?? 0)
  if (metric === 'click_rate') return calcRate(r.click_count ?? 0, r.success_count ?? 0)
  return r[metric] ?? 0
}

// 7.
/** channelRows를 피벗. fullDates가 있으면 해당 구간 전부 채우고, 없는 날은 0. period로 날짜 라벨. */
function pivotByChannel(rows, metric, fullDates, period) {
  const dateMap = {}
  const channels = new Set()
  const isRate = RATE_KEYS.has(metric)
  for (const r of rows) {
    const d = r.date
    const ch = r.channel || 'Unknown'
    channels.add(ch)
    if (!dateMap[d]) dateMap[d] = {}
    const val = getChannelMetricValue(r, metric)
    dateMap[d][ch] = isRate ? val : (dateMap[d][ch] || 0) + val
  }
  const channelList = [...channels].sort()
  const dates = fullDates?.length ? fullDates : Object.keys(dateMap).sort()
  const chartData = dates.map((d) => {
    const base = dateMap[d] || {}
    const row = { date: d, dateLabel: formatDateLabel(d, period) }
    for (const ch of channelList) row[ch] = base[ch] ?? 0
    return row
  })
  return { chartData, channels: channelList }
}

// 8.
/** 전체 합산 rows. fullDates가 있으면 해당 구간 전부 채우고, 없는 날은 0. byDate 구성 시 한 번만 계산. */
function buildTotalChartData(rows, fullDates, period) {
  const byDate = {}
  for (const r of rows || []) {
    const s = r.success_count ?? 0
    byDate[r.date] = {
      발송수: r.total_count ?? 0,
      성공수: s,
      오픈수: r.open_count ?? 0,
      클릭수: r.click_count ?? 0,
      오픈률: calcRate(r.open_count ?? 0, s),
      클릭률: calcRate(r.click_count ?? 0, s),
    }
  }
  const dates = fullDates?.length ? fullDates : Object.keys(byDate).sort()
  return dates.map((d) => {
    const row = byDate[d]
    return {
      date: d,
      dateLabel: formatDateLabel(d, period),
      발송수: row?.발송수 ?? 0,
      성공수: row?.성공수 ?? 0,
      오픈수: row?.오픈수 ?? 0,
      클릭수: row?.클릭수 ?? 0,
      오픈률: row?.오픈률 ?? 0,
      클릭률: row?.클릭률 ?? 0,
    }
  })
}

// 9.
/** 호버 시 해당 데이터 행을 상위로 전달 (범례에 호버된 날짜 값 표시) */
function TrendTooltipContent({ active, payload, setActiveRow, isRate }) {
  useEffect(() => {
    setActiveRow(active && payload?.length ? payload[0].payload : null)
  }, [active, payload, setActiveRow])
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="nd-trend-chart__tooltip" style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>날짜: {row.dateLabel}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {typeof entry.value === 'number'
              ? (isRate ? `${entry.value.toFixed(2)}%` : entry.value.toLocaleString())
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// 10.
export default function TrendLineChart({ data, byChannel, period = 'daily', endDate, days = 10, count = 10 }) {
  const [selectedMetric, setSelectedMetric] = useState('total_count')
  const [activeRow, setActiveRow] = useState(null)

  const isChannelMode = byChannel && data?.some((r) => r.channel)
  const isRate = RATE_KEYS.has(selectedMetric)
  const metricConfig = METRIC_TABS.find((t) => t.key === selectedMetric)

  const fullDates = useMemo(() => {
    if (!endDate) return null
    if (period === 'weekly') return count ? getFullWeekRange(endDate, count) : null
    if (period === 'monthly') return count ? getFullMonthRange(endDate, count) : null
    return days ? getFullDateRange(endDate, days) : null
  }, [endDate, days, count, period])

  const { chartData, channels } = useMemo(() => {
    if (!data?.length && !fullDates?.length) return { chartData: [], channels: [] }
    if (isChannelMode) {
      return pivotByChannel(data || [], selectedMetric, fullDates, period)
    }
    return { chartData: buildTotalChartData(data || [], fullDates, period), channels: [] }
  }, [data, selectedMetric, isChannelMode, fullDates, period])

  if (!chartData.length) return <div className="nd-empty">추이 데이터가 없습니다.</div>

  const displayRow = activeRow ?? chartData[chartData.length - 1]

  const renderLegend = ({ payload }) => (
    <div className="nd-trend-chart__legend-wrap">
      <div className="nd-trend-chart__custom-legend">
        {payload.map((entry, i) => (
          <div key={i} className="nd-trend-chart__legend-item">
            <span className="nd-trend-chart__legend-dot" style={{ background: entry.color }} />
            <span className="nd-trend-chart__legend-name">{entry.value}</span>
            <span className="nd-trend-chart__legend-val">
              {displayRow
                ? (typeof displayRow[entry.value] === 'number'
                  ? (isRate ? `${displayRow[entry.value].toFixed(2)}%` : Number(displayRow[entry.value]).toLocaleString())
                  : (displayRow[entry.value] ?? '-'))
                : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="nd-trend-chart">
      <div className="nd-trend-chart__tabs">
        {METRIC_TABS.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            className={`nd-trend-chart__tab ${selectedMetric === key ? 'nd-trend-chart__tab--active' : ''}`}
            onClick={() => setSelectedMetric(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => (isRate ? `${v}%` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
          />
          <Tooltip content={(p) => <TrendTooltipContent {...p} setActiveRow={setActiveRow} isRate={isRate} />} />
          <Legend content={renderLegend} verticalAlign="top" align="center" />

          {isChannelMode
            ? channels.map((ch) => (
                <Line key={ch} type="monotone" dataKey={ch}
                  stroke={CHANNEL_COLORS[ch] || '#9ca3af'} strokeWidth={2}
                  dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
              ))
            : <Line type="monotone" dataKey={metricConfig.dataKey}
                stroke={metricConfig.stroke} strokeWidth={2}
                dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
          }
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
