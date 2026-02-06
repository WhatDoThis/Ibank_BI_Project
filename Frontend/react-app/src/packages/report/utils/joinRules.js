/**
 * report/utils/joinRules.js
 * 부모 테이블 없이 n:n 자동 추가 방지용 규칙.
 * - canAddTableByColumn: 컬럼 추가 시 해당 테이블을 addedTables에 넣어도 되는지
 * - findIntermediateParent: 같은 부모_id 쓰는 두 테이블일 때 끼워 넣을 부모 테이블
 * - isTableAvailable: 사이드바/드롭다운에 테이블을 선택 가능으로 보여줄지
 */

function getNeighborTables(tableName, relationshipOptions) {
  const neighbors = new Set()
  for (const key of Object.keys(relationshipOptions)) {
    if (!relationshipOptions[key]?.length) continue
    const [a, b] = key.split('||')
    if (a === tableName) neighbors.add(b)
    if (b === tableName) neighbors.add(a)
  }
  return neighbors
}

/**
 * lastTable과 newTable이 직접 관계는 없지만, 같은 부모 P로 연결될 수 있으면 P 반환.
 * (같은 부모_id 쓰는 자식 둘 → 부모를 끼워 넣어서 lastTable → P → newTable 로 조인)
 * @param {string} lastTable
 * @param {string} newTable
 * @param {Record<string, { prevColumn: string, currColumn: string }[]>} relationshipOptions
 * @returns {string | null} 부모 테이블명 또는 null
 */
export function findIntermediateParent(lastTable, newTable, relationshipOptions) {
  const lastNeighbors = getNeighborTables(lastTable, relationshipOptions)
  const newNeighbors = getNeighborTables(newTable, relationshipOptions)
  for (const p of lastNeighbors) {
    if (newNeighbors.has(p)) return p
  }
  return null
}

/**
 * @param {string[]} addedTables
 * @param {string} newTable
 * @param {Record<string, { prevColumn: string, currColumn: string }[]>} relationshipOptions
 * @returns {boolean} true면 새 테이블 자동 추가 허용
 */
export function canAddTableByColumn(addedTables, newTable, relationshipOptions) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(newTable)) return true
  const lastTable = addedTables[addedTables.length - 1]
  const keyA = `${lastTable}||${newTable}`
  const keyB = `${newTable}||${lastTable}`
  const optsA = relationshipOptions[keyA]
  const optsB = relationshipOptions[keyB]
  return Boolean((optsA && optsA.length > 0) || (optsB && optsB.length > 0))
}

/**
 * @param {string} tableName
 * @param {string[]} addedTables
 * @param {Record<string, Record<string, { prevColumn: string, currColumn: string }>>} tableRelationships
 * @returns {boolean} true면 해당 테이블을 선택 가능(리스트에 노출)
 */
export function isTableAvailable(tableName, addedTables, tableRelationships) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(tableName)) return true
  const last = addedTables[addedTables.length - 1]
  const relLast = tableRelationships[last] || {}
  const relTable = tableRelationships[tableName] || {}
  return !!relLast[tableName] || !!relTable[last]
}

/**
 * 직접 조인 또는 같은 부모로 자동 조인 가능하면 true (사이드바 노출·활성화용)
 */
export function isTableAvailableOrViaParent(tableName, addedTables, tableRelationships, relationshipOptions) {
  if (isTableAvailable(tableName, addedTables, tableRelationships)) return true
  if (addedTables.length === 0) return true
  const last = addedTables[addedTables.length - 1]
  return !!findIntermediateParent(last, tableName, relationshipOptions)
}
