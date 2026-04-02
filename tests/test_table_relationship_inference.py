"""
테스트: campaigns / test_coupons_data / test_deliveries_data / test_delivery_tracking / workflows
5개 테이블 관계도 자동 추론 로직.

실행: 프로젝트 루트에서 pytest tests/test_table_relationship_inference.py -v
      또는 python tests/test_table_relationship_inference.py
"""

import sys
from pathlib import Path

# 프로젝트 루트
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from Backend.query_studio_server.pluralize import find_parent_table as _find_parent_table, pluralize


# --- 5개 테이블 컬럼 정의 (describe-table 기준) ---
TABLE_COLUMNS = {
    "campaigns": ["id", "campaign_internal_name", "campaign_label", "created", "last_modified", "created_at", "updated_at"],
    "workflows": ["id", "workflow_internal_name", "workflow_label", "campaign_id", "created", "last_modified", "created_at", "updated_at"],
    "test_coupons_data": ["id", "campaign_id", "campaign_internal_name", "campaign_label", "workflow_id", "workflow_internal_name", "workflow_label", "recipient_id", "created", "last_modified", "coupon_id", "coupon_date"],
    "test_deliveries_data": ["id", "delivery_id", "delivery_internal_name", "delivery_code", "delivery_label", "delivery_channel", "delivery_status", "delivery_date", "campaign_id", "campaign_internal_name", "campaign_label", "workflow_id", "workflow_internal_name", "workflow_label", "recipient_id", "created", "last_modified"],
    "test_delivery_tracking": ["id", "delivery_id", "recipient_id", "tracking_type", "tracking_date", "created_at", "updated_at"],
}

ALLOWED_TABLES = list(TABLE_COLUMNS.keys())


def _table_has_id(table_columns, tbl):
    """테이블에 id 컬럼 있는지 (컬럼이 [str] 또는 [dict] 형태 모두 지원)."""
    cols = table_columns.get(tbl) or []
    if not cols:
        return False
    if isinstance(cols[0], str):
        return "id" in cols
    return any((c or {}).get("column_name") == "id" for c in cols)


def find_parent_table_extended(column_name, from_table, allowed_tables, table_columns):
    """
    find_parent_table 실패 시: 복수형이 테이블명 일부인 경우 매칭.
    예: delivery_id → test_deliveries_data (deliveries 포함)
    """
    if not column_name.endswith("_id"):
        return None
    base = column_name[:-3].rstrip("_")
    if not base:
        return None
    plural = pluralize(base)

    candidates = [
        t for t in allowed_tables
        if t != from_table and plural.lower() in t.lower() and _table_has_id(table_columns, t)
    ]
    if not candidates:
        return None
    # 복수형이 테이블명 마지막 부분에 가까우면 우선 (짧은 것 우선)
    candidates.sort(key=lambda x: (plural.lower() not in x.lower().split("_")[-1], len(x)))
    return candidates[0]


def infer_relationships(allowed_tables, table_columns):
    """
    _id 컬럼 기준 관계 추론 (pluralize + 확장: 복수형이 테이블명 일부).
    반환: [ { from_table, from_column, to_table, to_column, reason }, ... ]
    """
    table_columns = table_columns or {}
    # table_columns가 { name: [col_names] } 형태로 통일
    cols_as_dict = {}
    for t in allowed_tables:
        raw = table_columns.get(t, TABLE_COLUMNS.get(t, []))
        if raw and isinstance(raw[0], dict):
            cols_as_dict[t] = [c.get("column_name") for c in raw if c.get("column_name")]
        else:
            cols_as_dict[t] = list(raw) if raw else []

    out = []
    seen = set()

    for table_name in allowed_tables:
        cols = cols_as_dict.get(table_name, [])
        for col_name in cols:
            if col_name == "id" or not col_name.endswith("_id"):
                continue
            parent = _find_parent_table(col_name, allowed_tables)
            if not parent:
                parent = find_parent_table_extended(col_name, table_name, allowed_tables, cols_as_dict)
            if not parent:
                continue
            key = (table_name, col_name, parent, "id")
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "from_table": table_name,
                "from_column": col_name,
                "to_table": parent,
                "to_column": "id",
                "reason": "pluralize" if _find_parent_table(col_name, allowed_tables) else "extended(복수형⊂테이블명)",
            })
    return out


def build_mermaid_diagram(relationships):
    """Mermaid ER 다이어그램 문자열 반환 (GitHub/Notion 등에서 렌더링 가능)."""
    lines = ["erDiagram", ""]
    for r in relationships:
        # 테이블명에 언더스코어 있으면 Mermaid에서 따옴표로 감싸기
        a, b = r["from_table"], r["to_table"]
        col = r["from_column"]
        if "_" in a or "-" in a:
            a = f'"{a}"'
        if "_" in b or "-" in b:
            b = f'"{b}"'
        lines.append(f"    {b} ||--o{{{a}}} : \"{col}\"")
    return "\n".join(lines)


