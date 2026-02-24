/**
 * packages/etl/ETLPage.jsx (ETL 페이지)
 * ======================================
 * ETL 단일 페이지. 소스 유형 선택, 파일/DB 폼, ETL 목록·실행·Job 결과(여러 개 동시 표시).
 *
 * [Main Functions]
 * ===========
 * - jobResults: job_id별 실행 결과 맵. 마운트 시 GET /api/etl/jobs로 최근 목록 로드, 실행 시 추가, 2초 폴링으로 running/pending 갱신.
 * - 실행 결과: job별 패널을 아래로 나열해 각각 표시. 패널별 취소·닫기.
 *
 * [Dependencies]
 * =========
 * - React, etl/components, @/shared/api/client (etlListJobs, etlRunTable, etlGetJob, etlCancelJob)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { etlRunTable, etlGetJob, etlCancelJob, etlListJobs, etlPreviewTable, etlTargetExists, etlDeleteJob } from '@/shared/api/client';
import SourceTypeSelector from './components/SourceTypeSelector';
import FileUploadForm from './components/FileUploadForm';
import DbConnectionForm from './components/DbConnectionForm';
import ETLTableList from './components/ETLTableList';
import JobLogPanel from './components/JobLogPanel';
import AddFileModal from './components/AddFileModal';
import JobHistoryPanel from './components/JobHistoryPanel';
import PreviewModal from './components/PreviewModal';
import './etl.css';

function ETLPage() {
  const [sourceType, setSourceType] = useState('file');
  const [refreshKey, setRefreshKey] = useState(0);
  const [jobResults, setJobResults] = useState({});
  const [runLoading, setRunLoading] = useState(false);
  const [cancelLoadingJobId, setCancelLoadingJobId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addFileModal, setAddFileModal] = useState({ open: false, etlTableId: null, targetTable: '', description: '' });
  const jobResultsRef = useRef(jobResults);
  jobResultsRef.current = jobResults;

  async function handlePreview(etlTableId) {
    setPreviewOpen(true);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const data = await etlPreviewTable(etlTableId);
      setPreviewData(data);
    } catch (err) {
      setPreviewData({
        error: true,
        message: err.message || '원본 파일이 없거나 만료되어 미리보기를 할 수 없습니다.',
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await etlListJobs(null);
        const raw = res?.jobs || [];
        const jobs = raw.filter((j) => {
          const s = (j?.status || "").toLowerCase();
          return s !== "cancelled" && s !== "completed";
        });
        if (cancelled) return;
        const map = {};
        jobs.forEach((j) => {
          if (j?.job_id != null) {
            map[j.job_id] = {
              job_id: j.job_id,
              etl_table_id: j.etl_table_id,
              status: j.status,
              target_table: j.target_table,
              description: j.description,
              started_at: j.started_at,
              finished_at: j.finished_at,
              rows_processed: j.rows_processed,
              total_rows: j.total_rows,
              error_message: j.error_message,
              notice: j.notice
            };
          }
        });
        setJobResults(map);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      const prev = jobResultsRef.current;
      const live = Object.entries(prev).filter(
        ([, r]) => r?.status === 'running' || r?.status === 'pending'
      );
      if (live.length === 0) return;
      const ids = live.map(([jid]) => Number(jid)).filter((n) => !Number.isNaN(n));
      if (ids.length === 0) return;
      try {
        const jobs = await Promise.all(ids.map((jid) => etlGetJob(jid)));
        setJobResults((prevState) => {
          const next = { ...prevState };
          for (const j of jobs) {
            if (j?.job_id == null) continue;
            next[j.job_id] = {
              job_id: j.job_id,
              etl_table_id: j.etl_table_id,
              status: j.status,
              target_table: j.target_table,
              description: j.description,
              started_at: j.started_at,
              finished_at: j.finished_at,
              rows_processed: j.rows_processed,
              total_rows: j.total_rows,
              error_message: j.error_message,
              notice: j.notice
            };
          }
          return next;
        });
      } catch (_) {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  async function handleRun(etlTableId) {
    // 실행은 데이터 적재/덮어쓰기 등 위험 작업이므로 항상 한 번 확인
    if (!window.confirm('ETL을 실행하시겠습니까?\n데이터 적재·덮어쓰기가 발생할 수 있습니다.')) return;

    try {
      const existsRes = await etlTargetExists(etlTableId);
      const isFullSync = (existsRes?.sync_mode || "").toLowerCase() === "full";
      if (existsRes?.exists && existsRes?.target_table && isFullSync) {
        const msg = `동일한 테이블명 "${existsRes.target_table}"이(가) 이미 메인 DB에 있습니다.\n실행 시 기존 테이블이 삭제되고 새로 적재됩니다.\n진행하시겠습니까?`;
        if (!window.confirm(msg)) return;
      }
    } catch {
      // target-exists 실패 시에도 실행은 진행 허용
    }
    setRunLoading(true);
    try {
      const result = await etlRunTable(etlTableId);
      const jobId = result?.job_id;
      if (jobId != null) {
        setJobResults((prev) => ({
          ...prev,
          [jobId]: {
            job_id: result.job_id,
            etl_table_id: result.etl_table_id,
            status: result.status,
            target_table: result.target_table,
            description: result.description,
            started_at: result.started_at,
            finished_at: result.finished_at,
            rows_processed: result.rows_processed ?? 0,
            total_rows: result.total_rows,
            error_message: result.error_message,
            notice: result.notice
          }
        }));
      }
      handleRefresh();
    } catch (err) {
      setJobResults((prev) => ({
        ...prev,
        ['err_' + Date.now()]: {
          job_id: null,
          status: 'failed',
          rows_processed: 0,
          error_message: err.message || '실행 실패'
        }
      }));
    } finally {
      setRunLoading(false);
    }
  }

  async function handleCancelJob(jobId) {
    if (jobId == null || cancelLoadingJobId != null) return;
    setCancelLoadingJobId(jobId);
    try {
      await etlCancelJob(jobId);
      const updated = await etlGetJob(jobId);
      setJobResults((prev) => ({
        ...prev,
        [jobId]: {
          job_id: updated?.job_id,
          etl_table_id: updated?.etl_table_id,
          status: updated?.status ?? 'cancelled',
          target_table: updated?.target_table,
          description: updated?.description,
          started_at: updated?.started_at,
          finished_at: updated?.finished_at,
          rows_processed: updated?.rows_processed ?? prev[jobId]?.rows_processed,
          total_rows: updated?.total_rows,
          error_message: updated?.error_message ?? '사용자 취소',
          notice: updated?.notice,
        },
      }));
      handleRefresh();
    } catch (err) {
      setJobResults((prev) =>
        prev[jobId] ? { ...prev, [jobId]: { ...prev[jobId], error_message: err.message || '취소 실패' } } : prev
      );
    } finally {
      setCancelLoadingJobId(null);
    }
  }

  function handleCloseResult(jobKey) {
    setJobResults((prev) => {
      const next = { ...prev };
      delete next[jobKey];
      return next;
    });
  }

  function handleDeleteJob(jobId) {
    if (!window.confirm('해당 job을 지우겠습니까?')) return;
    etlDeleteJob(jobId)
      .then(() => handleCloseResult(String(jobId)))
      .catch(() => {});
  }

  const resultEntries = Object.entries(jobResults)
    .sort((a, b) => {
    const aKey = a[0];
    const bKey = b[0];
    const aResult = a[1];
    const bResult = b[1];
    const aStatus = aResult?.status;
    const bStatus = bResult?.status;
    const statusOrder = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
    const ao = statusOrder[aStatus] ?? 5;
    const bo = statusOrder[bStatus] ?? 5;
    if (ao !== bo) return ao - bo;
    if (aStatus === 'running') return (Number(bKey) || 0) - (Number(aKey) || 0);
    if (aStatus === 'pending') return (Number(aKey) || 0) - (Number(bKey) || 0);
    if (aKey.startsWith('err_') && bKey.startsWith('err_')) return Number(bKey.replace('err_', '')) - Number(aKey.replace('err_', ''));
    if (aKey.startsWith('err_')) return 1;
    if (bKey.startsWith('err_')) return -1;
    return (Number(bKey) || 0) - (Number(aKey) || 0);
  });

  return (
    <div className="etl-page">
      <header className="etl-page__header">
        <h1 className="etl-page__title">ETL</h1>
        <p className="etl-page__desc">
          {sourceType === 'file' && '파일을 업로드해 우리 DB에 적재합니다. CSV·Excel·Parquet 파일을 선택한 뒤 타겟 테이블을 지정하고 업로드하세요.'}
          {sourceType === 'db' && '외부 DB(PostgreSQL·MySQL·Oracle) 연결을 등록한 뒤, 소스 테이블을 선택해 우리 DB에 적재합니다.'}
          {sourceType === 'history' && 'ETL Job 실행 이력을 확인하고 삭제할 수 있습니다.'}
        </p>
      </header>

      <section className="etl-page__body">
        <SourceTypeSelector sourceType={sourceType} onChange={setSourceType} />

        <div className="etl-page__panel">
          {sourceType === 'file' && <FileUploadForm onSuccess={handleRefresh} />}
          {sourceType === 'db' && <DbConnectionForm onSuccess={handleRefresh} />}
          {sourceType === 'history' && <JobHistoryPanel />}
        </div>

        <section className="etl-page__section">
          <h2 className="etl-page__section-title">등록된 ETL 목록</h2>
          <ETLTableList
            onRun={handleRun}
            onPreview={handlePreview}
            onAddFile={(row) => {
              const isDbSource = ['postgresql', 'mysql', 'oracle'].includes((row.source_type || '').toLowerCase()) && row.source_table;
              if (isDbSource) {
                if (!window.confirm('마지막 동기화 시각 이후 데이터를 가져와 업서트합니다. 진행할까요?')) return;
                handleRun(row.etl_table_id);
              } else {
                setAddFileModal({ open: true, etlTableId: row.etl_table_id, targetTable: row.target_table || '', description: row.description || '' });
              }
            }}
            onDelete={handleRefresh}
            refreshing={refreshKey}
            runLoading={runLoading}
            queueStatusTrigger={Object.values(jobResults).map((r) => `${r?.job_id}:${r?.status}`).join(',')}
          />
        </section>

        <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} data={previewData} loading={previewLoading} />

        {addFileModal.open && (
          <AddFileModal
            etlTableId={addFileModal.etlTableId}
            targetTable={addFileModal.targetTable}
            description={addFileModal.description}
            onClose={() => setAddFileModal({ open: false })}
            onSuccess={(result) => {
              const jobId = result?.job_id;
              const jobIds = result?.job_ids;
              if (jobId != null) {
                setJobResults((prev) => ({
                  ...prev,
                  [jobId]: {
                    job_id: result.job_id,
                    etl_table_id: result.etl_table_id,
                    status: result.status ?? 'pending',
                    target_table: result.target_table,
                    description: result.description,
                    started_at: result.started_at,
                    finished_at: result.finished_at,
                    rows_processed: result.rows_processed ?? 0,
                    total_rows: result.total_rows,
                    error_message: result.error_message,
                    notice: result.notice,
                  },
                }));
              } else if (Array.isArray(jobIds) && jobIds.length > 0) {
                const base = {
                  etl_table_id: result.etl_table_id,
                  target_table: result.target_table,
                  description: result.description,
                  status: 'pending',
                  rows_processed: 0,
                  total_rows: null,
                  error_message: null,
                  notice: null,
                };
                setJobResults((prev) => {
                  const next = { ...prev };
                  jobIds.forEach((id) => {
                    next[id] = { job_id: id, ...base };
                  });
                  return next;
                });
              }
              handleRefresh();
            }}
          />
        )}

        {resultEntries.length > 0 && (
          <section className="etl-page__section">
            <h2 className="etl-page__section-title">실행목록</h2>
            <div className="etl-job-results">
              {resultEntries.map(([jobKey, result]) => (
                <div key={jobKey} className="etl-job-results__item">
                  <JobLogPanel
                    result={result}
                    onCancel={result?.job_id != null ? () => handleCancelJob(result.job_id) : null}
                    onClose={() => handleCloseResult(jobKey)}
                    onDeleteJob={result?.job_id != null ? handleDeleteJob : null}
                    cancelLoading={cancelLoadingJobId === result?.job_id}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

export default ETLPage;
