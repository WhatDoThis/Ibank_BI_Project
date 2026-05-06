/**
 * query_studio/utils/sqlBuilder.js (SQL 생성 유틸)
 * ===========================================
 * 리포트 쿼리 빌더 전용. SELECT/JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT 생성. 별칭 t1, t2 사용.
 *
 * [Main Functions]
 * ===========
 * 1. quoteIdent, dedupeConditions (내부). getJoinKey: tableRelationships에서 prevTable-currTable JOIN 키 반환
 * 2. generateSQL: 전체 SELECT 쿼리 (joinConfigs, groupBy, dateGranularity, havings, pivot, pivotRowAggs)
 * 3. generateCountSQL: COUNT(*) 쿼리 (GROUP BY 시 서브쿼리)
 * 4. generateDistinctPivotSQL: 피벗 시 고유 건수용
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1. PostgreSQL 식별자 이스케이프. 숫자시작·하이픈·공백 등 특수문자 포함 시 "name" 형태로 감싸야 함
function quoteIdent(name) {
  if (name == null || name === '') return '""'
  const s = String(name).replace(/"/g, '""')
  return `"${s}"`
}

// 2. ON 조건 배열에서 (prevColumn, currColumn) 기준 중복 제거 → 중복 JOIN 조건 방지
function dedupeConditions(conditions) {
  if (!conditions?.length) return []
  const seen = new Set()
  return conditions.filter((c) => {
    const key = `${c?.prevColumn ?? ''}|${c?.currColumn ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 3.
export function getJoinKey(tableRelationships, prevTable, currTable) {
  const rel = tableRelationships[prevTable]?.[currTable]
  if (rel && rel.prevColumn != null && rel.currColumn != null) return rel
  const rev = tableRelationships[currTable]?.[prevTable]
  if (rev && rev.prevColumn != null && rev.currColumn != null)
    return { prevColumn: rev.currColumn, currColumn: rev.prevColumn }
  return null
}

/** joinConfigs에 양방향 중 한쪽이라도 수동 ON 조건이 있으면 true */
function joinConfigsHasConditions(joinConfigs, fromTable, currTable) {
  if (!joinConfigs) return false
  const c = joinConfigs[`${fromTable}||${currTable}`] || joinConfigs[`${currTable}||${fromTable}`]
  return Boolean(c?.conditions?.length)
}

/**
 * join_order 스텝에 from_table이 없을 때: addedTables[0..i-1]에서 뒤→앞으로 스캔해
 * 수동 조건 또는 tableRelationships 엣지가 있는 첫 테이블을 부모로 선택 (공통 부모·스타 스키마).
 */
function resolveJoinParentTable(i, currTable, addedTables, step, tableRelationships, joinConfigs) {
  if (step && step.from_table) return step.from_table
  for (let j = i - 1; j >= 0; j--) {
    const candidate = addedTables[j]
    if (joinConfigsHasConditions(joinConfigs, candidate, currTable)) return candidate
    if (getJoinKey(tableRelationships, candidate, currTable)) return candidate
  }
  return addedTables[i - 1]
}

// 4.
function escapeValueForSql(val, operator) {
  if (operator === 'LIKE') return `'%${String(val).replace(/'/g, "''")}%'`
  if (!Number.isNaN(Number(val)) && String(val).trim() !== '') return val
  return `'${String(val).replace(/'/g, "''")}'`
}

// 5. 단일 값 SQL 이스케이프 (IN/BETWEEN용)
function escapeSingle(val) {
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'null') return 'NULL'
  if (!Number.isNaN(Number(s))) return s
  return `'${String(s).replace(/'/g, "''")}'`
}

// 6. 필터 하나에 대한 WHERE 절 조각 생성 (IS NULL, IN, BETWEEN 등 지원)
function buildOneWhereClause(f, c) {
  const colExpr = `${c.alias}.${quoteIdent(c.column)}`
  const op = f.operator || '='
  if (op === 'IS NULL') return `${colExpr} IS NULL`
  if (op === 'IS NOT NULL') return `${colExpr} IS NOT NULL`
  if (op === 'IN') {
    const raw = (f.value || '').trim()
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return null
    const inList = parts.map(escapeSingle).join(', ')
    return `${colExpr} IN (${inList})`
  }
  if (op === 'BETWEEN') {
    const raw = (f.value || '').trim()
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length < 2) return null
    const a = escapeSingle(parts[0])
    const b = escapeSingle(parts[1])
    return `${colExpr} BETWEEN ${a} AND ${b}`
  }
  const val = escapeValueForSql(f.value, op)
  return `${colExpr} ${op} ${val}`
}

