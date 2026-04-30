/**
 * packages/widgetboard/utils/chartMatchScore.js (차트 템플릿 적합도·추천 매핑)
 * =====================================================================
 * 계획서 §7.4 `calculateMatchScore` 및 백엔드 `chart_type`(스네이크) ↔ UI `chartType` 정규화,
 * 프로파일 기반 추천 → `dimensionKey` / `metricKey` / `dateColumn` 패치 생성.
 *
 * [Main Functions]
 * ===========
 * - normalizeWidgetPaletteToScoreKind: 팔레트 타입(lineChart 등)→적합도 규칙 키
 * - summarizeSemanticRolesFromColumns: columns[].semantic_role 집계
 * - calculateMatchScore: 템플릿×role_summary(또는 columns)·적합도 0~1·구간 라벨
 * - mapBackendChartTypeToUiChartType: CHART_TYPES 값(line|bar|pie|area) 정규화
 * - uiChartTypesAllowedForWidgetPalette: 팔레트 유형별 허용 chartType 집합(없으면 null)
 * - filterRecommendationsForWidget: recommendations를 위젯 팔레트 허용 chartType으로 최대 3건(비차트 팔레트는 [])
 * - formatRecommendationChipLabel: 추천 안내 라벨(scatter→라인 대체 등 UI와 혼동 방지)
 * - profileSampleTableColumnNames: 미리보기 표 헤더 순서(columns·ordinal 정합)
 * - buildConfigPatchFromRecommendation: recommendations 항목 1건 → data_config 패치
 * - hasTemporalColumn: 프로파일에 TEMPORAL 존재 여부
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/** @typedef {Record<string, number>} SemanticRoleCounts */

const ROLE_KEYS = ['TEMPORAL', 'MEASURE', 'DIMENSION', 'IDENTIFIER', 'HIGH_CARDINALITY_TEXT', 'GEO']

// 1.
/** 차트 종류별 최소 역할 요구 — §7.4 (bar에 시계열 막대: TEMPORAL이 DIMENSION 요건 충족) */
export const MATCH_REQUIREMENTS = {
  line: { TEMPORAL: 1, MEASURE: 1 },
  bar: { __barAxis: true, MEASURE: 1 },
  pie: { DIMENSION: 1, MEASURE: 1 },
  scatter: { MEASURE: 2 },
  number: { MEASURE: 1 },
  combo: { TEMPORAL: 1, MEASURE: 2 },
  stacked_bar: { TEMPORAL: 1, DIMENSION: 1, MEASURE: 1 },
  table: {}
}

/** @type {Record<string, keyof typeof MATCH_REQUIREMENTS|string>} */
const PALETTE_WIDGET_TYPE_TO_KIND = {
  lineChart: 'line',
  barChart: 'bar',
  pieChart: 'pie',
  kpi: 'number',
  table: 'table',
  /** 레이더·게이지: 막대와 동일하게 범주(또는 시계열)+수치 필요로 간주 */
  echartsRadar: 'bar',
  echartsGauge: 'bar'
}

// 2.
/**
 * 드래그한 위젯 팔레트 타입을 적합도 규칙 키로 변환합니다.
 * @param {string} [widgetType]
 * @returns {keyof typeof MATCH_REQUIREMENTS}
 */
export function normalizeWidgetPaletteToScoreKind(widgetType) {
  const k = PALETTE_WIDGET_TYPE_TO_KIND[widgetType || '']
  return k || 'table'
}

// 3.
/**
 * 프로파일 `columns[]`에서 semantic_role 건수를 집계합니다.
 * @param {Array<{ semantic_role?: string }>} [columns]
 * @returns {SemanticRoleCounts}
 */
export function summarizeSemanticRolesFromColumns(columns) {
  const o = { TEMPORAL: 0, MEASURE: 0, DIMENSION: 0, IDENTIFIER: 0, HIGH_CARDINALITY_TEXT: 0, GEO: 0 }
  if (!Array.isArray(columns)) return o
  for (const c of columns) {
    const r = c?.semantic_role
    if (r && Object.prototype.hasOwnProperty.call(o, r)) o[r] += 1
  }
  return o
}

/**
 * list-tables 행의 `role_summary`(또는 동형 객체)를 건수 맵으로 정규화합니다.
 * @param {Record<string, number>|null|undefined} roleSummary
 * @returns {SemanticRoleCounts}
 */
