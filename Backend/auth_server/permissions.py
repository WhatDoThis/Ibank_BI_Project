"""
Backend.auth_server.permissions (프로젝트·ETL 권한 검증)
======================================================
1) require_etl_infrastructure: JWT + user_info — `sa_dev`·`etl_manager` 만 ETL API 허용(프로젝트 불필요).
2) require_permission: JWT access + system_db에서 project_ptcpnt_info·pmssn_master.pmssn_list 조회.
   `pmssn_list` 원소는 `pmssn_detail_name` 문자열이 표준; 레거시 PK 숫자 문자열은
   `pmssn_master_detail`로 치환한다. `etl_manager` 는 프로젝트 기능 전면 403.
   `sa_dev`·`super_admin`·`admin` 은 참여 프로젝트에서 report.read 등 자동 허용(docs/main/05).
3) get_effective_permission_ids_for_me: /api/auth/me용 — 자동 역할이면 §8 기능 ID를 permissions에 합침.

[Main Functions]
===========
1. get_user_dvsn_lower: user_id → user_dvsn 소문자
2. is_project_participant: project_ptcpnt_info 존재 여부
3. resolve_pmssn_list_to_names: pmssn_list 배열 → pmssn_detail_name 목록
4. get_permission_ids_for_user_project: 유저·프로젝트별 권한ID 목록(정규화)
5. get_effective_permission_ids_for_me: /me permissions (자동 역할 병합)
6. require_etl_infrastructure: ETL 라우터용 Depends
7. require_permission: FastAPI Depends 팩토리 (*필요 권한 AND)

[Dependencies]
=========
- fastapi Depends HTTPException
- Backend.auth_server.deps.get_access_payload, Backend.core.dependencies.get_system_db
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException

from Backend.auth_server.deps import get_access_payload
from Backend.core.dependencies import get_system_db

_MSG_NO_PROJECT = "프로젝트를 선택해주세요"
_MSG_FORBIDDEN = "이 작업을 수행할 권한이 없습니다."
_MSG_ETL_ACCOUNT_PROJECT = (
    "ETL 전담 계정은 쿼리스튜디오·대시보드 등 프로젝트 기능을 사용할 수 없습니다."
)
_MSG_ETL_INFRA = "ETL 인프라는 SA_DEV 또는 ETL Manager만 사용할 수 있습니다."

# 프로젝트 UI 기능(매트릭스 §8). ETL 인프라는 별도 require_etl_infrastructure.
_PROJECT_FEATURE_IDS = frozenset(
    {"report.read", "report.execute", "dashboard", "widgetboard"}
)
_AUTO_PROJECT_ROLES = frozenset({"sa_dev", "super_admin", "admin"})


# 1.
def get_user_dvsn_lower(conn, user_id: int) -> str:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_dvsn FROM user_info WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return (row.get("user_dvsn") or "").strip().lower() if row else ""
    finally:
        cur.close()


# 2.
def is_project_participant(conn, user_id: int, project_info_id: int) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM project_ptcpnt_info
            WHERE project_info_id = %s AND ptcpnt_user_id = %s
            """,
            (project_info_id, user_id),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


# 3.
def resolve_pmssn_list_to_names(
    cur,
    raw_pmssn_list: Any,
) -> list[str]:
    if not raw_pmssn_list:
        return []
    cur.execute(
        "SELECT pmssn_master_detail_id, pmssn_detail_name FROM pmssn_master_detail"
    )
    drows = cur.fetchall()
    id_to_name = {
        str(r["pmssn_master_detail_id"]): str(r["pmssn_detail_name"]).strip()
        for r in drows
    }
    valid_names = {str(r["pmssn_detail_name"]).strip() for r in drows}
    out: list[str] = []
    for x in raw_pmssn_list:
        s = str(x).strip()
        if not s:
            continue
        if s in valid_names:
            out.append(s)
        elif s in id_to_name:
            out.append(id_to_name[s])
        else:
            out.append(s)
    return out


# 4.
def get_permission_ids_for_user_project(
    conn, user_id: int, project_info_id: int
) -> list[str]:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT m.pmssn_list
            FROM project_ptcpnt_info p
            JOIN pmssn_master m ON m.pmssn_master_id = p.pmssn_master_id
            WHERE p.project_info_id = %s AND p.ptcpnt_user_id = %s
            """,
            (project_info_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return []
        pl = row.get("pmssn_list")
        if not pl:
            return []
        return resolve_pmssn_list_to_names(cur, pl)
    finally:
        cur.close()


# 5.
def get_effective_permission_ids_for_me(
    conn,
    user_id: int,
    project_info_id: int,
    user_dvsn: str | None,
) -> list[str]:
    dvsn = (user_dvsn or "").strip().lower()
    base = get_permission_ids_for_user_project(conn, user_id, project_info_id)
    if dvsn in _AUTO_PROJECT_ROLES and is_project_participant(
        conn, user_id, project_info_id
    ):
        return sorted(set(base) | set(_PROJECT_FEATURE_IDS))
    return base


# 6.
def require_etl_infrastructure(
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    user_id = int(payload["user_id"])
    dvsn = get_user_dvsn_lower(conn, user_id)
    if dvsn not in ("sa_dev", "etl_manager"):
        raise HTTPException(status_code=403, detail=_MSG_ETL_INFRA)
    return payload


# 7.
def require_permission(*required: str) -> Callable[..., dict[str, Any]]:
    needed = tuple(required)

    def dependency(
        payload: dict = Depends(get_access_payload),
        conn=Depends(get_system_db),
    ) -> dict[str, Any]:
        user_id = int(payload["user_id"])
        dvsn = get_user_dvsn_lower(conn, user_id)
        if dvsn == "etl_manager":
            raise HTTPException(status_code=403, detail=_MSG_ETL_ACCOUNT_PROJECT)

        raw_pid = payload.get("project_info_id")
        if raw_pid is None:
            raise HTTPException(status_code=403, detail=_MSG_NO_PROJECT)
        project_info_id = int(raw_pid)

        if dvsn in _AUTO_PROJECT_ROLES and is_project_participant(
            conn, user_id, project_info_id
        ):
            if needed and all(n in _PROJECT_FEATURE_IDS for n in needed):
                return payload

        perms = get_permission_ids_for_user_project(conn, user_id, project_info_id)
        for n in needed:
            if n not in perms:
                raise HTTPException(status_code=403, detail=_MSG_FORBIDDEN)
        return payload

    return dependency
