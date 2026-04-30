"""
widget_board_server.schemas (Pydantic 요청/응답)
=============================================
/api/widget-boards/* 바디 모델.

[Classes]
===========
- WidgetBoardCreateBody, WidgetBoardPatchBody
- WidgetItemCreateBody, WidgetItemPatchBody
- LayoutPatchBody, LayoutItem
- ShareUpsertBody, WidgetBoardInviteItem, WidgetBoardInviteBatchBody, WidgetBoardInviteResolveBody
- ColumnProfileItem, ChartRecommendationOut, TableProfileResponse, BackfillProfilesBody

[Dependencies]
=========
- pydantic
- Backend.widget_board_server.constants (BOARD_DSCRTN_MAX_LEN)
"""

from typing import Any

from pydantic import BaseModel, Field, field_validator

from Backend.widget_board_server.constants import BOARD_DSCRTN_MAX_LEN


class WidgetBoardCreateBody(BaseModel):
    board_name: str | None = Field(None, max_length=200)
    board_dscrtn: str | None = Field(
        None,
        description=f"보드 설명, 최대 {BOARD_DSCRTN_MAX_LEN}자",
    )
    share_scope: str | None = Field(
        None,
        description="private(초대만) | project(동일 프로젝트 위젯보드 권한자 읽기 캔버스)",
    )

    @field_validator("board_dscrtn")
    @classmethod
    def _board_dscrtn_len(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) > BOARD_DSCRTN_MAX_LEN:
            raise ValueError(
                f"보드 설명은 최대 {BOARD_DSCRTN_MAX_LEN}자까지 입력할 수 있습니다."
            )
        return v


class WidgetBoardPatchBody(BaseModel):
    board_name: str | None = Field(None, max_length=200)
    board_dscrtn: str | None = Field(
        None,
        description=f"보드 설명, 최대 {BOARD_DSCRTN_MAX_LEN}자",
    )
    board_order: int | None = None
    is_default: bool | None = None
    share_scope: str | None = Field(
        None,
        description="private | project (소유자만)",
    )
    active_yn: bool | None = Field(None, description="true=Y 활성, false=N 비활성 (소유자만)")

    @field_validator("board_dscrtn")
    @classmethod
    def _board_dscrtn_len_patch(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) > BOARD_DSCRTN_MAX_LEN:
            raise ValueError(
                f"보드 설명은 최대 {BOARD_DSCRTN_MAX_LEN}자까지 입력할 수 있습니다."
            )
        return v


class WidgetItemCreateBody(BaseModel):
    widget_type: str = Field(default="table", max_length=30)
    widget_title: str | None = Field(None, max_length=200)
    data_source_type: str = Field(default="saved_table", max_length=20)
    data_source_query: str | None = None
    data_source_ref: str | None = Field(None, max_length=255)
    data_config: dict[str, Any] = Field(default_factory=dict)
    layout_x: int = 0
    layout_y: int = 0
    layout_w: int = 6
    layout_h: int = 4
    widget_order: int = 0


class WidgetItemPatchBody(BaseModel):
    widget_type: str | None = Field(None, max_length=30)
    widget_title: str | None = Field(None, max_length=200)
    data_source_type: str | None = Field(None, max_length=20)
    data_source_query: str | None = None
    data_source_ref: str | None = Field(None, max_length=255)
    data_config: dict[str, Any] | None = None
    layout_x: int | None = None
    layout_y: int | None = None
    layout_w: int | None = None
    layout_h: int | None = None
    widget_order: int | None = None


class LayoutItem(BaseModel):
    widget_item_id: int
    layout_x: int = 0
    layout_y: int = 0
    layout_w: int = 6
    layout_h: int = 4


class LayoutPatchBody(BaseModel):
    items: list[LayoutItem] = Field(default_factory=list)


class ShareUpsertBody(BaseModel):
    shared_user_id: int
    can_edit: bool = False


class WidgetBoardInviteItem(BaseModel):
    shared_user_id: int = Field(..., ge=1)
    can_edit: bool = False


class WidgetBoardInviteBatchBody(BaseModel):
    invitations: list[WidgetBoardInviteItem] = Field(
        default_factory=list,
        description="초대 알림 수신자 목록(체크한 사용자), 최대 200건까지",
    )


class WidgetBoardInviteResolveBody(BaseModel):
    notification_info_id: int = Field(..., ge=1)


class ColumnProfileItem(BaseModel):
    """컬럼 단위 프로파일(JSON columns[] 요소와 동일 키)."""

    name: str
    pg_type: str | None = None
    semantic_role: str | None = None
    nullable: bool = False
    is_pk: bool = False
    distinct_count: int = 0
    null_ratio: float = 0.0
    min_value: Any | None = None
    max_value: Any | None = None


class ChartRecommendationOut(BaseModel):
    """차트 추천 엔진 결과(chart_recommender.ChartRecommendation 대응)."""

    rank: int
    chart_type: str
    confidence: float
    x_axis: str | None = None
    y_axis: list[str] = Field(default_factory=list)
    color_by: str | None = None
    aggregation: dict[str, str] = Field(default_factory=dict)
    reason_ko: str = ""


class TableProfileResponse(BaseModel):
    table_master_id: int
    table_name: str
    total_rows: int = 0
    sample_count: int = 0
    profiled_at: str | None = None
    columns: list[ColumnProfileItem] = Field(default_factory=list)
    recommendations: list[ChartRecommendationOut] = Field(default_factory=list)
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)


class BackfillProfilesBody(BaseModel):
    batch_size: int | None = Field(
        default=10,
        ge=1,
        le=500,
        description="백필 배치 크기",
    )
