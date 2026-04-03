"""
Backend.etl_server.batch_executor_file (배치 실행기 — 다운로드·파싱·적재)
============================================================================
09_ETL_SFTP_Connection §4.3, §7.5, §7.7, §10. 스케줄러에서 호출.
실제 흐름: get_batch_job → 폴더 어댑터 → list_files → get_pending_files →
대기 있으면 get_skipped_filenames_set로 이력 스킵/에러 파일 제외 후 실제 처리할 파일이 있을 때만 create_batch_run → 저장 DB 연결 →
파일별 다운로드(임시) → 크기 검사 → SHA-256 체크섬 → 중복 시 건너뜀(이때도 last_processed_ts 갱신하여 다음 주기 재진입 방지)
→ read_file → etl_table_id 있으면 transform_rules + apply_rules( batch_executor_db와 동일 정책: 실패 시 warning 후 skip ) → load_dataframe → last_processed_ts 갱신 → finish_run, update_job_status. finally adapter.close().
on_file_error=continue 시 파일 1건 예외 시 해당 파일만 error 기록·롤백 후 다음 파일 계속; 종료 시 partial_error/success.

[Main Functions]
===========
- run_batch_job(batch_job_id): 배치 1건 실행. batch_jobs에 target_table 없고 etl_table_id만 있으면 etl_tables에서 타겟·column_mapping 보완. run_completed_ok 플래그로 성공/취소 후 update_job_status("success") 실패 시 except에서 "error"로 덮어쓰지 않음.

[Dependencies]
=========
- Backend.etl_server.service_file (get_batch_job, create_batch_run, finish_run, update_run_progress, update_job_status, get_last_processed_ts, update_last_processed_ts, is_duplicate_checksum, check_consecutive_failures, get_skipped_filenames_set, get_folder_adapter)
- Backend.etl_server.scheduler_file (refresh_interval_after_run)
- Backend.etl_server.parser_file (get_pending_files, read_file)
- Backend.etl_server.transform_rules_service, transform_engine (etl_table_id 배치 시 룰 적용)
- Backend.etl_server.service (get_target_db_connection)
- Backend.etl_server.load_service_file (load_dataframe)
- Backend.etl_server.etl_limits (get_etl_limits)
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
    from Backend.etl_server import service_file as batch_service
    last_exc = None
    for attempt in range(retries):
        try:
            return batch_service.get_folder_adapter(folder_connection_id)
        except Exception as e:
            last_exc = e
            if attempt == retries - 1:
                break
            wait = 2 ** (attempt + 1)
            logger.warning("file_batch folder_connect_retry attempt=%d/%d wait_s=%d err=%s", attempt + 1, retries, wait, e)
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
        if prev_size is not None and prev_size >= 0 and curr_size == prev_size:
            return
        prev_size = curr_size
        if i < checks - 1:
            time.sleep(interval)
    logger.warning("file_batch stable_size_timeout file=%s", filename)


def run_batch_job(batch_job_id: int) -> None:
    """
    배치 Job 1건 실행. 스케줄러에서 호출.
    Job 조회 → 활성/실행중 검사 → 폴더 어댑터 연결 → list_files → get_pending_files →
    대기 없거나 스킵/에러 제외 후 실제 처리할 파일 없으면 run 기록 없이 return. 있으면 create_batch_run → status=running →
    저장 DB 연결 후 파일별: 다운로드(임시) → 크기 검사 → read_file → (etl_table_id 시 변환 룰) → load_dataframe →
    last_processed_ts 갱신 → finish_run(success), update_job_status(success).
    예외 시 finish_run(error). finally adapter.close().
    """
    from Backend.etl_server import service_file as batch_service
    from Backend.etl_server import parser_file
    from Backend.etl_server import service as etl_service
    from Backend.etl_server import load_service_file
    from Backend.etl_server.etl_limits import get_etl_limits

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("file_batch_job missing job_id=%s", batch_job_id)
        return
    if not job.get("is_active"):
        return
    if (job.get("last_run_status") or "").strip().lower() == "running":
        logger.warning("file_batch_job skip already_running job_id=%s", batch_job_id)
        return

    run_id = None
    adapter = None
    target_conn = None
    sys_conn = None
    run_completed_ok = False  # True after finish_run(success/partial_error); avoid overwriting to "error" if update_job_status("success") fails

    try:
        from Backend.core import db as api_db
        sys_conn = api_db.get_db_connection_system()
        fresh_lp = batch_service.get_last_processed_ts(batch_job_id, conn=sys_conn)

        adapter = _connect_with_retry(job["folder_connection_id"])
        all_files = adapter.list_files()
        pending = parser_file.get_pending_files(
            all_files,
            job.get("file_pattern") or "",
            job.get("file_extensions") or "csv,xlsx,xls,parquet",
            fresh_lp,
        )

        if not pending:
            batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
            try:
                from Backend.etl_server import scheduler_file as sched_mod
                sched_mod.refresh_interval_after_run(batch_job_id)
            except Exception:
                pass
            return

        # 이력에 이미 skipped/error로 기록된 파일은 매 주기 재시도하지 않음 (§7.7). run 생성 전에 제외해, 실제 처리할 파일이 없으면 run 기록 없이 return.
        skipped_filenames = batch_service.get_skipped_filenames_set(batch_job_id, conn=sys_conn)
        if skipped_filenames:
            pending = [(f, ts) for f, ts in pending if f not in skipped_filenames]
        if not pending:
            batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
            try:
                from Backend.etl_server import scheduler_file as sched_mod
                sched_mod.refresh_interval_after_run(batch_job_id)
            except Exception:
                pass
            return

        # 중복 실행 방지: FOR UPDATE로 선점 후 running 갱신. 스케줄러·run_now 동시 진입 시 한 쪽만 진행.
        if not batch_service.try_claim_batch_job_for_run(batch_job_id, sys_conn):
            logger.warning("file_batch_job skip claimed_by_other job_id=%s", batch_job_id)
            return
        run_id = batch_service.create_batch_run(batch_job_id, conn=sys_conn)

        target_conn, target_schema = etl_service.get_target_db_connection(
            job.get("storage_connection_id")
        )
        max_file_mb, max_rows_per_load, _ = get_etl_limits()
        max_rows = int(max_rows_per_load) if max_rows_per_load and max_rows_per_load > 0 else None

        total_ins = 0
        total_upd = 0
        file_results = []
        job_folder_type = (job.get("folder_type") or "").strip().lower()
        etl_tid = job.get("etl_table_id")
        et_row_cache = None
        if etl_tid is not None:
            try:
                et_row_cache = etl_service.get_etl_table(int(etl_tid))
            except (TypeError, ValueError):
                et_row_cache = None
        target_table = (job.get("target_table") or "").strip()
        if not target_table and et_row_cache:
            target_table = (et_row_cache.get("target_table") or "").strip()
        pk_columns_str = (job.get("pk_columns") or "").strip() or None
        if not pk_columns_str and et_row_cache and et_row_cache.get("pk_columns"):
            pk_columns_str = str(et_row_cache.get("pk_columns")).strip() or None
        column_mapping = job.get("column_mapping")
        if column_mapping is None and et_row_cache:
            column_mapping = et_row_cache.get("column_mapping")
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
                run_completed_ok = True
                batch_service.update_job_status(batch_job_id, "success", conn=sys_conn)
                logger.warning("file_batch_job cancelled run_id=%s files_done=%s", run_id, len(file_results))
                return

            local_path = None
            try:
                if job_folder_type == "sftp":
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
                        "timestamp": ts,
                        "status": "skipped",
                        "reason": "duplicate_checksum",
                    })
                    batch_service.update_last_processed_ts(batch_job_id, ts, conn=sys_conn)
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

                if etl_tid is not None:
                    try:
                        from Backend.etl_server import transform_engine
                        from Backend.etl_server import transform_rules_service as transform_rules_svc
                        rules = transform_rules_svc.list_transform_rules(int(etl_tid))
                        if rules:
                            df = transform_engine.apply_rules(df, rules)
                    except Exception as e:
                        logger.warning("file_batch_job transform_rules_skip job_id=%s: %s", batch_job_id, e)

                try:
                    _stor_id = job.get("storage_connection_id")
                    _stor_id = int(_stor_id) if _stor_id is not None and str(_stor_id).strip() != "" else None
                except (TypeError, ValueError):
                    _stor_id = None
                try:
                    _batch_creator = job.get("create_user_id")
                    _batch_creator = int(_batch_creator) if _batch_creator is not None else None
                except (TypeError, ValueError):
                    _batch_creator = None
                from Backend.etl_server.table_master_hook import table_master_texts_from_etl_row

                _tl, _td = table_master_texts_from_etl_row(et_row_cache)
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
                    storage_connection_id=_stor_id,
                    table_master_create_user_id=_batch_creator,
                    table_master_table_label=_tl,
                    table_master_table_dscrtn=_td,
                )
                try:
                    target_conn.commit()
                except Exception as commit_err:
                    logger.exception("file_batch_job commit_fail file=%s", filename)
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
                        logger.exception("file_batch_job check_consecutive_failures")
                    try:
                        from Backend.etl_server import scheduler_file as sched_mod
                        sched_mod.refresh_interval_after_run(batch_job_id)
                    except Exception:
                        pass
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
                logger.exception("file_batch_job file_fail name=%s", filename)
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
                    logger.exception("file_batch_job check_consecutive_failures")
                try:
                    from Backend.etl_server import scheduler_file as sched_mod
                    sched_mod.refresh_interval_after_run(batch_job_id)
                except Exception:
                    pass
                return
            finally:
                if local_path and os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                    except OSError as oe:
                        logger.warning("file_batch_job temp_remove_fail path=%s: %s", local_path, oe)
            batch_service.update_run_progress(
                run_id,
                files_processed=len(file_results),
                rows_inserted=total_ins,
                rows_updated=total_upd,
                file_list=file_results,
                conn=sys_conn,
            )

        has_file_errors = any((r.get("status") or "").strip().lower() == "error" for r in file_results)
        all_skipped = all((r.get("status") or "").strip().lower() == "skipped" for r in file_results) if file_results else False
        if all_skipped:
            run_status = "skipped"
        elif has_file_errors:
            run_status = "partial_error"
        else:
            run_status = "success"
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
        run_completed_ok = True  # run finished success/partial_error; do not overwrite to "error" if update_job_status below fails
        job_status = "success" if run_status == "success" else run_status
        batch_service.update_job_status(batch_job_id, job_status, conn=sys_conn)
        logger.info(
            "file_batch_job done job_id=%s status=%s files=%s ins=%s upd=%s",
            batch_job_id, job_status, len(file_results), total_ins, total_upd,
        )
        try:
            from Backend.etl_server import scheduler_file as sched_mod
            sched_mod.refresh_interval_after_run(batch_job_id)
        except Exception:
            pass

    except Exception as e:
        logger.exception("file_batch_job fail job_id=%s", batch_job_id)
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
                logger.exception("file_batch_job finish_run_recover_fail")
        if not run_completed_ok:
            try:
                batch_service.update_job_status(
                    batch_job_id,
                    "error",
                    last_error_message=str(e),
                    conn=sys_conn,
                )
            except Exception:
                logger.exception("file_batch_job update_job_status_recover_fail")
        if run_id is not None:
            batch_service.check_consecutive_failures(batch_job_id, threshold=5)
        try:
            from Backend.etl_server import scheduler_file as sched_mod
            sched_mod.refresh_interval_after_run(batch_job_id)
        except Exception:
            pass
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
