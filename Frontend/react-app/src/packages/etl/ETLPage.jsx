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
import { etlRunTable, etlGetJob, etlCancelJob, etlListJobs } from '@/shared/api/client';
import SourceTypeSelector from './components/SourceTypeSelector';
import FileUploadForm from './components/FileUploadForm';
import DbConnectionForm from './components/DbConnectionForm';
import ETLTableList from './components/ETLTableList';
import JobLogPanel from './components/JobLogPanel';
import './etl.css';

function ETLPage() {
  const [sourceType, setSourceType] = useState('file');
  const [refreshKey, setRefreshKey] = useState(0);
  const [jobResults, setJobResults] = useState({});
  const [runLoading, setRunLoading] = useState(false);
  const [cancelLoadingJobId, setCancelLoadingJobId] = useState(null);
  const jobResultsRef = useRef(jobResults);
  jobResultsRef.current = jobResults;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await etlListJobs(null);
        const jobs = res?.jobs || [];
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
              error_message: j.error_message
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
          jobs.forEach((j) => {
            if (j?.job_id != null) {
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
                error_message: j.error_message
              };
            }
          });
          return next;
        });
      } catch (_) {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  async function handleRun(etlTableId) {
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
            error_message: result.error_message
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
      setJobResults((prev) =>
        prev[jobId] ? { ...prev, [jobId]: { ...prev[jobId], status: 'cancelled', error_message: '사용자 취소' } } : prev
      );
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

  const resultEntries = Object.entries(jobResults).sort((a, b) => {
    const aKey = a[0];
    const bKey = b[0];
    const aResult = a[1];
    const bResult = b[1];
    const aStatus = aResult?.status;
    const bStatus = bResult?.status;
    const statusOrder = { running: 0, pending: 1 };
    const ao = statusOrder[aStatus] ?? 2;
    const bo = statusOrder[bStatus] ?? 2;
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
          데이터 업로드 또는 DB 연동으로 우리 DB에 적재합니다. 소스 유형을 선택한 뒤 파일을 업로드하거나 DB 연결을 등록하세요.
        </p>
      </header>

      <section className="etl-page__body">
        <SourceTypeSelector sourceType={sourceType} onChange={setSourceType} />

        <div className="etl-page__panel">
          {sourceType === 'file' && <FileUploadForm onSuccess={handleRefresh} />}
          {sourceType === 'db' && <DbConnectionForm onSuccess={handleRefresh} />}
        </div>

        <section className="etl-page__section">
          <h2 className="etl-page__section-title">등록된 ETL 목록</h2>
          <ETLTableList
            onRun={handleRun}
            onDelete={handleRefresh}
            refreshing={refreshKey}
            runLoading={runLoading}
          />
        </section>

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
