"""
Backend.core.dashboard_service (대시보드 비즈니스 로직)
======================================================
캠페인/일자/워크플로우/채널별 GROUP BY 집계·KPI·필터 옵션·차트 데이터 조회. legacy_dashboard·new_dash_server·campaign_dash_server에서 공통 호출.

[Main Functions]
===========
1. get_required_columns: DASHBOARD_REQUIRED_COLUMNS 기반 필수 컬럼 목록 (API·안내용)
2. get_aggregatable_tables: 필수 컬럼·타입 만족 테이블만 반환 (대시보드 셀렉트용)
3. _full_table_name: table_id → schema.table
4. _build_group_by_clause: group_by 설정 → GROUP BY 절
5. _build_where_clause: campaign/workflow/channel 필터 → WHERE 절
6. _row_to_aggregated: raw 행 → 집계 행 포맷
7. get_dashboard_data: 필터·group_by 기준 집계 데이터·KPI 반환
8. _calculate_kpi: KPI 집계 (성공률 등)
9. _build_filter_linked_where: 캠페인·워크플로우·채널 필터 조건·파라미터
10. get_filter_options: 캠페인·워크플로우·채널 목록 (테이블·필터 조건 기반)
11. get_chart_data: 단일 dimension·metric 집계 (차트 전용)

[Package Usage]
===========
1. get_required_columns: Backend/legacy_dashboard_server
2. get_aggregatable_tables: Backend/legacy_dashboard_server, Backend/new_dash_server, Backend/campaign_dash_server
3. _full_table_name: (모듈 내부 전용)
4. _build_group_by_clause: (모듈 내부 전용)
5. _build_where_clause: (모듈 내부 전용)
6. _row_to_aggregated: (모듈 내부 전용)
7. get_dashboard_data: Backend/legacy_dashboard_server, Backend/new_dash_server, Backend/campaign_dash_server
8. _calculate_kpi: (모듈 내부 전용)
9. _build_filter_linked_where: (모듈 내부 전용)
10. get_filter_options: Backend/legacy_dashboard_server
11. get_chart_data: Backend/legacy_dashboard_server, Backend/new_dash_server, Backend/campaign_dash_server

[Dependencies]
=========
- Backend.core.db (get_db_connection, get_db_connection_dash, get_table_schema, get_dash_table_schema, get_table_columns_with_types, validate_table_name, validate_dashboard_data_table_name, is_new_dash_physical_table 등)
- psycopg2
"""

import psycopg2

from Backend.core import db

# 대시보드 집계에 필요한 컬럼·허용 타입 (모두 있어야 셀렉트에 노출·조회 가능). (컬럼명, 허용 data_type 목록)
# data_type 은 PostgreSQL information_schema.columns.data_type 값(소문자 비교).
DASHBOARD_REQUIRED_COLUMNS = [
    ("delivery_date", ["date", "timestamp without time zone", "timestamp with time zone"]),
    ("campaign_id", ["bigint", "integer", "smallint"]),
    ("campaign_label", ["character varying", "text", "varchar"]),
    ("workflow_id", ["bigint", "integer", "smallint"]),
    ("workflow_label", ["character varying", "text", "varchar"]),
    ("delivery_channel", ["smallint", "integer", "bigint"]),
    ("total_count", ["bigint", "integer", "smallint"]),
    ("success_count", ["bigint", "integer", "smallint"]),
    ("failed_count", ["bigint", "integer", "smallint"]),
    ("open_count", ["bigint", "integer", "smallint"]),
    ("click_count", ["bigint", "integer", "smallint"]),
]

# 채널 코드 → 이름 매핑 (대시보드 전용)
CHANNEL_MAPPING = {
    0: "Email",
    1: "SMS",
    41: "iOS",
    42: "Android",
    121: "Kakao",
}


# 1.
def get_required_columns():
    """대시보드 조회를 위해 테이블에 필요한 컬럼·타입 목록 반환 (API·안내용). [{ name, allowed_types }, ...]"""
    return [
        {"name": name, "allowed_types": list(allowed_types)}
        for name, allowed_types in DASHBOARD_REQUIRED_COLUMNS
    ]


