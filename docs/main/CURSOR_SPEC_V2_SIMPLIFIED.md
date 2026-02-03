# 엑셀 스타일 노코드 쿼리 빌더 - 간소화 명세서

## 📋 프로젝트 개요

**현재 구현**: 프론트엔드는 **React(Vite)**, `Frontend/react-app`. 아래 HTML/구조는 명세 참고용입니다.

SQL을 모르는 사람도 드래그 앤 드롭으로 데이터를 조회할 수 있는 쿼리 빌더

---

## 🎯 핵심 기능 (V1)

### ✅ 구현할 기능
1. **왼쪽 사이드바**: 테이블 & 컬럼 목록 (드래그 가능)
2. **오른쪽 그리드**: 엑셀 스타일 테이블 (드롭존)
3. **JOIN 자동 필터링**: JOIN 불가능한 테이블은 비활성화
4. **WHERE 절**: 컬럼 헤더에 필터 아이콘
5. **ORDER BY**: 헤더 클릭 → 오름차순/내림차순 토글
6. **컬럼 순서 변경**: 헤더 드래그 앤 드롭

### ❌ 제외할 기능 (나중에)
- GROUP BY / 집계 함수 → 추가 기능 페이지로 분리
- HAVING 절
- 다중 정렬
- 복잡한 필터 (OR 조건 등)

---

## 🏗️ UI 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 스타벅스 CRM 쿼리 빌더                   [초기화] [실행] │
└──────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────────────────────────┐
│ 📁 테이블        │  │ campaign_id │ name      │ status   │
├──────────────────┤  ├─────────────┼───────────┼──────────┤
│ ▼ cmpn_target    │  │ 🔍          │ 🔍        │ 🔍 ⬆️   │
│   campaign_id    │→ ├─────────────┼───────────┼──────────┤
│   campaign_name  │  │ C001        │ 신년특가  │ Y        │
│   send_count     │  │ C002        │ 봄맞이    │ Y        │
│                  │  │ C003        │ 여름특가  │ N        │
│ ▶ customer       │  └──────────────────────────────────────┘
│ (활성화)         │
│                  │
│ ▷ order_history  │
│ (비활성화 - 회색)│
└──────────────────┘
```

---

## 📐 상세 구조

### 1. 왼쪽 사이드바

#### HTML 구조
```html
<div class="sidebar">
  <!-- 테이블 그룹 1 (펼쳐짐) -->
  <div class="table-group" data-table="cmpn_target_dlv_log">
    <div class="table-header" onclick="toggleTable('cmpn_target_dlv_log')">
      <span class="toggle-icon">▼</span>
      <span class="table-name">cmpn_target_dlv_log</span>
      <span class="table-count">(15개)</span>
    </div>
    
    <div class="column-list expanded">
      <div class="column-item" 
           draggable="true" 
           data-table="cmpn_target_dlv_log"
           data-column="campaign_id"
           data-type="bigint">
        <span class="drag-handle">⋮⋮</span>
        <span class="column-name">campaign_id</span>
        <span class="column-type">bigint</span>
      </div>
      
      <div class="column-item" draggable="true" ...>
        <span class="drag-handle">⋮⋮</span>
        <span class="column-name">campaign_name</span>
        <span class="column-type">varchar</span>
      </div>
      
      <!-- 더 많은 컬럼들... -->
    </div>
  </div>
  
  <!-- 테이블 그룹 2 (접힘, 활성화) -->
  <div class="table-group" data-table="customer_master">
    <div class="table-header" onclick="toggleTable('customer_master')">
      <span class="toggle-icon">▶</span>
      <span class="table-name">customer_master</span>
      <span class="table-count">(20개)</span>
    </div>
    
    <div class="column-list">
      <!-- 접혀있음 -->
    </div>
  </div>
  
  <!-- 테이블 그룹 3 (비활성화 - JOIN 불가) -->
  <div class="table-group disabled" data-table="order_history">
    <div class="table-header disabled">
      <span class="toggle-icon">▷</span>
      <span class="table-name">order_history</span>
      <span class="table-count">(10개)</span>
      <span class="disabled-hint">🚫 JOIN 불가</span>
    </div>
  </div>
