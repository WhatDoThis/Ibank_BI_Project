/**
 * query_studio/utils/joinRules.js (조인 규칙·테이블 추가 가능 여부)
 * ===========================================================
 * 리포트 쿼리 빌더. 직접 관계·중간 부모 끼워 넣기·사이드바 노출 여부. relationshipOptions 기반.
 *
 * [Main Functions]
 * ===========
 * 1. getNeighborTables: 테이블의 이웃 테이블 집합 (내부)
 * 2. findIntermediateParent: lastTable, newTable, relationshipOptions → 끼워 넣을 부모 테이블명
 * 3. canAddTableByColumn: 새 테이블 추가 허용 여부 (직접 관계만)
 * 4. isTableAvailable: 테이블 단독 노출 여부 (직접 조인 가능한 경우만)
 * 5. isTableAvailableOrViaParent: addedTables 기준 직접 또는 같은 부모 경로로 노출 여부 (Sidebar용)
 *
 * [Dependencies]
 * =========
 * - 없음
 */

// 1.
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

// 2. lastTable과 newTable이 직접 관계는 없지만 같은 부모 P로 연결되면 P 반환 (같은 부모_id → lastTable→P→newTable 조인)
export function findIntermediateParent(lastTable, newTable, relationshipOptions) {
  const lastNeighbors = getNeighborTables(lastTable, relationshipOptions)
  const newNeighbors = getNeighborTables(newTable, relationshipOptions)
  for (const p of lastNeighbors) {
    if (newNeighbors.has(p)) return p
  }
  return null
}

// 3. addedTables, newTable, relationshipOptions → 새 테이블 자동 추가 허용 여부
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

// 4. tableName, addedTables, tableRelationships → 해당 테이블 선택 가능(리스트 노출) 여부
export function isTableAvailable(tableName, addedTables, tableRelationships) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(tableName)) return true
  const last = addedTables[addedTables.length - 1]
  const relLast = tableRelationships[last] || {}
  const relTable = tableRelationships[tableName] || {}
  return !!relLast[tableName] || !!relTable[last]
}

// 5. 직접 조인 또는 같은 부모로 자동 조인 가능하면 true (사이드바 노출·활성화용)
export function isTableAvailableOrViaParent(tableName, addedTables, tableRelationships, relationshipOptions) {
  if (isTableAvailable(tableName, addedTables, tableRelationships)) return true
  if (addedTables.length === 0) return true
  const last = addedTables[addedTables.length - 1]
  return !!findIntermediateParent(last, tableName, relationshipOptions)
}
