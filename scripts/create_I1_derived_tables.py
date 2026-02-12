"""
I1_ 파생 테이블 생성 (기존 15개 + test_coupons_data 기반 8개 = 23개).
원천: campaigns, test_coupons_data, test_deliveries_data, test_delivery_tracking, workflows
실행: python scripts/create_I1_derived_tables.py
옵션: --drop 기입 시 기존 I1_ 테이블 DROP 후 생성.
"""
import argparse
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Backend.api_server import db


def run_sql(conn, sql, comment=""):
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        if comment:
            print("  OK:", comment)
    except Exception as e:
        conn.rollback()
        print("  FAIL:", comment or sql[:60], "-", e)
    finally:
        cur.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drop", action="store_true", help="기존 I1_ 테이블 DROP 후 생성")
    args = ap.parse_args()
    schema = db.get_table_schema()
    conn = db.get_db_connection()
    try:
        # 스키마.테이블명 포맷. PostgreSQL은 따옴표 없는 식별자를 소문자로 저장하므로,
        # I1_ 테이블은 소문자로 생성해 앱/쿼리에서 따옴표 없이 참조 가능하게 함.
        def tbl(name):
            return f'"{schema}"."{name}"'

        def tbl_lower(name):
            """생성할 I1_ 테이블용: 소문자로 저장 (unquoted)"""
            return f'"{schema}".{name.lower()}'

        I1_NAMES = [
            "I1_campaign_workflow_list", "I1_delivery_tracking_joined", "I1_daily_delivery_count",
            "I1_campaign_delivery_count", "I1_workflow_delivery_count", "I1_channel_delivery_count",
            "I1_daily_campaign_delivery", "I1_daily_workflow_delivery", "I1_tracking_by_type",
            "I1_campaign_daily_channel", "I1_delivery_status_summary", "I1_workflow_list_per_campaign",
            "I1_recent_deliveries", "I1_delivery_with_campaign_workflow", "I1_tracking_daily_count",
            # test_coupons_data 기반 8개
            "I1_campaign_coupon_count", "I1_workflow_coupon_count", "I1_daily_coupon_count",
            "I1_daily_campaign_coupon", "I1_daily_workflow_coupon", "I1_coupon_with_campaign_workflow",
            "I1_recent_coupons", "I1_campaign_workflow_coupon_count",
        ]

        if args.drop:
            for name in I1_NAMES:
                run_sql(conn, f'DROP TABLE IF EXISTS {tbl(name)} CASCADE', f"DROP {name}")
                run_sql(conn, f'DROP TABLE IF EXISTS {tbl_lower(name)} CASCADE', f"DROP {name.lower()}")

        print("Creating I1_ derived tables...")

        # 1. I1_campaign_workflow_list
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_campaign_workflow_list")} AS
        SELECT c.id AS campaign_id, c.campaign_internal_name, c.campaign_label,
               w.id AS workflow_id, w.workflow_internal_name, w.workflow_label
        FROM {tbl("campaigns")} c
        JOIN {tbl("workflows")} w ON w.campaign_id = c.id
    """, "I1_campaign_workflow_list")

        # 2. I1_delivery_tracking_joined (delivery_id in tracking -> deliveries.id)
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_delivery_tracking_joined")} AS
        SELECT d.id AS delivery_pk, d.delivery_id, d.delivery_date, d.campaign_id, d.workflow_id, d.delivery_channel,
               t.id AS tracking_id, t.tracking_type, t.tracking_date, t.recipient_id AS tracking_recipient_id
        FROM {tbl("test_deliveries_data")} d
        LEFT JOIN {tbl("test_delivery_tracking")} t ON t.delivery_id = d.id
    """, "I1_delivery_tracking_joined")

        # 3. I1_daily_delivery_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_delivery_count")} AS
        SELECT (delivery_date::date) AS delivery_date, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        WHERE delivery_date IS NOT NULL
        GROUP BY (delivery_date::date)
        ORDER BY delivery_date
    """, "I1_daily_delivery_count")

        # 4. I1_campaign_delivery_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_campaign_delivery_count")} AS
        SELECT campaign_id, campaign_label, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        GROUP BY campaign_id, campaign_label
    """, "I1_campaign_delivery_count")

        # 5. I1_workflow_delivery_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_workflow_delivery_count")} AS
        SELECT workflow_id, workflow_label, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        GROUP BY workflow_id, workflow_label
    """, "I1_workflow_delivery_count")

        # 6. I1_channel_delivery_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_channel_delivery_count")} AS
        SELECT delivery_channel, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        GROUP BY delivery_channel
    """, "I1_channel_delivery_count")

        # 7. I1_daily_campaign_delivery
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_campaign_delivery")} AS
        SELECT (delivery_date::date) AS delivery_date, campaign_id, campaign_label, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        WHERE delivery_date IS NOT NULL
        GROUP BY (delivery_date::date), campaign_id, campaign_label
        ORDER BY delivery_date, campaign_id
    """, "I1_daily_campaign_delivery")

        # 8. I1_daily_workflow_delivery
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_workflow_delivery")} AS
        SELECT (delivery_date::date) AS delivery_date, workflow_id, workflow_label, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        WHERE delivery_date IS NOT NULL
        GROUP BY (delivery_date::date), workflow_id, workflow_label
        ORDER BY delivery_date, workflow_id
    """, "I1_daily_workflow_delivery")

        # 9. I1_tracking_by_type
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_tracking_by_type")} AS
        SELECT delivery_id, tracking_type, COUNT(*) AS cnt
        FROM {tbl("test_delivery_tracking")}
        GROUP BY delivery_id, tracking_type
    """, "I1_tracking_by_type")

        # 10. I1_campaign_daily_channel
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_campaign_daily_channel")} AS
        SELECT campaign_id, campaign_label, (delivery_date::date) AS delivery_date, delivery_channel, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        WHERE delivery_date IS NOT NULL
        GROUP BY campaign_id, campaign_label, (delivery_date::date), delivery_channel
        ORDER BY delivery_date, campaign_id, delivery_channel
    """, "I1_campaign_daily_channel")

        # 11. I1_delivery_status_summary
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_delivery_status_summary")} AS
        SELECT delivery_status, COUNT(*) AS cnt
        FROM {tbl("test_deliveries_data")}
        GROUP BY delivery_status
    """, "I1_delivery_status_summary")

        # 12. I1_workflow_list_per_campaign
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_workflow_list_per_campaign")} AS
        SELECT campaign_id, id AS workflow_id, workflow_internal_name, workflow_label
        FROM {tbl("workflows")}
    """, "I1_workflow_list_per_campaign")

        # 13. I1_recent_deliveries
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_recent_deliveries")} AS
        SELECT * FROM {tbl("test_deliveries_data")}
        ORDER BY delivery_date DESC NULLS LAST
        LIMIT 1000
    """, "I1_recent_deliveries")

        # 14. I1_delivery_with_campaign_workflow
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_delivery_with_campaign_workflow")} AS
        SELECT d.id AS delivery_id, d.delivery_date, d.delivery_channel, d.delivery_status,
               d.campaign_id, c.campaign_label AS campaign_label,
               d.workflow_id, w.workflow_label AS workflow_label
        FROM {tbl("test_deliveries_data")} d
        LEFT JOIN {tbl("campaigns")} c ON c.id = d.campaign_id
        LEFT JOIN {tbl("workflows")} w ON w.id = d.workflow_id
    """, "I1_delivery_with_campaign_workflow")

        # 15. I1_tracking_daily_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_tracking_daily_count")} AS
        SELECT (tracking_date::date) AS tracking_date, tracking_type, COUNT(*) AS cnt
        FROM {tbl("test_delivery_tracking")}
        WHERE tracking_date IS NOT NULL
        GROUP BY (tracking_date::date), tracking_type
        ORDER BY tracking_date, tracking_type
    """, "I1_tracking_daily_count")

        # --- test_coupons_data 기반 8개 ---
        # 16. I1_campaign_coupon_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_campaign_coupon_count")} AS
        SELECT campaign_id, campaign_label, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        GROUP BY campaign_id, campaign_label
    """, "I1_campaign_coupon_count")

        # 17. I1_workflow_coupon_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_workflow_coupon_count")} AS
        SELECT workflow_id, workflow_label, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        GROUP BY workflow_id, workflow_label
    """, "I1_workflow_coupon_count")

        # 18. I1_daily_coupon_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_coupon_count")} AS
        SELECT (coupon_date::date) AS coupon_date, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        WHERE coupon_date IS NOT NULL
        GROUP BY (coupon_date::date)
        ORDER BY coupon_date
    """, "I1_daily_coupon_count")

        # 19. I1_daily_campaign_coupon
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_campaign_coupon")} AS
        SELECT (coupon_date::date) AS coupon_date, campaign_id, campaign_label, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        WHERE coupon_date IS NOT NULL
        GROUP BY (coupon_date::date), campaign_id, campaign_label
        ORDER BY coupon_date, campaign_id
    """, "I1_daily_campaign_coupon")

        # 20. I1_daily_workflow_coupon
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_daily_workflow_coupon")} AS
        SELECT (coupon_date::date) AS coupon_date, workflow_id, workflow_label, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        WHERE coupon_date IS NOT NULL
        GROUP BY (coupon_date::date), workflow_id, workflow_label
        ORDER BY coupon_date, workflow_id
    """, "I1_daily_workflow_coupon")

        # 21. I1_coupon_with_campaign_workflow
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_coupon_with_campaign_workflow")} AS
        SELECT cp.id AS coupon_pk, cp.coupon_id, cp.coupon_date, cp.recipient_id,
               cp.campaign_id, c.campaign_label AS campaign_label,
               cp.workflow_id, w.workflow_label AS workflow_label
        FROM {tbl("test_coupons_data")} cp
        LEFT JOIN {tbl("campaigns")} c ON c.id = cp.campaign_id
        LEFT JOIN {tbl("workflows")} w ON w.id = cp.workflow_id
    """, "I1_coupon_with_campaign_workflow")

        # 22. I1_recent_coupons
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_recent_coupons")} AS
        SELECT * FROM {tbl("test_coupons_data")}
        ORDER BY coupon_date DESC NULLS LAST, created DESC NULLS LAST
        LIMIT 1000
    """, "I1_recent_coupons")

        # 23. I1_campaign_workflow_coupon_count
        run_sql(conn, f"""
        CREATE TABLE {tbl_lower("I1_campaign_workflow_coupon_count")} AS
        SELECT campaign_id, campaign_label, workflow_id, workflow_label, COUNT(*) AS cnt
        FROM {tbl("test_coupons_data")}
        GROUP BY campaign_id, campaign_label, workflow_id, workflow_label
    """, "I1_campaign_workflow_coupon_count")

    except Exception as e:
        print("Error:", e)
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass
    print("Done.")


if __name__ == "__main__":
    main()
