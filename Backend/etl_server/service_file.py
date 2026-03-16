"""
Backend.etl_server.service_file (배치 폴더 연결·배치 Job·실행 이력 메타 CRUD)
==============================================================================
09_ETL_SFTP_Connection. batch_folder_connections, batch_folder_sftp, batch_folder_s3,
batch_jobs, batch_run_history. 조회·등록·수정·삭제. get_folder_adapter로 FolderAdapter 인스턴스 반환.

[Main Functions]
===========
- list_folder_connections, get_folder_connection, create_folder_connection,
  update_folder_connection, delete_folder_connection, set_folder_connection_verified
- get_folder_adapter: folder_connection_id → FolderAdapter
- list_batch_jobs (folder_connection_id, is_active, job_type 필터, etl_table_id 포함), get_batch_job (folder/DB 공통, source_connection_name JOIN), create_batch_job (job_type=file|db, etl_table_id 있으면 DB 배치 시 etl_table_id로 중복 검사·실행 시 etl_tables 참조, 없으면 기존 connection_id·source_table·타겟·저장DB 중복 검사), update_batch_job, delete_batch_job
- update_last_synced_at_db_batch: DB 배치 last_synced_at 갱신 (conn 선택)
- etl_batch_target_registry: 배치로 생성된 타겟 테이블을 ETL 목록에 행으로 관리. list_batch_target_registry, upsert_batch_target_registry, clear_batch_job_from_registry, delete_batch_target_registry_and_drop_table
- try_claim_batch_job_for_run: 배치 실행 전 FOR UPDATE 선점·last_run_status='running' 갱신(중복 실행 방지). create_batch_run, finish_run, update_run_progress, update_job_status, get_last_processed_ts, update_last_processed_ts (선택적 conn: §2.1 단일 커넥션 재사용)
- mark_stuck_runs_finished: 비활성화 시 해당 배치의 status=running 이력을 error로 마감. force_finish_run_as_cancelled: 실행 취소 시 run을 cancelled로 마감·last_run_status 해제(이력 유지, 재실행 가능).
- is_duplicate_checksum: batch_run_history.file_list(JSONB)에 동일 checksum 존재 여부 조회 (§7.7)
- check_consecutive_failures: 최근 N회 연속 error 시 is_active=False 및 스케줄러 제거 (§7.4)
- list_run_history, get_run_detail
- list_skipped_files: 배치 실행 이력에서 skipped/error 파일 목록 (동일 파일명 최신 1건)
- list_skipped_files_history: 배치 실행 이력에서 skipped/error 파일 전부 (동일 파일명 여러 run 포함)
- get_skipped_filenames_set: 이력 중 skipped/error 파일명 집합 (pending 제외용, 매 주기 재시도 방지)
- delete_remote_files: 원격 폴더에서 지정 파일 삭제 (어댑터 delete_file)
- rollback_file_from_target: batch_loaded_keys에서 PK 조회 → 타겟 테이블 DELETE → loaded_keys 삭제 (파일 단위 롤백)

[Dependencies]
=========
- Backend.api_server.db (get_db_connection_system, get_system_table_schema, _get_db/_schema/_q는 service 위임)
- Backend.etl_server.service (_get_db, _schema, _q 공유)
- Backend.etl_server.folder_adapter_file (SFTPAdapter, S3Adapter)
"""

import json
import logging
import re
from typing import Any, List, Optional, Set

from Backend.etl_server import service as etl_service

logger = logging.getLogger(__name__)


def _get_db():
    return etl_service._get_db()


def _schema() -> str:
    return etl_service._schema()


