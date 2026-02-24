/**
 * packages/etl/components/FileUploadForm.jsx (파일 업로드 폼)
 * ============================================================
 * 파일 선택, 테이블명·설명 입력, 업로드 후 스키마 표시, 적재 실행은 목록에서. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - 파일 업로드 → POST /api/etl/upload (target_table 있으면 메타 등록)
 * - 레이아웃: 왼쪽 절반 드래그앤드롭 영역(파일 선택 버튼 포함), 오른쪽 타겟 테이블·라벨·설명·업로드 버튼.
 * - 드래그 오버 시 --over(놓으세요 문구·강조 스타일), 파일 선택/드롭 후 --has(선택된 파일 뱃지·녹색 강조). onSuccess: 등록/업로드 성공 시 콜백.
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2UploadFile)
 */

import { useState, useRef, useEffect } from 'react';
import { etl2UploadFile, etl2ListStorageConnections, etl2InferSchema } from '@/shared/api/client';
import TargetTableSelectModal from './TargetTableSelectModal.jsx';

function FileUploadForm({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [targetTable, setTargetTable] = useState('');
  const [labelName, setLabelName] = useState('');
  const [description, setDescription] = useState('');
  const [storageConnectionId, setStorageConnectionId] = useState('');
  const [storageConnections, setStorageConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [targetTableSelectOpen, setTargetTableSelectOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);
  const [sourceColumnsForModal, setSourceColumnsForModal] = useState([]);
  const [inferSchemaLoading, setInferSchemaLoading] = useState(false);
  const fileInputRef = useRef(null);

  function openTargetTableModal() {
    if (file) {
      setInferSchemaLoading(true);
      setError('');
      etl2InferSchema(file)
        .then((data) => {
          setSourceColumnsForModal(data.columns || []);
          setTargetTableSelectOpen(true);
        })
        .catch((err) => {
          setError(err.message || '파일 스키마를 불러오지 못했습니다.');
        })
        .finally(() => setInferSchemaLoading(false));
    } else {
      setSourceColumnsForModal([]);
      setTargetTableSelectOpen(true);
    }
  }

  useEffect(() => {
    etl2ListStorageConnections().then((res) => setStorageConnections(res.storage_connections || [])).catch(() => setStorageConnections([]));
  }, []);

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
      if (storageConnectionId !== '' && storageConnectionId != null) form.append('storage_connection_id', String(storageConnectionId));
      if (columnMapping && Array.isArray(columnMapping) && columnMapping.length > 0) form.append('column_mapping', JSON.stringify(columnMapping));
      form.append('created_by', 'user');
      const data = await etl2UploadFile(form);
      setResult(data);
      if (onSuccess) onSuccess();
      if (data.etl_table_id) {
        setTargetTable('');
        setLabelName('');
        setDescription('');
        setFile(null);
        setColumnMapping(null);
      }
    } catch (err) {
      setError(err.message || '업로드 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="etl-file-form" onSubmit={handleSubmit}>
      <p className="etl-file-form__intro">파일을 선택한 뒤 저장 위치와 테이블명을 정하고 업로드하면, 아래 목록에 등록됩니다. 목록에서 <strong>실행</strong>을 눌러야 실제로 DB에 적재됩니다.</p>
      <div className="etl-file-form__layout">
        <div className="etl-file-form__step-block">
          <span className="etl-file-form__step-num" aria-hidden="true">1</span>
          <div
            className={`etl-file-form__drop-zone ${dragOver ? 'etl-file-form__drop-zone--over' : ''} ${file ? 'etl-file-form__drop-zone--has' : ''}`}
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
            {file && <span className="etl-file-form__drop-badge">선택된 파일</span>}
            <span className="etl-file-form__drop-text">
              {file ? file.name : (dragOver ? '여기에 놓으세요' : '파일을 여기에 드래그하거나')}
            </span>
            <button type="button" className="etl-file-form__select-btn">
              {file ? '다른 파일 선택' : '파일 선택'}
            </button>
            <p className="etl-file-form__accept">지원 형식: CSV, Excel(.xlsx/.xls), Parquet / 최대 50MB</p>
          </div>
        </div>
        <div className="etl-file-form__fields">
          <p className="etl-file-form__step-label"><span className="etl-file-form__step-num etl-file-form__step-num--small" aria-hidden="true">2</span> 저장 위치·테이블 설정</p>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">저장할 DB</label>
            <p className="etl-file-form__hint etl-file-form__hint--above">테이블을 만들 DB를 선택하세요. 기본 DB 또는 &quot;저장 DB 등록&quot; 탭에서 등록한 DB를 고를 수 있습니다.</p>
            <select
              value={storageConnectionId}
              onChange={(e) => setStorageConnectionId(e.target.value)}
              className="etl-file-form__input"
            >
              <option value="">기본 DB (ibank_db)</option>
              {storageConnections.map((c) => (
                <option key={c.storage_connection_id} value={String(c.storage_connection_id)}>{c.connection_name}</option>
              ))}
            </select>
          </div>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">타겟 테이블명</label>
            <p className="etl-file-form__hint etl-file-form__hint--above">저장할 테이블 이름입니다. 파일을 선택하면 파일명으로 자동 채워집니다. 기존 테이블을 쓰거나 컬럼을 맞추려면 &quot;테이블선택 및 컬럼매핑&quot;을 누르세요.</p>
            <div className="etl-file-form__input-group">
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder="예: my_uploaded_table"
                className="etl-file-form__input"
              />
              <button
                type="button"
                className="etl-file-form__target-select-btn"
                onClick={openTargetTableModal}
                disabled={inferSchemaLoading}
              >
                {inferSchemaLoading ? '스키마 확인 중…' : '테이블선택 및 컬럼매핑'}
              </button>
            </div>
          </div>
          {targetTableSelectOpen && (
            <TargetTableSelectModal
              open={targetTableSelectOpen}
              onClose={() => setTargetTableSelectOpen(false)}
              storageConnectionId={storageConnectionId}
              currentTargetTable={targetTable}
              currentColumnMapping={columnMapping || []}
              sourceColumns={sourceColumnsForModal}
              onSelect={(tableName, mapping) => {
                setTargetTable(tableName);
                setColumnMapping(mapping && mapping.length > 0 ? mapping : null);
                setTargetTableSelectOpen(false);
              }}
            />
          )}
          {(targetTable.trim() || (columnMapping && columnMapping.length > 0)) && (
            <div className="etl-file-form__row etl-file-form__summary">
              <label className="etl-file-form__label">설정 요약</label>
              <div className="etl-file-form__summary-box">
                {targetTable.trim() && (
                  <p className="etl-file-form__summary-line">
                    <strong>타겟 테이블:</strong> {targetTable.trim()}
                  </p>
                )}
                {columnMapping && columnMapping.length > 0 && (
                  <>
                    <p className="etl-file-form__summary-line">
                      <strong>컬럼 매핑 ({columnMapping.length}개):</strong>
                    </p>
                    <ul className="etl-file-form__mapping-list">
                      {columnMapping.map((m, i) => (
                        <li key={i}>
                          {m.source || '(소스)'} → {m.target || '(타겟)'}
                          {m.type && <span className="etl-file-form__mapping-type"> ({m.type})</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <button
                  type="button"
                  className="etl-file-form__summary-edit"
                  onClick={openTargetTableModal}
                  disabled={inferSchemaLoading}
                >
                  수정
                </button>
              </div>
            </div>
          )}
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
            <div className="etl-file-form__result" role="status">
              <p className="etl-file-form__result-main">등록되었습니다.</p>
              {result.etl_table_id && (
                <p className="etl-file-form__result-next">아래 <strong>등록된 ETL 목록</strong>에서 이 행의 <strong>실행</strong> 버튼을 누르면 DB에 적재됩니다.</p>
              )}
              {result.columns?.length > 0 && (
                <p className="etl-file-form__result-cols">추론된 컬럼: {result.columns.map((c) => `${c.name} (${c.inferred_type})`).join(', ')}</p>
              )}
            </div>
          )}
          <p className="etl-file-form__step-label etl-file-form__step-label--submit"><span className="etl-file-form__step-num etl-file-form__step-num--small" aria-hidden="true">3</span> 등록하기</p>
          <button type="submit" className="etl-file-form__submit" disabled={loading}>
            {loading ? '업로드 중…' : '업로드'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default FileUploadForm;
