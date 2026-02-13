"""
Backend.etl_server.queue_worker (Phase 6 Job 큐 워커)
=====================================================
pending Job을 순차 수거해 run_file_load / run_db_load 실행. 동시 실행 수 제한.

[Main Functions]
===========
- run_worker_iteration: running 수 < MAX_CONCURRENT 인 만큼 pending 조회 후 1건씩 실행
- start_background_worker: 백그라운드 스레드로 주기적 iteration 실행 (앱 기동 시 1회 호출)

[Dependencies]
=========
- Backend.etl_server.service, load_service, db_load_service
"""

import logging
import threading
import time

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 2
POLL_INTERVAL_SEC = 2
_worker_started = False
_worker_lock = threading.Lock()
_etl_tables_missing_logged = False


def _run_one_job(job_id: int, etl_table_id: int) -> None:
    """Job 1건 실행. 파일/DB 분기 후 load_service 또는 db_load_service 호출."""
    from Backend.etl_server import db_load_service
    from Backend.etl_server import load_service
    from Backend.etl_server import service as etl_service

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        etl_service.update_job(job_id, "failed", error_message="ETL 테이블을 찾을 수 없습니다.")
        return
    source_type = (row.get("source_type") or "").strip().lower()
    try:
        if source_type == "file" and row.get("file_path") and row.get("file_type"):
            load_service.run_file_load(etl_table_id, job_id=job_id)
        elif source_type == "postgresql" and row.get("connection_id") and row.get("source_table"):
            db_load_service.run_db_load(etl_table_id, job_id=job_id)
        else:
            etl_service.update_job(
                job_id, "failed",
                error_message="실행할 수 있는 ETL 유형이 아닙니다. (파일: file_path+file_type, DB: postgresql+source_table)",
            )
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        logger.exception("ETL job %s failed: %s", job_id, e)


def run_worker_iteration() -> None:
    """running 수가 MAX_CONCURRENT 미만인 만큼 pending Job을 1건씩 선점(claim) 후 실행. 경쟁 방지."""
    from Backend.etl_server import service as etl_service

    running = etl_service.count_running_jobs()
    if running >= MAX_CONCURRENT:
        return
    take = MAX_CONCURRENT - running
    for _ in range(take):
        claimed = etl_service.claim_next_pending_job()
        if not claimed:
            break
        job_id, etl_table_id = claimed[0], claimed[1]
        if etl_table_id is None:
            etl_service.update_job(job_id, "failed", error_message="etl_table_id가 없습니다.")
            continue
        _run_one_job(job_id, etl_table_id)


def _worker_loop() -> None:
    global _etl_tables_missing_logged
    while True:
        try:
            run_worker_iteration()
        except Exception as e:
            err_msg = str(e)
            if "does not exist" in err_msg and not _etl_tables_missing_logged:
                _etl_tables_missing_logged = True
                logger.warning(
                    "ETL meta tables (e.g. etl_jobs) not found in system_db. "
                    "Create them to enable the queue. Worker idle."
                )
            else:
                logger.exception("ETL worker iteration error: %s", e)
        time.sleep(POLL_INTERVAL_SEC)


def start_background_worker() -> None:
    """백그라운드 스레드로 워커 기동. 앱 startup에서 1회 호출."""
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        t = threading.Thread(target=_worker_loop, daemon=True, name="etl_queue_worker")
        t.start()
        _worker_started = True
        logger.info("ETL queue worker started (max_concurrent=%s, poll_interval=%ss)", MAX_CONCURRENT, POLL_INTERVAL_SEC)
