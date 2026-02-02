/**
 * Frontend 앱 진입 스크립트 (쿼리 빌더)
 * API Base URL: Env/config frontend.api_base_url 과 동일하게 맞출 것. 주입 시 window.APP_CONFIG.apiBaseUrl 사용.
 */
const API_BASE_URL = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || 'http://localhost:5001';
const state = {
    allTables: [],
    tableRelationships: {},
    addedTables: [],
    gridColumns: [],
    orderBy: [],
    filters: [],
    resultData: [],
    currentPage: 1,
    pageSize: 100,
    totalCount: 0
};

let tableExpanded = {};
let draggedItem = null;
let draggedColumnIndex = null;

function filterSidebarTables(q) {
    const keyword = (q || '').trim().toLowerCase();
    document.querySelectorAll('.table-group').forEach(el => {
        const name = (el.dataset.table || '').toLowerCase();
        el.classList.toggle('hide-by-search', keyword && name.indexOf(keyword) === -1);
    });
}

function buildTableRelationshipsFromApi(relationships) {
    state.tableRelationships = {};
    (relationships || []).forEach(r => {
        const fromTable = r.from_table;
        const toTable = r.to_table;
        const fromCol = r.from_column;
        const toCol = r.to_column;
        if (!state.tableRelationships[fromTable]) state.tableRelationships[fromTable] = {};
        if (!state.tableRelationships[toTable]) state.tableRelationships[toTable] = {};
        state.tableRelationships[fromTable][toTable] = { prevColumn: fromCol, currColumn: toCol };
        state.tableRelationships[toTable][fromTable] = { prevColumn: toCol, currColumn: fromCol };
    });
    state.allTables.forEach(t => {
        if (!state.tableRelationships[t.table_name]) state.tableRelationships[t.table_name] = {};
    });
}

function getJoinKey(prevTable, currTable) {
    const rel = state.tableRelationships[prevTable]?.[currTable];
    if (rel && rel.prevColumn != null && rel.currColumn != null) return rel;
    const rev = state.tableRelationships[currTable]?.[prevTable];
    if (rev && rev.prevColumn != null && rev.currColumn != null)
        return { prevColumn: rev.currColumn, currColumn: rev.prevColumn };
    return null;
}

function updateAvailableTables() {
    state.allTables.forEach(table => {
        const group = document.querySelector(`.table-group[data-table="${table.table_name}"]`);
        if (!group) return;
        let available = true;
        if (state.addedTables.length === 0) {
            available = true;
        } else if (state.addedTables.includes(table.table_name)) {
            available = true;
        } else {
            const last = state.addedTables[state.addedTables.length - 1];
            const relLast = state.tableRelationships[last] || {};
            const relTable = state.tableRelationships[table.table_name] || {};
            available = !!relLast[table.table_name] || !!relTable[last];
        }
        group.classList.toggle('disabled', !available);
        const hint = group.querySelector('.disabled-hint');
        if (hint) hint.textContent = available ? '' : '🚫 JOIN 불가';
    });
}

function getNextAlias() {
    return 't' + (state.addedTables.length + 1);
}

function toggleTable(tableName) {
    const group = document.querySelector(`.table-group[data-table="${tableName}"]`);
    if (group && group.classList.contains('disabled')) return;
    tableExpanded[tableName] = !tableExpanded[tableName];
    const list = document.querySelector(`.table-group[data-table="${tableName}"] .column-list`);
    const icon = document.querySelector(`.table-group[data-table="${tableName}"] .toggle-icon`);
    if (list) list.classList.toggle('expanded', tableExpanded[tableName]);
    if (icon) icon.textContent = tableExpanded[tableName] ? '▼' : '▶';
}

function setDbStatus(ok, message) {
    const el = document.getElementById('dbStatus');
    if (!el) return;
    el.textContent = message || (ok ? 'DB 연결됨' : 'DB 연결 안됨');
    el.className = 'sidebar-db-status ' + (ok ? 'ok' : 'error');
}

