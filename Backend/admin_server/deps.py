"""
Backend.admin_server.deps (어드민·슈퍼어드민 검증)
===============================================
access JWT 후 user_info에서 user_dvsn 조회·비활성·잠금 거절(403).

[Main Functions]
===========
1. get_authenticated_user_row: user_id·user_dvsn·dptmt_info_id
2. require_org_admin: a · sa · sa_dev (ORG_ADMIN_DVSN)
3. require_super_admin: sa · sa_dev (SUPER_ORG_DVSN)
4. require_org_admin_or_operator: 위 + o (ORG_OR_OPERATOR_DVSN)
5. require_project_admin_or_operator_participant: org 관리자(a/sa/sa_dev)는 소속 부서 소유 프로젝트만; o는 소속 부서 소유이거나 타부서라면 참여자일 때만

[Dependencies]
=========
- fastapi Depends HTTPException
- Backend.auth_server.deps.require_active_access, Backend.core.dependencies.get_system_db
- Backend.core.user_dvsn_codes (canon_user_dvsn, ORG_* 집합)
"""

from typing import Any

from fastapi import Depends, HTTPException, Request

from Backend.auth_server.deps import require_active_access
from Backend.core.dependencies import get_system_db
from Backend.core.user_dvsn_codes import (
    ORG_ADMIN_DVSN,
    ORG_OR_OPERATOR_DVSN,
    PROJECT_ADMIN_DVSN,
    SUPER_ORG_DVSN,
    canon_user_dvsn,
)

_MSG_BAD_DVSN = "허용되지 않은 조직 역할(user_dvsn)입니다."


# 1.
def get_authenticated_user_row(
    payload: dict = Depends(require_active_access),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    uid = int(payload["user_id"])
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, user_dvsn, dptmt_info_id,
                   UPPER(TRIM(COALESCE(user_active_yn, 'N'))) AS _ua,
                   UPPER(TRIM(COALESCE(user_lock_yn, 'N'))) AS _ul
            FROM user_info WHERE user_id = %s
            """,
            (uid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
        r = dict(row)
        if (r.pop("_ua", "") or "") != "Y":
            raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")
        if (r.pop("_ul", "") or "") == "Y":
            raise HTTPException(
                status_code=403,
                detail="잠긴 계정입니다. 관리자에게 문의하세요.",
            )
        return r
    finally:
        cur.close()


# 2.
def require_org_admin(
    actor: dict[str, Any] = Depends(get_authenticated_user_row),
) -> dict[str, Any]:
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    if dvsn not in ORG_ADMIN_DVSN:
        raise HTTPException(status_code=403, detail="어드민 권한이 필요합니다.")
    return actor


# 3.
def require_super_admin(
    actor: dict[str, Any] = Depends(require_org_admin),
) -> dict[str, Any]:
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    if dvsn not in SUPER_ORG_DVSN:
        raise HTTPException(status_code=403, detail="슈퍼어드민만 가능합니다.")
    return actor


# 4.
def require_org_admin_or_operator(
    actor: dict[str, Any] = Depends(get_authenticated_user_row),
) -> dict[str, Any]:
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    if dvsn not in ORG_OR_OPERATOR_DVSN:
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
    dvsn = canon_user_dvsn(actor.get("user_dvsn"))
    if not dvsn:
        raise HTTPException(status_code=403, detail=_MSG_BAD_DVSN)
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
        if dvsn in ORG_ADMIN_DVSN:
            if pd != did:
                raise HTTPException(status_code=403, detail="다른 부서의 프로젝트입니다.")
            return actor
        if dvsn == "o":
            cur.execute(
                """
                SELECT 1 FROM project_ptcpnt_info
                WHERE project_info_id = %s AND ptcpnt_user_id = %s
                """,
                (project_info_id, uid),
            )
            if cur.fetchone():
                return actor
            if pd != did:
                raise HTTPException(status_code=403, detail="다른 부서의 프로젝트입니다.")
            raise HTTPException(
                status_code=403,
                detail="프로젝트 참여자만 가능합니다.",
            )
    finally:
        cur.close()
    raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
