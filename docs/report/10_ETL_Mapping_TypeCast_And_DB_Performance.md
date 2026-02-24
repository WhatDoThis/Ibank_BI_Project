# ETL 매핑 형변환 제안 및 DB 연결(MySQL/Oracle) 성능 분석

## 1. 타입 형변환 업그레이드 제안

### 1.1 배경

- 소스가 숫자형인데 varchar로 저장해 두는 업체가 많아, **소스 타입과 무관하게 타겟 타입으로 형변환**이 필요함.
- **형변환이 안 되는 데이터가 섞여 있을 때** 처리 정책을 정해야 함(예: varchar 컬럼에 `"123"`, `"N/A"`, `""` 혼재 → integer 타겟).

### 1.2 현행

- **column_mapping**: `source`, `target`, `type`(타겟 PG 타입)만 있고, **실제 값 변환은 하지 않음**. CREATE TABLE 시 타입만 반영하고, 적재 시에는 소스에서 읽은 값을 그대로 INSERT.
- **transform_engine._apply_type_cast**: `target_type`, `on_error: null | keep` 지원. `etl_transform_rules`에 **수동으로** type_cast 룰을 넣어야 하며, **column_mapping의 type과 자동 연동되지 않음**.

### 1.3 제안: 매핑 기반 형변환 + “변환 실패 시” 정책

| 구분 | 제안 내용 |
|------|-----------|
| **적용 시점** | 컬럼 매핑에 **타겟 타입**이 있으면, 적재 직전(또는 transform 룰 적용 후)에 **해당 컬럼만** 해당 타입으로 변환. |
| **변환 실패 시 정책(on_error)** | 컬럼별(또는 전역 기본값)로 선택 가능하게 둠. |

**변환 실패 시 처리 옵션 제안**

| 옵션 | 설명 | 사용 예 |
|------|------|---------|
| **null** | 변환 실패 시 NULL로 적재. | 결측 허용, 타겟이 nullable일 때. |
| **zero** | 숫자형: 0, 날짜형: NULL 또는 최소값, 텍스트: 빈 문자열. | 집계 시 결측을 0으로 통일하고 싶을 때. |
| **keep** | 변환하지 않고 원본 값 그대로 적재. | 타겟을 TEXT로 두고 “가능하면 파싱, 안 되면 문자열”로 남기고 싶을 때. (타겟이 TEXT가 아니면 INSERT 오류 가능) |
| **skip_row** | 해당 행 전체를 적재에서 제외. | “한 건이라도 잘못된 값이 있으면 그 행은 빼고 싶을 때”. |
| **fail** | 해당 행에서 변환 실패 시 Job 실패. | 데이터 품질을 엄격히 맞추고 싶을 때. |

**권장 기본값**: `null`. (기존 transform type_cast의 `on_error`와 동일하게 null/keep 먼저 지원 후, zero/skip_row/fail 확장.)

### 1.4 구현 방향 제안

1. **컬럼 매핑에 on_error 확장(선택)**  
   - `column_mapping` 항목에 `on_error` 필드 추가(선택). 값: `null` | `zero` | `keep` | `skip_row` | `fail`.  
   - 없으면 전역 기본(예: `null`) 사용.

2. **적재 파이프라인에서 “매핑 기반 형변환” 단계 추가**  
   - DB/파일 공통: DataFrame까지 만든 뒤, **transform_rules 적용 후** (또는 대체하여)  
     - `column_mapping`의 `type` + `on_error`에 따라 컬럼별로 형변환 적용.  
   - `transform_engine`에 **매핑 기반 일괄 형변환** 함수 추가  
     - 예: `apply_mapping_type_cast(df, column_mapping, default_on_error="null")`  
     - 내부적으로 기존 `_apply_type_cast`와 동일한 변환 로직 사용, `on_error`만 매핑/전역 설정에서 읽기.

3. **변환 실패 시 skip_row / fail**  
   - `skip_row`: 해당 행을 마스킹 후 최종 INSERT 대상에서 제외(또는 별도 “변환 실패 로그” 테이블에 기록 옵션).  
   - `fail`: 첫 번째 변환 실패 시 즉시 Job failed, `error_message`에 컬럼명·행 번호·원본 값 요약 포함.

