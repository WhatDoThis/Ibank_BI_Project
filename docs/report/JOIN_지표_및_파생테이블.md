# JOIN 경우의 수·정확도 지표 및 파생 테이블

## 1. JOIN 경우의 수 (Join Case Count)

**정의**: 주어진 테이블 집합으로 만들 수 있는 “유효한 JOIN 구성”의 가지 수.

| 지표 | 설명 | 계산 예 |
|------|------|---------|
| **base 후보 수** | FROM에 올 수 있는 테이블 개수 | N개 테이블 → N |
| **유효 join_order 수** | 각 base당 하나의 join_order 생성 → base별 1개 | N개 base → N가지 “어떤 순서로 JOIN할지” |
| **관계 엣지 수** | 테이블 간 관계( FK + 추론 ) 개수 | table-relationships 개수 |
| **실제 경우의 수** | “base를 정했을 때” 나머지 테이블을 붙이는 **순서**는 백엔드 알고리즘으로 1개 결정 | 따라서 **경우의 수 = base 후보 수** (각 base당 1개 join_order) |

확장 시:
- “경로 경우의 수”: base → required 테이블들을 붙이는 **서로 다른 경로**가 여러 개일 수 있으면, BFS 등으로 구한 경로 수를 셀 수 있음.
- **조합 경우의 수**: “이 중에서 k개 테이블만 골라 JOIN”하는 경우의 수 = C(N,k) × (각 조합당 유효 join_order 존재 여부).

---

## 2. 정확도 점수 (Accuracy / Confidence Score)

**정의**: 제안된 JOIN이 “의도한 관계”와 맞는지, 또는 관계 자체의 신뢰도를 수치화.

### 2.1 관계 단위 신뢰도 (confidence)

| 등급 | 의미 | 점수(권장) |
|------|------|------------|
| **HIGH** | DB FK 제약 | 1.0 |
| **MEDIUM** | 컬럼명·타입 추론 (예: _id) | 0.7 |
| **LOW** | 추론 확신 낮음 | 0.5 |

### 2.2 join_order 정확도 점수

- **방법 A (엣지 평균)**  
  `join_accuracy = (join_order에 포함된 각 엣지의 confidence 점수 합) / 엣지 수`  
  - FK만 쓰면 1.0, 일부만 추론이면 1.0 미만.

- **방법 B (FK 비율)**  
  `join_accuracy = (FK 기반 엣지 수) / (전체 엣지 수)`  
  - 0~1, “전부 FK면 1”.

- **방법 C (유효성)**  
  `valid = (join_order가 순환 없음 · 깊이 제한 통과) ? 1.0 : 0`  
  - “구성 자체가 올바른지”만 보는 지표.

실제 구현 시: **방법 A + 방법 C** 조합 (엣지별 신뢰도 평균 + valid 여부)을 권장.

---

## 3. 파생 테이블 (조인 결과) 컬럼

**정의**: 여러 테이블을 JOIN한 결과는 “한 개의 가상 테이블(파생 테이블)”로 보며, 그 스키마 = **참여 테이블들의 컬럼 합집합**.

### 3.1 컬럼이 여러 개인 이유

- 테이블 A (컬럼 7개) + B (17개) + C (7개) + D (8개)  
  → **파생 테이블 컬럼 수 = 7+17+7+8 = 39개** (동일 이름 제거 시 별도 정책 가능).

### 3.2 파생 테이블 스키마 표현

각 컬럼에 “출처 테이블(및 alias)”를 붙이면 됨.

```json
{
  "derived_columns": [
    { "table": "campaigns", "alias": "t1", "column": "id", "type": "integer" },
    { "table": "campaigns", "alias": "t1", "column": "campaign_label", "type": "character varying" },
    { "table": "test_deliveries_data", "alias": "t2", "column": "id", "type": "integer" },
    { "table": "test_deliveries_data", "alias": "t2", "column": "delivery_code", "type": "character varying" },
    ...
  ],
  "tables": [
    { "table": "campaigns", "alias": "t1", "column_count": 7 },
    { "table": "test_deliveries_data", "alias": "t2", "column_count": 17 }
  ],
  "total_columns": 39
}
```

- **alias**: JOIN 시 사용한 테이블 별칭 (t1, t2, …).
- **table**: 실제 테이블명.
- **column**: 해당 테이블의 컬럼명.  
→ 프론트에서 “어느 테이블(alias)의 어떤 컬럼인지”로 그리드/필터/정렬에 사용 가능.

### 3.3 중복 컬럼명 처리

- 여러 테이블에 `id`가 있으면: `t1.id`, `t2.id`처럼 **alias.column**으로 구분.
- UI에서는 “같은 이름이 있으면 alias로 구분해 표시” (현재 그리드도 동일 방식 적용 가능).

---

## 4. 구현 위치 제안

| 항목 | 위치 |
|------|------|
| 경우의 수 | join_order 호출 시 “base 후보 수”, “엣지 수” 등 반환 또는 별도 API |
| 정확도 점수 | join_order 응답에 `join_accuracy` (엣지 confidence 평균), `valid` 포함 |
| 파생 테이블 컬럼 | join_order + describe-table 결과를 합쳐 `derived_columns` (또는 `derived_table_schema`) 반환하는 API/유틸 |

이 문서에 맞춰 백엔드에 지표 계산·파생 컬럼 목록 함수를 두고, 테스트로 검증하면 됨.

---

## 5. 중복 JOIN 우려 및 방지

| 우려 | 방지 방식 |
|------|-----------|
| **같은 테이블이 경로에 두 번** | 백엔드 `validate_join_order`: `seen` set으로 테이블 중복 시 `valid: false`, 에러 "순환 참조". 프론트 `detectCircularReference` / `canAddTableSafely`로 추가 전 차단. |
| **같은 엣지(테이블 쌍)가 두 번** | `join_order` / `addedTables`는 테이블을 한 번씩만 추가. 한 step당 하나의 (from_table → to_table) 엣지만 생성되므로 동일 쌍이 두 번 나오지 않음. |
| **ON 조건 배열에 동일 (prevColumn, currColumn) 반복** | 프론트 `sqlBuilder.dedupeConditions`: ON 조건 리스트를 `prevColumn|currColumn` 기준으로 중복 제거 후 사용. |

정리: 테이블 중복 = 순환 참조로 차단, 엣지 중복 = 구조상 발생 안 함, 조건 중복 = dedupe 로 방지.
