/**
 * packages/etl/components/SourceTypeSelector.jsx (소스 유형 선택)
 * ================================================================
 * 파일 업로드 | DB 연결 | 이력 탭 선택. sourceType 'file' | 'db' | 'history', onChange 콜백.
 *
 * [Components]
 * ===========
 * SourceTypeSelector: sourceType, onChange props
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
      <button
        type="button"
        className={`etl-source-type__tab ${sourceType === 'history' ? 'etl-source-type__tab--active' : ''}`}
        onClick={() => onChange('history')}
      >
        ETL 이력
      </button>
    </div>
  );
}

export default SourceTypeSelector;
