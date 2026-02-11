/**
 * report/utils/sqlBuilder.js (SQL 생성 유틸)
 * ===========================================
 * 리포트 쿼리 빌더 전용. SELECT/JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT 생성.
 *
 * [주요 함수]
 * - getJoinKey: 테이블 관계로 JOIN 키 반환
 * - generateSQL: 전체 SELECT 쿼리 (피벗·날짜단위·집계 지원)
 * - generateCountSQL: COUNT(*) 쿼리 (GROUP BY 시 서브쿼리)
 *
 * [의존성]
 * - 없음
 */

/**
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @param {string} prevTable
 * @param {string} currTable
 */
/** ON 조건 배열에서 (prevColumn, currColumn) 기준 중복 제거 → 중복 JOIN 조건 방지 */
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

export function getJoinKey(tableRelationships, prevTable, currTable) {
  const rel = tableRelationships[prevTable]?.[currTable]
  if (rel && rel.prevColumn != null && rel.currColumn != null) return rel
  const rev = tableRelationships[currTable]?.[prevTable]
  if (rev && rev.prevColumn != null && rev.currColumn != null)
    return { prevColumn: rev.currColumn, currColumn: rev.prevColumn }
  return null
}

function escapeValueForSql(val, operator) {
  if (operator === 'LIKE') return `'%${String(val).replace(/'/g, "''")}%'`
  if (!Number.isNaN(Number(val)) && String(val).trim() !== '') return val
  return `'${String(val).replace(/'/g, "''")}'`
}

/** 단일 값 SQL 이스케이프 (IN/BETWEEN용) */
function escapeSingle(val) {
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'null') return 'NULL'
  if (!Number.isNaN(Number(s))) return s
  return `'${String(s).replace(/'/g, "''")}'`
}

/**
 * 필터 하나에 대한 WHERE 절 조각 생성 (IS NULL, IN, BETWEEN 등 지원)
 * @param {{ table: string, column: string, operator: string, value: string }} f
 * @param {{ alias: string, column: string }} c
 */
