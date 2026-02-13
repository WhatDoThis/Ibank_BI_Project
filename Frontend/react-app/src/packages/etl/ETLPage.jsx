/**
 * packages/etl/ETLPage.jsx (ETL 페이지)
 * ======================================
 * ETL 단일 페이지. Phase 5: 소스 유형(파일/DB) 선택, 파일 업로드/DB 연결 폼, ETL 목록·실행·Job 결과.
 *
 * [Main Functions]
 * ===========
 * - ETLPage: 소스 유형 탭 → FileUploadForm | DbConnectionForm, ETLTableList, JobLogPanel
 *
 * [Dependencies]
 * =========
 * - React, etl/components, @/shared/api/client (etlRunTable)
 */

import { useState, useCallback } from 'react';
import { etlRunTable, etlGetJob } from '@/shared/api/client';
import SourceTypeSelector from './components/SourceTypeSelector';
import FileUploadForm from './components/FileUploadForm';
import DbConnectionForm from './components/DbConnectionForm';
import ETLTableList from './components/ETLTableList';
import JobLogPanel from './components/JobLogPanel';
import './etl.css';

function ETLPage() {
  const [sourceType, setSourceType] = useState('file');
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRunResult, setLastRunResult] = useState(null);
  const [runLoading, setRunLoading] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  async function handleRun(etlTableId) {
    setRunLoading(true);
    setLastRunResult(null);
    try {
      const result = await etlRunTable(etlTableId);
      setLastRunResult(result);
      handleRefresh();
      // Phase 6: pending이면 job_id로 폴링해 완료/실패 시 결과 갱신
      if (result?.status === 'pending' && result?.job_id != null) {
        const pollInterval = 2000;
        const maxAttempts = 300; // 10분
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, pollInterval));
          const job = await etlGetJob(result.job_id);
          setLastRunResult({
            job_id: job.job_id,
            status: job.status,
            rows_processed: job.rows_processed,
            error_message: job.error_message
          });
          if (job.status === 'completed' || job.status === 'failed') {
            handleRefresh();
            break;
          }
        }
      }
    } catch (err) {
      setLastRunResult({
        job_id: null,
        status: 'failed',
        rows_processed: 0,
        error_message: err.message || '실행 실패'
      });
    } finally {
      setRunLoading(false);
    }
  }

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
            lastRunResult={lastRunResult}
            refreshing={refreshKey}
            runLoading={runLoading}
          />
        </section>

        {lastRunResult && (
          <section className="etl-page__section">
            <JobLogPanel lastRunResult={lastRunResult} />
          </section>
        )}
      </section>
    </div>
  );
}

export default ETLPage;
