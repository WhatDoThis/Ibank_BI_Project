/**
 * packages/etl/components/PreviewModal.jsx (미리보기 모달)
 * =======================================================
 * GET /api/etl/tables/{id}/preview 결과 표시. 컬럼별 저장 가능 여부 테이블 + 상위 10행 미리보기.
 *
 * [Components]
 * ===========
 * PreviewModal: open, onClose, data, loading props
 *
 * [Dependencies]
 * =========
 * - React (없음, 순수 presentational)
 */

function PreviewModal({ open, onClose, data, loading }) {
  if (!open) return null;

  return (
    <div className="etl-preview-modal__backdrop" onClick={onClose}>
      <div className="etl-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="etl-preview-modal__head">
          <h3 className="etl-preview-modal__title">미리보기</h3>
          <button type="button" className="etl-preview-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="etl-preview-modal__body">
          {loading && <p className="etl-preview-modal__loading">불러오는 중…</p>}
          {!loading && data?.error && (
            <p className="etl-preview-modal__error">{data.message || '원본 파일이 없거나 만료되어 미리보기를 할 수 없습니다.'}</p>
          )}
          {!loading && data && !data.error && (
            <>
              <section className="etl-preview-modal__section">
                <h4 className="etl-preview-modal__section-title">컬럼 저장 가능 여부</h4>
                <div className="etl-preview-modal__table-wrap">
                  <table className="etl-preview-modal__table">
                    <thead>
                      <tr>
                        <th>컬럼명</th>
                        <th>타입</th>
                        <th>저장 가능</th>
                        <th>비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.columns || []).map((col, i) => (
                        <tr key={i}>
                          <td>{col.name}</td>
                          <td>{col.inferred_type || '—'}</td>
                          <td>{col.can_save ? '가능' : '불가'}</td>
                          <td className={`etl-preview-modal__remark ${col.can_save ? '' : 'etl-preview-modal__reason'}`}>
                            {(() => {
                              const reason = col.reason || '';
                              const transform = col.transform_remark || '';
                              if (reason && transform) return <>저장 불가: {reason}. 변환: {transform}</>;
                              if (reason) return reason;
                              if (transform) return <>변환: {transform}</>;
                              return '—';
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="etl-preview-modal__section">
                <h4 className="etl-preview-modal__section-title">저장 후 테이블 미리보기 (최대 10행)</h4>
                <div className="etl-preview-modal__table-wrap">
                  <table className="etl-preview-modal__table">
                    <thead>
                      <tr>
                        {(data.preview_columns || []).map((c, i) => (
                          <th key={i}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.preview_rows || []).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell == null ? '' : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {!loading && !data && <p className="etl-preview-modal__empty">데이터가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}

export default PreviewModal;
