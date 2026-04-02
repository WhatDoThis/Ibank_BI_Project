/**
 * packages/etl/components/FileUploadForm.jsx (파일 업로드 폼)
 * ============================================================
 * 파일 선택, 저장 DB·타겟 테이블(모달에서 테이블명·라벨·설명), 업로드 후 목록에서 적재 실행.
 *
 * [Main Functions]
 * ===========
 * 1. 파일 업로드 → POST /api/etl/upload (target_table, column_mapping 등)
 * 2. 타겟 테이블: 입력란 없음. "타겟 테이블: 미설정/이름" 표시 + "테이블선택 및 컬럼매핑" 버튼으로 모달에서만 설정.
 * 3. 파일 선택 시 targetTable을 파일명 기준으로 자동 설정(모달 새 테이블명 기본값용). 드래그앤드롭·설정요약·수정 버튼.
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js (etl2UploadFile, etl2ListStorageConnections, etl2InferSchema), TargetTableSelectModal, EtlStorageDbSelect
 */

import { useState, useRef, useEffect } from 'react';
import { etl2UploadFile, etl2ListStorageConnections, etl2InferSchema } from '@/packages/etl/api/etlClient.js';
import { getStorageConnectionIdForFormData } from '../utils/storageDb.js';
import EtlStorageDbSelect from './EtlStorageDbSelect.jsx';

import TargetTableSelectModal from './TargetTableSelectModal/index.jsx';
import { ETL_TABLE_LABEL_MAX_LEN, ETL_TABLE_DSCRTN_MAX_LEN } from './TargetTableSelectModal/constants.js';

