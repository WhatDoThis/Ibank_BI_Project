/**
 * dashboard2/components/EChartsChart.jsx (ECharts 템플릿 차트)
 * =============================================================
 * aggregated_data를 ECharts API로 시각화. 템플릿별 bar/line 옵션 구성.
 *
 * [주요 기능]
 * - 템플릿 ID에 따라 xAxis/series 옵션 생성 (일자 또는 복합 라벨, 메트릭 시리즈)
 * - 막대: Y축 항상 0부터(막대 길이 직관 유지). 선형: 좁은 구간 시 Y축 데이터 구간 확대. 막대 복수 메트릭 시 스택, 카테고리 많을 때 dataZoom
 * - echarts.init / setOption / resize / dispose 로 라이프사이클 관리
 *
 * [의존성]
 * - React (useRef, useEffect), echarts
 */

import { useRef, useEffect, useMemo } from 'react'
import * as echarts from 'echarts'

/**
 * groupBy에 따라 행의 X축 라벨 생성.
 * 복수 항목(일자 + 캠페인/워크플로우/채널)일 때는 "일자\n캠페인 / 워크플로우 / 채널" 로 줄바꿈해 오버플로우 시에도 일자·설명이 함께 보이도록 함.
 */
function getCompositeXLabel(row, groupBy) {
  const parts = []
  if (groupBy.date) {
    const v = row.delivery_date
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.campaign) {
    const v = row.campaign_label ?? row.campaign_id
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.workflow) {
    const v = row.workflow_label ?? row.workflow_id
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (groupBy.channel) {
    const v = row.channel_name ?? row.channel_code
    parts.push(v != null && v !== '' ? String(v) : '-')
  }
  if (parts.length === 0) return '-'
  if (parts.length === 1) return parts[0]
  return parts[0] + '\n' + parts.slice(1).join(' / ')
}

/** 템플릿 정의: id, label, chartType, metricKeys(표시할 수치 컬럼) */
export const CHART_TEMPLATES = [
  { id: 'bar_success', label: '일자별 발송 성공 (막대)', chartType: 'bar', metricKeys: ['success_count'] },
  { id: 'bar_total', label: '일자별 발송 요청 (막대)', chartType: 'bar', metricKeys: ['total_count'] },
  { id: 'bar_both', label: '일자별 발송 요청·성공 (막대)', chartType: 'bar', metricKeys: ['total_count', 'success_count'] },
  { id: 'line_open', label: '일자별 오픈 (선)', chartType: 'line', metricKeys: ['open_count'] },
  { id: 'line_click', label: '일자별 클릭 (선)', chartType: 'line', metricKeys: ['click_count'] },
  { id: 'line_engagement', label: '일자별 오픈·클릭 (선)', chartType: 'line', metricKeys: ['open_count', 'click_count'] },
  { id: 'bar_all', label: '일자별 발송·성공·오픈·클릭 (막대)', chartType: 'bar', metricKeys: ['total_count', 'success_count', 'open_count', 'click_count'] }
]

const METRIC_LABELS = {
  total_count: '발송 요청',
  success_count: '발송 성공',
  open_count: '오픈',
  click_count: '클릭'
}

/** 범위를 "nice"한 눈금으로 확장 (1, 2, 5, 10 계열) */
function niceAxisRange(dataMin, dataMax, paddingRatio = 0.1) {
  const range = dataMax - dataMin
  if (range <= 0) return { min: dataMin, max: Math.max(dataMax, dataMin + 1) }
  const padding = range * paddingRatio
  let low = dataMin - padding
  let high = dataMax + padding
  const span = high - low
  const exponent = Math.pow(10, Math.floor(Math.log10(span)))
  const normalized = span / exponent
  let step = exponent
  if (normalized <= 1) step = exponent * 0.2
  else if (normalized <= 2) step = exponent * 0.5
  else if (normalized <= 5) step = exponent
  else step = exponent * 2
  const min = Math.floor(low / step) * step
  const max = Math.ceil(high / step) * step
  return { min, max }
}

/**
 * Y축을 데이터 구간으로 확대할지 여부 및 min/max 계산.
 * 선형 차트만 적용. 막대 차트는 Y축이 0부터 시작해야 막대 길이로 크기가 직관적으로 보이므로 확대하지 않음.
 */
const NARROW_RATIO = 0.2
const MIN_ABSOLUTE_RANGE = 1

function computeYAxisBounds(rows, template) {
  if (!rows?.length || !template?.metricKeys?.length) return null
  if (template.chartType === 'bar') return null
  const keys = template.metricKeys
  const isBar = template.chartType === 'bar'
  const isStackedBar = isBar && keys.length > 1

  let dataMin = Infinity
  let dataMax = -Infinity

  if (isStackedBar) {
    rows.forEach((r) => {
      let sum = 0
      keys.forEach((k) => { sum += Number(r[k]) || 0 })
      if (sum < dataMin) dataMin = sum
      if (sum > dataMax) dataMax = sum
    })
  } else {
    rows.forEach((r) => {
      keys.forEach((k) => {
        const v = Number(r[k]) || 0
        if (v < dataMin) dataMin = v
        if (v > dataMax) dataMax = v
      })
    })
  }

  if (dataMin === Infinity || dataMax === -Infinity || dataMax < dataMin) return null
  const range = dataMax - dataMin
  if (range < MIN_ABSOLUTE_RANGE) return null
  if (dataMax <= 0) return null
  const rangeRatio = range / dataMax
  if (rangeRatio >= NARROW_RATIO) return null

  const { min, max } = niceAxisRange(dataMin, dataMax)
  return { min, max }
}

/** ECharts option 생성 */
function buildOption(rows, groupBy, template) {
  if (!rows?.length || !template) {
    return { title: { text: '데이터 없음', left: 'center', top: 'middle' } }
  }
  const categories = rows.map((r) => getCompositeXLabel(r, groupBy))
  const isBar = template.chartType === 'bar'
  const useStack = isBar && (template.metricKeys || []).length > 1

  const series = (template.metricKeys || []).map((key) => {
    const s = {
      name: METRIC_LABELS[key] || key,
      type: isBar ? 'bar' : 'line',
      data: rows.map((r) => r[key] ?? 0),
      smooth: template.chartType === 'line'
    }
    if (useStack) s.stack = 'total'
    if (isBar && categories.length <= 15) {
      s.label = { show: true, position: 'top', fontSize: 10, formatter: (params) => (params.value != null ? Number(params.value).toLocaleString('ko-KR') : '') }
    }
    return s
  })

  const yAxisBounds = computeYAxisBounds(rows, template)
  const yAxis = {
    type: 'value',
    ...(yAxisBounds ? { min: yAxisBounds.min, max: yAxisBounds.max } : {})
  }

  const showDataZoom = categories.length > 20
  const dataZoomEnd = showDataZoom ? Math.min(100, Math.round((20 / categories.length) * 100)) : 100

  const hasZoomHint = Boolean(yAxisBounds)
  const manyCategories = categories.length > 8
  const rotateLabels = manyCategories
  const MAX_LABEL_CHARS = 18

  const legendTop = 8
  const zoomHintTop = hasZoomHint ? 36 : 0
  const gridTop = hasZoomHint ? 72 : 52
  const baseBottom = manyCategories ? 100 : 60
  const gridBottom = showDataZoom ? baseBottom + 44 : baseBottom
  const gridLeft = rotateLabels ? 104 : 76
  const gridRight = 52

  const truncateLabel = (value) => {
    const s = String(value ?? '').trim()
    if (s.length <= MAX_LABEL_CHARS) return s
    return s.slice(0, MAX_LABEL_CHARS) + '…'
  }

  const formatAxisLabel = (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    const lines = raw.split('\n')
    if (lines.length <= 1) return truncateLabel(raw)
    const first = lines[0].trim()
    const rest = lines.slice(1).join(' ').trim()
    const second = truncateLabel(rest)
    return second ? `${first}\n${second}` : first
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params) => {
        if (!params?.length) return ''
        const lines = [params[0].axisValue]
        params.forEach((p) => lines.push(`${p.marker} ${p.seriesName}: ${p.value != null ? Number(p.value).toLocaleString('ko-KR') : '-'}`))
        return lines.join('<br/>')
      }
    },
    legend: {
      top: legendTop,
      left: 'center',
      data: series.map((s) => s.name),
      itemGap: 20
    },
    grid: {
      left: gridLeft,
      right: gridRight,
      bottom: gridBottom,
      top: gridTop,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: rotateLabels ? 45 : 0,
        margin: 16,
        interval: 0,
        overflow: 'truncate',
        width: rotateLabels ? 72 : undefined,
        formatter: (value) => formatAxisLabel(value)
      },
      axisTick: { alignWithLabel: true },
      boundaryGap: isBar
    },
    yAxis: {
      ...yAxis,
      axisLabel: { margin: 12 },
      splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } }
    },
    series
  }

  if (hasZoomHint) {
    option.title = {
      subtext: 'Y축이 데이터 구간으로 확대되었습니다.',
      left: 'center',
      top: zoomHintTop,
      subtextStyle: { fontSize: 11, color: '#6b7280' }
    }
  }

  if (showDataZoom) {
    option.dataZoom = [
      { type: 'slider', xAxisIndex: 0, start: 0, end: dataZoomEnd, bottom: 12, height: 24 },
      { type: 'inside', xAxisIndex: 0, start: 0, end: dataZoomEnd }
    ]
  }

  return option
}

