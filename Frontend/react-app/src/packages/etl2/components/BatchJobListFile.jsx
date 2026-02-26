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
 * - 툴바: 새로고침 버튼(loadList) — 목록만 재조회
 * - 동작: 활성/비활성(batchToggleJob), 주기 수정(batchUpdateJob), 즉시 실행(batchRunJobNow), 이력(onOpenHistory?), 삭제(batchDeleteJob + 확인)
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
  batchDeleteJob,
  batchUpdateJob
} from '@/shared/api/client';
import SkippedFilesPanelFile from './SkippedFilesPanelFile';
import '../etl.css';

function BatchJobListFile({ onSuccess, refreshKey = 0, onOpenHistory }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [skippedJobId, setSkippedJobId] = useState(null);
  const [editIntervalJob, setEditIntervalJob] = useState(null);

  const INTERVAL_MIN = 10;
  const INTERVAL_MAX = 1440;

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

  async function handleToggle(row) {
    if (actionLoadingId != null) return;
    const id = row.batch_job_id;
    const goingInactive = row.is_active;
    if (goingInactive) {
      if (!window.confirm('비활성하면 설정한 주기가 와도 자동 실행되지 않습니다. 비활성화할까요?')) return;
    } else {
      if (!window.confirm('활성화하면 주기 실행이 재개됩니다. 쌓인 파일은 다음 실행 시 처리됩니다(주기 지났으면 곧, 안 지났으면 다음 주기 시각). 활성화할까요?')) return;
    }
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
    if (s === 'success') return '완료';
    if (s === 'error') return '오류';
    if (s === 'running') return '실행 중';
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

  const [intervalEditValue, setIntervalEditValue] = useState('');
  const [intervalEditError, setIntervalEditError] = useState('');
  const [intervalSaving, setIntervalSaving] = useState(false);

  function openIntervalEdit(row) {
    setEditIntervalJob({ batch_job_id: row.batch_job_id, job_name: row.job_name, interval_minutes: row.interval_minutes });
    setIntervalEditValue(String(row.interval_minutes ?? INTERVAL_MIN));
    setIntervalEditError('');
  }

  async function handleIntervalSave(e) {
    e.preventDefault();
    if (!editIntervalJob) return;
    const v = Number(intervalEditValue);
    if (Number.isNaN(v) || v < INTERVAL_MIN || v > INTERVAL_MAX) {
      setIntervalEditError(`${INTERVAL_MIN}~${INTERVAL_MAX}분 사이로 입력하세요.`);
      return;
    }
    setIntervalSaving(true);
    setIntervalEditError('');
    try {
      await batchUpdateJob(editIntervalJob.batch_job_id, { interval_minutes: v });
      setEditIntervalJob(null);
      await loadList();
      if (onSuccess) onSuccess();
    } catch (err) {
      setIntervalEditError(err?.message || '주기 수정 실패');
    } finally {
      setIntervalSaving(false);
    }
  }

  const refreshBtn = (
    <button
      type="button"
      className="etl-batch-job-list__refresh"
      onClick={() => loadList()}
      disabled={loading}
      aria-label="목록 새로고침"
    >
      {loading ? '새로고침 중…' : '새로고침'}
    </button>
  );

  if (loading && list.length === 0 && !error) {
    return (
      <div className="etl-batch-job-list__section">
        <div className="etl-batch-job-list__toolbar">{refreshBtn}</div>
        <p className="etl-db-form__muted">배치 Job 목록 로딩 중…</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="etl-batch-job-list__section">
        <div className="etl-batch-job-list__toolbar">{refreshBtn}</div>
        {error ? (
          <p className="etl-db-form__error" role="alert">{error}</p>
        ) : (
          <p className="etl-db-form__muted">등록된 배치 Job이 없습니다. 위에서 Job을 등록하세요.</p>
        )}
      </div>
    );
  }

  return (
    <section className="etl-db-form__section etl-batch-job-list__section">
      <h3 className="etl-db-form__heading">배치 Job 목록</h3>
      <div className="etl-batch-job-list__toolbar">{refreshBtn}</div>
      {error && <p className="etl-db-form__error" role="alert">{error}</p>}
      <div className="etl-db-form__table-wrap">
        <table className="etl-db-form__table etl-db-form__table--compact etl-batch-job-list__table">
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
                    <span>
                      {row.job_name ?? '-'}
                      {noPk && <span className="etl-db-form__message etl-db-form__message--warning" style={{ marginLeft: '6px', fontSize: '0.8rem' }} title="중복 행 발생 가능">PK 미설정</span>}
                    </span>
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
                    <div className="etl-batch-job-list__actions">
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                        onClick={() => handleToggle(row)}
                        disabled={busy}
                        title={row.is_active ? '비활성: 주기 실행 중단' : '활성: 마지막 실행 이후 파일 다음 주기에 처리'}
                      >
                        {row.is_active ? '비활성' : '활성'}
                      </button>
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                        onClick={() => openIntervalEdit(row)}
                        disabled={busy}
                        title="실행 주기(분) 변경. 10~1440"
                      >
                        주기 수정
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
      {editIntervalJob != null && (
        <div className="etl-pk-modal" role="dialog" aria-modal="true" aria-labelledby="etl-interval-modal-title">
          <div className="etl-pk-modal__backdrop" onClick={() => !intervalSaving && setEditIntervalJob(null)} />
          <div className="etl-pk-modal__box" style={{ maxWidth: '400px' }}>
            <div className="etl-pk-modal__head">
              <h3 id="etl-interval-modal-title">주기 수정</h3>
              <button type="button" className="etl-pk-modal__close" onClick={() => !intervalSaving && setEditIntervalJob(null)} aria-label="닫기">×</button>
            </div>
            <p className="etl-pk-modal__hint">
              Job: {editIntervalJob.job_name ?? `#${editIntervalJob.batch_job_id}`}. 실행 주기는 10~1440분(24시간) 사이로 설정할 수 있습니다.
            </p>
            <form onSubmit={handleIntervalSave} className="etl-pk-modal__form">
              {intervalEditError && <p className="etl-pk-modal__error">{intervalEditError}</p>}
              <div className="etl-pk-modal__checkbox-wrap" style={{ marginBottom: 12 }}>
                <span className="etl-pk-modal__label">주기(분)</span>
                <input
                  type="number"
                  min={INTERVAL_MIN}
                  max={INTERVAL_MAX}
                  value={intervalEditValue}
                  onChange={(e) => setIntervalEditValue(e.target.value)}
                  className="etl-pk-modal__input"
                  style={{ width: '100%', maxWidth: 120 }}
                  disabled={intervalSaving}
                />
              </div>
              <div className="etl-pk-modal__actions">
                <button type="button" className="etl-pk-modal__cancel" onClick={() => !intervalSaving && setEditIntervalJob(null)} disabled={intervalSaving}>취소</button>
                <button type="submit" className="etl-pk-modal__submit" disabled={intervalSaving}>{intervalSaving ? '저장 중…' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default BatchJobListFile;
