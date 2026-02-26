/**
 * packages/etl/components/JobHistoryPanel.jsx (ETL Job 이력)
 * ==========================================================
 * 체크박스로 상태별 필터(완료/실패/취소/실행 중/대기 중) 후 테이블로 표시. 행별 삭제(DB 반영).
 * [새로고침] 버튼으로 해당 이력 테이블만 다시 불러오기.
 *
 * [Main Functions]
 * ===========
 * JobHistoryPanel: GET /api/etl/jobs (statuses 쿼리), DELETE /api/etl/jobs/:id. 상태별 체크박스·로딩·삭제 중 비활성화
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListJobs, etl2DeleteJob)
 */

import { useState, useEffect, useCallback } from 'react';
import { etl2ListJobs, etl2DeleteJob } from '@/shared/api/client';

const STATUS_OPTIONS = [
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'cancelled', label: '취소' },
  { value: 'running', label: '실행 중' },
  { value: 'pending', label: '대기 중' }
];

function JobHistoryPanel() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState({ completed: true, failed: true, cancelled: true, running: true, pending: true });
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    const active = STATUS_OPTIONS.filter((o) => checks[o.value]).map((o) => o.value);
    if (active.length === 0) {
      setJobs([]);
      return;
    }
    setLoading(true);
    try {
      const res = await etl2ListJobs(null, active.join(','));
      setJobs(res?.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [checks]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(jobId) {
    if (deletingId != null) return;
    setDeletingId(jobId);
    try {
      await etl2DeleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
    } catch (_) {}
    finally {
      setDeletingId(null);
    }
  }

  function toggleCheck(key) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="etl-history">
      <div className="etl-history__bar">
        <div className="etl-history__filters">
          {STATUS_OPTIONS.map((o) => (
            <label key={o.value} className="etl-history__check">
              <input type="checkbox" checked={!!checks[o.value]} onChange={() => toggleCheck(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="etl-history__refresh"
          onClick={() => load()}
          disabled={loading}
          aria-label="이력 새로고침"
        >
          {loading ? '새로고침 중…' : '새로고침'}
        </button>
      </div>
      {loading && <p className="etl-history__loading">조회 중…</p>}
      {!loading && jobs.length === 0 && <p className="etl-history__empty">선택한 상태의 이력이 없습니다.</p>}
      {!loading && jobs.length > 0 && (
        <div className="etl-history__table-wrap">
          <table className="etl-history__table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>라벨</th>
                <th>타겟 테이블</th>
                <th>상태</th>
                <th>시작</th>
                <th>종료</th>
                <th>처리 건수</th>
                <th>에러</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job_id}>
                  <td>{j.job_id}</td>
                  <td className="etl-history__cell--overflow" title={j.description || ''}>
                    {(j.description || '').slice(0, 30)}{(j.description || '').length > 30 ? '…' : ''}
                  </td>
                  <td className="etl-history__cell--overflow" title={j.target_table || ''}>{j.target_table || '—'}</td>
                  <td>{j.status || '—'}</td>
                  <td>{j.started_at ? new Date(j.started_at).toLocaleString('ko-KR', { hour12: false }) : '—'}</td>
                  <td>{j.finished_at ? new Date(j.finished_at).toLocaleString('ko-KR', { hour12: false }) : '—'}</td>
                  <td>{j.rows_processed != null ? j.rows_processed : '—'}</td>
                  <td className="etl-history__err etl-history__cell--overflow" title={j.error_message || ''}>
                    {(j.error_message || '').slice(0, 40)}{(j.error_message || '').length > 40 ? '…' : ''}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="etl-history__del"
                      onClick={() => handleDelete(j.job_id)}
                      disabled={deletingId != null}
                    >
                      {deletingId === j.job_id ? '삭제 중…' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default JobHistoryPanel;
