"""
Backend.etl_server2.router (ETL2 API 라우터)
============================================
FastAPI APIRouter. prefix /api/etl2. ETL2 페이지용 메타·업로드·연결·실행·Job API. 09_ETL_Upgrade_Plan 확장 예정.

[Pydantic Models]
===========
75 - CreateConnectionBody: POST /connections 요청
88 - TestConnectionBody: POST /connections/test 요청
98 - CreateTransformRuleBody: POST /transform-rules 요청
109 - UpdateTransformRuleBody: PUT /transform-rules/{id} 요청
212 - CreateTableBody: POST /tables 요청
229 - UpdateTableBody: PATCH /tables/{id} 요청 (pk_columns 등)

[Helpers]
===========
124 - _ensure_upload_dir: 업로드 디렉터리 생성
128 - _cleanup_expired_uploads: 보관 기간 초과 업로드·zip_* 디렉터리 삭제
151 - _save_upload: 업로드 파일 저장 후 flush·fsync하여 워커가 즉시 읽을 수 있게 함, (절대경로, 파일유형) 반환
356 - _natural_sort_key: 파일명 자연 정렬용 키(숫자 구간 인식)
359 - _file_type_from_ext: 확장자 → csv|excel|parquet
362 - _normalize_column_name_for_check: 컬럼명 정규화(중복 시 접미사)

[Endpoints]
===========
172 - etl_index: GET / — 서비스 안내, upload_retention_days
200 - list_tables: GET /tables — ETL 테이블 목록
235 - update_table: PATCH /tables/{id} — pk_columns 등 설정 갱신
246 - create_table: POST /tables — ETL 테이블 메타 등록
271 - delete_table_row_only: DELETE /tables/{id}/row — 행·업로드 파일만 삭제(테이블 유지)
283 - delete_table: DELETE /tables/{id} — ETL 테이블·타겟 DROP·파일 삭제
303 - upload_file: POST /upload — 파일 업로드·스키마 추론·선택 시 메타 등록
369 - add_file_to_table: POST /tables/{id}/add-file — 동일 테이블 추가 적재(업서트), PK 검증 후 Job 등록
480 - add_files_zip_to_table: POST /tables/{id}/add-files-zip — ZIP 압축 해제 후 파일명 순 Job 등록, skipped_files 반환
626 - cleanup_expired_uploads: POST /cleanup-expired-uploads — 만료 업로드 삭제(cron용, zip_* 포함)
452 - create_connection: POST /connections — DB 연결 등록
474 - list_connections: GET /connections — 연결 목록
489 - test_connection: POST /connections/test — 연결 테스트
506 - list_transform_rules: GET /tables/{id}/transform-rules — 변환 룰 목록
521 - create_transform_rule: POST /transform-rules — 룰 등록
541 - update_transform_rule: PUT /transform-rules/{id} — 룰 수정
561 - delete_transform_rule: DELETE /transform-rules/{id} — 룰 삭제
570 - list_connection_tables: GET /connections/{id}/tables — 소스 DB 테이블 목록
582 - delete_connection: DELETE /connections/{id} — 연결 삭제
591 - check_target_table_exists: GET /tables/{id}/target-exists — 타겟 테이블 메인 DB 존재 여부
919 - list_target_tables: GET /target-tables — Phase 3 저장 DB 테이블 목록
928 - list_target_columns: GET /target-columns — Phase 3 저장 DB 컬럼 목록
610 - preview_table: GET /tables/{id}/preview — 미리보기(컬럼·10행)
624 - run_table_load: POST /tables/{id}/run — 파일 소스는 요청 프로세스에서 스레드로 즉시 실행, DB/추가적재는 대기열
656 - list_jobs: GET /jobs — Job 목록(etl_table_id, statuses, limit)
673 - get_job: GET /jobs/{id} — Job 1건(폴링용)
693 - delete_job: DELETE /jobs/{id} — Job 1건 삭제(add_file_path 파일 삭제)
707 - cancel_job: POST /jobs/{id}/cancel — 실행 중·대기 Job 취소

[Dependencies]
=========
- fastapi, Backend.etl_server2.service, load_service, db_load_service, preview_service, schema_infer, transform_rules_service
"""

import logging
import os
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from Backend.etl_server2 import db_load_service
from Backend.etl_server2 import load_service
from Backend.etl_server2 import preview_service
from Backend.etl_server2 import schema_infer
from Backend.etl_server2 import service as etl_service
from Backend.etl_server2 import transform_rules_service as transform_rules_svc

router = APIRouter(prefix="/api/etl2", tags=["etl2"])


class CreateConnectionBody(BaseModel):
    """POST /api/etl/connections 요청 body."""
    connection_name: str = Field(..., description="연결 이름")
    source_type: str = Field("postgresql", description="소스 타입")
    host: str = Field(..., description="호스트")
    port: int = Field(5432, description="포트")
    database_name: str = Field(..., description="DB명")
    schema_name: Optional[str] = Field("public", description="스키마명")
    username: str = Field(..., description="사용자명")
    password: str = Field("", description="비밀번호")
    created_by: str = Field("user", description="등록자")