# 2.
def get_aggregatable_tables():
    """allowed_tables 중 필수 컬럼을 모두 가지고, 각 컬럼 타입이 허용 타입인 테이블만 반환 (대시보드 셀렉트용). ibank_1 계열도 dash_db에서 체크."""
    allowed = db.get_allowed_tables()
    # 뉴 대시보드 물리 테이블(ibank_1)도 체크 대상에 추가 (allowed_tables에 없어도 dash_db에서 조회)
    dash_candidates = ["ibank_1", "ibank_1_star_1"]
    all_candidates = sorted(set(allowed) | set(dash_candidates))
    required_count = len(DASHBOARD_REQUIRED_COLUMNS)
    result = []
    for table_name in all_candidates:
        try:
            rows = db.get_table_columns_with_types(table_name)
            col_map = {}
            for r in rows:
                cname = (r.get("column_name") or "").strip().lower()
                dtype = (r.get("data_type") or "").strip().lower()
                if cname:
                    col_map[cname] = dtype
            if len(col_map) < required_count:
                continue
            ok = True
            for name, allowed_types in DASHBOARD_REQUIRED_COLUMNS:
                key = name.lower()
                if key not in col_map:
                    ok = False
                    break
                actual = col_map[key]
                allowed_lower = [t.lower() for t in allowed_types]
                if actual not in allowed_lower:
                    ok = False
                    break
            if ok:
                result.append(table_name)
        except Exception:
            continue
    return result


# 3.
def _full_table_name(table_id):
    """검증된 테이블 ID로 스키마.테이블명 반환. ibank_1 계열은 dash_db 사용."""
    if db.is_new_dash_physical_table(table_id):
        table_name = db.validate_dashboard_data_table_name(table_id)
        schema = db.get_dash_table_schema()
    else:
        table_name = db.validate_table_name(table_id)
        schema = db.get_table_schema()
    return f'"{schema}"."{table_name}"'


# 4.
def _build_group_by_clause(group_by):
    """
    GROUP BY 절용 SELECT·GROUP BY 컬럼 생성.
    group_by: { campaign, date, workflow, channel } bool dict
    returns: (select_clause, group_by_clause)
    """
    select_parts = []
    group_parts = []
    if group_by.get("campaign"):
        select_parts.extend(["campaign_id", "campaign_label"])
        group_parts.extend(["campaign_id", "campaign_label"])
    if group_by.get("date"):
        select_parts.append("delivery_date")
        group_parts.append("delivery_date")
    if group_by.get("workflow"):
        select_parts.extend(["workflow_id", "workflow_label"])
        group_parts.extend(["workflow_id", "workflow_label"])
    if group_by.get("channel"):
        select_parts.append("delivery_channel")
        group_parts.append("delivery_channel")
    select_clause = ", ".join(select_parts) if select_parts else "'ALL' as group_key"
    group_by_clause = ", ".join(group_parts) if group_parts else ""
    return select_clause, group_by_clause


# 5.
def _build_where_clause(req):
    """
    WHERE 절 및 파라미터 리스트 생성.
    req: table_id, date_range [from, to], campaign_ids?, workflow_ids?, channels?
    returns: (where_sql, params)
    """
    conditions = ["delivery_date BETWEEN %s AND %s"]
    params = [req["date_range"][0], req["date_range"][1]]
    if req.get("campaign_ids"):
        conditions.append("campaign_id = ANY(%s)")
        params.append(req["campaign_ids"])
    if req.get("workflow_ids"):
        conditions.append("workflow_id = ANY(%s)")
        params.append(req["workflow_ids"])
    if req.get("channels"):
        conditions.append("delivery_channel = ANY(%s)")
        params.append(req["channels"])
    return " AND ".join(conditions), params


# 6.
def _row_to_aggregated(row):
    """DB 행을 집계 행 dict로 변환."""
    return {
        "campaign_id": row.get("campaign_id"),
        "campaign_label": row.get("campaign_label"),
        "delivery_date": str(row["delivery_date"]) if row.get("delivery_date") is not None else None,
        "workflow_id": row.get("workflow_id"),
        "workflow_label": row.get("workflow_label"),
        "channel_code": row.get("delivery_channel"),
        "channel_name": CHANNEL_MAPPING.get(row["delivery_channel"]) if row.get("delivery_channel") is not None else None,
        "total_count": row.get("total_count") or 0,
        "success_count": row.get("success_count") or 0,
        "failed_count": row.get("failed_count") or 0,
        "open_count": row.get("open_count") or 0,
        "click_count": row.get("click_count") or 0,
        "success_rate": round(float(row.get("success_rate") or 0), 2),
        "open_rate": round(float(row.get("open_rate") or 0), 2),
        "click_rate": round(float(row.get("click_rate") or 0), 2),
    }


