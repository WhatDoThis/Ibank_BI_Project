/**
 * packages/etl/components/SourceTypeSelector.jsx (소스 유형 선택)
 * ================================================================
 * 파일 업로드 | DB 연결 탭 선택. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - sourceType: 'file' | 'db', onChange 콜백
 *
 * [Dependencies]
 * =========
 * - React
 */

function SourceTypeSelector({ sourceType, onChange }) {
  return (
    <div className="etl-source-type">
      <button
        type="button"
        className={`etl-source-type__tab ${sourceType === 'file' ? 'etl-source-type__tab--active' : ''}`}
        onClick={() => onChange('file')}
      >
        파일 업로드
      </button>
      <button
        type="button"
        className={`etl-source-type__tab ${sourceType === 'db' ? 'etl-source-type__tab--active' : ''}`}
        onClick={() => onChange('db')}
      >
        DB 연결
      </button>
    </div>
  );
}

export default SourceTypeSelector;
