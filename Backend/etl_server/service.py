"""
Backend.etl_server.service (ETL 메타 CRUD·시스템 DB)
=====================================================
etl_connections, etl_tables, etl_jobs 조회·등록·갱신. 시스템 DB 전용.

[Main Functions]
===========
1. _resolve_upload_path_for_delete: 삭제할 파일 경로 해석
2. _get_db, _schema, _q, _table_columns_lower, _table_exists, _etl_conn_*·_storage_conn_type_*·_storage_conn_password_column_for_insert·_storage_physical_select_fragments, _etl_jobs_j_select_sql, _etl_tables_join_select_parts(list_jobs/get_job용 t.*), _apply_etl_job_list_compat_keys, _etl_tables_t_select_sql, _append_creator_columns_etl, _normalize_etl_connection_row, _normalize_storage_connection_row, _builtin_storage_connections_for_list, _sys_cursor: DB·스키마·쿼리·information_schema·커서 헬퍼
3. get_target_db_connection: 적재 대상 DB 연결 (NULL=내장 main_db, STORAGE_BUILTIN_DASH_ID=-1=내장 dash_db, 양수=etl_storage_connections). should_upsert_table_master_for_storage·table_master_db_type_for_storage: 프로젝트용 table_master 반영은 내장 main|dash만.
4. _validate_identifier, _normalize_source_table_dots, _validate_source_table, parse_source_table_parts
5. _connection_error_to_user_message, _connect_postgres, _connect_mysql, _connect_oracle
6. _fetch_pk_from_mysql, _fetch_pk_from_oracle
7. list_timezones, create_connection, list_connections(활성만·is_active 컬럼 시), get_connection_for_etl, test_connection
8. list_storage_connections(선두 내장 main·dash + etl_storage_connections), get_storage_connection
9. list_target_tables, list_target_columns, target_table_exists, get_target_table_column_names, get_target_pk_columns
10. list_etl_tables(_etl_tables_t_select_sql), create_etl_table(동적 INSERT), get_etl_table, get_sync_mode_for_load(full|incremental|diff), _storage_pg_identity_tuple·_find_downstream_etl_reading_target_pg(다운스트림 소스 검사), _count_table_project_mapping_for_target, delete_etl_table(공유타겟·다운스트림·프로젝트매핑 검증 후 배치·table_master·DROP·메타 일괄)·delete_etl_table_row_only(etl_jobs.add_file_path 있을 때만 SELECT), update_last_synced_at, update_etl_table(컬럼 존재 시만 SET), refresh_etl_table_column_mapping
11. insert_job(add_file_path·add_file_type 컬럼 있을 때만 해당 INSERT), set_job_running, list_jobs·get_job(etl_tables JOIN에 table_label 포함; description 등 job 메타 키는 compat None), delete_job(add_file_path 없으면 SELECT 생략), fetch_pending_jobs, claim_next_pending_job, count_running_jobs, is_job_cancelled, update_job, set_job_total_rows, update_job_progress, update_etl_table_status(status 컬럼 없으면 no-op)

[Dependencies]
=========
- Backend.core.db (get_db_connection_system, get_system_table_schema)
- psycopg2, PyMySQL, oracledb (외부 DB 연결·테스트·소스 테이블 목록)
"""

import json
import logging
import os
import re
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

# 업로드 디렉터리(router·load_service와 동일). 삭제 시 경로 해석용.
_UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"


def _resolve_upload_path_for_delete(file_path: Optional[str]) -> Optional[str]:
    """
    DB에 저장된 file_path로 실제 삭제할 파일 경로 반환.
    절대 경로가 있으면 그대로, 없으면 uploads/파일명 또는 uploads/zip_xxx/... 로 해석. 존재하는 경로만 반환.
    """
    p = (file_path or "").strip()
    if not p:
        return None
    if os.path.isfile(p):
        return p
    base = os.path.basename(p)
    if base:
        fallback = _UPLOAD_DIR / base
        try:
            if fallback.is_file():
                return str(fallback.resolve())
        except (OSError, PermissionError):
            pass
    normalized = p.replace("\\", "/")
    for sep in ["/uploads/", "/uploads", "\\uploads\\", "\\uploads"]:
        if sep in normalized:
            idx = normalized.rfind(sep)
            suffix = normalized[idx + len(sep):].lstrip("/\\").replace("\\", "/")
            if suffix:
                fallback = _UPLOAD_DIR / suffix
                try:
                    if fallback.is_file():
                        return str(fallback.resolve())
                except (OSError, PermissionError):
                    pass
            break
    return None

try:
    import psycopg2
except ImportError:
    psycopg2 = None


def _get_db():
    """순환 import 방지: Backend.core.db를 사용 시점에 로드."""
    from Backend.core import db as api_db
    return api_db


def _schema():
    return _get_db().get_system_table_schema()


def _q(schema_name: str, table_name: str) -> str:
    """스키마.테이블명 따옴표 감싸기."""
    return f'"{schema_name}"."{table_name}"'


def _table_columns_lower(cur, schema_name: str, table_name: str) -> set:
    """
    information_schema 기준 테이블 컬럼명 소문자 집합.
    시스템 DB DDL이 앱보다 낮을 때(예: storage_connection_id 미추가) 쿼리 분기용.
    """
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema_name, table_name),
    )
    rows = cur.fetchall()
    out = set()
    for row in rows:
        if isinstance(row, dict):
            out.add(str(row.get("column_name", "")).lower())
        else:
            out.add(str(row[0]).lower())
    return out


def _table_exists(cur, schema_name: str, table_name: str) -> bool:
    """현재 연결 DB·스키마에 테이블이 있는지(ETL DB에 user_info 없을 때 JOIN 생략)."""
    cur.execute(
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema_name, table_name),
    )
    return cur.fetchone() is not None


def _etl_conn_type_select_sql(cols: set, alias: Optional[str]) -> str:
    """etl_connections 조회: API 키 source_type. 실측 source_type 또는 db_type AS source_type."""
    prefix = f"{alias}." if alias else ""
    if "source_type" in cols:
        return f"{prefix}source_type"
    if "db_type" in cols:
        return f"{prefix}db_type AS source_type"
    return "NULL::varchar AS source_type"


def _etl_conn_password_select_expr(cols: set, alias: Optional[str]) -> str:
    """etl_connections 조회: encrypted_password로 통일."""
    prefix = f"{alias}." if alias else ""
    if "encrypted_password" in cols:
        return f"{prefix}encrypted_password"
    if "password" in cols:
        return f"{prefix}password AS encrypted_password"
    return "NULL::text AS encrypted_password"


def _etl_conn_type_column_for_insert(cols: set) -> str:
    if "source_type" in cols:
        return "source_type"
    if "db_type" in cols:
        return "db_type"
    raise RuntimeError("etl_connections에 source_type 또는 db_type 컬럼이 필요합니다.")


def _etl_conn_password_column_for_insert(cols: set) -> str:
    if "encrypted_password" in cols:
        return "encrypted_password"
    if "password" in cols:
        return "password"
    raise RuntimeError("etl_connections에 encrypted_password 또는 password 컬럼이 필요합니다.")


def _storage_conn_type_select_sql(cols: set, alias: Optional[str] = None) -> str:
    """etl_storage_connections: API source_type. 실측 source_type 또는 storage_type AS source_type."""
    prefix = f"{alias}." if alias else ""
    if "source_type" in cols:
        return f"{prefix}source_type"
    if "storage_type" in cols:
        return f"{prefix}storage_type AS source_type"
    return "NULL::varchar AS source_type"


def _storage_conn_type_column_for_insert(cols: set) -> str:
    if "source_type" in cols:
        return "source_type"
    if "storage_type" in cols:
        return "storage_type"
    raise RuntimeError("etl_storage_connections에 source_type 또는 storage_type 컬럼이 필요합니다.")


def _storage_conn_password_column_for_insert(cols: set) -> Optional[str]:
    """물리 비밀번호 컬럼이 있으면 컬럼명. 없으면 None(config_json만 사용)."""
    if "encrypted_password" in cols:
        return "encrypted_password"
    if "password" in cols:
        return "password"
    return None


def _storage_physical_select_fragments(cols: set, *, include_secret: bool) -> list[str]:
    """조회 SELECT 절에 붙일 물리 컬럼 목록. list는 비밀번호 제외."""
    out: list[str] = []
    for c in ("host", "port", "database_name", "schema_name", "username"):
        if c in cols:
            out.append(c)
    if include_secret:
        if "encrypted_password" in cols:
            out.append("encrypted_password")
        elif "password" in cols:
            out.append("password AS encrypted_password")
    return out


# etl_tables·batch_jobs.storage_connection_id: NULL=config.main_db, -1=config.dash_db(내장), 양수=etl_storage_connections
STORAGE_BUILTIN_DASH_ID = -1


def is_builtin_main_storage(storage_connection_id: Any) -> bool:
    return storage_connection_id is None


def is_builtin_dash_storage(storage_connection_id: Any) -> bool:
    try:
        return int(storage_connection_id) == STORAGE_BUILTIN_DASH_ID
    except (TypeError, ValueError):
        return False


def should_upsert_table_master_for_storage(storage_connection_id: Any) -> bool:
    """프로젝트 매핑용 table_master는 내장 main·dash 적재에만 반영. 기타 저장 DB는 미기록."""
    return is_builtin_main_storage(storage_connection_id) or is_builtin_dash_storage(storage_connection_id)


def table_master_db_type_for_storage(storage_connection_id: Any) -> str:
    """내장 dash → dash, 내장 main → main. 커스텀 저장소에서는 호출하지 않음."""
    return "dash" if is_builtin_dash_storage(storage_connection_id) else "main"


def _builtin_storage_connections_for_list() -> List[dict]:
    """
    GET /api/etl/storage-connections 응답 선두에 붙는 내장 적재 DB(main·dash).
    etl_storage_connections 행이 아니며 삭제·PATCH 대상이 아님(is_builtin=True).
    """
    api = _get_db()
    main_name = "main_db"
    dash_name = "dash_db"
    try:
        main_name = api.get_db_config()["database"]
    except Exception:
        logger.warning("_builtin_storage_connections_for_list: main_db 이름 조회 실패", exc_info=True)
    try:
        dash_name = api.get_dash_db_config()["database"]
    except Exception:
        logger.warning("_builtin_storage_connections_for_list: dash_db 이름 조회 실패", exc_info=True)
    return [
        {
            "storage_connection_id": None,
            "connection_name": f"기본 (main) · {main_name}",
            "source_type": "builtin_main",
            "is_builtin": True,
            "is_active": True,
            "config_json": None,
        },
        {
            "storage_connection_id": STORAGE_BUILTIN_DASH_ID,
            "connection_name": f"기본 (dash) · {dash_name}",
            "source_type": "builtin_dash",
            "is_builtin": True,
            "is_active": True,
            "config_json": None,
        },
    ]


# etl_jobs 목록·단건 SELECT 시 DDL 버전 차이(rows_processed 등 미추가) 대응
_ETL_JOBS_SELECT_COLS: tuple[tuple[str, str], ...] = (
    ("job_id", "integer"),
    ("etl_table_id", "integer"),
    ("status", "text"),
    ("started_at", "timestamp with time zone"),
    ("finished_at", "timestamp with time zone"),
    ("rows_processed", "integer"),
    ("total_rows", "bigint"),
    ("error_message", "text"),
    ("notice", "text"),
    ("add_file_path", "text"),
    ("add_file_type", "text"),
    ("created_at", "timestamp with time zone"),
)


def _etl_jobs_j_select_sql(jcols: set) -> str:
    """information_schema 기준으로 존재하는 컬럼만 j.col, 없으면 NULL::cast AS col."""
    parts: list[str] = []
    for name, cast in _ETL_JOBS_SELECT_COLS:
        if name in jcols:
            parts.append(f"j.{name}")
        elif name == "rows_processed" and "rows_loaded" in jcols:
            parts.append("j.rows_loaded AS rows_processed")
        elif name == "total_rows" and "rows_extracted" in jcols:
            parts.append("j.rows_extracted AS total_rows")
        else:
            parts.append(f"NULL::{cast} AS {name}")
    return ", ".join(parts)


def _etl_tables_join_select_parts(tcols: set) -> str:
    """etl_tables LEFT JOIN용 SELECT 조각(list_jobs/get_job). target_table, source_table, connection_id, sync_mode, table_label(이력 라벨)."""
    parts: list[str] = []
    for name, cast in (
        ("target_table", "text"),
        ("source_table", "text"),
        ("connection_id", "integer"),
        ("sync_mode", "text"),
        ("table_label", "text"),
    ):
        if name in tcols:
            parts.append(f"t.{name}")
        else:
            parts.append(f"NULL::{cast} AS {name}")
    return ", ".join(parts)


def _apply_etl_job_list_compat_keys(rows: list) -> None:
    """etl_jobs 정본에 없는 필드 등 예전 API 키 호환(None)."""
    for d in rows:
        d.setdefault("description", None)
        d.setdefault("table_label", None)
        d.setdefault("source_type", None)
        d.setdefault("job_type", None)
        d.setdefault("storage_connection_id", None)


