/**
 * packages/widgetboard/utils/dataUtils.js (위젯보드 데이터 유틸)
 * ==============================================================
 * describe-table columns + rows 기준. 컬럼 타입 분류(숫자/날짜/차원)·차트용 Dimension/Metric 선택·집계·KPI 계산.
 *
 * [Main Functions]
 * ===========
 * 1. isNumericType, isDateType, isDimensionType: 컬럼 타입 판별
 * 2. pickDimensionAndMetric: columns에서 dimensionKey, metricKey 후보 선택
 * 3. aggregateForChart: rows를 dimensionKey 기준 집계(metricKey 합계)
 * 4. aggregateForChartByTimeGrain: 복수 일 기간 시 날짜 컬럼을 일/주/월 버킷으로 집계
 * 5. resolveWidgetDateColumnName: dateColumn 설정 또는 첫 날짜 컬럼
 * 6. computeKpi: rows에서 숫자 컬럼 합계·평균 등 KPI 객체 반환
 * 7. getDateColumns: columns에서 날짜/시간형 컬럼 목록 반환
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1.
/** 컬럼 type 문자열이 숫자형인지 */
export function isNumericType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return /integer|bigint|smallint|numeric|real|double|float|decimal|serial/i.test(t)
}

// 2.
/** 컬럼 type이 날짜/시간형인지 */
export function isDateType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return /date|time|timestamp/i.test(t)
}

// 3.
/** 차트 X축/레이블용으로 쓸 만한 컬럼(날짜·문자) */
export function isDimensionType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return isDateType(type) || /char|varchar|text|string/i.test(t)
}

// 4.
/**
 * columns(describe-table 응답)에서 차원(레이블) 후보·메트릭(숫자) 후보 선택
 * @returns { { dimensionKey: string | null, metricKey: string | null, dimensionCol, metricCol } }
 */
export function pickDimensionAndMetric(columns) {
  const list = columns || []
  let dimensionCol = list.find((c) => isDimensionType(c?.type))
  let metricCol = list.find((c) => isNumericType(c?.type))
  if (!dimensionCol && list.length > 0) dimensionCol = list[0]
  if (!metricCol && list.length > 1) metricCol = list.find((c) => c !== dimensionCol) || list[1]
  const dimensionKey = dimensionCol?.name ?? null
  const metricKey = metricCol?.name ?? null
  return { dimensionKey, metricKey, dimensionCol, metricCol }
}

// 5.
/**
 * rows를 dimensionKey로 그룹화하고, metricKey가 있으면 합계, 없으면 개수
 * @returns { Array<{ name: string, value: number }> } 차트용 데이터
 */
export function aggregateForChart(rows, dimensionKey, metricKey) {
  const map = new Map()
  for (const row of rows || []) {
    const name = row[dimensionKey] != null ? String(row[dimensionKey]) : '(빈값)'
    if (!map.has(name)) map.set(name, { name, value: 0 })
    if (metricKey != null && row[metricKey] != null) {
      const n = Number(row[metricKey])
      if (!Number.isNaN(n)) map.get(name).value += n
    } else {
      map.get(name).value += 1
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.name < b.name ? -1 : 1))
}

// 6.
function parseRowDate(value) {
  if (value == null) return null
  const s = String(value).trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * 행의 날짜 값을 기간 단위 버킷 라벨로 변환(차트 X축)
 * @param {unknown} dateValue
 * @param {'day'|'week'|'month'} grain
 * @returns {string}
 */
export function bucketLabelForGrain(dateValue, grain) {
  const d = parseRowDate(dateValue)
  if (!d) return '(날짜 없음)'
  const g = String(grain || 'day').toLowerCase()
  if (g === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  if (g === 'week') {
    return `${formatYMD(mondayOfWeek(d))} (주)`
  }
  return formatYMD(d)
}

/**
 * 복수 일 조회 시 날짜 컬럼 기준으로 일/주/월 단위 합계 집계
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} dateColumnName
 * @param {string|null} metricKey
 * @param {'day'|'week'|'month'} grain
 */
export function aggregateForChartByTimeGrain(rows, dateColumnName, metricKey, grain) {
  const map = new Map()
  for (const row of rows || []) {
    const bucket = bucketLabelForGrain(row[dateColumnName], grain)
    if (!map.has(bucket)) map.set(bucket, { name: bucket, value: 0 })
    if (metricKey != null && row[metricKey] != null) {
      const n = Number(row[metricKey])
      if (!Number.isNaN(n)) map.get(bucket).value += n
    } else {
      map.get(bucket).value += 1
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.name < b.name ? -1 : 1))
}

/**
 * describe 컬럼 목록과 data_config.dateColumn 으로 기간 필터·집계에 쓸 날짜 컬럼명
 * @param {Array<{ name?: string, type?: string }>} columns
 * @param {string} [dateColumnConfig]
 * @returns {string|null}
 */
export function resolveWidgetDateColumnName(columns, dateColumnConfig) {
  const list = columns || []
  const dateCols = getDateColumns(list)
  if (dateColumnConfig && list.some((c) => c?.name === dateColumnConfig)) return dateColumnConfig
  return dateCols[0] ?? null
}

// 7.
/** KPI용: 숫자 컬럼이 있으면 그 합계, 없으면 행 개수. metricKey 지정 시 해당 컬럼 사용 */
export function computeKpi(rows, columns, metricKey = null) {
  const list = columns || []
  let metricCol = metricKey ? list.find((c) => c?.name === metricKey) : null
  if (!metricCol) metricCol = list.find((c) => isNumericType(c?.type))
  if (metricCol && rows?.length) {
    const key = metricCol.name
    let sum = 0
    for (const row of rows) {
      const v = row[key]
      if (v != null) {
        const n = Number(v)
        if (!Number.isNaN(n)) sum += n
      }
    }
    return sum
  }
  return rows?.length ?? 0
}

// 8.
/** columns에서 날짜/시간형 컬럼 목록 반환 (글로벌 기간 필터용) */
export function getDateColumns(columns) {
  const list = columns || []
  return list.filter((c) => isDateType(c?.type)).map((c) => c?.name).filter(Boolean)
}
