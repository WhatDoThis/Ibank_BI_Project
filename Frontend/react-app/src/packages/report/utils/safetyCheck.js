/**
 * report/utils/safetyCheck.js (JOIN 안전성 검증)
 * ==============================================
 * 리포트 쿼리 빌더. 테이블 추가 경로 순환 참조 감지·JOIN 안전성 검증.
 *
 * [주요 함수]
 * - detectCircularReference: 순환 참조 감지
 * - canAddTableSafely, validateJoinPath: 안전한 테이블 추가 여부
 *
 * [의존성]
 * - 없음
 */

/**
 * 순환 참조 감지
 *
 * @param {string[]} proposedPath - 제안된 테이블 경로
 * @returns {{ circular: boolean, duplicate?: string, path?: string[], circularPart?: string[] }}
 */
export function detectCircularReference(proposedPath) {
  const seen = new Set()
  const duplicates = []

  for (let i = 0; i < proposedPath.length; i++) {
    const table = proposedPath[i]

    if (seen.has(table)) {
      duplicates.push({
        table,
        firstIndex: proposedPath.indexOf(table),
        secondIndex: i
      })
    }

    seen.add(table)
  }

  if (duplicates.length > 0) {
    const dup = duplicates[0]
    return {
      circular: true,
      duplicate: dup.table,
      path: proposedPath,
      circularPart: proposedPath.slice(dup.firstIndex, dup.secondIndex + 1)
    }
  }

  return { circular: false }
}

/**
 * N:N 관계 감지
 *
 * @param {string} table1
 * @param {string} table2
 * @param {Object} relationshipOptions
 * @returns {{ isManyToMany: boolean, reason?: string, suggestion?: string }}
 */
export function detectManyToMany(table1, table2, relationshipOptions) {
  const key1 = `${table1}||${table2}`
  const key2 = `${table2}||${table1}`

  const rel1 = relationshipOptions[key1]
  const rel2 = relationshipOptions[key2]

  if (!rel1 && !rel2) {
    return { isManyToMany: false }
  }

  const checkRel = rel1 || rel2
  if (checkRel && checkRel.length > 0) {
    const rel = checkRel[0]

    if (
      rel.prevColumn &&
      rel.currColumn &&
      rel.prevColumn.endsWith('_id') &&
      rel.currColumn.endsWith('_id') &&
      rel.prevColumn === rel.currColumn
    ) {
      return {
        isManyToMany: true,
        reason: `${table1}.${rel.prevColumn} = ${table2}.${rel.currColumn}`,
        suggestion: '공통 부모 테이블을 먼저 추가하세요'
      }
    }
  }

  return { isManyToMany: false }
}

/**
 * 안전한 테이블 추가 검증
 *
 * @param {string[]} addedTables - 현재 추가된 테이블
 * @param {string} newTable - 추가하려는 테이블
 * @param {string|null} intermediateParent - 중간 부모 테이블
 * @param {Object} relationshipOptions
 * @returns {{ ok: boolean, reason?: string, detail?: string, suggestion?: string, severity?: string }}
 */
export function canAddTableSafely(
  addedTables,
  newTable,
  intermediateParent,
  relationshipOptions
) {
  if (addedTables.includes(newTable)) {
    return {
      ok: false,
      reason: '이미 추가된 테이블입니다',
      severity: 'warning'
    }
  }

  if (intermediateParent && addedTables.includes(intermediateParent)) {
    return {
      ok: false,
      reason: `중간 부모 테이블 '${intermediateParent}'이 이미 추가되어 있습니다`,
      suggestion: `직접 ${newTable}을 추가하세요`,
      severity: 'info'
    }
  }

  const proposedPath = intermediateParent
    ? [...addedTables, intermediateParent, newTable]
    : [...addedTables, newTable]

  const circularCheck = detectCircularReference(proposedPath)
  if (circularCheck.circular) {
    return {
      ok: false,
      reason: `순환 참조 발생: ${circularCheck.circularPart.join(' → ')}`,
      detail: `'${circularCheck.duplicate}' 테이블이 경로에 중복됩니다`,
      suggestion: '다른 테이블을 선택하거나 기존 테이블을 제거하세요',
      severity: 'error',
      data: circularCheck
    }
  }

  if (proposedPath.length > 10) {
    return {
      ok: false,
      reason: 'JOIN 경로가 너무 깁니다 (최대 10단계)',
      detail: `현재 경로: ${proposedPath.length}단계`,
      suggestion: '더 직접적인 관계를 찾거나 쿼리를 분리하세요',
      severity: 'warning'
    }
  }

  if (addedTables.length > 0 && !intermediateParent) {
    const lastTable = addedTables[addedTables.length - 1]
    const manyToManyCheck = detectManyToMany(lastTable, newTable, relationshipOptions)

    if (manyToManyCheck.isManyToMany) {
      return {
        ok: false,
        reason: 'N:N 관계는 허용되지 않습니다',
        detail: manyToManyCheck.reason,
        suggestion: manyToManyCheck.suggestion,
        severity: 'error',
        data: manyToManyCheck
      }
    }
  }

  return { ok: true }
}

/**
 * 전체 경로 검증
 *
 * @param {string[]} addedTables
 * @param {Object} relationshipOptions
 * @returns {{ valid: boolean, issues: Array }}
 */
export function validateJoinPath(addedTables, relationshipOptions) {
  const issues = []

  const circularCheck = detectCircularReference(addedTables)
  if (circularCheck.circular) {
    issues.push({
      type: 'CIRCULAR_REFERENCE',
      severity: 'error',
      message: '순환 참조가 있습니다',
      data: circularCheck
    })
  }

  for (let i = 0; i < addedTables.length - 1; i++) {
    const prev = addedTables[i]
    const curr = addedTables[i + 1]

    const key1 = `${prev}||${curr}`
    const key2 = `${curr}||${prev}`

    const hasRelation =
      (relationshipOptions[key1] && relationshipOptions[key1].length > 0) ||
      (relationshipOptions[key2] && relationshipOptions[key2].length > 0)

    if (!hasRelation) {
      issues.push({
        type: 'NO_RELATIONSHIP',
        severity: 'error',
        message: `${prev}와 ${curr} 사이에 관계가 없습니다`,
        data: { prev, curr, index: i }
      })
    }

    const manyToManyCheck = detectManyToMany(prev, curr, relationshipOptions)
    if (manyToManyCheck.isManyToMany) {
      issues.push({
        type: 'MANY_TO_MANY',
        severity: 'warning',
        message: `${prev}와 ${curr}가 N:N 관계입니다`,
        data: manyToManyCheck
      })
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues
  }
}
