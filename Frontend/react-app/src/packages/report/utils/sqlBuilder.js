/**
 * report/utils/sqlBuilder.js (SQL 생성 유틸)
 * ===========================================
 * generateSQL, generateCountSQL, getJoinKey. 리포트(쿼리 빌더) 전용.
 *
 * [주요 기능]
 * - getJoinKey: FK 관계로 JOIN 키 반환
 * - generateSQL: SELECT + JOIN + WHERE + ORDER BY + LIMIT/OFFSET
 * - generateCountSQL: COUNT(*) 쿼리
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

/**
 * @param {{ table: string, column: string, alias: string, type: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {{ columnIndex: number, dir: string }[]} orderBy
 * @param {number} currentPage
 * @param {number} pageSize
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 */
export function generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships) {
  if (gridColumns.length === 0) throw new Error('최소 1개의 컬럼을 선택하세요')
  const selectClauses = gridColumns.map((c) => `${c.alias}.${c.column}`)
  let sql = `SELECT\n    ${selectClauses.join(',\n    ')}`
  const firstTable = addedTables[0]
  sql += `\nFROM ${firstTable} AS t1`
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const joinKey = getJoinKey(tableRelationships, prevTable, currTable)
    if (!joinKey) throw new Error(`JOIN 관계 없음: ${prevTable} - ${currTable} (FK만 가능)`)
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
  const validOrderBy = orderBy.filter((ob) => ob.columnIndex >= 0 && gridColumns[ob.columnIndex])
  if (validOrderBy.length > 0) {
    sql += `\nORDER BY ${validOrderBy.map((ob) => {
      const c = gridColumns[ob.columnIndex]
      return `${c.alias}.${c.column} ${ob.dir}`
    }).join(', ')}`
  }
  const offset = (currentPage - 1) * pageSize
  sql += `\nLIMIT ${pageSize} OFFSET ${offset};`
  return sql
}

/**
 * @param {{ table: string, column: string, alias: string }[]} gridColumns
 * @param {string[]} addedTables
 * @param {{ table: string, column: string, operator: string, value: string }[]} filters
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 */
export function generateCountSQL(gridColumns, addedTables, filters, tableRelationships) {
  if (gridColumns.length === 0) return null
  let sql = 'SELECT COUNT(*) as total'
  const firstTable = addedTables[0]
  sql += `\nFROM ${firstTable} AS t1`
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const joinKey = getJoinKey(tableRelationships, prevTable, currTable)
    if (!joinKey) return null
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
  sql += ';'
  return sql
}
