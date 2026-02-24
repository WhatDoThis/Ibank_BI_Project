/**
 * packages/etl/components/DbConnectionForm.jsx (DB 연결·ETL 등록 폼)
 * =====================================================================
 * 연결 추가(호스트, 포트, DB명, 사용자, 비밀번호), 연결 테스트, 연결 선택 후 소스 테이블 선택 → 타겟 테이블명·설명·동기화 모드 입력, 등록. PK는 DB 소스인 경우 소스 DB에서 자동 반영. Phase 5.
 * UI: 2열 그리드(etl-db-form__grid--2)·카드 섹션(etl-db-form__section--card)·라벨 상단 배치·액션 버튼 영역(etl-db-form__actions).
 *
 * [Main Functions]
 * ===========
 * - 연결 목록 조회, 연결 추가, 연결 테스트
 * - 연결별 소스 테이블 목록, 소스 테이블 선택 후 타겟 테이블·라벨명 등록 (POST /api/etl/tables). 라벨명은 추후 테이블 마스터에서 관리 예정.
 * - onSuccess: 등록 성공 시 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListConnections, etl2CreateConnection, etl2TestConnection, etl2ListConnectionTables, etl2CreateTable)
 */

import { useState, useEffect } from 'react';
import {
  etl2ListConnections,
  etl2CreateConnection,
  etl2TestConnection,
  etl2ListConnectionTables,
  etl2GetSourceColumns,
  etl2ValidateIncrementalColumn,
  etl2CreateTable,
  etl2DeleteConnection,
  etl2ListStorageConnections
} from '@/shared/api/client';
import TargetTableSelectModal from './TargetTableSelectModal.jsx';