class TestConnectionBody(BaseModel):
    """POST /api/etl/connections/test 요청 body. connection_id 또는 연결 인자 + source_type."""
    connection_id: Optional[int] = None
    source_type: Optional[str] = Field("postgresql", description="postgresql | mysql | oracle. connection_id 없을 때 필수.")
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class CreateStorageConnectionBody(BaseModel):
    """POST /api/etl2/storage-connections 요청 body. 저장 DB(적재 대상) 등록. PostgreSQL 전용."""
    connection_name: str = Field(..., description="연결 이름")
    host: str = Field(..., description="호스트")
    port: int = Field(5432, description="포트")
    database_name: str = Field(..., description="DB명")
    schema_name: Optional[str] = Field("public", description="스키마명")
    username: str = Field(..., description="사용자명")
    password: str = Field("", description="비밀번호")


class UpdateStorageConnectionBody(BaseModel):
    """PATCH /api/etl2/storage-connections/{id} 요청 body. 전달된 필드만 갱신."""
    connection_name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    schema_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class TestStorageConnectionBody(BaseModel):
    """POST /api/etl2/storage-connections/test 요청 body. 접속+권한(CREATE/INSERT/DROP) 검증."""
    host: str = Field(..., description="호스트")
    port: int = Field(5432, description="포트")
    database_name: str = Field(..., description="DB명")
    schema_name: Optional[str] = Field("public", description="스키마명")
    username: str = Field(..., description="사용자명")
    password: str = Field("", description="비밀번호")


class CreateTransformRuleBody(BaseModel):
    """POST /api/etl/transform-rules 요청 body."""
    etl_table_id: int = Field(..., description="ETL 테이블 ID")
    source_column: str = Field(..., description="소스 컬럼명")
    rule_type: str = Field(..., description="cleansing | type_cast | code_map | derived | masking")
    rule_config: Optional[dict] = Field(default_factory=dict, description="룰별 설정(JSON)")
    target_column: Optional[str] = Field(None, description="타겟 컬럼명. 없으면 source_column과 동일")
    apply_order: int = Field(1, description="적용 순서")
    is_active: bool = Field(True, description="활성 여부")


class UpdateTransformRuleBody(BaseModel):
    """PUT /api/etl/transform-rules/{rule_id} 요청 body. 전달된 필드만 갱신."""
    source_column: Optional[str] = None
    target_column: Optional[str] = None
    rule_type: Optional[str] = None
    rule_config: Optional[dict] = None
    apply_order: Optional[int] = None
    is_active: Optional[bool] = None

# 업로드 파일 저장 디렉터리 (etl_server 기준 상대)
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
# 업로드 파일 보관 기간(일). 기간 도래 시 자동 삭제. 업로드 후 바로 적재한다고 가정.
UPLOAD_FILE_RETENTION_DAYS = 3


def _ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _cleanup_expired_uploads(max_age_days: int = UPLOAD_FILE_RETENTION_DAYS) -> dict:
    """
    uploads 디렉터리에서 보관 기간(일)을 초과한 파일 삭제.
    파일의 수정 시각(mtime) 기준. zip_* 하위 디렉터리도 동일 기준으로 정리. 반환: { deleted_count, deleted_paths }.
    """
    import time
    if not UPLOAD_DIR.is_dir():
        return {"deleted_count": 0, "deleted_paths": []}
    cutoff = time.time() - (max_age_days * 86400)
    deleted = []
    for f in UPLOAD_DIR.iterdir():
        if f.is_file():
            try:
                if os.path.getmtime(str(f)) < cutoff:
                    f.unlink()
                    deleted.append(str(f))
            except (OSError, PermissionError):
                continue
        elif f.is_dir() and f.name.startswith("zip_"):
            try:
                max_mtime = 0
                for p in f.rglob("*"):
                    if p.is_file():
                        max_mtime = max(max_mtime, os.path.getmtime(str(p)))
                if max_mtime > 0 and max_mtime < cutoff:
                    shutil.rmtree(f)
                    deleted.append(str(f))
            except (OSError, PermissionError):
                continue
    return {"deleted_count": len(deleted), "deleted_paths": deleted}


def _save_upload(file: UploadFile) -> tuple[str, str]:
    """파일 저장. flush·fsync 후 반환하여 업로드 직후 실행 시 워커가 파일을 찾을 수 있게 함. 반환: (절대 경로, 파일 유형 csv|excel|parquet)."""
    _ensure_upload_dir()
    ext = (Path(file.filename or "").suffix or "").lower()
    if ext == ".csv":
        ft = "csv"
    elif ext in (".xlsx", ".xls"):
        ft = "excel"
    elif ext == ".parquet":
        ft = "parquet"
    else:
        raise ValueError("지원 형식: .csv, .xlsx, .xls, .parquet")
    name = f"{uuid.uuid4().hex}_{file.filename or 'file'}"
    path = UPLOAD_DIR / name
    with open(path, "wb") as f:
        content = file.file.read()
        f.write(content)
        f.flush()
        try:
            os.fsync(f.fileno())
        except (OSError, AttributeError):
            pass
    return str(path.resolve()), ft


