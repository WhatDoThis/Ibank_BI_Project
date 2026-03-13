"""
Backend.new_dash_server2.service (New Dashboard 2 비즈니스 로직)
=============================================================
star_db 전용. 테이블/메트릭 화이트리스트 검증. S1~S8 조회 함수, 날짜 헬퍼.

[Main Functions]
================
1. _calc_date_range, _calc_previous_range, _change_pct: 기간·증감률
2. get_dashboard_overall: S1 종합 KPI + 증감률
3. _build_distribution, get_star_analyze: S2 별 분석
4. get_frequency_analyze: S3 프리퀀시
5. get_coupon_analyze: S4 쿠폰
6. get_campaign_segments, _one_campaign_segment_row: S5 캠페인 세그먼트
7. get_store_order_analyze: S6 매장 주문
8. get_trend_data: S7 추이 (화이트리스트)
9. get_product_master: S8 제품 마스터

[Dependencies]
==============
- Backend.new_dash_server2.star_db, Backend.new_dash_server2.mappings
- calendar, datetime, time
"""

import calendar
import time
from datetime import date, datetime, timedelta
from Backend.new_dash_server2 import star_db
from Backend.new_dash_server2 import mappings

# 테이블 화이트리스트 (S1~S6, S7 trend)
ALLOWED_TABLES = {
    "dashboard_overall",
    "star_analyze_overall",
    "frequency_analyze_overall",
    "coupon_analyze_overall",
    "campaign_segment_overall",
    "store_order_analyze_overall",
}

# S7 trend: 테이블별 스칼라 메트릭만 (연령/성별 컬럼 미포함)
ALLOWED_METRICS = {
    "dashboard_overall": {
        "send_request_cnt", "send_success_cnt", "coupon_issue_cnt",
        "coupon_use_cnt", "star_issue_cnt", "frequency_complete_cnt",
        "order_cnt", "total_sales_cnt",
    },
    "star_analyze_overall": {
        "order_cnt", "star_issue_cnt", "star_first_issue_cnt", "star_send_cnt",
    },
    "frequency_analyze_overall": {"frequency_complete_cnt"},
    "coupon_analyze_overall": {"order_cnt", "coupon_issue_cnt", "coupon_use_cnt"},
    "campaign_segment_overall": {
        "total_target_cnt", "send_request_cnt", "send_success_cnt",
        "order_cnt", "coupon_use_cnt", "market_agree_cnt",
    },
}
assert ALLOWED_METRICS.keys() <= ALLOWED_TABLES, "ALLOWED_METRICS 키가 ALLOWED_TABLES에 포함되지 않음"

# S8 product master cache (TTL 1시간)
_product_master_cache: list[dict] | None = None
_product_master_cache_time: float = 0
_PRODUCT_MASTER_TTL = 3600  # 1시간


# 1.
def _calc_date_range(target_date: str, period: str) -> list[str]:
    """period에 따라 date_range [start, end] 반환. daily=해당 일, weekly=월~일, monthly=1일~말일."""
    dt = datetime.strptime(target_date, "%Y-%m-%d").date()
    if period == "weekly":
        start = dt - timedelta(days=dt.weekday())
        end = start + timedelta(days=6)
        return [start.isoformat(), end.isoformat()]
    if period == "monthly":
        start = dt.replace(day=1)
        last_day = calendar.monthrange(dt.year, dt.month)[1]
        end = dt.replace(day=last_day)
        return [start.isoformat(), end.isoformat()]
    return [target_date, target_date]


# 2.
def _calc_previous_range(date_range: list[str], period: str) -> list[str]:
    """직전 동일 기간 [start, end] 반환."""
    start = datetime.strptime(date_range[0], "%Y-%m-%d").date()
    end = datetime.strptime(date_range[1], "%Y-%m-%d").date()
    if period == "monthly":
        prev_end = start - timedelta(days=1)
        return [prev_end.replace(day=1).isoformat(), prev_end.isoformat()]
    if period == "weekly":
        delta = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        return [(prev_end - timedelta(days=delta - 1)).isoformat(), prev_end.isoformat()]
    prev = start - timedelta(days=1)
    return [prev.isoformat(), prev.isoformat()]


# 3.
def _change_pct(current, previous):
    """이전 대비 증감률 %. previous 0/None이면 None."""
    if previous is None or previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


