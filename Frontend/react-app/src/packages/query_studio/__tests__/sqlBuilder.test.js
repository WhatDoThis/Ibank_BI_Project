/**
 * query_studio/__tests__/sqlBuilder.test.js
 * ===================================
 * 피벗 축 값 조회 SQL(연/연월/연월일) 및 execute-query 동작 검증.
 *
 * [테스트 대상]
 * - generateDistinctPivotSQL: 날짜 컬럼 시 dateGranularity 반영(TO_CHAR + ::timestamptz), 비날짜는 원본 컬럼
 * - opts 형식: { joinConfigs, dateGranularity } 전달 시 정상 동작
 */
import { describe, it, expect } from 'vitest'
import { generateDistinctPivotSQL } from '../utils/sqlBuilder'

const baseGridColumns = [
  { table: 'ibank_1', column: 'campaign_label', alias: 't1', type: 'varchar' },
  { table: 'ibank_1', column: 'delivery_date', alias: 't1', type: 'timestamp' },
]
const addedTables = ['ibank_1']
const filters = []
const tableRelationships = {}

describe('generateDistinctPivotSQL (피벗 축 값 조회)', () => {
  it('날짜 컬럼 + dateGranularity 연(YYYY) → TO_CHAR((col)::timestamptz, YYYY) 포함', () => {
    const opts = {
      joinConfigs: {},
      dateGranularity: { 'ibank_1.delivery_date': 'YYYY' },
    }
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'delivery_date',
      baseGridColumns,
      addedTables,
      filters,
      tableRelationships,
      opts
    )
    expect(sql).not.toBeNull()
    expect(sql).toContain('::timestamptz')
    expect(sql).toContain("TO_CHAR((t1.\"delivery_date\")::timestamptz, 'YYYY')")
    expect(sql).toMatch(/ORDER BY\s+TO_CHAR\(\(t1\."delivery_date"\)::timestamptz,\s*'YYYY'\)/i)
    expect(sql).toContain('SELECT DISTINCT')
  })

  it('날짜 컬럼 + dateGranularity 연월(YYYY-MM) → TO_CHAR(..., YYYY-MM) 포함', () => {
    const opts = {
      joinConfigs: {},
      dateGranularity: { 'ibank_1.delivery_date': 'YYYY-MM' },
    }
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'delivery_date',
      baseGridColumns,
      addedTables,
      filters,
      tableRelationships,
      opts
    )
    expect(sql).not.toBeNull()
    expect(sql).toContain("TO_CHAR((t1.\"delivery_date\")::timestamptz, 'YYYY-MM')")
  })

  it('날짜 컬럼 + dateGranularity 없으면 기본 연월일(YYYY-MM-DD) 적용', () => {
    const opts = { joinConfigs: {}, dateGranularity: {} }
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'delivery_date',
      baseGridColumns,
      addedTables,
      filters,
      tableRelationships,
      opts
    )
    expect(sql).not.toBeNull()
    expect(sql).toContain("TO_CHAR((t1.\"delivery_date\")::timestamptz, 'YYYY-MM-DD')")
  })

  it('비날짜 컬럼(campaign_label)이면 TO_CHAR 없이 원본 컬럼만 사용', () => {
    const opts = {
      joinConfigs: {},
      dateGranularity: { 'ibank_1.delivery_date': 'YYYY' },
    }
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'campaign_label',
      baseGridColumns,
      addedTables,
      filters,
      tableRelationships,
      opts
    )
    expect(sql).not.toBeNull()
    expect(sql).not.toContain('TO_CHAR')
    expect(sql).toContain('t1."campaign_label"')
  })

  it('걸린 조건(filters)이 있으면 WHERE 절에 포함', () => {
    const opts = { joinConfigs: {}, dateGranularity: {} }
    const withFilters = [
      { table: 'ibank_1', column: 'campaign_label', operator: '=', value: '테스트', logicalOperator: 'AND' },
    ]
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'delivery_date',
      baseGridColumns,
      addedTables,
      withFilters,
      tableRelationships,
      opts
    )
    expect(sql).not.toBeNull()
    expect(sql).toContain('WHERE')
    expect(sql).toContain('t1."campaign_label"')
  })

  it('기존 형식(joinConfigs만 객체로 전달) 호환', () => {
    const sql = generateDistinctPivotSQL(
      'ibank_1',
      'campaign_label',
      baseGridColumns,
      addedTables,
      filters,
      tableRelationships,
      {}
    )
    expect(sql).not.toBeNull()
    expect(sql).toContain('FROM "ibank_1" AS t1')
  })
})
