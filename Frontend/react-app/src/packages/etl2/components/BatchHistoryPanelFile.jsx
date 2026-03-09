/**
 * BatchHistoryPanelFile.jsx (배치 Job 실행 이력 목록)
 * ==================================================
 * 09_ETL_SFTP_Connection Phase 5. 배치 Job별 실행 이력 목록 테이블. [상세] 클릭 시 onSelectRun(run_id)로 상세 뷰 전환.
 * 상단 [새로고침] 버튼으로 해당 이력 목록만 다시 불러오기.
 *
 * [Main Functions]
 * ===========
 * - batchListJobHistory(batchJobId) 마운트 시 호출, runs 테이블 표시
 * - 테이블: run_id, started_at, finished_at, status(일부만 실패 시 "일부 실패 (N/M 성공)"), files_processed, rows_inserted, rows_updated, error_message, [상세]
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
 * - etl.css (etl-db-form__table, etl-db-form__table-wrap, etl-db-form__table-wrap--viewport-scroll, etl-db-form__table-actions)
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

  /** run 상태 + file_list 기반 표시: 일부만 실패한 경우 "일부 실패 (N/M 성공)"으로 구분. partial_error(on_file_error=continue)도 동일 표시 */
  function getStatusDisplay(row) {
    const status = (row.status || '').toString().toLowerCase();
    const rawList = row.file_list;
    const fileList = Array.isArray(rawList)
      ? rawList
      : typeof rawList === 'string'
        ? (() => { try { const a = JSON.parse(rawList); return Array.isArray(a) ? a : []; } catch { return []; } })()
        : [];
    const total = fileList.length;
    const okCount = fileList.filter((f) => (String(f.status || '').toLowerCase()) === 'ok').length;
    const errCount = fileList.filter((f) => (String(f.status || '').toLowerCase()) === 'error').length;
    if (status === 'partial_error' || (status === 'error' && okCount > 0 && errCount > 0)) {
      return total > 0 ? `일부 실패 (${okCount}/${total} 성공)` : (status === 'partial_error' ? '일부 실패' : row.status ?? '-');
    }
    if (total === 0 || status !== 'error') return row.status ?? '-';
    return row.status ?? '-';
  }

  return (
    <div className="etl-db-form__section">
      <div className="etl-db-form__table-actions">
        <button
          type="button"
          className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
          onClick={() => loadHistory(false)}
          disabled={loading}
          aria-label="이력 새로고침"
        >
          {loading ? '새로고침 중…' : '새로고침'}
        </button>
      </div>
      {loading ? (
        <p className="etl-db-form__muted">실행 이력 로딩 중…</p>
      ) : error ? (
        <p className="etl-db-form__error" role="alert">{error}</p>
      ) : runs.length === 0 ? (
        <p className="etl-db-form__muted">실행 이력이 없습니다.</p>
      ) : (
        <div className="etl-db-form__table-wrap etl-db-form__table-wrap--viewport-scroll">
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
                  <td>
                    {(() => {
                      const text = getStatusDisplay(row);
                      const isPartial = text.startsWith('일부 실패');
                      return isPartial ? (
                        <span className="etl-db-form__status-badge etl-db-form__status--partial" title={`상태: error (${text})`}>{text}</span>
                      ) : (
                        text
                      );
                    })()}
                  </td>
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