function buildOneWhereClause(f, c) {
  const colExpr = `${c.alias}.${c.column}`
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

/** WHERE 절 배열을 logicalOperator로 연결 (filters[i].logicalOperator = i번과 i+1번 사이 연결) */
function joinWhereClauses(clauses, filters) {
  if (clauses.length === 0) return ''
  if (clauses.length === 1) return clauses[0]
  return clauses.reduce((acc, cl, i) => (i === 0 ? cl : `${acc} ${(filters[i - 1].logicalOperator || 'AND')} ${cl}`), '')
}

function getAlias(gridColumns, table) {
  const c = gridColumns.find((col) => col.table === table)
  return c ? c.alias : null
}

function isGroupByColumn(groupBy, table, column) {
  if (!groupBy || !groupBy.length) return false
  return groupBy.some((g) => g.table === table && g.column === column)
}

/** GROUP BY 절에 쓸 컬럼 표현식 (날짜 단위 적용) */
function groupByExpression(alias, table, column, dateGranularity) {
  let expr = `${alias}.${column}`
  const key = `${table}.${column}`
  const gran = dateGranularity && dateGranularity[key]
  if (gran === 'YYYY') expr = `TO_CHAR(${expr}, 'YYYY')`
  else if (gran === 'YYYY-MM') expr = `TO_CHAR(${expr}, 'YYYY-MM')`
  else if (gran === 'YYYY-MM-DD') expr = `TO_CHAR(${expr}, 'YYYY-MM-DD')`
  return expr
}

/** SELECT 절 단일 컬럼 표현식 (날짜 단위 + 집계) */
function getSelectExpression(col, gridColumns, groupBy, dateGranularity) {
  const alias = col.alias
  let base = `${alias}.${col.column}`
  const key = `${col.table}.${col.column}`
  const gran = dateGranularity && dateGranularity[key]
  if (gran === 'YYYY') base = `TO_CHAR(${base}, 'YYYY')`
  else if (gran === 'YYYY-MM') base = `TO_CHAR(${base}, 'YYYY-MM')`
  else if (gran === 'YYYY-MM-DD') base = `TO_CHAR(${base}, 'YYYY-MM-DD')`

  const isGB = isGroupByColumn(groupBy, col.table, col.column)
  if (groupBy && groupBy.length > 0 && !isGB && col.aggFunc) {
    return `${col.aggFunc}(${base}) AS "${col.aggFunc}(${alias}.${col.column})"`
  }
  // 날짜 단위 적용 시 결과 컬럼명을 alias.column 으로 고정해 그리드에서 row[key]로 조회 가능하게 함
  if (gran) return `${base} AS "${alias}.${col.column}"`
  return base
}

/** ORDER BY 절 표현식 (집계 시 agg 반영) */
function getOrderByExpression(ob, gridColumns, groupBy) {
  const c = gridColumns[ob.columnIndex]
  if (!c) return null
  const alias = c.alias
  const isGB = isGroupByColumn(groupBy, c.table, c.column)
  if (groupBy && groupBy.length > 0 && !isGB && c.aggFunc) {
    return `${c.aggFunc}(${alias}.${c.column})`
  }
  return `${alias}.${c.column}`
}

/**
 * @param {{ table: string, column: string, alias: string, type?: string, aggFunc?: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {{ columnIndex: number, dir: string }[]} orderBy
 * @param {number} currentPage
 * @param {number} pageSize
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @param {{ groupBy?: { table: string, column: string }[], dateGranularity?: Record<string, string>, havings?: { table: string, column: string, aggFunc: string, operator: string, value: string }[], pivot?: { table: string, column: string, values: unknown[] }, pivotRowAggs?: { table: string, column: string, aggFunc: string }[] }} options
 */
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

  let selectParts = []

  if (hasPivot) {
    // 피벗 모드: 기준축 + 행별집계 + CASE WHEN 피벗 + 전체
    const pivotAlias = getAlias(gridColumns, pivot.table)
    const aggCol = gridColumns.find((c) => c.aggFunc)
    const aggFunc = aggCol ? aggCol.aggFunc : 'COUNT'

    groupBy.forEach((g) => {
      const alias = getAlias(gridColumns, g.table)
      if (!alias) return
      const expr = groupByExpression(alias, g.table, g.column, dateGranularity)
      const gKey = `${g.table}.${g.column}`
      const gran = dateGranularity[gKey]
      selectParts.push(gran ? `${expr} AS "${alias}.${g.column}"` : expr)
    })
    pivotRowAggs.forEach((agg) => {
      const alias = getAlias(gridColumns, agg.table)
      if (alias) selectParts.push(`${agg.aggFunc}(${alias}.${agg.column}) AS "${agg.aggFunc}(${agg.column})"`)
    })
    const pivotCol = gridColumns.find((c) => c.table === pivot.table && c.column === pivot.column)
    const pivotKey = `${pivot.table}.${pivot.column}`
    const isPivotDate = pivotCol && isPivotColumnDateType(pivotCol.type)
    const pivotGran = isPivotDate ? (dateGranularity[pivotKey] || 'YYYY-MM-DD') : null
    const pivotCompareExpr = pivotGran ? `TO_CHAR(${pivotAlias}.${pivot.column}, '${pivotGran}')` : `${pivotAlias}.${pivot.column}`
    pivot.values.forEach((value) => {
      const safeVal = String(value).replace(/'/g, "''")
      selectParts.push(
        `${aggFunc}(CASE WHEN ${pivotCompareExpr} = '${safeVal}' THEN 1 END) AS "${value}"`
      )
    })
    selectParts.push(`${aggFunc}(*) AS "전체"`)
  } else {
    selectParts = gridColumns.map((c) =>
      getSelectExpression(c, gridColumns, groupBy, dateGranularity)
    )
  }

  let sql = `SELECT\n    ${selectParts.join(',\n    ')}`
  const firstTable = addedTables[0]
  sql += `\nFROM ${firstTable} AS t1`
  const joinConfigs = options.joinConfigs || {}
  const joinOrder = options.joinOrder || []
  const stepByTable = {}
  joinOrder.forEach((step) => {
    if (step && step.table) stepByTable[step.table] = step
  })
  for (let i = 1; i < addedTables.length; i++) {
    const currTable = addedTables[i]
    const step = stepByTable[currTable]
    const fromTable = (step && step.from_table) ? step.from_table : addedTables[i - 1]
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
        .map((c) => `t${prevAliasIdx + 1}.${c.prevColumn} = t${i + 1}.${c.currColumn}`)
        .join(` ${op} `)
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON t${prevAliasIdx + 1}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
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
              return `${h.aggFunc}(${alias}.${h.column}) ${h.operator} ${h.value}`
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

  const offset = (currentPage - 1) * pageSize
  sql += `\nLIMIT ${pageSize} OFFSET ${offset};`
  return sql
}

/**
 * @param {{ table: string, column: string, alias: string, aggFunc?: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @param {{ groupBy?: { table: string, column: string }[], dateGranularity?: Record<string, string>, havings?: { table: string, column: string, aggFunc: string, operator: string, value: string }[] }} options
 */
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
    const fromTable = (step && step.from_table) ? step.from_table : addedTables[i - 1]
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
        .map((c) => `t${prevAliasIdx + 1}.${c.prevColumn} = t${i + 1}.${c.currColumn}`)
        .join(` ${op} `)
      joinClauses += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      joinClauses += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON t${prevAliasIdx + 1}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
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
          return `${h.aggFunc}(${alias}.${h.column}) ${h.operator} ${h.value}`
        })
        .filter(Boolean)
      if (havingClauses.length > 0) havingStr = `\nHAVING ${joinWhereClauses(havingClauses, havings)}`
    }
    return `SELECT COUNT(*) as total FROM (\nSELECT ${gbClauses.join(', ')}\nFROM ${firstTable} AS t1${joinClauses}${whereStr}\nGROUP BY ${gbClauses.join(', ')}${havingStr}\n) AS _grp;`
  }

  return `SELECT COUNT(*) as total\nFROM ${firstTable} AS t1${joinClauses}${whereStr};`
}

