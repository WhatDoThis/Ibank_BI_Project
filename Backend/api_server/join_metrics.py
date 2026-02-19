"""
Backend.api_server.join_metrics (JOIN 점수·파생 컬럼)
====================================================
JOIN 경우의 수·정확도 점수, 파생 테이블(조인 결과) 컬럼 목록. report 라우터에서 사용.

[Functions]
===========
15 - confidence_to_score: 단일 관계의 신뢰도 점수 (HIGH/MEDIUM/LOW, fk)
27 - join_accuracy_score: join_order 내 엣지별 confidence 평균 (FK=1.0, 추론=0.7/0.5)
69 - join_case_count: base 후보 수 / 유효 join_order 수
91 - derived_table_columns: join_order + 테이블별 컬럼 → 파생 테이블 전체 컬럼 (table, alias, column, type)

[Dependencies]
=========
- 표준 라이브러리만 사용
"""

# 관계 confidence → 점수 (문서 JOIN_지표_및_파생테이블.md)
CONFIDENCE_SCORE = {"HIGH": 1.0, "MEDIUM": 0.7, "LOW": 0.5}


def confidence_to_score(rel):
    """단일 관계의 신뢰도 점수. rel에 confidence 또는 source 있음."""
    if not rel:
        return 0.5
    c = (rel.get("confidence") or "").upper()
    if c in CONFIDENCE_SCORE:
        return CONFIDENCE_SCORE[c]
    if rel.get("source") == "fk":
        return 1.0
    return 0.5


def join_accuracy_score(join_order, fk_list):
    """
    join_order에 포함된 각 엣지가 fk_list에 있으면 해당 confidence, 없으면 0.5.
    반환: 0~1 (엣지별 점수 평균). 엣지 없으면 1.0.
    """
    if not join_order:
        return 1.0
    scores = []
    for step in join_order:
        ft, fc = step.get("from_table"), step.get("from_column")
        tt, tc = step.get("to_table"), step.get("to_column")
        if not ft or not tt:
            continue
        match = next(
            (
                r
                for r in (fk_list or [])
                if r.get("from_table") == ft
                and r.get("from_column") == fc
                and r.get("to_table") == tt
                and r.get("to_column") == tc
            ),
            None,
        )
        if not match:
            match = next(
                (
                    r
                    for r in (fk_list or [])
                    if r.get("from_table") == tt
                    and r.get("from_column") == tc
                    and r.get("to_table") == ft
                    and r.get("to_column") == fc
                ),
                None,
            )
        scores.append(confidence_to_score(match) if match else 0.5)
    if not scores:
        return 1.0
    return round(sum(scores) / len(scores), 4)


def join_case_count(allowed_tables, join_order_result_by_base):
    """
    경우의 수: base 후보 수 중 valid한 join_order를 가진 개수.
    join_order_result_by_base: { base_table: { "valid": bool, "join_order": [...] } }
    반환: { "base_candidates": int, "valid_join_orders": int, "total_edges_in_valid": int }
    """
    bases = list(join_order_result_by_base.keys())
    valid_count = 0
    total_edges = 0
    for base in bases:
        data = join_order_result_by_base.get(base) or {}
        if data.get("valid"):
            valid_count += 1
            steps = data.get("join_order") or []
            total_edges += sum(1 for s in steps if s.get("from_table") and s.get("to_table"))
    return {
        "base_candidates": len(bases),
        "valid_join_orders": valid_count,
        "total_edges_in_valid": total_edges,
    }


def derived_table_columns(join_order, table_columns):
    """
    join_order와 테이블별 컬럼 정보로 파생 테이블(조인 결과) 컬럼 목록 생성.
    table_columns: { table_name: [ {"name": str, "type": str?, ...}, ... ] }
    join_order: [ { "table": str }, ... ]  (순서대로 t1, t2, ... alias 부여)

    반환: {
      "derived_columns": [ { "table", "alias", "column", "type" }, ... ],
      "tables": [ { "table", "alias", "column_count" }, ... ],
      "total_columns": int
    }
    """
    derived_columns = []
    tables_meta = []
    for i, step in enumerate(join_order or []):
        t = step.get("table")
        if not t:
            continue
        alias = f"t{i + 1}"
        cols = table_columns.get(t)
        if not cols:
            cols = []
        if cols and isinstance(cols[0], dict):
            col_list = [{"name": c.get("name"), "type": c.get("type") or ""} for c in cols if c.get("name")]
        else:
            col_list = [{"name": str(c), "type": ""} for c in cols]
        for c in col_list:
            derived_columns.append({
                "table": t,
                "alias": alias,
                "column": c.get("name") or c["name"],
                "type": c.get("type") or "",
            })
        tables_meta.append({"table": t, "alias": alias, "column_count": len(col_list)})
    return {
        "derived_columns": derived_columns,
        "tables": tables_meta,
        "total_columns": len(derived_columns),
    }
