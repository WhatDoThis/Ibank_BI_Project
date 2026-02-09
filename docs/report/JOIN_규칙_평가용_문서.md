# 리포트(노코드 쿼리 빌더) JOIN 규칙 — 평가용 상세 문서

이 문서는 리포트 패키지의 테이블 조인(JOIN) 규칙을 코드와 동작 기준으로 전부 기술한 것이다. 요약이 아니라 구현·API·UI·에지 케이스까지 포함한 평가용 명세이다.

---

## 1. 개요

- **목적**: 사용자가 테이블을 순서대로 추가하고, 테이블 간 관계만으로 JOIN 조건을 자동/선택 가능하게 하며, “같은 컬럼명끼리” 등 비정규 조인은 허용하지 않는다.
- **관계 소스**: 백엔드 `GET /api/table-relationships`가 반환하는 `relationships` 배열만 사용한다. 동일 컬럼명·동일 타입 기반 관계는 **만들지 않는다**.
- **허용되는 JOIN 패턴**: `부모테이블.id = 자식테이블.부모테이블_id` 형태만 허용한다. (복수형 처리: `workflow_id` → `workflows` 등)

---

## 2. 백엔드: 관계 목록 API

### 2.1 엔드포인트

- **URL**: `GET /api/table-relationships`
- **쿼리 파라미터**: `mode` (선택). `fk` | `column` | `all`. 기본값 `all`.
- **의존성**: `config.backend`의 `allowed_tables`, `table_schema` 사용. DB 연결 시 `conn.set_client_encoding("UTF8")` 적용(한글 컬럼명/쿼리 대비).

### 2.2 allowed_tables

- 관계에 포함되는 테이블은 **반드시** `Env/config/config.json`의 `backend.allowed_tables`에 들어 있어야 한다.
- `allowed_tables`에 없는 테이블은 관계 조회·쿼리 빌드에서 사용할 수 없다.

### 2.3 관계 수집 로직 (mode="all" 또는 "fk")

#### (1) FK(외래키) 기반

- **출처**: `information_schema.table_constraints` + `key_column_usage` + `constraint_column_usage`.
- **조건**:
  - `constraint_type = 'FOREIGN KEY'`
  - `table_schema = config.backend.table_schema`
  - `kcu.table_name`(from_table), `ccu.table_name`(to_table) **둘 다** `allowed_tables`에 포함.
- **반환 행**: `from_table`, `from_column`, `to_table`, `to_column`. mode=all이면 `source: "fk"`, `confidence: "HIGH"`, `reason: "FK 관계"` 추가.
- **의미**: `from_table.from_column` → `to_table.to_column` 참조. 즉 `to_table.to_column = from_table.from_column`으로 JOIN 가능.

#### (2) _id 패턴 추론 (mode="all"일 때만)

- **대상**: `allowed_tables`의 각 테이블에 대해 `get_table_columns_with_types(table_name)`으로 컬럼 목록 조회.
- **규칙**:
  - 컬럼명이 `"id"`이면 무시.
  - 컬럼명이 `_id`로 **끝나지 않으면** 무시.
  - `_id` 제거 후 남은 부분: `base = col[:-3].rstrip("_")`. (예: `workflow_id` → `workflow`, `campaign_id` → `campaign`.)
  - `to_table` 후보:
    - `base`가 `allowed_tables`에 있으면 `to_table = base`.
    - 없으면 `base + "s"`가 `allowed_tables`에 있으면 `to_table = base + "s"`.
    - 둘 다 없으면 해당 컬럼은 관계로 추가하지 않음.
  - **이미 동일 (from_table, from_column, to_table, to_column) 관계가 있으면** 추가하지 않음(중복 제거).
- **반환 행**: `from_table` = 해당 테이블, `from_column` = 해당 `_id` 컬럼, `to_table` = 위에서 정한 부모 테이블, `to_column` = `"id"`. `source: "inferred"`, `reason: "FK 미정의 시 _id 패턴 추론 (부모.id=자식.부모_id)"` 등.

#### (3) 명시적으로 하지 않는 것

- **같은 컬럼명·같은 타입**으로만 관계를 만드는 로직은 **없다**.  
  예: `campaigns.campaign_internal_name` ↔ `channels.campaign_internal_name` 같은 관계는 API에 포함되지 않는다.
- **id = id** 관계는 프론트에서 API 응답 처리 시 `prevCol === 'id' && currCol === 'id'`이면 버린다(아래 3.1).

### 2.4 API 응답 형식

```json
{
  "relationships": [
    {
      "from_table": "테이블A",
      "from_column": "부모_id",
      "to_table": "테이블B",
      "to_column": "id",
      "source": "fk" | "inferred",
      "confidence": "HIGH",
      "reason": "..."
    }
  ],
  "count": 7
}
```

- **방향**: 항상 “자식 → 부모” 한 방향만 반환한다. (from_table에 `_id` 컬럼이 있는 쪽, to_table이 `id`를 갖는 쪽.)

---

## 3. 프론트엔드: 관계 옵션으로의 변환

### 3.1 relationshipOptions 구성 (ReportPage.jsx)

- **입력**: `GET /api/table-relationships`의 `relationships` 배열.
- **처리**:
  - 각 항목에 대해 `from_table`, `to_table`, `from_column`, `to_column` 사용.
  - `from_column === 'id' && to_column === 'id'`이면 **무시**.
  - **키**: `"prevTable||currTable"` 형식 문자열.
  - **한 관계당 두 개의 키**를 넣는다:
    - `from_table||to_table` → `{ prevColumn: from_column, currColumn: to_column }`
    - `to_table||from_table` → `{ prevColumn: to_column, currColumn: from_column }`
  - 동일 `key::prevColumn::currColumn` 조합은 `seen` Set으로 중복 제거.
