"""
Backend.api_server.schemas (요청 바디 스키마)
==============================================
FastAPI POST 엔드포인트 요청 검증·문서화용 Pydantic 모델. 프론트 전송 형식과 동일 유지.

[Pydantic Models]
===========
29 - DescribeTableRequest: POST /api/describe-table
33 - ExecuteQueryRequest: POST /api/execute-query
37 - ExplainSqlRequest: POST /api/explain-sql (query/sql)
45 - GetColumnValuesRequest: POST /api/get-column-values
51 - QueryStatsRequest: POST /api/query-stats
55 - JoinOrderRequest: POST /api/join-order
61 - SaveQueryAsTableRequest: POST /api/save-query-as-table
66 - ColumnLabelsRequest: GET/POST /api/column-labels (테이블·컬럼 라벨)
72 - DashboardDataRequest: 대시보드1·2 data (table_id, date_range, group_by 등)
83 - ChartDataRequest: 대시보드 차트 (dimension, metric 등)

[Dependencies]
=========
- pydantic (BaseModel, Field)
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


class JoinOrderRequest(BaseModel):
    base_table: str = Field(..., description="기준 테이블")
    required_tables: List[str] = Field(..., description="포함할 테이블 목록 (base_table 포함 가능)")
    filter_tables: Optional[List[str]] = Field(default=None, description="필터가 걸린 테이블(해당 테이블 JOIN은 INNER 권장)")


class SaveQueryAsTableRequest(BaseModel):
    table_name: str = Field(..., description="생성할 테이블명 (영문/숫자/언더스코어)")
    query: str = Field(..., description="실행했던 SELECT 쿼리 (결과가 해당 테이블에 저장됨)")


class ColumnLabelsRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")
    labels: dict = Field(default_factory=dict, description="컬럼명 → 라벨 매핑")
    table_label: Optional[str] = Field(None, description="테이블 표시 라벨 (선택)")


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
