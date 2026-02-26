/**
 * BatchJobListFile.jsx (배치 Job 목록)
 * ======================================
 * 09_ETL_SFTP_Connection Phase 3/6. 배치 Job 목록 테이블, 활성/비활성·즉시 실행·이력·삭제.
 * Phase 6: last_run_status 뱃지(성공/에러/실행중/대기), 다음 예상 실행 열, PK 미설정 시 행 경고.
 *
 * [Main Functions]
 * ===========
 * - batchListJobs() 로 목록 조회 (mount, refreshKey 변경 시)
 * - 테이블: job_name, folder, file_pattern, storage, 주기, 상태, 마지막 상태(뱃지), 마지막 실행, 다음 예상, 동작
 * - 동작: 활성/비활성(batchToggleJob), 즉시 실행(batchRunJobNow), 이력(onOpenHistory?), 삭제(batchDeleteJob + 확인)
 *
 * [Props]
 * =====
 * - onSuccess: () => void — 목록 갱신 후 콜백 (refresh 트리거)
 * - refreshKey: number — 변경 시 재조회
 * - onOpenHistory: (batchJobId: number) => void — 선택 시 이력 패널/모달 열기 (optional)
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListJobs, batchToggleJob, batchRunJobNow, batchDeleteJob)
 * - etl.css (etl-db-form__table, etl-db-form__status--*)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  batchListJobs,
  batchToggleJob,
  batchRunJobNow,
  batchDeleteJob
} from '@/shared/api/client';
import SkippedFilesPanelFile from './SkippedFilesPanelFile';
import '../etl.css';

function BatchJobListFile({ onSuccess, refreshKey = 0, onOpenHistory }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [skippedJobId, setSkippedJobId] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await batchListJobs();
      const jobs = Array.isArray(res) ? res : (res?.jobs ?? []);
      setList(jobs);
    } catch (err) {
      setError(err?.message || '목록 조회 실패');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList, refreshKey]);

  async function handleToggle(id) {
    if (actionLoadingId != null) return;
    setActionLoadingId(id);
    setError('');
    try {
      await batchToggleJob(id);
      await loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '토글 실패');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRunNow(id) {
    if (actionLoadingId != null) return;
    setActionLoadingId(id);
    setError('');
    try {
      await batchRunJobNow(id);
      await loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '즉시 실행 실패');
    } finally {
      setActionLoadingId(null);
    }
  }

  function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'success') return 'etl-db-form__status-badge etl-db-form__status--success';
    if (s === 'error') return 'etl-db-form__status-badge etl-db-form__status--error';
    if (s === 'running') return 'etl-db-form__status-badge etl-db-form__status--running';
    return 'etl-db-form__status-badge etl-db-form__status--idle';
  }

  function getStatusLabel(status) {
    const s = (status || '').toLowerCase();
    if (s === 'success') return '성공';
    if (s === 'error') return '에러';
    if (s === 'running') return '실행중';
    return '대기';
  }

  function formatNextRun(lastRunAt, intervalMinutes) {
    if (lastRunAt == null || lastRunAt === '' || intervalMinutes == null) return '-';
    const date = new Date(lastRunAt);
    if (Number.isNaN(date.getTime())) return '-';
    const next = new Date(date.getTime() + Number(intervalMinutes) * 60 * 1000);
    return next.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  }

  async function handleDelete(row) {
    const name = row.job_name || row.batch_job_id;
    if (!window.confirm(`"${name}" 배치 Job을 삭제하시겠습니까?`)) return;
    setActionLoadingId(row.batch_job_id);
    setError('');
    try {
      await batchDeleteJob(row.batch_job_id);
      await loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '삭제 실패');
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading && list.length === 0 && !error) {
    return <p className="etl-db-form__muted">배치 Job 목록 로딩 중…</p>;
  }

  if (list.length === 0) {
    return (
      <div className="etl-db-form__section">
        {error ? (
          <p className="etl-db-form__error" role="alert">{error}</p>
        ) : (
          <p className="etl-db-form__muted">등록된 배치 Job이 없습니다. 위에서 Job을 등록하세요.</p>
        )}
      </div>
    );
  }

  return (
    <section className="etl-db-form__section">
      <h3 className="etl-db-form__heading">배치 Job 목록</h3>
      {error && <p className="etl-db-form__error" role="alert">{error}</p>}
      <div className="etl-db-form__table-wrap">
        <table className="etl-db-form__table">
          <thead>
            <tr>
              <th>Job 이름</th>
              <th>폴더</th>
              <th>파일 패턴</th>
              <th>저장 DB</th>
              <th>주기(분)</th>
              <th>상태</th>
              <th>마지막 상태</th>
              <th>마지막 실행 시각</th>
              <th>다음 예상 실행</th>
              <th>동작</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const id = row.batch_job_id;
              const busy = actionLoadingId === id;
              const folderName = row.connection_name ?? row.folder_connection_name ?? '-';
              const storageName = row.storage_connection_name ?? (row.storage_connection_id ? `#${row.storage_connection_id}` : '기본');
              const lastStatus = row.last_run_status ?? 'idle';
              const lastRunAt = row.last_run_at;
              const nextRun = formatNextRun(lastRunAt, row.interval_minutes);
              const displayLastRunAt = lastRunAt != null && lastRunAt !== '' ? (typeof lastRunAt === 'string' && lastRunAt.length > 10 ? new Date(lastRunAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : lastRunAt) : '-';
              const noPk = !row.pk_columns?.trim();
              return (
                <tr key={id}>
                  <td>
                    {row.job_name ?? '-'}
                    {noPk && <span className="etl-db-form__message etl-db-form__message--warning" style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem' }}>PK 미설정: 중복 행 발생 가능</span>}
                  </td>
                  <td>{folderName}</td>
                  <td>{row.file_pattern ?? '-'}</td>
                  <td>{storageName}</td>
                  <td>{row.interval_minutes ?? '-'}</td>
                  <td>{row.is_active ? '활성' : '비활성'}</td>
                  <td><span className={getStatusClass(lastStatus)}>{getStatusLabel(lastStatus)}</span></td>
                  <td>{displayLastRunAt}</td>
                  <td title={nextRun !== '-' ? `다음 예상: ${nextRun}` : undefined}>{nextRun}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                        onClick={() => handleToggle(id)}
                        disabled={busy}
                        title={row.is_active ? '비활성으로 전환' : '활성으로 전환'}
                      >
                        {row.is_active ? '비활성' : '활성'}
                      </button>
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--primary etl-db-form__btn--sm"
                        onClick={() => handleRunNow(id)}
                        disabled={busy}
                      >
                        즉시 실행
                      </button>
                      {onOpenHistory && (
                        <button
                          type="button"
                          className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                          onClick={() => onOpenHistory(id)}
                        >
                          이력
                        </button>
                      )}
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                        onClick={() => setSkippedJobId(id)}
                        title="스킵/에러 파일 조회·삭제"
                      >
                        문제 파일
                      </button>
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--danger etl-db-form__btn--sm"
                        onClick={() => handleDelete(row)}
                        disabled={busy}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {skippedJobId != null && (
        <SkippedFilesPanelFile
          batchJobId={skippedJobId}
          onClose={() => setSkippedJobId(null)}
        />
      )}
    </section>
  );
}

export default BatchJobListFile;
