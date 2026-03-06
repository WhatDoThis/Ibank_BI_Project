"""
Backend.etl_server2.batch_executor_file (배치 실행기 — 다운로드·파싱·적재)
============================================================================
09_ETL_SFTP_Connection §4.3, §7.5, §7.7, §10. 스케줄러에서 호출.
실제 흐름: get_batch_job → 폴더 어댑터 → list_files → get_pending_files →
대기 없으면 run 기록 없이 return. 있으면 create_batch_run → 저장 DB 연결 →
파일별 다운로드(임시) → 크기 검사 → SHA-256 체크섬 → 중복 시 건너뜀
→ read_file → load_dataframe → last_processed_ts 갱신 → finish_run, update_job_status. finally adapter.close().
on_file_error=continue 시 파일 1건 예외 시 해당 파일만 error 기록·롤백 후 다음 파일 계속; 종료 시 partial_error/success.

[Main Functions]
===========
- run_batch_job(batch_job_id): 배치 1건 실행 (다운로드 → 체크섬 중복 검사 → 파싱 → 적재, 파일별 격리. on_file_error로 stop/continue)

[Dependencies]
=========
- Backend.etl_server2.service_file (get_batch_job, create_batch_run, finish_run, update_run_progress, update_job_status, update_last_processed_ts, is_duplicate_checksum, check_consecutive_failures, get_folder_adapter)
- Backend.etl_server2.parser_file (get_pending_files, read_file)
- Backend.etl_server2.load_service_file (get_target_connection, load_dataframe)
- Backend.etl_server2.etl_limits (get_etl_limits)
"""

import hashlib
import logging
import os
import tempfile
import time

logger = logging.getLogger(__name__)


