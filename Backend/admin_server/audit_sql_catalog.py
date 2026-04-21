"""
Backend.admin_server.audit_sql_catalog (관리용 공용 SQL 템플릿·감사 지문 카탈로그)
======================================================================
`service_*` 의 `cur.execute(sql, params)` 와 `system_log.sql_fingerprint` 가 **동일 SQL 템플릿 문자열**을
참조하도록 상수를 한곳에 둔다. 여러 문은 실행은 문별 `execute`, 지문은 `; ` 로 이은 합성 문자열로 맞춘다.

[용어: SQL 카탈로그 DRY]
===================
- **DRY(Don't Repeat Yourself)**: 같은 SQL 문자열을 “서비스 실행 코드”와 “감사 지문 계산” 두 곳에
  따로 적어 두지 않고 **한 정의만** 두는 원칙.
- **SQL 카탈로그(catalog)**: 그 “한 정의”를 `SQL_*` 상수·소수의 빌더 함수로 모아 둔 **목록·등록표**에 가깝다.
  (DB 메타데이터의 catalog와 비슷하게, “무엇을 실행할지” 항목을 한곳에서 찾는다는 뜻.)
- 합쳐 말하면 **SQL 카탈로그 DRY** = “관리용 SQL 템플릿을 카탈로그에만 정의하고, 실행·지문이 그걸 공유한다”는 구현 방식을 가리킨다.

OR 매퍼가 아니라 **Audit / query catalog** 패턴이다. §13 규약은 `docs/main/04_DB_ARCHITECTURE.md`.

[계층 참고]
========
1) DB·미들웨어 감사  2) 본 모듈(앱 DRY)  3) 동적 SQL만 서비스 로컬 + 필요 시 `emit`에 `sql_fingerprint` 명시

[Main Functions]
===========
1. sql_project_info_update: project_info 동적 SET 절(조각 리스트)로 전체 UPDATE 문자열 생성
2. sql_delete_table_project_mapping_not_in: `NOT IN (%s,...)` 자리를 받아 DELETE 문자열 생성
3. sql_etl_transfer_update_statement: ETL 스키마 따옴표 테이블에 대한 create_user_id 이관 UPDATE 문자열
4. admin_audit_sql_fingerprint: 관리 액션·상세 JSON으로 지문 hex 또는 None

[Endpoints/Classes/Functions]
=======================
- sql_project_info_update(assignments) -> str
- sql_delete_table_project_mapping_not_in(placeholders_csv) -> str
- sql_etl_transfer_update_statement(quoted_table, pk_col, ts_set_fragment) -> str
- admin_audit_sql_fingerprint(business_action, detail_json) -> str | None

[Dependencies]
=========
- functools.lru_cache
- Backend.core.sql_fingerprint.compute_sql_fingerprint_hex
"""


from __future__ import annotations

from functools import lru_cache
from typing import Any

from Backend.core.sql_fingerprint import compute_sql_fingerprint_hex


# --- 공용 DML 템플릿 (서비스 `execute`와 동일 문자열을 import 해 사용) ---

SQL_INVITE_EMAIL_CODE_MASTER_INSERT = """
            INSERT INTO email_invite_code_master (
                email_invite_code, invite_target_email, dptmt_info_id, invite_target_dvsn,
                exprtn_dtm, used_yn, code_create_user_id, create_dtm,
                invite_etl_yn, invite_project_info_id, invite_pmssn_master_id
            ) VALUES (
                %s, %s, %s, %s, NOW() + INTERVAL '7 days', 'N', %s, NOW(),
                %s, %s, %s
            )
            """

SQL_USER_SUSPEND = (
    "UPDATE user_info SET user_active_yn = 'N', update_dtm = NOW() WHERE user_id = %s"
)
SQL_USER_ACTIVATE = (
    "UPDATE user_info SET user_active_yn = 'Y', update_dtm = NOW() WHERE user_id = %s"
)

