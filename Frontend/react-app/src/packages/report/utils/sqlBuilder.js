/**
 * report/utils/sqlBuilder.js (SQL 생성 유틸)
 * ===========================================
 * generateSQL, generateCountSQL, getJoinKey. 리포트(쿼리 빌더) 전용.
 *
 * [주요 기능]
 * - getJoinKey: 테이블 관계(FK 또는 동일 컬럼·타입)로 JOIN 키 반환
 * - generateSQL: SELECT + JOIN + WHERE + [GROUP BY + HAVING] + ORDER BY + LIMIT/OFFSET (피벗/날짜단위/집계 지원)
 * - generateCountSQL: COUNT(*) 쿼리 (GROUP BY 시 서브쿼리)
 *
 * [옵션] generateSQL/generateCountSQL 8번째 인자 options: { groupBy, dateGranularity, havings, pivot, pivotRowAggs }
 *
 * [의존성]
 * - 없음
 */

/**
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @param {string} prevTable
 * @param {string} currTable
 */
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
    pivot.values.forEach((value) => {
      const safeVal = String(value).replace(/'/g, "''")
      selectParts.push(
        `${aggFunc}(CASE WHEN ${pivotAlias}.${pivot.column} = '${safeVal}' THEN 1 END) AS "${value}"`
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
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const joinKey = getJoinKey(tableRelationships, prevTable, currTable)
    if (!joinKey) throw new Error(`JOIN 관계 없음: ${prevTable} - ${currTable} (조인 조건 선택 필요)`)
    sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
  }

  const whereClauses = filters
    .map((f) => {
      const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
      if (!c) return null
      const val = escapeValueForSql(f.value, f.operator)
      return `${c.alias}.${c.column} ${f.operator} ${val}`
    })
    .filter(Boolean)
  if (whereClauses.length > 0) sql += `\nWHERE ${whereClauses.join('\n  AND ')}`

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
        if (havingClauses.length > 0) sql += `\nHAVING ${havingClauses.join('\n   AND ')}`
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
  let joinClauses = ''
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const joinKey = getJoinKey(tableRelationships, prevTable, currTable)
    if (!joinKey) return null
    joinClauses += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
  }

  const whereClauses = filters
    .map((f) => {
      const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
      if (!c) return null
      const val = escapeValueForSql(f.value, f.operator)
      return `${c.alias}.${c.column} ${f.operator} ${val}`
    })
    .filter(Boolean)
  const whereStr = whereClauses.length > 0 ? `\nWHERE ${whereClauses.join('\n  AND ')}` : ''

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
      if (havingClauses.length > 0) havingStr = `\nHAVING ${havingClauses.join('\n   AND ')}`
    }
    return `SELECT COUNT(*) as total FROM (\nSELECT ${gbClauses.join(', ')}\nFROM ${firstTable} AS t1${joinClauses}${whereStr}\nGROUP BY ${gbClauses.join(', ')}${havingStr}\n) AS _grp;`
  }

  return `SELECT COUNT(*) as total\nFROM ${firstTable} AS t1${joinClauses}${whereStr};`
}

/**
 * 피벗 축 값 조회용 DISTINCT 쿼리 생성
 * @param {string} table
 * @param {string} column
 * @param {{ table: string, column: string, alias: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 */
export function generateDistinctPivotSQL(table, column, gridColumns, addedTables, filters, tableRelationships) {
  const alias = gridColumns.find((c) => c.table === table)?.alias
  if (!alias || !addedTables.length) return null
  let sql = `SELECT DISTINCT ${alias}.${column}\nFROM ${addedTables[0]} AS t1`
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const joinKey = getJoinKey(tableRelationships, prevTable, currTable)
    if (!joinKey) return null
    sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
  }
  const whereClauses = [
    `${alias}.${column} IS NOT NULL`,
    ...filters
      .map((f) => {
        const c = gridColumns.find((col) => col.table === f.table && col.column === f.column)
        if (!c) return null
        const val = escapeValueForSql(f.value, f.operator)
        return `${c.alias}.${c.column} ${f.operator} ${val}`
      })
      .filter(Boolean)
  ]
  sql += `\nWHERE ${whereClauses.join('\n  AND ')}`
  sql += `\nORDER BY ${alias}.${column}\nLIMIT 20`
  return sql
}
