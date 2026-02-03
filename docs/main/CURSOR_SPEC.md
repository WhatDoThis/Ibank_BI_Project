# 엑셀 스타일 노코드 쿼리 빌더 - 완전 명세서

## 📋 프로젝트 개요

**현재 구현**: 프론트엔드는 **React(Vite)**, `Frontend/react-app`. 아래 HTML/구조는 명세 참고용입니다.

SQL을 모르는 사람도 엑셀처럼 드래그 앤 드롭으로 데이터를 조회할 수 있는 쿼리 빌더

---

## 🎯 핵심 요구사항

### 1. UI 레이아웃
```
┌──────────────────────────────────────────────────────────┐
│ 🔍 스타벅스 CRM 쿼리 빌더            [초기화] [▶️ 실행] │
└──────────────────────────────────────────────────────────┘

┌─────────────┐  ┌────────────────────────────────────────┐
│ 📁 테이블   │  │ campaign_id │ name      │ send_count │
├─────────────┤  ├─────────────┼───────────┼────────────┤
│ ▼ Table1    │  │ C001        │ 신년특가  │ 1000      │
│   □ id      │→ │ C002        │ 봄맞이    │ 2000      │
│   □ name    │  │ C003        │ 여름특가  │ 1500      │
│   □ count   │  └────────────────────────────────────────┘
│             │
│ ▶ Table2    │
│             │
│ ▶ Table3    │
└─────────────┘
```

---

## 🏗️ 상세 구조

### 왼쪽 사이드바 (테이블 & 컬럼 목록)
```html
<div class="sidebar">
  <div class="table-group">
    <div class="table-header" onclick="toggleTable('table1')">
      <span class="toggle-icon">▼</span>
      <span class="table-name">cmpn_target_dlv_log</span>
    </div>
    <div class="column-list expanded">
      <div class="column-item" draggable="true" data-table="table1" data-column="campaign_id">
        <input type="checkbox" />
        <span class="column-name">campaign_id</span>
        <span class="column-type">bigint</span>
      </div>
      <!-- 더 많은 컬럼들... -->
    </div>
  </div>
</div>
```

**동작:**
- 테이블 헤더 클릭 → 컬럼 목록 펼침/접힘 (토글)
- 컬럼은 **드래그 가능** (draggable="true")
- 체크박스는 선택 여부 표시용 (실제 추가는 드래그)

---

### 오른쪽 그리드 (엑셀 스타일)
```html
<div class="grid-container">
  <table class="data-grid">
    <thead>
      <tr>
        <th draggable="true" data-column-index="0" oncontextmenu="showMenu(event, 0)">
          <div class="column-header">
            <span>campaign_id</span>
            <span class="menu-icon">⚙️</span>
          </div>
        </th>
        <!-- 더 많은 헤더들... -->
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>C001</td>
        <td>신년특가</td>
        <td>1000</td>
      </tr>
    </tbody>
  </table>
</div>
```

**동작:**
- 컬럼 헤더도 **드래그 가능** (순서 변경용)
- 우클릭 → 컨텍스트 메뉴 (집계함수, 정렬, 필터, 제거)

---

## 🎬 드래그 앤 드롭 동작

### 1. 컬럼 추가 (사이드바 → 그리드)
```javascript
// 사이드바에서 드래그 시작
document.addEventListener('dragstart', (e) => {
  if (e.target.classList.contains('column-item')) {
    draggedColumn = {
      table: e.target.dataset.table,
      column: e.target.dataset.column,
      type: e.target.dataset.type
    };
  }
});

// 그리드에 드롭
gridContainer.addEventListener('drop', (e) => {
  if (draggedColumn) {
    addColumnToGrid(draggedColumn);
  }
});
```

### 2. 컬럼 순서 변경 (그리드 헤더 드래그)
```javascript
// 헤더 드래그 시작
th.addEventListener('dragstart', (e) => {
  draggedColumnIndex = parseInt(e.target.dataset.columnIndex);
});

// 다른 헤더에 드롭
th.addEventListener('drop', (e) => {
  const targetIndex = parseInt(e.target.dataset.columnIndex);
  moveColumn(draggedColumnIndex, targetIndex);
});
```

---

## 🎯 컨텍스트 메뉴 (헤더 우클릭)

