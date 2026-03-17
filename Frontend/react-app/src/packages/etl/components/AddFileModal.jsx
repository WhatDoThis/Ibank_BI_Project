/**
 * packages/etl/components/AddFileModal.jsx (데이터 추가 모달)
 * ==========================================================
 * 등록된 ETL의 타겟 테이블에 추가 적재. 단일 파일 또는 ZIP(여러 파일) 선택 → PK 검증 후 업서트 Job 등록.
 *
 * [Main Functions]
 * ===========
 * 1. 단일 파일: add-file. ZIP: add-files-zip → job_ids, skipped_files 반환. 건너뛴 파일 목록 표시·복사·다운로드.
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2AddFileToTable, etl2AddFilesZipToTable)
 */

import { useState, useRef } from 'react';
import { etl2AddFileToTable, etl2AddFilesZipToTable } from '@/shared/api/client';

const ACCEPT_SINGLE = '.csv,.xlsx,.xls,.parquet';
const ACCEPT_ZIP = '.zip';

/** 단일 파일 용량 한도(MB). 서버 etl_limits.max_file_size_mb 기본값과 동일. */
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const REASON_LABELS = {
  file_too_large: '용량 초과',
  unsupported_format: '미지원 형식',
  schema_or_pk_failed: '스키마/PK 검증 실패',
};

