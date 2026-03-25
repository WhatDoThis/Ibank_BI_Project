"""
Backend.report_server.schemas (리포트 API 요청 바디)
===================================================
FastAPI POST 엔드포인트 요청 검증용 Pydantic 모델. 구 대시보드 스키마는 legacy_dashboard_server.schemas.

[Pydantic Models]
===========
1. DescribeTableRequest: POST /api/describe-table
2. ExecuteQueryRequest: POST /api/execute-query
3. ExplainSqlRequest: POST /api/explain-sql (query/sql)
4. GetColumnValuesRequest: POST /api/get-column-values
5. QueryStatsRequest: POST /api/query-stats
6. JoinOrderRequest: POST /api/join-order
7. SaveQueryAsTableRequest: POST /api/save-query-as-table
8. ColumnLabelsRequest: GET/POST /api/column-labels

[Dependencies]
=========
- pydantic (BaseModel, Field)
"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


# 1.
class DescribeTableRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")


# 2.
class ExecuteQueryRequest(BaseModel):
    query: str = Field(..., description="SELECT 쿼리")


# 3.
class ExplainSqlRequest(BaseModel):
    query: Optional[str] = Field(None, description="SQL 쿼리")
    sql: Optional[str] = Field(None, description="SQL 쿼리(별칭)")

    def get_query(self) -> str:
        return (self.query or self.sql or "").strip()


# 4.
class GetColumnValuesRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")
    column_name: str = Field(..., description="컬럼명")
    limit: Optional[int] = Field(100, ge=1, le=1000, description="최대 건수")


# 5.
class QueryStatsRequest(BaseModel):
    query: str = Field(..., description="SELECT 쿼리")


# 6.
class JoinOrderRequest(BaseModel):
    base_table: str = Field(..., description="기준 테이블")
    required_tables: List[str] = Field(..., description="포함할 테이블 목록 (base_table 포함 가능)")
    filter_tables: Optional[List[str]] = Field(default=None, description="필터가 걸린 테이블(해당 테이블 JOIN은 INNER 권장)")


# 7.
class SaveQueryAsTableRequest(BaseModel):
    table_name: str = Field(..., description="생성할 테이블명 (영문/숫자/언더스코어)")
    query: str = Field(..., description="실행했던 SELECT 쿼리 (결과가 해당 테이블에 저장됨)")


# 8.
class ColumnLabelsRequest(BaseModel):
    table_name: str = Field(..., description="테이블명")
    labels: dict = Field(default_factory=dict, description="컬럼명 → 라벨 매핑")
    table_label: Optional[str] = Field(None, description="테이블 표시 라벨 (선택)")
