"""
Backend.etl_server2.service_file (배치 폴더 연결·배치 Job·실행 이력 메타 CRUD)
==============================================================================
09_ETL_SFTP_Connection. batch_folder_connections, batch_folder_sftp, batch_folder_s3,
batch_jobs, batch_run_history. 조회·등록·수정·삭제. get_folder_adapter로 FolderAdapter 인스턴스 반환.

[Main Functions]
===========
- list_folder_connections, get_folder_connection, create_folder_connection,
  update_folder_connection, delete_folder_connection, set_folder_connection_verified
- get_folder_adapter: folder_connection_id → FolderAdapter
- list_batch_jobs, get_batch_job (folder_connection_id, protocol 포함), create_batch_job, update_batch_job, delete_batch_job
- create_batch_run, finish_run, update_job_status, update_last_processed_ts (선택적 conn: §2.1 단일 커넥션 재사용)
- is_duplicate_checksum: batch_run_history.file_list(JSONB)에 동일 checksum 존재 여부 조회 (§7.7)
- check_consecutive_failures: 최근 N회 연속 error 시 is_active=False 및 스케줄러 제거 (§7.4)
- list_run_history, get_run_detail
- list_skipped_files: 배치 실행 이력에서 skipped/error 파일 목록 (동일 파일명 최신 1건)
- delete_remote_files: 원격 폴더에서 지정 파일 삭제 (어댑터 delete_file)
- rollback_file_from_target: batch_loaded_keys에서 PK 조회 → 타겟 테이블 DELETE → loaded_keys 삭제 (파일 단위 롤백)

[Dependencies]
=========
- Backend.api_server.db (get_db_connection_system, get_system_table_schema)
- Backend.etl_server2.folder_adapter_file (SFTPAdapter, S3Adapter)
"""

import json
import logging
from typing import Any, List, Optional

logger = logging.getLogger(__name__)


def _get_db():
    from Backend.api_server import db as api_db
    return api_db


def _schema() -> str:
    return _get_db().get_system_table_schema()


def _q(schema_name: str, table_name: str) -> str:
    return f'"{schema_name}"."{table_name}"'