SQL_DELETE_SESSION_LOG_BY_SESSION_CREATOR = (
    "DELETE FROM session_log WHERE session_create_user_id = %s"
)
SQL_DELETE_USER_LOGIN_LOG_BY_USER = "DELETE FROM user_login_log WHERE user_id = %s"
SQL_DELETE_NOTIFICATION_INFO_BY_USER = "DELETE FROM notification_info WHERE user_id = %s"
SQL_DELETE_PROJECT_PTCPNT_BY_PARTICIPANT_USER = (
    "DELETE FROM project_ptcpnt_info WHERE ptcpnt_user_id = %s"
)
SQL_DELETE_EMAIL_INVITE_BY_CODE_CREATOR = (
    "DELETE FROM email_invite_code_master WHERE code_create_user_id = %s"
)
SQL_DELETE_USER_INFO_BY_ID = "DELETE FROM user_info WHERE user_id = %s"

SQL_USER_DELETE_INACTIVE = "; ".join(
    (
        SQL_DELETE_SESSION_LOG_BY_SESSION_CREATOR,
        SQL_DELETE_USER_LOGIN_LOG_BY_USER,
        SQL_DELETE_NOTIFICATION_INFO_BY_USER,
        SQL_DELETE_PROJECT_PTCPNT_BY_PARTICIPANT_USER,
        SQL_DELETE_EMAIL_INVITE_BY_CODE_CREATOR,
        SQL_DELETE_USER_INFO_BY_ID,
    )
)

SQL_USER_ROLE_CHANGE = (
    "UPDATE user_info SET user_dvsn = %s, update_dtm = NOW() WHERE user_id = %s"
)
SQL_USER_ETL_FLAG = "UPDATE user_info SET etl_yn = %s, update_dtm = NOW() WHERE user_id = %s"
SQL_USER_INFO_SET_DPTMT_ID = (
    "UPDATE user_info SET dptmt_info_id = %s, update_dtm = NOW() WHERE user_id = %s"
)
SQL_USER_INFO_SET_ETL_YN_FORCE_N = (
    "UPDATE user_info SET etl_yn = 'N', update_dtm = NOW() WHERE user_id = %s"
)

SQL_DEPT_UPDATE_FULL = (
    "UPDATE dptmt_info SET dptmt_name = %s, dptmt_code = %s, use_yn = %s, update_dtm = NOW() "
    "WHERE dptmt_info_id = %s"
)
SQL_DEPT_UPDATE_NAME_ONLY = (
    "UPDATE dptmt_info SET dptmt_name = %s, update_dtm = NOW() WHERE dptmt_info_id = %s"
)
SQL_DEPT_INVALIDATE = (
    "UPDATE dptmt_info SET use_yn = %s, update_dtm = NOW() WHERE dptmt_info_id = %s"
)
SQL_DEPT_DELETE = "DELETE FROM dptmt_info WHERE dptmt_info_id = %s"
SQL_DEPT_CREATE_INSERT = """
            INSERT INTO dptmt_info (
                dptmt_code, dptmt_name, parent_dptmt_info_id, sort_order, use_yn,
                dptmt_create_user_id, create_dtm, update_dtm
            ) VALUES (%s, %s, %s, 0, 'Y', %s, NOW(), NOW())
            RETURNING dptmt_info_id
            """

SQL_USER_MANAGEMENT_UPDATE_COMPOSITE = (
    "UPDATE user_info SET dptmt_info_id = %s, update_dtm = NOW() WHERE user_id = %s; "
    "UPDATE user_info SET user_dvsn = %s, update_dtm = NOW() WHERE user_id = %s; "
    "UPDATE user_info SET etl_yn = 'N', update_dtm = NOW() WHERE user_id = %s; "
    "UPDATE user_info SET etl_yn = %s, update_dtm = NOW() WHERE user_id = %s; "
    "INSERT INTO project_ptcpnt_info ("
    "ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm"
    ") VALUES (%s, %s, %s, %s, NOW()) "
    "ON CONFLICT (project_info_id, ptcpnt_user_id) DO NOTHING; "
    "UPDATE project_ptcpnt_info SET pmssn_master_id = %s, update_dtm = NOW() "
    "WHERE project_info_id = %s AND ptcpnt_user_id = %s; "
    "DELETE FROM project_ptcpnt_info WHERE project_info_id = %s AND ptcpnt_user_id = %s"
)

SQL_PROJECT_PTCPNT_INFO_INSERT_ON_CONFLICT = (
    "INSERT INTO project_ptcpnt_info ("
    "ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm"
    ") VALUES (%s, %s, %s, %s, NOW()) "
    "ON CONFLICT (project_info_id, ptcpnt_user_id) DO NOTHING"
)

