# ETL Job 확인 방법 (상태 running인데 insert 안 될 때)

상태가 **running**으로 남아 있고 실제 적재가 안 되는 것 같을 때 아래 순서로 확인한다.

---

## 1. 백엔드 터미널 로그

`python run.py back` 실행 중인 터미널에서 다음 로그가 나오는지 본다.

| 로그 | 의미 |
|------|------|
| `ETL file load started etl_table_id=... job_id=... file_path=...` | 파일 적재 Job 시작. 워커가 해당 Job을 잡았고, 파일 읽기 단계로 진입함. |
| `ETL db load started etl_table_id=... job_id=... sync_mode=...` | DB 적재 Job 시작. 워커가 Job을 잡았고, 소스 DB 조회 단계로 진입함. |
| `ETL file load completed job_id=... rows_processed=...` | 파일 적재 성공. |
| `ETL db load completed job_id=... rows_processed=...` | DB 적재 성공. |
| `ETL file load failed job_id=...` / `ETL db load failed job_id=...` | 적재 실패. 그 아래 traceback으로 원인 확인. |

- **"started"만 있고 "completed"/"failed"가 없으면**  
  → 해당 Job이 아직 실행 중이거나, 예외가 나서 워커가 죽었을 수 있음.  
  → 오래 걸리는 대용량이면 잠시 더 기다려 보거나, 2번으로 Job 상태를 확인한다.

---

## 2. DB에서 Job·테이블 상태 확인 (시스템 DB)

시스템 DB(예: `ibank_system_data`)에 접속해 다음을 실행한다.

```sql
-- 최근 Job 목록: 상태, 시작/종료 시각, 처리 건수, 에러 메시지
SELECT job_id, etl_table_id, status, started_at, finished_at, rows_processed, error_message, created_at
FROM etl_jobs
ORDER BY job_id DESC
LIMIT 20;
```

| 확인 항목 | 의미 |
|-----------|------|
| `status = 'running'` 이고 `finished_at` 이 NULL | 아직 실행 중이거나, 워커가 중간에 죽어서 완료 처리되지 않은 상태. |
| `status = 'failed'` | 실패. `error_message` 에 원인 있음. |
| `status = 'completed'` | 성공. `rows_processed` 가 실제 적재 건수. |

```sql
-- ETL 테이블별 상태
SELECT etl_table_id, target_table, status, source_type, file_path, connection_id, source_table, updated_at
FROM etl_tables
ORDER BY etl_table_id DESC
LIMIT 20;
```

`etl_tables.status` 가 **running** 이면 해당 ETL이 지금 Job 실행 중인 상태다.  
실제로는 실패했는데 **running** 으로 남아 있으면, 그 ETL에 해당하는 `etl_jobs` 행에서 `status`/`error_message` 를 함께 보면 원인 추적에 도움이 된다.

---

## 3. 파일 적재인 경우

- **파일 존재 여부**  
  `etl_tables.file_path` 에 저장된 경로가 백엔드 서버(또는 `run.py back` 실행 환경)에서 실제로 존재하는지 확인한다.  
  업로드 후 3일 지나면 정리 스크립트로 삭제될 수 있음.

- **메인 DB에 테이블/데이터 생성 여부**  
  리포트용 DB(메인 DB)에 `etl_tables.target_table` 에 해당하는 테이블이 생겼는지,  
  `SELECT COUNT(*) FROM "스키마"."타겟테이블명";` 로 확인한다.

---

## 4. DB 적재인 경우

- **소스 DB 연결**  
  `etl_connections` 에 등록된 호스트/포트/DB/계정으로 접속이 되는지,  
  필요하면 `POST /api/etl/connections/test` 등으로 테스트한다.

- **incremental 모드**  
  `pk_columns` 가 비어 있으면 실패한다.  
  Job이 실패했다면 `etl_jobs.error_message` 에 "pk_columns가 필요합니다" 등이 나올 수 있다.

- **메인 DB에 테이블/데이터**  
  Full이면 DROP/CREATE 후 INSERT, Incremental이면 Upsert이므로  
  메인 DB에서 해당 `target_table` 존재 여부와 `SELECT COUNT(*)` 로 적재 여부를 확인한다.

---

## 5. running에서 멈춘 Job 수동 정리 (선택)

워커가 죽어서 **running** 으로만 남아 있고, 같은 Job을 다시 돌릴 필요가 없으면  
시스템 DB에서 해당 Job만 실패 처리해 둘 수 있다.

```sql
UPDATE etl_jobs
SET status = 'failed', finished_at = NOW(), error_message = '수동 종료(확인 후 정리)'
WHERE status = 'running' AND job_id = <해당 job_id>;

-- 해당 ETL 테이블 상태도 정리
UPDATE etl_tables SET status = 'error', updated_at = NOW() WHERE etl_table_id = <해당 etl_table_id>;
```

이후에는 ETL 목록에서 다시 "실행"을 눌러 새 Job으로 돌리면 된다.