</div>
```

#### 상태에 따른 스타일
```css
/* 활성화된 테이블 */
.table-group {
  cursor: pointer;
  opacity: 1;
}

.table-group:hover {
  background: #f0f7f4;
}

/* 비활성화된 테이블 (JOIN 불가) */
.table-group.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #f5f5f5;
}

.table-group.disabled:hover {
  background: #f5f5f5; /* 호버 효과 없음 */
}

.table-header.disabled {
  pointer-events: none; /* 클릭 차단 */
}

/* 컬럼 리스트 토글 */
.column-list {
  display: none;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.column-list.expanded {
  display: block;
  max-height: 500px;
}

/* 드래그 가능한 컬럼 */
.column-item {
  padding: 6px 10px;
  cursor: move;
  border-radius: 4px;
  transition: all 0.2s;
}

.column-item:hover {
  background: #e3f2ed;
  transform: translateX(4px);
}

.column-item.dragging {
  opacity: 0.5;
}
```

---

### 2. 오른쪽 그리드

#### HTML 구조
```html
<div class="grid-area">
  <!-- 드롭존 오버레이 (컬럼 드래그 중일 때만 표시) -->
  <div class="drop-overlay" id="dropOverlay">
    <div class="drop-message">
      👇 컬럼을 여기에 드롭하세요
    </div>
  </div>
  
  <!-- 그리드 -->
  <div class="grid-container" id="gridContainer">
    <table class="data-grid">
      <thead>
        <tr>
          <!-- 컬럼 헤더 -->
          <th draggable="true" 
              data-column-index="0"
              data-table="cmpn_target_dlv_log"
              data-column="campaign_id"
              onclick="toggleSort(0)">
            <div class="header-content">
              <span class="column-name">campaign_id</span>
              <div class="header-icons">
                <span class="filter-icon" onclick="showFilter(event, 0)">🔍</span>
                <span class="sort-icon"></span> <!-- 클릭 시 ⬆️ 또는 ⬇️ -->
              </div>
            </div>
          </th>
          
          <th draggable="true" data-column-index="1" ...>
            <div class="header-content">
              <span class="column-name">campaign_name</span>
              <div class="header-icons">
                <span class="filter-icon" onclick="showFilter(event, 1)">🔍</span>
                <span class="sort-icon"></span>
              </div>
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
        <!-- 더 많은 행들... -->
      </tbody>
    </table>
  </div>
</div>
```

#### 빈 상태 (초기)
```html
<div class="grid-container empty">
  <div class="empty-state">
    <div class="empty-icon">📊</div>
    <div class="empty-title">왼쪽에서 컬럼을 드래그하세요</div>
    <div class="empty-desc">
      테이블을 선택하고 원하는 컬럼을 드래그하여<br>
      데이터를 조회할 수 있습니다
    </div>
  </div>
</div>
```

---

## 🎬 드래그 앤 드롭 동작

### 1. 컬럼 추가 (사이드바 → 그리드)

```javascript
let draggedItem = null;

// 사이드바에서 드래그 시작
document.addEventListener('dragstart', (e) => {
  if (e.target.classList.contains('column-item')) {
    e.target.classList.add('dragging');
    
    draggedItem = {
      table: e.target.dataset.table,
      column: e.target.dataset.column,
      type: e.target.dataset.type
    };
    
    // 드롭 오버레이 표시
    document.getElementById('dropOverlay').classList.add('active');
  }
});

document.addEventListener('dragend', (e) => {
  if (e.target.classList.contains('column-item')) {
    e.target.classList.remove('dragging');
    document.getElementById('dropOverlay').classList.remove('active');
  }
});

// 그리드 영역에서 dragover
const gridContainer = document.getElementById('gridContainer');

gridContainer.addEventListener('dragover', (e) => {
  e.preventDefault(); // ⭐ 필수! 이거 없으면 drop 이벤트 안 발생
  e.dataTransfer.dropEffect = 'copy';
});

// 그리드에 드롭
gridContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  
  if (draggedItem) {
    addColumnToGrid(draggedItem);
    draggedItem = null;
  }
});

