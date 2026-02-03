# 쿼리 빌더 추가 기능 명세서

**현재 구현**: 프론트엔드는 **React(Vite)** 로 구현되어 있으며, 구현 위치는 `Frontend/react-app` 입니다. 본 문서는 Claude 해석·페이지네이션 등 기능 명세(동작·UI 개요)용입니다.

## 📋 추가 기능 목록

1. **Claude API 쿼리 해석** 🤖
2. **페이지네이션 (OFFSET)** 📄

---

## 🤖 1. Claude API 쿼리 해석

### 기능 개요
- 생성된 SQL 쿼리를 Claude API로 전송
- 자연어로 쉽게 해석된 설명 받기
- API 키는 로컬 스토리지에 저장

### UI 구성

```
┌──────────────────────────────────────────────────────┐
│ 📄 실행된 SQL                    [🤖 해석] [📋 복사] │
├──────────────────────────────────────────────────────┤
│ SELECT                                                │
│   t1.campaign_id,                                     │
│   t1.campaign_name,                                   │
│   t1.send_count                                       │
│ FROM cmpn_target_dlv_log AS t1                        │
│ WHERE t1.status = 'Y'                                 │
│ ORDER BY t1.send_count DESC                           │
│ LIMIT 100 OFFSET 0;                                   │
├──────────────────────────────────────────────────────┤
│ 💬 Claude 해석:                                       │
│                                                        │
│ 이 쿼리는 캠페인 타겟 배송 로그 테이블에서           │
│ 상태가 'Y'인 레코드들의 캠페인 ID, 이름, 발송 건수를│
│ 조회합니다. 발송 건수가 많은 순서대로 정렬하며,     │
│ 최대 100건의 결과를 반환합니다.                      │
└──────────────────────────────────────────────────────┘
```

---

### HTML 수정

#### (1) 헤더에 API 설정 버튼 추가

```html
<div class="header">
    <div class="header-title">🔍 스타벅스 CRM 쿼리 빌더</div>
    <div style="display: flex; gap: 8px;">
        <button class="btn" style="background: rgba(255,255,255,0.2); color: white;" 
                onclick="showAPISettings()">⚙️ API 설정</button>
        <button class="btn" style="background: rgba(255,255,255,0.2); color: white;" 
                onclick="clearAll()">초기화</button>
        <button class="btn btn-primary" onclick="executeQuery()">실행</button>
    </div>
</div>
```

---

#### (2) API 설정 모달 추가

```html
<!-- API 설정 모달 (body 마지막에 추가) -->
<div class="modal-overlay" id="apiModal" onclick="closeAPIModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>⚙️ Claude API 설정</h3>
            <span class="modal-close" onclick="closeAPIModal()">×</span>
        </div>
        <div class="modal-body">
            <label for="apiKeyInput">Claude API Key</label>
            <input type="password" 
                   id="apiKeyInput" 
                   class="api-key-input" 
                   placeholder="sk-ant-api03-...">
            <div class="modal-hint">
                💡 API 키는 브라우저에만 저장되며 서버로 전송되지 않습니다.<br>
                <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>에서 발급받으세요.
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-small secondary" onclick="closeAPIModal()">취소</button>
            <button class="btn-small primary" onclick="saveAPIKey()">저장</button>
        </div>
    </div>
</div>
```

---

#### (3) SQL 패널 수정 (해석 버튼 + 해석 영역)

```html
<!-- 기존 sql-panel 수정 -->
<div class="sql-panel">
    <div class="sql-header">
        <span>📄 실행된 SQL</span>
        <div style="display: flex; gap: 8px;">
            <button class="btn-small" onclick="explainSQL()" id="explainBtn">🤖 해석</button>
            <button class="btn-small" onclick="copySQLToClipboard()">📋 복사</button>
        </div>
    </div>
    <textarea readonly id="sqlDisplay" placeholder="SQL 쿼리가 여기에 표시됩니다"></textarea>
    
    <!-- Claude 해석 영역 추가 -->
    <div class="explanation-area" id="explanationArea" style="display: none;">
        <div class="explanation-header">
            <span>💬 Claude 해석</span>
            <span class="explanation-close" onclick="closeExplanation()">×</span>
        </div>
        <div class="explanation-content" id="explanationContent">
            해석 중...
        </div>
    </div>
</div>
```

