/**
 * packages/etl/components/ETLTableList.jsx (ETL 테이블 목록)
 * ========================================================
 * 등록된 ETL 목록, 행별 실행/대기 중/실행 중·삭제. 큐 상태 2초 폴링으로 행별 표시.
 *
 * [Main Functions]
 * ===========
 * - GET /api/etl/tables 목록, GET /api/etl/jobs로 실행 중·대기 중 Job 조회 후 행별 버튼 문구(실행|대기 중|실행 중)
 * - 실행 버튼: 해당 행이 running → "실행 중", pending → "대기 중", 없으면 "실행" (클릭 시 대기열 등록)
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etlListTables, etlListJobs, etlDeleteTable)
 */

import { useState, useEffect, useRef } from 'react';
import { etlListTables, etlListJobs, etlDeleteTable } from '@/shared/api/client';

function ETLTableList({ onRun, refreshing, runLoading, onDelete }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queueStatus, setQueueStatus] = useState({});
  const pollRef = useRef(null);

  async function loadQueueStatus() {
    try {
      const res = await etlListJobs();
      const jobs = res.jobs || [];
      const byTable = {};
      for (const j of jobs) {
        if (j.status !== 'running' && j.status !== 'pending') continue;
        const id = j.etl_table_id;
        if (id != null && (byTable[id] == null || (byTable[id].status === 'pending' && j.status === 'running'))) {
          byTable[id] = { job_id: j.job_id, status: j.status };
        }
      }
      setQueueStatus(byTable);
    } catch {
      setQueueStatus({});
    }
  }

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

  useEffect(() => {
    if (tables.length === 0) return;
    loadQueueStatus();
    pollRef.current = setInterval(loadQueueStatus, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tables.length, refreshing]);

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
          {tables.map((t) => {
            const q = queueStatus[t.etl_table_id];
            const runLabel = q?.status === 'running' ? '실행 중' : q?.status === 'pending' ? '대기 중' : '실행';
            const runDisabled = q?.status === 'running' || q?.status === 'pending';
            const rowRunning = q?.status === 'running';
            const rowPending = q?.status === 'pending';
            const statusText = rowRunning ? '실행 중' : rowPending ? '대기 중' : (t.status || '—');
            const rowClass = [
              rowRunning && 'etl-table-list__row--running',
              rowPending && 'etl-table-list__row--pending'
            ].filter(Boolean).join(' ');
            return (
            <tr key={t.etl_table_id} className={rowClass || undefined}>
              <td>{t.target_table}</td>
              <td>{t.description || '—'}</td>
              <td>{t.source_type || '—'}</td>
              <td>{t.source_table || t.file_path || '—'}</td>
              <td className={rowRunning ? 'etl-table-list__status--running' : rowPending ? 'etl-table-list__status--pending' : undefined}>{statusText}</td>
              <td>
                <span className="etl-table-list__actions">
                  {(t.source_type === 'file' && (t.file_path || t.file_type)) || (t.source_type === 'postgresql' && t.source_table) ? (
                    <button
                      type="button"
                      className={`etl-table-list__run ${runDisabled ? 'etl-table-list__run--busy' : ''}`}
                      onClick={() => onRun(t.etl_table_id)}
                      disabled={runDisabled}
                    >
                      {runLabel}
                    </button>
                  ) : (
                    '—'
                  )}
                  <button
                    type="button"
                    className="etl-table-list__delete"
                    onClick={() => {
                      const msg = `다음 ETL을 삭제합니다.\n· 타겟 테이블 "${t.target_table}"이(가) 메인 DB에서 DROP됩니다.\n· 파일 소스인 경우 업로드 파일도 삭제됩니다.\n계속할까요?`;
                      if (window.confirm(msg)) {
                        etlDeleteTable(t.etl_table_id)
                          .then(() => { if (onDelete) onDelete(); load(); })
                          .catch((err) => { setError(err.message || '삭제 실패'); load(); });
                      }
                    }}
                    disabled={runDisabled}
                  >
                    삭제
                  </button>
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ETLTableList;