# 4.
def get_dashboard_overall(target_date: str, period: str = "daily") -> dict:
    """S1: 종합 KPI + 직전 기간 대비 *_change_pct. 데이터 없으면 0 반환, 500 금지."""
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    cols = [
        "send_request_cnt", "send_success_cnt", "coupon_issue_cnt", "coupon_use_cnt",
        "star_issue_cnt", "frequency_complete_cnt", "order_cnt", "total_sales_cnt",
    ]
    sel = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in cols)
    q = f'SELECT {sel} FROM "{schema}"."dashboard_overall" WHERE base_date BETWEEN %s AND %s'

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, (start, end))
        row = cur.fetchone()
        current = {c: (row[c] or 0) for c in cols} if row else {c: 0 for c in cols}

        prev_range = _calc_previous_range(date_range, period)
        cur.execute(q, (prev_range[0], prev_range[1]))
        prev_row = cur.fetchone()
        cur.close()
        previous = {c: (prev_row[c] or 0) for c in cols} if prev_row else {c: 0 for c in cols}

        out = dict(current)
        for c in cols:
            out[f"{c}_change_pct"] = _change_pct(current[c], previous[c])
        # 주문 전환률(%) = 주문건수/발송건수*100, 전기대비는 %p 차이
        curr_send = current.get("send_request_cnt") or 0
        prev_send = previous.get("send_request_cnt") or 0
        curr_conv = (current.get("order_cnt") or 0) / curr_send * 100 if curr_send else 0
        prev_conv = (previous.get("order_cnt") or 0) / prev_send * 100 if prev_send else 0
        out["order_conversion_pp"] = round(curr_conv - prev_conv, 2)
        out["prev_send_request_cnt"] = previous.get("send_request_cnt") or 0
        out["prev_order_cnt"] = previous.get("order_cnt") or 0
        out["period"] = period
        out["date_range_actual"] = date_range
        return out
    finally:
        conn.close()


# 5.
def _build_distribution(row: dict, col_tuples: list[tuple[str, str]], key_name: str = "label") -> list[dict]:
    """(컬럼명, 라벨) 리스트로 distribution [{key_name, count}, ...] 생성. key_name='range' 연령대, 'label' 성별."""
    return [{key_name: label, "count": row.get(col, 0) or 0} for col, label in col_tuples]


# 6.
def get_star_analyze(target_date: str, period: str = "daily") -> dict:
    """S2: 별 분석. issue/send 연령·성별 분포. change_pct 없음."""
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    scalar_cols = ["order_cnt", "star_issue_cnt", "star_first_issue_cnt", "star_send_cnt"]
    issue_age = mappings.age_range_columns("issue_age_range")
    issue_gender = mappings.gender_columns("issue_gender")
    send_age = mappings.age_range_columns("send_age_range")
    send_gender = mappings.gender_columns("send_gender")

    all_cols = scalar_cols + [c for c, _ in issue_age + issue_gender + send_age + send_gender]
    sel = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in all_cols)
    q = f'SELECT {sel} FROM "{schema}"."star_analyze_overall" WHERE base_date BETWEEN %s AND %s'

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, (start, end))
        row = cur.fetchone()
        cur.close()
        if not row:
            out = {c: 0 for c in scalar_cols}
            out["issue_age_distribution"] = _build_distribution({}, issue_age, "range")
            out["issue_gender_distribution"] = _build_distribution({}, issue_gender, "label")
            out["send_age_distribution"] = _build_distribution({}, send_age, "range")
            out["send_gender_distribution"] = _build_distribution({}, send_gender, "label")
        else:
            out = {c: row[c] or 0 for c in scalar_cols}
            out["issue_age_distribution"] = _build_distribution(row, issue_age, "range")
            out["issue_gender_distribution"] = _build_distribution(row, issue_gender, "label")
            out["send_age_distribution"] = _build_distribution(row, send_age, "range")
            out["send_gender_distribution"] = _build_distribution(row, send_gender, "label")
        out["period"] = period
        out["date_range_actual"] = date_range
        return out
    finally:
        conn.close()


