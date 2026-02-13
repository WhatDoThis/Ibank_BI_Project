/**
 * packages/etl/components/DbConnectionForm.jsx (DB 연결·ETL 등록 폼)
 * =====================================================================
 * 연결 추가(호스트, 포트, DB명, 사용자, 비밀번호), 연결 테스트, 연결 선택 후 소스 테이블 선택 → 타겟 테이블명·설명·PK·동기화 모드 입력, 등록. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - 연결 목록 조회, 연결 추가, 연결 테스트
 * - 연결별 소스 테이블 목록, 소스 테이블 선택 후 타겟 테이블 등록 (POST /api/etl/tables)
 * - onSuccess: 등록 성공 시 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etlListConnections, etlCreateConnection, etlTestConnection, etlListConnectionTables, etlCreateTable)
 */

import { useState, useEffect } from 'react';
import {
  etlListConnections,
  etlCreateConnection,
  etlTestConnection,
  etlListConnectionTables,
  etlCreateTable
} from '@/shared/api/client';

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
  const [connError, setConnError] = useState('');

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

  const [targetTable, setTargetTable] = useState('');
  const [description, setDescription] = useState('');
  const [pkColumns, setPkColumns] = useState('');
  const [syncMode, setSyncMode] = useState('full');
  const [selectedSourceTable, setSelectedSourceTable] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  async function loadConnections() {
    setLoadingConn(true);
    try {
      const res = await etlListConnections();
      setConnections(res.connections || []);
    } catch {
      setConnections([]);
    } finally {
      setLoadingConn(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (!selectedConnId) {
      setSourceTables([]);
      return;
    }
    setLoadingTables(true);
    etlListConnectionTables(Number(selectedConnId))
      .then((res) => setSourceTables(res.tables || []))
      .catch(() => setSourceTables([]))
      .finally(() => setLoadingTables(false));
  }, [selectedConnId]);

  async function handleAddConnection(e) {
    e.preventDefault();
    setConnError('');
    setTestResult(null);
    try {
      await etlCreateConnection({
        ...newConn,
        source_type: 'postgresql'
      });
      loadConnections();
      setNewConn({ ...defaultConn });
    } catch (err) {
      setConnError(err.message || '연결 등록 실패');
    }
  }

  async function handleTestConnection(e) {
    e.preventDefault();
    setTestResult(null);
    setConnError('');
    try {
      const res = await etlTestConnection({
        host: newConn.host,
        port: newConn.port,
        database_name: newConn.database_name,
        username: newConn.username,
        password: newConn.password
      });
      setTestResult(res.ok ? '연결 성공' : res.message || '실패');
    } catch (err) {
      setTestResult('연결 실패: ' + (err.message || ''));
    }
  }

  async function handleCreateTable(e) {
    e.preventDefault();
    if (!selectedConnId || !selectedSourceTable || !targetTable.trim()) {
      setCreateError('연결, 소스 테이블, 타겟 테이블명을 입력하세요.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      await etlCreateTable({
        connection_id: Number(selectedConnId),
        target_table: targetTable.trim(),
        description: description.trim() || null,
        source_table: selectedSourceTable,
        pk_columns: pkColumns.trim() || null,
        sync_mode: syncMode,
        created_by: 'user'
      });
      if (onSuccess) onSuccess();
      setTargetTable('');
      setDescription('');
      setPkColumns('');
      setSyncMode('full');
      setSelectedSourceTable('');
    } catch (err) {
      setCreateError(err.message || 'ETL 테이블 등록 실패');
    } finally {
      setCreateLoading(false);
    }
  }

  const sourceTableOptions = (sourceTables || []).map((t) => ({
    value: t.table_name,
    label: t.table_schema ? `${t.table_schema}.${t.table_name}` : t.table_name
  }));

  return (
    <div className="etl-db-form">
      <section className="etl-db-form__section">
        <h3 className="etl-db-form__heading">연결 추가</h3>
        <form onSubmit={handleAddConnection} className="etl-db-form__inline">
          <input
            type="text"
            placeholder="연결 이름"
            value={newConn.connection_name}
            onChange={(e) => setNewConn((c) => ({ ...c, connection_name: e.target.value }))}
            required
            className="etl-db-form__input"
          />
          <input
            type="text"
            placeholder="호스트"
            value={newConn.host}
            onChange={(e) => setNewConn((c) => ({ ...c, host: e.target.value }))}
            required
            className="etl-db-form__input"
          />
          <input
            type="number"
            placeholder="포트"
            value={newConn.port}
            onChange={(e) => setNewConn((c) => ({ ...c, port: Number(e.target.value) || 5432 }))}
            className="etl-db-form__input etl-db-form__input--short"
          />
          <input
            type="text"
            placeholder="DB명"
            value={newConn.database_name}
            onChange={(e) => setNewConn((c) => ({ ...c, database_name: e.target.value }))}
            required
            className="etl-db-form__input"
          />
          <input
            type="text"
            placeholder="사용자"
            value={newConn.username}
            onChange={(e) => setNewConn((c) => ({ ...c, username: e.target.value }))}
            required
            className="etl-db-form__input"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={newConn.password}
            onChange={(e) => setNewConn((c) => ({ ...c, password: e.target.value }))}
            className="etl-db-form__input"
          />
          <button type="button" className="etl-db-form__btn" onClick={handleTestConnection}>
            테스트
          </button>
          <button type="submit" className="etl-db-form__btn etl-db-form__btn--primary">
            등록
          </button>
        </form>
        {testResult && <p className="etl-db-form__message">{testResult}</p>}
        {connError && <p className="etl-db-form__error">{connError}</p>}
      </section>

      <section className="etl-db-form__section">
        <h3 className="etl-db-form__heading">ETL 테이블 등록 (DB → 우리 DB)</h3>
        <div className="etl-db-form__row">
          <label className="etl-db-form__label">연결 선택</label>
          <select
            value={selectedConnId}
            onChange={(e) => setSelectedConnId(e.target.value)}
            className="etl-db-form__select"
          >
            <option value="">선택</option>
            {connections.map((c) => (
              <option key={c.connection_id} value={c.connection_id}>
                {c.connection_name} ({c.host}/{c.database_name})
              </option>
            ))}
          </select>
        </div>
        <div className="etl-db-form__row">
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
        <div className="etl-db-form__row">
          <label className="etl-db-form__label">타겟 테이블명 (우리 DB)</label>
          <input
            type="text"
            value={targetTable}
            onChange={(e) => setTargetTable(e.target.value)}
            placeholder="예: external_orders"
            className="etl-db-form__input"
          />
        </div>
        <div className="etl-db-form__row">
          <label className="etl-db-form__label">설명</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="etl-db-form__input"
          />
        </div>
        <div className="etl-db-form__row">
          <label className="etl-db-form__label">PK 컬럼 (쉼표 구분, incremental 시 필수)</label>
          <input
            type="text"
            value={pkColumns}
            onChange={(e) => setPkColumns(e.target.value)}
            placeholder="예: id 또는 order_id,product_id"
            className="etl-db-form__input"
          />
        </div>
        <div className="etl-db-form__row">
          <label className="etl-db-form__label">동기화 모드</label>
          <select value={syncMode} onChange={(e) => setSyncMode(e.target.value)} className="etl-db-form__select">
            <option value="full">전체(Full)</option>
            <option value="incremental">증분(Incremental)</option>
          </select>
        </div>
        {createError && <p className="etl-db-form__error">{createError}</p>}
        <button
          type="button"
          className="etl-db-form__btn etl-db-form__btn--primary"
          onClick={handleCreateTable}
          disabled={createLoading}
        >
          {createLoading ? '등록 중…' : 'ETL 테이블 등록'}
        </button>
      </section>
    </div>
  );
}

export default DbConnectionForm;