def _compute_sha256(file_path: str, chunk_size: int = 8192) -> str:
    """파일 SHA-256 해시. 청크 단위 읽기로 대용량 파일 메모리 부담 완화 (§2.4)."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _connect_with_retry(folder_connection_id: int, retries: int = 3):
    """§7.4 폴더 어댑터 연결 exponential backoff 재시도 (2초, 4초, 8초)."""
    from Backend.etl_server2 import service_file as batch_service
    last_exc = None
    for attempt in range(retries):
        try:
            return batch_service.get_folder_adapter(folder_connection_id)
        except Exception as e:
            last_exc = e
            if attempt == retries - 1:
                break
            wait = 2 ** (attempt + 1)
            logger.warning(
                "폴더 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                attempt + 1, retries, wait, e,
            )
            time.sleep(wait)
    raise last_exc


def _wait_for_stable_size(adapter, filename: str, checks: int = 3, interval: int = 3) -> None:
    """SFTP 파일 크기가 안정될 때까지 대기. §7.8 stat → 대기 → 재조회, 동일하면 완료 (최대 checks회)."""
    if not hasattr(adapter, "sftp") or not hasattr(adapter, "remote_path"):
        return
    base = (adapter.remote_path or "/").rstrip("/") or ""
    path = f"/{filename}" if not base else f"{base}/{filename}"
    prev_size = None
    for i in range(checks):
        try:
            attr = adapter.sftp.stat(path)
            curr_size = attr.st_size
        except Exception:
            curr_size = -1
        if prev_size is not None and curr_size == prev_size and curr_size >= 0:
            return
        prev_size = curr_size
        if i < checks - 1:
            time.sleep(interval)
    logger.warning("파일 크기 안정화 대기 초과: %s", filename)


def run_batch_job(batch_job_id: int) -> None:
    """
    배치 Job 1건 실행. 스케줄러에서 호출.
    Job 조회 → 활성/실행중 검사 → 폴더 어댑터 연결 → list_files → get_pending_files →
    대기 파일 없으면 run 기록 없이 return. 있으면 create_batch_run → status=running →
    저장 DB 연결 후 파일별: 다운로드(임시) → 크기 검사 → read_file → load_dataframe →
    last_processed_ts 갱신 → finish_run(success), update_job_status(success).
    예외 시 finish_run(error). finally adapter.close().
    """
    from Backend.etl_server2 import service_file as batch_service
    from Backend.etl_server2 import parser_file
    from Backend.etl_server2 import load_service_file
    from Backend.etl_server2.etl_limits import get_etl_limits

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("run_batch_job: job_id=%s not found", batch_job_id)
        return
    if not job.get("is_active"):
        logger.debug("run_batch_job: job_id=%s is_active=False, skip", batch_job_id)
        return
    if (job.get("last_run_status") or "").strip().lower() == "running":
        logger.warning("run_batch_job: batch %s (job_type=file) already running (last_run_status=running), skip", batch_job_id)
        return

    run_id = None
    adapter = None
    target_conn = None
    sys_conn = None

    try:
        adapter = _connect_with_retry(job["folder_connection_id"])
        all_files = adapter.list_files()
        pending = parser_file.get_pending_files(
            all_files,
            job.get("file_pattern") or "",
            job.get("file_extensions") or "csv,xlsx,xls,parquet",
            job.get("last_processed_ts"),
        )

        if not pending:
            logger.debug("run_batch_job job_id=%s: no pending files, skip (run 기록 없음)", batch_job_id)
            return

        from Backend.api_server import db as api_db
        sys_conn = api_db.get_db_connection_system()
        run_id = batch_service.create_batch_run(batch_job_id, conn=sys_conn)
        batch_service.update_job_status(batch_job_id, "running", conn=sys_conn)

        target_conn, target_schema = load_service_file.get_target_connection(
            job["storage_connection_id"]
        )
        max_file_mb, max_rows_per_load, _ = get_etl_limits()
        max_rows = int(max_rows_per_load) if max_rows_per_load and max_rows_per_load > 0 else None

        total_ins = 0
        total_upd = 0
        file_results = []
        job_protocol = (job.get("protocol") or "").strip().lower()
        target_table = (job.get("target_table") or "").strip()
        pk_columns_str = (job.get("pk_columns") or "").strip() or None
        column_mapping = job.get("column_mapping")
        on_file_error = (job.get("on_file_error") or "stop").strip().lower()
        if on_file_error not in ("stop", "continue"):
            on_file_error = "stop"

        for filename, ts in pending:
            if batch_service.is_run_cancel_requested(run_id, conn=sys_conn):
                batch_service.finish_run(
                    run_id,
                    "cancelled",
                    files_processed=len(file_results),
                    rows_inserted=total_ins,
                    rows_updated=total_upd,
                    error_message="사용자 취소",
                    file_list=file_results,
                    conn=sys_conn,
                )
                batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
                logger.info("run_batch_job run_id=%s cancelled by user (이미 처리된 파일은 커밋 유지)", run_id)
                return

            local_path = None
            try:
                if job_protocol == "sftp":
                    _wait_for_stable_size(adapter, filename)

                ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}" if ext else "") as tmp:
                    local_path = tmp.name
                adapter.download_file(filename, local_path)

                if max_file_mb and max_file_mb > 0:
                    size_mb = os.path.getsize(local_path) / (1024 * 1024)
                    if size_mb > max_file_mb:
                        file_results.append({
                            "filename": filename,
                            "timestamp": ts,
                            "status": "skipped",
                            "reason": "file_size_exceeded",
                            "size_mb": round(size_mb, 2),
                            "limit_mb": max_file_mb,
                        })
                        batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)
                        batch_service.update_run_progress(run_id, files_processed=len(file_results), rows_inserted=total_ins, rows_updated=total_upd, file_list=file_results, conn=sys_conn)
                        continue

                checksum = _compute_sha256(local_path)
                if batch_service.is_duplicate_checksum(batch_job_id, checksum, conn=sys_conn):
                    file_results.append({
                        "filename": filename,
                        "status": "skipped",
                        "reason": "duplicate_checksum",
                    })
                    batch_service.update_run_progress(run_id, files_processed=len(file_results), rows_inserted=total_ins, rows_updated=total_upd, file_list=file_results, conn=sys_conn)
                    continue

                df = parser_file.read_file(local_path, ext, max_rows=max_rows)
                if df.empty:
                    file_results.append({
                        "filename": filename,
                        "timestamp": ts,
                        "status": "ok",
                        "rows": 0,
                        "inserted": 0,
                        "updated": 0,
                        "checksum": checksum,
                    })
                    batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)
                    batch_service.update_run_progress(run_id, files_processed=len(file_results), rows_inserted=total_ins, rows_updated=total_upd, file_list=file_results, conn=sys_conn)
                    continue

                result = load_service_file.load_dataframe(
                    target_conn,
                    target_schema,
                    target_table,
                    df,
                    pk_columns_str=pk_columns_str,
                    column_mapping=column_mapping,
                    batch_job_id=batch_job_id,
                    run_id=run_id,
                    source_filename=filename,
                    sys_conn=sys_conn,
                    index_definitions=job.get("index_definitions"),
                )
                try:
                    target_conn.commit()
                except Exception as commit_err:
                    logger.exception("run_batch_job commit failed for %s: %s", filename, commit_err)
                    if target_conn:
                        try:
                            target_conn.rollback()
                        except Exception:
                            pass
                    file_results.append({
                        "filename": filename,
                        "timestamp": ts,
                        "status": "error",
                        "error": str(commit_err),
                    })
                    batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)
                    if on_file_error == "continue":
                        batch_service.update_run_progress(run_id, files_processed=len(file_results), rows_inserted=total_ins, rows_updated=total_upd, file_list=file_results, conn=sys_conn)
                        continue
                    batch_service.finish_run(
                        run_id,
                        "error",
                        files_processed=len(file_results),
                        rows_inserted=total_ins,
                        rows_updated=total_upd,
                        error_message=str(commit_err),
                        file_list=file_results,
                        conn=sys_conn,
                    )
                    batch_service.update_job_status(batch_job_id, "error", last_error_message=str(commit_err), conn=sys_conn)
                    try:
                        batch_service.check_consecutive_failures(batch_job_id, threshold=5, conn=sys_conn)
                    except Exception:
                        logger.exception("check_consecutive_failures 실패")
                    return

                ins = result.get("inserted", 0) or 0
                upd = result.get("updated", 0) or 0
                total_ins += ins
                total_upd += upd
                file_results.append({
                    "filename": filename,
                    "timestamp": ts,
                    "status": "ok",
                    "rows": len(df),
                    "inserted": ins,
                    "updated": upd,
                    "checksum": checksum,
                })
                batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)

            except Exception as e:
                logger.exception("run_batch_job file %s: %s", filename, e)
                if target_conn:
                    try:
                        target_conn.rollback()
                    except Exception:
                        pass
                file_results.append({
                    "filename": filename,
                    "timestamp": ts,
                    "status": "error",
                    "error": str(e),
                })
                batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)
                if on_file_error == "continue":
                    batch_service.update_run_progress(run_id, files_processed=len(file_results), rows_inserted=total_ins, rows_updated=total_upd, file_list=file_results, conn=sys_conn)
                    continue
                batch_service.finish_run(
                    run_id,
                    "error",
                    files_processed=len(file_results),
                    rows_inserted=total_ins,
                    rows_updated=total_upd,
                    error_message=str(e),
                    file_list=file_results,
                    conn=sys_conn,
                )
                batch_service.update_job_status(batch_job_id, "error", last_error_message=str(e), conn=sys_conn)
                try:
                    batch_service.check_consecutive_failures(batch_job_id, threshold=5, conn=sys_conn)
                except Exception:
                    logger.exception("check_consecutive_failures 실패")
                return
            finally:
                if local_path and os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                    except OSError as oe:
                        logger.warning("run_batch_job temp file remove %s: %s", local_path, oe)
            batch_service.update_run_progress(
                run_id,
                files_processed=len(file_results),
                rows_inserted=total_ins,
                rows_updated=total_upd,
                file_list=file_results,
                conn=sys_conn,
            )

        has_file_errors = any((r.get("status") or "").strip().lower() == "error" for r in file_results)
        run_status = "partial_error" if has_file_errors else "success"
        batch_service.finish_run(
            run_id,
            run_status,
            files_processed=len(file_results),
            rows_inserted=total_ins,
            rows_updated=total_upd,
            error_message=None if not has_file_errors else f"파일 {sum(1 for r in file_results if (r.get('status') or '').strip().lower() == 'error')}건 실패",
            file_list=file_results,
            conn=sys_conn,
        )
        batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)

    except Exception as e:
        logger.exception("run_batch_job job_id=%s error: %s", batch_job_id, e)
        if run_id is not None:
            try:
                batch_service.finish_run(
                    run_id,
                    "error",
                    files_processed=0,
                    error_message=str(e),
                    conn=sys_conn,
                )
            except Exception:
                logger.exception("finish_run 복구 실패")
        try:
            batch_service.update_job_status(
                batch_job_id,
                "error",
                last_error_message=str(e),
                conn=sys_conn,
            )
        except Exception:
            logger.exception("update_job_status 복구 실패")
        if run_id is not None:
            batch_service.check_consecutive_failures(batch_job_id, threshold=5)
    finally:
        if sys_conn:
            try:
                sys_conn.close()
            except Exception:
                pass
        if target_conn:
            try:
                target_conn.close()
            except Exception:
                pass
        if adapter:
            try:
                adapter.close()
            except Exception:
                pass