async function init() {
    const dbStatusEl = document.getElementById('dbStatus');
    try {
        const healthRes = await fetch(`${API_BASE_URL}/health`);
        const healthData = await healthRes.json().catch(() => ({}));
        if (healthRes.ok && healthData.status === 'healthy') {
            setDbStatus(true, 'DB 연결됨');
        } else {
            const msg = healthData.error || healthData.message || 'API 서버 연결 실패';
            setDbStatus(false, 'DB 연결 안됨: ' + (msg.length > 40 ? msg.slice(0, 40) + '…' : msg));
        }
    } catch (e) {
        setDbStatus(false, 'API 서버 연결 실패 (5001 포트 확인)');
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/list-tables`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errMsg = data.error || data.message || '테이블 목록 조회 실패';
            showToast('error', errMsg);
            if (dbStatusEl) dbStatusEl.textContent = 'DB 연결 안됨: ' + (errMsg.length > 35 ? errMsg.slice(0, 35) + '…' : errMsg);
            if (dbStatusEl) dbStatusEl.className = 'sidebar-db-status error';
            document.getElementById('sidebarContent').textContent = 'DB 설정 후 새로고침하세요. (Env/config/config.json 또는 .env에 DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)';
            return;
        }
        state.allTables = data.tables || [];
        for (const t of state.allTables) {
            const r = await fetch(`${API_BASE_URL}/api/describe-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_name: t.table_name })
            });
            const d = await r.json();
            t.columns = d.columns || [];
            tableExpanded[t.table_name] = false;
        }
        const relRes = await fetch(`${API_BASE_URL}/api/table-relationships`);
        const relData = await relRes.json();
        buildTableRelationshipsFromApi(relData.relationships || []);
        renderSidebar();
        updateAvailableTables();
    } catch (e) {
        showToast('error', e.message || '테이블 로드 실패');
        if (dbStatusEl) dbStatusEl.textContent = 'DB 연결 안됨';
        if (dbStatusEl) dbStatusEl.className = 'sidebar-db-status error';
        document.getElementById('sidebarContent').textContent = 'API 연결 실패. Backend(5001) 실행 여부와 Env/config/config.json 또는 .env 설정을 확인하세요.';
    }
}

function renderFilterOrderBar() {
    const bar = document.getElementById('filterOrderBar');
    if (!bar) return;
    if (state.gridColumns.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'block';
    const chipsEl = document.getElementById('filterChips');
    if (!chipsEl) return;
    chipsEl.innerHTML = state.filters
        .map((f, i) => {
            const col = state.gridColumns.find(c => c.table === f.table && c.column === f.column);
            if (!col) return '';
            return `<span class="filter-chip">${f.column} ${f.operator} ${f.value} <span class="chip-remove" onclick="removeFilter(${i})">×</span></span>`;
        })
        .filter(Boolean).join('') || '';
    const orderByChipsEl = document.getElementById('orderByChips');
    if (orderByChipsEl) {
        orderByChipsEl.innerHTML = state.orderBy
            .map((ob, i) => {
                const c = state.gridColumns[ob.columnIndex];
                if (!c) return '';
                const dirLabel = ob.dir === 'DESC' ? '내림차순' : '오름차순';
                return `<span class="filter-chip">${c.column} ${dirLabel} <span class="chip-remove" onclick="removeOrderBy(${i})">×</span></span>`;
            })
            .filter(Boolean).join('') || '';
    }
}

function showAddOrderByMenu() {
    document.querySelectorAll('.add-filter-menu').forEach(m => m.remove());
    document.querySelectorAll('.order-by-popup').forEach(p => p.remove());
    const usedColumnIndexes = new Set(state.orderBy.map(ob => ob.columnIndex));
    const available = state.gridColumns
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => !usedColumnIndexes.has(i));
    const menu = document.createElement('div');
    menu.className = 'add-filter-menu';
    menu.setAttribute('data-type', 'orderby');
    menu.innerHTML = available.length === 0
        ? '<div class="add-filter-menu-empty">이미 모든 컬럼이 ORDER BY에 추가되어 있습니다.</div>'
        : available.map(({ c, i }) => `<button type="button" onclick="openOrderByPopup(${i}); this.closest('.add-filter-menu').remove();">${c.column}</button>`).join('');
    const btn = document.querySelector('.filter-order-bar .btn-small[onclick="showAddOrderByMenu()"]');
    if (btn) {
        const r = btn.getBoundingClientRect();
        menu.style.left = r.left + 'px';
        menu.style.top = r.bottom + 4 + 'px';
    }
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target) && !e.target.closest('.filter-order-bar .btn-small[onclick="showAddOrderByMenu()"]')) {
            menu.remove();
            document.removeEventListener('click', close);
        }
    }), 0);
}