---

### CSS 추가

```css
/* ==================== 모달 ==================== */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.modal-overlay.show {
    display: flex;
}

.modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    font-size: 16px;
    margin: 0;
}

.modal-close {
    cursor: pointer;
    font-size: 24px;
    color: var(--disabled);
}

.modal-close:hover {
    color: var(--text);
}

.modal-body {
    padding: 20px;
}

.modal-body label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text);
}

.api-key-input {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
}

.modal-hint {
    margin-top: 12px;
    padding: 10px;
    background: #f0f7f4;
    border-left: 3px solid var(--primary);
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
}

.modal-hint a {
    color: var(--primary);
    text-decoration: none;
}

.modal-hint a:hover {
    text-decoration: underline;
}

.modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

/* ==================== SQL 패널 확장 ==================== */
.sql-panel {
    height: auto;
    max-height: 300px;
    min-height: 150px;
    border-top: 2px solid var(--primary);
    display: flex;
    flex-direction: column;
    background: white;
    transition: max-height 0.3s ease;
}

.sql-panel.expanded {
    max-height: 500px;
}

/* ==================== 해석 영역 ==================== */
.explanation-area {
    border-top: 1px solid var(--border);
    background: #f9f9f9;
    max-height: 200px;
    overflow-y: auto;
}

.explanation-header {
    padding: 8px 12px;
    background: #e3f2ed;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
}

.explanation-close {
    cursor: pointer;
    font-size: 18px;
    color: var(--disabled);
}

.explanation-close:hover {
    color: var(--text);
}

.explanation-content {
    padding: 12px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
}

.explanation-content.loading {
    color: var(--disabled);
    font-style: italic;
}
```

---

### JavaScript 추가

#### (1) API 설정 모달 관련

```javascript
// API 설정 모달 표시
function showAPISettings() {
    const modal = document.getElementById('apiModal');
    const input = document.getElementById('apiKeyInput');
    
    // 기존 API 키 불러오기
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey) {
        input.value = savedKey;
    }
    
    modal.classList.add('show');
}

// API 설정 모달 닫기
function closeAPIModal(event) {
    // 오버레이 클릭 또는 닫기 버튼 클릭 시에만 닫기
    if (!event || event.target.id === 'apiModal' || event.type === 'click') {
        document.getElementById('apiModal').classList.remove('show');
    }
}

// API 키 저장
function saveAPIKey() {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input.value.trim();
    
    if (!apiKey) {
        showToast('warning', 'API 키를 입력하세요');
        return;
    }
    
    if (!apiKey.startsWith('sk-ant-')) {
        showToast('warning', '올바른 Claude API 키 형식이 아닙니다');
        return;
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem('claude_api_key', apiKey);
    
    closeAPIModal();
    showToast('success', 'API 키가 저장되었습니다');
}
```

---

#### (2) Claude API 호출

