"""
Backend.etl_server2.queue_worker (Job 큐 워커)
==============================================
pending Job을 선점(claim)해 run_file_load / run_db_load / run_file_upsert 실행. 동시 실행 수 제한(MAX_CONCURRENT).

- claim_next_pending_job(service): SELECT FOR UPDATE SKIP LOCKED 후 즉시 status='running' UPDATE → 과다 claim 방지.
- run_worker_iteration: running 수 < MAX_CONCURRENT인 만큼 claim 후 ThreadPoolExecutor에 제출 → 최대 MAX_CONCURRENT건 동시 실행.
- _worker_loop: 무한 루프에서 run_worker_iteration 주기 실행(POLL_INTERVAL_SEC). _shutdown_requested 시 종료.
- stop_background_worker: 앱 shutdown 시 호출 권장. 실행 중 Job 대기 후 풀 종료.

[Main Functions]
===========
- _run_one_job: Job 1건 실행. 파일/DB 분기 후 load_service 또는 db_load_service 호출. 예외 시에도 status failed 갱신(running 좀비 방지)
- run_worker_iteration: running 수 < MAX_CONCURRENT인 만큼 claim 후 스레드 풀에 제출
- _worker_loop: run_worker_iteration 주기 호출(POLL_INTERVAL_SEC), 예외 시 로그
- start_background_worker: 백그라운드 스레드 + 스레드 풀 생성(앱 startup에서 1회)
- stop_background_worker: 스레드 풀 shutdown(wait=True), 워커 루프 중단(앱 shutdown 훅에서 호출 권장)

[Dependencies]
=========
- Backend.etl_server2.service, load_service, db_load_service
- concurrent.futures.ThreadPoolExecutor
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import psycopg2

from Backend.etl_server2 import db_load_service
from Backend.etl_server2 import load_service
from Backend.etl_server2 import service as etl_service

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 3
POLL_INTERVAL_SEC = 2
_worker_started = False
_worker_lock = threading.Lock()
_executor: Optional[ThreadPoolExecutor] = None
_shutdown_requested = False
_etl_tables_missing_logged = False
_last_conn_error_log = 0.0
_CONN_ERROR_LOG_INTERVAL_SEC = 60


def _run_one_job(job_id: int, etl_table_id: int) -> None:
    """Job 1건 실행. 파일/DB 분기 후 load_service 또는 db_load_service 호출. 예외 시에도 status를 failed로 갱신해 running 좀비 방지."""
    try:
        row = etl_service.get_etl_table(etl_table_id)
        if not row:
            etl_service.update_job(job_id, "failed", error_message="ETL 테이블을 찾을 수 없습니다.")
            return
        source_type = (row.get("source_type") or "").strip().lower()
        job_row = etl_service.get_job(job_id)
        is_add_file = job_row and (job_row.get("add_file_path") or "").strip() and (job_row.get("add_file_type") or "").strip()
        try:
            if source_type == "file" and is_add_file:
                load_service.run_file_upsert(etl_table_id, job_id)
            elif source_type == "file" and row.get("file_path") and row.get("file_type"):
                load_service.run_file_load(etl_table_id, job_id=job_id)
            elif source_type in ("postgresql", "mysql", "oracle") and row.get("connection_id") and row.get("source_table"):
                db_load_service.run_db_load(etl_table_id, job_id=job_id)
            else:
                etl_service.update_job(
                    job_id, "failed",
                    error_message="실행할 수 있는 ETL 유형이 아닙니다. (파일: file_path+file_type, DB: postgresql/mysql/oracle+source_table)",
                )
        except Exception as e:
            etl_service.update_job(job_id, "failed", error_message=str(e))
            etl_service.update_etl_table_status(etl_table_id, "error")
            logger.exception("ETL job %s failed: %s", job_id, e)
    except Exception as e:
        try:
            etl_service.update_job(job_id, "failed", error_message=str(e))
            if etl_table_id is not None:
                etl_service.update_etl_table_status(etl_table_id, "error")
        except Exception:
            logger.exception("Failed to update job %s status after error", job_id)
        logger.exception("ETL job %s failed (before/outside load): %s", job_id, e)


def run_worker_iteration() -> None:
    """running 수가 MAX_CONCURRENT 미만인 만큼 pending Job을 1건씩 선점(claim) 후 스레드 풀에 제출. 최대 MAX_CONCURRENT건 동시 실행."""
    global _executor
    if _executor is None or _shutdown_requested:
        return
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
        _executor.submit(_run_one_job, job_id, etl_table_id)


def _worker_loop() -> None:
    global _etl_tables_missing_logged, _last_conn_error_log
    while not _shutdown_requested:
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
            elif isinstance(e, psycopg2.OperationalError) and (
                "connection" in err_msg.lower() or "network" in err_msg.lower()
            ):
                now = time.time()
                if now - _last_conn_error_log >= _CONN_ERROR_LOG_INTERVAL_SEC:
                    logger.warning(
                        "ETL worker: DB connection unavailable (%s). Next log in %ds.",
                        err_msg.split("\n")[0].strip(),
                        _CONN_ERROR_LOG_INTERVAL_SEC,
                    )
                    _last_conn_error_log = now
            else:
                logger.exception("ETL worker iteration error: %s", e)
        time.sleep(POLL_INTERVAL_SEC)


def start_background_worker() -> None:
    """백그라운드 스레드로 워커 기동 + 스레드 풀 생성. 앱 startup에서 1회 호출."""
    global _worker_started, _executor, _shutdown_requested
    with _worker_lock:
        if _worker_started:
            return
        _shutdown_requested = False
        _executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT, thread_name_prefix="etl_job")
        t = threading.Thread(target=_worker_loop, daemon=True, name="etl_queue_worker")
        t.start()
        _worker_started = True
        logger.info("ETL queue worker started (max_concurrent=%s, poll_interval=%ss)", MAX_CONCURRENT, POLL_INTERVAL_SEC)


def stop_background_worker() -> None:
    """
    앱 shutdown 시 호출 권장. 실행 중인 Job 완료 대기(shutdown(wait=True)) 후 스레드 풀 종료, 워커 루프 중단.
    락은 최소한만 유지하고, shutdown 대기는 락 밖에서 수행해 워커 스레드가 _shutdown_requested를 곧바로 볼 수 있게 함.
    """
    global _executor, _worker_started, _shutdown_requested
    executor_to_shutdown = None
    with _worker_lock:
        _shutdown_requested = True
        if _executor is not None:
            executor_to_shutdown = _executor
            _executor = None
        _worker_started = False
    if executor_to_shutdown is not None:
        executor_to_shutdown.shutdown(wait=True)
    logger.info("ETL queue worker stopped")
