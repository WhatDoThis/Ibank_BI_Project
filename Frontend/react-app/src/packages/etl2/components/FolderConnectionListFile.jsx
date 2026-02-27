/**
 * packages/etl2/components/FolderConnectionListFile.jsx (폴더 연결 목록)
 * =======================================================================
 * - 등록된 폴더 연결 목록, 삭제. SFTP는 IP(host), S3는 버킷(및 리전)을 연결 구분용으로 표시.
 *
 * [Main Functions]
 * ===========
 * - 폴더 연결 목록 조회, 삭제
 * - onSuccess: 삭제 성공 시 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListFolderConnections, batchDeleteFolderConnection)
 */

import { useState, useEffect } from 'react';
import { batchListFolderConnections, batchDeleteFolderConnection } from '@/shared/api/client';
import CollapsibleCardSection from './CollapsibleCardSection';

function FolderConnectionListFile({ onSuccess, refreshKey = 0 }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [error, setError] = useState('');

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      const res = await batchListFolderConnections();
      setList(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || '목록 조회 실패');
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, [refreshKey]);

  /** 프로토콜별 연결 구분용 표시: SFTP=host(IP), S3=bucket(region) */
  function getConnectionInfo(row) {
    const p = (row.protocol || '').toLowerCase();
    if (p === 'sftp') return row.sftp_host || '-';
    if (p === 's3') {
      const bucket = row.s3_bucket || '';
      const region = row.s3_region ? ` (${row.s3_region})` : '';
      return bucket ? `${bucket}${region}` : '-';
    }
    return '-';
  }

  async function handleDelete(folderConnectionId, connectionName) {
    if (!window.confirm(`"${connectionName || folderConnectionId}" 폴더 연결을 삭제하시겠습니까?`)) return;
    setDeleteLoadingId(folderConnectionId);
    setError('');
    try {
      await batchDeleteFolderConnection(folderConnectionId);
      loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '삭제 실패');
    } finally {
      setDeleteLoadingId(null);
    }
  }

  if (loading && list.length === 0 && !error) {
    return <p className="etl-db-form__muted">폴더 연결 목록 로딩 중…</p>;
  }

  if (list.length === 0) {
    return (
      <div className="etl-db-form__section">
        {error ? (
          <p className="etl-db-form__error" role="alert">{error}</p>
        ) : (
          <p className="etl-db-form__muted">등록된 폴더 연결이 없습니다. 위에서 연결을 추가하세요.</p>
        )}
      </div>
    );
  }

  return (
    <CollapsibleCardSection title="등록된 폴더 연결" defaultOpen={true}>
      {error && <p className="etl-db-form__error" role="alert">{error}</p>}
      <div className="etl-db-form__table-wrap">
        <table className="etl-db-form__table">
          <thead>
            <tr>
              <th>연결 이름</th>
              <th>프로토콜</th>
              <th>연결 정보</th>
              <th>상태</th>
              <th>동작</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.folder_connection_id}>
                <td>{row.connection_name || '-'}</td>
                <td>{(row.protocol || '').toUpperCase()}</td>
                <td>{getConnectionInfo(row)}</td>
                <td>{row.is_verified ? '연결됨' : '미검증'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.folder_connection_id, row.connection_name)}
                    disabled={deleteLoadingId === row.folder_connection_id}
                    className="etl-db-form__btn etl-db-form__btn--danger etl-db-form__btn--sm"
                  >
                    {deleteLoadingId === row.folder_connection_id ? '삭제 중…' : '삭제'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCardSection>
  );
}

export default FolderConnectionListFile;
