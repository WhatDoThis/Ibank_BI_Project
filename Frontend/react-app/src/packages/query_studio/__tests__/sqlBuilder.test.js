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
import {
  generateDistinctPivotSQL,
  generateSQL,
  getResultColumnKey,
  buildSaveTableColumnPlan,
  buildSaveTableMaterializedSelect,
  pgCommentSourceKey,
} from '../utils/sqlBuilder'

const baseGridColumns = [
  { table: 'ibank_1', column: 'campaign_label', alias: 't1', type: 'varchar' },
  { table: 'ibank_1', column: 'delivery_date', alias: 't1', type: 'timestamp' },
]
const addedTables = ['ibank_1']
const filters = []
const tableRelationships = {}

describe('generateSQL · getResultColumnKey (기본은 테이블_컬럼, 동일 base 겹치면 _1부터 전부)', () => {
  it('단일 컬럼은 AS·결과 키가 테이블명_id (campaigns.id → campaigns_id)', () => {
    const grid = [{ table: 'campaigns', column: 'id', alias: 't1', type: 'bigint' }]
    const sql = generateSQL(grid, ['campaigns'], [], [], 1, 100, { campaigns: {} }, { joinConfigs: {} })
    expect(sql).toContain('AS "campaigns_id"')
    expect(getResultColumnKey(grid[0], [], {})).toBe('campaigns_id')
  })
  it('gridColumn.outputKey 가 있으면 SELECT·getResultColumnKey 가 그 키를 씀', () => {
    const grid = [{ table: 'test_report_x', column: 'col_1', alias: 't1', type: 'bigint', outputKey: 'campaigns_id' }]
    const sql = generateSQL(grid, ['test_report_x'], [], [], 1, 100, { test_report_x: {} }, { joinConfigs: {} })
    expect(sql).toContain('"campaigns_id"')
    expect(getResultColumnKey(grid[0], [], {})).toBe('campaigns_id')
  })

  it('test_report_* col_n 은 outputKey 없이 label(코멘트 기반)만 있어도 AS·키가 논리명', () => {
    const grid = [{ table: 'test_report_test_5', column: 'col_1', alias: 't1', type: 'bigint', label: 'campaigns_id' }]
    const sql = generateSQL(grid, ['test_report_test_5'], [], [], 1, 100, { test_report_test_5: {} }, { joinConfigs: {} })
    expect(sql).toContain('t1."col_1" AS "campaigns_id"')
    expect(sql).not.toContain('test_report_test_5_col_1')
    expect(getResultColumnKey(grid[0], [], {})).toBe('campaigns_id')
  })
  it('Rule 7: test_report_* 에서 이미 campaigns_id 컬럼이면 현재 테이블 prefix를 덮어쓰지 않음', () => {
    const grid = [{ table: 'test_report_new_5', column: 'campaigns_id', alias: 't1', type: 'bigint' }]
    const sql = generateSQL(grid, ['test_report_new_5'], [], [], 1, 100, { test_report_new_5: {} }, { joinConfigs: {} })
    expect(sql).toContain('t1."campaigns_id" AS "campaigns_id"')
    expect(sql).not.toContain('AS "test_report_new_5_campaigns_id"')
    expect(getResultColumnKey(grid[0], [], {})).toBe('campaigns_id')
  })

  it('비 id 컬럼도 기본 별칭·키는 테이블_컬럼(campaigns_label)', () => {
    const grid = [{ table: 'campaigns', column: 'label', alias: 't1', type: 'varchar' }]
    const sql = generateSQL(grid, ['campaigns'], [], [], 1, 100, { campaigns: {} }, { joinConfigs: {} })
    expect(sql).toContain('AS "campaigns_label"')
    expect(getResultColumnKey(grid[0], [], {})).toBe('campaigns_label')
  })

  it('join_order 없을 때: 쿠폰–배송 직접 엣지 없어도 배송은 캠페인(t1)에 붙음', () => {
    const grid = [
      { table: 'campaigns', column: 'id', alias: 't1', type: 'bigint' },
      { table: 'test_coupons_data', column: 'coupon_id', alias: 't2', type: 'varchar' },
      { table: 'test_deliveries_data', column: 'id', alias: 't3', type: 'bigint' },
    ]
    const rel = {
      campaigns: {
        test_coupons_data: { prevColumn: 'id', currColumn: 'campaign_id' },
        test_deliveries_data: { prevColumn: 'id', currColumn: 'campaign_id' },
      },
      test_coupons_data: {
        campaigns: { prevColumn: 'campaign_id', currColumn: 'id' },
      },
      test_deliveries_data: {
        campaigns: { prevColumn: 'campaign_id', currColumn: 'id' },
      },
    }
    const sql = generateSQL(
      grid,
      ['campaigns', 'test_coupons_data', 'test_deliveries_data'],
      [],
      [],
      1,
      100,
      rel,
      { joinConfigs: {} }
    )
    expect(sql).toMatch(/JOIN "test_deliveries_data" AS t3 ON t1\."id" = t3\."campaign_id"/)
  })
})