def _q(schema_name: str, table_name: str) -> str:
    return etl_service._q(schema_name, table_name)


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
    from Backend.etl_server.folder_adapter_file import SFTPAdapter, S3Adapter

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
    job_type: Optional[str] = None,
) -> List[dict]:
    """배치 Job 목록. batch_folder_connections.connection_name, etl_connections(DB배치) JOIN. folder_connection_id, is_active, job_type 필터."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        sql = f"""
            SELECT j.batch_job_id, j.folder_connection_id, j.storage_connection_id, j.job_name,
                   j.file_pattern, j.file_extensions, j.target_table, j.pk_columns, j.timestamp_format,
                   j.interval_minutes, j.is_active, j.last_processed_ts, j.last_run_at, j.last_run_status,
                   j.last_error_message, j.column_mapping, j.index_definitions, j.created_at, j.updated_at,
                   j.job_type, j.connection_id, j.source_table, j.incremental_column, j.sync_mode,
                   j.last_synced_at, j.batch_size, j.batch_interval_seconds, j.on_row_error, j.on_file_error,
                   j.etl_table_id, j.diff_delete_orphans,
                   c.connection_name, c.protocol,
                   ec.connection_name AS source_connection_name,
                   sc.connection_name AS storage_connection_name
            FROM {_q(schema, "batch_jobs")} j
            LEFT JOIN {_q(schema, "batch_folder_connections")} c ON j.folder_connection_id = c.folder_connection_id
            LEFT JOIN {_q(schema, "etl_connections")} ec ON j.connection_id = ec.connection_id
            LEFT JOIN {_q(schema, "etl_storage_connections")} sc ON j.storage_connection_id = sc.storage_connection_id
            WHERE 1=1
            """
        params: List[Any] = []
        if folder_connection_id is not None:
            sql += " AND j.folder_connection_id = %s"
            params.append(folder_connection_id)
        if is_active is not None:
            sql += " AND j.is_active = %s"
            params.append(is_active)
        if job_type is not None and (job_type or "").strip():
            sql += " AND j.job_type = %s"
            params.append((job_type or "").strip().lower())
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
    """배치 Job 1건 조회. DB 배치 시 source_connection_name은 etl_connections JOIN."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT j.*, c.connection_name, c.protocol,
                   ec.connection_name AS source_connection_name
            FROM {_q(schema, "batch_jobs")} j
            LEFT JOIN {_q(schema, "batch_folder_connections")} c ON j.folder_connection_id = c.folder_connection_id
            LEFT JOIN {_q(schema, "etl_connections")} ec ON j.connection_id = ec.connection_id
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
    folder_connection_id: Optional[int],
    storage_connection_id: Optional[int],
    job_name: str,
    file_pattern: str = "",
    *,
    file_extensions: str = "csv,xlsx,xls,parquet",
    target_table: str = "",
    pk_columns: Optional[str] = None,
    interval_minutes: int = 10,
    is_active: bool = True,
    column_mapping: Optional[List[dict]] = None,
    index_definitions: Optional[List[dict]] = None,
    on_file_error: str = "stop",
    job_type: str = "file",
    connection_id: Optional[int] = None,
    source_table: Optional[str] = None,
    incremental_column: Optional[str] = None,
    sync_mode: str = "incremental",
    batch_size: Optional[int] = None,
    batch_interval_seconds: Optional[int] = None,
    on_row_error: str = "fail",
    etl_table_id: Optional[int] = None,
    diff_delete_orphans: bool = False,
) -> int:
    """배치 Job 등록. interval_minutes 10~1440. batch_job_id 반환.
    job_type='file': folder_connection_id 필수. job_type='db': connection_id 필수(etl_table_id 없을 때), folder_connection_id NULL.
    중복: file는 (folder_connection_id, file_pattern, target_table, storage). db+etl_table_id 있으면 etl_table_id만, 없으면 (connection_id, source_table, target_table, storage)."""
    if not (10 <= interval_minutes <= 1440):
        raise ValueError("interval_minutes는 10~1440 사이여야 합니다.")
    jtype = (job_type or "file").strip().lower()
    if jtype not in ("file", "db"):
        raise ValueError("job_type은 'file' 또는 'db'여야 합니다.")
    if jtype == "file" and folder_connection_id is None:
        raise ValueError("파일 배치에는 folder_connection_id가 필요합니다.")
    if jtype == "db" and etl_table_id is None and connection_id is None:
        raise ValueError("DB 배치에는 connection_id가 필요합니다.")

    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        target_table_trimmed = (target_table or "").strip()
        if not target_table_trimmed:
            raise ValueError("target_table이 비어 있습니다.")

        if jtype == "db":
            if etl_table_id:
                cur.execute(
                    f"""
                    SELECT 1 FROM {_q(schema, "batch_jobs")}
                    WHERE job_type = 'db' AND etl_table_id = %s LIMIT 1
                    """,
                    (etl_table_id,),
                )
                if cur.fetchone():
                    raise ValueError("이 ETL 테이블에 이미 배치 Job이 등록되어 있습니다.")
            else:
                source_table_trimmed = (source_table or "").strip()
                if not source_table_trimmed:
                    raise ValueError("DB 배치에는 source_table이 필요합니다.")
                cur.execute(
                    f"""
                    SELECT 1 FROM {_q(schema, "batch_jobs")}
                    WHERE job_type = 'db' AND connection_id = %s AND source_table = %s
                      AND target_table = %s AND (storage_connection_id IS NOT DISTINCT FROM %s)
                    LIMIT 1
                    """,
                    (connection_id, source_table_trimmed, target_table_trimmed, storage_connection_id),
                )
                if cur.fetchone():
                    raise ValueError(
                        "이미 동일한 연결·소스 테이블·타겟 테이블·저장 DB로 등록된 DB 배치 Job이 있습니다. "
                        "기존 Job을 수정하거나 삭제한 뒤 다시 등록해 주세요."
                    )
        else:
            file_pattern_trimmed = (file_pattern or "").strip()
            if target_table_trimmed:
                cur.execute(
                    f"""
                    SELECT 1 FROM {_q(schema, "batch_jobs")}
                    WHERE folder_connection_id = %s AND (file_pattern IS NOT DISTINCT FROM %s) AND target_table = %s
                      AND (storage_connection_id IS NOT DISTINCT FROM %s)
                    LIMIT 1
                    """,
                    (folder_connection_id, file_pattern_trimmed or None, target_table_trimmed, storage_connection_id),
                )
                if cur.fetchone():
                    raise ValueError(
                        "이미 동일한 폴더·파일 패턴·타겟 테이블·저장 DB로 등록된 배치 Job이 있습니다. "
                        "기존 Job을 수정하거나 삭제한 뒤 다시 등록해 주세요."
                    )

        on_file_error_val = (on_file_error or "stop").strip().lower()
        if on_file_error_val not in ("stop", "continue"):
            on_file_error_val = "stop"
        on_row_error_val = (on_row_error or "fail").strip().lower()
        if on_row_error_val not in ("fail", "skip"):
            on_row_error_val = "fail"
        sync_mode_val = (sync_mode or "incremental").strip().lower()
        if sync_mode_val not in ("full", "incremental", "diff"):
            sync_mode_val = "incremental"
        diff_delete_orphans_val = bool(diff_delete_orphans) if jtype == "db" else False

        cur.execute(
            f"""
            INSERT INTO {_q(schema, "batch_jobs")}
            (folder_connection_id, storage_connection_id, job_name, file_pattern, file_extensions,
             target_table, pk_columns, timestamp_format, interval_minutes, is_active, column_mapping, index_definitions, on_file_error,
             job_type, connection_id, source_table, incremental_column, sync_mode, last_synced_at, batch_size, batch_interval_seconds, on_row_error, etl_table_id, diff_delete_orphans, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'yyyyMMddHHmmss', %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING batch_job_id
            """,
            (
                folder_connection_id if jtype == "file" else None,
                storage_connection_id,
                (job_name or "").strip(),
                (file_pattern or "").strip() if jtype == "file" else None,
                ("" if jtype == "db" else (file_extensions or "csv,xlsx,xls,parquet").strip()),
                target_table_trimmed,
                (pk_columns or "").strip() or None,
                interval_minutes,
                is_active,
                json.dumps(column_mapping) if column_mapping is not None else None,
                json.dumps(index_definitions) if index_definitions is not None else None,
                on_file_error_val,
                jtype,
                connection_id if jtype == "db" else None,
                (source_table or "").strip() or None if jtype == "db" else None,
                (incremental_column or "").strip() or None if jtype == "db" else None,
                sync_mode_val if jtype == "db" else None,
                batch_size if jtype == "db" else None,
                batch_interval_seconds if jtype == "db" else None,
                on_row_error_val if jtype == "db" else None,
                etl_table_id if jtype == "db" else None,
                diff_delete_orphans_val,
            ),
        )
        row = cur.fetchone()
        batch_job_id = row["batch_job_id"]
        conn.commit()
        # etl_table_id 기반 배치는 타겟이 이미 etl_tables에 있으므로 레지스트리 중복 등록하지 않음. 목록은 ETL 테이블 1행만 표시.
        target_table = (target_table or "").strip()
        if target_table and not etl_table_id:
            try:
                upsert_batch_target_registry(target_table, storage_connection_id, batch_job_id)
            except Exception as e:
                logger.warning("etl_batch_target_registry upsert 실패(배치 Job은 생성됨): %s", e)
        return batch_job_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_batch_job(batch_job_id: int, **kwargs) -> None:
    """배치 Job 수정. updatable: job_name, file_pattern, file_extensions, target_table, pk_columns,
    interval_minutes, is_active, storage_connection_id, column_mapping, index_definitions, on_file_error,
    connection_id, source_table, incremental_column, sync_mode, batch_size, batch_interval_seconds, on_row_error,
    last_run_status (비활성화 시 끼어 있던 running 상태 초기화용)."""
    allowed = {
        "job_name", "file_pattern", "file_extensions", "target_table", "pk_columns",
        "interval_minutes", "is_active", "storage_connection_id", "column_mapping", "index_definitions", "on_file_error",
        "connection_id", "source_table", "incremental_column", "sync_mode", "batch_size", "batch_interval_seconds", "on_row_error",
        "diff_delete_orphans", "last_run_status",
    }
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return
    if "interval_minutes" in updates and updates["interval_minutes"] is not None and not (10 <= updates["interval_minutes"] <= 1440):
        raise ValueError("interval_minutes는 10~1440 사이여야 합니다.")
    if "on_file_error" in updates and updates["on_file_error"] is not None:
        ofe = (updates["on_file_error"] or "").strip().lower()
        if ofe not in ("stop", "continue"):
            raise ValueError("on_file_error는 'stop' 또는 'continue'여야 합니다.")
        updates["on_file_error"] = ofe
    if "on_row_error" in updates and updates["on_row_error"] is not None:
        ore = (updates["on_row_error"] or "").strip().lower()
        if ore not in ("fail", "skip"):
            raise ValueError("on_row_error는 'fail' 또는 'skip'여야 합니다.")
        updates["on_row_error"] = ore
    if "sync_mode" in updates and updates["sync_mode"] is not None:
        sm = (updates["sync_mode"] or "").strip().lower()
        if sm not in ("full", "incremental", "diff"):
            raise ValueError("sync_mode는 'full', 'incremental', 'diff' 중 하나여야 합니다.")
        updates["sync_mode"] = sm
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
            elif k == "index_definitions":
                set_parts.append("index_definitions = %s::jsonb")
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
    배치 Job 삭제. ETL 목록용 레지스트리에서 batch_job_id만 NULL로 한 뒤,
    FK 제약을 위해 자식 테이블(batch_loaded_keys, batch_run_history) 삭제 후 batch_jobs 삭제. 타겟 테이블은 DROP하지 않음.
    """
    clear_batch_job_from_registry(batch_job_id)
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


# ---------- etl_batch_target_registry (ETL 목록에 배치 타겟 테이블 행으로 관리) ----------

_REGISTRY_TABLE = "etl_batch_target_registry"
_registry_table_ensured: bool = False


def _ensure_batch_target_registry_table(conn) -> None:
    """etl_batch_target_registry 테이블이 없으면 생성. (target_table, storage_connection_id) UNIQUE. 프로세스당 1회만 DDL 실행."""
    global _registry_table_ensured
    if _registry_table_ensured:
        return
    schema = _schema()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_q(schema, _REGISTRY_TABLE)} (
                id SERIAL PRIMARY KEY,
                target_table VARCHAR(200) NOT NULL,
                storage_connection_id INTEGER,
                batch_job_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (target_table, storage_connection_id)
            )
            """
        )
        conn.commit()
        _registry_table_ensured = True
    finally:
        cur.close()


