# Batch Sync — 원격 폴더 기반 자동 증분 적재 시스템 (설계서 v2)

> AI 에이전트 및 개발자용 구현 명세
> 기준일: 2026-02-25
> DB 반영 완료 (ibank_system_data)
>
> **아키텍처**: 백엔드는 `Backend/etl_server2`에 통합, 신규 파일은 `*_file.py`. 프론트는 `packages/etl2/components`에 신규 컴포넌트 `*File.jsx`. ETL2 페이지에서 "DB 연결"과 "저장 DB 등록" 사이에 "폴더 등록" 탭으로 진입.

---

## 1. 개요

### 1.1 목적

SFTP 서버 또는 AWS S3 버킷의 폴더를 등록하고,
**파일명이 "파일명_ib_yyyyMMddHHmmss" 형태인 파일만** 대상으로
**파일명(접두사)과 14자리 타임스탬프**(yyyyMMddHHmmss)를 추출하여
주기적(10분~24시간)으로 신규 파일을 감지하고
지정된 PostgreSQL DB에 **테이블 자동 생성 + PK 기반 upsert** 하는 배치 시스템.
(_ib_는 본 시스템을 개발하는 회사 ibank의 줄임말로, 업로드 파일 구분용 플래그이며, _ib_가 없는 파일은 처리하지 않음.)

### 1.2 핵심 흐름

폴더 연결 등록(SFTP/S3) → 배치 등록 (파일 패턴 + 저장 DB + 주기 + PK) → APScheduler가 interval_minutes마다 실행 → 원격 폴더 파일 목록 조회 → last_processed_ts 이후 파일만 필터 (타임스탬프 오름차순) → 파일별: 다운로드 → 파싱 → 타겟 테이블 없으면 CREATE → PK upsert → last_processed_ts 갱신 → 이력 기록


### 1.3 의존 시스템

| 항목 | 재사용 대상 | 비고 |
|------|------------|------|
| 저장 DB | `etl_storage_connections` (ETL2) | 적재 대상 PostgreSQL, get_target_db_connection() |
| 스키마 추론 | `schema_infer.py` 패턴 | pandas dtype → PG 타입 매핑 |
| etl_limits | `config.backend.etl_limits` | max_file_size_mb, max_rows_per_load |
| 시스템 DB | `ibank_system_data` | batch_* 메타 테이블 |

---

## 2. 기술 스택

### 2.1 추가 라이브러리 (requirements.txt)

| 라이브러리 | 용도 | 설치 |
|-----------|------|------|
| **paramiko** | SFTP 연결·파일 목록·다운로드 | `pip install paramiko` |
| **boto3** | AWS S3 연결·파일 목록·다운로드 | `pip install boto3` |
| **APScheduler** | Backend 내장 스케줄러 (주기 실행) | `pip install apscheduler` |

### 2.2 기존 활용

| 항목 | 기술 |
|------|------|
| 파일 파싱 | pandas + openpyxl + xlrd + pyarrow |
| DB 적재 | psycopg2 |
| 프론트 | React 19 + Vite (packages/etl2) |
| API | FastAPI (Backend/etl_server2) |

---

## 3. 데이터 모델 (반영 완료)

### 3.1 테이블 구조

batch_folder_connections (마스터) ├── batch_folder_sftp (1:1, ON DELETE CASCADE) └── batch_folder_s3 (1:1, ON DELETE CASCADE)

batch_jobs (배치 정의) └── batch_run_history (실행 이력, 1:N)


### 3.2 batch_folder_connections (마스터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| folder_connection_id | SERIAL PK | |
| connection_name | VARCHAR(200) | 표시명 |
| protocol | VARCHAR(20) | 'sftp', 's3' (향후 'gcs', 'azure' 등 확장) |
| is_verified | BOOLEAN | 연결 테스트 통과 여부 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 3.3 batch_folder_sftp (SFTP 상세)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| folder_connection_id | INTEGER PK FK | 마스터 참조, CASCADE 삭제 |
| host | VARCHAR(255) | SFTP 호스트 |
| port | INTEGER (기본 22) | |
| username | VARCHAR(200) | |
| password | TEXT | password 또는 private_key 중 택1 |
| private_key | TEXT | PEM 문자열 |
| remote_path | VARCHAR(1000) (기본 '/') | 원격 디렉터리 |

