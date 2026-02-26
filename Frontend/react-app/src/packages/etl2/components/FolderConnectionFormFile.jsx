/**
 * packages/etl2/components/FolderConnectionFormFile.jsx (폴더 연결 등록 폼)
 * ==========================================================================
 * 09_ETL_SFTP_Connection. SFTP/S3 프로토콜 선택 → 동적 필드, 연결 테스트, 등록.
 *
 * [Main Functions]
 * ===========
 * - 프로토콜(sftp|s3) 선택, 연결 테스트, 폴더 연결 등록
 * - onSuccess: 등록 성공 시 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListFolderConnections, batchCreateFolderConnection, batchTestFolderConnection)
 */

import { useState, useEffect } from 'react';
import {
  batchListFolderConnections,
  batchCreateFolderConnection,
  batchTestFolderConnection
} from '@/shared/api/client';
import CollapsibleCardSection from './CollapsibleCardSection';

const DEFAULT_SFTP = {
  connection_name: '',
  protocol: 'sftp',
  host: '',
  port: 22,
  username: '',
  password: '',
  private_key: '',
  remote_path: '/'
};

const DEFAULT_S3 = {
  connection_name: '',
  protocol: 's3',
  bucket: '',
  prefix: '',
  region: '',
  access_key_id: '',
  secret_access_key: '',
  endpoint_url: ''
};

