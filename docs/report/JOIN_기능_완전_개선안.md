# JOIN 기능 완전 개선안

**목표:**
1. 관계 자동 분석 강화 (복합 단어, 대소문자 처리)
2. 안전성 확보 (순환 참조 차단, N:N 방지)
3. 관계 시각화 (다이어그램)

---

## 📦 파일 구조

```
Backend/
  api_server/
    pluralize.py              (신규) - 복수형 변환 로직
    routers/
      report.py               (수정) - 개선된 관계 분석

Frontend/
  react-app/src/packages/report/
    utils/
      safetyCheck.js          (신규) - 안전성 검증
      joinRules.js            (기존)
    components/
      RelationshipDiagram.jsx (신규) - 시각화
      RelationshipDiagram.css (신규)
    ReportPage.jsx            (수정) - 안전성 적용
```

---

## 🔧 1. 백엔드: 관계 자동 분석 강화

### 파일: `Backend/api_server/pluralize.py` (신규)

```python
"""
pluralize.py
단수/복수 변환 + 부모 테이블 찾기
"""

def pluralize(word):
    """
    단수 → 복수 변환
    
    Examples:
        workflow → workflows
        company → companies
        box → boxes
    """
    word = word.lower()
    
    # 1. y → ies (자음 + y)
    if len(word) >= 2 and word.endswith('y') and word[-2] not in 'aeiou':
        return word[:-1] + 'ies'
    
    # 2. s, ss, x, z, ch, sh → es
    if word.endswith(('s', 'ss', 'x', 'z', 'ch', 'sh')):
        return word + 'es'
    
    # 3. 기본: +s
    return word + 's'


def find_parent_table(column_name, allowed_tables):
    """
    _id 컬럼명에서 부모 테이블 찾기
    
    Args:
        column_name: workflow_id, primary_workflow_id 등
        allowed_tables: ['workflows', 'campaigns', ...]
    
    Returns:
        부모 테이블명 또는 None
    
    Examples:
        find_parent_table('workflow_id', ['workflows'])
        → 'workflows'
        
        find_parent_table('primary_workflow_id', ['primary_workflows'])
        → 'primary_workflows'
        
        find_parent_table('campaign_id', ['Campaigns'])  # 대소문자 무관
        → 'Campaigns'
    """
    if not column_name.endswith('_id'):
        return None
    
    # _id 제거
    base = column_name[:-3].rstrip('_')
    if not base:
        return None
    
    allowed_set = {t.lower() for t in allowed_tables}
    
    # 1. 정확히 일치 (단수형)
    if base.lower() in allowed_set:
        for t in allowed_tables:
            if t.lower() == base.lower():
                return t
    
    # 2. 복수형 변환 (+s)
    plural = pluralize(base)
    if plural.lower() in allowed_set:
        for t in allowed_tables:
            if t.lower() == plural.lower():
                return t
    
    # 3. 복합 단어 처리
    # primary_workflow_id → primary_workflows
    parts = base.split('_')
    if len(parts) >= 2:
        last_word = parts[-1]
        plural_last = pluralize(last_word)
        compound = '_'.join(parts[:-1] + [plural_last])
        
        if compound.lower() in allowed_set:
            for t in allowed_tables:
                if t.lower() == compound.lower():
                    return t
    
    return None
```

---

### 파일: `Backend/api_server/routers/report.py` (수정)