```javascript
// SQL 해석 요청
async function explainSQL() {
    const sqlDisplay = document.getElementById('sqlDisplay');
    const sql = sqlDisplay.value;
    
    if (!sql) {
        showToast('warning', '실행된 쿼리가 없습니다');
        return;
    }
    
    // API 키 확인
    const apiKey = localStorage.getItem('claude_api_key');
    if (!apiKey) {
        showToast('warning', 'API 키를 먼저 설정하세요');
        showAPISettings();
        return;
    }
    
    // 해석 영역 표시
    const explanationArea = document.getElementById('explanationArea');
    const explanationContent = document.getElementById('explanationContent');
    
    explanationArea.style.display = 'block';
    explanationContent.className = 'explanation-content loading';
    explanationContent.textContent = '🤖 Claude가 쿼리를 해석하는 중...';
    
    // SQL 패널 확장
    document.querySelector('.sql-panel').classList.add('expanded');
    
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `다음 SQL 쿼리를 한국어로 쉽게 해석해줘. 기술적인 용어보다는 비즈니스 관점에서 "이 쿼리가 무엇을 조회하는지" 설명해줘:\n\n${sql}`
                }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API 호출 실패');
        }
        
        const data = await response.json();
        const explanation = data.content[0].text;
        
        explanationContent.className = 'explanation-content';
        explanationContent.textContent = explanation;
        
        showToast('success', '해석 완료');
        
    } catch (error) {
        explanationContent.className = 'explanation-content';
        explanationContent.textContent = `❌ 해석 실패: ${error.message}`;
        showToast('error', 'Claude API 호출 실패');
    }
}

// 해석 영역 닫기
function closeExplanation() {
    document.getElementById('explanationArea').style.display = 'none';
    document.querySelector('.sql-panel').classList.remove('expanded');
}
```

---

## 📄 2. 페이지네이션 (OFFSET)

### 기능 개요
- LIMIT + OFFSET을 사용한 페이지네이션
- 이전/다음 페이지 이동
- 현재 페이지 및 전체 건수 표시

### UI 구성

```
┌────────────────────────────────────────────┐
│ campaign_id │ name      │ count            │
├─────────────┼───────────┼──────────────────┤
│ C001        │ 신년특가  │ 1000             │
│ C002        │ 봄맞이    │ 2000             │
│ ...         │ ...       │ ...              │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ 📊 101-200건 / 총 1,523건        [100건▼] │
│ [◀ 이전]  페이지 2 / 16        [다음 ▶] │
└────────────────────────────────────────────┘
```

---

### HTML 수정

#### 그리드 하단에 페이지네이션 바 추가

```html
<div class="main-area">
    <!-- 그리드 영역 -->
    <div class="grid-area">
        <div class="drop-overlay" id="dropOverlay">...</div>
        <div class="grid-container empty" id="gridContainer">...</div>
        
        <!-- 페이지네이션 바 추가 -->
        <div class="pagination-bar" id="paginationBar" style="display: none;">
            <div class="pagination-info">
                <span id="recordRange">1-100건</span>
                <span style="color: var(--text-light);"> / 총 </span>
                <span id="totalCount">0건</span>
            </div>
            
            <div class="pagination-controls">
                <button class="btn-small secondary" onclick="firstPage()" id="firstBtn">⏮️ 처음</button>
                <button class="btn-small secondary" onclick="prevPage()" id="prevBtn">◀ 이전</button>
                <span class="page-indicator">
                    페이지 <span id="currentPage">1</span> / <span id="totalPages">1</span>
                </span>
                <button class="btn-small secondary" onclick="nextPage()" id="nextBtn">다음 ▶</button>
                <button class="btn-small secondary" onclick="lastPage()" id="lastBtn">마지막 ⏭️</button>
            </div>
            
            <div class="page-size-selector">
                <select id="pageSizeSelect" onchange="changePageSize()">
                    <option value="50">50건</option>
                    <option value="100" selected>100건</option>
                    <option value="200">200건</option>
                    <option value="500">500건</option>
                </select>
            </div>
        </div>
    </div>
    
    <!-- SQL 패널 -->
    <div class="sql-panel">...</div>
</div>
```

---

### CSS 추가

```css
/* ==================== 페이지네이션 바 ==================== */
.pagination-bar {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: #f9f9f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
}

.pagination-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}

.page-indicator {
    padding: 0 12px;
    color: var(--text-light);
}

.page-indicator span {
    color: var(--text);
    font-weight: 600;
}

.page-size-selector select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
}

/* 비활성화된 버튼 */
.pagination-controls .btn-small:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
```

---

### JavaScript 수정 및 추가

#### (1) 상태 관리에 페이지네이션 추가

```javascript
const state = {
    allTables: [],
    tableRelationships: {},
    addedTables: [],
    gridColumns: [],
    resultData: [],
    
    // 페이지네이션 추가
    currentPage: 1,
    pageSize: 100,
    totalCount: 0
};
```

