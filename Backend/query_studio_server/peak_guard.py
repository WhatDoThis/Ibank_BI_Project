"""
Backend.query_studio_server.peak_guard (쿼리 스튜디오 피크 부하 완화)
================================================================
`config.backend.query_studio_peak_guard` 선택 블록. **없으면 전부 비활성**(기존과 동일).

[Main Functions]
===========
1. load_runtime: backend 설정에서 `PeakGuardRuntime` 또는 None
2. check_heavy_rate_limit: table-relationships(mode=all)·join-order 공통, 사용자당 분당 횟수(슬라이딩 60초)
3. check_execute_query_rate_limit: execute-query 전용 분당 횟수
4. get_cached_relationships_full / set_cached_relationships_full: 프로젝트+허용테이블 핑거프린트 TTL 캐시
5. run_under_relationship_sem: 전역 동시 `mode=all` 계산 상한(세마포어)

[Dependencies]
===========
- threading, collections.deque, time, hashlib, copy
"""

from __future__ import annotations

import copy
import hashlib
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_guard_lock = threading.Lock()
_heavy_timestamps: dict[int, deque[float]] = {}
_execute_timestamps: dict[int, deque[float]] = {}
_rel_cache: dict[tuple[int, str], tuple[float, list[dict[str, Any]]]] = {}
_rel_sem: threading.BoundedSemaphore | None = None
_rel_sem_value: int = -1

_SLIDING_WINDOW_SEC = 60.0
_SEM_ACQUIRE_TIMEOUT_SEC = 90.0


@dataclass(frozen=True)
class PeakGuardRuntime:
    """피크 가드 활성 시 파라미터."""

    relationship_cache_ttl_seconds: float
    heavy_compute_concurrency: int
    heavy_per_user_per_minute: int
    execute_query_per_user_per_minute: int


def load_runtime(backend_cfg: Any) -> PeakGuardRuntime | None:
    """
    `query_studio_peak_guard` 블록이 없거나 enabled=False면 None.
    enabled만 true이고 나머지 생략 시 아래 기본값.
    """
    block = getattr(backend_cfg, "query_studio_peak_guard", None)
    if block is None:
        return None
    if not bool(getattr(block, "enabled", True)):
        return None
    ttl = float(getattr(block, "relationship_cache_ttl_seconds", 600) or 0)
    conc = int(getattr(block, "heavy_compute_concurrency", 3) or 0)
    heavy_pm = int(getattr(block, "heavy_per_user_per_minute", 40) or 0)
    ex_pm = int(getattr(block, "execute_query_per_user_per_minute", 60) or 0)
    return PeakGuardRuntime(
        relationship_cache_ttl_seconds=max(0.0, ttl),
        heavy_compute_concurrency=max(0, conc),
        heavy_per_user_per_minute=max(0, heavy_pm),
        execute_query_per_user_per_minute=max(0, ex_pm),
    )


def _prune_window(dq: deque[float], now: float) -> None:
    while dq and now - dq[0] > _SLIDING_WINDOW_SEC:
        dq.popleft()


def check_heavy_rate_limit(user_id: int | None, runtime: PeakGuardRuntime) -> tuple[bool, int]:
    """
    허용 시 (True, 0). 거부 시 (False, retry_after_seconds 권장값).
    user_id 없으면 제한 없이 통과.
    """
    lim = runtime.heavy_per_user_per_minute
    if lim <= 0 or user_id is None:
        return True, 0
    now = time.monotonic()
    with _guard_lock:
        dq = _heavy_timestamps.setdefault(int(user_id), deque())
        _prune_window(dq, now)
        if len(dq) >= lim:
            retry = int(max(1.0, _SLIDING_WINDOW_SEC - (now - dq[0])))
            return False, retry
        dq.append(now)
        return True, 0


def check_execute_query_rate_limit(user_id: int | None, runtime: PeakGuardRuntime) -> tuple[bool, int]:
    lim = runtime.execute_query_per_user_per_minute
    if lim <= 0 or user_id is None:
        return True, 0
    now = time.monotonic()
    with _guard_lock:
        dq = _execute_timestamps.setdefault(int(user_id), deque())
        _prune_window(dq, now)
        if len(dq) >= lim:
            retry = int(max(1.0, _SLIDING_WINDOW_SEC - (now - dq[0])))
            return False, retry
        dq.append(now)
        return True, 0


def _allowed_fingerprint(sorted_names: list[str]) -> str:
    raw = ",".join(sorted_names).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _purge_expired_cache(now: float) -> None:
    dead = [k for k, (exp, _) in _rel_cache.items() if exp <= now]
    for k in dead:
        del _rel_cache[k]


def get_cached_relationships_full(project_info_id: int, sorted_allowed_names: list[str], ttl_sec: float):
    """캐시 히트 시 관계 목록 깊은 복사 반환, 미스면 None."""
    if ttl_sec <= 0:
        return None
    fp = _allowed_fingerprint(sorted_allowed_names)
    key = (int(project_info_id), fp)
    now = time.monotonic()
    with _guard_lock:
        _purge_expired_cache(now)
        hit = _rel_cache.get(key)
        if not hit:
            return None
        exp, rels = hit
        if exp <= now:
            del _rel_cache[key]
            return None
        return copy.deepcopy(rels)


def set_cached_relationships_full(
    project_info_id: int,
    sorted_allowed_names: list[str],
    ttl_sec: float,
    relationships: list[dict[str, Any]],
) -> None:
    if ttl_sec <= 0:
        return
    fp = _allowed_fingerprint(sorted_allowed_names)
    key = (int(project_info_id), fp)
    now = time.monotonic()
    with _guard_lock:
        _purge_expired_cache(now)
        _rel_cache[key] = (now + float(ttl_sec), copy.deepcopy(relationships))


def _get_relationship_sem(max_concurrent: int) -> threading.BoundedSemaphore | None:
    global _rel_sem, _rel_sem_value
    if max_concurrent <= 0:
        return None
    with _guard_lock:
        if _rel_sem is None or _rel_sem_value != max_concurrent:
            _rel_sem = threading.BoundedSemaphore(max_concurrent)
            _rel_sem_value = max_concurrent
        return _rel_sem


def run_under_relationship_sem(max_concurrent: int, fn: Callable[[], T]) -> T:
    """동시 계산 상한. max_concurrent<=0 이면 세마포어 없이 fn(). 타임아웃 시 RuntimeError."""
    sem = _get_relationship_sem(max_concurrent)
    if sem is None:
        return fn()
    acquired = sem.acquire(timeout=_SEM_ACQUIRE_TIMEOUT_SEC)
    if not acquired:
        raise RuntimeError(
            "relationship_compute_sem_timeout",
        )
    try:
        return fn()
    finally:
        sem.release()