SQL_PROJECT_INFO_INSERT = """
            INSERT INTO project_info (
                dptmt_info_id, project_create_user_id, project_name, project_dscrtn,
                active_yn, create_dtm, feature_flags
            ) VALUES (%s, %s, %s, %s, 'Y', NOW(), %s)
            RETURNING project_info_id
            """

SQL_PROJECT_UPDATE_FULL = (
    "UPDATE project_info SET project_name = %s, project_dscrtn = %s, active_yn = %s, "
    "feature_flags = %s, update_dtm = NOW() WHERE project_info_id = %s"
)
SQL_PROJECT_DEACTIVATE = (
    "UPDATE project_info SET active_yn = 'N', update_dtm = NOW() WHERE project_info_id = %s"
)

SQL_PROJECT_SET_PROJECT_NAME = "project_name = %s"
SQL_PROJECT_SET_PROJECT_DSCRTN = "project_dscrtn = %s"
SQL_PROJECT_SET_ACTIVE_YN = "active_yn = %s"
SQL_PROJECT_SET_FEATURE_FLAGS = "feature_flags = %s"

SQL_PURGE_DELETE_NOTIF_PROJECT_INVITE_BY_JSON_PID = (
    "DELETE FROM notification_info "
    "WHERE noti_type = 'project_invite' "
    "AND COALESCE(noti_content::text, '') <> '' "
    "AND NULLIF(TRIM(noti_content::json->>'project_info_id'), '') IS NOT NULL "
    "AND (noti_content::json->>'project_info_id')::int = %s"
)
SQL_PURGE_USER_INFO_CLEAR_INVITE_PROJECT = (
    "UPDATE user_info SET invite_project_info_id = NULL, invite_pmssn_master_id = NULL, "
    "update_dtm = NOW() WHERE invite_project_info_id = %s"
)
SQL_PURGE_EMAIL_INVITE_CODE_MASTER_CLEAR_INVITE_PROJECT = (
    "UPDATE email_invite_code_master SET invite_project_info_id = NULL, "
    "invite_pmssn_master_id = NULL, update_dtm = NOW() WHERE invite_project_info_id = %s"
)
SQL_PURGE_WIDGET_ITEM_USING_PROJECT = (
    "DELETE FROM widget_item wi USING widget_board wb "
    "WHERE wi.widget_board_id = wb.widget_board_id AND wb.project_info_id = %s"
)
SQL_PURGE_WIDGET_BOARD_SHARE_USING_PROJECT = (
    "DELETE FROM widget_board_share sh USING widget_board wb "
    "WHERE sh.widget_board_id = wb.widget_board_id AND wb.project_info_id = %s"
)
SQL_PURGE_WIDGET_BOARD_BY_PROJECT = "DELETE FROM widget_board WHERE project_info_id = %s"
SQL_PURGE_TABLE_PROJECT_MAPPING_BY_PROJECT = (
    "DELETE FROM table_project_mapping WHERE project_info_id = %s"
)
SQL_PURGE_PROJECT_PTCPNT_BY_PROJECT = (
    "DELETE FROM project_ptcpnt_info WHERE project_info_id = %s"
)
SQL_PURGE_PROJECT_INFO_BY_ID = "DELETE FROM project_info WHERE project_info_id = %s"
SQL_PURGE_SELECT_WIDGET_BOARD_IDS_BY_PROJECT = (
    "SELECT widget_board_id FROM widget_board WHERE project_info_id = %s ORDER BY widget_board_id"
)

SQL_PROJECT_PURGE_COMPOSITE = "; ".join(
    (
        SQL_PURGE_DELETE_NOTIF_PROJECT_INVITE_BY_JSON_PID,
        SQL_PURGE_USER_INFO_CLEAR_INVITE_PROJECT,
        SQL_PURGE_EMAIL_INVITE_CODE_MASTER_CLEAR_INVITE_PROJECT,
        SQL_PURGE_WIDGET_ITEM_USING_PROJECT,
        SQL_PURGE_WIDGET_BOARD_SHARE_USING_PROJECT,
        SQL_PURGE_WIDGET_BOARD_BY_PROJECT,
        SQL_PURGE_TABLE_PROJECT_MAPPING_BY_PROJECT,
        SQL_PURGE_PROJECT_PTCPNT_BY_PROJECT,
        SQL_PURGE_PROJECT_INFO_BY_ID,
    )
)