function openOrderByPopup(columnIndex) {
    if (!state.gridColumns[columnIndex]) return;
    document.querySelectorAll('.order-by-popup').forEach(p => p.remove());
    const col = state.gridColumns[columnIndex];
    const popup = document.createElement('div');
    popup.className = 'filter-popup order-by-popup';
    popup.dataset.columnIndex = String(columnIndex);
    popup.innerHTML = `
        <div class="filter-header">
            <span>📋 ORDER BY: ${col.column}</span>
            <span class="filter-close" onclick="this.closest('.order-by-popup').remove()">×</span>
        </div>
        <div class="filter-body">
            <select id="orderByDirPopup">
                <option value="ASC">오름차순</option>
                <option value="DESC">내림차순</option>
            </select>
        </div>
        <div class="filter-actions">
            <button class="btn-small secondary" onclick="this.closest('.order-by-popup').remove()">취소</button>
            <button class="btn-small primary" onclick="applyOrderByFromPopup(this)">적용</button>
        </div>
    `;
    const btn = document.querySelector('.filter-order-bar .btn-small[onclick="showAddOrderByMenu()"]');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + 5) + 'px';
    }
    document.body.appendChild(popup);
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!popup.contains(e.target) && !e.target.closest('.filter-order-bar .btn-small[onclick="showAddOrderByMenu()"]')) {
                popup.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 0);
}

function applyOrderByFromPopup(btnEl) {
    const popup = btnEl.closest('.order-by-popup');
    const columnIndex = popup ? parseInt(popup.dataset.columnIndex, 10) : -1;
    if (columnIndex < 0 || !state.gridColumns[columnIndex]) return;
    const dir = document.getElementById('orderByDirPopup')?.value || 'ASC';
    state.orderBy.push({ columnIndex, dir });
    state.currentPage = 1;
    popup.remove();
    renderFilterOrderBar();
    if (state.gridColumns.length > 0) executeQuery();
}

function removeOrderBy(rowIndex) {
    state.orderBy.splice(rowIndex, 1);
    state.currentPage = 1;
    renderFilterOrderBar();
    renderGrid();
    if (state.gridColumns.length > 0) executeQuery();
}

function showAddFilterMenu() {
    document.querySelectorAll('.add-filter-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'add-filter-menu';
    menu.innerHTML = state.gridColumns
        .map((c, i) => `<button type="button" onclick="openFilterPopup(${i}); this.closest('.add-filter-menu').remove();">${c.column}</button>`)
        .join('');
    const btn = document.querySelector('.filter-order-bar .btn-small[onclick="showAddFilterMenu()"]');
    if (btn) {
        const r = btn.getBoundingClientRect();
        menu.style.left = r.left + 'px';
        menu.style.top = r.bottom + 4 + 'px';
    }
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target) && !e.target.closest('.filter-order-bar .btn-small')) {
            menu.remove();
            document.removeEventListener('click', close);
        }
    }), 0);
}

function openFilterPopup(columnIndex) {
    if (!state.gridColumns[columnIndex]) return;
    showFilter(null, columnIndex);
}

