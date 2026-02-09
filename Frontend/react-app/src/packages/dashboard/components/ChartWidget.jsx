/**
 * dashboard/components/ChartWidget.jsx (차트 생성 위젯)
 * =====================================================
 * Dimension(축)·Metric(값)·차트 유형 선택으로 막대/선/영역 차트 생성.
 * 차트 데이터는 별도 API(getChartData)로 단일 디멘션·메트릭 집계 조회(Adobe/GA 방식). tableId·filters 있으면 API 사용, 없으면 data prop 폴백.
 * Dimension: 집계 체크박스 기준. Metric: 실수형 지표만. Y축: Chart.js 스타일 Nice Numbers (niceNum·calculateYAxisScale·선형/영역·막대 전용).
 *
 * [주요 기능]
 * - 위젯 추가/삭제, Dimension·Metric·차트 유형 선택. 차트 포맷은 기준별 발송 현황과 동일.
 * - 막대·선형·영역 공통: 범례·Y축 고정 + 오른쪽만 가로 스크롤, X축 minWidth(LABEL_SLOT_WIDTH×건수)·XAxisTickTruncate로 레이블 겹침/잘림 방지. 차트 영역 max-width 1200px. 스크롤 영역 차트에는 domain 적용을 위해 숨김 YAxis 사용.
 * - X축 레이블 검색: 데이터 10건 초과 시 검색 입력 + 찾기/다음으로 해당 구간으로 스크롤 이동.
 *
 * [의존성]
 * - React, recharts, shared/api/client (getChartData)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { getChartData } from '@/shared/api/client'
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const formatNum = (n) => (n != null ? new Intl.NumberFormat('ko-KR').format(n) : '0')

/** rate(성공률·오픈률·클릭률 등): 항상 소수점 둘째 자리까지 표기 (30 → 30.00, 30.1 → 30.10) */
const formatRate = (n) =>
  (n != null && !Number.isNaN(Number(n)))
    ? new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
    : '0.00'

/** Y축 레이블용: 축약 없이 쉼표 구분 숫자 표기. rate일 때는 formatRate 사용 */
function formatYAxisTick(value, isRate = false) {
  if (isRate) return formatRate(value)
  if (value == null || Number.isNaN(value)) return '0'
  const n = Number(value)
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)
}