function FolderConnectionFormFile({ onSuccess, refreshKey = 0 }) {
  const [protocol, setProtocol] = useState('sftp');
  const [form, setForm] = useState({ ...DEFAULT_SFTP });
  const [folderCount, setFolderCount] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setForm({ ...(protocol === 'sftp' ? DEFAULT_SFTP : DEFAULT_S3), protocol });
    setTestResult(null);
    setTestPassed(false);
  }

  function onProtocolChange(next) {
    setProtocol(next);
    setForm(next === 'sftp' ? { ...DEFAULT_SFTP } : { ...DEFAULT_S3 });
    setTestResult(null);
    setTestPassed(false);
  }

  function buildTestBody() {
    if (protocol === 'sftp') {
      return {
        protocol: 'sftp',
        connection_name: form.connection_name,
        host: form.host,
        port: Number(form.port) || 22,
        username: form.username,
        password: form.password || undefined,
        private_key: form.private_key || undefined,
        remote_path: form.remote_path || '/'
      };
    }
    return {
      protocol: 's3',
      connection_name: form.connection_name,
      bucket: form.bucket,
      prefix: form.prefix || '',
      region: form.region || undefined,
      access_key_id: form.access_key_id || undefined,
      secret_access_key: form.secret_access_key || undefined,
      endpoint_url: form.endpoint_url || undefined
    };
  }

  function buildCreateBody() {
    const b = { connection_name: form.connection_name.trim(), protocol };
    if (protocol === 'sftp') {
      b.host = form.host;
      b.port = Number(form.port) || 22;
      b.username = form.username;
      b.password = form.password || undefined;
      b.private_key = form.private_key || undefined;
      b.remote_path = form.remote_path || '/';
    } else {
      b.bucket = form.bucket;
      b.prefix = form.prefix || '';
      b.region = form.region || undefined;
      b.access_key_id = form.access_key_id || undefined;
      b.secret_access_key = form.secret_access_key || undefined;
      b.endpoint_url = form.endpoint_url || undefined;
    }
    return b;
  }

  async function handleTest() {
    if (protocol === 'sftp' && (!form.host?.trim() || !form.username?.trim())) {
      setTestResult('호스트와 사용자명을 입력하세요.');
      return;
    }
    if (protocol === 's3' && !form.bucket?.trim()) {
      setTestResult('버킷명을 입력하세요.');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    setTestPassed(false);
    try {
      const res = await batchTestFolderConnection(buildTestBody());
      setTestResult(res.message || '연결에 성공했습니다.');
      setTestPassed(Boolean(res.ok));
    } catch (err) {
      setTestResult(err.message || '연결 테스트 실패');
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
    if (protocol === 'sftp' && (!form.host?.trim() || !form.username?.trim())) {
      setError('호스트와 사용자명을 입력하세요.');
      return;
    }
    if (protocol === 's3' && !form.bucket?.trim()) {
      setError('버킷명을 입력하세요.');
      return;
    }
    setError('');
    setRegisterLoading(true);
    try {
      const res = await batchCreateFolderConnection(buildCreateBody());
      const fid = res?.folder_connection_id;
      if (fid != null && testPassed) {
        try {
          await batchTestFolderConnection({ folder_connection_id: fid });
        } catch (_) {
          /* 등록은 성공했으므로 검증만 실패하면 무시 */
        }
      }
      resetForm();
      const listRes = await batchListFolderConnections();
      const list = Array.isArray(listRes) ? listRes : (listRes?.folder_connections ?? listRes ?? []);
      setFolderCount(Array.isArray(list) ? list.length : 0);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '폴더 연결 등록 실패');
    } finally {
      setRegisterLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    batchListFolderConnections()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.folder_connections ?? res ?? []);
        if (!cancelled) setFolderCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => { if (!cancelled) setFolderCount(0); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="etl-db-form">
      <p className="etl-db-form__intro">
        원격 폴더(SFTP 또는 S3)를 등록하면, 배치 Job에서 <em>파일명_ib_yyyyMMddHHmmss</em> 형식 파일을 주기적으로 감지해 DB에 적재할 수 있습니다.
      </p>
      <CollapsibleCardSection title="폴더 연결 추가" defaultOpen={folderCount === null || folderCount === 0}>
        <form onSubmit={handleRegister} className="etl-db-form__connect-form">
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">프로토콜</label>
            <div className="etl-db-form__radio-group">
              <label>
                <input
                  type="radio"
                  name="protocol"
                  checked={protocol === 'sftp'}
                  onChange={() => onProtocolChange('sftp')}
                />
                <span>SFTP</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="protocol"
                  checked={protocol === 's3'}
                  onChange={() => onProtocolChange('s3')}
                />
                <span>S3</span>
              </label>
            </div>
          </div>
          <div className="etl-db-form__field">
            <label className="etl-db-form__label">연결 이름</label>
            <input
              type="text"
              value={form.connection_name}
              onChange={(e) => setForm((f) => ({ ...f, connection_name: e.target.value }))}
              className="etl-db-form__input"
              placeholder="예: 영업 SFTP"
            />
          </div>

          {protocol === 'sftp' && (
            <>
              <div className="etl-db-form__row etl-db-form__row--host-port">
                <div className="etl-db-form__field etl-db-form__field--host">
                  <label className="etl-db-form__label">호스트</label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    className="etl-db-form__input"
                    placeholder="sftp.example.com"
                  />
                </div>
                <div className="etl-db-form__field etl-db-form__field--port">
                  <label className="etl-db-form__label">포트</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                    className="etl-db-form__input"
                    min={1}
                    max={65535}
                  />
                </div>
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">사용자명</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="etl-db-form__input"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">비밀번호</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="private_key 사용 시 비워두기"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Private Key (PEM, 선택)</label>
                <textarea
                  value={form.private_key}
                  onChange={(e) => setForm((f) => ({ ...f, private_key: e.target.value }))}
                  className="etl-db-form__input"
                  rows={3}
                  placeholder="PEM 문자열. 비밀번호 대신 사용"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">원격 경로</label>
                <input
                  type="text"
                  value={form.remote_path}
                  onChange={(e) => setForm((f) => ({ ...f, remote_path: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="/"
                />
              </div>
            </>
          )}

          {protocol === 's3' && (
            <>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">버킷</label>
                <input
                  type="text"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="my-bucket"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Prefix (경로 접두사)</label>
                <input
                  type="text"
                  value={form.prefix}
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="data/"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">리전</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="ap-northeast-2"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Access Key ID</label>
                <input
                  type="text"
                  value={form.access_key_id}
                  onChange={(e) => setForm((f) => ({ ...f, access_key_id: e.target.value }))}
                  className="etl-db-form__input"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Secret Access Key</label>
                <input
                  type="password"
                  value={form.secret_access_key}
                  onChange={(e) => setForm((f) => ({ ...f, secret_access_key: e.target.value }))}
                  className="etl-db-form__input"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Endpoint URL (MinIO 등, 선택)</label>
                <input
                  type="text"
                  value={form.endpoint_url}
                  onChange={(e) => setForm((f) => ({ ...f, endpoint_url: e.target.value }))}
                  className="etl-db-form__input"
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {error && <p className="etl-db-form__error" role="alert">{error}</p>}
          {testResult && (
            <p className={testPassed ? 'etl-db-form__test-ok' : 'etl-db-form__test-fail'}>
              {testResult}
            </p>
          )}
          <div className="etl-db-form__actions">
            <button type="button" onClick={handleTest} disabled={testLoading} className="etl-db-form__btn etl-db-form__btn--secondary">
              {testLoading ? '테스트 중…' : '연결 테스트'}
            </button>
            <button type="submit" disabled={registerLoading} className="etl-db-form__btn etl-db-form__btn--primary">
              {registerLoading ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      </CollapsibleCardSection>
    </div>
  );
}

export default FolderConnectionFormFile;