def _etl_tables_t_select_sql(tcols: set) -> str:
    """etl_tables 목록/단건 공통 SELECT 조각. 없는 컬럼은 NULL AS로 보정."""
    col_casts = [
        ("etl_table_id", "integer"),
        ("connection_id", "integer"),
        ("source_table", "text"),
        ("target_table", "text"),
        ("description", "text"),
        ("table_label", "text"),
        ("table_dscrtn", "text"),
        ("file_type", "text"),
        ("file_path", "text"),
        ("pk_columns", "text"),
        ("incremental_column", "text"),
        ("last_synced_at", "timestamp with time zone"),
        ("sync_mode", "text"),
        ("batch_size", "integer"),
        ("batch_interval_seconds", "integer"),
        ("status", "text"),
        ("created_at", "timestamp with time zone"),
        ("storage_connection_id", "integer"),
        ("column_mapping", "jsonb"),
        ("on_row_error", "text"),
        ("index_definitions", "jsonb"),
        ("diff_delete_orphans", "boolean"),
    ]
    parts: list[str] = []
    for name, cast in col_casts:
        if name in tcols:
            parts.append(f"t.{name}")
        else:
            parts.append(f"NULL::{cast} AS {name}")
    return ", ".join(parts)


def _append_creator_columns_etl(
    cols: set,
    create_user_id: Optional[int],
    created_by: str,
) -> tuple[list[str], list[Any]]:
    """
    ETL 메타 INSERT용 생성자 컬럼·값.
    DB에 create_user_id가 있으면 JWT user_id 저장. created_by(varchar)만 있는 레거시 스키마는 문자열 유지.
    둘 다 있으면 둘 다 채움.
    """
    names: list[str] = []
    vals: list[Any] = []
    cb = (created_by or "").strip() or (str(create_user_id) if create_user_id is not None else "user")
    if "create_user_id" in cols:
        names.append("create_user_id")
        vals.append(create_user_id)
    if "created_by" in cols:
        names.append("created_by")
        vals.append(cb)
    return names, vals


def _normalize_etl_connection_row(d: Optional[dict]) -> Optional[dict]:
    """ibank_etl_data 물리 컬럼 db_type·password를 조회 결과에 맞춰 앱 관례 키(source_type·encrypted_password)로 통일."""
    if not d:
        return d
    out = dict(d)
    if out.get("source_type") is None and out.get("db_type") is not None:
        out["source_type"] = out.get("db_type")
    if out.get("encrypted_password") is None and out.get("password") is not None:
        out["encrypted_password"] = out.get("password")
    return out


def _normalize_storage_connection_row(d: Optional[dict]) -> Optional[dict]:
    """config_json 단일 컬럼 스키마일 때 host 등을 풀어 API 응답 호환."""
    if not d:
        return d
    out = dict(d)
    if out.get("storage_type") is not None and out.get("source_type") is None:
        out["source_type"] = out.get("storage_type")
    cfg = out.get("config_json")
    if cfg is not None and out.get("host") is None:
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except (TypeError, ValueError):
                cfg = {}
        if isinstance(cfg, dict):
            out.setdefault("host", cfg.get("host"))
            out.setdefault("port", cfg.get("port"))
            out.setdefault("database_name", cfg.get("database_name"))
            out.setdefault("schema_name", cfg.get("schema_name"))
            out.setdefault("username", cfg.get("username"))
            if out.get("encrypted_password") is None and cfg.get("password") is not None:
                out["encrypted_password"] = cfg.get("password")
            if cfg.get("server_timezone"):
                out.setdefault("server_timezone", cfg.get("server_timezone"))
    if out.get("encrypted_password") is None and out.get("password") is not None:
        out["encrypted_password"] = out.get("password")
    return out


@contextmanager
def _sys_cursor():
    """시스템 DB 커서·커넥션 컨텍스트. yield (cur, conn). 새 함수 작성 시 이 패턴 사용 권장."""
    api_db = _get_db()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        yield cur, conn
    finally:
        cur.close()
        conn.close()


def get_target_db_connection(storage_connection_id: Optional[int] = None):
    """
    적재 대상 DB 연결 획득.
    - None: config.main_db(메인 저장소).
    - STORAGE_BUILTIN_DASH_ID(-1): config.dash_db(대시보드용 DB).
    - 양의 정수: etl_storage_connections 행 기준 PostgreSQL 연결.
    반환: (conn, schema_name: str). conn은 호출 후 cursor()로 커서 획득, 사용 후 close 책임은 호출부.
    """
    if storage_connection_id is None:
        api_db = _get_db()
        return api_db.get_db_connection(), api_db.get_table_schema()
    if is_builtin_dash_storage(storage_connection_id):
        from Backend.core import db as core_db_mod

        return core_db_mod.get_db_connection_dash(), core_db_mod.get_dash_table_schema()
    sc = get_storage_connection(int(storage_connection_id))
    if not sc:
        raise ValueError("저장 DB 연결을 찾을 수 없습니다.")
    conn = _connect_postgres(
        sc["host"],
        sc.get("port") or 5432,
        sc["database_name"],
        sc["username"],
        sc.get("encrypted_password") or "",
    )
    schema = (sc.get("schema_name") or "").strip() or "public"
    return conn, schema


# source_table 'schema.table' 분리 시 점으로 인정할 문자들. 정규화 시 ASCII 점(.)으로 통일.
# ASCII(.), 전각(U+FF0E), 가운뎃점(U+00B7), One Dot Leader(U+2024), Hyphenation Point(U+2027), Ideographic Full Stop(U+3002)
_SOURCE_TABLE_DOT_PATTERN = re.compile(r"[.\u00B7\u2024\u2027\uFF0E\u3002]")

def _validate_identifier(value: str, name: str) -> str:
    """식별자(테이블명·컬럼명) 검증. 영문·숫자·언더스코어만."""
    if not value or not str(value).strip():
        raise ValueError(f"{name}이 비어 있습니다.")
    v = str(value).strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", v):
        raise ValueError(f"{name}에 허용되지 않은 문자가 있습니다: {v}")
    return v


def _normalize_source_table_dots(value: str) -> str:
    """점 유사 문자를 ASCII 점(.)으로 통일. DB/입력 인코딩 차이 대응."""
    if not value:
        return ""
    return _SOURCE_TABLE_DOT_PATTERN.sub(".", str(value).strip())


def _validate_source_table(value: str) -> str:
    """source_table 검증. 'schema.table' 또는 'table' 형식 허용. 점 유사 문자는 ASCII 점으로 정규화 후 검증. 각 부분은 영문·숫자·언더스코어만."""
    if not value or not str(value).strip():
        raise ValueError("source_table이 비어 있습니다.")
    v = _normalize_source_table_dots(value)
    parts = v.split(".", maxsplit=1)
    for part in parts:
        p = part.strip()
        if not p:
            raise ValueError("source_table의 스키마 또는 테이블명이 비어 있습니다.")
        if not re.match(r"^[a-zA-Z0-9_]+$", p):
            bad_chars = [c for c in p if not re.match(r"[a-zA-Z0-9_]", c)]
            logger.warning(
                "_validate_source_table 실패: part=%r bad_chars=%r ord=%s",
                p, bad_chars, [hex(ord(c)) for c in bad_chars],
            )
            raise ValueError(f"source_table에 허용되지 않은 문자가 있습니다: {v}")
    return v


def _connection_error_to_user_message(ex: Exception, port: Optional[int] = None) -> dict:
    """
    DB 연결 실패 예외를 사용자용 한글 메시지와 점검 안내로 변환.
    port: 연결 시도한 포트(안내 문구에 사용, 예: 3306·5432). 없으면 5432로 표시.
    반환: { "message": str, "hint": str | None }
    """
    p = port if port is not None else 5432
    err = (str(ex) or "").strip().lower()
    if "timed out" in err or "10060" in err or "connection timed out" in err:
        return {
            "message": "서버에 연결할 수 없습니다. 시간이 초과되었습니다.",
            "hint": (
                f"· 방화벽: DB 서버에서 포트 {p}가 열려 있는지, "
                "현재 PC/서버에서 해당 포트로 나가는 연결이 허용되는지 확인하세요.\n"
                f"· DB 서버가 켜져 있고 DB(PostgreSQL/MySQL 등)가 포트 {p}에서 수신 중인지 확인하세요.\n"
                "· VPN/사설망이 필요하면 먼저 연결한 뒤 다시 테스트하세요."
            ),
        }
    if "connection refused" in err or "111" in err or "actively refused" in err:
        return {
            "message": "연결이 거부되었습니다. 해당 포트에서 서비스가 수신 중이 아닐 수 있습니다.",
            "hint": (
                f"· DB가 해당 서버에서 실행 중인지 확인하세요. 포트 {p}에서 수신 중인지 확인하세요.\n"
                "· PostgreSQL: postgresql.conf의 listen_addresses, pg_hba.conf 확인. MySQL: bind-address 등 확인.\n"
                f"· 포트 번호가 맞는지 확인하세요(PostgreSQL 기본 5432, MySQL 기본 3306)."
            ),
        }
    if "password authentication failed" in err or "auth failed" in err:
        return {
            "message": "인증에 실패했습니다. 사용자명 또는 비밀번호를 확인하세요.",
            "hint": "· DB 사용자명과 비밀번호가 맞는지 확인하세요. PostgreSQL: pg_hba.conf 접속 방식 확인. MySQL: 사용자 권한 확인.",
        }
    if "could not translate host" in err or "nodename nor servname" in err or "getaddrinfo failed" in err or "name or service not known" in err:
        return {
            "message": "호스트(주소)를 찾을 수 없습니다.",
            "hint": "· 호스트명 또는 IP 주소가 맞는지, DNS가 동작하는지 확인하세요.",
        }
    if "does not exist" in err and ("database" in err or "role" in err):
        return {
            "message": "지정한 데이터베이스 또는 사용자가 존재하지 않습니다.",
            "hint": "· 데이터베이스 이름과 사용자명이 서버에 실제로 있는지 확인하세요.",
        }
    if "timeout" in err or "deadlock" in err:
        return {
            "message": "연결 또는 작업이 시간 초과되었습니다.",
            "hint": "· 네트워크 상태와 서버 부하를 확인하세요. 방화벽/프록시에서 연결이 끊기지 않는지 확인하세요.",
        }
    return {
        "message": "연결에 실패했습니다.",
        "hint": "· 호스트, 포트, DB명, 사용자명, 비밀번호를 확인하세요. 서버와 네트워크(방화벽, VPN)를 점검하세요.",
    }


# 연결 시도 타임아웃(초). 이 시간 내에 TCP 연결이 되지 않으면 시간 초과 예외 발생.
_CONNECT_TIMEOUT_SEC = 15