@router.get("")
def etl_index():
    """ETL API 안내."""
    return {
        "service": "etl",
        "status": "ok",
        "endpoints": [
            "GET /api/etl/connections",
            "POST /api/etl/connections",
            "POST /api/etl/connections/test",
            "GET /api/etl/connections/{connection_id}/tables",
            "GET /api/etl/tables",
            "GET /api/etl/jobs",
            "GET /api/etl/jobs/{job_id}",
            "GET /api/etl/tables/{etl_table_id}/transform-rules",
            "POST /api/etl/transform-rules",
            "PUT /api/etl/transform-rules/{rule_id}",
            "DELETE /api/etl/transform-rules/{rule_id}",
            "POST /api/etl/tables",
            "POST /api/etl2/upload",
            "POST /api/etl/tables/{etl_table_id}/run",
            "POST /api/etl/tables/{etl_table_id}/add-file",
            "POST /api/etl/tables/{etl_table_id}/add-files-zip",
            "POST /api/etl2/cleanup-expired-uploads",
        ],
        "upload_retention_days": UPLOAD_FILE_RETENTION_DAYS,
    }


@router.get("/tables")
def list_tables():
    """ETL 테이블 목록. connection_name, source_type 포함. 파일 소스는 preview_available(원본 파일 존재 여부) 포함."""
    try:
        rows = etl_service.list_etl_tables()
        for r in rows:
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
            fp = r.get("file_path")
            if (r.get("source_type") or "").strip().lower() == "file" and fp:
                r["preview_available"] = os.path.isfile(fp)
            else:
                r["preview_available"] = True
        return {"tables": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateTableBody(BaseModel):
    """POST /api/etl/tables 요청 body."""
    connection_id: int = Field(..., description="연결 ID")
    target_table: str = Field(..., description="타겟 테이블명")
    label_name: Optional[str] = Field(None, description="라벨명. 추후 테이블 마스터에서 관리, 당장은 수신만")
    description: Optional[str] = None
    created_by: str = Field("user", description="등록자")
    source_table: Optional[str] = None
    file_type: Optional[str] = None
    file_path: Optional[str] = None
    pk_columns: Optional[str] = Field(None, description="PK 컬럼(쉼표 구분, incremental 시 필수)")
    incremental_column: Optional[str] = Field(None, description="증분 컬럼명")
    sync_mode: Optional[str] = Field("incremental", description="full | incremental")
    batch_size: Optional[int] = Field(None, description="DB 적재 배치 크기(행 수). NULL/0이면 전체 fetch. 고객 DB 여건에 따라 설정.")
    batch_interval_seconds: Optional[int] = Field(None, description="배치 간 대기 시간(초). 0이면 대기 없음.")
    storage_connection_id: Optional[int] = Field(None, description="저장 DB(적재 대상). null=기본 DB(ibank_db). Phase 2b에서 실제 적재 분기.")
    column_mapping: Optional[list] = Field(None, description="Phase 4: [{source, target, type}, ...]. 적재 시 컬럼 매핑 반영.")


class UpdateTableBody(BaseModel):
    """PATCH /api/etl/tables/{id} 요청 body. 전달된 필드만 갱신."""
    pk_columns: Optional[str] = Field(None, description="PK 컬럼(쉼표 구분). 비우면 PK 미설정. 파일 적재 시 CREATE TABLE에 반영.")
    sync_mode: Optional[str] = Field(None, description="full | incremental. DB 연동 ETL만 적용.")
    incremental_column: Optional[str] = Field(None, description="증분 컬럼명(소스 테이블). 증분 모드에서 이 컬럼 > last_synced_at 조건으로 조회.")
    storage_connection_id: Optional[int] = Field(None, description="저장 DB(적재 대상). null=기본 DB.")
    column_mapping: Optional[list] = Field(None, description="Phase 4: [{source, target, type}, ...].")


@router.patch("/tables/{etl_table_id}", status_code=204)
def update_table(etl_table_id: int, body: UpdateTableBody):
    """ETL 테이블 설정 일부 갱신. pk_columns, sync_mode, storage_connection_id 등."""
    try:
        etl_service.update_etl_table(
            etl_table_id,
            pk_columns=body.pk_columns,
            sync_mode=body.sync_mode,
            incremental_column=body.incremental_column,
            storage_connection_id=body.storage_connection_id,
            column_mapping=body.column_mapping,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables")
def create_table(body: CreateTableBody):
    """ETL 테이블 1건 등록. 파일 업로드 후 메타만 따로 등록할 때 사용."""
    try:
        etl_table_id = etl_service.create_etl_table(
            connection_id=body.connection_id,
            target_table=body.target_table,
            description=body.description,
            created_by=body.created_by,
            source_table=body.source_table,
            file_type=body.file_type,
            file_path=body.file_path,
            pk_columns=body.pk_columns,
            incremental_column=body.incremental_column,
            sync_mode=body.sync_mode,
            batch_size=body.batch_size,
            batch_interval_seconds=body.batch_interval_seconds,
            storage_connection_id=body.storage_connection_id,
            column_mapping=body.column_mapping,
        )
        return {"etl_table_id": etl_table_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tables/{etl_table_id}/row", status_code=204)
def delete_table_row_only(etl_table_id: int):
    """ETL 등록 행만 삭제. 메인 DB 타겟 테이블은 유지, 업로드 파일 및 해당 행·관련 job만 삭제."""
    try:
        etl_service.delete_etl_table_row_only(etl_table_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("DELETE /tables/%s/row failed: %s", etl_table_id, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tables/{etl_table_id}", status_code=204)
def delete_table(etl_table_id: int):
    """ETL 테이블 1건 삭제. 메인 DB 타겟 테이블 DROP, 업로드 파일 삭제, 메타 삭제."""
    try:
        result = etl_service.delete_etl_table(etl_table_id)
        fp = result.get("file_path")
        if fp:
            try:
                p = Path(fp).resolve()
                upload_abs = UPLOAD_DIR.resolve()
                if p.is_file() and str(p).startswith(str(upload_abs)):
                    p.unlink(missing_ok=True)
            except (OSError, PermissionError):
                pass
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    target_table: Optional[str] = Form(None),
    label_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    created_by: str = Form("user"),
    storage_connection_id: Optional[int] = Form(None),
    column_mapping: Optional[str] = Form(None),
):
    """
    파일 업로드 → 저장 후 스키마 추론.
    target_table, description 이 있으면 파일용 connection + etl_tables 1건 생성 후 etl_table_id 반환.
    label_name은 추후 테이블 마스터에서 관리 예정, 당장은 수신만.
    storage_connection_id: null=기본 DB. Phase 2b에서 적재 분기.
    column_mapping: Phase 4. JSON 문자열 [{source, target, type}, ...].
    """
    try:
        file_path, file_type = _save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        columns = schema_infer.infer_schema(file_path, file_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"스키마 추론 실패: {e}")

    result = {"columns": columns, "file_path": file_path, "file_type": file_type}

    if target_table and str(target_table).strip():
        try:
            import json as _json
            cm = None
            if column_mapping and str(column_mapping).strip():
                try:
                    cm = _json.loads(column_mapping)
                    if not isinstance(cm, list):
                        cm = None
                except (ValueError, TypeError):
                    cm = None
            conn_id = etl_service.get_or_create_file_connection(created_by)
            etl_table_id = etl_service.create_etl_table(
                connection_id=conn_id,
                target_table=target_table.strip(),
                description=(description or "").strip() or None,
                created_by=created_by,
                source_table=file.filename,
                file_type=file_type,
                file_path=file_path,
                storage_connection_id=storage_connection_id,
                column_mapping=cm,
            )
            result["etl_table_id"] = etl_table_id
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # 업로드 파일 보관 정책: 3일 초과 파일 자동 삭제 (업로드 시점에 정리 실행)
    try:
        _cleanup_expired_uploads()
    except Exception:
        pass

    return result


def _natural_sort_key(name: str):
    """파일명 자연 정렬용 키(숫자 구간 인식). part_001, part_002, part_010 순."""
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", str(name))]


def _file_type_from_ext(ext: str) -> Optional[str]:
    """확장자 → csv|excel|parquet. 미지원이면 None."""
    ext = (ext or "").lower()
    if ext == ".csv":
        return "csv"
    if ext in (".xlsx", ".xls"):
        return "excel"
    if ext == ".parquet":
        return "parquet"
    return None


def _normalize_column_name_for_check(name: str, used: set) -> str:
    """load_service과 동일한 컬럼명 정규화(검증용)."""
    base = (str(name).strip() or "unnamed").replace(" ", "_")
    base = re.sub(r"[^a-zA-Z0-9_]", "_", base) or "col"
    out = base
    idx = 0
    while out in used:
        idx += 1
        out = f"{base}_{idx}"
    used.add(out)
    return out


@router.post("/tables/{etl_table_id}/add-file")
async def add_file_to_table(
    etl_table_id: int,
    file: UploadFile = File(...),
):
    """
    등록된 ETL(파일 기반)의 타겟 테이블에 추가 적재. 파일 업로드 후 PK 검증 → 대기열 등록 → 업서트 실행.
    타겟 테이블에 PK가 있거나 ETL에 pk_columns가 설정되어 있어야 함.
    """
    from Backend.api_server import db as api_db
    from Backend.etl_server2 import queue_worker

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")
    target_table = (row.get("target_table") or "").strip()
    if not target_table:
        raise HTTPException(status_code=400, detail="해당 ETL에 target_table이 없습니다.")
    source_type = (row.get("source_type") or "").strip().lower()
    if source_type != "file":
        raise HTTPException(status_code=400, detail="파일 기반 ETL에만 추가 적재할 수 있습니다.")

    pk_columns_raw = (row.get("pk_columns") or "").strip()
    if pk_columns_raw:
        pk_list = [x.strip() for x in pk_columns_raw.split(",") if x.strip()]
    else:
        try:
            pk_list = api_db.get_primary_key_columns_for_etl_target(target_table)
        except Exception:
            pk_list = []
    if not pk_list:
        raise HTTPException(
            status_code=400,
            detail="타겟 테이블에 PK가 없습니다. 메인 DB에서 해당 테이블에 PRIMARY KEY를 설정하거나, ETL 설정에서 pk_columns를 입력하세요.",
        )

    try:
        file_path, file_type = _save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        table_columns = api_db.get_table_columns_for_etl_target(target_table)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"타겟 테이블 컬럼 조회 실패: {e}")

    inferred = schema_infer.infer_schema(file_path, file_type)
    used = set()
    file_cols = [_normalize_column_name_for_check(c.get("name") or "col", used) for c in inferred]
    file_col_set = set(file_cols)
    missing_pk = [p for p in pk_list if p not in file_col_set]
    if missing_pk:
        raise HTTPException(
            status_code=400,
            detail=f"업서트를 위해 파일에 PK 컬럼이 필요합니다. 누락: {', '.join(missing_pk)}",
        )
    common = [c for c in table_columns if c in file_col_set]
    if not common:
        raise HTTPException(status_code=400, detail="파일과 타겟 테이블에 공통 컬럼이 없습니다.")

    job_id = etl_service.insert_job(etl_table_id, status="pending", add_file_path=file_path, add_file_type=file_type)
    queue_worker.start_background_worker()
    description = row.get("description")
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "추가 적재가 대기열에 등록되었습니다. 완료 여부는 Job 목록에서 확인하세요.",
        "etl_table_id": etl_table_id,
        "target_table": target_table,
        "description": description,
    }


@router.post("/tables/{etl_table_id}/add-files-zip")
async def add_files_zip_to_table(
    etl_table_id: int,
    file: UploadFile = File(...),
):
    """
    ZIP으로 여러 파일 추가 적재. 압축 해제 후 파일명 자연 정렬 순으로 Job 등록.
    각 파일이 max_file_size_mb 이하이고 지원 형식이어야 함. 건너뛴 파일은 skipped_files로 반환.
    """
    from Backend.api_server import db as api_db
    from Backend.etl_server2 import queue_worker
    from Backend.etl_server2.etl_limits import get_etl_limits

    row = etl_service.get_etl_table(etl_table_id)
    if not row:
        raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")
    target_table = (row.get("target_table") or "").strip()
    if not target_table:
        raise HTTPException(status_code=400, detail="해당 ETL에 target_table이 없습니다.")
    source_type = (row.get("source_type") or "").strip().lower()
    if source_type != "file":
        raise HTTPException(status_code=400, detail="파일 기반 ETL에만 추가 적재할 수 있습니다.")

    pk_columns_raw = (row.get("pk_columns") or "").strip()
    if pk_columns_raw:
        pk_list = [x.strip() for x in pk_columns_raw.split(",") if x.strip()]
    else:
        try:
            pk_list = api_db.get_primary_key_columns_for_etl_target(target_table)
        except Exception:
            pk_list = []
    if not pk_list:
        raise HTTPException(
            status_code=400,
            detail="타겟 테이블에 PK가 없습니다. 메인 DB에서 해당 테이블에 PRIMARY KEY를 설정하거나, ETL 설정에서 pk_columns를 입력하세요.",
        )

    try:
        table_columns = api_db.get_table_columns_for_etl_target(target_table)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"타겟 테이블 컬럼 조회 실패: {e}")

    fn = (file.filename or "").strip().lower()
    if not fn.endswith(".zip"):
        raise HTTPException(status_code=400, detail="ZIP 파일만 업로드할 수 있습니다.")

    _ensure_upload_dir()
    zip_uid = uuid.uuid4().hex
    extract_dir = UPLOAD_DIR / f"zip_{zip_uid}"
    zip_path = UPLOAD_DIR / f"zip_{zip_uid}.zip"
    skipped_files: list = []
    job_ids: list = []

    try:
        content = await file.read()
        zip_path.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ZIP 읽기 실패: {e}")

    try:
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)
    except zipfile.BadZipFile as e:
        if zip_path.is_file():
            zip_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="ZIP 파일이 손상되었거나 형식이 올바르지 않습니다.")
    except Exception as e:
        if zip_path.is_file():
            zip_path.unlink(missing_ok=True)
        if extract_dir.is_dir():
            shutil.rmtree(extract_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"ZIP 압축 해제 실패: {e}")
    finally:
        zip_path.unlink(missing_ok=True)

    max_file_mb, _, _ = get_etl_limits()
    supported_exts = (".csv", ".xlsx", ".xls", ".parquet")
    all_files: list = []
    for p in extract_dir.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(extract_dir)
        name = p.name
        ext = p.suffix.lower()
        if ext not in supported_exts:
            skipped_files.append({"filename": str(rel), "reason": "unsupported_format"})
            continue
        try:
            size_mb = os.path.getsize(p) / (1024 * 1024)
        except OSError:
            skipped_files.append({"filename": str(rel), "reason": "file_too_large"})
            continue
        if max_file_mb > 0 and size_mb > max_file_mb:
            skipped_files.append({"filename": str(rel), "reason": "file_too_large"})
            continue
        all_files.append((str(p.resolve()), name, ext))

    all_files.sort(key=lambda x: _natural_sort_key(x[1]))

    for abs_path, name, ext in all_files:
        ft = _file_type_from_ext(ext)
        try:
            inferred = schema_infer.infer_schema(abs_path, ft)
        except Exception:
            skipped_files.append({"filename": name, "reason": "schema_or_pk_failed"})
            continue
        used = set()
        file_cols = [_normalize_column_name_for_check(c.get("name") or "col", used) for c in inferred]
        file_col_set = set(file_cols)
        missing_pk = [p for p in pk_list if p not in file_col_set]
        if missing_pk:
            skipped_files.append({"filename": name, "reason": "schema_or_pk_failed"})
            continue
        common = [c for c in table_columns if c in file_col_set]
        if not common:
            skipped_files.append({"filename": name, "reason": "schema_or_pk_failed"})
            continue
        try:
            job_id = etl_service.insert_job(
                etl_table_id, status="pending", add_file_path=abs_path, add_file_type=ft
            )
            job_ids.append(job_id)
        except Exception:
            skipped_files.append({"filename": name, "reason": "schema_or_pk_failed"})
            continue

    queue_worker.start_background_worker()
    description = row.get("description")
    enqueued_count = len(job_ids)
    message = f"{enqueued_count}개 파일이 대기열에 등록되었습니다. 완료 여부는 Job 목록에서 확인하세요."
    if skipped_files:
        message += " 건너뛴 파일은 아래 목록에서 확인하고, 정리 후 다시 업로드하세요."

    return {
        "job_ids": job_ids,
        "enqueued_count": enqueued_count,
        "skipped_files": skipped_files,
        "message": message,
        "etl_table_id": etl_table_id,
        "target_table": target_table,
        "description": description,
        "status": "pending",
    }