4. **UI**  
   - 테이블선택·컬럼매핑 모달에서 타겟 타입 선택 시, **“변환 실패 시”** 드롭다운 추가(null / zero / keep / skip_row / fail).  
   - 기본값은 `null`로 두어 기존 동작과 호환.

이렇게 하면 “숫자형인데 varchar로 저장된 소스 → 타겟 BIGINT” 매핑 시, 변환 불가 값은 정책에 따라 NULL/0/행 제외/실패 중 하나로 일관되게 처리할 수 있음.

---

## 2. MySQL / Oracle DB 연결 시 성능 저하 원인 분석

### 2.1 분석 대상 코드

- **Backend/etl_server2/db_load_service.py**  
  - `run_db_load()`: 소스 DB에서 SELECT → 변환 → 메인 DB(PostgreSQL) INSERT/Upsert.  
  - 소스 타입별: PostgreSQL(`row_type="dict"`, named cursor), MySQL(`row_type="tuple"`), Oracle(`row_type="tuple"`).

### 2.2 원인 요약

| 원인 | 설명 | MySQL | Oracle | PostgreSQL |
|------|------|-------|--------|------------|
| **1. batch_size=0일 때 전체 fetch** | `effective_batch_size == 0`이면 `SELECT ... LIMIT ...` 후 **fetchall()** 한 번에 전체 결과 수신. | ● | ● | ●(동일 분기) |
| **2. 서버 측 커서 미사용** | PostgreSQL만 **named cursor**(server-side) 사용. MySQL/Oracle은 **기본 커서**만 사용 → 대량 시 메모리·네트워크 부담. | ● | ● | ○(named 사용) |
| **3. COUNT(*) 선행 실행** | `batch_size > 0`일 때 ETA용으로 **SELECT COUNT(*)** 선행. 대용량 테이블에서 매우 느릴 수 있음. | ● | ● | ● |
| **4. 행 단위 INSERT** | 메인 DB에 **한 행씩 execute(insert_sql, row_vals)** 반복. 배치 INSERT/executemany/COPY 미사용. | ● | ● | ● |

### 2.3 상세

#### (1) batch_size=0 분기: 전체 fetch

```text
# db_load_service.py 667~669 라인 부근
else:
    cur_src = src_conn.cursor()
    cur_src.execute(f'SELECT {select_list} FROM {quoted_src}{where_clause}{limit_sql}', params)
    rows_data = cur_src.fetchall()   # 전체 결과를 한 번에 메모리로
```

- `batch_size`가 0이거나 설정되지 않으면 이 분기로 진입.
- MySQL/Oracle 모두 **전체 결과를 한 번에 클라이언트로 가져옴** → 메모리 사용량·네트워크 시간 증가, 대용량일수록 매우 느려짐.

#### (2) PostgreSQL만 server-side cursor 사용

```text
# 544 라인 부근
cur_src = src_conn.cursor(name="etl_src_%s" % job_id) if row_type == "dict" else src_conn.cursor()
```

- PostgreSQL: `row_type == "dict"` → **named cursor** 사용 → 서버에서 fetchmany 단위로만 전송.
- MySQL/Oracle: `row_type == "tuple"` → **일반 cursor** 사용.  
  - **PyMySQL**: 기본 Cursor는 결과를 클라이언트로 가져오는 방식이라, fetchmany를 써도 대량이면 부담. **SSCursor**를 쓰면 서버 측 커서처럼 동작.  
  - **oracledb**: 기본 prefetch/arraysize에 따라 한 번에 많이 가져올 수 있어, 대량 SELECT 시 초기 지연·메모리 사용이 클 수 있음.

#### (3) COUNT(*) 선행

```text
# 536~539 라인 부근 (effective_batch_size > 0 일 때)
cur_count = src_conn.cursor()
cur_count.execute(f'SELECT COUNT(*) FROM {quoted_src}{where_clause}', params)
row_count = cur_count.fetchone()
```