def _connect_postgres(host: str, port: int, database: str, user: str, password: str):
    """외부 PostgreSQL 연결. psycopg2 connection 반환. connect_timeout 적용."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    logger.info(
        "ETL DB 연결 시도: host=%s port=%s dbname=%s user=%s connect_timeout=%ss (연결은 ETL 백엔드가 동작 중인 호스트에서 대상으로 나감)",
        host, port, database, user, _CONNECT_TIMEOUT_SEC,
    )
    try:
        conn = psycopg2.connect(
            host=host,
            port=int(port),
            dbname=database,
            user=user,
            password=password or "",
            connect_timeout=_CONNECT_TIMEOUT_SEC,
            cursor_factory=RealDictCursor,
        )
        conn.set_client_encoding("UTF8")
        logger.info("ETL DB 연결 성공: host=%s port=%s dbname=%s", host, port, database)
        return conn
    except Exception as e:
        logger.warning(
            "ETL DB 연결 실패: host=%s port=%s dbname=%s error_type=%s error=%s",
            host, port, database, type(e).__name__, str(e),
        )
        raise


# SSCursor 스트리밍 시 fetchmany 간 대기 시간이 길어지면 MySQL 서버가 net_write_timeout으로 연결을 끊을 수 있음. 클라이언트 read/write timeout을 넉넉히 둠.
_MYSQL_READ_WRITE_TIMEOUT_SEC = 7200


def _connect_mysql(host: str, port: int, database: str, user: str, password: str):
    """외부 MySQL 연결. PyMySQL connection 반환. connect_timeout·read_timeout·write_timeout 적용."""
    try:
        import pymysql
    except ImportError:
        raise RuntimeError("MySQL 연결을 위해 PyMySQL이 필요합니다. pip install PyMySQL")
    logger.info(
        "ETL MySQL 연결 시도: host=%s port=%s database=%s user=%s connect_timeout=%ss read_timeout=%ss",
        host, port, database, user, _CONNECT_TIMEOUT_SEC, _MYSQL_READ_WRITE_TIMEOUT_SEC,
    )
    try:
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password or "",
            database=database,
            connect_timeout=_CONNECT_TIMEOUT_SEC,
            read_timeout=_MYSQL_READ_WRITE_TIMEOUT_SEC,
            write_timeout=_MYSQL_READ_WRITE_TIMEOUT_SEC,
        )
        logger.info("ETL MySQL 연결 성공: host=%s port=%s database=%s", host, port, database)
        return conn
    except Exception as e:
        logger.warning(
            "ETL MySQL 연결 실패: host=%s port=%s database=%s error_type=%s error=%s",
            host, port, database, type(e).__name__, str(e),
        )
        raise


def _connect_oracle(host: str, port: int, database: str, user: str, password: str):
    """외부 Oracle 연결. oracledb connection 반환. database는 서비스명(Service Name)만 사용. DSN 형식 host:port/서비스명 (SID 방식 미지원). connect_timeout 적용."""
    try:
        import oracledb
    except ImportError:
        raise RuntimeError("Oracle 연결을 위해 oracledb가 필요합니다. pip install oracledb")
    dsn = f"{host}:{port}/{database}"
    logger.info(
        "ETL Oracle 연결 시도: dsn=%s user=%s connect_timeout=%ss",
        dsn, user, _CONNECT_TIMEOUT_SEC,
    )
    try:
        conn = oracledb.connect(
            user=user,
            password=password or "",
            dsn=dsn,
            tcp_connect_timeout=_CONNECT_TIMEOUT_SEC,
        )
        logger.info("ETL Oracle 연결 성공: dsn=%s", dsn)
        return conn
    except Exception as e:
        logger.warning(
            "ETL Oracle 연결 실패: dsn=%s error_type=%s error=%s",
            dsn, type(e).__name__, str(e),
        )
        raise


def _fetch_pk_from_mysql(conn, table_schema: str, table_name: str) -> list:
    """MySQL 연결에서 information_schema로 해당 테이블 PK 컬럼명 목록. 없으면 []."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND CONSTRAINT_NAME = 'PRIMARY'
            ORDER BY ORDINAL_POSITION
            """,
            (table_schema, table_name),
        )
        rows = cur.fetchall()
        return [r[0] for r in rows] if rows else []
    finally:
        cur.close()


def _fetch_pk_from_oracle(conn, owner: str, table_name: str) -> list:
    """Oracle 연결에서 PK 컬럼명 목록. owner 있으면 all_constraints, 없으면 user_constraints. table_name은 대문자로 조회."""
    cur = conn.cursor()
    try:
        o = (owner or "").strip().upper()
        t = (table_name or "").strip().upper()
        if not t:
            return []
        if o:
            cur.execute(
                """
                SELECT acc.column_name
                FROM all_constraints ac
                JOIN all_cons_columns acc ON ac.owner = acc.owner AND ac.constraint_name = acc.constraint_name
                WHERE ac.constraint_type = 'P' AND ac.table_name = :1 AND ac.owner = :2
                ORDER BY acc.position
                """,
                (t, o),
            )
        else:
            cur.execute(
                """
                SELECT ucc.column_name
                FROM user_constraints uc
                JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
                WHERE uc.constraint_type = 'P' AND uc.table_name = :1
                ORDER BY ucc.position
                """,
                (t,),
            )
        rows = cur.fetchall()
        return [r[0] for r in rows] if rows else []
    finally:
        cur.close()


# DB 종류별 기본 포트
_DEFAULT_PORTS = {"postgresql": 5432, "mysql": 3306, "oracle": 1521}


def parse_source_table_parts(
    source_table: str,
    source_type: str,
    conn_schema: Optional[str] = None,
    conn_db: Optional[str] = None,
) -> tuple:
    """
    source_table가 'schema.table' 또는 'table' 형식일 때 (schema_or_db, table_name) 반환.
    DB 조회·PK 조회 시 스키마/테이블 분리용. 점 유사 문자는 정규화 후 분리. conn_schema/conn_db는 점(.)이 없을 때 사용.
    """
    st = _normalize_source_table_dots(source_table or "")
    if not st:
        return (conn_schema or "public", "")
    parts = st.split(".", maxsplit=1)
    if len(parts) == 2:
        return (parts[0].strip(), parts[1].strip())
    if (source_type or "").strip().lower() == "mysql":
        return (conn_db or "", st)
    return (conn_schema or "public", st)


def list_timezones() -> list:
    """서버 시간대 마스터 목록. server_timezones 테이블 조회. ORDER BY sort_order ASC, utc_offset_min ASC."""
    schema = _schema()
    with _sys_cursor() as (cur, _):
        cur.execute(
            f"""
            SELECT timezone_id, display_name, utc_offset_min, sort_order
            FROM {_q(schema, "server_timezones")}
            ORDER BY sort_order ASC, utc_offset_min ASC
            """
        )
        return [dict(r) for r in cur.fetchall()]


def create_connection(
    connection_name: str,
    source_type: str,
    created_by: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    server_timezone: Optional[str] = "Asia/Seoul",
    create_user_id: Optional[int] = None,
) -> int:
    """DB 연결 1건 등록. source_type=postgresql|mysql|oracle. 비밀번호는 password 또는 encrypted_password에 저장(현재 평문). create_user_id는 JWT user_id."""
    if not connection_name or not str(connection_name).strip():
        raise ValueError("connection_name이 비어 있습니다.")
    if source_type not in ("postgresql", "mysql", "oracle"):
        raise ValueError("지원 소스: postgresql, mysql, oracle")
    if not host or not database_name or not username:
        raise ValueError("host, database_name, username가 필요합니다.")
    port = port or _DEFAULT_PORTS.get(source_type, 5432)
    schema_name = (schema_name or ("public" if source_type == "postgresql" else "")).strip()
    tz = (server_timezone or "Asia/Seoul").strip()
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_connections")
        cnames, cvals = _append_creator_columns_etl(cols, create_user_id, created_by)
        type_col = _etl_conn_type_column_for_insert(cols)
        pwd_col = _etl_conn_password_column_for_insert(cols)
        insert_cols = [
            "connection_name",
            type_col,
            "host",
            "port",
            "database_name",
            "schema_name",
            "username",
            pwd_col,
        ]
        params_list: list[Any] = [
            connection_name.strip(),
            source_type,
            host.strip(),
            int(port),
            database_name.strip(),
            schema_name,
            username.strip(),
            password or "",
        ]
        if "is_active" in cols:
            insert_cols.append("is_active")
            params_list.append(True)
        if "extra_config" in cols:
            insert_cols.append("extra_config")
            params_list.append(json.dumps({}))
        if "server_timezone" in cols:
            insert_cols.append("server_timezone")
            params_list.append(tz)
        insert_cols.extend(cnames)
        params_list.extend(cvals)
        ph = ", ".join(["%s"] * len(params_list))
        sql = (
            f"INSERT INTO {_q(schema, 'etl_connections')} ({', '.join(insert_cols)}) "
            f"VALUES ({ph}) RETURNING connection_id"
        )
        cur.execute(sql, tuple(params_list))
        row = cur.fetchone()
        conn.commit()
        return int(row["connection_id"])
    finally:
        cur.close()
        conn.close()


def list_connections() -> list:
    """연결 목록. 비밀번호 제외. is_active 컬럼이 있으면 TRUE만(소스 테이블 조회·get_connection_for_etl과 일치)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_connections")
        sel: list[str] = [
            "connection_id",
            "connection_name",
            _etl_conn_type_select_sql(cols, None),
        ]
        for f in ("host", "port", "database_name", "schema_name", "username", "is_active", "created_at", "updated_at"):
            if f in cols:
                sel.append(f)
        if "create_user_id" in cols:
            sel.append("create_user_id")
        if "created_by" in cols:
            sel.append("created_by")
        else:
            sel.append("NULL::varchar AS created_by")
        if "server_timezone" in cols:
            sel.append("server_timezone")
        else:
            sel.append("NULL::varchar AS server_timezone")
        order_by = "created_at DESC" if "created_at" in cols else "connection_id DESC"
        where_active = "WHERE is_active = TRUE" if "is_active" in cols else ""
        cur.execute(
            f"""
            SELECT {", ".join(sel)}
            FROM {_q(schema, "etl_connections")}
            {where_active}
            ORDER BY {order_by}
            """
        )
        return [_normalize_etl_connection_row(dict(r)) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_connection_for_etl(connection_id: int) -> Optional[dict]:
    """connection_id로 연결 정보 반환. 적재 시 사용(비밀번호 포함)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_connections")
        tz_sel = "server_timezone" if "server_timezone" in cols else "NULL::varchar AS server_timezone"
        type_sql = _etl_conn_type_select_sql(cols, None)
        pwd_sql = _etl_conn_password_select_expr(cols, None)
        act_sql = " AND is_active = TRUE" if "is_active" in cols else ""
        cur.execute(
            f"""
            SELECT connection_id, connection_name, {type_sql}, host, port, database_name, schema_name,
                   username, {pwd_sql}, {tz_sel}
            FROM {_q(schema, "etl_connections")}
            WHERE connection_id = %s{act_sql}
            """,
            (connection_id,),
        )
        row = cur.fetchone()
        return _normalize_etl_connection_row(dict(row)) if row else None
    finally:
        cur.close()
        conn.close()


# ---------- 저장 DB(적재 대상) Phase 1: etl_storage_connections ----------

def list_storage_connections() -> list:
    """저장 DB(적재 대상) 연결 목록. 선두 2건=내장 main·dash(config, is_builtin). 이후 etl_storage_connections. 비밀번호 제외."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_storage_connections")
        if "config_json" not in cols:
            raise RuntimeError(
                "etl_storage_connections.config_json 컬럼이 필요합니다. ibank_etl_data DDL(docs/main/04)을 적용하세요."
            )
        sel = [
            "storage_connection_id",
            "connection_name",
            _storage_conn_type_select_sql(cols, None),
            "config_json",
        ]
        sel.extend(_storage_physical_select_fragments(cols, include_secret=False))
        if "create_user_id" in cols:
            sel.append("create_user_id")
        sel.extend(["is_active", "created_at", "updated_at"])
        cur.execute(
            f"""
            SELECT {", ".join(sel)}
            FROM {_q(schema, "etl_storage_connections")}
            ORDER BY created_at DESC
            """
        )
        db_rows = [_normalize_storage_connection_row(dict(r)) for r in cur.fetchall()]
        return _builtin_storage_connections_for_list() + db_rows
    finally:
        cur.close()
        conn.close()


def get_storage_connection(storage_connection_id: int) -> Optional[dict]:
    """저장 DB 연결 1건 조회. 비밀번호 포함(config_json 내). Phase 2b get_target_db_connection에서 사용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_storage_connections")
        if "config_json" not in cols:
            raise RuntimeError(
                "etl_storage_connections.config_json 컬럼이 필요합니다. ibank_etl_data DDL(docs/main/04)을 적용하세요."
            )
        sel = [
            "storage_connection_id",
            "connection_name",
            _storage_conn_type_select_sql(cols, None),
            "config_json",
        ]
        sel.extend(_storage_physical_select_fragments(cols, include_secret=True))
        if "create_user_id" in cols:
            sel.append("create_user_id")
        sel.extend(["is_active", "created_at", "updated_at"])
        cur.execute(
            f"""
            SELECT {", ".join(sel)}
            FROM {_q(schema, "etl_storage_connections")}
            WHERE storage_connection_id = %s AND is_active = TRUE
            """,
            (storage_connection_id,),
        )
        row = cur.fetchone()
        return _normalize_storage_connection_row(dict(row)) if row else None
    finally:
        cur.close()
        conn.close()


def list_target_tables(storage_connection_id: Optional[int] = None) -> list:
    """
    저장 DB(적재 대상)의 테이블 목록 조회. Phase 3.
    - storage_connection_id가 None이면 기본 ibank_db, 있으면 해당 저장 DB.
    반환: [{"table_name": str}, ...] (해당 스키마의 BASE TABLE만)
    """
    conn, schema = get_target_db_connection(storage_connection_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (schema,),
        )
        rows = cur.fetchall()
        return [{"table_name": (r[0] if isinstance(r, (list, tuple)) else r["table_name"])} for r in rows]
    finally:
        cur.close()
        conn.close()


def list_target_columns(storage_connection_id: Optional[int], table_name: str) -> list:
    """
    저장 DB의 지정 테이블 컬럼 목록 조회. Phase 3.
    반환: [{"column_name": str, "data_type": str}, ...] (ordinal_position 순)
    """
    if not (table_name or "").strip():
        return []
    conn, schema = get_target_db_connection(storage_connection_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table_name.strip()),
        )
        rows = cur.fetchall()
        return [
            {
                "column_name": r[0] if isinstance(r, (list, tuple)) else r["column_name"],
                "data_type": r[1] if isinstance(r, (list, tuple)) else r["data_type"],
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def target_table_exists(storage_connection_id: Optional[int], table_name: str) -> bool:
    """
    저장 DB(적재 대상)에 해당 테이블이 존재하는지 조회. Phase 2b/5 검증용.
    - storage_connection_id가 None이면 기본 ibank_db, 있으면 해당 저장 DB.
    """
    if not (table_name or "").strip():
        return False
    conn, schema = get_target_db_connection(storage_connection_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = %s AND table_name = %s AND table_type = 'BASE TABLE'
            """,
            (schema, table_name.strip()),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def get_target_table_column_names(storage_connection_id: Optional[int], table_name: str) -> List[str]:
    """저장 DB의 지정 테이블 컬럼명 목록(ordinal_position 순). run_file_upsert 등에서 타겟 컬럼 조회용."""
    cols = list_target_columns(storage_connection_id, table_name)
    return [c.get("column_name") or "" for c in cols if c.get("column_name")]