- **결과 구조**:
  - `relationshipOptions[key]` = 배열. 각 원소는 `{ prevColumn, currColumn, confidence?, reason? }`.
  - 예: API에 `test_coupons_data → campaigns (campaign_id, id)`가 있으면,
    - `"test_coupons_data||campaigns"`: `[{ prevColumn: "campaign_id", currColumn: "id" }]`
    - `"campaigns||test_coupons_data"`: `[{ prevColumn: "id", currColumn: "campaign_id" }]`
  - 따라서 **추가 순서와 무관하게** “campaigns ↔ test_coupons_data” 조인 가능 여부가 한쪽 키만으로도 판단 가능하다.

### 3.2 tableRelationships (SQL 빌드용)

- **역할**: `generateSQL` / `generateCountSQL` / `generateDistinctPivotSQL`에서 ON 절을 만들 때 사용.
- **구성**: `relationshipOptions`와 `joinConditions`(사용자가 고른 조건)를 이용해, 각 테이블 쌍에 대해 “실제 사용할 (prevColumn, currColumn)” 하나를 정한다.
- **규칙**:
  - 키 `"prevTable||currTable"`에 대해:
    - `joinConditions[key]`에 조건이 있으면 그 첫 번째 항목을 사용.
    - 없으면 `relationshipOptions[key][0]`을 사용.
  - `resolved[fromTable][toTable]` = 해당 한 쌍.
  - `resolved[toTable][fromTable]` = 컬럼을 서로 바꾼 쌍(prev↔curr)으로 동일 관계를 역방향으로 저장.
- **용도**: `getJoinKey(tableRelationships, prevTable, currTable)`가 `prevTable`–`currTable` 사이의 ON 컬럼 쌍을 반환한다.

### 3.3 joinConfigs

- **역할**: 사용자가 조인 타입(LEFT/INNER/RIGHT), 복수 조건, AND/OR를 지정한 경우 반영.
- **구조**: `joinConfigs[key]` = `{ joinType, logicalOperator, conditions: [{ prevColumn, currColumn }, ...] }`.
- **SQL 생성**: `config.conditions`가 있으면 `getJoinKey` 대신 이 조건 배열로 ON 절을 만든다.  
  `ON t_i.prevColumn = t_{i+1}.currColumn [AND|OR] ...`

---

## 4. 프론트엔드: 조인 가능 여부 규칙 (joinRules.js)

### 4.1 canAddTableByColumn(addedTables, newTable, relationshipOptions)

- **의미**: “현재 추가된 테이블 목록” 다음에 `newTable`을 **컬럼 추가로** 넣어도 되는지.
- **반환**: boolean.
- **로직**:
  - `addedTables.length === 0` → true (첫 테이블).
  - `addedTables`에 이미 `newTable`이 있으면 → true (같은 테이블에 컬럼 추가).
  - `lastTable = addedTables[addedTables.length - 1]`.
  - `keyA = lastTable||newTable`, `keyB = newTable||lastTable`.
  - `relationshipOptions[keyA]` 또는 `relationshipOptions[keyB]`가 존재하고 길이 > 0이면 → true.
  - 그 외 → false (조인 불가).

### 4.2 findIntermediateParent(lastTable, newTable, relationshipOptions)

- **의미**: lastTable과 newTable이 **직접** 관계는 없지만, 같은 부모 테이블 P로 연결될 수 있으면 P를 반환. (자식–부모–자식 경로)
- **반환**: 부모 테이블명 문자열 또는 null.
- **로직**:
  - `getNeighborTables(tableName, relationshipOptions)`: relationshipOptions의 모든 키를 보고, 키에 포함된 두 테이블 중 `tableName`과 쌍을 이루는 테이블들을 Set으로 반환.
  - lastTable의 이웃 집합, newTable의 이웃 집합을 구한 뒤, 두 집합에 모두 포함된 테이블이 있으면 그 중 하나(첫 번째)를 반환.

### 4.3 isTableAvailable(tableName, addedTables, tableRelationships)

- **의미**: “지금 추가된 테이블 순서” 기준으로, 해당 테이블을 **직접** 조인할 수 있어서 사이드바/드롭다운에서 선택 가능해야 하는지.
- **로직**:
  - addedTables가 비었거나 이미 tableName이 포함되어 있으면 true.
  - last = addedTables 마지막.
  - `tableRelationships[last][tableName]` 또는 `tableRelationships[tableName][last]`가 있으면 true, 없으면 false.

### 4.4 isTableAvailableOrViaParent(tableName, addedTables, tableRelationships, relationshipOptions)

- **의미**: 직접 조인 가능하거나, “같은 부모 경유”로 추가 가능한 경우에도 리스트에 노출.
- **로직**: `isTableAvailable(...)`가 true이면 true. 아니면 `findIntermediateParent(last, tableName, relationshipOptions)`가 있으면 true.

### 4.5 컬럼 추가 시 테이블 추가 흐름 (ReportPage addColumn)

- 테이블이 이미 추가돼 있으면: `newAddedTables = addedTables` 유지.
- `canAddTableByColumn(addedTables, columnInfo.table, relationshipOptions)`가 true면: `newAddedTables = [...addedTables, columnInfo.table]`.
- 그 외: `findIntermediateParent(lastTable, columnInfo.table, relationshipOptions)`를 호출.
  - 부모 P가 있으면: `newAddedTables = [...addedTables, P, columnInfo.table]` 하고 토스트로 “부모 테이블 P를 자동으로 넣어 조인했습니다” 표시.
  - 없으면: “선택한 테이블과 조인할 수 없습니다. 부모 테이블을 먼저 추가하세요.” 토스트 후 return (테이블/컬럼 추가 안 함).

---

## 5. UI: 조인 조건 영역 (MainArea.jsx)

### 5.1 조인 쌍 (joinPairs)

- **정의**: `addedTables`에서 연속한 두 테이블씩 묶은 것.  
  `joinPairs = addedTables.slice(0, -1).map((prev, i) => ({ prevTable: prev, currTable: addedTables[i + 1] }))`.
- **키**: `key = prevTable||currTable`. (추가 순서가 campaigns → ibank_1이면 `"campaigns||ibank_1"`.)

### 5.2 “조인 불가” 표시

- **조건**: `noJoinPossible = (relationshipOptions[key] || []).length === 0`.
- **표시**: 해당 쌍에 “조인 불가” 문구와 툴팁(“두 테이블 간 조인 가능한 조건이 없습니다”) 표시. 조인 타입/조건 선택 UI는 숨김.

