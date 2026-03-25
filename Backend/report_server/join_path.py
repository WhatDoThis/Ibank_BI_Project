"""
Backend.report_server.join_path (JOIN 경로·순서)
=============================================
JOIN 자동 생성: 경로 탐색(BFS), 직접 관계, JOIN 순서 결정. report 라우터에서 determine_join_order, validate_join_order 사용.

[Main Functions]
===========
1. _normalize_rel: 관계를 want_from→want_to 방향으로 정규화
2. find_direct_relationship: 두 테이블 간 직접 FK 관계
3. find_join_path: BFS로 from_table→to_table 최단 경로 (간접 관계)
4. determine_join_order: base_table 기준 required_tables의 JOIN 순서 + 엣지 정보
5. validate_join_order: join_order 유효성 검사 (max_depth 등)

[Dependencies]
=========
- 표준 라이브러리 (collections.deque)
"""

from collections import deque


# 1.
def _normalize_rel(r, want_from, want_to):
    """관계를 want_from -> want_to 방향으로 정규화. JOIN ON: want_from.from_column = want_to.to_column."""
    if r["from_table"] == want_from and r["to_table"] == want_to:
        return {"from_table": r["from_table"], "from_column": r["from_column"], "to_table": r["to_table"], "to_column": r["to_column"]}
    if r["from_table"] == want_to and r["to_table"] == want_from:
        # FK가 (자식, 자식.fk, 부모, 부모.id) 형태 → (부모, 부모.id, 자식, 자식.fk) 로 반환해 ON 부모.id = 자식.fk
        return {"from_table": want_from, "from_column": r["to_column"], "to_table": want_to, "to_column": r["from_column"]}
    return None


# 2.
def find_direct_relationship(table1, table2, fk_list):
    """
    두 테이블 간 직접 FK 관계 반환.
    반환: { from_table, from_column, to_table, to_column } (table1 -> table2 방향) 또는 None
    """
    for r in fk_list:
        n = _normalize_rel(r, table1, table2)
        if n:
            return n
    return None


# 3.
def find_join_path(from_table, to_table, fk_list, max_depth=3):
    """
    BFS로 from_table -> to_table 최단 경로 찾기.
    fk_list: [ { from_table, from_column, to_table, to_column }, ... ]
    반환: [ { from_table, from_column, to_table, to_column }, ... ] 경로의 엣지 리스트, 없으면 None
    """
    if from_table == to_table:
        return []
    # 양방향 인접 리스트: table -> [ (next_table, edge) ]
    adj = {}
    for r in fk_list:
        a, b = r["from_table"], r["to_table"]
        if a not in adj:
            adj[a] = []
        adj[a].append((b, dict(r)))
        if b not in adj:
            adj[b] = []
        adj[b].append((a, {"from_table": b, "from_column": r["to_column"], "to_table": a, "to_column": r["from_column"]}))

    queue = deque([(from_table, [])])  # (current, path_edges)
    visited = {from_table}
    while queue:
        current, path = queue.popleft()
        if len(path) >= max_depth:
            continue
        if current == to_table:
            return path
        for next_table, edge in adj.get(current, []):
            if next_table in visited:
                continue
            visited.add(next_table)
            new_path = path + [edge]
            queue.append((next_table, new_path))
    return None


# 4.
def determine_join_order(base_table, required_tables, fk_list):
    """
    base_table을 기준으로 required_tables의 JOIN 순서 결정.
    직접 연결 우선, 없으면 BFS 경로로 중간 테이블 삽입.
    반환: [ { "table": str, "from_table": str|None, "from_column": str|None, "to_table": str|None, "to_column": str|None }, ... ]
    """
    required = set(required_tables)
    if base_table not in required:
        required.add(base_table)
    ordered = []  # [ { table, from_table?, from_column?, to_table?, to_column? }, ... ]
    ordered_tables = []
    remaining = required - {base_table}

    ordered.append({"table": base_table, "from_table": None, "from_column": None, "to_table": None, "to_column": None})
    ordered_tables.append(base_table)

    while remaining:
        # 1) 이미 순서에 있는 테이블과 직접 연결된 remaining 테이블 추가
        added = False
        for table in list(remaining):
            for prev in ordered_tables:
                rel = find_direct_relationship(prev, table, fk_list)
                if rel:
                    ordered.append({
                        "table": table,
                        "from_table": rel["from_table"],
                        "from_column": rel["from_column"],
                        "to_table": rel["to_table"],
                        "to_column": rel["to_column"],
                    })
                    ordered_tables.append(table)
                    remaining.discard(table)
                    added = True
                    break
            if added:
                break
        if added:
            continue
        # 2) 직접 연결 없음 → BFS 경로로 한 테이블 추가 (경로 상 중간 테이블 포함)
        best_path = None
        best_target = None
        for start in ordered_tables:
            for target in remaining:
                path = find_join_path(start, target, fk_list, max_depth=4)
                if path is not None and (best_path is None or len(path) < len(best_path)):
                    best_path = path
                    best_target = target
        if best_path is None or best_target is None:
            # 경로 없음인 테이블은 마지막에 그대로 추가 (관계 없음으로 실패 가능)
            for table in remaining:
                ordered.append({"table": table, "from_table": None, "from_column": None, "to_table": None, "to_column": None})
                ordered_tables.append(table)
            break
        for edge in best_path:
            to_t = edge["to_table"]
            if to_t not in ordered_tables:
                ordered.append({
                    "table": to_t,
                    "from_table": edge["from_table"],
                    "from_column": edge["from_column"],
                    "to_table": edge["to_table"],
                    "to_column": edge["to_column"],
                })
                ordered_tables.append(to_t)
                remaining.discard(to_t)

    return ordered


# 5.
def validate_join_order(join_order, max_depth=4):
    """
    명세 10: 순환/깊이 검증.
    반환: { "valid": bool, "warnings": [str], "errors": [str] }
    """
    errors = []
    warnings = []
    seen = set()
    for i, step in enumerate(join_order):
        t = step["table"]
        if t in seen:
            errors.append(f"순환 참조: 테이블 '{t}' 중복")
        seen.add(t)
    if len(join_order) > max_depth + 1:
        warnings.append(f"JOIN 깊이 {len(join_order) - 1}단계 (권장 {max_depth} 이하)")
    return {"valid": len(errors) == 0, "warnings": warnings, "errors": errors}
