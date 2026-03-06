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
- run_now: 즉시 1회 실행. 이미 실행 중이면 스케줄하지 않고 {"already_running": True} 반환.

[Dependencies]
=========
- apscheduler (BackgroundScheduler, ThreadPoolExecutor)
- Backend.etl_server2.service_file (list_batch_jobs, get_batch_job)
- Backend.etl_server2.batch_executor_file (run_batch_job), Backend.etl_server2.batch_executor_db (run_db_batch_job)
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

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
    """배치 1건 스케줄러에 등록. job은 get_batch_job/list_batch_jobs 항목.
    job_type='db'이면 batch_executor_db.run_db_batch_job, 아니면 batch_executor_file.run_batch_job.
    서버 재시작 시 last_run_at이 있으면 next_run_time = last_run_at + interval로 두어 주기 유지."""
    batch_job_id = job["batch_job_id"]
    job_type = (job.get("job_type") or "file").strip().lower()
    if job_type == "db":
        from Backend.etl_server2 import batch_executor_db
        run_func = batch_executor_db.run_db_batch_job
    else:
        from Backend.etl_server2 import batch_executor_file
        run_func = batch_executor_file.run_batch_job
    interval_minutes = int(job.get("interval_minutes") or 10)
    job_id = f"batch_{batch_job_id}"

    # 서버 재시작 시: 마지막 실행 시각 + 주기가 아직 안 됐으면 그 시각에 실행, 이미 지났으면 10초 후
    next_run_time = datetime.now() + timedelta(seconds=10)
    last_run_at = job.get("last_run_at")
    if last_run_at and interval_minutes > 0:
        try:
            if isinstance(last_run_at, str):
                last_run = datetime.fromisoformat(last_run_at.replace("Z", "+00:00"))
            else:
                last_run = last_run_at
            if getattr(last_run, "tzinfo", None):
                last_run = last_run.replace(tzinfo=None)
            next_run = last_run + timedelta(minutes=interval_minutes)
            if next_run > datetime.now():
                next_run_time = next_run
        except (TypeError, ValueError):
            pass

    get_scheduler().add_job(
        run_func,
        trigger="interval",
        minutes=interval_minutes,
        id=job_id,
        args=[batch_job_id],
        replace_existing=True,
        next_run_time=next_run_time,
    )
    logger.debug("scheduler add_job batch_%s interval=%s min next_run=%s", batch_job_id, interval_minutes, next_run_time)


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
    job_id = f"batch_{batch_job_id}"
    get_scheduler().reschedule_job(job_id, trigger=IntervalTrigger(minutes=interval_minutes))
    logger.debug("scheduler reschedule_job %s interval=%s min", job_id, interval_minutes)


def run_now(batch_job_id: int) -> dict:
    """즉시 1회 실행. add_job with next_run_time=now (replace_existing). job_type에 따라 실행 함수 분기.
    반환: {"already_running": True} 이면 이미 실행 중이라 스케줄만 건너뜀."""
    from Backend.etl_server2 import service_file as batch_service

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("run_now: batch_job_id=%s not found", batch_job_id)
        return {}
    job_type = (job.get("job_type") or "file").strip().lower()
    if (job.get("last_run_status") or "").strip().lower() == "running":
        logger.info("run_now: batch_%s job_type=%s already running, skip scheduling", batch_job_id, job_type)
        return {"already_running": True}
    if job_type == "db":
        from Backend.etl_server2 import batch_executor_db
        run_func = batch_executor_db.run_db_batch_job
    else:
        from Backend.etl_server2 import batch_executor_file
        run_func = batch_executor_file.run_batch_job
    job_id = f"batch_{batch_job_id}"
    get_scheduler().add_job(
        run_func,
        trigger="interval",
        minutes=int(job.get("interval_minutes") or 10),
        id=job_id,
        args=[batch_job_id],
        replace_existing=True,
        next_run_time=datetime.now(),
    )
    logger.info("scheduler run_now batch_%s job_type=%s scheduled", batch_job_id, job_type)
    return {}