def get_target_pk_columns(storage_connection_id: Optional[int], table_name: str) -> List[str]:
    """저장 DB의 지정 테이블 PRIMARY KEY 컬럼명 목록. 없으면 []."""
    if not (table_name or "").strip():
        return []
    conn, schema = get_target_db_connection(storage_connection_id)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = %s AND tc.table_name = %s
            ORDER BY kcu.ordinal_position
            """,
            (schema, table_name.strip()),
        )
        rows = cur.fetchall()
        return [r[0] if isinstance(r, (list, tuple)) else r["column_name"] for r in rows]
    finally:
        cur.close()
        conn.close()


def create_storage_connection(
    connection_name: str,
    host: str,
    port: int,
    database_name: str,
    username: str,
    password: Optional[str] = None,
    schema_name: Optional[str] = None,
    server_timezone: Optional[str] = "Asia/Seoul",
    create_user_id: Optional[int] = None,
) -> int:
    """저장 DB 연결 1건 등록. PostgreSQL 전용. 반환: storage_connection_id. create_user_id는 JWT user_id."""
    if not connection_name or not str(connection_name).strip():
        raise ValueError("connection_name이 비어 있습니다.")
    if not host or not database_name or not username:
        raise ValueError("host, database_name, username가 필요합니다.")
    port = int(port or 5432)
    schema_name = (schema_name or "public").strip() or "public"
    tz = (server_timezone or "Asia/Seoul").strip()
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_storage_connections")
        if "config_json" not in cols:
            raise RuntimeError(
                "etl_storage_connections.config_json 컬럼이 필요합니다. ibank_etl_data DDL(docs/main/04)을 적용하세요."
            )
        cnames, cvals = _append_creator_columns_etl(cols, create_user_id, "")
        cfg = {
            "host": host.strip(),
            "port": port,
            "database_name": database_name.strip(),
            "schema_name": schema_name,
            "username": username.strip(),
            "password": password or "",
            "server_timezone": tz,
        }
        st_col = _storage_conn_type_column_for_insert(cols)
        insert_cols = ["connection_name", st_col, "config_json", "is_active"]
        params_list: list[Any] = [connection_name.strip(), "postgresql", json.dumps(cfg), True]
        if "host" in cols:
            insert_cols.append("host")
            params_list.append(host.strip())
        if "port" in cols:
            insert_cols.append("port")
            params_list.append(port)
        if "database_name" in cols:
            insert_cols.append("database_name")
            params_list.append(database_name.strip())
        if "schema_name" in cols:
            insert_cols.append("schema_name")
            params_list.append(schema_name)
        if "username" in cols:
            insert_cols.append("username")
            params_list.append(username.strip())
        pw_ins = _storage_conn_password_column_for_insert(cols)
        if pw_ins:
            insert_cols.append(pw_ins)
            params_list.append(password or "")
        insert_cols.extend(cnames)
        params_list.extend(cvals)
        ph = ", ".join(["%s"] * len(params_list))
        sql = (
            f"INSERT INTO {_q(schema, 'etl_storage_connections')} ({', '.join(insert_cols)}) "
            f"VALUES ({ph}) RETURNING storage_connection_id"
        )
        cur.execute(sql, tuple(params_list))
        row = cur.fetchone()
        conn.commit()
        return int(row["storage_connection_id"])
    finally:
        cur.close()
        conn.close()


def update_storage_connection(
    storage_connection_id: int,
    connection_name: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    is_active: Optional[bool] = None,
    server_timezone: Optional[str] = None,
) -> None:
    """저장 DB 연결 1건 수정. None인 필드는 변경하지 않음."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_storage_connections")
        if "config_json" not in cols:
            raise RuntimeError(
                "etl_storage_connections.config_json 컬럼이 필요합니다. ibank_etl_data DDL(docs/main/04)을 적용하세요."
            )
        updates = []
        params: list[Any] = []
        cur.execute(
            f"SELECT config_json FROM {_q(schema, 'etl_storage_connections')} WHERE storage_connection_id = %s",
            (storage_connection_id,),
        )
        row = cur.fetchone()
        if not row:
            return
        raw = row.get("config_json")
        j: dict[str, Any]
        if raw is None:
            j = {}
        elif isinstance(raw, str):
            try:
                j = json.loads(raw)
            except (TypeError, ValueError):
                j = {}
        elif isinstance(raw, dict):
            j = dict(raw)
        else:
            j = {}
        if connection_name is not None:
            updates.append("connection_name = %s")
            params.append(connection_name.strip())
        if host is not None:
            j["host"] = host.strip()
        if port is not None:
            j["port"] = int(port)
        if database_name is not None:
            j["database_name"] = database_name.strip()
        if schema_name is not None:
            j["schema_name"] = (schema_name or "public").strip() or "public"
        if username is not None:
            j["username"] = username.strip()
        if password is not None:
            j["password"] = password
        if server_timezone is not None:
            j["server_timezone"] = server_timezone.strip()
        json_touch = any(
            x is not None
            for x in (host, port, database_name, schema_name, username, password, server_timezone)
        )
        if json_touch:
            updates.append("config_json = %s::jsonb")
            params.append(json.dumps(j))
            # config_json과 동일 값을 물리 컬럼에도 반영(조회·백업 시 직관적)
            if "host" in cols:
                updates.append("host = %s")
                params.append(j.get("host"))
            if "port" in cols:
                updates.append("port = %s")
                params.append(j.get("port"))
            if "database_name" in cols:
                updates.append("database_name = %s")
                params.append(j.get("database_name"))
            if "schema_name" in cols:
                updates.append("schema_name = %s")
                params.append(j.get("schema_name"))
            if "username" in cols:
                updates.append("username = %s")
                params.append(j.get("username"))
            pw_col_u = _storage_conn_password_column_for_insert(cols)
            if pw_col_u:
                updates.append(f"{pw_col_u} = %s")
                params.append(j.get("password") or "")
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(is_active)
        if not updates:
            return
        if "updated_at" in cols:
            updates.append("updated_at = NOW()")
        params.append(storage_connection_id)
        cur.execute(
            f"UPDATE {_q(schema, 'etl_storage_connections')} SET {', '.join(updates)} WHERE storage_connection_id = %s",
            tuple(params),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def delete_storage_connection(storage_connection_id: int) -> None:
    """저장 DB 연결 1건 삭제."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(f"DELETE FROM {_q(schema, 'etl_storage_connections')} WHERE storage_connection_id = %s", (storage_connection_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def test_storage_connection(
    host: str,
    port: int,
    database_name: str,
    username: str,
    password: Optional[str] = None,
    schema_name: Optional[str] = None,
) -> dict:
    """저장 DB 연결 테스트: 접속 + CREATE TABLE + INSERT 1건 + DROP TABLE 권한 검증. 반환: { ok: bool, message: str }."""
    conn = _connect_postgres(host, int(port or 5432), database_name, username, password or "")
    schema = (schema_name or "").strip() or "public"
    test_table = f'"_etl_permission_test_{uuid.uuid4().hex[:8]}"'
    full_name = f'"{schema}".{test_table}'
    cur = conn.cursor()
    try:
        cur.execute(f"CREATE TABLE {full_name} (id INTEGER)")
        cur.execute(f"INSERT INTO {full_name} VALUES (1)")
        cur.execute(f"DROP TABLE {full_name}")
        conn.commit()
        return {"ok": True, "message": "접속 및 권한 확인 완료"}
    except Exception as e:
        conn.rollback()
        try:
            cur.execute(f"DROP TABLE IF EXISTS {full_name}")
            conn.commit()
        except Exception:
            conn.rollback()
        return {"ok": False, "message": f"권한 부족: {e}"}
    finally:
        cur.close()
        conn.close()


def test_connection(
    connection_id: Optional[int] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    source_type: Optional[str] = None,
) -> dict:
    """
    연결 테스트. connection_id가 있으면 해당 연결로, 없으면 인자로 전달된 값으로 테스트.
    source_type: connection_id 없을 때 필수. postgresql | mysql | oracle.
    반환: { ok: bool, message: str }
    """
    logger.info("[ETL 연결테스트] 1/5 서비스 진입 (connection_id=%s, host=%s, source_type=%s)", connection_id, host, source_type)
    if connection_id is not None:
        logger.info("[ETL 연결테스트] 2/5 connection_id로 시스템 DB에서 연결 정보 조회")
        c = get_connection_for_etl(connection_id)
        if not c:
            logger.warning("[ETL 연결테스트] 2/5 실패: 연결을 찾을 수 없음 connection_id=%s", connection_id)
            return {"ok": False, "message": "연결을 찾을 수 없습니다."}
        host = c.get("host")
        port = c.get("port")
        database_name = c.get("database_name")
        username = c.get("username")
        password = c.get("encrypted_password") or ""
        source_type = (c.get("source_type") or "postgresql").strip().lower()
        logger.info("[ETL 연결테스트] 2/5 조회 완료 host=%s port=%s database_name=%s source_type=%s", host, port, database_name, source_type)
    else:
        logger.info("[ETL 연결테스트] 2/5 인자로 전달된 값 사용 (connection_id 없음)")
        source_type = (source_type or "postgresql").strip().lower()
        if source_type not in ("postgresql", "mysql", "oracle"):
            return {"ok": False, "message": "source_type은 postgresql, mysql, oracle 중 하나여야 합니다."}
    logger.info("[ETL 연결테스트] 3/5 필수값 검증 (host, database_name, username)")
    if not host or not database_name or not username:
        logger.warning("[ETL 연결테스트] 3/5 실패: 필수값 누락 host=%s database_name=%s username=%s", bool(host), bool(database_name), bool(username))
        return {"ok": False, "message": "host, database_name, username가 필요합니다."}
    effective_port = port or _DEFAULT_PORTS.get(source_type, 5432)
    logger.info("[ETL 연결테스트] 3/5 검증 통과 host=%s port=%s database_name=%s user=%s source_type=%s", host, effective_port, database_name, username, source_type)
    try:
        logger.info("[ETL 연결테스트] 4/5 %s TCP 연결 시도", source_type)
        if source_type == "mysql":
            conn = _connect_mysql(host, effective_port, database_name, username, password or "")
            cur = conn.cursor()
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
            cur.close()
            conn.close()
        elif source_type == "oracle":
            conn = _connect_oracle(host, effective_port, database_name, username, password or "")
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM DUAL")
            cur.fetchone()
            cur.close()
            conn.close()
        else:
            conn = _connect_postgres(host, effective_port, database_name, username, password or "")
            cur = conn.cursor()
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
            cur.close()
            conn.close()
        logger.info("[ETL 연결테스트] 5/5 SELECT 실행 및 연결 종료 완료. 성공: host=%s port=%s", host, effective_port)
        return {"ok": True, "message": "연결 성공"}
    except Exception as e:
        logger.exception(
            "[ETL 연결테스트] 실패(4/5 또는 5/5): host=%s port=%s database_name=%s source_type=%s error_type=%s error=%s",
            host, effective_port, database_name, source_type, type(e).__name__, e,
        )
        out = _connection_error_to_user_message(e, port=effective_port)
        return {"ok": False, "message": out["message"], "hint": out.get("hint")}


def list_source_tables(connection_id: int) -> list:
    """
    외부 DB의 테이블 목록. 반환: [{"table_schema": str, "table_name": str}, ...]
    - PostgreSQL: table_schema = connection.schema_name (기본 'public')
    - MySQL: TABLE_SCHEMA = database_name (MySQL에서는 DB명이 스키마 개념)
    - Oracle: schema_name 비어있거나 PUBLIC이면 USER_TABLES(접속 사용자 소유만). schema_name에 OWNER 지정 시 ALL_TABLES에서 해당 OWNER만. 선택 시 OWNER.TABLE_NAME으로 저장.
    """
    c = get_connection_for_etl(connection_id)
    if not c:
        raise ValueError("연결을 찾을 수 없습니다.")
    stype = (c.get("source_type") or "postgresql").strip().lower()
    if stype not in ("postgresql", "mysql", "oracle"):
        raise ValueError("postgresql, mysql, oracle 연결만 소스 테이블 목록을 지원합니다.")

    if stype == "postgresql":
        conn = _connect_postgres(
            c["host"],
            c.get("port") or 5432,
            c["database_name"],
            c["username"],
            c.get("encrypted_password") or "",
        )
        cur = conn.cursor()
        try:
            schema = (c.get("schema_name") or "public").strip()
            cur.execute(
                """
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_schema = %s AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """,
                (schema,),
            )
            return [{"table_schema": r["table_schema"], "table_name": r["table_name"]} for r in cur.fetchall()]
        finally:
            cur.close()
            conn.close()

    if stype == "mysql":
        conn = _connect_mysql(
            c["host"],
            c.get("port") or 3306,
            c["database_name"],
            c["username"],
            c.get("encrypted_password") or "",
        )
        cur = conn.cursor()
        try:
            # MySQL: TABLE_SCHEMA = 데이터베이스명(연결 시 선택한 DB). schema_name이 아님.
            db_name = (c.get("database_name") or "").strip()
            if not db_name:
                return []
            cur.execute(
                """
                SELECT TABLE_SCHEMA, TABLE_NAME
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
                """,
                (db_name,),
            )
            rows = cur.fetchall()
            return [{"table_schema": row[0], "table_name": row[1]} for row in rows]
        finally:
            cur.close()
            conn.close()

    if stype == "oracle":
        conn = _connect_oracle(
            c["host"],
            c.get("port") or 1521,
            c["database_name"],
            c["username"],
            c.get("encrypted_password") or "",
        )
        cur = conn.cursor()
        try:
            schema_name = (c.get("schema_name") or "").strip().upper()
            if schema_name and schema_name != "PUBLIC":
                cur.execute(
                    "SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE OWNER = :1 ORDER BY TABLE_NAME",
                    (schema_name,),
                )
                rows = cur.fetchall()
                if not rows:
                    return []
                desc = cur.description
                col_names = [d[0].upper() for d in desc] if desc else []
                try:
                    idx_owner = col_names.index("OWNER") if col_names else 0
                    idx_name = col_names.index("TABLE_NAME") if col_names else 1
                except ValueError:
                    idx_owner, idx_name = 0, 1
                result = []
                for row in rows:
                    if hasattr(row, "keys"):
                        owner = row.get("OWNER") or row.get("owner")
                        tname = row.get("TABLE_NAME") or row.get("table_name")
                    else:
                        owner = row[idx_owner] if len(row) > idx_owner else row[0]
                        tname = row[idx_name] if len(row) > idx_name else row[1]
                    result.append({"table_schema": owner, "table_name": tname})
            else:
                cur.execute("SELECT USER FROM DUAL")
                owner_row = cur.fetchone()
                owner = (owner_row[0] if owner_row else c.get("username") or "").strip()
                cur.execute("SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME")
                rows = cur.fetchall()
                result = [{"table_schema": owner, "table_name": r[0]} for r in rows]
            logger.info(
                "ETL Oracle list_source_tables: connection_id=%s schema_filter=%s rows=%s",
                connection_id, schema_name or "(current user)", len(result),
            )
            return result
        finally:
            cur.close()
            conn.close()

    return []


def get_or_create_file_connection(created_by: str, create_user_id: Optional[int] = None) -> int:
    """source_type='file' 연결 1개 반환. 없으면 생성 후 connection_id 반환. create_user_id는 JWT user_id."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_connections")
        type_col = _etl_conn_type_column_for_insert(cols)
        wh = [f"{type_col} = %s"]
        prm: list[Any] = ["file"]
        if "is_active" in cols:
            wh.append("is_active = TRUE")
        cur.execute(
            f'SELECT connection_id FROM {_q(schema, "etl_connections")} WHERE {" AND ".join(wh)} LIMIT 1',
            tuple(prm),
        )
        row = cur.fetchone()
        if row:
            return int(row["connection_id"])
        cnames, cvals = _append_creator_columns_etl(cols, create_user_id, created_by)
        if "host" not in cols:
            raise RuntimeError(
                "etl_connections에 host 등 접속 컬럼이 필요합니다. ibank_etl_data DDL(docs/main/04)을 적용하세요."
            )
        pwd_col = _etl_conn_password_column_for_insert(cols)
        insert_cols = [
            "connection_name",
            type_col,
            "host",
            "port",
            "database_name",
            "schema_name",
            "username",
            pwd_col,
        ]
        params_list: list[Any] = [
            "파일 업로드",
            "file",
            "127.0.0.1",
            5432,
            "file",
            "public",
            "file",
            "",
        ]
        if "is_active" in cols:
            insert_cols.append("is_active")
            params_list.append(True)
        if "extra_config" in cols:
            insert_cols.append("extra_config")
            params_list.append(json.dumps({}))
        if "server_timezone" in cols:
            insert_cols.append("server_timezone")
            params_list.append("Asia/Seoul")
        insert_cols.extend(cnames)
        params_list.extend(cvals)
        ph = ", ".join(["%s"] * len(params_list))
        sql = (
            f"INSERT INTO {_q(schema, 'etl_connections')} ({', '.join(insert_cols)}) "
            f"VALUES ({ph}) RETURNING connection_id"
        )
        cur.execute(sql, tuple(params_list))
        row = cur.fetchone()
        conn.commit()
        return int(row["connection_id"])
    finally:
        cur.close()
        conn.close()