```javascript
function showMenu(event, columnIndex) {
  event.preventDefault();
  
  const menu = `
    <div class="context-menu" style="left: ${event.pageX}px; top: ${event.pageY}px;">
      <div class="menu-section">
        <div class="menu-title">집계 함수</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'none')">그대로</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'SUM')">합계 (SUM)</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'AVG')">평균 (AVG)</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'COUNT')">개수 (COUNT)</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'MAX')">최댓값 (MAX)</div>
        <div class="menu-item" onclick="setAggregate(${columnIndex}, 'MIN')">최솟값 (MIN)</div>
      </div>
      
      <div class="menu-section">
        <div class="menu-title">정렬</div>
        <div class="menu-item" onclick="setSort(${columnIndex}, 'ASC')">⬆️ 오름차순</div>
        <div class="menu-item" onclick="setSort(${columnIndex}, 'DESC')">⬇️ 내림차순</div>
        <div class="menu-item" onclick="setSort(${columnIndex}, null)">정렬 해제</div>
      </div>
      
      <div class="menu-section">
        <div class="menu-item" onclick="showFilterPopup(${columnIndex})">🔍 필터 설정</div>
        <div class="menu-item" onclick="removeColumn(${columnIndex})">❌ 컬럼 제거</div>
      </div>
    </div>
  `;
}
```

**메뉴 항목:**
1. **집계 함수**: 그대로, SUM, AVG, COUNT, MAX, MIN
2. **정렬**: 오름차순, 내림차순, 해제
3. **필터**: 팝업 표시
4. **제거**: 컬럼 삭제

---

## 💾 상태 관리

```javascript
const state = {
  // DB 테이블 정보
  allTables: [
    {
      table_name: 'cmpn_target_dlv_log',
      columns: [
        { name: 'campaign_id', type: 'bigint' },
        { name: 'campaign_name', type: 'varchar' },
        // ...
      ]
    }
  ],
  
  // 그리드에 추가된 컬럼들
  gridColumns: [
    {
      table: 'cmpn_target_dlv_log',
      column: 'campaign_id',
      alias: 't1',
      aggregate: 'none',        // 'none' | 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN'
      sort: null,               // null | 'ASC' | 'DESC'
      filter: null              // null | { operator: '=', value: 'Y' }
    }
  ],
  
  // 쿼리 실행 결과
  resultData: [
    { campaign_id: 'C001', campaign_name: '신년특가', send_count: 1000 }
  ]
};
```

---

## 🔄 SQL 생성 로직

```javascript
function generateSQL() {
  const selectClauses = [];
  const groupByClauses = [];
  let hasAggregate = false;
  
  // SELECT 절
  state.gridColumns.forEach(col => {
    let clause;
    
    if (col.aggregate !== 'none') {
      clause = `${col.aggregate}(${col.alias}.${col.column})`;
      hasAggregate = true;
    } else {
      clause = `${col.alias}.${col.column}`;
      groupByClauses.push(clause);
    }
    
    selectClauses.push(clause);
  });
  
  let sql = `SELECT ${selectClauses.join(', ')}`;
  sql += `\nFROM ${state.gridColumns[0].table} AS ${state.gridColumns[0].alias}`;
  
  // WHERE 절
  const whereClauses = state.gridColumns
    .filter(col => col.filter)
    .map(col => {
      let value = col.filter.value;
      if (col.filter.operator === 'LIKE') {
        value = `'%${value}%'`;
      } else if (isNaN(value)) {
        value = `'${value}'`;
      }
      return `${col.alias}.${col.column} ${col.filter.operator} ${value}`;
    });
  
  if (whereClauses.length > 0) {
    sql += `\nWHERE ${whereClauses.join(' AND ')}`;
  }
  
  // GROUP BY 절
  if (hasAggregate && groupByClauses.length > 0) {
    sql += `\nGROUP BY ${groupByClauses.join(', ')}`;
  }
  
  // ORDER BY 절
  const sortCol = state.gridColumns.find(col => col.sort);
  if (sortCol) {
    const sortClause = sortCol.aggregate !== 'none' 
      ? `${sortCol.aggregate}(${sortCol.alias}.${sortCol.column})`
      : `${sortCol.alias}.${sortCol.column}`;
    sql += `\nORDER BY ${sortClause} ${sortCol.sort}`;
  }
  
  sql += '\nLIMIT 100;';
  
  return sql;
}
```

---

## 🐛 현재 문제점 & 해결 방법

### 문제 1: 500 에러 (SQL 문법 오류)
**원인:** 별칭(alias) 처리가 제대로 안 됨

**해결:**
```javascript
// ❌ 잘못된 예
SELECT campaign_id FROM cmpn_target_dlv_log AS t1

// ✅ 올바른 예  
SELECT t1.campaign_id FROM cmpn_target_dlv_log AS t1
```

모든 컬럼 참조 시 **반드시 별칭 사용**: `t1.campaign_id`

---

