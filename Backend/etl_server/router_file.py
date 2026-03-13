"""
Backend.etl_server.router_file (배치·폴더 연결 API 라우터)
===========================================================
09_ETL_SFTP_Connection 설계서 기반. prefix /batch → /api/etl/batch.
폴더 연결(SFTP/S3)·배치 Job·실행 이력 API.

[Pydantic Models]
===========
1. CreateFolderConnectionBody, UpdateFolderConnectionBody, TestFolderConnectionBody
2. CreateBatchJobBody, CreateBatchJobFromEtlTableBody, UpdateBatchJobBody
3. ValidateTargetBody, DeleteRemoteFilesBody, ResetTsBody, RollbackFileBody

[Endpoints]
===========
4. GET / — 배치 서비스 안내
5. GET/POST/PATCH/DELETE /folder-connections, POST /folder-connections/test
6. GET /folder-connections/{id}/files, patterns, columns
7. GET /target-tables, GET /target-registry, DELETE /target-registry/{id}
8. GET/POST /jobs, PATCH/DELETE /jobs/{id}, POST /jobs/{id}/run-now, toggle
9. GET /jobs/{id}/history, history/{run_id}, skipped-files, POST skipped-files/delete, reset-ts, rollback-file, clone
10. POST /jobs/validate-target, POST /jobs/{id}/history/{run_id}/cancel

[Dependencies]
=========
- fastapi, Backend.etl_server.service_file, parser_file, scheduler_file, folder_adapter_file, Backend.etl_server.service (get_etl_table)
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from Backend.etl_server import parser_file as batch_parser
from Backend.etl_server import scheduler_file as sched
from Backend.etl_server import service_file as batch_service
from Backend.etl_server import service as etl_service
from Backend.etl_server.load_service_file import _normalize_column_name as normalize_col

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batch", tags=["batch"])


# 1.
class CreateFolderConnectionBody(BaseModel):
    """POST /folder-connections. protocol이 sftp면 sftp_*, s3면 s3_* 사용."""
    connection_name: str = Field(..., description="연결 표시명")
    protocol: str = Field(..., description="sftp | s3")
    # SFTP
    host: Optional[str] = Field(None, description="SFTP 호스트")
    port: Optional[int] = Field(22, description="SFTP 포트")
    username: Optional[str] = Field(None, description="SFTP 사용자")
    password: Optional[str] = Field(None, description="SFTP 비밀번호")
    private_key: Optional[str] = Field(None, description="SFTP PEM private key")
    remote_path: Optional[str] = Field("/", description="원격 경로")
    # S3
    bucket: Optional[str] = Field(None, description="S3 버킷")
    prefix: Optional[str] = Field("", description="S3 prefix")
    region: Optional[str] = Field(None, description="AWS 리전")
    access_key_id: Optional[str] = Field(None, description="S3 Access Key")
    secret_access_key: Optional[str] = Field(None, description="S3 Secret Key")
    endpoint_url: Optional[str] = Field(None, description="MinIO 등 엔드포인트")


class UpdateFolderConnectionBody(BaseModel):
    """PATCH /folder-connections/{id}."""
    connection_name: Optional[str] = Field(None, description="연결 표시명")
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    remote_path: Optional[str] = None
    bucket: Optional[str] = None
    prefix: Optional[str] = None
    region: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    endpoint_url: Optional[str] = None


class CreateBatchJobBody(BaseModel):
    """POST /jobs. 배치 Job 등록. job_type=file이면 folder_connection_id·file_pattern 필수, job_type=db이면 connection_id·source_table 필수."""
    job_type: str = Field("file", description="file | db")
    folder_connection_id: Optional[int] = Field(None, description="폴더 연결 ID (file 배치 시 필수)")
    storage_connection_id: Optional[int] = Field(None, description="저장 DB 연결 ID. None=기본 DB(ibank_db)")
    job_name: str = Field(..., description="배치명")
    file_pattern: Optional[str] = Field("", description="파일 접두사(예: sales_data). file 배치 시 필수.")
    file_extensions: Optional[str] = Field("csv,xlsx,xls,parquet", description="허용 확장자")
    target_table: str = Field("", description="적재 테이블명")
    pk_columns: Optional[str] = Field(None, description="쉼표 구분 PK")
    interval_minutes: int = Field(10, ge=10, le=1440, description="실행 주기(분)")
    is_active: bool = Field(True, description="스케줄러 활성 여부")
    column_mapping: Optional[List[dict]] = Field(None, description="[{source, target, type}]")
    index_definitions: Optional[List[dict]] = Field(None, description="타겟 테이블 인덱스 [{index_name, columns, is_unique}]")
    on_file_error: Optional[str] = Field("stop", description="파일 1건 실패 시: stop | continue")
    connection_id: Optional[int] = Field(None, description="DB 배치: 소스 DB 연결 ID")
    source_table: Optional[str] = Field(None, description="DB 배치: 소스 테이블 (schema.table)")
    incremental_column: Optional[str] = Field(None, description="DB 배치: 증분 기준 컬럼")
    sync_mode: Optional[str] = Field("incremental", description="DB 배치: full | incremental")
    batch_size: Optional[int] = Field(None, description="DB 배치: fetch 배치 크기")
    batch_interval_seconds: Optional[int] = Field(None, description="DB 배치: 배치 간 대기 초")
    on_row_error: Optional[str] = Field("fail", description="DB 배치: fail | skip")


class CreateBatchJobFromEtlTableBody(BaseModel):
    """POST /jobs/from-etl-table. ETL 테이블 기반 DB 배치 등록. 소스/타겟/매핑은 etl_tables에서 참조."""
    etl_table_id: int = Field(..., description="연결할 ETL 테이블 ID")
    job_name: str = Field(..., description="배치 표시명")
    interval_minutes: int = Field(60, ge=10, le=1440, description="실행 주기(분)")
    batch_size: Optional[int] = Field(None)
    batch_interval_seconds: Optional[int] = Field(None)
    on_row_error: Optional[str] = Field("fail", description="fail | skip")
    is_active: bool = Field(True, description="등록 후 즉시 활성화")


class UpdateBatchJobBody(BaseModel):
    """PATCH /jobs/{id}. 전달된 필드만 갱신."""
    job_name: Optional[str] = None
    file_pattern: Optional[str] = None
    file_extensions: Optional[str] = None
    target_table: Optional[str] = None
    pk_columns: Optional[str] = None
    interval_minutes: Optional[int] = Field(None, ge=10, le=1440)
    is_active: Optional[bool] = None
    storage_connection_id: Optional[int] = None
    column_mapping: Optional[List[dict]] = None
    index_definitions: Optional[List[dict]] = None
    on_file_error: Optional[str] = None
    connection_id: Optional[int] = None
    source_table: Optional[str] = None
    incremental_column: Optional[str] = None
    sync_mode: Optional[str] = None
    batch_size: Optional[int] = None
    batch_interval_seconds: Optional[int] = None
    on_row_error: Optional[str] = None


class ValidateTargetBody(BaseModel):
    """POST /jobs/validate-target. 기존 테이블 적재 가능 여부 검증(컬럼 호환만)."""
    folder_connection_id: int = Field(..., description="폴더 연결 ID")
    storage_connection_id: Optional[int] = Field(None, description="저장 DB 연결 ID. None=기본 DB")
    file_pattern: str = Field(..., description="파일 접두사 패턴")
    target_table: str = Field(..., description="타겟 테이블명")


class DeleteRemoteFilesBody(BaseModel):
    """POST /jobs/{id}/skipped-files/delete. 원격 문제 파일 삭제."""
    filenames: List[str] = Field(..., description="삭제할 파일명 목록")


class ResetTsBody(BaseModel):
    """POST /jobs/{id}/reset-ts. last_processed_ts 수동 리셋."""
    timestamp: Optional[str] = Field(None, description="리셋할 타임스탬프(14자리). None이면 처음부터 재시작.")


class RollbackFileBody(BaseModel):
    """POST /jobs/{id}/rollback-file. 해당 파일로 적재된 행만 타겟 테이블에서 DELETE."""
    filename: str = Field(..., description="롤백할 파일명")
    run_id: int = Field(..., description="실행 이력 run_id")


class TestFolderConnectionBody(BaseModel):
    """POST /folder-connections/test. connection_id 있으면 해당 연결로 테스트, 없으면 인라인 파라미터."""
    folder_connection_id: Optional[int] = Field(None, description="등록된 연결 ID")
    connection_name: Optional[str] = None
    protocol: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = 22
    username: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    remote_path: Optional[str] = "/"
    bucket: Optional[str] = None
    prefix: Optional[str] = ""
    region: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    endpoint_url: Optional[str] = None


@router.get("/")
def batch_index():
    """배치 서비스 안내. 설계서 09_ETL_SFTP_Connection."""
    return {
        "service": "batch",
        "description": "원격 폴더(SFTP/S3) 기반 자동 증분 적재",
        "endpoints": {
            "folder-connections": "GET/POST /folder-connections",
            "jobs": "GET/POST /jobs",
            "patterns": "GET /folder-connections/{id}/patterns",
        },
    }


def _batch_table_error_detail(e: Exception) -> str:
    """배치 테이블 미존재 등 DB 오류 시 클라이언트용 안내 메시지."""
    msg = str(e).strip()
    if "does not exist" in msg or "relation" in msg.lower():
        return (
            "배치용 테이블이 시스템 DB에 없습니다. "
            "설계서 09_ETL_SFTP_Connection의 batch_folder_connections, batch_folder_sftp, "
            "batch_folder_s3, batch_jobs, batch_run_history 테이블을 생성해 주세요. 원본 오류: " + msg
        )
    return msg


@router.get("/folder-connections")
def list_folder_connections():
    """폴더 연결 목록. 마스터 + 프로토콜 상세 JOIN."""
    try:
        return batch_service.list_folder_connections()
    except Exception as e:
        logger.exception("폴더 연결 목록 조회 실패")
        raise HTTPException(status_code=500, detail=_batch_table_error_detail(e))


@router.post("/folder-connections")
def create_folder_connection(body: CreateFolderConnectionBody):
    """폴더 연결 등록."""
    protocol = (body.protocol or "").strip().lower()
    if protocol not in ("sftp", "s3"):
        raise HTTPException(status_code=400, detail="protocol은 sftp 또는 s3여야 합니다.")
    try:
        fid = batch_service.create_folder_connection(
            connection_name=body.connection_name,
            protocol=protocol,
            sftp_host=body.host or "",
            sftp_port=body.port or 22,
            sftp_username=body.username or "",
            sftp_password=body.password or "",
            sftp_private_key=body.private_key or "",
            sftp_remote_path=body.remote_path or "/",
            s3_bucket=body.bucket or "",
            s3_prefix=body.prefix or "",
            s3_region=body.region or "",
            s3_access_key_id=body.access_key_id or "",
            s3_secret_access_key=body.secret_access_key or "",
            s3_endpoint_url=body.endpoint_url or "",
        )
        return {"folder_connection_id": fid, "message": "등록되었습니다."}
    except Exception as e:
        logger.exception("폴더 연결 등록 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/folder-connections/{folder_connection_id}")
def update_folder_connection(folder_connection_id: int, body: UpdateFolderConnectionBody):
    """폴더 연결 수정. 전송된 필드만 반영, 미전송 필드는 기존 값 유지."""
    try:
        existing = batch_service.get_folder_connection(folder_connection_id)
        if not existing:
            raise HTTPException(status_code=404, detail="폴더 연결을 찾을 수 없습니다.")
        batch_service.update_folder_connection(
            folder_connection_id,
            connection_name=body.connection_name if body.connection_name is not None else existing.get("connection_name"),
            sftp_host=body.host if body.host is not None else (existing.get("sftp_host") or ""),
            sftp_port=body.port if body.port is not None else (existing.get("sftp_port") or 22),
            sftp_username=body.username if body.username is not None else (existing.get("sftp_username") or ""),
            sftp_password=body.password if body.password is not None else "",
            sftp_private_key=body.private_key if body.private_key is not None else "",
            sftp_remote_path=body.remote_path if body.remote_path is not None else (existing.get("sftp_remote_path") or "/"),
            s3_bucket=body.bucket if body.bucket is not None else (existing.get("s3_bucket") or ""),
            s3_prefix=body.prefix if body.prefix is not None else (existing.get("s3_prefix") or ""),
            s3_region=body.region if body.region is not None else (existing.get("s3_region") or ""),
            s3_access_key_id=body.access_key_id if body.access_key_id is not None else (existing.get("s3_access_key_id") or ""),
            s3_secret_access_key=body.secret_access_key if body.secret_access_key is not None else "",
            s3_endpoint_url=body.endpoint_url if body.endpoint_url is not None else (existing.get("s3_endpoint_url") or ""),
        )
        return {"message": "수정되었습니다."}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("폴더 연결 수정 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folder-connections/{folder_connection_id}")
def delete_folder_connection(folder_connection_id: int):
    """폴더 연결 삭제. CASCADE로 상세 삭제."""
    try:
        batch_service.delete_folder_connection(folder_connection_id)
        return {"message": "삭제되었습니다."}
    except Exception as e:
        logger.exception("폴더 연결 삭제 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/folder-connections/test")
def test_folder_connection(body: TestFolderConnectionBody):
    """연결 테스트. folder_connection_id 있으면 해당 연결, 없으면 인라인 파라미터로 테스트."""
    adapter = None
    try:
        if body.folder_connection_id is not None:
            adapter = batch_service.get_folder_adapter(body.folder_connection_id)
        else:
            # 인라인 테스트: 임시로 DB에 넣지 않고 어댑터만 생성해 테스트
            from Backend.etl_server.folder_adapter_file import SFTPAdapter, S3Adapter
            protocol = (body.protocol or "").strip().lower()
            if protocol == "sftp":
                adapter = SFTPAdapter(
                    host=body.host or "",
                    port=body.port or 22,
                    username=body.username or "",
                    password=body.password,
                    private_key=body.private_key,
                    remote_path=body.remote_path or "/",
                )
            elif protocol == "s3":
                adapter = S3Adapter(
                    bucket=body.bucket or "",
                    prefix=body.prefix or "",
                    region=body.region,
                    access_key_id=body.access_key_id,
                    secret_access_key=body.secret_access_key,
                    endpoint_url=body.endpoint_url,
                )
            else:
                raise HTTPException(status_code=400, detail="protocol은 sftp 또는 s3여야 합니다.")
        adapter.test_connection()
        if body.folder_connection_id is not None:
            batch_service.set_folder_connection_verified(body.folder_connection_id, True)
        return {"ok": True, "message": "연결에 성공했습니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("폴더 연결 테스트 실패")
        if body.folder_connection_id is not None:
            try:
                batch_service.set_folder_connection_verified(body.folder_connection_id, False)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if adapter:
            adapter.close()


@router.get("/folder-connections/{folder_connection_id}/files")
def list_folder_files(folder_connection_id: int) -> List[str]:
    """폴더 내 파일명 목록."""
    adapter = None
    try:
        adapter = batch_service.get_folder_adapter(folder_connection_id)
        return adapter.list_files()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("폴더 파일 목록 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if adapter:
            adapter.close()


@router.get("/folder-connections/{folder_connection_id}/patterns")
def list_folder_patterns(folder_connection_id: int):
    """폴더 내 _ib_14자리 형식 파일만 접두사별 그룹화해 패턴 목록 반환. §8.3."""
    adapter = None
    try:
        adapter = batch_service.get_folder_adapter(folder_connection_id)
        files = adapter.list_files()
        patterns = batch_parser.extract_patterns_from_files(files)
        return {"patterns": patterns}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("폴더 패턴 추출 실패")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if adapter:
            adapter.close()


@router.get("/folder-connections/{folder_connection_id}/columns")
def list_folder_columns(
    folder_connection_id: int,
    file_pattern: str = Query(..., description="파일 접두사 패턴. 해당 패턴 중 타임스탬프 가장 빠른 파일 1건의 컬럼명 반환."),
):
    """폴더 내 file_pattern_ib_14자리 형식 파일 중 가장 오래된 1건을 읽어 컬럼명 목록 반환. PK 선택 UI용."""
    import os
    import tempfile

    adapter = None
    local_path = None
    try:
        adapter = batch_service.get_folder_adapter(folder_connection_id)
        files = adapter.list_files()
        pending = batch_parser.get_pending_files(files, file_pattern.strip(), "csv,xlsx,xls,parquet", None)
        if not pending:
            return {"columns": []}
        filename, _ = pending[0]
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            local_path = tmp.name
        if ext == "csv":
            adapter.download_file_head(filename, local_path, max_bytes=65536)
        else:
            adapter.download_file(filename, local_path)
        df = batch_parser.read_file(local_path, ext, max_rows=1)
        return {"columns": df.columns.tolist()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("폴더 컬럼 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
            except OSError:
                pass
        if adapter:
            adapter.close()


# ---------- 배치 Job (§8.2) ----------


@router.get("/target-tables")
def list_target_tables(
    storage_connection_id: Optional[int] = Query(None, description="저장 DB 연결 ID. 없으면 기본 DB"),
):
    """저장 DB의 테이블 목록. 배치 폼 타겟 테이블 셀렉트용."""
    try:
        tables = etl_service.list_target_tables(storage_connection_id)
        return {"tables": tables}
    except Exception as e:
        logger.exception("저장 DB 테이블 목록 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/target-registry")
def list_batch_target_registry():
    """ETL 목록에 표시할 배치 타겟 등록 목록. batch_job_id가 NULL이어도 행 반환(테이블 관리용)."""
    try:
        rows = batch_service.list_batch_target_registry()
        for r in rows:
            for k in ("created_at", "updated_at", "last_run_at"):
                v = r.get(k)
                if v is not None and hasattr(v, "isoformat"):
                    r[k] = v.isoformat()
        return {"targets": rows}
    except Exception as e:
        logger.exception("배치 타겟 레지스트리 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/target-registry/{registry_id}")
def delete_batch_target_registry(registry_id: int):
    """ETL 목록에서 배치 유래 행 삭제. 타겟 테이블 DROP 후 레지스트리 행 삭제."""
    try:
        batch_service.delete_batch_target_registry_and_drop_table(registry_id)
        return {"message": "삭제되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("배치 타겟 레지스트리 삭제 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_batch_jobs(
    folder_connection_id: Optional[int] = Query(None, description="폴더 연결 ID 필터"),
    is_active: Optional[bool] = Query(None, description="활성 여부 필터"),
    job_type: Optional[str] = Query(None, description="file | db"),
):
    """배치 Job 목록. connection_name JOIN. §11.3 다음 실행 시각(next_run_time) 포함. job_type으로 file/db 필터."""
    try:
        jobs = batch_service.list_batch_jobs(
            folder_connection_id=folder_connection_id,
            is_active=is_active,
            job_type=job_type,
        )
        for j in jobs:
            _serialize_job(j)
            try:
                sched_job = sched.get_scheduler().get_job(f"batch_{j['batch_job_id']}")
                j["next_run_time"] = sched_job.next_run_time.isoformat() if sched_job and sched_job.next_run_time else None
            except Exception:
                j["next_run_time"] = None
        return {"jobs": jobs}
    except Exception as e:
        logger.exception("배치 Job 목록 조회 실패")
        raise HTTPException(status_code=500, detail=_batch_table_error_detail(e))


def _serialize_job(j: dict) -> None:
    """dict 내 datetime/date를 ISO 문자열로."""
    for k in ("created_at", "updated_at", "last_run_at"):
        v = j.get(k)
        if v is not None and hasattr(v, "isoformat"):
            j[k] = v.isoformat()


@router.post("/jobs")
def create_batch_job(body: CreateBatchJobBody):
    """배치 Job 등록. is_active=True면 스케줄러에 등록. job_type=db이면 connection_id·source_table 필수."""
    jtype = (body.job_type or "file").strip().lower()
    if jtype not in ("file", "db"):
        raise HTTPException(status_code=400, detail="job_type은 'file' 또는 'db'여야 합니다.")
    if jtype == "file" and body.folder_connection_id is None:
        raise HTTPException(status_code=400, detail="파일 배치에는 folder_connection_id가 필요합니다.")
    if jtype == "db":
        if body.connection_id is None:
            raise HTTPException(status_code=400, detail="DB 배치에는 connection_id가 필요합니다.")
        if not (body.source_table or "").strip():
            raise HTTPException(status_code=400, detail="DB 배치에는 source_table이 필요합니다.")

    try:
        batch_job_id = batch_service.create_batch_job(
            folder_connection_id=body.folder_connection_id,
            storage_connection_id=body.storage_connection_id,
            job_name=body.job_name,
            file_pattern=body.file_pattern or "",
            file_extensions=body.file_extensions or "csv,xlsx,xls,parquet",
            target_table=body.target_table or "",
            pk_columns=body.pk_columns,
            interval_minutes=body.interval_minutes,
            is_active=body.is_active,
            column_mapping=body.column_mapping,
            index_definitions=body.index_definitions,
            on_file_error=body.on_file_error or "stop",
            job_type=jtype,
            connection_id=body.connection_id,
            source_table=body.source_table,
            incremental_column=body.incremental_column,
            sync_mode=body.sync_mode or "incremental",
            batch_size=body.batch_size,
            batch_interval_seconds=body.batch_interval_seconds,
            on_row_error=body.on_row_error or "fail",
        )
        if body.is_active:
            job = batch_service.get_batch_job(batch_job_id)
            if job:
                sched.add_job(job)
        return {"batch_job_id": batch_job_id, "message": "등록되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("배치 Job 등록 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/from-etl-table")
def create_batch_job_from_etl_table(body: CreateBatchJobFromEtlTableBody):
    """ETL 테이블 기반 DB 배치 등록. 소스/타겟/매핑은 etl_tables에서 참조. 실행 시 실시간 조회. status=done일 때만 허용."""
    etl_table = etl_service.get_etl_table(body.etl_table_id)
    if not etl_table:
        raise HTTPException(status_code=404, detail="ETL 테이블을 찾을 수 없습니다.")

    status = (etl_table.get("status") or "").strip().lower()
    if status != "done":
        raise HTTPException(
            status_code=400,
            detail="ETL 테이블이 아직 실행되지 않았습니다. 먼저 실행하여 적재를 확인한 뒤 배치를 설정해 주세요.",
        )

    source_type = (etl_table.get("source_type") or "").strip().lower()
    if source_type not in ("postgresql", "mysql", "oracle"):
        raise HTTPException(
            status_code=400,
            detail="DB 소스 ETL 테이블만 배치 등록할 수 있습니다.",
        )

    try:
        batch_job_id = batch_service.create_batch_job(
            folder_connection_id=None,
            storage_connection_id=etl_table.get("storage_connection_id"),
            job_name=body.job_name,
            file_pattern="",
            target_table=(etl_table.get("target_table") or "").strip(),
            job_type="db",
            etl_table_id=body.etl_table_id,
            connection_id=etl_table.get("connection_id"),
            source_table=etl_table.get("source_table"),
            column_mapping=None,
            incremental_column=None,
            sync_mode="incremental",
            pk_columns=None,
            index_definitions=None,
            interval_minutes=body.interval_minutes,
            batch_size=body.batch_size,
            batch_interval_seconds=body.batch_interval_seconds,
            on_row_error=body.on_row_error or "fail",
            is_active=body.is_active,
        )
        # ETL 테이블의 마지막 적재 완료 시점(last_synced_at)을 배치 초기값으로 세팅 → 증분 배치는 이후 데이터만 처리
        initial_synced_at = etl_table.get("last_synced_at")
        if initial_synced_at is not None:
            try:
                batch_service.update_last_synced_at_db_batch(batch_job_id, initial_synced_at)
            except Exception as e:
                logger.warning("배치 등록 후 last_synced_at 초기 세팅 실패 batch_job_id=%s: %s", batch_job_id, e)
        if body.is_active:
            job = batch_service.get_batch_job(batch_job_id)
            if job:
                sched.add_job(job)
        return {"batch_job_id": batch_job_id, "message": "배치 등록되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("ETL 기반 배치 등록 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/validate-target")
def validate_target_for_batch(body: ValidateTargetBody):
    """기존 테이블 적재 가능 여부 검증. 파일 패턴 1건 컬럼 vs 타겟 테이블 컬럼. 컬럼 매핑은 검증하지 않음."""
    import os
    import tempfile

    adapter = None
    local_path = None
    try:
        adapter = batch_service.get_folder_adapter(body.folder_connection_id)
        files = adapter.list_files()
        pending = batch_parser.get_pending_files(
            files, (body.file_pattern or "").strip(), "csv,xlsx,xls,parquet", None
        )
        if not pending:
            return {"valid": False, "message": "해당 패턴에 맞는 파일이 없습니다. 폴더에 파일을 올린 뒤 다시 시도하세요."}
        filename, _ = pending[0]
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}" if ext else "") as tmp:
            local_path = tmp.name
        adapter.download_file(filename, local_path)
        df = batch_parser.read_file(local_path, ext, max_rows=1)
        file_cols_norm = [normalize_col(str(c)) for c in df.columns.tolist()]
    except Exception as e:
        logger.exception("validate-target 파일 컬럼 조회 실패")
        return {"valid": False, "message": f"파일 컬럼 조회 실패: {e}"}
    finally:
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
            except OSError:
                pass
        if adapter:
            try:
                adapter.close()
            except Exception:
                pass

    target_table = (body.target_table or "").strip()
    if not target_table:
        return {"valid": False, "message": "타겟 테이블명이 비어 있습니다."}

    try:
        exists = etl_service.target_table_exists(body.storage_connection_id, target_table)
        if not exists:
            return {"valid": True, "message": "테이블이 없습니다. 실행 시 새로 생성됩니다."}
        target_cols_raw = etl_service.list_target_columns(body.storage_connection_id, target_table)
        target_cols = [c["column_name"] for c in target_cols_raw if c.get("column_name")]
        missing = [c for c in file_cols_norm if c not in target_cols]
        if missing:
            return {
                "valid": False,
                "message": f"파일 컬럼 중 테이블에 없는 컬럼이 있습니다: {', '.join(missing[:10])}{' …' if len(missing) > 10 else ''}. 컬럼 매핑 없이는 적재할 수 없습니다.",
            }
        return {"valid": True, "message": "기존 테이블에 적재 가능합니다."}
    except Exception as e:
        logger.exception("validate-target 타겟 조회 실패")
        return {"valid": False, "message": f"타겟 테이블 조회 실패: {e}"}


@router.patch("/jobs/{batch_job_id}")
def update_batch_job(batch_job_id: int, body: UpdateBatchJobBody):
    """배치 Job 수정. interval_minutes 변경 시 reschedule, is_active 변경 시 add/remove job."""
    try:
        existing = batch_service.get_batch_job(batch_job_id)
        if not existing:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        kwargs = body.model_dump(exclude_none=True)
        if not kwargs:
            return {"message": "변경 사항 없음."}
        batch_service.update_batch_job(batch_job_id, **kwargs)
        # 스케줄러 동기화
        if body.interval_minutes is not None and existing.get("is_active"):
            sched.reschedule_job(batch_job_id, body.interval_minutes)
        if body.is_active is not None:
            if body.is_active:
                job = batch_service.get_batch_job(batch_job_id)
                if job:
                    sched.add_job(job)
            else:
                sched.remove_job(batch_job_id)
        return {"message": "수정되었습니다."}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("배치 Job 수정 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{batch_job_id}")
def delete_batch_job(batch_job_id: int):
    """스케줄러에서 제거 후 배치 Job 삭제."""
    try:
        existing = batch_service.get_batch_job(batch_job_id)
        if not existing:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        sched.remove_job(batch_job_id)
        batch_service.delete_batch_job(batch_job_id)
        return {"message": "삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("배치 Job 삭제 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{batch_job_id}/db-preview")
def get_batch_job_db_preview(batch_job_id: int):
    """DB 배치 Job의 소스 테이블 10행 미리보기. job_type이 db가 아니면 400."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        if (job.get("job_type") or "file").strip().lower() != "db":
            raise HTTPException(status_code=400, detail="DB 배치가 아닙니다.")
        from Backend.etl_server.preview_service import _preview_db
        preview = _preview_db({
            "connection_id": job.get("connection_id"),
            "source_table": job.get("source_table"),
            "column_mapping": job.get("column_mapping"),
        })
        return preview
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("DB 배치 미리보기 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/run-now")
def run_batch_job_now(batch_job_id: int):
    """즉시 1회 실행. 이미 실행 중이면 스케줄하지 않고 메시지 반환."""
    try:
        if not batch_service.get_batch_job(batch_job_id):
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        result = sched.run_now(batch_job_id)
        if result.get("already_running"):
            return {"message": "해당 배치가 이미 실행 중입니다. 완료 후 다시 시도하세요.", "already_running": True}
        return {"message": "즉시 실행이 스케줄되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("배치 즉시 실행 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/toggle")
def toggle_batch_job(batch_job_id: int):
    """활성/비활성 토글 후 스케줄러 add/remove."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        new_active = not job.get("is_active", False)
        update_kwargs = {"is_active": new_active}
        if not new_active and (job.get("last_run_status") or "").strip().lower() == "running":
            update_kwargs["last_run_status"] = None
        batch_service.update_batch_job(batch_job_id, **update_kwargs)
        if not new_active:
            n = batch_service.mark_stuck_runs_finished(batch_job_id)
            if n:
                logger.info("toggle batch_%s: %s stuck run(s) marked error", batch_job_id, n)
        if new_active:
            job = batch_service.get_batch_job(batch_job_id)
            if job:
                sched.add_job(job, force_now=True)
        else:
            sched.remove_job(batch_job_id)
        return {"is_active": new_active, "message": "활성화되었습니다." if new_active else "비활성화되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("배치 토글 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{batch_job_id}/history")
def list_batch_run_history(
    batch_job_id: int,
    limit: int = Query(50, ge=1, le=200, description="최대 건수"),
):
    """실행 이력 목록."""
    try:
        if not batch_service.get_batch_job(batch_job_id):
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        runs = batch_service.list_run_history(batch_job_id, limit=limit)
        return {"runs": runs}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("실행 이력 목록 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{batch_job_id}/history/{run_id}")
def get_batch_run_detail(batch_job_id: int, run_id: int):
    """실행 이력 1건 상세. pk_columns는 파일 단위 롤백 버튼 활성화용으로 함께 반환."""
    try:
        run = batch_service.get_run_detail(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="실행 이력을 찾을 수 없습니다.")
        if run.get("batch_job_id") != batch_job_id:
            raise HTTPException(status_code=404, detail="해당 Job의 실행 이력이 아닙니다.")
        job = batch_service.get_batch_job(batch_job_id)
        if job:
            run["pk_columns"] = (job.get("pk_columns") or "").strip() or ""
        return run
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("실행 이력 상세 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/history/{run_id}/cancel")
def cancel_batch_run(batch_job_id: int, run_id: int):
    """실행 취소 요청. 진행 중인 run에 대해 취소 플래그 설정. (batch_run_history.cancel_requested_at 컬럼 필요)"""
    try:
        run = batch_service.get_run_detail(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="실행 이력을 찾을 수 없습니다.")
        if run.get("batch_job_id") != batch_job_id:
            raise HTTPException(status_code=404, detail="해당 Job의 실행 이력이 아닙니다.")
        st = (run.get("status") or "").strip().lower()
        if st != "running":
            return {"message": "이미 완료된 실행입니다." if st else "실행을 찾을 수 없습니다."}
        batch_service.set_run_cancel_requested(run_id)
        cleared = batch_service.force_finish_run_as_cancelled(run_id)
        if cleared is not None:
            return {"message": "취소되었습니다. 즉시 실행을 다시 누르면 새로 실행됩니다.", "run_finished": True}
        return {"message": "취소 요청되었습니다. 진행 중이던 적재는 롤백됩니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("실행 취소 요청 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{batch_job_id}/skipped-files")
def list_skipped_files(batch_job_id: int):
    """배치 Job의 스킵/에러 파일 목록. 동일 파일명은 가장 최근 이력 기준."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        files = batch_service.list_skipped_files(batch_job_id)
        return {
            "batch_job_id": batch_job_id,
            "job_name": job.get("job_name"),
            "folder_connection_id": job.get("folder_connection_id"),
            "skipped_files": files,
            "total": len(files),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("스킵 파일 목록 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/skipped-files/delete")
def delete_skipped_files(batch_job_id: int, body: DeleteRemoteFilesBody):
    """원격 폴더에서 문제 파일 삭제. 삭제 후 다음 주기에 해당 파일은 목록에서 사라짐."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        if not body.filenames:
            raise HTTPException(status_code=400, detail="삭제할 파일명이 없습니다.")
        result = batch_service.delete_remote_files(
            job["folder_connection_id"], body.filenames
        )
        return {
            "message": f"{len(result['deleted'])}건 삭제, {len(result['failed'])}건 실패",
            **result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("원격 파일 삭제 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/reset-ts")
def reset_last_processed_ts(batch_job_id: int, body: ResetTsBody):
    """last_processed_ts를 지정값으로 리셋. None이면 NULL(처음부터 재시작). §3-1."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        ts = (body.timestamp or "").strip() or None
        batch_service.update_last_processed_ts(batch_job_id, ts)
        label = ts or "NULL(처음부터)"
        return {"message": f"last_processed_ts를 {label}로 리셋했습니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("last_processed_ts 리셋 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/rollback-file")
def rollback_file(batch_job_id: int, body: RollbackFileBody):
    """특정 파일의 적재 데이터만 타겟 테이블에서 DELETE (batch_loaded_keys PK 기반)."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        deleted = batch_service.rollback_file_from_target(
            batch_job_id=batch_job_id,
            run_id=body.run_id,
            filename=body.filename,
            storage_connection_id=job["storage_connection_id"],
            target_table=job["target_table"],
            pk_columns_str=job.get("pk_columns") or "",
        )
        return {
            "message": f'"{body.filename}" 적재 데이터 {deleted}행 롤백 완료',
            "deleted_rows": deleted,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("파일 롤백 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{batch_job_id}/clone")
def clone_batch_job(batch_job_id: int):
    """배치 Job 복제. 동일 설정으로 새 Job 생성, 비활성 상태. DB 배치 시 job_type·connection_id·source_table 등 전부 복사. §3-2."""
    try:
        job = batch_service.get_batch_job(batch_job_id)
        if not job:
            raise HTTPException(status_code=404, detail="배치 Job을 찾을 수 없습니다.")
        jtype = (job.get("job_type") or "file").strip().lower()
        new_id = batch_service.create_batch_job(
            folder_connection_id=job.get("folder_connection_id") if jtype == "file" else None,
            storage_connection_id=job.get("storage_connection_id"),
            job_name=f"{job.get('job_name') or 'Job'} (복제)",
            file_pattern=job.get("file_pattern") or "",
            file_extensions=job.get("file_extensions") or "csv,xlsx,xls,parquet",
            target_table=f"{job.get('target_table') or 'table'}_copy",
            pk_columns=job.get("pk_columns"),
            interval_minutes=job.get("interval_minutes") or 10,
            is_active=False,
            column_mapping=job.get("column_mapping"),
            index_definitions=job.get("index_definitions"),
            on_file_error=(job.get("on_file_error") or "stop").strip().lower(),
            job_type=jtype,
            connection_id=job.get("connection_id") if jtype == "db" else None,
            source_table=job.get("source_table") if jtype == "db" else None,
            incremental_column=job.get("incremental_column") if jtype == "db" else None,
            sync_mode=(job.get("sync_mode") or "incremental").strip().lower() if jtype == "db" else "incremental",
            batch_size=job.get("batch_size") if jtype == "db" else None,
            batch_interval_seconds=job.get("batch_interval_seconds") if jtype == "db" else None,
            on_row_error=(job.get("on_row_error") or "fail").strip().lower() if jtype == "db" else "fail",
        )
        return {"batch_job_id": new_id, "message": "복제되었습니다. 비활성 상태입니다."}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("배치 Job 복제 실패")
        raise HTTPException(status_code=500, detail=str(e))