def list_folder_connections() -> List[dict]:
    """폴더 연결 목록. 마스터 + sftp/s3 상세 JOIN. 비밀번호·키·시크릿 제외."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT c.folder_connection_id, c.connection_name, c.protocol, c.is_verified, c.created_at, c.updated_at,
                   s.host AS sftp_host, s.port AS sftp_port, s.remote_path AS sftp_remote_path,
                   s3.bucket AS s3_bucket, s3.prefix AS s3_prefix, s3.region AS s3_region
            FROM {_q(schema, "batch_folder_connections")} c
            LEFT JOIN {_q(schema, "batch_folder_sftp")} s ON c.folder_connection_id = s.folder_connection_id
            LEFT JOIN {_q(schema, "batch_folder_s3")} s3 ON c.folder_connection_id = s3.folder_connection_id
            ORDER BY c.created_at DESC
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


def get_folder_connection(folder_connection_id: int) -> Optional[dict]:
    """폴더 연결 1건 조회. 상세(비밀번호·키 포함) 포함. 어댑터 생성용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT c.*, s.host AS sftp_host, s.port AS sftp_port, s.username AS sftp_username,
                   s.password AS sftp_password, s.private_key AS sftp_private_key, s.remote_path AS sftp_remote_path,
                   s3.bucket AS s3_bucket, s3.prefix AS s3_prefix, s3.region AS s3_region,
                   s3.access_key_id AS s3_access_key_id, s3.secret_access_key AS s3_secret_access_key,
                   s3.endpoint_url AS s3_endpoint_url
            FROM {_q(schema, "batch_folder_connections")} c
            LEFT JOIN {_q(schema, "batch_folder_sftp")} s ON c.folder_connection_id = s.folder_connection_id
            LEFT JOIN {_q(schema, "batch_folder_s3")} s3 ON c.folder_connection_id = s3.folder_connection_id
            WHERE c.folder_connection_id = %s
            """,
            (folder_connection_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def create_folder_connection(
    connection_name: str,
    protocol: str,
    *,
    sftp_host: str = "",
    sftp_port: int = 22,
    sftp_username: str = "",
    sftp_password: str = "",
    sftp_private_key: str = "",
    sftp_remote_path: str = "/",
    s3_bucket: str = "",
    s3_prefix: str = "",
    s3_region: str = "",
    s3_access_key_id: str = "",
    s3_secret_access_key: str = "",
    s3_endpoint_url: str = "",
) -> int:
    """폴더 연결 등록. 마스터 INSERT 후 프로토콜별 상세 INSERT. folder_connection_id 반환."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "batch_folder_connections")}
            (connection_name, protocol, is_verified, created_at, updated_at)
            VALUES (%s, %s, FALSE, NOW(), NOW())
            RETURNING folder_connection_id
            """,
            (connection_name.strip(), protocol.strip().lower()),
        )
        row = cur.fetchone()
        fid = row["folder_connection_id"]
        if protocol.strip().lower() == "sftp":
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "batch_folder_sftp")}
                (folder_connection_id, host, port, username, password, private_key, remote_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (fid, sftp_host, sftp_port, sftp_username, sftp_password or None, sftp_private_key or None, sftp_remote_path or "/"),
            )
        elif protocol.strip().lower() == "s3":
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "batch_folder_s3")}
                (folder_connection_id, bucket, prefix, region, access_key_id, secret_access_key, endpoint_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (fid, s3_bucket, s3_prefix or "", s3_region or None, s3_access_key_id or None, s3_secret_access_key or None, s3_endpoint_url or None),
            )
        conn.commit()
        return fid
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_folder_connection(
    folder_connection_id: int,
    connection_name: Optional[str] = None,
    *,
    sftp_host: str = "",
    sftp_port: int = 22,
    sftp_username: str = "",
    sftp_password: str = "",
    sftp_private_key: str = "",
    sftp_remote_path: str = "/",
    s3_bucket: str = "",
    s3_prefix: str = "",
    s3_region: str = "",
    s3_access_key_id: str = "",
    s3_secret_access_key: str = "",
    s3_endpoint_url: str = "",
) -> None:
    """폴더 연결 수정. connection_name 있으면 마스터 갱신, 프로토콜별 상세 갱신."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        if connection_name is not None:
            cur.execute(
                f"""
                UPDATE {_q(schema, "batch_folder_connections")}
                SET connection_name = %s, updated_at = NOW()
                WHERE folder_connection_id = %s
                """,
                (connection_name.strip(), folder_connection_id),
            )
        row = get_folder_connection(folder_connection_id)
        if not row:
            raise ValueError("폴더 연결을 찾을 수 없습니다.")
        protocol = (row.get("protocol") or "").strip().lower()
        if protocol == "sftp":
            cur.execute(
                f"""
                UPDATE {_q(schema, "batch_folder_sftp")}
                SET host = %s, port = %s, username = %s, password = COALESCE(NULLIF(%s,''), password),
                     private_key = COALESCE(NULLIF(%s,''), private_key), remote_path = %s
                WHERE folder_connection_id = %s
                """,
                (sftp_host, sftp_port, sftp_username, sftp_password or "", sftp_private_key or "", sftp_remote_path or "/", folder_connection_id),
            )
        elif protocol == "s3":
            cur.execute(
                f"""
                UPDATE {_q(schema, "batch_folder_s3")}
                SET bucket = %s, prefix = %s, region = %s,
                     access_key_id = COALESCE(NULLIF(%s,''), access_key_id),
                     secret_access_key = COALESCE(NULLIF(%s,''), secret_access_key),
                     endpoint_url = %s
                WHERE folder_connection_id = %s
                """,
                (s3_bucket, s3_prefix or "", s3_region or None, s3_access_key_id or "", s3_secret_access_key or "", s3_endpoint_url or None, folder_connection_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def delete_folder_connection(folder_connection_id: int) -> None:
    """폴더 연결 삭제. CASCADE로 batch_folder_sftp, batch_folder_s3 함께 삭제."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"DELETE FROM {_q(schema, 'batch_folder_connections')} WHERE folder_connection_id = %s",
            (folder_connection_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def set_folder_connection_verified(folder_connection_id: int, is_verified: bool) -> None:
    """연결 테스트 성공 시 is_verified 갱신."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_folder_connections")}
            SET is_verified = %s, updated_at = NOW()
            WHERE folder_connection_id = %s
            """,
            (is_verified, folder_connection_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_folder_adapter(folder_connection_id: int):
    """folder_connection_id로 FolderAdapter 인스턴스 반환. 설계서 §6.2."""
    from Backend.etl_server2.folder_adapter_file import SFTPAdapter, S3Adapter

    row = get_folder_connection(folder_connection_id)
    if not row:
        raise ValueError("폴더 연결을 찾을 수 없습니다.")
    protocol = (row.get("protocol") or "").strip().lower()
    if protocol == "sftp":
        return SFTPAdapter(
            host=row.get("sftp_host") or "",
            port=int(row.get("sftp_port") or 22),
            username=row.get("sftp_username") or "",
            password=row.get("sftp_password"),
            private_key=row.get("sftp_private_key"),
            remote_path=row.get("sftp_remote_path") or "/",
        )
    if protocol == "s3":
        return S3Adapter(
            bucket=row.get("s3_bucket") or "",
            prefix=row.get("s3_prefix") or "",
            region=row.get("s3_region"),
            access_key_id=row.get("s3_access_key_id"),
            secret_access_key=row.get("s3_secret_access_key"),
            endpoint_url=row.get("s3_endpoint_url"),
        )
    raise ValueError(f"지원하지 않는 프로토콜: {protocol}")


# ---------- batch_jobs, batch_run_history (§3.5, §3.6) ----------


def list_batch_jobs(
    folder_connection_id: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> List[dict]:
    """배치 Job 목록. batch_folder_connections.connection_name JOIN. folder_connection_id, is_active 필터."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        sql = f"""
            SELECT j.batch_job_id, j.folder_connection_id, j.storage_connection_id, j.job_name,
                   j.file_pattern, j.file_extensions, j.target_table, j.pk_columns, j.timestamp_format,
                   j.interval_minutes, j.is_active, j.last_processed_ts, j.last_run_at, j.last_run_status,
                   j.last_error_message, j.column_mapping, j.created_at, j.updated_at,
                   c.connection_name, c.protocol,
                   sc.connection_name AS storage_connection_name
            FROM {_q(schema, "batch_jobs")} j
            LEFT JOIN {_q(schema, "batch_folder_connections")} c ON j.folder_connection_id = c.folder_connection_id
            LEFT JOIN {_q(schema, "etl_storage_connections")} sc ON j.storage_connection_id = sc.storage_connection_id AND sc.is_active = TRUE
            WHERE 1=1
            """
        params: List[Any] = []
        if folder_connection_id is not None:
            sql += " AND j.folder_connection_id = %s"
            params.append(folder_connection_id)
        if is_active is not None:
            sql += " AND j.is_active = %s"
            params.append(is_active)
        sql += " ORDER BY j.created_at DESC"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


def _row_to_dict(r) -> dict:
    """RealDictRow 또는 tuple-like row를 dict로. datetime/JSONB 직렬화."""
    if hasattr(r, "keys"):
        d = dict(r)
    else:
        return {}
    for k, v in list(d.items()):
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "copy"):
            try:
                d[k] = json.loads(json.dumps(v, default=str))
            except (TypeError, ValueError):
                d[k] = v
    return d


def get_batch_job(batch_job_id: int) -> Optional[dict]:
    """배치 Job 1건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT j.*, c.connection_name, c.protocol
            FROM {_q(schema, "batch_jobs")} j
            LEFT JOIN {_q(schema, "batch_folder_connections")} c ON j.folder_connection_id = c.folder_connection_id
            WHERE j.batch_job_id = %s
            """,
            (batch_job_id,),
        )
        row = cur.fetchone()
        return _row_to_dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def create_batch_job(
    folder_connection_id: int,
    storage_connection_id: Optional[int],
    job_name: str,
    file_pattern: str,
    *,
    file_extensions: str = "csv,xlsx,xls,parquet",
    target_table: str = "",
    pk_columns: Optional[str] = None,
    interval_minutes: int = 10,
    is_active: bool = True,
    column_mapping: Optional[List[dict]] = None,
) -> int:
    """배치 Job 등록. interval_minutes 10~1440. batch_job_id 반환."""
    if not (10 <= interval_minutes <= 1440):
        raise ValueError("interval_minutes는 10~1440 사이여야 합니다.")
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "batch_jobs")}
            (folder_connection_id, storage_connection_id, job_name, file_pattern, file_extensions,
             target_table, pk_columns, timestamp_format, interval_minutes, is_active, column_mapping, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'yyyyMMddHHmmss', %s, %s, %s, NOW(), NOW())
            RETURNING batch_job_id
            """,
            (
                folder_connection_id,
                storage_connection_id,
                (job_name or "").strip(),
                (file_pattern or "").strip(),
                (file_extensions or "csv,xlsx,xls,parquet").strip(),
                (target_table or "").strip(),
                (pk_columns or "").strip() or None,
                interval_minutes,
                is_active,
                json.dumps(column_mapping) if column_mapping is not None else None,
            ),
        )
        row = cur.fetchone()
        batch_job_id = row["batch_job_id"]
        conn.commit()
        return batch_job_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_batch_job(batch_job_id: int, **kwargs) -> None:
    """배치 Job 수정. updatable: job_name, file_pattern, file_extensions, target_table, pk_columns,
    interval_minutes, is_active, storage_connection_id, column_mapping."""
    allowed = {
        "job_name", "file_pattern", "file_extensions", "target_table", "pk_columns",
        "interval_minutes", "is_active", "storage_connection_id", "column_mapping",
    }
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return
    if "interval_minutes" in updates and updates["interval_minutes"] is not None and not (10 <= updates["interval_minutes"] <= 1440):
        raise ValueError("interval_minutes는 10~1440 사이여야 합니다.")
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        set_parts = []
        params: List[Any] = []
        for k, v in updates.items():
            if k == "column_mapping":
                set_parts.append("column_mapping = %s")
                params.append(json.dumps(v) if v is not None else None)
            else:
                set_parts.append(f"{k} = %s")
                params.append(v)
        set_parts.append("updated_at = NOW()")
        params.append(batch_job_id)
        cur.execute(
            f"UPDATE {_q(schema, 'batch_jobs')} SET {', '.join(set_parts)} WHERE batch_job_id = %s",
            params,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def delete_batch_job(batch_job_id: int) -> None:
    """
    배치 Job 삭제. FK 제약을 위해 자식 테이블(batch_loaded_keys, batch_run_history)을 먼저 삭제한 뒤 batch_jobs 삭제.
    """
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        # 1) batch_loaded_keys (job별 PK 기록) 삭제
        cur.execute(
            f"DELETE FROM {_q(schema, 'batch_loaded_keys')} WHERE batch_job_id = %s",
            (batch_job_id,),
        )
        # 2) batch_run_history (실행 이력) 삭제
        cur.execute(
            f"DELETE FROM {_q(schema, 'batch_run_history')} WHERE batch_job_id = %s",
            (batch_job_id,),
        )
        # 3) batch_jobs 삭제
        cur.execute(
            f"DELETE FROM {_q(schema, 'batch_jobs')} WHERE batch_job_id = %s",
            (batch_job_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def create_batch_run(batch_job_id: int, conn: Any = None) -> int:
    """실행 이력 1건 등록. status=running. run_id 반환. conn 전달 시 호출부가 커넥션 관리 (§2.1)."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "batch_run_history")}
            (batch_job_id, started_at, status)
            VALUES (%s, NOW(), 'running')
            RETURNING run_id
            """,
            (batch_job_id,),
        )
        row = cur.fetchone()
        run_id = row["run_id"]
        conn.commit()
        return run_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if should_close:
            conn.close()


def finish_run(
    run_id: int,
    status: str,
    *,
    files_processed: int = 0,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    error_message: Optional[str] = None,
    file_list: Optional[List[dict]] = None,
    conn: Any = None,
) -> None:
    """실행 이력 완료 처리. status: success|error|skipped. conn 전달 시 호출부가 커넥션 관리 (§2.1)."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_run_history")}
            SET finished_at = NOW(), status = %s, files_processed = %s, rows_inserted = %s,
                rows_updated = %s, error_message = %s, file_list = %s
            WHERE run_id = %s
            """,
            (
                status,
                files_processed,
                rows_inserted,
                rows_updated,
                error_message,
                json.dumps(file_list) if file_list is not None else None,
                run_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if should_close:
            conn.close()


def update_job_status(batch_job_id: int, last_run_status: str, last_error_message: Optional[str] = None, conn: Any = None) -> None:
    """batch_jobs.last_run_status, last_error_message, last_run_at 갱신. conn 전달 시 호출부가 커넥션 관리 (§2.1)."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_jobs")}
            SET last_run_at = NOW(), last_run_status = %s, last_error_message = %s, updated_at = NOW()
            WHERE batch_job_id = %s
            """,
            (last_run_status, last_error_message, batch_job_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if should_close:
            conn.close()


def set_run_cancel_requested(run_id: int, conn: Any = None) -> bool:
    """실행 취소 요청. batch_run_history.cancel_requested_at = NOW(). (컬럼 필요: ALTER TABLE batch_run_history ADD COLUMN cancel_requested_at TIMESTAMP NULL;)"""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_run_history")}
            SET cancel_requested_at = NOW()
            WHERE run_id = %s AND (status = 'running' OR finished_at IS NULL)
            """,
            (run_id,),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.warning("set_run_cancel_requested run_id=%s: %s (cancel_requested_at 컬럼 필요할 수 있음)", run_id, e)
        return False
    finally:
        cur.close()
        if should_close:
            conn.close()


def is_run_cancel_requested(run_id: int, conn: Any = None) -> bool:
    """취소 요청 여부. cancel_requested_at IS NOT NULL이면 True. 컬럼 없으면 False."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT 1 FROM {_q(schema, "batch_run_history")}
            WHERE run_id = %s AND cancel_requested_at IS NOT NULL
            LIMIT 1
            """,
            (run_id,),
        )
        return cur.fetchone() is not None
    except Exception:
        return False
    finally:
        cur.close()
        if should_close:
            conn.close()


def update_last_processed_ts(batch_job_id: int, ts: Optional[str], conn: Any = None) -> None:
    """batch_jobs.last_processed_ts 갱신. ts=None이면 NULL(처음부터 재시작). conn 전달 시 호출부가 커넥션 관리 (§2.1)."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_jobs")}
            SET last_processed_ts = %s, updated_at = NOW()
            WHERE batch_job_id = %s
            """,
            (ts, batch_job_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if should_close:
            conn.close()


def is_duplicate_checksum(batch_job_id: int, checksum: str, conn: Any = None) -> bool:
    """
    batch_run_history.file_list(JSONB)에 동일 batch_job_id·checksum 조합이 이미 있는지 조회.
    §7.7 파일 체크섬 중복 방지. conn 전달 시 호출부가 커넥션 관리 (§2.1).
    """
    if not checksum:
        return False
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT 1
            FROM {_q(schema, "batch_run_history")}
            WHERE batch_job_id = %s
              AND file_list IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(file_list) AS elem
                WHERE elem->>'checksum' = %s
              )
            LIMIT 1
            """,
            (batch_job_id, checksum),
        )
        row = cur.fetchone()
        return row is not None
    finally:
        cur.close()
        if should_close:
            conn.close()


def check_consecutive_failures(batch_job_id: int, threshold: int = 5, conn: Any = None) -> None:
    """
    최근 threshold회 연속 status='error'이면 batch_jobs.is_active=False로 전환 및 스케줄러 제거.
    설계서 §7.4. conn 전달 시 호출부가 커넥션 관리 (§2.1).
    """
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT status FROM {_q(schema, "batch_run_history")}
            WHERE batch_job_id = %s
            ORDER BY started_at DESC LIMIT %s
            """,
            (batch_job_id, threshold),
        )
        rows = cur.fetchall()
        if len(rows) < threshold:
            return
        statuses = []
        for r in rows:
            if hasattr(r, "keys"):
                statuses.append((r.get("status") or "").strip().lower())
            else:
                statuses.append((r[0] if r else "").strip().lower())
        if not all(s == "error" for s in statuses):
            return
        err_msg = f"연속 {threshold}회 실패로 자동 비활성화"
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_jobs")}
            SET is_active = FALSE, last_error_message = %s, updated_at = NOW()
            WHERE batch_job_id = %s
            """,
            (err_msg, batch_job_id),
        )
        conn.commit()
        from Backend.etl_server2 import scheduler_file as sched_mod
        sched_mod.remove_job(batch_job_id)
        logger.warning("batch %s 연속 %d회 실패 → 자동 비활성화", batch_job_id, threshold)
    except Exception as e:
        conn.rollback()
        logger.exception("check_consecutive_failures batch_job_id=%s: %s", batch_job_id, e)
    finally:
        cur.close()
        if should_close:
            conn.close()