/**
 * 단일 시리즈 차트 옵션 (Dimension·Metric·차트 유형 자유 선택 시 getChartData 연동).
 * chartData = [{ name, value }], metricLabel, chartType('bar'|'line'|'area').
 */
function buildOptionFromCustom(chartData, metricLabel, chartType) {
  if (!chartData?.length) {
    return { title: { text: '데이터 없음', left: 'center', top: 'middle' } }
  }
  const categories = chartData.map((d) => d.name ?? '-')
  const values = chartData.map((d) => (d.value != null ? Number(d.value) : 0))
  const isBar = chartType === 'bar'
  const isArea = chartType === 'area'

  const manyCategories = categories.length > 8
  const rotateLabels = manyCategories
  const MAX_LABEL_CHARS = 18
  const truncateLabel = (v) => {
    const s = String(v ?? '').trim()
    return s.length <= MAX_LABEL_CHARS ? s : s.slice(0, MAX_LABEL_CHARS) + '…'
  }
  const formatAxisLabel = (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    const lines = raw.split('\n')
    if (lines.length <= 1) return truncateLabel(raw)
    return `${lines[0].trim()}\n${truncateLabel(lines.slice(1).join(' '))}`
  }

  const gridLeft = rotateLabels ? 104 : 76
  const gridRight = 52
  const baseBottom = manyCategories ? 100 : 60
  const gridBottom = baseBottom
  const gridTop = 52

  const series = [
    {
      name: metricLabel || '값',
      type: isBar ? 'bar' : 'line',
      data: values,
      smooth: !isBar,
      areaStyle: isArea ? { opacity: 0.35 } : undefined,
      stack: isArea ? 'total' : undefined
    }
  ]
  if (isBar && categories.length <= 15) {
    series[0].label = { show: true, position: 'top', fontSize: 10, formatter: (params) => (params.value != null ? Number(params.value).toLocaleString('ko-KR') : '') }
  }

  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params) => {
        if (!params?.length) return ''
        const lines = [params[0].axisValue]
        params.forEach((p) => lines.push(`${p.marker} ${p.seriesName}: ${p.value != null ? Number(p.value).toLocaleString('ko-KR') : '-'}`))
        return lines.join('<br/>')
      }
    },
    legend: { top: 8, left: 'center', data: series.map((s) => s.name), itemGap: 20 },
    grid: { left: gridLeft, right: gridRight, bottom: gridBottom, top: gridTop, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: rotateLabels ? 45 : 0, margin: 16, interval: 0, overflow: 'truncate', width: rotateLabels ? 72 : undefined, formatter: formatAxisLabel },
      axisTick: { alignWithLabel: true },
      boundaryGap: isBar
    },
    yAxis: { type: 'value', axisLabel: { margin: 12 }, splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } } },
    series
  }
}

export default function EChartsChart({ data = [], groupBy = {}, templateId, customChartData, metricLabel, chartType }) {
  const chartRef = useRef(null)
  const instanceRef = useRef(null)

  const useCustomMode = customChartData && metricLabel != null && chartType != null

  const template = useMemo(
    () => (useCustomMode ? null : CHART_TEMPLATES.find((t) => t.id === templateId) || CHART_TEMPLATES[0]),
    [useCustomMode, templateId]
  )
  const option = useMemo(
    () =>
      useCustomMode
        ? buildOptionFromCustom(customChartData, metricLabel, chartType)
        : buildOption(data, { ...groupBy, date: true }, template),
    [useCustomMode, customChartData, metricLabel, chartType, data, groupBy, template]
  )

  useEffect(() => {
    if (!chartRef.current) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current)
    }
    instanceRef.current.setOption(option, true)
  }, [option])

  useEffect(() => {
    const chart = instanceRef.current
    if (!chart || !chartRef.current) return
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.dispose()
        instanceRef.current = null
      }
    }
  }, [])

  return <div ref={chartRef} className="dashboard2-chart-wrap__inner" />
}