# 7.
def get_dashboard_data(req):
    """
    대시보드 집계 데이터·KPI 조회.
    req: table_id, date_range [from, to], campaign_ids?, workflow_ids?, channels?, group_by { campaign, date, workflow, channel }
    returns: { kpi, aggregated_data, filter_applied }
    """
    table = _full_table_name(req["table_id"])
    where_sql, params = _build_where_clause(req)
    select_cols, group_by_sql = _build_group_by_clause(req.get("group_by") or {})
    group_by_clause = f"GROUP BY {group_by_sql}" if group_by_sql else ""

    # 기준별 발송현황 차트 상위 N건: 발송성공 수(success_count) 기준으로 통일
    order_parts = ["success_count DESC"]
    if req.get("group_by", {}).get("date"):
        order_parts.append("delivery_date DESC")
    order_sql = "ORDER BY " + ", ".join(order_parts)

    query = f"""
        SELECT
            {select_cols},
            COALESCE(SUM(total_count), 0)::bigint AS total_count,
            COALESCE(SUM(success_count), 0)::bigint AS success_count,
            COALESCE(SUM(failed_count), 0)::bigint AS failed_count,
            COALESCE(SUM(open_count), 0)::bigint AS open_count,
            COALESCE(SUM(click_count), 0)::bigint AS click_count,
            ROUND(SUM(success_count)::numeric / NULLIF(SUM(total_count), 0) * 100, 2) AS success_rate,
            ROUND(SUM(open_count)::numeric / NULLIF(SUM(success_count), 0) * 100, 2) AS open_rate,
            ROUND(SUM(click_count)::numeric / NULLIF(SUM(open_count), 0) * 100, 2) AS click_rate
        FROM {table}
        WHERE {where_sql}
        {group_by_clause}
        {order_sql}
    """
    conn = db.get_db_connection_dash() if db.is_new_dash_physical_table(req["table_id"]) else db.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        rows = cur.fetchall()
        aggregated_data = [_row_to_aggregated(dict(r)) for r in rows]
        kpi = _calculate_kpi(cur, table, where_sql, params, req)
        return {
            "kpi": kpi,
            "aggregated_data": aggregated_data,
            "filter_applied": req,
        }
    finally:
        cur.close()
        conn.close()


# 8.
def _calculate_kpi(cur, full_table, where_sql, params, req):
    """KPI 및 채널별 분포 계산."""
    kpi_query = f"""
        SELECT
            COUNT(DISTINCT campaign_id) AS campaign_count,
            COUNT(DISTINCT workflow_id) AS workflow_count,
            COUNT(DISTINCT delivery_channel) AS channel_count,
            COALESCE(SUM(total_count), 0)::bigint AS total_send,
            COALESCE(SUM(success_count), 0)::bigint AS total_success,
            COALESCE(SUM(failed_count), 0)::bigint AS total_failed,
            COALESCE(SUM(open_count), 0)::bigint AS total_open,
            COALESCE(SUM(click_count), 0)::bigint AS total_click
        FROM {full_table}
        WHERE {where_sql}
    """
    cur.execute(kpi_query, params)
    row = cur.fetchone()
    total_send = int(row["total_send"] or 0)
    total_success = int(row["total_success"] or 0)

    ch_query = f"""
        SELECT delivery_channel,
               COALESCE(SUM(total_count), 0)::bigint AS total_count,
               COALESCE(SUM(success_count), 0)::bigint AS success_count,
               COALESCE(SUM(open_count), 0)::bigint AS open_count,
               COALESCE(SUM(click_count), 0)::bigint AS click_count
        FROM {full_table}
        WHERE {where_sql}
        GROUP BY delivery_channel
        ORDER BY total_count DESC
    """
    cur.execute(ch_query, params)
    ch_rows = cur.fetchall()
    total_failed = int(row["total_failed"] or 0)
    total_open = int(row["total_open"] or 0)
    total_click = int(row["total_click"] or 0)
    send_dist = []
    success_dist = []
    open_dist = []
    click_dist = []
    for r in ch_rows:
        code = r["delivery_channel"]
        name = CHANNEL_MAPPING.get(code, "Unknown")
        send_dist.append({
            "channel": name,
            "channel_code": code,
            "value": r["total_count"] or 0,
            "percentage": round((r["total_count"] or 0) / total_send * 100, 2) if total_send else 0,
        })
        success_dist.append({
            "channel": name,
            "channel_code": code,
            "value": r["success_count"] or 0,
            "percentage": round((r["success_count"] or 0) / total_success * 100, 2) if total_success else 0,
        })
        open_dist.append({
            "channel": name,
            "channel_code": code,
            "value": r["open_count"] or 0,
            "percentage": round((r["open_count"] or 0) / total_open * 100, 2) if total_open else 0,
        })
        click_dist.append({
            "channel": name,
            "channel_code": code,
            "value": r["click_count"] or 0,
            "percentage": round((r["click_count"] or 0) / total_click * 100, 2) if total_click else 0,
        })
    success_rate = round(float(total_success) / total_send * 100, 2) if total_send else 0.0
    failed_rate = round(float(total_failed) / total_send * 100, 2) if total_send else 0.0
    open_rate = round(float(total_open) / total_success * 100, 2) if total_success else 0.0
    click_rate = round(float(total_click) / total_open * 100, 2) if total_open else 0.0
    return {
        "campaign_count": int(row["campaign_count"] or 0),
        "workflow_count": int(row["workflow_count"] or 0),
        "channel_count": int(row["channel_count"] or 0),
        "total_send": total_send,
        "total_success": total_success,
        "total_failed": total_failed,
        "total_open": total_open,
        "total_click": total_click,
        "success_rate": success_rate,
        "failed_rate": failed_rate,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "send_change_pct": None,
        "success_change_pct": None,
        "channel_distribution": {
            "send": send_dist,
            "success": success_dist,
            "open": open_dist,
            "click": click_dist,
        },
    }