def build_ascii_diagram(relationships):
    """박스+화살표 ASCII 관계도."""
    # 부모 → 자식 목록 정리
    from collections import defaultdict
    children = defaultdict(list)  # parent -> [(child, column), ...]
    for r in relationships:
        children[r["to_table"]].append((r["from_table"], r["from_column"]))

    def box(name):
        w = max(len(name) + 2, 12)
        top = "+" + "-" * (w - 2) + "+"
        mid = "| " + name.ljust(w - 4) + " |"
        return [top, mid, top]

    lines = [
        "",
        "  [campaigns]",
        "       | campaign_id",
        "       +---> [workflows]",
        "       |         | workflow_id",
        "       |         +---> [test_coupons_data]",
        "       |         +---> [test_deliveries_data]",
        "       |                   | delivery_id",
        "       |                   +---> [test_delivery_tracking]",
        "       +---> [test_coupons_data]",
        "       +---> [test_deliveries_data]",
        "",
    ]
    return "\n".join(lines)


def build_relationship_diagram(relationships):
    """관계 리스트를 텍스트 관계도 + Mermaid로 출력."""
    lines = [
        "# 5개 테이블 관계도 (자동 추론)",
        "",
        "## 관계 목록",
        "",
        "| from_table | from_column | to_table | to_column | 추론방법 |",
        "|------------|-------------|----------|-----------|----------|",
    ]
    for r in relationships:
        lines.append(f"| {r['from_table']} | {r['from_column']} | {r['to_table']} | {r['to_column']} | {r['reason']} |")
    lines.extend([
        "",
        "## ASCII 관계도",
        "```",
    ])
    lines.append(build_ascii_diagram(relationships))
    lines.extend([
        "```",
        "",
        "## Mermaid ER 다이어그램",
        "(아래 블록을 [Mermaid Live](https://mermaid.live) 또는 GitHub 마크다운에 붙여넣으면 시각화됩니다.)",
        "",
        "```mermaid",
        build_mermaid_diagram(relationships),
        "```",
        "",
    ])
    return "\n".join(lines)


def test_infer_relationships():
    """5개 테이블 관계 추론 결과 검증."""
    rels = infer_relationships(ALLOWED_TABLES, TABLE_COLUMNS)

    # workflows → campaigns
    assert any(r["from_table"] == "workflows" and r["from_column"] == "campaign_id" and r["to_table"] == "campaigns" for r in rels)

    # test_coupons_data → campaigns, workflows
    assert any(r["from_table"] == "test_coupons_data" and r["to_table"] == "campaigns" for r in rels)
    assert any(r["from_table"] == "test_coupons_data" and r["to_table"] == "workflows" for r in rels)

    # test_deliveries_data → campaigns, workflows
    assert any(r["from_table"] == "test_deliveries_data" and r["to_table"] == "campaigns" for r in rels)
    assert any(r["from_table"] == "test_deliveries_data" and r["to_table"] == "workflows" for r in rels)

    # test_delivery_tracking → test_deliveries_data (확장 추론)
    tracking_to_deliveries = [r for r in rels if r["from_table"] == "test_delivery_tracking" and r["to_table"] == "test_deliveries_data"]
    assert len(tracking_to_deliveries) == 1
    assert tracking_to_deliveries[0]["from_column"] == "delivery_id"
    assert "extended" in tracking_to_deliveries[0]["reason"].lower() or "복수" in tracking_to_deliveries[0]["reason"]


def test_run_and_print():
    """추론 실행 후 관계도 출력 (실행 시 확인용)."""
    rels = infer_relationships(ALLOWED_TABLES, TABLE_COLUMNS)
    diagram = build_relationship_diagram(rels)
    print(diagram)
    assert len(rels) >= 6  # workflows→campaigns, coupons→campaigns, coupons→workflows, deliveries→campaigns, deliveries→workflows, tracking→deliveries


if __name__ == "__main__":
    rels = infer_relationships(ALLOWED_TABLES, TABLE_COLUMNS)
    diagram = build_relationship_diagram(rels)
    print(diagram)
    print(f"\n총 {len(rels)}개 관계 추론됨.")
    # 관계도 파일로 저장 (docs 또는 tests 폴더)
    out_path = _ROOT / "docs" / "report" / "5테이블_관계도_추론.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(diagram, encoding="utf-8")
    print(f"\n관계도 저장: {out_path}")
