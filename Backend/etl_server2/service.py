"""
Backend.etl_server.service (ETL 메타 CRUD·시스템 DB)
====================================================
etl_connections, etl_tables, etl_jobs 조회·등록·갱신. 시스템 DB(ibank_system_data) 전용.

[Helpers]
===========
66 - _get_db: api_server.db 지연 로드(순환 import 방지)
72 - _schema: get_system_table_schema() 반환
76 - _q: 스키마.테이블명 따옴표 감싼 문자열
84 - _sys_cursor: 시스템 DB 커서·커넥션 context manager (yield cur, conn). 새 함수 작성 시 사용 권장
79 - get_target_db_connection: 적재 대상 DB 연결 획득 (Phase 0: None=ibank_db. Phase 2b에서 storage_connection_id 분기)
81 - _validate_identifier: 식별자 영문·숫자·언더스코어 검증
   - _normalize_source_table_dots: 점 유사 문자를 ASCII 점으로 통일. _validate_source_table, parse_source_table_parts, Oracle PK 조회에서 사용
   - _validate_source_table: source_table 검증. 정규화 후 'schema.table'/'table' 각 부분 식별자 검증. 실패 시 bad_chars 로깅
91 - _connection_error_to_user_message: 연결 실패 예외 → 한글 메시지·점검 안내
   - parse_source_table_parts: source_table이 'schema.table' 형식일 때 (schema_or_db, table_name) 반환. PK 조회·쿼리용
152 - _connect_postgres: 외부 PostgreSQL 연결(테스트·소스 조회용). connect_timeout·로깅 적용
181 - _connect_mysql: 외부 MySQL 연결. PyMySQL
210 - _connect_oracle: 외부 Oracle 연결. oracledb
238 - _fetch_pk_from_mysql: MySQL information_schema KEY_COLUMN_USAGE로 PK 컬럼 목록
256 - _fetch_pk_from_oracle: Oracle all_constraints/user_constraints로 PK 컬럼 목록

[Target DB - Phase 3~5]
=====================
517 - list_target_tables: 저장 DB(적재 대상) 테이블 목록. storage_connection_id 없으면 ibank_db
541 - list_target_columns: 저장 DB 지정 테이블 컬럼 목록(column_name, data_type)
579 - target_table_exists: 저장 DB에 테이블 존재 여부 (target-exists API·검증용)
605 - get_target_table_column_names: 저장 DB 테이블 컬럼명 목록 (run_file_upsert 타겟 컬럼 조회)
612 - get_target_pk_columns: 저장 DB 테이블 PRIMARY KEY 컬럼명 목록

[Connections]
===========
107 - create_connection: DB 연결 등록(postgresql), 비밀번호 encrypted_password 저장
149 - list_connections: 연결 목록(비밀번호 제외)
170 - get_connection_for_etl: connection_id로 연결 정보(비밀번호 포함, 적재 시 사용)
193 - test_connection: connection_id 또는 인자로 연결 테스트(SELECT 1)
228 - list_source_tables: 외부 DB 테이블 목록. PostgreSQL(schema_name), MySQL(TABLE_SCHEMA=DB명), Oracle(ALL_TABLES/USER_TABLES)
260 - get_or_create_file_connection: source_type='file' 연결 1개 조회 또는 생성
291 - list_etl_tables_by_connection: connection_id별 ETL 테이블 목록
310 - delete_connection: 연결 삭제(관련 etl_tables·메인 DB 타겟 DROP)

[ETL Tables]
===========
344 - list_etl_tables: ETL 테이블 전체 목록(connection_name, source_type 포함)
369 - create_etl_table: ETL 테이블 1건 등록, etl_table_id 반환
425 - get_etl_table: etl_table_id로 1건 조회
436 - get_sync_mode_for_load: sync_mode 조회 후 'full'|'incremental' 정규화(명시적 full만 full)
452 - delete_etl_table: ETL 테이블 삭제, 메인 DB 타겟 DROP, file_path 반환
491 - delete_etl_table_row_only: 행·업로드 파일만 삭제(메인 DB 테이블 유지)
549 - update_last_synced_at: 증분 적재 후 last_synced_at 갱신
899 - update_etl_table: pk_columns 등 지정 필드만 갱신

[Jobs]
===========
568 - insert_job: etl_jobs 1건 삽입, job_id 반환. add_file_path/add_file_type 있으면 추가 적재 Job
602 - set_job_running: status=running, started_at=NOW()
623 - list_jobs: Job 목록(etl_table_id, statuses, limit), target_table 등 join
674 - delete_job: Job 1건 삭제, add_file_path 파일 있으면 삭제
703 - set_job_total_rows: total_rows 설정(ETA/진행률용)
705 - update_job_progress: 진행 중 job의 rows_processed만 갱신(배치 단위 진행률 표시)
720 - get_job: job_id로 1건 조회(target_table, add_file_path 등)
758 - fetch_pending_jobs: pending Job created_at 순 limit건
781 - claim_next_pending_job: 다음 pending 1건 claim(running으로 변경), (job_id, etl_table_id) 또는 None
824 - count_running_jobs: status='running' 개수
841 - is_job_cancelled: job 취소 여부 조회
859 - update_job: status, finished_at, rows_processed, error_message, notice 갱신
880 - update_etl_table_status: etl_tables.status 갱신

[Dependencies]
=========
- Backend.api_server.db (get_db_connection_system, get_system_table_schema)
- psycopg2 (외부 DB 연결·테스트·소스 테이블 목록)
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
    """순환 import 방지: api_server.db를 사용 시점에 로드."""
    from Backend.api_server import db as api_db
    return api_db


def _schema():
    return _get_db().get_system_table_schema()


def _q(schema_name: str, table_name: str) -> str:
    """스키마.테이블명 따옴표 감싸기."""
    return f'"{schema_name}"."{table_name}"'


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
    - storage_connection_id가 None이면 기본 ibank_db(config).
    - storage_connection_id가 있으면 etl_storage_connections에서 조회 후 해당 PostgreSQL 연결 반환.
    반환: (conn, schema_name: str). conn은 호출 후 cursor()로 커서 획득, 사용 후 close 책임은 호출부.
    """
    if storage_connection_id is None:
        api_db = _get_db()
        return api_db.get_db_connection(), api_db.get_table_schema()
    sc = get_storage_connection(storage_connection_id)
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
) -> int:
    """DB 연결 1건 등록. source_type=postgresql|mysql|oracle. 비밀번호는 encrypted_password에 저장(현재 평문)."""
    if not connection_name or not str(connection_name).strip():
        raise ValueError("connection_name이 비어 있습니다.")
    if source_type not in ("postgresql", "mysql", "oracle"):
        raise ValueError("지원 소스: postgresql, mysql, oracle")
    if not host or not database_name or not username:
        raise ValueError("host, database_name, username가 필요합니다.")
    port = port or _DEFAULT_PORTS.get(source_type, 5432)
    schema_name = (schema_name or ("public" if source_type == "postgresql" else "")).strip()
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_connections")}
            (connection_name, source_type, host, port, database_name, schema_name, username, encrypted_password, is_active, created_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, NOW())
            RETURNING connection_id
            """,
            (connection_name.strip(), source_type, host.strip(), int(port), database_name.strip(), schema_name, username.strip(), password or "", created_by),
        )
        row = cur.fetchone()
        conn.commit()
        return int(row["connection_id"])
    finally:
        cur.close()
        conn.close()


def list_connections() -> list:
    """연결 목록. 비밀번호(encrypted_password) 제외."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT connection_id, connection_name, source_type, host, port, database_name, schema_name, username,
                   is_active, created_by, created_at, updated_at
            FROM {_q(schema, "etl_connections")}
            ORDER BY created_at DESC
            """
        )
        return [dict(r) for r in cur.fetchall()]
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
        cur.execute(
            f"""
            SELECT connection_id, connection_name, source_type, host, port, database_name, schema_name,
                   username, encrypted_password
            FROM {_q(schema, "etl_connections")}
            WHERE connection_id = %s AND is_active = TRUE
            """,
            (connection_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


# ---------- 저장 DB(적재 대상) Phase 1: etl_storage_connections ----------

def list_storage_connections() -> list:
    """저장 DB(적재 대상) 연결 목록. 비밀번호 제외. is_active=True만 또는 전체(필터는 호출측)."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT storage_connection_id, connection_name, source_type, host, port, database_name, schema_name,
                   username, is_active, created_at, updated_at
            FROM {_q(schema, "etl_storage_connections")}
            ORDER BY created_at DESC
            """
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_storage_connection(storage_connection_id: int) -> Optional[dict]:
    """저장 DB 연결 1건 조회. 비밀번호 포함. Phase 2b get_target_db_connection에서 사용."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT storage_connection_id, connection_name, source_type, host, port, database_name, schema_name,
                   username, encrypted_password, is_active, created_at, updated_at
            FROM {_q(schema, "etl_storage_connections")}
            WHERE storage_connection_id = %s AND is_active = TRUE
            """,
            (storage_connection_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
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
) -> int:
    """저장 DB 연결 1건 등록. PostgreSQL 전용. 반환: storage_connection_id."""
    if not connection_name or not str(connection_name).strip():
        raise ValueError("connection_name이 비어 있습니다.")
    if not host or not database_name or not username:
        raise ValueError("host, database_name, username가 필요합니다.")
    port = int(port or 5432)
    schema_name = (schema_name or "public").strip() or "public"
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_storage_connections")}
            (connection_name, source_type, host, port, database_name, schema_name, username, encrypted_password, is_active, updated_at)
            VALUES (%s, 'postgresql', %s, %s, %s, %s, %s, %s, TRUE, NOW())
            RETURNING storage_connection_id
            """,
            (connection_name.strip(), host.strip(), port, database_name.strip(), schema_name, username.strip(), password or ""),
        )
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
) -> None:
    """저장 DB 연결 1건 수정. None인 필드는 변경하지 않음."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        updates = []
        params = []
        if connection_name is not None:
            updates.append("connection_name = %s")
            params.append(connection_name.strip())
        if host is not None:
            updates.append("host = %s")
            params.append(host.strip())
        if port is not None:
            updates.append("port = %s")
            params.append(int(port))
        if database_name is not None:
            updates.append("database_name = %s")
            params.append(database_name.strip())
        if schema_name is not None:
            updates.append("schema_name = %s")
            params.append((schema_name or "public").strip() or "public")
        if username is not None:
            updates.append("username = %s")
            params.append(username.strip())
        if password is not None:
            updates.append("encrypted_password = %s")
            params.append(password)
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(is_active)
        if not updates:
            return
        updates.append("updated_at = NOW()")
        params.append(storage_connection_id)
        cur.execute(
            f"UPDATE {_q(schema, 'etl_storage_connections')} SET {', '.join(updates)} WHERE storage_connection_id = %s",
            params,
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


def get_or_create_file_connection(created_by: str) -> int:
    """source_type='file' 연결 1개 반환. 없으면 생성 후 connection_id 반환."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f'SELECT connection_id FROM {_q(schema, "etl_connections")} WHERE source_type = %s AND is_active = TRUE LIMIT 1',
            ("file",),
        )
        row = cur.fetchone()
        if row:
            return int(row["connection_id"])
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_connections")}
            (connection_name, source_type, is_active, created_by, updated_at)
            VALUES (%s, %s, TRUE, %s, NOW())
            RETURNING connection_id
            """,
            ("파일 업로드", "file", created_by),
        )
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
        cur.execute(
            f"SELECT source_type FROM {_q(schema, 'etl_connections')} WHERE connection_id = %s",
            (connection_id,),
        )
        row = cur.fetchone()
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
        cur.execute(
            f"""
            SELECT t.etl_table_id, t.connection_id, t.source_table, t.target_table, t.description,
                   t.file_type, t.file_path, t.pk_columns, t.incremental_column, t.last_synced_at, t.sync_mode,
                   t.batch_size, t.batch_interval_seconds, t.status, t.created_at, t.storage_connection_id,
                   t.column_mapping, t.on_row_error, t.index_definitions,
                   c.connection_name, c.source_type,
                   sc.connection_name AS storage_connection_name
            FROM {_q(schema, "etl_tables")} t
            LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
            LEFT JOIN {_q(schema, "etl_storage_connections")} sc ON sc.storage_connection_id = t.storage_connection_id AND sc.is_active = TRUE
            ORDER BY t.created_at DESC
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
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
) -> int:
    """etl_tables 1건 등록. target_table 검증 후 INSERT. 반환: etl_table_id.
    - 동일 target_table은 다른 연결(DB)에서 같은 테이블로 추가 적재할 수 있으므로 중복 허용.
    - 메인 DB에 해당 테이블이 이미 있을 때: full 모드면 ValueError, incremental 모드면 허용(파일로 만든 테이블에 DB 증분 ETL 추가 가능).
    DB 소스이고 pk_columns가 비어 있으면 소스 DB에서 PK 자동 조회."""
    api_db = _get_db()
    target_table = _validate_identifier(target_table, "target_table")
    if (source_table or "").strip():
        source_table = _validate_source_table(source_table)
    schema = _schema()
    # 동일 타겟 테이블은 다른 DB(연결)에서 같은 테이블로 추가 적재할 수 있으므로 target_table 유일성 검사 제거.
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        pass  # target_table 중복 허용
    finally:
        cur.close()
        conn.close()
    sync_mode = (sync_mode or "incremental").strip().lower()
    if sync_mode not in ("full", "incremental"):
        sync_mode = "incremental"
    if sync_mode == "full" and api_db.table_exists_in_schema(target_table):
        raise ValueError(
            "메인 DB에 이미 존재하는 테이블명입니다. 전체(Full) 동기화는 기존 테이블을 삭제한 뒤 재생성하므로, "
            "다른 이름을 사용하거나 증분(Incremental) 모드로 등록하세요."
        )
    pk_columns_val = (pk_columns or "").strip() or None
    if not pk_columns_val and connection_id and source_table:
        c = get_connection_for_etl(connection_id)
        stype = (c.get("source_type") or "").strip().lower() if c else ""
        src_conn = None
        try:
            if stype == "postgresql":
                from Backend.etl_server2 import db_load_service
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
        cur.execute(
            f"""
            INSERT INTO {_q(schema, "etl_tables")}
            (connection_id, source_table, target_table, description, file_type, file_path, pk_columns, incremental_column, sync_mode, batch_size, batch_interval_seconds, storage_connection_id, column_mapping, on_row_error, index_definitions, status, created_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, 'draft', %s, NOW())
            RETURNING etl_table_id
            """,
            (
                connection_id,
                source_table or None,
                target_table,
                (description or "").strip() or None,
                file_type,
                file_path,
                pk_columns_val,
                (incremental_column or "").strip() or None,
                sync_mode,
                batch_val,
                interval_val,
                storage_connection_id,
                column_mapping_json,
                on_row_error_val,
                index_definitions_json,
                created_by,
            ),
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
        cur.execute(
            f"""
            SELECT t.etl_table_id, t.connection_id, t.source_table, t.target_table, t.description,
                   t.file_type, t.file_path, t.status, t.created_at,
                   t.pk_columns, t.incremental_column, t.last_synced_at, t.sync_mode,
                   t.batch_size, t.batch_interval_seconds, t.storage_connection_id, t.column_mapping,
                   t.on_row_error, t.index_definitions,
                   c.connection_name, c.source_type
            FROM {_q(schema, "etl_tables")} t
            LEFT JOIN {_q(schema, "etl_connections")} c ON c.connection_id = t.connection_id
            WHERE t.etl_table_id = %s
            """,
            (etl_table_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def get_sync_mode_for_load(etl_table_id: int) -> str:
    """etl_tables.sync_mode를 조회해 'full' | 'incremental' 반환. 명시적 'full'만 full, 그 외는 모두 incremental."""
    row = get_etl_table(etl_table_id)
    if not row:
        return "incremental"
    raw = row.get("sync_mode")
    normalized = (str(raw).strip().lower() if raw is not None else "") or ""
    return "full" if normalized == "full" else "incremental"


def delete_etl_table(etl_table_id: int) -> dict:
    """
    ETL 테이블 1건 삭제. 메인 DB에서 타겟 테이블 DROP,
    해당 행의 file_path 및 해당 etl_table_id의 모든 job의 add_file_path 파일 삭제(경로 해석 후),
    etl_transform_rules·etl_jobs·etl_tables 행 삭제. 반환: {"file_path": None}(호환용).
    """
    row = get_etl_table(etl_table_id)
    if not row:
        raise ValueError(f"ETL 테이블을 찾을 수 없습니다: etl_table_id={etl_table_id}")
    file_path = row.get("file_path")
    target_table = (row.get("target_table") or "").strip()
    api_db = _get_db()
    schema = _schema()

    add_file_paths: List[str] = []
    conn_sys = api_db.get_db_connection_system()
    cur_sys = conn_sys.cursor()
    try:
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
    except Exception as e:
        if psycopg2 and isinstance(e, psycopg2.ProgrammingError):
            conn_sys.rollback()
        else:
            cur_sys.close()
            conn_sys.close()
            raise
    try:
        # 동일 target_table을 쓰는 다른 ETL이 있으면 DROP 하지 않음(다른 연결에서 같은 테이블로 적재 중일 수 있음).
        if target_table and re.match(r"^[a-zA-Z0-9_]+$", target_table):
            cur_sys.execute(
                f"SELECT COUNT(*) FROM {_q(schema, 'etl_tables')} WHERE target_table = %s AND etl_table_id != %s",
                (target_table, etl_table_id),
            )
            other_count = cur_sys.fetchone()
            cnt = next(iter(other_count.values()), 0) if isinstance(other_count, dict) else (other_count[0] if other_count else 0)
            other_using = int(cnt) > 0
            if not other_using:
                conn_main, main_schema = get_target_db_connection(row.get("storage_connection_id"))
                cur_main = conn_main.cursor()
                try:
                    full_name = f'"{main_schema}"."{target_table}"'
                    cur_main.execute(f"DROP TABLE IF EXISTS {full_name}")
                    conn_main.commit()
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

    return {"file_path": None}


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
        try:
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
        except Exception as e:
            if psycopg2 and isinstance(e, psycopg2.ProgrammingError):
                conn_sys.rollback()
                add_file_paths = []
            else:
                raise
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
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_tables")} SET last_synced_at = %s, updated_at = NOW() WHERE etl_table_id = %s
            """,
            (synced_at, etl_table_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def insert_job(etl_table_id: Optional[int], status: str = "running", add_file_path: Optional[str] = None, add_file_type: Optional[str] = None) -> int:
    """etl_jobs에 1건 삽입. 반환: job_id. status='pending'이면 started_at NULL. add_file_path/add_file_type 있으면 추가 적재(업서트) Job."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        started = "NULL" if (status or "").strip().lower() == "pending" else "NOW()"
        if add_file_path is not None and add_file_type is not None:
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "etl_jobs")} (etl_table_id, status, started_at, add_file_path, add_file_type, created_at)
                VALUES (%s, %s, {started}, %s, %s, NOW())
                RETURNING job_id
                """,
                (etl_table_id, status, add_file_path, add_file_type),
            )
        else:
            cur.execute(
                f"""
                INSERT INTO {_q(schema, "etl_jobs")} (etl_table_id, status, started_at, created_at)
                VALUES (%s, %s, {started}, NOW())
                RETURNING job_id
                """,
                (etl_table_id, status),
            )
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
    """Phase 6: Job 목록. etl_table_id 지정 시 해당 ETL만. statuses 있으면 해당 상태만. target_table 포함. 최신순."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    where_parts = []
    params = []
    if etl_table_id is not None:
        where_parts.append("j.etl_table_id = %s")
        params.append(etl_table_id)
    if statuses:
        placeholders = ", ".join(["%s"] * len(statuses))
        where_parts.append(f"j.status IN ({placeholders})")
        params.extend(s.strip().lower() for s in statuses if s)
    where_sql = " AND ".join(where_parts) if where_parts else "1=1"
    params.append(limit)
    select_full = (
        f"SELECT j.job_id, j.etl_table_id, j.status, j.started_at, j.finished_at, j.rows_processed, j.total_rows, j.error_message, j.notice, j.add_file_path, j.add_file_type, j.created_at, "
        f"t.target_table, t.description "
        f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id "
        f"WHERE {where_sql} ORDER BY j.created_at DESC LIMIT %s"
    )
    select_minimal = (
        f"SELECT j.job_id, j.etl_table_id, j.status, j.started_at, j.finished_at, j.rows_processed, j.error_message, j.created_at, "
        f"t.target_table, t.description "
        f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id "
        f"WHERE {where_sql} ORDER BY j.created_at DESC LIMIT %s"
    )
    try:
        try:
            cur.execute(select_full, tuple(params))
            return [dict(r) for r in cur.fetchall()]
        except Exception:
            conn.rollback()
            cur.execute(select_minimal, tuple(params))
            rows = cur.fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d.setdefault("total_rows", None)
                d.setdefault("notice", None)
                d.setdefault("add_file_path", None)
                d.setdefault("add_file_type", None)
                out.append(d)
            return out
    finally:
        cur.close()
        conn.close()


def delete_job(job_id: int) -> bool:
    """Job 1건 삭제(etl_jobs에서 DELETE). add_file_path가 있으면 해당 업로드 파일도 삭제. 성공 시 True."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    add_file_path = None
    try:
        cur.execute(
            f"SELECT add_file_path FROM {_q(schema, 'etl_jobs')} WHERE job_id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        if row and row.get("add_file_path"):
            add_file_path = (row["add_file_path"] or "").strip() or None
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
        cur.execute(
            f"UPDATE {_q(schema, 'etl_jobs')} SET total_rows = %s WHERE job_id = %s",
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
        cur.execute(
            f"UPDATE {_q(schema, 'etl_jobs')} SET rows_processed = %s WHERE job_id = %s AND status = %s",
            (rows_processed, job_id, "running"),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_job(job_id: int) -> Optional[dict]:
    """Phase 6: job_id로 Job 1건 조회. target_table, total_rows 포함."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    select_full = (
        f"SELECT j.job_id, j.etl_table_id, j.status, j.started_at, j.finished_at, j.rows_processed, j.total_rows, j.error_message, j.notice, j.add_file_path, j.add_file_type, j.created_at, "
        f"t.target_table, t.description "
        f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id WHERE j.job_id = %s"
    )
    select_minimal = (
        f"SELECT j.job_id, j.etl_table_id, j.status, j.started_at, j.finished_at, j.rows_processed, j.error_message, j.created_at, "
        f"t.target_table, t.description "
        f"FROM {_q(schema, 'etl_jobs')} j LEFT JOIN {_q(schema, 'etl_tables')} t ON t.etl_table_id = j.etl_table_id WHERE j.job_id = %s"
    )
    try:
        try:
            cur.execute(select_full, (job_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        except Exception:
            conn.rollback()
            cur.execute(select_minimal, (job_id,))
            row = cur.fetchone()
            if not row:
                return None
            d = dict(row)
            d.setdefault("total_rows", None)
            d.setdefault("notice", None)
            d.setdefault("add_file_path", None)
            d.setdefault("add_file_type", None)
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
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_jobs")}
            SET status = %s, finished_at = NOW(), rows_processed = COALESCE(%s, rows_processed), error_message = %s, notice = %s
            WHERE job_id = %s
            """,
            (status, rows_processed, error_message, notice, job_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_etl_table_status(etl_table_id: int, status: str):
    """etl_tables.status 갱신."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            UPDATE {_q(schema, "etl_tables")} SET status = %s, updated_at = NOW() WHERE etl_table_id = %s
            """,
            (status, etl_table_id),
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
) -> None:
    """etl_tables의 pk_columns, sync_mode, incremental_column, storage_connection_id, column_mapping, on_row_error, batch_size, batch_interval_seconds, index_definitions 등 지정 필드만 갱신. None인 인자는 변경하지 않음."""
    api_db = _get_db()
    schema = _schema()
    conn = api_db.get_db_connection_system()
    cur = conn.cursor()
    try:
        if on_row_error is not None:
            val = (on_row_error or "fail").strip().lower()
            val = "fail" if val not in ("fail", "skip") else val
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET on_row_error = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if pk_columns is not None:
            val = (pk_columns or "").strip() or None
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET pk_columns = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if sync_mode is not None:
            raw = (sync_mode or "").strip().lower()
            val = "full" if raw == "full" else "incremental"
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET sync_mode = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if incremental_column is not None:
            val = (incremental_column or "").strip() or None
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET incremental_column = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if storage_connection_id is not None:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET storage_connection_id = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (storage_connection_id, etl_table_id),
            )
        if column_mapping is not None:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET column_mapping = %s::jsonb, updated_at = NOW() WHERE etl_table_id = %s",
                (json.dumps(column_mapping), etl_table_id),
            )
        if batch_size is not None:
            val = batch_size if batch_size > 0 else None
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET batch_size = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if batch_interval_seconds is not None:
            val = max(0, batch_interval_seconds)
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET batch_interval_seconds = %s, updated_at = NOW() WHERE etl_table_id = %s",
                (val, etl_table_id),
            )
        if index_definitions is not None:
            cur.execute(
                f"UPDATE {_q(schema, 'etl_tables')} SET index_definitions = %s::jsonb, updated_at = NOW() WHERE etl_table_id = %s",
                (json.dumps(index_definitions), etl_table_id),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()