SQL_NOTIFICATION_DELETE_BY_ID = (
    "DELETE FROM notification_info WHERE notification_info_id = %s"
)

SQL_PROJECT_PTCPNT_INFO_INSERT = (
    "INSERT INTO project_ptcpnt_info ("
    "ptcpnt_user_id, invite_user_id, project_info_id, pmssn_master_id, create_dtm"
    ") VALUES (%s, %s, %s, %s, NOW())"
)

SQL_NOTIFICATION_INFO_INSERT = (
    "INSERT INTO notification_info ("
    "user_id, noti_type, noti_title, noti_content, read_yn, create_dtm"
    ") VALUES (%s, %s, %s, %s, 'N', NOW()) RETURNING notification_info_id"
)

SQL_MEMBER_ROLE_UPDATE = (
    "UPDATE project_ptcpnt_info SET pmssn_master_id = %s, update_dtm = NOW() "
    "WHERE project_info_id = %s AND ptcpnt_user_id = %s"
)
SQL_MEMBER_REMOVE = (
    "DELETE FROM project_ptcpnt_info WHERE project_info_id = %s AND ptcpnt_user_id = %s"
)

SQL_PMSSN_MASTER_INSERT = """
            INSERT INTO pmssn_master (
                dptmt_info_id, pmssn_name, pmssn_list, system_dflt_yn, user_id, create_dtm
            ) VALUES (%s, %s, %s, 'N', %s, NOW())
            RETURNING pmssn_master_id
            """

SQL_PMSSN_MASTER_UPDATE_NAME = (
    "UPDATE pmssn_master SET pmssn_name = %s, update_dtm = NOW() WHERE pmssn_master_id = %s"
)
SQL_PMSSN_MASTER_UPDATE_LIST = (
    "UPDATE pmssn_master SET pmssn_list = %s, update_dtm = NOW() WHERE pmssn_master_id = %s"
)
SQL_ROLE_UPDATE_FINGERPRINT = "; ".join((SQL_PMSSN_MASTER_UPDATE_NAME, SQL_PMSSN_MASTER_UPDATE_LIST))

SQL_PMSSN_MASTER_DELETE = "DELETE FROM pmssn_master WHERE pmssn_master_id = %s"

SQL_TABLE_MASTER_SET_LABEL = (
    "UPDATE table_master SET table_label = %s, update_dtm = NOW() WHERE table_master_id = %s"
)
SQL_TABLE_MASTER_SET_DSCRTN = (
    "UPDATE table_master SET table_dscrtn = %s, update_dtm = NOW() WHERE table_master_id = %s"
)
SQL_TABLE_MASTER_UPDATE_FINGERPRINT = "; ".join((SQL_TABLE_MASTER_SET_LABEL, SQL_TABLE_MASTER_SET_DSCRTN))

SQL_TABLE_PROJECT_MAPPING_INSERT = """
            INSERT INTO table_project_mapping (
                project_info_id, table_master_id, create_dtm,
                use_query_studio_yn, use_widgetboard_yn
            ) VALUES (%s, %s, NOW(), 'Y', 'Y')
            """

SQL_TABLE_PROJECT_MAPPING_DELETE = (
    "DELETE FROM table_project_mapping WHERE project_info_id = %s AND table_master_id = %s"
)

SQL_TABLE_PROJECT_MAPPING_INSERT_UPSERT_YY = """
                    INSERT INTO table_project_mapping (
                        project_info_id, table_master_id, create_dtm,
                        use_query_studio_yn, use_widgetboard_yn
                    ) VALUES (%s, %s, NOW(), 'Y', 'Y')
                    ON CONFLICT (project_info_id, table_master_id) DO UPDATE SET
                        use_query_studio_yn = 'Y',
                        use_widgetboard_yn = 'Y'
                    """

SQL_TABLE_PROJECT_MAPPING_UPSERT_USAGE_FLAGS = """
            INSERT INTO table_project_mapping (
                project_info_id, table_master_id, create_dtm,
                use_query_studio_yn, use_widgetboard_yn
            ) VALUES (%s, %s, NOW(), %s, %s)
            ON CONFLICT (project_info_id, table_master_id) DO UPDATE SET
                use_query_studio_yn = EXCLUDED.use_query_studio_yn,
                use_widgetboard_yn = EXCLUDED.use_widgetboard_yn
            """

SQL_DELETE_TABLE_PROJECT_MAPPING_BY_PROJECT = (
    "DELETE FROM table_project_mapping WHERE project_info_id = %s"
)