// 7. WHERE 절 배열을 logicalOperator로 연결 (filters[i].logicalOperator = i번과 i+1번 사이 연결)
function joinWhereClauses(clauses, filters) {
  if (clauses.length === 0) return ''
  if (clauses.length === 1) return clauses[0]
  return clauses.reduce((acc, cl, i) => (i === 0 ? cl : `${acc} ${(filters[i - 1].logicalOperator || 'AND')} ${cl}`), '')
}

// 8.
function getAlias(gridColumns, table) {
  const c = gridColumns.find((col) => col.table === table)
  return c ? c.alias : null
}

// 9.
function isGroupByColumn(groupBy, table, column) {
  if (!groupBy || !groupBy.length) return false
  return groupBy.some((g) => g.table === table && g.column === column)
}

// 9a. 날짜 단위 TO_CHAR: 메타는 날짜형인데 DB 컬럼이 text/varchar인 경우 대비해 timestamptz로 캐스트
function toCharByGran(sqlColumnExpr, granPattern) {
  const ts = `(${sqlColumnExpr})::timestamptz`
  return `TO_CHAR(${ts}, '${granPattern}')`
}

// 10. GROUP BY 절에 쓸 컬럼 표현식 (날짜 단위 적용)
function groupByExpression(alias, table, column, dateGranularity) {
  let expr = `${alias}.${quoteIdent(column)}`
  const key = `${table}.${column}`
  const gran = dateGranularity && dateGranularity[key]
  if (gran === 'YYYY') expr = toCharByGran(expr, 'YYYY')
  else if (gran === 'YYYY-MM') expr = toCharByGran(expr, 'YYYY-MM')
  else if (gran === 'YYYY-MM-DD') expr = toCharByGran(expr, 'YYYY-MM-DD')
  return expr
}

/** SELECT 결과 밖(PG 주석·distinct 피벗 등): 테이블_컬럼 — 결과 별칭과 별개 */
function selectOutputAlias(table, column) {
  if (table == null || column == null) return 'unknown_col'
  return `${String(table)}_${String(column)}`
}

function selectOutputAliasAgg(aggFunc, table, column) {
  const a = aggFunc || 'COUNT'
  return `${String(a)}_${selectOutputAlias(table, column)}`
}

const _SAVED_REPORT_PREFIX = 'test_report_'

function isValidSqlIdentifier(v) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(v || ''))
}

/**
 * 1차 저장 테이블(test_report_*)의 물리 컬럼 col_n: describe `label`(PG COMMENT 기반)이 물리명과 다르면
 * SELECT AS·execute 결과 키·2차 저장 column_comment_hints.logical_key 로 쓴다 (outputKey 미설정 보정).
 */
export function inferSavedReportOutputKey(table, column, label) {
  const t = table != null ? String(table) : ''
  const col = column != null ? String(column) : ''
  if (!t.startsWith(_SAVED_REPORT_PREFIX)) return null
  if (!/^col_\d+$/i.test(col)) return null
  const lab = label != null && String(label).trim() !== '' ? String(label).trim() : ''
  if (!lab || lab === col) return null
  if (!isValidSqlIdentifier(lab)) return null
  return lab
}

/**
 * Rule 7: test_report_* 계열은 단계가 올라가도 현재 테이블명 prefix를 덮어쓰지 않는다.
 * - PG 코멘트 root/logical_key가 있으면 우선 사용
 * - col_n + label 추론 가능하면 사용
 * - 그 외 test_report_* 물리 컬럼(예: campaigns_id)은 컬럼명 그대로 유지
 */
function stableSavedReportOutputKey(c) {
  if (!c) return null
  const t = c.table != null ? String(c.table) : ''
  if (!t.startsWith(_SAVED_REPORT_PREFIX)) return null
  const preserved =
    c.pgCommentRoot ??
    c.pg_comment_root ??
    (c.logical_key != null && String(c.logical_key).trim() !== '' ? String(c.logical_key).trim() : null)
  if (preserved && isValidSqlIdentifier(preserved)) return String(preserved).trim()
  const inferred = inferSavedReportOutputKey(t, c.column, c.label)
  if (inferred) return inferred
  const col = c.column != null ? String(c.column) : ''
  if (isValidSqlIdentifier(col)) return col
  return null
}

/**
 * 결과 컬럼 키 한 칸분(유니크 파트 전): outputKey·label 추론 우선, 없으면 테이블명_컬럼명(selectOutputAlias)·집계는 AGG_테이블_컬럼.
 * 겹침은 computeUniquifiedOutputKeys / uniquifyResultKeys 에서만 동일 base에 _1, _2, … (전부 접미).
 */
function baseResultKeyForColumn(c, groupBy, dateGranularity) {
  if (!c) return 'unknown_col'
  const explicit = c.outputKey != null && String(c.outputKey).trim() !== '' ? String(c.outputKey).trim() : null
  const inferred = !explicit ? stableSavedReportOutputKey(c) : null
  const effective = explicit || inferred
  const isGB = isGroupByColumn(groupBy, c.table, c.column)
  if (groupBy && groupBy.length > 0 && !isGB && c.aggFunc) {
    if (effective) return `${c.aggFunc}_${effective}`
    return selectOutputAliasAgg(c.aggFunc, c.table, c.column)
  }
  if (effective) return effective
  return selectOutputAlias(c.table, c.column)
}

