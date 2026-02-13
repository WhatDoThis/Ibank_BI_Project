-- ETL Job 이력 테이블 (시스템 DB = ibank_system_data 에 실행)
-- Phase 2 파일 적재·Phase 6 큐에서 사용.
-- 실행: psql -h <host> -U <user> -d ibank_system_data -f create_etl_jobs.sql

CREATE TABLE IF NOT EXISTS etl_jobs (
    job_id           BIGSERIAL       PRIMARY KEY,
    etl_table_id     BIGINT,
    status           VARCHAR(20)     NOT NULL,
    started_at       TIMESTAMP       DEFAULT NOW(),
    finished_at      TIMESTAMP,
    rows_processed   INTEGER         DEFAULT 0,
    error_message    TEXT,
    created_at       TIMESTAMP       DEFAULT NOW()
);
COMMENT ON TABLE etl_jobs IS 'ETL Job 실행 이력';
