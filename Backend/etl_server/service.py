"""
Backend.etl_server.service (ETL 메타 CRUD·시스템 DB)
====================================================
etl_connections, etl_tables 조회·등록. 시스템 DB(ibank_system_data) 전용.
Phase 3: DB 연결 등록·테스트·소스 테이블 목록.

[Main Functions]
===========
- get_or_create_file_connection: source_type='file' 연결 1개 조회 또는 생성
- create_connection: DB 연결 등록 (postgresql). 비밀번호는 encrypted_password에 저장(현재 평문, 추후 암호화)
- list_connections: 연결 목록 (비밀번호 제외)
- get_connection_for_etl: connection_id로 연결 정보 반환 (적재 시 사용, 비밀번호 포함)
- test_connection: connection_id 또는 인자로 연결 테스트 (SELECT 1)
- list_source_tables: 외부 DB의 테이블 목록 (information_schema)
- list_etl_tables, create_etl_table, get_etl_table, insert_job, update_job, update_etl_table_status
- update_last_synced_at: 증분 적재 후 last_synced_at 갱신
- Phase 6: set_job_running, list_jobs, get_job, fetch_pending_jobs, count_running_jobs. insert_job(..., "pending") 시 started_at NULL

[Dependencies]
=========
- Backend.api_server.db (get_db_connection_system, get_system_table_schema)
- psycopg2 (외부 DB 연결·테스트·소스 테이블 목록)
"""

import re
from typing import Any, Optional


def _get_db():
    """순환 import 방지: api_server.db를 사용 시점에 로드."""
    from Backend.api_server import db as api_db
    return api_db


def _schema():
    return _get_db().get_system_table_schema()


def _q(schema_name: str, table_name: str) -> str:
    """스키마.테이블명 따옴표 감싸기."""
    return f'"{schema_name}"."{table_name}"'


def _validate_identifier(value: str, name: str) -> str:
    """식별자(테이블명·컬럼명) 검증. 영문·숫자·언더스코어만."""
    if not value or not str(value).strip():
        raise ValueError(f"{name}이 비어 있습니다.")
    v = str(value).strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", v):
        raise ValueError(f"{name}에 허용되지 않은 문자가 있습니다: {v}")
    return v


def _connect_postgres(host: str, port: int, database: str, user: str, password: str):
    """외부 PostgreSQL 연결. psycopg2 connection 반환."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=database,
        user=user,
        password=password or "",
        cursor_factory=RealDictCursor,
    )
    conn.set_client_encoding("UTF8")
    return conn


def create_connection(
    connection_name: str,
    source_type: str,
    created_by: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> int:
    """DB 연결 1건 등록. 1차는 source_type='postgresql'만. 비밀번호는 encrypted_password에 저장(현재 평문)."""
    if not connection_name or not str(connection_name).strip():
        raise ValueError("connection_name이 비어 있습니다.")
    if source_type not in ("postgresql",):
        raise ValueError("지원 소스: postgresql")
    if not host or not database_name or not username:
        raise ValueError("host, database_name, username가 필요합니다.")
    port = port or 5432
    schema_name = (schema_name or "public").strip()
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_connections")}
            (connection_name, source_type, host, port, database_name, schema_name, username, encrypted_password, is_active, created_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, NOW())
            RETURNING connection_id
            """,
            (connection_name.strip(), source_type, host.strip(), int(port), database_name.strip(), schema_name, username.strip(), password or "", created_by),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["connection_id"])
    finally:
        cur.close()
        conn.close()