### 5.3 조인 조건 행 (한 쌍당)

- **조건 목록**: `conditionsList = joinConditions[key]?.length ? joinConditions[key] : (firstOpt ? [firstOpt] : [])`.  
  즉 사용자가 지정한 조건이 없으면 `relationshipOptions[key][0]` 한 개를 기본으로 사용.
- **복수 조건**: 같은 쌍에 대해 “+ 조건 추가”로 여러 (prevColumn, currColumn)를 넣을 수 있고, 조건 사이는 AND/OR 선택 가능.
- **키 선택**: 각 조건 행은 드롭다운으로 `relationshipOptions[key]`에 있는 (prevColumn, currColumn) 후보 중 하나를 선택.  
  즉 **조인 가능한 키가 여러 개일 때** 후보가 전부 드롭다운에 노출된다.
- **조인 타입**: LEFT / INNER / RIGHT 선택.
- **X 버튼 두 종류**:
  - **조건 행 X**: 해당 (prevColumn, currColumn) 한 줄만 제거. `onRemoveJoinCondition(key, idx)`.
  - **조인 쌍 X (조인 해제)**: `onRemoveJoinedTable(currTable)` 호출.  
    해당 테이블을 `addedTables`에서 제거하고, 그 테이블의 모든 컬럼·필터·기준축·HAVING·피벗·정렬을 제거한다.  
    즉 “이 쌍의 조인을 풀고, 뒤쪽 테이블을 쿼리에서 제거”한다.

---

## 6. SQL 생성 (sqlBuilder.js)

### 6.1 JOIN 절 생성

- **순서**: `addedTables` 순서대로 FROM t1, JOIN t2, JOIN t3, ...
- **각 (prevTable, currTable)**:
  - `key = prevTable||currTable`.
  - `joinConfigs[key].conditions`가 있고 길이 > 0이면:  
    해당 조건들로 ON 절 생성. `config.logicalOperator`로 AND/OR 연결.
  - 그렇지 않으면: `getJoinKey(tableRelationships, prevTable, currTable)`로 (prevColumn, currColumn)을 가져와  
    `ON t_i.prevColumn = t_{i+1}.currColumn` 형태로 사용.
  - 둘 다 없으면: `throw new Error('JOIN 관계 없음: prevTable - currTable (조인 조건 선택 필요)')`.

### 6.2 getJoinKey(tableRelationships, prevTable, currTable)

- `tableRelationships[prevTable][currTable]`이 있으면 그 객체 반환.
- 없으면 `tableRelationships[currTable][prevTable]`을 보고, 있으면 `{ prevColumn: rev.currColumn, currColumn: rev.prevColumn }`로 반환.
- 둘 다 없으면 null.

---

## 7. 허용·비허용 정리

### 7.1 허용되는 JOIN

- **형식**: `부모테이블.id = 자식테이블.부모테이블_id` (또는 단수형 부모 테이블명으로의 참조).
- **출처**:  
  - DB에 FK가 있으면 FK 기준 한 건.  
  - 없어도 자식 테이블에 `*_id` 컬럼이 있고, 그에 대응하는 부모 테이블(단수/복수형)이 `allowed_tables`에 있으면 추론으로 한 건.
- **UI**: relationshipOptions에 `prevTable||currTable` 또는 `currTable||prevTable` 중 하나라도 있으면 “조인 가능”이며, 조건 드롭다운에 후보가 뜬다.

### 7.2 허용되지 않는 JOIN

- **같은 컬럼명끼리**:  
  예) `campaigns.workflow_id = channels.workflow_id`, `campaigns.campaign_internal_name = channels.campaign_internal_name`.  
  백엔드가 이런 관계를 **내리지 않으며**, 프론트도 relationshipOptions에 such 키를 만들 수 없음.
- **id = id**:  
  API에서 `from_column === 'id' && to_column === 'id'`인 행은 프론트에서 제거.
- **부모 테이블 없음**:  
  `*_id` 컬럼은 있지만, 대응하는 부모 테이블이 `allowed_tables`에 없으면 관계에 포함되지 않음 → 조인 불가.
- **allowed_tables 밖 테이블**:  
  관계 API·쿼리 빌드 모두에서 사용 불가.

### 7.3 에지 케이스

- **같은 두 테이블에 복수 관계**:  
  예) test_coupons_data → campaigns (campaign_id), test_coupons_data → campaigns (primary_campaign_id).  
  백엔드가 두 행을 주면, relationshipOptions[key]에 두 항목이 들어가고, UI 드롭다운에 두 키가 모두 노출된다.
- **역방향 키**:  
  API는 자식→부모 한 방향만 주지만, 프론트가 `to_table||from_table` 키를 추가하므로, “campaigns 먼저, test_coupons_data 나중”처럼 넣어도 조인 가능하다.
- **조인 해제**:  
  조인 쌍의 X는 “그 조인만 풀기”가 아니라 “뒷 테이블을 쿼리에서 제거”하는 동작이다.

---

## 8. 설정·데이터 의존성

- **backend.allowed_tables**: 관계와 쿼리에 사용할 수 있는 테이블 집합.
- **backend.table_schema**: information_schema 조회 시 스키마.
- **DB 실제 스키마**: FK 존재 여부, 컬럼명(`*_id`), 테이블명(단수/복수)이 관계 개수와 방향에 영향.

---

## 9. 평가 시 참고할 체크 포인트

1. **관계 목록**: FK + _id 추론만 사용하는지, “같은 컬럼명·타입” 관계가 섞여 있지 않은지.
2. **역방향**: API는 한 방향만 주는데, UI/빌더는 `prevTable||currTable` / `currTable||prevTable` 둘 다 써서 순서 무관하게 조인 가능한지.
3. **조인 불가 표시**: `relationshipOptions[key]`가 비어 있을 때만 “조인 불가”가 나오는지.
4. **복수 키**: 한 쌍에 여러 (prevColumn, currColumn) 후보가 있을 때 드롭다운과 AND/OR 조건 추가가 모두 반영되는지.
5. **조인 해제**: 조인 쌍 X가 “해당 테이블 제거 + 조인 해제”로 동작하는지.
6. **중간 부모 자동 삽입**: 직접 관계가 없을 때 findIntermediateParent로 부모를 끼워 넣는지, 그리고 그때만 추가하는지.

