/**
 * packages/etl/components/StorageConnectionForm.jsx (저장 DB 등록 폼)
 * ======================================================================
 * ETL Phase 1: 적재 대상 DB(PostgreSQL) 등록. 연결 테스트(접속+CREATE/INSERT/DROP 권한) 후 등록.
 * UI: etl-db-form 스타일 재사용. 목록·삭제.
 *
 * [Main Functions]
 * ===========
 * 1. 저장 DB 목록 조회, 연결 테스트, 등록, 삭제
 * 2. onSuccess: 등록/삭제 성공 시 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js (etl2ListTimezones, etl2ListStorageConnections, etl2CreateStorageConnection, etl2TestStorageConnection, etl2DeleteStorageConnection)
 */

import { useState, useEffect } from 'react';
import {
  etl2ListTimezones,
  etl2ListStorageConnections,
  etl2CreateStorageConnection,
  etl2TestStorageConnection,
  etl2DeleteStorageConnection
} from '@/packages/etl/api/etlClient.js';
import CollapsibleCardSection from './CollapsibleCardSection';

// 1.
function StorageConnectionForm({ onSuccess }) {
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [form, setForm] = useState({
    connection_name: '',
    host: '',
    port: 5432,
    database_name: '',
    schema_name: 'public',
    username: '',
    password: '',
    server_timezone: 'Asia/Seoul'
  });
  const [timezones, setTimezones] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [testHint, setTestHint] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await etl2ListStorageConnections();
      setList(res.storage_connections || []);
    } catch {
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    etl2ListTimezones()
      .then((res) => setTimezones(res.timezones || []))
      .catch(() => setTimezones([]));
  }, []);

  async function handleTest() {
    if (!form.host?.trim() || !form.database_name?.trim() || !form.username?.trim()) {
      setTestResult('호스트, DB명, 사용자명을 입력하세요.');
      setTestHint(null);
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    setTestHint(null);
    setTestPassed(false);
    try {
      const res = await etl2TestStorageConnection({
        host: form.host.trim(),
        port: Number(form.port) || 5432,
        database_name: form.database_name.trim(),
        schema_name: (form.schema_name || 'public').trim() || 'public',
        username: form.username.trim(),
        password: form.password || ''
      });
      if (res.ok) {
        setTestResult(res.message || '접속 및 권한 확인 완료');
        setTestPassed(true);
      } else {
        setTestResult(res.message || '연결 테스트 실패');
        setTestHint(res.hint || null);
      }
    } catch (err) {
      setTestResult(err.message || '연결 테스트 실패');
      setTestHint(err.data?.hint || null);
      setTestPassed(false);
    } finally {
      setTestLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!form.connection_name?.trim()) {
      setError('연결 이름을 입력하세요.');
      return;
    }
    if (!form.host?.trim() || !form.database_name?.trim() || !form.username?.trim()) {
      setError('호스트, DB명, 사용자명을 입력하세요.');
      return;
    }
    setError('');
    setRegisterLoading(true);
    try {
      await etl2CreateStorageConnection({
        connection_name: form.connection_name.trim(),
        host: form.host.trim(),
        port: Number(form.port) || 5432,
        database_name: form.database_name.trim(),
        schema_name: (form.schema_name || 'public').trim() || 'public',
        username: form.username.trim(),
        password: form.password || '',
        server_timezone: form.server_timezone || 'Asia/Seoul'
      });
      setForm({
        connection_name: '',
        host: '',
        port: 5432,
        database_name: '',
        schema_name: 'public',
        username: '',
        password: '',
        server_timezone: 'Asia/Seoul'
      });
      setTestResult(null);
      setTestPassed(false);
      loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '저장 DB 등록 실패');
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleDelete(storageConnectionId, connectionName) {
    if (!window.confirm(`"${connectionName || storageConnectionId}" 저장 DB 연결을 삭제하시겠습니까?`)) return;
    setDeleteLoadingId(storageConnectionId);
    try {
      await etl2DeleteStorageConnection(storageConnectionId);
      loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '삭제 실패');
    } finally {
      setDeleteLoadingId(null);
    }
  }

  return (
    <div className="etl-db-form">
      <p className="etl-db-form__intro">파일 업로드나 DB 연동 시 &quot;저장할 DB&quot;로 선택할 수 있는 적재 대상 DB를 여기서 등록합니다. PostgreSQL만 지원합니다.</p>
      <CollapsibleCardSection
        title="저장 DB(적재 대상) 추가"
        defaultOpen={list.length === 0}
        subtitle="연결 테스트로 접속과 CREATE/INSERT/DROP 권한을 확인한 뒤 등록하세요."
      >
        <form onSubmit={handleRegister} className="etl-db-form__connect-form">
          <div className="etl-db-form__grid etl-db-form__grid--2">
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">연결 이름</label>
              <input
                type="text"
                value={form.connection_name}
                onChange={(e) => setForm((f) => ({ ...f, connection_name: e.target.value }))}
                className="etl-db-form__input"
                placeholder="예: 분석용 PostgreSQL"
              />
            </div>
            <div className="etl-db-form__field" aria-hidden="true" />
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">호스트</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                className="etl-db-form__input"
                placeholder="localhost 또는 IP"
              />
            </div>
            <div className="etl-db-form__field etl-db-form__field--short">
              <label className="etl-db-form__label">포트</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                className="etl-db-form__input"
                placeholder="5432"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">DB명</label>
              <input
                type="text"
                value={form.database_name}
                onChange={(e) => setForm((f) => ({ ...f, database_name: e.target.value }))}
                className="etl-db-form__input"
                placeholder="데이터베이스 이름"
              />
            </div>
            <div className="etl-db-form__field etl-db-form__field--short">
              <label className="etl-db-form__label">스키마</label>
              <input
                type="text"
                value={form.schema_name}
                onChange={(e) => setForm((f) => ({ ...f, schema_name: e.target.value }))}
                className="etl-db-form__input"
                placeholder="public"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">사용자</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="etl-db-form__input"
                placeholder="DB 사용자명"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="etl-db-form__input"
                placeholder="비밀번호"
                autoComplete="off"
              />
            </div>
            <div className="etl-db-form__field">
              <label className="etl-db-form__label">서버 시간대</label>
              <select
                value={form.server_timezone || 'Asia/Seoul'}
                onChange={(e) => setForm((f) => ({ ...f, server_timezone: e.target.value }))}
                className="etl-db-form__select"
              >
                {timezones.map((tz) => (
                  <option key={tz.timezone_id} value={tz.timezone_id}>
                    {tz.display_name}
                  </option>
                ))}
                {timezones.length === 0 && (
                  <option value="Asia/Seoul">한국 표준시 (UTC+09:00)</option>
                )}
              </select>
            </div>
          </div>
          <div className="etl-db-form__actions">
            <button type="button" onClick={handleTest} disabled={testLoading} className="etl-db-form__btn">
              {testLoading ? '테스트 중…' : '연결 테스트'}
            </button>
            <button type="submit" disabled={!testPassed || registerLoading} className="etl-db-form__btn etl-db-form__btn--primary">
              {registerLoading ? '등록 중…' : '등록'}
            </button>
          </div>
          {testLoading && <p className="etl-db-form__hint-inline">연결 테스트 중입니다. CREATE/INSERT/DROP 권한을 검증합니다.</p>}
          {!testPassed && testResult && !testLoading && <p className="etl-db-form__hint-inline">연결 테스트를 통과한 후 등록 버튼을 사용할 수 있습니다.</p>}
          <div className="etl-db-form__test-result">
            <p className={testHint ? 'etl-db-form__message etl-db-form__message--error' : 'etl-db-form__message'}>{testResult}</p>
            {testHint && <pre className="etl-db-form__hint">{testHint}</pre>}
          </div>
        </form>
        {error && <p className="etl-db-form__error">{error}</p>}
      </CollapsibleCardSection>

      <CollapsibleCardSection title="등록된 저장 DB" defaultOpen={true}>
        {loadingList ? (
          <p className="etl-db-form__hint-inline">목록 조회 중…</p>
        ) : (
          <ul className="etl-db-form__conn-list">
            {list.length === 0 ? (
              <li className="etl-db-form__conn-item">등록된 저장 DB가 없습니다.</li>
            ) : (
              list.map((c) => (
                <li key={c.storage_connection_id} className="etl-db-form__conn-item">
                  <span className="etl-db-form__conn-info">
                    {c.connection_name} — {c.host}:{c.port ?? '-'}/{c.database_name}
                    {c.server_timezone && (
                      <span className="etl-db-form__conn-tz"> · {c.server_timezone}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.storage_connection_id, c.connection_name)}
                    disabled={deleteLoadingId === c.storage_connection_id}
                    className="etl-db-form__btn etl-db-form__btn--danger"
                  >
                    {deleteLoadingId === c.storage_connection_id ? '삭제 중…' : '삭제'}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </CollapsibleCardSection>
    </div>
  );
}

export default StorageConnectionForm;
