/**
 * report/__tests__/joinRules.test.js
 * ==================================
 * 조인 기능 검사용 통합 테스트 (Claude 등 검토용)
 *
 * [조인 규칙 요약]
 * 1. 백엔드(report.py): FK만 조인 관계로 내려줌. 컬럼/타입 기반에서 _id 컬럼은
 *    직접 A-B 관계로 내리지 않음 → 부모 테이블 없으면/있어도 _id로 두 테이블 직접 조인 불가.
 * 2. 프론트(joinRules.js): relationshipOptions에 있는 쌍만 "조인 가능".
 *    - canAddTableByColumn: 관계 없으면 테이블 자동 추가(자동 join) 안 함.
 *    - isTableAvailable: 관계 없으면 사이드바/드롭다운 리스트에 안 보이게.
 *
 * [테스트 대상]
 * - canAddTableByColumn(addedTables, newTable, relationshipOptions)
 * - isTableAvailable(tableName, addedTables, tableRelationships)
 */
import { describe, it, expect } from 'vitest'
import { canAddTableByColumn, findIntermediateParent, isTableAvailable, isTableAvailableOrViaParent } from '../utils/joinRules'

describe('조인 규칙 (join rules)', () => {
  describe('canAddTableByColumn - 컬럼 추가 시 테이블 자동 추가 허용 여부', () => {
    it('첫 테이블은 무조건 허용', () => {
      expect(canAddTableByColumn([], 'workflow', {})).toBe(true)
      expect(canAddTableByColumn([], 'campaigns', {})).toBe(true)
    })

    it('이미 추가된 테이블에 컬럼 추가는 허용', () => {
      expect(canAddTableByColumn(['workflow'], 'workflow', {})).toBe(true)
      expect(canAddTableByColumn(['workflow', 'campaigns'], 'campaigns', {})).toBe(true)
    })

    it('relationshipOptions에 lastTable||newTable 관계 있으면 허용 (부모 경로)', () => {
      const opts = { 'workflow||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }] }
      expect(canAddTableByColumn(['workflow'], 'campaigns', opts)).toBe(true)
    })

    it('relationshipOptions에 newTable||lastTable 관계 있으면 허용', () => {
      const opts = { 'campaigns||workflow': [{ prevColumn: 'workflow_id', currColumn: 'id' }] }
      expect(canAddTableByColumn(['campaigns'], 'workflow', opts)).toBe(true)
    })

    it('관계 없으면 거부 (n:n 직접 조인 방지)', () => {
      expect(canAddTableByColumn(['table_a'], 'table_b', {})).toBe(false)
      expect(canAddTableByColumn(['campaigns'], 'workflows', {})).toBe(false)
    })

    it('부모 기준만 있을 때: workflow->campaigns/channels 허용, campaigns->channels 거부', () => {
      const onlyParentBased = {
        'workflow||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }],
        'workflow||channels': [{ prevColumn: 'id', currColumn: 'workflow_id' }]
      }
      expect(canAddTableByColumn(['workflow'], 'campaigns', onlyParentBased)).toBe(true)
      expect(canAddTableByColumn(['workflow'], 'channels', onlyParentBased)).toBe(true)
      expect(canAddTableByColumn(['campaigns'], 'channels', onlyParentBased)).toBe(false)
    })
  })

  describe('findIntermediateParent - 같은 부모_id 쓰는 두 테이블일 때 끼워 넣을 부모', () => {
    it('campaigns → channels 일 때 workflows 반환', () => {
      const opts = {
        'workflows||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }],
        'workflows||channels': [{ prevColumn: 'id', currColumn: 'workflow_id' }]
      }
      expect(findIntermediateParent('campaigns', 'channels', opts)).toBe('workflows')
    })
    it('직접 연결된 테이블(부모→자식)은 공통 부모가 없으면 null', () => {
      const opts = {
        'workflows||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }],
        'workflows||channels': [{ prevColumn: 'id', currColumn: 'workflow_id' }]
      }
      expect(findIntermediateParent('workflows', 'channels', opts)).toBe(null)
    })
    it('공통 부모 없으면 null', () => {
      expect(findIntermediateParent('campaigns', 'channels', {})).toBe(null)
      const opts = { 'workflows||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }] }
      expect(findIntermediateParent('campaigns', 'channels', opts)).toBe(null)
    })
  })

  describe('isTableAvailable - 사이드바/드롭다운에 테이블 노출 여부', () => {
    it('addedTables 비어 있으면 전부 노출', () => {
      expect(isTableAvailable('workflow', [], {})).toBe(true)
      expect(isTableAvailable('campaigns', [], {})).toBe(true)
    })

    it('이미 추가된 테이블은 노출', () => {
      expect(isTableAvailable('workflow', ['workflow'], {})).toBe(true)
    })

    it('tableRelationships에 last->테이블 있으면 노출', () => {
      const rel = { workflow: { campaigns: { prevColumn: 'id', currColumn: 'workflow_id' } } }
      expect(isTableAvailable('campaigns', ['workflow'], rel)).toBe(true)
    })

    it('tableRelationships에 테이블->last 있으면 노출', () => {
      const rel = { campaigns: { workflow: { prevColumn: 'workflow_id', currColumn: 'id' } } }
      expect(isTableAvailable('workflow', ['campaigns'], rel)).toBe(true)
    })

    it('관계 없으면 노출 안 함 (리스트에서 제외)', () => {
      expect(isTableAvailable('table_b', ['table_a'], {})).toBe(false)
      expect(isTableAvailable('channels', ['campaigns'], { campaigns: {} })).toBe(false)
    })
  })

  describe('isTableAvailableOrViaParent - 직접 또는 부모 경유로 노출', () => {
    it('직접 관계 있으면 노출', () => {
      const rel = { workflow: { campaigns: { prevColumn: 'id', currColumn: 'workflow_id' } } }
      expect(isTableAvailableOrViaParent('campaigns', ['workflow'], rel, {})).toBe(true)
    })
    it('같은 부모만 있으면(직접 관계 없음) 부모 경유로 노출', () => {
      const opts = {
        'workflows||campaigns': [{ prevColumn: 'id', currColumn: 'workflow_id' }],
        'workflows||channels': [{ prevColumn: 'id', currColumn: 'workflow_id' }]
      }
      expect(isTableAvailable('channels', ['campaigns'], {})).toBe(false)
      expect(isTableAvailableOrViaParent('channels', ['campaigns'], {}, opts)).toBe(true)
    })
  })
})
