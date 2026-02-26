/**
 * BatchJobFormFile.jsx (배치 Job 등록 폼)
 * =========================================
 * 09_ETL_SFTP_Connection. 흐름: 폴더 연결 → 저장 DB → 파일 패턴(폴더 내 _ib_ 정의) → 타겟 테이블·PK → Job 이름·주기.
 * 폴더 선택 시 해당 폴더의 파일 패턴 목록 셀렉트, 타겟 테이블은 저장 DB 기준 목록 또는 직접 입력, PK는 컬럼 가져와서 선택 또는 직접 입력.
 *
 * [Main Functions]
 * ===========
 * - 폴더 연결/저장 DB: refreshKey 변경 시 목록 재조회(즉시 반영)
 * - 폴더 선택 시 batchListFolderPatterns로 패턴 셀렉트 채움, 선택 시 file_pattern·타겟테이블 제안
 * - batchGetFolderColumns로 패턴 기준 최초 1건 컬럼 조회 후 PK 체크박스 선택
 * - [등록] → batchCreateJob, onSuccess 콜백
 *
 * [Props]
 * =====
 * - onSuccess: () => void — 등록 성공 시 콜백
 * - refreshKey: number — 변경 시 폴더/저장 DB 목록 재조회
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListFolderConnections, etl2ListStorageConnections, batchListFolderPatterns, batchGetFolderColumns, batchCreateJob)
 * - etl.css (etl-db-form, etl-db-form__message--warning)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  batchListFolderConnections,
  etl2ListStorageConnections,
  batchListFolderPatterns,
  batchGetFolderColumns,
  batchListTargetTables,
  batchValidateTarget,
  batchCreateJob
} from '@/shared/api/client';
import '../etl.css';

const INTERVAL_MIN = 10;
const INTERVAL_MAX = 1440;
const INTERVAL_DEFAULT = 60;

function BatchJobFormFile({ onSuccess, refreshKey = 0 }) {
  const [folderConnections, setFolderConnections] = useState([]);
  const [storageConnections, setStorageConnections] = useState([]);
  const [folderConnectionId, setFolderConnectionId] = useState('');
  const [patternOptions, setPatternOptions] = useState([]);
  const [patternLoading, setPatternLoading] = useState(false);
  const [job_name, setJob_name] = useState('');
  const [file_pattern, setFile_pattern] = useState('');
  const [storage_connection_id, setStorage_connection_id] = useState('');
  const [targetTables, setTargetTables] = useState([]);
  const [targetTableSelect, setTargetTableSelect] = useState('');
  const [target_table, setTarget_table] = useState('');
  const [pk_columns, setPk_columns] = useState('');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [pkSelected, setPkSelected] = useState({});
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [interval_minutes, setInterval_minutes] = useState(INTERVAL_DEFAULT);
  const [is_active, setIs_active] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLists = useCallback(() => {
    Promise.all([batchListFolderConnections(), etl2ListStorageConnections()])
      .then(([folders, storages]) => {
        setFolderConnections(Array.isArray(folders) ? folders : []);
        const list = storages?.storage_connections ?? (Array.isArray(storages) ? storages : []);
        setStorageConnections(list);
      })
      .catch(() => {
        setFolderConnections([]);
        setStorageConnections([]);
      });
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists, refreshKey]);

  const sidForTarget = (storage_connection_id === '' || storage_connection_id == null) ? null : Number(storage_connection_id);
  useEffect(() => {
    if (sidForTarget !== null && Number.isNaN(sidForTarget)) {
      setTargetTables([]);
      return;
    }
    batchListTargetTables(sidForTarget)
      .then((res) => setTargetTables(Array.isArray(res?.tables) ? res.tables : []))
      .catch(() => setTargetTables([]));
  }, [sidForTarget]);

  const selectedFolderId = folderConnectionId === '' ? null : Number(folderConnectionId);

  useEffect(() => {
    if (selectedFolderId == null) {
      setPatternOptions([]);
      setFile_pattern('');
      return;
    }
    setPatternLoading(true);
    batchListFolderPatterns(selectedFolderId)
      .then((res) => {
        const list = res?.patterns ?? [];
        setPatternOptions(list);
        if (list.length === 1 && !file_pattern) setFile_pattern(list[0].pattern || '');
      })
      .catch(() => setPatternOptions([]))
      .finally(() => setPatternLoading(false));
  }, [selectedFolderId]);

  useEffect(() => {
    setAvailableColumns([]);
    setPkSelected({});
  }, [file_pattern, selectedFolderId]);

  function handlePatternChange(e) {
    const v = e.target.value;
    setFile_pattern(v);
    if (v && !targetTableSelect && !target_table) setTarget_table(v);
  }

  const effectiveTargetTable = (targetTableSelect || target_table || '').trim();

  async function handleLoadColumns() {
    if (!selectedFolderId || !file_pattern?.trim()) return;
    setColumnsLoading(true);
    setAvailableColumns([]);
    try {
      const res = await batchGetFolderColumns(selectedFolderId, file_pattern.trim());
      const cols = res?.columns ?? [];
      setAvailableColumns(cols);
      const next = {};
      (pk_columns || '').split(',').forEach((c) => {
        const k = c.trim();
        if (k) next[k] = true;
      });
      setPkSelected(next);
    } catch {
      setAvailableColumns([]);
    } finally {
      setColumnsLoading(false);
    }
  }

  function togglePkColumn(col) {
    setPkSelected((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      const list = Object.entries(next).filter(([, on]) => on).map(([k]) => k);
      setPk_columns(list.join(', '));
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const fid = folderConnectionId === '' ? null : Number(folderConnectionId);
    if (fid == null || Number.isNaN(fid)) {
      setError('폴더 연결을 선택하세요.');
      return;
    }
    if (!job_name?.trim()) {
      setError('Job 이름을 입력하세요.');
      return;
    }
    if (!file_pattern?.trim()) {
      setError('파일 패턴을 선택하거나 입력하세요.');
      return;
    }
    const targetTableFinal = (targetTableSelect || target_table || '').trim();
    if (!targetTableFinal) {
      setError('타겟 테이블을 선택하거나 새 테이블명을 입력하세요.');
      return;
    }
    const sid = (storage_connection_id === '' || storage_connection_id == null) ? null : Number(storage_connection_id);
    if (sid !== null && Number.isNaN(sid)) {
      setError('저장 DB를 선택하세요.');
      return;
    }
    const interval = Number(interval_minutes);
    if (Number.isNaN(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) {
      setError(`실행 주기는 ${INTERVAL_MIN}~${INTERVAL_MAX}분 사이로 입력하세요.`);
      return;
    }
    setLoading(true);
    if (targetTableSelect) {
      try {
        const validation = await batchValidateTarget({
          folder_connection_id: fid,
          storage_connection_id: sid ?? undefined,
          file_pattern: file_pattern.trim(),
          target_table: targetTableFinal
        });
        if (!validation.valid) {
          setError(validation.message || '기존 테이블에 적재할 수 없습니다.');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError(err?.message || '타겟 검증 실패');
        setLoading(false);
        return;
      }
    }
    const body = {
      folder_connection_id: fid,
      job_name: job_name.trim(),
      file_pattern: file_pattern.trim(),
      ...(sid != null && { storage_connection_id: sid }),
      target_table: targetTableFinal,
      pk_columns: pk_columns?.trim() || null,
      interval_minutes: interval,
      is_active
    };
    batchCreateJob(body)
      .then(() => {
        setFolderConnectionId('');
        setJob_name('');
        setFile_pattern('');
        setStorage_connection_id('');
        setTargetTableSelect('');
        setTarget_table('');
        setPk_columns('');
        setAvailableColumns([]);
        setPkSelected({});
        setInterval_minutes(INTERVAL_DEFAULT);
        setIs_active(true);
        if (onSuccess) onSuccess();
      })
      .catch((err) => {
        setError(err?.message || '배치 Job 등록 실패');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className="etl-db-form">
      <section className="etl-db-form__section etl-db-form__section--card">
        <h3 className="etl-db-form__heading">배치 Job 등록</h3>
        <form onSubmit={handleSubmit} className="etl-db-form__connect-form">
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">폴더 연결</label>
            <select
              className="etl-db-form__input"
              value={folderConnectionId}
              onChange={(e) => setFolderConnectionId(e.target.value)}
            >
              <option value="">선택</option>
              {folderConnections.map((fc) => (
                <option key={fc.folder_connection_id} value={fc.folder_connection_id}>
                  {fc.connection_name || `연결 #${fc.folder_connection_id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">저장 DB</label>
            <select
              className="etl-db-form__input"
              value={storage_connection_id}
              onChange={(e) => setStorage_connection_id(e.target.value)}
            >
              <option value="">기본 DB</option>
              {storageConnections.map((sc) => (
                <option key={sc.storage_connection_id} value={sc.storage_connection_id}>
                  {sc.connection_name || `저장 #${sc.storage_connection_id}`}
                </option>
              ))}
            </select>
          </div>

          {selectedFolderId != null && (
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">파일 패턴 (폴더 내 _ib_ 파일 접두사)</label>
              <select
                className="etl-db-form__input"
                value={file_pattern}
                onChange={handlePatternChange}
                disabled={patternLoading}
              >
                <option value="">선택 (동일 접두사·일시별 여러 건은 하나로 표시)</option>
                {patternOptions.map((p) => (
                  <option key={p.pattern} value={p.pattern}>
                    {p.pattern} (파일 {p.file_count}건)
                  </option>
                ))}
              </select>
              <p className="etl-db-form__muted etl-db-form__label-desc">
                배치가 이 접두사와 일치하는 파일만 적재합니다. 예: sales_data → sales_data_ib_20250101120000.csv
              </p>
            </div>
          )}

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">타겟 테이블</label>
            <select
              className="etl-db-form__input"
              value={targetTableSelect}
              onChange={(e) => { setTargetTableSelect(e.target.value); if (e.target.value) setTarget_table(''); }}
            >
              <option value="">새 테이블 (직접 입력)</option>
              {targetTables.map((t) => (
                <option key={t.table_name} value={t.table_name}>{t.table_name}</option>
              ))}
            </select>
            {targetTableSelect === '' && (
              <input
                type="text"
                className="etl-db-form__input"
                style={{ marginTop: '8px' }}
                value={target_table}
                onChange={(e) => setTarget_table(e.target.value)}
                placeholder="예: sales_daily (저장 DB에 생성될 테이블명)"
              />
            )}
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">Job 이름</label>
            <input
              type="text"
              className="etl-db-form__input"
              value={job_name}
              onChange={(e) => setJob_name(e.target.value)}
              placeholder="예: 영업 일일 적재"
            />
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">PK 컬럼 (upsert 시 기준, 선택 또는 직접 입력)</label>
            <div className="etl-db-form__row--inline" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="etl-db-form__input"
                value={pk_columns}
                onChange={(e) => setPk_columns(e.target.value)}
                placeholder="예: id 또는 date,region"
                style={{ flex: '1 1 200px', minWidth: '120px' }}
              />
              {selectedFolderId != null && file_pattern?.trim() && (
                <button
                  type="button"
                  className="etl-db-form__btn etl-db-form__btn--secondary"
                  onClick={handleLoadColumns}
                  disabled={columnsLoading}
                >
                  {columnsLoading ? '로딩…' : '컬럼 가져와서 선택'}
                </button>
              )}
            </div>
            {availableColumns.length > 0 && (
              <div className="etl-db-form__field" style={{ marginTop: '8px' }}>
                <span className="etl-db-form__muted">선택한 컬럼을 PK로 사용:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {availableColumns.map((col) => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="checkbox"
                        checked={!!pkSelected[col]}
                        onChange={() => togglePkColumn(col)}
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {!pk_columns?.trim() && (
              <p className="etl-db-form__message etl-db-form__message--warning" role="status">PK 미설정: 중복 행 발생 가능</p>
            )}
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">실행 주기 (분)</label>
            <input
              type="number"
              min={INTERVAL_MIN}
              max={INTERVAL_MAX}
              className="etl-db-form__input"
              value={interval_minutes}
              onChange={(e) => setInterval_minutes(Number(e.target.value) || INTERVAL_DEFAULT)}
              placeholder={`${INTERVAL_MIN}~${INTERVAL_MAX}`}
            />
            <p className="etl-db-form__muted" style={{ marginTop: '4px' }}>
              {INTERVAL_MIN}~{INTERVAL_MAX}분 (기본 60)
            </p>
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">
              <input
                type="checkbox"
                checked={is_active}
                onChange={(e) => setIs_active(e.target.checked)}
              />
              <span style={{ marginLeft: '8px' }}>활성</span>
            </label>
          </div>

          {error && <p className="etl-db-form__error" role="alert">{error}</p>}
          <div className="etl-db-form__actions">
            <button type="submit" disabled={loading} className="etl-db-form__btn etl-db-form__btn--primary">
              {loading ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default BatchJobFormFile;