def list_etl_tables_by_connection(connection_id: int) -> list:
    """해당 연결(connection_id)에 속한 etl_tables 목록. target_table 등 DROP용."""
    schema = _schema()
    conn = _get_db().get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT etl_table_id, target_table FROM {_q(schema, "etl_tables")}
            WHERE connection_id = %s
            """,
            (connection_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def delete_connection(connection_id: int) -> None:
    """
    연결 삭제. 해당 connection_id를 쓰는 모든 ETL의 타겟 테이블을 메인 DB에서 DROP한 뒤,
    etl_tables 행 삭제, etl_connections 행 삭제.
    source_type='file'(파일 업로드용) 연결은 삭제 불가 — 해제 시 파일 기반 ETL·업로드 파일이 전부 삭제되므로 위험.
    """
    api_db = _get_db()
    schema = _schema()
    conn_sys = api_db.get_db_connection_system()
    cur = conn_sys.cursor()
    try:
        cols_del = _table_columns_lower(cur, schema, "etl_connections")
        st_sel = _etl_conn_type_select_sql(cols_del, None)
        cur.execute(
            f"SELECT {st_sel} FROM {_q(schema, 'etl_connections')} WHERE connection_id = %s",
            (connection_id,),
        )
        row = cur.fetchone()
        row = _normalize_etl_connection_row(dict(row)) if row else None
        if row and (row.get("source_type") or "").strip().lower() == "file":
            raise ValueError("파일 업로드용 연결은 해제할 수 없습니다. 해당 연결은 파일 기반 ETL 전용이며, 해제 시 관련 데이터가 모두 삭제됩니다.")
    finally:
        cur.close()
        conn_sys.close()

    tables = list_etl_tables_by_connection(connection_id)
    conn_sys = api_db.get_db_connection_system()
    cur_sys = conn_sys.cursor()
    conn_main, main_schema = get_target_db_connection(None)
    cur_main = conn_main.cursor()
    try:
        for row in tables:
            target_table = (row.get("target_table") or "").strip()
            if not target_table or not re.match(r"^[a-zA-Z0-9_]+$", target_table):
                continue
            # 다른 연결에서 같은 target_table을 쓰는 ETL이 있으면 DROP 하지 않음.
            cur_sys.execute(
                f"SELECT COUNT(*) FROM {_q(schema, 'etl_tables')} WHERE target_table = %s AND connection_id != %s",
                (target_table, connection_id),
            )
            n = cur_sys.fetchone()
            other_count = n[0] if isinstance(n, (list, tuple)) else (list(n.values())[0] if n else 0)
            if other_count == 0:
                full_name = f'"{main_schema}"."{target_table}"'
                cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
        conn_main.commit()
    finally:
        cur_main.close()
        conn_main.close()

    try:
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_tables')} WHERE connection_id = %s", (connection_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_connections')} WHERE connection_id = %s", (connection_id,))
        conn_sys.commit()
    finally:
        cur_sys.close()
        conn_sys.close()


def list_etl_tables() -> list:
    """etl_tables 목록. connection_name, source_type, batch_size, batch_interval_seconds 포함."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        tcols = _table_columns_lower(cur, schema, "etl_tables")
        ccols = _table_columns_lower(cur, schema, "etl_connections")
        conn_st_sql = _etl_conn_type_select_sql(ccols, "c")
        has_storage = "storage_connection_id" in tcols
        t_sel = _etl_tables_t_select_sql(tcols)
        has_creator = "create_user_id" in tcols
        creator_sel = "t.create_user_id" if has_creator else "NULL::integer AS create_user_id"
        creator_join = ""
        creator_label_sql = ", NULL::text AS create_user_label"
        if has_creator:
            if _table_exists(cur, schema, "user_info"):
                creator_join = f" LEFT JOIN user_info u_cr ON u_cr.user_id = t.create_user_id "
                creator_label_sql = (
                    ", COALESCE(NULLIF(TRIM(u_cr.user_nickname), ''), NULLIF(TRIM(u_cr.user_email), ''), "
                    "CASE WHEN t.create_user_id IS NOT NULL THEN 'ID ' || t.create_user_id::text ELSE NULL END) AS create_user_label"
                )
            else:
                creator_label_sql = (
                    ", CASE WHEN t.create_user_id IS NOT NULL THEN 'ID ' || t.create_user_id::text ELSE NULL END AS create_user_label"
                )
        if has_storage:
            cur.execute(
                f"""
                SELECT {t_sel},
                       {creator_sel}{creator_label_sql},
                       c.connection_name, {conn_st_sql},
                       CASE
                         WHEN t.storage_connection_id IS NULL THEN '기본 DB (main)'
                         WHEN t.storage_connection_id = %s THEN '기본 DB (dash)'
                         ELSE sc.connection_name
                       END AS storage_connection_name
                FROM {_q(schema, "etl_tables")} t
                LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
                LEFT JOIN {_q(schema, "etl_storage_connections")} sc
                  ON sc.storage_connection_id = t.storage_connection_id AND sc.is_active = TRUE
                {creator_join}
                ORDER BY t.created_at DESC
                """,
                (STORAGE_BUILTIN_DASH_ID,),
            )
        else:
            cur.execute(
                f"""
                SELECT {t_sel},
                       {creator_sel}{creator_label_sql},
                       c.connection_name, {conn_st_sql},
                       NULL::text AS storage_connection_name
                FROM {_q(schema, "etl_tables")} t
                LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
                {creator_join}
                ORDER BY t.created_at DESC
                """
            )
        rows = cur.fetchall()
        return [_normalize_etl_connection_row(dict(r)) for r in rows]
    finally:
        cur.close()
        conn.close()