### 3.4 batch_folder_s3 (S3 상세)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| folder_connection_id | INTEGER PK FK | 마스터 참조, CASCADE 삭제 |
| bucket | VARCHAR(255) | S3 버킷명 |
| prefix | VARCHAR(1000) (기본 '') | 버킷 내 경로 접두사 |
| region | VARCHAR(50) | AWS 리전 |
| access_key_id | VARCHAR(200) | |
| secret_access_key | TEXT | |
| endpoint_url | VARCHAR(500) | MinIO 등 커스텀 엔드포인트 |

### 3.5 batch_jobs (배치 정의)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| batch_job_id | SERIAL PK | |
| folder_connection_id | INTEGER FK | 폴더 연결 참조 |
| storage_connection_id | INTEGER | etl_storage_connections FK (저장 DB) |
| job_name | VARCHAR(300) | 배치명 |
| file_pattern | VARCHAR(500) | 파일 접두사 (예: 'sales_data'). 매칭 형식: {file_pattern}_ib_yyyyMMddHHmmss.확장자 |
| file_extensions | VARCHAR(100) | 허용 확장자 (기본 'csv,xlsx,xls,parquet') |
| target_table | VARCHAR(200) | 적재 테이블명 |
| pk_columns | VARCHAR(500) | 쉼표 구분 PK (upsert 키) |
| timestamp_format | VARCHAR(50) | 기본 'yyyyMMddHHmmss' |
| interval_minutes | INTEGER (10~1440) | 실행 주기 (분) |
| is_active | BOOLEAN | 스케줄러 활성 여부 |
| last_processed_ts | VARCHAR(14) | 마지막 처리 파일의 타임스탬프 |
| last_run_at | TIMESTAMP | |
| last_run_status | VARCHAR(20) | idle/running/success/error |
| last_error_message | TEXT | |
| column_mapping | JSONB | [{source, target, type}] |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 3.6 batch_run_history (실행 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| run_id | SERIAL PK | |
| batch_job_id | INTEGER FK | |
| started_at | TIMESTAMP | |
| finished_at | TIMESTAMP | |
| status | VARCHAR(20) | running/success/error/skipped |
| files_processed | INTEGER | |
| rows_inserted | INTEGER | |
| rows_updated | INTEGER | |
| error_message | TEXT | |
| file_list | JSONB | 파일별 처리 결과 상세 |
| cancel_requested_at | TIMESTAMP NULL | (선택) 실행 취소 요청 시각. 있으면 취소 시 롤백 기능 사용 가능 |

취소 기능 사용 시: `ALTER TABLE batch_run_history ADD COLUMN cancel_requested_at TIMESTAMP NULL;`

### 3.7 프로토콜 확장 시 작업

새 프로토콜(예: GCS) 추가 시:
1. `batch_folder_gcs` 테이블 생성 (마스터 FK, CASCADE)
2. `folder_adapter_file.py`에 `GCSAdapter` 클래스 추가
3. `service_file.py` 팩토리에 `elif protocol == 'gcs':` 분기 추가
4. 프론트 `FolderConnectionFormFile.jsx`에 프로토콜 옵션 + 폼 필드 추가

**마스터, batch_jobs, batch_run_history, 스케줄러, executor는 수정 없음.**

---

## 4. 핵심 알고리즘

### 4.1 파일명 파싱

- **대상 형식**: `파일명_ib_yyyyMMddHHmmss.확장자` 만 처리. (`ib` = ibank, 업로드 파일 구분용 플래그.)
- **추출 대상**: 파일명(접두사)과 14자리 타임스탬프만 사용. `_ib_`는 구분 플래그로만 사용하며 추출값에는 포함하지 않음.
- **_ib_ 없는 파일**: 매칭·처리하지 않고 무시 (WARNING 로그 없이 건너뜀).

입력 예: "sales_data_ib_20250225140000.csv"
매칭: `^{re.escape(file_pattern)}_ib_(\d{14})\.({extensions_regex})$`

추출: timestamp = "20250225140000", extension = "csv"
datetime = strptime("20250225140000", "%Y%m%d%H%M%S") → 유효성 검증

규칙:

- {file_pattern}_ib_ 로 시작
- 바로 뒤 14자리 숫자 (yyyyMMddHHmmss)
- . + 허용 확장자
- _ib_가 없거나 위 형식과 불일치하는 파일은 무시 (처리 대상에서 제외)
- 14자리지만 유효하지 않은 날짜(20251332...) → 건너뜀 + WARNING

### 4.2 증분 판단

```python
def get_pending_files(all_files, file_pattern, extensions, last_processed_ts):
    matched = []
    for f in all_files:
        parsed = parse_filename(f, file_pattern, extensions)
        if parsed is None:
            continue  # 패턴 불일치
        matched.append((f, parsed.timestamp))

    matched.sort(key=lambda x: x[1])  # 타임스탬프 오름차순

    if last_processed_ts is None:
        # 첫 실행: 가장 오래된 파일 1건만 (스키마 기준점 확보)
        return matched[:1]
    else:
        # 증분: last_processed_ts 이후만
        return [(f, ts) for f, ts in matched if ts > last_processed_ts]
첫 실행 시 1건만 처리하는 이유:

스키마(컬럼·타입)의 기준점 확보
대량 파일 일괄 처리 시 중간 오류 롤백 범위 최소화
첫 실행 성공 후 다음 주기에서 나머지 순차 증분
4.3 적재 로직
파일 N건을 타임스탬프 오름차순으로 순회:

  for each (filename, timestamp) in pending_files:

    df = read_file(local_path)       # pandas (CSV/Excel/Parquet)
    df = apply_column_mapping(df)     # column_mapping 있으면 적용
    df = cast_types(df)               # 타겟 테이블 타입에 맞춰 캐스팅

    if target_table NOT EXISTS:
      → CREATE TABLE (df 스키마 기반, PK 포함)
      → INSERT 전체 행

    else if pk_columns 설정됨:
      → INSERT ... ON CONFLICT(pk) DO UPDATE SET col=EXCLUDED.col ...

    else:
      → INSERT만 (APPEND, 중복 가능)

    ✓ 성공 → last_processed_ts = timestamp
    ✗ 실패 → ERROR 로그, 다음 파일 계속 처리 (파일 단위 격리)
5. 스케줄러 설계 (APScheduler)
5.1 초기화 (main.py startup)
Copyfrom apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor

scheduler = BackgroundScheduler(
    executors={'default': ThreadPoolExecutor(max_workers=3)},
    job_defaults={
        'coalesce': True,       # 밀린 실행을 1회로 합침
        'max_instances': 1,     # 같은 배치 동시 실행 방지
        'misfire_grace_time': 300  # 5분 이내 지연은 허용
    }
)
5.2 배치 로드
Copydef load_active_batch_jobs():
    """서버 시작/재시작 시 DB에서 is_active=True 배치를 스케줄러에 등록 (scheduler_file.py)"""
    active_jobs = service_file.list_batch_jobs(is_active=True)
    for job in active_jobs:
        scheduler.add_job(
            func=batch_executor_file.run_batch_job,
            trigger='interval',
            minutes=job['interval_minutes'],
            id=f"batch_{job['batch_job_id']}",
            args=[job['batch_job_id']],
            replace_existing=True,
            next_run_time=datetime.now() + timedelta(seconds=10)  # 시작 10초 후 첫 실행
        )
5.3 배치 CRUD 시 스케줄러 동기화
이벤트	스케줄러 액션
배치 생성 (is_active=True)	scheduler.add_job()
배치 활성화	scheduler.add_job()
배치 비활성화	scheduler.remove_job(f"batch_{id}")
주기 변경	scheduler.reschedule_job(f"batch_{id}", trigger='interval', minutes=new)
배치 삭제	scheduler.remove_job(f"batch_{id}")
즉시 실행	scheduler.add_job(..., next_run_time=datetime.now()) (1회성)
6. 원격 폴더 어댑터 (구현: `folder_adapter_file.py`)
6.1 공통 인터페이스
Copyclass FolderAdapter:
    def test_connection(self) -> bool:
        """연결 테스트 — 경로 존재 + 파일 목록 가능 여부"""

    def list_files(self) -> list[str]:
        """폴더 내 파일명 목록 (디렉터리 제외)"""

    def download_file(self, filename: str, local_path: str) -> str:
        """원격 → 로컬 임시 경로에 다운로드"""

    def close(self):
        """연결 종료"""
6.2 어댑터 팩토리
Copydef get_folder_adapter(folder_connection_id: int) -> FolderAdapter:
    master = get_folder_connection(folder_connection_id)
    protocol = master['protocol']

    if protocol == 'sftp':
        detail = get_folder_sftp(folder_connection_id)
        return SFTPAdapter(**detail)
    elif protocol == 's3':
        detail = get_folder_s3(folder_connection_id)
        return S3Adapter(**detail)
    else:
        raise ValueError(f"지원하지 않는 프로토콜: {protocol}")
6.3 SFTP 어댑터 (paramiko)
Copyclass SFTPAdapter(FolderAdapter):
    def __init__(self, host, port, username, password=None, private_key=None, remote_path='/'):
        self.transport = paramiko.Transport((host, port))
        if private_key:
            pkey = paramiko.RSAKey.from_private_key(io.StringIO(private_key))
            self.transport.connect(username=username, pkey=pkey)
        else:
            self.transport.connect(username=username, password=password)
        self.sftp = paramiko.SFTPClient.from_transport(self.transport)
        self.remote_path = remote_path

    def test_connection(self):
        self.sftp.listdir(self.remote_path)
        return True

    def list_files(self):
        entries = self.sftp.listdir_attr(self.remote_path)
        return [e.filename for e in entries if not stat.S_ISDIR(e.st_mode)]

    def download_file(self, filename, local_path):
        self.sftp.get(f"{self.remote_path}/{filename}", local_path)
        return local_path

    def close(self):
        self.sftp.close()
        self.transport.close()
6.4 S3 어댑터 (boto3)
Copyclass S3Adapter(FolderAdapter):
    def __init__(self, bucket, prefix='', region=None,
                 access_key_id=None, secret_access_key=None, endpoint_url=None):
        kwargs = {}
        if access_key_id:
            kwargs['aws_access_key_id'] = access_key_id
            kwargs['aws_secret_access_key'] = secret_access_key
        if region:
            kwargs['region_name'] = region
        self.s3 = boto3.client('s3', endpoint_url=endpoint_url, **kwargs)
        self.bucket = bucket
        self.prefix = prefix.rstrip('/') + '/' if prefix else ''

    def test_connection(self):
        self.s3.list_objects_v2(Bucket=self.bucket, Prefix=self.prefix, MaxKeys=1)
        return True

    def list_files(self):
        paginator = self.s3.get_paginator('list_objects_v2')
        files = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=self.prefix, Delimiter='/'):
            for obj in page.get('Contents', []):
                name = obj['Key'][len(self.prefix):]
                if name and '/' not in name:
                    files.append(name)
        return files

    def download_file(self, filename, local_path):
        self.s3.download_file(self.bucket, f"{self.prefix}{filename}", local_path)
        return local_path

    def close(self):
        pass
Copy
7. 에러 대응 전략
7.1 타입 캐스팅 문제
상황: 첫 파일에서 숫자로 추론된 컬럼이 이후 파일에서 문자열을 포함

대응 (자동):
1. 적재 전 타겟 테이블 컬럼 타입 조회
2. df 각 컬럼을 타겟 타입으로 캐스팅 시도
   - 숫자: pd.to_numeric(errors='coerce') → 실패 값 NaN
   - 날짜: pd.to_datetime(errors='coerce') → 실패 값 NaT
3. NaN/NaT 발생 행 → NULL로 치환 후 적재 (데이터 유실 최소화)
4. 캐스팅 실패 건수를 file_list에 기록:
   {"cast_warnings": [{"column": "price", "failed_count": 3}]}

대응 (수동):
- column_mapping에 type 명시 시 해당 타입으로 강제 캐스팅
- ALTER COLUMN은 자동 수행하지 않음 (위험) → UI 경고 표시
7.2 컬럼 불일치
상황: 이후 파일에 새 컬럼 추가 또는 기존 컬럼 누락

새 컬럼이 파일에 있고 테이블에 없음:
  - column_mapping 있음 → 매핑에 없는 소스 컬럼은 무시
  - column_mapping 없음 → 해당 컬럼 무시 + WARNING 로그
    (자동 ALTER TABLE ADD COLUMN은 하지 않음, 안전 우선)
  - file_list에 "new_columns": ["col_x", "col_y"] 기록

기존 컬럼이 파일에 없음:
  - column_mapping 있음 → 매핑된 소스 없는 타겟은 NULL
  - column_mapping 없음 → 해당 컬럼 NULL로 적재
  - NOT NULL 제약 컬럼이면 → 해당 파일 건너뜀 + ERROR
7.3 파일명 타임스탬프 파싱 실패
- _ib_가 없는 파일 → 처리 대상 아님, 무시 (로그 없이 건너뜀)
- 14자리 아님 → 건너뜀 + WARNING
- 14자리지만 유효하지 않은 날짜 → 건너뜀 + WARNING
- file_list: {"filename": "...", "status": "skipped", "reason": "invalid_timestamp"}
7.4 네트워크·연결 실패
- 연결 실패 시 3회 exponential backoff 재시도 (2초, 4초, 8초)
- 3회 실패 → 해당 주기 error로 기록, 다음 주기에 재시도
- 연속 5회 error → is_active를 false로 전환 + last_error_message에 기록
  (UI에서 확인 후 원인 해결 → 재활성화)
7.5 대용량 파일
- etl_limits.max_file_size_mb 초과 → 해당 파일 건너뜀 + WARNING
- etl_limits.max_rows_per_load 초과 → 해당 행까지만 적재 + WARNING
- 로컬 임시 파일: tempfile.mkdtemp → 처리 완료 즉시 삭제
  (원본이 원격에 있으므로 로컬 보관 불필요)
7.6 PK 미설정
- pk_columns 비어 있으면 → INSERT만 (APPEND), upsert 불가
- UI에서 "PK 미설정: 중복 행 발생 가능" 경고 상시 표시
- 첫 실행 시 파일 컬럼 분석하여 PK 후보 자동 제안 (유니크 컬럼 탐지)
7.7 파일 체크섬 중복 방지
- 다운로드 후 SHA-256 해시 계산
- batch_run_history.file_list에 checksum 기록
- 이전 이력에서 동일 checksum + 동일 batch_job_id 존재 시
  → "중복 파일" 로그 + 건너뜀
7.8 파일 쓰기 중 읽기 방지 (File Locking)
SFTP:
  - stat()으로 파일 크기 조회 → 3초 대기 → 재조회
  - 크기 동일하면 쓰기 완료로 판단, 다르면 한 번 더 대기 (최대 3회)

S3:
  - S3 PutObject는 atomic → 업로드 완료 전에는 객체 미노출
  - 별도 처리 불필요
8. API 엔드포인트 (prefix: /api/etl2/batch — etl_server2 라우터에 포함)
8.1 폴더 연결
메서드	경로	용도
GET	/folder-connections	목록 (마스터 + 프로토콜 상세 JOIN)
POST	/folder-connections	등록 (마스터 + 프로토콜별 상세 INSERT)
PATCH	/folder-connections/{id}	수정
DELETE	/folder-connections/{id}	삭제 (CASCADE로 상세도 삭제)
POST	/folder-connections/test	연결 테스트 (어댑터.test_connection)
GET	/folder-connections/{id}/files	파일 목록 (어댑터.list_files)
GET	/folder-connections/{id}/patterns	파일 패턴 자동 추출
8.2 배치
메서드	경로	용도
GET	/jobs	배치 목록
POST	/jobs	배치 등록 + 스케줄러 등록
PATCH	/jobs/{id}	수정 + 스케줄러 재등록
DELETE	/jobs/{id}	삭제 + 스케줄러 제거
POST	/jobs/{id}/run-now	즉시 1회 실행
POST	/jobs/{id}/toggle	활성/비활성 토글 + 스케줄러 동기화
GET	/jobs/{id}/history	실행 이력 목록
GET	/jobs/{id}/history/{run_id}	실행 이력 상세 (파일별 결과)
8.3 패턴 추출 API
GET /api/etl2/batch/folder-connections/{id}/patterns

응답:
{
  "patterns": [
    {
      "pattern": "sales_data",
      "file_count": 45,
      "latest_ts": "20250225140000",
      "oldest_ts": "20250101000000",
      "extensions": ["csv"]
    },
    {
      "pattern": "returns",
      "file_count": 12,
      "latest_ts": "20250224090000",
      "oldest_ts": "20250201120000",
      "extensions": ["xlsx", "csv"]
    }
  ]
}

로직:
1. 어댑터.list_files()
2. 각 파일에서 _ib_{14자리}.{확장자} 패턴만 매칭 (_ib_가 없는 파일은 제외)
3. 매칭 파일을 패턴(접두사)별 그룹화
4. 패턴별 파일 수, 최신/최고 타임스탬프, 사용 확장자 반환
9. 백엔드 모듈 구조

**위치**: `Backend/etl_server2` (기존 ETL2 서버에 통합).  
**규칙**: 본 설계서로 신규 제작되는 파일은 확장자 앞에 `file`을 붙여 `*_file.py` 형태로 작성한다.

Backend/etl_server2/
├── (기존) __init__.py, router.py, service.py, load_service.py, db_load_service.py, ...
└── [본 설계서로 신규 제작 — *_file.py]
    ├── router_file.py            # /api/etl2/batch 하위 엔드포인트 (폴더 연결·배치·이력)
    ├── service_file.py           # 배치 메타 CRUD, 어댑터 팩토리, 패턴 추출
    ├── folder_adapter_file.py    # FolderAdapter ABC, SFTPAdapter, S3Adapter
    ├── parser_file.py            # 파일명 파싱(_ib_+14자리), 타임스탬프 추출·검증, pandas 읽기
    ├── batch_executor_file.py    # run_batch_job (핵심 실행 로직)
    ├── load_service_file.py      # 배치용: 테이블 존재 확인, CREATE, upsert, 타입 캐스팅
    └── scheduler_file.py        # APScheduler 초기화, active 배치 로드, add/remove/reschedule

기존 `router.py`에서 `router_file.router`를 `prefix="/batch"` 등으로 include하여 `/api/etl2/batch/*` 로 노출.

9.1 모듈 의존
main.py (startup)
  └── scheduler_file.py
        ├── batch_executor_file.run_batch_job  (실행 함수)
        └── service_file.list_batch_jobs       (active 배치 조회)

router_file.py
  ├── service_file.py
  │     ├── folder_adapter_file.py   (연결·목록·테스트)
  │     ├── parser_file.py           (패턴 추출)
  │     └── DB 메타 CRUD (batch_*)
  ├── batch_executor_file.py         (run-now)
  └── scheduler_file.py              (CRUD 시 동기화)

batch_executor_file.py
  ├── service_file.py                (배치 조회, 이력 기록, ts 갱신)
  ├── folder_adapter_file.py         (다운로드)
  ├── parser_file.py                 (파싱, pandas 읽기)
  └── load_service_file.py           (CREATE, upsert)
        └── etl_server2.service.get_target_db_connection  (저장 DB 연결 재사용)
10. 실행 흐름 상세 (batch_executor_file.run_batch_job)
Copydef run_batch_job(batch_job_id: int):
    """스케줄러 또는 즉시 실행에서 호출"""

    # ── 1. 중복 실행 방지 ──
    job = service.get_batch_job(batch_job_id)
    if not job or not job['is_active']:
        return
    if job['last_run_status'] == 'running':
        log.warning(f"batch {batch_job_id} 이미 실행 중, 건너뜀")
        return

    # ── 2. 실행 시작 ──
    run_id = service.create_batch_run(batch_job_id)
    service.update_job_status(batch_job_id, 'running')
    adapter = None

    try:
        # ── 3. 폴더 연결 (재시도 3회) ──
        adapter = connect_with_retry(job['folder_connection_id'], retries=3)

        # ── 4. 파일 목록 + 증분 필터 ──
        all_files = adapter.list_files()
        pending = parser_file.get_pending_files(
            all_files, job['file_pattern'],
            job['file_extensions'], job['last_processed_ts']
        )

        if not pending:
            service.finish_run(run_id, 'skipped', message='신규 파일 없음')
            service.update_job_status(batch_job_id, 'success')
            return

        # ── 5. 저장 DB 연결 ──
        target_conn, target_schema = get_target_db_connection(job['storage_connection_id'])

        # ── 6. 파일 순차 처리 ──
        total_ins, total_upd = 0, 0
        file_results = []

        for filename, ts in pending:
            local_path = None
            try:
                # 6a. 파일 안정성 검사 (SFTP)
                if job_protocol == 'sftp':
                    wait_for_stable_size(adapter, filename)

                # 6b. 다운로드
                ext = filename.rsplit('.', 1)[-1]
                with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{ext}') as tmp:
                    local_path = tmp.name
                adapter.download_file(filename, local_path)

                # 6c. 크기 검사
                check_file_size_limit(local_path)

                # 6d. 파싱
                df = parser_file.read_file(local_path, max_rows=etl_limits.max_rows_per_load)

                # 6e. 컬럼 매핑
                if job['column_mapping']:
                    df = apply_column_mapping(df, job['column_mapping'])

                # 6f. 체크섬 중복 검사
                checksum = compute_sha256(local_path)
                if service.is_duplicate_checksum(batch_job_id, checksum):
                    file_results.append({"filename": filename, "status": "skipped", "reason": "duplicate_checksum"})
                    continue

                # 6g. 적재
                result = load_service_file.load_dataframe(
                    conn=target_conn, schema=target_schema,
                    table_name=job['target_table'], df=df,
                    pk_columns=job['pk_columns'],
                    column_mapping=job['column_mapping']
                )

                total_ins += result['inserted']
                total_upd += result['updated']
                file_results.append({
                    "filename": filename, "timestamp": ts,
                    "status": "ok", "rows": len(df),
                    "inserted": result['inserted'], "updated": result['updated'],
                    "checksum": checksum, **result.get('warnings', {})
                })

                # 6h. ts 갱신 (파일 성공 시마다)
                service.update_last_processed_ts(batch_job_id, ts)

            except Exception as e:
                file_results.append({"filename": filename, "status": "error", "error": str(e)})
                log.error(f"파일 처리 실패: {filename}", exc_info=True)

            finally:
                if local_path and os.path.exists(local_path):
                    os.remove(local_path)

        # ── 7. 완료 ──
        service.finish_run(run_id, 'success',
            files_processed=len(file_results),
            rows_inserted=total_ins, rows_updated=total_upd,
            file_list=file_results)
        service.update_job_status(batch_job_id, 'success')

    except Exception as e:
        service.finish_run(run_id, 'error', error_message=str(e))
        service.update_job_status(batch_job_id, 'error', str(e))
        # 연속 실패 카운트 확인 → 5회 연속이면 비활성화
        service.check_consecutive_failures(batch_job_id, threshold=5)

    finally:
        if adapter:
            adapter.close()
Copy
11. 프론트엔드 구조

**위치**: `Frontend/react-app/src/packages/etl2/components`  
**규칙**: 본 설계서로 신규 제작되는 컴포넌트·파일은 카멜표기법을 따르며, 배치(폴더) 기능용임을 나타내기 위해 이름에 `File`을 붙인다 (예: FolderConnectionFormFile.jsx).

11.1 패키지 (ETL2 기존 구조 내 추가)
packages/etl2/
├── (기존) ETLPage.jsx, index.jsx, etl.css, components/DbConnectionForm.jsx, StorageConnectionForm.jsx, ...
└── components/
    └── [본 설계서로 신규 제작 — *File.jsx]
        ├── FolderConnectionFormFile.jsx   # 프로토콜 선택(SFTP/S3) → 동적 폼 + 연결 테스트
        ├── FolderConnectionListFile.jsx   # 등록된 폴더 목록 + 삭제
        ├── BatchJobFormFile.jsx           # 배치 등록/수정
        ├── BatchJobListFile.jsx           # 배치 목록 (상태·다음 실행·토글·즉시 실행)
        ├── PatternSelectModalFile.jsx     # 패턴 선택 모달 (자동 추출 + 직접 입력)
        ├── BatchHistoryPanelFile.jsx     # 배치별 실행 이력 목록
        └── BatchHistoryDetailFile.jsx    # 파일별 처리 결과 상세

11.2 ETL2 페이지 내 배치(폴더) 진입
- ETL2 페이지의 상단 탭 순서: **파일 업로드 | DB 연결 | 폴더 등록 | 저장 DB 등록 | ETL 이력**
- **폴더 등록** 탭을 선택하면 폴더 연결·배치 관리·실행 이력 UI가 표시된다 (별도 페이지/라우트가 아닌 동일 ETL2 페이지 내 탭).
- 기존 SourceTypeSelector에 "폴더 등록" 버튼(탭)을 DB 연결과 저장 DB 등록 사이에 추가하고, 해당 탭에서 위 *File.jsx 컴포넌트들을 사용한다.

11.3 주요 UI 흐름
[폴더 등록 탭: 폴더 연결]
  ┌─ 프로토콜 선택 (SFTP / S3) ─────────────────────┐
  │  SFTP: 호스트, 포트, 유저, 비밀번호/키, 원격경로   │
  │  S3:   버킷, 접두사, 리전, 키ID, 시크릿, 엔드포인트│
  └─── [연결 테스트] → 성공 시 [등록] ──────────────┘
  등록된 폴더 연결 목록 (이름 | 프로토콜 | 상태 | 삭제)

[폴더 등록 탭: 배치 관리]
  폴더 연결 드롭다운 선택
  → [파일 패턴 선택] 버튼 → PatternSelectModalFile
    ┌──────────────────────────────────────────────┐
    │  patterns API 결과 테이블:                      │
    │  패턴명 | 파일수 | 최신TS | 최고TS | 확장자    │
    │  [선택] 또는 하단 [직접 입력] 필드              │
    └──────────────────────────────────────────────┘
  저장 DB 드롭다운 (etl_storage_connections)
  타겟 테이블명
  실행 주기 (분): 슬라이더 또는 입력 (10~1440)
  PK 컬럼 (쉼표 구분, 선택)
  → [등록]

  배치 목록 테이블:
  이름 | 폴더 | 패턴 | 저장DB | 주기 | 상태 | 마지막 실행 | 다음 실행 | 동작
  동작: 활성/비활성 토글 | 즉시 실행 | 수정 | 삭제 | 이력

[폴더 등록 탭: 실행 이력]
  배치 선택 드롭다운
  → 이력 목록: 시작 | 종료 | 상태 | 파일수 | insert | update | 에러
  → 이력 클릭 → 파일별 상세 (파일명 | TS | 상태 | 행수 | 경고)

11.4 API 클라이언트 (shared/api/client.js 추가 — base path /api/etl2, batch 하위는 /api/etl2/batch)
batchListFolderConnections()
batchCreateFolderConnection(body)
batchUpdateFolderConnection(id, body)
batchDeleteFolderConnection(id)
batchTestFolderConnection(body)
batchListFolderFiles(id)
batchListFolderPatterns(id)
batchListJobs()
batchCreateJob(body)
batchUpdateJob(id, body)
batchDeleteJob(id)
batchRunJobNow(id)
batchToggleJob(id)
batchListJobHistory(id)
batchGetJobHistoryDetail(id, runId)

12. 구현 Phase

| Phase | 범위 | 주요 산출물 |
|-------|------|-------------|
| 0 | 백엔드 router_file 등록 + 프론트 탭·라우팅 | etl_server2/router_file.py (include), ETLPage 탭에 'folder' 추가, SourceTypeSelector에 "폴더 등록" |
| 1 | 폴더 연결 CRUD + 연결 테스트 (SFTP/S3) + 프론트 폼/목록 | folder_adapter_file.py, service_file.py, FolderConnectionFormFile.jsx, FolderConnectionListFile.jsx |
| 2 | 파일 목록 + 패턴 추출 API + 패턴 선택 모달 | parser_file.py (파싱·_ib_ 패턴), PatternSelectModalFile.jsx |
| 3 | 배치 CRUD + 스케줄러 초기화/등록/제거 + 프론트 배치 폼/목록 | scheduler_file.py, BatchJobFormFile.jsx, BatchJobListFile.jsx |
| 4 | 배치 실행기 핵심 (다운로드→파싱→CREATE/upsert→ts갱신→이력) | batch_executor_file.py, load_service_file.py |
| 5 | 실행 이력 API + 파일별 상세 + 에러 대응 (타입·컬럼·체크섬) | BatchHistoryPanelFile.jsx, BatchHistoryDetailFile.jsx |
| 6 | UI 마무리 (상태 표시·토글·즉시 실행·경고·다음 실행 시각) + 통합 테스트 | 전체 연동 검증 |

이 문서를 기반으로 Phase 0부터 진행하면 됩니다. 각 Phase에서 서브에이전트에 위임할 때 해당 Phase의 섹션을 컨텍스트로 넘기면 맥락을 정확히 잡을 수 있을 거예요. 궁금한 점이나 조정할 부분 있으면 말씀해주세요.