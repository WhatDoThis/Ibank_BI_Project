/**
 * SkippedFilesPanelFile.jsx (문제 파일 목록 패널)
 * ==============================================
 * 배치 Job의 스킵/에러 파일 목록 조회 및 원격 삭제. 지난 이력 조회 모달 제공.
 * batch_run_history.file_list에서 status=skipped|error 항목만 집계, 동일 파일명 최신 1건.
 *
 * [Main Functions]
 * ===========
 * 1. batchListSkippedFiles로 목록 조회, 체크박스 선택 후 batchDeleteSkippedFiles로 원격 삭제
 * 2. 지난 이력 조회: batchListSkippedFilesHistory로 전체 이력 모달 표시 (실행 이력창 레이아웃)
 *
 * [Props]
 * =====
 * 1. batchJobId: number — 배치 Job ID
 * 2. onClose: () => void — 닫기 버튼 콜백 (optional)
 *
 * [Dependencies]
 * =========
 * - React, @/packages/etl/api/etlClient.js (batchListSkippedFiles, batchDeleteSkippedFiles, batchListSkippedFilesHistory)
 * - etl.css (etl-db-form__section, etl-history__table, etl-modal-overlay 등)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  batchListSkippedFiles,
  batchDeleteSkippedFiles,
  batchListSkippedFilesHistory,
} from '@/packages/etl/api/etlClient.js';
import '../etl.css';

// 1.
export default function SkippedFilesPanelFile({ batchJobId, onClose }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFiles, setHistoryFiles] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    if (!batchJobId) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await batchListSkippedFiles(batchJobId);
      setFiles(Array.isArray(res?.skipped_files) ? res.skipped_files : []);
    } catch (e) {
      setMessage('조회 실패: ' + (e?.message || e));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [batchJobId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (fname) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fname)) next.delete(fname);
      else next.add(fname);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === files.length && files.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.filename)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개 파일을 원격 폴더에서 삭제합니다. 계속하시겠습니까?`)) return;
    setDeleting(true);
    setMessage('');
    try {
      const res = await batchDeleteSkippedFiles(batchJobId, [...selected]);
      setMessage(res?.message || '삭제 완료');
      setSelected(new Set());
      load();
    } catch (e) {
      setMessage('삭제 실패: ' + (e?.message || e));
    } finally {
      setDeleting(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await batchListSkippedFilesHistory(batchJobId);
      setHistoryFiles(Array.isArray(res?.skipped_files) ? res.skipped_files : []);
    } catch {
      setHistoryFiles([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const reasonLabel = (f) => {
    const r = (f.reason || '').trim();
    if (r === 'file_size_exceeded') return '용량 초과';
    if (r === 'duplicate_checksum') return '중복 파일 (체크섬 동일)';
    if (f.status === 'error') return r || '에러';
    return r || '알 수 없음';
  };

  if (!batchJobId) return null;

  return (
    <div className="etl-db-form__section" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>문제 파일 목록</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
            onClick={openHistory}
          >
            지난 이력 조회
          </button>
          <button
            type="button"
            className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? '조회 중...' : '새로고침'}
          </button>
          <button
            type="button"
            className="etl-db-form__btn etl-db-form__btn--danger etl-db-form__btn--sm"
            onClick={handleDelete}
            disabled={deleting || selected.size === 0}
          >
            {deleting ? '삭제 중...' : `선택 삭제 (${selected.size})`}
          </button>
          {onClose && (
            <button
              type="button"
              className="etl-db-form__btn etl-db-form__btn--secondary etl-db-form__btn--sm"
              onClick={onClose}
            >
              닫기
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          style={{
            marginBottom: 8,
            color: message.includes('실패') ? '#c0392b' : '#27ae60'
          }}
          role="status"
        >
          {message}
        </div>
      )}

      {files.length === 0 ? (
        <div className="etl-db-form__muted" style={{ padding: '12px 0' }}>
          스킵/에러 파일이 없습니다.
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85em', color: '#64748b' }}>
            이 목록은 <strong>실행 중에 파일 단위로 스킵·에러된 파일</strong>만 표시합니다. 실행 자체가 &quot;처리할 대기 파일 0건&quot;으로 스킵된 경우에는 여기에 나오지 않습니다.
          </p>
        </div>
      ) : (
        <div className="etl-db-form__table-wrap">
          <table className="etl-db-form__table etl-skipped-files-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={files.length > 0 && selected.size === files.length}
                    onChange={selectAll}
                    aria-label="전체 선택"
                  />
                </th>
                <th>파일명</th>
                <th>타임스탬프</th>
                <th>상태</th>
                <th>사유</th>
                <th>감지 시각</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.filename}
                  style={{ background: selected.has(f.filename) ? '#fef3e2' : undefined }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(f.filename)}
                      onChange={() => toggleSelect(f.filename)}
                      aria-label={`${f.filename} 선택`}
                    />
                  </td>
                  <td>{f.filename}</td>
                  <td>{f.timestamp || '-'}</td>
                  <td>
                    <span
                      style={{
                        color: f.status === 'error' ? '#c0392b' : '#e67e22',
                        fontWeight: 600
                      }}
                    >
                      {f.status === 'error' ? '에러' : '스킵'}
                    </span>
                  </td>
                  <td title={reasonLabel(f)}>{reasonLabel(f)}</td>
                  <td>{f.run_started_at || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyOpen && (
        <div className="etl-modal-overlay" onClick={() => setHistoryOpen(false)} role="dialog" aria-modal="true" aria-labelledby="etl-skipped-history-title">
          <div className="etl-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="etl-modal__header">
              <h3 id="etl-skipped-history-title" style={{ margin: 0 }}>문제 파일 이력</h3>
              <button type="button" className="etl-modal__close" onClick={() => setHistoryOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="etl-modal__body">
              {historyLoading ? (
                <p className="etl-history__loading">조회 중…</p>
              ) : historyFiles.length === 0 ? (
                <p className="etl-history__empty">문제 파일 이력이 없습니다.</p>
              ) : (
                <div className="etl-history__table-wrap">
                  <table className="etl-history__table">
                    <thead>
                      <tr>
                        <th>파일명</th>
                        <th>타임스탬프</th>
                        <th>상태</th>
                        <th>사유</th>
                        <th>감지 시각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyFiles.map((f, i) => (
                        <tr key={`${f.filename}-${f.run_id ?? ''}-${i}`}>
                          <td className="etl-history__cell--overflow" title={f.filename}>{f.filename}</td>
                          <td>{f.timestamp || '—'}</td>
                          <td>
                            <span style={{ color: f.status === 'error' ? '#b91c1c' : '#e67e22', fontWeight: 600 }}>
                              {f.status === 'error' ? '에러' : '스킵'}
                            </span>
                          </td>
                          <td className="etl-history__cell--overflow" title={reasonLabel(f)}>{reasonLabel(f)}</td>
                          <td>{f.run_started_at || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