def create_etl_table(
    connection_id: int,
    target_table: str,
    description: Optional[str],
    created_by: str,
    source_table: Optional[str] = None,
    file_type: Optional[str] = None,
    file_path: Optional[str] = None,
    pk_columns: Optional[str] = None,
    incremental_column: Optional[str] = None,
    sync_mode: Optional[str] = None,
    batch_size: Optional[int] = None,
    batch_interval_seconds: Optional[int] = None,
    storage_connection_id: Optional[int] = None,
    column_mapping: Optional[List[dict]] = None,
    on_row_error: Optional[str] = None,
    index_definitions: Optional[List[dict]] = None,
    diff_delete_orphans: bool = False,
    create_user_id: Optional[int] = None,
    table_label: Optional[str] = None,
    table_dscrtn: Optional[str] = None,
) -> int:
    """etl_tables 1건 등록. target_table 검증 후 INSERT. 반환: etl_table_id. create_user_id는 JWT user_id.
    table_label·table_dscrtn은 system_db table_master와 동일 컬럼명(적재 후 원장 반영용). description은 하위 호환으로 table_dscrtn 미지정 시 동일 값으로 저장.
    - 동일 target_table은 다른 연결(DB)에서 같은 테이블로 추가 적재할 수 있으므로 중복 허용.
    - 메인 DB에 해당 테이블이 이미 있을 때: full 모드면 ValueError, incremental 모드면 허용(파일로 만든 테이블에 DB 증분 ETL 추가 가능).
    DB 소스이고 pk_columns가 비어 있으면 소스 DB에서 PK 자동 조회(etl_tables에 pk_columns 컬럼이 없으면 INSERT에 포함되지 않음. 실행 시 db_load_service가 소스/타겟 PK로 보강)."""
    api_db = _get_db()
    target_table = _validate_identifier(target_table, "target_table")
    if (source_table or "").strip():
        source_table = _validate_source_table(source_table)
    schema = _schema()
    # 동일 타겟 테이블은 다른 DB(연결)에서 같은 테이블로 추가 적재할 수 있으므로 target_table 유일성 검사 제거.
    # 앱 기본은 incremental(미지정 시). DDL 기본이 full이면 SQL로 직접 INSERT할 때만 DDL 기본이 적용되므로, 운영 DDL은 incremental 기본 권장(docs/main/04).
    sync_mode = (sync_mode or "incremental").strip().lower()
    if sync_mode not in ("full", "incremental", "diff"):
        sync_mode = "incremental"
    if sync_mode == "full" and target_table_exists(storage_connection_id, target_table):
        raise ValueError(
            "해당 저장 DB에 이미 존재하는 테이블명입니다. 전체(Full) 동기화는 기존 테이블을 삭제한 뒤 재생성하므로, "
            "다른 이름을 사용하거나 증분(Incremental) 모드로 등록하세요."
        )
    if sync_mode == "diff" and not target_table_exists(storage_connection_id, target_table):
        raise ValueError(
            "diff 모드는 타겟 테이블이 이미 존재해야 합니다. 먼저 full 모드로 최초 적재한 뒤 diff 모드로 전환하세요."
        )
    pk_columns_val = (pk_columns or "").strip() or None
    if not pk_columns_val and connection_id and source_table:
        c = get_connection_for_etl(connection_id)
        stype = (c.get("source_type") or "").strip().lower() if c else ""
        src_conn = None
        try:
            if stype == "postgresql":
                from Backend.etl_server import db_load_service
                src_conn = db_load_service._get_source_connection(connection_id)
                schema_src, table_for_pk = parse_source_table_parts(
                    source_table, stype,
                    conn_schema=(c.get("schema_name") or "public").strip(),
                    conn_db=None,
                )
                if table_for_pk:
                    pk_list = db_load_service._fetch_source_pk_columns(src_conn, schema_src, table_for_pk)
                    if pk_list:
                        pk_columns_val = ",".join(pk_list)
            elif stype == "mysql":
                src_conn = _connect_mysql(
                    c["host"],
                    c.get("port") or 3306,
                    c["database_name"],
                    c["username"],
                    c.get("encrypted_password") or "",
                )
                db_name, table_for_pk = parse_source_table_parts(
                    source_table, stype,
                    conn_schema=None,
                    conn_db=(c.get("database_name") or "").strip(),
                )
                if table_for_pk:
                    pk_list = _fetch_pk_from_mysql(src_conn, db_name, table_for_pk)
                    if pk_list:
                        pk_columns_val = ",".join(pk_list)
            elif stype == "oracle":
                src_conn = _connect_oracle(
                    c["host"],
                    c.get("port") or 1521,
                    c["database_name"],
                    c["username"],
                    c.get("encrypted_password") or "",
                )
                st = _normalize_source_table_dots(source_table)
                parts = st.split(".", maxsplit=1)
                if len(parts) == 2:
                    owner, tbl = parts[0].strip().upper(), parts[1].strip().upper()
                else:
                    owner = (c.get("schema_name") or c.get("username") or "").strip().upper()
                    tbl = st.upper()
                pk_list = _fetch_pk_from_oracle(src_conn, owner, tbl)
                if pk_list:
                    pk_columns_val = ",".join(pk_list)
        except Exception as e:
            logger.warning("소스 DB PK 자동 조회 실패(connection_id=%s, source_table=%s, source_type=%s): %s", connection_id, source_table, stype, e)
        finally:
            if src_conn:
                try:
                    src_conn.close()
                except Exception:
                    pass
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        on_row_error_val = (on_row_error or "fail").strip().lower() if on_row_error is not None else "fail"
        if on_row_error_val not in ("fail", "skip"):
            on_row_error_val = "fail"
        batch_val = batch_size if batch_size is not None and batch_size > 0 else None
        interval_val = batch_interval_seconds if batch_interval_seconds is not None and batch_interval_seconds >= 0 else 0
        column_mapping_json = json.dumps(column_mapping) if column_mapping is not None else None
        index_definitions_json = json.dumps(index_definitions) if index_definitions is not None else None
        cols = _table_columns_lower(cur, schema, "etl_tables")
        insert_cols: list[str] = []
        insert_vals: list[Any] = []

        def add_col(name: str, value: Any) -> None:
            if name in cols:
                insert_cols.append(name)
                insert_vals.append(value)

        add_col("connection_id", connection_id)
        add_col("source_table", source_table or None)
        add_col("target_table", target_table)
        dsc_merged = (table_dscrtn or "").strip() or None
        if dsc_merged is None:
            dsc_merged = (description or "").strip() or None
        lbl_val = (table_label or "").strip() or None
        add_col("table_label", lbl_val)
        add_col("table_dscrtn", dsc_merged)
        add_col("description", dsc_merged)
        add_col("file_type", file_type)
        add_col("file_path", file_path)
        add_col("pk_columns", pk_columns_val)
        add_col("incremental_column", (incremental_column or "").strip() or None)
        add_col("sync_mode", sync_mode)
        add_col("batch_size", batch_val)
        add_col("batch_interval_seconds", interval_val)
        add_col("storage_connection_id", storage_connection_id)
        add_col("column_mapping", column_mapping_json)
        add_col("on_row_error", on_row_error_val)
        add_col("index_definitions", index_definitions_json)
        add_col("diff_delete_orphans", bool(diff_delete_orphans))
        if "status" in cols:
            add_col("status", "draft")
        if "is_active" in cols:
            add_col("is_active", True)
        if "updated_at" in cols:
            insert_cols.append("updated_at")
            insert_vals.append("NOW()")
        cnames, cvals = _append_creator_columns_etl(cols, create_user_id, created_by)
        for i, name in enumerate(cnames):
            insert_cols.append(name)
            insert_vals.append(cvals[i])

        placeholders = ", ".join("NOW()" if v == "NOW()" else "%s" for v in insert_vals)
        params = tuple(v for v in insert_vals if v != "NOW()")
        cur.execute(
            f"INSERT INTO {_q(schema, 'etl_tables')} ({', '.join(insert_cols)}) VALUES ({placeholders}) RETURNING etl_table_id",
            params,
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["etl_table_id"])
    finally:
        cur.close()
        conn.close()


