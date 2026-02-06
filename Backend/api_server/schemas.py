"""
Backend.api_server.schemas (요청 바디 스키마)
==============================================
POST 엔드포인트 요청 검증·문서화용 Pydantic 모델. 프론트 전송 형식과 동일 유지.

[Main Models]
===========
- DescribeTableRequest, ExecuteQueryRequest, ExplainSqlRequest
- GetColumnValuesRequest, QueryStatsRequest
- DashboardDataRequest, ChartDataRequest
"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class DescribeTableRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")


class ExecuteQueryRequest(BaseModel):
    query: str = Field(..., description="SELECT 쿼리")


class ExplainSqlRequest(BaseModel):
    query: Optional[str] = Field(None, description="SQL 쿼리")
    sql: Optional[str] = Field(None, description="SQL 쿼리(별칭)")

    def get_query(self) -> str:
        return (self.query or self.sql or "").strip()


class GetColumnValuesRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")
    column_name: str = Field(..., description="컬럼명")
    limit: Optional[int] = Field(100, ge=1, le=1000, description="최대 건수")


class QueryStatsRequest(BaseModel):
    query: str = Field(..., description="SELECT 쿼리")


class DashboardDataRequest(BaseModel):
    table_id: str = Field(..., description="테이블 ID")
    date_range: List[Any] = Field(..., min_length=2, description="[시작일, 종료일]")
    campaign_ids: Optional[List[int]] = None
    workflow_ids: Optional[List[int]] = None
    channels: Optional[List[int]] = None
    group_by: Optional[dict] = Field(
        default_factory=lambda: {"campaign": True, "date": True, "workflow": False, "channel": True}
    )


class ChartDataRequest(BaseModel):
    table_id: str = Field(..., description="테이블 ID")
    date_range: List[Any] = Field(..., min_length=2, description="[시작일, 종료일]")
    campaign_ids: Optional[List[int]] = None
    workflow_ids: Optional[List[int]] = None
    channels: Optional[List[int]] = None
    dimension: str = Field("delivery_date", description="집계 기준 컬럼")
    metric: str = Field("success_count", description="집계 지표 컬럼")
