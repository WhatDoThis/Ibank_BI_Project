/**
 * BatchHistoryDetailFile.jsx (배치 Job 실행 이력 상세)
 * ====================================================
 * 09_ETL_SFTP_Connection Phase 5. 실행 1건 상세: 요약(started_at, finished_at, status, files_processed, rows_inserted, rows_updated, error_message) + file_list 테이블.
 *
 * [Main Functions]
 * ===========
 * - batchGetJobHistoryDetail(batchJobId, runId) 호출 후 요약·파일별 결과 표시
 * - 파일별: 상세 토글, 원격 삭제, 적재 롤백(PK 있는 배치만, 성공 파일만)
 * - file_list: filename, timestamp, status, rows(또는 inserted/updated), error 또는 reason(실패/스킵 시)
 *
 * [Props]
 * =====
 * - batchJobId: number — 배치 Job ID
 * - runId: number — 실행 이력 run_id
 * - onBack: () => void — 목록으로 돌아가기
 * - onClose: () => void — 모달 닫기
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchGetJobHistoryDetail, batchRollbackFile)
 * - etl.css (etl-db-form__*)
 */

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { batchGetJobHistoryDetail, batchCancelRun, batchDeleteSkippedFiles, batchRollbackFile } from '@/shared/api/client';

function BatchHistoryDetailFile({ batchJobId, runId, onBack, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [expandedFileIdx, setExpandedFileIdx] = useState(null);
  const [deletingFilename, setDeletingFilename] = useState(null);
  const [rollingBackFilename, setRollingBackFilename] = useState(null);

  const loadDetail = useCallback(async () => {
    if (batchJobId == null || runId == null) return;
    setLoading(true);
    setError('');
    try {
      const res = await batchGetJobHistoryDetail(batchJobId, runId);
      setDetail(res);
    } catch (err) {
      setError(err?.message || '상세 조회 실패');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [batchJobId, runId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function formatDt(v) {
    if (v == null || v === '') return '-';
    if (typeof v === 'string') return v;
    return String(v);
  }

  if (loading) {
    return <p className="etl-db-form__muted">상세 로딩 중…</p>;
  }

  if (error) {
    return (
      <div className="etl-db-form__section">
        <p className="etl-db-form__error" role="alert">{error}</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button type="button" className="etl-db-form__btn etl-db-form__btn--secondary" onClick={onBack}>뒤로</button>
          <button type="button" className="etl-db-form__btn etl-db-form__btn--primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    );
  }

  const run = detail || {};
  const fileList = Array.isArray(run.file_list) ? run.file_list : [];
  const pkColumns = (run.pk_columns || '').trim();
  const canRollbackByFile = Boolean(pkColumns);
  const okCount = fileList.filter((f) => (f.status || '').toLowerCase() === 'ok').length;
  const errCount = fileList.filter((f) => (f.status || '').toLowerCase() === 'error').length;
  const skipCount = fileList.filter((f) => (f.status || '').toLowerCase() === 'skipped').length;

  return (
    <div className="etl-db-form__section">
      <h3 className="etl-db-form__heading">실행 상세 (run_id: {run.run_id})</h3>
      <dl className="etl-db-form__summary" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', marginBottom: '16px' }}>
        <dt>시작 시각</dt>
        <dd>{formatDt(run.started_at)}</dd>
        <dt>종료 시각</dt>
        <dd>{formatDt(run.finished_at)}</dd>
        <dt>상태</dt>
        <dd><span className={`etl-db-form__status-badge etl-db-form__status--${(run.status || '').toLowerCase()}`}>{run.status ?? '-'}</span></dd>
        <dt>처리 파일 수</dt>
        <dd>{run.files_processed ?? '-'}</dd>
        <dt>삽입 행</dt>
        <dd>{run.rows_inserted ?? '-'}</dd>
        <dt>갱신 행</dt>
        <dd>{run.rows_updated ?? '-'}</dd>
        <dt>에러 메시지</dt>
        <dd>{run.error_message ?? '-'}</dd>
      </dl>

      {fileList.length > 0 && (
        <>
          <p className="etl-db-form__muted" style={{ marginBottom: '8px' }}>
            성공 {okCount}건 · 실패 {errCount}건 · 스킵 {skipCount}건
          </p>
          <h4 className="etl-db-form__heading" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>파일별 결과</h4>
          <div className="etl-db-form__table-wrap">
            <table className="etl-db-form__table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>타임스탬프</th>
                  <th>상태</th>
                  <th>행 수</th>
                  <th>삽입</th>
                  <th>갱신</th>
                  <th>에러/사유</th>
                  <th>동작</th>
                </tr>
              </thead>
              <tbody>
                {fileList.map((file, idx) => {
                  const st = (file.status || '').toLowerCase();
                  const statusClass = st === 'ok' ? 'etl-db-form__status--success' : st === 'error' ? 'etl-db-form__status--error' : st === 'skipped' ? 'etl-db-form__status--idle' : '';
                  const rowsDisplay = file.rows != null ? String(file.rows) : '-';
                  const inserted = file.inserted != null ? String(file.inserted) : '-';
                  const updated = file.updated != null ? String(file.updated) : '-';
                  const errOrReason = file.error ?? file.reason ?? '-';
                  const isExpanded = expandedFileIdx === idx;
                  const isDeleting = deletingFilename === (file.filename || '');
                  const isRollingBack = rollingBackFilename === (file.filename || '');
                  const fileOk = (file.status || '').toLowerCase() === 'ok';
                  const rollbackEnabled = canRollbackByFile && fileOk;
                  return (
                    <React.Fragment key={idx}>
                      <tr>
                        <td>{file.filename ?? '-'}</td>
                        <td>{file.timestamp ?? '-'}</td>
                        <td><span className={`etl-db-form__status-badge ${statusClass}`}>{file.status ?? '-'}</span></td>
                        <td>{rowsDisplay}</td>
                        <td>{inserted}</td>
                        <td>{updated}</td>
                        <td>{errOrReason}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <button
                              type="button"
                              className="etl-db-form__btn etl-db-form__btn--secondary"
                              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                              onClick={() => setExpandedFileIdx(isExpanded ? null : idx)}
                            >
                              {isExpanded ? '상세 접기' : '상세'}
                            </button>
                            <button
                              type="button"
                              className="etl-db-form__btn etl-db-form__btn--secondary"
                              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                              disabled={isDeleting}
                              onClick={async () => {
                                const fname = file.filename;
                                if (!fname || !window.confirm(`원격에서 "${fname}" 파일을 삭제할까요? 다음 실행부터 이 파일은 처리 대상에서 제외됩니다.`)) return;
                                setDeletingFilename(fname);
                                try {
                                  await batchDeleteSkippedFiles(batchJobId, [fname]);
                                  await loadDetail();
                                } catch (e) {
                                  setError(e?.message || '원격 삭제 실패');
                                } finally {
                                  setDeletingFilename(null);
                                }
                              }}
                            >
                              {isDeleting ? '삭제 중…' : '원격 삭제'}
                            </button>
                            <button
                              type="button"
                              className="etl-db-form__btn etl-db-form__btn--secondary"
                              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                              disabled={!rollbackEnabled || isRollingBack}
                              title={!canRollbackByFile ? 'PK를 설정하면 파일 단위 롤백이 가능합니다.' : !fileOk ? '성공한 파일만 롤백할 수 있습니다.' : '해당 파일로 적재된 행만 타겟 테이블에서 삭제합니다.'}
                              onClick={async () => {
                                const fname = file.filename;
                                if (!fname || !rollbackEnabled || !window.confirm(`"${fname}"로 적재된 데이터를 타겟 테이블에서 삭제(롤백)할까요?`)) return;
                                setRollingBackFilename(fname);
                                try {
                                  await batchRollbackFile(batchJobId, { run_id: runId, filename: fname });
                                  await loadDetail();
                                } catch (e) {
                                  setError(e?.message || e?.detail || '적재 롤백 실패');
                                } finally {
                                  setRollingBackFilename(null);
                                }
                              }}
                            >
                              {isRollingBack ? '롤백 중…' : '적재 롤백'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: '12px', background: 'var(--etl-bg-muted, #f5f5f5)', fontSize: '0.9rem' }}>
                            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: 0 }}>
                              <dt>파일명</dt><dd>{file.filename ?? '-'}</dd>
                              <dt>타임스탬프</dt><dd>{file.timestamp ?? '-'}</dd>
                              <dt>상태</dt><dd>{file.status ?? '-'}</dd>
                              <dt>행 수</dt><dd>{rowsDisplay}</dd>
                              <dt>삽입</dt><dd>{inserted}</dd>
                              <dt>갱신</dt><dd>{updated}</dd>
                              {(file.checksum || file.reason || file.error) && (
                                <>
                                  {file.checksum && (<><dt>체크섬</dt><dd style={{ wordBreak: 'break-all' }}>{file.checksum}</dd></>)}
                                  {(file.reason || file.error) && (<><dt>사유/에러</dt><dd>{file.reason || file.error}</dd></>)}
                                </>
                              )}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {fileList.length === 0 && run.run_id != null && (
        <p className="etl-db-form__muted">파일별 결과가 없습니다.</p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button type="button" className="etl-db-form__btn etl-db-form__btn--secondary" onClick={onBack}>뒤로</button>
        <button type="button" className="etl-db-form__btn etl-db-form__btn--primary" onClick={onClose}>닫기</button>
        {(run.status || '').toLowerCase() === 'running' && (
          <button
            type="button"
            className="etl-db-form__btn etl-db-form__btn--secondary"
            style={{ marginLeft: 'auto' }}
            disabled={cancelling}
            onClick={async () => {
              setCancelling(true);
              try {
                await batchCancelRun(batchJobId, runId);
                await loadDetail();
              } catch (e) {
                setError(e?.message || '취소 요청 실패');
              } finally {
                setCancelling(false);
              }
            }}
          >
            {cancelling ? '취소 요청 중…' : '실행 취소 (다음 파일부터 중단)'}
          </button>
        )}
      </div>
    </div>
  );
}

export default BatchHistoryDetailFile;
