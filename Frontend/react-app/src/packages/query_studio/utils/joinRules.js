/**
 * query_studio/utils/joinRules.js (조인 규칙·테이블 추가 가능 여부)
 * ===========================================================
 * 리포트 쿼리 빌더. relationshipOptions 기반. 추가 테이블은 **이미 경로에 있는 아무 테이블**과의
 * 직접 엣지 또는 공통 부모 한 단계로 붙일 수 있으면 허용. 직접 엣지가 여럿이면 **confidence·FK** 우선.
 *
 * [Main Functions]
 * ===========
 * 1. getNeighborTables, hasDirectEdgeBetween, directEdgeRank (내부)
 * 2. findIntermediateParent: 두 테이블이 직접 연결은 없으나 같은 이웃(부모) P가 있으면 P
 * 3. findAttachPlan: addedTables + newTable → { newAddedTables, intermediateParent } | null
 * 4. isTableAvailable / isTableAvailableOrViaParent: 사이드바 노출 (경로 내 임의 테이블 기준)
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

function hasDirectEdgeBetween(relationshipOptions, a, b) {
  const o1 = relationshipOptions[`${a}||${b}`]
  const o2 = relationshipOptions[`${b}||${a}`]
  return Boolean((o1 && o1.length > 0) || (o2 && o2.length > 0))
}

/** 직접 엣지 품질 (랭킹). confidence + FK 계열 가산 */
function directEdgeRank(relationshipOptions, a, b) {
  let best = 0
  const scoreConf = (c) => {
    const u = String(c || '').toUpperCase()
    if (u === 'HIGH') return 3
    if (u === 'MEDIUM') return 2
    if (u === 'LOW') return 1
    return 2
  }
  for (const key of [`${a}||${b}`, `${b}||${a}`]) {
    const arr = relationshipOptions[key]
    if (!arr?.length) continue
    for (const opt of arr) {
      let s = scoreConf(opt.confidence)
      if (opt.relationship_type === 'fk' || opt.source === 'fk') s += 0.25
      else if (opt.source === 'inferred_comment') s += 0.12
      if (s > best) best = s
    }
  }
  return best
}

// 2. 두 테이블이 직접 관계는 없지만 같은 이웃(부모) P로 연결되면 P
export function findIntermediateParent(lastTable, newTable, relationshipOptions) {
  const lastNeighbors = getNeighborTables(lastTable, relationshipOptions)
  const newNeighbors = getNeighborTables(newTable, relationshipOptions)
  for (const p of lastNeighbors) {
    if (newNeighbors.has(p)) return p
  }
  return null
}

/**
 * 새 테이블을 조인 경로에 붙이는 계획. 불가면 null.
 * - 직접 엣지가 여러 기준 테이블과 있으면 confidence·FK가 높은 쪽, 동점이면 addedTables에서 뒤쪽(최근) 우선.
 * - 직접 엣지 없으면 임의 기준 테이블과의 공통 부모(한 단계) 시도; 뒤에서 앞으로 스캔.
 */
export function findAttachPlan(addedTables, newTable, relationshipOptions) {
  if (!newTable) return null
  if (addedTables.length === 0) {
    return { newAddedTables: [newTable], intermediateParent: null }
  }
  if (addedTables.includes(newTable)) {
    return { newAddedTables: addedTables, intermediateParent: null }
  }

  let bestIdx = -1
  let bestRank = -1
  for (let i = 0; i < addedTables.length; i++) {
    const t = addedTables[i]
    if (!hasDirectEdgeBetween(relationshipOptions, t, newTable)) continue
    const r = directEdgeRank(relationshipOptions, t, newTable)
    if (r > bestRank || (r === bestRank && i > bestIdx)) {
      bestRank = r
      bestIdx = i
    }
  }
  if (bestIdx >= 0) {
    return { newAddedTables: [...addedTables, newTable], intermediateParent: null }
  }

  for (let i = addedTables.length - 1; i >= 0; i--) {
    const t = addedTables[i]
    const p = findIntermediateParent(t, newTable, relationshipOptions)
    if (!p) continue
    if (addedTables.includes(p)) {
      return { newAddedTables: [...addedTables, newTable], intermediateParent: null }
    }
    return { newAddedTables: [...addedTables, p, newTable], intermediateParent: p }
  }

  return null
}

// 3.
export function isTableAvailable(tableName, addedTables, tableRelationships) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(tableName)) return true
  for (const t of addedTables) {
    const relT = tableRelationships[t] || {}
    const relName = tableRelationships[tableName] || {}
    if (relT[tableName] || relName[t]) return true
  }
  return false
}

// 4. 직접 조인 또는 같은 부모로 자동 조인 가능하면 true (사이드바 노출·활성화용)
export function isTableAvailableOrViaParent(tableName, addedTables, tableRelationships, relationshipOptions) {
  if (isTableAvailable(tableName, addedTables, tableRelationships)) return true
  if (addedTables.length === 0) return true
  for (const t of addedTables) {
    if (findIntermediateParent(t, tableName, relationshipOptions)) return true
  }
  return false
}
