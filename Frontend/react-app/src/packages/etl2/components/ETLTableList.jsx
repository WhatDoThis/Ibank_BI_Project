/**
 * packages/etl/components/ETLTableList.jsx (ETL 테이블 목록)
 * ========================================================
 * 등록된 ETL 목록, 행별 실행/대기 중/실행 중·삭제. 큐 상태 2초 폴링으로 행별 표시.
 *
 * [Main Functions]
 * ===========
 * - GET /api/etl/tables 목록(batch_size, batch_interval_seconds 포함). GET /api/etl/jobs로 실행 중·대기 중 Job 조회 후 행별 버튼 문구(실행|대기 중|실행 중)
 * - DB 소스(postgresql/mysql/oracle)인 경우 배치 열에 배치 크기·대기 시간, 연결 열에 connection_name(서버 구분), 동기화 열에 full/전체·incremental/증분 표시. 저장 DB 열에 storage_connection_name 또는 기본 DB 표시.
 * - 실행 버튼: PK 미설정 시 confirm("PK가 설정되어 있지 않습니다. 그래도 실행하시겠습니까?") 후 진행 여부 선택
 * - 동작 안내(?) 모달: 권장 순서 및 상태별 버튼 설명. PK는 테이블선택·컬럼매핑에서 설정.
 * - ×(행만 삭제): 기본 비활성화, 동일 타겟 테이블명이 2건 이상일 때만 활성화
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2ListTables, etl2ListJobs, etl2DeleteTable, etl2DeleteTableRow)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { etl2ListTables, etl2ListJobs, etl2DeleteTable, etl2DeleteTableRow } from '@/shared/api/client';

function ETLTableList({ onRun, onPreview, onAddFile, refreshing, runLoading, onDelete, queueStatusTrigger }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queueStatus, setQueueStatus] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const pollRef = useRef(null);

  async function loadQueueStatus() {
    try {
      const res = await etl2ListJobs();
      const jobs = res.jobs || [];
      const byTable = {};
      for (const j of jobs) {
        if (j.status !== 'running' && j.status !== 'pending') continue;
        const id = j.etl_table_id;
        if (id != null && (byTable[id] == null || (byTable[id].status === 'pending' && j.status === 'running'))) {
          byTable[id] = { job_id: j.job_id, status: j.status };
        }
      }
      setQueueStatus(byTable);
    } catch {
      setQueueStatus({});
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await etl2ListTables();
      setTables(res.tables || []);
    } catch (err) {
      setError(err.message || '목록 조회 실패');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshing]);

  useEffect(() => {
    if (tables.length === 0) return;
    loadQueueStatus();
    pollRef.current = setInterval(loadQueueStatus, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tables.length, refreshing]);

  useEffect(() => {
    if (queueStatusTrigger == null || tables.length === 0) return;
    loadQueueStatus();
  }, [queueStatusTrigger]);

  const targetTableCounts = useMemo(() => {
    const m = {};
    tables.forEach((t) => {
      const k = (t.target_table || '').trim();
      if (k) m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [tables]);

  if (loading) return <p className="etl-table-list__loading">목록 로딩 중…</p>;
  if (error) return <p className="etl-table-list__error">{error}</p>;
  if (tables.length === 0) {
    return (
      <div className="etl-table-list__empty-wrap">
        <p className="etl-table-list__empty">등록된 ETL이 없습니다.</p>
        <p className="etl-table-list__empty-hint">
          <strong>파일 업로드</strong> 탭에서 파일을 올리거나, <strong>DB 연결</strong> 탭에서 외부 DB 테이블을 등록해 주세요. 등록 후 이 목록에 나타나면 <strong>실행</strong> 버튼으로 DB에 적재할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="etl-table-list">
      <table className="etl-table-list__table">
        <thead>
          <tr>
            <th>타겟 테이블</th>
            <th className="etl-table-list__th-description">설명</th>
            <th>PK</th>
            <th>소스 유형</th>
            <th className="etl-table-list__th-connection">연결</th>
            <th>소스</th>
            <th className="etl-table-list__th-batch">배치</th>
            <th className="etl-table-list__th-sync">동기화</th>
            <th className="etl-table-list__th-storage">저장 DB</th>
            <th>상태</th>
            <th className="etl-table-list__th-actions">
              동작
              <button
                type="button"
                className="etl-table-list__help"
                onClick={() => setHelpOpen(true)}
                title="동작 버튼 안내"
                aria-label="동작 버튼 안내"
              >
                ?
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => {
            const q = queueStatus[t.etl_table_id];
            const runLabel = q?.status === 'running' ? '실행 중' : q?.status === 'pending' ? '대기 중' : '실행';
            const runDisabled = q?.status === 'running' || q?.status === 'pending';
            const rowRunning = q?.status === 'running';
            const rowPending = q?.status === 'pending';
            const statusLower = (t.status || '').toLowerCase();
            const statusText = rowRunning ? '실행 중' : rowPending ? '대기 중' : (statusLower === 'done' ? '완료' : statusLower === 'error' ? '오류' : statusLower === 'draft' ? '미실행' : (t.status || '—'));
            const statusCellClass = rowRunning ? 'etl-table-list__status--running' : rowPending ? 'etl-table-list__status--pending' : statusLower === 'done' ? 'etl-table-list__status--done' : statusLower === 'error' ? 'etl-table-list__status--error' : statusLower === 'draft' ? 'etl-table-list__status--draft' : undefined;
            const rowClass = [
              rowRunning && 'etl-table-list__row--running',
              rowPending && 'etl-table-list__row--pending'
            ].filter(Boolean).join(' ');
            const isDbSource = (t.source_type || '').toLowerCase() === 'postgresql' || (t.source_type || '').toLowerCase() === 'mysql' || (t.source_type || '').toLowerCase() === 'oracle';
            const batchSize = t.batch_size != null && t.batch_size > 0 ? Number(t.batch_size) : 0;
            const batchInterval = t.batch_interval_seconds != null && t.batch_interval_seconds > 0 ? Number(t.batch_interval_seconds) : 0;
            const batchText = !isDbSource ? '—' : batchSize > 0 && batchInterval > 0
              ? `${batchSize.toLocaleString()}행 / ${batchInterval}초`
              : batchSize > 0
                ? `${batchSize.toLocaleString()}행`
                : batchInterval > 0
                  ? `전체 / ${batchInterval}초`
                  : '전체';
            const connectionText = isDbSource ? (t.connection_name || '—') : '—';
            const syncMode = (t.sync_mode || '').toLowerCase();
            const syncText = !isDbSource ? '—' : syncMode === 'incremental' ? '증분' : '전체';
            return (
            <tr key={t.etl_table_id} className={rowClass || undefined}>
              <td>{t.target_table}</td>
              <td className="etl-table-list__cell-description" title={t.description ? String(t.description) : undefined}>{t.description || '—'}</td>
              <td className="etl-table-list__pk-cell">{(t.pk_columns || '').trim() ? <span className="etl-table-list__pk-check" aria-label="PK 설정됨">✓</span> : '—'}</td>
              <td>{t.source_type || '—'}</td>
              <td className="etl-table-list__cell-connection" title={isDbSource && t.connection_name ? `연결: ${t.connection_name}` : undefined}>{connectionText}</td>
              <td>{t.source_table || t.file_path || '—'}</td>
              <td className="etl-table-list__cell-batch" title={isDbSource ? `배치 크기: ${batchSize > 0 ? batchSize + '행' : '전체 fetch'}, 대기: ${batchInterval > 0 ? batchInterval + '초' : '없음'}` : undefined}>{batchText}</td>
              <td className="etl-table-list__cell-sync" title={isDbSource ? (syncMode === 'incremental' ? '증분: last_synced_at 이후 행만 Upsert' : '전체: DROP+CREATE+INSERT') : undefined}>{syncText}</td>
              <td className="etl-table-list__cell-storage" title={t.storage_connection_name ? `저장 DB: ${t.storage_connection_name}` : '기본 DB (ibank_db)'}>{t.storage_connection_name ? t.storage_connection_name : '기본 DB'}</td>
              <td className={statusCellClass}>{statusText}</td>
              <td className="etl-table-list__cell-actions">
                <span className="etl-table-list__actions">
                  {(t.source_type === 'file' && (t.file_path || t.file_type)) || (['postgresql', 'mysql', 'oracle'].includes((t.source_type || '').toLowerCase()) && t.source_table) ? (
                    <>
                      {onPreview && (
                        <button
                          type="button"
                          className="etl-table-list__preview"
                          onClick={() => onPreview(t.etl_table_id)}
                          disabled={runDisabled || t.preview_available === false}
                          title={t.preview_available === false ? '원본 파일이 없거나 만료되었습니다.' : undefined}
                        >
                          미리보기
                        </button>
                      )}
                      <button
                        type="button"
                        className={`etl-table-list__run ${runDisabled ? 'etl-table-list__run--busy' : ''}`}
                        onClick={() => {
                          const hasPk = (t.pk_columns || '').trim().length > 0;
                          if (!hasPk && !window.confirm('PK가 설정되어 있지 않습니다. 그래도 실행하시겠습니까?\n(파일 ETL의 경우 나중에 "데이터 추가" 시 PK가 없으면 오류가 날 수 있습니다.)')) return;
                          onRun(t.etl_table_id);
                        }}
                        disabled={runDisabled}
                      >
                        {runLabel}
                      </button>
                      {onAddFile && !isDbSource && (
                        <button
                          type="button"
                          className="etl-table-list__add-file"
                          onClick={() => onAddFile(t)}
                          disabled={runDisabled}
                        >
                          데이터 추가
                        </button>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                  <button
                    type="button"
                    className="etl-table-list__delete"
                    onClick={() => {
                      const msg = `다음 ETL을 삭제합니다.\n· 타겟 테이블 "${t.target_table}"이(가) 메인 DB에서 DROP됩니다.\n· 파일 소스인 경우 업로드 파일도 삭제됩니다.\n계속할까요?`;
                      if (window.confirm(msg)) {
                        etl2DeleteTable(t.etl_table_id)
                          .then(() => { if (onDelete) onDelete(); load(); })
                          .catch((err) => { setError(err.message || '삭제 실패'); load(); });
                      }
                    }}
                    disabled={runDisabled}
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    className="etl-table-list__delete-row"
                    onClick={() => {
                      const msg = '해당 ETL 등록 건만 삭제합니다.\n업로드 파일은 삭제되며, 메인 DB의 타겟 테이블은 유지됩니다.\n진행할까요?';
                      if (window.confirm(msg)) {
                        etl2DeleteTableRow(t.etl_table_id)
                          .then(() => { if (onDelete) onDelete(); load(); })
                          .catch((err) => { setError(err.message || '삭제 실패'); load(); });
                      }
                    }}
                    disabled={runDisabled || (targetTableCounts[(t.target_table || '').trim()] || 0) < 2}
                    title={(targetTableCounts[(t.target_table || '').trim()] || 0) >= 2 ? '해당 행만 삭제 (테이블 유지)' : '동일 타겟 테이블이 중복일 때만 사용 가능'}
                    aria-label="해당 행만 삭제"
                  >
                    ×
                  </button>
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {helpOpen && (
        <div className="etl-help-modal" role="dialog" aria-modal="true" aria-labelledby="etl-help-modal-title">
          <div className="etl-help-modal__backdrop" onClick={() => setHelpOpen(false)} />
          <div className="etl-help-modal__box">
            <div className="etl-help-modal__head">
              <h3 id="etl-help-modal-title">동작 버튼 안내 (상태별)</h3>
              <button type="button" className="etl-help-modal__close" onClick={() => setHelpOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="etl-help-modal__body">
              <section className="etl-help-modal__section etl-help-modal__section--order">
                <h4 className="etl-help-modal__section-title">권장 순서 (파일 ETL)</h4>
                <p className="etl-help-modal__order">업로드 → 테이블선택·컬럼매핑에서 PK 선택 → 미리보기 → 실행</p>
                <p className="etl-help-modal__order-desc">테이블선택·컬럼매핑에서 PK를 체크해 두지 않으면, 나중에 &quot;데이터 추가&quot; 시 오류가 날 수 있습니다.</p>
              </section>
              <section className="etl-help-modal__section">
                <h4 className="etl-help-modal__section-title">draft (아직 실행 안 함)</h4>
                <ul className="etl-help-modal__list">
                  <li><strong>실행</strong> — 적재 대기열 등록 후 실행.</li>
                  <li><strong>미리보기</strong> — 컬럼·상위 10행 미리보기.</li>
                  <li><strong>데이터 추가</strong> — 파일 소스만 표시. 업로드한 파일로 같은 테이블에 추가 적재(업서트). DB 연결은 전체/증분이 이미 정해져 있어 별도 버튼 없음.</li>
                  <li><strong>PK</strong> — 테이블선택·컬럼매핑 모달에서 행별 PK 체크로 설정. 첫 실행 시 CREATE TABLE에 반영.</li>
                  <li><strong>삭제</strong> — ETL 삭제 + 타겟 테이블 DROP.</li>
                  <li><strong>×</strong> — 비활성. 동일 타겟 2건 이상일 때만 활성.</li>
                </ul>
              </section>
              <section className="etl-help-modal__section">
                <h4 className="etl-help-modal__section-title">error (실패 후)</h4>
                <ul className="etl-help-modal__list">
                  <li><strong>실행</strong> — 재시도(대기열 등록).</li>
                  <li><strong>미리보기</strong> · <strong>데이터 추가</strong> · <strong>삭제</strong> · <strong>×</strong> — draft와 동일.</li>
                </ul>
              </section>
              <section className="etl-help-modal__section">
                <h4 className="etl-help-modal__section-title">done (적재 완료)</h4>
                <ul className="etl-help-modal__list">
                  <li><strong>실행</strong> — 다시 실행 시 DROP+CREATE 후 적재(파일) 또는 full/incremental(DB).</li>
                  <li><strong>PK 변경</strong> — 테이블선택·컬럼매핑에서 수정 후 적용하면 다음 실행부터 반영. 이미 만들어진 테이블 PK는 메인 DB에서 직접 변경.</li>
                  <li><strong>미리보기</strong> · <strong>데이터 추가</strong> · <strong>삭제</strong> · <strong>×</strong> — draft와 동일.</li>
                </ul>
              </section>
              <section className="etl-help-modal__section">
                <h4 className="etl-help-modal__section-title">실행 중 / 대기 중</h4>
                <ul className="etl-help-modal__list">
                  <li><strong>미리보기</strong> — 사용 가능.</li>
                  <li><strong>실행</strong> · <strong>데이터 추가</strong> · <strong>삭제</strong> · <strong>×</strong> — 모두 비활성.</li>
                </ul>
              </section>
              <section className="etl-help-modal__section etl-help-modal__section--batch">
                <h4 className="etl-help-modal__section-title">배치·실행 시점 안내</h4>
                <ul className="etl-help-modal__list">
                  <li><strong>배치 크기 / 대기 시간</strong> — 한 번 실행할 때만 적용됩니다. (몇 행씩 가져올지, 배치 간 몇 초 쉴지)</li>
                  <li><strong>매일 몇 시 자동 실행</strong> — 현재 없습니다. 스케줄(예: 매일 02시) 기능은 미지원입니다.</li>
                  <li><strong>실행</strong> — “실행” 버튼을 눌렀을 때만 대기열에 들어가고 워커가 처리합니다.</li>
                  <li><strong>draft 상태</strong> — draft로 두어도 해당 시간에 자동으로 증분이 돌지 않습니다. 증분 적재를 하려면 직접 “실행”을 눌러야 합니다.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ETLTableList;