# 7.
def get_frequency_analyze(target_date: str, period: str = "daily") -> dict:
    """S3: 프리퀀시. complete 연령·성별 분포. change_pct 없음."""
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    prefix_age = "frequency_complete_age_range"
    prefix_gender = "frequency_complete_gender"
    age_cols = mappings.age_range_columns(prefix_age)
    gender_cols = mappings.gender_columns(prefix_gender)
    scalar = ["frequency_complete_cnt"]
    all_cols = scalar + [c for c, _ in age_cols + gender_cols]
    sel = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in all_cols)
    q = f'SELECT {sel} FROM "{schema}"."frequency_analyze_overall" WHERE base_date BETWEEN %s AND %s'

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, (start, end))
        row = cur.fetchone()
        cur.close()
        if not row:
            out = {"frequency_complete_cnt": 0}
            out["complete_age_distribution"] = _build_distribution({}, age_cols, "range")
            out["complete_gender_distribution"] = _build_distribution({}, gender_cols, "label")
        else:
            out = {"frequency_complete_cnt": row["frequency_complete_cnt"] or 0}
            out["complete_age_distribution"] = _build_distribution(row, age_cols, "range")
            out["complete_gender_distribution"] = _build_distribution(row, gender_cols, "label")
        out["period"] = period
        out["date_range_actual"] = date_range
        return out
    finally:
        conn.close()


# 8.
def get_coupon_analyze(target_date: str, period: str = "daily") -> dict:
    """S4: 쿠폰. issue/use 연령·성별 분포. change_pct 없음."""
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    scalar = ["order_cnt", "coupon_issue_cnt", "coupon_use_cnt"]
    issue_age = mappings.age_range_columns("issue_age_range")
    issue_gender = mappings.gender_columns("issue_gender")
    use_age = mappings.age_range_columns("use_age_range")
    use_gender = mappings.gender_columns("use_gender")
    all_cols = scalar + [c for c, _ in issue_age + issue_gender + use_age + use_gender]
    sel = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in all_cols)
    q = f'SELECT {sel} FROM "{schema}"."coupon_analyze_overall" WHERE base_date BETWEEN %s AND %s'

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, (start, end))
        row = cur.fetchone()
        cur.close()
        if not row:
            out = {c: 0 for c in scalar}
            out["issue_age_distribution"] = _build_distribution({}, issue_age, "range")
            out["issue_gender_distribution"] = _build_distribution({}, issue_gender, "label")
            out["use_age_distribution"] = _build_distribution({}, use_age, "range")
            out["use_gender_distribution"] = _build_distribution({}, use_gender, "label")
        else:
            out = {c: row[c] or 0 for c in scalar}
            out["issue_age_distribution"] = _build_distribution(row, issue_age, "range")
            out["issue_gender_distribution"] = _build_distribution(row, issue_gender, "label")
            out["use_age_distribution"] = _build_distribution(row, use_age, "range")
            out["use_gender_distribution"] = _build_distribution(row, use_gender, "label")
        out["period"] = period
        out["date_range_actual"] = date_range
        return out
    finally:
        conn.close()


# 9.
def get_campaign_segments(target_date: str, period: str = "daily") -> list[dict]:
    """S5: 캠페인 세그먼트. daily=단일 쿼리; weekly/monthly=GROUP BY SUM + DISTINCT ON first_* + merge. age_distribution, gender_distribution, first_* 라벨 정규화."""
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    age_cols = mappings.age_range_columns("age_range")
    gender_cols = mappings.gender_columns("gender")
    num_cols = [
        "total_target_cnt", "send_request_cnt", "send_success_cnt",
        "order_cnt", "coupon_use_cnt", "market_agree_cnt",
    ] + [c for c, _ in age_cols + gender_cols]
    first_cols = ["first_order_age_range", "first_coupon_use_age_range", "first_order_gender", "first_coupon_use_gender"]

    conn = star_db.get_star_db_connection()
    try:
        if period == "daily":
            sel = "campaign_id, workflow_id, " + ", ".join(num_cols + first_cols)
            q = f'SELECT {sel} FROM "{schema}"."campaign_segment_overall" WHERE base_date BETWEEN %s AND %s'
            cur = conn.cursor()
            cur.execute(q, (start, end))
            rows = cur.fetchall()
            cur.close()
            result = []
            for r in rows:
                seg = _one_campaign_segment_row(r, num_cols, first_cols, age_cols, gender_cols)
                result.append(seg)
            return result
        # weekly/monthly: 1) GROUP BY SUM  2) DISTINCT ON first_*  3) merge
        sel_sum = "campaign_id, workflow_id, " + ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in num_cols)
        q1 = f'SELECT {sel_sum} FROM "{schema}"."campaign_segment_overall" WHERE base_date BETWEEN %s AND %s GROUP BY campaign_id, workflow_id'
        cur = conn.cursor()
        cur.execute(q1, (start, end))
        sum_rows = {(r["campaign_id"], r["workflow_id"]): dict(r) for r in cur.fetchall()}

        q2 = f'''SELECT DISTINCT ON (campaign_id, workflow_id) campaign_id, workflow_id, {", ".join(first_cols)}
FROM "{schema}"."campaign_segment_overall" WHERE base_date BETWEEN %s AND %s
ORDER BY campaign_id, workflow_id, base_date DESC'''
        cur.execute(q2, (start, end))
        first_rows = cur.fetchall()
        cur.close()

        for r in first_rows:
            key = (r["campaign_id"], r["workflow_id"])
            if key in sum_rows:
                for k in first_cols:
                    sum_rows[key][k] = r.get(k)

        result = [_one_campaign_segment_row(base, num_cols, first_cols, age_cols, gender_cols) for base in sum_rows.values()]
        # 주간/월간 시 기간 기준일 표시용 (당일 외 자료 구분)
        period_start = start.isoformat() if hasattr(start, "isoformat") else str(start)
        for seg in result:
            seg["base_date"] = period_start
        return result
    finally:
        conn.close()


