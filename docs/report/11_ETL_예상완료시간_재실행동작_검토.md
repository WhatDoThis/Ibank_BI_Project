# ETL 예상 완료 시간·재실행 동작 검토

## 1. 예상 완료 시간 / 남은 시간 표시

### 검토 요약

| 구분 | 가능 여부 | 전제 조건 |
|------|-----------|-----------|
| **파일 적재** | 가능 (구현 필요) | 전체 건수를 먼저 알 수 있어야 함. 현재는 파일 전체 읽은 뒤 INSERT라 진행률·ETA 없음. |
| **DB 적재** | 가능 (구현 필요) | 소스에서 `COUNT(*)` 또는 커서 기반 배치 추출 시 총 건수/현재 건수로 진행률 계산 필요. |

### 현재 동작

- **파일**: `_read_file()` 로 파일 전체를 메모리에 읽은 뒤, DROP/CREATE 후 행 단위 INSERT. 총 건수는 **INSERT 루프 시작 시점**에만 알 수 있음. 그 전에는 진행률·ETA 계산 불가.
- **DB**: `SELECT ... fetchall()` 로 소스 전체를 한 번에 가져온 뒤, Full이면 DROP/CREATE 후 행 단위 INSERT, Incremental이면 행 단위 Upsert. **총 건수는 fetchall() 완료 후**에만 알 수 있음. 그 전에는 진행률·ETA 불가.

### ETA를 넣으려면 필요한 변경

1. **진행률(processed / total) 노출**
   - **파일**: 파일을 한 번 읽어 `len(df)` 로 total 확보 후 INSERT 루프에서 N건마다 `update_job(job_id, rows_processed=current)` 또는 별도 progress 컬럼 갱신. 프론트는 `GET /api/etl/jobs/{id}` 폴링 시 `rows_processed` + total로 진행률 표시.
   - **DB**: 소스에서 먼저 `SELECT COUNT(*)` 로 total 조회하거나, 배치 단위로 가져오면서 누적 건수로 total 추정. 배치마다 `rows_processed`(또는 progress) 갱신. 프론트는 동일하게 폴링으로 진행률·남은 시간 계산.

2. **예상 완료 시각(ETA)**
   - `started_at`과 현재 `rows_processed`, total을 사용해  
     `예상 완료 시각 = started_at + (경과 시간 / rows_processed) * (total - rows_processed)`  
     식으로 계산 가능. (처리 속도가 일정하다고 가정.)
   - 백엔드에서 ETA를 계산해 `GET /api/etl/jobs/{id}` 응답에 `estimated_finished_at` 등으로 넣거나, 프론트에서 `started_at`, `rows_processed`, total로 계산하면 됨.

3. **정리**
   - **가능하다.** 파일·DB 모두 “총 건수”를 어느 시점에든 알 수 있게 하고, 주기적으로 `rows_processed`(또는 progress)를 갱신한 뒤, 프론트에서 진행률과 ETA를 계산·표시하면 된다.
   - 다만 현재 구조는 **전체 읽기/전체 적재**라서, ETA를 의미 있게 쓰려면 **배치 단위 처리 + 진행률 갱신**으로 바꾸는 작업이 선행되어야 한다. (4번 배치 크기 적용 시 함께 고려 가능.)

---

## 2. (참고) 실행 중 취소·연결 해제

- 실행 중 취소: 별도 문서/구현에서 다룸.
- DB 연결 해제 시 “해당 테이블 다시 드롭”: 해당 연결(connection_id)로 등록된 ETL의 **타겟 테이블**을 메인 DB에서 DROP하는 것으로 정의하고 구현함.

---

## 3. 이미 올라간 테이블에 대해 “실행”을 다시 누르면?

### 현재 동작 (코드 기준)

| 소스 유형 | sync_mode | 재실행 시 동작 |
|-----------|-----------|----------------|
| **파일** | - | `DROP TABLE IF EXISTS` → `CREATE TABLE` → 전체 INSERT. **기존 테이블을 지우고 처음부터 다시 적재** (전체 교체). |
| **DB** | **full** | 동일. `DROP TABLE IF EXISTS` → `CREATE TABLE` → 전체 INSERT. **전체 교체.** |
| **DB** | **incremental** | 테이블은 그대로 두고, `incremental_column > last_synced_at` 조건으로 소스에서 조회한 행만 **Upsert**(INSERT ... ON CONFLICT DO UPDATE). **업서트.** |

### 요약

- **파일 적재**: 재실행 = 항상 **전체 교체** (업서트 아님).
- **DB full**: 재실행 = **전체 교체** (업서트 아님).
- **DB incremental**: 재실행 = **업서트** (last_synced_at 이후 데이터만 가져와 PK 기준 갱신).

이미 올라간 테이블에 “실행”을 또 누르는 경우, 위 표와 같이 동작한다고 보면 된다.
