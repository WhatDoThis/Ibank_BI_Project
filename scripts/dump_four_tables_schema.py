"""campaigns, test_deliveries_data, test_delivery_tracking, workflows 4테이블 컬럼 덤프. 실행: python scripts/dump_four_tables_schema.py"""
import sys
from pathlib import Path
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Backend.core import db

TABLES = ["campaigns", "test_deliveries_data", "test_delivery_tracking", "workflows"]

def main():
    schema = db.get_table_schema()
    conn = db.get_db_connection()
    cur = conn.cursor()
    try:
        for t in TABLES:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """, (schema, t))
            rows = cur.fetchall()
            cols = [f"{r['column_name']} ({r['data_type']})" for r in rows]
            print(f"\n{t}: {len(rows)} cols")
            print("  " + ", ".join(cols))
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