# 10.
def _one_campaign_segment_row(r: dict, num_cols: list, first_cols: list, age_cols: list, gender_cols: list) -> dict:
    seg = {"campaign_id": r.get("campaign_id"), "workflow_id": r.get("workflow_id")}
    for c in num_cols:
        seg[c] = r.get(c, 0) or 0
    seg["age_distribution"] = _build_distribution(r, age_cols, "range")
    seg["gender_distribution"] = _build_distribution(r, gender_cols, "label")
    for fc in ["first_order_age_range", "first_coupon_use_age_range"]:
        val = r.get(fc)
        seg[fc] = mappings.AGE_RANGE_MAP.get(mappings.normalize_age_range_value(val), val) if val else None
    for fc in ["first_order_gender", "first_coupon_use_gender"]:
        val = r.get(fc)
        seg[fc] = mappings.GENDER_MAP.get(val, val) if val else None
    return seg


# 11.
def get_store_order_analyze(target_date: str, period: str = "daily") -> dict:
    """S6: 매장 주문. daily=전체 기간; weekly/monthly=기간 마지막 일자 1행만. st_code→st_name product_master, first_total_sales_cnt_* 매핑."""
    global _product_master_cache
    schema = star_db.get_star_schema()
    date_range = _calc_date_range(target_date, period)
    start, end = date_range[0], date_range[1]

    if period != "daily":
        start = end

    master_list = get_product_master()
    master_map = {m["st_code"]: m["st_name"] for m in master_list if m.get("st_code")}

    # 컬럼: first_order_cnt_store, first_coupon_use_store, first_age_range_10_store ... first_age_range_over_70_food, first_total_sales_cnt_store, first_total_sales_cnt_age_range, first_total_sales_cnt_gender, total_sales_cnt
    age_suffixes = ["10", "20", "30", "40", "50", "60", "over_70"]
    st_code_cols = (
        ["first_order_cnt_store", "first_coupon_use_store", "first_total_sales_cnt_store"]
        + [f"first_age_range_{s}_store" for s in age_suffixes]
        + [f"first_age_range_{s}_bev" for s in age_suffixes]
        + [f"first_age_range_{s}_food" for s in age_suffixes]
    )
    sel = "base_date, total_sales_cnt, first_total_sales_cnt_age_range, first_total_sales_cnt_gender, " + ", ".join(st_code_cols)
    q = f'SELECT {sel} FROM "{schema}"."store_order_analyze_overall" WHERE base_date BETWEEN %s AND %s ORDER BY base_date DESC'

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, (start, end))
        row = cur.fetchone()
        cur.close()
        if not row:
            store_ranking = {
                "store": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": None, "st_name": None} for s in age_suffixes],
                "beverage": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": None, "st_name": None} for s in age_suffixes],
                "food": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": None, "st_name": None} for s in age_suffixes],
            }
            first_total_sales = {"store": None, "coupon_use_store": None, "age_range": None, "gender": None}
            return {
                "store_ranking": store_ranking,
                "first_total_sales": first_total_sales,
                "total_sales_cnt": 0,
                "period": period,
                "date_range_actual": date_range,
            }

        def resolve_st_name(val):
            return master_map.get(val, val) if val else val

        store_ranking = {
            "store": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": row.get(f"first_age_range_{s}_store"), "st_name": resolve_st_name(row.get(f"first_age_range_{s}_store"))} for s in age_suffixes],
            "beverage": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": row.get(f"first_age_range_{s}_bev"), "st_name": resolve_st_name(row.get(f"first_age_range_{s}_bev"))} for s in age_suffixes],
            "food": [{"age_range": mappings.AGE_RANGE_MAP[s], "st_code": row.get(f"first_age_range_{s}_food"), "st_name": resolve_st_name(row.get(f"first_age_range_{s}_food"))} for s in age_suffixes],
        }
        ar_val = row.get("first_total_sales_cnt_age_range")
        g_val = row.get("first_total_sales_cnt_gender")
        first_total_sales = {
            "store": {"st_code": row.get("first_total_sales_cnt_store"), "st_name": resolve_st_name(row.get("first_total_sales_cnt_store"))},
            "coupon_use_store": {"st_code": row.get("first_coupon_use_store"), "st_name": resolve_st_name(row.get("first_coupon_use_store"))},
            "age_range": mappings.AGE_RANGE_MAP.get(mappings.normalize_age_range_value(ar_val), ar_val) if ar_val else None,
            "gender": mappings.GENDER_MAP.get(g_val, g_val) if g_val else None,
        }
        return {
            "store_ranking": store_ranking,
            "first_total_sales": first_total_sales,
            "total_sales_cnt": row.get("total_sales_cnt") or 0,
            "period": period,
            "date_range_actual": date_range,
        }
    finally:
        conn.close()