def get_etl_table(etl_table_id: int) -> Optional[dict]:
    """etl_table_id로 1건 조회. 없으면 None. batch_size, batch_interval_seconds 포함."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        tcols = _table_columns_lower(cur, schema, "etl_tables")
        has_creator = "create_user_id" in tcols
        creator_sel = "t.create_user_id" if has_creator else "NULL::integer AS create_user_id"
        creator_join = ""
        creator_label_sql = ", NULL::text AS create_user_label"
        if has_creator:
            if _table_exists(cur, schema, "user_info"):
                creator_join = f" LEFT JOIN user_info u_cr ON u_cr.user_id = t.create_user_id "
                creator_label_sql = (
                    ", COALESCE(NULLIF(TRIM(u_cr.user_nickname), ''), NULLIF(TRIM(u_cr.user_email), ''), "
                    "CASE WHEN t.create_user_id IS NOT NULL THEN 'ID ' || t.create_user_id::text ELSE NULL END) AS create_user_label"
                )
            else:
                creator_label_sql = (
                    ", CASE WHEN t.create_user_id IS NOT NULL THEN 'ID ' || t.create_user_id::text ELSE NULL END AS create_user_label"
                )
        t_sel = _etl_tables_t_select_sql(tcols)
        ccols = _table_columns_lower(cur, schema, "etl_connections")
        conn_st_sql = _etl_conn_type_select_sql(ccols, "c")
        cur.execute(
            f"""
            SELECT {t_sel},
                   {creator_sel}{creator_label_sql},
                   c.connection_name, {conn_st_sql}
            FROM {_q(schema, "etl_tables")} t
            LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
            {creator_join}
            WHERE t.etl_table_id = %s
            """,
            (etl_table_id,),
        )
        row = cur.fetchone()
        return _normalize_etl_connection_row(dict(row)) if row else None
    finally:
        cur.close()
        conn.close()


def get_sync_mode_for_load(etl_table_id: int) -> str:
    """etl_tables.sync_mode를 조회해 'full' | 'incremental' | 'diff' 반환. 명시적 'full'/'diff'만 그대로, 그 외는 incremental."""
    row = get_etl_table(etl_table_id)
    if not row:
        return "incremental"
    raw = row.get("sync_mode")
    normalized = (str(raw).strip().lower() if raw is not None else "") or ""
    if normalized in ("full", "diff"):
        return normalized
    return "incremental"


def _norm_host_identity(h: Any) -> str:
    return (str(h or "").strip().lower())


def _storage_pg_identity_tuple(storage_connection_id: Any) -> Optional[tuple]:
    """
    적재 저장 DB가 PostgreSQL일 때 (host, port, database, default_schema) 튜플.
    내장 main·dash·etl_storage_connections(PostgreSQL)만 처리. 그 외 None.
    """
    api_db = _get_db()
    try:
        if is_builtin_main_storage(storage_connection_id):
            c = api_db.get_db_config()
            return (
                _norm_host_identity(c.get("host")),
                int(c.get("port") or 5432),
                str(c.get("database") or "").strip().lower(),
                (api_db.get_table_schema() or "public").strip(),
            )
        if is_builtin_dash_storage(storage_connection_id):
            from Backend.core import db as core_db_mod

            c = core_db_mod.get_dash_db_config()
            return (
                _norm_host_identity(c.get("host")),
                int(c.get("port") or 5432),
                str(c.get("database") or "").strip().lower(),
                (core_db_mod.get_dash_table_schema() or "public").strip(),
            )
        sc = get_storage_connection(int(storage_connection_id))
        if not sc:
            return None
        st = (sc.get("source_type") or sc.get("storage_type") or "").lower()
        if "postgres" not in st:
            return None
        return (
            _norm_host_identity(sc.get("host")),
            int(sc.get("port") or 5432),
            str(sc.get("database_name") or "").strip().lower(),
            (sc.get("schema_name") or "public").strip(),
        )
    except Exception as e:
        logger.warning("_storage_pg_identity_tuple failed: %s", e)
        return None


def _row_pg_identity_tuple(host: Any, port: Any, database_name: Any, schema_name: Any) -> tuple:
    return (
        _norm_host_identity(host),
        int(port or 5432),
        str(database_name or "").strip().lower(),
        (schema_name or "public").strip(),
    )


def _find_downstream_etl_reading_target_pg(
    cur_sys: Any,
    schema: str,
    etl_table_id: int,
    storage_connection_id: Any,
    target_table: str,
) -> List[dict]:
    """
    삭제 시 DROP 대상이 되는 (저장 PostgreSQL) 물리 테이블을 etl_connections로 동일 DB에서 읽는 다른 etl_tables 행.
    반환: [{"etl_table_id", "source_table"}, ...]
    """
    stor = _storage_pg_identity_tuple(storage_connection_id)
    if not stor:
        return []
    try:
        _, tgt_schema = get_target_db_connection(storage_connection_id)
    except Exception as e:
        logger.warning("_find_downstream_etl_reading_target_pg: get_target_db_connection: %s", e)
        return []
    tgt_schema = (tgt_schema or "public").strip()
    tgt_tbl = (target_table or "").strip()
    if not tgt_tbl:
        return []
    if not _table_exists(cur_sys, schema, "etl_tables") or not _table_exists(cur_sys, schema, "etl_connections"):
        return []
    ccols = _table_columns_lower(cur_sys, schema, "etl_connections")
    type_sql = _etl_conn_type_select_sql(ccols, "c")
    cur_sys.execute(
        f"""
        SELECT t.etl_table_id, t.source_table, c.host, c.port, c.database_name, c.schema_name, {type_sql}
        FROM {_q(schema, "etl_tables")} t
        INNER JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
        WHERE t.etl_table_id <> %s AND t.connection_id IS NOT NULL
        """,
        (etl_table_id,),
    )
    raw_rows = cur_sys.fetchall()
    desc = cur_sys.description
    colnames = [d[0] for d in desc] if desc else []
    out: List[dict] = []
    for r in raw_rows:
        if hasattr(r, "keys"):
            d = dict(r)
        else:
            d = {colnames[i]: r[i] for i in range(min(len(colnames), len(r)))}
        src_type = (d.get("source_type") or "").strip().lower()
        if src_type not in ("postgresql", "postgres"):
            continue
        row_t = _row_pg_identity_tuple(
            d.get("host"), d.get("port"), d.get("database_name"), d.get("schema_name")
        )
        if row_t != stor:
            continue
        st_src = d.get("source_table") or ""
        sch, tbl = parse_source_table_parts(st_src, "postgresql", conn_schema=d.get("schema_name"))
        if sch.strip().lower() == tgt_schema.lower() and tbl.strip().lower() == tgt_tbl.lower():
            out.append({
                "etl_table_id": int(d.get("etl_table_id")),
                "source_table": st_src,
            })
    return out


def _count_table_project_mapping_for_target(
    cur_sys: Any, schema: str, db_type: str, table_name: str
) -> int:
    """
    table_master(db_type, table_name)에 연결된 table_project_mapping 행 수.
    테이블·컬럼 없으면 0.
    """
    dt = (db_type or "main").strip().lower()
    if dt not in ("main", "dash"):
        dt = "main"
    tn = (table_name or "").strip()
    if not tn:
        return 0
    if not _table_exists(cur_sys, schema, "table_master") or not _table_exists(cur_sys, schema, "table_project_mapping"):
        return 0
    cur_sys.execute(
        f"""
        SELECT COUNT(*)::int AS c FROM {_q(schema, "table_project_mapping")} m
        INNER JOIN {_q(schema, "table_master")} tm ON tm.table_master_id = m.table_master_id
        WHERE tm.db_type = %s AND tm.table_name = %s
        """,
        (dt, tn),
    )
    row = cur_sys.fetchone()
    if not row:
        return 0
    if isinstance(row, dict):
        return int(next(iter(row.values()), 0) or 0)
    return int(row[0] or 0)


def delete_etl_table(etl_table_id: int) -> dict:
    """
    ETL 테이블 1건 삭제(물리 테이블 DROP까지 일괄).
    - 사전 검증: 타겟명 필수·식별자 패턴, 동일 target_table 다른 ETL 없음,
      동일 PostgreSQL 저장소에서 이 타겟을 source_table로 읽는 다른 ETL 없음, 내장 저장소면 table_project_mapping 없음.
    - etl_batch_target_registry 선삭제 → 스케줄러에서 배치 제거 → batch_loaded_keys·batch_run_history·batch_jobs 삭제
    - 내장 main|dash: table_master 행 삭제 → 저장 DB DROP → etl_transform_rules·etl_jobs·etl_tables 삭제
    - 외부 저장소: table_master 생략, DROP만 동일 순서로 시도.
    시스템 DB 트랜잭션 내에서 배치·원장 삭제 후 DROP; DROP 실패 시 rollback으로 배치·원장 복구.
    반환: file_path(호환), target_table_dropped(True).
    """
    row = get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    file_path = row.get("file_path")
    target_table = (row.get("target_table") or "").strip()
    storage_id = row.get("storage_connection_id")
    api_db = _get_db()
    schema = _schema()
    out: dict = {"file_path": None, "target_table_dropped": False, "drop_skip_reason": None}

    if not target_table:
        raise ValueError(
            "타겟 테이블명이 없어 삭제할 수 없습니다. 메타를 복구하거나 DB에서 수동으로 정리하세요."
        )
    if not re.match(r"^[a-zA-Z0-9_]+$", target_table):
        raise ValueError(
            "타겟 테이블명에 허용되지 않은 문자가 있어 안전하게 DROP할 수 없습니다. 이름을 바꾼 뒤 다시 시도하거나 DB에서 수동 정리하세요."
        )

    add_file_paths: List[str] = []
    conn_sys = api_db.get_db_connection_system()
    cur_sys = conn_sys.cursor()
    try:
        cur_sys.execute(
            f"SELECT COUNT(*) FROM {_q(schema, 'etl_tables')} WHERE target_table = %s AND etl_table_id != %s",
            (target_table, etl_table_id),
        )
        other_count = cur_sys.fetchone()
        ocnt = next(iter(other_count.values()), 0) if isinstance(other_count, dict) else (other_count[0] if other_count else 0)
        if int(ocnt) > 0:
            raise ValueError(
                "동일 타겟 테이블명을 사용하는 다른 ETL 등록이 남아 있어 삭제할 수 없습니다. "
                "다른 등록을 먼저 삭제하거나, 동일 물리 테이블을 참조하지 않도록 조정한 뒤 다시 시도하세요."
            )

        downstream = _find_downstream_etl_reading_target_pg(
            cur_sys, schema, etl_table_id, storage_id, target_table
        )
        if downstream:
            ids = ", ".join(str(x["etl_table_id"]) for x in downstream)
            raise ValueError(
                "이 ETL이 적재한 테이블을 소스 DB로 읽는 다른 ETL 등록이 있습니다. "
                "해당 등록을 먼저 삭제하거나 소스 테이블을 변경한 뒤 이 ETL을 삭제하세요. "
                f"(etl_table_id: {ids})"
            )

        if should_upsert_table_master_for_storage(storage_id):
            db_type_tm = table_master_db_type_for_storage(storage_id)
            n_map = _count_table_project_mapping_for_target(cur_sys, schema, db_type_tm, target_table)
            if n_map > 0:
                raise ValueError(
                    "이 테이블은 프로젝트에 연결되어 있습니다. "
                    "관리 화면에서 테이블·프로젝트 매핑(table_project_mapping)을 먼저 해제한 뒤 삭제할 수 있습니다. "
                    "앞으로 쿼리·대시보드 등 참조가 늘어날 수 있으므로 매핑을 남긴 채 물리 삭제되지 않도록 막습니다."
                )

        jcols_ej = _table_columns_lower(cur_sys, schema, "etl_jobs")
        if "add_file_path" in jcols_ej:
            cur_sys.execute(
                f"SELECT add_file_path FROM {_q(schema, 'etl_jobs')} WHERE etl_table_id = %s AND add_file_path IS NOT NULL",
                (etl_table_id,),
            )
            for r in cur_sys.fetchall():
                try:
                    p = r.get("add_file_path") if hasattr(r, "get") else (r[0] if r else None)
                except (KeyError, IndexError, TypeError):
                    p = None
                p = (p or "").strip() if isinstance(p, str) else ""
                if p:
                    add_file_paths.append(p)

        from Backend.etl_server import service_file as etl_batch_registry_mod

        etl_batch_registry_mod.delete_batch_target_registry_rows_for_etl_table(etl_table_id, cur_sys, schema)

        if _table_exists(cur_sys, schema, "batch_jobs"):
            jcols_bj = _table_columns_lower(cur_sys, schema, "batch_jobs")
            if "etl_table_id" in jcols_bj and "batch_job_id" in jcols_bj:
                cur_sys.execute(
                    f"SELECT batch_job_id FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s",
                    (etl_table_id,),
                )
                for r in cur_sys.fetchall():
                    try:
                        jid = r.get("batch_job_id") if hasattr(r, "get") else r[0]
                        if jid is not None:
                            from Backend.etl_server import scheduler_file as sched_mod

                            sched_mod.remove_job(int(jid))
                    except (TypeError, ValueError):
                        pass
            if "etl_table_id" in jcols_bj:
                try:
                    cur_sys.execute(
                        f"DELETE FROM {_q(schema, 'batch_loaded_keys')} WHERE batch_job_id IN (SELECT batch_job_id FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s)",
                        (etl_table_id,),
                    )
                    cur_sys.execute(
                        f"DELETE FROM {_q(schema, 'batch_run_history')} WHERE batch_job_id IN (SELECT batch_job_id FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s)",
                        (etl_table_id,),
                    )
                    cur_sys.execute(f"DELETE FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s", (etl_table_id,))
                except Exception:
                    conn_sys.rollback()
                    raise

        if should_upsert_table_master_for_storage(storage_id) and _table_exists(cur_sys, schema, "table_master"):
            cur_sys.execute(
                f"DELETE FROM {_q(schema, 'table_master')} WHERE db_type = %s AND table_name = %s",
                (table_master_db_type_for_storage(storage_id), target_table),
            )

        conn_main, main_schema = get_target_db_connection(storage_id)
        cur_main = conn_main.cursor()
        try:
            full_name = f'"{main_schema}"."{target_table}"'
            cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
            conn_main.commit()
            out["target_table_dropped"] = True
            logger.info("delete_etl_table etl_table_id=%s: 저장 DB DROP 완료 %s", etl_table_id, full_name)
        except Exception:
            conn_main.rollback()
            conn_sys.rollback()
            raise
        finally:
            cur_main.close()
            conn_main.close()

        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_transform_rules')} WHERE etl_table_id = %s", (etl_table_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_jobs')} WHERE etl_table_id = %s", (etl_table_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_tables')} WHERE etl_table_id = %s", (etl_table_id,))
        conn_sys.commit()
    finally:
        cur_sys.close()
        conn_sys.close()

    for path_candidate in [file_path] + add_file_paths:
        resolved = _resolve_upload_path_for_delete(path_candidate)
        if resolved and os.path.isfile(resolved):
            try:
                os.remove(resolved)
            except OSError:
                pass

    return out


def delete_etl_table_row_only(etl_table_id: int) -> None:
    """
    ETL 등록 행만 삭제. 메인 DB 타겟 테이블은 DROP하지 않음.
    - 해당 행의 업로드 파일(file_path) 삭제
    - 해당 etl_table_id의 모든 job의 add_file_path 파일 삭제
    - etl_transform_rules, etl_jobs, etl_tables에서 해당 행 삭제
    """
    row = get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    file_path = (row.get("file_path") or "").strip() or None

    api_db = _get_db()
    schema = _schema()
    conn_sys = api_db.get_db_connection_system()
    cur_sys = conn_sys.cursor()
    add_file_paths = []
    try:
        jcols_ej = _table_columns_lower(cur_sys, schema, "etl_jobs")
        if "add_file_path" in jcols_ej:
            cur_sys.execute(
                f"SELECT add_file_path FROM {_q(schema, 'etl_jobs')} WHERE etl_table_id = %s AND add_file_path IS NOT NULL",
                (etl_table_id,),
            )
            for r in cur_sys.fetchall():
                try:
                    p = r.get("add_file_path") if hasattr(r, "get") else (r[0] if r else None)
                except (KeyError, IndexError, TypeError):
                    p = None
                p = (p or "").strip() if isinstance(p, str) else ""
                if p:
                    add_file_paths.append(p)
        from Backend.etl_server import service_file as etl_batch_registry_mod

        etl_batch_registry_mod.delete_batch_target_registry_rows_for_etl_table(etl_table_id, cur_sys, schema)
        try:
            cur_sys.execute(
                f"DELETE FROM {_q(schema, 'batch_loaded_keys')} WHERE batch_job_id IN (SELECT batch_job_id FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s)",
                (etl_table_id,),
            )
            cur_sys.execute(
                f"DELETE FROM {_q(schema, 'batch_run_history')} WHERE batch_job_id IN (SELECT batch_job_id FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s)",
                (etl_table_id,),
            )
            cur_sys.execute(f"DELETE FROM {_q(schema, 'batch_jobs')} WHERE etl_table_id = %s", (etl_table_id,))
        except Exception:
            conn_sys.rollback()
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_transform_rules')} WHERE etl_table_id = %s", (etl_table_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_jobs')} WHERE etl_table_id = %s", (etl_table_id,))
        cur_sys.execute(f"DELETE FROM {_q(schema, 'etl_tables')} WHERE etl_table_id = %s", (etl_table_id,))
        conn_sys.commit()
    finally:
        cur_sys.close()
        conn_sys.close()

    resolved_main = _resolve_upload_path_for_delete(file_path)
    if resolved_main and os.path.isfile(resolved_main):
        try:
            os.remove(resolved_main)
        except OSError:
            pass
    for p in add_file_paths:
        resolved = _resolve_upload_path_for_delete(p)
        if resolved and os.path.isfile(resolved):
            try:
                os.remove(resolved)
            except OSError:
                pass


def update_last_synced_at(etl_table_id: int, synced_at: Any):
    """증분 적재 완료 후 last_synced_at 갱신. synced_at은 datetime 또는 문자열."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_tables")
        updates: list[str] = []
        params: list[Any] = []
        if "last_synced_at" in cols:
            updates.append("last_synced_at = %s")
            params.append(synced_at)
        if "updated_at" in cols:
            updates.append("updated_at = NOW()")
        if not updates:
            return
        params.append(etl_table_id)
        cur.execute(f"UPDATE {_q(schema, 'etl_tables')} SET {', '.join(updates)} WHERE etl_table_id = %s", tuple(params))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def insert_job(
    etl_table_id: Optional[int],
    status: str = "running",
    add_file_path: Optional[str] = None,
    add_file_type: Optional[str] = None,
    create_user_id: Optional[int] = None,
) -> int:
    """etl_jobs에 1건 삽입. 반환: job_id. status='pending'이면 started_at NULL. add_file_path/add_file_type는 두 컬럼 모두 있을 때만 INSERT에 포함. create_user_id는 컬럼 있을 때만."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_jobs")
        cnames, cvals = _append_creator_columns_etl(cols, create_user_id, "")
        started = "NULL" if (status or "").strip().lower() == "pending" else "NOW()"
        extra_cols = ", ".join(cnames)
        extra_ph = ", ".join(["%s"] * len(cvals))
        extra_sql = f", {extra_cols}" if cnames else ""
        extra_vals_sql = f", {extra_ph}" if cvals else ""
        has_add_cols = "add_file_path" in cols and "add_file_type" in cols
        if add_file_path is not None and add_file_type is not None and has_add_cols:
            sql = f"""
                INSERT INTO {_q(schema, "etl_jobs")}
                (etl_table_id, status, started_at, add_file_path, add_file_type, created_at{extra_sql})
                VALUES (%s, %s, {started}, %s, %s, NOW(){extra_vals_sql})
                RETURNING job_id
                """
            params = (etl_table_id, status, add_file_path, add_file_type) + tuple(cvals)
            cur.execute(sql, params)
        else:
            sql = f"""
                INSERT INTO {_q(schema, "etl_jobs")}
                (etl_table_id, status, started_at, created_at{extra_sql})
                VALUES (%s, %s, {started}, NOW(){extra_vals_sql})
                RETURNING job_id
                """
            params = (etl_table_id, status) + tuple(cvals)
            cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return int(row["job_id"])
    finally:
        cur.close()
        conn.close()


def set_job_running(job_id: int) -> None:
    """Phase 6: 워커가 Job 수거 시 status='running', started_at=NOW() 로 갱신. finished_at은 건드리지 않음."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = 'running', started_at = COALESCE(started_at, NOW())
            WHERE job_id = %s
            """,
            (job_id,),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def list_jobs(etl_table_id: Optional[int] = None, limit: int = 50, statuses: Optional[list] = None) -> list:
    """Phase 6: Job 목록. etl_table_id 지정 시 해당 ETL만. etl_tables·etl_jobs 컬럼은 information_schema 기준 방어. user_info 없으면 등록자 라벨은 ID만."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        tcols = _table_columns_lower(cur, schema, "etl_tables")
        t_join_sql = _etl_tables_join_select_parts(tcols)
        has_creator = "create_user_id" in jcols
        has_user_info = _table_exists(cur, schema, "user_info") if has_creator else False
        cr_join = ""
        if has_creator and has_user_info:
            cr_join = " LEFT JOIN user_info u_j ON u_j.user_id = j.create_user_id "
        if has_creator and has_user_info:
            cr_sel = (
                ", j.create_user_id, COALESCE(NULLIF(TRIM(u_j.user_nickname), ''), NULLIF(TRIM(u_j.user_email), ''), "
                "CASE WHEN j.create_user_id IS NOT NULL THEN 'ID ' || j.create_user_id::text ELSE NULL END) AS create_user_label"
            )
        elif has_creator:
            cr_sel = (
                ", j.create_user_id, CASE WHEN j.create_user_id IS NOT NULL THEN 'ID ' || j.create_user_id::text ELSE NULL END AS create_user_label"
            )
        else:
            cr_sel = ""
        where_parts = []
        params: list[Any] = []
        if etl_table_id is not None:
            where_parts.append("j.etl_table_id = %s")
            params.append(etl_table_id)
        if statuses:
            placeholders = ", ".join(["%s"] * len(statuses))
            where_parts.append(f"j.status IN ({placeholders})")
            params.extend(s.strip().lower() for s in statuses if s)
        where_sql = " AND ".join(where_parts) if where_parts else "1=1"
        params.append(limit)
        j_sel = _etl_jobs_j_select_sql(jcols)
        select_sql = (
            f"SELECT {j_sel}, {t_join_sql}{cr_sel} "
            f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id{cr_join}"
            f" WHERE {where_sql} ORDER BY j.created_at DESC LIMIT %s"
        )
        cur.execute(select_sql, tuple(params))
        out = [dict(r) for r in cur.fetchall()]
        _apply_etl_job_list_compat_keys(out)
        if not has_creator:
            for d in out:
                d.setdefault("create_user_id", None)
                d.setdefault("create_user_label", None)
        return out
    finally:
        cur.close()
        conn.close()


