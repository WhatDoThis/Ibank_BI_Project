/**
 * BatchScheduleModal.jsx (ETL 테이블 기반 배치 스케줄 설정 모달)
 * =================================================================
 * ETL 테이블 행에서 "배치설정" 클릭 시 표시.
 * - 해당 ETL에 배치잡이 없으면: 등록 폼 (job_name, interval, batch_size 등)
 * - 이미 배치잡이 있으면: 현재 설정 표시 + 수정/토글/삭제
 * 소스/타겟/매핑은 ETL 테이블에서 참조하므로 입력 불필요.
 *
 * [Main Functions]
 * ===========
 * - 기존 배치 조회: batchListJobs(..., 'db') 후 etl_table_id 매칭
 * - 미등록 시: batchCreateJobFromEtlTable 호출
 * - 등록됨: batchUpdateJob, batchToggleJob, batchDeleteJob, batchRunJobNow
 *
 * [Props]
 * =====
 * - open: boolean
 * - onClose: () => void
 * - etlTable: { etl_table_id, connection_name, source_table, target_table, sync_mode, ... }
 * - onSuccess: () => void — 등록/수정/삭제/토글/즉시실행 후 콜백
 *
 * [Dependencies]
 * ==========
 * - React, @/shared/api/client (batchListJobs, batchCreateJobFromEtlTable, batchUpdateJob, batchToggleJob, batchDeleteJob, batchRunJobNow)
 * - etl.css (etl-db-form__*, etl-add-file-modal__*)
 */

import { useState, useEffect } from 'react';
import {
  batchListJobs,
  batchCreateJobFromEtlTable,
  batchUpdateJob,
  batchToggleJob,
  batchDeleteJob,
  batchRunJobNow,
} from '@/shared/api/client';

const INTERVAL_MIN = 10;
const INTERVAL_MAX = 1440;

