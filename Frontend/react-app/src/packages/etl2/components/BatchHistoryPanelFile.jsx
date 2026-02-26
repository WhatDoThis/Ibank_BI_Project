/**
 * BatchHistoryPanelFile.jsx (배치 Job 실행 이력 목록)
 * ==================================================
 * 09_ETL_SFTP_Connection Phase 5. 배치 Job별 실행 이력 목록 테이블. [상세] 클릭 시 onSelectRun(run_id)로 상세 뷰 전환.
 *
 * [Main Functions]
 * ===========
 * - batchListJobHistory(batchJobId) 마운트 시 호출, runs 테이블 표시
 * - 테이블: run_id, started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message, [상세]
 *
 * [Props]
 * =====
 * - batchJobId: number — 배치 Job ID
 * - onClose: () => void — 모달 닫기
 * - onSelectRun: (runId: number) => void — (optional) [상세] 클릭 시 호출, 상위에서 상세 뷰 표시
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListJobHistory)
 * - etl.css (etl-db-form__table, etl-db-form__table-wrap)
 */

import { useState, useEffect, useCallback } from 'react';
import { batchListJobHistory } from '@/shared/api/client';

function BatchHistoryPanelFile({ batchJobId, onClose, onSelectRun }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (silent = false) => {
    if (batchJobId == null) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await batchListJobHistory(batchJobId);
      const list = Array.isArray(res?.runs) ? res.runs : [];
      setRuns(list);
    } catch (err) {
      setError(err?.message || '이력 조회 실패');
      setRuns([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [batchJobId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const hasRunning = runs.some((r) => (String(r.status || '').toLowerCase()) === 'running');
  useEffect(() => {
    if (!hasRunning || batchJobId == null) return;
    const interval = setInterval(() => loadHistory(true), 2000);
    return () => clearInterval(interval);
  }, [hasRunning, batchJobId, loadHistory]);

  function formatDt(v) {
    if (v == null || v === '') return '-';
    if (typeof v === 'string') return v;
    return String(v);
  }

  return (
    <div className="etl-db-form__section">
      {loading ? (
        <p className="etl-db-form__muted">실행 이력 로딩 중…</p>
      ) : error ? (
        <p className="etl-db-form__error" role="alert">{error}</p>
      ) : runs.length === 0 ? (
        <p className="etl-db-form__muted">실행 이력이 없습니다.</p>
      ) : (
        <div className="etl-db-form__table-wrap">
          <table className="etl-db-form__table etl-db-form__table--compact">
            <thead>
              <tr>
                <th>run_id</th>
                <th>시작 시각</th>
                <th>종료 시각</th>
                <th>상태</th>
                <th>처리 파일 수</th>
                <th>삽입 행</th>
                <th>갱신 행</th>
                <th>에러 메시지</th>
                <th>동작</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((row) => (
                <tr key={row.run_id}>
                  <td>{row.run_id ?? '-'}</td>
                  <td>{formatDt(row.started_at)}</td>
                  <td>{formatDt(row.finished_at)}</td>
                  <td>{row.status ?? '-'}</td>
                  <td>{row.files_processed ?? '-'}</td>
                  <td>{row.rows_inserted ?? '-'}</td>
                  <td>{row.rows_updated ?? '-'}</td>
                  <td>{row.error_message ?? '-'}</td>
                  <td>
                    {typeof onSelectRun === 'function' && (
                      <button
                        type="button"
                        className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
                        onClick={() => onSelectRun(row.run_id)}
                      >
                        상세
                      </button>
                    )}
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

export default BatchHistoryPanelFile;