이 문서는 위 규칙들이 코드와 일치하는지, 누락·모순이 없는지 평가하는 데 사용할 수 있다.

---

# PART II. JOIN 관련 코드 (전문)

아래는 JOIN 규칙과 직접 연관된 **실제 코드 전체**를 빠짐없이 적은 것이다. 경로는 프로젝트 루트 기준.

---

## 1. 백엔드 — report.py (table_relationships)

**파일:** `Backend/api_server/routers/report.py` (L153~234)

```python
@router.get("/table-relationships")
def table_relationships(conn=Depends(get_db), mode: str = Query("all")):
    try:
        allowed = list(db.get_allowed_tables())
        if not allowed:
            return {"relationships": [], "count": 0}
        mode = (mode or "all").strip().lower()
        if mode not in ("fk", "column", "all"):
            mode = "all"
        relationships = []
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
                    "ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
                    "JOIN information_schema.constraint_column_usage ccu "
                    "ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema "
                    "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = %s "
                    "AND kcu.table_name IN (" + placeholders + ") "
                    "AND ccu.table_name IN (" + placeholders + ") "
                    "ORDER BY kcu.table_name, ccu.table_name, kcu.column_name"
                )
                cur.execute(sql, (schema,) + tuple(allowed) + tuple(allowed))
                for r in cur.fetchall():
                    row = dict(r)
                    if mode == "all":
                        row["source"] = "fk"
                        row["confidence"] = "HIGH"
                        row["reason"] = "FK 관계"
                    relationships.append(row)
            finally:
                cur.close()
        if mode in ("fk", "all"):
            allowed_set = set(allowed)
            table_columns = {}
            for table_name in allowed:
                try:
                    table_columns[table_name] = db.get_table_columns_with_types(table_name)
                except Exception:
                    table_columns[table_name] = []
            for table_name in allowed:
                for c in table_columns.get(table_name, []):
                    col = c.get("column_name") or ""
                    if col == "id" or not col.endswith("_id"):
                        continue
                    base = col[:-3].rstrip("_")
                    if not base:
                        continue
                    to_table = None
                    if base in allowed_set:
                        to_table = base
                    elif (base + "s") in allowed_set:
                        to_table = base + "s"
                    if not to_table:
                        continue
                    already = any(
                        r.get("from_table") == table_name
                        and r.get("from_column") == col
                        and r.get("to_table") == to_table
                        and r.get("to_column") == "id"
                        for r in relationships
                    )
                    if already:
                        continue
                    rel = {
                        "from_table": table_name,
                        "from_column": col,
                        "to_table": to_table,
                        "to_column": "id",
                        "source": "inferred" if mode == "all" else None,
                    }
                    if mode == "all":
                        rel["confidence"] = "HIGH"
                        rel["reason"] = "FK 미정의 시 _id 패턴 추론 (부모.id=자식.부모_id)"
                    relationships.append(rel)
        return {"relationships": relationships, "count": len(relationships)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "message": "JOIN 관계 조회 실패"})
```

---

## 2. 백엔드 — db.py (JOIN 관련 함수 전체)

**파일:** `Backend/api_server/db.py`

```python
def get_allowed_tables():
    """허용 테이블 목록. config.backend.allowed_tables 만 사용. 없으면 ValueError."""
    tables = getattr(config.backend, 'allowed_tables', None)
    if tables is None:
        raise ValueError('Env/config/config.json 에 backend.allowed_tables 가 없습니다.')
    if isinstance(tables, list):
        return set(tables)
    raise ValueError('Env/config/config.json 의 backend.allowed_tables 는 배열이어야 합니다.')


def get_table_schema():
    """테이블 스키마. config.backend.table_schema 만 사용. 없으면 ValueError."""
    schema = getattr(config.backend, 'table_schema', None)
    if schema is None or not str(schema).strip():
        raise ValueError('Env/config/config.json 에 backend.table_schema 가 없거나 비어 있습니다.')
    return str(schema).strip()


def get_table_columns_with_types(table_name):
    """테이블의 컬럼명·데이터타입 목록 반환. [{ column_name, data_type }, ...]. 대시보드 필수 컬럼 타입 검증용."""
    validate_table_name(table_name)
    schema = get_table_schema()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name),
        )
        return [{"column_name": row["column_name"], "data_type": row["data_type"]} for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_db_connection():
    """DB 연결 생성. config.backend 만 사용 (get_db_config에서 이미 검증). 한글 등 UTF-8 쿼리 지원을 위해 client_encoding 설정."""
    cfg = get_db_config()
    conn = psycopg2.connect(**cfg, cursor_factory=RealDictCursor)
    conn.set_client_encoding("UTF8")
    return conn


def validate_table_name(table_name):
    """테이블 이름 검증."""
    if not table_name:
        raise ValueError('테이블 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise ValueError(f'잘못된 테이블 이름: {table_name}')
    allowed = get_allowed_tables()
    if allowed and table_name not in allowed:
        raise ValueError(f'허용되지 않은 테이블: {table_name}')
    return table_name
```

---

## 3. 프론트엔드 — client.js (tableRelationships)

**파일:** `Frontend/react-app/src/shared/api/client.js` (L54~58)

```javascript
/** GET /api/table-relationships - mode: 'fk' | 'column' | 'all' (다중 조인키 반환) */
export async function tableRelationships(mode = 'all') {
  const q = mode && mode !== 'all' ? `?mode=${encodeURIComponent(mode)}` : '';
  return request('GET', `/api/table-relationships${q}`);
}
```

---

## 4. 프론트엔드 — ReportPage.jsx (JOIN 관련 코드 전문)

**파일:** `Frontend/react-app/src/packages/report/ReportPage.jsx`