export function normalizeRoleSummaryCounts(roleSummary) {
  const o = { TEMPORAL: 0, MEASURE: 0, DIMENSION: 0, IDENTIFIER: 0, HIGH_CARDINALITY_TEXT: 0, GEO: 0 }
  if (!roleSummary || typeof roleSummary !== 'object') return o
  for (const k of ROLE_KEYS) {
    const n = Number(roleSummary[k])
    o[k] = Number.isFinite(n) && n > 0 ? n : 0
  }
  return o
}

/**
 * 바 축 요구 병합 여부(DIMENSION≥1 또는 TEMPORAL≥1)
 * @param {SemanticRoleCounts} counts
 */
function barAxisOk(counts) {
  return (counts.DIMENSION || 0) >= 1 || (counts.TEMPORAL || 0) >= 1
}

// 4.
/**
 * 플레이스홀더/집계 키에 대한 부족 설명 문자열 생성
 */
function requirementSlots(kind) {
  const req = MATCH_REQUIREMENTS[kind] || MATCH_REQUIREMENTS.table
  /** @type {Array<{ ok: (c: SemanticRoleCounts) => boolean, label: string }>} */
  const slots = []
  if (kind === 'bar') {
    slots.push({
      ok: (c) => barAxisOk(c),
      label: '범주(DIMENSION) 또는 시계열(TEMPORAL) 1열 이상'
    })
    slots.push({
      ok: (c) => (c.MEASURE || 0) >= 1,
      label: '수치(MEASURE) 1열 이상'
    })
    return slots
  }
  for (const [key, need] of Object.entries(req)) {
    if (key.startsWith('_')) continue
    const n = Number(need) || 0
    slots.push({
      ok: (c) => (c[key] || 0) >= n,
      label: `${key} 최소 ${n}`
    })
  }
  return slots
}

/**
 * @param {string} [widgetPaletteType] lineChart, barChart, …
 * @param {Record<string, number>|null|undefined} roleSummary 백엔드 list-tables 행
 * @param {Array<{ semantic_role?: string }>|undefined} columnsProfile
 *   `role_summary`가 없거나 전부 0일 때 적합도를 columns로 재계산할 때 사용(현재 list-tables 흐름에서는 미사용·향후 확장용).
 * @returns {{ score: number, tier: 'ok'|'partial'|'bad'|'unknown', missingLabels: string[] }}
 */
export function calculateMatchScore(widgetPaletteType, roleSummary, columnsProfile) {
  const kind = normalizeWidgetPaletteToScoreKind(widgetPaletteType)
  const hasSummary =
    roleSummary &&
    typeof roleSummary === 'object' &&
    Object.keys(roleSummary).some((k) => Number(roleSummary[k]) > 0)
  /** @type {SemanticRoleCounts} */
  let counts
  /** list-tables에서 role_summary가 null이면 프로파일 없음 — 적합도 구간 unknown */
  if (roleSummary === null && (!columnsProfile || columnsProfile.length === 0)) {
    return { score: 0, tier: 'unknown', missingLabels: [] }
  }

  if (hasSummary) {
    counts = normalizeRoleSummaryCounts(roleSummary)
  } else if (Array.isArray(columnsProfile) && columnsProfile.length > 0) {
    counts = summarizeSemanticRolesFromColumns(columnsProfile)
  } else {
    counts = summarizeSemanticRolesFromColumns([])
  }

  const slots = requirementSlots(kind)
  if (slots.length === 0) {
    return { score: 1, tier: 'ok', missingLabels: [] }
  }

  let met = 0
  /** @type {string[]} */
  const missingLabels = []
  for (const s of slots) {
    const ok = s.ok(counts)
    if (ok) met += 1
    else missingLabels.push(s.label)
  }
  const score = met / slots.length
  /** @type {'ok'|'partial'|'bad'} */
  let tier = 'bad'
  if (score >= 1) tier = 'ok'
  else if (score > 0) tier = 'partial'
  else tier = 'bad'
  return { score, tier, missingLabels }
}

/**
 * list-tables 배열을 §7.4 적합도 순으로 정렬(동점 시 table_name 한국어 순).
 * @param {Array<object>} tables
 * @param {string} [widgetPaletteType]
 * @returns {Array<object>}
 */