def list_batch_target_registry() -> List[dict]:
    """
    ETL 목록용 배치 타겟 등록 목록. batch_jobs·folder·storage LEFT JOIN으로 job_name, connection_name, storage_connection_name 포함.
    batch_job_id가 NULL이어도 행 반환(잡 삭제 후 테이블만 관리하는 행).
    기존 batch_jobs 행이 레지스트리에 없으면 자동 backfill(upsert) 후 조회.
    """
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    _ensure_batch_target_registry_table(conn)
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT target_table, storage_connection_id, batch_job_id, etl_table_id FROM {_q(schema, 'batch_jobs')}"
        )
        for row in cur.fetchall():
            tt = (row.get("target_table") if hasattr(row, "get") else row[0]) or ""
            sid = row.get("storage_connection_id") if hasattr(row, "get") else row[1]
            jid = row.get("batch_job_id") if hasattr(row, "get") else row[2]
            etl_tid = row.get("etl_table_id") if hasattr(row, "get") else (row[3] if len(row) > 3 else None)
            if (tt or "").strip() and jid is not None and etl_tid is None:
                try:
                    upsert_batch_target_registry(tt.strip(), sid, int(jid), conn=conn)
                except Exception as e:
                    logger.debug("registry backfill skip %s: %s", (tt, sid), e)
                    try:
                        conn.rollback()
                    except Exception:
                        pass
        cur.execute(
            f"""
            SELECT r.id, r.target_table, r.storage_connection_id, r.batch_job_id, r.created_at, r.updated_at,
                   j.job_name, j.folder_connection_id, j.interval_minutes, j.is_active, j.last_run_status, j.last_run_at,
                   c.connection_name,
                   sc.connection_name AS storage_connection_name
            FROM {_q(schema, _REGISTRY_TABLE)} r
            LEFT JOIN {_q(schema, "batch_jobs")} j ON r.batch_job_id = j.batch_job_id
            LEFT JOIN {_q(schema, "batch_folder_connections")} c ON j.folder_connection_id = c.folder_connection_id
            LEFT JOIN {_q(schema, "etl_storage_connections")} sc ON r.storage_connection_id = sc.storage_connection_id AND sc.is_active = TRUE
            WHERE j.etl_table_id IS NULL
            ORDER BY r.updated_at DESC
            """
        )
        rows = cur.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


