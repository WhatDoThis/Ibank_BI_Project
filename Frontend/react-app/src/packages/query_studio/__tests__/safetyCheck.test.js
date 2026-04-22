/**
 * query_studio/__tests__/safetyCheck.test.js
 * =====================================
 * JOIN 안전성 검증 풀가동 테스트
 *
 * 에러/경계 케이스:
 * - 순환 참조 (경로에 같은 테이블 두 번)
 * - A→B 넣은 뒤 C 넣을 때 중간 부모 A가 이미 있으면 경로는 [A,B,C] (순환 아님)
 * - 이미 추가된 테이블 / 중간 부모 이미 있음 / 경로 10단계 초과 / N:N
 * - validateJoinPath: CIRCULAR_REFERENCE, NO_RELATIONSHIP, MANY_TO_MANY
 */
import { describe, it, expect } from 'vitest'
import {
  detectCircularReference,
  canAddTableSafely,
  validateJoinPath,
  detectManyToMany
} from '../utils/safetyCheck'

// ---------- detectCircularReference ----------
describe('순환 참조 감지 (detectCircularReference)', () => {
  it('중복 없으면 circular: false', () => {
    expect(detectCircularReference(['A', 'B', 'C'])).toEqual({ circular: false })
    expect(detectCircularReference(['campaigns', 'test_deliveries_data'])).toEqual({ circular: false })
  })

  it('빈 배열·단일 테이블은 순환 아님', () => {
    expect(detectCircularReference([])).toEqual({ circular: false })
    expect(detectCircularReference(['Only'])).toEqual({ circular: false })
  })

  it('같은 테이블이 두 번 나오면 순환으로 감지', () => {
    const r = detectCircularReference(['A', 'B', 'C', 'A'])
    expect(r.circular).toBe(true)
    expect(r.duplicate).toBe('A')
    expect(r.circularPart).toEqual(['A', 'B', 'C', 'A'])
  })

  it('중간에만 순환되어도 첫 번째 중복 기준으로 반환', () => {
    const r = detectCircularReference(['X', 'Y', 'Z', 'Y', 'W'])
    expect(r.circular).toBe(true)
    expect(r.duplicate).toBe('Y')
    expect(r.circularPart).toEqual(['Y', 'Z', 'Y'])
  })

  it('연속 중복도 감지', () => {
    const r = detectCircularReference(['A', 'A', 'B'])
    expect(r.circular).toBe(true)
    expect(r.duplicate).toBe('A')
    expect(r.circularPart).toEqual(['A', 'A'])
  })
})

// ---------- detectManyToMany ----------
describe('N:N 관계 감지 (detectManyToMany)', () => {
  it('관계 없으면 N:N 아님', () => {
    expect(detectManyToMany('A', 'B', {})).toEqual({ isManyToMany: false })
    expect(detectManyToMany('A', 'B', { 'X||Y': [] })).toEqual({ isManyToMany: false })
  })

  it('prevColumn/currColumn이 동일 _id면 N:N', () => {
    const opts = {
      'tags||items': [{ prevColumn: 'tag_id', currColumn: 'tag_id' }]
    }
    const r = detectManyToMany('tags', 'items', opts)
    expect(r.isManyToMany).toBe(true)
    expect(r.reason).toMatch(/tag_id/)
    expect(r.suggestion).toMatch(/부모/)
  })

  it('1:N 관계(_id != _id 또는 한쪽만 _id)면 N:N 아님', () => {
    const opts = { 'campaigns||deliveries': [{ prevColumn: 'id', currColumn: 'campaign_id' }] }
    expect(detectManyToMany('campaigns', 'deliveries', opts)).toEqual({ isManyToMany: false })
  })
})

// ---------- canAddTableSafely (모든 에러/경계) ----------
describe('안전한 테이블 추가 (canAddTableSafely) - 전체 에러 케이스', () => {
  const emptyRelations = {}

  it('이미 추가된 테이블 재추가 시도 → warning', () => {
    const result = canAddTableSafely(['A', 'B'], 'B', null, emptyRelations)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/이미 추가된 테이블/)
    expect(result.severity).toBe('warning')
  })

  it('중간 부모가 이미 경로에 있으면 → info, 직접 추가하라고 안내', () => {
    const result = canAddTableSafely(['A', 'B'], 'C', 'A', emptyRelations)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/중간 부모.*이미 추가/)
    expect(result.suggestion).toMatch(/직접.*C/)
    expect(result.severity).toBe('info')
  })

  it('순환 경로(이미 중복이 있는 경로에 새 테이블 추가) → error', () => {
    const result = canAddTableSafely(['A', 'B', 'A'], 'C', null, emptyRelations)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/순환 참조/)
    expect(result.severity).toBe('error')
    expect(result.data?.circularPart).toContain('A')
  })

  it('경로 10단계 초과 → warning', () => {
    const longPath = Array.from({ length: 10 }, (_, i) => `t${i}`)
    const result = canAddTableSafely(longPath, 't10', null, emptyRelations)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/너무 깁니다|10단계/)
    expect(result.severity).toBe('warning')
  })

  it('경로 정확히 10단계는 허용', () => {
    const path9 = Array.from({ length: 9 }, (_, i) => `t${i}`)
    const result = canAddTableSafely(path9, 't9', null, emptyRelations)
    expect(result.ok).toBe(true)
  })

  it('N:N 관계 추가 시도 → error', () => {
    const opts = {
      'tags||items': [{ prevColumn: 'tag_id', currColumn: 'tag_id' }]
    }
    const result = canAddTableSafely(['tags'], 'items', null, opts)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/N:N/)
    expect(result.severity).toBe('error')
  })

  it('순환 없고 중복 없으면 허용', () => {
    expect(canAddTableSafely(['campaigns', 'test_deliveries_data'], 'test_delivery_tracking', null, emptyRelations)).toEqual({ ok: true })
  })

  it('첫 테이블 추가는 항상 허용', () => {
    expect(canAddTableSafely([], 'A', null, emptyRelations)).toEqual({ ok: true })
  })
})