function renderSidebar() {
    const el = document.getElementById('sidebarContent');
    el.innerHTML = state.allTables.map(t => {
        const expanded = tableExpanded[t.table_name];
        const cols = t.columns || [];
        return `
        <div class="table-group" data-table="${t.table_name}">
            <div class="table-header" onclick="toggleTable('${t.table_name}')">
                <span class="toggle-icon">${expanded ? '▼' : '▶'}</span>
                <span class="table-name">${t.table_name}</span>
                <span class="table-count">(${cols.length}개)</span>
                <span class="disabled-hint"></span>
            </div>
            <div class="column-list ${expanded ? 'expanded' : ''}">
                ${cols.map(c => `
                    <div class="column-item" draggable="true" data-table="${t.table_name}" data-column="${c.name}" data-type="${c.type}">
                        <span class="drag-handle">⋮⋮</span>
                        <span class="column-name">${c.name}</span>
                        <span class="column-type">${c.type}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
    filterSidebarTables(document.getElementById('tableSearchInput')?.value || '');
}

function addColumnToGrid(columnInfo) {
    const exists = state.gridColumns.some(c => c.table === columnInfo.table && c.column === columnInfo.column);
    if (exists) {
        showToast('warning', '이미 추가된 컬럼입니다');
        return;
    }
    const isFirst = state.addedTables.length === 0;
    const alias = isFirst ? 't1' : getNextAlias();
    if (!state.addedTables.includes(columnInfo.table)) {
        state.addedTables.push(columnInfo.table);
        updateAvailableTables();
    }
    const tableAliasMap = {};
    state.addedTables.forEach((t, i) => { tableAliasMap[t] = 't' + (i + 1); });
    const colAlias = tableAliasMap[columnInfo.table];
    state.gridColumns.push({
        table: columnInfo.table,
        column: columnInfo.column,
        alias: colAlias,
        type: columnInfo.type
    });
    state.currentPage = 1;
    renderGrid();
    executeQuery();
    showToast('success', `${columnInfo.column} 컬럼이 추가되었습니다`);
}

function renderGrid() {
    const container = document.getElementById('gridContainer');
    if (state.gridColumns.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">왼쪽에서 컬럼을 드래그하세요</div>
                <div class="empty-desc">테이블을 선택하고 원하는 컬럼을 드래그하여<br>데이터를 조회할 수 있습니다</div>
            </div>`;
        container.classList.add('empty');
        return;
    }
    container.classList.remove('empty');

    const headers = state.gridColumns.map((c, i) =>
        `<th draggable="true" data-column-index="${i}" data-table="${c.table}" data-column="${c.column}">
            <div class="header-content">
                <span class="column-name">${c.column}</span>
            </div>
        </th>`
    ).join('');

    const rows = state.resultData.length > 0
        ? state.resultData.map(row =>
            `<tr>${state.gridColumns.map(c => {
                const key = `${c.alias}.${c.column}`;
                return `<td>${row[key] ?? row[c.column] ?? 'NULL'}</td>`;
            }).join('')}</tr>`
        ).join('')
        : `<tr><td colspan="${state.gridColumns.length}" style="text-align:center;padding:40px;">실행 버튼을 눌러 조회하세요</td></tr>`;

    container.innerHTML = `<table class="data-grid"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    renderFilterOrderBar();

    container.querySelectorAll('th').forEach(th => {
        th.addEventListener('dragover', e => {
            if (draggedColumnIndex == null) return;
            e.preventDefault();
            const idx = parseInt(th.dataset.columnIndex);
            if (idx === draggedColumnIndex) return;
            document.querySelectorAll('.data-grid th').forEach(x => {
                x.classList.remove('drag-over-left', 'drag-over-right');
            });
            const rect = th.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            th.classList.add(e.clientX < mid ? 'drag-over-left' : 'drag-over-right');
        });
        th.addEventListener('drop', e => {
            const thTarget = e.target.closest('th');
            if (draggedColumnIndex == null || !thTarget || thTarget.dataset.columnIndex === undefined) return;
            e.preventDefault();
            const toIndex = parseInt(thTarget.dataset.columnIndex);
            if (toIndex !== draggedColumnIndex) {
                const rect = thTarget.getBoundingClientRect();
                const insertBefore = e.clientX < rect.left + rect.width / 2;
                moveColumn(draggedColumnIndex, toIndex, insertBefore);
            }
            draggedColumnIndex = null;
            document.querySelectorAll('.data-grid th').forEach(x => {
                x.classList.remove('drag-over-left', 'drag-over-right', 'dragging');
            });
        });
    });
}

function moveColumn(fromIndex, toIndex, insertBefore) {
    const [moved] = state.gridColumns.splice(fromIndex, 1);
    let newIndex = toIndex;
    if (fromIndex < toIndex) newIndex = insertBefore ? toIndex - 1 : toIndex;
    else newIndex = insertBefore ? toIndex : toIndex + 1;
    state.gridColumns.splice(newIndex, 0, moved);
    renderGrid();
}

function toggleSort(columnIndex) {
    const existing = state.orderBy.find(ob => ob.columnIndex === columnIndex);
    if (existing) {
        if (existing.dir === 'ASC') existing.dir = 'DESC';
        else state.orderBy = state.orderBy.filter(ob => ob.columnIndex !== columnIndex);
    } else {
        state.orderBy.push({ columnIndex: columnIndex, dir: 'ASC' });
    }
    state.currentPage = 1;
    renderGrid();
    renderFilterOrderBar();
    if (state.gridColumns.length > 0) executeQuery();
}

function isDateType(colType) {
    if (!colType) return false;
    const t = String(colType).toLowerCase();
    return t.includes('date') || t.includes('timestamp') || t === 'datetime' || t === 'datetime2';
}
function isDateTimeType(colType) {
    if (!colType) return false;
    const t = String(colType).toLowerCase();
    return t.includes('timestamp') || t === 'datetime' || t === 'datetime2' || t === 'datetimeoffset';
}

function showFilter(event, columnIndex) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('.filter-popup').forEach(p => p.remove());
    const col = state.gridColumns[columnIndex];
    if (!col) return;
    const inputType = isDateTimeType(col.type) ? 'datetime-local' : (isDateType(col.type) ? 'date' : 'text');
    const placeholder = isDateType(col.type) ? '날짜 선택' : '값 입력';
    const popup = document.createElement('div');
    popup.className = 'filter-popup';
    popup.dataset.columnIndex = String(columnIndex);
    popup.innerHTML = `
        <div class="filter-header">
            <span>🔍 필터 추가: ${col.column}</span>
            <span class="filter-close" onclick="this.closest('.filter-popup').remove()">×</span>
        </div>
        <div class="filter-body">
            <select class="filter-operator" id="filterOp_${columnIndex}">
                <option value="=">= (같음)</option>
                <option value="!=">!= (다름)</option>
                <option value=">">> (크다)</option>
                <option value="<">< (작다)</option>
                <option value=">=">≥</option>
                <option value="<=">≤</option>
                <option value="LIKE">포함</option>
            </select>
            <input type="${inputType}" class="filter-value" id="filterVal_${columnIndex}" placeholder="${placeholder}" value="">
        </div>
        <div class="filter-actions">
            <button class="btn-small secondary" onclick="this.closest('.filter-popup').remove()">취소</button>
            <button class="btn-small primary" onclick="applyFilterFromPopup(this)">적용</button>
        </div>
    `;
    const anchor = event && event.target && event.target.closest && event.target.closest('th');
    const btn = document.querySelector('.filter-order-bar .btn-small[onclick="showAddFilterMenu()"]');
    const refEl = (anchor && anchor.getBoundingClientRect) ? anchor : (btn && btn.getBoundingClientRect ? btn : null);
    if (refEl) {
        const rect = refEl.getBoundingClientRect ? refEl.getBoundingClientRect() : { left: 20, bottom: 80 };
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + 5) + 'px';
    } else {
        popup.style.left = '20px';
        popup.style.top = '80px';
    }
    document.body.appendChild(popup);
    setTimeout(() => document.getElementById(`filterVal_${columnIndex}`)?.focus(), 100);
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!popup.contains(e.target) && !e.target.closest('.filter-order-bar .btn-small[onclick="showAddFilterMenu()"]')) {
                popup.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 0);
}

