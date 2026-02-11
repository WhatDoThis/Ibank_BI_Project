/**
 * report/utils/relationshipDiagram.js (테이블 관계도 텍스트·Mermaid)
 * ==================================================================
 * joinOrder 또는 relationshipOptions + addedTables로 족보 형태 관계도 텍스트·Mermaid 생성. MainArea 관계도 패널용.
 *
 * [Main Functions]
 * ===========
 * - buildRelationshipTree: joinOrder, addedTables → { lines, baseTable } (트리 라인 배열)
 * - buildRelationshipMermaid: joinOrder, addedTables → Mermaid ER 텍스트
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - buildRelationshipTree, buildRelationshipMermaid (export)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

/**
 * joinOrder 기준으로 부모→자식 트리 라인 생성 (해당 테이블 기준 관계도)
 * @param {Array<{ table: string, from_table?: string, to_table?: string, from_column?: string, to_column?: string }>} joinOrder
 * @param {string[]} addedTables
 * @returns {{ lines: string[], baseTable: string|null }}
 */
export function buildRelationshipTree(joinOrder, addedTables) {
  const lines = []
  if (!addedTables?.length) {
    return { lines: ['테이블을 추가하면 관계도가 표시됩니다.'], baseTable: null }
  }
  const base = addedTables[0]
  if (!joinOrder?.length) {
    lines.push(`${base} (기준)`)
    if (addedTables.length > 1) {
      addedTables.slice(1).forEach((t, i) => {
        lines.push(`  ${i === addedTables.length - 2 ? '└' : '├'}── ${t}`)
      })
    }
    return { lines, baseTable: base }
  }
  const childrenByParent = new Map()
  joinOrder.forEach((step) => {
    const from = step.from_table
    const to = step.table || step.to_table
    const col = step.to_column || step.from_column
    if (!from || !to) return
    if (!childrenByParent.has(from)) childrenByParent.set(from, [])
    childrenByParent.get(from).push({ table: to, column: col })
  })

  function renderNode(table, column, depth, isLast) {
    const prefix = depth === 0 ? '' : '  '.repeat(depth) + (isLast ? '└── ' : '├── ')
    const label = depth === 0 ? `${table} (기준)` : `${table}${column ? ` (${column})` : ''}`
    lines.push(prefix + label)
    const children = childrenByParent.get(table) || []
    children.forEach((c, i) => {
      renderNode(c.table, c.column, depth + 1, i === children.length - 1)
    })
  }
  renderNode(base, null, 0, false)
  return { lines, baseTable: base }
}

/**
 * Mermaid ER 스타일 관계도 문자열 생성 (복사용)
 * @param {Array<{ table: string, from_table?: string, to_table?: string }>} joinOrder
 * @param {string[]} addedTables
 * @returns {string}
 */
export function buildRelationshipMermaid(joinOrder, addedTables) {
  if (!addedTables?.length) return ''
  const edges = []
  if (joinOrder?.length) {
    joinOrder.forEach((step) => {
      const from = step.from_table
      const to = step.table || step.to_table
      if (from && to) edges.push({ from, to })
    })
  } else {
    for (let i = 0; i < addedTables.length - 1; i++) {
      edges.push({ from: addedTables[i], to: addedTables[i + 1] })
    }
  }
  const quote = (s) => (/_/.test(s) ? `"${s}"` : s)
  const lines = ['erDiagram', '']
  edges.forEach(({ from, to }) => {
    lines.push(`    ${quote(from)} ||--o{ ${quote(to)} : ""`)
  })
  return lines.join('\n')
}
