"""
Backend.etl_server2.folder_adapter_file (원격 폴더 어댑터)
==========================================================
09_ETL_SFTP_Connection §6. FolderAdapter ABC, SFTPAdapter(paramiko), S3Adapter(boto3).
test_connection, list_files, download_file, download_file_head, delete_file, close.

[Classes]
===========
- FolderAdapter: 추상 인터페이스
- SFTPAdapter: paramiko 기반 SFTP
- S3Adapter: boto3 기반 S3

[Dependencies]
=========
- paramiko, boto3, stat, io
"""

import io
import logging
import stat
from abc import ABC, abstractmethod
from typing import List

logger = logging.getLogger(__name__)

try:
    import paramiko
except ImportError:
    paramiko = None

try:
    import boto3
except ImportError:
    boto3 = None


class FolderAdapter(ABC):
    """원격 폴더(SFTP/S3 등) 공통 인터페이스."""

    @abstractmethod
    def test_connection(self) -> bool:
        """연결 테스트 — 경로 존재 + 파일 목록 가능 여부."""

    @abstractmethod
    def list_files(self) -> List[str]:
        """폴더 내 파일명 목록 (디렉터리 제외)."""

    @abstractmethod
    def download_file(self, filename: str, local_path: str) -> str:
        """원격 → 로컬 임시 경로에 다운로드."""

    def download_file_head(self, filename: str, local_path: str, max_bytes: int = 65536) -> str:
        """원격 파일의 앞부분만 다운로드(헤더 등). 기본 64KB. 미구현 시 전체 다운로드로 대체."""
        return self.download_file(filename, local_path)

    @abstractmethod
    def delete_file(self, filename: str) -> None:
        """원격 파일 삭제."""

    def close(self):
        """연결 종료. 기본 구현은 no-op."""
        pass


class SFTPAdapter(FolderAdapter):
    """paramiko 기반 SFTP. 설계서 §6.3."""

    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "",
        password: str | None = None,
        private_key: str | None = None,
        remote_path: str = "/",
    ):
        if not paramiko:
            raise RuntimeError("paramiko가 설치되지 않았습니다. pip install paramiko")
        self.host = host
        self.port = port
        self.username = username
        self.remote_path = (remote_path or "/").rstrip("/") or "/"
        self.transport = paramiko.Transport((host, port))
        if private_key:
            key_file = io.StringIO(private_key)
            pkey = paramiko.RSAKey.from_private_key(key_file)
            self.transport.connect(username=username, pkey=pkey)
        else:
            self.transport.connect(username=username, password=password or "")
        self.sftp = paramiko.SFTPClient.from_transport(self.transport)

    def test_connection(self) -> bool:
        self.sftp.listdir(self.remote_path)
        return True

    def list_files(self) -> List[str]:
        entries = self.sftp.listdir_attr(self.remote_path)
        return [e.filename for e in entries if not stat.S_ISDIR(e.st_mode)]

    def download_file(self, filename: str, local_path: str) -> str:
        remote = f"{self.remote_path.rstrip('/')}/{filename}" if self.remote_path.rstrip("/") else f"/{filename}"
        self.sftp.get(remote, local_path)
        return local_path

    def download_file_head(self, filename: str, local_path: str, max_bytes: int = 65536) -> str:
        remote = f"{self.remote_path.rstrip('/')}/{filename}" if self.remote_path.rstrip("/") else f"/{filename}"
        with self.sftp.open(remote, "rb") as r:
            head = r.read(max_bytes)
        with open(local_path, "wb") as f:
            f.write(head)
        return local_path

    def delete_file(self, filename: str) -> None:
        remote = f"{self.remote_path.rstrip('/')}/{filename}" if self.remote_path.rstrip("/") else f"/{filename}"
        self.sftp.remove(remote)

    def close(self):
        try:
            self.sftp.close()
        except Exception:
            pass
        try:
            self.transport.close()
        except Exception:
            pass


class S3Adapter(FolderAdapter):
    """boto3 기반 S3. 설계서 §6.4."""

    def __init__(
        self,
        bucket: str,
        prefix: str = "",
        region: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
        endpoint_url: str | None = None,
    ):
        if not boto3:
            raise RuntimeError("boto3가 설치되지 않았습니다. pip install boto3")
        kwargs = {}
        if access_key_id:
            kwargs["aws_access_key_id"] = access_key_id
            kwargs["aws_secret_access_key"] = secret_access_key or ""
        if region:
            kwargs["region_name"] = region
        self.s3 = boto3.client("s3", endpoint_url=endpoint_url, **kwargs)
        self.bucket = bucket
        self.prefix = (prefix or "").rstrip("/")
        if self.prefix:
            self.prefix += "/"

    def test_connection(self) -> bool:
        self.s3.list_objects_v2(Bucket=self.bucket, Prefix=self.prefix, MaxKeys=1)
        return True

    def list_files(self) -> List[str]:
        paginator = self.s3.get_paginator("list_objects_v2")
        files = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=self.prefix, Delimiter="/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                name = key[len(self.prefix) :] if key.startswith(self.prefix) else key
                if name and "/" not in name:
                    files.append(name)
        return files

    def download_file(self, filename: str, local_path: str) -> str:
        key = f"{self.prefix}{filename}"
        self.s3.download_file(self.bucket, key, local_path)
        return local_path

    def download_file_head(self, filename: str, local_path: str, max_bytes: int = 65536) -> str:
        key = f"{self.prefix}{filename}"
        resp = self.s3.get_object(Bucket=self.bucket, Key=key, Range=f"bytes=0-{max_bytes - 1}")
        with open(local_path, "wb") as f:
            f.write(resp["Body"].read())
        return local_path

    def delete_file(self, filename: str) -> None:
        key = f"{self.prefix}{filename}"
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def close(self):
        pass
