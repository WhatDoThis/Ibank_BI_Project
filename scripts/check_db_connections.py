"""
config.json 기반 DB 연결 검증 스크립트.
- backend (메인 DB) 연결
- backend.system_db (시스템 DB) 연결
실행: 프로젝트 루트에서 python scripts/check_db_connections.py
"""
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def main():
    print("1. Env config 로드 확인...")
    from Env import config
    backend = config.backend
    main = getattr(backend, "main_db", None)
    if main is not None:
        print(f"   backend.main_db.db_host = {getattr(main, 'db_host', 'N/A')}")
        print(f"   backend.main_db.db_name = {getattr(main, 'db_name', 'N/A')}")
    else:
        print("   backend.main_db = 없음 (필수 — Env/config/config.json 에 main_db 블록 추가)")
    sys_db = getattr(backend, 'system_db', None)
    if sys_db:
        print(f"   backend.system_db.db_host = {getattr(sys_db, 'db_host', 'N/A')}")
        print(f"   backend.system_db.db_name = {getattr(sys_db, 'db_name', 'N/A')}")
    else:
        print("   backend.system_db = 없음")
        return 1

    print("\n2. get_main_db_config() / get_system_db_config() 호출...")
    from Backend.core import db
    main_cfg = db.get_main_db_config()
    sys_cfg = db.get_system_db_config()
    print(f"   메인 DB: host={main_cfg['host']}, database={main_cfg['database']}, port={main_cfg['port']}")
    print(f"   시스템 DB: host={sys_cfg['host']}, database={sys_cfg['database']}, port={sys_cfg['port']}")

    print("\n3. 메인 DB 연결 및 SELECT 1...")
    conn_main = db.get_db_connection()
    cur = conn_main.cursor()
    cur.execute("SELECT 1 AS ok")
    row = cur.fetchone()
    cur.close()
    conn_main.close()
    print(f"   결과: {row}")

    print("\n4. 시스템 DB 연결 및 SELECT 1...")
    conn_sys = db.get_db_connection_system()
    cur = conn_sys.cursor()
    cur.execute("SELECT 1 AS ok")
    row = cur.fetchone()
    cur.close()
    conn_sys.close()
    print(f"   결과: {row}")

    print("\n5. 시스템 DB table_schema 확인...")
    schema = db.get_system_table_schema()
    print(f"   get_system_table_schema() = {schema!r}")

    print("\n[OK] 두 DB 연결 모두 정상.")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
