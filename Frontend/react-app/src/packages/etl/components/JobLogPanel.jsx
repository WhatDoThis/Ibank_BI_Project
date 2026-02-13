/**
 * packages/etl/components/JobLogPanel.jsx (Job 실행 결과 패널)
 * ===========================================================
 * 마지막 실행 결과(job_id, status, rows_processed, error_message) 표시. Phase 5.
 *
 * [Main Functions]
 * ===========
 * - lastRunResult: { job_id, status, rows_processed, error_message?, etl_table_id? } 표시
 *
 * [Dependencies]
 * =========
 * - React
 */

function JobLogPanel({ lastRunResult }) {
  if (!lastRunResult) return null;

  const { job_id, status, rows_processed, error_message } = lastRunResult;
  const isOk = status === 'completed';

  return (
    <div className={`etl-job-log ${isOk ? 'etl-job-log--success' : 'etl-job-log--failed'}`}>
      <h3 className="etl-job-log__title">실행 결과</h3>
      <ul className="etl-job-log__list">
        {job_id != null && <li>Job ID: {job_id}</li>}
        <li>상태: {status ?? '—'}</li>
        {rows_processed != null && <li>처리 건수: {rows_processed}</li>}
        {error_message && <li className="etl-job-log__error">에러: {error_message}</li>}
      </ul>
    </div>
  );
}

export default JobLogPanel;
