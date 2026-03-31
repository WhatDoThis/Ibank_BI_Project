"""
Backend.admin_server.router (/api/admin)
========================================
어드민·슈퍼어드민 API. users/roles/projects/tables 도메인 service 호출.

[Endpoints]
===========
1. users, users/search, users/invite, users/ownership-transfer-targets, users/{id}/work-assets, users/transfer-ownership, invite/departments|projects|roles, users/{id}/suspend|activate|role|etl-access
2. roles CRUD
3. projects CRUD, projects/{id}/members (operator: 목록·멤버·명/설명 PATCH, 활성/테이블 매핑 제외)
4. table master 조회/수정, project table mapping 관리
5. invite-codes, org, org/departments GET/POST/PATCH/DELETE (SA_DEV 전체·루트/하위 / SA 트리·하위만)

[Dependencies]
=========
- Backend.admin_server.deps, schemas, service_users, service_roles, service_projects, service_tables
- Backend.core.dependencies.get_system_db
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from Backend.admin_server import schemas
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
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
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
    return {"items": service_users.search_users_by_email(conn, q, scope_dptmt_id=scope)}


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
    actor: dict = Depends(require_org_admin),
    conn=Depends(get_system_db),
):
    try:
        items = service_users.list_ownership_transfer_targets(
            conn,
            str(actor.get("user_dvsn") or ""),
            int(actor["dptmt_info_id"]),
            dptmt_info_id,
            exclude_user_id,
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
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    did = int(actor["dptmt_info_id"])
    return {"items": service_roles.list_roles_for_dept(conn, did)}


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
        pid = service_projects.create_project_with_creator_member(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            body.project_name,
            body.project_dscrtn,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"project_info_id": pid}


@router.patch("/projects/{project_info_id}")
def admin_projects_patch(
    project_info_id: int,
    body: schemas.ProjectUpdateBody,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        service_projects.update_project(
            conn,
            int(actor["dptmt_info_id"]),
            project_info_id,
            body.project_name,
            body.project_dscrtn,
            body.active_yn,
            actor_dvsn=str(actor.get("user_dvsn") or ""),
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


@router.get("/tables")
def admin_tables_list(
    db_type: str | None = Query(None, description="main|dash|star"),
    q: str = Query("", min_length=0),
    limit: int = Query(300, ge=1, le=1000),
    actor: dict = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
):
    if canon_user_dvsn(actor.get("user_dvsn")) not in ORG_ADMIN_DVSN:
        return {"items": []}
    try:
        items = service_tables.list_table_master(conn, db_type=db_type, q=q, limit=limit)
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
    db_type: str | None = Query(None, description="main|dash|star"),
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
        items = service_projects.list_members(
            conn, int(actor["dptmt_info_id"]), project_info_id
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"items": items}


@router.post("/projects/{project_info_id}/members")
def admin_project_member_add(
    project_info_id: int,
    body: schemas.MemberAddBody,
    actor: dict = Depends(require_project_admin_or_operator_participant),
    conn=Depends(get_system_db),
):
    try:
        service_projects.add_member(
            conn,
            int(actor["user_id"]),
            int(actor["dptmt_info_id"]),
            project_info_id,
            body.ptcpnt_user_id,
            body.pmssn_master_id,
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "멤버가 추가되었습니다."}


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
            actor_dvsn=str(actor.get("user_dvsn") or ""),
        )
    except ValueError as e:
        raise _ve(e) from e
    return {"message": "멤버에서 제외되었습니다."}
