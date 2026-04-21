"""
Backend.system_log_server.audit_emit (system_log 채널 — 감사 조회 측 계측)
======================================================================
CSV 다운로드 등 **조회 표면**에서의 보내기 기록. 실패 시에도 본 응답은 유지하며 `emit_csv_export_audit` 에서는 `logger.exception` 으로 원인만 남김.

[Main Functions]
===========
1. emit_csv_export_audit: CSV 다운로드 성공 시 channel=system_log 단일 append

[Endpoints/Classes/Functions]
=======================
- emit_csv_export_audit(actor_user_id, *, export_kind, row_count, detail_json=...)

[Dependencies]
=========
- logging, Backend.core.system_audit_log
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# 1.
def emit_csv_export_audit(
    actor_user_id: int | None,
    *,
    export_kind: str,
    row_count: int,
    detail_json: dict[str, Any] | None = None,
) -> None:
    try:
        from Backend.core import system_audit_log

        dj = dict(detail_json or {})
        dj.setdefault("export_kind", export_kind)
        dj["row_count"] = int(row_count)

        system_audit_log.append_system_log(
            conn=None,
            row=system_audit_log.SystemLogRow(
                channel=system_audit_log.CHANNEL_SYSTEM_LOG,
                action_kind="EXPORT",
                business_action="audit_csv_export",
                actor_user_id=actor_user_id,
                db_target="system",
                success_yn="Y",
                sql_template_key="system_log.audit_csv_export",
                rows_affected=int(row_count),
                detail_json=dj,
            ),
        )
    except Exception:
        logger.exception("emit_csv_export_audit failed export_kind=%s", export_kind)
        return
