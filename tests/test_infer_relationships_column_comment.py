"""컬럼 코멘트 기반 저장 테이블(col_n) → 부모 _id 추론 (relationship_inference)."""

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from Backend.query_studio_server.relationship_inference import infer_relationships


def test_saved_table_col_with_comment_maps_to_campaigns():
    allowed = ["test_report_x", "campaigns"]
    table_columns = {
        "test_report_x": [
            {"column_name": "col_1", "data_type": "bigint", "column_comment": "campaigns_id"},
        ],
        "campaigns": [
            {"column_name": "id", "data_type": "bigint"},
        ],
    }
    rels = infer_relationships(allowed, table_columns, existing_keys=set())
    hit = [r for r in rels if r.get("from_table") == "test_report_x" and r.get("to_table") == "campaigns"]
    assert len(hit) == 1
    assert hit[0]["from_column"] == "col_1"
    assert hit[0]["to_column"] == "id"
    assert hit[0].get("source") == "inferred_comment"
    assert "코멘트" in (hit[0].get("reason") or "")


def test_no_comment_still_uses_physical_column_name():
    allowed = ["workflows", "campaigns"]
    table_columns = {
        "workflows": [
            {"column_name": "id", "data_type": "bigint"},
            {"column_name": "campaign_id", "data_type": "bigint"},
        ],
        "campaigns": [{"column_name": "id", "data_type": "bigint"}],
    }
    rels = infer_relationships(allowed, table_columns, existing_keys=set())
    hit = [r for r in rels if r["from_table"] == "workflows" and r["from_column"] == "campaign_id"]
    assert len(hit) == 1
    assert hit[0].get("source") == "inferred"