describe('pgCommentSourceKey', () => {
  it('pgCommentRoot 가 있으면 describe/PG 에서 온 최초 원천 문자열을 그대로 씀', () => {
    const c = {
      table: 'test_report_x',
      column: 'col_1',
      label: 'wrong_label',
      pgCommentRoot: 'campaigns_id',
    }
    expect(pgCommentSourceKey(c, [])).toBe('campaigns_id')
  })
  it('pgCommentRoot 없으면 기존 규칙(test_report col_n + label)', () => {
    const c = {
      table: 'test_report_test_5',
      column: 'col_1',
      label: 'campaigns_id',
    }
    expect(pgCommentSourceKey(c, [])).toBe('campaigns_id')
  })
  it('Rule 7: test_report_* 의 이미 논리명 컬럼은 pgCommentSourceKey도 그대로 유지', () => {
    const c = {
      table: 'test_report_new_5',
      column: 'campaigns_id',
      label: 'campaigns_id',
    }
    expect(pgCommentSourceKey(c, [])).toBe('campaigns_id')
  })
})

describe('buildSaveTableColumnPlan / buildSaveTableMaterializedSelect', () => {
  it('저장용 물리 컬럼명·메타 행 순서가 inner SELECT 키와 맞음', () => {
    const grid = [
      { table: 'campaigns', column: 'id', alias: 't1', type: 'bigint' },
      { table: 'campaigns', column: 'label', alias: 't1', type: 'varchar' },
    ]
    const { innerKeys, column_comment_hints } = buildSaveTableColumnPlan(grid, [], {}, {})
    expect(innerKeys).toEqual(['campaigns_id', 'campaigns_label'])
    expect(column_comment_hints[0].physical_name).toBe('campaigns_id')
    expect(column_comment_hints[1].physical_name).toBe('campaigns_label')
    expect(column_comment_hints[0].logical_key).toBe('campaigns_id')
    const sqlForSave = generateSQL(grid, ['campaigns'], [], [], 1, 100, { campaigns: {} }, {
      joinConfigs: {},
      saveAsTableSelectKeys: innerKeys,
    })
    expect(sqlForSave).not.toMatch(/\bLIMIT\b/i)
    const wrapped = buildSaveTableMaterializedSelect(sqlForSave, innerKeys)
    expect(wrapped).toContain('_qs_inner."campaigns_id" AS "campaigns_id"')
    expect(wrapped).toContain('_qs_inner."campaigns_label" AS "campaigns_label"')
  })

  it('2차 저장: 1차 test_report 의 col_n + label 로 inner 키가 논리명이면 래핑·COMMENT 힌트 일치', () => {
    const grid = [{ table: 'test_report_test_5', column: 'col_1', alias: 't1', type: 'bigint', label: 'campaigns_id' }]
    const { innerKeys, column_comment_hints } = buildSaveTableColumnPlan(grid, [], {}, {})
    expect(innerKeys).toEqual(['campaigns_id'])
    expect(column_comment_hints[0].logical_key).toBe('campaigns_id')
    const sqlForSave = generateSQL(grid, ['test_report_test_5'], [], [], 1, 100, { test_report_test_5: {} }, {
      joinConfigs: {},
      saveAsTableSelectKeys: innerKeys,
    })
    const wrapped = buildSaveTableMaterializedSelect(sqlForSave, innerKeys)
    expect(wrapped).toContain('_qs_inner."campaigns_id" AS "campaigns_id"')
  })

  it('같은 결과 별칭이 겹치면 innerKeys 는 _1 접미사, COMMENT 는 각각 원본 테이블_컬럼', () => {
    const grid = [
      { table: 'campaigns', column: 'id', alias: 't1', outputKey: 'dup', type: 'bigint' },
      { table: 'labels', column: 'id', alias: 't2', outputKey: 'dup', type: 'bigint' },
    ]
    const rel = { campaigns: {}, labels: {} }
    const joinCfg = { 'campaigns||labels': { joinType: 'LEFT', conditions: [{ prevColumn: 'id', currColumn: 'id' }] } }
    const { innerKeys, column_comment_hints } = buildSaveTableColumnPlan(grid, [], {}, {})
    expect(innerKeys).toEqual(['dup_1', 'dup_2'])
    expect(column_comment_hints[0].logical_key).toBe('campaigns_id')
    expect(column_comment_hints[1].logical_key).toBe('labels_id')
    const sqlForSave = generateSQL(grid, ['campaigns', 'labels'], [], [], 1, 100, rel, {
      joinConfigs: joinCfg,
      saveAsTableSelectKeys: innerKeys,
    })
    const wrapped = buildSaveTableMaterializedSelect(sqlForSave, innerKeys)
    expect(wrapped).toContain('_qs_inner."dup_1" AS "dup_1"')
    expect(wrapped).toContain('_qs_inner."dup_2" AS "dup_2"')
  })

  it('피벗 저장 시 column_comment_hints.logical_key 는 모두 null (PG COMMENT 미적용)', () => {
    const grid = [{ table: 'ibank_1', column: 'status', alias: 't1', type: 'varchar', aggFunc: 'COUNT' }]
    const groupBy = [{ table: 'ibank_1', column: 'delivery_date' }]
    const pivot = { table: 'ibank_1', column: 'status', values: ['A', 'B'] }
    const { column_comment_hints } = buildSaveTableColumnPlan(grid, groupBy, {}, { pivot, pivotRowAggs: [] })
    expect(column_comment_hints.length).toBe(4)
    expect(column_comment_hints.every((h) => h.logical_key == null)).toBe(true)
  })
})

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
    expect(sql).toContain('AS "ibank_1_delivery_date"')
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
    expect(sql).toContain('AS "ibank_1_campaign_label"')
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
