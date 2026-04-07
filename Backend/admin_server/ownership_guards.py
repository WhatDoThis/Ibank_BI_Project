"""
Backend.admin_server.ownership_guards (역할·ETL·정지 목표 상태 vs 소유 자산)
================================================================
사용자 변경·정지 시 목표 `user_dvsn`·`etl_yn`(또는 정지=소유 불가)과 현재 소유 리소스의 정합성을
매트릭스로 판정하고, 이관이 필요한 항목만 구조화해 409 응답에 담는다. `dptmt_info.dptmt_create_user_id`(등록 부서) 포함.

[Main Functions]
===========
1. can_own_after_change: 리소스 논리 타입·목표 역할·목표 etl_yn 기준 소유 가능 여부
2. build_ownership_violation_payload: 스캔 결과 리스트 → changeable·blocking_assets·allowed_assets

[Dependencies]
=========
- typing (표준)
"""

from __future__ import annotations

from typing import Any


# 1. 목표 상태에서 소유 가능 여부 (문서·요청 매트릭스와 동일 취지)
def can_own_after_change(logical_type: str, new_dvsn: str, new_etl_yn: str) -> bool:
    nd = (new_dvsn or "").strip().lower()
    etl = (new_etl_yn or "N").strip().upper()
    if logical_type == "project":
        return nd in ("sa_dev", "sa", "a")
    if logical_type == "pmssn_master":
        return nd in ("sa_dev", "sa", "a")
    if logical_type == "table_master":
        return nd in ("sa_dev", "sa", "a", "o", "u")
    if logical_type == "etl_meta":
        if nd == "sa_dev":
            return True
        return etl == "Y"
    if logical_type == "dptmt_creator":
        return nd in ("sa", "sa_dev")
    return False


def _reason_for_block(logical_type: str, new_dvsn: str, new_etl_yn: str) -> str:
    nd = (new_dvsn or "").strip().lower() or "—"
    etl = (new_etl_yn or "N").strip().upper()
    if logical_type == "project":
        return (
            f"목표 역할({nd})로는 프로젝트 생성자를 유지할 수 없습니다. "
            "sa_dev·sa·a만 가능합니다.「목록」에서 생성자 이관 후 다시 시도하세요."
        )
    if logical_type == "pmssn_master":
        return (
            f"목표 역할({nd})로는 커스텀 권한 역할 등록자를 유지할 수 없습니다. "
            "sa_dev·sa·a만 가능합니다.「목록」에서 역할 등록자 이관 후 다시 시도하세요."
        )
    if logical_type == "table_master":
        return (
            f"목표 역할({nd})로는 테이블 마스터 등록을 유지할 수 없습니다. "
            "(규칙상 o·u도 가능해야 하므로, 이 메시지는 비정상입니다.)"
        )
    if logical_type == "etl_meta":
        return (
            f"목표 역할·ETL 자격(역할 {nd}, etl_yn={etl})으로는 ETL 등록 건을 유지할 수 없습니다. "
            "SA_DEV이거나 etl_yn=Y일 때만 가능합니다.「목록」에서 이관하거나 etl_yn을 부여한 뒤 다시 시도하세요."
        )
    if logical_type == "dptmt_creator":
        return (
            f"목표 역할({nd})로는 등록한 부서의 생성자를 유지할 수 없습니다. "
            "부서를 추가할 수 있는 역할(SA·SA_DEV)만 가능합니다.「목록」에서 부서 생성자 이관 후 다시 시도하세요."
        )
    return "소유를 유지할 수 없습니다."


class ManagementBlockedError(Exception):
    """관리 API에서 409 detail(JSON)으로 변환."""

    def __init__(self, payload: dict[str, Any]):
        self.payload = payload
        super().__init__(str(payload.get("message") or "변경할 수 없습니다."))