def list_run_history(batch_job_id: int, limit: int = 50) -> List[dict]:
    """실행 이력 목록. 최신순."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT run_id, batch_job_id, started_at, finished_at, status,
                   files_processed, rows_inserted, rows_updated, error_message, file_list
            FROM {_q(schema, "batch_run_history")}
            WHERE batch_job_id = %s
            ORDER BY started_at DESC
            LIMIT %s
            """,
            (batch_job_id, limit),
        )
        rows = cur.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


def get_run_detail(run_id: int) -> Optional[dict]:
    """실행 이력 1건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT run_id, batch_job_id, started_at, finished_at, status,
                   files_processed, rows_inserted, rows_updated, error_message, file_list
            FROM {_q(schema, "batch_run_history")}
            WHERE run_id = %s
            """,
            (run_id,),
        )
        row = cur.fetchone()
        return _row_to_dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def list_skipped_files(batch_job_id: int, conn: Any = None, limit: int = 50) -> List[dict]:
    """
    배치 Job의 실행 이력에서 status가 skipped 또는 error인 파일만 추출.
    동일 파일명이 여러 이력에 걸쳐 있으면 가장 최근 것만. 최근 limit회 이력만 스캔 (§1-2).
    반환: [{ filename, timestamp, status, reason, run_id, run_started_at }]
    """
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT r.run_id, r.started_at, r.file_list
            FROM {_q(schema, "batch_run_history")} r
            WHERE r.batch_job_id = %s
              AND r.file_list IS NOT NULL
            ORDER BY r.started_at DESC
            LIMIT %s
            """,
            (batch_job_id, limit),
        )
        rows = cur.fetchall()
        seen_filenames = set()
        result: List[dict] = []
        for row in rows:
            d = dict(row) if hasattr(row, "keys") else {"run_id": row[0], "started_at": row[1], "file_list": row[2]}
            file_list = d.get("file_list")
            if isinstance(file_list, str):
                try:
                    file_list = json.loads(file_list)
                except (TypeError, ValueError):
                    continue
            if not file_list:
                continue
            for item in file_list:
                if not isinstance(item, dict):
                    continue
                st = (item.get("status") or "").strip().lower()
                if st not in ("skipped", "error"):
                    continue
                fname = (item.get("filename") or "").strip()
                if not fname or fname in seen_filenames:
                    continue
                seen_filenames.add(fname)
                started_at = d.get("started_at")
                run_started_at = started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at) if started_at else ""
                result.append({
                    "filename": fname,
                    "timestamp": item.get("timestamp"),
                    "status": st,
                    "reason": (item.get("reason") or item.get("error") or "").strip(),
                    "run_id": d.get("run_id"),
                    "run_started_at": run_started_at,
                })
        return result
    finally:
        cur.close()
        if should_close:
            conn.close()


def delete_remote_files(folder_connection_id: int, filenames: List[str]) -> dict:
    """
    원격 폴더에서 지정 파일 삭제. 어댑터 delete_file 사용.
    반환: { "deleted": [...], "failed": [{ "filename", "error" }] }
    """
    if not filenames:
        return {"deleted": [], "failed": []}
    adapter = None
    try:
        adapter = get_folder_adapter(folder_connection_id)
        deleted: List[str] = []
        failed: List[dict] = []
        for fname in filenames:
            fname = (fname or "").strip()
            if not fname:
                continue
            try:
                adapter.delete_file(fname)
                deleted.append(fname)
            except Exception as e:
                failed.append({"filename": fname, "error": str(e)})
        return {"deleted": deleted, "failed": failed}
    finally:
        if adapter:
            try:
                adapter.close()
            except Exception:
                pass


def rollback_file_from_target(
    batch_job_id: int,
    run_id: int,
    filename: str,
    storage_connection_id: Optional[int],
    target_table: str,
    pk_columns_str: str,
) -> int:
    """
    batch_loaded_keys에서 해당 파일의 PK 목록 조회 → 타겟 테이블에서 DELETE → loaded_keys에서도 DELETE.
    반환: 삭제된 행 수. PK가 비어 있으면 ValueError.
    """
    if not pk_columns_str or not pk_columns_str.strip():
        raise ValueError("PK가 설정되지 않은 배치는 파일 단위 롤백을 지원하지 않습니다.")

    pk_cols = [p.strip() for p in pk_columns_str.split(",") if p.strip()]
    schema_sys = _schema()

    # 1) 시스템 DB에서 해당 파일의 PK 목록 조회
    sys_conn = _get_db().get_db_connection_system()
    try:
        cur = sys_conn.cursor()
        cur.execute(
            f"""
            SELECT pk_values FROM "{schema_sys}"."batch_loaded_keys"
            WHERE batch_job_id = %s AND run_id = %s AND filename = %s
            """,
            (batch_job_id, run_id, filename),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        sys_conn.close()

    if not rows:
        raise ValueError(
            f"롤백할 PK 데이터가 없습니다. (job={batch_job_id}, run={run_id}, file={filename})"
        )

    pk_dicts = []
    for r in rows:
        val = r[0] if not hasattr(r, "keys") else r.get("pk_values")
        if isinstance(val, str):
            val = json.loads(val)
        pk_dicts.append(val)

    # 2) 타겟 DB에서 DELETE
    from Backend.etl_server2 import load_service_file

    target_conn, target_schema = load_service_file.get_target_connection(
        storage_connection_id
    )
    total_deleted = 0
    try:
        cur = target_conn.cursor()
        quoted_table = f'"{target_schema}"."{target_table}"'
        for start in range(0, len(pk_dicts), 1000):
            batch = pk_dicts[start : start + 1000]
            conditions = []
            params: List[Any] = []
            for pk_dict in batch:
                cond_parts = []
                for col in pk_cols:
                    val = pk_dict.get(col)
                    if val is None:
                        cond_parts.append(f'"{col}" IS NULL')
                    else:
                        cond_parts.append(f'"{col}" = %s')
                        params.append(val)
                conditions.append("(" + " AND ".join(cond_parts) + ")")
            where = " OR ".join(conditions)
            cur.execute(f'DELETE FROM {quoted_table} WHERE {where}', params)
            total_deleted += cur.rowcount
        target_conn.commit()
        cur.close()
    except Exception:
        target_conn.rollback()
        raise
    finally:
        target_conn.close()

    # 3) 시스템 DB에서 loaded_keys 삭제
    sys_conn2 = _get_db().get_db_connection_system()
    try:
        cur = sys_conn2.cursor()
        cur.execute(
            f"""
            DELETE FROM "{schema_sys}"."batch_loaded_keys"
            WHERE batch_job_id = %s AND run_id = %s AND filename = %s
            """,
            (batch_job_id, run_id, filename),
        )
        sys_conn2.commit()
        cur.close()
    finally:
        sys_conn2.close()

    return total_deleted
