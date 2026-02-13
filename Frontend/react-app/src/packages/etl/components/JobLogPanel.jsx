/**
 * packages/etl/components/JobLogPanel.jsx (Job 실행 결과 패널)
 * ===========================================================
 * 실행 결과: 타겟 테이블, Job ID, 상태, 시작 시각, 경과 시간, 예상 남은 시간/완료 시각, 처리 건수, 에러 표시.
 *
 * [Main Functions]
 * ===========
 * - result: target_table, job_id, status, started_at, rows_processed, total_rows, error_message 표시. onCancel, onClose, cancelLoading 지원.
 * - running/pending 시 배경·테두리 구분(--running, --pending). 경과·예상 남은 시간·예상 완료 시각 계산.
 *
 * [Dependencies]
 * =========
 * - React
 */

import { useState, useEffect } from 'react';

function elapsedSeconds(startedAtIso) {
  if (!startedAtIso) return 0;
  return Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000);
}

function formatElapsed(startedAtIso) {
  const sec = elapsedSeconds(startedAtIso);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return `${min}분 ${s}초`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}시간 ${m}분 ${s}초`;
}

function formatRemaining(seconds) {
  if (seconds <= 0) return '0초';
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const min = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (min < 60) return `${min}분 ${s}초`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}시간 ${m}분 ${s}초`;
}

function JobLogPanel({ result, onCancel, onClose, cancelLoading }) {
  const lastRunResult = result;
  const [elapsed, setElapsed] = useState(null);
  const isLive = lastRunResult?.status === 'running' || lastRunResult?.status === 'pending';
  const isRunning = lastRunResult?.status === 'running';
  const isPending = lastRunResult?.status === 'pending';

  useEffect(() => {
    if (!isLive || !lastRunResult?.started_at) {
      setElapsed(null);
      return;
    }
    const tick = () => setElapsed(formatElapsed(lastRunResult.started_at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLive, lastRunResult?.started_at]);

  if (!lastRunResult) return null;

  const { job_id, status, rows_processed, total_rows, error_message, target_table, description, started_at } = lastRunResult;
  const isOk = status === 'completed';
  const isCancelled = status === 'cancelled';
  const displayElapsed = isLive ? elapsed : null;
  const startedStr = started_at ? new Date(started_at).toLocaleString('ko-KR', { hour12: false }) : null;

  const canShowEta = isLive && total_rows != null && total_rows > 0 && rows_processed != null && rows_processed > 0 && started_at;
  const elapsedSec = started_at ? elapsedSeconds(started_at) : 0;
  const remainingSec = canShowEta && elapsedSec > 0
    ? (elapsedSec / rows_processed) * (total_rows - rows_processed)
    : null;
  const etaLabel = remainingSec != null && remainingSec > 0 ? formatRemaining(remainingSec) : null;
  const etaFinishAt = remainingSec != null && remainingSec > 0
    ? new Date(Date.now() + remainingSec * 1000).toLocaleString('ko-KR', { hour12: false })
    : null;

  const statusMod = isOk ? 'etl-job-log--success' : isCancelled ? 'etl-job-log--cancelled' : isRunning ? 'etl-job-log--running' : isPending ? 'etl-job-log--pending' : 'etl-job-log--failed';

  return (
    <div className={`etl-job-log ${statusMod}`}>
      <div className="etl-job-log__head">
        <h3 className="etl-job-log__title">{(description && String(description).trim()) || target_table || '실행 결과'}</h3>
        {onClose && (
          <button type="button" className="etl-job-log__close" onClick={onClose} aria-label="닫기">×</button>
        )}
      </div>
      <ul className="etl-job-log__list">
        {target_table && <li><strong>타겟 테이블:</strong> {target_table}</li>}
        {job_id != null && <li>Job ID: {job_id}</li>}
        <li>상태: {status ?? '—'}</li>
        {startedStr && <li>시작 시각: {startedStr}</li>}
        {(displayElapsed || (isLive && started_at)) && <li>경과: {displayElapsed ?? formatElapsed(started_at) ?? '—'}</li>}
        {etaLabel != null && <li>예상 남은 시간: {etaLabel}</li>}
        {etaFinishAt != null && <li>예상 완료 시각: {etaFinishAt}</li>}
        {rows_processed != null && <li>처리 건수: {rows_processed}{total_rows != null && total_rows > 0 ? ` / ${total_rows}` : ''}</li>}
        {error_message && <li className="etl-job-log__error">에러: {error_message}</li>}
      </ul>
      {onCancel && (lastRunResult?.status === 'running' || lastRunResult?.status === 'pending') && (
        <div className="etl-job-log__actions">
          <button
            type="button"
            className="etl-job-log__cancel"
            onClick={onCancel}
            disabled={cancelLoading}
          >
            {cancelLoading ? '취소 중…' : '실행 취소'}
          </button>
        </div>
      )}
    </div>
  );
}

export default JobLogPanel;
