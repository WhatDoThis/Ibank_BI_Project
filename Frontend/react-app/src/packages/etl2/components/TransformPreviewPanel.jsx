/**
 * packages/etl2/components/TransformPreviewPanel.jsx (변환 미리보기 패널)
 * =======================================================================
 * 매핑 모달 하단에서 변환 룰 적용 전/후를 나란히 표시. 미리보기 새로고침 버튼으로만 갱신.
 *
 * [Main]
 * ===========
 * - etlTableId, rules 전달 시 POST /api/etl2/transform/preview 호출
 * - before/after 테이블 나란히, 변경 셀 하이라이트, column_changes 뱃지
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2TransformPreview)
 */

import { useState, useCallback } from 'react';
import { etl2TransformPreview } from '@/shared/api/client';

function TransformPreviewPanel({ etlTableId, rules }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchPreview = useCallback(async () => {
    if (etlTableId == null || etlTableId === '') return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await etl2TransformPreview({ etl_table_id: etlTableId, rules: rules || [], max_rows: 10 });
      setData(res);
    } catch (err) {
      setError(err.message || '미리보기를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [etlTableId, rules]);

  if (etlTableId == null || etlTableId === '') {
    return (
      <div className="etl-transform-preview-panel">
        <button type="button" className="etl-transform-preview-panel__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          미리보기
        </button>
        {open && (
          <p className="etl-transform-preview-panel__hint">ETL 등록 후 미리보기를 사용할 수 있습니다.</p>
        )}
      </div>
    );
  }

  const beforeRows = data?.before ?? [];
  const afterRows = data?.after ?? [];
  const beforeCols = beforeRows.length > 0 ? Object.keys(beforeRows[0]) : [];
  const afterCols = afterRows.length > 0 ? Object.keys(afterRows[0]) : [];
  const allCols = [...new Set([...beforeCols, ...afterCols])];

  const isCellChanged = useCallback((rowIdx, col) => {
    if (!data?.before?.length || !data?.after?.length) return false;
    const b = data.before[rowIdx];
    const a = data.after[rowIdx];
    if (!b || !a) return false;
    const bv = b[col];
    const av = a[col];
    if (bv === av) return false;
    if (bv == null && av == null) return false;
    return true;
  }, [data]);

  const columnChanges = data?.column_changes ?? [];

  return (
    <div className="etl-transform-preview-panel">
      <button type="button" className="etl-transform-preview-panel__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        미리보기 {open ? '접기' : '펼치기'}
      </button>
      {open && (
        <div className="etl-transform-preview-panel__body">
          <div className="etl-transform-preview-panel__actions">
            <button type="button" className="etl-transform-preview-panel__refresh" onClick={fetchPreview} disabled={loading}>
              {loading ? '로딩 중…' : '미리보기 새로고침'}
            </button>
          </div>
          {columnChanges.length > 0 && (
            <div className="etl-transform-preview-panel__badges">
              {columnChanges.map((c) => (
                <span key={c.column} className="etl-transform-preview-panel__badge" title={`changed: ${c.changed_rows}, null: ${c.null_before}→${c.null_after}`}>
                  {c.column}: 변경 {c.changed_rows}{c.null_after > c.null_before ? `, null +${c.null_after - c.null_before}` : ''}
                </span>
              ))}
            </div>
          )}
          {error && <p className="etl-transform-preview-panel__error">{error}</p>}
          {data && (
            <div className="etl-transform-preview-panel__tables">
              <div className="etl-transform-preview-panel__table-wrap">
                <h4 className="etl-transform-preview-panel__table-title">변환 전</h4>
                <div className="etl-transform-preview-panel__scroll">
                  <table className="etl-transform-preview-panel__table">
                    <thead>
                      <tr>
                        {allCols.map((col) => <th key={col}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {beforeRows.map((row, ri) => (
                        <tr key={ri}>
                          {allCols.map((col) => (
                            <td key={col} className={isCellChanged(ri, col) ? 'etl-transform-preview-panel__cell--changed' : ''}>{row[col] != null ? String(row[col]) : '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="etl-transform-preview-panel__table-wrap">
                <h4 className="etl-transform-preview-panel__table-title">변환 후</h4>
                <div className="etl-transform-preview-panel__scroll">
                  <table className="etl-transform-preview-panel__table">
                    <thead>
                      <tr>
                        {allCols.map((col) => <th key={col}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {afterRows.map((row, ri) => (
                        <tr key={ri}>
                          {allCols.map((col) => (
                            <td key={col} className={isCellChanged(ri, col) ? 'etl-transform-preview-panel__cell--changed' : ''}>{row[col] != null ? String(row[col]) : '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TransformPreviewPanel;
