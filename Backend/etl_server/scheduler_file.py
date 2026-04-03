"""
Backend.etl_server.scheduler_file (배치 스케줄러)
================================================
09_ETL_SFTP_Connection §5. APScheduler로 주기적 배치 실행.
start_scheduler, load_active_batch_jobs, add_job, remove_job, reschedule_job, run_now, refresh_interval_after_run.

[Main Functions]
===========
1. get_scheduler: lazy 초기화 (멀티 워커 시 import 시점 단일 인스턴스 방지). SCHEDULER_ENABLED=false 시 start_scheduler no-op.
2. start_scheduler: 스케줄러 시작
3. load_active_batch_jobs: 활성 배치 Job 등록
4. _get_run_func: job_type별 실행 함수 반환
5. add_job: 배치 1건 등록 (interval, next_run_time). force_now=True면 즉시 실행(5초 후), False면 last_run_at+interval 또는 10초 후.
6. remove_job: 배치 1건 제거
7. reschedule_job: 주기(interval_minutes) 변경, next_run_time을 지금+interval로 리셋
8. refresh_interval_after_run: 실행 완료 후 interval 잡의 next_run_time을 "지금+interval"로 리셋
9. run_now: 즉시 1회 실행. 이미 running이면 already_running만 반환.

[Dependencies]
=========
- apscheduler (BackgroundScheduler, ThreadPoolExecutor)
- Backend.etl_server.service_file (list_batch_jobs, get_batch_job, effective_interval_minutes_from_batch_row, effective_batch_job_type)
- Backend.etl_server.batch_executor_file (run_batch_job), Backend.etl_server.batch_executor_db (run_db_batch_job)
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: Optional[BackgroundScheduler] = None


# 1.
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


# 2.
def start_scheduler() -> None:
    """스케줄러 시작. SCHEDULER_ENABLED=false면 no-op (단일 프로세스에서만 스케줄러 기동 권장)."""
    if os.environ.get("SCHEDULER_ENABLED", "true").strip().lower() == "false":
        logger.info("batch_scheduler disabled (SCHEDULER_ENABLED=false)")
        return
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("batch_scheduler started")


# 3.
def load_active_batch_jobs() -> None:
    """DB에서 is_active=True 배치 목록 조회 후 스케줄러에 등록."""
    from Backend.etl_server import service_file as batch_service

    jobs = batch_service.list_batch_jobs(is_active=True)
    for job in jobs:
        add_job(job)
    logger.info("batch_scheduler loaded_jobs count=%s", len(jobs))


# 4.
def _get_run_func(job_type: str):
    """job_type에 따른 실행 함수 반환."""
    if job_type == "db":
        from Backend.etl_server import batch_executor_db
        return batch_executor_db.run_db_batch_job
    from Backend.etl_server import batch_executor_file
    return batch_executor_file.run_batch_job


# 5.
def add_job(job: dict, force_now: bool = False) -> None:
    """배치 1건 스케줄러에 등록.
    force_now=True: 재활성·수동 트리거 시 next_run_time = 지금+5초(즉시 실행).
    force_now=False(기본): 서버 재시작 시 last_run_at+interval 또는 10초 후."""
    from Backend.etl_server import service_file as batch_service

    batch_job_id = job["batch_job_id"]
    job_type = batch_service.effective_batch_job_type(job)
    run_func = _get_run_func(job_type)
    interval_minutes = int(batch_service.effective_interval_minutes_from_batch_row(job))
    job_id = f"batch_{batch_job_id}"

    if force_now:
        next_run_time = datetime.now() + timedelta(seconds=5)
    else:
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
    logger.info(
        "batch_scheduler add_job id=%s interval_min=%s next_run=%s force_now=%s",
        batch_job_id, interval_minutes, next_run_time, force_now,
    )


# 6.
def remove_job(batch_job_id: int) -> None:
    """스케줄러에서 배치 제거."""
    job_id = f"batch_{batch_job_id}"
    try:
        get_scheduler().remove_job(job_id)
    except Exception as e:
        logger.warning("batch_scheduler remove_job id=%s err=%s", job_id, e)


# 7.
def reschedule_job(batch_job_id: int, interval_minutes: int) -> None:
    """배치 주기 변경. next_run_time을 지금+interval로 리셋."""
    job_id = f"batch_{batch_job_id}"
    next_run = datetime.now() + timedelta(minutes=interval_minutes)
    get_scheduler().reschedule_job(
        job_id,
        trigger=IntervalTrigger(minutes=interval_minutes, start_date=next_run),
    )
# 8.
def refresh_interval_after_run(batch_job_id: int) -> None:
    """
    실행 완료 후 호출. interval 잡의 next_run_time을 "지금+interval"로 리셋.
    스케줄러에 해당 잡이 없으면(비활성 등) 무시.
    """
    job_id = f"batch_{batch_job_id}"
    try:
        sched = get_scheduler()
        existing = sched.get_job(job_id)
        if existing is None:
            return
        trigger = existing.trigger
        interval_seconds = None
        if hasattr(trigger, "interval"):
            interval_seconds = trigger.interval.total_seconds()
        elif hasattr(trigger, "interval_length"):
            interval_seconds = trigger.interval_length
        if interval_seconds is None or interval_seconds <= 0:
            return
        next_run = datetime.now() + timedelta(seconds=interval_seconds)
        sched.reschedule_job(
            job_id,
            trigger=IntervalTrigger(seconds=int(interval_seconds), start_date=next_run),
        )
        logger.info(
            "batch_scheduler refresh_next batch_id=%s next_run=%s interval_min=%s",
            batch_job_id, next_run, int(interval_seconds / 60),
        )
    except Exception:
        pass


# 9.
def run_now(batch_job_id: int) -> dict:
    """즉시 1회 실행. 사용자 명시 클릭이면 skip 없이 실행. 이미 running이면 already_running만 반환.
    실행 전 interval 잡의 next_run_time을 지금+interval로 리셋한 뒤 1회용 잡으로 실행."""
    from Backend.etl_server import service_file as batch_service

    job = batch_service.get_batch_job(batch_job_id)
    if not job:
        logger.warning("batch_scheduler run_now missing batch_job_id=%s", batch_job_id)
        return {}
    job_type = batch_service.effective_batch_job_type(job)
    if (job.get("last_run_status") or "").strip().lower() == "running":
        logger.warning("batch_scheduler run_now skip_running batch_id=%s", batch_job_id)
        return {"already_running": True}

    run_func = _get_run_func(job_type)
    sched = get_scheduler()
    job_id = f"batch_{batch_job_id}"
    interval_minutes = int(batch_service.effective_interval_minutes_from_batch_row(job))

    # 즉시실행 직후 interval이 곧바로 다시 도는 것 방지: next_run을 지금+interval로 리셋
    try:
        existing = sched.get_job(job_id)
        if existing:
            next_after_run = datetime.now() + timedelta(minutes=interval_minutes)
            sched.reschedule_job(
                job_id,
                trigger=IntervalTrigger(minutes=interval_minutes, start_date=next_after_run),
            )
    except Exception:
        pass

    one_shot_id = f"batch_{batch_job_id}_run_now_{uuid.uuid4().hex[:8]}"
    run_at = datetime.now() + timedelta(seconds=2)
    sched.add_job(
        run_func,
        trigger=DateTrigger(run_date=run_at),
        id=one_shot_id,
        args=[batch_job_id],
        replace_existing=True,
    )
    logger.info("batch_scheduler run_now one_shot batch_id=%s", batch_job_id)
    return {}
