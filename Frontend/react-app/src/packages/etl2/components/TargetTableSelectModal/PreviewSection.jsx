/**
 * PreviewSection.jsx (변환 미리보기 패널)
 * ================================================================================
 * etl2TransformPreview 결과 10행·실패 N건 표시.
 *
 * [Main Functions]
 * ===========
 * - PreviewSection: previewData, previewError
 *
 * [Dependencies]
 * =========
 * - React
 */

export function PreviewSection({ previewData, previewError }) {
  if (!previewData && !previewError) return null;
  return (
    <div className="etl-target-select-modal__preview-panel">
      {previewError && <p className="etl-target-select-modal__preview-error" role="alert">{previewError}</p>}
      {previewData && (
        <>
          <h4 className="etl-target-select-modal__preview-title">변환 미리보기</h4>
          <div className="etl-target-select-modal__preview-table-wrap">
            <table className="etl-target-select-modal__preview-table">
              <thead>
                <tr>
                  {(previewData.preview_columns || []).map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(previewData.preview_rows || []).map((row, ri) => (
                  <tr key={ri}>
                    {(row || []).map((cell, ci) => (
                      <td key={ci}>{cell != null ? String(cell) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.transform_failed_count != null && previewData.transform_failed_count > 0 && (
            <p className="etl-target-select-modal__preview-failed">변환 실패 {previewData.transform_failed_count}건</p>
          )}
        </>
      )}
    </div>
  );
}
