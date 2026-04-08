"""
Backend.auth_server.permissions (프로젝트·ETL 권한 검증)
======================================================
1) require_etl_infrastructure: JWT + user_info — `user_dvsn=sa_dev`, 레거시 원문 `etl_manager`, 또는 `etl_yn='Y'` 이면 ETL API 허용(프로젝트 불필요).
2) require_permission: JWT + project_ptcpnt_info·pmssn_master + **project_info.feature_flags** 교집합.
   `pmssn_list`는 `pmssn_detail_name` 문자열 표준. `sa_dev`·`sa`·`a`는 참여 시 §8 기능 ID를 **후보**로 합치되,
   **프로젝트 feature_flags에서 꺼진 기능은 API·/me 모두 거부·미노출**.
3) get_effective_permission_ids_for_me: /me — `compute_effective_project_permission_ids`와 동일.
4) get_project_enabled_feature_ids: `feature_flags` jsonb(query·dash·widget) → 권한 ID 집합(NULL·컬럼 없음이면 전체 허용).

[Main Functions]
===========
1. get_user_dvsn_lower: user_id → user_dvsn 소문자
2. user_has_etl_infrastructure_access: sa_dev·원문 etl_manager·또는 etl_yn=Y
3. is_project_participant: project_ptcpnt_info 존재 여부
4. resolve_pmssn_list_to_names: pmssn_list 배열 → pmssn_detail_name 목록
5. get_permission_ids_for_user_project: 유저·프로젝트별 권한ID 목록(정규화)
6. get_project_enabled_feature_ids: project_info.feature_flags → frozenset(컬럼 없음·NULL이면 전체)
7. compute_effective_project_permission_ids: (pmssn∪자동)∩enabled
8. get_effective_permission_ids_for_me: /me — compute 호출
9. require_etl_infrastructure: ETL 라우터용 Depends
10. require_permission: FastAPI Depends 팩토리 (*필요 권한 AND)

[Dependencies]
=========
- fastapi Depends HTTPException
- Backend.auth_server.deps.get_access_payload, Backend.core.dependencies.get_system_db
- Backend.core.user_dvsn_codes.canon_user_dvsn
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException
from psycopg2 import errors as pg_errors

from Backend.auth_server.deps import get_access_payload
from Backend.core.dependencies import get_system_db
from Backend.core.user_dvsn_codes import canon_user_dvsn

_MSG_NO_PROJECT = "프로젝트를 선택해주세요"
_MSG_FORBIDDEN = "이 작업을 수행할 권한이 없습니다."
_MSG_ETL_INFRA = (
    "ETL 관리 기능은 SA_DEV이거나 ETL 관리자 자격(etl_yn=Y)이 있는 계정만 사용할 수 있습니다."
)
_MSG_PROJECT_FEATURE_OFF = "이 프로젝트에서 사용할 수 없는 기능입니다."

# 프로젝트 UI 기능(매트릭스 §8). ETL 관리자 판별은 별도 require_etl_infrastructure.
PROJECT_UI_FEATURE_IDS = frozenset(
    {"query.read", "query.execute", "dashboard", "widgetboard"}
)
_PROJECT_FEATURE_IDS = PROJECT_UI_FEATURE_IDS
_AUTO_PROJECT_ROLES = frozenset({"sa_dev", "sa", "a"})


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
def user_has_etl_infrastructure_access(conn, user_id: int) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT user_dvsn, COALESCE(etl_yn, 'N') AS etl_yn
            FROM user_info WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return False
        raw_dvsn = (row.get("user_dvsn") or "").strip().lower()
        if raw_dvsn == "etl_manager":
            return True
        dvsn = canon_user_dvsn(row.get("user_dvsn"))
        if dvsn == "sa_dev":
            return True
        return (row.get("etl_yn") or "N").strip().upper() == "Y"
    finally:
        cur.close()


# 3.
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


# 4.
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


# 5.
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


# 6.
def _feature_flags_dict_to_ids(flags: dict[str, Any]) -> frozenset[str]:
    """query→query.read+query.execute, dash→dashboard, widget→widgetboard."""
    out: set[str] = set()
    if flags.get("query"):
        out.update({"query.read", "query.execute"})
    if flags.get("dash"):
        out.add("dashboard")
    if flags.get("widget"):
        out.add("widgetboard")
    return frozenset(out)


def get_project_enabled_feature_ids(conn, project_info_id: int) -> frozenset[str]:
    """project_info.feature_flags(JSONB). NULL·미설정·컬럼 없음=레거시 전체 허용."""
    cur = conn.cursor()
    try:
        try:
            cur.execute(
                """
                SELECT feature_flags FROM project_info WHERE project_info_id = %s
                """,
                (project_info_id,),
            )
        except pg_errors.UndefinedColumn:
            return frozenset(_PROJECT_FEATURE_IDS)
        row = cur.fetchone()
        if not row:
            return frozenset(_PROJECT_FEATURE_IDS)
        raw = row.get("feature_flags")
        if raw is None:
            return frozenset(_PROJECT_FEATURE_IDS)
        if isinstance(raw, str):
            import json

            raw = json.loads(raw)
        if not isinstance(raw, dict):
            return frozenset(_PROJECT_FEATURE_IDS)
        q = bool(raw.get("query", True))
        d = bool(raw.get("dash", True))
        w = bool(raw.get("widget", True))
        return _feature_flags_dict_to_ids({"query": q, "dash": d, "widget": w})
    finally:
        cur.close()


# 7.
def compute_effective_project_permission_ids(
    conn,
    user_id: int,
    project_info_id: int,
    user_dvsn: str | None,
) -> list[str]:
    dvsn = canon_user_dvsn(user_dvsn)
    enabled = get_project_enabled_feature_ids(conn, project_info_id)
    base = set(get_permission_ids_for_user_project(conn, user_id, project_info_id))
    if dvsn in _AUTO_PROJECT_ROLES and is_project_participant(
        conn, user_id, project_info_id
    ):
        base |= set(_PROJECT_FEATURE_IDS)
    return sorted(base & set(enabled))


# 8.
def get_effective_permission_ids_for_me(
    conn,
    user_id: int,
    project_info_id: int,
    user_dvsn: str | None,
) -> list[str]:
    return compute_effective_project_permission_ids(
        conn, user_id, project_info_id, user_dvsn
    )


# 9.
def require_etl_infrastructure(
    payload: dict = Depends(get_access_payload),
    conn=Depends(get_system_db),
) -> dict[str, Any]:
    user_id = int(payload["user_id"])
    if not user_has_etl_infrastructure_access(conn, user_id):
        raise HTTPException(status_code=403, detail=_MSG_ETL_INFRA)
    return payload


# 10.
def require_permission(*required: str) -> Callable[..., dict[str, Any]]:
    needed = tuple(required)

    def dependency(
        payload: dict = Depends(get_access_payload),
        conn=Depends(get_system_db),
    ) -> dict[str, Any]:
        user_id = int(payload["user_id"])
        raw_dvsn = get_user_dvsn_lower(conn, user_id)

        raw_pid = payload.get("project_info_id")
        if raw_pid is None:
            raise HTTPException(status_code=403, detail=_MSG_NO_PROJECT)
        project_info_id = int(raw_pid)

        eff = compute_effective_project_permission_ids(
            conn, user_id, project_info_id, raw_dvsn
        )
        eff_set = set(eff)
        for n in needed:
            if n not in eff_set:
                raise HTTPException(
                    status_code=403,
                    detail=_MSG_PROJECT_FEATURE_OFF
                    if n in _PROJECT_FEATURE_IDS
                    else _MSG_FORBIDDEN,
                )
        return payload

    return dependency