```python
# 기존 import에 추가
from Backend.api_server.pluralize import find_parent_table


@router.get("/table-relationships")
def table_relationships(conn=Depends(get_db), mode: str = Query("all")):
    """
    개선된 관계 분석
    - 복합 단어 처리 (primary_workflow_id)
    - 대소문자 무관
    - 관계 타입 명시
    """
    try:
        allowed = list(db.get_allowed_tables())
        if not allowed:
            return {"relationships": [], "count": 0}
        
        mode = (mode or "all").strip().lower()
        if mode not in ("fk", "column", "all"):
            mode = "all"
        
        relationships = []
        
        # ========== 1단계: FK 기반 관계 ==========
        if mode in ("fk", "all"):
            schema = db.get_table_schema()
            cur = conn.cursor()
            try:
                placeholders = ", ".join(["%s"] * len(allowed))
                sql = (
                    "SELECT kcu.table_name AS from_table, kcu.column_name AS from_column, "
                    "ccu.table_name AS to_table, ccu.column_name AS to_column "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "ON tc.constraint_name = kcu.constraint_name "
                    "AND tc.table_schema = kcu.table_schema "
                    "JOIN information_schema.constraint_column_usage ccu "
                    "ON ccu.constraint_name = tc.constraint_name "
                    "AND ccu.table_schema = tc.table_schema "
                    "WHERE tc.constraint_type = 'FOREIGN KEY' "
                    "AND tc.table_schema = %s "
                    "AND kcu.table_name IN (" + placeholders + ") "
                    "AND ccu.table_name IN (" + placeholders + ") "
                    "ORDER BY kcu.table_name, ccu.table_name, kcu.column_name"
                )
                cur.execute(sql, (schema,) + tuple(allowed) + tuple(allowed))
                
                for r in cur.fetchall():
                    relationships.append({
                        "from_table": r["from_table"],
                        "from_column": r["from_column"],
                        "to_table": r["to_table"],
                        "to_column": r["to_column"],
                        "source": "fk",
                        "confidence": "HIGH",
                        "reason": "DB FK 제약조건",
                        "relationship_type": "N:1"
                    })
            finally:
                cur.close()
        
        # ========== 2단계: _id 패턴 추론 ==========
        if mode in ("all",):
            # 각 테이블의 컬럼 정보 수집
            table_columns = {}
            for table_name in allowed:
                try:
                    cols = db.get_table_columns_with_types(table_name)
                    table_columns[table_name] = cols
                except Exception:
                    table_columns[table_name] = []
            
            # 이미 추가된 관계 (중복 방지)
            existing = {
                (r["from_table"], r["from_column"], r["to_table"], r["to_column"])
                for r in relationships
            }
            
            # 각 테이블의 _id 컬럼 분석
            for table_name in allowed:
                for col_info in table_columns.get(table_name, []):
                    col_name = col_info.get("column_name", "")
                    
                    # id 컬럼 무시
                    if col_name == "id":
                        continue
                    
                    # _id로 끝나지 않으면 무시
                    if not col_name.endswith("_id"):
                        continue
                    
                    # 부모 테이블 찾기 (개선된 로직!)
                    parent_table = find_parent_table(col_name, allowed)
                    
                    if not parent_table:
                        continue
                    
                    # 중복 체크
                    key = (table_name, col_name, parent_table, "id")
                    if key in existing:
                        continue
                    
                    # 관계 추가
                    relationships.append({
                        "from_table": table_name,
                        "from_column": col_name,
                        "to_table": parent_table,
                        "to_column": "id",
                        "source": "inferred",
                        "confidence": "HIGH",
                        "reason": f"_id 패턴: {col_name} → {parent_table}.id",
                        "relationship_type": "N:1"
                    })
                    
                    existing.add(key)
        
        return {
            "relationships": relationships,
            "count": len(relationships)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "message": "JOIN 관계 조회 실패"
            }
        )
```

---

## 🛡️ 2. 프론트엔드: 안전성 강화

### 파일: `Frontend/react-app/src/packages/report/utils/safetyCheck.js` (신규)

```javascript
/**
 * safetyCheck.js
 * JOIN 안전성 검증
 */

/**
 * 순환 참조 감지
 * 
 * @param {string[]} proposedPath - 제안된 테이블 경로
 * @returns {{ circular: boolean, duplicate?: string, path?: string[], circularPart?: string[] }}
 * 
 * @example
 * detectCircularReference(['A', 'B', 'C', 'A'])
 * → { circular: true, duplicate: 'A', circularPart: ['A', 'B', 'C', 'A'] }
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
    
    // workflow_id = workflow_id 같은 경우 (N:N)
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
        suggestion: `공통 부모 테이블을 먼저 추가하세요`
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
  // 1. 이미 추가된 테이블
  if (addedTables.includes(newTable)) {
    return {
      ok: false,
      reason: '이미 추가된 테이블입니다',
      severity: 'warning'
    }
  }
  
  // 2. 중간 부모도 이미 있는지
  if (intermediateParent && addedTables.includes(intermediateParent)) {
    return {
      ok: false,
      reason: `중간 부모 테이블 '${intermediateParent}'이 이미 추가되어 있습니다`,
      suggestion: `직접 ${newTable}을 추가하세요`,
      severity: 'info'
    }
  }
  
  // 3. 제안된 경로
  const proposedPath = intermediateParent
    ? [...addedTables, intermediateParent, newTable]
    : [...addedTables, newTable]
  
  // 4. 순환 참조 체크
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
  
  // 5. 경로 길이 체크
  if (proposedPath.length > 10) {
    return {
      ok: false,
      reason: 'JOIN 경로가 너무 깁니다 (최대 10단계)',
      detail: `현재 경로: ${proposedPath.length}단계`,
      suggestion: '더 직접적인 관계를 찾거나 쿼리를 분리하세요',
      severity: 'warning'
    }
  }
  
  // 6. N:N 관계 체크
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
  
  // 1. 순환 참조
  const circularCheck = detectCircularReference(addedTables)
  if (circularCheck.circular) {
    issues.push({
      type: 'CIRCULAR_REFERENCE',
      severity: 'error',
      message: '순환 참조가 있습니다',
      data: circularCheck
    })
  }
  
  // 2. 각 연결 검증
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
    
    // N:N 체크
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
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  }
}
```

