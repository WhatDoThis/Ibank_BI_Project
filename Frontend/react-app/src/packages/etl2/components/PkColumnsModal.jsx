/**
 * packages/etl/components/PkColumnsModal.jsx (PK 컬럼 설정 모달)
 * ==============================================================
 * 파일 ETL 실행 전 PK 컬럼을 선택적으로 설정. 미리보기 API로 컬럼 목록 로드 후 체크박스로 선택.
 * 설정 시 CREATE TABLE에 PRIMARY KEY 반영, 비우면 PK 미설정.
 *
 * [Main Functions]
 * ===========
 * - open 시 etl2PreviewTable(etl_table_id)로 컬럼 목록 로드
 * - 컬럼 체크박스로 PK 선택, PATCH /api/etl/tables/:id (pk_columns) → onSuccess
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2UpdateTable, etl2PreviewTable)
 */

import { useState, useEffect, useCallback } from 'react';
import { etl2UpdateTable, etl2PreviewTable } from '@/shared/api/client';

function parsePkColumns(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function PkColumnsModal({ open, onClose, etlTableId, targetTable, currentPkColumns, onSuccess }) {
  const [columnNames, setColumnNames] = useState([]);
  const [selected, setSelected] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fallbackText, setFallbackText] = useState('');

  const loadColumns = useCallback(async () => {
    if (!etlTableId) return;
    setColumnsLoading(true);
    setColumnsError('');
    try {
      const res = await etl2PreviewTable(etlTableId);
      const cols = (res.columns || []).map((c) => (c && c.name) ? String(c.name).trim() : '').filter(Boolean);
      setColumnNames(cols);
      if (cols.length === 0) {
        setColumnsError('컬럼 정보가 없습니다. 파일을 업로드했거나 소스가 등록된 테이블에서만 PK를 설정할 수 있습니다.');
      }
    } catch (err) {
      setColumnsError(err.message || '컬럼 목록을 불러오지 못했습니다.');
      setColumnNames([]);
    } finally {
      setColumnsLoading(false);
    }
  }, [etlTableId]);

  useEffect(() => {
    if (open && etlTableId) {
      loadColumns();
      setSelected(parsePkColumns(currentPkColumns));
      setFallbackText((currentPkColumns || '').trim());
      setSubmitError('');
    }
  }, [open, etlTableId, currentPkColumns, loadColumns]);

  const toggleColumn = (name) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  if (!open) return null;

  const canUseCheckboxes = columnNames.length > 0 && !columnsLoading;
  const valueToSubmit = canUseCheckboxes
    ? columnNames.filter((n) => selected.includes(n)).join(',').trim() || null
    : (fallbackText.trim() || null);

  function handleReset() {
    setSelected([]);
    setFallbackText('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError('');
    try {
      await etl2UpdateTable(etlTableId, { pk_columns: valueToSubmit ?? '' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(err.message || '저장 실패');
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="etl-pk-modal" role="dialog" aria-modal="true" aria-labelledby="etl-pk-modal-title">
      <div className="etl-pk-modal__backdrop" onClick={onClose} />
      <div className="etl-pk-modal__box">
        <div className="etl-pk-modal__head">
          <h3 id="etl-pk-modal-title">PK 컬럼 설정</h3>
          <button type="button" className="etl-pk-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <p className="etl-pk-modal__hint">
          실행 시 테이블 생성에 반영됩니다. PK로 쓸 컬럼을 선택하세요. (파일: 선택한 컬럼만 PK, DB full: 소스 PK 자동 반영)
        </p>
        {targetTable && <p className="etl-pk-modal__target">타겟 테이블: {targetTable}</p>}
        <form onSubmit={handleSubmit} className="etl-pk-modal__form">
          {columnsLoading && (
            <p className="etl-pk-modal__loading">컬럼 목록 불러오는 중…</p>
          )}
          {!columnsLoading && columnsError && (
            <p className="etl-pk-modal__error">{columnsError}</p>
          )}
          {canUseCheckboxes && (
            <>
              <span className="etl-pk-modal__label">PK로 사용할 컬럼 선택</span>
              <div className="etl-pk-modal__columns" role="group" aria-label="PK 컬럼 선택">
                {columnNames.map((name) => (
                  <label key={name} className="etl-pk-modal__checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() => toggleColumn(name)}
                      className="etl-pk-modal__checkbox"
                    />
                    <span className="etl-pk-modal__checkbox-label">{name}</span>
                  </label>
                ))}
              </div>
              {selected.length > 0 && (
                <p className="etl-pk-modal__selected-hint">선택: {columnNames.filter((n) => selected.includes(n)).join(', ')}</p>
              )}
            </>
          )}
          {!columnsLoading && !canUseCheckboxes && (
            <>
              <p className="etl-pk-modal__selected-hint">컬럼 목록을 불러올 수 없을 때만 아래 입력을 사용하세요.</p>
              <label className="etl-pk-modal__label">PK 컬럼 (쉼표 구분, 직접 입력)</label>
              <input
                type="text"
                className="etl-pk-modal__input"
                value={fallbackText}
                onChange={(e) => setFallbackText(e.target.value)}
                placeholder="예: id 또는 col1, col2"
                autoComplete="off"
              />
            </>
          )}
          {submitError && <p className="etl-pk-modal__error">{submitError}</p>}
          <div className="etl-pk-modal__actions">
            <button type="button" className="etl-pk-modal__reset" onClick={handleReset}>초기화</button>
            <button type="button" className="etl-pk-modal__cancel" onClick={onClose}>취소</button>
            <button type="submit" className="etl-pk-modal__submit" disabled={submitLoading}>
              {submitLoading ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PkColumnsModal;