/** 피벗축이 날짜 컬럼인지 (타입 기준) */
function isPivotColumnDateType(colType) {
  if (!colType) return false
  const t = String(colType).toLowerCase()
  return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2'
}

/**
 * 피벗 축 값 조회용 DISTINCT 쿼리 생성.
 * 날짜 컬럼인 경우 dateGranularity(연/연월/연월일)와 걸린 조건(filters)을 반영한다.
 * @param {string} table
 * @param {string} column
 * @param {{ table: string, column: string, alias: string, type?: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @param {{ joinConfigs?: object, dateGranularity?: Record<string, string> }} opts - joinConfigs 또는 { joinConfigs, dateGranularity }
 */
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
    ? `TO_CHAR(${alias}.${column}, '${gran}')`
    : `${alias}.${column}`
  const pivotSelectAlias = `"${alias}.${column}"`

  let sql = `SELECT DISTINCT ${pivotSelectExpr} AS ${pivotSelectAlias}\nFROM ${addedTables[0]} AS t1`
  for (let i = 1; i < addedTables.length; i++) {
    const currTable = addedTables[i]
    const step = stepByTable[currTable]
    const fromTable = (step && step.from_table) ? step.from_table : addedTables[i - 1]
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
        .map((c) => `t${prevAliasIdx + 1}.${c.prevColumn} = t${i + 1}.${c.currColumn}`)
        .join(` ${op} `)
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON t${prevAliasIdx + 1}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
    } else {
      return null
    }
  }
  const pivotWhereClauses = [
    `${alias}.${column} IS NOT NULL`,
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