/** 피벗/저장 계획용 — resolveOutputLabel 대체 */
function resolveOutputLabel(gridColumns, table, column, groupBy, dateGranularity, aggFunc) {
  const gc = gridColumns?.find((x) => x.table === table && x.column === column)
  const col = gc
    ? aggFunc != null && aggFunc !== undefined && String(aggFunc).trim() !== ''
      ? { ...gc, aggFunc }
      : gc
    : { table, column, alias: 't1', ...(aggFunc != null && aggFunc !== undefined ? { aggFunc } : {}) }
  return baseResultKeyForColumn(col, groupBy, dateGranularity)
}

// 11. SELECT 절 단일 컬럼 표현식 (날짜 단위 + 집계). 기본 AS 는 테이블명_컬럼명·중복 시 uniquify; test_report_* 의 col_n 은 label(코멘트) 기반으로 보정 가능.
// forcedOut: 테이블 저장 시 uniquify 된 별칭(겹침 시 _1, _2) — inner 래핑과 동일해야 함.
function getSelectExpression(col, gridColumns, groupBy, dateGranularity, forcedOut = null) {
  const alias = col.alias
  let base = `${alias}.${quoteIdent(col.column)}`
  const key = `${col.table}.${col.column}`
  const gran = dateGranularity && dateGranularity[key]
  if (gran === 'YYYY') base = toCharByGran(base, 'YYYY')
  else if (gran === 'YYYY-MM') base = toCharByGran(base, 'YYYY-MM')
  else if (gran === 'YYYY-MM-DD') base = toCharByGran(base, 'YYYY-MM-DD')

  const isGB = isGroupByColumn(groupBy, col.table, col.column)
  const out =
    forcedOut != null && String(forcedOut).trim() !== ''
      ? String(forcedOut).trim()
      : resolveOutputLabel(gridColumns, col.table, col.column, groupBy, dateGranularity, col.aggFunc)
  if (groupBy && groupBy.length > 0 && !isGB && col.aggFunc) {
    return `${col.aggFunc}(${alias}.${quoteIdent(col.column)}) AS ${quoteIdent(out)}`
  }
  return `${base} AS ${quoteIdent(out)}`
}

/**
 * executeQuery 결과 행 키: SELECT AS 와 동일(컬럼명·중복 시 _1, _2).
 * gridColumns 를 넘기면 그리드 전체 기준 uniquify 와 일치; 생략 시 c 단일 칼럼만 기준.
 */
export function getResultColumnKey(c, groupBy = [], dateGranularity = {}, gridColumns = null) {
  if (!c) return ''
  const cols = gridColumns && gridColumns.length > 0 ? gridColumns : [c]
  const idx = cols.findIndex(
    (gc) => gc.table === c.table && gc.column === c.column && (gc.alias || '') === (c.alias || '')
  )
  const i = idx >= 0 ? idx : 0
  const keys = computeUniquifiedOutputKeys(cols, groupBy, dateGranularity)
  return keys[i] ?? ''
}

// 12. ORDER BY 절 표현식 (집계 시 agg 반영)
function getOrderByExpression(ob, gridColumns, groupBy) {
  const c = gridColumns[ob.columnIndex]
  if (!c) return null
  const alias = c.alias
  const isGB = isGroupByColumn(groupBy, c.table, c.column)
  if (groupBy && groupBy.length > 0 && !isGB && c.aggFunc) {
    return `${c.aggFunc}(${alias}.${quoteIdent(c.column)})`
  }
  return `${alias}.${quoteIdent(c.column)}`
}

/** SELECT 결과 별칭이 겹칠 때: 동일 base가 2개 이상이면 base_1, base_2, … (전부 접미, Rule 2) */
export function uniquifyResultKeys(baseKeys) {
  const freqs = {}
  for (const k of baseKeys) {
    const b = String(k)
    freqs[b] = (freqs[b] || 0) + 1
  }
  const seen = {}
  return baseKeys.map((k) => {
    const b = String(k)
    if (freqs[b] <= 1) return b
    seen[b] = (seen[b] || 0) + 1
    return `${b}_${seen[b]}`
  })
}

/** 그리드 컬럼 순서대로 SELECT AS·행 키와 동일한 결과 별칭 배열 */
export function computeUniquifiedOutputKeys(gridColumns, groupBy = [], dateGranularity = {}) {
  const bases = gridColumns.map((c) => baseResultKeyForColumn(c, groupBy, dateGranularity))
  return uniquifyResultKeys(bases)
}