# 9.
def _build_filter_linked_where(campaign_ids=None, workflow_ids=None, channels=None, for_campaigns=False, for_workflows=False, for_channels=False):
    """연동 필터: 캠페인 목록은 워크플로우·채널 기준, 워크플로우는 캠페인·채널 기준, 채널은 캠페인·워크플로우 기준."""
    conditions = []
    params = []
    if for_campaigns:
        if workflow_ids:
            conditions.append("workflow_id = ANY(%s)")
            params.append(workflow_ids)
        if channels:
            conditions.append("delivery_channel = ANY(%s)")
            params.append(channels)
    elif for_workflows:
        if campaign_ids:
            conditions.append("campaign_id = ANY(%s)")
            params.append(campaign_ids)
        if channels:
            conditions.append("delivery_channel = ANY(%s)")
            params.append(channels)
    elif for_channels:
        if campaign_ids:
            conditions.append("campaign_id = ANY(%s)")
            params.append(campaign_ids)
        if workflow_ids:
            conditions.append("workflow_id = ANY(%s)")
            params.append(workflow_ids)
    return (" AND ".join(conditions) if conditions else "1=1", params)


# 10.
def get_filter_options(table_id, campaign_ids=None, workflow_ids=None, channels=None):
    """
    대시보드 필터 옵션(캠페인·워크플로우·채널 목록) 조회.
    선택된 다른 컬럼이 있으면 해당 조건에 맞는 옵션만 반환(연동 필터).
    예: 캠페인 C001 선택 시 워크플로우는 C001에 존재하는 것만 반환.
    returns: { campaigns, workflows, channels }
    """
    table = _full_table_name(table_id)
    conn = db.get_db_connection_dash() if db.is_new_dash_physical_table(table_id) else db.get_db_connection()
    cur = conn.cursor()
    try:
        campaigns = []
        where_c, params_c = _build_filter_linked_where(campaign_ids, workflow_ids, channels, for_campaigns=True)
        try:
            cur.execute(
                f"SELECT DISTINCT campaign_id, campaign_label FROM {table} WHERE {where_c} ORDER BY campaign_label",
                params_c,
            )
            campaigns = [{"id": r["campaign_id"], "label": r["campaign_label"] or str(r["campaign_id"])} for r in cur.fetchall()]
        except psycopg2.Error:
            pass
        workflows = []
        where_w, params_w = _build_filter_linked_where(campaign_ids, workflow_ids, channels, for_workflows=True)
        try:
            cur.execute(
                f"SELECT DISTINCT workflow_id, workflow_label FROM {table} WHERE {where_w} ORDER BY workflow_label",
                params_w,
            )
            workflows = [{"id": r["workflow_id"], "label": r["workflow_label"] or str(r["workflow_id"])} for r in cur.fetchall()]
        except psycopg2.Error:
            pass
        channel_list = []
        where_ch, params_ch = _build_filter_linked_where(campaign_ids, workflow_ids, channels, for_channels=True)
        try:
            cur.execute(
                f"SELECT DISTINCT delivery_channel FROM {table} WHERE {where_ch} ORDER BY delivery_channel",
                params_ch,
            )
            channel_list = [{"code": r["delivery_channel"], "name": CHANNEL_MAPPING.get(r["delivery_channel"], "Unknown")} for r in cur.fetchall()]
        except psycopg2.Error:
            pass
        return {"campaigns": campaigns, "workflows": workflows, "channels": channel_list}
    finally:
        cur.close()
        conn.close()