def list_connections() -> list:
    """연결 목록. 비밀번호(encrypted_password) 제외."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT connection_id, connection_name, source_type, host, port, database_name, schema_name, username,
                   is_active, created_by, created_at, updated_at
            FROM {_q(schema, "etl_connections")}
            ORDER BY created_at DESC
            """
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_connection_for_etl(connection_id: int) -> Optional[dict]:
    """connection_id로 연결 정보 반환. 적재 시 사용(비밀번호 포함)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT connection_id, connection_name, source_type, host, port, database_name, schema_name,
                   username, encrypted_password
            FROM {_q(schema, "etl_connections")}
            WHERE connection_id = %s AND is_active = TRUE
            """,
            (connection_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def test_connection(
    connection_id: Optional[int] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> dict:
    """
    연결 테스트. connection_id가 있으면 해당 연결로, 없으면 인자로 전달된 값으로 테스트.
    반환: { ok: bool, message: str }
    """
    if connection_id is not None:
        c = get_connection_for_etl(connection_id)
        if not c:
            return {"ok": False, "message": "연결을 찾을 수 없습니다."}
        host = c.get("host")
        port = c.get("port") or 5432
        database_name = c.get("database_name")
        username = c.get("username")
        password = c.get("encrypted_password") or ""
    if not host or not database_name or not username:
        return {"ok": False, "message": "host, database_name, username가 필요합니다."}
    try:
        conn = _connect_postgres(host, port or 5432, database_name, username, password or "")
        cur = conn.cursor()
        cur.execute("SELECT 1 AS ok")
        cur.fetchone()
        cur.close()
        conn.close()
        return {"ok": True, "message": "연결 성공"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def list_source_tables(connection_id: int) -> list:
    """외부 DB의 테이블 목록. information_schema.tables (table_schema, table_name)."""
    c = get_connection_for_etl(connection_id)
    if not c:
        raise ValueError("연결을 찾을 수 없습니다.")
    if c.get("source_type") != "postgresql":
        raise ValueError("현재 postgresql 연결만 소스 테이블 목록을 지원합니다.")
    conn = _connect_postgres(
        c["host"],
        c.get("port") or 5432,
        c["database_name"],
        c["username"],
        c.get("encrypted_password") or "",
    )
    cur = conn.cursor()
    try:
        schema = (c.get("schema_name") or "public").strip()
        cur.execute(
            """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (schema,),
        )
        return [{"table_schema": r["table_schema"], "table_name": r["table_name"]} for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_or_create_file_connection(created_by: str) -> int:
    """source_type='file' 연결 1개 반환. 없으면 생성 후 connection_id 반환."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f'SELECT connection_id FROM {_q(schema, "etl_connections")} WHERE source_type = %s AND is_active = TRUE LIMIT 1',
            ("file",),
        )
        row = cur.fetchone()
        if row:
            return int(row["connection_id"])
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_connections")}
            (connection_name, source_type, is_active, created_by, updated_at)
            VALUES (%s, %s, TRUE, %s, NOW())
            RETURNING connection_id
            """,
            ("파일 업로드", "file", created_by),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["connection_id"])
    finally:
        cur.close()
        conn.close()


def list_etl_tables_by_connection(connection_id: int) -> list:
    """해당 연결(connection_id)에 속한 etl_tables 목록. target_table 등 DROP용."""
    schema = _schema()
    conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT etl_table_id, target_table FROM {_q(schema, "etl_tables")}
            WHERE connection_id = %s
            """,
            (connection_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def delete_connection(connection_id: int) -> None:
    """
    연결 삭제. 해당 connection_id를 쓰는 모든 ETL의 타겟 테이블을 메인 DB에서 DROP한 뒤,
    etl_tables 행 삭제, etl_connections 행 삭제.
    """
    api_db = _get_db()
    schema = _schema()
    tables = list_etl_tables_by_connection(connection_id)
    main_schema = api_db.get_table_schema()
    conn_main = api_db.get_db_connection()
    cur_main = conn_main.cursor()
    try:
        for row in tables:
            target_table = (row.get("target_table") or "").strip()
            if not target_table or not re.match(r"^[a-zA-Z0-9_]+$", target_table):
                continue
            full_name = f'"{main_schema}"."{target_table}"'
            cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
        conn_main.commit()
    finally:
        cur_main.close()
        conn_main.close()

    conn_sys = api_db.get_db_connection_system()
    cur_sys = conn_sys.cursor()
    try:
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_tables')} WHERE connection_id = %s", (connection_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_connections')} WHERE connection_id = %s", (connection_id,))
        conn_sys.commit()
    finally:
        cur_sys.close()
        conn_sys.close()


def list_etl_tables() -> list:
    """etl_tables 목록. connection_name, source_type 포함."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT t.etl_table_id, t.connection_id, t.source_table, t.target_table, t.description,
                   t.file_type, t.file_path, t.pk_columns, t.incremental_column, t.last_synced_at, t.sync_mode,
                   t.batch_size, t.batch_interval_seconds, t.status, t.created_at,
                   c.connection_name, c.source_type
            FROM {_q(schema, "etl_tables")} t
            LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
            ORDER BY t.created_at DESC
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


def create_etl_table(
    connection_id: int,
    target_table: str,
    description: Optional[str],
    created_by: str,
    source_table: Optional[str] = None,
    file_type: Optional[str] = None,
    file_path: Optional[str] = None,
    pk_columns: Optional[str] = None,
    incremental_column: Optional[str] = None,
    sync_mode: Optional[str] = None,
    batch_size: Optional[int] = None,
    batch_interval_seconds: Optional[int] = None,
) -> int:
    """etl_tables 1건 등록. target_table 검증 후 INSERT. 반환: etl_table_id."""
    api_db = _get_db()
    target_table = _validate_identifier(target_table, "target_table")
    sync_mode = (sync_mode or "full").strip().lower()
    if sync_mode not in ("full", "incremental"):
        sync_mode = "full"
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_tables")}
            (connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, batch_size, batch_interval_seconds, status, created_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s, NOW())
            RETURNING etl_table_id
            """,
            (
                connection_id,
                source_table or None,
                target_table,
                (description or "").strip() or None,
                file_type,
                file_path,
                (pk_columns or "").strip() or None,
                (incremental_column or "").strip() or None,
                sync_mode,
                batch_size if batch_size is not None and batch_size > 0 else None,
                batch_interval_seconds if batch_interval_seconds is not None and batch_interval_seconds >= 0 else 0,
                created_by,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["etl_table_id"])
    finally:
        cur.close()
        conn.close()


def get_etl_table(etl_table_id: int) -> Optional[dict]:
    """etl_table_id로 1건 조회. 없으면 None."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT t.etl_table_id, t.connection_id, t.source_table, t.target_table, t.description,
                   t.file_type, t.file_path, t.status, t.created_at,
                   t.pk_columns, t.incremental_column, t.last_synced_at, t.sync_mode,
                   t.batch_size, t.batch_interval_seconds,
                   c.connection_name, c.source_type
            FROM {_q(schema, "etl_tables")} t
            LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
            WHERE t.etl_table_id = %s
            """,
            (etl_table_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def update_last_synced_at(etl_table_id: int, synced_at: Any):
    """증분 적재 완료 후 last_synced_at 갱신. synced_at은 datetime 또는 문자열."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_tables")} SET last_synced_at = %s, updated_at = NOW() WHERE etl_table_id = %s
            """,
            (synced_at, etl_table_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def insert_job(etl_table_id: Optional[int], status: str = "running") -> int:
    """etl_jobs에 1건 삽입. 반환: job_id. status='pending'이면 started_at NULL."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        started = "NULL" if (status or "").strip().lower() == "pending" else "NOW()"
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_jobs")} (etl_table_id, status, started_at, created_at)
            VALUES (%s, %s, {started}, NOW())
            RETURNING job_id
            """,
            (etl_table_id, status),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["job_id"])
    finally:
        cur.close()
        conn.close()


def set_job_running(job_id: int) -> None:
    """Phase 6: 워커가 Job 수거 시 status='running', started_at=NOW() 로 갱신. finished_at은 건드리지 않음."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = 'running', started_at = COALESCE(started_at, NOW())
            WHERE job_id = %s
            """,
            (job_id,),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def list_jobs(etl_table_id: Optional[int] = None, limit: int = 50) -> list:
    """Phase 6: Job 목록. etl_table_id 지정 시 해당 ETL만. 최신순."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        if etl_table_id is not None:
            cur.execute(
                f"""
                SELECT job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message, created_at
                FROM {_q(schema, "etl_jobs")}
                WHERE etl_table_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (etl_table_id, limit),
            )
        else:
            cur.execute(
                f"""
                SELECT job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message, created_at
                FROM {_q(schema, "etl_jobs")}
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_job(job_id: int) -> Optional[dict]:
    """Phase 6: job_id로 Job 1건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message, created_at
            FROM {_q(schema, "etl_jobs")}
            WHERE job_id = %s
            """,
            (job_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def fetch_pending_jobs(limit: int) -> list:
    """Phase 6: pending 상태 Job을 created_at 순으로 최대 limit건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT job_id, etl_table_id
            FROM {_q(schema, "etl_jobs")}
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def claim_next_pending_job() -> Optional[tuple]:
    """
    Phase 6: pending Job 1건을 running으로 선점(경쟁 방지). SELECT FOR UPDATE SKIP LOCKED 후 UPDATE.
    반환: (job_id, etl_table_id) 또는 None.
    """
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT job_id, etl_table_id
            FROM {_q(schema, "etl_jobs")}
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """
        )
        row = cur.fetchone()
        if not row or row.get("job_id") is None:
            conn.commit()
            return None
        job_id = int(row["job_id"])
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = 'running', started_at = COALESCE(started_at, NOW())
            WHERE job_id = %s
            """,
            (job_id,),
        )
        conn.commit()
        return (job_id, row.get("etl_table_id"))
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def count_running_jobs() -> int:
    """Phase 6: status='running' 인 Job 수."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT COUNT(*) AS n FROM {_q(schema, 'etl_jobs')} WHERE status = 'running'",
        )
        row = cur.fetchone()
        return int(row["n"]) if row else 0
    finally:
        cur.close()
        conn.close()


def is_job_cancelled(job_id: int) -> bool:
    """Job이 사용자에 의해 취소 요청되었는지. 워커 루프에서 주기적으로 확인용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT status FROM {_q(schema, 'etl_jobs')} WHERE job_id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        return (row and (row.get("status") or "").strip().lower() == "cancelled") or False
    finally:
        cur.close()
        conn.close()


def update_job(job_id: int, status: str, rows_processed: Optional[int] = None, error_message: Optional[str] = None):
    """etl_jobs 상태·종료 시각·건수·에러 메시지 갱신. status에 'cancelled' 사용 가능."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = %s, finished_at = NOW(), rows_processed = COALESCE(%s, rows_processed), error_message = %s
            WHERE job_id = %s
            """,
            (status, rows_processed, error_message, job_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_etl_table_status(etl_table_id: int, status: str):
    """etl_tables.status 갱신."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_tables")} SET status = %s, updated_at = NOW() WHERE etl_table_id = %s
            """,
            (status, etl_table_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