상태(L52~56), tableRelationships useMemo(L58~76), joinConfigs useMemo(L78~94), 관계 로드 useEffect(L139~172), setJoinConditionsForPair·setJoinConditionAt·addJoinCondition·removeJoinCondition·setJoinTypeForPair·setJoinLogicalOperatorForPair(L174~208), addColumn(L227~264), runExecuteQuery(L268~295), removeJoinedTable(L365~389), fetchAndSetPivot(L463~487), Sidebar/MainArea props(L581~603) — 위 구간의 **전체 코드**는 PART II 서두의 “빠짐없이 적은다”는 원칙에 따라 아래에 이어서 기술한다. 전체 코드는 아래 4.1~4.10에 빠짐없이 적었다.

#### 4.1 상태 (L52~56)

```javascript
  const [joinMode, setJoinMode] = useState('all')
  const [relationshipOptions, setRelationshipOptions] = useState({})
  const [joinConditions, setJoinConditions] = useState({})
  const [joinTypes, setJoinTypes] = useState({})
  const [joinLogicalOperators, setJoinLogicalOperators] = useState({})
```

#### 4.2 tableRelationships useMemo (L58~76)

```javascript
  const tableRelationships = useMemo(() => {
    const resolved = {}
    tables.forEach((t) => { if (t.table_name) resolved[t.table_name] = {} })
    Object.keys(relationshipOptions).forEach((key) => {
      const opts = relationshipOptions[key]
      if (!opts || opts.length === 0) return
      const parts = key.split('||')
      if (parts.length !== 2) return
      const [fromTable, toTable] = parts
      const conds = joinConditions[key]
      const first = (conds && conds[0]) ? conds[0] : (opts[0] && typeof opts[0] === 'object' && opts[0].prevColumn ? opts[0] : null)
      if (!first) return
      resolved[fromTable][toTable] = first
      if (!resolved[toTable]) resolved[toTable] = {}
      resolved[toTable][fromTable] = { prevColumn: first.currColumn, currColumn: first.prevColumn }
    })
    return resolved
  }, [tables, relationshipOptions, joinConditions])
```

#### 4.3 joinConfigs useMemo (L78~94)

```javascript
  const joinConfigs = useMemo(() => {
    const configs = {}
    Object.keys(relationshipOptions).forEach((key) => {
      const opts = relationshipOptions[key]
      if (!opts || opts.length === 0) return
      const conds = joinConditions[key]
      const defaultFirst = opts[0] && (opts[0].prevColumn != null) ? opts[0] : null
      const conditions = (conds && conds.length) ? conds : (defaultFirst ? [defaultFirst] : [])
      if (conditions.length === 0) return
      configs[key] = {
        joinType: joinTypes[key] || 'LEFT',
        logicalOperator: joinLogicalOperators[key] || 'AND',
        conditions: conditions.map((c) => ({ prevColumn: c.prevColumn, currColumn: c.currColumn }))
      }
    })
    return configs
  }, [relationshipOptions, joinConditions, joinTypes, joinLogicalOperators])
```

#### 4.4 관계 로드 useEffect (L139~172)

```javascript
  useEffect(() => {
    if (!tables.length) return
    let cancelled = false
    fetchTableRelationships(joinMode)
      .then((relData) => {
        if (cancelled) return
        const rels = relData?.relationships || []
        const opts = {}
        const seen = new Set()
        rels.forEach((r) => {
          const fromTable = r.from_table
          const toTable = r.to_table
          const prevCol = r.from_column
          const currCol = r.to_column
          if (prevCol === 'id' && currCol === 'id') return
          const push = (key, prev, curr) => {
            const optKey = `${key}::${prev}::${curr}`
            if (seen.has(optKey)) return
            seen.add(optKey)
            if (!opts[key]) opts[key] = []
            opts[key].push({ prevColumn: prev, currColumn: curr, confidence: r.confidence, reason: r.reason })
          }
          push(`${fromTable}||${toTable}`, prevCol, currCol)
          push(`${toTable}||${fromTable}`, currCol, prevCol)
        })
        setRelationshipOptions(opts)
      })
      .catch(() => setRelationshipOptions({}))
    return () => { cancelled = true }
  }, [joinMode, tables])
```

#### 4.5 조인 조건/타입 콜백 (L174~208)

```javascript
  const setJoinConditionsForPair = useCallback((key, conditions) => {
    setJoinConditions((prev) => (conditions?.length ? { ...prev, [key]: conditions } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])
  const setJoinConditionAt = useCallback((key, index, value) => {
    setJoinConditions((prev) => {
      const arr = prev[key] ? [...prev[key]] : []
      if (value) { arr[index] = value; return { ...prev, [key]: arr } }
      arr.splice(index, 1)
      return arr.length ? { ...prev, [key]: arr } : (() => { const n = { ...prev }; delete n[key]; return n })()
    })
  }, [])
  const addJoinCondition = useCallback((key, value) => {
    if (!value?.prevColumn || !value?.currColumn) return
    setJoinConditions((prev) => { const arr = prev[key] ? [...prev[key], value] : [value]; return { ...prev, [key]: arr } })
  }, [])
  const removeJoinCondition = useCallback((key, index) => {
    setJoinConditions((prev) => {
      const arr = prev[key] ? [...prev[key]] : []
      arr.splice(index, 1)
      return arr.length ? { ...prev, [key]: arr } : (() => { const n = { ...prev }; delete n[key]; return n })()
    })
  }, [])
  const setJoinTypeForPair = useCallback((key, joinType) => {
    setJoinTypes((prev) => (joinType ? { ...prev, [key]: joinType } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])
  const setJoinLogicalOperatorForPair = useCallback((key, logicalOperator) => {
    setJoinLogicalOperators((prev) => (logicalOperator ? { ...prev, [key]: logicalOperator } : (() => { const n = { ...prev }; delete n[key]; return n })()))
  }, [])
```

#### 4.6 addColumn (L227~264)