/** 서버 용량 한도와 동일하게 사용 (config 기본값 50MB). 초과 시 업로드 불가. */
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// 1.
function FileUploadForm({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [rejectedFile, setRejectedFile] = useState(null);
  const [targetTable, setTargetTable] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [tableDscrtn, setTableDscrtn] = useState('');
  const [storageConnectionId, setStorageConnectionId] = useState('');
  const [storageConnections, setStorageConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [targetTableSelectOpen, setTargetTableSelectOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);
  const [pkColumns, setPkColumns] = useState('');
  const [indexDefinitions, setIndexDefinitions] = useState(null);
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
    if (f && f.size > MAX_FILE_SIZE_BYTES) {
      setRejectedFile({ name: f.name, size: f.size });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.alert(`파일 용량이 한도(${MAX_FILE_SIZE_MB}MB)를 초과합니다. 다른 파일을 선택하세요.`);
      return;
    }
    setRejectedFile(null);
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
    const tl0 = tableLabel.trim();
    const td0 = tableDscrtn.trim();
    if (tl0.length > ETL_TABLE_LABEL_MAX_LEN) {
      setError(`테이블 라벨은 최대 ${ETL_TABLE_LABEL_MAX_LEN}자입니다. 테이블선택 모달에서 줄여 주세요.`);
      return;
    }
    if (td0.length > ETL_TABLE_DSCRTN_MAX_LEN) {
      setError(`테이블 설명은 최대 ${ETL_TABLE_DSCRTN_MAX_LEN}자입니다. 테이블선택 모달에서 줄여 주세요.`);
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (targetTable.trim()) form.append('target_table', targetTable.trim());
      if (tableLabel.trim()) form.append('table_label', tableLabel.trim());
      if (tableDscrtn.trim()) form.append('table_dscrtn', tableDscrtn.trim());
      const { append: appendStorageId, value: sid } = getStorageConnectionIdForFormData(storageConnectionId);
      if (appendStorageId && sid != null) form.append('storage_connection_id', String(sid));
      if (columnMapping && Array.isArray(columnMapping) && columnMapping.length > 0) form.append('column_mapping', JSON.stringify(columnMapping));
      if ((pkColumns || '').trim()) form.append('pk_columns', (pkColumns || '').trim());
      if (indexDefinitions && Array.isArray(indexDefinitions) && indexDefinitions.length > 0) form.append('index_definitions', JSON.stringify(indexDefinitions));
      form.append('created_by', 'user');
      const data = await etl2UploadFile(form);
      setResult(data);
      if (onSuccess) onSuccess();
      if (data.etl_table_id) {
        setTargetTable('');
        setTableLabel('');
        setTableDscrtn('');
        setFile(null);
        setColumnMapping(null);
        setPkColumns('');
        setIndexDefinitions(null);
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
            className={`etl-file-form__drop-zone ${rejectedFile ? 'etl-file-form__drop-zone--error' : ''} ${!rejectedFile && dragOver ? 'etl-file-form__drop-zone--over' : ''} ${file ? 'etl-file-form__drop-zone--has' : ''}`}
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
            {rejectedFile && <span className="etl-file-form__drop-badge etl-file-form__drop-badge--error">용량 초과</span>}
            {file && !rejectedFile && <span className="etl-file-form__drop-badge">선택된 파일</span>}
            <span className="etl-file-form__drop-text">
              {rejectedFile
                ? `${rejectedFile.name} — 한도(${MAX_FILE_SIZE_MB}MB) 초과`
                : file
                  ? file.name
                  : (dragOver ? '여기에 놓으세요' : '파일을 여기에 드래그하거나')}
            </span>
            <button type="button" className="etl-file-form__select-btn">
              {rejectedFile ? '다른 파일 선택' : file ? '다른 파일 선택' : '파일 선택'}
            </button>
            <p className="etl-file-form__accept">지원 형식: CSV, Excel(.xlsx/.xls), Parquet / 최대 {MAX_FILE_SIZE_MB}MB</p>
          </div>
        </div>
        <div className="etl-file-form__fields">
          <p className="etl-file-form__step-label"><span className="etl-file-form__step-num etl-file-form__step-num--small" aria-hidden="true">2</span> 저장 위치·테이블 설정</p>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">저장할 DB</label>
            <p className="etl-file-form__hint etl-file-form__hint--above">테이블을 만들 DB를 고르세요. 맨 위 두 줄은 config 내장(main·dash), 아래는 &quot;저장 DB 등록&quot; 탭에서 등록한 연결입니다.</p>
            <EtlStorageDbSelect
              value={storageConnectionId}
              onChange={setStorageConnectionId}
              connections={storageConnections}
              className="etl-file-form__input"
              aria-label="저장할 DB"
            />
          </div>
          <div className="etl-file-form__row">
            <label className="etl-file-form__label">타겟 테이블명</label>
            <p className="etl-file-form__hint etl-file-form__hint--above">저장할 테이블은 아래 버튼으로 선택·매핑하세요. 기존 테이블을 고르거나 새 테이블로 만들 수 있습니다.</p>
            <div className="etl-file-form__target-row">
              <span className="etl-file-form__target-display">타겟 테이블: <strong>{targetTable.trim() || '미설정'}</strong></span>
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
              currentPkColumns={pkColumns}
              currentIndexDefinitions={indexDefinitions || []}
              currentTableLabel={tableLabel}
              currentTableDscrtn={tableDscrtn}
              sourceColumns={sourceColumnsForModal}
              onSelect={(tableName, mapping, pkCols, idxDefs, _t, _a, tm) => {
                setTargetTable(tableName);
                setColumnMapping(mapping && mapping.length > 0 ? mapping : null);
                setPkColumns(pkCols ?? '');
                setIndexDefinitions(idxDefs && idxDefs.length > 0 ? idxDefs : null);
                if (tm) {
                  setTableLabel(tm.table_label != null ? String(tm.table_label) : '');
                  setTableDscrtn(tm.table_dscrtn != null ? String(tm.table_dscrtn) : '');
                }
                setTargetTableSelectOpen(false);
              }}
            />
          )}
          {(targetTable.trim() || (columnMapping && columnMapping.length > 0) || (indexDefinitions && indexDefinitions.length > 0)) && (
            <div className="etl-file-form__row etl-file-form__summary">
              <label className="etl-file-form__label">설정 요약</label>
              <div className="etl-file-form__summary-box">
                {targetTable.trim() && (
                  <p className="etl-file-form__summary-line">
                    <strong>타겟 테이블:</strong> {targetTable.trim()}
                  </p>
                )}
                {(tableLabel.trim() || tableDscrtn.trim()) && (
                  <p className="etl-file-form__summary-line">
                    <strong>라벨·설명:</strong>{' '}
                    {[tableLabel.trim() || null, tableDscrtn.trim() || null].filter(Boolean).join(' — ')}
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
                {pkColumns.trim() && (
                  <p className="etl-file-form__summary-line">
                    <strong>PK:</strong> {pkColumns.trim()}
                  </p>
                )}
                {indexDefinitions && indexDefinitions.length > 0 && (
                  <p className="etl-file-form__summary-line">
                    <strong>인덱스:</strong> {indexDefinitions.length}개
                  </p>
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
