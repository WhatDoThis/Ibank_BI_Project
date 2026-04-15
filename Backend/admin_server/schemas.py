"""
Backend.admin_server.schemas (어드민 API 요청 바디)
================================================
어드민 API 요청/응답 Pydantic 모델.

[Classes]
===========
- InviteBody, UserRoleBody, UserEtlYnBody, TransferOwnershipBody(project_invite·dptmt_creator), UserManageUpdateBody(etl_yn 선택)
- RoleCreateBody, RoleUpdateBody, ProjectMemberAssignBody, ProjectFeatureFlags, TableMappingEntry, ProjectCreateBody, ProjectUpdateBody, MemberAddBody, MemberRoleBody, AcceptProjectInviteBody
- OrgPatchBody, OrgDepartmentCreateBody, OrgDepartmentPatchBody(migrate_users_to_dptmt_info_id), TableMasterPatchBody, ProjectTableAddBody
- PermissionOptionResponse, RoleUsageRow, RoleUsageListResponse, UserRoleUsageRow, UserRoleUsageListResponse

[Dependencies]
=========
- pydantic BaseModel
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    etl_yn: Literal["Y", "N"] = Field(..., description="ETL 관리자 자격")


class PermissionOptionResponse(BaseModel):
    items: list[str] = Field(default_factory=list, description="권한 상세 키 목록")


class RoleCreateBody(BaseModel):
    pmssn_name: str = Field(..., max_length=100)
    pmssn_list: list[str] = Field(default_factory=list)


class RoleUpdateBody(BaseModel):
    pmssn_name: str | None = Field(None, max_length=100)
    pmssn_list: list[str] | None = None


class ProjectMemberAssignBody(BaseModel):
    user_id: int = Field(..., ge=1)
    pmssn_master_id: int = Field(..., ge=1)


class ProjectFeatureFlags(BaseModel):
    """DB project_info.feature_flags 와 동일 키(query·dash·widget)."""

    model_config = ConfigDict(extra="ignore")

    query: bool = Field(True, description="쿼리 스튜디오")
    dash: bool = Field(True, description="캠페인 대시보드")
    widget: bool = Field(True, description="위젯보드")


class TableMappingEntry(BaseModel):
    """프로젝트별 table_master 매핑 — 쿼리 스튜디오·위젯보드 노출을 독립 설정."""

    model_config = ConfigDict(extra="ignore")

    table_master_id: int = Field(..., ge=1)
    use_query_studio: bool = Field(True, description="쿼리 스튜디오 허용")
    use_widgetboard: bool = Field(True, description="위젯보드(saved_table 등) 허용")


class ProjectCreateBody(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=20)
    project_dscrtn: str | None = Field(None, max_length=100)
    feature_flags: ProjectFeatureFlags | None = Field(
        default=None,
        description="생략 시 DB 기본(세 기능 모두 true)",
    )
    table_mappings: list[TableMappingEntry] | None = Field(
        default=None,
        description="전달 시 table_master_ids 대신 채널별 플래그로 동기화. 생략 시 table_master_ids(양쪽 Y) 레거시",
    )
    table_master_ids: list[int] = Field(default_factory=list)
    creator_pmssn_master_id: int = Field(..., ge=1)
    members: list[ProjectMemberAssignBody] = Field(default_factory=list)
    external_invites: list[ProjectMemberAssignBody] = Field(default_factory=list)


class ProjectUpdateBody(BaseModel):
    project_name: str | None = Field(None, max_length=100)
    project_dscrtn: str | None = Field(None, max_length=500)
    active_yn: str | None = Field(None, max_length=1)
    feature_flags: ProjectFeatureFlags | None = Field(
        default=None,
        description="전달 시 저장. 운영자(o)는 변경 불가",
    )
    table_master_ids: list[int] | None = Field(
        default=None,
        description="전달 시 해당 집합으로 매핑 동기화(채널 양쪽 Y). table_mappings와 동시 전달 시 table_mappings 우선",
    )
    table_mappings: list[TableMappingEntry] | None = Field(
        default=None,
        description="채널별 플래그로 table_project_mapping 동기화(운영자 o는 변경 불가)",
    )


class AcceptProjectInviteBody(BaseModel):
    """accept-invite·reject-invite 공통 바디."""

    notification_info_id: int = Field(..., ge=1)


class MemberAddBody(BaseModel):
    ptcpnt_user_id: int
    pmssn_master_id: int


class MemberRoleBody(BaseModel):
    pmssn_master_id: int


class RoleUsageRow(BaseModel):
    project_info_id: int
    project_name: str
    ptcpnt_user_id: int
    user_nickname: str | None = None
    user_email: str


class RoleUsageListResponse(BaseModel):
    items: list[RoleUsageRow] = Field(default_factory=list)


class UserRoleUsageRow(BaseModel):
    project_info_id: int
    project_name: str
    ptcpnt_user_id: int
    pmssn_master_id: int
    pmssn_name: str


class UserRoleUsageListResponse(BaseModel):
    items: list[UserRoleUsageRow] = Field(default_factory=list)


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
    migrate_users_to_dptmt_info_id: int | None = Field(
        None,
        ge=1,
        description="use_yn=N일 때 소속 사용자를 이 부서 PK로 이관한 뒤 비활성화",
    )


class TableMasterPatchBody(BaseModel):
    table_label: str | None = Field(None, max_length=200)
    table_dscrtn: str | None = Field(None, max_length=500)


class ProjectTableAddBody(BaseModel):
    table_master_id: int


class TransferOwnershipBody(BaseModel):
    resource_type: Literal[
        "project",
        "project_invite",
        "pmssn_master",
        "table_master",
        "dptmt_creator",
        "widget_board",
        "etl_connection",
        "etl_table",
        "etl_job",
        "etl_storage_connection",
        "batch_folder_connection",
        "batch_job",
    ] = Field(
        ...,
        description="project·project_invite·pmssn_master·table_master·dptmt_creator·widget_board 또는 etl_db 메타",
    )
    resource_id: int = Field(..., ge=1)
    from_user_id: int = Field(..., ge=1, description="현재 생성자·등록자")
    to_user_id: int = Field(..., ge=1, description="이관 받을 사용자(sa_dev·sa·a·동일 부서)")


class ProjectAssignmentBody(BaseModel):
    project_info_id: int = Field(..., ge=1)
    pmssn_master_id: int = Field(..., ge=1)


class UserManageUpdateBody(BaseModel):
    dptmt_info_id: int | None = Field(None, ge=0)
    user_dvsn: Literal["sa", "a", "o", "u"] | None = None
    etl_yn: Literal["Y", "N"] | None = Field(
        None,
        description="ETL 관리자 자격(etl_yn). sa·sa_dev만 변경 가능, 생략 시 유지",
    )
    project_info_ids: list[int] | None = None
    project_assignments: list[ProjectAssignmentBody] | None = Field(
        None,
        description="[{project_info_id, pmssn_master_id}] 참여 프로젝트별 부여 권한",
    )