function DbConnectionForm({ onSuccess }) {
  const [connections, setConnections] = useState([]);
  const [loadingConn, setLoadingConn] = useState(false);
  const [selectedConnId, setSelectedConnId] = useState('');
  const [sourceTables, setSourceTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const [newConn, setNewConn] = useState({
    connection_name: '',
    host: '',
    port: 5432,
    database_name: '',
    schema_name: 'public',
    username: '',
    password: '',
    created_by: 'user',
    source_type: 'postgresql'
  });
  const [testResult, setTestResult] = useState(null);
  const [testHint, setTestHint] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [connectionTestPassed, setConnectionTestPassed] = useState(false);
  const [connError, setConnError] = useState('');

  const DB_OPTIONS = [
    { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
    { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
    { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  ];

  const defaultConn = {
    connection_name: '',
    host: '',
    port: 5432,
    database_name: '',
    schema_name: 'public',
    username: '',
    password: '',
    created_by: 'user',
    source_type: 'postgresql'
  };

  function getDefaultPortForDb(dbType) {
    return DB_OPTIONS.find((o) => o.value === dbType)?.defaultPort ?? 5432;
  }

  const [targetTable, setTargetTable] = useState('');
  const [labelName, setLabelName] = useState('');
  const [description, setDescription] = useState('');
  const [syncMode, setSyncMode] = useState('incremental');
  const [incrementalColumnSelect, setIncrementalColumnSelect] = useState('');
  const [incrementalColumnCustom, setIncrementalColumnCustom] = useState('');
  const [sourceColumns, setSourceColumns] = useState([]);
  const [sourceColumnsLoading, setSourceColumnsLoading] = useState(false);
  const [batchSize, setBatchSize] = useState('');
  const [batchIntervalSeconds, setBatchIntervalSeconds] = useState('');
  const [selectedSourceTable, setSelectedSourceTable] = useState('');
  const [storageConnectionId, setStorageConnectionId] = useState('');
  const [storageConnections, setStorageConnections] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [disconnectLoadingId, setDisconnectLoadingId] = useState(null);
  const [targetTableSelectOpen, setTargetTableSelectOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);

  function isDateType(dataType) {
    const t = (dataType || '').trim().toLowerCase();
    if (['date', 'datetime', 'timestamp', 'timestamptz', 'timestamp with time zone',
      'timestamp without time zone', 'time', 'timetz', 'year', 'interval'].includes(t)) return true;
    if (t.includes('date') || t.includes('time')) return true;
    return false;
  }

  async function loadConnections() {
    setLoadingConn(true);
    try {
      const res = await etl2ListConnections();
      setConnections(res.connections || []);
    } catch {
      setConnections([]);
    } finally {
      setLoadingConn(false);
    }
  }

  useEffect(() => {
    if (!selectedConnId || !selectedSourceTable) {
      setSourceColumns([]);
      setIncrementalColumnSelect('');
      setIncrementalColumnCustom('');
      return;
    }
    if (syncMode !== 'incremental') {
      setIncrementalColumnSelect('');
      setIncrementalColumnCustom('');
    }
    let cancelled = false;
    setSourceColumnsLoading(true);
    setSourceColumns([]);
    if (syncMode === 'incremental') {
      setIncrementalColumnSelect('');
      setIncrementalColumnCustom('');
    }
    etl2GetSourceColumns(Number(selectedConnId), selectedSourceTable)
      .then((res) => {
        if (!cancelled) setSourceColumns(res.columns || []);
      })
      .catch(() => {
        if (!cancelled) setSourceColumns([]);
      })
      .finally(() => {
        if (!cancelled) setSourceColumnsLoading(false);
      });
    return () => { cancelled = true; };
  }, [syncMode, selectedConnId, selectedSourceTable]);

  async function handleDisconnect(connectionId, connectionName) {
    if (!window.confirm(`"${connectionName || connectionId}" 연결을 해제하시겠습니까? 해당 연결로 등록된 타겟 테이블이 메인 DB에서 DROP됩니다.`)) return;
    setDisconnectLoadingId(connectionId);
    try {
      await etl2DeleteConnection(connectionId);
      if (String(selectedConnId) === String(connectionId)) {
        setSelectedConnId('');
        setSourceTables([]);
        setSelectedSourceTable('');
      }
      loadConnections();
      if (onSuccess) onSuccess();
    } catch (err) {
      setConnError(err.message || '연결 해제 실패');
    } finally {
      setDisconnectLoadingId(null);
    }
  }

  useEffect(() => {
    loadConnections();
    etl2ListStorageConnections().then((res) => setStorageConnections(res.storage_connections || [])).catch(() => setStorageConnections([]));
  }, []);

  // DB 연결만 표시하므로, 선택된 ID가 파일 업로드 연결이면 선택 해제
  const dbConnections = (connections || []).filter(
    (c) => (c.source_type || '').toString().toLowerCase() !== 'file'
  );
  useEffect(() => {
    const idSet = new Set(dbConnections.map((c) => String(c.connection_id)));
    if (selectedConnId && !idSet.has(String(selectedConnId))) {
      setSelectedConnId('');
      setSourceTables([]);
      setSelectedSourceTable('');
    }
  }, [connections, dbConnections.length, selectedConnId]);

  useEffect(() => {
    if (!selectedConnId) {
      setSourceTables([]);
      return;
    }
    setLoadingTables(true);
    etl2ListConnectionTables(Number(selectedConnId))
      .then((res) => setSourceTables(res.tables || []))
      .catch(() => setSourceTables([]))
      .finally(() => setLoadingTables(false));
  }, [selectedConnId]);

  async function handleAddConnection(e) {
    e.preventDefault();
    if (!connectionTestPassed) return;
    setConnError('');
    setTestResult(null);
    try {
      await etl2CreateConnection({
        ...newConn,
        source_type: newConn.source_type || 'postgresql'
      });
      loadConnections();
      setNewConn({ ...defaultConn });
      setConnectionTestPassed(false);
    } catch (err) {
      setConnError(err.message || '연결 등록 실패');
    }
  }

  async function handleTestConnection(e) {
    e.preventDefault();
    setTestResult(null);
    setTestHint(null);
    setConnError('');
    setConnectionTestPassed(false);
    setTestLoading(true);
    try {
      const res = await etl2TestConnection({
        source_type: newConn.source_type,
        host: newConn.host,
        port: newConn.port,
        database_name: newConn.database_name,
        username: newConn.username,
        password: newConn.password
      });
      if (res.ok) {
        setTestResult('연결 성공');
        setTestHint(null);
        setConnectionTestPassed(true);
      } else {
        setTestResult(res.message || '연결 실패');
        setTestHint(res.hint || null);
      }
    } catch (err) {
      setTestResult('연결 실패: ' + (err.message || ''));
      setTestHint(null);
    } finally {
      setTestLoading(false);
    }
  }

  function clearTestPassedOnChange() {
    setConnectionTestPassed(false);
  }

  async function handleCreateTable(e) {
    e.preventDefault();
    if (!selectedConnId || !selectedSourceTable || !targetTable.trim()) {
      setCreateError('연결, 소스 테이블, 타겟 테이블명을 입력하세요.');
      return;
    }
    const finalIncremental =
      syncMode === 'incremental'
        ? (incrementalColumnSelect === '__custom__' ? incrementalColumnCustom.trim() : (incrementalColumnSelect || ''))
        : '';
    if (syncMode === 'incremental' && incrementalColumnSelect === '__custom__' && finalIncremental) {
      try {
        const res = await etl2ValidateIncrementalColumn(
          Number(selectedConnId),
          selectedSourceTable,
          finalIncremental
        );
        if (res && res.valid === false) {
          setCreateError(res.message || '증분 컬럼이 날짜 형식이 아닙니다.');
          return;
        }
      } catch (err) {
        setCreateError(err.message || '증분 컬럼 검증 실패');
        return;
      }
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      await etl2CreateTable({
        connection_id: Number(selectedConnId),
        target_table: targetTable.trim(),
        label_name: labelName.trim() || null,
        description: description.trim() || null,
        source_table: selectedSourceTable,
        pk_columns: null,
        sync_mode: syncMode,
        incremental_column: syncMode === 'incremental' && finalIncremental ? finalIncremental : null,
        batch_size: batchSize.trim() ? parseInt(batchSize, 10) || null : null,
        batch_interval_seconds: batchIntervalSeconds.trim() ? parseInt(batchIntervalSeconds, 10) || null : null,
        storage_connection_id: storageConnectionId === '' || storageConnectionId == null ? null : Number(storageConnectionId),
        column_mapping: columnMapping && columnMapping.length > 0 ? columnMapping : null,
        created_by: 'user'
      });
      if (onSuccess) onSuccess();
      setTargetTable('');
      setLabelName('');
      setDescription('');
      setSyncMode('incremental');
      setIncrementalColumnSelect('');
      setIncrementalColumnCustom('');
      setBatchSize('');
      setBatchIntervalSeconds('');
      setSelectedSourceTable('');
      setColumnMapping(null);
    } catch (err) {
      setCreateError(err.message || 'ETL 테이블 등록 실패');
    } finally {
      setCreateLoading(false);
    }
  }

  const sourceTableOptions = (sourceTables || []).map((t) => ({
    value: t.table_schema ? `${t.table_schema}.${t.table_name}` : t.table_name,
    label: t.table_schema ? `${t.table_schema}.${t.table_name}` : t.table_name
  }));

  return (
    <div className="etl-db-form">
      <p className="etl-db-form__intro">외부 DB 연결을 등록한 뒤, 가져올 테이블과 저장할 테이블명을 정해 등록하면 아래 목록에 뜹니다. 목록에서 <strong>실행</strong>을 눌러 적재하세요.</p>
      <section className="etl-db-form__section etl-db-form__section--card">
        <h3 className="etl-db-form__heading"><span className="etl-db-form__step-num" aria-hidden="true">1</span> 연결 추가</h3>
        <p className="etl-db-form__subtitle">DB 정보 입력 후 &quot;연결 테스트&quot;를 누르고, 성공하면 &quot;연결 등록&quot;을 누르세요.</p>
        <form onSubmit={handleAddConnection} className="etl-db-form__connect-form">
          <div className="etl-db-form__grid etl-db-form__grid--2">
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">DB 종류</label>
              <select
                value={newConn.source_type}
                onChange={(e) => {
                  const v = e.target.value;
                  const port = getDefaultPortForDb(v);
                  setNewConn((c) => ({
                    ...c,
                    source_type: v,
                    port,
                    schema_name: v === 'postgresql' ? 'public' : ''
                  }));
                  clearTestPassedOnChange();
                }}
                className="etl-db-form__select"
              >
                {DB_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">연결 이름</label>
              <input
                type="text"
                placeholder="예: 운영 DB"
                value={newConn.connection_name}
                onChange={(e) => { setNewConn((c) => ({ ...c, connection_name: e.target.value })); clearTestPassedOnChange(); }}
                required
                className="etl-db-form__input"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">호스트</label>
              <input
                type="text"
                placeholder="호스트 또는 IP"
                value={newConn.host}
                onChange={(e) => { setNewConn((c) => ({ ...c, host: e.target.value })); clearTestPassedOnChange(); }}
                required
                className="etl-db-form__input"
              />
            </div>
            <div className="etl-db-form__field etl-db-form__field--short">
              <label className="etl-db-form__label">포트</label>
              <input
                type="number"
                placeholder="5432"
                value={newConn.port}
                onChange={(e) => { setNewConn((c) => ({ ...c, port: Number(e.target.value) || getDefaultPortForDb(newConn.source_type) })); clearTestPassedOnChange(); }}
                className="etl-db-form__input"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">{newConn.source_type === 'oracle' ? '서비스명(Service Name)' : 'DB명'}</label>
              {newConn.source_type === 'oracle' && (
                <span className="etl-db-form__label-desc">JDBC URL이 @호스트:1521/서비스명 이면 여기에 서비스명 입력. SID 방식은 미지원.</span>
              )}
              <input
                type="text"
                placeholder={newConn.source_type === 'oracle' ? '예: FREEPDB1' : '데이터베이스 이름'}
                value={newConn.database_name}
                onChange={(e) => { setNewConn((c) => ({ ...c, database_name: e.target.value })); clearTestPassedOnChange(); }}
                required
                className="etl-db-form__input"
              />
            </div>
            {newConn.source_type === 'postgresql' ? (
              <div className="etl-db-form__field etl-db-form__field--short">
                <label className="etl-db-form__label">스키마</label>
                <input
                  type="text"
                  placeholder="public"
                  value={newConn.schema_name}
                  onChange={(e) => { setNewConn((c) => ({ ...c, schema_name: e.target.value })); clearTestPassedOnChange(); }}
                  className="etl-db-form__input"
                />
              </div>
            ) : (
              <div className="etl-db-form__field etl-db-form__field--short" aria-hidden="true" />
            )}
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">사용자</label>
              <input
                type="text"
                placeholder="사용자명"
                value={newConn.username}
                onChange={(e) => { setNewConn((c) => ({ ...c, username: e.target.value })); clearTestPassedOnChange(); }}
                required
                className="etl-db-form__input"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호"
                value={newConn.password}
                onChange={(e) => { setNewConn((c) => ({ ...c, password: e.target.value })); clearTestPassedOnChange(); }}
                className="etl-db-form__input"
              />
            </div>
          </div>
          <div className="etl-db-form__actions">
            <button
              type="button"
              className="etl-db-form__btn"
              onClick={handleTestConnection}
              disabled={testLoading}
            >
              {testLoading ? '테스트 중…' : '연결 테스트'}
            </button>
            <button
              type="submit"
              className="etl-db-form__btn etl-db-form__btn--primary"
              disabled={!connectionTestPassed}
              title={!connectionTestPassed ? '연결 테스트를 통과한 후 등록할 수 있습니다.' : ''}
              aria-disabled={!connectionTestPassed}
            >
              연결 등록
            </button>
          </div>
        </form>
        {testLoading && (
          <p className="etl-db-form__hint-inline">연결 테스트 중입니다. 최대 15초 정도 걸릴 수 있습니다.</p>
        )}
        {!connectionTestPassed && (newConn.host || newConn.database_name) && !testLoading && (
          <p className="etl-db-form__hint-inline">연결 테스트를 통과한 후 등록 버튼을 사용할 수 있습니다.</p>
        )}
        {testResult && (
          <div className="etl-db-form__test-result">
            <p className={testHint ? 'etl-db-form__message etl-db-form__message--error' : 'etl-db-form__message'}>{testResult}</p>
            {testHint && <pre className="etl-db-form__hint">{testHint}</pre>}
          </div>
        )}
        {connError && <p className="etl-db-form__error">{connError}</p>}
      </section>

      {dbConnections.length > 0 && (
        <section className="etl-db-form__section etl-db-form__section--card">
          <h3 className="etl-db-form__heading">등록된 연결</h3>
          <p className="etl-db-form__subtitle">아래에서 연결을 선택한 뒤 &quot;ETL 테이블 등록&quot;에서 소스 테이블을 고르세요. 연결 해제 시 해당 연결로 만든 타겟 테이블이 DROP됩니다.</p>
          <ul className="etl-db-form__conn-list">
            {dbConnections.map((c) => (
              <li key={c.connection_id} className="etl-db-form__conn-item">
                <span className="etl-db-form__conn-info">{c.connection_name} — {c.host}:{c.port ?? '-'}/{c.database_name}</span>
                <button
                  type="button"
                  className="etl-db-form__btn etl-db-form__btn--danger"
                  onClick={() => handleDisconnect(c.connection_id, c.connection_name)}
                  disabled={disconnectLoadingId != null}
                >
                  {disconnectLoadingId === c.connection_id ? '해제 중…' : '연결 해제'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="etl-db-form__section etl-db-form__section--card">
        <h3 className="etl-db-form__heading"><span className="etl-db-form__step-num" aria-hidden="true">2</span> ETL 테이블 등록</h3>
        <p className="etl-db-form__subtitle">연결 선택 → 소스 테이블 선택 → 타겟 테이블명 입력(필요 시 테이블선택 및 컬럼매핑) 후 &quot;ETL 테이블 등록&quot;을 누르세요.</p>
        <div className="etl-db-form__grid etl-db-form__grid--2">
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">연결 선택</label>
            <select
              value={selectedConnId}
              onChange={(e) => setSelectedConnId(e.target.value)}
              className="etl-db-form__select"
            >
              <option value="">선택</option>
              {dbConnections.map((c) => (
                <option key={c.connection_id} value={c.connection_id}>
                  {c.connection_name} ({c.host}:{c.port ?? '-'}/{c.database_name})
                </option>
              ))}
            </select>
          </div>
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">소스 테이블</label>
            <select
              value={selectedSourceTable}
              onChange={(e) => setSelectedSourceTable(e.target.value)}
              disabled={!selectedConnId || loadingTables}
              className="etl-db-form__select"
            >
              <option value="">선택</option>
              {sourceTableOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">저장할 DB</label>
            <select
              value={storageConnectionId}
              onChange={(e) => setStorageConnectionId(e.target.value)}
              className="etl-db-form__select"
            >
              <option value="">기본 DB (ibank_db)</option>
              {storageConnections.map((c) => (
                <option key={c.storage_connection_id} value={String(c.storage_connection_id)}>{c.connection_name}</option>
              ))}
            </select>
          </div>
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">타겟 테이블명</label>
            <span className="etl-db-form__label-desc">위에서 선택한 &quot;저장할 DB&quot;(기본 DB 또는 등록 저장 DB)에 생성·적재됩니다.</span>
            <div className="etl-db-form__input-group">
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder="예: external_orders"
                className="etl-db-form__input"
              />
              <button
                type="button"
                className="etl-db-form__target-select-btn"
                onClick={() => setTargetTableSelectOpen(true)}
              >
                테이블선택 및 컬럼매핑
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
              sourceColumns={sourceColumns}
              onSelect={(tableName, mapping) => {
                setTargetTable(tableName);
                setColumnMapping(mapping && mapping.length > 0 ? mapping : null);
                setTargetTableSelectOpen(false);
              }}
            />
          )}
          {(targetTable.trim() || (columnMapping && columnMapping.length > 0)) && (
            <div className="etl-db-form__field etl-db-form__summary">
              <label className="etl-db-form__label">설정 요약</label>
              <div className="etl-db-form__summary-box">
                {targetTable.trim() && (
                  <p className="etl-db-form__summary-line">
                    <strong>타겟 테이블:</strong> {targetTable.trim()}
                  </p>
                )}
                {columnMapping && columnMapping.length > 0 && (
                  <>
                    <p className="etl-db-form__summary-line">
                      <strong>컬럼 매핑 ({columnMapping.length}개):</strong>
                    </p>
                    <ul className="etl-db-form__mapping-list">
                      {columnMapping.map((m, i) => (
                        <li key={i}>
                          {m.source || '(소스)'} → {m.target || '(타겟)'}
                          {m.type && <span className="etl-db-form__mapping-type"> ({m.type})</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <button
                  type="button"
                  className="etl-db-form__summary-edit"
                  onClick={() => setTargetTableSelectOpen(true)}
                >
                  수정
                </button>
              </div>
            </div>
          )}
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">라벨명 (선택)</label>
            <input
              type="text"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder="표시용 라벨"
              className="etl-db-form__input"
            />
          </div>
          <div className="etl-db-form__field etl-db-form__field--full">
            <label className="etl-db-form__label">설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="테이블 설명"
              className="etl-db-form__input"
            />
          </div>
          <div className="etl-db-form__field etl-db-form__field--full">
            <p className="etl-db-form__hint">DB 소스인 경우 PK는 소스 DB에서 자동으로 가져옵니다.</p>
          </div>
          <div className="etl-db-form__field etl-db-form__field--full">
            <label className="etl-db-form__label">동기화 모드</label>
            <span className="etl-db-form__label-desc">전체: 삭제 후 전체 적재. 증분: 소스에서 증분 컬럼 기준 이후 행만 조회해 Upsert.</span>
            <select value={syncMode} onChange={(e) => setSyncMode(e.target.value)} className="etl-db-form__select">
              <option value="full">전체(Full)</option>
              <option value="incremental">증분(Incremental)</option>
            </select>
          </div>
          {syncMode === 'incremental' && (
            <div className="etl-db-form__field etl-db-form__field--full">
              <label className="etl-db-form__label">증분 컬럼 (소스)</label>
              <span className="etl-db-form__label-desc">소스 테이블에서 &quot;이 시각/값 이후&quot;로 필터할 컬럼. 날짜/시간 컬럼을 선택하거나 직접 입력 시 날짜 형식으로 검증됩니다.</span>
              <select
                value={incrementalColumnSelect}
                onChange={(e) => setIncrementalColumnSelect(e.target.value)}
                className="etl-db-form__select"
                disabled={sourceColumnsLoading}
              >
                <option value="">사용 안 함</option>
                {(sourceColumns || [])
                  .filter((c) => isDateType(c.data_type))
                  .map((c) => (
                    <option key={c.column_name} value={c.column_name}>
                      {c.column_name} ({c.data_type})
                    </option>
                  ))}
                <option value="__custom__">직접 입력 (커스텀)</option>
              </select>
              {incrementalColumnSelect === '__custom__' && (
                <input
                  type="text"
                  value={incrementalColumnCustom}
                  onChange={(e) => setIncrementalColumnCustom(e.target.value)}
                  placeholder="예: updated_at (날짜 형식 검증됨)"
                  className="etl-db-form__input etl-db-form__input--mt"
                />
              )}
            </div>
          )}
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">배치 크기</label>
            <input
              type="number"
              min="1"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="5000"
              className="etl-db-form__input"
            />
          </div>
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">배치 대기(초)</label>
            <input
              type="number"
              min="0"
              value={batchIntervalSeconds}
              onChange={(e) => setBatchIntervalSeconds(e.target.value)}
              placeholder="0"
              className="etl-db-form__input"
            />
          </div>
        </div>
        {createError && <p className="etl-db-form__error">{createError}</p>}
        <div className="etl-db-form__actions">
          <button
            type="button"
            className="etl-db-form__btn etl-db-form__btn--primary"
            onClick={handleCreateTable}
            disabled={createLoading}
          >
            {createLoading ? '등록 중…' : 'ETL 테이블 등록'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DbConnectionForm;
