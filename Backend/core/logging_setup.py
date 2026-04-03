"""
Backend.core.logging_setup (앱 공통 로그 포맷)
=============================================
API 서버 기동 시 루트 로거를 `발생일시 / [LEVEL] 메시지` 한 줄 형식으로 맞춘다.

[Main Functions]
===========
1. configure_root_logging: StreamHandler·포맷 적용, uvicorn.access 노이즈 완화

[Dependencies]
=========
- logging, sys
"""

from __future__ import annotations

import logging
import sys


class _AppFormatter(logging.Formatter):
    """`YYYY-MM-DD HH:MM:SS / [LEVEL] message` — 시각과 본문 구분이 명확."""

    def format(self, record: logging.LogRecord) -> str:
        ts = self.formatTime(record, self.datefmt)
        return f"{ts} / [{record.levelname}] {record.getMessage()}"


# 1.
def configure_root_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_AppFormatter(datefmt="%Y-%m-%d %H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