// ---------- 시나리오: A→B 넣은 뒤 C 넣을 때 중간 부모가 A(이미 경로에 있음) ----------
describe('시나리오: A, B 넣은 뒤 C 추가 시 중간 부모 A가 이미 있을 때', () => {
  it('경로를 [A,B,C]로 쓰면 순환이 아님 (QueryStudioPage에서 중간 부모 생략 시 기대 동작)', () => {
    const pathWhenWeSkipIntermediate = ['A', 'B', 'C']
    const r = detectCircularReference(pathWhenWeSkipIntermediate)
    expect(r.circular).toBe(false)
  })

  it('만약 [A,B,A,C]였다면 순환이었을 것', () => {
    const r = detectCircularReference(['A', 'B', 'A', 'C'])
    expect(r.circular).toBe(true)
    expect(r.duplicate).toBe('A')
  })

  it('validateJoinPath([A,B,C])에 순환 이슈 없음', () => {
    const { valid, issues } = validateJoinPath(['A', 'B', 'C'], {})
    const circular = issues.find((i) => i.type === 'CIRCULAR_REFERENCE')
    expect(circular).toBeUndefined()
    expect(issues.some((i) => i.type === 'CIRCULAR_REFERENCE')).toBe(false)
  })
})

// ---------- validateJoinPath (전체 에러 케이스) ----------
describe('전체 경로 검증 (validateJoinPath) - 에러/경계', () => {
  it('순환 참조가 있으면 valid: false, CIRCULAR_REFERENCE', () => {
    const { valid, issues } = validateJoinPath(['A', 'B', 'C', 'A'], {})
    expect(valid).toBe(false)
    const circular = issues.find((i) => i.type === 'CIRCULAR_REFERENCE')
    expect(circular).toBeDefined()
    expect(circular.message).toMatch(/순환 참조/)
    expect(circular.data.circularPart).toEqual(['A', 'B', 'C', 'A'])
  })

  it('빈 경로·단일 테이블은 에러 없음', () => {
    expect(validateJoinPath([], {}).valid).toBe(true)
    expect(validateJoinPath([], {}).issues).toEqual([])
    expect(validateJoinPath(['Only'], {}).valid).toBe(true)
    expect(validateJoinPath(['Only'], {}).issues).toEqual([])
  })

  it('연속 테이블 간 관계 없으면 NO_RELATIONSHIP, valid: false', () => {
    const { valid, issues } = validateJoinPath(['A', 'B', 'C'], {})
    expect(issues.some((i) => i.type === 'NO_RELATIONSHIP')).toBe(true)
    expect(valid).toBe(false)
    const noRel = issues.find((i) => i.type === 'NO_RELATIONSHIP')
    expect(noRel.message).toMatch(/관계/)
  })

  it('연속 테이블 간 관계 있으면 NO_RELATIONSHIP 없음', () => {
    const rels = {
      'A||B': [{ prevColumn: 'id', currColumn: 'a_id' }],
      'B||C': [{ prevColumn: 'id', currColumn: 'b_id' }]
    }
    const { valid, issues } = validateJoinPath(['A', 'B', 'C'], rels)
    expect(issues.filter((i) => i.type === 'NO_RELATIONSHIP')).toHaveLength(0)
    expect(valid).toBe(true)
  })

  it('join_order 없을 때 B–C 직접 엣지 없어도 A–C 있으면 통과(공통 부모·스타 조인)', () => {
    const rels = {
      'A||B': [{ prevColumn: 'id', currColumn: 'a_id' }],
      'A||C': [{ prevColumn: 'id', currColumn: 'a_id' }],
    }
    const { valid, issues } = validateJoinPath(['A', 'B', 'C'], rels)
    expect(issues.filter((i) => i.type === 'NO_RELATIONSHIP')).toHaveLength(0)
    expect(valid).toBe(true)
  })

  it('N:N 구간이 있으면 MANY_TO_MANY warning (valid는 error만으로 결정)', () => {
    const rels = {
      'A||B': [{ prevColumn: 'id', currColumn: 'a_id' }],
      'B||C': [{ prevColumn: 'tag_id', currColumn: 'tag_id' }]
    }
    const { valid, issues } = validateJoinPath(['A', 'B', 'C'], rels)
    const many = issues.filter((i) => i.type === 'MANY_TO_MANY')
    expect(many.length).toBeGreaterThanOrEqual(1)
    expect(many[0].severity).toBe('warning')
    expect(many[0].message).toMatch(/N:N/)
  })

  it('순환 + NO_RELATIONSHIP 동시에 있으면 둘 다 이슈에 포함', () => {
    const { issues } = validateJoinPath(['A', 'B', 'A'], {})
    expect(issues.some((i) => i.type === 'CIRCULAR_REFERENCE')).toBe(true)
    expect(issues.some((i) => i.type === 'NO_RELATIONSHIP')).toBe(true)
  })
})
