/**
 * dashboard2/components/EChartsChart.jsx (ECharts 템플릿 차트)
 * =============================================================
 * aggregated_data를 ECharts API로 시각화. 템플릿별 bar/line 옵션 구성.
 *
 * [주요 기능]
 * - 템플릿 ID에 따라 xAxis/series 옵션 생성 (일자 또는 복합 라벨, 메트릭 시리즈)
 * - 막대 복수 메트릭 시 스택(stack), Y축 좁은 구간 시 데이터 구간 확대, 카테고리 많을 때 dataZoom 적용
 * - echarts.init / setOption / resize / dispose 로 라이프사이클 관리
 *
 * [의존성]
 * - React (useRef, useEffect), echarts
 */

import { useRef, useEffect, useMemo } from 'react'
import * as echarts from 'echarts'

/** groupBy에 따라 행의 X축 라벨 생성 (일자 + 캠페인 + 워크플로우 + 채널) */
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
  return parts.join(' / ')
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
 * 값이 좁은 구간에 몰려 있으면(범위/최대 < NARROW_RATIO) 데이터 구간 기준 축 사용.
 */
const NARROW_RATIO = 0.2
const MIN_ABSOLUTE_RANGE = 1

function computeYAxisBounds(rows, template) {
  if (!rows?.length || !template?.metricKeys?.length) return null
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

  const gridBottom = showDataZoom ? '22%' : '12%'
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: series.map((s) => s.name) },
    grid: { left: '3%', right: '4%', bottom: gridBottom, top: yAxisBounds ? '18%' : '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: categories.length > 8 ? 45 : 0 }
    },
    yAxis,
    series
  }

  if (yAxisBounds) {
    option.title = {
      subtext: 'Y축이 데이터 구간으로 확대되었습니다.',
      left: 'center',
      top: 4,
      subtextStyle: { fontSize: 11, color: '#6b7280' }
    }
  }

  if (showDataZoom) {
    option.dataZoom = [
      { type: 'slider', xAxisIndex: 0, start: 0, end: dataZoomEnd, bottom: 8 },
      { type: 'inside', xAxisIndex: 0, start: 0, end: dataZoomEnd }
    ]
  }

  return option
}

export default function EChartsChart({ data = [], groupBy = {}, templateId }) {
  const chartRef = useRef(null)
  const instanceRef = useRef(null)

  const template = useMemo(
    () => CHART_TEMPLATES.find((t) => t.id === templateId) || CHART_TEMPLATES[0],
    [templateId]
  )
  const option = useMemo(
    () => buildOption(data, { ...groupBy, date: true }, template),
    [data, groupBy, template]
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