// 1.
function AddFileModal({ etlTableId, targetTable, description, onClose, onSuccess }) {
  const [mode, setMode] = useState('single'); // 'single' | 'zip'
  const [file, setFile] = useState(null);
  const [rejectedFile, setRejectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [zipResult, setZipResult] = useState(null); // { message, enqueued_count, skipped_files }
  const fileInputRef = useRef(null);

  function setFileSafe(f) {
    if (mode === 'single' && f && f.size > MAX_FILE_SIZE_BYTES) {
      setRejectedFile({ name: f.name, size: f.size });
      setFile(null);
      setError('');
      setZipResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.alert(`파일 용량이 한도(${MAX_FILE_SIZE_MB}MB)를 초과합니다. 다른 파일을 선택하세요.`);
      return;
    }
    setRejectedFile(null);
    setFile(f);
    setError('');
    setZipResult(null);
  }

  function onFileChange(e) {
    setFileSafe(e.target.files?.[0] || null);
  }

  function onModeChange(m) {
    setMode(m);
    setFile(null);
    setRejectedFile(null);
    setZipResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) setFileSafe(f);
  }

  function copySkippedList() {
    if (!zipResult?.skipped_files?.length) return;
    const text = zipResult.skipped_files
      .map((s) => `${s.filename}${s.reason ? ` (${REASON_LABELS[s.reason] || s.reason})` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {}, () => {});
  }

  function downloadSkippedList() {
    if (!zipResult?.skipped_files?.length) return;
    const text = zipResult.skipped_files
      .map((s) => `${s.filename}${s.reason ? ` (${REASON_LABELS[s.reason] || s.reason})` : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '건너뛴_파일_목록.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('파일을 선택하거나 드래그해 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    setZipResult(null);
    try {
      if (mode === 'zip') {
        const result = await etl2AddFilesZipToTable(etlTableId, file);
        if (onSuccess) onSuccess(result);
        setZipResult({
          message: result.message,
          enqueued_count: result.enqueued_count ?? 0,
          skipped_files: result.skipped_files ?? [],
        });
      } else {
        const result = await etl2AddFileToTable(etlTableId, file);
        if (onSuccess) onSuccess(result);
        onClose();
      }
    } catch (err) {
      const msg = err?.message || '추가 적재 등록 실패';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const accept = mode === 'zip' ? ACCEPT_ZIP : ACCEPT_SINGLE;
  const showZipResult = zipResult != null;

  return (
    <div className="etl-add-file-modal" role="dialog" aria-modal="true" aria-labelledby="etl-add-file-title">
      <div className="etl-add-file-modal__backdrop" onClick={onClose} />
      <div className="etl-add-file-modal__box">
        <div className="etl-add-file-modal__head">
          <h3 id="etl-add-file-title">데이터 추가</h3>
          <button type="button" className="etl-add-file-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="etl-add-file-modal__info">
          <span className="etl-add-file-modal__target">{targetTable}</span>
          {description && <span className="etl-add-file-modal__desc-label">{description}</span>}
        </div>
        <p className="etl-add-file-modal__hint">같은 테이블에 추가합니다. PK 일치 시 업데이트, 없으면 삽입됩니다.</p>

        {showZipResult ? (
          <div className="etl-add-file-modal__result">
            <p className="etl-add-file-modal__result-msg">{zipResult.message}</p>
            {zipResult.skipped_files?.length > 0 && (
              <div className="etl-add-file-modal__skipped">
                <p className="etl-add-file-modal__skipped-title">건너뛴 파일 (정리 후 다시 업로드하세요)</p>
                <ul className="etl-add-file-modal__skipped-list">
                  {zipResult.skipped_files.map((s, i) => (
                    <li key={i}>
                      {s.filename}
                      {s.reason && <span className="etl-add-file-modal__skipped-reason"> ({REASON_LABELS[s.reason] || s.reason})</span>}
                    </li>
                  ))}
                </ul>
                <div className="etl-add-file-modal__skipped-actions">
                  <button type="button" className="etl-add-file-modal__copy-btn" onClick={copySkippedList}>
                    목록 복사
                  </button>
                  <button type="button" className="etl-add-file-modal__download-btn" onClick={downloadSkippedList}>
                    텍스트로 다운로드
                  </button>
                </div>
              </div>
            )}
            <div className="etl-add-file-modal__actions">
              <button type="button" className="etl-add-file-modal__submit" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="etl-add-file-modal__form">
            <div className="etl-add-file-modal__mode">
              <label className="etl-add-file-modal__mode-option">
                <input
                  type="radio"
                  name="add-file-mode"
                  checked={mode === 'single'}
                  onChange={() => onModeChange('single')}
                />
                <span>단일 파일</span>
              </label>
              <label className="etl-add-file-modal__mode-option">
                <input
                  type="radio"
                  name="add-file-mode"
                  checked={mode === 'zip'}
                  onChange={() => onModeChange('zip')}
                />
                <span>ZIP (여러 파일, 파일명 순서대로 적재)</span>
              </label>
            </div>
            <div
              className={`etl-add-file-modal__drop ${rejectedFile ? 'etl-add-file-modal__drop--error' : ''} ${!rejectedFile && dragOver ? 'etl-add-file-modal__drop--over' : ''} ${file ? 'etl-add-file-modal__drop--has' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={onFileChange}
                className="etl-add-file-modal__input--hidden"
                aria-hidden
              />
              {rejectedFile ? (
                <>
                  <span className="etl-add-file-modal__drop-badge etl-add-file-modal__drop-badge--error">용량 초과</span>
                  <span className="etl-add-file-modal__drop-name">{rejectedFile.name} — 한도({MAX_FILE_SIZE_MB}MB) 초과</span>
                </>
              ) : file ? (
                <span className="etl-add-file-modal__drop-name">{file.name}</span>
              ) : (
                <>
                  <span className="etl-add-file-modal__drop-text">파일을 여기에 드래그하거나</span>
                  <span className="etl-add-file-modal__drop-btn">파일 선택</span>
                </>
              )}
            </div>
            <p className="etl-add-file-modal__accept">
              {mode === 'zip'
                ? 'ZIP 해제 시 CSV, Excel(.xlsx/.xls), Parquet 확장자만 지원. 각 파일 최대 50MB(한도 초과 시 해당 파일 Skip), ZIP 파일 최대 2GB(한도 초과 시 데이터 추가 실패)'
                : '지원 형식: CSV, Excel(.xlsx/.xls), Parquet / 최대 50MB'}
            </p>

            {error && <p className="etl-add-file-modal__error">{error}</p>}
            <div className="etl-add-file-modal__actions">
              <button type="button" className="etl-add-file-modal__cancel" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="etl-add-file-modal__submit" disabled={!file || loading}>
                {loading ? '등록 중…' : '추가 적재'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddFileModal;
