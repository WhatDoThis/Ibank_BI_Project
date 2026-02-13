-- etl_tables에 배치 크기·배치 간격 컬럼 추가 (시스템 DB = ibank_system_data 에 실행)
-- 고객 DB 여건에 따라 배치 크기·배치 간격을 설정할 수 있음.
-- 실행: psql -h <host> -U <user> -d ibank_system_data -f alter_etl_tables_batch.sql

ALTER TABLE etl_tables
  ADD COLUMN IF NOT EXISTS batch_size INTEGER,
  ADD COLUMN IF NOT EXISTS batch_interval_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN etl_tables.batch_size IS 'DB 적재 시 한 번에 가져올 행 수. NULL/0이면 전체 fetch.';
COMMENT ON COLUMN etl_tables.batch_interval_seconds IS '배치 간 대기 시간(초). 0이면 대기 없음.';
