/**
 * packages/etl2/components/EtlTableSettingsModal.jsx (ETL 테이블 설정 모달)
 * ==========================================================================
 * DB 소스 ETL의 동기화 모드, 증분 컬럼, 배치 크기·대기 시간, 행 실패 시 동작을 한 화면에서 수정.
 * 증분 모드일 때 증분 컬럼 필수.
 *
 * [Main Functions]
 * ===========
 * - 동기화 모드(전체/증분), 증분 컬럼(증분 시 필수), 배치 크기, 배치 대기(초), 행 실패 시(fail/skip) 설정
 * - PATCH /api/etl2/tables/:id 로 일괄 반영
 *
 * [Dependencies]
 * =========
 * - React, @/shared/api/client (etl2UpdateTable, etl2GetSourceColumns, etl2ValidateIncrementalColumn)
 */

import { useState, useEffect, useCallback } from 'react';
import { etl2UpdateTable, etl2GetSourceColumns, etl2ValidateIncrementalColumn } from '@/shared/api/client';

function isDateType(dataType) {
  const t = (dataType || '').trim().toLowerCase();
  if (['date', 'datetime', 'timestamp', 'timestamptz', 'timestamp with time zone',
    'timestamp without time zone', 'time', 'timetz', 'year', 'interval'].includes(t)) return true;
  if (t.includes('date') || t.includes('time')) return true;
  return false;
}