/** 피벗 SELECT 열 순서와 동일하게 base 키 나열 (GROUP BY → 행집계 → 피벗값 → 전체) */
function collectPivotBaseKeys(gridColumns, groupBy, dateGranularity, pivot, pivotRowAggs) {
  const bases = []
  groupBy.forEach((g) => {
    const alias = getAlias(gridColumns, g.table)
    if (!alias) return
    const gc = gridColumns.find((c) => c.table === g.table && c.column === g.column)
    const col = gc || { table: g.table, column: g.column, alias }
    bases.push(baseResultKeyForColumn(col, groupBy, dateGranularity))
  })
  pivotRowAggs.forEach((agg) => {
    const alias = getAlias(gridColumns, agg.table)
    if (!alias) return
    const gc = gridColumns.find((c) => c.table === agg.table && c.column === agg.column)
    const col = gc ? { ...gc, aggFunc: agg.aggFunc } : { table: agg.table, column: agg.column, alias, aggFunc: agg.aggFunc }
    bases.push(baseResultKeyForColumn(col, groupBy, dateGranularity))
  })
  pivot.values.forEach((value) => bases.push(String(value)))
  bases.push('전체')
  return bases
}

/** 피벗 결과 행 객체의 키 순서와 동일 (generateSQL 피벗 SELECT AS 와 일치) */
export function computePivotOutputKeys(gridColumns, groupBy, dateGranularity, pivot, pivotRowAggs) {
  return uniquifyResultKeys(collectPivotBaseKeys(gridColumns, groupBy, dateGranularity, pivot, pivotRowAggs))
}

/**
 * PG COMMENT용 문자열: 최초 원천 테이블_컬럼 하나만 유지(후속 저장 테이블에서도 동일 문자열).
 * 1) 이미 PG에 코멘트가 있었던 컬럼(describe.logical_key → pgCommentRoot): 그대로 전달.
 * 2) 비어 있으면: sourceTable/sourceColumn → test_report col_n+label 추론 → 테이블_컬럼.
 * 저장 SELECT 별칭(uniquify)과는 무관.
 */
export function pgCommentSourceKey(c, groupBy) {
  if (!c) return null
  const preserved =
    c.pgCommentRoot ??
    c.pg_comment_root ??
    (c.logical_key != null && String(c.logical_key).trim() !== '' ? String(c.logical_key).trim() : null)
  if (preserved) {
    return preserved
  }
  const stRaw = c.sourceTable ?? c.source_table
  const scRaw = c.sourceColumn ?? c.source_column
  const st = stRaw != null && String(stRaw).trim() !== '' ? String(stRaw).trim() : null
  const sc = scRaw != null && String(scRaw).trim() !== '' ? String(scRaw).trim() : null
  const isGB = isGroupByColumn(groupBy, c.table, c.column)
  if (st && sc) {
    if (groupBy && groupBy.length > 0 && !isGB && c.aggFunc) {
      return selectOutputAliasAgg(c.aggFunc, st, sc)
    }
    return selectOutputAlias(st, sc)
  }
  const t = c.table != null ? String(c.table) : ''
  const col = c.column != null ? String(c.column) : ''
  if (t.startsWith(_SAVED_REPORT_PREFIX)) {
    const stable = stableSavedReportOutputKey(c)
    if (stable) return stable
  }
  if (groupBy && groupBy.length > 0 && !isGB && c.aggFunc) {
    return selectOutputAliasAgg(c.aggFunc, c.table, c.column)
  }
  return selectOutputAlias(c.table, c.column)
}

