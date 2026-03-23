/**
 * BatchJobFormFile.jsx (배치 Job 등록 폼)
 * =========================================
 * 09_ETL_SFTP_Connection. 흐름: 폴더 연결 → 저장 DB → 파일 패턴(폴더 내 _ib_ 정의) → 타겟 테이블·PK → Job 이름·주기.
 * 폴더 선택 시 해당 폴더의 파일 패턴 목록 셀렉트, 타겟 테이블은 저장 DB 기준 목록 또는 직접 입력, PK는 컬럼 가져와서 선택 또는 직접 입력.
 *
 * [Main Functions]
 * ===========
 * 1. 폴더 연결/저장 DB: refreshKey 변경 시 목록 재조회(즉시 반영)
 * 2. 폴더 선택 시 batchListFolderPatterns로 패턴 셀렉트 채움, 선택 시 file_pattern·타겟테이블 제안
 * 3. batchGetFolderColumns로 패턴 기준 최초 1건 컬럼 조회 후 PK 체크박스 선택
 * 4. [등록] → batchCreateJob, onSuccess 콜백
 *
 * [Props]
 * =====
 * 1. onSuccess: () => void — 등록 성공 시 콜백
 * 2. refreshKey: number — 변경 시 폴더/저장 DB 목록 재조회
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js (batchListFolderConnections, etl2ListStorageConnections, batchListFolderPatterns, batchGetFolderColumns, batchCreateJob)
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
} from '@/packages/etl/api/etlClient.js';
import { normalizeStorageConnectionId } from '../utils/storageDb.js';
import '../etl.css';

const INTERVAL_MIN = 10;
const INTERVAL_MAX = 1440;
const INTERVAL_DEFAULT = 60;

// 1.
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
  const [availableColumns, setAvailableColumns] = useState([]);
  const [pkSelected, setPkSelected] = useState({});
  const [index_definitions, setIndex_definitions] = useState([]);
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

  const sidForTarget = normalizeStorageConnectionId(storage_connection_id);
  useEffect(() => {
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

  /** 파일 패턴 선택 시 컬럼 자동 로드 → PK/INDEX 컬럼 체크박스에 사용 */
  useEffect(() => {
    if (!selectedFolderId || !file_pattern?.trim()) return;
    setColumnsLoading(true);
    batchGetFolderColumns(selectedFolderId, file_pattern.trim())
      .then((res) => setAvailableColumns(res?.columns ?? []))
      .catch(() => setAvailableColumns([]))
      .finally(() => setColumnsLoading(false));
  }, [selectedFolderId, file_pattern]);

  function handlePatternChange(e) {
    const v = e.target.value;
    setFile_pattern(v);
    if (v && !targetTableSelect && !target_table) setTarget_table(v);
  }

  const effectiveTargetTable = (targetTableSelect || target_table || '').trim();

  function togglePkColumn(col) {
    setPkSelected((prev) => ({ ...prev, [col]: !prev[col] }));
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
    const sid = normalizeStorageConnectionId(storage_connection_id);
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
          storage_connection_id: sid,
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
    const normalizedIndexDefs = (index_definitions && index_definitions.length > 0)
      ? index_definitions
        .filter((d) => Array.isArray(d.columns) && d.columns.length > 0)
        .map((d) => {
          const cols = (d.columns || []).map((c) => String(c).trim()).filter(Boolean);
          const name = (d.index_name || '').trim();
          const safe = cols.map((c) => c.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''));
          const autoName = safe.length ? `idx_${safe.join('_')}` : '';
          return { index_name: name || autoName, columns: cols, is_unique: !!d.is_unique };
        })
        .filter((d) => d.index_name)
      : null;
    const body = {
      folder_connection_id: fid,
      job_name: job_name.trim(),
      file_pattern: file_pattern.trim(),
      storage_connection_id: sid, // null = 기본 DB(config). utils/storageDb.js
      target_table: targetTableFinal,
      pk_columns: Object.keys(pkSelected).filter((k) => pkSelected[k]).join(', ').trim() || null,
      index_definitions: normalizedIndexDefs,
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
        setPkSelected({});
        setIndex_definitions([]);
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
            <label className="etl-db-form__label">PK 컬럼(선택, upsert 시 기준)</label>
            {!selectedFolderId || !file_pattern?.trim() ? (
              <p className="etl-db-form__muted">폴더 연결과 파일 패턴을 선택하면 컬럼이 표시됩니다.</p>
            ) : columnsLoading ? (
              <p className="etl-db-form__muted">컬럼 로딩 중…</p>
            ) : availableColumns.length > 0 ? (
              <>
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
                {Object.keys(pkSelected).filter((k) => pkSelected[k]).length === 0 && (
                  <p className="etl-db-form__message etl-db-form__message--warning" style={{ marginTop: '8px' }} role="status">PK 미설정: 중복 행 발생 가능</p>
                )}
              </>
            ) : (
              <p className="etl-db-form__muted">해당 패턴의 컬럼을 불러올 수 없습니다.</p>
            )}
          </div>

          <div className="etl-db-form__field">
            <label className="etl-db-form__label">INDEX 컬럼(선택) — 다중 인덱스</label>
            <p className="etl-db-form__muted" style={{ marginBottom: '8px' }}>인덱스를 여러 개 만들 수 있습니다. &quot;인덱스 추가&quot;로 행을 추가한 뒤, 각 행에서 컬럼·인덱스 명·UNIQUE를 설정하세요. UNIQUE 체크 시 해당 인덱스가 UNIQUE로 생성됩니다(선택한 컬럼 조합 값이 테이블 내에서 중복 불가).</p>
            {!selectedFolderId || !file_pattern?.trim() ? (
              <p className="etl-db-form__muted">폴더 연결과 파일 패턴을 선택하면 컬럼이 표시됩니다.</p>
            ) : columnsLoading ? (
              <p className="etl-db-form__muted">컬럼 로딩 중…</p>
            ) : availableColumns.length > 0 ? (
              <>
                {(index_definitions || []).map((def, idx) => (
                  <div key={idx} className="etl-db-form__index-row" style={{ marginBottom: '12px', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span className="etl-db-form__muted" style={{ marginRight: '8px' }}>컬럼 선택:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                        {availableColumns.map((colName) => {
                          const selected = (def.columns || []).includes(colName);
                          return (
                            <label key={colName} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="checkbox"
                                checked={!!selected}
                                onChange={() => {
                                  setIndex_definitions((prev) => {
                                    const list = [...(prev || [])];
                                    const row = { ...(list[idx] || { index_name: '', columns: [], is_unique: false }) };
                                    const cols = Array.isArray(row.columns) ? [...row.columns] : [];
                                    const next = cols.includes(colName) ? cols.filter((c) => c !== colName) : [...cols, colName];
                                    list[idx] = { ...row, columns: next };
                                    return list;
                                  });
                                }}
                              />
                              <span>{colName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {(def.columns || []).length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <label className="etl-db-form__muted" style={{ minWidth: '100px' }}>인덱스 명</label>
                          <input
                            type="text"
                            className="etl-db-form__input"
                            placeholder="예: idx_campaign_id (비우면 자동 생성)"
                            value={def.index_name || ''}
                            onChange={(e) => {
                              setIndex_definitions((prev) => {
                                const list = [...(prev || [])];
                                list[idx] = { ...(list[idx] || {}), index_name: e.target.value };
                                return list;
                              });
                            }}
                            style={{ flex: '1', maxWidth: '200px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="해당 인덱스를 UNIQUE로 생성(컬럼 조합 값 중복 불가)">
                            <input
                              type="checkbox"
                              checked={!!def.is_unique}
                              onChange={(e) => {
                                setIndex_definitions((prev) => {
                                  const list = [...(prev || [])];
                                  list[idx] = { ...(list[idx] || {}), is_unique: e.target.checked };
                                  return list;
                                });
                              }}
                            />
                            UNIQUE
                          </label>
                          <button type="button" className="etl-db-form__btn etl-db-form__btn--secondary" onClick={() => setIndex_definitions((prev) => prev.filter((_, i) => i !== idx))}>삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="etl-db-form__btn etl-db-form__btn--secondary" onClick={() => setIndex_definitions((prev) => [...(prev || []), { index_name: '', columns: [], is_unique: false }])}>+ 인덱스 추가</button>
              </>
            ) : (
              <p className="etl-db-form__muted">해당 패턴의 컬럼을 불러올 수 없습니다.</p>
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