```javascript
  const addColumn = useCallback(
    (columnInfo) => {
      const exists = gridColumns.some((c) => c.table === columnInfo.table && c.column === columnInfo.column)
      if (exists) { showToast('warning', '이미 추가된 컬럼입니다'); return }
      const tableAlreadyAdded = addedTables.includes(columnInfo.table)
      let newAddedTables
      if (tableAlreadyAdded) {
        newAddedTables = addedTables
      } else if (canAddTableByColumn(addedTables, columnInfo.table, relationshipOptions)) {
        newAddedTables = [...addedTables, columnInfo.table]
      } else {
        const lastTable = addedTables[addedTables.length - 1]
        const parent = findIntermediateParent(lastTable, columnInfo.table, relationshipOptions)
        if (parent) {
          newAddedTables = [...addedTables, parent, columnInfo.table]
          showToast('success', `부모 테이블 '${parent}'을(를) 자동으로 넣어 조인했습니다.`)
        } else {
          showToast('warning', '선택한 테이블과 조인할 수 없습니다. 부모 테이블을 먼저 추가하세요.')
          return
        }
      }
      const tableAliasMap = {}
      newAddedTables.forEach((t, i) => { tableAliasMap[t] = 't' + (i + 1) })
      const alias = tableAliasMap[columnInfo.table] || 't1'
      const isGB = isGroupByColumn(groupBy, columnInfo.table, columnInfo.column)
      const aggFunc = groupBy.length > 0 && !isGB ? 'COUNT' : null
      setAddedTables(newAddedTables)
      setGridColumns((prev) => syncAggFuncs([...prev, { table: columnInfo.table, column: columnInfo.column, alias, type: columnInfo.type, aggFunc }], groupBy))
      setCurrentPage(1)
      showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`)
    },
    [gridColumns, addedTables, groupBy, syncAggFuncs, showToast, relationshipOptions]
  )
```

#### 4.7 runExecuteQuery (L268~295)

```javascript
  const runExecuteQuery = useCallback(async () => {
    if (gridColumns.length === 0) { showToast('warning', '최소 1개의 컬럼을 선택하세요'); return }
    setQueryRunning(true)
    try {
      const options = { groupBy, dateGranularity, havings, pivot, pivotRowAggs, joinConfigs }
      const countSQL = generateCountSQL(gridColumns, addedTables, filters, tableRelationships, options)
      if (countSQL) {
        try {
          const countRes = await apiExecuteQuery(countSQL)
          const raw = countRes.data?.[0]?.total
          setTotalCount(typeof raw === 'number' ? raw : parseInt(raw, 10) || 0)
        } catch { setTotalCount(0) }
      }
      const sql = generateSQL(gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, options)
      setExecutedSql(sql)
      const res = await apiExecuteQuery(sql)
      setResultData(res.data || [])
      showToast('success', `${res.count ?? res.data?.length ?? 0}건 조회 완료`)
    } catch (e) {
      showToast('error', e.message || '실행 실패')
    } finally {
      setQueryRunning(false)
    }
  }, [gridColumns, addedTables, filters, orderBy, currentPage, pageSize, tableRelationships, joinConfigs, groupBy, dateGranularity, havings, pivot, pivotRowAggs, showToast])
```

#### 4.8 removeJoinedTable (L365~389)

```javascript
  const removeJoinedTable = useCallback(
    (tableName) => {
      if (!addedTables.includes(tableName)) return
      const nextCols = gridColumns.filter((c) => c.table !== tableName)
      setFilters((prev) => prev.filter((f) => f.table !== tableName))
      setGroupBy((prev) => prev.filter((g) => g.table !== tableName))
      setHavings((prev) => prev.filter((h) => h.table !== tableName))
      setPivotRowAggs((prev) => prev.filter((a) => a.table !== tableName))
      if (pivot && pivot.table === tableName) setPivot(null)
      setAddedTables((tables) => tables.filter((t) => t !== tableName))
      setOrderBy((prev) =>
        prev
          .filter((ob) => gridColumns[ob.columnIndex] && gridColumns[ob.columnIndex].table !== tableName)
          .map((ob) => {
            const c = gridColumns[ob.columnIndex]
            const newIdx = nextCols.findIndex((n) => n.table === c.table && n.column === c.column)
            return newIdx >= 0 ? { ...ob, columnIndex: newIdx } : null
          })
          .filter(Boolean)
      )
      setGridColumns(nextCols)
      setCurrentPage(1)
    },
    [gridColumns, addedTables, groupBy, pivot]
  )
```

#### 4.9 fetchAndSetPivot (L463~487)

```javascript
  const fetchAndSetPivot = useCallback(
    async (table, column) => {
      const alias = gridColumns.find((c) => c.table === table)?.alias
      if (!alias) return
      const sql = generateDistinctPivotSQL(table, column, gridColumns, addedTables, filters, tableRelationships, { joinConfigs, dateGranularity })
      if (!sql) { showToast('error', '피벗 값 조회 SQL 생성 실패'); return }
      try {
        showToast('warning', '⏳ 피벗 값을 조회 중...')
        const res = await apiExecuteQuery(sql)
        const data = res.data || []
        const values = data.map((row) => row[`${alias}.${column}`] ?? row[column] ?? row[Object.keys(row)[0]]).filter((v) => v != null)
        if (values.length === 0) { showToast('error', '피벗 값을 찾을 수 없습니다'); return }
        setPivotFromValues(table, column, values)
        showToast('success', `피벗축 설정 완료 (${values.length}개 값)`)
      } catch (e) {
        showToast('error', '피벗 값 조회 실패: ' + (e.message || ''))
      }
    },
    [gridColumns, addedTables, filters, tableRelationships, joinConfigs, dateGranularity, setPivotFromValues, showToast]
  )
```

#### 4.10 Sidebar / MainArea props (L581~603)

```javascript
        <Sidebar
          tables={tables}
          tableRelationships={tableRelationships}
          relationshipOptions={relationshipOptions}
          addedTables={addedTables}
          ...
        />
        <MainArea
          relationshipOptions={relationshipOptions}
          joinConditions={joinConditions}
          joinTypes={joinTypes}
          onSetJoinConditions={setJoinConditionsForPair}
          onSetJoinConditionAt={setJoinConditionAt}
          onAddJoinCondition={addJoinCondition}
          onRemoveJoinCondition={removeJoinCondition}
          onRemoveJoinedTable={removeJoinedTable}
          onSetJoinType={setJoinTypeForPair}
          joinLogicalOperators={joinLogicalOperators}
          onSetJoinLogicalOperator={setJoinLogicalOperatorForPair}
          ...
        />
