-- allowlist_analysis: allowlist 테이블·컬럼·관계 분석 결과 저장
-- Env/config 의 table_schema 와 동일한 스키마에 생성 (기본 public)
-- 실행: psql -h <host> -U <user> -d <dbname> -f scripts/allowlist_analysis.sql

CREATE TABLE IF NOT EXISTS allowlist_analysis (
    id                SERIAL PRIMARY KEY,
    analyzed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    table_schema      VARCHAR(64)  NOT NULL DEFAULT 'public',
    allowed_tables    JSONB        NOT NULL,
    table_columns     JSONB        NOT NULL,
    relationships     JSONB        NOT NULL
);

COMMENT ON TABLE allowlist_analysis IS 'allowlist 테이블 목록·테이블별 컬럼·테이블 관계(FK+추론) 분석 스냅샷';
COMMENT ON COLUMN allowlist_analysis.analyzed_at IS '분석 수행 시각';
COMMENT ON COLUMN allowlist_analysis.table_schema IS '분석 대상 DB 스키마(예: public)';
COMMENT ON COLUMN allowlist_analysis.allowed_tables IS '허용 테이블 목록 배열 예: ["campaigns","workflows",...]';
COMMENT ON COLUMN allowlist_analysis.table_columns IS '테이블별 컬럼 목록 예: {"campaigns":[{"column_name":"id","data_type":"integer"},...],...}';
COMMENT ON COLUMN allowlist_analysis.relationships IS '관계 목록 예: [{"from_table","from_column","to_table","to_column","confidence","reason","relationship_type"},...]';

CREATE INDEX IF NOT EXISTS idx_allowlist_analysis_analyzed_at ON allowlist_analysis (analyzed_at DESC);
