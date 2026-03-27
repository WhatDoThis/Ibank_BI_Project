"""
Backend.admin_server.schemas (어드민 API 요청 바디)
================================================
Pydantic 모델.

[Classes]
===========
- InviteBody(invite_target_dvsn), UserRoleBody, RoleCreateBody, RoleUpdateBody
- ProjectCreateBody, ProjectUpdateBody, MemberAddBody, MemberRoleBody
- OrgPatchBody, TableMasterPatchBody, ProjectTableAddBody

[Dependencies]
=========
- pydantic BaseModel
"""

from pydantic import BaseModel, Field


class InviteBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    dptmt_info_id: int | None = None
    invite_target_dvsn: str = Field(
        default="user",
        max_length=20,
        description="가입 시 부여할 user_dvsn (초대자 역할별 허용 범위 적용)",
    )


class UserRoleBody(BaseModel):
    user_dvsn: str = Field(
        ...,
        description="admin·operator·user·etl_manager(sa_dev만) — 호출자 역할에 따른 제한",
    )


class RoleCreateBody(BaseModel):
    pmssn_name: str = Field(..., max_length=100)
    pmssn_list: list[str] = Field(default_factory=list)


class RoleUpdateBody(BaseModel):
    pmssn_name: str | None = Field(None, max_length=100)
    pmssn_list: list[str] | None = None


class ProjectCreateBody(BaseModel):
    project_name: str = Field(..., max_length=100)
    project_dscrtn: str | None = Field(None, max_length=500)


class ProjectUpdateBody(BaseModel):
    project_name: str | None = Field(None, max_length=100)
    project_dscrtn: str | None = Field(None, max_length=500)
    active_yn: str | None = Field(None, max_length=1)


class MemberAddBody(BaseModel):
    ptcpnt_user_id: int
    pmssn_master_id: int


class MemberRoleBody(BaseModel):
    pmssn_master_id: int


class OrgPatchBody(BaseModel):
    dptmt_name: str = Field(..., max_length=100)


class TableMasterPatchBody(BaseModel):
    table_label: str | None = Field(None, max_length=200)
    table_dscrtn: str | None = Field(None, max_length=500)


class ProjectTableAddBody(BaseModel):
    table_master_id: int
