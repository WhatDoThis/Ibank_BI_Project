/**
 * packages/etl/components/SourceTypeSelector.jsx (소스 유형 선택)
 * ================================================================
 * 파일 업로드 | 타겟DB 연결 | 배치폴더 등록 | 저장DB 등록 | ETL 이력 탭.
 * sourceType 'file' | 'db' | 'folder' | 'storage' | 'history', onChange 콜백.
 *
 * [Components]
 * ===========
 * 1. SourceTypeSelector: sourceType, onChange props
 *
 * [Dependencies]
 * =========
 * - React
 */

// 1.
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
        타겟DB 연결
      </button>
      <button
        type="button"
        className={`etl-source-type__tab ${sourceType === 'folder' ? 'etl-source-type__tab--active' : ''}`}
        onClick={() => onChange('folder')}
      >
        배치폴더 등록
      </button>
      <button
        type="button"
        className={`etl-source-type__tab ${sourceType === 'storage' ? 'etl-source-type__tab--active' : ''}`}
        onClick={() => onChange('storage')}
      >
        저장DB 등록
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
