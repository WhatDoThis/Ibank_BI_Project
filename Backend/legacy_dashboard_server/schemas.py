"""
Backend.legacy_dashboard_server.schemas (구 대시보드 요청 바디)
==============================================================
POST /api/dashboard/data, /api/dashboard/chart-data 검증용.

[Pydantic Models]
===========
1. DashboardDataRequest: 대시보드 data (table_id, date_range, group_by 등)
2. ChartDataRequest: 대시보드 차트 (dimension, metric 등)

[Dependencies]
=========
- pydantic (BaseModel, Field)
"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


# 1.
class DashboardDataRequest(BaseModel):
    table_id: str = Field(..., description="테이블 ID")
    date_range: List[Any] = Field(..., min_length=2, description="[시작일, 종료일]")
    campaign_ids: Optional[List[int]] = None
    workflow_ids: Optional[List[int]] = None
    channels: Optional[List[int]] = None
    group_by: Optional[dict] = Field(
        default_factory=lambda: {"campaign": True, "date": True, "workflow": False, "channel": True}
    )


# 2.
class ChartDataRequest(BaseModel):
    table_id: str = Field(..., description="테이블 ID")
    date_range: List[Any] = Field(..., min_length=2, description="[시작일, 종료일]")
    campaign_ids: Optional[List[int]] = None
    workflow_ids: Optional[List[int]] = None
    channels: Optional[List[int]] = None
    dimension: str = Field("delivery_date", description="집계 기준 컬럼")
    metric: str = Field("success_count", description="집계 지표 컬럼")
