"""
widget_board_server.chart_recommender (프로파일 기반 차트 후보 생성)
================================================================
DB 없음. `columns` 리스트(dict, semantic_role 등)만으로 규칙 1~8 전부 평가·append,
규칙 5는 규칙 3 매칭 시에만, 규칙 9는 후보 비었을 때만. confidence 내림차순 후 rank·aggregation 채움.

[Main Functions]
===========
1. determine_aggregation — 컬럼명 키워드(§5.1.3)·IDENTIFIER·MEASURE 기본 SUM 등
2. recommend(columns, top_n) — ChartRecommendation 리스트

[Dependencies]
===========
- dataclasses.dataclass
- typing (Any)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ChartRecommendation:
    rank: int
    chart_type: str
    confidence: float
    x_axis: str | None
    y_axis: list[str]
    color_by: str | None
    aggregation: dict[str, str]
    reason_ko: str


def determine_aggregation(column_name: str, semantic_role: str) -> str:
    """§5.1.3: MEASURE는 컬럼명 키워드로 SUM/AVG 분기, IDENTIFIER는 COUNT_DISTINCT."""
    name_lower = (column_name or "").lower()
    role = (semantic_role or "").strip().upper()

    if role == "IDENTIFIER":
        return "COUNT_DISTINCT"

    if role == "MEASURE":
        if any(
            kw in name_lower
            for kw in (
                "amount",
                "price",
                "cost",
                "total",
                "revenue",
                "sales",
                "budget",
            )
        ):
            return "SUM"
        if any(
            kw in name_lower
            for kw in (
                "rate",
                "ratio",
                "score",
                "avg",
                "average",
                "percentage",
                "pct",
            )
        ):
            return "AVG"
        if any(
            kw in name_lower
            for kw in ("count", "cnt", "qty", "quantity", "num")
        ):
            return "SUM"
        return "SUM"

    if role == "TEMPORAL":
        return "MIN"
    if role in ("DIMENSION", "HIGH_CARDINALITY_TEXT", "GEO"):
        return "COUNT_DISTINCT"
    return "SUM"


def _cols_by_role(columns: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {
        "TEMPORAL": [],
        "MEASURE": [],
        "DIMENSION": [],
        "IDENTIFIER": [],
        "GEO": [],
        "HIGH_CARDINALITY_TEXT": [],
    }
    for c in columns:
        if not isinstance(c, dict):
            continue
        role = (c.get("semantic_role") or "").strip().upper()
        if role in buckets:
            buckets[role].append(c)
    return buckets


def _name(col: dict[str, Any]) -> str:
    return str(col.get("name") or "")


def _try_line(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["TEMPORAL"]) >= 1 and len(b["MEASURE"]) == 1:
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="line",
                confidence=0.95,
                x_axis=_name(b["TEMPORAL"][0]),
                y_axis=[_name(b["MEASURE"][0])],
                color_by=None,
                aggregation={},
                reason_ko="시계열 1개와 수치 1개라 추세(선형) 차트를 추천합니다.",
            )
        )


def _try_combo(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["TEMPORAL"]) >= 1 and len(b["MEASURE"]) >= 2:
        ys = [_name(x) for x in b["MEASURE"]]
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="combo",
                confidence=0.90,
                x_axis=_name(b["TEMPORAL"][0]),
                y_axis=ys,
                color_by=None,
                aggregation={},
                reason_ko="시계열 축에 수치 지표가 여러 개라 복합(콤보) 차트를 추천합니다.",
            )
        )


def _rule3_matched(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> bool:
    before = len(out)
    if len(b["TEMPORAL"]) == 0 and len(b["DIMENSION"]) >= 1 and len(b["MEASURE"]) == 1:
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="bar",
                confidence=0.90,
                x_axis=_name(b["DIMENSION"][0]),
                y_axis=[_name(b["MEASURE"][0])],
                color_by=None,
                aggregation={},
                reason_ko="범주형 축과 수치 1개라 막대 차트를 추천합니다.",
            )
        )
    return len(out) > before


def _try_grouped_bar(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["TEMPORAL"]) == 0 and len(b["DIMENSION"]) >= 1 and len(b["MEASURE"]) >= 2:
        ys = [_name(x) for x in b["MEASURE"]]
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="grouped_bar",
                confidence=0.85,
                x_axis=_name(b["DIMENSION"][0]),
                y_axis=ys,
                color_by=None,
                aggregation={},
                reason_ko="범주 축에 비교할 수치가 여러 개라 그룹 막대를 추천합니다.",
            )
        )


def _try_pie(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["DIMENSION"]) != 1 or len(b["MEASURE"]) != 1:
        return
    dim = b["DIMENSION"][0]
    if int(dim.get("distinct_count") or 0) > 5:
        return
    out.append(
        ChartRecommendation(
            rank=0,
            chart_type="pie",
            confidence=0.80,
            x_axis=_name(dim),
            y_axis=[_name(b["MEASURE"][0])],
            color_by=None,
            aggregation={},
            reason_ko="범주 수준이 적어(고유값≤5) 비율(파이) 표현을 보조 추천합니다.",
        )
    )


def _try_stacked_bar(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["TEMPORAL"]) >= 1 and len(b["DIMENSION"]) >= 1 and len(b["MEASURE"]) >= 1:
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="stacked_bar",
                confidence=0.85,
                x_axis=_name(b["TEMPORAL"][0]),
                y_axis=[_name(b["MEASURE"][0])],
                color_by=_name(b["DIMENSION"][0]),
                aggregation={},
                reason_ko="시계열·분류·수치가 함께 있어 누적 막대로 구성해 볼 수 있습니다.",
            )
        )


def _try_scatter(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if len(b["MEASURE"]) >= 2 and len(b["IDENTIFIER"]) >= 1:
        m0, m1 = b["MEASURE"][0], b["MEASURE"][1]
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="scatter",
                confidence=0.75,
                x_axis=_name(m0),
                y_axis=[_name(m1)],
                color_by=None,
                aggregation={},
                reason_ko="수치 2개와 식별 컬럼이 있어 산점도로 상관을 볼 수 있습니다.",
            )
        )


def _try_number(
    b: dict[str, list[dict[str, Any]]],
    out: list[ChartRecommendation],
) -> None:
    if (
        len(b["MEASURE"]) == 1
        and len(b["TEMPORAL"]) == 0
        and len(b["DIMENSION"]) == 0
    ):
        out.append(
            ChartRecommendation(
                rank=0,
                chart_type="number",
                confidence=0.90,
                x_axis=None,
                y_axis=[_name(b["MEASURE"][0])],
                color_by=None,
                aggregation={},
                reason_ko="단일 지표만 있어 카드형 수치 요약을 추천합니다.",
            )
        )


def recommend(columns: list[dict[str, Any]], top_n: int = 3) -> list[ChartRecommendation]:
    b = _cols_by_role(columns if isinstance(columns, list) else [])
    candidates: list[ChartRecommendation] = []

    _try_line(b, candidates)
    _try_combo(b, candidates)
    matched_r3 = _rule3_matched(b, candidates)
    _try_grouped_bar(b, candidates)
    if matched_r3:
        _try_pie(b, candidates)
    _try_stacked_bar(b, candidates)
    _try_scatter(b, candidates)
    _try_number(b, candidates)

    if not candidates:
        candidates.append(
            ChartRecommendation(
                rank=0,
                chart_type="table",
                confidence=0.50,
                x_axis=None,
                y_axis=[],
                color_by=None,
                aggregation={},
                reason_ko="규칙에 맞는 차트 조합이 없어 표 형태로 확인하는 것을 추천합니다.",
            )
        )

    candidates.sort(key=lambda r: r.confidence, reverse=True)
    tn = max(1, int(top_n))
    trimmed = candidates[:tn]

    for i, rec in enumerate(trimmed, start=1):
        agg: dict[str, str] = {}
        role_by_y = {}
        for c in columns:
            if isinstance(c, dict) and c.get("name"):
                role_by_y[str(c["name"])] = str(c.get("semantic_role") or "")

        if rec.chart_type == "scatter" and rec.x_axis:
            agg[rec.x_axis] = determine_aggregation(rec.x_axis, role_by_y.get(rec.x_axis, "MEASURE"))
        for yn in rec.y_axis:
            agg[yn] = determine_aggregation(yn, role_by_y.get(yn, "MEASURE"))
        if rec.color_by:
            agg.setdefault(
                rec.color_by,
                determine_aggregation(rec.color_by, role_by_y.get(rec.color_by, "DIMENSION")),
            )

        rec.rank = i
        rec.aggregation = agg

    return trimmed
