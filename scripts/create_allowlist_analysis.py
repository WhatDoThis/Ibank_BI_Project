"""DB에 allowlist_analysis 테이블 생성 (Env/config 연결 정보 사용)."""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from Backend.api_server import db

DDL = """
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
COMMENT ON COLUMN allowlist_analysis.allowed_tables IS '허용 테이블 목록 배열';
COMMENT ON COLUMN allowlist_analysis.table_columns IS '테이블별 컬럼 목록';
COMMENT ON COLUMN allowlist_analysis.relationships IS '관계 목록';
CREATE INDEX IF NOT EXISTS idx_allowlist_analysis_analyzed_at ON allowlist_analysis (analyzed_at DESC);
"""

def main():
    conn = db.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(DDL)
        conn.commit()
        print("allowlist_analysis 테이블 생성 완료")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
