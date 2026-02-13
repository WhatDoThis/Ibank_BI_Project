/**
 * packages/etl/components/ETLTableList.jsx (ETL 테이블 목록)
 * ========================================================
 * 등록된 ETL 목록 표시, 행별 실행 버튼. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - GET /api/etl/tables 목록 표시, 실행 시 onRun(etl_table_id) 콜백
 * - onRefresh: 목록 새로고침 콜백
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etlListTables)
 */

import { useState, useEffect } from 'react';
import { etlListTables } from '@/shared/api/client';

function ETLTableList({ onRun, lastRunResult, refreshing, runLoading }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await etlListTables();
      setTables(res.tables || []);
    } catch (err) {
      setError(err.message || '목록 조회 실패');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshing]);

  if (loading) return <p className="etl-table-list__loading">목록 로딩 중…</p>;
  if (error) return <p className="etl-table-list__error">{error}</p>;
  if (tables.length === 0) return <p className="etl-table-list__empty">등록된 ETL이 없습니다. 위에서 파일을 업로드하거나 DB 연동 테이블을 등록하세요.</p>;

  return (
    <div className="etl-table-list">
      <table className="etl-table-list__table">
        <thead>
          <tr>
            <th>타겟 테이블</th>
            <th>설명</th>
            <th>소스 유형</th>
            <th>소스</th>
            <th>상태</th>
            <th>동작</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.etl_table_id}>
              <td>{t.target_table}</td>
              <td>{t.description || '—'}</td>
              <td>{t.source_type || '—'}</td>
              <td>{t.source_table || t.file_path || '—'}</td>
              <td>{t.status || '—'}</td>
              <td>
                {(t.source_type === 'file' && (t.file_path || t.file_type)) || (t.source_type === 'postgresql' && t.source_table) ? (
                  <button
                    type="button"
                    className="etl-table-list__run"
                    onClick={() => onRun(t.etl_table_id)}
                    disabled={runLoading}
                  >
                    {runLoading ? '실행 중…' : '실행'}
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ETLTableList;