@router.post("/cleanup-expired-uploads")
def cleanup_expired_uploads():
    """
    보관 기간(3일)을 초과한 업로드 파일 삭제.
    cron/스케줄러에서 주기 호출하거나, 업로드 시 자동 실행됨.
    """
    result = _cleanup_expired_uploads()
    return {"message": "만료된 업로드 파일 정리 완료", **result}


@router.post("/connections", status_code=201)
def create_connection(body: CreateConnectionBody):
    """DB 연결 1건 등록. source_type=postgresql|mysql|oracle."""
    try:
        connection_id = etl_service.create_connection(
            connection_name=body.connection_name,
            source_type=body.source_type or "postgresql",
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            schema_name=body.schema_name or "public",
            username=body.username,
            password=body.password or "",
            created_by=body.created_by,
        )
        return {"connection_id": connection_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections")
def list_connections():
    """연결 목록. 비밀번호 제외."""
    try:
        rows = etl_service.list_connections()
        for r in rows:
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
            if r.get("updated_at"):
                r["updated_at"] = r["updated_at"].isoformat()
        return {"connections": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/connections/test")
def test_connection(body: TestConnectionBody):
    """연결 테스트. connection_id 또는 host/database_name/username/password."""
    logger.info(
        "[ETL 연결테스트] API 요청 수신: connection_id=%s source_type=%s host=%s port=%s database_name=%s username=%s",
        body.connection_id, body.source_type, body.host, body.port, body.database_name, body.username,
    )
    try:
        result = etl_service.test_connection(
            connection_id=body.connection_id,
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            username=body.username,
            password=body.password,
            source_type=body.source_type,
        )
        logger.info("[ETL 연결테스트] API 응답: ok=%s message=%s", result.get("ok"), result.get("message"))
        return result
    except Exception as e:
        logger.exception("[ETL 연결테스트] API 예외: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{etl_table_id}/transform-rules")
def list_transform_rules(etl_table_id: int):
    """ETL 테이블별 변환 룰 목록."""
    try:
        rows = transform_rules_svc.list_transform_rules(etl_table_id)
        for r in rows:
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
            if r.get("updated_at") is not None:
                r["updated_at"] = r["updated_at"].isoformat()
        return {"rules": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transform-rules", status_code=201)
def create_transform_rule(body: CreateTransformRuleBody):
    """변환 룰 1건 등록."""
    try:
        rule_id = transform_rules_svc.create_transform_rule(
            etl_table_id=body.etl_table_id,
            source_column=body.source_column,
            rule_type=body.rule_type,
            rule_config=body.rule_config,
            target_column=body.target_column,
            apply_order=body.apply_order,
            is_active=body.is_active,
        )
        return {"rule_id": rule_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/transform-rules/{rule_id}")
def update_transform_rule(rule_id: int, body: UpdateTransformRuleBody):
    """변환 룰 수정."""
    try:
        transform_rules_svc.update_transform_rule(
            rule_id,
            source_column=body.source_column,
            target_column=body.target_column,
            rule_type=body.rule_type,
            rule_config=body.rule_config,
            apply_order=body.apply_order,
            is_active=body.is_active,
        )
        return {"message": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/transform-rules/{rule_id}", status_code=204)
def delete_transform_rule(rule_id: int):
    """변환 룰 삭제."""
    try:
        transform_rules_svc.delete_transform_rule(rule_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections/{connection_id}/tables")
def list_connection_tables(connection_id: int):
    """소스 DB의 테이블 목록. PostgreSQL/MySQL: information_schema, Oracle: ALL_TABLES/USER_TABLES."""
    try:
        tables = etl_service.list_source_tables(connection_id)
        return {"tables": tables}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/connections/{connection_id}", status_code=204)
def delete_connection(connection_id: int):
    """연결 해제. 해당 연결로 등록된 ETL의 타겟 테이블을 메인 DB에서 DROP한 뒤 연결·ETL 메타 삭제. 파일 업로드용 연결은 삭제 불가."""
    try:
        etl_service.delete_connection(connection_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 저장 DB(적재 대상) Phase 1 ----------

@router.get("/storage-connections")
def list_storage_connections():
    """저장 DB(적재 대상) 연결 목록. 비밀번호 제외."""
    try:
        rows = etl_service.list_storage_connections()
        for r in rows:
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
            if r.get("updated_at") is not None:
                r["updated_at"] = r["updated_at"].isoformat()
        return {"storage_connections": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage-connections", status_code=201)
def create_storage_connection(body: CreateStorageConnectionBody):
    """저장 DB 연결 1건 등록. PostgreSQL 전용. 연결 테스트 통과 후 등록 권장."""
    try:
        storage_connection_id = etl_service.create_storage_connection(
            connection_name=body.connection_name,
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            schema_name=body.schema_name or "public",
            username=body.username,
            password=body.password or "",
        )
        return {"storage_connection_id": storage_connection_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/storage-connections/{storage_connection_id}")
def update_storage_connection(storage_connection_id: int, body: UpdateStorageConnectionBody):
    """저장 DB 연결 1건 수정. 전달된 필드만 갱신."""
    try:
        etl_service.update_storage_connection(
            storage_connection_id,
            connection_name=body.connection_name,
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            schema_name=body.schema_name,
            username=body.username,
            password=body.password,
            is_active=body.is_active,
        )
        return {"message": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/storage-connections/{storage_connection_id}", status_code=204)
def delete_storage_connection(storage_connection_id: int):
    """저장 DB 연결 1건 삭제."""
    try:
        etl_service.delete_storage_connection(storage_connection_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage-connections/test")
def test_storage_connection(body: TestStorageConnectionBody):
    """저장 DB 연결 테스트: 접속 + CREATE TABLE + INSERT + DROP TABLE 권한 검증."""
    try:
        result = etl_service.test_storage_connection(
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            schema_name=body.schema_name or "public",
            username=body.username,
            password=body.password or "",
        )
        return result
    except Exception as e:
        logger.exception("저장 DB 연결 테스트 예외: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/target-tables")
def list_target_tables(storage_connection_id: Optional[int] = None):
    """Phase 3: 저장 DB(적재 대상)의 테이블 목록. storage_connection_id 없으면 기본 DB(ibank_db)."""
    try:
        tables = etl_service.list_target_tables(storage_connection_id)
        return {"tables": tables}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("저장 DB 테이블 목록 조회 예외: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/target-columns")
def list_target_columns(storage_connection_id: Optional[int] = None, table_name: Optional[str] = None):
    """Phase 3: 저장 DB의 지정 테이블 컬럼 목록(컬럼명, 타입). table_name 필수."""
    if not (table_name or "").strip():
        raise HTTPException(status_code=400, detail="table_name이 필요합니다.")
    try:
        columns = etl_service.list_target_columns(storage_connection_id, table_name.strip())
        return {"columns": columns}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("저장 DB 컬럼 목록 조회 예외: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{etl_table_id}/target-exists")
def check_target_table_exists(etl_table_id: int):
    """실행 전 확인용: 타겟 테이블이 해당 저장 DB(기본 DB 또는 storage_connection_id)에 이미 존재하는지. sync_mode 반환."""
    try:
        row = etl_service.get_etl_table(etl_table_id)
        if not row:
            raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")
        target_table = (row.get("target_table") or "").strip()
        if not target_table:
            return {"target_table": None, "exists": False, "sync_mode": None, "storage_connection_id": row.get("storage_connection_id")}
        sync_mode = etl_service.get_sync_mode_for_load(etl_table_id)
        exists = etl_service.target_table_exists(row.get("storage_connection_id"), target_table)
        return {
            "target_table": target_table,
            "exists": exists,
            "sync_mode": sync_mode,
            "storage_connection_id": row.get("storage_connection_id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{etl_table_id}/preview")
def preview_table(etl_table_id: int):
    """미리보기: 컬럼별 저장 가능 여부 + 저장 후 테이블 모습 10행."""
    try:
        data = preview_service.get_preview(etl_table_id)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _run_file_load_in_process(etl_table_id: int, job_id: int) -> None:
    """파일 적재를 이 프로세스 내 스레드에서 실행(업로드와 동일 프로세스에서 파일 접근 보장)."""
    try:
        from Backend.etl_server2 import load_service
        load_service.run_file_load(etl_table_id, job_id=job_id)
    except Exception as e:
        etl_service.update_job(job_id, "failed", error_message=str(e))
        etl_service.update_etl_table_status(etl_table_id, "error")
        logger.exception("ETL file load (in-process) job_id=%s failed: %s", job_id, e)


@router.post("/tables/{etl_table_id}/run")
def run_table_load(etl_table_id: int):
    """
    Phase 6: ETL 테이블 1건 실행.
    - 파일 소스: 이 요청을 받은 프로세스에서 스레드로 즉시 실행(다중 워커 시 업로드 파일 경로 불일치 방지).
    - DB 소스·추가 적재: 대기열 등록 후 백그라운드 워커가 실행.
    반환: { job_id, status, message } — 완료 여부는 GET /api/etl/jobs/{job_id} 로 폴링.
    """
    import threading
    try:
        row = etl_service.get_etl_table(etl_table_id)
        if not row:
            raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")
        source_type = (row.get("source_type") or "").strip().lower()
        if source_type == "file" and not (row.get("file_path") and row.get("file_type")):
            raise ValueError("파일 기반 ETL은 file_path와 file_type이 필요합니다.")
        if source_type in ("postgresql", "mysql", "oracle") and not (row.get("connection_id") and row.get("source_table")):
            raise ValueError("DB 연동 ETL은 connection_id와 source_table이 필요합니다.")
        if source_type not in ("file", "postgresql", "mysql", "oracle"):
            raise ValueError("실행할 수 있는 ETL 유형이 아닙니다.")

        target_table = row.get("target_table") or ""
        description = row.get("description")

        if source_type == "file":
            job_id = etl_service.insert_job(etl_table_id, status="running")
            t = threading.Thread(target=_run_file_load_in_process, args=(etl_table_id, job_id), daemon=True)
            t.start()
            return {
                "job_id": job_id,
                "status": "running",
                "message": "실행을 시작했습니다. 완료 여부는 Job 목록에서 확인하세요.",
                "etl_table_id": etl_table_id,
                "target_table": target_table,
                "description": description,
            }

        job_id = etl_service.insert_job(etl_table_id, status="pending")
        from Backend.etl_server2 import queue_worker
        queue_worker.start_background_worker()
        return {
            "job_id": job_id,
            "status": "pending",
            "message": "대기열에 등록되었습니다. 완료 여부는 Job 목록에서 확인하세요.",
            "etl_table_id": etl_table_id,
            "target_table": target_table,
            "description": description,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_jobs(etl_table_id: Optional[int] = None, limit: int = 50, statuses: Optional[str] = None):
    """Phase 6: Job 목록. etl_table_id 쿼리 시 해당 ETL만. statuses=completed,failed 등 쉼표 구분 시 해당 상태만. 최신순."""
    try:
        status_list = [s.strip() for s in (statuses or "").split(",") if s.strip()] or None
        rows = etl_service.list_jobs(etl_table_id=etl_table_id, limit=min(limit, 500), statuses=status_list)
        for r in rows:
            for key in ("started_at", "finished_at", "created_at"):
                val = r.get(key)
                if val is not None and hasattr(val, "isoformat"):
                    r[key] = val.isoformat()
        return {"jobs": rows}
    except Exception as e:
        logger.exception("GET /api/etl/jobs failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}")
def get_job(job_id: int):
    """Phase 6: Job 1건 조회 (폴링용)."""
    try:
        row = etl_service.get_job(job_id)
        if not row:
            raise HTTPException(status_code=404, detail="Job을 찾을 수 없습니다.")
        if row.get("started_at") is not None:
            row["started_at"] = row["started_at"].isoformat()
        if row.get("finished_at") is not None:
            row["finished_at"] = row["finished_at"].isoformat()
        if row.get("created_at") is not None:
            row["created_at"] = row["created_at"].isoformat()
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int):
    """Job 1건 삭제. etl_jobs에서 DELETE."""
    try:
        ok = etl_service.delete_job(job_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Job을 찾을 수 없습니다.")
        return {"job_id": job_id, "message": "삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: int):
    """실행 중·대기 중인 Job 취소. status를 cancelled로 갱신. 워커가 주기적으로 확인해 중단."""
    try:
        row = etl_service.get_job(job_id)
        if not row:
            raise HTTPException(status_code=404, detail="Job을 찾을 수 없습니다.")
        status = (row.get("status") or "").strip().lower()
        if status not in ("pending", "running"):
            raise HTTPException(status_code=400, detail=f"취소할 수 없는 상태입니다: {status}")
        etl_service.update_job(job_id, "cancelled", error_message="사용자 취소")
        return {"job_id": job_id, "status": "cancelled", "message": "취소 요청되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
