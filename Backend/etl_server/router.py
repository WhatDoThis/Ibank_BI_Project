"""
Backend.etl_server.router (ETL API 라우터)
==========================================
FastAPI APIRouter. prefix /api/etl. Phase 1~5: 메타·업로드·연결·변환 룰·실행.

[Main Functions]
===========
- GET /api/etl: 서비스 안내 (upload_retention_days 포함)
- GET/POST /api/etl/connections, POST /api/etl/connections/test, GET /api/etl/connections/{id}/tables
- GET/POST /api/etl/tables, DELETE /api/etl/tables/{id}, GET /api/etl/tables/{id}/transform-rules, POST/PUT/DELETE /api/etl/transform-rules
- POST /api/etl/upload: 파일 업로드·스키마 추론·선택 시 메타 등록. 3일 초과 파일 자동 삭제
- POST /api/etl/tables/{etl_table_id}/run: 파일 적재(run_file_load) 또는 DB 적재(run_db_load) 분기
- POST /api/etl/cleanup-expired-uploads: 만료 업로드 파일 삭제 (cron용)

[Dependencies]
=========
- fastapi, Backend.etl_server.service, load_service, db_load_service, schema_infer, transform_rules_service
"""

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from Backend.etl_server import db_load_service
from Backend.etl_server import load_service
from Backend.etl_server import schema_infer
from Backend.etl_server import service as etl_service
from Backend.etl_server import transform_rules_service as transform_rules_svc

router = APIRouter(prefix="/api/etl", tags=["etl"])


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
    """POST /api/etl/connections/test 요청 body. connection_id 또는 연결 인자."""
    connection_id: Optional[int] = None
    host: Optional[str] = None
    port: Optional[int] = 5432
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


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
    파일의 수정 시각(mtime) 기준. 반환: { deleted_count, deleted_paths }.
    """
    import os
    import time
    if not UPLOAD_DIR.is_dir():
        return {"deleted_count": 0, "deleted_paths": []}
    cutoff = time.time() - (max_age_days * 86400)
    deleted = []
    for f in UPLOAD_DIR.iterdir():
        if not f.is_file():
            continue
        try:
            if os.path.getmtime(str(f)) < cutoff:
                f.unlink()
                deleted.append(str(f))
        except (OSError, PermissionError):
            continue
    return {"deleted_count": len(deleted), "deleted_paths": deleted}


def _save_upload(file: UploadFile) -> tuple[str, str]:
    """파일 저장. 반환: (절대 경로, 파일 유형 csv|excel|parquet)."""
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
            "POST /api/etl/upload",
            "POST /api/etl/tables/{etl_table_id}/run",
            "POST /api/etl/cleanup-expired-uploads",
        ],
        "upload_retention_days": UPLOAD_FILE_RETENTION_DAYS,
    }


@router.get("/tables")
def list_tables():
    """ETL 테이블 목록. connection_name, source_type 포함."""
    try:
        rows = etl_service.list_etl_tables()
        for r in rows:
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
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
    sync_mode: Optional[str] = Field("full", description="full | incremental")
    batch_size: Optional[int] = Field(None, description="DB 적재 배치 크기(행 수). NULL/0이면 전체 fetch. 고객 DB 여건에 따라 설정.")
    batch_interval_seconds: Optional[int] = Field(None, description="배치 간 대기 시간(초). 0이면 대기 없음.")


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
        )
        return {"etl_table_id": etl_table_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
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
):
    """
    파일 업로드 → 저장 후 스키마 추론.
    target_table, description 이 있으면 파일용 connection + etl_tables 1건 생성 후 etl_table_id 반환.
    label_name은 추후 테이블 마스터에서 관리 예정, 당장은 수신만.
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
            conn_id = etl_service.get_or_create_file_connection(created_by)
            etl_table_id = etl_service.create_etl_table(
                connection_id=conn_id,
                target_table=target_table.strip(),
                description=(description or "").strip() or None,
                created_by=created_by,
                source_table=file.filename,
                file_type=file_type,
                file_path=file_path,
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
    """DB 연결 1건 등록. source_type=postgresql."""
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
    try:
        result = etl_service.test_connection(
            connection_id=body.connection_id,
            host=body.host,
            port=body.port,
            database_name=body.database_name,
            username=body.username,
            password=body.password,
        )
        return result
    except Exception as e:
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
    """소스 DB의 테이블 목록 (information_schema)."""
    try:
        tables = etl_service.list_source_tables(connection_id)
        return {"tables": tables}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/connections/{connection_id}", status_code=204)
def delete_connection(connection_id: int):
    """연결 해제. 해당 연결로 등록된 ETL의 타겟 테이블을 메인 DB에서 DROP한 뒤 연결·ETL 메타 삭제."""
    try:
        etl_service.delete_connection(connection_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables/{etl_table_id}/run")
def run_table_load(etl_table_id: int):
    """
    Phase 6: ETL 테이블 1건을 대기열에 등록. 백그라운드 워커가 pending을 수거해 실행(동시 2건 제한).
    반환: { job_id, status: "pending", message } — 완료 여부는 GET /api/etl/jobs/{job_id} 로 폴링.
    """
    try:
        row = etl_service.get_etl_table(etl_table_id)
        if not row:
            raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")
        source_type = (row.get("source_type") or "").strip().lower()
        if source_type == "file" and not (row.get("file_path") and row.get("file_type")):
            raise ValueError("파일 기반 ETL은 file_path와 file_type이 필요합니다.")
        if source_type == "postgresql" and not (row.get("connection_id") and row.get("source_table")):
            raise ValueError("DB 연동 ETL은 connection_id와 source_table이 필요합니다.")
        if source_type not in ("file", "postgresql"):
            raise ValueError("실행할 수 있는 ETL 유형이 아닙니다.")

        job_id = etl_service.insert_job(etl_table_id, status="pending")
        from Backend.etl_server import queue_worker
        queue_worker.start_background_worker()
        target_table = row.get("target_table") or ""
        description = row.get("description")
        return {"job_id": job_id, "status": "pending", "message": "대기열에 등록되었습니다. 완료 여부는 Job 목록에서 확인하세요.", "etl_table_id": etl_table_id, "target_table": target_table, "description": description}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_jobs(etl_table_id: Optional[int] = None, limit: int = 50):
    """Phase 6: Job 목록. etl_table_id 쿼리 시 해당 ETL만. 최신순."""
    try:
        rows = etl_service.list_jobs(etl_table_id=etl_table_id, limit=min(limit, 100))
        for r in rows:
            if r.get("started_at") is not None:
                r["started_at"] = r["started_at"].isoformat()
            if r.get("finished_at") is not None:
                r["finished_at"] = r["finished_at"].isoformat()
            if r.get("created_at") is not None:
                r["created_at"] = r["created_at"].isoformat()
        return {"jobs": rows}
    except Exception as e:
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