# 차트 생성용 단일 디멘션·메트릭 조회 (Adobe/GA 방식: 디멘션별·메트릭별 전용 요청으로 가독성 확보)
CHART_DIMENSION_KEYS = ("delivery_date", "campaign_label", "workflow_label", "channel_name")
CHART_METRIC_KEYS = (
    "total_count", "success_count", "failed_count", "open_count", "click_count",
    "success_rate", "open_rate", "click_rate",
)


# 11.
def get_chart_data(req):
    """
    차트 생성 전용 데이터: 단일 디멘션·단일 메트릭으로 집계해 반환.
    - date_range: 항상 [시작일, 종료일] 구간 전체를 WHERE로 사용. 마지막 일자만 쓰는 것이 아님.
    - dimension=delivery_date: X축 일자별, 기간 내 각 일자별 집계.
    - dimension=campaign_label/workflow_label/channel_name: 기간 전체에 대해 해당 축으로만 GROUP BY,
      차트는 데이터 신뢰성을 위해 LIMIT 없이 전건 반환. campaign_ids 등 필터가 걸려 있으면 그 조건에 맞는 행만 집계됨.
    req: table_id, date_range, campaign_ids?, workflow_ids?, channels?, dimension, metric
    returns: { rows: [ { name, value, delivery_date? }, ... ] }
    """
    table = _full_table_name(req["table_id"])
    where_sql, params = _build_where_clause(req)
    dimension = (req.get("dimension") or "delivery_date").strip()
    metric = (req.get("metric") or "success_count").strip()

    if dimension not in CHART_DIMENSION_KEYS:
        dimension = "delivery_date"
    if metric not in CHART_METRIC_KEYS:
        metric = "success_count"

    # 디멘션별 GROUP BY / SELECT (dimension은 CHART_DIMENSION_KEYS 화이트리스트 검증 완료)
    if dimension == "delivery_date":
        group_cols = '"delivery_date"'
        select_dim = '"delivery_date"::text AS name'
    elif dimension == "campaign_label":
        group_cols = '"campaign_id", "campaign_label"'
        select_dim = 'COALESCE("campaign_label", "campaign_id"::text) AS name'
    elif dimension == "workflow_label":
        group_cols = '"workflow_id", "workflow_label"'
        select_dim = 'COALESCE("workflow_label", "workflow_id"::text) AS name'
    else:  # channel_name
        group_cols = '"delivery_channel"'
        select_dim = '"delivery_channel"::text AS name'

    # 메트릭 표현식 (metric은 CHART_METRIC_KEYS 화이트리스트 검증 완료)
    if metric in ("success_rate", "open_rate", "click_rate"):
        if metric == "success_rate":
            metric_expr = "ROUND(SUM(success_count)::numeric / NULLIF(SUM(total_count), 0) * 100, 2)"
        elif metric == "open_rate":
            metric_expr = "ROUND(SUM(open_count)::numeric / NULLIF(SUM(success_count), 0) * 100, 2)"
        else:
            metric_expr = "ROUND(SUM(click_count)::numeric / NULLIF(SUM(open_count), 0) * 100, 2)"
    else:
        metric_expr = f'COALESCE(SUM("{metric}"), 0)::bigint'

    if dimension == "delivery_date":
        order_sql = 'ORDER BY "delivery_date" ASC'
    else:
        order_sql = "ORDER BY value DESC"

    query = f"""
        SELECT {select_dim},
               {metric_expr} AS value
        FROM {table}
        WHERE {where_sql}
        GROUP BY {group_cols}
        {order_sql}
    """
    conn = db.get_db_connection_dash() if db.is_new_dash_physical_table(req["table_id"]) else db.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        rows = cur.fetchall()
        result = []
        for r in rows:
            row = {"name": (r.get("name") or "-"), "value": r.get("value")}
            if dimension == "delivery_date" and r.get("name"):
                row["delivery_date"] = r.get("name")
            if dimension == "channel_name" and r.get("name"):
                try:
                    ch_code = int(r.get("name"))
                    row["name"] = CHANNEL_MAPPING.get(ch_code, str(ch_code))
                except (TypeError, ValueError):
                    pass
                row["channel_code"] = r.get("name")
            result.append(row)
        return {"rows": result}
    finally:
        cur.close()
        conn.close()