export function sortTablesByMatchScore(tables, widgetPaletteType) {
  if (!Array.isArray(tables)) return []
  const tierRank = { ok: 0, partial: 1, bad: 2, unknown: 3 }
  const decorated = tables.map((row) => {
    const name = String(row?.table_name ?? row?.[0] ?? '')
    const m = calculateMatchScore(widgetPaletteType, row?.role_summary ?? null)
    return { row, name, tier: m.tier, score: m.score }
  })
  decorated.sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier]
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name, 'ko-KR')
  })
  return decorated.map((d) => d.row)
}

// 5.
/**
 * @param {string} [backendChartType] chart_recommender chart_type 스네이크
 * @returns {'line'|'bar'|'pie'|'area'|undefined} CHART_TYPES·data_config 규격
 */
export function mapBackendChartTypeToUiChartType(backendChartType) {
  const u = String(backendChartType || '').toLowerCase()
  if (!u) return undefined
  if (['line', 'trend', 'combo'].includes(u)) return 'line'
  if (['bar', 'grouped_bar', 'stacked_bar', 'heatmap'].includes(u)) return 'bar'
  if (u === 'pie') return 'pie'
  if (['area', 'stacked_area'].includes(u)) return 'area'
  /** UI에 scatter 없음 — 칩 라벨은 `formatRecommendationChipLabel`에서 별도 안내 */
  if (u === 'scatter') return 'line'
  return undefined
}

/**
 * 위젯 팔레트 유형별로 `data_config.chartType` 셀렉터와 맞출 수 있는 UI 차트 값.
 * `null`이면 차트 유형 셀렉터가 없는 팔레트(kpi·gauge 등) → 추천 안내·자동 적용 대상에서 제외(`filterRecommendationsForWidget`는 빈 배열).
 * @param {string} [widgetPaletteType] lineChart, barChart, pieChart, kpi, …
 * @returns {Set<string>|null} `line`|`bar`|`pie`|`area` 부분집합
 */
export function uiChartTypesAllowedForWidgetPalette(widgetPaletteType) {
  const t = widgetPaletteType || ''
  if (t === 'lineChart') return new Set(['line', 'area'])
  if (t === 'barChart') return new Set(['bar'])
  if (t === 'pieChart') return new Set(['pie'])
  return null
}

/**
 * 백엔드 recommendations 중, 위젯 템플릿에 맞는 차트 계열만 남긴다(최대 3건).
 * @param {Array<object>|undefined} recommendations
 * @param {string} [widgetPaletteType]
 */
export function filterRecommendationsForWidget(recommendations, widgetPaletteType) {
  const list = Array.isArray(recommendations) ? recommendations : []
  const allowed = uiChartTypesAllowedForWidgetPalette(widgetPaletteType)
  if (!allowed) return []
  return list
    .filter((rec) => {
      const ui = mapBackendChartTypeToUiChartType(rec?.chart_type)
      return ui != null && allowed.has(ui)
    })
    .slice(0, 3)
}

/**
 * 추천 안내 줄에 표시할 짧은 라벨(백엔드 chart_type + 신뢰도 %). scatter→line 매핑 시 문구 명시.
 * @param {{ chart_type?: string, confidence?: number }} rec
 */
export function formatRecommendationChipLabel(rec) {
  if (!rec || typeof rec !== 'object') return ''
  const raw = String(rec.chart_type || '').toLowerCase()
  const n = Number(rec.confidence)
  const pct = Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0
  if (raw === 'scatter') {
    return `라인(산점도 대체) ${pct.toFixed(0)}%`
  }
  const ui = mapBackendChartTypeToUiChartType(raw)
  const byUi = { line: '라인', bar: '막대', pie: '파이', area: '영역' }
  const byRaw = {
    combo: '콤보',
    grouped_bar: '그룹 막대',
    stacked_bar: '스택 막대',
    heatmap: '히트맵',
    number: '숫자',
    trend: '추세',
    table: '표'
  }
  const label = byUi[ui] || byRaw[raw] || raw
  return `${label} ${pct.toFixed(0)}%`
}

/**
 * 미리보기 `sample_rows` 표의 열 순서: `columns` 배열 순서를 따르고, 첫 샘플 행에 존재하는 키만 표시.
 * @param {{ columns?: Array<{ name?: string }>, sample_rows?: Array<Record<string, unknown>> }} profile
 * @returns {string[]}
 */
export function profileSampleTableColumnNames(profile) {
  const cols = profile?.columns
  const rows = profile?.sample_rows
  if (!Array.isArray(cols) || !cols.length || !Array.isArray(rows) || !rows[0] || typeof rows[0] !== 'object') {
    return []
  }
  const keys = new Set(Object.keys(rows[0]))
  return cols.map((c) => c?.name).filter((n) => n && keys.has(n))
}