def upsert_batch_target_registry(
    target_table: str, storage_connection_id: Optional[int], batch_job_id: int, conn=None
) -> int:
    """
    (target_table, storage_connection_id)에 해당하는 레지스트리 행이 있으면 batch_job_id만 UPDATE, 없으면 INSERT.
    동일 타겟으로 새 배치 Job 생성 시 기존 ETL 목록 행을 갱신하기 위함. 반환: registry id.
    conn 이 주어지면 해당 연결을 사용하고 닫지 않음(호출자가 소유). 없으면 새 연결 후 finally에서 close.
    """
    target_table = (target_table or "").strip()
    if not target_table:
        raise ValueError("target_table이 비어 있습니다.")
    api_db = _get_db()
    schema = _schema()
    own_conn = conn is None
    if conn is None:
        conn = api_db.get_db_connection_system()
    _ensure_batch_target_registry_table(conn)
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT id FROM {_q(schema, _REGISTRY_TABLE)}
            WHERE target_table = %s AND (storage_connection_id IS NOT DISTINCT FROM %s)
            """,
            (target_table, storage_connection_id),
        )
        row = cur.fetchone()
        if row:
            rid = row["id"] if hasattr(row, "get") else row[0]
            cur.execute(
                f"UPDATE {_q(schema, _REGISTRY_TABLE)} SET batch_job_id = %s, updated_at = NOW() WHERE id = %s",
                (batch_job_id, rid),
            )
            conn.commit()
            return int(rid)
        cur.execute(
            f"""
            INSERT INTO {_q(schema, _REGISTRY_TABLE)} (target_table, storage_connection_id, batch_job_id)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (target_table, storage_connection_id, batch_job_id),
        )
        r = cur.fetchone()
        conn.commit()
        return int(r["id"] if hasattr(r, "get") else r[0])
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if own_conn:
            conn.close()


