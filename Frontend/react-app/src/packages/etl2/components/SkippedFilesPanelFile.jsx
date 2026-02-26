/**
 * SkippedFilesPanelFile.jsx (문제 파일 목록 패널)
 * ==============================================
 * 배치 Job의 스킵/에러 파일 목록 조회 및 원격 삭제.
 * batch_run_history.file_list에서 status=skipped|error 항목만 집계, 동일 파일명 최신 1건.
 *
 * [Main Functions]
 * ===========
 * - batchListSkippedFiles로 목록 조회, 체크박스 선택 후 batchDeleteSkippedFiles로 원격 삭제
 *
 * [Props]
 * =====
 * - batchJobId: number — 배치 Job ID
 * - onClose: () => void — 닫기 버튼 콜백 (optional)
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (batchListSkippedFiles, batchDeleteSkippedFiles)
 * - etl.css (etl-db-form__section, etl-db-form__table)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  batchListSkippedFiles,
  batchDeleteSkippedFiles
} from '@/shared/api/client';
import '../etl.css';

export default function SkippedFilesPanelFile({ batchJobId, onClose }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

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
        </div>
      ) : (
        <div className="etl-db-form__table-wrap">
          <table className="etl-db-form__table" style={{ width: '100%', fontSize: 13 }}>
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
                  <td style={{ wordBreak: 'break-all' }}>{f.filename}</td>
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
                  <td>{reasonLabel(f)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{f.run_started_at || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