/**
 * @param {string} colName
 * @param {Array<{ name?: string, semantic_role?: string }>} [columns]
 */
function semanticRoleOfColumn(colName, columns) {
  if (!colName || !Array.isArray(columns)) return undefined
  const row = columns.find((c) => c.name === colName)
  return row?.semantic_role
}

// 6.
/**
 * 추천 1건을 위젯 저장 가능 패치로 변환합니다(colorBy·aggregations 미포함, §1.0).
 *
 * @param {object} rec rank/chart_type/x_axis/y_axis 등
 * @param {Array<{ name?: string, semantic_role?: string }>} columns 프로파일 columns
 * @param {{ preserveDimensionWhenMultiDay?: boolean, dateStart?: string, dateEnd?: string }} [opts]
 * @returns {{ chartType?: string, dimensionKey?: string|null, metricKey?: string|null, dateColumn?: string }}
 */
export function buildConfigPatchFromRecommendation(rec, columns, opts = {}) {
  const patch = {}
  if (!rec || typeof rec !== 'object') return patch

  const yRaw = Array.isArray(rec.y_axis) ? rec.y_axis : []
  const y0 = typeof yRaw[0] === 'string' ? yRaw[0] : yRaw[0] != null ? String(yRaw[0]) : ''

  /** @type {string|undefined|null} */
  const xRaw = typeof rec.x_axis === 'string' ? rec.x_axis : rec.x_axis != null ? String(rec.x_axis) : null

  const uiChart = mapBackendChartTypeToUiChartType(rec.chart_type)
  if (uiChart) patch.chartType = uiChart

  if (y0) patch.metricKey = y0

  const cols = Array.isArray(columns) ? columns : []
  const firstTemporal = cols.find((c) => c.semantic_role === 'TEMPORAL' && c.name)?.name || ''
  const xRole = xRaw ? semanticRoleOfColumn(xRaw, cols) : undefined
  const chartSnake = String(rec.chart_type || '').toLowerCase()

  if (xRole === 'TEMPORAL') {
    patch.dateColumn = xRaw
  } else if (firstTemporal && ['line', 'trend', 'combo', 'stacked_bar', 'heatmap'].includes(chartSnake)) {
    patch.dateColumn = firstTemporal
  }

  /** 범주 축 — 복수 일이면 dimension 생략(기존 마법사 정책) */
  const ds = String(opts.dateStart || '').slice(0, 10)
  const de = String(opts.dateEnd || '').slice(0, 10)
  const multiDay = Boolean(ds && de && ds !== de)

  if (!multiDay) {
    if (['bar', 'grouped_bar', 'pie'].includes(chartSnake) && xRaw && xRole === 'DIMENSION') {
      patch.dimensionKey = xRaw
    }
    if (chartSnake === 'stacked_bar' && typeof rec.color_by === 'string' && rec.color_by.trim()) {
      patch.dimensionKey = rec.color_by.trim()
    }
    /** TEMPORAL이 없고 라인에서 x만 범주인 경우 §1.0 dimensionKey */
    if (
      (chartSnake === 'line' || chartSnake === 'trend' || chartSnake === 'combo') &&
      xRaw &&
      xRole === 'DIMENSION' &&
      !firstTemporal
    ) {
      patch.dimensionKey = xRaw
    }
  }

  return patch
}

// 7.
/**
 * 프로파일 응답 또는 columns 배열 기준 일자 가능 여부 §6 Phase 4
 * @param {object|null|undefined} profile
 */
export function hasTemporalColumn(profile) {
  const cols = profile?.columns ?? profile
  return Array.isArray(cols) && cols.some((c) => c?.semantic_role === 'TEMPORAL')
}

/** `semantic_role` 짧은 한글 — §7.3 */
export const SEMANTIC_ROLE_LABEL_KO = {
  TEMPORAL: '일자',
  MEASURE: '수치',
  DIMENSION: '분류',
  IDENTIFIER: 'ID',
  HIGH_CARDINALITY_TEXT: '텍스트',
  GEO: '위치'
}

/** @param {string} name @param {string} [semanticRole] */
export function formatAxisOptionCaption(name, semanticRole) {
  const lab = semanticRole ? SEMANTIC_ROLE_LABEL_KO[semanticRole] || semanticRole : ''
  return lab ? `${name} · ${lab}` : name
}