# 2.
def build_ownership_violation_payload(
    *,
    new_dvsn: str,
    new_etl_yn: str,
    for_suspend: bool,
    projects: list[dict[str, Any]],
    custom_pmssn: list[dict[str, Any]],
    table_masters: list[dict[str, Any]],
    departments: list[dict[str, Any]],
    etl_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    for_suspend=True 이면 비활성 상태는 어떤 소유도 불가 → 보유 건 전부 blocking.
    """
    blocking: list[dict[str, Any]] = []
    allowed: list[dict[str, Any]] = []

    proj_block: list[dict[str, Any]] = []
    for r in projects:
        pid = int(r["project_info_id"])
        name = str(r.get("project_name") or pid)
        if for_suspend or not can_own_after_change("project", new_dvsn, new_etl_yn):
            proj_block.append(
                {
                    "resource_type": "project",
                    "resource_id": pid,
                    "name": name,
                    "reason": (
                        "활성 계정이 아니면 생성물을 남길 수 없습니다.「목록」에서 이관 후 정지하세요."
                        if for_suspend
                        else _reason_for_block("project", new_dvsn, new_etl_yn)
                    ),
                }
            )
    if proj_block:
        blocking.append({"type": "project", "items": proj_block})
    elif projects and not for_suspend:
        allowed.append(
            {
                "type": "project",
                "count": len(projects),
                "note": "프로젝트 생성자로 유지됩니다.",
            }
        )

    pm_block: list[dict[str, Any]] = []
    for r in custom_pmssn:
        mid = int(r["pmssn_master_id"])
        name = str(r.get("pmssn_name") or mid)
        if for_suspend or not can_own_after_change("pmssn_master", new_dvsn, new_etl_yn):
            pm_block.append(
                {
                    "resource_type": "pmssn_master",
                    "resource_id": mid,
                    "name": name,
                    "reason": (
                        "활성 계정이 아니면 생성물을 남길 수 없습니다.「목록」에서 이관 후 정지하세요."
                        if for_suspend
                        else _reason_for_block("pmssn_master", new_dvsn, new_etl_yn)
                    ),
                }
            )
    if pm_block:
        blocking.append({"type": "pmssn_master", "items": pm_block})
    elif custom_pmssn and not for_suspend:
        allowed.append(
            {
                "type": "pmssn_master",
                "count": len(custom_pmssn),
                "note": "커스텀 권한 역할 등록자로 유지됩니다.",
            }
        )

    tm_block: list[dict[str, Any]] = []
    for r in table_masters:
        tmid = int(r["table_master_id"])
        name = str(r.get("display_name") or tmid)
        if for_suspend or not can_own_after_change("table_master", new_dvsn, new_etl_yn):
            tm_block.append(
                {
                    "resource_type": "table_master",
                    "resource_id": tmid,
                    "name": name,
                    "reason": (
                        "활성 계정이 아니면 생성물을 남길 수 없습니다.「목록」에서 이관 후 정지하세요."
                        if for_suspend
                        else _reason_for_block("table_master", new_dvsn, new_etl_yn)
                    ),
                }
            )
    if tm_block:
        blocking.append({"type": "table_master", "items": tm_block})
    elif table_masters and not for_suspend:
        allowed.append(
            {
                "type": "table_master",
                "count": len(table_masters),
                "note": "테이블 마스터 등록자로 유지됩니다.",
            }
        )

    dpt_block: list[dict[str, Any]] = []
    for r in departments:
        did = int(r["dptmt_info_id"])
        name = str(r.get("display_name") or r.get("dptmt_name") or did)
        if for_suspend or not can_own_after_change(
            "dptmt_creator", new_dvsn, new_etl_yn
        ):
            dpt_block.append(
                {
                    "resource_type": "dptmt_creator",
                    "resource_id": did,
                    "name": name,
                    "reason": (
                        "활성 계정이 아니면 생성물을 남길 수 없습니다.「목록」에서 이관 후 정지하세요."
                        if for_suspend
                        else _reason_for_block("dptmt_creator", new_dvsn, new_etl_yn)
                    ),
                }
            )
    if dpt_block:
        blocking.append({"type": "dptmt_creator", "items": dpt_block})
    elif departments and not for_suspend:
        allowed.append(
            {
                "type": "dptmt_creator",
                "count": len(departments),
                "note": "등록한 부서의 생성자로 유지됩니다.",
            }
        )

    etl_block: list[dict[str, Any]] = []
    for r in etl_items:
        rt = str(r["resource_type"])
        rid = int(r["resource_id"])
        name = str(r.get("name") or rid)
        if for_suspend or not can_own_after_change("etl_meta", new_dvsn, new_etl_yn):
            etl_block.append(
                {
                    "resource_type": rt,
                    "resource_id": rid,
                    "name": name,
                    "reason": (
                        "활성 계정이 아니면 ETL 등록을 남길 수 없습니다.「목록」에서 이관 후 정지하세요."
                        if for_suspend
                        else _reason_for_block("etl_meta", new_dvsn, new_etl_yn)
                    ),
                }
            )
    if etl_block:
        blocking.append({"type": "etl_meta", "items": etl_block})
    elif etl_items and not for_suspend:
        allowed.append(
            {
                "type": "etl_meta",
                "count": len(etl_items),
                "note": "ETL 등록 건을 그대로 유지합니다.",
            }
        )

    changeable = len(blocking) == 0
    msg = (
        "정지하려면 아래 소유를 먼저 이관하세요."
        if for_suspend
        else (
            "목표 역할·ETL 자격으로 유지할 수 없는 소유가 있습니다.「목록」에서 이관 후 다시 시도하세요."
            if not changeable
            else ""
        )
    )
    return {
        "changeable": changeable,
        "message": msg,
        "blocking_assets": blocking,
        "allowed_assets": allowed,
        "target": {
            "user_dvsn": new_dvsn,
            "etl_yn": new_etl_yn,
            "for_suspend": for_suspend,
        },
    }