SQL_TABLE_MASTER_SELECT_DB_TYPE_NORM = """
            SELECT LOWER(TRIM(COALESCE(db_type, ''))) AS db_type_norm
            FROM table_master WHERE table_master_id = %s
            """

# 소유 이관(감사 카탈로그 기본 지문·execute 공용)
SQL_OWNERSHIP_ETL_CONNECTION = (
    "UPDATE etl_connections SET create_user_id = %s, updated_at = NOW() "
    "WHERE connection_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_ETL_TABLE = (
    "UPDATE etl_tables SET create_user_id = %s, updated_at = NOW() "
    "WHERE etl_table_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_ETL_JOB = (
    "UPDATE etl_jobs SET create_user_id = %s WHERE job_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_ETL_STORAGE_CONNECTION = (
    "UPDATE etl_storage_connections SET create_user_id = %s, updated_at = NOW() "
    "WHERE storage_connection_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_BATCH_FOLDER_CONNECTION = (
    "UPDATE batch_folder_connections SET create_user_id = %s, updated_at = NOW() "
    "WHERE folder_connection_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_BATCH_JOB = (
    "UPDATE batch_jobs SET create_user_id = %s, updated_at = NOW() "
    "WHERE batch_job_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_TABLE_MASTER = (
    "UPDATE table_master SET create_user_id = %s, update_dtm = NOW() "
    "WHERE table_master_id = %s AND create_user_id = %s"
)
SQL_OWNERSHIP_DPTMT_CREATOR = (
    "UPDATE dptmt_info SET dptmt_create_user_id = %s, update_dtm = NOW() "
    "WHERE dptmt_info_id = %s AND dptmt_create_user_id = %s"
)
SQL_OWNERSHIP_WIDGET_BOARD_OWNER = (
    "UPDATE widget_board SET owner_user_id = %s, update_dtm = NOW() "
    "WHERE widget_board_id = %s AND owner_user_id = %s"
)
SQL_OWNERSHIP_WIDGET_ITEM_BY_BOARD = (
    "UPDATE widget_item SET create_user_id = %s, update_dtm = NOW() WHERE widget_board_id = %s"
)
SQL_OWNERSHIP_WIDGET_BOARD_FINGERPRINT = "; ".join(
    (SQL_OWNERSHIP_WIDGET_BOARD_OWNER, SQL_OWNERSHIP_WIDGET_ITEM_BY_BOARD)
)
SQL_OWNERSHIP_PROJECT_INVITE = (
    "UPDATE project_ptcpnt_info SET invite_user_id = %s, update_dtm = NOW() "
    "WHERE project_ptcpnt_info_id = %s AND invite_user_id = %s"
)
SQL_OWNERSHIP_PROJECT_CREATE_USER = (
    "UPDATE project_info SET project_create_user_id = %s, update_dtm = NOW() "
    "WHERE project_info_id = %s"
)
SQL_OWNERSHIP_PMSSN_MASTER_USER = (
    "UPDATE pmssn_master SET user_id = %s, update_dtm = NOW() WHERE pmssn_master_id = %s"
)

_OWNERSHIP_SQL_BY_RESOURCE: dict[str, str] = {
    "etl_connection": SQL_OWNERSHIP_ETL_CONNECTION,
    "etl_table": SQL_OWNERSHIP_ETL_TABLE,
    "etl_job": SQL_OWNERSHIP_ETL_JOB,
    "etl_storage_connection": SQL_OWNERSHIP_ETL_STORAGE_CONNECTION,
    "batch_folder_connection": SQL_OWNERSHIP_BATCH_FOLDER_CONNECTION,
    "batch_job": SQL_OWNERSHIP_BATCH_JOB,
    "table_master": SQL_OWNERSHIP_TABLE_MASTER,
    "dptmt_creator": SQL_OWNERSHIP_DPTMT_CREATOR,
    "widget_board": SQL_OWNERSHIP_WIDGET_BOARD_FINGERPRINT,
    "project_invite": SQL_OWNERSHIP_PROJECT_INVITE,
    "project": SQL_OWNERSHIP_PROJECT_CREATE_USER,
    "pmssn_master": SQL_OWNERSHIP_PMSSN_MASTER_USER,
}

