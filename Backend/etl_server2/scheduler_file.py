"""
Backend.etl_server2.scheduler_file (배치 스케줄러)
================================================
09_ETL_SFTP_Connection §5. APScheduler로 주기적 배치 실행.
start_scheduler, load_active_batch_jobs, add_job, remove_job, reschedule_job, run_now.

[Main Functions]
===========
- get_scheduler: lazy 초기화 (멀티 워커 시 import 시점 단일 인스턴스 방지). SCHEDULER_ENABLED=false 시 start_scheduler no-op.
- add_job: 배치 1건 등록 (interval, next_run_time 10초 후)
- remove_job: 배치 1건 제거
- reschedule_job: 주기(interval_minutes) 변경
- run_now: 즉시 1회 실행

[Dependencies]
=========
- apscheduler (BackgroundScheduler, ThreadPoolExecutor)
- Backend.etl_server2.service_file (list_batch_jobs, get_batch_job)
- Backend.etl_server2.batch_executor_file (run_batch_job)
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

_scheduler: Optional[BackgroundScheduler] = None


def get_scheduler() -> BackgroundScheduler:
    """Lazy 초기화. 멀티 워커 환경에서 모듈 import 시점 인스턴스 생성을 피함 (§2.4)."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            executors={"default": ThreadPoolExecutor(max_workers=3)},
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 300,
            },
        )
    return _scheduler


def start_scheduler() -> None:
    """스케줄러 시작. SCHEDULER_ENABLED=false면 no-op (단일 프로세스에서만 스케줄러 기동 권장)."""
    if os.environ.get("SCHEDULER_ENABLED", "true").strip().lower() == "false":
        logger.info("SCHEDULER_ENABLED=false, batch file scheduler disabled")
        return
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("batch file scheduler started")


def load_active_batch_jobs() -> None:
    """DB에서 is_active=True 배치 목록 조회 후 스케줄러에 등록."""
    from Backend.etl_server2 import service_file as batch_service

    jobs = batch_service.list_batch_jobs(is_active=True)
    for job in jobs:
        add_job(job)
    logger.info("loaded %d active batch jobs into scheduler", len(jobs))


def add_job(job: dict) -> None:
    """배치 1건 스케줄러에 등록. job은 get_batch_job/list_batch_jobs 항목."""
    from Backend.etl_server2 import batch_executor_file

    batch_job_id = job["batch_job_id"]
    interval_minutes = job.get("interval_minutes") or 10
    job_id = f"batch_{batch_job_id}"
    get_scheduler().add_job(
        batch_executor_file.run_batch_job,
        trigger="interval",
        minutes=interval_minutes,
        id=job_id,
        args=[batch_job_id],
        replace_existing=True,
        next_run_time=datetime.now() + timedelta(seconds=10),
    )
    logger.debug("scheduler add_job batch_%s interval=%s min", batch_job_id, interval_minutes)


def remove_job(batch_job_id: int) -> None:
    """스케줄러에서 배치 제거."""
    job_id = f"batch_{batch_job_id}"
    try:
        get_scheduler().remove_job(job_id)
        logger.debug("scheduler remove_job %s", job_id)
    except Exception as e:
        logger.warning("scheduler remove_job %s: %s", job_id, e)


def reschedule_job(batch_job_id: int, interval_minutes: int) -> None:
    """배치 주기 변경."""
    from apscheduler.triggers.interval import IntervalTrigger

    job_id = f"batch_{batch_job_id}"
    get_scheduler().reschedule_job(job_id, trigger=IntervalTrigger(minutes=interval_minutes))
    logger.debug("scheduler reschedule_job %s interval=%s min", job_id, interval_minutes)


def run_now(batch_job_id: int) -> None:
    """즉시 1회 실행. add_job with next_run_time=now (replace_existing)."""
    from Backend.etl_server2 import batch_executor_file
    from Backend.etl_server2 import service_file as batch_service

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("run_now: batch_job_id=%s not found", batch_job_id)
        return
    job_id = f"batch_{batch_job_id}"
    get_scheduler().add_job(
        batch_executor_file.run_batch_job,
        trigger="interval",
        minutes=job.get("interval_minutes") or 10,
        id=job_id,
        args=[batch_job_id],
        replace_existing=True,
        next_run_time=datetime.now(),
    )
    logger.info("scheduler run_now batch_%s", batch_job_id)