function applyFilterFromPopup(btnEl) {
    const popup = btnEl.closest('.filter-popup');
    const columnIndex = popup ? parseInt(popup.dataset.columnIndex, 10) : -1;
    if (columnIndex < 0 || !state.gridColumns[columnIndex]) return;
    const op = document.getElementById(`filterOp_${columnIndex}`)?.value || '=';
    const val = (document.getElementById(`filterVal_${columnIndex}`)?.value || '').trim();
    if (!val) {
        popup.remove();
        return;
    }
    const col = state.gridColumns[columnIndex];
    state.filters.push({ table: col.table, column: col.column, operator: op, value: val });
    state.currentPage = 1;
    popup.remove();
    document.querySelector('.add-filter-menu')?.remove();
    renderFilterOrderBar();
    if (state.gridColumns.length > 0) executeQuery();
}

function removeFilter(filterIndex) {
    state.filters.splice(filterIndex, 1);
    state.currentPage = 1;
    renderFilterOrderBar();
    if (state.gridColumns.length > 0) executeQuery();
}

function generateSQL() {
    if (state.gridColumns.length === 0) throw new Error('최소 1개의 컬럼을 선택하세요');
    const selectClauses = state.gridColumns.map(c => `${c.alias}.${c.column}`);
    let sql = `SELECT\n    ${selectClauses.join(',\n    ')}`;
    const firstTable = state.addedTables[0];
    sql += `\nFROM ${firstTable} AS t1`;

    for (let i = 1; i < state.addedTables.length; i++) {
        const prevTable = state.addedTables[i - 1];
        const currTable = state.addedTables[i];
        const joinKey = getJoinKey(prevTable, currTable);
        if (!joinKey) throw new Error(`JOIN 관계 없음: ${prevTable} - ${currTable} (FK만 가능)`);
        sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`;
    }

    const whereClauses = state.filters
        .map(f => {
            const c = state.gridColumns.find(col => col.table === f.table && col.column === f.column);
            if (!c) return null;
            let val = f.value;
            if (f.operator === 'LIKE') val = `'%${val}%'`;
            else if (isNaN(val)) val = `'${val}'`;
            return `${c.alias}.${c.column} ${f.operator} ${val}`;
        })
        .filter(Boolean);
    if (whereClauses.length > 0) sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;

    const validOrderBy = state.orderBy.filter(ob => ob.columnIndex >= 0 && state.gridColumns[ob.columnIndex]);
    if (validOrderBy.length > 0)
        sql += `\nORDER BY ${validOrderBy.map(ob => {
            const c = state.gridColumns[ob.columnIndex];
            return `${c.alias}.${c.column} ${ob.dir}`;
        }).join(', ')}`;
    const offset = (state.currentPage - 1) * state.pageSize;
    sql += `\nLIMIT ${state.pageSize} OFFSET ${offset};`;
    return sql;
}

function generateCountSQL() {
    if (state.gridColumns.length === 0) return null;
    let sql = 'SELECT COUNT(*) as total';
    const firstTable = state.addedTables[0];
    sql += `\nFROM ${firstTable} AS t1`;
    for (let i = 1; i < state.addedTables.length; i++) {
        const prevTable = state.addedTables[i - 1];
        const currTable = state.addedTables[i];
        const joinKey = getJoinKey(prevTable, currTable);
        if (!joinKey) throw new Error(`JOIN 관계 없음: ${prevTable} - ${currTable} (FK만 가능)`);
        sql += `\nLEFT JOIN ${currTable} AS t${i + 1} ON t${i}.${joinKey.prevColumn} = t${i + 1}.${joinKey.currColumn}`;
    }
    const whereClauses = state.filters
        .map(f => {
            const c = state.gridColumns.find(col => col.table === f.table && col.column === f.column);
            if (!c) return null;
            let val = f.value;
            if (f.operator === 'LIKE') val = `'%${val}%'`;
            else if (isNaN(val)) val = `'${val}'`;
            return `${c.alias}.${c.column} ${f.operator} ${val}`;
        })
        .filter(Boolean);
    if (whereClauses.length > 0) sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;
    sql += ';';
    return sql;
}

async function executeQuery() {
    try {
        const countSQL = generateCountSQL();
        if (countSQL) {
            const countRes = await fetch(`${API_BASE_URL}/api/execute-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: countSQL })
            });
            if (countRes.ok) {
                const countResult = await countRes.json();
                const raw = countResult.data?.[0]?.total;
                state.totalCount = typeof raw === 'number' ? raw : parseInt(raw, 10) || 0;
            }
        }
        const sql = generateSQL();
        const sqlDisplay = document.getElementById('sqlDisplay');
        if (sqlDisplay) sqlDisplay.value = sql;
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