def delete_job(job_id: int) -> bool:
    """Job 1건 삭제(etl_jobs에서 DELETE). add_file_path 컬럼이 있고 값이 있으면 업로드 파일도 삭제. DDL 드리프트 시 SELECT 생략."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    add_file_path = None
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        if "add_file_path" in jcols:
            cur.execute(
                f"SELECT add_file_path FROM {_q(schema, 'etl_jobs')} WHERE job_id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            if row:
                p = row.get("add_file_path") if hasattr(row, "get") else None
                if p:
                    add_file_path = (str(p) or "").strip() or None
        cur.execute(f"DELETE FROM {_q(schema, 'etl_jobs')} WHERE job_id = %s", (job_id,))
        conn.commit()
        ok = cur.rowcount > 0
        if ok and add_file_path:
            resolved = _resolve_upload_path_for_delete(add_file_path)
            if resolved and os.path.isfile(resolved):
                try:
                    os.remove(resolved)
                except OSError:
                    pass
        return ok
    finally:
        cur.close()
        conn.close()


def set_job_total_rows(job_id: int, total_rows: int) -> None:
    """Job의 total_rows 설정. ETA·진행률 계산용. etl_jobs.total_rows 컬럼 필요."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        if "total_rows" in jcols:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_jobs')} SET total_rows = %s WHERE job_id = %s",
                (total_rows, job_id),
            )
        elif "rows_extracted" in jcols:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_jobs')} SET rows_extracted = %s WHERE job_id = %s",
                (total_rows, job_id),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_job_progress(job_id: int, rows_processed: int) -> None:
    """진행 중인 Job의 rows_processed만 갱신. status/finished_at은 건드리지 않음. 배치 단위 진행률 표시용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        if "rows_processed" in jcols:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_jobs')} SET rows_processed = %s WHERE job_id = %s AND status = %s",
                (rows_processed, job_id, "running"),
            )
        elif "rows_loaded" in jcols:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_jobs')} SET rows_loaded = %s WHERE job_id = %s AND status = %s",
                (rows_processed, job_id, "running"),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_job(job_id: int) -> Optional[dict]:
    """Phase 6: job_id로 Job 1건 조회. target_table, total_rows 포함. DDL 버전별 컬럼은 information_schema 기준으로 보정."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        tcols = _table_columns_lower(cur, schema, "etl_tables")
        t_join_sql = _etl_tables_join_select_parts(tcols)
        j_sel = _etl_jobs_j_select_sql(jcols)
        cur.execute(
            f"SELECT {j_sel}, {t_join_sql} "
            f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id WHERE j.job_id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        _apply_etl_job_list_compat_keys([d])
        return d
    finally:
        cur.close()
        conn.close()


def fetch_pending_jobs(limit: int) -> list:
    """Phase 6: pending 상태 Job을 created_at 순으로 최대 limit건 조회."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT job_id, etl_table_id
            FROM {_q(schema, "etl_jobs")}
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def claim_next_pending_job() -> Optional[tuple]:
    """
    Phase 6: pending Job 1건을 running으로 선점(경쟁 방지). SELECT FOR UPDATE SKIP LOCKED 후 UPDATE.
    반환: (job_id, etl_table_id) 또는 None.
    """
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT job_id, etl_table_id
            FROM {_q(schema, "etl_jobs")}
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """
        )
        row = cur.fetchone()
        if not row or row.get("job_id") is None:
            conn.commit()
            return None
        job_id = int(row["job_id"])
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = 'running', started_at = COALESCE(started_at, NOW())
            WHERE job_id = %s
            """,
            (job_id,),
        )
        conn.commit()
        return (job_id, row.get("etl_table_id"))
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def count_running_jobs() -> int:
    """Phase 6: status='running' 인 Job 수."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT COUNT(*) AS n FROM {_q(schema, 'etl_jobs')} WHERE status = 'running'",
        )
        row = cur.fetchone()
        return int(row["n"]) if row else 0
    finally:
        cur.close()
        conn.close()


def is_job_cancelled(job_id: int) -> bool:
    """Job이 사용자에 의해 취소 요청되었는지. 워커 루프에서 주기적으로 확인용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT status FROM {_q(schema, 'etl_jobs')} WHERE job_id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        return (row and (row.get("status") or "").strip().lower() == "cancelled") or False
    finally:
        cur.close()
        conn.close()


def update_job(job_id: int, status: str, rows_processed: Optional[int] = None, error_message: Optional[str] = None, notice: Optional[str] = None):
    """etl_jobs 상태·종료 시각·건수·에러 메시지·안내(notice) 갱신. status에 'cancelled' 사용 가능."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        jcols = _table_columns_lower(cur, schema, "etl_jobs")
        updates = ["status = %s", "finished_at = NOW()", "error_message = %s"]
        params: list[Any] = [status, error_message]
        if "rows_processed" in jcols:
            updates.append("rows_processed = COALESCE(%s, rows_processed)")
            params.append(rows_processed)
        elif "rows_loaded" in jcols:
            updates.append("rows_loaded = COALESCE(%s, rows_loaded)")
            params.append(rows_processed)
        if "notice" in jcols:
            updates.append("notice = %s")
            params.append(notice)
        params.append(job_id)
        cur.execute(
            f"UPDATE {_q(schema, 'etl_jobs')} SET {', '.join(updates)} WHERE job_id = %s",
            tuple(params),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_etl_table_status(etl_table_id: int, status: str):
    """etl_tables.status(및 있으면 updated_at) 갱신. status 컬럼 없으면 DDL 드리프트 대응으로 생략."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_tables")
        if "status" not in cols:
            return
        updates = ["status = %s"]
        params: list[Any] = [status]
        if "updated_at" in cols:
            updates.append("updated_at = NOW()")
        params.append(etl_table_id)
        cur.execute(
            f"UPDATE {_q(schema, 'etl_tables')} SET {', '.join(updates)} WHERE etl_table_id = %s",
            tuple(params),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_etl_table(
    etl_table_id: int,
    pk_columns: Optional[str] = None,
    sync_mode: Optional[str] = None,
    incremental_column: Optional[str] = None,
    storage_connection_id: Optional[int] = None,
    column_mapping: Optional[List[dict]] = None,
    on_row_error: Optional[str] = None,
    batch_size: Optional[int] = None,
    batch_interval_seconds: Optional[int] = None,
    index_definitions: Optional[List[dict]] = None,
    clear_last_synced_at: bool = False,
    table_label: Optional[str] = None,
    table_dscrtn: Optional[str] = None,
) -> None:
    """etl_tables의 pk_columns, sync_mode, table_label, table_dscrtn, incremental_column, storage_connection_id, column_mapping, on_row_error, batch_size, batch_interval_seconds, index_definitions 등 지정 필드만 갱신. clear_last_synced_at=True면 last_synced_at을 NULL로 초기화(다음 실행 시 전체 조회)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cols = _table_columns_lower(cur, schema, "etl_tables")
        updates: List[str] = []
        params: List[Any] = []
        if on_row_error is not None and "on_row_error" in cols:
            val = (on_row_error or "fail").strip().lower()
            val = "fail" if val not in ("fail", "skip") else val
            updates.append("on_row_error = %s")
            params.append(val)
        if pk_columns is not None and "pk_columns" in cols:
            val = (pk_columns or "").strip() or None
            updates.append("pk_columns = %s")
            params.append(val)
        if sync_mode is not None and "sync_mode" in cols:
            raw = (sync_mode or "").strip().lower()
            val = raw if raw in ("full", "diff") else "incremental"
            updates.append("sync_mode = %s")
            params.append(val)
        if incremental_column is not None and "incremental_column" in cols:
            val = (incremental_column or "").strip() or None
            updates.append("incremental_column = %s")
            params.append(val)
        if storage_connection_id is not None and "storage_connection_id" in cols:
            updates.append("storage_connection_id = %s")
            params.append(storage_connection_id)
        if column_mapping is not None and "column_mapping" in cols:
            updates.append("column_mapping = %s::jsonb")
            params.append(json.dumps(column_mapping))
        if batch_size is not None and "batch_size" in cols:
            val = batch_size if batch_size > 0 else None
            updates.append("batch_size = %s")
            params.append(val)
        if batch_interval_seconds is not None and "batch_interval_seconds" in cols:
            val = max(0, batch_interval_seconds)
            updates.append("batch_interval_seconds = %s")
            params.append(val)
        if index_definitions is not None and "index_definitions" in cols:
            updates.append("index_definitions = %s::jsonb")
            params.append(json.dumps(index_definitions))
        if clear_last_synced_at and "last_synced_at" in cols:
            updates.append("last_synced_at = NULL")
        if table_label is not None and "table_label" in cols:
            val = (table_label or "").strip() or None
            updates.append("table_label = %s")
            params.append(val)
        if table_dscrtn is not None:
            val = (table_dscrtn or "").strip() or None
            if "table_dscrtn" in cols:
                updates.append("table_dscrtn = %s")
                params.append(val)
            if "description" in cols:
                updates.append("description = %s")
                params.append(val)
        if updates:
            if "updated_at" in cols:
                updates.append("updated_at = NOW()")
            params.append(etl_table_id)
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET {', '.join(updates)} WHERE etl_table_id = %s",
                tuple(params),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def refresh_etl_table_column_mapping(etl_table_id: int) -> None:
    """DB 소스 ETL의 column_mapping을 소스 테이블 컬럼·타입 기준으로 다시 채워 저장. 예전에 TEXT로 잘못 저장된 타입 보정용."""
    row = get_etl_table(etl_table_id)
    if not row:
        raise ValueError("ETL 테이블을 찾을 수 없습니다.")
    connection_id = row.get("connection_id")
    source_table = (row.get("source_table") or "").strip()
    if not connection_id or not source_table:
        raise ValueError("DB 소스 ETL만 컬럼 매핑 갱신이 가능합니다.")
    source_type = (row.get("source_type") or "postgresql").strip().lower()
    if source_type not in ("postgresql", "mysql", "oracle"):
        raise ValueError("postgresql, mysql, oracle 소스만 지원합니다.")
    from Backend.etl_server import db_load_service
    columns = db_load_service.get_source_columns(connection_id, source_table)
    if source_type == "mysql":
        type_mapper = db_load_service._pg_type_from_mysql
    elif source_type == "oracle":
        type_mapper = db_load_service._pg_type_from_oracle
    else:
        type_mapper = db_load_service._pg_type_from_info_schema
    column_mapping = [
        {"source": c["column_name"], "target": c["column_name"], "type": type_mapper(c["data_type"])}
        for c in columns
    ]
    update_etl_table(etl_table_id, column_mapping=column_mapping)