// 13. 전체 SELECT 쿼리 생성 (gridColumns, addedTables, filters, orderBy, tableRelationships, options)
export function generateSQL(
  gridColumns,
  addedTables,
  filters,
  orderBy,
  currentPage,
  pageSize,
  tableRelationships,
  options = {}
) {
  if (gridColumns.length === 0) throw new Error('최소 1개의 컬럼을 선택하세요')
  const { groupBy = [], dateGranularity = {}, havings = [], pivot = null, pivotRowAggs = [] } = options
  const hasPivot = pivot && pivot.values && pivot.values.length > 0
  const isGroupByActive = groupBy && groupBy.length > 0
  const saveAsKeys = options.saveAsTableSelectKeys

  let selectParts = []
  let saveKeyIdx = 0
  const pickSaveAs = () => {
    if (!saveAsKeys || saveKeyIdx >= saveAsKeys.length) return null
    const v = saveAsKeys[saveKeyIdx++]
    return v != null && String(v).trim() !== '' ? String(v).trim() : null
  }

  if (hasPivot) {
    // 피벗 모드: 기준축 + 행별집계 + CASE WHEN 피벗 + 전체
    const pivotAlias = getAlias(gridColumns, pivot.table)
    const aggCol = gridColumns.find((c) => c.aggFunc)
    const aggFunc = aggCol ? aggCol.aggFunc : 'COUNT'

    const pivotBases = saveAsKeys ? null : collectPivotBaseKeys(gridColumns, groupBy, dateGranularity, pivot, pivotRowAggs)
    const pivotOutKeys = pivotBases ? uniquifyResultKeys(pivotBases) : null
    let pki = 0

    groupBy.forEach((g) => {
      const alias = getAlias(gridColumns, g.table)
      if (!alias) return
      const expr = groupByExpression(alias, g.table, g.column, dateGranularity)
      const forced = pickSaveAs()
      const out =
        forced != null
          ? forced
          : pivotOutKeys
            ? pivotOutKeys[pki++]
            : resolveOutputLabel(gridColumns, g.table, g.column, groupBy, dateGranularity, null)
      selectParts.push(`${expr} AS ${quoteIdent(out)}`)
    })
    pivotRowAggs.forEach((agg) => {
      const alias = getAlias(gridColumns, agg.table)
      if (alias) {
        const forced = pickSaveAs()
        const out =
          forced != null
            ? forced
            : pivotOutKeys
              ? pivotOutKeys[pki++]
              : resolveOutputLabel(gridColumns, agg.table, agg.column, groupBy, dateGranularity, agg.aggFunc)
        selectParts.push(`${agg.aggFunc}(${alias}.${quoteIdent(agg.column)}) AS ${quoteIdent(out)}`)
      }
    })
    const pivotCol = gridColumns.find((c) => c.table === pivot.table && c.column === pivot.column)
    const pivotKey = `${pivot.table}.${pivot.column}`
    const isPivotDate = pivotCol && isPivotColumnDateType(pivotCol.type)
    const pivotGran = isPivotDate ? (dateGranularity[pivotKey] || 'YYYY-MM-DD') : null
    const pivotCompareExpr = pivotGran
      ? toCharByGran(`${pivotAlias}.${quoteIdent(pivot.column)}`, pivotGran)
      : `${pivotAlias}.${quoteIdent(pivot.column)}`
    pivot.values.forEach((value) => {
      const safeVal = String(value).replace(/'/g, "''")
      const forced = pickSaveAs()
      const out = forced != null ? forced : pivotOutKeys ? pivotOutKeys[pki++] : String(value)
      selectParts.push(
        `${aggFunc}(CASE WHEN ${pivotCompareExpr} = '${safeVal}' THEN 1 END) AS ${quoteIdent(out)}`
      )
    })
    const forcedTotal = pickSaveAs()
    const totalOut =
      forcedTotal != null ? forcedTotal : pivotOutKeys ? pivotOutKeys[pki++] : '전체'
    selectParts.push(`${aggFunc}(*) AS ${quoteIdent(totalOut)}`)
  } else {
    const outKeys = computeUniquifiedOutputKeys(gridColumns, groupBy, dateGranularity)
    selectParts = gridColumns.map((c, i) =>
      getSelectExpression(
        c,
        gridColumns,
        groupBy,
        dateGranularity,
        saveAsKeys && saveAsKeys[i] != null && String(saveAsKeys[i]).trim() !== ''
          ? String(saveAsKeys[i]).trim()
          : outKeys[i]
      )
    )
  }

  let sql = `SELECT\n    ${selectParts.join(',\n    ')}`
  const firstTable = addedTables[0]
  sql += `\nFROM ${quoteIdent(firstTable)} AS t1`
  const joinConfigs = options.joinConfigs || {}
  const joinOrder = options.joinOrder || []
  const stepByTable = {}
  joinOrder.forEach((step) => {
    if (step && step.table) stepByTable[step.table] = step
  })
  for (let i = 1; i < addedTables.length; i++) {
    const currTable = addedTables[i]
    const step = stepByTable[currTable]
    const fromTable = resolveJoinParentTable(i, currTable, addedTables, step, tableRelationships, joinConfigs)
    const fromIdx = addedTables.indexOf(fromTable)
    const prevAliasIdx = fromIdx >= 0 ? fromIdx : i - 1
    const key = `${fromTable}||${currTable}`
    const config = joinConfigs[key]
    const joinType = (config?.joinType || 'LEFT').toUpperCase()
    const rawConditions = config?.conditions?.length ? config.conditions : null
    const conditions = rawConditions?.length ? dedupeConditions(rawConditions) : null
    let joinKey = conditions?.length ? null : getJoinKey(tableRelationships, fromTable, currTable)
    if (!joinKey && step && step.from_column && step.to_column) {
      joinKey = { prevColumn: step.from_column, currColumn: step.to_column }
    }
    if (conditions && conditions.length > 0) {
      const op = (config.logicalOperator || 'AND').toUpperCase()
      const onClause = conditions
        .map((c) => `t${prevAliasIdx + 1}.${quoteIdent(c.prevColumn)} = t${i + 1}.${quoteIdent(c.currColumn)}`)
        .join(` ${op} `)
      sql += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      sql += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON t${prevAliasIdx + 1}.${quoteIdent(joinKey.prevColumn)} = t${i + 1}.${quoteIdent(joinKey.currColumn)}`
    } else {
      throw new Error(`JOIN 관계 없음: ${fromTable} - ${currTable} (조인 조건 선택 필요)`)
    }
  }

  const whereClauses = filters
    .map((f) => {
      const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
      if (!c) return null
      return buildOneWhereClause(f, c)
    })
    .filter(Boolean)
  if (whereClauses.length > 0) sql += `\nWHERE ${joinWhereClauses(whereClauses, filters)}`

  if (isGroupByActive) {
    const gbClauses = groupBy
      .map((g) => {
        const alias = getAlias(gridColumns, g.table)
        return alias ? groupByExpression(alias, g.table, g.column, dateGranularity) : null
      })
      .filter(Boolean)
    if (gbClauses.length > 0) {
      sql += `\nGROUP BY ${gbClauses.join(', ')}`
        if (havings.length > 0) {
          const havingClauses = havings
            .map((h) => {
              const alias = getAlias(gridColumns, h.table)
              if (!alias) return null
              return `${h.aggFunc}(${alias}.${quoteIdent(h.column)}) ${h.operator} ${h.value}`
            })
            .filter(Boolean)
          if (havingClauses.length > 0) sql += `\nHAVING ${joinWhereClauses(havingClauses, havings)}`
        }
    }
  }

  const validOrderBy = orderBy.filter((ob) => ob.columnIndex >= 0 && gridColumns[ob.columnIndex])
  if (validOrderBy.length > 0) {
    sql += `\nORDER BY ${validOrderBy
      .map((ob) => {
        const e = getOrderByExpression(ob, gridColumns, groupBy)
        return e ? `${e} ${ob.dir}` : null
      })
      .filter(Boolean)
      .join(', ')}`
  }

  const saveFullMaterialize =
    Array.isArray(saveAsKeys) && saveAsKeys.length > 0
  if (saveFullMaterialize) {
    sql += ';'
  } else {
    const offset = (currentPage - 1) * pageSize
    sql += `\nLIMIT ${pageSize} OFFSET ${offset};`
  }
  return sql
}

// 14. COUNT(*) 쿼리 생성 (GROUP BY 시 서브쿼리)
export function generateCountSQL(
  gridColumns,
  addedTables,
  filters,
  tableRelationships,
  options = {}
) {
  if (gridColumns.length === 0) return null
  const { groupBy = [], dateGranularity = {}, havings = [] } = options
  const isGroupByActive = groupBy && groupBy.length > 0

  const firstTable = addedTables[0]
  const joinConfigs = options.joinConfigs || {}
  const joinOrder = options.joinOrder || []
  const stepByTable = {}
  joinOrder.forEach((step) => {
    if (step && step.table) stepByTable[step.table] = step
  })
  let joinClauses = ''
  for (let i = 1; i < addedTables.length; i++) {
    const currTable = addedTables[i]
    const step = stepByTable[currTable]
    const fromTable = resolveJoinParentTable(i, currTable, addedTables, step, tableRelationships, joinConfigs)
    const fromIdx = addedTables.indexOf(fromTable)
    const prevAliasIdx = fromIdx >= 0 ? fromIdx : i - 1
    const key = `${fromTable}||${currTable}`
    const config = joinConfigs[key]
    const joinType = (config?.joinType || 'LEFT').toUpperCase()
    const rawConditions = config?.conditions?.length ? config.conditions : null
    const conditions = rawConditions?.length ? dedupeConditions(rawConditions) : null
    let joinKey = conditions?.length ? null : getJoinKey(tableRelationships, fromTable, currTable)
    if (!joinKey && step && step.from_column && step.to_column) {
      joinKey = { prevColumn: step.from_column, currColumn: step.to_column }
    }
    if (conditions && conditions.length > 0) {
      const op = (config.logicalOperator || 'AND').toUpperCase()
      const onClause = conditions
        .map((c) => `t${prevAliasIdx + 1}.${quoteIdent(c.prevColumn)} = t${i + 1}.${quoteIdent(c.currColumn)}`)
        .join(` ${op} `)
      joinClauses += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      joinClauses += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON t${prevAliasIdx + 1}.${quoteIdent(joinKey.prevColumn)} = t${i + 1}.${quoteIdent(joinKey.currColumn)}`
    } else {
      return null
    }
  }

  const whereClauses = filters
    .map((f) => {
      const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
      if (!c) return null
      return buildOneWhereClause(f, c)
    })
    .filter(Boolean)
  const whereStr = whereClauses.length > 0 ? `\nWHERE ${joinWhereClauses(whereClauses, filters)}` : ''

  if (isGroupByActive) {
    const gbClauses = groupBy
      .map((g) => {
        const alias = getAlias(gridColumns, g.table)
        return alias ? groupByExpression(alias, g.table, g.column, dateGranularity) : null
      })
      .filter(Boolean)
    if (gbClauses.length === 0) return null
    let havingStr = ''
    if (havings.length > 0) {
      const havingClauses = havings
        .map((h) => {
          const alias = getAlias(gridColumns, h.table)
          if (!alias) return null
          return `${h.aggFunc}(${alias}.${quoteIdent(h.column)}) ${h.operator} ${h.value}`
        })
        .filter(Boolean)
      if (havingClauses.length > 0) havingStr = `\nHAVING ${joinWhereClauses(havingClauses, havings)}`
    }
    return `SELECT COUNT(*) as total FROM (\nSELECT ${gbClauses.join(', ')}\nFROM ${quoteIdent(firstTable)} AS t1${joinClauses}${whereStr}\nGROUP BY ${gbClauses.join(', ')}${havingStr}\n) AS _grp;`
  }

  return `SELECT COUNT(*) as total\nFROM ${quoteIdent(firstTable)} AS t1${joinClauses}${whereStr};`
}

// 15. 피벗축이 날짜 컬럼인지 (타입 기준)
function isPivotColumnDateType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2'
}