export default function EtlTableSettingsModal({ open, onClose, table, onSuccess }) {
  const [syncMode, setSyncMode] = useState('incremental');
  const [incrementalColumnSelect, setIncrementalColumnSelect] = useState('');
  const [incrementalColumnCustom, setIncrementalColumnCustom] = useState('');
  const [batchSize, setBatchSize] = useState('');
  const [batchIntervalSeconds, setBatchIntervalSeconds] = useState('');
  const [onRowError, setOnRowError] = useState('fail');
  const [sourceColumns, setSourceColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isDbSource = table && ['postgresql', 'mysql', 'oracle'].includes((table.source_type || '').toLowerCase());
  const connectionId = table?.connection_id ? Number(table.connection_id) : null;
  const sourceTable = (table?.source_table || '').trim();

  const loadSourceColumns = useCallback(async () => {
    if (!connectionId || !sourceTable) return;
    setColumnsLoading(true);
    try {
      const res = await etl2GetSourceColumns(connectionId, sourceTable);
      setSourceColumns(res.columns || []);
    } catch {
      setSourceColumns([]);
    } finally {
      setColumnsLoading(false);
    }
  }, [connectionId, sourceTable]);

  useEffect(() => {
    if (!open || !table) return;
    setSyncMode((table.sync_mode || 'incremental').toLowerCase() === 'full' ? 'full' : 'incremental');
    const inc = (table.incremental_column || '').trim();
    if (inc) {
      setIncrementalColumnCustom(inc);
      setIncrementalColumnSelect('__custom__');
    } else {
      setIncrementalColumnSelect('');
      setIncrementalColumnCustom('');
    }
    setBatchSize(table.batch_size != null && table.batch_size > 0 ? String(table.batch_size) : '');
    setBatchIntervalSeconds(table.batch_interval_seconds != null && table.batch_interval_seconds >= 0 ? String(table.batch_interval_seconds) : '');
    setOnRowError((table.on_row_error || 'fail').toLowerCase() === 'skip' ? 'skip' : 'fail');
    setSubmitError('');
    if (isDbSource && connectionId && sourceTable) loadSourceColumns();
  }, [open, table, isDbSource, connectionId, sourceTable, loadSourceColumns]);

  if (!open) return null;
  if (!isDbSource) {
    return (
      <div className="etl-settings-modal" role="dialog" aria-modal="true" aria-labelledby="etl-settings-modal-title">
        <div className="etl-settings-modal__backdrop" onClick={onClose} />
        <div className="etl-settings-modal__box">
          <div className="etl-settings-modal__head">
            <h3 id="etl-settings-modal-title">동기화·배치 설정</h3>
            <button type="button" className="etl-settings-modal__close" onClick={onClose} aria-label="닫기">×</button>
          </div>
          <p className="etl-settings-modal__hint">DB 연결 소스 ETL에서만 수정할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const dateColumns = sourceColumns.filter((c) => isDateType(c.data_type));
  const finalIncremental =
    syncMode === 'incremental'
      ? (incrementalColumnSelect === '__custom__' ? incrementalColumnCustom.trim() : (incrementalColumnSelect || ''))
      : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (syncMode === 'incremental' && !finalIncremental) {
      setSubmitError('증분 모드에서는 증분 컬럼을 반드시 선택하거나 입력하세요.');
      return;
    }
    if (syncMode === 'incremental' && incrementalColumnSelect === '__custom__' && finalIncremental) {
      try {
        const res = await etl2ValidateIncrementalColumn(connectionId, sourceTable, finalIncremental);
        if (res && res.valid === false) {
          setSubmitError(res.message || '증분 컬럼이 날짜 형식이 아닙니다.');
          return;
        }
      } catch (err) {
        setSubmitError(err.message || '증분 컬럼 검증 실패');
        return;
      }
    }
    setSubmitLoading(true);
    setSubmitError('');
    try {
      await etl2UpdateTable(table.etl_table_id, {
        sync_mode: syncMode,
        incremental_column: syncMode === 'incremental' ? (finalIncremental || null) : '',
        batch_size: batchSize.trim() ? parseInt(batchSize, 10) || null : null,
        batch_interval_seconds: batchIntervalSeconds.trim() ? parseInt(batchIntervalSeconds, 10) ?? 0 : 0,
        on_row_error: onRowError,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(err.message || '저장 실패');
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="etl-settings-modal" role="dialog" aria-modal="true" aria-labelledby="etl-settings-modal-title">
      <div className="etl-settings-modal__backdrop" onClick={onClose} />
      <div className="etl-settings-modal__box">
        <div className="etl-settings-modal__head">
          <h3 id="etl-settings-modal-title">동기화·배치 설정</h3>
          <button type="button" className="etl-settings-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        {table.target_table && (
          <p className="etl-settings-modal__target">타겟 테이블: <strong>{table.target_table}</strong></p>
        )}
        <form onSubmit={handleSubmit} className="etl-settings-modal__form">
          <div className="etl-settings-modal__field">
            <label className="etl-settings-modal__label">동기화 모드</label>
            <span className="etl-settings-modal__desc">전체: 삭제 후 전체 적재. 증분: 증분 컬럼 기준 이후 행만 조회해 Upsert.</span>
            <select
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value)}
              className="etl-settings-modal__select"
            >
              <option value="full">전체(Full)</option>
              <option value="incremental">증분(Incremental)</option>
            </select>
          </div>

          {syncMode === 'incremental' && (
            <div className="etl-settings-modal__field">
              <label className="etl-settings-modal__label">증분 컬럼 (소스) <span className="etl-settings-modal__required">필수</span></label>
              <span className="etl-settings-modal__desc">이 컬럼 &gt; last_synced_at 조건으로 이후 행만 가져옵니다. 날짜/시간 컬럼을 선택하거나 직접 입력 시 검증됩니다.</span>
              {columnsLoading ? (
                <p className="etl-settings-modal__loading">컬럼 목록 불러오는 중…</p>
              ) : (
                <>
                  <select
                    value={incrementalColumnSelect}
                    onChange={(e) => setIncrementalColumnSelect(e.target.value)}
                    className="etl-settings-modal__select"
                  >
                    <option value="">선택</option>
                    {dateColumns.map((c) => (
                      <option key={c.column_name} value={c.column_name}>
                        {c.column_name} ({c.data_type})
                      </option>
                    ))}
                    <option value="__custom__">직접 입력</option>
                  </select>
                  {incrementalColumnSelect === '__custom__' && (
                    <input
                      type="text"
                      value={incrementalColumnCustom}
                      onChange={(e) => setIncrementalColumnCustom(e.target.value)}
                      placeholder="예: updated_at"
                      className="etl-settings-modal__input etl-settings-modal__input--mt"
                    />
                  )}
                </>
              )}
            </div>
          )}

          <div className="etl-settings-modal__field">
            <label className="etl-settings-modal__label">배치 크기 (행 수)</label>
            <span className="etl-settings-modal__desc">0 또는 비우면 전체 한 번에(또는 DB별 기본 배치). MySQL/Oracle은 0이면 1만 행 단위.</span>
            <input
              type="number"
              min="0"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="0"
              className="etl-settings-modal__input"
            />
          </div>
          <div className="etl-settings-modal__field">
            <label className="etl-settings-modal__label">배치 대기 (초)</label>
            <input
              type="number"
              min="0"
              value={batchIntervalSeconds}
              onChange={(e) => setBatchIntervalSeconds(e.target.value)}
              placeholder="0"
              className="etl-settings-modal__input"
            />
          </div>
          <div className="etl-settings-modal__field">
            <label className="etl-settings-modal__label">행 적재 실패 시</label>
            <span className="etl-settings-modal__desc">한 건이라도 실패할 때: 전체 실패로 중단할지, 실패 행만 제외하고 적재할지.</span>
            <select
              value={onRowError}
              onChange={(e) => setOnRowError(e.target.value)}
              className="etl-settings-modal__select"
            >
              <option value="fail">전체 실패</option>
              <option value="skip">실패 행 제외하고 적재</option>
            </select>
          </div>

          {submitError && <p className="etl-settings-modal__error">{submitError}</p>}
          <div className="etl-settings-modal__actions">
            <button type="button" className="etl-settings-modal__btn" onClick={onClose}>취소</button>
            <button type="submit" className="etl-settings-modal__btn etl-settings-modal__btn--primary" disabled={submitLoading}>
              {submitLoading ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
