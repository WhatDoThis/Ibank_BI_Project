/**
 * packages/etl2/ETLPage.jsx (ETL2 페이지)
 * ========================================
 * ETL2 단일 페이지. 09_ETL_Upgrade_Plan 적용 예정. 소스 유형 선택, 파일/DB 폼, ETL 목록·실행·Job 결과.
 *
 * [Main Functions]
 * ===========
 * - jobResults: job_id별 실행 결과 맵. 마운트 시 GET /api/etl2/jobs로 최근 목록 로드, 실행 시 추가, 2초 폴링으로 running/pending 갱신.
 * - 실행 결과: job별 패널을 아래로 나열해 각각 표시. 패널별 취소·닫기.
 *
 * [Dependencies]
 * =========
 * - React, etl2/components, @/shared/api/client (etl2ListJobs, etl2RunTable, etl2GetJob, etl2CancelJob)
 * - folder 탭: FolderConnectionFormFile, FolderConnectionListFile, BatchJobFormFile, BatchJobListFile, 실행 이력 모달(BatchHistoryPanelFile, BatchHistoryDetailFile)
 * - 처음 사용하시나요: 탭별 사용 순서 + 폴더 탭 시 "폴더에 파일 올릴 때 확인할 점"(용량·행수·파일명·인코딩 등) 안내
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { etl2RunTable, etl2GetJob, etl2CancelJob, etl2ListJobs, etl2PreviewTable, etl2TargetExists, etl2DeleteJob } from '@/shared/api/client';
import SourceTypeSelector from './components/SourceTypeSelector';
import FileUploadForm from './components/FileUploadForm';
import DbConnectionForm from './components/DbConnectionForm';
import StorageConnectionForm from './components/StorageConnectionForm';
import FolderConnectionFormFile from './components/FolderConnectionFormFile';
import FolderConnectionListFile from './components/FolderConnectionListFile';
import BatchJobFormFile from './components/BatchJobFormFile';
import BatchJobListFile from './components/BatchJobListFile';
import BatchHistoryPanelFile from './components/BatchHistoryPanelFile';
import BatchHistoryDetailFile from './components/BatchHistoryDetailFile';
import ETLTableList from './components/ETLTableList';
import JobLogPanel from './components/JobLogPanel';
import AddFileModal from './components/AddFileModal';
import JobHistoryPanel from './components/JobHistoryPanel';
import PreviewModal from './components/PreviewModal';
import './etl.css';

const VALID_TABS = ['file', 'db', 'folder', 'storage', 'history'];

function ETLPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'file';
  const [sourceType, setSourceType] = useState(
    () => (VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'file')
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = searchParams.get('tab') || 'file';
    if (VALID_TABS.includes(t) && t !== sourceType) setSourceType(t);
  }, [searchParams, sourceType]);

  const setSourceTypeAndUrl = useCallback((next) => {
    setSourceType(next);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', next);
      return p;
    }, { replace: true });
  }, [setSearchParams]);
  const [jobResults, setJobResults] = useState({});
  const [runLoading, setRunLoading] = useState(false);
  const [cancelLoadingJobId, setCancelLoadingJobId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addFileModal, setAddFileModal] = useState({ open: false, etlTableId: null, targetTable: '', description: '' });
  const [batchHistoryJobId, setBatchHistoryJobId] = useState(null);
  const [batchHistoryRunId, setBatchHistoryRunId] = useState(null);
  const jobResultsRef = useRef(jobResults);
  jobResultsRef.current = jobResults;

  async function handlePreview(etlTableId) {
    setPreviewOpen(true);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const data = await etl2PreviewTable(etlTableId);
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
        const res = await etl2ListJobs(null);
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
        const jobs = await Promise.all(ids.map((jid) => etl2GetJob(jid)));
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
      const existsRes = await etl2TargetExists(etlTableId);
      const isFullSync = (existsRes?.sync_mode || "").toLowerCase() === "full";
      if (existsRes?.exists && existsRes?.target_table && isFullSync) {
        const dbLabel = existsRes?.storage_connection_id != null ? '저장 DB' : '메인 DB';
        const msg = `동일한 테이블명 "${existsRes.target_table}"이(가) 이미 ${dbLabel}에 있습니다.\n실행 시 기존 테이블이 삭제되고 새로 적재됩니다.\n진행하시겠습니까?`;
        if (!window.confirm(msg)) return;
      }
    } catch {
      // target-exists 실패 시에도 실행은 진행 허용
    }
    setRunLoading(true);
    try {
      const result = await etl2RunTable(etlTableId);
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
      await etl2CancelJob(jobId);
      const updated = await etl2GetJob(jobId);
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
    etl2DeleteJob(jobId)
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

  const howToFile = (
    <ul className="etl-page__how-list">
      <li><strong>1.</strong> 왼쪽에 CSV·Excel·Parquet 파일을 드래그하거나 &quot;파일 선택&quot;으로 올려주세요.</li>
      <li><strong>2.</strong> 저장할 DB와 타겟 테이블명을 정한 뒤, 필요하면 &quot;테이블선택 및 컬럼매핑&quot;에서 컬럼을 맞춰주세요.</li>
      <li><strong>3.</strong> &quot;업로드&quot;를 누르면 등록됩니다. 아래 목록에서 <strong>실행</strong>을 누르면 실제로 DB에 적재됩니다.</li>
    </ul>
  );
  const howToDb = (
    <ul className="etl-page__how-list">
      <li><strong>1.</strong> &quot;연결 추가&quot;에서 외부 DB 정보를 입력하고 <strong>연결 테스트</strong> 후 &quot;연결 등록&quot;을 누르세요.</li>
      <li><strong>2.</strong> &quot;등록된 연결&quot;에서 연결을 고른 뒤, 소스 테이블과 타겟 테이블명을 입력하고 &quot;ETL 테이블 등록&quot;을 누르세요.</li>
      <li><strong>3.</strong> 아래 목록에서 <strong>실행</strong>을 누르면 해당 테이블이 우리 DB로 적재됩니다.</li>
    </ul>
  );
  const howToFolder = (
    <ul className="etl-page__how-list">
      <li><strong>1.</strong> SFTP 또는 S3 폴더 연결을 등록하고 <strong>연결 테스트</strong> 후 등록하세요.</li>
      <li><strong>2.</strong> 배치 Job에서 파일 패턴·저장 DB·타겟 테이블·실행 주기를 설정하고 등록하세요.</li>
      <li><strong>3.</strong> 주기적으로 원격 폴더의 <em>파일명_ib_yyyyMMddHHmmss</em> 형식 파일이 자동 감지·적재됩니다.</li>
    </ul>
  );
  const folderConsiderations = (
    <div className="etl-page__considerations">
      <p className="etl-page__considerations-title">폴더에 파일 올릴 때 확인할 점</p>
      <ul className="etl-page__how-list">
        <li><strong>파일명</strong>: <code>접두사_ib_yyyyMMddHHmmss.확장자</code> 형식이어야 합니다. 14자리는 유효한 날짜여야 하며, 미래 시각 파일은 해당 주기에서 제외됩니다.</li>
        <li><strong>확장자</strong>: 배치 Job에서 설정한 허용 확장자(csv, xlsx, xls, parquet)만 처리됩니다.</li>
        <li><strong>파일 크기</strong>: 시스템에 용량 한도가 설정되어 있으면 초과 파일은 스킵됩니다. 한도는 관리자 설정(config)을 확인하세요.</li>
        <li><strong>행 수</strong>: 1회 적재 행 수 한도가 설정되어 있으면 해당 행까지만 읽고 나머지는 잘립니다.</li>
        <li><strong>CSV 인코딩</strong>: UTF-8 또는 CP949를 사용하세요. 파싱 실패한 줄은 건너뜁니다.</li>
        <li><strong>첫 실행</strong>: 해당 패턴의 가장 오래된 파일 1건만 처리한 뒤, 다음 주기부터 순차 처리됩니다.</li>
        <li><strong>중복</strong>: 이전 실행에서 이미 적재된 파일과 내용(체크섬)이 동일하면 스킵됩니다.</li>
      </ul>
    </div>
  );
  const howToStorage = (
    <ul className="etl-page__how-list">
      <li><strong>1.</strong> 적재할 PostgreSQL DB의 호스트·포트·DB명·사용자·비밀번호를 입력하세요.</li>
      <li><strong>2.</strong> &quot;연결 테스트&quot;로 접속과 권한을 확인한 뒤 &quot;연결 등록&quot;을 누르세요.</li>
      <li><strong>3.</strong> 파일 업로드나 DB 연동 시 &quot;저장할 DB&quot;에서 이 연결을 선택할 수 있습니다.</li>
    </ul>
  );
  const howToHistory = (
    <ul className="etl-page__how-list">
      <li>실행 중이거나 완료·실패한 ETL Job 목록입니다. 상태별로 필터링하고, 필요 시 삭제할 수 있습니다.</li>
    </ul>
  );

  return (
    <div className="etl-page">
      <header className="etl-page__header">
        <h1 className="etl-page__title">ETL2</h1>
        <p className="etl-page__desc">
          {sourceType === 'file' && '파일을 업로드해 우리 DB에 적재합니다. CSV·Excel·Parquet 파일을 선택한 뒤 타겟 테이블을 지정하고 업로드하세요.'}
          {sourceType === 'db' && '외부 DB(PostgreSQL·MySQL·Oracle) 연결을 등록한 뒤, 소스 테이블을 선택해 우리 DB에 적재합니다.'}
          {sourceType === 'folder' && '원격 폴더(SFTP/S3)를 등록하고, 파일명_ib_yyyyMMddHHmmss 형식 파일을 주기적으로 감지해 지정 DB에 자동 적재하는 배치를 설정합니다.'}
          {sourceType === 'storage' && '적재 대상(저장 DB) PostgreSQL 연결을 등록합니다. 연결 테스트로 접속·권한 확인 후 등록하세요.'}
          {sourceType === 'history' && 'ETL Job 실행 이력을 확인하고 삭제할 수 있습니다.'}
        </p>
        <div className="etl-page__tip" role="region" aria-label="사용 방법">
          <p className="etl-page__tip-title">처음 사용하시나요?</p>
          {sourceType === 'file' && howToFile}
          {sourceType === 'db' && howToDb}
          {sourceType === 'folder' && (
            <>
              {howToFolder}
              {folderConsiderations}
            </>
          )}
          {sourceType === 'storage' && howToStorage}
          {sourceType === 'history' && howToHistory}
        </div>
      </header>

      <section className="etl-page__body">
        <SourceTypeSelector sourceType={sourceType} onChange={setSourceTypeAndUrl} />

        <div className="etl-page__panel">
          {sourceType === 'file' && <FileUploadForm onSuccess={handleRefresh} />}
          {sourceType === 'db' && <DbConnectionForm onSuccess={handleRefresh} />}
          {sourceType === 'folder' && (
            <>
              <FolderConnectionFormFile onSuccess={handleRefresh} />
              <FolderConnectionListFile onSuccess={handleRefresh} refreshKey={refreshKey} />
              <section className="etl-db-form__section" style={{ marginTop: '24px' }}>
                <h3 className="etl-db-form__heading">배치 Job</h3>
                <BatchJobFormFile onSuccess={handleRefresh} refreshKey={refreshKey} />
                <BatchJobListFile
                  onSuccess={handleRefresh}
                  refreshKey={refreshKey}
                  onOpenHistory={(id) => {
                    setBatchHistoryJobId(id);
                    setBatchHistoryRunId(null);
                  }}
                />
              </section>
            </>
          )}
          {sourceType === 'storage' && <StorageConnectionForm onSuccess={handleRefresh} />}
          {sourceType === 'history' && <JobHistoryPanel />}
        </div>

        {sourceType !== 'folder' && (
        <section className="etl-page__section">
          <h2 className="etl-page__section-title">등록된 ETL 목록</h2>
          <p className="etl-page__section-desc">여기에서 실행을 누르면 데이터가 실제로 DB에 적재됩니다. 업로드·등록만으로는 적재되지 않습니다.</p>
          <ETLTableList
            onRun={handleRun}
            onPreview={handlePreview}
            onAddFile={(row) => {
              setAddFileModal({ open: true, etlTableId: row.etl_table_id, targetTable: row.target_table || '', description: row.description || '' });
            }}
            onDelete={handleRefresh}
            refreshing={refreshKey}
            runLoading={runLoading}
            queueStatusTrigger={Object.values(jobResults).map((r) => `${r?.job_id}:${r?.status}`).join(',')}
          />
        </section>
        )}

        <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} data={previewData} loading={previewLoading} />

        {batchHistoryJobId != null && (
          <div className="etl-add-file-modal" role="dialog" aria-modal="true" aria-labelledby="etl-history-modal-title">
            <div className="etl-add-file-modal__backdrop" onClick={() => { setBatchHistoryJobId(null); setBatchHistoryRunId(null); }} />
            <div className="etl-add-file-modal__box" style={{ maxWidth: '900px' }}>
              <div className="etl-add-file-modal__head">
                <h3 id="etl-history-modal-title">실행 이력</h3>
                <button type="button" className="etl-add-file-modal__close" onClick={() => { setBatchHistoryJobId(null); setBatchHistoryRunId(null); }} aria-label="닫기">×</button>
              </div>
              {batchHistoryRunId == null ? (
                <BatchHistoryPanelFile
                  batchJobId={batchHistoryJobId}
                  onClose={() => setBatchHistoryJobId(null)}
                  onSelectRun={(runId) => setBatchHistoryRunId(runId)}
                />
              ) : (
                <BatchHistoryDetailFile
                  batchJobId={batchHistoryJobId}
                  runId={batchHistoryRunId}
                  onBack={() => setBatchHistoryRunId(null)}
                  onClose={() => { setBatchHistoryJobId(null); setBatchHistoryRunId(null); }}
                />
              )}
            </div>
          </div>
        )}

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