function updatePagination() {
    const paginationBar = document.getElementById('paginationBar');
    if (state.gridColumns.length === 0 || state.totalCount === 0) {
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }
    paginationBar.style.display = 'flex';
    const start = (state.currentPage - 1) * state.pageSize + 1;
    const end = Math.min(state.currentPage * state.pageSize, state.totalCount);
    const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
    document.getElementById('recordRange').textContent = `${start}-${end}건`;
    document.getElementById('totalCount').textContent = `${state.totalCount}건`;
    document.getElementById('currentPage').textContent = state.currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('firstBtn').disabled = state.currentPage === 1;
    document.getElementById('prevBtn').disabled = state.currentPage === 1;
    document.getElementById('nextBtn').disabled = state.currentPage >= totalPages;
    document.getElementById('lastBtn').disabled = state.currentPage >= totalPages;
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
}

function firstPage() {
    if (state.currentPage !== 1) {
        state.currentPage = 1;
        executeQuery();
    }
}
function prevPage() {
    if (state.currentPage > 1) {
        state.currentPage--;
        executeQuery();
    }
}
function nextPage() {
    const totalPages = Math.ceil(state.totalCount / state.pageSize);
    if (state.currentPage < totalPages) {
        state.currentPage++;
        executeQuery();
    }
}
function lastPage() {
    const totalPages = Math.ceil(state.totalCount / state.pageSize);
    if (state.currentPage !== totalPages) {
        state.currentPage = totalPages;
        executeQuery();
    }
}
function changePageSize() {
    const select = document.getElementById('pageSizeSelect');
    state.pageSize = parseInt(select.value, 10);
    state.currentPage = 1;
    executeQuery();
}