### 문제 2: 컬럼 헤더 드래그 안 됨
**원인:** 드래그 이벤트 리스너 제대로 안 걸림

**해결:**
```javascript
// TH에 직접 draggable 속성
<th draggable="true" data-column-index="0">

// dragover 이벤트에서 preventDefault() 필수
th.addEventListener('dragover', (e) => {
  e.preventDefault();  // ⭐ 이거 없으면 drop 이벤트 안 발생
});
```

---

### 문제 3: 테이블 토글 안 됨
**해결:**
```javascript
function toggleTable(tableId) {
  const columnList = document.querySelector(`#${tableId} .column-list`);
  const icon = document.querySelector(`#${tableId} .toggle-icon`);
  
  if (columnList.classList.contains('expanded')) {
    columnList.classList.remove('expanded');
    icon.textContent = '▶';
  } else {
    columnList.classList.add('expanded');
    icon.textContent = '▼';
  }
}
```

CSS:
```css
.column-list {
  display: none;
}

.column-list.expanded {
  display: block;
}
```

---

## 🎨 스타일 가이드

### 색상
- Primary: `#00704A` (스타벅스 그린)
- Background: `#f5f7fa`
- Border: `#e0e0e0`
- Text: `#333`

### 크기
- 사이드바: `280px`
- 헤더 높이: `48px`
- 폰트: `11px` (그리드), `12px` (일반)

---

## 📦 API 연동

### 엔드포인트
```
BASE_URL = 'http://localhost:5000'

GET  /health                     - DB 연결 확인
GET  /api/list-tables            - 테이블 목록
POST /api/describe-table         - 테이블 스키마
  Body: { table_name: 'cmpn_target_dlv_log' }
  
POST /api/execute-query          - 쿼리 실행
  Body: { query: 'SELECT ...' }
  Response: { count: 100, data: [...] }
```

### 사용 예시
```javascript
// 테이블 목록 로드
async function loadTables() {
  const response = await fetch(`${API_BASE_URL}/api/list-tables`);
  const data = await response.json();
  state.allTables = data.tables;
  
  // 각 테이블의 컬럼 정보 로드
  for (const table of state.allTables) {
    const res = await fetch(`${API_BASE_URL}/api/describe-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name: table.table_name })
    });
    const data = await res.json();
    table.columns = data.columns;
  }
}

// 쿼리 실행
async function executeQuery() {
  const sql = generateSQL();
  
  const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  
  const result = await response.json();
  state.resultData = result.data;
  renderGrid();
}
```

---

## ✅ 체크리스트

### 필수 기능
- [ ] 왼쪽 사이드바에 테이블 목록 표시
- [ ] 테이블 클릭 시 컬럼 목록 토글
- [ ] 컬럼을 그리드로 드래그 앤 드롭
- [ ] 그리드 헤더 드래그로 컬럼 순서 변경
- [ ] 헤더 우클릭 → 컨텍스트 메뉴
- [ ] 집계 함수 설정 (SUM, AVG, COUNT, MAX, MIN)
- [ ] 정렬 설정 (ASC, DESC)
- [ ] 필터 설정 (=, !=, >, <, LIKE)
- [ ] SQL 자동 생성 (별칭 올바르게 처리)
- [ ] 쿼리 실행 및 결과 표시

### 선택 기능
- [ ] 컬럼 검색
- [ ] 다중 정렬 (우선순위)
- [ ] CSV 내보내기
- [ ] 쿼리 저장/불러오기

---

## 🚨 주의사항

1. **별칭 필수 사용**: 모든 컬럼 참조 시 `t1.column_name` 형식
2. **dragover에서 preventDefault()**: 안 하면 drop 이벤트 안 발생
3. **GROUP BY 자동 추가**: 집계 함수 사용 시 집계하지 않은 컬럼은 GROUP BY에 포함
4. **LIKE 연산자**: 값 양쪽에 % 추가 (`'%value%'`)
5. **문자열 값**: 작은따옴표로 감싸기 (`'Y'`)

---

## 🎯 최종 목표

**"SQL을 전혀 모르는 사람도 엑셀처럼 드래그 앤 드롭만으로 복잡한 데이터 분석이 가능하다"**

---

## 📝 참고 파일

- `run.py` - API 서버 루트 진입점 (Backend 실행, 이미 작동 중)
- 포트: `5000` (API), `9191` (프론트엔드)
- DB: PostgreSQL (`ibank_bi_data @ 49.247.47.206`)

---

**이 명세서대로 구현하면 완벽하게 작동하는 노코드 쿼리 빌더가 완성됩니다!** 🚀