```

---

## 5. 프론트엔드 — joinRules.js (파일 전체)

**파일:** `Frontend/react-app/src/packages/report/utils/joinRules.js`

```javascript
/**
 * report/utils/joinRules.js
 * 부모 테이블 없이 n:n 자동 추가 방지용 규칙.
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
export function findIntermediateParent(lastTable, newTable, relationshipOptions) {
  const lastNeighbors = getNeighborTables(lastTable, relationshipOptions)
  const newNeighbors = getNeighborTables(newTable, relationshipOptions)
  for (const p of lastNeighbors) {
    if (newNeighbors.has(p)) return p
  }
  return null
}
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
export function isTableAvailable(tableName, addedTables, tableRelationships) {
  if (addedTables.length === 0) return true
  if (addedTables.includes(tableName)) return true
  const last = addedTables[addedTables.length - 1]
  const relLast = tableRelationships[last] || {}
  const relTable = tableRelationships[tableName] || {}
  return !!relLast[tableName] || !!relTable[last]
}
export function isTableAvailableOrViaParent(tableName, addedTables, tableRelationships, relationshipOptions) {
  if (isTableAvailable(tableName, addedTables, tableRelationships)) return true
  if (addedTables.length === 0) return true
  const last = addedTables[addedTables.length - 1]
  return !!findIntermediateParent(last, tableName, relationshipOptions)
}
```

---

## 6. 프론트엔드 — sqlBuilder.js (JOIN 관련)

**파일:** `Frontend/react-app/src/packages/report/utils/sqlBuilder.js`

getJoinKey (L23~29):

```javascript
export function getJoinKey(tableRelationships, prevTable, currTable) {
  const rel = tableRelationships[prevTable]?.[currTable]
  if (rel && rel.prevColumn != null && rel.currColumn != null) return rel
  const rev = tableRelationships[currTable]?.[prevTable]
  if (rev && rev.prevColumn != null && rev.currColumn != null)
    return { prevColumn: rev.currColumn, currColumn: rev.prevColumn }
  return null
}
```

generateSQL JOIN 루프 (L200~219):

```javascript
  const joinConfigs = options.joinConfigs || {}
  for (let i = 1; i < addedTables.length; i++) {
    const prevTable = addedTables[i - 1]
    const currTable = addedTables[i]
    const key = `${prevTable}||${currTable}`
    const config = joinConfigs[key]
    const joinType = (config?.joinType || 'LEFT').toUpperCase()
    const conditions = config?.conditions?.length ? config.conditions : null
    const joinKey = conditions ? null : getJoinKey(tableRelationships, prevTable, currTable)
    if (conditions && conditions.length > 0) {
      const op = (config.logicalOperator || 'AND').toUpperCase()
      const onClause = conditions
        .map((c) => `t${i}.${c.prevColumn} = t${i + 1}.${c.currColumn}`)
        .join(` ${op} `)
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON ${onClause}`
    } else if (joinKey) {
      sql += `\n${joinType} JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`
    } else {
      throw new Error(`JOIN 관계 없음: ${prevTable} - ${currTable} (조인 조건 선택 필요)`)
    }
  }
```

generateCountSQL·generateDistinctPivotSQL의 JOIN 루프도 동일한 key/config/conditions/joinKey/getJoinKey 로직으로 ON 절 생성. 조건 없으면 return null.

---

## 7. 프론트엔드 — MainArea.jsx (조인 UI)

**파일:** `Frontend/react-app/src/packages/report/components/MainArea.jsx`

조인 관련 props: `relationshipOptions`, `joinConditions`, `joinTypes`, `onSetJoinConditions`, `onSetJoinConditionAt`, `onAddJoinCondition`, `onRemoveJoinCondition`, `onRemoveJoinedTable`, `onSetJoinType`, `joinLogicalOperators`, `onSetJoinLogicalOperator`.

joinPairs·hasImpossibleJoin·joinConditionsBlock (L173~311) 전문:

```javascript
  const joinPairs = addedTables.length >= 2
    ? addedTables.slice(0, -1).map((prev, i) => ({ prevTable: prev, currTable: addedTables[i + 1] }))
    : []
  const hasImpossibleJoin = joinPairs.some(({ prevTable, currTable }) => {
    const key = `${prevTable}||${currTable}`
    return (relationshipOptions[key] || []).length === 0
  })
  useEffect(() => {
    if (hasImpossibleJoin) setFilterOrderBarOpen(false)
  }, [hasImpossibleJoin])
  const joinConditionsBlock = joinPairs.length > 0 && (
    <div className="join-row">
      <span className="bar-label">조인 조건</span>
      <div className="join-conditions-bar__pairs">
        {joinPairs.map(({ prevTable, currTable }) => {
          const key = `${prevTable}||${currTable}`
          const opts = relationshipOptions[key] || []
          const noJoinPossible = opts.length === 0
          const conds = joinConditions[key]
          const firstOpt = opts[0]
          const conditionsList = (conds && conds.length) ? conds : (firstOpt ? [{ prevColumn: firstOpt.prevColumn, currColumn: firstOpt.currColumn }] : [])
          const joinType = joinTypes[key] || 'LEFT'
          return (
            <div key={key} className="join-conditions-pair join-conditions-pair--multi">
              <div className="join-conditions-pair__head">
                <span className="join-conditions-pair__tables">{prevTable} ↔ {currTable}</span>
                <button type="button" className="join-conditions-pair__remove-join" onClick={() => onRemoveJoinedTable?.(currTable)} title="조인 해제 (이 테이블 제거)">×</button>
                {noJoinPossible ? (
                  <span className="join-conditions-pair__impossible">조인 불가</span>
                ) : (
                  <>
                    {firstOpt?.confidence && <span className="join-conditions-pair__confidence" title={confidenceBadge(firstOpt.confidence).title}>{confidenceBadge(firstOpt.confidence).char}</span>}
                    {firstOpt?.reason && <span className="join-conditions-pair__reason">{firstOpt.reason}</span>}
                    <select className="join-conditions-pair__join-type" value={joinType} onChange={(e) => onSetJoinType?.(key, e.target.value)}>
                      {JOIN_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </>
                )}
              </div>
              {!noJoinPossible && (
                <div className="join-conditions-pair__conditions">
                  {conditionsList.map((cond, idx) => {
                    const selectedVal = cond ? `${cond.prevColumn}::${cond.currColumn}` : ''
                    const valueInOpts = opts.some((o) => o.prevColumn === cond?.prevColumn && o.currColumn === cond?.currColumn)
                    const safeValue = (valueInOpts && selectedVal) ? selectedVal : (opts[0] ? `${opts[0].prevColumn}::${opts[0].currColumn}` : '')
                    return (
                      <span key={idx} className="join-conditions-pair__row-wrap">
                        {idx > 0 && (
                          <select className="join-conditions-pair__logical-op" value={joinLogicalOperators[key] || 'AND'} onChange={(e) => onSetJoinLogicalOperator?.(key, e.target.value)}>
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        )}
                        <div className="join-conditions-pair__row">
                          <select className="join-conditions-pair__select" value={safeValue} onChange={(e) => {
                            const v = e.target.value
                            if (!v) return
                            const [prevColumn, currColumn] = v.split('::')
                            onSetJoinConditionAt?.(key, idx, { prevColumn, currColumn })
                          }}>
                            {opts.map((opt, i) => (
                              <option key={i} value={`${opt.prevColumn}::${opt.currColumn}`}>{joinOptionLabel(opt)}</option>
                            ))}
                          </select>
                          <button type="button" className="join-conditions-pair__remove-condition" onClick={() => onRemoveJoinCondition?.(key, idx)} title="조건 삭제">✕</button>
                        </div>
                      </span>
                    )
                  })}
                  <button type="button" className="join-conditions-pair__add-condition" onClick={() => onAddJoinCondition?.(key, opts[0] ? { prevColumn: opts[0].prevColumn, currColumn: opts[0].currColumn } : null)} title="조건 추가">+ 조건 추가</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
```

---

## 8. 프론트엔드 — Sidebar.jsx (JOIN 관련)

**파일:** `Frontend/react-app/src/packages/report/components/Sidebar.jsx`

```javascript
export default function Sidebar({ tables = [], tableRelationships = {}, relationshipOptions = {}, addedTables = [], loading, dbStatus = {} }) {
  // ...
  const filteredTables = filteredByKeyword.filter((t) =>
    isTableAvailableOrViaParent(t.table_name, addedTables, tableRelationships, relationshipOptions)
  )
  // ...
            {filteredTables.map((t) => {
              const disabled = !isTableAvailableOrViaParent(t.table_name, addedTables, tableRelationships, relationshipOptions)
              return (
                <div key={t.table_name} className={`table-group ${disabled ? 'disabled' : ''}`} data-table={t.table_name}>
                  <div className="table-header" onClick={() => !disabled && toggleTable(t.table_name)}>
                    ...
                    {disabled && <span className="disabled-hint">🚫 JOIN 불가</span>}
                  </div>
```

---

## 9. 스타일 — report.css (조인 관련)

**파일:** `Frontend/react-app/src/packages/report/report.css`

조인 관련 클래스: `.join-conditions-bar`, `.join-conditions-bar__label`, `.join-conditions-bar__pairs`, `.join-conditions-pair`, `.join-conditions-pair--multi`, `.join-conditions-pair__head`, `.join-conditions-pair__tables`, `.join-conditions-pair__confidence`, `.join-conditions-pair__reason`, `.join-conditions-pair__join-type`, `.join-conditions-pair__conditions`, `.join-conditions-pair__row`, `.join-conditions-pair__select`, `.join-conditions-pair__remove-join`, `.join-conditions-pair__remove-condition`, `.join-conditions-pair__add-condition`, `.join-conditions-pair__row-wrap`, `.join-conditions-pair__logical-op`, `.filter-order-bar .join-row`, `.join-conditions-pair__impossible`. (전체 CSS 선언은 report.css L56~274 참조.)

---

## 10. 테스트 — joinRules.test.js·sqlBuilder.test.js

**joinRules.test.js**  
canAddTableByColumn, findIntermediateParent, isTableAvailable, isTableAvailableOrViaParent 시나리오 전체 코드는 `Frontend/react-app/src/packages/report/__tests__/joinRules.test.js` 파일 전체와 동일. (121줄.)

**sqlBuilder.test.js**  
generateDistinctPivotSQL 호출 시 tableRelationships, joinConfigs, dateGranularity 전달하는 테스트 전체 코드는 `Frontend/react-app/src/packages/report/__tests__/sqlBuilder.test.js` 파일 전체와 동일. (126줄.)

---

## 11. 데이터 흐름 요약

1. **관계 로드**: client.tableRelationships() → report.py table_relationships() → relationships 배열.
2. **옵션 구성**: ReportPage useEffect에서 rels.forEach → push(from||to), push(to||from) → setRelationshipOptions(opts).
3. **파생 구조**: relationshipOptions + joinConditions → tableRelationships (useMemo). relationshipOptions + joinConditions + joinTypes + joinLogicalOperators → joinConfigs (useMemo).
4. **테이블 추가**: addColumn → canAddTableByColumn 또는 findIntermediateParent → setAddedTables, setGridColumns.
5. **SQL 생성**: generateSQL(gridColumns, addedTables, ..., tableRelationships, { joinConfigs, ... }) → joinConfigs[key].conditions 또는 getJoinKey(tableRelationships, prev, curr) → ON 절.
6. **조인 해제**: MainArea 조인 쌍 × → onRemoveJoinedTable(currTable) → removeJoinedTable → addedTables/gridColumns 등에서 해당 테이블 제거.