function copySQLToClipboard() {
    const sqlDisplay = document.getElementById('sqlDisplay');
    const sql = sqlDisplay?.value;
    if (!sql) {
        showToast('warning', '복사할 SQL이 없습니다');
        return;
    }
    navigator.clipboard.writeText(sql).then(() => {
        showToast('success', 'SQL이 클립보드에 복사되었습니다');
    }).catch(() => {
        showToast('error', '복사 실패');
    });
}

async function explainSQL() {
    const sqlDisplay = document.getElementById('sqlDisplay');
    const sql = sqlDisplay?.value || '';
    if (!sql) {
        showToast('warning', '실행된 쿼리가 없습니다');
        return;
    }
    const explanationArea = document.getElementById('explanationArea');
    const explanationContent = document.getElementById('explanationContent');
    explanationArea.style.display = 'block';
    explanationContent.className = 'explanation-content loading';
    explanationContent.textContent = '🤖 Claude가 쿼리를 해석하는 중...';
    document.getElementById('sqlPanel').classList.add('expanded');
    try {
        const response = await fetch(`${API_BASE_URL}/api/explain-sql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || 'API 호출 실패');
        }
        const explanation = data.explanation || '';
        explanationContent.className = 'explanation-content';
        explanationContent.textContent = explanation;
        showToast('success', '해석 완료');
    } catch (error) {
        explanationContent.className = 'explanation-content';
        explanationContent.textContent = '❌ 해석 실패: ' + error.message;
        showToast('error', 'Claude API 호출 실패');
    }
}

function closeExplanation() {
    document.getElementById('explanationArea').style.display = 'none';
    document.getElementById('sqlPanel').classList.remove('expanded');
}

function clearAll() {
    if (!confirm('모두 초기화할까요?')) return;
    state.addedTables = [];
    state.gridColumns = [];
    state.orderBy = [];
    state.filters = [];
    state.resultData = [];
    state.currentPage = 1;
    state.totalCount = 0;
    const sqlDisplay = document.getElementById('sqlDisplay');
    if (sqlDisplay) sqlDisplay.value = '';
    document.getElementById('explanationArea').style.display = 'none';
    document.getElementById('sqlPanel').classList.remove('expanded');
    renderGrid();
    updatePagination();
    updateAvailableTables();
    showToast('success', '초기화되었습니다');
}

function showToast(type, msg) {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type} show`;
    document.getElementById('toastIcon').textContent = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';
    document.getElementById('toastMessage').textContent = msg;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('dragstart', e => {
    if (e.target.classList.contains('column-item')) {
        e.target.classList.add('dragging');
        draggedItem = {
            table: e.target.dataset.table,
            column: e.target.dataset.column,
            type: e.target.dataset.type
        };
        document.getElementById('dropOverlay').classList.add('active');
    }
    if (e.target.closest('th') && e.target.closest('th').dataset.columnIndex !== undefined) {
        const th = e.target.closest('th');
        th.classList.add('dragging');
        draggedColumnIndex = parseInt(th.dataset.columnIndex);
    }
});

document.addEventListener('dragend', e => {
    if (e.target.classList.contains('column-item')) {
        e.target.classList.remove('dragging');
        document.getElementById('dropOverlay').classList.remove('active');
    }
    if (e.target.closest('th')) {
        e.target.closest('th').classList.remove('dragging');
        draggedColumnIndex = null;
    }
});

const gridContainer = document.getElementById('gridContainer');
const dropOverlay = document.getElementById('dropOverlay');

gridContainer.addEventListener('dragover', e => {
    if (draggedItem) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
});

gridContainer.addEventListener('drop', e => {
    e.preventDefault();
    if (draggedItem) {
        addColumnToGrid(draggedItem);
        draggedItem = null;
        dropOverlay.classList.remove('active');
    }
});

dropOverlay.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});
dropOverlay.addEventListener('drop', e => {
    e.preventDefault();
    if (draggedItem) {
        addColumnToGrid(draggedItem);
        draggedItem = null;
        dropOverlay.classList.remove('active');
    }
});

init();