def clear_batch_job_from_registry(batch_job_id: int) -> None:
    """배치 Job 삭제 시 레지스트리에서 해당 batch_job_id만 NULL로 둠. 행은 유지(ETL 목록에 테이블 관리용으로 계속 표시)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    _ensure_batch_target_registry_table(conn)
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE {_q(schema, _REGISTRY_TABLE)} SET batch_job_id = NULL, updated_at = NOW() WHERE batch_job_id = %s",
            (batch_job_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def delete_batch_target_registry_and_drop_table(registry_id: int) -> None:
    """
    ETL 목록에서 "배치 유래 행" 삭제 시: 연결된 배치 Job이 있으면 먼저 삭제(cascade),
    해당 스토리지 연결에서 타겟 테이블 DROP 후 레지스트리 행 삭제. conn 1개로 SELECT·DELETE 수행.
    """
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    try:
        _ensure_batch_target_registry_table(conn)
        cur = conn.cursor()
        try:
            cur.execute(
                f"SELECT target_table, storage_connection_id, batch_job_id FROM {_q(schema, _REGISTRY_TABLE)} WHERE id = %s",
                (registry_id,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"레지스트리 행을 찾을 수 없습니다: id={registry_id}")
            target_table = (row.get("target_table") if hasattr(row, "get") else row[0]) or ""
            storage_connection_id = row.get("storage_connection_id") if hasattr(row, "get") else row[1]
            batch_job_id = row.get("batch_job_id") if hasattr(row, "get") else row[2]
        finally:
            cur.close()

        if batch_job_id is not None:
            try:
                from Backend.etl_server import scheduler_file as sched
                sched.remove_job(int(batch_job_id))
            except Exception as e:
                logger.debug("스케줄러 제거 스킵(batch_job_id=%s): %s", batch_job_id, e)
            try:
                delete_batch_job(int(batch_job_id))
            except Exception as e:
                logger.warning("배치 Job cascade 삭제 실패(batch_job_id=%s), 테이블·레지스트리 삭제는 계속 진행: %s", batch_job_id, e)

        target_table = (target_table or "").strip()
        if target_table and isinstance(target_table, str) and len(target_table) <= 200:
            if re.match(r"^[a-zA-Z0-9_]+$", target_table):
                conn_main, main_schema = etl_service.get_target_db_connection(storage_connection_id)
                cur_main = conn_main.cursor()
                try:
                    full_name = f'"{main_schema}"."{target_table}"'
                    cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                    conn_main.commit()
                finally:
                    cur_main.close()
                    conn_main.close()

        cur = conn.cursor()
        try:
            cur.execute(f"DELETE FROM {_q(schema, _REGISTRY_TABLE)} WHERE id = %s", (registry_id,))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        conn.close()


def try_claim_batch_job_for_run(batch_job_id: int, conn: Any) -> bool:
    """
    배치 실행권 선점. batch_jobs 행을 FOR UPDATE로 잠근 뒤 last_run_status가 이미 'running'이면 False,
    아니면 last_run_status='running', last_run_at=NOW() 갱신 후 True 반환.
    호출 전 conn은 트랜잭션 미시작. 중복 실행(스케줄러·run_now 동시 진입) 방지용.
    """
    schema = _schema()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT batch_job_id, last_run_status
            FROM {_q(schema, "batch_jobs")}
            WHERE batch_job_id = %s
            FOR UPDATE
            """,
            (batch_job_id,),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return False
        last = (row.get("last_run_status") or "") if hasattr(row, "get") else (row[1] if len(row) > 1 else "")
        if (last or "").strip().lower() == "running":
            conn.rollback()
            return False
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_jobs")}
            SET last_run_at = NOW(), last_run_status = 'running', updated_at = NOW()
            WHERE batch_job_id = %s
            """,
            (batch_job_id,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


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


def update_run_progress(
    run_id: int,
    *,
    files_processed: int = 0,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    file_list: Optional[List[dict]] = None,
    conn: Any = None,
) -> None:
    """실행 중 진행 상황 갱신. status=running인 run만 갱신(상세 화면 실시간 반영용)."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_run_history")}
            SET files_processed = %s, rows_inserted = %s, rows_updated = %s, file_list = %s
            WHERE run_id = %s AND status = 'running'
            """,
            (
                files_processed,
                rows_inserted,
                rows_updated,
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


def mark_stuck_runs_finished(batch_job_id: int, conn: Any = None) -> int:
    """해당 배치의 status='running'인 이력을 모두 'error'로 마감. 비활성화 시 stuck run 정리용. 갱신된 행 수 반환."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_run_history")}
            SET finished_at = NOW(), status = 'error', error_message = COALESCE(error_message, '실행 중단(비활성화)')
            WHERE batch_job_id = %s AND status = 'running'
            """,
            (batch_job_id,),
        )
        n = cur.rowcount
        conn.commit()
        return n
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if should_close:
            conn.close()


def force_finish_run_as_cancelled(run_id: int, conn: Any = None) -> Optional[int]:
    """stuck된 run을 즉시 cancelled로 마감하고 batch_jobs.last_run_status를 해제. 실행 취소 시 재실행 가능하도록.
    해당 run의 batch_job_id 반환(갱신된 경우), 없으면 None."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_run_history")}
            SET finished_at = NOW(), status = 'cancelled', error_message = COALESCE(error_message, '사용자 취소')
            WHERE run_id = %s AND status = 'running'
            RETURNING batch_job_id
            """,
            (run_id,),
        )
        row = cur.fetchone()
        batch_job_id = row["batch_job_id"] if row else None
        if batch_job_id is not None:
            cur.execute(
                f"""
                UPDATE {_q(schema, "batch_jobs")}
                SET last_run_status = NULL, last_error_message = NULL, updated_at = NOW()
                WHERE batch_job_id = %s
                """,
                (batch_job_id,),
            )
        conn.commit()
        return batch_job_id
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


def get_last_processed_ts(batch_job_id: int, conn: Any = None) -> Optional[str]:
    """batch_jobs.last_processed_ts 현재값 조회. run 생성 전 pending 이중 필터용. 빈 문자열이면 None 반환."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT last_processed_ts FROM {_q(schema, 'batch_jobs')} WHERE batch_job_id = %s",
            (batch_job_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        val = row.get("last_processed_ts") if hasattr(row, "get") else row[0]
        if val is None:
            return None
        # datetime 객체면 14자리 형식으로 변환 (get_pending_files 비교 포맷과 일치)
        if hasattr(val, "strftime"):
            return val.strftime("%Y%m%d%H%M%S")
        s = (val if isinstance(val, str) else str(val)).strip()
        if not s:
            return None
        # "2026-03-06 10:00:01" 등 ISO/DB 형식이면 14자리로 변환
        if "-" in s or ":" in s:
            try:
                from datetime import datetime as _dt
                s_clean = s.split("+")[0].split("Z")[0].strip()
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
                    try:
                        parsed = _dt.strptime(s_clean, fmt)
                        return parsed.strftime("%Y%m%d%H%M%S")
                    except ValueError:
                        continue
            except Exception:
                pass
        return s
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


def update_last_synced_at_db_batch(batch_job_id: int, synced_at: Any, conn: Any = None) -> None:
    """DB 배치: batch_jobs.last_synced_at 갱신. synced_at은 datetime 또는 pd.Timestamp. conn 전달 시 호출부가 커넥션 관리."""
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "batch_jobs")}
            SET last_synced_at = %s, updated_at = NOW()
            WHERE batch_job_id = %s
            """,
            (synced_at, batch_job_id),
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
        from Backend.etl_server import scheduler_file as sched_mod
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


def list_skipped_files_history(batch_job_id: int, conn: Any = None, limit: int = 200) -> List[dict]:
    """
    배치 Job의 실행 이력에서 status가 skipped/error인 파일 전부 반환 (동일 파일명 여러 run 포함).
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
            started_at = d.get("started_at")
            run_started_at = started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at) if started_at else ""
            for item in file_list:
                if not isinstance(item, dict):
                    continue
                st = (item.get("status") or "").strip().lower()
                if st not in ("skipped", "error"):
                    continue
                fname = (item.get("filename") or "").strip()
                if not fname:
                    continue
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


def get_skipped_filenames_set(
    batch_job_id: int, conn: Any = None, max_runs: int = 200
) -> Set[str]:
    """
    이력에서 status가 skipped 또는 error인 파일명 집합 반환.
    pending에서 제외해 이미 스킵/에러된 파일을 매 주기 재시도하지 않도록 할 때 사용 (§7.7).
    """
    schema = _schema()
    should_close = conn is None
    if conn is None:
        conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    result: Set[str] = set()
    try:
        cur.execute(
            f"""
            SELECT r.file_list
            FROM {_q(schema, "batch_run_history")} r
            WHERE r.batch_job_id = %s
              AND r.file_list IS NOT NULL
            ORDER BY r.started_at DESC
            LIMIT %s
            """,
            (batch_job_id, max_runs),
        )
        for row in cur.fetchall():
            file_list = row[0] if not hasattr(row, "keys") else row.get("file_list")
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
                if fname:
                    result.add(fname)
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
    target_conn, target_schema = etl_service.get_target_db_connection(storage_connection_id)
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