---

### 파일: `Frontend/react-app/src/packages/report/ReportPage.jsx` (수정)

```javascript
// 기존 import에 추가
import { 
  canAddTableSafely, 
  validateJoinPath 
} from './utils/safetyCheck'


// addColumn 함수 수정 (L227~264 부근)
const addColumn = useCallback(
  (columnInfo) => {
    const exists = gridColumns.some(
      (c) => c.table === columnInfo.table && c.column === columnInfo.column
    )
    if (exists) {
      showToast('warning', '이미 추가된 컬럼입니다')
      return
    }

    const tableAlreadyAdded = addedTables.includes(columnInfo.table)
    let newAddedTables
    let intermediateParent = null

    if (tableAlreadyAdded) {
      newAddedTables = addedTables
    } else if (canAddTableByColumn(addedTables, columnInfo.table, relationshipOptions)) {
      newAddedTables = [...addedTables, columnInfo.table]
    } else {
      const lastTable = addedTables[addedTables.length - 1]
      intermediateParent = findIntermediateParent(
        lastTable,
        columnInfo.table,
        relationshipOptions
      )

      if (intermediateParent) {
        newAddedTables = [...addedTables, intermediateParent, columnInfo.table]
      } else {
        showToast('warning', '선택한 테이블과 조인할 수 없습니다')
        return
      }
    }

    // ========== 🛡️ 안전성 검증 ==========
    if (!tableAlreadyAdded) {
      const safetyCheck = canAddTableSafely(
        addedTables,
        columnInfo.table,
        intermediateParent,
        relationshipOptions
      )

      if (!safetyCheck.ok) {
        if (safetyCheck.severity === 'error') {
          showToast('error', safetyCheck.reason)
          if (safetyCheck.detail) {
            console.error('Safety check:', safetyCheck.detail)
          }
          if (safetyCheck.suggestion) {
            showToast('info', `💡 ${safetyCheck.suggestion}`)
          }
          return
        } else if (safetyCheck.severity === 'warning') {
          showToast('warning', safetyCheck.reason)
          if (safetyCheck.suggestion) {
            showToast('info', safetyCheck.suggestion)
          }
        }
      }
    }

    // 테이블 별칭 생성
    const tableAliasMap = {}
    newAddedTables.forEach((t, i) => {
      tableAliasMap[t] = 't' + (i + 1)
    })
    const alias = tableAliasMap[columnInfo.table] || 't1'

    const isGB = isGroupByColumn(groupBy, columnInfo.table, columnInfo.column)
    const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null

    setAddedTables(newAddedTables)
    setGridColumns((prev) =>
      syncAggFuncs(
        [
          ...prev,
          {
            table: columnInfo.table,
            column: columnInfo.column,
            alias,
            type: columnInfo.type,
            aggFunc
          }
        ],
        groupBy
      )
    )
    setCurrentPage(1)

    if (intermediateParent) {
      showToast('success', `'${intermediateParent}' 테이블을 거쳐 '${columnInfo.table}'를 추가했습니다`)
    } else {
      showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
    }
  },
  [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions]
)


// runExecuteQuery 함수 수정 (L268~295 부근)
const runExecuteQuery = useCallback(async () => {
  if (gridColumns.length === 0) {
    showToast('warning', '최소 1개의 컬럼을 선택하세요')
    return
  }

  // ========== 🛡️ 경로 검증 ==========
  const pathValidation = validateJoinPath(addedTables, relationshipOptions)
  if (!pathValidation.valid) {
    const errors = pathValidation.issues.filter(i => i.severity === 'error')
    errors.forEach(err => {
      showToast('error', err.message)
    })
    return
  }

  const warnings = pathValidation.issues.filter(i => i.severity === 'warning')
  warnings.forEach(warn => {
    showToast('warning', warn.message)
  })

  setQueryRunning(true)
  try {
    const options = {
      groupBy,
      dateGranularity,
      havings,
      pivot,
      pivotRowAggs,
      joinConfigs
    }

    const countSQL = generateCountSQL(
      gridColumns,
      addedTables,
      filters,
      tableRelationships,
      options
    )
    if (countSQL) {
      try {
        const countRes = await apiExecuteQuery(countSQL)
        const raw = countRes.data?.[0]?.total
        setTotalCount(typeof raw === 'number' ? raw : parseInt(raw, 10) || 0)
      } catch {
        setTotalCount(0)
      }
    }

    const sql = generateSQL(
      gridColumns,
      addedTables,
      filters,
      orderBy,
      currentPage,
      pageSize,
      tableRelationships,
      options
    )
    setExecutedSql(sql)

    const res = await apiExecuteQuery(sql)
    setResultData(res.data || [])
    showToast('success', `${res.count ?? res.data?.length ?? 0}건 조회 완료`)
  } catch (e) {
    showToast('error', e.message || '실행 실패')
  } finally {
    setQueryRunning(false)
  }
}, [
  gridColumns,
  addedTables,
  filters,
  orderBy,
  currentPage,
  pageSize,
  tableRelationships,
  joinConfigs,
  groupBy,
  dateGranularity,
  havings,
  pivot,
  pivotRowAggs,
  relationshipOptions,
  showToast
])
```