// 16. 피벗 축 값 조회용 DISTINCT 쿼리 생성. 날짜 컬럼 시 dateGranularity·filters 반영
export function generateDistinctPivotSQL(table, column, gridColumns, addedTables, filters, tableRelationships, joinConfigsOrOpts = {}) {
  const joinConfigs = joinConfigsOrOpts && typeof joinConfigsOrOpts.joinConfigs !== 'undefined'
    ? joinConfigsOrOpts.joinConfigs
    : joinConfigsOrOpts
  const dateGranularity = (joinConfigsOrOpts && joinConfigsOrOpts.dateGranularity) || {}
  const joinOrder = (joinConfigsOrOpts && joinConfigsOrOpts.joinOrder) || []
  const stepByTable = {}
  joinOrder.forEach((step) => { if (step && step.table) stepByTable[step.table] = step })

  const col = gridColumns.find((c) => c.table === table && c.column === column)
  const alias = col?.alias
  if (!alias || !addedTables.length) return null

  const pivotKey = `${table}.${column}`
  const isDate = col && isPivotColumnDateType(col.type)
  const gran = isDate ? (dateGranularity[pivotKey] || 'YYYY-MM-DD') : null
  const pivotSelectExpr = gran
    ? toCharByGran(`${alias}.${quoteIdent(column)}`, gran)
    : `${alias}.${quoteIdent(column)}`
  const pivotSelectAlias = quoteIdent(computeUniquifiedOutputKeys([col], [], dateGranularity)[0])

  let sql = `SELECT DISTINCT ${pivotSelectExpr} AS ${pivotSelectAlias}\nFROM ${quoteIdent(addedTables[0])} AS t1`
  for (let i = 1; i < addedTables.length; i++) {
    const currTable = addedTables[i]
    const step = stepByTable[currTable]
    const fromTable = resolveJoinParentTable(i, currTable, addedTables, step, tableRelationships, joinConfigs)
    const fromIdx = addedTables.indexOf(fromTable)
    const prevAliasIdx = fromIdx >= 0 ? fromIdx : i - 1
    const key = `${fromTable}||${currTable}`
    const config = joinConfigs[key]
    const joinType = (config?.joinType || 'LEFT').toUpperCase()
    const rawConditions = config?.conditions?.length ? config.conditions : null
    const conditions = rawConditions?.length ? dedupeConditions(rawConditions) : null
    let joinKey = conditions?.length ? null : getJoinKey(tableRelationships, fromTable, currTable)
    if (!joinKey && step && step.from_column && step.to_column) {
      joinKey = { prevColumn: step.from_column, currColumn: step.to_column }
    }
    if (conditions && conditions.length > 0) {
      const op = (config.logicalOperator || 'AND').toUpperCase()
      const onClause = conditions
        .map((c) => `t${prevAliasIdx + 1}.${quoteIdent(c.prevColumn)} = t${i + 1}.${quoteIdent(c.currColumn)}`)
        .join(` ${op} `)
      sql += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      sql += `\n${joinType} JOIN ${quoteIdent(currTable)} AS t${i + 1} ON t${prevAliasIdx + 1}.${quoteIdent(joinKey.prevColumn)} = t${i + 1}.${quoteIdent(joinKey.currColumn)}`
    } else {
      return null
    }
  }
  const pivotWhereClauses = [
    `${alias}.${quoteIdent(column)} IS NOT NULL`,
    ...filters
      .map((f) => {
        const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
        if (!c) return null
        return buildOneWhereClause(f, c)
      })
      .filter(Boolean)
  ]
  const conns = [{ logicalOperator: 'AND' }, ...filters.map((f) => ({ logicalOperator: f.logicalOperator || 'AND' }))].slice(0, Math.max(0, pivotWhereClauses.length - 1))
  sql += `\nWHERE ${joinWhereClauses(pivotWhereClauses, conns)}`
  sql += `\nORDER BY ${pivotSelectExpr}\nLIMIT 20`
  return sql
}

