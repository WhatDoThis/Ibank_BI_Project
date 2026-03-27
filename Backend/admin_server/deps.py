"""
Backend.admin_server.deps (어드민·슈퍼어드민 검증)
===============================================
access JWT 후 user_info에서 user_dvsn 조회.

[Main Functions]
===========
1. get_authenticated_user_row: user_id·user_dvsn·dptmt_info_id
2. require_org_admin: admin · super_admin · sa_dev
3. require_super_admin: super_admin · sa_dev (조직 최상위 조작)
4. require_org_admin_or_operator: 프로젝트 목록 등 operator 허용
5. require_project_admin_or_operator_participant: Request.path_params 의 project_info_id 검증

[Dependencies]
=========
- fastapi Depends HTTPException
- Backend.auth_server.deps.get_access_payload, Backend.core.dependencies.get_system_db
"""

from typing import Any

from fastapi import Depends, HTTPException, Request

from Backend.auth_server.deps import get_access_payload
from Backend.core.dependencies import get_system_db


# 1.
def get_authenticated_user_row(
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    uid = int(payload["user_id"])
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_dvsn, dptmt_info_id
            FROM user_info WHERE user_id = %s
            """,
            (uid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
        return dict(row)
    finally:
        cur.close()


# 2.
def require_org_admin(
    actor: dict[str, Any] = Depends(get_authenticated_user_row),
) -> dict[str, Any]:
    dvsn = (actor.get("user_dvsn") or "").strip().lower()
    if dvsn not in ("admin", "super_admin", "sa_dev"):
        raise HTTPException(status_code=403, detail="어드민 권한이 필요합니다.")
    return actor


# 3.
def require_super_admin(
    actor: dict[str, Any] = Depends(require_org_admin),
) -> dict[str, Any]:
    dvsn = (actor.get("user_dvsn") or "").strip().lower()
    if dvsn not in ("super_admin", "sa_dev"):
        raise HTTPException(status_code=403, detail="슈퍼어드민만 가능합니다.")
    return actor


# 4.
def require_org_admin_or_operator(
    actor: dict[str, Any] = Depends(get_authenticated_user_row),
) -> dict[str, Any]:
    dvsn = (actor.get("user_dvsn") or "").strip().lower()
    if dvsn not in ("admin", "super_admin", "sa_dev", "operator"):
        raise HTTPException(
            status_code=403,
            detail="어드민 또는 프로젝트 운영자 권한이 필요합니다.",
        )
    return actor


# 5.
def require_project_admin_or_operator_participant(
    request: Request,
    actor: dict[str, Any] = Depends(get_authenticated_user_row),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    raw_pid = request.path_params.get("project_info_id")
    if raw_pid is None:
        raise HTTPException(
            status_code=500,
            detail="내부 오류: project_info_id 경로 파라미터가 없습니다.",
        )
    try:
        project_info_id = int(raw_pid)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="유효하지 않은 프로젝트입니다.") from None
    dvsn = (actor.get("user_dvsn") or "").strip().lower()
    uid = int(actor["user_id"])
    did = int(actor["dptmt_info_id"])
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT dptmt_info_id FROM project_info WHERE project_info_id = %s",
            (project_info_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        pd = int(row["dptmt_info_id"])
        if dvsn in ("admin", "super_admin", "sa_dev"):
            if pd != did:
                raise HTTPException(status_code=403, detail="다른 부서의 프로젝트입니다.")
            return actor
        if dvsn == "operator":
            if pd != did:
                raise HTTPException(status_code=403, detail="다른 부서의 프로젝트입니다.")
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info
                WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (project_info_id, uid),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=403,
                    detail="프로젝트 참여자만 가능합니다.",
                )
            return actor
    finally:
        cur.close()
    raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