---

## 📊 3. 관계 시각화

### 파일: `Frontend/react-app/src/packages/report/components/RelationshipDiagram.jsx` (신규)

```jsx
/**
 * RelationshipDiagram.jsx
 * 테이블 관계 시각화 (SVG 다이어그램)
 */
import React, { useMemo, useState } from 'react'
import './RelationshipDiagram.css'

export default function RelationshipDiagram({
  tables = [],
  addedTables = [],
  relationshipOptions = {},
  onTableClick
}) {
  const [selectedTable, setSelectedTable] = useState(null)

  // 레이아웃 계산
  const layout = useMemo(() => {
    return calculateLayout(tables, relationshipOptions)
  }, [tables, relationshipOptions])

  // 관계 선 생성
  const edges = useMemo(() => {
    const result = []
    
    Object.keys(relationshipOptions).forEach(key => {
      const [from, to] = key.split('||')
      const fromPos = layout[from]
      const toPos = layout[to]
      
      if (!fromPos || !toPos) return
      
      const isActive = addedTables.includes(from) && addedTables.includes(to)
      const rel = relationshipOptions[key][0]
      
      result.push({
        from,
        to,
        fromPos,
        toPos,
        isActive,
        label: rel?.prevColumn || ''
      })
    })
    
    return result
  }, [layout, relationshipOptions, addedTables])

  const handleTableClick = (tableName) => {
    setSelectedTable(tableName)
    if (onTableClick) {
      onTableClick(tableName)
    }
  }

  return (
    <div className="relationship-diagram-container">
      <svg width="100%" height="600" className="relationship-diagram">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#666" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#4CAF50" />
          </marker>
        </defs>

        {/* 관계 선 */}
        <g className="edges">
          {edges.map((edge, i) => {
            const midX = (edge.fromPos.x + edge.toPos.x) / 2
            const midY = (edge.fromPos.y + edge.toPos.y) / 2
            
            return (
              <g key={i}>
                <line
                  x1={edge.fromPos.x}
                  y1={edge.fromPos.y}
                  x2={edge.toPos.x}
                  y2={edge.toPos.y}
                  stroke={edge.isActive ? '#4CAF50' : '#ddd'}
                  strokeWidth={edge.isActive ? 3 : 1.5}
                  markerEnd={`url(#${edge.isActive ? 'arrowhead-active' : 'arrowhead'})`}
                />
                <text
                  x={midX}
                  y={midY - 5}
                  fontSize="11"
                  fill={edge.isActive ? '#4CAF50' : '#999'}
                  textAnchor="middle"
                  className="edge-label"
                >
                  {edge.label}
                </text>
              </g>
            )
          })}
        </g>

        {/* 테이블 노드 */}
        <g className="nodes">
          {tables.map((table) => {
            const pos = layout[table.table_name]
            if (!pos) return null

            const isAdded = addedTables.includes(table.table_name)
            const isSelected = selectedTable === table.table_name
            const isAvailable = pos.level === 0 || addedTables.length === 0 || 
              hasConnectionTo(table.table_name, addedTables, relationshipOptions)

            return (
              <g
                key={table.table_name}
                transform={`translate(${pos.x - 60}, ${pos.y - 30})`}
                className={`table-node ${isAdded ? 'active' : ''} ${!isAvailable ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleTableClick(table.table_name)}
                style={{ cursor: isAvailable ? 'pointer' : 'not-allowed' }}
              >
                <rect
                  width="120"
                  height="60"
                  rx="8"
                  fill={isAdded ? '#4CAF50' : isAvailable ? '#2196F3' : '#ccc'}
                  stroke={isSelected ? '#FF9800' : 'none'}
                  strokeWidth="3"
                />
                <text
                  x="60"
                  y="30"
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="bold"
                >
                  {table.table_name}
                </text>
                <text
                  x="60"
                  y="48"
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  opacity="0.9"
                >
                  {table.size || ''}
                </text>
                
                {pos.level !== undefined && (
                  <text
                    x="8"
                    y="18"
                    fontSize="10"
                    fill="white"
                    opacity="0.7"
                  >
                    L{pos.level}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* 범례 */}
      <div className="diagram-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#4CAF50' }}></div>
          <span>추가됨</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#2196F3' }}></div>
          <span>추가 가능</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#ccc' }}></div>
          <span>추가 불가</span>
        </div>
      </div>
    </div>
  )
}


// ========== 헬퍼 함수 ==========

function calculateLayout(tables, relationshipOptions) {
  const graph = buildGraph(tables, relationshipOptions)
  const levels = assignLevels(graph)
  
  const positions = {}
  const width = 1000
  const levelHeight = 120
  
  Object.keys(levels).forEach(levelNum => {
    const level = parseInt(levelNum)
    const nodesInLevel = levels[level]
    const spacing = width / (nodesInLevel.length + 1)
    
    nodesInLevel.forEach((tableName, i) => {
      positions[tableName] = {
        x: spacing * (i + 1),
        y: level * levelHeight + 60,
        level
      }
    })
  })
  
  return positions
}

function buildGraph(tables, relationshipOptions) {
  const graph = {}
  
  tables.forEach(t => {
    graph[t.table_name] = { children: [], parents: [] }
  })
  
  Object.keys(relationshipOptions).forEach(key => {
    const [from, to] = key.split('||')
    const rel = relationshipOptions[key][0]
    
    if (!rel) return
    
    // from이 _id를 가지면 from이 자식, to가 부모
    if (rel.prevColumn && rel.prevColumn.endsWith('_id')) {
      if (graph[from]) graph[from].parents.push(to)
      if (graph[to]) graph[to].children.push(from)
    }
  })
  
  return graph
}

function assignLevels(graph) {
  const levels = {}
  const visited = new Set()
  
  // 루트 노드 (부모 없는 노드)
  const roots = Object.keys(graph).filter(
    node => graph[node].parents.length === 0
  )
  
  // BFS
  const queue = roots.map(r => ({ node: r, level: 0 }))
  
  while (queue.length > 0) {
    const { node, level } = queue.shift()
    
    if (visited.has(node)) continue
    visited.add(node)
    
    if (!levels[level]) levels[level] = []
    levels[level].push(node)
    
    graph[node].children.forEach(child => {
      if (!visited.has(child)) {
        queue.push({ node: child, level: level + 1 })
      }
    })
  }
  
  // 미방문 노드
  const maxLevel = Math.max(...Object.keys(levels).map(Number), 0)
  Object.keys(graph).forEach(node => {
    if (!visited.has(node)) {
      if (!levels[maxLevel + 1]) levels[maxLevel + 1] = []
      levels[maxLevel + 1].push(node)
    }
  })
  
  return levels
}

function hasConnectionTo(tableName, addedTables, relationshipOptions) {
  if (addedTables.length === 0) return true
  
  return addedTables.some(added => {
    const key1 = `${tableName}||${added}`
    const key2 = `${added}||${tableName}`
    return relationshipOptions[key1] || relationshipOptions[key2]
  })
}
```

---

### 파일: `Frontend/react-app/src/packages/report/components/RelationshipDiagram.css` (신규)

```css
.relationship-diagram-container {
  position: relative;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.relationship-diagram {
  display: block;
  background: white;
  border-radius: 4px;
}

.table-node {
  transition: all 0.2s ease;
}

.table-node:hover:not(.disabled) {
  filter: brightness(1.1);
}

.table-node.selected rect {
  filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.6));
}

.table-node.disabled {
  opacity: 0.4;
}

.edge-label {
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.diagram-legend {
  display: flex;
  gap: 20px;
  margin-top: 15px;
  padding: 10px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.legend-color {
  width: 24px;
  height: 16px;
  border-radius: 3px;
}
```

---

### 파일: `Frontend/react-app/src/packages/report/ReportPage.jsx` (다이어그램 추가)

```jsx
// import 추가
import RelationshipDiagram from './components/RelationshipDiagram'


// render 부분 (return 안에)
return (
  <div className="report-page">
    <header className="report-header">
      <h1>📊 리포트 빌더</h1>
    </header>

    {/* ========== 📊 관계 다이어그램 ========== */}
    <details className="relationship-diagram-section">
      <summary>
        <h3>🔗 테이블 관계 다이어그램</h3>
      </summary>
      <RelationshipDiagram
        tables={tables}
        addedTables={addedTables}
        relationshipOptions={relationshipOptions}
        onTableClick={(tableName) => {
          console.log('Clicked table:', tableName)
        }}
      />
    </details>

    <div className="report-body">
      <Sidebar
        tables={tables}
        tableRelationships={tableRelationships}
        relationshipOptions={relationshipOptions}
        addedTables={addedTables}
        loading={loading}
        dbStatus={dbStatus}
      />

      <MainArea
        // ... 기존 props
      />
    </div>
  </div>
)
```

---

## ✅ 구현 완료 체크리스트

### 백엔드
- [ ] `Backend/api_server/pluralize.py` 생성
- [ ] `Backend/api_server/routers/report.py` 수정
  - [ ] import 추가
  - [ ] find_parent_table 사용
  - [ ] relationship_type 추가

### 프론트엔드
- [ ] `Frontend/react-app/src/packages/report/utils/safetyCheck.js` 생성
- [ ] `Frontend/react-app/src/packages/report/ReportPage.jsx` 수정
  - [ ] import 추가
  - [ ] addColumn에 안전성 검증 추가
  - [ ] runExecuteQuery에 경로 검증 추가
  - [ ] RelationshipDiagram 추가
- [ ] `Frontend/react-app/src/packages/report/components/RelationshipDiagram.jsx` 생성
- [ ] `Frontend/react-app/src/packages/report/components/RelationshipDiagram.css` 생성

---

## 📋 To-Do 리스트 (꼼꼼 완전판)

> 아래 항목을 하나씩 체크하며 구현하세요. 빼먹지 말 것.

### 1. 백엔드 — pluralize.py (신규)
- [ ] **1.1** 파일 생성: `Backend/api_server/pluralize.py`
- [ ] **1.2** `pluralize(word)` 구현
  - [ ] 자음+y → ies (company → companies)
  - [ ] s, ss, x, z, ch, sh → es
  - [ ] 기본: +s (workflow → workflows)
  - [ ] 입력 소문자화
- [ ] **1.3** `find_parent_table(column_name, allowed_tables)` 구현
  - [ ] _id로 끝나지 않으면 None
  - [ ] base = column_name[:-3].rstrip('_')
  - [ ] 1) 정확 일치(단수): base.lower() in allowed_set → 원본 테이블명 반환
  - [ ] 2) 복수형 매칭: pluralize(base) in allowed_set
  - [ ] 3) 복합 단어: parts = base.split('_'), 마지막만 복수형 변환 후 compound 매칭
  - [ ] 대소문자 무관(allowed_set은 lower, 반환은 allowed_tables 원본)

### 2. 백엔드 — report.py (수정)
- [ ] **2.1** 상단에 import 추가: `from Backend.api_server.pluralize import find_parent_table` (또는 프로젝트 구조에 맞게)
- [ ] **2.2** 1단계 FK 관계
  - [ ] 기존 SQL 유지, 응답에 `relationship_type: "N:1"`, `reason: "DB FK 제약조건"` 추가
- [ ] **2.3** 2단계 _id 추론
  - [ ] 기존 수동 base/to_table 로직 제거
  - [ ] `parent_table = find_parent_table(col_name, allowed)` 사용
  - [ ] 중복 방지: existing = set((from_table, from_column, to_table, to_column))
  - [ ] 관계 추가 시 `relationship_type: "N:1"`, reason f"_id 패턴: {col_name} → {parent_table}.id"
- [ ] **2.4** 예외 처리: except 블록에 `import traceback` 및 `traceback.print_exc()` 추가

### 3. 프론트엔드 — safetyCheck.js (신규)
- [ ] **3.1** 파일 생성: `Frontend/react-app/src/packages/report/utils/safetyCheck.js`
- [ ] **3.2** `detectCircularReference(proposedPath)` 구현
  - [ ] seen Set으로 중복 테이블 감지
  - [ ] 반환: { circular: true, duplicate, path, circularPart } 또는 { circular: false }
- [ ] **3.3** `detectManyToMany(table1, table2, relationshipOptions)` 구현
  - [ ] key1/key2로 옵션 조회
  - [ ] prevColumn/currColumn 둘 다 _id로 끝나고 동일하면 N:N
  - [ ] 반환: { isManyToMany, reason, suggestion }
- [ ] **3.4** `canAddTableSafely(addedTables, newTable, intermediateParent, relationshipOptions)` 구현
  - [ ] 이미 추가된 테이블 → ok: false, severity: warning
  - [ ] intermediateParent가 이미 addedTables에 있음 → ok: false, severity: info
  - [ ] proposedPath = intermediateParent ? [...addedTables, intermediateParent, newTable] : [...addedTables, newTable]
  - [ ] detectCircularReference(proposedPath) → circular이면 ok: false, severity: error
  - [ ] proposedPath.length > 10 → ok: false, severity: warning
  - [ ] intermediateParent 없을 때 detectManyToMany(lastTable, newTable) → N:N이면 ok: false, severity: error
  - [ ] 그 외 → ok: true
- [ ] **3.5** `validateJoinPath(addedTables, relationshipOptions)` 구현
  - [ ] 순환 참조 체크 → issues에 CIRCULAR_REFERENCE
  - [ ] 인접 쌍마다 관계 존재 여부 → 없으면 NO_RELATIONSHIP
  - [ ] 인접 쌍마다 detectManyToMany → N:N이면 MANY_TO_MANY warning
  - [ ] valid = error 개수 0

### 4. 프론트엔드 — ReportPage.jsx (안전성 적용)
- [ ] **4.1** import 추가: `canAddTableSafely`, `validateJoinPath` from `'./utils/safetyCheck'`
- [ ] **4.2** addColumn 수정
  - [ ] 직접 추가 시: intermediateParent = null
  - [ ] findIntermediateParent 쓸 때: intermediateParent 저장, newAddedTables = [...addedTables, intermediateParent, newTable]
  - [ ] tableAlreadyAdded가 아닐 때만: canAddTableSafely(addedTables, columnInfo.table, intermediateParent, relationshipOptions) 호출
  - [ ] !safetyCheck.ok일 때: severity error면 showToast('error', reason), detail/suggestion 처리 후 return
  - [ ] severity warning이면 showToast('warning', reason), suggestion 표시
  - [ ] 중간 부모 경유 시 토스트: `'${intermediateParent}' 테이블을 거쳐 '${columnInfo.table}'를 추가했습니다`
- [ ] **4.3** runExecuteQuery 수정
  - [ ] 컬럼 0개 체크 직후: validateJoinPath(addedTables, relationshipOptions)
  - [ ] !pathValidation.valid면 error 이슈만 토스트 후 return
  - [ ] warning 이슈들 각각 showToast('warning', message)
  - [ ] useCallback 의존성 배열에 relationshipOptions 추가

### 5. 프론트엔드 — RelationshipDiagram.jsx (신규)
- [ ] **5.1** 파일 생성: `Frontend/react-app/src/packages/report/components/RelationshipDiagram.jsx`
- [ ] **5.2** props: tables, addedTables, relationshipOptions, onTableClick
- [ ] **5.3** state: selectedTable
- [ ] **5.4** useMemo layout: calculateLayout(tables, relationshipOptions) → { table_name: { x, y, level } }
- [ ] **5.5** buildGraph: 테이블별 { children, parents }; relationshipOptions에서 prevColumn.endsWith('_id')면 from=자식 to=부모
- [ ] **5.6** assignLevels: 부모 없는 노드 = 루트(level 0), BFS로 level 부여, 미방문은 maxLevel+1
- [ ] **5.7** positions: 레벨별로 width 1000, levelHeight 120, spacing으로 x,y 계산
- [ ] **5.8** useMemo edges: relationshipOptions 순회, fromPos/toPos, isActive(둘 다 addedTables에 있음), label(prevColumn)
- [ ] **5.9** SVG: defs (arrowhead, arrowhead-active), g.edges (line + text), g.nodes (rect 120x60, 테이블명, size, L0/L1)
- [ ] **5.10** hasConnectionTo(tableName, addedTables, relationshipOptions): addedTables와 관계 있거나 addedTables 비어 있으면 true
- [ ] **5.11** 노드 클릭: setSelectedTable, onTableClick?.(tableName); disabled면 cursor not-allowed
- [ ] **5.12** 범례: 추가됨(녹색), 추가 가능(파랑), 추가 불가(회색)

### 6. 프론트엔드 — RelationshipDiagram.css (신규)
- [ ] **6.1** 파일 생성: `Frontend/react-app/src/packages/report/components/RelationshipDiagram.css`
- [ ] **6.2** .relationship-diagram-container (배경, 테두리, padding, margin)
- [ ] **6.3** .relationship-diagram (block, 배경 흰색, border-radius)
- [ ] **6.4** .table-node (transition), :hover:not(.disabled) filter, .selected rect drop-shadow, .disabled opacity
- [ ] **6.5** .edge-label (font-family Courier, font-weight)
- [ ] **6.6** .diagram-legend, .legend-item, .legend-color

### 7. 프론트엔드 — ReportPage.jsx (다이어그램 연동)
- [ ] **7.1** import: `RelationshipDiagram` from `'./components/RelationshipDiagram'`
- [ ] **7.2** return 구조: report-page > report-header(h1) + relationship-diagram-section(details/summary) + report-body(Sidebar, MainArea)
- [ ] **7.3** details.summary: "🔗 테이블 관계 다이어그램"
- [ ] **7.4** RelationshipDiagram에 tables, addedTables, relationshipOptions, onTableClick 전달

### 8. 테스트 시나리오
- [ ] **8.1** 복합 단어: primary_workflow_id → primary_workflows 자동 감지 및 JOIN 성공
- [ ] **8.2** 순환 참조: A→B→C→A 후 A 재추가 시도 → 에러 메시지
- [ ] **8.3** N:N: campaigns–channels 직접 추가 → 차단; workflows 먼저 추가 후 channels → 성공
- [ ] **8.4** 다이어그램: 펼치기, L0/L1/L2 표시, 테이블 클릭 선택, 추가된 테이블 녹색

---

## 🎯 개선 효과

### 1. 관계 자동 분석
- ✅ **복합 단어 처리**: primary_workflow_id → primary_workflows
- ✅ **대소문자 무관**: Workflows, workflows 모두 매칭
- ✅ **기본 복수형**: workflow → workflows, company → companies

### 2. 안전성
- ✅ **순환 참조 차단**: A → B → C → A 방지
- ✅ **N:N 차단**: workflow_id = workflow_id 방지
- ✅ **경로 길이 제한**: 최대 10단계
- ✅ **상세 에러 메시지**: 원인 + 해결책 제시

### 3. 시각화
- ✅ **SVG 다이어그램**: 관계 시각적 표시
- ✅ **계층 레이아웃**: 부모-자식 구조 표현
- ✅ **상태 표시**: 추가됨/가능/불가 색상 구분
- ✅ **레벨 표시**: L0, L1, L2 계층 표시

---

## 🚀 테스트 시나리오

### 시나리오 1: 복합 단어 처리
```
DB:
  primary_workflows 테이블
  campaigns 테이블 (primary_workflow_id 컬럼)

테스트:
1. campaigns 컬럼 선택
2. primary_workflows 자동 감지 확인
3. JOIN 성공 확인
```

### 시나리오 2: 순환 참조 차단
```
DB:
  A → B (a_id)
  B → C (b_id)
  C → A (c_id)

테스트:
1. A 선택
2. B 추가 (성공)
3. C 추가 (성공)
4. A 다시 추가 시도 → 에러 메시지 확인
```

### 시나리오 3: N:N 차단
```
DB:
  campaigns (workflow_id)
  channels (workflow_id)

테스트:
1. campaigns 선택
2. channels 추가 시도 → 에러 (N:N)
3. workflows 먼저 추가 → 성공
4. channels 추가 → 성공
```

### 시나리오 4: 다이어그램
```
테스트:
1. 다이어그램 펼치기
2. 계층 구조 확인 (L0, L1, L2)
3. 테이블 클릭 → 선택 표시 확인
4. 추가된 테이블 → 녹색 표시 확인
```

---

## 📝 최종 정리

**핵심 개선 3가지:**

1. **관계 자동 분석 강화** (복합 단어, 대소문자)
2. **안전성 검증** (순환 참조, N:N 차단)
3. **관계 시각화** (SVG 다이어그램)

**모든 코드 준비 완료!** 🎉