- ETA용으로 매번 **전체 행 수**를 세므로, 인덱스/통계에 따라 **풀 스캔**이 발생할 수 있음.  
- MySQL: MyISAM 등에서는 상대적으로 빠를 수 있으나, InnoDB에서는 대용량 시 느림.  
- Oracle: 대용량 테이블에서 COUNT(*)는 전형적인 고비용 연산.

#### (4) 행 단위 INSERT

```text
# 614~641 (스트리밍 분기), 726~740 (전체 fetch 분기)
for i, r in enumerate(rows_batch):  # 또는 rows_data
    ...
    cur_main.execute(insert_sql, row_vals)
```

- 메인 DB(PostgreSQL)에 **한 건씩 execute** 호출.  
- Round-trip·파싱 반복으로 인해 건수가 많을수록 극도로 느려짐.  
- **executemany** 또는 **COPY** 사용 시 크게 개선 가능.

### 2.4 개선 제안(요약)

| 항목 | 제안 |
|------|------|
| **배치 크기** | MySQL/Oracle은 **batch_size 기본값**을 0이 아닌 값(예: 5,000~10,000)으로 두거나, 0이면 “전체 fetch” 대신 **제한된 크기로 스트리밍**하도록 분기 변경. |
| **MySQL** | **PyMySQL SSCursor** 사용. `cursor=SSCursor` 또는 `conn.cursor(SSCursor)`로 스트리밍 커서 사용. |
| **Oracle** | **arraysize** 설정(예: 1,000~5,000). `cur.arraysize = N`으로 fetchmany 크기와 prefetch 제한. |
| **COUNT(*)** | ETA가 필수가 아니면 **제거**하거나, **옵션(설정/플래그)**으로 두어 대용량 시 비활성화. 또는 샘플링/통계 기반 근사치 사용. |
| **메인 DB INSERT** | **executemany(insert_sql, rows_batch)** 또는 PostgreSQL **COPY**로 배치 단위 INSERT. 트랜잭션 크기는 배치 단위로 유지. |

위와 같이 적용하면 MySQL/Oracle에서 “전체를 한 번에 가져오는 구간”과 “한 행씩 INSERT하는 구간”이 모두 완화되어, 전체 실행 시간이 크게 줄어들 가능성이 높음.

---

## 3. 적용 완료 개선 사항 (run_db_load 성능 업그레이드)

다음 개선이 **Backend/etl_server2/db_load_service.py**에 반영됨.

| 항목 | 적용 내용 |
|------|-----------|
| **executemany → COPY** | 스트리밍·전체 fetch 분기 모두 **COPY FROM STDIN** 프로토콜 사용. Full: `_copy_insert_batch`. Incremental: `_copy_upsert_batch`(TEMP TABLE TEXT → COPY → INSERT...SELECT ON CONFLICT DO UPDATE). `_serialize_value`/`_copy_buf`로 TEXT 포맷 직렬화. |
| **루프 밖 고정값** | 스트리밍 while 루프 진입 전에 `transform_rules_svc.list_transform_rules(etl_table_id)` 1회 호출 후 루프 안에서 재사용. columns_final, cols, insert_sql_template, upsert_sql_template은 **first_batch** 처리 시 한 번만 계산하고 이후 배치에서 재사용. |
| **MySQL 배치 상한** | net_write_timeout 방지를 위해 걸었던 3,000 상한을 **10,000**으로 완화. INSERT가 execute_values로 빨라져 fetch 간 간격이 줄어 timeout 위험 감소. |
| **변경 없음 유지** | 배치별 commit, is_job_cancelled 체크, incremental last_synced_at 갱신, 함수 시그니처·반환 형태는 기존과 동일. |

---

## 4. 참고 파일

- 형변환: `Backend/etl_server2/transform_engine.py` (`_apply_type_cast`), `transform_rules_service.py`, `db_load_service.py` / `load_service.py` (column_mapping 사용처).
- DB 성능: `Backend/etl_server2/db_load_service.py` (`run_db_load`), `service.py` (`_connect_mysql`, `_connect_oracle`).
