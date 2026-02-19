/**
 * packages/widgetboard/utils/dataUtils.js (위젯보드 데이터 유틸)
 * ==============================================================
 * describe-table columns + rows 기준. 컬럼 타입 분류(숫자/날짜/차원)·차트용 Dimension/Metric 선택·집계·KPI 계산.
 *
 * [Main Functions]
 * ===========
 * isNumericType, isDateType, isDimensionType: 컬럼 타입 판별
 * pickDimensionAndMetric: columns에서 dimensionKey, metricKey 후보 선택
 * aggregateForChart: rows를 dimensionKey 기준 집계(metricKey 합계)
 * computeKpi: rows에서 숫자 컬럼 합계·평균 등 KPI 객체 반환
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/** 컬럼 type 문자열이 숫자형인지 */
export function isNumericType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return /integer|bigint|smallint|numeric|real|double|float|decimal|serial/i.test(t)
}

/** 컬럼 type이 날짜/시간형인지 */
export function isDateType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return /date|time|timestamp/i.test(t)
}

/** 차트 X축/레이블용으로 쓸 만한 컬럼(날짜·문자) */
export function isDimensionType(type) {
  if (!type || typeof type !== 'string') return false
  const t = type.toLowerCase()
  return isDateType(type) || /char|varchar|text|string/i.test(t)
}

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

/** KPI용: 숫자 컬럼이 있으면 그 합계, 없으면 행 개수 */
export function computeKpi(rows, columns) {
  const list = columns || []
  const metricCol = list.find((c) => isNumericType(c?.type))
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
