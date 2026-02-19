/**
 * packages/etl/components/FileUploadForm.jsx (파일 업로드 폼)
 * ============================================================
 * 파일 선택, 테이블명·설명 입력, 업로드 후 스키마 표시, 적재 실행은 목록에서. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - 파일 업로드 → POST /api/etl/upload (target_table 있으면 메타 등록)
 * - 레이아웃: 왼쪽 절반 드래그앤드롭 영역(파일 선택 버튼 포함), 오른쪽 타겟 테이블·라벨·설명·업로드 버튼.
 * - 파일 선택 시 타겟 테이블명 자동 채움. onSuccess: 등록/업로드 성공 시 콜백.
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etlUploadFile)
 */

import { useState, useRef } from 'react';
import { etlUploadFile } from '@/shared/api/client';

function FileUploadForm({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [targetTable, setTargetTable] = useState('');
  const [labelName, setLabelName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function setFileFromInput(f) {
    setFile(f);
    if (f && (f.name || '').trim()) {
      const base = (f.name || '').trim().replace(/\.[^/.]+$/, '') || f.name.trim();
      setTargetTable(base);
    }
  }

  function onFileChange(e) {
    setFileFromInput(e.target.files?.[0] || null);
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
    if (f) setFileFromInput(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('파일을 선택하세요.');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (targetTable.trim()) form.append('target_table', targetTable.trim());
      if (labelName.trim()) form.append('label_name', labelName.trim());
      if (description.trim()) form.append('description', description.trim());
      form.append('created_by', 'user');
      const data = await etlUploadFile(form);
      setResult(data);
      if (onSuccess) onSuccess();
      if (data.etl_table_id) {
        setTargetTable('');
        setLabelName('');
        setDescription('');
        setFile(null);
      }
    } catch (err) {
      setError(err.message || '업로드 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="etl-file-form" onSubmit={handleSubmit}>
      <div className="etl-file-form__layout">
        <div
          className={`etl-file-form__drop-zone ${dragOver ? 'etl-file-form__drop-zone--over' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.parquet"
            onChange={onFileChange}
            className="etl-file-form__input--hidden"
            aria-hidden
          />
          <span className="etl-file-form__drop-text">
            {file ? file.name : '파일을 여기에 드래그하거나'}
          </span>
          <button type="button" className="etl-file-form__select-btn">
            파일 선택
          </button>
          <p className="etl-file-form__accept">지원 형식: CSV, Excel(.xlsx/.xls), Parquet / 최대 50MB</p>
        </div>
        <div className="etl-file-form__fields">
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">타겟 테이블명 (파일 선택 시 자동 채움)</label>
            <input
              type="text"
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              placeholder="예: my_uploaded_table"
              className="etl-file-form__input"
            />
          </div>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">라벨명 (선택)</label>
            <input
              type="text"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder="표시용 라벨"
              className="etl-file-form__input"
            />
          </div>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">설명 (선택)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="테이블 설명"
              className="etl-file-form__input"
            />
          </div>
          {error && <p className="etl-file-form__error">{error}</p>}
          {result && (
            <div className="etl-file-form__result">
              <p>업로드 완료. 파일 유형: {result.file_type}</p>
              {result.columns?.length > 0 && (
                <p>추론된 컬럼: {result.columns.map((c) => `${c.name} (${c.inferred_type})`).join(', ')}</p>
              )}
              {result.etl_table_id && <p>ETL 테이블 ID: {result.etl_table_id} — 아래 목록에서 &quot;실행&quot;으로 적재하세요.</p>}
            </div>
          )}
          <button type="submit" className="etl-file-form__submit" disabled={loading}>
            {loading ? '업로드 중…' : '업로드'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default FileUploadForm;
