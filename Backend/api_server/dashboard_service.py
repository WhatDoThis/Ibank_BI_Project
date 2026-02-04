"""
Backend.api_server.dashboard_service (대시보드 비즈니스 로직)
=============================================================
캠페인/일자/워크플로우/채널별 GROUP BY 집계, KPI·필터 옵션 조회.
config.backend·db 모듈 사용. report 라우트와 분리된 대시보드 전용 로직.

[Main Functions]
===========
- get_dashboard_data: 필터·GROUP BY 기준으로 집계 데이터·KPI 반환
- get_filter_options: 캠페인·워크플로우·채널 목록 반환

[의존성]
=========
- Backend.api_server.db (get_db_connection, get_table_schema, validate_table_name)
- psycopg2
"""

import psycopg2

from Backend.api_server import db

# 채널 코드 → 이름 매핑 (대시보드 전용)
CHANNEL_MAPPING = {
    0: "Email",
    1: "SMS",
    41: "iOS",
    42: "Android",
    121: "Kakao",
}


def _full_table_name(table_id):
    """검증된 테이블 ID로 스키마.테이블명 반환."""
    table_name = db.validate_table_name(table_id)
    schema = db.get_table_schema()
    return f'"{schema}"."{table_name}"'


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
    conn = db.get_db_connection()
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


def _calculate_kpi(cur, full_table, where_sql, params, req):
    """KPI 및 채널별 분포 계산."""
    kpi_query = f"""
        SELECT
            COUNT(DISTINCT campaign_id) AS campaign_count,
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
    total_send = row["total_send"] or 0
    total_success = row["total_success"] or 0

    ch_query = f"""
        SELECT delivery_channel,
               COALESCE(SUM(total_count), 0)::bigint AS total_count,
               COALESCE(SUM(success_count), 0)::bigint AS success_count
        FROM {full_table}
        WHERE {where_sql}
        GROUP BY delivery_channel
        ORDER BY total_count DESC
    """
    cur.execute(ch_query, params)
    ch_rows = cur.fetchall()
    send_dist = []
    success_dist = []
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
    return {
        "campaign_count": row["campaign_count"] or 0,
        "total_send": total_send,
        "total_success": total_success,
        "total_failed": row["total_failed"] or 0,
        "total_open": row["total_open"] or 0,
        "total_click": row["total_click"] or 0,
        "send_change_pct": None,
        "success_change_pct": None,
        "channel_distribution": {
            "send": send_dist,
            "success": success_dist,
            "open": [],
            "click": [],
        },
    }


def _build_where_and_params(campaign_ids=None, workflow_ids=None, channels=None, for_campaigns=False, for_workflows=False, for_channels=False):
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


def get_filter_options(table_id, campaign_ids=None, workflow_ids=None, channels=None):
    """
    대시보드 필터 옵션(캠페인·워크플로우·채널 목록) 조회.
    선택된 다른 컬럼이 있으면 해당 조건에 맞는 옵션만 반환(연동 필터).
    예: 캠페인 C001 선택 시 워크플로우는 C001에 존재하는 것만 반환.
    returns: { campaigns, workflows, channels }
    """
    table = _full_table_name(table_id)
    conn = db.get_db_connection()
    cur = conn.cursor()
    try:
        campaigns = []
        where_c, params_c = _build_where_and_params(campaign_ids, workflow_ids, channels, for_campaigns=True)
        try:
            cur.execute(
                f"SELECT DISTINCT campaign_id, campaign_label FROM {table} WHERE {where_c} ORDER BY campaign_label",
                params_c,
            )
            campaigns = [{"id": r["campaign_id"], "label": r["campaign_label"] or str(r["campaign_id"])} for r in cur.fetchall()]
        except psycopg2.Error:
            pass
        workflows = []
        where_w, params_w = _build_where_and_params(campaign_ids, workflow_ids, channels, for_workflows=True)
        try:
            cur.execute(
                f"SELECT DISTINCT workflow_id, workflow_label FROM {table} WHERE {where_w} ORDER BY workflow_label",
                params_w,
            )
            workflows = [{"id": r["workflow_id"], "label": r["workflow_label"] or str(r["workflow_id"])} for r in cur.fetchall()]
        except psycopg2.Error:
            pass
        channel_list = []
        where_ch, params_ch = _build_where_and_params(campaign_ids, workflow_ids, channels, for_channels=True)
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
