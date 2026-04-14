"""
Backend.admin_server.router (/api/admin)
========================================
어드민·슈퍼어드민 API. users/roles/projects/tables 도메인 service 호출.

[Endpoints]
===========
1. users, users/invite, users/ownership-transfer-targets, users/{id}/work-assets, transfer-ownership, users/{id}/change-options|management(409), users/{id}/suspend|activate|DELETE(비활성만·409)
2. roles CRUD, roles/permission-options, roles/{pmssn_master_id}/usages, roles/{pmssn_master_id}/projects/{project_info_id}/participants, roles/users/{user_id}/usages
3. projects CRUD·GET purge-preview·DELETE purge(비활성 물리 삭제·위젯보드 연쇄), projects/{id}/members·invites
4. table master 조회/수정, project table mapping 관리
5. invite-codes, org, org/departments GET/POST/PATCH/DELETE (SA_DEV 전체·루트/하위 / SA 트리·하위만)

[Dependencies]
=========
- Backend.admin_server.deps, schemas, service_users, service_roles, service_projects, service_tables
- Backend.core.dependencies.get_system_db
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from Backend.admin_server import schemas
from Backend.admin_server.ownership_guards import ManagementBlockedError
from Backend.admin_server.deps import (
    get_authenticated_user_row,
    require_org_admin,
    require_project_admin_or_operator_participant,
    require_super_admin,
)
from Backend.admin_server import service_projects
from Backend.admin_server import service_roles
from Backend.admin_server import service_tables
from Backend.admin_server import service_users
from Backend.core.dependencies import get_system_db
from Backend.core.user_dvsn_codes import (
    ORG_ADMIN_DVSN,
    ORG_OR_OPERATOR_DVSN,
    PROJECT_ADMIN_DVSN,
    SUPER_ORG_DVSN,
    canon_user_dvsn,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _ve(e: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


# 1. [users]
@router.get("/users")
def admin_users_list(
    scope: str | None = Query(None, description="dept_tree: 프로젝트 생성 모달용 부서 트리·본인 제외"),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    if (scope or "").strip().lower() == "dept_tree":
        return {
            "items": service_users.list_users_dept_tree_for_project_create(
                conn,
                int(actor["dptmt_info_id"]),
                int(actor["user_id"]),
            )
        }
    return {
        "items": service_users.list_users_for_admin_ui(
            conn,
            str(actor.get("user_dvsn") or ""),
            int(actor["dptmt_info_id"]),
        )
    }


@router.get("/users/search")
def admin_users_search(
    q: str = Query("", min_length=0),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    c = canon_user_dvsn(actor.get("user_dvsn"))
    if c not in ORG_OR_OPERATOR_DVSN:
        return {"items": []}
    scope = int(actor["dptmt_info_id"]) if c == "o" else None
    exclude_zero = c != "sa_dev" and int(actor["dptmt_info_id"]) != 0
    use_exclude = exclude_zero and scope is None
    return {
        "items": service_users.search_users_by_email(
            conn, q, scope_dptmt_id=scope, exclude_dptmt_zero=use_exclude
        )
    }


@router.post("/users/invite")
def admin_users_invite(
    body: schemas.InviteBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.invite_user_by_email(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            body.email,
            body.dptmt_info_id,
            body.invite_target_dvsn,
            body.invite_etl_yn,
            body.invite_project_info_id,
            body.invite_pmssn_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "초대 메일을 발송했습니다."}


@router.get("/users/ownership-transfer-targets")
def admin_ownership_transfer_targets(
    dptmt_info_id: int = Query(..., ge=0),
    exclude_user_id: int = Query(..., ge=1),
    etl_infra: bool = Query(
        False,
        description="true면 동일 부서·활성·ETL 자격(etl_yn=Y 또는 sa_dev) 사용자만",
    ),
    resource_type: str | None = Query(
        None,
        description="table_master·dptmt_creator(부서 생성자 이관, dptmt_info_id=해당 부서 PK)",
    ),
    table_master_id: int | None = Query(
        None,
        ge=1,
        description="resource_type=table_master 일 때 필수",
    ),
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        rt = (resource_type or "").strip().lower()
        if rt == "table_master":
            if table_master_id is None:
                raise ValueError("table_master 이관 후보 조회에는 table_master_id가 필요합니다.")
            fd = service_users.get_user_dptmt_for_admin(conn, int(exclude_user_id))
            if int(dptmt_info_id) != int(fd):
                raise ValueError("dptmt_info_id가 소유 사용자 부서와 일치하지 않습니다.")
            items = service_users.list_table_master_transfer_targets(
                conn,
                str(actor.get("user_dvsn") or ""),
                int(actor["dptmt_info_id"]),
                int(exclude_user_id),
                int(table_master_id),
            )
        elif rt == "dptmt_creator":
            items = service_users.list_department_creator_transfer_targets(
                conn,
                str(actor.get("user_dvsn") or ""),
                int(actor["dptmt_info_id"]),
                int(dptmt_info_id),
                int(exclude_user_id),
            )
        else:
            items = service_users.list_ownership_transfer_targets(
                conn,
                str(actor.get("user_dvsn") or ""),
                int(actor["dptmt_info_id"]),
                dptmt_info_id,
                exclude_user_id,
                etl_infra=bool(etl_infra),
            )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.get("/users/{user_id}/work-assets")
def admin_user_work_assets(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        return service_users.get_user_work_assets(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
        )
    except ValueError as e:
        raise _ve(e) from e


@router.post("/users/transfer-ownership")
def admin_transfer_ownership(
    body: schemas.TransferOwnershipBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.transfer_resource_ownership(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            body.resource_type,
            body.resource_id,
            body.from_user_id,
            body.to_user_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "이관했습니다."}


@router.get("/users/{user_id}/change-options")
def admin_user_change_options(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        return service_users.get_user_change_options(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
        )
    except ValueError as e:
        raise _ve(e) from e


@router.put("/users/{user_id}/management")
def admin_user_management_update(
    user_id: int,
    body: schemas.UserManageUpdateBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.update_user_management(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
            body.dptmt_info_id,
            body.user_dvsn,
            body.project_info_ids,
            [a.model_dump() for a in body.project_assignments] if body.project_assignments else None,
            body.etl_yn,
        )
    except ManagementBlockedError as e:
        raise HTTPException(status_code=409, detail=e.payload) from e
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "사용자 변경사항이 반영되었습니다."}


@router.get("/invite/departments")
def admin_invite_departments(
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    items = service_users.list_departments_for_invite(
        conn,
        str(actor.get("user_dvsn") or ""),
        int(actor["dptmt_info_id"]),
    )
    return {"items": items}


@router.get("/invite/projects")
def admin_invite_projects(
    dptmt_info_id: int = Query(..., ge=0),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    try:
        service_users.assert_invite_dptmt_allowed(
            conn,
            str(actor.get("user_dvsn") or ""),
            int(actor["dptmt_info_id"]),
            dptmt_info_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": service_projects.list_projects_in_dept(conn, dptmt_info_id)}


@router.get("/invite/roles")
def admin_invite_roles(
    dptmt_info_id: int = Query(..., ge=0),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    try:
        service_users.assert_invite_dptmt_allowed(
            conn,
            str(actor.get("user_dvsn") or ""),
            int(actor["dptmt_info_id"]),
            dptmt_info_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": service_roles.list_roles_for_dept(conn, dptmt_info_id)}


@router.patch("/users/{user_id}/suspend")
def admin_user_suspend(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.suspend_user(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
        )
    except ManagementBlockedError as e:
        raise HTTPException(status_code=409, detail=e.payload) from e
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "정지 처리되었습니다."}


@router.patch("/users/{user_id}/activate")
def admin_user_activate(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.activate_user(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "활성화되었습니다."}


@router.delete("/users/{user_id}")
def admin_user_delete(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.delete_inactive_user(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
        )
    except ManagementBlockedError as e:
        raise HTTPException(status_code=409, detail=e.payload) from e
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "삭제되었습니다."}


@router.patch("/users/{user_id}/role")
def admin_user_role(
    user_id: int,
    body: schemas.UserRoleBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.set_user_dvsn_admin_user(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
            body.user_dvsn,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "역할이 변경되었습니다."}


@router.patch("/users/{user_id}/etl-access")
def admin_user_etl_access(
    user_id: int,
    body: schemas.UserEtlYnBody,
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.set_user_etl_flag(
            conn,
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            user_id,
            body.etl_yn,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "ETL 자격이 반영되었습니다."}


@router.get("/invite-codes")
def admin_invite_codes(
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    did = int(actor["dptmt_info_id"])
    return {"items": service_users.list_invite_codes_for_dept(conn, did)}


# 2. [org]
@router.get("/org")
def admin_org_get(
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    did = int(actor["dptmt_info_id"])
    try:
        return service_users.get_department(conn, did)
    except ValueError as e:
        raise _ve(e) from e


@router.patch("/org")
def admin_org_patch(
    body: schemas.OrgPatchBody,
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    did = int(actor["dptmt_info_id"])
    try:
        service_users.update_department_name(conn, did, body.dptmt_name)
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "부서 정보가 수정되었습니다."}


@router.get("/org/departments")
def admin_org_departments_list(
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in SUPER_ORG_DVSN:
        return {"items": []}
    return {
        "items": service_users.list_departments_for_org_settings(
            conn,
            str(actor.get("user_dvsn") or ""),
            int(actor["dptmt_info_id"]),
        )
    }


@router.post("/org/departments")
def admin_org_departments_create(
    body: schemas.OrgDepartmentCreateBody,
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    try:
        new_id = service_users.create_department(
            conn,
            int(actor["user_id"]),
            body.dptmt_name,
            body.parent_dptmt_info_id,
            body.dptmt_code,
            actor_dvsn=str(actor.get("user_dvsn") or ""),
            actor_dptmt_id=int(actor["dptmt_info_id"]),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"dptmt_info_id": new_id, "message": "부서가 등록되었습니다."}


@router.patch("/org/departments/{dptmt_info_id}")
def admin_org_departments_patch(
    dptmt_info_id: int,
    body: schemas.OrgDepartmentPatchBody,
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.update_department_in_org_settings(
            conn,
            int(dptmt_info_id),
            body.dptmt_name,
            body.dptmt_code,
            body.use_yn,
            actor_dvsn=str(actor.get("user_dvsn") or ""),
            actor_dptmt_id=int(actor["dptmt_info_id"]),
            migrate_users_to_dptmt_info_id=body.migrate_users_to_dptmt_info_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "부서 정보가 수정되었습니다."}


@router.delete("/org/departments/{dptmt_info_id}")
def admin_org_departments_delete(
    dptmt_info_id: int,
    actor: dict = Depends(require_super_admin),
    conn=Depends(get_system_db),
):
    try:
        service_users.delete_department_in_org_settings(
            conn,
            int(dptmt_info_id),
            actor_dvsn=str(actor.get("user_dvsn") or ""),
            actor_dptmt_id=int(actor["dptmt_info_id"]),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "부서가 삭제되었습니다."}


# 3. [roles]
@router.get("/roles")
def admin_roles_list(
    scope: str | None = Query(
        None,
        description="project_assignable: 시스템 기본+부서 커스텀(프로젝트 멤버 역할 선택용)",
    ),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    _ = scope
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    did = int(actor["dptmt_info_id"])
    return {"items": service_roles.list_roles_for_dept(conn, did)}


@router.get("/roles/permission-options")
def admin_roles_permission_options(
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        items = service_roles.list_permission_options_for_dept(
            conn,
            int(actor["dptmt_info_id"]),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.get("/roles/users/{user_id}/usages")
def admin_user_role_usages(
    user_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        items = service_roles.list_user_role_usages(
            conn,
            int(actor["dptmt_info_id"]),
            user_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.post("/roles")
def admin_roles_create(
    body: schemas.RoleCreateBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        rid = service_roles.create_custom_role(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            body.pmssn_name,
            body.pmssn_list,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"pmssn_master_id": rid}


@router.put("/roles/{pmssn_master_id}")
def admin_roles_update(
    pmssn_master_id: int,
    body: schemas.RoleUpdateBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_roles.update_custom_role(
            conn,
            int(actor["dptmt_info_id"]),
            pmssn_master_id,
            body.pmssn_name,
            body.pmssn_list,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "수정되었습니다."}


@router.delete("/roles/{pmssn_master_id}")
def admin_roles_delete(
    pmssn_master_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_roles.delete_custom_role(conn, int(actor["dptmt_info_id"]), pmssn_master_id)
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "삭제되었습니다."}


@router.get("/roles/{pmssn_master_id}/usages")
def admin_role_usages(
    pmssn_master_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        items = service_roles.list_role_usages(
            conn,
            int(actor["dptmt_info_id"]),
            pmssn_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.get("/roles/{pmssn_master_id}/projects/{project_info_id}/participants")
def admin_role_project_participants(
    pmssn_master_id: int,
    project_info_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        items = service_roles.list_role_project_participants(
            conn,
            int(actor["dptmt_info_id"]),
            pmssn_master_id,
            project_info_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


# 4. [projects]
@router.get("/projects")
def admin_projects_list(
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    c = canon_user_dvsn(actor.get("user_dvsn"))
    if c not in PROJECT_ADMIN_DVSN:
        return {"items": []}
    did = int(actor["dptmt_info_id"])
    if c == "o":
        items = service_projects.list_projects_for_participant(
            conn, int(actor["user_id"]), did
        )
    else:
        items = service_projects.list_projects_in_dept(conn, did)
    return {"items": items}


@router.post("/projects")
def admin_projects_create(
    body: schemas.ProjectCreateBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        tm_dump = (
            [m.model_dump() for m in body.table_mappings]
            if body.table_mappings is not None
            else None
        )
        out = service_projects.create_project_full(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            body.project_name,
            body.project_dscrtn,
            int(body.creator_pmssn_master_id),
            list(body.table_master_ids),
            [m.model_dump() for m in body.members],
            [x.model_dump() for x in body.external_invites],
            body.feature_flags.model_dump() if body.feature_flags is not None else None,
            table_mappings=tm_dump,
        )
    except ValueError as e:
        raise _ve(e) from e
    return out


@router.patch("/projects/{project_info_id}")
def admin_projects_patch(
    project_info_id: int,
    body: schemas.ProjectUpdateBody,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        tm_patch = (
            [m.model_dump() for m in body.table_mappings]
            if body.table_mappings is not None
            else None
        )
        service_projects.update_project(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            body.project_name,
            body.project_dscrtn,
            body.active_yn,
            actor_dvsn=str(actor.get("user_dvsn") or ""),
            feature_flags=body.feature_flags.model_dump()
            if body.feature_flags is not None
            else None,
            table_master_ids=body.table_master_ids
            if body.table_mappings is None
            else None,
            table_mappings=tm_patch,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "수정되었습니다."}


@router.delete("/projects/{project_info_id}")
def admin_projects_delete(
    project_info_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    """소프트 삭제 — active_yn='N'으로 변경. 실제 row 삭제 아님."""
    try:
        service_projects.deactivate_project(conn, int(actor["dptmt_info_id"]), project_info_id)
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "프로젝트가 비활성화되었습니다."}


@router.get("/projects/{project_info_id}/purge-preview")
def admin_projects_purge_preview(
    project_info_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    """비활성 프로젝트 물리 삭제 전 위젯보드·위젯·공유 행 요약."""
    try:
        return service_projects.get_inactive_project_purge_preview(
            conn, int(actor["dptmt_info_id"]), project_info_id
        )
    except ValueError as e:
        raise _ve(e) from e


@router.delete("/projects/{project_info_id}/purge")
def admin_projects_purge(
    project_info_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    """비활성(active_yn≠Y) 프로젝트만 DB에서 제거. 위젯보드·참여·테이블 매핑·관련 알림·초대 참조를 선행 정리한다."""
    try:
        service_projects.purge_inactive_project(
            conn, int(actor["dptmt_info_id"]), project_info_id
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "프로젝트가 삭제되었습니다."}


@router.get("/tables")
def admin_tables_list(
    db_type: str | None = Query(None, description="main|dash"),
    q: str = Query("", min_length=0),
    limit: int = Query(300, ge=1, le=2000),
    sort: str | None = Query(
        None,
        description="project_create: db_type=main이면 update_dtm desc·table_name; 아니면 dash 우선·동일",
    ),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    try:
        items = service_tables.list_table_master(
            conn, db_type=db_type, q=q, limit=limit, sort_mode=sort
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.patch("/tables/{table_master_id}")
def admin_table_patch(
    table_master_id: int,
    body: schemas.TableMasterPatchBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    _ = actor
    try:
        service_tables.update_table_master(
            conn,
            table_master_id,
            body.table_label,
            body.table_dscrtn,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "수정되었습니다."}


@router.get("/projects/{project_info_id}/tables")
def admin_project_tables_list(
    project_info_id: int,
    db_type: str | None = Query(
        None,
        description="main|dash. 프로젝트 QS/WB 매핑 UI는 main만 조회 권장",
    ),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    try:
        items = service_tables.list_project_tables(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            db_type=db_type,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.post("/projects/{project_info_id}/tables")
def admin_project_table_add(
    project_info_id: int,
    body: schemas.ProjectTableAddBody,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_tables.add_project_table_mapping(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            body.table_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "테이블 매핑이 추가되었습니다."}


@router.delete("/projects/{project_info_id}/tables/{table_master_id}")
def admin_project_table_delete(
    project_info_id: int,
    table_master_id: int,
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        service_tables.delete_project_table_mapping(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            table_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "테이블 매핑이 삭제되었습니다."}


@router.get("/projects/{project_info_id}/members")
def admin_project_members(
    project_info_id: int,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        data = service_projects.list_members(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            actor_user_id=int(actor["user_id"]),
            actor_dvsn=str(actor.get("user_dvsn") or ""),
        )
    except ValueError as e:
        raise _ve(e) from e
    return data


@router.delete("/projects/{project_info_id}/invites/{notification_info_id}")
def admin_project_invite_cancel(
    project_info_id: int,
    notification_info_id: int,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    """미수락 project_invite 알림 삭제(타부서 초대 취소)."""
    try:
        service_projects.cancel_project_invite(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            notification_info_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "초대를 취소했습니다."}


@router.post("/projects/{project_info_id}/members")
def admin_project_member_add(
    project_info_id: int,
    body: schemas.MemberAddBody,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        result = service_projects.add_member(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            str(actor.get("user_dvsn") or ""),
            project_info_id,
            body.ptcpnt_user_id,
            body.pmssn_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    outcome = (result or {}).get("outcome")
    if outcome == "invite_sent":
        return {"message": "초대 알림을 보냈습니다.", "outcome": "invite_sent"}
    return {"message": "멤버가 추가되었습니다.", "outcome": "member_added"}


@router.patch("/projects/{project_info_id}/members/{ptcpnt_user_id}")
def admin_project_member_role(
    project_info_id: int,
    ptcpnt_user_id: int,
    body: schemas.MemberRoleBody,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        service_projects.update_member_role(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            ptcpnt_user_id,
            body.pmssn_master_id,
            actor_dvsn=str(actor.get("user_dvsn") or ""),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "역할이 변경되었습니다."}


@router.delete("/projects/{project_info_id}/members/{ptcpnt_user_id}")
def admin_project_member_remove(
    project_info_id: int,
    ptcpnt_user_id: int,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        service_projects.remove_member(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            ptcpnt_user_id,
            int(actor["user_id"]),
            actor_dvsn=str(actor.get("user_dvsn") or ""),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "멤버에서 제외되었습니다."}