/** @deprecated 예전 col_n 명명. 저장 테이블 물리 컬럼명은 이제 결과 별칭(innerKeys)과 동일 */
export function savePhysicalColumnName(ordinal1Based) {
  return `col_${ordinal1Based}`
}

/**
 * 테이블 저장용: 서브쿼리 SELECT 별칭(innerKeys, 겹치면 _1, _2) + column_comment_hints.
 * logical_key 는 PG COMMENT용(원본 테이블_컬럼 / 집계는 AGG_테이블_컬럼)만 넣고, 별칭(uniquify)과 분리한다.
 * 피벗 모드일 때는 COMMENT 힌트를 넣지 않는다(컬럼명이 피벗 규칙으로 이미 구분됨).
 * 저장 시 generateSQL(..., { saveAsTableSelectKeys: innerKeys }) 로 inner SQL 과 맞출 것(LIMIT/OFFSET 없음).
 * 물리 컬럼명은 col_n 이 아니라 innerKeys(uniquify 된 결과 별칭)와 동일 — 원본 조회 결과 열 이름 유지.
 */
export function buildSaveTableColumnPlan(gridColumns, groupBy, dateGranularity, options = {}) {
  const { pivot = null, pivotRowAggs = [] } = options
  const hasPivot = pivot && pivot.values && pivot.values.length > 0
  const metaRows = []

  if (hasPivot) {
    const aggCol = gridColumns.find((c) => c.aggFunc)
    const aggFunc = aggCol ? aggCol.aggFunc : 'COUNT'

    groupBy.forEach((g) => {
      const baseKey = resolveOutputLabel(gridColumns, g.table, g.column, groupBy, dateGranularity, null)
      metaRows.push({
        baseKey,
        comment: null,
        source_table: g.table,
        source_column: g.column,
        role: 'group_by',
      })
    })
    pivotRowAggs.forEach((agg) => {
      const alias = getAlias(gridColumns, agg.table)
      if (!alias) return
      const baseKey = resolveOutputLabel(gridColumns, agg.table, agg.column, groupBy, dateGranularity, agg.aggFunc)
      metaRows.push({
        baseKey,
        comment: null,
        source_table: agg.table,
        source_column: agg.column,
        role: 'pivot_row_agg',
        agg_func: agg.aggFunc,
      })
    })
    pivot.values.forEach((value) => {
      const baseKey = String(value)
      metaRows.push({
        baseKey,
        comment: null,
        source_table: pivot.table,
        source_column: pivot.column,
        role: 'pivot_value',
        pivot_value: baseKey,
        agg_func: aggFunc,
      })
    })
    metaRows.push({
      baseKey: '전체',
      comment: null,
      source_table: null,
      source_column: null,
      role: 'pivot_total',
      agg_func: aggFunc,
    })
  } else {
    gridColumns.forEach((c) => {
      const baseKey = baseResultKeyForColumn(c, groupBy, dateGranularity)
      const comment = pgCommentSourceKey(c, groupBy)
      metaRows.push({
        baseKey,
        comment,
        source_table: c.table,
        source_column: c.column,
        role: null,
        agg_func: c.aggFunc,
      })
    })
  }

  const baseInnerKeys = metaRows.map((r) => r.baseKey)
  const innerKeys = uniquifyResultKeys(baseInnerKeys)
  const column_comment_hints = metaRows.map((row, i) => ({
    ordinal: i + 1,
    physical_name: String(innerKeys[i]),
    logical_key: row.comment != null && String(row.comment).trim() !== '' ? String(row.comment).trim() : null,
    source_table: row.source_table,
    source_column: row.source_column,
    role: row.role,
    agg_func: row.agg_func,
    pivot_value: row.pivot_value,
  }))
  return { innerKeys, column_comment_hints }
}

/**
 * CREATE TABLE AS 에 넣을 SELECT: 서브쿼리 결과 열명(innerKeys)을 그대로 물리 컬럼명으로 노출.
 */
export function buildSaveTableMaterializedSelect(innerSql, innerKeys) {
  const trimmed = String(innerSql || '')
    .trim()
    .replace(/;+\s*$/u, '')
  const parts = innerKeys.map((lk) => {
    const q = quoteIdent(String(lk))
    return `_qs_inner.${q} AS ${q}`
  })
  return `SELECT\n    ${parts.join(',\n    ')}\nFROM (\n${trimmed}\n) AS _qs_inner`
}
