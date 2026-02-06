# JOIN 규칙 - 커서야 이것만 보면 돼

## 절대 규칙 (이것만 기억해)

### ✅ JOIN 가능한 경우 (이것만!)

```
테이블1.id = 테이블2.테이블1_id
```

**예시:**
```sql
workflows.id = campaigns.workflow_id  ✅
campaigns.id = deliveries.campaign_id ✅
products.id = order_details.product_id ✅
```

**패턴:**
- 왼쪽: 항상 `id`
- 오른쪽: 항상 `{테이블명}_id`

---

### ❌ JOIN 절대 안 되는 경우

#### 1. 같은 컬럼명끼리
```sql
campaigns.workflow_id = channels.workflow_id     ❌
campaigns.status = channels.status               ❌
campaigns.name = channels.name                   ❌
table1.channel = table2.channel                  ❌
```

#### 2. _id가 아닌 컬럼
```sql
campaigns.code = channels.code                   ❌
campaigns.region = channels.region               ❌
```

#### 3. id끼리
```sql
campaigns.id = channels.id                       ❌
```

---

## 관계 감지 알고리즘

### Step 1: _id 컬럼 찾기
```
campaigns 테이블을 봤더니
→ workflow_id 컬럼 발견!
```

### Step 2: 부모 테이블 이름 추출
```
workflow_id 에서 _id 제거
→ workflow

복수형으로 변환
→ workflows
```

### Step 3: 부모 테이블 존재 확인
```
workflows 테이블이 있나?
- 있음: ✅ JOIN 가능
- 없음: ❌ JOIN 불가
```

### Step 4: JOIN 조건 생성
```
workflows.id = campaigns.workflow_id
```

---

## 코드로 보는 규칙

### 백엔드 (Python)
```python
# table-relationships 엔드포인트

# 1. FK 제약조건 기반 (있으면)
SELECT 
  kcu.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'

# 결과:
# from_table: campaigns
# from_column: workflow_id
# to_table: workflows
# to_column: id
# → workflows.id = campaigns.workflow_id

# 2. 같은 컬럼명 기반 (사용 안 함!)
# 제외 조건:
if column_name in ("id", "created_at", "updated_at"):
    continue  # 제외
if column_name.endswith("_id"):
    continue  # 제외!!! (_id는 같아도 JOIN 안 함)
if data_type in ("timestamp", "date", "time"):
    continue  # 날짜/시간도 제외
    
# 즉, 일반 컬럼만 체크하는데... 이것도 사용 안 함!
```

### 프론트엔드 (JavaScript)
```javascript
// relationshipOptions 구조
{
  "workflows||campaigns": [{
    prevColumn: "id",           // workflows.id
    currColumn: "workflow_id"   // campaigns.workflow_id
  }],
  "campaigns||deliveries": [{
    prevColumn: "id",           // campaigns.id
    currColumn: "campaign_id"   // deliveries.campaign_id
  }]
}

// JOIN 가능 여부 체크
function canAddTableByColumn(addedTables, newTable, relationshipOptions) {
  if (addedTables.length === 0) return true;  // 첫 테이블
  if (addedTables.includes(newTable)) return true;  // 이미 있음
  
  const lastTable = addedTables[addedTables.length - 1];
  
  // 관계 있는지만 확인
  const key1 = `${lastTable}||${newTable}`;
  const key2 = `${newTable}||${lastTable}`;
  
  if (relationshipOptions[key1] || relationshipOptions[key2]) {
    return true;  // 관계 있음
  }
  
  return false;  // 관계 없음 = JOIN 불가
}
```

---

## 실전 예시

### 상황 1: workflows, campaigns, channels 테이블

#### 테이블 구조
```sql
CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER,  -- workflows 참조
  name VARCHAR(100)
);

CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER,  -- workflows 참조
  name VARCHAR(100)
);
```

#### 감지되는 관계
```
workflows.id = campaigns.workflow_id  ✅
workflows.id = channels.workflow_id   ✅
```

#### 감지 안 되는 관계
```
campaigns.workflow_id = channels.workflow_id  ❌
(같은 컬럼명끼리 JOIN 안 됨)
```

#### 허용되는 테이블 조합
```
1. workflows만 선택 ✅

2. workflows → campaigns 추가 ✅
   (workflows||campaigns 관계 있음)

3. workflows → channels 추가 ✅
   (workflows||channels 관계 있음)

4. workflows, campaigns → channels 추가 ✅
   (workflows||channels 관계 있음)

5. campaigns → channels 추가 ❌
   (campaigns||channels 관계 없음!)
```

---

### 상황 2: campaigns, channels만 (workflows 없음)

#### 테이블 구조
```sql
-- workflows 테이블 없음!

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER,  -- 참조할 테이블 없음
  name VARCHAR(100)
);

CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER,  -- 참조할 테이블 없음
  name VARCHAR(100)
);
```

#### 감지되는 관계
```
없음!

workflow_id 컬럼은 있지만
workflows 테이블이 없어서
관계 감지 안 됨
```

#### 허용되는 테이블 조합
```
1. campaigns만 선택 ✅

2. campaigns → channels 추가 ❌
   (관계 없음)

3. channels만 선택 ✅

4. channels → campaigns 추가 ❌
   (관계 없음)
```

---

## 데이터 예시로 보는 이유