/** 차트 도메인/툴팁용: 문자열(쉼표 포함 등)을 숫자로 안전 파싱 */
function parseChartNumber(v) {
  if (v == null) return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Y축 Nice Numbers (Chart.js 스타일)
 * - 1, 2, 5의 배수로 가독성 좋은 틱 간격
 * - 데이터 범위에 따른 적응형 패딩
 */

/** 주어진 범위에서 "nice" 숫자 반환 */
function niceNum(range, round) {
  if (range <= 0) return 1
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / Math.pow(10, exponent)
  let niceFraction
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * Math.pow(10, exponent)
}

/**
 * Y축 스케일 계산 (메인)
 * @returns {{ min, max, stepSize, ticks, tickCount }}
 */
function calculateYAxisScale(dataMin, dataMax, options = {}) {
  const {
    minTicks = 5,
    maxTicks = 10,
    paddingRatio = 0.1,
    includeZero = false
  } = options

  if (dataMin === dataMax) {
    const value = dataMin
    const padding = Math.abs(value) * 0.1 || 1
    return {
      min: value - padding,
      max: value + padding,
      stepSize: padding / 2,
      ticks: [value - padding, value, value + padding],
      tickCount: 3
    }
  }

  let rangeMin = dataMin
  let rangeMax = dataMax
  if (includeZero) {
    rangeMin = Math.min(0, dataMin)
    rangeMax = Math.max(0, dataMax)
  }

  let range = rangeMax - rangeMin
  const padding = range * paddingRatio
  let adjustedMin = rangeMin - padding
  let adjustedMax = rangeMax + padding
  let adjustedRange = adjustedMax - adjustedMin

  const roughStep = adjustedRange / (minTicks - 1)
  const stepSize = niceNum(roughStep, false)

  let niceMin = Math.floor(adjustedMin / stepSize) * stepSize
  let niceMax = Math.ceil(adjustedMax / stepSize) * stepSize

  if (includeZero) {
    if (niceMin > 0) niceMin = 0
    if (niceMax < 0) niceMax = 0
  }

  let tickCount = Math.round((niceMax - niceMin) / stepSize) + 1

  if (tickCount > maxTicks && minTicks >= 3) {
    return calculateYAxisScale(dataMin, dataMax, {
      ...options,
      minTicks: Math.max(3, Math.floor(maxTicks * 0.7))
    })
  }

  const ticks = []
  for (let i = 0; i < tickCount; i++) {
    ticks.push(niceMin + stepSize * i)
  }

  return {
    min: niceMin,
    max: niceMax,
    stepSize,
    ticks,
    tickCount
  }
}

/** 선형/영역 차트 전용: 촘촘한 틱, 패딩 5% */
function calculateYAxisScaleForLineArea(dataMin, dataMax, options = {}) {
  return calculateYAxisScale(dataMin, dataMax, {
    minTicks: 6,
    maxTicks: 12,
    paddingRatio: 0.05,
    ...options
  })
}

/**
 * 막대 차트 전용 Y축 계산 (개선 버전)
 * - 모든 값이 양수면 0부터 시작
 * - 모든 값이 음수면 0까지 표시
 * - 혼합된 경우 0을 중심으로 표시
 */
function calculateYAxisScaleForBar(dataMin, dataMax, options = {}) {
  const {
    minTicks = 5,
    maxTicks = 8,
    paddingRatio = 0.1
  } = options

  if (dataMin === dataMax) {
    const value = dataMin
    if (value >= 0) {
      const max = value * 1.2 || 10
      const stepSize = max / 5
      return {
        min: 0,
        max,
        stepSize,
        ticks: Array.from({ length: 6 }, (_, i) => i * stepSize),
        tickCount: 6
      }
    }
    const min = value * 1.2
    const stepSize = Math.abs(min) / 5
    return {
      min,
      max: 0,
      stepSize,
      ticks: Array.from({ length: 6 }, (_, i) => min + i * stepSize),
      tickCount: 6
    }
  }

  if (dataMin >= 0 && dataMax > 0) {
    const adjustedMin = 0
    const padding = dataMax * paddingRatio
    const adjustedMax = dataMax + padding
    const adjustedRange = adjustedMax - adjustedMin
    const roughStep = adjustedRange / (minTicks - 1)
    const stepSize = niceNum(roughStep, false)
    const niceMax = Math.ceil(adjustedMax / stepSize) * stepSize
    let tickCount = Math.round(niceMax / stepSize) + 1

    if (tickCount > maxTicks) {
      const newStepSize = niceNum(niceMax / (maxTicks - 1), true)
      const newNiceMax = Math.ceil(adjustedMax / newStepSize) * newStepSize
      tickCount = Math.round(newNiceMax / newStepSize) + 1
      const ticks = []
      for (let i = 0; i < tickCount; i++) ticks.push(newStepSize * i)
      return { min: 0, max: newNiceMax, stepSize: newStepSize, ticks, tickCount }
    }

    const ticks = []
    for (let i = 0; i < tickCount; i++) ticks.push(stepSize * i)
    return { min: 0, max: niceMax, stepSize, ticks, tickCount }
  }

  if (dataMin < 0 && dataMax <= 0) {
    const adjustedMax = 0
    const padding = Math.abs(dataMin) * paddingRatio
    const adjustedMin = dataMin - padding
    const adjustedRange = adjustedMax - adjustedMin
    const roughStep = adjustedRange / (minTicks - 1)
    const stepSize = niceNum(roughStep, false)
    const niceMin = Math.floor(adjustedMin / stepSize) * stepSize
    let tickCount = Math.round((0 - niceMin) / stepSize) + 1

    if (tickCount > maxTicks) {
      const newStepSize = niceNum(Math.abs(niceMin) / (maxTicks - 1), true)
      const newNiceMin = Math.floor(adjustedMin / newStepSize) * newStepSize
      tickCount = Math.round((0 - newNiceMin) / newStepSize) + 1
      const ticks = []
      for (let i = 0; i < tickCount; i++) ticks.push(newNiceMin + newStepSize * i)
      return { min: newNiceMin, max: 0, stepSize: newStepSize, ticks, tickCount }
    }

    const ticks = []
    for (let i = 0; i < tickCount; i++) ticks.push(niceMin + stepSize * i)
    return { min: niceMin, max: 0, stepSize, ticks, tickCount }
  }

  const padding = (dataMax - dataMin) * paddingRatio
  const adjustedMin = dataMin - padding
  const adjustedMax = dataMax + padding
  const adjustedRange = adjustedMax - adjustedMin
  const roughStep = adjustedRange / (minTicks - 1)
  const stepSize = niceNum(roughStep, false)
  let niceMin = Math.floor(adjustedMin / stepSize) * stepSize
  let niceMax = Math.ceil(adjustedMax / stepSize) * stepSize
  let tickCount = Math.round((niceMax - niceMin) / stepSize) + 1

  if (tickCount > maxTicks) {
    const newStepSize = niceNum((niceMax - niceMin) / (maxTicks - 1), true)
    const newNiceMin = Math.floor(adjustedMin / newStepSize) * newStepSize
    const newNiceMax = Math.ceil(adjustedMax / newStepSize) * newStepSize
    tickCount = Math.round((newNiceMax - newNiceMin) / newStepSize) + 1
    const ticks = []
    for (let i = 0; i < tickCount; i++) ticks.push(newNiceMin + newStepSize * i)
    return { min: newNiceMin, max: newNiceMax, stepSize: newStepSize, ticks, tickCount }
  }

  const ticks = []
  for (let i = 0; i < tickCount; i++) ticks.push(niceMin + stepSize * i)
  return { min: niceMin, max: niceMax, stepSize, ticks, tickCount }
}

function generateTicks(min, max, step) {
  const ticks = []
  let current = min
  while (current <= max + 0.001) {
    ticks.push(Math.round(current * 100) / 100)
    current += step
  }
  return ticks
}

/**
 * Rate(비율) 데이터 + 막대 차트 전용 Y축
 * - 범위가 좁을 때(5% 미만) 데이터 구간으로 확대해 미세한 차이 가독
 * - 0부터 시작하지 않음. 백분율이면 0~100 내로 제한
 */
function calculateYAxisScaleForRate(dataMin, dataMax, options = {}) {
  const { minTicks = 5, maxTicks = 8, isPercentage = true } = options

  if (dataMin === dataMax) {
    const value = dataMin
    const padding = isPercentage ? 5 : Math.abs(value) * 0.1 || 1
    const min = Math.max(isPercentage ? 0 : value - padding, value - padding)
    const max = Math.min(isPercentage ? 100 : value + padding, value + padding)
    const stepSize = (max - min) / 4 || 1
    return { min, max, stepSize, ticks: generateTicks(min, max, stepSize), tickCount: 5 }
  }

  const range = dataMax - dataMin

  if (range < 5) {
    const center = (dataMin + dataMax) / 2
    const expandedRange = Math.max(range * 3, 10)
    let adjustedMin = center - expandedRange / 2
    let adjustedMax = center + expandedRange / 2
    if (isPercentage) {
      adjustedMin = Math.max(0, adjustedMin)
      adjustedMax = Math.min(100, adjustedMax)
    }
    const adjustedRange = adjustedMax - adjustedMin
    const roughStep = adjustedRange / (minTicks - 1)
    const stepSize = niceNum(roughStep, false)
    const niceMin = Math.floor(adjustedMin / stepSize) * stepSize
    const niceMax = Math.ceil(adjustedMax / stepSize) * stepSize
    return {
      min: niceMin,
      max: niceMax,
      stepSize,
      ticks: generateTicks(niceMin, niceMax, stepSize),
      tickCount: Math.round((niceMax - niceMin) / stepSize) + 1
    }
  }

  const padding = range * 0.1
  let adjustedMin = dataMin - padding
  let adjustedMax = dataMax + padding
  if (isPercentage) {
    adjustedMin = Math.max(0, adjustedMin)
    adjustedMax = Math.min(100, adjustedMax)
  }
  const adjustedRange = adjustedMax - adjustedMin
  const roughStep = adjustedRange / (minTicks - 1)
  const stepSize = niceNum(roughStep, false)
  let niceMin = Math.floor(adjustedMin / stepSize) * stepSize
  let niceMax = Math.ceil(adjustedMax / stepSize) * stepSize
  let tickCount = Math.round((niceMax - niceMin) / stepSize) + 1

  if (tickCount > maxTicks) {
    const newStepSize = niceNum((niceMax - niceMin) / (maxTicks - 1), true)
    const newNiceMin = Math.floor(adjustedMin / newStepSize) * newStepSize
    const newNiceMax = Math.ceil(adjustedMax / newStepSize) * newStepSize
    tickCount = Math.round((newNiceMax - newNiceMin) / newStepSize) + 1
    const ticks = []
    for (let i = 0; i < tickCount; i++) ticks.push(newNiceMin + newStepSize * i)
    return { min: newNiceMin, max: newNiceMax, stepSize: newStepSize, ticks, tickCount }
  }

  return {
    min: niceMin,
    max: niceMax,
    stepSize,
    ticks: generateTicks(niceMin, niceMax, stepSize),
    tickCount
  }
}

/** 백분율 차트 전용: 0~100 고정 (필요 시 사용) */
function calculateYAxisScaleForPercentage() {
  return {
    min: 0,
    max: 100,
    stepSize: 10,
    ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    tickCount: 11
  }
}

/** Dimension 후보: 일자·캠페인·워크플로우·채널 (집계 체크박스와 1:1 대응) */
const DIMENSION_FIELDS = [
  { key: 'delivery_date', label: '일자' },
  { key: 'campaign_label', label: '캠페인' },
  { key: 'workflow_label', label: '워크플로우' },
  { key: 'channel_name', label: '채널' }
]

/** groupBy(집계 체크박스)에 따라 사용 가능한 Dimension 목록 반환. 순서: 일자→캠페인→워크플로우→채널. 하나도 없으면 전체. */
function getAvailableDimensions(groupBy) {
  const order = [
    { g: 'date', key: 'delivery_date', label: '일자' },
    { g: 'campaign', key: 'campaign_label', label: '캠페인' },
    { g: 'workflow', key: 'workflow_label', label: '워크플로우' },
    { g: 'channel', key: 'channel_name', label: '채널' }
  ]
  const filtered = order.filter(({ g }) => groupBy && groupBy[g])
  return filtered.length ? filtered : [...DIMENSION_FIELDS]
}

/** Metric 후보: 실수형 데이터만 (건수·비율) */
const METRIC_FIELDS = [
  { key: 'total_count', label: '발송요청' },
  { key: 'success_count', label: '발송성공' },
  { key: 'failed_count', label: '발송실패' },
  { key: 'open_count', label: '오픈' },
  { key: 'click_count', label: '클릭' },
  { key: 'success_rate', label: '성공률(%)' },
  { key: 'open_rate', label: '오픈률(%)' },
  { key: 'click_rate', label: '클릭률(%)' }
]

const CHART_TYPES = [
  { key: 'bar', label: '막대' },
  { key: 'line', label: '선형' },
  { key: 'area', label: '영역' }
]

/** 차트 생성 막대: 일자별 색상 구분용 팔레트 */
const CHART_WIDGET_DATE_COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0d9488', '#059669', '#6366f1']

/** X축 레이블·막대 간격 (기준별 발송 현황과 동일): 슬롯 폭(px), 세그먼트당 최대 글자 수 */
const LABEL_SLOT_WIDTH = 100
const MAX_LABEL_CHARS = 12
/** 막대 차트 가로 스크롤 시 고정할 Y축 영역 너비(px). 큰 수(1e9 등) 레이블이 잘리지 않도록 여유 확보 */
const Y_AXIS_FIXED_WIDTH = 80
/** 차트 캔버스 높이(px). Y축 레이블 잘림 방지로 500 사용 */
const CHART_HEIGHT = 500
/** 차트 배경과 내부 차트 사이 상하좌우 패딩(px) */
const CHART_PADDING = 30

function truncateLabel(str, maxChars = MAX_LABEL_CHARS) {
  const s = String(str ?? '').trim()
  if (s.length <= maxChars) return s || '-'
  return s.slice(0, maxChars) + '...'
}

/** 차트 생성 X축 틱: 레이블 길이 제한으로 겹침 방지 */
function XAxisTickTruncate({ x, y, payload }) {
  const text = truncateLabel(payload?.value)
  return (
    <g transform={`translate(${x}, ${y})`}>
      <text textAnchor="middle" fill="#374151" fontSize={12} x={0} y={0} dy={8}>
        {text}
      </text>
    </g>
  )
}

function getDisplayValue(row, key) {
  const v = row[key]
  if (v != null && v !== '') return String(v)
  if (key === 'campaign_label') return row.campaign_id ?? '-'
  if (key === 'workflow_label') return row.workflow_id ?? '-'
  if (key === 'channel_name') return row.channel_code ?? '-'
  return '-'
}

function SingleWidget({ widget, data, availableDimensions, onRemove, onUpdate, tableId, filters }) {
  const { id, xKey, yKey, chartType, title, chartDateRange } = widget
  const dims = availableDimensions?.length ? availableDimensions : DIMENSION_FIELDS
  const effectiveXKey = dims.some((d) => d.key === xKey) ? xKey : (dims[0]?.key ?? 'delivery_date')
  const dimField = dims.find((f) => f.key === effectiveXKey) || dims[0]
  const metricField = METRIC_FIELDS.find((f) => f.key === yKey) || METRIC_FIELDS[0]
  const isRate = ['success_rate', 'open_rate', 'click_rate'].includes(yKey)
  const isDateDimension = effectiveXKey === 'delivery_date'
  const chartDateRangeResolved = isDateDimension || !chartDateRange?.length
    ? filters?.date_range
    : chartDateRange

  const [chartDataFromApi, setChartDataFromApi] = useState([])
  const [chartDataLoading, setChartDataLoading] = useState(false)
  const [showDimensionInfoModal, setShowDimensionInfoModal] = useState(false)
  const useChartApi = Boolean(tableId && chartDateRangeResolved?.length >= 2)

  useEffect(() => {
    if (!useChartApi) {
      setChartDataFromApi([])
      return
    }
    let cancelled = false
    setChartDataLoading(true)
    getChartData({
      table_id: tableId,
      date_range: chartDateRangeResolved,
      campaign_ids: filters.campaign_ids || [],
      workflow_ids: filters.workflow_ids || [],
      channels: filters.channels || [],
      dimension: effectiveXKey,
      metric: yKey
    })
      .then((res) => {
        if (cancelled) return
        const rows = res.rows || []
        setChartDataFromApi(
          rows.map((r) => ({
            name: r.name ?? '-',
            [metricField.label]: parseChartNumber(r.value),
            delivery_date: r.delivery_date
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setChartDataFromApi([])
      })
      .finally(() => {
        if (!cancelled) setChartDataLoading(false)
      })
    return () => { cancelled = true }
  }, [useChartApi, tableId, chartDateRangeResolved, filters?.campaign_ids, filters?.workflow_ids, filters?.channels, effectiveXKey, yKey, metricField.label])

  const chartDataFromProp = useMemo(() => {
    if (!data?.length) return []
    return data.slice(0, 50).map((row) => ({
      name: getDisplayValue(row, effectiveXKey),
      [metricField.label]: parseChartNumber(row[yKey]),
      delivery_date: row.delivery_date
    }))
  }, [data, effectiveXKey, yKey, metricField.label])

  const chartData = useChartApi ? chartDataFromApi : chartDataFromProp

  const scrollContainerRef = useRef(null)
  const [chartSearchText, setChartSearchText] = useState('')
  const [chartMatchIndex, setChartMatchIndex] = useState(-1)
  /** 마우스로 강조 해제 후에도 Enter 시 '다음'으로 이어가기 위해 마지막으로 찾은 인덱스 유지 */
  const [chartLastFoundIndex, setChartLastFoundIndex] = useState(-1)
  const searchLower = chartSearchText.trim().toLowerCase()
  const matchIndices = useMemo(
    () =>
      searchLower && chartData.length
        ? chartData
            .map((d, i) => (String(d.name ?? '').toLowerCase().includes(searchLower) ? i : -1))
            .filter((i) => i >= 0)
        : [],
    [chartData, searchLower]
  )
  const scrollToIndex = useCallback((index) => {
    const el = scrollContainerRef.current
    if (!el || index < 0) return
    const target = Math.max(0, index * LABEL_SLOT_WIDTH - 80)
    el.scrollLeft = target
  }, [])
  const goToFirstMatch = useCallback(() => {
    if (!searchLower || !matchIndices.length) return
    const idx = matchIndices[0]
    setChartMatchIndex(idx)
    setChartLastFoundIndex(idx)
    scrollToIndex(idx)
  }, [searchLower, matchIndices, scrollToIndex])
  const goToNextMatch = useCallback(() => {
    if (!searchLower || !matchIndices.length) return
    const current = chartMatchIndex >= 0 ? chartMatchIndex : chartLastFoundIndex
    const next = matchIndices.find((i) => i > current)
    const idx = next !== undefined ? next : matchIndices[0]
    setChartMatchIndex(idx)
    setChartLastFoundIndex(idx)
    scrollToIndex(idx)
  }, [searchLower, matchIndices, chartMatchIndex, chartLastFoundIndex, scrollToIndex])

  const dateOrderForBar = useMemo(() => {
    const dates = [...new Set(chartData.map((d) => d.delivery_date).filter(Boolean))].sort()
    return dates
  }, [chartData])

  const getBarFillByDate = (deliveryDate) => {
    const idx = dateOrderForBar.indexOf(deliveryDate)
    return CHART_WIDGET_DATE_COLORS[idx % CHART_WIDGET_DATE_COLORS.length] ?? '#4f46e5'
  }

  /* Y축 도메인: 막대+rate는 구간 확대(가독성), 막대+건수는 0 포함, 선형/영역=패딩 5% */
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 1]
    const values = chartData.map((d) => parseChartNumber(d[metricField.label]))
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    if (chartType === 'bar') {
      const scale = isRate ? calculateYAxisScaleForRate(dataMin, dataMax) : calculateYAxisScaleForBar(dataMin, dataMax)
      return [scale.min, scale.max]
    }
    const scale = calculateYAxisScaleForLineArea(dataMin, dataMax)
    return [scale.min, scale.max]
  }, [chartData, metricField.label, chartType, isRate])

  if (!chartData.length) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          minHeight: CHART_HEIGHT + CHART_PADDING * 2
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <input
            type="text"
            value={title || ''}
            onChange={(e) => onUpdate(id, { title: e.target.value })}
            placeholder="차트 제목"
            style={{ fontSize: 16, fontWeight: 600, color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', minWidth: 140, flex: '1 1 140px', maxWidth: 280 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="chart-widget__save-btn" onClick={() => { /* 저장: DB 정립 후 구현 */ }}>
              저장
            </button>
            <button type="button" className="chart-widget__delete-btn" onClick={() => onRemove(id)}>
              삭제
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          {!isDateDimension && filters?.date_range?.length >= 2 && (
            <>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>기준 기간</span>
              <input
                type="date"
                value={(chartDateRange || filters.date_range)?.[0] ?? ''}
                onChange={(e) => {
                  const from = e.target.value
                  const to = (chartDateRange || filters.date_range)?.[1] ?? from
                  onUpdate(id, { chartDateRange: [from, to] })
                }}
                style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>~</span>
              <input
                type="date"
                value={(chartDateRange || filters.date_range)?.[1] ?? ''}
                onChange={(e) => {
                  const to = e.target.value
                  const from = (chartDateRange || filters.date_range)?.[0] ?? to
                  onUpdate(id, { chartDateRange: [from, to] })
                }}
                style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
            </>
          )}
          <div className="chart-widget__option-row">
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label" aria-hidden="true" />
              <div className="dashboard-header__info-btn-wrap">
                <button
                  type="button"
                  className="dashboard-info-btn"
                  onClick={() => setShowDimensionInfoModal(true)}
                  title="Dimension(X축) 안내"
                >
                  info
                </button>
              </div>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">Dimension</span>
              <select
                value={effectiveXKey}
                onChange={(e) => onUpdate(id, { xKey: e.target.value })}
                className="chart-widget__option-select"
              >
                {dims.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">Metric</span>
              <select
                value={yKey}
                onChange={(e) => onUpdate(id, { yKey: e.target.value })}
                className="chart-widget__option-select"
              >
                {METRIC_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">차트 유형</span>
              <select
                value={chartType}
                onChange={(e) => onUpdate(id, { chartType: e.target.value })}
                className="chart-widget__option-select"
              >
                {CHART_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          {chartDataLoading ? '차트 데이터 조회 중...' : '표시할 데이터가 없습니다.'}
        </div>
        {showDimensionInfoModal && (
          <div
            className="dashboard-modal-overlay"
            onClick={() => setShowDimensionInfoModal(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowDimensionInfoModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chart-dimension-info-title"
          >
            <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="chart-dimension-info-title" className="dashboard-modal__title">
                Dimension(X축) 안내
              </h2>
              <div className="dashboard-modal__body">
                <p className="dashboard-modal__desc">
                  X축에는 집계 기준 중 선택한 1개만 사용하고, 나머지는 합산해 표시합니다. 일자 선택 시 기간 내 일자별로, 캠페인/워크플로우/채널 선택 시 해당 기간 전체 합산이며, 비일자 디멘션일 때는 차트에서 기준 기간을 선택할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                className="dashboard-modal__close"
                onClick={() => setShowDimensionInfoModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* 기준별 발송 현황 차트와 동일 포맷: margin (상단 여유로 Y축·recharts-surface 잘림 방지) */
  const chartTopMargin = 48
  const chartBottomMargin = 28
  const commonProps = {
    data: chartData,
    margin: { top: chartTopMargin, right: 16, left: 8, bottom: chartBottomMargin }
  }

  const xAxisPropsBase = {
    dataKey: 'name',
    interval: 0,
    axisLine: { stroke: '#e5e7eb' },
    tickLine: false
  }
  const xAxisPropsBar = {
    ...xAxisPropsBase,
    tick: <XAxisTickTruncate />
  }
  const formatDisplay = isRate ? formatRate : formatNum
  const yAxisEl = <YAxis domain={yDomain} tick={{ fontSize: 13 }} tickFormatter={(v) => formatYAxisTick(v, isRate)} />
  const tooltipEl = (
    <Tooltip
      formatter={(v) => formatDisplay(v)}
      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
      labelStyle={{ color: '#374151', fontSize: 13 }}
    />
  )
  const gridEl = <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  const legendColor = chartType === 'line' ? '#0d9488' : chartType === 'area' ? '#7c3aed' : '#4f46e5'
  const legendRow = (
    <div className="chart-widget__legend-top">
      <span className="chart-widget__legend-top__mark" style={{ background: legendColor }} />
      <span>{metricField.label}</span>
    </div>
  )

  /* 막대·선형·영역 공통: 가로 스크롤 시 Y축 고정. 범례는 차트 블록 전체 상단 한 줄. 스크롤 차트는 domain 적용을 위해 숨김 YAxis 사용 */
  const marginLeftOnly = { top: chartTopMargin, right: 0, left: 8, bottom: chartBottomMargin }
  const marginRightOnly = { top: chartTopMargin, right: 24, left: 32, bottom: chartBottomMargin }
  const scrollContentMinWidth = Math.max(280, chartData.length * LABEL_SLOT_WIDTH)
  const hiddenYAxis = <YAxis domain={yDomain} hide width={0} allowDataOverflow />
  const fixedYAxisBlock = (
    <div className="chart-widget__y-axis-fixed" style={{ width: Y_AXIS_FIXED_WIDTH }}>
      <ResponsiveContainer width={Y_AXIS_FIXED_WIDTH} height={CHART_HEIGHT}>
        <BarChart data={chartData} margin={marginLeftOnly}>
          <YAxis domain={yDomain} tick={{ fontSize: 13 }} tickFormatter={(v) => formatYAxisTick(v, isRate)} width={Y_AXIS_FIXED_WIDTH - 16} allowDataOverflow />
          <Bar dataKey={metricField.label} barSize={0} fill="transparent" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  let chartInner
  if (chartType === 'line') {
    chartInner = (
      <div className="chart-widget__chart-block">
        {legendRow}
        <div className="chart-widget__chart-wrap chart-widget__chart-wrap--y-fixed">
          {fixedYAxisBlock}
          <div className="chart-widget__chart-scroll" ref={scrollContainerRef} onMouseMove={() => chartMatchIndex >= 0 && setChartMatchIndex(-1)}>
            <div style={{ minWidth: scrollContentMinWidth }}>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart {...commonProps} margin={marginRightOnly}>
                  {hiddenYAxis}
                  {gridEl}
                  <XAxis {...xAxisPropsBar} />
                  {tooltipEl}
                  <Line type="monotone" dataKey={metricField.label} stroke="#0d9488" strokeWidth={2.5} dot={(props) => <circle cx={props.cx} cy={props.cy} r={props.index === chartMatchIndex ? 8 : 4} fill="#0d9488" />} activeDot={{ r: 6, fill: '#0f766e' }} name={metricField.label} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  } else if (chartType === 'area') {
    chartInner = (
      <div className="chart-widget__chart-block">
        {legendRow}
        <div className="chart-widget__chart-wrap chart-widget__chart-wrap--y-fixed">
          {fixedYAxisBlock}
          <div className="chart-widget__chart-scroll" ref={scrollContainerRef} onMouseMove={() => chartMatchIndex >= 0 && setChartMatchIndex(-1)}>
            <div style={{ minWidth: scrollContentMinWidth }}>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <AreaChart {...commonProps} margin={marginRightOnly}>
                  {hiddenYAxis}
                  {gridEl}
                  <XAxis {...xAxisPropsBar} />
                  {tooltipEl}
                  <Area type="monotone" dataKey={metricField.label} stroke="#7c3aed" strokeWidth={2} fill="#7c3aed" fillOpacity={0.35} dot={(props) => <circle cx={props.cx} cy={props.cy} r={props.index === chartMatchIndex ? 8 : 4} fill="#7c3aed" />} name={metricField.label} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  } else {
    /* 막대 차트: bar만 barCategoryGap·maxBarSize·Cell 적용. Rate일 때 Y축 확대 시 안내 */
    const barMaxSize = Math.min(75, Math.floor(LABEL_SLOT_WIDTH * 0.55))
    const showZoomHint = isRate && yDomain[0] > 0
    chartInner = (
      <div className="chart-widget__chart-block">
        {legendRow}
        {showZoomHint && (
          <p className="chart-widget__y-zoom-hint" style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px 0' }}>
            Y축이 데이터 구간으로 확대되었습니다.
          </p>
        )}
        <div className="chart-widget__chart-wrap chart-widget__chart-wrap--y-fixed">
          {fixedYAxisBlock}
          <div className="chart-widget__chart-scroll" ref={scrollContainerRef} onMouseMove={() => chartMatchIndex >= 0 && setChartMatchIndex(-1)}>
            <div style={{ minWidth: scrollContentMinWidth }}>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart {...commonProps} margin={marginRightOnly} barCategoryGap="8%">
                  {hiddenYAxis}
                  {gridEl}
                  <XAxis {...xAxisPropsBar} />
                  {tooltipEl}
                  <Bar dataKey={metricField.label} radius={[4, 4, 0, 0]} name={metricField.label} maxBarSize={barMaxSize}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={i === chartMatchIndex ? '#6366f1' : getBarFillByDate(entry.delivery_date)} stroke={i === chartMatchIndex ? '#4f46e5' : undefined} strokeWidth={i === chartMatchIndex ? 2 : 0} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        minHeight: CHART_HEIGHT + CHART_PADDING * 2
      }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text"
          value={title || ''}
          onChange={(e) => onUpdate(id, { title: e.target.value })}
          placeholder="차트 제목"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '6px 12px',
            minWidth: 140,
            flex: '1 1 140px',
            maxWidth: 280
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="chart-widget__save-btn" onClick={() => { /* 저장: DB 정립 후 구현 */ }}>
            저장
          </button>
          <button type="button" className="chart-widget__delete-btn" onClick={() => onRemove(id)}>
            삭제
          </button>
        </div>
      </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          {!isDateDimension && filters?.date_range?.length >= 2 && (
            <>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>기준 기간</span>
              <input
                type="date"
                value={(chartDateRange || filters.date_range)?.[0] ?? ''}
                onChange={(e) => {
                  const from = e.target.value
                  const to = (chartDateRange || filters.date_range)?.[1] ?? from
                  onUpdate(id, { chartDateRange: [from, to] })
                }}
                style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>~</span>
              <input
                type="date"
                value={(chartDateRange || filters.date_range)?.[1] ?? ''}
                onChange={(e) => {
                  const to = e.target.value
                  const from = (chartDateRange || filters.date_range)?.[0] ?? to
                  onUpdate(id, { chartDateRange: [from, to] })
                }}
                style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
            </>
          )}
          <div className="chart-widget__option-row">
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label" aria-hidden="true" />
              <div className="dashboard-header__info-btn-wrap">
                <button
                  type="button"
                  className="dashboard-info-btn"
                  onClick={() => setShowDimensionInfoModal(true)}
                  title="Dimension(X축) 안내"
                >
                  info
                </button>
              </div>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">Dimension</span>
              <select
                value={effectiveXKey}
                onChange={(e) => onUpdate(id, { xKey: e.target.value })}
                className="chart-widget__option-select"
              >
                {dims.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">Metric</span>
              <select
                value={yKey}
                onChange={(e) => onUpdate(id, { yKey: e.target.value })}
                className="chart-widget__option-select"
              >
                {METRIC_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="chart-widget__option-col">
              <span className="chart-widget__option-label">차트 유형</span>
              <select
                value={chartType}
                onChange={(e) => onUpdate(id, { chartType: e.target.value })}
                className="chart-widget__option-select"
              >
                {CHART_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {chartData.length > 10 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={chartSearchText}
              onChange={(e) => { setChartSearchText(e.target.value); setChartMatchIndex(-1); setChartLastFoundIndex(-1) }}
              onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (chartMatchIndex >= 0 || chartLastFoundIndex >= 0) goToNextMatch()
              else goToFirstMatch()
            }}
              placeholder="X축 레이블 검색 (이동: 찾기 / 다음)"
              style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 180 }}
            />
            <button
              type="button"
              onClick={goToFirstMatch}
              disabled={!searchLower || matchIndices.length === 0}
              style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: matchIndices.length ? 'pointer' : 'not-allowed' }}
            >
              찾기
            </button>
            <button
              type="button"
              onClick={goToNextMatch}
              disabled={!searchLower || matchIndices.length === 0}
              style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: matchIndices.length ? 'pointer' : 'not-allowed' }}
            >
              다음
            </button>
            {searchLower && matchIndices.length > 0 && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>{matchIndices.length}건</span>
            )}
          </div>
        )}
        <div className="chart-widget__chart-wrap chart-widget__chart-wrap--y-fixed" style={{ padding: CHART_PADDING }}>
          {chartInner}
        </div>

        {showDimensionInfoModal && (
          <div
            className="dashboard-modal-overlay"
            onClick={() => setShowDimensionInfoModal(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowDimensionInfoModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chart-dimension-info-title"
          >
            <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="chart-dimension-info-title" className="dashboard-modal__title">
                Dimension(X축) 안내
              </h2>
              <div className="dashboard-modal__body">
                <p className="dashboard-modal__desc">
                  X축에는 집계 기준 중 선택한 1개만 사용하고, 나머지는 합산해 표시합니다. 일자 선택 시 기간 내 일자별로, 캠페인/워크플로우/채널 선택 시 해당 기간 전체 합산이며, 비일자 디멘션일 때는 차트에서 기준 기간을 선택할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                className="dashboard-modal__close"
                onClick={() => setShowDimensionInfoModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}
    </div>
  )
}

export default function ChartWidget({ data = [], groupBy = {}, widgets = [], onWidgetsChange, tableId, filters }) {
  const availableDimensions = useMemo(() => getAvailableDimensions(groupBy), [groupBy])

  // 집계 체크박스 변경 시, 현재 선택된 Dimension이 목록에 없으면 첫 번째로 맞춤
  useEffect(() => {
    const keys = availableDimensions.map((d) => d.key)
    const firstKey = availableDimensions[0]?.key ?? 'delivery_date'
    const needsUpdate = widgets.some((w) => !keys.includes(w.xKey))
    if (!needsUpdate || widgets.length === 0) return
    onWidgetsChange(
      widgets.map((w) => ({ ...w, xKey: keys.includes(w.xKey) ? w.xKey : firstKey }))
    )
  }, [groupBy, availableDimensions, widgets, onWidgetsChange])

  const addWidget = () => {
    const id = `w-${Date.now()}`
    const defaultXKey = availableDimensions[0]?.key ?? 'delivery_date'
    onWidgetsChange([
      ...widgets,
      { id, xKey: defaultXKey, yKey: 'total_count', chartType: 'bar', title: `차트 생성 ${widgets.length + 1}` }
    ])
  }

  const removeWidget = (id) => {
    onWidgetsChange(widgets.filter((w) => w.id !== id))
  }

  const updateWidget = (id, updates) => {
    onWidgetsChange(
      widgets.map((w) => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  return (
    <section className="chart-widget-section chart-widget">
      <div className="chart-widget__header">
        <button type="button" className="chart-widget__add-btn" onClick={addWidget}>
          + 차트 생성
        </button>
      </div>
      <div className="chart-widget__grid">
        {widgets.map((w) => (
          <SingleWidget
            key={w.id}
            widget={w}
            data={data}
            availableDimensions={availableDimensions}
            onRemove={removeWidget}
            onUpdate={updateWidget}
            tableId={tableId}
            filters={filters}
          />
        ))}
      </div>
    </section>
  )
}