# 12.
def get_trend_data(
    table_name: str,
    metric_columns: list[str],
    end_date: str,
    days: int = 30,
    period: str = "daily",
    count: int = 12,
) -> list[dict]:
    """S7: 추이. table_name·metric_columns 화이트리스트. daily=days, weekly/monthly=count. 반환 rows만."""
    if table_name not in ALLOWED_TABLES:
        raise ValueError(f"허용되지 않은 테이블: {table_name}")
    if table_name not in ALLOWED_METRICS:
        raise ValueError(f"허용되지 않은 테이블: {table_name}")
    allowed = ALLOWED_METRICS[table_name]
    metrics = [m.strip() for m in metric_columns if m and m.strip() in allowed]
    if not metrics:
        raise ValueError("허용된 메트릭이 없습니다.")

    schema = star_db.get_star_schema()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

    if period == "monthly":
        start_dt = end_dt.replace(day=1)
        for _ in range(count - 1):
            start_dt = (start_dt.replace(day=1) - timedelta(days=1)).replace(day=1)
        date_expr = "date_trunc('month', base_date)::date"
        group_expr = "date_trunc('month', base_date)"
    elif period == "weekly":
        end_week_monday = end_dt - timedelta(days=end_dt.weekday())
        start_dt = end_week_monday - timedelta(weeks=count - 1)
        date_expr = "date_trunc('week', base_date)::date"
        group_expr = "date_trunc('week', base_date)"
    else:
        start_dt = end_dt - timedelta(days=days - 1)
        date_expr = "base_date"
        group_expr = "base_date"

    sel = f"{date_expr} AS base_date, " + ", ".join(f"COALESCE(SUM({m}), 0)::bigint AS {m}" for m in metrics)
    q = f'SELECT {sel} FROM "{schema}"."{table_name}" WHERE base_date >= %s AND base_date <= %s GROUP BY {group_expr} ORDER BY {group_expr} ASC'
    params = (start_dt.isoformat(), end_dt.isoformat())

    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q, params)
        rows = cur.fetchall()
        cur.close()
        out = []
        for r in rows:
            row = dict(r)
            if hasattr(row.get("base_date"), "isoformat"):
                row["base_date"] = row["base_date"].isoformat()
            out.append(row)
        return out
    finally:
        conn.close()


# 13.
def get_product_master() -> list[dict]:
    """S8: star_product_master 조회. id, category, category_label, st_code, st_name. 모듈 캐시(TTL 1시간) 허용."""
    global _product_master_cache, _product_master_cache_time
    now = time.time()
    if _product_master_cache is not None and (now - _product_master_cache_time) < _PRODUCT_MASTER_TTL:
        return _product_master_cache

    schema = star_db.get_star_schema()
    q = f'SELECT id, category, st_code, st_name FROM "{schema}"."star_product_master"'
    conn = star_db.get_star_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(q)
        rows = cur.fetchall()
        cur.close()
        result = []
        for r in rows:
            cat = r.get("category")
            result.append({
                "id": r.get("id"),
                "category": cat,
                "category_label": mappings.STORE_CATEGORY_MAP.get(cat, cat) if cat else None,
                "st_code": r.get("st_code"),
                "st_name": r.get("st_name"),
            })
        _product_master_cache = result
        _product_master_cache_time = now
        return result
    finally:
        conn.close()