### ❌ 잘못된 JOIN (같은 컬럼끼리)
```sql
-- campaigns 데이터
id | workflow_id | name
1  | 100         | "봄맞이"
2  | 100         | "여름"
3  | 200         | "가을"

-- channels 데이터  
id | workflow_id | name
10 | 100         | "EMAIL"
11 | 100         | "SMS"
12 | 200         | "PUSH"

-- 잘못된 JOIN
SELECT *
FROM campaigns c
JOIN channels ch ON c.workflow_id = ch.workflow_id

결과:
campaign_id | campaign_name | channel_id | channel_name
1           | "봄맞이"      | 10         | "EMAIL"       
1           | "봄맞이"      | 11         | "SMS"         ← 중복!
2           | "여름"        | 10         | "EMAIL"       
2           | "여름"        | 11         | "SMS"         ← 중복!
3           | "가을"        | 12         | "PUSH"

→ 데이터 폭발! (3건 → 5건)
→ 봄맞이 캠페인이 EMAIL도 쓰고 SMS도 쓴 건지 알 수 없음
→ 의미 없는 조합
```

### ✅ 올바른 JOIN (부모 테이블 경유)
```sql
-- workflows 데이터
id  | name
100 | "2024 신년 기획"
200 | "가을 이벤트"

-- 올바른 JOIN
SELECT *
FROM workflows w
LEFT JOIN campaigns c ON c.workflow_id = w.id
LEFT JOIN channels ch ON ch.workflow_id = w.id

결과:
workflow_id | workflow_name   | campaign_name | channel_name
100         | "2024 신년 기획"| "봄맞이"      | "EMAIL"
100         | "2024 신년 기획"| "봄맞이"      | "SMS"
100         | "2024 신년 기획"| "여름"        | "EMAIL"
100         | "2024 신년 기획"| "여름"        | "SMS"
200         | "가을 이벤트"   | "가을"        | "PUSH"

→ 정확한 데이터!
→ workflow 100에 campaign 2개, channel 2개 있다는 걸 알 수 있음
→ 의미 있는 조합
```

---

## 구현 체크리스트

### 백엔드 (/api/table-relationships)

```python
# ✅ 해야 할 것
def detect_relationships():
    relationships = []
    
    # 1. FK 제약조건 조회 (있으면)
    fk_relationships = get_foreign_keys()
    relationships.extend(fk_relationships)
    
    # 2. _id 패턴 기반 감지
    for table in tables:
        for column in table.columns:
            if column.endswith('_id') and column != 'id':
                # workflow_id → workflows
                parent_table = infer_parent_table(column)
                
                if parent_table in tables:
                    relationships.append({
                        'from_table': table.name,
                        'from_column': column,
                        'to_table': parent_table,
                        'to_column': 'id',
                        'confidence': 'HIGH'
                    })
    
    return relationships

# ❌ 하면 안 되는 것
# 같은 컬럼명끼리 관계 만들기
# campaigns.workflow_id = channels.workflow_id 같은 거
```

### 프론트엔드 (joinRules.js)

```javascript
// ✅ 해야 할 것
// relationshipOptions 형태:
{
  "workflows||campaigns": [{
    prevColumn: "id",
    currColumn: "workflow_id"
  }]
}

// canAddTableByColumn: 관계 있어야만 추가 허용
// isTableAvailable: 관계 있어야만 리스트 노출

// ❌ 하면 안 되는 것
// 같은 컬럼명 있다고 관계 만들기
// 부모 테이블 없어도 _id끼리 연결하기
```

---

## 자주 하는 실수

### ❌ 실수 1: 같은 타입이면 JOIN 가능?
```
NO!

status VARCHAR(20) = status VARCHAR(20)
→ 타입 같아도 JOIN 안 됨
```

### ❌ 실수 2: 같은 컬럼명이면 JOIN 가능?
```
NO!

workflow_id = workflow_id
→ 컬럼명 같아도 JOIN 안 됨
```

### ❌ 실수 3: _id 컬럼이면 무조건 JOIN 가능?
```
NO!

workflow_id 있어도
workflows 테이블 없으면 JOIN 안 됨
```

### ✅ 정답: 이것만 JOIN 가능
```
workflows.id = campaigns.workflow_id

조건:
1. workflows 테이블 존재
2. campaigns에 workflow_id 컬럼 존재
3. 왼쪽은 id, 오른쪽은 {테이블명}_id
```

---

## 마지막 정리 (커서야 이것만 외워)

### 1. JOIN 가능 조건
```
테이블A.id = 테이블B.테이블A_id

이것만!
```

### 2. JOIN 불가
```
- 같은 컬럼명끼리 (workflow_id = workflow_id)
- 일반 컬럼끼리 (status = status)
- 부모 테이블 없으면
```

### 3. 부모 테이블 확인
```
workflow_id 컬럼 발견
→ workflows 테이블 있나?
  - 있음: JOIN 가능
  - 없음: JOIN 불가
```

### 4. 관계 표현
```
relationshipOptions = {
  "부모테이블||자식테이블": [{
    prevColumn: "id",
    currColumn: "부모테이블_id"
  }]
}
```

---

## 끝!

이것만 기억하면 됩니다:

**workflows.id = campaigns.workflow_id 같은 패턴만 JOIN!**

**같은 컬럼명끼리 절대 JOIN 안 함!**

**부모 테이블 없으면 JOIN 불가!**
