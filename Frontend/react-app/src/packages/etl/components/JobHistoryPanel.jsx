/**
 * packages/etl/components/JobHistoryPanel.jsx (ETL Job 이력)
 * ==========================================================
 * 체크박스로 상태별 필터(완료/실패/취소/실행 중/대기 중) 후 테이블로 표시. 행별 삭제(DB 반영).
 * [새로고침]은 ibank-btn-toolbar--secondary, 테이블은 etl-history__table-wrap에서만 가로 스크롤.
 *
 * [Main Functions]
 * ===========
 * 1. JobHistoryPanel: GET /api/etl/jobs (statuses 쿼리), DELETE /api/etl/jobs/:id. 생성자 열: 이메일 셀 + 본인 배지는 adminAccess `isEtlCreateLabelSelf(me, create_user_label, create_user_id)` (`/me` email·user_id 정합, docs/log/log.md 219). 상태 뱃지·삭제·새로고침은 ETL 목록과 동일 클래스.
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js, @/shared/utils/crudConfirm.js
 * - @/app/admin/adminAccess.js (isEtlCreateLabelSelf), @/app/auth/AuthContext.jsx (me)
 */

import { useState, useEffect, useCallback } from 'react';
import { etl2ListJobs, etl2DeleteJob } from '@/packages/etl/api/etlClient.js';
import { confirmCrud } from '@/shared/utils/crudConfirm.js';
import { useAuth } from '@/app/auth/AuthContext.jsx';
import { isEtlCreateLabelSelf } from '@/app/admin/adminAccess.js';

const STATUS_OPTIONS = [
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'cancelled', label: '취소' },
  { value: 'running', label: '실행 중' },
  { value: 'pending', label: '대기 중' }
];

// 0. 상태 열: ETLTableList·BatchJobListFile와 동일 뱃지
function jobStatusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return '완료';
  if (s === 'failed') return '실패';
  if (s === 'cancelled') return '취소';
  if (s === 'running') return '실행 중';
  if (s === 'pending') return '대기 중';
  return status || '—';
}

function jobStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'etl-db-form__status-badge etl-db-form__status--success';
  if (s === 'failed') return 'etl-db-form__status-badge etl-db-form__status--error';
  if (s === 'cancelled') return 'etl-db-form__status-badge etl-db-form__status--idle';
  if (s === 'running') return 'etl-db-form__status-badge etl-db-form__status--running';
  if (s === 'pending') return 'etl-db-form__status-badge etl-db-form__status--partial';
  return null;
}

// 1.
function JobHistoryPanel() {
  const { me } = useAuth();
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
    if (!confirmCrud(`Job #${jobId} 이력을 삭제할까요?`)) return;
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
      <div className="etl-history__filters">
        {STATUS_OPTIONS.map((o) => (
          <label key={o.value} className="etl-history__check">
            <input type="checkbox" checked={!!checks[o.value]} onChange={() => toggleCheck(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <div className="etl-table-list__toolbar">
        <button
          type="button"
          className="ibank-btn-toolbar ibank-btn-toolbar--secondary"
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
                <th>생성자</th>
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
              {jobs.map((j) => {
                const tableLabelStr = j.table_label != null ? String(j.table_label).trim() : '';
                const tableLabelShown = tableLabelStr
                  ? (tableLabelStr.length > 30 ? `${tableLabelStr.slice(0, 30)}…` : tableLabelStr)
                  : '—';
                return (
                <tr key={j.job_id}>
                  <td>{j.job_id}</td>
                  <td className="etl-history__cell--overflow" title={tableLabelStr || ''}>
                    {tableLabelShown}
                  </td>
                  <td className="etl-history__cell-creator">
                    <span className="admin-users__email-cell">
                      <span className="admin-users__email-text" title={j.create_user_label || ''}>
                        {j.create_user_label || '—'}
                      </span>
                      {isEtlCreateLabelSelf(me, j.create_user_label, j.create_user_id) ? (
                        <span className="admin-users__self-badge" title="본인 계정">
                          본인
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="etl-history__cell--overflow" title={j.target_table || ''}>{j.target_table || '—'}</td>
                  <td>
                    {jobStatusBadgeClass(j.status) ? (
                      <span className={jobStatusBadgeClass(j.status)}>{jobStatusLabel(j.status)}</span>
                    ) : (
                      jobStatusLabel(j.status)
                    )}
                  </td>
                  <td>{j.started_at ? new Date(j.started_at).toLocaleString('ko-KR', { hour12: false }) : '—'}</td>
                  <td>{j.finished_at ? new Date(j.finished_at).toLocaleString('ko-KR', { hour12: false }) : '—'}</td>
                  <td>{j.rows_processed != null ? j.rows_processed : '—'}</td>
                  <td className="etl-history__err etl-history__cell--overflow" title={j.error_message || ''}>
                    {(j.error_message || '').slice(0, 40)}{(j.error_message || '').length > 40 ? '…' : ''}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="etl-db-form__btn etl-db-form__btn--danger etl-db-form__btn--sm"
                      onClick={() => handleDelete(j.job_id)}
                      disabled={deletingId != null}
                    >
                      {deletingId === j.job_id ? '삭제 중…' : '삭제'}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default JobHistoryPanel;
