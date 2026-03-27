"""
Backend.admin_server.schemas (어드민 API 요청 바디)
================================================
Pydantic 모델.

[Classes]
===========
- InviteBody(invite_target_dvsn·invite_etl_yn·프로젝트·pmssn), UserRoleBody, UserEtlYnBody
- RoleCreateBody, RoleUpdateBody, ProjectCreateBody, ProjectUpdateBody, MemberAddBody, MemberRoleBody
- OrgPatchBody, TableMasterPatchBody, ProjectTableAddBody

[Dependencies]
=========
- pydantic BaseModel
"""

from typing import Literal

from pydantic import BaseModel, Field


class InviteBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    dptmt_info_id: int | None = Field(
        default=None,
        description="가입 부서. 생략 시 초대자 부서. SA_DEV는 임의 부서, SA·A는 본인 부서 트리만",
    )
    invite_target_dvsn: str = Field(
        default="user",
        max_length=20,
        description="가입 시 user_dvsn — 초대자별 허용 집합(백엔드 검증)",
    )
    invite_etl_yn: Literal["Y", "N"] | None = Field(
        default=None,
        description="가입 직후 etl_yn. SA·SA_DEV만 Y 가능. Admin 전송 시 무시(N).",
    )
    invite_project_info_id: int | None = Field(
        default=None,
        description="user 초대 시 선택: 가입 후 자동 프로젝트 멤버",
    )
    invite_pmssn_master_id: int | None = Field(
        default=None,
        description="user 초대 시 필수: invite_project_info_id와 쌍",
    )


class UserRoleBody(BaseModel):
    user_dvsn: str = Field(
        ...,
        description="admin·operator·user — 호출자 역할에 따른 제한",
    )


class UserEtlYnBody(BaseModel):
    etl_yn: Literal["Y", "N"] = Field(..., description="ETL 인프라 자격")


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