// 컬럼 추가 함수
function addColumnToGrid(columnInfo) {
  // 중복 체크
  const exists = state.gridColumns.some(col => 
    col.table === columnInfo.table && col.column === columnInfo.column
  );
  
  if (exists) {
    showToast('warning', '이미 추가된 컬럼입니다');
    return;
  }
  
  // 테이블이 처음 추가되는 경우
  const isFirstTable = state.addedTables.length === 0;
  const tableAlias = isFirstTable ? 't1' : getNextAlias();
  
  // 테이블 추가
  if (!state.addedTables.includes(columnInfo.table)) {
    state.addedTables.push(columnInfo.table);
    updateAvailableTables(); // JOIN 가능 여부 재계산
  }
  
  // 컬럼 추가
  state.gridColumns.push({
    table: columnInfo.table,
    column: columnInfo.column,
    alias: tableAlias,
    type: columnInfo.type,
    sort: null,        // null | 'ASC' | 'DESC'
    filter: null       // null | { operator: '=', value: 'Y' }
  });
  
  renderGrid();
  showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`);
}
```

---

### 2. 컬럼 순서 변경 (헤더 드래그)

```javascript
let draggedColumnIndex = null;

// 헤더 드래그 시작
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'TH' || e.target.closest('th')) {
    const th = e.target.closest('th');
    th.classList.add('dragging');
    draggedColumnIndex = parseInt(th.dataset.columnIndex);
  }
});

document.addEventListener('dragend', (e) => {
  if (e.target.tagName === 'TH' || e.target.closest('th')) {
    const th = e.target.closest('th');
    th.classList.remove('dragging');
    
    // 드래그 오버 표시 제거
    document.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => {
      el.classList.remove('drag-over-left', 'drag-over-right');
    });
  }
});

// 다른 헤더 위에서 dragover
document.addEventListener('dragover', (e) => {
  if (draggedColumnIndex !== null) {
    const th = e.target.closest('th');
    if (th && th.dataset.columnIndex) {
      e.preventDefault();
      
      const targetIndex = parseInt(th.dataset.columnIndex);
      if (targetIndex !== draggedColumnIndex) {
        // 마우스가 헤더의 왼쪽/오른쪽 어디에 있는지 계산
        const rect = th.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;
        
        // 기존 표시 제거
        document.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => {
          el.classList.remove('drag-over-left', 'drag-over-right');
        });
        
        // 왼쪽 또는 오른쪽에 표시
        if (e.clientX < midPoint) {
          th.classList.add('drag-over-left');
        } else {
          th.classList.add('drag-over-right');
        }
      }
    }
  }
});

// 다른 헤더에 드롭
document.addEventListener('drop', (e) => {
  const th = e.target.closest('th');
  
  if (draggedColumnIndex !== null && th && th.dataset.columnIndex) {
    e.preventDefault();
    
    const targetIndex = parseInt(th.dataset.columnIndex);
    if (targetIndex !== draggedColumnIndex) {
      // 마우스가 헤더의 왼쪽/오른쪽 어디에 있는지에 따라 삽입 위치 결정
      const rect = th.getBoundingClientRect();
      const midPoint = rect.left + rect.width / 2;
      const insertBefore = e.clientX < midPoint;
      
      moveColumn(draggedColumnIndex, targetIndex, insertBefore);
    }
    
    draggedColumnIndex = null;
  }
});

// 컬럼 이동 함수
function moveColumn(fromIndex, toIndex, insertBefore) {
  // 컬럼 추출
  const [movedColumn] = state.gridColumns.splice(fromIndex, 1);
  
  // 새 위치 계산
  let newIndex = toIndex;
  
  if (fromIndex < toIndex) {
    // 뒤로 이동
    newIndex = insertBefore ? toIndex - 1 : toIndex;
  } else {
    // 앞으로 이동
    newIndex = insertBefore ? toIndex : toIndex + 1;
  }
  
  // 삽입
  state.gridColumns.splice(newIndex, 0, movedColumn);
  
  renderGrid();
}
```

---

## 🔍 필터 기능 (WHERE 절)

### 필터 팝업 표시

```javascript
function showFilter(event, columnIndex) {
  event.stopPropagation(); // 정렬 클릭 방지
  
  const col = state.gridColumns[columnIndex];
  const th = event.target.closest('th');
  
  // 기존 팝업 제거
  document.querySelectorAll('.filter-popup').forEach(p => p.remove());
  
  // 팝업 생성
  const popup = document.createElement('div');
  popup.className = 'filter-popup';
  popup.innerHTML = `
    <div class="filter-header">
      <span>🔍 필터: ${col.column}</span>
      <span class="filter-close" onclick="this.closest('.filter-popup').remove()">×</span>
    </div>
    
    <div class="filter-body">
      <select class="filter-operator" id="filterOp_${columnIndex}">
        <option value="=" ${col.filter?.operator === '=' ? 'selected' : ''}>= (같음)</option>
        <option value="!=" ${col.filter?.operator === '!=' ? 'selected' : ''}>!= (다름)</option>
        <option value=">" ${col.filter?.operator === '>' ? 'selected' : ''}>> (크다)</option>
        <option value="<" ${col.filter?.operator === '<' ? 'selected' : ''}>< (작다)</option>
        <option value=">=" ${col.filter?.operator === '>=' ? 'selected' : ''}>≥ (크거나 같음)</option>
        <option value="<=" ${col.filter?.operator === '<=' ? 'selected' : ''}>≤ (작거나 같음)</option>
        <option value="LIKE" ${col.filter?.operator === 'LIKE' ? 'selected' : ''}>포함</option>
      </select>
      
      <input type="text" 
             class="filter-value" 
             id="filterVal_${columnIndex}"
             placeholder="값 입력"
             value="${col.filter?.value || ''}">
    </div>
    
    <div class="filter-actions">
      <button class="btn-small secondary" onclick="clearFilter(${columnIndex})">지우기</button>
      <button class="btn-small primary" onclick="applyFilter(${columnIndex})">적용</button>
    </div>
  `;
  
  // 위치 계산
  const rect = th.getBoundingClientRect();
  popup.style.position = 'absolute';
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.bottom + 5) + 'px';
  
  document.body.appendChild(popup);
  
  // 포커스
  setTimeout(() => {
    document.getElementById(`filterVal_${columnIndex}`).focus();
  }, 100);
  
  // 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target) && !e.target.closest('.filter-icon')) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    });
  }, 0);
}

function applyFilter(columnIndex) {
  const operator = document.getElementById(`filterOp_${columnIndex}`).value;
  const value = document.getElementById(`filterVal_${columnIndex}`).value.trim();
  
  if (value) {
    state.gridColumns[columnIndex].filter = { operator, value };
  } else {
    state.gridColumns[columnIndex].filter = null;
  }
  
  document.querySelector('.filter-popup').remove();
  renderGrid(); // 필터 아이콘 업데이트
}

function clearFilter(columnIndex) {
  state.gridColumns[columnIndex].filter = null;
  document.querySelector('.filter-popup').remove();
  renderGrid();
}
```

---

## ⬆️⬇️ 정렬 기능 (ORDER BY)

### 헤더 클릭 시 정렬 토글

```javascript
function toggleSort(columnIndex) {
  const col = state.gridColumns[columnIndex];
  
  // 기존 정렬 초기화
  state.gridColumns.forEach(c => c.sort = null);
  
  // 토글: null → ASC → DESC → null
  if (!col.sort) {
    col.sort = 'ASC';
  } else if (col.sort === 'ASC') {
    col.sort = 'DESC';
  } else {
    col.sort = null;
  }
  
  renderGrid();
}
```

### 헤더에 정렬 표시

```html
<th onclick="toggleSort(0)">
  <div class="header-content">
    <span class="column-name">campaign_id</span>
    <div class="header-icons">
      <span class="filter-icon ${col.filter ? 'active' : ''}" 
            onclick="showFilter(event, 0)">🔍</span>
      
      <!-- 정렬 아이콘 -->
      ${col.sort === 'ASC' ? '<span class="sort-icon">⬆️</span>' : ''}
      ${col.sort === 'DESC' ? '<span class="sort-icon">⬇️</span>' : ''}
    </div>
  </div>
</th>
```

---

## 🔗 JOIN 가능 여부 판단

### 공통 컬럼 찾기

```javascript
// 테이블 간 관계 분석
function analyzeTableRelationships() {
  state.tableRelationships = {};
  
  state.allTables.forEach(table1 => {
    state.tableRelationships[table1.table_name] = {};
    
    state.allTables.forEach(table2 => {
      if (table1.table_name === table2.table_name) return;
      
      // 공통 컬럼 찾기 (ID 컬럼 우선)
      const commonColumns = findCommonColumns(table1.columns, table2.columns);
      
      if (commonColumns.length > 0) {
        state.tableRelationships[table1.table_name][table2.table_name] = commonColumns[0];
      }
    });
  });
}

function findCommonColumns(columns1, columns2) {
  const common = [];
  
  // ID로 끝나는 컬럼만 검색
  const idColumns1 = columns1.filter(c => 
    c.name.endsWith('_id') || c.name === 'id'
  );
  const idColumns2 = columns2.filter(c => 
    c.name.endsWith('_id') || c.name === 'id'
  );
  
  idColumns1.forEach(col1 => {
    const match = idColumns2.find(col2 => col2.name === col1.name);
    if (match) {
      common.push(col1.name);
    }
  });
  
  return common;
}
```

### 사용 가능한 테이블 계산

```javascript
function updateAvailableTables() {
  state.allTables.forEach(table => {
    let isAvailable = true;
    
    if (state.addedTables.length === 0) {
      // 첫 번째 테이블은 모두 사용 가능
      isAvailable = true;
    } else if (state.addedTables.includes(table.table_name)) {
      // 이미 추가된 테이블
      isAvailable = false;
    } else {
      // JOIN 가능 여부 확인
      const lastTable = state.addedTables[state.addedTables.length - 1];
      const relationships = state.tableRelationships[lastTable] || {};
      
      isAvailable = !!relationships[table.table_name];
    }
    
    // UI 업데이트
    const tableGroup = document.querySelector(`[data-table="${table.table_name}"]`);
    if (tableGroup) {
      if (isAvailable) {
        tableGroup.classList.remove('disabled');
      } else {
        tableGroup.classList.add('disabled');
      }
    }
  });
}
```

---

## 🔄 SQL 생성 (간소화 버전)

```javascript
function generateSQL() {
  if (state.gridColumns.length === 0) {
    throw new Error('최소 1개의 컬럼을 선택하세요');
  }
  
  // SELECT 절
  const selectClauses = state.gridColumns.map(col => 
    `${col.alias}.${col.column}`
  );
  
  let sql = `SELECT\n    ${selectClauses.join(',\n    ')}`;
  
  // FROM 절
  const firstTable = state.addedTables[0];
  sql += `\nFROM ${firstTable} AS t1`;
  
  // JOIN 절 (나중에 추가 - 일단 단일 테이블만)
  // TODO: 다중 테이블 JOIN 구현
  
  // WHERE 절
  const whereClauses = state.gridColumns
    .filter(col => col.filter)
    .map(col => {
      let value = col.filter.value;
      
      // 값 포맷팅
      if (col.filter.operator === 'LIKE') {
        value = `'%${value}%'`;
      } else if (isNaN(value)) {
        value = `'${value}'`;
      }
      
      return `${col.alias}.${col.column} ${col.filter.operator} ${value}`;
    });
  
  if (whereClauses.length > 0) {
    sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;
  }
  
  // ORDER BY 절
  const sortedCol = state.gridColumns.find(col => col.sort);
  if (sortedCol) {
    sql += `\nORDER BY ${sortedCol.alias}.${sortedCol.column} ${sortedCol.sort}`;
  }
  
  // LIMIT
  sql += '\nLIMIT 100;';
  
  return sql;
}
```

---

## 💾 상태 관리

```javascript
const state = {
  // DB 정보
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
  
  // 테이블 간 관계 (JOIN 가능 여부)
  tableRelationships: {
    'cmpn_target_dlv_log': {
      'customer_master': 'campaign_id',
      'order_history': null  // JOIN 불가
    }
  },
  
  // 추가된 테이블들
  addedTables: ['cmpn_target_dlv_log'],
  
  // 그리드 컬럼들
  gridColumns: [
    {
      table: 'cmpn_target_dlv_log',
      column: 'campaign_id',
      alias: 't1',
      type: 'bigint',
      sort: null,           // null | 'ASC' | 'DESC'
      filter: null          // null | { operator: '=', value: 'Y' }
    }
  ],
  
  // 쿼리 결과
  resultData: []
};
```

---

## 📦 API 연동

```javascript
const API_BASE_URL = 'http://localhost:5000';

// 테이블 목록 로드
async function loadTables() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/list-tables`);
    const data = await response.json();
    state.allTables = data.tables || [];
    
    // 각 테이블의 컬럼 정보 로드
    for (const table of state.allTables) {
      const res = await fetch(`${API_BASE_URL}/api/describe-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: table.table_name })
      });
      const colData = await res.json();
      table.columns = colData.columns || [];
    }
    
    // 테이블 간 관계 분석
    analyzeTableRelationships();
    
    // UI 렌더링
    renderSidebar();
    
  } catch (error) {
    showToast('error', '테이블 로드 실패');
  }
}

// 쿼리 실행
async function executeQuery() {
  try {
    const sql = generateSQL();
    
    const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Query failed');
    }
    
    const result = await response.json();
    state.resultData = result.data || [];
    
    renderGrid();
    showToast('success', `${result.count}건 조회 완료`);
    
  } catch (error) {
    showToast('error', error.message);
  }
}
```

---

## 🎨 스타일 가이드

```css
/* 컬러 팔레트 */
:root {
  --primary: #00704A;
  --primary-light: #e3f2ed;
  --background: #f5f7fa;
  --border: #e0e0e0;
  --text: #333;
  --text-light: #666;
  --disabled: #999;
}

/* 드래그 오버 효과 */
.drag-over-left {
  border-left: 3px solid var(--primary) !important;
}

.drag-over-right {
  border-right: 3px solid var(--primary) !important;
}

/* 필터 활성화 표시 */
.filter-icon {
  opacity: 0.3;
  cursor: pointer;
  transition: opacity 0.2s;
}

.filter-icon:hover,
.filter-icon.active {
  opacity: 1;
  color: var(--primary);
}

/* 비활성화된 테이블 */
.table-group.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #f5f5f5;
}

.table-group.disabled .table-header {
  pointer-events: none;
}

.table-group.disabled .column-item {
  pointer-events: none;
}
```

---

## ✅ 구현 체크리스트

### 필수 기능
- [ ] 왼쪽 사이드바: 테이블 목록 표시
- [ ] 테이블 클릭 → 컬럼 목록 토글
- [ ] 컬럼 드래그 → 그리드에 추가
- [ ] 컬럼 헤더 드래그 → 순서 변경
- [ ] JOIN 불가능 테이블 비활성화 (회색 + 클릭 차단)
- [ ] 필터 아이콘 클릭 → 팝업 표시
- [ ] 필터 적용 (WHERE 절 생성)
- [ ] 헤더 클릭 → 정렬 토글 (null → ASC → DESC → null)
- [ ] SQL 자동 생성 (별칭 사용)
- [ ] 쿼리 실행 및 결과 표시

### 제외 기능 (V2 이후)
- ~~GROUP BY / 집계 함수~~
- ~~HAVING 절~~
- ~~다중 정렬~~
- ~~OR 조건 필터~~

---

## 🚨 주의사항

1. **별칭 필수**: 모든 컬럼 참조 시 `t1.column_name` 형식
2. **preventDefault()**: dragover 이벤트에서 필수
3. **LIKE 값 포맷**: `'%value%'`
4. **문자열 값**: `'Y'` 형식으로 작은따옴표
5. **중복 방지**: 같은 테이블의 같은 컬럼은 한 번만 추가
6. **JOIN 순서**: 마지막에 추가된 테이블과만 JOIN 가능

---

## 🎯 최종 목표

**"SQL 몰라도 엑셀처럼 드래그 앤 드롭으로 데이터 조회"**

단순하고 직관적인 UI로 누구나 쉽게 사용할 수 있는 쿼리 빌더!

---

**이 명세서대로 구현하면 V1 완성! 🚀**