---

#### (2) SQL 생성 시 OFFSET 추가

```javascript
function generateSQL() {
    if (state.gridColumns.length === 0) throw new Error('최소 1개의 컬럼을 선택하세요');
    
    const selectClauses = state.gridColumns.map(c => `${c.alias}.${c.column}`);
    let sql = `SELECT\n    ${selectClauses.join(',\n    ')}`;
    
    const firstTable = state.addedTables[0];
    sql += `\nFROM ${firstTable} AS t1`;

    // JOIN 절
    for (let i = 1; i < state.addedTables.length; i++) {
        const prevTable = state.addedTables[i - 1];
        const currTable = state.addedTables[i];
        const key = state.tableRelationships[prevTable]?.[currTable] || 'id';
        sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${key} = t${i + 1}.${key}`;
    }

    // WHERE 절
    const whereClauses = state.gridColumns
        .filter(c => c.filter && c.filter.value !== '')
        .map(c => {
            let val = c.filter.value;
            if (c.filter.operator === 'LIKE') val = `'%${val}%'`;
            else if (isNaN(val)) val = `'${val}'`;
            return `${c.alias}.${c.column} ${c.filter.operator} ${val}`;
        });
    if (whereClauses.length > 0) sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;

    // ORDER BY 절
    const sortCol = state.gridColumns.find(c => c.sort);
    if (sortCol) sql += `\nORDER BY ${sortCol.alias}.${sortCol.column} ${sortCol.sort}`;
    
    // LIMIT + OFFSET 추가
    const offset = (state.currentPage - 1) * state.pageSize;
    sql += `\nLIMIT ${state.pageSize} OFFSET ${offset};`;
    
    return sql;
}
```

---

#### (3) 전체 건수 조회 쿼리 생성

```javascript
function generateCountSQL() {
    if (state.gridColumns.length === 0) return null;
    
    let sql = 'SELECT COUNT(*) as total';
    
    const firstTable = state.addedTables[0];
    sql += `\nFROM ${firstTable} AS t1`;

    // JOIN 절 (동일하게)
    for (let i = 1; i < state.addedTables.length; i++) {
        const prevTable = state.addedTables[i - 1];
        const currTable = state.addedTables[i];
        const key = state.tableRelationships[prevTable]?.[currTable] || 'id';
        sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${key} = t${i + 1}.${key}`;
    }

    // WHERE 절 (동일하게)
    const whereClauses = state.gridColumns
        .filter(c => c.filter && c.filter.value !== '')
        .map(c => {
            let val = c.filter.value;
            if (c.filter.operator === 'LIKE') val = `'%${val}%'`;
            else if (isNaN(val)) val = `'${val}'`;
            return `${c.alias}.${c.column} ${c.filter.operator} ${val}`;
        });
    if (whereClauses.length > 0) sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;
    
    sql += ';';
    return sql;
}
```

---

#### (4) executeQuery 수정 (전체 건수 조회 추가)

```javascript
async function executeQuery() {
    try {
        // 먼저 전체 건수 조회
        const countSQL = generateCountSQL();
        if (countSQL) {
            const countRes = await fetch(`${API_BASE_URL}/api/execute-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: countSQL })
            });
            
            if (countRes.ok) {
                const countResult = await countRes.json();
                state.totalCount = countResult.data[0]?.total || 0;
            }
        }
        
        // 데이터 조회
        const sql = generateSQL();
        
        // SQL 표시
        const sqlDisplay = document.getElementById('sqlDisplay');
        if (sqlDisplay) {
            sqlDisplay.value = sql;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/execute-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '실행 실패');
        }
        
        const result = await res.json();
        state.resultData = result.data || [];
        
        renderGrid();
        updatePagination();
        
        showToast('success', `${result.count}건 조회 완료`);
        
    } catch (e) {
        showToast('error', e.message || '실행 실패');
    }
}
```

---

#### (5) 페이지네이션 UI 업데이트

```javascript
function updatePagination() {
    const paginationBar = document.getElementById('paginationBar');
    
    if (state.gridColumns.length === 0 || state.totalCount === 0) {
        paginationBar.style.display = 'none';
        return;
    }
    
    paginationBar.style.display = 'flex';
    
    // 현재 범위 계산
    const start = (state.currentPage - 1) * state.pageSize + 1;
    const end = Math.min(state.currentPage * state.pageSize, state.totalCount);
    
    // 전체 페이지 수
    const totalPages = Math.ceil(state.totalCount / state.pageSize);
    
    // UI 업데이트
    document.getElementById('recordRange').textContent = `${start}-${end}건`;
    document.getElementById('totalCount').textContent = `${state.totalCount}건`;
    document.getElementById('currentPage').textContent = state.currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    // 버튼 활성/비활성
    document.getElementById('firstBtn').disabled = state.currentPage === 1;
    document.getElementById('prevBtn').disabled = state.currentPage === 1;
    document.getElementById('nextBtn').disabled = state.currentPage >= totalPages;
    document.getElementById('lastBtn').disabled = state.currentPage >= totalPages;
}
```

---

#### (6) 페이지 이동 함수들

```javascript
// 첫 페이지
function firstPage() {
    if (state.currentPage !== 1) {
        state.currentPage = 1;
        executeQuery();
    }
}

