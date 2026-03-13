/**
 * PatternSelectModalFile.jsx (파일 패턴 선택 모달)
 * =================================================
 * 09_ETL_SFTP_Connection Phase 2. 폴더 연결 기준 패턴 목록 조회 후 테이블에 표시,
 * 행별 [선택] 또는 직접 입력으로 패턴 선택 시 onSelect(pattern) 호출.
 *
 * [Main Functions]
 * ===========
 * 1. open + folderConnectionId 시 batchListFolderPatterns 호출, 로딩/에러 처리
 * 2. 테이블: 패턴, 파일 수, 최신 TS, 최고 TS, 확장자 컬럼, 행별 [선택] 버튼
 * 3. 직접 입력: input + [선택] → onSelect(trim값) 후 onClose
 *
 * [Props]
 * =====
 * 1. open: boolean
 * 2. onClose: () => void
 * 3. folderConnectionId: number | null
 * 4. onSelect: (pattern: string) => void
 *
 * [Dependencies]
 * =========
 * - React (useState, useEffect)
 * - @/shared/api/client (batchListFolderPatterns)
 * - etl.css (etl-db-form__*, etl-add-file-modal__* 스타일)
 */

import { useState, useEffect } from 'react';
import { batchListFolderPatterns } from '@/shared/api/client';
import '../etl.css';

// 1.
function PatternSelectModalFile({ open, onClose, folderConnectionId, onSelect }) {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [directInput, setDirectInput] = useState('');

  useEffect(() => {
    if (!open || folderConnectionId == null) {
      setPatterns([]);
      setError('');
      setDirectInput('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setPatterns([]);
    batchListFolderPatterns(folderConnectionId)
      .then((data) => {
        if (cancelled) return;
        setPatterns(Array.isArray(data?.patterns) ? data.patterns : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || '패턴 목록 조회 실패');
        setPatterns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, folderConnectionId]);

  function handleSelectPattern(pattern) {
    if (pattern == null || String(pattern).trim() === '') return;
    const trimmed = String(pattern).trim();
    if (onSelect) onSelect(trimmed);
    onClose();
  }

  function handleDirectSelect() {
    handleSelectPattern(directInput);
  }

  if (!open) return null;

  return (
    <div className="etl-add-file-modal" role="dialog" aria-modal="true" aria-labelledby="pattern-select-modal-title">
      <div
        className="etl-add-file-modal__backdrop"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="닫기"
      />
      <div className="etl-add-file-modal__box" style={{ maxWidth: '720px' }}>
        <div className="etl-add-file-modal__head">
          <h3 id="pattern-select-modal-title">파일 패턴 선택</h3>
          <button
            type="button"
            className="etl-add-file-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: '4px' }}>
          {loading && (
            <p className="etl-db-form__muted">패턴 목록을 불러오는 중…</p>
          )}
          {error && (
            <p className="etl-db-form__error">{error}</p>
          )}
          {!loading && !error && patterns.length > 0 && (
            <div className="etl-db-form__table-wrap">
              <table className="etl-db-form__table">
                <thead>
                  <tr>
                    <th>패턴</th>
                    <th>파일 수</th>
                    <th>최신</th>
                    <th>최고</th>
                    <th>확장자</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((row, idx) => (
                    <tr key={row.pattern ?? idx}>
                      <td>{row.pattern ?? '-'}</td>
                      <td>{row.file_count ?? 0}</td>
                      <td>{row.latest_ts ?? '-'}</td>
                      <td>{row.oldest_ts ?? '-'}</td>
                      <td>{Array.isArray(row.extensions) ? row.extensions.join(', ') : (row.extensions ?? '-')}</td>
                      <td>
                        <button
                          type="button"
                          className="etl-db-form__btn etl-db-form__btn--primary etl-db-form__btn--sm"
                          onClick={() => handleSelectPattern(row.pattern)}
                        >
                          선택
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && patterns.length === 0 && folderConnectionId != null && (
            <p className="etl-db-form__muted">조회된 패턴이 없습니다. 직접 입력하거나, 폴더에 _ib_ 형식 파일이 있는지 확인하세요.</p>
          )}
          <div className="etl-db-form__section" style={{ marginTop: '16px' }}>
            <div className="etl-db-form__heading">직접 입력</div>
            <div className="etl-db-form__row--inline" style={{ marginTop: '8px' }}>
              <label className="etl-db-form__label" htmlFor="pattern-direct-input">패턴</label>
              <input
                id="pattern-direct-input"
                type="text"
                className="etl-db-form__input"
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                placeholder="예: sales_data"
                style={{ flex: '1 1 200px' }}
              />
              <button
                type="button"
                className="etl-db-form__btn etl-db-form__btn--primary"
                onClick={handleDirectSelect}
                disabled={!directInput?.trim()}
              >
                선택
              </button>
            </div>
          </div>
        </div>
        <div className="etl-add-file-modal__actions" style={{ padding: '12px 24px 24px' }}>
          <button type="button" className="etl-add-file-modal__cancel" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default PatternSelectModalFile;