_SQL_TEMPLATE_BY_ACTION: dict[str, str] = {
    "invite_send": SQL_INVITE_EMAIL_CODE_MASTER_INSERT,
    "user_suspend": SQL_USER_SUSPEND,
    "user_activate": SQL_USER_ACTIVATE,
    "user_delete_inactive": SQL_USER_DELETE_INACTIVE,
    "user_role_change": SQL_USER_ROLE_CHANGE,
    "user_etl_flag": SQL_USER_ETL_FLAG,
    "dept_invalidate": SQL_DEPT_INVALIDATE,
    "dept_delete": SQL_DEPT_DELETE,
    "dept_create": SQL_DEPT_CREATE_INSERT,
    "user_management_update": SQL_USER_MANAGEMENT_UPDATE_COMPOSITE,
    "project_create": SQL_PROJECT_INFO_INSERT,
    "project_update": SQL_PROJECT_UPDATE_FULL,
    "project_deactivate": SQL_PROJECT_DEACTIVATE,
    "project_purge": SQL_PROJECT_PURGE_COMPOSITE,
    "invite_cancel": SQL_NOTIFICATION_DELETE_BY_ID,
    "member_role_update": SQL_MEMBER_ROLE_UPDATE,
    "member_remove": SQL_MEMBER_REMOVE,
    "role_create": SQL_PMSSN_MASTER_INSERT,
    "role_update": SQL_ROLE_UPDATE_FINGERPRINT,
    "role_delete": SQL_PMSSN_MASTER_DELETE,
    "table_master_update": SQL_TABLE_MASTER_UPDATE_FINGERPRINT,
    "table_mapping_add": SQL_TABLE_PROJECT_MAPPING_INSERT,
    "table_mapping_delete": SQL_TABLE_PROJECT_MAPPING_DELETE,
}


# 1.
def sql_project_info_update(assignments: list[str]) -> str:
    """`project_name = %s` 등 SET 조각만 넣고, 마지막에 `update_dtm = NOW()`·WHERE 를 붙인다."""
    if not assignments:
        raise ValueError("sql_project_info_update: assignments 비어 있음")
    parts = list(assignments) + ["update_dtm = NOW()"]
    return f"UPDATE project_info SET {', '.join(parts)} WHERE project_info_id = %s"


# 2.
def sql_delete_table_project_mapping_not_in(placeholders_csv: str) -> str:
    """placeholders_csv: `%s, %s, ...` 형태(개수는 호출부에서 `len(ids)` 와 일치)."""
    return (
        "DELETE FROM table_project_mapping "
        f"WHERE project_info_id = %s AND table_master_id NOT IN ({placeholders_csv})"
    )


# 3.
def sql_etl_transfer_update_statement(
    quoted_table: str, pk_col: str, ts_set_fragment: str
) -> str:
    """quoted_table: `"schema"."table"` 형태. ts_set_fragment: `, col = NOW()` 또는 빈 문자열."""
    return f"""
            UPDATE {quoted_table}
            SET create_user_id = %s{ts_set_fragment}
            WHERE {pk_col} = %s AND create_user_id = %s
            """


# 4.
@lru_cache(maxsize=256)
def _fingerprint_hex_cached(sql_template: str) -> str | None:
    return compute_sql_fingerprint_hex(sql_template)


# 5.
def _resolve_admin_sql_template(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    ba = (business_action or "").strip()
    dj = detail_json or {}
    if ba == "member_add":
        outcome = (dj.get("x_outcome") or "").strip().lower()
        if outcome == "invite_sent":
            return SQL_NOTIFICATION_INFO_INSERT
        return SQL_PROJECT_PTCPNT_INFO_INSERT
    if ba == "ownership_transfer":
        rt = (dj.get("resource_type") or "").strip().lower()
        return _OWNERSHIP_SQL_BY_RESOURCE.get(rt)
    if ba == "dept_update":
        if (dj.get("x_field") or "") == "dptmt_name_only":
            return SQL_DEPT_UPDATE_NAME_ONLY
        return SQL_DEPT_UPDATE_FULL
    return _SQL_TEMPLATE_BY_ACTION.get(ba)


# 6.
def admin_audit_sql_fingerprint(
    business_action: str, detail_json: dict[str, Any] | None
) -> str | None:
    tpl = _resolve_admin_sql_template(business_action, detail_json)
    if not tpl:
        return None
    return _fingerprint_hex_cached(tpl)
