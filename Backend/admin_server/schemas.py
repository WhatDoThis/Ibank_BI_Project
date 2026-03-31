"""
Backend.admin_server.schemas (어드민 API 요청 바디)
================================================
Pydantic 모델.

[Classes]
===========
- InviteBody(invite_target_dvsn·invite_etl_yn·프로젝트·pmssn), UserRoleBody, UserEtlYnBody, TransferOwnershipBody
- RoleCreateBody, RoleUpdateBody, ProjectCreateBody, ProjectUpdateBody, MemberAddBody, MemberRoleBody
- OrgPatchBody, OrgDepartmentCreateBody, OrgDepartmentPatchBody, TableMasterPatchBody, ProjectTableAddBody

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
        description="가입 부서. 생략 시 초대자 부서. sa_dev는 임의 부서, sa·a는 본인 부서 트리만",
    )
    invite_target_dvsn: str = Field(
        default="u",
        max_length=20,
        description="가입 시 user_dvsn — sa·a·o·u (초대자별 허용 집합, 백엔드 검증)",
    )
    invite_etl_yn: Literal["Y", "N"] | None = Field(
        default=None,
        description="가입 직후 etl_yn. sa·sa_dev만 Y 가능. a 전송 시 무시(N).",
    )
    invite_project_info_id: int | None = Field(
        default=None,
        description="u 초대 시 선택: 가입 후 자동 프로젝트 멤버",
    )
    invite_pmssn_master_id: int | None = Field(
        default=None,
        description="user 초대 시 필수: invite_project_info_id와 쌍",
    )


class UserRoleBody(BaseModel):
    user_dvsn: str = Field(
        ...,
        description="a·o·u — 호출자 역할에 따른 제한",
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


class OrgDepartmentCreateBody(BaseModel):
    """슈퍼·SA_DEV: 최상위(parent 없음) 또는 기존 부서 하위에 부서 추가."""

    dptmt_name: str = Field(..., max_length=100)
    parent_dptmt_info_id: int | None = Field(
        None,
        description="상위 부서 PK. 생략·null 이면 최상위(루트) 부서로 추가",
    )
    dptmt_code: str | None = Field(
        None,
        max_length=80,
        description="미입력 시 서버에서 짧은 고유 코드 자동 부여",
    )


class OrgDepartmentPatchBody(BaseModel):
    """부서명·코드·사용여부 수정(필드 중 하나 이상)."""

    dptmt_name: str | None = Field(None, max_length=100)
    dptmt_code: str | None = Field(None, max_length=80)
    use_yn: Literal["Y", "N"] | None = Field(
        None, description="Y=사용, N=사용 안 함(삭제와 별개)"
    )


class TableMasterPatchBody(BaseModel):
    table_label: str | None = Field(None, max_length=200)
    table_dscrtn: str | None = Field(None, max_length=500)


class ProjectTableAddBody(BaseModel):
    table_master_id: int


class TransferOwnershipBody(BaseModel):
    resource_type: Literal["project", "pmssn_master"] = Field(
        ...,
        description="project=project_create_user_id, pmssn_master=user_id(커스텀 역할)",
    )
    resource_id: int = Field(..., ge=1)
    from_user_id: int = Field(..., ge=1, description="현재 생성자·등록자")
    to_user_id: int = Field(..., ge=1, description="이관 받을 사용자(sa_dev·sa·a·동일 부서)")