function BatchScheduleModal({ open, onClose, etlTable, onSuccess }) {
  const [existingJob, setExistingJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [jobName, setJobName] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [batchSize, setBatchSize] = useState('');
  const [batchIntervalSeconds, setBatchIntervalSeconds] = useState('');
  const [onRowError, setOnRowError] = useState('fail');
  const [isActive, setIsActive] = useState(true);

  const etlTableId = etlTable?.etl_table_id;

  useEffect(() => {
    if (!open || !etlTableId) return;
    setLoading(true);
    setError('');
    batchListJobs(undefined, undefined, 'db')
      .then((res) => {
        const jobs = res?.jobs || [];
        const found = jobs.find((j) => j.etl_table_id === etlTableId);
        setExistingJob(found || null);
        if (found) {
          setJobName(found.job_name || '');
          setIntervalMinutes(found.interval_minutes ?? 60);
          setBatchSize(found.batch_size != null ? String(found.batch_size) : '');
          setBatchIntervalSeconds(
            found.batch_interval_seconds != null ? String(found.batch_interval_seconds) : ''
          );
          setOnRowError(found.on_row_error || 'fail');
          setIsActive(found.is_active ?? true);
        } else {
          setJobName(`${etlTable.target_table || 'ETL'} 자동 동기화`);
          setIntervalMinutes(60);
          setBatchSize('');
          setBatchIntervalSeconds('');
          setOnRowError('fail');
          setIsActive(true);
        }
      })
      .catch(() => setExistingJob(null))
      .finally(() => setLoading(false));
  }, [open, etlTableId, etlTable?.target_table]);

  async function handleRegister() {
    setError('');
    if (!jobName.trim()) {
      setError('Job 이름을 입력하세요.');
      return;
    }
    const interval = Number(intervalMinutes);
    if (Number.isNaN(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) {
      setError(`실행 주기는 ${INTERVAL_MIN}~${INTERVAL_MAX}분 사이로 입력하세요.`);
      return;
    }
    setSaving(true);
    try {
      await batchCreateJobFromEtlTable({
        etl_table_id: etlTableId,
        job_name: jobName.trim(),
        interval_minutes: interval,
        batch_size: batchSize.trim() ? parseInt(batchSize, 10) || null : null,
        batch_interval_seconds: batchIntervalSeconds.trim()
          ? parseInt(batchIntervalSeconds, 10) || null
          : null,
        on_row_error: onRowError || 'fail',
        is_active: isActive,
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '배치 등록 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!existingJob) return;
    setError('');
    setSaving(true);
    try {
      const updates = {};
      if (jobName.trim() !== (existingJob.job_name || '')) updates.job_name = jobName.trim();
      const interval = Number(intervalMinutes);
      if (interval !== (existingJob.interval_minutes ?? 60)) updates.interval_minutes = interval;
      const bs = batchSize.trim() ? parseInt(batchSize, 10) : null;
      if (bs !== existingJob.batch_size) updates.batch_size = bs;
      const bis = batchIntervalSeconds.trim() ? parseInt(batchIntervalSeconds, 10) : null;
      if (bis !== existingJob.batch_interval_seconds) updates.batch_interval_seconds = bis;
      if (onRowError !== (existingJob.on_row_error || 'fail')) updates.on_row_error = onRowError;
      if (Object.keys(updates).length > 0) {
        await batchUpdateJob(existingJob.batch_job_id, updates);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '수정 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!existingJob) return;
    try {
      await batchToggleJob(existingJob.batch_job_id);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '토글 실패');
    }
  }

  async function handleDelete() {
    if (!existingJob) return;
    if (!window.confirm('이 배치 스케줄을 삭제하시겠습니까? ETL 테이블은 유지됩니다.')) return;
    try {
      await batchDeleteJob(existingJob.batch_job_id);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || '삭제 실패');
    }
  }

  async function handleRunNow() {
    if (!existingJob) return;
    setError('');
    try {
      const res = await batchRunJobNow(existingJob.batch_job_id);
      if (res?.already_running) {
        setError(res.message || '해당 배치가 이미 실행 중입니다. 완료 후 다시 시도하세요.');
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err?.message || '즉시 실행 실패');
    }
  }

  if (!open) return null;

  return (
    <div className="etl-add-file-modal" role="dialog" aria-modal="true" aria-labelledby="batch-schedule-modal-title">
      <div className="etl-add-file-modal__backdrop" onClick={onClose} />
      <div className="etl-add-file-modal__box" style={{ maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="etl-add-file-modal__head" style={{ flexShrink: 0 }}>
          <h3 id="batch-schedule-modal-title">배치 스케줄 설정</h3>
          <button type="button" className="etl-add-file-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div className="etl-db-form__summary-box" style={{ marginBottom: '16px' }}>
            <p><strong>소스:</strong> {etlTable?.connection_name ?? '—'} / {etlTable?.source_table ?? '—'}</p>
            <p><strong>타겟:</strong> {etlTable?.target_table ?? '—'}</p>
            <p><strong>동기화:</strong> {(etlTable?.sync_mode || '').toLowerCase() === 'incremental' ? '증분' : '전체'}</p>
            <p className="etl-db-form__muted" style={{ marginTop: '8px' }}>
              소스·타겟·매핑·증분 컬럼은 ETL 테이블 설정에서 관리됩니다. 여기서는 주기 실행 설정만 합니다.
            </p>
          </div>

          {loading ? (
            <p className="etl-db-form__muted">조회 중…</p>
          ) : (
            <div className="etl-db-form__connect-form">
              {existingJob && (
                <div style={{ marginBottom: '12px', padding: '10px', background: '#f0f9ff', borderRadius: '8px' }}>
                  <p>
                    <strong>현재 배치:</strong> {existingJob.job_name}
                    {' — '}
                    <span style={{ color: existingJob.is_active ? '#16a34a' : '#9ca3af' }}>
                      {existingJob.is_active ? '활성' : '비활성'}
                    </span>
                    {existingJob.last_run_status && ` (최근: ${existingJob.last_run_status})`}
                  </p>
                </div>
              )}

              <div className="etl-db-form__field">
                <label className="etl-db-form__label">Job 이름</label>
                <input
                  type="text"
                  className="etl-db-form__input"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="배치 표시명"
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">실행 주기 (분)</label>
                <input
                  type="number"
                  className="etl-db-form__input"
                  min={INTERVAL_MIN}
                  max={INTERVAL_MAX}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value) || 60)}
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">배치 크기 (행)</label>
                <span className="etl-db-form__label-desc">
                  ETL 테이블의 배치 크기와 별개로, 배치잡 실행 시 사용할 값. 비우면 ETL 테이블 설정값 사용.
                </span>
                <input
                  type="number"
                  className="etl-db-form__input"
                  placeholder="비우면 ETL 테이블 설정 사용"
                  min={0}
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">배치 간 대기 (초)</label>
                <input
                  type="number"
                  className="etl-db-form__input"
                  placeholder="0"
                  min={0}
                  value={batchIntervalSeconds}
                  onChange={(e) => setBatchIntervalSeconds(e.target.value)}
                />
              </div>
              <div className="etl-db-form__field">
                <label className="etl-db-form__label">행 오류 시</label>
                <span className="etl-db-form__label-desc">
                  배치 실행 시 적용. 비우면 ETL 테이블의 on_row_error 사용.
                </span>
                <select
                  className="etl-db-form__input"
                  value={onRowError}
                  onChange={(e) => setOnRowError(e.target.value)}
                >
                  <option value="fail">중단</option>
                  <option value="skip">해당 행 스킵</option>
                </select>
              </div>
              {!existingJob && (
                <div className="etl-db-form__field">
                  <label className="etl-db-form__label">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    {' '}등록 후 즉시 활성화
                  </label>
                </div>
              )}

              {error && (
                <p className="etl-db-form__message etl-db-form__message--warning">{error}</p>
              )}

              <div className="etl-db-form__actions" style={{ marginTop: '16px' }}>
                {existingJob ? (
                  <>
                    <button
                      type="button"
                      className="etl-db-form__btn etl-db-form__btn--primary"
                      onClick={handleUpdate}
                      disabled={saving}
                    >
                      {saving ? '저장 중…' : '설정 저장'}
                    </button>
                    <button
                      type="button"
                      className="etl-db-form__btn"
                      onClick={handleRunNow}
                    >
                      즉시 실행
                    </button>
                    <button
                      type="button"
                      className="etl-db-form__btn"
                      onClick={handleToggle}
                    >
                      {existingJob.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      type="button"
                      className="etl-db-form__btn etl-db-form__btn--danger"
                      onClick={handleDelete}
                    >
                      배치 삭제
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="etl-db-form__btn etl-db-form__btn--primary"
                    onClick={handleRegister}
                    disabled={saving}
                  >
                    {saving ? '등록 중…' : '배치 등록'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchScheduleModal;