// 이전 페이지
function prevPage() {
    if (state.currentPage > 1) {
        state.currentPage--;
        executeQuery();
    }
}

// 다음 페이지
function nextPage() {
    const totalPages = Math.ceil(state.totalCount / state.pageSize);
    if (state.currentPage < totalPages) {
        state.currentPage++;
        executeQuery();
    }
}

// 마지막 페이지
function lastPage() {
    const totalPages = Math.ceil(state.totalCount / state.pageSize);
    if (state.currentPage !== totalPages) {
        state.currentPage = totalPages;
        executeQuery();
    }
}

// 페이지 크기 변경
function changePageSize() {
    const select = document.getElementById('pageSizeSelect');
    state.pageSize = parseInt(select.value);
    state.currentPage = 1; // 첫 페이지로 리셋
    executeQuery();
}
```

---

#### (7) 컬럼 추가/필터/정렬 시 페이지 리셋

```javascript
// addColumnToGrid 수정
function addColumnToGrid(columnInfo) {
    // ... 기존 코드 ...
    
    state.currentPage = 1; // ⭐ 페이지 리셋
    renderGrid();
    executeQuery();
    showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`);
}

// toggleSort 수정
function toggleSort(columnIndex) {
    // ... 기존 코드 ...
    
    state.currentPage = 1; // ⭐ 페이지 리셋
    renderGrid();
    
    if (state.gridColumns.length > 0) {
        executeQuery();
    }
}

// applyFilter 수정
function applyFilter(columnIndex) {
    // ... 기존 코드 ...
    
    state.currentPage = 1; // ⭐ 페이지 리셋
    document.querySelector('.filter-popup')?.remove();
    renderGrid();
    
    if (state.gridColumns.length > 0) {
        executeQuery();
    }
}
```

---

## 🎯 최종 UI 구성

```
┌────────────────────────────────────────────────────────┐
│ 🔍 스타벅스 CRM 쿼리 빌더   [⚙️ API] [초기화] [실행] │
└────────────────────────────────────────────────────────┘

┌────────────┐  ┌──────────────────────────────────────┐
│ 📁 테이블  │  │ campaign_id │ name      │ count     │
├────────────┤  ├─────────────┼───────────┼───────────┤
│ ▼ Table1   │  │ C001        │ 신년특가  │ 1000      │
│   col1     │→ │ C002        │ 봄맞이    │ 2000      │
│   col2     │  │ ...         │ ...       │ ...       │
│            │  └──────────────────────────────────────┘
│ ▶ Table2   │  ┌──────────────────────────────────────┐
└────────────┘  │ 📊 101-200건 / 총 1,523건  [100건▼] │
                │ [⏮️ 처음] [◀ 이전] 페이지 2/16      │
                │                    [다음 ▶] [마지막⏭️]│
                └──────────────────────────────────────┘
                ────────────────────────────────────────
                📄 실행된 SQL      [🤖 해석] [📋 복사]
                ┌────────────────────────────────────┐
                │ SELECT                             │
                │   t1.campaign_id,                  │
                │   t1.name,                         │
                │   t1.count                         │
                │ FROM cmpn_target AS t1             │
                │ ORDER BY t1.count DESC             │
                │ LIMIT 100 OFFSET 100;              │
                └────────────────────────────────────┘
                ────────────────────────────────────────
                💬 Claude 해석                      [×]
                ┌────────────────────────────────────┐
                │ 이 쿼리는 캠페인 타겟 테이블에서   │
                │ 2번째 페이지(101-200번째 레코드)의│
                │ 캠페인 정보를 발송 건수가 많은    │
                │ 순서대로 조회합니다.               │
                └────────────────────────────────────┘
```

---

## 📦 전체 통합 요약

### 추가된 기능

#### 1. Claude API 해석 🤖
- ✅ API 키 설정 모달
- ✅ 로컬 스토리지에 API 키 저장
- ✅ SQL 해석 요청 버튼
- ✅ 해석 결과 표시 영역
- ✅ 에러 처리

#### 2. 페이지네이션 📄
- ✅ LIMIT + OFFSET 방식
- ✅ 전체 건수 조회 (COUNT 쿼리)
- ✅ 현재 범위 표시 (예: 101-200건 / 총 1,523건)
- ✅ 페이지 이동 버튼 (처음/이전/다음/마지막)
- ✅ 페이지 크기 선택 (50/100/200/500건)
- ✅ 컬럼 추가/필터/정렬 시 자동 첫 페이지 리셋

---

## 🚨 주의사항

### Claude API 사용 시
1. **API 키 보안**
   - 로컬 스토리지에만 저장
   - 서버로 전송되지 않음
   - 브라우저 개발자 도구에서는 볼 수 있으므로 공용 PC 주의

2. **비용**
   - Claude API는 토큰 기반 과금
   - 쿼리 해석은 보통 500-1000 토큰 사용
   - Sonnet 기준: $0.003/1K 토큰

3. **Rate Limit**
   - 무료 티어: 분당 5회
   - 연속 호출 시 제한 걸릴 수 있음

### 페이지네이션 사용 시
1. **성능**
   - COUNT 쿼리 + 데이터 쿼리 = 2번 실행
   - 테이블 크기가 크면 COUNT가 느릴 수 있음
   - 필요시 COUNT 캐싱 고려

2. **OFFSET 한계**
   - OFFSET이 크면 느려짐 (예: OFFSET 10000)
   - 대안: 커서 기반 페이지네이션 (나중에)

3. **필터/정렬 변경 시**
   - 자동으로 첫 페이지로 리셋
   - 사용자에게 혼란 줄 수 있음 → 토스트로 안내

---

## ✅ 테스트 체크리스트

### Claude API
- [ ] API 설정 모달 열기/닫기
- [ ] API 키 저장 (로컬 스토리지 확인)
- [ ] 잘못된 API 키 입력 시 에러 처리
- [ ] SQL 해석 버튼 클릭
- [ ] 해석 결과 표시
- [ ] 해석 영역 닫기
- [ ] API 호출 실패 시 에러 메시지

### 페이지네이션
- [ ] 컬럼 추가 시 페이지 1로 리셋
- [ ] 전체 건수 정확히 표시
- [ ] 현재 범위 정확히 표시 (예: 101-200건)
- [ ] 첫 페이지에서 [처음]/[이전] 버튼 비활성화
- [ ] 마지막 페이지에서 [다음]/[마지막] 버튼 비활성화
- [ ] 페이지 이동 시 데이터 변경 확인
- [ ] 페이지 크기 변경 시 정상 작동
- [ ] SQL에 OFFSET 정확히 반영
- [ ] 필터/정렬 변경 시 페이지 리셋

---

**이제 완벽한 쿼리 빌더입니다!** 🚀
